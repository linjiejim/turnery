// Outside coding agents in the chat window, spoken to over ACP (agentclientprotocol.com).
//
// The person's own agent, as they installed and signed in to it: Turnery starts its ACP adapter,
// hands it Turnery's MCP server and shows the turn in the chat window. Turnery never signs anyone
// in and never reads, stores or forwards an agent's credentials: the agent does that itself, as it
// does in a terminal (docs/specs/2026-11-24-turnery-local-agents.md, "合规边界").
//
// One adapter process for the app, one ACP session per conversation. Nothing here imports Electron.
import { client, methods, ndJsonStream, PROTOCOL_VERSION, type ClientConnection, type InitializeResponse, type NewSessionRequest, type RequestPermissionRequest, type RequestPermissionResponse, type SessionConfigOption, type SessionNotification } from "@agentclientprotocol/sdk"
import type { UIMessageChunk } from "ai"
import { AgentTurn, turnUsage, type PermissionCard } from "./acp-stream"
import type { AgentOption } from "./protocol"

export type AgentId = "codex"

export type AgentSpec = {
  id: AgentId
  name: string
  /** The program the person installs and signs in to. */
  bin: string
  /** Oldest version the bundled adapter works with. */
  minVersion: string
  install: string
  login: string
  /** The adapter's file in dist/agents/. */
  adapter: string
  /** Config options the chat window offers, in order. */
  options: string[]
  /** `mode` values the window offers (Codex's "full access" is left out on purpose). */
  modes: string[]
  defaults: Record<string, string>
}

export const AGENTS: Record<AgentId, AgentSpec> = {
  codex: {
    id: "codex",
    name: "Codex",
    bin: "codex",
    minVersion: "0.171.0",
    install: "npm install -g @openai/codex",
    login: "codex login",
    adapter: "codex-acp.mjs",
    options: ["model", "reasoning_effort", "mode"],
    modes: ["read-only", "workspace-write", "agent"],
    defaults: { mode: "read-only" },
  },
}

/** The MCP server name Turnery's commands go under (and how the agent reports their calls). */
export const MCP_NAME = "turnery"

/** Appended to the agent's own instructions for every session started from the chat window. */
export const AGENT_SYSTEM = [
  "You are talking to the person inside the Turnery app's chat window. Turnery is a parametric CAD workbench; the window next to this chat shows every step you take, live.",
  "Build and change parts with the tools of the `turnery` MCP server (call its `guide` tool first if you haven't read it). Paths are relative to the project folder you were started in.",
  "Don't operate the Turnery window yourself (no computer use, no AppleScript, no opening files with shell commands): the person already sees what the turnery tools do, and `look` gives you the rendered views.",
  "Reply in the person's language.",
].join("\n")

/** `0.171.0` ≥ `0.170.2`? Numeric parts only. */
export function versionAtLeast(version: string, min: string) {
  const a = version.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0)
  const b = min.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0)
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  return true
}

/**
 * The adapter's process, started by the caller (it knows where Node, the adapter file and the
 * agent are, and how to spawn): its stdio as web streams, and how it ends.
 */
export type AgentProcess = {
  input: WritableStream<Uint8Array>
  output: ReadableStream<Uint8Array>
  /** Resolves with how it exited (code or signal). */
  exited: Promise<string>
  /** Its last lines on stderr, for an error message. */
  stderr(): string
  kill(): void
}

export type { AgentOption }

export function pickOptions(spec: AgentSpec, options: SessionConfigOption[] | null | undefined, defaults: Record<string, string>): AgentOption[] {
  const out: AgentOption[] = []
  for (const id of spec.options) {
    const o = options?.find((x) => x.id === id)
    if (!o || o.type !== "select") continue
    const flat = (o.options as unknown[]).flatMap((x) => ((x as { options?: unknown[] }).options ? ((x as { options: unknown[] }).options as never[]) : [x as never])) as { value: string; name: string; description?: string | null }[]
    const choices = flat.filter((c) => id !== "mode" || spec.modes.includes(c.value)).map((c) => ({ value: c.value, name: c.name, ...(c.description ? { description: c.description } : {}) }))
    const value = defaults[id] && choices.some((c) => c.value === defaults[id]) ? defaults[id] : String(o.currentValue)
    out.push({ id, name: o.name, value, choices })
  }
  return out
}

