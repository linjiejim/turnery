// End-to-end server integration tests for the Community Hub API:
// SQLite + FTS5 + SHA-256 content-addressed BlobStore + Auth (cookie & API tokens) +
// publishing, continuous version updates, stars, collections (pinned vs latest), security & webhooks.
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Hono } from "hono"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { HubAuth } from "../../../server/hub/auth"
import { FileBlobStore } from "../../../server/hub/blobs"
import { HubStore } from "../../../server/hub/db"
import { hubRoutes } from "../../../server/hub/routes"
import { RateLimiter } from "../../../server/limits"
import { encodeBase64 } from "@/hub/package"
import type { Tree } from "@/studio/dsl"

// Minimal valid 1x1 PNG bytes (passes magic byte validation).
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
  0x42, 0x60, 0x82,
])

const PART_V1: Tree = {
  params: { W: 50, D: 30, H: 15 },
  features: [
    { id: "sk", op: "sketch", name: "Base", on: { plane: "XY" }, shapes: [{ type: "rect", w: "W", h: "D" }] },
    { id: "ext", op: "extrude", name: "Body", sketch: "sk", distance: "H" },
  ],
  checks: [{ id: "sz", said: "50x30x15", kind: "size", expect: [50, 30, 15] }],
}

const PART_V2: Tree = {
  params: { W: 65, D: 30, H: 15, R: 2 },
  features: [
    ...PART_V1.features,
    { id: "fil", op: "fillet", name: "Fillet", r: "R", edges: { of: "ext" } },
  ],
  checks: [{ id: "sz", said: "65x30x15", kind: "size", expect: [65, 30, 15] }],
}

const VALID_STEP = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"

let tmpDir: string
let store: HubStore
let blobs: FileBlobStore
let app: Hono
const WEBHOOK_SECRET = "test-webhook-secret"

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "turnery-hub-test-"))
  store = new HubStore(path.join(tmpDir, "hub.sqlite"))
  blobs = new FileBlobStore(path.join(tmpDir, "blobs"))
  const auth = new HubAuth({
    hubDir: tmpDir,
    sessionSecret: "test-session-secret-0123456789",
    localAuth: true,
    secureCookie: false,
  })
  app = new Hono()
  app.route(
    "/",
    hubRoutes({
      store,
      blobs,
      auth,
      webhookSecret: WEBHOOK_SECRET,
      limiters: { write: new RateLimiter(500, 3600_000), read: new RateLimiter(5000, 3600_000) },
    }),
  )
})

