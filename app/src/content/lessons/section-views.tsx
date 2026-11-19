import { Crosshair, Eye } from "lucide-react"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { cutsThrough, holeWidths, SectionViewsScene, type Region, type SectionState } from "./section-views.scene"
import type { LessonDef } from "./types"

/** 0.2.3 「剖视」: a draggable section plane, the cut shape, hatching, and where to cut. */

const REGION_TEXT: Record<Region, string> = {
  solid: t("这里是实体，要画剖面线。", "This is solid material, so it gets hatching."),
  hole: t("这是孔，空的，不画剖面线。", "This is the hole. It's empty, so no hatching."),
  cavity: t("这是空腔，空的，不画剖面线。", "This is the cavity. It's empty, so no hatching."),
}

function cutText(d: number) {
  const c = cutsThrough(d)
  if (!c.part) return t("没切到零件", "Misses the part")
  const parts = [c.hole ? t("通孔", "through hole") : c.counterbore ? t("沉孔", "counterbore") : null, c.cavity ? t("空腔", "cavity") : null].filter(Boolean)
  return parts.length ? t(`剖到：${parts.join("、")}`, `Cuts the ${parts.join(" and the ")}`) : t("只剖到实体", "Cuts solid material only")
}

function CutSlider({ s, c }: { s: SectionState; c: SectionViewsScene }) {
  return (
    <ParamSlider
      className="mt-4 px-0"
      label={t("剖切平面位置 y", "Cutting plane position y")}
      value={s.cut}
      min={-32}
      max={32}
      onChange={(v) => c.setCut(v)}
      hint={t("零件前后方向从 −25 到 25，孔和空腔的中心在 y = 0。", "Front to back, the part runs from −25 to 25; the hole and the cavity are centered on y = 0.")}
    />
  )
}

