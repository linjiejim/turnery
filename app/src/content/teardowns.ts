import type { OpId } from "./ops"
import { EN } from "./en/ready"

/** Teardowns on the roadmap that are not baked yet (shown as planned cards), in Chinese. */
export const PLANNED_ZH: { title: string; subtitle: string; level: string; kind: string; ops: OpId[] }[] = [
  { title: "直齿轮", subtitle: "渐开线 · 模数与齿数驱动", level: "进阶", kind: "单零件", ops: ["sketch", "extrude", "pattern"] },
  { title: "六角螺栓与螺母", subtitle: "多边形 · 倒角 · 螺纹", level: "进阶", kind: "装配", ops: ["extrude", "chamfer", "thread"] },
  { title: "钣金支架", subtitle: "法兰 · 折弯 · 展开", level: "进阶", kind: "单零件", ops: ["extrude", "fillet", "hole"] },
  { title: "手电筒", subtitle: "旋转件 · 螺纹 · 装配顺序", level: "进阶", kind: "装配", ops: ["revolve", "thread", "boolean"] },
]

/** In the page's language (English: content/en/teardowns.ts). */
export const PLANNED_MODELS = EN ? EN.localizePlanned(PLANNED_ZH) : PLANNED_ZH
