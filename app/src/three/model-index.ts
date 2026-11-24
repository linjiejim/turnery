import { EN } from "@/content/en/ready"

/**
 * The baked teardown models' list (public/models/index.json) and the fetch cache the models' files
 * share. No three.js here: the page title and the home page read the list on every page, and they
 * shouldn't wait for three.js to download first (three/baked.ts loads the models themselves).
 */

export type ModelIndexEntry = {
  kind: "part" | "assembly"
  id: string
  title: string
  subtitle: string
  level: string
  teaches: string[]
  features?: number
  parts?: number
}

export const modelsBase = `${import.meta.env.BASE_URL}models`

const json = new Map<string, Promise<unknown>>()
/** One request per URL for the page's life, shared by everything that reads it. */
export const fetchJson = <T,>(url: string) => {
  if (!json.has(url)) json.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status} ${url}`)))))
  return json.get(url) as Promise<T>
}

/** The model index; on English pages with the catalog text in English (content/en/teardowns.ts). */
export const loadIndex = () => {
  const index = fetchJson<Record<string, ModelIndexEntry>>(`${modelsBase}/index.json`)
  const en = EN
  return en ? index.then((raw) => en.localizeIndex(raw)) : index
}
