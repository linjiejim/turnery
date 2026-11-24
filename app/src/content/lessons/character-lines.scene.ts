import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { edgeLine, label, line } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"

/**
 * 6.1.3 「特征线与高光」: a gently crowned panel (a car door, an appliance
 * front) with a horizontal character line. The section is built from its
 * normal angle along the arc length: a crown, plus the crease, which turns
 * the normal by `angle` either at once (hard, G0), over a small radius
 * (soft), or by an amount that dies away along the line (fading).
 *
 * The light is a long strip lamp parallel to the line, so its reflection is
 * a line too: a surface point shows the highlight when the reflected view
 * ray points at the lamp's elevation. On a crease the normal sweeps through
 * the whole crease angle in a few millimetres, so the reflection stays on
 * the line for a range of lamp positions about twice that angle wide
 * (a mirror doubles angles).
 */
export type Kind = "hard" | "soft" | "fade"
export type Where = "above" | "on" | "below" | "gap"

export type LineState = {
  step: number
  kind: Kind
  /** Crease angle (turn of the normal), degrees. */
  angle: number
  /** Crease radius, mm. */
  radius: number
  /** Lamp elevation, degrees above horizontal, seen from the panel. */
  light: number
  lightMin: number
  lightMax: number
  twoLights: boolean
  seenKinds: number
  /** Derived at the middle of the line, from the current camera. */
  where: Where
  where2: Where
  /** Lamp elevations that put the highlight on the line (from, to), degrees. */
  range: [number, number]
  /** The fading line: marker position and where the highlight ends (x, mm). */
  marker: number
  markerMoved: boolean
  fadeEnd: number | null
  /** Crease angle left where the marker is, degrees. */
  angleAtMarker: number
  orbited: boolean
  /** Step 2: the range is drawn once the guess is in. */
  showRange: boolean
}

export const PANEL = { half: 130, s: 70, zc: 90 }
/** Base tilt of the panel's normal at the line (leans back like a door's shoulder), crown radius. */
const TILT = THREE.MathUtils.degToRad(15)
const CROWN = 1 / 350
const LAMP_R = 150
const LAMP_X = -150
/** Half-width of the lamp as seen in reflection, degrees. */
const LAMP_HALF = 3
export const LOW_LIGHT = 8
export const HIGH_LIGHT = 40
const FADE_FROM = -30
const FADE_TO = 120

const KEY_POS = new THREE.Vector3(150, -760, 270)
const KEY_TARGET = new THREE.Vector3(-22, -40, 118)

/** How much of the crease angle is left at x (1 → 0) on a fading line. */
export function fadeAt(x: number, kind: Kind) {
  if (kind !== "fade") return 1
  const u = THREE.MathUtils.clamp((x - FADE_FROM) / (FADE_TO - FADE_FROM), 0, 1)
  return 1 - u * u * (3 - 2 * u)
}

/** Normal angle (radians, elevation above −Y) at arc length s. */
function theta(s: number, a: number, r: number, hard: boolean) {
  const crease = hard || r <= 0 ? (s < 0 ? -a / 2 : a / 2) : THREE.MathUtils.clamp(s / r, -a / 2, a / 2)
  return TILT + CROWN * s + crease
}

/** Arc-length samples: dense across the crease. */
function samples(a: number, r: number) {
  const zone = (r * a) / 2 + 1.5
  const out = new Set<number>()
  for (let s = -PANEL.s; s <= PANEL.s + 1e-6; s += 3) out.add(Math.round(s * 1000) / 1000)
  for (let k = -40; k <= 40; k++) out.add(Math.round(((zone * k) / 40) * 1000) / 1000)
  return [...out].sort((p, q) => p - q)
}

