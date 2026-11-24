import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { edgeLine, face, label, line, tag } from "@/three/build"
import { filletCorner, type V2 } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { cap, merge, planRing, segment, studioMaterial, sweep, withNormals, type Plan, type PV } from "./shell-split.form"

/**
 * 5.6.1 「外观件拆件与结构化」: a styled housing (rounded plan, a shoulder
 * radius on top, walls drafted 3° away from a waistline with a shadow
 * groove in it) split into a top and a bottom shell by a plane the learner
 * moves and tilts. Each shell is moulded on its own along ±Z: walking a
 * section from the shell's rim outward, faces first release toward the
 * rim side, then toward the far side; where that switch happens away from
 * the rim, that shell's mould needs a parting line of its own (an extra
 * line on the product), and a face that turns back after the switch is an
 * undercut. Then the parting line against the highlight, the lip and
 * groove (止口) in section, and where the screws go.
 */
export type ScrewSide = "bottom" | "top"
export type Preset = "highlight" | "side" | "groove"

export type SplitState = {
  step: number
  /** Split height at the middle (x = 0), mm, and tilt about Y, degrees. */
  h: number
  tilt: number
  /** Shells pulled apart, mm. */
  explode: number
  lip: boolean
  screws: ScrewSide | null
  /** Assembly animation 0 … 1 (top shell down, then the screws in). */
  assembly: number
  undercut: boolean
  extraLine: "top" | "bottom" | "both" | null
  triedOff: boolean
  foundClean: boolean
  sawHighlight: boolean
  sawGroove: boolean
  triedLip: boolean
  triedPlain: boolean
  assembled: boolean
}

export const PLAN: Plan = { a: 55, b: 36, r: 20, nA: 18, nB: 12, nArc: 10 }
export const H = 32
export const WALL = 2
/** Waistline: the widest section, with a shadow groove (drawn deeper than the usual 0.5 × 0.5 mm so it reads on screen). */
export const ZW = 13
export const GD = 0.8
export const GH = 0.8
export const DRAFT = 3
const R_BOT = 5
export const R_SH = 10
/** Lip (male, on the bottom shell's inner side) and its clearances. */
export const LIP = { w: 0.9, h: 1.4, side: 0.1, top: 0.2 }
const BOSSES: V2[] = [
  [40, 22],
  [-40, 22],
  [40, -22],
  [-40, -22],
]

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const K = Math.tan(THREE.MathUtils.degToRad(DRAFT))

/** Outer section, bottom cap edge → side → top cap edge. */
function outerProfile(): PV[] {
  const lowTop = ZW - GH
  const upBot = ZW + GH
  const B: V2 = [lowTop * K, 0]
  const bot = filletCorner([30, 0], B, [0, lowTop], R_BOT, 10).pts
  const D: V2 = [(H - upBot) * K, H]
  const top = filletCorner([0, upBot], D, [30, H], R_SH, 16).pts
  const pts: (V2 | [number, number, string])[] = [
    ...bot,
    [0, lowTop, "edge"],
    [GD, lowTop, "groove"],
    [GD, upBot, "groove"],
    [0, upBot, "edge"],
    ...segment([0, upBot], top[0], 4).slice(1),
    ...top,
  ]
  return withNormals(pts)
}

/** Inner section, the same way round (its normals are flipped when swept). */
function innerProfile(): PV[] {
  const B: V2 = [(ZW - WALL) * K + WALL, WALL]
  const bot = filletCorner([30, WALL], B, [WALL, ZW], R_BOT - WALL, 8).pts
  const D: V2 = [(H - WALL - ZW) * K + WALL, H - WALL]
  const top = filletCorner([WALL, ZW], D, [30, H - WALL], R_SH - WALL, 12).pts
  return withNormals([...bot, [WALL, ZW], ...top])
}

const OUTER = outerProfile()
const INNER = innerProfile()

/** Cut a z-monotonic profile at zs, keeping the part above (or below); cut-off vertices collapse onto the cut, so every column keeps the same length. */
function cut(prof: PV[], zs: number, keep: "above" | "below"): { rows: PV[]; at: PV } {
  const n = prof.length
  if (keep === "above") {
    let j = prof.findIndex((p) => p.z >= zs)
    if (j < 0) j = n - 1
    const at = j === 0 ? prof[0] : lerpPV(prof[j - 1], prof[j], zs)
    return { rows: prof.map((p, i) => (i < j ? at : p)), at }
  }
  let j = n - 1
  while (j > 0 && prof[j].z > zs) j--
  const at = j === n - 1 ? prof[n - 1] : lerpPV(prof[j], prof[j + 1], zs)
  return { rows: prof.map((p, i) => (i > j ? at : p)), at }
}

