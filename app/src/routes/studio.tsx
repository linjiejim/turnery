import * as React from "react"
import { Link, useNavigate } from "react-router"
import { ArrowLeft, CircleAlert, Download, Ellipsis, PanelLeft, Redo2, Undo2, X } from "lucide-react"
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@/components/ui/drawer"
import { practiceById, type Practice } from "@/content/practice"
import { PracticeCard } from "@/studio/ui/practice-card"
import { Button, IconButton } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { StateView } from "@/components/ui/state"
import { notify } from "@/components/ui/toast"
import { usePanels } from "@/desktop/panels"
import { AddPartMenu } from "@/desktop/ui/assembly"
import { ModelLoading } from "@/desktop/ui/model-loading"
import { PartsSidebar } from "@/desktop/ui/parts-sidebar"
import { fileStem } from "@/desktop/ui/words"
import { EMPTY_TREE, type Tree } from "@/studio/dsl"
import { forgetChat } from "@/studio/forget-chat"
import { readTreeFile } from "@/studio/import"
import { PANEL_DEFAULT, PANEL_MIN, usePanelWidth } from "@/studio/ui/panel-width"
import { AddFileMenu, NameDialog, NewProjectDialog, PickFileDialog, ProjectMenu, type ProjectActions } from "@/studio/ui/project-ui"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import type { Hover } from "@/studio/scene"
import { STARTERS } from "@/studio/starters"
import { StudioViewport, type ViewCamera } from "@/studio/ui/studio-viewport"
import { ConnectorOverlay } from "@/studio/ui/connector-overlay"
import { DesktopBanner } from "@/studio/ui/desktop-banner"
import { DrawingSheet } from "@/studio/ui/drawing-sheet"
import { useReselect } from "@/studio/use-reselect"
import { TreeOverlay, type TimelineControl } from "@/studio/ui/tree-overlay"
import { useAnnotations } from "@/studio/use-annotations"
import { useOtherTab, useWebHost, useWebStudio } from "@/studio/web-host/use-web-host"
import { useWebStructure } from "@/studio/web-host/use-web-structure"
import { cleanName, type NewKind, type WebHost, type WebProject } from "@/studio/web-host/web-host"
import { t } from "@/lib/i18n"

/** Files the page takes in: feature trees, assemblies, shared parameters, STEP models, project archives. */
const IMPORTABLE = ".json,.step,.stp,.zip,application/json,application/zip"

const errorText = (e: unknown) => String((e as Error)?.message ?? e)

/** A ready-made model's file name: its title up to the colon (「小盒子：先圆角后抽壳」→「小盒子」). */
const modelName = (title: string) => title.split(/[：:]/)[0].trim() || title

export function StudioPage() {
  React.useEffect(() => forgetChat(), [])
  const { host, error } = useWebHost()
  if (!host)
    return (
      <div className="flex h-dvh flex-col bg-background">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
          <span className="truncate pl-2 text-body font-semibold">{t("工作台", "Workbench")}</span>
        </header>
        {error && <StateView kind="error" className="flex-1" description={error} onRetry={() => window.location.reload()} />}
      </div>
    )
  return <Workbench host={host} />
}