const lesson: LessonDef<SectionState, SectionViewsScene> = {
  id: "section-views",
  codes: ["0.2.3"],
  title: t("剖视：把零件切开看", "Section views: cutting a part open"),
  create: (v, emit) => new SectionViewsScene(v, emit),
  steps: [
    {
      title: t("外面看不出里面", "You can't see inside from outside"),
      body: byLocale(
        <>
          <p>这个零件里藏着两处空的地方：左边一个沉孔，右边一个从底面挖进去的空腔。</p>
          <p>从上面、前面都看不到空腔。在普通视图里，它只能画成一堆虚线，和外轮廓叠在一起，很难读。</p>
        </>,
        <>
          <p>This part hides two hollow features: a counterbored hole on the left, and on the right a cavity cut into it from the bottom face.</p>
          <p>You can't see the cavity from the top or the front. In an ordinary view it can only be drawn as a tangle of dashed lines over the outline, which is hard to read.</p>
        </>,
      ),
      task: { label: t("转到下面看一眼，找到那个空腔", "Orbit around underneath and find the cavity"), done: (s) => s.sawBelow },
      extra: ({ s, c }) => (
        <>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.view("bottom")}>
            <Eye />
            {t("从下面看", "View from below")}
          </Button>
          {s.sawBelow && <Hint>{t("空腔从底面开口，深 18 mm。换个办法：把零件切开看。", "The cavity opens from the bottom face and is 18 mm deep. There's a better way to show it: cut the part open.")}</Hint>}
        </>
      ),
    },
    {
      title: t("用平面切开", "Cut it with a plane"),
      body: byLocale(
        <>
          <p>剖视的做法：假想用一个平面把零件切开，拿走挡在前面的那部分，再看剩下的。平面切到实体的地方，就是剖面。</p>
          <p>拖动剖切平面右上角的蓝点，把它推进零件。</p>
        </>,
        <>
          <p>Here's how a section view works: imagine cutting the part with a plane, take away the piece in front, and look at what's left. Where the plane cuts through solid material is the section.</p>
          <p>Drag the blue dot at the top right corner of the cutting plane to push it into the part.</p>
        </>,
      ),
      task: { label: t("把剖切平面推到切过孔的位置", "Push the cutting plane far enough to cut through the hole"), done: (s) => Math.abs(s.cut) < 5 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("剖切平面切过孔的时候，剖面是什么形状？", "When the cutting plane passes through the hole, what shape is the section?")}
            options={byLocale(
              ["一个完整的矩形", "在孔的位置断成左右两块，缺口是台阶形", "一个圆环"],
              ["One complete rectangle", "Two pieces, split left and right at the hole, with a stepped gap between them", "A ring"],
            )}
            answer={1}
            explain={t(
              "孔是通的，剖面在孔的位置断成两块；上段沉孔更宽，所以缺口是台阶形。右边那块底下还缺了一块，那是空腔。",
              "The hole goes right through, so the section splits into two pieces there. The counterbore at the top is wider, so the gap is stepped. The right-hand piece is also missing a chunk at the bottom: that's the cavity.",
            )}
            onReveal={() => c.cutAt(0)}
          />
          <CutSlider s={s} c={c} />
        </>
      ),
    },
    {
      title: t("剖在中心线上", "Cut on the center line"),
      body: byLocale(
        <>
          <p>剖切平面偏离孔的中心，剖面切到的只是孔的一条弦，看起来就比实际窄，量出来不是真实直径。</p>
          <p>所以剖切平面一般放在孔的中心线上，或者零件的对称面上。</p>
        </>,
        <>
          <p>If the cutting plane is off the hole's center, the section only cuts a chord of the hole. The hole looks narrower than it really is, and what you measure isn't the true diameter.</p>
          <p>So the cutting plane usually goes through the hole's center line, or through the part's plane of symmetry.</p>
        </>,
      ),
      task: { label: t("把剖切平面对准孔的中心线", "Line the cutting plane up with the hole's center line"), done: (s) => s.cut === 0 },
      extra: ({ s, c }) => {
        const w = holeWidths(s.cut)
        return (
          <>
            <div className="mt-3">
              <Readout label={t("剖面上的孔宽", "Hole width in the section")} value={w.hole ? w.hole.toFixed(1) : "—"} unit="mm" tone={s.cut === 0 ? "success" : "warning"} />
              <Readout label={t("沉孔宽", "Counterbore width")} value={w.counterbore ? w.counterbore.toFixed(1) : "—"} unit="mm" tone={s.cut === 0 ? "success" : "warning"} />
            </div>
            <p className="mt-1 text-small text-muted-foreground">{t("实际：通孔 Ø10，沉孔 Ø18 × 8 深。", "Actual size: through hole Ø10, counterbore Ø18 × 8 deep.")}</p>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.cutAt(0)}>
              <Crosshair />
              {t("对准孔中心", "Center on the hole")}
            </Button>
            <CutSlider s={s} c={c} />
          </>
        )
      },
      terms: ["hole"],
    },
    {
      title: t("剖面线", "Hatching"),
      body: byLocale(
        <>
          <p>工程图里，剖到的实体要画剖面线。金属零件的剖面线用细实线，间隔相等，一般与剖面区域的主要轮廓或对称线成 45°；同一个零件在所有剖视图里，剖面线的方向和间隔都一样。</p>
          <p>孔和空腔是空的，剖面线不能画进去。读图的人一眼就知道哪里是实心的。</p>
        </>,
        <>
          <p>
            In an engineering drawing, solid material that has been cut gets hatching. For metal parts, hatching is thin continuous lines, evenly spaced, usually at 45° to the main outline or the line of symmetry of the cut
            area. A part has the same hatching direction and spacing in every section view.
          </p>
          <p>Holes and cavities are empty, so hatching must stay out of them. That way the reader sees at a glance what is solid.</p>
        </>,
      ),
      task: { label: t("在剖面上分别点一下孔和空腔", "In the section, click the hole and then the cavity"), done: (s) => s.foundHole && s.foundCavity },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-small font-medium">{t("剖面线", "Hatching")}</span>
            <Segmented
              size="sm"
              aria-label={t("剖面线", "Hatching")}
              value={s.hatch ? "on" : "off"}
              onValueChange={(v) => c.setHatch(v === "on")}
              options={[
                { value: "on", label: t("显示", "Show") },
                { value: "off", label: t("隐藏", "Hide") },
              ]}
            />
          </div>
          {s.region && <Hint tone={s.region === "solid" ? "warning" : undefined}>{REGION_TEXT[s.region]}</Hint>}
          {s.foundHole && s.foundCavity && <Hint>{t("两处空的地方都找到了。剖面线只画在实体上。", "You found both hollow areas. Hatching goes only on solid material.")}</Hint>}
        </>
      ),
      note: t(
        "剖面线的规定见 GB/T 4457.5-2013《机械制图 剖面区域的表示法》。两个零件剖在一起时，相邻零件的剖面线方向相反或间隔不同，用来区分零件。非金属材料另有剖面符号。旧版 GB/T 4457.5-1984 写的是「与水平成 45°」，现行版改为以主要轮廓或对称线为准。",
        "Hatching is specified in GB/T 4457.5-2013 (Mechanical drawings: representation of areas on cuts and sections). Where two parts are cut together, adjacent parts get hatching in opposite directions or at a different spacing, so you can tell them apart. Non-metallic materials have their own section symbols. The older GB/T 4457.5-1984 said “at 45° to the horizontal”; the current edition takes the main outline or the line of symmetry as the reference instead.",
      ),
      noteTitle: t("国标约定", "GB conventions"),
    },
    {
      title: t("剖在哪，就表达哪", "Where you cut is what you show"),
      body: byLocale(
        <>
          <p>同一个零件，剖切平面放在哪，剖视图就表达什么。想表达空腔的深度，又不想被沉孔打断，就把平面放在只穿过空腔的位置。</p>
          <p>图纸上用剖切符号（两端的粗短画和箭头）加字母标出剖切位置，剖视图上方写「A–A」。剖切平面过零件的对称面、视图又按投影关系摆放时，这些标注可以省略。</p>
        </>,
        <>
          <p>
            For the same part, where you put the cutting plane decides what the section view shows. To show the cavity's depth without the counterbore breaking it up, put the plane where it passes through the cavity only.
          </p>
          <p>
            On a drawing, the position of the cut is marked with the cutting-plane symbol (short thick strokes at the ends, with arrows) and a letter, and the section view is labeled “A–A” above it. When the cutting plane
            passes through the part's plane of symmetry and the view sits in its projected position, these labels may be left off.
          </p>
        </>,
      ),
      task: { label: t("移动剖切平面，只切到空腔，不切到孔", "Move the cutting plane so it cuts the cavity but not the hole"), done: (s) => Math.abs(s.cut) >= 9 && Math.abs(s.cut) < 13 },
      extra: ({ s, c }) => (
        <>
          <CutSlider s={s} c={c} />
          <Hint>{cutText(s.cut)}</Hint>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("剖视图里，哪些区域画剖面线？", "In a section view, which areas are hatched?"),
      options: byLocale(["所有看得见的面", "被剖切平面切到的实体部分", "孔和空腔"], ["Every visible face", "The solid material the cutting plane passes through", "Holes and cavities"]),
      answer: 1,
      explain: t(
        "剖面线只画在平面切到实体的地方。孔和空腔是空的；剖切平面后面看得见的轮廓画粗实线，不画剖面线。",
        "Hatching goes only where the plane cuts solid material. Holes and cavities are empty, and the visible outlines behind the cutting plane are drawn as thick continuous lines, without hatching.",
      ),
    },
    {
      q: t("剖切平面偏离 Ø10 孔的中心线 3 mm，剖面上量到的孔宽是多少？", "The cutting plane is 3 mm off the center line of a Ø10 hole. What hole width do you measure in the section?"),
      options: byLocale(["小于 10 mm", "正好 10 mm", "大于 10 mm"], ["Less than 10 mm", "Exactly 10 mm", "More than 10 mm"]),
      answer: 0,
      explain: t(
        "偏离中心时，平面切到的是孔的一条弦，弦比直径短，这里只有 8 mm。所以剖切平面通常过孔的中心线。",
        "Off center, the plane cuts a chord of the hole, and a chord is shorter than the diameter: here only 8 mm. That's why the cutting plane usually passes through the hole's center line.",
      ),
    },
    {
      q: t("金属零件的剖面线，国标规定画成？", "Under GB, how is hatching on metal parts drawn?"),
      options: byLocale(["45° 的细实线，间隔均匀", "竖直的粗实线", "45° 的细虚线"], ["Thin continuous lines at 45°, evenly spaced", "Vertical thick continuous lines", "Thin dashed lines at 45°"]),
      answer: 0,
      explain: t(
        "通用剖面线是 45° 细实线。粗实线留给可见轮廓，细虚线留给不可见轮廓，不能混用。",
        "General-purpose hatching is thin continuous lines at 45°. Thick continuous lines are kept for visible outlines and thin dashed lines for hidden ones; don't mix them up.",
      ),
    },
  ],
  takeaways: byLocale(
    ["剖视：假想切开零件，拿走前面那部分，看剩下的", "剖到的实体画 45° 细实线剖面线，孔和空腔不画", "剖切平面一般过孔的中心线或对称面：剖在哪，就表达哪"],
    [
      "A section view: imagine cutting the part open, take away the front piece, and look at what's left",
      "Cut solid material gets hatching in thin continuous lines at 45°; holes and cavities get none",
      "The cutting plane usually passes through a hole's center line or a plane of symmetry: where you cut is what you show",
    ],
  ),
  overlay: ({ s }) =>
    s.step >= 1 ? (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip tone="primary">{t(`剖切平面 y = ${s.cut}`, `Cutting plane y = ${s.cut}`)}</SceneChip>
        <SceneChip>{cutText(s.cut)}</SceneChip>
      </div>
    ) : null,
}

export default lesson
