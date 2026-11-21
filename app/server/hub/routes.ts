// Turnery Community Hub REST API (mounted on the Hono server).
// Open-source, self-hostable, backed by SQLite + FTS5 + SHA-256 content-addressed BlobStore.
import crypto from "node:crypto"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"
import { Tree } from "../../src/studio/dsl"
import {
  CATEGORIES,
  HANDLE_RE,
  HUB_LIMITS,
  OPEN_LICENSES,
  SEMVER_RE,
  SLUG_RE,
  bumpSemver,
  computeReleaseDiff,
  decodeBase64,
  encodeBase64,
  scanSecrets,
  slugify,
  validateProjectFiles,
  type BundleFileInput,
  type OpenLicense,
  type ProjectCategory,
} from "../../src/hub/package"
import { clientIp, RateLimiter } from "../limits"
import { HubAuth } from "./auth"
import { SHA256_RE, type BlobStore } from "./blobs"
import type { HubRelease, HubStore, StoredFileMeta } from "./db"

const ALLOWED_IMAGE_MIMES = new Set(["image/png", "image/webp", "image/jpeg"])
const MAX_PUBLISH_BODY = 28 * 1024 * 1024

export type HubRouteOptions = {
  store: HubStore
  blobs: BlobStore
  auth: HubAuth
  webhookSecret?: string
  limiters?: { write: RateLimiter; read: RateLimiter }
}

