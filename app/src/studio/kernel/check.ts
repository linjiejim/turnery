// Requirement checks (dsl.ts `Check`): the learner's numbers, measured on the
// latest body by the kernel, not taken on the assistant's word.
import { getOC, makeCompound, measureShapeVolumeProperties, type AnyShape, type Shape3D } from "replicad"
import type { Check, EdgeSelector, FaceSelector } from "../dsl"
import type { Scope } from "../expr"
import { METRIC, type ScrewSize } from "../holes"
import { isBetween, measure, positionOf, type BetweenKey } from "./measure"
import { meshShape } from "./mesh"
import { Pieces, relation, TooComplex } from "./pieces"
import { relationText, thinnestWall } from "./proximity"
import { compoundOf } from "./topo"
import { disposeInfos, edgeInfos, faceInfos, selectEdges, selectFaces, type EdgeInfo, type FaceInfo } from "./select"
import { agentLang, ta } from "../../lib/agent-lang"

type V3 = [number, number, number]

export type CheckResult = {
  id: string
  said: string
  pass: boolean
  /** The check itself can't be measured (its selector picks nothing or too much): the item is wrong, not the part. */
  invalid?: boolean
  /** 「80 × 50 × 30」 */
  expected: string
  actual: string
  /** With `invalid`: the model is too big for this check to be worked out (not a wrong item). */
  tooComplex?: boolean
  /** Faces / edges measured, to light them up when the row is pointed at. */
  faces: number[]
  edges: number[]
}

const fmt = (x: number) => String(Math.round(x * 100) / 100)
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a: V3) => Math.hypot(...a)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OC = any

/** At most this many faces or edges per item: a selector that wide isn't one requirement. */
const MAX_ITEMS = 50

/**
 * What a check can name besides faces and edges: reference bodies (`import`, and the other parts when
 * editing inside an assembly) by id and by name, and the model's parts by name.
 */
export type CheckBodies = {
  refs: Map<string, AnyShape>
  parts: { name: string; body: Shape3D }[]
  /** The body's box when the kernel knows it already (an assembly: from its parts' boxes). */
  bounds?: [V3, V3]
}

/**
 * Reference bodies whose faces a selector may name with `of` (an imported board, the part next door
 * in an assembly). Their faces are listed once per run, on first use, and freed at the end.
 */
let REFS: { bodies: CheckBodies; infos: Map<string, { faces: FaceInfo[]; edges: EdgeInfo[] | null }>; used: Set<AnyShape> } | null = null
/** Parts taken apart into their solids, shared by the checks of one run (an assembly's parts come up in most of them). */
let PIECES: Pieces | null = null

function refInfos(of: string | undefined) {
  const shape = of ? REFS?.bodies.refs.get(of) : undefined
  if (!shape || !REFS) return null
  let hit = REFS.infos.get(of!)
  if (!hit) {
    const faces = faceInfos(shape as Shape3D, [])
    for (const f of faces) f.origin = of!
    hit = { faces, edges: null }
    REFS.infos.set(of!, hit)
  }
  REFS.used.add(shape)
  return hit
}
/** The faces a face selector chooses among: a reference body's when `of` names one, else the model's. */
const facesFor = (sel: FaceSelector | undefined, faces: FaceInfo[]) => refInfos(sel?.of)?.faces ?? faces
/** selectEdges, on a reference body when the selector's `of` (or its faces' `of`) names one. */
function pickEdges(sel: EdgeSelector, edges: EdgeInfo[], faces: FaceInfo[], scope: Scope) {
  const ref = refInfos(sel.of ?? sel.faces?.of)
  if (!ref) return selectEdges(sel, edges, faces, scope)
  ref.edges ??= edgeInfos(REFS!.bodies.refs.get((sel.of ?? sel.faces?.of)!) as Shape3D, ref.faces)
  return selectEdges(sel, ref.edges, ref.faces, scope)
}

/** The model's faces and edges, listed on first use. */
type Topo = () => { faces: FaceInfo[]; edges: EdgeInfo[] }

