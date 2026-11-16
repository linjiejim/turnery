// A line drawing of the model as it is shown, in SVG: for patent figures and manuals. Black lines
// of one weight: the edges and outlines that can be seen (kernel/hlr.ts), hidden ones left out or
// dashed, the section's cut hatched at 45°, and parts numbered with leader lines. No DOM here: the
// window draws it from its view, and the engine from a direction (export, headless).
import * as THREE from "three"
import { frameCamera } from "@/three/framing"
import type { DisplayData } from "./kernel/build"
import { hiddenLines, loops, type HlrLine, type HlrPart, type HlrView, type V2 } from "./kernel/hlr"
import { partGeometry, partOffset, partVisible, partsBox, type PartsView } from "./scene"

export type FigureCamera = THREE.PerspectiveCamera | THREE.OrthographicCamera
/** Which parts get a number: none, 10 / 20 / 30 … in order, their names, or given words by part name. */
export type FigureLabels = "none" | "numbers" | "names" | Record<string, string>

// ------------------------------------------------------------------ cameras

/**
 * A camera looking at `box` from `dir` (from the model towards the eye), Z up, for a `w` × `h`
 * picture: perspective as the view's, or orthographic framing the box's outline closely.
 */
export function fitCamera(box: THREE.Box3, dir: THREE.Vector3, projection: "perspective" | "orthographic", w: number, h: number, padding = 1.06): FigureCamera {
  const d = dir.clone().normalize()
  if (Math.abs(d.z) > 0.9999) d.set(0, -1e-4, Math.sign(d.z)).normalize()
  const persp = new THREE.PerspectiveCamera(28, w / h, 0.5, 20000)
  persp.up.set(0, 0, 1)
  const dist = frameCamera(persp, box, d, padding)
  persp.updateMatrixWorld()
  if (projection === "perspective") return persp
  // Orthographic: the box's corners on the picture plane, centred, with a little room.
  const right = new THREE.Vector3().setFromMatrixColumn(persp.matrixWorld, 0)
  const up = new THREE.Vector3().setFromMatrixColumn(persp.matrixWorld, 1)
  const centre = box.getCenter(new THREE.Vector3())
  let hw = 0
  let hh = 0
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).sub(centre)
        hw = Math.max(hw, Math.abs(p.dot(right)))
        hh = Math.max(hh, Math.abs(p.dot(up)))
      }
  hh = Math.max(hh, hw / (w / h)) * padding
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius
  const o = new THREE.OrthographicCamera(-hh * (w / h), hh * (w / h), hh, -hh, 1, dist + radius * 4 + 10)
  o.position.copy(centre).addScaledVector(d, dist + radius * 2)
  o.quaternion.copy(persp.quaternion)
  o.updateProjectionMatrix()
  o.updateMatrixWorld()
  return o
}

/** A three.js camera as kernel/hlr.ts sees it, for a picture of `w` × `h` pixels. */
export function hlrView(camera: FigureCamera, w: number, h: number): HlrView {
  camera.updateMatrixWorld()
  const view = camera.matrixWorldInverse.elements
  if (camera instanceof THREE.OrthographicCamera)
    return { view, width: w, height: h, projection: { ortho: true, halfW: (camera.right - camera.left) / (2 * camera.zoom), halfH: (camera.top - camera.bottom) / (2 * camera.zoom) } }
  return { view, width: w, height: h, projection: { ortho: false, tanHalfFov: Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom, aspect: w / h } }
}

/** The parts that are drawn (shown, and not see-through context), by index; a body in one piece is -1. */
export function drawnParts(d: DisplayData, view: PartsView): number[] {
  if (!d.parts?.length) return d.mesh ? [-1] : []
  const solid = view.focus?.mode === "ghost" ? new Set(view.focus.parts) : null
  return d.parts.flatMap((p, i) => (partVisible(d, view, i) && (!solid || solid.has(p.name)) ? [i] : []))
}

/** The box round what is drawn, as shown (pulled apart, moved). */
export function drawnBox(d: DisplayData, view: PartsView): THREE.Box3 | null {
  const parts = drawnParts(d, view)
  if (parts[0] === -1) return d.bbox ? new THREE.Box3(new THREE.Vector3(...d.bbox[0]), new THREE.Vector3(...d.bbox[1])) : null
  return partsBox(d, view, parts)
}

/** The drawn parts as kernel/hlr.ts takes them: their triangles and edges, where they are shown. */
export function hlrParts(d: DisplayData, view: PartsView): HlrPart[] {
  if (!d.mesh) return []
  const geometry = partGeometry(d)
  return drawnParts(d, view).flatMap((k) => {
    const g = geometry.find((x) => x.part === k)
    return g ? [{ id: k, vertices: d.mesh!.vertices, index: g.index, edges: g.edges, offset: partOffset(d, view, k < 0 ? undefined : k) }] : []
  })
}

