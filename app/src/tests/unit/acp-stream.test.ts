// An outside agent's turn (ACP session updates) as the chat window's UI message stream. The update
// shapes are the ones codex-acp 2.10 sent in a real run (2026-11-24).
import { describe, expect, it, vi } from "vitest"
import { readUIMessageStream, type UIMessage, type UIMessageChunk } from "ai"
import { agent, methods, ndJsonStream, type SessionUpdate } from "@agentclientprotocol/sdk"
import { AgentTurn, APPROVAL_ELSEWHERE_MS, ownCommand, turnUsage, type PermissionCard } from "@/desktop/core/acp-stream"
import { AGENTS, AgentClient, pickOptions, unseenHistory, versionAtLeast, type AgentProcess } from "@/desktop/core/agents"

const S = "turnery"

function run(feed: (turn: AgentTurn) => void) {
  const chunks: UIMessageChunk[] = []
  const turn = new AgentTurn((c) => chunks.push(c), S)
  feed(turn)
  return chunks
}

/** What useChat makes of the chunks: the last state of the answer. */
async function message(chunks: UIMessageChunk[]): Promise<UIMessage> {
  const stream = new ReadableStream<UIMessageChunk>({
    start(c) {
      for (const x of chunks) c.enqueue(x)
      c.close()
    },
  })
  let last: UIMessage | undefined
  for await (const m of readUIMessageStream({ stream })) last = m
  return last!
}

const say = (text: string, messageId = "msg_1"): SessionUpdate => ({ sessionUpdate: "agent_message_chunk", messageId, content: { type: "text", text } })
const think = (text: string, messageId = "rs_1"): SessionUpdate => ({ sessionUpdate: "agent_thought_chunk", messageId, content: { type: "text", text } })
const mcpCall = (id: string, tool: string, args: unknown, server = S): SessionUpdate => ({
  sessionUpdate: "tool_call",
  toolCallId: id,
  kind: "execute",
  title: `mcp.${server}.${tool}`,
  status: "in_progress",
  rawInput: { server, tool, arguments: args },
  _meta: { is_mcp_tool_call: true },
})
const mcpDone = (id: string, content: unknown[], status: "completed" | "failed" = "completed"): SessionUpdate => ({
  sessionUpdate: "tool_call_update",
  toolCallId: id,
  status,
  rawOutput: { result: { content, structuredContent: null, _meta: null }, error: null },
})