export function hubRoutes(opts: HubRouteOptions) {
  const { store, blobs, auth } = opts
  const limits = opts.limiters ?? {
    write: new RateLimiter(60, 3600_000),
    read: new RateLimiter(600, 3600_000),
  }
  const app = new Hono()

  const tooFast = (wait: number) => ({ error: "rate-limit", message: `操作太频繁了，${Math.max(1, Math.ceil(wait / 60))} 分钟后再试。` })

  // ------------------------------------------------------------------ auth

  app.get("/api/hub/me", (c) => {
    const user = auth.resolveUser(c, store)
    return c.json({
      user,
      auth: {
        github: auth.githubEnabled,
        local: auth.localAuthEnabled,
      },
    })
  })

  app.get("/api/hub/auth/github", (c) => {
    const returnTo = c.req.query("returnTo") ?? "/community"
    const url = auth.startGithubOAuth(c, returnTo)
    if (!url) return c.json({ error: "not-configured", message: "服务器尚未配置 GitHub OAuth" }, 503)
    return c.redirect(url)
  })

  app.get("/api/hub/auth/github/callback", async (c) => {
    const res = await auth.finishGithubOAuth(c, store)
    if (!res.ok) return c.json({ error: "auth-failed", message: res.message }, 400)
    return c.redirect(res.returnTo)
  })

  app.post("/api/hub/auth/local", async (c) => {
    if (!auth.localAuthEnabled) {
      return c.json({ error: "disabled", message: "本地账号登录未开启，请使用 GitHub 登录" }, 403)
    }
    const ip = clientIp((h) => c.req.header(h))
    const wait = limits.write.take(ip)
    if (wait) return c.json(tooFast(wait), 429)
    const body = (await c.req.json().catch(() => null)) as { handle?: unknown; displayName?: unknown; bio?: unknown } | null
    const rawHandle = typeof body?.handle === "string" ? body.handle.trim().toLowerCase() : ""
    if (!HANDLE_RE.test(rawHandle)) {
      return c.json({ error: "bad-handle", message: "用户名需为 2–39 位小写字母、数字或连字符（如 alice-cad）" }, 400)
    }
    const displayName = typeof body?.displayName === "string" && body.displayName.trim() ? body.displayName.trim().slice(0, 60) : rawHandle
    const bio = typeof body?.bio === "string" ? body.bio.trim().slice(0, 200) : ""
    const user = store.upsertUser({ handle: rawHandle, displayName, bio })
    auth.setSession(c, user.id)
    return c.json({ user })
  })

  app.post("/api/hub/auth/logout", (c) => {
    auth.clearSession(c)
    return c.json({ ok: true })
  })

  // ------------------------------------------------------------------ personal API tokens (for CLI & GitHub Actions)

  app.get("/api/hub/tokens", (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    return c.json({ tokens: store.listApiTokens(user.id) })
  })

  app.post("/api/hub/tokens", async (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const body = (await c.req.json().catch(() => null)) as { name?: unknown } | null
    const name = typeof body?.name === "string" ? body.name.trim() : "CLI / GitHub Action"
    const created = store.createApiToken(user.id, name)
    return c.json(created, 201)
  })

  app.delete("/api/hub/tokens/:id", (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const ok = store.revokeApiToken(user.id, c.req.param("id"))
    if (!ok) return c.json({ error: "not-found", message: "令牌不存在" }, 404)
    return c.json({ ok: true })
  })

  // ------------------------------------------------------------------ users

  app.get("/api/hub/users/:handle", (c) => {
    const viewer = auth.resolveUser(c, store)
    const user = store.getUserByHandle(c.req.param("handle"))
    if (!user) return c.json({ error: "not-found", message: "找不到这个创作者" }, 404)
    const projects = store.searchProjects({ author: user.handle, limit: 60, viewerId: viewer?.id })
    const collections = store.listCollections({ author: user.handle, limit: 60 })
    return c.json({ user, projects: projects.items, collections: collections.items })
  })

  // ------------------------------------------------------------------ projects list & publish

  app.get("/api/hub/projects", (c) => {
    const viewer = auth.resolveUser(c, store)
    const q = c.req.query("q")
    const category = c.req.query("category")
    const tag = c.req.query("tag")
    const license = c.req.query("license")
    const kindRaw = c.req.query("kind")
    const kind = kindRaw === "part" || kindRaw === "assembly" ? kindRaw : undefined
    const verified = c.req.query("verified") === "1" || c.req.query("verified") === "true"
    const author = c.req.query("author")
    const sortRaw = c.req.query("sort")
    const sort = sortRaw === "stars" || sortRaw === "newest" || sortRaw === "downloads" ? sortRaw : "updated"
    const limit = Number(c.req.query("limit") ?? 24)
    const offset = Number(c.req.query("offset") ?? 0)
    const result = store.searchProjects({ q, category, tag, license, kind, verified, author, sort, limit, offset, viewerId: viewer?.id })
    return c.json(result)
  })

  app.post(
    "/api/hub/projects",
    bodyLimit({ maxSize: MAX_PUBLISH_BODY, onError: (c) => c.json({ error: "too-large", message: "项目包太大，超过上传上限" }, 413) }),
    async (c) => {
      const ip = clientIp((h) => c.req.header(h))
      const wait = limits.write.take(ip)
      if (wait) return c.json(tooFast(wait), 429)
      const user = auth.resolveUser(c, store)
      if (!user) return c.json({ error: "unauthorized", message: "请先登录后再发布作品" }, 401)

      const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
      if (!body) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)

      const titleZh = str(body.titleZh ?? body.title, HUB_LIMITS.maxTitle)
      const titleEn = str(body.titleEn ?? body.title ?? body.titleZh, HUB_LIMITS.maxTitle)
      if (!titleZh && !titleEn) return c.json({ error: "bad-request", message: "请填写作品标题" }, 400)
      const summaryZh = str(body.summaryZh ?? body.summary, HUB_LIMITS.maxSummary)
      const summaryEn = str(body.summaryEn ?? body.summary ?? body.summaryZh, HUB_LIMITS.maxSummary)
      if (scanSecrets(`${titleZh}\n${titleEn}\n${summaryZh}\n${summaryEn}`)) {
        return c.json({ error: "secret", message: "标题或简介中疑似包含密钥，已拒绝发布" }, 400)
      }

      const rawSlug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim().toLowerCase() : slugify(titleEn || titleZh)
      if (!SLUG_RE.test(rawSlug)) return c.json({ error: "bad-slug", message: "项目标识只能用小写字母、数字和连字符" }, 400)
      if (store.getProjectByHandleSlug(user.handle, rawSlug)) {
        return c.json({ error: "conflict", message: `你已经发布过「${rawSlug}」，请直接推送新版本或换一个标识` }, 409)
      }

      const license = OPEN_LICENSES.includes(body.license as OpenLicense) ? (body.license as OpenLicense) : "CERN-OHL-P-2.0"
      const category = CATEGORIES.includes(body.category as ProjectCategory) ? (body.category as ProjectCategory) : "other"
      const tags = parseTags(body.tags)
      const version = typeof body.version === "string" && SEMVER_RE.test(body.version.trim()) ? body.version.trim() : "1.0.0"
      const changelog = str(body.changelog, HUB_LIMITS.maxChangelog) || "Initial release"
      const repoUrl = parseHttpsUrl(body.repoUrl)
      if (body.repoUrl && !repoUrl) return c.json({ error: "bad-request", message: "仓库地址需使用 https:// 开头" }, 400)
      const forkedFrom = parseForkRef(body.forkedFrom)
      const visibility = body.visibility === "unlisted" ? "unlisted" : "public"

      const entryRaw = typeof body.entry === "string" ? body.entry : ""
      const validated = validateProjectFiles(body.files as BundleFileInput[], entryRaw)
      if (!validated.ok) return c.json({ error: validated.status === 413 ? "too-large" : "bad-request", message: validated.message }, validated.status)

      const preview = await storePreviewImage(blobs, body.previewDataUrl)
      if (preview && "error" in preview) return c.json({ error: "bad-preview", message: preview.error }, 400)

      const storedFiles: StoredFileMeta[] = []
      for (const f of validated.files) {
        const put = await blobs.put(f.bytes)
        storedFiles.push({ path: f.path, sha256: put.sha256, size: put.size, mime: f.mime, kind: f.kind })
      }

      const checks = parseChecksSummary(body.checks, validated.checksTotal)
      const manifest = {
        schema: 1,
        name: rawSlug,
        title: { zh: titleZh || titleEn, en: titleEn || titleZh },
        summary: { zh: summaryZh, en: summaryEn },
        version,
        license,
        entry: validated.entry,
        category,
        tags,
        ...(repoUrl ? { repository: repoUrl } : {}),
        ...(forkedFrom ? { forkedFrom } : {}),
      }

      const created = store.createProjectWithRelease({
        ownerId: user.id,
        slug: rawSlug,
        titleZh: titleZh || titleEn,
        titleEn: titleEn || titleZh,
        summaryZh,
        summaryEn,
        license,
        category,
        kind: validated.kind,
        tags,
        repoUrl,
        forkedFrom,
        visibility,
        version,
        changelog,
        entry: validated.entry,
        manifest,
        files: storedFiles,
        checksPassed: checks.passed,
        checksTotal: checks.total,
        checksDetail: checks.detail,
        verifiedBy: checks.verifiedBy,
        previewBlob: preview?.sha256 ?? null,
        previewMime: preview?.mime ?? null,
        totalBytes: validated.totalBytes,
        partCount: validated.partCount,
        featureCount: validated.featureCount,
        paramCount: validated.paramCount,
      })

      return c.json(created, 201)
    },
  )

  // ------------------------------------------------------------------ single project & continuous version updates

  app.get("/api/hub/projects/:handle/:slug", (c) => {
    const viewer = auth.resolveUser(c, store)
    const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"), viewer?.id)
    if (!project) return c.json({ error: "not-found", message: "作品不存在或已归档" }, 404)
    const releases = store.listReleases(project.id)
    return c.json({ project, releases })
  })

  app.patch("/api/hub/projects/:handle/:slug", async (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!project) return c.json({ error: "not-found", message: "作品不存在" }, 404)
    if (project.ownerId !== user.id) return c.json({ error: "forbidden", message: "只有作者本人可以编辑这个作品" }, 403)

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)

    const repoUrl = body.repoUrl === null || body.repoUrl === "" ? null : body.repoUrl !== undefined ? parseHttpsUrl(body.repoUrl) : undefined
    if (body.repoUrl && repoUrl === null) return c.json({ error: "bad-request", message: "仓库地址需使用 https:// 开头" }, 400)

    const updated = store.updateProjectMeta(project.id, {
      ...(body.titleZh !== undefined ? { titleZh: str(body.titleZh, HUB_LIMITS.maxTitle) || project.titleZh } : {}),
      ...(body.titleEn !== undefined ? { titleEn: str(body.titleEn, HUB_LIMITS.maxTitle) || project.titleEn } : {}),
      ...(body.summaryZh !== undefined ? { summaryZh: str(body.summaryZh, HUB_LIMITS.maxSummary) } : {}),
      ...(body.summaryEn !== undefined ? { summaryEn: str(body.summaryEn, HUB_LIMITS.maxSummary) } : {}),
      ...(OPEN_LICENSES.includes(body.license as OpenLicense) ? { license: body.license as OpenLicense } : {}),
      ...(CATEGORIES.includes(body.category as ProjectCategory) ? { category: body.category as ProjectCategory } : {}),
      ...(body.tags !== undefined ? { tags: parseTags(body.tags) } : {}),
      ...(repoUrl !== undefined ? { repoUrl } : {}),
      ...(body.visibility === "public" || body.visibility === "unlisted" ? { visibility: body.visibility } : {}),
    })
    return c.json({ project: updated })
  })

  app.delete("/api/hub/projects/:handle/:slug", (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!project) return c.json({ error: "not-found", message: "作品不存在" }, 404)
    if (project.ownerId !== user.id) return c.json({ error: "forbidden", message: "只有作者本人可以归档这个作品" }, 403)
    store.updateProjectMeta(project.id, { visibility: "archived" })
    return c.json({ ok: true })
  })

  app.post(
    "/api/hub/projects/:handle/:slug/releases",
    bodyLimit({ maxSize: MAX_PUBLISH_BODY, onError: (c) => c.json({ error: "too-large", message: "新版本体积超过上限" }, 413) }),
    async (c) => {
      const ip = clientIp((h) => c.req.header(h))
      const wait = limits.write.take(ip)
      if (wait) return c.json(tooFast(wait), 429)
      const user = auth.resolveUser(c, store)
      if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
      const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"))
      if (!project) return c.json({ error: "not-found", message: "作品不存在" }, 404)
      if (project.ownerId !== user.id) return c.json({ error: "forbidden", message: "只有作者本人可以发布新版本" }, 403)

      const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
      if (!body) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)

      const bump = body.bump === "major" || body.bump === "minor" ? body.bump : "patch"
      const version =
        typeof body.version === "string" && body.version.trim()
          ? body.version.trim()
          : bumpSemver(project.latestVersion, bump)
      if (!SEMVER_RE.test(version)) return c.json({ error: "bad-version", message: "版本号需符合 SemVer（如 1.1.0）" }, 400)
      if (store.getRelease(project.id, version)) return c.json({ error: "conflict", message: `版本 ${version} 已存在，请递增版本号` }, 409)

      const changelog = str(body.changelog, HUB_LIMITS.maxChangelog)
      if (scanSecrets(changelog)) return c.json({ error: "secret", message: "更新说明中疑似包含密钥，已拒绝" }, 400)

      const entryRaw = typeof body.entry === "string" ? body.entry : ""
      const validated = validateProjectFiles(body.files as BundleFileInput[], entryRaw)
      if (!validated.ok) return c.json({ error: validated.status === 413 ? "too-large" : "bad-request", message: validated.message }, validated.status)

      const preview = await storePreviewImage(blobs, body.previewDataUrl)
      if (preview && "error" in preview) return c.json({ error: "bad-preview", message: preview.error }, 400)

      const storedFiles: StoredFileMeta[] = []
      const nextMap = new Map<string, { sha256: string; tree?: Tree }>()
      for (const f of validated.files) {
        const put = await blobs.put(f.bytes)
        storedFiles.push({ path: f.path, sha256: put.sha256, size: put.size, mime: f.mime, kind: f.kind })
        nextMap.set(f.path, { sha256: put.sha256, tree: f.tree })
      }

      // Compute structural diff against the previous latest release.
      const prevRelease = store.getReleaseById(project.latestReleaseId)
      let diffSummary = null
      if (prevRelease) {
        const prevMap = new Map<string, { sha256: string; tree?: Tree }>()
        const dec = new TextDecoder("utf-8", { fatal: false })
        for (const pf of prevRelease.files) {
          let tree: Tree | undefined
          if (pf.kind === "part" || pf.kind === "assembly") {
            const rawBytes = await blobs.get(pf.sha256)
            if (rawBytes) {
              try {
                const parsed = Tree.safeParse(JSON.parse(dec.decode(rawBytes)))
                if (parsed.success) tree = parsed.data
              } catch {
                /* ignore */
              }
            }
          }
          prevMap.set(pf.path, { sha256: pf.sha256, tree })
        }
        diffSummary = computeReleaseDiff(prevMap, nextMap)
      }

      const checks = parseChecksSummary(body.checks, validated.checksTotal)
      const manifest = {
        schema: 1,
        name: project.slug,
        title: { zh: project.titleZh, en: project.titleEn },
        summary: { zh: project.summaryZh, en: project.summaryEn },
        version,
        license: project.license,
        entry: validated.entry,
        category: project.category,
        tags: project.tags,
        ...(project.repoUrl ? { repository: project.repoUrl } : {}),
        ...(project.forkedFrom ? { forkedFrom: project.forkedFrom } : {}),
      }

      const added = store.addRelease({
        projectId: project.id,
        version,
        changelog,
        entry: validated.entry,
        kind: validated.kind,
        manifest,
        files: storedFiles,
        diffSummary,
        checksPassed: checks.passed,
        checksTotal: checks.total,
        checksDetail: checks.detail,
        verifiedBy: checks.verifiedBy,
        previewBlob: preview?.sha256 ?? null,
        previewMime: preview?.mime ?? null,
        totalBytes: validated.totalBytes,
        partCount: validated.partCount,
        featureCount: validated.featureCount,
        paramCount: validated.paramCount,
      })

      return c.json(added, 201)
    },
  )

  app.get("/api/hub/projects/:handle/:slug/releases/:version", (c) => {
    const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!project) return c.json({ error: "not-found", message: "作品不存在" }, 404)
    const ver = c.req.param("version") === "latest" ? project.latestVersion : c.req.param("version")
    const release = store.getRelease(project.id, ver)
    if (!release) return c.json({ error: "not-found", message: "版本不存在" }, 404)
    return c.json({ project, release })
  })

  /** Complete file bundle of one release (for live 3D preview, Remix into Web Studio, or CLI pull). */
  app.get("/api/hub/projects/:handle/:slug/releases/:version/bundle", async (c) => {
    const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!project) return c.json({ error: "not-found", message: "作品不存在" }, 404)
    const ver = c.req.param("version") === "latest" ? project.latestVersion : c.req.param("version")
    const release = store.getRelease(project.id, ver)
    if (!release) return c.json({ error: "not-found", message: "版本不存在" }, 404)

    if (c.req.query("download") === "1") store.incrementDownloads(project.id)

    const dec = new TextDecoder("utf-8", { fatal: false })
    const files: BundleFileInput[] = []
    for (const f of release.files) {
      const bytes = await blobs.get(f.sha256)
      if (!bytes) continue
      const binary = f.kind === "step"
      files.push({
        path: f.path,
        encoding: binary ? "base64" : "utf8",
        content: binary ? encodeBase64(bytes) : dec.decode(bytes),
      })
    }
    c.header("Cache-Control", "public, max-age=300")
    return c.json({ project, release, files })
  })

  // ------------------------------------------------------------------ stars

  app.post("/api/hub/projects/:handle/:slug/star", (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!project) return c.json({ error: "not-found", message: "作品不存在" }, 404)
    return c.json(store.setStar(user.id, project.id, true))
  })

  app.delete("/api/hub/projects/:handle/:slug/star", (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const project = store.getProjectByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!project) return c.json({ error: "not-found", message: "作品不存在" }, 404)
    return c.json(store.setStar(user.id, project.id, false))
  })

  // ------------------------------------------------------------------ blobs (immutable content-addressed)

  app.get("/api/hub/blobs/:sha256", async (c) => {
    const hash = c.req.param("sha256")
    if (!SHA256_RE.test(hash)) return c.json({ error: "bad-hash", message: "无效的资源哈希" }, 400)
    const bytes = await blobs.get(hash)
    if (!bytes) return c.json({ error: "not-found", message: "资源不存在" }, 404)
    const mime = detectSafeMime(bytes)
    c.header("Content-Type", mime)
    c.header("Cache-Control", "public, max-age=31536000, immutable")
    c.header("X-Content-Type-Options", "nosniff")
    return c.body(bytes as unknown as ArrayBuffer)
  })

  // ------------------------------------------------------------------ collections

  app.get("/api/hub/collections", (c) => {
    const author = c.req.query("author")
    const q = c.req.query("q")
    const limit = Number(c.req.query("limit") ?? 24)
    const offset = Number(c.req.query("offset") ?? 0)
    return c.json(store.listCollections({ author, q, limit, offset }))
  })

  app.post("/api/hub/collections", async (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)
    const titleZh = str(body.titleZh ?? body.title, HUB_LIMITS.maxTitle)
    const titleEn = str(body.titleEn ?? body.title ?? body.titleZh, HUB_LIMITS.maxTitle)
    if (!titleZh && !titleEn) return c.json({ error: "bad-request", message: "请填写合集标题" }, 400)
    const rawSlug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim().toLowerCase() : slugify(titleEn || titleZh)
    if (!SLUG_RE.test(rawSlug)) return c.json({ error: "bad-slug", message: "合集标识只能用小写字母、数字和连字符" }, 400)
    if (store.getCollectionByHandleSlug(user.handle, rawSlug)) {
      return c.json({ error: "conflict", message: `你已经有同名合集「${rawSlug}」` }, 409)
    }
    const description = str(body.description, 600)
    const collection = store.createCollection({
      ownerId: user.id,
      slug: rawSlug,
      titleZh: titleZh || titleEn,
      titleEn: titleEn || titleZh,
      description,
    })
    return c.json({ collection }, 201)
  })

  app.get("/api/hub/collections/:handle/:slug", (c) => {
    const viewer = auth.resolveUser(c, store)
    const collection = store.getCollectionByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!collection) return c.json({ error: "not-found", message: "合集不存在" }, 404)
    const items = store.listCollectionItems(collection.id, viewer?.id)
    return c.json({ collection, items })
  })

  app.patch("/api/hub/collections/:handle/:slug", async (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const collection = store.getCollectionByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!collection) return c.json({ error: "not-found", message: "合集不存在" }, 404)
    if (collection.ownerId !== user.id) return c.json({ error: "forbidden", message: "只有合集作者可以编辑" }, 403)
    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)
    const updated = store.updateCollection(collection.id, {
      ...(body.titleZh !== undefined ? { titleZh: str(body.titleZh, HUB_LIMITS.maxTitle) || collection.titleZh } : {}),
      ...(body.titleEn !== undefined ? { titleEn: str(body.titleEn, HUB_LIMITS.maxTitle) || collection.titleEn } : {}),
      ...(body.description !== undefined ? { description: str(body.description, 600) } : {}),
    })
    return c.json({ collection: updated })
  })

  app.delete("/api/hub/collections/:handle/:slug", (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const collection = store.getCollectionByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!collection) return c.json({ error: "not-found", message: "合集不存在" }, 404)
    if (collection.ownerId !== user.id) return c.json({ error: "forbidden", message: "只有合集作者可以删除" }, 403)
    store.deleteCollection(collection.id)
    return c.json({ ok: true })
  })

  app.post("/api/hub/collections/:handle/:slug/items", async (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const collection = store.getCollectionByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!collection) return c.json({ error: "not-found", message: "合集不存在" }, 404)
    if (collection.ownerId !== user.id) return c.json({ error: "forbidden", message: "只有合集作者可以管理条目" }, 403)

    const body = (await c.req.json().catch(() => null)) as {
      projectId?: unknown
      handle?: unknown
      slug?: unknown
      pinnedVersion?: unknown
      position?: unknown
      note?: unknown
    } | null
    if (!body) return c.json({ error: "bad-request", message: "请求格式不对" }, 400)

    const project =
      typeof body.projectId === "string"
        ? store.getProjectById(body.projectId)
        : typeof body.handle === "string" && typeof body.slug === "string"
          ? store.getProjectByHandleSlug(body.handle, body.slug)
          : null
    if (!project || project.visibility === "archived") return c.json({ error: "not-found", message: "要收录的作品不存在" }, 404)

    let pinnedVersion: string | null = null
    if (typeof body.pinnedVersion === "string" && body.pinnedVersion.trim()) {
      const v = body.pinnedVersion.trim()
      if (!store.getRelease(project.id, v)) return c.json({ error: "bad-version", message: `作品没有版本 ${v}` }, 400)
      pinnedVersion = v
    }

    store.upsertCollectionItem({
      collectionId: collection.id,
      projectId: project.id,
      pinnedVersion,
      position: typeof body.position === "number" && Number.isFinite(body.position) ? Math.floor(body.position) : undefined,
      note: str(body.note, 240),
    })
    return c.json({ items: store.listCollectionItems(collection.id, user.id) })
  })

  app.delete("/api/hub/collections/:handle/:slug/items/:projectId", (c) => {
    const user = auth.resolveUser(c, store)
    if (!user) return c.json({ error: "unauthorized", message: "请先登录" }, 401)
    const collection = store.getCollectionByHandleSlug(c.req.param("handle"), c.req.param("slug"))
    if (!collection) return c.json({ error: "not-found", message: "合集不存在" }, 404)
    if (collection.ownerId !== user.id) return c.json({ error: "forbidden", message: "只有合集作者可以管理条目" }, 403)
    store.removeCollectionItem(collection.id, c.req.param("projectId"))
    return c.json({ ok: true })
  })

  // ------------------------------------------------------------------ GitHub Release Webhook (continuous Git sync)

  app.post("/api/hub/webhooks/github", async (c) => {
    if (!opts.webhookSecret) return c.json({ error: "not-configured", message: "Webhook 未配置" }, 503)
    const raw = await c.req.text()
    const sig = c.req.header("x-hub-signature-256") ?? ""
    const expected = `sha256=${crypto.createHmac("sha256", opts.webhookSecret).update(raw).digest("hex")}`
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return c.json({ error: "forbidden", message: "签名校验失败" }, 403)
    const event = c.req.header("x-github-event")
    if (event === "ping") return c.json({ ok: true, pong: true })
    if (event !== "release") return c.json({ ok: true, ignored: event })
    const payload = JSON.parse(raw) as { action?: string; repository?: { html_url?: string }; release?: { tag_name?: string } }
    const repoUrl = payload.repository?.html_url
    const matched = repoUrl ? store.findProjectsByRepoUrl(repoUrl) : []
    return c.json({
      ok: true,
      matched: matched.map((p) => `${p.ownerHandle}/${p.slug}`),
      tag: payload.release?.tag_name ?? null,
    })
  })

  return app
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : ""
}