afterEach(() => {
  store.close()
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

async function loginAs(handle: string, displayName = handle): Promise<string> {
  const res = await app.request("/api/hub/auth/local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handle, displayName }),
  })
  expect(res.status).toBe(200)
  const setCookie = res.headers.get("set-cookie") ?? ""
  const cookie = setCookie.split(";")[0]
  expect(cookie).toContain("turnery_session=")
  return cookie
}

describe("Community Hub API integration", () => {
  it("supports session login, API token lifecycle, publishing, continuous updates with diff & blob dedup, search, stars, and collections", async () => {
    const aliceCookie = await loginAs("alice", "Alice Maker")
    const bobCookie = await loginAs("bob", "Bob Builder")

    // Verify session identity
    const meRes = await app.request("/api/hub/me", { headers: { Cookie: aliceCookie } })
    expect(meRes.status).toBe(200)
    const me = (await meRes.json()) as { user: { handle: string } | null; auth: { local: boolean } }
    expect(me.user?.handle).toBe("alice")
    expect(me.auth.local).toBe(true)

    // Create Personal API Token and verify Bearer auth works
    const tokRes = await app.request("/api/hub/tokens", {
      method: "POST",
      headers: { Cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "CI Bot" }),
    })
    expect(tokRes.status).toBe(201)
    const tok = (await tokRes.json()) as { id: string; token: string }
    expect(tok.token.startsWith("trn_")).toBe(true)

    const bearerMe = await app.request("/api/hub/me", {
      headers: { Authorization: `Bearer ${tok.token}` },
    })
    expect(((await bearerMe.json()) as { user: { handle: string } }).user.handle).toBe("alice")

    // Publish single-part project v1.0.0 with PNG preview + checks via API Token
    const pub1 = await app.request("/api/hub/projects", {
      method: "POST",
      headers: { Authorization: `Bearer ${tok.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "motor-bracket",
        titleZh: "步进电机支架",
        titleEn: "Stepper Motor Bracket",
        summaryZh: "NEMA 17 参数化铝型材支架",
        license: "CERN-OHL-P-2.0",
        category: "bracket",
        tags: ["nema17", "cnc"],
        version: "1.0.0",
        entry: "main.turnery.json",
        changelog: "Initial open-source release",
        previewDataUrl: `data:image/png;base64,${encodeBase64(TINY_PNG)}`,
        checks: { verifiedBy: "client", items: [{ id: "sz", said: "50x30x15", pass: true }] },
        files: [
          { path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(PART_V1) },
          { path: "README.md", encoding: "utf8", content: "# Stepper Motor Bracket" },
        ],
      }),
    })
    expect(pub1.status).toBe(201)
    const p1 = (await pub1.json()) as {
      project: { id: string; slug: string; latestVersion: string; checksPassed: number; checksTotal: number; previewBlob: string | null }
      release: { version: string; files: { path: string; sha256: string }[] }
    }
    expect(p1.project.latestVersion).toBe("1.0.0")
    expect(p1.project.checksPassed).toBe(1)
    expect(p1.project.checksTotal).toBe(1)
    expect(p1.project.previewBlob).toBeTruthy()

    // Preview image endpoint returns exact PNG bytes
    const prevRes = await app.request(`/api/hub/blobs/${p1.project.previewBlob}`)
    expect(prevRes.status).toBe(200)
    expect(prevRes.headers.get("content-type")).toBe("image/png")

    // Non-owner (bob) cannot push an update to alice's project
    const forbiddenUpdate = await app.request("/api/hub/projects/alice/motor-bracket/releases", {
      method: "POST",
      headers: { Cookie: bobCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "1.1.0",
        entry: "main.turnery.json",
        files: [{ path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(PART_V2) }],
      }),
    })
    expect(forbiddenUpdate.status).toBe(403)

    // Duplicate version returns 409 Conflict
    const dupUpdate = await app.request("/api/hub/projects/alice/motor-bracket/releases", {
      method: "POST",
      headers: { Cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "1.0.0",
        entry: "main.turnery.json",
        files: [{ path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(PART_V2) }],
      }),
    })
    expect(dupUpdate.status).toBe(409)

    // Continuous update v1.1.0: README unchanged (deduped by SHA-256), main.turnery.json updated with diff summary
    const pub2 = await app.request("/api/hub/projects/alice/motor-bracket/releases", {
      method: "POST",
      headers: { Cookie: aliceCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        version: "1.1.0",
        entry: "main.turnery.json",
        changelog: "Widened bracket and added edge fillet",
        checks: { verifiedBy: "client", items: [{ id: "sz", said: "65x30x15", pass: true }] },
        files: [
          { path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(PART_V2) },
          { path: "README.md", encoding: "utf8", content: "# Stepper Motor Bracket" },
        ],
      }),
    })
    expect(pub2.status).toBe(201)
    const r2 = (await pub2.json()) as {
      release: {
        version: string
        diffSummary: { filesChanged: string[]; treeChanges: { file: string; summary: string }[] } | null
        files: { path: string; sha256: string }[]
      }
    }
    expect(r2.release.version).toBe("1.1.0")
    expect(r2.release.diffSummary?.filesChanged).toContain("main.turnery.json")
    expect(r2.release.diffSummary?.treeChanges.length).toBeGreaterThan(0)
    // Verify README blob SHA-256 is identical (deduplicated in content-addressed store)
    const readmeV1 = p1.release.files.find((f) => f.path === "README.md")?.sha256
    const readmeV2 = r2.release.files.find((f) => f.path === "README.md")?.sha256
    expect(readmeV1).toBe(readmeV2)

    // Bob publishes a multi-part assembly with a STEP asset
    const asmTree: Tree = {
      params: {},
      features: [
        { id: "p", op: "component", name: "Base", file: "parts/base.turnery.json" },
        { id: "s", op: "import", name: "Bearing", file: "assets/bearing.step" },
      ],
    }
    const pubAsm = await app.request("/api/hub/projects", {
      method: "POST",
      headers: { Cookie: bobCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "linear-stage",
        titleZh: "直线滑台装配体",
        titleEn: "Linear Stage Assembly",
        license: "MIT",
        category: "robotics",
        version: "1.0.0",
        entry: "stage.turnery-asm.json",
        files: [
          { path: "stage.turnery-asm.json", encoding: "utf8", content: JSON.stringify(asmTree) },
          { path: "parts/base.turnery.json", encoding: "utf8", content: JSON.stringify(PART_V1) },
          { path: "assets/bearing.step", encoding: "base64", content: encodeBase64(new TextEncoder().encode(VALID_STEP)) },
        ],
      }),
    })
    expect(pubAsm.status).toBe(201)
    const asmData = (await pubAsm.json()) as { project: { id: string; kind: string } }
    expect(asmData.project.kind).toBe("assembly")

    // FTS5 search & filters
    const searchAsm = await app.request("/api/hub/projects?kind=assembly&q=Linear")
    const searchAsmJson = (await searchAsm.json()) as { items: { slug: string }[] }
    expect(searchAsmJson.items.map((x) => x.slug)).toEqual(["linear-stage"])

    const searchVerified = await app.request("/api/hub/projects?verified=1")
    const searchVerifiedJson = (await searchVerified.json()) as { items: { slug: string }[] }
    expect(searchVerifiedJson.items.map((x) => x.slug)).toEqual(["motor-bracket"])

    // Star & download tracking
    const starRes = await app.request("/api/hub/projects/alice/motor-bracket/star", {
      method: "POST",
      headers: { Cookie: bobCookie },
    })
    expect(await starRes.json()).toEqual({ starred: true, starsCount: 1 })

    const bundleRes = await app.request("/api/hub/projects/alice/motor-bracket/releases/1.0.0/bundle?download=1")
    expect(bundleRes.status).toBe(200)
    const bundle = (await bundleRes.json()) as { release: { version: string }; files: { path: string }[] }
    expect(bundle.release.version).toBe("1.0.0")
    expect(bundle.files.some((f) => f.path === "main.turnery.json")).toBe(true)

    // Bob creates a curated collection containing BOTH alice's project (pinned to 1.0.0) and his own (tracking latest)
    const colRes = await app.request("/api/hub/collections", {
      method: "POST",
      headers: { Cookie: bobCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "motion-kit",
        titleZh: "运动控制开源套件",
        titleEn: "Motion Control Open Kit",
        description: "Curated brackets and linear stages",
      }),
    })
    expect(colRes.status).toBe(201)

    const add1 = await app.request("/api/hub/collections/bob/motion-kit/items", {
      method: "POST",
      headers: { Cookie: bobCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: p1.project.id, pinnedVersion: "1.0.0", note: "Tested with v1.0.0" }),
    })
    expect(add1.status).toBe(200)

    const add2 = await app.request("/api/hub/collections/bob/motion-kit/items", {
      method: "POST",
      headers: { Cookie: bobCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: asmData.project.id, note: "Always tracks latest" }),
    })
    expect(add2.status).toBe(200)

    const colView = await app.request("/api/hub/collections/bob/motion-kit")
    const colJson = (await colView.json()) as {
      items: { pinnedVersion: string | null; hasNewerVersion: boolean; project: { slug: string } }[]
    }
    expect(colJson.items).toHaveLength(2)
    // Alice's project is pinned at 1.0.0 while latest is 1.1.0 -> hasNewerVersion must be true!
    const aliceItem = colJson.items.find((i) => i.project.slug === "motor-bracket")
    expect(aliceItem?.pinnedVersion).toBe("1.0.0")
    expect(aliceItem?.hasNewerVersion).toBe(true)
    const bobItem = colJson.items.find((i) => i.project.slug === "linear-stage")
    expect(bobItem?.pinnedVersion).toBeNull()
    expect(bobItem?.hasNewerVersion).toBe(false)

    // Revoking API token immediately rejects Bearer access
    const revokeRes = await app.request(`/api/hub/tokens/${tok.id}`, {
      method: "DELETE",
      headers: { Cookie: aliceCookie },
    })
    expect(revokeRes.status).toBe(200)
    const afterRevoke = await app.request("/api/hub/me", {
      headers: { Authorization: `Bearer ${tok.token}` },
    })
    expect(((await afterRevoke.json()) as { user: null }).user).toBeNull()
  })

  it("rejects spoofed preview bytes, secret leaks, and bad GitHub webhook HMAC signatures", async () => {
    const cookie = await loginAs("secuser", "Security User")

    // Spoofed preview image (plain text instead of PNG/WebP/JPEG magic bytes)
    const badPreview = await app.request("/api/hub/projects", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "bad-preview",
        titleZh: "Bad Preview",
        license: "MIT",
        category: "other",
        version: "1.0.0",
        entry: "main.turnery.json",
        previewDataUrl: `data:image/png;base64,${encodeBase64(new TextEncoder().encode("<svg>not a png</svg>"))}`,
        files: [{ path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(PART_V1) }],
      }),
    })
    expect(badPreview.status).toBe(400)

    // Secret leak in README
    const secretLeak = await app.request("/api/hub/projects", {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: "secret-leak",
        titleZh: "Secret Leak",
        license: "MIT",
        category: "other",
        version: "1.0.0",
        entry: "main.turnery.json",
        files: [
          { path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(PART_V1) },
          { path: "README.md", encoding: "utf8", content: "key=sk-1234567890abcdefghijklmnop" },
        ],
      }),
    })
    expect(secretLeak.status).toBe(400)

    // GitHub release webhook HMAC verification
    const payload = JSON.stringify({ action: "published", repository: { html_url: "https://github.com/org/repo" }, release: { tag_name: "v1.2.0" } })
    const badSig = await app.request("/api/hub/webhooks/github", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": "sha256=0000000000000000000000000000000000000000000000000000000000000000" },
      body: payload,
    })
    expect(badSig.status).toBe(403)

    const goodMac = `sha256=${crypto.createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex")}`
    const goodSig = await app.request("/api/hub/webhooks/github", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Hub-Signature-256": goodMac },
      body: payload,
    })
    expect(goodSig.status).toBe(200)
  })
})
