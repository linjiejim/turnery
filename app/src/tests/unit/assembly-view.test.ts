import * as THREE from "three"
import { expect, it } from "vitest"
import { applyStyle, applyView, hasMoves, modelObject, partOffset, partsBox, repaint, groupAt, faceTarget, withoutMoves, NO_PARTS_VIEW } from "@/studio/scene"
import type { DisplayData } from "@/studio/kernel/build"
import { MaterialKit } from "@/three/materials"
import type { SceneTokens } from "@/three/tokens"
import { newNote, parseNotes } from "@/desktop/core/notes"
import { matchesPart, selectGroup, selectParts, wholeNames, wholeOf } from "@/studio/part-selection"

const data: DisplayData = {
  index: 1, mesh: { vertices: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 0, 3, 0, 0, 2, 1, 0]), normals: new Float32Array(18), triangles: new Uint32Array([0, 1, 2, 3, 4, 5]) },
  groups: [{ hash: 11, origin: "repeat", status: "kept", start: 0, count: 3, part: 0 }, { hash: 12, origin: "repeat", status: "new", start: 3, count: 3, part: 1 }], edges: null, edgeGroups: [], sketch: null, threads: [], bbox: [[0, 0, 0], [3, 1, 0]],
  parts: [{ name: "first", center: [0, 0, 0], explode: [100, 0, 0] }, { name: "second", center: [2, 0, 0], explode: [0, 100, 0] }],
}
const solid = new THREE.MeshBasicMaterial(), ghost = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.14 })
const kit = { model: solid, modelDark: solid, highlight: solid, modified: solid, ghost } as MaterialKit
/** The parts' meshes that are shown (every part has one, shown or not). */
const shown = (model: THREE.Object3D) => model.children.filter((c) => c.visible && (c as THREE.Mesh).isMesh) as THREE.Mesh[]

it("isolates one instance, ghosts the others, and restores the complete assembly without changing source geometry", () => {
  const before = structuredClone(data)
  const isolated = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, focus: { parts: ["second"], mode: "isolate" } })
  expect(shown(isolated)).toHaveLength(1)
  expect(shown(isolated)[0].userData.part).toBe(1)
  const context = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, focus: { parts: ["second"], mode: "ghost" } })
  expect((context.children[0] as THREE.Mesh).material).toBe(ghost)
  expect(context.children[1].userData.contextGhost).toBe(false)
  repaint(context, { status: false, highlight: "repeat" })
  expect((context.children[0] as THREE.Mesh).material).toBe(ghost)
  const restored = modelObject(data, kit, { status: false }, NO_PARTS_VIEW)
  expect(shown(restored).reduce((n, m) => n + m.geometry.index!.count, 0)).toBe(6)
  expect(data).toEqual(before)
  // The same object goes from one view to another without being built again: same meshes, shown, moved, solid.
  const meshes = [...context.children]
  applyView(context, data, { ...NO_PARTS_VIEW, explode: 0.5, hidden: new Set([1]) }, kit)
  expect(context.children).toEqual(meshes)
  expect(shown(context).map((m) => [m.userData.part, m.position.toArray(), Array.isArray(m.material)])).toEqual([[0, [50, 0, 0], true]])
  applyView(context, data, NO_PARTS_VIEW, kit)
  expect(shown(context).map((m) => [m.userData.part, m.position.toArray()])).toEqual([[0, [0, 0, 0]], [1, [0, 0, 0]]])
})