type Pending = { card: PermissionCard; resolve: (r: RequestPermissionResponse) => void; turn: AgentTurn }

type Session = {
  id: string
  cwd: string
  options: SessionConfigOption[]
  /** The turn running now, if any: where this session's updates and permission cards go. */
  turn: AgentTurn | null
  card: TurnInput["card"] | null
}

/** A message of the conversation before this turn; `session`: the agent session that answered it. */
export type EarlierMessage = { role: "user" | "assistant"; text: string; session?: string }

export type TurnInput = {
  /** The conversation, as the caller keeps them apart (one window's copy of it). */
  chat: string
  cwd: string
  /** What the person said, as the agent should get it (context line included). */
  text: string
  /**
   * The conversation so far. What came after the last answer from the session in use (all of it for
   * a new session; the built-in assistant's turns in between) goes in front of `text`.
   */
  earlier: EarlierMessage[]
  lang: "zh" | "en"
  /** The session this conversation had, to resume. */
  resume?: string
  defaults: Record<string, string>
  emit: (chunk: UIMessageChunk) => void
  /** Shows a permission card (a `data-permission` part) or updates it once answered. */
  card: (id: string, card: PermissionCard) => void
  signal: AbortSignal
}

type Conn = { proc: AgentProcess; connection: ClientConnection; init: InitializeResponse }

export type AgentStatus = { account: string | null; signedIn: boolean | null; version: string | null }

/** What the session hasn't seen of the conversation, as text in front of what the person says now. */
export function unseenHistory(earlier: EarlierMessage[], session: string, lang: "zh" | "en") {
  let last = -1
  for (let i = earlier.length - 1; i >= 0; i--)
    if (earlier[i].session === session) {
      last = i
      break
    }
  const lines = earlier
    .slice(last + 1)
    .filter((m) => m.text.trim())
    .slice(-16)
    .map((m) => `${m.role === "user" ? (lang === "en" ? "Person" : "用户") : lang === "en" ? "Assistant" : "助手"}：${m.text.trim().slice(0, 1500)}`)
  if (!lines.length) return ""
  return lang === "en" ? `Earlier in this conversation, which you haven't seen (Turnery's record):\n${lines.join("\n")}\n\nNow:\n` : `这段对话里你还没看到的部分（Turnery 的记录）：\n${lines.join("\n")}\n\n现在：\n`
}

/** The plain-language reason a request failed. */
function reason(e: unknown) {
  const err = e as { message?: string; code?: number; data?: unknown }
  const data = err?.data && typeof err.data === "object" ? JSON.stringify(err.data) : ""
  return `${err?.message ?? String(e)}${data && data !== "{}" ? ` ${data.slice(0, 200)}` : ""}`
}
const authProblem = (e: unknown) => {
  const err = e as { code?: number; message?: string }
  return err?.code === -32000 || /auth|log ?in|sign ?in|unauthori[sz]ed/i.test(err?.message ?? "")
}

/** An outside agent behind its ACP adapter: started when first needed, again after it exits. */
export class AgentClient {
  private conn: Promise<Conn> | null = null
  private sessions = new Map<string, Session>()
  private pending = new Map<string, Pending>()
  /** Each conversation's turn in progress: the next one waits for it (a stopped turn may still be finishing). */
  private runs = new Map<string, Promise<void>>()
  private permSeq = 0
  private account: string | null = null
  private signedIn: boolean | null = null
  /** The options the last session offered: what the window shows before a conversation has one. */
  lastOptions: SessionConfigOption[] | null = null

  readonly spec: AgentSpec
  private launch: () => Promise<AgentProcess>
  private opts: { version: string; log?: (msg: string) => void }

