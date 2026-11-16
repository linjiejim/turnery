import * as THREE from "three"
import { LineMaterial } from "three/addons/lines/LineMaterial.js"
import type { SceneTokens } from "./tokens"
import { hexOf, luminance, type Look } from "@/studio/appearance"

/** What a part draws with: its surface and its edges. */
export type LookMaterials = { surface: THREE.Material; edge: THREE.LineBasicMaterial }

/**
 * How the model is drawn: shaded with its edges (`shaded`); as a line drawing, faces in paper and
 * edges and outlines in ink, hidden lines removed (`lines`); or see-through, every edge showing (`xray`).
 */
export type ViewStyle = "shaded" | "lines" | "xray"

/** The paint roles a face can have beside resting (selected, pointed at, a step's new or changed faces). */
type Role = "highlight" | "hovered" | "added" | "modified"

/**
 * 线描 faces: paper, inked where a curved face turns away from the eye. Those outlines are not edges
 * of the solid (a cylinder's sides, a sphere's rim), so they are found here, where the facing (normal ·
 * view) crosses zero: a band about `uWidth` device pixels wide, whatever the distance or the zoom. A flat
 * face never crosses it, so it is never inked. Faces seen from behind are the cut of a section.
 */
const LINE_VERTEX = /* glsl */ `
#include <common>
#include <clipping_planes_pars_vertex>
varying vec3 vNormalV;
varying vec3 vViewPosition;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewPosition = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`
const LINE_FRAGMENT = /* glsl */ `
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uFill;
uniform vec3 uInk;
uniform vec3 uCut;
uniform float uWidth;
varying vec3 vNormalV;
varying vec3 vViewPosition;
void main() {
  #include <clipping_planes_fragment>
  if (!gl_FrontFacing) {
    gl_FragColor = vec4(uCut, 1.0);
  } else {
    vec3 toEye = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
    float facing = dot(normalize(vNormalV), toEye);
    float px = abs(facing) / max(fwidth(facing), 1e-6);
    gl_FragColor = vec4(mix(uFill, uInk, 1.0 - smoothstep(uWidth - 0.5, uWidth + 0.5, px)), 1.0);
  }
  #include <colorspace_fragment>
}`

/**
 * Every material the viewport uses, coloured from the scene tokens.
 * One kit per viewer; `applyTokens` recolours in place on theme change.
 *
 * Surface roles:
 *   model / modelDark / metal / glass   resting geometry
 *   highlight / hovered                 selection / pointer hover
 *   added / modified                    opt-in step changes
 *   ghost                               geometry from later steps (preview)
 * Line roles:
 *   edge / edgeSoft (tangent edges) / edgeGhost / edgeHighlight
 *   sketch (under-defined, accent) / sketchDefined / construction (dashed)
 */
export type SurfaceRole = "model" | "modelDark" | "metal" | "glass" | "highlight" | "modified" | "ghost"

export class MaterialKit {
  readonly clipping: THREE.Plane[] = []

