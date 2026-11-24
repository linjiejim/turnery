import * as THREE from "three"
import { edgeLine, edges, label, tag } from "@/three/build"
import { roundedRect } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 6.5.6 「可拆解与回收」: a small speaker (120 × 50 × 64 mm), front at −Y.
 * The learner clicks parts off in an order the joints allow; a tally counts
 * removal steps, tools, fastener kinds, glued joints and inseparable mixes.
 * Redesign switches (one screw type, snaps and connectors instead of glue
 * and solder, a single-polymer housing, ISO 11469 material marks) rebuild
 * the part list, and a replay shows the new tally; at the end the parts are
 * sorted into recycling streams.
 */

export type PartId = "label" | "screws" | "rear" | "battery" | "pcb" | "driver" | "grille" | "front"
export type Tool = "pry" | "t6" | "ph00" | "ph1" | "heat" | "iron"
export type Fastener = "t6" | "ph00" | "ph1" | "snap" | "glue" | "solder" | "connector"
export type Design = { oneScrew: boolean; snaps: boolean; mono: boolean; marks: boolean }
export type Bin = "plastic" | "metal" | "electronic" | "battery" | "mixed"

export const TOOL_NAME: Record<Tool, string> = {
  pry: t("撬片", "Pry tool"),
  t6: t("梅花 T6", "Torx T6"),
  ph00: t("十字 PH00", "Phillips PH00"),
  ph1: t("十字 PH1", "Phillips PH1"),
  heat: t("热风枪", "Heat gun"),
  iron: t("烙铁", "Soldering iron"),
}
export const FASTENER_NAME: Record<Fastener, string> = {
  t6: t("梅花螺钉", "Torx screws"),
  ph00: t("小十字螺钉", "Small Phillips screws"),
  ph1: t("十字螺钉", "Phillips screws"),
  snap: t("卡扣", "Snap fits"),
  glue: t("胶", "Adhesive"),
  solder: t("焊锡", "Solder"),
  connector: t("插接件", "Connectors"),
}

export type PartSpec = {
  id: PartId
  name: string
  /** What it's made of, as an ISO 11469 mark would say it (plastics) or in words. */
  material: string
  plastic: boolean
  how: string
  tools: Tool[]
  fasteners: Fastener[]
  glued: number
  needs: PartId[]
  bin: Bin
}

export const ORIGINAL: Design = { oneScrew: false, snaps: false, mono: false, marks: false }
export const IMPROVED: Design = { oneScrew: true, snaps: true, mono: true, marks: true }