export function runChecks(body: Shape3D, origins: string[], checks: Check[], scope: Scope, bodies: CheckBodies = { refs: new Map(), parts: [] }): CheckResult[] {
  // The body's faces and edges only when a check picks some: an assembly with a vendor's board model has
  // tens of thousands, and its interference checks never look at them.
  let infos: { faces: FaceInfo[]; edges: EdgeInfo[] } | null = null
  const topo: Topo = () => {
    if (!infos) {
      const faces = faceInfos(body, origins)
      infos = { faces, edges: edgeInfos(body, faces) }
    }
    return infos
  }
  REFS = { bodies, infos: new Map(), used: new Set() }
  PIECES = new Pieces()
  try {
    return checks.map((c) => {
      const base = { id: c.id, said: c.said, faces: [] as number[], edges: [] as number[] }
      REFS!.used.clear()
      try {
        return {
          ...base,
          ...(c.kind === "clearance" || c.kind === "interference"
            ? fit(c, body, bodies)
            : c.kind === "gap"
              ? gap(c, topo, scope, bodies)
              : c.kind === "position"
                ? position(c, topo().faces, topo().edges, scope)
                : c.kind === "overhang" || c.kind === "bed" || c.kind === "min_wall"
                  ? printable(c, body, bodies)
                  : c.kind === "size"
                    ? size(c, bodies.bounds ?? (body.boundingBox.bounds as [V3, V3]))
                    : one(c, body, origins, topo().faces, topo().edges, scope)),
        }
      } catch (e) {
        if (e instanceof TooComplex) return { ...base, pass: false, invalid: true, tooComplex: true, expected: expectedOf(c), actual: ta(`太复杂，没有算：${e.message}`, `Too complex, not worked out: ${e.message}`) }
        // The first line of a selector's error, without the candidates it lists (select.ts, either language).
        const first = ((e as Error).message || ta("没找到要量的东西", "Found nothing to measure")).split("\n")[0].replace(/(。?候选：|\.? Candidates:)$/, "")
        return { ...base, pass: false, invalid: true, expected: expectedOf(c), actual: first }
      }
    })
  } finally {
    for (const r of REFS.infos.values()) disposeInfos(r.faces, r.edges ?? [])
    REFS = null
    PIECES.dispose()
    PIECES = null
    const listed = infos as { faces: FaceInfo[]; edges: EdgeInfo[] } | null
    if (listed) disposeInfos(listed.faces, listed.edges)
  }
}

function expectedOf(c: Check): string {
  if (agentLang() === "en") return expectedEn(c)
  switch (c.kind) {
    case "size":
      return c.expect.map(fmt).join(" × ")
    case "holes":
      return `${c.count} 个${c.thread ? ` ${c.thread}` : c.d !== undefined ? ` ⌀${fmt(c.d)}` : ""}`
    case "pcd":
      return `${c.count} 个在 ⌀${fmt(c.expect)} 上`
    case "angle":
      return `${fmt(c.expect)}°`
    case "volume":
      return [c.min !== undefined && `≥ ${fmt(c.min / 1000)} cm³`, c.max !== undefined && `≤ ${fmt(c.max / 1000)} cm³`].filter(Boolean).join("，")
    case "clearance":
      return `和「${c.ref}」至少隔 ${fmt(c.min)} mm`
    case "interference":
      return `和「${c.ref}」不相交`
    case "position":
      return Array.isArray(c.expect) ? `(${c.expect.map(fmt).join(", ")})` : `${c.axis ?? "?"} = ${fmt(c.expect)}`
    case "overhang":
      return `悬垂不超过 ${fmt(c.max ?? 45)}°${c.up && c.up !== "+Z" ? `（${c.up} 朝上）` : ""}`
    case "min_wall":
      return `壁厚不小于 ${fmt(c.min)} mm`
    case "bed":
      return c.min !== undefined ? `贴平台的面积 ≥ ${fmt(c.min)} mm²` : "贴平台的面积"
    case "gap":
      return [c.max === 0 ? "贴在一起" : c.max !== undefined && `≤ ${fmt(c.max)} mm`, c.min !== undefined && `≥ ${fmt(c.min)} mm`].filter(Boolean).join("，") || "量间隙"
    default:
      return `${fmt(c.expect)} mm`
  }
}

