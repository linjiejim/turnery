import { LESSONS } from "@/content/lessons"
import { CARDS } from "@/content/cards"
import { availableFor, TEARDOWN_CODES, type Track } from "@/content/curriculum"
import { t } from "@/lib/i18n"
import type { ModelIndexEntry } from "@/three/baked"

/**
 * What the learning path lists, without curriculum codes on screen (components/learn-path.tsx). The
 * codes stay in addresses and as anchors (/learn#1.2.5), where links from the atlas and cards land.
 */

/** 「基准面：一切几何的参照」 → 「基准面」: the name, without the subtitle. */
export const shortTitle = (title: string) => title.split(/[：:]/)[0].trim()

export const lessonById = (id: string) => LESSONS.find((l) => l.id === id)

/** A lesson counts as done once every curriculum entry it covers is. */
export const lessonDone = (codes: string[], done: string[]) => codes.length > 0 && codes.every((c) => done.includes(c))

export type TopicItem = { key: string; anchor: string; to: string; kind: "lesson" | "card" | "teardown"; title: string; meta: string; done: boolean }

/**
 * What a topic has to open today: its interactive lessons, cards and teardowns, each once (a lesson
 * covering three curriculum entries is one tile), in curriculum order. And what is still planned.
 */
export function topicItems(track: Track, models: ModelIndexEntry[], done: string[]): { items: TopicItem[]; planned: { id: string; title: string }[] } {
  const items: TopicItem[] = []
  const planned: { id: string; title: string }[] = []
  const seen = new Set<string>()
  for (const mod of track.modules)
    for (const entry of mod.lessons) {
      const avail = availableFor(entry.id)
      if (!avail) {
        planned.push({ id: entry.id, title: entry.title })
        continue
      }
      if (seen.has(avail.to)) continue
      seen.add(avail.to)
      if (avail.kind === "lesson") {
        const l = LESSONS.find((x) => x.codes.includes(entry.id))!
        items.push({ key: avail.to, anchor: entry.id, to: avail.to, kind: "lesson", title: l.title, meta: t(`互动课 · ${l.minutes} 分钟`, `Lesson · ${l.minutes} min`), done: lessonDone(l.codes, done) })
      } else if (avail.kind === "card") {
        items.push({ key: avail.to, anchor: entry.id, to: avail.to, kind: "card", title: entry.title, meta: t("图文卡 · 3–5 分钟", "Card · 3–5 min"), done: done.includes(entry.id) })
      } else {
        const id = TEARDOWN_CODES[entry.id]
        const m = models.find((x) => x.id === id)
        items.push({ key: avail.to, anchor: entry.id, to: avail.to, kind: "teardown", title: m?.title ?? entry.title, meta: t("案例拆解", "Teardown"), done: done.includes(id) })
      }
    }
  return { items, planned }
}

/** How many of everything there is to open. */
export const COUNTS = { lessons: LESSONS.length, cards: CARDS.length }
