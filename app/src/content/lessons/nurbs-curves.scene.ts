import * as THREE from "three"
import type { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { label } from "@/three/build"
import { arc, type V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { t } from "@/lib/i18n"
import { LessonScene } from "./scene"
import { breakpoints, clampedKnots, evalCurve, greville, influence, interpolate, knotSpans, sampleCurve, spansInfluenced, type Nurbs } from "./nurbs-curves.nurbs"
import { comb, dotMesh, dragHandle, onTop, poly, styleHandle, thin } from "./nurbs-curves.draw"

/**
 * 5.1.1 「NURBS 曲线：控制点、阶数、节点」: a clamped B-spline on the top plane. Drag control
 * points and see which spans move (degree + 1 of them); switch the degree (1, 2, 3, 5) and the
 * point count; read the knots; drag Rhino-style edit points (Greville points) and watch several
 * control points move; then a rational quadratic whose middle weight makes an exact quarter circle.
 */
export type Degree = 1 | 2 | 3 | 5

export type NurbsState = {
  step: number
  degree: Degree
  count: number
  pts: V2[]
  /** Control point whose reach is highlighted (last dragged or pointed at). */
  focus: number | null
  showComb: boolean
  combScale: number
  /** Weight of the middle point of the quarter arc (last step). */
  weight: number
  /** How many control points the last edit-point drag moved. */
  moved: number
  dragged: boolean
  draggedLocal: boolean
  tried: Degree[]
  single: boolean
  draggedEdit: boolean
  circle: boolean
}

export const DEFAULT_COUNT = 10
export const MAX_COUNT = 14
const HALF = 110
const R = 70
export const EXACT_W = Math.SQRT1_2

/** The starting shape: a gentle wave, the same at any point count. */
export function basePoints(n: number): V2[] {
  return Array.from({ length: n }, (_, i) => {
    const s = i / (n - 1)
    return [-HALF + 2 * HALF * s, 40 * Math.sin(2 * Math.PI * (1.45 * s - 0.06))] as V2
  })
}

const copy = (pts: V2[]) => pts.map((p) => [p[0], p[1]] as V2)

export function curveOf(s: Pick<NurbsState, "pts" | "degree">): Nurbs {
  return { pts: s.pts, p: s.degree, U: clampedKnots(s.pts.length, s.degree) }
}

/** The quarter arc: quadratic, corner point weighted. Centre at the origin, radius R. */
export function quarter(w: number): Nurbs {
  return {
    pts: [
      [R, 0],
      [R, R],
      [0, R],
    ],
    w: [1, w, 1],
    p: 2,
    U: [0, 0, 0, 1, 1, 1],
  }
}

/** Largest |distance from centre − R| along the quarter arc, mm. */
export function radiusError(w: number) {
  let e = 0
  const c = quarter(w)
  for (let i = 0; i <= 40; i++) {
    const p = evalCurve(c, i / 40).p
    e = Math.max(e, Math.abs(Math.hypot(p[0], p[1]) - R))
  }
  return e
}

export class NurbsScene extends LessonScene<NurbsState> {
  private ghost = new THREE.Group()
  private curve = new THREE.Group()
  private marks = new THREE.Group()
  private handles: CSS2DObject[] = []
  private edits: CSS2DObject[] = []
  /** The curve before the current drag, drawn faintly so what moved is obvious. */
  private before: V2[] | null = null
  private editStart: { E: V2[]; pts: V2[] } | null = null
  /** Bumped whenever a demo tween is cancelled, so its ending doesn't land later on. */
  private demoRun = 0

  constructor(v: Viewer, emit: (s: NurbsState) => void) {
    super(v, emit, {
      step: 0,
      degree: 3,
      count: DEFAULT_COUNT,
      pts: basePoints(DEFAULT_COUNT),
      focus: null,
      showComb: false,
      combScale: 400,
      weight: 1,
      moved: 0,
      dragged: false,
      draggedLocal: false,
      tried: [3],
      single: false,
      draggedEdit: false,
      circle: false,
    })
    v.setGrid(150, 10)
    this.root.add(this.ghost, this.curve, this.marks)
  }

  enter(step: number) {
    const s = this.state
    this.stopDemo()
    const patch: Partial<NurbsState> = { step, focus: null }
    this.before = null
    if (step === 0 || step === 1) {
      // Back to the standard curve when the degree or count was changed later on.
      if (s.degree !== 3 || s.count !== DEFAULT_COUNT) Object.assign(patch, { degree: 3, count: DEFAULT_COUNT, pts: basePoints(DEFAULT_COUNT) })
      patch.showComb = false
    }
    if (step === 1) patch.focus = Math.floor(DEFAULT_COUNT / 2) - 1
    if (step === 2) Object.assign(patch, { showComb: true, combScale: 300, focus: Math.floor(s.count / 2) - 1 })
    if (step === 3) patch.showComb = false
    if (step === 4) Object.assign(patch, { showComb: false, degree: 3, count: DEFAULT_COUNT, pts: basePoints(DEFAULT_COUNT), moved: 0 })
    if (step === 5) Object.assign(patch, { showComb: true, combScale: 900 })
    this.syncHandles(patch.pts?.length ?? s.pts.length)
    this.set(patch)
    if (step === 5) this.v.setView("top", { target: new THREE.Vector3(0, 4, 0), distance: 480 })
    else this.v.setView("top", { target: new THREE.Vector3(0, step === 3 ? -6 : 0, 0), distance: 440 })
  }

  // ------------------------------------------------------------ actions

  setDegree(degree: Degree) {
    const s = this.state
    const patch: Partial<NurbsState> = { degree, tried: s.tried.includes(degree) ? s.tried : [...s.tried, degree] }
    if (s.count < degree + 1) Object.assign(patch, { count: degree + 1, pts: basePoints(degree + 1) })
    const count = patch.count ?? s.count
    if (s.focus !== null && s.focus >= count) patch.focus = Math.floor(count / 2)
    patch.single = s.single || count === degree + 1
    this.before = null
    this.syncHandles(count)
    this.set(patch)
  }

  setCount(count: number) {
    const s = this.state
    const n = Math.max(s.degree + 1, Math.min(MAX_COUNT, Math.round(count)))
    this.before = null
    this.syncHandles(n)
    this.set({ count: n, pts: basePoints(n), focus: null, single: s.single || n === s.degree + 1 })
  }

  setCombScale(combScale: number) {
    this.set({ combScale })
  }

  setWeight(w: number) {
    // Snap onto √2/2 near it: the slider can't hit an irrational number by itself.
    const weight = Math.abs(w - EXACT_W) < 0.012 ? EXACT_W : w
    this.set({ weight, circle: this.state.circle || weight === EXACT_W })
  }

  reset() {
    this.before = null
    this.set({ pts: basePoints(this.state.count), focus: null })
  }

  private stopDemo() {
    this.demoRun++
    this.v.tweens.cancel("demo")
  }

  /** Predict reveal: lift the middle control point and keep the old curve faintly. */
  demoLocal() {
    this.stopDemo()
    const run = this.demoRun
    const i = Math.floor(this.state.count / 2) - 1
    const from = copy(this.state.pts)
    this.before = copy(from)
    this.set({ focus: i })
    this.v.tweens.run(
      900,
      (k) => {
        const pts = copy(from)
        pts[i] = [from[i][0], from[i][1] + 30 * k]
        this.state.pts = pts
        this.render()
      },
      { tag: "demo" },
    ).then(() => {
      if (run !== this.demoRun) return
      const pts = copy(from)
      pts[i] = [from[i][0], from[i][1] + 30]
      this.set({ pts, focus: i })
    })
  }

  /** Predict reveal: pull the middle edit point up 20 mm. */
  demoEdit() {
    this.stopDemo()
    const run = this.demoRun
    const s = this.state
    const c = curveOf(s)
    const g = greville(c)
    const j = Math.floor(s.count / 2) - 1
    const E = g.map((u) => evalCurve(c, u).p)
    const from = copy(s.pts)
    this.before = copy(from)
    this.v.tweens.run(
      900,
      (k) => {
        const E2 = copy(E)
        E2[j] = [E[j][0], E[j][1] + 20 * k]
        this.state.pts = interpolate(c.p, c.U, g, E2)
        this.render()
      },
      { tag: "demo" },
    ).then(() => {
      if (run !== this.demoRun) return
      const E2 = copy(E)
      E2[j] = [E[j][0], E[j][1] + 20]
      const pts = interpolate(c.p, c.U, g, E2)
      this.set({ pts, moved: movedCount(from, pts) })
    })
  }

  // ------------------------------------------------------------ handles

  /** One handle per control point, and one per edit point (shown in the edit-point step). */
  private syncHandles(n: number) {
    while (this.handles.length < n) {
      const i = this.handles.length
      const h = dragHandle(this.v, {
        plane: () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
        start: () => {
          this.stopDemo()
          this.before = copy(this.state.pts)
        },
        move: (hit) => this.dragPoint(i, [clamp(hit.x, -150, 150), clamp(hit.y, -100, 100)]),
        hover: (on) => {
          if (this.state.step >= 1 && this.state.step <= 2 && on) this.set({ focus: i })
        },
      })
      this.handles.push(h)
      this.root.add(h)
    }
    while (this.handles.length > n) {
      const h = this.handles.pop()!
      this.root.remove(h)
      h.element.remove()
    }
    while (this.edits.length < n) {
      const j = this.edits.length
      const h = dragHandle(this.v, {
        plane: () => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0),
        start: () => {
          this.stopDemo()
          const c = curveOf(this.state)
          this.before = copy(this.state.pts)
          this.editStart = { E: greville(c).map((u) => evalCurve(c, u).p), pts: copy(this.state.pts) }
        },
        move: (hit) => this.dragEdit(j, [clamp(hit.x, -150, 150), clamp(hit.y, -100, 100)]),
        end: () => (this.editStart = null),
      })
      this.edits.push(h)
      this.root.add(h)
    }
    while (this.edits.length > n) {
      const h = this.edits.pop()!
      this.root.remove(h)
      h.element.remove()
    }
  }

  private dragPoint(i: number, p: V2) {
    const s = this.state
    const pts = copy(s.pts)
    pts[i] = p
    const c = curveOf({ pts, degree: s.degree })
    const local = spansInfluenced(c, i) < knotSpans(c).length
    this.set({ pts, focus: i, dragged: true, draggedLocal: s.draggedLocal || (s.step >= 1 && local) })
  }

  private dragEdit(j: number, p: V2) {
    const st = this.editStart
    if (!st) return
    const s = this.state
    const c = curveOf(s)
    const E = copy(st.E)
    E[j] = p
    const pts = interpolate(c.p, c.U, greville(c), E)
    this.set({ pts, moved: movedCount(st.pts, pts), draggedEdit: true })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.ghost)
    this.clear(this.curve)
    this.clear(this.marks)
    if (s.step === 5) {
      this.renderCircle()
      return
    }
    const c = curveOf(s)
    const smp = sampleCurve(c, s.degree === 1 ? 2 : 28)
    const muted = "border-transparent bg-transparent font-sans text-muted-foreground"

    this.curve.add(poly(s.pts, kit.construction, onTop(0.2)))
    if (this.before) this.ghost.add(thin(sampleCurve({ ...c, pts: this.before }, 28).map((q) => q.p), kit.edgeSoft, onTop(0.1)))
    this.curve.add(poly(smp.map((q) => q.p), kit.sketchDefined, onTop(0.4)))
    if (s.showComb) this.curve.add(comb(smp, s.combScale, kit, { maxTooth: 45, envelope: kit.edge }))

    // The reach of the focused point, in the accent colour.
    if (s.focus !== null && s.focus < s.count && s.step >= 1 && s.step <= 3) {
      const [a, b] = influence(c, s.focus)
      const part = sampleCurve(c, 28, a, b)
      this.curve.add(poly(part.map((q) => q.p), kit.sketch, onTop(0.8)))
      const mid = evalCurve(c, (a + b) / 2).p
      const n = spansInfluenced(c, s.focus)
      this.marks.add(label(t(`影响 ${n} 个跨度`, `Moves ${n} span${n === 1 ? "" : "s"}`), onTop(0.1)([mid[0], mid[1] - 14]), "border-primary font-sans text-primary"))
    }

    // Span boundaries: short ticks across the curve.
    const bps = breakpoints(c)
    bps.forEach((u, idx) => {
      const q = evalCurve(c, u, knotSpans(c)[Math.min(idx, knotSpans(c).length - 1)].k)
      const a: V2 = [q.p[0] + q.normal[0] * 4, q.p[1] + q.normal[1] * 4]
      const b: V2 = [q.p[0] - q.normal[0] * 4, q.p[1] - q.normal[1] * 4]
      this.marks.add(poly([a, b], kit.dimension, onTop(0.6)))
      if (s.step === 3 && bps.length <= 10) {
        const off: V2 = [q.p[0] - q.normal[0] * 11, q.p[1] - q.normal[1] * 11]
        const el = label(fmtKnot(u), onTop(0.1)(off), "border-transparent bg-transparent text-muted-foreground")
        this.marks.add(el)
      }
    })
    if (s.step === 3) {
      knotSpans(c).forEach((sp, idx) => {
        const q = evalCurve(c, (sp.a + sp.b) / 2)
        this.marks.add(label(String(idx + 1), onTop(0.1)([q.p[0] + q.normal[0] * 10, q.p[1] + q.normal[1] * 10]), "border-transparent bg-transparent font-sans text-primary"))
      })
    }

    if (s.step === 0) {
      const first = s.pts[0]
      const last = s.pts[s.count - 1]
      this.marks.add(label(t("曲线从首点开始", "The curve starts here"), onTop(0.1)([first[0] + 4, first[1] - 12]), muted))
      this.marks.add(label(t("到末点结束", "and ends here"), onTop(0.1)([last[0] - 4, last[1] - 12]), muted))
    }
    if (s.step === 2 && s.degree === 1) this.marks.add(label(t("1 阶：折线，跨度之间是尖角", "Degree 1: a polyline, sharp corners between spans"), onTop(0.1)([0, -70]), muted))

    // Edit points (Rhino: at the Greville parameters, one per control point).
    const showEdits = s.step === 4
    const g = greville(c)
    this.edits.forEach((h, j) => {
      h.visible = showEdits && j < s.count
      if (!h.visible) return
      const p = evalCurve(c, g[j]).p
      h.position.set(p[0], p[1], 1.2)
      styleHandle(h.element, "edit")
      h.element.title = t("拖动编辑点：曲线会穿过它", "Drag the edit point: the curve passes through it")
    })
    this.handles.forEach((h, i) => {
      h.visible = i < s.count
      const p = s.pts[i]
      h.position.set(p[0], p[1], 1)
      const moved = showEdits && this.before && Math.hypot(p[0] - this.before[i][0], p[1] - this.before[i][1]) > 0.3
      const isEnd = i === 0 || i === s.count - 1
      styleHandle(h.element, isEnd && s.step === 0 ? "end" : "point", s.focus === i || !!moved)
      h.element.title = t(`控制点 P${i}`, `Control point P${i}`)
    })
    this.v.invalidate()
  }

  private renderCircle() {
    const s = this.state
    const kit = this.v.kit
    const muted = "border-transparent bg-transparent font-sans text-muted-foreground"
    for (const h of [...this.handles, ...this.edits]) h.visible = false
    const c = quarter(s.weight)
    const smp = sampleCurve(c, 60)
    // The true circle, dashed, for reference.
    this.ghost.add(poly(arc([0, 0], R, 0, Math.PI * 2, 120), kit.construction, onTop(0.01)))
    this.curve.add(poly(c.pts, kit.construction, onTop(0.02)))
    this.curve.add(poly(smp.map((q) => q.p), kit.sketchDefined))
    this.curve.add(comb(smp, s.combScale, kit, { maxTooth: 45 }))
    for (const p of c.pts) this.marks.add(dotMesh(onTop(0.12)(p), 1.6, kit.modelDark))
    this.marks.add(label(`w = ${s.weight === EXACT_W ? "0.707" : s.weight.toFixed(2)}`, onTop(0.1)([R + 6, R + 6]), "border-primary text-primary"))
    this.marks.add(label("w = 1", onTop(0.1)([R + 6, -6]), muted))
    this.marks.add(label("w = 1", onTop(0.1)([-6, R + 8]), muted))
    if (s.weight === EXACT_W) {
      // The rest of Rhino's circle: three more quarters, 9 control points in all.
      const square: V2[] = [
        [R, 0],
        [R, R],
        [0, R],
        [-R, R],
        [-R, 0],
        [-R, -R],
        [0, -R],
        [R, -R],
        [R, 0],
      ]
      this.ghost.add(poly(square, kit.construction, onTop(0.02)))
      for (const q of [1, 2, 3]) {
        const rot = (p: V2): V2 => {
          const a = (q * Math.PI) / 2
          return [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)]
        }
        this.ghost.add(poly(smp.map((x) => rot(x.p)), kit.sketchThin, onTop(0.03)))
      }
      for (const p of square.slice(0, 8)) if (!(p[0] === R && p[1] >= 0) && !(p[0] === 0 && p[1] === R)) this.ghost.add(dotMesh(onTop(0.12)(p), 1.2, kit.modelDark))
      this.marks.add(label(t("整圆：2 阶 · 9 个控制点 · 4 个跨度", "Full circle: degree 2 · 9 control points · 4 spans"), onTop(0.1)([0, -R - 14]), "border-primary font-sans text-primary"))
    } else if (s.weight === 1) {
      this.marks.add(label(t("权重都是 1：一段抛物线", "All weights 1: a parabola"), onTop(0.1)([0, -R - 14]), muted))
    }
    this.v.invalidate()
  }
}

function movedCount(a: V2[], b: V2[]) {
  return a.filter((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) > 0.3).length
}

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x))

function fmtKnot(u: number) {
  if (u === 0 || u === 1) return String(u)
  return u.toFixed(2).replace(/^0/, "")
}
