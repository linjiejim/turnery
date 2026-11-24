import * as THREE from "three"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { CMF, SOFTBOXES, Studio, contactShadow, grainTexture, greyTexture, hash2, type Grain } from "./materials-finishes.studio"

/**
 * 6.3.1 「材质与表面处理」: one small handheld product (a rounded slab, like a power bank or a
 * remote) under a softbox studio. The learner drags roughness and metalness, then switches between
 * real finishes: physically based materials (clearcoat, sheen, anisotropy) with procedural normal
 * maps for grain, bead blast, brushing and paint flake. With flaws on, the top face carries a
 * fingerprint, a few fine scratches and a shallow dent; each finish shows them as it really would,
 * because the flaws only change roughness and shape, never the colour.
 */
export type Finish = "custom" | "gloss" | "matte" | "texture" | "soft" | "anodized" | "brushed" | "painted"

export const PLASTICS: Finish[] = ["gloss", "matte", "texture", "soft"]
export const METALS: Finish[] = ["anodized", "brushed", "painted"]

type Swatch = "accent" | "plastic" | "alu" | "steel" | "paint"

type FinishDef = {
  swatch: Swatch
  roughness: number
  metalness: number
  grain?: Grain
  normal?: number
  clearcoat?: number
  sheen?: number
  anisotropy?: number
}

export const FINISHES: Record<Finish, FinishDef> = {
  custom: { swatch: "accent", roughness: 0.3, metalness: 0 },
  gloss: { swatch: "plastic", roughness: 0.04, metalness: 0 },
  matte: { swatch: "plastic", roughness: 0.55, metalness: 0 },
  texture: { swatch: "plastic", roughness: 0.6, metalness: 0, grain: "leather", normal: 0.9 },
  soft: { swatch: "plastic", roughness: 0.8, metalness: 0, sheen: 0.7 },
  anodized: { swatch: "alu", roughness: 0.4, metalness: 1, grain: "bead", normal: 0.3 },
  brushed: { swatch: "steel", roughness: 0.28, metalness: 1, grain: "brush", normal: 0.3, anisotropy: 0.8 },
  painted: { swatch: "paint", roughness: 0.42, metalness: 0.6, grain: "flake", normal: 0.6, clearcoat: 1 },
}

/** How many millimetres one tile of each grain covers. */
const TILE: Record<Grain, number> = { leather: 7, bead: 2.5, brush: 40, flake: 2 }

const SWATCH = CMF

/** 0 hardly shows, 1 shows, 2 shows clearly. Typical tendencies, not measurements. */
export type Rating = 0 | 1 | 2
export const SHOWS: Record<Exclude<Finish, "custom">, { prints: Rating; scratches: Rating; dents: Rating }> = {
  gloss: { prints: 2, scratches: 2, dents: 2 },
  matte: { prints: 1, scratches: 1, dents: 1 },
  texture: { prints: 0, scratches: 0, dents: 0 },
  soft: { prints: 2, scratches: 1, dents: 0 },
  anodized: { prints: 1, scratches: 1, dents: 0 },
  brushed: { prints: 1, scratches: 1, dents: 1 },
  painted: { prints: 2, scratches: 2, dents: 2 },
}

export type FinishState = {
  step: number
  finish: Finish
  roughness: number
  metalness: number
  flaws: boolean
  brushAcross: boolean
  seen: Finish[]
  flawSeen: Finish[]
  lowR: boolean
  highR: boolean
  m0: boolean
  m1: boolean
  turned: boolean
}

/** The product: a rounded slab lying on the table. */
const W = 110
const D = 64
const H = 20
const RC = 16
const RE = 6
const RB = 1.5
/** The shallow dent of the flaws, on the top face. */
const DENT = { x: -24, y: -12, r: 8, depth: 0.14 }

type OutlinePt = { x: number; y: number; nx: number; ny: number; s: number }

