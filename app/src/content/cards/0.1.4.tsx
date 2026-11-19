import { Arrow, Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/** 0.1.4 构造平面与坐标输入. */

// Figure: one unit = 2.5 px, CPlane origin at (30, 170).
const O = { x: 30, y: 170 }
const at = (u: number, v: number) => ({ x: O.x + u * 2.5, y: O.y - v * 2.5 })
const P1 = at(30, 20)
const P2 = at(70, 20)
const P3 = at(70 + 30 * Math.cos(Math.PI / 3), 20 + 30 * Math.sin(Math.PI / 3))
const grid = Array.from({ length: 12 }, (_, i) => i * 25)

const card: CardDef = {
  code: "0.1.4",
  title: t("工作平面与坐标输入", "Construction planes and coordinate input"),
  minutes: 4,
  sections: [
    {
      heading: t("点落在工作平面上", "Points land on the construction plane"),
      body: byLocale(
        <>
          <p>在 Rhino 这类自由曲面软件里，没有「先选基准面、再进草图」这一步。命令要你指定一个点时，鼠标点下去的位置默认落在当前视图的工作平面（CPlane）上。</p>
          <p>工作平面像一张桌面：有原点、X 轴、Y 轴和网格。每个视图各有一个，互不影响。想在一个斜面上画线，就用 CPlane 指令把工作平面摆到那个面上，之后点下去的点都落在斜面上。</p>
        </>,
        <>
          <p>
            In a freeform modeler like Rhino, there is no “pick a datum plane, then open a sketch” step. When a command asks you for a point, the spot you click lands on the active viewport's construction plane (CPlane) by default.
          </p>
          <p>
            A construction plane is like a tabletop: it has an origin, an X axis, a Y axis and a grid. Each viewport has its own, independent of the others. To draw on a sloped face, use the CPlane command to move the construction plane onto
            that face. Every point you click after that lands on the slope.
          </p>
        </>,
      ),
    },
    {
      heading: t("用键盘输入坐标", "Type coordinates on the keyboard"),
      body: byLocale(
        <>
          <p>鼠标点不准，键盘能。命令提示指定点时，直接打字再按回车：</p>
          <ul>
            <li>
              <code>30,20</code>：工作平面坐标，从工作平面原点量起；不写 Z 就是 0。
            </li>
            <li>
              <code>r40,0</code> 或 <code>@40,0</code>：相对坐标，从上一个点量起。
            </li>
            <li>
              <code>{"30<60"}</code>：极坐标，距离 30、角度 60°。角度从工作平面 X 轴开始，逆时针为正。前面加 <code>r</code> 就是相对上一个点。
            </li>
            <li>
              <code>w0,0,0</code>：世界坐标，不管工作平面摆在哪里。
            </li>
          </ul>
        </>,
        <>
          <p>A mouse click can't be exact; the keyboard can. When the command prompt asks for a point, type the value and press Enter:</p>
          <ul>
            <li>
              <code>30,20</code>: construction plane coordinates, measured from the construction plane's origin. Leave out Z and it is 0.
            </li>
            <li>
              <code>r40,0</code> or <code>@40,0</code>: relative coordinates, measured from the previous point.
            </li>
            <li>
              <code>{"30<60"}</code>: polar coordinates, distance 30 at an angle of 60°. The angle starts at the construction plane's X axis, counterclockwise positive. Put <code>r</code> in front to make it relative to the previous
              point.
            </li>
            <li>
              <code>w0,0,0</code>: world coordinates, wherever the construction plane happens to be.
            </li>
          </ul>
        </>,
      ),
    },
    {
      heading: t("距离限制、角度限制、正交", "Distance constraint, angle constraint, Ortho"),
      body: byLocale(
        <>
          <p>画线时先输入一个数再回车，线的长度就被锁住，移动鼠标只改方向，这叫距离限制。输入 <code>{"<15"}</code> 是角度限制：方向只能停在 15° 的整数倍上。</p>
          <p>正交把方向锁在每 90° 一档（默认值），物件锁点让鼠标吸附到端点、中点、圆心、交点。这几样配合起来，大多数点不用打坐标也能放准。</p>
        </>,
        <>
          <p>
            While drawing a line, type a number and press Enter first: the line's length is locked, and moving the mouse only changes its direction. This is the distance constraint. Type <code>{"<15"}</code> for an angle constraint:
            the direction can only stop at multiples of 15°.
          </p>
          <p>
            Ortho locks the direction to 90° steps (the default), and object snaps pull the cursor onto endpoints, midpoints, centers and intersections. Used together, they let you place most points accurately without typing any
            coordinates.
          </p>
        </>,
      ),
    },
    {
      heading: t("和参数化软件的区别", "How this differs from parametric software"),
      body: byLocale(
        <p>
          SOLIDWORKS、Fusion、Onshape 里，草图通常先大致画，再用尺寸和约束把形状钉死；数值记在尺寸里，以后改一个数，形状跟着变。Rhino 里输入的坐标只决定这一次把点放在哪里，曲线不会「记住」它。想以后能改，要么用参数化软件，要么在 Rhino 里用 Grasshopper 这类参数化工具。
        </p>,
        <p>
          In SOLIDWORKS, Fusion and Onshape, you usually sketch the shape roughly, then pin it down with dimensions and constraints. The values live in the dimensions: change one number later and the shape follows. In Rhino, the
          coordinates you type only decide where the point goes this one time; the curve doesn't “remember” them. If you want to change it later, either use parametric software or use a parametric tool inside Rhino, such as
          Grasshopper.
        </p>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={190}
        label={t("工作平面上的三种坐标输入：工作平面坐标、相对坐标、相对极坐标", "Three kinds of coordinate input on a construction plane: construction plane coordinates, relative coordinates, relative polar coordinates")}
      >
        <g className="text-border" strokeWidth={0.75}>
          {grid.map((d) => (
            <line key={`v${d}`} x1={O.x + d} y1={14} x2={O.x + d} y2={O.y} />
          ))}
          {grid.slice(0, 7).map((d) => (
            <line key={`h${d}`} x1={O.x} y1={O.y - d} x2={312} y2={O.y - d} />
          ))}
        </g>
        <Arrow x1={O.x} y1={O.y} x2={312} y2={O.y} className="text-muted-foreground" />
        <Arrow x1={O.x} y1={O.y} x2={O.x} y2={10} className="text-muted-foreground" />
        <T x={306} y={O.y + 16} anchor="end" tone="muted">
          X
        </T>
        <T x={O.x - 8} y={18} anchor="end" tone="muted">
          Y
        </T>
        <T x={O.x - 6} y={O.y + 16} tone="muted">
          {t("原点", "Origin")}
        </T>
        <g className="text-faint-foreground" strokeDasharray="3 3">
          <line x1={P1.x} y1={P1.y} x2={P1.x} y2={O.y} />
          <line x1={P1.x} y1={P1.y} x2={O.x} y2={P1.y} />
        </g>
        <g className="text-primary" strokeWidth={1.75}>
          <Arrow x1={P1.x} y1={P1.y} x2={P2.x} y2={P2.y} />
          <Arrow x1={P2.x} y1={P2.y} x2={P3.x} y2={P3.y} />
        </g>
        <path d={`M ${P2.x + 22} ${P2.y} A 22 22 0 0 0 ${P2.x + 22 * Math.cos(Math.PI / 3)} ${P2.y - 22 * Math.sin(Math.PI / 3)}`} className="text-muted-foreground" />
        <T x={P2.x + 26} y={P2.y - 8} tone="muted">
          60°
        </T>
        {[P1, P2, P3].map((p) => (
          <circle key={`${p.x}`} cx={p.x} cy={p.y} r={3.5} className="fill-current stroke-none text-foreground" />
        ))}
        <T x={P1.x - 6} y={P1.y - 10} anchor="end">
          30,20
        </T>
        <T x={(P1.x + P2.x) / 2} y={P1.y - 10} anchor="middle" tone="primary">
          r40,0
        </T>
        <T x={P3.x - 8} y={P3.y + 4} anchor="end" tone="primary">
          {"r30<60"}
        </T>
      </Svg>
    ),
    caption: t(
      "从工作平面原点量到 30,20；再相对上一点向右 40；再相对上一点走 30、方向 60°。",
      "Measure 30,20 from the construction plane's origin; then go 40 to the right of the previous point; then go 30 from that point at 60°.",
    ),
    after: 1,
  },
  terms: { ops: ["plane", "sketch"], concepts: ["datum"] },
  quiz: [
    {
      q: t("上一个点在 10,10，键入 r20,0 后，新点在哪里？", "The previous point is at 10,10. You type r20,0. Where is the new point?"),
      options: ["20,0", "30,10", "20,10"],
      answer: 1,
      explain: t(
        "r（或 @）表示相对上一个点：X 加 20，Y 不变。不带 r 的 20,0 才是从工作平面原点量起。",
        "r (or @) means relative to the previous point: X goes up by 20 and Y stays the same. Only 20,0 without the r is measured from the construction plane's origin.",
      ),
    },
    {
      q: t("不带 r，键入 50<90，点会放在哪里？", "You type 50<90, without an r. Where does the point go?"),
      options: byLocale(
        ["从上一个点向上 50", "从工作平面原点出发，沿工作平面 Y 轴正向 50", "从世界原点出发，沿世界 Z 轴 50"],
        ["50 up from the previous point", "50 from the construction plane's origin, along its positive Y axis", "50 from the world origin, along the world Z axis"],
      ),
      answer: 1,
      explain: t(
        "极坐标的角度从工作平面 X 轴量起，逆时针 90° 就是 Y 轴正向；不带 r 时从工作平面原点量起。要相对上一个点，写 r50<90 或 @50<90。",
        "A polar angle is measured from the construction plane's X axis, so 90° counterclockwise is the positive Y axis. Without an r, the distance is measured from the construction plane's origin. To go from the previous point, type r50<90 or @50<90.",
      ),
    },
    {
      q: t(
        "在 Rhino 里用坐标精确画了一条 50 长的线，后来想改成 60。最直接的办法是？",
        "In Rhino you used coordinates to draw a line exactly 50 long. Later you want it to be 60. What is the most direct way?",
      ),
      options: byLocale(
        ["双击尺寸改成 60", "曲线没有记住尺寸：用缩放、延伸等编辑命令改，或者重画", "移动工作平面的原点"],
        [
          "Double-click the dimension and change it to 60",
          "The curve doesn't remember a dimension: change it with an editing command such as Scale or Extend, or redraw it",
          "Move the construction plane's origin",
        ],
      ),
      answer: 1,
      explain: t(
        "坐标输入只决定这一次点放在哪里，曲线不带驱动尺寸；Rhino 的尺寸标注只是注释，不会驱动几何。参数化软件的尺寸会一直驱动形状，这是两类软件的根本区别。",
        "Coordinate input only decides where the point goes this one time; the curve carries no driving dimension. Rhino's dimensions are annotations only and don't drive the geometry. In parametric software, dimensions keep driving the shape: that is the fundamental difference between the two kinds of software.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "鼠标点下去的点落在当前视图的工作平面上；每个视图各有一个，可以用 CPlane 指令摆到任何面上",
      "x,y 从工作平面原点量起，r 或 @ 从上一个点量起，距离<角度 是极坐标，w 前缀用世界坐标",
      "坐标输入只决定这一次的位置；想以后改一个数就能改形状，要靠参数化的尺寸和约束",
    ],
    [
      "A point you click lands on the active viewport's construction plane. Each viewport has its own, and the CPlane command can move it onto any face",
      "x,y is measured from the construction plane's origin, r or @ from the previous point; distance<angle is polar, and the w prefix uses world coordinates",
      "Coordinate input only decides the position this one time. To change the shape later by changing one number, you need parametric dimensions and constraints",
    ],
  ),
  sources: [
    { title: "使用工作平面", publisher: t("Rhino 8 帮助", "Rhino 8 Help"), url: "https://docs.mcneel.com/rhino/8/help/zh-cn/seealso/sak_cplanes.htm" },
    {
      title: t("精确建模（坐标输入、距离和角度限制）", "精确建模 (coordinate input, distance and angle constraints)"),
      publisher: t("Rhino 8 帮助", "Rhino 8 Help"),
      url: "https://docs.mcneel.com/rhino/8/help/zh-cn/user_interface/accurate_modeling.htm",
    },
    { title: "CPlane 指令", publisher: t("Rhino 8 帮助", "Rhino 8 Help"), url: "https://docs.mcneel.com/rhino/8/help/zh-cn/commands/cplane.htm" },
    { title: "正交", publisher: t("Rhino 8 帮助", "Rhino 8 Help"), url: "https://docs.mcneel.com/rhino/8/help/zh-cn/commands/ortho.htm" },
    { title: "完全定义和约束草图", publisher: t("Autodesk Fusion 帮助", "Autodesk Fusion Help"), url: "https://help.autodesk.com/cloudhelp/CHS/Fusion-Sketch/files/SKT-FULLY-DEFINE-CONSTRAIN-SKETCH.htm" },
  ],
  related: { lessons: ["coordinates", "datum-planes"] },
}

export default card
