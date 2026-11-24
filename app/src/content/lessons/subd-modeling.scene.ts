import * as THREE from "three"
import { CSS2DObject } from "three/addons/renderers/CSS2DRenderer.js"
import { LineSegments2 } from "three/addons/lines/LineSegments2.js"
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js"
import { label, line } from "@/three/build"
import type { Viewer } from "@/three/viewer"
import { t } from "@/lib/i18n"
import { LessonScene } from "./scene"
import { noPick, paintZebra, zebraMaterial } from "./patch-layout.surf"
import { edgesOf, extrude, faceCentre, faceNormal, meshGeometry, moveFace, patchBoundaries, presetHandle, startBlock, subdivideN, valences, type Mesh } from "./subd-modeling.cc"

/**
 * 5.5.1 · 5.5.2 「SubD 推拉造型；SubD 转 NURBS」: a control cage the learner push-pulls, its
 * Catmull–Clark limit surface live, creased edges, the star points (valence ≠ 4), and the
 * conversion to NURBS (one patch per cage face, the ones touching a star point picked out).
 */
export type SubdState = {
  step: number
  level: number
  zebra: boolean
  selected: number | null
  extrusions: number
  moved: boolean
  creases: number
  foundStar: boolean
  converted: boolean
  /** Bumped whenever the cage changes, so the panel re-reads the counts. */
  rev: number
}

export type CageStats = { faces: number; stars: { valence: number; count: number }[]; starFaces: number; starTotal: number }

export class SubdScene extends LessonScene<SubdState> {
  private cage: Mesh = startBlock()
  private surface = new THREE.Group()
  private overlay = new THREE.Group()
  private surfMesh: THREE.Mesh | null = null
  private triFace: number[] = []
  private zebra = zebraMaterial(new THREE.Vector3(0.25, 1, 0.35))
  private patchMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
  private starMat = new THREE.MeshBasicMaterial()
  private handle: CSS2DObject
  private down: { x: number; y: number } | null = null
  private dragStart: { cage: Mesh; t0: number } | null = null

  constructor(v: Viewer, emit: (s: SubdState) => void) {
    super(v, emit, { step: 0, level: 0, zebra: false, selected: null, extrusions: 0, moved: false, creases: 0, foundStar: false, converted: false, rev: 0 })
    v.setGrid(80, 10)
    this.handle = this.makeHandle()
    this.root.add(this.surface, this.overlay, this.handle)
    const el = v.renderer.domElement
    const onDown = (e: PointerEvent) => (this.down = e.button === 0 ? { x: e.clientX, y: e.clientY } : null)
    const onUp = (e: PointerEvent) => {
      const d = this.down
      this.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return
      this.onClick(e)
    }
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    this.own(() => {
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
    })
  }

  enter(step: number) {
    const s = this.state
    const patch: Partial<SubdState> = { step, converted: false }
    if (step === 0) Object.assign(patch, { zebra: false })
    if (step === 1) Object.assign(patch, { level: Math.max(2, s.level), zebra: false })
    // From the crease step on, work on a handle: the learner's own if they built one, else the example.
    if (step >= 2 && (s.extrusions < 2 || !valences(this.cage).some((n) => n >= 5))) {
      const p = presetHandle()
      this.cage = p.mesh
      Object.assign(patch, { extrusions: p.extrusions, rev: s.rev + 1 })
    }
    if (step >= 2) Object.assign(patch, { selected: null, level: 3 })
    if (step === 2) patch.zebra = false
    if (step === 3) patch.zebra = true
    if (step === 4) patch.zebra = false
    this.set(patch)
    this.frame(step)
  }

  private frame(step: number) {
    const box = new THREE.Box3().setFromPoints(this.cage.v)
    const dir = step === 3 ? new THREE.Vector3(0.75, -1, 0.55) : new THREE.Vector3(0.55, -1, 0.75)
    this.v.fit(box, { dir, padding: step <= 1 ? 1.7 : 1.35 })
  }

  // ------------------------------------------------------------ actions

  setLevel(level: number) {
    this.set({ level })
  }

  setZebra(zebra: boolean) {
    this.set({ zebra })
  }

  extrudeSelected(d = 10) {
    const fi = this.state.selected
    if (fi === null) return
    this.cage = extrude(this.cage, fi, d)
    this.set({ extrusions: this.state.extrusions + 1, rev: this.state.rev + 1 })
  }

