import * as THREE from "three"
import { edgeLine, label, line } from "@/three/build"
import { filletCorner, type V2 } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { cap, merge, planRing, segment, sweep, withNormals, type Plan, type PV } from "./shell-split.form"

/**
 * 5.6.2 「造型件的 DFM 回检」: the top cover of a handheld, open at the
 * bottom, pulled along Z. Its outside is the Class-A surface from design: a
 * tuck-under below a crisp character line, walls drafted 6°, a shoulder
 * radius and a raised thumb pad on top. It never changes in this lesson.
 * The inside is an engineer's quick shell: vertical walls (no draft) and a
 * flat ceiling under the pad (thick). Three checks run on it: draft,
 * wall thickness and undercuts. Each is fixed on the inside or in the
 * tooling: draft on the inner walls, the pad cored out from inside, and the
 * parting line moved from the bottom edge up to the character line.
 */
export type Check = "draft" | "thick" | "undercut"
export type Cls = "good" | "low" | "under"

export type DfmState = {
  step: number
  check: Check
  /** Fixes: inner wall draft (°, 0 = none), pad cored out, parting line on the character line. */
  draftIn: number
  coreOut: boolean
  plCrease: boolean
  section: boolean
  /** Results of the three checks on the current state. */
  lowCount: number
  underCount: number
  tMax: number
  tMin: number
  lookedInside: boolean
  sawDraftFix: boolean
  sawCoreFix: boolean
  sawPlFix: boolean
  ranAll: Record<Check, boolean>
}

export const PLAN: Plan = { a: 48, b: 30, r: 18, nA: 16, nB: 10, nArc: 9 }
export const H = 20
export const WALL = 2
/** Tuck-under: 1 mm in over the bottom 4 mm, below the character line at z = 4. */
export const CREASE = 4
const TUCK = 1
export const OUTER_DRAFT = 6
const R_SH = 8
/** Inner wall at the bottom, inset from the outline; inner ceiling. */
const D_IN = 2.5
const CEIL = H - WALL
/** Raised thumb pad on top: height, half lengths, centre. */
export const PAD = { h: 3.5, a: 20, b: 13, x: 10 }
/** Checks: minimum draft (°); thickness band around the 2 mm nominal wall. */
export const MIN_DRAFT = 1
export const T_OK: [number, number] = [1.2, 3]

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Smooth bump with zero slope at its edge. */
export function pad(x: number, y: number) {
  const u = 1 - ((x - PAD.x) / PAD.a) ** 2 - (y / PAD.b) ** 2
  return u <= 0 ? 0 : PAD.h * u * u * (3 - 2 * u)
}

function outerProfile(): PV[] {
  const k = Math.tan(THREE.MathUtils.degToRad(OUTER_DRAFT))
  const D: V2 = [(H - CREASE) * k, H]
  const top = filletCorner([0, CREASE], D, [30, H], R_SH, 14).pts
  const pts: [number, number, string][] = [
    [TUCK, 0, "tuck"],
    [TUCK / 2, CREASE / 2, "tuck"],
    [0, CREASE, "crease"],
    ...segment([0, CREASE], top[0], 3)
      .slice(1)
      .map(([d, z]) => [d, z, "outer"] as [number, number, string]),
    ...top.map(([d, z]) => [d, z, "outer"] as [number, number, string]),
  ]
  const pv = withNormals(pts, 10)
  // The crease splits in two: the lower copy belongs to the tuck-under.
  const i = pv.findIndex((p) => p.tag === "crease")
  pv[i].tag = "tuck"
  pv[i + 1].tag = "outer"
  return pv
}

function innerProfile(draftIn: number): PV[] {
  const k = Math.tan(THREE.MathUtils.degToRad(draftIn))
  const B: V2 = [D_IN + CEIL * k, CEIL]
  const top = filletCorner([D_IN, 0], B, [30, CEIL], 6, 10).pts
  return withNormals([[D_IN, 0], ...segment([D_IN, 0], top[0], 4).slice(1), ...top])
}

export const OUTER = outerProfile()

type Part = {
  geo: THREE.BufferGeometry
  /** Per vertex: which surface it is on, and its profile vertex. */
  where: ("outer" | "top" | "inner" | "ceiling" | "rim")[]
  meta: PV[]
  thick: number[]
  cls: (Cls | null)[]
}

