import { CodeBlock } from "@/components/code-block"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 1.5.4 可编程特征简介. The build123d snippet runs as written (checked with build123d 0.13, models/requirements.txt). */

const PLATE = byLocale(
  `from build123d import *

length, width, thick = 80, 40, 8              # 参数：函数的输入
with BuildPart() as plate:
    Box(length, width, thick)                 # 特征：长出一块板
    top = plate.faces().sort_by(Axis.Z)[-1]   # 按方向选面：最上面那个
    with Locations(top):
        with GridLocations(length - 20, 0, 2, 1):
            Hole(radius=3)                    # 在顶面上打两个通孔`,
  `from build123d import *

length, width, thick = 80, 40, 8              # parameters: the function's inputs
with BuildPart() as plate:
    Box(length, width, thick)                 # feature: grow a plate
    top = plate.faces().sort_by(Axis.Z)[-1]   # pick a face by direction: the topmost one
    with Locations(top):
        with GridLocations(length - 20, 0, 2, 1):
            Hole(radius=3)                    # two through holes in the top face`,
)

const card: CardDef = {
  code: "1.5.4",
  title: t("可编程特征：把建模写成代码", "Introduction to programmable features"),
  minutes: 4,
  sections: [
    {
      heading: t("特征树本来就是程序", "The feature tree is already a program"),
      body: byLocale(
        <>
          <p>特征树按顺序执行，每个特征读入参数和参考，输出新的几何。换个角度看：参数是函数的输入，特征是一次函数调用，模型是运行结果。改参数再重建，就是带着新输入把程序再跑一遍。</p>
          <p>可编程特征把这件事说破：用代码写一个特征，或者干脆用代码描述整个零件。</p>
          <CodeBlock code={PLATE} className="mt-3" />
        </>,
        <>
          <p>
            The feature tree runs in order: each feature reads its parameters and references and outputs new geometry. Look at it another way: the parameters are a function's inputs, each feature is a function call, and the model is the
            result of the run. Changing a parameter and rebuilding is running the program again with new inputs.
          </p>
          <p>Programmable features make this explicit: you write a feature in code, or describe the whole part in code.</p>
          <CodeBlock code={PLATE} className="mt-3" />
        </>,
      ),
    },
    {
      heading: t("主流软件的入口", "Where to start in the main packages"),
      body: byLocale(
        <ul>
          <li>Onshape：FeatureScript。Onshape 自带的拉伸、圆角等标准特征就是用它写的，源码公开可看。在 Feature Studio 里写的自定义特征，用起来和自带特征一样。</li>
          <li>Fusion：「脚本和附加模块」，用 Python 或 C++ 调用 API。</li>
          <li>SOLIDWORKS：「宏」，可以把操作录制成 VBA 宏再改；更复杂的用 C#、VB.NET 写插件。</li>
          <li>FreeCAD：界面上的操作都对应 Python 命令，打开选项后会显示在 Python 控制台里；宏就是一串 Python 命令。</li>
          <li>纯代码建模：CadQuery、build123d（Python，基于 OpenCascade 内核），OpenSCAD（自己的脚本语言，用实体的并、差、交组合形状）。本站拆解页的模型就是用 build123d 写的。</li>
        </ul>,
        <ul>
          <li>
            Onshape: FeatureScript. Onshape's own standard features, such as Extrude and Fillet, are written in it, and their source is public. Custom features you write in a Feature Studio work just like the built-in ones.
          </li>
          <li>Fusion: “Scripts and Add-Ins”, which call the API from Python or C++.</li>
          <li>SOLIDWORKS: “Macros”. Record your actions as a VBA macro and then edit it; for anything more complex, write an add-in in C# or VB.NET.</li>
          <li>FreeCAD: every action in the interface corresponds to a Python command, which shows up in the Python console once you turn on the option; a macro is just a sequence of Python commands.</li>
          <li>
            Code-only modeling: CadQuery and build123d (Python, built on the OpenCascade kernel), and OpenSCAD (its own scripting language, which builds shapes from unions, differences and intersections of solids). The models on this
            site's teardown pages are written in build123d.
          </li>
        </ul>,
      ),
    },
    {
      heading: t("难点：怎么指代「那条边」", "The hard part: how to say “that edge”"),
      body: byLocale(
        <>
          <p>写代码最难的不是画形状，而是选参考。写死「第 7 条边」，上游一变，编号就可能换人，这就是拓扑命名问题。好的写法是按关系查询：「拉伸 1 生成的那些面」「朝上的那个面」。FeatureScript 的 <code>qCreatedBy</code> 按「由哪个特征生成」查询，上面 build123d 例子里的 <code>sort_by(Axis.Z)</code> 按方向挑面，都是这个思路。</p>
          <p>什么时候值得用代码：规则驱动、要出一个系列的零件（齿轮、紧固件、按表生成的支架），或者要批量生成、自动检查的时候。普通零件，用界面建更快。</p>
        </>,
        <>
          <p>
            The hardest part of writing code isn't drawing shapes; it's picking references. Hard-code “edge 7”, and when something upstream changes, that number may now belong to a different edge: that is the topological naming problem. The
            better way is to query by relationship: “the faces created by Extrude 1”, “the face that points up”. FeatureScript's <code>qCreatedBy</code> queries by which feature created the geometry, and{" "}
            <code>sort_by(Axis.Z)</code> in the build123d example above picks a face by direction: both follow this idea.
          </p>
          <p>
            When code is worth it: rule-driven parts that come in a series (gears, fasteners, brackets generated from a table), or when you need to generate parts in bulk or check them automatically. For an ordinary part, the interface is
            faster.
          </p>
        </>,
      ),
    },
  ],
  terms: { ops: ["extrude", "hole"], concepts: ["feature-tree", "tnp", "parameter"] },
  quiz: [
    {
      q: t("Onshape 自带的拉伸、圆角这些标准特征，是用什么写的？", "What are Onshape's built-in standard features, like Extrude and Fillet, written in?"),
      options: byLocale(
        ["不公开的 C++ 代码", "FeatureScript，和用户写自定义特征用的是同一种语言", "Python"],
        ["Closed-source C++ code", "FeatureScript, the same language users write custom features in", "Python"],
      ),
      answer: 1,
      explain: t(
        "Onshape 的标准特征写在一个公开文档的 Feature Studio 里，源码可以直接看。自定义特征和它们站在同一起跑线上。",
        "Onshape's standard features are written in a Feature Studio in a public document, so you can read their source directly. Custom features start on an equal footing with them.",
      ),
    },
    {
      q: t("代码里用「第 7 条边」来选要倒圆角的边，有什么问题？", "What's wrong with picking the edge to fillet as “edge 7” in code?"),
      options: byLocale(
        ["没问题，编号是固定的", "上游一改，边可能重新编号，圆角会做到别的边上或者报错", "代码会跑得很慢"],
        ["Nothing, the numbers are fixed", "Change something upstream and the edges may be renumbered, so the fillet lands on a different edge or fails", "The code will run very slowly"],
      ),
      answer: 1,
      explain: t(
        "编号是每次重算时临时给的。按关系查询（哪个特征生成的、朝哪个方向），模型变了也能选到同一条边。",
        "The numbers are handed out afresh on every rebuild. Query by relationship (which feature created it, which way it points), and you still get the same edge when the model changes.",
      ),
    },
    {
      q: t("哪种零件最值得用代码来建？", "Which kind of part is most worth modeling in code?"),
      options: byLocale(
        ["规则驱动、要出一个系列的零件，比如齿轮和紧固件", "只做一次的外观件", "所有零件都应该用代码建"],
        ["Rule-driven parts that come in a series, such as gears and fasteners", "A one-off cosmetic part", "Every part should be modeled in code"],
      ),
      answer: 0,
      explain: t(
        "规则清楚、规格多的零件，代码一次写好，换参数就出新规格。造型为主、只做一次的零件，用界面建更直观。",
        "For parts with clear rules and many sizes, you write the code once and each new set of parameters gives a new size. For one-off parts that are mostly about form, building them in the interface is more intuitive.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "特征树就是程序：参数是输入，特征是函数调用，模型是运行结果",
      "Onshape 有 FeatureScript，Fusion 和 SOLIDWORKS 有 API 和宏，FreeCAD 的操作都是 Python，build123d、CadQuery 直接用代码建模",
      "代码建模的关键是按关系选参考，不按编号",
    ],
    [
      "The feature tree is a program: parameters are the inputs, features are function calls, the model is the result",
      "Onshape has FeatureScript, Fusion and SOLIDWORKS have APIs and macros, every FreeCAD action is Python, and build123d and CadQuery model directly in code",
      "The key to modeling in code is picking references by relationship, not by number",
    ],
  ),
  sources: [
    { title: "FeatureScript introduction", publisher: "Onshape", url: "https://cad.onshape.com/FsDoc/intro.html" },
    { title: t("FeatureScript 标准库（qCreatedBy）", "FeatureScript standard library (qCreatedBy)"), publisher: "Onshape", url: "https://cad.onshape.com/FsDoc/library.html" },
    { title: "Feature Studio", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/FeatureStudio/feature_studios.htm" },
    { title: "管理脚本和附加模块", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Model/files/SLD-MANAGE-SCRIPTS-ADD-INS.htm" },
    { title: "录制和执行宏", publisher: t("SOLIDWORKS 2024 帮助", "SOLIDWORKS 2024 Help"), url: "https://help.solidworks.com/2024/chinese-simplified/SolidWorks/sldworks/c_recording_playing_macros.htm" },
    { title: "Macros", publisher: "FreeCAD Wiki", url: "https://wiki.freecad.org/Macros" },
    { title: t("build123d 文档", "build123d documentation"), publisher: "build123d", url: "https://build123d.readthedocs.io/en/latest/" },
    { title: t("CadQuery 简介", "CadQuery introduction"), publisher: "CadQuery", url: "https://cadquery.readthedocs.io/en/latest/intro.html" },
    { title: "About OpenSCAD", publisher: "OpenSCAD", url: "https://openscad.org/about.html" },
  ],
  related: { lessons: ["feature-tree"], teardowns: ["gear", "mug"], cards: ["1.5.2"] },
}

export default card