/** expectedOf in English. */
function expectedEn(c: Check): string {
  switch (c.kind) {
    case "size":
      return c.expect.map(fmt).join(" × ")
    case "holes":
      return `${holeCount(c.count)}${c.thread ? ` ${c.thread}` : c.d !== undefined ? ` ⌀${fmt(c.d)}` : ""}`
    case "pcd":
      return `${holeCount(c.count)} on ⌀${fmt(c.expect)}`
    case "angle":
      return `${fmt(c.expect)}°`
    case "volume":
      return [c.min !== undefined && `≥ ${fmt(c.min / 1000)} cm³`, c.max !== undefined && `≤ ${fmt(c.max / 1000)} cm³`].filter(Boolean).join(", ")
    case "clearance":
      return `at least ${fmt(c.min)} mm from “${c.ref}”`
    case "interference":
      return `doesn't intersect “${c.ref}”`
    case "position":
      return Array.isArray(c.expect) ? `(${c.expect.map(fmt).join(", ")})` : `${c.axis ?? "?"} = ${fmt(c.expect)}`
    case "overhang":
      return `overhang at most ${fmt(c.max ?? 45)}°${c.up && c.up !== "+Z" ? ` (${c.up} up)` : ""}`
    case "min_wall":
      return `wall at least ${fmt(c.min)} mm thick`
    case "bed":
      return c.min !== undefined ? `area on the bed ≥ ${fmt(c.min)} mm²` : "area on the bed"
    case "gap":
      return [c.max === 0 ? "touching" : c.max !== undefined && `≤ ${fmt(c.max)} mm`, c.min !== undefined && `≥ ${fmt(c.min)} mm`].filter(Boolean).join(", ") || "measure the gap"
    default:
      return `${fmt(c.expect)} mm`
  }
}

/** 「4 个」 / "4 holes". */
const holeCount = (n: number) => ta(`${n} 个`, `${n} ${n === 1 ? "hole" : "holes"}`)

type PrintCheck = Extract<Check, { kind: "overhang" | "min_wall" | "bed" }>
const UP: Record<string, V3> = { "+X": [1, 0, 0], "-X": [-1, 0, 0], "+Y": [0, 1, 0], "-Y": [0, -1, 0], "+Z": [0, 0, 1], "-Z": [0, 0, -1] }
/** A triangle within this of the lowest point along `up` lies on the build plate. */
const ON_BED = 0.05
/** Past the limit by less than this still prints: a 45° chamfer meshes to 45.0001° as often as not. */
const ANGLE_SLACK = 0.5

/**
 * 3D printing: what needs support, what touches the plate, how thin the thinnest wall is. Looked at
 * part by part (each is printed on its own); the same rule as the overhang lesson, on the kernel's mesh.
 */
