// Turn whatever the kernel threw into something people (and the model) can act on.
// With replicad-opencascadejs 1.x, OCCT C++ exceptions arrive as native
// WebAssembly.Exception objects; oc.getExceptionMessage() decodes them.
import { getOC } from "replicad"
import { ExprError } from "../expr"
import { ta } from "../../lib/agent-lang"

export type KernelError = { kind: "occt" | "input" | "js"; type: string; message: string }

/** Thrown for problems in the feature definition itself (bad reference, empty selection…). */
export class InputError extends Error {}

export function describeError(err: unknown): KernelError {
  if (err instanceof InputError || err instanceof ExprError) return { kind: "input", type: "input", message: err.message }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const oc: any = getOC()
  if (typeof WebAssembly !== "undefined" && "Exception" in WebAssembly && err instanceof WebAssembly.Exception) {
    let type = "OCCT"
    let message = ""
    try {
      const decoded = oc.getExceptionMessage(err)
      if (Array.isArray(decoded)) [type, message] = decoded
      else if (decoded) message = String(decoded)
    } catch {
      /* keep defaults */
    }
    try {
      oc.decrementExceptionRefcount(err)
    } catch {
      /* not fatal */
    }
    return { kind: "occt", type, message }
  }
  if (typeof err === "number") return { kind: "occt", type: "Standard_Failure", message: ta(`内核异常 ${err}`, `Kernel exception ${err}`) }
  const e = err as Error
  return { kind: "js", type: e?.name ?? "Error", message: String(e?.message ?? err) }
}

/** Plain-language explanation and a likely fix, per operation. */
export function explain(op: string, e: KernelError): { message: string; hint?: string } {
  if (e.kind === "input") return { message: e.message }
  const raw = `${e.type}${e.message ? `: ${e.message}` : ""}`
  switch (op) {
    case "fillet":
      return {
        message: ta(`内核没能做出这个圆角（${raw}）`, `The kernel couldn't make this fillet (${raw})`),
        hint: ta(
          "多半是半径太大：圆角不能大于相邻面的宽度或壁厚。先试小一点的半径，或少选几条边。",
          "Most likely the radius is too big: a fillet can't be larger than the width of a neighboring face or the wall thickness. Try a smaller radius first, or select fewer edges.",
        ),
      }
    case "chamfer":
      return {
        message: ta(`内核没能做出这个倒角（${raw}）`, `The kernel couldn't make this chamfer (${raw})`),
        hint: ta("倒角距离可能超过了相邻面的宽度，试小一点。", "The chamfer distance may be larger than the width of a neighboring face. Try a smaller one."),
      }
    case "shell":
      return {
        message: ta(`抽壳失败（${raw}）`, `Shell failed (${raw})`),
        hint: ta(
          "壁厚可能大于某处圆角半径或局部尺寸；常见修法是先抽壳再做外圆角，或减小壁厚。",
          "The wall thickness may be larger than a fillet radius or a local dimension somewhere. The usual fix: shell first and add the outer fillets after it, or reduce the wall thickness.",
        ),
      }
    case "extrude":
    case "revolve":
      return {
        message: ta(`${op === "extrude" ? "拉伸" : "旋转"}失败（${raw}）`, `${op === "extrude" ? "Extrude" : "Revolve"} failed (${raw})`),
        hint: ta("检查草图是否闭合、是否自相交；旋转时轮廓不能跨过旋转轴。", "Check that the sketch is closed and doesn't cross itself. For a revolve, the profile must not cross the axis."),
      }
    case "sweep":
      return {
        message: ta(`扫掠失败（${raw}）`, `Sweep failed (${raw})`),
        hint: ta(
          "路径的拐弯半径要大于截面尺寸的一半，否则截面会自交；尖角拐弯用 corner 加圆角。",
          "The path's bend radius must be larger than half the profile's size, or the profile intersects itself. Round sharp bends with corner.",
        ),
      }
    case "loft":
      return {
        message: ta(`放样失败（${raw}）`, `Loft failed (${raw})`),
        hint: ta("各截面要在不同的平行平面上，轮廓的段数和走向尽量一致。", "Each profile must be on a different parallel plane. Keep the profiles' segment counts and directions as alike as you can."),
      }
    case "draft":
      return {
        message: ta(`拔模失败（${raw}）`, `Draft failed (${raw})`),
        hint: ta(
          "选中的面要与中性面相交；拔模角太大或面上已有圆角时也会失败，先拔模再倒圆角。",
          "The selected faces must intersect the neutral plane. Draft also fails when the angle is too big or the faces already have fillets: draft first, then fillet.",
        ),
      }
    default:
      return { message: ta(`内核报错（${raw}）`, `Kernel error (${raw})`) }
  }
}
