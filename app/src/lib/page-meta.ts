import { LESSONS } from "@/content/lessons"
import { CARDS } from "@/content/cards"
import curriculum from "@/content/curriculum.json"
import { CURRICULUM_EN } from "@/content/en/curriculum"
import { LESSONS_EN } from "@/content/en/lessons"
import type { ModelIndexEntry } from "@/three/baked"
import { locale, type Locale } from "@/lib/i18n"

/**
 * Title and description of every page. The browser uses the titles
 * (document-title.ts); the post-build script (scripts/prerender.mjs) writes
 * both into a static HTML copy per route, for crawlers and link previews
 * that never run JavaScript. Keep this module free of heavy imports: it is
 * loaded by Node at build time.
 *
 * Every function takes the language (default: the page's). The fixed pages exist in both, and the
 * build writes an English copy of each under /en. Lessons, cards and teardowns have English titles
 * (content/en/*) but their text is still Chinese, so only their Chinese pages are prerendered.
 */
export type PageMeta = {
  /** Page name; null on the home page, which shows the site name alone. */
  title: string | null
  /** One or two plain sentences, about 80 characters at most (link previews cut the rest). */
  description: string
}

export const SITE_NAME = "Turnery"
const TAGLINE: Record<Locale, string> = { zh: "工业建模互动课", en: "Parametric CAD your agent builds, and a course on how it's made" }
export const SITE_TAGLINE = TAGLINE[locale]

/** Pages with a fixed path, in sitemap order. */
const STATIC_ZH: Record<string, PageMeta> = {
  "/": {
    title: null,
    description: "中文、讲概念、不绑定软件的 3D 工业建模互动课。每个概念配一个能亲手操作的 3D 场景，真实零件按特征树一步步重建。",
  },
  "/learn": {
    title: "学习路径",
    description: "一条公共地基加五条主轨：坐标与视图、参数化零件、装配、工程图、面向制造的设计、曲面。按人群给入口，学完有小测和到期复习。",
  },
  "/teardown": {
    title: "案例拆解",
    description: "真实零件按特征树一步步重建：几何由 build123d 和 OpenCascade 内核算出，每个面都标明是哪一步生成或修改的。",
  },
  "/atlas": {
    title: "工具图鉴",
    description: "每个建模命令一张卡：它做什么、要什么输入、常见的坑，以及在 SOLIDWORKS、Fusion、Onshape 等软件里分别叫什么。",
  },
  "/glossary": {
    title: "术语表",
    description: "同一个建模命令在 8 个软件里的叫法对照，以及基准、设计意图、拓扑命名、自由度等概念卡。",
  },
  "/studio": {
    title: "工作台",
    description: "在浏览器里亲手建参数化零件：表单式的草图和特征，改一个数就实时重建，可以回滚、回放、调整顺序，课后练习也在这里做。几何由 OpenCascade 算出，可导出 STEP、STL、3MF 和 build123d 代码。",
  },
  "/desktop": {
    title: "桌面版",
    description: "Turnery 桌面版：让本机的 coding agent（Claude Code、Codex）通过 MCP 建参数化零件，项目和装配、导入 STEP、自动核对尺寸和间隙。macOS。",
  },
}

const STATIC_EN: Record<string, PageMeta> = {
  "/": {
    title: null,
    description: "Parametric CAD that your coding agent builds and you can read, check and change, plus a hands-on course on how parts are modeled: interactive 3D lessons and real parts rebuilt feature by feature.",
  },
  "/learn": {
    title: "Learning path",
    description: "A shared foundation and five tracks: coordinates and views, parametric parts, assemblies, drawings, design for manufacturing, surfaces. Quizzes and spaced review along the way.",
  },
  "/teardown": {
    title: "Teardowns",
    description: "Real parts rebuilt feature by feature. The geometry comes from build123d and the OpenCascade kernel; every face says which step made or changed it.",
  },
  "/atlas": {
    title: "Command atlas",
    description: "One card per modeling command: what it does, what it needs, the usual pitfalls, and what it is called in SOLIDWORKS, Fusion, Onshape and others.",
  },
  "/glossary": {
    title: "Glossary",
    description: "What the same modeling command is called in 8 CAD packages, and concept cards for datums, design intent, topological naming and degrees of freedom.",
  },
  "/studio": {
    title: "Workbench",
    description: "Build parametric parts by hand in your browser: form-style sketches and features that rebuild as you type, a feature tree you can roll back, replay and reorder, and the lessons’ practices. OpenCascade runs in your browser; export STEP, STL, 3MF and build123d code.",
  },
  "/desktop": {
    title: "Desktop app",
    description: "Turnery for macOS: Claude Code, Codex or any MCP agent builds parametric parts and assemblies, imports STEP and checks dimensions and clearances on every rebuild.",
  },
}

/** The fixed pages in a language. */
export const staticPages = (lang: Locale = locale) => (lang === "en" ? STATIC_EN : STATIC_ZH)

/** The fixed pages in the page's language. */
export const STATIC_PAGES = staticPages()

/** A registered lesson's page, or undefined for an unknown id. */
export function lessonPageMeta(id: string, lang: Locale = locale): PageMeta | undefined {
  const l = LESSONS.find((x) => x.id === id)
  if (!l) return undefined
  const en = LESSONS_EN[l.id]
  return lang === "en"
    ? { title: en?.title ?? l.title, description: `Interactive lesson, about ${l.minutes} min (in Chinese). ${en?.gist ?? l.gist}` }
    : { title: l.title, description: `互动课，约 ${l.minutes} 分钟。${l.gist}` }
}

/** A 图文卡 page: title and goal come from the curriculum. */
export function cardPageMeta(code: string, lang: Locale = locale): PageMeta | undefined {
  if (!CARDS.some((c) => c.code === code)) return undefined
  for (const t of curriculum.tracks)
    for (const m of t.modules)
      for (const l of m.lessons) {
        if (l.id !== code) continue
        const en = CURRICULUM_EN.lessons[l.id]
        return lang === "en" ? { title: `${en?.title ?? l.title} · Card`, description: `Card ${l.id} (in Chinese): ${en?.goal ?? l.goal}.` } : { title: `${l.title} · 图文卡`, description: `图文卡 ${l.id}：${l.goal}。` }
      }
  return undefined
}

/** Every card path that gets its own HTML copy. */
export const cardPaths = () => CARDS.map((c) => `/card/${c.code}`)

export function teardownPageMeta(m: Pick<ModelIndexEntry, "kind" | "title" | "subtitle" | "teaches">, lang: Locale = locale): PageMeta {
  if (lang === "en")
    return {
      title: `${m.title} · Teardown`,
      description: `${m.title}, ${m.kind === "assembly" ? "an assembly taken apart" : "rebuilt feature by feature"} (in Chinese): ${m.subtitle}.`,
    }
  const what = m.kind === "assembly" ? "装配拆解" : "按特征树重建"
  return {
    title: `${m.title} · 案例拆解`,
    description: `${m.title}${what}：${m.subtitle}。${m.teaches.length ? `要点：${m.teaches.slice(0, 3).join("、")}。` : ""}`,
  }
}

/** What goes in <title>. */
export const documentTitle = (title: string | null | undefined, lang: Locale = locale) => (title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} · ${TAGLINE[lang]}`)

/** Every lesson path that gets its own HTML copy. */
export const lessonPaths = () => LESSONS.map((l) => `/lesson/${l.id}`)
