// Measuring what the learner clicked: one face or edge (area, length,
// diameter), or two of them (shortest distance, angle, gap between parallel
// faces, distance between centres or axes).
import { getOC, measureArea, type Shape3D } from "replicad"
import { disposeInfos, edgeInfos, faceInfos, type EdgeInfo, type FaceInfo } from "./select"
import { byAgentLang, ta } from "../../lib/agent-lang"

type V3 = [number, number, number]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any

export type MeasureTarget = { kind: "face" | "edge"; hash: number; point: V3 }
/** What the agent can measure besides a face or edge: everything a feature made, or a whole part (or reference body). */
export type MeasureSpec = MeasureTarget | { kind: "feature"; id: string } | { kind: "part"; name: string }

export type MeasureResult = {
  /** One line per clicked item: what it is and its own size. `hash` is -1 for a feature or part. */
  items: { kind: "face" | "edge" | "feature" | "part"; hash: number; what: string; facts: string[] }[]
  /** Between the two items. */
  between: { name: string; value: string }[]
  /** The shortest segment between them, for a dimension line. */
  segment: [V3, V3] | null
}

/** Analytic shape of an item, enough for angles and centre distances. */
type Geom =
  | { type: "plane"; n: V3; p: V3 }
  | { type: "axis"; p: V3; d: V3; r: number; full?: boolean; edge: boolean } // cylinder face, circle edge
  | { type: "line"; p: V3; d: V3 }
  | { type: "other" }

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(...a)
const fmt = (x: number) => String(Math.round(x * 100) / 100)
const deg = (rad: number) => (rad * 180) / Math.PI
const p3 = (p: { X(): number; Y(): number; Z(): number }): V3 => [p.X(), p.Y(), p.Z()]

const FACE_KIND = () =>
  byAgentLang(
    { plane: "平面", cylinder: "圆柱面", cone: "圆锥面", sphere: "球面", torus: "环面", freeform: "自由曲面" },
    { plane: "Plane", cylinder: "Cylinder", cone: "Cone", sphere: "Sphere", torus: "Torus", freeform: "Freeform surface" },
  )
const EDGE_KIND = () => byAgentLang({ line: "直线边", circle: "圆弧边", freeform: "曲线边" }, { line: "Line edge", circle: "Arc edge", freeform: "Curve edge" })

/**
 * What `between` reports, by key, in both languages: the agent reads the name in its language (`betweenName`);
 * the checks and the viewport find a row in either (`isBetween`).
 */
const BETWEEN = {
  shortest: ["最短距离", "Shortest distance"],
  overlap: ["重叠体积", "Overlap volume"],
  planeGap: ["平行面间距", "Distance between parallel faces"],
  planeAngle: ["两面夹角", "Angle between faces"],
  centreToPlane: ["圆心到平面", "Center-to-plane distance"],
  axisPlaneAngle: ["轴线与平面夹角", "Angle between axis and plane"],
  edgePlaneAngle: ["边与平面夹角", "Angle between edge and plane"],
  edgeToPlane: ["边到平面", "Edge-to-plane distance"],
  centres: ["圆心距", "Center distance"],
  axes: ["轴线", "Axes"],
  axisGap: ["轴线间距", "Distance between axes"],
  axisAngle: ["轴线夹角", "Angle between axes"],
  parallelGap: ["平行，间距", "Parallel, distance"],
  angle: ["夹角", "Angle"],
} as const satisfies Record<string, readonly [string, string]>
export type BetweenKey = keyof typeof BETWEEN
export const betweenName = (k: BetweenKey) => ta(BETWEEN[k][0], BETWEEN[k][1])
/** Is a `between` row's name one of these, in either language? */
export const isBetween = (name: string, ...keys: BetweenKey[]) => keys.some((k) => (BETWEEN[k] as readonly string[]).includes(name))

