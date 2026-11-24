import { Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { density, shareBelow, type Group } from "./anthropometry.data"
import {
  AnthropometryScene,
  breadthOf,
  coverage,
  FUNNEL,
  FUNNEL_DIMS,
  HB,
  SIZE_NAMES,
  WINDOWS,
  type AnthroState,
  type Strategy,
} from "./anthropometry.scene"
import type { LessonDef } from "./types"

/** 6.2.1 「人体尺寸与百分位」: distributions, percentiles, design for the extremes, one size / sizes / adjustable, no average person. */

const GROUP_NAME: Record<Group, string> = { f: t("女性", "Women"), m: t("男性", "Men") }
const STRATEGY_NAME: Record<Strategy, string> = { one: t("均码", "One size"), sizes: t("分码", "Sizes"), adjust: t("可调", "Adjustable") }

/** A share as a percentage that never claims 0% or 100%. */
const pc = (x: number) => (x >= 0.995 ? ">99%" : x < 0.005 ? "<1%" : `${Math.round(x * 100)}%`)

function GroupSwitch({ s, c }: { s: AnthroState; c: AnthropometryScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("人群", "Group")}</span>
      <Segmented
        size="sm"
        aria-label={t("人群", "Group")}
        value={s.group}
        onValueChange={(g: Group) => c.setGroup(g)}
        options={(["f", "m"] as Group[]).map((g) => ({ value: g, label: GROUP_NAME[g] }))}
      />
    </div>
  )
}

function PctSlider({ s, c }: { s: AnthroState; c: AnthropometryScene }) {
  return (
    <ParamSlider
      className="mt-2 px-0"
      label={t("这只手的百分位 P", "This hand's percentile P")}
      unit=""
      value={s.pct}
      min={1}
      max={99}
      onChange={(v) => c.setPct(v)}
      hint={t(`手宽 ${breadthOf(s.group, s.pct).toFixed(0)} mm`, `Hand breadth ${breadthOf(s.group, s.pct).toFixed(0)} mm`)}
    />
  )
}

// ------------------------------------------------------------------ the chart

const W = 288
const H = 150
const X0 = 60
const X1 = 110
const BASE = 118
const px = (mm: number) => 10 + ((mm - X0) / (X1 - X0)) * (W - 20)
const PEAK = density(HB.f, HB.f.mean)
const py = (d: number) => BASE - (d / PEAK) * 92

function curve(g: Group, to = X1, close = false) {
  const pts: string[] = []
  for (let x = X0; x <= to + 1e-6; x += 0.5) pts.push(`${px(x).toFixed(1)},${py(density(HB[g], x)).toFixed(1)}`)
  if (to < X1) pts.push(`${px(to).toFixed(1)},${py(density(HB[g], to)).toFixed(1)}`)
  return close ? `M${px(X0)},${BASE} L${pts.join(" L")} L${px(Math.min(to, X1)).toFixed(1)},${BASE} Z` : `M${pts.join(" L")}`
}

