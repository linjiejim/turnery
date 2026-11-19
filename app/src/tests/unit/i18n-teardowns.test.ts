// The teardown pages in English (content/en/teardown-text.ts): every baked model's steps, parameters,
// failures and parts have their English, summaries keep their numbers and placeholders, and nothing
// on the page is still Chinese once the overlay is laid over the manifest. These tests run in Chinese
// (no TURNERY_LANG), so they check the table and the pure functions rather than an English page.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { MATERIALS_EN, PROCESSES_EN, SCENE_WORDS_EN, TEARDOWN_TEXT_EN, UNITS_EN, localizeManifest, sceneWordsEn, summaryEn } from "@/content/en/teardown-text"
import type { AssemblyManifest, Manifest, ModelIndexEntry, PartManifest } from "@/three/baked"

const dir = path.join(process.cwd(), "public/models")
const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as Record<string, ModelIndexEntry>
const manifests = Object.values(index).map((m) => JSON.parse(fs.readFileSync(path.join(dir, m.id, "manifest.json"), "utf8")) as Manifest)
const parts = manifests.filter((m): m is PartManifest => m.kind === "part")
const assemblies = manifests.filter((m): m is AssemblyManifest => m.kind === "assembly")

const CHINESE = /[一-龥]/
const placeholders = (s: string) => s.match(/\{\w+\}/g) ?? []
const numbers = (s: string) => s.match(/\d+(?:\.\d+)?/g) ?? []
/** A template with its placeholders taken out: what's left must carry the same numbers. */
const fixedNumbers = (s: string) => numbers(s.replace(/\{\w+\}/g, "#"))

/** Every string in a value, with where it sits. */
function strings(value: unknown, at = ""): { at: string; text: string }[] {
  if (typeof value === "string") return [{ at, text: value }]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}
const stillChinese = (value: unknown) => strings(value).filter((s) => CHINESE.test(s.text))

const TEXT = ["title", "why", "summary", "summaryTemplate", "pitfall"] as const

