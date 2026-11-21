// /community/@:handle/:slug (and /v/:version) — Interactive 3D Community Project Viewer:
// full multi-part assembly & STEP support, live parameter tweaking, feature timeline replay,
// geometry & BOM analysis, version history with feature-tree diffs, Remix in Workbench, and direct update.
import * as React from "react"
import { Link, useNavigate, useParams } from "react-router"
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderPlus,
  GitBranch,
  History,
  Star,
  Undo2,
  UploadCloud,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, IconButton } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { ResizeHandle } from "@/components/ui/resize-handle"
import { Select } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { StateView } from "@/components/ui/state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { documentTitle } from "@/lib/page-meta"
import { locale, t } from "@/lib/i18n"
import { analyzeModel, bomToCsv, bomToMarkdown } from "@/studio/analysis"
import { buildCode } from "@/studio/codegen"
import { saveBlob } from "@/studio/download"
import {
  exportProjectZip,
  projectFromBundle,
  resolveProjectFile,
  type WebProject,
} from "@/studio/project-store"
import { NO_PARTS_VIEW, type Hover, type PartsView } from "@/studio/scene"
import { AnalysisPanel } from "@/studio/ui/analysis-panel"
import { ConnectorOverlay } from "@/studio/ui/connector-overlay"
import { DrawingSheet } from "@/studio/ui/drawing-sheet"
import { Markdown } from "@/studio/ui/markdown"
import { PANEL_DEFAULT, PANEL_MIN, usePanelWidth } from "@/studio/ui/panel-width"
import { CodePanel, ParamsPanel } from "@/studio/ui/side-panels"
import { StudioViewport } from "@/studio/ui/studio-viewport"
import { TreeOverlay } from "@/studio/ui/tree-overlay"
import { useAnnotations } from "@/studio/use-annotations"
import { useStudio, type KernelSources } from "@/studio/use-studio"
import type { Incoming } from "@/routes/studio"
import {
  categoryLabel,
  collectionTitle,
  hubApi,
  projectSummary,
  projectTitle,
  useHubAuth,
  type HubCollection,
  type HubProject,
  type HubRelease,
} from "@/hub/api"
import { isAssemblyPath, isPartPath, type BundleFileInput } from "@/hub/package"
import { AuthDialog } from "@/hub/ui/auth-dialog"
import { PublishDialog } from "@/hub/ui/publish-dialog"

type LoadedBundle = {
  project: HubProject
  releases: HubRelease[]
  release: HubRelease
  files: BundleFileInput[]
  webProject: WebProject
  initialSources: KernelSources
  initialTree: ReturnType<typeof resolveProjectFile> extends Promise<infer R> ? R : never
}

export function CommunityProjectPage() {
  const { handle = "", slug = "", version } = useParams()
  const cleanHandle = handle.replace(/^@/, "")
  const [loaded, setLoaded] = React.useState<LoadedBundle | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    const ac = new AbortController()
    Promise.all([
      hubApi.getProject(cleanHandle, slug),
      hubApi.getBundle(cleanHandle, slug, version ?? "latest"),
    ])
      .then(async ([meta, bundle]) => {
        const webProject = projectFromBundle({
          name: projectTitle(meta.project),
          entry: bundle.release.entry,
          files: bundle.files,
          communityRef: { handle: meta.project.ownerHandle, slug: meta.project.slug, version: bundle.release.version },
        })
        const resolved = await resolveProjectFile(webProject, bundle.release.entry)
        if (ac.signal.aborted) return
        setError(null)
        setLoaded({
          project: meta.project,
          releases: meta.releases,
          release: bundle.release,
          files: bundle.files,
          webProject,
          initialSources: {
            assets: resolved.gathered.assets,
            components: resolved.gathered.components,
            context: null,
          },
          initialTree: resolved,
        })
      })
      .catch((e) => !ac.signal.aborted && setError((e as Error).message))
    return () => ac.abort()
  }, [cleanHandle, slug, version, attempt])

  if (error) {
    return (
      <StateView
        kind="error"
        title={t("打不开这个社区作品", "Couldn’t open this community project")}
        description={error}
        onRetry={() => setAttempt((n) => n + 1)}
        action={
          <Button asChild size="sm" variant="secondary">
            <Link to="/community">{t("返回社区", "Back to Community")}</Link>
          </Button>
        }
        className="min-h-dvh"
      />
    )
  }

  if (!loaded) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner className="size-5" label={t("正在加载社区作品", "Loading community project")} />
      </div>
    )
  }

  return (
    <CommunityProjectViewer
      key={`${loaded.project.id}@${loaded.release.version}`}
      data={loaded}
      onReload={() => setAttempt((n) => n + 1)}
    />
  )
}