function printable(c: PrintCheck, body: Shape3D, bodies: CheckBodies): Pick<CheckResult, "pass" | "expected" | "actual" | "faces" | "edges"> {
  const all = bodies.parts.length > 1 ? bodies.parts : [{ name: "", body }]
  const targets = c.part ? all.filter((p) => p.name === c.part) : all
  if (c.part && !targets.length)
    throw new Error(
      ta(
        `没有叫「${c.part}」的零件${bodies.parts.length ? `（有：${bodies.parts.map((p) => p.name).join("、")}）` : ""}`,
        `No part named “${c.part}”${bodies.parts.length ? ` (there are: ${bodies.parts.map((p) => p.name).join(", ")})` : ""}`,
      ),
    )
  const tag = (name: string) => (name && targets.length > 1 ? ta(`${name}：`, `${name}: `) : "")
  const expected = expectedOf(c)

  if (c.kind === "min_wall") {
    let worst: { d: number; name: string } | null = null
    let capped = false
    const hit: number[] = []
    for (const t of targets) {
      const infos = faceInfos(t.body, [])
      try {
        const w = thinnestWall(infos.map((f) => f.face), c.min)
        capped ||= w.capped
        if (w.d !== null && (!worst || w.d < worst.d)) {
          worst = { d: w.d, name: t.name }
          hit.splice(0, hit.length, ...w.pair!.map((i) => infos[i].face.hashCode))
        }
      } finally {
        disposeInfos(infos, [])
      }
    }
    const note = capped ? ta("（面太多，只量了最可能的 400 对）", " (too many faces: only the 400 likeliest pairs were measured)") : ""
    if (worst) return { pass: false, expected, actual: ta(`${tag(worst.name)}最薄 ${fmt(worst.d)} mm${note}`, `${tag(worst.name)}thinnest ${fmt(worst.d)} mm${note}`), faces: hit, edges: [] }
    return { pass: true, expected, actual: ta(`没有比 ${fmt(c.min)} mm 更薄的地方${note}`, `nothing thinner than ${fmt(c.min)} mm${note}`), faces: [], edges: [] }
  }

  const up = UP[c.up ?? "+Z"]
  const limit = (c.kind === "overhang" ? (c.max ?? 45) : 0) + ANGLE_SLACK
  let support = 0
  let steepest = 0
  let contact = 0
  let worstPart = ""
  const hit = new Set<number>()
  for (const t of targets) {
    const m = meshShape(t.body)
    const v = m.vertices
    const at = (i: number): V3 => [v[3 * i], v[3 * i + 1], v[3 * i + 2]]
    let floor = Infinity
    for (let i = 0; i < v.length / 3; i++) floor = Math.min(floor, dot(at(i), up))
    let mine = 0
    for (const g of m.faceGroups) {
      for (let k = g.start; k < g.start + g.count; k += 3) {
        const a = at(m.triangles[k])
        const b = at(m.triangles[k + 1])
        const cc = at(m.triangles[k + 2])
        const n = cross(sub(b, a), sub(cc, a))
        const twice = len(n)
        if (twice < 1e-9) continue
        const down = -dot(n, up) / twice // 1 = facing straight down
        const onBed = [a, b, cc].every((p) => dot(p, up) - floor < ON_BED)
        if (onBed && down > 0.999) contact += twice / 2
        if (c.kind !== "overhang" || onBed) continue
        const angle = (Math.asin(Math.max(-1, Math.min(1, down))) * 180) / Math.PI
        if (angle <= limit) continue
        mine += twice / 2
        steepest = Math.max(steepest, angle)
        hit.add(g.faceId)
      }
    }
    if (mine > 0 && mine >= support - mine) worstPart = t.name
    support += mine
  }
  if (c.kind === "bed") return { pass: c.min === undefined || contact >= c.min - 1e-6, expected, actual: ta(`贴在平台上 ${fmt(contact)} mm²`, `${fmt(contact)} mm² on the bed`), faces: [], edges: [] }
  const allowed = c.area ?? 1
  if (support <= allowed) return { pass: true, expected, actual: support > 0 ? ta(`需要支撑的只有 ${fmt(support)} mm²`, `only ${fmt(support)} mm² needs support`) : ta("不需要支撑", "no support needed"), faces: [], edges: [] }
  return {
    pass: false,
    expected,
    actual: ta(
      `${tag(worstPart)}需要支撑 ${fmt(support)} mm²（最大 ${fmt(steepest)}°，水平朝下的面也算，短的桥接打印机能跨过去）`,
      `${tag(worstPart)}${fmt(support)} mm² needs support (up to ${fmt(steepest)}°; faces pointing straight down count too; the printer can bridge short spans)`,
    ),
    faces: [...hit],
    edges: [],
  }
}

type FitCheck = Extract<Check, { kind: "clearance" | "interference" }>
type Where = Extract<Check, { kind: "gap" }>["a"]

