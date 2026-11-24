import * as React from "react"
import type { UIMessage } from "ai"
import { ArrowUp, Check, ChevronRight, History, Settings2, ShieldQuestion, Square, SquarePen, Trash2, X } from "lucide-react"
import { Button, IconButton } from "@/components/ui/button"
import { Input, Textarea } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Segmented } from "@/components/ui/segmented"
import { Select } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Markdown } from "@/studio/ui/markdown"
import { cn } from "@/lib/utils"
import { t } from "@/lib/i18n"
import { turnery } from "../bridge"
import type { TurnUsage } from "../core/assistant"
import type { AgentInfo, AgentOption, AgentsState, ModelSettings } from "../core/protocol"
import type { AgentNotice, PermissionCard } from "../core/acp-stream"
import { activity } from "../assistant-activity"
import { useAssistant, type Assistant } from "../use-assistant"
import { ModelSettingsDialog } from "./model-settings"
import { ago, commandLabel, useNow } from "./words"

type ToolPart = { type: string; state?: string; input?: Record<string, unknown>; output?: { ok?: boolean; text?: string; images?: string[]; imagesDropped?: number }; errorText?: string }

/**
 * The conversation, the right panel's first tab: say what to build or change. The built-in assistant
 * works with the same commands an outside agent has; or the person's own agent answers (Codex).
 */
export function AssistantPanel() {
  const chat = useAssistant()
  const { draft: text, setDraft: setText } = chat
  const [settings, setSettings] = React.useState<ModelSettings | null>(null)
  const [agents, setAgents] = React.useState<AgentsState | null>(null)
  const [settingsOpen, setSettingsOpen] = React.useState(false)
  React.useEffect(() => {
    void turnery.models().then(setSettings)
    void turnery.agents().then(setAgents)
    // Changed in another window too: a send goes to whoever answers now, so this window shows that.
    return turnery.onAgentsChanged(setAgents)
  }, [])

  const current = settings?.presets.find((p) => p.id === settings.current)
  /** The outside agent answering instead of the built-in assistant (null: the built-in one). */
  const agent = agents && agents.use !== "builtin" ? (agents.agents.find((a) => a.id === agents.use) ?? null) : null
  const usable = agent ? !agent.problem : Boolean(current && (current.keyless || current.hasKey) && (current.model || current.defaultModel))
  const submit = () => {
    if (chat.send(text)) setText("")
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center gap-0.5 border-b pr-1.5 pl-3">
        <ChatTitle chat={chat} />
        <span className="flex-1" />
        <HistoryButton chat={chat} />
        <IconButton label={t("新对话", "New chat")} size="icon-sm" disabled={chat.busy || chat.messages.length === 0} onClick={chat.newChat}>
          <SquarePen />
        </IconButton>
      </div>

      <Conversation chat={chat} agent={agent} usable={usable} onSettings={() => setSettingsOpen(true)} />

      <form
        className="shrink-0 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <div className="relative">
          <Textarea
            rows={3}
            value={text}
            disabled={!usable}
            aria-label={agent ? t(`对 ${agent.name} 说`, `Message ${agent.name}`) : t("对助手说", "Message the assistant")}
            placeholder={usable ? t("例如：把壁厚改成 3，再核对一遍", "For example: make the walls 3 mm thick, then check again") : agent ? t(`先把 ${agent.name} 装好、登录`, `Install and sign in to ${agent.name} first`) : t("先配置模型", "Set up a model first")}
            className="resize-none pr-11"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submit()
              }
            }}
          />
          <div className="absolute right-1.5 bottom-1.5">
            {chat.busy ? (
              <IconButton label={t("停止", "Stop")} variant="secondary" size="icon-sm" onClick={() => void chat.stop()}>
                <Square />
              </IconButton>
            ) : (
              <IconButton label={t("发送", "Send")} variant="primary" size="icon-sm" type="submit" disabled={!usable || !text.trim()}>
                <ArrowUp />
              </IconButton>
            )}
          </div>
        </div>
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1">
          <button
            type="button"
            className="flex max-w-full items-center gap-1.5 rounded-md px-1 py-0.5 text-caption text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings2 className="size-3.5 shrink-0" />
            <span className="truncate">
              {agent ? (agent.problem ? t(`${agent.name} · 还不能用`, `${agent.name} · not ready`) : agent.name) : current ? `${current.name} · ${current.model || current.defaultModel || t("还没填模型名", "No model name yet")}` : t("配置模型", "Set up model")}
            </span>
          </button>
          {agent && !agent.problem && <AgentOptions chat={chat} agent={agent} />}
        </div>
      </form>
      <ModelSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} onSaved={setSettings} onAgents={setAgents} />
    </div>
  )
}

