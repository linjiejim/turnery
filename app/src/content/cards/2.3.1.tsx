import { Arrow, Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 2.3.1 装配上下文设计与外部参考的风险. */

const box = (x: number, y: number, w: number, label: string, className = "fill-muted") => (
  <g>
    <rect x={x} y={y} width={w} height={28} rx={6} className={className} />
    <T x={x + w / 2} y={y + 19} anchor="middle">
      {label}
    </T>
  </g>
)

const card: CardDef = {
  code: "2.3.1",
  title: t("在装配里照着邻居画：外部参考的利与险", "In-context design and the risk of external references"),
  minutes: 5,
  sections: [
    {
      heading: t("什么是装配上下文设计", "What in-context design is"),
      body: byLocale(
        <p>
          在装配里编辑一个零件，让它的草图直接引用另一个零件的几何：盖子上的孔对准盒子里的螺丝柱，支架的宽度等于电机的宽度。邻居变了，它跟着变。这叫装配上下文设计（in-context），产生的引用就是外部参考。好处很直接：配合尺寸只定义一次，不用两边各量一遍。
        </p>,
        <p>
          You edit a part inside the assembly and let its sketch reference another part's geometry directly: the holes in the lid line up with the screw bosses in the box, the bracket is as wide as the motor. When the neighbor changes, the part
          follows. This is called in-context design, and the references it creates are external references. The benefit is simple: the mating dimensions are defined once, instead of being measured on both sides.
        </p>,
      ),
    },
    {
      heading: t("各软件怎么控制更新", "How each package controls updates"),
      body: byLocale(
        <ul>
          <li>Onshape：在装配里「在关联中编辑」时，被引用的几何存成一个「关联环境快照」，不会自动更新。要更新时，在装配里手动「更新关联环境」。别的零件动了，你的零件不会意外改变。</li>
          <li>Fusion：「在位编辑」可以选关联或非关联。部件上下文变化后显示为不同步，手动「同步部件上下文」才更新；「断开关联」去掉引用。</li>
          <li>SOLIDWORKS：在装配里编辑零件时建立的关联特征带外部参考。外部参考可以锁定或断开，锁定后不再跟着邻居变。</li>
        </ul>,
        <ul>
          <li>
            Onshape: when you “Edit in context” from an assembly, the referenced geometry is stored as an assembly context, a snapshot that doesn't update on its own. When you want it updated, you run “Update context” by hand. When other
            parts change, yours doesn't change unexpectedly.
          </li>
          <li>
            Fusion: “Edit In Place” can be Associative or Non-Associative. When the assembly context changes, it shows as out of sync, and it only updates when you run “Sync Assembly Context” by hand; “Break Link” removes the reference.
          </li>
          <li>
            SOLIDWORKS: the in-context features you create while editing a part in an assembly carry external references. External references can be locked or broken; once locked, they no longer follow the neighbor.
          </li>
        </ul>,
      ),
    },
    {
      heading: t("风险在哪里", "Where the risks are"),
      body: byLocale(
        <ul>
          <li>换个地方就断：零件被拿到另一个装配里，原来引用的邻居不在了，参考失效。</li>
          <li>牵一发动全身：引用一层层传下去，改一个零件，一串零件跟着重算；绕一圈回来就成了循环引用。</li>
          <li>悄悄被改：邻居被别人改了，你的零件跟着变，自己却不知道。</li>
        </ul>,
        <ul>
          <li>Move it and it breaks: take the part into another assembly, the neighbor it referenced isn't there, and the reference fails.</li>
          <li>
            One change ripples through everything: references are passed down layer after layer, so changing one part makes a whole chain of parts recompute; and when the chain loops back on itself, you have a circular reference.
          </li>
          <li>Silent changes: someone else changes the neighbor, your part changes with it, and you don't know.</li>
        </ul>,
      ),
    },
    {
      heading: t("用好它的规矩", "Rules for using it well"),
      body: byLocale(
        <ul>
          <li>只引用稳定的东西：布局草图、骨架模型、标准件的接口尺寸，而不是别人随时会改的细节。</li>
          <li>引用少而清楚：一个零件只引用一两个来源；Onshape 的帮助建议给每个关联环境起一个说得清用途的名字。</li>
          <li>能用全局变量表达的尺寸，就别用几何引用。</li>
          <li>设计定型后，锁定或断开外部参考，零件就能独立复用。</li>
        </ul>,
        <ul>
          <li>Only reference things that are stable: layout sketches, skeleton models, the interface dimensions of standard parts. Not details that someone may change at any moment.</li>
          <li>Keep references few and clear: a part references only one or two sources. Onshape's help suggests giving each context a name that says what it is for.</li>
          <li>If a dimension can be expressed as a global variable, don't use a geometric reference for it.</li>
          <li>Once the design settles, lock or break the external references, and the part can be reused on its own.</li>
        </ul>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={176}
        label={t(
          "左：所有零件只引用一份布局草图；右：零件一个引用一个，还绕成了循环",
          "Left: every part references only one layout sketch. Right: each part references the next, and the chain loops back",
        )}
      >
        <T x={80} y={16} anchor="middle" tone="muted">
          {t("都引用骨架", "All use the skeleton")}
        </T>
        {box(30, 26, 100, t("布局草图", "Layout sketch"), "fill-info-subtle text-primary")}
        <g className="text-primary">
          <Arrow x1={70} y1={56} x2={32} y2={116} />
          <Arrow x1={80} y1={56} x2={80} y2={116} />
          <Arrow x1={90} y1={56} x2={128} y2={116} />
        </g>
        {box(6, 118, 50, t("盒子", "Box"))}
        {box(58, 118, 44, t("盖子", "Lid"))}
        {box(104, 118, 50, t("支架", "Bracket"))}
        <T x={240} y={16} anchor="middle" tone="muted">
          {t("零件互相引用", "Parts reference parts")}
        </T>
        {box(200, 26, 80, t("盒子", "Box"))}
        {box(200, 76, 80, t("盖子", "Lid"))}
        {box(200, 126, 80, t("按钮", "Button"))}
        <g className="text-muted-foreground">
          <Arrow x1={240} y1={56} x2={240} y2={74} />
          <Arrow x1={240} y1={106} x2={240} y2={124} />
        </g>
        <g className="text-destructive">
          <path d="M 282 140 C 314 140 314 40 284 40" strokeDasharray="4 3" />
          <path d="M 290 36 L 284 40 L 290 44" />
          <T x={302} y={28} anchor="middle" className="text-destructive">
            {t("循环", "Loop")}
          </T>
        </g>
      </Svg>
    ),
    caption: t(
      "箭头从被引用的一方指向引用它的一方。左边所有零件只引用一份布局草图；右边零件一个引用一个，最后还绕回了自己。",
      "Arrows point from what is referenced to what references it. On the left, every part references only one layout sketch; on the right, each part references the next, and the chain ends up looping back on itself.",
    ),
    after: 2,
  },
  terms: { concepts: ["external-reference", "parent-child", "design-intent"] },
  quiz: [
    {
      q: t(
        "你在装配里画盖子时引用了盒子的边。后来把这个盖子用到另一个产品的装配里，会怎样？",
        "You drew the lid in the assembly, referencing the box's edges. Later you use this lid in another product's assembly. What happens?",
      ),
      options: byLocale(
        ["一切正常", "盖子找不到原来引用的盒子，外部参考失效，无法再跟着更新", "盒子会被自动带到新装配里"],
        ["Everything works as before", "The lid can't find the box it referenced: the external reference fails and can no longer update", "The box is brought into the new assembly automatically"],
      ),
      answer: 1,
      explain: t(
        "外部参考指向的是原来那个装配里的盒子。换了地方，参考找不到来源。要复用的零件，定型后先锁定或断开参考。",
        "The external reference points to the box in the original assembly. In a new place, the reference can't find its source. For a part you'll reuse, lock or break the references once the design settles.",
      ),
    },
    {
      q: t("Onshape 里，同事改了盒子。你在关联中编辑过的盖子会怎样？", "In Onshape, a colleague changes the box. What happens to the lid you edited in context?"),
      options: byLocale(
        ["马上自动跟着变", "暂时不变，等你手动更新关联环境", "报错并被删除"],
        ["It follows immediately and automatically", "It stays as it is for now, until you update the context by hand", "It errors and gets deleted"],
      ),
      answer: 1,
      explain: t(
        "Onshape 把被引用的几何存成快照，只有手动「更新关联环境」时才会变。这样别人的改动不会悄悄带走你的零件。",
        "Onshape stores the referenced geometry as a snapshot, and it only changes when you run “Update context” by hand. That way other people's changes can't quietly carry your part off.",
      ),
    },
    {
      q: t("好几个零件都要对齐同一组孔位。更稳的做法是？", "Several parts must line up with the same set of hole positions. What is the more robust approach?"),
      options: byLocale(
        ["盖子引用盒子，按钮引用盖子，一层层传下去", "孔位画在一份布局草图或参数表里，各零件都引用它", "每个零件各画一遍孔位"],
        [
          "The lid references the box, the button references the lid, passing it down layer by layer",
          "Draw the hole positions in one layout sketch or parameter table and have every part reference that",
          "Draw the hole positions separately in each part",
        ],
      ),
      answer: 1,
      explain: t(
        "所有零件引用同一个稳定的来源，依赖关系是一层，不会连环牵动，也不会绕成循环。各画一遍则没有任何关联，改的时候容易漏。",
        "When every part references the same stable source, the dependencies are one level deep: no chain reactions and no loops. Drawing them separately in each part leaves no link at all, so a change is easy to miss.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "装配上下文设计让零件照着邻居画，邻居变它就变：方便，但多了跨零件的依赖",
      "风险是换个装配就断、改一个牵动一串、被别人的改动悄悄带走",
      "只引用布局草图这类稳定的来源，引用少而清楚，定型后锁定或断开",
    ],
    [
      "In-context design lets you draw a part off its neighbor, and it changes when the neighbor does: convenient, but it adds dependencies between parts",
      "The risks: it breaks in another assembly, one change drags a chain of parts along, and other people's changes quietly carry your part off",
      "Reference only stable sources such as layout sketches, keep references few and clear, and lock or break them once the design settles",
    ],
  ),
  sources: [
    { title: "在关联环境中建模", publisher: t("Onshape 帮助", "Onshape Help"), url: "https://cad.onshape.com/help/zh_CN/Content/Assembly/modeling_in_context.htm" },
    { title: "关联性", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-EIP-ASSOCIATIVITY.htm" },
    { title: "同步部件上下文", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-SYNC-ASSEMBLY-CONTEXT.htm" },
    { title: "在装配上下文中断开链接", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Assemble/files/ASM-BREAK-LINK-CONTEXT.htm" },
    {
      title: t("显示/删除几何关系（外部、在关联中定义、锁定、断开）", "显示/删除几何关系 (external, defined in context, locked, broken)"),
      publisher: t("SOLIDWORKS 2016 帮助", "SOLIDWORKS 2016 Help"),
      url: "https://help.solidworks.com/2016/chinese-simplified/SolidWorks/sldworks/HIDD_DVE_SK_EDIT_RELATIONS.htm",
    },
  ],
  related: { lessons: ["assembly-dof"], teardowns: ["enclosure", "hinge_box"], cards: ["2.3.3", "1.4.3", "1.5.1"] },
}

export default card
