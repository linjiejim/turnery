// Outside agents in the chat window, on the main-process side: finds the person's own agent
// program, starts its ACP adapter (dist/agents/) with Electron's Node, and runs a conversation's
// turns there. The agent signs in and keeps its credentials itself, as in a terminal: nothing
// here reads, stores or passes on a token (docs/specs/2026-11-24-turnery-local-agents.md).
import { execFile, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { Readable, Writable } from "node:stream"
import { webContents, type IpcMain, type IpcMainInvokeEvent, type WebContents } from "electron"
import { AGENTS, AgentClient, versionAtLeast, type AgentId, type AgentOption, type AgentProcess, type EarlierMessage } from "../../../app/src/desktop/core/agents"
import type { AgentMeta } from "../../../app/src/desktop/core/acp-stream"
import type { Engine } from "../../../app/src/desktop/core/engine"
import type { AgentInfo, AgentsState } from "../../../app/src/desktop/core/protocol"
import { HOME, PROJECTS_DIR } from "../engine/home"
import { tm } from "./lang"

declare const __TURNERY_VERSION__: string

// ------------------------------------------------------------------ settings

type Stored = { use?: "builtin" | AgentId; agents?: Partial<Record<AgentId, { path?: string; options?: Record<string, string> }>> }
const FILE = () => path.join(HOME, "agents.json")

function read(): Stored {
  try {
    const s = JSON.parse(readFileSync(FILE(), "utf8")) as Stored
    return s && typeof s === "object" ? s : {}
  } catch {
    return {}
  }
}
function write(s: Stored) {
  mkdirSync(HOME, { recursive: true })
  writeFileSync(FILE(), `${JSON.stringify(s, null, 2)}\n`)
}

/** Who answers in the chat window: the built-in assistant or an outside agent. */
export const agentInUse = (): AgentId | null => {
  const u = read().use
  return u && u !== "builtin" && u in AGENTS ? u : null
}
const savedOptions = (id: AgentId) => read().agents?.[id]?.options ?? {}

// ----------------------------------------------------------- finding the agent

/**
 * The login shell's PATH and where it finds the agent. An app opened from the Finder doesn't have
 * the PATH a terminal has (nvm, Homebrew), and an npm-installed `codex` needs `node` on it.
 */
let shell: Promise<{ PATH: string; found: Record<string, string | null> }> | null = null

function loginShell(bins: string[]) {
  shell ??= new Promise((resolve) => {
    const fallback = [process.env.PATH, "/opt/homebrew/bin", "/usr/local/bin", path.join(os.homedir(), ".local/bin"), "/usr/bin", "/bin"].filter(Boolean).join(":")
    const sh = process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : "/bin/zsh"
    const script = `printf '\\n__TURNERY__%s' "$PATH"; ${bins.map((b) => `printf '\\n__TURNERY_BIN__${b}=%s' "$(command -v ${b} 2>/dev/null)"`).join("; ")}; printf '\\n'`
    execFile(sh, ["-ilc", script], { timeout: 10_000, env: { ...process.env, TERM: "dumb" } }, (err, stdout) => {
      const PATH = /__TURNERY__(.*)/.exec(stdout ?? "")?.[1]?.trim() || fallback
      const found: Record<string, string | null> = {}
      for (const b of bins) found[b] = new RegExp(`__TURNERY_BIN__${b}=(.*)`).exec(stdout ?? "")?.[1]?.trim() || null
      if (err && !stdout) found.__error = String(err.message)
      resolve({ PATH, found })
    })
  })
  return shell
}

function versionOf(bin: string, PATH: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(bin, ["--version"], { timeout: 10_000, env: { ...process.env, PATH } }, (_err, stdout) => resolve(/(\d+\.\d+\.\d+)/.exec(stdout ?? "")?.[1] ?? null))
  })
}

type Located = { path: string | null; version: string | null; PATH: string }

