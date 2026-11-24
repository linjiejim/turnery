import * as THREE from "three"
import { label, line, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { CMF, SOFTBOXES, Studio, contactShadow, grainTexture, greyTexture, hash2, valueNoise } from "./materials-finishes.studio"

/**
 * 6.3.3 「咬花与拔模」: a moulded cover whose outer walls carry an etched texture. The cavity steel
 * carries the same texture as tiny pits and bumps; to let go of the part it has to move away from
 * every bump flank it touches, so the deeper the texture, the more draft. The draft check colours
 * each wall against Mold-Tech's rule of thumb (1° per 12.5–15 µm of depth, shrink-away walls;
 * 2–3 times that where the plastic shrinks onto steel). A magnified section shows the micro
 * undercuts with the texture simplified to a sine; opening the mould with too little draft drags
 * the steel over the grain and polishes shiny streaks into it.
 */
export type Status = "good" | "warn" | "bad"

export type TexState = {
  step: number
  textured: boolean
  /** Texture depth, µm. */
  depth: number
  /** Draft of every side wall, degrees. */
  draft: number
  /** The texture sits on the inner (core) walls instead of the outer ones. */
  inside: boolean
  analysis: boolean
  /** Mould opening, 0 … 1. */
  lift: number
  /** How scuffed the textured walls are, 0 … 1. */
  scuff: number
  /** Magnified section: how far the steel has moved, 0 … 1, and whether it rubbed. */
  pull: number
  rubbed: boolean
  toggled: boolean
  sawRub: boolean
  cleanPull: boolean
  ejectedBad: boolean
  ejectedClean: boolean
}

/**
 * The draft a texture needs, degrees: Mold-Tech's guideline of 1° per 0.0005–0.0006″ (12.5–15 µm) of
 * depth on walls that shrink away from the steel, 2–3 times that where the part shrinks onto it.
 * Smooth walls: at least 0.5°, 1° or more preferred.
 */
export function needed(depth: number, shrinkOn = false) {
  if (depth <= 0) return { lo: 0.5, hi: 1 }
  return shrinkOn ? { lo: Math.max(0.5, (2 * depth) / 15), hi: Math.max(1, (3 * depth) / 12.5) } : { lo: Math.max(0.5, depth / 15), hi: Math.max(1, depth / 12.5) }
}

export function status(draft: number, depth: number, shrinkOn = false): Status {
  const n = needed(depth, shrinkOn)
  return draft + 1e-6 >= n.hi ? "good" : draft + 1e-6 >= n.lo ? "warn" : "bad"
}

/** The walls that carry the texture and how they're judged. */
export function verdict(s: Pick<TexState, "draft" | "depth" | "inside" | "textured">) {
  const depth = s.textured ? s.depth : 0
  const outer = status(s.draft, s.inside ? 0 : depth)
  const inner = status(s.draft, s.inside ? depth : 0, s.inside)
  const worst: Status = [outer, inner].includes("bad") ? "bad" : [outer, inner].includes("warn") ? "warn" : "good"
  return { outer, inner, worst }
}

/** Period of the sine the magnified section uses, mm: chosen so its flank slope gives the same draft as the rule above. */
const LAMBDA = 2.475
/** Release angle of the sine texture: the steepest flank, degrees. */
export function sineRelease(depth: number) {
  return THREE.MathUtils.radToDeg(Math.atan((Math.PI * depth) / 1000 / LAMBDA))
}

const PART = { w: 72, d: 46, h: 26, t: 2.2 }
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
/** Where the magnified section is drawn, in the XZ plane. */
const MICRO = V(170, 0, 0)

function quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, uv: [number, number][]) {
  const g = new THREE.BufferGeometry()
  g.setAttribute("position", new THREE.Float32BufferAttribute([a, b, c, a, c, d].flatMap((p) => [p.x, p.y, p.z]), 3))
  const [ua, ub, uc, ud] = uv
  g.setAttribute("uv", new THREE.Float32BufferAttribute([...ua, ...ub, ...uc, ...ua, ...uc, ...ud], 2))
  g.computeVertexNormals()
  return g
}

