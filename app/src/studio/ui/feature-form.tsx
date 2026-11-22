import * as React from "react"
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Segmented } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { OpIcon } from "@/components/op-icon"
import { t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { applyEdit, replaceFeature } from "../apply"
import { displayName, opLabel, TOOL_OPS, type Feature, type Tree } from "../dsl"
import { ExprError, parse } from "../expr"
import { clean, getIn, insertAt, missing, numText, parseNum, setIn, SHAPE_FIELDS, startDraft, type Draft, type FormShape, type MenuItem } from "../feature-forms"
import { iconOf } from "../feature-icon"
import { SCREW_SIZES } from "../holes"
import { selectorWords } from "../selector-words"
import type { Studio } from "../studio"
import type { Reselect } from "../use-reselect"

/** What opened the form: 「＋」 (a new feature, after the step rolled back to) or 「编辑」 on a step. */
export type FormRequest = { mode: "new"; item: MenuItem; after: string | null } | { mode: "edit"; id: string }

/** How long typing rests before the model rebuilds. */
const SETTLE_MS = 300

/** JSON with sorted keys: the tree's copy of a feature comes back in the schema's key order. */
const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))

/**
 * Making or editing a step by hand, in the side panel where a step's details show. Every change
 * rebuilds the model (after a short pause); all of one form's changes are one step to undo. 取消
 * takes them back; 完成 keeps them. A draft that still lacks something (a fillet's edges) stays out
 * of the tree until it has it.
 */