describe("agent turns in the chat window", () => {
  it("Turnery's own commands become the usual tool cards, text and reasoning stream around them", async () => {
    const chunks = run((t) => {
      t.update(say("我会用 Turnery "))
      t.update(say("新建零件。"))
      t.update(mcpCall("exec-1", "extrude", { id: "cube", name: "立方体拉伸", sketch: "square", distance: "side" }))
      t.update(mcpDone("exec-1", [{ type: "text", text: "✓ 立方体拉伸（cube）：加料 20 mm。\n实体：20 × 20 × 20 mm" }]))
      t.update(think("**Checking**"))
      t.update(say("做好了。", "msg_2"))
      t.finish({ usage: { input: 52640, cached: 41344, output: 96, reasoning: 0 }, agent: { id: "codex", session: "s1" } })
    })
    const m = await message(chunks)
    expect(m.parts.map((p) => p.type)).toEqual(["text", "tool-extrude", "reasoning", "text"])
    expect(m.parts[0]).toMatchObject({ type: "text", text: "我会用 Turnery 新建零件。", state: "done" })
    expect(m.parts[1]).toMatchObject({ state: "output-available", input: { name: "立方体拉伸" }, output: { ok: true, text: expect.stringContaining("20 × 20 × 20") } })
    expect(m.metadata).toEqual({ usage: { input: 52640, cached: 41344, output: 96, reasoning: 0 }, agent: { id: "codex", session: "s1" } })
  })

  it("look's pictures come through; a failed command shows as failed", async () => {
    const m = await message(
      run((t) => {
        t.update(mcpCall("exec-2", "look", { views: ["iso"] }))
        t.update(mcpDone("exec-2", [{ type: "text", text: "等轴测" }, { type: "image", data: "AAAA", mimeType: "image/png" }]))
        t.update(mcpCall("exec-3", "look", { views: ["iso"] }))
        t.update(mcpDone("exec-3", [{ type: "text", text: "✗ 看图要在 Turnery 窗口里渲染" }], "failed"))
        t.finish({ agent: { id: "codex", session: "s1" } })
      }),
    )
    expect(m.parts[0]).toMatchObject({ type: "tool-look", output: { ok: true, images: ["data:image/png;base64,AAAA"] } })
    expect(m.parts[1]).toMatchObject({ type: "tool-look", output: { ok: false } })
  })

  it("the agent's other tools get a card of their kind", async () => {
    const m = await message(
      run((t) => {
        t.update(mcpCall("c1", "js", { code: "1" }, "cua_repl"))
        t.update({ sessionUpdate: "tool_call", toolCallId: "c2", kind: "execute", title: "ls -la", status: "in_progress", rawInput: { command: ["ls", "-la"] } })
        t.update({ sessionUpdate: "tool_call_update", toolCallId: "c2", status: "completed", rawOutput: { formatted_output: "total 0" } })
        t.finish({ agent: { id: "codex", session: "s1" } })
      }),
    )
    expect(m.parts[0]).toMatchObject({ type: "tool-agent-mcp", input: { name: "cua_repl · js" } })
    expect(m.parts[1]).toMatchObject({ type: "tool-agent-execute", input: { name: "ls -la" }, output: { ok: true, text: "total 0" } })
  })

  it("a call only asked about (an MCP elicitation) gets no card of its own; unfinished calls stop spinning", async () => {
    const m = await message(
      run((t) => {
        t.asked("elicitation:s1:cua_repl:1")
        t.update({ sessionUpdate: "tool_call_update", toolCallId: "elicitation:s1:cua_repl:1", status: "completed", rawOutput: { action: "accept" } })
        t.update(mcpCall("exec-9", "request_pick", { prompt: "点一下" }))
        t.finish({ agent: { id: "codex", session: "s1" } })
      }),
    )
    expect(m.parts.map((p) => p.type)).toEqual(["tool-request_pick"])
    expect(m.parts[0]).toMatchObject({ state: "output-available", output: { ok: false } })
  })

  it("a failed turn ends with its error", () => {
    const chunks = run((t) => {
      t.update(say("开始"))
      t.fail("Codex 还没登录")
    })
    expect(chunks.at(-1)).toEqual({ type: "error", errorText: "Codex 还没登录" })
    expect(chunks.map((c) => c.type)).toEqual(["start", "text-start", "text-delta", "text-end", "error"])
  })

  it("reads the call's command from rawInput or the title", () => {
    expect(ownCommand({ title: "mcp.turnery.open_part", rawInput: { server: "turnery", tool: "open_part", arguments: { path: "a" } } }, S)).toEqual({ name: "open_part", input: { path: "a" } })
    expect(ownCommand({ title: "mcp.turnery.undo" }, S)).toEqual({ name: "undo", input: {} })
    expect(ownCommand({ title: "mcp.other.undo" }, S)).toBeNull()
  })

  it("usage: input counts the cached part too", () => {
    expect(turnUsage({ stopReason: "end_turn", usage: { totalTokens: 52736, inputTokens: 11296, cachedReadTokens: 41344, outputTokens: 96, thoughtTokens: 0 } })).toEqual({ input: 52640, cached: 41344, output: 96, reasoning: 0 })
    expect(turnUsage({ stopReason: "end_turn", _meta: { quota: { token_count: { inputTokens: 10, cachedInputTokens: 5, outputTokens: 2, reasoningOutputTokens: 1 } } } })).toEqual({ input: 15, cached: 5, output: 2, reasoning: 1 })
    expect(turnUsage({ stopReason: "end_turn" })).toBeUndefined()
  })
})

