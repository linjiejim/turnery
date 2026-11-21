// Geometry, printability, mass and BOM analysis derived from a Tree + BuildReport.
// Runs purely client-side (or in CLI/CI) with zero server compute.
import { componentName, type Tree } from "./dsl"
import { num as evalNum } from "./expr"
import { designation } from "./fasteners"
import type { BuildReport } from "./kernel/build"

export type MaterialSpec = {
  id: string
  nameZh: string
  nameEn: string
  /** Density in g/cm³. */
  density: number
  /** Typical infill factor for 3D printing (1.0 = solid). */
  infill?: number
}

export const MATERIALS: MaterialSpec[] = [
  { id: "pla", nameZh: "PLA（100% 实心）", nameEn: "PLA (solid)", density: 1.24 },
  { id: "pla20", nameZh: "PLA（约 20% 填充估算）", nameEn: "PLA (~20% infill est.)", density: 1.24, infill: 0.35 },
  { id: "petg", nameZh: "PETG", nameEn: "PETG", density: 1.27 },
  { id: "abs", nameZh: "ABS", nameEn: "ABS", density: 1.04 },
  { id: "pa12", nameZh: "尼龙 PA12", nameEn: "Nylon PA12", density: 1.01 },
  { id: "al6061", nameZh: "6061 铝合金", nameEn: "6061 Aluminum", density: 2.7 },
]

export type BomRow = {
  name: string
  file: string
  kind: "part" | "standard" | "step"
  count: number
  /** Volume per piece in cm³. */
  volumeCm3: number
  /** Bounding box [x, y, z] in mm. */
  sizeMm: [number, number, number]
}

export type Diagnostic = {
  severity: "error" | "warning"
  featureId?: string
  featureName?: string
  message: string
}

export type ModelAnalysis = {
  sizeMm: [number, number, number] | null
  volumeCm3: number
  solids: number
  faces: number
  edges: number
  partCount: number
  featureCount: number
  paramCount: number
  checksPassed: number
  checksTotal: number
  buildMs: number
  masses: { material: MaterialSpec; grams: number }[]
  diagnostics: Diagnostic[]
  bom: BomRow[]
}

const r1 = (x: number) => Math.round(x * 10) / 10
const r2 = (x: number) => Math.round(x * 100) / 100

/** Build structured geometry metrics, diagnostics and BOM from a Tree and its latest BuildReport. */
export function analyzeModel(tree: Tree, report: BuildReport | null, opts: { fileName?: string; isAssembly?: boolean } = {}): ModelAnalysis {
  const fileName = opts.fileName ?? "part.turnery.json"
  const isAsm = opts.isAssembly ?? tree.features.some((f) => f.op === "component")
  const volumeMm3 = report?.body?.volume ?? 0
  const volumeCm3 = r2(volumeMm3 / 1000)

  const diagnostics: Diagnostic[] = []
  if (report?.paramError) {
    diagnostics.push({ severity: "error", message: report.paramError })
  }
  for (const f of report?.features ?? []) {
    if (f.state === "error" && f.message) {
      diagnostics.push({ severity: "error", featureId: f.id, featureName: f.name, message: f.message })
    }
    for (const w of f.warnings ?? []) {
      diagnostics.push({ severity: "warning", featureId: f.id, featureName: f.name, message: w })
    }
  }
  for (const inter of report?.interferences ?? []) {
    if (inter.volume > 1e-6) {
      const msg = `${inter.a} / ${inter.b}: ${r2(inter.volume)} mm³`
      if (!diagnostics.some((d) => d.message.includes(inter.a) && d.message.includes(inter.b))) {
        diagnostics.push({ severity: "warning", featureId: inter.feature, message: msg })
      }
    }
  }

  const checks = report?.checks ?? []
  const validChecks = checks.filter((c) => !c.invalid)
  const checksPassed = validChecks.filter((c) => c.pass).length

  const bom = buildBom(tree, report, fileName, isAsm)
  const masses = MATERIALS.map((material) => ({
    material,
    grams: r1(volumeCm3 * material.density * (material.infill ?? 1)),
  }))

  return {
    sizeMm: report?.body ? [r1(report.body.size[0]), r1(report.body.size[1]), r1(report.body.size[2])] : null,
    volumeCm3,
    solids: report?.body?.solids ?? 0,
    faces: report?.body?.faces ?? 0,
    edges: report?.body?.edges ?? 0,
    partCount: report?.parts?.length ?? (report?.body ? 1 : 0),
    featureCount: tree.features.length,
    paramCount: Object.keys(tree.params).length,
    checksPassed,
    checksTotal: validChecks.length,
    buildMs: report?.ms ?? 0,
    masses,
    diagnostics,
    bom,
  }
}

