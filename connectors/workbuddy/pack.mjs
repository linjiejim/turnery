#!/usr/bin/env node
// Packs the WorkBuddy connector (MCP + Skill) for upload to open.workbuddy.cn.
//   node connectors/workbuddy/pack.mjs           → connectors/workbuddy/dist/turnery-workbuddy-<version>.zip
//   node connectors/workbuddy/pack.mjs --check   → only check that every published manifest carries the same version
// The skill is copied from the Claude/Codex plugin and the 64 px icon from the desktop app at pack time, so neither has a second copy here.
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../..")
const json = (p) => JSON.parse(readFileSync(path.join(root, p), "utf8"))

// Every file that carries the release version. A release bumps all of them together.
const server = json("packages/turnery-mcp/server.json")
const lock = json("desktop/package-lock.json")
const versions = {
  "desktop/package.json": json("desktop/package.json").version,
  "desktop/package-lock.json": lock.version,
  'desktop/package-lock.json packages[""]': lock.packages?.[""]?.version,
  "plugin/.claude-plugin/plugin.json": json("plugin/.claude-plugin/plugin.json").version,
  "plugin/plugin.json": json("plugin/plugin.json").version,
  "packages/turnery-mcp/package.json": json("packages/turnery-mcp/package.json").version,
  "packages/turnery-mcp/server.json": server.version,
  "packages/turnery-mcp/server.json packages[0]": server.packages[0].version,
}
const version = versions["desktop/package.json"]
const off = Object.entries(versions).filter(([, v]) => v !== version)
if (off.length) {
  console.error(`版本不一致（desktop/package.json 是 ${version}）：`)
  for (const [file, v] of off) console.error(`  ${file}: ${v}`)
  process.exit(1)
}

const meta = json("connectors/workbuddy/connector-meta.json")
const problems = []
for (const k of ["name", "name_en", "description", "description_zh", "description_en", "source", "examples_zh", "examples_en"]) {
  if (meta[k] == null || meta[k].length === 0) problems.push(`connector-meta.json 缺少 ${k}`)
}
if (!/^[a-z0-9-]+$/.test(meta.source ?? "")) problems.push("source 只能是小写字母、数字和连字符")
for (const k of ["description_zh", "description_en"]) {
  const n = [...(meta[k] ?? "")].length
  if (n < 20 || n > 100) problems.push(`${k} 有 ${n} 个字符，平台建议 20–100`)
}
const servers = Object.values(json("connectors/workbuddy/mcp.json").mcpServers ?? {})
if (servers.length !== 1) problems.push(`mcp.json 里要正好一个 server，现在是 ${servers.length} 个`)
// Fields newer than the base set need minWorkbuddyVersion (see 版本兼容性 in the platform docs).
const atLeast = (v, min) => {
  const [a, b] = [v, min].map((s) => String(s ?? "0").split(".").map(Number))
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0)
  return true
}
if (servers.some((s) => s.runtime || s.npmRegistry || s.npmRegistries) && !atLeast(meta.minWorkbuddyVersion, "5.0.0"))
  problems.push("mcp.json 用了 runtime / npmRegistry，minWorkbuddyVersion 至少要 5.0.0")
if ((meta.name_zh || meta.examples_zh) && !atLeast(meta.minWorkbuddyVersion, "4.24.0"))
  problems.push("用了 name_zh / examples_zh，minWorkbuddyVersion 至少要 4.24.0")
if (problems.length) {
  for (const p of problems) console.error(p)
  process.exit(1)
}

if (process.argv.includes("--check")) {
  console.log(`版本一致：${version}；连接器元信息检查通过`)
  process.exit(0)
}

const dist = path.join(here, "dist")
const stage = path.join(dist, "turnery")
rmSync(stage, { recursive: true, force: true })
mkdirSync(path.join(stage, "skills"), { recursive: true })
writeFileSync(path.join(stage, "connector-meta.json"), `${JSON.stringify({ ...meta, version }, null, 2)}\n`)
cpSync(path.join(here, "mcp.json"), path.join(stage, "mcp.json"))
cpSync(path.join(root, "desktop/resources/icon-64.png"), path.join(stage, "icon.png"))
cpSync(path.join(root, "plugin/skills/build-part"), path.join(stage, "skills/build-part"), { recursive: true })

const zip = path.join(dist, `turnery-workbuddy-${version}.zip`)
rmSync(zip, { force: true })
execFileSync("/usr/bin/zip", ["-r", "-X", "-q", zip, ".", "-x", "*.DS_Store"], { cwd: stage })
console.log(`${path.relative(root, zip)}`)
console.log(execFileSync("/usr/bin/unzip", ["-l", zip]).toString())
