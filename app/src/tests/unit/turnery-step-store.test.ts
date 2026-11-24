// Steps kept between sessions (kernel/build.ts, StepStore): a part built before comes back exactly as it
// was built, editing a late feature rebuilds only from there, and a rebuild can stop between features.
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { serialize, deserialize } from "node:v8"
import { beforeAll, describe, expect, it } from "vitest"
import { DiskStepStore } from "../../../../desktop/src/engine/step-store"
import { initNodeKernel } from "@/studio/kernel/node"
import { BuildStopped, Kernel, type BuildReport, type DisplayData, type StepStore } from "@/studio/kernel/build"
import type { Tree } from "@/studio/dsl"

/** Like the one on disk: every value goes through v8's serializer (typed arrays and all). */
function memStore() {
  const data = new Map<string, Buffer>()
  const stats = { gets: 0, hits: 0, puts: 0 }
  const store: StepStore = {
    get: (key) => {
      stats.gets++
      const b = data.get(key)
      if (b) stats.hits++
      return b ? deserialize(b) : null
    },
    put: (key, value) => {
      stats.puts++
      data.set(key, serialize(value))
    },
  }
  return { store, data, stats }
}

const TREE: Tree = {
  params: { w: 40, d: 30, h: 12 },
  features: [
    { id: "s1", op: "sketch", on: { plane: "XY" }, shapes: [{ type: "rect", w: "w", h: "d", r: 3 }] },
    { id: "body", op: "extrude", sketch: "s1", distance: "h" },
    { id: "s2", op: "sketch", on: { plane: "XY", offset: "h" }, shapes: [{ type: "circle", d: 10, center: [8, 0] }, { type: "circle", d: 6, center: [-10, 4] }] },
    { id: "pocket", op: "extrude", sketch: "s2", distance: 5, mode: "cut", direction: "reverse" },
    { id: "round", op: "fillet", edges: { of: "body", dir: "Z" }, r: 2 },
    { id: "s3", op: "sketch", on: { plane: "XZ" }, shapes: [{ type: "rect", w: 8, h: 4, center: [0, 6] }] },
    { id: "slot", op: "extrude", sketch: "s3", distance: 40, mode: "cut", symmetric: true },
  ],
  checks: [{ id: "c1", said: "40 × 30 × 12", type: "size", expect: [40, 30, 12] }],
} as unknown as Tree

/** A report without the times (a step brought back keeps the time it took to build). */
const plain = (r: BuildReport) => ({ ...r, ms: 0, kept: undefined, features: r.features.map((f) => ({ ...f, ms: 0 })), checks: r.checks?.map((c) => ({ ...c, faces: c.faces.length, edges: c.edges.length })) })
/**
 * What the window draws, without this process's hashes. The box to a micrometre: a body read back from its
 * B-rep and cut again can come out 1e-7 mm (OpenCascade's own tolerance) off the one never written out.
 */
const drawn = (d: DisplayData) => ({
  groups: d.groups.map((g) => [g.start, g.count, g.status, g.origin]),
  edges: d.edgeGroups.map((g) => [g.start, g.count]),
  triangles: d.mesh?.triangles.length,
  bbox: d.bbox?.map((p) => p.map((x) => Math.round(x * 1e6) / 1e6 + 0)),
})

beforeAll(async () => {
  await initNodeKernel()
})

