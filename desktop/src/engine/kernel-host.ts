// The engine's handle on the kernel worker thread. The OpenCascade wasm heap
// only grows; past a threshold the thread is replaced and the last tree is
// rebuilt in the new one, which the engine never notices.
import { Worker } from "node:worker_threads"
import type { KernelHost } from "../../../app/src/desktop/core/engine"
import type { KernelPhase, V3 } from "../../../app/src/desktop/core/protocol"
import type { Tree } from "../../../app/src/studio/dsl"
import type { Appearance, Look } from "../../../app/src/studio/appearance"
import type { BuildReport, BuildProgress, DisplayData, ComponentSource, ContextSource } from "../../../app/src/studio/kernel/build"
import type { Dim } from "../../../app/src/studio/kernel/dims"
import type { DrawingData } from "../../../app/src/studio/kernel/drawing"
import type { MeasureResult, MeasureSpec } from "../../../app/src/studio/kernel/measure"
import type { PickInfo } from "../../../app/src/studio/annotations"
import type { KernelReply, KernelRequest, KernelThreadData } from "./kernel-thread"
import { BuildStopped } from "../../../app/src/studio/kernel/build"
import { agentLang, ta } from "../../../app/src/lib/agent-lang"
import { ComponentPool } from "./component-pool"
import path from "node:path"
import { ProjectPreview } from "./project-preview"
import { AssemblyCache, assemblyKey } from "./assembly-cache"

/** Same limit as the browser studio's worker. */
const RECYCLE_MB = 1400
/** A stopped rebuild ends at the next feature; one stuck inside a long feature gets this long before its thread is ended. */
const STOP_GRACE_MS = 600
/** Idle this long after a call before keeping what was built (so a string of edits isn't held up writing). */
const PERSIST_IDLE_MS = 400
/** One `persist` call's share of the thread: calls from the window wait at most about this long behind it. */
const PERSIST_SLICE_MS = 120

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

/** What one part's kernel in the thread holds: replayed into a replacement thread. */
type Slot = { assets: { name: string; bytes: Uint8Array | null; error?: string }[]; components: ComponentSource[]; context: ContextSource | null; lastTree: Tree | null }
const newSlot = (): Slot => ({ assets: [], components: [], context: null, lastTree: null })

export class ThreadKernel implements KernelHost {
  phase: KernelPhase = { phase: "loading" }
  progress: BuildProgress | null = null
  private pool: ComponentPool
  private cache: Promise<AssemblyCache | null>
  private diagnosticWorkers = new Map<string, Worker>()
  private generations = new Map<string, number>()
  private projectPreview = new ProjectPreview()
  /** Per assembly: the project folder its preview is cached in (none: beside the assembly). */
  private previewRoots = new Map<string, string | null>()
  private writes = new Set<Promise<void>>()
  private preview: DisplayData | null = null
  private worker: Worker | null = null
  private started: Promise<void> | null = null
  private seq = 0
  private pending = new Map<number, Pending>()
  private stale = false
  /** The part the calls go to, and per part what the thread was last handed (a replacement thread gets the current one again). */
  private slot = ""
  private slots = new Map<string, Slot>([["", newSlot()]])
  /** Disposed: a late call (a file change already on its way) must not start a new thread. */
  private closed = false
  /** Bumped to stop the rebuild under way (shared with the thread, which checks it between features). */
  private readonly stopCount = new Int32Array(new SharedArrayBuffer(4))
  /** The rebuild under way, if any (`cancel` waits for it to stop). */
  private building: Promise<unknown> | null = null
  private persistTimer: ReturnType<typeof setTimeout> | null = null
  /** Built steps the thread hasn't kept yet (its last `persist` said so, or something was built since). */
  private unkept = false
  /** Where the main thread keeps built steps: one folder per build of the app, beside the components'. */
  private readonly steps: Promise<string | null>

  constructor(
    private readonly file: URL,
    private readonly onPhase: () => void = () => {},
    private readonly onPreview: (display: DisplayData, slot: string) => void = () => {},
    private readonly onDiagnostics: (path: string, report: BuildReport) => void = () => {},
  ) {
    this.pool = new ComponentPool(file)
    this.cache = this.pool.directory.then((dir) => dir ? new AssemblyCache(path.join(dir, "assemblies")) : null)
    this.steps = this.pool.directory.then((dir) => (dir ? path.join(path.dirname(path.dirname(dir)), "steps", path.basename(dir)) : null))
  }