/** A reference body or a part, by name; with a part, the rest of the model (the other parts) is the other side. */
function named(name: string, bodies: CheckBodies): { shape: AnyShape; rest: AnyShape[] | null } | null {
  const ref = bodies.refs.get(name)
  if (ref) return { shape: ref, rest: null }
  const k = bodies.parts.findIndex((p) => p.name === name)
  if (k < 0) return null
  const others = bodies.parts.filter((_, i) => i !== k).map((p) => p.body)
  return { shape: bodies.parts[k].body, rest: others.length ? others : null }
}

const namesOf = (bodies: CheckBodies) => [...new Set([...bodies.refs.keys(), ...bodies.parts.map((p) => p.name)])]

/** The model against a reference body or one of its parts: the gap between them, and whether they overlap. */
function fit(c: FitCheck, body: Shape3D, bodies: CheckBodies): Omit<CheckResult, "id" | "said"> {
  const expected = expectedOf(c)
  const hit = named(c.ref, bodies)
  if (!hit) {
    const names = namesOf(bodies)
    throw new Error(
      ta(
        `没有参考体或零件「${c.ref}」${names.length ? `：现在有 ${names.join("、")}` : "：要先用 import 导入，ref 写那个特征的 id"}`,
        `No reference body or part “${c.ref}”${names.length ? `: there are ${names.join(", ")}` : ": bring it in with import first, and set ref to that feature's id"}`,
      ),
    )
  }
  if (hit.rest === null && bodies.parts.some((p) => p.name === c.ref)) throw new Error(ta(`只有「${c.ref}」一个零件，没有别的可以比`, `“${c.ref}” is the only part: there is nothing to compare it with`))
  return fitOf(c, expected, hit.rest ?? [body], hit.shape)
}

function fitOf(c: FitCheck, expected: string, other: AnyShape[], ref: AnyShape): Omit<CheckResult, "id" | "said"> {
  // Solid by solid (pieces.ts): a vendor's board model is hundreds of solids, and as one compound a
  // single boolean against it ran for many minutes and out of memory. Apart: no boolean at all.
  const { d: gap, overlap } = relation(other, ref, true, PIECES ?? undefined)
  const where =
    overlap > 1e-6 ? ta(`相交 ${fmt(overlap)} mm³`, `intersecting ${fmt(overlap)} mm³`) : gap > 1e-6 ? ta(`最小间隙 ${fmt(gap)} mm`, `smallest gap ${fmt(gap)} mm`) : ta("贴在一起", "touching")
  if (c.kind === "interference") return { pass: overlap <= 1e-6, expected, actual: where, faces: [], edges: [] }
  return { pass: overlap <= 1e-6 && gap >= c.min - (c.tol ?? 0.01), expected, actual: where, faces: [], edges: [] }
}

/** The shape one side of a `gap` stands for (made shapes go into `owned`) and the faces / edges to light up. */
function whereShape(w: Where, topo: Topo, scope: Scope, bodies: CheckBodies, owned: AnyShape[]): { shape: AnyShape; solid: boolean; faces: number[]; edges: number[] } {
  if (w.part) {
    const ref = bodies.refs.get(w.part)
    if (ref) return { shape: ref, solid: true, faces: [], edges: [] }
    const p = bodies.parts.find((x) => x.name === w.part)
    if (!p) {
      const names = namesOf(bodies)
      throw new Error(ta(`没有零件或参考体「${w.part}」${names.length ? `：现在有 ${names.join("、")}` : ""}`, `No part or reference body “${w.part}”${names.length ? `: there are ${names.join(", ")}` : ""}`))
    }
    return { shape: p.body, solid: true, faces: [], edges: [] }
  }
  const { faces, edges } = topo()
  if (w.feature) {
    const mine = faces.filter((f) => f.origin === w.feature)
    if (!mine.length) throw new Error(ta(`特征「${w.feature}」现在没有面（被后面的特征盖掉了，或者 id 写错了）`, `Feature “${w.feature}” has no faces now (a later feature covered them, or the id is wrong)`))
    const shape = makeCompound(mine.map((f) => f.face.clone())) as unknown as AnyShape
    owned.push(shape)
    return { shape, solid: false, faces: mine.map((f) => f.face.hashCode), edges: [] }
  }
  if (w.face) {
    const got = selectFaces(w.face, facesFor(w.face, faces), scope)
    if (got.length !== 1) throw new Error(oneFace(got.length))
    return { shape: got[0].face, solid: false, faces: [got[0].face.hashCode], edges: [] }
  }
  if (w.edge) {
    const got = pickEdges(w.edge, edges, faces, scope)
    if (got.length !== 1) throw new Error(oneEdge(got.length))
    return { shape: got[0].edge, solid: false, faces: [], edges: [got[0].edge.hashCode] }
  }
  throw new Error(ta("a、b 各写 face、edge、feature、part 之一", "Give a and b one each of face, edge, feature, part"))
}

