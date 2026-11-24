// A part's look: a colour and a finish. Saved in the part file (or on a component in an assembly),
// drawn in the 3D view and the agent's pictures, written into 3MF and STEP. Colours are real colours:
// the same in light and dark mode, unlike the scene palette (turnery-theme.css).
import { z } from "zod"
import { t } from "../lib/i18n"
import { agentLang, ta } from "../lib/agent-lang"
import { hexOf, isColor, paletteOf } from "./palette"

export const FINISHES = ["matte", "metal", "clear"] as const
export type Finish = (typeof FINISHES)[number]
/** Finish names in Chinese: what files, the agent's results and the engine's messages say (in English: the ids). */
const FINISH_ZH: Record<Finish, string> = { matte: "哑光", metal: "金属", clear: "透明" }
/** A finish as the agent reads it. */
const finishWord = (f: Finish) => ta(FINISH_ZH[f], f)
/** Finish names as the window shows them (the page's language). */
export const FINISH_NAMES: Record<Finish, string> = { matte: t("哑光", "Matte"), metal: t("金属", "Metal"), clear: t("透明", "Clear") }

export { PALETTE, type PaletteId, isColor, hexOf, paletteOf, rgbOf, luminance } from "./palette"
/** How people read a colour: 「橙」, or the value for one outside the palette. In the agent's language (English: the palette id), for files and messages. */
export function colorName(color: string | undefined | null) {
  const p = paletteOf(color)
  return (p && (agentLang() === "en" ? p.id : p.zh)) ?? hexOf(color) ?? ta("未设置", "not set")
}

/** A colour as the window shows it, in the page's language: 「橙」 / "Orange", or the value. */
export function colorLabel(color: string | undefined | null) {
  return paletteOf(color)?.name ?? hexOf(color) ?? t("未设置", "not set")
}

/** A colour inside a Chinese sentence: 「主要是绿」, 「主要是 #1f6e3a」 (a value gets a space before it); in English every word does (" green"). */
export function colorWord(color: string | undefined | null) {
  if (agentLang() === "en") return ` ${paletteOf(color)?.id ?? hexOf(color) ?? "not set"}`
  return colorWordZh(color)
}

function colorWordZh(color: string | undefined | null) {
  const p = paletteOf(color)
  return p ? p.zh : ` ${hexOf(color) ?? "未设置"}`
}

/** The form saved in files: the palette id when it is one, else lowercase #rrggbb. */
export function normalColor(color: string): string {
  return paletteOf(color)?.id ?? hexOf(color) ?? color
}

// Schema text for the agent, in its language as it stands when this module loads (as in dsl.ts).
export const Color = z
  .string()
  .refine(isColor, {
    message: ta(
      "颜色写色板名（white、silver、gray、black、red、orange、yellow、green、teal、blue、purple、pink）或 #RRGGBB",
      "Write a color as a palette name (white, silver, gray, black, red, orange, yellow, green, teal, blue, purple, pink) or #RRGGBB",
    ),
  })
  .describe(
    ta(
      "颜色：色板名 white 白、silver 银灰、gray 灰、black 黑、red 红、orange 橙、yellow 黄、green 绿、teal 青、blue 蓝、purple 紫、pink 粉；或 #RRGGBB（还原具体的耗材、喷漆颜色时用）",
      "Color: a palette name white, silver, gray, black, red, orange, yellow, green, teal, blue, purple, pink; or #RRGGBB (to match a specific filament or paint color)",
    ),
  )
export const Finish = z.enum(FINISHES).describe(ta("质感：matte 哑光（缺省）、metal 金属、clear 透明", "Finish: matte (the default), metal, clear"))

/** A colour and a finish, each optional (left out: from the part file, or by where the part comes from). */
export const Appearance = z.object({ color: Color.optional(), finish: Finish.optional() })
export type Appearance = z.infer<typeof Appearance>

