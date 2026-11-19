import * as React from "react"
import { ArrowLeftRight, BoxSelect, Cuboid, Expand, GitCompareArrows, ImageDown, Keyboard, MessageSquarePlus, MousePointer2, PenLine, Ruler, RulerDimensionLine, ScissorsLineDashed, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { Button, IconButton } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Segmented } from "@/components/ui/segmented"
import type { Projection } from "@/three/viewer"
import type { MeasureResult } from "../kernel/measure"
import { AXIS_INDEX, newSection, round, type Section } from "../section"
import type { KeyRow, ViewTool } from "../view-keys"
import { LOOK_WORDS, VIEW_LOOKS, type ViewLook } from "../view-look"

type V3 = [number, number, number]

/** What 「导出视图」 makes: a picture of the view, or a black-and-white line drawing. */
export type ExportViewOptions = { format: "png"; background: "white" | "transparent" } | { format: "svg"; labels: "none" | "numbers" | "names"; hidden: boolean }

const PROJECTION_WORDS: Record<Projection, string> = { perspective: t("透视", "Perspective"), orthographic: t("正交", "Orthographic") }

/**
 * The tools column on the left edge of the view, in three groups: what a click does (select, note,
 * frame, draw, measure), how the model is cut and labelled (section, dimensions), and how it looks
 * (display style with colours, projection, explode, changes). Each tool has a one-letter key, shown in
 * its tooltip; ? lists them.
 */
