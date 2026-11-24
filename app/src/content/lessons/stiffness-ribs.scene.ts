import * as THREE from "three"
import { face, label, line } from "@/three/build"
import { t as tr } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { deflection, deflectionAt, GEO, junctionDiameter, RIB_END, ribChecks, ribXs, ribYs, RULE, type Panel } from "./stiffness-ribs.beam"
import { LessonScene } from "./scene"

/**
 * 6.5.2 「刚度直觉：壁厚与筋」: an ABS panel on two supports with a load at mid-span. The bent
 * shape is drawn from the beam formula (exaggerated EXAG times); thickness, ribs (count, height,
 * thickness, direction) rebuild it. The last step cuts it at mid-span to show the thick spot where a
 * rib meets the wall, sink marks over over-thick ribs, and ribs too tall to mould well.
 */
export type RibState = Panel & {
  step: number
  section: boolean
  tried4: boolean
  reached: boolean
  triedAcross: boolean
  backAlong: boolean
}

/** Bent shape drawn this many times its computed size. */
export const EXAG = 3
const Z0 = 60
const SEG = 64

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export class StiffnessScene extends LessonScene<RibState> {
  private rig = new THREE.Group()
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private plateMat: THREE.MeshStandardMaterial
  private ribMat: THREE.MeshStandardMaterial
  private badMat: THREE.MeshStandardMaterial
  private sinkMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.75, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })

  constructor(v: Viewer, emit: (s: RibState) => void) {
    super(v, emit, { step: 0, t: 2, n: 0, h: 6, r: 1.2, across: false, section: false, tried4: false, reached: false, triedAcross: false, backAlong: false })
    v.showGrid(false)
    this.plateMat = cutMaterial(v.kit.clipping)
    this.ribMat = cutMaterial(v.kit.clipping)
    this.badMat = cutMaterial(v.kit.clipping)
    this.root.add(this.rig, this.body, this.marks)
  }

  enter(step: number) {
    const presets: Partial<RibState>[] = [
      { t: 2, n: 0 },
      { t: 2, n: 0 },
      { t: 2, n: 2, h: 4, r: 1.2, across: false },
      { t: 2, n: 3, h: 6, r: 1.2, across: false },
      { t: 2, n: 2, h: 10, r: 2, across: false },
    ]
    this.v.tweens.cancel("thick")
    this.set({ step, ...presets[step], section: step === 4 })
    const v = this.v
    const all = new THREE.Box3(V(-GEO.len / 2, -GEO.b / 2, 0), V(GEO.len / 2, GEO.b / 2, Z0 + 20))
    if (step <= 1) v.fit(all, { dir: V(0.3, -1, 0.3), padding: 1.02 })
    else if (step <= 3) v.fit(all, { dir: V(0.55, -1, -0.12), padding: 1.0 })
    else v.flyTo(V(180, -42, Z0 + 36), V(0, 0, Z0 - 9), 900)
  }

  // ------------------------------------------------------------ actions

  setT(t: number) {
    const s = this.state
    const p = { ...s, t }
    this.set({ t, tried4: s.tried4 || t >= 3.95, reached: s.reached || (s.step === 1 && s.n === 0 && deflection(p) <= 1) })
  }

  /** The predict reveal: thicken from 2 to 4 mm, slowly enough to watch the sag go. */
  doubleIt() {
    const from = this.state.t
    this.v.tweens.run(1300, (k) => this.setT(Math.round((from + (4 - from) * k) * 10) / 10), { tag: "thick" })
  }

  setRib(patch: Partial<Pick<RibState, "n" | "h" | "r">>) {
    this.set(patch)
  }

  setAcross(across: boolean) {
    const s = this.state
    this.set({ across, triedAcross: s.triedAcross || across, backAlong: s.backAlong || (s.triedAcross && !across) })
  }

  // ------------------------------------------------------------ build

  protected render() {
    const s = this.state
    const v = this.v
    const kit = v.kit
    const tk = v.tokens
    kit.setSection(s.section ? new THREE.Plane(V(-1, 0, 0), 0) : null)
    this.plateMat.color.copy(tk.model)
    ;(this.plateMat.userData.uCut as { value: THREE.Color }).value.copy(tk.cut)
    this.ribMat.color.copy(tk.model).lerp(tk.highlight, s.step >= 2 ? 0.35 : 0)
    ;(this.ribMat.userData.uCut as { value: THREE.Color }).value.copy(tk.cut).lerp(tk.highlight, 0.35)
    this.badMat.color.copy(tk.warn)
    ;(this.badMat.userData.uCut as { value: THREE.Color }).value.copy(tk.warn)
    this.sinkMat.color.copy(tk.bad)

    const w = (x: number) => EXAG * deflectionAt(s, x)
    const chk = ribChecks(s)

    // ---- supports (fixed)
    this.clear(this.rig)
    for (const x of [-GEO.L / 2, GEO.L / 2]) {
      // A round rail along the width (the cylinder's own axis is Y), its top touching the panel.
      const rail = new THREE.CylinderGeometry(3, 3, GEO.b + 10, 24)
      rail.translate(x, 0, Z0 - s.t - 3)
      this.rig.add(face(rail, kit, { role: "modelDark", edges: false }))
      // Two slim posts at the rail's ends, outside the panel, so the view underneath stays clear.
      for (const y of [-(GEO.b / 2 + 3), GEO.b / 2 + 3]) {
        const post = new THREE.BoxGeometry(5, 5, Z0 - s.t - 3)
        post.translate(x, y, (Z0 - s.t - 3) / 2)
        this.rig.add(face(post, kit, { role: "modelDark", edges: 30 }))
      }
    }

    // ---- the panel, bent
    this.clear(this.body)
    const plate = new THREE.BoxGeometry(GEO.len, GEO.b, s.t, SEG, 1, 1)
    plate.translate(0, 0, Z0 - s.t / 2)
    bend(plate, w)
    const pm = face(plate, kit, { feature: "plate", edges: 30 })
    pm.material = this.plateMat
    this.body.add(pm)
    if (s.n > 0 && s.h > 0) {
      const mat = chk.tall && s.step === 4 ? this.badMat : this.ribMat
      if (!s.across) {
        const len = GEO.L - 2 * RIB_END
        for (const y of ribYs(s.n)) {
          const g = new THREE.BoxGeometry(len, s.r, s.h, SEG, 1, 1)
          g.translate(0, y, Z0 - s.t - s.h / 2 + 0.01)
          bend(g, w)
          const m = face(g, kit, { feature: "rib", edges: 30 })
          m.material = mat
          this.body.add(m)
        }
      } else {
        for (const x of ribXs(s.n)) {
          const g = new THREE.BoxGeometry(s.r, GEO.b - 8, s.h, 1, 1, 1)
          g.translate(x, 0, Z0 - s.t - s.h / 2 + 0.01)
          bend(g, w)
          const m = face(g, kit, { feature: "rib", edges: 30 })
          m.material = mat
          this.body.add(m)
        }
      }
    }

    // ---- load, reference line, readouts
    this.clear(this.marks)
    const top = Z0 - w(0)
    const arrow = new THREE.Group()
    const shaft = new THREE.CylinderGeometry(1, 1, 22, 12)
    shaft.rotateX(Math.PI / 2)
    shaft.translate(0, 0, 18)
    const head = new THREE.ConeGeometry(3.2, 7, 20)
    head.rotateX(-Math.PI / 2)
    head.translate(0, 0, 3.5)
    arrow.add(face(shaft, kit, { role: "highlight", edges: false }), face(head, kit, { role: "highlight", edges: false }))
    arrow.position.set(0, 0, top + 0.3)
    this.marks.add(arrow)
    const load = label(tr(`${GEO.F} N`, `${GEO.F} N`), V(0, 0, top + 33), "font-sans")
    this.marks.add(load)
    if (!s.section) {
      const y = -GEO.b / 2 - 0.5
      this.marks.add(line([V(-GEO.len / 2, y, Z0), V(GEO.len / 2, y, Z0)], kit.construction))
      const d = deflection(s)
      const dl = label(tr(`变形 ${fmt(d)} mm`, `Deflection ${fmt(d)} mm`), V(0, y, top - s.t - (s.n && !s.across ? s.h : 0) - 6), d <= 1 ? "border-success text-success font-sans" : "font-sans")
      this.marks.add(dl)
    }

    // ---- moulding checks (last step): thick spots, sink marks, tall ribs
    if (s.step === 4 && s.n > 0 && !s.across) {
      const D = junctionDiameter(s.t, s.r)
      for (const y of ribYs(s.n)) {
        const R = D / 2
        const c = V(0.08, y, top - R)
        const ring: THREE.Vector3[] = []
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * Math.PI * 2
          ring.push(V(0.08, y + Math.cos(a) * R, c.z + Math.sin(a) * R))
        }
        this.marks.add(line(ring, kit.sketch))
        if (chk.thick) {
          // A sink mark runs along the face above the rib: drawn as a band on the top, for x ≤ 0 (the half that is kept).
          const band = new THREE.PlaneGeometry(GEO.L / 2 - RIB_END, s.r * 1.8, 24, 1)
          band.translate(-(GEO.L / 2 - RIB_END) / 2, y, Z0 + 0.04)
          bend(band, w)
          this.marks.add(new THREE.Mesh(band, this.sinkMat))
        }
      }
      const y0 = ribYs(s.n)[0]
      const ratio = D / s.t
      const tagEl = label(
        tr(`最厚处 Ø${D.toFixed(2)}，是壁厚的 ${ratio.toFixed(2)} 倍`, `Thickest spot Ø${D.toFixed(2)}, ${ratio.toFixed(2)}× the wall`),
        V(0, y0, top - s.t - s.h - 6),
        chk.thick ? "border-warning text-warning font-sans" : "font-sans",
      )
      this.marks.add(tagEl)
      if (chk.thick) this.marks.add(label(tr("缩痕：筋太厚，正面被拉凹", "Sink mark: the rib is too thick and pulls the face in"), V(-40, y0, top + 10), "border-destructive text-destructive font-sans"))
      if (chk.tall) this.marks.add(label(tr(`太高：超过壁厚的 ${RULE.height} 倍，难充填、难脱模`, `Too tall: over ${RULE.height}× the wall, hard to fill and eject`), V(0, ribYs(s.n)[s.n - 1], top - s.t - s.h - 15), "border-warning text-warning font-sans"))
    }
    v.invalidate()
  }

  dispose() {
    const v = this.v
    v.kit.setSection(null)
    v.showGrid(true)
    super.dispose()
    this.plateMat.dispose()
    this.ribMat.dispose()
    this.badMat.dispose()
    this.sinkMat.dispose()
  }
}

/** Two decimals under 10 mm, one above. */
export const fmt = (d: number) => (d >= 10 ? d.toFixed(1) : d.toFixed(2))

/** Move every vertex down by the bent shape at its x. */
function bend(g: THREE.BufferGeometry, w: (x: number) => number) {
  const p = g.getAttribute("position")
  for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - w(p.getX(i)))
  p.needsUpdate = true
  g.computeVertexNormals()
}

/** A part material that paints the inside of a cut solid flat (as the kit's do), in a colour of its own. */
function cutMaterial(clipping: THREE.Plane[]) {
  const uCut = { value: new THREE.Color() }
  const m = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, side: THREE.DoubleSide, clippingPlanes: clipping, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  m.userData.uCut = uCut
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uCutColor = uCut
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 uCutColor;")
      .replace("#include <opaque_fragment>", "#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(uCutColor, 1.0);")
  }
  m.customProgramCacheKey = () => "stiffness-cut"
  return m
}
