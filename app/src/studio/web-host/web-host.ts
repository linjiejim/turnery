// The desktop engine, hosted in the website's workbench: projects are folders in the browser's own
// storage (browser-files.ts), the kernel is the site's Worker (worker-kernel.ts). What the window does
// with files in the app (Finder, save dialogs) the page does here: projects, uploads, downloads.
import { Engine, type KernelHost, type Screen } from "@/desktop/core/engine"
import { baseName, isAssemblyFile, isPartFile, partFileName, stripEnding } from "@/desktop/core/project"
import type { CommandResult, ExportFormat, LookRequest, TurneryBridge } from "@/desktop/core/protocol"
import { ASM_EXT, PARAMS_EXT } from "@/desktop/core/sources"
import { t } from "@/lib/i18n"
import type { KernelClient } from "../client"
import { saveBlob } from "../download"
import { EMPTY_TREE, Tree } from "../dsl"
import { parseTreeJson } from "../import"
import { unzip, zipStore } from "../zip"
import { BrowserFiles, normPath, type FileData, type FileStore } from "./browser-files"
import { WorkerKernelHost } from "./worker-kernel"

export const WEB_HOME = "/web"
export const PROJECTS = `${WEB_HOME}/projects`
/** Exports are written here, read back for the download and removed: never part of a project. */
const EXPORTS = `${WEB_HOME}/.exports`
/** In every project folder: an empty project is still a folder (scans skip dot files). */
const MARKER = ".turnery-project"
const LAST = "turnery:web-last"
/** The single model the workbench kept before projects (use-studio.ts). */
const LEGACY = "ft-studio-v1"

/** The biggest file the page takes in: a board's STEP model is a few MB, a whole enclosure maybe 30. */
const MAX_UPLOAD = 50 * 1024 * 1024

export type WebProject = { root: string; name: string }
export type NewKind = "part" | "assembly"

/** What the page asks the person (dialogs it draws): null when they cancel. */
export type WebAsk = {
  pickFile?: (kind: "part" | "step") => Promise<string | null>
  newPart?: () => Promise<string | null>
  newProject?: () => Promise<string | null>
}

/** A file or folder name the person typed: no slashes, nothing hidden, not too long. */
export function cleanName(name: string) {
  const n = name.trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/^\.+/, "").slice(0, 60).trim()
  return n || null
}

const extOf = (name: string) => {
  const lower = name.toLowerCase()
  for (const e of [".turnery-asm.json", ".arbor-asm.json", ".turnery.json", ".arbor.json", ".params.json", ".notes.json"]) if (lower.endsWith(e)) return e
  const dot = lower.lastIndexOf(".")
  return dot > 0 ? lower.slice(dot) : ""
}

const isStep = (name: string) => /\.(step|stp)$/i.test(name)
const looksLikeStep = (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 200)).includes("ISO-10303-21")

/** The kernel port, and (the Worker's) a way to hear its loading progress. */
type HostKernel = KernelHost & { onChange?(cb: () => void): () => void; dispose?(): void }

export class WebHost {
  readonly files: BrowserFiles
  readonly kernel: HostKernel
  readonly engine: Engine
  private render: ((req: LookRequest) => Promise<string[]>) | null = null
  ask: WebAsk = {}

  /** The page's dialogs that answer the bridge's questions; returns a function that takes them away. */
  setAsk(ask: WebAsk) {
    this.ask = ask
    return () => {
      if (this.ask === ask) this.ask = {}
    }
  }
  /** Hands a file to the browser to save (tests catch it instead). */
  download: (blob: Blob, name: string) => void = saveBlob

  private constructor(files: BrowserFiles, kernel: HostKernel) {
    this.files = files
    this.kernel = kernel
    const screen = (): Screen | null => (this.render ? { look: this.render } : null)
    this.engine = new Engine({ kernel, files, screen, home: WEB_HOME })
    kernel.onChange?.(() => this.engine.kernelChanged())
    // Remember where the person was (the file, and the assembly it was edited in), to come back to it next time.
    this.engine.on((e) => {
      if (e.type !== "doc") return
      const root = this.engine.projectRoot
      if (root && e.doc.path === this.engine.snapshot().active) writeLast({ root, path: e.doc.path, context: e.doc.context?.assembly })
    })
  }

