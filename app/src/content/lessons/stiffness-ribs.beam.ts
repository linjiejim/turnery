/**
 * Simple beam theory for a moulded panel: a plate of width b and wall t, with n rectangular ribs
 * (thickness r, height h) under it, simply supported over a span L with a load F at mid-span.
 *
 *   I (along the span) = plate + ribs about their common neutral axis (parallel axis theorem)
 *   deflection δ = F·L³ / (48·E·I)          (Roark, simply supported beam, centre load)
 *   mass = ρ · volume
 *
 * Ribs running across the span add no bending stiffness along it (they are not continuous in the
 * direction of bending); they only add mass. Plate bending across its width, shear deflection,
 * local effects at the load and the draft on the ribs are all ignored: an idealisation that is good
 * for comparing designs, not for signing one off.
 */
export type Rib = { n: number; h: number; r: number; across: boolean }
export type Panel = { t: number } & Rib

/** ABS, typical values; grades differ (E roughly 2.0–2.6 GPa). */
export const MAT = { E: 2300, rho: 1.05e-3 }
/** Span, overall length, width (mm) and the load (N). */
export const GEO = { L: 150, len: 160, b: 80, F: 10 }
/** Ribs stop short of the supports by this much at each end, mm. */
export const RIB_END = 6

export function inertia(p: Panel) {
  const { b } = GEO
  const Ap = b * p.t
  const Ip = (b * p.t ** 3) / 12
  if (p.across || p.n === 0 || p.h <= 0) return { I: Ip, ybar: p.t / 2 }
  const Ar = p.n * p.r * p.h
  // Distances from the top (load) face, downwards.
  const yp = p.t / 2
  const yr = p.t + p.h / 2
  const ybar = (Ap * yp + Ar * yr) / (Ap + Ar)
  const I = Ip + Ap * (yp - ybar) ** 2 + (p.n * p.r * p.h ** 3) / 12 + Ar * (yr - ybar) ** 2
  return { I, ybar }
}

export const deflection = (p: Panel) => (GEO.F * GEO.L ** 3) / (48 * MAT.E * inertia(p).I)

export function mass(p: Panel) {
  const plate = GEO.len * GEO.b * p.t
  const ribLen = p.across ? GEO.b : GEO.L - 2 * RIB_END
  const ribs = p.n * p.r * p.h * ribLen
  return MAT.rho * (plate + ribs)
}

/** Deflection at x (mm from mid-span), positive down; the overhangs beyond the supports tip up along the end slope. */
export function deflectionAt(p: Panel, x: number) {
  const { L, F } = GEO
  const EI = MAT.E * inertia(p).I
  const a = Math.abs(x)
  if (a <= L / 2) {
    const u = L / 2 - a
    return (F * u * (3 * L * L - 4 * u * u)) / (48 * EI)
  }
  return (-(F * L * L) / (16 * EI)) * (a - L / 2)
}

/** Wall thickness a plain plate needs for a given deflection. */
export function thicknessFor(delta: number) {
  const I = (GEO.F * GEO.L ** 3) / (48 * MAT.E * delta)
  return Math.cbrt((12 * I) / GEO.b)
}

/** Largest circle that fits where a rib meets the wall (no root fillet): touches the face and both inner corners. */
export const junctionDiameter = (t: number, r: number) => (t * t + (r * r) / 4) / t

/** Moulding rules of thumb (see the lesson note for sources). */
export const RULE = { ribMax: 0.6, ribMin: 0.4, height: 3, spacing: 2 }

export function ribChecks(p: Panel) {
  const thick = p.r > RULE.ribMax * p.t + 1e-9
  const thin = p.r < RULE.ribMin * p.t - 1e-9
  const tall = p.h > RULE.height * p.t + 1e-9
  const pitch = p.n > 1 ? (GEO.b - 8) / (p.n - 1) : Infinity
  const crowded = pitch - p.r < RULE.spacing * p.t - 1e-9
  return { thick, thin, tall, crowded, ok: !thick && !thin && !tall && !crowded }
}

/** Rib centre positions across the width (y, mm), evenly spread, 4 mm in from the edges. */
export function ribYs(n: number) {
  if (n <= 0) return []
  if (n === 1) return [0]
  const span = GEO.b - 8
  return Array.from({ length: n }, (_, i) => -span / 2 + (span * i) / (n - 1))
}

/** Rib positions along the span for ribs that run across (x, mm). */
export function ribXs(n: number) {
  if (n <= 0) return []
  const span = GEO.L - 2 * RIB_END
  return Array.from({ length: n }, (_, i) => -span / 2 + (span * (i + 0.5)) / n)
}
