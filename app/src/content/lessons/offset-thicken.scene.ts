import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { edgeLine, label, line, tag } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { t } from "@/lib/i18n"
import { LessonScene } from "./scene"
import {
  ARC_PIECES,
  FIXED_R,
  HALF_L,
  HANDLE_AT,
  SHOULDER_MID,
  distToPolyline,
  loops,
  minRadiusTowards,
  offsetSection,
  outerSection,
  separateInner,
  shoulderR,
  type Dir,
  type Sample,
} from "./offset-thicken.section"

/**
 * 5.2.4 「偏移与加厚」: the outer surface of a shell (a section of lines and arcs swept along Y, the
 * left shoulder tightening towards the front) offset by a wall thickness. The section at the front
 * shows the offset curve and its swallowtail loops; the surface shows where the offset folds.
 */
export type OffsetState = {
  step: number
  d: number
  dir: Dir
  r0: number
  cut: number
  separate: boolean
  analysis: boolean
  dragged: boolean
  sawFold: boolean
  foundClean: boolean
  outFold: boolean
  checked: boolean
}

const NY = 30
const fmt = (x: number) => (Math.round(x * 10) / 10).toString()

/** Is the offset folding anywhere on the body? */
export function folds(s: Pick<OffsetState, "d" | "dir" | "r0">) {
  return s.d > minRadiusTowards(s.r0, s.dir)
}

/** The wall at the left shoulder (thinnest point between the shoulder arc and the inside), at the section. */
export function shoulderWall(s: Pick<OffsetState, "d" | "r0" | "cut">) {
  const outer = outerSection(s.r0, s.cut)
  const inner = separateInner(s.r0, s.cut, s.d).map((q) => q.p)
  return distToPolyline(outer[SHOULDER_MID].p, inner)
}