/** Outer and inner side walls (front, right, back, left), the top, rim and ceiling of the open box. */
function boxFaces(draft: number) {
  const { w, d, h, t: th } = PART
  const k = Math.tan(THREE.MathUtils.degToRad(draft))
  const slant = 1 / Math.cos(THREE.MathUtils.degToRad(draft))
  const ceil = h - th
  const o = (z: number) => [w / 2 - z * k, d / 2 - z * k]
  const i = (z: number) => [w / 2 - th - z * k, d / 2 - th - z * k]
  // Corners counter-clockwise from (+x, −y) at height z, for a half-size function.
  const ring = (f: (z: number) => number[], z: number) => {
    const [x, y] = f(z)
    return [V(x, -y, z), V(x, y, z), V(-x, y, z), V(-x, -y, z)]
  }
  const outer: THREE.BufferGeometry[] = []
  const inner: THREE.BufferGeometry[] = []
  const ob = ring(o, 0)
  const ot = ring(o, h)
  const ib = ring(i, 0)
  const it = ring(i, ceil)
  // Walls in order front (−Y), right (+X), back (+Y), left (−X): from corner 3→0, 0→1, 1→2, 2→3.
  const pairs = [
    [3, 0],
    [0, 1],
    [1, 2],
    [2, 3],
  ]
  for (const [a, b] of pairs) {
    const lb = ob[a].distanceTo(ob[b])
    const lt = ot[a].distanceTo(ot[b])
    const off = (lb - lt) / 2
    outer.push(quad(ob[a], ob[b], ot[b], ot[a], [[0, 0], [lb, 0], [lb - off, h * slant], [off, h * slant]]))
    const lbi = ib[a].distanceTo(ib[b])
    const lti = it[a].distanceTo(it[b])
    const offi = (lbi - lti) / 2
    // Inner walls face inward: reverse the order.
    inner.push(quad(ib[b], ib[a], it[a], it[b], [[0, 0], [lbi, 0], [lbi - offi, ceil * slant], [offi, ceil * slant]]))
  }
  const top = quad(ot[0], ot[1], ot[2], ot[3], ot.map((p) => [p.x, p.y]) as [number, number][])
  const ceiling = quad(it[3], it[2], it[1], it[0], [[0, 0], [1, 0], [1, 1], [0, 1]])
  const rim: THREE.BufferGeometry[] = pairs.map(([a, b]) => quad(ob[b], ob[a], ib[a], ib[b], [[0, 0], [1, 0], [1, 1], [0, 1]]))
  return { outer, inner, top, ceiling, rim }
}

