import type { ViewStyle } from "@/three/materials"

/**
 * How the model looks, as the 「显示样式」 card offers it: a white model, the parts' own colours, a line
 * drawing, or see-through. Underneath it is still two kept switches, the style (shaded / lines / xray)
 * and colours on or off, so what a person chose before reads back the same.
 */
export type ViewLook = "plain" | "colour" | "lines" | "xray"

/** In the card's order, which is also the order W steps through. */
export const VIEW_LOOKS: ViewLook[] = ["plain", "colour", "lines", "xray"]

export const LOOK_WORDS: Record<ViewLook, string> = { plain: "白模", colour: "彩色", lines: "线描", xray: "半透明" }

/** The look the two switches make. */
export function viewLook(style: ViewStyle, colours: boolean): ViewLook {
  if (style !== "shaded") return style
  return colours ? "colour" : "plain"
}

/** The switches a look sets: a line drawing and see-through leave the colour switch as it was. */
export function lookPrefs(look: ViewLook): { style: ViewStyle; colours?: boolean } {
  if (look === "plain") return { style: "shaded", colours: false }
  if (look === "colour") return { style: "shaded", colours: true }
  return { style: look }
}

/** W: the next look, round the card's order. */
export function nextLook(look: ViewLook): ViewLook {
  return VIEW_LOOKS[(VIEW_LOOKS.indexOf(look) + 1) % VIEW_LOOKS.length]
}

/** A: a white model and colours swap; from a line drawing or see-through, back to colours. */
export function colourKey(look: ViewLook): ViewLook {
  return look === "colour" ? "plain" : "colour"
}

/**
 * Whether the parts are drawn with their own looks. Only shaded follows the switch (白模 / 彩色): see-through
 * shows the colours (that's how parts tell apart in it), and a line drawing keeps a clear part clear, so the
 * one 线描 the card shows looks the same however it was reached.
 */
export function drawsColours(style: ViewStyle, colours: boolean): boolean {
  return colours || style !== "shaded"
}
