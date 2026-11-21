// Tests for the open package spec (`turnery.json`), security validation,
// release diffing, ZIP round-trip, and geometry/BOM analysis.
import { describe, expect, it } from "vitest"
import {
  bumpSemver,
  computeReleaseDiff,
  encodeBase64,
  normalizeProjectPath,
  scanSecrets,
  slugify,
  validateProjectFiles,
  type BundleFileInput,
} from "@/hub/package"
import { analyzeModel, bomToCsv, bomToMarkdown } from "@/studio/analysis"
import type { Tree } from "@/studio/dsl"
import type { BuildReport } from "@/studio/kernel/build"
import { unzipStore, zipStore } from "@/studio/zip"

const BOX_TREE: Tree = {
  params: { W: 60, D: 40, H: 20 },
  features: [
    { id: "sk", op: "sketch", name: "Base", on: { plane: "XY" }, shapes: [{ type: "rect", w: "W", h: "D" }] },
    { id: "ext", op: "extrude", name: "Body", sketch: "sk", distance: "H" },
  ],
}

const VALID_STEP = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"

describe("hub/package path normalization & secret scanner", () => {
  it("normalizes safe relative paths and rejects traversal / hidden / private files", () => {
    expect(normalizeProjectPath("./parts/base.turnery.json")).toBe("parts/base.turnery.json")
    expect(normalizeProjectPath("assets\\motor.step")).toBe("assets/motor.step")
    expect(normalizeProjectPath("../etc/passwd")).toBeNull()
    expect(normalizeProjectPath("/etc/passwd")).toBeNull()
    expect(normalizeProjectPath("foo/../../bar.json")).toBeNull()
    expect(normalizeProjectPath(".git/config")).toBeNull()
    expect(normalizeProjectPath(".env")).toBeNull()
    expect(normalizeProjectPath("parts/.env.local")).toBeNull()
    expect(normalizeProjectPath("main.notes.json")).toBeNull()
    expect(normalizeProjectPath("foo\0bar.json")).toBeNull()
  })

  it("detects leaked API keys, tokens, and private key headers", () => {
    expect(scanSecrets("hello world")).toBe(false)
    expect(scanSecrets("sk-proj-1234567890abcdefghij123456")).toBe(true)
    expect(scanSecrets("ghp_1234567890abcdefghijklmnopqrstuvwx")).toBe(true)
    expect(scanSecrets("trn_1234567890abcdefghijklmnop")).toBe(true)
    expect(scanSecrets("-----BEGIN RSA PRIVATE KEY-----\nabc")).toBe(true)
  })

  it("slugifies titles and bumps semver cleanly", () => {
    expect(slugify("Raspberry Pi 5 Enclosure")).toBe("raspberry-pi-5-enclosure")
    expect(bumpSemver("1.0.0", "patch")).toBe("1.0.1")
    expect(bumpSemver("1.2.3", "minor")).toBe("1.3.0")
    expect(bumpSemver("1.2.3", "major")).toBe("2.0.0")
  })
})

describe("hub/package validateProjectFiles", () => {
  it("accepts a multi-part assembly with shared params and a STEP asset", () => {
    const asmTree: Tree = {
      uses: "shared.params.json",
      params: {},
      features: [
        { id: "c1", op: "component", name: "Base", file: "parts/base.turnery.json" },
        { id: "imp", op: "import", name: "Motor", file: "assets/motor.step" },
      ],
    }
    const files: BundleFileInput[] = [
      { path: "shared.params.json", encoding: "utf8", content: JSON.stringify({ params: { W: 60, D: 40, H: 20 } }) },
      { path: "parts/base.turnery.json", encoding: "utf8", content: JSON.stringify(BOX_TREE) },
      { path: "assets/motor.step", encoding: "base64", content: encodeBase64(new TextEncoder().encode(VALID_STEP)) },
      { path: "main.turnery-asm.json", encoding: "utf8", content: JSON.stringify(asmTree) },
    ]
    const res = validateProjectFiles(files, "main.turnery-asm.json")
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.kind).toBe("assembly")
    expect(res.entry).toBe("main.turnery-asm.json")
    expect(res.files).toHaveLength(4)
  })

  it("rejects path traversal, .notes.json, leaked secrets, bad STEP headers, and out-of-bounds references", () => {
    expect(
      validateProjectFiles([{ path: "../escape.turnery.json", encoding: "utf8", content: JSON.stringify(BOX_TREE) }], "../escape.turnery.json").ok,
    ).toBe(false)

    expect(
      validateProjectFiles(
        [
          { path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(BOX_TREE) },
          { path: "main.notes.json", encoding: "utf8", content: "{}" },
        ],
        "main.turnery.json",
      ).ok,
    ).toBe(false)

    expect(
      validateProjectFiles(
        [
          { path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(BOX_TREE) },
          { path: "README.md", encoding: "utf8", content: "token=ghp_1234567890abcdefghijklmnopqrstuvwx" },
        ],
        "main.turnery.json",
      ).ok,
    ).toBe(false)

    expect(
      validateProjectFiles(
        [
          { path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(BOX_TREE) },
          { path: "assets/fake.step", encoding: "utf8", content: "not a real step file" },
        ],
        "main.turnery.json",
      ).ok,
    ).toBe(false)

    const escapingTree: Tree = { ...BOX_TREE, uses: "../../outside.params.json" }
    expect(
      validateProjectFiles([{ path: "main.turnery.json", encoding: "utf8", content: JSON.stringify(escapingTree) }], "main.turnery.json").ok,
    ).toBe(false)
  })
})