export function FeatureForm({ studio, request, reselect, busy, onDone }: { studio: Studio; request: FormRequest; reselect?: Reselect; busy: boolean; onDone: (id: string | null) => void }) {
  const [init] = React.useState(() => {
    const tree = studio.treeRef.current
    if (request.mode === "edit") {
      const at = tree.features.findIndex((f) => f.id === request.id)
      const f = tree.features[at]
      return { draft: structuredClone(f) as unknown as Draft, at, original: f as Feature | null }
    }
    const at = insertAt(tree, request.after)
    return { draft: startDraft(tree, studio.report, request.item, at), at, original: null as Feature | null }
  })
  const [group] = React.useState(() => `form-${Math.random().toString(36).slice(2, 10)}`)
  const [draft, setDraft] = React.useState<Draft>(init.draft)
  const [error, setError] = React.useState<string | null>(null)
  /** What the tree holds of this feature now, as `canon` (null: not in it yet); the ref is for the writes in flight. */
  const [committedNow, setCommittedNow] = React.useState<string | null>(init.original ? canon(init.original) : null)
  const committed = React.useRef(committedNow)
  React.useLayoutEffect(() => {
    committed.current = committedNow
  }, [committedNow])
  const inTree = committedNow !== null
  /** The write in flight, so its own echo from the engine isn't taken for a change from elsewhere. */
  const [sending, setSending] = React.useState<string | null>(null)
  /** The form wrote something itself (an outside change it only showed is not its to take back). */
  const wrote = React.useRef(false)
  const latest = React.useRef(draft)
  const studioRef = React.useRef(studio)
  React.useLayoutEffect(() => {
    latest.current = draft
    studioRef.current = studio
  })
  const closed = React.useRef(false)
  const queue = React.useRef<Promise<unknown>>(Promise.resolve())
  const after = request.mode === "new" ? request.after : null

  /** Write the latest draft (if it's complete and changed); resolves to why it didn't go in, or null. */
  const commit = React.useCallback((): Promise<string | null> => {
    const run = queue.current.then(async () => {
      const d = clean(latest.current)
      if (missing(d)) return null
      const json = canon(d)
      if (json === committed.current) return null
      const s = studioRef.current
      setSending(json)
      const err = await s.editTree(
        (tree) => {
          if (tree.features.some((f) => f.id === d.id)) return replaceFeature(tree, d)
          const { op, ...rest } = d
          return applyEdit(tree, op, { ...rest, ...(after ? { after } : {}) }).tree
        },
        { group },
      )
      setSending(null)
      if (err) {
        setError(err)
        return err
      }
      setError(null)
      const first = committed.current === null
      committed.current = json
      wrote.current = true
      setCommittedNow(json)
      // Put in among the steps: the view goes to it, not to the latest model.
      if (first && after) s.showFeature(d.id)
      return null
    })
    queue.current = run
    return run
  }, [group, after])

  React.useEffect(() => {
    if (closed.current) return
    const timer = window.setTimeout(() => void commit(), SETTLE_MS)
    return () => window.clearTimeout(timer)
  }, [draft, commit])
  // Closed some other way (another step clicked): what was typed last still counts. On a part switch the
  // host remounts the timeline, and `editTree` refuses a write made for the part no longer shown.
  React.useEffect(
    () => () => {
      if (!closed.current) void commit()
    },
    [commit],
  )

  // The feature changed from elsewhere (its dimension on the model, the agent, undo): the form shows that.
  // Gone altogether (undone, deleted): the form closes.
  const own = studio.tree.features.find((f) => f.id === draft.id)
  const ownJson = own ? canon(own) : null
  const [seenJson, setSeenJson] = React.useState(ownJson)
  const [gone, setGone] = React.useState(false)
  if (ownJson !== seenJson) {
    setSeenJson(ownJson)
    if (ownJson !== committedNow && ownJson !== sending) {
      if (ownJson === null) setGone(committedNow !== null)
      else {
        setCommittedNow(ownJson)
        setDraft(structuredClone(own) as unknown as Draft)
      }
    }
  }
  React.useEffect(() => {
    if (!gone) return
    closed.current = true
    onDone(null)
  }, [gone, onDone])

  const picking = reselect?.state?.feature === draft.id ? reselect.state : null
  const done = async () => {
    if (picking) reselect?.cancel()
    // The last edit didn't go in: say why and stay.
    if (await commit()) return
    closed.current = true
    onDone(committed.current !== null ? draft.id : null)
  }
  /**
   * The feature as it was before the form (gone, for a new one), written in the form's group: with nothing
   * else changed since, the engine is back where the form started and keeps no step for it at all; with
   * something in between (the agent's edit), that stays and this is a step of its own.
   */
  const cancel = async () => {
    if (picking) reselect?.cancel()
    closed.current = true
    await queue.current
    if (wrote.current && committed.current !== (init.original ? canon(init.original) : null)) {
      const original = init.original
      const err = await studioRef.current.editTree(
        (tree) => {
          const here = tree.features.some((f) => f.id === draft.id)
          if (!here) return tree
          if (original) return { ...tree, features: tree.features.map((f) => (f.id === original.id ? original : f)) }
          return applyEdit(tree, "delete_feature", { id: draft.id }).tree
        },
        { group },
      )
      if (err) {
        closed.current = false
        return setError(err)
      }
    }
    onDone(request.mode === "edit" ? request.id : null)
  }

  const tree = studio.tree
  const index = tree.features.findIndex((f) => f.id === draft.id)
  const at = index >= 0 ? index : init.at
  const result = index >= 0 ? studio.report?.features[index] : undefined
  const lack = missing(clean(draft))
  const set = (path: (string | number)[], value: unknown) => setDraft((d) => setIn(d, path, value))
  const ctx: Ctx = { tree, draft, at, set, reselect, studio, busy }
  const name = inTree && index >= 0 ? displayName(tree, tree.features[index]) : (draft.name as string | undefined) || opLabel(draft.op)

  // Esc: done (the edits are already in the model); not while typing or picking.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || reselect?.state || (e.target as HTMLElement)?.closest?.("input, textarea, select, [role=menu], [role=listbox]")) return
      e.preventDefault()
      void done()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  // A selection to make before anything is built: its box is on from the start.
  const autoPick = React.useRef(request.mode === "new")
  React.useEffect(() => {
    if (!autoPick.current || !reselect) return
    autoPick.current = false
    const field = draft.op === "fillet" || draft.op === "chamfer" ? "edges" : draft.op === "draft" ? "faces" : null
    if (field) void reselect.start(draft.id, [field], field === "edges" ? "edge" : "face", undefined, { index: init.at, onApply: (sel) => set([field], sel) })
  })

  return (
    <div role="dialog" aria-label={request.mode === "new" ? t(`新建${opLabel(draft.op)}`, `New ${opLabel(draft.op).toLowerCase()}`) : t(`编辑「${name}」`, `Edit “${name}”`)} className="pointer-events-auto absolute inset-0 flex flex-col bg-background text-small">
      <header className="shrink-0 border-b px-4 py-3">
        <div className="flex h-6 items-center gap-2 text-caption text-faint-foreground">
          <span className="tabular">{t(`第 ${at + 1} 步`, `Step ${at + 1}`)}</span>
          <span>{request.mode === "new" ? t("新建", "New") : t("编辑", "Editing")}</span>
          <span className="font-mono">{draft.id}</span>
          <IconButton label={t("取消", "Cancel")} size="icon-sm" className="-mr-2 ml-auto" onClick={() => void cancel()}>
            <X />
          </IconButton>
        </div>
        <h2 className="mt-1 flex items-center gap-2 text-title font-medium">
          <OpIcon op={iconOf(draft as unknown as Feature)} className="size-5 shrink-0 text-muted-foreground" />
          <Input
            aria-label={t("步骤名", "Step name")}
            className="h-8 min-w-0 flex-1 text-title font-medium"
            maxLength={40}
            placeholder={name}
            value={(draft.name as string | undefined) ?? ""}
            onChange={(e) => set(["name"], e.target.value || undefined)}
          />
        </h2>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <Fields ctx={ctx} />
        <Row label={t("设计意图", "Design intent")}>
          <Input aria-label={t("设计意图", "Design intent")} placeholder={t("为什么这样做（可以不写）", "Why it’s done this way (optional)")} value={(draft.intent as string | undefined) ?? ""} onChange={(e) => set(["intent"], e.target.value || undefined)} />
        </Row>
        <div aria-live="polite" className="space-y-1">
          {lack && !picking && <p className="text-muted-foreground">{lack}</p>}
          {error && <p role="alert" className="text-destructive">{error}</p>}
          {!error && (result?.state === "error" || result?.state === "skipped") && (
            <div role="alert" className="text-destructive">
              {result.message ?? t("前面的步骤失败了，这一步没有重建", "An earlier step failed, so this one wasn’t rebuilt")}
              {result.hint && <div className="mt-0.5 text-muted-foreground">{result.hint}</div>}
            </div>
          )}
          {!error && result?.state === "ok" && result.summary && <p className="text-muted-foreground">{result.summary}</p>}
          {result?.warnings?.map((w) => (
            <p key={w} className="text-warning">
              {w}
            </p>
          ))}
        </div>
      </div>

      <footer className="flex shrink-0 items-center gap-2 border-t px-4 py-2.5">
        <span className="text-caption text-faint-foreground">{t("改动会直接重建；整张表单是一步撤销", "Changes rebuild right away; the whole form is one undo step")}</span>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => void cancel()}>
          {t("取消", "Cancel")}
        </Button>
        <Button size="sm" variant="primary" disabled={busy || (!inTree && Boolean(lack))} onClick={() => void done()}>
          {t("完成", "Done")}
        </Button>
      </footer>
    </div>
  )
}