/**
 * The agent's model, reasoning and permission choices for this conversation: what its session
 * offers (or offered last time), applied to the session at once and kept as the defaults.
 */
function AgentOptions({ chat, agent }: { chat: Assistant; agent: AgentInfo }) {
  const [options, setOptions] = React.useState<AgentOption[]>([])
  // Read again when a turn starts and ends (the agent may change them); they're only locked while it runs.
  React.useEffect(() => {
    let alive = true
    void turnery.agentOptions(chat.id).then((o) => alive && setOptions(o))
    return () => {
      alive = false
    }
  }, [chat.id, chat.busy, agent.id])
  const label: Record<string, string> = { model: t("模型", "Model"), reasoning_effort: t("推理强度", "Reasoning"), mode: t("权限", "Permissions") }
  return (
    <>
      {options.map((o) => (
        <Select
          key={o.id}
          aria-label={label[o.id] ?? o.name}
          className="h-6 w-auto max-w-40 gap-1 border-0 bg-transparent px-1.5 text-caption text-muted-foreground shadow-none hover:bg-accent hover:text-foreground"
          disabled={chat.busy}
          value={o.value}
          onValueChange={(v) => {
            setOptions((all) => all.map((x) => (x.id === o.id ? { ...x, value: v } : x)))
            void turnery.setAgentOption(chat.id, o.id, v).then(setOptions)
          }}
          options={o.choices.map((c) => ({ value: c.value, label: o.id === "mode" ? (MODE_LABEL[c.value] ?? c.name) : c.name }))}
        />
      ))}
    </>
  )
}

/** Codex's permission modes, said the way the chat window says them. */
const MODE_LABEL: Record<string, string> = {
  "read-only": t("只读，改动先问", "Read-only, asks first"),
  "workspace-write": t("可改项目文件", "Can edit project files"),
  agent: t("自动审查", "Auto review"),
}

/** The conversation's name; click to rename it. */
function ChatTitle({ chat }: { chat: Assistant }) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  if (editing)
    return (
      <Input
        autoFocus
        aria-label={t("对话名称", "Chat name")}
        value={draft}
        className="h-7 min-w-0 flex-1 text-small"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false)
          void chat.rename(draft)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur()
          if (e.key === "Escape") {
            setDraft(chat.title)
            setEditing(false)
          }
        }}
      />
    )
  return (
    <button
      type="button"
      title={t("改名", "Rename")}
      className="min-w-0 truncate rounded-md px-1 py-0.5 text-left text-small font-medium outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => {
        setDraft(chat.title)
        setEditing(true)
      }}
    >
      {chat.title}
    </button>
  )
}

