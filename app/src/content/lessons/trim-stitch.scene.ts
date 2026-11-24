import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { edgeLine, label, line } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { lineMaterial, surfaceMaterial, tessellate, trackResolution, type Surf } from "./surface-from-curves.patch"

/**
 * 5.2.3 「修剪、分割、缝合与封闭」. Six surfaces that should close a small
 * housing (100 × 60 mm, crowned top) but don't: the front wall stops 0.8 mm
 * short of the top, the right wall sticks up through it, the top's back edge
 * is 0.4 mm short of the back wall, the left wall is 0.004 mm off, and the
 * bottom is missing. Naked edges are drawn thick; a join tolerance decides
 * which gaps count as closed. The learner extends, trims, matches and caps
 * until the body closes, joins it (the volume appears), and finally compares
 * splitting the top with trimming a hole in it.
 *
 * Simplified: each seam is modelled as a pair of edges with a known largest
 * gap, rather than by a general edge-matching algorithm.
 */
export type Tool = "extend" | "trim" | "match" | "cap"
export type Problem = "front" | "right" | "back" | "left" | "bottom"
export type CutMode = "none" | "split" | "trim"

export type TrimState = {
  step: number
  /** Join tolerance, mm. */
  tol: number
  front: "short" | "extended" | "trimmed"
  right: "long" | "trimmed"
  back: "gap" | "matched"
  bottom: boolean
  tool: Tool
  /** What the last click did (or why it didn't). */
  feedback: { ok: boolean; text: string } | null
  lastChanged: string | null
  inspected: Problem[]
  inspecting: Problem | null
  triedLarge: boolean
  joined: boolean
  cut: CutMode
  cutTool: "split" | "trim"
  triedSplit: boolean
  triedCutTrim: boolean
}

export const TOLS = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2]
export const PROBLEMS: Problem[] = ["front", "right", "back", "left", "bottom"]

const HX = 50
const HY = 30
const TALL = 36
const LEFT_OFF = 0.004
const ELL = { a: 18, b: 10 }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
export const zTop = (x: number, y: number) => 26 + 3 * (1 - (x / HX) ** 2) + 2 * (1 - (y / HY) ** 2)

/** Volume under the top over the footprint, mm³ (midpoint rule; the bottom is z = 0). */
export const VOLUME = (() => {
  let v = 0
  const n = 200
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) v += zTop(-HX + (2 * HX * (i + 0.5)) / n, -HY + (2 * HY * (j + 0.5)) / n) * ((2 * HX) / n) * ((2 * HY) / n)
  return v
})()

type Seam = { id: string; gap: number; edges: THREE.Vector3[][]; problem: Problem | null }

const along = (n: number, f: (k: number) => THREE.Vector3) => Array.from({ length: n + 1 }, (_, i) => f(i / n))

/** Height of a wall's top edge at a corner (all walls meet the top at z = 26 at the corners when trimmed). */
function cornerTop(s: TrimState, wall: "front" | "right" | "back" | "left") {
  const trimmed = zTop(HX, HY)
  if (wall === "front") return s.front === "short" ? trimmed - 0.8 : s.front === "extended" ? TALL : trimmed
  if (wall === "right") return s.right === "long" ? TALL : trimmed
  return trimmed
}

function frontTop(s: TrimState, x: number) {
  return s.front === "short" ? zTop(x, -HY) - 0.8 : s.front === "extended" ? TALL : zTop(x, -HY)
}
function rightTop(s: TrimState, y: number) {
  return s.right === "long" ? TALL : zTop(HX, y)
}
const topBackY = (s: TrimState) => (s.back === "gap" ? HY - 0.4 : HY)

