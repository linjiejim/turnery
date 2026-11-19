import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 2.3.3 标准件、紧固件与孔对齐. Figure: 3 px = 1 mm, an M6×20 cap screw through a clearance hole into a tapped hole. */

const card: CardDef = {
  code: "2.3.3",
  title: t("标准件：从库里调螺钉，和孔对上", "Standard parts, fasteners and hole alignment"),
  minutes: 4,
  sections: [
    {
      heading: t("标准件不用自己画", "You don't draw standard parts yourself"),
      body: byLocale(
        <>
          <p>螺钉、螺母、垫圈都有国标或 ISO 规格，尺寸是定好的。各软件都带标准件库，按规格插入即可：SOLIDWORKS 的 Toolbox（标准里有 GB），Fusion 的「插入紧固件」，Onshape 的「标准内容」，FreeCAD 装第三方的 Fasteners 工作台。</p>
          <p>库里的零件一般是简化外形，没有真实的螺纹牙型，用来装配、查干涉、出 BOM 足够了。</p>
        </>,
        <>
          <p>
            Screws, nuts and washers have GB (Chinese national standard) or ISO specifications, so their dimensions are already fixed. Every package comes with a standard parts library where you insert them by size: SOLIDWORKS Toolbox (its
            standards include GB), Fusion's “Insert Fastener”, Onshape's “Standard content”, and in FreeCAD the third-party Fasteners workbench, which you install.
          </p>
          <p>Library parts usually have simplified shapes without a real thread profile. That is enough for assembling, checking interference and producing a BOM.</p>
        </>,
      ),
    },
    {
      heading: t("常用国标和对应的 ISO", "Common GB standards and their ISO equivalents"),
      body: byLocale(
        <p>
          Fusion 和 Onshape 的库只有 ANSI、DIN、ISO 等，没有 GB。下表这几个国标都是参照对应的 ISO 标准制定的，库里没有国标件时可以先按 ISO 选，出图和采购时写国标号。国标会修订，用之前查一下是否现行：比如六角头螺栓全螺纹的 GB/T 5783，2025 年发布了新版。
        </p>,
        <p>
          The Fusion and Onshape libraries have ANSI, DIN, ISO and other standards, but no GB. The GB standards in the table below were all drafted with reference to their ISO counterparts, so when the library has no GB part, pick the ISO one
          for now and write the GB number on the drawing and the purchase order. GB standards get revised, so check that one is current before you use it: GB/T 5783 (hexagon head bolts, fully threaded), for example, had a new edition
          published in 2025.
        </p>,
      ),
    },
    {
      heading: t("让螺钉跟着孔走", "Make the screws follow the holes"),
      body: byLocale(
        <>
          <p>孔用孔特征做，孔就带着规格，库才知道该配什么螺钉：</p>
          <ul>
            <li>SOLIDWORKS「智能扣件」：给装配里的异型孔向导孔自动配上对应类型和大小的螺钉；盲孔取短一档的标准长度，通孔取长一档。「阵列驱动零部件阵列」按孔的阵列一次放好所有螺钉。</li>
            <li>Onshape「标准内容」能读出孔特征的螺纹定义，自动定螺钉尺寸；「仿制」把一个螺钉复制到所有匹配的孔上。</li>
            <li>Fusion「插入紧固件」按选中的圆边定尺寸，用「选择类似对象」可以一次插到同一个面上的所有同类孔。</li>
          </ul>
          <p>好处是：孔从 M4 改成 M5，或者从 4 个变成 6 个，螺钉跟着更新，BOM 里的数量也对。</p>
        </>,
        <>
          <p>Make holes with a hole feature: then each hole carries its specification, and the library knows which screw goes in it.</p>
          <ul>
            <li>
              SOLIDWORKS “Smart Fasteners” automatically puts a screw of the matching type and size into each Hole Wizard hole in the assembly; a blind hole gets the next standard length down, a through hole the next one up. “Pattern Driven
              Component Pattern” places all the screws at once, following the hole pattern.
            </li>
            <li>Onshape “Standard content” reads the thread definition from the hole feature and sizes the screw automatically; “Replicate” copies one screw into every matching hole.</li>
            <li>Fusion “Insert Fastener” sizes the fastener from the circular edge you select, and by selecting similar objects you can insert it into every hole of the same kind on that face at once.</li>
          </ul>
          <p>The payoff: change the holes from M4 to M5, or from 4 holes to 6, and the screws update with them, with the right quantity in the BOM.</p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={146}
        label={t(
          "剖视：M6 螺钉穿过上板的通孔，拧进下板的螺纹孔",
          "Section: an M6 screw passes through the clearance hole in the top plate and threads into the tapped hole in the bottom plate",
        )}
      >
        <defs>
          <pattern id="card-233-a" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" className="text-faint-foreground" strokeWidth={0.8} />
          </pattern>
          <pattern id="card-233-b" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="7" className="text-faint-foreground" strokeWidth={0.8} />
          </pattern>
        </defs>
        {/* 上板：通孔 Ø6.6 */}
        <path fillRule="evenodd" fill="url(#card-233-a)" stroke="none" d="M 20 40 H 200 V 70 H 20 Z M 100 40 H 120 V 70 H 100 Z" />
        <path d="M 20 40 H 100 V 70 H 20 Z M 120 40 H 200 V 70 H 120 Z" strokeWidth={1.5} />
        {/* 下板：M6 螺纹孔，底孔 Ø5 */}
        <path fillRule="evenodd" fill="url(#card-233-b)" stroke="none" d="M 20 70 H 200 V 130 H 20 Z M 102.5 70 H 117.5 V 121 L 110 125 L 102.5 121 Z" />
        <path d="M 20 70 H 102.5 V 121 L 110 125 L 117.5 121 V 70 H 200 V 130 H 20 Z" strokeWidth={1.5} />
        <path d="M 101 70 V 112 M 119 70 V 112" strokeWidth={0.75} />
        <path d="M 101 112 H 119" strokeWidth={1.5} />
        {/* 螺钉 M6×20：头 Ø10 × 6 */}
        <path d="M 95 22 H 125 V 40 H 119 V 100 H 101 V 40 H 95 Z" className="fill-background" strokeWidth={1.75} />
        <path d="M 110 14 V 132" strokeDasharray="10 3 2 3" strokeWidth={0.75} className="text-muted-foreground" />
        <g className="text-muted-foreground" strokeWidth={0.75} strokeDasharray="2 3">
          <path d="M 127 31 H 208 M 122 55 H 208 M 121 92 H 208" />
        </g>
        <T x={212} y={35}>
          {t("螺钉 M6×20", "M6×20 screw")}
        </T>
        <T x={212} y={59}>
          {t("通孔 Ø6.6", "Clearance Ø6.6")}
        </T>
        <T x={212} y={96}>
          {t("M6 螺纹孔", "M6 tapped hole")}
        </T>
      </Svg>
    ),
    caption: t(
      "螺钉穿过上板的通孔（GB/T 5277 中等装配 Ø6.6），拧进下板的 M6 螺纹孔。两个孔都用孔特征做，库就能按规格配上 M6 螺钉。",
      "The screw passes through the clearance hole in the top plate (Ø6.6, GB/T 5277 medium series) and threads into the M6 tapped hole in the bottom plate. Both holes are hole features, so the library can match them with an M6 screw by specification.",
    ),
    after: 0,
  },
  table: {
    caption: t("常用紧固件的国标和对应 ISO", "Common fasteners: GB standard and ISO equivalent"),
    head: byLocale(["名称", "国标", "对应 ISO"], ["Name", "GB standard", "ISO equivalent"]),
    nowrap: [1, 2],
    rows: byLocale(
      [
        ["内六角圆柱头螺钉", "GB/T 70.1-2008", "ISO 4762"],
        ["六角头螺栓 全螺纹", "GB/T 5783-2025", "ISO 4017"],
        ["1 型六角螺母", "GB/T 6170-2015", "ISO 4032"],
        ["平垫圈 A 级", "GB/T 97.1-2002", "ISO 7089"],
      ],
      [
        ["Hexagon socket head cap screw", "GB/T 70.1-2008", "ISO 4762"],
        ["Hexagon head bolt, fully threaded", "GB/T 5783-2025", "ISO 4017"],
        ["Hexagon nut, style 1", "GB/T 6170-2015", "ISO 4032"],
        ["Plain washer, grade A", "GB/T 97.1-2002", "ISO 7089"],
      ],
    ),
    after: 1,
  },
  terms: { ops: ["hole", "pattern", "thread"], concepts: ["mate"] },
  quiz: [
    {
      q: t("用智能扣件给装配自动配螺钉，配得最准的前提是？", "When Smart Fasteners fills an assembly with screws automatically, what makes the match most accurate?"),
      options: byLocale(
        ["孔是用异型孔向导（孔特征）做的，带着规格", "孔是画圆再拉伸切除出来的", "螺钉已经提前手动画好"],
        ["The holes were made with the Hole Wizard (a hole feature) and carry their specification", "The holes were made by drawing circles and doing an extruded cut", "The screws were already drawn by hand beforehand"],
      ),
      answer: 0,
      explain: t(
        "异型孔向导的孔带着规格，能配上对应类型和大小的螺钉。普通切除的孔只能按直径猜一个默认类型。",
        "Hole Wizard holes carry their specification, so they get a screw of the matching type and size. For a hole made by a plain cut, all it can do is guess a default type from the diameter.",
      ),
    },
    {
      q: t("Fusion 或 Onshape 的标准件库里找不到 GB 件，怎么办？", "The Fusion or Onshape standard parts library has no GB parts. What do you do?"),
      options: byLocale(
        ["自己从头画所有螺钉", "先按对应的 ISO 件选（比如 GB/T 70.1 对应 ISO 4762），出图和采购时写国标号", "随便选一个看起来像的"],
        [
          "Draw all the screws yourself from scratch",
          "Pick the corresponding ISO part for now (GB/T 70.1 corresponds to ISO 4762, for example), and write the GB number on the drawing and the purchase order",
          "Pick any one that looks similar",
        ],
      ),
      answer: 1,
      explain: t(
        "这几个常用国标都是参照对应 ISO 制定的，建模和装配时用 ISO 件代替很常见。正式的图纸和采购清单以国标号为准，并确认标准是否现行。",
        "These common GB standards were all drafted with reference to their ISO counterparts, so using ISO parts in their place while modeling and assembling is common. On the formal drawing and the purchase list, the GB number is what counts, and check that the standard is current.",
      ),
    },
    {
      q: t("孔从 4 个改成 6 个后，螺钉也要变成 6 个。哪种放法能自动跟上？", "The holes go from 4 to 6, and the screws need to go to 6 as well. Which way of placing them keeps up automatically?"),
      options: byLocale(
        ["手动一个个复制螺钉", "用阵列驱动零部件阵列或仿制，让螺钉跟着孔走", "在零件里画 6 个螺钉实体"],
        ["Copy the screws by hand, one at a time", "Use Pattern Driven Component Pattern or Replicate, so the screws follow the holes", "Draw 6 screw bodies in the part"],
      ),
      answer: 1,
      explain: t(
        "阵列驱动和仿制都以孔为依据放螺钉，孔的数量和位置变了，螺钉跟着变，BOM 数量也对。手动复制的螺钉和孔之间没有关系。",
        "Pattern-driven patterns and Replicate both place the screws from the holes, so when the number or position of the holes changes, the screws follow and the BOM quantity is right. Screws copied by hand have no relationship to the holes.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "螺钉、螺母、垫圈从标准件库调，不自己画；SOLIDWORKS Toolbox 带 GB，其他库可先按对应 ISO 选",
      "孔用孔特征做，螺钉才能按规格自动配上",
      "用阵列驱动或仿制放螺钉：孔变了，螺钉和 BOM 数量跟着变",
    ],
    [
      "Take screws, nuts and washers from the standard parts library instead of drawing them; SOLIDWORKS Toolbox includes GB, and in other libraries you can pick the ISO equivalent for now",
      "Make holes with a hole feature, so screws can be matched to them by specification automatically",
      "Place screws with a pattern-driven pattern or Replicate: when the holes change, the screws and the BOM quantity follow",
    ],
  ),
  sources: [
    { title: "SOLIDWORKS Toolbox 概述", publisher: t("SOLIDWORKS 2024 帮助", "SOLIDWORKS 2024 Help"), url: "https://help.solidworks.com/2024/Chinese-simplified/SolidWorks/toolbox/c_toolbox_overview.htm" },
    { title: "智能扣件 PropertyManager", publisher: t("SOLIDWORKS 2023 帮助", "SOLIDWORKS 2023 Help"), url: "https://help.solidworks.com/2023/chinese-simplified/SolidWorks/sldworks/HIDD_NEW_SMARTFASTENER_DLG.htm" },
    { title: "阵列驱动零部件阵列", publisher: t("SOLIDWORKS 2021 帮助", "SOLIDWORKS 2021 Help"), url: "https://help.solidworks.com/2021/chinese-simplified/solidworks/sldworks/HIDD_DVE_COMPPAT_DERIVED.htm" },
    { title: "插入紧固件", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-INSERT-FASTENER.htm" },
    { title: "标准内容", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Assembly/standard_content.htm" },
    { title: "仿制", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Assembly/replicate.htm" },
    { title: "Fasteners Workbench", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Fasteners_Workbench" },
    {
      title: "GB/T 5783-2025 紧固件 六角头螺栓 全螺纹",
      publisher: t("国家标准全文公开系统", "National standards full-text public system (SAMR)"),
      url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=01F5A0044F83A172F91B138098BEEBA0",
    },
    {
      title: "GB/T 97.1-2002 平垫圈 A 级",
      publisher: t("国家标准全文公开系统", "National standards full-text public system (SAMR)"),
      url: "https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=199E0585386FDF8B9CACF6225BA5F924",
    },
    {
      title: t("GB/T 70.1 内六角圆柱头螺钉（标准检索）", "GB/T 70.1 内六角圆柱头螺钉 (standards search)"),
      publisher: t("全国标准信息公共服务平台", "National Public Service Platform for Standards Information"),
      url: "https://std.samr.gov.cn/search/stdPage?q=GB/T70.1",
    },
    {
      title: t("GB/T 6170 1 型六角螺母（标准检索）", "GB/T 6170 1 型六角螺母 (standards search)"),
      publisher: t("全国标准信息公共服务平台", "National Public Service Platform for Standards Information"),
      url: "https://std.samr.gov.cn/search/stdPage?q=GB/T6170",
    },
  ],
  related: { lessons: ["assembly-dof"], teardowns: ["enclosure", "hinge_box"], cards: ["2.3.1", "1.2.4"] },
}

export default card
