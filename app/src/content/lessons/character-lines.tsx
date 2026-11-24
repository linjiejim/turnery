import { LocateFixed, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { HIGH_LIGHT, LineScene, LOW_LIGHT, type Kind, type LineState, type Where } from "./character-lines.scene"
import type { LessonDef } from "./types"

/** 6.1.3 「特征线与高光」. */

const KIND_LABEL: Record<Kind, string> = {
  hard: t("硬折 G0", "Hard G0"),
  soft: t("软折", "Soft"),
  fade: t("渐消", "Fading"),
}

const WHERE_LABEL: Record<Where, string> = {
  above: t("在上方的面上", "on the face above"),
  on: t("在线上", "on the line"),
  below: t("在下方的面上", "on the face below"),
  gap: t("线上没有高光：明暗交界", "none on the line: a light/shadow edge"),
}

function LightSlider({ s, c }: { s: LineState; c: LineScene }) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label={t("灯管高度", "Lamp height")}
      unit="°"
      value={s.light}
      min={-15}
      max={75}
      onChange={(v) => c.setLight(v)}
      hint={t("也可以直接拖视图里的圆点。", "You can also drag the dot in the view.")}
    />
  )
}

function KindSwitch({ s, c }: { s: LineState; c: LineScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("折法", "Crease")}</span>
      <Segmented
        size="sm"
        aria-label={t("折法", "Crease")}
        value={s.kind}
        onValueChange={(k: Kind) => c.setKind(k)}
        options={(["hard", "soft", "fade"] as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k] }))}
      />
    </div>
  )
}

function WhereReadout({ s }: { s: LineState }) {
  return (
    <div className="mt-2">
      <Readout label={t("高光", "Highlight")} value={WHERE_LABEL[s.where]} tone={s.where === "on" ? "success" : undefined} />
    </div>
  )
}

const near = (s: LineState) => s.markerMoved && s.fadeEnd !== null && Math.abs(s.marker - s.fadeEnd) <= 15

