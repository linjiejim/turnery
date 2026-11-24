import * as THREE from "three"

/**
 * A small quad-mesh toolkit for 「SubD 推拉造型」: a control cage (quads, closed), push-pull edits
 * (extrude a face, move a face along its normal), Catmull–Clark subdivision with infinitely sharp
 * creases (DeRose, Kass & Truong 1998), and the bookkeeping to show the limit surface: which cage
 * face every child face came from, crease-aware normals, and extraordinary (star) vertices.
 *
 * Faces are vertex index loops, counter-clockwise seen from outside. Subdivision keeps vertex
 * indices: cage vertex i is still vertex i at every level, moving towards its limit position.
 */
export type Mesh = { v: THREE.Vector3[]; f: number[][]; crease: Set<string> }

export const ek = (a: number, b: number) => (a < b ? `${a}_${b}` : `${b}_${a}`)

export function cloneMesh(m: Mesh): Mesh {
  return { v: m.v.map((p) => p.clone()), f: m.f.map((f) => [...f]), crease: new Set(m.crease) }
}

/** An axis-aligned box from min to max corner. */
export function box(min: THREE.Vector3, max: THREE.Vector3): Mesh {
  const v: THREE.Vector3[] = []
  for (let i = 0; i < 8; i++) v.push(new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z))
  const f = [
    [0, 2, 3, 1], // −z
    [4, 5, 7, 6], // +z
    [0, 1, 5, 4], // −y
    [2, 6, 7, 3], // +y
    [0, 4, 6, 2], // −x
    [1, 3, 7, 5], // +x
  ]
  return { v, f, crease: new Set() }
}

export function faceCentre(m: Mesh, fi: number) {
  const c = new THREE.Vector3()
  for (const i of m.f[fi]) c.add(m.v[i])
  return c.divideScalar(m.f[fi].length)
}

/** Newell normal (unit) of a face. */
export function faceNormal(m: Mesh, fi: number) {
  const n = new THREE.Vector3()
  const f = m.f[fi]
  for (let i = 0; i < f.length; i++) {
    const a = m.v[f[i]]
    const b = m.v[f[(i + 1) % f.length]]
    n.x += (a.y - b.y) * (a.z + b.z)
    n.y += (a.z - b.z) * (a.x + b.x)
    n.z += (a.x - b.x) * (a.y + b.y)
  }
  return n.normalize()
}

/** Push a face out by d: the face moves, four new side faces join it to where it was. The face keeps its index. */
export function extrude(m: Mesh, fi: number, d: number): Mesh {
  const out = cloneMesh(m)
  const n = faceNormal(m, fi)
  const loop = m.f[fi]
  const moved = loop.map((i) => {
    out.v.push(m.v[i].clone().addScaledVector(n, d))
    return out.v.length - 1
  })
  out.f[fi] = moved
  for (let i = 0; i < loop.length; i++) {
    const j = (i + 1) % loop.length
    out.f.push([loop[i], loop[j], moved[j], moved[i]])
    // A crease on the face's rim moves up with the face.
    if (m.crease.has(ek(loop[i], loop[j]))) {
      out.crease.delete(ek(loop[i], loop[j]))
      out.crease.add(ek(moved[i], moved[j]))
    }
  }
  return out
}

/** Move a face's vertices along its normal. */
export function moveFace(m: Mesh, fi: number, d: number): Mesh {
  const out = cloneMesh(m)
  const n = faceNormal(m, fi)
  for (const i of m.f[fi]) out.v[i].addScaledVector(n, d)
  return out
}

/** The face whose normal is closest to `dir` among those whose centre is nearest `near`. */
export function findFace(m: Mesh, near: THREE.Vector3, dir: THREE.Vector3) {
  let best = -1
  let score = Infinity
  m.f.forEach((_, fi) => {
    if (faceNormal(m, fi).dot(dir) < 0.9) return
    const d = faceCentre(m, fi).distanceTo(near)
    if (d < score) {
      score = d
      best = fi
    }
  })
  return best
}

