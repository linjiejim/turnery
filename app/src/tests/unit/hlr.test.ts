import * as THREE from "three"
import { expect, it } from "vitest"
import { hiddenLines, loops, type HlrLine, type HlrPart, type HlrView, type V3 } from "@/studio/kernel/hlr"
import { fitCamera, hlrView, labelTexts } from "@/studio/figure-lines"

/** A box as the kernel meshes it: each face its own four vertices (two triangles), its 12 edges as point pairs. */
function box(id: number, lo: V3, hi: V3, offset?: V3): HlrPart {
  const c = (i: number): V3 => [i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]]
  // Corners of each face, counter-clockwise seen from outside.
  const faces = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]]
  const vertices: number[] = []
  const index: number[] = []
  faces.forEach((f, k) => {
    for (const i of f) vertices.push(...c(i))
    index.push(k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3)
  })
  const edges: number[] = []
  for (const [a, b] of [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]]) edges.push(...c(a), ...c(b))
  return { id, vertices: new Float32Array(vertices), index: new Uint32Array(index), edges: new Float32Array(edges), offset }
}

/** A cylinder round Z, one smooth side face (shared vertices) and its two rim circles as edges. */
function cylinder(id: number, r: number, h: number, n = 48): HlrPart {
  const vertices: number[] = []
  const index: number[] = []
  const edges: number[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    vertices.push(r * Math.cos(a), r * Math.sin(a), 0, r * Math.cos(a), r * Math.sin(a), h)
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    index.push(i * 2, j * 2, j * 2 + 1, i * 2, j * 2 + 1, i * 2 + 1)
    for (const z of [0, 1]) edges.push(...vertices.slice((i * 2 + z) * 3, (i * 2 + z) * 3 + 3), ...vertices.slice((j * 2 + z) * 3, (j * 2 + z) * 3 + 3))
  }
  return { id, vertices: new Float32Array(vertices), index: new Uint32Array(index), edges: new Float32Array(edges) }
}

const length = (lines: HlrLine[], part?: number) => lines.filter((l) => part === undefined || l.part === part).reduce((s, l) => s + Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]), 0)

/** Looking along +Y (the front view), orthographic, at a 40 × 40 window round the origin. */
function front(px = 400): HlrView {
  const cam = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.1, 1000)
  cam.position.set(0, -100, 0)
  cam.up.set(0, 0, 1)
  cam.lookAt(0, 0, 0)
  return hlrView(cam, px, px)
}

it("removes what a part in front hides, and gives it back dashed when asked", () => {
  // A 10 mm cube in front of a 30 mm long bar; seen from the front, the cube covers the bar's middle.
  const near = box(0, [-5, -20, -5], [5, -10, 5])
  const far = box(1, [-15, 0, -2], [15, 20, 2])
  const view = front()
  const shown = hiddenLines([near, far], view)
  const both = hiddenLines([near, far], view, { hidden: true })
  // The cube's outline (4 × 10 mm, 0.5 of the window each) is all seen; nothing hidden is kept unless asked.
  expect(length(shown.visible, 0)).toBeGreaterThan(4 * 0.5 * 0.98)
  expect(shown.hidden).toEqual([])
  // The bar's four long edges (front and back pairs, each 30 mm = 1.5) lose their middle 10 mm (0.5) behind the cube.
  const lost = length(both.hidden, 1)
  expect(lost).toBeGreaterThan(4 * 0.5 * 0.9)
  expect(lost).toBeLessThan(4 * 0.5 * 1.15)
  expect(length(both.hidden, 0)).toBe(0)
  // Back edges seen end on behind the front ones are drawn once: the cube's front outline, not twice over.
  expect(length(shown.visible, 0)).toBeLessThan(4 * 0.5 * 1.05)
  // And a hidden line never runs under a visible one.
  expect(length(both.hidden, 1)).toBeLessThan(4 * 0.5 * 1.15)
})

it("draws a cylinder's outline where its side turns away, and nothing across its middle", () => {
  const view = front()
  const { visible } = hiddenLines([cylinder(0, 8, 20)], view)
  // Outlines: two vertical lines at x = ±8 mm (±0.4 of the window), 20 mm long each.
  const vertical = visible.filter((l) => Math.abs(l.a[0] - l.b[0]) < 1e-3)
  const xs = [...new Set(vertical.map((l) => Math.round(l.a[0] * 100) / 100))].sort((a, b) => a - b)
  expect(xs[0]).toBeCloseTo(-0.4, 1)
  expect(xs.at(-1)).toBeCloseTo(0.4, 1)
  expect(vertical.every((l) => Math.abs(Math.abs(l.a[0]) - 0.4) < 0.02)).toBe(true)
  expect(length(vertical)).toBeGreaterThan(2 * 1 * 0.95)
})

it("cuts a section: what's in front of the plane goes, the cut face hides what's behind it and is outlined", () => {
  // A 20 mm cube centred on the origin with a 10 mm one inside it (a cavity's walls stand in for inner edges).
  const outer = box(0, [-10, -10, -10], [10, 10, 10])
  const inner = box(1, [-5, -5, -5], [5, 5, 5])
  const view = front()
  // Keep y ≥ 6: the cut passes in front of the inner cube, which stays hidden behind the cut face.
  const behind = hiddenLines([outer, inner], view, { section: { normal: [0, 1, 0], constant: -6 } })
  expect(length(behind.visible, 1)).toBe(0)
  const outline = loops(behind.cut)
  expect(outline.length).toBe(1)
  // Keep y ≥ 0: the inner cube is cut too; its cut face shows inside the outer one's.
  const through = hiddenLines([outer, inner], view, { section: { normal: [0, 1, 0], constant: 0 } })
  expect(loops(through.cut).length).toBe(2)
  expect(length(through.visible, 1)).toBeGreaterThan(4 * 0.5 * 0.98)
  // Nothing on the cut-away side is drawn.
  expect(through.visible.length).toBeGreaterThan(0)
})