function parseTags(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  for (const item of v) {
    if (typeof item !== "string") continue
    const clean = item.trim().toLowerCase().slice(0, HUB_LIMITS.maxTagLen)
    if (clean && !out.includes(clean)) out.push(clean)
    if (out.length >= HUB_LIMITS.maxTags) break
  }
  return out
}

function parseHttpsUrl(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null
  try {
    const u = new URL(v.trim())
    return u.protocol === "https:" ? u.href : null
  } catch {
    return null
  }
}

function parseForkRef(v: unknown): { handle: string; slug: string; version?: string } | null {
  if (!v || typeof v !== "object") return null
  const r = v as Record<string, unknown>
  const handle = typeof r.handle === "string" ? r.handle.trim().toLowerCase() : ""
  const slug = typeof r.slug === "string" ? r.slug.trim().toLowerCase() : ""
  if (!HANDLE_RE.test(handle) || !SLUG_RE.test(slug)) return null
  const version = typeof r.version === "string" && SEMVER_RE.test(r.version.trim()) ? r.version.trim() : undefined
  return { handle, slug, ...(version ? { version } : {}) }
}

function parseChecksSummary(
  raw: unknown,
  fallbackTotal: number,
): { passed: number; total: number; detail: HubRelease["checksDetail"]; verifiedBy: HubRelease["verifiedBy"] } {
  if (!raw || typeof raw !== "object") return { passed: 0, total: fallbackTotal, detail: [], verifiedBy: "none" }
  const obj = raw as Record<string, unknown>
  const items = Array.isArray(obj.items) ? obj.items : []
  const detail: HubRelease["checksDetail"] = []
  for (const it of items.slice(0, 50)) {
    if (!it || typeof it !== "object") continue
    const row = it as Record<string, unknown>
    if (typeof row.id !== "string" || typeof row.said !== "string" || typeof row.pass !== "boolean") continue
    detail.push({
      id: row.id.slice(0, 60),
      said: row.said.slice(0, 120),
      pass: row.pass,
      ...(typeof row.expected === "string" ? { expected: row.expected.slice(0, 80) } : {}),
      ...(typeof row.actual === "string" ? { actual: row.actual.slice(0, 80) } : {}),
    })
  }
  const total = detail.length || fallbackTotal
  const passed = detail.filter((d) => d.pass).length
  const verifiedBy = obj.verifiedBy === "ci" ? "ci" : detail.length ? "client" : "none"
  return { passed, total, detail, verifiedBy }
}

