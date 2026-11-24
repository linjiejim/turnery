import { isEn } from "@/lib/i18n"

/**
 * The English text tables (content/en/*), loaded before anything that reads them: on English pages
 * this module waits for them (top-level await), so the modules that build their tables when they
 * load (`EN ? localize(…) : …`) still do it synchronously. Chinese pages never download them; they
 * are about a third of the site's own code in the first download.
 *
 * The build's page titles need both languages in one run and pass the tables in themselves
 * (lib/page-meta.ts, scripts/prerender.mjs).
 */
export const EN = isEn ? await import("./all") : null
