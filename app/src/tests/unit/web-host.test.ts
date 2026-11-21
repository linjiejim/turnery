// The desktop engine hosted in the website's workbench: projects in the browser's storage, the
// kernel in this thread (DirectKernel plays the Worker).
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { initNodeKernel } from "@/studio/kernel/node"
import { DirectKernel } from "@/desktop/core/direct-kernel"
import { BrowserFiles, normPath, type FileStore } from "@/studio/web-host/browser-files"
import { PROJECTS, WebHost, cleanName } from "@/studio/web-host/web-host"
import { unzip } from "@/studio/zip"

/** A store that outlives the files object: what IndexedDB keeps between visits. */
function mapStore() {
  const kept = new Map<string, { data: string | Uint8Array; mtime: number }>()
  const store: FileStore = {
    loadAll: async () => new Map(kept),
    put: async (p, e) => void kept.set(p, e),
    remove: async (ps) => ps.forEach((p) => kept.delete(p)),
  }
  return { kept, store }
}

/** localStorage for the host's 「last opened」 and the old workbench's model. */
function fakeStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 }
}

const BOX = {
  params: { L: 40, W: 30, H: 10 },
  features: [
    { id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W" }] },
    { id: "e", op: "extrude", sketch: "s", distance: "H" },
  ],
}

async function host(store?: FileStore) {
  const h = await WebHost.withKernel(new DirectKernel(), store ?? mapStore().store)
  const downloads: { name: string; blob: Blob }[] = []
  h.download = (blob, name) => void downloads.push({ name, blob })
  return { h, downloads }
}

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = fakeStorage()
})

describe("browser files", () => {
  it("normalises paths, lists folders and keeps files in the store across visits", async () => {
    expect(normPath("/web//projects/./a/../b/")).toBe("/web/projects/b")
    const { store, kept } = mapStore()
    const f = await BrowserFiles.open(store)
    await f.write("/web/projects/盒子/盒子.turnery.json", "{}")
    await f.write("/web/projects/盒子/parts/盖.turnery.json", "{}")
    expect(await f.list("/web/projects/盒子")).toEqual([
      { name: "盒子.turnery.json", dir: false },
      { name: "parts", dir: true },
    ])
    expect(await f.list("/web/projects/没有")).toBeNull()
    await f.flush()
    expect(kept.size).toBe(2)
    const again = await BrowserFiles.open(store)
    expect(await again.read("/web/projects/盒子/parts/盖.turnery.json")).toBe("{}")
    await again.rename("/web/projects/盒子", "/web/projects/箱子")
    expect(again.under("/web/projects/箱子")).toHaveLength(2)
    expect(again.exists("/web/projects/盒子")).toBe(false)
    const gone = await again.remove("/web/projects/箱子/parts")
    expect(gone.map((g) => g.path)).toEqual(["/web/projects/箱子/parts/盖.turnery.json"])
    await again.flush()
    expect([...kept.keys()]).toEqual(["/web/projects/箱子/盒子.turnery.json"])
  })

  it("tells the engine when the page changes a file it watches, not when the engine writes it", async () => {
    const f = await BrowserFiles.open(mapStore().store)
    let heard = 0
    f.watch("/a/b.json", () => heard++)
    await f.write("/a/b.json", "1")
    expect(heard).toBe(0)
    await f.put("/a/b.json", "2")
    expect(heard).toBe(1)
  })
})

