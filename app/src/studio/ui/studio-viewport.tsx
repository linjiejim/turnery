import * as React from "react"
import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Textarea } from "@/components/ui/input"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import { Viewport } from "@/components/viewport"
import { disposeObject, type Projection, type Viewer } from "@/three/viewer"
import type { ViewStyle } from "@/three/materials"
import { MoveGizmo } from "@/three/move-gizmo"
import { ease } from "@/three/tween"
import { circled, type PickInfo } from "../annotations"
import type { DisplayData } from "../kernel/build"
import type { MeasureResult, MeasureTarget } from "../kernel/measure"
import type { Pin } from "../look"
import { applyStyle, applyView, edgeHighlight, regionStrokes, facesBox, groupAt, faceTarget, hasLooks, hasMoves, partOffset, partsBox, partVisible, modelObject, NO_PARTS_VIEW, repaint, withoutMoves, type Hover, type Paint, type PartsView } from "../scene"
import type { Annotations, FocusRegion } from "../use-annotations"
import type { Studio } from "../studio"
import type { Reselect } from "../use-reselect"
import { wholeNames } from "../part-selection"
import { displayName } from "../dsl"
import { newSection, sectionPlane, type Section } from "../section"
import type { SketchHost } from "../region"
import type { PinNotes } from "../pin-notes"
import { PinNoteCard } from "./pin-card"
import { SketchLayer } from "./sketch-layer"
import { gatherRegion } from "../region-pick"
import { declutter, dimensionLayer, dimParam } from "../dimension-layer"
import type { Dim } from "../kernel/dims"
import { DimEditor } from "./dim-editor"
import { MeasurePanel, ViewTools, type ExportViewOptions } from "./viewport-tools"
import { renderPicture } from "../figure"
import { lineFigure } from "../figure-lines"
import { DRAG_ARROWS, VIEW_KEYS, type KeyRow, type ViewTool } from "../view-keys"
import { colourKey, drawsColours, lookPrefs, nextLook, viewLook, type ViewLook } from "../view-look"
import { useWords } from "./host-words"

type V3 = [number, number, number]
/** A press that moves less than this is a click, not a camera drag. */
const CLICK_PX = 5

const LOOKS_STORE = "ft-studio-looks"
/** Colours or a white model: the person's own way of looking, kept across parts and launches (never in a file). */
function useLooksSwitch(): [boolean, (on: boolean) => void] {
  const [on, setOn] = React.useState(() => {
    try {
      return localStorage.getItem(LOOKS_STORE) !== "off"
    } catch {
      return true
    }
  })
  const set = React.useCallback((v: boolean) => {
    setOn(v)
    try {
      localStorage.setItem(LOOKS_STORE, v ? "on" : "off")
    } catch {
      /* private mode: this window only */
    }
  }, [])
  return [on, set]
}

const VIEW_STORE = "ft-studio-view"
/** How the model is drawn and projected: like the colours, the person's own way of looking, kept across parts and launches. */
type ViewPrefs = { style: ViewStyle; projection: Projection }
const VIEW_DEFAULT: ViewPrefs = { style: "shaded", projection: "perspective" }
const STYLES: ViewStyle[] = ["shaded", "lines", "xray"]
function useViewPrefs(): [ViewPrefs, (p: Partial<ViewPrefs>) => void] {
  const [prefs, setPrefs] = React.useState<ViewPrefs>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(VIEW_STORE) ?? "{}") as Partial<ViewPrefs>
      return {
        style: STYLES.includes(saved.style as ViewStyle) ? (saved.style as ViewStyle) : VIEW_DEFAULT.style,
        projection: saved.projection === "orthographic" ? "orthographic" : "perspective",
      }
    } catch {
      return VIEW_DEFAULT
    }
  })
  const update = React.useCallback((p: Partial<ViewPrefs>) => {
    setPrefs((was) => {
      const next = { ...was, ...p }
      try {
        localStorage.setItem(VIEW_STORE, JSON.stringify(next))
      } catch {
        /* private mode: this window only */
      }
      return next
    })
  }, [])
  return [prefs, update]
}

/** A picture of the view to keep: a PNG data URL, or SVG text. */
export type SavedFigure = { format: "png"; data: string } | { format: "svg"; data: string }

