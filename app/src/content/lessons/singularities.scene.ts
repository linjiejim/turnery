import * as THREE from "three"
import { face, label, line, tag } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { t } from "@/lib/i18n"
import { LessonScene } from "./scene"
import { gridGeometry, isoCurves, noPick, orient, paintZebra, params, sampleGrid, segmentsGeometry, zebraMaterial, type SurfFn } from "./patch-layout.surf"
import {
  CORNER_TOP,
  SPLIT_QUADS,
  apexOf,
  bigCornerPatch,
  cornerContext,
  domeH,
  meridian,
  poleDome,
  quadOnCorner,
  ringPoly,
  triCorner,
  trimmedCornerIsos,
  trimmedTop,
  untrimmedTop,
  wallGrid,
  type Shape,
} from "./singularities.geom"

/**
 * 5.4.2 「四边面、奇点与收敛点的处理」: a dome top collapsed to a pole versus a four-sided patch
 * trimmed by the outline; round (an axis of revolution) versus a rounded square; the row of control
 * points next to the pole; then a box corner as a three-sided patch with a collapsed edge, as three
 * four-sided patches, or as one larger four-sided patch trimmed.
 */
export type Display = "shade" | "iso" | "zebra"
export type Topo = "pole" | "quad"
export type CornerTopo = "tri" | "split" | "trim"

export type SingState = {
  step: number
  display: Display
  topo: Topo
  shape: Shape
  eps: number
  corner: CornerTopo
  clickedPole: boolean
  zebraPole: boolean
  zebraQuad: boolean
  roundPole: boolean
  flattened: boolean
  foundPoint: boolean
  seenTri: boolean
  seenSplit: boolean
  seenTrim: boolean
}

const DOME_TARGET = new THREE.Vector3(0, 0, 12)
const CORNER_TARGET = new THREE.Vector3(6, 4, 2)

export class SingScene extends LessonScene<SingState> {
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private pickables: THREE.Mesh[] = []
  private zebra = zebraMaterial(new THREE.Vector3(0.35, 1, 0.2))
  private dotMat = new THREE.MeshBasicMaterial()
  private down: { x: number; y: number } | null = null

  constructor(v: Viewer, emit: (s: SingState) => void) {
    super(v, emit, {
      step: 0,
      display: "iso",
      topo: "pole",
      shape: "square",
      eps: 1.5,
      corner: "tri",
      clickedPole: false,
      zebraPole: false,
      zebraQuad: false,
      roundPole: false,
      flattened: false,
      foundPoint: false,
      seenTri: false,
      seenSplit: false,
      seenTrim: false,
    })
    v.setGrid(80, 10)
    this.root.add(this.body, this.marks)
    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => (this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null)
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
      this.onClick(e)
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
    const patch: Partial<SingState> = { step }
    if (step === 0) Object.assign(patch, { display: "iso", topo: "pole", shape: "square", eps: 1.5 })
    if (step === 1) Object.assign(patch, { display: s.display === "zebra" ? "zebra" : "iso", shape: "square", eps: 1.5 })
    if (step === 2) Object.assign(patch, { display: "zebra", topo: "pole", eps: 1.5 })
    if (step === 3) Object.assign(patch, { display: "zebra", topo: "pole", shape: "square" })
    if (step === 4) Object.assign(patch, { display: "iso", corner: "tri" })
    this.set(patch)
    this.markSeen()
    const corner = step === 4
    const target = corner ? CORNER_TARGET : DOME_TARGET
    const dir = corner ? new THREE.Vector3(1, 0.75, 0.95) : new THREE.Vector3(0.45, -1, 0.95)
    this.v.flyTo(target.clone().addScaledVector(dir.normalize(), corner ? 125 : step === 3 ? 140 : 160), target, 850)
  }

  // ------------------------------------------------------------ actions

  setDisplay(display: Display) {
    this.set({ display })
    this.markSeen()
  }

  setTopo(topo: Topo) {
    this.set({ topo })
    this.markSeen()
  }

  setShape(shape: Shape) {
    this.set({ shape })
    this.markSeen()
  }