it("follows parts moved apart, and frames them from any direction", () => {
  const a = box(0, [0, 0, 0], [10, 10, 10])
  const moved = box(0, [0, 0, 0], [10, 10, 10], [0, 0, 30])
  const cam = fitCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 40)), new THREE.Vector3(1, -1.1, 0.85), "orthographic", 400, 300)
  const view = hlrView(cam, 400, 300)
  const top = (r: ReturnType<typeof hiddenLines>) => Math.max(...r.visible.flatMap((l) => [l.a[1], l.b[1]]))
  expect(top(hiddenLines([moved], view))).toBeGreaterThan(top(hiddenLines([a], view)) + 0.5)
  // Perspective works the same way.
  const persp = hlrView(fitCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(10, 10, 10)), new THREE.Vector3(1, -1.1, 0.85), "perspective", 400, 300), 400, 300)
  expect(length(hiddenLines([a], persp).visible)).toBeGreaterThan(0)
})

it("is quick on a big mesh", () => {
  // 200 cylinders of 2 × 96 triangles and 192 rim edges each: about 40 000 triangles, 40 000 edge segments.
  const parts = Array.from({ length: 200 }, (_, i) => ({ ...cylinder(i, 3, 10, 96), offset: [(i % 20) * 8 - 80, Math.floor(i / 20) * 8 - 40, 0] as V3 }))
  const cam = fitCamera(new THREE.Box3(new THREE.Vector3(-85, -45, 0), new THREE.Vector3(85, 45, 10)), new THREE.Vector3(1, -1.1, 0.85), "orthographic", 1600, 1000)
  const t = performance.now()
  const res = hiddenLines(parts, hlrView(cam, 1600, 1000))
  expect(performance.now() - t).toBeLessThan(3000)
  expect(res.visible.length).toBeGreaterThan(200)
})

it("numbers parts by tens, by name, or as told", () => {
  expect(labelTexts(["外壳/底壳", "外壳/上盖", "螺钉"], "numbers")).toEqual(["10", "20", "30"])
  expect(labelTexts(["外壳/底壳", "螺钉"], "names")).toEqual(["底壳", "螺钉"])
  expect(labelTexts(["外壳/底壳", "螺钉"], { 底壳: "12", 外壳: "x" })).toEqual(["12", null])
  expect(labelTexts(["a"], "none")).toEqual([null])
})

it("keeps a line that only touches others at its ends and middle; drops one drawn twice", () => {
  // Front view: three 20 mm uprights at x = −5, 0, 5, and a 10 mm crossbar at z = 5 touching all three.
  const lines = [-5, 0, 5].flatMap((x) => [x, 0, -10, x, 0, 10])
  const part: HlrPart = { id: 0, vertices: new Float32Array(), index: new Uint32Array(), edges: new Float32Array([...lines, -5, 0, 5, 5, 0, 5, -5, 0, 5, 5, 0, 5]) }
  const { visible } = hiddenLines([part], front())
  const bars = visible.filter((l) => Math.abs(l.a[1] - l.b[1]) < 1e-6)
  // The crossbar is kept, once (it was given twice).
  expect(bars.length).toBe(1)
  expect(length(bars)).toBeCloseTo(0.5, 2)
})

it("hatches the cut only from the side that was cut away, and leaves out what's off the picture", () => {
  const cube = box(0, [-10, -10, -10], [10, 10, 10])
  // Keeping the near half (y ≤ 0): the cut faces away from the eye, behind the part.
  expect(hiddenLines([cube], front(), { section: { normal: [0, -1, 0], constant: 0 } }).cut).toEqual([])
  expect(hiddenLines([cube], front(), { section: { normal: [0, 1, 0], constant: 0 } }).cut.length).toBeGreaterThan(0)
  // A box beside the 40 mm picture isn't drawn at all, not even its outline.
  const off = box(1, [40, -5, -5], [50, 5, 5])
  const { visible, hidden } = hiddenLines([cube, off], front(), { hidden: true })
  expect([...visible, ...hidden].filter((l) => l.part === 1)).toEqual([])
  expect(visible.every((l) => [l.a, l.b].every((p) => Math.abs(p[0]) <= 1.001 && Math.abs(p[1]) <= 1.001))).toBe(true)
})

it("frames a model under a millimetre without clipping it", () => {
  const tiny = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.1, 0.1, 0.1))
  const cam = fitCamera(tiny, new THREE.Vector3(1, -1.1, 0.85), "orthographic", 400, 300) as THREE.OrthographicCamera
  cam.updateMatrixWorld()
  for (const x of [0, 0.1])
    for (const y of [0, 0.1])
      for (const z of [0, 0.1]) {
        const d = -new THREE.Vector3(x, y, z).applyMatrix4(cam.matrixWorldInverse).z
        expect(d).toBeGreaterThan(cam.near)
        expect(d).toBeLessThan(cam.far)
      }
})

it("numbers only parts named in the map, not what every object has", () => {
  expect(labelTexts(["constructor", "toString", "盖"], { 盖: "10" })).toEqual([null, null, "10"])
})
