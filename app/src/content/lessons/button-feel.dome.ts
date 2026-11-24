/**
 * A simplified force–travel model of a silicone rubber dome (6.2.3). Not a simulation of rubber: the
 * conical web is treated as a snap-through strut pair (a von Mises truss), whose stiffness grows with
 * wall thickness t, plus a bending spring that grows with t³, plus a stiff contact once the carbon pill
 * meets the board. That is enough to reproduce the shape of a real curve and the trends design guides
 * describe (thicker or steeper web: higher actuation force), with forces in a realistic range
 * (about 140 gf at a 40° web 0.6 mm thick). The constants were tuned for that, not measured.
 */
export type Dome = { t: number; angle: number }

/** Web length along its slope, mm. */
export const WEB = 2.0
const K_AXIAL = 2525
const K_BEND = 280
const K_CONTACT = 2500
/** The carbon pill meets the board a little past the point where the web would lie flat. */
const GAP = 1.04
/** The return stroke runs this much below the press stroke (rubber loses energy). Illustrative. */
export const HYSTERESIS = 0.15

export type Curve = {
  /** Height of the web, mm (= travel at which it would lie flat). */
  h0: number
  /** Horizontal span of the web, mm. */
  span: number
  /** Travel at contact (S2) and the end of travel, mm. */
  contact: number
  end: number
  /** Peak (actuation) force F1 and where (S1). */
  F1: number
  S1: number
  /** Force at contact, F2. */
  F2: number
  /** Lowest return force before the key is back up; ≤ 0 means it stays down. */
  minReturn: number
  /** (F1 − F2) / F1. */
  snap: number
  press: (w: number) => number
  ret: (w: number) => number
}

export function domeCurve({ t, angle }: Dome): Curve {
  const a = (angle * Math.PI) / 180
  const h0 = WEB * Math.sin(a)
  const span = WEB * Math.cos(a)
  const contact = GAP * h0
  const end = contact + 0.08
  const press = (w: number) => {
    const L = Math.hypot(span, h0 - w)
    let f = (K_AXIAL * t * (WEB - L) * (h0 - w)) / (WEB * L) + K_BEND * t ** 3 * w
    if (w > contact) f += K_CONTACT * (w - contact)
    return f
  }
  const ret = (w: number) => press(w) * (1 - HYSTERESIS)
  let F1 = 0
  let S1 = 0
  for (let w = 0; w <= contact; w += 0.002) {
    const f = press(w)
    if (f > F1) {
      F1 = f
      S1 = w
    }
  }
  let minReturn = Infinity
  for (let w = 0; w <= contact; w += 0.002) minReturn = Math.min(minReturn, ret(w))
  const F2 = press(contact)
  return { h0, span, contact, end, F1, S1, F2, minReturn, snap: (F1 - F2) / F1, press, ret }
}

/**
 * Where a key let go at travel w comes to rest: back at the top, or stuck where the return force first
 * drops to zero on the way up (a bistable dome).
 */
export function restingTravel(c: Curve, w: number) {
  for (let x = Math.min(w, c.contact); x > 0; x -= 0.002) if (c.ret(x) <= 0) return x
  return 0
}

/** Silicone Dynamics suggests about 130 g and a 50% snap ratio for most consumer keys; Diamond HMI 40–60%. */
export const SNAP_RANGE: [number, number] = [0.4, 0.6]
export const F1_RANGE: [number, number] = [120, 160]
