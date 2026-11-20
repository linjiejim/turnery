// Distances and overlaps between whole parts, solid by solid: the overlap
// diagnostics of an assembly, interference / clearance / gap checks, and
// `measure` between two parts.
//
// A vendor's board model is one compound of hundreds of solids (a 546-solid,
// 27,000-face STEP of a display board). Handed to OpenCascade whole, one
// boolean against its enclosure ran 17 minutes, and a round of checks grew the
// wasm heap to 4 GB and crashed it ("memory access out of bounds"). So both
// sides are taken apart into their solids, and exact geometry only runs where
// it can't be avoided:
// - boxes that don't meet can't touch;
// - a solid whose box stays clear of every face of the other lies wholly inside
//   it or wholly outside: one point classified tells which, and one point does
//   for a whole cluster of such boxes that meet each other;
// - what is left is booleans and distances between single solids, the
//   distances face against face, nearest boxes first, stopping at contact
//   (OpenCascade's own distance between two solids touching over an area
//   collects every contact point: 29 s for one pair).
// Past MAX_BOOLEANS booleans or MAX_MS a comparison gives up with TooComplex,
// which callers report instead of hanging the kernel.
import { getOC, measureShapeVolumeProperties, type AnyShape, type Shape3D } from "replicad"
import { closest, TOUCH } from "./proximity"
import { ta } from "../../lib/agent-lang"
import { compoundOf, solidsOf } from "./topo"

type V3 = [number, number, number]
type Box = [V3, V3]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any
/** A shape straight from OpenCascade (a piece's face or loose edge). */
type Raw = { delete(): void }

/** One comparison refuses more booleans between solids than this (each can take seconds on a detailed model)… */
export const MAX_BOOLEANS = 200
/** …and stops after this long: the kernel takes no other call meanwhile. */
export const MAX_MS = 30_000
/** Nearer than this is contact: no nearer pair of faces is looked for. */
const CONTACT = 1e-6
/**
 * Oriented boxes are grown by this (mm): OpenCascade fits them to a face's mesh points, and the exact
 * surface strays from its mesh by up to the mesh deflection (0.05 mm here).
 */
const OBB_MARGIN = 0.1
/** Two pieces with more face pairs than this are measured by OpenCascade in one go. */
const MAX_FACE_PAIRS = 400_000

/** A comparison too big to work out exactly. Callers say so (a warning, a check that couldn't be measured) instead of hanging. */
export class TooComplex extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TooComplex"
  }
}

/** What pair tests run on: one solid of a shape (or what is left beside its solids), with its box. */
export type Piece = { shape: AnyShape; box: Box; solid: boolean; owned: boolean; boundary?: Item[]; volume?: number; obb?: Obb | null }
/** A face or loose edge of a piece, with its box (and its oriented box when a distance needs it). */
type Item = { box: Box; shape: Raw; obb?: Obb | null }
/** An oriented box: centre, unit axes, half sizes. */
type Obb = { c: V3; u: [V3, V3, V3]; h: V3 }

/** Piece b wholly inside solid a, or wholly outside a and at least `lb` from it. */
type Screen = { inside: boolean; lb: number }
/** A pair of pieces whose boxes come near. `s`: how b sits against a (`flip`: how a sits against b); null when only exact geometry tells. */
type Near = { a: Piece; b: Piece; gap: number; s: Screen | null; flip: boolean }
type Closest = { d: number; segment: [V3, V3] }

/**
 * Shapes taken apart into pieces, kept for one round of comparisons (a rebuild's overlap diagnostics, one
 * run of the checks), so a part that comes up in many pairs is taken apart, boxed and classified once.
 * `dispose` frees what it made.
 */
export class Pieces {
  private byShape = new Map<AnyShape, Piece[]>()
  private screens = new Map<Piece, Map<Piece, Screen | null>>()
  /** Exact results per pair, either way round: the same two solids come up in several checks. */
  private overlaps = new PairMap<number>()
  private bounds = new PairMap<number>()
  private distances = new PairMap<Closest | null>()

