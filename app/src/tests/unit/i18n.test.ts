// Chinese and English (lib/i18n.ts): which language a page is in, the address of its twin, and a guard
// that every pair written in the code has both halves.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { localizedPath, pickLocale, t } from "@/lib/i18n"
import { staticPages } from "@/lib/page-meta"
import { STARTERS, starterInEnglish } from "@/studio/starters"

const web = { browser: true, desktop: false, stored: null, system: "en-US" }

describe("which language a page is in", () => {
  it("on the website, the address decides: /en is English, anything else Chinese", () => {
    expect(pickLocale({ ...web, path: "/en" })).toBe("en")
    expect(pickLocale({ ...web, path: "/en/studio" })).toBe("en")
    expect(pickLocale({ ...web, path: "/learn", system: "en-US" }), "an English browser on a Chinese address").toBe("zh")
    expect(pickLocale({ ...web, path: "/engine" }), "only the /en segment, not a page that starts with en").toBe("zh")
    expect(pickLocale({ ...web, path: "/learn", stored: "en" }), "the stored choice moves the address instead (applyLocale)").toBe("zh")
  })

  it("in the desktop window, the choice made there, else the system's language", () => {
    const desk = { browser: true, desktop: true, path: "/desktop.html", stored: null }
    expect(pickLocale({ ...desk, system: "zh-Hans-CN" })).toBe("zh")
    expect(pickLocale({ ...desk, system: "en-GB" })).toBe("en")
    expect(pickLocale({ ...desk, system: "de-DE" }), "neither: English").toBe("en")
    expect(pickLocale({ ...desk, system: "en-US", stored: "zh" })).toBe("zh")
  })

  it("in Node (tests, the build, the engine), TURNERY_LANG, else Chinese", () => {
    const node = { browser: false, desktop: false, path: "/", stored: null, system: "" }
    expect(pickLocale(node)).toBe("zh")
    expect(pickLocale({ ...node, env: "en" })).toBe("en")
    expect(t("回到最新", "Back to latest"), "these tests run in Chinese").toBe("回到最新")
  })
})

describe("the twin address in the other language", () => {
  it("adds or drops /en and nothing else", () => {
    expect(localizedPath("/", "en")).toBe("/en")
    expect(localizedPath("/learn", "en")).toBe("/en/learn")
    expect(localizedPath("/en/learn", "zh")).toBe("/learn")
    expect(localizedPath("/en", "zh")).toBe("/")
    expect(localizedPath("/en/studio/s/abc", "en"), "already English").toBe("/en/studio/s/abc")
    expect(localizedPath("/studio", "zh")).toBe("/studio")
  })

  it("every fixed page has its English title and description", () => {
    const zh = staticPages("zh")
    const en = staticPages("en")
    expect(Object.keys(en)).toEqual(Object.keys(zh))
    for (const [p, m] of Object.entries(en)) {
      expect(m.description, p).not.toMatch(/[一-龥]/)
      expect(m.title ?? "", p).not.toMatch(/[一-龥]/)
    }
  })
})

describe("the example models on an English page", () => {
  it("name every feature, intent and parameter in English", () => {
    for (const s of STARTERS) {
      const en = starterInEnglish(s)
      const words = [...en.tree.features.flatMap((f) => [f.name ?? "", f.intent ?? ""]), ...Object.values(en.tree.paramNotes ?? {})]
      expect(words.filter((w) => /[一-龥]/.test(w)), s.id).toEqual([])
    }
  })
})

/** Every t("…", "…") / byLocale("…", "…") with two plain string literals in the app's source. */
function pairs() {
  const root = path.resolve(__dirname, "../..")
  const out: { file: string; zh: string; en: string }[] = []
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name !== "tests" && e.name !== "content") walk(f)
      } else if (/\.tsx?$/.test(e.name)) {
        const text = fs.readFileSync(f, "utf8")
        for (const m of text.matchAll(/\b(?:t|byLocale)\(\s*"((?:[^"\\]|\\.)*)",\s*"((?:[^"\\]|\\.)*)"\s*\)/g)) out.push({ file: path.relative(root, f), zh: m[1], en: m[2] })
      }
    }
  }
  walk(root)
  return out
}

describe("pairs written in the code", () => {
  const all = pairs()

  it("are found (the guard below checks something)", () => {
    expect(all.length).toBeGreaterThan(500)
  })

  it("have an English half with no Chinese left in it, and a Chinese half that isn't empty", () => {
    const bad = all.filter((p) => /[一-龥]/.test(p.en) || !p.en.trim() || !p.zh.trim()).map((p) => `${p.file}: t("${p.zh}", "${p.en}")`)
    expect(bad).toEqual([])
  })
})
