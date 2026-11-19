import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 0.3.3 单位、精度与材料设置. */

const card: CardDef = {
  code: "0.3.3",
  title: t("单位、精度与材料：质量为什么会算错", "Units, precision and material settings"),
  minutes: 4,
  sections: [
    {
      heading: t("质量 = 体积 × 密度", "Mass = volume × density"),
      body: byLocale(
        <>
          <p>软件算质量只用两个数：几何算出的体积，和材料给的密度。体积对不对取决于单位，密度对不对取决于材料。任何一个设错，质量就全错，而模型看上去毫无问题，也不会报错。</p>
          <p>
            所以 SOLIDWORKS 认证考试（CSWA）的零件题每道都写明单位制、小数位数和材料。样题里写的是 MMGS 单位制、两位小数、AISI 1020 钢、密度 0.0079 g/mm³，要求报出以克为单位的质量。
          </p>
        </>,
        <>
          <p>
            The software computes mass from just two numbers: the volume from the geometry and the density from the material. Whether the volume is right depends on the units; whether the density is right depends on the material.
            Get either one wrong and the mass is completely wrong, yet the model looks perfectly fine and no error appears.
          </p>
          <p>
            That's why every part question in the SOLIDWORKS certification exam (CSWA) states the unit system, the number of decimal places and the material. The sample exam specifies the MMGS unit system, two decimal places, and
            AISI 1020 steel with a density of 0.0079 g/mm³, and asks for the mass in grams.
          </p>
        </>,
      ),
    },
    {
      heading: t("单位：先设好，再建模", "Units: set them before you model"),
      body: byLocale(
        <>
          <ul>
            <li>SOLIDWORKS：单位是文档属性（工具 &gt; 选项 &gt; 文档属性 &gt; 单位）。常用 MMGS（毫米、克、秒）和 IPS（英寸、磅、秒）；新零件的单位来自模板。</li>
            <li>Fusion：在浏览器的「文档设置」里改单位。</li>
            <li>Onshape：每个工作区有自己的「工作区单位」，默认跟随「帐户 &gt; 首选项」；帮助里写明的出厂默认是英寸。国内用户第一次用，先把默认单位改成毫米。</li>
          </ul>
          <p>1 英寸精确等于 25.4 毫米。在英寸文档里输入 20，得到的是 508 mm。数值框里可以直接带单位输入，比如 Onshape 里写 <code>20 mm</code>。</p>
          <p>小数位数只影响显示和报告时的舍入，不改变几何。Onshape 帮助写得很明白：显示位数不参与计算。</p>
        </>,
        <>
          <ul>
            <li>
              SOLIDWORKS: units are a document property (Tools &gt; Options &gt; Document Properties &gt; Units). The common systems are MMGS (millimeter, gram, second) and IPS (inch, pound, second); a new part gets its units from
              the template.
            </li>
            <li>Fusion: change the units under “Document Settings” in the browser.</li>
            <li>
              Onshape: each workspace has its own “Workspace units”, which by default follow your account preferences. The factory default, as the help states, is inches. If you work in millimeters, change the default units the
              first time you use it.
            </li>
          </ul>
          <p>
            1 inch is exactly 25.4 millimeters. Type 20 in an inch document and you get 508 mm. You can type the unit right into a numeric field, for example <code>20 mm</code> in Onshape.
          </p>
          <p>The number of decimal places only affects rounding for display and reports; it doesn't change the geometry. Onshape's help says so plainly: display precision takes no part in the calculation.</p>
        </>,
      ),
    },
    {
      heading: t("材料：没设的时候，各软件不一样", "Materials: when none is set, packages differ"),
      body: byLocale(
        <>
          <ul>
            <li>SOLIDWORKS：零件没指定材料时，用模板里的默认密度；常见的默认模板是 1000 kg/m³，也就是水。</li>
            <li>Fusion：新建或导入的实体会自动套用一个默认物理材料，默认值可以在首选项里改。</li>
            <li>Onshape：没指定材料的零件质量为零，质量属性工具会把它排除在计算之外并给出提示。</li>
          </ul>
          <p>三种做法都不报错。看质量之前，先确认每个零件的材料。</p>
        </>,
        <>
          <ul>
            <li>SOLIDWORKS: a part with no material assigned uses the default density from the template. In common default templates that is 1000 kg/m³, the density of water.</li>
            <li>Fusion: new or imported bodies automatically get a default physical material. You can change that default in Preferences.</li>
            <li>Onshape: a part with no material assigned has zero mass. The mass properties tool leaves it out of the calculation and shows a notice.</li>
          </ul>
          <p>None of the three shows an error. Before you look at the mass, check every part's material.</p>
        </>,
      ),
    },
  ],
  table: {
    caption: t("同一个 100 × 50 × 20 mm 的方块（体积 100 cm³）", "The same 100 × 50 × 20 mm block (volume 100 cm³)"),
    head: byLocale(["材料", "密度 g/cm³", "质量"], ["Material", "Density g/cm³", "Mass"]),
    rows: byLocale(
      [
        ["碳钢（如 1020）", "约 7.85–7.87", "约 786 g"],
        ["6061 铝合金", "2.70", "270 g"],
        ["PLA（打印耗材）", "1.24", "124 g"],
        ["水（SOLIDWORKS 常见默认值）", "1.00", "100 g"],
      ],
      [
        ["Carbon steel (e.g. 1020)", "About 7.85–7.87", "About 786 g"],
        ["6061 aluminum alloy", "2.70", "270 g"],
        ["PLA (printing filament)", "1.24", "124 g"],
        ["Water (a common SOLIDWORKS default)", "1.00", "100 g"],
      ],
    ),
    note: t(
      "1 g/cm³ = 0.001 g/mm³ = 1000 kg/m³。CSWA 样题里钢的密度写作 0.0079 g/mm³，就是 7.9 g/cm³。",
      "1 g/cm³ = 0.001 g/mm³ = 1000 kg/m³. The CSWA sample exam gives the steel's density as 0.0079 g/mm³, which is 7.9 g/cm³.",
    ),
  },
  terms: {},
  quiz: [
    {
      q: t(
        "一块 100 × 50 × 20 mm 的 6061 铝（2.70 g/cm³），软件报质量 100 g。最可能哪里错了？",
        "A 100 × 50 × 20 mm block of 6061 aluminum (2.70 g/cm³) shows a mass of 100 g. What is most likely wrong?",
      ),
      options: byLocale(
        ["单位设成了英寸", "零件没有指定材料，软件用了水的密度", "小数位数设得太少"],
        ["The units are set to inches", "The part has no material assigned, so the software used the density of water", "Too few decimal places are set"],
      ),
      answer: 1,
      explain: t(
        "体积是 100 cm³，铝应该是 270 g。100 g 正好是密度 1 g/cm³ 的结果，SOLIDWORKS 没指定材料时常常就是这个值。单位错了会差 25.4 的三次方倍，远不止这点。",
        "The volume is 100 cm³, so aluminum should give 270 g. 100 g is exactly what a density of 1 g/cm³ gives, which is often the value SOLIDWORKS uses when no material is assigned. Wrong units would put it off by a factor of 25.4 cubed, far more than this.",
      ),
    },
    {
      q: t("把显示的小数位数从 2 改成 4，模型会怎样？", "You change the displayed decimal places from 2 to 4. What happens to the model?"),
      options: byLocale(
        ["几何不变，只是数字显示得更细", "所有尺寸被重新取整", "质量会变"],
        ["The geometry stays the same; the numbers just show more digits", "Every dimension gets rounded again", "The mass changes"],
      ),
      answer: 0,
      explain: t(
        "小数位数只控制显示和报告时的舍入，内部按完整精度计算。考试规定小数位数，是为了让答案好比对。",
        "Decimal places only control rounding for display and reports; internally the software computes at full precision. Exams specify the decimal places so that answers are easy to compare.",
      ),
    },
    {
      q: t(
        "Onshape 账户首选项从没改过，在新文档里不写单位输入「20」画线。线有多长？",
        "You've never changed your Onshape account preferences. In a new document you draw a line and type “20” with no unit. How long is the line?",
      ),
      options: byLocale(["20 mm", "20 in，也就是 508 mm", "20 cm"], ["20 mm", "20 in, which is 508 mm", "20 cm"]),
      answer: 1,
      explain: t(
        "Onshape 出厂的默认单位是英寸，不写单位的数字按工作区单位理解。改「帐户 > 首选项」的默认单位，或者直接输入 20 mm。",
        "Onshape's factory default unit is inches, and a number with no unit is read in the workspace units. Change the default units in your account preferences, or just type 20 mm.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "质量 = 体积 × 密度：单位决定体积，材料决定密度，设错了都不会报错",
      "建模前先设单位：SOLIDWORKS 看模板，Onshape 出厂默认英寸；1 in = 25.4 mm",
      "看质量前先确认材料：没设材料时，SOLIDWORKS 常用水的密度，Fusion 套默认材料，Onshape 记为零",
    ],
    [
      "Mass = volume × density: the units decide the volume and the material decides the density. Getting either wrong raises no error",
      "Set the units before you model: in SOLIDWORKS they come from the template, and Onshape defaults to inches out of the box; 1 in = 25.4 mm",
      "Check the material before you trust the mass: with none set, SOLIDWORKS often uses the density of water, Fusion applies a default material, and Onshape counts the part as zero",
    ],
  ),
  sources: [
    { title: "CSWA Sample Exam", publisher: "SOLIDWORKS", url: "https://www.solidworks.com/sites/default/files/2018-07/CSWASampleExam.pdf" },
    { title: "文档属性 - 单位", publisher: t("SOLIDWORKS 2023 帮助", "SOLIDWORKS 2023 Help"), url: "https://help.solidworks.com/2023/chinese-simplified/SolidWorks/sldworks/HIDD_OPTIONS_UNITS_NEW.htm" },
    {
      title: t("Material Favourites for Easy Access in SOLIDWORKS（默认密度）", "Material Favourites for Easy Access in SOLIDWORKS (default density)"),
      publisher: "Javelin",
      url: "https://www.javelin-tech.com/blog/2020/07/material-favourites-for-easy-access-in-solidworks/",
    },
    { title: "物理材料和外观", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-55EC2C42-60E1-48C7-B802-D2AA7AB6F0CB.htm" },
    {
      title: "在 Fusion 中更改文档单位",
      publisher: t("Autodesk 知识库", "Autodesk Knowledge Base"),
      url: "https://www.autodesk.com.cn/support/technical/article/caas/sfdcarticles/sfdcarticles/CHS/Uploaded-files-from-other-CAD-systems-use-metric-units-in-Fusion-360.html",
    },
    { title: "设置每个工作区的默认单位", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Document/setting_default_units_per_workspace.htm" },
    { title: "自定义零件材料", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/customizing_part_materials.htm" },
    { title: t("SI Units – Length（1 in = 25.4 mm）", "SI Units – Length (1 in = 25.4 mm)"), publisher: "NIST", url: "https://www.nist.gov/pml/owm/si-units-length" },
    { title: t("Aluminum 6061-T6 材料数据", "Aluminum 6061-T6 material data"), publisher: "MatWeb", url: "https://www.matweb.com/search/datasheet.aspx?matguid=1b8c06d0ca7c456694c7777d9e10be5b" },
    { title: t("AISI 1020 Steel 材料数据", "AISI 1020 Steel material data"), publisher: "MatWeb", url: "https://www.matweb.com/search/DataSheet.aspx?MatGUID=a2eed65d6e5e4b66b7315a1b30f4b391" },
    {
      title: t("Ingeo 4043D 技术数据表（PLA 密度）", "Ingeo 4043D technical data sheet (PLA density)"),
      publisher: "NatureWorks",
      url: "https://www.natureworksllc.com/~/media/Files/NatureWorks/Technical-Documents/Technical-Data-Sheets/TechnicalDataSheet_4043D_3D-monofilament_pdf.pdf",
    },
  ],
  related: { cards: ["0.3.2", "1.5.3"] },
}

export default card