  /** A lower bound on the distance between two pieces, face against face (cached). */
  bound(a: Piece, b: Piece): number {
    let v = this.bounds.get(a, b)
    if (v === undefined) this.bounds.set(a, b, (v = faceBound(a, b)))
    return v
  }

  /** Whether `overlap` has the answer already. */
  knows(a: Piece, b: Piece) {
    return this.overlaps.get(a, b) !== undefined
  }

  /** Volume two solid pieces share, by one boolean (cached). */
  overlap(a: Piece, b: Piece): number {
    let v = this.overlaps.get(a, b)
    if (v === undefined) this.overlaps.set(a, b, (v = exactOverlap(a.shape, b.shape)))
    return v
  }

  /** Shortest distance between two pieces (cached; the segment runs from a to b). */
  distance(a: Piece, b: Piece, budget: Budget): Closest | null {
    const hit = this.distances.get(a, b)
    if (hit !== undefined) return hit && this.distances.flipped(a, b) ? { d: hit.d, segment: [hit.segment[1], hit.segment[0]] } : hit
    const c = pieceClosest(a, b, budget)
    this.distances.set(a, b, c)
    return c
  }

  of(shape: AnyShape | AnyShape[]): Piece[] {
    if (Array.isArray(shape)) return shape.flatMap((s) => this.of(s))
    let got = this.byShape.get(shape)
    if (!got) this.byShape.set(shape, (got = piecesOf(shape)))
    return got
  }

  /** Pairs whose boxes come within `reach`, each with how one sits against the other where boxes and a point tell. */
  near(as: Piece[], bs: Piece[], reach: number): Near[] {
    const out: Near[] = []
    for (const a of as) {
      for (const b of bs) {
        const gap = boxGap(a.box, b.box)
        if (gap <= reach) out.push({ a, b, gap, s: null, flip: false })
      }
    }
    // The smaller box against the bigger piece's boundary first (a board's solids against their enclosure),
    // then the other way round for what that leaves open.
    const smaller = (n: Near) => extent(n.a.box) <= extent(n.b.box)
    this.settle(out, smaller)
    this.settle(
      out.filter((n) => !n.s),
      (n) => !smaller(n),
    )
    return out
  }

  /** Screens `inner` of each pair against the other one, batched per outer piece. */
  private settle(list: Near[], aInside: (n: Near) => boolean) {
    const byOuter = new Map<Piece, Near[]>()
    for (const n of list) {
      const outer = aInside(n) ? n.b : n.a
      byOuter.set(outer, [...(byOuter.get(outer) ?? []), n])
    }
    for (const [outer, group] of byOuter) {
      const row = this.fill(
        outer,
        group.map((n) => (n.a === outer ? n.b : n.a)),
      )
      for (const n of group) {
        n.s = row.get(n.a === outer ? n.b : n.a) ?? null
        n.flip = n.b === outer
      }
    }
  }