function lerpPV(a: PV, b: PV, z: number): PV {
  const k = b.z - a.z < 1e-9 ? 1 : (z - a.z) / (b.z - a.z)
  const no = a.no + (b.no - a.no) * k
  const nz = a.nz + (b.nz - a.nz) * k
  const l = Math.hypot(no, nz) || 1
  return { d: a.d + (b.d - a.d) * k, z, no: no / l, nz: nz / l, tag: a.tag === b.tag ? a.tag : undefined }
}

export type Shell = {
  geo: THREE.BufferGeometry
  meta: PV[]
  /** Outer split points (the parting line) and, where a shell needs its own mould parting line away from the rim, those points. */
  rim: THREE.Vector3[]
  extra: THREE.Vector3[]
  undercut: boolean
  /** Per vertex draft class of the outer surface (null elsewhere). */
  draft: ("good" | "low" | "under" | null)[]
}

/** Split height of each ring column. */
export function splitHeights(h: number, tilt: number) {
  const base = planRing(PLAN, 0)
  const k = Math.tan(THREE.MathUtils.degToRad(tilt))
  return base.x.map((x) => THREE.MathUtils.clamp(h + k * x, 3, H - 3))
}

export function buildShells(h: number, tilt: number, lip: boolean): { top: Shell; bottom: Shell } {
  const zs = splitHeights(h, tilt)
  const out = {} as { top: Shell; bottom: Shell }
  for (const which of ["top", "bottom"] as const) {
    const up = which === "top"
    const outerRows: PV[][] = []
    const innerRows: PV[][] = []
    const rimRows: PV[][] = []
    const rim: THREE.Vector3[] = []
    const extra: THREE.Vector3[] = []
    let extraCount = 0
    let undercut = false
    const draftCols: ("good" | "low" | "under" | null)[][] = []
    zs.forEach((z, c) => {
      const o = cut(OUTER, z, up ? "above" : "below")
      const zIn = up ? z + (lip ? LIP.h + LIP.top : 0) : z + (lip ? LIP.h : 0)
      const i = cut(INNER, zIn, up ? "above" : "below")
      outerRows.push(o.rows)
      innerRows.push(i.rows)
      // Rim section: bottom shell walks outer → inner over the lip; top shell inner → outer under the groove.
      const dO = o.at.d
      const dI = i.at.d
      const wOut = dI - dO - LIP.w
      let pts: V2[]
      if (up) pts = lip ? [[dI, zIn], [dO + wOut - LIP.side, zIn], [dO + wOut - LIP.side, z], [dO, z]] : [[dI, z], [dO, z]]
      else pts = lip ? [[dO, z], [dO + wOut, z], [dO + wOut, zIn], [dI, zIn]] : [[dO, z], [dI, z]]
      rimRows.push(withNormals(pts.map(([d, zz]) => [d, zz, "rim"] as [number, number, string])))
      const onSurface = planRing(PLAN, o.at.d)
      rim.push(V(onSurface.x[c], onSurface.y[c], z))
      // Release walk from the rim outward: toward the rim side first, then (after the switch) toward the far side.
      const f = up ? 1 : -1
      const order = up ? o.rows.map((_, k) => k) : o.rows.map((_, k) => o.rows.length - 1 - k)
      const cls: ("good" | "low" | "under" | null)[] = new Array(o.rows.length).fill(null)
      let far = false
      let switchAt: PV | null = null
      for (const k of order) {
        const p = o.rows[k]
        if (!far && f * p.nz > 2e-3) {
          far = true
          switchAt = p
        }
        const dr = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(far ? f * p.nz : -f * p.nz, -1, 1)))
        cls[k] = dr < -0.25 ? "under" : dr < 1 ? "low" : "good"
        if (cls[k] === "under") undercut = true
      }
      draftCols.push(cls)
      if (switchAt && Math.abs(switchAt.z - z) > 2 * GH + 0.4) {
        const r = planRing(PLAN, switchAt.d)
        extra.push(V(r.x[c], r.y[c], switchAt.z))
        extraCount++
      } else extra.push(V(NaN, NaN, NaN))
    })
    const outer = sweep(PLAN, outerRows)
    const inner = sweep(PLAN, innerRows, true)
    const rimS = sweep(PLAN, rimRows)
    // Caps: the outer top or bottom, and the inner ceiling or floor.
    const capO = up ? cap(PLAN, OUTER[OUTER.length - 1].d, () => H) : cap(PLAN, OUTER[0].d, () => 0, 14, true)
    const capI = up ? cap(PLAN, INNER[INNER.length - 1].d, () => H - WALL, 14, true) : cap(PLAN, INNER[0].d, () => WALL)
    const m = merge([
      { s: outer, flip: false },
      { s: inner, flip: true },
      { s: rimS, flip: false },
      { s: capO, flip: !up },
      { s: capI, flip: up },
    ])
    // Draft classes follow the merge order: outer first (column-major, rows within).
    const draft: ("good" | "low" | "under" | null)[] = []
    for (let c = 0; c < outer.cols; c++) for (let k = 0; k < outer.rows; k++) draft.push(draftCols[c][k])
    while (draft.length < m.meta.length) draft.push(null)
    // Caps face their own pull: good.
    const capStart = (outer.cols * outer.rows + inner.cols * inner.rows + rimS.cols * rimS.rows) as number
    for (let k = capStart; k < capStart + capO.cols * capO.rows; k++) draft[k] = "good"
    out[which] = { geo: m.geo, meta: m.meta, rim, extra: extraCount > 4 ? extra : [], undercut, draft }
  }
  return out
}

