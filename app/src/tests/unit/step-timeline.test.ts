// The feature timeline under the 3D view: which step's name it shows, where that name sits, and what
// the small card over a step pointed at says (ui/tree-overlay.tsx).
import { describe, expect, it } from "vitest"
import type { Feature } from "@/studio/dsl"
import type { Dim } from "@/studio/kernel/dims"
import { cardDims, labelLeft, namedStep, stepLabel, stepLine } from "@/studio/step-timeline"

const dim = (id: string, feature: string, priority: number, derived = false): Dim => ({
  id,
  feature,
  path: [id],
  kind: "linear",
  value: 1,
  source: derived ? { type: "derived", text: "a-b" } : priority === 3 ? { type: "param", name: id } : { type: "literal" },
  label: id,
  text: id,
  geom: { type: "leader", at: [0, 0, 0], dir: [0, 0, 1] },
  priority,
  editable: !derived,
})

describe("the name under the timeline", () => {
  it("is the step pointed at, else the one open, else the one rolled back to, else none", () => {
    expect(namedStep({ pointed: "a", pinned: "b", selected: "c", rollback: "d" })).toBe("a")
    expect(namedStep({ pointed: null, pinned: "b", selected: "c", rollback: "d" })).toBe("b")
    expect(namedStep({ pointed: null, pinned: null, selected: "c", rollback: "d" })).toBe("c")
    expect(namedStep({ pointed: null, pinned: null, selected: null, rollback: "d" })).toBe("d")
    expect(namedStep({ pointed: null, pinned: null, selected: null, rollback: null })).toBeNull()
  })

  it("sits centred under its step, kept inside the strip at both ends", () => {
    expect(labelLeft(100, 40, 300)).toBe(100)
    expect(labelLeft(10, 40, 300), "the first step: pushed right").toBe(20)
    expect(labelLeft(295, 40, 300), "the last step: pushed left").toBe(280)
    expect(labelLeft(10, 300, 300), "as wide as the strip: centred on it").toBe(150)
  })
})

describe("the card over a step", () => {
  it("says which step, what kind, cut, which part and suppressed, in one line", () => {
    const cut = { id: "e", op: "extrude", sketch: "s", distance: 3, mode: "cut", part: "J3 牛角座" } as Feature
    expect(stepLine(cut, 11)).toBe("第 12 步 · 拉伸 · 切除 · J3 牛角座")
    const plain = { id: "f", op: "fillet", edges: {}, r: 1, suppressed: true } as unknown as Feature
    expect(stepLine(plain, 0)).toBe("第 1 步 · 圆角 · 已压缩")
  })

  it("is read with the step's state, since the button's aria-label is all a screen reader reads of it", () => {
    expect(stepLabel("盘体", {})).toBe("盘体")
    expect(stepLabel("圆角1", { suppressed: true })).toBe("圆角1（已压缩）")
    expect(stepLabel("盘面草图", {}, "error")).toBe("盘面草图（失败）")
    expect(stepLabel("孔阵列", {}, "skipped")).toBe("孔阵列（未重建）")
    expect(stepLabel("孔阵列", { suppressed: true }, "ok")).toBe("孔阵列（已压缩）")
  })

  it("shows at most two of the step's own design dimensions, parameters first", () => {
    const dims = [dim("lit", "e", 1), dim("other", "x", 3), dim("calc", "e", 0, true), dim("W", "e", 3), dim("k", "e", 2), dim("lit2", "e", 1)]
    expect(cardDims(dims, "e").map((d) => d.id)).toEqual(["W", "k"])
    expect(cardDims(dims, "none")).toEqual([])
    expect(cardDims([dim("calc", "e", 0, true)], "e"), "derived numbers stay in the details panel").toEqual([])
  })
})
