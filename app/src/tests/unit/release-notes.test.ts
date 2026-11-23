// The desktop app's release notes (desktop/CHANGELOG.md, and CHANGELOG.zh-CN.md in Chinese), which the window
// bundles and shows after an update (desktop/ui/whats-new.tsx), and the kit's English copy around them.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { parseChangelog } from "@/lib/changelog"
import { KIT_EN } from "@/lib/kit-strings"

const desktop = path.resolve(import.meta.dirname, "../../../../desktop")
const en = parseChangelog(fs.readFileSync(path.join(desktop, "CHANGELOG.md"), "utf8"))
const zh = parseChangelog(fs.readFileSync(path.join(desktop, "CHANGELOG.zh-CN.md"), "utf8"))
// Chinese characters, and the full-width punctuation that goes with them (「」，。：).
const CJK = /[一-龥\u3000-\u303f\uff00-\uffef]/

describe("the desktop changelog", () => {
  it("has the same versions, groups and items in both languages", () => {
    const shape = (releases: typeof en) => releases.map((r) => ({ version: r.version, date: r.date, groups: r.groups.map((g) => [g.kind, g.items.length]) }))
    expect(en.length).toBeGreaterThan(0)
    expect(shape(en)).toEqual(shape(zh))
  })

  it("uses the four groups only, each with something in it", () => {
    for (const r of [...en, ...zh]) {
      expect(r.groups.length, r.version).toBeGreaterThan(0)
      for (const g of r.groups) expect(["heads-up", "new", "improved", "fixed"], `${r.version} ${g.title}`).toContain(g.kind)
    }
  })

  it("is in English in CHANGELOG.md", () => {
    for (const r of en) for (const item of [r.summary ?? "", ...r.groups.flatMap((g) => [g.title, ...g.items])]) expect(item, r.version).not.toMatch(CJK)
  })
})

describe("the kit's English copy", () => {
  it("has no Chinese left in it", () => {
    const shown = Object.values(KIT_EN).flatMap((v) => (typeof v === "string" ? [v] : []))
    shown.push(KIT_EN.updatedTo("0.14.0"), KIT_EN.releaseDate("2025-11-20"), KIT_EN.itemPosition(1, 3), KIT_EN.selectedCount(2))
    for (const text of shown) expect(text).not.toMatch(CJK)
  })

  it("dates a release like the Chinese does: the year only when it isn't this one", () => {
    const year = new Date().getFullYear()
    expect(KIT_EN.releaseDate(`${year}-11-20`)).toBe("Nov 20")
    expect(KIT_EN.releaseDate(`${year - 1}-01-05`)).toBe(`Jan 5, ${year - 1}`)
  })
})