const oneFace = (n: number) => ta(`选择器要正好选中一个面，现在选中了 ${n} 个`, `The selector must select exactly one face; it selects ${n}`)
const oneEdge = (n: number) => ta(`选择器要正好选中一条边，现在选中了 ${n} 条`, `The selector must select exactly one edge; it selects ${n}`)

/** The shortest distance between two places (0 when solids overlap, with the overlap reported). */
function gap(c: Extract<Check, { kind: "gap" }>, topo: Topo, scope: Scope, bodies: CheckBodies): Omit<CheckResult, "id" | "said"> {
  if (c.min === undefined && c.max === undefined) throw new Error(ta("gap 至少写 min 或 max 之一（max: 0 = 必须贴上）", "gap needs at least one of min or max (max: 0 = must touch)"))
  const owned: AnyShape[] = []
  try {
    const a = whereShape(c.a, topo, scope, bodies, owned)
    const b = whereShape(c.b, topo, scope, bodies, owned)
    const r = relation(a.shape, b.shape, a.solid && b.solid, PIECES ?? undefined)
    const tol = c.tol ?? 0.01
    const d = r.overlap > 1e-6 ? 0 : r.d
    const pass = (c.max === undefined || d <= c.max + tol) && (c.min === undefined || (r.overlap <= 1e-6 && d >= c.min - tol))
    return { pass, expected: expectedOf(c), actual: relationText(r), faces: [...a.faces, ...b.faces], edges: [...a.edges, ...b.edges] }
  } finally {
    owned.forEach((s) => s.delete())
  }
}

/** Where a face or edge sits: a plane's centre, a cylinder's or circle's centre, a line's midpoint. */
function position(c: Extract<Check, { kind: "position" }>, faces: FaceInfo[], edges: EdgeInfo[], scope: Scope): Omit<CheckResult, "id" | "said"> {
  const tol = c.tol ?? 0.01
  let p: V3
  let lit: { faces: number[]; edges: number[] }
  if (c.at.face) {
    const got = selectFaces(c.at.face, facesFor(c.at.face, faces), scope)
    if (got.length !== 1) throw new Error(oneFace(got.length))
    p = positionOf("face", got[0])
    lit = { faces: [got[0].face.hashCode], edges: [] }
  } else if (c.at.edge) {
    const got = pickEdges(c.at.edge, edges, faces, scope)
    if (got.length !== 1) throw new Error(oneEdge(got.length))
    p = positionOf("edge", got[0])
    lit = { faces: [], edges: [got[0].edge.hashCode] }
  } else throw new Error(ta("at 写 face 或 edge", "Set at to face or edge"))
  const AX = { X: 0, Y: 1, Z: 2 } as const
  if (Array.isArray(c.expect)) {
    if (c.axis) throw new Error(ta("写了 axis 时，expect 是一个数", "With axis, expect is a single number"))
    const want = c.expect
    return { pass: want.every((w, i) => Math.abs(w - p[i]) <= tol), expected: expectedOf(c), actual: `(${p.map(fmt).join(", ")})`, ...lit }
  }
  if (!c.axis) throw new Error(ta("expect 是一个数时要写 axis（X、Y 或 Z）", "When expect is a single number, write axis (X, Y or Z)"))
  const v = p[AX[c.axis]]
  return { pass: Math.abs(v - c.expect) <= tol, expected: expectedOf(c), actual: `${c.axis} = ${fmt(v)}`, ...lit }
}

