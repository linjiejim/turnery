// One turn of an outside agent (spoken to over ACP), as the chat window's UI message stream: the
// same chunks the built-in assistant sends, so the window shows both the same way. Its commands
// on Turnery's own MCP server become the usual tool cards (`tool-extrude`); anything else it does
// (a shell command, a file edit, another MCP server) becomes a card of its kind (`tool-agent-execute`).
//
// No I/O here: the caller feeds in `session/update` notifications and the end of the prompt.
import type { ContentBlock, SessionUpdate, ToolCall, ToolCallContent, ToolCallUpdate } from "@agentclientprotocol/sdk"
import type { UIMessageChunk } from "ai"
import type { TurnUsage } from "./assistant"

/** What a tool card shows when the call ends: the same shape as an engine command's result. */
export type AgentToolOutput = { ok: boolean; text: string; images?: string[] }

/** Who answered, kept with the message: lets a later turn carry the conversation on. */
export type AgentMeta = { id: string; session: string }

/**
 * A line in the conversation that isn't the agent's words (a `data-notice` part, updated in place).
 * `approval-elsewhere`: the agent waits for an approval that never reached Turnery: the person's own
 * agent setup took it (Codex's PermissionRequest hook, for example an approval app).
 */
export type AgentNotice = { kind: "approval-elsewhere"; active: boolean }

/** How long the agent may wait for an approval before the chat says it went somewhere else. */
export const APPROVAL_ELSEWHERE_MS = 4000

/** The permission card's contents (a `data-permission` part). `answer` is set once it's answered. */
export type PermissionCard = {
  title: string
  kind: string | null
  detail: string
  options: { id: string; label: string; kind: string }[]
  answer?: string
}

const TEXT_MAX = 4000

type Raw = { server?: unknown; tool?: unknown; arguments?: unknown }

/** `mcp.turnery.extrude` / `{ server: "turnery", tool: "extrude" }` → "extrude" when the server is ours. */
export function ownCommand(call: { title?: string | null; rawInput?: unknown }, server: string): { name: string; input: unknown } | null {
  const raw = (call.rawInput ?? null) as Raw | null
  if (raw && raw.server === server && typeof raw.tool === "string") return { name: raw.tool, input: raw.arguments ?? {} }
  const m = /^mcp\.([^.]+)\.(.+)$/.exec(call.title ?? "")
  if (m && m[1] === server) return { name: m[2], input: (raw?.arguments as unknown) ?? {} }
  return null
}

const blockText = (b: ContentBlock | undefined) => (b && b.type === "text" ? b.text : "")
const blockImage = (b: ContentBlock | undefined) => (b && b.type === "image" ? `data:${b.mimeType};base64,${b.data}` : null)

function contentText(content: ToolCallContent[] | null | undefined) {
  const out: string[] = []
  for (const c of content ?? []) {
    if (c.type === "content") out.push(blockText(c.content))
    else if (c.type === "diff") out.push(c.path)
  }
  return out.filter(Boolean).join("\n")
}

/** An MCP result (`{ result: { content, isError }, error }`), or whatever else the agent reported. */
function outputOf(u: ToolCallUpdate | ToolCall, failed: boolean): AgentToolOutput {
  const raw = (u.rawOutput ?? null) as { result?: { content?: ContentBlock[]; isError?: boolean } | null; error?: unknown } | string | null
  const texts: string[] = []
  const images: string[] = []
  let isError = false
  if (raw && typeof raw === "object" && raw.result && Array.isArray(raw.result.content)) {
    for (const b of raw.result.content) {
      const img = blockImage(b)
      if (img) images.push(img)
      else if (blockText(b)) texts.push(blockText(b))
    }
    isError = raw.result.isError === true
  }
  if (raw && typeof raw === "object" && raw.error) texts.push(typeof raw.error === "string" ? raw.error : ((raw.error as { message?: string }).message ?? JSON.stringify(raw.error)))
  if (!texts.length) {
    const t = contentText(u.content)
    if (t) texts.push(t)
    else if (typeof raw === "string") texts.push(raw)
    else if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>
      const s = [o.formatted_output, o.aggregated_output, o.stdout, o.output].find((x) => typeof x === "string" && x.trim())
      if (typeof s === "string") texts.push(s)
    }
  }
  for (const c of u.content ?? []) {
    const img = c.type === "content" ? blockImage(c.content) : null
    if (img && !images.includes(img)) images.push(img)
  }
  const text = texts.join("\n").trim()
  return { ok: !failed && !isError, text: text.length > TEXT_MAX ? `${text.slice(0, TEXT_MAX)}…` : text, ...(images.length ? { images } : {}) }
}

/** ACP's usage report (an unstable field: read whatever is there). */
export function turnUsage(response: unknown): TurnUsage | undefined {
  const r = (response ?? {}) as { usage?: Record<string, unknown> | null; _meta?: { quota?: { token_count?: Record<string, unknown> } } | null }
  const u = r.usage ?? r._meta?.quota?.token_count
  if (!u || typeof u !== "object") return undefined
  const n = (...keys: string[]) => {
    for (const k of keys) if (typeof u[k] === "number") return u[k] as number
    return 0
  }
  const cached = n("cachedReadTokens", "cachedInputTokens")
  return { input: n("inputTokens") + cached, cached, output: n("outputTokens"), reasoning: n("thoughtTokens", "reasoningOutputTokens") }
}

/**
 * The chunks of one prompt turn. Feed it every `session/update` of the session while the prompt
 * runs, then `finish` (or `fail`). Text and reasoning parts open and close as the agent switches
 * between them; a tool call closes whatever was open, as it does in the built-in assistant.
 */
