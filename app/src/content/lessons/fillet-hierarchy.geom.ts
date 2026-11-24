import * as THREE from "three"

/**
 * Geometry for 6.1.2 「圆角的层级与角落」: a 120 × 80 × 64 box (a speaker,
 * a purifier) with three edge groups: the four vertical edges (radius rv),
 * the top loop (rt) and the bottom loop (rb).
 *
 * The box is built from horizontal slices: at each height the plan is a
 * rounded rectangle moved in by the top or bottom fillet's setback d, with
 * a corner radius rc(d). Rolling the top loop round already-filleted
 * vertical edges gives rc = rv − d, so the corner is a surface of
 * revolution of the fillet's arc about the vertical edge's axis: a torus,
 * or, with rv = rt, a sphere (its centre sits at the corner). When the
 * rolling fillet is larger than the corner it has to go round (rv < d),
 * rc would go negative: the slice keeps a sharp corner there, which is the
 * crease a kernel leaves when it trims the self-intersection (or it fails).
 * The "blend" mode keeps rc above a minimum with a smooth max: a dedicated
 * corner patch, standing in for a setback / vertex blend (simplified; no
 * package computes it exactly this way).
 *
 * Normals are analytic, from the two tangents of the slice parametrisation,
 * so tangent edges shade smooth and creases stay sharp.
 */
export const BOX = { w: 120, d: 80, h: 64 }
export type Radii = { rv: number; rt: number; rb: number }
export type CornerMode = "roll" | "blend"
export type CornerKind = "sphere" | "torus" | "crease" | "blend" | "sharp"

const K = 12
const EPS = 0.25

export function cornerKind(r: number, rv: number, mode: CornerMode): CornerKind {
  if (r < 0.6 || rv < 0.6) return "sharp"
  if (mode === "blend") return "blend"
  if (Math.abs(rv - r) < EPS) return "sphere"
  return rv > r ? "torus" : "crease"
}

/** Corner radius of the slice at setback d, and its derivative. */
function cornerRadius(d: number, rv: number, rLoop: number, mode: CornerMode, room: number): [number, number] {
  const a = rv - d
  if (mode === "roll") return a > 0 ? [a, -1] : [0, 0]
  // Smooth max of (rv − d) and a floor m: never pinches to a point.
  const m = Math.max(1.5, Math.min(rv, rLoop) * 0.55)
  const k = Math.max(1.5, rLoop * 0.4)
  const q = Math.sqrt((a - m) ** 2 + k * k)
  const rc = (a + m + q) / 2
  // Never wider than the slice itself.
  return rc > room ? [room, 0] : [rc, -(1 + (a - m) / q) / 2]
}

type Row = { z: number; d: number; dz: number; dd: number; loop: "bottom" | "wall" | "top" }

function rows(r: Radii): Row[][] {
  const { h } = BOX
  const out: Row[][] = []
  const nb = 10
  const bottom: Row[] = []
  for (let k = 0; k <= nb; k++) {
    const p = (Math.PI / 2) * (k / nb)
    bottom.push({ z: r.rb - r.rb * Math.cos(p), d: r.rb - r.rb * Math.sin(p), dz: r.rb * Math.sin(p) + 1e-6, dd: -r.rb * Math.cos(p), loop: "bottom" })
  }
  out.push(bottom)
  out.push([
    { z: r.rb, d: 0, dz: 1, dd: 0, loop: "wall" },
    { z: h - r.rt, d: 0, dz: 1, dd: 0, loop: "wall" },
  ])
  const nt = 14
  const top: Row[] = []
  for (let k = 0; k <= nt; k++) {
    const p = (Math.PI / 2) * (k / nt)
    top.push({ z: h - r.rt + r.rt * Math.sin(p), d: r.rt - r.rt * Math.cos(p), dz: r.rt * Math.cos(p) + 1e-6, dd: r.rt * Math.sin(p), loop: "top" })
  }
  out.push(top)
  return out
}

const CORNERS: [number, number, number][] = [
  [1, -1, -Math.PI / 2],
  [1, 1, 0],
  [-1, 1, Math.PI / 2],
  [-1, -1, Math.PI],
]

type RingPt = { p: THREE.Vector3; n: THREE.Vector3; corner: boolean }

function ring(row: Row, r: Radii, mode: CornerMode): RingPt[] {
  const { w, d: dep } = BOX
  const rLoop = row.loop === "top" ? r.rt : row.loop === "bottom" ? r.rb : 0
  const hx = w / 2 - row.d
  const hy = dep / 2 - row.d
  const [rc, drdd] = row.loop === "wall" ? [r.rv, 0] : cornerRadius(row.d, r.rv, rLoop, mode, hy - 0.5)
  const drc = drdd * row.dd
  const out: RingPt[] = []
  const u = new THREE.Vector3()
  const wv = new THREE.Vector3()
  for (const [sx, sy, a0] of CORNERS) {
    const cx = sx * (hx - rc)
    const cy = sy * (hy - rc)
    for (let k = 0; k <= K; k++) {
      const a = a0 + (Math.PI / 2) * (k / K)
      const c = Math.cos(a)
      const s = Math.sin(a)
      u.set(-s, c, 0)
      wv.set(-sx * (row.dd + drc) + drc * c, -sy * (row.dd + drc) + drc * s, row.dz)
      const n = new THREE.Vector3().crossVectors(u, wv).normalize()
      out.push({ p: new THREE.Vector3(cx + rc * c, cy + rc * s, row.z), n, corner: k > 0 && k < K })
    }
  }
  return out
}