/** The whole model's outer size: its box, no faces needed. */
function size(c: Extract<Check, { kind: "size" }>, [a, b]: [V3, V3]): Omit<CheckResult, "id" | "said"> {
  const tol = c.tol ?? 0.01
  const size = sub(b, a)
  const want = c.axes === "any" ? [...c.expect].sort((x, y) => x - y) : c.expect
  const got = c.axes === "any" ? [...size].sort((x, y) => x - y) : size
  return { pass: want.every((w, i) => Math.abs(w - got[i]) <= tol), expected: expectedOf(c), actual: size.map(fmt).join(" × "), faces: [], edges: [] }
}

function one(c: Exclude<Check, FitCheck | PrintCheck | { kind: "gap" | "position" | "size" }>, body: Shape3D, origins: string[], faces: FaceInfo[], edges: ReturnType<typeof edgeInfos>, scope: Scope): Omit<CheckResult, "id" | "said"> {
  const tol = c.tol ?? (c.kind === "angle" ? 0.05 : 0.01)
  const expected = expectedOf(c)
  const pickFaces = (sel: FaceSelector) => {
    const got = selectFaces(sel, facesFor(sel, faces), scope)
    if (!got.length) throw new Error(ta("没找到要量的东西", "Found nothing to measure"))
    if (got.length > MAX_ITEMS) throw new Error(ta("量的范围太大，缩小选择器", "Too much to measure: narrow the selector"))
    return got
  }
  switch (c.kind) {
    case "thickness": {
      const sel = pickFaces(c.faces)
      let best = Infinity
      for (const a of sel) {
        if (a.kind !== "plane" || !a.normal) continue
        for (const b of faces) {
          if (b === a || b.kind !== "plane" || !b.normal || dot(a.normal, b.normal) > -0.999) continue
          const gap = Math.abs(dot(sub(b.center, a.center), a.normal))
          // Facing planes that overlap across the wall: their shortest distance is the plane gap.
          if (gap > 1e-6 && gap < best && Math.abs(faceDistance(a, b) - gap) < 1e-6) best = gap
        }
      }
      if (!Number.isFinite(best)) throw new Error(ta("选中的面对面没有平行的另一侧", "The selected faces have no parallel face opposite them"))
      return { pass: Math.abs(best - c.expect) <= tol, expected, actual: `${fmt(best)} mm`, faces: sel.map((f) => f.face.hashCode), edges: [] }
    }
    case "holes":
    case "pcd": {
      const sel = pickFaces(c.faces).filter((f) => f.kind === "cylinder")
      const holes = axesOf(sel)
      const hashes = sel.map((f) => f.face.hashCode)
      if (c.kind === "holes") {
        const d = c.thread ? METRIC[c.thread as ScrewSize]?.tap : c.d
        if (c.thread && d === undefined) throw new Error(ta(`不认识的螺纹规格「${c.thread}」`, `Unknown thread size “${c.thread}”`))
        const ds = holes.map((h) => 2 * h.r)
        const sizeOk = d === undefined || ds.every((x) => Math.abs(x - d) <= tol)
        const actual = `${holeCount(holes.length)}${ds.length ? ` ⌀${[...new Set(ds.map(fmt))].join("/")}` : ""}`
        return { pass: holes.length === c.count && sizeOk, expected, actual, faces: hashes, edges: [] }
      }
      const axis: V3 = c.axis === "X" ? [1, 0, 0] : c.axis === "Y" ? [0, 1, 0] : [0, 0, 1]
      const radii = holes.map((h) => len(cross(h.p, axis)))
      const pcds = [...new Set(radii.map((r) => fmt(2 * r)))]
      const pass = holes.length === c.count && radii.every((r) => Math.abs(2 * r - c.expect) <= tol)
      return { pass, expected, actual: ta(`${holes.length} 个在 ⌀${pcds.join("/")} 上`, `${holeCount(holes.length)} on ⌀${pcds.join("/")}`), faces: hashes, edges: [] }
    }
    case "distance":
    case "angle": {
      const targets = [c.a, c.b].map((p) => {
        const isFace = c.kind === "angle" || !!(p as { face?: FaceSelector }).face
        if (isFace) {
          const sel = c.kind === "angle" ? (p as FaceSelector) : (p as { face: FaceSelector }).face
          const got = pickFaces(sel)
          if (got.length !== 1) throw new Error(oneFace(got.length))
          return { kind: "face" as const, hash: got[0].face.hashCode, point: got[0].center }
        }
        const got = pickEdges((p as { edge?: EdgeSelector }).edge ?? {}, edges, faces, scope)
        if (got.length !== 1) throw new Error(oneEdge(got.length))
        return { kind: "edge" as const, hash: got[0].edge.hashCode, point: got[0].mid }
      })
      // One end on a reference body: measure in the model and those bodies together (faces keep their identity).
      const refs = [...(REFS?.used ?? [])]
      const whole = refs.length ? compoundOf([body, ...refs]) : body
      let m
      try {
        m = measure(whole, origins, targets)
      } finally {
        if (whole !== body) whole.delete()
      }
      if (!m) throw new Error(ta("没找到要量的东西", "Found nothing to measure"))
      const pick = (...keys: BetweenKey[]) => m.between.find((b) => isBetween(b.name, ...keys))
      const row =
        c.kind === "angle"
          ? (pick("planeAngle", "axisPlaneAngle", "axisAngle") ?? (pick("planeGap") ? { name: "", value: "0°" } : undefined))
          : pick("planeGap", "centreToPlane", "axisGap", "centres", "edgeToPlane", "parallelGap") ?? pick("shortest")
      if (!row) throw new Error(ta("这两处之间量不出这个量", "This can't be measured between these two places"))
      const v = parseFloat(row.value)
      return {
        pass: Math.abs(v - c.expect) <= tol,
        expected,
        actual: c.kind === "angle" ? `${fmt(v)}°` : `${fmt(v)} mm`,
        faces: targets.filter((t) => t.kind === "face").map((t) => t.hash),
        edges: targets.filter((t) => t.kind === "edge").map((t) => t.hash),
      }
    }
    case "volume": {
      const v = measureShapeVolumeProperties(body).volume
      const slack = 0.005 * v
      const pass = (c.min === undefined || v >= c.min - slack) && (c.max === undefined || v <= c.max + slack)
      return { pass, expected, actual: `${fmt(v / 1000)} cm³`, faces: [], edges: [] }
    }
  }
}

