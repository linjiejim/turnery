// Publish a new project or push a continuous version update directly from Web Studio to Community Hub.
import * as React from "react"
import { Link } from "react-router"
import { CheckCircle2, ExternalLink, GitBranch, UploadCloud } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Callout } from "@/components/ui/callout"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog"
import { Field, FieldGroup } from "@/components/ui/field"
import { Input, Textarea } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { notify } from "@/components/ui/toast"
import { t } from "@/lib/i18n"
import type { CheckResult } from "@/studio/kernel/check"
import { projectToBundleFiles, type WebProject } from "@/studio/project-store"
import { CATEGORIES, OPEN_LICENSES, bumpSemver, slugify, type OpenLicense, type ProjectCategory } from "../package"
import { categoryLabel, hubApi, projectTitle, useHubAuth, type HubProject } from "../api"
import { AuthDialog } from "./auth-dialog"

export function PublishDialog({
  open,
  onOpenChange,
  project,
  checks,
  capturePreview,
  forkedFrom,
  onPublished,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project: WebProject
  checks?: CheckResult[]
  capturePreview: () => Promise<string | null>
  forkedFrom?: { handle: string; slug: string; version?: string } | null
  onPublished?: (published: { handle: string; slug: string; version: string }) => void
}) {
  const auth = useHubAuth()
  const [authOpen, setAuthOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"new" | "update">(project.communityRef ? "update" : "new")
  const [myProjects, setMyProjects] = React.useState<HubProject[]>([])
  const [targetSlug, setTargetSlug] = React.useState(project.communityRef?.slug ?? "")

  const [titleZh, setTitleZh] = React.useState(project.name)
  const [titleEn, setTitleEn] = React.useState("")
  const [summaryZh, setSummaryZh] = React.useState("")
  const [slug, setSlug] = React.useState(slugify(project.name))
  const [license, setLicense] = React.useState<OpenLicense>("CERN-OHL-P-2.0")
  const [category, setCategory] = React.useState<ProjectCategory>("enclosure")
  const [tagsRaw, setTagsRaw] = React.useState("")
  const [version, setVersion] = React.useState("1.0.0")
  const [changelog, setChangelog] = React.useState("")
  const [repoUrl, setRepoUrl] = React.useState("")
  const [preview, setPreview] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState<{ handle: string; slug: string; version: string } | null>(null)

  const fileCount = Object.keys(project.files).length
  const validChecks = (checks ?? []).filter((c) => !c.invalid)
  const passedChecks = validChecks.filter((c) => c.pass).length

  const [prevOpen, setPrevOpen] = React.useState(false)
  if (open && !prevOpen) {
    setPrevOpen(true)
    setError(null)
    setDone(null)
    setTitleZh(project.name)
    setSlug(slugify(project.name))
    setChangelog("")
  } else if (!open && prevOpen) {
    setPrevOpen(false)
  }

  React.useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    void capturePreview().then((img) => {
      if (!ac.signal.aborted) setPreview(img)
    })
    return () => ac.abort()
  }, [open, capturePreview])

  React.useEffect(() => {
    if (!open || !auth.user) return
    void hubApi
      .listProjects({ author: auth.user.handle, limit: 60 })
      .then((res) => {
        setMyProjects(res.items)
        if (project.communityRef && res.items.some((p) => p.slug === project.communityRef?.slug)) {
          setMode("update")
          setTargetSlug(project.communityRef.slug)
          const matched = res.items.find((p) => p.slug === project.communityRef?.slug)
          if (matched) setVersion(bumpSemver(matched.latestVersion, "patch"))
        } else if (res.items.length && !targetSlug) {
          setTargetSlug(res.items[0].slug)
        }
      })
      .catch(() => {})
  }, [open, auth.user, project.communityRef, targetSlug])

  const selectedOwned = myProjects.find((p) => p.slug === targetSlug)

  const submit = async () => {
    if (!auth.user) return setAuthOpen(true)
    setError(null)
    setPending(true)
    try {
      const files = projectToBundleFiles(project)
      const checksPayload = validChecks.length
        ? {
            verifiedBy: "client" as const,
            items: validChecks.map((c) => ({
              id: c.id,
              said: c.said,
              pass: c.pass,
              expected: c.expected,
              actual: c.actual,
            })),
          }
        : undefined

      if (mode === "update" && selectedOwned) {
        const res = await hubApi.publishRelease(auth.user.handle, selectedOwned.slug, {
          version: version.trim() || bumpSemver(selectedOwned.latestVersion, "patch"),
          changelog: changelog.trim(),
          entry: project.activeFile,
          files,
          previewDataUrl: preview,
          checks: checksPayload,
        })
        const info = { handle: res.project.ownerHandle, slug: res.project.slug, version: res.release.version }
        setDone(info)
        onPublished?.(info)
        notify.success(t(`已发布新版本 v${info.version}`, `Published v${info.version}`))
      } else {
        const tags = tagsRaw
          .split(/[,，\s]+/)
          .map((s) => s.trim())
          .filter(Boolean)
        const res = await hubApi.publishProject({
          titleZh: titleZh.trim(),
          titleEn: titleEn.trim() || titleZh.trim(),
          summaryZh: summaryZh.trim(),
          summaryEn: summaryZh.trim(),
          slug: slug.trim().toLowerCase(),
          license,
          category,
          tags,
          version: version.trim() || "1.0.0",
          changelog: changelog.trim() || "Initial release",
          repoUrl: repoUrl.trim() || undefined,
          forkedFrom: forkedFrom ?? undefined,
          entry: project.activeFile,
          files,
          previewDataUrl: preview,
          checks: checksPayload,
        })
        const info = { handle: res.project.ownerHandle, slug: res.project.slug, version: res.release.version }
        setDone(info)
        onPublished?.(info)
        notify.success(t(`作品已发布到社区（v${info.version}）`, `Published to Community (v${info.version})`))
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="lg">
          <DialogHeader
            title={done ? t("已发布到社区", "Published to Community") : t("发布到开源社区", "Publish to Community")}
            description={
              done
                ? t("所有人现在都能在线预览、调参、查看特征树并基于开源协议 Remix。", "Everyone can now inspect it in 3D, tweak parameters and remix under its open license.")
                : t("将当前项目以开放包格式（turnery.json + 特征树/装配/STEP）公开，支持后续持续推送版本更新。", "Publish this project in the open Turnery format with versioned releases and automatic feature-tree diffs.")
            }
          />
          <DialogBody className="max-h-[70dvh] space-y-4 overflow-y-auto">
            {!auth.user && !auth.loading ? (
              <div className="space-y-3 rounded-md border bg-sunken p-4">
                <p className="text-body">{t("发布开源作品和持续推送版本需要先登录社区账号。", "Sign in to publish projects and push version updates.")}</p>
                <Button variant="primary" onClick={() => setAuthOpen(true)}>
                  {t("登录社区账号", "Sign in")}
                </Button>
              </div>
            ) : done ? (
              <div className="space-y-3 rounded-md border bg-sunken p-4">
                <div className="flex items-center gap-2 text-heading font-semibold text-success">
                  <CheckCircle2 className="size-5" />
                  <span>
                    @{done.handle}/{done.slug} · v{done.version}
                  </span>
                </div>
                <p className="text-small text-muted-foreground">
                  {t("后续修改后可以再次点击「发布」推送 vNext 更新，系统会自动生成特征树变更摘要。", "Whenever you update the model, click Publish again to push a new version with an automatic feature-tree diff.")}
                </p>
                <div className="flex items-center gap-2">
                  <Button asChild variant="primary" size="sm">
                    <Link to={`/community/@${done.handle}/${done.slug}`} onClick={() => onOpenChange(false)}>
                      <ExternalLink />
                      {t("打开作品页", "View project page")}
                    </Link>
                  </Button>
                  <Button asChild variant="secondary" size="sm">
                    <Link to="/community" onClick={() => onOpenChange(false)}>
                      {t("浏览社区", "Explore community")}
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-md border bg-sunken p-3">
                  <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-sm border bg-background">
                    {preview ? (
                      <img src={preview} alt="" className="size-full object-contain" />
                    ) : (
                      <UploadCloud className="size-6 text-faint-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1 text-small">
                    <div className="font-medium truncate">
                      {t(`入口：${project.activeFile}`, `Entry: ${project.activeFile}`)}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
                      <Badge tone="neutral">{t(`${fileCount} 个文件`, `${fileCount} files`)}</Badge>
                      {validChecks.length > 0 && (
                        <Badge tone={passedChecks === validChecks.length ? "success" : "warning"}>
                          {t(`核对 ${passedChecks}/${validChecks.length}`, `Checks ${passedChecks}/${validChecks.length}`)}
                        </Badge>
                      )}
                      {forkedFrom && (
                        <Badge tone="info">
                          <GitBranch />
                          Remix @{forkedFrom.handle}/{forkedFrom.slug}
                        </Badge>
                      )}
                    </div>
                    <div className="text-caption text-faint-foreground">
                      {t("个人批注（.notes.json）和本地密钥不会被上传。", "Personal notes (.notes.json) and local API keys are never uploaded.")}
                    </div>
                  </div>
                </div>

                {myProjects.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={mode === "new" ? "primary" : "secondary"} onClick={() => { setMode("new"); setVersion("1.0.0") }}>
                      {t("发布为新作品", "Publish as new project")}
                    </Button>
                    <Button
                      size="sm"
                      variant={mode === "update" ? "primary" : "secondary"}
                      onClick={() => {
                        setMode("update")
                        const cur = myProjects.find((p) => p.slug === targetSlug) ?? myProjects[0]
                        if (cur) {
                          setTargetSlug(cur.slug)
                          setVersion(bumpSemver(cur.latestVersion, "patch"))
                        }
                      }}
                    >
                      {t("更新已有作品（发布新版本）", "Update existing project")}
                    </Button>
                  </div>
                )}

                {mode === "update" && myProjects.length > 0 ? (
                  <FieldGroup>
                    <Field label={t("选择要更新的作品", "Target project")} required>
                      <Select
                        value={targetSlug}
                        onValueChange={(v) => {
                          setTargetSlug(v)
                          const cur = myProjects.find((p) => p.slug === v)
                          if (cur) setVersion(bumpSemver(cur.latestVersion, "patch"))
                        }}
                        options={myProjects.map((p) => ({ value: p.slug, label: `${projectTitle(p)} (v${p.latestVersion})` }))}
                      />
                    </Field>
                    <Field label={t("新版本号（SemVer）", "New version (SemVer)")} required hint={selectedOwned ? t(`当前最新：v${selectedOwned.latestVersion}`, `Current latest: v${selectedOwned.latestVersion}`) : undefined}>
                      <Input value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono" placeholder="1.0.1" />
                    </Field>
                    <Field label={t("更新说明（Changelog）", "Changelog")} hint={t("系统还会自动附带特征树与参数变更摘要", "An automatic feature-tree diff will also be generated")}>
                      <Textarea value={changelog} onChange={(e) => setChangelog(e.target.value)} rows={3} placeholder={t("例如：加大 USB-C 开口公差，壁厚默认调整为 2.5 mm", "e.g. Widened USB-C clearance and adjusted default wall to 2.5 mm")} />
                    </Field>
                  </FieldGroup>
                ) : (
                  <FieldGroup>
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      <Field label={t("作品标题", "Title")} required>
                        <Input value={titleZh} onChange={(e) => setTitleZh(e.target.value)} placeholder={t("例如：温湿度传感器外壳", "e.g. Sensor Enclosure")} />
                      </Field>
                      <Field label={t("英文标题（可选）", "English title (optional)")}>
                        <Input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder="Sensor Enclosure" />
                      </Field>
                    </div>
                    <Field label={t("一句话简介", "Summary")}>
                      <Textarea value={summaryZh} onChange={(e) => setSummaryZh(e.target.value)} rows={2} placeholder={t("说明用途、适配硬件、打印或加工建议…", "Describe what it's for, compatible hardware, print/machining tips…")} />
                    </Field>
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      <Field label={t("项目标识（slug）", "Slug")} required hint={auth.user ? `/community/@${auth.user.handle}/${slug || "..."}` : undefined}>
                        <Input value={slug} onChange={(e) => setSlug(e.target.value)} className="font-mono" />
                      </Field>
                      <Field label={t("初始版本", "Initial version")} required>
                        <Input value={version} onChange={(e) => setVersion(e.target.value)} className="font-mono" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      <Field label={t("开源协议", "Open license")} required>
                        <Select
                          value={license}
                          onValueChange={(v) => setLicense(v as OpenLicense)}
                          options={OPEN_LICENSES.map((l) => ({ value: l, label: l }))}
                        />
                      </Field>
                      <Field label={t("分类", "Category")} required>
                        <Select
                          value={category}
                          onValueChange={(v) => setCategory(v as ProjectCategory)}
                          options={CATEGORIES.map((c) => ({ value: c, label: categoryLabel(c) }))}
                        />
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                      <Field label={t("标签（空格或逗号分隔）", "Tags (comma or space separated)")}>
                        <Input value={tagsRaw} onChange={(e) => setTagsRaw(e.target.value)} placeholder="3d-print, esp32, m3" />
                      </Field>
                      <Field label={t("GitHub 仓库地址（可选）", "GitHub repository (optional)")}>
                        <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/..." />
                      </Field>
                    </div>
                  </FieldGroup>
                )}

                {error && <Callout tone="danger">{error}</Callout>}
              </>
            )}
          </DialogBody>
          <DialogFooter>
            {done ? (
              <Button onClick={() => onOpenChange(false)}>{t("关闭", "Close")}</Button>
            ) : auth.user ? (
              <Button variant="primary" loading={pending} disabled={mode === "new" ? !titleZh.trim() || !slug.trim() : !selectedOwned} onClick={() => void submit()}>
                <UploadCloud />
                {mode === "update" ? t(`发布 v${version}`, `Publish v${version}`) : t("公开发布到社区", "Publish to Community")}
              </Button>
            ) : (
              <Button onClick={() => onOpenChange(false)}>{t("取消", "Cancel")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} auth={auth.auth} onSignedIn={() => void auth.refresh()} returnTo="/studio" />
    </>
  )
}