export class SplitScene extends LessonScene<SplitState> {
  private shells = new THREE.Group()
  private marks = new THREE.Group()
  private studio = studioMaterial()
  private draftMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  private seam = new LineMaterial({ linewidth: 1.6, worldUnits: false })
  private cache: { key: string; top: Shell; bottom: Shell } | null = null

  constructor(v: Viewer, emit: (s: SplitState) => void) {
    super(v, emit, {
      step: 0,
      h: ZW,
      tilt: 0,
      explode: 0,
      lip: true,
      screws: null,
      assembly: 1,
      undercut: false,
      extraLine: null,
      triedOff: false,
      foundClean: false,
      sawHighlight: false,
      sawGroove: false,
      triedLip: false,
      triedPlain: false,
      assembled: false,
    })
    v.setGrid(120, 10)
    this.root.add(this.shells, this.marks)
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("split")
    this.v.kit.setSection(step === 3 ? new THREE.Plane(V(0, 1, 0), 0) : null)
    // The section reads like a drawing: no perspective, so the rim behind the cut doesn't recede into view.
    this.v.setProjection(step === 3 ? "orthographic" : "perspective")
    const patch: Partial<SplitState> = { step, assembly: 1 }
    if (step === 0) Object.assign(patch, { h: ZW, tilt: 0, explode: 0, lip: true })
    if (step === 1) Object.assign(patch, { explode: Math.max(10, s.explode), tilt: 0 })
    if (step === 2) Object.assign(patch, { explode: 0 })
    if (step >= 3) Object.assign(patch, { h: ZW, tilt: 0 })
    if (step === 3) Object.assign(patch, { explode: 0.6 })
    if (step === 4) Object.assign(patch, { explode: 22, lip: true, assembly: 0 })
    this.update(patch)
    const v = this.v
    if (step === 0) v.flyTo(V(150, -190, 120), V(0, 0, 14), 900)
    else if (step === 1) v.flyTo(V(140, -200, 70), V(0, 0, 16), 900)
    else if (step === 2) v.flyTo(V(120, -200, 95), V(4, 0, 15), 900)
    else if (step === 3) v.setView("front", { target: V(PLAN.a - 0.5, 0, ZW + 0.6), distance: 19 })
    else v.flyTo(V(150, -170, 70), V(0, 0, 18), 900)
  }

  // ------------------------------------------------------------ actions

  setSplit(patch: Partial<Pick<SplitState, "h" | "tilt">>) {
    this.update(patch)
  }

  preset(p: Preset) {
    const h = p === "groove" ? ZW : p === "side" ? 21 : H - 4
    this.update({ h, tilt: 0 })
  }

