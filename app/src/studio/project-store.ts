// Browser virtual multi-file project store (IndexedDB with memory fallback).
// Implements the platform-neutral `Files` port expected by `desktop/core/sources.ts`
// so multi-part assemblies, shared parameter files and STEP imports work identically
// in the browser workbench and in community project previews.
import type { Files } from "../desktop/core/engine"
import { ASM_EXT, PARAMS_EXT, effectiveTree, gather, isAssembly, loadShared, type Gathered, type Shared } from "../desktop/core/sources"
import { PART_EXT } from "../desktop/core/protocol"
import { EMPTY_TREE, Tree } from "./dsl"
import { checkTree } from "./limits"
import { unzipStore, zipStore } from "./zip"
import {
  encodeBase64,
  decodeBase64,
  isAssemblyPath,
  isParamsPath,
  isPartPath,
  isStepPath,
  normalizeProjectPath,
  type BundleFileInput,
  type OpenLicense,
  type ProjectCategory,
  type TurneryManifest,
  slugify,
} from "../hub/package"

export { ASM_EXT, PARAMS_EXT, PART_EXT }

export type VirtualFileData = {
  encoding: "utf8" | "base64"
  content: string
  updatedAt: number
}

export type WebProject = {
  id: string
  name: string
  /** Relative path of the currently active file (part or assembly). */
  activeFile: string
  /** Map from normalized relative path to file payload. */
  files: Record<string, VirtualFileData>
  /** Optional link to a published community project for one-click continuous updates. */
  communityRef?: { handle: string; slug: string; version: string }
  /** Optional provenance when remixed from a community release. */
  forkedFrom?: { handle: string; slug: string; version: string }
  updatedAt: number
}

const DB_NAME = "turnery-web-projects-v1"
const STORE_NAME = "projects"
const ACTIVE_KEY = "turnery-web-active-project"
const LEGACY_TREE_KEY = "ft-studio-v1"

const enc = new TextEncoder()
const dec = new TextDecoder("utf-8", { fatal: false })

export function fileToBytes(f: VirtualFileData): Uint8Array {
  return f.encoding === "base64" ? decodeBase64(f.content) : enc.encode(f.content)
}

export function fileToText(f: VirtualFileData): string {
  return f.encoding === "utf8" ? f.content : dec.decode(decodeBase64(f.content))
}

export function utf8File(content: string): VirtualFileData {
  return { encoding: "utf8", content, updatedAt: Date.now() }
}

export function binaryFile(bytes: Uint8Array): VirtualFileData {
  return { encoding: "base64", content: encodeBase64(bytes), updatedAt: Date.now() }
}

export function createDefaultProject(initialTree: Tree = EMPTY_TREE, name = "My Project"): WebProject {
  const now = Date.now()
  const entry = `main${PART_EXT}`
  return {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    activeFile: entry,
    files: {
      [entry]: utf8File(`${JSON.stringify(initialTree, null, 2)}\n`),
    },
    updatedAt: now,
  }
}

export function createAssemblyProject(name: string): WebProject {
  const now = Date.now()
  const stem = slugify(name)
  const asm = `${stem}${ASM_EXT}`
  const params = `${stem}${PARAMS_EXT}`
  const part = `parts/base${PART_EXT}`
  const baseTree: Tree = {
    uses: `../${params}`,
    params: {},
    features: [
      { id: "sk", op: "sketch", name: "底面草图", on: { plane: "XY" }, shapes: [{ type: "rect", w: "L", h: "W", r: 4 }] },
      { id: "body", op: "extrude", name: "主体", sketch: "sk", distance: "H" },
    ],
  }
  const asmTree: Tree = {
    uses: params,
    params: {},
    features: [{ id: "base", op: "component", name: "底座", file: part }],
  }
  return {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name,
    activeFile: asm,
    files: {
      [asm]: utf8File(`${JSON.stringify(asmTree, null, 2)}\n`),
      [params]: utf8File(`${JSON.stringify({ params: { L: 60, W: 40, H: 12 }, paramNotes: { L: "总长", W: "总宽", H: "高度" } }, null, 2)}\n`),
      [part]: utf8File(`${JSON.stringify(baseTree, null, 2)}\n`),
    },
    updatedAt: now,
  }
}