/** Section points (y, z) at arc lengths `ss`, integrated from the line (s = 0) outwards. */
function section(ss: number[], a: number, r: number, hard: boolean) {
  const pts = new Map<number, [number, number]>()
  pts.set(0, [0, PANEL.zc])
  const step = 0.25
  for (const dir of [1, -1]) {
    let s = 0
    let y = 0
    let z = PANEL.zc
    const targets = ss.filter((v) => v * dir > 0).sort((p, q) => dir * (p - q))
    for (const tgt of targets) {
      while (dir * (tgt - s) > 1e-9) {
        const h = Math.min(step, Math.abs(tgt - s)) * dir
        const th = theta(s + h / 2 + dir * 1e-6, a, r, hard)
        y += Math.sin(th) * h
        z += Math.cos(th) * h
        s += h
      }
      pts.set(tgt, [y, z])
    }
  }
  return pts
}

type Grid = { pos: number[]; nor: number[]; idx: number[] }

function panelGeometry(kind: Kind, angleDeg: number, radius: number) {
  const a0 = THREE.MathUtils.degToRad(angleDeg)
  const hard = kind === "hard"
  const r = hard ? 0 : radius
  const ss = samples(a0, r)
  const cols = 81
  const xs = Array.from({ length: cols }, (_, i) => -PANEL.half + (2 * PANEL.half * i) / (cols - 1))
  const secs = xs.map((x) => {
    const a = a0 * fadeAt(x, kind)
    return { a, pts: section(ss, a, r, hard) }
  })
  const pieces: number[][] = hard ? [ss.filter((s) => s <= 0), ss.filter((s) => s >= 0)] : [ss]
  const g: Grid = { pos: [], nor: [], idx: [] }
  const P = (i: number, s: number) => {
    const [y, z] = secs[i].pts.get(s)!
    return new THREE.Vector3(xs[i], y, z)
  }
  for (const [pi, piece] of pieces.entries()) {
    const start = g.pos.length / 3
    for (let i = 0; i < cols; i++) {
      for (const s of piece) {
        const p = P(i, s)
        // A hard crease: the lower piece ends just below the line, the upper starts just above.
        const sh = hard ? (pi === 0 ? Math.min(s, -1e-6) : Math.max(s, 1e-6)) : s
        const th = theta(sh, secs[i].a, r, hard)
        const ps = new THREE.Vector3(0, Math.sin(th), Math.cos(th))
        const i0 = Math.max(0, i - 1)
        const i1 = Math.min(cols - 1, i + 1)
        const px = P(i1, s).sub(P(i0, s)).divideScalar(xs[i1] - xs[i0])
        const n = new THREE.Vector3().crossVectors(px, ps).normalize()
        g.pos.push(p.x, p.y, p.z)
        g.nor.push(n.x, n.y, n.z)
      }
    }
    const rows = piece.length
    for (let i = 0; i < cols - 1; i++)
      for (let j = 0; j < rows - 1; j++) {
        const a = start + i * rows + j
        const b = start + (i + 1) * rows + j
        const c = start + (i + 1) * rows + j + 1
        const d = start + i * rows + j + 1
        g.idx.push(a, b, c, a, c, d)
      }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(g.pos, 3))
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(g.nor, 3))
  geo.setIndex(g.idx)
  const outline: THREE.Vector3[][] = [
    ss.map((s) => P(0, s)),
    ss.map((s) => P(cols - 1, s)),
    xs.map((_, i) => P(i, ss[0])),
    xs.map((_, i) => P(i, ss[ss.length - 1])),
  ]
  return { geo, outline, crease: xs.map((_, i) => P(i, 0)) }
}

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