  readonly model = this.surface({ roughness: 0.62, metalness: 0 })
  readonly modelDark = this.surface({ roughness: 0.5, metalness: 0 })
  readonly metal = this.surface({ roughness: 0.32, metalness: 0.85 })
  readonly glass = new THREE.MeshPhysicalMaterial({
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  readonly highlight = this.surface({ roughness: 0.5, metalness: 0, emissiveIntensity: 0.22 })
  readonly hovered = this.surface({ roughness: 0.6, metalness: 0 })
  readonly added = this.surface({ roughness: 0.5, metalness: 0 })
  readonly modified = this.surface({ roughness: 0.5, metalness: 0, emissiveIntensity: 0.18 })
  // Pushed back in depth so it never shimmers over coincident resting faces.
  readonly ghost = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    roughness: 1,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  })
  readonly plane = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide })
  readonly planeHover = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide })

  readonly edge = new THREE.LineBasicMaterial()
  readonly edgeSoft = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75 })
  readonly edgeGhost = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.28, depthWrite: false })
  readonly edgeHighlight = new THREE.LineBasicMaterial()
  readonly planeEdge = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.55 })
  readonly gridMinor = new THREE.LineBasicMaterial({ transparent: true, opacity: 1, depthWrite: false })
  readonly gridMajor = new THREE.LineBasicMaterial({ transparent: true, opacity: 1, depthWrite: false })

  // 线描: paper faces (tinted when selected, pointed at or changed) and ink lines.
  readonly line = this.lineSurface()
  private lineRoles: Record<Role, THREE.ShaderMaterial> = { highlight: this.lineSurface(), hovered: this.lineSurface(), added: this.lineSurface(), modified: this.lineSurface() }
  readonly ink = new THREE.LineBasicMaterial()
  // 半透明: faces seen through, in a neutral grey or the part's own colour, every edge showing.
  readonly xray = this.xraySurface()
  private xrayRoles: Record<Role, THREE.MeshStandardMaterial> = { highlight: this.xraySurface(0.3), hovered: this.xraySurface(0.3), added: this.xraySurface(0.3), modified: this.xraySurface(0.3) }
  /** See-through versions of parts' own colours, made on first use. */
  private xrayLooks = new Map<THREE.Material, THREE.MeshStandardMaterial>()

  readonly sketch = new LineMaterial({ linewidth: 2.2, worldUnits: false })
  readonly sketchThin = new LineMaterial({ linewidth: 1.2, worldUnits: false })
  readonly sketchDefined = new LineMaterial({ linewidth: 2.2, worldUnits: false })
  readonly construction = new LineMaterial({ linewidth: 1.2, worldUnits: false, dashed: true, dashSize: 4, gapSize: 3 })
  readonly dimension = new LineMaterial({ linewidth: 1, worldUnits: false })
  readonly path = new LineMaterial({ linewidth: 2.2, worldUnits: false, dashed: true, dashSize: 3, gapSize: 2 })

  private lineMaterials = [this.sketch, this.sketchThin, this.sketchDefined, this.construction, this.dimension, this.path]
  private sectionOn = false
  /** Parts' own colours, by colour and finish: made on first use, kept for the viewer's life. */
  private looks = new Map<string, LookMaterials>()

  constructor(tokens: SceneTokens) {
    this.applyTokens(tokens)
  }

  private surface(p: THREE.MeshStandardMaterialParameters & { emissiveIntensity?: number }) {
    const m = new THREE.MeshStandardMaterial({ polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...p })
    this.withCutFaces(m)
    return m
  }

  private lineSurface() {
    return new THREE.ShaderMaterial({
      uniforms: { uFill: { value: new THREE.Color() }, uInk: { value: new THREE.Color() }, uCut: { value: new THREE.Color() }, uWidth: { value: 1.6 } },
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      clipping: true,
      // Flat colours as the tokens give them: tone mapping would grey the paper.
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    })
  }

  /** Depth isn't written: faces behind show through those in front, and every edge shows. One colour blends the same in any order. */
  private xraySurface(opacity = 0.2) {
    const m = new THREE.MeshStandardMaterial({ transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, roughness: 0.7, metalness: 0 })
    // Both sides always, section or not (as a clear part).
    m.userData.clear = true
    return m
  }

  /** What a face drawn with `m` when shaded is drawn with in `style`. A see-through context part stays as it is. */
  styled(m: THREE.Material, style: ViewStyle): THREE.Material {
    if (style === "shaded" || m === this.ghost) return m
    const role: Role | null = m === this.highlight ? "highlight" : m === this.hovered ? "hovered" : m === this.added ? "added" : m === this.modified ? "modified" : null
    // A clear part stays see-through on a line drawing: what's inside it still shows.
    if (style === "lines") return role ? this.lineRoles[role] : m === this.glass || m.userData.clear ? this.ghost : this.line
    if (role) return this.xrayRoles[role]
    // A colour of the part's own: see-through in that colour. The theme's greys: the neutral one.
    if ([...this.looks.values()].some((l) => l.surface === m) && (m as THREE.MeshStandardMaterial).color) {
      let x = this.xrayLooks.get(m)
      if (!x) {
        x = this.xraySurface(0.24)
        x.color.copy((m as THREE.MeshStandardMaterial).color)
        this.clip([x])
        this.xrayLooks.set(m, x)
      }
      return x
    }
    return this.xray
  }

  /** What an edge drawn with `m` when shaded is drawn with in `style`: ink on a line drawing. */
  styledEdge(m: THREE.Material, style: ViewStyle): THREE.Material {
    return style === "lines" && m !== this.edgeGhost ? this.ink : m
  }

  /** With a section plane active, back faces seen through the cut are painted flat: the solid looks filled. */
  private withCutFaces(m: THREE.MeshStandardMaterial) {
    const uCut = { value: new THREE.Color() }
    m.userData.uCut = uCut
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCutColor = uCut
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform vec3 uCutColor;")
        .replace("#include <opaque_fragment>", "#include <opaque_fragment>\nif (!gl_FrontFacing) gl_FragColor = vec4(uCutColor, 1.0);")
    }
    m.customProgramCacheKey = () => "ft-cut"
  }

  applyTokens(t: SceneTokens) {
    this.model.color.copy(t.model)
    this.modelDark.color.copy(t.modelDark)
    this.metal.color.copy(t.metal)
    this.glass.color.copy(t.dark ? t.edgeSoft : t.ghost)
    this.hovered.color.copy(t.hover)
    this.added.color.copy(t.good)
    this.highlight.color.copy(t.highlight)
    this.highlight.emissive.copy(t.highlight)
    this.modified.color.copy(t.modified)
    this.modified.emissive.copy(t.modified)
    this.ghost.color.copy(t.ghost)
    this.plane.color.copy(t.plane)
    this.planeHover.color.copy(t.highlight)
    this.edge.color.copy(t.edge)
    this.edgeSoft.color.copy(t.edgeSoft)
    this.edgeGhost.color.copy(t.ghost)
    this.edgeHighlight.color.copy(t.highlight)
    this.planeEdge.color.copy(t.plane)
    this.gridMinor.color.copy(t.grid)
    this.gridMajor.color.copy(t.gridStrong)
    this.sketch.color.copy(t.sketch)
    this.sketchThin.color.copy(t.sketch)
    this.sketchDefined.color.copy(t.defined)
    this.construction.color.copy(t.edgeSoft)
    this.dimension.color.copy(t.defined)
    this.path.color.copy(t.sketch)
    for (const m of [this.model, this.modelDark, this.metal, this.hovered, this.added, this.highlight, this.modified]) (m.userData.uCut as { value: THREE.Color }).value.copy(t.cut)
    // 线描: paper, a light wash of the role's colour on it, ink; the cut a shade of ink on paper.
    const wash: [THREE.ShaderMaterial, THREE.Color, number][] = [
      [this.line, t.paper, 0],
      [this.lineRoles.highlight, t.highlight, 0.28],
      [this.lineRoles.hovered, t.hover, 0.4],
      [this.lineRoles.added, t.good, 0.3],
      [this.lineRoles.modified, t.modified, 0.3],
    ]
    for (const [m, c, k] of wash) {
      m.uniforms.uFill.value.copy(t.paper).lerp(c, k)
      m.uniforms.uInk.value.copy(t.ink)
      m.uniforms.uCut.value.copy(t.paper).lerp(t.ink, 0.18)
    }
    this.ink.color.copy(t.ink)
    this.xray.color.copy(t.edgeSoft)
    this.xrayRoles.highlight.color.copy(t.highlight)
    this.xrayRoles.hovered.color.copy(t.hover)
    this.xrayRoles.added.color.copy(t.good)
    this.xrayRoles.modified.color.copy(t.modified)
  }

  setResolution(w: number, h: number) {
    for (const m of this.lineMaterials) m.resolution.set(w, h)
  }

  surfaceFor(role: SurfaceRole): THREE.Material {
    return this[role]
  }

  /**
   * The materials a part draws with. Nothing set: the theme's own by where it comes from (white model,
   * metal grey for standard parts, a darker grey for STEP files), so light and dark mode still apply.
   * A colour: real colour, the same in either mode, its edges a shade apart so they read on it.
   */
  forLook(look: Look | undefined): LookMaterials {
    const hex = hexOf(look?.color)
    const finish = look?.finish ?? (look?.source === "standard" ? "metal" : "matte")
    if (!hex) {
      if (finish === "clear") return { surface: this.glass, edge: this.edgeSoft }
      if (finish === "metal") return { surface: this.metal, edge: this.edge }
      return look?.source === "step" ? { surface: this.modelDark, edge: this.edgeSoft } : { surface: this.model, edge: this.edge }
    }
    const key = `${hex}|${finish}`
    let m = this.looks.get(key)
    if (!m) {
      m = this.makeLook(hex, finish)
      this.looks.set(key, m)
    }
    return m
  }

  private makeLook(hex: string, finish: "matte" | "metal" | "clear"): LookMaterials {
    const color = new THREE.Color(hex)
    let surface: THREE.MeshStandardMaterial
    if (finish === "clear") {
      // See-through like the reference bodies, tinted: the parts inside stay readable.
      surface = new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })
      // Both sides always: the far wall of a clear shell shows through the near one.
      surface.userData.clear = true
    } else {
      surface = this.surface(finish === "metal" ? { roughness: 0.32, metalness: 0.85 } : { roughness: 0.62, metalness: 0 })
      surface.color.copy(color)
      // The cut face of a section: the part's own colour, darker, so a cut assembly shows whose material is whose.
      ;(surface.userData.uCut as { value: THREE.Color }).value.copy(color).multiplyScalar(0.55)
    }
    // Dark parts get light edges, light ones darker edges of their own hue.
    const edgeColor = luminance(hex) < 0.1 ? color.clone().lerp(new THREE.Color(1, 1, 1), 0.5) : color.clone().multiplyScalar(0.3)
    const edge = new THREE.LineBasicMaterial({ color: edgeColor, ...(finish === "clear" ? { transparent: true, opacity: 0.6 } : {}) })
    this.clip([surface, edge])
    return { surface, edge }
  }

  private lookMaterials() {
    return [...this.looks.values()].flatMap((m) => [m.surface, m.edge])
  }

  /** The other styles' materials (线描, 半透明): clipped by a section like the shaded ones. */
  private styleMaterials(): THREE.Material[] {
    return [this.line, ...Object.values(this.lineRoles), this.ink, this.xray, ...Object.values(this.xrayRoles), ...this.xrayLooks.values()]
  }

  /** A solid face's material: it shows its inside (the cut) only while a section is on. */
  private cutSided(m: THREE.Material) {
    return (m instanceof THREE.MeshStandardMaterial && !m.userData.clear) || m instanceof THREE.ShaderMaterial
  }

  /** Clipping for these materials as for the rest (a section may be on when they're made). */
  private clip(list: THREE.Material[]) {
    for (const m of list) {
      m.clippingPlanes = this.sectionOn ? this.clipping : null
      if (this.cutSided(m)) m.side = this.sectionOn ? THREE.DoubleSide : THREE.FrontSide
      m.needsUpdate = true
    }
  }

  /** Clip every solid surface by `plane` (null turns the section off). */
  setSection(plane: THREE.Plane | null) {
    this.clipping.length = 0
    if (plane) this.clipping.push(plane)
    const on = !!plane
    for (const m of [this.model, this.modelDark, this.metal, this.hovered, this.added, this.highlight, this.modified, this.glass, this.edge, this.edgeSoft, this.edgeHighlight, ...this.lookMaterials(), ...this.styleMaterials()]) {
      m.clippingPlanes = on ? this.clipping : null
      if (this.cutSided(m)) m.side = on ? THREE.DoubleSide : THREE.FrontSide
      m.needsUpdate = this.sectionOn !== on
    }
    this.sectionOn = on
  }

  dispose() {
    for (const v of Object.values(this)) if (v instanceof THREE.Material) v.dispose()
    for (const m of [...this.lookMaterials(), ...this.styleMaterials()]) m.dispose()
    this.looks.clear()
    this.xrayLooks.clear()
  }
}
