import type { DocState } from "./core/protocol"
import { besides } from "./core/sources"
import { t } from "@/lib/i18n"

const isStep = (file: string) => /\.(step|stp)$/i.test(file)

/**
 * Where a component's own file is, to open it: a part opens on its own or inside the assembly; a
 * sub-assembly opens as itself. A STEP reference or a standard part has no file of its own (`reason`).
 */
export function openTarget(doc: DocState, file: string): { path: string; nested: boolean; reason?: undefined } | { reason: string; path?: undefined; nested?: undefined } {
  if (!file) return { reason: t("标准件没有零件文件", "A standard part has no part file") }
  if (isStep(file)) return { reason: t("STEP 参考件没有零件文件", "A STEP reference has no part file") }
  return { path: besides(doc.path, file), nested: /\.(turnery|arbor)-asm\.json$/i.test(file) }
}