/** Dark paint, lit by the lamp(s), with the lamp's reflection: where the reflected view ray points at a lamp's elevation. */
const FRAG = /* glsl */ `
uniform vec3 uBase;
uniform vec3 uHi;
uniform float uE1;
uniform float uE2;
uniform float uTwo;
uniform float uHalf;
varying vec3 vN;
varying vec3 vP;
float strip(vec3 r, float e) {
  float er = atan(r.z, -r.y);
  float d = abs(er - e);
  float fw = max(fwidth(er), 1e-5);
  float core = 1.0 - smoothstep(uHalf - fw, uHalf + fw, d);
  // A tight crease turns the normal so fast that its line of light is thinner than a pixel: keep a couple of pixels of it.
  float px = max(d - uHalf, 0.0) / fw;
  float thin = exp(-px * px / 3.0) * 0.85;
  float glow = exp(-pow(d / (uHalf * 3.0), 2.0)) * 0.28;
  return max(max(core, thin), glow);
}
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 v = normalize(cameraPosition - vP);
  vec3 r = reflect(-v, n);
  vec3 l1 = vec3(0.0, -cos(uE1), sin(uE1));
  float diff = max(dot(n, l1), 0.0);
  float hi = strip(r, uE1);
  if (uTwo > 0.5) {
    vec3 l2 = vec3(0.0, -cos(uE2), sin(uE2));
    diff = max(diff, max(dot(n, l2), 0.0));
    hi = max(hi, strip(r, uE2));
  }
  float sky = smoothstep(-0.25, 0.9, r.z);
  vec3 col = uBase * (0.3 + 0.6 * diff) + uHi * (0.025 + 0.14 * sky) + uHi * hi * 0.95;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`

