// /community — Open-source Community Hub: browse parametric parts, multi-part assemblies
// and curated project collections. Zero WASM loaded on this page: only static thumbnails & metadata.
import * as React from "react"
import { Link } from "react-router"
import { Box, Boxes, CheckCircle2, FolderKanban, LogIn, Plus, Search, Star, UploadCloud, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Callout } from "@/components/ui/callout"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input, Textarea } from "@/components/ui/input"
import { Page, PageHeader } from "@/components/ui/page"
import { Select } from "@/components/ui/select"
import { StateView } from "@/components/ui/state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import {
  blobUrl,
  categoryLabel,
  collectionTitle,
  hubApi,
  projectSummary,
  projectTitle,
  useHubAuth,
  type HubCollection,
  type HubProject,
} from "@/hub/api"
import { CATEGORIES, slugify, type ProjectCategory } from "@/hub/package"
import { AuthDialog } from "@/hub/ui/auth-dialog"

export function CommunityPage() {
  const auth = useHubAuth()
  const [authOpen, setAuthOpen] = React.useState(false)
  const [tab, setTab] = React.useState<"projects" | "collections">("projects")

  const [q, setQ] = React.useState("")
  const [category, setCategory] = React.useState<string>("all")
  const [kind, setKind] = React.useState<string>("all")
  const [verifiedOnly, setVerifiedOnly] = React.useState(false)
  const [sort, setSort] = React.useState<"updated" | "stars" | "newest" | "downloads">("updated")

  const [projects, setProjects] = React.useState<HubProject[]>([])
  const [totalProjects, setTotalProjects] = React.useState(0)
  const [collections, setCollections] = React.useState<HubCollection[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [createColOpen, setCreateColOpen] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [pRes, cRes] = await Promise.all([
        hubApi.listProjects({
          q: q.trim() || undefined,
          category: category === "all" ? undefined : category,
          kind: kind === "all" ? undefined : kind,
          verified: verifiedOnly || undefined,
          sort,
          limit: 36,
        }),
        hubApi.listCollections({ q: q.trim() || undefined }),
      ])
      setProjects(pRes.items)
      setTotalProjects(pRes.total)
      setCollections(cRes.items)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [q, category, kind, verifiedOnly, sort])

  React.useEffect(() => {
    const timer = setTimeout(() => void load(), 150)
    return () => clearTimeout(timer)
  }, [load])

  return (
    <Page width="wide" className="mx-auto">
      <PageHeader
        title={t("开源社区", "Community")}
        info={t(
          "创作者在这里以开放包格式（turnery.json + 特征树/装配/核对项）公开并持续更新参数化作品与项目合集。任何作品都可以在浏览器中直接 3D 预览、调参、分析或 Remix。",
          "Creators publish and continuously update open-source parametric parts, assemblies and curated collections in the open Turnery package format. Inspect in 3D, tweak parameters, analyze or remix in the browser.",
        )}
        actions={
          <>
            {auth.user ? (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/community/@${auth.user.handle}`}>
                  <User />@{auth.user.handle}
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setAuthOpen(true)}>
                <LogIn />
                {t("登录", "Sign in")}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (auth.user ? setCreateColOpen(true) : setAuthOpen(true))}
            >
              <FolderKanban />
              {t("新建合集", "New collection")}
            </Button>
            <Button asChild variant="primary" size="sm">
              <Link to="/studio">
                <UploadCloud />
                {t("在工作台创作 / 发布", "Create & Publish")}
              </Link>
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "projects" | "collections")}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="projects">
              {t(`作品 (${totalProjects})`, `Projects (${totalProjects})`)}
            </TabsTrigger>
            <TabsTrigger value="collections">
              {t(`项目合集 (${collections.length})`, `Collections (${collections.length})`)}
            </TabsTrigger>
          </TabsList>

          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("搜索作品、标签、作者或合集…", "Search projects, tags, authors or collections…")}
              className="pl-8"
              aria-label={t("搜索社区", "Search community")}
            />
          </div>

          {tab === "projects" && (
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={category}
                onValueChange={setCategory}
                aria-label={t("分类", "Category")}
                className="w-36"
                options={[
                  { value: "all", label: t("全部分类", "All categories") },
                  ...CATEGORIES.map((c: ProjectCategory) => ({ value: c, label: categoryLabel(c) })),
                ]}
              />
              <Select
                value={kind}
                onValueChange={setKind}
                aria-label={t("类型", "Kind")}
                className="w-32"
                options={[
                  { value: "all", label: t("零件与装配", "All types") },
                  { value: "part", label: t("单零件", "Part") },
                  { value: "assembly", label: t("多零件装配", "Assembly") },
                ]}
              />
              <Select
                value={sort}
                onValueChange={(v) => setSort(v as typeof sort)}
                aria-label={t("排序", "Sort")}
                className="w-32"
                options={[
                  { value: "updated", label: t("最近更新", "Recently updated") },
                  { value: "stars", label: t("最多收藏", "Most starred") },
                  { value: "newest", label: t("最新发布", "Newest") },
                  { value: "downloads", label: t("最多拉取", "Most pulled") },
                ]}
              />
              <Button
                size="sm"
                variant={verifiedOnly ? "primary" : "secondary"}
                onClick={() => setVerifiedOnly((v) => !v)}
              >
                <CheckCircle2 />
                {t("已通过核对", "Verified checks")}
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="projects">
          {error ? (
            <StateView kind="error" title={t("加载社区作品失败", "Failed to load projects")} description={error} onRetry={() => void load()} />
          ) : loading ? (
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="aspect-[4/3] rounded-lg border bg-sunken" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <StateView
              kind="empty"
              title={t("还没有匹配的开源作品", "No open-source projects match yet")}
              description={t("去工作台新建或导入一个 Turnery 项目，点击顶栏「发布到社区」即可公开并持续更新。", "Create or import a Turnery project in the Workbench and click Publish to share it here.")}
              action={
                <Button asChild variant="primary" size="sm">
                  <Link to="/studio">
                    <Plus />
                    {t("去工作台发布第一个作品", "Publish from Workbench")}
                  </Link>
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="collections">
          {error ? (
            <StateView kind="error" title={t("加载合集失败", "Failed to load collections")} description={error} onRetry={() => void load()} />
          ) : collections.length === 0 ? (
            <StateView
              kind="empty"
              title={t("还没有项目合集", "No collections yet")}
              description={t("把一系列相关零件或社区开源作品收进同一个合集，支持锁定版本或持续追踪最新更新。", "Group related parts or community works into a curated collection, pinned to versions or tracking latest.")}
              action={
                <Button variant="primary" size="sm" onClick={() => (auth.user ? setCreateColOpen(true) : setAuthOpen(true))}>
                  <Plus />
                  {t("新建项目合集", "Create collection")}
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {collections.map((c) => (
                <Link
                  key={c.id}
                  to={`/community/@${c.ownerHandle}/c/${c.slug}`}
                  className="flex flex-col gap-2 rounded-lg border p-4 transition-colors duration-(--duration-fast) hover:border-input hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban className="size-4 shrink-0 text-primary" />
                    <span className="truncate text-heading font-semibold">{collectionTitle(c)}</span>
                    <Badge tone="neutral" className="ml-auto">
                      {t(`${c.itemCount} 个作品`, `${c.itemCount} items`)}
                    </Badge>
                  </div>
                  {c.description && <p className="line-clamp-2 text-small text-muted-foreground">{c.description}</p>}
                  <div className="mt-auto pt-2 text-caption text-faint-foreground">
                    @{c.ownerHandle} · {new Date(c.updatedAt).toLocaleDateString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} auth={auth.auth} onSignedIn={() => void auth.refresh()} />
      <CreateCollectionDialog
        open={createColOpen}
        onOpenChange={setCreateColOpen}
        onCreated={() => {
          setTab("collections")
          void load()
        }}
      />
    </Page>
  )
}

export function ProjectCard({ project }: { project: HubProject }) {
  const verified = project.checksTotal > 0 && project.checksPassed === project.checksTotal
  return (
    <Link
      to={`/community/@${project.ownerHandle}/${project.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border transition-colors duration-(--duration-fast) hover:border-input"
    >
      <div className="relative grid aspect-[4/3] place-items-center bg-scene">
        {project.previewBlob ? (
          <img src={blobUrl(project.previewBlob)} alt={projectTitle(project)} className="size-full object-contain" loading="lazy" />
        ) : project.kind === "assembly" ? (
          <Boxes className="size-10 text-faint-foreground" />
        ) : (
          <Box className="size-10 text-faint-foreground" />
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <Badge tone="neutral">v{project.latestVersion}</Badge>
          {verified && (
            <Badge tone="success">
              <CheckCircle2 />
              {project.checksPassed}/{project.checksTotal}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 border-t p-3">
        <div className="flex items-center gap-2">
          <span className="truncate text-heading font-semibold">{projectTitle(project)}</span>
          <Badge tone="outline" className="ml-auto">
            {project.kind === "assembly" ? t("装配", "Assembly") : t("零件", "Part")}
          </Badge>
        </div>
        {projectSummary(project) && <p className="line-clamp-2 text-small text-muted-foreground">{projectSummary(project)}</p>}
        <div className="mt-auto flex items-center gap-2 pt-1 text-caption text-faint-foreground">
          <span className="truncate">@{project.ownerHandle}</span>
          <span>·</span>
          <span>{project.license}</span>
          <span className="ml-auto inline-flex items-center gap-1 tabular">
            <Star className="size-3" />
            {project.starsCount}
          </span>
        </div>
      </div>
    </Link>
  )
}

function CreateCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: () => void
}) {
  const [titleZh, setTitleZh] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setPending(true)
    try {
      await hubApi.createCollection({
        titleZh: titleZh.trim(),
        titleEn: titleZh.trim(),
        slug: (slug.trim() || slugify(titleZh)).toLowerCase(),
        description: description.trim(),
      })
      notify.success(t("已创建项目合集", "Collection created"))
      setTitleZh("")
      setSlug("")
      setDescription("")
      onOpenChange(false)
      onCreated()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader
          title={t("新建项目合集", "New collection")}
          description={t("将相关参数化作品或开源套件组织在一起，持续追踪更新。", "Curate related parametric parts and kits in one living collection.")}
        />
        <DialogBody>
          <FieldGroup>
            <Field label={t("合集标题", "Title")} required>
              <Input
                value={titleZh}
                onChange={(e) => {
                  setTitleZh(e.target.value)
                  if (!slug) setSlug(slugify(e.target.value))
                }}
                placeholder={t("例如：ESP32 外壳与固定支架合集", "e.g. ESP32 Enclosures & Mounts")}
              />
            </Field>
            <Field label={t("合集标识（slug）", "Slug")} required>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" placeholder="esp32-cases" />
            </Field>
            <Field label={t("简介", "Description")}>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder={t("说明这个合集的主题与适用场景…", "Describe what this collection covers…")} />
            </Field>
          </FieldGroup>
          {error && (
            <Callout tone="danger" className="mt-3">
              {error}
            </Callout>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="primary" loading={pending} disabled={!titleZh.trim()} onClick={() => void submit()}>
            {t("创建合集", "Create collection")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