// ------------------------------------------------------------------ the drawing

export type LineFigureOptions = {
  camera: FigureCamera
  /** The drawing's size in its own units (px): the view's size keeps its framing. */
  width: number
  height: number
  view: PartsView
  section: THREE.Plane | null
  /** Hidden edges and outlines dashed (otherwise left out). */
  hidden?: boolean
  labels?: FigureLabels
  /** Parts to number (by index); none given: every part drawn. */
  labelParts?: number[]
  /** Depth picture pixels per drawing unit (lines are judged at this resolution). */
  detail?: number
}

type Line = { a: V2; b: V2; part: number }

/** A line drawing of the model as the camera sees it, as SVG; null when there is nothing to draw. */
export function lineFigure(d: DisplayData, o: LineFigureOptions): { svg: string; lines: number; labels: number } | null {
  const parts = hlrParts(d, o.view)
  if (!parts.length) return null
  const W = o.width
  const H = o.height
  const k = o.detail ?? 2
  const view = hlrView(o.camera, Math.round(W * k), Math.round(H * k))
  const section = o.section ? { normal: o.section.normal.toArray() as [number, number, number], constant: o.section.constant } : null
  const res = hiddenLines(parts, view, { section, hidden: o.hidden })
  const px = (p: V2): V2 => [((p[0] + 1) / 2) * W, ((1 - p[1]) / 2) * H]
  const toPx = (l: HlrLine): Line => ({ a: px(l.a), b: px(l.b), part: l.part })
  const visible = res.visible.map(toPx)
  if (!visible.length) return null
  const hidden = res.hidden.map(toPx)
  const cuts = loops(res.cut).map((loop) => loop.map(px))
  const labels = placeLabels(d, o, visible)
  return { svg: toSvg(visible, hidden, cuts, labels), lines: visible.length + hidden.length, labels: labels.length }
}

// ------------------------------------------------------------------ numbers

type Label = { text: string; anchor: V2; at: V2; side: "left" | "right" | "top" | "bottom" }

/** The words each numbered part gets. */
export function labelTexts(names: string[], labels: FigureLabels): (string | null)[] {
  const short = (n: string) => n.split("/").pop() ?? n
  if (labels === "none") return names.map(() => null)
  if (labels === "numbers") return names.map((_, i) => String((i + 1) * 10))
  if (labels === "names") return names.map(short)
  return names.map((n) => labels[n] ?? labels[short(n)] ?? null)
}

/**
 * Each numbered part's leader, as on a patent figure: from a visible point on the part (the one
 * nearest the middle of what shows of it) to a column of numbers beside the drawing, left or right
 * whichever side the point is on, the numbers in the order of their points from top to bottom and
 * a line apart, so the leaders run sideways and don't cross the drawing.
 */
function placeLabels(d: DisplayData, o: LineFigureOptions, lines: Line[]): Label[] {
  const labels = o.labels ?? "none"
  if (labels === "none") return []
  const wanted = (o.labelParts?.length ? o.labelParts : drawnParts(d, o.view)).filter((k) => k >= 0 || !d.parts)
  const texts = labelTexts(wanted.map((k) => (k >= 0 ? d.parts![k].name : "")), labels)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const l of lines)
    for (const p of [l.a, l.b]) {
      x0 = Math.min(x0, p[0])
      y0 = Math.min(y0, p[1])
      x1 = Math.max(x1, p[0])
      y1 = Math.max(y1, p[1])
    }
  const cx = (x0 + x1) / 2
  const gap = Math.max(24, 0.08 * (x1 - x0))
  const items: Label[] = []
  wanted.forEach((k, i) => {
    const text = texts[i]
    if (!text) return
    const pts = lines.filter((l) => l.part === k).flatMap((l) => [l.a, l.b, [(l.a[0] + l.b[0]) / 2, (l.a[1] + l.b[1]) / 2] as V2])
    if (!pts.length) return
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length
    // The column on the part's side, and the leader from the part's near side of it (not across the part).
    const side = mx < cx ? "left" : "right"
    const near = pts.filter((p) => (side === "left" ? p[0] <= mx : p[0] >= mx))
    const anchor = (near.length ? near : pts).reduce((best, p) => (Math.hypot(p[0] - mx, p[1] - my) < Math.hypot(best[0] - mx, best[1] - my) ? p : best))
    items.push({ text, anchor, at: [side === "left" ? x0 - gap : x1 + gap, anchor[1]], side })
  })
  // Down each column in the order of the points, a line apart; a column taller than the drawing is centred on it.
  const step = FONT * 1.45
  for (const side of ["left", "right"] as const) {
    const col = items.filter((l) => l.side === side).sort((p, q) => p.anchor[1] - q.anchor[1])
    for (let i = 1; i < col.length; i++) col[i].at[1] = Math.max(col[i].at[1], col[i - 1].at[1] + step)
    if (!col.length) continue
    const over = col[col.length - 1].at[1] - y1
    const room = col[0].at[1] - y0
    if (over > 0) {
      const shift = Math.min(over, Math.max(0, room) + over / 2)
      for (const l of col) l.at[1] -= shift
      for (let i = 1; i < col.length; i++) col[i].at[1] = Math.max(col[i].at[1], col[i - 1].at[1] + step)
    }
  }
  return items
}

