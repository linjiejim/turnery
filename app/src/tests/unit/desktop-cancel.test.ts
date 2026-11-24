// Cancelling a load: the person stops opening a part (or opens another), the window is free at once, and
// nothing of the stopped load turns up on the part opened next.
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { Engine, type KernelHost } from "@/desktop/core/engine"
import type { KernelPhase, Snapshot } from "@/desktop/core/protocol"
import { BuildStopped, type BuildReport, type DisplayData } from "@/studio/kernel/build"
import type { Tree } from "@/studio/dsl"
import { ThreadKernel } from "../../../../desktop/src/engine/kernel-host"
import { memFiles } from "./mem-files"

const report = (tree: Tree): BuildReport => ({ params: {}, features: [], lastOk: tree.features.length - 1, body: null, ms: 0 })
const display = (index = 0): DisplayData => ({ index, mesh: null, groups: [], edges: null, edgeGroups: [], sketch: null, bbox: null, threads: [] })

/**
 * A kernel whose parts named in `slow` take until `finish` (or a cancel) to build, like a big part does.
 * One part at a time, as the real one: it records which part each rebuild was for.
 */
class SlowKernel implements KernelHost {
  phase: KernelPhase = { phase: "ready" }
  progress = null
  slow = new Set<string>()
  /** Parts whose kernel comes back empty (dropped to make room): the engine builds them again. */
  fresh = new Set<string>()
  built: string[] = []
  stopped: string[] = []
  private slot = ""
  private current: { slot: string; finish: () => void; stop: () => void } | null = null
  async use(slot: string) {
    this.slot = slot
    return this.fresh.delete(slot)
  }
  rebuild(tree: Tree) {
    const slot = this.slot
    if (!this.slow.has(slot)) {
      this.built.push(slot)
      return Promise.resolve(report(tree))
    }
    return new Promise<BuildReport>((resolve, reject) => {
      this.current = {
        slot,
        finish: () => {
          this.built.push(slot)
          resolve(report(tree))
        },
        stop: () => {
          this.stopped.push(slot)
          reject(new BuildStopped())
        },
      }
    })
  }
  /** The slow rebuild under way finishes. */
  finish() {
    const c = this.current
    this.current = null
    c?.finish()
  }
  get busy() {
    return this.current?.slot ?? null
  }
  async cancel() {
    const c = this.current
    if (!c) return "idle" as const
    this.current = null
    c.stop()
    return "stopped" as const
  }
  inspect = async () => ""
  display = async (index?: number) => display(index)
  pick = async () => null
  locate = async () => null
  selectorFor = async () => null
  faceEdges = async () => []
  measure = async () => null
  dimensions = async () => []
  drawing = async () => null
  exportBody = async () => null
}

const PART = JSON.stringify({ params: {}, features: [{ id: "s", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: 10, h: 10 }] }] })

function setup() {
  const mem = memFiles()
  for (const name of ["a", "b", "big"]) mem.disk.set(`/p/${name}.turnery.json`, PART)
  const kernel = new SlowKernel()
  kernel.slow.add("/p/big.turnery.json")
  const engine = new Engine({ kernel, files: mem.files })
  const snapshots: Snapshot[] = []
  engine.on((e) => e.type === "snapshot" && snapshots.push(e.snapshot))
  const open = (p: string, actor: "user" | "agent" = "user") => engine.run("open_part", { path: p }, { actor })
  /** Until the slow part's rebuild has started. */
  const loadingBig = async () => {
    for (let i = 0; i < 100 && kernel.busy !== "/p/big.turnery.json"; i++) await new Promise((r) => setTimeout(r, 2))
    expect(kernel.busy).toBe("/p/big.turnery.json")
  }
  return { engine, kernel, mem, snapshots, open, loadingBig }
}

