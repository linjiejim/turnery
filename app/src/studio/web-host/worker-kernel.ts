// The desktop engine's kernel port (`KernelHost`) on the site's kernel Worker. One kernel, no slots:
// the engine hands a part's files over again whenever it switches parts. A Worker that outgrows its
// heap is replaced by KernelClient, which hands the last files and tree to the new one.
import type { KernelHost } from "@/desktop/core/engine"
import type { KernelPhase } from "@/desktop/core/protocol"
import type { KernelClient } from "../client"
import type { Tree } from "../dsl"
import type { BuildReport, ComponentSource, ContextSource } from "../kernel/build"
import type { MeasureSpec } from "../kernel/measure"

type V3 = [number, number, number]

export class WorkerKernelHost implements KernelHost {
  phase: KernelPhase = { phase: "loading" }
  /** Megabytes of the kernel's wasm downloaded so far (the page shows it while the kernel loads). */
  loadedMB = 0
  private readonly c: KernelClient
  private listeners = new Set<() => void>()

  constructor(client: KernelClient) {
    this.c = client
    client.onProgress = (mb) => {
      this.loadedMB = mb
      this.changed()
    }
    client.ready.then(
      () => {
        this.phase = { phase: "ready" }
        this.changed()
      },
      (e: unknown) => {
        this.phase = { phase: "error", message: String((e as Error)?.message ?? e) }
        this.changed()
      },
    )
  }

  /** Called when the phase or the download progress changes. */
  onChange(cb: () => void) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }

  private changed() {
    for (const cb of this.listeners) cb()
  }

  private async ready() {
    await this.c.ready
    return this.c
  }

  async rebuild(tree: Tree, options: { background?: boolean; interferences?: BuildReport["interferences"]; deferChecks?: boolean } = {}) {
    return (await this.ready()).rebuild(tree, { interferences: options.interferences, deferChecks: options.deferChecks })
  }
  async restyle(tree: Tree) {
    return (await this.ready()).restyle(tree)
  }
  async looks() {
    return (await this.ready()).looks()
  }
  async inspect(what: "body" | "faces" | "edges", selector?: unknown) {
    return (await this.ready()).inspect(what, selector)
  }
  async display(index?: number) {
    return (await this.ready()).display(index)
  }
  async pick(kind: "face" | "edge", hash: number, point: V3) {
    return (await this.ready()).pick(kind, hash, point)
  }
  async locate(kind: "face" | "edge", selector: unknown, before?: number) {
    return (await this.ready()).locate(kind, selector, before)
  }
  async selectorFor(kind: "face" | "edge", hashes: number[], before: number) {
    return (await this.ready()).selectorFor(kind, hashes, before)
  }
  async faceEdges(hash: number, before: number) {
    return (await this.ready()).faceEdges(hash, before)
  }
  async measure(targets: MeasureSpec[]) {
    return (await this.ready()).measure(targets)
  }
  async dimensions() {
    return (await this.ready()).dimensions()
  }
  async drawing(withIso: boolean) {
    return (await this.ready()).drawing(withIso)
  }
  async exportBody(format: "step" | "stl" | "3mf", index?: number) {
    const blob = await (await this.ready()).exportBody(format, index)
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null
  }
  async setAssets(list: { name: string; bytes: Uint8Array | null; error?: string }[]) {
    await (await this.ready()).setAssets(list)
  }
  async setComponents(list: ComponentSource[]) {
    await (await this.ready()).setComponents(list)
  }
  async setContext(ctx: ContextSource | null) {
    await (await this.ready()).setContext(ctx)
  }

  dispose() {
    this.c.dispose()
    this.listeners.clear()
  }
}
