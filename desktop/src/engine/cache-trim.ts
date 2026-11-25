// Turnery's caches under ~/.turnery/cache (components and assembly previews, built steps) keep one
// folder per build of the app, named by its hash: a build never reads another's entries, so an update
// leaves the old build's folder behind for good. Each cache's root is kept under one limit as a whole,
// every build's folder counted together, the least recently used entries going first.
import { readdir, rm, rmdir, stat } from "node:fs/promises"
import path from "node:path"

export type CacheLimits = {
  /** The whole root: every build's folder together. */
  bytes: number
  files: number
  /** An entry of another build unused this long goes, however much room is left. */
  staleMs?: number
}

export const DAY_MS = 86_400_000
/** A temp file left by a crash is old news after an hour. */
const TEMP_MS = 3_600_000
/** Folders below a build's own (a step store's shards, the assembly previews). */
const DEPTH = 3

type Entry = { file: string; size: number; at: number; other: boolean }

/**
 * Keep `root` under `limits`, least recently used first (an entry's modification time is its last use:
 * the caches touch an entry when they read it). `current`: this build's folder name, whose entries never
 * go stale and whose folders stay even when empty (it may be writing into them). Folders of other builds
 * that end up empty go. Never throws: cache upkeep must not get in the way of opening a model.
 */
export async function trimCacheRoot(root: string, current: string | null, limits: CacheLimits, now = Date.now()): Promise<void> {
  try {
    const entries: Entry[] = []
    /** Other builds' folders, deepest first: removed once empty. */
    const folders: string[] = []
    const walk = async (dir: string, depth: number, other: boolean) => {
      for (const d of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
        const at = path.join(dir, d.name)
        if (d.isDirectory()) {
          if (depth >= DEPTH) continue
          await walk(at, depth + 1, other)
          if (other) folders.push(at)
        } else if (d.isFile()) {
          const st = await stat(at).catch(() => null)
          if (!st) continue
          if (d.name.endsWith(".tmp")) {
            if (now - st.mtimeMs > TEMP_MS) await rm(at, { force: true })
          } else entries.push({ file: at, size: st.size, at: st.mtimeMs, other })
        }
      }
    }
    for (const d of await readdir(root, { withFileTypes: true })) {
      if (!d.isDirectory()) continue
      const dir = path.join(root, d.name)
      const other = d.name !== current
      await walk(dir, 1, other)
      if (other) folders.push(dir)
    }
    entries.sort((a, b) => b.at - a.at)
    let bytes = 0
    let files = 0
    for (const e of entries) {
      const stale = e.other && limits.staleMs !== undefined && now - e.at > limits.staleMs
      if (!stale) {
        bytes += e.size
        files++
      }
      if (stale || files > limits.files || bytes > limits.bytes) await rm(e.file, { force: true })
    }
    // Only empty ones go: rmdir refuses a folder with something in it (another process just wrote there).
    for (const dir of folders) await rmdir(dir).catch(() => {})
  } catch {
    /* no root yet, or not readable: nothing to keep in check */
  }
}