type Edge = { a: number; b: number; faces: number[] }

export function edgesOf(m: Mesh) {
  const map = new Map<string, Edge>()
  m.f.forEach((f, fi) => {
    for (let i = 0; i < f.length; i++) {
      const a = f[i]
      const b = f[(i + 1) % f.length]
      const k = ek(a, b)
      const e = map.get(k)
      if (e) e.faces.push(fi)
      else map.set(k, { a, b, faces: [fi] })
    }
  })
  return map
}

/** Number of edges at each vertex. */
export function valences(m: Mesh) {
  const val = new Array(m.v.length).fill(0)
  for (const e of edgesOf(m).values()) {
    val[e.a]++
    val[e.b]++
  }
  return val
}

/** One Catmull–Clark step. `origin` says which cage face each face came from; the children inherit it. */
export function subdivide(m: Mesh, origin: number[]): { mesh: Mesh; origin: number[] } {
  const edges = edgesOf(m)
  const nv = m.v.length
  const fp = m.f.map((f) => {
    const c = new THREE.Vector3()
    for (const i of f) c.add(m.v[i])
    return c.divideScalar(f.length)
  })
  const eIndex = new Map<string, number>()
  const ep: THREE.Vector3[] = []
  const sharp = (k: string, e: Edge) => m.crease.has(k) || e.faces.length < 2
  for (const [k, e] of edges) {
    eIndex.set(k, nv + ep.length)
    const p = m.v[e.a].clone().add(m.v[e.b])
    if (sharp(k, e)) ep.push(p.multiplyScalar(0.5))
    else ep.push(p.add(fp[e.faces[0]]).add(fp[e.faces[1]]).multiplyScalar(0.25))
  }
  // Per-vertex neighbourhoods.
  const vEdges: Edge[][] = m.v.map(() => [])
  const vFaces: number[][] = m.v.map(() => [])
  for (const e of edges.values()) {
    vEdges[e.a].push(e)
    vEdges[e.b].push(e)
  }
  m.f.forEach((f, fi) => f.forEach((i) => vFaces[i].push(fi)))
  const vp = m.v.map((p, i) => {
    const es = vEdges[i]
    const creased = es.filter((e) => sharp(ek(e.a, e.b), e))
    if (creased.length >= 3) return p.clone()
    if (creased.length === 2) {
      const o = creased.map((e) => m.v[e.a === i ? e.b : e.a])
      return p.clone().multiplyScalar(6).add(o[0]).add(o[1]).multiplyScalar(1 / 8)
    }
    const n = es.length
    const F = new THREE.Vector3()
    for (const fi of vFaces[i]) F.add(fp[fi])
    F.divideScalar(vFaces[i].length)
    const R = new THREE.Vector3()
    for (const e of es) R.add(m.v[e.a]).add(m.v[e.b])
    R.divideScalar(2 * n)
    return F.add(R.multiplyScalar(2)).addScaledVector(p, n - 3).divideScalar(n)
  })
  const v = [...vp, ...ep, ...fp]
  const f: number[][] = []
  const og: number[] = []
  m.f.forEach((face, fi) => {
    const c = nv + ep.length + fi
    for (let i = 0; i < face.length; i++) {
      const a = face[i]
      const next = face[(i + 1) % face.length]
      const prev = face[(i - 1 + face.length) % face.length]
      f.push([a, eIndex.get(ek(a, next))!, c, eIndex.get(ek(prev, a))!])
      og.push(origin[fi])
    }
  })
  const crease = new Set<string>()
  for (const k of m.crease) {
    const e = edges.get(k)
    if (!e) continue
    const mid = eIndex.get(k)!
    crease.add(ek(e.a, mid))
    crease.add(ek(mid, e.b))
  }
  return { mesh: { v, f, crease }, origin: og }
}

