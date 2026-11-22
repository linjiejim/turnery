// 手动建特征（docs/specs/2026-11-22-web-without-chat.md）：练习的参考答案都能用表单写出来；
// 「＋」的每一项一打开就能建出来；一张表单是一步撤销，取消就回到打开之前；打开工作台时忘掉对话留下的 key。
import { beforeAll, describe, expect, it } from "vitest"
import { PRACTICE } from "@/content/practice"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext } from "@/desktop/core/protocol"
import { applyEdit } from "@/studio/apply"
import type { Feature, Tree } from "@/studio/dsl"
import { FORM_FIELDS, hasForm, insertAt, menuGroups, missing, PLANE_FIELDS, SHAPE_FIELDS, startDraft, whyNot } from "@/studio/feature-forms"
import { Kernel } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { forgetChat } from "@/studio/forget-chat"
import { memFiles } from "./mem-files"

const BASE = new Set(["id", "op", "name", "intent"])

/** The keys of `f` the form doesn't edit (a plane, a shape: one level down). */
function unformable(f: Feature): string[] {
  if (!hasForm(f.op)) return [`op ${f.op}`]
  const allowed = new Set([...BASE, ...FORM_FIELDS[f.op]])
  const out = Object.keys(f).filter((k) => !allowed.has(k))
  const on = (f as { on?: Record<string, unknown> }).on
  if (on) out.push(...Object.keys(on).filter((k) => !(PLANE_FIELDS as readonly string[]).includes(k)).map((k) => `on.${k}`))
  if (f.op === "sketch")
    for (const s of f.shapes) {
      const fields = SHAPE_FIELDS[s.type as keyof typeof SHAPE_FIELDS] as readonly string[] | undefined
      if (!fields) out.push(`shape ${s.type}`)
      else out.push(...Object.keys(s).filter((k) => k !== "type" && !fields.includes(k)).map((k) => `${s.type}.${k}`))
      if (s.type === "polyline" && s.points.some((p) => !Array.isArray(p))) out.push("polyline with arcs")
    }
  return out
}

describe("the feature form covers the practices", () => {
  it.each(PRACTICE.map((p) => [p.id, p] as const))("%s: every step of the reference answer fits the form", (_, p) => {
    for (const f of [...p.solution.features, ...(p.start?.features ?? [])]) expect(unformable(f), `${p.id} / ${f.id}`).toEqual([])
  })
})

const BOX: Tree = {
  params: {},
  features: [
    { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 60, h: 40 }] },
    { id: "e", op: "extrude", sketch: "s", distance: 20 },
  ],
}

describe("「＋」 on the real kernel", () => {
  let k: Kernel
  beforeAll(async () => {
    await initNodeKernel()
    k = new Kernel()
  }, 60_000)

  it("doesn't crash the rebuild on a cut through everything or a revolve about the wrong axis", () => {
    for (const extra of [
      { id: "cut1", op: "extrude", sketch: "s", mode: "cut", through: true },
      { id: "rev1", op: "revolve", sketch: "s", axis: "Z" },
    ] as Feature[]) {
      const r = k.rebuild({ ...BOX, features: [...BOX.features, extra] })
      expect(r.features.at(-1)?.state, extra.id).toBe("error")
    }
  })

  it("can only start from a sketch in an empty part", () => {
    const empty: Tree = { params: {}, features: [] }
    const open = menuGroups()
      .flatMap((g) => g.items)
      .filter((i) => !whyNot(empty, null, i.op, 0))
      .map((i) => i.key)
    expect(open).toEqual(["sketch"])
  })

  const items = menuGroups().flatMap((g) => g.items)
  /** Where each kind is first reached for: a new sketch on the box; a half-section for a revolve; two sections for a loft. */
  const BOSS: Tree = { ...BOX, features: [...BOX.features, { id: "s2", op: "sketch", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "circle", d: 10 }] }] }
  const HALF: Tree = { params: {}, features: [{ id: "s", op: "sketch", on: { plane: "XZ" }, shapes: [{ type: "rect", w: 10, h: 20, center: [15, 10] }] }] }
  const SECTIONS: Tree = {
    params: {},
    features: [
      { id: "a", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 40, h: 40 }] },
      { id: "b", op: "sketch", on: { plane: "XY", offset: 30 }, shapes: [{ type: "circle", d: 20 }] },
    ],
  }
  const setup = (key: string) => (key === "extrude" || key === "cut" ? BOSS : key === "revolve" ? HALF : key === "loft" ? SECTIONS : BOX)

  it("asks for a new sketch when every sketch is used", () => {
    const report = k.rebuild(BOX)
    expect(whyNot(BOX, report, "extrude", 2)).toMatch(/新草图/)
    expect(whyNot(BOSS, k.rebuild(BOSS), "extrude", 3)).toBeNull()
  })

  it.each(items.map((i) => [i.key, i] as const))("%s starts as something that builds (or asks for its selection)", (_, item) => {
    const base = setup(item.key)
    const report = k.rebuild(base)
    const at = insertAt(base, null)
    expect(whyNot(base, report, item.op, at), item.key).toBeNull()
    const draft = startDraft(base, report, item, at)
    const lack = missing(draft)
    if (item.op === "fillet" || item.op === "chamfer" || item.op === "draft") return expect(lack).toMatch(/选/)
    expect(lack, item.key).toBeNull()
    const { op, ...rest } = draft
    const tree = applyEdit(base, op, rest).tree
    const r = k.rebuild(tree)
    const mine = r.features.find((f) => f.id === draft.id)
    expect(mine?.state, `${item.key}: ${mine?.message ?? ""}`).toBe("ok")
  }, 30_000)

  it("names new steps after their kind, counting on from what's there", () => {
    const report = k.rebuild(BOX)
    const sketch = items.find((i) => i.key === "sketch")!
    const cut = items.find((i) => i.key === "cut")!
    expect(startDraft(BOX, report, sketch, 2).id).toBe("sketch1")
    expect(startDraft(BOX, report, cut, 2).id).toBe("cut1")
    // A sketch on a solid sits on its top face.
    expect(startDraft(BOX, report, sketch, 2).on).toEqual({ plane: "XY", face: { normal: "+Z", extreme: "+Z" } })
  })
})

