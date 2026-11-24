/**
 * Body dimensions used by the 6.2.x ergonomics lessons, and the normal-distribution maths behind them.
 *
 * Source: ANSUR II, the 2012 anthropometric survey of U.S. Army personnel (public working database:
 * 1986 women, 4082 men). Means and standard deviations in mm, read from the summary-statistics pages of
 * Gordon, C. C. et al., "2012 Anthropometric Survey of U.S. Army Personnel: Methods and Summary
 * Statistics", NATICK/TR-15/007 (2014). It is a soldier population, not Chinese adults: for Chinese users
 * the reference is GB/T 10000-2023 《中国成年人人体尺寸》 (ages 18–70, P1–P99), whose tables the lessons do
 * not reproduce. The lessons treat each dimension as normally distributed (the report's skewness is
 * within ±0.2 for the ones used here), so P5 = mean − 1.645 SD and P95 = mean + 1.645 SD.
 */
export type Group = "f" | "m"
export type Stat = { mean: number; sd: number }

export const ANSUR: Record<string, Record<Group, Stat>> = {
  /** (42) Hand breadth across metacarpals II–V. Report P5/P50/P95: women 72/78/85, men 81/88/96. */
  handBreadth: { f: { mean: 78.2, sd: 3.8 }, m: { mean: 88.3, sd: 4.4 } },
  /** (44) Hand length, wrist crease to middle fingertip. */
  handLength: { f: { mean: 181.1, sd: 10.1 }, m: { mean: 193.3, sd: 9.9 } },
  /** (34) Eye height, sitting (from the seat). */
  eyeSitting: { f: { mean: 747.7, sd: 30.4 }, m: { mean: 804.5, sd: 33.2 } },
  /** (D2) Acromial (shoulder) height, sitting. */
  shoulderSitting: { f: { mean: 563.2, sd: 27.8 }, m: { mean: 602.8, sd: 30.8 } },
  /** (3) Acromion–radiale length (upper arm). */
  upperArm: { f: { mean: 311.2, sd: 17.2 }, m: { mean: 335.2, sd: 17.5 } },
  /** (40) Forearm–hand length: elbow to middle fingertip, elbow at 90°. */
  forearmHand: { f: { mean: 439.9, sd: 23.4 }, m: { mean: 480.2, sd: 23.3 } },
  /** (D4) Arm length: acromion to middle fingertip, arm straight. */
  armLength: { f: { mean: 722.0, sd: 37.3 }, m: { mean: 786.5, sd: 38.9 } },
  /** (33) Elbow rest height, sitting. */
  elbowRest: { f: { mean: 232.4, sd: 26.3 }, m: { mean: 245.0, sd: 28.7 } },
  /** (66) Popliteal height. */
  popliteal: { f: { mean: 388.2, sd: 23.6 }, m: { mean: 429.8, sd: 24.8 } },
  /** (19) Buttock–knee length. */
  buttockKnee: { f: { mean: 590.6, sd: 32.6 }, m: { mean: 618.0, sd: 30.6 } },
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26, error < 1.5e-7). */
export function phi(z: number) {
  const x = Math.abs(z) / Math.SQRT2
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2
}

/** z for a cumulative share p (0–1), by bisection on phi. */
export function zOf(p: number) {
  let lo = -6
  let hi = 6
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (phi(mid) < p) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** The value at percentile `pct` (1–99). */
export const atPct = (s: Stat, pct: number) => s.mean + zOf(pct / 100) * s.sd
/** The share (0–1) of people at or below `x`. */
export const shareBelow = (s: Stat, x: number) => phi((x - s.mean) / s.sd)
/** Probability density at x. */
export const density = (s: Stat, x: number) => Math.exp(-0.5 * ((x - s.mean) / s.sd) ** 2) / (s.sd * Math.sqrt(2 * Math.PI))
/** The percentile (1–99, rounded) that `x` sits at. */
export const pctOf = (s: Stat, x: number) => Math.max(1, Math.min(99, Math.round(shareBelow(s, x) * 100)))

/** "P5" style percentile label. */
export const pLabel = (pct: number) => `P${pct}`
