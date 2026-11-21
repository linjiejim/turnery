import * as React from "react"
import { Link, useLocation, useNavigate } from "react-router"
import {
  ArrowLeft,
  CircleAlert,
  Download,
  Ellipsis,
  Globe,
  PanelLeft,
  Share2,
  Undo2,
  UploadCloud,
  X,
} from "lucide-react"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer"
import { practiceById, type Practice } from "@/content/practice"
import { PracticeCard } from "@/studio/ui/practice-card"
import { Button, IconButton } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input, Textarea } from "@/components/ui/input"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { analyzeModel, bomToCsv, bomToMarkdown } from "@/studio/analysis"
import { ChatPanel } from "@/studio/ui/chat-panel"
import { AnalysisPanel } from "@/studio/ui/analysis-panel"
import { ProjectSidebar } from "@/studio/ui/project-sidebar"
import { buildCode } from "@/studio/codegen"
import { saveBlob } from "@/studio/download"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import { checkTree } from "@/studio/limits"
import {
  ASM_EXT,
  createAssemblyProject,
  createDefaultProject,
  exportProjectZip,
  importIntoProject,
  listWebProjects,
  loadInitialWebProject,
  PARAMS_EXT,
  PART_EXT,
  projectFromBundle,
  resolveProjectFile,
  saveWebProject,
  utf8File,
  type WebProject,
} from "@/studio/project-store"
import { PANEL_DEFAULT, PANEL_MIN, usePanelWidth } from "@/studio/ui/panel-width"
import { ShareDialog } from "@/studio/ui/share-dialog"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import type { Hover } from "@/studio/scene"
import { StudioViewport } from "@/studio/ui/studio-viewport"
import { ConnectorOverlay } from "@/studio/ui/connector-overlay"
import { DesktopBanner } from "@/studio/ui/desktop-banner"
import { NO_PARTS_VIEW, type PartsView } from "@/studio/scene"
import { DrawingSheet } from "@/studio/ui/drawing-sheet"
import { useReselect } from "@/studio/use-reselect"
import { TreeOverlay } from "@/studio/ui/tree-overlay"
import { useAnnotations } from "@/studio/use-annotations"
import { useStudio } from "@/studio/use-studio"
import { KEY_STORE, useStudioChat } from "@/studio/use-studio-chat"
import { PublishDialog } from "@/hub/ui/publish-dialog"
import {
  isAssemblyPath,
  isParamsPath,
  isPartPath,
  isStepPath,
  type BundleFileInput,
} from "@/hub/package"
import { locale, t } from "@/lib/i18n"

type Status = { model: string; via?: "deepseek" | "openrouter" | "mock"; hostedKey: boolean; budgetExhausted: boolean }

/** What 「复制到我的工作台」 / 「在工作台打开并二次创作」 hands over via router state. */
export type Incoming = {
  tree: Tree
  title: string
  bundle?: {
    name: string
    entry: string
    files: BundleFileInput[]
    forkedFrom?: { handle: string; slug: string; version: string }
    communityRef?: { handle: string; slug: string; version: string }
  }
}

