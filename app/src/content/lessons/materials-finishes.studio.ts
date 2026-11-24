import * as THREE from "three"
import type { Viewer } from "@/three/viewer"

/**
 * A photo studio for the CMF lessons (6.3.x, 6.4.2): an environment of softboxes that only these
 * lessons put on the viewer's scene (restored on dispose), procedural normal maps for surface
 * textures (moulded grain, bead blast, brushing, paint flake), and a soft contact shadow.
 *
 * The environment is built in world coordinates (Z up): a softbox at elevation 40° is 40° above
 * the horizon, whatever the viewer's own RoomEnvironment does. Light levels are greys, not colours.
 */

/** A softbox in the environment: direction (degrees, azimuth from +X, elevation), size and brightness. */
export type Softbox = { az: number; el: number; w: number; h: number; i: number }

/**
 * Product studio: a long strip light above-behind the usual 3/4 view (its reflection crosses the top
 * face as a band), a broad soft box higher up, a top light, two side strips and a weak front fill.
 */
export const SOFTBOXES: Softbox[] = [
  { az: 129, el: 32, w: 7, h: 0.3, i: 14 },
  { az: 140, el: 55, w: 6, h: 3, i: 1.2 },
  { az: 40, el: 82, w: 6, h: 6, i: 2.2 },
  { az: 205, el: 14, w: 1.6, h: 9, i: 3.2 },
  { az: 25, el: 18, w: 1.4, h: 8, i: 2.4 },
  { az: 300, el: 12, w: 9, h: 4, i: 0.7 },
]

/** Inspection booth: a row of thin parallel light tubes on the far side (+Y), like a zebra test. */
export const STRIPS: Softbox[] = Array.from({ length: 23 }, (_, k) => ({ az: 46 + k * 4, el: 34, w: 0.22, h: 15, i: 7 }))

/** CMF swatches: real material colours, the same in light and dark mode. */
export const CMF = {
  plastic: new THREE.Color().setRGB(0.07, 0.075, 0.08, THREE.SRGBColorSpace), // design-allow: CMF swatch (charcoal ABS)
  alu: new THREE.Color().setRGB(0.8, 0.81, 0.82, THREE.SRGBColorSpace), // design-allow: CMF swatch (bead-blasted aluminium)
  steel: new THREE.Color().setRGB(0.76, 0.77, 0.77, THREE.SRGBColorSpace), // design-allow: CMF swatch (stainless steel)
  paint: new THREE.Color().setRGB(0.07, 0.2, 0.55, THREE.SRGBColorSpace), // design-allow: CMF swatch (metallic blue paint)
  grey: new THREE.Color().setRGB(0.42, 0.43, 0.44, THREE.SRGBColorSpace), // design-allow: CMF swatch (mid-grey PC/ABS)
  graphite: new THREE.Color().setRGB(0.3, 0.305, 0.31, THREE.SRGBColorSpace), // design-allow: CMF swatch (graphite satin plastic)
}

/** Floor, horizon and zenith greys of the room around the softboxes. */
export type Room = [number, number, number]

const R_ROOM = 20
const R_BOX = 11

function buildRoom(boxes: Softbox[], room: Room) {
  const scene = new THREE.Scene()
  const sphere = new THREE.SphereGeometry(R_ROOM, 48, 24)
  const pos = sphere.getAttribute("position")
  const col: number[] = []
  const [floor, horizon, top] = room
  // SphereGeometry is Y-up: its y is our height.
  for (let i = 0; i < pos.count; i++) {
    const h = pos.getY(i) / R_ROOM
    const g = h < 0 ? horizon + (floor - horizon) * Math.min(1, -h * 3) : horizon + (top - horizon) * Math.pow(h, 0.7)
    col.push(g, g, g)
  }
  sphere.setAttribute("color", new THREE.Float32BufferAttribute(col, 3))
  sphere.rotateX(Math.PI / 2)
  const disposables: { dispose(): void }[] = [sphere]
  const roomMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
  disposables.push(roomMat)
  scene.add(new THREE.Mesh(sphere, roomMat))
  for (const b of boxes) {
    const g = new THREE.PlaneGeometry(b.w, b.h)
    const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    m.color.setScalar(b.i)
    disposables.push(g, m)
    const mesh = new THREE.Mesh(g, m)
    const az = THREE.MathUtils.degToRad(b.az)
    const el = THREE.MathUtils.degToRad(b.el)
    mesh.position.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)).multiplyScalar(R_BOX)
    mesh.up.set(0, 0, 1)
    if (b.el > 75) mesh.up.set(-Math.sin(az), Math.cos(az), 0)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }
  return { scene, dispose: () => disposables.forEach((d) => d.dispose()) }
}

/**
 * Puts a studio environment on the viewer's scene and dims the viewer's own headlights.
 * Everything it changes is put back by `dispose()`.
 */