  /** How each of `bs` sits against `a` (cached). */
  private fill(a: Piece, bs: Piece[]): Map<Piece, Screen | null> {
    let row = this.screens.get(a)
    if (!row) this.screens.set(a, (row = new Map()))
    // b's box, or failing that its oriented box (a tilted part's), clear of everything on a's boundary:
    // all of it is on one side of a.
    const byBox: { b: Piece; lb: number }[] = []
    const byObb: { b: Piece; lb: number }[] = []
    const faces = boundaryOf(a)
    for (const b of bs) {
      if (row.has(b)) continue
      const apart = boxGap(a.box, b.box)
      if (apart > TOUCH) {
        row.set(b, { inside: false, lb: apart })
        continue
      }
      let lb = clearance(faces, (f) => boxGap(f.box, b.box))
      let list = byBox
      const o = lb === null ? pieceObb(b) : null
      if (o) {
        const around = obbBox(o)
        lb = clearance(faces, (f) => Math.max(boxGap(f.box, around), obbGap(itemObb(f), o)))
        list = byObb
      }
      if (lb === null) row.set(b, null)
      else if (!a.solid) row.set(b, { inside: false, lb })
      else list.push({ b, lb })
    }
    // Clear regions that meet each other are one connected region off a's boundary: one point decides for all.
    const decide = (list: { b: Piece; lb: number }[], region: (b: Piece) => Box, meet: (x: Piece, y: Piece) => boolean, point: (b: Piece) => V3) => {
      const group = list.map((_, i) => i)
      const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i])))
      const boxes = list.map((x) => region(x.b))
      const order = list.map((_, i) => i).sort((i, j) => boxes[i][0][0] - boxes[j][0][0])
      for (let x = 0; x < order.length; x++) {
        const bi = boxes[order[x]]
        for (let y = x + 1; y < order.length && boxes[order[y]][0][0] <= bi[1][0]; y++) {
          if (boxGap(bi, boxes[order[y]]) <= 0 && meet(list[order[x]].b, list[order[y]].b)) group[root(order[y])] = root(order[x])
        }
      }
      const verdict = new Map<number, boolean>()
      list.forEach(({ b, lb }, i) => {
        const r = root(i)
        if (!verdict.has(r)) verdict.set(r, insidePoint(a.shape, point(b)) !== null)
        row.set(b, verdict.get(r) ? { inside: true, lb: 0 } : { inside: false, lb })
      })
    }
    decide(byBox, (b) => b.box, () => true, (b) => centre(b.box))
    decide(byObb, (b) => obbBox(pieceObb(b)!), (x, y) => obbGap(pieceObb(x), pieceObb(y)) <= 0, (b) => pieceObb(b)!.c)
    return row
  }

  dispose() {
    for (const list of this.byShape.values()) {
      for (const p of list) {
        p.boundary?.forEach((f) => f.shape.delete())
        if (p.owned) p.shape.delete()
      }
    }
    this.byShape.clear()
    this.screens.clear()
    this.overlaps.clear()
    this.bounds.clear()
    this.distances.clear()
  }
}

/** Values per unordered pair of pieces; `flipped`: stored the other way round. */
class PairMap<T> {
  private rows = new Map<Piece, Map<Piece, T>>()
  get(a: Piece, b: Piece): T | undefined {
    return this.rows.get(a)?.has(b) ? this.rows.get(a)!.get(b) : this.rows.get(b)?.get(a)
  }
  flipped(a: Piece, b: Piece) {
    return !this.rows.get(a)?.has(b)
  }
  set(a: Piece, b: Piece, v: T) {
    if (!this.rows.has(a)) this.rows.set(a, new Map())
    this.rows.get(a)!.set(b, v)
  }
  clear() {
    this.rows.clear()
  }
}

/** Counts booleans against MAX_BOOLEANS and the clock against MAX_MS. */
class Budget {
  private booleans = 0
  private readonly until = performance.now() + MAX_MS
  /** Before each piece of exact work. */
  tick() {
    if (performance.now() > this.until) throw new TooComplex(ta(`算了 ${MAX_MS / 1000} 秒还没算完`, `still not done after ${MAX_MS / 1000} s`))
  }
  /** `n` booleans are about to run: refused up front when that is too many. */
  plan(n: number) {
    this.booleans += n
    if (this.booleans > MAX_BOOLEANS) throw new TooComplex(ta(`贴得很近、要逐对精确求交的实体有 ${this.booleans} 对（上限 ${MAX_BOOLEANS}）`, `${this.booleans} pairs of solids sit close enough to need an exact intersection each (limit ${MAX_BOOLEANS})`))
  }
}

const ENUM = (oc: OC) => oc.TopAbs_ShapeEnum
/** Sub-shapes of `kind` not inside an `avoid`, in explorer order (the caller frees them). */
function each(shape: { wrapped: unknown }, kind: string, avoid: string): Raw[] {
  const oc: OC = getOC()
  const ex = new oc.TopExp_Explorer(shape.wrapped, ENUM(oc)[kind], ENUM(oc)[avoid])
  const out: Raw[] = []
  try {
    for (; ex.More(); ex.Next()) out.push(ex.Current())
  } finally {
    ex.delete()
  }
  return out
}

