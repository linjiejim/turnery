import * as THREE from "three"
import { face, label, line } from "@/three/build"
import { roundedRect, roundedRectPoints } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { breakEvens, cheapest, DEFAULTS, enabled, pairBreakEven, type Assume, type ProcId } from "./process-cost.model"
import { LessonScene } from "./scene"

/**
 * 4.0.1 「按数量选工艺」: one part, a small tray (100 × 60 × 30 mm, 2.5 mm wall, two screw bosses),
 * and how each process makes it: printed layer by layer (FDM, SLA, SLS), milled from a block (CNC),
 * cast in a silicone mould, injection moulded in a steel mould, or cut flat and bent (sheet metal, as
 * a plain tray without bosses). Picking a process replays its short build; the cost model is in
 * process-cost.model.ts.
 */
export type CostState = {
  step: number
  /** Quantity. */
  q: number
  proc: ProcId
  /** The 3D follows whichever process is cheapest at q, until the learner picks one. */
  follow: boolean
  allowSheet: boolean
  assume: Record<ProcId, Assume>
  seen: ProcId[]
  winners: ProcId[]
  edited: boolean
  atBreak: boolean
}

const TRAY = { w: 100, d: 60, h: 30, r: 6, wall: 2.5, floor: 2.5, bossR: 3.5, bossH: 20, bossX: 32 }
const SHEET_T = 1.5
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

const clone = (a: Record<ProcId, Assume>) => Object.fromEntries(Object.entries(a).map(([k, v]) => [k, { ...v }])) as Record<ProcId, Assume>