export class Studio {
  private v: Viewer
  private rt: THREE.WebGLRenderTarget
  private saved: { env: THREE.Texture | null; intensity: number; rotation: THREE.Euler; lights: [THREE.Light, number][] }

  constructor(v: Viewer, boxes: Softbox[], opts: { intensity?: number; headlights?: number; room?: Room } = {}) {
    this.v = v
    const s = v.scene
    this.saved = { env: s.environment, intensity: s.environmentIntensity, rotation: s.environmentRotation.clone(), lights: [] }
    for (const l of [...v.camera.children, ...s.children]) {
      if (l instanceof THREE.DirectionalLight || l instanceof THREE.HemisphereLight) {
        this.saved.lights.push([l, l.intensity])
        l.intensity *= opts.headlights ?? 1
      }
    }
    const pmrem = new THREE.PMREMGenerator(v.renderer)
    const room = buildRoom(boxes, opts.room ?? [0.12, 0.16, 0.24])
    this.rt = pmrem.fromScene(room.scene, 0.002, 0.1, 100, { size: 512 })
    room.dispose()
    pmrem.dispose()
    s.environment = this.rt.texture
    s.environmentIntensity = opts.intensity ?? 1
    s.environmentRotation.set(0, 0, 0)
    v.invalidate()
  }

  /** Turn the whole studio about the vertical axis (radians). */
  setRotation(rad: number) {
    this.v.scene.environmentRotation.set(0, 0, rad)
    this.v.invalidate()
  }

  setIntensity(k: number) {
    this.v.scene.environmentIntensity = k
    this.v.invalidate()
  }

  dispose() {
    const s = this.v.scene
    s.environment = this.saved.env
    s.environmentIntensity = this.saved.intensity
    s.environmentRotation.copy(this.saved.rotation)
    for (const [l, k] of this.saved.lights) l.intensity = k
    this.rt.dispose()
    this.v.invalidate()
  }
}

/**
 * Sample the environment about half a mip level sharper. The first blurred level of the PMREM is
 * coarse and stair-steps thin lights; a mirror-like finish then reads the sharp level instead.
 */
export function crispReflections(fragmentShader: string) {
  const chunk = THREE.ShaderChunk.envmap_physical_pars_fragment.replaceAll("roughnessToMip( roughness )", "max( 0.0, roughnessToMip( roughness ) - 0.6 )")
  return fragmentShader.replace("#include <envmap_physical_pars_fragment>", chunk)
}

// ---------------------------------------------------------------- procedural maps

/** Deterministic hash → [0, 1). */
export function hash2(i: number, j: number, seed = 0) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 1442695041)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

const fade = (t: number) => t * t * (3 - 2 * t)
const mod = (a: number, n: number) => ((a % n) + n) % n

/** Tileable value noise: `period` cells across the tile, x and y in tile units [0, 1). */
export function valueNoise(x: number, y: number, period: number, seed = 0) {
  const fx = x * period
  const fy = y * period
  const i = Math.floor(fx)
  const j = Math.floor(fy)
  const tx = fade(fx - i)
  const ty = fade(fy - j)
  const h = (a: number, b: number) => hash2(mod(a, period), mod(b, period), seed)
  const a = h(i, j) + (h(i + 1, j) - h(i, j)) * tx
  const b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * tx
  return a + (b - a) * ty
}

/** Height field (rows of n, v up) → tangent-space normal map pixels. */
export function heightToNormal(h: Float32Array, n: number, strength: number) {
  const out = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (h[y * n + ((x + 1) % n)] - h[y * n + ((x - 1 + n) % n)]) * 0.5 * strength
      const dy = (h[((y + 1) % n) * n + x] - h[((y - 1 + n) % n) * n + x]) * 0.5 * strength
      const l = Math.hypot(dx, dy, 1)
      const k = (y * n + x) * 4
      out[k] = Math.round((-dx / l) * 127.5 + 127.5)
      out[k + 1] = Math.round((-dy / l) * 127.5 + 127.5)
      out[k + 2] = Math.round((1 / l) * 127.5 + 127.5)
      out[k + 3] = 255
    }
  return out
}

export type Grain = "leather" | "bead" | "brush" | "flake"

const N = 256
const cache = new Map<Grain, Uint8Array>()