// ------------------------------------------------------------------ SVG

const FONT = 14
const f = (x: number) => String(Math.round(x * 100) / 100)
const pathOf = (lines: Line[]) => lines.map((l) => `M${f(l.a[0])} ${f(l.a[1])}L${f(l.b[0])} ${f(l.b[1])}`).join("")
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
/** About how wide a label is: CJK a full em, the rest about 0.6. */
const textWidth = (s: string) => [...s].reduce((w, c) => w + (c.charCodeAt(0) > 0x2e80 ? FONT : FONT * 0.6), 0)

function toSvg(visible: Line[], hidden: Line[], cuts: V2[][], labels: Label[]): string {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  const grow = (x: number, y: number) => {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  for (const l of [...visible, ...hidden]) {
    grow(...l.a)
    grow(...l.b)
  }
  const boxOf = (l: Label): [number, number, number, number] => {
    const w = textWidth(l.text) + 4
    const [x, y] = l.at
    if (l.side === "left") return [x - w, y - FONT / 2, x, y + FONT / 2]
    if (l.side === "right") return [x, y - FONT / 2, x + w, y + FONT / 2]
    if (l.side === "top") return [x - w / 2, y - FONT - 4, x + w / 2, y]
    return [x - w / 2, y, x + w / 2, y + FONT + 4]
  }
  for (const l of labels) {
    const [a, b, c, e] = boxOf(l)
    grow(a, b)
    grow(c, e)
  }
  const m = Math.max(12, 0.03 * Math.max(x1 - x0, y1 - y0))
  const vb = [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m]
  // A drawing to print: black lines on white, whatever the theme.
  const ink = "black" // design-allow: ink of a drawing to print
  const paper = "white" // design-allow: paper of a drawing to print
  const out: string[] = []
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.map(f).join(" ")}" width="${f(vb[2])}" height="${f(vb[3])}">`)
  out.push(`<rect x="${f(vb[0])}" y="${f(vb[1])}" width="${f(vb[2])}" height="${f(vb[3])}" fill="${paper}"/>`)
  if (cuts.length) {
    out.push(`<defs><pattern id="hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="${ink}" stroke-width="0.7"/></pattern></defs>`)
    const d = cuts.map((loop) => `M${loop.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}Z`).join("")
    out.push(`<path d="${d}" fill="url(#hatch)" fill-rule="evenodd" stroke="none"/>`)
  }
  if (hidden.length) out.push(`<path d="${pathOf(hidden)}" fill="none" stroke="${ink}" stroke-width="0.8" stroke-dasharray="4 3" stroke-linecap="round"/>`)
  out.push(`<path d="${pathOf(visible)}" fill="none" stroke="${ink}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`)
  if (labels.length) {
    out.push(`<g stroke="${ink}" stroke-width="0.7" fill="none">`)
    for (const l of labels) out.push(`<path d="M${f(l.anchor[0])} ${f(l.anchor[1])}L${f(l.at[0])} ${f(l.at[1])}"/>`)
    out.push(`</g>`, `<g font-family="sans-serif" font-size="${FONT}" fill="${ink}">`)
    for (const l of labels) {
      const anchor = l.side === "left" ? "end" : l.side === "right" ? "start" : "middle"
      const dx = l.side === "left" ? -4 : l.side === "right" ? 4 : 0
      const dy = l.side === "top" ? -4 : l.side === "bottom" ? FONT + 2 : FONT * 0.35
      out.push(`<text x="${f(l.at[0] + dx)}" y="${f(l.at[1] + dy)}" text-anchor="${anchor}">${escape(l.text)}</text>`)
    }
    out.push(`</g>`)
  }
  out.push(`</svg>`)
  return out.join("\n")
}