/** The browser's way of keeping a picture: a download. */
async function downloadFigure(f: SavedFigure) {
  const a = document.createElement("a")
  const url = f.format === "png" ? f.data : URL.createObjectURL(new Blob([f.data], { type: "image/svg+xml" }))
  a.href = url
  a.download = f.format === "png" ? t("视图.png", "view.png") : t("线稿.svg", "line-drawing.svg")
  a.click()
  if (f.format === "svg") setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** How long pulling the parts apart (or putting them back) takes when the explode panel opens or closes. */
const EXPLODE_MS = 450
/** How far the parts come apart when the explode panel opens. */
const EXPLODE_OPEN = 0.5

/** Wording and numbering for hosts other than the web studio (the desktop app's notes). */
/** Where the camera was left in a file. */
export type ViewCamera = { position: THREE.Vector3; target: THREE.Vector3; size: number }

export type ViewportCopy = {
  /** The hint over an unmarked model; null hides it. */
  hint?: string | null
  /** The note card's button. */
  add?: string
  /** Number on the next pin (default: after the pending ones). */
  next?: number
  /** Told when a click lands while `busy`. */
  busy?: string
}

/**
 * The studio's 3D view: the model, coloured by step status or by what's
 * highlighted; click a face or an edge to annotate it.
 */
export function StudioViewport({
  studio,
  hover,
  annotations,
  busy,
  reselect,
  parts = NO_PARTS_VIEW,
  onParts,
  readOnly = false,
  annotation = true,
  onAnnotation,
  onPointFeature,
  onSelectFeature,
  onPresented,
  selectedParts = [],
  onLocateStep,
  copy,
  selectionActions,
  onNoteSelection,
  onOpenPart,
  sketch,
  keys = [],
  active = true,
  viewKey,
  cameras: cameraMemory,
  pinNotes,
  onSaveFigure = downloadFigure,
}: {
  studio: Studio
  hover: Hover | null
  annotations: Annotations
  busy: boolean
  /** 「在模型上重选」 and a form's pick box. */
  reselect?: Reselect
  /** A split body: explode amount and hidden parts. */
  parts?: PartsView
  onParts?: (v: PartsView) => void
  /** Off on the site: measure and section, but no annotating (there is nobody to send notes to). */
  annotation?: boolean
  onAnnotation?: (on: boolean) => void
  /** `piece`: just the piece under the pointer (⌥), not the whole part it belongs to. */
  onPointFeature?: (id: string | null, part?: number, piece?: boolean) => void
  onSelectFeature?: (id: string | null, part?: number, additive?: boolean, piece?: boolean) => void
  onPresented?: (display: DisplayData) => void
  selectedParts?: number[]
  onLocateStep?: () => void
  readOnly?: boolean
  copy?: ViewportCopy
  /** More buttons on the selected parts' toolbar, after their name (the desktop's 打开零件, 备注). */
  selectionActions?: React.ReactNode
  /** C with parts selected: a note about them, not a click on a face. */
  onNoteSelection?: () => void
  /** A part double-clicked (or ↵ with one selected): open its own file. */
  onOpenPart?: (part: number, inPlace?: boolean) => void
  /** Framing (R) and drawing (P) a note: how the host keeps it. Without it, neither tool is offered. */
  sketch?: SketchHost
  /** The host's keys, listed after the view's own in the 「快捷键」 card. */
  keys?: KeyRow[]
  /** Off while something covers the view (the drawing sheet): its keys do nothing. */
  active?: boolean
  /** Which file is shown: going back to one puts the camera where it was left. */
  viewKey?: string
  /** Where the camera was left in each file (`viewKey`), kept by the host: the view may be closed in between (a file loading). */
  cameras?: Map<string, ViewCamera>
  /** Notes already on the model: a click on a pin opens its card (none on the site). */
  pinNotes?: PinNotes
  /** Keep an exported picture or line drawing (the desktop asks where); without it, the browser downloads it. */
  onSaveFigure?: (figure: SavedFigure) => Promise<void>
}) {
  const [viewer, setViewer] = React.useState<Viewer | null>(null)
  const current = React.useRef<THREE.Group | null>(null)
  const fittedSize = React.useRef(0)
  /** Where the camera was in each file shown before (`viewKey`), and which one is shown now (none yet: the first one may be gone back to). */
  const [ownCameras] = React.useState(() => new Map<string, ViewCamera>())
  const cameras = cameraMemory ?? ownCameras
  const shownKey = React.useRef<string | undefined>(undefined)
  // While re-picking a feature's faces or edges, the view shows the body that feature starts from.
  const rs = reselect?.state ?? null
  const display = rs?.display ?? studio.display
  const { kernel } = studio
  const { focus, draft } = annotations
  const nextPin = copy?.next ?? annotations.pending.length + 1

  // Measure mode: up to two picked faces / edges and what the kernel says about them.
  const [measuring, setMeasuring] = React.useState(false)
  /** Framing or drawing a note: one go, then back to the tool before. */
  const [sketching, setSketching] = React.useState<"box" | "pen" | null>(null)
  const [exploding, setExploding] = React.useState(false)
  const [keysOpen, setKeysOpen] = React.useState(false)
  const [picked, setPicked] = React.useState<MeasureTarget[]>([])
  const [measured, setMeasured] = React.useState<{ key: string; result: MeasureResult | null } | null>(null)
  const [section, setSection] = React.useState<Section | null>(null)
  const [looks, setLooks] = useLooksSwitch()
  const [prefs, setPrefs] = useViewPrefs()
  const style = prefs.style
  // The card's one choice (白模 / 彩色 / 线描 / 半透明), kept as the two switches it always was.
  const look = viewLook(style, looks)
  // Only shaded follows the switch; see-through and a line drawing always use the parts' own looks.
  const coloured = drawsColours(style, looks)
  const chooseLook = React.useCallback(
    (next: ViewLook) => {
      const p = lookPrefs(next)
      if (p.colours !== undefined) setLooks(p.colours)
      setPrefs({ style: p.style })
    },
    [setLooks, setPrefs],
  )
  // A new model invalidates the picks (hashes belong to the old one).
  const [shownDisplay, setShownDisplay] = React.useState(display)
  if (shownDisplay !== display) {
    setShownDisplay(display)
    if (picked.length) setPicked([])
  }
  const pickKey = JSON.stringify(picked)
  const result = measured?.key === pickKey ? measured.result : null
  React.useEffect(() => {
    if (!picked.length) return
    let live = true
    void studio.measure(picked).then((r) => live && setMeasured({ key: JSON.stringify(picked), result: r }))
    return () => {
      live = false
    }
  }, [studio, picked])
  const stopMeasuring = React.useCallback(() => {
    setMeasuring(false)
    setPicked([])
  }, [])

  // Dimensions on the model: a parameter's or a feature row's when pointed at, the main ones when switched on.
  const [showDims, setShowDims] = React.useState(false)
  const [editingDim, setEditingDim] = React.useState<{ dim: Dim; el: HTMLElement } | null>(null)
  const held = useHeldHover(hover)
  const shownDims = React.useMemo(() => {
    const upTo = new Set(studio.tree.features.slice(0, (display?.index ?? -1) + 1).map((f) => f.id))
    const drawable = studio.dims.filter((d) => d.source.type !== "derived" && upTo.has(d.feature))
    let list: Dim[] = []
    let accent = false
    if (held.hover?.dim) {
      list = drawable.filter((d) => d.id === held.hover!.dim)
      accent = true
    } else if (held.hover?.param) {
      list = drawable.filter((d) => dimParam(d) === held.hover!.param)
      accent = true
    } else if (held.hover?.feature) {
      list = drawable.filter((d) => d.feature === held.hover!.feature)
      accent = true
    } else if (showDims) list = [...drawable].sort((a, b) => b.priority - a.priority).slice(0, DIMS_SHOWN)
    const editing = editingDim && studio.dims.find((d) => d.id === editingDim.dim.id)
    if (editing && !list.some((d) => d.id === editing.id)) list = [...list, editing]
    return { list, accent, total: drawable.length }
  }, [studio.dims, studio.tree, display, held.hover, showDims, editingDim])
  const scale = React.useMemo(() => {
    const b = display?.bbox
    return b ? Math.max(1, 0.02 * Math.hypot(b[1][0] - b[0][0], b[1][1] - b[0][1], b[1][2] - b[0][2])) : 2
  }, [display])
  const setLabelPointed = held.setLabelPointed
  React.useEffect(() => {
    if (!viewer || !shownDims.list.length || rs) return
    const layer = dimensionLayer(shownDims.list, viewer.kit, {
      scale,
      accent: new Set(shownDims.accent ? shownDims.list.map((d) => d.id) : editingDim ? [editingDim.dim.id] : []),
      onClick: busy ? undefined : (dim, el) => setEditingDim({ dim, el }),
      onPointLabel: setLabelPointed,
    })
    viewer.scene.add(layer.group)
    viewer.invalidate()
    // Labels move with the camera: sort out overlaps once each move has been drawn.
    let raf = requestAnimationFrame(() => declutter(layer.group))
    const stop = viewer.onCameraChange(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => declutter(layer.group))
    })
    return () => {
      stop()
      cancelAnimationFrame(raf)
      viewer.scene.remove(layer.group)
      disposeObject(layer.group)
      layer.dispose()
      viewer.invalidate()
    }
  }, [viewer, shownDims, scale, busy, editingDim, setLabelPointed, rs])

  const onReady = React.useCallback((v: Viewer) => {
    setViewer(v)
    return () => setViewer(null)
  }, [])

  const [showChanges, setShowChanges] = React.useState(false)
  const tool: ViewTool = sketching ?? (measuring ? "measure" : onAnnotation && annotation ? "note" : "select")
  /** The tool before framing or drawing: one note, then back to it. */
  const sketchFrom = React.useRef<ViewTool>("select")
  const chooseTool = React.useCallback(
    (t: ViewTool) => {
      if ((t === "box" || t === "pen") && tool !== "box" && tool !== "pen") sketchFrom.current = tool
      if (t !== "measure") {
        setMeasuring(false)
        setPicked([])
      }
      if (t !== "box" && t !== "pen") setSketching(null)
      if (t === "select" || t === "measure" || t === "box" || t === "pen") {
        if (onAnnotation && annotation) onAnnotation(false)
        annotations.cancel()
        onPointFeature?.(null)
      }
      if (t === "note") onAnnotation?.(true)
      if (t === "measure") setMeasuring(true)
      if (t === "box" || t === "pen") setSketching(t)
    },
    [annotation, onAnnotation, annotations, onPointFeature, tool],
  )
  const paint = React.useMemo<Paint>(() => {
    if (rs) return { status: false, faces: rs.kind === "face" ? rs.hashes : [] }
    if (measuring && picked.length) return { status: false, faces: picked.filter((t) => t.kind === "face").map((t) => t.hash) }
    if (focus) return { status: false, faces: focus.kind === "face" ? focus.hashes : [] }
    return { status: showChanges, selected: selectedParts, hovered: hover?.faces ?? display?.groups.filter((g) => hover?.ids.includes(g.origin)).map((g) => g.hash) }
  }, [focus, hover, measuring, picked, rs, selectedParts, showChanges, display])
  // Selected parts are outlined as well as lit: a part already blue still shows it is the one selected.
  const selectedEdges = React.useMemo(
    () => (selectedParts.length && display ? display.edgeGroups.filter((g) => g.part !== undefined && selectedParts.includes(g.part)).map((g) => g.hash) : []),
    [selectedParts, display],
  )
  const edgeHashes = React.useMemo(
    () =>
      rs
        ? rs.kind === "edge"
          ? rs.hashes
          : []
        : hover?.edges?.length
          ? hover.edges
          : measuring
            ? picked.filter((t) => t.kind === "edge").map((t) => t.hash)
            : focus?.kind === "edge"
              ? focus.hashes
              : focus
                ? []
                : selectedEdges,
    [measuring, picked, focus, rs, hover, selectedEdges],
  )
  const paintRef = React.useRef(paint)
  React.useEffect(() => {
    paintRef.current = paint
  }, [paint])

  // What the view keeps by name (isolated, moved) only for parts the model still has: a part renamed
  // or removed since (an undo, the agent) leaves nothing behind that can't be seen or put back.
  const view = React.useMemo(() => {
    if (!display?.parts || rs) return NO_PARTS_VIEW
    const known = (name: string) => display.parts!.some((p) => p.name === name)
    let v = parts
    if (v.focus && !v.focus.parts.every(known)) {
      const names = v.focus.parts.filter(known)
      v = { ...v, focus: names.length ? { ...v.focus, parts: names } : undefined }
    }
    if (v.moved && !Object.keys(v.moved).every(known)) {
      const moved = Object.fromEntries(Object.entries(v.moved).filter(([name]) => known(name)))
      v = { ...v, moved: Object.keys(moved).length ? moved : undefined }
    }
    return v
  }, [display, rs, parts])
  // The model is built once per display; hiding, isolating and pulling apart only move and show its parts.
  const viewRef = React.useRef(view)
  const styleRef = React.useRef(style)
  React.useEffect(() => {
    if (!viewer || !display) return
    const g = modelObject(display, viewer.kit, paintRef.current, viewRef.current, coloured, styleRef.current)
    viewer.setContent(g)
    current.current = g
    if (viewKey !== shownKey.current) {
      if (shownKey.current && fittedSize.current) cameras.set(shownKey.current, { position: viewer.camera.position.clone(), target: viewer.controls.target.clone(), size: fittedSize.current })
      shownKey.current = viewKey
      const back = viewKey ? cameras.get(viewKey) : undefined
      if (back) void viewer.flyTo(back.position, back.target, 0)
      fittedSize.current = back?.size ?? 0
    }
    const stop = viewer.onRendered(() => { stop(); onPresented?.(display) })
    if (display.bbox) {
      const box = new THREE.Box3(new THREE.Vector3(...display.bbox[0]), new THREE.Vector3(...display.bbox[1]))
      const size = box.getSize(new THREE.Vector3()).length()
      // Re-frame on the first model and when it changes size a lot; otherwise keep the learner's camera.
      if (!fittedSize.current || size > fittedSize.current * 1.6 || size < fittedSize.current / 2.5) {
        void viewer.fit(box, { view: fittedSize.current ? undefined : "iso", animate: fittedSize.current > 0 })
        fittedSize.current = size
      }
    } else fittedSize.current = 0
    return stop
  }, [viewer, display, onPresented, coloured, viewKey, cameras])
  React.useEffect(() => {
    viewRef.current = view
    if (!viewer || !display || !current.current) return
    applyView(current.current, display, view, viewer.kit)
    viewer.invalidate()
  }, [viewer, display, view])
  // Shaded, a line drawing or see-through: the same model, other materials.
  React.useEffect(() => {
    styleRef.current = style
    if (!viewer || !display || !current.current) return
    applyStyle(current.current, display, viewRef.current, viewer.kit, style)
    viewer.invalidate()
  }, [viewer, display, style])
  React.useEffect(() => {
    viewer?.setProjection(prefs.projection)
  }, [viewer, prefs.projection])
  // Closed (another file loading): where the camera is now is kept for coming back.
  React.useEffect(() => {
    if (!viewer) return
    return () => {
      if (shownKey.current && fittedSize.current) cameras.set(shownKey.current, { position: viewer.camera.position.clone(), target: viewer.controls.target.clone(), size: fittedSize.current })
    }
  }, [viewer, cameras])

  // Frame the parts as shown (pulled apart, moved): when the learner lets go of the explode slider, or
  // where they are going when the explode panel opens.
  const frameShown = React.useCallback(
    (explode?: number) => {
      if (!viewer || !display?.parts) return
      const v = explode === undefined ? view : { ...view, explode }
      const box = partsBox(display, v, display.parts.flatMap((_, i) => (partVisible(display, v, i) ? [i] : [])))
      if (box) void viewer.fit(box, { animate: true })
    },
    [viewer, display, view],
  )
  // Opening the explode panel pulls the parts halfway apart (and frames them there); closing it puts them back.
  // Read by the animation between renders: kept current before the next frame.
  const partsRef = React.useRef(parts)
  React.useLayoutEffect(() => {
    partsRef.current = parts
  }, [parts])
  const explodeTo = React.useCallback(
    (to: number) => {
      if (!viewer || !onParts) return
      const from = partsRef.current.explode
      if (from === to) return
      void viewer.tweens.run(EXPLODE_MS, (k) => onParts({ ...partsRef.current, explode: from + (to - from) * k }), { tag: "explode", ease: ease.inOut })
    },
    [viewer, onParts],
  )
  const openExplode = React.useCallback(
    (on: boolean) => {
      setExploding(on)
      if (!onParts) return
      if (on) frameShown(EXPLODE_OPEN)
      explodeTo(on ? EXPLODE_OPEN : 0)
    },
    [explodeTo, frameShown, onParts],
  )

  React.useEffect(() => {
    if (!viewer || !current.current) return
    repaint(current.current, paint)
    viewer.invalidate()
  }, [viewer, paint])

  // Highlighted edges: thick lines over the model.
  React.useEffect(() => {
    if (!viewer || !display || !edgeHashes.length) return
    const lines = edgeHighlight(display, edgeHashes, viewer.kit, view)
    if (!lines) return
    viewer.scene.add(lines)
    viewer.invalidate()
    return () => {
      viewer.scene.remove(lines)
      disposeObject(lines)
      ;((lines as THREE.Mesh).material as THREE.Material).dispose()
      viewer.invalidate()
    }
  }, [viewer, display, edgeHashes, view])

  // The shortest segment between two measured items, with its length on it.
  const segment = result?.segment
  // Named in the kernel's language (BETWEEN in kernel/measure.ts).
  const distance = result?.between.find((b) => b.name === "最短距离" || b.name === "Shortest distance")?.value
  React.useEffect(() => {
    if (!viewer || !segment) return
    const group = new THREE.Group()
    const [a, b] = segment.map((p) => new THREE.Vector3(...p))
    if (a.distanceTo(b) > 1e-6) {
      const geo = new LineSegmentsGeometry()
      geo.setPositions([...segment[0], ...segment[1]])
      const mat = viewer.kit.dimension.clone()
      mat.color.copy(viewer.kit.edgeHighlight.color)
      mat.linewidth = 2
      mat.depthTest = false
      mat.resolution.copy(viewer.kit.dimension.resolution)
      const line = new LineSegments2(geo, mat)
      line.renderOrder = 6
      group.add(line)
    }
    for (const p of [a, b]) {
      const dot = document.createElement("div")
      dot.className = "size-2 rounded-full bg-primary ring-2 ring-background"
      const o = new CSS2DObject(dot)
      o.position.copy(p)
      group.add(o)
    }
    if (distance && a.distanceTo(b) > 1e-6) {
      // The renderer positions the outer box; the tag itself sits a little above the line.
      const box = document.createElement("div")
      const tag = document.createElement("div")
      tag.className = "-translate-y-4 rounded-sm bg-primary px-1.5 py-0.5 font-mono text-caption whitespace-nowrap text-primary-foreground tabular"
      tag.textContent = distance
      box.append(tag)
      const o = new CSS2DObject(box)
      o.position.copy(a).add(b).multiplyScalar(0.5)
      group.add(o)
    }
    viewer.scene.add(group)
    viewer.invalidate()
    return () => {
      viewer.scene.remove(group)
      group.traverse((o) => ((o as LineSegments2).material as THREE.Material | undefined)?.dispose?.())
      disposeObject(group)
      viewer.invalidate()
    }
  }, [viewer, segment, distance])

  // Section: clip the model, paint the cut flat.
  const plane = React.useMemo(() => (section ? sectionPlane(section) : null), [section])
  React.useEffect(() => {
    if (!viewer) return
    viewer.kit.setSection(plane)
    viewer.invalidate()
    return () => {
      viewer.kit.setSection(null)
      viewer.invalidate()
    }
  }, [viewer, plane, display])

  // Esc leaves re-picking (the card's 取消 does the same).
  const cancelReselect = reselect?.cancel
  React.useEffect(() => {
    if (!rs) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target as HTMLElement)?.closest?.("input, textarea")) cancelReselect?.()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [rs, cancelReselect])

  // Numbered pins: annotations in the composer and of the message being answered, the draft, a located one.
  const pins = React.useMemo(() => {
    const out: (Pin & { tone: "solid" | "draft" | "ghost" })[] = annotations.pins.map((p) => ({ ...p, tone: "solid" }))
    if (draft) out.push({ n: nextPin, point: draft.point, part: draft.part, tone: "draft" })
    if (focus?.pin) out.push({ ...focus.pin, tone: "ghost" })
    return out.flatMap((pin) => {
      const index = pin.part ? display?.parts?.findIndex((p) => p.name === pin.part) : undefined
      if (display && index !== undefined && index >= 0 && !partVisible(display, view, index)) return []
      const offset = display ? partOffset(display, view, index) : [0, 0, 0]
      return [{ ...pin, point: pin.point.map((v, k) => v + offset[k]) as V3 }]
    })
  }, [annotations.pins, nextPin, draft, focus, display, view])

  // The note card a pin opened (by its number).
  const [openPin, setOpenPin] = React.useState<number | null>(null)
  const openPinAt = openPin === null ? null : (pins.find((p) => p.n === openPin && p.tone === "solid") ?? null)
  const openNote = openPinAt && pinNotes ? pinNotes.get(openPinAt.n) : null
  if (openPin !== null && !openNote) setOpenPin(null)
  const pinNotesRef = React.useRef(pinNotes)
  React.useEffect(() => {
    pinNotesRef.current = pinNotes
  }, [pinNotes])
  React.useEffect(() => {
    if (!viewer) return
    const group = new THREE.Group()
    for (const p of pins) {
      const el = document.createElement("div")
      el.className =
        p.tone === "ghost"
          ? "grid size-6 place-items-center rounded-full border-2 border-primary bg-background text-caption font-semibold text-primary shadow-popover"
          : "grid size-6 place-items-center rounded-full border-2 border-background bg-primary text-caption font-semibold text-primary-foreground shadow-popover"
      if (p.tone === "draft") el.classList.add("opacity-80")
      el.textContent = String(p.n)
      // Saved notes' pins open their card; hovering shows the words.
      const note = p.tone === "solid" ? pinNotesRef.current?.get(p.n) : null
      if (note) {
        el.classList.add("interactive", "cursor-pointer")
        el.title = note.text || note.about
        el.setAttribute("role", "button")
        el.setAttribute("aria-label", t(`备注 ${p.n}：${note.text || note.about}`, `Note ${p.n}: ${note.text || note.about}`))
        el.addEventListener("pointerdown", (e) => e.stopPropagation())
        el.addEventListener("click", (e) => {
          e.stopPropagation()
          setOpenPin(p.n)
        })
      }
      const o = new CSS2DObject(el)
      o.position.set(...p.point)
      group.add(o)
    }
    viewer.scene.add(group)
    viewer.invalidate()
    return () => {
      viewer.scene.remove(group)
      disposeObject(group)
      viewer.invalidate()
    }
  }, [viewer, pins, pinNotes])

  // Locating a note on an area: back to the view it was marked from, its strokes on the model, its box
  // over the view until the camera moves again.
  const focusRegion = focus?.region
  const [regionBox, setRegionBox] = React.useState<FocusRegion | null>(null)
  const [seenRegion, setSeenRegion] = React.useState(focusRegion)
  if (focusRegion !== seenRegion) {
    setSeenRegion(focusRegion)
    setRegionBox(focusRegion?.rect ? focusRegion : null)
  }
  React.useEffect(() => {
    if (!viewer || !focusRegion) return
    void viewer.flyTo(new THREE.Vector3(...focusRegion.camera.position), new THREE.Vector3(...focusRegion.camera.target))
    const lines = focusRegion.strokes ? regionStrokes(focusRegion.strokes, viewer.kit) : null
    if (lines) viewer.scene.add(lines)
    // Turning the view away puts the box out of place: it goes.
    let flying = true
    const t = window.setTimeout(() => (flying = false), 900)
    const moved = () => !flying && setRegionBox(null)
    viewer.controls.addEventListener("start", moved)
    viewer.invalidate()
    return () => {
      window.clearTimeout(t)
      viewer.controls.removeEventListener("start", moved)
      if (lines) {
        viewer.scene.remove(lines)
        disposeObject(lines)
      }
      viewer.invalidate()
    }
  }, [viewer, focusRegion])

  // The screenshot sent with annotations is taken from where the learner is looking.
  React.useEffect(() => {
    if (!viewer) return
    return viewer.onCameraChange(() => {
      annotations.viewDir.current.copy(viewer.camera.position).sub(viewer.controls.target).normalize()
    })
  }, [viewer, annotations.viewDir])

  // ---------------------------------------------------------------- clicking

  const words = useWords()
  // On the site nobody else changes the model: busy is a rebuild, said in the host's own words.
  const busyText = copy?.busy ?? (words.helper ? t(`${words.helper}正在改模型，这一轮结束后再标注`, `The ${words.helper} is changing the model. Add notes once this turn ends.`) : words.busy)
  const latest = React.useRef({ studio, busy, busyText, display, open: annotations.open, cancel: annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view, onOpenPart, sketching })
  const pickRevision = React.useRef(0)
  React.useEffect(() => { pickRevision.current++ }, [annotation, measuring, display, view, busy])
  React.useEffect(() => {
    latest.current = { studio, busy, busyText, display, open: annotations.open, cancel: annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view, onOpenPart, sketching }
  }, [studio, busy, busyText, display, annotations.open, annotations.cancel, measuring, plane, reselect, readOnly, annotation, onPointFeature, onSelectFeature, view, onOpenPart, sketching])

  React.useEffect(() => {
    if (!viewer) return
    const canvas = viewer.renderer.domElement
    const revisions = pickRevision
    const press: { at: { x: number; y: number } | null } = { at: null }
    const onDown = (e: PointerEvent) => {
      press.at = e.button === 0 ? { x: e.clientX, y: e.clientY } : null
    }
    const onUp = (e: PointerEvent) => {
      const at = press.at
      press.at = null
      if (at && Math.hypot(e.clientX - at.x, e.clientY - at.y) <= CLICK_PX) void onClick(e)
    }
    const onClick = async (e: PointerEvent) => {
      const revision = ++pickRevision.current
      const { studio: s, busy: isBusy, busyText: whyBusy, display: d, open, cancel, measuring: isMeasuring, plane: cut, reselect: rsel } = latest.current
      if (!latest.current.annotation && !isMeasuring && !rsel?.state) {
        const meshes = pickable(current.current)
        const hit = pickVisible(viewer, e, meshes, cut)
        const group = hit ? groupAt(hit) : null
        // A click takes the whole part (every piece it was split into); ⌥ takes only the piece under the pointer.
        latest.current.onSelectFeature?.(group?.origin ?? null, group?.part, e.shiftKey, e.altKey)
        return
      }
      if (isBusy) return notify(whyBusy)
      if (isMeasuring && (latest.current.view.explode > 0 || hasMoves(latest.current.view))) return notify(t("测量用的是装配位置：先把爆炸拖回 0、挪开的零件移回原位。分开时仍可选件和标注。", "Measuring uses assembled positions: drag explode back to 0 and move parts back first. While apart you can still select parts and add notes."))
      // The model's own mesh (not a see-through reference body, which can't be picked).
      const meshes = pickable(current.current)
      if (!d?.mesh || !meshes.length || s.kernel.phase !== "ready") return
      const { edge, face } = pickTargets(viewer, d, meshes, e, cut, latest.current.view)
      if (rsel?.state) return void rsel.toggle({ edge: edge?.hash ?? null, face: face?.hash ?? null })
      if (isMeasuring) {
        if (s.rollback) return notify(t("先回到最新一步，再测量", "Go back to the latest step to measure"))
        if (!edge && !face) return setPicked([])
        // Same rule as annotating: a fillet's tangent line means the face under the pointer.
        const info = edge ? await s.pick("edge", edge.hash, edge.point) : null
        if (revision !== pickRevision.current) return
        const target: MeasureTarget = edge && info && !info.smooth ? { kind: "edge", ...edge } : face ? { kind: "face", ...face } : { kind: "edge", ...edge! }
        setPicked((p) => (p.some((x) => x.kind === target.kind && x.hash === target.hash) ? p.filter((x) => x.hash !== target.hash) : p.length >= 2 ? [target] : [...p, target]))
        return
      }
      if (!edge && !face) return cancel()
      if (latest.current.readOnly) return
      if (s.rollback) return notify(t("先回到最新一步，再在模型上标注", "Go back to the latest step to add notes on the model"))
      let info = edge ? await s.pick("edge", edge.hash, edge.point) : null
      // A fillet's tangent line looks like an edge but has no corner: the face under the pointer is what's meant.
      if ((!info || info.smooth) && face) info = (await s.pick("face", face.hash, face.point)) ?? info
      if (revision !== pickRevision.current) return
      if (info) {
        const part = (info.kind === "face" ? d.groups : d.edgeGroups).find((g) => g.hash === info.hash)?.part
        open({ ...info, part: part === undefined ? undefined : d.parts?.[part]?.name })
      }
    }
    const hoverFrame = { current: 0 }
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(hoverFrame.current)
      hoverFrame.current = requestAnimationFrame(() => {
        if (e.buttons || !latest.current.onPointFeature || latest.current.annotation) return
        const meshes = pickable(current.current)
        const hit = pickVisible(viewer, e, meshes, latest.current.plane)
        const group = hit ? groupAt(hit) : null
        latest.current.onPointFeature(group?.origin ?? null, group?.part, e.altKey)
      })
    }
    const onLeave = () => { cancelAnimationFrame(hoverFrame.current); latest.current.onPointFeature?.(null) }
    // A double-click on a part (selecting, not noting or measuring) opens its own file.
    const onDouble = (e: MouseEvent) => {
      const l = latest.current
      if (!l.onOpenPart || l.annotation || l.measuring || l.sketching || l.reselect?.state) return
      const meshes = pickable(current.current)
      const hit = pickVisible(viewer, e, meshes, l.plane)
      const part = hit ? groupAt(hit)?.part : undefined
      if (part !== undefined) l.onOpenPart(part)
    }
    canvas.addEventListener("dblclick", onDouble)
    canvas.addEventListener("pointermove", onMove)
    canvas.addEventListener("pointerleave", onLeave)
    canvas.addEventListener("pointerdown", onDown)
    canvas.addEventListener("pointerup", onUp)
    return () => {
      revisions.current++
      cancelAnimationFrame(hoverFrame.current)
      canvas.removeEventListener("dblclick", onDouble)
      canvas.removeEventListener("pointermove", onMove)
      canvas.removeEventListener("pointerleave", onLeave)
      canvas.removeEventListener("pointerdown", onDown)
      canvas.removeEventListener("pointerup", onUp)
    }
  }, [viewer])

  const selectionNames = selectedParts.flatMap((i) => display?.parts?.[i] ? [display.parts[i].name] : [])
  // A part selected with all its pieces reads as that one part, not as so many pieces.
  const selectionLabels = display?.parts ? wholeNames(display.parts, selectionNames) : selectionNames
  const hiddenLabels = display?.parts ? wholeNames(display.parts, [...view.hidden].flatMap((i) => (display.parts![i] ? [display.parts![i].name] : []))).length : view.hidden.size
  /** Everything selected was placed by one component of the assembly: ↵ can open it. */
  const oneComponent = selectedParts.length > 0 && selectedParts.every((i) => (display?.parts?.[i]?.component ?? i) === (display?.parts?.[selectedParts[0]]?.component ?? selectedParts[0]))
  // H hides the selected parts, ⇧H brings every hidden one back (the eyes in the tree do one at a time).
  const hideSelected = () => {
    if (!onParts || !selectionNames.length) return
    onParts({ ...view, hidden: new Set([...view.hidden, ...selectedParts]) })
    onSelectFeature?.(null)
  }
  const showAll = () => onParts?.({ ...view, hidden: new Set() })
  const focusMatches = !!view.focus && selectionNames.length === view.focus.parts.length && selectionNames.every((n) => view.focus!.parts.includes(n))
  const isolateSelected = () => {
    if (!onParts) return
    if (view.focus && (focusMatches || !selectionNames.length)) return onParts({ ...view, focus: undefined })
    if (selectionNames.length) onParts({ ...view, focus: { parts: selectionNames, mode: "isolate" } })
  }
  const ghostOthers = () => {
    if (!onParts || !selectionNames.length) return
    onParts({ ...view, focus: focusMatches && view.focus?.mode === "ghost" ? undefined : { parts: selectionNames, mode: "ghost" } })
  }
  // Selected parts can be pulled out along X, Y or Z to look at them: arrows at their middle. Only the
  // view moves them (`view.moved`); the file keeps where they are, and 「移回原位」 puts them back.
  const canMove = tool === "select" && !rs && !!onParts && !!display?.parts && display.parts.length > 1 && selectedParts.length > 0
  // What a drag moves: the selected parts that are shown (the arrows stand in their middle).
  const movable = display?.parts ? selectedParts.flatMap((i) => (partVisible(display, view, i) ? [display.parts![i].name] : [])) : []
  const moving = React.useRef({ view, onParts, names: movable })
  React.useLayoutEffect(() => {
    moving.current = { view, onParts, names: movable }
  })
  const [gizmo, setGizmo] = React.useState<MoveGizmo | null>(null)
  React.useEffect(() => {
    if (!viewer || !canMove) return
    // Where each selected part was when the drag began: the drag moves them all by the same amount from there.
    const from = new Map<string, V3>()
    const g = new MoveGizmo(viewer, {
      start: () => {
        const { view: v, names } = moving.current
        from.clear()
        for (const n of names) from.set(n, v.moved?.[n] ?? [0, 0, 0])
      },
      move: (axis, mm) => {
        const { view: v, onParts: set } = moving.current
        const moved = { ...v.moved }
        for (const [name, was] of from) {
          const to = [...was] as V3
          to[axis] = Math.round((was[axis] + mm) * 1e6) / 1e6
          moved[name] = to
        }
        set?.({ ...v, moved })
      },
    })
    setGizmo(g)
    return () => {
      g.dispose()
      setGizmo(null)
    }
  }, [viewer, canMove])
  // The arrows stand in the middle of the selected parts as shown, and go along with them.
  React.useEffect(() => {
    if (!gizmo || !display) return
    const box = partsBox(display, view, selectedParts.filter((i) => partVisible(display, view, i)))
    gizmo.setAt(box ? box.getCenter(new THREE.Vector3()) : null)
  }, [gizmo, display, view, selectedParts])
  const movedNames = Object.entries(view.moved ?? {}).flatMap(([name, m]) => (m.some((x) => x !== 0) && display?.parts?.some((p) => p.name === name) ? [name] : []))
  const selectionMoved = selectionNames.some((n) => movedNames.includes(n))
  const movedElsewhere = movedNames.some((n) => !selectionNames.includes(n))
  const movedLabels = display?.parts ? wholeNames(display.parts, movedNames).length : movedNames.length
  const moveBack = (names?: string[]) => onParts?.(withoutMoves(view, names))

  // 「导出视图」: what the view shows, from where it looks now.
  const exportView = async (o: ExportViewOptions) => {
    if (!viewer || !display?.mesh) return
    // A copy without the lights that ride on the view's camera.
    const eye = viewer.eye
    const camera = eye instanceof THREE.OrthographicCamera ? new THREE.OrthographicCamera().copy(eye, false) : new THREE.PerspectiveCamera().copy(eye, false)
    const { w, h } = viewer.size
    try {
      if (o.format === "png") {
        // Twice the view's size (as sharp as a Retina screen), at most 4096 px on the long side.
        const k = Math.min(2, 4096 / Math.max(w, h))
        const data = renderPicture(display, { camera, width: Math.round(w * k), height: Math.round(h * k), view, style, looks: coloured, section: plane, background: o.background })
        if (!data) return void notify(t("还没有东西可以导出", "Nothing to export yet"))
        await onSaveFigure({ format: "png", data })
      } else {
        const figure = lineFigure(display, { camera, width: w, height: h, view, section: plane, hidden: o.hidden, labels: o.labels, labelParts: selectedParts.length ? selectedParts : undefined })
        if (!figure) return void notify(t("这个视角下没有可画的线", "No lines to draw from this angle"))
        await onSaveFigure({ format: "svg", data: figure.svg })
      }
    } catch (e) {
      notify.error(t(`导出没成功：${(e as Error)?.message ?? e}`, `Export failed: ${(e as Error)?.message ?? e}`))
    }
  }

  /** F: the selected parts, or everything (pulled apart and moved as shown). */
  const frame = () => {
    if (!viewer || !display?.bbox) return
    const box = selectedParts.length ? facesBox(display, view, (g) => g.part !== undefined && selectedParts.includes(g.part)) : null
    if (box) return void viewer.fit(new THREE.Box3(new THREE.Vector3(...box[0]), new THREE.Vector3(...box[1])), { animate: true })
    if (display.parts && (parts.explode > 0 || hasMoves(view))) return frameShown()
    void viewer.fit(new THREE.Box3(new THREE.Vector3(...display.bbox[0]), new THREE.Vector3(...display.bbox[1])), { animate: true })
  }

  // The view's one-letter keys (the card behind ? lists them). Not while typing, in a dialog or a menu,
  // with ⌘ / Ctrl / ⌥ held, or while the drawing sheet covers the view. By key position, so they work
  // with a Chinese input method on too. Esc goes back one level at a time: the open card or panel
  // handles its own, then the tool, then (the timeline's own handler) the selection and the step.
  const keyActions = { tool, chooseTool, sketch, onAnnotation, onNoteSelection, selectedParts, section, bbox: display?.bbox ?? null, showDims, dimsTotal: shownDims.total, explodable: Boolean(display?.parts && display.parts.length > 1), exploding, openExplode, look, chooseLook, hasLooks: hasLooks(display), prefs, setPrefs, canHide: Boolean(onParts && display?.parts), hideSelected, showAll, isolateSelected, ghostOthers, oneComponent, frame, onOpenPart, busyCard: Boolean(draft || keysOpen || editingDim || openNote), stopMeasuring }
  const keyRef = React.useRef(keyActions)
  React.useEffect(() => {
    keyRef.current = keyActions
  })
  React.useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.isComposing) return
      const target = e.target as HTMLElement | null
      if (target?.closest?.("input, textarea, select, [contenteditable=true], [role=dialog], [role=alertdialog], [role=menu], [role=listbox]")) return
      const k = keyRef.current
      const handled = () => {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
      if (e.key === "Escape") {
        if (k.busyCard) return
        if (k.tool === "box" || k.tool === "pen") return handled(), k.chooseTool("select")
        if (k.tool === "measure") return handled(), k.stopMeasuring()
        if (k.tool === "note") return handled(), k.chooseTool("select")
        return
      }
      if (e.repeat) return
      if (e.key === "?") return handled(), setKeysOpen(true)
      if (e.key === "Enter") {
        if (target?.closest?.("button, a, [role=button], [role=tab], [role=separator]")) return
        if (k.onOpenPart && k.oneComponent) return handled(), k.onOpenPart(k.selectedParts[0], e.shiftKey)
        return
      }
      if (e.shiftKey && e.code !== "KeyH") return
      switch (e.code) {
        case "KeyV":
          if (k.onAnnotation) return handled(), k.chooseTool("select")
          return
        case "KeyC":
          if (k.onNoteSelection && k.selectedParts.length) return handled(), k.onNoteSelection()
          if (k.onAnnotation) return handled(), k.chooseTool(k.tool === "note" ? "select" : "note")
          return
        case "KeyR":
          if (k.sketch) return handled(), k.chooseTool("box")
          return
        case "KeyP":
          if (k.sketch) return handled(), k.chooseTool("pen")
          return
        case "KeyM":
          return handled(), k.chooseTool(k.tool === "measure" ? "select" : "measure")
        case "KeyX":
          if (k.bbox) return handled(), setSection(k.section ? null : newSection(k.bbox))
          return
        case "KeyD":
          if (k.dimsTotal) return handled(), setShowDims(!k.showDims)
          return
        case "KeyE":
          if (k.explodable) return handled(), k.openExplode(!k.exploding)
          return
        case "KeyA":
          // 白模 ⇄ 彩色 (from a line drawing or see-through, to 彩色); nothing to colour, nothing to switch.
          if (k.hasLooks) return handled(), k.chooseLook(colourKey(k.look))
          return
        case "KeyO":
          return handled(), k.setPrefs({ projection: k.prefs.projection === "perspective" ? "orthographic" : "perspective" })
        case "KeyW":
          return handled(), k.chooseLook(nextLook(k.look))
        case "KeyF":
          return handled(), k.frame()
        case "KeyH":
          if (!k.canHide) return
          handled()
          return e.shiftKey ? k.showAll() : k.hideSelected()
        case "KeyI":
          if (k.canHide) return handled(), k.isolateSelected()
          return
        case "KeyT":
          if (k.canHide && k.selectedParts.length) return handled(), k.ghostOthers()
          return
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [active])
  return (
    <Viewport className="absolute inset-0" onReady={onReady} triadBesideCube>
      {onParts && display?.parts && (selectedParts.length > 0 || view.focus || view.hidden.size > 0 || movedNames.length > 0) && (
        <div role="toolbar" aria-label={t("选中零件", "Selected parts")} className="absolute left-3 z-20 flex max-w-[calc(100%_-_1.5rem)] flex-wrap items-center gap-0.5 rounded-md border bg-background/95 p-1 shadow-popover [&_button]:px-2" style={{ bottom: "calc(var(--timeline-h, 0px) + 1.25rem)" }}>
          <span className="max-w-48 truncate px-2 text-caption" title={selectionLabels.join(t("、", ", "))}>
            {selectionLabels.length > 1
              ? t(`已选 ${selectionLabels.length} 个零件`, `${selectionLabels.length} parts selected`)
              : (selectionLabels[0] ??
                (view.focus
                  ? t(`${view.focus.mode === "ghost" ? "保留实体" : "已隔离"} ${wholeNames(display.parts, view.focus.parts).length} 个零件`, `${countParts(wholeNames(display.parts, view.focus.parts).length)} ${view.focus.mode === "ghost" ? "kept solid" : "isolated"}`)
                  : view.hidden.size
                    ? t(`已隐藏 ${hiddenLabels} 个零件`, `${countParts(hiddenLabels)} hidden`)
                    : t(`已挪开 ${movedLabels} 个零件`, `${countParts(movedLabels)} moved`)))}
          </span>
          {selectionNames.length > 0 && selectionActions}
          {selectionNames.length > 0 && selectionActions && <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />}
          <Button size="sm" variant="ghost" disabled={!selectionNames.length} onClick={hideSelected}>{t("隐藏", "Hide")}<Kbd>H</Kbd></Button>
          <Button size="sm" variant={focusMatches && view.focus?.mode === "isolate" ? "secondary" : "ghost"} aria-pressed={focusMatches && view.focus?.mode === "isolate"} disabled={!selectionNames.length} onClick={isolateSelected}>{t("隔离", "Isolate")}<Kbd>I</Kbd></Button>
          <Button size="sm" variant={focusMatches && view.focus?.mode === "ghost" ? "secondary" : "ghost"} aria-pressed={focusMatches && view.focus?.mode === "ghost"} disabled={!selectionNames.length} onClick={ghostOthers}>{t("其余透明", "See-through rest")}<Kbd>T</Kbd></Button>
          {onLocateStep && <Button size="sm" variant="ghost" onClick={onLocateStep}>{t("定位步骤", "Find step")}</Button>}
          {selectionNames.length > 0 && <Button size="sm" variant="ghost" onClick={() => onSelectFeature?.(null)}>{t("清除选择", "Clear selection")}<Kbd>Esc</Kbd></Button>}
          {view.focus && <Button size="sm" variant="ghost" onClick={() => onParts({ ...view, focus: undefined })}>{t("恢复显示", "Show all again")}{!selectionNames.length && <Kbd>I</Kbd>}</Button>}
          {view.hidden.size > 0 && <Button size="sm" variant="ghost" onClick={showAll}>{t(`显示隐藏的 ${hiddenLabels} 个`, `Show ${hiddenLabels} hidden`)}<Kbd>⇧H</Kbd></Button>}
          {selectionMoved && <Button size="sm" variant="ghost" title={t("选中的零件回到文件里的位置", "Return the selected parts to where the file puts them")} onClick={() => moveBack(selectionNames)}>{t("移回原位", "Move back")}</Button>}
          {movedElsewhere && <Button size="sm" variant="ghost" title={t("挪开的零件都回到文件里的位置", "Return every moved part to where the file puts it")} onClick={() => moveBack()}>{t("全部移回原位", "Move all back")}</Button>}
        </div>
      )}
      {kernel.phase === "loading" && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex items-center gap-2 rounded-md border bg-background px-4 py-3 text-body">
            <Spinner className="size-4" />
            {t("正在加载建模内核（OpenCascade）…", "Loading the modeling kernel (OpenCascade)…")}
            {/* The worker counts the wasm as it arrives, uncompressed; the build knows its whole size. */}
            {kernel.loadedMB > 0 && <span className="tabular text-muted-foreground">{Math.min(99, Math.round(((kernel.loadedMB * 1048576) / __KERNEL_WASM_BYTES__) * 100))}%</span>}
          </div>
        </div>
      )}
      {kernel.phase === "error" && (
        <div className="absolute inset-0 grid place-items-center p-6">
          <div role="alert" className="max-w-sm rounded-md border border-destructive/40 bg-background p-4 text-body">
            {t("建模内核没能启动：", "The modeling kernel didn’t start: ")}
            {kernel.message}
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => location.reload()}>
                {t("重新加载", "Reload")}
              </Button>
            </div>
          </div>
        </div>
      )}
      {measuring && <MeasurePanel result={result} count={picked.length} onClose={stopMeasuring} />}
      {display?.mesh && kernel.phase === "ready" && !rs && (
        <ViewTools
          tool={tool}
          onTool={chooseTool}
          notes={Boolean(onAnnotation)}
          sketch={Boolean(sketch) && !readOnly}
          section={section}
          onSection={setSection}
          bbox={display.bbox}
          dims={{ on: showDims, shown: Math.min(DIMS_SHOWN, shownDims.total), total: shownDims.total }}
          onDims={setShowDims}
          explode={display.parts && display.parts.length > 1 ? parts.explode : null}
          exploding={exploding}
          onExploding={openExplode}
          onExplode={(explode) => {
            viewer?.tweens.cancel("explode")
            onParts?.({ ...parts, explode })
          }}
          onExplodeEnd={() => frameShown()}
          display={{ look, projection: prefs.projection, colours: hasLooks(display), canSetColours: !readOnly }}
          onDisplay={(d) => {
            if (d.look) chooseLook(d.look)
            if (d.projection) setPrefs({ projection: d.projection })
          }}
          onExportView={exportView}
          numbered={Boolean(display.parts && display.parts.length > 1)}
          changes={showChanges}
          onChanges={setShowChanges}
          keysOpen={keysOpen}
          onKeysOpen={setKeysOpen}
          keys={[...VIEW_KEYS.filter((k) => (onAnnotation || !"VCRP".includes(k.keys)) && (sketch || !"RP".includes(k.keys)) && (onParts || !["H / ⇧H", "I", DRAG_ARROWS].includes(k.keys)) && (onSelectFeature || k.keys !== DRAG_ARROWS)), ...keys]}
          tips={[
            ...(readOnly || copy?.hint === null ? [] : [t(`${copy?.hint ?? "单击模型上的面或边，标注要改的地方"}。`, `${copy?.hint ?? "Click a face or edge on the model to mark what to change"}.`)]),
            t("拖动转视角，滚轮缩放；拖右上角的方块也能转，点它的面、棱或角转到对应的视图。", "Drag to orbit, scroll to zoom. The cube at top right turns the view too: click a face, edge or corner of it for that view."),
            ...(onParts && onSelectFeature && display.parts && display.parts.length > 1 ? [t("选中零件后拖它中间的 X / Y / Z 箭头，把它挪开看；只改视图，不改文件。", "Select a part, then drag its X / Y / Z arrows to move it aside. Only the view changes, not the file.")] : []),
          ]}
        />
      )}
      {rs && (
        <div role="status" className="pointer-events-none absolute top-3 left-1/2 max-w-[calc(100%-12rem)] -translate-x-1/2 rounded-md border border-primary bg-background/95 px-2.5 py-1 text-center text-caption text-foreground">
          {/* A step being made by hand isn't in the tree yet: the model it will start from. */}
          {studio.tree.features[rs.index]?.id === rs.feature
            ? t(`现在显示的是「${displayName(studio.tree, studio.tree.features[rs.index])}」之前的样子：`, `Showing the model before “${displayName(studio.tree, studio.tree.features[rs.index])}”: `)
            : t("现在显示的是这一步开始时的样子：", "Showing the model this step starts from: ")}
          {rs.kind === "edge"
            ? t("点要选的边，再点一次取消；点一个面等于选它的一圈边", "click edges to pick, click again to drop; clicking a face picks the edges around it")
            : t("点要选的面，再点一次取消", "click faces to pick, click again to drop")}
          {t("。Esc 退出", ". Esc to exit")}
        </div>
      )}
      {editingDim && !busy && (
        <DimEditor key={editingDim.dim.id} dim={studio.dims.find((d) => d.id === editingDim.dim.id) ?? editingDim.dim} anchor={editingDim.el} studio={studio} onClose={() => setEditingDim(null)} />
      )}
      {regionBox?.rect && (
        <div
          aria-hidden
          className="pointer-events-none absolute z-[5] rounded-sm border-2 border-primary bg-primary/5"
          style={{ left: `${regionBox.rect[0] * 100}%`, top: `${regionBox.rect[1] * 100}%`, width: `${(regionBox.rect[2] - regionBox.rect[0]) * 100}%`, height: `${(regionBox.rect[3] - regionBox.rect[1]) * 100}%` }}
        />
      )}
      {viewer && display && sketch && sketching && (
        <SketchLayer
          key={sketching}
          viewer={viewer}
          shape={sketching}
          gather={(marks) => {
            const meshes = pickable(current.current)
            return gatherRegion(viewer, display, (at) => pickVisible(viewer, at, meshes, plane), marks)
          }}
          onSave={sketch.save}
          onClose={() => chooseTool(sketchFrom.current)}
        />
      )}
      {viewer && openPinAt && openNote && pinNotes && (
        <PinNoteCard
          key={openPinAt.n}
          viewer={viewer}
          point={openPinAt.point}
          note={openNote}
          onSave={(text) => pinNotes.save(openPinAt.n, text)}
          onResolve={() => {
            pinNotes.resolve(openPinAt.n)
            setOpenPin(null)
          }}
          onRemove={() => {
            pinNotes.remove(openPinAt.n)
            setOpenPin(null)
          }}
          onClose={() => setOpenPin(null)}
        />
      )}
      {viewer && draft && (
        <AnnotationCard
          key={`${draft.kind}-${draft.hash}-${draft.point.join(",")}`}
          viewer={viewer}
          draft={draft}
          offset={display ? partOffset(display, view, display.parts?.findIndex((p) => p.name === draft.part)) : [0, 0, 0]}
          n={nextPin}
          addLabel={copy?.add ?? t("加到消息", "Add to message")}
          onAdd={annotations.add}
          onCancel={annotations.cancel}
        />
      )}
    </Viewport>
  )
}

