// The OpenCascade kernel in its own worker thread, so a long rebuild never
// blocks the engine, and the wasm heap (which only grows) can be thrown away
// by ending the thread.
import { parentPort, workerData } from "node:worker_threads"
import { DirectKernel, wasmHeapMB } from "../../../app/src/desktop/core/direct-kernel"
import { initNodeKernel } from "../../../app/src/studio/kernel/node"
import { BuildStopped, compileComponent, type BuildProgress, type DisplayData } from "../../../app/src/studio/kernel/build"
import { setAgentLang, type AgentLang } from "../../../app/src/lib/agent-lang"
import { DiskStepStore } from "./step-store"

export type KernelRequest = {
  id: number
  op: "compileComponent" | "use" | "setAssets" | "setComponents" | "setContext" | "rebuild" | "restyle" | "looks" | "inspect" | "display" | "pick" | "locate" | "selectorFor" | "faceEdges" | "measure" | "dimensions" | "drawing" | "exportBody" | "persist"
  args: unknown[]
  /** The language the kernel's messages are written in, as the engine has it now: the thread kept the one it started with otherwise. */
  lang?: AgentLang
  /** The host's stop count when it sent this: a rebuild stops between features once the count moves on (see `stop`). */
  gen?: number
}
export type KernelReply =
  | { id: number; ok: true; result: unknown; heapMB: number }
  | { id: number; ok: false; error: string; stopped?: boolean }
  | { type: "ready" }
  | { type: "failed"; error: string }
  | { type: "progress"; progress: BuildProgress; gen?: number }
  | { type: "preview"; display: DisplayData; gen?: number }

/**
 * What the host hands a thread when it starts it. `steps`: the folder to keep built steps in (the main
 * kernel thread only). `stop`: one Int32 the host bumps to stop the rebuild under way.
 */
export type KernelThreadData = { steps?: string; stop?: SharedArrayBuffer }

const port = parentPort!
const post = (m: KernelReply, transfer: ArrayBuffer[] = []) => port.postMessage(m, transfer)
const data = (workerData ?? {}) as KernelThreadData
const stopCount = data.stop ? new Int32Array(data.stop) : null
/** The stop count of the request being worked on. */
let gen = 0

const store = data.steps ? DiskStepStore.open(data.steps) : null
const ready = initNodeKernel().then(
  () =>
    new DirectKernel(
      {
        progress: (progress) => post({ type: "progress", progress, gen }),
        preview: (display) => post({ type: "preview", display, gen }),
        stop: () => stopCount !== null && Atomics.load(stopCount, 0) !== gen,
      },
      store,
    ),
)
ready.then(
  () => post({ type: "ready" }),
  (e) => post({ type: "failed", error: String((e as Error)?.message ?? e) }),
)

port.on("message", async (req: KernelRequest) => {
  if (req.lang) setAgentLang(req.lang)
  try {
    const k = await ready
    gen = req.gen ?? (stopCount ? Atomics.load(stopCount, 0) : 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = req.op === "compileComponent" ? compileComponent(req.args[0] as Parameters<typeof compileComponent>[0]) : await (k as any)[req.op](...req.args)
    const transfer: ArrayBuffer[] = []
    if (req.op === "display" && result) {
      const d = result as { mesh: { vertices: Float32Array; normals: Float32Array; triangles: Uint32Array } | null; edges: Float32Array | null; sketch: Float32Array | null }
      if (d.mesh) transfer.push(d.mesh.vertices.buffer as ArrayBuffer, d.mesh.normals.buffer as ArrayBuffer, d.mesh.triangles.buffer as ArrayBuffer)
      if (d.edges) transfer.push(d.edges.buffer as ArrayBuffer)
      if (d.sketch) transfer.push(d.sketch.buffer as ArrayBuffer)
    }
    if (req.op === "exportBody" && result) transfer.push((result as Uint8Array).buffer as ArrayBuffer)
    // Waits for what `persist` wrote, so a host about to end the thread loses nothing.
    if (req.op === "persist" && req.args[1] === true) await store?.flush()
    post({ id: req.id, ok: true, result, heapMB: wasmHeapMB() }, transfer)
  } catch (e) {
    post({ id: req.id, ok: false, error: String((e as Error)?.message ?? e), ...(e instanceof BuildStopped ? { stopped: true } : {}) })
  }
})
