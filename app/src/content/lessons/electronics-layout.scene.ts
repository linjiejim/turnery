import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { edges, face, label, line, linearDim } from "@/three/build"
import { roundedRect } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 6.5.5 「电子件布局与开孔公差」: a small device (80 × 44 mm tub, clear lid)
 * with a PCB on four bosses, a pouch cell underneath, a radio module whose
 * PCB antenna sits at the −X end, a button, an LED under a light pipe, and a
 * USB-C receptacle at the +X end facing an opening in the wall.
 *
 * USB-C numbers: USB-IF "USB Type-C Connectors and Cable Assemblies
 * Compliance Document" Rev 1.2, Appendix B: plug overmold ≤ 12.35 × 6.5 mm,
 * plug (shell) 8.25 ± 0.03 × 2.40 ± 0.03 mm, plug length 6.65 ± 0.10 mm.
 * Antenna: Espressif hardware design guidelines, ≥ 15 mm clearance from
 * metal around a module's PCB antenna. Pouch swell: about 8–10 % of the
 * thickness over some 500 cycles is the commonly quoted figure.
 * The tolerance contributions are illustrative defaults.
 */

export const OVERMOLD = { w: 12.35, h: 6.5 }
export const PLUG = { w: 8.25, h: 2.4, len: 6.65 }
export const KEEP_OUT = 15
export const SWELL = 0.1

/** Tolerance contributions (± mm) to where the receptacle sits relative to the opening. */
export type TolKey = "pcbHole" | "placement" | "housing" | "boss"
export const TOL_DEFAULTS: Record<TolKey, number> = { pcbHole: 0.15, placement: 0.1, housing: 0.1, boss: 0.15 }
/** Which contributions act sideways (y) and which up–down (z). */
export const TOL_AXES: Record<TolKey, { y: boolean; z: boolean }> = {
  pcbHole: { y: true, z: false },
  placement: { y: true, z: true },
  housing: { y: true, z: true },
  boss: { y: false, z: true },
}
export type Stack = { y: number; z: number }
export function worstCase(tol: Record<TolKey, number>): Stack {
  const keys = Object.keys(tol) as TolKey[]
  return {
    y: keys.reduce((a, k) => a + (TOL_AXES[k].y ? tol[k] : 0), 0),
    z: keys.reduce((a, k) => a + (TOL_AXES[k].z ? tol[k] : 0), 0),
  }
}
export function rss(tol: Record<TolKey, number>): Stack {
  const keys = Object.keys(tol) as TolKey[]
  return {
    y: Math.sqrt(keys.reduce((a, k) => a + (TOL_AXES[k].y ? tol[k] ** 2 : 0), 0)),
    z: Math.sqrt(keys.reduce((a, k) => a + (TOL_AXES[k].z ? tol[k] ** 2 : 0), 0)),
  }
}
/** Does the overmold, displaced by (dy, dz), pass through the opening? */
export const fits = (ow: number, oh: number, dy: number, dz: number) => OVERMOLD.w / 2 + Math.abs(dy) <= ow / 2 + 1e-9 && OVERMOLD.h / 2 + Math.abs(dz) <= oh / 2 + 1e-9

// ------------------------------------------------------------------ layout (mm)

const OUT = { x: 40, y: 22 }
const WALL = 1.6
const IN = { x: OUT.x - WALL, y: OUT.y - WALL }
const TUB_H = 16
const FLOOR = 1.6
export const PCB = { x0: -37, x1: 37, y: 19, z: 8, t: 1 }
export const BOSSES: [number, number][] = [
  [-12, -16],
  [-12, 16],
  [32, -16],
  [32, 16],
]
/** The antenna end of the module; the keep-out reaches 15 mm from it. */
const ANT = { x0: -37, x1: -31, y: 9 }
export const KEEP_X = ANT.x1 + KEEP_OUT
export const BATT = { lx: 32, ly: 24 }
export const BAY = PCB.z - FLOOR
const REC = { w: 8.94, h: 3.26, len: 7.35, front: 37.9 }
const REC_Z = PCB.z + PCB.t + REC.h / 2
/** Fully plugged in, the overmold's face stops about this far in front of the receptacle (illustrative). */
const SEAT = 0.3
const PLUG_HOME = REC.front + SEAT
const PLUG_OUT = 54
const START = { x: 14, y: -30, z: 30 }
/** How much larger the lift of a board pushed up by a swollen cell is drawn. */
const LIFT_EXAG = 10