/** At most this many dimensions with 「显示尺寸」 on, parameters first. */
const DIMS_SHOWN = 12

/** "3 parts", for the selection bar in English. */
const countParts = (n: number) => `${n} ${n === 1 ? "part" : "parts"}`

/**
 * The hover from a panel row, held a moment after the pointer leaves it, and
 * for as long as it rests on a dimension label: so the learner can travel from
 * the row to the label and click it.
 */
function useHeldHover(hover: Hover | null) {
  const [last, setLast] = React.useState<Hover | null>(hover)
  const [expired, setExpired] = React.useState(false)
  const [onLabel, setOnLabel] = React.useState(false)
  if (hover && (hover !== last || expired)) {
    setLast(hover)
    setExpired(false)
  }
  React.useEffect(() => {
    if (hover || onLabel) return
    const t = window.setTimeout(() => setExpired(true), 1200)
    return () => window.clearTimeout(t)
  }, [hover, onLabel])
  return { hover: hover ?? (expired ? null : last), setLabelPointed: setOnLabel }
}

type Target = { hash: number; point: V3 }

/** The model's own meshes that can be clicked: shown ones, and not a see-through reference body. */
const pickable = (root: THREE.Object3D | null) => root?.children.filter((c): c is THREE.Mesh => (c as THREE.Mesh).isMesh && c.visible && !c.userData.reference) ?? []

