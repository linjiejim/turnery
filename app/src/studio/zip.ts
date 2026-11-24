// A minimal ZIP writer (stored, no compression) for exporting one STL per part.
// UTF-8 names (flag bit 11), so 「上盖.stl」 opens as itself. Made on Unix (host 3): macOS's unzip
// ignores the flag and recodes the names of files made on DOS from code page 437, which APFS refuses
// ("Illegal byte sequence"); a Unix name goes through as its bytes.

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
    cv.setUint16(4, (3 << 8) | 20, true) // made by: Unix, spec 2.0
    cv.setUint16(6, 20, true)
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, f.data.length, true)
    cv.setUint32(24, f.data.length, true)
    cv.setUint16(28, name.length, true)
    cv.setUint32(38, 0o100644 << 16 >>> 0, true) // a plain file, rw-r--r--
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

/** Most a project archive may hold, unpacked: a few STEP models and their parts. */
export const UNZIP_LIMITS = { files: 300, bytes: 200 * 1024 * 1024 }

/**
 * The files of a ZIP archive (stored or deflated, the two kinds every zip tool writes), folders left
 * out. Names are as written (forward slashes); entries whose names climb out (`..`) are dropped.
 * Rejects with a message the person can read when the archive is damaged, encrypted or too big.
 */
export async function unzip(bytes: Uint8Array): Promise<{ name: string; data: Uint8Array }[]> {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // The end-of-central-directory record: the last 22 bytes, or further back past a comment.
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (v.getUint32(i, true) === 0x06054b50) {
      end = i
      break
    }
  }
  if (end < 0) throw new Error("not a zip")
  const count = v.getUint16(end + 10, true)
  if (count > UNZIP_LIMITS.files) throw new Error(`too many files (${count})`)
  let at = v.getUint32(end + 16, true)
  const dec = new TextDecoder()
  const out: { name: string; data: Uint8Array }[] = []
  let total = 0
  for (let n = 0; n < count; n++) {
    if (v.getUint32(at, true) !== 0x02014b50) throw new Error("damaged zip")
    const flags = v.getUint16(at + 8, true)
    const method = v.getUint16(at + 10, true)
    const packed = v.getUint32(at + 20, true)
    const size = v.getUint32(at + 24, true)
    const nameLen = v.getUint16(at + 28, true)
    const extraLen = v.getUint16(at + 30, true)
    const commentLen = v.getUint16(at + 32, true)
    const local = v.getUint32(at + 42, true)
    const name = dec.decode(bytes.subarray(at + 46, at + 46 + nameLen)).replace(/\\/g, "/")
    at += 46 + nameLen + extraLen + commentLen
    if (name.endsWith("/")) continue
    if (flags & 1) throw new Error("encrypted zip")
    if (name.split("/").some((s) => s === "..") || name.startsWith("/")) continue
    total += size
    if (total > UNZIP_LIMITS.bytes) throw new Error("zip too big")
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const raw = bytes.subarray(start, start + packed)
    let data: Uint8Array
    if (method === 0) data = raw.slice()
    else if (method === 8) data = new Uint8Array(await new Response(new Blob([raw as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer())
    else throw new Error(`unsupported compression (${method})`)
    out.push({ name, data })
  }
  return out
}
