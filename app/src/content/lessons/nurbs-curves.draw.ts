import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import type { LineMaterial } from "three/addons/lines/LineMaterial.js"
import { line } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import type { CurveSample } from "./nurbs-curves.nurbs"

/**
 * Drawing helpers shared by the curve lessons: curvature combs, polylines from 2D points and
 * draggable CSS2D handles (the same feel as 「曲率梳与 G0 / G1 / G2 连续」).
 */

/** 2D sketch point → world (top plane by default). */
export type To3 = (p: V2) => THREE.Vector3
export const onTop =
  (z = 0.05): To3 =>
  (p) =>
    new THREE.Vector3(p[0], p[1], z)

/**
 * Porcupine plot: a tooth along the normal, length ∝ curvature, on the convex side, and the
 * envelope through the tips. Consecutive samples at the same point (a knot sampled from both
 * sides) split the envelope, so a jump in curvature shows as a step.
 */
export function comb(
  smp: CurveSample[],
  scale: number,
  kit: Viewer["kit"],
  opts: { maxTooth?: number; to3?: To3; teeth?: THREE.LineBasicMaterial; envelope?: LineMaterial | THREE.LineBasicMaterial } = {},
) {
  const g = new THREE.Group()
  const max = opts.maxTooth ?? 60
  const to3 = opts.to3 ?? onTop(0.03)
  const teeth: number[] = []
  const tips: THREE.Vector3[] = []
  for (const q of smp) {
    const len = Math.max(-max, Math.min(max, q.k * scale))
    const a = to3(q.p)
    const tip = to3([q.p[0] - q.normal[0] * len, q.p[1] - q.normal[1] * len])
    teeth.push(a.x, a.y, a.z, tip.x, tip.y, tip.z)
    tips.push(tip)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(teeth, 3))
  const l = new THREE.LineSegments(geo, opts.teeth ?? kit.edgeSoft)
  l.raycast = () => {}
  l.renderOrder = 2
  g.add(l)
  const env = opts.envelope ?? kit.sketchThin
  let run: THREE.Vector3[] = []
  smp.forEach((q, i) => {
    run.push(tips[i])
    const next = smp[i + 1]
    const split = next && Math.hypot(next.p[0] - q.p[0], next.p[1] - q.p[1]) < 1e-6 && Math.abs(next.k - q.k) * scale > 0.3
    if (split || !next) {
      if (run.length > 1) {
        if (env instanceof THREE.LineBasicMaterial) {
          const e = new THREE.Line(new THREE.BufferGeometry().setFromPoints(run), env)
          e.raycast = () => {}
          e.renderOrder = 2
          g.add(e)
        } else g.add(line(run, env))
      }
      run = []
    }
  })
  return g
}

/** A thick line through 2D points. */
export function poly(pts: V2[], mat: LineMaterial, to3: To3 = onTop()) {
  return line(
    pts.map((p) => to3(p)),
    mat,
  )
}

/** A 1px line through 2D points (ghosts, ticks). */
export function thin(pts: V2[], mat: THREE.LineBasicMaterial, to3: To3 = onTop()) {
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map((p) => to3(p))), mat)
  l.raycast = () => {}
  return l
}

export type HandleKind = "point" | "end" | "edit" | "driven" | "fixed"

export function handleClass(kind: HandleKind, active = false) {
  const base = "interactive size-3.5 border-2 bg-background transition-shadow"
  const grab = "cursor-grab hover:ring-4 hover:ring-primary/25"
  const ring = active ? " ring-4 ring-primary/30" : ""
  if (kind === "fixed") return "pointer-events-none size-2.5 rounded-full border-2 border-foreground bg-background"
  if (kind === "edit") return `interactive grid size-5 place-items-center ${grab} rounded-full${ring}`
  if (kind === "driven") return `${base} ${grab} rounded-xs border-primary${ring}`
  if (kind === "end") return `${base} ${grab} rounded-full border-foreground bg-foreground${ring}`
  return `${base} ${grab} rounded-full border-foreground${ring}`
}

/**
 * Style a handle. Edit points are diamonds: the rotation sits on an inner element, because
 * CSS2DRenderer positions the outer one with `transform` and a rotation there would turn the
 * position too.
 */
export function styleHandle(el: HTMLElement, kind: HandleKind, active = false) {
  el.className = handleClass(kind, active)
  if (kind === "edit") {
    if (!el.firstElementChild) el.appendChild(document.createElement("span"))
    ;(el.firstElementChild as HTMLElement).className = "block size-3 rotate-45 rounded-xs border-2 border-primary bg-background"
  } else el.firstElementChild?.remove()
}

/**
 * A draggable CSS2D dot. `plane()` gives the plane the pointer ray is cut with while dragging
 * (asked again at every move, so it can follow the point); orbiting is off while a drag lasts.
 */
export function dragHandle(
  v: Viewer,
  opts: {
    plane: () => THREE.Plane
    move: (hit: THREE.Vector3) => void
    start?: () => void
    end?: () => void
    hover?: (on: boolean) => void
  },
) {
  const el = document.createElement("div")
  const o = new CSS2DObject(el)
  o.userData = { kind: "label" }
  el.addEventListener("pointerdown", (e) => {
    e.preventDefault()
    e.stopPropagation()
    el.setPointerCapture(e.pointerId)
    v.controls.enabled = false
    opts.start?.()
    const move = (ev: PointerEvent) => {
      const hit = v.rayOnPlane(ev, opts.plane())
      if (hit) opts.move(hit)
    }
    const up = () => {
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
      el.removeEventListener("pointercancel", up)
      v.controls.enabled = true
      opts.end?.()
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
    el.addEventListener("pointercancel", up)
  })
  if (opts.hover) {
    el.addEventListener("pointerenter", () => opts.hover?.(true))
    el.addEventListener("pointerleave", () => opts.hover?.(false))
  }
  return o
}

/** A handle-like dot that can't be dragged (shown control points). */
export function fixedDot() {
  const el = document.createElement("div")
  el.className = handleClass("fixed")
  const o = new CSS2DObject(el)
  o.userData = { kind: "label" }
  return o
}

/** A small filled dot (data points, knots) in the plane. */
export function dotMesh(p: THREE.Vector3, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 14), mat)
  m.position.copy(p)
  m.raycast = () => {}
  return m
}

export const fmt = (x: number, d = 2) => (Math.abs(x) < 0.5 * 10 ** -d ? (0).toFixed(d) : x.toFixed(d))
