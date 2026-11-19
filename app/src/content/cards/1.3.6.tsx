import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.3.6 设计变更演练. Figure: 1.25 px = 1 mm, plates centred on x = 200. */

const plate = (y: number, len: number, holes: number[], tone?: string) => {
  const x0 = 200 - (len * 1.25) / 2
  return (
    <g className={tone}>
      <rect x={x0} y={y} width={len * 1.25} height={30} rx={3} className="fill-muted" strokeWidth={1.5} />
      {holes.map((h) => (
        <circle key={h} cx={x0 + h * 1.25} cy={y + 15} r={6} className="fill-background" strokeWidth={1.5} />
      ))}
    </g>
  )
}

const card: CardDef = {
  code: "1.3.6",
  title: t("设计变更演练：改了尺寸，模型还对吗", "Design change drills"),
  minutes: 4,
  sections: [
    {
      heading: t("好模型经得起改", "A good model survives changes"),
      body: byLocale(
        <>
          <p>设计意图说的是：模型被修改时应该怎样变化。建完不算完，要把关键尺寸改一改，看模型是不是按你想的变。</p>
          <p>认证考试也这么考。SOLIDWORKS 的 CSWA 样题先让你按图建一个零件、报质量，再改几个尺寸、减掉或加上几个特征，每一步都重新报质量。前面的模型意图不对，后面每一题都会错。</p>
        </>,
        <>
          <p>Design intent is about how a model should behave when it changes. Building it isn't the end: change the key dimensions and check that the model changes the way you meant.</p>
          <p>
            Certification exams test exactly this. The SOLIDWORKS CSWA sample exam has you build a part from a drawing and report its mass, then change a few dimensions and remove or add a few features, reporting the mass again after each step. If the
            first model's intent is wrong, every question after it comes out wrong too.
          </p>
        </>,
      ),
    },
    {
      heading: t("演练怎么做", "How to run the drill"),
      body: byLocale(
        <>
          <ol>
            <li>列出最可能变的 3–5 个尺寸：总长、壁厚、孔距、孔数。</li>
            <li>每次只改一个，改到合理范围的两头，每次都重建。</li>
            <li>
              每次查三件事：有没有报错；孔、筋、圆角是否还在该在的位置（对称的还对称，居中的还居中）；体积或质量的变化是否合理。
            </li>
            <li>改回原值，确认模型复原。</li>
          </ol>
          <p>
            工具上，Fusion 的「更改参数」能在一个对话框里改所有参数；Onshape 可以把关键尺寸做成「配置」，切换几组值来比较；SOLIDWORKS 的「传感器」能监视质量或尺寸，超出设定范围时在设计树里提醒。
          </p>
        </>,
        <>
          <ol>
            <li>List the 3–5 dimensions most likely to change: overall length, wall thickness, hole spacing, number of holes.</li>
            <li>Change one at a time, to each end of its reasonable range, and rebuild every time.</li>
            <li>
              Each time, check three things: are there any errors; are the holes, ribs and fillets still where they belong (what was symmetric is still symmetric, what was centered is still centered); does the change in volume or mass make
              sense.
            </li>
            <li>Set it back to the original value and check that the model returns to how it was.</li>
          </ol>
          <p>
            For tools: Fusion's “Change Parameters” edits every parameter in one dialog; in Onshape you can make the key dimensions a “configuration” and switch between sets of values to compare them; SOLIDWORKS “Sensors” watch the mass or a
            dimension and flag it in the design tree when it goes outside the range you set.
          </p>
        </>,
      ),
    },
    {
      heading: t("改坏了说明什么", "What a broken change tells you"),
      body: byLocale(
        <>
          <ul>
            <li>孔跑偏了：孔的位置从某条模型边量起，而不是从对称面或基准量起。</li>
            <li>孔数没变、间距被挤：阵列写死了间距，没有按总长均分，或者数量不是公式。</li>
            <li>改大后圆角报错：圆角引用的边被分割或消失了，或者半径超过了上限。</li>
          </ul>
          <p>不报错不等于对：选错参考、拓扑命名问题，常常让特征悄悄跑到别处。发现问题，就回到草图和特征里改参考和约束，而不是只把数值调回去。</p>
        </>,
        <>
          <ul>
            <li>A hole drifts off position: it is located from a model edge, not from a plane of symmetry or a datum.</li>
            <li>The hole count stays the same and the spacing gets squeezed: the pattern has a fixed spacing instead of dividing the overall length evenly, or the count isn't driven by an equation.</li>
            <li>A fillet fails after you make the part bigger: the edge it references was split or disappeared, or the radius went over its limit.</li>
          </ul>
          <p>
            No error doesn't mean correct: a wrong reference or the topological naming problem often moves a feature somewhere else without a word. When you find a problem, go back into the sketches and features and fix the references and
            constraints, rather than just setting the value back.
          </p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={198}
        label={t(
          "总长从 80 改到 120：孔位从左端量会跑偏，从两端量仍然对称",
          "Overall length changed from 80 to 120: holes located from the left end drift off, holes located from both ends stay symmetric",
        )}
      >
        <line x1={200} y1={8} x2={200} y2={192} strokeDasharray="10 3 2 3" strokeWidth={0.75} className="text-faint-foreground" />
        <T x={8} y={34}>
          {t("原设计", "Original")}
        </T>
        <T x={8} y={52} tone="muted">
          {t("长 80", "Length 80")}
        </T>
        {plate(20, 80, [20, 60])}
        <T x={8} y={100} tone="muted">
          {t("改到 120", "Changed to 120")}
        </T>
        <T x={8} y={118}>
          {t("孔位从左端量", "Holes from left")}
        </T>
        {plate(86, 120, [20, 60], "text-destructive")}
        <T x={8} y={166} tone="muted">
          {t("改到 120", "Changed to 120")}
        </T>
        <T x={8} y={184}>
          {t("孔位从两端量", "Holes from ends")}
        </T>
        {plate(152, 120, [20, 100], "text-primary")}
      </Svg>
    ),
    caption: t(
      "同样把长度从 80 改到 120，结果取决于孔位参考了什么。中间那块的右孔跑到了正中，下面那块仍然对称。演练就是让这种差别提前暴露。",
      "Both plates go from 80 to 120 long, and the result depends on what the hole positions reference. On the middle plate the right hole ends up dead center; the bottom plate stays symmetric. The drill is there to expose differences like this early.",
    ),
    after: 0,
  },
  terms: { ops: ["pattern", "hole"], concepts: ["design-intent", "parameter", "tnp"] },
  quiz: [
    {
      q: t("总长从 80 改到 120 后，一个孔跑到了零件正中间。最可能的原因是？", "After the overall length goes from 80 to 120, one hole ends up in the middle of the part. What is the most likely cause?"),
      options: byLocale(
        ["孔位从左端标起，没有表达「靠两端」或「对称」", "软件计算出错", "长度改得太多了"],
        ["The holes are dimensioned from the left end, so nothing says “near both ends” or “symmetric”", "The software miscalculated", "The length was changed by too much"],
      ),
      answer: 0,
      explain: t(
        "模型照着你给的参考变化。孔位从左端量，长度变了它当然不动。想让孔靠两端，就从两端标；想让孔对称，就从对称面标。",
        "The model changes according to the references you gave it. A hole located from the left end naturally stays put when the length changes. Want the holes near both ends? Dimension them from both ends. Want them symmetric? Dimension them from the plane of symmetry.",
      ),
    },
    {
      q: t("演练的正确做法是？", "What is the right way to run the drill?"),
      options: byLocale(
        ["一次只改一个关键尺寸，改到范围两头，每次都重建检查", "所有尺寸一起改，节省时间", "只改大一点点，确认不报错就行"],
        ["Change one key dimension at a time, to each end of its range, and rebuild and check every time", "Change all the dimensions at once to save time", "Make it just a little bigger and check that nothing errors"],
      ),
      answer: 0,
      explain: t(
        "一次改好几个，出了问题不知道是谁引起的；只做小改动，暴露不出极端值下的失败。",
        "Change several at once, and when something breaks you can't tell which change caused it. Small changes alone won't expose the failures that happen at extreme values.",
      ),
    },
    {
      q: t("改尺寸后模型没有报错，就说明它是对的吗？", "The model shows no errors after you change a dimension. Does that mean it's right?"),
      options: byLocale(
        ["是，不报错就没问题", "不一定：还要看特征位置是否符合意图，质量变化是否合理", "是，只要重建成功就行"],
        ["Yes, no errors means no problems", "Not necessarily: you also have to check that the features sit where the intent says and that the mass changed sensibly", "Yes, as long as it rebuilds successfully"],
      ),
      answer: 1,
      explain: t(
        "选错参考和拓扑命名问题常常不报错，只是悄悄做错。看位置、看对称、看质量变化，才知道模型是不是按意图变。",
        "Wrong references and the topological naming problem often raise no error; they just quietly get it wrong. Only by checking positions, symmetry and the change in mass do you know whether the model changes as intended.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "建完不算完：把关键尺寸改到两头，看模型是否按意图变化",
      "每次只改一个，查三件事：有没有报错、特征位置对不对、质量变化合不合理",
      "不报错不等于对；改坏了就回去改参考和约束，不只是调数值",
    ],
    [
      "Building it isn't the end: push the key dimensions to both ends of their range and see whether the model changes as intended",
      "Change one at a time and check three things: any errors, whether the features are in the right place, whether the mass change makes sense",
      "No error doesn't mean correct; when a change breaks the model, go back and fix the references and constraints, not just the values",
    ],
  ),
  sources: [
    { title: "设计意图", publisher: t("SOLIDWORKS 2018 帮助", "SOLIDWORKS 2018 Help"), url: "https://help.solidworks.com/2018/Chinese-simplified/SolidWorks/acadhelp/c_Design_Intent.htm" },
    { title: "CSWA Sample Exam", publisher: "SOLIDWORKS", url: "https://www.solidworks.com/sites/default/files/2018-07/CSWASampleExam.pdf" },
    { title: "传感器", publisher: t("SOLIDWORKS 2015 帮助", "SOLIDWORKS 2015 Help"), url: "https://help.solidworks.com/2015/chinese-simplified/SolidWorks/sldworks/c_Sensors_OH.htm" },
    { title: "更改参数", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-MODIFY-CHANGE-PARAMETERS.htm" },
    { title: "配置", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/configurations.htm" },
    {
      title: t(
        "Parametric CAD modeling: An analysis of strategies for design reusability（Camba, Contero, Company, 2016）",
        "Parametric CAD modeling: An analysis of strategies for design reusability (Camba, Contero, Company, 2016)",
      ),
      publisher: "Computer-Aided Design 74",
      url: "https://riunet.upv.es/handle/10251/82267",
    },
  ],
  related: { lessons: ["sketch-to-solid", "pattern-mirror"], teardowns: ["brick"], cards: ["1.3.5"] },
}

export default card
