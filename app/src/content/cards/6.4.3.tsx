import { Svg, T } from "@/components/card-figure"
import { byLocale, t } from "@/lib/i18n"
import type { CardDef } from "./types"

/**
 * 6.4.3 草图的线条与明暗. Figure: an isometric box (top) and an upright cylinder (bottom), lit from the upper left.
 * Shading is darkness, so the figure is drawn on its own sheet of paper: light in both themes, with the drawing
 * in foreground colour (background colour in dark mode) at stepped opacities.
 */

const leader = (x1: number, y1: number, x2: number, y2: number) => <path d={`M ${x1} ${y1} L ${x2} ${y2}`} strokeWidth={0.75} strokeOpacity={0.55} />
/** The sheet, and an opaque underlay so the shadows behind each object don't show through its translucent tones. */
const paper = "fill-background dark:fill-foreground"
const tone = (o: number) => ({ className: "fill-current", fillOpacity: o, stroke: "none" })

const card: CardDef = {
  code: "6.4.3",
  title: t("草图的线条与明暗", "Line weight and shading in sketches"),
  minutes: 4,
  sections: [
    {
      heading: t("三种粗细的线", "Three weights of line"),
      body: byLocale(
        <>
          <p>一张草图里的线不该一样粗。粗细在告诉看图的人：哪里是外形，哪里是转折，哪里只是细节。</p>
          <ul>
            <li>外轮廓线最粗：物体和背景的分界，以及前面的零件压住后面零件的地方。背光一侧、贴近地面的一侧还可以再加重。</li>
            <li>结构线中等：两个看得见的面相交的转折边，比如盒子顶面和侧面的交线、圆柱顶面靠前的那半个椭圆。它是整张图的「标准粗细」，别的线都和它比。</li>
            <li>细节线最细：分模线、按键、开孔、纹理，以及起稿的辅助线。</li>
          </ul>
          <p>别把整圈外形描成一样粗：所有线都粗，就等于没有粗线。先用中等线画出形体，再加细节，最后挑几处加粗。</p>
        </>,
        <>
          <p>The lines in a sketch shouldn't all be the same weight. Weight tells the viewer which lines are the outer shape, which are changes of plane, and which are just detail.</p>
          <ul>
            <li>Outlines are heaviest: where the object meets the background, and where a part in front overlaps one behind. The side away from the light and the side touching the ground can be heavier still.</li>
            <li>
              Contour lines are medium: edges where two visible faces meet, such as where a box's top meets its side, or the front half of the ellipse on top of a cylinder. This is the drawing's “normal” weight, which every other
              line is judged against.
            </li>
            <li>Detail lines are thinnest: parting lines, buttons, openings, texture, and the construction lines you start with.</li>
          </ul>
          <p>Don't trace the whole outline at one heavy weight: if every line is heavy, none is. Draw the form in medium lines, add the details, and only then pick a few places to make heavier.</p>
        </>,
      ),
    },
    {
      heading: t("先定光源，再分明暗", "Fix the light first, then the values"),
      body: byLocale(
        <>
          <p>先定光源，常放在左上方、略靠前。之后每个面有多亮、影子落在哪里，都由它决定。明暗常分成这几层：</p>
          <ul>
            <li>亮面：正对光的地方。曲面上最亮的一小块是高光，是光源的倒影。</li>
            <li>灰面：开始转离光源，逐渐变暗。</li>
            <li>明暗交界线：亮部转入暗部处最暗的一带。它在暗面里靠近转折的位置，不在物体的边缘上。</li>
            <li>反光：暗面里靠近地面的边缘，被地面反射的光照亮一点。它只让暗面透气，再亮也要明显暗于亮面。</li>
            <li>投影：物体挡住光，落在地上的影子。贴近物体的地方最暗、最实，越远越淡、越虚。</li>
          </ul>
        </>,
        <>
          <p>Fix the light source first, usually above and to the left, slightly in front. From then on it decides how bright each face is and where every shadow falls. Values are usually split into these layers:</p>
          <ul>
            <li>Light: what faces the light. On a curved surface the brightest small patch is the highlight, a reflection of the light source.</li>
            <li>Halftone: where the surface starts turning away from the light and gradually darkens.</li>
            <li>Core shadow: the darkest band, where light turns into shadow. It sits inside the shadow side near the turn, not on the object's edge.</li>
            <li>Reflected light: the edge of the shadow side near the ground, lit a little by light bouncing off the ground. It only keeps the shadow from going flat; it must stay clearly darker than the lit side.</li>
            <li>Cast shadow: the shadow the object throws on the ground. Darkest and sharpest right next to the object, lighter and softer further away.</li>
          </ul>
        </>,
      ),
    },
    {
      heading: t("盒子和圆柱", "A box and a cylinder"),
      body: byLocale(
        <>
          <p>盒子由平面组成，一个面一个明度，面与面之间是硬的分界。光从左上方来：顶面最亮，左侧面是灰面，右侧面是暗面，暗面底部被地面反光提亮一点；投影从背光的底边伸出去。</p>
          <p>圆柱是曲面，明度连续过渡。竖着的圆柱上，高光是一条细长的竖带，在靠光的一侧；往右逐渐变暗，到明暗交界线最暗，最右边留一条窄窄的反光。顶面是平的，和盒子顶面一样只有一个明度。</p>
          <p>产品草图正是这样表达形体的：平面平涂一块灰，曲面画渐变，锐边处明度突变，大圆角处是一条宽的过渡。反过来，看明暗变化的快慢，就能读出是锐边还是大圆角。</p>
        </>,
        <>
          <p>
            A box is made of flat faces: one value per face, with hard boundaries between faces. With the light from the upper left, the top is lightest, the left side is the halftone, and the right side is in shadow, lifted a little near
            the bottom by light reflected from the ground; the cast shadow stretches out from the edges facing away from the light.
          </p>
          <p>
            A cylinder is curved, so its value changes continuously. On an upright cylinder the highlight is a narrow vertical strip on the side towards the light; the surface darkens to the right, reaches its darkest at the core shadow,
            and keeps a thin strip of reflected light at the far right edge. The top is flat, so like the box's top it has a single value.
          </p>
          <p>
            That's exactly how product sketches show form: a flat tone for flat faces, a gradient for curved ones, a sudden change of value at a sharp edge and a wide transition at a large fillet. Read it the other way round, and how
            quickly the value changes tells you whether you're looking at a sharp edge or a large radius.
          </p>
        </>,
      ),
    },
  ],
  figure: {
    Figure: () => (
      <Svg
        w={320}
        h={292}
        label={t(
          "光从左上方来。上图是一个盒子：顶面亮面，左侧灰面，右侧暗面，右后方有投影。下图是一个圆柱：从左到右依次是高光、灰面、明暗交界线、反光，右侧地上有投影",
          "Light from the upper left. Top: a box with a light top face, a halftone left side, a dark right side and a cast shadow behind it to the right. Bottom: a cylinder showing, from left to right, highlight, halftone, core shadow and reflected light, with a cast shadow on the ground to the right",
        )}
      >
        <rect x={0} y={0} width={320} height={292} rx={6} stroke="none" className={paper} />
        <g className="text-foreground dark:text-background">
          <defs>
            <linearGradient id="card-643-side" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity={0.58} />
              <stop offset="0.7" stopColor="currentColor" stopOpacity={0.54} />
              <stop offset="1" stopColor="currentColor" stopOpacity={0.4} />
            </linearGradient>
            <linearGradient id="card-643-cast" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="currentColor" stopOpacity={0.6} />
              <stop offset="1" stopColor="currentColor" stopOpacity={0.1} />
            </linearGradient>
            <linearGradient id="card-643-cyl" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="currentColor" stopOpacity={0.2} />
              <stop offset="0.14" stopColor="currentColor" stopOpacity={0.06} />
              <stop offset="0.25" stopColor="currentColor" stopOpacity={0} />
              <stop offset="0.33" stopColor="currentColor" stopOpacity={0.04} />
              <stop offset="0.56" stopColor="currentColor" stopOpacity={0.22} />
              <stop offset="0.78" stopColor="currentColor" stopOpacity={0.62} />
              <stop offset="0.9" stopColor="currentColor" stopOpacity={0.46} />
              <stop offset="0.97" stopColor="currentColor" stopOpacity={0.36} />
              <stop offset="1" stopColor="currentColor" stopOpacity={0.42} />
            </linearGradient>
          </defs>

          {/* 光源 */}
          <circle cx={14} cy={14} r={5} {...tone(0.15)} />
          <circle cx={14} cy={14} r={5} />
          <path d="M 14 3 V 6 M 14 22 V 25 M 3 14 H 6 M 22 14 H 25 M 6.2 6.2 L 8.3 8.3 M 19.7 19.7 L 21.8 21.8 M 21.8 6.2 L 19.7 8.3 M 6.2 21.8 L 8.3 19.7" />
          <T x={30} y={18}>
            {t("光源", "Light")}
          </T>

          {/* 盒子：投影、三个面，然后三种线 */}
          <path d="M 66 122 L 96 116 L 131 96 L 93 74 L 63 80 Z" fill="url(#card-643-cast)" stroke="none" />
          <path d="M 28 50 L 63 30 L 101 52 L 101 102 L 66 122 L 28 100 Z" stroke="none" className={paper} />
          <path d="M 28 50 L 66 72 L 101 52 L 63 30 Z" {...tone(0.03)} />
          <path d="M 28 100 L 66 122 L 66 72 L 28 50 Z" {...tone(0.16)} />
          <path d="M 66 122 L 101 102 L 101 52 L 66 72 Z" fill="url(#card-643-side)" stroke="none" />
          <path d="M 28 50 L 63 30 L 101 52 L 101 102 L 66 122 L 28 100 Z" strokeWidth={2.4} />
          <path d="M 28 50 L 66 72 L 101 52 M 66 72 V 122" strokeWidth={1.4} />
          <path d="M 28 70 L 66 92 L 101 72" strokeWidth={0.75} />

          {leader(142, 36, 68, 50)}
          <T x={146} y={40}>
            {t("亮面", "Light")}
          </T>
          {leader(142, 72, 90, 84)}
          <T x={146} y={76}>
            {t("暗面", "Shadow side")}
          </T>
          {leader(142, 114, 112, 104)}
          <T x={146} y={118}>
            {t("投影", "Cast shadow")}
          </T>
          {leader(24, 135, 42, 104)}
          <T x={6} y={148}>
            {t("灰面", "Halftone")}
          </T>

          {/* 圆柱：投影、柱身、顶面，然后三种线 */}
          <path d="M 28 262 L 68 254 A 34 10 0 0 1 136 254 L 96 262 A 34 10 0 0 1 28 262 Z" fill="url(#card-643-cast)" stroke="none" />
          <path d="M 28 184 A 34 10 0 0 1 96 184 V 262 A 34 10 0 0 1 28 262 Z" stroke="none" className={paper} />
          <path d="M 28 184 V 262 A 34 10 0 0 0 96 262 V 184 Z" fill="url(#card-643-cyl)" stroke="none" />
          <ellipse cx={62} cy={184} rx={34} ry={10} stroke="none" className={paper} />
          <ellipse cx={62} cy={184} rx={34} ry={10} {...tone(0.05)} />
          <path d="M 28 184 A 34 10 0 0 1 96 184 V 262 A 34 10 0 0 1 28 262 Z" strokeWidth={2.4} />
          <path d="M 28 184 A 34 10 0 0 0 96 184" strokeWidth={1.4} />
          <path d="M 28 204 A 34 10 0 0 0 96 204" strokeWidth={0.75} />

          {leader(142, 196, 46, 212)}
          <T x={146} y={200}>
            {t("高光", "Highlight")}
          </T>
          {leader(142, 214, 66, 224)}
          <T x={146} y={218}>
            {t("灰面", "Halftone")}
          </T>
          {leader(142, 232, 84, 236)}
          <T x={146} y={236}>
            {t("明暗交界线", "Core shadow")}
          </T>
          {leader(142, 250, 94, 248)}
          <T x={146} y={254}>
            {t("反光", "Reflected light")}
          </T>
          {leader(142, 272, 120, 259)}
          <T x={146} y={276}>
            {t("投影", "Cast shadow")}
          </T>
        </g>
      </Svg>
    ),
    caption: t(
      "光从左上方来。盒子一面一个明度，圆柱的明度连续过渡。两个物体的外轮廓用粗线，面与面的交线用中等线，腰上的分模线用细线。",
      "Light from the upper left. The box has one value per face; the cylinder's value changes continuously. Both objects' outlines use heavy lines, the edges between faces medium lines, and the parting line around the middle a thin one.",
    ),
    after: 1,
  },
  terms: {},
  quiz: [
    {
      q: t("草图里哪种线应该最粗？", "Which lines should be heaviest in a sketch?"),
      options: byLocale(
        ["所有可见的边，一样粗才整齐", "外轮廓线，尤其是背光一侧和前后零件重叠的地方", "分模线和按键这些细节线，因为它们最重要"],
        ["Every visible edge, at one weight for neatness", "The outline, especially on the side away from the light and where parts overlap", "Detail lines such as parting lines and buttons, because they matter most"],
      ),
      answer: 1,
      explain: t(
        "粗细要分层才能表达前后和体积。外轮廓把物体从背景里分出来，所以最粗；面与面的交线中等；细节最细。全都一样粗，图就变平了。",
        "Weights only show depth and volume if they're layered. The outline separates the object from the background, so it's heaviest; edges between faces are medium; details are thinnest. Draw everything at one weight and the sketch goes flat.",
      ),
    },
    {
      q: t("光从左上方来，竖着的圆柱上最暗的一带在哪里？", "With the light from the upper left, where is the darkest band on an upright cylinder?"),
      options: byLocale(
        ["最右边的轮廓上", "暗面里靠近明暗转折的地方，最右边还留着一条反光", "圆柱正中间"],
        ["On the right-hand outline", "Inside the shadow side near the turn from light to dark, with a strip of reflected light still at the far right", "Down the middle of the cylinder"],
      ),
      answer: 1,
      explain: t(
        "明暗交界线在亮部转入暗部的地方，最暗。再往右，暗面靠近地面和周围物体，会被反射光提亮一点，所以最右边的轮廓并不是最暗的。",
        "The core shadow sits where the light side turns into the shadow side, and it's the darkest. Further right, the shadow side picks up a little light reflected from the ground and nearby objects, so the right-hand outline isn't the darkest part.",
      ),
    },
    {
      q: t("一个零件的两个面之间，草图上明暗是突然变化的。这说明什么？", "In a sketch, the value changes abruptly between two faces of a part. What does that tell you?"),
      options: byLocale(
        ["两个面之间是锐边或很小的圆角", "两个面之间是一个很大的圆角", "画错了，明暗总是渐变的"],
        ["The faces meet at a sharp edge or a very small fillet", "The faces meet in a very large fillet", "It's a mistake: values always change gradually"],
      ),
      answer: 0,
      explain: t(
        "平面一面一个明度，锐边处明度突变。大圆角是曲面，明度会在一条宽带里逐渐过渡。看明暗变化的快慢，就能读出圆角的大小。",
        "Flat faces each have one value, and the value jumps at a sharp edge. A large fillet is curved, so the value shifts gradually across a wide band. How quickly the value changes tells you how large the fillet is.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "线分三层：外轮廓最粗，面与面的交线中等，细节和辅助线最细；只在少数地方加粗",
      "先定光源，再按亮面、灰面、明暗交界线、反光、投影分层；反光再亮也要暗于亮面",
      "平面一面一个明度，曲面明度渐变；明暗变化的快慢说明是锐边还是大圆角",
    ],
    [
      "Lines come in three weights: outlines heaviest, edges between faces medium, details and construction lines thinnest; add extra weight only in a few places",
      "Fix the light first, then layer the values: light, halftone, core shadow, reflected light, cast shadow; reflected light always stays darker than the lit side",
      "Flat faces take one value each, curved faces a gradient; how fast the value changes shows a sharp edge or a large radius",
    ],
  ),
  sources: [
    { title: "Line Weight In Design Sketching", publisher: "MAGES Institute", url: "https://mages.edu.sg/blog/line-weight-in-design-sketching/" },
    {
      title: "How to Apply Line Weight in Product Design Sketching",
      publisher: "The Design Sketchbook",
      url: "https://www.thedesignsketchbook.com/how-to-draw-line-weight-industrial-design-sketching/",
    },
    { title: "Shading 3D Forms", publisher: "Julianna Kunstler", url: "https://juliannakunstler.com/shading-forms" },
    { title: "ART 110 Week 6: Light & Shadow", publisher: "Brigham Young University–Idaho", url: "https://courses.byui.edu/art110_new/art110/week06/_contents_lightshadow.html" },
  ],
  related: { lessons: ["fillet-chamfer", "zebra-stripes"] },
}

export default card
