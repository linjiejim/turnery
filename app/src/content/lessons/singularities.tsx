import type { ReactNode } from "react"
import { Eye } from "lucide-react"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import type { Shape } from "./singularities.geom"
import { SingScene, type CornerTopo, type Display, type SingState, type Topo } from "./singularities.scene"
import type { LessonDef, StepCtx } from "./types"

/** 5.4.2 「四边面、奇点与收敛点的处理」. */
type Ctx = StepCtx<SingState, SingScene>

const DISPLAY_LABEL: Record<Display, string> = { shade: t("着色", "Shaded"), iso: t("等参线", "Isoparms"), zebra: t("斑马纹", "Zebra") }
const TOPO_LABEL: Record<Topo, string> = { pole: t("收敛到极点", "Pole"), quad: t("四边面剪裁", "Trimmed four-sided") }
const CORNER_LABEL: Record<CornerTopo, string> = { tri: t("三边面", "Three-sided"), split: t("三块四边面", "Three quads"), trim: t("四边面剪裁", "Trimmed quad") }

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="w-12 shrink-0 text-small font-medium">{label}</span>
      {children}
    </div>
  )
}

function DisplaySwitch({ s, c }: Ctx) {
  return (
    <Row label={t("显示", "Display")}>
      <Segmented size="sm" aria-label={t("显示", "Display")} value={s.display} onValueChange={(d: Display) => c.setDisplay(d)} options={(["shade", "iso", "zebra"] as Display[]).map((d) => ({ value: d, label: DISPLAY_LABEL[d] }))} />
    </Row>
  )
}

function TopoSwitch({ s, c }: Ctx) {
  return (
    <Row label={t("顶面", "Top")}>
      <Segmented size="sm" aria-label={t("顶面做法", "How the top is built")} value={s.topo} onValueChange={(v: Topo) => c.setTopo(v)} options={(["pole", "quad"] as Topo[]).map((v) => ({ value: v, label: TOPO_LABEL[v] }))} />
    </Row>
  )
}

function ShapeSwitch({ s, c }: Ctx) {
  return (
    <Row label={t("形状", "Shape")}>
      <Segmented
        size="sm"
        aria-label={t("形状", "Shape")}
        value={s.shape}
        onValueChange={(v: Shape) => c.setShape(v)}
        options={[
          { value: "round", label: t("圆形（回转体）", "Round (revolved)") },
          { value: "square", label: t("方圆形", "Rounded square") },
        ]}
      />
    </Row>
  )
}

