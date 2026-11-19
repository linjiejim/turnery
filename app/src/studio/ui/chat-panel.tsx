import * as React from "react"
import { Check, ChevronDown, ChevronRight, CircleHelp, Eye, ImagePlus, ListChecks, Palette, Pencil, Search, SlidersHorizontal, Square, Trash2, TriangleAlert, X, type LucideIcon } from "lucide-react"
import type { FileUIPart, UIMessage } from "ai"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { Button, IconButton } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Segmented } from "@/components/ui/segmented"
import { Textarea } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { OpIcon } from "@/components/op-icon"
import type { OpId } from "@/content/ops"
import { isDivider } from "../share"
import { STARTERS } from "../starters"
import type { Tree } from "../dsl"
import type { ToolOutput } from "../tools"
import { ANNOTATED_VIEW, errorText, MAX_CALLS_PER_TURN, type StudioChat } from "../use-studio-chat"
import { Annotations as AnnotationList, circled, type Annotation } from "../annotations"
import type { Annotations, Note } from "../use-annotations"
import { Markdown } from "./markdown"
import { Hint } from "@/components/hint"

/** Requests to start from: a short label on the chip, the whole request sent. */
const EXAMPLES = [
  {
    label: t("80×50×30 小盒子", "80×50×30 box"),
    text: t("做一个 80×50×30 的小盒子，顶部开口，壁厚 2，竖边 R6 圆角", "Make an 80×50×30 box, open at the top, walls 2 thick, R6 fillets on the vertical edges"),
  },
  {
    label: t("⌀80 杯子", "⌀80 cup"),
    text: t("做一个外径 80、高 100 的杯子，壁厚 3，杯底外缘 R5 圆角", "Make a cup with outer diameter 80 and height 100, walls 3 thick, an R5 fillet on the outer bottom edge"),
  },
  {
    label: t("6 孔法兰盘", "6-hole flange"),
    text: t("做一个法兰盘：外径 120、厚 10，中心孔 ⌀40，在 ⌀90 圆周上均布 6 个 ⌀8 孔", "Make a flange: outer diameter 120, 10 thick, a ⌀40 center hole, and 6 ⌀8 holes evenly spaced on a ⌀90 circle"),
  },
  {
    label: t("四孔安装板", "4-hole mounting plate"),
    text: t("做一块 100×60×5 的安装板，四角各一个 ⌀6 通孔，离边 8 mm", "Make a 100×60×5 mounting plate with a ⌀6 through hole in each corner, 8 mm from the edges"),
  },
]

const TOOL_LABEL: Record<string, { label: string; op?: OpId; icon?: LucideIcon }> = {
  set_params: { label: t("参数", "Parameters"), icon: SlidersHorizontal },
  sketch: { label: t("草图", "Sketch"), op: "sketch" },
  extrude: { label: t("拉伸", "Extrude"), op: "extrude" },
  revolve: { label: t("旋转", "Revolve"), op: "revolve" },
  fillet: { label: t("圆角", "Fillet"), op: "fillet" },
  chamfer: { label: t("倒角", "Chamfer"), op: "chamfer" },
  shell: { label: t("抽壳", "Shell"), op: "shell" },
  hole: { label: t("孔", "Hole"), op: "hole" },
  linear_pattern: { label: t("线性阵列", "Linear pattern"), op: "pattern" },
  circular_pattern: { label: t("圆周阵列", "Circular pattern"), op: "pattern" },
  mirror: { label: t("镜像", "Mirror"), op: "mirror" },
  sweep: { label: t("扫掠", "Sweep"), op: "sweep" },
  loft: { label: t("放样", "Loft"), op: "loft" },
  draft: { label: t("拔模", "Draft"), op: "draft" },
  rib: { label: t("筋", "Rib"), op: "rib" },
  split: { label: t("拆件", "Split"), op: "cut" },
  edit_feature: { label: t("修改特征", "Edit feature"), icon: Pencil },
  delete_feature: { label: t("删除特征", "Delete feature"), icon: Trash2 },
  inspect: { label: t("查看模型", "Inspect model"), icon: Search },
  look: { label: t("看一眼", "Look"), icon: Eye },
  check: { label: t("核对要求", "Check"), icon: ListChecks },
  set_appearance: { label: t("颜色", "Color"), icon: Palette },
}

