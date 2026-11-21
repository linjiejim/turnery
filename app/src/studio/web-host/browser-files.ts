// The engine's file system in a browser: every file in memory, written through to IndexedDB so the
// projects are still there tomorrow. Paths are virtual and absolute (`/web/projects/盒子/盒子.turnery.json`).
// Where IndexedDB can't be used (a private window, no quota) the files live in memory only, and
// `persistent` says so.
import type { Files } from "@/desktop/core/engine"

export type FileData = string | Uint8Array
type Entry = { data: FileData; mtime: number }

/** Where the files are kept between visits. */
export interface FileStore {
  loadAll(): Promise<Map<string, Entry>>
  put(path: string, entry: Entry): Promise<void>
  remove(paths: string[]): Promise<void>
}

/** Nothing kept: tests, and browsers without IndexedDB. */
export const memoryStore = (): FileStore => ({ loadAll: async () => new Map(), put: async () => {}, remove: async () => {} })

const DB = "turnery-web"
const STORE = "files"

const request = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })

const done = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("aborted"))
  })

/** The files in this browser's IndexedDB. Rejects when it can't be opened. */
export async function indexedDbStore(): Promise<FileStore> {
  if (typeof indexedDB === "undefined") throw new Error("no IndexedDB")
  const open = indexedDB.open(DB, 1)
  open.onupgradeneeded = () => open.result.createObjectStore(STORE)
  const db = await request(open)
  return {
    async loadAll() {
      const tx = db.transaction(STORE, "readonly")
      const store = tx.objectStore(STORE)
      const [keys, values] = await Promise.all([request(store.getAllKeys()), request(store.getAll())])
      const out = new Map<string, Entry>()
      keys.forEach((k, i) => {
        const v = values[i] as Entry | undefined
        if (typeof k === "string" && v && (typeof v.data === "string" || v.data instanceof Uint8Array)) out.set(k, v)
      })
      return out
    },
    async put(path, entry) {
      const tx = db.transaction(STORE, "readwrite")
      tx.objectStore(STORE).put(entry, path)
      await done(tx)
    },
    async remove(paths) {
      if (!paths.length) return
      const tx = db.transaction(STORE, "readwrite")
      for (const p of paths) tx.objectStore(STORE).delete(p)
      await done(tx)
    },
  }
}

/** `a/./b/../c` → `a/c`, one slash between segments, no slash at the end. */
export function normPath(p: string) {
  const out: string[] = []
  for (const seg of p.replace(/\\/g, "/").split("/")) {
    if (!seg || seg === ".") continue
    if (seg === "..") out.pop()
    else out.push(seg)
  }
  return `/${out.join("/")}`
}

const sizeOf = (d: FileData) => (typeof d === "string" ? new TextEncoder().encode(d).byteLength : d.byteLength)

export class BrowserFiles implements Files {
  private disk = new Map<string, Entry>()
  private watchers = new Map<string, Set<() => void>>()
  private listeners = new Set<() => void>()
  private clock = 0
  /** Writes to the store, one after another (so a delete never overtakes the write before it). */
  private chain: Promise<unknown> = Promise.resolve()
  /** False once the store failed (or there never was one): the files last as long as the page. */
  persistent: boolean
  private readonly store: FileStore

  private constructor(store: FileStore, persistent: boolean, disk: Map<string, Entry>) {
    this.store = store
    this.persistent = persistent
    this.disk = disk
    for (const e of disk.values()) this.clock = Math.max(this.clock, e.mtime)
  }

  /** The files kept in this browser (or, without IndexedDB, an empty disk in memory). */
  static async open(store?: FileStore): Promise<BrowserFiles> {
    if (store) return new BrowserFiles(store, true, await store.loadAll())
    try {
      const idb = await indexedDbStore()
      return new BrowserFiles(idb, true, await idb.loadAll())
    } catch {
      return new BrowserFiles(memoryStore(), false, new Map())
    }
  }

  /** Called after any change: a file written, renamed or removed. */
  onChange(cb: () => void) {
    this.listeners.add(cb)
    return () => void this.listeners.delete(cb)
  }

  private changed() {
    for (const cb of this.listeners) cb()
  }

  private persist(fn: () => Promise<void>) {
    this.chain = this.chain.then(fn).catch(() => {
      // Quota or a closed database: keep working in memory, and say so.
      if (this.persistent) {
        this.persistent = false
        this.changed()
      }
    })
    return this.chain
  }

