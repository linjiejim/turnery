import { Hand } from "lucide-react"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { DARK_WEIGHT, HAND_BREADTH, type Kettle } from "./proportion-scale.model"
import { PropScene, type PropState } from "./proportion-scale.scene"
import type { LessonDef } from "./types"

/** 6.1.4 「比例、体块与尺度」. */

const pct = (v: number) => `${Math.round(v * 100)}%`

type SliderKey = "bodyH" | "bodyD" | "taper" | "baseH" | "lidH" | "handle" | "spout"

const SLIDERS: Record<SliderKey, { label: string; min: number; max: number; step: number; unit: string }> = {
  bodyH: { label: t("壶身高度", "Body height"), min: 100, max: 260, step: 2, unit: "mm" },
  bodyD: { label: t("壶身直径", "Body diameter"), min: 110, max: 200, step: 2, unit: "mm" },
  taper: { label: t("收口（上口 / 下口）", "Taper (top / bottom)"), min: 0.6, max: 1.1, step: 0.02, unit: "" },
  baseH: { label: t("底座高度", "Base height"), min: 4, max: 50, step: 1, unit: "mm" },
  lidH: { label: t("壶盖高度", "Lid height"), min: 4, max: 50, step: 1, unit: "mm" },
  handle: { label: t("把手大小", "Handle size"), min: 0.6, max: 1.4, step: 0.05, unit: "×" },
  spout: { label: t("壶嘴大小", "Spout size"), min: 0, max: 1.8, step: 0.05, unit: "×" },
}

function Sliders({ s, c, keys }: { s: PropState; c: PropScene; keys: SliderKey[] }) {
  return (
    <div className="mt-3">
      {keys.map((k) => {
        const d = SLIDERS[k]
        return <ParamSlider key={k} className="px-0" label={d.label} value={s[k as keyof Kettle] as number} min={d.min} max={d.max} step={d.step} unit={d.unit} onChange={(v) => c.setParam(k, v)} />
      })}
    </div>
  )
}

function Display({ s, c }: { s: PropState; c: PropScene }) {
  const value = s.silhouette ? "sil" : s.levels ? "levels" : "real"
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("显示", "Display")}</span>
      <Segmented
        size="sm"
        aria-label={t("显示", "Display")}
        value={value}
        onValueChange={(v) => {
          if (v === "sil") c.setFlag("silhouette", true)
          else if (v === "levels") c.setFlag("levels", true)
          else {
            c.setFlag("levels", false)
            c.setFlag("silhouette", false)
          }
        }}
        options={[
          { value: "levels", label: t("按层级上色", "By level") },
          { value: "real", label: t("实际颜色", "Real colours") },
          { value: "sil", label: t("只看轮廓", "Outline only") },
        ]}
      />
    </div>
  )
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-small font-medium">{label}</span>
      <Segmented
        size="sm"
        aria-label={label}
        value={on ? "on" : "off"}
        onValueChange={(v) => onChange(v === "on")}
        options={[
          { value: "off", label: t("关", "Off") },
          { value: "on", label: t("开", "On") },
        ]}
      />
    </div>
  )
}

function Shares({ s }: { s: PropState }) {
  return (
    <div className="mt-2 flex flex-wrap gap-y-1">
      <Readout label={t("主体", "Primary")} value={pct(s.m.share[1])} tone={s.m.share[1] >= 0.6 ? "success" : "warning"} />
      <Readout label={t("次级", "Secondary")} value={pct(s.m.share[2])} />
      <Readout label={t("细节", "Tertiary")} value={pct(s.m.share[3])} />
    </div>
  )
}

const opening = (s: PropState) => Math.round(s.m.opening)
const tip = (s: PropState) => Math.min(s.m.tipHandle, s.m.tipSpout)