export type BoxMesh = {
  geometry: THREE.BufferGeometry
  /** Tangent edges: fillet boundaries. */
  soft: THREE.Vector3[][]
  /** Sharp edges: creases where a fillet couldn't turn the corner. */
  sharp: THREE.Vector3[][]
  /** Outline of the front-right top corner patch. */
  patch: THREE.Vector3[][]
  top: CornerKind
  bottom: CornerKind
}

/**
 * The box. Geometry groups: 0 ordinary faces, 1 corner patches (where the
 * top or bottom loop turns round a vertical edge).
 */
export function buildBox(r: Radii, mode: CornerMode): BoxMesh {
  const pos: number[] = []
  const nor: number[] = []
  const plain: number[] = []
  const patch: number[] = []
  const pieces = rows(r)
  const grids: RingPt[][][] = []
  for (const pc of pieces) {
    const start = pos.length / 3
    const grid = pc.map((row) => ring(row, r, mode))
    grids.push(grid)
    const cols = grid[0].length
    for (const rg of grid)
      for (const q of rg) {
        pos.push(q.p.x, q.p.y, q.p.z)
        nor.push(q.n.x, q.n.y, q.n.z)
      }
    const isCornerPiece = pc[0].loop !== "wall"
    for (let j = 0; j < pc.length - 1; j++)
      for (let i = 0; i < cols; i++) {
        const i2 = (i + 1) % cols
        const a = start + j * cols + i
        const b = start + j * cols + i2
        const c = start + (j + 1) * cols + i2
        const d = start + (j + 1) * cols + i
        // Inside one corner's arc (not the straight run between corners).
        const inArc = i % (K + 1) !== K
        ;(isCornerPiece && inArc ? patch : plain).push(a, b, c, a, c, d)
      }
  }
  // Caps.
  const capOf = (row: Row, up: boolean) => {
    const rg = ring({ ...row, dz: up ? 0 : 0, dd: up ? 1 : -1 }, r, mode)
    const centre = pos.length / 3
    pos.push(0, 0, row.z)
    nor.push(0, 0, up ? 1 : -1)
    for (const q of rg) {
      pos.push(q.p.x, q.p.y, q.p.z)
      nor.push(0, 0, up ? 1 : -1)
    }
    for (let i = 0; i < rg.length; i++) {
      const a = centre + 1 + i
      const b = centre + 1 + ((i + 1) % rg.length)
      if (up) plain.push(centre, a, b)
      else plain.push(centre, b, a)
    }
  }
  const top = pieces[2]
  const bottom = pieces[0]
  capOf(top[top.length - 1], true)
  capOf(bottom[0], false)

  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3))
  g.setIndex([...plain, ...patch])
  g.addGroup(0, plain.length, 0)
  g.addGroup(plain.length, patch.length, 1)

  // Lines.
  const soft: THREE.Vector3[][] = []
  const sharp: THREE.Vector3[][] = []
  const loop = (rg: RingPt[]) => [...rg.map((q) => q.p), rg[0].p]
  const [gb, gw, gt] = grids
  soft.push(loop(gb[0]), loop(gb[gb.length - 1]), loop(gt[0]), loop(gt[gt.length - 1]))
  // Down each column at the ends of the corner arcs: where the vertical fillets begin and end.
  const all = [...gb, ...gw.slice(1), ...gt.slice(1)]
  for (let c = 0; c < 4; c++)
    for (const k of [0, K]) {
      const col = c * (K + 1) + k
      soft.push(all.map((rg) => rg[col].p))
    }
  // Creases: rows where a corner has pinched to a point.
  for (const grid of [gb, gt]) {
    for (let c = 0; c < 4; c++) {
      const pts: THREE.Vector3[] = []
      for (const rg of grid) {
        const a = rg[c * (K + 1)].p
        const b = rg[c * (K + 1) + K].p
        if (a.distanceTo(b) < 1e-3) pts.push(a)
      }
      if (pts.length > 1) sharp.push(pts)
    }
  }
  // The front-right top corner patch outline (corner 0).
  const pl: THREE.Vector3[][] = []
  if (r.rt >= 0.6 && r.rv >= 0.6) {
    pl.push(gt.map((rg) => rg[0].p), gt.map((rg) => rg[K].p), gt[0].slice(0, K + 1).map((q) => q.p), gt[gt.length - 1].slice(0, K + 1).map((q) => q.p))
  }
  return { geometry: g, soft, sharp, patch: pl, top: cornerKind(r.rt, r.rv, mode), bottom: cornerKind(r.rb, r.rv, mode) }
}

// ------------------------------------------------------------------ zebra (as in zebra-stripes.scene.ts)

export const ZEBRA_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

/** Stripes from the reflected view direction: a row of parallel light tubes, like Zebra / Light tunnel in CAD. */
export const ZEBRA_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uDir;
uniform float uFreq;
varying vec3 vN;
varying vec3 vP;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  vec3 r = reflect(normalize(vP - cameraPosition), n);
  float s = asin(clamp(dot(r, uDir), -1.0, 1.0)) * uFreq;
  float t = abs(fract(s) - 0.5) * 2.0;
  float w = clamp(fwidth(s) * 1.5, 0.001, 0.5);
  float m = smoothstep(0.5 - w, 0.5 + w, t);
  gl_FragColor = vec4(mix(uA, uB, m), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