export class LineScene extends LessonScene<LineState> {
  private panel = new THREE.Group()
  private lamps = new THREE.Group()
  private handle: CSS2DObject
  private markerHandle: CSS2DObject
  private geoKey = ""
  private mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uBase: { value: new THREE.Color() },
      uHi: { value: new THREE.Color() },
      uE1: { value: 0.5 },
      uE2: { value: 0.1 },
      uTwo: { value: 0 },
      uHalf: { value: THREE.MathUtils.degToRad(LAMP_HALF) },
    },
  })

  constructor(v: Viewer, emit: (s: LineState) => void) {
    super(v, emit, {
      step: 0,
      kind: "soft",
      angle: 16,
      radius: 6,
      light: 34,
      lightMin: 34,
      lightMax: 34,
      twoLights: false,
      seenKinds: 2,
      where: "above",
      where2: "below",
      range: [0, 0],
      marker: 0,
      markerMoved: false,
      fadeEnd: null,
      angleAtMarker: 16,
      orbited: false,
      showRange: false,
    })
    v.setGrid(200, 10)
    this.handle = this.lampHandle()
    this.markerHandle = this.markHandle()
    this.root.add(this.panel, this.lamps, this.handle, this.markerHandle)
    this.own(v.onCameraChange(() => this.onCamera()))
  }

  enter(step: number) {
    const base: Partial<LineState> = { step, twoLights: false, angle: 16, radius: 6, kind: "soft" }
    if (step === 0) Object.assign(base, { light: 34, lightMin: 34, lightMax: 34 })
    if (step === 1) Object.assign(base, { light: 22, kind: this.state.kind })
    if (step === 2) Object.assign(base, { light: 50, showRange: false })
    if (step === 3) Object.assign(base, { twoLights: true, angle: 8, radius: 6, light: HIGH_LIGHT })
    if (step === 4) Object.assign(base, { kind: "fade", angle: 18, radius: 6, light: 10, marker: -60, markerMoved: false })
    if (step === 5) Object.assign(base, { light: 22, orbited: false })
    this.update(base)
    this.v.flyTo(KEY_POS.clone(), KEY_TARGET.clone(), 900)
  }

  // ------------------------------------------------------------ actions

  setLight(light: number) {
    const s = this.state
    this.update({ light, lightMin: Math.min(s.lightMin, light), lightMax: Math.max(s.lightMax, light) })
  }

  setKind(kind: Kind) {
    this.update({ kind, seenKinds: this.state.seenKinds | (kind === "hard" ? 1 : kind === "soft" ? 2 : 4) })
  }

  setAngle(angle: number) {
    this.update({ angle })
  }

  setRadius(radius: number) {
    this.update({ radius })
  }

  resetView() {
    this.v.flyTo(KEY_POS.clone(), KEY_TARGET.clone(), 700)
  }

  private onCamera() {
    const s = this.state
    const m = this.measure(s)
    let orbited = s.orbited
    if (s.step === 5 && !orbited) {
      const d = this.v.camera.position.clone().sub(this.v.controls.target).normalize()
      if (d.angleTo(KEY_POS.clone().sub(KEY_TARGET).normalize()) > THREE.MathUtils.degToRad(20)) orbited = true
    }
    if (m.where !== s.where || m.where2 !== s.where2 || m.fadeEnd !== s.fadeEnd || Math.abs(m.range[0] - s.range[0]) > 0.5 || Math.abs(m.range[1] - s.range[1]) > 0.5 || orbited !== s.orbited)
      this.update({ orbited })
  }

  private update(patch: Partial<LineState>) {
    const next = { ...this.state, ...patch }
    this.set({ ...patch, ...this.measure(next) })
  }

  /** Where the lamp's reflection falls at the middle of the line, and how far along a fading line it reaches. */
  private measure(s: LineState) {
    const cam = this.v.camera.position
    const hard = s.kind === "hard"
    const at = (x: number, light: number, margin = LAMP_HALF) => {
      const a = THREE.MathUtils.degToRad(s.angle) * fadeAt(x, s.kind)
      const p = new THREE.Vector3(x, 0, PANEL.zc)
      const v = cam.clone().sub(p).normalize()
      const r = hard ? 0 : s.radius
      const lo = reflectEl(v, theta(-(r * a) / 2 - 1e-6, a, r, hard))
      const hi = reflectEl(v, theta((r * a) / 2 + 1e-6, a, r, hard))
      const e = light
      let where: Where
      if (e > hi + margin) where = "above"
      else if (e < lo - margin) where = "below"
      else where = hard ? "gap" : "on"
      return { where, lo, hi }
    }
    const mid = at(0, s.light)
    const second = at(0, LOW_LIGHT)
    let fadeEnd: number | null = null
    if (s.kind === "fade") {
      let seen = false
      for (let x = -PANEL.half; x <= PANEL.half; x += 1) {
        // The lamp's centre has to be inside the crease's own range: at the faded end that range closes up.
        const on = at(x, s.light, LAMP_HALF / 2).where === "on"
        if (on) seen = true
        if (seen && !on) {
          fadeEnd = x
          break
        }
      }
      if (seen && fadeEnd === null) fadeEnd = PANEL.half
    }
    return {
      where: mid.where,
      where2: second.where,
      range: [Math.round(mid.lo), Math.round(mid.hi)] as [number, number],
      fadeEnd,
      angleAtMarker: s.angle * fadeAt(s.marker, s.kind),
    }
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    const u = this.mat.uniforms
    ;(u.uBase.value as THREE.Color).copy(tk.modelDark)
    ;(u.uHi.value as THREE.Color).copy(tk.dark ? tk.ink : tk.paper)
    const lit = s.light
    u.uE1.value = THREE.MathUtils.degToRad(lit)
    u.uE2.value = THREE.MathUtils.degToRad(LOW_LIGHT)
    u.uTwo.value = s.twoLights ? 1 : 0

    const key = `${s.kind}|${s.angle}|${s.radius}`
    if (key !== this.geoKey) {
      this.geoKey = key
      this.clear(this.panel)
      const { geo, outline } = panelGeometry(s.kind, s.angle, s.radius)
      const mesh = new THREE.Mesh(geo, this.mat)
      mesh.userData = { kind: "face", feature: "panel", role: "model" }
      this.panel.add(mesh)
      for (const l of outline) this.panel.add(edgeLine(l, kit))
    }

    this.clear(this.lamps)
    this.drawLamp(lit, s.step === 3 ? t("高处的灯", "High lamp") : t("灯管", "Strip lamp"))
    if (s.twoLights) this.drawLamp(LOW_LIGHT, t("低处的灯", "Low lamp"))
    // The light's path, and (step 2) the stretch of it that puts the highlight on the line.
    const arc = (from: number, to: number) => {
      const pts: THREE.Vector3[] = []
      for (let k = 0; k <= 40; k++) pts.push(lampPos(from + ((to - from) * k) / 40, LAMP_X))
      return pts
    }
    if (s.step !== 3) this.lamps.add(line(arc(-15, 75), kit.construction))
    if (s.step === 2 && s.showRange && s.kind !== "hard") {
      const [a, b] = s.range
      this.lamps.add(line(arc(Math.max(-15, a), Math.min(75, b)), kit.sketch))
      const lb = label(t(`灯在这一段里，高光都在线上（${a}° 到 ${b}°）`, `Lamp anywhere here: highlight on the line (${a}° to ${b}°)`), lampPos(Math.min(75, b), LAMP_X), "border-primary text-primary font-sans")
      lb.center.set(-0.06, 0.5)
      this.lamps.add(lb)
    }

    this.handle.visible = s.step !== 3
    this.handle.position.copy(lampPos(s.light, LAMP_X))
    this.markerHandle.visible = s.step === 4
    this.markerHandle.position.set(s.marker, -3, PANEL.zc)
    if (s.step === 4 && s.markerMoved) {
      const lb = label(t(`折角还剩 ${s.angleAtMarker.toFixed(1)}°`, `${s.angleAtMarker.toFixed(1)}° of crease left`), new THREE.Vector3(s.marker, -3, PANEL.zc - 14), "font-sans")
      lb.center.set(0.5, 0)
      this.lamps.add(lb)
    }
    this.v.invalidate()
  }

  /** The lamp: long and parallel to the line; only its end is drawn, so it doesn't cover the panel. */
  private drawLamp(el: number, name: string) {
    const kit = this.v.kit
    const p0 = lampPos(el, LAMP_X - 16)
    const p1 = lampPos(el, LAMP_X + 16)
    this.lamps.add(line([p0, p1], kit.sketch))
    const lb = label(name, lampPos(el, LAMP_X).add(new THREE.Vector3(0, 0, 7)), "border-transparent bg-transparent font-sans text-primary")
    lb.center.set(0.5, 1)
    this.lamps.add(lb)
  }

  private lampHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-4 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("拖动灯管", "Drag the lamp")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -LAMP_X)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        const deg = THREE.MathUtils.radToDeg(Math.atan2(hit.z - PANEL.zc, -hit.y))
        this.setLight(Math.round(THREE.MathUtils.clamp(deg, -15, 75)))
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }

  private markHandle() {
    const el = document.createElement("div")
    el.className = "interactive h-5 w-2.5 rounded-xs border-2 border-primary bg-background cursor-ew-resize transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("拖到高光离开线的地方", "Drag to where the highlight leaves the line")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 3)
      const move = (ev: PointerEvent) => {
        const hit = this.v.rayOnPlane(ev, plane)
        if (!hit) return
        this.update({ marker: Math.round(THREE.MathUtils.clamp(hit.x, -PANEL.half, PANEL.half)), markerMoved: true })
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }

  revealRange() {
    this.update({ showRange: true })
  }

  /** Move the marker (keyboard / slider alternative to dragging). */
  setMarker(x: number) {
    this.update({ marker: x, markerMoved: true })
  }

  dispose() {
    super.dispose()
    this.mat.dispose()
  }
}

/** The lamp at elevation `el` (degrees), on its arc round the line, at x. */
function lampPos(el: number, x: number) {
  const a = THREE.MathUtils.degToRad(el)
  return new THREE.Vector3(x, -LAMP_R * Math.cos(a), PANEL.zc + LAMP_R * Math.sin(a))
}

/** Elevation (degrees) of the view ray reflected in a normal at elevation th. */
function reflectEl(v: THREE.Vector3, th: number) {
  const n = new THREE.Vector3(0, -Math.cos(th), Math.sin(th))
  const r = n.multiplyScalar(2 * n.dot(v)).sub(v)
  return THREE.MathUtils.radToDeg(Math.atan2(r.z, -r.y))
}
