import { Arrow, Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.5.3 质量属性、测量与截面分析. Figure: 1.2 px = 1 mm. */

const axes = (x: number, y: number) => (
  <g className="text-muted-foreground">
    <Arrow x1={x} y1={y} x2={x + 24} y2={y} />
    <Arrow x1={x} y1={y} x2={x} y2={y - 24} />
  </g>
)
const centroid = (x: number, y: number) => (
  <g className="text-primary">
    <circle cx={x} cy={y} r={4.5} className="fill-current" stroke="none" />
    <path d={`M ${x - 9} ${y} H ${x + 9} M ${x} ${y - 9} V ${y + 9}`} strokeWidth={1} />
  </g>
)

const card: CardDef = {
  code: "1.5.3",
  title: t("用质量、测量和剖面给模型自查", "Mass properties, measurement and section analysis"),
  minutes: 4,
  sections: [
    {
      heading: t("质量属性：一组数检查整个模型", "Mass properties: a few numbers check the whole model"),
      body: byLocale(
        <>
          <p>质量属性给出体积、表面积、质量、质心和惯性矩。它们像整个模型的指纹：少一个孔、厚度错一点，体积就会变。按图建模的考试正是靠它判分。</p>
          <p>自查时先心算一个大概。100 × 50 × 20 mm 的块是 100 cm³，挖掉几个孔，结果应该略小于这个数。差得多，就去找漏掉或建反的特征。体积只看几何，质量还要看材料（见「单位、精度与材料」那张卡）。</p>
          <p>入口：SOLIDWORKS「工具 &gt; 评估 &gt; 质量属性」；Fusion 在浏览器里右键零部件选「特性」；Onshape 用右下角的「质量属性工具」。</p>
        </>,
        <>
          <p>
            Mass properties give you volume, surface area, mass, center of mass and moments of inertia. Together they are a fingerprint of the whole model: leave out one hole or get a thickness slightly wrong, and the volume changes. Exams
            where you model from a drawing are graded exactly this way.
          </p>
          <p>
            When you check your own model, estimate first, in your head. A 100 × 50 × 20 mm block is 100 cm³; cut a few holes in it and the result should be a little under that. If it's far off, look for a feature you missed or built the
            wrong way round. Volume depends only on the geometry; mass depends on the material too (see the “Units, precision and material settings” card).
          </p>
          <p>
            Where to find it: in SOLIDWORKS, “Tools &gt; Evaluate &gt; Mass Properties”; in Fusion, right-click the component in the browser and choose “Properties”; in Onshape, the “Mass properties tool” at the lower right.
          </p>
        </>,
      ),
    },
    {
      heading: t("质心坐标取决于原点", "Center of mass coordinates depend on the origin"),
      body: byLocale(
        <>
          <p>质心是相对某个坐标系报出来的。SOLIDWORKS 默认相对模型的坐标系，可以选别的坐标系；Fusion 的「质心」给的是全局坐标；Onshape 的惯性矩默认相对质心计算，选一个嵌合连接器可以换参考。</p>
          <p>同一块板，原点放在角上和放在中心，质心坐标完全不同。和答案或同事对数之前，先确认原点在哪里。对称零件的质心应该落在对称面上，这本身就是一个好检查。</p>
        </>,
        <>
          <p>
            The center of mass is reported relative to some coordinate system. SOLIDWORKS uses the model's coordinate system by default and lets you pick another; Fusion's “Center of Mass” gives global coordinates; Onshape computes moments of
            inertia about the center of mass by default, and you can pick a mate connector to change the reference.
          </p>
          <p>
            Put the origin of the same plate at a corner or at its center, and the center of mass coordinates come out completely different. Before you compare numbers with an answer key or a colleague, check where the origin is. The center
            of mass of a symmetric part should lie on its plane of symmetry, which is a good check in itself.
          </p>
        </>,
      ),
    },
    {
      heading: t("测量和剖面：看局部", "Measurement and sections: look at the details"),
      body: byLocale(
        <>
          <p>「测量」量两点、两个面之间的距离和角度，用来核对关键尺寸和装配间隙。想看里面，就剖开：抽壳后的壁厚、孔有没有打穿、筋有没有连到底，切一刀就清楚。</p>
        </>,
        <>
          <p>
            “Measure” gives the distance and angle between two points or two faces; use it to check key dimensions and assembly clearances. To see inside, cut it open: the wall thickness after a shell, whether a hole goes all the way
            through, whether a rib reaches the bottom. One cut makes it clear.
          </p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={150}
        label={t(
          "同一块板的质心：原点在角上时是 (50, 20)，原点在中心时是 (0, 0)",
          "Center of mass of the same plate: (50, 20) with the origin at a corner, (0, 0) with the origin at the center",
        )}
      >
        <rect x={20} y={36} width={120} height={48} className="fill-muted" strokeWidth={1.5} />
        {axes(20, 84)}
        {centroid(80, 60)}
        <T x={80} y={110} anchor="middle" tone="primary">
          {t("质心 (50, 20)", "CoM (50, 20)")}
        </T>
        <T x={80} y={132} anchor="middle" tone="muted">
          {t("原点在左下角", "Origin at lower left")}
        </T>
        <rect x={180} y={36} width={120} height={48} className="fill-muted" strokeWidth={1.5} />
        {axes(240, 60)}
        {centroid(240, 60)}
        <T x={240} y={110} anchor="middle" tone="primary">
          {t("质心 (0, 0)", "CoM (0, 0)")}
        </T>
        <T x={240} y={132} anchor="middle" tone="muted">
          {t("原点在中心", "Origin at center")}
        </T>
        <T x={160} y={20} anchor="middle" tone="muted">
          {t("100 × 40 mm 的板", "100 × 40 mm plate")}
        </T>
      </Svg>
    ),
    caption: t(
      "同一块板，质心的位置没变，报出来的坐标却不同：差别全在原点放在哪里。",
      "Same plate, same center of mass (CoM), yet different reported coordinates: the difference is all in where the origin is.",
    ),
    after: 1,
  },
  table: {
    caption: t("三类检查在各软件里的入口", "Where to find the three kinds of check in each package"),
    head: byLocale(["检查", "SOLIDWORKS", "Fusion", "Onshape"], ["Check", "SOLIDWORKS", "Fusion", "Onshape"]),
    rows: byLocale(
      [
        ["质量、体积、质心", "质量属性", "特性；检验 > 质心", "质量属性工具"],
        ["距离、角度", "测量", "检验 > 测量", "测量工具"],
        ["剖开看", "剖面视图", "检验 > 截面分析", "剖视图"],
      ],
      [
        ["Mass, volume, center of mass", "Mass Properties", "Properties; Inspect > Center of Mass", "Mass properties tool"],
        ["Distance, angle", "Measure", "Inspect > Measure", "Measure tool"],
        ["Cut it open", "Section View", "Inspect > Section Analysis", "Section view"],
      ],
    ),
    after: 2,
  },
  terms: { ops: ["shell"], concepts: ["section", "design-intent"] },
  quiz: [
    {
      q: t("按图建了一个零件，体积比答案大了约 3%。最可能是什么原因？", "You modeled a part from a drawing, and its volume is about 3% more than the answer. What is the most likely cause?"),
      options: byLocale(
        ["软件的计算误差", "漏了一个孔或切除，或者某个尺寸输错了", "材料设错了"],
        ["A calculation error in the software", "A missing hole or cut, or a dimension typed in wrong", "The material is set wrong"],
      ),
      answer: 1,
      explain: t(
        "体积只和几何有关，和材料无关。差几个百分点，通常是少了特征或某个尺寸不对；材料错了影响的是质量，不是体积。",
        "Volume depends only on the geometry, not on the material. A few percent off usually means a missing feature or a wrong dimension; a wrong material changes the mass, not the volume.",
      ),
    },
    {
      q: t(
        "你和同事建了同一个零件，质量一样，质心坐标却不一样。最可能是？",
        "You and a colleague modeled the same part. The mass matches, but the center of mass coordinates don't. What is most likely?",
      ),
      options: byLocale(
        ["其中一个人建错了", "两个人的原点放在了不同位置", "两个人的材料不同"],
        ["One of you modeled it wrong", "You put the origin in different places", "You used different materials"],
      ),
      answer: 1,
      explain: t(
        "质量一样说明几何和材料都对上了。质心是相对原点报的坐标，原点不同，数字就不同。",
        "Matching mass means the geometry and the material agree. The center of mass is reported as coordinates relative to the origin, so a different origin gives different numbers.",
      ),
    },
    {
      q: t("抽壳后想确认最薄处的壁厚，最直接的办法是？", "After a shell, you want to check the wall thickness where it is thinnest. What's the most direct way?"),
      options: byLocale(
        ["看质量属性里的体积", "剖开（截面分析 / 剖视图）再测量", "看外观颜色"],
        ["Look at the volume in the mass properties", "Cut it open (section analysis / section view) and measure", "Look at its color"],
      ),
      answer: 1,
      explain: t(
        "体积只能告诉你总量对不对，看不出哪里薄。剖开后量壁厚，局部问题一目了然。",
        "Volume only tells you whether the total is right, not where it's thin. Cut it open and measure the wall, and local problems are obvious at a glance.",
      ),
    },
  ],
  takeaways: byLocale(
    ["体积是几何的指纹：先心算一个大概，再和质量属性对照", "质心坐标取决于原点；对称零件的质心应落在对称面上", "关键尺寸用测量核对，内部结构剖开看"],
    [
      "Volume is the geometry's fingerprint: estimate it in your head first, then compare with the mass properties",
      "Center of mass coordinates depend on the origin; a symmetric part's center of mass should lie on its plane of symmetry",
      "Check key dimensions with Measure; cut the part open to see what's inside",
    ],
  ),
  sources: [
    { title: "质量属性", publisher: t("SOLIDWORKS 2021 帮助", "SOLIDWORKS 2021 Help"), url: "https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_MASSPROPERTY_TEXT_DLG.htm" },
    { title: t("重心（质心）", "重心 (center of mass)"), publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-EB8C9FD9-2CA6-4937-887D-0014E538BF2C.htm" },
    { title: "测量", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-MEASURE.htm" },
    {
      title: t("创建三维剖视图（截面分析）", "创建三维剖视图 (Section Analysis)"),
      publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"),
      url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-SECTION-ANALYSIS.htm",
    },
    { title: "质量属性工具", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/View/mass_properties_tool.htm" },
    { title: "测量工具", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/View/measure_tool.htm" },
    { title: "剖视图", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/View/section_view.htm" },
    { title: "CSWA Sample Exam", publisher: "SOLIDWORKS", url: "https://www.solidworks.com/sites/default/files/2018-07/CSWASampleExam.pdf" },
  ],
  related: { lessons: ["section-views", "fillet-shell-order"], cards: ["0.3.3", "0.2.4"] },
}

export default card