  /** Start the thread now (the app does this at launch so the first command is fast). */
  start() {
    this.started ??= this.spawn()
    return this.started
  }

  private async spawn(): Promise<void> {
    const steps = process.env.TURNERY_NO_STEP_CACHE ? null : await this.steps
    if (this.closed) throw new Error(ta("建模内核已关闭", "The modeling kernel is closed"))
    // OpenCascade prints (STEP statistics, warnings) to stdout. Under `turnery mcp` stdout is the
    // protocol channel, so the thread gets its own streams and its chatter goes to stderr.
    const workerData: KernelThreadData = { stop: this.stopCount.buffer as SharedArrayBuffer, ...(steps ? { steps } : {}) }
    const worker = new Worker(this.file, { stdout: true, stderr: true, workerData })
    worker.stdout.on("data", (b: Buffer) => process.stderr.write(b))
    worker.stderr.on("data", (b: Buffer) => process.stderr.write(b))
    this.worker = worker
    return new Promise<void>((resolve, reject) => {
      worker.on("message", (m: KernelReply) => {
        if ("type" in m) {
          // Left over from a rebuild that was stopped: not the part being opened now.
          if ((m.type === "progress" || m.type === "preview") && m.gen !== undefined && m.gen !== Atomics.load(this.stopCount, 0)) return
          if (m.type === "progress") {
            this.progress = m.progress
            this.onPhase()
          } else if (m.type === "preview") {
            this.preview = m.display
            this.onPreview(m.display, this.slot)
          } else if (m.type === "ready") {
            this.setPhase({ phase: "ready" })
            resolve()
          } else {
            this.setPhase({ phase: "error", message: m.error })
            reject(new Error(m.error))
          }
          return
        }
        const p = this.pending.get(m.id)
        if (!p) return
        this.pending.delete(m.id)
        if (m.ok) {
          if (m.heapMB > RECYCLE_MB) this.stale = true
          p.resolve(m.result)
        } else p.reject(m.stopped ? new BuildStopped() : new Error(m.error))
      })
      const crashed = (why: string) => {
        if (this.worker !== worker) return
        this.worker = null
        this.started = null
        for (const p of this.pending.values()) p.reject(new Error(ta(`建模内核意外退出（${why}），下一次调用会自动重启`, `The modeling kernel quit unexpectedly (${why}); the next call restarts it`)))
        this.pending.clear()
        reject(new Error(why))
      }
      worker.on("error", (e) => crashed(e.message))
      worker.on("exit", (code) => crashed(`exit ${code}`))
    })
  }

  private setPhase(p: KernelPhase) {
    this.phase = p
    this.onPhase()
  }

