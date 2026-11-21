// /community/@:handle/c/:slug — Curated Project Collection Page.
import * as React from "react"
import { Link, useParams } from "react-router"
import { ArrowLeft, ArrowUpRight, FolderKanban, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, IconButton } from "@/components/ui/button"
import { Page, PageHeader } from "@/components/ui/page"
import { Spinner } from "@/components/ui/spinner"
import { StateView } from "@/components/ui/state"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import {
  collectionTitle,
  hubApi,
  projectSummary,
  projectTitle,
  useHubAuth,
  type HubCollection,
  type HubCollectionItem,
} from "@/hub/api"

export function CommunityCollectionPage() {
  const { handle = "", slug = "" } = useParams()
  const cleanHandle = handle.replace(/^@/, "")
  const auth = useHubAuth()
  const [collection, setCollection] = React.useState<HubCollection | null>(null)
  const [items, setItems] = React.useState<HubCollectionItem[]>([])
  const routeKey = `${cleanHandle}/${slug}`
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [reloadTick, setReloadTick] = React.useState(0)
  const loading = loadedKey !== routeKey && error === null

  React.useEffect(() => {
    const ac = new AbortController()
    void hubApi
      .getCollection(cleanHandle, slug)
      .then((res) => {
        if (ac.signal.aborted) return
        setError(null)
        setCollection(res.collection)
        setItems(res.items)
        setLoadedKey(routeKey)
      })
      .catch((e) => {
        if (ac.signal.aborted) return
        setError((e as Error).message)
        setLoadedKey(routeKey)
      })
    return () => ac.abort()
  }, [cleanHandle, slug, routeKey, reloadTick])

  const remove = async (projectId: string) => {
    try {
      await hubApi.removeCollectionItem(cleanHandle, slug, projectId)
      notify.success(t("已从合集移除", "Removed from collection"))
      setReloadTick((n) => n + 1)
    } catch (e) {
      notify.error((e as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <Spinner className="size-5" label={t("正在加载项目合集", "Loading collection")} />
      </div>
    )
  }

  if (error || !collection) {
    return (
      <StateView
        kind="error"
        title={t("找不到这个项目合集", "Collection not found")}
        description={error ?? ""}
        action={
          <Button asChild size="sm" variant="secondary">
            <Link to="/community">{t("返回社区", "Back to Community")}</Link>
          </Button>
        }
      />
    )
  }

  const isOwner = auth.user?.id === collection.ownerId

  return (
    <Page width="wide" className="mx-auto">
      <PageHeader
        back={
          <IconButton asChild label={t("返回社区", "Back to Community")}>
            <Link to="/community">
              <ArrowLeft />
            </Link>
          </IconButton>
        }
        title={collectionTitle(collection)}
        info={t("项目合集可以收录自己或他人的开源作品，支持锁定指定版本或持续追踪最新更新。", "Collections group your own or other creators' open-source works, either pinned to a version or tracking latest.")}
        actions={
          <Link to={`/community/@${collection.ownerHandle}`} className="text-small text-muted-foreground hover:underline">
            @{collection.ownerHandle}
          </Link>
        }
      />

      {collection.description && <p className="mb-6 max-w-2xl text-body text-muted-foreground">{collection.description}</p>}

      {items.length === 0 ? (
        <StateView
          kind="empty"
          title={t("这个合集还没有收录作品", "No projects in this collection yet")}
          description={t("在任意社区作品页点击顶栏「收入合集」按钮即可添加到这里。", "Open any community project and click Add to collection in the top bar.")}
          action={
            <Button asChild size="sm" variant="secondary">
              <Link to="/community">{t("去浏览作品", "Browse projects")}</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {items.map((item, idx) => {
            const p = item.project
            const targetUrl = item.pinnedVersion
              ? `/community/@${p.ownerHandle}/${p.slug}/v/${item.pinnedVersion}`
              : `/community/@${p.ownerHandle}/${p.slug}`
            return (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border p-4">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm bg-muted font-mono text-caption text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={targetUrl} className="inline-flex items-center gap-1 text-heading font-semibold hover:underline">
                      <FolderKanban className="size-4 text-primary" />
                      {projectTitle(p)}
                      <ArrowUpRight className="size-3.5 text-muted-foreground" />
                    </Link>
                    <span className="text-small text-muted-foreground">@{p.ownerHandle}</span>
                    <Badge tone="neutral">
                      {item.pinnedVersion ? t(`锁定 v${item.pinnedVersion}`, `Pinned v${item.pinnedVersion}`) : t(`追踪最新 v${p.latestVersion}`, `Latest v${p.latestVersion}`)}
                    </Badge>
                    {item.hasNewerVersion && (
                      <Badge tone="warning">
                        {t(`上游已更新至 v${p.latestVersion}`, `Upstream v${p.latestVersion} available`)}
                      </Badge>
                    )}
                    <Badge tone="outline">{p.license}</Badge>
                  </div>
                  {item.note && <p className="text-small text-foreground">{item.note}</p>}
                  {projectSummary(p) && <p className="text-small text-muted-foreground">{projectSummary(p)}</p>}
                </div>
                {isOwner && (
                  <IconButton label={t("从合集移除", "Remove from collection")} size="icon-sm" className="text-muted-foreground" onClick={() => void remove(p.id)}>
                    <Trash2 />
                  </IconButton>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Page>
  )
}
