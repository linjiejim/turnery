// Geometry, mass, printability/diagnostics and BOM analysis panel shared by
// Web Workbench and Community Project Detail.
import * as React from "react"
import { AlertTriangle, CheckCircle2, CircleX, Download, Layers, Scale } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { locale, t } from "@/lib/i18n"
import { analyzeModel, bomToCsv, bomToMarkdown } from "../analysis"
import { saveBlob } from "../download"
import type { Studio } from "../use-studio"

export function AnalysisPanel({ studio, fileName, title }: { studio: Studio; fileName?: string; title?: string }) {
  const analysis = React.useMemo(
    () => analyzeModel(studio.tree, studio.report, { fileName }),
    [studio.tree, studio.report, fileName],
  )

  const exportBom = (fmt: "md" | "csv") => {
    const label = title || fileName || "model"
    const content = fmt === "md" ? bomToMarkdown(label, analysis.bom, locale) : bomToCsv(analysis.bom)
    const mime = fmt === "md" ? "text/markdown" : "text/csv"
    saveBlob(new Blob([content], { type: mime }), `${label.replace(/[^\w.-]+/g, "-")}-bom.${fmt}`)
  }

  if (!studio.tree.features.length && !studio.report?.body) {
    return (
      <p className="px-4 py-4 text-body text-muted-foreground">
        {t("建模后这里会显示外形尺寸、体积、材料估算重量、诊断问题和物料清单（BOM）。", "Once the model builds, dimensions, volume, estimated material weights, diagnostics and BOM appear here.")}
      </p>
    )
  }

  const errors = analysis.diagnostics.filter((d) => d.severity === "error")
  const warnings = analysis.diagnostics.filter((d) => d.severity === "warning")

  return (
    <div className="space-y-4 px-4 py-3 text-body">
      <section aria-label={t("几何概要", "Geometry summary")}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-small font-semibold">{t("几何概要", "Geometry")}</h3>
          {analysis.checksTotal > 0 && (
            <Badge tone={analysis.checksPassed === analysis.checksTotal ? "success" : "warning"}>
              {t(`核对 ${analysis.checksPassed}/${analysis.checksTotal}`, `Checks ${analysis.checksPassed}/${analysis.checksTotal}`)}
            </Badge>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-2 rounded-md border bg-sunken p-2.5 text-small">
          <div>
            <dt className="text-caption text-faint-foreground">{t("包围盒 (mm)", "Bounding box (mm)")}</dt>
            <dd className="mt-0.5 font-mono font-medium tabular">
              {analysis.sizeMm ? analysis.sizeMm.join(" × ") : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-faint-foreground">{t("体积", "Volume")}</dt>
            <dd className="mt-0.5 font-mono font-medium tabular">{analysis.volumeCm3} cm³</dd>
          </div>
          <div>
            <dt className="text-caption text-faint-foreground">{t("零件 / 实体", "Parts / Solids")}</dt>
            <dd className="mt-0.5 font-mono tabular">
              {analysis.partCount} / {analysis.solids}
            </dd>
          </div>
          <div>
            <dt className="text-caption text-faint-foreground">{t("面 / 边", "Faces / Edges")}</dt>
            <dd className="mt-0.5 font-mono tabular">
              {analysis.faces} / {analysis.edges}
            </dd>
          </div>
        </dl>
      </section>

      {analysis.volumeCm3 > 0 && (
        <section aria-label={t("重量估算", "Estimated mass")}>
          <div className="mb-2 flex items-center gap-1.5">
            <Scale className="size-3.5 text-muted-foreground" />
            <h3 className="text-small font-semibold">{t("材料重量估算", "Mass estimates")}</h3>
          </div>
          <div className="divide-y rounded-md border">
            {analysis.masses.map(({ material, grams }) => (
              <div key={material.id} className="flex items-center justify-between px-2.5 py-1.5 text-small">
                <span className="text-muted-foreground">{t(material.nameZh, material.nameEn)}</span>
                <span className="font-mono font-medium tabular">{grams} g</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label={t("可制造性与诊断", "Diagnostics")}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-small font-semibold">{t("诊断与检查", "Diagnostics")}</h3>
          {errors.length === 0 && warnings.length === 0 ? (
            <Badge tone="success">
              <CheckCircle2 />
              {t("无异常", "Clean")}
            </Badge>
          ) : (
            <Badge tone={errors.length ? "danger" : "warning"}>
              {errors.length ? t(`${errors.length} 错误`, `${errors.length} errors`) : t(`${warnings.length} 提醒`, `${warnings.length} warnings`)}
            </Badge>
          )}
        </div>
        {analysis.diagnostics.length === 0 ? (
          <p className="rounded-md border px-2.5 py-2 text-small text-muted-foreground">
            {t("所有特征重建正常，没有检测到不相连实体、薄壁或零件干涉。", "All features rebuilt cleanly with no disconnected solids, thin-wall or interference warnings.")}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {analysis.diagnostics.map((d, i) => (
              <li key={i} className="flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-small">
                {d.severity === "error" ? (
                  <CircleX className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                ) : (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" />
                )}
                <div className="min-w-0 flex-1 break-words">
                  {d.featureName && <span className="mr-1.5 font-medium">{d.featureName}</span>}
                  <span className="text-muted-foreground">{d.message}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {analysis.bom.length > 0 && (
        <section aria-label={t("物料清单", "Bill of Materials")}>
          <div className="mb-2 flex items-center gap-1.5">
            <Layers className="size-3.5 text-muted-foreground" />
            <h3 className="text-small font-semibold">{t("物料清单（BOM）", "Bill of Materials")}</h3>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => exportBom("md")}>
                <Download />
                MD
              </Button>
              <Button size="sm" variant="ghost" onClick={() => exportBom("csv")}>
                CSV
              </Button>
            </div>
          </div>
          <div className="divide-y rounded-md border">
            {analysis.bom.map((row) => (
              <div key={`${row.name}|${row.file}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-small">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{row.name}</div>
                  <div className="truncate text-caption text-faint-foreground">
                    {row.sizeMm.join(" × ")} mm · {row.volumeCm3} cm³
                  </div>
                </div>
                <Badge tone={row.kind === "standard" ? "info" : row.kind === "step" ? "outline" : "neutral"}>×{row.count}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