  setEps(eps: number) {
    this.set({ eps, flattened: this.state.flattened || (this.state.step === 3 && eps <= 0.15) })
  }

  setCorner(corner: CornerTopo) {
    this.set({ corner })
    this.markSeen()
  }

  private markSeen() {
    const s = this.state
    const patch: Partial<SingState> = {}
    if (s.step === 1 && s.display === "zebra") {
      if (s.topo === "pole" && !s.zebraPole) patch.zebraPole = true
      if (s.topo === "quad" && !s.zebraQuad) patch.zebraQuad = true
    }
    if (s.step === 2 && s.display === "zebra" && s.topo === "pole" && s.shape === "round" && !s.roundPole) patch.roundPole = true
    if (s.step === 4) {
      if (s.corner === "tri" && !s.seenTri) patch.seenTri = true
      if (s.corner === "split" && !s.seenSplit) patch.seenSplit = true
      if (s.corner === "trim" && !s.seenTrim) patch.seenTrim = true
    }
    if (Object.keys(patch).length) this.set(patch)
  }

  private onClick(e: PointerEvent) {
    const s = this.state
    const hit = this.v.pick(e, this.pickables, false)
    if (!hit) return
    if (s.step === 0 && s.topo === "pole" && hit.point.distanceTo(apexOf(s.shape)) < 5) this.set({ clickedPole: true })
    if (s.step === 4 && s.corner === "tri" && hit.point.distanceTo(CORNER_TOP) < 4) this.set({ foundPoint: true })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.body)
    this.clear(this.marks)
    this.pickables = []
    paintZebra(this.zebra, this.v.tokens, 10)
    this.dotMat.color.copy(this.v.tokens.highlight)
    const zebra = s.display === "zebra"
    const iso = s.display === "iso"
    const mat = (m: THREE.Mesh, pick = true) => {
      if (zebra) m.material = this.zebra
      if (pick) this.pickables.push(m)
      return m
    }
    const isos: THREE.Vector3[][] = []
    const edges: THREE.Vector3[][] = []