export class ProcessScene extends LessonScene<CostState> {
  private rig = new THREE.Group()
  private marks = new THREE.Group()
  /** Build progress of the current process's animation, 0 … 1. */
  private k = 1
  private tray: THREE.BufferGeometry[]
  private partMat: THREE.MeshStandardMaterial
  private clipMat: THREE.MeshStandardMaterial
  private clipPlane = new THREE.Plane(V(0, 0, -1), 0)
  private steelMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.3, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })
  private siliconeMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide })
  private powderMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, transparent: true, opacity: 0.4, depthWrite: false })

  constructor(v: Viewer, emit: (s: CostState) => void) {
    super(v, emit, {
      step: 0,
      q: 1,
      proc: "fdm",
      follow: false,
      allowSheet: false,
      assume: clone(DEFAULTS),
      seen: ["fdm"],
      winners: [],
      edited: false,
      atBreak: false,
    })
    v.setGrid(120, 10)
    this.partMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    this.clipMat = this.partMat.clone()
    this.clipMat.clippingPlanes = [this.clipPlane]
    this.clipMat.side = THREE.DoubleSide
    this.tray = trayGeometry()
    this.root.add(this.rig, this.marks)
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<CostState> = { step }
    if (step === 0) Object.assign(patch, { follow: false, q: 1 })
    if (step === 1) Object.assign(patch, { follow: true, q: 1, assume: clone(DEFAULTS), allowSheet: false })
    if (step === 2) Object.assign(patch, { follow: true, q: 60, assume: clone(DEFAULTS), allowSheet: false })
    if (step === 3) Object.assign(patch, { follow: false, proc: "injection", q: 300, assume: clone(DEFAULTS), allowSheet: false })
    if (step === 4) Object.assign(patch, { follow: false, proc: "urethane", q: 200, allowSheet: false })
    const next = { ...s, ...patch }
    if (next.follow) patch.proc = cheapest(next.assume, next.q, enabled(next.allowSheet))
    this.set(patch)
    this.replay()
    this.frame(900)
  }

  // ------------------------------------------------------------ actions

  pick(proc: ProcId) {
    const s = this.state
    if (proc === "sheet" && !s.allowSheet && s.step !== 0) return
    this.set({ proc, follow: false, seen: s.seen.includes(proc) ? s.seen : [...s.seen, proc] })
    this.replay()
    this.frame(700)
  }

  setQ(q: number) {
    const s = this.state
    const ids = enabled(s.allowSheet)
    const win = cheapest(s.assume, q, ids)
    const be = pairBreakEven(s.assume.urethane, s.assume.injection)
    const patch: Partial<CostState> = {
      q,
      winners: s.winners.includes(win) ? s.winners : [...s.winners, win],
      atBreak: s.atBreak || (s.step === 2 && be !== null && Math.abs(Math.log(q / be)) <= Math.log(1.12)),
    }
    if (s.follow && win !== s.proc) {
      patch.proc = win
      patch.seen = s.seen.includes(win) ? s.seen : [...s.seen, win]
    }
    this.set(patch)
    if (patch.proc) {
      this.replay()
      this.frame(600)
    }
  }

  setAssume(id: ProcId, patch: Partial<Assume>) {
    const s = this.state
    this.set({ assume: { ...s.assume, [id]: { ...s.assume[id], ...patch } }, edited: true })
  }

  resetAssume() {
    this.set({ assume: clone(DEFAULTS) })
  }

  setAllowSheet(allowSheet: boolean) {
    this.set({ allowSheet })
    if (allowSheet) this.pick("sheet")
  }

  /** Break-even quantities on the current assumptions. */
  breaks() {
    const s = this.state
    return breakEvens(s.assume, enabled(s.allowSheet))
  }

  private replay() {
    // Sheet metal lingers on the flat blank before it folds.
    this.v.tweens.run(this.state.proc === "sheet" ? 2600 : 1500, (k) => {
      // The frame clock can run a hair behind the tween's start: keep k inside 0 … 1.
      this.k = Math.max(0, Math.min(1, k))
      this.render()
    }, { tag: "build", ease: (x) => x })
  }

  private frame(ms: number) {
    const box = new THREE.Box3(V(-80, -55, -25), V(80, 55, 80))
    this.v.fit(box, { dir: V(0.75, -1.05, 0.8), padding: 0.92, animate: ms > 0 })
  }

  // ------------------------------------------------------------ build

  protected render() {
    const s = this.state
    const v = this.v
    const tk = v.tokens
    this.partMat.color.copy(tk.model)
    this.clipMat.color.copy(tk.model)
    this.steelMat.color.copy(tk.metal)
    this.siliconeMat.color.copy(tk.good)
    this.powderMat.color.copy(tk.model).lerp(tk.modelDark, 0.25)
    this.clear(this.rig)
    this.clear(this.marks)
    const k = this.k
    switch (s.proc) {
      case "fdm":
        this.fdm(k)
        break
      case "sla":
        this.sla(k)
        break
      case "sls":
        this.sls(k)
        break
      case "cnc":
        this.cnc(k)
        break
      case "urethane":
        this.casting(k)
        break
      case "injection":
        this.moulding(k)
        break
      case "sheet":
        this.sheet(k)
        break
    }
    v.invalidate()
  }

  /** The tray, as meshes sharing the cached geometry. */
  private part(mat: THREE.Material, edges = true) {
    const g = new THREE.Group()
    for (const geo of this.tray) {
      const m = face(geo, this.v.kit, { feature: "part", edges: edges ? 30 : false })
      m.material = mat
      g.add(m)
    }
    return g
  }

  private box(w: number, d: number, h: number, at: THREE.Vector3, role: "modelDark" | "metal" | "model" = "modelDark") {
    const g = new THREE.BoxGeometry(w, d, h)
    g.translate(at.x, at.y, at.z)
    return face(g, this.v.kit, { role, edges: 30 })
  }

  private ghost(w: number, d: number, h: number, at: THREE.Vector3, mat: THREE.Material) {
    const g = new THREE.BoxGeometry(w, d, h)
    g.translate(at.x, at.y, at.z)
    const m = new THREE.Mesh(g, mat)
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), this.v.kit.edgeGhost)
    e.raycast = () => {}
    m.add(e)
    return m
  }

  /** Layer lines every `step` mm up to height `top` (drawn coarser than real layers). */
  private layers(top: number, step: number, flip = false, base = 0) {
    const pts: number[] = []
    const ringAt = (w: number, d: number, r: number, z: number) => {
      const ring = roundedRectPoints(w, d, r, 0, 6)
      for (let i = 0; i < ring.length - 1; i++) pts.push(ring[i].x, ring[i].y, z, ring[i + 1].x, ring[i + 1].y, z)
    }
    for (let z = step; z <= Math.min(top, TRAY.h) + 1e-6; z += step) {
      const wz = flip ? base - z : base + z
      ringAt(TRAY.w + 0.1, TRAY.d + 0.1, TRAY.r, wz)
      if (z > TRAY.floor) ringAt(TRAY.w - 2 * TRAY.wall - 0.1, TRAY.d - 2 * TRAY.wall - 0.1, TRAY.r - TRAY.wall, wz)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3))
    const l = new THREE.LineSegments(g, this.v.kit.edgeSoft)
    l.raycast = () => {}
    return l
  }

  private caption(text: string, at: THREE.Vector3, cls = "") {
    this.marks.add(label(text, at, `font-sans ${cls}`))
  }

  // ---- additive

  private fdm(k: number) {
    const h = TRAY.h * k
    this.rig.add(this.box(150, 110, 4, V(0, 0, -2)))
    this.clipPlane.set(V(0, 0, -1), h)
    this.rig.add(this.part(this.clipMat, k >= 0.999))
    this.rig.add(this.layers(h, 1.5))
    // The nozzle runs round the outline of the current layer.
    const ring = roundedRectPoints(TRAY.w, TRAY.d, TRAY.r, 0, 6)
    const p = k >= 0.999 ? V(0, 0, h + 30) : ring[Math.floor(((k * 9) % 1) * (ring.length - 1))].clone().setZ(h)
    const tip = new THREE.ConeGeometry(2.2, 6, 20)
    tip.rotateX(-Math.PI / 2)
    tip.translate(p.x, p.y, p.z + 3.2)
    const block = new THREE.BoxGeometry(12, 12, 10)
    block.translate(p.x, p.y, p.z + 11)
    this.rig.add(face(tip, this.v.kit, { role: "metal", edges: false }), face(block, this.v.kit, { role: "modelDark", edges: 30 }))
    this.caption(t("层线画得比真实的粗：真实层厚约 0.1–0.3 mm", "Layer lines drawn coarser than real ones (about 0.1–0.3 mm)"), V(0, -60, 0))
  }

  private sla(k: number) {
    const plate = 58
    const bottom = plate - 6
    this.rig.add(this.box(120, 80, 4, V(0, 0, plate + 2), "metal"))
    for (const [x, y] of [
      [-36, -18],
      [0, -18],
      [36, -18],
      [-36, 18],
      [0, 18],
      [36, 18],
    ]) {
      const rod = new THREE.CylinderGeometry(0.7, 0.7, 6, 8)
      rod.rotateX(Math.PI / 2)
      rod.translate(x, y, plate - 3)
      this.rig.add(face(rod, this.v.kit, { role: "model", edges: false }))
    }
    // Upside down: the floor hangs from the supports, the part grows downwards towards the vat.
    const h = TRAY.h * k
    const part = this.part(this.clipMat, k >= 0.999)
    part.rotation.x = Math.PI
    part.position.z = bottom
    this.clipPlane.set(V(0, 0, 1), -(bottom - h))
    this.rig.add(part, this.layers(h, 1.5, true, bottom))
    this.rig.add(this.ghost(130, 90, 20, V(0, 0, 2), this.v.kit.glass))
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), this.v.kit.highlight)
    spot.position.set(-20 + 40 * ((k * 5) % 1), 0, 12)
    this.rig.add(spot)
    this.caption(t("树脂槽", "Resin vat"), V(65, -45, 2))
    this.caption(t("构建平台", "Build platform"), V(60, -40, plate + 4))
  }

  private sls(k: number) {
    const z0 = 22
    const h = z0 + TRAY.h * k
    this.clipPlane.set(V(0, 0, -1), h)
    const part = this.part(this.clipMat, k >= 0.999)
    part.position.z = z0
    this.rig.add(part)
    const lyr = this.layers(h - z0, 1.5)
    lyr.position.z = z0
    this.rig.add(lyr)
    // Other parts nested lower in the same build, already sintered.
    for (const x of [-27, 27]) {
      const g = this.part(this.partMat, false)
      g.scale.setScalar(0.5)
      g.position.set(x, 0, 4)
      this.rig.add(g)
    }
    this.rig.add(this.ghost(150, 100, h, V(0, 0, h / 2), this.powderMat))
    this.rig.add(this.box(160, 110, 4, V(0, 0, -2)))
    const spot = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8), this.v.kit.highlight)
    spot.position.set(-30 + 60 * ((k * 4) % 1), 10, h + 0.6)
    this.rig.add(spot)
    this.caption(t("粉末托着零件：不用支撑，一炉能叠放很多件", "The powder holds the parts: no supports, and many parts nest in one build"), V(0, -62, 0))
  }

  // ---- subtractive

  private cnc(k: number) {
    this.rig.add(this.box(170, 100, 8, V(0, 0, -6)))
    this.rig.add(this.ghost(TRAY.w + 6, TRAY.d + 6, TRAY.h + 4, V(0, 0, (TRAY.h + 4) / 2 - 2), this.v.kit.ghost))
    this.rig.add(this.part(this.partMat))
    // Tool path: a rectangular spiral inside the pocket at two depths, then a finishing pass round the outside.
    const path: THREE.Vector3[] = []
    for (const z of [TRAY.h - 6, TRAY.floor + 1]) {
      for (let off = 3 + TRAY.wall; off < TRAY.d / 2 - 2; off += 5) {
        const w = TRAY.w / 2 - off
        const d = TRAY.d / 2 - off
        path.push(V(-w, -d, z), V(w, -d, z), V(w, d, z), V(-w, d, z), V(-w, -d, z))
      }
    }
    const out = roundedRectPoints(TRAY.w + 6, TRAY.d + 6, TRAY.r + 3, 12, 6)
    path.push(...out)
    this.marks.add(line(path, this.v.kit.path))
    const at = path[Math.min(path.length - 1, Math.floor(k * (path.length - 1)))]
    const cutter = new THREE.CylinderGeometry(3, 3, 22, 20)
    cutter.rotateX(Math.PI / 2)
    cutter.translate(at.x, at.y, at.z + 11)
    const holder = new THREE.CylinderGeometry(8, 8, 18, 24)
    holder.rotateX(Math.PI / 2)
    holder.translate(at.x, at.y, at.z + 31)
    this.rig.add(face(cutter, this.v.kit, { role: "metal", edges: false }), face(holder, this.v.kit, { role: "modelDark", edges: false }))
    this.caption(t("虚线是刀路；内角留下刀具半径", "The dashed line is the tool path; inside corners keep the cutter's radius"), V(0, -60, 0))
  }

  // ---- moulding and casting

  private casting(k: number) {
    const open = Math.max(0, (k - 0.35) / 0.65) * 34
    this.rig.add(this.part(this.partMat))
    this.rig.add(this.ghost(130, 90, 24, V(0, 0, 8), this.siliconeMat))
    const top = this.ghost(130, 90, 26, V(0, 0, 33 + open), this.siliconeMat)
    this.rig.add(top)
    const cup = new THREE.CylinderGeometry(9, 3, 12, 24)
    cup.rotateX(Math.PI / 2)
    cup.translate(-40, 0, 52 + open)
    this.rig.add(face(cup, this.v.kit, { role: "modelDark", edges: false }))
    this.rig.add(this.box(150, 110, 4, V(0, 0, -6)))
    this.caption(t("硅胶模：约浇 20 件就要换新的", "Silicone mould: replaced after about 20 castings"), V(0, -58, 0))
  }

  private moulding(k: number) {
    const open = Math.min(1, k / 0.6) * 30
    const eject = Math.max(0, (k - 0.7) / 0.3) * 6
    // Cavity (fixed half) below forms the outside; the core (moving half) above carries the inside, and the part on it.
    this.rig.add(this.ghost(150, 110, 36, V(0, 0, 12), this.steelMat))
    const core = new THREE.Group()
    core.add(this.ghost(150, 110, 30, V(0, 0, 45), this.steelMat))
    const plug = new THREE.ExtrudeGeometry(roundedRect(new THREE.Shape(), TRAY.w - 2 * TRAY.wall, TRAY.d - 2 * TRAY.wall, TRAY.r - TRAY.wall), { depth: TRAY.h - TRAY.floor, bevelEnabled: false })
    plug.translate(0, 0, TRAY.floor)
    const pm = new THREE.Mesh(plug, this.steelMat)
    core.add(pm)
    for (const x of [-20, 20]) {
      const pin = new THREE.CylinderGeometry(1.5, 1.5, 30, 12)
      pin.rotateX(Math.PI / 2)
      pin.translate(x, 0, TRAY.floor + 15 - eject)
      core.add(face(pin, this.v.kit, { role: "metal", edges: false }))
    }
    core.position.z = open
    const part = this.part(this.partMat)
    part.position.z = open - eject
    this.rig.add(core, part)
    const nozzle = new THREE.ConeGeometry(5, 14, 24)
    nozzle.rotateX(Math.PI / 2)
    nozzle.translate(0, 0, -13)
    this.rig.add(face(nozzle, this.v.kit, { role: "metal", edges: false }))
    this.caption(t("定模（型腔）", "Fixed half (cavity)"), V(80, -55, 0))
    this.caption(t("动模（型芯）+ 顶针", "Moving half (core) + ejector pins"), V(80, -55, 50 + open))
  }

  // ---- forming

  private sheet(k: number) {
    const fold = (Math.PI / 2) * Math.max(0, Math.min(1, (k - 0.3) / 0.7))
    const T = SHEET_T
    const W = TRAY.w
    const D = TRAY.d
    const H = TRAY.h
    const kit = this.v.kit
    const base = new THREE.BoxGeometry(W, D, T)
    base.translate(0, 0, T / 2)
    this.rig.add(face(base, kit, { role: "metal", edges: 30 }))
    // Each flange hinges about its edge of the base.
    const flange = (len: number, hinge: THREE.Vector3, axis: THREE.Vector3, out: THREE.Vector3) => {
      const g = new THREE.BoxGeometry(Math.abs(out.x) > 0 ? H : len, Math.abs(out.y) > 0 ? H : len, T)
      g.translate(out.x * (H / 2), out.y * (H / 2), T / 2)
      const m = face(g, kit, { role: "metal", edges: 30 })
      const pivot = new THREE.Group()
      pivot.position.copy(hinge)
      pivot.add(m)
      pivot.quaternion.setFromAxisAngle(axis, fold)
      this.rig.add(pivot)
    }
    flange(D, V(W / 2, 0, 0), V(0, -1, 0), V(1, 0, 0))
    flange(D, V(-W / 2, 0, 0), V(0, 1, 0), V(-1, 0, 0))
    flange(W, V(0, D / 2, 0), V(1, 0, 0), V(0, 1, 0))
    flange(W, V(0, -D / 2, 0), V(-1, 0, 0), V(0, -1, 0))
    // Bend lines on the flat blank.
    for (const [a, b] of [
      [V(W / 2, -D / 2, T + 0.05), V(W / 2, D / 2, T + 0.05)],
      [V(-W / 2, -D / 2, T + 0.05), V(-W / 2, D / 2, T + 0.05)],
      [V(-W / 2, D / 2, T + 0.05), V(W / 2, D / 2, T + 0.05)],
      [V(-W / 2, -D / 2, T + 0.05), V(W / 2, -D / 2, T + 0.05)],
    ])
      this.marks.add(line([a, b], kit.construction))
    this.caption(fold < 0.05 ? t("展开图：激光切出的平板，虚线是折弯线", "Flat pattern: the laser-cut blank, dashed lines are bend lines") : t("折成托盘：等壁厚，没有螺丝柱，改用压铆螺母柱", "Bent into a tray: one thickness, no bosses (use press-in standoffs)"), V(0, -D / 2 - 40, 0))
  }

  dispose() {
    super.dispose()
    for (const g of this.tray) g.dispose()
    for (const m of [this.partMat, this.clipMat, this.steelMat, this.siliconeMat, this.powderMat]) m.dispose()
  }
}