/** A rounded rectangle walked counter-clockwise (seen from above), closed (last = first). */
function outline(w: number, d: number, rc: number): OutlinePt[] {
  const out: OutlinePt[] = []
  const hx = w / 2 - rc
  const hy = d / 2 - rc
  const corners: [number, number, number][] = [
    [hx, hy, 0],
    [-hx, hy, Math.PI / 2],
    [-hx, -hy, Math.PI],
    [hx, -hy, (3 * Math.PI) / 2],
  ]
  const straight = (a: [number, number], b: [number, number], n: [number, number], segs: number) => {
    for (let i = 0; i < segs; i++) {
      const k = i / segs
      out.push({ x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, nx: n[0], ny: n[1], s: 0 })
    }
  }
  const arcPts = (cx: number, cy: number, a0: number, segs: number) => {
    for (let i = 0; i < segs; i++) {
      const a = a0 + ((Math.PI / 2) * i) / segs
      out.push({ x: cx + Math.cos(a) * rc, y: cy + Math.sin(a) * rc, nx: Math.cos(a), ny: Math.sin(a), s: 0 })
    }
  }
  straight([w / 2, -hy], [w / 2, hy], [1, 0], 10)
  arcPts(...corners[0], 10)
  straight([hx, d / 2], [-hx, d / 2], [0, 1], 22)
  arcPts(...corners[1], 10)
  straight([-w / 2, hy], [-w / 2, -hy], [-1, 0], 10)
  arcPts(...corners[2], 10)
  straight([-hx, -d / 2], [hx, -d / 2], [0, -1], 22)
  arcPts(...corners[3], 10)
  out.push({ ...out[0] })
  let s = 0
  for (let i = 0; i < out.length; i++) {
    if (i > 0) s += Math.hypot(out[i].x - out[i - 1].x, out[i].y - out[i - 1].y)
    out[i].s = s
  }
  return out
}

type Vert = { p: THREE.Vector3; n: THREE.Vector3; uv: [number, number]; uv1: [number, number] }

/** Rows of vertices (same count each) → one indexed patch, wound so its triangles face along the given normals. */
function patch(rows: Vert[][], acc: { pos: number[]; nor: number[]; uv: number[]; uv1: number[]; idx: number[] }) {
  const base = acc.pos.length / 3
  const cols = rows[0].length
  for (const row of rows)
    for (const v of row) {
      acc.pos.push(v.p.x, v.p.y, v.p.z)
      acc.nor.push(v.n.x, v.n.y, v.n.z)
      acc.uv.push(...v.uv)
      acc.uv1.push(...v.uv1)
    }
  // Find the winding from the first quad that isn't degenerate.
  let flip = false
  search: for (let r = 0; r < rows.length - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = rows[r][c].p
      const b = rows[r][c + 1].p
      const e = rows[r + 1][c].p
      const g = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(e, a))
      if (g.lengthSq() > 1e-8) {
        flip = g.dot(rows[r][c].n) < 0
        break search
      }
    }
  for (let r = 0; r < rows.length - 1; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = base + r * cols + c
      const b = a + 1
      const e = a + cols
      const f = e + 1
      if (flip) acc.idx.push(a, e, b, b, e, f)
      else acc.idx.push(a, b, e, b, f, e)
    }
}

const dentAt = (x: number, y: number, on: boolean) => {
  if (!on) return { z: 0, gx: 0, gy: 0 }
  const dx = x - DENT.x
  const dy = y - DENT.y
  const e = Math.exp(-(dx * dx + dy * dy) / (DENT.r * DENT.r))
  // z = −depth·e; gradient of z.
  return { z: -DENT.depth * e, gx: (2 * DENT.depth * dx * e) / (DENT.r * DENT.r), gy: (2 * DENT.depth * dy * e) / (DENT.r * DENT.r) }
}

