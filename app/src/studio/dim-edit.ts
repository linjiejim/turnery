import { t } from "../lib/i18n"
import { promoteToParam, setFieldAt } from "./apply"
import type { Dim } from "./kernel/dims"
import type { Studio } from "./use-studio"

/**
 * The one rule for changing a dimension, from the model or the feature card:
 * a parameter's edits the parameter (÷ the factor for pcd/2), a plain number
 * edits its field or becomes parameter `promoteAs`. Error text or null.
 */
export async function applyDimEdit(studio: Studio, dim: Dim, text: string, promoteAs?: string): Promise<string | null> {
  const v = Number(text)
  if (text.trim() === "" || !Number.isFinite(v)) return t("请输入一个数", "Enter a number")
  const src = dim.source
  if (src.type === "param") return studio.setParam(src.name, v)
  if (src.type === "factor") return studio.setParam(src.name, Math.round((v / src.k) * 1e9) / 1e9)
  if (src.type === "derived") return t("这个数由公式算出，改它用到的参数，或者让助教来改", "This value comes from a formula. Change the parameters it uses, or ask the tutor.")
  if (promoteAs !== undefined) return studio.editTree((tree) => promoteToParam(tree, dim.feature, dim.path, promoteAs.trim(), dim.label, v))
  return studio.editTree((tree) => setFieldAt(tree, dim.feature, dim.path, v))
}