const lesson: LessonDef<LineState, LineScene> = {
  id: "character-lines",
  codes: ["6.1.3"],
  title: t("特征线与高光", "Character lines and highlights"),
  create: (v, emit) => new LineScene(v, emit),
  steps: [
    {
      title: t("特征线：一道有意的折", "A character line: a deliberate crease"),
      body: byLocale(
        <>
          <p>车门上从前到后的那条腰线，洗衣机前板上的一道折，都是特征线：在大面上有意折一下。它几乎不占体积，作用是在灯下画出一条线。</p>
          <p>这块板子刷的是深色漆，前面有一根和线平行的长灯管。上下移动灯管，看高光怎么在面上走。</p>
        </>,
        <>
          <p>The waistline running front to back along a car door, the fold across a washing machine's front panel: these are character lines, a deliberate crease in a large surface. They take up almost no volume; their job is to draw a line in the light.</p>
          <p>This panel has a dark paint finish, with a long strip lamp in front of it, parallel to the line. Move the lamp up and down and watch the highlight travel over the surface.</p>
        </>,
      ),
      task: { label: t("把灯管上下移动 25° 以上", "Move the lamp up or down by 25° or more"), done: (s) => s.lightMax - s.lightMin >= 25 },
      extra: ({ s, c }) => (
        <>
          <LightSlider s={s} c={c} />
          <WhereReadout s={s} />
        </>
      ),
    },
    {
      title: t("三种折法", "Three kinds of crease"),
      body: byLocale(
        <>
          <p>硬折（G0）：两个面直接相交，法向一下子转过整个折角。线上没有高光，只有明暗交界，一边亮一边暗。</p>
          <p>软折：折处是一个小圆角（这里 R6），法向在几毫米里转过整个折角，总有一点能把灯反射过来：一条细细的高光线。</p>
          <p>渐消：折角沿着线越来越小，最后消失在面里。线上的高光跟着变细，到某处离开线，滑到面上或者消失。</p>
        </>,
        <>
          <p>Hard (G0): the two faces simply meet, and the normal turns through the whole crease angle at once. There's no highlight on the line, only a light/shadow edge: bright on one side, dark on the other.</p>
          <p>Soft: the crease is a small round (R6 here). The normal turns through the whole angle within a few millimetres, so some point on it always reflects the lamp: a thin line of light.</p>
          <p>Fading: the crease angle shrinks along the line until it disappears into the surface. The highlight on the line thins with it, and at some point leaves the line, sliding onto the surface or vanishing.</p>
        </>,
      ),
      task: { label: t("三种折法都看一遍", "Look at all three"), done: (s) => s.seenKinds === 7 },
      extra: ({ s, c }) => (
        <>
          <KindSwitch s={s} c={c} />
          <LightSlider s={s} c={c} />
          <WhereReadout s={s} />
        </>
      ),
    },
    {
      title: t("让线吃到光", "Make the line catch the light"),
      body: byLocale(
        <p>视角固定在这里。灯管放在哪些位置，高光会正好落在线上？</p>,
        <p>The view stays where it is. Where can the lamp go so that the highlight lands right on the line?</p>,
      ),
      task: { label: t("把灯管移到高光落在线上的位置", "Move the lamp so the highlight lands on the line"), done: (s) => s.where === "on" },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("折角 16°。灯管在多大的角度范围里，高光都会落在线上？", "The crease angle is 16°. Over what range of lamp angles does the highlight stay on the line?")}
            options={byLocale(["约 16°，和折角一样", "约 32°，是折角的两倍", "只有一个角度"], ["About 16°, the same as the crease", "About 32°, twice the crease", "Just one angle"])}
            answer={1}
            explain={t(
              "镜面反射把角度加倍：法向转过 16°，反射方向就转过 32°。所以折线能在很宽的灯光范围里一直亮着，比平缓的大面「稳」得多。",
              "A mirror doubles angles: when the normal turns 16°, the reflected direction turns 32°. So a crease stays lit over a wide range of lamp positions, far more steadily than a gentle surface.",
            )}
            onReveal={() => c.revealRange()}
          />
          <LightSlider s={s} c={c} />
          <div className="mt-2 flex flex-wrap gap-y-1">
            <Readout label={t("高光", "Highlight")} value={WHERE_LABEL[s.where]} tone={s.where === "on" ? "success" : undefined} />
            {s.showRange && <Readout label={t("落在线上", "On the line")} value={`${s.range[0]}° – ${s.range[1]}°`} />}
          </div>
        </>
      ),
    },
    {
      title: t("折角和半径", "Crease angle and radius"),
      body: byLocale(
        <>
          <p>现实里的灯不止一盏：展厅顶上的灯在高处，窗外和地面的反光在低处。折角越大，线能吃到光的范围越宽，在更多灯光下都看得见；代价是面折得更狠，造型更硬。</p>
          <p>半径管高光线的宽窄：越大，线越宽越软；太小就接近硬折。冲压钣金的最小折弯半径受材料和模具限制，塑料件可以更锐，具体数值以材料和供应商为准。</p>
        </>,
        <>
          <p>
            Real lighting is never one lamp: showroom ceiling lights are high, windows and reflections off the floor are low. The bigger the crease angle, the wider the range of light the line can catch, so it shows under more
            lighting; the price is a harder break in the surface and a stiffer look.
          </p>
          <p>
            The radius sets how wide the line of light is: bigger, and it's wider and softer; too small, and it's close to a hard crease. In stamped sheet metal the smallest bend radius is limited by the material and the tooling,
            while plastic parts can be sharper. Take actual values from the material and the supplier.
          </p>
        </>,
      ),
      task: { label: t("让高、低两盏灯的高光都落在线上", "Get the highlights of both the high and the low lamp onto the line"), done: (s) => s.where === "on" && s.where2 === "on" },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("折角", "Crease angle")} unit="°" value={s.angle} min={4} max={30} onChange={(v) => c.setAngle(v)} />
          <ParamSlider className="px-0" label={t("折处半径", "Crease radius")} value={s.radius} min={1} max={12} onChange={(v) => c.setRadius(v)} />
          <div className="mt-2 flex flex-col gap-1">
            <Readout label={t(`高处的灯（${HIGH_LIGHT}°）`, `High lamp (${HIGH_LIGHT}°)`)} value={WHERE_LABEL[s.where]} tone={s.where === "on" ? "success" : undefined} />
            <Readout label={t(`低处的灯（${LOW_LIGHT}°）`, `Low lamp (${LOW_LIGHT}°)`)} value={WHERE_LABEL[s.where2]} tone={s.where2 === "on" ? "success" : undefined} />
            <Readout label={t("线能吃到光的范围", "The line catches lamps from")} value={`${s.range[0]}° – ${s.range[1]}°`} />
          </div>
        </>
      ),
    },
    {
      title: t("渐消：高光在哪里离开线", "Fading: where the highlight leaves the line"),
      body: byLocale(
        <>
          <p>渐消的特征线，折角沿着线慢慢减到零，线「死」进面里。高光比几何先离开：折角小到一定程度，线上就没有哪一点能把灯反射到你眼里，高光要么消失，要么滑到旁边的面上。</p>
          <p>在哪里离开，取决于灯和视角。检查渐消线要多换几个灯光位置。</p>
        </>,
        <>
          <p>On a fading character line the crease angle shrinks gradually to zero and the line dies into the surface. The highlight goes first: once the angle is small enough, no point on the line can reflect the lamp into your eye, so the highlight either vanishes or slides off onto the surface beside it.</p>
          <p>Where that happens depends on the lamp and the view. Check a fading line under several lamp positions.</p>
        </>,
      ),
      task: { label: t("把标记拖到高光离开线的地方", "Drag the marker to where the highlight leaves the line"), done: near },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("标记位置", "Marker position")} value={s.marker} min={-130} max={130} onChange={(v) => c.setMarker(v)} />
          <LightSlider s={s} c={c} />
          <div className="mt-2">
            <Readout label={t("标记处折角", "Crease angle at the marker")} value={s.angleAtMarker.toFixed(1)} unit="°" />
          </div>
          {near(s) && (
            <Hint>
              {t(
                `高光在这里离开了线，几何上折角却还剩 ${s.angleAtMarker.toFixed(1)}°，线要到 120 mm 处才完全消失。换一个灯光位置，这个点会跟着移动。`,
                `The highlight leaves the line here, yet ${s.angleAtMarker.toFixed(1)}° of crease is still left: the line only vanishes completely at 120 mm. Move the lamp and this point moves too.`,
              )}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("汽车和家电", "Cars and appliances"),
      body: byLocale(
        <>
          <p>人会绕着车走，灯光也在变。特征线把法向的变化集中在几毫米里，所以在很宽的视角和灯光范围里，线上一直有一条高光；大面上的高光则跟着视角跑来跑去。</p>
          <p>车身的腰线、轮眉，家电前板的折边，都是这样用的；渐消让线有起有落，收进面里。</p>
        </>,
        <>
          <p>People walk around a car, and the light keeps changing. A character line packs the change of normal into a few millimetres, so over a wide range of views and lighting the line keeps a highlight, while the highlights on the large surfaces wander as the view moves.</p>
          <p>That's how waistlines and wheel-arch lines on car bodies, and the folded edges of appliance front panels, are used; fading lets a line begin and end, melting into the surface.</p>
        </>,
      ),
      task: { label: t("转动视图，看高光是否还在线上", "Orbit the view and see whether the highlight stays on the line"), done: (s) => s.orbited },
      extra: ({ s, c }) => (
        <>
          <KindSwitch s={s} c={c} />
          <LightSlider s={s} c={c} />
          <WhereReadout s={s} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => c.resetView()}>
            <LocateFixed />
            {t("回到原视角", "Back to the original view")}
          </Button>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("硬折（G0）的特征线，在灯下是什么样？", "What does a hard (G0) character line look like under a lamp?"),
      options: byLocale(["一条细的高光线", "一边亮一边暗的明暗交界", "什么也看不出"], ["A thin line of light", "A light/shadow edge: bright on one side, dark on the other", "Nothing visible"]),
      answer: 1,
      explain: t(
        "硬折处法向突变，中间没有过渡的法向，灯不会在线上反射；两侧的面朝向不同，一亮一暗。",
        "At a hard crease the normal jumps, with no normals in between, so the lamp can't reflect on the line itself; the faces on either side point differently, one bright and one dark.",
      ),
    },
    {
      q: t("想让特征线在更多灯光和视角下都看得见，最直接的改法是？", "To make a character line visible under more lighting and from more angles, what's the most direct change?"),
      options: byLocale(["加大折角", "把两边的面做得更平", "把线做得更长"], ["A bigger crease angle", "Flatter surfaces on either side", "A longer line"]),
      answer: 0,
      explain: t(
        "线能吃到光的角度范围约是折角的两倍：折角越大，范围越宽。面更平、线更长都不改变这个范围。",
        "The range of light a line can catch is about twice its crease angle: the bigger the angle, the wider the range. Flatter faces or a longer line don't change that range.",
      ),
    },
    {
      q: t("渐消特征线上的高光，为什么比几何先离开线？", "Why does the highlight on a fading line leave it before the geometry ends?"),
      options: byLocale(
        ["渲染出了问题", "折角变小后，能把灯反射到眼里的法向范围也变窄；灯不在这个范围里，就没有高光", "渐消的部分不是相切连续的"],
        ["A rendering fault", "As the angle shrinks, so does the range of normals that can reflect the lamp into the eye; with the lamp outside it, there's no highlight", "The fading part isn't tangent-continuous"],
      ),
      answer: 1,
      explain: t(
        "高光要求某一点的法向正好把灯反射到眼里。折角小到不够覆盖这个方向，线还在，线上的高光已经没了；这个点随灯光和视角移动。",
        "A highlight needs a point whose normal reflects the lamp straight into the eye. Once the crease is too shallow to cover that direction, the line is still there but its highlight is gone; the point where that happens moves with the light and the view.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "硬折给明暗交界，小半径的软折给一条细高光线，渐消让线上的高光变细，再离开线",
      "折角决定线能吃到光的范围（约两倍折角），半径决定高光线的宽窄",
      "特征线要在用户真实的视角和灯光下检查：转动灯光和视角，看高光是否留在线上、在哪里离开",
    ],
    [
      "A hard crease gives a light/shadow edge, a soft crease with a small radius a thin line of light, and a fading crease a highlight that thins and then leaves the line",
      "The crease angle sets the range of light the line catches (about twice the angle); the radius sets how wide the line of light is",
      "Check character lines from the user's real viewpoints and lighting: move the light and the view, and see whether the highlight stays on the line and where it leaves",
    ],
  ),
  next: {
    to: "/lesson/proportion-scale",
    label: t("比例、体块与尺度", "Proportion, massing and scale"),
    text: t("从线回到整体：主次体块、视觉重心，以及放到真实尺寸下看。", "From lines back to the whole: primary and secondary masses, the visual centre of mass, and judging at real size."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        {KIND_LABEL[s.kind]}
        {s.kind !== "hard" && ` · R${s.radius}`} · {t(`折角 ${s.angle}°`, `crease ${s.angle}°`)}
      </SceneChip>
      <SceneChip tone="primary">
        <Sun />
        {t("高光", "Highlight")} {WHERE_LABEL[s.where]}
      </SceneChip>
    </div>
  ),
}

export default lesson