export function buildPart(o: { draftIn: number; coreOut: boolean; plCrease: boolean }): Part {
  const base = planRing(PLAN, 0)
  const cols = base.x.length
  const inner = innerProfile(o.draftIn)
  const rows = (p: PV[]) => Array.from({ length: cols }, () => p)
  const outerS = sweep(PLAN, rows(OUTER))
  const topS = cap(PLAN, OUTER[OUTER.length - 1].d, (x, y) => H + pad(x, y), 16)
  const innerS = sweep(PLAN, rows(inner), true)
  const ceilS = cap(PLAN, inner[inner.length - 1].d, (x, y) => CEIL + (o.coreOut ? pad(x, y) : 0), 16, true)
  const rimS = sweep(PLAN, rows(withNormals([[D_IN, 0], [TUCK, 0]])))
  const m = merge([
    { s: outerS, flip: false },
    { s: topS, flip: false },
    { s: innerS, flip: true },
    { s: ceilS, flip: true },
    { s: rimS, flip: false },
  ])
  const where: Part["where"] = []
  const push = (n: number, w: Part["where"][number]) => {
    for (let i = 0; i < n; i++) where.push(w)
  }
  push(outerS.cols * outerS.rows, "outer")
  push(topS.cols * topS.rows, "top")
  push(innerS.cols * innerS.rows, "inner")
  push(ceilS.cols * ceilS.rows, "ceiling")
  push(rimS.cols * rimS.rows, "rim")

  const pos = m.geo.getAttribute("position") as THREE.BufferAttribute
  const nor = m.geo.getAttribute("normal") as THREE.BufferAttribute
  const n = pos.count
  // Draft class: the cavity (+Z) forms the outside above the parting line, the core (−Z) everything else.
  const cls: (Cls | null)[] = []
  for (let i = 0; i < n; i++) {
    const w = where[i]
    const nz = nor.getZ(i)
    const coreSide = w === "inner" || w === "ceiling" || w === "rim" || (w === "outer" && o.plCrease && m.meta[i].tag === "tuck")
    const dr = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(coreSide ? -nz : nz, -1, 1)))
    cls.push(dr < -0.25 ? "under" : dr < MIN_DRAFT - 1e-6 ? "low" : "good")
  }
  // Wall thickness: distance from each vertex to the nearest point of the opposite surface (nearest vertex, then its tangent plane).
  const isOut = (w: string) => w === "outer" || w === "top"
  const isIn = (w: string) => w === "inner" || w === "ceiling"
  const thick = new Array<number>(n).fill(NaN)
  const P = new THREE.Vector3()
  const Q = new THREE.Vector3()
  const N = new THREE.Vector3()
  for (const [from, to] of [
    [isOut, isIn],
    [isIn, isOut],
  ] as const) {
    const grid = new Map<string, number[]>()
    const cell = 3
    const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)}|${Math.floor(y / cell)}|${Math.floor(z / cell)}`
    for (let i = 0; i < n; i++) {
      if (!to(where[i])) continue
      const k = key(pos.getX(i), pos.getY(i), pos.getZ(i))
      const list = grid.get(k)
      if (list) list.push(i)
      else grid.set(k, [i])
    }
    for (let i = 0; i < n; i++) {
      if (!from(where[i])) continue
      P.fromBufferAttribute(pos, i)
      const cx = Math.floor(P.x / cell)
      const cy = Math.floor(P.y / cell)
      const cz = Math.floor(P.z / cell)
      let best = -1
      let bestD = Infinity
      for (let dx = -2; dx <= 2; dx++)
        for (let dy = -2; dy <= 2; dy++)
          for (let dz = -2; dz <= 2; dz++) {
            const list = grid.get(`${cx + dx}|${cy + dy}|${cz + dz}`)
            if (!list) continue
            for (const j of list) {
              Q.fromBufferAttribute(pos, j)
              const d = Q.distanceToSquared(P)
              if (d < bestD) {
                bestD = d
                best = j
              }
            }
          }
      if (best < 0) continue
      Q.fromBufferAttribute(pos, best)
      N.fromBufferAttribute(nor, best)
      thick[i] = Math.abs(P.sub(Q).dot(N))
    }
  }
  return { geo: m.geo, where, meta: m.meta, thick, cls }
}

export function summarise(p: Part) {
  let lowCount = 0
  let underCount = 0
  let tMax = 0
  let tMin = Infinity
  p.cls.forEach((c, i) => {
    if (p.where[i] === "rim") return
    if (c === "low") lowCount++
    if (c === "under") underCount++
  })
  for (const v of p.thick) {
    if (Number.isNaN(v)) continue
    tMax = Math.max(tMax, v)
    tMin = Math.min(tMin, v)
  }
  return { lowCount, underCount, tMax: Math.round(tMax * 10) / 10, tMin: Math.round(tMin * 10) / 10 }
}

export const passes = (s: DfmState): Record<Check, boolean> => ({
  draft: s.lowCount === 0,
  thick: s.tMax <= T_OK[1] && s.tMin >= T_OK[0],
  undercut: s.underCount === 0,
})

export class DfmScene extends LessonScene<DfmState> {
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private mat: THREE.MeshStandardMaterial
  private uCut = { value: new THREE.Color() }
  private clip = new THREE.Plane(V(0, 1, 0), 0)
  private cache: { key: string; part: Part } | null = null
  private gridHidden = false

  constructor(v: Viewer, emit: (s: DfmState) => void) {
    super(v, emit, {
      step: 0,
      check: "draft",
      draftIn: 0,
      coreOut: false,
      plCrease: false,
      section: false,
      lowCount: 0,
      underCount: 0,
      tMax: 0,
      tMin: 0,
      lookedInside: false,
      sawDraftFix: false,
      sawCoreFix: false,
      sawPlFix: false,
      ranAll: { draft: false, thick: false, undercut: false },
    })
    v.setGrid(100, 10)
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    // Inside faces seen through the section are painted flat, like the kit's section view.
    this.mat.onBeforeCompile = (shader) => {
      shader.uniforms.uCutColor = this.uCut
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCutColor;")
        .replace("#include <opaque_fragment>", "#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(uCutColor, 1.0);")
    }
    this.mat.customProgramCacheKey = () => "ft-dfm-cut"
    this.root.add(this.body, this.marks)
    this.own(
      v.onCameraChange(() => {
        const dir = v.camera.position.clone().sub(v.controls.target).normalize()
        const below = dir.z < 0
        if (below !== this.gridHidden) {
          this.gridHidden = below
          v.showGrid(!below)
        }
        if (this.state.step === 0 && !this.state.lookedInside && dir.z < -0.3) this.set({ lookedInside: true })
      }),
    )
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<DfmState> = { step, section: step === 2 }
    // Each check starts from its "before"; fixes from earlier checks stay applied.
    if (step <= 1) Object.assign(patch, { draftIn: 0, coreOut: false, plCrease: false })
    if (step === 1) patch.check = "draft"
    if (step === 2) Object.assign(patch, { check: "thick", coreOut: false, draftIn: s.draftIn || 1.5 })
    if (step === 3) Object.assign(patch, { check: "undercut", plCrease: false, draftIn: s.draftIn || 1.5, coreOut: true })
    if (step === 4) Object.assign(patch, { check: "draft", draftIn: s.draftIn || 1.5, coreOut: true, plCrease: true, ranAll: { draft: true, thick: false, undercut: false } })
    if (step === 0) patch.check = "draft"
    this.update(patch)
    const v = this.v
    const target = V(0, 0, 8)
    if (step === 0) v.flyTo(V(125, -150, 105), target, 900)
    else if (step === 1) v.flyTo(V(115, -140, -85), V(0, 0, 6), 900)
    else if (step === 2) v.flyTo(V(40, -160, 115), V(4, 0, 10), 900)
    else if (step === 3) v.flyTo(V(120, -175, 28), V(0, 0, 5), 900)
    else v.flyTo(V(120, -150, -60), V(0, 0, 6), 900)
  }

  // ------------------------------------------------------------ actions

  lookInside() {
    this.v.flyTo(V(110, -135, -95), V(0, 0, 6), 900)
  }

  lookOutside() {
    this.v.flyTo(V(125, -150, 105), V(0, 0, 8), 900)
  }

  setDraftIn(draftIn: number) {
    this.update({ draftIn, sawDraftFix: this.state.sawDraftFix || draftIn >= MIN_DRAFT })
  }

  setCoreOut(coreOut: boolean) {
    this.update({ coreOut, sawCoreFix: this.state.sawCoreFix || coreOut })
  }

  setPl(plCrease: boolean) {
    this.update({ plCrease, sawPlFix: this.state.sawPlFix || plCrease })
  }

  setSection(section: boolean) {
    this.set({ section })
  }

  setCheck(check: Check) {
    const ranAll = { ...this.state.ranAll, [check]: true }
    this.set({ check, ranAll })
  }

  private model(s: Pick<DfmState, "draftIn" | "coreOut" | "plCrease">) {
    const key = `${s.draftIn}|${s.coreOut}|${s.plCrease}`
    if (this.cache?.key !== key) {
      this.cache?.part.geo.dispose()
      const part = buildPart(s)
      part.geo.userData.shared = true
      this.cache = { key, part }
    }
    return this.cache.part
  }

  private update(patch: Partial<DfmState>) {
    const n = { ...this.state, ...patch }
    this.set({ ...patch, ...summarise(this.model(n)) })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.body)
    this.clear(this.marks)
    this.uCut.value.copy(tk.cut)
    const on = s.section
    if (on !== !!this.mat.clippingPlanes) {
      this.mat.clippingPlanes = on ? [this.clip] : null
      this.mat.side = on ? THREE.DoubleSide : THREE.FrontSide
      this.mat.needsUpdate = true
    }

    const part = this.model(s)
    const col = part.geo.getAttribute("color") as THREE.BufferAttribute
    const arr = col.array as Float32Array
    const c = new THREE.Color()
    const intro = s.step === 0
    part.cls.forEach((k, i) => {
      const w = part.where[i]
      if (intro) c.copy(w === "outer" || w === "top" ? tk.highlight : tk.model)
      else if (w === "rim") c.copy(tk.model)
      else if (s.check === "thick") heat(c, part.thick[i], tk)
      else if (s.check === "undercut") c.copy(k === "under" ? tk.bad : tk.model)
      else c.copy(k === "good" ? tk.good : k === "low" ? tk.warn : tk.bad)
      arr.set([c.r, c.g, c.b], i * 3)
    })
    col.needsUpdate = true
    const mesh = new THREE.Mesh(part.geo, this.mat)
    mesh.userData = { kind: "face", feature: "cover", role: "model" }
    this.body.add(mesh)
    // Crisp edges only: the bottom rim inside and out, and the character line.
    for (const [d, z] of [
      [TUCK, 0],
      [D_IN, 0],
      [0, CREASE],
    ] as const) {
      const r = planRing(PLAN, d)
      const pts = r.x.map((x, i) => V(x, r.y[i], z))
      // Cut open: only the half that is still there (the ring runs from +X through +Y to −X).
      mesh.add(edgeLine(on ? pts.filter((p) => p.y >= -1e-6) : pts.concat(pts[0]), kit, d === 0))
    }

    // The parting line: on the bottom edge, or on the character line.
    const z = s.plCrease ? CREASE : 0
    const ring = planRing(PLAN, s.plCrease ? 0 : TUCK)
    const pts = ring.x.map((x, i) => V(x + ring.nx[i] * 0.15, ring.y[i] + ring.ny[i] * 0.15, z))
    if (s.step >= 3 || s.check === "undercut") {
      this.marks.add(line(pts.concat(pts[0]), kit.sketch))
      this.marks.add(label(t("分型线", "Parting line"), pts[Math.round(pts.length * 0.72)].clone().add(V(0, -2, -3)), "border-primary text-primary font-sans"))
    }
    if (intro) {
      this.marks.add(label(t("A 面：造型给定，不能动", "Class-A surface: from design, not to be touched"), V(PLAN.a * 0.3, -PLAN.b, H + 4), "border-primary text-primary font-sans"))
    }
    if (s.check === "thick" && s.step >= 2 && !intro) {
      const tmax = Math.max(...part.thick.filter((v) => !Number.isNaN(v)))
      const txt = t(`最厚 ${tmax.toFixed(1)} mm`, `Thickest ${tmax.toFixed(1)} mm`)
      this.marks.add(label(txt, V(PAD.x, 0, H + PAD.h + 4), tmax > T_OK[1] ? "border-warning text-warning" : ""))
    }
    this.v.invalidate()
  }

  dispose() {
    this.v.showGrid(true)
    super.dispose()
    this.cache?.part.geo.dispose()
    this.mat.dispose()
  }
}

/** Wall thickness to a colour: thin blue, nominal green, thick orange to red. */
function heat(out: THREE.Color, v: number, tk: Viewer["tokens"]) {
  if (Number.isNaN(v)) return out.copy(tk.model)
  if (v < 1.2) return out.copy(tk.highlight)
  if (v < 1.6) return out.copy(tk.highlight).lerp(tk.good, (v - 1.2) / 0.4)
  if (v <= 2.8) return out.copy(tk.good)
  if (v < 3.6) return out.copy(tk.good).lerp(tk.warn, (v - 2.8) / 0.8)
  if (v < 4.4) return out.copy(tk.warn).lerp(tk.bad, (v - 3.6) / 0.8)
  return out.copy(tk.bad)
}