function DistChart({ s }: { s: AnthroState }) {
  const B = breadthOf(s.group, s.pct)
  const shade = s.step === 2 || (s.step === 1 && s.revealed)
  const tone = (g: Group) => (g === "f" ? "text-primary" : "text-foreground")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block text-foreground" aria-label={t("手宽分布", "Hand breadth distribution")}>
      {s.step === 3 &&
        WINDOWS[s.strategy].map(([a, b], i) => (
          <g key={i} className="text-primary">
            <rect x={px(a)} y={18} width={px(b) - px(a)} height={BASE - 18} fill="currentColor" fillOpacity={0.1} stroke="currentColor" strokeOpacity={0.4} />
            {s.strategy === "sizes" && (
              <text x={(px(a) + px(b)) / 2} y={30} textAnchor="middle" fill="currentColor" className="text-caption font-medium">
                {SIZE_NAMES[i]}
              </text>
            )}
          </g>
        ))}
      {(["f", "m"] as Group[]).map((g) => (
        <g key={g} className={tone(g)}>
          <path d={curve(g, X1, true)} fill="currentColor" fillOpacity={0.06} />
          {shade && <path d={curve(g, Math.min(s.opening, X1), true)} fill="currentColor" fillOpacity={0.22} />}
          <path d={curve(g)} fill="none" stroke="currentColor" strokeWidth={1.5} />
        </g>
      ))}
      <line x1={10} x2={W - 10} y1={BASE} y2={BASE} stroke="currentColor" strokeOpacity={0.4} />
      {[60, 70, 80, 90, 100, 110].map((x) => (
        <g key={x} className="text-muted-foreground">
          <line x1={px(x)} x2={px(x)} y1={BASE} y2={BASE + 4} stroke="currentColor" />
          <text x={px(x)} y={BASE + 16} textAnchor="middle" fill="currentColor" className="text-caption tabular">
            {x}
          </text>
        </g>
      ))}
      {(s.step === 1 || s.step === 2) && (
        <g className="text-destructive">
          <line x1={px(s.opening)} x2={px(s.opening)} y1={12} y2={BASE} stroke="currentColor" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={px(s.opening) + 4} y={14} fill="currentColor" className="text-caption">
            {t("开口", "Opening")}
          </text>
        </g>
      )}
      <g className={tone(s.group)}>
        <line x1={px(B)} x2={px(B)} y1={py(density(HB[s.group], B))} y2={BASE} stroke="currentColor" strokeWidth={2} />
        <circle cx={px(B)} cy={py(density(HB[s.group], B))} r={3.5} fill="currentColor" />
      </g>
      <g className="text-caption">
        <rect x={W - 86} y={4} width={9} height={9} className="text-primary" fill="currentColor" fillOpacity={0.6} />
        <text x={W - 73} y={12.5} fill="currentColor">
          {GROUP_NAME.f}
        </text>
        <rect x={W - 44} y={4} width={9} height={9} className="text-foreground" fill="currentColor" fillOpacity={0.6} />
        <text x={W - 31} y={12.5} fill="currentColor">
          {GROUP_NAME.m}
        </text>
      </g>
    </svg>
  )
}

function Funnel({ s }: { s: AnthroState }) {
  const bar = (n: number) => Math.max(n > 0 ? 2 : 0, (n / FUNNEL[0]) * 130)
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <span className="w-24 truncate">{t("全部", "Everyone")}</span>
        <span className="h-2 rounded-xs bg-current opacity-40" style={{ width: bar(FUNNEL[0]) }} />
        <span className="font-mono tabular">{FUNNEL[0]}</span>
      </div>
      {FUNNEL_DIMS.map((name, i) => {
        const n = FUNNEL[i + 1]
        const on = i < s.dims
        return (
          <div key={name} className={cn("flex items-center gap-2 text-caption", on ? "text-foreground" : "text-faint-foreground")}>
            <span className="w-24 truncate">
              {i + 1}. {name}
            </span>
            <span className="h-2 rounded-xs bg-current" style={{ width: on ? bar(n) : 0, opacity: on ? 0.7 : 0 }} />
            <span className="font-mono tabular">{on ? n : ""}</span>
          </div>
        )
      })}
    </div>
  )
}