  /** Open the files kept in this browser and start the engine on them (`store`: tests). */
  static async start(client: KernelClient, store?: FileStore): Promise<WebHost> {
    return WebHost.withKernel(new WorkerKernelHost(client), store)
  }

  /** On any kernel port: the kernel in this thread for tests (DirectKernel). */
  static async withKernel(kernel: HostKernel, store?: FileStore): Promise<WebHost> {
    return new WebHost(await BrowserFiles.open(store), kernel)
  }

  /** The page draws `look`'s pictures (and the PNGs `export` makes). */
  onLook(render: (req: LookRequest) => Promise<string[]>) {
    this.render = render
    return () => {
      if (this.render === render) this.render = null
    }
  }

  /** A command from the person in the page. */
  call(command: string, input: Record<string, unknown> = {}, part?: string) {
    return this.engine.run(command, input, { actor: "user", part })
  }

  /** A command from the assistant in the chat, on the part it works on. */
  assistant(command: string, input: unknown, part?: string) {
    return this.engine.run(command, input, { actor: "assistant", part })
  }

  private async must(r: Promise<CommandResult>) {
    const res = await r
    if (!res.ok) throw new Error(res.text.replace(/^✗ /, ""))
    return res
  }

  // ---------------------------------------------------------------- projects

  /** Every project in this browser, by name. */
  async projects(): Promise<WebProject[]> {
    const list = (await this.files.list(PROJECTS)) ?? []
    return list
      .filter((e) => e.dir && !e.name.startsWith("."))
      .map((e) => ({ root: `${PROJECTS}/${e.name}`, name: e.name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  get projectRoot() {
    return this.engine.projectRoot
  }

  /**
   * The first visit: the model the workbench kept before projects goes into 「我的模型」, or an empty
   * part starts one. Later visits open the project (and the file) the person had open last.
   */
  async boot() {
    if (!(await this.projects()).length) {
      const root = await this.makeProject(t("我的模型", "My model"))
      await this.files.write(`${root}/${t("零件", "Part")}.turnery.json`, treeText(legacyTree()))
    }
    const last = readLast()
    const all = await this.projects()
    const project = all.find((p) => p.root === last?.root) ?? all[0]
    await this.openProject(project.root, last?.root === project.root ? last.path : undefined, last?.root === project.root ? last.context : undefined)
  }

  /** Open a project and a file in it: `prefer` if it's there (in the assembly `context`), else its assembly, else its first file. */
  async openProject(root: string, prefer?: string, context?: string) {
    await this.must(this.call("open_project", { path: root }))
    const snap = this.engine.snapshot()
    const files = snap.project?.files ?? []
    const target = prefer && files.some((f) => f.path === prefer) ? prefer : snap.active ? null : (files.find((f) => f.kind === "assembly") ?? files[0])?.path
    const inside = target === prefer && context && files.some((f) => f.path === context) ? context : undefined
    if (target && (target !== snap.active || inside)) await this.must(this.call("open_part", inside ? { path: target, context: inside } : { path: target }))
  }

  /** A name not taken among `taken`: 「零件」, 「零件 2」, … */
  private unique(base: string, taken: (name: string) => boolean) {
    if (!taken(base)) return base
    for (let n = 2; ; n++) if (!taken(`${base} ${n}`)) return `${base} ${n}`
  }

  private async makeProject(name: string) {
    const clean = cleanName(name) ?? t("新项目", "New project")
    const taken = new Set((await this.projects()).map((p) => p.name.toLowerCase()))
    const root = `${PROJECTS}/${this.unique(clean, (n) => taken.has(n.toLowerCase()))}`
    await this.files.write(`${root}/${MARKER}`, "{}\n")
    return root
  }

  /** A new project, opened: one empty part, or (several parts) an assembly with its parameter file. */
  async createProject(name: string, kind: NewKind) {
    const root = await this.makeProject(name)
    if (kind === "assembly") await this.must(this.call("open_project", { path: root, create: true }))
    else {
      const part = `${root}/${baseName(root)}.turnery.json`
      await this.files.write(part, treeText(EMPTY_TREE))
    }
    await this.openProject(root)
    return root
  }

  /** Rename the project's folder (its files keep their names and their references to each other). */
  async renameProject(root: string, name: string) {
    const clean = cleanName(name)
    if (!clean) throw new Error(t("项目要有名字", "The project needs a name"))
    if (clean === baseName(root)) return root
    const to = `${PROJECTS}/${clean}`
    if ((await this.projects()).some((p) => p.name.toLowerCase() === clean.toLowerCase() && p.root !== root)) throw new Error(t(`已经有项目叫「${clean}」了`, `There is already a project called “${clean}”`))
    const open = this.projectRoot === root
    const active = this.engine.snapshot().active
    if (open) await this.call("close_project")
    await this.files.rename(root, to)
    if (open) await this.openProject(to, active ? to + active.slice(root.length) : undefined)
    return to
  }

  /** Delete a project with everything in it (no undo: the page asks first). Opens another one, or starts a new one. */
  async deleteProject(root: string) {
    if (this.projectRoot === root) await this.call("close_project")
    await this.files.remove(root)
    const rest = await this.projects()
    if (rest.length) await this.openProject(rest[0].root)
    else await this.createProject(t("我的模型", "My model"), "part")
  }

  // ------------------------------------------------------------------- files

  /** Where new parts go: beside the project's assembly in parts/, or at the top of a single-part project. */
  private partsDir() {
    const p = this.engine.snapshot().project
    if (!p) return null
    return p.files.some((f) => f.kind === "assembly") ? `${p.root}/parts` : p.root
  }

  /** A file name of the project not yet taken, from what the person typed. */
  async freeName(name: string, kind: NewKind | "params", dir?: string) {
    const folder = dir ?? (kind === "part" ? this.partsDir() : this.projectRoot)
    if (!folder) throw new Error(t("先打开一个项目", "Open a project first"))
    const ext = kind === "assembly" ? ASM_EXT : kind === "params" ? PARAMS_EXT : ".turnery.json"
    const clean = cleanName(stripEnding(name)) ?? (kind === "assembly" ? t("装配", "Assembly") : t("零件", "Part"))
    const stem = this.unique(clean, (n) => this.files.exists(`${folder}/${n}${ext}`))
    return `${folder}/${stem}${ext}`
  }

  /** A new part or assembly in the open project, opened. */
  async newFile(kind: NewKind, name?: string, tree: Tree = EMPTY_TREE) {
    const path = await this.freeName(name ?? (kind === "assembly" ? t("装配", "Assembly") : t("零件", "Part")), kind)
    if (kind === "part" && !partFileName(baseName(path))) throw new Error(t("零件要有名字", "The part needs a name"))
    await this.files.write(path, treeText(tree))
    await this.call("scan_project")
    await this.must(this.call("open_part", { path }))
    return path
  }

  /**
   * Remove a file of the project (an open one is closed first). Resolves to an undo that puts it back
   * and opens it again.
   */
  async deleteFile(path: string) {
    const was = this.engine.snapshot().active
    await this.call("close_part", { path })
    const gone = await this.files.remove(path)
    await this.call("scan_project")
    await this.openSomething()
    return async () => {
      for (const g of gone) await this.files.put(g.path, g.data)
      await this.call("scan_project")
      if (was === path) await this.call("open_part", { path })
    }
  }

  /** Nothing open in the project (its open file was removed): open its assembly or first file. */
  private async openSomething() {
    const snap = this.engine.snapshot()
    if (snap.active) return
    const f = snap.project?.files.find((x) => x.kind === "assembly") ?? snap.project?.files[0]
    if (f) await this.call("open_part", { path: f.path })
  }

  /** STEP files in the project, for 「STEP 参考件」. */
  stepFiles() {
    const root = this.projectRoot
    return root ? this.files.under(root).filter((p) => isStep(p) && !p.split("/").some((s) => s.startsWith("."))) : []
  }

  /**
   * Files from the person's computer: parts, assemblies, shared parameters and STEP models go into
   * the open project (a part is opened); a .zip is a whole project and becomes a new one. Resolves to
   * what to say, and an undo for what went into the open project.
   */
  async importFiles(list: File[]): Promise<{ added: string[]; opened: string | null; project: string | null; undo: (() => Promise<void>) | null }> {
    const zips = list.filter((f) => /\.zip$/i.test(f.name))
    const rest = list.filter((f) => !/\.zip$/i.test(f.name))
    let project: string | null = null
    for (const z of zips) project = await this.importProject(z)
    if (!rest.length) return { added: [], opened: null, project, undo: null }
    const root = this.projectRoot
    if (!root) throw new Error(t("先打开一个项目", "Open a project first"))
    const writes: { path: string; data: FileData }[] = []
    for (const f of rest) {
      if (f.size > MAX_UPLOAD) throw new Error(t(`「${f.name}」太大了（最多 ${MAX_UPLOAD / 1048576} MB）`, `“${f.name}” is too big (at most ${MAX_UPLOAD / 1048576} MB)`))
      const ext = extOf(f.name)
      if (isStep(f.name)) {
        const bytes = new Uint8Array(await f.arrayBuffer())
        if (!looksLikeStep(bytes)) throw new Error(t(`「${f.name}」不是 STEP 文件（开头没有 ISO-10303-21）`, `“${f.name}” isn’t a STEP file (it doesn’t start with ISO-10303-21)`))
        const stem = f.name.replace(/\.(step|stp)$/i, "")
        const name = this.unique(cleanName(stem) ?? "model", (n) => this.files.exists(`${root}/${n}${extOf(f.name)}`) || writes.some((w) => w.path === `${root}/${n}${extOf(f.name)}`))
        writes.push({ path: `${root}/${name}${extOf(f.name)}`, data: bytes })
        continue
      }
      if (ext === ".params.json") {
        const text = await f.text()
        if (!isParamsFile(text)) throw new Error(t(`「${f.name}」不是共享参数文件`, `“${f.name}” isn’t a shared parameter file`))
        writes.push({ path: await this.freeName(f.name.slice(0, -ext.length), "params"), data: text })
        continue
      }
      if (ext.endsWith(".json")) {
        let raw: unknown
        try {
          raw = JSON.parse(await f.text())
        } catch (e) {
          throw new Error(t(`「${f.name}」不是有效的 JSON：${(e as Error).message}`, `“${f.name}” isn’t valid JSON: ${(e as Error).message}`))
        }
        const asm = isAssemblyFile(f.name)
        const stem = f.name.slice(0, -(ext === ".json" ? 5 : ext.length))
        const parsed = asm ? Tree.safeParse(raw) : null
        const tree = asm ? (parsed?.success ? parsed.data : null) : (() => {
          const r = parseTreeJson(raw, stem)
          if (!r.ok) throw new Error(t(`「${f.name}」：${r.message}`, `“${f.name}”: ${r.message}`))
          return r.tree
        })()
        if (!tree) throw new Error(t(`「${f.name}」不是装配文件`, `“${f.name}” isn’t an assembly file`))
        const path = await this.freeName(stem, asm ? "assembly" : "part", root)
        writes.push({ path, data: treeText(tree) })
        continue
      }
      throw new Error(t(`不认识「${f.name}」：能导入零件（.json）、装配、共享参数、STEP（.step / .stp）和项目包（.zip）`, `Can’t import “${f.name}”: parts (.json), assemblies, shared parameters, STEP (.step / .stp) and project archives (.zip) can be imported`))
    }
    for (const w of writes) await this.files.put(w.path, w.data)
    await this.call("scan_project")
    const was = this.engine.snapshot().active
    const tree = writes.find((w) => isPartFile(w.path) || isAssemblyFile(w.path))
    if (tree) await this.must(this.call("open_part", { path: tree.path }))
    const undo = async () => {
      for (const w of writes) {
        await this.call("close_part", { path: w.path })
        await this.files.remove(w.path)
      }
      await this.call("scan_project")
      if (was && this.files.exists(was)) await this.call("open_part", { path: was })
      else await this.openSomething()
    }
    return { added: writes.map((w) => w.path), opened: tree?.path ?? null, project, undo }
  }

  /** A project archive (what 「导出整个项目」 makes, or any zip of a project folder): a new project, opened. */
  private async importProject(file: File) {
    if (file.size > MAX_UPLOAD * 4) throw new Error(t(`「${file.name}」太大了`, `“${file.name}” is too big`))
    let entries: { name: string; data: Uint8Array }[]
    try {
      entries = await unzip(new Uint8Array(await file.arrayBuffer()))
    } catch (e) {
      throw new Error(t(`「${file.name}」打不开：${(e as Error).message}`, `“${file.name}” can’t be opened: ${(e as Error).message}`))
    }
    entries = entries.filter((e) => !e.name.split("/").some((s) => s.startsWith(".") || s === "__MACOSX"))
    // A zip of the folder itself: its one top folder is the project.
    const tops = new Set(entries.map((e) => e.name.split("/")[0]))
    const strip = tops.size === 1 && entries.every((e) => e.name.includes("/")) ? `${[...tops][0]}/` : ""
    const usable = entries.filter((e) => isPartFile(e.name) || isAssemblyFile(e.name) || e.name.endsWith(PARAMS_EXT) || isStep(e.name) || /\.(md|txt)$/i.test(e.name) || e.name.endsWith(".notes.json"))
    if (!usable.some((e) => isPartFile(e.name) || isAssemblyFile(e.name))) throw new Error(t(`「${file.name}」里没有零件或装配文件`, `“${file.name}” has no part or assembly files`))
    const root = await this.makeProject(strip ? strip.slice(0, -1) : file.name.replace(/\.zip$/i, ""))
    for (const e of usable) await this.files.write(normPath(`${root}/${e.name.slice(strip.length)}`), isStep(e.name) ? e.data : new TextDecoder().decode(e.data))
    await this.openProject(root)
    return root
  }

  // ----------------------------------------------------------------- exports

  /** Export the open file as the app's 「导出」 does, then hand it to the browser to save. */
  async exportCurrent(format: ExportFormat | "bom") {
    const doc = this.engine.docState()
    if (!doc) return
    const ext = format === "bom" ? "md" : format
    const name = format === "bom" ? `${doc.name}-${t("零件清单", "parts-list")}` : format === "json" ? `${doc.name}-export` : doc.name
    const path = `${EXPORTS}/${name}.${ext}`
    await this.files.remove(EXPORTS)
    const res = await this.call("export", { path, format }, doc.path)
    if (!res.ok) throw new Error(res.text.replace(/^✗ /, ""))
    // Several parts in an STL: the engine zips them.
    const written = this.files.under(EXPORTS)[0]
    const bytes = written ? await this.files.readBytes(written) : null
    await this.files.remove(EXPORTS)
    if (!bytes || !written) throw new Error(t("没有导出任何东西", "Nothing was exported"))
    this.download(new Blob([bytes as BlobPart], { type: mimeOf(written) }), baseName(written))
  }

  /** The whole open project as a zip: its folder with everything in it. */
  async exportProject() {
    const root = this.projectRoot
    if (!root) return
    await this.files.flush()
    const name = baseName(root)
    const entries: { name: string; data: Uint8Array }[] = []
    for (const p of this.files.under(root)) {
      const rel = p.slice(root.length + 1)
      if (rel.split("/").some((s) => s.startsWith("."))) continue
      const bytes = await this.files.readBytes(p)
      if (bytes) entries.push({ name: `${name}/${rel}`, data: bytes })
    }
    this.download(zipStore(entries), `${name}.zip`)
  }

  /** A picture or line drawing of the view (「导出视图」), downloaded. */
  saveFigure(figure: { format: "png" | "svg"; data: string }) {
    const doc = this.engine.docState()
    const png = figure.format === "png"
    const name = `${doc?.name ?? "Turnery"}-${png ? t("视图", "view") : t("线稿", "drawing")}.${figure.format}`
    const blob = png ? dataUrlBlob(figure.data) : new Blob([figure.data], { type: "image/svg+xml" })
    if (!blob) return null
    this.download(blob, name)
    return name
  }

  /**
   * A ready-made tree (an example, a practice, a shared link, a lesson's model): into the open part,
   * undoable; with an assembly open, into a new part of the project.
   */
  async loadTree(tree: Tree, name: string) {
    const doc = this.engine.docState()
    if (doc && doc.kind === "part" && !doc.context) {
      await this.must(this.call("set_tree", { tree }, doc.path))
      return doc.path
    }
    return this.newFile("part", name, tree)
  }

  dispose() {
    this.engine.dispose()
    this.kernel.dispose?.()
  }
}

const treeText = (tree: Tree) => `${JSON.stringify(tree, null, 2)}\n`

function isParamsFile(text: string) {
  try {
    const raw = JSON.parse(text) as { params?: unknown }
    return Boolean(raw && typeof raw === "object" && raw.params && typeof raw.params === "object")
  } catch {
    return false
  }
}

function mimeOf(path: string) {
  if (/\.zip$/i.test(path)) return "application/zip"
  if (/\.json$/i.test(path)) return "application/json"
  if (/\.(md|py)$/i.test(path)) return "text/plain"
  if (/\.3mf$/i.test(path)) return "model/3mf"
  return "application/octet-stream"
}

function dataUrlBlob(url: string) {
  const m = /^data:([^;]+);base64,(.*)$/.exec(url)
  if (!m) return null
  return new Blob([Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0))], { type: m[1] })
}

/** The tree the workbench kept before projects, if any. */
function legacyTree(): Tree {
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY) ?? "null") as { tree?: unknown } | null
    const parsed = Tree.safeParse(raw?.tree)
    if (parsed.success) return parsed.data
  } catch {
    /* fall through */
  }
  return EMPTY_TREE
}

