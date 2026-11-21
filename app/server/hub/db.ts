// SQLite + FTS5 metadata store for Turnery Community Hub.
// Uses Node 22 built-in `node:sqlite` (zero native C++ addon build, bundles cleanly with esbuild).
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import type { OpenLicense, ProjectCategory, ReleaseDiffSummary } from "../../src/hub/package"

export type HubUser = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  bio: string
  githubId: string | null
  createdAt: string
}

export type HubTokenRow = {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

export type StoredFileMeta = {
  path: string
  sha256: string
  size: number
  mime: string
  kind: "part" | "assembly" | "params" | "step" | "markdown" | "manifest"
}

export type HubRelease = {
  id: string
  projectId: string
  version: string
  changelog: string
  entry: string
  manifest: Record<string, unknown>
  files: StoredFileMeta[]
  diffSummary: ReleaseDiffSummary | null
  checksPassed: number
  checksTotal: number
  checksDetail: { id: string; said: string; pass: boolean; expected?: string; actual?: string }[]
  verifiedBy: "client" | "ci" | "none"
  previewBlob: string | null
  previewMime: string | null
  totalBytes: number
  createdAt: string
}

export type HubProject = {
  id: string
  ownerId: string
  ownerHandle: string
  ownerName: string
  ownerAvatar: string | null
  slug: string
  titleZh: string
  titleEn: string
  summaryZh: string
  summaryEn: string
  license: OpenLicense
  category: ProjectCategory
  kind: "part" | "assembly"
  tags: string[]
  repoUrl: string | null
  forkedFrom: { handle: string; slug: string; version?: string } | null
  latestVersion: string
  latestReleaseId: string
  previewBlob: string | null
  checksPassed: number
  checksTotal: number
  partCount: number
  featureCount: number
  paramCount: number
  starsCount: number
  downloadsCount: number
  visibility: "public" | "unlisted" | "archived"
  createdAt: string
  updatedAt: string
  starred?: boolean
}

export type HubCollection = {
  id: string
  ownerId: string
  ownerHandle: string
  ownerName: string
  ownerAvatar: string | null
  slug: string
  titleZh: string
  titleEn: string
  description: string
  itemCount: number
  createdAt: string
  updatedAt: string
}

export type HubCollectionItem = {
  project: HubProject
  pinnedVersion: string | null
  position: number
  note: string
  addedAt: string
  hasNewerVersion: boolean
}

export type ProjectSearchQuery = {
  q?: string
  category?: string
  tag?: string
  license?: string
  kind?: "part" | "assembly"
  verified?: boolean
  author?: string
  sort?: "updated" | "stars" | "newest" | "downloads"
  limit?: number
  offset?: number
  viewerId?: string | null
}

const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(9).toString("base64url")}`
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")

export class HubStore {
  readonly db: DatabaseSync
  readonly dir: string

  constructor(dataDir: string) {
    this.dir = path.join(dataDir, "hub")
    fs.mkdirSync(this.dir, { recursive: true })
    this.db = new DatabaseSync(path.join(this.dir, "hub.sqlite"))
    this.db.exec("PRAGMA journal_mode = WAL;")
    this.db.exec("PRAGMA foreign_keys = ON;")
    this.initSchema()
  }

  close() {
    this.db.close()
  }

  private initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        bio TEXT NOT NULL DEFAULT '',
        github_id TEXT UNIQUE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        prefix TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_used_at TEXT
      );

      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        title_zh TEXT NOT NULL,
        title_en TEXT NOT NULL,
        summary_zh TEXT NOT NULL DEFAULT '',
        summary_en TEXT NOT NULL DEFAULT '',
        license TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        kind TEXT NOT NULL DEFAULT 'part',
        tags_json TEXT NOT NULL DEFAULT '[]',
        repo_url TEXT,
        forked_from_json TEXT,
        latest_version TEXT NOT NULL DEFAULT '1.0.0',
        latest_release_id TEXT NOT NULL DEFAULT '',
        preview_blob TEXT,
        checks_passed INTEGER NOT NULL DEFAULT 0,
        checks_total INTEGER NOT NULL DEFAULT 0,
        part_count INTEGER NOT NULL DEFAULT 1,
        feature_count INTEGER NOT NULL DEFAULT 0,
        param_count INTEGER NOT NULL DEFAULT 0,
        stars_count INTEGER NOT NULL DEFAULT 0,
        downloads_count INTEGER NOT NULL DEFAULT 0,
        visibility TEXT NOT NULL DEFAULT 'public',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(owner_id, slug)
      );

      CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(visibility, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_projects_stars ON projects(visibility, stars_count DESC);
      CREATE INDEX IF NOT EXISTS idx_projects_owner ON projects(owner_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS releases (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        changelog TEXT NOT NULL DEFAULT '',
        entry TEXT NOT NULL,
        manifest_json TEXT NOT NULL,
        files_json TEXT NOT NULL,
        diff_summary_json TEXT,
        checks_passed INTEGER NOT NULL DEFAULT 0,
        checks_total INTEGER NOT NULL DEFAULT 0,
        checks_detail_json TEXT NOT NULL DEFAULT '[]',
        verified_by TEXT NOT NULL DEFAULT 'none',
        preview_blob TEXT,
        preview_mime TEXT,
        total_bytes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        UNIQUE(project_id, version)
      );

      CREATE INDEX IF NOT EXISTS idx_releases_project ON releases(project_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS project_stars (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, project_id)
      );

      CREATE TABLE IF NOT EXISTS collections (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        title_zh TEXT NOT NULL,
        title_en TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(owner_id, slug)
      );

      CREATE TABLE IF NOT EXISTS collection_items (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        pinned_version TEXT,
        position INTEGER NOT NULL DEFAULT 0,
        note TEXT NOT NULL DEFAULT '',
        added_at TEXT NOT NULL,
        PRIMARY KEY (collection_id, project_id)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS projects_fts USING fts5(
        project_id UNINDEXED,
        title,
        summary,
        tags,
        owner_handle,
        category
      );
    `)
  }

  // ------------------------------------------------------------------ users & tokens

  upsertUser(input: { handle: string; displayName: string; avatarUrl?: string | null; bio?: string; githubId?: string | null }): HubUser {
    const now = new Date().toISOString()
    const cleanHandle = input.handle.toLowerCase()
    if (input.githubId) {
      const byGh = this.db.prepare("SELECT * FROM users WHERE github_id = ?").get(input.githubId) as Record<string, unknown> | undefined
      if (byGh) {
        this.db
          .prepare("UPDATE users SET display_name = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
          .run(input.displayName || String(byGh.display_name), input.avatarUrl ?? null, String(byGh.id))
        return this.getUserById(String(byGh.id))!
      }
    }
    const byHandle = this.db.prepare("SELECT * FROM users WHERE handle = ?").get(cleanHandle) as Record<string, unknown> | undefined
    if (byHandle) {
      if (input.githubId && !byHandle.github_id) {
        // Avoid hijacking an existing local handle: suffix github handle if collision.
        const unique = `${cleanHandle.slice(0, 30)}-${input.githubId.slice(-5)}`
        return this.upsertUser({ ...input, handle: unique })
      }
      this.db
        .prepare("UPDATE users SET display_name = ?, avatar_url = COALESCE(?, avatar_url) WHERE id = ?")
        .run(input.displayName || String(byHandle.display_name), input.avatarUrl ?? null, String(byHandle.id))
      return this.getUserById(String(byHandle.id))!
    }
    const id = newId("usr")
    this.db
      .prepare("INSERT INTO users (id, handle, display_name, avatar_url, bio, github_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(id, cleanHandle, input.displayName || cleanHandle, input.avatarUrl ?? null, input.bio ?? "", input.githubId ?? null, now)
    return this.getUserById(id)!
  }

  getUserById(id: string): HubUser | null {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined
    return row ? mapUser(row) : null
  }

  getUserByHandle(handle: string): HubUser | null {
    const row = this.db.prepare("SELECT * FROM users WHERE handle = ?").get(handle.toLowerCase()) as Record<string, unknown> | undefined
    return row ? mapUser(row) : null
  }

  createApiToken(userId: string, name: string): { id: string; token: string; prefix: string; name: string; createdAt: string } {
    const id = newId("tok")
    const raw = `trn_${crypto.randomBytes(24).toString("base64url")}`
    const prefix = raw.slice(0, 12)
    const now = new Date().toISOString()
    this.db
      .prepare("INSERT INTO api_tokens (id, user_id, name, prefix, token_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, userId, name.trim().slice(0, 60) || "CLI token", prefix, sha256(raw), now)
    return { id, token: raw, prefix, name: name.trim().slice(0, 60) || "CLI token", createdAt: now }
  }

  listApiTokens(userId: string): HubTokenRow[] {
    const rows = this.db
      .prepare("SELECT id, name, prefix, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC")
      .all(userId) as Record<string, unknown>[]
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      prefix: String(r.prefix),
      createdAt: String(r.created_at),
      lastUsedAt: r.last_used_at ? String(r.last_used_at) : null,
    }))
  }

  revokeApiToken(userId: string, tokenId: string): boolean {
    const res = this.db.prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?").run(tokenId, userId)
    return Number(res.changes) > 0
  }

  resolveApiToken(rawToken: string): HubUser | null {
    const row = this.db.prepare("SELECT id, user_id FROM api_tokens WHERE token_hash = ?").get(sha256(rawToken)) as Record<string, unknown> | undefined
    if (!row) return null
    this.db.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), String(row.id))
    return this.getUserById(String(row.user_id))
  }

  // ------------------------------------------------------------------ projects & releases

  private syncFts(projectId: string) {
    this.db.prepare("DELETE FROM projects_fts WHERE project_id = ?").run(projectId)
    const p = this.db
      .prepare(
        `SELECT p.id, p.title_zh, p.title_en, p.summary_zh, p.summary_en, p.tags_json, p.category, p.visibility, u.handle
         FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = ?`,
      )
      .get(projectId) as Record<string, unknown> | undefined
    if (!p || p.visibility !== "public") return
    const tags = safeJson<string[]>(String(p.tags_json), []).join(" ")
    this.db
      .prepare("INSERT INTO projects_fts (project_id, title, summary, tags, owner_handle, category) VALUES (?, ?, ?, ?, ?, ?)")
      .run(projectId, `${String(p.title_zh)} ${String(p.title_en)}`, `${String(p.summary_zh)} ${String(p.summary_en)}`, tags, String(p.handle), String(p.category))
  }

  createProjectWithRelease(input: {
    ownerId: string
    slug: string
    titleZh: string
    titleEn: string
    summaryZh: string
    summaryEn: string
    license: OpenLicense
    category: ProjectCategory
    kind: "part" | "assembly"
    tags: string[]
    repoUrl?: string | null
    forkedFrom?: { handle: string; slug: string; version?: string } | null
    visibility?: "public" | "unlisted"
    version: string
    changelog: string
    entry: string
    manifest: Record<string, unknown>
    files: StoredFileMeta[]
    checksPassed: number
    checksTotal: number
    checksDetail: HubRelease["checksDetail"]
    verifiedBy: HubRelease["verifiedBy"]
    previewBlob: string | null
    previewMime: string | null
    totalBytes: number
    partCount: number
    featureCount: number
    paramCount: number
  }): { project: HubProject; release: HubRelease } {
    const now = new Date().toISOString()
    const projectId = newId("prj")
    const releaseId = newId("rel")
    this.db.exec("BEGIN")
    try {
      this.db
        .prepare(
          `INSERT INTO projects (
            id, owner_id, slug, title_zh, title_en, summary_zh, summary_en, license, category, kind,
            tags_json, repo_url, forked_from_json, latest_version, latest_release_id, preview_blob,
            checks_passed, checks_total, part_count, feature_count, param_count, visibility, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          input.ownerId,
          input.slug,
          input.titleZh,
          input.titleEn,
          input.summaryZh,
          input.summaryEn,
          input.license,
          input.category,
          input.kind,
          JSON.stringify(input.tags),
          input.repoUrl ?? null,
          input.forkedFrom ? JSON.stringify(input.forkedFrom) : null,
          input.version,
          releaseId,
          input.previewBlob,
          input.checksPassed,
          input.checksTotal,
          input.partCount,
          input.featureCount,
          input.paramCount,
          input.visibility ?? "public",
          now,
          now,
        )
      this.db
        .prepare(
          `INSERT INTO releases (
            id, project_id, version, changelog, entry, manifest_json, files_json, diff_summary_json,
            checks_passed, checks_total, checks_detail_json, verified_by, preview_blob, preview_mime, total_bytes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          releaseId,
          projectId,
          input.version,
          input.changelog,
          input.entry,
          JSON.stringify(input.manifest),
          JSON.stringify(input.files),
          input.checksPassed,
          input.checksTotal,
          JSON.stringify(input.checksDetail),
          input.verifiedBy,
          input.previewBlob,
          input.previewMime,
          input.totalBytes,
          now,
        )
      this.syncFts(projectId)
      this.db.exec("COMMIT")
    } catch (e) {
      this.db.exec("ROLLBACK")
      throw e
    }
    return {
      project: this.getProjectById(projectId, input.ownerId)!,
      release: this.getReleaseById(releaseId)!,
    }
  }

  addRelease(input: {
    projectId: string
    version: string
    changelog: string
    entry: string
    kind: "part" | "assembly"
    manifest: Record<string, unknown>
    files: StoredFileMeta[]
    diffSummary: ReleaseDiffSummary | null
    checksPassed: number
    checksTotal: number
    checksDetail: HubRelease["checksDetail"]
    verifiedBy: HubRelease["verifiedBy"]
    previewBlob: string | null
    previewMime: string | null
    totalBytes: number
    partCount: number
    featureCount: number
    paramCount: number
  }): { project: HubProject; release: HubRelease } {
    const now = new Date().toISOString()
    const releaseId = newId("rel")
    this.db.exec("BEGIN")
    try {
      this.db
        .prepare(
          `INSERT INTO releases (
            id, project_id, version, changelog, entry, manifest_json, files_json, diff_summary_json,
            checks_passed, checks_total, checks_detail_json, verified_by, preview_blob, preview_mime, total_bytes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          releaseId,
          input.projectId,
          input.version,
          input.changelog,
          input.entry,
          JSON.stringify(input.manifest),
          JSON.stringify(input.files),
          input.diffSummary ? JSON.stringify(input.diffSummary) : null,
          input.checksPassed,
          input.checksTotal,
          JSON.stringify(input.checksDetail),
          input.verifiedBy,
          input.previewBlob,
          input.previewMime,
          input.totalBytes,
          now,
        )
      this.db
        .prepare(
          `UPDATE projects SET
            kind = ?, latest_version = ?, latest_release_id = ?,
            preview_blob = COALESCE(?, preview_blob),
            checks_passed = ?, checks_total = ?,
            part_count = ?, feature_count = ?, param_count = ?,
            updated_at = ?
          WHERE id = ?`,
        )
        .run(
          input.kind,
          input.version,
          releaseId,
          input.previewBlob,
          input.checksPassed,
          input.checksTotal,
          input.partCount,
          input.featureCount,
          input.paramCount,
          now,
          input.projectId,
        )
      this.syncFts(input.projectId)
      this.db.exec("COMMIT")
    } catch (e) {
      this.db.exec("ROLLBACK")
      throw e
    }
    return {
      project: this.getProjectById(input.projectId)!,
      release: this.getReleaseById(releaseId)!,
    }
  }

  updateProjectMeta(
    projectId: string,
    patch: {
      titleZh?: string
      titleEn?: string
      summaryZh?: string
      summaryEn?: string
      license?: OpenLicense
      category?: ProjectCategory
      tags?: string[]
      repoUrl?: string | null
      visibility?: "public" | "unlisted" | "archived"
    },
  ): HubProject | null {
    const cur = this.getProjectById(projectId)
    if (!cur) return null
    const now = new Date().toISOString()
    this.db
      .prepare(
        `UPDATE projects SET
          title_zh = ?, title_en = ?, summary_zh = ?, summary_en = ?,
          license = ?, category = ?, tags_json = ?, repo_url = ?, visibility = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        patch.titleZh ?? cur.titleZh,
        patch.titleEn ?? cur.titleEn,
        patch.summaryZh ?? cur.summaryZh,
        patch.summaryEn ?? cur.summaryEn,
        patch.license ?? cur.license,
        patch.category ?? cur.category,
        JSON.stringify(patch.tags ?? cur.tags),
        patch.repoUrl !== undefined ? patch.repoUrl : cur.repoUrl,
        patch.visibility ?? cur.visibility,
        now,
        projectId,
      )
    this.syncFts(projectId)
    return this.getProjectById(projectId)
  }

  incrementDownloads(projectId: string) {
    this.db.prepare("UPDATE projects SET downloads_count = downloads_count + 1 WHERE id = ?").run(projectId)
  }

  getProjectById(id: string, viewerId?: string | null): HubProject | null {
    const row = this.db
      .prepare(
        `SELECT p.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar
         FROM projects p JOIN users u ON u.id = p.owner_id WHERE p.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined
    if (!row) return null
    const proj = mapProject(row)
    if (viewerId) {
      proj.starred = Boolean(this.db.prepare("SELECT 1 FROM project_stars WHERE user_id = ? AND project_id = ?").get(viewerId, id))
    }
    return proj
  }

  getProjectByHandleSlug(handle: string, slug: string, viewerId?: string | null): HubProject | null {
    const row = this.db
      .prepare(
        `SELECT p.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar
         FROM projects p JOIN users u ON u.id = p.owner_id
         WHERE u.handle = ? AND p.slug = ? AND p.visibility != 'archived'`,
      )
      .get(handle.toLowerCase(), slug.toLowerCase()) as Record<string, unknown> | undefined
    if (!row) return null
    const proj = mapProject(row)
    if (viewerId) {
      proj.starred = Boolean(this.db.prepare("SELECT 1 FROM project_stars WHERE user_id = ? AND project_id = ?").get(viewerId, proj.id))
    }
    return proj
  }

  findProjectsByRepoUrl(repoUrl: string): HubProject[] {
    const clean = repoUrl.replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase()
    const rows = this.db
      .prepare(
        `SELECT p.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar
         FROM projects p JOIN users u ON u.id = p.owner_id
         WHERE p.visibility != 'archived' AND p.repo_url IS NOT NULL`,
      )
      .all() as Record<string, unknown>[]
    return rows
      .filter((r) => String(r.repo_url).replace(/\.git$/i, "").replace(/\/+$/, "").toLowerCase() === clean)
      .map(mapProject)
  }

  getReleaseById(id: string): HubRelease | null {
    const row = this.db.prepare("SELECT * FROM releases WHERE id = ?").get(id) as Record<string, unknown> | undefined
    return row ? mapRelease(row) : null
  }

  getRelease(projectId: string, version: string): HubRelease | null {
    const row = this.db.prepare("SELECT * FROM releases WHERE project_id = ? AND version = ?").get(projectId, version) as Record<string, unknown> | undefined
    return row ? mapRelease(row) : null
  }

  listReleases(projectId: string): HubRelease[] {
    const rows = this.db.prepare("SELECT * FROM releases WHERE project_id = ? ORDER BY created_at DESC").all(projectId) as Record<string, unknown>[]
    return rows.map(mapRelease)
  }

  searchProjects(query: ProjectSearchQuery = {}): { items: HubProject[]; total: number } {
    const where: string[] = ["p.visibility = 'public'"]
    const params: (string | number)[] = []

    if (query.author) {
      where.push("u.handle = ?")
      params.push(query.author.toLowerCase())
    }
    if (query.category) {
      where.push("p.category = ?")
      params.push(query.category)
    }
    if (query.license) {
      where.push("p.license = ?")
      params.push(query.license)
    }
    if (query.kind) {
      where.push("p.kind = ?")
      params.push(query.kind)
    }
    if (query.verified) {
      where.push("p.checks_total > 0 AND p.checks_passed = p.checks_total")
    }
    if (query.tag) {
      where.push("EXISTS (SELECT 1 FROM json_each(p.tags_json) WHERE lower(value) = ?)")
      params.push(query.tag.toLowerCase())
    }

    const q = query.q?.trim()
    let from = "FROM projects p JOIN users u ON u.id = p.owner_id"
    if (q) {
      // Escape FTS5 special chars and match prefixes so both Chinese & English terms work.
      const tokens = q
        .replace(/["'*()^:]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 8)
      if (tokens.length) {
        const matchExpr = tokens.map((tok) => `"${tok}"*`).join(" AND ")
        from += " JOIN projects_fts fts ON fts.project_id = p.id"
        where.push("(projects_fts MATCH ? OR p.title_zh LIKE ? OR p.title_en LIKE ? OR p.summary_zh LIKE ? OR p.summary_en LIKE ?)")
        const like = `%${q}%`
        params.push(matchExpr, like, like, like, like)
      }
    }

    const orderBy =
      query.sort === "stars"
        ? "p.stars_count DESC, p.updated_at DESC"
        : query.sort === "newest"
          ? "p.created_at DESC"
          : query.sort === "downloads"
            ? "p.downloads_count DESC, p.updated_at DESC"
            : "p.updated_at DESC"

    const limit = Math.min(Math.max(1, query.limit ?? 24), 60)
    const offset = Math.max(0, query.offset ?? 0)
    const whereSql = `WHERE ${where.join(" AND ")}`

    const countRow = this.db.prepare(`SELECT COUNT(*) AS n ${from} ${whereSql}`).get(...params) as { n: number }
    const rows = this.db
      .prepare(`SELECT p.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar ${from} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as Record<string, unknown>[]

    const items = rows.map(mapProject)
    if (query.viewerId && items.length) {
      const starred = new Set(
        (this.db.prepare("SELECT project_id FROM project_stars WHERE user_id = ?").all(query.viewerId) as { project_id: string }[]).map((r) => r.project_id),
      )
      for (const item of items) item.starred = starred.has(item.id)
    }
    return { items, total: Number(countRow.n) }
  }

  setStar(userId: string, projectId: string, starred: boolean): { starred: boolean; starsCount: number } {
    const now = new Date().toISOString()
    this.db.exec("BEGIN")
    try {
      if (starred) {
        this.db.prepare("INSERT OR IGNORE INTO project_stars (user_id, project_id, created_at) VALUES (?, ?, ?)").run(userId, projectId, now)
      } else {
        this.db.prepare("DELETE FROM project_stars WHERE user_id = ? AND project_id = ?").run(userId, projectId)
      }
      const count = (this.db.prepare("SELECT COUNT(*) AS n FROM project_stars WHERE project_id = ?").get(projectId) as { n: number }).n
      this.db.prepare("UPDATE projects SET stars_count = ? WHERE id = ?").run(count, projectId)
      this.db.exec("COMMIT")
      return { starred, starsCount: Number(count) }
    } catch (e) {
      this.db.exec("ROLLBACK")
      throw e
    }
  }

  // ------------------------------------------------------------------ collections

  createCollection(input: { ownerId: string; slug: string; titleZh: string; titleEn: string; description: string }): HubCollection {
    const id = newId("col")
    const now = new Date().toISOString()
    this.db
      .prepare("INSERT INTO collections (id, owner_id, slug, title_zh, title_en, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, input.ownerId, input.slug, input.titleZh, input.titleEn, input.description, now, now)
    return this.getCollectionById(id)!
  }

  getCollectionById(id: string): HubCollection | null {
    const row = this.db
      .prepare(
        `SELECT c.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar,
          (SELECT COUNT(*) FROM collection_items ci JOIN projects p ON p.id = ci.project_id WHERE ci.collection_id = c.id AND p.visibility != 'archived') AS item_count
         FROM collections c JOIN users u ON u.id = c.owner_id WHERE c.id = ?`,
      )
      .get(id) as Record<string, unknown> | undefined
    return row ? mapCollection(row) : null
  }

  getCollectionByHandleSlug(handle: string, slug: string): HubCollection | null {
    const row = this.db
      .prepare(
        `SELECT c.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar,
          (SELECT COUNT(*) FROM collection_items ci JOIN projects p ON p.id = ci.project_id WHERE ci.collection_id = c.id AND p.visibility != 'archived') AS item_count
         FROM collections c JOIN users u ON u.id = c.owner_id WHERE u.handle = ? AND c.slug = ?`,
      )
      .get(handle.toLowerCase(), slug.toLowerCase()) as Record<string, unknown> | undefined
    return row ? mapCollection(row) : null
  }

  listCollections(opts: { author?: string; q?: string; limit?: number; offset?: number } = {}): { items: HubCollection[]; total: number } {
    const where: string[] = ["1 = 1"]
    const params: (string | number)[] = []
    if (opts.author) {
      where.push("u.handle = ?")
      params.push(opts.author.toLowerCase())
    }
    if (opts.q?.trim()) {
      const like = `%${opts.q.trim()}%`
      where.push("(c.title_zh LIKE ? OR c.title_en LIKE ? OR c.description LIKE ?)")
      params.push(like, like, like)
    }
    const limit = Math.min(Math.max(1, opts.limit ?? 24), 60)
    const offset = Math.max(0, opts.offset ?? 0)
    const whereSql = `WHERE ${where.join(" AND ")}`
    const countRow = this.db.prepare(`SELECT COUNT(*) AS n FROM collections c JOIN users u ON u.id = c.owner_id ${whereSql}`).get(...params) as { n: number }
    const rows = this.db
      .prepare(
        `SELECT c.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar,
          (SELECT COUNT(*) FROM collection_items ci JOIN projects p ON p.id = ci.project_id WHERE ci.collection_id = c.id AND p.visibility != 'archived') AS item_count
         FROM collections c JOIN users u ON u.id = c.owner_id ${whereSql}
         ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as Record<string, unknown>[]
    return { items: rows.map(mapCollection), total: Number(countRow.n) }
  }

  updateCollection(id: string, patch: { titleZh?: string; titleEn?: string; description?: string }): HubCollection | null {
    const cur = this.getCollectionById(id)
    if (!cur) return null
    this.db
      .prepare("UPDATE collections SET title_zh = ?, title_en = ?, description = ?, updated_at = ? WHERE id = ?")
      .run(patch.titleZh ?? cur.titleZh, patch.titleEn ?? cur.titleEn, patch.description ?? cur.description, new Date().toISOString(), id)
    return this.getCollectionById(id)
  }

  deleteCollection(id: string): boolean {
    return Number(this.db.prepare("DELETE FROM collections WHERE id = ?").run(id).changes) > 0
  }

  upsertCollectionItem(input: { collectionId: string; projectId: string; pinnedVersion?: string | null; position?: number; note?: string }) {
    const now = new Date().toISOString()
    const existing = this.db
      .prepare("SELECT position FROM collection_items WHERE collection_id = ? AND project_id = ?")
      .get(input.collectionId, input.projectId) as { position: number } | undefined
    const maxPos = (this.db.prepare("SELECT COALESCE(MAX(position), -1) AS m FROM collection_items WHERE collection_id = ?").get(input.collectionId) as { m: number }).m
    const pos = input.position ?? existing?.position ?? maxPos + 1
    this.db
      .prepare(
        `INSERT INTO collection_items (collection_id, project_id, pinned_version, position, note, added_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(collection_id, project_id) DO UPDATE SET
           pinned_version = excluded.pinned_version,
           position = excluded.position,
           note = excluded.note`,
      )
      .run(input.collectionId, input.projectId, input.pinnedVersion ?? null, pos, input.note ?? "", now)
    this.db.prepare("UPDATE collections SET updated_at = ? WHERE id = ?").run(now, input.collectionId)
  }

  removeCollectionItem(collectionId: string, projectId: string): boolean {
    const res = this.db.prepare("DELETE FROM collection_items WHERE collection_id = ? AND project_id = ?").run(collectionId, projectId)
    if (Number(res.changes) > 0) {
      this.db.prepare("UPDATE collections SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), collectionId)
      return true
    }
    return false
  }

  listCollectionItems(collectionId: string, viewerId?: string | null): HubCollectionItem[] {
    const rows = this.db
      .prepare(
        `SELECT ci.pinned_version, ci.position, ci.note, ci.added_at,
                p.*, u.handle AS owner_handle, u.display_name AS owner_name, u.avatar_url AS owner_avatar
         FROM collection_items ci
         JOIN projects p ON p.id = ci.project_id
         JOIN users u ON u.id = p.owner_id
         WHERE ci.collection_id = ? AND p.visibility != 'archived'
         ORDER BY ci.position ASC, ci.added_at ASC`,
      )
      .all(collectionId) as Record<string, unknown>[]
    const starred = viewerId
      ? new Set((this.db.prepare("SELECT project_id FROM project_stars WHERE user_id = ?").all(viewerId) as { project_id: string }[]).map((r) => r.project_id))
      : new Set<string>()
    return rows.map((r) => {
      const project = mapProject(r)
      project.starred = starred.has(project.id)
      const pinnedVersion = r.pinned_version ? String(r.pinned_version) : null
      return {
        project,
        pinnedVersion,
        position: Number(r.position),
        note: String(r.note ?? ""),
        addedAt: String(r.added_at),
        hasNewerVersion: Boolean(pinnedVersion && pinnedVersion !== project.latestVersion),
      }
    })
  }
}

function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function mapUser(r: Record<string, unknown>): HubUser {
  return {
    id: String(r.id),
    handle: String(r.handle),
    displayName: String(r.display_name),
    avatarUrl: r.avatar_url ? String(r.avatar_url) : null,
    bio: String(r.bio ?? ""),
    githubId: r.github_id ? String(r.github_id) : null,
    createdAt: String(r.created_at),
  }
}

function mapProject(r: Record<string, unknown>): HubProject {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    ownerHandle: String(r.owner_handle),
    ownerName: String(r.owner_name),
    ownerAvatar: r.owner_avatar ? String(r.owner_avatar) : null,
    slug: String(r.slug),
    titleZh: String(r.title_zh),
    titleEn: String(r.title_en),
    summaryZh: String(r.summary_zh ?? ""),
    summaryEn: String(r.summary_en ?? ""),
    license: String(r.license) as OpenLicense,
    category: String(r.category) as ProjectCategory,
    kind: (r.kind === "assembly" ? "assembly" : "part") as "part" | "assembly",
    tags: safeJson<string[]>(String(r.tags_json), []),
    repoUrl: r.repo_url ? String(r.repo_url) : null,
    forkedFrom: safeJson<HubProject["forkedFrom"]>(r.forked_from_json ? String(r.forked_from_json) : null, null),
    latestVersion: String(r.latest_version),
    latestReleaseId: String(r.latest_release_id),
    previewBlob: r.preview_blob ? String(r.preview_blob) : null,
    checksPassed: Number(r.checks_passed ?? 0),
    checksTotal: Number(r.checks_total ?? 0),
    partCount: Number(r.part_count ?? 1),
    featureCount: Number(r.feature_count ?? 0),
    paramCount: Number(r.param_count ?? 0),
    starsCount: Number(r.stars_count ?? 0),
    downloadsCount: Number(r.downloads_count ?? 0),
    visibility: (r.visibility === "unlisted" || r.visibility === "archived" ? r.visibility : "public") as HubProject["visibility"],
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}

function mapRelease(r: Record<string, unknown>): HubRelease {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    version: String(r.version),
    changelog: String(r.changelog ?? ""),
    entry: String(r.entry),
    manifest: safeJson<Record<string, unknown>>(String(r.manifest_json), {}),
    files: safeJson<StoredFileMeta[]>(String(r.files_json), []),
    diffSummary: safeJson<ReleaseDiffSummary | null>(r.diff_summary_json ? String(r.diff_summary_json) : null, null),
    checksPassed: Number(r.checks_passed ?? 0),
    checksTotal: Number(r.checks_total ?? 0),
    checksDetail: safeJson<HubRelease["checksDetail"]>(String(r.checks_detail_json), []),
    verifiedBy: (r.verified_by === "ci" || r.verified_by === "client" ? r.verified_by : "none") as HubRelease["verifiedBy"],
    previewBlob: r.preview_blob ? String(r.preview_blob) : null,
    previewMime: r.preview_mime ? String(r.preview_mime) : null,
    totalBytes: Number(r.total_bytes ?? 0),
    createdAt: String(r.created_at),
  }
}

function mapCollection(r: Record<string, unknown>): HubCollection {
  return {
    id: String(r.id),
    ownerId: String(r.owner_id),
    ownerHandle: String(r.owner_handle),
    ownerName: String(r.owner_name),
    ownerAvatar: r.owner_avatar ? String(r.owner_avatar) : null,
    slug: String(r.slug),
    titleZh: String(r.title_zh),
    titleEn: String(r.title_en),
    description: String(r.description ?? ""),
    itemCount: Number(r.item_count ?? 0),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }
}