/** Past conversations held here (or everywhere): open one to look back or carry on. */
function HistoryButton({ chat }: { chat: Assistant }) {
  const [open, setOpen] = React.useState(false)
  const now = useNow(30_000)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton label={t("历史对话", "Past chats")} size="icon-sm">
          <History />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-small font-medium">{t("历史对话", "Past chats")}</span>
          <span className="flex-1" />
          <Segmented
            size="sm"
            aria-label={t("范围", "Scope")}
            value={chat.scope}
            onValueChange={(v) => chat.setScope(v as "here" | "all")}
            options={[
              { value: "here", label: t("这个项目", "This project") },
              { value: "all", label: t("全部", "All") },
            ]}
          />
        </div>
        {chat.history.length === 0 ? (
          <p className="px-3 py-6 text-center text-small text-muted-foreground">{t("还没有保存的对话。每一轮回答完都会自动保存。", "No saved chats yet. Each chat is saved after every answer.")}</p>
        ) : (
          <ul className="max-h-80 overflow-y-auto py-1" aria-label={t("历史对话", "Past chats")}>
            {chat.history.map((c) => (
              <li key={c.id} className="group flex items-center">
                <button
                  type="button"
                  disabled={chat.busy}
                  className={cn("flex min-w-0 flex-1 flex-col px-3 py-1.5 text-left outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-50", c.id === chat.id && "bg-accent")}
                  onClick={() => {
                    void chat.open(c.id)
                    setOpen(false)
                  }}
                >
                  <span className="truncate text-small">{c.title}</span>
                  <span className="truncate text-caption text-faint-foreground">
                    {ago(c.updatedAt, now)} · {t(`${c.count} 条`, c.count === 1 ? "1 message" : `${c.count} messages`)}
                    {chat.scope === "all" && c.project ? ` · ${c.project.split(/[\\/]/).pop()}` : ""}
                  </span>
                </button>
                <IconButton label={t("删除这段对话", "Delete this chat")} size="icon-sm" className="mr-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100" disabled={chat.busy && c.id === chat.id} onClick={() => void chat.remove(c.id)}>
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** The messages, kept at the bottom while the answer grows unless the person scrolled up to read. */
function Conversation({ chat, agent, usable, onSettings }: { chat: Assistant; agent: AgentInfo | null; usable: boolean; onSettings: () => void }) {
  const box = React.useRef<HTMLDivElement>(null)
  const stuck = React.useRef(true)
  React.useEffect(() => {
    stuck.current = true
  }, [chat.id])
  React.useLayoutEffect(() => {
    const el = box.current
    if (el && stuck.current) el.scrollTop = el.scrollHeight
  }, [chat.messages, chat.busy, chat.id])
  const last = chat.messages.at(-1)
  return (
    <div
      ref={box}
      className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
      aria-label={t("和助手的对话", "Chat with the assistant")}
      role="log"
      onScroll={(e) => {
        const el = e.currentTarget
        stuck.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
      }}
    >
      {chat.messages.length === 0 ? (
        <div className="pt-6 text-body text-muted-foreground">
          <p className="text-heading font-semibold text-foreground">{t("用说的来建和改", "Build and change by talking")}</p>
          {agent ? (
            <>
              <p className="mt-2">{t(`说出要做什么，${agent.name} 在这个项目里一步步做，你在窗口里看到每一步。`, `Say what you want. ${agent.name} works in this project step by step, and you see every step in the window.`)}</p>
              <p className="mt-1 text-small text-faint-foreground">
                {t(`用的是你自己的 ${agent.name} 和它的订阅。改文件、跑会改东西的命令、用别的工具之前，它会先在这里问你。`, `It’s your own ${agent.name} on its own subscription. Before it edits files, runs commands that change things or uses other tools, it asks you here first.`)}
              </p>
            </>
          ) : (
            <>
              <p className="mt-2">{t("说出要做什么，助手在这个零件上一步步做，做完核对你说的数字。", "Say what you want. The assistant works on this part step by step, then checks the numbers you gave.")}</p>
              <p className="mt-1 text-small text-faint-foreground">{t("它只能用 Turnery 的建模命令，碰不到别的文件。", "It can only use Turnery’s modeling commands and can’t touch other files.")}</p>
            </>
          )}
          {!usable && (
            <Button className="mt-4" variant="primary" onClick={onSettings}>
              {agent ? t(`看看 ${agent.name} 差什么`, `See what ${agent.name} needs`) : t("先配置模型", "Set up a model first")}
            </Button>
          )}
        </div>
      ) : (
        <ol className="flex flex-col gap-4">
          {chat.messages.map((m) => (
            <li key={m.id}>
              <Message message={m} live={chat.busy && m === last} />
            </li>
          ))}
        </ol>
      )}
      {chat.busy && <TurnStatus chat={chat} />}
      {chat.error && !chat.busy && <p className="mt-3 text-small text-destructive">{chat.error.message}</p>}
    </div>
  )
}

/** Earlier messages don't change: only the one being written re-renders while it streams. */
const Message = React.memo(function Message({ message, live }: { message: UIMessage; live: boolean }) {
  if (message.role === "user")
    return (
      <div className="ml-8 rounded-lg bg-accent px-3 py-2 text-body whitespace-pre-wrap">
        {message.parts.map((p, i) => (p.type === "text" ? <span key={i}>{p.text}</span> : null))}
      </div>
    )
  const usage = (message.metadata as { usage?: TurnUsage } | undefined)?.usage
  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((p, i) => {
        if (p.type === "reasoning") return p.text.trim() ? <Reasoning key={i} text={p.text} live={live && p.state === "streaming"} /> : null
        if (p.type === "text") return p.text.trim() ? <Markdown key={i} text={p.text} streaming={live && p.state === "streaming"} /> : null
        if (p.type.startsWith("tool-")) return <ToolRow key={i} part={p as ToolPart} />
        if (p.type === "data-permission") return <PermissionRow key={i} id={(p as { id?: string }).id ?? ""} card={(p as { data: PermissionCard }).data} live={live} />
        if (p.type === "data-notice") return <NoticeRow key={i} notice={(p as { data: AgentNotice }).data} live={live} />
        return null
      })}
      {usage && !live && <UsageLine usage={usage} />}
    </div>
  )
})

/**
 * What the model is thinking. While it thinks, the latest lines show as they come (a long silence
 * was the worst part of waiting); afterwards it folds into one line that opens on a click.
 */
function Reasoning({ text, live }: { text: string; live: boolean }) {
  const tail = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    if (live && tail.current) tail.current.scrollTop = tail.current.scrollHeight
  }, [text, live])
  if (live)
    return (
      <div className="text-small text-faint-foreground">
        <div className="flex items-center gap-1">
          <Spinner className="size-3" />
          {t("思考中", "Thinking")}
        </div>
        <div ref={tail} className="mt-1 max-h-24 overflow-hidden border-l pl-3 whitespace-pre-wrap">
          {text.trim()}
        </div>
      </div>
    )
  return (
    <details className="group text-small text-faint-foreground">
      <summary className="flex cursor-pointer list-none items-center gap-1 select-none hover:text-muted-foreground">
        <ChevronRight className="size-3.5 transition-transform duration-(--duration-fast) group-open:rotate-90" />
        {t("思考过程", "Reasoning")}
      </summary>
      <div className="mt-1 border-l pl-3 whitespace-pre-wrap">{text.trim()}</div>
    </details>
  )
}

/**
 * The agent's own words for its choices, in Chinese (Codex's, codex-acp 2.10). Translated sentence
 * by sentence, never by kind: two choices of one kind can mean different things ("continue without
 * running it" and "tell Codex what to do differently" are both a rejection). Anything else shows as
 * the agent wrote it.
 */
const CHOICE_ZH: Record<string, string> = {
  Allow: "允许",
  "Allow for this session": "这次对话都允许",
  Deny: "拒绝",
  Cancel: "取消",
  "Yes, proceed": "可以，继续",
  "Yes, just this once": "可以，只这一次",
  "Yes, and don't ask again for this command in this session": "可以，这次对话里这个命令不用再问",
  "Yes, and allow this host for this conversation": "可以，这次对话里允许访问这个网站",
  "Yes, and allow these permissions for this session": "可以，这次对话里给它这些权限",
  "Yes, and don't ask again for these files": "可以，这些文件不用再问",
  "No, continue without running it": "不行，不运行它，接着做",
  "No, and tell Codex what to do differently": "不行，我来告诉它怎么改",
  "Yes, implement this plan": "可以，按这个计划做",
}
const choiceLabel = (label: string) => (CHOICE_ZH[label] ? t(CHOICE_ZH[label], label) : label)

/** The agent asks before doing something: what it wants to do, and the person's answer. */
function PermissionRow({ id, card, live }: { id: string; card: PermissionCard; live: boolean }) {
  const [sent, setSent] = React.useState<string | null>(null)
  const answer = card.answer ?? sent
  const chosen = card.options.find((o) => o.id === answer)
  const open = !answer && live
  return (
    <div className={cn("rounded-md border px-2.5 py-2", open && "border-warning")} role={open ? "alert" : undefined}>
      <div className="flex items-start gap-2 text-small">
        <ShieldQuestion className={cn("mt-0.5 size-3.5 shrink-0", open ? "text-warning" : "text-muted-foreground")} />
        <span className="min-w-0 flex-1 font-medium">{card.title || commandLabel(`agent-${card.kind ?? "other"}`)}</span>
      </div>
      {card.detail && card.detail !== card.title && <pre className="mt-1 max-h-32 overflow-auto font-mono text-caption whitespace-pre-wrap text-muted-foreground">{card.detail}</pre>}
      {open ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {card.options.map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={o.kind === "allow_once" ? "primary" : o.kind.startsWith("allow") ? "secondary" : "ghost"}
              onClick={() => {
                setSent(o.id)
                void turnery.answerPermission(id, o.id)
              }}
            >
              {choiceLabel(o.label)}
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-caption text-faint-foreground">
          {chosen ? t(`你选了：${choiceLabel(chosen.label)}`, `You chose: ${chosen.label}`) : t("没有回答，已取消", "Not answered; cancelled")}
        </p>
      )}
    </div>
  )
}

/**
 * The agent waits for an approval that never came here: the person's own agent setup took it (an
 * approval app hooked into Codex). Gone once the wait is over.
 */
function NoticeRow({ notice, live }: { notice: AgentNotice; live: boolean }) {
  if (notice.kind !== "approval-elsewhere" || !notice.active || !live) return null
  return (
    <div role="status" className="flex items-start gap-2 rounded-md border border-warning px-2.5 py-2 text-small">
      <ShieldQuestion className="mt-0.5 size-3.5 shrink-0 text-warning" />
      <p>
        {t(
          "它在等你批准一步操作，但审批没有发到这里：你可能给它配了自己的审批工具（比如接在 PermissionRequest 钩子上的应用）。去那里批准或拒绝，或者点停止。",
          "It’s waiting for you to approve a step, but the approval didn’t come here: you may have set up your own approval tool for it (an app on its PermissionRequest hook, for example). Approve or deny it there, or click Stop.",
        )}
      </p>
    </div>
  )
}

/** One command the assistant ran: what it was, whether it worked, the first line of the result. */
function ToolRow({ part }: { part: ToolPart }) {
  const name = part.type.slice("tool-".length)
  const done = part.state === "output-available" || part.state === "output-error"
  const ok = part.state === "output-available" && part.output?.ok !== false
  const line = part.errorText ?? part.output?.text?.split("\n")[0] ?? ""
  const target = typeof part.input?.name === "string" ? part.input.name : typeof part.input?.id === "string" ? part.input.id : null
  return (
    <div className="rounded-md border px-2.5 py-1.5">
      <div className="flex items-center gap-2 text-small">
        {!done ? <Spinner className="size-3.5" /> : ok ? <Check className="size-3.5 text-success" /> : <X className="size-3.5 text-destructive" />}
        <span className="font-medium">{commandLabel(name)}</span>
        {target && <span className="min-w-0 truncate text-muted-foreground">{target}</span>}
        <span className="ml-auto shrink-0 font-mono text-caption text-faint-foreground">{name}</span>
      </div>
      {line && <p className={cn("mt-1 line-clamp-2 text-caption", ok ? "text-muted-foreground" : "text-destructive")}>{line.replace(/^[✓✗] /, "")}</p>}
      {part.output?.images?.length ? (
        <div className="mt-1.5 flex gap-1.5 overflow-x-auto">
          {part.output.images.map((src, i) => (
            <img key={i} src={src} alt={t(`视图 ${i + 1}`, `View ${i + 1}`)} className="h-24 rounded border bg-card" />
          ))}
        </div>
      ) : part.output?.imagesDropped ? (
        <p className="mt-1 text-caption text-faint-foreground">{t(`${part.output.imagesDropped} 张视图没有保存`, part.output.imagesDropped === 1 ? "1 view wasn’t saved" : `${part.output.imagesDropped} views weren’t saved`)}</p>
      ) : null}
    </div>
  )
}

const k = (n: number) => (n >= 10_000 ? `${(n / 1000).toFixed(0)}k` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

function UsageLine({ usage }: { usage: TurnUsage }) {
  if (!usage.input && !usage.output) return null
  const cached = usage.input && usage.cached ? t(`（缓存 ${Math.round((usage.cached / usage.input) * 100)}%）`, ` (${Math.round((usage.cached / usage.input) * 100)}% cached)`) : ""
  return (
    <p className="text-caption text-faint-foreground tabular">
      {t(`输入 ${k(usage.input)}`, `Input ${k(usage.input)}`)}
      {cached}
      {t(` · 输出 ${k(usage.output)} tokens`, ` · output ${k(usage.output)} tokens`)}
    </p>
  )
}

/** What the turn is doing right now, under the conversation while it runs, with how long it has taken. */
function TurnStatus({ chat }: { chat: Assistant }) {
  const [start] = React.useState(() => Date.now())
  const now = useNow(1000)
  const seconds = Math.round((now - start) / 1000)
  return (
    <div role="status" className="mt-3 flex items-center gap-2 text-small text-muted-foreground">
      <Spinner className="size-3.5" />
      <span className="truncate">{activity(chat)}…</span>
      {seconds >= 3 && <span className="ml-auto shrink-0 text-caption text-faint-foreground tabular">{t(`${seconds} 秒`, `${seconds} s`)}</span>}
    </div>
  )
}
