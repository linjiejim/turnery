// What the agent reads, in English: a short modeling session through the engine with the agent's
// language set to English says nothing in Chinese (the names here are all English, so any Chinese
// would be Turnery's own), and its results keep the markers code and models go by (✓ ✗ ⚠ ◆ at the
// start, the same per line). Then the same session in Chinese reads as it always has.
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { initNodeKernel } from "@/studio/kernel/node"
import { setAgentLang } from "@/lib/agent-lang"
import { assistantState } from "@/desktop/core/assistant"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine, type Screen } from "@/desktop/core/engine"
import type { CallContext, CommandResult } from "@/desktop/core/protocol"
import { memFiles } from "./mem-files"

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }
const USER: CallContext = { actor: "user" }
/** Chinese characters, and the full-width punctuation that goes with them (「」：，（）). */
const CJK = /[　-〿㐀-䶿一-鿿＀-￯]/

/** One session, step by step: what each call returned. */
async function session() {
  const mem = memFiles()
  const kernel = new DirectKernel()
  const screen: Screen = { look: async () => ["data:image/png;base64,AAAA"] }
  const engine = new Engine({ kernel, files: mem.files, screen: () => screen })
  const steps: { name: string; result: CommandResult }[] = []
  const run = async (name: string, input: unknown, ctx = AGENT) => {
    const result = await engine.run(name, input, ctx)
    steps.push({ name, result })
    return result
  }
  await run("open_part", { path: "box", create: true })
  await run("set_params", { set: { L: 60, W: 40, H: 20, r: 3 }, notes: { L: "Length along X", W: "Width along Y" } })
  await run("sketch", { id: "s1", name: "Outline", intent: "The footprint", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] })
  await run("extrude", { id: "e1", name: "Body", intent: "The block", sketch: "s1", distance: "H" })
  await run("fillet", { id: "f1", name: "Corners", intent: "Round the vertical edges", edges: { parallel: "Z" }, r: "r" })
  // One requirement met, one not: a ✓ row and a ✗ row.
  await run("check", {
    items: [
      { id: "size", said: "60 by 40 by 20", kind: "size", expect: [60, 40, 20] },
      { id: "tall", said: "25 tall", kind: "size", expect: [60, 40, 25] },
    ],
  })
  await run("get_state", {})
  await run("look", {})
  await run("measure", { a: { face: { normal: "+Z", extreme: "+Z" } }, b: { face: { normal: "-Z" } } })
  await run("export", { path: "box.md" })
  // Errors: bad input, a selector that selects nothing, a missing file, a stale version, no such command.
  await run("fillet", { id: "f2", name: "Bad", edges: { parallel: "Z" }, r: "nope +" })
  await run("measure", { a: { face: { normal: "+X", extreme: "-X", near: [500, 500, 500] } } })
  await run("open_part", { path: "missing" })
  await run("set_tree", { tree: { params: {}, features: [] }, base_rev: 0 })
  await run("no_such_command", {})
  // The person changes the model and leaves a note: the agent hears about both.
  await engine.run("set_params", { set: { H: 25 } }, USER)
  await engine.run("add_note", { text: "Make the walls thicker" }, USER)
  await run("get_state", {})
  await run("get_notes", {})
  await run("resolve_note", { id: "n1", reply: "Done" })
  await run("undo", {})
  const state = await assistantState(engine, { actor: "assistant", part: "/work/box.turnery.json" })
  engine.dispose()
  kernel.dispose()
  return { steps, state }
}

/** The markers a result's lines start with, in order (empty for a line with none). */
const markers = (text: string) => text.split("\n").map((l) => /^[✓✗⚠◆?▸]/u.exec(l)?.[0] ?? "")

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

afterAll(() => setAgentLang("zh"))

describe("the agent's language", () => {
  it("speaks English throughout a session, with the same markers and outcomes as in Chinese", async () => {
    setAgentLang("en")
    const en = await session()
    setAgentLang("zh")
    const zh = await session()

    const chinese = en.steps.filter((s) => CJK.test(s.result.text)).map((s) => `${s.name}: ${s.result.text.split("\n").find((l) => CJK.test(l))}`)
    expect(chinese, "English results with Chinese in them").toEqual([])
    expect(en.state).not.toMatch(CJK)

    expect(en.steps.map((s) => s.name)).toEqual(zh.steps.map((s) => s.name))
    en.steps.forEach((s, i) => {
      const other = zh.steps[i].result
      expect(s.result.ok, `${i} ${s.name}: ok`).toBe(other.ok)
      expect(markers(s.result.text), `${i} ${s.name}: line markers\n${s.result.text}\n---\n${other.text}`).toEqual(markers(other.text))
    })

    const text = (steps: typeof en.steps, name: string, nth = 0) => steps.filter((s) => s.name === name)[nth].result.text
    // The check: a passing and a failing row, marked as before.
    expect(text(en.steps, "check")).toMatch(/^✓ /m)
    expect(text(en.steps, "check")).toMatch(/^✗ /m)
    // The window tells a stale set_tree from other failures by its start (use-desktop.ts).
    expect(text(en.steps, "set_tree")).toMatch(/^✗ The model is already at version /)
    expect(text(zh.steps, "set_tree")).toMatch(/^✗ 模型已经是/)
    expect(text(en.steps, "no_such_command")).toBe("✗ No such command: no_such_command")
    // What the person did since the agent's last call comes first.
    expect(text(en.steps, "get_state", 1)).toMatch(/^⚠ Since your last call, the model was changed/)
    expect(text(en.steps, "get_state", 1)).toMatch(/^◆ The user left 1 new note in the window: n1 “Make the walls thicker”/m)
    expect(en.state).toMatch(/^## The state when this message was sent\n/)

    // The same calls in Chinese read as they always have.
    expect(text(zh.steps, "open_part")).toMatch(/^已新建零件 \/work\/box\.turnery\.json。Turnery 窗口已切到这个零件。/)
    expect(text(zh.steps, "get_state", 1)).toMatch(/^⚠ 自你上次调用以来，模型被改过（以现在的状态为准，不要改回去）：\n- 用户在窗口里：参数 H 20 → 25\n现在是第 \d+ 版。/)
    expect(text(zh.steps, "get_notes")).toMatch(/^1 条未处理的备注（look 的图里画着同样的编号）：\n\n\[备注 n1\] Make the walls thicker\n- 关于整个零件（没有点在某个面或边上）/)
    expect(text(zh.steps, "no_such_command")).toBe("✗ 没有这个命令：no_such_command")
    expect(zh.state).toMatch(/^## 发这条消息时的状态\n/)
    expect(text(en.steps, "open_part")).toMatch(/^Created the part \/work\/box\.turnery\.json\. The Turnery window now shows this part\./)
    expect(text(en.steps, "get_notes")).toMatch(/^1 open note \(the pictures from look show the same numbers\):\n\n\[Note n1\] Make the walls thicker\n- About the whole part \(not on a face or an edge\)/)
  }, 60_000)
})