/**
 * Adapter that exposes a `WebProject` through the exact `Files` interface used by
 * `desktop/core/sources.ts` (`gather`, `loadShared`, `effectiveTree`).
 */
export function toEngineFiles(project: WebProject): Files {
  const norm = (raw: string) => {
    const cleaned = raw.replace(/\\/g, "/")
    const out: string[] = []
    for (const seg of cleaned.split("/")) {
      if (!seg || seg === ".") continue
      if (seg === "..") out.pop()
      else out.push(seg)
    }
    return out.join("/")
  }
  const get = (raw: string) => project.files[norm(raw)]
  return {
    read: async (raw) => {
      const f = get(raw)
      return f ? fileToText(f) : null
    },
    readBytes: async (raw) => {
      const f = get(raw)
      return f ? fileToBytes(f) : null
    },
    stat: async (raw) => {
      const f = get(raw)
      if (!f) return null
      return { size: fileToBytes(f).byteLength, mtimeMs: f.updatedAt }
    },
    list: async (raw) => {
      const dir = norm(raw)
      const prefix = dir ? `${dir}/` : ""
      const out = new Map<string, boolean>()
      for (const k of Object.keys(project.files)) {
        if (!k.startsWith(prefix)) continue
        const rest = k.slice(prefix.length).split("/")
        out.set(rest[0], rest.length > 1 || out.get(rest[0]) === true)
      }
      return out.size ? [...out].map(([name, isDir]) => ({ name, dir: isDir })) : null
    },
    watch: () => () => {},
    write: async (raw, data) => {
      const p = norm(raw)
      project.files[p] = typeof data === "string" ? utf8File(data) : binaryFile(data)
      project.updatedAt = Date.now()
    },
    canonical: (raw) => `/${norm(raw)}`,
  }
}

export type ResolvedActive = {
  tree: Tree
  effective: Tree
  shared: Shared | null
  gathered: Gathered
  isAssembly: boolean
}

/** Parse and resolve the active file of a project (including `uses`, `import` STEP bytes, and assembly `component` trees). */
export async function resolveProjectFile(project: WebProject, filePath = project.activeFile): Promise<ResolvedActive> {
  const f = project.files[filePath]
  let tree: Tree = EMPTY_TREE
  if (f) {
    try {
      const parsed = Tree.safeParse(JSON.parse(fileToText(f)))
      if (parsed.success) tree = parsed.data
    } catch {
      tree = EMPTY_TREE
    }
  }
  const files = toEngineFiles(project)
  const abs = `/${filePath}`
  const shared = tree.uses ? await loadShared(files, abs, tree.uses) : null
  const eff = effectiveTree(tree, shared)
  const gathered = await gather(files, abs, eff)
  return {
    tree,
    effective: eff,
    shared,
    gathered,
    isAssembly: isAssembly(filePath),
  }
}

/** Convert a WebProject into `BundleFileInput[]` ready for publishing to Community Hub. */
export function projectToBundleFiles(project: WebProject): BundleFileInput[] {
  const out: BundleFileInput[] = []
  for (const [p, f] of Object.entries(project.files)) {
    const clean = normalizeProjectPath(p)
    if (!clean) continue
    out.push({ path: clean, encoding: f.encoding, content: f.content })
  }
  return out
}