describe("cancelling a load", () => {
  it("stops opening a part when asked: the window goes back to what it showed, and the part isn't left half open", async () => {
    const { engine, kernel, open, loadingBig } = setup()
    expect((await open("/p/a.turnery.json")).ok).toBe(true)
    const opening = open("/p/big.turnery.json")
    await loadingBig()
    expect(engine.snapshot().loading).toMatchObject({ path: "/p/big.turnery.json", cancellable: true })
    expect(await engine.cancelLoading()).toBe(true)
    const r = await opening
    expect(r).toMatchObject({ ok: false, cancelled: true })
    expect(r.text).toMatch(/取消|cancelled/i)
    expect(kernel.stopped).toEqual(["/p/big.turnery.json"])
    const s = engine.snapshot()
    expect(s.active).toBe("/p/a.turnery.json")
    expect(s.loading).toBeNull()
    expect(s.parts.map((p) => p.path)).toEqual(["/p/a.turnery.json"])
    // Nothing left to stop.
    expect(await engine.cancelLoading()).toBe(false)
  })

  it("opening another part stops the one loading, without waiting for it", async () => {
    const { engine, kernel, open, loadingBig } = setup()
    const opening = open("/p/big.turnery.json")
    await loadingBig()
    const other = await open("/p/b.turnery.json")
    expect(other.ok).toBe(true)
    expect((await opening).ok).toBe(false)
    // The big part never finished; the other one was built after it stopped.
    expect(kernel.stopped).toEqual(["/p/big.turnery.json"])
    expect(kernel.built).toEqual(["/p/b.turnery.json"])
    expect(engine.snapshot().active).toBe("/p/b.turnery.json")
    expect(engine.docState()?.path).toBe("/p/b.turnery.json")
  })

  it("opening the cancelled part again carries on and opens it", async () => {
    const { engine, kernel, open, loadingBig } = setup()
    const first = open("/p/big.turnery.json")
    await loadingBig()
    await engine.cancelLoading()
    expect((await first).ok).toBe(false)
    const again = open("/p/big.turnery.json")
    await loadingBig()
    kernel.finish()
    expect((await again).ok).toBe(true)
    expect(engine.snapshot().active).toBe("/p/big.turnery.json")
    expect(engine.docState()?.error).toBeUndefined()
  })

  it("never puts a stopped load's preview on the part opened next", async () => {
    const { engine, open, loadingBig, kernel } = setup()
    kernel.slow.add("/p/b.turnery.json")
    const opening = open("/p/big.turnery.json")
    await loadingBig()
    const next = open("/p/b.turnery.json")
    await opening
    for (let i = 0; i < 100 && kernel.busy !== "/p/b.turnery.json"; i++) await new Promise((r) => setTimeout(r, 2))
    // The old load's geometry arrives late: it is for the big part, not the one loading now.
    engine.kernelPreview({ ...display(), provisional: true }, "/p/big.turnery.json")
    kernel.finish()
    await next
    expect(engine.docState("/p/b.turnery.json")?.preview).toBeUndefined()
  })

  it("leaves an agent's open alone when the window opens another part (that one waits its turn)", async () => {
    const { engine, kernel, open, loadingBig } = setup()
    const agent = open("/p/big.turnery.json", "agent")
    await loadingBig()
    const user = open("/p/a.turnery.json")
    await new Promise((r) => setTimeout(r, 20))
    expect(kernel.stopped).toEqual([])
    kernel.finish()
    expect((await agent).ok).toBe(true)
    expect((await user).ok).toBe(true)
    expect(kernel.built).toEqual(["/p/big.turnery.json", "/p/a.turnery.json"])
    expect(engine.snapshot().active).toBe("/p/a.turnery.json")
  })

  it("a load the window started by drawing a part gives way too, and isn't started again by drawing it", async () => {
    const { engine, kernel, open, loadingBig } = setup()
    kernel.slow.clear()
    expect((await open("/p/big.turnery.json")).ok).toBe(true)
    expect((await open("/p/a.turnery.json")).ok).toBe(true)
    // The big part's kernel was dropped to make room: drawing it builds it again, slowly.
    kernel.slow.add("/p/big.turnery.json")
    kernel.fresh.add("/p/big.turnery.json")
    kernel.built = []
    const draw = engine.kernelCall("/p/big.turnery.json", { op: "display" })
    await loadingBig()
    expect((await open("/p/b.turnery.json")).ok).toBe(true)
    await expect(draw).rejects.toBeInstanceOf(BuildStopped)
    expect(kernel.built).toEqual(["/p/b.turnery.json"])
    // Asking to draw it again doesn't start the load the person cancelled; opening it does.
    await expect(engine.kernelCall("/p/big.turnery.json", { op: "display" })).rejects.toBeInstanceOf(BuildStopped)
    expect(kernel.busy).toBeNull()
    const again = open("/p/big.turnery.json")
    await loadingBig()
    kernel.finish()
    expect((await again).ok).toBe(true)
    expect(engine.docState("/p/big.turnery.json")?.error).toBeUndefined()
    await expect(engine.kernelCall("/p/big.turnery.json", { op: "display" })).resolves.toMatchObject({ index: 0 })
  })

  it("doesn't offer to cancel an edit being applied", async () => {
    const { engine, kernel, open } = setup()
    expect((await open("/p/a.turnery.json")).ok).toBe(true)
    kernel.slow.add("/p/a.turnery.json")
    const edit = engine.run("set_params", { params: { w: 3 } }, { actor: "agent" })
    for (let i = 0; i < 100 && !kernel.busy; i++) await new Promise((r) => setTimeout(r, 2))
    expect(engine.snapshot().loading?.cancellable).toBe(false)
    expect(await engine.cancelLoading()).toBe(false)
    kernel.finish()
    expect((await edit).ok).toBe(true)
  })
})

