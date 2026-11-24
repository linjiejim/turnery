import { Eye } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { BOX_BOTTOM, BOX_TOP, COLUMN, PerspectiveScene, pitchOf, RINGS, TOL, visitOf, type PerspState, type Visit } from "./perspective-ellipses.scene"
import type { LessonDef } from "./types"

/** 6.4.1 「透视与椭圆」: horizon = eye level, vanishing points, ellipses hung on their axis, ellipse degree vs distance from the horizon. */

const VISIT: Record<Visit, string> = {
  below: t("眼睛低于盒子：看得到底面", "Eye below the box: you see its underside"),
  through: t("视平线穿过盒子：顶面底面都看不到", "The horizon cuts through the box: neither top nor bottom shows"),
  above: t("眼睛高于盒子：看得到顶面", "Eye above the box: you see its top"),
}

/** Side elevation: where the eye is against the box (or the rings). */
function SideView({ s }: { s: PerspState }) {
  const y = (z: number) => 104 - z * 0.36
  const ring = s.step === 4
  return (
    <svg width={196} height={112} viewBox="0 0 196 112" className="block text-foreground" aria-label={t("侧视示意", "Side view")}>
      <line x1={4} x2={192} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.3} />
      {ring ? (
        <>
          <rect x={146} y={y(COLUMN.z1)} width={26} height={y(COLUMN.z0) - y(COLUMN.z1)} className="text-muted-foreground" fill="currentColor" fillOpacity={0.12} stroke="currentColor" strokeOpacity={0.4} />
          {RINGS.map((z) => (
            <line key={z} x1={142} x2={176} y1={y(z)} y2={y(z)} className="text-primary" stroke="currentColor" strokeWidth={1.5} />
          ))}
        </>
      ) : (
        <rect x={140} y={y(BOX_TOP)} width={40} height={y(BOX_BOTTOM) - y(BOX_TOP)} className="text-muted-foreground" fill="currentColor" fillOpacity={0.15} stroke="currentColor" strokeOpacity={0.5} />
      )}
      <line x1={14} x2={192} y1={y(s.eye)} y2={y(s.eye)} stroke="currentColor" strokeWidth={1.2} strokeDasharray="4 3" />
      <circle cx={14} cy={y(s.eye)} r={4.5} className="text-primary" fill="currentColor" />
      <text x={22} y={y(s.eye) - 5} fill="currentColor" className="text-caption">
        {t("视平线", "Horizon")}
      </text>
    </svg>
  )
}

function Overlay({ s }: { s: PerspState }) {
  const showSide = s.step !== 3
  return (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{t("视口就是你的眼睛 · 镜头视角 50°", "The view is your eye · 50° lens")}</SceneChip>
        {s.step <= 2 && <SceneChip tone="primary">{VISIT[visitOf(s.eye)]}</SceneChip>}
      </div>
      {showSide && (
        <div className="w-fit rounded-lg border bg-popover p-2 shadow-popover">
          <div className="mb-1 text-caption text-muted-foreground">{t("侧面看：眼睛和物体的高度", "From the side: eye and object heights")}</div>
          <SideView s={s} />
        </div>
      )}
    </div>
  )
}