/** Every seam of the would-be body, with its largest gap and the edges that should meet there. */
export function seams(s: TrimState): Seam[] {
  const yb = topBackY(s)
  const out: Seam[] = []
  const mismatch = (a: number, b: number) => Math.abs(a - b)
  out.push({
    id: "top-front",
    problem: "front",
    gap: s.front === "short" ? 0.8 : s.front === "extended" ? TALL - zTop(HX, HY) : 0,
    edges: [along(40, (k) => V(-HX + 2 * HX * k, -HY, zTop(-HX + 2 * HX * k, -HY))), along(40, (k) => V(-HX + 2 * HX * k, -HY, frontTop(s, -HX + 2 * HX * k)))],
  })
  out.push({
    id: "top-right",
    problem: "right",
    gap: s.right === "long" ? TALL - zTop(HX, HY) : 0,
    edges: [along(30, (k) => V(HX, -HY + 2 * HY * k, zTop(HX, -HY + 2 * HY * k))), along(30, (k) => V(HX, -HY + 2 * HY * k, rightTop(s, -HY + 2 * HY * k)))],
  })
  out.push({
    id: "top-back",
    problem: "back",
    gap: s.back === "gap" ? 0.4 : 0,
    edges: [along(40, (k) => V(-HX + 2 * HX * k, yb, zTop(-HX + 2 * HX * k, yb))), along(40, (k) => V(-HX + 2 * HX * k, HY, zTop(-HX + 2 * HX * k, HY)))],
  })
  out.push({
    id: "top-left",
    problem: "left",
    gap: LEFT_OFF,
    edges: [along(30, (k) => V(-HX, -HY + 2 * HY * k, zTop(-HX, -HY + 2 * HY * k)))],
  })
  const corners: [string, "front" | "back", "left" | "right", number, number][] = [
    ["front-left", "front", "left", -HX, -HY],
    ["front-right", "front", "right", HX, -HY],
    ["back-right", "back", "right", HX, HY],
    ["back-left", "back", "left", -HX, HY],
  ]
  for (const [id, a, b, x, y] of corners) {
    const ha = cornerTop(s, a)
    const hb = cornerTop(s, b)
    out.push({
      id,
      problem: a === "front" && s.front !== "trimmed" ? "front" : b === "right" && s.right === "long" ? "right" : b === "left" ? "left" : null,
      gap: Math.max(mismatch(ha, hb), b === "left" ? LEFT_OFF : 0),
      edges: [[V(x, y, 0), V(x, y, Math.max(ha, hb))]],
    })
  }
  const rect = [V(-HX, -HY, 0), V(HX, -HY, 0), V(HX, HY, 0), V(-HX, HY, 0)]
  for (let i = 0; i < 4; i++)
    out.push({
      id: `bottom-${i}`,
      problem: "bottom",
      gap: s.bottom ? (i === 3 ? LEFT_OFF : 0) : Infinity,
      edges: [[rect[i], rect[(i + 1) % 4]]],
    })
  return out
}

/** Seams left open at a tolerance. */
export const openSeams = (s: TrimState, tol = s.tol) => seams(s).filter((m) => m.gap > tol + 1e-9)
/** Seams that only close because the tolerance is larger than a sensible modelling tolerance. */
export const fakeSeams = (s: TrimState, tol = s.tol) => seams(s).filter((m) => m.gap > 0.01 + 1e-9 && m.gap <= tol + 1e-9)
export const allFixed = (s: TrimState) => s.front === "trimmed" && s.right === "trimmed" && s.back === "matched" && s.bottom

/** Where each problem is, for its marker and close-up. */
const SPOTS: Record<Problem, { at: THREE.Vector3; eye: THREE.Vector3 }> = {
  front: { at: V(0, -HY, 28.6), eye: V(55, -165, 95) },
  right: { at: V(HX, 0, 33), eye: V(175, -95, 100) },
  back: { at: V(0, HY, 29), eye: V(-40, 160, 110) },
  left: { at: V(-HX, 0, 14), eye: V(-175, -70, 80) },
  bottom: { at: V(0, 0, 0), eye: V(90, -150, -120) },
}

