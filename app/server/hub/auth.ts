// Authentication for Turnery Community Hub:
//   1. Personal API Tokens (`Authorization: Bearer trn_…`) for CLI & GitHub Actions
//   2. Signed HttpOnly session cookies (`turnery_session`) backed by GitHub OAuth 2.0
//   3. Optional local/self-hosted handle login (`HUB_LOCAL_AUTH=1` or non-prod without GitHub OAuth)
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import type { Context } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { HANDLE_RE } from "../../src/hub/package"
import type { HubStore, HubUser } from "./db"

const SESSION_COOKIE = "turnery_session"
const OAUTH_STATE_COOKIE = "turnery_oauth_state"
const SESSION_TTL_SEC = 30 * 24 * 3600

export type HubAuthConfig = {
  hubDir: string
  sessionSecret?: string
  githubClientId?: string
  githubClientSecret?: string
  githubCallbackUrl?: string
  localAuth?: boolean
  secureCookie?: boolean
}

export class HubAuth {
  private readonly secret: string
  readonly githubEnabled: boolean
  readonly localAuthEnabled: boolean
  private readonly cfg: HubAuthConfig

  constructor(cfg: HubAuthConfig) {
    this.cfg = cfg
    this.secret = cfg.sessionSecret || loadOrCreateSecret(cfg.hubDir)
    this.githubEnabled = Boolean(cfg.githubClientId && cfg.githubClientSecret)
    this.localAuthEnabled = cfg.localAuth ?? (!this.githubEnabled && process.env.NODE_ENV !== "production")
  }

  private sign(payload: string): string {
    return crypto.createHmac("sha256", this.secret).update(payload).digest("base64url")
  }

  makeSessionToken(userId: string): string {
    const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SEC
    const payload = `${userId}.${exp}`
    return `${payload}.${this.sign(payload)}`
  }

  verifySessionToken(token: string | undefined): string | null {
    if (!token) return null
    const parts = token.split(".")
    if (parts.length !== 3) return null
    const [userId, expRaw, sig] = parts
    const exp = Number(expRaw)
    if (!userId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null
    const expected = this.sign(`${userId}.${expRaw}`)
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
    return userId
  }

  setSession(c: Context, userId: string) {
    setCookie(c, SESSION_COOKIE, this.makeSessionToken(userId), {
      httpOnly: true,
      sameSite: "Lax",
      secure: this.cfg.secureCookie ?? process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SEC,
    })
  }

  clearSession(c: Context) {
    deleteCookie(c, SESSION_COOKIE, { path: "/" })
  }

  /** Resolve the authenticated user from either `Authorization: Bearer trn_…` or the session cookie. */
  resolveUser(c: Context, store: HubStore): HubUser | null {
    const authHeader = c.req.header("authorization")?.trim()
    if (authHeader?.startsWith("Bearer ")) {
      const raw = authHeader.slice(7).trim()
      if (raw.startsWith("trn_")) return store.resolveApiToken(raw)
    }
    const uid = this.verifySessionToken(getCookie(c, SESSION_COOKIE))
    return uid ? store.getUserById(uid) : null
  }

  /** Build the GitHub OAuth authorization redirect URL and stash CSRF state in a cookie. */
  startGithubOAuth(c: Context, returnTo = "/community"): string | null {
    if (!this.githubEnabled || !this.cfg.githubClientId) return null
    const state = crypto.randomBytes(16).toString("hex")
    const safeReturn = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/community"
    setCookie(c, OAUTH_STATE_COOKIE, `${state}:${encodeURIComponent(safeReturn)}`, {
      httpOnly: true,
      sameSite: "Lax",
      secure: this.cfg.secureCookie ?? process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    })
    const params = new URLSearchParams({
      client_id: this.cfg.githubClientId,
      scope: "read:user",
      state,
      ...(this.cfg.githubCallbackUrl ? { redirect_uri: this.cfg.githubCallbackUrl } : {}),
    })
    return `https://github.com/login/oauth/authorize?${params.toString()}`
  }

  async finishGithubOAuth(c: Context, store: HubStore): Promise<{ ok: true; user: HubUser; returnTo: string } | { ok: false; message: string }> {
    if (!this.githubEnabled || !this.cfg.githubClientId || !this.cfg.githubClientSecret) {
      return { ok: false, message: "GitHub OAuth 未配置" }
    }
    const code = c.req.query("code")
    const state = c.req.query("state")
    const stored = getCookie(c, OAUTH_STATE_COOKIE)
    deleteCookie(c, OAUTH_STATE_COOKIE, { path: "/" })
    if (!code || !state || !stored) return { ok: false, message: "登录状态已过期，请重试" }
    const [expectedState, encodedReturn] = stored.split(":")
    if (state !== expectedState) return { ok: false, message: "OAuth state 校验失败" }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: this.cfg.githubClientId,
        client_secret: this.cfg.githubClientSecret,
        code,
        ...(this.cfg.githubCallbackUrl ? { redirect_uri: this.cfg.githubCallbackUrl } : {}),
      }),
    })
    const tokenJson = (await tokenRes.json().catch(() => null)) as { access_token?: string } | null
    if (!tokenJson?.access_token) return { ok: false, message: "GitHub 授权交换令牌失败" }

    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}`, Accept: "application/vnd.github+json", "User-Agent": "turnery-hub" },
    })
    const gh = (await userRes.json().catch(() => null)) as { id?: number; login?: string; name?: string; avatar_url?: string; bio?: string } | null
    if (!gh?.id || !gh.login) return { ok: false, message: "未能读取 GitHub 用户信息" }

    const handle = gh.login.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "")
    const validHandle = HANDLE_RE.test(handle) ? handle : `gh-${gh.id}`
    const user = store.upsertUser({
      handle: validHandle,
      displayName: gh.name?.trim() || gh.login,
      avatarUrl: gh.avatar_url ?? null,
      bio: gh.bio?.trim() ?? "",
      githubId: String(gh.id),
    })
    this.setSession(c, user.id)
    const returnTo = encodedReturn ? decodeURIComponent(encodedReturn) : "/community"
    return { ok: true, user, returnTo: returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/community" }
  }
}

function loadOrCreateSecret(hubDir: string): string {
  const file = path.join(hubDir, ".session-secret")
  try {
    const existing = fs.readFileSync(file, "utf8").trim()
    if (existing.length >= 32) return existing
  } catch {
    /* create below */
  }
  const fresh = crypto.randomBytes(32).toString("hex")
  fs.mkdirSync(hubDir, { recursive: true })
  fs.writeFileSync(file, `${fresh}\n`, { mode: 0o600 })
  return fresh
}