const lesson: LessonDef<PerspState, PerspectiveScene> = {
  id: "perspective-ellipses",
  codes: ["6.4.1"],
  title: t("透视与椭圆", "Perspective and ellipses"),
  create: (v, emit) => new PerspectiveScene(v, emit),
  steps: [
    {
      title: t("视平线就是眼睛的高度", "The horizon line is your eye height"),
      body: byLocale(
        <>
          <p>画透视先定视平线。它不是画面里随便一条线，而是你眼睛的高度：所有和眼睛一样高的点，都落在这条线上。</p>
          <p>比眼睛低的水平面，你看得到它的上面；比眼睛高的，看得到下面；和眼睛一样高的面，缩成一条线。拖动眼高，从下面、中间、上面各看一次这个盒子。</p>
        </>,
        <>
          <p>A perspective drawing starts with the horizon line. It isn't just any line across the picture: it is the height of your eye. Every point at eye height lands on it.</p>
          <p>
            A horizontal surface below your eye shows you its top; one above your eye shows its underside; one exactly at eye height shrinks to a line. Drag the eye height and look at the box from below, from level
            with it and from above.
          </p>
        </>,
      ),
      task: { label: t("从盒子下面、中间、上面各看一次", "Look at the box from below, level with it, and from above"), done: (s) => s.seen.length >= 3 },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label={t("眼高", "Eye height")} value={s.eye} min={20} max={250} onChange={(v) => c.setEye(v)} hint={t(`盒子底面 ${BOX_BOTTOM} mm，顶面 ${BOX_TOP} mm`, `Box bottom ${BOX_BOTTOM} mm, top ${BOX_TOP} mm`)} />
          <div className="mt-2 flex flex-wrap gap-1.5 text-caption">
            {(["below", "through", "above"] as const).map((k) => (
              <span key={k} className={cn("rounded-sm px-1.5 py-0.5", s.seen.includes(k) ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground")}>
                {k === "below" ? t("从下面", "From below") : k === "through" ? t("平视", "Level") : t("从上面", "From above")}
              </span>
            ))}
          </div>
        </>
      ),
      note: t(
        "视线水平时，视平线正好在画面中间。产品速写常把眼睛放得比物体高一点，同时看到顶面和两个侧面，信息最多。",
        "With a level gaze the horizon runs through the middle of the picture. Product sketches usually put the eye a little above the object, so the top and two sides all show: the most information in one view.",
      ),
      noteTitle: t("速写习惯", "Sketching habit"),
    },
    {
      title: t("灭点：平行线在视平线上汇聚", "Vanishing points: parallel lines meet on the horizon"),
      body: byLocale(
        <>
          <p>一组互相平行的边，在画面里会汇聚到同一点，叫灭点（VP）。水平的边，灭点一定在视平线上。</p>
          <p>盒子有两组水平边，所以有两个灭点，这是两点透视。转动盒子，看两个灭点怎么沿着视平线滑动。</p>
        </>,
        <>
          <p>A set of edges that are parallel to each other meets at one point in the picture: the vanishing point (VP). For horizontal edges, the vanishing point always lies on the horizon line.</p>
          <p>The box has two sets of horizontal edges, so it has two vanishing points: two-point perspective. Turn the box and watch both points slide along the horizon.</p>
        </>,
      ),
      task: { label: t("转出一个两点透视，再转出一个一点透视", "Find a two-point view, then a one-point view"), done: (s) => s.oneSeen && s.twoSeen },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把盒子转到一个面正对着你（0°），两组水平边会怎样？", "Turn the box so one face looks straight at you (0°). What happens to the two sets of horizontal edges?")}
            options={byLocale(
              ["两个灭点都还在，只是挪了位置", "一组汇聚到画面正中的一个灭点，另一组变成水平的平行线", "两组都不再汇聚"],
              ["Both vanishing points remain, just moved", "One set meets at a single point in the middle; the other becomes horizontal parallel lines", "Neither set converges any more"],
            )}
            answer={1}
            explain={t(
              "正对你的那个面和画面平行，它的水平边不再汇聚；伸向远处的那组边汇聚到视线正前方，就在视平线中间。这就是一点透视。",
              "The face square to you is parallel to the picture, so its horizontal edges no longer converge. The edges running away from you meet straight ahead, in the middle of the horizon. That is one-point perspective.",
            )}
            onReveal={() => c.setYaw(0)}
          />
          <ParamSlider className="mt-3 px-0" label={t("转动盒子", "Turn the box")} unit="°" value={s.yaw} min={0} max={90} onChange={(v) => c.setYaw(v)} />
        </>
      ),
      note: t(
        "镜头视角越窄，两个灭点离得越远，常常落在纸外。灭点放得太近，盒子的角会被拉得很尖，看着就变形了；速写时宁可把灭点放远一些。",
        "The narrower the lens, the further apart the vanishing points, often off the page. Put them too close together and the box's near corner gets stretched sharp and looks distorted, so in sketches keep them well apart.",
      ),
      noteTitle: t("灭点放多远", "How far apart"),
    },
    {
      title: t("三点透视：低头看，竖线也汇聚", "Three-point perspective: look down, and verticals converge too"),
      body: byLocale(
        <>
          <p>视线水平时，画面是竖直的，竖直的边在画里也保持竖直。低头看盒子，画面跟着倾斜，竖线就朝脚下的第三个灭点汇聚；抬头看高楼，第三个灭点在天上。</p>
          <p>产品速写多用两点透视，竖线画成竖直的。物体很大、离得很近，或者想要夸张的视角时，才用三点透视。</p>
        </>,
        <>
          <p>
            With a level gaze the picture plane is upright, so vertical edges stay vertical in the drawing. Look down at the box and the picture tilts with you: the verticals now meet at a third vanishing point
            below your feet. Look up at a tall building and the third point is in the sky.
          </p>
          <p>Product sketches mostly use two-point perspective with the verticals drawn vertical. Three-point is for big objects, close-up views, or when you want a dramatic angle.</p>
        </>,
      ),
      task: { label: t("改成「看向盒子」，让竖线明显汇聚（俯仰 10° 以上）", "Switch to “Look at the box” and make the verticals clearly converge (pitch over 10°)"), done: (s) => s.aim && Math.abs(pitchOf(s)) >= 10 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4">
            <Segmented
              size="sm"
              aria-label={t("视线", "Gaze")}
              value={s.aim ? "aim" : "level"}
              onValueChange={(v) => c.setAim(v === "aim")}
              options={[
                { value: "level", label: t("视线水平", "Look straight ahead") },
                { value: "aim", label: t("看向盒子", "Look at the box") },
              ]}
            />
          </div>
          <ParamSlider className="mt-3 px-0" label={t("眼高", "Eye height")} value={s.eye} min={20} max={250} onChange={(v) => c.setEye(v)} />
          <div className="mt-2">
            <Readout label={t("俯仰", "Pitch")} value={Math.round(pitchOf(s))} unit={t("°，正数是低头", "°, positive is looking down")} tone={Math.abs(pitchOf(s)) >= 10 ? "primary" : undefined} />
          </div>
        </>
      ),
    },
    {
      title: t("圆变成椭圆：短轴对准轴线", "Circles become ellipses: the minor axis lies on the axis"),
      body: byLocale(
        <>
          <p>圆柱的端面是圆，透视里是椭圆。规则只有一条：椭圆的短轴和圆柱的轴线在一条线上，长轴和轴线垂直。</p>
          <p>所以画轮子、瓶口、旋钮，都先画轴线，再把椭圆「挂」在轴线上。轴线伸向哪个灭点，短轴就指向哪个灭点。</p>
        </>,
        <>
          <p>The end of a cylinder is a circle, and in perspective it is an ellipse. There is one rule: the ellipse's minor axis lies on the cylinder's axis, and its major axis is at right angles to it.</p>
          <p>
            So to draw a wheel, a bottle neck or a knob, draw the axis first and hang the ellipse on it. Whichever vanishing point the axis runs to, the minor axis points to it too.
          </p>
        </>,
      ),
      task: {
        label: t(`拖橙色线一端的圆点，把它放到短轴上；换两个姿态各对一次（误差 ${TOL}° 以内）`, `Drag the dot at the end of the orange line onto the minor axis; do it for two different poses (within ${TOL}°)`),
        done: (s) => s.matched.length >= 2,
      },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label={t("绕竖轴转", "Turn about the vertical")} unit="°" value={s.cylYaw} min={0} max={180} step={5} onChange={(v) => c.setCylinder(v, s.cylTilt)} />
          <ParamSlider className="px-0" label={t("倾斜（0° 是立着）", "Tilt (0° is upright)")} unit="°" value={s.cylTilt} min={0} max={90} step={5} onChange={(v) => c.setCylinder(s.cylYaw, v)} />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" disabled={s.revealed} onClick={() => c.reveal()}>
              <Eye />
              {t("显示短轴", "Show the minor axis")}
            </Button>
            <span className="text-small text-muted-foreground">
              {t("已对上", "Matched")} <span className="tabular">{s.matched.length}</span> / 2
            </span>
          </div>
          {s.err !== null &&
            (s.err <= TOL ? (
              <Hint>
                {t(
                  `对上了，只差 ${s.err.toFixed(1)}°。蓝线是算出来的真实短轴，虚线是圆柱的轴线：两者在一条线上。`,
                  `Matched, only ${s.err.toFixed(1)}° off. The blue line is the true minor axis, computed from the picture; the dashed line is the cylinder's axis. They lie on one line.`,
                )}
              </Hint>
            ) : (
              <Hint tone="warning">
                {t(`还差 ${Math.round(s.err)}°。找椭圆最窄的方向，或者想象圆柱的轴线从椭圆中心穿出去。`, `Still ${Math.round(s.err)}° off. Find the ellipse's narrowest direction, or picture the cylinder's axis coming out of its centre.`)}
              </Hint>
            ))}
        </>
      ),
      note: t(
        "严格地说，视线对着轴线上的某一点时，短轴和轴线完全重合，这里转动视图就是这样。按住右键平移，把圆柱挪到画面边上，标签里会出现几度的偏差：这是广角边缘的畸变。速写时照规则画，把物体放在画面中部。",
        "Strictly, the minor axis lies exactly on the axis when your line of sight passes through a point on the axis, as it does here when you orbit. Pan with the right mouse button to move the cylinder to the edge of the picture, and the label shows a few degrees of difference: wide-angle distortion. In a sketch, follow the rule and keep the object near the middle of the picture.",
      ),
      noteTitle: t("精确地说", "Strictly speaking"),
    },
    {
      title: t("离视平线越远，椭圆越圆", "The further from the horizon, the rounder the ellipse"),
      body: byLocale(
        <>
          <p>立柱上套着五个一样大的圆环。水平的圆，越靠近视平线越扁，正好在视平线上就缩成一条直线；越远离视平线，越圆。</p>
          <p>椭圆的「度数」是这样定的：短轴 ÷ 长轴 = sin（度数）。椭圆模板就按度数分档。同一根立柱上，离视平线近的那圈要画得扁，远的那圈画得圆；画反了是最常见的错误。</p>
        </>,
        <>
          <p>Five equal rings sit on a column. A horizontal circle gets flatter the closer it is to the horizon line, and exactly on the horizon it shrinks to a straight line. The further from the horizon, the rounder it gets.</p>
          <p>
            An ellipse's “degree” is defined by minor ÷ major = sin(degree), and ellipse templates are graded in degrees. On one column, draw the ring nearer the horizon flatter and the one further away rounder. Getting
            this backwards is the most common mistake.
          </p>
        </>,
      ),
      task: { label: t("把眼睛升到最上面那圈的高度，让它变成一条直线", "Raise your eye to the top ring's height, so it becomes a straight line"), done: (s) => Math.abs(s.eye - RINGS[RINGS.length - 1]) <= 4 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("眼睛和中间那圈一样高。五个圈里，哪个看上去最圆？", "Your eye is level with the middle ring. Which of the five rings looks roundest?")}
            options={byLocale(["中间那圈，它离眼睛最近", "最上和最下的两圈", "五个一样圆，它们大小相同"], ["The middle one: it's nearest your eye", "The top and bottom ones", "All five: they're the same size"])}
            answer={1}
            explain={t(
              "中间那圈在视平线上，缩成了一条线；离视平线越远，你越是从上方或下方看它，椭圆就越圆。",
              "The middle ring is on the horizon, so it has shrunk to a line. The further a ring is from the horizon, the more you look at it from above or below, and the rounder it gets.",
            )}
            onReveal={() => c.showDegrees()}
          />
          <ParamSlider className="mt-3 px-0" label={t("眼高", "Eye height")} value={s.eye} min={20} max={240} onChange={(v) => c.setEye(v)} hint={t(`圆环高度 ${RINGS.join("、")} mm`, `Rings at ${RINGS.slice(0, -1).join(", ")} and ${RINGS[RINGS.length - 1]} mm`)} />
          {!s.degShown && (
            <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.showDegrees()}>
              {t("显示度数", "Show degrees")}
            </Button>
          )}
        </>
      ),
      note: t(
        "橙色短线是每个椭圆的短轴，它们都落在立柱的轴线上。这里的相机看向立柱中间，所以低头时竖线会稍稍汇聚。",
        "The short orange lines are each ellipse's minor axis, and they all fall on the column's axis. The camera here looks at the middle of the column, so when you look down the verticals converge slightly.",
      ),
      noteTitle: t("看短轴", "Minor axes"),
    },
  ],
  quiz: [
    {
      q: t("视平线在画面的哪里？", "Where is the horizon line in a picture?"),
      options: byLocale(
        ["永远在画面正中间", "在眼睛的高度：所有和眼睛一样高的点都落在它上面", "在物体底面的高度"],
        ["Always across the middle of the picture", "At eye height: every point level with your eye lies on it", "At the height of the object's base"],
      ),
      answer: 1,
      explain: t(
        "只有视线水平时，视平线才正好在画面中间；低头看，它就移到画面上方。它跟着眼睛走，不跟着物体走。",
        "Only with a level gaze does the horizon run through the middle of the picture; look down and it moves up the picture. It follows your eye, not the object.",
      ),
    },
    {
      q: t("画一个车轮，车轴伸向左后方的灭点。椭圆的短轴该怎么放？", "You draw a wheel whose axle runs to a vanishing point at the back left. How should the ellipse's minor axis lie?"),
      options: byLocale(["竖直", "沿着车轴，指向车轴的灭点", "水平，和视平线平行"], ["Vertical", "Along the axle, pointing to the axle's vanishing point", "Horizontal, parallel to the horizon"])
      ,
      answer: 1,
      explain: t(
        "短轴永远和回转轴在一条线上。竖直的短轴只适用于立着的圆柱（轴是竖的）；把车轮椭圆画成竖直短轴，轮子就像歪在车轴上。",
        "The minor axis always lies on the axis of revolution. A vertical minor axis is right only for an upright cylinder, whose axis is vertical. Draw a wheel with a vertical minor axis and it looks skewed on its axle.",
      ),
    },
    {
      q: t("一个立着的杯子整个在视平线下面。杯口和杯底的椭圆，哪个更圆？", "An upright cup sits entirely below the horizon line. Which is rounder: the ellipse of the rim or of the base?"),
      options: byLocale(["杯口：它离眼睛更近", "杯底：它离视平线更远", "一样圆：两个圆一样大"], ["The rim: it's closer to your eye", "The base: it's further from the horizon", "Neither: the two circles are the same size"]),
      answer: 1,
      explain: t(
        "椭圆的圆度看它离视平线多远，不看它离你多近。杯底比杯口低，离视平线更远，你更多是从上方看它，所以更圆。",
        "How round an ellipse is depends on its distance from the horizon, not how close it is to you. The base is lower than the rim, further from the horizon, so you see it more from above, and it is rounder.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "视平线就是眼高；水平边的灭点都在视平线上，竖线只在低头或抬头时才汇聚",
      "椭圆的短轴和圆柱的轴线在一条线上：先画轴线，再把椭圆挂上去",
      "离视平线越远，椭圆越圆；在视平线上缩成一条直线",
    ],
    [
      "The horizon line is your eye height. Horizontal edges vanish on it; verticals converge only when you look down or up",
      "An ellipse's minor axis lies on the cylinder's axis: draw the axis first, then hang the ellipse on it",
      "The further from the horizon, the rounder the ellipse; on the horizon it is a straight line",
    ],
  ),
  next: {
    to: "/lesson/product-lighting",
    label: t("产品摄影的灯光", "Lighting a product"),
    text: t("形体画对了，再用光把它表现清楚。", "Once the form is drawn right, light makes it read."),
  },
  overlay: ({ s }) => <Overlay s={s} />,
}

export default lesson
