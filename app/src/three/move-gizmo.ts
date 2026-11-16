import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import type { SceneTokens } from "./tokens"
import type { Viewer } from "./viewer"

export type Axis = 0 | 1 | 2

const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)]
const NAMES = ["X", "Y", "Z"] as const
/** An arrow's length on screen, px: the same however far or near the parts are. */
const LENGTH_PX = 80
/** How near the pointer must be to an arrow to take it, px. */
const HIT_PX = 10
/** Arrows pointing (nearly) at the eye are too short to drag along: they go. */
const MIN_PX = 16
/** Where along its length an arrow starts (its root stays clear, the parts' middle shows). */
const ROOT = 0.16

/**
 * The step a drag moves in: a round number (1, 2 or 5 × 10ⁿ mm) about `px` pixels of the view long, so
 * the distance reads cleanly and a part goes back exactly where it was.
 */
export function moveStep(mmPerPixel: number, px = 3) {
  const raw = Math.max(1e-6, mmPerPixel * px)
  const base = 10 ** Math.floor(Math.log10(raw))
  return [1, 2, 5, 10].map((m) => m * base).find((s) => s >= raw * 0.999) ?? 10 * base
}

/**
 * Where along the line `origin + s · dir` (dir a unit vector) a ray passes closest: `s`, or null when the
 * ray runs along the line (no one place is nearest).
 */
export function closestOnLine(origin: THREE.Vector3, dir: THREE.Vector3, ray: THREE.Ray): number | null {
  const w = origin.clone().sub(ray.origin)
  const b = dir.dot(ray.direction)
  const denom = 1 - b * b
  if (denom < 1e-6) return null
  return (b * ray.direction.dot(w) - dir.dot(w)) / denom
}

/** How a distance moved reads on the arrow: 「X +12」, 「Z −0.5」 (mm). */
export function moveLabel(axis: Axis, mm: number, step: number) {
  const digits = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  const v = Math.abs(mm) < step / 2 ? 0 : mm
  return `${NAMES[axis]} ${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(digits)}`
}

/** What a drag tells: which arrow was taken, how far it has moved (mm, in steps), and that it ended. */
export type MoveHandlers = { start?: (axis: Axis) => void; move: (axis: Axis, mm: number) => void; end?: (axis: Axis, mm: number) => void }

/**
 * Three arrows at a point, X red, Y green and Z blue as on the axis triad: drag one to move along that
 * axis. Drawn over the model and the same size on screen at any zoom, in either projection. A drag
 * reports how far it has moved so far, in round steps; it never reaches the camera or a click below.
 */
export class MoveGizmo {
  private readonly group = new THREE.Group()
  private readonly arrows: THREE.Group[] = []
  private readonly materials: THREE.MeshBasicMaterial[] = []
  /** A rim of paper round each arrow: it reads on any part, a selected (blue) one too. */
  private readonly halos: THREE.MeshBasicMaterial[] = []
  private readonly hub: THREE.MeshBasicMaterial
  private readonly hubHalo: THREE.MeshBasicMaterial
  private readonly tag: CSS2DObject
  private readonly label: HTMLDivElement
  private at: THREE.Vector3 | null = null
  private hot: Axis | null = null
  private drag: { axis: Axis; pointer: number; from: number; step: number; moved: number; origin: THREE.Vector3 } | null = null
  private stops: (() => void)[] = []

  private readonly viewer: Viewer
  private readonly on: MoveHandlers

