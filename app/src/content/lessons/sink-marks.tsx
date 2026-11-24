import { Link } from "react-router"
import { ArrowDownToLine, Eye, Flame, Scan, View } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { SinkScene, WALL, bossLevel, junction, levelWord, ribLevel, type SinkFinish, type SinkState } from "./sink-marks.scene"
import type { LessonDef } from "./types"

/** 6.3.2 「光面会放大缺陷」. */

const FINISH: Record<SinkFinish, string> = {
  gloss: t("高光", "High gloss"),
  matte: t("哑光", "Matte"),
  texture: t("咬花", "Textured"),
}

const linkCls = "font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"

function RibSlider({ s, c }: { s: SinkState; c: SinkScene }) {
  const rib = (s.rib / 100) * WALL
  const dj = junction(rib)
  return (
    <>
      <ParamSlider
        className="mt-3 px-0"
        label={t("筋厚（占壁厚）", "Rib thickness (of the wall)")}
        unit="%"
        value={s.rib}
        min={30}
        max={100}
        step={5}
        onChange={(v) => c.setRib(v)}
        hint={t(`= ${rib.toFixed(2)} mm，壁厚 ${WALL} mm`, `= ${rib.toFixed(2)} mm; the wall is ${WALL} mm`)}
      />
      <div className="mt-2">
        <Readout label={t("根部内切圆", "Root circle")} value={`Ø${dj.toFixed(2)}`} unit="mm" />
        <Readout label={t("比壁厚多", "Thicker than wall by")} value={`${Math.round((dj / WALL - 1) * 100)}`} unit="%" tone={dj / WALL - 1 > 0.1 ? "warning" : "success"} />
      </div>
    </>
  )
}

function FinishSwitch({ s, c }: { s: SinkState; c: SinkScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("外观面", "Show face")}</span>
      <Segmented
        size="sm"
        aria-label={t("外观面", "Show face")}
        value={s.finish}
        onValueChange={(f: SinkFinish) => c.setFinish(f)}
        options={(["gloss", "matte", "texture"] as SinkFinish[]).map((f) => ({ value: f, label: FINISH[f] }))}
      />
    </div>
  )
}

