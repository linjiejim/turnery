// The course catalog in English (content/en/*): every track, module, lesson, project and persona of
// the curriculum, every interactive lesson and every baked teardown has its English, and none of it
// is still Chinese. These tests run in Chinese (no TURNERY_LANG), so they check the overlay tables
// and the pure localize functions directly rather than what an English page would load.
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import data from "@/content/curriculum.json"
import { CURRICULUM_EN, localizeCurriculum } from "@/content/en/curriculum"
import { LESSONS_EN, localizeLessons } from "@/content/en/lessons"
import { LEVELS_EN, localizePlanned, PLANNED_EN, PLANNED_KINDS_EN, TEARDOWNS_EN, localizeIndex } from "@/content/en/teardowns"
import type { Persona, Project, Track } from "@/content/curriculum"
import { LESSONS } from "@/content/lessons"
import { PLANNED_ZH } from "@/content/teardowns"
import type { ModelIndexEntry } from "@/three/baked"

const curriculum = data as { tracks: Track[]; projects: Project[]; personas: Persona[] }
const models = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/models/index.json"), "utf8")) as Record<string, ModelIndexEntry>

const CHINESE = /[一-龥]/
/** Prose rather than a list of ids: Chinese words, or the Chinese list comma and brackets. */
const PROSE = /[一-龥、（）]/

const modules = curriculum.tracks.flatMap((t) => t.modules)
const lessons = modules.flatMap((m) => m.lessons)