export class AgentTurn {
  private open: { type: "text" | "reasoning"; id: string; source: string } | null = null
  private tools = new Map<string, { done: boolean }>()
  /** Calls the person was only asked about (an MCP elicitation): their card is the permission card. */
  private askedOnly = new Set<string>()
  private seq = 0
  /** The agent says it waits for an approval: has a card come, and is the notice up. */
  private wait: { timer: ReturnType<typeof setTimeout> | null; carded: boolean; notice: string | null } = { timer: null, carded: false, notice: null }

  private emit: (chunk: UIMessageChunk) => void
  private server: string

  constructor(emit: (chunk: UIMessageChunk) => void, server: string) {
    this.emit = emit
    this.server = server
    emit({ type: "start" })
  }

  private close() {
    if (!this.open) return
    this.emit({ type: this.open.type === "text" ? "text-end" : "reasoning-end", id: this.open.id })
    this.open = null
  }

  private delta(type: "text" | "reasoning", source: string, delta: string) {
    if (!delta) return
    if (!this.open || this.open.type !== type || this.open.source !== source) {
      this.close()
      this.open = { type, id: `${type[0]}${++this.seq}`, source }
      this.emit({ type: type === "text" ? "text-start" : "reasoning-start", id: this.open.id })
    }
    this.emit({ type: type === "text" ? "text-delta" : "reasoning-delta", id: this.open.id, delta })
  }

  private toolStart(call: ToolCall | ToolCallUpdate) {
    this.close()
    const own = ownCommand(call, this.server)
    const kind = call.kind ?? "other"
    const raw = (call.rawInput ?? null) as Raw | null
    const otherMcp = !own && raw && typeof raw.server === "string" && typeof raw.tool === "string"
    const toolName = own ? own.name : otherMcp ? "agent-mcp" : `agent-${kind}`
    const input = own ? own.input : { name: otherMcp ? `${raw!.server as string} · ${raw!.tool as string}` : (call.title ?? "") }
    this.tools.set(call.toolCallId, { done: false })
    this.emit({ type: "tool-input-available", toolCallId: call.toolCallId, toolName, input })
  }

  private toolEnd(u: ToolCall | ToolCallUpdate) {
    const t = this.tools.get(u.toolCallId)
    if (!t || t.done) return
    if (u.status !== "completed" && u.status !== "failed") return
    t.done = true
    this.emit({ type: "tool-output-available", toolCallId: u.toolCallId, output: outputOf(u, u.status === "failed") })
  }

  /** A permission request is about to be shown for this call (it may not have been announced). */
  asked(toolCallId: string) {
    if (!this.tools.has(toolCallId)) this.askedOnly.add(toolCallId)
    this.wait.carded = true
    this.close()
  }

  /** The agent waits for an approval (Codex reports it in `session_info_update`), or no longer does. */
  private waiting(on: boolean) {
    if (on) {
      if (this.wait.timer || this.wait.notice) return
      this.wait.carded = false
      this.wait.timer = setTimeout(() => {
        this.wait.timer = null
        if (this.wait.carded) return
        this.close()
        this.wait.notice = `notice-${++this.seq}`
        this.emit({ type: "data-notice", id: this.wait.notice, data: { kind: "approval-elsewhere", active: true } satisfies AgentNotice })
      }, APPROVAL_ELSEWHERE_MS)
      return
    }
    if (this.wait.timer) clearTimeout(this.wait.timer)
    this.wait.timer = null
    if (this.wait.notice) this.emit({ type: "data-notice", id: this.wait.notice, data: { kind: "approval-elsewhere", active: false } satisfies AgentNotice })
    this.wait.notice = null
  }

  update(u: SessionUpdate) {
    switch (u.sessionUpdate) {
      case "agent_message_chunk":
        return this.delta("text", u.messageId ?? "", blockText(u.content))
      case "agent_thought_chunk":
        return this.delta("reasoning", u.messageId ?? "", blockText(u.content))
      case "tool_call":
        if (!this.tools.has(u.toolCallId)) this.toolStart(u)
        return this.toolEnd(u)
      case "tool_call_update":
        if (!this.tools.has(u.toolCallId)) {
          if (this.askedOnly.has(u.toolCallId)) return
          // Never announced: show it once it has something to show.
          if (u.status !== "completed" && u.status !== "failed" && !u.title) return
          this.toolStart(u)
        }
        return this.toolEnd(u)
      case "session_info_update": {
        const status = (u._meta as { codex?: { threadStatus?: { type?: string; activeFlags?: unknown } } } | null | undefined)?.codex?.threadStatus
        if (!status) return
        return this.waiting(Array.isArray(status.activeFlags) && status.activeFlags.includes("waitingOnApproval"))
      }
      default:
        return
    }
  }

  /** The prompt ended (`end_turn`, `cancelled`, …): close what's open, settle unfinished cards. */
  finish(meta: { usage?: TurnUsage; agent: AgentMeta }) {
    this.waiting(false)
    this.close()
    this.settle()
    this.emit({ type: "finish", messageMetadata: meta.usage ? { usage: meta.usage, agent: meta.agent } : { agent: meta.agent } })
  }

  fail(errorText: string) {
    this.waiting(false)
    this.close()
    this.settle()
    this.emit({ type: "error", errorText })
  }

  /** Calls still running when the turn ended (stopped): marked so their spinners stop. */
  private settle() {
    for (const [id, t] of this.tools) {
      if (t.done) continue
      t.done = true
      this.emit({ type: "tool-output-available", toolCallId: id, output: { ok: false, text: "" } satisfies AgentToolOutput })
    }
  }
}