/** The slab: a flat top (optionally with the dent), a rounded top edge, straight sides, a small bottom round. */
export function slab(dent: boolean) {
  const o = outline(W, D, RC)
  const acc = { pos: [] as number[], nor: [] as number[], uv: [] as number[], uv1: [] as number[], idx: [] as number[] }
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const none: [number, number] = [-1, -1]
  // Top: rings of the inset outline scaled towards the middle.
  const top: Vert[][] = []
  const K = 44
  for (let k = 0; k <= K; k++) {
    const sg = k / K
    top.push(
      o.map((q) => {
        const x = (q.x - q.nx * RE) * sg
        const y = (q.y - q.ny * RE) * sg
        const d = dentAt(x, y, dent)
        return { p: V(x, y, H + d.z), n: V(-d.gx, -d.gy, 1).normalize(), uv: [x, y], uv1: [(x + W / 2) / W, (y + D / 2) / D] }
      }),
    )
  }
  patch(top, acc)
  // Body: top edge round, side, bottom round. uv = (around, down) in mm so textures keep their scale.
  const body: Vert[][] = []
  const prof: { inset: number; z: number; nh: number; nz: number }[] = []
  for (let i = 0; i <= 10; i++) {
    const f = ((Math.PI / 2) * i) / 10
    prof.push({ inset: RE * (1 - Math.sin(f)), z: H - RE + RE * Math.cos(f), nh: Math.sin(f), nz: Math.cos(f) })
  }
  prof.push({ inset: 0, z: RB, nh: 1, nz: 0 })
  for (let i = 1; i <= 4; i++) {
    const f = Math.PI / 2 + ((Math.PI / 2) * i) / 4
    prof.push({ inset: RB * (1 - Math.sin(f)), z: RB + RB * Math.cos(f), nh: Math.sin(f), nz: Math.cos(f) })
  }
  let along = 0
  prof.forEach((pr, i) => {
    if (i > 0) along += Math.hypot(pr.inset - prof[i - 1].inset, pr.z - prof[i - 1].z)
    body.push(o.map((q) => ({ p: V(q.x - q.nx * pr.inset, q.y - q.ny * pr.inset, pr.z), n: V(q.nx * pr.nh, q.ny * pr.nh, pr.nz).normalize(), uv: [q.s, -along], uv1: none })))
  })
  patch(body, acc)
  // Bottom.
  const bottom: Vert[][] = []
  for (let k = 0; k <= 4; k++) {
    const sg = 1 - k / 4
    bottom.push(o.map((q) => ({ p: V((q.x - q.nx * RB) * sg, (q.y - q.ny * RB) * sg, 0), n: V(0, 0, -1), uv: [(q.x - q.nx * RB) * sg, -(q.y - q.ny * RB) * sg], uv1: none })))
  }
  patch(bottom, acc)
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute(acc.pos, 3))
  g.setAttribute("normal", new THREE.Float32BufferAttribute(acc.nor, 3))
  g.setAttribute("uv", new THREE.Float32BufferAttribute(acc.uv, 2))
  g.setAttribute("uv1", new THREE.Float32BufferAttribute(acc.uv1, 2))
  g.setIndex(acc.idx)
  return g
}

/**
 * The flaws on the top face, in its own uv (0…1 over the slab): R fine scratches, G a fingerprint.
 * Real dimensions: the slab is 110 × 64 mm, a print about 14 × 19 mm with ridges 0.7 mm apart.
 */
function flawMask() {
  const n = 1024
  const r = new Float32Array(n * n)
  const g = new Float32Array(n * n)
  const mmX = W / n
  const mmY = D / n
  const prints = [
    { x: 14, y: 6, a: 7, b: 9.5, tilt: 0.5, k: 1 },
    { x: -14, y: 13, a: 5.5, b: 7, tilt: -0.3, k: 0.55 },
  ]
  for (const p of prints) {
    const i0 = Math.max(1, Math.floor((p.x - 12 + W / 2) / mmX))
    const i1 = Math.min(n - 2, Math.ceil((p.x + 12 + W / 2) / mmX))
    const j0 = Math.max(1, Math.floor((p.y - 12 + D / 2) / mmY))
    const j1 = Math.min(n - 2, Math.ceil((p.y + 12 + D / 2) / mmY))
    const c = Math.cos(p.tilt)
    const s = Math.sin(p.tilt)
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = i * mmX - W / 2 - p.x
        const y = j * mmY - D / 2 - p.y
        const u = (c * x + s * y) / p.a
        const v = (-s * x + c * y) / p.b
        const rr = Math.hypot(u, v * 0.92 + 0.08 * u * u)
        if (rr > 1.05) continue
        const warp = 0.6 * Math.sin(u * 3.1 + v * 1.7) + 0.4 * hash2(Math.floor(i / 9), Math.floor(j / 9), 31)
        const ridge = 0.5 + 0.5 * Math.sin((rr * p.b) / 0.7 * Math.PI * 2 + warp)
        const edge = 1 - THREE.MathUtils.smoothstep(rr, 0.7, 1.05)
        g[j * n + i] = Math.max(g[j * n + i], p.k * edge * (0.35 + 0.65 * THREE.MathUtils.smoothstep(ridge, 0.35, 0.75)))
      }
  }
  // Scratches: thin straight lines, in mm on the top face.
  const lines: [number, number, number, number][] = [
    [-40, 18, 5, 9],
    [-10, -20, 36, -4],
    [20, -14, 46, 10],
    [-44, -4, -18, 2],
    [-30, 22, -2, 24],
    [4, 14, 30, 22],
    [-6, -2, 10, -12],
  ]
  const halfW = 0.12
  for (const [ax, ay, bx, by] of lines) {
    const i0 = Math.max(1, Math.floor((Math.min(ax, bx) - 1 + W / 2) / mmX))
    const i1 = Math.min(n - 2, Math.ceil((Math.max(ax, bx) + 1 + W / 2) / mmX))
    const j0 = Math.max(1, Math.floor((Math.min(ay, by) - 1 + D / 2) / mmY))
    const j1 = Math.min(n - 2, Math.ceil((Math.max(ay, by) + 1 + D / 2) / mmY))
    const lx = bx - ax
    const ly = by - ay
    const ll = lx * lx + ly * ly
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const x = i * mmX - W / 2
        const y = j * mmY - D / 2
        const t = Math.max(0, Math.min(1, ((x - ax) * lx + (y - ay) * ly) / ll))
        const d = Math.hypot(x - (ax + lx * t), y - (ay + ly * t))
        const taper = Math.sin(Math.PI * t) ** 0.4
        const v = (1 - THREE.MathUtils.smoothstep(d, halfW * 0.5, halfW + mmX)) * taper
        r[j * n + i] = Math.max(r[j * n + i], v)
      }
  }
  const px = new Float32Array(n * n)
  const tex = greyTexture(px, n, n)
  const data = tex.image.data as Uint8Array
  for (let i = 0; i < n * n; i++) {
    data[i * 4] = Math.round(r[i] * 255)
    data[i * 4 + 1] = Math.round(g[i] * 255)
    data[i * 4 + 2] = 0
  }
  tex.channel = 1
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

