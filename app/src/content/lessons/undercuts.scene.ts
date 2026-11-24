import * as THREE from "three"
import { edges, face, label, line, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { boxGeometry, cellGeometry, cellsOf, paintCells, pullDir, release, type Box, type Cell, type Release } from "./undercuts.boxes"

/**
 * 4.4.4 「倒扣、侧抽、拾件」: a small cover (open at the bottom, like the
 * draft-analysis part) with three typical undercuts: a connector hole in a
 * side wall, a catch on the inside of a wall, and a shallow lip along the
 * inside of the opening. Undercut faces are found by line of sight against
 * the real boxes the part is made of, so turning the pull direction
 * recolours them live. Each undercut then gets a solution (slide, lifter,
 * shut-off through a window, pickout, bump-off, or a redesign) with its
 * cost in steel and in cycle time, and the mould opens to show it working.
 */
export type Feature = "hole" | "catch" | "lip"
export type Sol = "slide" | "lifter" | "shutoff" | "pickout" | "bumpoff" | "redesign"

export type UndercutState = {
  step: number
  tilt: number
  heading: number
  cutaway: boolean
  sol: Record<Feature, Sol | null>
  /** Flexible material (PE, TPE…) instead of a stiff one (PC, ABS…). */
  soft: boolean
  /** Mould animation, 0 closed … 1 part ejected. */
  open: number
  stuck: Feature | null
  /** Red (undercut, unsolved) area per feature, mm². */
  red: Record<Feature | "body", number>
  lookedTop: boolean
  lookedBottom: boolean
  triedTilt: boolean
  ran: Record<Feature, boolean>
}

export const FEATURES: Feature[] = ["hole", "catch", "lip"]
/** The step that handles each feature. */
export const STEP_OF: Record<Feature, number> = { hole: 2, catch: 3, lip: 4 }
/** Options offered per feature, best first. */
export const OPTIONS: Record<Feature, Sol[]> = {
  hole: ["slide", "redesign", "pickout", "lifter"],
  catch: ["lifter", "shutoff", "pickout", "slide"],
  lip: ["bumpoff", "redesign", "pickout", "slide"],
}
/** Extra tooling cost and cycle time, in rough levels (0 none … 3 a lot). */
export const COST: Record<Sol, { tool: number; cycle: number }> = {
  redesign: { tool: 0, cycle: 0 },
  shutoff: { tool: 1, cycle: 0 },
  bumpoff: { tool: 0, cycle: 0 },
  slide: { tool: 2, cycle: 1 },
  lifter: { tool: 2, cycle: 1 },
  pickout: { tool: 1, cycle: 3 },
}

export function works(f: Feature, s: Sol | null, soft: boolean) {
  if (!s) return false
  if (f === "hole") return s === "slide" || s === "redesign" || s === "pickout"
  if (f === "catch") return s === "lifter" || s === "shutoff" || s === "pickout"
  return s === "redesign" || s === "pickout" || (s === "bumpoff" && soft)
}

export function costOf(s: UndercutState, only?: Feature[]) {
  let tool = 0
  let cycle = 0
  for (const f of only ?? FEATURES) {
    const sol = s.sol[f]
    if (!sol || !works(f, sol, s.soft)) continue
    tool += COST[sol].tool
    cycle += COST[sol].cycle
  }
  return { tool, cycle }
}

/** Part dimensions, mm. */
export const PART = { w: 80, d: 50, h: 24, t: 2 }
const HOLE = { x0: -26, x1: -12, z0: 8, z1: 15 }
const CATCH = { x0: -6, x1: 6, y0: 21, y1: 23, z0: 2, z1: 5 }
const LIP = { x0: -38, x1: -36.8, y0: -15, y1: 15, z1: 1.8 }
const CEIL = PART.h - PART.t

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const B = (min: [number, number, number], max: [number, number, number], tag: string): Box => ({ min, max, tag })

export function partBoxes(sol: Record<Feature, Sol | null>): Box[] {
  const { w, d, h, t } = PART
  const [hw, hd] = [w / 2, d / 2]
  const out: Box[] = [
    B([hw - t, -hd, 0], [hw, hd, CEIL], "body"),
    B([-hw, -hd, 0], [-hw + t, hd, CEIL], "body"),
    B([-hw + t, hd - t, 0], [hw - t, hd, CEIL], "body"),
    // The −Y wall, built around the connector hole.
    B([-hw + t, -hd, 0], [HOLE.x0, -hd + t, CEIL], "hole"),
    B([HOLE.x1, -hd, 0], [hw - t, -hd + t, CEIL], "hole"),
    B([HOLE.x0, -hd, HOLE.z1], [HOLE.x1, -hd + t, CEIL], "hole"),
  ]
  // Redesigned: the hole becomes a notch open to the bottom edge, which both halves can form.
  if (sol.hole !== "redesign") out.push(B([HOLE.x0, -hd, 0], [HOLE.x1, -hd + t, HOLE.z0], "hole"))
  // The ceiling; with a shut-off, a window above the catch lets the cavity reach down to it.
  if (sol.catch === "shutoff") {
    out.push(
      B([-hw, -hd, CEIL], [hw, CATCH.y0, h], "ceiling"),
      B([-hw, CATCH.y0, CEIL], [CATCH.x0, hd, h], "ceiling"),
      B([CATCH.x1, CATCH.y0, CEIL], [hw, hd, h], "ceiling"),
      B([CATCH.x0, CATCH.y1, CEIL], [CATCH.x1, hd, h], "ceiling"),
    )
  } else out.push(B([-hw, -hd, CEIL], [hw, hd, h], "ceiling"))
  out.push(B([CATCH.x0, CATCH.y0, CATCH.z0], [CATCH.x1, CATCH.y1, CATCH.z1], "catch"))
  if (sol.lip !== "redesign") out.push(B([LIP.x0, LIP.y0, 0], [LIP.x1, LIP.y1, LIP.z1], "lip"))
  return out
}

/** Where each feature's callout sits. */
const CALLOUT: Record<Feature, THREE.Vector3> = {
  hole: V((HOLE.x0 + HOLE.x1) / 2, -PART.d / 2 - 2, HOLE.z1 + 4),
  catch: V(0, CATCH.y0, CATCH.z1 + 5),
  lip: V(LIP.x1, 0, LIP.z1 + 5),
}

const empty = (): Record<Feature, boolean> => ({ hole: false, catch: false, lip: false })

export class UndercutScene extends LessonScene<UndercutState> {
  private part = new THREE.Group()
  private mould = new THREE.Group()
  private marks = new THREE.Group()
  private mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  private cached: { key: string; boxes: Box[]; cells: Cell[]; geo: THREE.BufferGeometry; edges: THREE.LineSegments } | null = null
  private rel: { key: string; rel: Release[]; owner: (Feature | "body")[] } | null = null
  private gridHidden = false

  constructor(v: Viewer, emit: (s: UndercutState) => void) {
    super(v, emit, {
      step: 0,
      tilt: 0,
      heading: -90,
      cutaway: false,
      sol: { hole: null, catch: null, lip: null },
      soft: false,
      open: 0,
      stuck: null,
      red: { hole: 0, catch: 0, lip: 0, body: 0 },
      lookedTop: false,
      lookedBottom: false,
      triedTilt: false,
      ran: empty(),
    })
    v.setGrid(120, 10)
    this.root.add(this.part, this.mould, this.marks)
    this.own(
      v.onCameraChange(() => {
        const dir = v.camera.position.clone().sub(v.controls.target).normalize()
        const below = dir.z < 0
        if (below !== this.gridHidden) {
          this.gridHidden = below
          v.showGrid(!below)
        }
        if (this.state.step !== 0) return
        if (!this.state.lookedTop && dir.z > 0.97) this.set({ lookedTop: true })
        if (!this.state.lookedBottom && dir.z < -0.97) this.set({ lookedBottom: true })
      }),
    )
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("mould")
    const sol = { ...s.sol }
    // Features handled in earlier steps get a working default if the learner skipped them.
    if (step > STEP_OF.hole && !works("hole", sol.hole, s.soft)) sol.hole = "slide"
    if (step > STEP_OF.catch && !works("catch", sol.catch, s.soft)) sol.catch = "lifter"
    if (step <= 1) Object.assign(sol, { hole: null, catch: null, lip: null })
    if (step === STEP_OF.hole) Object.assign(sol, { catch: null, lip: null })
    if (step === STEP_OF.catch) sol.lip = null
    this.update({
      step,
      sol,
      tilt: step === 1 ? s.tilt : 0,
      heading: step === 1 ? s.heading : -90,
      cutaway: step >= 1 && step !== 2,
      open: 0,
      stuck: null,
    })
    const v = this.v
    if (step === 0) v.flyTo(V(150, -185, 110), V(6, 0, 10), 900)
    else if (step === 1) v.flyTo(V(115, -175, 165), V(4, 0, 6), 900)
    else if (step === 2) v.flyTo(V(40, -235, 95), V(6, -8, 8), 900)
    else if (step === 3) v.flyTo(V(55, -150, 185), V(4, 8, 2), 900)
    else if (step === 4) v.flyTo(V(125, -130, 172), V(0, 0, 4), 900)
    else v.flyTo(V(120, -180, 175), V(4, 0, 6), 900)
  }

  // ------------------------------------------------------------ actions

  look(from: "top" | "bottom") {
    this.v.setView(from, { target: V(0, 0, 12), distance: 260 })
  }

  setCutaway(cutaway: boolean) {
    this.set({ cutaway })
  }

  setPull(patch: { tilt?: number; heading?: number }) {
    const tilt = patch.tilt ?? this.state.tilt
    this.update({ ...patch, triedTilt: this.state.triedTilt || tilt >= 30 })
  }

  /** Pull along the axis of the connector hole (−Y). */
  pullAlongHole() {
    this.update({ tilt: 90, heading: -90, triedTilt: true })
  }

  setSol(f: Feature, sol: Sol) {
    this.v.tweens.cancel("mould")
    this.update({ sol: { ...this.state.sol, [f]: sol }, open: 0, stuck: null })
  }

  setSoft(soft: boolean) {
    this.v.tweens.cancel("mould")
    this.update({ soft, open: 0, stuck: null })
  }

  /** Features that count in this step: the current one and those before it. */
  active(s = this.state): Feature[] {
    if (s.step < 2) return []
    return FEATURES.filter((f) => STEP_OF[f] <= s.step)
  }

  /** Open the mould: slides out, cavity up, then the part is ejected off the core. Stops where an unsolved undercut catches. */
  toggleMould() {
    const s = this.state
    if (s.open > 0) {
      this.v.tweens.cancel("mould")
      this.set({ open: 0, stuck: null })
      return
    }
    const act = this.active()
    const failing = act.find((f) => !works(f, s.sol[f], s.soft)) ?? null
    // An unsolved hole holds the cavity; an unsolved inside feature holds the part on the core.
    const stopAt = failing === "hole" ? 0.27 : failing ? 0.62 : 1
    this.set({ stuck: null })
    this.v.tweens
      .run(failing ? 1500 * stopAt + 200 : 2600, (k) => {
        this.state.open = k * stopAt
        this.render()
      }, { tag: "mould" })
      .then(() => {
        if (this.state.step !== s.step) return
        const ran = { ...this.state.ran }
        if (!failing) for (const f of act) ran[f] = true
        this.set({ open: stopAt, stuck: failing, ran })
      })
  }

  private update(patch: Partial<UndercutState>) {
    const n = { ...this.state, ...patch }
    const c = this.analyse(n)
    this.set({ ...patch, red: c.red })
  }

  // ------------------------------------------------------------ analysis

  private model(s: UndercutState) {
    const boxes = partBoxes(s.sol)
    const key = JSON.stringify(boxes)
    if (this.cached?.key !== key) {
      if (this.cached) {
        this.cached.geo.dispose()
        this.cached.edges.geometry.dispose()
      }
      const cells = cellsOf(boxes, 3)
      const geo = cellGeometry(cells)
      geo.userData.shared = true
      const e = edges(geo, this.v.kit, 25)
      e.geometry.userData.shared = true
      this.cached = { key, boxes, cells, geo, edges: e }
    }
    return this.cached
  }

  private analyse(s: UndercutState) {
    const m = this.model(s)
    const relKey = `${m.key}|${s.tilt}|${s.heading}`
    if (this.rel?.key !== relKey) {
      const d = pullDir(s.tilt, s.heading)
      const isF = (tag: string | undefined): tag is Feature => tag === "hole" || tag === "catch" || tag === "lip"
      const rel: Release[] = []
      // An undercut belongs to its own feature, or else to the feature that traps the steel over it.
      const owner: (Feature | "body")[] = []
      for (const c of m.cells) {
        const r = release(c, d, m.boxes)
        rel.push(r.r)
        owner.push(isF(c.tag) ? c.tag : isF(r.by?.tag) ? r.by.tag : "body")
      }
      this.rel = { key: relKey, rel, owner }
    }
    const { rel, owner } = this.rel
    const red: Record<Feature | "body", number> = { hole: 0, catch: 0, lip: 0, body: 0 }
    const act = this.active(s)
    m.cells.forEach((c, i) => {
      if (rel[i] !== "under") return
      const f = owner[i]
      if (f !== "body" && act.includes(f) && works(f, s.sol[f], s.soft)) return
      red[f] += c.area
    })
    for (const k of Object.keys(red) as (Feature | "body")[]) red[k] = Math.round(red[k])
    return { ...m, rel, owner, red }
  }

  // ------------------------------------------------------------ rendering

  /** Mould phases: A slides retract (0–0.25), B cavity lifts (0.25–0.6), C ejection (0.6–1). */
  private phases(open: number) {
    const ph = (a: number, b: number) => THREE.MathUtils.clamp((open - a) / (b - a), 0, 1)
    return { a: ph(0, 0.25), b: ph(0.25, 0.6), c: ph(0.6, 1) }
  }

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.clear(this.part)
    this.clear(this.mould)
    this.clear(this.marks)

    const an = this.analyse(s)
    const act = this.active(s)
    const colours = an.cells.map((_, i) => {
      if (an.rel[i] !== "under") return tk.model
      const f = an.owner[i]
      if (f !== "body" && act.includes(f) && works(f, s.sol[f], s.soft)) return tk.highlight
      return tk.bad
    })
    paintCells(an.geo, colours)
    const ph = this.phases(s.open)
    const failing = s.stuck
    const eject = ph.c * 14

    const body = new THREE.Group()
    // Cut away: the ceiling is drawn as a ghost so the inside shows from above.
    if (s.cutaway) {
      const keep = an.cells.map((c) => c.tag !== "ceiling")
      body.add(this.subset(an, keep, colours))
      body.add(this.ceilingGhost(an.cells))
    } else {
      const mesh = new THREE.Mesh(an.geo, this.mat)
      mesh.userData = { kind: "face", feature: "part", role: "model" }
      mesh.add(an.edges.clone())
      body.add(mesh)
    }
    body.position.z = eject
    // Bump-off: the walls spring outward as the lip rides over the core, then back.
    if (s.sol.lip === "bumpoff" && act.includes("lip") && s.soft && ph.c > 0) body.scale.x = 1 + 0.035 * Math.sin(Math.min(1, ph.c * 2) * Math.PI)
    this.part.add(body)

    if (s.open > 0) this.drawMould(s, ph, act)

    // Callouts.
    if (s.step <= 1 || s.step === 5)
      for (const f of s.cutaway ? FEATURES : (["hole"] as Feature[])) {
        const name = { hole: t("侧孔", "Side hole"), catch: t("内侧卡扣", "Inside catch"), lip: t("唇边", "Lip") }[f]
        this.marks.add(tag(name, CALLOUT[f].clone()))
      }
    if (s.step >= 2 && s.step <= 4) {
      const f = FEATURES[s.step - 2]
      const name = { hole: t("侧孔", "Side hole"), catch: t("内侧卡扣", "Inside catch"), lip: t("唇边", "Lip") }[f]
      this.marks.add(tag(name, CALLOUT[f].clone().add(V(0, 0, eject))))
    }
    if (failing) {
      const msg = {
        hole: t("型腔被侧孔里的钢勾住，拔不出来", "The cavity is hooked by the steel in the side hole and won't come off"),
        catch: t("卡扣挂在型芯上，零件顶不出来", "The catch hangs on the core: the part won't eject"),
        lip: t("唇边挂在型芯上：硬料弹不开", "The lip hangs on the core: a stiff material can't flex over it"),
      }[failing]
      this.marks.add(label(msg, CALLOUT[failing].clone().add(V(0, 0, 14)), "border-warning text-warning font-sans"))
    }
    this.drawPull(s)
    this.v.invalidate()
  }

  /** The part without its ceiling, plus cut caps on the wall tops. */
  private subset(an: { cells: Cell[] }, keep: boolean[], colours: THREE.Color[]) {
    const cells = an.cells.filter((_, i) => keep[i])
    const cols = colours.filter((_, i) => keep[i])
    const g = cellGeometry(cells)
    paintCells(g, cols)
    const m = new THREE.Mesh(g, this.mat)
    m.userData = { kind: "face", feature: "part", role: "model" }
    m.add(edges(g, this.v.kit, 25))
    // Wall tops where the ceiling was lifted off: the cut.
    const caps: Cell[] = []
    for (const b of partBoxes(this.state.sol)) {
      if (b.tag === "ceiling" || b.max[2] !== CEIL) continue
      const z = CEIL
      caps.push({ p: V(0, 0, z), n: V(0, 0, 1), q: [V(b.min[0], b.min[1], z), V(b.max[0], b.min[1], z), V(b.max[0], b.max[1], z), V(b.min[0], b.max[1], z)], tag: "cut", area: 0 })
    }
    const cg = cellGeometry(caps)
    paintCells(cg, caps.map(() => this.v.tokens.cut))
    const cm = new THREE.Mesh(cg, this.mat)
    return new THREE.Group().add(m, cm)
  }

  /** The lifted-off top as a see-through ghost with its real outline (a shut-off window shows in it). */
  private ceilingGhost(cells: Cell[]) {
    const g = cellGeometry(cells.filter((c) => c.tag === "ceiling"))
    const m = face(g, this.v.kit, { feature: "ceiling", role: "ghost", edges: false })
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(g, 25), this.v.kit.edgeSoft)
    e.raycast = () => {}
    m.add(e)
    return m
  }

  private steel(b: { min: [number, number, number]; max: [number, number, number] }, role: "highlight" | "ghost" = "highlight") {
    const g = boxGeometry(b)
    const m = face(g, this.v.kit, { feature: "mould", role, edges: role === "highlight" ? 25 : false })
    if (role === "ghost") {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), this.v.kit.edgeGhost)
      e.raycast = () => {}
      m.add(e)
    }
    return m
  }

  private drawMould(s: UndercutState, ph: { a: number; b: number; c: number }, act: Feature[]) {
    const { w, d, h } = PART
    const pad = 8
    const hd = d / 2
    const eject = ph.c * 14
    // Cavity (outside) lifts; the core (inside) stays and the part is pushed off it.
    const cavity = this.steel({ min: [-w / 2 - pad, -hd - pad, 0], max: [w / 2 + pad, hd + pad, h + pad] }, "ghost")
    cavity.position.z = ph.b * 46
    const core = this.steel({ min: [-w / 2 - pad, -hd - pad, -pad], max: [w / 2 + pad, hd + pad, 0] }, "ghost")
    this.mould.add(cavity, core)
    const labels: [string, THREE.Vector3][] = []
    const on = (f: Feature, sol: Sol) => act.includes(f) && s.sol[f] === sol && works(f, sol, s.soft)

    if (on("hole", "slide")) {
      const sl = new THREE.Group()
      sl.add(this.steel({ min: [HOLE.x0, -hd, HOLE.z0], max: [HOLE.x1, -hd + PART.t, HOLE.z1] }))
      sl.add(this.steel({ min: [HOLE.x0 - 4, -hd - pad - 6, HOLE.z0 - 4], max: [HOLE.x1 + 4, -hd, HOLE.z1 + 4] }))
      sl.position.y = -ph.a * 14
      this.mould.add(sl)
      labels.push([t("滑块 · 先沿 −Y 退出", "Slide · backs out along −Y first"), V(HOLE.x0, -hd - pad - 6 - ph.a * 14, HOLE.z1 + 6)])
    }
    if (on("hole", "pickout")) {
      const ins = this.steel({ min: [HOLE.x0, -hd - 3, HOLE.z0], max: [HOLE.x1, -hd + PART.t, HOLE.z1] })
      const away = Math.max(0, ph.c - 0.6) / 0.4
      ins.position.set(0, -away * 18, eject + away * 10)
      this.mould.add(ins)
      labels.push([t("拾件 · 跟零件出来，人工取下", "Pickout · comes out with the part, removed by hand"), V(HOLE.x0, -hd - 6 - away * 18, HOLE.z1 + 6 + eject)])
    }
    if (on("catch", "lifter")) {
      // Rises with the ejection while sliding inward (−Y) along its 10° rod, clearing the catch.
      const ang = THREE.MathUtils.degToRad(10)
      const lf = new THREE.Group()
      lf.add(this.steel({ min: [CATCH.x0, 17, CATCH.z1], max: [CATCH.x1, CATCH.y1, CEIL] }))
      const rodLen = 34
      const rod = this.steel({ min: [-3, -1.5, -rodLen], max: [3, 1.5, 0] })
      rod.rotation.x = -ang
      rod.position.set(0, 18.5, CATCH.z1)
      lf.add(rod)
      lf.position.set(0, -eject * Math.tan(ang), eject)
      this.mould.add(lf)
      labels.push([t("斜顶 · 边顶出边向内移", "Lifter · rises and moves inward"), V(0, 10 - eject * Math.tan(ang), CEIL + 3 + eject)])
    }
    if (on("catch", "shutoff")) {
      const pin = this.steel({ min: [CATCH.x0, CATCH.y0, CATCH.z1], max: [CATCH.x1, CATCH.y1, h + pad] })
      pin.position.z = ph.b * 46
      this.mould.add(pin)
      labels.push([t("碰穿 · 型腔的镶件穿过顶面窗口", "Shut-off · cavity steel reaches through the window"), V(0, CATCH.y0, h + pad + 4 + ph.b * 46)])
    }
    if (on("catch", "pickout")) {
      const ins = this.steel({ min: [CATCH.x0, 17, CATCH.z1], max: [CATCH.x1, CATCH.y1, CEIL] })
      const away = Math.max(0, ph.c - 0.6) / 0.4
      ins.position.set(0, -away * 8, eject + away * 30)
      this.mould.add(ins)
      labels.push([t("拾件 · 跟零件出来，人工取下", "Pickout · comes out with the part, removed by hand"), V(0, 12, CEIL + 4 + eject + away * 30)])
    }
    if (on("lip", "pickout")) {
      const ins = this.steel({ min: [LIP.x1, LIP.y0, LIP.z1], max: [LIP.x1 + 3, LIP.y1, 8] })
      const away = Math.max(0, ph.c - 0.6) / 0.4
      ins.position.set(away * 10, 0, eject + away * 30)
      this.mould.add(ins)
      labels.push([t("拾件 · 跟零件出来，人工取下", "Pickout · comes out with the part, removed by hand"), V(LIP.x1 + 4, 0, 12 + eject + away * 30)])
    }
    if (on("lip", "bumpoff") && ph.c > 0) labels.push([t("强脱 · 壁向外弹开，唇边滑过型芯", "Bump-off · the walls flex out and the lip slides over the core"), V(LIP.x1, 0, 16 + eject)])
    for (const [text, p] of labels) this.mould.add(tag(text, p))
  }

  /** The pull direction as a double arrow beside the part. */
  private drawPull(s: UndercutState) {
    const kit = this.v.kit
    const d = pullDir(s.tilt, s.heading)
    const o = V(PART.w / 2 + 16, PART.d / 2 + 4, PART.h / 2)
    const a = o.clone().addScaledVector(d, 22)
    const b = o.clone().addScaledVector(d, -22)
    this.marks.add(line([b, a], kit.sketch))
    const side = Math.abs(d.z) > 0.9 ? V(1, 0, 0) : V(0, 0, 1)
    const wing = side.clone().cross(d).normalize().multiplyScalar(2.8)
    for (const [tip, dir] of [
      [a, d],
      [b, d.clone().negate()],
    ] as const) {
      const back = tip.clone().addScaledVector(dir, -5)
      this.marks.add(line([back.clone().add(wing), tip, back.clone().sub(wing)], kit.sketch))
    }
    this.marks.add(label(t("开模方向", "Pull direction"), a.clone().addScaledVector(d, 5), "border-primary text-primary font-sans"))
  }

  dispose() {
    this.v.showGrid(true)
    super.dispose()
    if (this.cached) {
      this.cached.geo.dispose()
      this.cached.edges.geometry.dispose()
    }
    this.mat.dispose()
  }
}