/** Vertical drag streaks, R channel, tiling: a few dozen across a tile, of different strength and length. */
function scuffMap() {
  const w = 256
  const h = 64
  const a = new Float32Array(w * h)
  for (let x = 0; x < w; x++) {
    const col = hash2(Math.floor(x / 3), 0, 41)
    if (col < 0.78) continue
    const strength = 0.45 + 0.55 * hash2(Math.floor(x / 3), 1, 47)
    for (let y = 0; y < h; y++) a[y * w + x] = Math.min(1, strength * THREE.MathUtils.smoothstep(valueNoise(x / w, y / h, 4, 43), 0.2, 0.55))
  }
  const tex = greyTexture(a, w, h)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export class TextureDraftScene extends LessonScene<TexState> {
  private part = new THREE.Group()
  private mould = new THREE.Group()
  private micro = new THREE.Group()
  private studio: Studio
  private grain = grainTexture("leather", 6)
  private scuffTex = scuffMap()
  private skin = new THREE.MeshPhysicalMaterial({ roughness: 0.55 })
  /** The top: textured like the walls, but square to the pull, so nothing drags over it. */
  private top = new THREE.MeshPhysicalMaterial({ roughness: 0.55 })
  private smooth = new THREE.MeshStandardMaterial({ roughness: 0.4 })
  private flags: Record<Status, THREE.MeshStandardMaterial> = {
    good: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    warn: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
    bad: new THREE.MeshStandardMaterial({ roughness: 0.6 }),
  }
  private flat = {
    part: new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide }),
    steel: new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    rub: new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide }),
  }
  private uniforms = { uScuff: { value: 0 }, uScuffMap: { value: this.scuffTex }, uScuffTile: { value: new THREE.Vector2(40, 30) } }
  private shadow: ReturnType<typeof contactShadow>

  constructor(v: Viewer, emit: (s: TexState) => void) {
    super(v, emit, {
      step: 0,
      textured: false,
      depth: 50,
      draft: 1,
      inside: false,
      analysis: false,
      lift: 0,
      scuff: 0,
      pull: 0,
      rubbed: false,
      toggled: false,
      sawRub: false,
      cleanPull: false,
      ejectedBad: false,
      ejectedClean: false,
    })
    v.setGrid(120, 10)
    v.showGrid(false)
    this.studio = new Studio(v, SOFTBOXES, { intensity: 0.9, headlights: 0.9, room: [0.22, 0.2, 0.26] })
    this.shadow = contactShadow(PART.w, PART.d, 2, 5, v.tokens.bg, 0.45)
    this.root.add(this.part, this.mould, this.micro, this.shadow.mesh)
    this.skin.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms)
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWallUv;")
        .replace("#include <uv_vertex>", "#include <uv_vertex>\nvWallUv = uv;")
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec2 vWallUv;\nuniform sampler2D uScuffMap;\nuniform float uScuff;\nuniform vec2 uScuffTile;")
        .replace(
          "#include <color_fragment>",
          /* glsl */ `#include <color_fragment>
float scuff = uScuff * texture2D( uScuffMap, vWallUv / uScuffTile ).r;
diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.4 ), scuff * 0.5 );`,
        )
        .replace("#include <roughnessmap_fragment>", "float roughnessFactor = mix( roughness, 0.18, scuff );")
        .replace("#include <normal_fragment_maps>", "#include <normal_fragment_maps>\nnormal = normalize( mix( normal, nonPerturbedNormal, scuff ) );")
    }
    this.skin.customProgramCacheKey = () => "texture-scuff"
  }

  enter(step: number) {
    const s = this.state
    this.v.tweens.cancel("eject")
    this.v.tweens.cancel("pull")
    const patch: Partial<TexState> = { step, lift: 0, scuff: 0, pull: 0, rubbed: false, inside: false, analysis: step === 2 || step === 4 }
    patch.textured = step === 0 ? s.textured : true
    if (step === 1) Object.assign(patch, { draft: 1.5, depth: 50 })
    if (step === 2) Object.assign(patch, { draft: 1.5, depth: Math.max(s.depth, 50) })
    if (step === 3) Object.assign(patch, { draft: 2, depth: 75 })
    if (step === 4) Object.assign(patch, { depth: 50, draft: Math.max(4, s.draft) })
    this.set(patch)
    if (step === 1) this.v.setView("front", { target: MICRO.clone().add(V(0, 0, 30)), distance: 175 })
    else if (step === 4) this.v.flyTo(V(150, -170, -120), V(0, 0, 10), 900)
    else this.v.flyTo(V(165, -215, 150), V(0, 0, 11), 900)
  }

  // ------------------------------------------------------------ actions

  setTextured(textured: boolean) {
    this.set({ textured, toggled: this.state.toggled || textured })
  }

  setDepth(depth: number) {
    this.set({ depth, pull: 0, rubbed: false, scuff: 0, lift: 0 })
  }

  setDraft(draft: number) {
    this.set({ draft, pull: 0, rubbed: false, scuff: 0, lift: 0 })
  }

  setInside(inside: boolean) {
    this.set({ inside })
  }

  setAnalysis(analysis: boolean) {
    this.set({ analysis })
  }

  lookInside() {
    this.v.flyTo(V(150, -170, -120), V(0, 0, 10), 800)
  }

  lookOutside() {
    this.v.flyTo(V(165, -215, 150), V(0, 0, 11), 800)
  }

  /** Magnified section: pull the steel off along the mould's opening direction. */
  pullSteel() {
    const s = this.state
    const rubs = s.draft < sineRelease(s.depth) - 1e-6
    this.v.tweens.cancel("pull")
    this.set({ pull: 0, rubbed: false })
    this.v.tweens
      .run(1400, (k) => {
        this.state.pull = k
        this.render()
      }, { tag: "pull" })
      .then(() => {
        if (this.state.step !== 1) return
        this.set({ pull: 1, rubbed: rubs, sawRub: this.state.sawRub || rubs, cleanPull: this.state.cleanPull || (!rubs && s.depth >= 30) })
      })
  }

  /** Open the mould and eject: with too little draft the steel drags over the grain. */
  eject() {
    const s = this.state
    const v = verdict(s)
    const target = v.worst === "bad" ? 1 : v.worst === "warn" ? 0.45 : 0
    this.v.tweens.cancel("eject")
    this.set({ lift: 0, scuff: 0, analysis: false })
    this.v.tweens
      .run(1600, (k) => {
        this.state.lift = k
        this.state.scuff = target * THREE.MathUtils.smoothstep(k, 0, 0.35)
        this.render()
      }, { tag: "eject" })
      .then(() => {
        if (this.state.step !== s.step) return
        this.set({
          lift: 1,
          scuff: target,
          ejectedBad: this.state.ejectedBad || target > 0,
          ejectedClean: this.state.ejectedClean || (target === 0 && this.state.ejectedBad),
        })
      })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const tk = this.v.tokens
    this.clear(this.part)
    this.clear(this.mould)
    this.clear(this.micro)
    this.flags.good.color.copy(tk.good)
    this.flags.warn.color.copy(tk.warn)
    this.flags.bad.color.copy(tk.bad)
    this.smooth.color.copy(CMF.grey)
    this.shadow.recolor(tk.bg)
    this.shadow.mesh.visible = s.step !== 1

    if (s.step === 1) this.renderMicro(s)
    else this.renderPart(s)
    this.v.invalidate()
  }

  private renderPart(s: TexState) {
    const tex = s.textured
    const nScale = THREE.MathUtils.clamp(s.depth / 45, 0.25, 2.6)
    const m = this.skin
    m.color.copy(CMF.grey)
    m.roughness = tex ? 0.6 : 0.15
    const nm = tex ? this.grain : null
    if (m.normalMap !== nm) {
      m.normalMap = nm
      m.needsUpdate = true
    }
    m.normalScale.setScalar(nScale)
    for (const f of [this.top, ...Object.values(this.flags)]) {
      if (f.normalMap !== this.grain) {
        f.normalMap = this.grain
        f.needsUpdate = true
      }
      f.normalScale.setScalar(nScale)
    }
    this.uniforms.uScuff.value = s.scuff

    const faces = boxFaces(s.draft)
    const v = verdict(s)
    const outerTex = tex && !s.inside
    const innerTex = tex && s.inside
    const wallMat = (textured: boolean, st: Status) => (s.analysis ? this.flags[st] : textured ? this.skin : this.smooth)
    for (const g of faces.outer) this.part.add(new THREE.Mesh(g, wallMat(outerTex, v.outer)))
    for (const g of faces.inner) this.part.add(new THREE.Mesh(g, wallMat(innerTex, v.inner)))
    this.top.color.copy(m.color)
    this.top.roughness = m.roughness
    this.part.add(new THREE.Mesh(faces.top, outerTex ? this.top : this.smooth), new THREE.Mesh(faces.ceiling, innerTex ? this.top : this.smooth))
    for (const g of faces.rim) this.part.add(new THREE.Mesh(g, this.smooth))
    // Outline.
    const { w, d, h } = PART
    const k = Math.tan(THREE.MathUtils.degToRad(s.draft))
    const c = (z: number) => {
      const x = w / 2 - z * k
      const y = d / 2 - z * k
      return [V(x, -y, z), V(x, y, z), V(-x, y, z), V(-x, -y, z), V(x, -y, z)]
    }
    const kit = this.v.kit
    const edge = new THREE.Group()
    edge.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(c(0)), kit.edgeSoft), new THREE.Line(new THREE.BufferGeometry().setFromPoints(c(h)), kit.edgeSoft))
    for (let i = 0; i < 4; i++) edge.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([c(0)[i], c(h)[i]]), kit.edgeSoft))
    edge.traverse((o) => (o.raycast = () => {}))
    this.part.add(edge)

    // Draft call-out on the front wall.
    if (s.analysis) {
      const n = needed(s.textured ? s.depth : 0, s.inside)
      const st = s.inside ? v.inner : v.outer
      const msg =
        st === "good"
          ? t(`拔模 ${s.draft}° · 够了`, `Draft ${s.draft}° · enough`)
          : t(`拔模 ${s.draft}° · 要 ${n.lo.toFixed(1)}–${n.hi.toFixed(1)}°`, `Draft ${s.draft}° · needs ${n.lo.toFixed(1)}–${n.hi.toFixed(1)}°`)
      const tone = st === "good" ? "border-success text-success" : st === "warn" ? "border-warning text-warning" : "border-destructive text-destructive"
      this.part.add(label(msg, s.inside ? V(0, -d / 2 + 3, 6) : V(0, -d / 2 - 1, h * 0.55), `font-sans ${tone}`))
    }

    // The cavity half (fixed) lifting off upward during ejection.
    if (s.step === 3) {
      const pad = 8
      const lift = s.lift * 46
      const g = new THREE.BoxGeometry(w + pad * 2, d + pad * 2, h + pad)
      g.translate(0, 0, (h + pad) / 2 + lift)
      const box = new THREE.Mesh(g, kit.ghost)
      box.raycast = () => {}
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), kit.edgeGhost)
      e.raycast = () => {}
      this.mould.add(box, e, tag(t("型腔 · 带纹理的钢", "Cavity · textured steel"), V(0, -d / 2 - pad, h + pad + lift)))
      if (s.scuff > 0.3 && s.lift > 0.5) {
        this.mould.add(label(t("拖花：纹理被刮亮了", "Drag marks: the grain got rubbed shiny"), V(w / 4, -d / 2 - 2, h * 0.35), "border-warning text-warning font-sans"))
      }
    }
  }

  /** Magnified section of one textured wall and the cavity steel, the wall upright, across 10× exaggerated. */
  private renderMicro(s: TexState) {
    const tk = this.v.tokens
    const kit = this.v.kit
    this.flat.part.color.copy(tk.modelDark)
    this.flat.steel.color.copy(tk.metal)
    this.flat.rub.color.copy(tk.bad)
    const H = 6 // mm of wall shown
    const SV = 10 // units per mm, along the wall
    const SH = 0.1 // units per µm, across the wall (10× exaggerated)
    const a = THREE.MathUtils.degToRad(s.draft)
    const dMax = 1.6 // mm the steel travels
    const dist = s.pull * dMax
    const f = (u: number) => (s.depth / 2) * Math.sin((2 * Math.PI * u) / LAMBDA) // µm
    const n = 240
    const zs: number[] = []
    const wallX: number[] = []
    const steelX: number[] = []
    for (let i = 0; i <= n; i++) {
      const u = (H * i) / n
      zs.push(u * SV)
      wallX.push(f(u) * SH)
      steelX.push((f(u - dist * Math.cos(a)) + dist * Math.sin(a) * 1000) * SH)
    }
    const X0 = MICRO.x
    const strip = (left: number[], right: number[], mat: THREE.Material) => {
      const pos: number[] = []
      for (let i = 0; i < n; i++) {
        const quadPts = [
          [left[i], zs[i]],
          [right[i], zs[i]],
          [right[i + 1], zs[i + 1]],
          [left[i + 1], zs[i + 1]],
        ]
        for (const j of [0, 1, 2, 0, 2, 3]) pos.push(X0 + quadPts[j][0], 0, quadPts[j][1])
      }
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3))
      const mesh = new THREE.Mesh(g, mat)
      mesh.raycast = () => {}
      return mesh
    }
    const W = 30
    const partL = wallX.map(() => -W)
    const steelR = steelX.map(() => W)
    this.micro.add(strip(partL, wallX, this.flat.part))
    const steel = strip(steelX, steelR, this.flat.steel)
    steel.position.y = -0.1
    this.micro.add(steel)
    // Where steel and plastic overlap, the steel would have to plough through the grain.
    const rubL = wallX.map((wx, i) => Math.min(wx, steelX[i]))
    const overlap = wallX.some((wx, i) => steelX[i] < wx - 0.05)
    if (overlap) {
      const r = strip(rubL, wallX, this.flat.rub)
      r.position.y = -0.2
      this.micro.add(r)
    }
    const pts = (xs: number[], y: number) => xs.map((x, i) => V(X0 + x, y, zs[i]))
    this.micro.add(line(pts(wallX, -0.3), kit.sketchDefined), line(pts(steelX, -0.3), kit.dimension))
    // Pull direction, drawn with the same exaggeration as the section.
    const dir = new THREE.Vector2(Math.sin(a) * 1000 * SH, Math.cos(a) * SV).normalize()
    const base = V(X0 + W + 8, -0.3, 18)
    const tip = base.clone().add(V(dir.x * 22, 0, dir.y * 22))
    const side = V(-dir.y, 0, dir.x)
    const back = tip.clone().add(V(-dir.x * 4, 0, -dir.y * 4))
    this.micro.add(line([base, tip], kit.sketch), line([back.clone().addScaledVector(side, 2), tip, back.clone().addScaledVector(side, -2)], kit.sketch))
    this.micro.add(label(t("开模方向", "Pull direction"), tip.clone().add(V(0, 0, 4)), "border-transparent bg-transparent font-sans text-muted-foreground"))
    const plain = "border-transparent bg-transparent font-sans text-muted-foreground"
    this.micro.add(label(t("塑料件", "Plastic part"), V(X0 - W / 2, -0.3, H * SV + 5), plain))
    this.micro.add(label(t("型腔钢", "Cavity steel"), V(X0 + W / 2, -0.3, H * SV + 5), plain))
    this.micro.add(label(t("横向放大 10 倍 · 纹理简化成正弦", "Across 10× · texture simplified to a sine"), V(X0, -0.3, -6), plain))
    if (overlap && s.pull > 0) this.micro.add(label(t("钢要犁过纹理：刮擦", "The steel ploughs through the grain: scuffing"), V(X0 - 6, -0.3, 30), "border-destructive text-destructive font-sans"))
    else if (s.pull >= 1) this.micro.add(label(t("一动就离开，干净脱模", "Clear from the first move: a clean release"), V(X0, -0.3, 30), "border-success text-success font-sans"))
  }

  dispose() {
    this.v.tweens.cancel("eject")
    this.v.tweens.cancel("pull")
    this.v.showGrid(true)
    this.studio.dispose()
    super.dispose()
    this.shadow.dispose()
    this.grain.dispose()
    this.scuffTex.dispose()
    this.skin.dispose()
    this.top.dispose()
    this.smooth.dispose()
    for (const m of Object.values(this.flags)) m.dispose()
    for (const m of Object.values(this.flat)) m.dispose()
  }
}