/** The parts of a design, in the order a technician would take them off. `front` is what stays. */
export function partsFor(d: Design): PartSpec[] {
  const sc = (orig: "t6" | "ph00" | "ph1"): "t6" | "ph00" | "ph1" => (d.oneScrew ? "ph1" : orig)
  const list: PartSpec[] = []
  if (!d.snaps)
    list.push({ id: "label", name: t("背面标签", "Back label"), material: "PET", plastic: false, how: t("胶粘，盖住了螺钉", "Glued on, over the screws"), tools: ["pry"], fasteners: ["glue"], glued: 1, needs: [], bin: "mixed" })
  list.push({
    id: "screws",
    name: t("后盖螺钉 ×4", "Back screws ×4"),
    material: t("钢", "Steel"),
    plastic: false,
    how: d.oneScrew ? t("十字 PH1", "Phillips PH1") : t("梅花 T6", "Torx T6"),
    tools: [sc("t6")],
    fasteners: [sc("t6")],
    glued: 0,
    needs: d.snaps ? [] : ["label"],
    bin: "metal",
  })
  list.push({
    id: "rear",
    name: t("后壳", "Rear housing"),
    material: d.mono ? "PP" : "ABS",
    plastic: true,
    how: t("螺钉拆掉后，卡扣一掰就开", "Once the screws are out, snaps release it"),
    tools: [],
    fasteners: ["snap"],
    glued: 0,
    needs: ["screws"],
    bin: d.marks ? "plastic" : "mixed",
  })
  list.push(
    d.snaps
      ? { id: "battery", name: t("电池", "Battery"), material: t("锂离子软包", "Li-ion pouch"), plastic: false, how: t("卡在支架里，拉拉环取出，插头连接", "Held in a snap bracket: pull the tab, unplug it"), tools: [], fasteners: ["snap", "connector"], glued: 0, needs: ["rear"], bin: "battery" }
      : { id: "battery", name: t("电池", "Battery"), material: t("锂离子软包", "Li-ion pouch"), plastic: false, how: t("双面胶粘死，要加热再撬", "Stuck down with adhesive: heat it, then pry"), tools: ["heat", "pry"], fasteners: ["glue"], glued: 1, needs: ["rear"], bin: "battery" },
  )
  list.push({
    id: "pcb",
    name: t("电路板", "Circuit board"),
    material: t("电路板", "PCB"),
    plastic: false,
    how: d.snaps ? t("2 颗螺钉，喇叭线用插头", "2 screws; the speaker wires plug in") : t("2 颗小螺钉，喇叭线焊在板上", "2 small screws; the speaker wires are soldered on"),
    tools: d.snaps ? [sc("ph00")] : [sc("ph00"), "iron"],
    fasteners: d.snaps ? [sc("ph00"), "connector"] : [sc("ph00"), "solder"],
    glued: 0,
    needs: ["rear"],
    bin: "electronic",
  })
  list.push({ id: "driver", name: t("喇叭", "Speaker driver"), material: t("钢、磁铁、纸盆", "Steel, magnet, paper cone"), plastic: false, how: t("4 颗十字螺钉", "4 Phillips screws"), tools: ["ph1"], fasteners: ["ph1"], glued: 0, needs: ["pcb"], bin: "electronic" })
  list.push(
    d.snaps
      ? { id: "grille", name: t("金属网罩", "Metal grille"), material: t("钢", "Steel"), plastic: false, how: t("卡扣卡在前壳上", "Snapped onto the front"), tools: [], fasteners: ["snap"], glued: 0, needs: ["driver"], bin: "metal" }
      : { id: "grille", name: t("金属网罩", "Metal grille"), material: t("钢", "Steel"), plastic: false, how: t("胶粘在前壳上，只能撬", "Glued to the front: pry it off"), tools: ["pry"], fasteners: ["glue"], glued: 1, needs: ["driver"], bin: "metal" },
  )
  list.push({
    id: "front",
    name: t("前壳", "Front housing"),
    material: d.mono ? "PP" : "PC + TPE",
    plastic: true,
    how: d.mono ? t("整件 PP，握持纹理直接做在模具上", "All PP, with the grip texture moulded in") : t("PC 上包了一圈 TPE 软胶，分不开", "TPE overmoulded on PC: they can't be separated"),
    tools: [],
    fasteners: [],
    glued: 0,
    needs: [],
    bin: d.mono && d.marks ? "plastic" : "mixed",
  })
  return list
}

export type Tally = { steps: number; tools: Tool[]; fasteners: Fastener[]; glued: number; mixed: number; marked: number; plastics: number }

/** What taking these parts off cost. `front` doesn't count as a step: it's what's left. */
export function tallyOf(d: Design, removed: PartId[]): Tally {
  const specs = partsFor(d).filter((p) => removed.includes(p.id) && p.id !== "front")
  const tools = [...new Set(specs.flatMap((p) => p.tools))]
  const fasteners = [...new Set(specs.flatMap((p) => p.fasteners))]
  const plastics = partsFor(d).filter((p) => p.plastic)
  return {
    steps: specs.length,
    tools,
    fasteners,
    glued: specs.reduce((a, p) => a + p.glued, 0),
    mixed: d.mono ? 0 : 1,
    marked: d.marks ? plastics.length : 0,
    plastics: plastics.length,
  }
}
export const fullTally = (d: Design) => tallyOf(d, partsFor(d).map((p) => p.id))
export const removable = (d: Design) => partsFor(d).filter((p) => p.id !== "front").map((p) => p.id)

export type DisState = {
  step: number
  design: Design
  removed: PartId[]
  blocked: { part: PartId; needs: PartId[] } | null
  inspected: PartId | null
  triedFront: boolean
  replays: string[]
  sortedDesign: "none" | "original" | "improved"
  sortedSeen: ("original" | "improved")[]
  playing: boolean
}

