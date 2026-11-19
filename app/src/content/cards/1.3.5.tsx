import type { ReactNode } from "react"
import { Arrow, Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.3.5 诊断与修复重建错误. */

type Mark = "ok" | "error" | "warning"
const ROWS: { name: string; note: string; mark: Mark }[] = [
  { name: t("拉伸1", "Extrude1"), note: "", mark: "ok" },
  { name: t("草图2", "Sketch2"), note: t("它所在的基准面被删了", "Its datum plane was deleted"), mark: "error" },
  { name: t("切除1", "Cut1"), note: t("用的轮廓是草图2", "Its profile is Sketch2"), mark: "error" },
  { name: t("圆角1", "Fillet1"), note: t("要的边由切除1 生成", "Its edge is from Cut1"), mark: "error" },
  { name: t("倒角1", "Chamfer1"), note: t("生成了，参考有变化", "Built, but refs changed"), mark: "warning" },
]
// English feature names run wider than the Chinese ones ("Chamfer1"), so the notes start a little further right.
const NOTE_X = byLocale(92, 104)

const glyph = (mark: Mark, y: number): ReactNode =>
  mark === "ok" ? (
    <circle cx={22} cy={y} r={6} className="text-faint-foreground" />
  ) : mark === "error" ? (
    <g className="text-destructive" strokeWidth={1.75}>
      <path d={`M 17 ${y - 5} L 27 ${y + 5} M 27 ${y - 5} L 17 ${y + 5}`} />
    </g>
  ) : (
    <g className="text-warning" strokeWidth={1.5}>
      <path d={`M 22 ${y - 7} L 29 ${y + 6} H 15 Z`} />
      <path d={`M 22 ${y - 2} V ${y + 2}`} />
    </g>
  )

const card: CardDef = {
  code: "1.3.5",
  title: t("重建报错：不重画也能修好", "Diagnosing and fixing rebuild errors"),
  minutes: 5,
  sections: [
    {
      heading: t("先分清错误和警告", "First, tell errors from warnings"),
      body: byLocale(
        <>
          <p>改了上游，特征树里就可能亮起标记。错误表示这个特征没能生成；警告表示生成了，但有地方需要注意，比如几何关系悬空了。</p>
          <ul>
            <li>SOLIDWORKS：错误是红色叉，警告是黄色叹号；右键特征选「什么错」看原因。</li>
            <li>Fusion：时间轴上的特征变黄是警告、变红是错误；右键选「审阅警告」或「审阅错误」。</li>
            <li>Onshape：出问题的特征名变成橙色，鼠标悬停显示摘要；特征对话框里丢失的参考显示为红色。</li>
          </ul>
        </>,
        <>
          <p>Change something upstream and markers may light up in the feature tree. An error means the feature couldn't be built; a warning means it was built, but something needs attention, such as a dangling relation.</p>
          <ul>
            <li>SOLIDWORKS: an error is a red X and a warning a yellow exclamation mark. Right-click the feature and choose “What's Wrong” to see why.</li>
            <li>Fusion: a feature on the timeline turns yellow for a warning and red for an error. Right-click it to review the warning or the error.</li>
            <li>Onshape: a feature with a problem has its name turn orange, and hovering over it shows a summary. In the feature dialog, missing references show in red.</li>
          </ul>
        </>,
      ),
    },
    {
      heading: t("从最上面那个修起", "Start with the topmost one"),
      body: byLocale(
        <>
          <p>一个特征坏了，引用它的下游特征往往跟着坏，列表里一片红。真正的原因通常在最上面那个。Onshape 的帮助也建议从顶部开始，逐个往下修。</p>
          <ol>
            <li>把回滚条拖到第一个出错的特征下面，只看它。</li>
            <li>读报错：丢了参考？草图不闭合？半径太大？</li>
            <li>修好它，再往下走一个。很多下游错误会自己消失。</li>
          </ol>
          <p>平时也别攒一堆改动再重建：改一处，重建一次（SOLIDWORKS 和 Fusion 都是 Ctrl+B），出了错马上知道是哪一步引起的。</p>
        </>,
        <>
          <p>When one feature breaks, the downstream features that reference it often break too, and the list turns red. The real cause is usually the topmost one. Onshape's help also advises starting at the top and fixing them one by one on the way down.</p>
          <ol>
            <li>Drag the rollback bar to just below the first failed feature, so you see only that one.</li>
            <li>Read the message: a lost reference? An open sketch? A radius too large?</li>
            <li>Fix it, then move down one feature. Many downstream errors go away on their own.</li>
          </ol>
          <p>Day to day, don't pile up changes before you rebuild either: make one change, rebuild once (Ctrl+B in both SOLIDWORKS and Fusion), and if something fails you know at once which step caused it.</p>
        </>,
      ),
    },
    {
      heading: t("三类常见原因", "Three common causes"),
      body: byLocale(
        <ul>
          <li>
            <strong>丢了参考。</strong>被引用的面、边或基准面没了，常见于拓扑命名问题。编辑特征，重新选参考。草图的平面丢了不用重画：SOLIDWORKS 用「编辑草图基准面」，Fusion 用「重新定义草图平面」，Onshape 在「修复」里用「替换参考」。
          </li>
          <li>
            <strong>草图本身有问题。</strong>重叠的线、细小的缺口、悬空的几何关系。SOLIDWORKS 的「检查草图合法性」和「修复草图」能找出来，「显示/删除几何关系」里可以筛出悬空的关系。
          </li>
          <li>
            <strong>几何做不出来。</strong>圆角半径超过相邻面、抽壳厚度大于曲率半径。改参数或调整特征顺序；SOLIDWORKS 的 FeatureXpert 能从「什么错」对话框启动，自动尝试修复失败的等半径圆角和拔模。
          </li>
        </ul>,
        <ul>
          <li>
            <strong>A lost reference.</strong> A referenced face, edge or plane is gone, often because of the topological naming problem. Edit the feature and pick the reference again. If a sketch has lost its plane, you don't need
            to redraw it: use “Edit Sketch Plane” in SOLIDWORKS, “Redefine Sketch Plane” in Fusion, or “Replace reference” in Onshape's “Repair” panel.
          </li>
          <li>
            <strong>A problem in the sketch itself.</strong> Overlapping lines, tiny gaps, dangling relations. SOLIDWORKS's “Check Sketch for Feature” and “Repair Sketch” find them, and “Display/Delete Relations” can filter the
            list down to the dangling ones.
          </li>
          <li>
            <strong>Geometry that can't be made.</strong> A fillet radius larger than the adjacent faces, a shell thicker than the radius of curvature. Change the parameters or the feature order. SOLIDWORKS's FeatureXpert can be
            started from the “What's Wrong” dialog and automatically tries to fix failed constant-radius fillets and drafts.
          </li>
        </ul>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={172} label={t("特征树里的连锁错误：最上面的草图2 是根源，下游跟着报错", "A chain of errors in the feature tree: Sketch2 at the top is the root cause, and the features downstream fail with it")}>
        {ROWS.map((r, i) => {
          const y = 22 + i * 30
          return (
            <g key={r.name}>
              {glyph(r.mark, y)}
              <T x={40} y={y + 5} className={r.mark === "error" ? "text-destructive" : undefined}>
                {r.name}
              </T>
              <T x={NOTE_X} y={y + 5} tone="muted">
                {r.note}
              </T>
            </g>
          )
        })}
        <rect x={6} y={38} width={308} height={28} rx={6} className="text-primary" />
        <Arrow x1={250} y1={160} x2={250} y2={70} className="text-primary" />
        <T x={244} y={166} anchor="end" tone="primary">
          {t("先修这一个", "Fix this one first")}
        </T>
      </Svg>
    ),
    caption: t(
      "草图2 的基准面被删，它下游的切除和圆角跟着出错。修好草图2（换一个基准面），后面的错误多半自己消失。",
      "Sketch2's plane was deleted, so the cut and the fillet downstream of it fail too. Fix Sketch2 (give it another plane) and the errors after it mostly go away on their own.",
    ),
    after: 1,
  },
  table: {
    caption: t("各软件里的对应工具", "The matching tools in each package"),
    head: byLocale(["要做的事", "SOLIDWORKS", "Fusion", "Onshape"], ["Task", "SOLIDWORKS", "Fusion", "Onshape"]),
    rows: byLocale(
      [
        ["看出错原因", "什么错", "审阅错误 / 审阅警告", "悬停橙色特征"],
        ["换草图平面", "编辑草图基准面", "重新定义草图平面", "替换参考"],
        ["重新计算", "重建 Ctrl+B，强制重建 Ctrl+Q", "全部计算 Ctrl+B", "自动重算"],
        ["集中修复", "FeatureXpert（圆角、拔模）", "—", "修复面板（编辑健康时刻）"],
      ],
      [
        ["See why it failed", "What's Wrong", "Right-click: review the error or warning", "Hover over the orange feature"],
        ["Change the sketch plane", "Edit Sketch Plane", "Redefine Sketch Plane", "Replace reference"],
        ["Recompute", "Rebuild Ctrl+B, forced rebuild Ctrl+Q", "Compute All Ctrl+B", "Recomputes automatically"],
        ["Repair in one place", "FeatureXpert (fillets, drafts)", "—", "Repair panel (Edit healthy moment)"],
      ],
    ),
    after: 2,
  },
  terms: { ops: ["fillet", "shell"], concepts: ["tnp", "parent-child", "rollback", "feature-tree"] },
  quiz: [
    {
      q: t("特征树里有 4 个特征报错，最上面的是「草图3」。先修哪个？", "Four features in the feature tree have errors, and the topmost is “Sketch3”. Which do you fix first?"),
      options: byLocale(
        ["最下面那个，它离最终结果最近", "最上面的草图3，下游的错误常常是它引起的", "随便哪个都行"],
        ["The bottom one, since it's closest to the final result", "Sketch3 at the top: it often causes the errors downstream", "Any of them, it doesn't matter"],
      ),
      answer: 1,
      explain: t(
        "特征按顺序重算，下游引用上游。上游坏了，下游拿不到参考也跟着坏。先修最上面的，很多下游错误会自己消失。",
        "Features rebuild in order, and downstream features reference upstream ones. When an upstream feature breaks, the downstream ones can't get their references and break too. Fix the topmost one first, and many downstream errors go away on their own.",
      ),
    },
    {
      q: t("草图所在的基准面被删了，草图报错。不重画草图，怎么修？", "The plane a sketch sits on was deleted, and the sketch fails. How do you fix it without redrawing the sketch?"),
      options: byLocale(
        ["把草图换到另一个面上：编辑草图基准面 / 重新定义草图平面 / 替换参考", "删掉草图和它后面的所有特征", "关掉错误提示"],
        ["Move the sketch onto another plane: Edit Sketch Plane / Redefine Sketch Plane / Replace reference", "Delete the sketch and every feature after it", "Turn off the error messages"],
      ),
      answer: 0,
      explain: t(
        "草图的线和尺寸都还在，缺的只是它挂的那个面。换一个面挂上去，下游特征通常就恢复了。",
        "The sketch's lines and dimensions are all still there; all it's missing is the plane it was attached to. Attach it to another one, and the downstream features usually recover.",
      ),
    },
    {
      q: t("错误和警告有什么区别？", "What is the difference between an error and a warning?"),
      options: byLocale(
        ["错误是特征没生成；警告是生成了，但有地方需要注意", "没有区别，只是颜色不同", "警告比错误更严重"],
        ["An error means the feature wasn't built; a warning means it was built, but something needs attention", "There's no difference, only the color", "A warning is more serious than an error"],
      ),
      answer: 0,
      explain: t(
        "错误意味着这一步的几何没有出来，下游会受影响；警告时几何已经生成，但参考或关系可能不对，值得检查，否则以后会变成错误。",
        "An error means this step's geometry didn't come out, and everything downstream is affected. With a warning the geometry was built, but a reference or relation may be off. It's worth checking, or it may turn into an error later.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "错误是特征没生成，警告是生成了但有隐患",
      "从最上面的错误修起，回滚到它下面单独看；很多下游错误会自己消失",
      "丢参考就重选，丢平面就换平面，几何做不出来就改参数或改顺序",
    ],
    [
      "An error means the feature wasn't built; a warning means it was built but has a hidden problem",
      "Fix the topmost error first, with the rollback bar just below it so you see it alone; many downstream errors go away on their own",
      "Lost a reference: pick it again. Lost a plane: give it another one. Geometry that can't be made: change the parameters or the order",
    ],
  ),
  sources: [
    { title: "什么错", publisher: t("SOLIDWORKS 2021 帮助", "SOLIDWORKS 2021 Help"), url: "https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/hidd_new_whats_wrong.htm" },
    { title: "重建工具", publisher: t("SOLIDWORKS 2018 帮助", "SOLIDWORKS 2018 Help"), url: "https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/c_fundamentals_rebuid_tools_help.htm" },
    { title: "检查草图合法性", publisher: t("SOLIDWORKS 2019 帮助", "SOLIDWORKS 2019 Help"), url: "https://help.solidworks.com/2019/chinese-simplified/SolidWorks/sldworks/hidd_sketch_diagnostics.htm" },
    { title: "FeatureXpert", publisher: t("SOLIDWORKS 2018 帮助", "SOLIDWORKS 2018 Help"), url: "https://help.solidworks.com/2018/chinese-simplified/SolidWorks/sldworks/c_FeatureXpert.htm" },
    { title: "全部计算", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-COMPUTE-ALL.htm" },
    { title: "重新定义草图平面", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/GUID-3E407E01-65AE-4DCC-A3A7-1439D9B5182F.htm" },
    { title: "错误指示符", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Home/error_indicators.htm" },
    { title: "修复", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Document/repairing.htm" },
  ],
  related: { lessons: ["feature-tree", "fillet-shell-order"], cards: ["1.3.6"] },
}

export default card