/** A box around the shape, larger rather than smaller (tolerances, mesh deflection); null when empty. */
function boxOf(raw: unknown): Box | null {
  const oc: OC = getOC()
  const box = new oc.Bnd_Box()
  try {
    oc.BRepBndLib.Add(raw, box, true)
    if (box.IsVoid()) return null
    const lo = box.CornerMin()
    const hi = box.CornerMax()
    const out: Box = [
      [lo.X(), lo.Y(), lo.Z()],
      [hi.X(), hi.Y(), hi.Z()],
    ]
    lo.delete()
    hi.delete()
    return out
  } finally {
    box.delete()
  }
}

/** An oriented box around the shape (null when empty or OpenCascade can't fit one). */
function obbOf(raw: unknown): Obb | null {
  const oc: OC = getOC()
  const obb = new oc.Bnd_OBB()
  try {
    oc.BRepBndLib.AddOBB(raw, obb, true, false, true)
    if (obb.IsVoid()) return null
    obb.Enlarge(OBB_MARGIN)
    const xyz = (p: { X(): number; Y(): number; Z(): number; delete(): void }): V3 => {
      const out: V3 = [p.X(), p.Y(), p.Z()]
      p.delete()
      return out
    }
    const out: Obb = { c: xyz(obb.Center()), u: [xyz(obb.XDirection()), xyz(obb.YDirection()), xyz(obb.ZDirection())], h: [obb.XHSize(), obb.YHSize(), obb.ZHSize()] }
    return out.h.every(Number.isFinite) ? out : null
  } catch {
    return null
  } finally {
    obb.delete()
  }
}

/**
 * A lower bound on the distance between two oriented boxes: the widest gap along any of the 15 axes that
 * can separate them. Axis-aligned boxes of a tilted part are fat; these stay tight.
 */
function obbGap(a: Obb | null | undefined, b: Obb | null | undefined): number {
  if (!a || !b) return 0
  const d: V3 = [b.c[0] - a.c[0], b.c[1] - a.c[1], b.c[2] - a.c[2]]
  const dot = (x: V3, y: V3) => x[0] * y[0] + x[1] * y[1] + x[2] * y[2]
  let best = 0
  const along = (x: V3) => {
    const n = Math.hypot(x[0], x[1], x[2])
    if (n < 1e-9) return
    const l: V3 = [x[0] / n, x[1] / n, x[2] / n]
    const ra = a.h[0] * Math.abs(dot(a.u[0], l)) + a.h[1] * Math.abs(dot(a.u[1], l)) + a.h[2] * Math.abs(dot(a.u[2], l))
    const rb = b.h[0] * Math.abs(dot(b.u[0], l)) + b.h[1] * Math.abs(dot(b.u[1], l)) + b.h[2] * Math.abs(dot(b.u[2], l))
    best = Math.max(best, Math.abs(dot(d, l)) - ra - rb)
  }
  for (const u of a.u) along(u)
  for (const u of b.u) along(u)
  for (const u of a.u) for (const v of b.u) along([u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]])
  return best
}

/** The axis-aligned box around an oriented one. */
function obbBox(o: Obb): Box {
  const r = [0, 1, 2].map((k) => o.h[0] * Math.abs(o.u[0][k]) + o.h[1] * Math.abs(o.u[1][k]) + o.h[2] * Math.abs(o.u[2][k]))
  return [[o.c[0] - r[0], o.c[1] - r[1], o.c[2] - r[2]], [o.c[0] + r[0], o.c[1] + r[1], o.c[2] + r[2]]]
}

/** The smallest gap from a region to any of `items`, or null when one comes within TOUCH (or there are none). */
function clearance(items: Item[], gap: (f: Item) => number): number | null {
  let lb = Infinity
  for (const f of items) {
    const g = gap(f)
    if (g <= TOUCH) return null
    lb = Math.min(lb, g)
  }
  return Number.isFinite(lb) ? lb : null
}

const pieceObb = (p: Piece) => (p.obb === undefined ? (p.obb = obbOf(p.shape.wrapped)) : p.obb)
const itemObb = (f: Item) => (f.obb === undefined ? (f.obb = obbOf(f.shape)) : f.obb)

