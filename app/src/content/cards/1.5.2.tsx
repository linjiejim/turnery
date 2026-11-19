import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.5.2 配置、变体与设计表. Figure: 3 px = 1 mm. */

const VARIANTS = [
  { x: 70, len: 10 },
  { x: 160, len: 20 },
  { x: 250, len: 30 },
]

const card: CardDef = {
  code: "1.5.2",
  title: t("配置：一个模型管一个系列", "Configurations, variants and design tables"),
  minutes: 4,
  sections: [
    {
      heading: t("一个系列，一个模型", "One series, one model"),
      body: byLocale(
        <>
          <p>M3 到 M8 的螺钉、三种长度的隔离柱、几种宽度的导轨：结构一样，只有几个尺寸不同。每个规格建一个文件，改一处结构就要改好几遍，迟早改漏。</p>
          <p>配置把这些规格放进同一个模型。每个配置是一组参数值，再加上哪些特征打开、哪些压缩，比如短的那个规格不要中间的减重孔。</p>
        </>,
        <>
          <p>
            Screws from M3 to M8, standoffs in three lengths, rails in several widths: the design is the same and only a few dimensions differ. Make one file per size and every design change has to be made several times; sooner or later one
            gets missed.
          </p>
          <p>
            Configurations put all these sizes into one model. Each configuration is a set of parameter values, plus which features are on and which are suppressed: the short size, say, leaves out the lightening hole in the middle.
          </p>
        </>,
      ),
    },
    {
      heading: t("用表格管理规格", "Managing sizes in a table"),
      body: byLocale(
        <>
          <p>规格多了，表格最清楚：每行一个规格，每列一个参数或一个特征开关。</p>
          <ul>
            <li>SOLIDWORKS：「配置」，在 ConfigurationManager 里管理。表格叫「系列零件设计表」（嵌入 Excel），2024 版起还有不需要 Excel 的「配置表」。</li>
            <li>Fusion：「配置」。把设计转成配置的设计后，用「配置表」管理参数、特征抑制、材料等。</li>
            <li>Onshape：「配置」由几个独立的输入组成：列表、复选框、配置变量，可以用在 Part Studio、装配体和 Variable Studio 里。</li>
            <li>FreeCAD：没有原生的配置，在电子表格里右键「配置表…」建一张配置表，用一个下拉属性切换规格。</li>
          </ul>
        </>,
        <>
          <p>Once there are many sizes, a table is clearest: one row per size, one column per parameter or feature switch.</p>
          <ul>
            <li>SOLIDWORKS: “Configurations”, managed in the ConfigurationManager. The table is a “Design Table” (an embedded Excel sheet); since the 2024 release there is also a “Configuration Table” that doesn't need Excel.</li>
            <li>Fusion: “Configurations”. Once you turn a design into a configured design, the “Configuration Table” manages parameters, feature suppression, materials and more.</li>
            <li>Onshape: a “Configuration” is made of several independent inputs (lists, checkboxes, configuration variables), and works in Part Studios, Assemblies and Variable Studios.</li>
            <li>FreeCAD: there are no native configurations. Right-click in a spreadsheet and choose “Configuration table…” to build one; a drop-down property switches between sizes.</li>
          </ul>
        </>,
      ),
    },
    {
      heading: t("别让配置失控", "Don't let configurations get out of hand"),
      body: byLocale(
        <ul>
          <li>开关多了，组合会成倍增加：3 种长度 × 2 种孔 × 2 种材料就是 12 种。Onshape 帮助就提到，几百上千行的设计表难维护、容易出错，所以它把输入拆成几个独立的小表。</li>
          <li>结构不同的零件不要硬塞进一个模型。靠压缩一大半特征变出另一个零件，不如另建一个。</li>
          <li>改尺寸时看清作用范围。SOLIDWORKS 改尺寸会问作用于「此配置」还是「所有配置」：只想改一个规格却选了所有配置，是最常见的错误。</li>
        </ul>,
        <ul>
          <li>
            Switches multiply: 3 lengths × 2 hole types × 2 materials is already 12 combinations. Onshape's help points out that design tables with hundreds or thousands of rows are hard to maintain and error-prone, which is why it splits
            the inputs into several small independent tables.
          </li>
          <li>Don't cram parts that are built differently into one model. If you have to suppress more than half the features to get the other part, build it as a model of its own.</li>
          <li>
            Watch the scope when you change a dimension. SOLIDWORKS asks whether the change applies to “This configuration” or “All configurations”: choosing all configurations when you only meant to change one size is the most common
            mistake.
          </li>
        </ul>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={168} label={t("同一个隔离柱模型的三个配置：长度 10、20、30", "Three configurations of one standoff model: lengths 10, 20 and 30")}>
        {VARIANTS.map((v) => {
          const h = v.len * 3
          const top = 132 - h
          return (
            <g key={v.len}>
              <rect x={v.x - 18} y={top} width={36} height={h} rx={2} className="fill-muted" strokeWidth={1.5} />
              <path d={`M ${v.x - 6} ${top} V ${top + h} M ${v.x + 6} ${top} V ${top + h}`} strokeDasharray="4 3" strokeWidth={0.9} className="text-muted-foreground" />
              <T x={v.x} y={152} anchor="middle" className="font-mono">
                {`L = ${v.len}`}
              </T>
            </g>
          )
        })}
        <line x1={20} y1={132} x2={300} y2={132} className="text-border" />
        <T x={160} y={18} anchor="middle" tone="muted">
          {t("一个模型，三个配置", "One model, three configurations")}
        </T>
      </Svg>
    ),
    caption: t(
      "同一个隔离柱模型的三个配置，只有长度不同。改一处结构（比如孔径），三个规格一起更新。",
      "Three configurations of the same standoff model, differing only in length. Change the design in one place (the hole size, say) and all three sizes update.",
    ),
    after: 0,
  },
  table: {
    caption: t("一张系列表的样子", "What a design table looks like"),
    head: byLocale(["配置", "长度 L", "孔径", "减重孔"], ["Configuration", "Length L", "Hole size", "Lightening hole"]),
    rows: byLocale(
      [
        ["L10", "10", "M3 螺纹", "压缩"],
        ["L20", "20", "M3 螺纹", "压缩"],
        ["L30", "30", "M3 螺纹", "打开"],
      ],
      [
        ["L10", "10", "M3 tapped", "Suppressed"],
        ["L20", "20", "M3 tapped", "Suppressed"],
        ["L30", "30", "M3 tapped", "On"],
      ],
    ),
    after: 1,
    note: t(
      "每行一个规格，每列一个参数或一个特征开关。SOLIDWORKS 的系列零件设计表、Fusion 的配置表、FreeCAD 的配置表都是这个形状。",
      "One row per size, one column per parameter or feature switch. A SOLIDWORKS design table, a Fusion configuration table and a FreeCAD configuration table all have this shape.",
    ),
  },
  terms: { concepts: ["configuration", "parameter", "design-intent"] },
  quiz: [
    {
      q: t("一个支架有 3 种长度，结构完全一样。最好怎么建？", "A bracket comes in 3 lengths with exactly the same design. What's the best way to model it?"),
      options: byLocale(["建 3 个文件", "一个模型，3 个配置", "只建最长的，用的时候再切短"], ["Three files", "One model with 3 configurations", "Model only the longest one and cut it short when needed"]),
      answer: 1,
      explain: t(
        "配置让 3 个规格共享同一套特征，改结构只改一处。3 个文件要改 3 遍；只建最长的，另外两个规格就没有模型可以出图和下料。",
        "Configurations let the 3 sizes share one set of features, so a design change happens in one place. Three files means making every change three times; model only the longest, and the other two sizes have no model to make drawings from or to cut stock by.",
      ),
    },
    {
      q: t(
        "在 SOLIDWORKS 里改一个尺寸，弹出「此配置 / 所有配置」。只想改当前这个规格，该选？",
        "You change a dimension in SOLIDWORKS and it asks “This configuration / All configurations”. You only want to change the current size. Which do you pick?",
      ),
      options: byLocale(["此配置", "所有配置", "随便，结果一样"], ["This configuration", "All configurations", "Either, the result is the same"]),
      answer: 0,
      explain: t(
        "选「所有配置」会把每个规格的这个尺寸都改成同一个值，整个系列就乱了。",
        "“All configurations” sets this dimension to the same value in every size, and the whole series is wrong.",
      ),
    },
    {
      q: t(
        "两个零件只有一半特征相同，另一半完全不同。适合做成一个模型的两个配置吗？",
        "Two parts share only half their features; the other half is completely different. Should they be two configurations of one model?",
      ),
      options: byLocale(
        ["适合，配置越多越省事", "不太适合：靠压缩大量特征变出另一个零件，难维护，不如分成两个模型", "必须用配置"],
        ["Yes: the more configurations, the less work", "Not really: getting one part out of the other by suppressing lots of features is hard to maintain, so two models are better", "You have to use configurations"],
      ),
      answer: 1,
      explain: t(
        "配置适合「结构相同、尺寸不同」的系列。结构差得多，配置表里全是开关，谁也看不懂，改一个特征还可能影响另一个零件。",
        "Configurations suit a series that is “same design, different sizes”. When the designs differ a lot, the configuration table is all switches that nobody can follow, and changing one feature may affect the other part too.",
      ),
    },
  ],
  takeaways: byLocale(
    ["结构相同、尺寸不同的一组零件，用一个模型的多个配置来管", "规格多了用表格：每行一个规格，每列一个参数或特征开关", "控制组合数量；改尺寸时看清是此配置还是所有配置"],
    [
      "A set of parts with the same design and different sizes: manage it as one model with several configurations",
      "With many sizes, use a table: one row per size, one column per parameter or feature switch",
      "Keep the number of combinations down; when you change a dimension, check whether it applies to this configuration or to all of them",
    ],
  ),
  sources: [
    { title: "配置概述", publisher: t("SOLIDWORKS 2022 帮助", "SOLIDWORKS 2022 Help"), url: "https://help.solidworks.com/2022/chinese-simplified/SolidWorks/sldworks/c_Configurations_Overview.htm" },
    { title: "系列零件设计表配置", publisher: t("SOLIDWORKS 2025 帮助", "SOLIDWORKS 2025 Help"), url: "https://help.solidworks.com/2025/Chinese-simplified/SolidWorks/sldworks/c_Design_Table_Configurations.htm" },
    {
      title: t("修改配置（配置表）", "修改配置 (Configuration Table)"),
      publisher: t("SOLIDWORKS 2024 帮助", "SOLIDWORKS 2024 Help"),
      url: "https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/c_ModifyCfg_Modify_Configurations.htm",
    },
    { title: "配置概述", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Configurations/files/CFG-OVERVIEW.htm" },
    { title: "配置", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/configurations.htm" },
    { title: "Configuration Tables", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Configuration_Tables" },
  ],
  related: { teardowns: ["brick"], cards: ["1.5.1"] },
}

export default card