    if (s.step < 4) {
      const shape = s.shape
      const wall = wallGrid(shape)
      this.body.add(mat(face(gridGeometry(wall), kit, { feature: "wall", edges: false })))
      edges.push(wall.pos[0], wall.pos[1])
      if (s.topo === "pole") {
        const P = poleDome(shape, s.eps)
        this.body.add(mat(face(gridGeometry(orient(sampleGrid(P, 96, 28), new THREE.Vector3(0, 0, 1))), kit, { feature: "top", edges: false })))
        if (iso) isos.push(...isoCurves(P, params(16, false), params(6), 48))
        const apex = apexOf(shape)
        if (s.step === 0 && s.clickedPole) this.marks.add(tag(t("所有等参线收敛到这一点：极点", "Every isoparm converges here: the pole"), apex.clone().add(new THREE.Vector3(0, 0, 6))))
        if (s.step === 3) this.addNet(shape, s.eps)
      } else {
        const g = trimmedTop(shape)
        this.body.add(mat(face(gridGeometry(g), kit, { feature: "top", edges: false })))
        if (iso) {
          isos.push(...trimmedLines(ringPoly(shape), (x, y) => domeH(shape, x, y)))
          const big = untrimmedTop(shape)
          const ghost = new THREE.Mesh(gridGeometry(orient(sampleGrid(big, 24, 24), new THREE.Vector3(0, 0, 1))), kit.ghost)
          ghost.position.z = -0.15
          this.body.add(noPick(ghost))
          this.marks.add(label(t("剪掉的部分", "Trimmed away"), big(0.94, 0.06).add(new THREE.Vector3(0, 0, 2)), "font-sans text-muted-foreground"))
        }
      }
    } else {
      for (const c of cornerContext()) this.body.add(mat(face(gridGeometry(c.grid), kit, { feature: "context", role: "model", edges: false }), false))
      const patches: SurfFn[] = s.corner === "tri" ? [triCorner(2.4)] : SPLIT_QUADS.map(quadOnCorner)
      for (const P of patches) {
        const grid = orient(sampleGrid(P, 24, 24), new THREE.Vector3(1, 1, 1))
        const m = face(gridGeometry(grid), kit, { feature: "corner", role: zebra ? "model" : "highlight", edges: false })
        this.body.add(mat(m))
        if (s.corner !== "trim") {
          edges.push(...isoCurves(P, [0, 1], [0, 1], 32))
          if (iso) isos.push(...isoCurves(P, params(s.corner === "tri" ? 8 : 4), params(s.corner === "tri" ? 5 : 4), 40))
        }
      }
      if (s.corner === "trim") {
        if (iso) isos.push(...trimmedCornerIsos(8))
        const ghost = new THREE.Mesh(gridGeometry(orient(sampleGrid(bigCornerPatch(), 24, 24), new THREE.Vector3(1, 1, 1))), kit.ghost)
        this.body.add(noPick(ghost))
        for (const q of SPLIT_QUADS) edges.push(...isoCurves(quadOnCorner(q), [0], [0], 32))
      }
      if (s.corner === "tri" && s.foundPoint) this.marks.add(tag(t("退化点：一整条边缩成了一点", "Degenerate point: a whole edge shrunk to a point"), CORNER_TOP.clone().add(new THREE.Vector3(0, 0, 5))))
      if (s.corner === "split") this.marks.add(label(t("三块四边面在这里相交", "Three four-sided patches meet here"), quadOnCorner(SPLIT_QUADS[0])(1, 1).add(new THREE.Vector3(0, 0, 5)), "font-sans"))
    }
    if (edges.length) this.body.add(noPick(new THREE.LineSegments(segmentsGeometry(edges), kit.edge)))
    if (isos.length) this.body.add(noPick(new THREE.LineSegments(segmentsGeometry(isos), kit.edgeSoft)))
    this.v.invalidate()
  }

  /** The ring of control points next to the pole, with the spokes from it into the pole (the tangent directions there). */
  private addNet(shape: Shape, eps: number) {
    const kit = this.v.kit
    const n = 16
    const polys: THREE.Vector3[][] = []
    const ringNext: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const m = meridian(shape, i / n, eps)
      polys.push([m[2], m[3]].map((p) => p.clone().add(new THREE.Vector3(0, 0, 0.6))))
      ringNext.push(m[2].clone().add(new THREE.Vector3(0, 0, 0.6)))
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), this.dotMat)
      dot.position.copy(m[2]).add(new THREE.Vector3(0, 0, 0.6))
      this.marks.add(noPick(dot))
    }
    this.marks.add(noPick(new THREE.LineSegments(segmentsGeometry(polys), kit.edgeSoft)))
    this.marks.add(line([...ringNext, ringNext[0]], kit.sketch))
    this.marks.add(tag(t("极点旁的一圈控制点", "The ring of control points next to the pole"), ringNext[2].clone().add(new THREE.Vector3(4, 0, 4))))
  }

  dispose() {
    super.dispose()
    this.zebra.dispose()
    this.dotMat.dispose()
  }
}

/** x = const and y = const lines over z = h(x, y) inside a closed plan polygon. */
function trimmedLines(poly: V2[], h: (x: number, y: number) => number) {
  const out: THREE.Vector3[][] = []
  const inside = (x: number, y: number) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i]
      const b = poly[j]
      if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c
    }
    return c
  }
  const run = (pts: V2[]) => {
    let cur: THREE.Vector3[] = []
    for (const [x, y] of pts) {
      if (inside(x, y)) cur.push(new THREE.Vector3(x, y, h(x, y) + 0.06))
      else if (cur.length) {
        if (cur.length > 1) out.push(cur)
        cur = []
      }
    }
    if (cur.length > 1) out.push(cur)
  }
  for (let k = -4; k <= 4; k++) {
    const c = k * 7.5
    run(Array.from({ length: 101 }, (_, i) => [c, -40 + (80 * i) / 100] as V2))
    run(Array.from({ length: 101 }, (_, i) => [-40 + (80 * i) / 100, c] as V2))
  }
  return out
}