function Panel({ s }: { s: AnthroState }) {
  if (s.step === 4)
    return (
      <div className="w-72 rounded-lg border bg-popover p-3 shadow-popover">
        <div className="mb-2 flex items-baseline justify-between text-small">
          <span className="font-medium">{t("一个个尺寸筛下来", "Filtering one dimension at a time")}</span>
          <span className="text-caption text-muted-foreground">{t("共 4063 人", "of 4063")}</span>
        </div>
        <Funnel s={s} />
        <div className="mt-2 text-caption text-muted-foreground">{t("Daniels, 1952：每个尺寸取中间 30%", "Daniels, 1952: the middle 30% on each dimension")}</div>
      </div>
    )
  const B = breadthOf(s.group, s.pct)
  return (
    <div className="w-80 rounded-lg border bg-popover p-3 shadow-popover">
      <div className="mb-1 flex items-baseline justify-between text-small">
        <span className="font-medium">{t("手宽的分布", "Hand breadth distribution")}</span>
        <span className="text-caption text-muted-foreground">{t("单位 mm · ANSUR II", "mm · ANSUR II")}</span>
      </div>
      <DistChart s={s} />
      <div className="mt-1 text-small">
        <span className={s.group === "f" ? "text-primary" : "text-foreground"}>
          {GROUP_NAME[s.group]} P{s.pct} · {B.toFixed(0)} mm
        </span>
      </div>
      {(s.step === 2 || (s.step === 1 && s.revealed)) && (
        <div className="mt-1 text-small text-muted-foreground">
          {t("伸得进去：", "Fit through: ")}
          <span className="text-primary">
            {GROUP_NAME.f} {pc(shareBelow(HB.f, s.opening))}
          </span>
          {" · "}
          <span className="text-foreground">
            {GROUP_NAME.m} {pc(shareBelow(HB.m, s.opening))}
          </span>
        </div>
      )}
      {s.step === 3 && (
        <div className="mt-1 text-small text-muted-foreground">
          {STRATEGY_NAME[s.strategy]} · {t(`合适的人 ${pc(coverage(s.strategy))}（男女各半）`, `fits ${pc(coverage(s.strategy))} (half women, half men)`)}
        </div>
      )}
    </div>
  )
}

const menIn = (s: AnthroState) => shareBelow(HB.m, s.opening)