type Ctx = {
  tree: Tree
  draft: Draft
  /** The feature's place in the tree (where it will go, before it's in). */
  at: number
  set: (path: (string | number)[], value: unknown) => void
  reselect?: Reselect
  studio: Studio
  busy: boolean
}

/** The fields of each kind of step. */
function Fields({ ctx }: { ctx: Ctx }) {
  const { draft: d, set } = ctx
  switch (d.op) {
    case "sketch":
      return (
        <>
          <PlaneField ctx={ctx} path={["on"]} label={t("画在哪里", "Where it’s drawn")} />
          <ShapesField ctx={ctx} />
        </>
      )
    case "extrude": {
      const cut = d.mode === "cut"
      const other = (["until", "thin", "draft", "onto"] as const).filter((k) => d[k] !== undefined)
      return (
        <>
          <SketchField ctx={ctx} />
          <Row label={t("加料还是切除", "Add or remove")}>
            <Segmented size="sm" aria-label={t("加料还是切除", "Add or remove")} value={cut ? "cut" : "add"} options={MODE()} onValueChange={(v) => set(["mode"], v === "add" ? undefined : v)} />
          </Row>
          <Row label={t("方向", "Direction")}>
            <Segmented
              size="sm"
              aria-label={t("方向", "Direction")}
              value={(d.direction as string | undefined) ?? "normal"}
              options={[
                { value: "normal", label: t("沿法向", "Along normal") },
                { value: "reverse", label: t("反向", "Reversed") },
                { value: "both", label: t("两侧", "Both sides") },
              ]}
              onValueChange={(v) => set(["direction"], v === "normal" ? undefined : v)}
            />
          </Row>
          {cut && (
            <SwitchRow
              label={t("贯穿全部", "Through all")}
              checked={Boolean(d.through)}
              onChange={(on) => setMany(set, [[["through"], on || undefined], [["distance"], on ? undefined : (d.distance ?? 10)]])}
            />
          )}
          {!d.through && d.until === undefined && <NumField ctx={ctx} path={["distance"]} label={d.direction === "both" ? t("距离（两侧加起来）", "Distance (both sides together)") : t("距离", "Distance")} />}
          {other.length > 0 && <Kept names={other} />}
        </>
      )
    }
    case "revolve":
      return (
        <>
          <SketchField ctx={ctx} />
          <AxisField ctx={ctx} path={["axis"]} label={t("绕哪根轴", "About axis")} />
          <NumField ctx={ctx} path={["angle"]} label={t("角度", "Angle")} optional placeholder="360" />
          <Row label={t("加料还是切除", "Add or remove")}>
            <Segmented size="sm" aria-label={t("加料还是切除", "Add or remove")} value={d.mode === "cut" ? "cut" : "add"} options={MODE()} onValueChange={(v) => set(["mode"], v === "add" ? undefined : v)} />
          </Row>
          {(d.start !== undefined || d.symmetric !== undefined) && <Kept names={["start", "symmetric"].filter((k) => d[k] !== undefined)} />}
        </>
      )
    case "loft":
      return (
        <>
          <ListField
            ctx={ctx}
            path={["sketches"]}
            label={t("截面（按顺序连起来）", "Sections (joined in order)")}
            choices={ctx.tree.features.slice(0, ctx.at).filter((f) => f.op === "sketch")}
          />
          <SwitchRow label={t("直纹（截面之间是直的）", "Ruled (straight between sections)")} checked={Boolean(d.ruled)} onChange={(on) => set(["ruled"], on || undefined)} />
          <Row label={t("加料还是切除", "Add or remove")}>
            <Segmented size="sm" aria-label={t("加料还是切除", "Add or remove")} value={d.mode === "cut" ? "cut" : "add"} options={MODE()} onValueChange={(v) => set(["mode"], v === "add" ? undefined : v)} />
          </Row>
        </>
      )
    case "hole":
      return (
        <>
          <PlaneField ctx={ctx} path={["on"]} label={t("孔口在哪个面上", "Where the hole opens")} />
          <PointsField ctx={ctx} path={["at"]} label={t("孔心（草图坐标）", "Hole centers (sketch coordinates)")} min={1} />
          <HoleSize ctx={ctx} />
          <NumField ctx={ctx} path={["depth"]} label={t("深度", "Depth")} optional placeholder={t("贯穿", "Through")} />
          <SwitchRow label={t("反过来钻（沿法向）", "Drill the other way (along the normal)")} checked={Boolean(d.reverse)} onChange={(on) => set(["reverse"], on || undefined)} />
          {(d.cbore !== undefined || d.csink !== undefined) && <Kept names={["cbore", "csink"].filter((k) => d[k] !== undefined)} />}
        </>
      )
    case "fillet":
    case "chamfer":
      return (
        <>
          <PickField ctx={ctx} path={["edges"]} kind="edge" label={t("倒哪些边", "Which edges")} />
          {d.op === "fillet" ? <NumField ctx={ctx} path={["r"]} label={t("半径", "Radius")} /> : <NumField ctx={ctx} path={["d"]} label={t("倒角距离", "Distance")} />}
        </>
      )
    case "shell":
      return (
        <>
          <PickField ctx={ctx} path={["open"]} kind="face" label={t("开口的面", "Open faces")} />
          <NumField ctx={ctx} path={["t"]} label={t("壁厚（向内）", "Wall thickness (inward)")} />
        </>
      )
    case "draft":
      return (
        <>
          <PickField ctx={ctx} path={["faces"]} kind="face" label={t("拔模的面", "Faces to draft")} />
          <NumField ctx={ctx} path={["angle"]} label={t("拔模角（度）", "Draft angle (degrees)")} />
          <PlaneNameField ctx={ctx} path={["neutral", "plane"]} label={t("中性面", "Neutral plane")} />
          <NumField ctx={ctx} path={["neutral", "offset"]} label={t("中性面偏移", "Neutral plane offset")} optional placeholder="0" />
        </>
      )
    case "linear_pattern":
      return (
        <>
          <ToolsField ctx={ctx} />
          <DirField ctx={ctx} path={["dir"]} label={t("方向", "Direction")} />
          <div className="grid grid-cols-2 gap-3">
            <NumField ctx={ctx} path={["count"]} label={t("个数（含原来的）", "Count (with the original)")} />
            <NumField ctx={ctx} path={["spacing"]} label={t("间距", "Spacing")} />
          </div>
          <SwitchRow
            label={t("第二个方向", "Second direction")}
            checked={d.dir2 !== undefined}
            onChange={(on) =>
              setMany(set, [
                [["dir2"], on ? (d.dir === "+Y" || d.dir === "-Y" ? "+X" : "+Y") : undefined],
                [["count2"], on ? 2 : undefined],
                [["spacing2"], on ? 10 : undefined],
              ])
            }
          />
          {d.dir2 !== undefined && (
            <>
              <DirField ctx={ctx} path={["dir2"]} label={t("第二方向", "Second direction")} />
              <div className="grid grid-cols-2 gap-3">
                <NumField ctx={ctx} path={["count2"]} label={t("个数", "Count")} />
                <NumField ctx={ctx} path={["spacing2"]} label={t("间距", "Spacing")} />
              </div>
            </>
          )}
        </>
      )
    case "circular_pattern":
      return (
        <>
          <ToolsField ctx={ctx} />
          <AxisField ctx={ctx} path={["axis"]} label={t("绕哪根轴", "About axis")} />
          <div className="grid grid-cols-2 gap-3">
            <NumField ctx={ctx} path={["count"]} label={t("个数（含原来的）", "Count (with the original)")} />
            <NumField ctx={ctx} path={["angle"]} label={t("总角度", "Total angle")} optional placeholder="360" />
          </div>
        </>
      )
    case "mirror":
      return (
        <>
          <PlaneNameField ctx={ctx} path={["plane"]} label={t("关于哪个基准面", "About which plane")} />
          <NumField ctx={ctx} path={["offset"]} label={t("基准面偏移", "Plane offset")} optional placeholder="0" />
          <ToolsField ctx={ctx} optional />
        </>
      )
  }
}

