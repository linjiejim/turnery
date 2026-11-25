import { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { describe, expect, it } from "vitest"
import { ComponentCache, ComponentPool, sourceKey } from "../../../../desktop/src/engine/component-pool"
import { AssemblyCache, assemblyKey } from "../../../../desktop/src/engine/assembly-cache"
import { DAY_MS, trimCacheRoot } from "../../../../desktop/src/engine/cache-trim"

describe("desktop content caches", () => {
  it("disables caching when a worker build cannot be fingerprinted without rejecting at startup", async () => {
    const pool = new ComponentPool(new URL("file:///does-not-exist/turnery-kernel.mjs"))
    expect(await pool.directory).toBeNull()
    expect(await pool.prepare([], () => {})).toEqual([])
    await pool.dispose()
  })

  it("invalidates geometry for params, nested dependencies, STEP bytes and placements, ignoring derived compiled data", () => {
    const source = { file: "part.turnery.json", tree: { params: { L: 10 }, features: [{ at: [0, 0, 0] }] }, components: [{ tree: { params: { D: 2 } }, bytes: new Uint8Array([1, 2]) }] }
    const key = assemblyKey(source)
    expect(assemblyKey({ ...source, compiled: { parts: [], failed: 0 } })).toBe(key)
    for (const mutate of [
      (s: typeof source) => { s.tree.params.L = 11 },
      (s: typeof source) => { s.tree.features[0].at[0] = 1 },
      (s: typeof source) => { s.components[0].tree.params.D = 3 },
      (s: typeof source) => { s.components[0].bytes[1] = 3 },
    ]) {
      const changed = structuredClone(source)
      mutate(changed)
      expect(assemblyKey(changed)).not.toBe(key)
    }
  })

  it("keys a vendor's STEP by a hash of its bytes, not by spelling them out", () => {
    // 16 MB, the size of a display board's model: as JSON it was 16 million entries, seconds per key.
    const bytes = new Uint8Array(16 * 1024 * 1024).map((_, i) => i * 7)
    const source = { file: "board.step", bytes }
    const started = performance.now()
    const key = sourceKey(source)
    expect(performance.now() - started).toBeLessThan(1000)
    expect(assemblyKey([source])).toBe(assemblyKey([{ file: "board.step", bytes: bytes.slice() }]))
    const changed = bytes.slice()
    changed[changed.length - 1] ^= 1
    expect(sourceKey({ file: "board.step", bytes: changed })).not.toBe(key)
    // The same bytes as another kind of array (a mesh) are another thing.
    expect(assemblyKey([{ data: new Float32Array(bytes.buffer, 0, 4) }])).not.toBe(assemblyKey([{ data: new Uint32Array(bytes.buffer, 0, 4) }]))
  })

  it("retains user parameters named compiled while stripping native payloads on nested sources", () => {
    const source = { file: "part.turnery.json", tree: { params: { compiled: 10 }, features: [] }, compiled: { parts: [], failed: 0 } }
    const changed = { ...source, tree: { ...source.tree, params: { compiled: 20 } } }
    expect(sourceKey(source)).not.toBe(sourceKey(changed))
    expect(assemblyKey([source])).not.toBe(assemblyKey([changed]))
    const nested = { file: "assembly.turnery-asm.json", components: [source] }
    expect(sourceKey(nested)).not.toBe(sourceKey({ ...nested, components: [changed] }))
    expect(assemblyKey(nested)).toBe(assemblyKey({ ...nested, components: [{ ...source, compiled: { parts: [{ name: null, brep: "different derived payload" }], failed: 0 } }] }))
  })

  it("round-trips native data and typed previews; corruption becomes a cache miss", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "turnery-cache-test-"))
    try {
      const key = "a".repeat(64)
      const cache = new ComponentCache(dir)
      const native = { parts: [{ name: null, brep: "native data" }], failed: 0 }
      await cache.put(key, native)
      expect(await cache.get(key)).toEqual(native)
      await writeFile(path.join(dir, `${key}.json`), '{"data":"truncated"}')
      expect(await cache.get(key)).toBeNull()
      const preview = new AssemblyCache(dir)
      const data = { display: { index: 0, mesh: { vertices: new Float32Array([1, 2, 3]), normals: new Float32Array([0, 0, 1]), triangles: new Uint32Array([0]) }, groups: [], edges: null, edgeGroups: [], sketch: null, bbox: null, threads: [] }, interferences: [] }
      await preview.put(key, data)
      expect(await preview.get(key)).toEqual(data)
      await writeFile(path.join(dir, `${key}.json`), "broken")
      expect(await preview.get(key)).toBeNull()
      expect((await readdir(dir)).some((f) => f.endsWith(".tmp"))).toBe(false)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})

describe("cache folders across builds", () => {
  const NOW = Date.UTC(2026, 10, 25)
  /** A file of `size` bytes last used `ago` ms before NOW. */
  const entry = async (file: string, ago: number, size = 100) => {
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, Buffer.alloc(size))
    const at = new Date(NOW - ago)
    await utimes(file, at, at)
  }
  const exists = (file: string) => stat(file).then(() => true, () => false)
  const withRoot = async (fn: (root: string) => Promise<void>) => {
    const root = await mkdtemp(path.join(tmpdir(), "turnery-trim-"))
    try { await fn(root) } finally { await rm(root, { recursive: true, force: true }) }
  }

  it("clears what an update left behind: other builds' entries unused for two weeks, and their folders", () =>
    withRoot(async (root) => {
      const at = (...p: string[]) => path.join(root, ...p)
      await entry(at("old", "a.json"), 20 * DAY_MS)
      await entry(at("old", "assemblies", "b.json"), 20 * DAY_MS)
      await entry(at("older", "x.json"), 30 * DAY_MS)
      await entry(at("older", "x.json.123.tmp"), 2 * 3_600_000)
      await entry(at("recent", "c.json"), 1 * DAY_MS)
      // This build's entries never go stale, and its folders stay even when empty (it may be writing there).
      await entry(at("cur", "e.json"), 40 * DAY_MS)
      await entry(at("cur", "e.json.456.tmp"), 60_000)
      await mkdir(at("cur", "assemblies"))
      await writeFile(at("notes.txt"), "not a build")
      await trimCacheRoot(root, "cur", { bytes: Infinity, files: 100, staleMs: 14 * DAY_MS }, NOW)
      expect((await readdir(root)).sort()).toEqual(["cur", "notes.txt", "recent"])
      expect(await exists(at("recent", "c.json"))).toBe(true)
      expect(await exists(at("cur", "e.json"))).toBe(true)
      expect(await exists(at("cur", "e.json.456.tmp"))).toBe(true)
      expect(await exists(at("cur", "assemblies"))).toBe(true)
    }))

  it("keeps every build's folder together under the limits, the least recently used going first", () =>
    withRoot(async (root) => {
      const at = (...p: string[]) => path.join(root, ...p)
      await entry(at("cur", "f.json"), 0)
      await entry(at("other", "c.json"), 1 * DAY_MS)
      await entry(at("cur", "assemblies", "d.json"), 2 * DAY_MS)
      await entry(at("third", "e.json"), 3 * DAY_MS)
      // Room for 250 bytes: the two used last stay, whichever build they belong to.
      await trimCacheRoot(root, "cur", { bytes: 250, files: 100 }, NOW)
      expect(await exists(at("cur", "f.json"))).toBe(true)
      expect(await exists(at("other", "c.json"))).toBe(true)
      expect(await exists(at("cur", "assemblies", "d.json"))).toBe(false)
      expect(await exists(at("cur", "assemblies"))).toBe(true)
      expect(await exists(at("third"))).toBe(false)
      await trimCacheRoot(root, "cur", { bytes: Infinity, files: 1 }, NOW)
      expect((await readdir(root)).sort()).toEqual(["cur"])
      expect(await exists(at("cur", "f.json"))).toBe(true)
      // No root yet: nothing to do, and no error.
      await trimCacheRoot(at("missing"), "cur", { bytes: 0, files: 0 }, NOW)
    }))

  it("counts reading an entry as using it", () =>
    withRoot(async (root) => {
      const key = "b".repeat(64)
      const file = path.join(root, `${key}.json`)
      const components = new ComponentCache(root)
      await components.put(key, { parts: [{ name: null, brep: "native data" }], failed: 0 })
      const previews = new AssemblyCache(path.join(root, "assemblies"))
      const mesh = { vertices: new Float32Array([1, 2, 3]), normals: new Float32Array([0, 0, 1]), triangles: new Uint32Array([0]) }
      await previews.put(key, { display: { index: 0, mesh, groups: [], edges: null, edgeGroups: [], sketch: null, bbox: null, threads: [] } as never, interferences: [] })
      const preview = path.join(root, "assemblies", `${key}.json`)
      for (const f of [file, preview]) await utimes(f, new Date(NOW - 30 * DAY_MS), new Date(NOW - 30 * DAY_MS))
      expect(await components.get(key)).not.toBeNull()
      expect(await previews.get(key)).not.toBeNull()
      // The touch is fire-and-forget.
      await new Promise((r) => setTimeout(r, 50))
      for (const f of [file, preview]) expect(Date.now() - (await stat(f)).mtimeMs).toBeLessThan(60_000)
    }))

  it("trims the other builds' folders after preparing an assembly", () =>
    withRoot(async (dir) => {
      await mkdir(path.join(dir, "dist"))
      await mkdir(path.join(dir, "vendor", "opencascade"), { recursive: true })
      await writeFile(path.join(dir, "dist", "kernel.mjs"), "// a build")
      await writeFile(path.join(dir, "vendor", "opencascade", "replicad_single.wasm"), "wasm")
      const root = path.join(dir, "cache", "components")
      await entry(path.join(root, "an-old-build", "a.json"), 30 * DAY_MS)
      await entry(path.join(root, "an-old-build", "assemblies", "b.json"), 30 * DAY_MS)
      const pool = new ComponentPool(pathToFileURL(path.join(dir, "dist", "kernel.mjs")), root)
      try {
        const own = await pool.directory
        expect(path.dirname(own!)).toBe(root)
        expect(await pool.prepare([], () => {})).toEqual([])
        // Started by prepare without waiting; the same run is handed back here.
        await pool.trimAll()
        expect(await readdir(root)).toEqual([])
      } finally { await pool.dispose() }
    }))
})
