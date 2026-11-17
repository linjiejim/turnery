// Hidden-line removal on the mesh: which bits of the model's edges, and of the outlines where curved
// faces turn away from the eye, can be seen. A depth picture of the faces is drawn here in software
// (no graphics card needed, so the kernel thread and a headless export can use it too), and every
// line is checked against it along its length.
//
// OpenCascade's exact hidden-line removal works on the B-rep: right to the micron, and minutes on an
// assembly of a couple of hundred parts (the LetPot family, 179 parts: 4 min for three views). This
// takes well under a second there; its curves are the mesh's polylines, as fine as the view draws them.
//
// Plain arrays, no three.js: view matrices are column-major 4×4 (as THREE.Matrix4.elements).

export type V2 = [number, number]
export type V3 = [number, number, number]

/** How the lines are seen: a view matrix (world → eye, the eye looking down −Z) and a projection. */
export type HlrView = {
  view: ArrayLike<number>
  /** Orthographic: half the width and height of what's seen; perspective: tan(half the vertical angle) and width / height. */
  projection: { ortho: true; halfW: number; halfH: number } | { ortho: false; tanHalfFov: number; aspect: number }
  /** The depth picture's size in pixels: lines are judged at this resolution. */
  width: number
  height: number
}

/**
 * One part: its triangles and edge points (pairs) in the file's coordinates, and where it's shown.
 * `faces`, the face each triangle is on (one per triangle), lets seams go: the edge where a closed
 * face (a cylinder's side) meets itself is in the mesh's edges, but no drawing shows it.
 */
export type HlrPart = { id: number; vertices: Float32Array; index: Uint32Array; edges: Float32Array; offset?: V3; faces?: ArrayLike<number> }

/** A run of a line, from `a` to `b`, in normalised picture coordinates (−1 … 1, y up). */
export type HlrLine = { a: V2; b: V2; part: number }

export type HlrOptions = {
  /** A section: what's on the negative side of the plane (world) is cut away, the cut is outlined. */
  section?: { normal: V3; constant: number } | null
  /** Keep the hidden runs too (dashed on a drawing). */
  hidden?: boolean
}

export type HlrResult = {
  visible: HlrLine[]
  hidden: HlrLine[]
  /** The section's cut: segments (pairs of points) where the plane meets each part, for hatching. */
  cut: V2[]
}

// ------------------------------------------------------------------ outlines

/**
 * Every vertex's point, numbered by position: faces don't share vertices, and neither do a closed
 * face's two sides along its seam, but the same point is the same point. Made once per vertex buffer
 * (the parts of a display share one).
 */