  constructor(viewer: Viewer, on: MoveHandlers) {
    this.viewer = viewer
    this.on = on
    const shaftLength = 1 - ROOT - 0.2
    const shaft = new THREE.CylinderGeometry(0.02, 0.02, shaftLength, 10).translate(0, ROOT + shaftLength / 2, 0)
    const head = new THREE.ConeGeometry(0.075, 0.2, 18).translate(0, 0.9, 0)
    const shaftHalo = new THREE.CylinderGeometry(0.038, 0.038, shaftLength + 0.04, 10).translate(0, ROOT + shaftLength / 2, 0)
    const headHalo = new THREE.ConeGeometry(0.11, 0.29, 18).translate(0, 0.885, 0)
    const flat = () => new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, transparent: true, toneMapped: false })
    for (const axis of [0, 1, 2] as Axis[]) {
      const m = flat()
      const halo = flat()
      this.materials.push(m)
      this.halos.push(halo)
      const arrow = new THREE.Group()
      const rims = [new THREE.Mesh(shaftHalo, halo), new THREE.Mesh(headHalo, halo)]
      for (const r of rims) r.renderOrder = 19
      const body = [new THREE.Mesh(shaft, m), new THREE.Mesh(head, m)]
      for (const b of body) b.renderOrder = 20
      arrow.add(...rims, ...body)
      // The geometry points along +Y: turn it onto its axis.
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), AXES[axis])
      this.arrows.push(arrow)
      this.group.add(arrow)
    }
    this.hub = flat()
    this.hubHalo = flat()
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), this.hub)
    const hubHalo = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), this.hubHalo)
    hub.renderOrder = 20
    hubHalo.renderOrder = 19
    this.group.add(hubHalo, hub)
    this.group.visible = false
    viewer.scene.add(this.group)

    // The renderer places the outer box; the label itself sits a little above the arrow's tip.
    const box = document.createElement("div")
    this.label = document.createElement("div")
    this.label.className = "-translate-y-5 rounded-sm border bg-background/95 px-1.5 py-0.5 font-mono text-caption whitespace-nowrap text-foreground tabular shadow-popover"
    box.append(this.label)
    this.tag = new CSS2DObject(box)
    this.tag.visible = false
    viewer.scene.add(this.tag)

    this.paint(viewer.tokens)
    this.stops.push(viewer.onTheme((t) => this.paint(t)))
    this.stops.push(viewer.onFrame(() => void this.place()))
    const el = viewer.container
    const opts = { capture: true }
    el.addEventListener("pointerdown", this.onDown, opts)
    el.addEventListener("pointermove", this.onMove, opts)
    el.addEventListener("pointerup", this.onUp, opts)
    el.addEventListener("pointercancel", this.onUp, opts)
    el.addEventListener("dblclick", this.onDouble, opts)
    el.addEventListener("pointerleave", this.onLeave)
    this.stops.push(() => {
      el.removeEventListener("pointerdown", this.onDown, opts)
      el.removeEventListener("pointermove", this.onMove, opts)
      el.removeEventListener("pointerup", this.onUp, opts)
      el.removeEventListener("pointercancel", this.onUp, opts)
      el.removeEventListener("dblclick", this.onDouble, opts)
      el.removeEventListener("pointerleave", this.onLeave)
    })
  }

  /** Where the arrows stand (the middle of what they move); null takes them away. */
  setAt(p: THREE.Vector3 | null) {
    if (!p) {
      if (this.drag) this.finish()
      this.at = null
      this.setHot(null)
    } else this.at = (this.at ?? new THREE.Vector3()).copy(p)
    this.place()
    this.viewer.invalidate()
  }

  get dragging() {
    return !!this.drag
  }

  dispose() {
    if (this.drag) this.finish()
    this.setHot(null)
    for (const stop of this.stops) stop()
    this.viewer.scene.remove(this.group, this.tag)
    this.tag.element.remove()
    this.group.traverse((o) => (o as THREE.Mesh).geometry?.dispose())
    for (const m of [...this.materials, ...this.halos, this.hub, this.hubHalo]) m.dispose()
    this.viewer.invalidate()
  }

  // ------------------------------------------------------------------ drawing

  private paint(t: SceneTokens) {
    ;[t.axisX, t.axisY, t.axisZ].forEach((c, i) => this.materials[i].color.copy(c))
    for (const h of [...this.halos, this.hubHalo]) h.color.copy(t.paper)
    this.hub.color.copy(t.ink)
    this.hubHalo.opacity = 0.85
    this.hub.opacity = 0.9
    this.shade()
  }

  /** The taken arrow full strength, the others faded while one is pointed at or dragged. */
  private shade() {
    const lit = this.drag?.axis ?? this.hot
    this.materials.forEach((m, i) => (m.opacity = lit === null ? 0.95 : lit === i ? 1 : 0.3))
    this.halos.forEach((m, i) => (m.opacity = lit === null ? 0.8 : lit === i ? 0.9 : 0.2))
    this.arrows.forEach((a, i) => a.scale.setScalar(lit === i ? 1.12 : 1))
    this.viewer.invalidate()
  }

  /** The same size on screen wherever the point is; arrows seen end-on hidden. */
  private place() {
    const at = this.at
    this.group.visible = !!at
    if (!at) return
    this.group.position.copy(at)
    this.group.scale.setScalar(LENGTH_PX * this.viewer.worldPerPixel(at))
    this.arrows.forEach((a, i) => (a.visible = this.screenLength(i as Axis) >= MIN_PX))
    if (this.drag) this.tag.position.copy(at).addScaledVector(AXES[this.drag.axis], this.group.scale.x)
  }

  private screenLength(axis: Axis) {
    if (!this.at) return 0
    const a = this.viewer.project(this.at)
    const b = this.viewer.project(this.at.clone().addScaledVector(AXES[axis], this.group.scale.x))
    return Math.hypot(b.x - a.x, b.y - a.y)
  }

  // ------------------------------------------------------------------ pointer

  /** The arrow under the pointer (by its line on screen), if any. */
  private axisAt(e: { clientX: number; clientY: number }): Axis | null {
    if (!this.at || !this.group.visible) return null
    const r = this.viewer.renderer.domElement.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    const len = this.group.scale.x
    let best: { axis: Axis; px: number } | null = null
    for (const axis of [0, 1, 2] as Axis[]) {
      if (!this.arrows[axis].visible) continue
      const a = this.viewer.project(this.at.clone().addScaledVector(AXES[axis], len * ROOT))
      const b = this.viewer.project(this.at.clone().addScaledVector(AXES[axis], len))
      const vx = b.x - a.x
      const vy = b.y - a.y
      const l2 = vx * vx + vy * vy
      const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - a.x) * vx + (y - a.y) * vy) / l2)) : 0
      const px = Math.hypot(a.x + t * vx - x, a.y + t * vy - y)
      if (px <= HIT_PX && (!best || px < best.px)) best = { axis, px }
    }
    return best?.axis ?? null
  }

  private setHot(axis: Axis | null) {
    if (axis === this.hot) return
    this.hot = axis
    this.viewer.renderer.domElement.style.cursor = axis === null ? "" : "grab"
    this.shade()
  }

  /** How far along the dragged axis the pointer is, from where the arrows stood when the drag began. */
  private along(e: PointerEvent, axis: Axis, origin: THREE.Vector3) {
    return closestOnLine(origin, AXES[axis], this.viewer.ray(e))
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.drag || !this.at) return
    const axis = this.axisAt(e)
    if (axis === null) return
    const origin = this.at.clone()
    const from = this.along(e, axis, origin)
    if (from === null) return
    // Ours alone: the camera doesn't turn and the click doesn't select what's below.
    e.stopPropagation()
    e.preventDefault()
    this.viewer.container.setPointerCapture(e.pointerId)
    this.drag = { axis, pointer: e.pointerId, from, step: moveStep(this.viewer.worldPerPixel(origin)), moved: 0, origin }
    this.viewer.renderer.domElement.style.cursor = "grabbing"
    this.label.textContent = moveLabel(axis, 0, this.drag.step)
    this.tag.visible = true
    this.shade()
    this.place()
    this.on.start?.(axis)
  }

  private onMove = (e: PointerEvent) => {
    const d = this.drag
    if (!d) {
      if (!e.buttons) this.setHot(this.axisAt(e))
      return
    }
    if (e.pointerId !== d.pointer) return
    e.stopPropagation()
    const s = this.along(e, d.axis, d.origin)
    if (s === null) return
    const moved = Math.round(Math.round((s - d.from) / d.step) * d.step * 1e6) / 1e6
    if (moved === d.moved) return
    d.moved = moved
    this.label.textContent = moveLabel(d.axis, moved, d.step)
    this.on.move(d.axis, moved)
  }

  private onUp = (e: PointerEvent) => {
    if (!this.drag || e.pointerId !== this.drag.pointer) return
    e.stopPropagation()
    this.finish()
    this.setHot(this.axisAt(e))
  }

  private finish() {
    const d = this.drag
    if (!d) return
    this.drag = null
    if (this.viewer.container.hasPointerCapture(d.pointer)) this.viewer.container.releasePointerCapture(d.pointer)
    this.viewer.renderer.domElement.style.cursor = this.hot === null ? "" : "grab"
    this.tag.visible = false
    this.shade()
    this.on.end?.(d.axis, d.moved)
  }

  /** A double-click on an arrow isn't one on the part behind it. */
  private onDouble = (e: MouseEvent) => {
    if (this.axisAt(e) !== null) e.stopPropagation()
  }

  private onLeave = () => {
    if (!this.drag) this.setHot(null)
  }
}