describe("web host", () => {
  it("moves the old single model into 「我的模型」 on the first visit, and reopens it next time", async () => {
    localStorage.setItem("ft-studio-v1", JSON.stringify({ tree: BOX, history: [] }))
    const { store } = mapStore()
    const { h } = await host(store)
    await h.boot()
    const snap = h.engine.snapshot()
    expect(snap.project?.name).toBe("我的模型")
    expect(h.engine.docState()?.tree.features).toHaveLength(2)
    expect(h.engine.docState()?.report?.lastOk).toBe(1)
    await h.files.flush()
    // The next visit: the same files, the same part.
    const { h: next } = await host(store)
    await next.boot()
    expect((await next.projects()).map((p) => p.name)).toEqual(["我的模型"])
    expect(next.engine.docState()?.path).toBe(snap.active)
  })

  it("builds an assembly project: parts added from the window, shared parameters, a STEP from the computer", async () => {
    const { h } = await host()
    await h.boot()
    const root = await h.createProject("笔", "assembly")
    expect(root).toBe(`${PROJECTS}/笔`)
    const asm = h.engine.docState()!
    expect(asm.kind).toBe("assembly")
    // 「＋ 零件 → 新零件…」 as the sidebar does it.
    const added = await h.call("add_part", { name: "笔杆" }, asm.path)
    expect(added.ok, added.text).toBe(true)
    const part = h.engine.docState()!
    expect(part.path).toBe(`${root}/parts/笔杆.turnery.json`)
    expect(part.context?.assembly).toBe(asm.path)
    // The part uses the project's parameter file: a shared parameter reaches it.
    const shared = await h.call("set_params", { set: { d: 10 }, shared: true }, part.path)
    expect(shared.ok, shared.text).toBe(true)
    for (const [name, input] of [
      ["sketch", { id: "s", on: { plane: "XY" }, shapes: [{ type: "circle", d: "d" }] }],
      ["extrude", { id: "e", sketch: "s", distance: 120 }],
    ] as const) {
      const r = await h.call(name, input, part.path)
      expect(r.ok, r.text).toBe(true)
    }
    // A STEP model uploaded into the project, then put in the assembly.
    const board = new DirectKernel()
    await board.rebuild(BOX as never)
    const step = (await board.exportBody("step"))!
    board.dispose()
    const up = await h.importFiles([new File([step as BlobPart], "board.step")])
    expect(up.added).toEqual([`${root}/board.step`])
    expect(h.stepFiles()).toEqual([`${root}/board.step`])
    await h.call("open_part", { path: asm.path })
    const ref = await h.call("add_part", { file: `${root}/board.step` }, asm.path)
    expect(ref.ok, ref.text).toBe(true)
    const doc = h.engine.docState()!
    expect(doc.report?.parts?.map((p) => p.name).sort()).toEqual(["board", "笔杆"])
    // The parts list, as 「导出 → 零件清单」 gives it.
    const { downloads } = { downloads: [] as { name: string; blob: Blob }[] }
    h.download = (blob, name) => void downloads.push({ name, blob })
    await h.exportCurrent("bom")
    expect(downloads[0].name).toBe("笔-零件清单.md")
    expect(await downloads[0].blob.text()).toContain("笔杆")
    await h.exportCurrent("3mf")
    expect(downloads[1].name).toBe("笔.3mf")
    expect(h.files.under("/web/.exports")).toEqual([])
  })

  it("exports a project as a zip and imports it back as a new project", async () => {
    const { h, downloads } = await host()
    await h.boot()
    await h.createProject("盒子", "part")
    const path = h.engine.docState()!.path
    expect((await h.call("set_tree", { tree: BOX }, path)).ok).toBe(true)
    await h.exportProject()
    const zip = downloads[0]
    expect(zip.name).toBe("盒子.zip")
    const entries = await unzip(new Uint8Array(await zip.blob.arrayBuffer()))
    expect(entries.map((e) => e.name)).toEqual(["盒子/盒子.turnery.json"])
    const back = await h.importFiles([new File([await zip.blob.arrayBuffer()], "盒子.zip")])
    expect(back.project).toBe(`${PROJECTS}/盒子 2`)
    expect(h.engine.docState()?.tree.features).toHaveLength(2)
  })

  it("imports a feature tree as a new part (undo removes it), deletes files with undo, refuses what it can't read", async () => {
    const { h } = await host()
    await h.boot()
    const before = h.engine.docState()!.path
    const r = await h.importFiles([new File([JSON.stringify(BOX)], "垫块.json")])
    expect(r.opened).toMatch(/垫块\.turnery\.json$/)
    expect(h.engine.docState()?.path).toBe(r.opened)
    await r.undo!()
    expect(h.files.exists(r.opened!)).toBe(false)
    expect(h.engine.docState()?.path).toBe(before)
    await expect(h.importFiles([new File(["hello"], "notes.txt")])).rejects.toThrow(/不认识/)
    await expect(h.importFiles([new File(["not a step"], "x.step")])).rejects.toThrow(/不是 STEP/)
    const extra = await h.newFile("part", "第二个")
    const undo = await h.deleteFile(extra)
    expect(h.files.exists(extra)).toBe(false)
    expect(h.engine.docState()?.path).not.toBe(extra)
    await undo()
    expect(h.engine.docState()?.path).toBe(extra)
  })

  it("renames and deletes projects; the last one deleted leaves a fresh one", async () => {
    const { h } = await host()
    await h.boot()
    const root = await h.createProject("草稿", "part")
    const renamed = await h.renameProject(root, "定稿")
    expect(renamed).toBe(`${PROJECTS}/定稿`)
    expect(h.projectRoot).toBe(renamed)
    expect(h.engine.docState()?.path.startsWith(renamed)).toBe(true)
    for (const p of await h.projects()) await h.deleteProject(p.root)
    expect((await h.projects()).map((p) => p.name)).toEqual(["我的模型"])
    expect(cleanName(" ../a/b ")).toBe("-a-b")
  })
})
