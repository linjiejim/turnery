// A vendor's board model in an assembly: one STEP of hundreds of solids. As one
// compound a single boolean against its enclosure ran for many minutes and a
// round of checks ran the wasm heap out (kernel/pieces.ts). These boards are
// generated here, a few hundred solids small, and the tests count the exact
// OpenCascade work, which is what grew without bound, rather than time it.
import { afterEach, beforeAll, describe, expect, it } from "vitest"
import { exportSTEP, getOC, makeBaseBox, makeCompound, measureShapeVolumeProperties, type Shape3D } from "replicad"
import { checkText } from "@/studio/apply"
import type { Tree } from "@/studio/dsl"
import { Kernel, compileComponent, type ComponentSource } from "@/studio/kernel/build"
import { initNodeKernel } from "@/studio/kernel/node"
import { MAX_BOOLEANS } from "@/studio/kernel/pieces"

beforeAll(async () => {
  await initNodeKernel()
}, 60_000)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any
type V3 = [number, number, number]

/** Counts OpenCascade's booleans and distance solvers while a test runs. */
const counted: { name: string; original: unknown }[] = []
function count(name: "BRepAlgoAPI_Common" | "BRepExtrema_DistShapeShape" | "ReplicadMeshExtractor") {
  const oc: OC = getOC()
  const original = oc[name]
  const tally = { calls: 0, faces: [] as number[] }
  if (name === "ReplicadMeshExtractor") {
    oc[name] = { extract: (shape: { ShapeType(): unknown }, ...rest: unknown[]) => { tally.faces.push(faceCount(shape)); return original.extract(shape, ...rest) } }
  } else {
    oc[name] = function (...args: unknown[]) {
      tally.calls++
      return new original(...args)
    }
  }
  counted.push({ name, original })
  return tally
}
afterEach(() => {
  const oc: OC = getOC()
  for (const { name, original } of counted.splice(0)) oc[name] = original
})

function faceCount(shape: unknown) {
  const oc: OC = getOC()
  const ex = new oc.TopExp_Explorer(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE)
  let n = 0
  for (; ex.More(); ex.Next()) n++
  ex.delete()
  return n
}

/** A box `w × d × h` with its bottom centre at `at`. */
const block = (w: number, d: number, h: number, at: V3) => makeBaseBox(w, d, h).translate(at) as Shape3D

async function stepOf(shapes: Shape3D[]) {
  const shape = shapes.length === 1 ? shapes[0] : (makeCompound(shapes) as unknown as Shape3D)
  const blob = exportSTEP([{ shape, name: "vendor" }])
  return new Uint8Array(await blob.arrayBuffer())
}

/** An open-topped case 60 × 50 × 20: walls 4 thick, floor 2 thick (cavity x ±26, y ±21, z 2–20). */
async function caseStep() {
  return stepOf([makeBaseBox(60, 50, 20).cut(makeBaseBox(52, 42, 18).translate([0, 0, 2])) as Shape3D])
}

/** A board 40 × 30 at z 4–5.6 with `rows × cols` parts on it (2 × 2 × 2 at a 3.6 pitch), plus whatever else. */
async function boardStep(extra: Shape3D[] = [], rows = 8, cols = 10) {
  const parts = [block(40, 30, 1.6, [0, 0, 4])]
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) parts.push(block(2, 2, 2, [-16.2 + 3.6 * i, -12.6 + 3.6 * j, 5.6]))
  return stepOf([...parts, ...extra])
}

function assembly(board: Uint8Array, shell: Uint8Array, checks: Tree["checks"], rotate: { axis: "X"; angle: number }[] = []) {
  const k = new Kernel()
  const sources: ComponentSource[] = [
    { file: "vendor/board.step", bytes: board },
    { file: "case.step", bytes: shell },
  ]
  k.setComponents(sources)
  const tree: Tree = {
    params: {},
    features: [
      { id: "board", op: "component", name: "板", file: "vendor/board.step", rotate },
      { id: "case", op: "component", name: "壳", file: "case.step", rotate },
    ],
    checks,
  }
  return { k, tree }
}

const CHECKS: Tree["checks"] = [
  { id: "free", said: "壳不碰板", kind: "interference", ref: "壳" },
  { id: "room", said: "板离壳至少 1.5", kind: "clearance", ref: "板", min: 1.5 },
  { id: "gap", said: "板和壳之间", kind: "gap", a: { part: "板" }, b: { part: "壳" }, min: 1 },
]

