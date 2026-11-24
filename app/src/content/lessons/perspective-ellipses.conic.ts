import * as THREE from "three"

/**
 * The exact perspective image of a circle, as an ellipse in screen pixels.
 *
 * A circle (centre c, normal n, radius r) is the conic u² + v² − r² = 0 in its own plane. The camera
 * maps that plane to the screen by a homography H (plane coordinates → pixels), so the image is the
 * conic H⁻ᵀ·diag(1, 1, −r²)·H⁻¹. Its centre, semi-axes and the direction of its minor axis follow
 * from the 2×2 part. This is the true picture the renderer draws, not the sketching rule: the lesson
 * compares the two.
 */
export type ScreenEllipse = {
  /** Centre of the ellipse, px from the top left of the view (y down). Not the image of the circle's centre. */
  cx: number
  cy: number
  /** Semi-major and semi-minor axes, px. */
  a: number
  b: number
  /** Direction of the minor axis on screen, radians in [0, π), y down. */
  minor: number
  /** Ellipse degree as on an ellipse template: minor / major = sin(degree). */
  degree: number
}

export function projectCircle(cam: THREE.PerspectiveCamera, w: number, h: number, c: THREE.Vector3, n: THREE.Vector3, r: number): ScreenEllipse | null {
  cam.updateMatrixWorld()
  const nn = n.clone().normalize()
  const e1 = new THREE.Vector3().crossVectors(nn, Math.abs(nn.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)).normalize()
  const e2 = new THREE.Vector3().crossVectors(nn, e1)
  const M = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
  const clip = (v: THREE.Vector3, wv: number) => new THREE.Vector4(v.x, v.y, v.z, wv).applyMatrix4(M)
  // The whole circle must be in front of the eye, or the image is not an ellipse.
  for (let i = 0; i < 16; i++) {
    const t = (i / 16) * Math.PI * 2
    const p = c.clone().addScaledVector(e1, Math.cos(t) * r).addScaledVector(e2, Math.sin(t) * r)
    if (clip(p, 1).w <= 1e-6) return null
  }
  const k = [clip(e1, 0), clip(e2, 0), clip(c, 1)]
  // Pixel homography rows: x = w/2·(X + W)/W, y = h/2·(W − Y)/W.
  const H = new THREE.Matrix3().set(
    ...(k.map((q) => (w / 2) * (q.x + q.w)) as [number, number, number]),
    ...(k.map((q) => (h / 2) * (q.w - q.y)) as [number, number, number]),
    ...(k.map((q) => q.w) as [number, number, number]),
  )
  if (Math.abs(H.determinant()) < 1e-12) return null
  const e = H.clone().invert().elements
  // Row-major access into the column-major elements.
  const hi = (row: number, col: number) => e[col * 3 + row]
  const q = [1, 1, -r * r]
  const C = (i: number, j: number) => q[0] * hi(0, i) * hi(0, j) + q[1] * hi(1, i) * hi(1, j) + q[2] * hi(2, i) * hi(2, j)
  const A = C(0, 0)
  const B = 2 * C(0, 1)
  const Cc = C(1, 1)
  const D = 2 * C(0, 2)
  const E = 2 * C(1, 2)
  const F = C(2, 2)
  const det = 4 * A * Cc - B * B
  if (det <= 0) return null
  const cx = (-2 * Cc * D + B * E) / det
  const cy = (-2 * A * E + B * D) / det
  const F0 = F + (D * cx + E * cy) / 2
  const mid = (A + Cc) / 2
  const rad = Math.hypot((A - Cc) / 2, B / 2)
  const l1 = mid + rad
  const l2 = mid - rad
  const s1 = -F0 / l1
  const s2 = -F0 / l2
  if (!(s1 > 0 && s2 > 0)) return null
  // The larger eigenvalue (in size) belongs to the shorter axis.
  const lm = Math.abs(l1) >= Math.abs(l2) ? l1 : l2
  let vx = B / 2
  let vy = lm - A
  if (Math.hypot(vx, vy) < 1e-12 * (Math.abs(A) + Math.abs(Cc) + 1e-30)) {
    vx = lm - Cc
    vy = B / 2
  }
  if (Math.hypot(vx, vy) === 0) {
    vx = Math.abs(A) >= Math.abs(Cc) ? 1 : 0
    vy = 1 - vx
  }
  let minor = Math.atan2(vy, vx)
  if (minor < 0) minor += Math.PI
  if (minor >= Math.PI) minor -= Math.PI
  const a = Math.sqrt(Math.max(s1, s2))
  const b = Math.sqrt(Math.min(s1, s2))
  return { cx, cy, a, b, minor, degree: THREE.MathUtils.radToDeg(Math.asin(Math.min(1, b / a))) }
}

/** Smallest angle between two undirected lines, radians in [0, π/2]. */
export function lineAngle(a: number, b: number) {
  let d = Math.abs(a - b) % Math.PI
  if (d > Math.PI / 2) d = Math.PI - d
  return d
}

/** World point on the camera ray through pixel (px, py), at the same view depth as `ref`. */
export function screenToWorld(cam: THREE.PerspectiveCamera, w: number, h: number, px: number, py: number, ref: THREE.Vector3) {
  const z = ref.clone().project(cam).z
  return new THREE.Vector3((px / w) * 2 - 1, -(py / h) * 2 + 1, z).unproject(cam)
}