export function measure(body: Shape3D, origins: string[], targets: MeasureTarget[]): MeasureResult | null {
  const oc: OC = getOC()
  const faces = faceInfos(body, origins)
  const edges = edgeInfos(body, faces)
  try {
    const found = targets.map((t) => (t.kind === "face" ? faces.find((f) => f.face.hashCode === t.hash) : edges.find((e) => e.edge.hashCode === t.hash)))
    if (found.some((x) => !x)) return null
    const geoms = found.map((x, i) => geomOf(oc, targets[i].kind, x!))
    const items = found.map((x, i) => describe(targets[i], x!, geoms[i]))
    if (targets.length < 2) return { items, between: [], segment: null }

    const [a, b] = found.map((x) => ("face" in x! ? x.face : (x as EdgeInfo).edge))
    const between: MeasureResult["between"] = []
    let segment: [V3, V3] | null = null
    const dss = new oc.BRepExtrema_DistShapeShape()
    try {
      dss.LoadS1(a.wrapped)
      dss.LoadS2(b.wrapped)
      dss.Perform()
      if (dss.IsDone() && dss.NbSolution() > 0) {
        const pa = dss.PointOnShape1(1)
        const pb = dss.PointOnShape2(1)
        segment = [p3(pa), p3(pb)]
        pa.delete()
        pb.delete()
        between.push({ name: betweenName("shortest"), value: `${fmt(dss.Value())} mm` })
      }
    } finally {
      dss.delete()
    }
    between.push(...relate(geoms[0], geoms[1]))
    return { items, between, segment }
  } finally {
    disposeInfos(faces, edges)
  }
}

function geomOf(oc: OC, kind: "face" | "edge", x: FaceInfo | EdgeInfo): Geom {
  if (kind === "face") {
    const f = x as FaceInfo
    if (f.kind === "plane" && f.normal) return { type: "plane", n: f.normal, p: f.center }
    if (f.kind === "cylinder") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ad: any = (f.face as any)._geomAdaptor()
      try {
        const c = ad.Cylinder()
        const ax = c.Axis()
        const g: Geom = { type: "axis", p: p3(ax.Location()), d: p3(ax.Direction()), r: c.Radius(), edge: false }
        return g
      } catch {
        return { type: "other" }
      } finally {
        ad.delete?.()
      }
    }
    return { type: "other" }
  }
  const e = x as EdgeInfo
  if (e.kind === "line" && e.dir) return { type: "line", p: e.start, d: e.dir }
  if (e.kind === "circle") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ad: any = (e.edge as any)._geomAdaptor()
    try {
      const c = ad.Circle()
      const r = c.Radius()
      return { type: "axis", p: p3(c.Location()), d: p3(c.Axis().Direction()), r, full: Math.abs(e.length - 2 * Math.PI * r) < 1e-6 * r + 1e-6, edge: true }
    } catch {
      return { type: "other" }
    } finally {
      ad.delete?.()
    }
  }
  void oc
  return { type: "other" }
}

function describe(t: MeasureTarget, x: FaceInfo | EdgeInfo, g: Geom): MeasureResult["items"][number] {
  if (t.kind === "face") {
    const f = x as FaceInfo
    const facts = [ta(`面积 ${fmt(measureArea(f.face))} mm²`, `Area ${fmt(measureArea(f.face))} mm²`)]
    if (g.type === "axis") {
      facts.unshift(ta(`直径 ⌀${fmt(2 * g.r)}（R${fmt(g.r)}）`, `Diameter ⌀${fmt(2 * g.r)} (R${fmt(g.r)})`))
      facts.push(ta(`轴线过 ${pt(onAxis(g, f.center))}，方向 ${pt(g.d)}`, `Axis through ${pt(onAxis(g, f.center))}, direction ${pt(g.d)}`))
    }
    if (g.type === "plane") facts.push(ta(`中心 ${pt(f.center)}`, `Center ${pt(f.center)}`), ta(`法向 (${g.n.map(fmt).join(", ")})`, `Normal (${g.n.map(fmt).join(", ")})`))
    return { kind: "face", hash: t.hash, what: FACE_KIND()[f.kind], facts }
  }
  const e = x as EdgeInfo
  const facts = [ta(`长 ${fmt(e.length)} mm`, `Length ${fmt(e.length)} mm`)]
  if (g.type === "axis") {
    facts.unshift(ta(`直径 ⌀${fmt(2 * g.r)}（R${fmt(g.r)}）`, `Diameter ⌀${fmt(2 * g.r)} (R${fmt(g.r)})`))
    if (!g.full) facts.push(ta(`圆心角 ${fmt(deg(e.length / g.r))}°`, `Arc angle ${fmt(deg(e.length / g.r))}°`))
    facts.push(ta(`圆心 ${pt(g.p)}，轴向 ${pt(g.d)}`, `Center ${pt(g.p)}, axis direction ${pt(g.d)}`))
  } else if (e.kind === "line") facts.push(ta(`从 ${pt(e.start)} 到 ${pt(e.end)}`, `From ${pt(e.start)} to ${pt(e.end)}`))
  else facts.push(ta(`中点 ${pt(e.mid)}`, `Midpoint ${pt(e.mid)}`))
  return { kind: "edge", hash: t.hash, what: g.type === "axis" && g.full ? ta("整圆边", "Full circle edge") : EDGE_KIND()[e.kind], facts }
}