  constructor(spec: AgentSpec, launch: () => Promise<AgentProcess>, opts: { version: string; log?: (msg: string) => void }) {
    this.spec = spec
    this.launch = launch
    this.opts = opts
  }

  private log(msg: string) {
    this.opts.log?.(msg)
  }

  private connect(): Promise<Conn> {
    this.conn ??= this.start().catch((e) => {
      this.conn = null
      throw e
    })
    return this.conn
  }

  private async start(): Promise<Conn> {
    const proc = await this.launch()
    const app = client({ name: "turnery" })
      .onNotification(methods.client.session.update, ({ params }) => this.onUpdate(params))
      .onRequest(methods.client.session.requestPermission, ({ params, signal }) => this.onPermission(params, signal))
      .onNotification("*", ({ method, params }) => this.onOther(method, params))
    const connection = app.connect(ndJsonStream(proc.input, proc.output))
    const conn: Conn = { proc, connection, init: null as never }
    void proc.exited.then((how) => {
      this.log(`${this.spec.name} adapter exited (${how})`)
      this.conn = null
      connection.close(new Error(this.died(conn)))
      this.sessions.clear()
      for (const p of [...this.pending.values()]) p.resolve({ outcome: { outcome: "cancelled" } })
    })
    try {
      conn.init = await connection.agent.request(methods.agent.initialize, {
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false },
        clientInfo: { name: "turnery", title: "Turnery", version: this.opts.version },
      })
    } catch (e) {
      proc.kill()
      throw e
    }
    return conn
  }

  private died(conn: Conn) {
    const tail = conn.proc.stderr().slice(0, 300)
    return `${this.spec.name} 意外退出了${tail ? `：${tail}` : ""}`
  }

  private onOther(method: string, params: unknown) {
    if (method === "auth/status_update") this.authReport(params)
  }

  /**
   * Who is signed in, as the agent reports it (`auth/status` or its update): the plan's label only,
   * never the email. "unknown" (not read yet) changes nothing.
   */
  private authReport(params: unknown) {
    const p = (params ?? {}) as { state?: string; accounts?: { label?: string; active?: boolean }[] }
    if (p.state === "authenticated") {
      this.signedIn = true
      const active = p.accounts?.find((a) => a.active) ?? p.accounts?.[0]
      this.account = active?.label ?? null
    } else if (p.state === "not_required") {
      this.signedIn = true
      this.account = null
    } else if (p.state === "unauthenticated") {
      this.signedIn = false
      this.account = null
    }
  }

  private onUpdate(n: SessionNotification) {
    for (const s of this.sessions.values()) if (s.id === n.sessionId) {
      if (n.update.sessionUpdate === "config_option_update") {
        s.options = n.update.configOptions
        this.lastOptions = n.update.configOptions
      }
      s.turn?.update(n.update)
    }
  }

  private onPermission(req: RequestPermissionRequest, signal: AbortSignal): Promise<RequestPermissionResponse> {
    const session = [...this.sessions.values()].find((s) => s.id === req.sessionId)
    const turn = session?.turn
    const show = session?.card
    if (!turn || !show) return Promise.resolve({ outcome: { outcome: "cancelled" } })
    turn.asked(req.toolCall.toolCallId)
    const id = `perm-${++this.permSeq}`
    const content = (req.toolCall.content ?? []).map((c) => (c.type === "content" && c.content.type === "text" ? c.content.text : c.type === "diff" ? c.path : "")).filter(Boolean)
    const raw = (req.toolCall.rawInput ?? null) as { server?: string; tool?: string; command?: unknown; description?: string } | null
    const detail = content.join("\n") || (raw?.server && raw.tool ? `${raw.server} · ${raw.tool}` : typeof raw?.command === "string" ? raw.command : Array.isArray(raw?.command) ? raw.command.join(" ") : (raw?.description ?? ""))
    // Choices that last beyond this conversation ("always allow", "block this host from now on", "don't
    // ask again for commands starting with …") would be written into the person's own agent config:
    // not Turnery's to offer. What lasts for this session stays.
    const options = req.options.filter((o) => (o.kind !== "allow_always" && o.kind !== "reject_always") || /session/i.test(o.optionId)).map((o) => ({ id: o.optionId, label: o.name, kind: o.kind }))
    const card: PermissionCard = { title: req.toolCall.title ?? "", kind: req.toolCall.kind ?? null, detail: detail.slice(0, 1200), options }
    return new Promise((resolve) => {
      const done = (r: RequestPermissionResponse, answer: string) => {
        if (!this.pending.delete(id)) return
        show(id, { ...card, answer })
        resolve(r)
      }
      this.pending.set(id, { card, turn, resolve: (r) => done(r, r.outcome.outcome === "selected" ? r.outcome.optionId : "cancelled") })
      signal.addEventListener("abort", () => done({ outcome: { outcome: "cancelled" } }, "cancelled"))
      show(id, card)
    })
  }

  /** Every question still open in this turn gets "cancelled". */
  private cancelQuestions(turn: AgentTurn) {
    for (const p of [...this.pending.values()]) if (p.turn === turn) p.resolve({ outcome: { outcome: "cancelled" } })
  }

  /** The person answered a permission card. */
  answer(id: string, optionId: string | null) {
    const p = this.pending.get(id)
    if (!p) return false
    p.resolve(optionId && p.card.options.some((o) => o.id === optionId) ? { outcome: { outcome: "selected", optionId } } : { outcome: { outcome: "cancelled" } })
    return true
  }

  /**
   * Starts the adapter if needed and says who is signed in. The agent reads its login after it
   * starts (about two seconds for Codex): ask until it knows, for up to ten seconds. Still not
   * known then: `signedIn` stays null, which the window doesn't take for signed in.
   */
  async status(): Promise<AgentStatus> {
    const conn = await this.connect()
    const until = Date.now() + 10_000
    while (this.signedIn === null && Date.now() < until) {
      try {
        this.authReport(await conn.connection.agent.request<unknown>("auth/status", {}))
      } catch {
        break
      }
      if (this.signedIn === null) await new Promise((r) => setTimeout(r, 400))
    }
    return { account: this.account, signedIn: this.signedIn, version: conn.init.agentInfo?.version ?? null }
  }

  private async session(input: TurnInput, conn: Conn): Promise<Session> {
    const have = this.sessions.get(input.chat)
    if (have && have.cwd === input.cwd) return have
    if (have) this.closeChat(input.chat)
    const caps = conn.init.agentCapabilities?.sessionCapabilities
    const systemPrompt = caps?.systemPrompt ? { mode: "append" as const, content: [{ type: "text" as const, text: AGENT_SYSTEM }] } : undefined
    let id: string | null = null
    let options: SessionConfigOption[] = []
    // The same saved conversation open in two windows: only one of them carries its session on.
    const live = [...this.sessions.values()].some((x) => x.id === input.resume)
    if (input.resume && caps?.resume && !live) {
      try {
        const res = (await conn.connection.agent.request(methods.agent.session.resume, { sessionId: input.resume, cwd: input.cwd, mcpServers: [], ...(systemPrompt ? { systemPrompt } : {}) })) as { configOptions?: SessionConfigOption[] | null } | null
        id = input.resume
        options = res?.configOptions ?? []
      } catch (e) {
        this.log(`resume ${input.resume} failed: ${reason(e)}`)
      }
    }
    if (!id) {
      const params: NewSessionRequest = { cwd: input.cwd, mcpServers: [], ...(systemPrompt ? { systemPrompt } : {}) }
      const res = await conn.connection.agent.request(methods.agent.session.new, params)
      id = res.sessionId
      options = res.configOptions ?? []
    }
    const session: Session = { id: id as string, cwd: input.cwd, options, turn: null, card: null }
    this.sessions.set(input.chat, session)
    this.lastOptions = options
    // The person's choices, model first: the other options may depend on it.
    for (const o of pickOptions(this.spec, options, { ...this.spec.defaults, ...input.defaults })) {
      const now = options.find((x) => x.id === o.id)
      if (now && String(now.currentValue) !== o.value) await this.applyOption(conn, session, o.id, o.value)
    }
    return session
  }

  private async applyOption(conn: Conn, session: Session, id: string, value: string) {
    try {
      const res = await conn.connection.agent.request(methods.agent.session.setConfigOption, { sessionId: session.id, configId: id, value })
      session.options = res.configOptions
      this.lastOptions = res.configOptions
    } catch (e) {
      this.log(`set ${id}=${value} failed: ${reason(e)}`)
    }
  }

  /** The options for this conversation: its session's, or the last ones seen with the defaults. */
  options(chat: string, defaults: Record<string, string>): AgentOption[] {
    const s = this.sessions.get(chat)
    return pickOptions(this.spec, s?.options ?? this.lastOptions, s ? {} : { ...this.spec.defaults, ...defaults })
  }

  /** Change an option of this conversation's session (when it has one). */
  async setOption(chat: string, id: string, value: string) {
    const s = this.sessions.get(chat)
    if (!s || !this.conn) return
    await this.applyOption(await this.conn, s, id, value)
  }

  /**
   * One prompt turn. Resolves when it ends; everything it shows goes through `emit` and `card`.
   * A conversation's turns run one after the other: after Stop, the stopped prompt may still be
   * finishing when the next message comes.
   */
  async turn(input: TurnInput): Promise<void> {
    const before = this.runs.get(input.chat)
    const run = (async () => {
      if (before) await before.catch(() => {})
      await this.runTurn(input)
    })()
    this.runs.set(input.chat, run)
    try {
      await run
    } finally {
      if (this.runs.get(input.chat) === run) this.runs.delete(input.chat)
    }
  }

  private async runTurn(input: TurnInput): Promise<void> {
    let turn: AgentTurn | null = null
    let session: Session | null = null
    try {
      if (input.signal.aborted) return
      const conn = await this.connect()
      session = await this.session(input, conn)
      if (input.signal.aborted) return
      const current = new AgentTurn(input.emit, MCP_NAME)
      turn = current
      session.turn = current
      session.card = input.card
      const sessionId = session.id
      // ACP: with `session/cancel`, every question still open gets "cancelled" (the agent waits for them).
      const cancel = () => {
        void conn.connection.agent.notify(methods.agent.session.cancel, { sessionId }).catch(() => {})
        this.cancelQuestions(current)
      }
      input.signal.addEventListener("abort", cancel)
      const text = `${unseenHistory(input.earlier, sessionId, input.lang)}${input.text}`
      try {
        const res = await conn.connection.agent.request(methods.agent.session.prompt, { sessionId, prompt: [{ type: "text", text }] })
        current.finish({ usage: turnUsage(res), agent: { id: this.spec.id, session: sessionId } })
      } finally {
        input.signal.removeEventListener("abort", cancel)
      }
    } catch (e) {
      const msg = authProblem(e) ? `${this.spec.name} 还没登录：在终端运行 ${this.spec.login}，然后再试。` : `${this.spec.name} 出错了：${reason(e).slice(0, 400)}`
      if (turn) turn.fail(msg)
      else {
        input.emit({ type: "start" })
        input.emit({ type: "error", errorText: msg })
      }
    } finally {
      if (turn) this.cancelQuestions(turn)
      if (session && session.turn === turn) {
        session.turn = null
        session.card = null
      }
    }
  }

  /** The conversation is gone (or moved to another folder): let its session go. */
  closeChat(chat: string) {
    const s = this.sessions.get(chat)
    if (!s) return
    this.sessions.delete(chat)
    void this.conn
      ?.then((c) => (c.init.agentCapabilities?.sessionCapabilities?.close ? c.connection.agent.request(methods.agent.session.close, { sessionId: s.id }) : null))
      .catch(() => {})
  }

  dispose() {
    const c = this.conn
    this.conn = null
    void c
      ?.then((x) => {
        x.connection.close()
        x.proc.kill()
      })
      .catch(() => {})
  }
}
