import * as THREE from "three"
import { label, line, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { CMF, STRIPS, Studio, crispReflections, grainTexture } from "./materials-finishes.studio"

/**
 * 6.3.2 「光面会放大缺陷」: a moulded wall (the cosmetic face on top), two ribs and a screw boss
 * underneath. Where a rib or boss meets the wall the plastic is thicker; it cools last, shrinks
 * more and pulls the cosmetic face in. The dent is modelled qualitatively from how much thicker
 * the root is than the wall (the inscribed circle of the T-junction) and drawn exaggerated; an
 * inspection booth of parallel light tubes shows it as a kink in the reflections, the way a
 * designer checks a glossy part under a row of lamps.
 */
export type SinkFinish = "gloss" | "matte" | "texture"

export type SinkState = {
  step: number
  /** Rib thickness as a percentage of the wall. */
  rib: number
  cored: boolean
  finish: SinkFinish
  ribChanged: boolean
  foundRib: boolean
  foundBoss: boolean
  misses: number
  seenGloss: boolean
  seenTexture: boolean
  /** 0 as drawn in CAD … 1 as moulded (the dents shrunk in). */
  shrink: number
}

/** Wall thickness, mm. */
export const WALL = 2.5
const PX = 70
const PY = 42
const RIB_H = 9
const RIB_Y = [-16, 16]
const RIB_END = 30
const BOSS = { x: 48, y: 0, r: 4, hole: 2.5, h: 9 }
/** Displayed dent at a rib as thick as the wall, mm (exaggerated so the reflections show it). */
const DEPTH_RIB = 0.12

/** Diameter of the largest circle that fits in a T-junction of a wall `wall` thick and a rib `rib` thick (no root fillet). */
export function junction(rib: number, wall = WALL) {
  return (wall * wall + (rib * rib) / 4) / wall
}

/**
 * How strongly the root sinks, 0 … 1 for a rib from 40 % to 100 % of the wall (more for a solid boss).
 * Qualitative: grows with the extra thickness at the root, nothing below a few percent of it.
 */
export function sinkLevel(rootDiameter: number, wall = WALL) {
  return Math.max(0, rootDiameter / wall - 1 - 0.04) / 0.21
}

export function ribLevel(ribPct: number) {
  return sinkLevel(junction((ribPct / 100) * WALL))
}

/** The boss root: solid, it is as thick as the boss; cored, its wall is 1.5 mm (60 % of the wall). */
export function bossLevel(cored: boolean) {
  return cored ? sinkLevel(junction(BOSS.r - BOSS.hole)) : Math.min(2.2, sinkLevel(BOSS.r * 2))
}

export function levelWord(k: number) {
  if (k < 0.05) return t("看不出", "None")
  if (k < 0.3) return t("轻微", "Faint")
  if (k < 0.7) return t("看得出", "Visible")
  return t("明显", "Obvious")
}

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b)

/** Depth of the dent on the cosmetic face at (x, y), mm, ≥ 0. */
function dent(x: number, y: number, s: SinkState) {
  if (s.shrink <= 0) return 0
  const t = (s.rib / 100) * WALL
  const lr = ribLevel(s.rib) * DEPTH_RIB
  let d = 0
  if (lr > 0) {
    const w = 0.55 * (WALL + t)
    const along = 1 - smooth(RIB_END - 3, RIB_END + 5, x)
    for (const ry of RIB_Y) d += lr * along * Math.exp(-(((y - ry) / w) ** 2))
  }
  const lb = bossLevel(s.cored) * DEPTH_RIB
  const rho = Math.hypot(x - BOSS.x, y - BOSS.y)
  if (s.cored) d += lb * Math.exp(-(((rho - (BOSS.r + BOSS.hole) / 2) / 2.4) ** 2))
  else d += lb * Math.exp(-((rho / (BOSS.r + 1.6)) ** 2))
  return d * s.shrink
}