/** Cylinder faces grouped by axis line: one hole each (a counterbore's two radii count once, by the smaller). */
function axesOf(cyls: FaceInfo[]): { p: V3; d: V3; r: number }[] {
  const out: { p: V3; d: V3; r: number }[] = []
  for (const f of cyls) {
    const ax = cylinderAxis(f)
    if (!ax) continue
    const same = out.find((h) => Math.abs(Math.abs(dot(h.d, ax.d)) - 1) < 1e-6 && len(cross(sub(ax.p, h.p), h.d)) < 1e-4)
    if (same) same.r = Math.min(same.r, ax.r)
    else out.push(ax)
  }
  return out
}

export function cylinderAxis(f: FaceInfo): { p: V3; d: V3; r: number } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ad: any = (f.face as any)._geomAdaptor()
  try {
    const c = ad.Cylinder()
    const ax = c.Axis()
    const loc = ax.Location()
    const dir = ax.Direction()
    return { p: [loc.X(), loc.Y(), loc.Z()], d: [dir.X(), dir.Y(), dir.Z()], r: c.Radius() }
  } catch {
    return null
  } finally {
    ad.delete?.()
  }
}

function faceDistance(a: FaceInfo, b: FaceInfo): number {
  const oc: OC = getOC()
  const dss = new oc.BRepExtrema_DistShapeShape()
  try {
    dss.LoadS1(a.face.wrapped)
    dss.LoadS2(b.face.wrapped)
    dss.Perform()
    return dss.IsDone() ? dss.Value() : Infinity
  } finally {
    dss.delete()
  }
}