it("raycasts an exploded internal instance precisely and stores annotations in native coordinates", () => {
  const model = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, explode: 1 })
  model.updateMatrixWorld(true)
  const ray = new THREE.Raycaster(new THREE.Vector3(2.2, 100.2, 5), new THREE.Vector3(0, 0, -1))
  const hit = ray.intersectObjects(shown(model), false)[0]
  expect(groupAt(hit)).toMatchObject({ hash: 12, origin: "repeat", part: 1 })
  const target = faceTarget(hit)!
  expect(target.point[0]).toBeCloseTo(2.2)
  expect(target.point[1]).toBeCloseTo(0.2)
  expect(target.point[2]).toBe(0)
  const note = newNote({ notes: [], next: 1 }, { ...target, part: "second", kind: "face", what: "面", where: "内部件", facts: "", origins: ["repeat"], selector: null, sketch: null }, "调整这里")
  const restored = parseNotes(JSON.stringify({ next: 2, notes: [note] })).notes[0]
  expect(restored.part).toBe("second")
  expect(restored.point).toEqual(target.point)
})

it("keeps multiple isolated instances at their exploded positions and respects manual hiding", () => {
  const view = { ...NO_PARTS_VIEW, explode: 1, focus: { parts: ["first", "second"], mode: "isolate" as const } }
  const model = modelObject(data, kit, { status: false }, view)
  expect(shown(model).map((c) => c.userData.part)).toEqual([0, 1])
  expect(shown(model).map((c) => c.position.toArray())).toEqual([[100, 0, 0], [0, 100, 0]])
  const hidden = modelObject(data, kit, { status: false }, { ...view, hidden: new Set([0]) })
  expect(shown(hidden).map((c) => c.userData.part)).toEqual([1])
  const restored = modelObject(data, kit, { status: false }, { ...view, focus: undefined })
  expect(shown(restored).map((c) => c.position.toArray())).toEqual([[100, 0, 0], [0, 100, 0]])
})

it("searches names, source files and step IDs without changing a multi-selection", () => {
  const selected = selectParts(selectParts([], "外壳", true), "内部件", true)
  expect(selected).toEqual(["外壳", "内部件"])
  expect(selectParts(selected, "外壳", true)).toEqual(["内部件"])
  expect(selectParts(selected, "右侧件", false)).toEqual(["右侧件"])
  expect(selectParts(["右侧件"], "右侧件", false)).toEqual([])
  expect(matchesPart(" 内部 INNER ", "内部件", "parts/inner.turnery.json", "motor_core")).toBe(true)
  expect(matchesPart("ＭＯＴＯＲ", "内部件", "parts/inner.turnery.json", "motor_core")).toBe(true)
  expect(matchesPart("outer", "内部件", "parts/inner.turnery.json", "motor_core")).toBe(false)
  expect(matchesPart("   ", "内部件")).toBe(true)
  expect(selected).toEqual(["外壳", "内部件"])
})

it("selects a split part as one thing, and one of its pieces only when asked", () => {
  const parts = [{ name: "外壳/底壳", whole: "外壳" }, { name: "外壳/上盖", whole: "外壳" }, { name: "螺钉#1" }, { name: "螺钉#2" }, { name: "套件/壳/前", whole: "套件/壳" }, { name: "套件/壳/后", whole: "套件/壳" }, { name: "套件/芯" }]
  const names = (i: number[]) => i.map((k) => parts[k].name)
  // A click on either half takes both; a part in one piece is just itself (each copy on its own).
  expect(wholeOf(parts, 1)).toEqual([0, 1])
  expect(wholeOf(parts, 2)).toEqual([2])
  expect(wholeOf(parts, 5)).toEqual([4, 5])
  expect(wholeOf(parts, 6)).toEqual([6])
  expect(wholeOf(parts, 99)).toEqual([])
  const shell = names(wholeOf(parts, 0))
  let selected = selectGroup([], shell, false)
  expect(selected).toEqual(["外壳/底壳", "外壳/上盖"])
  // The same part again clears it; another part replaces it; Shift adds and takes away whole parts.
  expect(selectGroup(selected, shell, false)).toEqual([])
  expect(selectGroup(selected, ["螺钉#1"], false)).toEqual(["螺钉#1"])
  selected = selectGroup(selected, names(wholeOf(parts, 4)), true)
  expect(selected).toEqual(["外壳/底壳", "外壳/上盖", "套件/壳/前", "套件/壳/后"])
  expect(selectGroup(selected, shell, true)).toEqual(["套件/壳/前", "套件/壳/后"])
  // One piece picked on its own (⌥), then a click on its part: the whole part, not nothing.
  expect(selectGroup(["外壳/上盖"], shell, false)).toEqual(shell)
  expect(selectGroup(["外壳/上盖"], shell, true)).toEqual(["外壳/上盖", "外壳/底壳"])
  // The toolbar names what is selected the way it was picked: whole parts by their own name.
  expect(wholeNames(parts, selected)).toEqual(["外壳", "套件/壳"])
  expect(wholeNames(parts, ["外壳/上盖", "螺钉#2", "套件/芯"])).toEqual(["外壳/上盖", "螺钉#2", "套件/芯"])
  expect(wholeNames(parts, ["外壳/底壳", "外壳/上盖", "不在了"])).toEqual(["外壳", "不在了"])
})