function buildBom(tree: Tree, report: BuildReport | null, fileName: string, isAsm: boolean): BomRow[] {
  if (!report) return []
  const what = new Map<string, { file: string; kind: BomRow["kind"]; std?: string }>()
  for (const f of tree.features) {
    if (f.op !== "component") continue
    let std: string | undefined
    if (f.standard) {
      try {
        const len = f.standard.length
        std = designation({ ...f.standard, length: len === undefined ? undefined : evalNum(len, report.params) }).name
      } catch {
        std = undefined
      }
    }
    const kind: BomRow["kind"] = f.standard ? "standard" : f.file && /\.(step|stp)$/i.test(f.file) ? "step" : "part"
    what.set(componentName(f), { file: f.file ?? "standard", kind, std })
  }

  const stem = fileName.replace(/\.(turnery|arbor)(-asm)?\.json$/i, "")
  const parts = report.parts ?? (report.body ? [{ name: stem, volume: report.body.volume, size: report.body.size }] : [])
  const rows = new Map<string, BomRow>()
  for (const p of parts) {
    const comp = p.name.split("/")[0]
    const base = comp.replace(/#\d+$/, "")
    const sub = p.name.slice(comp.length)
    const w = isAsm ? what.get(base) : undefined
    const file = isAsm ? (w?.file ?? "") : fileName
    const kind: BomRow["kind"] = w?.kind ?? "part"
    const key = !isAsm ? p.name : w?.std ? `std|${w.std}` : `${file}|${sub}`
    const name = w?.std ?? (isAsm ? `${base}${sub}` : p.name)
    const existing = rows.get(key)
    if (existing) {
      existing.count += 1
    } else {
      rows.set(key, {
        name,
        file,
        kind,
        count: 1,
        volumeCm3: r2(p.volume / 1000),
        sizeMm: [r1(p.size[0]), r1(p.size[1]), r1(p.size[2])],
      })
    }
  }
  return [...rows.values()]
}

export function bomToMarkdown(title: string, rows: BomRow[], lang: "zh" | "en" = "zh"): string {
  const total = rows.reduce((n, r) => n + r.count, 0)
  if (lang === "en") {
    return [
      `# Bill of Materials: ${title}`,
      "",
      "| No. | Name | File | Qty | Volume each (cm³) | Size (mm) |",
      "| --- | --- | --- | --- | --- | --- |",
      ...rows.map((r, i) => `| ${i + 1} | ${r.name} | ${r.file} | ${r.count} | ${r.volumeCm3} | ${r.sizeMm.join(" × ")} |`),
      "",
      `Total: ${total} ${total === 1 ? "piece" : "pieces"}.`,
      "",
    ].join("\n")
  }
  return [
    `# 物料清单：${title}`,
    "",
    "| 序号 | 名称 | 文件 | 数量 | 单件体积 (cm³) | 外形 (mm) |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows.map((r, i) => `| ${i + 1} | ${r.name} | ${r.file} | ${r.count} | ${r.volumeCm3} | ${r.sizeMm.join(" × ")} |`),
    "",
    `共 ${total} 件。`,
    "",
  ].join("\n")
}

export function bomToCsv(rows: BomRow[]): string {
  const esc = (s: string | number) => {
    const text = String(s)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return [
    "no,name,file,kind,qty,volume_cm3,size_x_mm,size_y_mm,size_z_mm",
    ...rows.map((r, i) => [i + 1, r.name, r.file, r.kind, r.count, r.volumeCm3, r.sizeMm[0], r.sizeMm[1], r.sizeMm[2]].map(esc).join(",")),
    "",
  ].join("\n")
}