const lesson: LessonDef<PropState, PropScene> = {
  id: "proportion-scale",
  codes: ["6.1.4"],
  title: t("比例、体块与尺度", "Proportion, massing and scale"),
  create: (v, emit) => new PropScene(v, emit),
  steps: [
    {
      title: t("主体、次级、细节", "Primary, secondary, tertiary"),
      body: byLocale(
        <>
          <p>一个电水壶由几块体积组成。壶身是主体，决定整体轮廓；底座、壶盖、把手、壶嘴是次级体块，贴在主体上、改变轮廓；旋钮、开关是细节，走近了才看得清。</p>
          <p>看造型从大到小：先主体，再次级，最后细节。眯起眼睛只看轮廓，是检查主次的老办法：细节没了，剩下的应该一眼就读得出是什么东西。</p>
        </>,
        <>
          <p>
            An electric kettle is made of a few masses. The body is the primary mass: it sets the overall outline. The base, lid, handle and spout are secondary masses that attach to it and change the outline. The knob and
            the switch are tertiary details you only make out up close.
          </p>
          <p>Read a form from large to small: primary first, then secondary, details last. Squinting so you see only the outline is the old way to check this: with the details gone, what's left should still tell you at a glance what the object is.</p>
        </>,
      ),
      task: { label: t("眯眼看一次：切到只看轮廓", "Squint once: switch to outline only"), done: (s) => s.seenSil },
      extra: ({ s, c }) => (
        <>
          <Display s={s} c={c} />
          <p className="mt-3 text-small text-muted-foreground">{t("各层级占正面轮廓的面积：", "Share of the front outline by level:")}</p>
          <Shares s={s} />
        </>
      ),
    },
    {
      title: t("次级体块别抢主体", "Secondary masses mustn't compete"),
      body: byLocale(
        <>
          <p>现在底座和壶盖都快赶上壶身了，轮廓读起来像三块叠在一起的东西，分不出哪块是水壶。</p>
          <p>主体占轮廓多少可以量。把它调回到明显占优，让次级体块小一号。具体比例没有标准，因产品而异；能检查的是主次分不分得开。</p>
        </>,
        <>
          <p>Right now the base and the lid are almost as big as the body, and the outline reads as three blocks stacked up: you can't tell which one is the kettle.</p>
          <p>How much of the outline the primary mass takes can be measured. Bring it back so it clearly dominates and the secondary masses are a size smaller. There's no standard ratio, and it varies by product; what you can check is whether the levels are clearly apart.</p>
        </>,
      ),
      task: { label: t("让主体占正面轮廓 60% 以上", "Make the primary mass at least 60% of the front outline"), done: (s) => s.m.share[1] >= 0.6 },
      extra: ({ s, c }) => (
        <>
          <Sliders s={s} c={c} keys={["bodyH", "bodyD", "baseH", "lidH", "handle"]} />
          <Shares s={s} />
          <Display s={s} c={c} />
        </>
      ),
    },
    {
      title: t("视觉重心", "The visual centre of mass"),
      body: byLocale(
        <>
          <p>把正面轮廓当成一块均匀的薄板，它的重心就是这里画的视觉重心。</p>
          <p>深色看起来更重：Alexander 和 Shansky 1976 年的实验里，颜色越深，人判断的重量越大。所以深色的底座和旋钮按 {DARK_WEIGHT} 倍算。这个倍数是本课的假设，不是定律。</p>
        </>,
        <>
          <p>Treat the front outline as a thin, even plate. Its centre of mass is the visual centre of mass drawn here.</p>
          <p>
            Dark looks heavier: in Alexander and Shansky's 1976 experiment, the darker a colour, the heavier people judged it. So the dark base and knob count {DARK_WEIGHT} times. That factor is this lesson's assumption, not a
            law.
          </p>
        </>,
      ),
      task: { label: t("调壶嘴和把手，让视觉重心离中线不超过 5 mm", "Adjust the spout and handle until the visual centre is within 5 mm of the centre line"), done: (s) => Math.abs(s.m.cx) <= 5 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把手加大，视觉重心会往哪里移？", "Make the handle bigger. Where does the visual centre move?")}
            options={byLocale(["往把手一侧移", "不动：把手是个空心的环，不算", "往壶嘴一侧移"], ["Towards the handle", "Nowhere: the handle is a hollow loop and doesn't count", "Towards the spout"])}
            answer={0}
            explain={t(
              "把手虽然是环，在轮廓里也占面积，而且全在一侧。重心往把手那边偏；对面的壶嘴可以把它拉回来，这也是把手和壶嘴常常一起考虑的原因。",
              "The handle is a loop, but it still takes up area in the outline, all on one side. The centre shifts towards it; the spout opposite can pull it back, which is one reason handle and spout are designed together.",
            )}
            onReveal={() => c.setParam("handle", 1.4)}
          />
          <Sliders s={s} c={c} keys={["handle", "spout"]} />
          <Toggle label={t(`深色按 ${DARK_WEIGHT} 倍算`, `Dark counts ${DARK_WEIGHT}×`)} on={s.darkHeavy} onChange={(on) => c.setFlag("darkHeavy", on)} />
          <div className="mt-2 flex flex-wrap gap-y-1">
            <Readout label={t("偏离中线", "Off centre")} value={s.m.cx.toFixed(1)} unit="mm" tone={Math.abs(s.m.cx) <= 5 ? "success" : undefined} />
            <Readout label={t("高度", "Height")} value={pct(s.m.czShare)} unit={t("总高", "of total")} />
          </div>
        </>
      ),
    },
    {
      title: t("看起来稳不稳", "Does it look stable?"),
      body: byLocale(
        <>
          <p>视觉重心越低、越在底座正上方，看起来越稳。图上两条斜线是倾倒角：这块薄板绕底座边缘要歪多少度才会倒。底座越宽、重心越低，角度越大。</p>
          <p>做高的产品，常用上小下大的收口和深色底座把重心拉低；有研究发现，深色放在下方会让物体看起来更稳。真实水壶稳不稳还要看实际重量和装了多少水，这里只看形。</p>
        </>,
        <>
          <p>The lower the visual centre and the more squarely over the base, the steadier it looks. The two slanted lines show the tipping angles: how far this plate can lean about the edge of the base before it falls. A wider base and a lower centre give bigger angles.</p>
          <p>
            For tall products, a taper that's narrower at the top and a dark base are the usual ways to bring the centre down; research has found that dark at the bottom makes objects look more stable. Whether a real kettle
            is stable also depends on its real weight and how much water is in it; here we look only at form.
          </p>
        </>,
      ),
      task: {
        label: t("做一个高壶：总高至少是底座直径的 1.6 倍，视觉重心低于总高的 45%", "Make a tall kettle: at least 1.6 times as tall as the base is wide, with the visual centre below 45% of the height"),
        done: (s) => s.m.height >= 1.6 * s.m.baseD && s.m.czShare < 0.45,
      },
      extra: ({ s, c }) => (
        <>
          <Sliders s={s} c={c} keys={["bodyH", "bodyD", "taper", "baseH", "lidH"]} />
          <Toggle label={t(`深色按 ${DARK_WEIGHT} 倍算`, `Dark counts ${DARK_WEIGHT}×`)} on={s.darkHeavy} onChange={(on) => c.setFlag("darkHeavy", on)} />
          <div className="mt-2 flex flex-wrap gap-y-1">
            <Readout label={t("高 / 底座直径", "Height / base")} value={(s.m.height / s.m.baseD).toFixed(2)} tone={s.m.height >= 1.6 * s.m.baseD ? "success" : undefined} />
            <Readout label={t("重心高度", "Centre height")} value={pct(s.m.czShare)} tone={s.m.czShare < 0.45 ? "success" : undefined} />
            <Readout label={t("倾倒角", "Tipping angle")} value={tip(s).toFixed(0)} unit="°" />
          </div>
        </>
      ),
    },
    {
      title: t("放到真实尺寸", "At real size"),
      body: byLocale(
        <>
          <p>同一个造型，5 cm 高是个调料瓶或玩具，50 cm 高是一口落地的大缸。人判断大小，靠旁边熟悉的东西：手、桌子、门。</p>
          <p>旁边这只手按真实大小画：四指并拢宽 {HAND_BREADTH} mm（接近成年男性的平均掌宽，女性平均约 75–80 mm），长约 18 cm。</p>
        </>,
        <>
          <p>The same form is a spice shaker or a toy at 5 cm tall, and a floor-standing urn at 50 cm. People judge size from familiar things beside it: a hand, a table, a door.</p>
          <p>The hand here is drawn at real size: {HAND_BREADTH} mm across four fingers (close to the average adult man's hand breadth; the average for women is about 75–80 mm), about 18 cm long.</p>
        </>,
      ),
      task: { label: t("把产品缩到 7 cm 以下，再放大到 40 cm 以上", "Shrink the product below 7 cm, then enlarge it above 40 cm"), done: (s) => s.seenSmall && s.seenLarge },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("产品高度", "Product height")} value={Math.round(s.m.height)} min={50} max={500} step={5} onChange={(v) => c.setHeight(v)} />
          <Toggle label={t("显示真实大小的手", "Show a real-size hand")} on={s.showHand} onChange={(on) => c.setFlag("showHand", on)} />
          <div className="mt-2">
            <Readout label={t("把手内空", "Handle opening")} value={opening(s)} unit="mm" tone={s.m.opening >= HAND_BREADTH ? "success" : "warning"} />
          </div>
        </>
      ),
    },
    {
      title: t("按人定的尺寸不缩放", "Sizes set by people don't scale"),
      body: byLocale(
        <>
          <p>把手要伸进四指，内空至少要有一个手掌宽；旋钮、按键按手指的大小来定。这些尺寸不跟着产品缩放。</p>
          <p>按比例缩小水壶，把手很快就放不进手。反过来让把手保持手的尺寸，小水壶的比例就全变了。所以比例要在真实尺寸下判断，一个造型不能直接缩放成另一个尺寸的产品。</p>
        </>,
        <>
          <p>Four fingers have to go through the handle, so its opening must be at least a hand's breadth; knobs and buttons are sized for fingers. None of these scale with the product.</p>
          <p>
            Scale the kettle down in proportion and the handle soon won't take a hand. Keep the handle at hand size instead, and the small kettle's proportions change completely. So judge proportions at real size: a form
            can't simply be scaled into a product of another size.
          </p>
        </>,
      ),
      task: {
        label: t("按比例缩放，找到四指刚好放得进的最小尺寸（内空 85–95 mm）", "Scaling in proportion, find the smallest size whose handle still takes four fingers (85–95 mm opening)"),
        done: (s) => !s.humanHandle && s.m.opening >= HAND_BREADTH && s.m.opening <= 95,
      },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("产品高度", "Product height")} value={Math.round(s.m.height)} min={50} max={500} step={5} onChange={(v) => c.setHeight(v)} />
          <Toggle label={t("把手按人手定尺寸", "Handle sized by the hand")} on={s.humanHandle} onChange={(on) => c.setFlag("humanHandle", on)} />
          <div className="mt-2">
            <Readout label={t("把手内空", "Handle opening")} value={opening(s)} unit="mm" tone={s.m.opening >= HAND_BREADTH ? "success" : "warning"} />
          </div>
          {s.humanHandle && s.m.height < 150 && (
            <Hint>
              {t("把手还是手的尺寸，水壶却小了：比例完全变了。小尺寸的产品要换一种握法，而不是把大的缩小。", "The handle is still hand-sized while the kettle has shrunk: the proportions have changed completely. A small product needs a different grip, not a scaled-down big one.")}
            </Hint>
          )}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("眯起眼睛只看轮廓检查造型，主要在看什么？", "When you squint to see only the outline of a form, what are you mainly checking?"),
      options: byLocale(
        ["细节做得精不精致", "主体和次级体块的关系能不能一眼读出来", "颜色搭不搭"],
        ["Whether the details are refined", "Whether the relationship between primary and secondary masses reads at a glance", "Whether the colours go together"],
      ),
      answer: 1,
      explain: t(
        "眯眼会把细节抹掉，只留下大的体块。如果这时读不出主次、认不出是什么东西，细节做得再好也救不回来。",
        "Squinting wipes out the details and leaves only the big masses. If the primary and secondary masses don't read then, and you can't tell what the object is, no amount of detail will save it.",
      ),
    },
    {
      q: t("「比例按黄金比例 1.618 来定，产品就会好看。」这句话怎么样？", "“Set proportions by the golden ratio, 1.618, and the product will look good.” Is that right?"),
      options: byLocale(
        ["对，这是验证过的美学规律", "不成立：心理学研究对它的结论并不一致，它不是设计规则；比例要按功能、主次和真实尺寸判断", "只对圆柱形的产品成立"],
        [
          "Yes, it's a proven law of aesthetics",
          "No: psychology research on it is inconsistent, and it isn't a design rule; judge proportions by function, hierarchy and real size",
          "Only for cylindrical products",
        ],
      ),
      answer: 1,
      explain: t(
        "黄金比例偏好的实验结果并不一致，很多「黄金比例产品」是事后量出来的。能检查的是：主次分不分得开、重心稳不稳、在真实尺寸下用不用得了。",
        "Experiments on a preference for the golden ratio are inconsistent, and many “golden ratio products” were measured after the fact. What you can check is whether the masses are clearly ranked, whether it looks stable, and whether it works at its real size.",
      ),
    },
    {
      q: t("把一个水壶的模型整体缩小一半，做成迷你款，最可能出什么问题？", "You scale a kettle model down by half to make a mini version. What's the most likely problem?"),
      options: byLocale(
        ["没有问题，比例没变", "把手、按键这些按人手定的尺寸也被缩小了，手放不进、按不准", "视觉重心会变高"],
        ["None: the proportions haven't changed", "Sizes set by the hand, like the handle and buttons, shrink too, so fingers don't fit and buttons are hard to press", "The visual centre moves up"],
      ),
      answer: 1,
      explain: t(
        "整体缩放时比例和重心都不变，变的是和人有关的尺寸。人的手不会跟着缩小，所以小尺寸的产品要重新安排比例和握法。",
        "Scaling everything keeps the proportions and the centre the same; what breaks are the sizes tied to people. Hands don't shrink with it, so a smaller product needs its proportions and grip worked out again.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先读主体，再读次级体块，细节最后；眯眼只看轮廓时，主次应该一眼分得开",
      "视觉重心可以量：正面轮廓的形心，深色算重一些；低而居中显得稳，上小下大和深色底座能把它拉低",
      "比例要在真实尺寸下判断：按人手定的尺寸不跟着缩放，同一个造型放大缩小就不再成立",
    ],
    [
      "Read the primary mass first, then the secondary ones, details last; when you squint at the outline, the levels should separate at a glance",
      "The visual centre can be measured: the centroid of the front outline, with dark parts counting extra. Low and centred looks stable; a taper and a dark base pull it down",
      "Judge proportions at real size: sizes set by the hand don't scale, so a form scaled up or down no longer holds",
    ],
  ),
  next: {
    to: "/lesson/anthropometry",
    label: t("人体尺寸与百分位", "Anthropometry and percentiles"),
    text: t("手有多大、按 P5 还是 P95 定尺寸，以及为什么「平均人」并不存在。", "How big hands are, when to design for P5 or P95, and why the “average person” doesn't exist."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        {s.showHand && <Hand />}
        {t(`高 ${Math.round(s.m.height)} mm`, `${Math.round(s.m.height)} mm tall`)}
      </SceneChip>
      {s.step >= 2 && s.step <= 3 && (
        <SceneChip tone="primary">
          {t(`视觉重心：${pct(s.m.czShare)} 总高 · 偏 ${s.m.cx.toFixed(1)} mm`, `Visual centre: ${pct(s.m.czShare)} of height · ${s.m.cx.toFixed(1)} mm off`)}
        </SceneChip>
      )}
      {s.step <= 1 && <SceneChip tone="primary">{t(`主体占 ${pct(s.m.share[1])}`, `Primary ${pct(s.m.share[1])}`)}</SceneChip>}
    </div>
  ),
}

export default lesson