function Workbench({ host }: { host: WebHost }) {
  const navigate = useNavigate()
  const web = useWebStudio(host)
  const { snapshot, doc, studio } = web
  const project = snapshot?.project ?? null
  const root = project?.root ?? null
  // Nothing to send notes to on the site: these only light up what a step or a check points at.
  const annotations = useAnnotations(studio)
  const [treeHover, setTreeHover] = React.useState<Hover | null>(null)
  const [stepSlot, setStepSlot] = React.useState<HTMLDivElement | null>(null)
  const reselect = useReselect(studio)
  /** 「工程图」: the drawing sheet over the 3D view; the side panel stays, so parameters can be changed while looking at it. */
  const [sheet, setSheet] = React.useState(false)
  const [codeOpen, setCodeOpen] = React.useState(false)
  /** The timeline's form (the empty part's 「新建草图」) and replay (「看参考做法」). */
  const timeline = React.useRef<TimelineControl | null>(null)
  /** 「看参考做法」: the reference part, replayed from its first step once it's on screen. */
  const replayWanted = React.useRef<string | null>(null)
  /** The reference part made for the practice (its page offers the way back). */
  const [reference, setReference] = React.useState<string | null>(null)
  const ready = studio.kernel.phase === "ready"
  const panel = usePanelWidth()
  const panels = usePanels()
  const sidebarOpen = panels.panels.left.open
  /** Where the camera was left in each file, for coming back to it. */
  const [cameras] = React.useState(() => new Map<string, ViewCamera>())

  // ------------------------------------------------------------------ projects

  const [projects, setProjects] = React.useState<WebProject[]>([])
  const refreshProjects = React.useCallback(() => void host.projects().then(setProjects), [host])
  React.useEffect(() => {
    refreshProjects()
    return host.files.onChange(refreshProjects)
  }, [host, refreshProjects])
  const otherTab = useOtherTab()
  const [persistent, setPersistent] = React.useState(host.files.persistent)
  React.useEffect(() => host.files.onChange(() => setPersistent(host.files.persistent)), [host])

  const run = React.useCallback(async (work: () => Promise<unknown>) => {
    try {
      await work()
    } catch (e) {
      notify.error(errorText(e))
    }
  }, [])

  const [naming, setNaming] = React.useState<{ kind: NewKind; name: string } | null>(null)
  const [renamingProject, setRenamingProject] = React.useState(false)
  const [newProject, setNewProject] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const fileInput = React.useRef<HTMLInputElement>(null)

  const newFile = React.useCallback(
    (kind: NewKind) =>
      void run(async () => {
        const path = await host.freeName(kind === "assembly" ? t("装配", "Assembly") : t("零件", "Part"), kind)
        setNaming({ kind, name: fileStem(path) })
      }),
    [host, run],
  )

  const actions: ProjectActions = {
    projects,
    current: root,
    busy: false,
    files: project?.files.map((f) => ({ path: f.path, name: f.name, kind: f.kind })),
    active: doc?.path ?? null,
    openFile: (path) => void run(() => host.call("open_part", { path })),
    open: (r) => void run(() => host.openProject(r)),
    newFile,
    importFiles: () => fileInput.current?.click(),
    newProject: () => setNewProject(true),
    renameProject: () => setRenamingProject(true),
    exportProject: () => void run(() => host.exportProject()),
    deleteProject: () => setDeleting(true),
  }

  // The assistant's 「＋ 零件」 asks for a file of the project (or an upload): this dialog answers it.
  const [picking, setPicking] = React.useState<{ kind: "part" | "step"; resolve: (path: string | null) => void } | null>(null)
  const uploadFor = React.useRef<((paths: string[]) => void) | null>(null)
  React.useEffect(
    () =>
      host.setAsk({
        pickFile: (kind) => new Promise((resolve) => setPicking({ kind, resolve })),
        newProject: () => new Promise((resolve) => (setNewProject(true), resolve(null))),
      }),
    [host],
  )
  const closePicking = (path: string | null) => {
    picking?.resolve(path)
    setPicking(null)
  }

  // ------------------------------------------------------- ready-made models

  /** A model from elsewhere (an example, a lesson): into the open part when it's empty, else a new part. */
  const { reset: resetAnnotations } = annotations
  const openModel = React.useCallback(
    async (tree: Tree, name: string, say = true) => {
      const d = host.engine.docState()
      resetAnnotations()
      if (d && d.kind === "part" && !d.context && !d.tree.features.length) {
        await studio.load(tree)
        // Into an empty part, what was asked for is in view: said only when it came from elsewhere (a link, a practice).
        if (say) notify.undo(t(`已打开「${name}」`, `Opened “${name}”`), studio.undo)
        return d.path
      }
      const path = await host.newFile("part", name, tree)
      notify.undo(t(`已新建零件「${fileStem(path)}」`, `Created part “${fileStem(path)}”`), () => void host.deleteFile(path))
      return path
    },
    [host, studio, resetAnnotations],
  )
  const openStarter = (tree: Tree) => {
    const title = STARTERS.find((x) => x.tree === tree)?.title ?? t("示例", "Example")
    void run(() => openModel(tree, modelName(title), false))
  }

  // /studio?start=<id> opens a ready-made tree (from a teardown, or the menu of examples).
  const booted = Boolean(doc) && ready
  const startTaken = React.useRef(false)
  React.useEffect(() => {
    if (!booted || startTaken.current) return
    const url = new URL(window.location.href)
    const starter = STARTERS.find((x) => x.id === url.searchParams.get("start"))
    if (!url.searchParams.has("start")) return
    startTaken.current = true
    url.searchParams.delete("start")
    window.history.replaceState(null, "", url)
    if (starter) void run(() => openModel(starter.tree, modelName(starter.title), false))
  }, [booted, openModel, run])

  // A practice from a lesson (/studio?practice=<id>): its own part, its checks pinned while that part is open.
  const [arriving] = React.useState(() => new URL(window.location.href).searchParams.get("practice"))
  const [practice, setPractice] = React.useState<Practice | null>(() => practiceById(arriving ?? localStorage.getItem(PRACTICE_STORE) ?? "") ?? null)
  const [practicePart, setPracticePart] = React.useState<string | null>(() => localStorage.getItem(PRACTICE_PART))
  /** The practice from the address whose part is made: until then its card waits. */
  const [settled, setSettled] = React.useState<string | null>(null)
  // A practice arriving from a lesson counts once its own part is made and open, not on the part a
  // previous practice left behind (its card would act on the wrong part meanwhile).
  const practicing = Boolean(practice) && (practicePart ? doc?.path === practicePart && (!arriving || practice?.id === settled) : !arriving)
  const { pinChecks } = studio
  React.useEffect(() => pinChecks(practicing ? (practice?.checks ?? null) : null), [practicing, practice, pinChecks])
  const exitPractice = React.useCallback(() => {
    setPractice(null)
    setPracticePart(null)
    localStorage.removeItem(PRACTICE_STORE)
    localStorage.removeItem(PRACTICE_PART)
  }, [])
  const practiceTaken = React.useRef(false)
  React.useEffect(() => {
    if (!booted || arriving === null || practiceTaken.current) return
    practiceTaken.current = true
    const url = new URL(window.location.href)
    url.searchParams.delete("practice")
    window.history.replaceState(null, "", url)
    const p = practiceById(arriving)
    if (!p) return void notify.error(t("没有找到这道练习", "Practice not found"))
    localStorage.setItem(PRACTICE_STORE, p.id)
    void run(async () => {
      const path = await openModel({ ...(p.start ?? EMPTY_TREE), checks: p.checks }, p.title)
      setPractice(p)
      setPracticePart(path)
      setSettled(p.id)
      localStorage.setItem(PRACTICE_PART, path)
    })
  }, [booted, arriving, openModel, run])

  // 「看参考做法」: the reference answer in a part of its own, replayed from its first step; the practice part stays as it is.
  const showSolution = (p: Practice) =>
    void run(async () => {
      const path = await host.newFile("part", t(`参考：${p.title}`, `Reference: ${p.title}`), p.solution)
      replayWanted.current = path
      setReference(path)
    })
  // Runs again once `reference` is set too: the part may be open and drawn before `newFile` comes back.
  React.useEffect(() => {
    if (!replayWanted.current || doc?.path !== replayWanted.current || !studio.tree.features.length || !studio.display) return
    replayWanted.current = null
    timeline.current?.replay()
  }, [doc?.path, studio.tree, studio.display, reference])

  // ------------------------------------------------------------ import, export

  const [importError, setImportError] = React.useState<{ file: string; message: string } | null>(null)
  const [dragging, setDragging] = React.useState(false)
  const importFiles = async (files: File[]) => {
    setImportError(null)
    const names = files.map((f) => f.name).join(t("、", ", "))
    if (!files.length) return
    // During a practice, a feature tree goes into the practice's part (its requirements stay).
    const one = files.length === 1 ? files[0] : null
    if (practicing && one && /\.json$/i.test(one.name) && !/(-asm|\.params)\.json$/i.test(one.name) && !uploadFor.current) {
      const r = await readTreeFile(one)
      if (!r.ok) return setImportError({ file: one.name, message: r.message })
      await studio.load(r.tree)
      return notify.undo(t(`已导入「${r.name}」`, `Imported “${r.name}”`), studio.undo)
    }
    try {
      const r = await host.importFiles(files)
      const upload = uploadFor.current
      uploadFor.current = null
      if (upload) return upload(r.added)
      if (r.project && !r.added.length) return notify.success(t(`已导入项目「${r.project.split("/").pop()}」`, `Imported project “${r.project.split("/").pop()}”`))
      const what = r.opened ? fileStem(r.opened) : r.added.map((p) => p.split("/").pop()).join(t("、", ", "))
      if (r.undo) notify.undo(t(`已导入「${what}」`, `Imported “${what}”`), () => void run(r.undo!))
    } catch (e) {
      uploadFor.current?.([])
      uploadFor.current = null
      setImportError({ file: names, message: errorText(e) })
    }
  }

  const exportAs = (format: "step" | "stl" | "3mf" | "py" | "json" | "bom") => void run(() => host.exportCurrent(format))

  // ------------------------------------------------------------- the structure

  const s = useWebStructure(host, doc, studio, doc?.kind === "assembly" && !doc.context ? <AddPartMenu doc={doc} /> : undefined)
  const assembly = s.assembly
  const partCount = studio.report?.parts?.length ?? 0
  const loading = snapshot?.loading ?? null
  const viewHover = treeHover ?? s.hover

  const deleteFile = (path: string) =>
    void run(async () => {
      const undo = await host.deleteFile(path)
      if (practicePart === path) exitPractice()
      notify.undo(t(`已删除「${fileStem(path)}」`, `Deleted “${fileStem(path)}”`), () => void run(undo))
    })
  const renameFile = async (file: string, name: string) => {
    const r = await host.call("rename_file", { path: file, name })
    if (!r.ok) notify.error(r.text.replace(/^✗ /, ""))
    return r.ok
  }

  const selectionActions = s.selection ? (
    <>
      <Button size="sm" variant="ghost" title={s.selection.why ?? t("单独打开它的零件文件（也可以双击零件）", "Open its part file on its own (or double-click the part)")} disabled={Boolean(s.selection.why) || !s.selection.one} onClick={() => s.selection?.open(false)}>
        {t("打开零件", "Open part")}
        <Kbd>↵</Kbd>
      </Button>
      <Button size="sm" variant="ghost" title={s.selection.why ?? t("在装配里改它，其余零件留在周围", "Edit it in the assembly, with the other parts around it")} disabled={Boolean(s.selection.why) || !s.selection.one} onClick={() => s.selection?.open(true)}>
        {t("在装配里改", "Edit in assembly")}
        <Kbd>⇧↵</Kbd>
      </Button>
    </>
  ) : null

  const projectName = project?.name ?? t("工作台", "Workbench")
  const context = doc?.context
  const busy = Boolean(loading)
  const emptyPart = Boolean(doc && doc.kind === "part" && ready && !studio.tree.features.length)
  const filesForPick =
    picking?.kind === "step"
      ? host.stepFiles().map((path) => ({ path, folder: root ? path.slice(root.length + 1).split("/").slice(0, -1).join("/") : "" }))
      : (project?.files ?? []).filter((f) => f.path !== doc?.path).map((f) => ({ path: f.path, folder: f.folder, assembly: f.kind === "assembly" }))

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-2">
        <IconButton label={t("返回首页", "Back to home")} onClick={() => navigate("/")}>
          <ArrowLeft />
        </IconButton>
        {!sidebarOpen && (
          <IconButton label={t("展开左栏", "Show left panel")} className="text-muted-foreground max-lg:hidden" onClick={panels.toggleLeft}>
            <PanelLeft />
          </IconButton>
        )}
        <nav aria-label={t("位置", "Location")} className="ml-1 flex min-w-0 items-center gap-1">
          {/* With the left panel open its top holds the project menu; here the name is enough. */}
          <ProjectMenu actions={actions} name={projectName} compact className={sidebarOpen ? "lg:hidden" : undefined} />
          {/* The project's own assembly carries its name: said once, as the way back to it. */}
          {sidebarOpen && context?.name !== projectName && <span className="max-w-48 truncate px-1.5 text-body text-muted-foreground max-lg:hidden">{projectName}</span>}
          {context && (
            <>
              <span className={sidebarOpen && context.name === projectName ? "text-faint-foreground lg:hidden" : "text-faint-foreground"}>/</span>
              <button
                type="button"
                title={t(`回到装配：${context.name}`, `Back to assembly: ${context.name}`)}
                aria-label={t(`回到装配：${context.name}`, `Back to assembly: ${context.name}`)}
                className="max-w-40 truncate rounded-sm px-1 text-body text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => void run(() => host.call("open_part", { path: context.assembly }))}
              >
                {context.name}
              </button>
            </>
          )}
          {doc && doc.name !== project?.name && (
            <>
              <span className="text-faint-foreground">/</span>
              <span className="truncate px-1 text-body font-medium">{doc.name}</span>
            </>
          )}
          {context && <span className="shrink-0 rounded-sm bg-muted px-1.5 text-caption text-muted-foreground">{t("在装配里", "In assembly")}</span>}
        </nav>
        {sheet ? (
          <Button size="sm" variant="secondary" className="mx-auto" onClick={() => setSheet(false)}>
            {t("回到 3D", "Back to 3D")}
          </Button>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex items-center gap-1">
          <IconButton label={t("撤销上一步", "Undo last step")} disabled={!doc?.canUndo} onClick={studio.undo}>
            <Undo2 />
          </IconButton>
          <IconButton label={t("重做", "Redo")} disabled={!doc?.canRedo} onClick={() => void host.call("redo", {}, doc?.path)}>
            <Redo2 />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("导出", "Export")} disabled={!doc}>
                <Download />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={() => exportAs("step")}>{partCount > 1 ? t(`导出 STEP（${partCount} 个零件）`, `Export STEP (${partCount} parts)`) : t("导出 STEP", "Export STEP")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("stl")}>{partCount > 1 ? t("导出 STL（zip，每个零件一个文件）", "Export STL (zip, one file per part)") : t("导出 STL", "Export STL")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exportAs("3mf")}>{t("导出 3MF（带颜色，给切片软件）", "Export 3MF (with colors, for slicers)")}</DropdownMenuItem>
              {assembly && <DropdownMenuItem onSelect={() => exportAs("bom")}>{t("导出零件清单（Markdown）", "Export parts list (Markdown)")}</DropdownMenuItem>}
              {!assembly && <DropdownMenuItem onSelect={() => exportAs("py")}>{t("导出 build123d 代码", "Export build123d code")}</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => exportAs("json")}>{assembly ? t("导出装配文件（JSON）", "Export assembly file (JSON)") : t("导出特征树（JSON）", "Export feature tree (JSON)")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={actions.exportProject}>{t("导出整个项目（.zip）", "Export whole project (.zip)")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("更多", "More")}>
                <Ellipsis />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled={!doc} onSelect={() => setSheet(!sheet)}>
                {sheet ? t("回到 3D", "Back to 3D") : t("工程图", "Drawing")}
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!doc || assembly} onSelect={() => setCodeOpen(true)}>
                {t("代码", "Code")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => fileInput.current?.click()}>{t("导入文件…", "Import files…")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={IMPORTABLE}
          className="hidden"
          aria-label={t("选择要导入的文件", "Choose files to import")}
          onChange={(e) => {
            const list = [...(e.currentTarget.files ?? [])]
            e.currentTarget.value = ""
            void importFiles(list)
          }}
        />
      </header>
      {/* Under the top bar, not over it: toasts open 56 px from the top and must not cover its actions. */}
      <DesktopBanner />
      {otherTab && (
        <div role="status" className="flex h-9 shrink-0 items-center gap-2 border-b bg-warning/10 px-3 text-small text-foreground">
          <CircleAlert className="size-4 shrink-0 text-warning" />
          {t("另一个标签页也开着工作台：两边各存各的，同一个文件以后保存的为准。只在一个标签页里改。", "The workbench is open in another tab too: each keeps its own copy, and the later save of a file wins. Edit in one tab only.")}
        </div>
      )}
      {!persistent && (
        <div role="status" className="flex h-9 shrink-0 items-center gap-2 border-b bg-warning/10 px-3 text-small text-foreground">
          <CircleAlert className="size-4 shrink-0 text-warning" />
          {t("这个浏览器不让网页保存文件（可能是无痕窗口）：关掉页面后项目就没了，记得导出。", "This browser won’t let the page keep files (a private window?): the projects go when the page closes. Export what you want to keep.")}
        </div>
      )}

      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        {sidebarOpen && (
          <div className="flex max-lg:hidden">
            <PartsSidebar
              snapshot={snapshot}
              width={panels.widths.left}
              panels={panels.panels}
              onPanels={panels.update}
              onCollapse={panels.toggleLeft}
              structure={s.structure}
              selected={s.selectedNames}
              onSelect={(p, additive) => s.selectFeature(p.id || null, p.index, additive, true)}
              onPoint={(p) => s.pointFeature(p?.id || null, p?.index, true)}
              onLook={s.onLook}
              onRenameFile={renameFile}
              onDeleteFile={deleteFile}
              head={
                <div className="flex h-11 shrink-0 items-center gap-1 pr-1.5 pl-1.5">
                  <ProjectMenu actions={actions} name={projectName} className="min-w-0" />
                  <IconButton label={t("收起左栏", "Hide left panel")} size="icon-sm" className="ml-auto text-muted-foreground" onClick={panels.toggleLeft}>
                    <PanelLeft />
                  </IconButton>
                </div>
              }
              tools={<AddFileMenu onNew={newFile} onImport={() => fileInput.current?.click()} />}
              filesHint={[
                t("项目就是一个文件夹，存在这个浏览器里：里面的装配和零件都列在这里。", "A project is a folder kept in this browser: its assemblies and parts are listed here."),
                t("几个零件的东西：新建一个装配，在它的「结构」里用 ＋ 加零件。", "For something with several parts: create an assembly and add parts with ＋ in its 「Structure」."),
                t("点一个文件打开它；双击改名，⋯ 里能删除。", "Click a file to open it. Double-click to rename; ⋯ deletes it."),
              ]}
            />
          </div>
        )}
        <main
          className="relative min-h-0 min-w-0 flex-1"
          data-testid="model-viewport"
          data-document={doc?.path}
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
            void importFiles([...e.dataTransfer.files])
          }}
        >
          {doc || !project?.files || project.files.length > 0 || !ready ? (
            <>
              <StudioViewport
                studio={studio}
                hover={viewHover}
                annotations={annotations}
                annotation={false}
                busy={busy}
                reselect={reselect}
                parts={s.partsView}
                onParts={s.setPartsView}
                onPointFeature={s.pointFeature}
                onSelectFeature={s.selectFeature}
                selectedParts={s.selectedParts}
                selectionActions={selectionActions}
                onOpenPart={s.openPartAt}
                active={!sheet}
                viewKey={doc?.path}
                cameras={cameras}
              />
              <TreeOverlay
                key={doc?.path}
                studio={studio}
                onHover={setTreeHover}
                reselect={reselect}
                annotations={annotations}
                busy={busy}
                parts={s.partsView}
                onParts={s.setPartsView}
                selectedFeature={s.selectedFeature}
                onSelectFeature={s.selectFeature}
                partsList={!assembly}
                looks={!assembly}
                timeline={!assembly}
                detailsIn={stepSlot}
                control={timeline}
              />
            </>
          ) : (
            <StateView
              kind="empty"
              className="h-full"
              title={t("这个项目还没有文件", "This project has no files yet")}
              action={
                <div className="flex gap-2">
                  <Button variant="primary" onClick={() => newFile("part")}>
                    {t("新建零件", "New part")}
                  </Button>
                  <Button variant="secondary" onClick={() => newFile("assembly")}>
                    {t("新建装配", "New assembly")}
                  </Button>
                </div>
              }
            />
          )}
          {sheet && doc && (
            <div className="absolute inset-0 z-30 bg-background">
              <DrawingSheet studio={studio} title={doc.name} />
            </div>
          )}
          {dragging && (
            <div className="pointer-events-none absolute inset-3 z-20 grid place-items-center rounded-lg border-2 border-dashed border-primary bg-background/80 text-body font-medium">
              {t("松开鼠标，导入到这个项目", "Drop to import into this project")}
            </div>
          )}
          <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-2 px-16">
            {loading && loading.startedAt > 0 && ready && <ModelLoading load={loading} visible={Boolean(studio.display?.mesh)} />}
            {doc?.error && (
              <div role="alert" className="pointer-events-auto flex max-w-xl items-center gap-2.5 rounded-lg border border-destructive/40 bg-background px-3 py-1.5 text-body shadow-popover">
                <CircleAlert className="size-4 shrink-0 text-destructive" />
                {doc.error}
              </div>
            )}
          </div>
          {importError && (
            <div
              role="alert"
              className="absolute top-3 left-1/2 z-20 flex w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2 items-start gap-2 rounded-md border border-destructive/40 bg-background p-3 text-small shadow-popover"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 break-words">
                <div className="font-medium">{t(`没能导入「${importError.file}」`, `Couldn’t import “${importError.file}”`)}</div>
                <div className="mt-0.5 text-muted-foreground">{importError.message}</div>
                <div className="mt-0.5 text-faint-foreground">{t("项目没有改动。", "The project is unchanged.")}</div>
              </div>
              <IconButton label={t("关闭", "Close")} size="icon-sm" tooltip={false} className="-mt-1 -mr-1 text-muted-foreground" onClick={() => setImportError(null)}>
                <X />
              </IconButton>
            </div>
          )}
        </main>
        <ConnectorOverlay param={viewHover?.param ?? null} row={viewHover?.row ?? null} />

        <aside
          aria-label={t("参数和练习", "Parameters and practice")}
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
          {practice && practicing && (
            <PracticeCard practice={practice} results={studio.report?.checks} rolledBack={Boolean(studio.rollback)} onExit={exitPractice} onSolution={() => showSolution(practice)} />
          )}
          {practice && practicePart && reference && doc?.path === reference && (
            <div className="flex shrink-0 items-center gap-2 border-b px-4 py-3 text-small">
              <span className="min-w-0 flex-1 text-muted-foreground">{t(`这是「${practice.title}」的参考做法，▶ 可以再放一遍。`, `This is a reference answer to “${practice.title}”; ▶ replays it.`)}</span>
              <Button size="sm" variant="secondary" onClick={() => void run(() => host.call("open_part", { path: practicePart }))}>
                {t("回到练习", "Back to the practice")}
              </Button>
            </div>
          )}
          {emptyPart && !practicing && <StartHere onSketch={() => timeline.current?.newStep("sketch")} onStarter={openStarter} />}
          {emptyPart && practicing && (
            <div className="shrink-0 border-b px-4 py-3">
              <Button size="sm" variant="primary" onClick={() => timeline.current?.newStep("sketch")}>
                {t("从草图开始", "Start with a sketch")}
              </Button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ParamsPanel studio={studio} onHover={setTreeHover} />
          </div>
          {/* A step's details from the timeline cover this panel while shown. */}
          <div ref={setStepSlot} className="pointer-events-none absolute inset-0 z-20" />
        </aside>
      </div>

      <Drawer open={codeOpen} onOpenChange={setCodeOpen}>
        <DrawerContent size="lg">
          <DrawerHeader title={t("代码", "Code")} description={t("和特征树等价的 build123d 代码", "build123d code equivalent to the feature tree")} />
          <DrawerBody className="p-0">
            <CodePanel studio={studio} />
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      <NameDialog
        open={naming !== null}
        onOpenChange={(o) => !o && setNaming(null)}
        title={naming?.kind === "assembly" ? t("新建装配", "New assembly") : t("新建零件", "New part")}
        label={naming?.kind === "assembly" ? t("装配名", "Assembly name") : t("零件名", "Part name")}
        initial={naming?.name ?? ""}
        confirmLabel={naming?.kind === "assembly" ? t("新建装配", "Create assembly") : t("新建零件", "Create part")}
        onSubmit={async (name) => {
          if (!naming) return null
          if (!cleanName(name)) return t("要有名字", "It needs a name")
          await host.newFile(naming.kind, name)
          return null
        }}
      />
      <NameDialog
        open={renamingProject}
        onOpenChange={setRenamingProject}
        title={t("重命名项目", "Rename project")}
        label={t("项目名", "Project name")}
        initial={project?.name ?? ""}
        confirmLabel={t("改名", "Rename")}
        onSubmit={async (name) => {
          if (!root) return null
          await host.renameProject(root, name)
          return null
        }}
      />
      <NewProjectDialog
        open={newProject}
        onOpenChange={setNewProject}
        onCreate={async (name, kind) => {
          await host.createProject(name, kind)
          return null
        }}
      />
      <PickFileDialog
        open={picking !== null}
        onOpenChange={(o) => !o && closePicking(null)}
        kind={picking?.kind ?? "part"}
        files={filesForPick}
        onPick={(path) => closePicking(path)}
        onUpload={() => {
          const p = picking
          setPicking(null)
          uploadFor.current = (paths) => p?.resolve(paths.find((x) => (p.kind === "step" ? /\.(step|stp)$/i.test(x) : /\.json$/i.test(x))) ?? null)
          fileInput.current?.click()
        }}
      />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t(`删除项目「${project?.name ?? ""}」？`, `Delete project “${project?.name ?? ""}”?`)}
        description={t(
          `里面的 ${project?.files.length ?? 0} 个零件和装配、共享参数和 STEP 文件都会从这个浏览器里删掉，不能撤销。要留一份就先「导出整个项目」。`,
          `Its ${project?.files.length ?? 0} parts and assemblies, shared parameters and STEP files are removed from this browser, and this can’t be undone. To keep a copy, export the whole project first.`,
        )}
        confirmLabel={t("删除项目", "Delete project")}
        tone="danger"
        onConfirm={() => {
          if (!root) return
          void run(() => host.deleteProject(root))
        }}
      />
    </div>
  )
}

