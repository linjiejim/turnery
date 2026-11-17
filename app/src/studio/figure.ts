// A picture of the model as it is shown, to keep: a PNG of the view in its style (shaded, line
// drawing, see-through), from the view's camera, cropped to the model, without the grid, the
// selection, the arrows or the pins. The line drawing as SVG is figure-lines.ts.
import * as THREE from "three"
import type { ViewStyle } from "@/three/materials"
import { acquireSnapshotter, releaseSnapshotter } from "@/three/snapshot"
import { readSceneTokens, type SceneTokens } from "@/three/tokens"
import { disposeObject } from "@/three/viewer"
import type { DisplayData } from "./kernel/build"
import { drawnBox, fitCamera, type FigureCamera } from "./figure-lines"
import { modelObject, type PartsView } from "./scene"

// ------------------------------------------------------------------ picture

/** The scene's colours for a picture to print: white paper and black ink whatever the theme. */
function printTokens(t: SceneTokens): SceneTokens {
  const white = new THREE.Color(1, 1, 1)
  return { ...t, bg: white, paper: white, ink: new THREE.Color(0.02, 0.02, 0.02) }
}

export type PictureOptions = {
  camera: FigureCamera
  /** Picture size in pixels (before cropping to the model). */
  width: number
  height: number
  view: PartsView
  style: ViewStyle
  /** The parts' own colours (off: a white model). */
  looks: boolean
  section: THREE.Plane | null
  background: "white" | "transparent"
}

/** A PNG of the model as the camera sees it, cropped to it: no grid, selection, arrows or pins. */
export function renderPicture(d: DisplayData, o: PictureOptions): string | null {
  if (!d.mesh) return null
  const snap = acquireSnapshotter()
  snap.kit.applyTokens(printTokens(readSceneTokens()))
  snap.renderer.localClippingEnabled = true
  if (o.section) snap.kit.setSection(o.section)
  const obj = modelObject(d, snap.kit, { status: false }, o.view, o.looks, o.style)
  try {
    const canvas = snap.drawFrom(obj, o.camera, o.width, o.height)
    return cropped(canvas, o.background)
  } finally {
    disposeObject(obj)
    if (o.section) snap.kit.setSection(null)
    snap.refreshTheme()
    releaseSnapshotter()
  }
}

/**
 * A picture asked for by direction rather than from the view (`export` to .png): framed to the parts
 * drawn, 2000 × 1500 before cropping.
 */
export function figurePicture(d: DisplayData, f: { dir: [number, number, number]; projection: "perspective" | "orthographic"; style: ViewStyle; explode: number; hide: string[]; background: "white" | "transparent"; looks: boolean }): string | null {
  const view: PartsView = { explode: f.explode, hidden: new Set((d.parts ?? []).flatMap((p, i) => (f.hide.includes(p.name) ? [i] : []))) }
  const box = drawnBox(d, view)
  if (!box) return null
  const W = 2000
  const H = 1500
  const camera = fitCamera(box, new THREE.Vector3(...f.dir), f.projection, W, H)
  return renderPicture(d, { camera, width: W, height: H, view, style: f.style, looks: f.looks, section: null, background: f.background })
}

/** The bounds of what was drawn (alpha above a trace), or null for an empty picture. */
export function alphaBounds(data: Uint8ClampedArray, w: number, h: number): [number, number, number, number] | null {
  let x0 = w
  let y0 = h
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < h; y++) {
    const row = y * w * 4
    for (let x = 0; x < w; x++) {
      if (data[row + x * 4 + 3] <= 8) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1]
}

function cropped(canvas: HTMLCanvasElement, background: "white" | "transparent") {
  const w = canvas.width
  const h = canvas.height
  const box = alphaBounds(canvas.getContext("2d")!.getImageData(0, 0, w, h).data, w, h) ?? [0, 0, w, h]
  const m = Math.round(0.04 * Math.max(box[2] - box[0], box[3] - box[1])) + 8
  const out = document.createElement("canvas")
  out.width = box[2] - box[0] + 2 * m
  out.height = box[3] - box[1] + 2 * m
  const ctx = out.getContext("2d")!
  if (background === "white") {
    ctx.fillStyle = "white" // design-allow: a picture to keep or print, the same in either theme
    ctx.fillRect(0, 0, out.width, out.height)
  }
  ctx.drawImage(canvas, box[0] - m, box[1] - m, out.width, out.height, 0, 0, out.width, out.height)
  return out.toDataURL("image/png")
}