const lesson: LessonDef<SinkState, SinkScene> = {
  id: "sink-marks",
  codes: ["6.3.2"],
  title: t("光面会放大缺陷", "Sink marks on gloss"),
  create: (v, emit) => new SinkScene(v, emit),
  steps: [
    {
      title: t("背面：筋和凸台", "The back: ribs and a boss"),
      body: byLocale(
        <>
          <p>这是一块注塑外壳，壁厚 {WALL} mm，朝上的一面是外观面。背面有两条加强筋和一个螺丝柱（凸台），左端剖开了，看得到截面。</p>
          <p>筋和壁交接的地方是个 T 字，塑料比壁厚。能塞进去的最大圆（内切圆）就是这里的局部厚度。厚的地方最后冷却、收缩最多，会把正面往里拉。</p>
          <p>
            筋和凸台的拔模、开模方向见
            <Link to="/lesson/draft-analysis" className={linkCls}>
              「注塑：拔模与分型线」
            </Link>
            ，这一课只看厚度。
          </p>
        </>,
        <>
          <p>
            This is a molded housing with a {WALL} mm wall; the face pointing up is the show face. On the back are two ribs and a screw boss, and the left end is cut open so you can see
            the section.
          </p>
          <p>
            Where a rib meets the wall there is a T, and the plastic there is thicker than the wall. The largest circle that fits in (the inscribed circle) is the local thickness.
            Thick spots cool last and shrink the most, and they pull the show face inward.
          </p>
          <p>
            Draft and pull direction for ribs and bosses are covered in{" "}
            <Link to="/lesson/draft-analysis" className={linkCls}>
              Injection molding: draft and parting lines
            </Link>
            ; this lesson is only about thickness.
          </p>
        </>,
      ),
      task: { label: t("拖动筋厚，看根部的内切圆怎么变", "Drag the rib thickness and watch the circle at the root"), done: (s) => s.ribChanged },
      extra: ({ s, c }) => (
        <>
          <RibSlider s={s} c={c} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => c.sectionView()}>
              <Scan />
              {t("看截面", "View the section")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => c.backView()}>
              <ArrowDownToLine />
              {t("看整个背面", "View the whole back")}
            </Button>
          </div>
        </>
      ),
      terms: ["rib"],
    },
    {
      title: t("正面：从倒影里找缩痕", "The front: find the sink marks in the reflections"),
      body: byLocale(
        <>
          <p>正面上方挂着一排平行灯管。高光面像镜子，把灯管映成一条条直线。哪里的倒影弯了，哪里的表面就不平。</p>
          <p>现在筋和壁一样厚，凸台是实心的。CAD 里这一面是平的，注塑冷却以后呢？</p>
        </>,
        <>
          <p>A row of parallel light tubes hangs above the front. A glossy face works like a mirror and shows each tube as a straight line. Wherever a reflection bends, the surface isn't flat.</p>
          <p>Right now the ribs are as thick as the wall and the boss is solid. In CAD this face is flat. What about once it's molded and cooled?</p>
        </>,
      ),
      task: {
        label: t("注塑以后，在正面点出两处缩痕：一处在筋的背后，一处在凸台的背后", "After molding, click the two sink marks on the front: one behind a rib, one behind the boss"),
        done: (s) => s.foundRib && s.foundBoss,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            key="mold"
            question={t("筋和壁一样厚、凸台实心，注塑出来正面会怎样？", "Ribs as thick as the wall, a solid boss. How does the front come out of the mold?")}
            options={byLocale(
              ["完全平整，背面的东西看不出来", "筋和凸台的正对面各有一道浅凹，倒影在那里弯了", "正对面会鼓起来"],
              ["Perfectly flat; nothing on the back shows", "A shallow dip opposite each rib and the boss, where the reflections bend", "It bulges out opposite them"],
            )}
            answer={1}
            explain={t(
              "厚的根部最后冷却，收缩时把还软的表面往里拉，形成浅凹。这里把凹陷放大了显示，真实的缩痕很浅，但高光面上照样一眼可见。",
              "The thick root cools last and, as it shrinks, pulls the still-soft surface in, leaving a shallow dip. The dents are exaggerated here; real sink marks are very shallow, yet on a glossy face they still catch the eye.",
            )}
            onReveal={() => c.mold()}
          />
          {s.shrink < 1 && (
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.mold()}>
              <Flame />
              {t("注塑冷却", "Mold and cool")}
            </Button>
          )}
          {s.shrink >= 1 && !(s.foundRib && s.foundBoss) && s.misses > 0 && (
            <Hint tone="warning">{t("这里的倒影是直的。找灯管的倒影拐弯的地方。", "The reflections are straight here. Look for where the tubes' reflections kink.")}</Hint>
          )}
        </>
      ),
    },
    {
      title: t("把筋减薄", "Make the ribs thinner"),
      body: byLocale(
        <>
          <p>
            Protolabs 的注塑设计指南建议：筋厚取相邻壁厚的 40–60 %，大约一半。这样根部比壁厚多不了多少，缩痕就小了。
          </p>
          <p>不同塑料收缩不一样，高光、深色的外观面最挑剔：这时往下限取。筋薄了刚度不够，就加高或多加几条，而不是加厚。</p>
        </>,
        <>
          <p>
            Protolabs' molding design guide recommends a rib 40–60 % as thick as the wall it stands on, about half. Then the root is barely thicker than the wall, and the sink mark
            stays small.
          </p>
          <p>Plastics shrink differently, and glossy, dark show faces are the pickiest: go to the low end there. If a thinner rib is too weak, make it taller or add more ribs, not thicker.</p>
        </>,
      ),
      task: { label: t("把筋减到壁厚的 60 % 以下，看倒影变直", "Take the ribs below 60 % of the wall and watch the reflections straighten"), done: (s) => s.rib <= 60 },
      extra: ({ s, c }) => (
        <>
          <RibSlider s={s} c={c} />
          <div className="mt-1">
            <Readout label={t("筋背后的缩痕", "Sink behind the ribs")} value={levelWord(ribLevel(s.rib))} tone={ribLevel(s.rib) < 0.3 ? "success" : "warning"} />
          </div>
          {s.rib < 40 && (
            <Hint tone="warning">
              {t("再薄就不好充满，筋也太软。40 % 左右是常见的下限。", "Any thinner and the rib is hard to fill and too flexible. Around 40 % is the usual lower limit.")}
            </Hint>
          )}
        </>
      ),
      terms: ["rib"],
    },
    {
      title: t("厚的地方掏空", "Core out the thick spots"),
      body: byLocale(
        <>
          <p>实心凸台根部厚 8 mm，是壁厚的三倍多：正面那块凹陷最重，减薄筋也救不了它。</p>
          <p>办法是掏空：中间留孔，凸台的壁像筋一样取壁厚的 60 % 左右。别的厚块也一样，把实心改成均匀的薄壁再加筋，各处壁厚接近，冷却就均匀。</p>
        </>,
        <>
          <p>The solid boss is 8 mm thick at the root, more than three times the wall: the dent opposite it is the worst, and thinning the ribs doesn't help it.</p>
          <p>
            The fix is to core it out: leave a hole in the middle and make the boss wall about 60 % of the wall, like a rib. The same goes for any other thick block: turn solid into
            an even, thin wall plus ribs, so the thickness is similar everywhere and the part cools evenly.
          </p>
        </>,
      ),
      task: { label: t("把凸台掏空", "Core out the boss"), done: (s) => s.cored },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("凸台", "Boss")}</span>
            <Segmented
              size="sm"
              aria-label={t("凸台", "Boss")}
              value={s.cored ? "cored" : "solid"}
              onValueChange={(v) => c.setCored(v === "cored")}
              options={[
                { value: "solid", label: t("实心", "Solid") },
                { value: "cored", label: t("掏空", "Cored") },
              ]}
            />
          </div>
          <div className="mt-3">
            <Readout label={t("凸台背后的缩痕", "Sink behind the boss")} value={levelWord(bossLevel(s.cored))} tone={s.cored ? "success" : "warning"} />
          </div>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => c.backView()}>
            <ArrowDownToLine />
            {t("看背面", "View the back")}
          </Button>
        </>
      ),
    },
    {
      title: t("表面会放大，也会掩盖", "A surface can magnify, or hide"),
      body: byLocale(
        <>
          <p>筋和凸台改回了原来的厚度，缩痕都在。换个外观面看：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>高光：凹陷在倒影里弯成一道折，深色更显。</li>
            <li>哑光：倒影散开，只剩一点明暗。</li>
            <li>咬花：纹理把光打乱，同样的凹陷几乎看不出。</li>
          </ul>
          <p>
            所以高光面的筋要按下限取，咬花面宽松一些。但咬花不是遮丑布：它要更大的拔模角，见
            <Link to="/lesson/texture-draft" className={linkCls}>
              「咬花与拔模」
            </Link>
            。保压和冷却能减轻缩痕，但先把壁厚做均匀。
          </p>
        </>,
        <>
          <p>The ribs and boss are back to their original thickness, sink marks and all. Now change the show face:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>High gloss: the dent bends the reflections into a kink, and dark colors show it even more.</li>
            <li>Matte: the reflections spread out, leaving only a faint shading.</li>
            <li>Textured: the grain scrambles the light, and the same dent all but disappears.</li>
          </ul>
          <p>
            So ribs behind a gloss face go to the low end, and a textured face is more forgiving. But texture isn't a cover-up: it needs more draft (see{" "}
            <Link to="/lesson/texture-draft" className={linkCls}>
              Texture and draft
            </Link>
            ). Packing pressure and cooling can reduce sink, but get the wall thickness even first.
          </p>
        </>,
      ),
      task: { label: t("高光和咬花都看一遍", "Look at both gloss and texture"), done: (s) => s.seenGloss && s.seenTexture },
      extra: ({ s, c }) => (
        <>
          <Predict
            key="finish"
            question={t("同样的缩痕，把外观面换成咬花，会怎样？", "Same sink marks, but the show face is textured. What happens?")}
            options={byLocale(["一样明显", "几乎看不出", "更明显"], ["Just as obvious", "Barely visible", "More obvious"])}
            answer={1}
            explain={t(
              "凹陷还在，深度一点没变；只是纹理本身就把反光打乱了，眼睛找不到一条直的倒影去比较。",
              "The dent is still there, just as deep; the texture already scrambles the reflections, so the eye has no straight reflection to compare against.",
            )}
            onReveal={() => c.setFinish("texture")}
          />
          <FinishSwitch s={s} c={c} />
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("高光外观面的背面要加一条筋，壁厚 2 mm。筋厚先取多少？", "You're adding a rib behind a glossy show face with a 2 mm wall. What thickness do you start with?"),
      options: byLocale(
        ["2 mm，和壁一样厚才结实", "1 mm 左右，约壁厚的一半", "3 mm，厚一点不容易变形"],
        ["2 mm; as thick as the wall makes it strong", "About 1 mm, roughly half the wall", "3 mm; thicker won't deform"],
      ),
      answer: 1,
      explain: t(
        "常见的指南是壁厚的 40–60 %，高光面往下限取。要更硬就把筋加高或加几条；筋越厚，根部越厚，缩痕越深。",
        "The usual guideline is 40–60 % of the wall, at the low end behind gloss. For more stiffness make the rib taller or add ribs; a thicker rib makes a thicker root and a deeper sink.",
      ),
    },
    {
      q: t("一个实心厚凸台正对着高光面，正面出现一圈凹陷。最根本的改法是？", "A thick solid boss sits behind a glossy face, and a round dent shows on the front. What's the real fix?"),
      options: byLocale(
        ["把正面抛得更亮", "把凸台掏空，让各处壁厚接近", "加大保压就行，不用改设计"],
        ["Polish the front even brighter", "Core out the boss so the thickness is similar everywhere", "Just raise the packing pressure; no design change needed"],
      ),
      answer: 1,
      explain: t(
        "更亮只会更显。保压能减轻一些，但根源是那块厚料最后冷却收缩；掏空以后壁厚均匀，问题才真正消失。",
        "A brighter finish only shows it more. Packing can reduce it somewhat, but the cause is the thick lump cooling and shrinking last; core it out so the walls are even, and the problem actually goes away.",
      ),
    },
    {
      q: t("同一个零件，哪种外观面最容易看出缩痕？", "On the same part, which show face reveals sink marks most easily?"),
      options: byLocale(["深色高光", "浅色咬花", "浅色哑光"], ["Dark high gloss", "Light textured", "Light matte"]),
      answer: 0,
      explain: t(
        "高光面像镜子，凹陷让倒影弯掉；深色几乎没有漫反射去冲淡倒影，所以最显。咬花和哑光把光打散，凹陷容易被掩盖。",
        "A glossy face is a mirror and the dent bends the reflections; a dark color has almost no diffuse light to wash them out, so it shows most. Texture and matte scatter the light and tend to hide the dent.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "缩痕来自厚的地方：筋根、凸台、局部加厚，它们最后冷却、收缩最多，把外观面拉凹",
      "筋厚取壁厚的 40–60 %（约一半），高光面取下限；厚块掏空，让壁厚均匀",
      "高光、深色最显缩痕，哑光和咬花能掩盖；先把壁厚做对，别指望表面遮丑",
    ],
    [
      "Sink marks come from thick spots: rib roots, bosses, local thickening. They cool last, shrink most and pull the show face in",
      "Make ribs 40–60 % of the wall (about half), at the low end behind gloss; core out thick blocks so the wall stays even",
      "Gloss and dark colors show sink most, matte and texture hide it; get the wall thickness right first instead of counting on the finish",
    ],
  ),
  next: {
    to: "/lesson/stiffness-ribs",
    label: t("加强筋与刚度", "Ribs and stiffness"),
    text: t("筋只能薄，那怎么让零件够硬：筋的高度、间距和走向。", "Ribs have to stay thin, so how do you make a part stiff: rib height, spacing and direction."),
  },
  overlay: ({ s, c }) => (
    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
      <SceneChip>
        <Eye />
        {FINISH[s.finish]} · {t(`筋 ${s.rib}% 壁厚`, `Rib ${s.rib}% of wall`)} · {s.cored ? t("凸台掏空", "Cored boss") : t("凸台实心", "Solid boss")}
      </SceneChip>
      {s.shrink > 0 && <SceneChip tone="primary">{t("凹陷放大显示", "Dents exaggerated")}</SceneChip>}
      <button type="button" className="pointer-events-auto" onClick={() => (s.step === 0 ? c.sectionView() : c.frontView())} title={t("回到原视角", "Back to the original view")}>
        <SceneChip>
          <View />
        </SceneChip>
      </button>
    </div>
  ),
}

export default lesson