  setExplode(explode: number) {
    this.set({ explode })
  }

  setLip(lip: boolean) {
    this.update({ lip, triedLip: this.state.triedLip || lip, triedPlain: this.state.triedPlain || !lip })
  }

  setScrews(screws: ScrewSide) {
    this.v.tweens.cancel("split")
    this.set({ screws, assembly: 0, explode: 22 })
  }

  /** Top shell down onto the bottom, then the screws in from their side. */
  assemble() {
    const s = this.state
    this.v.tweens.cancel("split")
    this.v.tweens.run(2200, (k) => {
      this.state.assembly = k
      this.state.explode = 22 * (1 - Math.min(1, k / 0.55))
      this.render()
    }, { tag: "split" }).then(() => {
      if (this.state.step !== s.step) return
      this.set({ assembly: 1, explode: 0, assembled: this.state.assembled || this.state.screws === "bottom" })
    })
  }

  /** Where the split sits at the front, for the panel's verdict. */
  region(s = this.state): Preset {
    if (Math.abs(s.h - ZW) <= GH && Math.abs(s.tilt) < 0.5) return "groove"
    if (s.h > H - R_SH) return "highlight"
    return "side"
  }

  private update(patch: Partial<SplitState>) {
    const n = { ...this.state, ...patch }
    const sh = this.model(n)
    const undercut = sh.top.undercut || sh.bottom.undercut
    const et = sh.top.extra.length > 0
    const eb = sh.bottom.extra.length > 0
    const extraLine = et && eb ? "both" : et ? "top" : eb ? "bottom" : null
    const clean = !undercut && !extraLine
    const region = this.region(n)
    this.set({
      ...patch,
      undercut,
      extraLine,
      triedOff: this.state.triedOff || (n.step === 1 && !clean),
      foundClean: this.state.foundClean || (n.step === 1 && clean && this.state.triedOff),
      sawHighlight: this.state.sawHighlight || (n.step === 2 && region === "highlight"),
      sawGroove: this.state.sawGroove || (n.step === 2 && region === "groove" && this.state.sawHighlight),
    })
  }

  private model(s: Pick<SplitState, "h" | "tilt" | "lip">) {
    const key = `${s.h}|${s.tilt}|${s.lip}`
    if (this.cache?.key !== key) {
      if (this.cache) {
        this.cache.top.geo.dispose()
        this.cache.bottom.geo.dispose()
      }
      const sh = buildShells(s.h, s.tilt, s.lip)
      sh.top.geo.userData.shared = true
      sh.bottom.geo.userData.shared = true
      this.cache = { key, ...sh }
    }
    return this.cache
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.shells)
    this.clear(this.marks)
    const sh = this.model(s)
    const u = this.studio.uniforms
    ;(u.uBase.value as THREE.Color).copy(tk.model)
    ;(u.uLight.value as THREE.Color).copy(tk.dark ? tk.ink : tk.paper)
    ;(u.uDark.value as THREE.Color).copy(tk.modelDark)
    this.seam.color.copy(tk.modelDark)
    this.seam.resolution.set(this.v.size.w, this.v.size.h)