async function storePreviewImage(
  blobs: BlobStore,
  dataUrl: unknown,
): Promise<{ sha256: string; mime: string } | { error: string } | null> {
  if (dataUrl === undefined || dataUrl === null || dataUrl === "") return null
  if (typeof dataUrl !== "string") return { error: "封面图格式不对" }
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl)
  if (!m) return { error: "封面图必须是 base64 编码的图片" }
  const mime = m[1].toLowerCase()
  if (!ALLOWED_IMAGE_MIMES.has(mime)) return { error: "封面图仅支持 PNG、WebP 或 JPEG" }
  const bytes = decodeBase64(m[2].replace(/\s+/g, ""))
  if (bytes.byteLength > HUB_LIMITS.maxPreviewBytes) return { error: "封面图超过 2 MB 上限" }
  if (!matchesImageMagic(bytes, mime)) return { error: "封面图内容与格式不匹配" }
  const put = await blobs.put(bytes)
  return { sha256: put.sha256, mime }
}

function matchesImageMagic(bytes: Uint8Array, mime: string): boolean {
  if (bytes.byteLength < 12) return false
  if (mime === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mime === "image/webp") {
    return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  }
  return false
}

function detectSafeMime(bytes: Uint8Array): string {
  if (matchesImageMagic(bytes, "image/png")) return "image/png"
  if (matchesImageMagic(bytes, "image/webp")) return "image/webp"
  if (matchesImageMagic(bytes, "image/jpeg")) return "image/jpeg"
  return "application/octet-stream"
}