describe("one form, one undo step", () => {
  const USER: CallContext = { actor: "user" }
  const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }
  beforeAll(async () => {
    await initNodeKernel()
  }, 60_000)

  async function engineWithBox() {
    const mem = memFiles()
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
    expect((await engine.run("open_part", { path: "box", create: true }, AGENT)).ok).toBe(true)
    expect((await engine.run("set_tree", { tree: BOX }, AGENT)).ok).toBe(true)
    return engine
  }
  const withHole = (d: number): Tree => ({ ...BOX, features: [...BOX.features, { id: "hole1", op: "hole", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, at: [[0, 0]], d }] })

  const ids = (engine: Engine) => engine.docState()!.tree.features.map((f) => f.id)

  it("merges a form's edits into one step and one line of activity", async () => {
    const engine = await engineWithBox()
    for (const d of [5, 6, 8]) expect((await engine.run("edit_tree", { tree: withHole(d), group: "g1" }, USER)).ok).toBe(true)
    expect(engine.docState()!.tree.features.at(-1)).toMatchObject({ id: "hole1", d: 8 })
    expect(engine.docState()!.changes.filter((c) => c.group === "g1")).toHaveLength(1)
    // The toolbar's undo takes back the whole form.
    await engine.run("undo", {}, USER)
    expect(ids(engine)).toEqual(["s", "e"])
  }, 30_000)

  it("a cancelled form leaves no step: writing back the tree from before it drops its undo entry and its line", async () => {
    const engine = await engineWithBox()
    const before = engine.docState()!
    const undoDepth = before.canUndo
    for (const d of [5, 6]) await engine.run("edit_tree", { tree: withHole(d), group: "g2" }, USER)
    await engine.run("edit_tree", { tree: BOX, group: "g2" }, USER)
    expect(ids(engine)).toEqual(["s", "e"])
    expect(engine.docState()!.changes.some((c) => c.group === "g2")).toBe(false)
    expect(engine.docState()!.canUndo).toBe(undoDepth)
  }, 30_000)

  it("a note in between doesn't split a form; an agent's edit does, and a cancel then keeps the agent's edit", async () => {
    const engine = await engineWithBox()
    await engine.run("edit_tree", { tree: withHole(5), group: "g3" }, USER)
    await engine.run("add_note", { text: "孔再大一点" }, USER)
    await engine.run("edit_tree", { tree: withHole(6), group: "g3" }, USER)
    await engine.run("undo", {}, USER)
    expect(ids(engine), "one step for the whole form, the note notwithstanding").toEqual(["s", "e"])

    const other = await engineWithBox()
    await other.run("edit_tree", { tree: withHole(5), group: "g4" }, USER)
    await other.run("set_params", { set: { t: 2 } }, AGENT)
    await other.run("edit_tree", { tree: { ...withHole(6), params: { t: 2 } }, group: "g4" }, USER)
    // The form's cancel: its feature taken out of the tree as it is now.
    await other.run("edit_tree", { tree: { ...BOX, params: { t: 2 } }, group: "g4" }, USER)
    expect(ids(other)).toEqual(["s", "e"])
    expect(other.docState()!.tree.params, "the agent's edit stays").toEqual({ t: 2 })
  }, 30_000)

  it("edit_tree is the window's: an agent can't call it", async () => {
    const engine = await engineWithBox()
    expect((await engine.run("edit_tree", { tree: withHole(5) }, AGENT)).ok).toBe(false)
  }, 30_000)
})

describe("the chat's leftovers", () => {
  it("go when the workbench opens: the key, every project's chat, the mode, share tokens; nothing else", () => {
    const data = new Map(
      Object.entries({
        "ft-studio-deepseek-key": "sk-x",
        "ft-studio-chat-v1": "[]",
        "ft-studio-chat-v1:/web/projects/a": "[]",
        "ft-studio-chat-v1:/web/projects/b": "[]",
        "ft-studio-mode": "teach",
        "ft-studio-shares-v1": "{}",
        "arbor:progress": "{}",
        "ft-studio-v1": "{}",
      }),
    )
    const store = { get length() { return data.size }, key: (i: number) => [...data.keys()][i] ?? null, removeItem: (k: string) => void data.delete(k) }
    forgetChat(store)
    expect([...data.keys()].sort()).toEqual(["arbor:progress", "ft-studio-v1"])
  })
})
