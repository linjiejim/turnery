// Sign-in dialog supporting GitHub OAuth 2.0 and optional local/self-hosted handle sign-in.
import * as React from "react"
import { GithubMark } from "@/components/github-mark"
import { Button } from "@/components/ui/button"
import { Callout } from "@/components/ui/callout"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import { hubApi, type HubAuthState } from "../api"

export function AuthDialog({
  open,
  onOpenChange,
  auth,
  onSignedIn,
  returnTo = "/community",
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  auth: HubAuthState["auth"]
  onSignedIn: () => void
  returnTo?: string
}) {
  const [handle, setHandle] = React.useState("")
  const [displayName, setDisplayName] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submitLocal = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      await hubApi.localLogin({ handle: handle.trim().toLowerCase(), displayName: displayName.trim() || undefined })
      notify.success(t("已登录社区账号", "Signed in to Community"))
      onSignedIn()
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader
          title={t("登录 Turnery 社区", "Sign in to Turnery Community")}
          description={t("登录后可发布开源作品、推送版本更新、收藏并创建项目合集。", "Sign in to publish open-source works, push version updates, star projects and curate collections.")}
        />
        <DialogBody className="space-y-4">
          {auth.github && (
            <Button asChild variant="primary" className="w-full">
              <a href={`/api/hub/auth/github?returnTo=${encodeURIComponent(returnTo)}`}>
                <GithubMark className="size-4" />
                {t("使用 GitHub 登录", "Continue with GitHub")}
              </a>
            </Button>
          )}

          {auth.local && (
            <form id="hub-local-login" onSubmit={(e) => void submitLocal(e)} className="space-y-3">
              {auth.github && (
                <div className="flex items-center gap-2 text-caption text-faint-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>{t("或本地 / 自托管账号", "Or local / self-hosted handle")}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <FieldGroup>
                <Field label={t("用户名（handle）", "Handle")} required hint={t("2–39 位小写字母、数字或连字符，将显示为 @handle", "2–39 lowercase letters, digits or hyphens, shown as @handle")}>
                  <Input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="alice-cad" autoComplete="username" />
                </Field>
                <Field label={t("显示名称", "Display name")} hint={t("可选", "Optional")}>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("例如：林工", "e.g. Alice")} />
                </Field>
              </FieldGroup>
            </form>
          )}

          {!auth.github && !auth.local && (
            <Callout tone="warning">
              {t("当前服务器尚未配置社区登录方式（需配置 GITHUB_CLIENT_ID 或开启 HUB_LOCAL_AUTH=1）。", "No authentication method is configured on this server (set GITHUB_CLIENT_ID or HUB_LOCAL_AUTH=1).")}
            </Callout>
          )}

          {error && <Callout tone="danger">{error}</Callout>}
        </DialogBody>
        {auth.local && (
          <DialogFooter>
            <Button type="submit" form="hub-local-login" variant="primary" loading={pending} disabled={!handle.trim()}>
              {t("登录并继续", "Sign in")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