const lesson: LessonDef<SingState, SingScene> = {
  id: "singularities",
  codes: ["5.4.2"],
  title: t("四边面、奇点与收敛点的处理", "Four-sided patches, poles and singular points"),
  create: (v, emit) => new SingScene(v, emit),
  steps: [
    {
      title: t("收敛到一点", "Collapsing to a point"),
      body: byLocale(
        <>
          <p>这个圆顶是一张面：一圈经线从边缘一路放样到顶点。NURBS 面本来有四条边，这里有一整条边缩成了顶上的一个点，这个点叫极点，也叫收敛点或奇点。</p>
          <p>看等参线：绕圈的那一组越往上越小，经线那一组全挤进同一个点。</p>
        </>,
        <>
          <p>
            This dome is a single surface: a ring of meridian curves lofted from the edge all the way up to the top. A NURBS surface has four edges; here one whole edge has shrunk
            into a single point at the top. That point is called a pole, also a collapsed or singular point.
          </p>
          <p>Look at the isoparms: the ones running round get smaller and smaller towards the top, and all the meridians crowd into the same point.</p>
        </>,
      ),
      task: { label: t("在视图里点出等参线收敛的那一点", "Click the point where the isoparms converge"), done: (s) => s.clickedPole },
      extra: (ctx) => <DisplaySwitch {...ctx} />,
    },
    {
      title: t("用斑马纹找毛病", "Find the flaw with zebra stripes"),
      body: byLocale(
        <>
          <p>极点附近，每条经线带着自己的方向和弯曲挤进同一个点，那里的法向和曲率说不清。</p>
          <p>再切到四边面：同一个圆顶，用一张规则的四边面铺在上面，再按轮廓剪裁。等参线平行、不收敛，条纹顺顺地流过顶部。</p>
        </>,
        <>
          <p>Near the pole, every meridian squeezes into the same point with its own direction and its own bend, so the normal and the curvature there are ill-defined.</p>
          <p>Now switch to the four-sided version: the same dome, made as one regular four-sided surface laid over the top and trimmed by the outline. The isoparms run parallel and never converge, and the stripes flow evenly over the top.</p>
        </>,
      ),
      task: { label: t("在斑马纹下两种做法都看一遍", "Look at both versions with zebra stripes"), done: (s) => s.zebraPole && s.zebraQuad },
      extra: (ctx) => (
        <>
          <Predict
            question={t("方圆形的圆顶收敛到极点。极点附近的斑马纹会怎样？", "This rounded-square dome collapses to a pole. What do the zebra stripes do near the pole?")}
            options={byLocale(["和别处一样顺", "条纹在极点处拧成一团，有个小尖", "条纹在极点处断开成两截"], ["The same as everywhere else", "They twist into a knot at the pole, with a little point", "They break into two at the pole"])}
            answer={1}
            explain={t(
              "极点处的切平面和曲率由极点旁那一圈控制点决定。经线长短不一、各弯各的，这一圈不在同一个平面上，反光就在那里拧起来、起个尖。",
              "The tangent plane and curvature at a pole are set by the ring of control points next to it. With meridians of different lengths, each bending its own way, that ring isn't in one plane, so the reflections twist and come to a point there.",
            )}
            onReveal={() => ctx.c.setDisplay("zebra")}
          />
          <TopoSwitch {...ctx} />
          <DisplaySwitch {...ctx} />
        </>
      ),
    },
    {
      title: t("回转体上的极点没问题", "A pole on a revolved shape is fine"),
      body: byLocale(
        <>
          <p>换成圆形。圆顶成了回转体：每条经线一模一样，极点正好在旋转轴上，旁边那一圈控制点在同一个平面上、均匀分布。条纹成了同心圆，没有毛病。</p>
          <p>所以球、回转件的顶点上，极点可以放心用：旋转命令本来就会在轴上生成极点。</p>
        </>,
        <>
          <p>
            Switch to round. The dome is now a revolved shape: every meridian is identical, the pole sits exactly on the axis of revolution, and the ring of control points next to it
            lies in one plane, evenly spaced. The stripes become concentric circles, with no flaw.
          </p>
          <p>So on spheres and at the tips of revolved parts, poles are safe to use: a revolve creates a pole on the axis anyway.</p>
        </>,
      ),
      task: { label: t("在斑马纹下看圆形的极点", "Look at the round dome's pole with zebra stripes"), done: (s) => s.roundPole },
      extra: (ctx) => (
        <>
          <ShapeSwitch {...ctx} />
          <TopoSwitch {...ctx} />
          <DisplaySwitch {...ctx} />
        </>
      ),
      terms: ["revolve"],
    },
    {
      title: t("极点旁那一圈控制点", "The ring of control points next to the pole"),
      body: byLocale(
        <>
          <p>回到方圆形。亮色线连着极点旁的一圈控制点，它们决定极点处的切平面。各条经线长短不一，这一圈就高低不平，极点被拉出一个小尖。</p>
          <p>把这一圈压平：尖折消失了，可条纹还是有点拧。形状不是回转体，极点处的曲率本来就说不清。</p>
          <p>修法：能换四边面就换。非留极点不可，就让这一圈控制点共面、均匀，并把极点放在平缓、不显眼的地方。</p>
        </>,
        <>
          <p>Back to the rounded square. The bright line joins the ring of control points next to the pole; they set the tangent plane at the pole. The meridians have different lengths, so the ring is uneven and the pole gets pulled into a little point.</p>
          <p>Flatten the ring: the crease goes, but the stripes still twist a little. The shape isn't revolved, so the curvature at the pole is ill-defined to begin with.</p>
          <p>Fixes: switch to a four-sided patch where you can. If you really must keep a pole, keep that ring of control points coplanar and evenly spread, and put the pole somewhere gentle and out of sight.</p>
        </>,
      ),
      task: { label: t("把这一圈控制点压平", "Flatten the ring of control points"), done: (s) => s.flattened },
      extra: ({ s, c }) => (
        <>
          <ParamSlider
            className="mt-3 px-0"
            label={t("这一圈的高低差", "Height difference around the ring")}
            value={s.eps}
            min={0}
            max={3}
            step={0.1}
            onChange={(v) => c.setEps(v)}
            hint={t("0 表示这一圈在同一个水平面上。", "0 means the whole ring lies in one horizontal plane.")}
          />
          <DisplaySwitch s={s} c={c} />
        </>
      ),
      note: t(
        "这是简化演示：每条经线只有四个控制点，第三个点代表极点旁那一圈。真实曲面的控制网更密，道理一样。",
        "This is a simplified demonstration: each meridian has only four control points, and the third stands for the ring next to the pole. A real surface has a denser control net, but the principle is the same.",
      ),
      noteTitle: t("关于这个演示", "About this demo"),
    },
    {
      title: t("三边面：一条边缩成一点", "Three-sided patches: an edge shrunk to a point"),
      body: byLocale(
        <>
          <p>盒子的角上，三条大小不同的圆角相遇，中间要补一块三边的角片。省事的做法是把四边面的一条边缩成一点，做成三边面：等参线全挤到退化点，退化点旁那排控制点又很难共面，斑马纹在那里起尖。</p>
          <p>常用修法：分成三块四边面，在中间相交；或者用一张更大的四边面盖过去，再按三条边剪裁。退化点上，偏移、抽壳和倒圆角也最容易失败。</p>
        </>,
        <>
          <p>
            At the corner of a box, three rounded edges of different sizes meet, and a three-sided corner patch has to fill the gap. The quick way is to shrink one edge of a four-sided
            patch to a point: the isoparms all crowd into the degenerate point, the row of control points next to it rarely stays in one plane, and the zebra stripes come to a point
            there.
          </p>
          <p>
            Common fixes: split it into three four-sided patches that meet in the middle, or lay one larger four-sided patch over it and trim it to the three edges. Degenerate points are
            also where offsets, shells and fillets most often fail.
          </p>
        </>,
      ),
      task: {
        label: t("在三边面上点出退化点，再看看两种修法", "Click the degenerate point on the three-sided patch, then look at both fixes"),
        done: (s) => s.foundPoint && s.seenSplit && s.seenTrim,
      },
      extra: (ctx) => (
        <>
          <Row label={t("角片", "Corner")}>
            <Segmented
              size="sm"
              aria-label={t("角片做法", "How the corner is built")}
              value={ctx.s.corner}
              onValueChange={(v: CornerTopo) => ctx.c.setCorner(v)}
              options={(["tri", "split", "trim"] as CornerTopo[]).map((v) => ({ value: v, label: CORNER_LABEL[v] }))}
            />
          </Row>
          <DisplaySwitch {...ctx} />
          {ctx.s.corner === "split" && (
            <Hint>
              {t(
                "三块相交的中点也是个特殊点：三条边汇在一起，和 SubD 的星形点一样，那里通常只能做到 G1。但每一块都是规则的四边面，比退化点好控制得多。",
                "The middle, where three patches meet, is a special point too: three edges meet there, just like a SubD star point, and it's usually only G1. But each patch is a regular four-sided surface, which is far easier to control than a degenerate point.",
              )}
            </Hint>
          )}
        </>
      ),
      note: t(
        "很多软件用三条边界线建面时，会自动把第四条边缩成一点；建完用等参线显示看一眼，就知道有没有退化点。",
        "Many packages quietly shrink the fourth edge to a point when you build a surface from three boundary curves. Turn on the isoparms afterwards and you'll see at once whether there's a degenerate point.",
      ),
    },
  ],
  quiz: [
    {
      q: t("圆顶的等参线全部汇到顶上一点。这一点叫什么，什么情况下可以放心用？", "All the isoparms of a dome meet at one point on top. What is that point, and when is it safe to use?"),
      options: byLocale(
        ["极点（收敛点）；在回转体的旋转轴上、各条经线一样时", "边界点；任何时候都没问题", "控制点；把显示精度调高就行"],
        ["A pole (a collapsed point); on the axis of a revolved shape, where every meridian is the same", "A boundary point; it's always fine", "A control point; just raise the display quality"],
      ),
      answer: 0,
      explain: t(
        "回转体上，极点旁那一圈控制点天然共面、均匀，极点处光顺。自由造型上很难做到，极点就会拧、起尖。",
        "On a revolved shape, the ring of control points next to the pole is naturally coplanar and evenly spread, so the pole is smooth. On a free-form shape that's hard to achieve, and the pole twists or comes to a point.",
      ),
    },
    {
      q: t("方圆形的顶盖做成极点，斑马纹在顶上拧成一团。最常用的修法是？", "A rounded-square lid has a pole on top, and the zebra stripes twist into a knot there. What's the usual fix?"),
      options: byLocale(["把显示网格调细", "顶部改用一张四边面，再按轮廓剪裁", "在极点上再倒个圆角盖住"], ["Make the display mesh finer", "Make the top one four-sided patch and trim it by the outline", "Put a fillet over the pole to hide it"]),
      answer: 1,
      explain: t(
        "毛病在面本身的结构上，不在显示精度。换成四边面，等参线不再收敛，法向和曲率处处有定义；在奇点上倒圆角反而最容易失败。",
        "The flaw is in the structure of the surface, not the display quality. With a four-sided patch the isoparms no longer converge, and the normal and curvature are defined everywhere. A fillet on a singular point is one of the things most likely to fail.",
      ),
    },
    {
      q: t("三条圆角在盒子角上相遇，中间的角片怎么做更稳？", "Three rounded edges meet at a box corner. What's the more robust way to make the corner patch?"),
      options: byLocale(
        ["做成一条边缩成点的三边面", "分成三块四边面，或用一张更大的四边面剪裁", "留个小洞，反正看不见"],
        ["A three-sided patch with one edge shrunk to a point", "Three four-sided patches, or one larger four-sided patch trimmed", "Leave a little hole; nobody will see it"],
      ),
      answer: 1,
      explain: t(
        "退化点上等参线挤成一团，旁边的控制点很难共面，后面偏移、抽壳、倒圆角都容易出错。四边面的内部是规则的，好控制；留洞则根本不是封闭的实体。",
        "At a degenerate point the isoparms crowd together and the control points next to it rarely stay coplanar, so offsets, shells and fillets later easily go wrong. Four-sided patches are regular inside and easy to control; a hole means the solid isn't closed at all.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "尽量用四边面：等参线不收敛，斑马纹和后面的偏移、圆角都好控制",
      "极点只在回转体的轴上可以放心用；自由造型上，极点旁那圈控制点要共面、均匀",
      "三边面别用退化边：拆成三块四边面，或用更大的四边面剪裁",
    ],
    [
      "Use four-sided patches wherever you can: isoparms that don't converge keep the zebra stripes, offsets and fillets under control",
      "Poles are only safe on the axis of a revolved shape; on a free-form shape the ring of control points next to the pole must be coplanar and even",
      "Don't make three-sided patches with a collapsed edge: split them into three four-sided patches, or trim a larger four-sided one",
    ],
  ),
  next: {
    to: "/lesson/subd-modeling",
    label: t("SubD 推拉造型与转 NURBS", "SubD push-pull modelling and conversion to NURBS"),
    text: t("SubD 里的星形点是另一种特殊点：转成 NURBS 后，它们周围同样要小心。", "Star points in SubD are another kind of special point, and after conversion to NURBS they need the same care."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Eye />
        {DISPLAY_LABEL[s.display]}
      </SceneChip>
      <SceneChip tone="primary">{s.step === 4 ? CORNER_LABEL[s.corner] : TOPO_LABEL[s.topo]}</SceneChip>
    </div>
  ),
}

export default lesson
