// A minimal ZIP writer (stored, no compression) for exporting one STL per part.
// UTF-8 names (flag bit 11), so 「上盖.stl」 opens as itself.

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zipStore(files: { name: string; data: Uint8Array }[]): Blob {
  const enc = new TextEncoder()
  const chunks: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const crc = crc32(f.data)
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true)
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // UTF-8 names
    lv.setUint16(8, 0, true) // stored
    lv.setUint32(14, crc, true)
    lv.setUint32(18, f.data.length, true)
    lv.setUint32(22, f.data.length, true)
    lv.setUint16(26, name.length, true)
    local.set(name, 30)
    chunks.push(local, f.data)

    const cd = new Uint8Array(46 + name.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true)
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, f.data.length, true)
    cv.setUint32(24, f.data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(42, offset, true)
    cd.set(name, 46)
    central.push(cd)
    offset += local.length + f.data.length
  }
  const size = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true)
  ev.setUint16(10, files.length, true)
  ev.setUint32(12, size, true)
  ev.setUint32(16, offset, true)
  return new Blob([...chunks, ...central, end] as BlobPart[], { type: "application/zip" })
}

/** STEP strings are ASCII: other characters go as \X2\…\X0\ (UTF-16, hex). */
export function stepAscii(text: string): string {
  return text.replace(/[^\x20-\x7e\n\r\t]+/g, (run) => `\\X2\\${Array.from({ length: run.length }, (_, i) => run.charCodeAt(i).toString(16).toUpperCase().padStart(4, "0")).join("")}\\X0\\`)
}

/**
 * Minimal ZIP reader: reads stored (method 0) and deflate (method 8) entries
 * using the standard Web/Node DecompressionStream API. Rejects malformed archives
 * or entries exceeding `maxBytes` / `maxFiles`.
 */
export async function unzipStore(
  bytes: Uint8Array,
  opts: { maxFiles?: number; maxTotalBytes?: number } = {},
): Promise<{ name: string; data: Uint8Array }[]> {
  const maxFiles = opts.maxFiles ?? 100
  const maxTotalBytes = opts.maxTotalBytes ?? 32 * 1024 * 1024
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Find End of Central Directory record (signature 0x06054b50) scanning backward.
  let eocd = -1
  const minOffset = Math.max(0, bytes.byteLength - 65557)
  for (let i = bytes.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error("Not a valid ZIP archive (missing EOCD)")
  const count = view.getUint16(eocd + 10, true)
  const cdOffset = view.getUint32(eocd + 16, true)
  if (count > maxFiles) throw new Error(`ZIP has too many entries (${count}, max ${maxFiles})`)

  const dec = new TextDecoder("utf-8", { fatal: false })
  const out: { name: string; data: Uint8Array }[] = []
  let pos = cdOffset
  let total = 0
  for (let i = 0; i < count; i++) {
    if (pos + 46 > bytes.byteLength || view.getUint32(pos, true) !== 0x02014b50) {
      throw new Error("Malformed ZIP central directory")
    }
    const method = view.getUint16(pos + 10, true)
    const compSize = view.getUint32(pos + 20, true)
    const uncompSize = view.getUint32(pos + 24, true)
    const nameLen = view.getUint16(pos + 28, true)
    const extraLen = view.getUint16(pos + 30, true)
    const commentLen = view.getUint16(pos + 32, true)
    const localOffset = view.getUint32(pos + 42, true)
    const name = dec.decode(bytes.subarray(pos + 46, pos + 46 + nameLen))
    pos += 46 + nameLen + extraLen + commentLen
    // Skip directories and macOS resource forks.
    if (name.endsWith("/") || name.startsWith("__MACOSX/")) continue
    if (total + uncompSize > maxTotalBytes) throw new Error(`ZIP exceeds maximum uncompressed size (${Math.round(maxTotalBytes / (1024 * 1024))} MB)`)
    if (localOffset + 30 > bytes.byteLength || view.getUint32(localOffset, true) !== 0x04034b50) {
      throw new Error(`Malformed local header for ${name}`)
    }
    const lNameLen = view.getUint16(localOffset + 26, true)
    const lExtraLen = view.getUint16(localOffset + 28, true)
    const dataStart = localOffset + 30 + lNameLen + lExtraLen
    if (dataStart + compSize > bytes.byteLength) throw new Error(`Truncated ZIP entry: ${name}`)
    const raw = bytes.subarray(dataStart, dataStart + compSize)
    let data: Uint8Array
    if (method === 0) {
      data = raw.slice()
    } else if (method === 8) {
      data = await inflateRaw(raw, maxTotalBytes - total)
    } else {
      throw new Error(`Unsupported ZIP compression method ${method} for ${name}`)
    }
    total += data.byteLength
    if (total > maxTotalBytes) throw new Error(`ZIP exceeds maximum uncompressed size`)
    out.push({ name, data })
  }
  return out
}

async function inflateRaw(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw")
  const writer = ds.writable.getWriter()
  const writeDone = writer.write(new Uint8Array(data)).then(() => writer.close())
  const reader = ds.readable.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > limit) {
      await reader.cancel().catch(() => {})
      throw new Error("Decompressed ZIP entry exceeds size limit")
    }
    chunks.push(value)
  }
  await writeDone
  const merged = new Uint8Array(size)
  let off = 0
  for (const c of chunks) {
    merged.set(c, off)
    off += c.byteLength
  }
  return merged
}
