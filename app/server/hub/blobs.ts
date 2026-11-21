// Content-addressed blob storage for community project files and previews.
// Default implementation stores blobs on local disk sharded by SHA-256 prefix;
// the BlobStore interface allows swapping to S3 / Cloudflare R2 without changing hub logic.
import crypto from "node:crypto"
import fs from "node:fs"
import fsp from "node:fs/promises"
import path from "node:path"

export const SHA256_RE = /^[0-9a-f]{64}$/

export interface BlobStore {
  put(bytes: Uint8Array): Promise<{ sha256: string; size: number; created: boolean }>
  get(sha256: string): Promise<Uint8Array | null>
  has(sha256: string): Promise<boolean>
}

export function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(bytes).digest("hex")
}

export class FileBlobStore implements BlobStore {
  readonly dir: string

  constructor(hubDir: string) {
    this.dir = path.join(hubDir, "blobs")
    fs.mkdirSync(this.dir, { recursive: true })
  }

  private filePath(sha256: string): string {
    if (!SHA256_RE.test(sha256)) throw new Error("Invalid blob sha256")
    return path.join(this.dir, sha256.slice(0, 2), sha256)
  }

  async has(sha256: string): Promise<boolean> {
    if (!SHA256_RE.test(sha256)) return false
    return fsp.access(this.filePath(sha256)).then(
      () => true,
      () => false,
    )
  }

  async put(bytes: Uint8Array): Promise<{ sha256: string; size: number; created: boolean }> {
    const sha256 = sha256Hex(bytes)
    const file = this.filePath(sha256)
    if (await this.has(sha256)) return { sha256, size: bytes.byteLength, created: false }
    await fsp.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${crypto.randomBytes(6).toString("hex")}.tmp`
    await fsp.writeFile(tmp, bytes)
    try {
      await fsp.rename(tmp, file)
    } catch {
      await fsp.rm(tmp, { force: true }).catch(() => {})
    }
    return { sha256, size: bytes.byteLength, created: true }
  }

  async get(sha256: string): Promise<Uint8Array | null> {
    if (!SHA256_RE.test(sha256)) return null
    try {
      const buf = await fsp.readFile(this.filePath(sha256))
      return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
    } catch {
      return null
    }
  }
}