export function StudioPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const studio = useStudio()
  const chat = useStudioChat(studio)
  const annotations = useAnnotations(studio)
  // Pins of a sent message stay on the model until the reply is done.
  const { clearSent } = annotations
  React.useEffect(() => {
    if (!chat.busy) clearSent()
  }, [chat.busy, clearSent])
  const [hover, setHover] = React.useState<Hover | null>(null)
  const [stepSlot, setStepSlot] = React.useState<HTMLDivElement | null>(null)
  const reselect = useReselect(studio)
  // A split body: how far its parts are pulled apart, and which are hidden.
  const [partsView, setPartsView] = React.useState<PartsView>(NO_PARTS_VIEW)
  // A message started from a feature card brings the conversation forward.
  const [tab, setTab] = React.useState("chat")
  /** 「工程图」: the drawing sheet over the 3D view; the side panel stays, so parameters can be changed while looking at it. */
  const [sheet, setSheet] = React.useState(false)
  const [seenPrefill, setSeenPrefill] = React.useState(annotations.prefill)
  if (seenPrefill !== annotations.prefill) {
    setSeenPrefill(annotations.prefill)
    if (annotations.prefill) setTab("chat")
  }
  const [confirmNew, setConfirmNew] = React.useState(false)
  const [sharing, setSharing] = React.useState(false)
  const [publishing, setPublishing] = React.useState(false)
  const [codeOpen, setCodeOpen] = React.useState(false)

  // Multi-file browser project workspace (IndexedDB persisted)
  const [projects, setProjects] = React.useState<WebProject[]>([])
  const [project, setProject] = React.useState<WebProject>(() => createDefaultProject(studio.tree))
  const projectRef = React.useRef(project)
  React.useEffect(() => {
    projectRef.current = project
  }, [project])
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [editingParamsPath, setEditingParamsPath] = React.useState<string | null>(null)
  const projectHydratedRef = React.useRef(false)
  const lastSyncedTreeRef = React.useRef<Tree>(studio.tree)

  /** A practice from a lesson (/studio?practice=<id>): its card over the chat, its checks pinned in the tree. */
  const [arriving] = React.useState(() => new URL(window.location.href).searchParams.get("practice"))
  const [practice, setPractice] = React.useState<Practice | null>(() => practiceById(arriving ?? localStorage.getItem(PRACTICE_STORE) ?? "") ?? null)
  const { pinChecks } = studio
  React.useEffect(() => pinChecks(practice?.checks ?? null), [practice, pinChecks])
  const exitPractice = React.useCallback(() => {
    setPractice(null)
    localStorage.removeItem(PRACTICE_STORE)
  }, [])
  const [keyOpen, setKeyOpen] = React.useState(false)
  const [status, setStatus] = React.useState<Status | null>(null)
  const ready = studio.kernel.phase === "ready"
  const panel = usePanelWidth()

  React.useEffect(() => {
    fetch("/api/studio/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStatus(s))
      .catch(() => setStatus(null))
  }, [])

  const refreshProjectsList = React.useCallback(async () => {
    const list = await listWebProjects()
    setProjects(list)
  }, [])

  const applyProjectFileToKernel = React.useCallback(
    async (proj: WebProject, filePath: string) => {
      const resolved = await resolveProjectFile(proj, filePath)
      lastSyncedTreeRef.current = resolved.effective
      await studio.setSources(
        { assets: resolved.gathered.assets, components: resolved.gathered.components, context: null },
        resolved.effective,
      )
      return resolved
    },
    [studio],
  )

  // Hydrate browser projects from IndexedDB on mount.
  const incoming = (location.state as { incoming?: Incoming } | null)?.incoming
  React.useEffect(() => {
    const ac = new AbortController()
    void (async () => {
      const { projects: list, active: loaded } = await loadInitialWebProject()
      if (ac.signal.aborted) return
      projectHydratedRef.current = true
      setProject(loaded)
      setProjects(list)
      if (Object.keys(loaded.files).length > 1) setSidebarOpen(true)
    })()
    return () => ac.abort()
  }, [])

  // Once kernel is ready and hydrated (and no incoming/practice takeover), load project assets/components if multi-file.
  const initialSyncedRef = React.useRef(false)
  React.useEffect(() => {
    if (!ready || !projectHydratedRef.current || initialSyncedRef.current || incoming || arriving !== null) return
    initialSyncedRef.current = true
    if (Object.keys(project.files).length > 1 || isAssemblyPath(project.activeFile)) {
      void applyProjectFileToKernel(project, project.activeFile).catch(() => {})
    }
  }, [ready, project, incoming, arriving, applyProjectFileToKernel])

  // Keep active file in the virtual project synced with studio.tree changes.
  React.useEffect(() => {
    if (!projectHydratedRef.current) return
    if (studio.tree === lastSyncedTreeRef.current) return
    lastSyncedTreeRef.current = studio.tree
    const cur = projectRef.current
    const updated: WebProject = {
      ...cur,
      updatedAt: Date.now(),
      files: {
        ...cur.files,
        [cur.activeFile]: utf8File(`${JSON.stringify(studio.tree, null, 2)}\n`),
      },
    }
    setProject(updated)
    const timer = window.setTimeout(() => {
      void saveWebProject(updated).then(refreshProjectsList)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [studio.tree, refreshProjectsList])

  const partCount = studio.report?.parts?.length ?? 0
  /** Swap in another model: undoable, and the chat gets a line saying so. */
  const { load, undo } = studio
  const { addDivider } = chat
  const { reset: resetAnnotations } = annotations
  const replaceModel = React.useCallback(
    (tree: Tree, divider: string, done: string) => {
      resetAnnotations()
      addDivider(divider)
      void load(tree).then(() => notify.undo(done, undo))
    },
    [resetAnnotations, addDivider, load, undo],
  )

  // A practice from a lesson: once the kernel is up, start from its tree (undoable) and drop the parameter.
  const practiceTaken = React.useRef(false)
  React.useEffect(() => {
    if (!ready || arriving === null || practiceTaken.current) return
    practiceTaken.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete("practice")
    window.history.replaceState(null, "", url)
    const p = practiceById(arriving)
    if (!p) return void notify.error(t("没有找到这道练习", "Practice not found"))
    localStorage.setItem(PRACTICE_STORE, p.id)
    pinChecks(p.checks)
    replaceModel(
      { ...(p.start ?? EMPTY_TREE), checks: p.checks },
      t(`开始练习「${p.title}」`, `Started practice “${p.title}”`),
      t("已换成练习的起始模型", "Switched to the practice’s starting model"),
    )
  }, [ready, arriving, pinChecks, replaceModel])

  // 「复制到我的工作台」 / Remix from Community: supports both single-tree and full multi-file project bundles.
  const took = React.useRef(false)
  React.useEffect(() => {
    if (!ready || !incoming || took.current) return
    took.current = true
    navigate(".", { replace: true, state: null })
    if (incoming.bundle) {
      const importedProj = projectFromBundle({
        name: incoming.bundle.name,
        entry: incoming.bundle.entry,
        files: incoming.bundle.files,
        forkedFrom: incoming.bundle.forkedFrom,
        communityRef: incoming.bundle.communityRef,
      })
      projectHydratedRef.current = true
      resetAnnotations()
      addDivider(t(`加载了社区项目「${incoming.title}」`, `Loaded community project “${incoming.title}”`))
      void saveWebProject(importedProj)
        .then(async () => {
          setProject(importedProj)
          if (Object.keys(importedProj.files).length > 1) setSidebarOpen(true)
          await refreshProjectsList()
          await applyProjectFileToKernel(importedProj, importedProj.activeFile)
          notify.success(t(`已加载「${incoming.title}」`, `Loaded “${incoming.title}”`))
        })
        .catch((e) => notify.error((e as Error).message))
      return
    }
    const checked = checkTree(incoming.tree)
    if (!checked.ok) return void notify.error(t(`没能复制这个模型：${checked.message}`, `Couldn’t copy this model: ${checked.message}`))
    replaceModel(
      checked.tree,
      t(`换成了分享的模型「${incoming.title}」`, `Switched to the shared model “${incoming.title}”`),
      t("已替换当前模型", "Replaced the current model"),
    )
  }, [ready, incoming, navigate, replaceModel, applyProjectFileToKernel, refreshProjectsList, resetAnnotations, addDivider])

  // Flush current studio.tree into a clean snapshot of WebProject before project mutations or publishing.
  const snapshotProject = React.useCallback((): WebProject => {
    const cur = projectRef.current
    return {
      ...cur,
      updatedAt: Date.now(),
      files: {
        ...cur.files,
        [cur.activeFile]: utf8File(`${JSON.stringify(studio.treeRef.current, null, 2)}\n`),
      },
    }
  }, [studio.treeRef])

  // Project sidebar actions
  const selectProject = async (id: string) => {
    const found = projects.find((p) => p.id === id)
    if (!found || found.id === project.id) return
    await saveWebProject(snapshotProject())
    setProject(found)
    if (Object.keys(found.files).length > 1) setSidebarOpen(true)
    resetAnnotations()
    await applyProjectFileToKernel(found, found.activeFile)
    notify(t(`已切换到项目「${found.name}」`, `Switched to project “${found.name}”`))
  }

  const createProject = async (kind: "part" | "assembly") => {
    await saveWebProject(snapshotProject())
    const next = kind === "assembly" ? createAssemblyProject(t("新装配体", "New Assembly")) : createDefaultProject(EMPTY_TREE)
    setProject(next)
    if (kind === "assembly") setSidebarOpen(true)
    await saveWebProject(next)
    await refreshProjectsList()
    resetAnnotations()
    chat.clear()
    await applyProjectFileToKernel(next, next.activeFile)
    notify.success(kind === "assembly" ? t("已创建装配体项目", "Assembly project created") : t("已创建新项目", "New project created"))
  }

  const renameProject = async (name: string) => {
    const next = { ...snapshotProject(), name }
    setProject(next)
    await saveWebProject(next)
    await refreshProjectsList()
  }

  const selectFile = async (filePath: string) => {
    if (isParamsPath(filePath)) {
      setEditingParamsPath(filePath)
      return
    }
    if (!isPartPath(filePath) && !isAssemblyPath(filePath)) {
      notify(t(`已选择资产文件 ${filePath}，可在装配体中用 import 引用`, `Selected asset ${filePath}. Reference it via import in an assembly or part.`))
      return
    }
    const next = { ...snapshotProject(), activeFile: filePath }
    setProject(next)
    await saveWebProject(next)
    resetAnnotations()
    await applyProjectFileToKernel(next, filePath)
  }

  const addFile = async (kind: "part" | "assembly" | "params") => {
    const cur = snapshotProject()
    let idx = 1
    let filePath = ""
    let content = ""
    if (kind === "part") {
      while (cur.files[`part-${idx}${PART_EXT}`]) idx++
      filePath = `part-${idx}${PART_EXT}`
      content = `${JSON.stringify(EMPTY_TREE, null, 2)}\n`
    } else if (kind === "assembly") {
      while (cur.files[`assembly-${idx}${ASM_EXT}`]) idx++
      filePath = `assembly-${idx}${ASM_EXT}`
      content = `${JSON.stringify({ params: {}, features: [] }, null, 2)}\n`
    } else {
      while (cur.files[`shared${idx === 1 ? "" : `-${idx}`}${PARAMS_EXT}`]) idx++
      filePath = `shared${idx === 1 ? "" : `-${idx}`}${PARAMS_EXT}`
      content = `${JSON.stringify({ params: { wall: 2, clearance: 0.3 } }, null, 2)}\n`
    }
    const next: WebProject = {
      ...cur,
      activeFile: kind === "params" ? cur.activeFile : filePath,
      files: { ...cur.files, [filePath]: utf8File(content) },
      updatedAt: Date.now(),
    }
    setProject(next)
    setSidebarOpen(true)
    await saveWebProject(next)
    await refreshProjectsList()
    if (kind === "params") {
      setEditingParamsPath(filePath)
    } else {
      await applyProjectFileToKernel(next, filePath)
    }
  }

  const deleteFile = async (filePath: string) => {
    const cur = snapshotProject()
    const rest = { ...cur.files }
    delete rest[filePath]
    const remainingKeys = Object.keys(rest)
    const fallback = remainingKeys.find((k) => isPartPath(k) || isAssemblyPath(k))
    if (!fallback) {
      rest[`part${PART_EXT}`] = utf8File(`${JSON.stringify(EMPTY_TREE, null, 2)}\n`)
    }
    const nextActive = cur.activeFile === filePath ? fallback ?? `part${PART_EXT}` : cur.activeFile
    const next: WebProject = { ...cur, activeFile: nextActive, files: rest, updatedAt: Date.now() }
    setProject(next)
    await saveWebProject(next)
    await refreshProjectsList()
    await applyProjectFileToKernel(next, nextActive)
  }

  // Import: .json, .step/.stp, .params.json, or .zip project bundle (from menu or drag-and-drop).
  const fileInput = React.useRef<HTMLInputElement>(null)
  const [importError, setImportError] = React.useState<{ file: string; message: string } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const importFile = async (file: File) => {
    setImportError(null)
    if (!ready) return setImportError({ file: file.name, message: t("建模内核还没准备好，稍等再试", "The modeling kernel isn’t ready yet. Try again in a moment.") })
    if (chat.busy) return setImportError({ file: file.name, message: t("助教正在改模型，这一轮结束后再导入", "The tutor is changing the model. Import once it’s done.") })

    const next = snapshotProject()
    const res = await importIntoProject(next, file)
    if (!res.ok) return setImportError({ file: file.name, message: res.message })

    if (res.projectName) next.name = res.projectName
    const importedStep = res.added.find(isStepPath)
    // If the user dropped a STEP file onto an empty workbench, immediately preview it via an import feature.
    if (importedStep && !res.activeFile && studio.treeRef.current.features.length === 0) {
      const previewTree: Tree = {
        params: {},
        features: [{ id: "step1", op: "import", file: importedStep }],
      }
      next.files[next.activeFile] = utf8File(`${JSON.stringify(previewTree, null, 2)}\n`)
    }

    setProject(next)
    if (Object.keys(next.files).length > 1) setSidebarOpen(true)
    await saveWebProject(next)
    await refreshProjectsList()

    const targetFile = res.activeFile ?? next.activeFile
    resetAnnotations()
    addDivider(t(`导入了「${file.name}」`, `Imported “${file.name}”`))
    await applyProjectFileToKernel(next, targetFile)
    notify.success(
      importedStep && !res.activeFile && studio.treeRef.current.features.length > 0
        ? t(`已导入 STEP 资产 ${importedStep}，可在装配中引用`, `Imported STEP asset ${importedStep}`)
        : t(`已导入「${file.name}」`, `Imported “${file.name}”`),
    )
  }

  const download = async (format: "step" | "stl" | "3mf" | "json" | "py" | "bom-md" | "bom-csv" | "zip") => {
    if (format === "zip") {
      const snap = snapshotProject()
      const blob = exportProjectZip(snap)
      return saveBlob(blob, `${snap.name.replace(/[^\w\u4e00-\u9fa5-]+/g, "-") || "turnery-project"}.zip`)
    }
    if (format === "bom-md" || format === "bom-csv") {
      const analysis = analyzeModel(studio.tree, studio.report, { fileName: project.activeFile })
      const text = format === "bom-md" ? bomToMarkdown(project.name, analysis.bom, locale) : bomToCsv(analysis.bom)
      return saveBlob(new Blob([text], { type: format === "bom-md" ? "text/markdown" : "text/csv" }), `turnery-bom.${format === "bom-md" ? "md" : "csv"}`)
    }
    if (format === "py") {
      const { code, problems } = buildCode(studio.tree)
      if (problems.length) {
        return notify.error(
          t(
            `有 ${problems.length} 处不能安全地写成代码，没有导出：${problems[0]}`,
            `Not exported: ${problems.length} ${problems.length === 1 ? "place" : "places"} can’t be written safely as code: ${problems[0]}`,
          ),
        )
      }
      return saveBlob(new Blob([code], { type: "text/x-python" }), "turnery-model.py")
    }
    const blob = format === "json" ? new Blob([JSON.stringify(studio.tree, null, 2)], { type: "application/json" }) : await studio.exportBody(format)
    if (!blob) return notify(t("还没有实体可以导出", "Nothing to export yet"))
    saveBlob(blob, `turnery-model.${format === "stl" && blob.type === "application/zip" ? "zip" : format}`)
  }

  const publishProject = React.useMemo<WebProject>(
    () => ({
      ...project,
      files: {
        ...project.files,
        [project.activeFile]: utf8File(`${JSON.stringify(studio.tree, null, 2)}\n`),
      },
    }),
    [project, studio.tree],
  )

  const fileCount = Object.keys(project.files).length

  return (
    <>
      <div className="flex h-dvh flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
          <IconButton label={t("返回首页", "Back to home")} onClick={() => navigate("/")}>
            <ArrowLeft />
          </IconButton>
          <IconButton
            label={sidebarOpen ? t("隐藏项目文件", "Hide project files") : t("项目文件（多零件 / 装配 / STEP）", "Project files (parts / assemblies / STEP)")}
            onClick={() => setSidebarOpen((v) => !v)}
            className={sidebarOpen ? "bg-pressed text-foreground" : undefined}
          >
            <PanelLeft />
          </IconButton>
          <span className="truncate text-body font-semibold">{t("工作台", "Workbench")}</span>
          {fileCount > 1 && (
            <span className="hidden truncate rounded-sm bg-muted px-1.5 py-0.5 font-mono text-caption text-muted-foreground sm:inline">
              {project.activeFile}
            </span>
          )}
          {sheet ? (
            <Button size="sm" variant="secondary" className="mx-auto" onClick={() => setSheet(false)}>
              {t("回到 3D", "Back to 3D")}
            </Button>
          ) : (
            <span className="flex-1" />
          )}
          <div className="flex items-center gap-1">
            <IconButton label={t("撤销上一步", "Undo last step")} disabled={!studio.canUndo || chat.busy} onClick={studio.undo}>
              <Undo2 />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={t("导出", "Export")}>
                  <Download />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => void download("step")}>
                  {partCount > 1 ? t(`导出 STEP（${partCount} 个零件）`, `Export STEP (${partCount} parts)`) : t("导出 STEP", "Export STEP")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void download("stl")}>
                  {partCount > 1 ? t("导出 STL（zip，每个零件一个文件）", "Export STL (zip, one file per part)") : t("导出 STL", "Export STL")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void download("3mf")}>{t("导出 3MF（含多体与外观）", "Export 3MF (multi-part & colors)")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void download("zip")}>{t("导出 Turnery 项目包（ZIP）", "Export Turnery package (ZIP)")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void download("py")}>{t("导出 build123d 代码", "Export build123d code")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void download("json")}>{t("导出特征树（JSON）", "Export feature tree (JSON)")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void download("bom-md")}>{t("导出 BOM 物料清单（Markdown）", "Export BOM (Markdown)")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void download("bom-csv")}>{t("导出 BOM 物料清单（CSV）", "Export BOM (CSV)")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <IconButton label={t("临时分享链接", "Share ephemeral link")} disabled={!studio.tree.features.length || chat.busy} onClick={() => setSharing(true)}>
              <Share2 />
            </IconButton>
            <Button
              size="sm"
              variant="primary"
              disabled={!studio.tree.features.length || chat.busy}
              onClick={() => setPublishing(true)}
            >
              <UploadCloud />
              <span className="max-sm:hidden">
                {project.communityRef ? t("发布更新", "Publish update") : t("发布到社区", "Publish")}
              </span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton label={t("更多", "More")}>
                  <Ellipsis />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setSheet(!sheet)}>{sheet ? t("回到 3D", "Back to 3D") : t("工程图", "Drawing")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setCodeOpen(true)}>{t("代码", "Code")}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTab("analysis")}>{t("几何与 BOM 分析", "Geometry & BOM analysis")}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!ready || chat.busy} onSelect={() => fileInput.current?.click()}>
                  {t("导入 JSON / STEP / 项目包（ZIP）…", "Import JSON / STEP / ZIP bundle…")}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/community">
                    <Globe className="mr-1.5 size-3.5" />
                    {t("浏览开源社区", "Explore Community")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setKeyOpen(true)}>{t("使用自己的 key…", "Use your own key…")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="secondary" size="sm" disabled={chat.busy} onClick={() => setConfirmNew(true)}>
              {t("新建零件", "New part")}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept=".json,.step,.stp,.zip,application/json,application/zip"
            className="hidden"
            aria-label={t("选择特征树、STEP 或项目压缩包", "Choose a feature tree, STEP file, or project ZIP")}
            onChange={(e) => {
              const f = e.currentTarget.files?.[0]
              e.currentTarget.value = ""
              if (f) void importFile(f)
            }}
          />
        </header>
        {/* Under the top bar, not over it: toasts open 56 px from the top and must not cover its actions. */}
        <DesktopBanner />

        <div className="flex min-h-0 flex-1 max-lg:flex-col">
          {sidebarOpen && (
            <ProjectSidebar
              projects={projects.length ? projects : [project]}
              active={project}
              onSelectProject={(id) => void selectProject(id)}
              onCreateProject={(kind) => void createProject(kind)}
              onRenameProject={(name) => void renameProject(name)}
              onSelectFile={(p) => void selectFile(p)}
              onAddFile={(kind) => void addFile(kind)}
              onDeleteFile={(p) => void deleteFile(p)}
              onUploadFiles={() => fileInput.current?.click()}
            />
          )}
          <main
            className="relative min-h-0 min-w-0 flex-1"
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return
              e.preventDefault()
              e.dataTransfer.dropEffect = "copy"
              if (!dragging) setDragging(true)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false)
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return
              e.preventDefault()
              setDragging(false)
              const f = e.dataTransfer.files[0]
              if (f) void importFile(f)
            }}
          >
            <StudioViewport studio={studio} hover={hover} annotations={annotations} busy={chat.busy} reselect={reselect} parts={partsView} onParts={setPartsView} />
            <TreeOverlay studio={studio} onHover={setHover} reselect={reselect} annotations={annotations} busy={chat.busy} parts={partsView} onParts={setPartsView} detailsIn={stepSlot} />
            {sheet && (
              <div className="absolute inset-0 z-30 bg-background">
                <DrawingSheet studio={studio} title={studio.tree.features.length ? project.name : ""} />
              </div>
            )}
            {dragging && (
              <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-body font-medium">
                {t("松开鼠标，导入 JSON 特征树、STEP 文件或 ZIP 项目包", "Drop to import a JSON tree, STEP file, or ZIP project bundle")}
              </div>
            )}
            {importError && (
              <div
                role="alert"
                className="absolute top-3 left-1/2 z-20 flex w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 items-start gap-2 rounded-md border border-destructive/40 bg-background p-3 text-small shadow-popover"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1 break-words">
                  <div className="font-medium">{t(`没能导入「${importError.file}」`, `Couldn’t import “${importError.file}”`)}</div>
                  <div className="mt-0.5 text-muted-foreground">{importError.message}</div>
                  <div className="mt-0.5 text-faint-foreground">{t("当前模型没有改动。", "The current model is unchanged.")}</div>
                </div>
                <IconButton label={t("关闭", "Close")} size="icon-sm" tooltip={false} className="-mt-1 -mr-1 text-muted-foreground" onClick={() => setImportError(null)}>
                  <X />
                </IconButton>
              </div>
            )}
          </main>
          <ConnectorOverlay param={hover?.param ?? null} row={hover?.row ?? null} />

          <Tabs
            value={tab}
            onValueChange={setTab}
            style={{ "--panel-w": `${panel.width}px` } as React.CSSProperties}
            className="relative flex shrink-0 flex-col border-l lg:w-(--panel-w) max-lg:h-[55dvh] max-lg:w-full max-lg:border-t max-lg:border-l-0"
          >
            <ResizeHandle
              side="left"
              label={t("调整面板宽度", "Resize panel")}
              value={panel.width}
              min={PANEL_MIN}
              max={panel.max}
              defaultValue={PANEL_DEFAULT}
              onValueChange={(w) => panel.resize(w)}
              onValueCommit={(w) => panel.resize(w, true)}
              className="max-lg:hidden"
            />
            <TabsList className="shrink-0 px-3">
              <TabsTrigger value="chat">{t("对话", "Chat")}</TabsTrigger>
              <TabsTrigger value="params">{t("参数", "Parameters")}</TabsTrigger>
              <TabsTrigger value="analysis">{t("分析", "Analysis")}</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden" forceMount>
              {status && !status.hostedKey && !hasOwnKey() && (
                <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-small text-muted-foreground">
                  {t("这里没有公共额度，要用自己的 DeepSeek key", "No shared quota here. Use your own DeepSeek key.")}
                  <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setKeyOpen(true)}>
                    {t("填 key", "Add key")}
                  </Button>
                </div>
              )}
              {practice && <PracticeCard practice={practice} results={studio.report?.checks} rolledBack={Boolean(studio.rollback)} onExit={exitPractice} />}
              <ChatPanel
                chat={chat}
                annotations={annotations}
                ready={ready}
                onSelectFeature={studio.showFeature}
                onLoad={studio.load}
                model={status?.model}
                practicing={Boolean(practice)}
              />
            </TabsContent>
            <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
              <ParamsPanel studio={studio} onHover={setHover} annotations={annotations} />
            </TabsContent>
            <TabsContent value="analysis" className="min-h-0 flex-1 overflow-y-auto">
              <AnalysisPanel studio={studio} fileName={project.activeFile} title={project.name} />
            </TabsContent>
            {/* A step's details from the timeline cover this panel while shown. */}
            <div ref={setStepSlot} className="pointer-events-none absolute inset-0 z-20" />
          </Tabs>
        </div>

        <ShareDialog open={sharing} onOpenChange={setSharing} tree={studio.tree} messages={chat.messages} />
        <PublishDialog
          open={publishing}
          onOpenChange={setPublishing}
          project={publishProject}
          checks={studio.report?.checks}
          capturePreview={studio.capturePreview}
          forkedFrom={project.forkedFrom}
          onPublished={(res) => {
            const next: WebProject = {
              ...snapshotProject(),
              communityRef: { handle: res.handle, slug: res.slug, version: res.version },
            }
            setProject(next)
            void saveWebProject(next).then(refreshProjectsList)
          }}
        />
        <KeyDialog open={keyOpen} onOpenChange={setKeyOpen} status={status} />
        {editingParamsPath && (
          <SharedParamsDialog
            filePath={editingParamsPath}
            initialContent={
              project.files[editingParamsPath]?.encoding === "utf8"
                ? (project.files[editingParamsPath].content as string)
                : "{}"
            }
            onClose={() => setEditingParamsPath(null)}
            onSave={async (nextJson) => {
              const cur = snapshotProject()
              const next: WebProject = {
                ...cur,
                updatedAt: Date.now(),
                files: { ...cur.files, [editingParamsPath]: utf8File(nextJson) },
              }
              setProject(next)
              await saveWebProject(next)
              await refreshProjectsList()
              await applyProjectFileToKernel(next, next.activeFile)
              setEditingParamsPath(null)
              notify.success(t("已保存共享参数并重新建模", "Saved shared parameters and rebuilt"))
            }}
          />
        )}
        <Drawer open={codeOpen} onOpenChange={setCodeOpen}>
          <DrawerContent size="lg">
            <DrawerHeader title={t("代码", "Code")} description={t("和特征树等价的 build123d 代码", "build123d code equivalent to the feature tree")} />
            <DrawerBody className="p-0">
              <CodePanel studio={studio} />
            </DrawerBody>
          </DrawerContent>
        </Drawer>
        <ConfirmDialog
          open={confirmNew}
          onOpenChange={setConfirmNew}
          title={t("新建零件？", "New part?")}
          description={t("会清空当前的特征树和对话。特征树可以用「撤销」找回，对话不能。", "This clears the current feature tree and chat. Undo brings back the feature tree, not the chat.")}
          confirmLabel={t("清空并新建", "Clear and start new")}
          tone="danger"
          onConfirm={() => {
            exitPractice()
            chat.clear()
            annotations.reset()
            studio.reset()
          }}
        />
      </div>
    </>
  )
}

