# turnery · 演示稿主题

Turnery 的介绍、发布、课程分享用这个主题。继承 jim（骨架、灰阶、版式规则都一样），只换旋钮。

## 气质

工程图纸：白纸、细网格、一个工程蓝。蓝色只表示「这一步 / 还没定下来」，定下来的东西是黑的，和 CAD 里欠定义草图是蓝色的约定一致。

## 该做

- 用真实的东西当证据：截图在 `docs/media/`，示例零件在 `examples/sensor-enclosure/`，核对结果照 App 的格式写（`.turnery-check`）。
- 一页一个论点，按 docs/launch/README.md 的顺序讲：特征树 → 内核核对 → 指给它看。
- 蓝图网格（`bg-pattern`）只给封面、章节和收尾，正文页保持白纸。
- 标题字重 500/600（中文标题字只有这两档）。

## 不该做

- 不说「文生 3D」「AI CAD 软件」「取代 SolidWorks」（见 docs/launch/README.md）。
- 坐标轴的红绿蓝只属于坐标轴，不拿来当状态色或装饰色。
- 不夸大：数字都要能在仓库里复现，版本号以 desktop/package.json 为准。

## Logo

页眉用图形标（`desktop/resources/logo/turnery-mark.svg`），封面可以用字标。深色页上黑色部分自动反白，蓝色部分不变。不拉伸、不加描边阴影。