async function locate(id: AgentId): Promise<Located> {
  const spec = AGENTS[id]
  const { PATH, found } = await loginShell(Object.values(AGENTS).map((a) => a.bin))
  const chosen = read().agents?.[id]?.path
  const bin = chosen && existsSync(chosen) ? chosen : found[spec.bin]
  if (!bin) return { path: null, version: null, PATH }
  // The agent's own folder first: its launcher may need the node it was installed with.
  const withDir = [path.dirname(bin), PATH].join(":")
  return { path: bin, version: await versionOf(bin, withDir), PATH: withDir }
}

// ------------------------------------------------------------------- adapters

const clients = new Map<AgentId, AgentClient>()
const located = new Map<AgentId, Located>()

function clientOf(id: AgentId, dist: string, log: (m: string) => void) {
  let c = clients.get(id)
  if (c) return c
  const spec = AGENTS[id]
  c = new AgentClient(
    spec,
    async () => {
      const where = located.get(id) ?? (await locate(id))
      if (!where.path) throw new Error(tm(`找不到 ${spec.name}：先安装（${spec.install}）`, `Can’t find ${spec.name}: install it first (${spec.install})`))
      const env: Record<string, string> = {}
      for (const [k, v] of Object.entries(process.env)) if (typeof v === "string") env[k] = v
      Object.assign(env, {
        PATH: where.PATH,
        // Electron's own binary runs the adapter as Node; agents/launch.mjs takes this out again
        // before the adapter starts anything, so the agent's commands don't inherit it.
        ELECTRON_RUN_AS_NODE: "1",
        CODEX_PATH: where.path,
        CODEX_CONFIG: JSON.stringify(codexConfig(dist)),
        // Turnery never starts a sign-in: the person signs in with `codex login` (spec D4).
        NO_BROWSER: "1",
      })
      const child = spawn(process.execPath, [path.join(dist, "agents/launch.mjs"), spec.adapter], { env, stdio: ["pipe", "pipe", "pipe"] })
      const tail: string[] = []
      child.stderr.setEncoding("utf8").on("data", (d: string) => {
        tail.push(...d.split("\n").filter(Boolean))
        if (tail.length > 20) tail.splice(0, tail.length - 20)
      })
      await new Promise<void>((resolve, reject) => {
        child.once("spawn", resolve)
        child.once("error", reject)
      })
      const proc: AgentProcess = {
        input: Writable.toWeb(child.stdin) as WritableStream<Uint8Array>,
        output: Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>,
        exited: new Promise((resolve) => child.once("exit", (code, signal) => resolve(String(signal ?? code)))),
        stderr: () => tail.slice(-3).join(" "),
        kill: () => void child.kill(),
      }
      return proc
    },
    { version: __TURNERY_VERSION__, log },
  )
  clients.set(id, c)
  return c
}

/**
 * Turnery's MCP server for Codex, as Codex config: its modeling commands need no approval (they
 * only change the part files in the project, like the built-in assistant's). Given here rather
 * than as an ACP `mcpServers` entry, which would lose the approval setting (spec D5).
 */
function codexConfig(dist: string) {
  const env: Record<string, string> = { ELECTRON_RUN_AS_NODE: "1", TURNERY_HOME: HOME }
  if (process.env.TURNERY_LANG) env.TURNERY_LANG = process.env.TURNERY_LANG
  return {
    mcp_servers: {
      turnery: { command: process.execPath, args: [path.join(dist, "cli.mjs"), "mcp"], env, default_tools_approval_mode: "approve", startup_timeout_sec: 30, tool_timeout_sec: 900 },
    },
  }
}