/** Tools that only look at the model. */
const READ_TOOLS = new Set(["inspect", "look", "check"])

export function ChatPanel({
  chat,
  annotations,
  onSelectFeature,
  onLoad,
  ready,
  model,
  practicing = false,
}: {
  chat: StudioChat
  annotations: Annotations
  onSelectFeature: (id: string) => void
  onLoad: (t: Tree) => void
  ready: boolean
  /** The model behind the tutor, for the ⓘ. */
  model?: string
  /** A practice is on: its card says what to build, so no example prompts or starters. */
  practicing?: boolean
}) {
  const [text, setText] = React.useState("")
  const [files, setFiles] = React.useState<FileUIPart[]>([])
  const [fileError, setFileError] = React.useState<string | null>(null)
  const picker = React.useRef<HTMLInputElement>(null)
  const scroller = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLDivElement>(null)
  /** Follow new output only while the learner is at the bottom; scrolling up to read stops it. */
  const stick = React.useRef(true)
  const err = errorText(chat.error)

  React.useEffect(() => {
    const el = scroller.current
    const inner = content.current
    if (!el || !inner) return
    const follow = () => {
      // The intro reads from the top; only a conversation follows its end.
      if (stick.current && !inner.dataset.empty) el.scrollTop = el.scrollHeight
    }
    // Any growth counts: streamed text, a tool card filling in, a `look` image loading.
    const ro = new ResizeObserver(follow)
    ro.observe(inner)
    follow()
    return () => ro.disconnect()
  }, [])

  // 「让助教改这一步」: start the message with the step's name, cursor at the end.
  const box = React.useRef<HTMLTextAreaElement>(null)
  const [prefilled, setPrefilled] = React.useState(annotations.prefill)
  if (prefilled !== annotations.prefill) {
    setPrefilled(annotations.prefill)
    if (annotations.prefill) setText(annotations.prefill.text)
  }
  React.useEffect(() => {
    const el = box.current
    if (!annotations.prefill || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [annotations.prefill])

  const notes = annotations.pending
  const canSend = (text.trim() || files.length || notes.length) && !chat.busy && ready
  const submit = () => {
    if (!canSend) return
    stick.current = true
    chat.send(text, files.length ? files : undefined, notes, notes.length ? annotations.snapshot() : null)
    annotations.markSent()
    setText("")
    setFiles([])
  }

  // A reply's ①② refer to the annotations of the message it answers.
  const notesFor = React.useMemo(
    () => chat.messages.reduce<(Annotation[] | null)[]>((acc, m, i) => [...acc, m.role === "user" ? annotationsOf(m) : (acc[i - 1] ?? null)], []),
    [chat.messages],
  )

  const attach = async (list: FileList | null) => {
    setFileError(null)
    const picked = [...(list ?? [])].filter((f) => f.type.startsWith("image/")).slice(0, 2 - files.length)
    try {
      const parts = await Promise.all(picked.map(toImagePart))
      setFiles((f) => [...f, ...parts].slice(0, 2))
    } catch {
      setFileError(t("这张图读不出来，换一张 JPG 或 PNG 试试。", "Couldn’t read this image. Try a JPG or PNG."))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        className="min-h-0 flex-1 overflow-y-auto [overflow-anchor:none]"
        onScroll={(e) => {
          const el = e.currentTarget
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
        }}
      >
        {/* Empty, the intro sits in the middle of the conversation; a conversation reads from the top. */}
        <div ref={content} data-empty={chat.messages.length === 0 || undefined} className="px-4 pt-4 pb-2 data-empty:flex data-empty:min-h-full data-empty:flex-col data-empty:justify-center">
          {chat.messages.length === 0 ? (
            <Intro
              model={model}
              practicing={practicing}
              onPick={(t) => {
                if (!ready) return
                stick.current = true
                chat.send(t)
              }}
              onLoad={onLoad}
              disabled={!ready}
            />
          ) : (
            <div className="space-y-4">
              {chat.messages.map((m, i) => (
                <Message key={m.id} m={m} notes={notesFor[i]} streaming={chat.busy && i === chat.messages.length - 1} onShow={annotations.show} onSelectFeature={onSelectFeature} terms={chat.mode === "teach"} />
              ))}
              {chat.paused && (
                <div className="rounded-md border p-3 text-small text-muted-foreground">
                  {t(`这一轮已经调用了 ${MAX_CALLS_PER_TURN} 次工具，先停一下。看看模型，需要的话说「继续」。`, `Paused after ${MAX_CALLS_PER_TURN} tool calls this turn. Have a look at the model, and say “continue” if needed.`)}
                </div>
              )}
              {err && (
                <div role="alert" className="rounded-md border border-destructive/40 p-3 text-small">
                  <div className="flex items-start gap-2 text-destructive">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                    <span>{err}</span>
                  </div>
                  <Button size="sm" variant="secondary" className="mt-2" onClick={() => void chat.regenerate()}>
                    {t("重试", "Retry")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        {chat.busy && <TurnStatus chat={chat} />}
      </div>
      <div className="shrink-0 border-t p-3">
        {notes.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label={t("要随消息发出的标注", "Notes to send with the message")}>
            {notes.map((a) => (
              <NoteChip key={a.n} a={a} onClick={() => annotations.setFocus({ kind: a.kind, hashes: [a.hash] })} onRemove={() => annotations.remove(a.n)} />
            ))}
          </div>
        )}
        {files.length > 0 && (
          <div className="mb-2 flex gap-2">
            {files.map((f, i) => (
              <div key={i} className="relative">
                <img src={f.url} alt={t("参考图", "Reference image")} className="size-14 rounded-md border object-cover" />
                <button
                  type="button"
                  aria-label={t("移除这张图", "Remove this image")}
                  onClick={() => setFiles((x) => x.filter((_, k) => k !== i))}
                  className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {fileError && <p className="mb-2 text-small text-destructive">{fileError}</p>}
        <Textarea
          ref={box}
          rows={2}
          value={text}
          placeholder={!ready ? t("建模内核加载中…", "Loading the modeling kernel…") : notes.length ? t("补充说明（可以不写）… Enter 发送", "Add a comment (optional)… Enter to send") : t("描述你想做的零件，或者说要改哪里… Enter 发送", "Describe the part you want, or what to change… Enter to send")}
          disabled={!ready}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          className="resize-none"
          aria-label={t("给建模助教的消息", "Message to the modeling tutor")}
        />
        <div className="mt-2 flex items-center gap-2">
          <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(e) => void attach(e.target.files).finally(() => (e.target.value = ""))} />
          <IconButton label={t("附参考图（照片或草图）", "Attach a reference image (photo or sketch)")} size="icon-sm" disabled={!ready || files.length >= 2} onClick={() => picker.current?.click()}>
            <ImagePlus />
          </IconButton>
          <Segmented
            size="sm"
            aria-label={t("对话模式", "Chat mode")}
            value={chat.mode}
            onValueChange={chat.setMode}
            options={[
              { value: "build", label: t("直接做", "Just build") },
              { value: "teach", label: t("边做边学", "Learn as you go") },
            ]}
          />
          {chat.busy ? (
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => void chat.stop()}>
              <Square />
              {t("停止", "Stop")}
            </Button>
          ) : (
            <Button size="sm" variant="primary" className="ml-auto" disabled={!canSend} onClick={submit}>
              {t("发送", "Send")}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** The empty conversation: one line, a few requests to start from, and the ready-made trees behind a menu. */
function Intro({ onPick, onLoad, disabled, model, practicing }: { onPick: (t: string) => void; onLoad: (t: Tree) => void; disabled: boolean; model?: string; practicing?: boolean }) {
  return (
    <div className="flex flex-col items-center pb-8 text-center">
      <h2 className="flex items-center gap-1.5 text-heading font-semibold">
        {t("用说的来建模", "Model by describing it")}
        <Hint
          label={t("怎么用", "How it works")}
          tips={[
            t("说出零件的形状和尺寸，助教一步步建出参数化特征树。", "Describe the part’s shape and size; the tutor builds a parametric feature tree step by step."),
            t("「边做边学」：关键步骤先让你猜，再讲为什么。", "“Learn as you go”: at key steps you guess first, then hear why."),
            t("每一步都能回滚查看，参数可以直接拖。", "Roll back to any step, and drag the parameters directly."),
            t("几何由 OpenCascade 内核在你的浏览器里算出。", "The geometry is computed by the OpenCascade kernel in your browser."),
            ...(model ? [t(`助教用的模型：${model}`, `Tutor’s model: ${model}`)] : []),
          ]}
        />
      </h2>
      {practicing ? (
        <p className="mt-2 max-w-72 text-body text-muted-foreground">{t("说说你打算怎么做，助教会带你一步步建。", "Say how you plan to build it, and the tutor will walk you through it.")}</p>
      ) : (
        <>
          <div className="mt-4 flex max-w-72 flex-wrap justify-center gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e.label}
                type="button"
                disabled={disabled}
                title={e.text}
                onClick={() => onPick(e.text)}
                className="rounded-full border px-3 py-1 text-small text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                {e.label}
              </button>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="mt-3 text-muted-foreground" disabled={disabled}>
                {t("打开示例模型", "Open an example model")}
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>{t("现成的特征树，不用 AI", "Ready-made feature trees, no AI")}</DropdownMenuLabel>
              {STARTERS.map((s) => (
                <DropdownMenuItem key={s.id} onSelect={() => onLoad(s.tree)}>
                  {s.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

function Message({
  m,
  notes,
  streaming,
  onShow,
  onSelectFeature,
  terms,
}: {
  m: UIMessage
  notes: Annotation[] | null
  /** The reply still coming in: its unfinished Markdown is patched up while it streams. */
  streaming: boolean
  onShow: (a: Annotation) => void
  onSelectFeature: (id: string) => void
  /** 「边做边学」: concepts in the reply open their glossary card. */
  terms: boolean
}) {
  const onPin = React.useMemo(
    () =>
      notes?.length
        ? (n: number) => {
            const a = notes.find((x) => x.n === n)
            if (a) onShow(a)
          }
        : undefined,
    [notes, onShow],
  )
  if (isDivider(m)) {
    // The model changed under the conversation (a copied link, an import): for the learner only, never sent.
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
    return (
      <div role="separator" aria-label={text} className="flex items-center gap-3 text-caption text-faint-foreground">
        <span className="h-px flex-1 bg-border" />
        {text}
        <span className="h-px flex-1 bg-border" />
      </div>
    )
  }
  if (m.role === "user") {
    const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")
    const images = m.parts.filter((p): p is FileUIPart => p.type === "file" && p.mediaType.startsWith("image/"))
    return (
      <div className="ml-8 rounded-lg bg-muted px-3 py-2 text-body whitespace-pre-wrap">
        {images.length > 0 && (
          <div className="mb-2 flex gap-2">
            {images.map((f, i) => (
              <img key={i} src={f.url} alt={f.filename === ANNOTATED_VIEW ? t("标注截图", "Annotated view") : t("参考图", "Reference image")} className="max-h-28 rounded-md border" />
            ))}
          </div>
        )}
        {text}
        {notes && notes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5 whitespace-normal">
            {notes.map((a) => (
              <NoteChip key={a.n} a={a} onClick={() => onShow(a)} />
            ))}
          </div>
        )}
      </div>
    )
  }
  // One turn spans many steps, each with its own bit of thinking; show it as one block.
  const thoughts = m.parts.flatMap((p) => (p.type === "reasoning" && p.text.trim() ? [p.text.trim()] : []))
  return (
    <div className="space-y-2">
      {thoughts.length > 0 && <Reasoning parts={thoughts} />}
      {m.parts.map((p, i) => {
        if (p.type === "text") return p.text.trim() ? <Markdown key={i} text={p.text} onPin={onPin} streaming={streaming && p.state === "streaming"} terms={terms && m.role === "assistant"} /> : null
        if (p.type.startsWith("tool-")) return <ToolCard key={i} part={p as ToolPart} onSelectFeature={onSelectFeature} />
        return null
      })}
    </div>
  )
}

function annotationsOf(m: UIMessage): Annotation[] | null {
  const parsed = AnnotationList.safeParse((m.metadata as { annotations?: unknown } | undefined)?.annotations)
  return parsed.success && parsed.data.length ? parsed.data : null
}

/** ① 平面 · 来自「拉伸1」：开个孔 — click to show it on the model. */
function NoteChip({ a, onClick, onRemove }: { a: Annotation | Note; onClick: () => void; onRemove?: () => void }) {
  const kind = a.kind === "face" ? t("面", "Face") : t("边", "Edge")
  const label = a.note.trim() || `${kind} · ${a.what}`
  return (
    <span className="inline-flex max-w-full items-center rounded-md border bg-background text-small">
      <button
        type="button"
        onClick={onClick}
        title={`${kind} · ${a.what} · ${a.where}`}
        className="flex min-w-0 items-center gap-1 px-2 py-1 text-left hover:text-foreground"
      >
        <span className="font-semibold text-primary">{circled(a.n)}</span>
        <span className="truncate">{label}</span>
      </button>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t(`删除标注 ${a.n}`, `Remove note ${a.n}`)} className="grid size-6 shrink-0 place-items-center text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      )}
    </span>
  )
}

/** What the turn is doing right now, pinned to the bottom of the conversation while it runs. */
function TurnStatus({ chat }: { chat: StudioChat }) {
  const [start] = React.useState(() => Date.now())
  const [now, setNow] = React.useState(start)
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const seconds = Math.round((now - start) / 1000)
  return (
    <div role="status" className="sticky bottom-0 flex items-center gap-2 bg-background/95 px-4 py-2 text-small text-muted-foreground">
      <Spinner className="size-3.5" />
      <span className="truncate">{activity(chat)}…</span>
      {seconds >= 3 && <span className="ml-auto shrink-0 text-caption text-faint-foreground tabular">{t(`${seconds} 秒`, `${seconds} s`)}</span>}
    </div>
  )
}

function activity(chat: StudioChat): string {
  const last = chat.messages.at(-1)
  if (chat.status === "submitted" || last?.role !== "assistant") return t("思考中", "Thinking")
  const p = last.parts.at(-1)
  if (p?.type === "text" && p.state === "streaming") return t("正在回复", "Replying")
  if (p?.type.startsWith("tool-")) {
    const tool = p as ToolPart
    if (tool.state === "input-streaming" || tool.state === "input-available") {
      const name = tool.type.slice(5)
      if (name === "look") return t("正在看模型", "Looking at the model")
      if (name === "inspect") return t("正在查看模型", "Inspecting the model")
      const label = TOOL_LABEL[name]?.label ?? name
      const target = (tool.input?.name as string | undefined) ?? (tool.input?.id as string | undefined)
      const what = `${label}${target && target !== label ? ` · ${target}` : ""}`
      return tool.state === "input-streaming" ? t(`正在写「${what}」`, `Writing “${what}”`) : t(`正在做「${what}」`, `Running “${what}”`)
    }
  }
  return t("思考中", "Thinking")
}

function Reasoning({ parts }: { parts: string[] }) {
  return (
    <details className="group text-small text-faint-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 select-none">
        <ChevronRight className="size-3.5 transition-transform duration-(--duration-fast) group-open:rotate-90" />
        {t("思考过程", "Thinking")}
      </summary>
      <div className="mt-1 space-y-3 border-l pl-3 whitespace-pre-wrap">
        {parts.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
    </details>
  )
}

type ToolPart = {
  type: string
  toolCallId: string
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | string
  input?: Record<string, unknown>
  output?: ToolOutput
  errorText?: string
}

function ToolCard({ part, onSelectFeature }: { part: ToolPart; onSelectFeature: (id: string) => void }) {
  const name = part.type.slice(5)
  const meta = TOOL_LABEL[name] ?? { label: name }
  const input = part.input ?? {}
  const featureId = (input.id as string | undefined) ?? undefined
  // A check card is the table itself: one row per requirement, as it stood at that moment.
  const rows = name === "check" && part.state === "output-available" ? (part.output?.text ?? "").split("\n").filter((l) => /^[✓✗?] /.test(l)) : []
  const passed = rows.filter((l) => l.startsWith("✓")).length
  const counted = rows.filter((l) => !l.startsWith("?")).length
  const title = rows.length ? `${meta.label} · ${passed}/${counted}` : [meta.label, (input.name as string) ?? featureId].filter(Boolean).join(" · ")
  const running = part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error" || (part.state === "output-available" && part.output && !part.output.ok)
  const text = part.state === "output-error" ? part.errorText : part.output?.text
  const [open, setOpen] = React.useState(false)
  const firstLine = text?.split("\n")[0]
  const clickable = featureId && name !== "delete_feature"
  const Icon = meta.icon
  // Steps that change the model get a fill, so they stand out from the prose and from `inspect` / `look`.
  const changes = !READ_TOOLS.has(name)

  return (
    <div className={cn("rounded-md border text-small", failed ? "border-destructive/40 bg-destructive-subtle" : changes && "border-primary/15 bg-selected")}>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
        onClick={() => {
          setOpen((o) => !o)
          if (clickable && !failed) onSelectFeature(featureId)
        }}
        aria-expanded={open}
      >
        {meta.op ? <OpIcon op={(name === "extrude" && input.mode === "cut" ? "cut" : meta.op) as OpId} className="size-4 shrink-0 text-muted-foreground" /> : Icon ? <Icon className="size-4 shrink-0 text-muted-foreground" /> : null}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {running ? <Spinner className="size-3.5" /> : failed ? <X className="size-4 text-destructive" /> : <Check className="size-4 text-success" />}
      </button>
      {rows.length > 0 && !open && (
        <ul className="space-y-0.5 px-3 pb-2">
          {rows.map((l, i) => (
            <li key={i} className="flex items-start gap-1.5">
              {l.startsWith("✓") ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-label={t("满足", "Met")} />
              ) : l.startsWith("?") ? (
                <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-faint-foreground" aria-label={t("量不了", "Can’t measure")} />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-label={t("不满足", "Not met")} />
              )}
              <span className="min-w-0 text-muted-foreground">{l.slice(2).replace(/^\S+「/, "「")}</span>
            </li>
          ))}
        </ul>
      )}
      {!running && firstLine && !open && !rows.length && <div className="truncate px-3 pb-2 text-muted-foreground">{firstLine.replace(/^[✓✗]\s*/, "")}</div>}
      {open && text && <div className="border-t px-3 py-2 whitespace-pre-wrap text-muted-foreground">{text}</div>}
      {open && typeof input.intent === "string" && <div className="border-t px-3 py-2 text-muted-foreground">
          {t("设计意图：", "Design intent: ")}
          {input.intent}
        </div>}
      {part.output?.images?.length ? (
        <div className="grid grid-cols-2 gap-1 border-t p-1">
          {part.output.images.map((src, i) => (
            <img key={i} src={src} alt={t("助教看到的视图", "What the tutor saw")} className="w-full rounded-sm border" />
          ))}
        </div>
      ) : null}
    </div>
  )
}

/** Read an image, shrink it to at most 1024 px, return it as a data-URL file part. */
async function toImagePart(file: File): Promise<FileUIPart> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { type: "file", mediaType: "image/jpeg", filename: file.name, url: canvas.toDataURL("image/jpeg", 0.85) }
  } finally {
    URL.revokeObjectURL(url)
  }
}
