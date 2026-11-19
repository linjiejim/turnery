import { Arrow, Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.1.6 参数与方程. */

const card: CardDef = {
  code: "1.1.6",
  title: t("参数与方程：给尺寸起名字", "Parameters and equations"),
  minutes: 4,
  sections: [
    {
      heading: t("为什么要起名字", "Why give dimensions names"),
      body: byLocale(
        <>
          <p>尺寸的默认名字是软件编的：SOLIDWORKS 里像 <code>D1@草图1</code>，Fusion 里像 <code>d1</code>、<code>d2</code>。过一个月再改模型，没人记得 d7 是什么。</p>
          <p>
            给关键尺寸起名字，比如外宽 <code>Width</code>、壁厚 <code>Wall</code>，其他尺寸写成公式：内腔宽 = <code>Width - 2 * Wall</code>。改一个数，相关尺寸一起变；模型自己也说清楚了「内腔宽由外宽和壁厚决定」这个设计意图。
          </p>
        </>,
        <>
          <p>
            Dimensions get default names made up by the software: something like <code>D1@Sketch1</code> in SOLIDWORKS, or <code>d1</code>, <code>d2</code> in Fusion. Come back to the model a month later and nobody remembers what
            d7 is.
          </p>
          <p>
            Name the key dimensions, say <code>Width</code> for the outer width and <code>Wall</code> for the wall thickness, and write the others as formulas: cavity width = <code>Width - 2 * Wall</code>. Change one number and the
            related dimensions change with it. The model also states its own design intent: “the cavity width is set by the outer width and the wall thickness.”
          </p>
        </>,
      ),
    },
    {
      heading: t("公式里写上单位", "Write units in your formulas"),
      body: byLocale(
        <>
          <p>各软件的表达式都认单位：Onshape 的数值框里可以写 <code>3 mm + 2.5 in</code>，SOLIDWORKS 的方程式里可以混用 <code>in</code> 和 <code>mm</code>，FreeCAD 的表达式会检查单位，<code>2 mm + 4 mm</code> 合法，<code>2 mm + 4</code> 不合法。</p>
          <p>写上单位，就不怕文档单位和你想的不一样。参数名用英文字母、数字和下划线最稳妥，各软件都认。</p>
        </>,
        <>
          <p>
            Every package's expressions understand units. In an Onshape numeric field you can write <code>3 mm + 2.5 in</code>; SOLIDWORKS equations can mix <code>in</code> and <code>mm</code>; FreeCAD's expressions check units, so{" "}
            <code>2 mm + 4 mm</code> is valid and <code>2 mm + 4</code> isn't.
          </p>
          <p>With the units written in, it doesn't matter if the document's units aren't what you think. For parameter names, plain letters a–z, digits and underscores are the safest choice: every package accepts them.</p>
        </>,
      ),
    },
    {
      heading: t("驱动尺寸和从动尺寸", "Driving and driven dimensions"),
      body: byLocale(
        <>
          <p>有的尺寸只用来「看」：它的值由别的几何决定，不能改，只能读。SOLIDWORKS 叫从动尺寸（参考尺寸），Fusion 叫从动尺寸，Onshape 叫联动（参照）尺寸。</p>
          <p>想在草图上显示一个算出来的距离，又不想让草图过定义，就加从动尺寸。它跟着几何更新，不会和驱动尺寸冲突。</p>
        </>,
        <>
          <p>
            Some dimensions are only for “looking”: their value is set by other geometry, so you can't change them, only read them. SOLIDWORKS calls them driven (reference) dimensions; Fusion and Onshape call them driven dimensions.
          </p>
          <p>To show a computed distance on the sketch without over-defining it, add a driven dimension. It updates with the geometry and never conflicts with the driving dimensions.</p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={184}
        label={t("盒子截面：外宽 Width 和壁厚 Wall 是输入，内腔宽由公式算出", "A box section: the outer width Width and the wall thickness Wall are inputs, and a formula computes the cavity width")}
      >
        <path d="M 60 30 V 140 H 260 V 30 H 245 V 125 H 75 V 30 Z" className="fill-muted" strokeWidth={1.5} />
        <g className="text-muted-foreground" strokeWidth={0.75}>
          <path d="M 60 144 V 160 M 260 144 V 160" />
        </g>
        <Arrow x1={60} y1={156} x2={260} y2={156} both className="text-foreground" />
        <T x={160} y={176} anchor="middle">
          Width = 60
        </T>
        <Arrow x1={75} y1={70} x2={245} y2={70} both className="text-primary" />
        <T x={160} y={62} anchor="middle" tone="primary">
          Width - 2 * Wall
        </T>
        <Arrow x1={60} y1={20} x2={75} y2={20} both className="text-foreground" />
        <T x={82} y={24}>
          Wall = 3
        </T>
      </Svg>
    ),
    caption: t(
      "外宽和壁厚是起了名字的输入，内腔宽是公式。把 Wall 改成 4，内腔宽自动变成 52。",
      "The outer width and the wall thickness are named inputs; the cavity width is a formula. Change Wall to 4 and the cavity width becomes 52 on its own.",
    ),
    after: 0,
  },
  table: {
    caption: t("参数放在哪里", "Where parameters live"),
    head: byLocale(["软件", "入口", "怎么引用"], ["Software", "Where to find it", "How to reference one"]),
    rows: byLocale(
      [
        ["Fusion", "修改 > 更改参数：用户参数和模型参数", <>输入框里写 <code>Width / 2</code>；也可以直接输入 <code>Width=60</code> 顺手起名</>],
        ["SOLIDWORKS", "工具 > 方程式：方程式、全局变量和尺寸", <>在尺寸的「修改」框里先输入 <code>=</code>，再写公式或选全局变量</>],
        ["Onshape", "「变量」特征", <>任何数值框里写 <code>#width</code>；只有排在变量下面的特征能用它</>],
        ["FreeCAD", "表达式；「电子表格」里给单元格设别名", <>输入框里键入 <code>=</code>，写 <code>Spreadsheet.width</code></>],
      ],
      [
        [
          "Fusion",
          "Modify > Change Parameters: user parameters and model parameters",
          <>
            Write <code>Width / 2</code> in an input box. You can also type <code>Width=60</code> to name it as you go
          </>,
        ],
        [
          "SOLIDWORKS",
          "Tools > Equations: equations, global variables and dimensions",
          <>
            In a dimension's “Modify” box, type <code>=</code> first, then write the formula or pick a global variable
          </>,
        ],
        [
          "Onshape",
          "The “Variable” feature",
          <>
            Write <code>#width</code> in any numeric field. Only features below the variable can use it
          </>,
        ],
        [
          "FreeCAD",
          "Expressions; give cells aliases in a “Spreadsheet”",
          <>
            Type <code>=</code> in an input box, then write <code>Spreadsheet.width</code>
          </>,
        ],
      ],
    ),
    after: 1,
  },
  terms: { ops: ["sketch"], concepts: ["parameter", "design-intent", "fully-defined"] },
  quiz: [
    {
      q: t(
        "外宽 Width = 60，壁厚 Wall = 3，内腔宽写成 Width - 2 * Wall。把 Wall 改成 4，内腔宽变成多少？",
        "The outer width is Width = 60, the wall is Wall = 3, and the cavity width is written as Width - 2 * Wall. You change Wall to 4. What is the cavity width now?",
      ),
      options: ["54", "52", "56"],
      answer: 1,
      explain: t(
        "60 − 2 × 4 = 52。内腔宽是派生尺寸，自己跟着变。要是当初直接输入了 54，改壁厚后它不会动，外宽、壁厚和内腔就对不上了。",
        "60 − 2 × 4 = 52. The cavity width is a derived dimension, so it follows on its own. Had you typed 54 straight in, it wouldn't move when the wall changes, and the outer width, wall and cavity would no longer agree.",
      ),
    },
    {
      q: t(
        "想在草图上显示一个由其他几何决定的距离，又不让草图过定义，该怎么做？",
        "You want to show a distance that other geometry determines on the sketch, without over-defining the sketch. What do you do?",
      ),
      options: byLocale(
        ["加一个从动（参考）尺寸", "加一个普通尺寸，再删掉一个约束", "在旁边写一行注释文字"],
        ["Add a driven (reference) dimension", "Add a normal dimension, then delete a constraint", "Write a note next to it"],
      ),
      answer: 0,
      explain: t(
        "从动尺寸只读不驱动，几何变了它跟着更新，不会和驱动尺寸打架。删约束会改变设计意图，注释文字不会随几何更新。",
        "A driven dimension is read-only and drives nothing. It updates when the geometry changes and never fights the driving dimensions. Deleting a constraint changes the design intent, and a note doesn't update with the geometry.",
      ),
    },
    {
      q: t(
        "在 Onshape 里，变量 #width 定义在特征列表的第 5 个位置。第 3 个特征能用它吗？",
        "In Onshape, the variable #width is defined at position 5 in the Feature list. Can the third feature use it?",
      ),
      options: byLocale(
        ["能，变量是全局的", "不能，变量也是特征，只有排在它后面的特征能用", "能，但要手动刷新"],
        ["Yes, variables are global", "No: a variable is a feature too, and only features after it can use it", "Yes, but you have to refresh by hand"],
      ),
      answer: 1,
      explain: t(
        "Onshape 的「变量」是特征列表里的一个特征，按顺序计算。把变量放在列表最上面，后面所有特征都能用它。",
        "Onshape's “Variable” is a feature in the Feature list, and the list is computed in order. Put the variable at the top of the list and every feature after it can use it.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "给关键尺寸起名字，其他尺寸写成公式：改一处，相关尺寸一起变",
      "公式里写上单位，参数名用英文字母、数字和下划线",
      "只想看、不想控制的尺寸，用从动（参考）尺寸",
    ],
    [
      "Name the key dimensions and write the others as formulas: change one place and the related dimensions follow",
      "Write units in your formulas, and use letters a–z, digits and underscores in parameter names",
      "For a dimension you only want to read, not control, use a driven (reference) dimension",
    ],
  ),
  sources: [
    { title: "Fusion 中的参数", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-MODIFY-PARAMETERS.htm" },
    {
      title: t("创建草图尺寸（驱动与从动）", "创建草图尺寸 (driving and driven)"),
      publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"),
      url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-CREATE-DIMENSIONS.htm",
    },
    {
      title: "使用全局变量链接尺寸",
      publisher: t("SOLIDWORKS 2024 帮助", "SOLIDWORKS 2024 Help"),
      url: "https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/t_link_dimensions_use_global_variables.htm",
    },
    { title: "在方程式中指定单位", publisher: t("SOLIDWORKS 2015 帮助", "SOLIDWORKS 2015 Help"), url: "https://help.solidworks.com/2015/chinese-simplified/solidworks/sldworks/c_specifying_units.htm" },
    { title: "变量", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/variable.htm" },
    { title: "数值输入框", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Home/numeric_fields.htm" },
    { title: "Expressions", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Expressions" },
  ],
  related: { lessons: ["constraints-dof"], teardowns: ["gear"], cards: ["1.1.4", "1.5.1"] },
}

export default card
