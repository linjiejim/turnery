import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { face, label, line } from "@/three/build"
import { lathe, type V2 } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { ease } from "@/three/tween"
import { domeCurve, restingTravel, WEB, type Curve } from "./button-feel.dome"
import { LessonScene } from "./scene"

/**
 * 6.2.3 「按键手感：力–行程曲线」: a silicone keypad key cut in half: the key, the conical web it sits
 * on, the carbon pill under it and the contacts on the board. The learner drags the key down (as a
 * test machine does, controlling travel) and the force–travel curve is drawn as it goes; the web's
 * thickness and angle change the curve. Forces come from the simplified model in button-feel.dome.ts.
 */
export type DomeState = {
  step: number
  travel: number
  thick: number
  angle: number
  /** Force recorded at each travel sample on the way down / up (NaN where not visited). */
  down: number[]
  up: number[]
  /** The current stroke has reached the contact. */
  bottomed: boolean
  pressedOnce: boolean
  releasedOnce: boolean
  stoppedAtPeak: boolean
  stuck: boolean
  sawStuck: boolean
  dragging: boolean
}

export const SAMPLES = 120
const MAT = 0.8
const KEY_R = 3.4
const KEY_H = 4.2
const STEM_R = 1.5
const PILL_H = 0.4
const PAD_T = 0.05
const OUTER = 8.5

const blank = () => new Array<number>(SAMPLES + 1).fill(NaN)

const initial = (): DomeState => ({
  step: 0,
  travel: 0,
  thick: 0.6,
  angle: 40,
  down: blank(),
  up: blank(),
  bottomed: false,
  pressedOnce: false,
  releasedOnce: false,
  stoppedAtPeak: false,
  stuck: false,
  sawStuck: false,
  dragging: false,
})

/**
 * The web's mid-line between a and b when its ends are pushed closer than its length L: it folds outwards
 * at the middle, like a collapsing skirt (each half keeps about L / 2), smoothed into a curve of n points.
 */
function foldBetween(a: V2, b: V2, L: number, side: V2, n: number): V2[] {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1])
  const mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  let nrm: V2 = [-(b[1] - a[1]) / d, (b[0] - a[0]) / d]
  if (nrm[0] * side[0] + nrm[1] * side[1] < 0) nrm = [-nrm[0], -nrm[1]]
  const h = Math.sqrt(Math.max(0, (L / 2) ** 2 - (d / 2) ** 2))
  // A quadratic curve through the knee: its control point is twice as far out.
  const ctrl: V2 = [mid[0] + nrm[0] * 2 * h, mid[1] + nrm[1] * 2 * h]
  return Array.from({ length: n }, (_, i) => {
    const u = i / (n - 1)
    const k0 = (1 - u) ** 2
    const k1 = 2 * u * (1 - u)
    const k2 = u * u
    return [k0 * a[0] + k1 * ctrl[0] + k2 * b[0], k0 * a[1] + k1 * ctrl[1] + k2 * b[1]] as V2
  })
}