/** The cosmetic face: a fine grid displaced by the dent, normals from its gradient, uv in mm. */
function cosmetic(s: SinkState) {
  const nx = 141
  const ny = 141
  const pos = new Float32Array(nx * ny * 3)
  const nor = new Float32Array(nx * ny * 3)
  const uv = new Float32Array(nx * ny * 2)
  const e = 0.05
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const x = -PX + (2 * PX * i) / (nx - 1)
      const y = -PY + (2 * PY * j) / (ny - 1)
      const k = j * nx + i
      const z = WALL - dent(x, y, s)
      const gx = -(dent(x + e, y, s) - dent(x - e, y, s)) / (2 * e)
      const gy = -(dent(x, y + e, s) - dent(x, y - e, s)) / (2 * e)
      const l = Math.hypot(gx, gy, 1)
      pos.set([x, y, z], k * 3)
      nor.set([-gx / l, -gy / l, 1 / l], k * 3)
      uv.set([x, y], k * 2)
    }
  const idx: number[] = []
  for (let j = 0; j < ny - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i
      idx.push(a, a + 1, a + nx, a + 1, a + nx + 1, a + nx)
    }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3))
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** Flat quads with their own normals (the structure behind the wall). */
class Quads {
  pos: number[] = []
  add(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) {
    for (const p of [a, b, c, a, c, d]) this.pos.push(p.x, p.y, p.z)
  }
  geometry() {
    const g = new THREE.BufferGeometry()
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3))
    g.computeVertexNormals()
    return g
  }
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** Ribs, boss, underside and the three plain side faces. Normals face out (counter-clockwise seen from outside). */
function structure(s: SinkState) {
  const q = new Quads()
  const t = (s.rib / 100) * WALL
  const tip = Math.max(0.4, t - 2 * RIB_H * Math.tan(THREE.MathUtils.degToRad(0.5)))
  // Underside of the wall (faces −Z).
  q.add(V(-PX, -PY, 0), V(-PX, PY, 0), V(PX, PY, 0), V(PX, -PY, 0))
  // Side faces: front (−Y), back (+Y), right end (+X). The left end is the cut, drawn separately.
  const top = (x: number, y: number) => WALL - dent(x, y, s)
  const n = 70
  for (let i = 0; i < n; i++) {
    const x0 = -PX + (2 * PX * i) / n
    const x1 = -PX + (2 * PX * (i + 1)) / n
    q.add(V(x0, -PY, 0), V(x1, -PY, 0), V(x1, -PY, top(x1, -PY)), V(x0, -PY, top(x0, -PY)))
    q.add(V(x1, PY, 0), V(x0, PY, 0), V(x0, PY, top(x0, PY)), V(x1, PY, top(x1, PY)))
  }
  for (let j = 0; j < n; j++) {
    const y0 = -PY + (2 * PY * j) / n
    const y1 = -PY + (2 * PY * (j + 1)) / n
    q.add(V(PX, y0, 0), V(PX, y1, 0), V(PX, y1, top(PX, y1)), V(PX, y0, top(PX, y0)))
  }
  // Ribs: tapered (½° draft each side), from the cut end to RIB_END.
  for (const ry of RIB_Y) {
    const r0 = ry - t / 2
    const r1 = ry + t / 2
    const b0 = ry - tip / 2
    const b1 = ry + tip / 2
    const zb = -RIB_H
    q.add(V(RIB_END, r0, 0), V(-PX, r0, 0), V(-PX, b0, zb), V(RIB_END, b0, zb))
    q.add(V(-PX, r1, 0), V(RIB_END, r1, 0), V(RIB_END, b1, zb), V(-PX, b1, zb))
    q.add(V(RIB_END, b0, zb), V(-PX, b0, zb), V(-PX, b1, zb), V(RIB_END, b1, zb))
    q.add(V(RIB_END, r1, 0), V(RIB_END, r0, 0), V(RIB_END, b0, zb), V(RIB_END, b1, zb))
  }
  // Boss: outside, bottom, and the hole when cored.
  const seg = 40
  const ring = (r: number, z: number, i: number) => V(BOSS.x + Math.cos((i / seg) * Math.PI * 2) * r, BOSS.y + Math.sin((i / seg) * Math.PI * 2) * r, z)
  const rTip = BOSS.r - BOSS.h * Math.tan(THREE.MathUtils.degToRad(0.5))
  const hTip = BOSS.hole + BOSS.h * Math.tan(THREE.MathUtils.degToRad(0.5))
  for (let i = 0; i < seg; i++) {
    q.add(ring(BOSS.r, 0, i + 1), ring(BOSS.r, 0, i), ring(rTip, -BOSS.h, i), ring(rTip, -BOSS.h, i + 1))
    if (s.cored) {
      q.add(ring(hTip, -BOSS.h, i + 1), ring(rTip, -BOSS.h, i + 1), ring(rTip, -BOSS.h, i), ring(hTip, -BOSS.h, i))
      q.add(ring(BOSS.hole, 0, i), ring(BOSS.hole, 0, i + 1), ring(hTip, -BOSS.h, i + 1), ring(hTip, -BOSS.h, i))
    } else q.add(V(BOSS.x, BOSS.y, -BOSS.h), ring(rTip, -BOSS.h, i + 1), ring(rTip, -BOSS.h, i), V(BOSS.x, BOSS.y, -BOSS.h))
  }
  return q.geometry()
}