export const designKey = (d: Design) => `${+d.oneScrew}${+d.snaps}${+d.mono}${+d.marks}`

// ------------------------------------------------------------------ geometry (mm)

const BW = 120
const BH = 64
const R = 12
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** A shape in (x, z), extruded `depth` towards −Y from y = y0. */
function slab(shape: THREE.Shape, y0: number, depth: number) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 })
  g.rotateX(Math.PI / 2)
  g.translate(0, y0, 0)
  return g
}
function ring(w: number, h: number, r: number, wall: number) {
  const s = roundedRect(new THREE.Shape(), w, h, r)
  s.holes.push(roundedRect(new THREE.Path(), w - 2 * wall, h - 2 * wall, Math.max(0.5, r - wall)))
  return s
}

/**
 * Where each part goes when it comes off, in the product's own frame: out of the back (+Y). The
 * product lies face down on the bench, so that is straight up: an exploded stack.
 */
const OUTWARD: Record<PartId, THREE.Vector3> = {
  label: V(0, 150, 0),
  screws: V(0, 128, 0),
  rear: V(0, 96, 0),
  battery: V(0, 66, 0),
  pcb: V(0, 70, 0),
  driver: V(0, 44, 0),
  grille: V(0, 40, 0),
  front: V(0, 0, 0),
}
/** Recycling streams: zones on the bench behind the product. */
export const BINS: Bin[] = ["plastic", "metal", "electronic", "battery", "mixed"]
export const BIN_NAME: Record<Bin, string> = {
  plastic: t("同种塑料", "Single plastic"),
  metal: t("金属", "Metal"),
  electronic: t("电路板、喇叭", "Boards, drivers"),
  battery: t("电池", "Batteries"),
  mixed: t("混合料、认不出", "Mixed, unknown"),
}
const ZONE = 70
const binPos = (b: Bin) => V(-156 + BINS.indexOf(b) * 78, 150, 0)

const initial = (): DisState => ({
  step: 0,
  design: { ...ORIGINAL },
  removed: [],
  blocked: null,
  inspected: null,
  triedFront: false,
  replays: [],
  sortedDesign: "none",
  sortedSeen: [],
  playing: false,
})