  /** Every write is newer than the one before, even within one millisecond. */
  private tick() {
    this.clock = Math.max(Date.now(), this.clock + 1)
    return this.clock
  }

  /** Wait until everything written so far is in the store. */
  flush() {
    return this.chain.then(() => undefined)
  }

  // ------------------------------------------------------------------ Files

  async read(raw: string) {
    const e = this.disk.get(normPath(raw))
    return e === undefined ? null : typeof e.data === "string" ? e.data : new TextDecoder().decode(e.data)
  }

  async readBytes(raw: string) {
    const e = this.disk.get(normPath(raw))
    return e === undefined ? null : typeof e.data === "string" ? new TextEncoder().encode(e.data) : e.data
  }

  async stat(raw: string) {
    const e = this.disk.get(normPath(raw))
    return e === undefined ? null : { size: sizeOf(e.data), mtimeMs: e.mtime }
  }

  async list(raw: string) {
    const dir = normPath(raw)
    const prefix = dir === "/" ? "/" : `${dir}/`
    const out = new Map<string, boolean>()
    for (const k of this.disk.keys()) {
      if (!k.startsWith(prefix)) continue
      const rest = k.slice(prefix.length).split("/")
      out.set(rest[0], rest.length > 1 || out.get(rest[0]) === true)
    }
    return out.size ? [...out].map(([name, isDir]) => ({ name, dir: isDir })) : null
  }

  /** A write by the engine: its own watchers don't hear it (it knows what it wrote). */
  async write(raw: string, data: FileData) {
    this.set(normPath(raw), data)
  }

  async rename(rawFrom: string, rawTo: string) {
    const from = normPath(rawFrom)
    const to = normPath(rawTo)
    if (this.exists(to)) throw new Error(`${to} 已经存在`)
    const moved = [...this.disk.keys()].filter((k) => k === from || k.startsWith(`${from}/`))
    if (!moved.length) throw new Error(`没有 ${from}`)
    const writes: [string, Entry][] = []
    for (const k of moved) {
      const e = { data: this.disk.get(k)!.data, mtime: this.tick() }
      const dest = to + k.slice(from.length)
      this.disk.set(dest, e)
      this.disk.delete(k)
      writes.push([dest, e])
    }
    void this.persist(async () => {
      for (const [p, e] of writes) await this.store.put(p, e)
      await this.store.remove(moved)
    })
    for (const k of moved) this.notify(k)
    this.changed()
  }

  watch(raw: string, cb: () => void) {
    const p = normPath(raw)
    let set = this.watchers.get(p)
    if (!set) this.watchers.set(p, (set = new Set()))
    set.add(cb)
    return () => void set.delete(cb)
  }

  async same(a: string, b: string) {
    return normPath(a) === normPath(b)
  }

  canonical(p: string) {
    return normPath(p)
  }

  // ------------------------------------------------------------- the page's

  /** A file or a folder (anything under it) is there. */
  exists(raw: string) {
    const p = normPath(raw)
    if (this.disk.has(p)) return true
    for (const k of this.disk.keys()) if (k.startsWith(`${p}/`)) return true
    return false
  }

  /** Every file under a folder (absolute paths), sorted. */
  under(raw: string) {
    const dir = normPath(raw)
    return [...this.disk.keys()].filter((k) => k.startsWith(`${dir}/`)).sort()
  }

  /** A write by the page (an upload, an undo): open parts that read the file follow it. */
  async put(raw: string, data: FileData) {
    const p = normPath(raw)
    this.set(p, data)
    this.notify(p)
  }

  /** Remove a file or a folder with everything in it; returns what was there, for undo. */
  async remove(raw: string): Promise<{ path: string; data: FileData }[]> {
    const p = normPath(raw)
    const gone = [...this.disk.entries()].filter(([k]) => k === p || k.startsWith(`${p}/`)).map(([path, e]) => ({ path, data: e.data }))
    for (const g of gone) this.disk.delete(g.path)
    if (!gone.length) return gone
    void this.persist(() => this.store.remove(gone.map((g) => g.path)))
    for (const g of gone) this.notify(g.path)
    this.changed()
    return gone
  }

  private set(p: string, data: FileData) {
    const e = { data, mtime: this.tick() }
    this.disk.set(p, e)
    void this.persist(() => this.store.put(p, e))
    this.changed()
  }

  private notify(p: string) {
    for (const cb of this.watchers.get(p) ?? []) cb()
  }
}
