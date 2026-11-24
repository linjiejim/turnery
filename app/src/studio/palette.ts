// The part colours and what they're called: no schema library, so the 3D view (three/materials.ts),
// which every lesson and teardown loads, doesn't bring zod with it. studio/appearance.ts re-exports
// all of it with the schemas that check a part's look.
import { t } from "../lib/i18n"

/**
 * The palette: what the window offers and an agent writes by name. Hues stay clear of the view's own
 * signals (the accent blue of a selection, the orange of 「修改」, the teal of hovering).
 * `zh` is the Chinese name an agent may write and the one files and messages use; `name` is what the
 * window shows, in the page's language.
 */
export const PALETTE = [
  { id: "white", zh: "白", name: t("白", "White"), hex: "#f5f5f2" }, // design-allow: part colours are data saved in files, not theme
  { id: "silver", zh: "银灰", name: t("银灰", "Silver"), hex: "#c3c6cb" }, // design-allow: part colour
  { id: "gray", zh: "灰", name: t("灰", "Gray"), hex: "#85888d" }, // design-allow: part colour
  { id: "black", zh: "黑", name: t("黑", "Black"), hex: "#2a2b2e" }, // design-allow: part colour
  { id: "red", zh: "红", name: t("红", "Red"), hex: "#d9473f" }, // design-allow: part colour
  { id: "orange", zh: "橙", name: t("橙", "Orange"), hex: "#f39a2b" }, // design-allow: part colour
  { id: "yellow", zh: "黄", name: t("黄", "Yellow"), hex: "#f2cc3d" }, // design-allow: part colour
  { id: "green", zh: "绿", name: t("绿", "Green"), hex: "#46a05a" }, // design-allow: part colour
  { id: "teal", zh: "青", name: t("青", "Teal"), hex: "#26a69a" }, // design-allow: part colour
  { id: "blue", zh: "蓝", name: t("蓝", "Blue"), hex: "#3d9be9" }, // design-allow: part colour
  { id: "purple", zh: "紫", name: t("紫", "Purple"), hex: "#8a63d2" }, // design-allow: part colour
  { id: "pink", zh: "粉", name: t("粉", "Pink"), hex: "#ec82ae" }, // design-allow: part colour
] as const
export type PaletteId = (typeof PALETTE)[number]["id"]

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i
const byKey = new Map<string, (typeof PALETTE)[number]>(PALETTE.flatMap((c) => [[c.id, c], [c.zh, c]] as const))

/** A palette name (English id or 中文名) or #RRGGBB. */
export function isColor(s: string) {
  return byKey.has(s.trim().toLowerCase()) || byKey.has(s.trim()) || HEX.test(s.trim())
}

/** #rrggbb for any accepted colour; null when it isn't one. */
export function hexOf(color: string | undefined | null): string | null {
  if (!color) return null
  const s = color.trim()
  const named = byKey.get(s.toLowerCase()) ?? byKey.get(s)
  if (named) return named.hex
  if (!HEX.test(s)) return null
  const h = s.slice(1).toLowerCase()
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`
}

/** The palette entry a colour is (by name or by its exact value). */
export function paletteOf(color: string | undefined | null) {
  const hex = hexOf(color)
  return hex ? PALETTE.find((c) => c.hex === hex) ?? null : null
}

/** sRGB #rrggbb → [r, g, b] in 0–1. */
export function rgbOf(hex: string): [number, number, number] {
  const h = hexOf(hex)?.slice(1) ?? "cccccc"
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

/** Relative luminance (WCAG), 0 black – 1 white. */
export function luminance(hex: string) {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgbOf(hex).map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