export function subdivideN(m: Mesh, levels: number) {
  let cur = { mesh: m, origin: m.f.map((_, i) => i) }
  for (let i = 0; i < levels; i++) cur = subdivide(cur.mesh, cur.origin)
  return cur
}

/**
 * Triangles with normals smoothed across ordinary edges and split along creases (`allSharp`: flat
 * faces, for the cage itself). Colours per face if given. Returns the cage face of every triangle.
 */
export function meshGeometry(m: Mesh, origin: number[], opts: { allSharp?: boolean; color?: (cageFace: number) => THREE.Color } = {}) {
  const fn = m.f.map((_, fi) => faceNormal(m, fi))
  // Corner ids: one per (face, vertex); corners joined across smooth edges share a normal.
  const base: number[] = []
  let count = 0
  for (const f of m.f) {
    base.push(count)
    count += f.length
  }
  const parent = Array.from({ length: count }, (_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const cornerOf = (fi: number, vi: number) => base[fi] + m.f[fi].indexOf(vi)
  if (!opts.allSharp)
    for (const [k, e] of edgesOf(m)) {
      if (e.faces.length !== 2 || m.crease.has(k)) continue
      const [f1, f2] = e.faces
      for (const vi of [e.a, e.b]) {
        const r1 = find(cornerOf(f1, vi))
        const r2 = find(cornerOf(f2, vi))
        if (r1 !== r2) parent[r1] = r2
      }
    }
  const acc = Array.from({ length: count }, () => new THREE.Vector3())
  m.f.forEach((f, fi) => f.forEach((_, i) => acc[find(base[fi] + i)].add(fn[fi])))
  const pos: number[] = []
  const nor: number[] = []
  const col: number[] = []
  const triFace: number[] = []
  m.f.forEach((f, fi) => {
    const c = opts.color?.(origin[fi])
    for (let i = 1; i < f.length - 1; i++) {
      for (const k of [0, i, i + 1]) {
        const p = m.v[f[k]]
        const n = acc[find(base[fi] + k)].clone().normalize()
        pos.push(p.x, p.y, p.z)
        nor.push(n.x, n.y, n.z)
        if (c) col.push(c.r, c.g, c.b)
      }
      triFace.push(origin[fi])
    }
  })
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  if (opts.color) g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
  return { geometry: g, triFace }
}

/** Edges of the subdivided mesh that separate children of different cage faces: the NURBS patch boundaries. */
export function patchBoundaries(m: Mesh, origin: number[]) {
  const out: number[] = []
  for (const e of edgesOf(m).values()) {
    if (e.faces.length === 2 && origin[e.faces[0]] === origin[e.faces[1]]) continue
    const a = m.v[e.a]
    const b = m.v[e.b]
    out.push(a.x, a.y, a.z, b.x, b.y, b.z)
  }
  return out
}

/** The example handle: a block, pushed up, across and down into an arch. */
export function presetHandle(): { mesh: Mesh; extrusions: number } {
  let m = box(new THREE.Vector3(-28, -8, 0), new THREE.Vector3(-12, 8, 14))
  const up = new THREE.Vector3(0, 0, 1)
  const right = new THREE.Vector3(1, 0, 0)
  m = extrude(m, findFace(m, new THREE.Vector3(-20, 0, 14), up), 16)
  m = extrude(m, findFace(m, new THREE.Vector3(-12, 0, 22), right), 12)
  m = extrude(m, findFace(m, new THREE.Vector3(0, 0, 22), right), 12)
  m = extrude(m, findFace(m, new THREE.Vector3(12, 0, 22), right), 16)
  m = extrude(m, findFace(m, new THREE.Vector3(20, 0, 14), up.clone().negate()), 14)
  return { mesh: m, extrusions: 5 }
}

/** The starting block. */
export const startBlock = () => box(new THREE.Vector3(-14, -9, 0), new THREE.Vector3(14, 9, 16))