export type ElecState = {
  step: number
  pcb: { x: number; y: number; z: number }
  placed: boolean
  batt: { x: number; y: number }
  battMoved: boolean
  /** Nominal cell thickness, and how much of the 10 % swell has happened (0 … 1). */
  cellT: number
  aged: number
  agedOnce: boolean
  open: { w: number; h: number }
  tol: Record<TolKey, number>
  /** Overmold face position along x (where the plug is), and the receptacle offset of this unit. */
  plugX: number
  off: { y: number; z: number }
  tried: "none" | "fit" | "stuck"
  fitNominal: boolean
  worstOk: boolean
  samples: number
  fails: number
}

export const battOk = (b: { x: number; y: number }) => b.x - BATT.lx / 2 >= KEEP_X - 1e-9
export const swollen = (s: Pick<ElecState, "cellT" | "aged">) => s.cellT * (1 + SWELL * s.aged)

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
/** A shape drawn in (y, z) and extruded along its own z: turn it so the extrusion runs along +X. */
function alongX(g: THREE.BufferGeometry) {
  for (const name of ["position", "normal"]) {
    const a = g.getAttribute(name)
    if (!a) continue
    for (let i = 0; i < a.count; i++) a.setXYZ(i, a.getZ(i), a.getX(i), a.getY(i))
  }
  return g
}

function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0)
  g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
  return g
}

const initial = (): ElecState => ({
  step: 0,
  pcb: { ...START },
  placed: false,
  batt: { x: -19, y: 0 },
  battMoved: false,
  cellT: 5,
  aged: 0,
  agedOnce: false,
  open: { w: 9, h: 3.2 },
  tol: { ...TOL_DEFAULTS },
  plugX: PLUG_OUT,
  off: { y: 0, z: 0 },
  tried: "none",
  fitNominal: false,
  worstOk: false,
  samples: 0,
  fails: 0,
})

