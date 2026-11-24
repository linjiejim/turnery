import { Layers } from "lucide-react"
import { Segmented } from "@/components/ui/segmented"
import { Switch } from "@/components/ui/switch"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { HALF_L, foldEndY, minRadiusTowards, shoulderR, type Dir } from "./offset-thicken.section"
import { OffsetScene, folds, shoulderWall, type OffsetState } from "./offset-thicken.scene"
import type { LessonDef, StepCtx } from "./types"

/** 5.2.4 「偏移与加厚」. */
type Ctx = StepCtx<OffsetState, OffsetScene>

const f1 = (x: number) => (Math.round(x * 10) / 10).toFixed(1)

function Thickness({ s, c }: Ctx) {
  return <ParamSlider className="mt-3 px-0" label={t("壁厚 d", "Wall thickness d")} value={s.d} min={0.2} max={8} step={0.1} onChange={(v) => c.setD(v)} />
}

function Status({ s }: { s: OffsetState }) {
  const rmin = minRadiusTowards(s.r0, s.dir)
  const sep = s.separate && s.dir === "in"
  const bad = folds(s) && !sep
  return (
    <div className="mt-3 rounded-md bg-sunken px-3 py-2">
      <Readout label={t("偏移侧最小 R", "Smallest R on the offset side")} value={f1(rmin)} unit="mm" />
      <Readout label="d / R" value={(s.d / rmin).toFixed(2)} tone={bad ? "warning" : "success"} />
      <div className="mt-1 text-small">
        {sep
          ? t("内表面单独构建：不再是等距面，但能成实体。", "Inside built on its own: no longer an exact offset, but it makes a valid solid.")
          : bad
            ? t("d 大于 R：偏移自交，加厚会失败。", "d is larger than R: the offset intersects itself and the thicken fails.")
            : t("d 小于 R：可以加厚。", "d is smaller than R: the thicken works.")}
      </div>
    </div>
  )
}

function DirSwitch({ s, c }: Ctx) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("方向", "Direction")}</span>
      <Segmented
        size="sm"
        aria-label={t("偏移方向", "Offset direction")}
        value={s.dir}
        onValueChange={(d: Dir) => c.setDir(d)}
        options={[
          { value: "in", label: t("向内", "Inward") },
          { value: "out", label: t("向外", "Outward") },
        ]}
      />
    </div>
  )
}

