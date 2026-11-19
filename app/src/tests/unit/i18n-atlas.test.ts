// The command atlas and glossary in English: the overlays in content/en/ cover every entry, hold no
// Chinese, and merge over the Chinese data the way the English pages need. These tests run in Chinese
// (Node), so they check the overlay tables and the merge functions directly, not OPS / TERMS as an
// English page sees them.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { OPS, SOFTWARE, localizeOp } from "@/content/ops"
import { OPS_EN } from "@/content/en/ops"
import { TERMS, localizeTerm } from "@/content/terms"
import { TERMS_EN } from "@/content/en/terms"

const HAN = /[一-龥]/

/** Every string inside a value, with where it is. */
function strings(v: unknown, at: string): { at: string; s: string }[] {
  if (typeof v === "string") return [{ at, s: v }]
  if (Array.isArray(v)) return v.flatMap((x, i) => strings(x, `${at}[${i}]`))
  if (v && typeof v === "object") return Object.entries(v).flatMap(([k, x]) => strings(x, `${at}.${k}`))
  return []
}

describe("the commands in English", () => {
  it("every command has its English name, gist, inputs, options and pitfalls, and no entry is left over", () => {
    for (const op of OPS) {
      const en = OPS_EN[op.id]
      expect(en, op.id).toBeDefined()
      expect(en.name.trim(), op.id).not.toBe("")
      expect(en.gist.trim(), op.id).not.toBe("")
      for (const list of [en.inputs, en.options, en.pitfalls]) {
        expect(list.length, op.id).toBeGreaterThan(0)
        for (const s of list) expect(s.trim(), op.id).not.toBe("")
      }
    }
    expect(Object.keys(OPS_EN).sort()).toEqual(OPS.map((o) => o.id).sort())
  })

  it("names only packages the atlas lists, and only ones the Chinese entry names too", () => {
    const known = SOFTWARE.map((s) => s.id) as string[]
    for (const op of OPS) {
      for (const sw of Object.keys(OPS_EN[op.id].names)) {
        expect(known, `${op.id}.${sw}`).toContain(sw)
        expect(op.names, `${op.id}: no Chinese name for ${sw}`).toHaveProperty(sw)
      }
    }
  })

  it("has no Chinese left in it", () => {
    const bad = strings(OPS_EN, "OPS_EN").filter((x) => HAN.test(x.s) || !x.s.trim())
    expect(bad).toEqual([])
  })

  it("merges over the Chinese: English text, English names where known, the Chinese name where not", () => {
    const zh = OPS.find((o) => o.id === "boolean")!
    const en = localizeOp(zh, OPS_EN.boolean)
    expect(en.name).toBe("Boolean")
    expect(en.gist).toBe(OPS_EN.boolean.gist)
    expect(en.pitfalls).toEqual(OPS_EN.boolean.pitfalls)
    expect(en.names.solidworks).toBe("Combine (Add / Subtract / Common)")
    expect(en.names.creo, "left out of the overlay: the Chinese name stays").toBe(zh.names.creo)
    expect([en.id, en.en, en.category, en.lessons, en.models, en.demo]).toEqual([zh.id, zh.en, zh.category, zh.lessons, zh.models, zh.demo])
    expect(localizeOp(zh, undefined)).toBe(zh)
    expect(localizeOp(zh, { gist: "Only the gist" }).name, "a missing field falls back to Chinese").toBe(zh.name)
  })

  it("every command's text is English once merged (only unconfirmed package names stay Chinese)", () => {
    for (const op of OPS) {
      const en = localizeOp(op, OPS_EN[op.id])
      const text = strings({ name: en.name, gist: en.gist, inputs: en.inputs, options: en.options, pitfalls: en.pitfalls }, op.id)
      expect(text.filter((x) => HAN.test(x.s))).toEqual([])
    }
  })
})

describe("the concepts in English", () => {
  it("every concept has its English name, definition and why, and no entry is left over", () => {
    for (const term of TERMS) {
      const en = TERMS_EN[term.id]
      expect(en, term.id).toBeDefined()
      expect(en.name.trim(), term.id).not.toBe("")
      expect(en.def.trim(), term.id).not.toBe("")
      expect(en.why.trim(), term.id).not.toBe("")
    }
    expect(Object.keys(TERMS_EN).sort()).toEqual(TERMS.map((t) => t.id).sort())
  })

  it("has no Chinese left in it", () => {
    const bad = strings(TERMS_EN, "TERMS_EN").filter((x) => HAN.test(x.s) || !x.s.trim())
    expect(bad).toEqual([])
  })

  it("merges over the Chinese: English text, the en field and the group kept", () => {
    const zh = TERMS.find((t) => t.id === "feature-tree")!
    const en = localizeTerm(zh, TERMS_EN["feature-tree"])
    expect([en.name, en.aka, en.def, en.why]).toEqual([TERMS_EN["feature-tree"].name, TERMS_EN["feature-tree"].aka, TERMS_EN["feature-tree"].def, TERMS_EN["feature-tree"].why])
    expect([en.id, en.en, en.group, en.lessons, en.models]).toEqual([zh.id, zh.en, zh.group, zh.lessons, zh.models])
    expect(localizeTerm(zh, undefined)).toBe(zh)
    expect(localizeTerm(zh, { why: "Only why" }).def, "a missing field falls back to Chinese").toBe(zh.def)
  })
})

describe("the atlas demos' labels", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../../content/demos.ts"), "utf8")

  it("are all written in both languages, with no Chinese in the English half", () => {
    const labels = [...src.matchAll(/\blabel: (?!string\b)(.+?),? (?:min|\})/g)].map((m) => m[1])
    expect(labels.length).toBeGreaterThan(20)
    for (const l of labels) expect(l, "a label is a t(…) pair").toMatch(/^t\("[^"]+", "[^"一-龥]+"\)$/)
  })

  it("leave no Chinese outside a t(…) pair (comments aside)", () => {
    const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\bt\(\s*"(?:[^"\\]|\\.)*",\s*"(?:[^"\\]|\\.)*"\s*\)/g, "")
    expect(code.split("\n").filter((line) => HAN.test(line))).toEqual([])
  })
})