/** A part file's look: the whole part, and per part after a split (those win). */
export const PartAppearance = Appearance.extend({
  parts: z
    .record(z.string(), Appearance)
    .optional()
    .describe(ta("拆件或多个零件时，按零件名分别设置；比整体的优先", "After a split or with several parts: set each part by its name; this takes precedence over the whole part")),
})
export type PartAppearance = z.infer<typeof PartAppearance>

/** Where a part comes from: how it looks when nothing is set (white, metal grey, a darker grey). */
export type LookSource = "part" | "standard" | "step"

/**
 * A part as drawn: its colour and finish where set, and where it comes from. `fileColor`: a STEP file's
 * own colours (by face; this is the one most faces have), shown when no colour is set.
 */
export type Look = Appearance & { source: LookSource; fileColor?: string }

/** Field by field: `a` wins. */
export function mergeLook(a: Appearance | undefined, b: Appearance | undefined): Appearance {
  const out: Appearance = {}
  const color = a?.color ?? b?.color
  const finish = a?.finish ?? b?.finish
  if (color) out.color = color
  if (finish) out.finish = finish
  return out
}

/** A part file's own look for one of its parts (`name`; none: the whole part). */
export function ownLook(appearance: PartAppearance | undefined, name?: string | null): Appearance {
  if (!appearance) return {}
  return mergeLook(name ? appearance.parts?.[name] : undefined, appearance)
}

/** Something set besides where it comes from: what the toggle and the legend are about. */
export const isSet = (l: Appearance | undefined) => !!(l?.color || l?.finish)

/** A model with nothing to colour: every part plain, made here. */
export function plainOnly(looks: (Look | undefined)[]) {
  return looks.every((l) => !l || (!isSet(l) && l.source === "part"))
}

/**
 * 「橙 · 金属」. In the agent's language (it goes into the agent's results and the engine's messages; English:
 * "orange · metal") unless `shown`: then in the page's language, for the window.
 */
export function lookText(l: Appearance | undefined, unset?: string, shown = false) {
  if (!l || !isSet(l)) return unset ?? (shown ? t("未设置", "Not set") : ta("未设置", "not set"))
  // Matte is the default: named only when it is all that was set.
  const finish = l.finish && (l.finish !== "matte" || !l.color) ? (shown ? FINISH_NAMES[l.finish] : finishWord(l.finish)) : null
  return [l.color ? (shown ? colorLabel : colorName)(l.color) : null, finish].filter(Boolean).join(" · ")
}

const SOURCE_ZH: Record<LookSource, string> = { part: "白模", standard: "标准件按金属色显示", step: "外购件按深灰显示" }
const SOURCE_AGENT_EN: Record<LookSource, string> = { part: "clay (plain white)", standard: "standard parts show in metal color", step: "purchased parts show in dark gray" }
/** What drawing it means when nothing is set, in the agent's language (looked up when read). */
export const SOURCE_DEFAULT: Record<LookSource, string> = {
  get part() {
    return ta(SOURCE_ZH.part, SOURCE_AGENT_EN.part)
  },
  get standard() {
    return ta(SOURCE_ZH.standard, SOURCE_AGENT_EN.standard)
  },
  get step() {
    return ta(SOURCE_ZH.step, SOURCE_AGENT_EN.step)
  },
}
const SOURCE_DEFAULT_EN: Record<LookSource, string> = { part: "clay", standard: "standard parts show as metal", step: "bought-in parts show as dark gray" }

/** What a colour dot says when pointed at: 「橙 · 金属」, or that nothing is set and how it shows then. For the window. */
export function lookTip(look: Look | Appearance | undefined) {
  if (look && isSet(look)) return lookText(look, undefined, true)
  if (look && "fileColor" in look && look.fileColor)
    return t(`未设置颜色（按 STEP 文件自带的颜色，主要是${colorWordZh(look.fileColor)}）`, `No color set (the STEP file’s own colors, mostly ${colorLabel(look.fileColor)})`)
  const source = look && "source" in look ? look.source : "part"
  return t(`未设置颜色（${SOURCE_ZH[source]}）`, `No color set (${SOURCE_DEFAULT_EN[source]})`)
}