describe("agent options", () => {
  const codexOptions = [
    { id: "model", name: "Model", type: "select" as const, currentValue: "gpt-6.1-sol", options: [{ value: "gpt-6.2-sol", name: "6.2 Sol" }, { value: "gpt-6.1-sol", name: "6.1 Sol" }] },
    { id: "fast-mode", name: "Fast mode", type: "select" as const, currentValue: "on", options: [{ value: "on", name: "On" }] },
    {
      id: "mode",
      name: "Mode",
      type: "select" as const,
      currentValue: "agent",
      options: [
        { value: "read-only", name: "Read-only" },
        { value: "workspace-write", name: "Workspace access" },
        { value: "agent", name: "Auto review" },
        { value: "agent-full-access", name: "Full access" },
      ],
    },
  ]

  it("offers model and permissions, never full access, with the person's defaults", () => {
    const o = pickOptions(AGENTS.codex, codexOptions, { ...AGENTS.codex.defaults, model: "gpt-6.2-sol" })
    expect(o.map((x) => x.id)).toEqual(["model", "mode"])
    expect(o[0].value).toBe("gpt-6.2-sol")
    expect(o[1].value).toBe("read-only")
    expect(o[1].choices.map((c) => c.value)).not.toContain("agent-full-access")
  })

  it("a default the agent no longer offers falls back to its own value", () => {
    expect(pickOptions(AGENTS.codex, codexOptions, { model: "gone" })[0].value).toBe("gpt-6.1-sol")
  })

  it("compares versions by their numbers", () => {
    expect(versionAtLeast("0.171.0", "0.171.0")).toBe(true)
    expect(versionAtLeast("0.172.1", "0.171.0")).toBe(true)
    expect(versionAtLeast("0.99.9", "0.171.0")).toBe(false)
    expect(versionAtLeast("1.0.0", "0.171.0")).toBe(true)
  })
})