it("draws neighbouring faces in one go and still knows which face a click landed on", () => {
  // One body of four faces (a triangle each), no parts.
  const quad: DisplayData = {
    index: 0, mesh: { vertices: new Float32Array(36).map((_, i) => (i % 3 === 0 ? Math.floor(i / 9) * 2 + (i % 9 === 3 ? 1 : 0) : i % 9 === 7 ? 1 : 0)), normals: new Float32Array(36), triangles: new Uint32Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]) },
    groups: [0, 1, 2, 3].map((k) => ({ hash: 20 + k, origin: k < 2 ? "base" : "boss", status: "kept" as const, start: k * 3, count: 3 })), edges: null, edgeGroups: [], sketch: null, threads: [], bbox: [[0, 0, 0], [7, 1, 0]],
  }
  const model = modelObject(quad, kit, { status: false })
  const mesh = model.children[0] as THREE.Mesh
  const draws = () => mesh.geometry.groups.map((g) => [g.start, g.count, g.materialIndex])
  // At rest the four faces are one draw; a face lit in the middle splits it in three; a feature's faces in two.
  expect(draws()).toEqual([[0, 12, 0]])
  repaint(model, { status: false, hovered: [21] })
  expect(draws()).toEqual([[0, 3, 0], [3, 3, 5], [6, 6, 0]])
  repaint(model, { status: false, highlight: ["boss"] })
  expect(draws()).toEqual([[0, 6, 0], [6, 6, 1]])
  // Picking reads the faces themselves, not the draws.
  model.updateMatrixWorld(true)
  for (const k of [0, 1, 2, 3]) {
    const hit = new THREE.Raycaster(new THREE.Vector3(k * 2 + 0.2, 0.2, 5), new THREE.Vector3(0, 0, -1)).intersectObjects(model.children, false)[0]
    expect(groupAt(hit)).toMatchObject({ hash: 20 + k })
  }
})

it("separates hover, selection and opt-in change colors in assembled and exploded views", () => {
  for (const explode of [0, 1]) {
    const model = modelObject(data, kit, { status: false }, { ...NO_PARTS_VIEW, explode })
    const indices = () => model.children.flatMap((o) => (o as THREE.Mesh).geometry.groups.map((g) => g.materialIndex))
    expect(indices()).toEqual([0, 0])
    repaint(model, { status: false, selected: [0], hovered: [12] })
    expect(indices()).toEqual([1, 5])
    repaint(model, { status: true })
    expect(indices()).toEqual([0, 6])
  }
})

