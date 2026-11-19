import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.4.3 多零件同场设计. */

const card: CardDef = {
  code: "1.4.3",
  title: t("多零件同场设计：一起画，分开出", "Designing several parts in one context"),
  minutes: 4,
  sections: [
    {
      heading: t("为什么要放在一起画", "Why draw them together"),
      body: byLocale(
        <p>
          盒子和盖子、外壳的上下两半，尺寸互相依赖：盖子的止口要刚好卡进盒子的内壁。分成两个文件，同一组尺寸要在两边各维护一份。放在同一个建模空间里画，盖子的草图可以直接引用盒子的边，改盒子的壁厚，盖子跟着变。
        </p>,
        <p>
          A box and its lid, or the two halves of an enclosure, depend on each other's dimensions: the lid's lip has to fit just inside the box's inner wall. Split them into two files and you keep the same set of dimensions in both. Draw them in
          the same modeling space and the lid's sketch can reference the box's edges directly: change the box's wall thickness and the lid follows.
        </p>,
      ),
    },
    {
      heading: t("各软件怎么做", "How each package does it"),
      body: byLocale(
        <ul>
          <li>Onshape：一个 Part Studio 里可以有多个零件，共用一条特征列表，之后插入装配体定位。帮助里的原则是：只有需要共享参考的零件，才放进同一个 Part Studio。</li>
          <li>Fusion：几何是「实体」，零件是「零部件」。官方建议先建零部件，再在各自的零部件里建实体。同一个零部件里的几个实体之间不能加联接，也不会分别出现在 BOM 表里。</li>
          <li>SOLIDWORKS：一个零件文件里可以有多个实体（多实体零件），拉伸时取消勾选「合并结果」就得到新实体。定型后再把实体分别存成零件，组成装配体。</li>
        </ul>,
        <ul>
          <li>
            Onshape: one Part Studio can hold several parts that share one Feature list; you then insert them into an Assembly to position them. The help's rule: only parts that need to share references go in the same Part Studio.
          </li>
          <li>
            Fusion: geometry is “bodies”, parts are “components”. Autodesk recommends creating the components first and then building the bodies inside each one. Bodies in the same component can't have joints between them, and they don't
            show up separately in the BOM.
          </li>
          <li>
            SOLIDWORKS: one part file can hold several bodies (a multibody part); clear “Merge result” when you extrude and you get a new body. Once the design settles, save the bodies out as separate parts and put them together in an
            assembly.
          </li>
        </ul>,
      ),
    },
    {
      heading: t("什么时候分开", "When to split them apart"),
      body: byLocale(
        <>
          <p>多实体不是装配：实体之间不能有配合和运动，外购件、标准件也不该画在这里。一个简单的判断：</p>
          <ul>
            <li>形状互相依赖、总是一起改的零件，放在一起画。</li>
            <li>需要运动、要复用到别的产品、要单独出图和编号的，做成独立零件，在装配里定位。</li>
            <li>同一个零件要用好几个（比如 4 个支脚），在装配里阵列。Onshape 的建议是：在 Part Studio 里复制出来的副本，不会在 BOM 里汇总成同一行。</li>
          </ul>
        </>,
        <>
          <p>Multiple bodies are not an assembly: bodies can't have mates or motion between them, and purchased and standard parts don't belong here either. A simple rule of thumb:</p>
          <ul>
            <li>Parts whose shapes depend on each other and always change together: draw them together.</li>
            <li>Parts that move, get reused in other products, or need their own drawing and part number: make them separate parts and position them in an assembly.</li>
            <li>Several of the same part (four feet, say): pattern it in the assembly. Onshape's advice: copies made inside a Part Studio are not rolled up into one line in the BOM.</li>
          </ul>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg w={320} h={176} label={t("盒子和盖子在同一个建模空间里设计：盖子止口的位置引用盒子的内壁", "Box and lid designed in the same modeling space: the lid's lip is located from the box's inner wall")}>
        <path d="M 70 30 H 250 V 40 H 239 V 52 H 231 V 40 H 89 V 52 H 81 V 40 H 70 Z" className="fill-info-subtle text-primary" strokeWidth={1.5} />
        <path d="M 70 70 V 150 H 250 V 70 H 240 V 140 H 80 V 70 Z" className="fill-muted" strokeWidth={1.5} />
        <g className="text-primary" strokeDasharray="3 3" strokeWidth={0.9}>
          <path d="M 80 24 V 70 M 240 24 V 70" />
        </g>
        <T x={160} y={18} anchor="middle" tone="primary">
          {t("止口贴着盒子的内壁画", "Lip drawn to the box's inner wall")}
        </T>
        <T x={258} y={40} tone="primary">
          {t("盖子", "Lid")}
        </T>
        <T x={258} y={112} tone="muted">
          {t("盒子", "Box")}
        </T>
        <T x={160} y={170} anchor="middle" tone="muted">
          {t("内壁一变，止口跟着变", "Move the wall, the lip follows")}
        </T>
      </Svg>
    ),
    caption: t(
      "在同一个 Part Studio（或多实体零件）里，盖子的草图直接引用盒子的内壁。改盒子的壁厚，止口自动跟上。",
      "In the same Part Studio (or multibody part), the lid's sketch references the box's inner wall directly. Change the box's wall thickness and the lip keeps up on its own.",
    ),
    after: 0,
  },
  terms: { ops: ["boolean"], concepts: ["external-reference", "parent-child", "mate"] },
  quiz: [
    {
      q: t(
        "盒子和盖子在同一个 Part Studio（或同一个多实体零件）里设计，最大的好处是？",
        "What is the biggest benefit of designing a box and its lid in the same Part Studio (or the same multibody part)?",
      ),
      options: byLocale(
        ["文件少一个", "盖子可以直接引用盒子的几何，改一处两个零件一起变", "渲染更快"],
        ["One file fewer", "The lid can reference the box's geometry directly, so one change updates both parts", "Faster rendering"],
      ),
      answer: 1,
      explain: t(
        "同场设计的价值是共享参考：配合尺寸只定义一次，两个零件自动对上。文件数量只是附带的。",
        "The value of designing them together is shared references: the mating dimensions are defined once and the two parts line up automatically. Having fewer files is just a side effect.",
      ),
    },
    {
      q: t("Fusion 里，同一个零部件下有两个实体。想让它们之间能转动，应该怎么做？", "In Fusion, two bodies sit in the same component. You want one to rotate relative to the other. What should you do?"),
      options: byLocale(
        ["直接给两个实体加旋转联接", "把它们分别做成零部件，再加联接", "把两个实体合并成一个"],
        ["Add a revolute joint between the two bodies directly", "Make each of them a component, then add a joint", "Combine the two bodies into one"],
      ),
      answer: 1,
      explain: t(
        "联接加在零部件之间。实体只是几何，同一个零部件里的实体之间不能有联接，也不会分别进 BOM 表。可以用「从实体创建零部件」转换，但官方更推荐一开始就先建零部件。",
        "Joints go between components. Bodies are just geometry: bodies in the same component can't have joints between them, and they don't go into the BOM separately. You can convert them with “Create Components from Bodies”, but Autodesk recommends creating the components first from the start.",
      ),
    },
    {
      q: t("一个产品要 4 个一样的支脚。在哪里复制最合适？", "A product needs four identical feet. Where is the best place to make the copies?"),
      options: byLocale(
        ["在零件里阵列出 4 个实体", "做一个支脚零件，在装配里阵列 4 个", "画 4 个不同的零件"],
        ["Pattern four bodies in the part", "Make one foot part and pattern four of it in the assembly", "Draw four different parts"],
      ),
      answer: 1,
      explain: t(
        "装配里的 4 个实例引用同一个零件，BOM 数量就是 4，改支脚只改一处。在零件里复制出来的是 4 个独立的几何，BOM 数量对不上。",
        "Four instances in the assembly reference the same part, so the BOM quantity is 4 and you change the foot in one place. Copies made in the part are four separate pieces of geometry, and the BOM quantity won't come out right.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "形状互相依赖、总是一起改的零件，放在一起画，直接引用彼此的几何",
      "多实体不是装配：要运动、要复用、要单独编号的，做成独立零件",
      "同一个零件要用多个，在装配里阵列，BOM 数量才对",
    ],
    [
      "Parts whose shapes depend on each other and always change together: draw them together and reference each other's geometry directly",
      "Multiple bodies are not an assembly: anything that moves, gets reused or needs its own part number becomes a separate part",
      "Need several of the same part? Pattern it in the assembly, so the BOM quantity comes out right",
    ],
  ),
  sources: [
    { title: "Part Studio", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/part_studios.htm" },
    { title: "Multi-Part Part Studios vs. Assemblies", publisher: "Onshape Tech Tip", url: "https://www.onshape.com/en/resource-center/tech-tips/multi-part-studio-vs-assembly" },
    { title: "实体", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/GUID-C1AB4941-D7AD-4D27-A035-2FA9208635B6.htm" },
    { title: "从实体创建零部件", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/GUID-5966BF6B-4135-49B3-B5BF-29A6577C9E72.htm" },
  ],
  related: { lessons: ["assembly-dof"], teardowns: ["enclosure", "hinge_box"], cards: ["1.4.2", "2.3.1"] },
}

export default card