export class DisassemblyScene extends LessonScene<DisState> {
  private parts = new THREE.Group()
  private marks = new THREE.Group()
  private bins = new THREE.Group()
  private groups = new Map<PartId, THREE.Group>()
  private homes = new Map<PartId, THREE.Vector3>()
  private offset = new Map<PartId, THREE.Vector3>()
  private built = ""
  private hover: PartId | null = null
  private pcbMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })
  private tpeMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 })
  private labelMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0 })
  private flagMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, emissiveIntensity: 0.25 })
  private binMat = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  private run = 0
  /** Parts shrink to half size as they're sorted, so the streams read. */
  private scale = 1

  constructor(v: Viewer, emit: (s: DisState) => void) {
    super(v, emit, initial())
    v.setGrid(160, 10)
    for (const m of [this.pcbMat, this.tpeMat, this.labelMat, this.flagMat, this.binMat]) this.own(() => m.dispose())
    // Face down on the bench: the product's back (+Y) points up, its front sits on the grid.
    this.parts.rotation.x = Math.PI / 2
    this.parts.position.z = 25
    this.root.add(this.parts, this.marks, this.bins)
    const el = v.renderer.domElement
    let down: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY })
    const onUp = (e: PointerEvent) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) this.clickAt(e)
      down = null
    }
    const onMove = (e: PointerEvent) => {
      if (e.buttons) return
      const id = this.pickPart(e)
      if (id !== this.hover) {
        this.hover = id
        el.style.cursor = id ? "pointer" : ""
        this.paint()
      }
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointermove", onMove)
    this.own(() => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointermove", onMove)
      el.style.cursor = ""
    })
  }

  enter(step: number) {
    this.run++
    this.v.tweens.cancel("part")
    const patch: Partial<DisState> = { step, removed: [], blocked: null, inspected: null, playing: false }
    if (step <= 1) patch.design = { ...ORIGINAL }
    if (step === 1) patch.removed = removable(ORIGINAL)
    if (step === 2) patch.design = { ...ORIGINAL }
    if (step === 3) patch.design = { ...this.state.design, oneScrew: true, snaps: true }
    if (step === 4) Object.assign(patch, { design: { ...IMPROVED }, sortedDesign: "none" })
    this.offset.clear()
    this.scale = 1
    for (const id of patch.removed ?? []) this.offset.set(id, OUTWARD[id].clone())
    this.set(patch)
    const v = this.v
    if (step === 4) v.flyTo(V(-5, -290, 560), V(-5, 105, 0), 900)
    else v.flyTo(V(320, -390, 290), V(-30, 0, 92), 900)
  }

  // ------------------------------------------------------------ actions

  private clickAt(e: PointerEvent) {
    const id = this.pickPart(e)
    if (!id) return
    this.tryRemove(id)
  }

  tryRemove(id: PartId) {
    const s = this.state
    if (s.playing || s.step === 4) return
    const spec = partsFor(s.design).find((p) => p.id === id)
    if (!spec || s.removed.includes(id)) return
    if (id === "front") {
      this.set({ inspected: "front", blocked: null, triedFront: true })
      return
    }
    const missing = spec.needs.filter((n) => !s.removed.includes(n))
    if (missing.length) {
      this.set({ blocked: { part: id, needs: missing }, inspected: id })
      return
    }
    this.set({ removed: [...s.removed, id], blocked: null, inspected: id })
    this.animateOut(id)
  }

  setDesign(patch: Partial<Design>) {
    this.run++
    this.v.tweens.cancel("part")
    this.offset.clear()
    this.scale = 1
    this.set({ design: { ...this.state.design, ...patch }, removed: [], blocked: null, inspected: null, playing: false, sortedDesign: "none" })
  }

  reassemble() {
    this.run++
    this.v.tweens.cancel("part")
    this.offset.clear()
    this.scale = 1
    this.set({ removed: [], blocked: null, inspected: null, playing: false })
  }

  /** Take the whole thing apart in order, one part every half second. */
  async replay() {
    const run = ++this.run
    this.offset.clear()
    this.scale = 1
    this.set({ removed: [], blocked: null, inspected: null, playing: true })
    for (const id of removable(this.state.design)) {
      if (run !== this.run) return
      this.set({ removed: [...this.state.removed, id], inspected: id })
      await this.animateOut(id, 420)
    }
    if (run !== this.run) return
    const key = designKey(this.state.design)
    this.set({ playing: false, replays: this.state.replays.includes(key) ? this.state.replays : [...this.state.replays, key] })
  }

  /** Step 5: take apart (instantly) and send every part, at half size, to its stream. */
  async sort(which: "original" | "improved") {
    const run = ++this.run
    const design = which === "original" ? { ...ORIGINAL } : { ...IMPROVED }
    this.offset.clear()
    this.scale = 1
    this.set({ design, removed: [], sortedDesign: "none", playing: true })
    const specs = partsFor(design)
    this.set({ removed: specs.map((p) => p.id) })
    this.parts.updateMatrixWorld(true)
    const count = new Map<Bin, number>()
    const to = new Map<PartId, THREE.Vector3>()
    for (const p of specs) {
      const j = count.get(p.bin) ?? 0
      count.set(p.bin, j + 1)
      const world = binPos(p.bin).add(V(0, 0, 10 + j * 16))
      to.set(p.id, this.parts.worldToLocal(world).sub(this.homeOf(p.id)))
    }
    await this.v.tweens.run(
      1400,
      (k) => {
        if (run !== this.run) return
        this.scale = 1 - 0.6 * k
        for (const p of specs) this.offset.set(p.id, to.get(p.id)!.clone().multiplyScalar(k).add(V(0, Math.sin(k * Math.PI) * 50, 0)))
        this.place()
      },
      { tag: "part" },
    )
    if (run !== this.run) return
    this.set({ sortedDesign: which, playing: false, sortedSeen: this.state.sortedSeen.includes(which) ? this.state.sortedSeen : [...this.state.sortedSeen, which] })
  }

  private animateOut(id: PartId, ms = 600) {
    const to = OUTWARD[id]
    const run = this.run
    return this.v.tweens.run(
      ms,
      (k) => {
        if (run !== this.run) return
        this.offset.set(id, to.clone().multiplyScalar(k))
        this.place()
      },
      { tag: `part-${id}` },
    )
  }

  // ------------------------------------------------------------ picking

  private pickPart(e: { clientX: number; clientY: number }): PartId | null {
    const hit = this.v.pick(e, [this.parts])
    let o: THREE.Object3D | null = hit?.object ?? null
    while (o && !o.userData.part) o = o.parent
    return (o?.userData.part as PartId) ?? null
  }

  // ------------------------------------------------------------ rendering

  /** A part's centre in the product's frame, where it sits when assembled (scaled about its own centre when sorted). */
  private homeOf(id: PartId) {
    const cached = this.homes.get(id)
    if (cached) return cached.clone()
    const g = this.groups.get(id)
    if (!g) return V(0, 0, 0)
    const box = new THREE.Box3()
    g.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh && m.userData.base) {
        m.geometry.computeBoundingBox()
        box.union(m.geometry.boundingBox!)
      }
    })
    const c = box.getCenter(new THREE.Vector3())
    this.homes.set(id, c)
    return c.clone()
  }

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.pcbMat.color.copy(tk.modelDark).lerp(tk.good, 0.3)
    this.tpeMat.color.copy(tk.modelDark)
    this.labelMat.color.copy(tk.paper)
    this.flagMat.color.copy(tk.bad)
    this.flagMat.emissive.copy(tk.bad)
    this.binMat.color.copy(tk.edgeSoft)
    const key = designKey(s.design)
    if (key !== this.built) {
      this.built = key
      this.build(s.design)
    }
    this.renderBins(s)
    this.place()
    this.paint()
  }

  /** Move parts to their offsets (scaled about their own centres when sorting), and the marks with them. */
  private place() {
    for (const [id, g] of this.groups) {
      const home = this.homeOf(id)
      g.scale.setScalar(this.scale)
      g.position.copy(this.offset.get(id) ?? V(0, 0, 0)).add(home.clone().multiplyScalar(1 - this.scale))
    }
    this.renderMarks()
    this.v.invalidate()
  }

  /** Hover, glued joints and inseparable mixes. */
  private paint() {
    const s = this.state
    const flagged = new Set<PartId>()
    if (s.step === 1) {
      for (const p of partsFor(s.design)) if (p.glued || p.id === "front") flagged.add(p.id)
    }
    for (const [id, g] of this.groups) {
      g.traverse((o) => {
        const m = o as THREE.Mesh
        if (!m.isMesh || !m.userData.base) return
        m.material = this.hover === id && s.step !== 4 ? this.v.kit.hovered : flagged.has(id) && m.userData.flag !== false ? this.flagMat : (m.userData.base as THREE.Material)
      })
    }
    this.v.invalidate()
  }

  private renderMarks() {
    const s = this.state
    this.clear(this.marks)
    const plain = "border-transparent bg-transparent font-sans text-muted-foreground"
    for (const p of partsFor(s.design)) {
      const g = this.groups.get(p.id)
      if (!g) continue
      const c = new THREE.Box3().setFromObject(g).getCenter(new THREE.Vector3())
      if (s.design.marks && p.plastic) {
        const text = p.id === "front" && !s.design.mono ? ">PC< >TPE<" : `>${p.material}<`
        this.marks.add(tag(text, c.clone().add(V(-48 * this.scale, -26 * this.scale, 0))))
      }
      if (s.step === 1 && (p.glued || p.id === "front") && (p.id !== "front" || !s.design.mono))
        this.marks.add(label(p.id === "front" ? t("混合材料：PC + TPE", "Mixed: PC + TPE") : t("胶接", "Glued"), c.clone().add(V(0, -40, 6)), "border-destructive text-destructive font-sans"))
    }
    if (s.step === 0 && s.removed.length === 0) this.marks.add(label(t("点零件把它拆下来", "Click a part to take it off"), V(0, 0, 95), plain))
  }

  private renderBins(s: DisState) {
    this.clear(this.bins)
    if (s.step !== 4) return
    const kit = this.v.kit
    for (const b of BINS) {
      const p = binPos(b)
      const g = new THREE.ShapeGeometry(roundedRect(new THREE.Shape(), ZONE, ZONE, 8, p.x, p.y))
      g.translate(0, 0, 0.1)
      const m = new THREE.Mesh(g, this.binMat)
      m.add(edges(g, kit, 30))
      this.bins.add(m)
      this.bins.add(label(BIN_NAME[b], V(p.x, p.y - ZONE / 2 - 6, 0), b === "mixed" ? "border-destructive text-destructive font-sans" : "font-sans"))
    }
  }

  private build(d: Design) {
    const kit = this.v.kit
    this.clear(this.parts)
    this.groups.clear()
    this.homes.clear()
    const group = (id: PartId) => {
      const g = new THREE.Group()
      g.userData.part = id
      this.groups.set(id, g)
      this.parts.add(g)
      return g
    }
    const add = (g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, flag = true) => {
      const m = new THREE.Mesh(geo, mat)
      m.userData.base = mat
      m.userData.flag = flag
      m.add(edges(geo, kit, 30))
      g.add(m)
      return m
    }
    const specs = partsFor(d)
    const has = (id: PartId) => specs.some((p) => p.id === id)

    // Front housing: face plate with the grille opening, walls back to y = 0; a TPE band unless it's all PP.
    const front = group("front")
    const plate = roundedRect(new THREE.Shape(), BW, BH, R)
    plate.holes.push(roundedRect(new THREE.Path(), 92, 46, 8))
    add(front, slab(plate, -23, 2), kit.model, false)
    add(front, slab(ring(BW, BH, R, 2), 0, 23), kit.model, false)
    if (!d.mono) add(front, slab(ring(BW + 4, BH + 4, R + 2, 2), -4, 12), this.tpeMat)
    // Grille in the opening.
    const grille = group("grille")
    add(grille, slab(roundedRect(new THREE.Shape(), 92, 46, 8), -23.2, 1), kit.metal)
    for (let i = 0; i < 9; i++)
      for (let j = 0; j < 4; j++) {
        const pts: THREE.Vector3[] = []
        for (let k = 0; k <= 12; k++) {
          const a = (k / 12) * Math.PI * 2
          pts.push(V(-36 + i * 9 + Math.cos(a) * 1.6, -24.3, -13.5 + j * 9 + Math.sin(a) * 1.6))
        }
        grille.add(edgeLine(pts, kit))
      }
    // Driver: basket, magnet.
    const driver = group("driver")
    // Cylinders run along Y already: flip the cone so its wide end faces the front.
    const cone = new THREE.CylinderGeometry(22, 10, 12, 40, 1, true)
    cone.rotateX(Math.PI)
    cone.translate(-22, -16, 0)
    add(driver, cone, kit.metal)
    const mag = new THREE.CylinderGeometry(9, 9, 7, 32)
    mag.translate(-22, -6.5, 0)
    add(driver, mag, kit.metal)
    // Circuit board, upright behind the front.
    const pcb = group("pcb")
    add(pcb, new THREE.BoxGeometry(42, 1.6, 34).translate(30, 3, 0), this.pcbMat)
    add(pcb, new THREE.BoxGeometry(8, 3, 6).translate(22, 5.2, 6), this.tpeMat, false)
    // Battery pouch.
    const battery = group("battery")
    add(battery, new THREE.BoxGeometry(52, 8, 34).translate(-26, 9, 0), kit.metal)
    // Rear housing.
    const rear = group("rear")
    add(rear, slab(roundedRect(new THREE.Shape(), BW, BH, R), 25, 2), d.mono ? kit.model : kit.modelDark)
    add(rear, slab(ring(BW, BH, R, 2), 23, 23), d.mono ? kit.model : kit.modelDark)
    // Screws on the back.
    const screws = group("screws")
    for (const [x, z] of [
      [-48, -20],
      [48, -20],
      [-48, 20],
      [48, 20],
    ]) {
      const h = new THREE.CylinderGeometry(2.8, 2.8, 1.6, 20)
      h.translate(x, 25.8, z)
      add(screws, h, kit.metal)
    }
    if (has("label")) {
      const lbl = group("label")
      add(lbl, slab(roundedRect(new THREE.Shape(), 106, 50, 6), 27, 0.6).translate(0, 0.6, 0), this.labelMat)
    }
  }
}