it("moves parts by hand on top of the explode, by name, and puts them back", () => {
  const view = { ...NO_PARTS_VIEW, explode: 0.5, moved: { second: [0, 0, 12] as [number, number, number] } }
  expect(hasMoves(view)).toBe(true)
  expect(partOffset(data, view, 0)).toEqual([50, 0, 0])
  expect(partOffset(data, view, 1)).toEqual([0, 50, 12])
  const model = modelObject(data, kit, { status: false }, view)
  expect(shown(model).map((m) => m.position.toArray())).toEqual([[50, 0, 0], [0, 50, 12]])
  // The arrows stand in the middle of what is shown; a click on the moved part is kept where it is in the file.
  expect(partsBox(data, view, [1])!.min.toArray()).toEqual([2, 50, 12])
  expect(partsBox(data, view, [1])!.max.toArray()).toEqual([3, 51, 12])
  model.updateMatrixWorld(true)
  const hit = new THREE.Raycaster(new THREE.Vector3(2.2, 50.2, 30), new THREE.Vector3(0, 0, -1)).intersectObjects(shown(model), false)[0]
  expect(groupAt(hit)).toMatchObject({ hash: 12, part: 1 })
  expect(faceTarget(hit)!.point.map((v) => Math.round(v * 1000) / 1000)).toEqual([2.2, 0.2, 0])
  // Back where they were: one part, or all of them; a move of nothing is no move.
  expect(withoutMoves(view, ["second"]).moved).toBeUndefined()
  expect(withoutMoves(view, ["first"]).moved).toEqual({ second: [0, 0, 12] })
  expect(hasMoves(withoutMoves(view))).toBe(false)
  expect(hasMoves({ ...NO_PARTS_VIEW, moved: { first: [0, 0, 0] } })).toBe(false)
  // A part the view doesn't know (renamed, gone) moves nothing, and doesn't count as moved for the model.
  const stale = { ...NO_PARTS_VIEW, moved: { gone: [5, 5, 5] as [number, number, number] } }
  expect(partOffset(data, stale, 0)).toEqual([0, 0, 0])
  expect(hasMoves(stale, data)).toBe(false)
  expect(hasMoves({ ...stale, moved: { ...stale.moved, second: [1, 0, 0] } }, data)).toBe(true)
})