/** Prefer solid geometry behind transparent context; context remains selectable in empty space. */
function pickVisible(viewer: Viewer, e: { clientX: number; clientY: number }, meshes: THREE.Object3D[], cut: THREE.Plane | null) {
  const accept = (h: THREE.Intersection, ray: THREE.Ray) => (!cut || cut.distanceToPoint(h.point) >= -1e-6) && (!cut || !h.face || h.face.normal.dot(ray.direction) < 0)
  const solid = meshes.filter((m) => !m.userData.contextGhost)
  // Nothing see-through: the second look would find the same nothing.
  return viewer.pick(e, solid, false, accept) ?? (solid.length < meshes.length ? viewer.pick(e, meshes, false, accept) : null)
}

/**
 * The face under the pointer, and an edge within a few pixels of it that isn't hidden behind that face.
 * With a section on, what the plane cut away can't be picked, nor the back faces seen through the cut.
 */
function pickTargets(viewer: Viewer, d: DisplayData, meshes: THREE.Mesh[], e: PointerEvent, cut: THREE.Plane | null = null, view: PartsView = NO_PARTS_VIEW): { edge: Target | null; face: Target | null } {
  const kept = (p: THREE.Vector3) => !cut || cut.distanceToPoint(p) >= -1e-6
  const hit = pickVisible(viewer, e, meshes, cut)
  const edge = nearestEdge(viewer, d, e, e.pointerType === "touch" ? 14 : 8, hit ?? undefined, kept, view, hit ? groupAt(hit)?.part : undefined)
  return { edge, face: hit ? faceTarget(hit) : null }
}

