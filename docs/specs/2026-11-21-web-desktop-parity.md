# Web 工作台补齐桌面端能力与在线发布分析

- 状态：实施中（2026-11-21）
- 日期：2026-11-21
- 范围：
  1. Web Worker 建模内核补齐桌面端能力：多零件装配体（`setComponents`）、STEP 参考件导入（`setAssets`）、装配上下文（`setContext`）、外观着色与质感（`restyle` / `looks`）、3MF 导出；
  2. 浏览器多文件虚拟项目工作区（IndexedDB 持久化）：管理多个项目与多文件（`*.turnery.json`、`*.turnery-asm.json`、`*.params.json`、`*.step`、`README.md`、`turnery.json`），兼容桌面端 `sources.ts` 的相对路径解析；
  3. Web 建模工具集分级补齐：保留 `teach` 课程助教的精简工具集（不破坏课程与练习回归），在 `build` 自由建模模式解锁全部桌面端建模命令与核对项（螺纹 `thread`、求交 `intersect`、样条 `spline`、等深拉伸 `onto`、导入 `import`、装配组件 `component`、`position`/`gap`/`clearance`/`interference` 核对）；
  4. 在线几何分析与 BOM：尺寸包围盒、体积、表面积、常见打印/机加工材料估算重量、需求核对明细、薄壁/窄缝/干涉诊断、装配体与标准紧固件 BOM 清单导出；
  5. 多格式导入导出与一键发布：支持拖放/导入 `.json`、`.step`/`.stp`、`.zip` 项目包；支持导出 STEP / STL / 3MF / build123d Python / BOM / 标准项目 ZIP；支持在 Web 工作台直接一键发布或推送版本更新到开源社区。
- 相关：`app/src/studio/worker.ts`、`app/src/studio/client.ts`、`app/src/studio/tools.ts`、`app/src/studio/use-studio.ts`、`app/src/routes/studio.tsx`、`app/src/desktop/core/sources.ts`、`docs/specs/2026-11-21-community-hub.md`

## 为什么

- Turnery 的桌面端与 Web 端底层共享同一个 OpenCascade WASM 内核（`app/src/studio/kernel/build.ts`）与 UI 组件（`StudioViewport`、`TreeOverlay`、`ParamsPanel`、`DrawingSheet`）。
- 此前 Web 端仅开放了单零件特征树，导致用户在浏览器中无法打开/预览社区里的多零件装配项目、无法导入 STEP 围绕开发板建模、无法查看 BOM 与重量分析，也无法在 Web 端直接发布完整的项目作品。
- 补齐 Web 端能力后：
  - **Web 端**覆盖绝大部分在线临时建模、装配体预览、参数调整、几何分析与社区发布；
  - **桌面端**继续聚焦本地文件系统、Git 工作流、本地 Coding Agent（Claude Code / Codex MCP）与离线大项目体验。

## 架构设计

### 1. Web Worker 内核协议对齐（`worker.ts` / `client.ts`）

`app/src/studio/kernel/build.ts` 中的 `Kernel` 类本身已实现以下方法，仅需在 Web Worker 消息协议中暴露，并在 Worker 堆超限重启（`RECYCLE_MB = 1400`）时完整重放上下文：

| 新增消息 | 参数 | 说明 |
| --- | --- | --- |
| `setAssets` | `list: { name: string; bytes: Uint8Array \| null; error?: string }[]` | 传入项目中的 STEP 文件字节，供 `import` 特征使用 |
| `setComponents` | `list: ComponentSource[]` | 递归传入装配体引用的子零件/子装配/STEP 与共享参数 |
| `setContext` | `ctx: ContextSource \| null` | 在装配上下文中编辑单个零件时显示周围半透明参考件 |
| `restyle` | `tree: Tree` | 仅颜色/质感变化时免重建几何 |
| `looks` | 无 | 查询各零件当前外观 |
| `export` | `format: "step" \| "stl" \| "3mf"` | 放开 `3mf` 导出（内核已支持） |

### 2. 浏览器多文件虚拟项目工作区（`app/src/studio/project-store.ts`）