    const mode: "studio" | "draft" | "plain" = s.step === 1 ? "draft" : s.step === 0 || s.step === 2 ? "studio" : "plain"
    for (const which of ["top", "bottom"] as const) {
      const shell = sh[which]
      this.paint(shell, mode)
      // Screw step: the top shell see-through, so its bosses show.
      const mat = mode === "studio" ? this.studio : mode === "draft" ? this.draftMat : s.step === 4 && which === "top" ? kit.glass : kit.model
      const m = new THREE.Mesh(shell.geo, mat)
      m.userData = { kind: "face", feature: which, role: "model" }
      m.position.z = which === "top" ? s.explode : 0
      this.shells.add(m)
      // Silhouette-free outline: the rim and the extra mould lines.
      if (mode !== "studio" || s.explode > 0.01) m.add(edgeLine(shell.rim.concat(shell.rim[0]), kit, true))
      if (mode === "draft" && shell.extra.length) this.dashed(shell.extra, which === "top" ? s.explode : 0)
    }
    // The parting line on the assembled part.
    if (mode === "studio" && s.explode <= 0.01) {
      const pts = sh.top.rim.map((p) => p.clone().add(V(0, 0, 0)))
      const out = this.outward(pts, 0.05)
      this.marks.add(line(out.concat(out[0]), this.seam))
    }
    if (s.step === 1) this.pullArrows(s)
    if (s.step === 2) {
      const msg = { highlight: t("分型线切过高光带", "The parting line cuts through the highlight"), side: t("分型线在侧面上", "The parting line is on the side wall"), groove: t("分型线藏在美工线里", "The parting line hides in the groove") }[this.region(s)]
      this.marks.add(label(msg, V(PLAN.a + 6, -PLAN.b * 0.4, s.h + 10), "font-sans"))
    }
    if (s.step === 3) this.section(s)
    if (s.step === 4) this.bosses(s)
    if (s.step === 0 && s.explode > 4) {
      this.marks.add(tag(t("上壳", "Top shell"), V(-PLAN.a, -PLAN.b, H + s.explode)), tag(t("下壳", "Bottom shell"), V(-PLAN.a, -PLAN.b, 2)))
    }
    this.v.invalidate()
  }

  /** Vertex colours: ambient occlusion for the studio look, draft classes, or plain. */
  private paint(shell: Shell, mode: "studio" | "draft" | "plain") {
    const tk = this.v.tokens
    const col = shell.geo.getAttribute("color") as THREE.BufferAttribute
    const arr = col.array as Float32Array
    const c = new THREE.Color()
    shell.meta.forEach((p, i) => {
      if (mode === "studio") {
        const ao = p.tag === "groove" ? 0.3 : p.tag === "rim" ? 0.2 : 1
        arr.set([ao, ao, ao], i * 3)
        return
      }
      const d = shell.draft[i]
      if (mode === "draft" && d) c.copy(d === "good" ? tk.good : d === "low" ? tk.warn : tk.bad)
      else c.copy(tk.model).lerp(tk.modelDark, mode === "draft" ? 0.35 : 0)
      arr.set([c.r, c.g, c.b], i * 3)
    })
    col.needsUpdate = true
  }

  /** Nudge outline points outward in plan so a line drawn on the surface isn't hidden in it. */
  private outward(pts: THREE.Vector3[], by: number) {
    const base = planRing(PLAN, 0)
    return pts.map((p, i) => p.clone().add(V(base.nx[i] * by, base.ny[i] * by, 0)))
  }

  /** One entry per ring column (NaN where there is none): drawn dashed, in runs. */
  private dashed(pts: THREE.Vector3[], dz: number) {
    const base = planRing(PLAN, 0)
    let run: THREE.Vector3[] = []
    const flush = () => {
      if (run.length > 1) this.marks.add(line(run, this.v.kit.construction))
      run = []
    }
    pts.forEach((p, i) => (Number.isNaN(p.x) ? flush() : run.push(p.clone().add(V(base.nx[i] * 0.1, base.ny[i] * 0.1, dz)))))
    flush()
    const first = pts.find((p) => !Number.isNaN(p.x))
    if (first) this.marks.add(label(t("这个壳自己的分模线", "This shell's own mold parting line"), first.clone().add(V(4, -6, dz)), "border-warning text-warning font-sans"))
  }

  private pullArrows(s: SplitState) {
    const kit = this.v.kit
    const x = -PLAN.a - 14
    const arrow = (z0: number, z1: number, text: string) => {
      const dir = Math.sign(z1 - z0)
      this.marks.add(line([V(x, 0, z0), V(x, 0, z1)], kit.sketch), line([V(x - 2, 0, z1 - dir * 4), V(x, 0, z1), V(x + 2, 0, z1 - dir * 4)], kit.sketch))
      this.marks.add(label(text, V(x, 0, z1 + dir * 4), "border-primary text-primary font-sans"))
    }
    arrow(H + s.explode - 6, H + s.explode + 14, t("上壳的型腔 +Z", "Top shell cavity +Z"))
    arrow(4, -16, t("下壳的型腔 −Z", "Bottom shell cavity −Z"))
  }

  /** Section close-up at the right wall: the rim with or without the lip, and a line of sight through the gap. */
  private section(s: SplitState) {
    const kit = this.v.kit
    const y = -0.05
    const xo = PLAN.a
    const zGap = ZW + s.explode / 2
    const lipX = xo - (WALL - LIP.w)
    const end = s.lip ? lipX + 0.15 : xo - 9
    this.marks.add(line([V(xo + 4, y, zGap), V(end, y, zGap)], kit.sketch))
    this.marks.add(line([V(end + 0.7, y, zGap + 0.35), V(end, y, zGap), V(end + 0.7, y, zGap - 0.35)], kit.sketch))
    this.marks.add(
      label(
        s.lip ? t("视线被止口挡住", "The line of sight is stopped by the lip") : t("一眼看到壳里", "You can see straight inside"),
        V(xo + 2.6, y, zGap + 1.1),
        s.lip ? "border-primary text-primary font-sans" : "border-warning text-warning font-sans",
      ),
    )
    this.marks.add(tag(t("上壳", "Top shell"), V(xo - 3.5, y, ZW + 3.5 + s.explode)), tag(t("下壳", "Bottom shell"), V(xo - 3.5, y, ZW - 3)))
    if (s.lip) this.marks.add(label(t("止口", "Lip"), V(lipX - LIP.w / 2, y, ZW + LIP.h / 2), "font-sans"))
  }

  /** Screw bosses and screws, for the chosen screw side; animated by `assembly`. */
  private bosses(s: SplitState) {
    const kit = this.v.kit
    const fromBottom = s.screws !== "top"
    const top = s.explode
    const screwK = Math.max(0, (s.assembly - 0.6) / 0.4)
    for (const [x, y] of BOSSES) {
      // The receiving boss is long; the other shell has a short sleeve with the clearance hole.
      const long = (z0: number, z1: number, r: number) => {
        const g = new THREE.CylinderGeometry(r, r * 1.06, Math.abs(z1 - z0), 20)
        g.rotateX(Math.PI / 2)
        g.translate(x, y, (z0 + z1) / 2)
        return g
      }
      const zs = ZW
      const topBoss = fromBottom ? long(zs + 0.6, H - WALL, 3.2) : long(zs + 4, H - WALL, 3.2)
      const botBoss = fromBottom ? long(WALL, zs - 0.6, 3.2) : long(WALL, zs - 0.6, 3.2)
      const tb = face(topBoss, kit, { feature: "boss", role: fromBottom ? "highlight" : "model" })
      tb.position.z = top
      const bb = face(botBoss, kit, { feature: "boss", role: fromBottom ? "model" : "highlight" })
      this.shells.add(tb, bb)
      // The screw: from below through the bottom shell, or from above through the top.
      const g = new THREE.Group()
      const head = new THREE.CylinderGeometry(2.6, 2.6, 1.6, 20)
      head.rotateX(Math.PI / 2)
      const shank = new THREE.CylinderGeometry(1.2, 1.2, 14, 12)
      shank.rotateX(Math.PI / 2)
      shank.translate(0, 0, fromBottom ? 7.8 : -7.8)
      g.add(face(head, kit, { feature: "screw", role: "metal", edges: false }), face(shank, kit, { feature: "screw", role: "metal", edges: false }))
      const zEnd = fromBottom ? -0.8 : H + 0.8
      const zStart = fromBottom ? -30 : H + 30
      g.position.set(x, y, zStart + (zEnd - zStart) * screwK)
      this.shells.add(g)
    }
    const kitArrow = (z0: number, z1: number) => {
      const xA = -PLAN.a - 14
      const dir = Math.sign(z1 - z0)
      this.marks.add(line([V(xA, 0, z0), V(xA, 0, z1)], kit.sketch), line([V(xA - 2, 0, z1 - dir * 4), V(xA, 0, z1), V(xA + 2, 0, z1 - dir * 4)], kit.sketch))
    }
    kitArrow(H + 30, H + 4)
    this.marks.add(label(t("装配方向 = 开模方向", "Assembly direction = pull direction"), V(-PLAN.a - 14, 0, H + 34), "border-primary text-primary font-sans"))
    if (s.screws === "top" && s.assembly >= 1) this.marks.add(label(t("螺丝头露在外观面上", "Screw heads on the cosmetic surface"), V(BOSSES[0][0], BOSSES[0][1], H + 8), "border-warning text-warning font-sans"))
  }

  dispose() {
    this.v.kit.setSection(null)
    this.v.setProjection("perspective")
    super.dispose()
    if (this.cache) {
      this.cache.top.geo.dispose()
      this.cache.bottom.geo.dispose()
    }
    this.studio.dispose()
    this.draftMat.dispose()
    this.seam.dispose()
  }
}
