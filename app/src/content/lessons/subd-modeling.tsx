import { Box, Eraser, MoveUp, RotateCcw, Shapes } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { SubdScene, type SubdState } from "./subd-modeling.scene"
import type { LessonDef, StepCtx } from "./types"

/** 5.5.1 · 5.5.2 「SubD、T-Splines、Fusion 造型推拉；SubD 转 NURBS」. */
type Ctx = StepCtx<SubdState, SubdScene>

function Level({ s, c }: Ctx) {
  const faces = c.stats().faces * 4 ** s.level
  return (
    <>
      <ParamSlider className="mt-3 px-0" label={t("细分级别", "Subdivision level")} unit="" value={s.level} min={0} max={3} step={1} onChange={(v) => c.setLevel(v)} />
      <div className="mt-1">
        <Readout label={t("控制笼", "Cage")} value={c.stats().faces} unit={t("个面", "faces")} />
        <Readout label={t("细分后", "Subdivided")} value={faces} unit={t("个面", "faces")} />
      </div>
    </>
  )
}

function ZebraToggle({ s, c }: Ctx) {
  return (
    <label className="mt-3 flex items-center gap-2 text-small">
      <Switch checked={s.zebra} onCheckedChange={(v) => c.setZebra(v)} />
      {t("斑马纹", "Zebra stripes")}
    </label>
  )
}

function Stars({ c }: { c: SubdScene }) {
  const st = c.stats()
  return (
    <div className="mt-3 rounded-md bg-sunken px-3 py-2">
      <Readout label={t("星形点", "Star points")} value={st.starTotal} />
      {st.stars.map((x) => (
        <Readout key={x.valence} label={t(`${x.valence} 价`, `valence ${x.valence}`)} value={x.count} />
      ))}
    </div>
  )
}

