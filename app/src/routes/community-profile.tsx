// /community/@:handle — Creator profile page: published works, curated collections,
// and (for the signed-in owner) Personal API Token management for CLI & GitHub Actions.
import * as React from "react"
import { Link, useNavigate, useParams } from "react-router"
import { ArrowLeft, FolderKanban, KeyRound, LogOut, Plus, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button, IconButton } from "@/components/ui/button"
import { Callout } from "@/components/ui/callout"
import { CopyButton } from "@/components/ui/copy-button"
import { Input } from "@/components/ui/input"
import { Page, PageHeader } from "@/components/ui/page"
import { Spinner } from "@/components/ui/spinner"
import { StateView } from "@/components/ui/state"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import {
  collectionTitle,
  hubApi,
  useHubAuth,
  type HubCollection,
  type HubProject,
  type HubTokenRow,
  type HubUser,
} from "@/hub/api"
import { ProjectCard } from "./community"

export function CommunityProfilePage() {
  const { handle = "" } = useParams()
  const cleanHandle = handle.replace(/^@/, "")
  const navigate = useNavigate()
  const auth = useHubAuth()

  const [user, setUser] = React.useState<HubUser | null>(null)
  const [projects, setProjects] = React.useState<HubProject[]>([])
  const [collections, setCollections] = React.useState<HubCollection[]>([])
  const [loadedHandle, setLoadedHandle] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const loading = loadedHandle !== cleanHandle && error === null

  const [tokens, setTokens] = React.useState<HubTokenRow[]>([])
  const [tokenName, setTokenName] = React.useState("")
  const [freshToken, setFreshToken] = React.useState<string | null>(null)

  const isMe = auth.user?.handle.toLowerCase() === cleanHandle.toLowerCase()

  React.useEffect(() => {
    const ac = new AbortController()
    void hubApi
      .userProfile(cleanHandle)
      .then((res) => {
        if (ac.signal.aborted) return
        setError(null)
        setUser(res.user)
        setProjects(res.projects)
        setCollections(res.collections)
        setLoadedHandle(cleanHandle)
      })
      .catch((e) => {
        if (ac.signal.aborted) return
        setError((e as Error).message)
        setLoadedHandle(cleanHandle)
      })
    return () => ac.abort()
  }, [cleanHandle])

  React.useEffect(() => {
    if (!isMe) return
    void hubApi.listTokens().then((res) => setTokens(res.tokens)).catch(() => {})
  }, [isMe])

  const createToken = async () => {
    try {
      const created = await hubApi.createToken(tokenName.trim() || "CLI / GitHub Action")
      setFreshToken(created.token)
      setTokenName("")
      const list = await hubApi.listTokens()
      setTokens(list.tokens)
      notify.success(t("已生成 API 令牌", "API token created"))
    } catch (e) {
      notify.error((e as Error).message)
    }
  }

  const revokeToken = async (id: string) => {
    try {
      await hubApi.revokeToken(id)
      setTokens((prev) => prev.filter((x) => x.id !== id))
      notify.success(t("已吊销令牌", "Token revoked"))
    } catch (e) {
      notify.error((e as Error).message)
    }
  }

  const logout = async () => {
    await hubApi.logout()
    await auth.refresh()
    notify.success(t("已退出登录", "Signed out"))
    navigate("/community")
  }

  if (loading) {
    return (
      <div className="grid min-h-[60dvh] place-items-center">
        <Spinner className="size-5" label={t("正在加载创作者主页", "Loading creator profile")} />
      </div>
    )
  }

  if (error || !user) {
    return (
      <StateView
        kind="error"
        title={t("找不到这位创作者", "Creator not found")}
        description={error ?? ""}
        action={
          <Button asChild size="sm" variant="secondary">
            <Link to="/community">{t("返回社区", "Back to Community")}</Link>
          </Button>
        }
      />
    )
  }

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
        title={`${user.displayName} (@${user.handle})`}
        actions={
          isMe && (
            <Button size="sm" variant="secondary" onClick={() => void logout()}>
              <LogOut />
              {t("退出登录", "Sign out")}
            </Button>
          )
        }
      />
      {user.bio && <p className="mb-5 text-body text-muted-foreground">{user.bio}</p>}

      <Tabs defaultValue="projects">
        <TabsList className="mb-4">
          <TabsTrigger value="projects">{t(`作品 (${projects.length})`, `Projects (${projects.length})`)}</TabsTrigger>
          <TabsTrigger value="collections">{t(`项目合集 (${collections.length})`, `Collections (${collections.length})`)}</TabsTrigger>
          {isMe && (
            <TabsTrigger value="tokens">
              <KeyRound className="mr-1 size-3.5" />
              {t("CLI / CI 令牌", "API Tokens")}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="projects">
          {projects.length === 0 ? (
            <StateView kind="empty" title={t("还没有公开发布的作品", "No published projects yet")} />
          ) : (
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="collections">
          {collections.length === 0 ? (
            <StateView kind="empty" title={t("还没有项目合集", "No collections yet")} />
          ) : (
            <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-2 max-sm:grid-cols-1">
              {collections.map((c) => (
                <Link
                  key={c.id}
                  to={`/community/@${c.ownerHandle}/c/${c.slug}`}
                  className="flex flex-col gap-2 rounded-lg border p-4 transition-colors duration-(--duration-fast) hover:border-input hover:bg-accent"
                >
                  <div className="flex items-center gap-2">
                    <FolderKanban className="size-4 text-primary" />
                    <span className="truncate text-heading font-semibold">{collectionTitle(c)}</span>
                    <Badge tone="neutral" className="ml-auto">
                      {t(`${c.itemCount} 项`, `${c.itemCount}`)}
                    </Badge>
                  </div>
                  {c.description && <p className="line-clamp-2 text-small text-muted-foreground">{c.description}</p>}
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {isMe && (
          <TabsContent value="tokens" className="max-w-2xl space-y-4">
            <p className="text-small text-muted-foreground">
              {t(
                "签发 Personal API Token（Authorization: Bearer trn_…）用于 CLI 或 GitHub Actions 自动推送作品新版本。令牌明文仅展示一次。",
                "Issue Personal API Tokens (Authorization: Bearer trn_…) for CLI or GitHub Actions automated releases. Plaintext is shown once.",
              )}
            </p>
            <div className="flex gap-2">
              <Input
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
                placeholder={t("令牌备注（如 GitHub Actions）", "Token name (e.g. GitHub Actions)")}
              />
              <Button variant="primary" onClick={() => void createToken()}>
                <Plus />
                {t("生成令牌", "Create token")}
              </Button>
            </div>
            {freshToken && (
              <Callout tone="info">
                <div className="space-y-2">
                  <div className="font-medium">{t("请立即复制保存，关闭后将不再显示明文：", "Copy and store this token now; it won’t be shown again:")}</div>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={freshToken} className="font-mono text-small" />
                    <CopyButton value={freshToken} label={t("复制令牌", "Copy token")} />
                  </div>
                </div>
              </Callout>
            )}
            <div className="divide-y rounded-md border">
              {tokens.length === 0 ? (
                <div className="p-3 text-small text-muted-foreground">{t("尚未创建任何令牌", "No tokens yet")}</div>
              ) : (
                tokens.map((tok) => (
                  <div key={tok.id} className="flex items-center justify-between gap-2 px-3 py-2 text-small">
                    <div>
                      <div className="font-medium">{tok.name}</div>
                      <div className="font-mono text-caption text-faint-foreground">
                        {tok.prefix}… · {new Date(tok.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <IconButton label={t("吊销令牌", "Revoke token")} size="icon-sm" className="text-destructive" onClick={() => void revokeToken(tok.id)}>
                      <Trash2 />
                    </IconButton>
                  </div>
                ))
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </Page>
  )
}