export function ViewTools({
  tool,
  onTool,
  notes = true,
  sketch = false,
  section,
  onSection,
  bbox,
  dims,
  onDims,
  explode,
  exploding,
  onExploding,
  onExplode,
  onExplodeEnd,
  display,
  onDisplay,
  onExportView,
  numbered = false,
  changes,
  onChanges,
  keysOpen,
  onKeysOpen,
  keys,
  tips,
}: {
  tool: ViewTool
  onTool: (t: ViewTool) => void
  /** Select and note tools (the host switches between them; none on a shared link). */
  notes?: boolean
  /** Framing and drawing a note (where the host can keep such a note). */
  sketch?: boolean
  section: Section | null
  onSection: (s: Section | null) => void
  bbox: [V3, V3] | null
  /** 「显示尺寸」: on or off, and how many of how many it shows. */
  dims: { on: boolean; shown: number; total: number }
  onDims: (on: boolean) => void
  /** 0–1 when the body has parts, else null (no parts to pull apart). */
  explode: number | null
  exploding: boolean
  onExploding: (on: boolean) => void
  onExplode: (f: number) => void
  onExplodeEnd: () => void
  /** How the model looks (白模, 彩色, a line drawing, see-through) and is projected; `colours`: any part has a colour to show. */
  display?: DisplayState
  onDisplay?: (d: { look?: ViewLook; projection?: Projection }) => void
  /** Save the view as a picture or a line drawing; resolves when it's saved (or the save was cancelled). */
  onExportView?: (o: ExportViewOptions) => Promise<void>
  /** The model has parts: the line drawing can number them. */
  numbered?: boolean
  /** 「查看变更」: faces coloured by what the last change did to them. */
  changes: boolean
  onChanges: (on: boolean) => void
  keysOpen: boolean
  onKeysOpen: (open: boolean) => void
  /** The keys the card lists. */
  keys: KeyRow[]
  /** How the view works, over the keys. */
  tips: string[]
}) {
  const on = "bg-selected text-primary"
  const button = (which: ViewTool, label: string, key: string, icon: React.ReactNode, tooltip?: string) => (
    <IconButton label={label} tooltip={t(`${tooltip ?? label}（${key}）`, `${tooltip ?? label} (${key})`)} tooltipSide="right" size="icon-sm" aria-pressed={tool === which} className={cn(tool === which && on)} onClick={() => onTool(tool === which && which !== "select" ? "select" : which)}>
      {icon}
    </IconButton>
  )
  const rule = <div className="my-0.5 h-px w-5 bg-border" />
  return (
    <>
      <div role="toolbar" aria-label={t("视图工具", "View tools")} aria-orientation="vertical" className="absolute top-3 left-3 z-10 flex flex-col items-center gap-1 rounded-md border bg-background/90 p-0.5">
        {notes && button("select", t("查看与选择", "View and select"), "V", <MousePointer2 />)}
        {notes && button("note", t("标注", "Note"), "C", <MessageSquarePlus />, t("标注：点面或边写备注", "Note: click a face or edge to leave a note"))}
        {sketch && button("box", t("框选标注", "Box note"), "R", <BoxSelect />, t("框选标注：拖出一个框，给框里的写备注", "Box note: drag a box and leave a note on what’s inside"))}
        {sketch && button("pen", t("画笔标注", "Pen note"), "P", <PenLine />, t("画笔标注：在模型上画出要说的地方", "Pen note: draw on the model to mark the spot"))}
        {button("measure", t("测量", "Measure"), "M", <RulerDimensionLine />, t("测量：点一个面或边看尺寸，再点一个看两者之间", "Measure: click a face or edge for its size, then another for the distance between"))}
        {rule}
        <IconButton
          label={t("剖视", "Section")}
          tooltip={t("剖视：切开看里面（X）", "Section: cut open to see inside (X)")}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={!!section}
          className={cn(section && on)}
          disabled={!bbox}
          onClick={() => onSection(section ? null : newSection(bbox))}
        >
          <ScissorsLineDashed />
        </IconButton>
        <IconButton
          label={t("显示尺寸", "Show dimensions")}
          tooltip={t(
            `${dims.total > dims.shown ? `显示尺寸：标出主要的 ${dims.shown} / ${dims.total} 个，单击可以改` : "显示尺寸：标出模型的尺寸，单击可以改"}（D）`,
            `${dims.total > dims.shown ? `Show dimensions: the main ${dims.shown} of ${dims.total}, click one to edit` : "Show dimensions: label the model, click one to edit"} (D)`,
          )}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={dims.on}
          className={cn(dims.on && on)}
          disabled={!dims.total}
          onClick={() => onDims(!dims.on)}
        >
          <Ruler />
        </IconButton>
        {rule}
        {display && onDisplay && <DisplayButton display={display} onDisplay={onDisplay} />}
        {onExportView && <ExportButton onExport={onExportView} numbered={numbered} />}
        <IconButton
          label={t("爆炸", "Explode")}
          tooltip={explode === null ? t("爆炸：拆件以后可以把零件分开看", "Explode: split the model first to pull its parts apart") : t("爆炸：把零件分开看（E）", "Explode: pull the parts apart (E)")}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={exploding}
          className={cn(exploding && on)}
          disabled={explode === null}
          onClick={() => onExploding(!exploding)}
        >
          <Expand />
        </IconButton>
        <div className="relative">
          <IconButton label={t("查看变更", "Show changes")} tooltip={t("查看变更：最近一次改动新增和改了哪些面", "Show changes: faces the last change added or modified")} tooltipSide="right" size="icon-sm" aria-pressed={changes} className={cn(changes && on)} onClick={() => onChanges(!changes)}>
            <GitCompareArrows />
          </IconButton>
          {changes && (
            <span role="status" className="absolute top-0.5 left-full ml-2.5 flex items-center gap-2 rounded-md border bg-background/95 px-2 py-0.5 text-caption whitespace-nowrap">
              <span className="flex items-center gap-1"><span aria-hidden className="size-2.5 rounded-xs bg-scene-good" />{t("新增", "Added")}</span>
              <span className="flex items-center gap-1"><span aria-hidden className="size-2.5 rounded-xs bg-scene-modified" />{t("修改", "Modified")}</span>
            </span>
          )}
        </div>
        {rule}
        <Popover open={keysOpen} onOpenChange={onKeysOpen}>
          <PopoverTrigger asChild>
            <IconButton label={t("快捷键和用法", "Keys and tips")} tooltip={t("快捷键和用法（?）", "Keys and tips (?)")} tooltipSide="right" size="icon-sm" aria-pressed={keysOpen}>
              <Keyboard />
            </IconButton>
          </PopoverTrigger>
          <PopoverContent side="right" align="start" className="w-80 space-y-3 text-small" aria-label={t("快捷键和用法", "Keys and tips")}>
            <ul className="space-y-1 text-muted-foreground">
              {tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
            <table className="w-full">
              <tbody>
                {keys.map((k) => (
                  <tr key={k.keys}>
                    <td className="w-16 py-0.5 pr-2 align-top">
                      <kbd className="rounded-sm border bg-muted px-1 font-mono text-caption whitespace-nowrap">{k.keys}</kbd>
                    </td>
                    <td className="py-0.5 align-top">{k.what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PopoverContent>
        </Popover>
      </div>
      {section && bbox && <SectionPanel section={section} onChange={onSection} bbox={bbox} />}
      {exploding && explode !== null && (
        <div role="group" aria-label={t("爆炸", "Explode")} className={cn(PANEL, section && "top-36")}>
          <div className="flex items-center gap-2">
            <span className="font-medium">{t("爆炸", "Explode")}</span>
            <span className="ml-auto font-mono text-caption tabular text-muted-foreground">{Math.round(explode * 100)}%</span>
            <IconButton label={t("合上并关闭", "Collapse and close")} size="icon-sm" onClick={() => onExploding(false)}>
              <X />
            </IconButton>
          </div>
          <input
            type="range"
            aria-label={t("零件分开的程度", "How far apart")}
            min={0}
            max={1}
            step={0.01}
            value={explode}
            onChange={(e) => onExplode(Number(e.target.value))}
            onPointerUp={onExplodeEnd}
            onKeyUp={onExplodeEnd}
            className="h-5 cursor-pointer accent-primary"
          />
        </div>
      )}
    </>
  )
}

/** What the 「显示样式」 card shows: the look, the projection, whether any part has a colour, and whether colours can be set here. */
export type DisplayState = { look: ViewLook; projection: Projection; colours: boolean; canSetColours: boolean }

/**
 * 「显示」: how the model looks (白模, 彩色, a line drawing, see-through) and is projected. Lit when either
 * is not the usual, so a line drawing, a flat projection or a white model with colours to show never
 * looks like a broken view. W, A and O switch them without the card.
 */
function DisplayButton({ display, onDisplay }: { display: DisplayState; onDisplay: (d: { look?: ViewLook; projection?: Projection }) => void }) {
  const { look, projection, colours } = display
  const changed = look === "lines" || look === "xray" || (look === "plain" && colours) || projection !== "perspective"
  // 彩色 with nothing coloured looks just like 白模: say why, and where colours are set.
  const uncoloured = look === "colour" && !colours
  return (
    <Popover>
      <PopoverTrigger asChild>
        <IconButton
          label={t("显示样式", "Display style")}
          tooltip={t(
            `显示：${LOOK_WORDS[look]}${uncoloured ? "（零件还没设颜色）" : ""} · ${PROJECTION_WORDS[projection]}（W 换样式，A 白模 / 彩色，O 换投影）`,
            `Display: ${LOOK_WORDS[look]}${uncoloured ? " (no part colors set yet)" : ""} · ${PROJECTION_WORDS[projection]} (W style, A clay / color, O projection)`,
          )}
          tooltipSide="right"
          size="icon-sm"
          aria-pressed={changed}
          className={cn(changed && "bg-selected text-primary")}
        >
          <Cuboid />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="grid w-auto grid-cols-[auto_auto_auto] items-center gap-x-3 gap-y-2.5 p-2.5 text-small" aria-label={t("显示样式", "Display style")}>
        <span className="text-muted-foreground">{t("样式", "Style")}</span>
        <Segmented size="sm" aria-label={t("样式", "Style")} value={look} onValueChange={(look) => onDisplay({ look })} options={VIEW_LOOKS.map((v) => ({ value: v, label: LOOK_WORDS[v] }))} />
        <Kbd>W</Kbd>
        <span className="text-muted-foreground">{t("投影", "Projection")}</span>
        <Segmented
          size="sm"
          aria-label={t("投影", "Projection")}
          className="justify-self-start"
          value={display.projection}
          onValueChange={(projection) => onDisplay({ projection })}
          options={(["perspective", "orthographic"] as const).map((v) => ({ value: v, label: PROJECTION_WORDS[v] }))}
        />
        <Kbd>O</Kbd>
        {uncoloured && (
          <p role="note" className="col-span-3 w-0 min-w-full text-caption text-muted-foreground">
            {display.canSetColours
              ? t("零件还没设颜色，所以看起来是白模：用零件名旁边或时间线左端的圆点设颜色。", "No part has a color yet, so it looks like clay. Set colors with the dot beside a part’s name or at the left end of the timeline.")
              : t("零件还没设颜色，所以看起来是白模。", "No part has a color yet, so it looks like clay.")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/**
 * 「导出视图」: the view as it is (angle, projection, explode, parts moved or hidden, section), as a
 * PNG in its style, or as a line drawing in SVG for patent figures and manuals.
 */
function ExportButton({ onExport, numbered }: { onExport: (o: ExportViewOptions) => Promise<void>; numbered: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [format, setFormat] = React.useState<"png" | "svg">("png")
  const [background, setBackground] = React.useState<"white" | "transparent">("white")
  const [labels, setLabels] = React.useState<"none" | "numbers" | "names">("none")
  const [hidden, setHidden] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const run = async () => {
    setBusy(true)
    try {
      await onExport(format === "png" ? { format, background } : { format, labels: numbered ? labels : "none", hidden })
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton label={t("导出视图", "Export view")} tooltip={t("导出视图：存成图片，或黑白线稿（专利附图、说明书）", "Export view: an image, or a black-and-white line drawing (patent figures, manuals)")} tooltipSide="right" size="icon-sm" aria-pressed={open}>
          <ImageDown />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent side="right" align="start" className="w-72 space-y-3 p-2.5 text-small" aria-label={t("导出视图", "Export view")}>
        <Segmented
          size="sm"
          aria-label={t("导出成", "Export as")}
          className="w-full [&>*]:flex-1"
          value={format}
          onValueChange={setFormat}
          options={[
            { value: "png", label: t("图片 PNG", "Image PNG") },
            { value: "svg", label: t("线稿 SVG", "Line drawing SVG") },
          ]}
        />
        {format === "png" ? (
          <>
            <p className="text-muted-foreground">{t("按现在的样式、视角、爆炸和挪开的位置出图，裁到零件周围；选中高亮、网格和箭头不画。", "Drawn as you see it now (style, angle, explode, moved parts), cropped to the parts. Selection highlights, grid and arrows are left out.")}</p>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">{t("背景", "Background")}</span>
              <Segmented size="sm" aria-label={t("背景", "Background")} value={background} onValueChange={setBackground} options={[{ value: "white", label: t("白底", "White") }, { value: "transparent", label: t("透明", "Transparent") }]} />
            </div>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">{t("黑白线稿：看得见的边和轮廓，挡住的线去掉，剖开的地方画剖面线。视角、爆炸、挪开和隐藏的零件照现在的样子。", "Black-and-white line drawing: visible edges and outlines, hidden lines removed, cut faces hatched. Angle, explode, moved and hidden parts stay as they are now.")}</p>
            {numbered && (
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{t("标号", "Labels")}</span>
                <Segmented size="sm" aria-label={t("标号", "Labels")} value={labels} onValueChange={setLabels} options={[{ value: "none", label: t("不标", "None") }, { value: "numbers", label: t("10、20…", "10, 20…") }, { value: "names", label: t("零件名", "Part names") }]} />
              </div>
            )}
            {numbered && labels !== "none" && <p className="text-caption text-muted-foreground">{t("选中了零件时只给选中的标号。", "With parts selected, only those are labeled.")}</p>}
            <label className="flex items-center gap-2">
              <Checkbox checked={hidden} onCheckedChange={(v) => setHidden(v === true)} />
              {t("挡住的线画成虚线", "Draw hidden lines dashed")}
            </label>
          </>
        )}
        <div className="flex justify-end">
          <Button size="sm" variant="primary" disabled={busy} onClick={() => void run()}>
            {busy ? t("正在导出…", "Exporting…") : t("导出…", "Export…")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** A tool's panel, beside the tools column. */
const PANEL = "absolute top-3 left-14 z-10 flex w-56 flex-col gap-2 rounded-md border bg-background/95 p-2.5 text-small shadow-popover"

function SectionPanel({ section, onChange, bbox }: { section: Section; onChange: (s: Section | null) => void; bbox: [V3, V3] }) {
  const i = AXIS_INDEX[section.axis]
  const [lo, hi] = [bbox[0][i], bbox[1][i]]
  const pad = Math.max(0.5, (hi - lo) * 0.02)
  return (
    <div role="group" aria-label={t("剖视", "Section")} className={PANEL}>
      <div className="flex items-center gap-2">
        <span className="font-medium">{t("剖视", "Section")}</span>
        <Segmented
          size="sm"
          aria-label={t("剖切方向", "Section direction")}
          className="ml-auto"
          value={section.axis}
          onValueChange={(axis) => onChange(newSection(bbox, axis))}
          options={[
            { value: "X", label: "X" },
            { value: "Y", label: "Y" },
            { value: "Z", label: "Z" },
          ]}
        />
        <IconButton label={t("关闭剖视", "Close section")} size="icon-sm" onClick={() => onChange(null)}>
          <X />
        </IconButton>
      </div>
      <label className="flex items-center gap-2">
        <input
          type="range"
          aria-label={t(`剖切位置（${section.axis}）`, `Section position (${section.axis})`)}
          min={round(lo + pad)}
          max={round(hi - pad)}
          step={0.1}
          value={section.at}
          onChange={(e) => onChange({ ...section, at: Number(e.target.value) })}
          className="h-5 min-w-0 flex-1 cursor-pointer accent-primary"
        />
        <span className="w-14 text-right font-mono text-caption tabular text-muted-foreground">
          {section.axis}={section.at}
        </span>
      </label>
      <button type="button" onClick={() => onChange({ ...section, flip: !section.flip })} className="flex items-center gap-1.5 self-start text-muted-foreground hover:text-foreground">
        <ArrowLeftRight className="size-3.5" />
        {t("保留另一侧", "Keep the other side")}
      </button>
    </div>
  )
}

/** What the clicked items measure, where the annotation hint usually is. */
export function MeasurePanel({ result, count, onClose }: { result: MeasureResult | null; count: number; onClose: () => void }) {
  return (
    <div role="region" aria-label={t("测量结果", "Measurement")} className="absolute top-3 left-1/2 w-72 max-w-[calc(100%-12rem)] -translate-x-1/2 rounded-md border bg-background/95 p-2.5 text-small shadow-popover">
      <div className="flex items-center gap-2">
        <span className="font-medium">{t("测量", "Measure")}</span>
        <span className="text-caption text-faint-foreground">{count === 0 ? t("单击面或边", "Click a face or edge") : count === 1 ? t("再点一个，量两者之间", "Click another to measure between") : t("再点会重新开始", "Click again to start over")}</span>
        <IconButton label={t("退出测量", "Exit measure")} size="icon-sm" className="ml-auto" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      {result && (
        <div className="mt-1.5 space-y-1.5">
          {result.items.map((it, i) => (
            <div key={i}>
              <span className="text-muted-foreground">
                {"①②"[i]} {it.kind === "face" ? t("面", "Face") : t("边", "Edge")} · {it.what}{t("：", ": ")}
              </span>
              {it.facts.join(" · ")}
            </div>
          ))}
          {result.between.length > 0 && (
            <div className="space-y-0.5 border-t pt-1.5">
              {result.between.map((b) => (
                <div key={b.name} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{b.name}</span>
                  <span className="font-mono tabular">{b.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