/** Every string in a value, with where it sits. */
function strings(value: unknown, at = ""): { at: string; text: string }[] {
  if (typeof value === "string") return [{ at, text: value }]
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${at}[${i}]`))
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, at ? `${at}.${k}` : k))
  return []
}

const stillChinese = (value: unknown) => strings(value).filter((s) => CHINESE.test(s.text))

describe("the curriculum in English", () => {
  it("has every track, module, lesson, project and persona, and nothing that isn't there", () => {
    expect(Object.keys(CURRICULUM_EN.tracks).sort()).toEqual(curriculum.tracks.map((t) => t.id).sort())
    expect(Object.keys(CURRICULUM_EN.modules).sort()).toEqual(modules.map((m) => m.id).sort())
    expect(Object.keys(CURRICULUM_EN.lessons).sort()).toEqual(lessons.map((l) => l.id).sort())
    expect(Object.keys(CURRICULUM_EN.projects).sort()).toEqual(curriculum.projects.map((p) => p.id).sort())
    expect(Object.keys(CURRICULUM_EN.personas).sort(), "personas by their Chinese name").toEqual(curriculum.personas.map((p) => p.name).sort())
  })

  it("translates every note, prose prerequisite, 3D note and persona path the Chinese has", () => {
    for (const t of curriculum.tracks) if (t.note) expect(CURRICULUM_EN.tracks[t.id].note, `track ${t.id}`).toBeTruthy()
    for (const m of modules) if (m.note) expect(CURRICULUM_EN.modules[m.id].note, `module ${m.id}`).toBeTruthy()
    for (const l of lessons) {
      if (PROSE.test(l.prereq)) expect(CURRICULUM_EN.lessons[l.id].prereq, `lesson ${l.id} prereq "${l.prereq}"`).toBeTruthy()
      if (l.interactiveNote) expect(CURRICULUM_EN.lessons[l.id].interactiveNote, `lesson ${l.id} 3D note`).toBeTruthy()
    }
    for (const p of curriculum.projects) if (PROSE.test(p.prereq)) expect(CURRICULUM_EN.projects[p.id].prereq, `project ${p.id}`).toBeTruthy()
    for (const p of curriculum.personas) if (PROSE.test(p.path)) expect(CURRICULUM_EN.personas[p.name].path, `persona ${p.name}`).toBeTruthy()
  })

  it("leaves nothing Chinese once laid over the curriculum, and keeps ids and numbers", () => {
    const en = localizeCurriculum(curriculum)
    // `en` on a lesson is the English CAD term shown beside the Chinese title; English pages don't show it.
    const shown = en.tracks.map((t) => ({ ...t, modules: t.modules.map((m) => ({ ...m, lessons: m.lessons.map(({ en: _term, ...l }) => l) })) }))
    expect(stillChinese({ tracks: shown, projects: en.projects, personas: en.personas })).toEqual([])
    expect(en.tracks.flatMap((t) => t.modules.flatMap((m) => m.lessons.map((l) => [l.id, l.interactive, l.en])))).toEqual(lessons.map((l) => [l.id, l.interactive, l.en]))
    expect(en.projects.map((p) => [p.id, p.interactive])).toEqual(curriculum.projects.map((p) => [p.id, p.interactive]))
    expect(lessons.filter((l) => l.interactiveNote === null).map((l) => l.id)).toEqual(en.tracks.flatMap((t) => t.modules.flatMap((m) => m.lessons.filter((l) => l.interactiveNote === null).map((l) => l.id))))
  })

  it("falls back to the Chinese for anything the overlay lacks", () => {
    const none = { tracks: {}, modules: {}, lessons: {}, projects: {}, personas: {} }
    expect(localizeCurriculum(curriculum, none)).toEqual(curriculum)
  })
})

describe("the interactive lessons in English", () => {
  it("has a title and gist for every registered lesson, and nothing else", () => {
    expect(Object.keys(LESSONS_EN).sort()).toEqual(LESSONS.map((l) => l.id).sort())
    for (const l of LESSONS) {
      expect(LESSONS_EN[l.id].title, l.id).toBeTruthy()
      expect(LESSONS_EN[l.id].gist, l.id).toBeTruthy()
    }
  })

  it("changes only the title and gist", () => {
    const en = localizeLessons(LESSONS)
    expect(stillChinese(en.map((l) => ({ title: l.title, gist: l.gist })))).toEqual([])
    expect(en.map(({ title: _t, gist: _g, ...rest }) => rest)).toEqual(LESSONS.map(({ title: _t, gist: _g, ...rest }) => rest))
  })
})

describe("the teardowns in English", () => {
  it("has every baked model, and nothing that isn't baked", () => {
    expect(Object.keys(TEARDOWNS_EN).sort()).toEqual(Object.values(models).map((m) => m.id).sort())
    for (const m of Object.values(models)) {
      expect(TEARDOWNS_EN[m.id].teaches, `${m.id}: one English point per Chinese one`).toHaveLength(m.teaches.length)
      expect(LEVELS_EN[m.level], `${m.id}: level ${m.level}`).toBeTruthy()
    }
  })

  it("leaves nothing Chinese on the cards, and keeps ids, kind and counts", () => {
    const en = localizeIndex(models)
    expect(stillChinese(Object.values(en).map((m) => ({ title: m.title, subtitle: m.subtitle, level: m.level, teaches: m.teaches })))).toEqual([])
    const fixed = (index: Record<string, ModelIndexEntry>) => Object.entries(index).map(([key, m]) => [key, m.id, m.kind, m.features, m.parts])
    expect(fixed(en)).toEqual(fixed(models))
  })

  it("has the planned cards, each still hidden once its model is baked", () => {
    expect(Object.keys(PLANNED_EN).sort()).toEqual(PLANNED_ZH.map((p) => p.title).sort())
    for (const p of PLANNED_ZH) {
      expect(LEVELS_EN[p.level], `${p.title}: level`).toBeTruthy()
      expect(PLANNED_KINDS_EN[p.kind], `${p.title}: kind`).toBeTruthy()
    }
    // The teardown index hides a planned card whose title a baked model has: the English must agree too.
    for (const m of Object.values(models)) if (PLANNED_EN[m.title]) expect(PLANNED_EN[m.title].title, m.id).toBe(TEARDOWNS_EN[m.id].title)
    const en = localizePlanned(PLANNED_ZH)
    expect(stillChinese(en.map(({ ops: _ops, ...shown }) => shown))).toEqual([])
    expect(en.map((p) => p.ops)).toEqual(PLANNED_ZH.map((p) => p.ops))
  })
})

describe("no English string in the overlays is Chinese", () => {
  it.each([
    ["content/en/curriculum.ts", CURRICULUM_EN],
    ["content/en/lessons.ts", LESSONS_EN],
    ["content/en/teardowns.ts", { TEARDOWNS_EN, LEVELS_EN, PLANNED_KINDS_EN, PLANNED_EN }],
  ])("%s", (_file, table) => {
    // Values only: some tables are keyed by the Chinese they translate.
    expect(stillChinese(table)).toEqual([])
  })
})