/** Shortest distance between two boxes (0 when they meet). */
function boxGap(a: Box, b: Box): number {
  let s = 0
  for (let k = 0; k < 3; k++) {
    const d = Math.max(a[0][k] - b[1][k], b[0][k] - a[1][k], 0)
    s += d * d
  }
  return Math.sqrt(s)
}

const centre = (b: Box): V3 => [(b[0][0] + b[1][0]) / 2, (b[0][1] + b[1][1]) / 2, (b[0][2] + b[1][2]) / 2]
const extent = (b: Box) => b[1][0] - b[0][0] + b[1][1] - b[0][1] + b[1][2] - b[0][2]

/** A shape's solids one by one; faces and edges outside any solid (an open shell in a STEP file) as one more piece. */
function piecesOf(shape: AnyShape): Piece[] {
  const oc: OC = getOC()
  const E = ENUM(oc)
  const type = (shape.wrapped as { ShapeType(): unknown }).ShapeType()
  const whole = (solid: boolean): Piece[] => {
    const box = boxOf(shape.wrapped)
    return box ? [{ shape, box, solid, owned: false }] : []
  }
  if (type === E.TopAbs_SOLID) return whole(true)
  if (type !== E.TopAbs_COMPOUND && type !== E.TopAbs_COMPSOLID) return whole(false)
  const solids = solidsOf(shape)
  if (!solids.length) return whole(false)
  const out: Piece[] = []
  for (const s of solids) {
    const box = boxOf(s.wrapped)
    if (box) out.push({ shape: s, box, solid: true, owned: true })
    else s.delete()
  }
  const loose = [...each(shape, "TopAbs_FACE", "TopAbs_SOLID"), ...each(shape, "TopAbs_EDGE", "TopAbs_FACE")]
  if (loose.length) {
    const rest = compoundOf(loose.map((x) => ({ wrapped: x })))
    loose.forEach((x) => x.delete())
    const box = boxOf(rest.wrapped)
    if (box) out.push({ shape: rest, box, solid: false, owned: true })
    else rest.delete()
  }
  return out
}

/** A piece's faces and loose edges with their boxes: where its boundary can be. */
function boundaryOf(p: Piece) {
  if (!p.boundary) {
    p.boundary = [...each(p.shape, "TopAbs_FACE", "TopAbs_SHAPE"), ...each(p.shape, "TopAbs_EDGE", "TopAbs_FACE")].flatMap((shape) => {
      const box = boxOf(shape)
      if (box) return [{ box, shape }]
      shape.delete()
      return []
    })
  }
  return p.boundary
}

const volumeOf = (p: Piece) => (p.volume ??= measureShapeVolumeProperties(p.shape as Shape3D).volume)

/** The vertex, if it lies inside the solid (OpenCascade's distance reports that as an inner solution): its position. */
function insideVertex(solid: AnyShape, vertex: unknown): V3 | null {
  const oc: OC = getOC()
  const dss = new oc.BRepExtrema_DistShapeShape()
  try {
    dss.LoadS1(solid.wrapped)
    dss.LoadS2(vertex)
    dss.Perform()
    if (!dss.IsDone() || !dss.InnerSolution() || dss.NbSolution() < 1) return null
    const p = dss.PointOnShape2(1)
    const out: V3 = [p.X(), p.Y(), p.Z()]
    p.delete()
    return out
  } finally {
    dss.delete()
  }
}

/** The point, if it lies inside the solid. */
function insidePoint(solid: AnyShape, at: V3): V3 | null {
  const oc: OC = getOC()
  const pnt = new oc.gp_Pnt(at[0], at[1], at[2])
  const make = new oc.BRepBuilderAPI_MakeVertex(pnt)
  const vertex = make.Vertex()
  try {
    return insideVertex(solid, vertex)
  } finally {
    vertex.delete()
    make.delete()
    pnt.delete()
  }
}

/** A point of piece b inside solid piece a (b may lie wholly inside a with their boundaries apart). */
function innerPoint(a: Piece, b: Piece): V3 | null {
  const [vertex, ...rest] = each(b.shape, "TopAbs_VERTEX", "TopAbs_SHAPE")
  rest.forEach((v) => v.delete())
  if (!vertex) return null
  try {
    return insideVertex(a.shape, vertex)
  } finally {
    vertex.delete()
  }
}