const START = { step: 0, finish: "custom" as Finish, roughness: 0.15, metalness: 0 }

export class FinishScene extends LessonScene<FinishState> {
  private product = new THREE.Group()
  private studio: Studio
  private mat = new THREE.MeshPhysicalMaterial()
  private mask = flawMask()
  private grains = new Map<Grain, THREE.DataTexture>()
  private shadow: ReturnType<typeof contactShadow>
  private uniforms = { uFlaws: { value: 0 }, uPrintRough: { value: 0.3 }, uScratchRough: { value: 0.45 } }
  private builtDent: boolean | null = null
  private mesh: THREE.Mesh | null = null

  constructor(v: Viewer, emit: (s: FinishState) => void) {
    super(v, emit, {
      ...START,
      flaws: false,
      brushAcross: false,
      seen: [],
      flawSeen: [],
      lowR: false,
      highR: false,
      m0: false,
      m1: false,
      turned: false,
    })
    v.setGrid(120, 10)
    v.showGrid(false)
    this.studio = new Studio(v, SOFTBOXES, { intensity: 1, headlights: 0.35 })
    this.shadow = contactShadow(W, D, RC, 5, v.tokens.bg, 0.55)
    this.root.add(this.product, this.shadow.mesh)
    this.mat.roughnessMap = this.mask
    this.mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uFlaws;\nuniform float uPrintRough;\nuniform float uScratchRough;")
        .replace(
          "#include <roughnessmap_fragment>",
          /* glsl */ `float roughnessFactor = roughness;
vec4 flawMask = texture2D( roughnessMap, vRoughnessMapUv ) * uFlaws;
roughnessFactor = mix( roughnessFactor, uPrintRough, flawMask.g );
roughnessFactor = mix( roughnessFactor, max( roughnessFactor, uScratchRough ), flawMask.r );`,
        )
        .replace(
          "#include <lights_physical_fragment>",
          /* glsl */ `#include <lights_physical_fragment>
#ifdef USE_CLEARCOAT
material.clearcoatRoughness = mix( material.clearcoatRoughness, uPrintRough, flawMask.g );
material.clearcoatRoughness = mix( material.clearcoatRoughness, max( material.clearcoatRoughness, uScratchRough ), flawMask.r );
#endif`,
        )
    }
    this.mat.customProgramCacheKey = () => "cmf-flaws"
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<FinishState> = { step, flaws: step === 4 }
    if (step <= 1) Object.assign(patch, { finish: "custom", roughness: step === 0 ? 0.15 : 0.12, metalness: step === 1 ? s.metalness : 0 })
    if (step === 2 && !PLASTICS.includes(s.finish)) Object.assign(patch, this.finishPatch("gloss"))
    if (step === 3 && !METALS.includes(s.finish)) Object.assign(patch, this.finishPatch("anodized"))
    if (step === 4) Object.assign(patch, this.finishPatch(s.finish === "custom" ? "gloss" : s.finish))
    this.set(patch)
    this.markSeen()
    this.keyView(900)
  }

  /** The 3/4 view whose top face mirrors the main softbox. */
  keyView(ms = 700) {
    const target = new THREE.Vector3(0, 0, 8)
    const dir = new THREE.Vector3(Math.cos(THREE.MathUtils.degToRad(-50)), Math.sin(THREE.MathUtils.degToRad(-50)), Math.tan(THREE.MathUtils.degToRad(34))).normalize()
    this.v.flyTo(dir.multiplyScalar(300).add(target), target, ms)
  }

  // ------------------------------------------------------------ actions

  setRoughness(roughness: number) {
    this.set({ roughness, lowR: this.state.lowR || roughness <= 0.1, highR: this.state.highR || roughness >= 0.6 })
  }

  setMetalness(metalness: number) {
    this.set({ metalness, m0: this.state.m0 || metalness <= 0.05, m1: this.state.m1 || metalness >= 0.95 })
  }

  /** Predict-then-reveal: sweep the roughness from mirror to matte. */
  sweepRoughness() {
    // Shown, not done: the task still asks the learner to drag it themselves.
    this.v.tweens.run(1300, (k) => this.set({ roughness: Math.round((0.04 + 0.6 * k) * 100) / 100 }), { tag: "sweep" })
  }

  setFinish(finish: Finish) {
    this.set(this.finishPatch(finish))
    this.markSeen()
  }

  setFlaws(flaws: boolean) {
    this.set({ flaws })
    this.markSeen()
  }

  setBrushAcross(brushAcross: boolean) {
    this.set({ brushAcross, turned: true })
  }

  private finishPatch(finish: Finish): Partial<FinishState> {
    const d = FINISHES[finish]
    return { finish, roughness: d.roughness, metalness: d.metalness }
  }

  private markSeen() {
    const s = this.state
    const patch: Partial<FinishState> = {}
    if ((s.step === 2 || s.step === 3) && !s.seen.includes(s.finish)) patch.seen = [...s.seen, s.finish]
    if (s.step === 4 && s.flaws && !s.flawSeen.includes(s.finish)) patch.flawSeen = [...s.flawSeen, s.finish]
    if (Object.keys(patch).length) this.set(patch)
  }

  // ------------------------------------------------------------ rendering

  private grain(kind: Grain) {
    let t = this.grains.get(kind)
    if (!t) {
      t = grainTexture(kind, TILE[kind])
      t.center.set(0.5, 0.5)
      this.grains.set(kind, t)
    }
    return t
  }

  protected render() {
    const s = this.state
    const def = FINISHES[s.finish]
    if (this.builtDent !== s.flaws) {
      this.clear(this.product)
      const g = slab(s.flaws)
      this.mesh = new THREE.Mesh(g, this.mat)
      this.product.add(this.mesh)
      this.builtDent = s.flaws
    }
    const m = this.mat
    m.color.copy(def.swatch === "accent" ? this.v.tokens.highlight : SWATCH[def.swatch])
    m.roughness = s.roughness
    m.metalness = s.metalness
    const nm = def.grain ? this.grain(def.grain) : null
    if (m.normalMap !== nm) {
      m.normalMap = nm
      m.needsUpdate = true
    }
    if (nm) nm.rotation = def.grain === "brush" && s.brushAcross ? Math.PI / 2 : 0
    m.normalScale.setScalar(def.normal ?? 1)
    m.clearcoat = def.clearcoat ?? 0
    m.clearcoatRoughness = 0.03
    m.sheen = def.sheen ?? 0
    m.sheenRoughness = 0.5
    m.sheenColor.setScalar(0.3)
    m.anisotropy = def.anisotropy ?? 0
    // Brush lines run along u: the highlight stretches across them.
    m.anisotropyRotation = Math.PI / 2
    this.uniforms.uFlaws.value = s.flaws ? 1 : 0
    this.shadow.recolor(this.v.tokens.bg)
    this.v.invalidate()
  }

  dispose() {
    this.v.tweens.cancel("sweep")
    this.v.showGrid(true)
    this.studio.dispose()
    super.dispose()
    this.shadow.dispose()
    this.mat.dispose()
    this.mask.dispose()
    for (const t of this.grains.values()) t.dispose()
  }
}