export class TrimStitchScene extends LessonScene<TrimState> {
  private body = new THREE.Group()
  private marks = new THREE.Group()
  private mat = surfaceMaterial()
  private matChanged = surfaceMaterial()
  private matSolid = surfaceMaterial()
  private matInner = surfaceMaterial()
  private nakedMat: ReturnType<typeof lineMaterial>
  private fakeMat: ReturnType<typeof lineMaterial>
  private faces: THREE.Mesh[] = []
  private markers = new Map<Problem, CSS2DObject>()
  private down: { x: number; y: number } | null = null
  private gridHidden = false

  constructor(v: Viewer, emit: (s: TrimState) => void) {
    super(v, emit, {
      step: 0,
      tol: 0.001,
      front: "short",
      right: "long",
      back: "gap",
      bottom: false,
      tool: "extend",
      feedback: null,
      lastChanged: null,
      inspected: [],
      inspecting: null,
      triedLarge: false,
      joined: false,
      cut: "none",
      cutTool: "split",
      triedSplit: false,
      triedCutTrim: false,
    })
    v.setGrid(120, 10)
    this.nakedMat = lineMaterial(v, 3.2)
    this.fakeMat = lineMaterial(v, 2.4, true)
    this.own(trackResolution(v, [this.nakedMat, this.fakeMat]))
    this.root.add(this.body, this.marks)
    for (const p of PROBLEMS) {
      const m = this.makeMarker(p)
      this.markers.set(p, m)
      this.root.add(m)
    }

    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => (this.down = { x: e.clientX, y: e.clientY })
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
      this.onClick(e)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
    })
    // Looking from below, the grid would sit between the eye and the open bottom.
    this.own(
      v.onCameraChange(() => {
        const below = v.camera.position.z < v.controls.target.z - 5 && v.camera.position.z < 0
        if (below !== this.gridHidden) {
          this.gridHidden = below
          v.showGrid(!below)
        }
      }),
    )
  }

  enter(step: number) {
    const s = this.state
    const broken = { front: "short", right: "long", back: "gap", bottom: false } as const
    const fixed = { front: "trimmed", right: "trimmed", back: "matched", bottom: true } as const
    const patch: Partial<TrimState> = { step, feedback: null, lastChanged: null, inspecting: null, cut: "none" }
    if (step <= 1) Object.assign(patch, broken, { joined: false })
    if (step === 0) patch.tol = 0.001
    if (step === 1) patch.tol = s.tol
    if (step === 2) Object.assign(patch, { tol: 0.01, joined: false, tool: "extend" })
    if (step === 3) Object.assign(patch, { tol: 0.01, joined: false })
    if (step === 4) Object.assign(patch, fixed, { tol: 0.01, joined: true })
    this.set(patch)
    const v = this.v
    if (step === 4) v.flyTo(V(70, -130, 150), V(0, 0, 22), 900)
    else v.flyTo(V(130, -170, 120), V(0, 0, 14), 900)
  }

  // ------------------------------------------------------------ actions

  inspect(p: Problem) {
    const s = this.state
    this.set({ inspecting: p, inspected: s.inspected.includes(p) ? s.inspected : [...s.inspected, p] })
    const spot = SPOTS[p]
    this.v.flyTo(spot.eye.clone(), spot.at.clone(), 800)
  }

  overview() {
    this.set({ inspecting: null })
    this.v.flyTo(V(130, -170, 120), V(0, 0, 14), 800)
  }

  setTol(tol: number) {
    this.set({ tol, triedLarge: this.state.triedLarge || tol >= 0.5, joined: false })
  }

  setTool(tool: Tool) {
    this.set({ tool, feedback: null })
  }

  join() {
    this.set({ joined: true })
  }

  /** For learners who skipped the repairs: do the rest, one after another. */
  fixRest() {
    const s = this.state
    const steps: Partial<TrimState>[] = []
    if (s.front === "short") steps.push({ front: "extended", lastChanged: "front" })
    if (s.front !== "trimmed") steps.push({ front: "trimmed", lastChanged: "front" })
    if (s.right === "long") steps.push({ right: "trimmed", lastChanged: "right" })
    if (s.back === "gap") steps.push({ back: "matched", lastChanged: "top" })
    if (!s.bottom) steps.push({ bottom: true, lastChanged: "bottom" })
    let done = 0
    this.v.tweens.run(
      450 * steps.length,
      (k) => {
        while (done < steps.length && k >= (done + 1) / steps.length - 1e-6) this.set({ ...steps[done++], joined: false })
      },
      { tag: "fix", ease: (x) => x },
    )
  }

  setCutTool(cutTool: "split" | "trim") {
    this.set({ cutTool })
  }

  setCut(cut: CutMode) {
    const s = this.state
    this.set({ cut, triedSplit: s.triedSplit || cut === "split", triedCutTrim: s.triedCutTrim || cut === "trim" })
  }

  private apply(id: string) {
    const s = this.state
    const no = (text: string) => this.set({ feedback: { ok: false, text } })
    const yes = (patch: Partial<TrimState>, text: string, changed: string) => this.set({ ...patch, feedback: { ok: true, text }, lastChanged: changed, joined: false })
    switch (s.tool) {
      case "extend":
        if (id === "front" && s.front === "short")
          return yes({ front: "extended" }, t("前壁延伸到顶面以上，两面相交了。下一步：用顶面把多出来的修剪掉。", "The front wall now reaches past the top, so the two intersect. Next: trim off the excess with the top."), "front")
        if (id === "front") return no(t("前壁已经够长了，现在该修剪。", "The front wall is long enough now; it's time to trim."))
        if (id === "top" && s.back === "gap") return no(t("顶面后边只差 0.4 mm，两条边几乎重合：用「匹配」把顶面的边拉到后壁上，比延伸再修剪干净。", "The top's back edge is only 0.4 mm short and almost on the wall's edge: matching it onto the back wall is cleaner than extending and trimming."))
        return no(t("这个面不短，不用延伸。", "This surface isn't short; it doesn't need extending."))
      case "trim":
        if (id === "front" && s.front === "extended") return yes({ front: "trimmed" }, t("以顶面为切割物修剪：前壁的上边现在正好落在顶面上。", "Trimmed with the top as the cutter: the front wall's top edge now lies exactly on the top."), "front")
        if (id === "front" && s.front === "short") return no(t("前壁还没碰到顶面，没有交线可剪。先延伸。", "The front wall doesn't reach the top yet, so there is no intersection to trim along. Extend it first."))
        if (id === "right" && s.right === "long") return yes({ right: "trimmed" }, t("右壁高出顶面的部分剪掉了，交线就是新的边。", "The part of the right wall above the top is trimmed off; the intersection is its new edge."), "right")
        return no(t("这里没有多出来的部分可剪。", "There's nothing extra to trim here."))
      case "match":
        if ((id === "top" || id === "back") && s.back === "gap")
          return yes({ back: "matched" }, t("顶面的后边匹配到后壁的上边：后壁不动，顶面的边被拉过去 0.4 mm。", "The top's back edge is matched onto the back wall's top edge: the wall stays, the top's edge moves 0.4 mm."), "top")
        if (id === "front" && s.front === "short")
          return no(t("前壁的上边是直线落差 0.8 mm，匹配会把整条边硬拉过去；延伸再修剪更稳，交线由顶面决定。", "The front wall is 0.8 mm short along its whole edge; matching would drag the edge over. Extending and trimming is safer: the top decides the intersection."))
        return no(t("这里的边没有错开，不用匹配。", "These edges aren't offset; no match needed."))
      case "cap":
        if (!s.bottom) return yes({ bottom: true }, t("底部的洞口在一个平面上，加盖补上了一块平面。", "The opening at the bottom is planar, so capping fills it with a flat face."), "bottom")
        return no(t("已经没有平面洞口了。", "There are no planar openings left."))
    }
  }

  private onClick(e: PointerEvent) {
    const s = this.state
    if (s.step !== 2 && s.step !== 3 && s.step !== 4) return
    const hit = this.v.pick(e, this.faces, false)
    if (!hit) return
    const id = hit.object.userData.id as string
    if (s.step === 4) {
      if (id === "top-inner" || (id === "top" && s.cut === "none")) this.setCut(s.cutTool)
      return
    }
    this.apply(id)
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.body)
    this.clear(this.marks)
    this.faces = []
    this.mat.color.copy(tk.model)
    this.matChanged.color.copy(tk.modified)
    this.matSolid.color.copy(tk.model).lerp(tk.good, 0.22)
    this.matInner.color.copy(tk.highlight)
    this.nakedMat.color.copy(tk.bad)
    this.fakeMat.color.copy(tk.warn)

    const holed = s.step === 4 && s.cut === "trim"
    const closed = s.joined && openSeams(s).length === 0 && !holed
    const base = closed ? this.matSolid : this.mat
    const add = (id: string, S: Surf, nu: number, nv: number, mat?: THREE.Material) => {
      const { geo } = tessellate(S, nu, nv)
      const m = new THREE.Mesh(geo, mat ?? (s.step >= 2 && s.lastChanged === id ? this.matChanged : base))
      m.userData = { id }
      this.faces.push(m)
      this.body.add(m)
    }
    const X = (u: number) => -HX + 2 * HX * u
    const Y = (v: number) => -HY + 2 * HY * v
    // Top: a plain patch, or (last step) a ring around the ellipse and the patch inside it.
    if (s.step === 4) this.addCutTop(add)
    else {
      const yb = topBackY(s)
      add("top", (u, v) => V(X(u), -HY + (yb + HY) * v, zTop(X(u), -HY + (yb + HY) * v)), 40, 24)
    }
    add("front", (u, v) => V(X(u), -HY, v * frontTop(s, X(u))), 30, 6)
    add("back", (u, v) => V(X(u), HY, v * zTop(X(u), HY)), 30, 6)
    add("right", (u, v) => V(HX, Y(u), v * rightTop(s, Y(u))), 20, 6)
    add("left", (u, v) => V(-HX - LEFT_OFF, Y(u), v * zTop(-HX, Y(u))), 20, 6)
    if (s.bottom) add("bottom", (u, v) => V(X(u), Y(v), 0), 4, 4)

    // Seams: joined edges thin, open ones thick red, ones closed only by a too-large tolerance dashed orange.
    const open = new Set(openSeams(s).map((m) => m.id))
    const fake = new Set(fakeSeams(s).map((m) => m.id))
    for (const m of seams(s)) {
      for (const e of m.edges) {
        if (open.has(m.id)) this.marks.add(line(e, this.nakedMat))
        else if (fake.has(m.id)) this.marks.add(line(e, this.fakeMat))
        else this.body.add(edgeLine(e, kit))
      }
    }
    if (s.step === 4 && s.cut === "trim") {
      const ring = Array.from({ length: 97 }, (_, i) => this.ellipse(i / 96))
      this.marks.add(line(ring, this.nakedMat))
    }
    // Fake joins get their real gap written beside them.
    if (s.step === 1)
      for (const m of fakeSeams(s)) {
        if (!m.problem || m.id.startsWith("bottom") || ["front-left", "front-right", "back-right", "back-left"].includes(m.id)) continue
        const mid = m.edges[0][Math.floor(m.edges[0].length / 2)]
        this.marks.add(label(t(`当成接上了，缝 ${m.gap} mm 还在`, `Counted as joined; the ${m.gap} mm gap is still there`), mid.clone().add(V(0, 0, 6)), "border-warning text-warning font-sans"))
      }
    if (closed) this.marks.add(label(t(`封闭实体 · 体积 ${(this.volume() / 1000).toFixed(1)} cm³`, `Closed solid · volume ${(this.volume() / 1000).toFixed(1)} cm³`), V(0, 0, 44), "border-success text-success font-sans"))
    else if (holed) this.marks.add(label(t("开了一个洞：不再封闭，没有体积", "There's a hole: no longer closed, no volume"), V(0, 0, 44), "border-warning text-warning font-sans"))
    else if (s.joined) this.marks.add(label(t(`开放的多重曲面：${openSeams(s).length} 处外露边缘`, `Open polysurface: ${openSeams(s).length} naked edges`), V(0, 0, 44), "border-warning text-warning font-sans"))

    for (const [p, m] of this.markers) {
      m.visible = s.step === 0
      m.position.copy(SPOTS[p].at)
      m.element.dataset.done = s.inspected.includes(p) ? "1" : ""
      m.element.className = markerClass(s.inspecting === p, s.inspected.includes(p))
    }
    this.v.invalidate()
  }

  private ellipse(k: number) {
    const th = 2 * Math.PI * k
    const x = ELL.a * Math.cos(th)
    const y = ELL.b * Math.sin(th)
    return V(x, y, zTop(x, y) + 0.15)
  }

  /** The top split along an ellipse: ring outside, patch inside (gone when trimmed). */
  private addCutTop(add: (id: string, S: Surf, nu: number, nv: number, mat?: THREE.Material) => void) {
    const s = this.state
    const rectHit = (th: number) => {
      const d = V(Math.cos(th), Math.sin(th), 0)
      return Math.min(HX / Math.max(1e-6, Math.abs(d.x)), HY / Math.max(1e-6, Math.abs(d.y)))
    }
    const ring: Surf = (u, v) => {
      const th = 2 * Math.PI * u
      const ex = ELL.a * Math.cos(th)
      const ey = ELL.b * Math.sin(th)
      // March from the ellipse out to the rectangle along the same direction from the centre.
      const dir = Math.atan2(ey, ex)
      const r = rectHit(dir)
      const x = ex + (r * Math.cos(dir) - ex) * v
      const y = ey + (r * Math.sin(dir) - ey) * v
      return V(x, y, zTop(x, y))
    }
    add("top", ring, 96, 10)
    if (s.cut !== "trim") {
      const inner: Surf = (u, v) => {
        const th = 2 * Math.PI * u
        const x = ELL.a * Math.cos(th) * v
        const y = ELL.b * Math.sin(th) * v
        return V(x, y, zTop(x, y))
      }
      add("top-inner", inner, 48, 6, s.cut === "split" ? this.matInner : undefined)
    }
    const curve = Array.from({ length: 97 }, (_, i) => this.ellipse(i / 96))
    if (s.cut === "none") this.marks.add(line(curve, this.v.kit.sketch))
    else if (s.cut === "split") this.body.add(edgeLine(curve, this.v.kit))
  }

  volume() {
    return VOLUME
  }

  private makeMarker(p: Problem) {
    const el = document.createElement("button")
    el.type = "button"
    el.textContent = String(PROBLEMS.indexOf(p) + 1)
    el.title = t("看看这里", "Look here")
    el.addEventListener("pointerdown", (e) => e.stopPropagation())
    el.addEventListener("click", () => this.inspect(p))
    return new CSS2DObject(el)
  }

  dispose() {
    this.v.tweens.cancel("fix")
    this.v.showGrid(true)
    super.dispose()
    for (const m of [this.mat, this.matChanged, this.matSolid, this.matInner, this.nakedMat, this.fakeMat]) m.dispose()
  }
}

function markerClass(active: boolean, done: boolean) {
  const base = "interactive flex size-6 items-center justify-center rounded-full border-2 font-mono text-caption font-medium cursor-pointer transition-shadow hover:ring-4 hover:ring-primary/25"
  if (active) return `${base} border-primary bg-primary text-primary-foreground`
  if (done) return `${base} border-success bg-background text-success`
  return `${base} border-destructive bg-background text-destructive`
}