/** Volume two solids share, by one boolean. */
function exactOverlap(a: AnyShape, b: AnyShape): number {
  const common = (a as Shape3D).intersect(b as Shape3D, { simplify: false })
  try {
    return measureShapeVolumeProperties(common).volume
  } finally {
    common.delete()
  }
}

/** A lower bound on the distance between face i of one piece and face j of another: boxes, then oriented boxes. */
const itemGap = (f: Item, g: Item) => {
  const gap = boxGap(f.box, g.box)
  return gap > 0 ? gap : obbGap(itemObb(f), itemObb(g))
}

/** Too many face pairs to go through one by one. */
const tooMany = (fa: Item[], fb: Item[]) => !fa.length || !fb.length || fa.length * fb.length > MAX_FACE_PAIRS

/** A lower bound on the distance between two pieces' boundaries: their nearest pair of faces' boxes. */
function faceBound(a: Piece, b: Piece): number {
  const fa = boundaryOf(a)
  const fb = boundaryOf(b)
  if (tooMany(fa, fb)) return 0
  let lb = Infinity
  for (const f of fa) {
    for (const g of fb) {
      lb = Math.min(lb, itemGap(f, g))
      if (lb <= 0) return 0
    }
  }
  return lb
}

/** Shortest distance between two pieces: face against face, nearest boxes first, stopping at contact; one inside the other is 0. */
function pieceClosest(a: Piece, b: Piece, budget: Budget): Closest | null {
  const fa = boundaryOf(a)
  const fb = boundaryOf(b)
  if (tooMany(fa, fb)) {
    budget.tick()
    return closest(a.shape, b.shape)
  }
  const pairs: [number, number, number][] = []
  for (let i = 0; i < fa.length; i++) for (let j = 0; j < fb.length; j++) pairs.push([itemGap(fa[i], fb[j]), i, j])
  pairs.sort((x, y) => x[0] - y[0])
  let best: Closest | null = null
  for (const [lb, i, j] of pairs) {
    if (best && (lb >= best.d || best.d <= CONTACT)) break
    budget.tick()
    const c = closest({ wrapped: fa[i].shape } as unknown as AnyShape, { wrapped: fb[j].shape } as unknown as AnyShape)
    if (c && (!best || c.d < best.d)) best = c
  }
  if (best && best.d <= CONTACT) return best
  // Boundaries apart: one may still lie wholly inside the other.
  const inner = (a.solid && innerPoint(a, b)) || (b.solid && innerPoint(b, a))
  return inner ? { d: 0, segment: [inner, inner] } : best
}

/** Volume the solids of one side share with those of the other, summed pair by pair. */
export function overlapOf(as: Piece[], bs: Piece[], pieces: Pieces, budget = new Budget()): number {
  let volume = 0
  const exact: Near[] = []
  for (const n of pieces.near(as.filter((p) => p.solid), bs.filter((p) => p.solid), 0)) {
    if (n.s) {
      if (n.s.inside) volume += volumeOf(n.flip ? n.a : n.b)
    } else if (pieces.bound(n.a, n.b) > TOUCH) {
      // No two faces come near: the boundaries don't cross, so one is wholly inside the other or they are apart.
      budget.tick()
      if (innerPoint(n.a, n.b)) volume += volumeOf(n.b)
      else if (innerPoint(n.b, n.a)) volume += volumeOf(n.a)
    } else exact.push(n)
  }
  budget.plan(exact.filter((n) => !pieces.knows(n.a, n.b)).length)
  for (const n of exact) {
    budget.tick()
    volume += pieces.overlap(n.a, n.b)
  }
  return volume
}

type Candidate = { a: Piece; b: Piece; lb: number; inside: boolean; refined: boolean }

