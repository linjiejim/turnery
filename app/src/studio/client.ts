import { workerName } from "../lib/agent-lang"
import type { MeasureResult, MeasureSpec } from "./kernel/measure"
import type { KernelPort } from "./apply"
import type { Tree } from "./dsl"
import type { PickInfo } from "./annotations"
import type { BuildReport, ComponentSource, ContextSource, DisplayData } from "./kernel/build"
import type { Dim } from "./kernel/dims"
import type { DrawingData } from "./kernel/drawing"
import type { AssetSource, RebuildOptions, WorkerMessage, WorkerRequest } from "./worker"
import type { Look, Appearance } from "./appearance"

// Distributive Omit, so each request variant keeps its own fields.
type Payload<T> = T extends unknown ? Omit<T, "id"> : never

/** The OCCT wasm heap only grows; past this, restart the worker and rebuild. */
const RECYCLE_MB = 1400

/** Promise-based handle on the kernel worker. */
export class KernelClient implements KernelPort {
  private worker!: Worker
  private seq = 0
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private lastTree: Tree | null = null
  /** What the kernel was handed besides the tree (files, components, context): handed again to a new worker. */
  private sources: { assets: AssetSource[] | null; components: ComponentSource[] | null; context: ContextSource | null } = { assets: null, components: null, context: null }
  ready!: Promise<void>
  onProgress?: (loadedMB: number) => void

  constructor() {
    this.spawn()
  }

  private spawn() {
    // Its name carries the language its messages are written in (lib/agent-lang.ts).
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module", name: workerName("turnery-kernel") })
    this.worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const m = e.data
      if ("type" in m) return this.onProgress?.(m.loadedMB)
      const p = this.pending.get(m.id)
      if (!p) return
      this.pending.delete(m.id)
      if (m.ok) p.resolve(m.result)
      else p.reject(new Error(m.error))
      if (m.ok && m.heapMB > RECYCLE_MB) queueMicrotask(() => this.recycle())
    }
    this.worker.onerror = (e) => {
      for (const p of this.pending.values()) p.reject(new Error(e.message || "建模内核崩溃了"))
      this.pending.clear()
    }
    this.ready = this.call("init", { type: "init" }).then(() => undefined)
  }

  private call<T>(_label: string, req: Payload<WorkerRequest>): Promise<T> {
    const id = ++this.seq
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      this.worker.postMessage({ ...req, id })
    })
  }

  async rebuild(tree: Tree, options?: RebuildOptions): Promise<BuildReport> {
    this.lastTree = tree
    return this.call("rebuild", { type: "rebuild", tree, options })
  }

  /** Only colours or finishes changed: true when the kernel took the tree without rebuilding. */
  async restyle(tree: Tree): Promise<boolean> {
    const ok = await this.call<boolean>("restyle", { type: "restyle", tree })
    if (ok) this.lastTree = tree
    return ok
  }

  looks(): Promise<{ name: string; look: Look; here?: Appearance }[]> {
    return this.call("looks", { type: "looks" })
  }

  /** The files `import` features read. */
  setAssets(list: AssetSource[]): Promise<void> {
    this.sources.assets = list
    return this.call("setAssets", { type: "setAssets", list })
  }

  /** What an assembly's components read. */
  setComponents(list: ComponentSource[]): Promise<void> {
    this.sources.components = list
    return this.call("setComponents", { type: "setComponents", list })
  }

  /** Editing a part inside an assembly: the parts around it. */
  setContext(ctx: ContextSource | null): Promise<void> {
    this.sources.context = ctx
    return this.call("setContext", { type: "setContext", ctx })
  }

  display(index?: number): Promise<DisplayData> {
    return this.call("display", { type: "display", index })
  }

  inspect(what: "body" | "faces" | "edges", selector?: unknown): Promise<string> {
    return this.call("inspect", { type: "inspect", what, selector })
  }

  pick(kind: "face" | "edge", hash: number, point: [number, number, number]): Promise<PickInfo | null> {
    return this.call("pick", { type: "pick", kind, hash, point })
  }

  locate(kind: "face" | "edge", selector: unknown, before?: number): Promise<number[] | null> {
    return this.call("locate", { type: "locate", kind, selector, before })
  }

  selectorFor(kind: "face" | "edge", hashes: number[], before: number): Promise<{ selector: Record<string, unknown>; count: number } | null> {
    return this.call("selectorFor", { type: "selectorFor", kind, hashes, before })
  }

  faceEdges(hash: number, before: number): Promise<number[]> {
    return this.call("faceEdges", { type: "faceEdges", hash, before })
  }

  measure(targets: MeasureSpec[]): Promise<MeasureResult | null> {
    return this.call("measure", { type: "measure", targets })
  }

  dimensions(): Promise<Dim[]> {
    return this.call("dimensions", { type: "dimensions" })
  }

  drawing(iso: boolean): Promise<DrawingData | null> {
    return this.call("drawing", { type: "drawing", iso })
  }

  exportBody(format: "step" | "stl" | "3mf", index?: number): Promise<Blob | null> {
    return this.call("export", { type: "export", format, index })
  }

  private async recycle() {
    if (this.pending.size) return
    this.worker.terminate()
    this.spawn()
    await this.ready
    // The new worker starts empty: everything the last build read goes over again before it.
    const { assets, components, context } = this.sources
    if (assets) await this.setAssets(assets)
    if (components) await this.setComponents(components)
    if (context) await this.setContext(context)
    if (this.lastTree) await this.rebuild(this.lastTree)
  }

  dispose() {
    this.worker.terminate()
    this.pending.clear()
  }
}
