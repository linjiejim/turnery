// A face / edge selector in plain words, for the feature card:
// { parallel: "Z", of: "ext1", expect: 4 } → 「平行于 Z 的边 · 来自 拉伸1 · 4 条」
// { not: { extreme: "+Z" } }               → 「除了最上面一圈以外的边」
// Also written into messages to the assistant, so in the agent's language unless the caller says it is
// for the screen (`shown`), where it follows the page's language.
import { isEn } from "../lib/i18n"
import { agentLang } from "../lib/agent-lang"
import { displayName, type Tree } from "./dsl"

type Sel = Record<string, unknown>

const SIDE: Record<string, string> = { "+Z": "最上面", "-Z": "最下面", "+X": "最右边（+X）", "-X": "最左边（-X）", "+Y": "最后面（+Y）", "-Y": "最前面（-Y）" }
const FACING: Record<string, string> = { "+Z": "朝上", "-Z": "朝下", "+X": "朝右（+X）", "-X": "朝左（-X）", "+Y": "朝后（+Y）", "-Y": "朝前（-Y）" }
const SURFACE: Record<string, string> = { plane: "平面", cylinder: "圆柱面", cone: "圆锥面", sphere: "球面", torus: "环面", freeform: "自由曲面" }
const CURVE: Record<string, string> = { line: "直线", circle: "圆弧", freeform: "曲线" }

export function selectorWords(sel: unknown, kind: "face" | "edge", tree: Tree, shown = false): string {
  if (shown ? isEn : agentLang() === "en") return selectorWordsEn(sel, kind, tree)
  if (!sel || typeof sel !== "object") return kind === "face" ? "（没有条件）" : "（没有条件）"
  const s = sel as Sel
  const name = (id: string) => {
    const f = tree.features.find((x) => x.id === id)
    return f ? displayName(tree, f) : id
  }
  const unitWord = kind === "face" ? "个" : "条"
  const noun = kind === "face" ? "面" : "边"

  // The noun phrase: 「最上面那个朝上的平面」「平行于 Z 的直线边」「除了最上面一圈以外的边」.
  const adj: string[] = []
  if (typeof s.normal === "string") adj.push(FACING[s.normal])
  if (typeof s.parallel === "string") adj.push(`平行于 ${s.parallel}`)
  if (s.at && typeof s.at === "object") {
    const at = s.at as { axis: string; value: unknown }
    adj.push(`在 ${at.axis} = ${at.value} 处`)
  }
  if (s.radius !== undefined) adj.push(`R${s.radius}`)
  const side = typeof s.extreme === "string" ? (kind === "edge" ? `${SIDE[s.extreme]}一圈` : `${SIDE[s.extreme]}那个`) : ""
  const kindWord = typeof s.kind === "string" ? (kind === "face" ? SURFACE[s.kind] : `${CURVE[s.kind]}${noun}`) : kind === "face" ? (s.normal ? "平面" : noun) : noun
  const lead = side && adj.length ? `${side}${kind === "edge" ? "、" : ""}${adj.join("、")}` : side || adj.join("、")
  // A space before 的 after a letter or digit: 「平行于 Z 的边」.
  let phrase = lead ? `${lead}${/[A-Za-z0-9]$/.test(lead) ? " " : ""}的${kindWord}` : kindWord
  if (s.faces && typeof s.faces === "object") phrase = `${selectorWords(s.faces, "face", tree, shown).split(" · ")[0]}的边`
  if (s.not && typeof s.not === "object") {
    const not = s.not as Sel
    const what = typeof not.extreme === "string" ? (kind === "edge" ? `${SIDE[not.extreme]}一圈` : `${SIDE[not.extreme]}那个面`) : selectorWords(not, kind, tree, shown).split(" · ")[0]
    phrase = lead || s.kind ? `${phrase}，除了${what}` : `除了${what}以外的${noun}`
  }

  const parts = [phrase]
  if (typeof s.of === "string") parts.push(`来自 ${name(s.of)}`)
  if (Array.isArray(s.near)) parts.push(`靠近 (${s.near.join(", ")})`)
  if (typeof s.expect === "number") parts.push(`${s.expect} ${unitWord}`)
  return parts.join(" · ")
}

// English, for the screen and the agent: 「edges parallel to Z · from Extrude1 · 4 edges」「edges except the top loop」.
const SIDE_EN: Record<string, string> = { "+Z": "top", "-Z": "bottom", "+X": "rightmost (+X)", "-X": "leftmost (-X)", "+Y": "back (+Y)", "-Y": "front (-Y)" }
const FACING_EN: Record<string, string> = { "+Z": "facing up", "-Z": "facing down", "+X": "facing right (+X)", "-X": "facing left (-X)", "+Y": "facing back (+Y)", "-Y": "facing front (-Y)" }
const SURFACE_EN: Record<string, string> = { plane: "plane", cylinder: "cylindrical face", cone: "conical face", sphere: "spherical face", torus: "toroidal face", freeform: "freeform surface" }
const CURVE_EN: Record<string, string> = { line: "straight", circle: "arc", freeform: "curved" }

function selectorWordsEn(sel: unknown, kind: "face" | "edge", tree: Tree): string {
  if (!sel || typeof sel !== "object") return "(no conditions)"
  const s = sel as Sel
  const name = (id: string) => {
    const f = tree.features.find((x) => x.id === id)
    return f ? displayName(tree, f) : id
  }
  const mods: string[] = []
  if (typeof s.normal === "string") mods.push(FACING_EN[s.normal])
  if (typeof s.parallel === "string") mods.push(`parallel to ${s.parallel}`)
  if (s.at && typeof s.at === "object") {
    const at = s.at as { axis: string; value: unknown }
    mods.push(`at ${at.axis} = ${at.value}`)
  }
  if (s.radius !== undefined) mods.push(`R${s.radius}`)
  const extreme = typeof s.extreme === "string" ? SIDE_EN[s.extreme] : ""
  let phrase: string
  if (kind === "face") {
    const kindWord = typeof s.kind === "string" ? SURFACE_EN[s.kind] : s.normal ? "plane" : "face"
    phrase = [extreme, kindWord, mods.join(", ")].filter(Boolean).join(" ")
  } else {
    const kindWord = typeof s.kind === "string" ? `${CURVE_EN[s.kind]} edges` : "edges"
    phrase = extreme ? `${kindWord} of the ${extreme} loop` : kindWord
    if (mods.length) phrase += `${extreme ? "," : ""} ${mods.join(", ")}`
  }
  if (s.faces && typeof s.faces === "object") phrase = `edges of the ${selectorWordsEn(s.faces, "face", tree).split(" · ")[0]}`
  if (s.not && typeof s.not === "object") {
    const not = s.not as Sel
    const what =
      typeof not.extreme === "string" ? (kind === "edge" ? `the ${SIDE_EN[not.extreme]} loop` : `the ${SIDE_EN[not.extreme]} face`) : `the ${selectorWordsEn(not, kind, tree).split(" · ")[0]}`
    phrase = `${phrase}${extreme || mods.length || s.kind ? "," : ""} except ${what}`
  }

  const parts = [phrase]
  if (typeof s.of === "string") parts.push(`from ${name(s.of)}`)
  if (Array.isArray(s.near)) parts.push(`near (${s.near.join(", ")})`)
  if (typeof s.expect === "number") parts.push(`${s.expect} ${kind === "face" ? (s.expect === 1 ? "face" : "faces") : s.expect === 1 ? "edge" : "edges"}`)
  return parts.join(" · ")
}