describe("stopping the kernel thread", () => {
  // A stand-in for kernel-thread.mjs: "steps" checks the stop count between steps, "stuck" never looks.
  const WORKER = `
    import { parentPort as p, workerData } from 'node:worker_threads';
    const stop = new Int32Array(workerData.stop);
    p.postMessage({ type: 'ready' });
    p.on('message', async ({ id, op, args, gen }) => {
      if (op === 'rebuild') {
        const how = args[0].params.how;
        if (how === 'stuck') { const end = Date.now() + 5000; while (Date.now() < end) {} }
        for (let i = 0; i < 500; i++) {
          if (Atomics.load(stop, 0) !== gen) { p.postMessage({ id, ok: false, error: 'stopped', stopped: true }); return; }
          p.postMessage({ type: 'progress', progress: { stage: 'build', completed: i, total: 500 }, gen });
          await new Promise((r) => setTimeout(r, 5));
        }
        p.postMessage({ id, ok: true, result: { params: {}, features: [], lastOk: -1, body: null, ms: 0 }, heapMB: 1 });
        return;
      }
      p.postMessage({ id, ok: true, result: op === 'use' ? false : op === 'persist' ? 0 : null, heapMB: 1 });
    });
  `

  it("stops a rebuild between steps, or ends a stuck thread and starts afresh", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "turnery-cancel-"))
    const file = path.join(dir, "worker.mjs")
    await writeFile(file, WORKER)
    const kernel = new ThreadKernel(pathToFileURL(file))
    const tree = (how: string): Tree => ({ params: { how }, features: [] }) as unknown as Tree
    try {
      await kernel.use("big")
      expect(await kernel.cancel()).toBe("idle")
      // Between steps: it stops at the next one, and the thread carries on serving.
      const steps = kernel.rebuild(tree("steps"))
      await new Promise((r) => setTimeout(r, 50))
      expect(kernel.progress).not.toBeNull()
      const started = Date.now()
      expect(await kernel.cancel()).toBe("stopped")
      await expect(steps).rejects.toBeInstanceOf(BuildStopped)
      expect(Date.now() - started).toBeLessThan(500)
      expect(kernel.progress).toBeNull()
      expect(await kernel.use("small")).toBe(false)
      // Stuck inside one long step: the thread is ended after a moment, and the next call gets a new one.
      const stuck = kernel.rebuild(tree("stuck"))
      const caught = stuck.catch((e) => e)
      await new Promise((r) => setTimeout(r, 50))
      const t0 = Date.now()
      expect(await kernel.cancel()).toBe("reset")
      expect(Date.now() - t0).toBeLessThan(2000)
      expect(await caught).toBeInstanceOf(BuildStopped)
      await expect(kernel.use("small")).resolves.toBe(false)
    } finally {
      await kernel.dispose()
      await rm(dir, { recursive: true, force: true })
    }
  }, 20_000)
})