const POINTS = new WeakMap<Float32Array, { ids: Int32Array; byKey: Map<string, number> }>()
const pointKey = (x: number, y: number, z: number) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`
function points(vertices: Float32Array) {
  let known = POINTS.get(vertices)
  if (!known) {
    const byKey = new Map<string, number>()
    const ids = new Int32Array(vertices.length / 3)
    for (let i = 0; i < ids.length; i++) {
      const k = pointKey(vertices[i * 3], vertices[i * 3 + 1], vertices[i * 3 + 2])
      let n = byKey.get(k)
      if (n === undefined) byKey.set(k, (n = byKey.size))
      ids[i] = n
    }
    POINTS.set(vertices, (known = { ids, byKey }))
  }
  return known
}
/** A triangle side by its two points, either way round. */
const sideKey = (a: number, b: number) => Math.min(a, b) * 2 ** 26 + Math.max(a, b)

/**
 * A part's triangle sides shared by two triangles (vertex, vertex, triangle, triangle): where one
 * faces the eye and the other doesn't, the surface turns away there (an outline). Sides are matched
 * by position, so an outline along a seam (a cylinder's, where its side meets itself) is found too.
 * Only where the surface is smooth (the two within 60°): a sharp edge is drawn as an edge already.
 */
export type Adjacency = { pairs: Uint32Array; normals: Float32Array; centres: Float32Array }
const ADJACENCY = new WeakMap<Uint32Array, { vertices: Float32Array; adj: Adjacency }>()

export function adjacency(vertices: Float32Array, index: Uint32Array): Adjacency {
  const known = ADJACENCY.get(index)
  if (known?.vertices === vertices) return known.adj
  const v = vertices
  const { ids } = points(vertices)
  const n = index.length / 3
  const normals = new Float32Array(n * 3)
  const centres = new Float32Array(n * 3)
  const first = new Map<number, number>()
  const pairs: number[] = []
  for (let t = 0; t < n; t++) {
    const a = index[t * 3] * 3
    const b = index[t * 3 + 1] * 3
    const c = index[t * 3 + 2] * 3
    const ux = v[b] - v[a], uy = v[b + 1] - v[a + 1], uz = v[b + 2] - v[a + 2]
    const wx = v[c] - v[a], wy = v[c + 1] - v[a + 1], wz = v[c + 2] - v[a + 2]
    normals[t * 3] = uy * wz - uz * wy
    normals[t * 3 + 1] = uz * wx - ux * wz
    normals[t * 3 + 2] = ux * wy - uy * wx
    centres[t * 3] = (v[a] + v[b] + v[c]) / 3
    centres[t * 3 + 1] = (v[a + 1] + v[b + 1] + v[c + 1]) / 3
    centres[t * 3 + 2] = (v[a + 2] + v[b + 2] + v[c + 2]) / 3
    for (let k = 0; k < 3; k++) {
      const i = index[t * 3 + k]
      const j = index[t * 3 + ((k + 1) % 3)]
      const key = sideKey(ids[i], ids[j])
      const other = first.get(key)
      if (other === undefined) first.set(key, t)
      else {
        first.delete(key)
        const ax = normals[other * 3], ay = normals[other * 3 + 1], az = normals[other * 3 + 2]
        const bx = normals[t * 3], by = normals[t * 3 + 1], bz = normals[t * 3 + 2]
        const dot = ax * bx + ay * by + az * bz
        if (dot > 0.5 * Math.sqrt((ax * ax + ay * ay + az * az) * (bx * bx + by * by + bz * bz))) pairs.push(i, j, other, t)
      }
    }
  }
  const out = { pairs: Uint32Array.from(pairs), normals, centres }
  ADJACENCY.set(index, { vertices, adj: out })
  return out
}

/**
 * The seams among a part's edges: edge segments with triangles on both sides all on one face. The
 * mesh has them as edges (a cylinder's side closes there) but no drawing shows them.
 * Returns a test on an edge segment's two ends (in the part's own coordinates).
 */
const SEAMS = new WeakMap<Uint32Array, { vertices: Float32Array; seam: (a: V3, b: V3) => boolean }>()
export function seams(vertices: Float32Array, index: Uint32Array, faces: ArrayLike<number>): (a: V3, b: V3) => boolean {
  const known = SEAMS.get(index)
  if (known?.vertices === vertices) return known.seam
  const { ids, byKey } = points(vertices)
  // Per side: the face on it, or -2 once two different faces (a crease: a real edge) have been seen.
  const sides = new Map<number, number>()
  const count = new Map<number, number>()
  for (let t = 0; t < index.length / 3; t++) {
    const f = faces[t]
    for (let k = 0; k < 3; k++) {
      const key = sideKey(ids[index[t * 3 + k]], ids[index[t * 3 + ((k + 1) % 3)]])
      const was = sides.get(key)
      sides.set(key, was === undefined || was === f ? f : -2)
      count.set(key, (count.get(key) ?? 0) + 1)
    }
  }
  const seam = (a: V3, b: V3) => {
    const ia = byKey.get(pointKey(a[0], a[1], a[2]))
    const ib = byKey.get(pointKey(b[0], b[1], b[2]))
    if (ia === undefined || ib === undefined) return false
    const key = sideKey(ia, ib)
    return (sides.get(key) ?? -2) >= 0 && (count.get(key) ?? 0) >= 2
  }
  SEAMS.set(index, { vertices, seam })
  return seam
}

// ------------------------------------------------------------------ the view

/** The eye's position (world) and the way it looks, from a view matrix. */
function eyeOf(m: ArrayLike<number>) {
  const t = [m[12], m[13], m[14]]
  return {
    eye: [-(m[0] * t[0] + m[1] * t[1] + m[2] * t[2]), -(m[4] * t[0] + m[5] * t[1] + m[6] * t[2]), -(m[8] * t[0] + m[9] * t[1] + m[10] * t[2])] as V3,
    forward: [-m[2], -m[6], -m[10]] as V3,
  }
}

/** Projects world points: picture pixels (row 0 at the top), normalised coordinates, depth along the line of sight. */
function projector(v: HlrView) {
  const m = v.view
  const W = v.width
  const H = v.height
  const p = v.projection
  const out = { x: 0, y: 0, nx: 0, ny: 0, depth: 0 }
  const at = (x: number, y: number, z: number) => {
    const vx = m[0] * x + m[4] * y + m[8] * z + m[12]
    const vy = m[1] * x + m[5] * y + m[9] * z + m[13]
    const vz = m[2] * x + m[6] * y + m[10] * z + m[14]
    out.depth = -vz
    if (p.ortho) {
      out.nx = vx / p.halfW
      out.ny = vy / p.halfH
    } else {
      const d = out.depth > 1e-9 ? out.depth : 1e-9
      out.nx = vx / (d * p.tanHalfFov * p.aspect)
      out.ny = vy / (d * p.tanHalfFov)
    }
    out.x = ((out.nx + 1) / 2) * W
    out.y = ((1 - out.ny) / 2) * H
    return out
  }
  /** The size of a pixel at a depth, in model units. */
  const pixel = (depth: number) => (p.ortho ? (2 * p.halfH) / H : (2 * depth * p.tanHalfFov) / H)
  return { at, pixel }
}

// ------------------------------------------------------------------ depth picture

/**
 * The nearest face at every pixel (Infinity where there is none). With a section, what's on the
 * cut-away side isn't there, and where a part is cut open its cut face is: along a pixel's ray, the
 * first face of that part beyond the plane is one seen from inside (a back face) exactly when the ray
 * starts inside the part, at the plane. Worked out part by part, so another part in front or behind
 * can't fool it.
 */
export function depthPicture(parts: HlrPart[], v: HlrView, section: HlrOptions["section"] = null): Float32Array {
  const W = v.width
  const H = v.height
  const depth = new Float32Array(W * H).fill(Infinity)
  const m = v.view
  const p = v.projection
  // The section plane in eye space: n · X + c = 0, kept where positive.
  let pn: V3 | null = null
  let pc = 0
  if (section) {
    const [nx, ny, nz] = section.normal
    pn = [m[0] * nx + m[4] * ny + m[8] * nz, m[1] * nx + m[5] * ny + m[9] * nz, m[2] * nx + m[6] * ny + m[10] * nz]
    const k = -section.constant
    const px = nx * k, py = ny * k, pz = nz * k
    const qx = m[0] * px + m[4] * py + m[8] * pz + m[12]
    const qy = m[1] * px + m[5] * py + m[9] * pz + m[13]
    const qz = m[2] * px + m[6] * py + m[10] * pz + m[14]
    pc = -(pn[0] * qx + pn[1] * qy + pn[2] * qz)
  }
  /** A pixel's ray, in eye space per unit of depth (perspective) or its offset (orthographic). */
  const ray = (cx: number, cy: number) => {
    const nxp = (cx / W) * 2 - 1
    const nyp = 1 - (cy / H) * 2
    return p.ortho ? [nxp * p.halfW, nyp * p.halfH] : [nxp * p.tanHalfFov * p.aspect, nyp * p.tanHalfFov]
  }
  /** Kept by the section: the point at `d` along the pixel's ray is on the positive side. */
  const kept = (r: number[], d: number) => !pn || (p.ortho ? pn[0] * r[0] + pn[1] * r[1] - pn[2] * d + pc : (pn[0] * r[0] + pn[1] * r[1] - pn[2]) * d + pc) >= 0
  /** Where the pixel's ray meets the section plane (its depth), or NaN. */
  const capDepth = (r: number[]) => {
    if (!pn) return NaN
    if (p.ortho) return Math.abs(pn[2]) < 1e-12 ? NaN : (pc + pn[0] * r[0] + pn[1] * r[1]) / pn[2]
    const along = pn[0] * r[0] + pn[1] * r[1] - pn[2]
    return Math.abs(along) < 1e-12 ? NaN : -pc / along
  }

  const front = pn ? new Float32Array(W * H).fill(Infinity) : depth
  const back = pn ? new Float32Array(W * H).fill(Infinity) : null
  const sx = new Float64Array(3), sy = new Float64Array(3), sz = new Float64Array(3)
  const ex = new Float64Array(3), ey = new Float64Array(3), ez = new Float64Array(3)
  // Perspective: what's nearer than this to the eye is cut off (a triangle reaching past the eye is clipped, not dropped).
  const near = 1e-3
  /** A polygon in eye space cut to depth ≥ near (Sutherland–Hodgman against one plane). */
  const clipNear = (px: number[], py: number[], pz: number[]) => {
    const ox: number[] = [], oy: number[] = [], oz: number[] = []
    for (let k = 0; k < px.length; k++) {
      const j = (k + 1) % px.length
      const dk = -pz[k] - near
      const dj = -pz[j] - near
      if (dk >= 0) {
        ox.push(px[k])
        oy.push(py[k])
        oz.push(pz[k])
      }
      if (dk >= 0 !== dj >= 0) {
        const s = dk / (dk - dj)
        ox.push(px[k] + (px[j] - px[k]) * s)
        oy.push(py[k] + (py[j] - py[k]) * s)
        oz.push(pz[k] + (pz[j] - pz[k]) * s)
      }
    }
    return [ox, oy, oz]
  }
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1
  /** Rasterise the triangle in ex, ey, ez (eye space) into the front or the back picture. */
  const raster = () => {
    for (let k = 0; k < 3; k++) {
      const d = -ez[k]
      const nx = p.ortho ? ex[k] / p.halfW : ex[k] / (d * p.tanHalfFov * p.aspect)
      const ny = p.ortho ? ey[k] / p.halfH : ey[k] / (d * p.tanHalfFov)
      sx[k] = ((nx + 1) / 2) * W
      sy[k] = ((1 - ny) / 2) * H
      sz[k] = d
    }
    // Facing the eye: the triangle's normal (eye space) against the way to the eye.
    const ux = ex[1] - ex[0], uy = ey[1] - ey[0], uz = ez[1] - ez[0]
    const wx = ex[2] - ex[0], wy = ey[2] - ey[0], wz = ez[2] - ez[0]
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx
    const facing = p.ortho ? nz > 0 : -(nx * ex[0] + ny * ey[0] + nz * ez[0]) > 0
    if (!facing && !back) return
    const into = facing ? front : back!
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0])
    if (Math.abs(area) < 1e-12) return
    const x0 = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])))
    const x1 = Math.min(W - 1, Math.ceil(Math.max(sx[0], sx[1], sx[2])))
    const y0 = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])))
    const y1 = Math.min(H - 1, Math.ceil(Math.max(sy[0], sy[1], sy[2])))
    if (x0 > x1 || y0 > y1) return
    if (x0 < bx0) bx0 = x0
    if (y0 < by0) by0 = y0
    if (x1 > bx1) bx1 = x1
    if (y1 > by1) by1 = y1
    const inv = 1 / area
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5
      for (let x = x0; x <= x1; x++) {
        const cx = x + 0.5
        const w0 = ((sx[1] - cx) * (sy[2] - cy) - (sx[2] - cx) * (sy[1] - cy)) * inv
        const w1 = ((sx[2] - cx) * (sy[0] - cy) - (sx[0] - cx) * (sy[2] - cy)) * inv
        const w2 = 1 - w0 - w1
        if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue
        const d = p.ortho ? w0 * sz[0] + w1 * sz[1] + w2 * sz[2] : 1 / (w0 / sz[0] + w1 / sz[1] + w2 / sz[2])
        const o = y * W + x
        if (d >= into[o]) continue
        if (pn && !kept(ray(cx, cy), d)) continue
        into[o] = d
      }
    }
  }
  for (const part of parts) {
    const vert = part.vertices
    const idx = part.index
    const [ox, oy, oz] = part.offset ?? [0, 0, 0]
    bx0 = W
    by0 = H
    bx1 = -1
    by1 = -1
    for (let t = 0; t < idx.length; t += 3) {
      let behind = 0
      for (let k = 0; k < 3; k++) {
        const i = idx[t + k] * 3
        const x = vert[i] + ox, y = vert[i + 1] + oy, z = vert[i + 2] + oz
        ex[k] = m[0] * x + m[4] * y + m[8] * z + m[12]
        ey[k] = m[1] * x + m[5] * y + m[9] * z + m[13]
        ez[k] = m[2] * x + m[6] * y + m[10] * z + m[14]
        if (!p.ortho && -ez[k] < near) behind++
      }
      if (!behind) raster()
      else if (behind < 3) {
        // Partly behind the eye: what's in front of it, as one or two triangles.
        const [cx, cy, cz] = clipNear([ex[0], ex[1], ex[2]], [ey[0], ey[1], ey[2]], [ez[0], ez[1], ez[2]])
        for (let k = 1; k + 1 < cx.length; k++) {
          ex[0] = cx[0]
          ey[0] = cy[0]
          ez[0] = cz[0]
          ex[1] = cx[k]
          ey[1] = cy[k]
          ez[1] = cz[k]
          ex[2] = cx[k + 1]
          ey[2] = cy[k + 1]
          ez[2] = cz[k + 1]
          raster()
        }
      }
    }
    if (!back || bx1 < 0) continue
    // This part's faces, cut: its nearest face beyond the plane, or the cut face where that one is seen from inside.
    for (let y = by0; y <= by1; y++)
      for (let x = bx0; x <= bx1; x++) {
        const o = y * W + x
        const f = front[o]
        const b = back[o]
        if (f === Infinity && b === Infinity) continue
        let d = f
        if (b < f) {
          const c = capDepth(ray(x + 0.5, y + 0.5))
          if (c > 0) d = c
        }
        if (d < depth[o]) depth[o] = d
        front[o] = Infinity
        back[o] = Infinity
      }
  }
  return depth
}

// ------------------------------------------------------------------ lines

/** Clip a segment to the kept side of a section (positive distance); null when all of it is cut away. */
export function clipSegment(a: V3, b: V3, section: HlrOptions["section"]): [V3, V3] | null {
  if (!section) return [a, b]
  const dist = (p: V3) => section.normal[0] * p[0] + section.normal[1] * p[1] + section.normal[2] * p[2] + section.constant
  const da = dist(a)
  const db = dist(b)
  if (da < -1e-6 && db < -1e-6) return null
  if (da >= -1e-6 && db >= -1e-6) return [a, b]
  const t = da / (da - db)
  const p: V3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  return da < 0 ? [p, b] : [a, p]
}

/** Where a plane cuts a part's triangles: segments (pairs of points, world). */
export function planeCut(part: HlrPart, section: NonNullable<HlrOptions["section"]>): V3[] {
  const out: V3[] = []
  const v = part.vertices
  const [ox, oy, oz] = part.offset ?? [0, 0, 0]
  const [nx, ny, nz] = section.normal
  const pts: V3[] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const dist = [0, 0, 0]
  for (let t = 0; t < part.index.length; t += 3) {
    for (let k = 0; k < 3; k++) {
      const i = part.index[t + k] * 3
      pts[k] = [v[i] + ox, v[i + 1] + oy, v[i + 2] + oz]
      dist[k] = nx * pts[k][0] + ny * pts[k][1] + nz * pts[k][2] + section.constant
    }
    const hits: V3[] = []
    for (let k = 0; k < 3; k++) {
      const j = (k + 1) % 3
      if (dist[k] < 0 !== dist[j] < 0) {
        const s = dist[k] / (dist[k] - dist[j])
        hits.push([pts[k][0] + (pts[j][0] - pts[k][0]) * s, pts[k][1] + (pts[j][1] - pts[k][1]) * s, pts[k][2] + (pts[j][2] - pts[k][2]) * s])
      }
    }
    if (hits.length === 2) out.push(hits[0], hits[1])
  }
  return out
}

/**
 * The model's lines as seen: each part's edges and outlines (and the section's cut), split into the
 * runs that can be seen and, with `hidden`, those that can't.
 */
export function hiddenLines(parts: HlrPart[], v: HlrView, opts: HlrOptions = {}): HlrResult {
  const section = opts.section ?? null
  const depth = depthPicture(parts, v, section)
  const W = v.width
  const H = v.height
  const proj = projector(v)
  const { eye, forward } = eyeOf(v.view)
  // Perspective: the plane just in front of the eye (world); lines nearer than it are cut off.
  const nearPlane = { normal: forward, constant: -(forward[0] * eye[0] + forward[1] * eye[1] + forward[2] * eye[2]) - 1e-3 }
  // A little room for a line lying on its own faces: what a pixel spans at that depth, and a trace of the model's size.
  let lo = Infinity
  let hi = -Infinity
  for (const part of parts) {
    const [ox, oy, oz] = part.offset ?? [0, 0, 0]
    // Its own triangles' corners (the vertex buffer may be every part's); a few hundred are plenty.
    const step = Math.max(1, Math.floor(part.index.length / 600))
    for (let t = 0; t < part.index.length; t += step) {
      const i = part.index[t] * 3
      const s = part.vertices[i] + ox + part.vertices[i + 1] + oy + part.vertices[i + 2] + oz
      if (s < lo) lo = s
      if (s > hi) hi = s
    }
  }
  const slack = Number.isFinite(hi) ? Math.max(1e-6, (hi - lo) * 1e-4) : 1e-3
  /**
   * In front of (or on) the nearest face round this pixel: 1 seen, 0 hidden. Outside the picture
   * (−1) nothing is known, and nothing is drawn: what's off the view stays off the drawing.
   */
  const seen = (x: number, y: number, d: number) => {
    const cx = Math.floor(x)
    const cy = Math.floor(y)
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return -1
    let far = 0
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const px = cx + dx
        const py = cy + dy
        if (px < 0 || py < 0 || px >= W || py >= H) continue
        const z = depth[py * W + px]
        if (z === Infinity) return 1
        if (z > far) far = z
      }
    return d <= far + Math.max(slack, proj.pixel(d) * 1.5) ? 1 : 0
  }

  const visible: HlrLine[] = []
  const hidden: HlrLine[] = []
  const trace = (a0: V3, b0: V3, part: number) => {
    let clipped = clipSegment(a0, b0, section)
    if (clipped && !v.projection.ortho) clipped = clipSegment(clipped[0], clipped[1], nearPlane)
    if (!clipped) return
    const [a, b] = clipped
    const pa = proj.at(a[0], a[1], a[2])
    const ax = pa.x, ay = pa.y
    const pb = proj.at(b[0], b[1], b[2])
    const n = Math.min(4000, Math.max(1, Math.ceil(Math.hypot(pb.x - ax, pb.y - ay))))
    let run: HlrLine | null = null
    let runSeen = false
    const end = () => {
      if (run && (runSeen || opts.hidden)) (runSeen ? visible : hidden).push(run)
      run = null
    }
    for (let i = 0; i <= n; i++) {
      const t = i / n
      const s = proj.at(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)
      if (!v.projection.ortho && s.depth <= 1e-6) {
        end()
        continue
      }
      const here: V2 = [s.nx, s.ny]
      const state = seen(s.x, s.y, s.depth)
      if (state < 0) {
        end()
        continue
      }
      const on = state === 1
      if (run && runSeen === on) run.b = here
      else {
        const from: V2 = run ? run.b : here
        end()
        run = { a: from, b: here, part }
        runSeen = on
      }
    }
    end()
  }

  // The cut faces the cut-away side: seen only from there (from behind, the part itself is in the way).
  const capSeen = !!section && (v.projection.ortho ? section.normal[0] * forward[0] + section.normal[1] * forward[1] + section.normal[2] * forward[2] > 0 : section.normal[0] * eye[0] + section.normal[1] * eye[1] + section.normal[2] * eye[2] + section.constant < 0)
  const cut: V2[] = []
  for (const part of parts) {
    const v3 = part.vertices
    const [ox, oy, oz] = part.offset ?? [0, 0, 0]
    // The solid's edges, but not its seams.
    const e = part.edges
    const seam = part.faces ? seams(v3, part.index, part.faces) : null
    for (let i = 0; i + 5 < e.length; i += 6) {
      if (seam?.([e[i], e[i + 1], e[i + 2]], [e[i + 3], e[i + 4], e[i + 5]])) continue
      trace([e[i] + ox, e[i + 1] + oy, e[i + 2] + oz], [e[i + 3] + ox, e[i + 4] + oy, e[i + 5] + oz], part.id)
    }
    // Outlines: where a curved face turns away from the eye.
    const adj = adjacency(v3, part.index)
    const facing = (t: number) => {
      const nx = adj.normals[t * 3], ny = adj.normals[t * 3 + 1], nz = adj.normals[t * 3 + 2]
      if (v.projection.ortho) return nx * forward[0] + ny * forward[1] + nz * forward[2] < 0
      return nx * (adj.centres[t * 3] + ox - eye[0]) + ny * (adj.centres[t * 3 + 1] + oy - eye[1]) + nz * (adj.centres[t * 3 + 2] + oz - eye[2]) < 0
    }
    for (let i = 0; i < adj.pairs.length; i += 4) {
      if (facing(adj.pairs[i + 2]) === facing(adj.pairs[i + 3])) continue
      const p = adj.pairs[i] * 3
      const q = adj.pairs[i + 1] * 3
      trace([v3[p] + ox, v3[p + 1] + oy, v3[p + 2] + oz], [v3[q] + ox, v3[q + 1] + oy, v3[q + 2] + oz], part.id)
    }
    // The section's cut: outlined (as seen), and kept whole for the hatching.
    if (section) {
      const pts = planeCut(part, section)
      for (let i = 0; i < pts.length; i += 2) {
        trace(pts[i], pts[i + 1], part.id)
        if (!capSeen) continue
        const a = proj.at(pts[i][0], pts[i][1], pts[i][2])
        const an: V2 = [a.nx, a.ny]
        const b = proj.at(pts[i + 1][0], pts[i + 1][1], pts[i + 1][2])
        cut.push(an, [b.nx, b.ny])
      }
    }
  }
  // Lines seen end on behind others (a box's back edges in a front view) or twice (parts that touch)
  // land on lines already drawn: once is enough, and a hidden line under a visible one isn't hidden.
  const kept = new Repeats(W, H)
  const once = visible.sort((p, q) => len(q) - len(p)).filter((l) => kept.add(l))
  const under = new Repeats(W, H)
  const hiddenOnce = hidden.sort((p, q) => len(q) - len(p)).filter((l) => !kept.covers(l) && under.add(l))
  return { visible: once, hidden: hiddenOnce, cut }
}

const len = (l: HlrLine) => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1])

/** Lines kept so far, on a grid of the picture: does a new one lie along them (within ¾ pixel)? */
class Repeats {
  private cells = new Map<number, HlrLine[]>()
  private readonly W: number
  private readonly H: number
  private static readonly CELL = 8
  constructor(W: number, H: number) {
    this.W = W
    this.H = H
  }
  private px(p: V2): V2 {
    return [((p[0] + 1) / 2) * this.W, ((1 - p[1]) / 2) * this.H]
  }
  private key(x: number, y: number) {
    return Math.floor(x / Repeats.CELL) * 100003 + Math.floor(y / Repeats.CELL)
  }
  /** Along its whole length (every 2 px), within ¾ px of kept lines running its way. */
  covers(l: HlrLine) {
    const a = this.px(l.a)
    const b = this.px(l.b)
    const length = Math.hypot(b[0] - a[0], b[1] - a[1])
    const dir: V2 | null = length > 1 ? [(b[0] - a[0]) / length, (b[1] - a[1]) / length] : null
    const n = Math.max(2, Math.ceil(length / 2))
    for (let i = 0; i <= n; i++) if (!this.near([a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n], dir)) return false
    return true
  }
  /** Keep it unless it lies along what's kept; true when kept. */
  add(l: HlrLine) {
    if (this.covers(l)) return false
    const a = this.px(l.a)
    const b = this.px(l.b)
    const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / Repeats.CELL))
    const seen = new Set<number>()
    for (let i = 0; i <= n; i++) {
      const k = this.key(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n)
      if (seen.has(k)) continue
      seen.add(k)
      const list = this.cells.get(k)
      if (list) list.push(l)
      else this.cells.set(k, [l])
    }
    return true
  }
  /** Within ¾ px of a kept line; with `dir`, one running that way (to within about 6°). */
  private near([x, y]: V2, dir: V2 | null) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (const l of this.cells.get(this.key(x + dx * Repeats.CELL, y + dy * Repeats.CELL)) ?? []) {
          const a = this.px(l.a)
          const b = this.px(l.b)
          const vx = b[0] - a[0]
          const vy = b[1] - a[1]
          const l2 = vx * vx + vy * vy
          if (dir && l2 > 1 && Math.abs(dir[0] * vy - dir[1] * vx) / Math.sqrt(l2) > 0.1) continue
          const t = l2 ? Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / l2)) : 0
          if (Math.hypot(a[0] + t * vx - x, a[1] + t * vy - y) <= 0.75) return true
        }
    return false
  }
}

/** Join segments (pairs of points) end to end into closed loops, for filling the cut. */
export function loops(segments: V2[], tol = 1e-4): V2[][] {
  const key = (p: V2) => `${Math.round(p[0] / tol)},${Math.round(p[1] / tol)}`
  const at = new Map<string, number[]>()
  const n = segments.length >> 1
  for (let s = 0; s < n; s++)
    for (const e of [0, 1]) {
      const k = key(segments[s * 2 + e])
      const list = at.get(k)
      if (list) list.push(s * 2 + e)
      else at.set(k, [s * 2 + e])
    }
  const used = new Uint8Array(n)
  const out: V2[][] = []
  for (let s = 0; s < n; s++) {
    if (used[s]) continue
    used[s] = 1
    const loop: V2[] = [segments[s * 2], segments[s * 2 + 1]]
    for (;;) {
      const next = (at.get(key(loop[loop.length - 1])) ?? []).find((e) => !used[e >> 1])
      if (next === undefined) break
      used[next >> 1] = 1
      loop.push(segments[next ^ 1])
    }
    if (loop.length >= 4) out.push(loop)
  }
  return out
}