const lesson: LessonDef<OffsetState, OffsetScene> = {
  id: "offset-thicken",
  codes: ["5.2.4"],
  title: t("偏移与加厚", "Offset and thicken"),
  create: (v, emit) => new OffsetScene(v, emit),
  steps: [
    {
      title: t("偏移：沿法向走同样远", "Offset: every point moves the same distance along its normal"),
      body: byLocale(
        <>
          <p>外观面只是一层皮，零件还需要壁厚。加厚（偏移）把面上每个点都沿法向挪同样的距离 d，得到内表面；内外两张面再封口，就是有壁厚的实体。</p>
          <p>前端剖面上的细线就是法向，每根一样长。粗线是外表面，蓝线是偏移出来的内表面。</p>
        </>,
        <>
          <p>A styling surface is only a skin; the part also needs a wall. Thicken (offset) moves every point of the surface the same distance d along its normal to get the inside surface. Close the gap between the two and you have a solid with a wall.</p>
          <p>The thin lines on the section at the front are the normals, all the same length. The heavy line is the outside surface, the blue line the offset inside.</p>
        </>,
      ),
      task: { label: t("拖动内表面上的圆点，改变壁厚", "Drag the dot on the inside curve to change the wall thickness"), done: (s) => s.dragged },
      extra: (ctx) => (
        <>
          <Thickness {...ctx} />
          <Status s={ctx.s} />
        </>
      ),
      terms: ["thicken", "shell"],
    },
    {
      title: t("曲率半径决定能偏多远", "The radius of curvature sets how far you can offset"),
      body: byLocale(
        <>
          <p>一段圆弧朝圆心那边偏移 d，半径变成 R − d；背着圆心偏，变成 R + d。</p>
          <p>所以要盯的是偏移方向那一侧的最小曲率半径。剖面上标出了每段圆弧的半径：向内偏时，左肩最紧，只有 R 1.5，而且越往前越紧。</p>
        </>,
        <>
          <p>Offset an arc towards its centre by d and its radius becomes R − d; offset it away from the centre and it becomes R + d.</p>
          <p>So what you watch is the smallest radius of curvature on the side you offset towards. The section is labelled with every arc's radius: offsetting inward, the left shoulder is the tightest at R 1.5, and it gets tighter towards the front.</p>
        </>,
      ),
      task: { label: t("把壁厚加到左肩打结", "Thicken the wall until the left shoulder ties a knot"), done: (s) => s.sawFold },
      extra: (ctx) => (
        <>
          <Predict
            question={t("壁厚从 1 mm 加到 2.5 mm，左肩（R 1.5）的内侧会怎样？", "You take the wall from 1 mm to 2.5 mm. What happens inside the left shoulder (R 1.5)?")}
            options={byLocale(
              ["内侧圆角变成 R 0，成了尖角就完事", "偏移在那里折回来、自己打结，加厚做不出来", "内表面整体往下平移，没有变化"],
              ["The inside fillet becomes R 0, a sharp corner, and that's that", "The offset doubles back and crosses itself there, so the thicken can't be built", "The inside surface just moves down as a whole, nothing else changes"],
            )}
            answer={1}
            explain={t(
              "R − d 成了负数：点沿法向走过了圆心，偏移曲线倒着走了一段，和两边交叉成一个小环。曲面偏移出来的面会自己穿过自己。",
              "R − d has gone negative: the points travel past the centre along their normals, so the offset runs backwards for a stretch and crosses the curve on either side, making a small loop. The offset surface passes through itself.",
            )}
            onReveal={() => ctx.c.thickenTo(2.5)}
          />
          <Thickness {...ctx} />
          <Status s={ctx.s} />
        </>
      ),
    },
    {
      title: t("燕尾：自交的小环", "The swallowtail: a loop that crosses itself"),
      body: byLocale(
        <>
          <p>放大看左肩：内侧曲线越过圆心后掉头，和自己交叉。红色小环就是多出来、方向反了的那一段，形状像燕尾。</p>
          <p>曲面上的红带是偏移会翻折的地方。肩部越往后越松，红带只占前面一段。拖动剖切位置，往后找一个不打结的剖面。</p>
        </>,
        <>
          <p>Zoom in on the left shoulder: past the centre, the inside curve turns back and crosses itself. The red loop is the extra piece that runs the wrong way; its shape is called a swallowtail.</p>
          <p>The red band on the surface is where the offset folds over. The shoulder loosens towards the back, so the band only covers the front part. Drag the section position back until you find a section without a knot.</p>
        </>,
      ),
      task: { label: t("把剖面挪到不打结的位置", "Move the section to where there is no knot"), done: (s) => s.foundClean },
      extra: ({ s, c }) => {
        const end = foldEndY(s.r0, s.d)
        const len = s.dir === "in" ? Math.max(0, end + HALF_L) : 0
        return (
          <>
            <ParamSlider className="mt-3 px-0" label={t("剖切位置 Y", "Section position Y")} value={s.cut} min={-HALF_L} max={HALF_L - 10} step={1} onChange={(v) => c.setCut(v)} />
            <ParamSlider className="mt-1 px-0" label={t("壁厚 d", "Wall thickness d")} value={s.d} min={0.2} max={8} step={0.1} onChange={(v) => c.setD(v)} />
            <div className="mt-3 rounded-md bg-sunken px-3 py-2">
              <Readout label={t("此剖面肩部 R", "Shoulder R at this section")} value={f1(shoulderR(s.r0, s.cut))} unit="mm" tone={shoulderR(s.r0, s.cut) < s.d ? "warning" : "success"} />
              <Readout label={t("打结的长度", "Length that knots")} value={f1(len)} unit={t(`/ ${2 * HALF_L} mm`, `/ ${2 * HALF_L} mm`)} />
            </div>
          </>
        )
      },
      note: t(
        "曲线偏移时，Rhino 的 Offset 会在曲率半径等于偏移距离的地方自动剪掉小环；曲面偏移（OffsetSrf）、加厚和抽壳不会替你修，结果要么自交，要么直接报错。",
        "When you offset a curve, Rhino's Offset trims the loop where the radius of curvature equals the offset distance. Surface offsets (OffsetSrf), thicken and shell don't repair it for you: the result either intersects itself or the command fails.",
      ),
      noteTitle: t("曲线和曲面不一样", "Curves and surfaces differ"),
    },
    {
      title: t("向内还是向外", "Inward or outward"),
      body: byLocale(
        <>
          <p>向外加厚时情况反过来：肩部是凸的，向外偏半径变大，没问题；中间的凹槽 R 5 向外偏会变小，壁厚超过 5 mm 就在凹槽处打结。</p>
          <p>规则只有一条：朝偏移方向看，那一侧（曲率中心所在的一侧）的最小曲率半径必须大于偏移距离。</p>
        </>,
        <>
          <p>Thicken outward and it turns around: the shoulders are convex, so offsetting outward makes their radii larger, no problem. The groove in the middle (R 5 concave) gets smaller, and beyond 5 mm the offset knots in the groove.</p>
          <p>There is only one rule: on the side you offset towards (the side the centre of curvature is on), the smallest radius of curvature must be larger than the offset distance.</p>
        </>,
      ),
      task: { label: t("切到向外，把壁厚加到凹槽打结", "Switch to outward and thicken until the groove knots"), done: (s) => s.outFold },
      extra: (ctx) => (
        <>
          <DirSwitch {...ctx} />
          <Thickness {...ctx} />
          <Status s={ctx.s} />
          <Hint>{t("圆点往外表面上方拖，也会切到向外。", "Dragging the dot above the outside surface switches to outward too.")}</Hint>
        </>
      ),
    },
    {
      title: t("抽壳失败是同一个原因", "Shells fail for the same reason"),
      body: byLocale(
        <>
          <p>抽壳就是把实体的面都向内偏移一个壁厚。外圆角比壁厚小，内侧就是 R − t &lt; 0：「先圆角，还是先抽壳」里抽壳失败，就是这个原因。</p>
          <p>所以抽壳、加厚之前，先查最小曲率半径。打开检查：红色是半径小于壁厚、一定失败的地方；橙色是小于 1.5 倍壁厚、偏完内侧圆角会很小的地方。</p>
        </>,
        <>
          <p>A shell offsets every face of the solid inward by the wall thickness. Where an outside fillet is smaller than the wall, the inside becomes R − t &lt; 0. That's why the shell failed in “Fillet first, or shell first?”.</p>
          <p>So before you shell or thicken, check the minimum radius of curvature. Turn the check on: red is where the radius is smaller than the wall and the offset must fail; orange is where it's under 1.5 times the wall and the inside fillet would come out very small.</p>
        </>,
      ),
      task: { label: t("打开检查，找到刚好不出红色的壁厚", "Turn the check on and find the thickest wall that shows no red"), done: (s) => s.checked },
      extra: ({ s, c }) => (
        <>
          <label className="mt-3 flex items-center gap-2 text-small">
            <Switch checked={s.analysis} onCheckedChange={(v) => c.setAnalysis(v)} />
            {t("最小半径检查", "Minimum radius check")}
          </label>
          <ParamSlider className="mt-2 px-0" label={t("壁厚 d", "Wall thickness d")} value={s.d} min={0.2} max={8} step={0.1} onChange={(v) => c.setD(v)} />
          <Status s={s} />
        </>
      ),
      note: t(
        "Rhino 用曲率分析（CurvatureAnalysis）的最小半径样式，官方建议把红色设为偏移距离、蓝色设为 1.5 倍；SOLIDWORKS 在「工具 > 评估 > 检查」里勾「最小曲率半径」，抽壳失败时也会提示壁厚大于最小曲率半径。等半径的普通圆角有时内核能特殊处理，样条面和自由曲面最容易出问题。",
        "In Rhino, use CurvatureAnalysis with the Min radius style; McNeel suggests setting red to the offset distance and blue to 1.5 times that. In SOLIDWORKS, Tools > Evaluate > Check has a Minimum radius of curvature option, and a failed shell warns that the thickness is larger than the minimum radius of curvature. Kernels can sometimes handle a plain constant-radius fillet specially; splines and free-form surfaces are where it bites.",
      ),
      noteTitle: t("各软件怎么查", "How to check in each package"),
      terms: ["shell"],
    },
    {
      title: t("三种修法", "Three fixes"),
      body: byLocale(
        <>
          <p>壁厚要 2.5 mm，左肩 R 1.5 太紧。三条路：</p>
          <p>1. 把外表面的肩部半径做大，大过壁厚。外观会变软，要和设计商量。</p>
          <p>2. 壁厚减薄。要结构、注塑或打印工艺允许。</p>
          <p>3. 内表面单独构建：先偏移不带圆角的主面，内侧再自己倒一个小圆角。内外不再同心，转角处会稍厚一点，但它是合法的实体，外观一点不用改。</p>
        </>,
        <>
          <p>The wall must be 2.5 mm and the left shoulder's R 1.5 is too tight. Three ways out:</p>
          <p>1. Make the shoulder radius on the outside larger than the wall. The look gets softer, so agree it with the designer.</p>
          <p>2. Make the wall thinner, if the structure and the moulding or printing process allow it.</p>
          <p>3. Build the inside on its own: offset the main faces without their fillets, then give the inside its own small fillet. Inside and outside are no longer concentric and the corner is a little thicker, but the solid is valid and the outside stays exactly as designed.</p>
        </>,
      ),
      task: {
        label: t("保持 2.5 mm 以上的壁厚，让加厚成功", "Keep the wall at 2.5 mm or more and make the thicken work"),
        done: (s) => s.d >= 2.45 && (!folds(s) || (s.separate && s.dir === "in")),
      },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("外表面肩部最小半径", "Smallest shoulder radius outside")} value={s.r0} min={0.5} max={8} step={0.1} onChange={(v) => c.setR0(v)} />
          <ParamSlider className="mt-1 px-0" label={t("壁厚 d", "Wall thickness d")} value={s.d} min={0.2} max={8} step={0.1} onChange={(v) => c.setD(v)} />
          <label className="mt-3 flex items-center gap-2 text-small">
            <Switch checked={s.separate} onCheckedChange={(v) => c.setSeparate(v)} />
            {t("内表面单独构建", "Build the inside on its own")}
          </label>
          <Status s={s} />
          {s.separate && (
            <div className="mt-2 rounded-md bg-sunken px-3 py-2">
              <Readout label={t("肩部转角处的壁厚", "Wall at the shoulder corner")} value={f1(shoulderWall(s))} unit="mm" />
            </div>
          )}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("一张面上最小的凸圆角是 R 2，向内加厚 3 mm，会怎样？", "The smallest convex fillet on a surface is R 2. You thicken it 3 mm inward. What happens?"),
      options: byLocale(
        ["没问题，内侧圆角变成 R 5", "偏移在这个圆角处自交，加厚失败", "只是内侧变成一个尖角"],
        ["No problem: the inside fillet becomes R 5", "The offset intersects itself at that fillet and the thicken fails", "The inside just gets a sharp corner"],
      ),
      answer: 1,
      explain: t(
        "向内偏移时，凸圆角的圆心在里面，偏移是朝着圆心走：R − d = −1，面翻折自交。R + d 是背着圆心偏的情况。",
        "Offsetting inward, the centre of a convex fillet is on the inside, so the offset heads towards it: R − d = −1 and the surface folds through itself. R + d is what you get offsetting away from the centre.",
      ),
    },
    {
      q: t("同一张面，向内加厚 3 mm 没问题，向外加厚 3 mm 却失败了。最可能的原因是？", "The same surface thickens fine 3 mm inward but fails 3 mm outward. What's the most likely reason?"),
      options: byLocale(
        ["向外偏移的算法本来就不稳定", "面上有一处半径小于 3 mm 的凹处，向外偏正好朝着它的圆心", "向外加厚让零件变大，超出了建模范围"],
        ["Outward offsets are just less stable", "There's a concave spot with a radius under 3 mm, and an outward offset heads towards its centre", "Thickening outward makes the part bigger than the modelling range"],
      ),
      answer: 1,
      explain: t(
        "朝哪边偏，就看哪边的曲率中心。凹处的圆心在外面，向外偏移半径变成 R − d，小于 3 mm 的凹处就会打结。",
        "What matters is the centre of curvature on the side you offset towards. A concave spot has its centre outside, so an outward offset makes its radius R − d, and anything under 3 mm knots.",
      ),
    },
    {
      q: t("外观面肩部 R 1.5，结构要求壁厚 2.5 mm，外观不能改。怎么办最合适？", "The styling surface has an R 1.5 shoulder, the structure needs a 2.5 mm wall, and the look can't change. What's the best approach?"),
      options: byLocale(
        ["把壁厚改成 1.4 mm", "外表面不动，内表面单独构建：偏移不带圆角的主面，内侧另倒小圆角", "把加厚的公差放大，直到命令成功"],
        ["Change the wall to 1.4 mm", "Leave the outside alone and build the inside on its own: offset the main faces without fillets, then fillet the inside separately", "Loosen the thicken tolerance until the command succeeds"],
      ),
      answer: 1,
      explain: t(
        "外观和壁厚都锁定时，只能让内表面不再是外表面的等距面。改壁厚违反结构要求；放大公差只是让自交的面勉强通过，后面的圆角、拔模和出图都会出问题。",
        "With both the look and the wall fixed, the inside has to stop being an exact offset of the outside. Changing the wall breaks the structural requirement; loosening the tolerance only lets a self-intersecting surface slip through, and the fillets, draft and drawings after it will suffer.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "偏移是每个点沿法向走同样的距离；朝曲率中心偏，半径变成 R − d",
      "偏移方向一侧的最小曲率半径必须大于偏移距离，否则自交；抽壳失败也是这个原因",
      "修法：外侧半径做大、壁厚减薄，或内表面单独构建；动手前先用最小半径分析查一遍",
    ],
    [
      "An offset moves every point the same distance along its normal; offset towards the centre of curvature and the radius becomes R − d",
      "The smallest radius on the side you offset towards must exceed the offset distance, or the offset intersects itself; failed shells fail for the same reason",
      "Fixes: a larger radius outside, a thinner wall, or an inside built on its own. Check with a minimum-radius analysis before you start",
    ],
  ),
  next: {
    to: "/lesson/fillet-shell-order",
    label: t("先圆角，还是先抽壳", "Fillet first, or shell first?"),
    text: t("同一个道理落到实体上：特征顺序决定内侧圆角是 R − t，还是根本做不出来。", "The same rule on a solid: the feature order decides whether the inside fillet is R − t or can't be built at all."),
  },
  overlay: ({ s }) => {
    const bad = folds(s) && !(s.separate && s.dir === "in")
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip>
          <Layers />
          {t(`壁厚 ${f1(s.d)} mm · ${s.dir === "in" ? "向内" : "向外"}`, `Wall ${f1(s.d)} mm · ${s.dir === "in" ? "inward" : "outward"}`)}
        </SceneChip>
        <SceneChip tone={bad ? undefined : "primary"} className={bad ? "text-destructive" : undefined}>
          {bad ? t("加厚失败：自交", "Thicken fails: self-intersection") : t("可以加厚", "Thicken works")}
        </SceneChip>
      </div>
    )
  },
}

export default lesson