/** The cut at the left end (x = −PX): wall and rib sections, the top edge following the dent. */
function cutFace(s: SinkState) {
  const t = (s.rib / 100) * WALL
  const tip = Math.max(0.4, t - 2 * RIB_H * Math.tan(THREE.MathUtils.degToRad(0.5)))
  // Walk in (y, z), counter-clockwise seen from −X (y to the left there, so walk y downward on top).
  const pts: THREE.Vector2[] = []
  pts.push(new THREE.Vector2(-PY, 0))
  for (const ry of RIB_Y) {
    pts.push(new THREE.Vector2(ry - t / 2, 0), new THREE.Vector2(ry - tip / 2, -RIB_H), new THREE.Vector2(ry + tip / 2, -RIB_H), new THREE.Vector2(ry + t / 2, 0))
  }
  pts.push(new THREE.Vector2(PY, 0))
  for (let j = 120; j >= 0; j--) {
    const y = -PY + (2 * PY * j) / 120
    pts.push(new THREE.Vector2(y, WALL - dent(-PX, y, s)))
  }
  const shape = new THREE.Shape(pts)
  const g = new THREE.ShapeGeometry(shape)
  // Shape (y, z) → world (−PX, y, z); seen from −X.
  const p = g.getAttribute("position")
  for (let i = 0; i < p.count; i++) p.setXYZ(i, -PX - 0.02, p.getX(i), p.getY(i))
  g.computeVertexNormals()
  const n = g.getAttribute("normal")
  if (n.getX(0) > 0) {
    const idx = g.getIndex()
    if (idx) for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i + 1)
      idx.setX(i + 1, idx.getX(i + 2))
      idx.setX(i + 2, a)
    }
    g.computeVertexNormals()
  }
  const outline = [...pts, pts[0]].map((v) => V(-PX - 0.05, v.x, v.y))
  return { g, outline }
}

const FRONT = { pos: V(0, -264, 140), target: V(0, 4, -6) }
const SECTION = { pos: V(-PX - 84, -36, -36), target: V(-PX, -10, -3) }
const BACK = { pos: V(95, -125, -135), target: V(30, 0, -4) }

