import * as React from "react"
import { createPortal } from "react-dom"
import { Tooltip as TooltipPrimitive } from "radix-ui"
import { CircleAlert, CircleDashed, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { OpIcon } from "@/components/op-icon"
import { displayName, type Feature } from "../dsl"
import type { Dim } from "../kernel/dims"
import { NO_PARTS_VIEW, type Hover, type PartsView } from "../scene"
import { cardDims, labelLeft, namedStep, stepLabel, stepLine } from "../step-timeline"
import { StepPanel } from "./step-panel"
import { iconOf } from "../feature-icon"
import type { Annotations } from "../use-annotations"
import type { Reselect } from "../use-reselect"
import type { Studio } from "../use-studio"
import { Hint } from "@/components/hint"
import { setPartLook, type LookChange } from "../appearance"
import { LookDot, LookPicker } from "./look-picker"


/** How long the pointer rests on a step before its card opens (then neighbours open at once). */
const CARD_DELAY = 400

/**
 * The feature tree as a timeline along the bottom of the 3D view: one small icon per feature. It never
 * changes size; pointed at (or with a step open) it only lights up. The step pointed at gets its name
 * under its icon (none pointed at: the step open or rolled back to), and its faces light up in the
 * model; resting on it a moment brings a small card over it. Click a step: the model goes back to it
 * and its details open in the side panel (`detailsIn`), live (dimensions, re-pick, delete); click it
 * again, 关闭 or Esc to come back to the latest. `readOnly` (a shared link): look only. `timeline` off
 * (an assembly, whose parts are listed elsewhere): only the details of the selected step.
 *
 * Its height is published on the parent as `--timeline-h`, so what sits above it (the selected
 * parts' toolbar) keeps clear of it.
 */
export function TreeOverlay({
  studio,
  onHover,
  reselect,
  annotations,
  busy = false,
  parts = NO_PARTS_VIEW,
  onParts,
  readOnly = false,
  selectedFeature,
  locateStep,
  onSelectFeature,
  partsList = true,
  looks = true,
  detailsIn,
  timeline = true,
  onDetails,
}: {
  studio: Studio
  onHover: (h: Hover | null) => void
  reselect?: Reselect
  annotations?: Annotations
  busy?: boolean
  parts?: PartsView
  onParts?: (v: PartsView) => void
  /** A shared link: a click rolls back to that step; nothing to change. */
  readOnly?: boolean
  selectedFeature?: string | null
  locateStep?: { id: string; request: number } | null
  onSelectFeature?: (id: string | null) => void
  /** The list of parts with their eyes over the timeline (off when the steps carry them). */
  partsList?: boolean
  /** Colour pickers for the part and its parts (off in an assembly: its sidebar has them). */
  looks?: boolean
  /** Where a step's details go: an empty layer over the host's side panel. */
  detailsIn: HTMLElement | null
  /** Off: no strip of steps, only the selected step's details (an assembly). */
  timeline?: boolean
  /** Which step's details are open (pinned or selected), so the host can show its panel. */
  onDetails?: (id: string | null) => void
}) {
  const { tree, report, rollback } = studio
  const list = React.useRef<HTMLOListElement>(null)
  const nav = React.useRef<HTMLElement>(null)
  /** The strip of steps (not scrolled) and the one name under it. */
  const strip = React.useRef<HTMLDivElement>(null)
  const label = React.useRef<HTMLSpanElement>(null)
  /** The step pointed at (or focused). */
  const [peek, setPeek] = React.useState<string | null>(null)
  /** The step clicked: the model shows it and the panel stays on it. */
  const [pinned, setPinned] = React.useState<string | null>(null)
  /** A step double-clicked: its details open with the name being edited (cleared once it is). */
  const [renaming, setRenaming] = React.useState<string | null>(null)
  /** The name under the strip isn't all there (cut short, or its step scrolled away): the card spells it out. */
  const [nameHidden, setNameHidden] = React.useState(false)
  const rollbackIndex = rollback ? tree.features.findIndex((x) => x.id === rollback) : -1
  const last = tree.features.at(-1)?.id ?? null

  // The view went elsewhere (「回到最新」, a link in the chat, the step deleted): let go of the pinned step.
  if (pinned && rollback !== pinned && !(rollback === null && pinned === last)) setPinned(null)

  // A new step (the helper building) scrolls the timeline to the end; a rollback brings its step into view.
  const count = tree.features.length
  const seen = React.useRef(count)
  React.useEffect(() => {
    const el = list.current
    if (el && count > seen.current) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" })
    seen.current = count
  }, [count])
  React.useEffect(() => {
    if (rollback) list.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(rollback)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [rollback])

  React.useEffect(() => {
    if (!selectedFeature) return
    list.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(selectedFeature)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [selectedFeature])
  React.useEffect(() => {
    if (!locateStep) return
    const step = list.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(locateStep.id)}"]`)
    step?.scrollIntoView({ block: "nearest", inline: "center" })
    step?.focus({ preventScroll: true })
  }, [locateStep])

  const show = (f: Feature) => {
    setPeek(f.id)
    onHover({ ids: f.op === "sketch" ? [] : [f.id], label: "该特征生成的面", feature: f.id })
  }
  const hide = () => {
    setPeek(null)
    onHover(null)
  }
  const unpin = React.useCallback(() => {
    if (reselect?.state) reselect.cancel()
    setPinned(null)
    studio.showFeature(null)
  }, [reselect, studio])
  const pin = (f: Feature) => {
    if (pinned === f.id) return unpin()
    if (reselect?.state) reselect.cancel()
    setPinned(f.id)
    // The last step is the latest model: no rollback, so measuring and notes keep working.
    studio.showFeature(f.id === last ? null : f.id)
  }

  // Esc lets go of the pinned step (not while typing, re-picking or in a dialog).
  React.useEffect(() => {
    if (!pinned && !selectedFeature) return
    const onKey = (e: KeyboardEvent) => {
      // Taken already (the card or a popover closing on this Esc): one Esc closes one thing.
      if (e.key !== "Escape" || e.defaultPrevented || reselect?.state || (e.target as HTMLElement)?.closest?.("input, textarea, select, [role=menu], [role=alertdialog]")) return
      unpin()
      onSelectFeature?.(null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [pinned, selectedFeature, onSelectFeature, reselect?.state, unpin])

  const panelId = pinned ?? selectedFeature ?? null
  const panelIndex = panelId ? tree.features.findIndex((f) => f.id === panelId) : -1
  const detailsId = panelIndex >= 0 ? panelId : null
  React.useEffect(() => onDetails?.(detailsId), [onDetails, detailsId])

  // What sits above the strip keeps clear of it: its height (it never grows), on the parent.
  React.useLayoutEffect(() => {
    const el = nav.current
    const host = el?.parentElement
    if (!el || !host) return
    const put = () => host.style.setProperty("--timeline-h", `${el.offsetHeight}px`)
    put()
    const ro = new ResizeObserver(put)
    ro.observe(el)
    return () => {
      ro.disconnect()
      host.style.removeProperty("--timeline-h")
    }
  }, [timeline, tree.features.length])

  // The one name under the strip, centred under its step and kept inside the strip.
  const named = namedStep({ pointed: peek, pinned, selected: selectedFeature ?? null, rollback })
  const namedFeature = named ? tree.features.find((f) => f.id === named) : undefined
  const namedText = namedFeature ? displayName(tree, namedFeature) : ""
  const hasSteps = timeline && tree.features.length > 0
  const place = React.useCallback(() => {
    const el = label.current
    const box = strip.current
    if (!el || !box || !named) return
    const step = list.current?.querySelector<HTMLElement>(`[data-step="${CSS.escape(named)}"]`)
    if (!step) {
      el.style.visibility = "hidden"
      return
    }
    const b = box.getBoundingClientRect()
    const s = step.getBoundingClientRect()
    const center = s.left + s.width / 2 - b.left
    el.style.left = `${labelLeft(center, el.offsetWidth, b.width)}px`
    // Scrolled out of the strip: no name pointing at nothing.
    const outside = center < 0 || center > b.width
    el.style.visibility = outside ? "hidden" : ""
    setNameHidden(outside || el.scrollWidth > el.clientWidth)
  }, [named])
  React.useLayoutEffect(place, [place, namedText, tree.features])
  React.useLayoutEffect(() => {
    const box = strip.current
    if (!box) return
    const ro = new ResizeObserver(() => place())
    ro.observe(box)
    return () => ro.disconnect()
  }, [place, hasSteps])

  const details =
    detailsIn &&
    panelIndex >= 0 &&
    createPortal(
      <StepPanel
        key={pinned ? `pin-${pinned}` : `sel-${panelId}`}
        studio={studio}
        feature={tree.features[panelIndex]}
        result={report?.features[panelIndex]}
        pinned
        readOnly={readOnly}
        reselect={reselect}
        annotations={annotations}
        busy={busy}
        rename={renaming === panelId}
        onRenameStart={() => setRenaming(null)}
        onClose={() => { unpin(); onSelectFeature?.(null) }}
        onPointDim={(id) => onHover(id ? { ids: [], label: "", dim: id } : null)}
      />,
      detailsIn,
    )
  if (!hasSteps) return details || null
  // ← → move along the steps.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    const steps = [...(list.current?.querySelectorAll<HTMLElement>("[data-step]") ?? [])]
    const at = steps.indexOf(document.activeElement as HTMLElement)
    if (at < 0) return
    e.preventDefault()
    steps[Math.max(0, Math.min(steps.length - 1, at + (e.key === "ArrowRight" ? 1 : -1)))]?.focus()
  }
  const splitParts = partsList && studio.display?.parts && studio.display.parts.length > 1 ? studio.display.parts : null
  // Colours are a tree edit like any other: undoable, and only restyled (nothing rebuilds).
  const setLook = (parts: string[] | undefined, change: LookChange) => void studio.editTree((t) => setPartLook(t, parts, change))
  const canColor = looks && !readOnly
  // Lit up while something on it is open; otherwise only while pointed at or focused.
  const open = Boolean(rollback || pinned || selectedFeature)

  return (
    <nav ref={nav} aria-label="特征树" className="pointer-events-none absolute right-3 bottom-3 left-3 z-10 flex flex-col items-start gap-1.5">
      {details}
      {splitParts && (
        <ul aria-label="零件" className="pointer-events-auto flex flex-wrap gap-1">
          {splitParts.map((p, k) => {
            const hidden = parts.hidden.has(k)
            const faces = studio.display!.groups.filter((g) => g.part === k).map((g) => g.hash)
            return (
              <li
                key={p.name}
                className="flex items-center gap-1.5 rounded-md border bg-background/90 py-0.5 pr-0.5 pl-2 text-small text-muted-foreground"
                onMouseEnter={() => onHover({ ids: [], label: `零件「${p.name}」`, faces })}
                onMouseLeave={() => onHover(null)}
              >
                {canColor ? <LookPicker look={p.look} label={`「${p.name}」的颜色`} onChange={(c) => setLook([p.name], c)} className="-ml-1" /> : <LookDot look={p.look} />}
                <span className={cn("max-w-32 truncate", hidden && "line-through opacity-60")}>{p.name}</span>
                <IconButton
                  label={hidden ? `显示「${p.name}」` : `隐藏「${p.name}」`}
                  size="icon-sm"
                  className="size-6"
                  onClick={() => {
                    const next = new Set(parts.hidden)
                    if (hidden) next.delete(k)
                    else next.add(k)
                    onParts?.({ ...parts, hidden: next })
                  }}
                >
                  {hidden ? <EyeOff /> : <Eye />}
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      <div
        data-timeline-bar
        data-open={open}
        className={cn(
          "pointer-events-auto flex h-12 max-w-full items-stretch rounded-lg border border-transparent bg-background/40 opacity-70",
          "transition-[background-color,opacity,border-color,box-shadow] duration-(--duration-fast) ease-out",
          "timeline-lit:border-border timeline-lit:bg-background/90 timeline-lit:opacity-100 timeline-lit:shadow-sm",
        )}
        onMouseLeave={hide}
      >
        {/* Two rows of their own: 「回到最新」 appearing moves nothing. */}
        <div className="flex shrink-0 flex-col justify-center gap-0.5 border-r border-transparent px-2 text-caption text-faint-foreground timeline-lit:border-border">
          <div className="flex h-5 items-center gap-1 whitespace-nowrap">
            {/* Kept in place while the step shown has no solid yet (a first sketch), only disabled. */}
            {canColor && (
              <span className={LIT}>
                <LookPicker
                  look={{ ...(tree.appearance?.color ? { color: tree.appearance.color } : {}), ...(tree.appearance?.finish ? { finish: tree.appearance.finish } : {}), source: "part" }}
                  label={splitParts ? "整个零件的颜色（各零件自己设的优先）" : "零件的颜色"}
                  onChange={(c) => setLook(undefined, c)}
                  disabled={!studio.display?.mesh}
                  className="-ml-1"
                />
              </span>
            )}
            <span className="tabular">{tree.features.length} 个特征</span>
            <span className={LIT}>
              <Hint
                label="特征树怎么用"
                side="top"
                tips={[
                  "点一步：模型回到这一步，右侧显示它的详情，可以直接改尺寸、在模型上重选面或边。",
                  "指向一步只看一眼：图标下方出现它的名字，停一下上方弹出小卡片；蓝色是这一步新生成的面，橙色是被它修改的面。",
                  "再点一次、点「关闭」或按 Esc，回到最新一步；← → 在各步之间移动；双击一步改名。",
                ]}
              />
            </span>
          </div>
          {/* Laid out even when hidden, so the column is as wide with it as without. */}
          <div className="flex h-5 items-center">
            <Button size="sm" variant="secondary" className={cn("h-5 px-1.5 text-caption", !rollback && "invisible")} onClick={() => studio.showFeature(null)}>
              回到最新
            </Button>
          </div>
        </div>
        {/* At least a name wide, so a short tree's names aren't cut. */}
        <div ref={strip} className="relative flex min-w-40">
          <ol
            ref={list}
            className="flex min-w-0 items-stretch gap-0.5 overflow-x-auto overflow-y-hidden overscroll-contain px-1 py-0.5 [scrollbar-width:none]"
            onKeyDown={onKeyDown}
            onScroll={place}
            // A plain wheel scrolls the timeline sideways.
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY
            }}
          >
            {tree.features.map((f, i) => {
              const r = report?.features[i]
              const active = rollback === f.id
              const after = rollbackIndex >= 0 && i > rollbackIndex
              const name = displayName(tree, f)
              return (
                <li key={f.id} className="flex shrink-0">
                  <TooltipPrimitive.Root delayDuration={CARD_DELAY} disableHoverableContent>
                    <TooltipPrimitive.Trigger asChild>
                      <button
                        type="button"
                        data-step={f.id}
                        // The second click of a double-click renames; it doesn't let go of the step again.
                        onClick={(e) => e.detail < 2 && pin(f)}
                        onDoubleClick={() => {
                          // A part of an assembly is renamed in the parts list.
                          if (readOnly || f.op === "component") return
                          if (pinned !== f.id) pin(f)
                          setRenaming(f.id)
                        }}
                        aria-expanded={pinned === f.id}
                        aria-label={stepLabel(name, f, r?.state)}
                        onMouseEnter={() => show(f)}
                        onFocus={() => show(f)}
                        onBlur={hide}
                        aria-current={active ? "step" : undefined}
                        // The icon on top; the row under it is where the name shows (drawn once, for the whole strip).
                        className={cn("group/step flex w-8 flex-col items-center rounded-md text-muted-foreground", (after || f.suppressed) && "opacity-50")}
                      >
                        <span
                          className={cn(
                            "relative flex h-7 w-full items-center justify-center rounded-md border border-transparent",
                            "transition-[background-color,color,border-color] duration-(--duration-fast) ease-out",
                            "group-hover/step:bg-muted group-hover/step:text-foreground group-focus-visible/step:bg-muted group-focus-visible/step:text-foreground",
                            peek === f.id && "bg-muted text-foreground",
                            (active || pinned === f.id || selectedFeature === f.id) && "border-border bg-selected text-foreground",
                          )}
                        >
                          <OpIcon op={iconOf(f)} className="size-4" />
                          {r?.state === "error" ? (
                            <CircleAlert className="absolute top-0 right-0 size-3 rounded-full bg-background text-destructive" />
                          ) : r?.state === "skipped" ? (
                            <CircleDashed className="absolute top-0 right-0 size-3 rounded-full bg-background text-faint-foreground" />
                          ) : null}
                        </span>
                      </button>
                    </TooltipPrimitive.Trigger>
                    <TooltipPrimitive.Portal>
                      <TooltipPrimitive.Content
                        side="top"
                        sideOffset={6}
                        collisionPadding={8}
                        className="z-50 w-max max-w-64 rounded-md border bg-popover px-2.5 py-1.5 text-small shadow-popover data-[state=delayed-open]:animate-fade-in data-[state=instant-open]:animate-fade-in"
                      >
                        <StepCard feature={f} result={r} index={i} name={name} full={nameHidden && named === f.id} dims={studio.dims} />
                      </TooltipPrimitive.Content>
                    </TooltipPrimitive.Portal>
                  </TooltipPrimitive.Root>
                </li>
              )
            })}
          </ol>
          {namedFeature && (
            <span
              ref={label}
              aria-hidden
              data-step-name
              className={cn(
                "pointer-events-none absolute bottom-0 h-4 max-w-[min(10rem,100%)] -translate-x-1/2 truncate text-center text-caption leading-4 whitespace-nowrap",
                peek ? "text-foreground" : "text-muted-foreground",
                namedFeature.suppressed && "line-through",
              )}
            >
              {namedText}
            </span>
          )}
        </div>
      </div>
    </nav>
  )
}

/**
 * Shown only while the timeline is lit up (pointed at, focused, a step or one of these popovers
 * open), in a place kept for it so nothing moves. It goes a moment after the timeline dims, so a
 * popover fading out keeps its anchor and doesn't jump to the corner of the window.
 */
const LIT = "invisible inline-flex items-center transition-[visibility] duration-(--duration-base) timeline-lit:visible"

/** The card over a step rested on: what it is, its main numbers and what it did, in a few lines. */
function StepCard({ feature: f, result: r, index, name, full, dims }: { feature: Feature; result?: { state: string; message?: string; faces?: { new: number; modified: number }; ms: number }; index: number; name: string; full: boolean; dims: Dim[] }) {
  const shown = cardDims(dims, f.id)
  return (
    <div className="flex flex-col gap-0.5">
      {/* The name is under the step already; spelled out here only when it isn't all there. */}
      {full && <div className="font-medium">{name}</div>}
      <div className="text-caption text-faint-foreground tabular">{stepLine(f, index)}</div>
      {shown.length > 0 && (
        <dl className="text-caption">
          {shown.map((d) => (
            <div key={d.id} className="flex items-baseline gap-3">
              <dt className="min-w-0 flex-1 truncate text-muted-foreground">{d.label}</dt>
              <dd className="font-mono tabular">{d.text}</dd>
            </div>
          ))}
        </dl>
      )}
      {r?.state === "error" ? (
        <div className="line-clamp-2 text-caption text-destructive">{r.message ?? "这一步没建成"}</div>
      ) : r?.state === "skipped" ? (
        <div className="text-caption text-faint-foreground">前面的步骤失败了，这一步没有重建</div>
      ) : r?.state === "ok" && r.faces ? (
        <div className="text-caption text-faint-foreground tabular">
          新面 {r.faces.new}
          {r.faces.modified ? ` · 改动 ${r.faces.modified}` : ""}
        </div>
      ) : null}
      {f.intent && <div className="truncate text-caption text-muted-foreground">{f.intent}</div>}
    </div>
  )
}