export class OffsetScene extends LessonScene<OffsetState> {
  private body = new THREE.Group()
  private section = new THREE.Group()
  private handle: CSS2DObject
  private outerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  private innerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0, side: THREE.DoubleSide })
  private capMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.85, depthWrite: false })
  private loopMat = new LineMaterial({ linewidth: 4, worldUnits: false })
  private innerLineMat = new LineMaterial({ linewidth: 2, worldUnits: false })

  constructor(v: Viewer, emit: (s: OffsetState) => void) {
    super(v, emit, {
      step: 0,
      d: 1,
      dir: "in",
      r0: 1.5,
      cut: -HALF_L,
      separate: false,
      analysis: false,
      dragged: false,
      sawFold: false,
      foundClean: false,
      outFold: false,
      checked: false,
    })
    v.setGrid(80, 10)
    this.handle = this.makeHandle()
    this.root.add(this.body, this.section, this.handle)
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<OffsetState> = { step, separate: false }
    if (step !== 2) patch.cut = -HALF_L
    if (step !== 3) patch.dir = "in"
    if (step <= 1) Object.assign(patch, { d: 1, r0: 1.5 })
    if (step === 2) Object.assign(patch, { d: Math.max(2.5, s.dir === "in" ? s.d : 2.5), r0: 1.5 })
    if (step === 3) Object.assign(patch, { d: 3, dir: "in", r0: 1.5 })
    if (step === 4) Object.assign(patch, { d: 2.5, r0: 1.5, analysis: false })
    if (step === 5) Object.assign(patch, { d: 2.5, r0: 1.5, analysis: true })
    if (step < 4) patch.analysis = false
    this.set(patch)
    this.view(step)
  }

  private view(step: number) {
    const v = this.v
    const fly = (target: THREE.Vector3, dir: THREE.Vector3, dist: number) => v.flyTo(target.clone().addScaledVector(dir.clone().normalize(), dist), target, 850)
    if (step === 0) fly(new THREE.Vector3(-6, -24, 12), new THREE.Vector3(-0.55, -1, 0.6), 215)
    else if (step === 1 || step === 3) fly(new THREE.Vector3(0, -HALF_L, 14), new THREE.Vector3(-0.08, -1, 0.12), 200)
    else if (step === 2) fly(new THREE.Vector3(-40, this.state.cut, 20.5), new THREE.Vector3(-0.1, -1, 0.08), 28)
    else fly(new THREE.Vector3(-4, -14, 12), new THREE.Vector3(-0.7, -1, 0.75), 215)
  }

  // ------------------------------------------------------------ actions

  setD(d: number, fromDrag = false) {
    const patch: Partial<OffsetState> = { d: Math.round(Math.min(8, Math.max(0.2, d)) * 10) / 10 }
    if (fromDrag) patch.dragged = true
    this.update(patch)
  }

  setDir(dir: Dir) {
    this.update({ dir, separate: dir === "out" ? false : this.state.separate })
  }

  setR0(r0: number) {
    this.update({ r0 })
  }

  setCut(cut: number) {
    // Keep the section framed: the camera slides along Y with it.
    const dy = cut - this.state.cut
    this.v.tweens.cancel("camera")
    this.v.camera.position.y += dy
    this.v.controls.target.y += dy
    this.update({ cut })
  }

  setSeparate(separate: boolean) {
    this.update({ separate })
  }

  setAnalysis(analysis: boolean) {
    this.update({ analysis })
  }

  /** The predict reveal: thicken the wall past the shoulder radius. */
  thickenTo(to: number) {
    const from = this.state.d
    this.v.tweens.run(900, (k) => this.setD(from + (to - from) * k), { tag: "thicken" })
  }

  private update(patch: Partial<OffsetState>) {
    const next = { ...this.state, ...patch }
    const f = folds(next)
    if (f) patch.sawFold = true
    if (next.step === 2 && f && next.dir === "in" && shoulderR(next.r0, next.cut) > next.d) patch.foundClean = true
    if (next.step === 3 && next.dir === "out" && f) patch.outFold = true
    if (next.step === 4 && next.analysis && !f && next.d >= minRadiusTowards(next.r0, "in") - 0.6) patch.checked = true
    this.set(patch)
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.body)
    this.clear(this.section)
    this.capMat.color.copy(tk.cut)
    this.loopMat.color.copy(tk.bad)
    this.innerLineMat.color.copy(tk.sketch)
    this.loopMat.resolution.set(this.v.size.w, this.v.size.h)
    this.innerLineMat.resolution.set(this.v.size.w, this.v.size.h)

    const sep = s.separate && s.dir === "in"
    const rows: { y: number; outer: Sample[]; inner: { p: V2; stretch: number }[] }[] = []
    for (let j = 0; j <= NY; j++) {
      const y = s.cut + ((HALF_L - s.cut) * j) / NY
      const outer = outerSection(s.r0, y)
      const inner = sep ? separateInner(s.r0, y, s.d).map((q) => ({ p: q.p, stretch: 1 })) : offsetSection(outer, s.d, s.dir)
      rows.push({ y, outer, inner })
    }

    // Outer surface: model colour; red where the offset folds; with the check on, amber where R < 1.5 d.
    const sg = s.dir === "in" ? 1 : -1
    const colOuter = (q: Sample) => {
      const towards = sg * q.k
      if (towards <= 0) return tk.model
      const R = 1 / towards
      if (sep) return s.analysis && R < 1.5 * s.d ? tk.warn : tk.model
      if (R < s.d) return tk.bad
      if (s.analysis && R < 1.5 * s.d) return tk.warn
      return tk.model
    }
    const outerGeo = strip(
      rows.map((r) => r.outer.map((q) => new THREE.Vector3(q.p[0], r.y, q.p[1]))),
      rows.map((r) => r.outer.map((q) => new THREE.Vector3(q.n[0], 0, q.n[1]))),
      rows.map((r) => r.outer.map(colOuter)),
    )
    const outerMesh = new THREE.Mesh(outerGeo, this.outerMat)
    this.body.add(outerMesh)

    const innerGeo = strip(
      rows.map((r) => r.inner.map((q) => new THREE.Vector3(q.p[0], r.y, q.p[1]))),
      null,
      rows.map((r) => r.inner.map((q) => (q.stretch < 0 ? tk.bad : tk.modelDark))),
    )
    this.body.add(new THREE.Mesh(innerGeo, this.innerMat))

    // Boundary edges of the outer surface.
    const first = rows[0]
    const last = rows[rows.length - 1]
    this.body.add(edgeLine(last.outer.map((q) => new THREE.Vector3(q.p[0], last.y, q.p[1])), kit))
    for (const i of [0, first.outer.length - 1]) this.body.add(edgeLine(rows.map((r) => new THREE.Vector3(r.outer[i].p[0], r.y, r.outer[i].p[1])), kit))

    // ---- the section at the cut
    const y0 = s.cut - 0.06
    const P = (p: V2, dy = 0) => new THREE.Vector3(p[0], y0 - dy, p[1])
    this.section.add(line(first.outer.map((q) => P(q.p)), kit.sketchDefined))
    const innerPts = first.inner.map((q) => q.p)
    const lp = sep ? [] : loops(innerPts)
    this.section.add(line(innerPts.map((p) => P(p)), sep ? this.innerLineMat : kit.sketch))
    for (const l of lp) {
      const loopPts = [l.x, ...innerPts.slice(l.i + 1, l.j + 1), l.x]
      this.section.add(line(loopPts.map((p) => P(p, 0.05)), this.loopMat))
      this.section.add(tag(t("自交", "Self-intersects"), P(l.x, 0.1).add(new THREE.Vector3(0, 0, s.dir === "in" ? -2 : 2))))
    }
    // The wall's cut face, only where the offset is a valid closed section.
    if (!lp.length) {
      const shape = new THREE.Shape([...first.outer.map((q) => new THREE.Vector2(q.p[0], q.p[1])), ...[...innerPts].reverse().map((p) => new THREE.Vector2(p[0], p[1]))])
      const cap = new THREE.ShapeGeometry(shape)
      cap.rotateX(Math.PI / 2)
      cap.translate(0, s.cut - 0.03, 0)
      this.section.add(new THREE.Mesh(cap, this.capMat))
    }

    // Normals as needles (step 1).
    if (s.step === 0) {
      const sgn = s.dir === "in" ? -1 : 1
      const seg: number[] = []
      first.outer.forEach((q, i) => {
        if (i % 2) return
        const e: V2 = [q.p[0] + q.n[0] * sgn * Math.max(s.d, 3), q.p[1] + q.n[1] * sgn * Math.max(s.d, 3)]
        seg.push(q.p[0], y0, q.p[1], e[0], y0, e[1])
      })
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3))
      const ls = new THREE.LineSegments(g, kit.edgeSoft)
      ls.raycast = () => {}
      this.section.add(ls)
    }

    // Radius labels at the arcs of the section.
    if (s.step >= 1) {
      const radii = [shoulderR(s.r0, s.cut), ...FIXED_R]
      ARC_PIECES.forEach((piece, i) => {
        const arc = first.outer.filter((q) => q.piece === piece)
        const mid = arc[Math.floor(arc.length / 2)]
        const concave = mid.k < 0
        const towards = (s.dir === "in" && !concave) || (s.dir === "out" && concave)
        const bad = towards && radii[i] < s.d && !sep
        const text = concave ? t(`R ${fmt(radii[i])} 凹`, `R ${fmt(radii[i])} concave`) : `R ${fmt(radii[i])}`
        const off = i === 0 ? 7 : 5
        const pos = new THREE.Vector3(mid.p[0] + mid.n[0] * off, y0 - 0.2, mid.p[1] + mid.n[1] * off)
        this.section.add(label(text, pos, bad ? "border-destructive text-destructive" : towards ? "text-foreground" : "text-muted-foreground"))
      })
    }

    // The thickness handle sits on the offset curve.
    const hp = first.inner[HANDLE_AT].p
    this.handle.position.set(hp[0], y0 - 0.3, hp[1])
    this.handle.visible = s.step !== 4
    this.v.invalidate()
  }

  private makeHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-3.5 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("拖动，改变壁厚", "Drag to change the wall thickness")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const move = (ev: PointerEvent) => {
        const s = this.state
        const hit = this.v.rayOnPlane(ev, new THREE.Plane(new THREE.Vector3(0, 1, 0), -s.cut))
        if (!hit) return
        const q = outerSection(s.r0, s.cut)[HANDLE_AT]
        const along = (hit.x - q.p[0]) * q.n[0] + (hit.z - q.p[1]) * q.n[1]
        if (s.step === 3 && Math.abs(along) > 0.3) {
          const dir: Dir = along < 0 ? "in" : "out"
          if (dir !== s.dir) this.setDir(dir)
        }
        const signed = this.state.dir === "in" ? -along : along
        this.setD(signed, true)
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }

  dispose() {
    super.dispose()
    for (const m of [this.outerMat, this.innerMat, this.capMat, this.loopMat, this.innerLineMat]) m.dispose()
  }
}

/** A surface from rows of points (row = section at one Y), with optional normals and colours. */
function strip(rows: THREE.Vector3[][], normals: THREE.Vector3[][] | null, colors: THREE.Color[][]) {
  const nu = rows[0].length
  const pos: number[] = []
  const col: number[] = []
  const nor: number[] = []
  rows.forEach((r, j) =>
    r.forEach((p, i) => {
      pos.push(p.x, p.y, p.z)
      const c = colors[j][i]
      col.push(c.r, c.g, c.b)
      if (normals) {
        const n = normals[j][i]
        nor.push(n.x, n.y, n.z)
      }
    }),
  )
  const idx: number[] = []
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < nu - 1; i++) {
      const a = j * nu + i
      idx.push(a, a + 1, a + nu, a + 1, a + nu + 1, a + nu)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  if (normals) g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  else g.computeVertexNormals()
  return g
}
