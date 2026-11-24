import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { edgeLine, label, line, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { bezierPatch, boundary, diverging, isoU, isoV, paintZebra, patchSurf, surfaceMaterial, tessellate, zebraMaterial } from "./surface-from-curves.patch"

/**
 * 5.2.2 「曲面连续性与匹配」. Two Bézier patches meet along a seam at x = 0:
 * A (a large top face, the master by default) and B (a smaller face that
 * falls away). Matching B to A sets B's control rows from the seam outward:
 * row 0 for position (G0), row 1 for tangency (G1), row 2 for curvature (G2).
 * Zebra stripes check the seam; dragging a point near the seam breaks it;
 * a deviation map shows how much matching reshapes the matched face; and
 * swapping the master shows why the important face should not be the one
 * that moves.
 *
 * The matching is exact for patches that share the seam's parametrisation:
 * with seam-first rows M (master, degree n) and S (slave, degree m),
 *   S0 = M0,  S1 = S0 + λ n/m (M0 − M1),
 *   S2 = 2 S1 − S0 + λ² n(n−1)/(m(m−1)) (M0 − 2 M1 + M2) + μ (M0 − M1).
 * λ and μ keep as much of the slave's own spacing as the conditions allow.
 */
export type Level = "none" | "G0" | "G1" | "G2"
export type Master = "A" | "B"
type Net = THREE.Vector3[][]

export type SeamReport = { gap: number; angle: number; kA: number; kB: number; level: Level }

export type MatchState = {
  step: number
  level: Level
  zebra: boolean
  degree: 3 | 5
  master: Master
  broken: boolean
  report: SeamReport
  /** Rows of the slave that moved in the last match (seam row = 0). */
  moved: number[]
  /** Largest change of the slave face against its own unmatched shape, mm. */
  change: number
  seen: Level[]
  seenZebra: Level[]
  everBroken: boolean
  rematched: boolean
  triedDegree5: boolean
  triedDegree3: boolean
  triedB: boolean
  backToA: boolean
}

const YS = [-45, -15, 15, 45]

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const copyNet = (n: Net) => n.map((r) => r.map((p) => p.clone()))

function baseA(): Net {
  const z = (x: number, y: number) => 46 - 0.0016 * (x + 35) ** 2 - 0.003 * y * y
  return [-90, -60, -30, 0].map((x) => YS.map((y) => V(x, y, z(x, y))))
}

function baseB(m: 3 | 5): Net {
  const z = (x: number, y: number) => 47 + 0.05 * x - 0.0085 * x * x - 0.002 * y * y
  return Array.from({ length: m + 1 }, (_, i) => {
    const x = 2 + (68 * i) / m
    return YS.map((y) => V(x, y, z(x, y)))
  })
}

/** Match the slave's first rows to the master (both seam-first) for a continuity level. */
export function matchRows(master: Net, slaveBase: Net, level: Level): Net {
  const S = copyNet(slaveBase)
  if (level === "none") return S
  const n = master.length - 1
  const m = S.length - 1
  const [M0, M1, M2] = master
  for (let j = 0; j < 4; j++) S[0][j].copy(M0[j])
  if (level === "G0") return S
  // λ from the slave's own first-row spacing, averaged so it is one number for the whole seam.
  let lam = 0
  for (let j = 0; j < 4; j++) lam += (slaveBase[1][j].distanceTo(slaveBase[0][j]) * m) / (n * M0[j].distanceTo(M1[j]))
  lam /= 4
  for (let j = 0; j < 4; j++) S[1][j].copy(S[0][j]).addScaledVector(M0[j].clone().sub(M1[j]), (lam * n) / m)
  if (level === "G1") return S
  const kappa = (lam * lam * n * (n - 1)) / (m * (m - 1))
  const cand = (j: number) =>
    S[1][j]
      .clone()
      .multiplyScalar(2)
      .sub(S[0][j])
      .addScaledVector(M0[j].clone().addScaledVector(M1[j], -2).add(M2[j]), kappa)
  // μ: keep the slave's own spacing of row 2 along the seam's cross direction.
  let want = 0
  let got = 0
  let len = 0
  for (let j = 0; j < 4; j++) {
    const d = M0[j].clone().sub(M1[j])
    const u = d.clone().normalize()
    want += slaveBase[2][j].clone().sub(slaveBase[1][j]).dot(u)
    got += cand(j).sub(S[1][j]).dot(u)
    len += d.length()
  }
  const mu = (want - got) / len
  for (let j = 0; j < 4; j++) S[2][j].copy(cand(j)).addScaledVector(M0[j].clone().sub(M1[j]), mu)
  return S
}

/** Bernstein cubic in v. */
const b3 = (v: number) => [(1 - v) ** 3, 3 * v * (1 - v) ** 2, 3 * v * v * (1 - v), v ** 3]
const comb = (row: THREE.Vector3[], w: number[]) => row.reduce((acc, p, j) => acc.addScaledVector(p, w[j]), V(0, 0, 0))

/** Position, cross-seam derivatives and along-seam tangent of a patch at its seam edge (seam-first rows). */
function seamFrame(rows: Net, v: number) {
  const n = rows.length - 1
  const w = b3(v)
  const dw = [-3 * (1 - v) ** 2, 3 * (1 - v) ** 2 - 6 * v * (1 - v), 6 * v * (1 - v) - 3 * v * v, 3 * v * v]
  const p0 = comb(rows[0], w)
  const p1 = comb(rows[1], w)
  const p2 = comb(rows[2], w)
  // Derivatives away from the seam.
  const su = p1.clone().sub(p0).multiplyScalar(n)
  const suu = p2.clone().addScaledVector(p1, -2).add(p0).multiplyScalar(n * (n - 1))
  const sv = comb(rows[0], dw)
  return { p: p0, su, suu, sv }
}

/** How well A (rows ending at the seam) and B (rows starting at it) meet: gap, normal angle and cross-seam curvature. */
export function seamReport(a: Net, b: Net): SeamReport {
  const aRows = [...a].reverse()
  let gap = 0
  let angle = 0
  let kA = 0
  let kB = 0
  let dk = 0
  for (let k = 0; k <= 8; k++) {
    const v = k / 8
    const fa = seamFrame(aRows, v)
    const fb = seamFrame(b, v)
    gap = Math.max(gap, fa.p.distanceTo(fb.p))
    // A's su points away from the seam into A: flip it so both run in +x across the seam.
    const ta = fa.su.clone().negate()
    const na = ta.clone().cross(fa.sv).normalize()
    const nb = fb.su.clone().cross(fb.sv).normalize()
    angle = Math.max(angle, THREE.MathUtils.radToDeg(Math.acos(Math.min(1, na.dot(nb)))))
    const ka = fa.suu.dot(na) / fa.su.lengthSq()
    const kb = fb.suu.dot(nb) / fb.su.lengthSq()
    if (k === 4) {
      kA = ka
      kB = kb
    }
    dk = Math.max(dk, Math.abs(ka - kb) / Math.max(Math.abs(ka), Math.abs(kb), 1e-4))
  }
  const level: Level = gap > 0.02 ? "none" : angle > 0.1 ? "G0" : dk > 0.03 ? "G1" : "G2"
  return { gap, angle, kA, kB, level }
}

const LEVEL_ROWS: Record<Level, number> = { none: 0, G0: 1, G1: 2, G2: 3 }
type Handle = { el: CSS2DObject; patch: "A" | "B"; i: number; j: number }

export class SurfaceMatchingScene extends LessonScene<MatchState> {
  private body = new THREE.Group()
  private nets = new THREE.Group()
  private marks = new THREE.Group()
  private matA = surfaceMaterial()
  private matB = surfaceMaterial()
  private devMat = surfaceMaterial(true)
  private ghostMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide })
  private zebra = zebraMaterial(new THREE.Vector3(0.85, 0.5, 0.15))
  private a: Net = baseA()
  private b: Net = matchRows([...baseA()].reverse(), baseB(3), "none")
  private handles: Handle[] = []
  private dead = false
  /** Bumped by every new match animation (and step change), so a cancelled one can't land late. */
  private anim = 0

  constructor(v: Viewer, emit: (s: MatchState) => void) {
    const a = baseA()
    const b = baseB(3)
    super(v, emit, {
      step: 0,
      level: "none",
      zebra: false,
      degree: 3,
      master: "A",
      broken: false,
      report: seamReport(a, b),
      moved: [],
      change: 0,
      seen: [],
      seenZebra: [],
      everBroken: false,
      rematched: false,
      triedDegree5: false,
      triedDegree3: false,
      triedB: false,
      backToA: false,
    })
    v.setGrid(120, 10)
    this.root.add(this.body, this.nets, this.marks)
    // Draggable points near the seam: B's rows 1 and 2, and A's second-to-last row.
    for (const j of [1, 2]) {
      for (const i of [1, 2]) this.handles.push(this.makeHandle("B", i, j))
      this.handles.push(this.makeHandle("A", 2, j))
    }
    for (const h of this.handles) this.root.add(h.el)
  }

  enter(step: number) {
    const s = this.state
    this.anim++
    this.v.tweens.cancel("match")
    const patch: Partial<MatchState> = { step, broken: false, moved: [] }
    patch.zebra = step === 1 || step === 2
    patch.level = step === 0 ? "none" : step === 1 ? "G0" : "G2"
    patch.master = "A"
    if (step !== 3) patch.degree = 3
    if (step === 3) Object.assign(patch, { degree: s.degree, triedDegree3: s.triedDegree3 || s.degree === 3, triedDegree5: s.triedDegree5 || s.degree === 5 })
    this.a = baseA()
    this.b = this.slaveTarget(patch.level, patch.degree ?? s.degree, "A")
    this.update(patch)
    if (step === 1) this.markZebra()
    // Frame both faces (their control points bound them), from a direction that suits the step.
    const box = new THREE.Box3()
    for (const p of [...baseA(), ...baseB(3)].flat()) box.expandByPoint(p)
    // Zebra steps look closely at the seam itself.
    if (step === 1 || step === 2) box.set(V(-42, -45, 22), V(42, 45, 47))
    const dir = step === 1 || step === 2 ? V(0.3, -1, 0.75) : step === 4 ? V(-0.25, -1, 0.8) : V(0.55, -1, 0.8)
    this.v.fit(box, { dir, padding: step === 1 || step === 2 ? 1.2 : 0.9 })
  }

  // ------------------------------------------------------------ actions

  setLevel(level: Level) {
    const s = this.state
    this.animateTo(level, s.degree, s.master, { level, seen: s.seen.includes(level) ? s.seen : [...s.seen, level] })
    this.markZebra()
  }

  /** Predict reveal: from G1, step up to G2 and watch which row moves. */
  g1ToG2() {
    const s = this.state
    this.v.tweens.cancel("match")
    this.a = baseA()
    this.b = this.slaveTarget("G1", s.degree, "A")
    this.update({ level: "G1", master: "A", seen: s.seen.includes("G1") ? s.seen : [...s.seen, "G1"] })
    this.setLevel("G2")
  }

  setZebra(zebra: boolean) {
    this.set({ zebra })
    this.markZebra()
  }

  setDegree(degree: 3 | 5) {
    const s = this.state
    this.b = matchRows([...this.a].reverse(), baseB(degree), "none")
    this.a = baseA()
    this.update({ degree, moved: [], triedDegree3: s.triedDegree3 || degree === 3, triedDegree5: s.triedDegree5 || degree === 5 })
    this.animateTo(s.level, degree, s.master, {})
  }

  setMaster(master: Master) {
    const s = this.state
    // Start from both faces as they were drawn, then match the other one to the master.
    this.a = baseA()
    this.b = baseB(s.degree)
    this.update({ master, moved: [] })
    this.animateTo(s.level, s.degree, master, { triedB: s.triedB || master === "B", backToA: s.backToA || (s.triedB && master === "A") })
  }

  rematch() {
    const s = this.state
    this.animateTo(s.level, s.degree, s.master, { broken: false, rematched: s.rematched || s.everBroken })
  }

  // ------------------------------------------------------------ model

  /** The slave net for a level, the master as it stands now. */
  private slaveTarget(level: Level, degree: 3 | 5, master: Master): Net {
    if (master === "A") return matchRows([...this.a].reverse(), baseB(degree), level)
    return matchRows(this.b, [...baseA()].reverse(), level).reverse()
  }

  /** Move the slave's rows into place (the move itself is the lesson), then record what changed. */
  private animateTo(level: Level, degree: 3 | 5, master: Master, patch: Partial<MatchState>) {
    const slaveIsB = master === "A"
    const id = ++this.anim
    const from = copyNet(slaveIsB ? this.b : this.a)
    const to = this.slaveTarget(level, degree, master)
    const seamFirst = (n: Net) => (slaveIsB ? n : [...n].reverse())
    const moved = seamFirst(from)
      .map((row, i) => (row.some((p, j) => p.distanceTo(seamFirst(to)[i][j]) > 0.02) ? i : -1))
      .filter((i) => i >= 0)
    this.set({ ...patch, level, moved })
    this.v.tweens
      .run(
        700,
        (k) => {
          const cur = from.map((row, i) => row.map((p, j) => p.clone().lerp(to[i][j], k)))
          if (slaveIsB) this.b = cur
          else this.a = cur
          this.render()
        },
        { tag: "match" },
      )
      .then(() => {
        if (this.dead || id !== this.anim) return
        if (slaveIsB) this.b = to
        else this.a = to
        this.update({})
      })
  }

  private update(patch: Partial<MatchState>) {
    const next = { ...this.state, ...patch }
    const report = seamReport(this.a, this.b)
    const change = this.slaveChange(next.master, next.degree)
    this.set({ ...patch, report, change })
  }

  /** Largest distance between the slave face now and the same face unmatched. */
  private slaveChange(master: Master, degree: 3 | 5) {
    const now = patchSurf(bezierPatch(master === "A" ? this.b : this.a))
    const own = patchSurf(bezierPatch(master === "A" ? baseB(degree) : baseA()))
    let d = 0
    for (let i = 0; i <= 12; i++) for (let j = 0; j <= 6; j++) d = Math.max(d, now(i / 12, j / 6).distanceTo(own(i / 12, j / 6)))
    return d
  }

  private markZebra() {
    const s = this.state
    if (s.zebra && s.step === 1 && !s.seenZebra.includes(s.level)) this.set({ seenZebra: [...s.seenZebra, s.level] })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.body)
    this.clear(this.nets)
    this.clear(this.marks)
    this.matA.color.copy(tk.model)
    this.matB.color.copy(tk.model).lerp(tk.highlight, 0.18)
    this.ghostMat.color.copy(tk.ghost)
    paintZebra(this.zebra, tk, 10)

    const SA = patchSurf(bezierPatch(this.a))
    const SB = patchSurf(bezierPatch(this.b))
    const showChange = s.step >= 3
    const slaveIsB = s.master === "A"
    const own = patchSurf(bezierPatch(slaveIsB ? baseB(s.degree) : baseA()))
    const scale = 6
    const devColour = (u: number, v: number, p: THREE.Vector3, out: THREE.Color) => diverging(p.distanceTo(own(u, v)) / scale, tk, out)
    for (const [S, isB] of [
      [SA, false],
      [SB, true],
    ] as const) {
      const isSlave = isB === slaveIsB
      const colour = showChange && isSlave ? devColour : undefined
      const { geo } = tessellate(S, isB ? 40 : 48, 36, { colour })
      const mat = s.zebra ? this.zebra : colour ? this.devMat : isB ? this.matB : this.matA
      this.body.add(new THREE.Mesh(geo, mat))
      this.body.add(edgeLine(boundary(S), kit))
      if (!s.zebra) for (const k of [0.25, 0.5, 0.75]) this.body.add(edgeLine(isoU(S, k), kit, true), edgeLine(isoV(S, k), kit, true))
      if (showChange && isSlave) {
        // The unmatched face, as drawn, for comparison.
        this.body.add(new THREE.Mesh(tessellate(own, 24, 12).geo, this.ghostMat))
      }
    }
    this.body.add(tag("A", SA(0.15, 1).add(V(0, 10, 4))), tag("B", SB(0.85, 1).add(V(0, 10, 4))))
    this.drawNets()

    const r = s.report
    if (s.step <= 2) {
      const text = r.level === "none" ? t("没接上", "Not touching") : r.level
      const tone = r.level === "none" || r.level === "G0" ? "border-warning text-warning" : r.level === "G1" ? "border-primary text-primary" : "border-success text-success"
      this.marks.add(label(t(`接缝 · ${text}`, `Seam · ${text}`), V(0, -52, 50), `${tone} font-sans`))
    }
    this.placeHandles()
    this.v.invalidate()
  }

  private drawNets() {
    const s = this.state
    if (s.zebra && s.step === 1) return
    const kit = this.v.kit
    const slaveIsB = s.master === "A"
    const slave = slaveIsB ? this.b : [...this.a].reverse()
    const master = slaveIsB ? [...this.a].reverse() : this.b
    const active = LEVEL_ROWS[s.level]
    // Master net: quiet. Slave net: the rows the level drives are in the accent, numbered from the seam.
    for (const net of [master, slave]) {
      for (const row of net) this.nets.add(line(row, kit.construction))
      for (let j = 0; j < 4; j++) this.nets.add(line(net.map((r) => r[j]), kit.construction))
    }
    const dot = (p: THREE.Vector3, strong: boolean) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(strong ? 1.5 : 1.1, 12, 8), strong ? kit.highlight : kit.modelDark)
      m.position.copy(p)
      this.nets.add(m)
    }
    master.forEach((row) => row.forEach((p) => dot(p, false)))
    slave.forEach((row, i) => row.forEach((p) => dot(p, i < active)))
    const names = [t("第 0 排 · 位置", "Row 0 · position"), t("第 1 排 · 切线", "Row 1 · tangent"), t("第 2 排 · 曲率", "Row 2 · curvature")]
    for (let i = 0; i < 3; i++) {
      const strong = i < active
      const moved = s.moved.includes(i)
      const cls = moved ? "bg-primary text-primary-foreground" : strong ? "" : "bg-muted text-muted-foreground"
      this.nets.add(tag(names[i], slave[i][0].clone().add(V(0, -7, 3)), cls))
    }
  }

  private placeHandles() {
    const s = this.state
    for (const h of this.handles) {
      const net = h.patch === "A" ? this.a : this.b
      h.el.visible = s.step === 2
      h.el.position.copy(net[h.i][h.j])
    }
  }

  private makeHandle(patch: "A" | "B", i: number, j: number): Handle {
    const el = document.createElement("div")
    el.className = `interactive size-3.5 rounded-full border-2 ${patch === "A" ? "border-foreground" : "border-primary"} bg-background cursor-ns-resize transition-shadow hover:ring-4 hover:ring-primary/25`
    el.title = patch === "A" ? t("拖动主面 A 靠近接缝的控制点", "Drag a control point of master A near the seam") : t("上下拖动 B 的控制点", "Drag one of B's control points up or down")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.anim++
      this.v.tweens.cancel("match")
      this.v.controls.enabled = false
      const net0 = patch === "A" ? this.a : this.b
      const start = net0[i][j].clone()
      const n = this.v.camera.position.clone().sub(this.v.controls.target).setZ(0).normalize()
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(n, start)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const net = patch === "A" ? this.a : this.b
        net[i][j].z = Math.max(start.z - 18, Math.min(start.z + 18, hit.z))
        const report = seamReport(this.a, this.b)
        this.update({ broken: report.level !== this.state.level, everBroken: this.state.everBroken || report.level !== this.state.level })
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return { el: o, patch, i, j }
  }

  dispose() {
    this.dead = true
    super.dispose()
    for (const m of [this.matA, this.matB, this.devMat, this.ghostMat, this.zebra]) m.dispose()
  }
}