/** Moulded leather grain: rounded pebbles parted by narrow valleys (cellular noise), with a fine sand on top. */
function leather(): Float32Array {
  const P = 14
  const h = new Float32Array(N * N)
  const pts: [number, number][] = []
  for (let j = 0; j < P; j++) for (let i = 0; i < P; i++) pts.push([i + 0.15 + 0.7 * hash2(i, j, 7), j + 0.15 + 0.7 * hash2(i, j, 11)])
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const fx = (x / N) * P
      const fy = (y / N) * P
      const ci = Math.floor(fx)
      const cj = Math.floor(fy)
      let f1 = 9
      let f2 = 9
      for (let dj = -1; dj <= 1; dj++)
        for (let di = -1; di <= 1; di++) {
          const ii = ci + di
          const jj = cj + dj
          const p = pts[mod(jj, P) * P + mod(ii, P)]
          const px = p[0] + (ii - mod(ii, P))
          const py = p[1] + (jj - mod(jj, P))
          const d = Math.hypot(px - fx, py - fy)
          if (d < f1) {
            f2 = f1
            f1 = d
          } else if (d < f2) f2 = d
        }
      const edge = Math.min(1, (f2 - f1) / 0.32)
      const pebble = Math.sqrt(edge) * (1 - 0.35 * f1)
      h[y * N + x] = pebble + 0.12 * valueNoise(x / N, y / N, 64, 3)
    }
  return h
}

/** Bead blast: fine isotropic pits. */
function bead(): Float32Array {
  const h = new Float32Array(N * N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) h[y * N + x] = valueNoise(x / N, y / N, 128, 5) + 0.6 * valueNoise(x / N, y / N, 64, 9)
  return h
}

/** Brushing: fine parallel lines along u, varying slowly along their length. */
function brush(): Float32Array {
  const h = new Float32Array(N * N)
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const line = hash2(0, y, 13) + 0.5 * valueNoise(0, y / N, 64, 17)
      h[y * N + x] = line * (0.75 + 0.25 * valueNoise(x / N, y / N, 4, 19))
    }
  return h
}

function grainPixels(kind: Grain): Uint8Array {
  const hit = cache.get(kind)
  if (hit) return hit
  let px: Uint8Array
  if (kind === "flake") {
    // Paint flake: each little cell tilted its own way (normals written directly).
    px = new Uint8Array(N * N * 4)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        const cx = x >> 1
        const cy = y >> 1
        const nx = (hash2(cx, cy, 21) - 0.5) * 0.9
        const ny = (hash2(cx, cy, 23) - 0.5) * 0.9
        const l = Math.hypot(nx, ny, 1)
        const k = (y * N + x) * 4
        px[k] = Math.round((nx / l) * 127.5 + 127.5)
        px[k + 1] = Math.round((ny / l) * 127.5 + 127.5)
        px[k + 2] = Math.round((1 / l) * 127.5 + 127.5)
        px[k + 3] = 255
      }
  } else {
    const h = kind === "leather" ? leather() : kind === "bead" ? bead() : brush()
    px = heightToNormal(h, N, kind === "leather" ? 26 : kind === "bead" ? 20 : 30)
  }
  cache.set(kind, px)
  return px
}

/** A tiling normal map for a surface texture. `tileMM`: how many millimetres one tile covers (uv in mm). */
export function grainTexture(kind: Grain, tileMM: number) {
  const tex = new THREE.DataTexture(grainPixels(kind), N, N, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.repeat.set(1 / tileMM, 1 / tileMM)
  tex.needsUpdate = true
  return tex
}

/** A data texture from grey levels in [0, 1] (masks, alpha). */
export function greyTexture(values: Float32Array, w: number, h: number) {
  const px = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const g = Math.round(Math.max(0, Math.min(1, values[i])) * 255)
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = g
    px[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(px, w, h, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

// ---------------------------------------------------------------- contact shadow

/**
 * A soft shadow under an object resting on the ground: a rounded rectangle footprint, blurred.
 * The shade is the background darkened, so it reads in light and dark themes alike.
 */
export function contactShadow(w: number, d: number, r: number, soft: number, bg: THREE.Color, strength = 0.5) {
  const W = w + soft * 4
  const D = d + soft * 4
  const n = 128
  const a = new Float32Array(n * n)
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const x = Math.abs(((i + 0.5) / n - 0.5) * W) - (w / 2 - r)
      const y = Math.abs(((j + 0.5) / n - 0.5) * D) - (d / 2 - r)
      const sd = Math.hypot(Math.max(x, 0), Math.max(y, 0)) + Math.min(Math.max(x, y), 0) - r
      a[j * n + i] = strength * (1 - THREE.MathUtils.smoothstep(sd, -soft * 0.6, soft * 1.6))
    }
  const map = greyTexture(a, n, n)
  const mat = new THREE.MeshBasicMaterial({ alphaMap: map, transparent: true, depthWrite: false, toneMapped: false })
  mat.color.copy(bg).multiplyScalar(0.15)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat)
  mesh.position.z = 0.05
  mesh.renderOrder = -1
  mesh.raycast = () => {}
  return {
    mesh,
    recolor: (c: THREE.Color) => mat.color.copy(c).multiplyScalar(0.15),
    dispose: () => {
      map.dispose()
      mat.dispose()
    },
  }
}