function CommunityProjectViewer({ data, onReload }: { data: LoadedBundle; onReload: () => void }) {
  const navigate = useNavigate()
  const auth = useHubAuth()
  const [project, setProject] = React.useState(data.project)
  const [activeFile, setActiveFile] = React.useState(data.release.entry)
  const studio = useStudio(data.initialTree.effective, data.initialSources)
  const annotations = useAnnotations(studio)
  const [hover, setHover] = React.useState<Hover | null>(null)
  const [partsView, setPartsView] = React.useState<PartsView>(NO_PARTS_VIEW)
  const [stepSlot, setStepSlot] = React.useState<HTMLDivElement | null>(null)
  const [sheet, setSheet] = React.useState(false)
  const panel = usePanelWidth()
  const ready = studio.kernel.phase === "ready"

  const [authOpen, setAuthOpen] = React.useState(false)
  const [colOpen, setColOpen] = React.useState(false)
  const [updateOpen, setUpdateOpen] = React.useState(false)

  const title = projectTitle(project)
  const summary = projectSummary(project)
  const isOwner = auth.user?.id === project.ownerId

  React.useEffect(() => {
    document.title = documentTitle(`${title} · @${project.ownerHandle}`)
  }, [title, project.ownerHandle])

  const switchFile = async (filePath: string) => {
    setActiveFile(filePath)
    const resolved = await resolveProjectFile(data.webProject, filePath)
    await studio.setSources(
      { assets: resolved.gathered.assets, components: resolved.gathered.components, context: null },
      resolved.effective,
    )
  }

  const toggleStar = async () => {
    if (!auth.user) return setAuthOpen(true)
    try {
      const res = await hubApi.star(project.ownerHandle, project.slug, !project.starred)
      setProject((p) => ({ ...p, starred: res.starred, starsCount: res.starsCount }))
    } catch (e) {
      notify.error((e as Error).message)
    }
  }

  const remixInWorkbench = () => {
    const incoming: Incoming = {
      tree: studio.treeRef.current,
      title,
      bundle: {
        name: title,
        entry: activeFile,
        files: data.files,
        forkedFrom: { handle: project.ownerHandle, slug: project.slug, version: data.release.version },
        ...(isOwner ? { communityRef: { handle: project.ownerHandle, slug: project.slug, version: data.release.version } } : {}),
      },
    }
    navigate("/studio", { state: { incoming } })
  }

  const download = async (format: "step" | "stl" | "3mf" | "py" | "bom-md" | "bom-csv" | "zip") => {
    if (format === "zip") {
      void hubApi.getBundle(project.ownerHandle, project.slug, data.release.version, true).catch(() => {})
      const blob = exportProjectZip(data.webProject, {
        license: project.license,
        category: project.category,
        summary,
        version: data.release.version,
      })
      return saveBlob(blob, `${project.slug}-v${data.release.version}.zip`)
    }
    if (format === "py") {
      const { code, problems } = buildCode(studio.tree)
      if (problems.length) return notify.error(t(`有 ${problems.length} 处不能安全导出：${problems[0]}`, `Not exported: ${problems[0]}`))
      return saveBlob(new Blob([code], { type: "text/x-python" }), `${project.slug}.py`)
    }
    if (format === "bom-md" || format === "bom-csv") {
      const analysis = analyzeModel(studio.tree, studio.report, { fileName: activeFile })
      const text = format === "bom-md" ? bomToMarkdown(title, analysis.bom, locale) : bomToCsv(analysis.bom)
      return saveBlob(new Blob([text], { type: format === "bom-md" ? "text/markdown" : "text/csv" }), `${project.slug}-bom.${format === "bom-md" ? "md" : "csv"}`)
    }
    const blob = await studio.exportBody(format)
    if (!blob) return notify(t("还没有实体可以导出", "Nothing to export yet"))
    saveBlob(blob, `${project.slug}-v${data.release.version}.${format === "stl" && blob.type === "application/zip" ? "zip" : format}`)
  }

  const readmeFile = data.files.find((f) => /^readme(\.zh-cn)?\.md$/i.test(f.path))
  const modelFiles = data.files.filter((f) => isPartPath(f.path) || isAssemblyPath(f.path))

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
        <IconButton label={t("返回社区", "Back to Community")} onClick={() => navigate("/community")}>
          <ArrowLeft />
        </IconButton>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-body font-semibold">{title}</span>
          <Link to={`/community/@${project.ownerHandle}`} className="shrink-0 text-small text-muted-foreground hover:underline max-sm:hidden">
            @{project.ownerHandle}
          </Link>
          <Select
            value={data.release.version}
            onValueChange={(v) => navigate(`/community/@${project.ownerHandle}/${project.slug}/v/${v}`)}
            aria-label={t("切换版本", "Select version")}
            className="h-7 w-24 font-mono text-caption"
            options={data.releases.map((r) => ({ value: r.version, label: `v${r.version}` }))}
          />
          <Badge tone="outline" className="max-md:hidden">
            {project.license}
          </Badge>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <IconButton label={t("撤销参数改动", "Undo")} disabled={!studio.canUndo} onClick={studio.undo}>
            <Undo2 />
          </IconButton>
          <Button size="sm" variant={project.starred ? "primary" : "secondary"} onClick={() => void toggleStar()}>
            <Star />
            <span className="tabular">{project.starsCount}</span>
          </Button>
          <IconButton label={t("收入合集", "Add to collection")} onClick={() => (auth.user ? setColOpen(true) : setAuthOpen(true))}>
            <FolderPlus />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton label={t("导出与下载", "Export & Download")} disabled={!ready}>
                <Download />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void download("zip")}>{t("下载完整项目包（ZIP）", "Download project bundle (ZIP)")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void download("step")}>{t("导出 STEP", "Export STEP")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("stl")}>{t("导出 STL", "Export STL")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("3mf")}>{t("导出 3MF", "Export 3MF")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("py")}>{t("导出 build123d 代码", "Export build123d code")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void download("bom-md")}>{t("导出 BOM（Markdown）", "Export BOM (Markdown)")}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("bom-csv")}>{t("导出 BOM（CSV）", "Export BOM (CSV)")}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSheet((s) => !s)}>{sheet ? t("回到 3D 视图", "Back to 3D") : t("查看工程图", "Engineering drawing")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {isOwner && (
            <Button size="sm" variant="secondary" onClick={() => setUpdateOpen(true)}>
              <UploadCloud />
              {t("发布更新", "Push update")}
            </Button>
          )}
          <Button size="sm" variant="primary" onClick={remixInWorkbench}>
            <GitBranch />
            {isOwner ? t("在工作台编辑", "Edit in Workbench") : t("Remix / 在工作台打开", "Remix in Workbench")}
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 max-lg:flex-col">
        <main className="relative min-h-0 min-w-0 flex-1">
          <StudioViewport studio={studio} hover={hover} annotations={annotations} busy={false} readOnly parts={partsView} onParts={setPartsView} />
          <TreeOverlay studio={studio} onHover={setHover} readOnly parts={partsView} onParts={setPartsView} detailsIn={stepSlot} />
          {sheet && (
            <div className="absolute inset-0 z-30 bg-background">
              <DrawingSheet studio={studio} title={title} />
            </div>
          )}
        </main>
        <ConnectorOverlay param={hover?.param ?? null} row={hover?.row ?? null} />

        <Tabs
          defaultValue="overview"
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
          <TabsList className="shrink-0 px-2">
            <TabsTrigger value="overview">{t("概览", "Overview")}</TabsTrigger>
            <TabsTrigger value="params">{t("参数", "Params")}</TabsTrigger>
            <TabsTrigger value="analysis">{t("分析", "Analysis")}</TabsTrigger>
            <TabsTrigger value="versions">{t("版本", "Versions")}</TabsTrigger>
            <TabsTrigger value="code">{t("代码", "Code")}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div>
              <h2 className="text-heading font-semibold break-words">{title}</h2>
              {summary && <p className="mt-1 text-body text-muted-foreground">{summary}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge tone="neutral">{categoryLabel(project.category)}</Badge>
                <Badge tone="outline">{project.license}</Badge>
                {project.checksTotal > 0 && (
                  <Badge tone={project.checksPassed === project.checksTotal ? "success" : "warning"}>
                    <CheckCircle2 />
                    {t(`核对 ${project.checksPassed}/${project.checksTotal}`, `Checks ${project.checksPassed}/${project.checksTotal}`)}
                  </Badge>
                )}
                {project.tags.map((tag) => (
                  <Badge key={tag} tone="neutral">
                    #{tag}
                  </Badge>
                ))}
              </div>
              {project.forkedFrom && (
                <p className="mt-2 text-small text-muted-foreground">
                  {t("衍生自 ", "Remixed from ")}
                  <Link className="underline underline-offset-4" to={`/community/@${project.forkedFrom.handle}/${project.forkedFrom.slug}`}>
                    @{project.forkedFrom.handle}/{project.forkedFrom.slug}
                  </Link>
                </p>
              )}
              {project.repoUrl && (
                <p className="mt-2 text-small">
                  <a href={project.repoUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-4 hover:text-foreground">
                    <ExternalLink className="size-3.5" />
                    {project.repoUrl}
                  </a>
                </p>
              )}
            </div>

            {modelFiles.length > 1 && (
              <section>
                <h3 className="mb-1.5 text-small font-semibold">{t("项目模型文件", "Project model files")}</h3>
                <div className="space-y-1">
                  {modelFiles.map((f) => (
                    <Button
                      key={f.path}
                      size="sm"
                      variant={f.path === activeFile ? "primary" : "secondary"}
                      className="w-full justify-start font-mono text-caption"
                      onClick={() => void switchFile(f.path)}
                    >
                      {f.path}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            {readmeFile && (
              <section className="border-t pt-3">
                <Markdown text={readmeFile.content} />
              </section>
            )}
          </TabsContent>

          <TabsContent value="params" className="min-h-0 flex-1 overflow-y-auto">
            <ParamsPanel studio={studio} onHover={setHover} />
          </TabsContent>

          <TabsContent value="analysis" className="min-h-0 flex-1 overflow-y-auto">
            <AnalysisPanel studio={studio} fileName={activeFile} title={title} />
          </TabsContent>

          <TabsContent value="versions" className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            <div className="flex items-center gap-1.5 text-small font-semibold">
              <History className="size-4 text-muted-foreground" />
              {t(`共 ${data.releases.length} 个版本`, `${data.releases.length} releases`)}
            </div>
            <ul className="space-y-3">
              {data.releases.map((rel) => (
                <li key={rel.id} className="rounded-md border p-3 text-small">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/community/@${project.ownerHandle}/${project.slug}/v/${rel.version}`}
                      className="font-mono font-semibold hover:underline"
                    >
                      v{rel.version}
                    </Link>
                    {rel.version === project.latestVersion && <Badge tone="info">{t("最新", "Latest")}</Badge>}
                    {rel.checksTotal > 0 && (
                      <Badge tone={rel.checksPassed === rel.checksTotal ? "success" : "warning"}>
                        {rel.checksPassed}/{rel.checksTotal}
                      </Badge>
                    )}
                    <span className="ml-auto text-caption text-faint-foreground">
                      {new Date(rel.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {rel.changelog && <p className="mt-1.5 text-muted-foreground whitespace-pre-wrap">{rel.changelog}</p>}
                  {rel.diffSummary && (
                    <div className="mt-2 space-y-1 rounded-sm bg-sunken p-2 text-caption text-muted-foreground">
                      {rel.diffSummary.treeChanges.map((tc) => (
                        <div key={tc.file}>
                          <span className="font-mono text-foreground">{tc.file}:</span> {tc.summary}
                        </div>
                      ))}
                      {rel.diffSummary.filesAdded.length > 0 && (
                        <div>{t(`新增文件：${rel.diffSummary.filesAdded.join("、")}`, `Added: ${rel.diffSummary.filesAdded.join(", ")}`)}</div>
                      )}
                      {rel.diffSummary.filesRemoved.length > 0 && (
                        <div>{t(`移除文件：${rel.diffSummary.filesRemoved.join("、")}`, `Removed: ${rel.diffSummary.filesRemoved.join(", ")}`)}</div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="code" className="min-h-0 flex-1 overflow-y-auto">
            <CodePanel studio={studio} />
          </TabsContent>

          <div ref={setStepSlot} className="pointer-events-none absolute inset-0 z-20" />
        </Tabs>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} auth={auth.auth} onSignedIn={() => void auth.refresh()} returnTo={`/community/@${project.ownerHandle}/${project.slug}`} />
      {auth.user && (
        <AddToCollectionDialog
          open={colOpen}
          onOpenChange={setColOpen}
          userHandle={auth.user.handle}
          project={project}
          currentVersion={data.release.version}
        />
      )}
      {isOwner && (
        <PublishDialog
          open={updateOpen}
          onOpenChange={setUpdateOpen}
          project={data.webProject}
          checks={studio.report?.checks}
          capturePreview={studio.capturePreview}
          onPublished={() => onReload()}
        />
      )}
    </div>
  )
}

function AddToCollectionDialog({
  open,
  onOpenChange,
  userHandle,
  project,
  currentVersion,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  userHandle: string
  project: HubProject
  currentVersion: string
}) {
  const [cols, setCols] = React.useState<HubCollection[]>([])
  const [selected, setSelected] = React.useState("")
  const [pinMode, setPinMode] = React.useState<"latest" | "pinned">("latest")
  const [note, setNote] = React.useState("")
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    void hubApi.listCollections({ author: userHandle }).then((res) => {
      setCols(res.items)
      if (res.items.length) setSelected(res.items[0].slug)
    })
  }, [open, userHandle])

  const submit = async () => {
    if (!selected) return
    setPending(true)
    try {
      await hubApi.addCollectionItem(userHandle, selected, {
        projectId: project.id,
        pinnedVersion: pinMode === "pinned" ? currentVersion : null,
        note: note.trim(),
      })
      notify.success(t("已收入项目合集", "Added to collection"))
      onOpenChange(false)
    } catch (e) {
      notify.error((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader title={t("收入项目合集", "Add to collection")} />
        <DialogBody>
          {cols.length === 0 ? (
            <p className="text-small text-muted-foreground">
              {t("你还没有创建过项目合集，请先到社区页新建一个合集。", "You don’t have any collections yet. Create one on the Community page first.")}
            </p>
          ) : (
            <FieldGroup>
              <Field label={t("选择合集", "Collection")} required>
                <Select
                  value={selected}
                  onValueChange={setSelected}
                  options={cols.map((c) => ({ value: c.slug, label: collectionTitle(c) }))}
                />
              </Field>
              <Field label={t("版本追踪方式", "Version tracking")}>
                <Select
                  value={pinMode}
                  onValueChange={(v) => setPinMode(v as "latest" | "pinned")}
                  options={[
                    { value: "latest", label: t("自动追踪最新版本", "Track latest version") },
                    { value: "pinned", label: t(`锁定为 v${currentVersion}`, `Pin to v${currentVersion}`) },
                  ]}
                />
              </Field>
              <Field label={t("合集备注（可选）", "Curator note (optional)")}>
                <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("例如：适配 2020 铝型材的必装件", "e.g. Fits 2020 extrusion rails")} />
              </Field>
            </FieldGroup>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" loading={pending} disabled={!selected} onClick={() => void submit()}>
            {t("加入合集", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