const lesson: LessonDef<SubdState, SubdScene> = {
  id: "subd-modeling",
  codes: ["5.5.1", "5.5.2"],
  title: t("SubD、T-Splines、Fusion 造型推拉；SubD 转 NURBS", "SubD, T-Splines and Fusion Form push-pull; SubD to NURBS"),
  create: (v, emit) => new SubdScene(v, emit),
  steps: [
    {
      title: t("控制笼和极限曲面", "The control cage and the limit surface"),
      body: byLocale(
        <>
          <p>SubD 从一个粗糙的多边形网格出发，这个网格叫控制笼。每细分一次，每个四边形分成四个，新点取周围点的加权平均（Catmull–Clark 规则），网格越来越密、越来越圆。</p>
          <p>细分无穷多次，得到一张光滑的极限曲面，它总在控制笼里面。每个顶点都连着 4 条边的规则区域里，极限曲面就是双三次 B 样条曲面，曲率连续。</p>
        </>,
        <>
          <p>
            SubD starts from a coarse polygon mesh called the control cage. Each subdivision splits every quad into four and places the new points at weighted averages of their
            neighbours (the Catmull–Clark rules), so the mesh gets denser and rounder.
          </p>
          <p>
            Subdivided infinitely, it becomes a smooth limit surface that always lies inside the cage. In regular regions, where every vertex has four edges, the limit surface is
            exactly a bicubic B-spline surface, curvature-continuous.
          </p>
        </>,
      ),
      task: { label: t("把细分级别拉到 3", "Drag the subdivision level up to 3"), done: (s) => s.level >= 3 },
      extra: (ctx) => <Level {...ctx} />,
    },
    {
      title: t("推拉：选面、拉伸、移动", "Push and pull: select, extrude, move"),
      body: byLocale(
        <>
          <p>SubD 不画草图，而是推拉控制笼。点一个面选中它：「拉伸面」把它推出去一节，多出四个侧面；拖动面上的圆点，沿法向移动它。</p>
          <p>试着做个把手：顶面往上拉，再把侧面往一边拉两三节，最后把末端的底面往下拉。控制笼才几十个面，形体就出来了，这就是 SubD 快的原因。</p>
        </>,
        <>
          <p>SubD doesn't start from sketches; you push and pull the cage. Click a face to select it. Extrude face pushes it out one segment, adding four side faces; drag the dot on the face to move it along its normal.</p>
          <p>Try a handle: pull the top up, pull a side face out two or three segments, then pull the end's bottom face down. The cage has only a few dozen faces, yet the form is there. That's why SubD is fast.</p>
        </>,
      ),
      task: { label: t("拉伸两次以上，再拖动一次面", "Extrude at least twice, then drag a face"), done: (s) => s.extrusions >= 2 && s.moved },
      extra: (ctx) => (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" disabled={ctx.s.selected === null} onClick={() => ctx.c.extrudeSelected(10)}>
              <MoveUp />
              {t("拉伸面", "Extrude face")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => ctx.c.resetCage()}>
              <RotateCcw />
              {t("重新开始", "Start over")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => ctx.c.useExample()}>
              <Shapes />
              {t("看示例把手", "Show the example")}
            </Button>
          </div>
          {ctx.s.selected === null && <Hint>{t("先在视图里点一个面。", "Click a face in the view first.")}</Hint>}
          <Level {...ctx} />
        </>
      ),
      note: t(
        "Fusion 在「创建造型」里用 T 样条，「编辑形状」就是推拉，「完成造型」后变成实体；Rhino 从 7 开始有 SubD；Blender 用「表面细分」修改器。几家的细分规则、折痕和转换都不完全一样。",
        "Fusion uses T-Splines in Create Form, where Edit Form is the push-pull and Finish Form turns the body into a solid; Rhino has had SubD since Rhino 7; Blender uses the Subdivision Surface modifier. Their subdivision rules, creases and conversions aren't all the same.",
      ),
      noteTitle: t("各软件", "In each package"),
    },
    {
      title: t("折痕：做出一条硬边", "Creases: a crisp edge"),
      body: byLocale(
        <>
          <p>细分默认处处光滑。想要一条利落的线，比如分模线或按键的边，就给控制笼的边加折痕：细分时这条边按尖锐规则算，不再被平均掉。</p>
          <p>点控制笼上的边（细的亮色线），加上或去掉折痕。如果上一步没拉出分叉的把手，这里换成了一个示例把手。</p>
        </>,
        <>
          <p>By default, subdivision smooths everything. For a crisp line, such as a parting line or the edge of a button, crease edges of the cage: subdivision then treats them with sharp rules instead of averaging them away.</p>
          <p>Click edges of the cage (the thin bright lines) to add or remove a crease. If you didn't pull out a branching handle in the last step, an example handle has been loaded here.</p>
        </>,
      ),
      task: { label: t("给至少一条边加折痕", "Crease at least one edge"), done: (s) => s.creases >= 1 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex items-center">
            <Readout label={t("折痕边", "Creased edges")} value={s.creases} />
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => c.clearCreases()}>
              <Eraser />
              {t("清除折痕", "Clear creases")}
            </Button>
          </div>
        </>
      ),
      note: t(
        "Fusion 造型里叫「锐化」，Rhino 的 SubD 用 Crease，Blender 叫边线折痕（Edge Crease），可以取 0 到 1 之间的值做半硬的边。以各自帮助为准。",
        "Fusion's Form calls it Crease, Rhino's SubD uses Crease, and Blender has Edge Crease, which can take values between 0 and 1 for semi-sharp edges. Check each package's help for details.",
      ),
      noteTitle: t("各软件", "In each package"),
    },
    {
      title: t("星形点", "Star points"),
      body: byLocale(
        <>
          <p>顶点连着几条边，叫它的价。规则顶点是 4 价；盒子的角是 3 价，拉伸分叉的地方会出现 5 价。不是 4 价的点叫星形点（奇异点），标成了橙色圆点。</p>
          <p>星形点处的极限曲面只有 G1：切平面连续，曲率一般不连续，斑马纹在那里会轻轻扭一下。做造型时，把星形点放在平缓、不显眼的地方，别放在高光带上，也别放在要倒圆角或分模的地方。</p>
        </>,
        <>
          <p>The number of edges at a vertex is its valence. A regular vertex has valence 4; a box corner has 3, and where an extrusion branches off you get 5. Vertices that aren't valence 4 are star points (extraordinary vertices), shown as orange dots.</p>
          <p>
            At a star point the limit surface is only G1: the tangent plane is continuous, but the curvature generally isn't, and the zebra stripes give a small twist there. When
            modelling, put star points in gentle, inconspicuous areas, away from highlights and from places that will be filleted or split.
          </p>
        </>,
      ),
      task: { label: t("在曲面上点一个星形点", "Click a star point on the surface"), done: (s) => s.foundStar },
      extra: (ctx) => (
        <>
          <ZebraToggle {...ctx} />
          <Stars c={ctx.c} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => ctx.c.useExample()}>
            <Shapes />
            {t("看示例把手", "Show the example")}
          </Button>
        </>
      ),
    },
    {
      title: t("转成 NURBS，回到工程流程", "Convert to NURBS and hand back to engineering"),
      body: byLocale(
        <>
          <p>抽壳、圆角、拔模和出图都要 NURBS 实体。转换时，每个控制笼的面变成一张四边的 NURBS 面片；有的工具会把规则的一片区域合成一张大面。</p>
          <p>规则区域转出来是 G2。挨着星形点的面片只能近似：通常做到 G1，或用更高阶的面换 G2，代价是可能鼓个小包。转完先看这些面片的斑马纹，后面的圆角和抽壳别正好落在那里。</p>
        </>,
        <>
          <p>Shells, fillets, draft and drawings all need a NURBS solid. In the conversion, each face of the cage becomes one four-sided NURBS patch; some tools merge a regular region into one larger surface.</p>
          <p>
            Regular regions convert to G2. Patches next to a star point can only be approximated: usually to G1, or to G2 with higher-degree surfaces, at the risk of small bumps. Check
            the zebra stripes on those patches first, and keep later fillets and shells from landing right on them.
          </p>
        </>,
      ),
      task: { label: t("转成 NURBS，看看面片和星形点", "Convert to NURBS and look at the patches and star points"), done: (s) => s.converted },
      extra: (ctx) => {
        const st = ctx.c.stats()
        return (
          <>
            <Predict
              question={t("转成 NURBS 后，哪里最难做到 G2？", "After conversion to NURBS, where is G2 hardest to achieve?")}
              options={byLocale(
                ["所有面片之间都一样", "星形点周围的那几张面片", "离星形点最远的面片"],
                ["It's the same between all patches", "The patches around the star points", "The patches furthest from the star points"],
              )}
              answer={1}
              explain={t(
                "规则区域的极限曲面本来就是双三次 B 样条，能原样转成 NURBS。星形点周围没有精确的四边 NURBS 表示，只能近似，连续性要打折扣。",
                "In regular regions the limit surface already is a bicubic B-spline, so it converts to NURBS exactly. Around a star point there's no exact four-sided NURBS representation, so it can only be approximated and the continuity suffers.",
              )}
              onReveal={() => ctx.c.convert()}
            />
            <Button size="sm" variant={ctx.s.converted ? "secondary" : "primary"} className="mt-3" onClick={() => ctx.c.convert()}>
              <Box />
              {t("转为 NURBS", "Convert to NURBS")}
            </Button>
            {ctx.s.converted && (
              <div className="mt-3 rounded-md bg-sunken px-3 py-2">
                <Readout label={t("NURBS 面片", "NURBS patches")} value={st.faces} />
                <Readout label={t("挨着星形点的", "Touching a star point")} value={st.starFaces} tone="warning" />
                <Readout label={t("星形点", "Star points")} value={st.starTotal} />
              </div>
            )}
          </>
        )
      },
      note: t(
        "Rhino 的 ToNURBS 可以把规则区域合成大面（Packed），也可以每个面一张（Unpacked），星形点处的连续性也有 G1、G2 等选项；Fusion「完成造型」后得到实体；Blender 的细分网格多用于渲染和动画，本身不出工程用的 NURBS。",
        "Rhino's ToNURBS can pack regular regions into larger surfaces or make one surface per face, and offers G1, G2 and other options at star points; Fusion's Finish Form gives you a solid; Blender's subdivision meshes are mostly for rendering and animation and don't produce engineering NURBS on their own.",
      ),
      noteTitle: t("各软件怎么转", "How each package converts"),
    },
  ],
  quiz: [
    {
      q: t("SubD 建模的核心操作是？", "What is the core operation of SubD modelling?"),
      options: byLocale(
        ["画精确的草图，再拉伸", "推拉一个粗的控制笼，让细分算出光滑曲面", "一个个调整 NURBS 曲面的控制点"],
        ["Draw an exact sketch, then extrude it", "Push and pull a coarse control cage and let subdivision work out the smooth surface", "Adjust the control points of NURBS surfaces one by one"],
      ),
      answer: 1,
      explain: t(
        "SubD 改的是控制笼：几十个面就能定出整个形体，细分负责光顺。它快，但不精确到尺寸，所以最后要转回 NURBS 交给工程。",
        "In SubD you edit the cage: a few dozen faces define the whole form and subdivision takes care of smoothness. It's fast but not dimensionally exact, which is why it ends up converted back to NURBS for engineering.",
      ),
    },
    {
      q: t("下面哪种顶点是星形点？", "Which kind of vertex is a star point?"),
      options: byLocale(["连着 4 条边的点", "连着 3 条或 5 条边的点", "折痕线上的点"], ["One with 4 edges", "One with 3 or 5 edges", "One on a creased edge"]),
      answer: 1,
      explain: t(
        "价不等于 4 的点就是星形点（奇异点），那里极限曲面只有 G1。折痕上的点是另一回事：它们是故意做出的硬边。",
        "A vertex whose valence isn't 4 is a star point (extraordinary vertex), where the limit surface is only G1. Points on a crease are a different matter: they're a deliberate sharp edge.",
      ),
    },
    {
      q: t("SubD 转成 NURBS 交给工程前，最该先检查哪里？", "Before handing a SubD model converted to NURBS to engineering, what should you check first?"),
      options: byLocale(
        ["规则区域的面片接缝，那里最容易断开", "星形点周围的面片：连续性和斑马纹，后续圆角、抽壳别落在那里", "面片数是不是越少越好"],
        [
          "The seams between patches in regular regions; that's where things break",
          "The patches around star points: their continuity and zebra stripes, and keep later fillets and shells off them",
          "Whether the patch count is as low as possible",
        ],
      ),
      answer: 1,
      explain: t(
        "规则区域转出来本来就是 G2；星形点周围只能近似，是连续性最差、最容易让后续特征失败的地方。面片多少本身不是问题。",
        "Regular regions convert to G2 as they are; around star points the surface can only be approximated, so that's where continuity is weakest and later features most likely to fail. The patch count itself isn't the issue.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "SubD 推拉粗的控制笼，细分算出光滑的极限曲面，适合快速做有机形体",
      "4 价是规则点；星形点处只有 G1，放在平缓、不显眼的地方；硬边用折痕",
      "转 NURBS 时每个笼面变一张面片，星形点周围先检查再交给工程；各软件的做法不同",
    ],
    [
      "SubD pushes and pulls a coarse control cage and subdivision works out a smooth limit surface: quick for organic forms",
      "Valence 4 is regular; star points are only G1, so put them somewhere gentle and out of sight; use creases for crisp edges",
      "Converting to NURBS turns each cage face into a patch; check the patches around star points before handing over. Packages differ in how they do it",
    ],
  ),
  next: {
    to: "/lesson/shell-split",
    label: t("外观件拆件与结构化", "Splitting a styled shell into parts"),
    text: t("造型转成 NURBS 之后，下一步是把一体的外观拆成能制造的零件。", "Once the form is NURBS, the next step is to split the one-piece exterior into parts that can be made."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>{t(`细分 ${s.level} 级`, `Level ${s.level}`)}</SceneChip>
      {s.zebra && <SceneChip>{t("斑马纹", "Zebra")}</SceneChip>}
      {s.converted && <SceneChip tone="primary">NURBS</SceneChip>}
    </div>
  ),
}

export default lesson
