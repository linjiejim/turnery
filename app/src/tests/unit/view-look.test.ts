import { describe, expect, it } from "vitest"
import { colourKey, drawsColours, lookPrefs, nextLook, VIEW_LOOKS, viewLook } from "@/studio/view-look"

describe("display look: 白模 / 彩色 / 线描 / 半透明", () => {
  it("reads the two kept switches as one of four looks", () => {
    expect(viewLook("shaded", false)).toBe("plain")
    expect(viewLook("shaded", true)).toBe("colour")
    expect(viewLook("lines", true)).toBe("lines")
    expect(viewLook("lines", false)).toBe("lines")
    expect(viewLook("xray", false)).toBe("xray")
    expect(viewLook("xray", true)).toBe("xray")
  })

  it("sets the switches back from a look; a line drawing and see-through leave the colour switch alone", () => {
    expect(lookPrefs("plain")).toEqual({ style: "shaded", colours: false })
    expect(lookPrefs("colour")).toEqual({ style: "shaded", colours: true })
    expect(lookPrefs("lines")).toEqual({ style: "lines" })
    expect(lookPrefs("xray")).toEqual({ style: "xray" })
    for (const look of VIEW_LOOKS) {
      const p = lookPrefs(look)
      expect(viewLook(p.style, p.colours ?? true)).toBe(look)
      expect(viewLook(p.style, p.colours ?? false)).toBe(look)
    }
  })

  it("W goes 白模 → 彩色 → 线描 → 半透明 → 白模", () => {
    expect(VIEW_LOOKS).toEqual(["plain", "colour", "lines", "xray"])
    expect(nextLook("plain")).toBe("colour")
    expect(nextLook("colour")).toBe("lines")
    expect(nextLook("lines")).toBe("xray")
    expect(nextLook("xray")).toBe("plain")
  })

  it("A swaps a white model and colours, and brings a line drawing or see-through back to colours", () => {
    expect(colourKey("plain")).toBe("colour")
    expect(colourKey("colour")).toBe("plain")
    expect(colourKey("lines")).toBe("colour")
    expect(colourKey("xray")).toBe("colour")
  })

  it("see-through always draws the parts' colours; shaded follows the switch", () => {
    expect(drawsColours("xray", false)).toBe(true)
    expect(drawsColours("xray", true)).toBe(true)
    expect(drawsColours("shaded", false)).toBe(false)
    expect(drawsColours("shaded", true)).toBe(true)
    expect(drawsColours("lines", true)).toBe(true)
  })
})
