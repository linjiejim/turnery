// The workbench page's engine: started when the page mounts, on the files kept in this browser,
// reachable by the desktop window's components through `turnery` while the page is open.
import * as React from "react"
import { installBridge } from "@/desktop/bridge"
import { useDesktopStudio, useEngine } from "@/desktop/use-desktop"
import type { Check } from "../dsl"
import { takeKernel } from "../boot"
import { withPinned } from "../pinned"
import type { KernelState, Studio } from "../studio"
import { ta } from "@/lib/agent-lang"
import { WebHost, webBridge } from "./web-host"

export type HostState = { host: WebHost | null; error: string | null; booted: boolean }

/**
 * Another tab of this site has the workbench open too. Each keeps its own copy of the files, so the
 * last one to save a file wins: the page says so, instead of losing a change quietly.
 */
export function useOtherTab() {
  const [other, setOther] = React.useState(false)
  React.useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return
    const channel = new BroadcastChannel("turnery-workbench")
    channel.onmessage = (e: MessageEvent<string>) => {
      if (e.data === "hello") channel.postMessage("here")
      if (e.data === "hello" || e.data === "here") setOther(true)
      if (e.data === "bye") setOther(false)
    }
    channel.postMessage("hello")
    return () => {
      channel.postMessage("bye")
      channel.close()
    }
  }, [])
  return other
}

/** Start the engine (once per mount), open the project the person had open last. */
export function useWebHost(): HostState {
  const [state, setState] = React.useState<HostState>({ host: null, error: null, booted: false })
  React.useEffect(() => {
    const life = { alive: true }
    let started: WebHost | null = null
    const client = takeKernel()
    WebHost.start(client)
      .then((host) => {
        if (!life.alive) return host.dispose()
        started = host
        installBridge(webBridge(host))
        setState({ host, error: null, booted: false })
        return host.boot().then(() => life.alive && setState({ host, error: null, booted: true }))
      })
      .catch((e: unknown) => life.alive && setState((s) => ({ ...s, error: String((e as Error)?.message ?? e) })))
    return () => {
      life.alive = false
      installBridge(null)
      if (started) started.dispose()
      else client.dispose()
    }
  }, [])
  return state
}

/**
 * The open file as the site's components take it (`Studio`): the desktop window's adapter on the
 * engine, plus what the site adds: the kernel's download progress and a practice's fixed requirements.
 */
export function useWebStudio(host: WebHost) {
  const engine = useEngine()
  const base = useDesktopStudio(engine.doc, engine.snapshot)
  const path = engine.doc?.path ?? null

  // The kernel's wasm download, for the progress the view shows while it loads.
  const [loadedMB, setLoadedMB] = React.useState(0)
  React.useEffect(() => host.kernel.onChange?.(() => setLoadedMB((host.kernel as { loadedMB?: number }).loadedMB ?? 0)), [host])
  const kernel: KernelState = base.kernel.phase === "loading" ? { phase: "loading", loadedMB } : base.kernel

  // A practice's requirements stay as given: put back after any change that dropped or edited them.
  const pinned = React.useRef<Check[] | null>(null)
  const restore = React.useCallback(async () => {
    const doc = host.engine.docState()
    if (!doc || doc.kind !== "part" || doc.shared) return null
    const tree = withPinned(doc.tree, pinned.current)
    if (tree === doc.tree) return null
    const r = await host.call("set_tree", { tree }, doc.path)
    return r.ok ? (host.engine.docState()?.report ?? null) : null
  }, [host])
  const pinChecks = React.useCallback(
    (checks: Check[] | null) => {
      pinned.current = checks
      if (checks) void restore()
    },
    [restore],
  )

  const { editTree: baseEdit } = base
  const editTree = React.useCallback<Studio["editTree"]>((change, opts) => baseEdit((t) => withPinned(change(t), pinned.current), opts), [baseEdit])

  const load = React.useCallback(
    async (tree: Parameters<Studio["load"]>[0], name?: string) => {
      await host.loadTree(withPinned(tree, pinned.current), name ?? ta("零件", "Part"))
      return null
    },
    [host],
  )

  const exportBody = base.exportBody
  const studio: Studio = { ...base, kernel, editTree, load, pinChecks, exportBody }
  return { ...engine, studio, path }
}