export class ButtonFeelScene extends LessonScene<DomeState> {
  private key = new THREE.Group()
  private board = new THREE.Group()
  private marks = new THREE.Group()
  private handleEl: CSS2DObject
  private rubber = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, side: THREE.DoubleSide })
  private webCut = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0, side: THREE.DoubleSide })
  private cut = new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, side: THREE.DoubleSide })
  private pill = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, side: THREE.DoubleSide })
  private pcb = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
  private padOn = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, emissiveIntensity: 0.4, side: THREE.DoubleSide })
  private skin = new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 })
  private lastTravel = 0

  constructor(v: Viewer, emit: (s: DomeState) => void) {
    super(v, emit, initial())
    v.setGrid(30, 1)
    for (const m of [this.rubber, this.webCut, this.cut, this.pill, this.pcb, this.padOn, this.skin]) this.own(() => m.dispose())
    this.handleEl = this.makeHandle()
    this.root.add(this.board, this.key, this.marks, this.handleEl)
    this.root.position.z = 1.2
  }

  get curve(): Curve {
    return domeCurve({ t: this.state.thick, angle: this.state.angle })
  }

  enter(step: number) {
    this.v.tweens.cancel("press")
    const presets: [number, number][] = [
      [0.6, 40],
      [0.6, 40],
      [0.85, 40],
      [0.45, 50],
      [0.6, 40],
    ]
    const [thick, angle] = presets[Math.min(step, presets.length - 1)]
    this.set({ step, thick, angle, travel: 0, down: blank(), up: blank(), bottomed: false, stuck: false, dragging: false, stoppedAtPeak: false })
    this.lastTravel = 0
    // From the front, a little above: the cut face shows the web's section.
    const target = new THREE.Vector3(-5.5, 0, 4.4)
    this.v.flyTo(target.clone().add(new THREE.Vector3(0.25, -1, 0.36).normalize().multiplyScalar(60)), target, 800)
  }

  // ------------------------------------------------------------ actions

  /** Move the key to travel w (as a test machine would), recording the force on the way. */
  setTravel(w: number) {
    const s = this.state
    const c = this.curve
    w = Math.max(0, Math.min(c.end, w))
    const last = this.lastTravel
    let down = s.down
    let up = s.up
    let bottomed = s.bottomed
    if (w > last) {
      // Going down again from the top after a full stroke starts a new curve.
      if (bottomed && last < 0.03) {
        down = blank()
        up = blank()
        bottomed = false
      }
      if (!bottomed) {
        down = [...down]
        for (let k = Math.round((last / c.end) * SAMPLES); k <= Math.round((w / c.end) * SAMPLES); k++) down[k] = c.press((k / SAMPLES) * c.end)
      }
    } else if (w < last && bottomed) {
      up = [...up]
      for (let k = Math.round((w / c.end) * SAMPLES); k <= Math.round((last / c.end) * SAMPLES); k++) up[k] = c.ret((k / SAMPLES) * c.end)
    }
    if (w >= c.contact) bottomed = true
    this.lastTravel = w
    const patch: Partial<DomeState> = {
      travel: w,
      down,
      up,
      bottomed,
      pressedOnce: s.pressedOnce || w >= c.contact,
      releasedOnce: s.releasedOnce || (s.pressedOnce && w < 0.03),
    }
    if (s.step === 1 && Math.abs(w - c.S1) < 0.06) patch.stoppedAtPeak = true
    this.set(patch)
  }

  /** Let go: the key comes back up along the return curve, or stays down if the dome is bistable. */
  release() {
    const c = this.curve
    const from = this.state.travel
    const rest = restingTravel(c, from)
    this.set({ dragging: false })
    const stick = () => {
      if (rest > 0) this.set({ stuck: true, sawStuck: true })
    }
    if (from - rest < 1e-3) return stick()
    this.v.tweens.run(Math.max(250, (from - rest) * 500), (k) => this.setTravel(from + (rest - from) * k), { tag: "press", ease: ease.linear }).then(() => {
      if (Math.abs(this.state.travel - rest) < 1e-3) stick()
    })
  }

  /** One full press and release, slowly, so the curve draws itself. */
  pressOnce() {
    this.v.tweens.cancel("press")
    const c = this.curve
    this.lastTravel = 0
    this.set({ travel: 0, down: blank(), up: blank(), bottomed: false, stuck: false })
    this.v.tweens.run(1500, (k) => this.setTravel(c.end * k), { tag: "press", ease: ease.linear }).then(() => {
      if (this.state.travel >= c.end - 1e-3) this.release()
    })
  }

  setThick(thick: number) {
    this.resetStroke({ thick })
  }

  setAngle(angle: number) {
    this.resetStroke({ angle })
  }

  /** A changed dome: the key goes back up and the curve starts again. */
  private resetStroke(p: Partial<DomeState>) {
    this.v.tweens.cancel("press")
    this.lastTravel = 0
    this.set({ ...p, travel: 0, down: blank(), up: blank(), bottomed: false, stuck: false })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    const c = this.curve
    this.rubber.color.copy(tk.model).lerp(tk.ghost, 0.25)
    this.webCut.color.copy(tk.highlight)
    this.cut.color.copy(tk.cut)
    this.pill.color.copy(tk.modelDark)
    this.pcb.color.copy(tk.good).lerp(tk.modelDark, 0.55)
    this.padOn.color.copy(tk.warn)
    this.padOn.emissive.copy(tk.warn)
    this.skin.color.copy(tk.model).lerp(tk.modified, 0.18)
    const w = s.travel
    const closed = w >= c.contact - 1e-4

    this.buildBoard(closed)
    this.buildKey(c, w)
    this.clear(this.marks)
    const zTop = MAT + c.h0 - w + KEY_H
    this.handleEl.position.set(0, -0.2, zTop + 0.2)
    this.handleEl.visible = true
    ;(this.handleEl.element as HTMLElement).classList.toggle("cursor-grabbing", s.dragging)
    if (closed) this.marks.add(label(t("接通", "Contact"), new THREE.Vector3(-OUTER + 1, 0, -2), "border-scene-good font-sans"))
    if (s.stuck) this.marks.add(label(t("按键卡在下面，弹不回来", "The key stays down: it won't come back"), new THREE.Vector3(0, 0, zTop + 4.5), "border-destructive text-destructive font-sans"))
    // Dimension of the web angle on the cut face, in the steps that change it.
    if (s.step >= 2) {
      const foot = new THREE.Vector3(-(KEY_R + c.span), -0.05, MAT)
      this.marks.add(line([foot, foot.clone().add(new THREE.Vector3(2.6, 0, 0))], this.v.kit.construction))
      this.marks.add(label(`${s.angle}° · ${s.thick.toFixed(2)} mm`, foot.clone().add(new THREE.Vector3(-1.5, 0, -1.4)), "font-sans"))
    }
    this.v.invalidate()
  }

  /** The board: a plate and the two contact pads, cut in half like the key. */
  private buildBoard(closed: boolean) {
    this.clear(this.board)
    const kit = this.v.kit
    const plate = face(new THREE.BoxGeometry(OUTER * 2 + 4, OUTER + 2, 1.2), kit, { edges: 40 })
    plate.material = this.pcb
    plate.position.set(0, (OUTER + 2) / 2, -0.6)
    this.board.add(plate)
    const pad = lathe(
      [
        [0, 0],
        [2.4, 0],
        [2.4, PAD_T],
        [0, PAD_T],
      ],
      Math.PI,
      32,
    )
    const m = new THREE.Mesh(pad, closed ? this.padOn : kit.metal)
    this.board.add(m)
  }

  /** The rubber (mat, web, key) as one revolved half, its cut face, the carbon pill and a fingertip. */
  private buildKey(c: Curve, w: number) {
    this.clear(this.key)
    const t = this.state.thick
    const zb = MAT + c.h0 - w
    const zt = zb + KEY_H
    const pillBottom = c.contact - w + PAD_T
    const pillTop = pillBottom + PILL_H
    // Web mid-line from the key's bottom edge to the foot on the mat, folding up and out as it buckles.
    const top: V2 = [KEY_R, zb]
    const foot: V2 = [KEY_R + c.span, MAT]
    const mid = foldBetween(top, foot, WEB, [0.6, 0.8], 18)
    const offset = (sign: number) =>
      mid.map((p, i) => {
        const a = mid[Math.max(0, i - 1)]
        const b = mid[Math.min(mid.length - 1, i + 1)]
        const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
        // Left normal of the walk from the key to the foot points up and out.
        const n: V2 = [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]
        return [p[0] + (n[0] * sign * t) / 2, p[1] + (n[1] * sign * t) / 2] as V2
      })
    const lower = offset(-1)
    const upper = offset(1)
    const footIn = lower[lower.length - 1][0]
    // Counter-clockwise outline of the half section (r right, z up).
    const prof: V2[] = [
      [0, pillTop],
      [STEM_R, pillTop],
      [STEM_R, zb],
      [KEY_R - 0.01, zb],
      ...lower,
      [footIn, 0],
      [OUTER, 0],
      [OUTER, MAT],
      [Math.max(footIn + 0.3, upper[upper.length - 1][0]), MAT],
      ...[...upper].reverse(),
      [KEY_R, zt - 0.6],
      [KEY_R - 0.6, zt],
      [0, zt],
    ]
    const closed = [...prof, prof[0]]
    // The lathe turns the profile from +X towards +Y: the half behind the cut (y ≥ 0).
    const geo = lathe(closed, Math.PI, 64)
    const body = new THREE.Mesh(geo, this.rubber)
    body.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 35), this.v.kit.edgeSoft))
    this.key.add(body)
    // Cut faces on y = 0, both sides of the axis: the web in the accent colour, the rest in the cut tone.
    const webLoop: V2[] = [...lower, ...[...upper].reverse()]
    for (const sx of [1, -1]) {
      this.key.add(this.cap(prof, sx, this.cut, -0.01))
      this.key.add(this.cap(webLoop, sx, this.webCut, -0.02))
    }
    // Carbon pill.
    const pillGeo = lathe(
      [
        [0, pillBottom],
        [STEM_R - 0.1, pillBottom],
        [STEM_R - 0.1, pillTop],
        [0, pillTop],
      ],
      Math.PI,
      32,
    )
    this.key.add(new THREE.Mesh(pillGeo, this.pill))
    for (const sx of [1, -1])
      this.key.add(
        this.cap(
          [
            [0, pillBottom],
            [STEM_R - 0.1, pillBottom],
            [STEM_R - 0.1, pillTop],
            [0, pillTop],
          ],
          sx,
          this.pill,
          -0.01,
        ),
      )
    // A fingertip resting on the key.
    const tip = new THREE.Mesh(new THREE.SphereGeometry(4.4, 28, 18), this.skin)
    tip.scale.set(1, 1.15, 0.62)
    tip.position.set(0.4, 2.6, zt + 2.6)
    this.key.add(tip)
  }

  /** A flat cap of a profile on the cut plane, on the +X (sx = 1) or −X side. */
  private cap(loop: V2[], sx: number, mat: THREE.Material, y: number) {
    const shape = new THREE.Shape(loop.map(([r, z]) => new THREE.Vector2(sx * r, z)))
    const g = new THREE.ShapeGeometry(shape)
    g.rotateX(Math.PI / 2)
    const m = new THREE.Mesh(g, mat)
    m.position.y = y
    return m
  }

  private makeHandle() {
    const el = document.createElement("div")
    el.className =
      "interactive flex size-6 items-center justify-center rounded-full border-2 border-primary bg-background cursor-grab shadow-popover transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("按住往下拖", "Drag down to press")
    const arrow = document.createElement("div")
    arrow.className = "size-0 border-x-4 border-t-[6px] border-x-transparent border-t-primary"
    el.appendChild(arrow)
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      this.v.tweens.cancel("press")
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const start = this.v.rayOnPlane(e, plane)
      const w0 = this.state.travel
      if (this.state.stuck) this.set({ stuck: false })
      this.set({ dragging: true })
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit || !start) return
        this.setTravel(w0 + (start.z - hit.z))
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
        this.release()
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }
}
