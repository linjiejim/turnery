import { Arrow, Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.1.4 构造几何、投影/转换实体、偏移、修剪、镜像. */

const card: CardDef = {
  code: "1.1.4",
  title: t("复用几何：构造线、投影、偏移、修剪、镜像", "Construction geometry, project/convert entities, offset, trim and mirror"),
  minutes: 5,
  sections: [
    {
      heading: t("构造几何：只当参照的线", "Construction geometry: lines that are only references"),
      body: byLocale(
        <>
          <p>构造几何参与约束，但不会变成特征的轮廓。中心线、对称轴、布局用的框都画成构造几何：先用几条构造线搭好骨架，实际轮廓再挂到骨架上。</p>
          <p>SOLIDWORKS 在线的属性里勾选「作为构造线」，中心线天生就是构造线；Fusion 和 Onshape 都叫「构造」，选中线再点一下就切换。</p>
        </>,
        <>
          <p>
            Construction geometry takes part in constraints but never becomes a feature's profile. Centerlines, axes of symmetry and layout boxes are all drawn as construction geometry: build a skeleton from a few construction lines
            first, then hang the real profile on it.
          </p>
          <p>In SOLIDWORKS, check “For construction” in the line's properties; a centerline is construction geometry from the start. Fusion and Onshape both call it “Construction”: select a line and click it to toggle.</p>
        </>,
      ),
    },
    {
      heading: t("投影：直接借用已有的边", "Project: borrow edges that already exist"),
      body: byLocale(
        <>
          <p>要和模型上已有的边对齐，不必重画一遍再加约束。SOLIDWORKS 的「转换实体引用」、Fusion 的「投影」、Onshape 的「使用」，都把已有的边投进当前草图，并且保持关联：原来的边变了，投进来的线跟着变。这条线不用任何尺寸就已经完全定义。</p>
          <p>代价是多了一层父子关系。被投影的特征删掉或改得面目全非，草图就会报错。Fusion 的投影可以取消「投影链接」，只要形状、不要关联。</p>
        </>,
        <>
          <p>
            To line up with an edge already on the model, you don't need to redraw it and add constraints. SOLIDWORKS's “Convert Entities”, Fusion's “Project” and Onshape's “Use” all bring existing edges into the current sketch and
            keep them linked: when the original edge changes, the projected line follows. That line is fully defined without a single dimension.
          </p>
          <p>
            The price is one more parent–child relationship. Delete the projected feature, or change it beyond recognition, and the sketch fails. In Fusion you can turn off “Projection Link” on a projection to keep the shape
            without the link.
          </p>
        </>,
      ),
    },
    {
      heading: t("偏移和镜像：少标尺寸", "Offset and mirror: fewer dimensions"),
      body: byLocale(
        <>
          <p>「偏移」（SOLIDWORKS 叫「等距实体」）把一串线整体平移一段距离，整圈只需要一个偏移尺寸；原轮廓改了，偏移线跟着改。壁厚、密封槽、加强边都常用它。</p>
          <p>「镜像」（SOLIDWORKS 写作「镜向实体」）关于一条线复制，同时加上对称约束：只标一半的尺寸，改一边，另一边跟着变。</p>
          <p>FreeCAD 例外：偏移和镜像默认不关联，要勾选「添加偏移约束」「创建对称约束」才会跟着原线变。</p>
        </>,
        <>
          <p>
            “Offset” (SOLIDWORKS calls it “Offset Entities”) shifts a chain of lines by a set distance as a whole, so a full loop needs only one offset dimension. When the original profile changes, the offset follows. It's the usual
            tool for wall thickness, seal grooves and stiffening rims.
          </p>
          <p>“Mirror” (in SOLIDWORKS, “Mirror Entities”) copies across a line and adds symmetric constraints at the same time: dimension only one half, change one side, and the other side follows.</p>
          <p>FreeCAD is the exception: its offset and mirror aren't linked by default. Turn on the options that add an offset constraint and symmetry constraints, and the new lines will follow the originals.</p>
        </>,
      ),
    },
    {
      heading: t("修剪：清掉多余的段", "Trim: clear away the extra segments"),
      body: byLocale(
        <p>
          先用完整的线快速画出大致形状，再用「修剪」（SOLIDWORKS 叫「剪裁实体」）删掉交点之间多余的段。按住鼠标划过，可以一次剪掉好几段。剪完检查轮廓是否闭合、交点是否还重合，再看草图是不是仍然完全定义。
        </p>,
        <p>
          Sketch the rough shape quickly with full-length lines first, then use “Trim” (SOLIDWORKS calls it “Trim Entities”) to delete the extra segments between intersections. Hold the mouse button and drag across them to trim
          several segments at once. Afterwards, check that the profile is closed and the intersections still coincide, then see whether the sketch is still fully defined.
        </p>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={186}
        label={t(
          "构造线作为对称轴，左半边是画出来的，右半边由镜像得到，内圈由偏移得到",
          "A construction line as the axis of symmetry: the left half is drawn, the right half comes from a mirror, and the inner loop from an offset",
        )}
      >
        <line x1={160} y1={16} x2={160} y2={166} strokeDasharray="6 4" className="text-faint-foreground" />
        <path d="M 160 40 H 95 L 65 70 V 160 H 160" strokeWidth={1.75} />
        <path d="M 160 40 H 225 L 255 70 V 160 H 160" strokeWidth={1.75} className="text-primary" />
        <path d="M 100 52 H 220 L 243 75 V 148 H 77 V 75 Z" className="text-primary" strokeDasharray="5 3" />
        <Arrow x1={65} y1={112} x2={77} y2={112} both className="text-muted-foreground" />
        <T x={58} y={116} anchor="end" tone="muted">
          {t("偏移", "Offset")}
        </T>
        <T x={166} y={178} tone="faint">
          {t("构造线（对称轴）", "Construction line (axis)")}
        </T>
        <T x={104} y={32} anchor="middle">
          {t("画的半边", "Drawn half")}
        </T>
        <T x={214} y={32} anchor="middle" tone="primary">
          {t("镜像得到", "Mirrored")}
        </T>
        <T x={172} y={112} tone="primary">
          {t("偏移得到", "Offset loop")}
        </T>
      </Svg>
    ),
    caption: t(
      "只画左半边、标左半边的尺寸。右半边由镜像得到，内圈由偏移得到，它们都和原线保持关联。构造线不参与生成实体。",
      "Draw only the left half and dimension only the left half. The right half comes from a mirror and the inner loop from an offset, and both stay linked to the original lines. The construction line takes no part in making the solid.",
    ),
    after: 0,
  },
  table: {
    caption: t("这几个工具在各软件里的叫法", "What each package calls these tools"),
    head: byLocale(["工具", "SOLIDWORKS", "Fusion", "Onshape", "FreeCAD 1.1"], ["Tool", "SOLIDWORKS", "Fusion", "Onshape", "FreeCAD 1.1"]),
    rows: byLocale(
      [
        ["构造几何", "作为构造线 / 中心线", "构造", "构造", "切换构造几何"],
        ["投影已有边", "转换实体引用", "投影", "使用", "外部投影"],
        ["偏移", "等距实体", "偏移", "偏移", "偏移"],
        ["修剪", "剪裁实体", "修剪", "修剪", "修剪边"],
        ["镜像", "镜向实体", "镜像", "镜像", "镜像（1.0 叫「对称」）"],
      ],
      [
        ["Construction geometry", "For construction / Centerline", "Construction", "Construction", "Toggle construction geometry"],
        ["Project existing edges", "Convert Entities", "Project", "Use", "External projection"],
        ["Offset", "Offset Entities", "Offset", "Offset", "Offset"],
        ["Trim", "Trim Entities", "Trim", "Trim", "Trim edge"],
        ["Mirror", "Mirror Entities", "Mirror", "Mirror", "Mirror (“Symmetry” in 1.0)"],
      ],
    ),
    after: 3,
  },
  terms: { ops: ["sketch", "mirror"], concepts: ["construction-geometry", "constraint", "fully-defined", "parent-child"] },
  quiz: [
    {
      q: t("草图里画了一条构造线当对称轴。拉伸这个草图时，它会怎样？", "You drew a construction line in a sketch as the axis of symmetry. What happens to it when you extrude the sketch?"),
      options: byLocale(
        ["和其他线一起围成轮廓", "不参与轮廓，只作为约束和镜像的参照", "被拉伸成一个薄片"],
        ["It forms the profile together with the other lines", "It stays out of the profile and serves only as a reference for constraints and mirroring", "It gets extruded into a thin sheet"],
      ),
      answer: 1,
      explain: t(
        "构造几何在生成特征时被忽略。它的用处是给别的线提供对齐、对称的参照。",
        "Construction geometry is ignored when the feature is built. Its job is to give other lines a reference to align with and mirror across.",
      ),
    },
    {
      q: t(
        "把上一个特征的边投进草图（转换实体引用 / 投影 / 使用），之后删掉了那个特征。会怎样？",
        "You brought an edge of the previous feature into a sketch (Convert Entities / Project / Use), then deleted that feature. What happens?",
      ),
      options: byLocale(
        ["投进来的线自动变成普通线，没有影响", "投进来的线失去来源，草图报错，要重新选参考", "被删的特征会自动恢复"],
        [
          "The projected lines turn into ordinary lines on their own, with no effect",
          "The projected lines lose their source: the sketch fails, and you have to pick a new reference",
          "The deleted feature comes back on its own",
        ],
      ),
      answer: 1,
      explain: t(
        "投影保持关联，也就建立了父子关系。父特征没了，投影线找不到来源，就会出现悬空或丢失参考的错误。Fusion 会在时间轴上给出警告，并提供重新链接或断开链接。",
        "A projection stays linked, which creates a parent–child relationship. With the parent gone, the projected lines can't find their source, and you get dangling or missing-reference errors. Fusion shows a warning on the timeline and offers to relink or break the link.",
      ),
    },
    {
      q: t(
        "外轮廓宽度要从 80 改到 100。哪种画法只改一个尺寸，左右两边和内圈都跟着变？",
        "The outer profile's width has to change from 80 to 100. Which way of drawing it lets you change one dimension and have both halves and the inner loop follow?",
      ),
      options: byLocale(
        ["左右两半各画各的，分别标尺寸", "画一半再镜像，内圈用偏移", "整圈画好后，内圈逐条画平行线"],
        ["Draw the left and right halves separately and dimension each one", "Draw one half and mirror it, and make the inner loop with an offset", "Draw the full outline, then draw the inner loop one parallel line at a time"],
      ),
      answer: 1,
      explain: t(
        "镜像带着对称约束，偏移带着一个偏移尺寸，它们都和原轮廓关联。逐条画的线之间没有关系，只能一条条改。",
        "A mirror carries symmetric constraints and an offset carries one offset dimension, and both are linked to the original profile. Lines drawn one at a time have no relationship to each other, so you can only change them one at a time.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "构造几何只当参照，不进轮廓：先画骨架，再把轮廓挂上去",
      "投影、偏移、镜像得到的线和原线保持关联，用很少的尺寸就能完全定义",
      "关联也是依赖：被投影的特征删掉或大改，草图会报错",
    ],
    [
      "Construction geometry is only a reference and stays out of the profile: draw the skeleton first, then hang the profile on it",
      "Lines made by projecting, offsetting and mirroring stay linked to the originals, so very few dimensions fully define them",
      "A link is also a dependency: delete or heavily change the projected feature, and the sketch fails",
    ],
  ),
  sources: [
    { title: "构造几何线", publisher: t("SOLIDWORKS 2021 帮助", "SOLIDWORKS 2021 Help"), url: "https://help.solidworks.com/2021/chinese-simplified/SolidWorks/sldworks/c_Construction_Geometry.htm" },
    { title: "使用转换实体引用", publisher: t("SOLIDWORKS 2020 帮助", "SOLIDWORKS 2020 Help"), url: "https://help.solidworks.com/2020/chinese-simplified/SolidWorks/sldworks/t_Using_Convert_Entities.htm" },
    { title: "镜向实体", publisher: t("SOLIDWORKS 2022 帮助", "SOLIDWORKS 2022 Help"), url: "https://help.solidworks.com/2022/chinese-simplified/SolidWorks/sldworks/c_Mirror_Entities.htm" },
    { title: "投影", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/GUID-850061C4-71F5-4418-AF9C-F0D232022F9C.htm" },
    { title: "偏移", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-OFFSET.htm" },
    { title: "草图中的镜像和阵列", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-SKETCH-CREATE-MIRRORS-PATTERNS.htm" },
    { title: "使用", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Sketch/use.htm" },
    { title: "构造", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Sketch/construction.htm" },
    { title: "Sketcher Offset / Sketcher Symmetry", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Sketcher_Offset" },
  ],
  related: { lessons: ["constraints-dof", "sketch-to-solid"], cards: ["1.1.6"] },
}

export default card