const lesson: LessonDef<AnthroState, AnthropometryScene> = {
  id: "anthropometry",
  codes: ["6.2.1"],
  title: t("人体尺寸与百分位", "Body dimensions and percentiles"),
  create: (v, emit) => new AnthropometryScene(v, emit),
  steps: [
    {
      title: t("一个尺寸是一条分布", "A dimension is a distribution"),
      body: byLocale(
        <>
          <p>产品要给很多人用，可每个人的手、胳膊、身高都不一样。同一个尺寸量一大群人，得到的是一条分布：中间的人多，两头的人少。</p>
          <p>百分位说的是位置：P5 表示有 5% 的人比这个值小，P95 表示有 95% 的人比它小，P50 是中位数。</p>
          <p>左上的曲线是手宽，量的是掌指关节处的宽度。数据来自美国陆军 2012 年的人体测量 ANSUR II，女性 1986 人，男性 4082 人。视图里的手按手宽等比例画出。</p>
        </>,
        <>
          <p>A product is used by many people, and everyone's hands, arms and height differ. Measure one dimension across a large group and you get a distribution: many people in the middle, few at either end.</p>
          <p>A percentile is a position: P5 means 5% of people are smaller than that value, P95 means 95% are smaller. P50 is the median.</p>
          <p>
            The curves at the top left are hand breadth, measured across the knuckles. The data is ANSUR II, the U.S. Army's 2012 anthropometric survey: 1,986 women and 4,082 men. The hand in
            the view is drawn in proportion to its breadth.
          </p>
        </>,
      ),
      task: { label: t("看看最小的女性手（P5）和最大的男性手（P95）", "Look at a small woman's hand (P5) and a large man's hand (P95)"), done: (s) => s.seenSmall && s.seenLarge },
      extra: ({ s, c }) => (
        <>
          <GroupSwitch s={s} c={c} />
          <PctSlider s={s} c={c} />
        </>
      ),
      note: t(
        "给中国用户设计，查 GB/T 10000-2023《中国成年人人体尺寸》：2024 年 3 月起实施，取代 1988 版，按性别和年龄段（18–70 岁）给出 P1 到 P99。不同人群的数值不一样，先弄清用户是谁，再选数据。本课用 ANSUR II 只是为了演示方法。",
        "For Chinese users, use GB/T 10000-2023, Human dimensions of Chinese adults: in force since March 2024, replacing the 1988 edition, with P1 to P99 by sex and age group (18–70). Populations differ, so first be clear who your users are, then pick the data. This lesson uses ANSUR II only to show the method.",
      ),
      noteTitle: t("中国人的数据", "Data for Chinese users"),
    },
    {
      title: t("按平均做，挡住一半人", "Design for the average, shut out half"),
      body: byLocale(
        <>
          <p>周转箱侧壁上开一个手孔，四根手指要能伸进去。开口按「平均的男性手」做，也就是男性 P50 的手宽 88 mm。</p>
          <p>这里只比手宽本身。实际还要加余量：戴手套、手指活动都要空间。</p>
        </>,
        <>
          <p>A crate has a hand hole in its side, and four fingers have to go through it. The opening is sized for the “average man's hand”: men's P50 hand breadth, 88 mm.</p>
          <p>Here only the hand breadth itself counts. A real opening needs an allowance on top, for gloves and for the fingers to move.</p>
        </>,
      ),
      task: { label: t("先猜，再看看伸不进去的手", "Guess first, then look at a hand that won't go in"), done: (s) => s.revealed && s.sawBlocked },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("开口按男性 P50 手宽做，能伸进去的男性有多少？", "With the opening at men's P50 hand breadth, how many men can get their hand in?")}
            options={byLocale(["几乎所有人", "大约一半", "大约 95%"], ["Nearly all of them", "About half", "About 95%"])}
            answer={1}
            explain={t(
              "P50 的意思就是一半人比它小、一半人比它大。手比 P50 宽的那一半男性都伸不进去；女性的手小，大多数能进。",
              "P50 means half the people are smaller and half are larger. The half of men whose hands are wider than P50 can't get in; women's hands are smaller, so most of them can.",
            )}
            onReveal={() => c.reveal()}
          />
          {s.revealed && (
            <>
              <GroupSwitch s={s} c={c} />
              <PctSlider s={s} c={c} />
            </>
          )}
        </>
      ),
    },
    {
      title: t("间隙按大的，够得着按小的", "Clearance for the big, reach for the small"),
      body: byLocale(
        <>
          <p>手孔、门洞、把手内侧这类「间隙」尺寸，要让大个子也过得去，按用户里较大那一群的 P95 定。</p>
          <p>按钮的距离、架子的高度这类「够得着」的尺寸正好相反，要让小个子也够得到，按较小那一群的 P5 定。</p>
          <p>两头都照顾到，就是常说的「从女性 P5 到男性 P95」。男女各半时，大约覆盖 95% 的人。</p>
        </>,
        <>
          <p>Clearances such as a hand hole, a doorway or the inside of a handle have to let the big people through: size them to P95 of the larger group among your users.</p>
          <p>Reach dimensions, such as how far away a button is or how high a shelf is, work the other way: the small people have to reach them, so size them to P5 of the smaller group.</p>
          <p>Looking after both ends is the familiar “P5 woman to P95 man”. With half women and half men, that covers about 95% of people.</p>
        </>,
      ),
      task: { label: t("把开口调到能让 95% 的男性伸进去", "Make the opening wide enough for 95% of men"), done: (s) => menIn(s) >= 0.95 },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label={t("手孔开口", "Hand hole opening")} value={s.opening} min={60} max={110} onChange={(v) => c.setOpening(v)} />
          <div className="mt-2">
            <Readout label={t("女性伸得进", "Women in")} value={pc(shareBelow(HB.f, s.opening))} tone="primary" />
            <Readout label={t("男性伸得进", "Men in")} value={pc(menIn(s))} />
          </div>
          <GroupSwitch s={s} c={c} />
          <PctSlider s={s} c={c} />
          {menIn(s) >= 0.95 && (
            <Hint>
              {t(
                "间隙也不是越大越好：开口越大，侧壁越弱，箱子也装得少。够用就停，剩下最极端的几个百分点，要么接受，要么换个做法。",
                "A clearance isn't better the bigger it gets: a larger hole weakens the wall and the crate holds less. Stop when it's enough. For the last few extreme percent, either accept them or design it another way.",
              )}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("两头受限：均码、分码、可调", "Limited at both ends: one size, sizes, adjustable"),
      body: byLocale(
        <>
          <p>有些尺寸太大太小都不行。比如手柄上的掌带：比手窄就勒手，比手宽太多就打滑。这时有三种做法：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>均码：一个尺寸，只适合中间一段人。</li>
            <li>分码：S、M、L 几个尺寸，各管一段。</li>
            <li>可调：用一个机构覆盖从女性 P5 到男性 P95。</li>
          </ul>
          <p>覆盖的人越多，代价越大：多几套模具和库存，或者多一个调节机构。这里假设掌带松 8 mm 以内还能用，这个数只是示意。</p>
        </>,
        <>
          <p>Some dimensions fail both ways. Take the strap on a handle that goes across the back of the hand: narrower than the hand and it pinches, much wider and it slips. There are three ways to handle this:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>One size: a single size that suits only a band of people in the middle.</li>
            <li>Sizes: S, M and L, each covering a band.</li>
            <li>Adjustable: one mechanism that covers P5 women to P95 men.</li>
          </ul>
          <p>Covering more people costs more: extra tooling and stock, or an adjustment mechanism. The lesson assumes the strap still works up to 8 mm loose; that figure is only illustrative.</p>
        </>,
      ),
      task: { label: t("三种做法都试一遍，拖动百分位看谁合适", "Try all three, and drag the percentile to see who fits"), done: (s) => s.strategies.length >= 3 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("做法", "Approach")}</span>
            <Segmented
              size="sm"
              aria-label={t("做法", "Approach")}
              value={s.strategy}
              onValueChange={(v: Strategy) => c.setStrategy(v)}
              options={(["one", "sizes", "adjust"] as Strategy[]).map((v) => ({ value: v, label: STRATEGY_NAME[v] }))}
            />
          </div>
          <div className="mt-2">
            <Readout label={t("合适的人", "Fits")} value={pc(coverage(s.strategy))} tone="primary" />
          </div>
          <GroupSwitch s={s} c={c} />
          <PctSlider s={s} c={c} />
        </>
      ),
    },
    {
      title: t("没有「平均人」", "There is no average person"),
      body: byLocale(
        <>
          <p>美国空军的 Gilbert Daniels 在 1952 年的报告里分析了 4063 名飞行员的 10 个尺寸。每个尺寸处在中间 30% 的人算作「接近平均」，再一个尺寸一个尺寸地筛。</p>
          <p>尺寸之间只是部分相关：身高 P50 的人，手宽、臂长、腰围多半落在别的百分位。</p>
        </>,
        <>
          <p>
            In a 1952 U.S. Air Force report, Gilbert Daniels took 10 dimensions measured on 4,063 airmen. Anyone in the middle 30% on a dimension counted as “approximately average” on it, and he
            filtered the men one dimension at a time.
          </p>
          <p>Dimensions are only partly related: someone at P50 for stature is usually at other percentiles for hand breadth, arm length or waist.</p>
        </>,
      ),
      task: { label: t("把 10 个尺寸都加上", "Apply all 10 dimensions"), done: (s) => s.dims >= 10 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("10 个尺寸都接近平均的有多少人？", "How many men were approximately average on all 10?")}
            options={byLocale(["大约 1200 人，也就是 30%", "几十人", "一个也没有"], ["About 1,200, that is 30%", "A few dozen", "None at all"])}
            answer={2}
            explain={t(
              "每加一个尺寸就刷掉一大半：只看身高剩 1055 人，加上胸围剩 302 人，10 个都加上一个也不剩。所以座椅、驾驶舱这种几个尺寸一起起作用的地方，要做成可调，再找真人试。",
              "Each dimension knocks out most of those left: stature alone leaves 1,055, adding chest circumference leaves 302, and with all 10 not one remains. So where several dimensions act together, as in a seat or a cockpit, make it adjustable and test with real people.",
            )}
            onReveal={() => c.playFunnel()}
          />
          <ParamSlider className="mt-3 px-0" label={t("加上的尺寸", "Dimensions applied")} unit="" value={s.dims} min={0} max={10} onChange={(v) => c.setDims(v)} />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.playFunnel()}>
            <Play />
            {t("逐个加上", "Add them in turn")}
          </Button>
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("给一个门洞定高度，人要直着走过去。按什么定？", "You're setting the height of a doorway people walk through upright. What do you size it to?"),
      options: byLocale(
        ["所有用户身高的平均值", "较高那一群的 P95，再加鞋和动作的余量", "较矮那一群的 P5"],
        ["The average stature of all users", "P95 of the taller group, plus allowances for shoes and movement", "P5 of the shorter group"],
      ),
      answer: 1,
      explain: t(
        "门洞是间隙尺寸，要让大个子也过得去。按平均值做，差不多一半人要低头；按 P5 做，几乎所有人都要低头。",
        "A doorway is a clearance: the tall people have to get through. Size it to the average and about half of people duck; size it to P5 and nearly everyone does.",
      ),
    },
    {
      q: t("墙上一个急停按钮，要让绝大多数人站着都够得着。高度按什么定？", "An emergency stop on a wall has to be within reach of nearly everyone standing. What sets its height?"),
      options: byLocale(
        ["较矮那一群的 P5 能够到的高度", "男性的 P95", "男女身高的平均值"],
        ["The height that P5 of the shorter group can reach", "Men's P95", "The average stature of women and men"],
      ),
      answer: 0,
      explain: t(
        "这是可达尺寸：小个子够得到，大个子自然也够得到，所以按较小那一群的 P5。按平均值做，矮的一半人够不着。",
        "This is a reach dimension: if the small people can reach it, the big ones can too, so use P5 of the smaller group. Size it to the average and the shorter half can't reach.",
      ),
    },
    {
      q: t("一位男性的身高正好是 P50。他的手宽和臂长呢？", "A man's stature is exactly at P50. What about his hand breadth and arm length?"),
      options: byLocale(
        ["也都在 P50 附近", "不一定，各个尺寸常常落在不同的百分位", "一定也偏大"],
        ["Also around P50", "Not necessarily: different dimensions often land at different percentiles", "Certainly on the large side"],
      ),
      answer: 1,
      explain: t(
        "尺寸之间只是部分相关。Daniels 在 4063 名飞行员里，没有找到一个 10 个尺寸都接近平均的人。",
        "Dimensions are only partly related. Among 4,063 airmen, Daniels found no one who was approximately average on all 10 dimensions.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "一个人体尺寸是一条分布；百分位说的是有多少人比它小，P50 是中位数，不是「标准人」",
      "间隙按较大那一群的 P95，够得着按较小那一群的 P5；两头都受限的尺寸用分码或可调",
      "没有在所有尺寸上都平均的人；给中国用户设计时查 GB/T 10000-2023",
    ],
    [
      "A body dimension is a distribution; a percentile says how many people are smaller, and P50 is the median, not a “standard person”",
      "Size clearances to P95 of the larger group and reach to P5 of the smaller group; use sizes or adjustment where both ends limit",
      "No one is average on every dimension; for Chinese users, use GB/T 10000-2023",
    ],
  ),
  next: {
    to: "/lesson/grip",
    label: t("握持与把手", "Grip and handles"),
    text: t("看手的大小怎样决定把手的粗细和截面。", "See how hand size sets a handle's diameter and cross-section."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{s.step === 4 ? t("美国空军飞行员 · 1952", "U.S. Air Force airmen · 1952") : t("ANSUR II · 美国陆军 2012", "ANSUR II · U.S. Army 2012")}</SceneChip>
      </div>
      <Panel s={s} />
    </div>
  ),
}

export default lesson