it("maps every shaded material to its line-drawing and see-through counterpart, and cuts them all", () => {
  // Any colour will do for the tokens: the mapping is what's tested.
  const tokens = new Proxy({}, { get: (_, k) => (k === "dark" ? false : new THREE.Color(0.5, 0.5, 0.5)) }) as SceneTokens
  const real = new MaterialKit(tokens)
  // Line drawing: paper for resting faces, a tinted paper for each paint role, ink for edges; clear parts stay clear.
  expect(real.styled(real.model, "lines")).toBe(real.line)
  expect(real.styled(real.modelDark, "lines")).toBe(real.line)
  const lit = real.styled(real.highlight, "lines")
  expect(lit).not.toBe(real.line)
  expect(lit).toBeInstanceOf(THREE.ShaderMaterial)
  expect(real.styled(real.glass, "lines")).toBe(real.glass)
  expect(real.styled(real.ghost, "lines")).toBe(real.ghost)
  expect(real.styledEdge(real.edge, "lines")).toBe(real.ink)
  expect(real.styledEdge(real.edgeGhost, "lines")).toBe(real.edgeGhost)
  // See-through: the neutral grey, or the part's own colour.
  expect(real.styled(real.model, "xray")).toBe(real.xray)
  const red = real.forLook({ color: "#cc3333" } as never).surface
  const redXray = real.styled(red, "xray") as THREE.MeshStandardMaterial
  expect(redXray).not.toBe(real.xray)
  expect(redXray.color.getHexString()).toBe((red as THREE.MeshStandardMaterial).color.getHexString())
  expect(real.styled(red, "xray")).toBe(redXray)
  expect(real.styled(real.model, "shaded")).toBe(real.model)
  // A section cuts the other styles' materials too (made before or after it was switched on).
  real.setSection(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  for (const m of [real.line, lit, real.ink, real.xray, redXray]) expect(m.clippingPlanes?.length).toBe(1)
  const blue = real.styled(real.forLook({ color: "#3333cc" } as never).surface, "xray")
  expect(blue.clippingPlanes?.length).toBe(1)
  real.setSection(null)
  expect(real.line.clippingPlanes).toBeNull()
  real.dispose()
})

it("draws the same model shaded, as a line drawing or see-through without building it again", () => {
  const line = new THREE.MeshBasicMaterial(), xray = new THREE.MeshBasicMaterial(), edge = new THREE.LineBasicMaterial(), ink = new THREE.LineBasicMaterial(), edgeGhost = new THREE.LineBasicMaterial()
  const styledKit = {
    ...kit,
    edge,
    edgeGhost,
    styled: (m: THREE.Material, style: string) => (m === ghost ? m : style === "lines" ? line : xray),
    styledEdge: (m: THREE.Material, style: string) => (style === "lines" ? ink : m),
  } as unknown as MaterialKit
  const lined: DisplayData = { ...data, edges: new Float32Array([0, 0, 0, 1, 0, 0, 2, 0, 0, 3, 0, 0]), edgeGroups: [{ hash: 21, start: 0, count: 2, part: 0 }, { hash: 22, start: 2, count: 2, part: 1 }] }
  const model = modelObject(lined, styledKit, { status: false }, NO_PARTS_VIEW, true, "lines")
  const meshes = () => model.children.filter((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh[]
  const edges = () => model.children.filter((c) => (c as THREE.LineSegments).isLineSegments) as THREE.LineSegments[]
  const before = [...model.children]
  // Every face material swapped (the see-through context material stays as it is).
  const all = (want: THREE.Material) => meshes().every((m) => (m.material as THREE.Material[]).every((x) => x === want || x === ghost))
  expect(all(line)).toBe(true)
  expect(edges().map((e) => e.material)).toEqual([ink, ink])
  applyStyle(model, lined, NO_PARTS_VIEW, styledKit, "xray")
  expect(all(xray)).toBe(true)
  expect(edges().map((e) => e.material)).toEqual([edge, edge])
  applyStyle(model, lined, NO_PARTS_VIEW, styledKit, "shaded")
  expect(meshes().every((m) => m.material === m.userData.materials)).toBe(true)
  expect(model.children).toEqual(before)
  // Moving a part keeps the style; a part seen through stays seen through; the faces keep their paint.
  applyStyle(model, lined, NO_PARTS_VIEW, styledKit, "lines")
  applyView(model, lined, { ...NO_PARTS_VIEW, focus: { parts: ["second"], mode: "ghost" } }, styledKit)
  expect(meshes().map((m) => (Array.isArray(m.material) ? m.material[0] : m.material))).toEqual([ghost, line])
  expect(edges().map((e) => e.material)).toEqual([edgeGhost, ink])
  repaint(model, { status: false, selected: [1] })
  expect(meshes()[1].geometry.groups.map((g) => g.materialIndex)).toEqual([1])
})

it("styles a body that isn't in parts as well", () => {
  const line = new THREE.MeshBasicMaterial(), edge = new THREE.LineBasicMaterial(), ink = new THREE.LineBasicMaterial()
  const styledKit = { ...kit, edge, styled: () => line, styledEdge: () => ink } as unknown as MaterialKit
  const body: DisplayData = { ...data, parts: undefined, groups: data.groups.map((g) => ({ ...g, part: undefined })), edges: new Float32Array([0, 0, 0, 1, 0, 0]), edgeGroups: [{ hash: 21, start: 0, count: 2 }] }
  const model = modelObject(body, styledKit, { status: false })
  const mesh = model.children.find((c) => (c as THREE.Mesh).isMesh) as THREE.Mesh
  const lines = model.children.find((c) => (c as THREE.LineSegments).isLineSegments) as THREE.LineSegments
  expect(mesh.material).toBe(mesh.userData.materials)
  applyStyle(model, body, NO_PARTS_VIEW, styledKit, "lines")
  expect((mesh.material as THREE.Material[]).every((m) => m === line || m === ghost)).toBe(true)
  expect(lines.material).toBe(ink)
  applyStyle(model, body, NO_PARTS_VIEW, styledKit, "shaded")
  expect(lines.material).toBe(edge)
})