describe("a many-solid vendor board against its case", () => {
  it("measures a board inside its case with a handful of exact tests, not one per solid", async () => {
    const { k, tree } = assembly(await boardStep(), await caseStep(), CHECKS)
    const booleans = count("BRepAlgoAPI_Common")
    const distances = count("BRepExtrema_DistShapeShape")
    const rep = k.rebuild(tree)
    expect(rep.features.map((f) => f.state)).toEqual(["ok", "ok"])
    expect(rep.features[1].warnings).toBeUndefined()
    expect(rep.interferences).toEqual([{ feature: "case", a: "壳", b: "板", volume: 0 }])
    // The board's underside is the nearest place: 2 mm above the floor.
    expect(rep.checks?.map((c) => [c.id, c.pass, c.actual])).toEqual([
      ["free", true, "最小间隙 2 mm"],
      ["room", true, "最小间隙 2 mm"],
      ["gap", true, "2 mm"],
    ])
    // 81 solids in a case's box: one point classified for the lot, booleans only where one may cross a
    // face (none), distances only for the few nearest (9 for all three checks when written).
    expect(booleans.calls).toBe(0)
    expect(distances.calls).toBeLessThan(20)
    k.dispose()
  })

  it("finds the overlap of a part crossing the wall and of one buried in the floor, as one compound boolean would", async () => {
    // 4 × 4 × 4 across the inner wall at x = 26 (2 × 4 × 4 in it), 2 × 2 × 1 inside the floor.
    const extra = () => [block(4, 4, 4, [26, 0, 8]), block(2, 2, 1, [0, 0, 0.5])]
    const shell = await caseStep()
    const { k, tree } = assembly(await boardStep(extra()), shell, CHECKS)
    const booleans = count("BRepAlgoAPI_Common")
    const rep = k.rebuild(tree)
    expect(rep.features[1].warnings).toEqual(["「壳」和「板」重叠 36 mm³"])
    expect(rep.checks?.map((c) => [c.id, c.pass, c.actual])).toEqual([
      ["free", false, "相交 36 mm³"],
      ["room", false, "相交 36 mm³"],
      ["gap", false, "相交 36 mm³"],
    ])
    // The buried block is decided by one point, not a boolean. The crossing one takes one boolean in the
    // build's overlap diagnostics and one shared by all three checks.
    expect(booleans.calls).toBe(2)
    // The same answer from the old way: one boolean against the whole board as a compound.
    const caseBody = makeBaseBox(60, 50, 20).cut(makeBaseBox(52, 42, 18).translate([0, 0, 2])) as Shape3D
    const board = makeCompound([block(40, 30, 1.6, [0, 0, 4]), ...extra()]) as unknown as Shape3D
    expect(measureShapeVolumeProperties(caseBody.intersect(board)).volume).toBeCloseTo(36, 6)
    k.dispose()
  })

  it("tells contact from overlap: a cover plate resting on the rim touches, it doesn't intersect", async () => {
    const cover = block(56, 46, 1, [0, 0, 20])
    const { k, tree } = assembly(await boardStep([cover]), await caseStep(), CHECKS)
    const rep = k.rebuild(tree)
    expect(rep.checks?.map((c) => [c.id, c.pass, c.actual])).toEqual([
      ["free", true, "贴在一起"],
      ["room", false, "贴在一起"],
      ["gap", false, "接触（距离 0）"],
    ])
    k.dispose()
  })

  it("gets the same answers with the assembly tilted, where axis-aligned boxes are fat", async () => {
    const tilt = [{ axis: "X" as const, angle: 30 }]
    const { k, tree } = assembly(await boardStep(), await caseStep(), CHECKS, tilt)
    const booleans = count("BRepAlgoAPI_Common")
    const distances = count("BRepExtrema_DistShapeShape")
    const rep = k.rebuild(tree)
    expect(rep.checks?.map((c) => [c.id, c.pass, c.actual])).toEqual([
      ["free", true, "最小间隙 2 mm"],
      ["room", true, "最小间隙 2 mm"],
      ["gap", true, "2 mm"],
    ])
    expect(booleans.calls).toBe(0)
    // 15 when written: oriented boxes keep the bounds tight.
    expect(distances.calls).toBeLessThan(30)
    k.dispose()
  })

  it("counts a part wholly inside one solid of a many-solid part as an interference, not a gap", async () => {
    // A pin inside a standoff: its boundary never meets the standoff's, and as a compound the standoff had no inside.
    const standoff = block(6, 6, 10, [30, 0, 0])
    const k = new Kernel()
    k.setComponents([
      { file: "vendor/board.step", bytes: await stepOf([standoff, block(4, 4, 4, [0, 0, 0])]) },
      { file: "pin.step", bytes: await stepOf([block(2, 2, 6, [30, 0, 2])]) },
    ])
    const rep = k.rebuild({
      params: {},
      features: [
        { id: "board", op: "component", name: "板", file: "vendor/board.step" },
        { id: "pin", op: "component", name: "销", file: "pin.step" },
      ],
      checks: [{ id: "pin_free", said: "销不碰板", kind: "interference", ref: "销" }],
    })
    expect(rep.features[1].warnings).toEqual(["「销」和「板」重叠 24 mm³"])
    expect(rep.checks?.[0]).toMatchObject({ pass: false, actual: "相交 24 mm³" })
    k.dispose()
  })

  it("says a comparison is too big instead of hanging on it, and spends no boolean on it", async () => {
    // More pins through the floor than one comparison takes booleans for.
    const pins: Shape3D[] = []
    for (let i = 0; i < 15; i++) for (let j = 0; j < 14; j++) pins.push(block(0.8, 0.8, 4, [-17.5 + 2.5 * i, -16.25 + 2.5 * j, -1]))
    expect(pins.length).toBeGreaterThan(MAX_BOOLEANS)
    const { k, tree } = assembly(await stepOf(pins), await caseStep(), [CHECKS[0]])
    const booleans = count("BRepAlgoAPI_Common")
    const rep = k.rebuild(tree)
    expect(rep.features[1].warnings).toEqual([expect.stringMatching(/^「壳」和「板」太复杂，没有查干涉：贴得很近、要逐对精确求交的实体有 210 对（上限 200）/)])
    expect(rep.interferences).toEqual([])
    expect(rep.checks?.[0]).toMatchObject({ pass: false, invalid: true, tooComplex: true, actual: expect.stringMatching(/^太复杂，没有算：/) })
    const text = checkText(rep)
    expect(text).toMatch(/1 项太复杂没有算：不是没满足/)
    expect(text).not.toMatch(/选择器写得不对/)
    expect(k.measure([{ kind: "part", name: "板" }, { kind: "part", name: "壳" }])?.between).toEqual([{ name: "最短距离", value: expect.stringMatching(/^太复杂，没有算：/) }])
    expect(booleans.calls).toBe(0)
    k.dispose()
  })
})