describe("the teardown pages in English", () => {
  it("has every baked model, of the same kind, and nothing that isn't baked", () => {
    expect(Object.keys(TEARDOWN_TEXT_EN).sort()).toEqual(manifests.map((m) => m.id).sort())
    for (const m of manifests) expect(TEARDOWN_TEXT_EN[m.id].kind, m.id).toBe(m.kind)
  })

  it("translates every feature text, parameter label, failure and baked reason a part has in Chinese", () => {
    for (const m of parts) {
      const en = TEARDOWN_TEXT_EN[m.id]
      if (en.kind !== "part") throw new Error(m.id)
      expect(Object.keys(en.features).filter((id) => !m.features.some((f) => f.id === id)), `${m.id}: features that aren't baked`).toEqual([])
      for (const f of m.features)
        for (const k of TEXT) if (CHINESE.test(f[k])) expect(en.features[f.id]?.[k], `${m.id} ${f.id}.${k}: ${f[k]}`).toBeTruthy()
      expect(Object.keys(en.params).sort(), `${m.id}: parameters`).toEqual(m.params.filter((p) => CHINESE.test(p.label)).map((p) => p.id).sort())
      for (const p of m.params) if (CHINESE.test(p.unit)) expect(UNITS_EN[p.unit], `${m.id} ${p.id}: unit ${p.unit}`).toBeDefined()
      expect(Object.keys(en.failures).sort(), `${m.id}: failures`).toEqual(Object.keys(m.failures).sort())
      for (const v of Object.values(m.variants)) if (v.reason && CHINESE.test(v.reason)) expect(en.reasons?.[v.reason], `${m.id}: reason ${v.reason}`).toBeTruthy()
    }
  })

  it("keeps a summary's numbers in order and a template's placeholders", () => {
    for (const m of parts) {
      const en = TEARDOWN_TEXT_EN[m.id]
      if (en.kind !== "part") throw new Error(m.id)
      for (const f of m.features) {
        const e = en.features[f.id]
        if (e?.summary !== undefined) expect(numbers(e.summary), `${m.id} ${f.id}: "${e.summary}" for "${f.summary}"`).toEqual(numbers(f.summary))
        if (e?.summaryTemplate !== undefined) {
          expect(f.summaryTemplate, `${m.id} ${f.id}: no Chinese template to translate`).not.toBe("")
          expect(placeholders(e.summaryTemplate), `${m.id} ${f.id}: "${e.summaryTemplate}" for "${f.summaryTemplate}"`).toEqual(placeholders(f.summaryTemplate))
          expect(fixedNumbers(e.summaryTemplate), `${m.id} ${f.id}: fixed numbers in the template`).toEqual(fixedNumbers(f.summaryTemplate))
        }
        if (f.summaryTemplate && CHINESE.test(f.summaryTemplate)) expect(e?.summaryTemplate, `${m.id} ${f.id}: template`).toBeTruthy()
      }
    }
  })

  it("puts every baked combination's numbers into the English summary", () => {
    expect(summaryEn("分度圆 d = m × z = 1.5 × 18 = 27", "Pitch diameter d = m × z = 1.5 × 18 = 27", "分度圆 d = m × z = 2 × 36 = 72")).toBe("Pitch diameter d = m × z = 2 × 36 = 72")
    expect(summaryEn("沿草图2 · 合并到杯身", "Along Sketch2 · merged with the body", "沿草图2 · 合并到杯身")).toBe("Along Sketch2 · merged with the body")
    expect(summaryEn("高 30.0", "Height 30.0", "宽 30.0"), "other wording: not this summary").toBeUndefined()
    expect(summaryEn("高 30.0", "Height 30", "高 40.0"), "the English lost a number's form").toBeUndefined()
    for (const m of parts) {
      const en = localizeManifest(m)
      for (const [key, v] of Object.entries(en.variants))
        for (const [id, s] of Object.entries(v.summaries ?? {})) {
          const zh = m.variants[key].summaries![id]
          expect(s, `${m.id} ${key} ${id}: ${zh}`).not.toMatch(CHINESE)
          expect(numbers(s), `${m.id} ${key} ${id}`).toEqual(numbers(zh))
        }
    }
  })

  it("leaves nothing Chinese on a part's page, and keeps ids, ops, numbers, code and views", () => {
    for (const m of parts) {
      const en = localizeManifest(m)
      const shown = {
        features: en.features.map((f) => TEXT.map((k) => f[k])),
        params: en.params.map((p) => [p.label, p.unit]),
        failures: en.failures,
        variants: Object.values(en.variants).map((v) => [v.summaries ?? {}, v.reason ?? ""]),
      }
      expect(stillChinese(shown), m.id).toEqual([])
      const fixed = (x: PartManifest) => ({
        features: x.features.map((f) => [f.id, f.op, f.name, f.view, f.focus, f.code]),
        params: x.params.map((p) => [p.id, p.default, p.values, p.feature]),
        failures: Object.keys(x.failures),
        variants: Object.entries(x.variants).map(([k, v]) => [k, v.ok, v.values, v.file, v.failedAt, v.steps, v.volume, v.bbox, Object.keys(v.summaries ?? {})]),
        rest: [x.id, x.kind, x.defaultVariant, x.source],
      })
      expect(fixed(en), m.id).toEqual(fixed(m))
    }
  })

  it("leaves nothing Chinese on an assembly's page, and keeps ids, order and motion", () => {
    for (const m of assemblies) {
      const en = TEARDOWN_TEXT_EN[m.id]
      if (en.kind !== "assembly") throw new Error(m.id)
      expect(Object.keys(en.parts).sort(), `${m.id}: parts`).toEqual(m.parts.map((p) => p.id).sort())
      expect(en.notes, `${m.id}: one English note per Chinese one`).toHaveLength(m.notes.length)
      for (const p of m.parts) if (p.motion) expect(en.parts[p.id].motion, `${m.id} ${p.id}: motion label`).toBeTruthy()
      const out = localizeManifest(m)
      const shown = { parts: out.parts.map((p) => [p.name, p.material, p.process, p.note, p.motion?.label ?? ""]), notes: out.notes }
      expect(stillChinese(shown), m.id).toEqual([])
      const fixed = (x: AssemblyManifest) => ({
        parts: x.parts.map(({ name: _n, material: _m, process: _p, note: _t, motion, ...rest }) => ({ ...rest, motion: motion && { ...motion, label: "" } })),
        rest: [x.id, x.kind, x.file, x.bytes, x.source, x.notes.length],
      })
      expect(fixed(out), m.id).toEqual(fixed(m))
    }
  })

  it("falls back to the Chinese for anything the overlay lacks, and never changes the baked manifest", () => {
    for (const m of parts) {
      const none = localizeManifest(m, {})
      // Units and materials are shared words, not per model: compare the rest.
      expect({ ...none, params: none.params.map((p) => ({ ...p, unit: m.params.find((q) => q.id === p.id)!.unit })) }, m.id).toEqual(m)
    }
    for (const m of assemblies) {
      const none = localizeManifest(m, {})
      expect(none.parts.map((p) => [p.name, p.note, p.motion]), m.id).toEqual(m.parts.map((p) => [p.name, p.note, p.motion]))
      expect(none.notes, m.id).toEqual(m.notes)
    }
    const before = JSON.stringify(manifests)
    for (const m of manifests) localizeManifest(m)
    expect(JSON.stringify(manifests), "the cached manifest is shared: localizing must copy").toBe(before)
  })

  it("translates every word baked into the scenes", () => {
    // The GLB's JSON chunk holds each node's extras: plane names, dimension and label text.
    const baked = new Set<string>()
    for (const m of manifests) {
      for (const file of fs.readdirSync(path.join(dir, m.id)).filter((f) => f.endsWith(".glb"))) {
        const b = fs.readFileSync(path.join(dir, m.id, file))
        const gltf = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString("utf8")) as { nodes?: { extras?: Record<string, unknown> }[] }
        for (const n of gltf.nodes ?? []) for (const k of ["name", "text"]) if (typeof n.extras?.[k] === "string" && CHINESE.test(n.extras[k] as string)) baked.add(n.extras[k] as string)
      }
    }
    expect(baked.size).toBeGreaterThan(0)
    // The standard planes are bakedWords' own (three/baked.ts).
    const left = [...baked].filter((w) => !/^[前上右后下左]视基准面$/.test(w)).filter((w) => CHINESE.test(sceneWordsEn(w)))
    expect(left).toEqual([])
    expect(sceneWordsEn("分度圆 Ø27")).toBe("Pitch circle Ø27")
    expect(sceneWordsEn("基准面2")).toBe("Plane2")
  })
})

describe("no English string in the teardown text is Chinese", () => {
  it("content/en/teardown-text.ts", () => {
    // Values only: the shared word tables are keyed by the Chinese they translate.
    expect(stillChinese({ TEARDOWN_TEXT_EN, UNITS_EN, MATERIALS_EN, PROCESSES_EN, SCENE_WORDS_EN })).toEqual([])
  })

  it("names every material and process the assemblies use", () => {
    for (const m of assemblies)
      for (const p of m.parts) {
        if (CHINESE.test(p.material)) expect(MATERIALS_EN[p.material], `${m.id} ${p.id}: ${p.material}`).toBeTruthy()
        if (CHINESE.test(p.process)) expect(PROCESSES_EN[p.process], `${m.id} ${p.id}: ${p.process}`).toBeTruthy()
      }
  })
})
