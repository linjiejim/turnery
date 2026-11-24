// The half section of a revolve against its axis: does it cross the axis, and arcs that come onto
// the axis drawn so the turned face still reads back from STEP.
import { Blueprint, Blueprints, CompoundBlueprint, Curve2D, Drawing, getOC } from "replicad"

type V2 = [number, number]
type V3 = [number, number, number]
type Sketched = Blueprint | CompoundBlueprint | Blueprints

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

/**
 * Signed distance from the revolve axis (through the world origin along `axis`) in the sketch's
 * own coordinates, when the axis lies in the sketch plane; otherwise null. The plane's y is
 * normal × x, as replicad lays a drawing on it.
 */
export function axisSide(plane: { origin: V3; x: V3; normal: V3 }, axis: V3): ((p: V2) => number) | null {
  if (Math.abs(dot(axis, plane.normal)) > 1e-9 || Math.abs(dot(plane.origin, plane.normal)) > 1e-9) return null
  const y = cross(plane.normal, plane.x)
  const at: V2 = [-dot(plane.origin, plane.x), -dot(plane.origin, y)]
  const dir: V2 = [dot(axis, plane.x), dot(axis, y)]
  return (p) => dir[0] * (p[1] - at[1]) - dir[1] * (p[0] - at[0])
}

const inner = (d: Drawing) => (d as unknown as { innerShape: Sketched | null }).innerShape

function curvesOf(b: Sketched): Curve2D[] {
  return b instanceof Blueprint ? b.curves : b.blueprints.flatMap(curvesOf)
}

function mapCurves<T extends Sketched>(b: T, f: (c: Curve2D) => Curve2D): T {
  if (b instanceof Blueprint) return new Blueprint(b.curves.map(f)) as T
  if (b instanceof CompoundBlueprint) return new CompoundBlueprint(b.blueprints.map((x) => mapCurves(x, f))) as T
  return new Blueprints(b.blueprints.map((x) => mapCurves(x, f))) as T
}

/**
 * How far the profile reaches to either side of the axis: the least and most of `side` over its
 * curves. Exact, unlike the bounding box, which pokes past the axis for an arc that ends on it.
 */
export function reach(drawing: Drawing, side: (p: V2) => number): [number, number] {
  const shape = inner(drawing)
  let lo = Infinity
  let hi = -Infinity
  for (const c of shape ? curvesOf(shape) : []) {
    const [a, b] = [c.firstParameter, c.lastParameter]
    const f = (u: number) => side(c.value(u) as V2)
    const N = 32
    const us = Array.from({ length: N + 1 }, (_, i) => a + ((b - a) * i) / N)
    const fs = us.map(f)
    for (const sign of [1, -1]) {
      let k = 0
      for (let i = 1; i <= N; i++) if (sign * fs[i] > sign * fs[k]) k = i
      // The furthest sample, then golden-section search between its neighbours.
      let [l, r] = [us[Math.max(k - 1, 0)], us[Math.min(k + 1, N)]]
      const g = (Math.sqrt(5) - 1) / 2
      let m1 = r - g * (r - l)
      let m2 = l + g * (r - l)
      let [f1, f2] = [sign * f(m1), sign * f(m2)]
      for (let i = 0; i < 48; i++) {
        if (f1 < f2) {
          l = m1
          ;[m1, f1] = [m2, f2]
          m2 = l + g * (r - l)
          f2 = sign * f(m2)
        } else {
          r = m2
          ;[m2, f2] = [m1, f1]
          m1 = r - g * (r - l)
          f1 = sign * f(m1)
        }
      }
      const best = Math.max(sign * fs[k], f1, f2)
      if (sign > 0) hi = Math.max(hi, best)
      else lo = Math.min(lo, -best)
    }
  }
  return [lo, hi]
}

/**
 * The profile with every arc that comes onto the axis from a centre off it (a via point rounded to
 * 0.1 µm is enough) redrawn as the same curve in B-spline form. Turned, such an arc makes a surface
 * of revolution whose pole lies inside the generating circle's parameter range. STEP leaves out the
 * edge that closes a face at its pole, and a reader can only put it back where the generating curve
 * ends: the face came back broken and the solid inside out (a hollow ball's cavity added to its
 * volume). A B-spline ends at the pole. Arcs centred on the axis (within OpenCascade's 0.1 µm) turn
 * into spheres, which readers close by themselves, and are left alone.
 *
 * Quasi-angular: still exactly the circle, and its volume comes out right; with the usual
 * tan(θ/2) form OpenCascade's volume was 0.1–0.2 % too big.
 */
export function polesAtCurveEnds(drawing: Drawing, side: (p: V2) => number): Drawing {
  const shape = inner(drawing)
  if (!shape) return drawing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oc = getOC() as any
  let changed = false
  const out = mapCurves(shape, (c) => {
    if (c.geomType !== "CIRCLE") return c
    if (Math.abs(side(c.firstPoint as V2)) > 1e-6 && Math.abs(side(c.lastPoint as V2)) > 1e-6) return c
    const ad = c.adaptor()
    const circle = ad.Circle()
    const at = circle.Location()
    const centred = Math.abs(side([at.X(), at.Y()])) < 1e-7
    for (const x of [at, circle, ad]) x.delete()
    if (centred) return c
    changed = true
    return new Curve2D(oc.Geom2dConvert.CurveToBSplineCurve(c.wrapped, oc.Convert_ParameterisationType.Convert_QuasiAngular))
  })
  return changed ? new Drawing(out) : drawing
}