type Last = { root: string; path?: string; context?: string }

function readLast(): Last | null {
  try {
    const raw = JSON.parse(localStorage.getItem(LAST) ?? "null") as { root?: unknown; path?: unknown; context?: unknown } | null
    const str = (v: unknown) => (typeof v === "string" ? v : undefined)
    return raw && typeof raw.root === "string" ? { root: raw.root, path: str(raw.path), context: str(raw.context) } : null
  } catch {
    return null
  }
}

function writeLast(v: Last) {
  try {
    localStorage.setItem(LAST, JSON.stringify(v))
  } catch {
    /* private mode */
  }
}

/** The engine as the desktop window's components reach it (`turnery`): the page's own bridge. */
export function webBridge(host: WebHost): TurneryBridge {
  const engine = host.engine
  const none = async () => null
  return {
    state: async () => ({ snapshot: engine.snapshot(), doc: engine.docState(), pick: engine.pickRequest() }),
    subscribe: (cb) => engine.on(cb),
    call: (command, input, part) => host.call(command, input, part),
    kernel: (path, call) => engine.kernelCall(path, call),
    onLook: (render) => host.onLook(render),
    saveFigure: async (figure) => host.saveFigure(figure),
    answerPick: async (id, answer) => engine.answerPick(id, answer),
    openPart: () => host.ask.newPart?.() ?? none(),
    newPart: () => host.ask.newPart?.() ?? none(),
    newProject: () => host.ask.newProject?.() ?? none(),
    openProject: () => host.ask.newProject?.() ?? none(),
    openProjectAt: async (root) => {
      await host.openProject(root)
      return true
    },
    recentProjects: () => host.projects(),
    openExample: async () => false,
    // The site's chat has its own model settings and transport (use-studio-chat.ts).
    models: async () => ({ current: null, presets: [], keysEncrypted: false }),
    saveModel: async () => ({ current: null, presets: [], keysEncrypted: false }),
    assistantSend: async () => {},
    assistantStop: async () => {},
    setLanguage: async () => {},
    onAssistant: () => () => {},
    chats: async () => [],
    chatRead: async () => null,
    chatSave: async () => null,
    chatRename: async () => {},
    chatDelete: async () => {},
    pickFile: (kind) => host.ask.pickFile?.(kind) ?? none(),
    reveal: async () => {},
    exportPart: (format) => host.exportCurrent(format),
    agentSetup: async () => ({ bin: "", claude: "", codex: "", json: "" }),
    copy: (text) => navigator.clipboard.writeText(text),
    onMenu: () => () => {},
    update: async () => ({ phase: "idle" }),
    onUpdate: () => () => {},
    onNotice: () => () => {},
    restartToUpdate: async () => {},
    platform: "web",
  }
}