/** Create a WebProject from a downloaded Community Hub bundle. */
export function projectFromBundle(input: {
  name: string
  entry: string
  files: BundleFileInput[]
  communityRef?: { handle: string; slug: string; version: string }
  forkedFrom?: { handle: string; slug: string; version: string }
}): WebProject {
  const now = Date.now()
  const files: Record<string, VirtualFileData> = {}
  for (const f of input.files) {
    const clean = normalizeProjectPath(f.path)
    if (!clean) continue
    files[clean] = { encoding: f.encoding, content: f.content, updatedAt: now }
  }
  const activeFile = files[input.entry] ? input.entry : (Object.keys(files).find((k) => isAssemblyPath(k) || isPartPath(k)) ?? `main${PART_EXT}`)
  if (!files[activeFile]) files[activeFile] = utf8File(`${JSON.stringify(EMPTY_TREE, null, 2)}\n`)
  return {
    id: `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: input.name,
    activeFile,
    files,
    communityRef: input.communityRef,
    forkedFrom: input.forkedFrom,
    updatedAt: now,
  }
}

/** Package a project (with an up-to-date `turnery.json` manifest) into a downloadable ZIP archive. */
export function exportProjectZip(
  project: WebProject,
  meta: { license?: OpenLicense; category?: ProjectCategory; summary?: string; version?: string } = {},
): Blob {
  const entries: { name: string; data: Uint8Array }[] = []
  let hasManifest = false
  for (const [p, f] of Object.entries(project.files)) {
    if (p === "turnery.json") hasManifest = true
    entries.push({ name: p, data: fileToBytes(f) })
  }
  if (!hasManifest) {
    const manifest: TurneryManifest = {
      schema: 1,
      name: slugify(project.name),
      title: project.name,
      ...(meta.summary ? { summary: meta.summary } : {}),
      version: meta.version ?? "1.0.0",
      license: meta.license ?? "CERN-OHL-P-2.0",
      entry: project.activeFile,
      category: meta.category ?? "other",
      tags: [],
    }
    entries.unshift({ name: "turnery.json", data: enc.encode(`${JSON.stringify(manifest, null, 2)}\n`) })
  }
  return zipStore(entries)
}

export type ImportedProjectFiles =
  | { ok: true; added: string[]; activeFile?: string; projectName?: string }
  | { ok: false; message: string }

/**
 * Import a ZIP bundle, STEP file, shared params JSON, or feature tree JSON into an existing project.
 * Returns the list of added/updated relative paths.
 */
export async function importIntoProject(project: WebProject, file: File): Promise<ImportedProjectFiles> {
  const lower = file.name.toLowerCase()
  if (lower.endsWith(".zip")) {
    let entries: { name: string; data: Uint8Array }[]
    try {
      entries = await unzipStore(new Uint8Array(await file.arrayBuffer()))
    } catch (e) {
      return { ok: false, message: (e as Error).message }
    }
    if (!entries.length) return { ok: false, message: "ZIP 压缩包是空的" }
    // Strip a common single top-level directory (e.g. `my-project/...`).
    const firstSegs = new Set(entries.map((e) => e.name.split("/")[0]))
    const stripPrefix = firstSegs.size === 1 && entries.every((e) => e.name.includes("/")) ? `${[...firstSegs][0]}/` : ""

    const added: string[] = []
    let manifestEntry: string | undefined
    let manifestTitle: string | undefined
    let firstAsm: string | undefined
    let firstPart: string | undefined

    for (const e of entries) {
      const rawPath = stripPrefix && e.name.startsWith(stripPrefix) ? e.name.slice(stripPrefix.length) : e.name
      const clean = normalizeProjectPath(rawPath)
      if (!clean) continue
      if (isStepPath(clean)) {
        project.files[clean] = binaryFile(e.data)
        added.push(clean)
      } else if (clean === "turnery.json") {
        const text = dec.decode(e.data)
        project.files[clean] = utf8File(text)
        added.push(clean)
        try {
          const m = JSON.parse(text) as { entry?: string; title?: string | { zh?: string; en?: string } }
          if (typeof m.entry === "string") manifestEntry = normalizeProjectPath(m.entry) ?? undefined
          if (typeof m.title === "string") manifestTitle = m.title
          else if (m.title && typeof m.title === "object") manifestTitle = m.title.zh || m.title.en
        } catch {
          /* ignore invalid manifest */
        }
      } else if (isPartPath(clean) || isAssemblyPath(clean)) {
        const text = dec.decode(e.data)
        try {
          const checked = checkTree(JSON.parse(text))
          if (!checked.ok) return { ok: false, message: `${clean}: ${checked.message}` }
          project.files[clean] = utf8File(text)
          added.push(clean)
          if (isAssemblyPath(clean) && !firstAsm) firstAsm = clean
          if (isPartPath(clean) && !firstPart) firstPart = clean
        } catch (err) {
          return { ok: false, message: `${clean}: ${(err as Error).message}` }
        }
      } else if (isParamsPath(clean) || /\.md$/i.test(clean)) {
        project.files[clean] = utf8File(dec.decode(e.data))
        added.push(clean)
      }
    }
    if (!added.length) return { ok: false, message: "压缩包里没有找到 Turnery 模型或 STEP 文件" }
    project.updatedAt = Date.now()
    const activeFile = (manifestEntry && project.files[manifestEntry] ? manifestEntry : undefined) ?? firstAsm ?? firstPart
    if (activeFile) project.activeFile = activeFile
    return { ok: true, added, activeFile, projectName: manifestTitle }
  }

  if (isStepPath(lower)) {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength > 10 * 1024 * 1024) return { ok: false, message: "STEP 文件超过 10 MB 上限" }
    const head = dec.decode(bytes.subarray(0, 256))
    if (!head.includes("ISO-10303-21")) return { ok: false, message: "文件缺少标准 ISO-10303-21 STEP 文件头" }
    const clean = normalizeProjectPath(`assets/${file.name}`) ?? `assets/imported.step`
    project.files[clean] = binaryFile(bytes)
    project.updatedAt = Date.now()
    return { ok: true, added: [clean] }
  }

  if (lower.endsWith(".json")) {
    const text = await file.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return { ok: false, message: `不是合法 JSON：${(e as Error).message}` }
    }
    if (isParamsPath(lower)) {
      const clean = normalizeProjectPath(file.name) ?? `shared${PARAMS_EXT}`
      project.files[clean] = utf8File(text)
      project.updatedAt = Date.now()
      return { ok: true, added: [clean] }
    }
    const wrapped = parsed && typeof parsed === "object" && !Array.isArray(parsed) && !("features" in parsed) && "tree" in parsed
    const rawTree = wrapped ? (parsed as { tree: unknown }).tree : parsed
    const checked = checkTree(rawTree)
    if (!checked.ok) return { ok: false, message: checked.message }
    const normalized = isAssemblyPath(lower) || isPartPath(lower)
      ? normalizeProjectPath(file.name) ?? `imported${PART_EXT}`
      : `${file.name.replace(/\.json$/i, "")}${PART_EXT}`
    const clean = normalizeProjectPath(normalized) ?? `imported${PART_EXT}`
    project.files[clean] = utf8File(`${JSON.stringify(checked.tree, null, 2)}\n`)
    project.activeFile = clean
    project.updatedAt = Date.now()
    return { ok: true, added: [clean], activeFile: clean }
  }

  return { ok: false, message: "仅支持导入 .turnery.json、.turnery-asm.json、.params.json、.step/.stp 或 .zip 项目包" }
}

// ------------------------------------------------------------------ IndexedDB persistence

const memoryFallback = new Map<string, WebProject>()

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function listWebProjects(): Promise<WebProject[]> {
  const db = await openDb()
  if (!db) return [...memoryFallback.values()].sort((a, b) => b.updatedAt - a.updatedAt)
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, "readonly")
    const req = tx.objectStore(STORE_NAME).getAll()
    req.onsuccess = () => resolve(((req.result as WebProject[]) ?? []).sort((a, b) => b.updatedAt - a.updatedAt))
    req.onerror = () => resolve([])
  })
}

export async function saveWebProject(project: WebProject): Promise<void> {
  const copy: WebProject = { ...project, updatedAt: Date.now() }
  memoryFallback.set(copy.id, copy)
  try {
    localStorage.setItem(ACTIVE_KEY, copy.id)
  } catch {
    /* ignore */
  }
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).put(copy)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

export async function deleteWebProject(id: string): Promise<void> {
  memoryFallback.delete(id)
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE_NAME, "readwrite")
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
  })
}

/** Load the active browser project (migrating any legacy single-part `ft-studio-v1` tree on first run). */
export async function loadInitialWebProject(): Promise<{ projects: WebProject[]; active: WebProject }> {
  const existing = await listWebProjects()
  if (existing.length) {
    let activeId: string | null = null
    try {
      activeId = localStorage.getItem(ACTIVE_KEY)
    } catch {
      activeId = null
    }
    const active = existing.find((p) => p.id === activeId) ?? existing[0]
    return { projects: existing, active }
  }
  let initialTree: Tree = EMPTY_TREE
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_TREE_KEY) ?? "null")
    const parsed = Tree.safeParse(raw?.tree)
    if (parsed.success) initialTree = parsed.data
  } catch {
    /* ignore */
  }
  const created = createDefaultProject(initialTree)
  await saveWebProject(created)
  return { projects: [created], active: created }
}