const PRACTICE_STORE = "arbor:practice"

const hasOwnKey = () => Boolean(localStorage.getItem(KEY_STORE))

function SharedParamsDialog({
  filePath,
  initialContent,
  onClose,
  onSave,
}: {
  filePath: string
  initialContent: string
  onClose: () => void
  onSave: (json: string) => Promise<void>
}) {
  const [text, setText] = React.useState(initialContent)
  const [error, setError] = React.useState<string | null>(null)
  const save = async () => {
    try {
      const parsed = JSON.parse(text)
      if (!parsed || typeof parsed !== "object" || typeof parsed.params !== "object") {
        setError(t("格式应为 { \"params\": { \"name\": value } }", "Expected { \"params\": { \"name\": value } }"))
        return
      }
      setError(null)
      await onSave(`${JSON.stringify(parsed, null, 2)}\n`)
    } catch (e) {
      setError((e as Error).message)
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md">
        <DialogHeader title={filePath} description={t("共享参数会被同一项目里引用它的零件和装配体继承。", "Shared parameters are inherited by parts and assemblies in this project.")} />
        <DialogBody className="space-y-2">
          <Textarea className="min-h-48 font-mono text-small" value={text} onChange={(e) => setText(e.target.value)} />
          {error && <p className="text-small text-destructive">{error}</p>}
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t("取消", "Cancel")}
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            {t("保存并重新建模", "Save & rebuild")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KeyDialog({ open, onOpenChange, status }: { open: boolean; onOpenChange: (o: boolean) => void; status: Status | null }) {
  const [key, setKey] = React.useState(() => localStorage.getItem(KEY_STORE) ?? "")
  const save = () => {
    const k = key.trim()
    if (k) localStorage.setItem(KEY_STORE, k)
    else localStorage.removeItem(KEY_STORE)
    notify(k ? t("已保存，之后的对话用你自己的 key", "Saved. Chats from now on use your own key.") : t("已清除，改用公共额度", "Cleared. Using the shared quota."))
    onOpenChange(false)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t("使用自己的 DeepSeek key", "Use your own DeepSeek key")} />
        <DialogBody>
          <p className="text-small text-muted-foreground">
            {status?.hostedKey
              ? t(
                  `不填就用本站的公共额度（${status.via === "openrouter" ? "经 OpenRouter 调用同一个模型，" : ""}每天有上限）。`,
                  `Leave it empty to use this site’s shared quota (${status.via === "openrouter" ? "the same model through OpenRouter, " : ""}with a daily limit). `,
                )
              : t("本站没有配置公共额度，需要填自己的 key。", "This site has no shared quota, so you need your own key. ")}
            {t(
              "key 只保存在这个浏览器里，随请求经本站服务器转发给 DeepSeek，服务器不保存。",
              "The key stays in this browser. It goes through this site’s server to DeepSeek with each request and is never stored there.",
            )}
          </p>
          <Input className="mt-3 font-mono" type="password" autoComplete="off" placeholder="sk-…" value={key} onChange={(e) => setKey(e.target.value)} aria-label="DeepSeek API key" />
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" onClick={save}>
            {t("保存", "Save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
