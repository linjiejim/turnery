import * as THREE from "three"
import type { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { label } from "@/three/build"
import type { V2 } from "@/three/geom"
import type { Viewer } from "@/three/viewer"
import { t } from "@/lib/i18n"
import { LessonScene } from "./scene"
import { comb, dotMesh, fixedDot, onTop, poly, thin } from "./nurbs-curves.draw"
import { DIGITIZED, ORIGINAL, ORIGINAL_SAMPLES, POINTS, TOL, fewest, fitToTolerance, ok, rebuild } from "./curve-rebuild.data"

/**
 * 5.1.2 「曲线质量与重建」: a hand-digitized profile (46 points, a few tenths of a millimetre of
 * error each) and the wobbly curve through them. Rebuild it with a point count and a degree; a
 * deviation plot under the curve (exaggerated) shows how far the rebuild strays, against the
 * tolerance band; the comb shows whether the noise came back. Last, fitting to a tolerance.
 */
export type RebuildDegree = 3 | 5

export type RebuildState = {
  step: number
  count: number
  degree: RebuildDegree
  /** Tolerance in the fit-to-tolerance step (mm). */
  tol: number
  showComb: boolean
  combScale: number
  dev: number
  inflections: number
  under: boolean
  sawWiggle: boolean
  best: boolean
  triedTight: boolean
}

export const MAX_POINTS = 40
/** The deviation plot is drawn this many times larger than life. */
export const EXAGGERATE = 30
const BASE_Y = -28
const CLIP = 26

export class RebuildScene extends LessonScene<RebuildState> {
  private back = new THREE.Group()
  private curves = new THREE.Group()
  private marks = new THREE.Group()
  private dots: CSS2DObject[] = []

  constructor(v: Viewer, emit: (s: RebuildState) => void) {
    const r = rebuild(4, 3)
    super(v, emit, {
      step: 0,
      count: 4,
      degree: 3,
      tol: TOL,
      showComb: false,
      combScale: 520,
      dev: r.dev,
      inflections: r.inflections,
      under: false,
      sawWiggle: false,
      best: false,
      triedTight: false,
    })
    v.setGrid(150, 10)
    this.root.add(this.back, this.curves, this.marks)
    for (let i = 0; i < DIGITIZED; i++) {
      // Control points of the rebuild, shown but not dragged: the point count is the lever here.
      const h = fixedDot()
      this.dots.push(h)
      this.root.add(h)
    }
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<RebuildState> = { step }
    if (step === 0) Object.assign(patch, { showComb: false })
    if (step >= 1) patch.showComb = true
    if (step === 1) Object.assign(patch, { count: s.under ? s.count : 4, degree: 3 })
    if (step === 2) Object.assign(patch, { count: Math.max(s.count, fewest(3)), degree: 3 })
    if (step === 3) Object.assign(patch, { count: 4, degree: 3 })
    if (step === 4) Object.assign(patch, { degree: 3, tol: TOL, count: fitToTolerance(3, TOL) })
    this.update(patch)
    this.v.setView("top", { target: new THREE.Vector3(4, 10, 0), distance: 480 })
  }

  // ------------------------------------------------------------ actions

  revealComb() {
    this.set({ showComb: true })
  }

  setCount(count: number) {
    this.update({ count: Math.max(this.state.degree + 1, Math.min(MAX_POINTS, Math.round(count))) })
  }

  setDegree(degree: RebuildDegree) {
    this.update({ degree, count: Math.max(degree + 1, this.state.count) })
  }

  setTol(tol: number) {
    const count = fitToTolerance(this.state.degree, tol)
    this.update({ tol, count, triedTight: this.state.triedTight || tol <= 0.1 })
  }

  setCombScale(combScale: number) {
    this.set({ combScale })
  }

  /** True when one point fewer would still pass (so the learner knows to keep going). */
  canDropOne() {
    const s = this.state
    return s.count - 1 >= s.degree + 1 && ok(rebuild(s.count - 1, s.degree))
  }

  minimum() {
    return fewest(this.state.degree)
  }

  private update(patch: Partial<RebuildState>) {
    const next = { ...this.state, ...patch }
    const r = rebuild(next.count, next.degree)
    const s = this.state
    this.set({
      ...patch,
      dev: r.dev,
      inflections: r.inflections,
      under: s.under || (next.step >= 1 && r.dev < TOL),
      sawWiggle: s.sawWiggle || (next.step >= 2 && r.inflections >= 2),
      best: s.best || (next.step === 3 && ok(r) && next.count === fewest(next.degree)),
    })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    this.clear(this.back)
    this.clear(this.curves)
    this.clear(this.marks)
    const muted = "border-transparent bg-transparent font-sans text-muted-foreground"

    for (const p of POINTS) this.back.add(dotMesh(onTop(0.3)(p), 0.75, kit.modelDark))

    if (s.step === 0) {
      this.curves.add(poly(ORIGINAL.pts, kit.construction, onTop(0.2)))
      this.curves.add(poly(ORIGINAL_SAMPLES.map((q) => q.p), kit.sketchDefined, onTop(0.4)))
      if (s.showComb) this.curves.add(comb(ORIGINAL_SAMPLES, s.combScale, kit, { maxTooth: 28 }))
      this.marks.add(label(t(`描出来的 ${DIGITIZED} 个点`, `${DIGITIZED} digitized points`), onTop(1)([0, -6]), muted))
      for (const d of this.dots) d.visible = false
      this.v.invalidate()
      return
    }

    const r = rebuild(s.count, s.degree)
    // The original, thin, for reference; the rebuild on top.
    this.back.add(thin(ORIGINAL_SAMPLES.map((q) => q.p), kit.edgeSoft, onTop(0.1)))
    this.curves.add(poly(r.curve.pts, kit.construction, onTop(0.2)))
    this.curves.add(poly(r.samples.map((q) => q.p), kit.sketchDefined, onTop(0.4)))
    if (s.showComb) this.curves.add(comb(r.samples, s.combScale, kit, { maxTooth: 28 }))
    this.dots.forEach((d, i) => {
      d.visible = i < r.curve.pts.length
      if (!d.visible) return
      const p = r.curve.pts[i]
      d.position.set(p[0], p[1], 1)
    })

    this.renderDeviation(r.devs, r.dev, r.worst, s.step === 4 ? s.tol : TOL)
    if (r.inflections > 0) {
      const flips = r.samples.filter((q, i) => i > 0 && q.k > 2e-4 && r.samples[i - 1].k <= 2e-4)
      for (const q of flips.slice(0, 12)) this.marks.add(dotMesh(onTop(0.9)(q.p), 1.3, kit.modified))
    }
    this.v.invalidate()
  }

  /** The deviation along the curve, plotted under it at EXAGGERATE ×, with the tolerance band. */
  private renderDeviation(devs: { p: V2; d: number }[], dev: number, worst: V2, tol: number) {
    const kit = this.v.kit
    const x0 = devs[0].p[0]
    const x1 = devs[devs.length - 1].p[0]
    const band = tol * EXAGGERATE
    this.back.add(thin([[x0, BASE_Y], [x1, BASE_Y]], kit.edgeSoft, onTop(0.1)))
    for (const y of [BASE_Y + band, BASE_Y - band])
      this.back.add(
        poly(
          [
            [x0, y],
            [x1, y],
          ],
          kit.construction,
          onTop(0.2),
        ),
      )
    const clip = (d: number) => Math.max(-CLIP, Math.min(CLIP, d * EXAGGERATE))
    this.curves.add(poly(devs.map((q) => [q.p[0], BASE_Y + clip(q.d)] as V2), kit.dimension, onTop(0.5)))
    const muted = "border-transparent bg-transparent font-sans text-muted-foreground"
    const caption = label(t(`偏差图（放大 ${EXAGGERATE} 倍）`, `Deviation (× ${EXAGGERATE})`), onTop(1)([x0, BASE_Y - CLIP - 3]), muted)
    caption.center.set(0, 0)
    this.marks.add(caption)
    const bandLabel = label(t(`公差带 ± ${tol} mm`, `Tolerance ± ${tol} mm`), onTop(1)([x1, BASE_Y - CLIP - 3]), muted)
    bandLabel.center.set(1, 0)
    this.marks.add(bandLabel)
    // The worst place: on the curve and on the plot.
    const w = devs.find((q) => q.p === worst) ?? devs[0]
    const tone = dev < tol ? "border-success text-success" : "border-warning text-warning"
    this.marks.add(dotMesh(onTop(0.9)([worst[0], BASE_Y + clip(w.d)]), 1.4, kit.modelDark))
    this.marks.add(dotMesh(onTop(0.9)(worst), 1.4, kit.modelDark))
    const tag = label(t(`最大 ${dev.toFixed(2)} mm`, `Max ${dev.toFixed(2)} mm`), onTop(1)([worst[0], worst[1] - 9]), tone)
    this.marks.add(tag)
  }
}