/** A binary min-heap of candidates by their bound. */
class Heap {
  private items: Candidate[]
  /** `sorted`: already in order (a sorted array is a heap). */
  constructor(sorted: Candidate[]) {
    this.items = sorted
  }
  push(c: Candidate) {
    const h = this.items
    h.push(c)
    for (let i = h.length - 1; i > 0; ) {
      const up = (i - 1) >> 1
      if (h[up].lb <= h[i].lb) break
      ;[h[up], h[i]] = [h[i], h[up]]
      i = up
    }
  }
  pop(): Candidate | undefined {
    const h = this.items
    const top = h[0]
    const last = h.pop()
    if (h.length && last) {
      h[0] = last
      for (let i = 0; ; ) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < h.length && h[l].lb < h[m].lb) m = l
        if (r < h.length && h[r].lb < h[m].lb) m = r
        if (m === i) break
        ;[h[m], h[i]] = [h[i], h[m]]
        i = m
      }
    }
    return top
  }
}

/** Shortest distance between two sides and where: piece against piece, nearest first, stopping once no pair can be nearer. */
export function closestOf(as: Piece[], bs: Piece[], pieces: Pieces, budget = new Budget()): Closest | null {
  const settled = new Map<Piece, Map<Piece, Near>>()
  for (const n of pieces.near(as, bs, TOUCH)) {
    if (!settled.has(n.a)) settled.set(n.a, new Map())
    settled.get(n.a)!.set(n.b, n)
  }
  const pairs: Candidate[] = []
  for (const a of as) {
    for (const b of bs) {
      const n = settled.get(a)?.get(b)
      const lb = n?.s ? n.s.lb : boxGap(a.box, b.box)
      // Boxes that meet tell nothing; oriented ones may (a tilted part's axis-aligned boxes are fat).
      pairs.push({ a, b, lb: lb > 0 || n?.s?.inside ? lb : obbGap(pieceObb(a), pieceObb(b)), inside: !!n?.s?.inside, refined: !!n?.s })
    }
  }
  // Nearest bound first (a sorted array is a heap); a pair whose bound only says "may touch" is first
  // bounded face against face and put back, so pairs that clearly don't touch never get exact geometry.
  const heap = new Heap(pairs.sort((x, y) => x.lb - y.lb))
  let best: Closest | null = null
  for (let p = heap.pop(); p; p = heap.pop()) {
    if (best && (p.lb >= best.d || best.d <= CONTACT)) break
    budget.tick()
    if (!p.refined) {
      p.refined = true
      const lb = pieces.bound(p.a, p.b)
      if (lb > p.lb) {
        p.lb = lb
        heap.push(p)
        continue
      }
    }
    // One wholly inside the other: a vertex of the inner one is where they meet.
    const inner = p.inside ? innerPoint(p.a, p.b) ?? innerPoint(p.b, p.a) : null
    const c = inner ? { d: 0, segment: [inner, inner] as [V3, V3] } : pieces.distance(p.a, p.b, budget)
    if (c && (!best || c.d < best.d)) best = c
  }
  return best
}

/** Runs `work` with `pieces`, or with pieces of its own freed afterwards. */
function withPieces<T>(pieces: Pieces | undefined, work: (p: Pieces) => T): T {
  const own = pieces ?? new Pieces()
  try {
    return work(own)
  } finally {
    if (!pieces) own.dispose()
  }
}

/**
 * Volume two shapes' solids share (0 when they only touch). A side may be several shapes (the other parts
 * of an assembly). Throws TooComplex when that is too much to work out.
 */
export function overlapVolume(a: AnyShape | AnyShape[], b: AnyShape | AnyShape[], pieces?: Pieces): number {
  return withPieces(pieces, (p) => overlapOf(p.of(a), p.of(b), p))
}

/** Distance, and the overlap when they touch and both are solids (only then: it costs booleans). Throws TooComplex when too big. */
export function relation(a: AnyShape | AnyShape[], b: AnyShape | AnyShape[], solids: boolean, pieces?: Pieces): { d: number; overlap: number; segment: [V3, V3] | null } {
  return withPieces(pieces, (p) => {
    const [as, bs] = [p.of(a), p.of(b)]
    const budget = new Budget()
    const c = closestOf(as, bs, p, budget)
    const d = c?.d ?? 0
    const overlap = solids && d <= TOUCH ? overlapOf(as, bs, p, budget) : 0
    return { d, overlap, segment: c?.segment ?? null }
  })
}