async function info(id: AgentId, dist: string, log: (m: string) => void, recheck: boolean, deep: boolean): Promise<AgentInfo> {
  const spec = AGENTS[id]
  if (recheck) {
    shell = null
    located.delete(id)
    clients.get(id)?.dispose()
    clients.delete(id)
  }
  const where = located.get(id) ?? (await locate(id))
  located.set(id, where)
  const base: AgentInfo = { id, name: spec.name, path: where.path, version: where.version, minVersion: spec.minVersion, install: spec.install, login: spec.login, problem: null, account: null, signedIn: null, detail: null, checked: false }
  if (!where.path) return { ...base, problem: "missing", checked: true }
  if (!where.version || !versionAtLeast(where.version, spec.minVersion)) return { ...base, problem: "old", checked: true }
  if (!deep && !recheck) return base
  try {
    const s = await clientOf(id, dist, log).status()
    if (s.signedIn === false) return { ...base, problem: "signed-out", checked: true }
    return { ...base, account: s.account, signedIn: s.signedIn, checked: true }
  } catch (e) {
    return { ...base, problem: "failed", detail: (e as Error).message.slice(0, 300), checked: true }
  }
}

// ---------------------------------------------------------------------- turns

/** The window's chat messages (AI SDK UIMessages), as far as this file reads them. */
type UIMessage = { role: string; parts: { type: string; text?: string }[]; metadata?: unknown }

/** Plain text of a message's text parts. */
const textOf = (m: UIMessage) =>
  m.parts
    .map((p) => (p.type === "text" ? (p.text ?? "") : ""))
    .join("")
    .trim()

/** The conversation before this message, with the session of this agent that answered each part. */
function earlierOf(messages: UIMessage[], id: AgentId): EarlierMessage[] {
  return messages.slice(0, -1).flatMap((m): EarlierMessage[] => {
    if (m.role !== "user" && m.role !== "assistant") return []
    const a = (m.metadata as { agent?: AgentMeta } | undefined)?.agent
    return [{ role: m.role, text: textOf(m), ...(a?.id === id ? { session: a.session } : {}) }]
  })
}

/** Where the window is, as a line in front of what the person says. */
function contextLine(engine: Engine, lang: "zh" | "en") {
  const snap = engine.snapshot()
  const root = snap.project?.root ?? null
  const part = snap.active ? (root && snap.active.startsWith(`${root}${path.sep}`) ? path.relative(root, snap.active) : snap.active) : null
  if (lang === "en") return `(Turnery: ${part ? `the window shows ${part}` : "no part is open"}${root ? `, in the project folder ${root}` : ""}.)`
  return `（Turnery：${part ? `窗口里打开的是 ${part}` : "窗口里还没打开零件"}${root ? `，项目文件夹 ${root}` : ""}。）`
}

/** The folder the agent works in: the project, else the open part's folder, else Turnery's projects folder. */
function cwdOf(engine: Engine) {
  const snap = engine.snapshot()
  if (snap.project?.root) return snap.project.root
  if (snap.active) return path.dirname(snap.active)
  mkdirSync(PROJECTS_DIR, { recursive: true })
  return PROJECTS_DIR
}

/** The session the conversation had with this agent (kept in its answers' metadata). */
function lastSession(messages: UIMessage[], id: AgentId) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const a = (messages[i].metadata as { agent?: AgentMeta } | undefined)?.agent
    if (a?.id === id) return a.session
  }
  return undefined
}

export type AgentRunner = {
  /** An outside agent is chosen for the chat window. */
  active(): boolean
  /** The chat window's turn goes to an outside agent (when one is chosen): true when it took it. */
  turn(e: IpcMainInvokeEvent, run: { id: string; chat: string; messages: UIMessage[]; lang: "zh" | "en"; send: (chunk: unknown) => void; signal: AbortSignal }): Promise<boolean>
  dispose(): void
}