  resetCage() {
    this.cage = startBlock()
    this.set({ selected: null, extrusions: 0, moved: false, creases: 0, rev: this.state.rev + 1 })
    this.frame(this.state.step)
  }

  useExample() {
    this.cage = presetHandle().mesh
    this.set({ selected: null, rev: this.state.rev + 1 })
    this.frame(this.state.step)
  }

  clearCreases() {
    this.cage = { ...this.cage, crease: new Set() }
    this.set({ creases: 0, rev: this.state.rev + 1 })
  }

  convert() {
    this.set({ converted: true })
  }

  /** Counts for the panel: faces, star points by valence, patches touching one. */
  stats(): CageStats {
    const val = valences(this.cage)
    const by = new Map<number, number>()
    val.forEach((n) => n !== 4 && by.set(n, (by.get(n) ?? 0) + 1))
    const starFaces = this.cage.f.filter((f) => f.some((i) => val[i] !== 4)).length
    return {
      faces: this.cage.f.length,
      stars: [...by.entries()].sort((a, b) => a[0] - b[0]).map(([valence, count]) => ({ valence, count })),
      starFaces,
      starTotal: [...by.values()].reduce((a, b) => a + b, 0),
    }
  }

  // ------------------------------------------------------------ picking

  private onClick(e: PointerEvent) {
    const s = this.state
    if (s.step === 2) {
      const k = this.edgeAt(e)
      if (k) {
        const crease = new Set(this.cage.crease)
        if (crease.has(k)) crease.delete(k)
        else crease.add(k)
        this.cage = { ...this.cage, crease }
        this.set({ creases: crease.size, rev: s.rev + 1 })
      }
      return
    }
    if (!this.surfMesh) return
    const hit = this.v.pick(e, [this.surfMesh], false)
    if (s.step === 1) {
      const fi = hit && hit.faceIndex != null ? this.triFace[hit.faceIndex] : null
      this.set({ selected: fi === this.state.selected ? null : fi })
    }
    if (s.step === 3 && hit) {
      const lim = subdivideN(this.cage, s.level).mesh
      const val = valences(this.cage)
      const near = val.some((n, i) => n !== 4 && lim.v[i].distanceTo(hit.point) < 4.5)
      if (near) this.set({ foundStar: true })
    }
  }