/** The tray: walls, floor and two screw bosses, open at the top, floor on z = 0. Shared between rebuilds. */
function trayGeometry() {
  const outer = roundedRect(new THREE.Shape(), TRAY.w, TRAY.d, TRAY.r)
  outer.holes.push(roundedRect(new THREE.Path(), TRAY.w - 2 * TRAY.wall, TRAY.d - 2 * TRAY.wall, TRAY.r - TRAY.wall))
  const walls = new THREE.ExtrudeGeometry(outer, { depth: TRAY.h, bevelEnabled: false, curveSegments: 8 })
  const floor = new THREE.ExtrudeGeometry(roundedRect(new THREE.Shape(), TRAY.w - 0.02, TRAY.d - 0.02, TRAY.r), { depth: TRAY.floor, bevelEnabled: false, curveSegments: 8 })
  const out: THREE.BufferGeometry[] = [walls, floor]
  for (const x of [-TRAY.bossX, TRAY.bossX]) {
    const b = new THREE.CylinderGeometry(TRAY.bossR, TRAY.bossR, TRAY.bossH, 24)
    b.rotateX(Math.PI / 2)
    b.translate(x, 0, TRAY.bossH / 2)
    out.push(b)
  }
  for (const g of out) g.userData.shared = true
  return out
}