/** Without what a part looks like: the geometry, for keys that decide when to rebuild. */
export function withoutLooks<T extends { appearance?: unknown; features: unknown[] }>(tree: T): T {
  const { appearance: _a, ...rest } = tree
  void _a
  return {
    ...rest,
    features: tree.features.map((f) => {
      if (!f || typeof f !== "object" || (f as { op?: string }).op !== "component" || !("appearance" in f)) return f
      const { appearance: _b, ...plain } = f as Record<string, unknown>
      void _b
      return plain
    }),
  } as T
}

/** Same shape: the trees differ at most in their looks. */
export function sameGeometry(a: { appearance?: unknown; features: unknown[] }, b: { appearance?: unknown; features: unknown[] }) {
  return JSON.stringify(withoutLooks(a)) === JSON.stringify(withoutLooks(b))
}

/**
 * Set (or clear, with null) the colour and finish on a part file's tree: the whole part, or the parts
 * named. Fields left out stay as they are. Returns the tree unchanged when nothing changes.
 */
/** A change of look: a field left out stays, null clears it. */
export type LookChange = { color?: string | null; finish?: Finish | null }

/** `cur` with `change` applied (undefined: nothing left set). */
export function applyLook(cur: Appearance | undefined, change: LookChange): Appearance | undefined {
  const next: Appearance = { ...cur }
  if (change.color === null) delete next.color
  else if (change.color !== undefined) next.color = normalColor(change.color)
  if (change.finish === null) delete next.finish
  else if (change.finish !== undefined) next.finish = change.finish
  return isSet(next) ? next : undefined
}

/** 「颜色 橙、质感 金属」「清除颜色」: what a change does, for the activity list (in the agent's language). */
export function changeText(change: LookChange) {
  if (agentLang() === "en") {
    const en: string[] = []
    if (change.color === null) en.push("clear the color")
    else if (change.color !== undefined) en.push(`color ${colorName(change.color)}`)
    if (change.finish === null) en.push("clear the finish")
    else if (change.finish !== undefined) en.push(`finish ${change.finish}`)
    return en.join(", ")
  }
  const bits: string[] = []
  if (change.color === null) bits.push("清除颜色")
  else if (change.color !== undefined) bits.push(`颜色 ${colorName(change.color)}`)
  if (change.finish === null) bits.push("清除质感")
  else if (change.finish !== undefined) bits.push(`质感 ${FINISH_ZH[change.finish]}`)
  return bits.join("、")
}

export function setPartLook<T extends { appearance?: PartAppearance }>(tree: T, parts: string[] | undefined, change: LookChange): T {
  const apply = (cur: Appearance | undefined) => applyLook(cur, change)
  const cur = tree.appearance ?? {}
  let next: PartAppearance
  if (!parts?.length) {
    const top = apply({ color: cur.color, finish: cur.finish })
    next = { ...(top ?? {}), ...(cur.parts ? { parts: cur.parts } : {}) }
  } else {
    const map = { ...cur.parts }
    for (const p of parts) {
      const v = apply(map[p])
      if (v) map[p] = v
      else delete map[p]
    }
    next = { ...(cur.color ? { color: cur.color } : {}), ...(cur.finish ? { finish: cur.finish } : {}), ...(Object.keys(map).length ? { parts: map } : {}) }
  }
  const empty = !isSet(next) && !next.parts
  if (JSON.stringify(empty ? undefined : next) === JSON.stringify(tree.appearance)) return tree
  const { appearance: _drop, ...rest } = tree
  void _drop
  return (empty ? rest : { ...rest, appearance: next }) as T
}