const MODE = () => [
  { value: "add", label: t("加料", "Add") },
  { value: "cut", label: t("切除", "Cut") },
]

function setMany(set: Ctx["set"], changes: [(string | number)[], unknown][]) {
  for (const [p, v] of changes) set(p, v)
}

/** Settings an agent wrote that the form doesn't show: kept as they are. */
function Kept({ names }: { names: string[] }) {
  return <p className="text-caption text-faint-foreground">{t(`还有 ${names.join("、")} 的设置：表单里不改，原样保留。`, `This step also sets ${names.join(", ")}: kept as it is, the form doesn’t change it.`)}</p>
}

function Row({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-caption text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  const id = React.useId()
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="text-small">
        {label}
      </label>
    </div>
  )
}

/** A number or an expression of the parameters (`L/2`, `t*2`). Empty leaves an optional field out. */
function NumField({ ctx, path, label, optional = false, placeholder, compact = false }: { ctx: Ctx; path: (string | number)[]; label: string; optional?: boolean; placeholder?: string; compact?: boolean }) {
  const value = getIn(ctx.draft, path)
  const [text, setText] = React.useState(numText(value))
  const [shown, setShown] = React.useState(value)
  const [error, setError] = React.useState<string | null>(null)
  // Changed from elsewhere (the dimension on the model, undo): show the new value.
  if (shown !== value) {
    setShown(value)
    if (parseNum(text) !== value) setText(numText(value))
  }
  const change = (s: string) => {
    setText(s)
    const v = parseNum(s)
    if (v === undefined) {
      if (!optional) return setError(t("要填一个数", "Needs a number"))
      setError(null)
      setShown(undefined)
      return ctx.set(path, undefined)
    }
    if (typeof v === "string") {
      try {
        parse(v)
      } catch (e) {
        return setError(e instanceof ExprError ? e.message : String(e))
      }
    }
    setError(null)
    setShown(v)
    ctx.set(path, v)
  }
  const input = (
    <Input
      aria-label={label}
      className={cn("h-8 font-mono tabular", compact && "min-w-0")}
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      aria-invalid={Boolean(error)}
      onChange={(e) => change(e.target.value)}
    />
  )
  if (compact) return input
  return (
    <Row label={label}>
      {input}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </Row>
  )
}