  /** The cage edge nearest the pointer on screen (within 9 px), skipping edges hidden behind the surface. */
  private edgeAt(e: PointerEvent): string | null {
    const r = this.v.renderer.domElement.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    let best: string | null = null
    let bd = 9
    const caster = new THREE.Raycaster()
    const hidden = (p: THREE.Vector3) => {
      if (!this.surfMesh) return false
      const q = this.v.project(p)
      const ray = this.v.ray({ clientX: r.left + q.x, clientY: r.top + q.y })
      caster.set(ray.origin, ray.direction)
      const hit = caster.intersectObject(this.surfMesh, false)[0]
      return !!hit && hit.distance < p.clone().sub(ray.origin).dot(ray.direction) - 0.5
    }
    for (const [k, ed] of edgesOf(this.cage)) {
      if (hidden(this.cage.v[ed.a].clone().add(this.cage.v[ed.b]).multiplyScalar(0.5))) continue
      const a = this.v.project(this.cage.v[ed.a])
      const b = this.v.project(this.cage.v[ed.b])
      const dx = b.x - a.x
      const dy = b.y - a.y
      const l2 = dx * dx + dy * dy || 1
      const tt = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2))
      const d = Math.hypot(px - a.x - dx * tt, py - a.y - dy * tt)
      if (d < bd) {
        bd = d
        best = k
      }
    }
    return best
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    this.clear(this.surface)
    this.clear(this.overlay)
    paintZebra(this.zebra, tk, 5)
    this.starMat.color.copy(tk.warn)

    const { mesh, origin } = subdivideN(this.cage, s.level)
    const val = valences(this.cage)
    const starFace = (fi: number) => this.cage.f[fi].some((i) => val[i] !== 4)
    const warm = tk.model.clone().lerp(tk.warn, 0.55)
    const sel = s.step === 1 ? s.selected : null
    const color = s.converted ? (fi: number) => (starFace(fi) ? warm : tk.model) : sel !== null ? (fi: number) => (fi === sel ? tk.highlight : tk.model) : undefined
    const { geometry, triFace } = meshGeometry(mesh, origin, { allSharp: s.level === 0, color })
    this.triFace = triFace
    const surf = new THREE.Mesh(geometry, s.zebra ? this.zebra : color ? this.patchMat : kit.model)
    this.surfMesh = surf
    this.surface.add(surf)

    // The control cage: thin accent lines, creased edges heavy.
    const seg: number[] = []
    const creased: THREE.Vector3[][] = []
    for (const [k, e] of edgesOf(this.cage)) {
      const a = this.cage.v[e.a]
      const b = this.cage.v[e.b]
      if (this.cage.crease.has(k)) creased.push([a, b])
      else seg.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }
    if (!s.converted) {
      const lg = new LineSegmentsGeometry().setPositions(seg)
      this.overlay.add(noPick(new LineSegments2(lg, kit.sketchThin)))
    }
    for (const c of creased) this.overlay.add(noPick(line(c, kit.sketchDefined)))

    // NURBS patch boundaries after conversion.
    if (s.converted) {
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(patchBoundaries(mesh, origin), 3))
      this.overlay.add(noPick(new THREE.LineSegments(g, kit.edge)))
    }

    // Star points: on the surface (cage vertex i is vertex i of the subdivided mesh).
    if (s.step >= 3) {
      val.forEach((n, i) => {
        if (n === 4) return
        const p = mesh.v[i]
        const dot = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), this.starMat)
        dot.position.copy(p)
        this.overlay.add(noPick(dot))
        if (s.foundStar || s.step === 4) this.overlay.add(label(String(n), p.clone().add(new THREE.Vector3(0, 0, 3)), "text-foreground"))
      })
    }

    // Push-pull handle on the selected face.
    this.handle.visible = sel !== null
    if (sel !== null && sel < this.cage.f.length) this.handle.position.copy(faceCentre(this.cage, sel).addScaledVector(faceNormal(this.cage, sel), 4))
    this.v.invalidate()
  }

  private makeHandle() {
    const el = document.createElement("div")
    el.className = "interactive size-4 rounded-full border-2 border-primary bg-background cursor-grab transition-shadow hover:ring-4 hover:ring-primary/25"
    el.title = t("沿法向拖动这个面", "Drag the face along its normal")
    const o = new CSS2DObject(el)
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault()
      e.stopPropagation()
      const fi = this.state.selected
      if (fi === null) return
      el.setPointerCapture(e.pointerId)
      this.v.controls.enabled = false
      const c0 = faceCentre(this.cage, fi)
      const n = faceNormal(this.cage, fi)
      const t0 = closestOnLine(this.v.ray(e), c0, n) ?? 0
      this.dragStart = { cage: this.cage, t0 }
      const move = (ev: PointerEvent) => {
        const st = this.dragStart
        if (!st) return
        const tt = closestOnLine(this.v.ray(ev), c0, n)
        if (tt === null) return
        const d = Math.max(-6, Math.min(30, Math.round(tt - st.t0)))
        this.cage = moveFace(st.cage, fi, d)
        this.set({ moved: this.state.moved || d !== 0, rev: this.state.rev + 1 })
      }
      const up = () => {
        this.dragStart = null
        el.removeEventListener("pointermove", move)
        el.removeEventListener("pointerup", up)
        this.v.controls.enabled = true
      }
      el.addEventListener("pointermove", move)
      el.addEventListener("pointerup", up)
    })
    return o
  }

  dispose() {
    super.dispose()
    this.zebra.dispose()
    this.patchMat.dispose()
    this.starMat.dispose()
  }
}

/** Parameter along the line o + t·d closest to the ray. */
function closestOnLine(ray: THREE.Ray, o: THREE.Vector3, d: THREE.Vector3): number | null {
  const w0 = o.clone().sub(ray.origin)
  const a = d.dot(d)
  const b = d.dot(ray.direction)
  const c = ray.direction.dot(ray.direction)
  const dd = d.dot(w0)
  const e = ray.direction.dot(w0)
  const den = a * c - b * b
  if (Math.abs(den) < 1e-9) return null
  return (b * e - c * dd) / den
}

