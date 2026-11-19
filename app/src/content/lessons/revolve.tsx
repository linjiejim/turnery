import { Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { RevolveScene, type RevolveState } from "./revolve.scene"
import type { LessonDef } from "./types"

/** 1.2.2 「旋转」: half profile + axis → solid of revolution. */
const lesson: LessonDef<RevolveState, RevolveScene> = {
  id: "revolve",
  codes: ["1.2.2"],
  title: t("旋转：半截面绕轴转一圈", "Revolve: half a profile, once around an axis"),
  create: (v, emit) => new RevolveScene(v, emit),
  steps: [
    {
      title: t("只画一半", "Draw only half"),
      body: byLocale(
        <>
          <p>杯子、瓶子、轴、灯罩，这些回转体在 CAD 里都只画一半截面：从中心线到外轮廓。另一半由「旋转」生成。</p>
          <p>截面贴着中心线的那条边，就是旋转轴所在的位置。</p>
        </>,
        <>
          <p>Cups, bottles, shafts, lampshades: for revolved parts like these, you draw only half the cross-section in CAD, from the centerline out to the outer profile. A revolve makes the other half.</p>
          <p>The edge of the profile that lies on the centerline is where the axis of revolution goes.</p>
        </>,
      ),
      task: { label: t("拖动轮廓上的蓝点，改出一个你喜欢的瓶形", "Drag the blue points on the profile into a bottle shape you like"), done: (s) => s.dragged },
      terms: ["sketch", "revolve"],
    },
    {
      title: t("绕轴转一圈", "Once around the axis"),
      body: byLocale(
        <p>截面绕轴转过的每一个角度都会留下一条轮廓，360° 之后合成一个实体。拖动下面的角度，看实体怎么一点点长出来。</p>,
        <p>At every angle the profile passes through on its way around the axis, it leaves a copy of itself behind. After 360° they close up into a solid. Drag the angle below and watch the solid grow.</p>,
      ),
      task: { label: t("把角度拖到 360°", "Drag the angle to 360°"), done: (s) => s.angle >= 360 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label={t("旋转角度", "Revolve angle")} unit="°" value={s.angle} min={0} max={360} step={5} onChange={(v) => c.setAngle(v)} />
          <Button size="sm" variant="secondary" onClick={() => c.play()}>
            <Play />
            {t("播放旋转过程", "Play the revolve")}
          </Button>
        </div>
      ),
      terms: ["revolve"],
    },
    {
      title: t("不一定转满一圈", "It needn't go all the way around"),
      body: byLocale(
        <p>旋转的角度可以小于 360°。门把手的半圆、扇形的风道，都是转一部分得到的。</p>,
        <p>The angle can be less than 360°. The half-round of a door handle and a fan-shaped air duct are both made by revolving only part of the way.</p>,
      ),
      task: { label: t("试一个 180° 左右的角度", "Try an angle of about 180°"), done: (s) => s.triedHalf },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把角度改成 180°，会得到什么？", "Change the angle to 180°. What do you get?")}
            options={byLocale(
              ["一个完整的实体，只是更薄", "半个实体，两端各有一个平的截面", "什么也得不到，旋转必须是 360°"],
              ["A complete solid, only thinner", "Half a solid, with a flat section at each end", "Nothing: a revolve has to be 360°"],
            )}
            answer={1}
            explain={t(
              "转到哪里，实体就长到哪里；起点和终点各留下一个和草图一样的平面截面。",
              "The solid reaches as far as the revolve goes. The start and the end each leave a flat section the same shape as the sketch.",
            )}
            onReveal={() => c.setAngle(180)}
          />
          <ParamSlider className="mt-3 px-0" label={t("旋转角度", "Revolve angle")} unit="°" value={s.angle} min={0} max={360} step={5} onChange={(v) => c.setAngle(v)} />
        </>
      ),
    },
    {
      title: t("轮廓不能越过轴", "The profile can't cross the axis"),
      body: byLocale(
        <>
          <p>如果截面有一部分跑到了轴的另一侧，旋转时它会和自己转出来的部分撞在一起，软件会报自交错误。</p>
          <p>把一个蓝点拖过中心线试试。</p>
        </>,
        <>
          <p>If part of the profile is on the other side of the axis, it collides with the material the profile itself sweeps out as it turns, and the software reports a self-intersection error.</p>
          <p>Try dragging a blue point across the centerline.</p>
        </>,
      ),
      task: { label: t("把一个点拖到旋转轴左边", "Drag a point to the left of the axis"), done: (s) => s.triedCross },
      extra: ({ s, c }) =>
        s.crossed ? (
          <>
            <Hint tone="warning">
              {t(
                "截面越过了旋转轴，实体生成不出来。所有软件在这里都会失败：SOLIDWORKS 提示轮廓与中心线相交，Fusion 提示自相交。",
                "The profile crosses the axis of revolution, so no solid can be made. Every package fails here: SOLIDWORKS reports that the profile intersects the centerline, Fusion reports a self-intersection.",
              )}
            </Hint>
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.reset()}>
              <RotateCcw />
              {t("把轮廓恢复原样", "Restore the profile")}
            </Button>
          </>
        ) : null,
    },
    {
      title: t("轴不一定贴着轮廓", "The axis needn't touch the profile"),
      body: byLocale(
        <p>旋转轴也可以离开轮廓一段距离。这时中间是空的：转出来的是一个环，比如垫圈、轮胎、管道的弯头。</p>,
        <p>The axis can also sit some distance away from the profile. Then the middle stays empty and you get a ring: a washer, a tire, a pipe elbow.</p>,
      ),
      task: { label: t("把轴向外移开 10 mm 以上", "Move the axis 10 mm or more away from the profile"), done: (s) => s.triedOffset },
      extra: ({ s, c }) => (
        <ParamSlider
          className="mt-3 px-0"
          label={t("轮廓到轴的距离", "Profile to axis distance")}
          value={s.axisOffset}
          min={0}
          max={30}
          onChange={(v) => c.setAxisOffset(v)}
          hint={t("0 表示轮廓贴着轴，转出来是实心的。", "At 0 the profile touches the axis, and the result is solid.")}
        />
      ),
    },
  ],
  quiz: [
    {
      q: t("画一个旋转体的草图，应该画什么？", "What should the sketch for a revolved part show?"),
      options: byLocale(
        ["完整的截面", "从中心线到外轮廓的一半截面", "物体的俯视轮廓"],
        ["The complete cross-section", "Half the cross-section, from the centerline to the outer profile", "The part's outline seen from above"],
      ),
      answer: 1,
      explain: t(
        "只画一半，另一半由旋转生成。画完整截面再旋转，会得到重叠的实体。",
        "Draw only half; the revolve makes the other half. Revolve a complete cross-section and you get overlapping solids.",
      ),
    },
    {
      q: t("把 360° 的旋转改成 90°，会得到什么？", "You change a 360° revolve to 90°. What do you get?"),
      options: byLocale(["四分之一个实体，两端各有平截面", "完整实体", "报错"], ["A quarter of the solid, with a flat section at each end", "The complete solid", "An error"]),
      answer: 0,
      explain: t("旋转角度决定实体占多大的扇形，两端是和草图一样的截面。", "The angle decides how large a wedge the solid fills. Both ends are sections the same shape as the sketch."),
    },
    {
      q: t("为什么轮廓不能越过旋转轴？", "Why can't the profile cross the axis of revolution?"),
      options: byLocale(
        ["软件规定的", "越过的部分旋转后会和自身重叠，形成自交", "会变得太重"],
        ["It's just a rule the software makes", "As it revolves, the part past the axis overlaps the rest of the solid, so it self-intersects", "The part would get too heavy"],
      ),
      answer: 1,
      explain: t(
        "轴两侧的轮廓转起来会扫过同一片空间，几何自交，内核无法生成有效实体。",
        "Profile on both sides of the axis sweeps through the same space as it revolves. The geometry self-intersects, and the kernel can't make a valid solid.",
      ),
    },
  ],
  takeaways: byLocale(
    ["回转体只画半截面，截面一侧贴着旋转轴", "角度小于 360° 时两端是平的截面", "轮廓越过轴线会自交失败；轴离开轮廓则得到环"],
    [
      "For a revolved part, draw only half the cross-section, with one side on the axis",
      "Below 360°, both ends are flat sections",
      "A profile that crosses the axis self-intersects and fails; an axis away from the profile gives a ring",
    ],
  ),
  next: {
    to: "/teardown/mug",
    label: t("马克杯拆解", "Mug teardown"),
    text: t("看旋转、圆角、抽壳在一个真实零件里怎么配合。", "See how revolve, fillet and shell work together in a real part."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>{t("草图1 · 前视基准面", "Sketch1 · Front plane")}</SceneChip>
      {s.step >= 1 && <SceneChip tone="primary">{byLocale(<>旋转 {s.angle}°</>, <>Revolve {s.angle}°</>)}</SceneChip>}
    </div>
  ),
}

export default lesson