export class SinkScene extends LessonScene<SinkState> {
  private part = new THREE.Group()
  private marks = new THREE.Group()
  private studio: Studio
  private skin = new THREE.MeshPhysicalMaterial()
  private back = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0 })
  private cut = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
  private edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 })
  private grain = grainTexture("leather", 7)
  private face: THREE.Mesh | null = null
  private down: { x: number; y: number } | null = null

  constructor(v: Viewer, emit: (s: SinkState) => void) {
    super(v, emit, {
      step: 0,
      rib: 100,
      cored: false,
      finish: "gloss",
      ribChanged: false,
      foundRib: false,
      foundBoss: false,
      misses: 0,
      seenGloss: false,
      seenTexture: false,
      shrink: 1,
    })
    v.setGrid(120, 10)
    v.showGrid(false)
    this.studio = new Studio(v, STRIPS, { intensity: 1, headlights: 1, room: [0.03, 0.05, 0.07] })
    this.root.add(this.part, this.marks)
    this.skin.onBeforeCompile = (shader) => {
      shader.fragmentShader = crispReflections(shader.fragmentShader)
    }
    this.skin.customProgramCacheKey = () => "sink-crisp"
    const el = v.renderer.domElement
    const onDown = (ev: PointerEvent) => (this.down = { x: ev.clientX, y: ev.clientY })
    const onUp = (ev: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 5 || this.state.step !== 1 || !this.face) return
      const hit = v.pick(ev, [this.face], false)
      if (hit) this.probe(hit.point)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
    })
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("mold")
    const patch: Partial<SinkState> = { step, finish: "gloss", cored: false, shrink: step === 1 && !(s.foundRib || s.foundBoss) ? 0 : 1 }
    if (step <= 1 || step === 4) patch.rib = 100
    if (step === 3) patch.rib = Math.min(s.rib, 50)
    this.set(patch)
    this.markSeen()
    if (step === 0) this.sectionView(900)
    else this.frontView(900)
  }

  /** From the front and above, the whole cosmetic face in view whatever the viewport's shape. */
  frontView(ms = 700) {
    const box = new THREE.Box3(V(-PX, -PY, -2), V(PX, PY, WALL))
    this.v.fit(box, { dir: FRONT.pos.clone().sub(FRONT.target), padding: 0.92, animate: ms > 0 })
  }

  backView() {
    this.v.flyTo(BACK.pos.clone(), BACK.target.clone(), 800)
  }

  sectionView(ms = 800) {
    this.v.flyTo(SECTION.pos.clone(), SECTION.target.clone(), ms)
  }

  // ------------------------------------------------------------ actions

  setRib(rib: number) {
    this.set({ rib, ribChanged: true })
  }

  setCored(cored: boolean) {
    this.set({ cored })
  }

  setFinish(finish: SinkFinish) {
    this.set({ finish })
    this.markSeen()
  }

  /** Mould it: the dents shrink in as the plastic cools. */
  mold() {
    if (this.state.shrink >= 1) return
    this.v.tweens.run(1200, (k) => this.set({ shrink: k }), { tag: "mold" })
  }

  /** A click on the cosmetic face: is there a dent here? */
  private probe(p: THREE.Vector3) {
    const s = this.state
    if (s.shrink < 0.5) return
    const onRib = p.x < RIB_END + 2 && RIB_Y.some((ry) => Math.abs(p.y - ry) < 5)
    const onBoss = Math.hypot(p.x - BOSS.x, p.y - BOSS.y) < 8
    if (onRib && !s.foundRib) this.set({ foundRib: true })
    else if (onBoss && !s.foundBoss) this.set({ foundBoss: true })
    else if (!onRib && !onBoss) this.set({ misses: s.misses + 1 })
  }

  private markSeen() {
    const s = this.state
    if (s.step !== 4) return
    if (s.finish === "gloss" && !s.seenGloss) this.set({ seenGloss: true })
    if (s.finish === "texture" && !s.seenTexture) this.set({ seenTexture: true })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    const kit = this.v.kit
    this.clear(this.part)
    this.clear(this.marks)

    const m = this.skin
    m.color.copy(CMF.plastic)
    m.metalness = 0
    m.roughness = s.finish === "gloss" ? 0.03 : s.finish === "matte" ? 0.42 : 0.55
    const nm = s.finish === "texture" ? this.grain : null
    if (m.normalMap !== nm) {
      m.normalMap = nm
      m.needsUpdate = true
    }
    m.normalScale.setScalar(0.9)
    this.back.color.copy(tk.model)
    this.cut.color.copy(tk.model).lerp(tk.highlight, 0.4)
    this.edgeMat.color.copy(tk.dark ? tk.edgeSoft : tk.edge)

    this.face = new THREE.Mesh(cosmetic(s), m)
    const sg = structure(s)
    const body = new THREE.Mesh(sg, this.back)
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(sg, 25), this.edgeMat)
    edges.raycast = () => {}
    const { g, outline } = cutFace(s)
    const cutMesh = new THREE.Mesh(g, this.cut)
    this.part.add(this.face, body, edges, cutMesh, line(outline, kit.sketchDefined))

    if (s.step === 0) this.backMarks(s)
    if (s.step === 3) this.marks.add(tag(s.cored ? t("掏空的凸台", "Cored boss") : t("实心凸台", "Solid boss"), V(BOSS.x, BOSS.y, -BOSS.h - 3)))
    if (s.step === 1) {
      if (s.foundRib) this.marks.add(this.found(V(-20, RIB_Y[0], WALL + 0.5), t("筋的背后", "Behind a rib")))
      if (s.foundBoss) this.marks.add(this.found(V(BOSS.x, BOSS.y, WALL + 0.5), t("凸台的背后", "Behind the boss")))
    }
    this.v.invalidate()
  }

  /** Back view: the inscribed circle at a rib root on the cut face, and callouts. */
  private backMarks(s: SinkState) {
    const kit = this.v.kit
    const t1 = (s.rib / 100) * WALL
    const dj = junction(t1)
    const zc = WALL - dj / 2
    const ry = RIB_Y[0]
    const circle: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2
      circle.push(V(-PX - 0.3, ry + Math.cos(a) * (dj / 2), zc + Math.sin(a) * (dj / 2)))
    }
    this.marks.add(line(circle, kit.sketch))
    const root = label(t(`根部内切圆 Ø${dj.toFixed(2)} mm`, `Root circle Ø${dj.toFixed(2)} mm`), V(-PX - 0.5, ry - dj / 2 - 0.6, zc), "font-sans")
    root.center.set(0, 0.5)
    const wall = label(t(`壁厚 ${WALL} mm`, `Wall ${WALL} mm`), V(-PX - 0.5, ry + 10, WALL + 0.8), "font-sans")
    wall.center.set(0.5, 1)
    this.marks.add(root, wall, tag(t(`筋 ${s.rib}% · ${t1.toFixed(2)} mm`, `Rib ${s.rib}% · ${t1.toFixed(2)} mm`), V(-PX, ry, -RIB_H - 1.5)))
  }

  private found(p: THREE.Vector3, text: string) {
    const g = new THREE.Group()
    const ring: THREE.Vector3[] = []
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2
      ring.push(V(p.x + Math.cos(a) * 7, p.y + Math.sin(a) * 7, p.z))
    }
    g.add(line(ring, this.v.kit.sketch))
    g.add(tag(text, V(p.x, p.y + 9, p.z + 2)))
    return g
  }

  dispose() {
    this.v.tweens.cancel("mold")
    this.v.showGrid(true)
    this.studio.dispose()
    super.dispose()
    this.skin.dispose()
    this.back.dispose()
    this.cut.dispose()
    this.edgeMat.dispose()
    this.grain.dispose()
  }
}
