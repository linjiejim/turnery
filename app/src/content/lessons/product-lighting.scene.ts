import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { label, line } from "@/three/build"
import { lathe, type V2 } from "@/three/geom"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { CMF, Studio, type Softbox } from "./materials-finishes.studio"

/**
 * 6.4.2 「产品摄影的灯光」: a small speaker on a paper sweep. Three spot lights (key, fill, rim)
 * sit on a sphere around the product and are dragged by their handles; the viewer's own
 * headlights are switched off so these are the only lights, with a dim studio environment for
 * the reflections in the glossy cap and the metal ring. The camera is a real lens: changing the
 * focal length moves the camera too (a dolly zoom), so the product stays the same size and only
 * the perspective changes.
 */
export type LightName = "key" | "fill" | "rim"
/** Azimuth (world, degrees from +X), elevation (degrees) and intensity (0 … 100). */
export type Lamp = { az: number; el: number; i: number }

export type LightingState = {
  step: number
  key: Lamp
  fill: Lamp
  rim: Lamp
  /** Studio environment rotation, degrees. */
  envRot: number
  envTurned: number
  /** Full-frame equivalent focal length, mm. */
  focal: number
  triedWide: boolean
  triedLong: boolean
  dragged: LightName | null
  /** Frame height at the product, mm: taller in a narrow view so the lights stay in it. */
  frame: number
}

/** Where the camera stands: in front (−Y), a little above. */
export const CAM_AZ = -90
const CAM_EL = 13
const C = new THREE.Vector3(0, 0, 46)
const R_LAMP = 110
/** Height of the frame at the product, mm: the product (92 mm) fills under half of it, leaving the lights in view. */
const FRAME = 230
/** Where the camera looks: a little above the product's middle, for headroom. */
const LOOK = C.clone().add(new THREE.Vector3(0, 0, 14))
const MAX_INTENSITY = 11
/** The studio around the set, seen only in reflections: a wide box behind (it shows in the cap from the camera), two strips. */
const BOXES: Softbox[] = [
  { az: 90, el: 30, w: 6, h: 2.4, i: 6 },
  { az: 205, el: 18, w: 1.2, h: 7, i: 4 },
  { az: 335, el: 24, w: 1.2, h: 7, i: 3 },
]

const wrap = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180
/** Azimuth seen from the camera: 0 is the camera's side, ±180 behind the product; positive is to the camera's right. */
export const rel = (l: Lamp) => wrap(l.az - CAM_AZ)

export function keyOk(s: LightingState) {
  const r = Math.abs(rel(s.key))
  return r >= 25 && r <= 80 && s.key.el >= 20 && s.key.el <= 60 && s.key.i >= 40
}
export function fillRatio(s: LightingState) {
  return s.fill.i > 0 ? s.key.i / s.fill.i : Infinity
}
export function fillOk(s: LightingState) {
  const r = rel(s.fill)
  const k = rel(s.key)
  const ratio = fillRatio(s)
  return Math.sign(r) !== Math.sign(k) && Math.abs(r) >= 10 && Math.abs(r) <= 100 && s.fill.el <= 50 && ratio >= 2 && ratio <= 4.01
}
export function rimOk(s: LightingState) {
  return Math.abs(rel(s.rim)) >= 120 && s.rim.el >= 10 && s.rim.el <= 65 && s.rim.i >= 50
}
/** The key light comes from (nearly) where the camera is: no shadow side, no form. */
export function flat(s: LightingState) {
  const a = dirOf(s.key).angleTo(dirOf({ az: CAM_AZ, el: CAM_EL, i: 0 }))
  return THREE.MathUtils.radToDeg(a) < 22 || (s.fill.i >= 0.8 * s.key.i && s.fill.i > 0)
}

function dirOf(l: Lamp) {
  const az = THREE.MathUtils.degToRad(l.az)
  const el = THREE.MathUtils.degToRad(l.el)
  return new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el))
}

/** Vertical field of view for a full-frame (36 × 24 mm) lens. */
export function vfov(focal: number) {
  return THREE.MathUtils.radToDeg(2 * Math.atan(12 / focal))
}

/** Camera distance that keeps the frame height at the product constant. */
export function shotDistance(focal: number, frame = FRAME) {
  return frame / 2 / Math.tan(THREE.MathUtils.degToRad(vfov(focal) / 2))
}

export const START: Pick<LightingState, LightName> = {
  key: { az: CAM_AZ + 4, el: 7, i: 70 },
  fill: { az: CAM_AZ - 50, el: 12, i: 0 },
  rim: { az: CAM_AZ + 160, el: 35, i: 0 },
}
const GOOD_KEY: Lamp = { az: CAM_AZ + 50, el: 38, i: 80 }
const GOOD_FILL: Lamp = { az: CAM_AZ - 50, el: 15, i: 27 }

