import * as THREE from "three"
import { edgeLine, label, tag } from "@/three/build"
import { t } from "@/lib/i18n"
import type { Viewer } from "@/three/viewer"
import { LessonScene } from "./scene"
import { BOX, buildBox, cornerKind, ZEBRA_FRAG, ZEBRA_VERT, type CornerKind, type CornerMode, type Radii } from "./fillet-hierarchy.geom"

/**
 * 6.1.2 「圆角的层级与角落」: a box-like product with three edge groups
 * (vertical edges, top loop, bottom loop), each with its own radius. The
 * learner ranks the radii, sees what forms where three filleted edges meet
 * (sphere, torus, crease, blend patch) and checks the corner in zebra
 * stripes. Build order is fixed as in practice: vertical edges first, then
 * the top and bottom loops rolling round them.
 */
export type HierState = Radii & {
  step: number
  mode: CornerMode
  zebra: boolean
  patches: boolean
  /** Sliders moved: 1 vertical, 2 top, 4 bottom. */
  touched: number
  sawCrease: boolean
  /** Under zebra stripes: 1 a crease seen, 2 a smooth corner seen. */
  zebraSeen: number
  top: CornerKind
  bottom: CornerKind
}

const KEY_POS = new THREE.Vector3(205, -250, 190)
const KEY_TARGET = new THREE.Vector3(0, 0, 28)
const CORNER = new THREE.Vector3(BOX.w / 2, -BOX.d / 2, BOX.h)
const CLOSE_POS = new THREE.Vector3(186, -196, 186)
const CLOSE_TARGET = new THREE.Vector3(34, -24, 42)

export const START: Record<number, Partial<HierState>> = {
  0: { rv: 1, rt: 1, rb: 1, mode: "roll", zebra: false, patches: false },
  1: { rv: 10, rt: 4, rb: 2, mode: "roll", zebra: false, patches: true },
  2: { rv: 12, rt: 12, rb: 12, mode: "roll", zebra: false, patches: true },
  3: { rv: 24, rt: 8, rb: 3, mode: "roll", zebra: false, patches: true },
  4: { rv: 10, rt: 20, rb: 3, mode: "roll", zebra: false, patches: true },
  5: { rv: 10, rt: 20, rb: 3, mode: "roll", zebra: true, patches: false },
}

export class HierScene extends LessonScene<HierState> {
  private body = new THREE.Group()
  private zebraMat = new THREE.ShaderMaterial({
    vertexShader: ZEBRA_VERT,
    fragmentShader: ZEBRA_FRAG,
    uniforms: {
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uDir: { value: new THREE.Vector3(0.35, -0.3, 1).normalize() },
      uFreq: { value: 8 },
    },
  })

  constructor(v: Viewer, emit: (s: HierState) => void) {
    super(v, emit, {
      step: 0,
      rv: 1,
      rt: 1,
      rb: 1,
      mode: "roll",
      zebra: false,
      patches: false,
      touched: 0,
      sawCrease: false,
      zebraSeen: 0,
      top: "sharp",
      bottom: "sharp",
    })
    v.setGrid(120, 10)
    this.root.add(this.body)
  }

  enter(step: number) {
    this.update({ step, ...START[step] })
    if (step === 0 || step === 2) this.v.flyTo(KEY_POS.clone(), KEY_TARGET.clone(), 900)
    else this.closeUp()
  }

  // ------------------------------------------------------------ actions

  setRadius(which: "rv" | "rt" | "rb", value: number) {
    const bit = which === "rv" ? 1 : which === "rt" ? 2 : 4
    this.update({ [which]: value, touched: this.state.touched | bit })
  }

  /** All three groups at once (the predict reveal). */
  setAll(r: number) {
    this.update({ rv: r, rt: r, rb: r })
    this.closeUp()
  }

  setRadii(r: Partial<Radii>) {
    this.update(r)
  }

  setMode(mode: CornerMode) {
    this.update({ mode })
  }

  setZebra(zebra: boolean) {
    this.update({ zebra })
  }

  setPatches(patches: boolean) {
    this.update({ patches })
  }

  closeUp() {
    this.v.flyTo(CLOSE_POS.clone(), CLOSE_TARGET.clone(), 900)
  }

  overview() {
    this.v.flyTo(KEY_POS.clone(), KEY_TARGET.clone(), 800)
  }

  private update(patch: Partial<HierState>) {
    const n = { ...this.state, ...patch }
    const top = cornerKind(n.rt, n.rv, n.mode)
    const bottom = cornerKind(n.rb, n.rv, n.mode)
    const crease = top === "crease" || bottom === "crease"
    let zebraSeen = n.zebraSeen
    if (n.zebra && n.step === 5) zebraSeen |= crease ? 1 : top !== "sharp" ? 2 : 0
    this.set({ ...patch, top, bottom, sawCrease: n.sawCrease || crease, zebraSeen })
  }

  // ------------------------------------------------------------ rendering

  protected render() {
    const s = this.state
    const kit = this.v.kit
    const tk = this.v.tokens
    const u = this.zebraMat.uniforms
    ;(u.uA.value as THREE.Color).copy(tk.defined)
    ;(u.uB.value as THREE.Color).copy(tk.bg)

    this.clear(this.body)
    const box = buildBox(s, s.mode)
    const mats: THREE.Material[] = s.zebra ? [this.zebraMat, this.zebraMat] : [kit.model, s.patches ? kit.highlight : kit.model]
    const mesh = new THREE.Mesh(box.geometry, mats)
    mesh.userData = { kind: "face", feature: "fillet", role: "model" }
    this.body.add(mesh)
    for (const l of box.soft) this.body.add(edgeLine(l, kit, true))
    for (const l of box.sharp) this.body.add(edgeLine(l, kit))
    if (s.patches || s.zebra) for (const l of box.patch) this.body.add(edgeLine(l, kit))

    if (s.step === 0) {
      this.body.add(tag(t("竖边", "Vertical edges"), new THREE.Vector3(BOX.w / 2 + 4, -BOX.d / 2 - 4, BOX.h * 0.45)))
      this.body.add(tag(t("顶边", "Top edges"), new THREE.Vector3(-10, -BOX.d / 2 - 2, BOX.h + 4)))
      this.body.add(tag(t("底边", "Bottom edges"), new THREE.Vector3(-10, -BOX.d / 2 - 4, -4)))
    } else if (s.top !== "sharp") {
      const kind = s.top
      const text =
        kind === "sphere"
          ? t(`球面 R${fmt(s.rt)}`, `Sphere R${fmt(s.rt)}`)
          : kind === "torus"
            ? t("圆环面", "Torus")
            : kind === "crease"
              ? t("折痕：顶边圆角转不过去", "Crease: the top fillet can't turn the corner")
              : t("角落过渡面", "Corner blend patch")
      const lb = label(text, CORNER.clone().add(new THREE.Vector3(8, -8, 10)), kind === "crease" ? "border-destructive text-destructive font-sans" : "font-sans")
      lb.center.set(0, 1)
      this.body.add(lb)
    }
    this.v.invalidate()
  }

  dispose() {
    super.dispose()
    this.zebraMat.dispose()
  }
}

const fmt = (v: number) => String(Math.round(v * 10) / 10)
