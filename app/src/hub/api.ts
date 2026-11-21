// Typed browser client for Turnery Community Hub API (`/api/hub/*`).
import * as React from "react"
import { t } from "../lib/i18n"
import type { BundleFileInput, OpenLicense, ProjectCategory, ReleaseDiffSummary } from "./package"

export type HubUser = {
  id: string
  handle: string
  displayName: string
  avatarUrl: string | null
  bio: string
  githubId: string | null
  createdAt: string
}

export type HubAuthState = {
  user: HubUser | null
  auth: { github: boolean; local: boolean }
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

export const CATEGORY_LABELS: Record<ProjectCategory, { zh: string; en: string }> = {
  enclosure: { zh: "外壳与盒体", en: "Enclosures" },
  bracket: { zh: "支架与固定件", en: "Brackets & Mounts" },
  mechanism: { zh: "机构与传动", en: "Mechanisms" },
  fastener: { zh: "紧固与连接", en: "Fasteners" },
  organizer: { zh: "收纳与桌面", en: "Organizers" },
  electronics: { zh: "电子与开发板", en: "Electronics" },
  tool: { zh: "工装与夹具", en: "Tools & Jigs" },
  other: { zh: "其他", en: "Other" },
}

export const categoryLabel = (c: ProjectCategory) => t(CATEGORY_LABELS[c].zh, CATEGORY_LABELS[c].en)

export const projectTitle = (p: Pick<HubProject, "titleZh" | "titleEn">) => t(p.titleZh || p.titleEn, p.titleEn || p.titleZh)
export const projectSummary = (p: Pick<HubProject, "summaryZh" | "summaryEn">) => t(p.summaryZh || p.summaryEn, p.summaryEn || p.summaryZh)
export const collectionTitle = (c: Pick<HubCollection, "titleZh" | "titleEn">) => t(c.titleZh || c.titleEn, c.titleEn || c.titleZh)
export const blobUrl = (sha256: string) => `/api/hub/blobs/${sha256}`

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}), ...init?.headers },
  })
  const data = (await res.json().catch(() => null)) as (T & { message?: string }) | null
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`)
  return data as T
}

export const hubApi = {
  me: () => api<HubAuthState>("/api/hub/me"),
  localLogin: (input: { handle: string; displayName?: string; bio?: string }) =>
    api<{ user: HubUser }>("/api/hub/auth/local", { method: "POST", body: JSON.stringify(input) }),
  logout: () => api<{ ok: boolean }>("/api/hub/auth/logout", { method: "POST" }),
  listTokens: () => api<{ tokens: HubTokenRow[] }>("/api/hub/tokens"),
  createToken: (name: string) => api<{ id: string; token: string; prefix: string; name: string; createdAt: string }>("/api/hub/tokens", { method: "POST", body: JSON.stringify({ name }) }),
  revokeToken: (id: string) => api<{ ok: boolean }>(`/api/hub/tokens/${encodeURIComponent(id)}`, { method: "DELETE" }),

  userProfile: (handle: string) => api<{ user: HubUser; projects: HubProject[]; collections: HubCollection[] }>(`/api/hub/users/${encodeURIComponent(handle)}`),

  listProjects: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== "" && v !== false) qs.set(k, String(v))
    }
    const q = qs.toString()
    return api<{ items: HubProject[]; total: number }>(`/api/hub/projects${q ? `?${q}` : ""}`)
  },

  getProject: (handle: string, slug: string) =>
    api<{ project: HubProject; releases: HubRelease[] }>(`/api/hub/projects/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`),

  getBundle: (handle: string, slug: string, version = "latest", download = false) =>
    api<{ project: HubProject; release: HubRelease; files: BundleFileInput[] }>(
      `/api/hub/projects/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}/releases/${encodeURIComponent(version)}/bundle${download ? "?download=1" : ""}`,
    ),

  publishProject: (payload: {
    titleZh: string
    titleEn?: string
    summaryZh?: string
    summaryEn?: string
    slug?: string
    license: OpenLicense
    category: ProjectCategory
    tags?: string[]
    version?: string
    changelog?: string
    repoUrl?: string
    forkedFrom?: { handle: string; slug: string; version?: string } | null
    entry: string
    files: BundleFileInput[]
    previewDataUrl?: string | null
    checks?: { items: { id: string; said: string; pass: boolean; expected?: string; actual?: string }[]; verifiedBy?: "client" | "ci" }
  }) => api<{ project: HubProject; release: HubRelease }>("/api/hub/projects", { method: "POST", body: JSON.stringify(payload) }),

  publishRelease: (
    handle: string,
    slug: string,
    payload: {
      version?: string
      bump?: "patch" | "minor" | "major"
      changelog?: string
      entry: string
      files: BundleFileInput[]
      previewDataUrl?: string | null
      checks?: { items: { id: string; said: string; pass: boolean; expected?: string; actual?: string }[]; verifiedBy?: "client" | "ci" }
    },
  ) =>
    api<{ project: HubProject; release: HubRelease }>(
      `/api/hub/projects/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}/releases`,
      { method: "POST", body: JSON.stringify(payload) },
    ),

  star: (handle: string, slug: string, on: boolean) =>
    api<{ starred: boolean; starsCount: number }>(`/api/hub/projects/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}/star`, {
      method: on ? "POST" : "DELETE",
    }),

  listCollections: (params: { author?: string; q?: string } = {}) => {
    const qs = new URLSearchParams()
    if (params.author) qs.set("author", params.author)
    if (params.q) qs.set("q", params.q)
    const q = qs.toString()
    return api<{ items: HubCollection[]; total: number }>(`/api/hub/collections${q ? `?${q}` : ""}`)
  },

  createCollection: (payload: { titleZh: string; titleEn?: string; slug?: string; description?: string }) =>
    api<{ collection: HubCollection }>("/api/hub/collections", { method: "POST", body: JSON.stringify(payload) }),

  getCollection: (handle: string, slug: string) =>
    api<{ collection: HubCollection; items: HubCollectionItem[] }>(`/api/hub/collections/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}`),

  addCollectionItem: (handle: string, slug: string, payload: { projectId: string; pinnedVersion?: string | null; note?: string; position?: number }) =>
    api<{ items: HubCollectionItem[] }>(`/api/hub/collections/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}/items`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  removeCollectionItem: (handle: string, slug: string, projectId: string) =>
    api<{ ok: boolean }>(`/api/hub/collections/${encodeURIComponent(handle)}/${encodeURIComponent(slug)}/items/${encodeURIComponent(projectId)}`, {
      method: "DELETE",
    }),
}

export function useHubAuth() {
  const [state, setState] = React.useState<HubAuthState>({ user: null, auth: { github: false, local: false } })
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      setState(await hubApi.me())
    } catch {
      /* server unreachable */
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...state, loading, refresh }
}