describe("an agent waiting for an approval that went elsewhere", () => {
  const waiting = (on: boolean): SessionUpdate => ({ sessionUpdate: "session_info_update", _meta: { codex: { threadStatus: { type: "active", activeFlags: on ? ["waitingOnApproval"] : [] } } } })

  it("says so after a while when no card came, and takes it back when the wait ends", () => {
    vi.useFakeTimers()
    try {
      const chunks = run((t) => {
        t.update(waiting(true))
        vi.advanceTimersByTime(APPROVAL_ELSEWHERE_MS + 10)
        t.update(waiting(false))
        t.finish({ agent: { id: "codex", session: "s1" } })
      })
      const notices = chunks.filter((c) => c.type === "data-notice")
      expect(notices).toHaveLength(2)
      expect(notices[0]).toMatchObject({ data: { kind: "approval-elsewhere", active: true } })
      expect(notices[1]).toMatchObject({ id: (notices[0] as { id: string }).id, data: { active: false } })
    } finally {
      vi.useRealTimers()
    }
  })

  it("stays quiet when the approval came here as a card", () => {
    vi.useFakeTimers()
    try {
      const chunks = run((t) => {
        t.update(waiting(true))
        t.asked("call-1")
        vi.advanceTimersByTime(APPROVAL_ELSEWHERE_MS + 10)
        t.update(waiting(false))
        t.finish({ agent: { id: "codex", session: "s1" } })
      })
      expect(chunks.some((c) => c.type === "data-notice")).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

type Peer = { notify: (m: string, p: unknown) => Promise<void>; request: (m: string, p: unknown) => Promise<unknown> }

/** An ACP agent in the test process: by default a prompt asks for a permission and says what it got. */
function fakeAgent(prompt?: (text: string, peer: Peer, seen: { cancels: number; cancelled: Promise<void> }) => Promise<{ stopReason: "end_turn" | "cancelled" }>) {
  const c2a = new TransformStream<Uint8Array, Uint8Array>()
  const a2c = new TransformStream<Uint8Array, Uint8Array>()
  let onCancel = () => {}
  const seen: { prompts: string[]; outcomes: unknown[]; cancels: number; cancelled: Promise<void> } = { prompts: [], outcomes: [], cancels: 0, cancelled: new Promise((r) => (onCancel = r)) }
  const options = [{ id: "mode", name: "Mode", type: "select" as const, currentValue: "read-only", options: [{ value: "read-only", name: "Read-only" }, { value: "agent-full-access", name: "Full access" }] }]
  const app = agent({ name: "fake" })
    .onRequest(methods.agent.initialize, () => ({ protocolVersion: 1, agentInfo: { name: "fake", version: "9.9.9" }, agentCapabilities: { sessionCapabilities: {} } }))
    .onRequest(methods.agent.session.new, () => ({ sessionId: "s1", configOptions: options }))
    .onRequest(methods.agent.session.prompt, async ({ params, client: peer }) => {
      const text = params.prompt.map((b) => (b.type === "text" ? b.text : "")).join("")
      seen.prompts.push(text)
      if (prompt) return prompt(text, peer as unknown as Peer, seen)
      await peer.notify(methods.client.session.update, { sessionId: "s1", update: { sessionUpdate: "agent_message_chunk", messageId: "m1", content: { type: "text", text: "要写文件。" } } })
      const res = await peer.request(methods.client.session.requestPermission, {
        sessionId: "s1",
        toolCall: { toolCallId: "c1", title: "printf hello > notes.txt", kind: "execute" },
        options: [
          { optionId: "allow_once", name: "Yes, proceed", kind: "allow_once" },
          { optionId: "allow_for_session", name: "Yes, and don't ask again for this command in this session", kind: "allow_always" },
          { optionId: "accept_execpolicy_amendment", name: "Yes, and don't ask again for commands that start with `printf`", kind: "allow_always" },
          { optionId: "decline", name: "No, continue without running it", kind: "reject_once" },
          { optionId: "cancel", name: "No, and tell Codex what to do differently", kind: "reject_once" },
          { optionId: "apply_network_policy_amendment:0", name: "No, and block this host in the future", kind: "reject_always" },
        ],
      })
      seen.outcomes.push(res.outcome)
      return { stopReason: res.outcome.outcome === "cancelled" ? "cancelled" : "end_turn" }
    })
    .onNotification(methods.agent.session.cancel, () => {
      seen.cancels++
      onCancel()
    })
  app.connect(ndJsonStream(a2c.writable, c2a.readable))
  let killed = () => {}
  const proc: AgentProcess = { input: c2a.writable, output: a2c.readable, exited: new Promise((r) => (killed = () => r("killed"))), stderr: () => "", kill: () => killed() }
  return { proc, seen }
}

describe("AgentClient with an ACP agent", () => {
  const turnOf = (client: AgentClient, signal = new AbortController().signal, text = "写个文件") => {
    const chunks: UIMessageChunk[] = []
    const cards: { id: string; card: PermissionCard }[] = []
    const done = client.turn({ chat: "c-1", cwd: "/tmp/p", text, earlier: [], lang: "zh", defaults: {}, emit: (c) => chunks.push(c), card: (id, card) => cards.push({ id, card }), signal })
    return { chunks, cards, done }
  }
  const until = async (ok: () => boolean) => {
    for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 5))
  }

  it("shows the permission card in the agent's own words, without choices that outlast the chat, and passes the answer on", async () => {
    const { proc, seen } = fakeAgent()
    const client = new AgentClient(AGENTS.codex, async () => proc, { version: "0" })
    const t = turnOf(client)
    await until(() => t.cards.length > 0)
    expect(t.cards[0].card).toMatchObject({ title: "printf hello > notes.txt", kind: "execute" })
    // Two rejections of one kind stay apart; "from now on" choices (written into the agent's config) are left out.
    expect(t.cards[0].card.options.map((o) => o.id)).toEqual(["allow_once", "allow_for_session", "decline", "cancel"])
    expect(t.cards[0].card.options.map((o) => o.label)).toContain("No, continue without running it")
    expect(client.answer(t.cards[0].id, "allow_once")).toBe(true)
    await t.done
    expect(seen.outcomes).toEqual([{ outcome: "selected", optionId: "allow_once" }])
    expect(t.cards.at(-1)!.card.answer).toBe("allow_once")
    expect(seen.prompts[0]).toBe("写个文件")
    const m = await message(t.chunks)
    expect(m.parts[0]).toMatchObject({ type: "text", text: "要写文件。" })
    expect(m.metadata).toMatchObject({ agent: { id: "codex", session: "s1" } })
    // Full access is never offered.
    expect(client.options("c-1", {})[0].choices.map((c) => c.value)).toEqual(["read-only"])
    client.dispose()
  })

  it("Stop cancels the turn and the question still open", async () => {
    const { proc, seen } = fakeAgent()
    const client = new AgentClient(AGENTS.codex, async () => proc, { version: "0" })
    const stop = new AbortController()
    const t = turnOf(client, stop.signal)
    await until(() => t.cards.length > 0)
    stop.abort()
    await t.done
    expect(seen.cancels).toBe(1)
    expect(seen.outcomes).toEqual([{ outcome: "cancelled" }])
    expect(t.cards.at(-1)!.card.answer).toBe("cancelled")
    client.dispose()
  })
})

describe("what the agent hasn't seen of the conversation", () => {
  const earlier = [
    { role: "user" as const, text: "做个杯子" },
    { role: "assistant" as const, text: "做好了", session: "s1" },
    { role: "user" as const, text: "把壁厚改成 3" },
    { role: "assistant" as const, text: "改好了（内置助手）" },
  ]

  it("a new session gets the whole conversation; the session that answered gets only what came after", () => {
    expect(unseenHistory(earlier, "s-new", "zh")).toContain("用户：做个杯子")
    const after = unseenHistory(earlier, "s1", "zh")
    expect(after).not.toContain("做个杯子")
    expect(after).toContain("用户：把壁厚改成 3")
    expect(after).toContain("助手：改好了（内置助手）")
    expect(unseenHistory(earlier.slice(0, 2), "s1", "zh")).toBe("")
  })
})

describe("a stopped turn still finishing", () => {
  it("keeps its late words to itself; the next message waits for it", async () => {
    const { proc } = fakeAgent(async (text, peer, seen) => {
      const say = (t: string) => peer.notify(methods.client.session.update, { sessionId: "s1", update: { sessionUpdate: "agent_message_chunk", messageId: text, content: { type: "text", text: t } } })
      if (text === "第一句") {
        await seen.cancelled
        await new Promise((r) => setTimeout(r, 30))
        await say("旧的尾巴")
        return { stopReason: "cancelled" }
      }
      await say("新的回答")
      return { stopReason: "end_turn" }
    })
    const client = new AgentClient(AGENTS.codex, async () => proc, { version: "0" })
    const stop = new AbortController()
    const a: UIMessageChunk[] = []
    const b: UIMessageChunk[] = []
    const base = { chat: "c-1", cwd: "/tmp/p", earlier: [], lang: "zh" as const, defaults: {}, card: () => {} }
    const first = client.turn({ ...base, text: "第一句", emit: (c) => a.push(c), signal: stop.signal })
    await new Promise((r) => setTimeout(r, 50))
    stop.abort()
    // The window is free again at once: the person sends the next message.
    const second = client.turn({ ...base, text: "第二句", emit: (c) => b.push(c), signal: new AbortController().signal })
    await Promise.all([first, second])
    const words = (cs: UIMessageChunk[]) => cs.flatMap((c) => (c.type === "text-delta" ? [c.delta] : [])).join("")
    expect(words(a)).toBe("旧的尾巴")
    expect(words(b)).toBe("新的回答")
    client.dispose()
  })
})