/** The speaker: a rounded body, a thin metal ring and a glossy cap, revolved about Z. */
function speakerProfiles() {
  const body: V2[] = [[0, 0], [32, 0]]
  for (let i = 0; i <= 6; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / 6)
    body.push([33 + Math.cos(a) * 3, 3 + Math.sin(a) * 3])
  }
  body.push([36, 72])
  for (let i = 1; i <= 14; i++) {
    const a = (Math.PI / 2) * (i / 14)
    body.push([24 + Math.cos(a) * 12, 72 + Math.sin(a) * 16])
  }
  const ring: V2[] = [[24, 87.6], [24.4, 88.4], [24.4, 89.4], [23.6, 89.8], [22.2, 89.8], [22.2, 88.6]]
  const cap: V2[] = [[22.2, 88.4], [22.2, 89.3]]
  for (let i = 1; i <= 10; i++) {
    const r = 22.2 * (1 - i / 10)
    cap.push([r, 89.3 + 1.4 * (1 - (r / 22.2) ** 2)])
  }
  return { body, ring, cap }
}

/** The sweep: a floor that curves up into a back wall, along X. */
function sweep() {
  const prof: [number, number][] = [[-1200, 0], [260, 0]]
  const R = 260
  for (let i = 1; i <= 20; i++) {
    const a = -Math.PI / 2 + (Math.PI / 2) * (i / 20)
    prof.push([260 + Math.cos(a) * R + 0, R + Math.sin(a) * R])
  }
  prof.push([520, 1300])
  const xs = [-1600, 1600]
  const pos: number[] = []
  const idx: number[] = []
  for (const [y, z] of prof) for (const x of xs) pos.push(x, y, z)
  for (let i = 0; i < prof.length - 1; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const NAMES: Record<LightName, () => string> = {
  key: () => t("主光", "Key"),
  fill: () => t("辅光", "Fill"),
  rim: () => t("轮廓光", "Rim"),
}

export class LightingScene extends LessonScene<LightingState> {
  private studio: Studio
  private stage = new THREE.Group()
  private guides = new THREE.Group()
  private lamps: Record<LightName, THREE.SpotLight>
  private handles: Record<LightName, CSS2DObject>
  private mats = {
    // Knit fabric over the body, like many small speakers: sheen makes back-lit edges glow.
    body: new THREE.MeshPhysicalMaterial({ roughness: 0.75, metalness: 0, sheen: 1, sheenRoughness: 0.45 }),
    cap: new THREE.MeshPhysicalMaterial({ roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03 }),
    ring: new THREE.MeshPhysicalMaterial({ roughness: 0.22, metalness: 1 }),
    paper: new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }),
  }
  private saved: { fov: number; shadows: boolean; type: THREE.ShadowMapType }

  constructor(v: Viewer, emit: (s: LightingState) => void) {
    super(v, emit, {
      step: 0,
      ...structuredClone(START),
      envRot: 0,
      envTurned: 0,
      focal: 50,
      triedWide: false,
      triedLong: false,
      dragged: null,
      frame: FRAME,
    })
    v.setGrid(120, 10)
    v.showGrid(false)
    this.saved = { fov: v.camera.fov, shadows: v.renderer.shadowMap.enabled, type: v.renderer.shadowMap.type }
    v.renderer.shadowMap.enabled = true
    v.renderer.shadowMap.type = THREE.PCFShadowMap
    this.studio = new Studio(v, BOXES, { intensity: 0.35, headlights: 0, room: [0.05, 0.06, 0.08] })

    this.mats.body.color.copy(CMF.graphite)
    this.mats.body.sheenColor.copy(CMF.graphite).multiplyScalar(1.6)
    this.mats.cap.color.copy(CMF.plastic)
    this.mats.ring.color.copy(CMF.alu)
    this.mats.paper.color.setScalar(0.07)
    const { body, ring, cap } = speakerProfiles()
    for (const [prof, mat] of [
      [body, this.mats.body],
      [ring, this.mats.ring],
      [cap, this.mats.cap],
    ] as const) {
      const m = new THREE.Mesh(lathe(prof, Math.PI * 2, 96), mat)
      m.castShadow = true
      m.receiveShadow = true
      this.stage.add(m)
    }
    const paper = new THREE.Mesh(sweep(), this.mats.paper)
    paper.receiveShadow = true
    paper.raycast = () => {}
    this.stage.add(paper)

    const mk = () => {
      const s = new THREE.SpotLight(undefined, 0, 0, THREE.MathUtils.degToRad(40), 0.8, 0)
      s.castShadow = true
      s.shadow.mapSize.set(512, 512)
      s.shadow.bias = -0.0004
      s.shadow.normalBias = 0.4
      s.shadow.radius = 4
      s.shadow.camera.near = 20
      s.shadow.camera.far = 1200
      s.target.position.copy(C)
      this.stage.add(s, s.target)
      return s
    }
    this.lamps = { key: mk(), fill: mk(), rim: mk() }
    // The fill's shadow would fall where the key's light is; a real fill is soft enough not to show one.
    this.lamps.fill.castShadow = false
    // The rim is flagged off the floor in front, as on a real set: its light fades out past the product.
    this.lamps.rim.distance = R_LAMP + 110
    this.handles = { key: this.handle("key"), fill: this.handle("fill"), rim: this.handle("rim") }
    this.root.add(this.stage, this.guides, ...Object.values(this.handles))
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("focal")
    const patch: Partial<LightingState> = { step }
    if (step === 0 || step === 5) Object.assign(patch, structuredClone(START), { envRot: 0, focal: 50 })
    if (step >= 1 && step <= 4) {
      if (!keyOk(s)) patch.key = { ...GOOD_KEY }
      if (step === 1) patch.fill = { ...START.fill, az: rel(patch.key ?? s.key) > 0 ? CAM_AZ - 50 : CAM_AZ + 50 }
      else if (!fillOk({ ...s, ...patch })) patch.fill = { ...GOOD_FILL, az: rel(patch.key ?? s.key) > 0 ? CAM_AZ - 50 : CAM_AZ + 50 }
      if (step === 2) patch.rim = { ...START.rim }
      if (step >= 3 && !rimOk(s)) patch.rim = { az: CAM_AZ + 150, el: 25, i: 90 }
      if (step !== 4) patch.focal = 50
    }
    this.set(patch)
    this.shot(true)
  }

  // ------------------------------------------------------------ actions

  setIntensity(name: LightName, i: number) {
    this.set({ [name]: { ...this.state[name], i } } as Partial<LightingState>)
  }

  setEnvRot(envRot: number) {
    this.set({ envRot, envTurned: Math.max(this.state.envTurned, Math.abs(wrap(envRot))) })
  }

  setFocal(focal: number) {
    this.set({ focal, triedWide: this.state.triedWide || focal <= 28, triedLong: this.state.triedLong || focal >= 85 })
    this.shot(false)
  }

  /** Predict-then-reveal: from a wide lens to a long one, keeping the product the same size. */
  dollyZoom(from = 24, to = 135) {
    // Shown, not done: the task still asks the learner to try both ends themselves.
    this.v.tweens.run(
      1600,
      (k) => {
        this.set({ focal: Math.round(from * Math.pow(to / from, k)) })
        this.shot(false)
      },
      { tag: "focal" },
    )
  }

  /** Make the fill as bright as the key, on the other side (the flat look, on purpose). */
  matchFill() {
    const s = this.state
    this.set({ fill: { ...s.fill, i: s.key.i } })
  }

  /** Back to the camera position (the controls may have moved it). */
  shot(animate = false) {
    const v = this.v
    v.camera.fov = vfov(this.state.focal)
    v.camera.updateProjectionMatrix()
    const frame = Math.round(Math.max(FRAME, (2 * (R_LAMP + 25)) / Math.max(0.3, v.camera.aspect)))
    if (frame !== this.state.frame) this.set({ frame })
    const az = THREE.MathUtils.degToRad(CAM_AZ)
    const el = THREE.MathUtils.degToRad(this.state.step === 3 ? 30 : CAM_EL)
    const pos = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)).multiplyScalar(shotDistance(this.state.focal, frame)).add(LOOK)
    if (animate) {
      v.flyTo(pos, LOOK.clone(), 800)
      return
    }
    v.tweens.cancel("camera")
    v.camera.position.copy(pos)
    v.controls.target.copy(LOOK)
    v.camera.lookAt(LOOK)
    v.invalidate()
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.guides)
    this.studio.setRotation(THREE.MathUtils.degToRad(s.envRot))
    for (const name of ["key", "fill", "rim"] as LightName[]) {
      const l = s[name]
      const p = dirOf(l).multiplyScalar(R_LAMP).add(C)
      const lamp = this.lamps[name]
      lamp.position.copy(p)
      lamp.intensity = (l.i / 100) * MAX_INTENSITY
      lamp.visible = l.i > 0
      const h = this.handles[name]
      h.position.copy(p)
      h.element.style.opacity = l.i > 0 ? "1" : "0.55"
      if (s.dragged === name) this.guides.add(line([p, C.clone()], kit.construction))
    }
    // Where each light should go, on the sphere (dashed outlines).
    const showKey = s.step === 0 || s.step === 5
    const showFill = s.step === 1
    const showRim = s.step === 2 || s.step === 5
    if (showKey) {
      this.zone(25, 80, 20, 60, t("主光区", "Key zone"))
      this.zone(-80, -25, 20, 60)
    }
    if (showFill) {
      const side = rel(s.key) > 0 ? -1 : 1
      this.zone(side > 0 ? 10 : -100, side > 0 ? 100 : -10, 0, 50, t("辅光区", "Fill zone"))
    }
    if (showRim) this.zone(120, 240, 10, 65, t("轮廓光区", "Rim zone"))
    this.v.invalidate()
  }

  /** A patch of the light sphere between two camera-relative azimuths and two elevations, outlined. */
  private zone(a0: number, a1: number, e0: number, e1: number, text?: string) {
    const kit = this.v.kit
    const P = (a: number, e: number) => dirOf({ az: a + CAM_AZ, el: e, i: 0 }).multiplyScalar(R_LAMP).add(C)
    const pts: THREE.Vector3[] = []
    const n = 24
    for (let i = 0; i <= n; i++) pts.push(P(a0 + ((a1 - a0) * i) / n, e0))
    for (let i = 0; i <= n; i++) pts.push(P(a1, e0 + ((e1 - e0) * i) / n))
    for (let i = 0; i <= n; i++) pts.push(P(a1 - ((a1 - a0) * i) / n, e1))
    for (let i = 0; i <= n; i++) pts.push(P(a0, e1 - ((e1 - e0) * i) / n))
    this.guides.add(line(pts, kit.construction))
    if (text) this.guides.add(label(text, P((a0 + a1) / 2, e1 - 6), "border-transparent bg-transparent font-sans text-muted-foreground"))
  }

  /** A draggable light handle: moving it slides the light over the sphere around the product. */
  private handle(name: LightName) {
    const el = document.createElement("div")
    el.className = "interactive flex cursor-grab items-center gap-1 rounded-full border border-primary bg-background py-0.5 pl-1 pr-2 text-caption text-foreground shadow-popover select-none"
    const dot = document.createElement("span")
    dot.className = "size-2.5 rounded-full bg-primary"
    const txt = document.createElement("span")
    txt.textContent = NAMES[name]()
    el.append(dot, txt)
    el.title = t("拖动这盏灯", "Drag this light")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      this.set({ dragged: name })
      const move = (ev: PointerEvent) => {
        const p = this.onSphere(ev, dirOf(this.state[name]).multiplyScalar(R_LAMP).add(C))
        const d = p.sub(C).normalize()
        const az = THREE.MathUtils.radToDeg(Math.atan2(d.y, d.x))
        const elv = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(d.z, -1, 1))), -4, 85)
        this.set({ [name]: { ...this.state[name], az: Math.round(az), el: Math.round(elv) } } as Partial<LightingState>)
      }
      const up = () => {
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        el.removeEventListener("pointercancel", up)
        this.v.controls.enabled = true
        this.set({ dragged: null })
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
      el.addEventListener("pointercancel", up)
    })
    return o
  }

  /** The point of the light sphere under the pointer nearest to where the light is (front or back side). */
  private onSphere(ev: PointerEvent, current: THREE.Vector3) {
    const ray = this.v.ray(ev)
    const o = ray.origin.clone().sub(C)
    const b = o.dot(ray.direction)
    const c = o.lengthSq() - R_LAMP * R_LAMP
    const disc = b * b - c
    if (disc < 0) {
      // Missed the sphere: the closest point on the ray, pushed out onto it.
      const p = ray.origin.clone().addScaledVector(ray.direction, -b).sub(C)
      return p.setLength(R_LAMP).add(C)
    }
    const hits = [-b - Math.sqrt(disc), -b + Math.sqrt(disc)].filter((x) => x > 0).map((x) => ray.origin.clone().addScaledVector(ray.direction, x))
    if (!hits.length) return current.clone()
    hits.sort((p, q) => p.distanceTo(current) - q.distanceTo(current))
    return hits[0]
  }

  dispose() {
    const v = this.v
    v.tweens.cancel("focal")
    v.camera.fov = this.saved.fov
    v.camera.updateProjectionMatrix()
    v.renderer.shadowMap.enabled = this.saved.shadows
    v.renderer.shadowMap.type = this.saved.type
    v.showGrid(true)
    this.studio.dispose()
    for (const l of Object.values(this.lamps)) l.dispose()
    super.dispose()
    for (const m of Object.values(this.mats)) m.dispose()
  }
}