- 底层使用浏览器 IndexedDB（`turnery-web-projects-v1`）保存多个项目，无 IndexedDB 环境（测试/受限隐私模式）自动退化为内存存储；
- 首次启动时若存在旧版单树 `localStorage["ft-studio-v1"]`，自动无损迁移为默认项目的 `main.turnery.json`；
- 每个项目维护一份虚拟文件表 `Map<string, string | Uint8Array>`，并提供 `toEngineFiles(project)` 适配器，完整实现 `app/src/desktop/core/engine.ts` 中的 `Files` 接口；
- 直接复用 `app/src/desktop/core/sources.ts` 的 `gather()`、`loadShared()`、`effectiveTree()`：
  - 当当前打开的是 `*.turnery-asm.json` 时，自动递归收集子零件、共享参数和 STEP 字节，传入 `KernelClient.setComponents` / `setAssets`；
  - 当当前打开的是带 `uses` 的零件时，自动合并共享参数并支持修改同步；
  - 导入 `.zip` 项目包时调用 `unzipStore()` 还原全部合法文件，导出项目包时调用 `zipStore()` 打包并附带 `turnery.json`。

### 3. 建模工具集分级（`app/src/studio/tools.ts` / `app/server/index.ts`）

- `studioTools(lang)`（`mode === "teach"`）：保持原有课程助教子集不变，确保全部互动课练习和历史 eval 零回归；
- `workbenchTools(lang)`（`mode === "build"`）：完整合并 `studioTools(lang)` 与 `desktopTools(lang)`，开放：
  - `thread`（真实公制螺纹）、`import`（引用项目内 STEP）、`component`（装配与 ISO 标准紧固件/配合）；
  - `mode: "intersect"`、`revolve.start` / `symmetric`、`extrude.onto`、草图 `spline` 与圆角拐点 `{ to, r }`、`hole.fit: "insert"`、`edge.outer`；
  - 完整 `check` 类型（`position`、`gap`、`clearance`、`interference`）。

### 4. 在线几何分析与 BOM（`app/src/studio/analysis.ts`）

在 Web 工作台与社区详情页右侧新增「分析」面板，基于 `Tree` 与 `BuildReport` 实时计算，无额外服务端开销：
- **基础物理量**：总包围盒（`X × Y × Z mm`）、总体积（`cm³`）、表面积（`cm²`）、实体数量与分件数；
- **多材料预估重量**：PLA（1.24 g/cm³）、PETG（1.27）、ABS（1.04）、尼龙 PA12（1.01）、6061 铝合金（2.70）；
- **可制造性与几何诊断**：汇总 `BuildReport` 中的特征报错、不相连实体、薄壁、窄缝、干涉警告及需求核对项（`checks`）通过率；
- **BOM 物料清单**：自动统计自定义零件、外购 STEP 件与 ISO 标准紧固件（按型号合并数量），支持导出 Markdown / CSV。

### 5. Web 工作台界面升级（`app/src/routes/studio.tsx`）

- 左侧可折叠「项目文件」栏：切换项目、新建零件/装配/共享参数、上传 STEP/JSON/ZIP、切换当前编辑文件；
- 顶栏导出菜单：STEP、STL、3MF、build123d Python、特征树 JSON、BOM（CSV/Markdown）、项目包 ZIP；
- 顶栏保留「分享（匿名快传链接）」并新增「发布到社区 / 更新版本」主入口：自动调用 `renderViews` 渲染当前模型的等轴测封面图，弹出发布对话框一键提交到社区 Hub；
- 更新顶部提示条文案：如实说明桌面端与 Web 端的分工（桌面端侧重本地 Coding Agent MCP、本地文件夹与 Git 集成）。

## 验收标准

1. Web Worker 能正确加载并重建包含子零件、共享参数与 STEP 参考件的多零件装配体，支持调参、剖视、工程图、3MF 导出；
2. 浏览器项目工作区能创建/切换多文件，导出 ZIP 后再导入可完整还原，且与 `sources.ts` 的 `gather()` 无缝衔接；
3. `STUDIO_TOOLS` 原有测试全部通过，新增 `workbenchTools` 单元测试覆盖桌面端全量特征与核对项；
4. 分析模块单元测试覆盖体积/重量/诊断/BOM 汇总；
5. 全部现有 549+ 单元测试、设计守卫测试、TypeScript 检查与 `oxlint` 全部通过。