const pt = (p: V3) => `(${p.map(fmt).join(", ")})`
/** The point on a cylinder's axis level with `c` (its location alone could be anywhere along the axis). */
function onAxis(g: { p: V3; d: V3 }, c: V3): V3 {
  const k = dot(sub(c, g.p), g.d) / dot(g.d, g.d)
  return [g.p[0] + g.d[0] * k, g.p[1] + g.d[1] * k, g.p[2] + g.d[2] * k]
}

/**
 * Where a face or edge is, as one point: a plane's centre, a cylinder's axis level with the face's
 * centre, a circle's centre, a line's midpoint (the `position` check).
 */
export function positionOf(kind: "face" | "edge", x: FaceInfo | EdgeInfo): V3 {
  const oc: OC = getOC()
  const g = geomOf(oc, kind, x)
  if (kind === "face") {
    const f = x as FaceInfo
    return g.type === "axis" ? onAxis(g, f.center) : f.center
  }
  const e = x as EdgeInfo
  return g.type === "axis" ? g.p : e.mid
}

/** Angle between two directions as lines (0–90°). */
const lineAngle = (a: V3, b: V3) => deg(Math.acos(Math.min(1, Math.abs(dot(a, b)) / (len(a) * len(b)))))

function relate(a: Geom, b: Geom): MeasureResult["between"] {
  const out: MeasureResult["between"] = []
  const dirOf = (g: Geom) => (g.type === "plane" ? g.n : g.type === "axis" || g.type === "line" ? g.d : null)
  if (a.type === "plane" && b.type === "plane") {
    const ang = lineAngle(a.n, b.n)
    if (ang < 0.01) out.push({ name: betweenName("planeGap"), value: `${fmt(Math.abs(dot(sub(b.p, a.p), a.n)))} mm` })
    else out.push({ name: betweenName("planeAngle"), value: `${fmt(180 - deg(Math.acos(Math.max(-1, Math.min(1, dot(a.n, b.n))))))}°` })
    return out
  }
  if (a.type === "plane" || b.type === "plane") {
    const [pl, o] = (a.type === "plane" ? [a, b] : [b, a]) as [Extract<Geom, { type: "plane" }>, Geom]
    if (o.type === "axis") {
      out.push({ name: betweenName("centreToPlane"), value: `${fmt(Math.abs(dot(sub(o.p, pl.p), pl.n)))} mm` })
      out.push({ name: betweenName("axisPlaneAngle"), value: `${fmt(90 - lineAngle(o.d, pl.n))}°` })
    } else if (o.type === "line") {
      const ang = 90 - lineAngle(o.d, pl.n)
      out.push({ name: betweenName("edgePlaneAngle"), value: `${fmt(ang)}°` })
      if (ang < 0.01) out.push({ name: betweenName("edgeToPlane"), value: `${fmt(Math.abs(dot(sub(o.p, pl.p), pl.n)))} mm` })
    }
    return out
  }
  if (a.type === "axis" && b.type === "axis") {
    // A cylinder's axis point is anywhere along it: only circle edges have a centre.
    const centres = a.edge && b.edge ? len(sub(a.p, b.p)) : null
    if (centres !== null) out.push({ name: betweenName("centres"), value: `${fmt(centres)} mm` })
    if (lineAngle(a.d, b.d) < 0.01) {
      const gap = len(cross(sub(b.p, a.p), a.d))
      if (gap < 1e-6) out.push({ name: betweenName("axes"), value: ta("同轴", "coaxial") })
      else if (centres === null || Math.abs(gap - centres) > 0.005) out.push({ name: betweenName("axisGap"), value: `${fmt(gap)} mm` })
    } else out.push({ name: betweenName("axisAngle"), value: `${fmt(lineAngle(a.d, b.d))}°` })
    return out
  }
  const da = dirOf(a)
  const db = dirOf(b)
  if (da && db) {
    const ang = lineAngle(da, db)
    if (ang < 0.01 && (a.type === "line" || a.type === "axis")) out.push({ name: betweenName("parallelGap"), value: `${fmt(len(cross(sub((b as { p: V3 }).p, a.p), da)) / len(da))} mm` })
    else out.push({ name: betweenName("angle"), value: `${fmt(ang)}°` })
  }
  return out
}