/** Wire the outside agents' channels. `engineOf` gives the engine of the window that asks. */
export function wireAgents(ipcMain: IpcMain, engineOf: (e: IpcMainInvokeEvent) => Engine, dist: string): AgentRunner {
  const log = (m: string) => process.stderr.write(`[turnery agents] ${m}\n`)
  /** Conversations with a session, by window: let go when the window goes. */
  const chatsOf = new Map<WebContents, Set<string>>()
  /**
   * A conversation's session belongs to the window it runs in: the same saved conversation opened
   * in two windows doesn't share one.
   */
  const keyOf = (e: IpcMainInvokeEvent, chat: unknown) => `${e.sender.id}:${String(chat)}`

  const state = async (check?: "status" | "recheck"): Promise<AgentsState> => {
    const use = agentInUse()
    return {
      use: use ?? "builtin",
      agents: await Promise.all((Object.keys(AGENTS) as AgentId[]).map((id) => info(id, dist, log, check === "recheck", check === "status" || id === use))),
    }
  }

  ipcMain.handle("turnery:agents", (_e, check?: unknown) => state(check === "recheck" || check === "status" ? check : undefined))
  ipcMain.handle("turnery:agents-save", async (_e, input: { use?: string; agent?: string; path?: string | null }) => {
    const s = read()
    if (typeof input.use === "string") s.use = input.use in AGENTS ? (input.use as AgentId) : "builtin"
    if (typeof input.agent === "string" && input.agent in AGENTS && input.path !== undefined) {
      const id = input.agent as AgentId
      const path = input.path?.trim() || undefined
      if (path !== s.agents?.[id]?.path) {
        // Another program: the running one (started with the old path) goes.
        clients.get(id)?.dispose()
        clients.delete(id)
        located.delete(id)
      }
      s.agents = { ...s.agents, [id]: { ...s.agents?.[id], path } }
    }
    write(s)
    const now = await state()
    // Every window's chat follows: a send goes to whoever answers now, and the window must show that.
    for (const wc of webContents.getAllWebContents()) if (!wc.isDestroyed()) wc.send("turnery:agents-changed", now)
    return now
  })
  ipcMain.handle("turnery:agent-options", (e, chat: string): AgentOption[] => {
    const id = agentInUse()
    if (!id) return []
    return clientOf(id, dist, log).options(keyOf(e, chat), savedOptions(id))
  })
  ipcMain.handle("turnery:agent-option", async (e, chat: string, option: string, value: string) => {
    const id = agentInUse()
    if (!id) return []
    const s = read()
    const a = { ...s.agents?.[id] }
    a.options = { ...a.options, [String(option)]: String(value) }
    s.agents = { ...s.agents, [id]: a }
    write(s)
    const c = clientOf(id, dist, log)
    await c.setOption(keyOf(e, chat), String(option), String(value))
    return c.options(keyOf(e, chat), savedOptions(id))
  })
  ipcMain.handle("turnery:agent-permission", (_e, perm: string, optionId: string | null) => {
    for (const c of clients.values()) if (c.answer(String(perm), optionId === null ? null : String(optionId))) return true
    return false
  })

  return {
    active: () => agentInUse() !== null,
    async turn(e, run) {
      const id = agentInUse()
      if (!id) return false
      const engine = engineOf(e)
      const c = clientOf(id, dist, log)
      const wc = e.sender
      const chat = keyOf(e, run.chat)
      if (!chatsOf.has(wc)) {
        chatsOf.set(wc, new Set())
        wc.once("destroyed", () => {
          for (const chat of chatsOf.get(wc) ?? []) c.closeChat(chat)
          chatsOf.delete(wc)
        })
      }
      chatsOf.get(wc)!.add(chat)
      const last = run.messages.at(-1)
      const said = last && last.role === "user" ? textOf(last) : ""
      if (!said) {
        run.send({ type: "error", errorText: tm("没有收到要说的话。", "Nothing to send.") })
        return true
      }
      await c.turn({
        chat,
        cwd: cwdOf(engine),
        text: `${contextLine(engine, run.lang)}\n\n${said}`,
        earlier: earlierOf(run.messages, id),
        lang: run.lang,
        resume: lastSession(run.messages, id),
        defaults: savedOptions(id),
        emit: run.send,
        card: (permId, card) => run.send({ type: "data-permission", id: permId, data: card }),
        signal: run.signal,
      })
      return true
    },
    dispose() {
      for (const c of clients.values()) c.dispose()
      clients.clear()
    },
  }
}
