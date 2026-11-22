import * as React from "react"
import { ArrowLeft, ArrowRight, Pencil, Trash2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { OpIcon } from "@/components/op-icon"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import { applyEdit, moveFeature, setFieldAt } from "../apply"
import { hasForm } from "../feature-forms"
import { displayName, opLabel, type Feature, type Tree } from "../dsl"
import { applyDimEdit } from "../dim-edit"
import { fmtDim } from "../dim-source"
import { SCREW_SIZES } from "../holes"
import type { Dim } from "../kernel/dims"
import type { FeatureResult } from "../kernel/build"
import { selectorWords } from "../selector-words"
import type { Annotations } from "../use-annotations"
import type { Reselect } from "../use-reselect"
import type { Studio } from "../studio"
import { useWords } from "./host-words"
import { iconOf } from "../feature-icon"

/** The face / edge selector a feature carries, if any: where it lives and what it picks. */
function selectionOf(f: Feature): { field: (string | number)[]; kind: "face" | "edge"; value: unknown; title: string } | null {
  if (f.op === "fillet" || f.op === "chamfer") return { field: ["edges"], kind: "edge", value: f.edges, title: t("选中的边", "Selected edges") }
  if (f.op === "shell") return { field: ["open"], kind: "face", value: f.open, title: t("开口的面", "Open faces") }
  if (f.op === "draft") return { field: ["faces"], kind: "face", value: f.faces, title: t("拔模的面", "Drafted faces") }
  if ((f.op === "sketch" || f.op === "hole") && f.on.face) return { field: ["on", "face"], kind: "face", value: f.on.face, title: f.op === "sketch" ? t("贴在哪个面上", "Face it sits on") : t("打在哪个面上", "Face it’s drilled into") }
  return null
}

const FIT: Record<string, string> = { clearance: t("过孔", "Clearance"), close: t("精配过孔", "Close-fit clearance"), tap: t("螺纹孔", "Tapped") }

/**
 * One step of the tree, in the panel above the timeline. Pointed at (`pinned`
 * off): a read-only preview of fixed height. Clicked (`pinned`): the same
 * layout, now live: dimensions edit in place, the picked faces or edges can be
 * re-picked on the model, move it up or down, delete, 「编辑」 opens the feature form; in the desktop
 * window a note hands the step to the agent.
 */
export function StepPanel({
  studio,
  feature: f,
  result: r,
  pinned,
  reselect,
  annotations,
  busy = false,
  rename = false,
  onRenameStart,
  onClose,
  onPointDim,
  onEdit,
}: {
  studio: Studio
  feature: Feature
  result?: FeatureResult
  pinned: boolean
  reselect?: Reselect
  annotations?: Annotations
  busy?: boolean
  /** The step was double-clicked in the timeline: edit its name (also when the panel opens with it). */
  rename?: boolean
  /** The name is being edited: the request is done. */
  onRenameStart?: () => void
  onClose: () => void
  onPointDim: (id: string | null) => void
  /** 「编辑」: open this step in the feature form (only steps the form covers). */
  onEdit?: () => void
}) {
  const words = useWords()
  const { tree } = studio
  const name = displayName(tree, f)
  const index = tree.features.findIndex((x) => x.id === f.id)
  const failed = r?.state === "error" || r?.state === "skipped"
  const [error, setError] = React.useState<{ text: string; cascade?: boolean } | null>(null)
  const dims = studio.dims.filter((d) => d.feature === f.id)
  const shown = dims.filter((d) => d.source.type !== "derived")
  const derived = dims.filter((d) => d.source.type === "derived")
  const sel = selectionOf(f)
  const live = pinned && reselect && annotations ? { reselect, annotations } : null
  const picking = live && reselect?.state?.feature === f.id ? reselect.state : null
  const kind = `${opLabel(f.op)}${"mode" in f && f.mode === "cut" ? t(" · 切除", " · cut") : ""}`
  const uses = usesOf(tree, f)

  const remove = async (cascade = false) => {
    const err = await studio.editTree((t) => applyEdit(t, "delete_feature", { id: f.id, cascade }).tree)
    if (err) return setError({ text: err, cascade: /cascade/.test(err) })
    onClose()
    notify.undo(t(`已删除「${name}」`, `Deleted “${name}”`), studio.undo)
  }
  const move = async (by: -1 | 1) => {
    // The last step is shown as the latest model (no rollback); moved, it keeps being the step on view.
    const last = tree.features.length - 1
    if (index === last && by < 0) studio.showFeature(f.id)
    const err = await studio.editTree((t) => moveFeature(t, f.id, by))
    setError(err ? { text: err } : null)
    if (!err && index + by === last) studio.showFeature(null)
  }
  const askAssistant = () => {
    // The person's own message, in their language (the agent reads it).
    live?.annotations.startMessage(
      failed && r?.message
        ? t(`「${name}」（${f.id}）报错了：${r.message}。帮我改好。`, `“${name}” (${f.id}) failed: ${r.message}. Please fix it.`)
        : t(`改「${name}」（${f.id}）：`, `Change “${name}” (${f.id}): `),
      { feature: f.id, name },
    )
    // The message is written where the panel sits: make way for it.
    onClose()
  }

  const heading = "mb-1 text-caption text-faint-foreground"

  return (
    <div
      role={pinned ? "dialog" : "tooltip"}
      id={pinned ? undefined : "feature-peek"}
      aria-label={pinned ? t(`「${name}」`, `“${name}”`) : undefined}
      className={cn("absolute inset-0 flex flex-col bg-background text-small", pinned ? "pointer-events-auto" : "pointer-events-none")}
    >
      <header className="shrink-0 border-b px-4 py-3">
        <div className="flex h-6 items-center gap-2 text-caption text-faint-foreground">
          <span className="tabular">{t(`第 ${index + 1} 步`, `Step ${index + 1}`)}</span>
          <span>{kind}</span>
          <span className="font-mono">{f.id}</span>
          {pinned && (
            <IconButton label={t("关闭", "Close")} size="icon-sm" className="-mr-2 ml-auto" onClick={onClose}>
              <X />
            </IconButton>
          )}
        </div>
        <h2 className="mt-1 flex items-center gap-2 text-title font-medium">
          <OpIcon op={iconOf(f)} className="size-5 shrink-0 text-muted-foreground" />
          {/* A part of an assembly is renamed in the parts list, where its notes and colours follow it. */}
          {pinned && f.op !== "component" ? (
            <StepName key={f.id} studio={studio} feature={f} name={name} rename={rename} onStart={onRenameStart} />
          ) : (
            <span className={cn("min-w-0 truncate", f.suppressed && "line-through")}>{name}</span>
          )}
        </h2>
        {r?.state === "ok" && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-faint-foreground tabular">
            {r.faces && (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-xs bg-primary" />
                {t(`新面 ${r.faces.new}`, `New faces ${r.faces.new}`)}
              </span>
            )}
            {r.faces?.modified ? (
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2.5 rounded-xs bg-scene-modified" />
                {t(`改动 ${r.faces.modified} 个面`, `${r.faces.modified} ${r.faces.modified === 1 ? "face" : "faces"} modified`)}
              </span>
            ) : null}
            <span>{t(`用时 ${Math.round(r.ms)} ms`, `Took ${Math.round(r.ms)} ms`)}</span>
          </div>
        )}
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <section aria-label={t("这一步做了什么", "What this step does")} className="space-y-1">
          {failed ? (
            <div role={pinned ? "alert" : undefined} className="text-destructive">
              {r?.message ?? t("前面的特征失败了，这一步没有重建", "An earlier feature failed, so this step wasn’t rebuilt")}
              {r?.hint && <div className="mt-0.5 text-muted-foreground">{r.hint}</div>}
            </div>
          ) : (
            r?.summary && <p className="text-body">{r.summary}</p>
          )}
          {f.suppressed && <p className="text-faint-foreground">{t("已压缩：暂时不参与重建", "Suppressed: left out of the rebuild for now")}</p>}
          {uses && <p className="text-muted-foreground">{uses}</p>}
          {r?.warnings?.map((w) => (
            <p key={w} className="text-warning">
              {w}
            </p>
          ))}
          {f.intent && <p className="text-muted-foreground">
              {t("设计意图：", "Design intent: ")}
              {f.intent}
            </p>}
        </section>

        {(shown.length > 0 || derived.length > 0) && (
          <section aria-label={t("尺寸", "Dimensions")}>
            <h3 className={heading}>{t("尺寸", "Dimensions")}</h3>
            {shown.length ? (
              <ul className="-mx-1">
                {shown.map((d) => (
                  <DimRow key={d.id} dim={d} studio={studio} busy={busy || !live} onPoint={onPointDim} />
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">{t("这一步的数都由公式算出", "Every number in this step comes from a formula")}</p>
            )}
            {derived.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer text-muted-foreground">{t(`由公式算出的 ${derived.length} 个（只读）`, `${derived.length} from formulas (read-only)`)}</summary>
                <ul className="mt-1 space-y-0.5 pl-2 font-mono text-caption text-muted-foreground">
                  {derived.map((d) => (
                    <li key={d.id}>
                      {d.label} = {d.source.type === "derived" ? d.source.text : ""} = {fmtDim(d.value)}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}

        {live && <DirectOptions f={f} studio={studio} busy={busy} onError={(t) => setError(t ? { text: t } : null)} />}

        {sel && (
          <section aria-label={sel.title}>
            <h3 className={heading}>{sel.title}</h3>
            {picking && live ? (
              <div className="rounded-md border border-primary p-2.5">
                <p>
                  {picking.result === undefined
                    ? t("正在找共同的描述…", "Finding a shared description…")
                    : picking.result
                      ? selectorWords(picking.result.selector, sel.kind, tree, true)
                      : picking.hashes.length
                        ? words.pickFor
                          ? t(
                              `这 ${picking.hashes.length} ${sel.kind === "edge" ? "条边" : "个面"}找不到一句共同的描述：少选几个，或者${words.pickFor}`,
                              `No single description fits these ${picking.hashes.length} ${sel.kind === "edge" ? "edges" : "faces"}. Pick fewer, or choose “${words.pickFor}”.`,
                            )
                          : t(
                              `这 ${picking.hashes.length} ${sel.kind === "edge" ? "条边" : "个面"}找不到一句共同的描述：少选几个，或者分成两步`,
                              `No single description fits these ${picking.hashes.length} ${sel.kind === "edge" ? "edges" : "faces"}: pick fewer, or split it into two steps`,
                            )
                        : t(`在模型上点要选的${sel.kind === "edge" ? "边" : "面"}`, `Click the ${sel.kind === "edge" ? "edges" : "faces"} to pick on the model`)}
                </p>
                <div className="mt-2 flex flex-wrap justify-end gap-2">
                  {picking.result === null && picking.hashes.length > 0 && words.pickFor && (
                    <Button size="sm" variant="ghost" className="mr-auto" onClick={() => void askToPick(studio, live.reselect, live.annotations, f, name, sel.kind)}>
                      {words.pickFor}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={live.reselect.cancel}>
                    {t("取消", "Cancel")}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={!picking.result || busy}
                    onClick={async () => {
                      const err = await live.reselect.apply()
                      setError(err ? { text: err } : null)
                    }}
                  >
                    {t("应用", "Apply")}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p>
                  {selectorWords(sel.value, sel.kind, tree, true)}
                  {r?.selected !== undefined && <span className="text-muted-foreground">{t(` · 实际 ${r.selected} ${sel.kind === "edge" ? "条" : "个"}`, ` · ${r.selected} matched`)}</span>}
                </p>
                {live && (
                  <Button size="sm" variant="secondary" className="mt-2 max-sm:hidden" disabled={busy} onClick={() => void live.reselect.start(f.id, sel.field, sel.kind, sel.value)}>
                    {t("在模型上重选", "Re-pick on the model")}
                  </Button>
                )}
              </>
            )}
          </section>
        )}

        {error && (
          <div role="alert" className="text-destructive">
            {error.text}
            {error.cascade && (
              <Button size="sm" variant="secondary" className="mt-2" onClick={() => void remove(true)}>
                {t("连同它们一起删除", "Delete them too")}
              </Button>
            )}
          </div>
        )}
        {pinned && busy && <p className="text-caption text-faint-foreground">{words.busy}</p>}
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t px-4 py-2.5">
        {live ? (
          <>
            <IconButton label={t("删除这一步", "Delete this step")} size="icon-sm" className="-ml-1.5 text-muted-foreground" disabled={busy} onClick={() => void remove()}>
              <Trash2 />
            </IconButton>
            {f.op !== "component" && (
              <>
                <IconButton label={t("上移一步（往前）", "Move up a step (earlier)")} size="icon-sm" className="text-muted-foreground" disabled={busy || index <= 0} onClick={() => void move(-1)}>
                  <ArrowLeft />
                </IconButton>
                <IconButton label={t("下移一步（往后）", "Move down a step (later)")} size="icon-sm" className="text-muted-foreground" disabled={busy || index >= tree.features.length - 1} onClick={() => void move(1)}>
                  <ArrowRight />
                </IconButton>
              </>
            )}
            <span className="flex-1" />
            {words.askStep && (
              <Button size="sm" variant={onEdit && hasForm(f.op) ? "ghost" : "primary"} disabled={busy} onClick={askAssistant}>
                {failed ? words.fixStep : words.askStep}
              </Button>
            )}
            {onEdit && hasForm(f.op) && (
              <Button size="sm" variant="primary" disabled={busy} onClick={onEdit}>
                <Pencil />
                {t("编辑", "Edit")}
              </Button>
            )}
          </>
        ) : (
          <span className="text-caption text-faint-foreground">
            {pinned
              ? t("再点一次这一步、或按 Esc，回到最新", "Click this step again or press Esc to go back to latest")
              : t("单击这一步：在这一步查看，改尺寸和选择", "Click to view this step and edit its dimensions and selections")}
          </span>
        )}
      </footer>
    </div>
  )
}

/** 「基于 草图1」「复制 拉伸2、孔1」: what a feature builds on. */
function usesOf(tree: Tree, f: Feature): string | null {
  const name = (id: string) => {
    const x = tree.features.find((g) => g.id === id)
    return x ? displayName(tree, x) : id
  }
  if (f.op === "extrude" || f.op === "revolve") return t(`基于 ${name(f.sketch)}`, `From ${name(f.sketch)}`)
  if (f.op === "loft") return t(`截面 ${f.sketches.map(name).join("、")}`, `Sections ${f.sketches.map(name).join(", ")}`)
  if ((f.op === "linear_pattern" || f.op === "circular_pattern" || f.op === "mirror") && f.features?.length) return t(`复制 ${f.features.map(name).join("、")}`, `Copies ${f.features.map(name).join(", ")}`)
  return null
}

/** A dimension in the card: name, value; point at it to see it on the model, click to change it. */
function DimRow({ dim, studio, busy, onPoint }: { dim: Dim; studio: Studio; busy: boolean; onPoint: (id: string | null) => void }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [error, setError] = React.useState<string | null>(null)
  const param = dim.source.type === "param" || dim.source.type === "factor" ? dim.source.name : null
  const apply = async () => {
    const err = await applyDimEdit(studio, dim, draft)
    setError(err)
    if (!err) setEditing(false)
  }
  return (
    <li onMouseEnter={() => onPoint(dim.id)} onMouseLeave={() => onPoint(null)}>
      {editing ? (
        <form
          className="flex items-center gap-2 py-0.5"
          onSubmit={(e) => {
            e.preventDefault()
            void apply()
          }}
        >
          <span className="min-w-0 flex-1 truncate">{dim.label}</span>
          <Input
            autoFocus
            className="h-7 w-24 font-mono tabular"
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={() => !error && setEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation()
                setEditing(false)
              }
            }}
            aria-label={dim.label}
          />
        </form>
      ) : (
        <button
          type="button"
          disabled={busy || !dim.editable}
          onClick={() => {
            setDraft(fmtDim(dim.value))
            setError(null)
            setEditing(true)
          }}
          className={cn("flex w-full items-center gap-2 rounded-sm px-1 py-0.5 text-left", dim.editable && !busy && "hover:bg-accent")}
        >
          <span className="min-w-0 flex-1 truncate">{dim.label}</span>
          <span className="font-mono tabular">{dim.text}</span>
          {param && <span className="sr-only">{t(`（参数 ${param}）`, ` (parameter ${param})`)}</span>}
        </button>
      )}
      {error && <p className="px-1 text-caption text-destructive">{error}</p>}
    </li>
  )
}

/** The two common targeted edits that aren't a number: the text an engraving says, a standard hole's size and use. */
function DirectOptions({ f, studio, busy, onError }: { f: Feature; studio: Studio; busy: boolean; onError: (t: string | null) => void }) {
  const set = async (path: (string | number)[], v: unknown) => onError(await studio.editTree((t) => setFieldAt(t, f.id, path, v)))
  if (f.op === "sketch") {
    const texts = f.shapes.map((s, i) => [s, i] as const).filter(([s]) => s.type === "text")
    if (!texts.length) return null
    return (
      <section aria-label={t("文字内容", "Text")} className="space-y-1">
        <h3 className="font-sans text-caption text-faint-foreground">{t("文字内容", "Text")}</h3>
        {texts.map(([s, i]) => (
          <TextField key={i} value={s.type === "text" ? s.text : ""} disabled={busy} onCommit={(v) => void set(["shapes", i, "text"], v)} />
        ))}
      </section>
    )
  }
  if (f.op === "hole" && f.standard) {
    const std = f.standard
    return (
      <section aria-label={t("标准孔", "Standard hole")} className="space-y-1">
        <h3 className="font-sans text-caption text-faint-foreground">{t("标准孔", "Standard hole")}</h3>
        <div className="flex gap-2">
          <Select
            className="w-24"
            aria-label={t("螺钉规格", "Screw size")}
            value={std.size}
            disabled={busy}
            options={SCREW_SIZES.map((x) => ({ value: x, label: x }))}
            onValueChange={(v) => void set(["standard"], { ...std, size: v })}
          />
          <Select
            className="flex-1"
            aria-label={t("用途", "Fit")}
            value={std.fit ?? "clearance"}
            disabled={busy}
            options={Object.entries(FIT).map(([value, label]) => ({ value, label }))}
            onValueChange={(v) => void set(["standard"], { ...std, fit: v, ...(v === "tap" ? { head: undefined } : {}) })}
          />
        </div>
      </section>
    )
  }
  return null
}

function TextField({ value, disabled, onCommit }: { value: string; disabled: boolean; onCommit: (v: string) => void }) {
  const [draft, setDraft] = React.useState(value)
  const [shown, setShown] = React.useState(value)
  if (shown !== value) {
    setShown(value)
    setDraft(value)
  }
  const commit = () => draft.trim() && draft !== value && onCommit(draft)
  return (
    <Input
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit()
      }}
      aria-label={t("文字内容", "Text")}
    />
  )
}

/** Picks with no common description: hand them to the assistant, one plain description each. */
async function askToPick(studio: Studio, reselect: Reselect, annotations: Annotations, f: Feature, name: string, kind: "face" | "edge") {
  const s = reselect.state
  if (!s) return
  const each = await Promise.all(s.hashes.map((h) => studio.selectorFor(kind, [h], s.index)))
  const lines = each.map((x, i) =>
    `${i + 1}. ${
      x
        ? t(`${selectorWords(x.selector, kind, studio.tree)}（${JSON.stringify(x.selector)}）`, `${selectorWords(x.selector, kind, studio.tree, true)} (${JSON.stringify(x.selector)})`)
        : t("（描述不出来）", "(can’t be described)")
    }`,
  )
  reselect.cancel()
  // The person's own message, in their language.
  annotations.startMessage(
    t(`「${name}」（${f.id}）改成选这几${kind === "edge" ? "条边" : "个面"}：\n${lines.join("\n")}`, `Make “${name}” (${f.id}) use these ${kind === "edge" ? "edges" : "faces"}:\n${lines.join("\n")}`),
  )
}

/** A step's name: double-click (here or on the timeline) to edit; Enter keeps it, Esc leaves it. Empty = the default name. */
function StepName({ studio, feature: f, name, rename, onStart }: { studio: Studio; feature: Feature; name: string; rename: boolean; onStart?: () => void }) {
  // Asked to rename before this was on screen (a quick double-click): start editing straight away.
  const [editing, setEditing] = React.useState(rename)
  const [draft, setDraft] = React.useState(f.name ?? name)
  const done = React.useRef(false)
  const start = () => {
    done.current = false
    setDraft(f.name ?? name)
    setEditing(true)
  }
  const [seen, setSeen] = React.useState(rename)
  if (rename !== seen) {
    setSeen(rename)
    if (rename) {
      setDraft(f.name ?? name)
      setEditing(true)
    }
  }
  React.useEffect(() => {
    if (rename) onStart?.()
  }, [rename, onStart])
  const commit = async () => {
    if (done.current) return
    done.current = true
    setEditing(false)
    const next = draft.trim()
    if (next === (f.name ?? "") || (!f.name && next === name)) return
    const err = await studio.editTree((t) => ({ ...t, features: t.features.map((x) => (x.id === f.id ? ({ ...x, name: next || undefined } as Feature) : x)) }))
    if (err) notify.error(err)
  }
  if (!editing)
    return (
      <button type="button" title={t("双击改名", "Double-click to rename")} className={cn("min-w-0 truncate rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", f.suppressed && "line-through")} onDoubleClick={start} onKeyDown={(e) => { if (e.key === "F2") { e.preventDefault(); start() } }}>
        {name}
      </button>
    )
  return (
    <Input
      autoFocus
      ref={(el) => { if (el) done.current = false }}
      aria-label={t("步骤名", "Step name")}
      value={draft}
      maxLength={40}
      className="h-8 min-w-0 flex-1 text-title font-medium"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return
        if (e.key === "Enter") {
          e.preventDefault()
          void commit()
        } else if (e.key === "Escape") {
          e.preventDefault()
          done.current = true
          setEditing(false)
        }
      }}
    />
  )
}