  private async call<T>(op: KernelRequest["op"], args: unknown[]): Promise<T> {
    if (this.closed) throw new Error(ta("建模内核已关闭", "The modeling kernel is closed"))
    const gen = Atomics.load(this.stopCount, 0)
    if (this.stale || !this.worker) await this.restart()
    else await this.start()
    // Stopped while the thread was starting: this call belonged to the load that was cancelled.
    if (gen !== Atomics.load(this.stopCount, 0)) throw new BuildStopped()
    const id = ++this.seq
    if (op !== "persist") this.persistLater()
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.worker!.postMessage({ id, op, args, lang: agentLang(), gen } satisfies KernelRequest)
    })
  }

  /**
   * Keep what the thread built (kernel/build.ts, StepStore) once it has been idle a moment, a slice at a
   * time: the next call from the window waits at most one slice behind it.
   */
  private persistLater(delay = PERSIST_IDLE_MS) {
    this.unkept = true
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = setTimeout(() => void this.persistSlice(), delay)
    this.persistTimer.unref?.()
  }

  private async persistSlice() {
    this.persistTimer = null
    if (this.closed || !this.worker || !this.unkept) return
    if (this.pending.size) return this.persistLater()
    try {
      const left = await this.call<number>("persist", [PERSIST_SLICE_MS])
      if (left > 0) this.persistLater(20)
      else this.unkept = false
    } catch {
      /* a thread that went away kept what it had */
    }
  }

  /**
   * Stop the rebuild under way (the person cancelled the load, or opened another part). It stops at the
   * next feature, keeping the ones built; one stuck inside a long feature has its thread ended (the parts
   * it held are read back from the store when opened again). `reset`: the thread was ended, so it holds
   * no part now.
   */
  async cancel(): Promise<"idle" | "stopped" | "reset"> {
    Atomics.add(this.stopCount, 0, 1)
    this.pool.abort()
    this.progress = null
    this.onPhase()
    const busy = this.building
    if (!busy) return "idle"
    let timer: ReturnType<typeof setTimeout> | undefined
    const stopped = await Promise.race([busy.then(() => true, () => true), new Promise<boolean>((r) => (timer = setTimeout(() => r(false), STOP_GRACE_MS)))])
    clearTimeout(timer)
    if (stopped) return "stopped"
    const old = this.worker
    this.worker = null
    this.started = null
    this.stale = false
    // Nothing to replay into the next thread: the part that was loading isn't open in it.
    this.slot = ""
    this.slots = new Map([["", newSlot()]])
    for (const p of this.pending.values()) p.reject(new BuildStopped())
    this.pending.clear()
    if (old) {
      old.removeAllListeners("exit")
      void old.terminate()
    }
    return "reset"
  }

  /** A fresh thread holding the same files and tree as the old one. */
  private async restart() {
    const old = this.worker
    this.stale = false
    this.worker = null
    this.started = null
    if (old) {
      old.removeAllListeners("exit")
      void old.terminate()
    }
    await this.start()
    const send = (op: KernelRequest["op"], args: unknown[]) =>
      new Promise((resolve, reject) => {
        const id = ++this.seq
        this.pending.set(id, { resolve, reject })
        this.worker!.postMessage({ id, op, args, lang: agentLang() } satisfies KernelRequest)
      })
    // The other parts' kernels are gone with the old thread: the next `use` of each says it's empty.
    const cur = this.slots.get(this.slot) ?? newSlot()
    this.slots = new Map([[this.slot, cur]])
    await send("use", [this.slot])
    if (cur.assets.length) await send("setAssets", [cur.assets])
    if (cur.components.length) await send("setComponents", [cur.components])
    if (cur.context) await send("setContext", [cur.context])
    if (cur.lastTree) await send("rebuild", [cur.lastTree])
  }

  private get cur() {
    let s = this.slots.get(this.slot)
    if (!s) this.slots.set(this.slot, (s = newSlot()))
    return s
  }

  /** One kernel per part in the thread: true when this part's starts empty (the engine hands everything over again). */
  async use(slot: string) {
    const fresh = await this.call<boolean>("use", [slot])
    this.slot = slot
    if (fresh) this.slots.set(slot, newSlot())
    return fresh
  }

  /** A dependency change invalidates any in-flight result for this slot. */
  private cancelDiagnostics() {
    this.generations.set(this.slot, (this.generations.get(this.slot) ?? 0) + 1)
    const prior = this.diagnosticWorkers.get(this.slot)
    if (prior) { this.diagnosticWorkers.delete(this.slot); void prior.terminate() }
  }

  async preparePreview(file: string, tree: Tree, assets: ComponentSource["assets"], components: ComponentSource[], context: ContextSource | null, root: string | null = null) {
    if (!tree.features.some((f) => f.op === "component")) return
    this.previewRoots.set(file, root)
    const directory = await this.pool.directory
    if (!directory) return
    const key = assemblyKey([tree, assets ?? [], components, context])
    const display = await this.projectPreview.read(file, key, path.basename(directory), root)
    if (display) this.onPreview(display, file)
  }

  async setAssets(list: { name: string; bytes: Uint8Array | null; error?: string }[]) {
    this.cancelDiagnostics()
    this.cur.assets = list
    await this.call<void>("setAssets", [list])
  }

  /** An assembly's components and the context of a part edited inside one; kept for a replacement thread too. */
  async setComponents(list: ComponentSource[]) {
    this.cancelDiagnostics()
    const gen = Atomics.load(this.stopCount, 0)
    this.progress = { stage: "prepare", completed: 0, total: list.length }
    this.onPhase()
    const job = this.pool.prepare(list, (completed, total, label) => {
      if (gen !== Atomics.load(this.stopCount, 0)) return
      this.progress = { stage: "prepare", completed, total, label }
      this.onPhase()
    })
    this.building = job
    const prepared = await job.finally(() => this.building === job && (this.building = null))
    // Cancelled while the components were being built: the assembly isn't opened.
    if (gen !== Atomics.load(this.stopCount, 0)) throw new BuildStopped()
    this.cur.components = prepared
    await this.call<void>("setComponents", [prepared])
  }

  async setContext(ctx: ContextSource | null) {
    this.cancelDiagnostics()
    this.cur.context = ctx
    await this.call<void>("setContext", [ctx])
  }

  rebuild(tree: Tree, options: { background?: boolean } = {}) {
    const job = this.rebuildNow(tree, options)
    this.building = job
    void job.then(
      () => this.building === job && (this.building = null),
      () => this.building === job && (this.building = null),
    )
    return job
  }

  private async rebuildNow(tree: Tree, { background = false }: { background?: boolean } = {}) {
    const slot = this.slot
    const generation = (this.generations.get(slot) ?? 0) + 1
    this.generations.set(slot, generation)
    const prior = this.diagnosticWorkers.get(slot)
    if (prior) { void prior.terminate(); this.diagnosticWorkers.delete(slot) }
    try {
      const assembly = tree.features.some((f) => f.op === "component")
      const key = assembly ? assemblyKey([tree, this.cur.assets, this.cur.components, this.cur.context]) : null
      const cache = await this.cache
      const cached = key ? await cache?.get(key) : null
      this.preview = null
      if (cached) this.onPreview(cached.display, slot)
      const deferred = background && assembly
      const r = await this.call<BuildReport>("rebuild", [tree, { interferences: cached?.interferences, deferChecks: deferred }])
      if (process.env.TURNERY_PROFILE) process.stderr.write(`REBUILD ${slot} ${Math.round(r.ms)} ms${r.kept ? ` (${r.kept}/${tree.features.length} steps from the store)` : ""}\n`)
      this.cur.lastTree = tree
      if (key && this.preview && !r.paramError && r.features.every((f) => f.state !== "error" && f.state !== "skipped")) {
        const directory = await this.pool.directory
        if (directory && path.isAbsolute(slot)) {
          const write = this.projectPreview.write(slot, key, path.basename(directory), this.preview, this.previewRoots.get(slot))
          this.writes.add(write)
          void write.finally(() => this.writes.delete(write))
        }
      }
      if (key && this.preview && !r.checksPending && !r.paramError && r.features.every((f) => f.state !== "error" && f.state !== "skipped")) {
        await cache?.put(key, { display: this.preview, interferences: r.interferences })
      }
      if (deferred && key && this.preview) this.checkInBackground(slot, generation, tree, { ...this.cur }, this.preview, key, cache, r, cached?.interferences)
      return r
    } finally {
      this.progress = null
      this.onPhase()
    }
  }
  private checkInBackground(slot: string, generation: number, tree: Tree, source: Slot, display: DisplayData, key: string, cache: AssemblyCache | null, initial: BuildReport, known?: BuildReport["interferences"]) {
    const worker = new Worker(this.file, { stdout: true, stderr: true })
    this.diagnosticWorkers.set(slot, worker)
    worker.stdout.on("data", (b: Buffer) => process.stderr.write(b))
    worker.stderr.on("data", (b: Buffer) => process.stderr.write(b))
    const requests: [KernelRequest["op"], unknown[]][] = [["setAssets", [source.assets]], ["setComponents", [source.components]], ["setContext", [source.context]], ["rebuild", [tree, { interferences: known }]]]
    let index = 0
    let checkedDisplay: DisplayData | null = null
    const send = () => {
      const [op, args] = requests[index]
      worker.postMessage({ id: ++index, op, args, lang: agentLang() } satisfies KernelRequest)
    }
    const finish = () => { if (this.diagnosticWorkers.get(slot) === worker) this.diagnosticWorkers.delete(slot); void worker.terminate() }
    const fail = (message: string) => {
      if (this.generations.get(slot) === generation && !this.closed) this.onDiagnostics(slot, { ...initial, checksPending: false, checksError: message })
      finish()
    }
    worker.on("error", (e) => fail(e.message))
    worker.on("exit", (code) => { if (this.diagnosticWorkers.get(slot) === worker) fail(ta(`检查线程退出：${code}`, `The check thread exited: ${code}`)) })
    worker.on("message", async (m: KernelReply) => {
      if ("type" in m) {
        if (m.type === "ready") send()
        if (m.type === "preview") checkedDisplay = m.display
        if (m.type === "failed") fail(m.error)
        return
      }
      if (!m.ok) { fail(m.error); return }
      if (index < requests.length) { send(); return }
      if (this.generations.get(slot) !== generation || this.closed) { finish(); return }
      const report = m.result as BuildReport
      // Hashes are process-local. The same ordered topology maps check highlights
      // back to the interactive kernel; never publish another worker's hashes.
      const faces = new Map(checkedDisplay?.groups.map((g, i) => [g.hash, display.groups[i]?.hash]))
      const edges = new Map(checkedDisplay?.edgeGroups.map((g, i) => [g.hash, display.edgeGroups[i]?.hash]))
      report.checks?.forEach((c) => { c.faces = c.faces.flatMap((h) => faces.get(h) === undefined ? [] : [faces.get(h)!]); c.edges = c.edges.flatMap((h) => edges.get(h) === undefined ? [] : [edges.get(h)!]) })
      this.onDiagnostics(slot, report)
      finish()
      if (report.features.every((f) => f.state !== "error" && f.state !== "skipped")) await cache?.put(key, { display, interferences: report.interferences })
    })
  }

  /** Only colours changed: the thread takes the tree without rebuilding (false: rebuild instead). */
  async restyle(tree: Tree) {
    const ok = await this.call<boolean>("restyle", [tree])
    if (process.env.TURNERY_PROFILE) process.stderr.write(`RESTYLE ${this.slot} ${ok ? "ok" : "needs a rebuild"}\n`)
    if (ok) this.cur.lastTree = tree
    return ok
  }

  looks() {
    return this.call<{ name: string; look: Look; here?: Appearance }[]>("looks", [])
  }

  inspect(what: "body" | "faces" | "edges", selector?: unknown) {
    return this.call<string>("inspect", [what, selector])
  }
  display(index?: number) {
    return this.call<DisplayData>("display", [index])
  }
  pick(kind: "face" | "edge", hash: number, point: V3) {
    return this.call<PickInfo | null>("pick", [kind, hash, point])
  }
  locate(kind: "face" | "edge", selector: unknown, before?: number) {
    return this.call<number[] | null>("locate", [kind, selector, before])
  }
  selectorFor(kind: "face" | "edge", hashes: number[], before: number) {
    return this.call<{ selector: Record<string, unknown>; count: number } | null>("selectorFor", [kind, hashes, before])
  }
  faceEdges(hash: number, before: number) {
    return this.call<number[]>("faceEdges", [hash, before])
  }
  measure(targets: MeasureSpec[]) {
    return this.call<MeasureResult | null>("measure", [targets])
  }
  dimensions() {
    return this.call<Dim[]>("dimensions", [])
  }
  drawing(withIso: boolean) {
    return this.call<DrawingData | null>("drawing", [withIso])
  }
  exportBody(format: "step" | "stl" | "3mf", index?: number) {
    return this.call<Uint8Array | null>("exportBody", [format, index])
  }

  async dispose() {
    if (this.persistTimer) clearTimeout(this.persistTimer)
    this.persistTimer = null
    // What was built and not kept yet (a CLI command that ends at once): kept now, for a while at most.
    if (this.worker && this.unkept && !this.pending.size) {
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([this.call<number>("persist", [Infinity, true]).catch(() => 0), new Promise((r) => (timer = setTimeout(r, 5000)))])
      clearTimeout(timer)
    }
    this.closed = true
    await Promise.all(this.writes)
    await Promise.all([...this.diagnosticWorkers.values()].map((w) => w.terminate()))
    this.diagnosticWorkers.clear()
    await this.pool.dispose()
    const w = this.worker
    this.worker = null
    if (w) {
      w.removeAllListeners("exit")
      await w.terminate()
    }
  }
}