const PRACTICE_STORE = "arbor:practice"
/** The part a practice is done in (its checks are pinned while it is open). */
const PRACTICE_PART = "turnery:practice-part"

/** An empty part, outside a practice: how to start, the ready-made examples, a lesson to learn it from. */
function StartHere({ onSketch, onStarter }: { onSketch: () => void; onStarter: (tree: Tree) => void }) {
  return (
    <section aria-label={t("从这里开始", "Start here")} className="shrink-0 space-y-3 border-b px-4 py-4">
      <div>
        <h2 className="text-body font-semibold">{t("从一张草图开始", "Start from a sketch")}</h2>
        <p className="mt-1 text-small text-muted-foreground">
          {t(
            "零件是一步步特征叠出来的：先画草图，再拉伸成实体，然后打孔、倒圆角。每一步都用时间线末尾的 ＋ 加；点一步可以改尺寸、编辑或调顺序。",
            "A part is built up one feature at a time: sketch first, extrude it into a solid, then add holes and fillets. Add each step with ＋ at the end of the timeline; click a step to change its dimensions, edit it or move it.",
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onSketch}>
          {t("新建草图", "New sketch")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary">
              {t("打开示例", "Open an example")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {STARTERS.map((x) => (
              <DropdownMenuItem key={x.id} onSelect={() => onStarter(x.tree)}>
                {x.title}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/learn">{t("先学一节课", "Learn a lesson first")}</Link>
        </Button>
      </div>
    </section>
  )
}