describe("hub/package computeReleaseDiff", () => {
  it("reports added/removed files and parameter/feature deltas", () => {
    const prev = new Map([["main.turnery.json", { sha256: "aaa", tree: BOX_TREE }]])
    const nextTree: Tree = {
      params: { W: 80, D: 40, H: 20, R: 3 },
      features: [
        ...BOX_TREE.features,
        { id: "fil", op: "fillet", name: "Edge fillet", r: "R", edges: { of: "ext" } },
      ],
    }
    const next = new Map([
      ["main.turnery.json", { sha256: "bbb", tree: nextTree }],
      ["README.md", { sha256: "ccc" }],
    ])
    const diff = computeReleaseDiff(prev, next)
    expect(diff.filesAdded).toContain("README.md")
    expect(diff.filesChanged).toContain("main.turnery.json")
    expect(diff.filesRemoved).toHaveLength(0)
    expect(diff.treeChanges.length).toBeGreaterThan(0)
  })
})

describe("studio/zip round-trip", () => {
  it("packs and unpacks UTF-8 filenames and binary STEP payloads without corruption", async () => {
    const enc = new TextEncoder()
    const payload = [
      { name: "turnery.json", data: enc.encode('{"schema":1}') },
      { name: "parts/支架.turnery.json", data: enc.encode(JSON.stringify(BOX_TREE)) },
      { name: "assets/motor.step", data: enc.encode(VALID_STEP) },
    ]
    const packed = zipStore(payload)
    const unpacked = await unzipStore(new Uint8Array(await packed.arrayBuffer()))
    expect(unpacked.map((e) => e.name)).toEqual(payload.map((e) => e.name))
    expect(new TextDecoder().decode(unpacked[1].data)).toBe(JSON.stringify(BOX_TREE))
    expect(new TextDecoder().decode(unpacked[2].data)).toBe(VALID_STEP)
  })
})

describe("studio/analysis geometry, mass & BOM", () => {
  it("computes bounding box, volume, material masses, diagnostics, checks, and grouped BOM", () => {
    const asmTree: Tree = {
      params: { W: 60 },
      features: [
        { id: "c1", op: "component", name: "Base", file: "parts/base.turnery.json" },
        { id: "b1", op: "component", name: "Bolt A", standard: { kind: "shcs", size: "M4", length: 12 } },
        { id: "b2", op: "component", name: "Bolt B", standard: { kind: "shcs", size: "M4", length: 12 } },
        { id: "m1", op: "component", name: "Motor", file: "assets/motor.step" },
      ],
    }
    const report: BuildReport = {
      params: { W: 60 },
      body: {
        solids: 4,
        faces: 48,
        edges: 96,
        volume: 24_000, // 24 cm³
        size: [60, 40, 20],
      },
      features: [
        { id: "c1", op: "component", name: "Base", state: "ok" },
        { id: "b1", op: "component", name: "Bolt A", state: "ok" },
        { id: "b2", op: "component", name: "Bolt B", state: "ok" },
        { id: "m1", op: "component", name: "Motor", state: "ok", warnings: ["Imported shell has 1 small gap"] },
      ],
      paramError: "Parameter conflict on bolt length",
      parts: [
        { id: "c1", name: "Base", volume: 18_000, size: [60, 40, 10] },
        { id: "b1", name: "Bolt A", volume: 500, size: [7, 7, 16] },
        { id: "b2", name: "Bolt B", volume: 500, size: [7, 7, 16] },
        { id: "m1", name: "Motor", volume: 5_000, size: [28, 28, 20] },
      ],
      checks: [
        { check: { kind: "bbox", size: [60, 40, 20] }, pass: true, actual: [60, 40, 20], expected: [60, 40, 20] },
        { check: { kind: "interference" }, pass: false, actual: 1, expected: 0, detail: "Bolt A intersects Base" },
      ],
    }
    const res = analyzeModel(asmTree, report, { fileName: "main.turnery-asm.json" })
    expect(res.sizeMm).toEqual([60, 40, 20])
    expect(res.volumeCm3).toBeCloseTo(24, 3)
    expect(res.checksPassed).toBe(1)
    expect(res.checksTotal).toBe(2)
    expect(res.diagnostics.some((d) => d.severity === "warning")).toBe(true)
    expect(res.diagnostics.some((d) => d.severity === "error")).toBe(true)
    const pla = res.masses.find((m) => m.material.id === "pla")
    expect(pla?.grams).toBeCloseTo(24 * 1.24, 1)

    // Both identical M4×12 socket head cap screws group into a single BOM row with count = 2
    const boltRow = res.bom.find((r) => r.kind === "standard")
    expect(boltRow?.count).toBe(2)
    expect(res.bom.find((r) => r.kind === "step")?.file).toBe("assets/motor.step")
    expect(res.bom.find((r) => r.kind === "part")?.file).toBe("parts/base.turnery.json")

    const md = bomToMarkdown("Test Assembly", res.bom, "en")
    expect(md).toContain("Bill of Materials: Test Assembly")
    expect(md).toContain("assets/motor.step")
    const csv = bomToCsv(res.bom)
    expect(csv).toContain("no,name,file,kind,qty,volume_cm3,size_x_mm,size_y_mm,size_z_mm")
  })
})
