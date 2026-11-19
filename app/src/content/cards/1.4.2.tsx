import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.4.2 编辑导入几何. */

const card: CardDef = {
  code: "1.4.2",
  title: t("改一个没有特征树的 STEP 零件", "Editing imported geometry"),
  minutes: 4,
  sections: [
    {
      heading: t("导入后得到什么", "What you get after importing"),
      body: byLocale(
        <>
          <p>从 STEP、IGES 导入的零件只有面和边，没有草图、尺寸和特征树。想把孔距从 40 改到 50，没有尺寸可以双击。</p>
          <p>各软件的处理：SOLIDWORKS 里它是特征树上的一个输入特征；Fusion 在参数化模式下把导入的几何放进一个「基础特征」；FreeCAD 可以把它设为实体的「基础特征」，然后在上面接着建。</p>
        </>,
        <>
          <p>A part imported from STEP or IGES has only faces and edges: no sketches, no dimensions, no feature tree. To change a hole spacing from 40 to 50, there is no dimension to double-click.</p>
          <p>
            How each package handles it: in SOLIDWORKS it is a single imported feature in the feature tree; Fusion, in parametric mode, puts the imported geometry into a “Base Feature”; FreeCAD can make it the “Base Feature” of a Body, and you
            keep building on top of it.
          </p>
        </>,
      ),
    },
    {
      heading: t("第一步：检查并修复", "Step one: check and repair"),
      body: byLocale(
        <p>
          中性格式转换时可能丢面、留缝，导进来是一堆曲面而不是一个实体。很多实体操作要求输入是封闭的实体，所以先修。SOLIDWORKS 的「输入诊断」（工具 &gt; 评估 &gt; 输入诊断）能找出坏面和缝隙，尝试修复，再缝合成实体。修干净了，后面的编辑才可靠。
        </p>,
        <p>
          Translation through a neutral format can drop faces or leave gaps, so what comes in is a pile of surfaces instead of a solid. Many solid operations need a closed solid as input, so repair it first. SOLIDWORKS “Import Diagnostics” (Tools
          &gt; Evaluate &gt; Import Diagnostics) finds faulty faces and gaps, tries to repair them, and then knits the result into a solid. Only once it is clean can you rely on the edits that follow.
        </p>,
      ),
    },
    {
      heading: t("改法一：直接编辑面", "Option one: edit the faces directly"),
      body: byLocale(
        <>
          <p>不需要特征树，直接动面：</p>
          <ul>
            <li>移动面：把孔或凸台的面平移、偏移，改位置和大小。</li>
            <li>删除面：去掉一个圆角、小孔或刻字，相邻的面延伸过来补上。</li>
            <li>替换面：用另一个面替换选中的面，比如把一个斜面换成对齐另一个零件的平面。</li>
            <li>改圆角：Onshape 的「修改圆角」能直接改半径或去掉圆角。</li>
          </ul>
          <p>在 Onshape 里，这些操作本身也是特征，记在特征列表里，以后还能改。</p>
        </>,
        <>
          <p>You don't need a feature tree; you move the faces themselves:</p>
          <ul>
            <li>Move face: translate or offset the faces of a hole or boss to change its position and size.</li>
            <li>Delete face: remove a fillet, a small hole or engraved text, and the neighboring faces extend to close the gap.</li>
            <li>Replace face: replace the selected face with another one, for example swap a sloped face for a flat face lined up with another part.</li>
            <li>Change a fillet: Onshape's “Modify fillet” changes the radius or removes the fillet directly.</li>
          </ul>
          <p>In Onshape these operations are features themselves: they are recorded in the Feature list, and you can still edit them later.</p>
        </>,
      ),
    },
    {
      heading: t("改法二：接着建，或者重建", "Option two: build on it, or rebuild it"),
      body: byLocale(
        <>
          <p>新加的结构（加一个凸台、开一个槽）用普通特征叠在导入的实体上，它们有完整的参数。SOLIDWORKS 的 FeatureWorks（「识别特征」）还能把导入实体里规则的拉伸、孔、圆角识别回特征，适合机加件；复杂的曲面件识别不了。</p>
          <p>怎么选：少量、一次性的修改，直接编辑；要长期维护、反复改尺寸的零件，照着它重建一个原生模型，把设计意图放回参数里。</p>
        </>,
        <>
          <p>
            Add new geometry (a boss, a slot) with ordinary features on top of the imported solid; those features have all their parameters. SOLIDWORKS FeatureWorks (“Recognize Features”) can also turn the regular extrusions, holes and fillets
            in an imported solid back into features, which suits machined parts; it can't recognize complex surfaced parts.
          </p>
          <p>
            How to choose: for a few one-off changes, edit directly. For a part you will maintain for a long time and resize again and again, rebuild it as a native model, using the import as your reference, and put the design intent back
            into parameters.
          </p>
        </>,
      ),
    },
  ],
  table: {
    caption: t("各软件里的直接编辑工具", "Direct editing tools in each package"),
    head: byLocale(["要做的事", "SOLIDWORKS", "Fusion", "Onshape"], ["Task", "SOLIDWORKS", "Fusion", "Onshape"]),
    rows: byLocale(
      [
        ["修复导入几何", "输入诊断", "缝合（把曲面缝成实体）", "封闭（把曲面封成实体）"],
        ["移动面", "移动面", "推拉；移动/复制（选面）", "移动面"],
        ["删除面", "删除面", "删除", "删除面"],
        ["替换面", "替换面", "替换面", "替换面"],
        ["识别特征", "FeatureWorks「识别特征」", "—", "—"],
        ["改圆角", "—", "—", "修改圆角"],
      ],
      [
        ["Repair imported geometry", "Import Diagnostics", "Stitch (stitches surfaces into a solid)", "Enclose (closes surfaces into a solid)"],
        ["Move a face", "Move Face", "Press Pull; Move/Copy (with faces selected)", "Move face"],
        ["Delete a face", "Delete Face", "Delete", "Delete face"],
        ["Replace a face", "Replace Face", "Replace Face", "Replace face"],
        ["Recognize features", "FeatureWorks “Recognize Features”", "—", "—"],
        ["Change a fillet", "—", "—", "Modify fillet"],
      ],
    ),
    after: 2,
    note: t("「—」表示这个软件里没有同名的专用命令，可以用其他方式完成。", "“—” means the package has no dedicated command by that name; you can get the same result another way."),
  },
  terms: { ops: ["fillet", "hole"], concepts: ["dumb-solid", "feature-tree"] },
  quiz: [
    {
      q: t("供应商发来一个 STEP 零件，你只需要把一个孔挪 5 mm。最省事的做法是？", "A supplier sends you a STEP part, and all you need is to move one hole 5 mm. What takes the least effort?"),
      options: byLocale(
        ["用移动面把孔的圆柱面平移 5 mm", "照着它重建整个零件", "用文本编辑器改 STEP 文件里的坐标"],
        ["Translate the hole's cylindrical face 5 mm with move face", "Rebuild the whole part from it", "Edit the coordinates in the STEP file with a text editor"],
      ),
      answer: 0,
      explain: t(
        "一次性的小改动，直接编辑面最快。重建适合以后还要反复改的零件；手改 STEP 文件既难又容易破坏拓扑。",
        "For a small one-off change, editing the face directly is fastest. Rebuilding suits a part you will keep changing; editing a STEP file by hand is hard and easily breaks the topology.",
      ),
    },
    {
      q: t("导入后得到的是一堆曲面，不是实体。先做什么？", "After import you get a pile of surfaces, not a solid. What do you do first?"),
      options: byLocale(
        ["用输入诊断这类工具修复缝隙，缝合成实体", "直接在曲面上打孔", "导出成 STL 再导回来"],
        ["Repair the gaps with a tool like Import Diagnostics and knit the surfaces into a solid", "Put holes straight into the surfaces", "Export it to STL and import it back"],
      ),
      answer: 0,
      explain: t(
        "很多实体操作要求封闭的实体，先修复、缝合，后面的编辑才可靠。转成 STL 会把精确曲面变成三角网格，问题更大。",
        "Many solid operations need a closed solid. Repair and knit it first, and the edits after that are reliable. Converting to STL turns the exact surfaces into a triangle mesh, which is a bigger problem.",
      ),
    },
    {
      q: t("这个导入的零件以后要按客户需求反复改尺寸。最好怎么办？", "This imported part will be resized again and again as customers ask. What is the best approach?"),
      options: byLocale(
        ["每次都用移动面改", "照着它重建一个原生参数化模型，以后改参数", "让客户每次重新发 STEP"],
        ["Use move face every time", "Rebuild it as a native parametric model and change parameters from then on", "Have the customer send a new STEP every time"],
      ),
      answer: 1,
      explain: t(
        "直接编辑适合少量修改；反复改的时候，没有尺寸和意图的模型每次都要重新判断改哪些面。花一次时间重建，以后改一个数就行。",
        "Direct editing suits a few changes. When the changes keep coming, a model with no dimensions and no intent makes you work out again each time which faces to move. Spend the time to rebuild it once, and from then on you change one number.",
      ),
    },
  ],
  takeaways: byLocale(
    ["导入的 STEP 只有面和边：先检查、修复成干净的实体", "少量修改直接编辑面：移动、删除、替换；新结构用普通特征叠上去", "要长期反复改的零件，重建成原生参数化模型"],
    [
      "An imported STEP has only faces and edges: check it and repair it into a clean solid first",
      "For a few changes, edit the faces directly (move, delete, replace); add new geometry with ordinary features on top",
      "A part you will keep changing for a long time: rebuild it as a native parametric model",
    ],
  ),
  sources: [
    { title: "输入诊断概述", publisher: t("SOLIDWORKS 2024 帮助", "SOLIDWORKS 2024 Help"), url: "https://help.solidworks.com/2024/Chinese-simplified/SolidWorks/sldworks/c_Import_Diagnostics_Overview.htm" },
    { title: "移动面 PropertyManager", publisher: t("SOLIDWORKS 2022 帮助", "SOLIDWORKS 2022 Help"), url: "https://help.solidworks.com/2022/chinese-simplified/SolidWorks/sldworks/hidd_dve_feat_move_face.htm" },
    {
      title: t("使用逐步识别来识别输入的实体特征（FeatureWorks）", "使用逐步识别来识别输入的实体特征 (FeatureWorks)"),
      publisher: t("SOLIDWORKS 2021 帮助", "SOLIDWORKS 2021 Help"),
      url: "https://help.solidworks.com/2021/chinese-simplified/solidworks/fworks/t_Recognizing_Features_Using_step_by_step.htm",
    },
    {
      title: t("建模模式和时间轴（基础特征）", "建模模式和时间轴 (Base Feature)"),
      publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"),
      url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Designs/files/ASM-DESIGN-MODELING-MODES.htm",
    },
    { title: "推拉", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-02F9ADA3-7556-42A9-8AD1-552728D537AB.htm" },
    { title: "替换面", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/GUID-CA081251-AA0B-46DC-BD14-D95886B4B0F8.htm" },
    { title: "删除面", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/delete_face.htm" },
    { title: "修改圆角", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/PartStudio/modify_fillet.htm" },
    { title: "Parametric Editing vs. Direct Editing", publisher: t("Onshape 博客", "Onshape blog"), url: "https://www.onshape.com/en/blog/parametric-editing-vs-direct-editing-cad-systems" },
    { title: t("PartDesign Body（基础特征）", "PartDesign Body (Base Feature)"), publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/PartDesign_Body" },
  ],
  related: { lessons: ["feature-tree"], cards: ["0.3.2", "1.4.3"] },
}

export default card