function nearestEdge(viewer: Viewer, d: DisplayData, e: PointerEvent, maxPx: number, face?: THREE.Intersection, kept: (p: THREE.Vector3) => boolean = () => true, view: PartsView = NO_PARTS_VIEW, hitPart?: number) {
  const pts = d.edges
  if (!pts) return null
  const rect = viewer.renderer.domElement.getBoundingClientRect()
  const mx = e.clientX - rect.left
  const my = e.clientY - rect.top
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  // Edges on the far side sit deeper than the face under the pointer (by more than a little, which grows
  // with how far off the face is: on a drawing as well, where every pick's ray starts far behind).
  const faceDistance = face?.distance
  const slack = face ? Math.max(0.5, face.point.distanceTo(viewer.camera.position) * 0.02) : Infinity
  let best: { hash: number; point: V3; px: number } | null = null
  for (const g of d.edgeGroups) {
    if (g.part !== undefined && (!partVisible(d, view, g.part) || (hitPart !== undefined && g.part !== hitPart))) continue
    const offset = new THREE.Vector3(...partOffset(d, view, g.part))
    for (let i = g.start; i + 1 < g.start + g.count; i += 2) {
      a.fromArray(pts, i * 3).add(offset)
      b.fromArray(pts, (i + 1) * 3).add(offset)
      const pa = viewer.project(a)
      const pb = viewer.project(b)
      if (pa.behind || pb.behind) continue
      const vx = pb.x - pa.x
      const vy = pb.y - pa.y
      const len2 = vx * vx + vy * vy
      const t = len2 > 0 ? Math.min(1, Math.max(0, ((mx - pa.x) * vx + (my - pa.y) * vy) / len2)) : 0
      const px = Math.hypot(pa.x + t * vx - mx, pa.y + t * vy - my)
      if (px > maxPx || (best && px >= best.px)) continue
      const p = a.clone().lerp(b, t)
      if (!kept(p)) continue
      if (faceDistance !== undefined && viewer.depthOf(p) > faceDistance + slack) continue
      best = { hash: g.hash, point: p.sub(offset).toArray() as V3, px }
    }
  }
  return best && { hash: best.hash, point: best.point }
}

