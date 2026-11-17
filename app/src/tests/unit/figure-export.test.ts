import { beforeAll, describe, expect, it } from "vitest"
import { makeBaseBox, makeCylinder, type Shape3D } from "replicad"
import { initNodeKernel } from "@/studio/kernel/node"
import { makeDrawing } from "@/studio/kernel/drawing"
import { meshBody } from "@/studio/kernel/mesh"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { Engine } from "@/desktop/core/engine"
import type { CallContext } from "@/desktop/core/protocol"
import { memFiles } from "./mem-files"

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

const AGENT: CallContext = { actor: "agent", session: "s1", cwd: "/work" }
const total = (segs: number[]) => {
  let s = 0
  for (let i = 0; i < segs.length; i += 4) s += Math.hypot(segs[i + 2] - segs[i], segs[i + 3] - segs[i + 1])
  return s
}

describe("drawing sheet from the mesh", () => {
  it("draws the same views as exact hidden-line removal, to within the mesh's polylines", () => {
    // A 60 × 40 × 20 block with a ⌀16 hole through it.
    const body = (makeBaseBox(60, 40, 20) as unknown as Shape3D).cut(makeCylinder(8, 40, [0, 0, -10]) as unknown as Shape3D) as Shape3D
    const { mesh, edges } = meshBody(body)
    const exact = makeDrawing(body, [], [], true)
    const fast = makeDrawing(body, [], [], true, undefined, { mesh, edges })
    for (const name of ["front", "top", "left", "iso"] as const) {
      const a = exact.views.find((v) => v.name === name)!
      const b = fast.views.find((v) => v.name === name)!
      // The same outline, and about as much line drawn (the hole's circle is a polyline in the mesh).
      for (let k = 0; k < 2; k++)
        for (let j = 0; j < 2; j++) expect(Math.abs(a.bbox[k][j] - b.bbox[k][j]), `${name} bbox`).toBeLessThan(0.3)
      expect(total(b.visible) / total(a.visible), `${name} visible`).toBeGreaterThan(0.93)
      expect(total(b.visible) / total(a.visible), `${name} visible`).toBeLessThan(1.07)
    }
    // From the top, the hole's far rim is hidden: both methods have hidden lines in the front view (the hole's sides).
    expect(total(fast.views.find((v) => v.name === "front")!.hidden)).toBeGreaterThan(30)
  })
})

describe("export: pictures", () => {
  async function engineWithParts() {
    const mem = memFiles()
    const engine = new Engine({ kernel: new DirectKernel(), files: mem.files })
    const run = (name: string, input: unknown) => engine.run(name, input, AGENT)
    expect((await run("open_part", { path: "case", create: true })).ok).toBe(true)
    await run("sketch", { id: "sk", on: { plane: "XY" }, shapes: [{ type: "rect", w: 60, h: 40 }] })
    await run("extrude", { id: "ex", sketch: "sk", distance: 30 })
    await run("sketch", { id: "sk2", on: { plane: "XY", face: { normal: "+Z", extreme: "+Z" } }, shapes: [{ type: "circle", d: 12 }] })
    await run("extrude", { id: "boss", sketch: "sk2", distance: 10 })
    const split = await run("split", { id: "sp", by: { plane: "XY", offset: 20 }, parts: ["底壳", "上盖"] })
    expect(split.ok, split.text).toBe(true)
    return { run, mem }
  }

  it("makes an SVG line drawing without a window: numbered parts, pulled apart, hidden lines dashed", async () => {
    const { run, mem } = await engineWithParts()
    const res = await run("export", { path: "out/case.svg", labels: "numbers", explode: 1, hidden_lines: true })
    expect(res.ok, res.text).toBe(true)
    expect(res.text).toContain("按 10、20、30… 标号（2 个）")
    const svg = String(await mem.files.read("/work/out/case.svg"))
    expect(svg.startsWith("<svg")).toBe(true)
    expect(svg).toContain(">10</text>")
    expect(svg).toContain(">20</text>")
    expect(svg).toContain("stroke-dasharray")
    // Its own labels, and the same view of the parts by name.
    const named = await run("export", { path: "/work/named.svg", view: "front", labels: { 上盖: "12" } })
    expect(named.ok, named.text).toBe(true)
    const text = String(await mem.files.read("/work/named.svg"))
    expect(text).toContain(">12</text>")
    expect(text).not.toContain(">10</text>")
  })

  it("explains what's wrong instead of drawing something else", async () => {
    const { run } = await engineWithParts()
    expect((await run("export", { path: "x.svg", hide: ["盖子"] })).text).toContain("不是零件的名字")
    expect((await run("export", { path: "x.svg", labels: { 盖子: "1" } })).text).toContain("不是零件的名字")
    expect((await run("export", { path: "x.svg", hide: ["底壳", "上盖"] })).text).toContain("没有可画的")
    // A PNG is drawn by the window: none here.
    const png = await run("export", { path: "x.png" })
    expect(png.ok).toBe(false)
    expect(png.text).toContain("svg 线稿不需要窗口")
  })
})