function Vec2Field({ ctx, path, label }: { ctx: Ctx; path: (string | number)[]; label: string }) {
  const v = getIn(ctx.draft, path) as unknown[] | undefined
  // Leaving a center out means [0, 0]: write both once either is typed.
  const sub: Ctx = { ...ctx, draft: { ...ctx.draft, __v: v ?? [0, 0] } as Draft, set: (p, x) => ctx.set(path, Object.assign([...(v ?? [0, 0])], { [p[1] as number]: x ?? 0 })) }
  return (
    <Row label={label}>
      <div className="grid grid-cols-2 gap-2">
        <NumField ctx={sub} path={["__v", 0]} label={`${label} x`} compact />
        <NumField ctx={sub} path={["__v", 1]} label={`${label} y`} compact />
      </div>
    </Row>
  )
}

const PLANES = () => [
  { value: "XY", label: t("上视 XY", "Top XY") },
  { value: "XZ", label: t("前视 XZ", "Front XZ") },
  { value: "YZ", label: t("右视 YZ", "Right YZ") },
]

function PlaneNameField({ ctx, path, label }: { ctx: Ctx; path: (string | number)[]; label: string }) {
  return (
    <Row label={label}>
      <Segmented size="sm" aria-label={label} value={(getIn(ctx.draft, path) as string | undefined) ?? "XY"} options={PLANES()} onValueChange={(v) => ctx.set(path, v)} />
    </Row>
  )
}

function AxisField({ ctx, path, label }: { ctx: Ctx; path: (string | number)[]; label: string }) {
  return (
    <Row label={label}>
      <Segmented size="sm" aria-label={label} value={(getIn(ctx.draft, path) as string | undefined) ?? "Z"} options={["X", "Y", "Z"].map((a) => ({ value: a, label: a }))} onValueChange={(v) => ctx.set(path, v)} />
    </Row>
  )
}

function DirField({ ctx, path, label }: { ctx: Ctx; path: (string | number)[]; label: string }) {
  return (
    <Row label={label}>
      <Select aria-label={label} value={(getIn(ctx.draft, path) as string | undefined) ?? "+X"} options={["+X", "-X", "+Y", "-Y", "+Z", "-Z"].map((v) => ({ value: v, label: v }))} onValueChange={(v) => ctx.set(path, v)} />
    </Row>
  )
}

/** The sketch an extrude or a revolve is made from: one of the sketches before it. */
function SketchField({ ctx }: { ctx: Ctx }) {
  const sketches = ctx.tree.features.slice(0, ctx.at).filter((f) => f.op === "sketch")
  return (
    <Row label={t("草图", "Sketch")}>
      <Select
        aria-label={t("草图", "Sketch")}
        value={(ctx.draft.sketch as string | undefined) ?? ""}
        placeholder={t("选一个草图", "Choose a sketch")}
        options={sketches.map((s) => ({ value: s.id, label: displayName(ctx.tree, s) }))}
        onValueChange={(v) => ctx.set(["sketch"], v)}
      />
    </Row>
  )
}

/** Features to copy (a pattern, a mirror): the adds, cuts and holes before it. */
function ToolsField({ ctx, optional = false }: { ctx: Ctx; optional?: boolean }) {
  const choices = ctx.tree.features.slice(0, ctx.at).filter((f) => TOOL_OPS.includes(f.op))
  return <ListField ctx={ctx} path={["features"]} label={optional ? t("镜像哪些特征（不选就是整个实体）", "Which features (none: the whole solid)") : t("复制哪些特征", "Which features to copy")} choices={choices} optional={optional} />
}