describe("an assembly with a vendor board: the rest of the rebuild", () => {
  it("meshes only a part that came without a mesh (a standard screw), not the whole assembly again", async () => {
    const board = compileComponent({ file: "vendor/board.step", bytes: await boardStep() })
    const k = new Kernel()
    k.setComponents([{ file: "vendor/board.step", bytes: new Uint8Array([1]), compiled: board }])
    k.rebuild({
      params: {},
      features: [
        { id: "board", op: "component", name: "板", file: "vendor/board.step" },
        { id: "screw", op: "component", name: "螺丝", standard: { type: "screw", size: "M2", head: "socket", length: 6 }, at: [30, 0, 0] },
      ],
    })
    const meshed = count("ReplicadMeshExtractor")
    const d = k.display()
    expect(d.parts?.map((p) => p.name)).toEqual(["板", "螺丝"])
    // The board (81 boxes, 486 faces) keeps the mesh it came with; only the screw (a few dozen faces) is meshed.
    expect(meshed.faces.length).toBeGreaterThan(0)
    expect(Math.max(...meshed.faces)).toBeLessThan(100)
    expect(d.mesh!.triangles.length).toBeGreaterThan(board.parts[0].display!.mesh.triangles.length)
    k.dispose()
  })

  it("adds up an assembly's mass from its parts' instead of integrating the whole board again", async () => {
    const shell = await caseStep()
    const { k, tree } = assembly(await boardStep(), shell, undefined, [{ axis: "X", angle: 30 }])
    const rep = k.rebuild(tree)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = (k as any).lastBuilt(Infinity).body as Shape3D
    const direct = measureShapeVolumeProperties(body)
    const c = direct.centerOfMass as unknown as V3
    expect(rep.body!.volume).toBeCloseTo(direct.volume, 1)
    rep.body!.centerOfMass.forEach((x, i) => expect(x).toBeCloseTo(c[i], 1))
    expect(rep.body!.solids).toBe(82)
    expect(rep.body!.faces).toBe(faceCount(body.wrapped))
    expect(rep.parts?.map((p) => p.volume)).toEqual([expect.closeTo(40 * 30 * 1.6 + 80 * 8, 1), expect.closeTo(60 * 50 * 20 - 52 * 42 * 18, 1)])
    k.dispose()
  })
})
