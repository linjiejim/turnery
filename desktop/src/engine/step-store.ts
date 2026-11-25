// What a part's steps built, kept on disk between sessions (kernel/build.ts, StepStore): opening a part
// that was built before reads its bodies back instead of building them again, and editing a late feature
// rebuilds from there. A disposable cache: corrupt, stale or missing entries are misses and the step is
// built. Runs inside the kernel thread, synchronously: the kernel asks in the middle of a rebuild, and
// keeps a slow step as soon as it is built, which must be on disk even if the thread is ended right after.
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, renameSync, rmSync, utimes, writeFileSync } from "node:fs"
import path from "node:path"
import { deserialize, serialize } from "node:v8"
import { deflateSync, inflateSync } from "node:zlib"
import type { StepStore } from "../../../app/src/studio/kernel/build"
import { DAY_MS, trimCacheRoot, type CacheLimits } from "./cache-trim"

const hash = (data: string | Uint8Array) => createHash("sha256").update(data).digest()
/** Entry file: "TRS1", the payload's SHA-256, then the deflated v8 payload. */
const MAGIC = Buffer.from("TRS1")

export type StoreLimits = CacheLimits
/** Every build of the app keeps its own folder under one root; the root as a whole is kept under these. */
export const STEP_LIMITS: StoreLimits = { bytes: 1024 * 1024 * 1024, files: 20_000, staleMs: 14 * DAY_MS }

export class DiskStepStore implements StepStore {
  private trimmed = 0
  private trimming: Promise<void> | null = null
  /**
   * `dir`: this build's folder (its name is the build's hash); `root`: the folder holding every build's, trimmed
   * as one (an old build's entries are the oldest, so they go first).
   */
  constructor(
    private readonly dir: string,
    private readonly root = path.dirname(dir),
    private readonly limits = STEP_LIMITS,
  ) {}

  private file(key: string) {
    const name = hash(key).toString("hex")
    return path.join(this.dir, name.slice(0, 2), `${name}.rec`)
  }

  get(key: string): unknown {
    const file = this.file(key)
    let raw: Buffer
    try {
      raw = readFileSync(file)
    } catch {
      return null
    }
    if (raw.length < 36 || !raw.subarray(0, 4).equals(MAGIC)) return null
    const payload = raw.subarray(36)
    if (!hash(payload).equals(raw.subarray(4, 36))) return null
    try {
      const value = deserialize(inflateSync(payload))
      // Recently used: the last to go when the folder is trimmed.
      const now = new Date()
      utimes(file, now, now, () => {})
      return value
    } catch {
      return null
    }
  }

  put(key: string, value: unknown) {
    const file = this.file(key)
    const temp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`
    try {
      const packed = deflateSync(serialize(value), { level: 1 })
      mkdirSync(path.dirname(file), { recursive: true })
      writeFileSync(temp, Buffer.concat([MAGIC, hash(packed), packed]), { mode: 0o600 })
      renameSync(temp, file)
    } catch {
      rmSync(temp, { force: true })
    }
    if (Date.now() - this.trimmed > 60_000) {
      this.trimmed = Date.now()
      this.trimming = this.trim().finally(() => (this.trimming = null))
    }
  }

  /** Until a trim under way is done. */
  async flush() {
    await this.trimming
  }

  /** Keep the root under its limits, oldest entries (by last use) first. Never in the way of opening a part. */
  async trim() {
    this.trimmed = Date.now()
    await trimCacheRoot(this.root, path.basename(this.dir), this.limits)
  }

  /** The folder exists (so the first read of a fresh build isn't a string of failures over a missing path). */
  static open(dir: string) {
    try {
      mkdirSync(dir, { recursive: true })
    } catch {
      return null
    }
    return new DiskStepStore(dir)
  }
}
