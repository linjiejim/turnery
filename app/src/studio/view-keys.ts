import { t } from "../lib/i18n"

/** What a click on the model does: select, note a face or edge, frame or draw a note, measure. */
export type ViewTool = "select" | "note" | "box" | "pen" | "measure"

/** The view's one-letter keys, as the 「快捷键」 card lists them (the host adds its own). */
export type KeyRow = { keys: string; what: string }

/** The row for dragging a part's arrows: studio-viewport.tsx shows it only where parts can be moved. */
export const DRAG_ARROWS = t("拖箭头", "Drag arrows")

export const VIEW_KEYS: KeyRow[] = [
  { keys: t("单击 / ⌥单击", "Click / ⌥-click"), what: t("选中整个零件 / 只选拆出来的那一块（Shift 多选）", "Select the whole part / only the split-off piece (Shift for more)") },
  { keys: "V", what: t("查看与选择（Esc 也回到这里）", "View and select (Esc also returns here)") },
  { keys: "C", what: t("标注：点面或边；选中了零件时，给选中的写备注", "Note: click a face or edge; with parts selected, note the selection") },
  { keys: "R", what: t("框选标注：拖出一个框", "Box note: drag out a box") },
  { keys: "P", what: t("画笔标注：在模型上画", "Pen note: draw on the model") },
  { keys: "M", what: t("测量", "Measure") },
  { keys: "X", what: t("剖视", "Section") },
  { keys: "D", what: t("显示尺寸", "Show dimensions") },
  { keys: "E", what: t("爆炸：打开时零件先分开一半", "Explode: parts start half apart") },
  { keys: DRAG_ARROWS, what: t("选中零件后沿 X / Y / Z 挪开看（只改视图，不改文件）", "Select a part, then drag its arrows to move it along X / Y / Z (view only, file unchanged)") },
  { keys: "W", what: t("显示样式：白模 → 彩色 → 线描 → 半透明", "Display style: clay → color → line drawing → see-through") },
  { keys: "O", what: t("透视 / 正交", "Perspective / orthographic") },
  { keys: "A", what: t("白模 / 彩色", "Clay / color") },
  { keys: "F", what: t("适应窗口；选中了零件时对准选中的", "Fit to window; with parts selected, frame the selection") },
  { keys: "H / ⇧H", what: t("隐藏选中的 / 全部显示", "Hide selected / show all") },
  { keys: "I", what: t("隔离选中的，再按一次恢复", "Isolate selected; press again to restore") },
  { keys: "T", what: t("选中的保持实体，其余透明，再按一次恢复", "Keep selected solid, the rest see-through; press again to restore") },
  { keys: "Esc", what: t("一级一级退出：卡片、工具、选中、回到的步骤", "Back out one level at a time: card, tool, selection, rolled-back step") },
  { keys: "?", what: t("这张表", "This list") },
]
