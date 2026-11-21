// Open Turnery project package format (`turnery.json`) & validation shared by
// the browser workbench, the community hub server, and future CLI/CI tooling.
import { z } from "zod"
import { Tree } from "../studio/dsl"
import { checkTree } from "../studio/limits"
import { SharedFile, asmExtOf, besides, normalizePath } from "../desktop/core/sources"
import { partExtOf } from "../desktop/core/protocol"
import { describeTreeChange } from "../desktop/core/tree-diff"

export const OPEN_LICENSES = [
  "CERN-OHL-P-2.0",
  "CERN-OHL-S-2.0",
  "CERN-OHL-W-2.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "CC0-1.0",
  "MIT",
  "Apache-2.0",
] as const
export type OpenLicense = (typeof OPEN_LICENSES)[number]

export const CATEGORIES = [
  "enclosure",
  "bracket",
  "mechanism",
  "fastener",
  "organizer",
  "electronics",
  "tool",
  "other",
] as const
export type ProjectCategory = (typeof CATEGORIES)[number]

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/
export const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/

export const HUB_LIMITS = {
  maxFiles: 50,
  maxTotalBytes: 20 * 1024 * 1024,
  maxStepBytes: 10 * 1024 * 1024,
  maxJsonBytes: 512 * 1024,
  maxTextBytes: 256 * 1024,
  maxPreviewBytes: 2 * 1024 * 1024,
  maxTitle: 80,
  maxSummary: 240,
  maxChangelog: 2000,
  maxTags: 10,
  maxTagLen: 28,
} as const