describe("steps kept between sessions", () => {
  it("brings a part back exactly as it was built, without building a step", () => {
    const { store, stats } = memStore()
    const first = new Kernel(false, store)
    const built = first.rebuild(TREE)
    expect(built.features.every((f) => f.state === "ok")).toBe(true)
    const shown = first.display()
    expect(first.persist()).toBe(0)
    const kept = stats.puts
    expect(kept).toBeGreaterThanOrEqual(TREE.features.length)

    const again = new Kernel(false, store)
    const back = again.rebuild(TREE)
    expect(back.kept).toBe(TREE.features.length)
    expect(plain(back)).toEqual(plain(built))
    // Nothing was built: nothing new to keep.
    expect(again.persist()).toBe(0)
    expect(stats.puts).toBe(kept)
    const d = again.display()
    expect(drawn(d)).toEqual(drawn(shown))
    expect(again.dimensions()).toEqual(first.dimensions())
    // The hashes are this kernel's own: a face picked on the mesh is found, with where it came from.
    const g = d.groups.find((x) => x.origin === "pocket")!
    const v = d.mesh!.triangles[g.start] * 3
    const pick = again.pick({ kind: "face", hash: g.hash, point: [d.mesh!.vertices[v], d.mesh!.vertices[v + 1], d.mesh!.vertices[v + 2]] })
    expect(pick?.origins).toEqual(["pocket"])
    // An earlier step's body is read back when it is looked at.
    expect(drawn(again.display(1))).toEqual(drawn(first.display(1)))
    first.dispose()
    again.dispose()
  })

  it("rebuilds only from the feature that changed, to the same result as building it all", () => {
    const { store, stats } = memStore()
    const first = new Kernel(false, store)
    first.rebuild(TREE)
    first.persist()
    first.dispose()

    const edited = structuredClone(TREE)
    ;(edited.features[6] as { distance: number }).distance = 20
    const puts = stats.puts
    const k = new Kernel(false, store)
    const r = k.rebuild(edited)
    expect(r.kept).toBe(edited.features.length - 1)
    const fresh = new Kernel()
    expect(plain(r)).toEqual(plain(fresh.rebuild(edited)))
    expect(drawn(k.display())).toEqual(drawn(fresh.display()))
    // Only the edited feature was built (and its requirements measured), so only it is new to keep.
    k.persist()
    expect(stats.puts - puts).toBe(2)
    k.dispose()
    fresh.dispose()
  })

  it("keeps a part's steps apart by its parameters", () => {
    const { store } = memStore()
    const first = new Kernel(false, store)
    first.rebuild(TREE)
    first.persist()
    first.dispose()
    const wider = { ...TREE, params: { ...TREE.params, w: 50 } }
    const k = new Kernel(false, store)
    const r = k.rebuild(wider)
    expect(r.body?.size[0]).toBeCloseTo(50, 2)
    k.dispose()
  })

  it("builds what the store can't give back: unreadable entries, a store that fails", () => {
    const { store, data } = memStore()
    const first = new Kernel(false, store)
    const built = first.rebuild(TREE)
    first.persist()
    first.dispose()
    // Another part's record under each key, and a store that throws: both are misses.
    const records = [...data.values()]
    for (const [i, key] of [...data.keys()].entries()) data.set(key, records[(i + 3) % records.length])
    const k = new Kernel(false, store)
    expect(plain(k.rebuild(TREE)).features.map((f) => f.state)).toEqual(plain(built).features.map((f) => f.state))
    k.dispose()
    const broken = new Kernel(false, { get: () => { throw new Error("disk gone") }, put: () => { throw new Error("disk full") } })
    expect(plain(broken.rebuild(TREE))).toEqual(plain(built))
    expect(broken.persist()).toBe(0)
    broken.dispose()
  })

  it("frees a part brought back without reading the bodies it never used", () => {
    const { store } = memStore()
    const first = new Kernel(false, store)
    first.rebuild(TREE)
    first.persist()
    first.dispose()
    const k = new Kernel(false, store)
    k.rebuild(TREE)
    // Back to the first feature, then away: every kept body is let go, read or not.
    k.rebuild({ ...TREE, features: TREE.features.slice(0, 2) })
    expect(() => k.dispose()).not.toThrow()
  })
})

describe("stopping a rebuild", () => {
  it("stops between features, keeping what was built for the next rebuild", () => {
    const k = new Kernel()
    let asked = 0
    expect(() => k.rebuild(TREE, { stop: () => ++asked > 3 })).toThrow(BuildStopped)
    expect(asked).toBe(4)
    // Carries on from the fourth feature: the three built aren't built again.
    let progress = 0
    const r = k.rebuild(TREE, { progress: () => progress++ })
    expect(r.features.every((f) => f.state === "ok")).toBe(true)
    const whole = new Kernel()
    expect(plain(r)).toEqual(plain(whole.rebuild(TREE)))
    expect(progress).toBeGreaterThan(0)
    k.dispose()
    whole.dispose()
  })
})

describe("the store on disk", () => {
  it("reads back what it wrote, and treats a damaged or missing entry as a miss", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "turnery-steps-"))
    try {
      const store = new DiskStepStore(path.join(root, "build-a"))
      const value = { kind: "step", mesh: new Float32Array([1, 2, 3]), text: "x".repeat(10_000) }
      store.put("key one", value)
      expect(store.get("key one")).toEqual(value)
      expect(store.get("key two")).toBeNull()
      // Flip a byte of the payload: the checksum no longer matches.
      const [shard] = await readdir(path.join(root, "build-a"))
      const [name] = await readdir(path.join(root, "build-a", shard))
      const file = path.join(root, "build-a", shard, name)
      const bytes = await readFile(file)
      bytes[bytes.length - 1] ^= 0xff
      await writeFile(file, bytes)
      expect(store.get("key one")).toBeNull()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it("keeps the folder of every build under its limits, the least recently used going first", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "turnery-steps-"))
    try {
      const old = new DiskStepStore(path.join(root, "old-build"), root, { bytes: Infinity, files: 3 })
      for (const k of ["a", "b"]) old.put(k, { k })
      await old.flush()
      await new Promise((r) => setTimeout(r, 20))
      const now = new DiskStepStore(path.join(root, "new-build"), root, { bytes: Infinity, files: 3 })
      for (const k of ["c", "d"]) now.put(k, { k })
      await now.flush()
      await now.trim()
      // Four entries, room for three: the oldest build's oldest one goes.
      const left = ["a", "b"].map((k) => old.get(k)).concat(["c", "d"].map((k) => now.get(k)))
      expect(left.filter(Boolean)).toHaveLength(3)
      expect(now.get("c")).toEqual({ k: "c" })
      expect(now.get("d")).toEqual({ k: "d" })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
