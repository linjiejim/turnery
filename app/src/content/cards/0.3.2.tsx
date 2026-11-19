import type { ReactNode } from "react"
import { Arrow, Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 0.3.2 文件格式与交换. */

const box = (y: number, glyph: ReactNode, title: string, formats: string) => (
  <g>
    <rect x={8} y={y} width={304} height={50} rx={6} className="stroke-border" />
    <g className="text-primary">{glyph}</g>
    <T x={54} y={y + 21} className="font-medium">
      {title}
    </T>
    <T x={54} y={y + 39} tone="muted">
      {formats}
    </T>
  </g>
)
const octagon = Array.from({ length: 8 }, (_, i) => {
  const a = (i / 8) * Math.PI * 2 + Math.PI / 8
  return `${30 + 11 * Math.cos(a)},${193 + 11 * Math.sin(a)}`
}).join(" ")

const card: CardDef = {
  code: "0.3.2",
  title: t("文件格式：导出时带走了什么", "File formats and data exchange"),
  minutes: 4,
  sections: [
    {
      heading: t("一个模型有三层信息", "A model holds three layers of information"),
      body: byLocale(
        <>
          <p>最上面一层是特征树和参数：草图、尺寸、约束、特征的顺序。中间一层是精确几何，也叫 B-rep：每个面是什么曲面、边在哪里、谁和谁相连。最下面一层是三角网格，是把曲面切成小平面后的近似。</p>
          <p>文件格式决定你带走哪几层。原生格式三层都在，但通常只有同一个软件能打开：SOLIDWORKS 的 .sldprt、Fusion 的 .f3d、FreeCAD 的 .FCStd。Onshape 的模型存在云端，没有本地原生文件，只能导出成别的格式。</p>
        </>,
        <>
          <p>
            The top layer is the feature tree and parameters: sketches, dimensions, constraints and the order of the features. The middle layer is the exact geometry, also called the B-rep: what kind of surface each face is, where
            the edges are, and what connects to what. The bottom layer is the triangle mesh, an approximation that cuts the surfaces into small flat facets.
          </p>
          <p>
            The file format decides which layers you take with you. Native formats keep all three, but usually only the same software can open them: SOLIDWORKS's .sldprt, Fusion's .f3d, FreeCAD's .FCStd. Onshape keeps models in the
            cloud, with no native local file, so you can only export them to other formats.
          </p>
        </>,
      ),
    },
    {
      heading: t("STEP：跨软件交换的默认选择", "STEP: the default for exchange between packages"),
      body: byLocale(
        <>
          <p>
            STEP 是国际标准 ISO 10303，扩展名 .step 或 .stp。常见的版本叫「应用协议」：AP203、AP214，以及 2014 年把两者合并扩展的 AP242，后者还能带尺寸和公差标注（PMI）。
          </p>
          <p>STEP 带走的是精确的实体和装配结构，但常规导出不含特征树。对方打开后得到一块没有历史的实体：想把孔距从 40 改到 50，只能直接编辑面，或者重新建模。</p>
          <ul>
            <li>IGES 更老：1980 年发布第一版，1996 年的 5.3 是最后一版。它主要传曲线和曲面，实体到了对方那里常常变成一堆散面。能用 STEP 就不用 IGES。</li>
            <li>Parasolid（.x_t）是 SOLIDWORKS、Onshape、NX 共用的几何内核的格式，在这几个软件之间转换通常比 STEP 更干净。它同样不带特征树。</li>
          </ul>
        </>,
        <>
          <p>
            STEP is the international standard ISO 10303, with the extension .step or .stp. Its common versions are called “application protocols”: AP203, AP214, and AP242, which merged and extended those two in 2014 and can also
            carry dimension and tolerance annotations (PMI).
          </p>
          <p>
            STEP carries the exact solids and the assembly structure, but a normal export has no feature tree. Whoever opens it gets a solid with no history: to change a hole spacing from 40 to 50, they can only edit the faces
            directly or model it again.
          </p>
          <ul>
            <li>
              IGES is older: the first version came out in 1980, and 5.3, from 1996, was the last. It mainly carries curves and surfaces, and a solid often arrives at the other end as a heap of loose surfaces. Use STEP instead of
              IGES whenever you can.
            </li>
            <li>
              Parasolid (.x_t) is the format of the geometry kernel that SOLIDWORKS, Onshape and NX share, and converting between these packages with it is usually cleaner than with STEP. It doesn't carry the feature tree either.
            </li>
          </ul>
        </>,
      ),
    },
    {
      heading: t("STL 和 3MF：给打印机的网格", "STL and 3MF: meshes for the printer"),
      body: byLocale(
        <>
          <p>STL 里只有三角形的顶点坐标：圆柱变成多棱柱，曲面变成小平面。文件里没有单位，同一个「20」，按毫米读和按英寸读差 25.4 倍。标准 STL 也不存颜色。</p>
          <p>3MF 由 3MF 联盟在 2015 年推出，是一个装着 XML 的 ZIP 包。它写明单位（默认毫米），能存颜色、材料、多个物体和它们在打印平台上的位置。切片软件支持的话，用 3MF 代替 STL。</p>
          <p>网格回不去：从 STL 很难再得到能编辑的精确实体。所以网格只用于交付，不用来存档。</p>
        </>,
        <>
          <p>
            An STL holds only the vertex coordinates of triangles: a cylinder becomes a many-sided prism, and curved surfaces become small flat facets. The file has no units, so the same “20” read as millimeters or as inches differs
            by a factor of 25.4. Standard STL doesn't store color either.
          </p>
          <p>
            3MF was introduced by the 3MF Consortium in 2015. It is a ZIP package of XML files. It states its units (millimeters by default) and can store colors, materials, several objects and where they sit on the build plate. If
            your slicer supports it, use 3MF instead of STL.
          </p>
          <p>A mesh can't go back: it's hard to get an editable exact solid out of an STL again. So use meshes only for delivery, not for archiving.</p>
        </>,
      ),
    },
    {
      heading: t("怎么选", "Which to choose"),
      body: byLocale(
        <ul>
          <li>对方要继续改：先问他用什么软件。同一个软件给原生文件；不同软件给 STEP（AP242 或 AP214），再附一张写明关键尺寸的图纸。</li>
          <li>交给打印：优先 3MF，没有就用 STL，导出时确认单位和网格精度。</li>
          <li>自己存档：原生文件和 STEP 各留一份。软件版本升级或换软件时，STEP 是退路。</li>
        </ul>,
        <ul>
          <li>Someone else will keep editing it: first ask what software they use. Same software: send the native file. Different software: send STEP (AP242 or AP214), plus a drawing that gives the key dimensions.</li>
          <li>Sending it to print: 3MF first, STL if that's not an option. When you export, check the units and the mesh resolution.</li>
          <li>Archiving your own work: keep both the native file and a STEP. When the software is upgraded or you switch packages, the STEP is your fallback.</li>
        </ul>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={228}
        label={t(
          "模型的三层信息：特征树和参数、精确几何、三角网格，以及各种格式能带走哪几层",
          "The three layers of a model (feature tree and parameters, exact geometry, triangle mesh) and which layers each format carries",
        )}
      >
        {box(
          8,
          <path d="M 22 24 h 14 M 26 33 h 14 M 26 42 h 10 M 22 24 v 18 M 22 33 h 4 M 22 42 h 4" />,
          t("特征树和参数", "Feature tree and parameters"),
          t("原生格式 .sldprt .f3d .FCStd", "Native formats .sldprt .f3d .FCStd"),
        )}
        <Arrow x1={30} y1={62} x2={30} y2={84} className="text-faint-foreground" />
        <T x={44} y={78} tone="faint">
          {t("导出 STEP：丢掉草图、尺寸和特征顺序", "STEP drops sketches, dimensions, order")}
        </T>
        {box(88, <circle cx={30} cy={113} r={11} />, t("精确几何（B-rep）", "Exact geometry (B-rep)"), "STEP · IGES · Parasolid .x_t")}
        <Arrow x1={30} y1={142} x2={30} y2={164} className="text-faint-foreground" />
        <T x={44} y={158} tone="faint">
          {t("转成网格：曲面变成小三角形", "To mesh: surfaces become triangles")}
        </T>
        {box(168, <polygon points={octagon} />, t("三角网格", "Triangle mesh"), "STL · 3MF")}
      </Svg>
    ),
    caption: t("格式越往下，带走的信息越少。往下转很容易，往上回去很难。", "The lower the layer, the less a format carries. Converting down is easy; going back up is hard."),
  },
  table: {
    caption: t("常见格式带走了什么", "What common formats carry"),
    head: byLocale(["格式", "几何", "特征树和参数", "适合"], ["Format", "Geometry", "Feature tree and parameters", "Good for"]),
    rows: byLocale(
      [
        ["原生（.sldprt / .f3d / .FCStd）", "精确", "有", "自己继续改"],
        ["STEP（.step / .stp）", "精确", "没有", "跨软件交换、发给加工厂"],
        ["IGES（.igs / .iges）", "精确，多为曲面", "没有", "老系统、曲面数据"],
        ["Parasolid（.x_t）", "精确", "没有", "同内核的软件之间"],
        ["STL（.stl）", "三角网格，无单位", "没有", "3D 打印（老格式）"],
        ["3MF（.3mf）", "三角网格，带单位", "没有", "3D 打印"],
      ],
      [
        ["Native (.sldprt / .f3d / .FCStd)", "Exact", "Yes", "Editing it yourself"],
        ["STEP (.step / .stp)", "Exact", "No", "Exchange between packages, sending to a machine shop"],
        ["IGES (.igs / .iges)", "Exact, mostly surfaces", "No", "Legacy systems, surface data"],
        ["Parasolid (.x_t)", "Exact", "No", "Between packages on the same kernel"],
        ["STL (.stl)", "Triangle mesh, no units", "No", "3D printing (older format)"],
        ["3MF (.3mf)", "Triangle mesh, with units", "No", "3D printing"],
      ],
    ),
    after: 2,
    note: t(
      "Onshape 能导出表里所有的交换格式；Fusion 能导出 STEP、IGES、STL、3MF，但不能导出 Parasolid。以各自帮助里的格式列表为准。",
      "Onshape can export every exchange format in the table; Fusion can export STEP, IGES, STL and 3MF, but not Parasolid. Each package's help has the definitive list of formats.",
    ),
  },
  terms: { concepts: ["dumb-solid"] },
  quiz: [
    {
      q: t(
        "你用 SOLIDWORKS，同事用 Fusion。你导出 STEP 发给他，他想把孔距从 40 改到 50。会怎样？",
        "You use SOLIDWORKS and a colleague uses Fusion. You export a STEP and send it over, and they want to change a hole spacing from 40 to 50. What happens?",
      ),
      options: byLocale(
        ["打开后直接改特征树里的尺寸", "STEP 里没有特征树，他只能直接编辑面或重新建模", "STEP 在 Fusion 里打不开，必须改用 IGES"],
        ["They open it and change the dimension in the feature tree", "STEP has no feature tree, so they can only edit the faces directly or model it again", "Fusion can't open STEP, so you have to use IGES instead"],
      ),
      answer: 1,
      explain: t(
        "STEP 带的是精确几何和装配结构，草图、尺寸和特征顺序都不在里面。Fusion 能用直接编辑工具移动孔所在的面，但原来的设计意图要靠他自己重建。",
        "STEP carries the exact geometry and the assembly structure; the sketches, dimensions and feature order aren't in it. Fusion's direct editing tools can move the faces of the hole, but rebuilding the original design intent is up to them.",
      ),
    },
    {
      q: t("一个零件导出 STL 后，打印出来小了约 25 倍。最可能的原因是？", "A part exported as STL prints about 25 times too small. What is the most likely cause?"),
      options: byLocale(
        ["导出时网格精度设得太低", "STL 不记录单位：模型按英寸导出，切片软件按毫米读", "打印机的步进电机没校准"],
        ["The mesh resolution was set too low on export", "STL records no units: the model was exported in inches and the slicer read it as millimeters", "The printer's stepper motors aren't calibrated"],
      ),
      answer: 1,
      explain: t(
        "STL 里只有坐标数字。同一个数字按英寸和毫米理解，差 25.4 倍。网格精度只影响表面是否光顺，不影响大小。3MF 写明了单位，能避免这类问题。",
        "An STL holds only coordinate numbers. The same number read as inches and as millimeters differs by a factor of 25.4. Mesh resolution only affects how smooth the surfaces are, not the size. 3MF states its units, which avoids this problem.",
      ),
    },
    {
      q: t(
        "交给打印服务，还想保留颜色和多个零件的摆放位置，优先选哪种格式？",
        "You're sending a job to a print service and want to keep the colors and where several parts are placed. Which format should you choose first?",
      ),
      options: ["STL", "3MF", "IGES"],
      answer: 1,
      explain: t(
        "3MF 为增材制造设计，能存单位、颜色、材料和多个物体。STL 只有三角形；IGES 是交换精确曲面的老格式，不是给打印用的。",
        "3MF is designed for additive manufacturing and can store units, colors, materials and several objects. STL has only triangles; IGES is an old format for exchanging exact surfaces, not for printing.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "原生格式带特征树和参数；STEP、IGES、Parasolid 只带精确几何；STL、3MF 只剩三角网格",
      "跨软件交换用 STEP，对方要继续改时附上关键尺寸；同内核的软件之间可以用 Parasolid",
      "打印优先用 3MF：它写明单位，能带颜色和多个零件；STL 不记录单位",
    ],
    [
      "Native formats carry the feature tree and parameters; STEP, IGES and Parasolid carry only the exact geometry; STL and 3MF keep only a triangle mesh",
      "Exchange between packages with STEP, and add the key dimensions if the other side will keep editing; between packages on the same kernel you can use Parasolid",
      "For printing, prefer 3MF: it states its units and can carry colors and several parts. STL records no units",
    ],
  ),
  sources: [
    { title: "STEP-file, ISO 10303-21", publisher: "Library of Congress", url: "https://www.loc.gov/preservation/digital/formats/fdd/fdd000448.shtml" },
    { title: t("IGES 的起源与发展（NIST SP 958）", "The origins and development of IGES (NIST SP 958)"), publisher: "NIST", url: "https://nvlpubs.nist.gov/nistpubs/sp958-lide/html/246-249.html" },
    { title: "STL (STereoLithography) File Format Family", publisher: "Library of Congress", url: "https://www.loc.gov/preservation/digital/formats/fdd/fdd000504.shtml" },
    { title: t("STL (file format)：单位与比例", "STL (file format): units and scale"), publisher: "Wikipedia", url: "https://en.wikipedia.org/wiki/STL_(file_format)" },
    { title: "3MF Core Specification", publisher: "3MF Consortium", url: "https://github.com/3MFConsortium/spec_core" },
    { title: "导出设计", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Designs/files/ASM-EXPORT-DESIGN.htm" },
    { title: "支持的文件格式", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/File/supported_file_formats.htm" },
    {
      title: t("Importing Files in Cloud-Native CAD（Parasolid）", "Importing Files in Cloud-Native CAD (Parasolid)"),
      publisher: t("Onshape 博客", "Onshape blog"),
      url: "https://www.onshape.com/en/blog/importing-files-in-cloud-native-cloud-cad-pdm",
    },
  ],
  related: { cards: ["0.3.3", "1.4.2"], lessons: ["print-overhang"] },
}

export default card