/** Secret patterns rejected before anything enters the open community store. */
const SECRET_RE = /\b(?:sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/

export const BilingualText = z.union([
  z.string().trim().min(1).max(HUB_LIMITS.maxSummary),
  z.object({
    zh: z.string().trim().max(HUB_LIMITS.maxSummary).optional(),
    en: z.string().trim().max(HUB_LIMITS.maxSummary).optional(),
  }),
])

export const ForkRef = z.object({
  handle: z.string().regex(HANDLE_RE),
  slug: z.string().regex(SLUG_RE),
  version: z.string().regex(SEMVER_RE).optional(),
})
export type ForkRef = z.infer<typeof ForkRef>

export const TurneryManifest = z.object({
  schema: z.literal(1).default(1),
  name: z.string().regex(SLUG_RE),
  title: BilingualText,
  summary: BilingualText.optional(),
  version: z.string().regex(SEMVER_RE),
  license: z.enum(OPEN_LICENSES),
  entry: z.string().min(1).max(200),
  category: z.enum(CATEGORIES).default("other"),
  tags: z.array(z.string().trim().min(1).max(HUB_LIMITS.maxTagLen)).max(HUB_LIMITS.maxTags).default([]),
  repository: z
    .string()
    .url()
    .refine((u) => /^https:\/\//i.test(u), "Repository URL must use https://")
    .optional(),
  forkedFrom: ForkRef.nullable().optional(),
  turneryMinVersion: z.string().max(32).optional(),
  readme: z.string().max(200).optional(),
})
export type TurneryManifest = z.infer<typeof TurneryManifest>

export type BundleFileInput = {
  /** Relative path inside the project folder, forward slashes. */
  path: string
  /** UTF-8 text for JSON/Markdown/STEP or base64 for binary files. */
  encoding: "utf8" | "base64"
  content: string
}

export type ValidatedFile = {
  path: string
  bytes: Uint8Array
  mime: string
  kind: "part" | "assembly" | "params" | "step" | "markdown" | "manifest"
  tree?: Tree
}

export type PackageValidation =
  | {
      ok: true
      files: ValidatedFile[]
      entry: string
      kind: "part" | "assembly"
      totalBytes: number
      partCount: number
      featureCount: number
      paramCount: number
      checksTotal: number
    }
  | { ok: false; status: 400 | 413; message: string }

const ALLOWED_TEXT_EXT = /\.(json|md|txt)$/i
const STEP_EXT = /\.(step|stp)$/i

/** Strict relative path check: rejects traversal, leading slash, hidden files, private notes and node_modules. */
export function normalizeProjectPath(raw: string): string | null {
  const cleaned = raw.trim().replace(/\\/g, "/").replace(/^\.\//, "")
  if (!cleaned || cleaned.startsWith("/") || /^[A-Za-z]:/.test(cleaned)) return null
  if (cleaned.includes("\0")) return null
  const segs = cleaned.split("/")
  const out: string[] = []
  for (const s of segs) {
    if (!s || s === "." || s === "..") return null
    if (s.startsWith(".") || s === "node_modules" || s === "__MACOSX") return null
    out.push(s)
  }
  const joined = out.join("/")
  if (joined.toLowerCase().endsWith(".notes.json")) return null
  return joined
}

export function scanSecrets(text: string): boolean {
  return SECRET_RE.test(text)
}

export function isPartPath(p: string) {
  return partExtOf(p) !== null
}
export function isAssemblyPath(p: string) {
  return asmExtOf(p) !== null
}
export function isParamsPath(p: string) {
  return p.toLowerCase().endsWith(".params.json")
}
export function isStepPath(p: string) {
  return STEP_EXT.test(p)
}

export function decodeBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"))
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64")
  let bin = ""
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(bin)
}

export function slugify(input: string): string {
  const ascii = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
  return ascii || `project-${Math.random().toString(36).slice(2, 8)}`
}

export function bumpSemver(current: string, part: "patch" | "minor" | "major" = "patch"): string {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(current)
  if (!m) return "1.0.0"
  const [maj, min, pat] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (part === "major") return `${maj + 1}.0.0`
  if (part === "minor") return `${maj}.${min + 1}.0`
  return `${maj}.${min}.${pat + 1}`
}

export function pickText(v: z.infer<typeof BilingualText> | undefined, lang: "zh" | "en"): string {
  if (!v) return ""
  if (typeof v === "string") return v
  return (lang === "en" ? v.en || v.zh : v.zh || v.en) ?? ""
}

/**
 * Validate every file in a project bundle before storing or publishing.
 * Enforces path safety, tree schema/limits, STEP header, secret scanning, and internal reference bounds.
 */
export function validateProjectFiles(rawFiles: BundleFileInput[], entryRaw: string): PackageValidation {
  const bad = (message: string): PackageValidation => ({ ok: false, status: 400, message })
  const big = (message: string): PackageValidation => ({ ok: false, status: 413, message })

  if (!Array.isArray(rawFiles) || !rawFiles.length) return bad("项目里没有任何文件")
  if (rawFiles.length > HUB_LIMITS.maxFiles) return big(`文件太多了（最多 ${HUB_LIMITS.maxFiles} 个）`)

  const entry = normalizeProjectPath(entryRaw)
  if (!entry || (!isPartPath(entry) && !isAssemblyPath(entry))) {
    return bad("入口文件必须是 *.turnery.json 或 *.turnery-asm.json")
  }

  const seen = new Set<string>()
  const files: ValidatedFile[] = []
  const enc = new TextEncoder()
  const dec = new TextDecoder("utf-8", { fatal: false })
  let totalBytes = 0

  for (const item of rawFiles) {
    if (!item || typeof item.path !== "string" || typeof item.content !== "string") return bad("文件列表格式不对")
    const p = normalizeProjectPath(item.path)
    if (!p) return bad(`不允许的文件路径：${item.path}`)
    if (seen.has(p)) return bad(`重复的文件路径：${p}`)
    seen.add(p)

    let bytes: Uint8Array
    if (item.encoding === "base64") {
      try {
        bytes = decodeBase64(item.content)
      } catch {
        return bad(`文件 ${p} 的 base64 数据无效`)
      }
    } else if (item.encoding === "utf8") {
      bytes = enc.encode(item.content)
    } else {
      return bad(`不支持的文件编码：${String(item.encoding)}`)
    }

    totalBytes += bytes.byteLength
    if (totalBytes > HUB_LIMITS.maxTotalBytes) {
      return big(`项目总大小超过上限（最多 ${Math.round(HUB_LIMITS.maxTotalBytes / (1024 * 1024))} MB）`)
    }

    if (isStepPath(p)) {
      if (bytes.byteLength > HUB_LIMITS.maxStepBytes) return big(`STEP 文件 ${p} 超过 ${Math.round(HUB_LIMITS.maxStepBytes / (1024 * 1024))} MB 上限`)
      const head = dec.decode(bytes.subarray(0, 256))
      if (!head.includes("ISO-10303-21")) return bad(`STEP 文件 ${p} 缺少标准 ISO-10303-21 文件头`)
      files.push({ path: p, bytes, mime: "model/step", kind: "step" })
      continue
    }

    if (!ALLOWED_TEXT_EXT.test(p)) {
      return bad(`暂不支持上传该文件类型：${p}（仅支持 .turnery.json、.turnery-asm.json、.params.json、.step/.stp、.md、turnery.json）`)
    }

    const text = item.encoding === "utf8" ? item.content : dec.decode(bytes)
    if (scanSecrets(text)) return bad(`文件 ${p} 中疑似包含密钥或访问令牌，已拒绝发布`)

    if (p === "turnery.json") {
      if (bytes.byteLength > HUB_LIMITS.maxTextBytes) return big(`turnery.json 过大`)
      try {
        JSON.parse(text)
      } catch {
        return bad("turnery.json 不是合法 JSON")
      }
      files.push({ path: p, bytes, mime: "application/json", kind: "manifest" })
      continue
    }

    if (isPartPath(p) || isAssemblyPath(p)) {
      if (bytes.byteLength > HUB_LIMITS.maxJsonBytes) return big(`模型文件 ${p} 过大（最多 ${HUB_LIMITS.maxJsonBytes / 1024} KB）`)
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(text)
      } catch {
        return bad(`${p} 不是合法的 JSON`)
      }
      const checked = checkTree(parsedJson)
      if (!checked.ok) return checked.tooBig ? big(`${p}：${checked.message}`) : bad(`${p}：${checked.message}`)
      files.push({ path: p, bytes, mime: "application/json", kind: isAssemblyPath(p) ? "assembly" : "part", tree: checked.tree })
      continue
    }

    if (isParamsPath(p)) {
      if (bytes.byteLength > HUB_LIMITS.maxJsonBytes) return big(`参数文件 ${p} 过大`)
      let parsedJson: unknown
      try {
        parsedJson = JSON.parse(text)
      } catch {
        return bad(`${p} 不是合法的 JSON`)
      }
      const res = SharedFile.safeParse(parsedJson)
      if (!res.success) return bad(`共享参数文件 ${p} 格式不对`)
      files.push({ path: p, bytes, mime: "application/json", kind: "params" })
      continue
    }

    if (bytes.byteLength > HUB_LIMITS.maxTextBytes) return big(`文本文件 ${p} 过大`)
    files.push({ path: p, bytes, mime: "text/markdown", kind: "markdown" })
  }

  const entryFile = files.find((f) => f.path === entry)
  if (!entryFile || !entryFile.tree) return bad(`找不到入口文件 ${entry}`)

  // Verify relative references (`uses`, `import`, `component`) stay inside the project root.
  for (const f of files) {
    if (!f.tree) continue
    const checkRef = (ref: string, label: string): string | null => {
      if (/^([A-Za-z]:)?\//.test(ref.trim())) return `${f.path} 的 ${label} 不能使用绝对路径（${ref}）`
      const resolved = normalizePath(besides(`/${f.path}`, ref))
      if (!resolved.startsWith("/") || resolved.includes("/..")) return `${f.path} 的 ${label} 超出了项目根目录（${ref}）`
      return null
    }
    if (f.tree.uses) {
      const err = checkRef(f.tree.uses, "uses")
      if (err) return bad(err)
    }
    for (const feat of f.tree.features) {
      if (feat.op === "import") {
        const err = checkRef(feat.file, `import(${feat.id})`)
        if (err) return bad(err)
      }
      if (feat.op === "component" && feat.file) {
        const err = checkRef(feat.file, `component(${feat.id})`)
        if (err) return bad(err)
      }
    }
  }

  const partFiles = files.filter((f) => f.kind === "part" || f.kind === "assembly")
  const entryTree = entryFile.tree
  return {
    ok: true,
    files,
    entry,
    kind: entryFile.kind === "assembly" ? "assembly" : "part",
    totalBytes,
    partCount: partFiles.length,
    featureCount: entryTree.features.length,
    paramCount: Object.keys(entryTree.params).length,
    checksTotal: entryTree.checks?.length ?? 0,
  }
}

export type ReleaseDiffSummary = {
  filesAdded: string[]
  filesRemoved: string[]
  filesChanged: string[]
  /** Human-readable per-part/assembly feature tree change descriptions (from describeTreeChange). */
  treeChanges: { file: string; summary: string }[]
}

/** Compare two versions of a project and produce a structured diff including parametric feature-tree summaries. */
export function computeReleaseDiff(
  prevFiles: Map<string, { sha256: string; tree?: Tree }>,
  nextFiles: Map<string, { sha256: string; tree?: Tree }>,
): ReleaseDiffSummary {
  const filesAdded: string[] = []
  const filesRemoved: string[] = []
  const filesChanged: string[] = []
  const treeChanges: { file: string; summary: string }[] = []

  for (const [p, next] of nextFiles) {
    const prev = prevFiles.get(p)
    if (!prev) {
      filesAdded.push(p)
    } else if (prev.sha256 !== next.sha256) {
      filesChanged.push(p)
      if (prev.tree && next.tree) {
        const summary = describeTreeChange(prev.tree, next.tree)
        if (summary) treeChanges.push({ file: p, summary })
      }
    }
  }
  for (const p of prevFiles.keys()) {
    if (!nextFiles.has(p)) filesRemoved.push(p)
  }

  filesAdded.sort()
  filesRemoved.sort()
  filesChanged.sort()
  return { filesAdded, filesRemoved, filesChanged, treeChanges }
}