/** The note card next to a fresh pick. Hidden while the camera moves, then placed again. */
function AnnotationCard({
  viewer,
  offset,
  draft,
  n,
  addLabel,
  onAdd,
  onCancel,
}: {
  viewer: Viewer
  offset: V3
  draft: PickInfo
  n: number
  addLabel: string
  onAdd: (note: string) => void
  onCancel: () => void
}) {
  const [note, setNote] = React.useState("")
  const [moving, setMoving] = React.useState(false)
  const [place, setPlace] = React.useState(0)
  const anchor = React.useRef({ getBoundingClientRect: () => new DOMRect() })

  // Re-anchor to the pick whenever the view settles (and for a new pick).
  React.useLayoutEffect(() => {
    const p = viewer.project(new THREE.Vector3(...draft.point).add(new THREE.Vector3(...offset)))
    const r = viewer.renderer.domElement.getBoundingClientRect()
    anchor.current = { getBoundingClientRect: () => new DOMRect(r.left + p.x, r.top + p.y, 0, 0) }
  }, [viewer, draft, place, offset])

  React.useEffect(() => {
    const start = () => setMoving(true)
    const end = () => {
      setMoving(false)
      setPlace((k) => k + 1)
    }
    viewer.controls.addEventListener("start", start)
    viewer.controls.addEventListener("end", end)
    return () => {
      viewer.controls.removeEventListener("start", start)
      viewer.controls.removeEventListener("end", end)
    }
  }, [viewer])

  const add = () => onAdd(note)
  // Beside the pin on wide screens; below it on a phone, where there's no room to the side.
  const [narrow] = React.useState(() => window.matchMedia("(max-width: 640px)").matches)
  return (
    <Popover open={!moving} onOpenChange={(open) => !open && onCancel()}>
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        key={`${draft.hash}-${place}`}
        side={narrow ? "bottom" : "right"}
        align={narrow ? "center" : "start"}
        sideOffset={16}
        className="w-80 max-w-[calc(100vw-1rem)]"
        aria-label={t(`标注 ${circled(n)}`, `Note ${circled(n)}`)}
        // Clicks on the model pick something else or drag the camera; they don't dismiss the card.
        onInteractOutside={(e) => {
          if (viewer.renderer.domElement.contains(e.target as Node)) e.preventDefault()
        }}
      >
        <div className="text-body font-medium">
          {circled(n)} {draft.kind === "face" ? t("面", "Face") : t("边", "Edge")} · {draft.what}
        </div>
        <div className="mt-0.5 text-small text-muted-foreground">
          {draft.where} · {draft.facts}
        </div>
        <Textarea
          className="mt-3 resize-none"
          rows={3}
          value={note}
          placeholder={draft.kind === "face" ? t("这里想怎么改？例如：开一个 ⌀8 的通孔", "What should change here? e.g. a ⌀8 through hole") : t("这条边想怎么改？例如：倒 R3 圆角", "What should change on this edge? e.g. an R3 fillet")}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              add()
            }
          }}
          aria-label={t("标注备注", "Note text")}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            {t("取消", "Cancel")}
          </Button>
          <Button size="sm" variant="primary" onClick={add}>
            {addLabel}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