/** Some of the steps before it, kept in the tree's order. */
function ListField({ ctx, path, label, choices, optional = false }: { ctx: Ctx; path: (string | number)[]; label: string; choices: Feature[]; optional?: boolean }) {
  const picked = (getIn(ctx.draft, path) as string[] | undefined) ?? []
  const toggle = (id: string, on: boolean) => {
    const next = choices.map((c) => c.id).filter((x) => (x === id ? on : picked.includes(x)))
    ctx.set(path, next.length || !optional ? next : undefined)
  }
  return (
    <Row label={label}>
      {choices.length ? (
        <ul className="space-y-1">
          {choices.map((c) => {
            const id = `${path.join(".")}-${c.id}`
            return (
              <li key={c.id} className="flex items-center gap-2">
                <Checkbox id={id} checked={picked.includes(c.id)} onCheckedChange={(on) => toggle(c.id, on === true)} />
                <label htmlFor={id} className="flex min-w-0 items-center gap-1.5">
                  <OpIcon op={iconOf(c)} className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{displayName(ctx.tree, c)}</span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-muted-foreground">{t("前面还没有可选的步骤", "No steps before this one to choose")}</p>
      )}
    </Row>
  )
}

/** Faces or edges, picked on the body this step starts from; the kernel finds the words for them. */
function PickField({ ctx, path, kind, label, onPicked }: { ctx: Ctx; path: (string | number)[]; kind: "face" | "edge"; label: string; onPicked?: (selector: Record<string, unknown>) => void }) {
  const { reselect, draft, tree } = ctx
  const value = getIn(draft, path)
  const state = reselect?.state
  const active = state && state.feature === draft.id && state.field.join(".") === path.join(".") ? state : null
  const start = () =>
    void reselect?.start(draft.id, path, kind, value, {
      index: ctx.at,
      onApply: (sel) => {
        ctx.set(path, sel)
        onPicked?.(sel)
      },
    })
  const what = kind === "edge" ? t("边", "edges") : t("面", "faces")
  return (
    <Row label={label}>
      {active ? (
        <div className="rounded-md border border-primary p-2.5">
          <p>
            {active.result === undefined
              ? t("正在找共同的描述…", "Finding a shared description…")
              : active.result
                ? selectorWords(active.result.selector, kind, tree, true)
                : active.hashes.length
                  ? t(`这 ${active.hashes.length} 个${kind === "edge" ? "边" : "面"}找不到一句共同的描述：少选几个，或者分成两步`, `No single description fits these ${active.hashes.length} ${what}: pick fewer, or split it into two steps`)
                  : t(`在模型上点要选的${what}`, `Click the ${what} to pick on the model`)}
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reselect!.cancel}>
              {t("取消", "Cancel")}
            </Button>
            <Button size="sm" variant="primary" disabled={!active.result} onClick={() => void reselect!.apply()}>
              {t("用这些", "Use these")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <p className={cn("min-w-0 flex-1", !value && "text-muted-foreground")}>{value ? selectorWords(value, kind, tree, true) : t(`还没选${what}`, `No ${what} picked yet`)}</p>
          <Button size="sm" variant="secondary" disabled={ctx.busy || !reselect || Boolean(state)} onClick={start}>
            {value ? t("重选", "Re-pick") : t("在模型上选", "Pick on model")}
          </Button>
        </div>
      )}
    </Row>
  )
}

/** A sketch plane, or the plane a hole opens on: a datum plane (moved, tilted), or a face of the solid. */
function PlaneField({ ctx, path, label }: { ctx: Ctx; path: (string | number)[]; label: string }) {
  const on = (getIn(ctx.draft, path) as Record<string, unknown> | undefined) ?? { plane: "XY" }
  const onFace = on.face !== undefined
  const tilt = on.tilt as { axis: string; angle: unknown } | undefined
  const p = (k: string) => [...path, k]
  // Where a face looks decides which datum plane's coordinates the sketch uses (parallel faces).
  const planeFor = (sel: Record<string, unknown>) => {
    const n = String(sel.normal ?? "")
    return n.endsWith("Z") ? "XY" : n.endsWith("Y") ? "XZ" : n.endsWith("X") ? "YZ" : undefined
  }
  return (
    <div className="space-y-3">
      <Row label={label}>
        <Segmented
          size="sm"
          aria-label={label}
          value={onFace ? "face" : "plane"}
          options={[
            { value: "plane", label: t("基准面", "Datum plane") },
            { value: "face", label: t("实体的面", "A face") },
          ]}
          onValueChange={(v) => ctx.set(path, v === "face" ? { plane: on.plane ?? "XY", face: { normal: "+Z", extreme: "+Z" } } : { plane: on.plane ?? "XY" })}
        />
      </Row>
      {onFace ? (
        <PickField
          ctx={ctx}
          path={p("face")}
          kind="face"
          label={t("贴在哪个面上", "Which face")}
          onPicked={(sel) => {
            const plane = planeFor(sel)
            if (plane) ctx.set(p("plane"), plane)
          }}
        />
      ) : (
        <>
          <PlaneNameField ctx={ctx} path={p("plane")} label={t("哪个基准面", "Which datum plane")} />
          <SwitchRow
            label={t("倾斜", "Tilted")}
            checked={Boolean(tilt)}
            onChange={(v) => ctx.set(p("tilt"), v ? { axis: on.plane === "YZ" ? "Y" : "X", angle: 30 } : undefined)}
          />
          {tilt && (
            <div className="grid grid-cols-2 gap-3">
              <AxisField ctx={ctx} path={p("tilt").concat("axis")} label={t("绕哪根轴转", "Turned about")} />
              <NumField ctx={ctx} path={p("tilt").concat("angle")} label={t("角度", "Angle")} />
            </div>
          )}
        </>
      )}
      <NumField ctx={ctx} path={p("offset")} label={onFace ? t("离这个面再偏移", "Offset from the face") : t("偏移", "Offset")} optional placeholder="0" />
    </div>
  )
}

const SHAPE_LABELS = (): Record<FormShape, string> => ({
  rect: t("矩形", "Rectangle"),
  circle: t("圆", "Circle"),
  polygon: t("正多边形", "Polygon"),
  slot: t("槽", "Slot"),
  text: t("文字", "Text"),
  polyline: t("折线", "Polyline"),
})

const NEW_SHAPE: Record<FormShape, Record<string, unknown>> = {
  rect: { type: "rect", w: 20, h: 10 },
  circle: { type: "circle", d: 10 },
  polygon: { type: "polygon", sides: 6, d: 20 },
  slot: { type: "slot", length: 30, width: 8 },
  text: { type: "text", text: "ABC", size: 6 },
  polyline: { type: "polyline", points: [[0, 0], [20, 0], [0, 20]] },
}

/** The shapes of a sketch, one card each; a later shape marked 「挖掉」 cuts out of the ones before. */
function ShapesField({ ctx }: { ctx: Ctx }) {
  const shapes = (ctx.draft.shapes as Record<string, unknown>[] | undefined) ?? []
  const labels = SHAPE_LABELS()
  return (
    <div className="space-y-3">
      <span className="text-caption text-muted-foreground">{t("图形", "Shapes")}</span>
      {shapes.map((s, i) => {
        const type = s.type as string
        const known = type in SHAPE_FIELDS && !(type === "polyline" && (s.points as unknown[]).some((pt) => !Array.isArray(pt)))
        const p = (...k: (string | number)[]) => ["shapes", i, ...k]
        return (
          <div key={i} className="space-y-3 rounded-md border p-3">
            <div className="flex items-center gap-2">
              <span className="text-small font-medium">{labels[type as FormShape] ?? type}</span>
              {known && type !== "path" && <SwitchRow label={t("挖掉", "Cut out")} checked={Boolean(s.cut)} onChange={(on) => ctx.set(p("cut"), on || undefined)} />}
              <span className="flex-1" />
              <IconButton label={t("删掉这个图形", "Remove this shape")} size="icon-sm" disabled={shapes.length <= 1} onClick={() => ctx.set(["shapes"], shapes.filter((_, j) => j !== i))}>
                <Trash2 />
              </IconButton>
            </div>
            {!known ? (
              <p className="text-caption text-faint-foreground">{t("这个图形有圆弧、样条或是开放的线：表单里不改，原样保留。", "This shape has arcs or splines, or is an open line: kept as it is, the form doesn’t change it.")}</p>
            ) : type === "rect" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumField ctx={ctx} path={p("w")} label={t("宽（x）", "Width (x)")} />
                  <NumField ctx={ctx} path={p("h")} label={t("高（y）", "Height (y)")} />
                </div>
                <Vec2Field ctx={ctx} path={p("center")} label={t("中心", "Center")} />
                <NumField ctx={ctx} path={p("r")} label={t("四角圆角", "Corner radius")} optional placeholder="0" />
              </>
            ) : type === "circle" ? (
              <>
                <NumField ctx={ctx} path={p("d")} label={t("直径", "Diameter")} />
                <Vec2Field ctx={ctx} path={p("center")} label={t("中心", "Center")} />
              </>
            ) : type === "polygon" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumField ctx={ctx} path={p("sides")} label={t("边数", "Sides")} />
                  <NumField ctx={ctx} path={p("d")} label={t("外接圆直径", "Across corners")} />
                </div>
                <Vec2Field ctx={ctx} path={p("center")} label={t("中心", "Center")} />
                <NumField ctx={ctx} path={p("rotate")} label={t("旋转", "Rotation")} optional placeholder="0" />
              </>
            ) : type === "slot" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <NumField ctx={ctx} path={p("length")} label={t("总长", "Length")} />
                  <NumField ctx={ctx} path={p("width")} label={t("宽", "Width")} />
                </div>
                <Vec2Field ctx={ctx} path={p("center")} label={t("中心", "Center")} />
                <NumField ctx={ctx} path={p("angle")} label={t("角度", "Angle")} optional placeholder="0" />
              </>
            ) : type === "text" ? (
              <>
                <Row label={t("文字", "Text")}>
                  <Input aria-label={t("文字", "Text")} maxLength={60} value={String(s.text ?? "")} onChange={(e) => e.target.value.trim() && ctx.set(p("text"), e.target.value)} />
                </Row>
                <NumField ctx={ctx} path={p("size")} label={t("字号", "Size")} />
                <Vec2Field ctx={ctx} path={p("center")} label={t("中心", "Center")} />
                <NumField ctx={ctx} path={p("angle")} label={t("角度", "Angle")} optional placeholder="0" />
              </>
            ) : (
              <PointsField ctx={ctx} path={p("points")} label={t("顶点（依次连起来，自动闭合）", "Corners (joined in order, closed)")} min={3} />
            )}
          </div>
        )
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary">
            <Plus />
            {t("加一个图形", "Add a shape")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {(Object.keys(NEW_SHAPE) as FormShape[]).map((k) => (
            <DropdownMenuItem key={k} onSelect={() => ctx.set(["shapes"], [...shapes, structuredClone(NEW_SHAPE[k])])}>
              {labels[k]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/** A list of [x, y]: hole centers, a polyline's corners. */
function PointsField({ ctx, path, label, min }: { ctx: Ctx; path: (string | number)[]; label: string; min: number }) {
  const points = (getIn(ctx.draft, path) as unknown[][] | undefined) ?? []
  const move = (i: number, by: -1 | 1) => {
    const next = [...points]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    ctx.set(path, next)
  }
  return (
    <Row label={label}>
      <ol className="space-y-1.5">
        {points.map((_, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className="w-4 shrink-0 text-right text-caption text-faint-foreground tabular">{i + 1}</span>
            <NumField ctx={ctx} path={[...path, i, 0]} label={t(`第 ${i + 1} 点 x`, `Point ${i + 1} x`)} compact />
            <NumField ctx={ctx} path={[...path, i, 1]} label={t(`第 ${i + 1} 点 y`, `Point ${i + 1} y`)} compact />
            {points.length > 2 && min >= 3 && (
              <>
                <IconButton label={t("上移", "Move up")} size="icon-sm" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp />
                </IconButton>
                <IconButton label={t("下移", "Move down")} size="icon-sm" disabled={i === points.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown />
                </IconButton>
              </>
            )}
            <IconButton label={t(`删掉第 ${i + 1} 点`, `Remove point ${i + 1}`)} size="icon-sm" disabled={points.length <= min} onClick={() => ctx.set(path, points.filter((_, j) => j !== i))}>
              <Trash2 />
            </IconButton>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="ghost" className="-ml-2 self-start" onClick={() => ctx.set(path, [...points, [...((points.at(-1) as unknown[]) ?? [0, 0])]])}>
        <Plus />
        {t("加一个点", "Add a point")}
      </Button>
    </Row>
  )
}

const FITS = () => [
  { value: "clearance", label: t("过孔", "Clearance") },
  { value: "close", label: t("精配过孔", "Close fit") },
  { value: "tap", label: t("螺纹孔", "Tapped") },
  { value: "insert", label: t("热熔螺母孔", "Heat-set insert") },
]

/** A plain diameter, or a standard hole for a metric screw. */
function HoleSize({ ctx }: { ctx: Ctx }) {
  const std = ctx.draft.standard as { size: string; fit?: string; head?: string } | undefined
  return (
    <div className="space-y-3">
      <Row label={t("孔径", "Size")}>
        <Segmented
          size="sm"
          aria-label={t("孔径", "Size")}
          value={std ? "standard" : "d"}
          options={[
            { value: "d", label: t("直径", "Diameter") },
            { value: "standard", label: t("标准螺钉孔", "Screw hole") },
          ]}
          onValueChange={(v) => setMany(ctx.set, v === "standard" ? [[["d"], undefined], [["standard"], { size: "M3" }]] : [[["standard"], undefined], [["d"], 5]])}
        />
      </Row>
      {std ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Row label={t("螺钉规格", "Screw size")}>
              <Select aria-label={t("螺钉规格", "Screw size")} value={std.size} options={SCREW_SIZES.map((x) => ({ value: x, label: x }))} onValueChange={(v) => ctx.set(["standard"], { ...std, size: v })} />
            </Row>
            <Row label={t("用途", "Fit")}>
              <Select aria-label={t("用途", "Fit")} value={std.fit ?? "clearance"} options={FITS()} onValueChange={(v) => ctx.set(["standard"], clean({ ...std, fit: v === "clearance" ? undefined : v, head: v === "clearance" || v === "close" ? std.head : undefined }))} />
            </Row>
          </div>
          {(std.fit ?? "clearance") !== "tap" && std.fit !== "insert" && (
            <Row label={t("沉头", "Head recess")}>
              <Segmented
                size="sm"
                aria-label={t("沉头", "Head recess")}
                value={std.head ?? "none"}
                options={[
                  { value: "none", label: t("没有", "None") },
                  { value: "cbore", label: t("沉孔", "Counterbore") },
                  { value: "csink", label: t("埋头", "Countersink") },
                ]}
                onValueChange={(v) => ctx.set(["standard"], clean({ ...std, head: v === "none" ? undefined : v }))}
              />
            </Row>
          )}
        </>
      ) : (
        <NumField ctx={ctx} path={["d"]} label={t("直径", "Diameter")} />
      )}
    </div>
  )
}