export class ElectronicsLayoutScene extends LessonScene<ElecState> {
  private tub = new THREE.Group()
  private board = new THREE.Group()
  private cell = new THREE.Group()
  private plug = new THREE.Group()
  private notes = new THREE.Group()
  private dropping = false
  private pcbHandle: CSS2DObject
  private battHandle: CSS2DObject
  private pcbMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })
  private pcbClear = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, transparent: true, opacity: 0.35, depthWrite: false })
  private cellMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55 })
  private zoneMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide })
  private rubberMat = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
  private faceMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0 })

  constructor(v: Viewer, emit: (s: ElecState) => void) {
    super(v, emit, initial())
    v.setGrid(100, 10)
    for (const m of [this.pcbMat, this.pcbClear, this.cellMat, this.zoneMat, this.rubberMat, this.faceMat]) this.own(() => m.dispose())
    this.pcbHandle = this.makeHandle(t("拖动电路板，让孔对准螺柱", "Drag the board until its holes line up with the bosses"), (p) => this.dragPcb(p), () => this.state.pcb.z)
    this.battHandle = this.makeHandle(t("拖动电池", "Drag the battery"), (p) => this.dragBatt(p), () => FLOOR + this.state.cellT)
    this.root.add(this.tub, this.board, this.cell, this.plug, this.notes, this.pcbHandle, this.battHandle)
  }

  enter(step: number) {
    for (const tag of ["drop", "age", "plug"]) this.v.tweens.cancel(tag)
    this.dropping = false
    const patch: Partial<ElecState> = { step, plugX: PLUG_OUT, tried: "none", off: { y: 0, z: 0 }, aged: 0 }
    if (step === 0) Object.assign(patch, { pcb: { ...START }, placed: false })
    else Object.assign(patch, { pcb: { x: 0, y: 0, z: PCB.z }, placed: true })
    if (step === 1) Object.assign(patch, { batt: { x: -19, y: 0 } })
    if (step >= 2 && !battOk(this.state.batt)) patch.batt = { x: 8, y: 0 }
    if (step === 2) patch.cellT = 5.9
    if (step === 3) patch.open = { w: 9, h: 3.2 }
    if (step === 4) Object.assign(patch, { open: { w: 12.6, h: 6.8 }, tol: { ...TOL_DEFAULTS }, samples: 0, fails: 0 })
    this.set(patch)
    const v = this.v
    if (step === 0) v.flyTo(V(70, -150, 120), V(-6, -6, 10), 900)
    else if (step === 1) v.setView("top", { target: V(-6, -2, 0), distance: 180 })
    else if (step === 2) v.setView("front", { target: V(-4, 0, 10), distance: 185 })
    else v.flyTo(V(104, -92, 46), V(42, -4, 9), 900)
  }

  // ------------------------------------------------------------ actions

  private dragPcb(p: THREE.Vector3) {
    if (this.state.placed || this.dropping) return
    const x = Math.round(p.x * 2) / 2
    const y = Math.round(p.y * 2) / 2
    if (Math.abs(x) < 2 && Math.abs(y) < 2) {
      // Close enough: it drops onto the bosses.
      this.dropPcb()
      return
    }
    this.set({ pcb: { x, y, z: this.state.pcb.z } })
  }

  /** The 「装上去」 shortcut: fly the board onto its bosses. */
  dropPcb() {
    if (this.state.placed || this.dropping) return
    this.dropping = true
    const from = { ...this.state.pcb }
    this.v.tweens
      .run(900, (k) => this.set({ pcb: { x: from.x * (1 - k), y: from.y * (1 - k), z: from.z + (PCB.z - from.z) * k } }), { tag: "drop" })
      .then(() => {
        this.dropping = false
        if (this.state.step === 0) this.set({ placed: true, pcb: { x: 0, y: 0, z: PCB.z } })
      })
  }

  private dragBatt(p: THREE.Vector3) {
    const x = Math.max(-IN.x + BATT.lx / 2 + 0.5, Math.min(IN.x - BATT.lx / 2 - 0.5, Math.round(p.x * 2) / 2))
    const y = Math.max(-IN.y + BATT.ly / 2 + 0.5, Math.min(IN.y - BATT.ly / 2 - 0.5, Math.round(p.y * 2) / 2))
    this.set({ batt: { x, y }, battMoved: true })
  }

  setCellT(cellT: number) {
    this.set({ cellT })
  }

  /** Two years on: the pouch swells by 10 %, or back to new. */
  age(to = this.state.aged > 0.5 ? 0 : 1) {
    const from = this.state.aged
    this.v.tweens.run(1100, (k) => this.set({ aged: from + (to - from) * k }), { tag: "age" }).then(() => {
      if (to === 1) this.set({ agedOnce: true })
    })
  }

  setOpen(patch: Partial<{ w: number; h: number }>) {
    this.v.tweens.cancel("plug")
    this.set({ open: { ...this.state.open, ...patch }, plugX: PLUG_OUT, tried: "none" })
  }

  setTol(key: TolKey, v: number) {
    this.v.tweens.cancel("plug")
    this.set({ tol: { ...this.state.tol, [key]: v }, plugX: PLUG_OUT, tried: "none" })
  }

  /** Plug in a unit whose receptacle sits (dy, dz) off the opening's centre. */
  insert(off = { y: 0, z: 0 }) {
    const s = this.state
    const ok = fits(s.open.w, s.open.h, off.y, off.z)
    const stop = ok ? PLUG_HOME : OUT.x
    this.set({ off, plugX: PLUG_OUT, tried: "none" })
    this.v.tweens
      .run(ok ? 1100 : 800, (k) => this.set({ plugX: PLUG_OUT + (stop - PLUG_OUT) * k }), { tag: "plug" })
      .then(() => {
        if (Math.abs(this.state.plugX - stop) > 1e-6) return
        const patch: Partial<ElecState> = { tried: ok ? "fit" : "stuck" }
        if (this.state.step === 3 && ok && off.y === 0 && off.z === 0) patch.fitNominal = true
        const wc = worstCase(this.state.tol)
        if (this.state.step === 4 && ok && off.y === wc.y && off.z === wc.z) patch.worstOk = true
        this.set(patch)
      })
  }

  /** The worst corner of the stack. */
  insertWorst() {
    const wc = worstCase(this.state.tol)
    this.insert({ y: wc.y, z: wc.z })
  }

  /** A random unit: each contribution normal with ±tol as 3σ. */
  insertSample() {
    const s = this.state
    const g = () => {
      const u = 1 - Math.random()
      const v = Math.random()
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    }
    let dy = 0
    let dz = 0
    for (const k of Object.keys(s.tol) as TolKey[]) {
      if (TOL_AXES[k].y) dy += (g() * s.tol[k]) / 3
      if (TOL_AXES[k].z) dz += (g() * s.tol[k]) / 3
    }
    const ok = fits(s.open.w, s.open.h, dy, dz)
    this.set({ samples: s.samples + 1, fails: s.fails + (ok ? 0 : 1) })
    this.insert({ y: dy, z: dz })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.pcbMat.color.copy(tk.modelDark).lerp(tk.good, 0.3)
    this.pcbClear.color.copy(tk.modelDark).lerp(tk.good, 0.3)
    this.rubberMat.color.copy(tk.modelDark)
    this.clear(this.tub)
    this.clear(this.board)
    this.clear(this.cell)
    this.clear(this.plug)
    this.clear(this.notes)

    // A swollen cell lifts the board by a tenth of a millimetre or so: drawn 10× larger.
    const lift = Math.max(0, swollen(s) - BAY) * LIFT_EXAG
    this.buildTub(s, lift)
    this.buildBoard(s, lift)
    this.buildCell(s, lift)
    this.buildPlug(s)
    this.annotate(s, lift)

    this.pcbHandle.visible = s.step === 0 && !s.placed
    this.pcbHandle.position.set(s.pcb.x, s.pcb.y, s.pcb.z + PCB.t)
    this.battHandle.visible = s.step === 1
    this.battHandle.position.set(s.batt.x, s.batt.y, FLOOR + s.cellT)
    this.v.invalidate()
  }

  private buildTub(s: ElecState, lift: number) {
    const kit = this.v.kit
    const add = (g: THREE.BufferGeometry) => this.tub.add(face(g, kit, { edges: 20 }))
    add(box(-OUT.x, OUT.x, -OUT.y, OUT.y, 0, FLOOR))
    add(box(-OUT.x, -IN.x, -OUT.y, OUT.y, FLOOR, TUB_H))
    add(box(-IN.x, IN.x, IN.y, OUT.y, FLOOR, TUB_H))
    // The front wall is left out of the side view, so the battery bay shows.
    if (s.step !== 2) add(box(-IN.x, IN.x, -OUT.y, -IN.y, FLOOR, TUB_H))
    // +X wall with the USB-C opening (centred on the nominal receptacle).
    const wall = new THREE.Shape([V(-OUT.y, 0, 0), V(OUT.y, 0, 0), V(OUT.y, TUB_H, 0), V(-OUT.y, TUB_H, 0)].map((p) => new THREE.Vector2(p.x, p.y)))
    const r = Math.min(s.open.h / 2 - 0.01, 1.6)
    wall.holes.push(roundedRect(new THREE.Path(), s.open.w, s.open.h, r, 0, REC_Z))
    const wg = alongX(new THREE.ExtrudeGeometry(wall, { depth: WALL, bevelEnabled: false, curveSegments: 10 }))
    wg.translate(IN.x, 0, 0)
    add(wg)
    // Bosses (hollow look: a solid cylinder with a dark screw head on top once the board is on).
    for (const [x, y] of BOSSES) {
      const g = new THREE.CylinderGeometry(2.6, 2.9, PCB.z - FLOOR, 24)
      g.rotateX(Math.PI / 2)
      g.translate(x, y, FLOOR + (PCB.z - FLOOR) / 2)
      this.tub.add(face(g, kit, { role: s.step === 0 && !s.placed ? "highlight" : "model", edges: 40 }))
    }
    // A plastic rib holds up the antenna end: no metal screw near the antenna.
    add(box(-34, -32, -8, 8, FLOOR, PCB.z))
    // Clear lid, only where it matters (closing over the board, and lifted by a swollen cell).
    if ((s.step === 0 && s.placed) || s.step === 2) {
      const g = box(-OUT.x, OUT.x, -OUT.y, OUT.y, TUB_H + lift, TUB_H + 1.6 + lift)
      const m = new THREE.Mesh(g, kit.glass)
      m.add(edges(g, kit, 20))
      this.tub.add(m)
      // Button cap and light pipe through the lid.
      const cap = new THREE.CylinderGeometry(3.4, 3.4, TUB_H + 2.6 - (PCB.z + PCB.t + 3.5), 24)
      cap.rotateX(Math.PI / 2)
      cap.translate(4, 9, (PCB.z + PCB.t + 3.5 + TUB_H + 2.6) / 2 + lift)
      this.tub.add(face(cap, kit, { edges: 40 }))
      const pipe = new THREE.CylinderGeometry(1.5, 1.5, TUB_H + 1.6 - (PCB.z + PCB.t + 1), 16)
      pipe.rotateX(Math.PI / 2)
      pipe.translate(20, -12, (PCB.z + PCB.t + 1 + TUB_H + 1.6) / 2 + lift)
      const pm = new THREE.Mesh(pipe, kit.glass)
      pm.add(edges(pipe, kit, 40))
      this.tub.add(pm)
    }
  }

  private buildBoard(s: ElecState, lift: number) {
    const kit = this.v.kit
    const { x: ox, y: oy } = s.pcb
    const oz = s.pcb.z + lift
    const top = oz + PCB.t
    const shape = roundedRect(new THREE.Shape(), PCB.x1 - PCB.x0, PCB.y * 2, 1.5, ox, oy)
    for (const [bx, by] of BOSSES) shape.holes.push(new THREE.Path().absarc(ox + bx, oy + by, 1.2, 0, Math.PI * 2, true))
    const g = new THREE.ExtrudeGeometry(shape, { depth: PCB.t, bevelEnabled: false, curveSegments: 12 })
    g.translate(0, 0, oz)
    const m = new THREE.Mesh(g, s.step === 1 ? this.pcbClear : this.pcbMat)
    m.add(edges(g, kit, 30))
    this.board.add(m)
    const metal = (geo: THREE.BufferGeometry) => this.board.add(face(geo, kit, { role: "metal", edges: 30 }))
    const dark = (geo: THREE.BufferGeometry) => {
      const mm = new THREE.Mesh(geo, this.rubberMat)
      mm.add(edges(geo, kit, 30))
      this.board.add(mm)
    }
    // Radio module: shield can, and the PCB antenna past it (a meander on the board).
    metal(box(ox - 31, ox - 19, oy - ANT.y, oy + ANT.y, top, top + 2.4))
    const ant: THREE.Vector3[] = []
    for (let i = 0; i <= 8; i++) {
      const y = oy - ANT.y + 1 + (i * (2 * ANT.y - 2)) / 8
      const [a, b] = i % 2 ? [ox - 36, ox - 32] : [ox - 32, ox - 36]
      ant.push(V(a, y, top + 0.05), V(b, y, top + 0.05))
    }
    this.board.add(line(ant, kit.sketch))
    // USB-C receptacle at the +X edge, the button switch and the LED.
    metal(box(ox + REC.front - REC.len, ox + REC.front, oy - REC.w / 2, oy + REC.w / 2, top, top + REC.h))
    dark(box(ox + 1, ox + 7, oy + 6, oy + 12, top, top + 3.5))
    dark(box(ox + 19.2, ox + 20.8, oy - 12.8, oy - 11.2, top, top + 0.8))
    // Screws once it's on.
    if (s.placed || s.step > 0)
      for (const [bx, by] of BOSSES) {
        const h = new THREE.CylinderGeometry(2.1, 2.1, 1.2, 20)
        h.rotateX(Math.PI / 2)
        h.translate(ox + bx, oy + by, top + 0.6)
        metal(h)
      }
  }

  private buildCell(s: ElecState, lift: number) {
    const kit = this.v.kit
    const tk = this.v.tokens
    const bad = (s.step === 1 && !battOk(s.batt)) || (s.step === 2 && swollen(s) > BAY + 1e-9)
    this.cellMat.color.copy(bad ? tk.bad : tk.metal)
    const th = Math.min(swollen(s), BAY) + lift
    // The pouch: a box whose top bulges as it swells.
    const g = new THREE.BoxGeometry(BATT.lx, BATT.ly, s.cellT, 16, 12, 1)
    const p = g.getAttribute("position")
    for (let i = 0; i < p.count; i++) {
      if (p.getZ(i) > 0) {
        const bx = Math.cos((p.getX(i) / BATT.lx) * Math.PI)
        const by = Math.cos((p.getY(i) / BATT.ly) * Math.PI)
        p.setZ(i, s.cellT / 2 + (th - s.cellT) * (0.35 + 0.65 * bx * by))
      }
    }
    g.computeVertexNormals()
    g.translate(s.batt.x, s.batt.y, FLOOR + s.cellT / 2)
    const m = new THREE.Mesh(g, this.cellMat)
    m.add(edges(g, kit, 40))
    this.cell.add(m)
  }

  private buildPlug(s: ElecState) {
    if (s.step < 3) return
    const kit = this.v.kit
    const x = s.plugX
    const cy = s.off.y
    const cz = REC_Z + s.off.z
    // Overmold: a rounded block; the metal shell sticks out 6.65 mm in front of it.
    const om = roundedRect(new THREE.Shape(), OVERMOLD.w, OVERMOLD.h, 1.6, cy, cz)
    const og = alongX(new THREE.ExtrudeGeometry(om, { depth: 16, bevelEnabled: false, curveSegments: 10 }))
    og.translate(x, 0, 0)
    const tone = s.tried === "stuck" ? this.v.tokens.bad : s.tried === "fit" ? this.v.tokens.good : this.v.tokens.modelDark
    this.faceMat.color.copy(tone)
    const om3 = new THREE.Mesh(og, s.tried === "none" ? this.rubberMat : this.faceMat)
    om3.add(edges(og, kit, 30))
    this.plug.add(om3)
    const sh = roundedRect(new THREE.Shape(), PLUG.w, PLUG.h, PLUG.h / 2 - 0.01, cy, cz)
    const sg = alongX(new THREE.ExtrudeGeometry(sh, { depth: PLUG.len, bevelEnabled: false, curveSegments: 10 }))
    sg.translate(x - PLUG.len, 0, 0)
    this.plug.add(face(sg, kit, { role: "metal", edges: 40 }))
    const cable = new THREE.CylinderGeometry(2, 2, 10, 20)
    cable.rotateZ(Math.PI / 2)
    cable.translate(x + 16 + 5, cy, cz)
    const cm = new THREE.Mesh(cable, this.rubberMat)
    this.plug.add(cm)
  }

  private annotate(s: ElecState, lift: number) {
    const kit = this.v.kit
    const tk = this.v.tokens
    const n = this.notes
    const plain = "border-transparent bg-transparent font-sans text-muted-foreground"
    if (s.step === 0) {
      if (!s.placed) n.add(label(t("对准四个螺柱", "Line up with the four bosses"), V(0, -OUT.y - 4, TUB_H), plain))
      else {
        n.add(label(t("按键帽对准开关", "Button cap over the switch"), V(4, 9, TUB_H + 6), plain))
        n.add(label(t("导光柱对准 LED", "Light pipe over the LED"), V(20, -12, TUB_H + 6), plain))
        n.add(label(t("USB-C 对准开孔", "USB-C at the opening"), V(OUT.x + 2, 0, REC_Z + 6), plain))
      }
    }
    if (s.step === 1) {
      // The antenna keep-out: no metal within 15 mm of the antenna.
      const ok = battOk(s.batt)
      this.zoneMat.color.copy(ok ? tk.warn : tk.bad)
      const g = box(-IN.x, KEEP_X, -IN.y, IN.y, FLOOR, TUB_H)
      const m = new THREE.Mesh(g, this.zoneMat)
      m.add(edges(g, kit, 30))
      n.add(m)
      n.add(label(t("天线净空：15 mm 内不放金属", "Antenna keep-out: no metal within 15 mm"), V((-IN.x + KEEP_X) / 2, IN.y + 4, TUB_H), "font-sans"))
      n.add(label(ok ? t("电池在净空区外", "Battery clear of the keep-out") : t("电池的铝塑膜挡住了天线", "The pouch's foil blocks the antenna"), V(s.batt.x, s.batt.y - BATT.ly / 2 - 4, TUB_H), ok ? "border-success text-success font-sans" : "border-destructive text-destructive font-sans"))
      n.add(label(t("塑料筋托住这一端", "A plastic rib holds this end"), V(-33, -IN.y - 4, TUB_H), plain))
    }
    if (s.step === 2) {
      const y = -IN.y
      n.add(linearDim(kit, V(s.batt.x + BATT.lx / 2, y, FLOOR), V(s.batt.x + BATT.lx / 2, y, PCB.z + lift), V(1, 0, 0), 8, t(`电池仓 ${BAY.toFixed(1)}`, `Bay ${BAY.toFixed(1)}`)))
      n.add(linearDim(kit, V(s.batt.x - BATT.lx / 2, y, FLOOR), V(s.batt.x - BATT.lx / 2, y, FLOOR + Math.min(swollen(s), BAY) + lift), V(-1, 0, 0), 8, t(`电池 ${swollen(s).toFixed(2)}`, `Cell ${swollen(s).toFixed(2)}`)))
      if (lift > 0.01) {
        n.add(label(t("鼓包顶起电路板，盖子被撑开", "The swollen cell lifts the board and pushes the lid open"), V(s.batt.x, y, TUB_H + 8), "border-destructive text-destructive font-sans"))
        n.add(label(t(`顶起量放大 ${LIFT_EXAG} 倍显示`, `Lift drawn ${LIFT_EXAG}× larger`), V(s.batt.x, y, TUB_H + 4), "border-transparent bg-transparent font-sans text-muted-foreground"))
      }
      else if (s.aged > 0.99) n.add(label(t("鼓了 10% 也还放得下", "Still fits after swelling 10%"), V(s.batt.x, y, TUB_H + 6), "border-success text-success font-sans"))
    }
    if (s.step >= 3) {
      n.add(label(t("开孔", "Opening"), V(OUT.x, -s.open.w / 2 - 4, REC_Z), plain))
      if (s.tried === "stuck")
        n.add(label(t("插头外壳顶在墙上，插不到底", "The overmold hits the wall: the plug can't seat"), V(OUT.x + 8, 0, REC_Z + 9), "border-destructive text-destructive font-sans"))
      if (s.tried === "fit") n.add(label(t("插到底了", "Fully seated"), V(OUT.x + 8, 0, REC_Z + 9), "border-success text-success font-sans"))
    }
  }

  private makeHandle(title: string, onMove: (p: THREE.Vector3) => void, height: () => number) {
    const el = document.createElement("div")
    el.className = "interactive size-4 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = title
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(V(0, 0, 1), -height())
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (hit) onMove(hit)
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    })
    return new CSS2DObject(el)
  }
}
