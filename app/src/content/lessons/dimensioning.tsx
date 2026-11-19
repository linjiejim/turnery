import { CircleCheck, CircleDashed, Play, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { analyse, candText, complete, DimensioningScene, has, MAG, stackUp, TOL, type DimState, type Issue, type Scheme } from "./dimensioning.scene"
import type { LessonDef } from "./types"

/** 3.1.3 「尺寸标注原则」: complete, no duplicates, no closed chains, chain vs baseline, the right view. */

const SCHEME_OPTIONS: { value: Scheme; label: string }[] = [
  { value: "chain", label: t("链式标注", "Chain") },
  { value: "base", label: t("基准标注", "Baseline") },
]

/** What the checker found, one line per problem. */
function Issues({ s, c, kinds }: { s: DimState; c: DimensioningScene; kinds?: Issue["kind"][] }) {
  const an = analyse(s.dims, s.refs)
  const list = an.issues.filter((i) => !kinds || kinds.includes(i.kind))
  return (
    <div className="mt-4 rounded-lg border p-3">
      <div className="flex items-center gap-2 text-small font-medium">
        {an.clean ? <CircleCheck className="size-4 text-success" /> : <CircleDashed className="size-4 text-faint-foreground" />}
        <span className={cn(an.clean && "text-success")}>
          {an.clean
            ? t("尺寸完整、清晰、不重复", "Complete, clear, no duplicates")
            : an.complete
              ? t("尺寸齐了，但还有问题", "Every dimension is there, but problems remain")
              : t(`还缺 ${an.missing} 个尺寸`, `${an.missing} ${an.missing === 1 ? "dimension" : "dimensions"} still missing`)}
        </span>
        <span className="ml-auto text-caption tabular text-muted-foreground">{t(`已标 ${an.count} 个`, `${an.count} added`)}</span>
      </div>
      {list.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {list.map((i) => (
            <li key={i.kind + i.text} className={cn("flex gap-2 text-small", i.kind === "dup" || i.kind === "loop" ? "text-destructive" : i.kind === "bad" ? "text-warning" : "text-muted-foreground")}>
              {i.kind === "missing" ? <CircleDashed className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1">{i.text}</span>
              {i.kind === "loop" && (
                <Button size="sm" variant="ghost" className="-my-1 h-6 shrink-0 px-1.5 text-caption" onClick={() => c.makeRef(i.ids[i.ids.length - 1])}>
                  {t("设为参考", "Make reference")}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {s.note && <p className="mt-2 text-small text-muted-foreground">{s.note}</p>}
    </div>
  )
}

const lesson: LessonDef<DimState, DimensioningScene> = {
  id: "dimensioning",
  codes: ["3.1.3"],
  title: t("尺寸标注原则", "Dimensioning principles"),
  create: (v, emit) => new DimensioningScene(v, emit),
  triad: false,
  steps: [
    {
      title: t("标全：每个特征都要定形、定位", "Complete: size and locate every feature"),
      body: byLocale(
        <>
          <p>图纸是给车间加工、给质检测量的。每个特征都要有两类尺寸：定形尺寸说它多大，定位尺寸说它在哪。少一个，零件就做不出来。</p>
          <p>定位要有起点，叫尺寸基准。这个零件长度方向以左端面为基准，高度方向以底面为基准，宽度方向以前后对称面为基准。</p>
          <p>点视图里的边、圆或中心线，就在那个视图里加一个尺寸；再点一次删掉。</p>
        </>,
        <>
          <p>
            A drawing is what the shop makes the part from and what inspection measures it against. Every feature needs two kinds of dimension: size dimensions say how big it is, location dimensions say where it is. Leave
            one out and the part can't be made.
          </p>
          <p>
            Locating needs a starting point, called a dimensioning datum. On this part, lengths are measured from the left end face, heights from the bottom face, and widths from the plane of symmetry between front and back.
          </p>
          <p>Click an edge, circle or center line in a view to add a dimension in that view; click again to delete it.</p>
        </>,
      ),
      task: { label: t("把缺的尺寸补齐，直到显示「完整」", "Add the missing dimensions until the status reads “Complete”"), done: (s) => complete(s, "dup", "loop") },
      extra: ({ s, c }) => (
        <>
          <Issues s={s} c={c} />
          <Hint>
            {t(
              "孔要两个尺寸：在俯视图里点圆周标孔径，点圆心标位置。两个孔一样大，标一次「2×Ø10」就够。",
              "A hole needs two dimensions: in the top view, click its circle for the diameter and its center for the location. Both holes are the same size, so one “2×Ø10” covers them.",
            )}
          </Hint>
        </>
      ),
      note: t(
        "GB/T 4458.4—2003 第 3 章：尺寸以 mm 为单位时不注单位；所注尺寸是零件最后完工的尺寸；每个尺寸一般只标一次，标在反映该结构最清晰的图形上。",
        "GB/T 4458.4—2003, chapter 3: dimensions in mm are given without the unit; the dimensions shown are those of the finished part; each dimension is normally given only once, in the view that shows that feature most clearly.",
      ),
      noteTitle: t("国标", "GB standard"),
    },
    {
      title: t("不重复：一个尺寸只标一次", "No duplicates: give each dimension once"),
      body: byLocale(
        <>
          <p>总长 80 在主视图标了，俯视图里又标了一遍；总高 30 在主视图和左视图各一个。数值一样，看起来没毛病。</p>
          <p>可图纸会改。设计改成 85 时，只要漏改一处，两处就对不上，车间不知道该信哪个。国标要求每个尺寸一般只标一次。</p>
        </>,
        <>
          <p>The overall length 80 is given in the front view and again in the top view; the overall height 30 appears in both the front and left views. The values agree, so it looks fine.</p>
          <p>
            But drawings get revised. When the design changes to 85 and one of the two is missed, they disagree, and the shop doesn't know which to trust. The GB standard says each dimension is normally given only once.
          </p>
        </>,
      ),
      task: { label: t("找出重复的尺寸，各删掉一个", "Find the duplicated dimensions and delete one of each"), done: (s) => complete(s, "dup") },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("同一个尺寸在两个视图里都标出来，最大的风险是？", "The same dimension is given in two views. What is the biggest risk?")}
            options={byLocale(
              ["看图的人会嫌啰嗦", "改图时只改了一处，两处数值就矛盾了", "违反了长对正"],
              ["The reader finds it cluttered", "A revision changes only one, and the two values contradict each other", "It breaks the rule that the front and top views align in length"],
            )}
            answer={1}
            explain={t(
              "重复尺寸本身数值没错，错在以后。两处要一起维护，漏改一处，图纸就自相矛盾。删掉哪一个？留在最能看清这个结构的视图里。",
              "A duplicate isn't wrong today; the trouble comes later. Both have to be kept in step, and if one is missed the drawing contradicts itself. Which one goes? Keep the one in the view that shows the feature most clearly.",
            )}
          />
          <Issues s={s} c={c} kinds={["dup", "missing"]} />
        </>
      ),
    },
    {
      title: t("封闭尺寸链", "Closed dimension chains"),
      body: byLocale(
        <>
          <p>台阶长 30、右段长 50、总长 80，三个尺寸在长度方向首尾相接，围成一圈。这叫封闭尺寸链。</p>
          <p>每个尺寸都有公差。30 和 50 各做到 +0.1，总长就是 80.2，超出了 80 ± 0.1 的要求。三个尺寸不可能同时保证。</p>
          <p>正确做法是空出一环：删掉最不重要的那个，让它的误差随别的尺寸走；要给车间看，就把它写成带括号的参考尺寸，参考尺寸不带公差、不检验。</p>
        </>,
        <>
          <p>Step length 30, right-hand section 50, overall length 80: the three dimensions join end to end along the length and close into a loop. This is a closed dimension chain.</p>
          <p>Every dimension has a tolerance. If 30 and 50 both come out 0.1 over, the overall length is 80.2, outside the 80 ± 0.1 requirement. The three can't all be held at once.</p>
          <p>
            The fix is to leave one link open: delete the least important dimension and let its error follow from the others. If the shop should still see it, write it as a reference dimension in parentheses; a reference
            dimension has no tolerance and isn't inspected.
          </p>
        </>,
      ),
      task: { label: t("断开封闭链：删掉一环，或把它设为参考尺寸", "Break the closed chain: delete one link, or make it a reference dimension"), done: (s) => complete(s, "loop") },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("30 ± 0.1 和 50 ± 0.1 都合格时，总长可能是多少？", "If 30 ± 0.1 and 50 ± 0.1 are both in tolerance, what can the overall length be?")}
            options={byLocale(["79.9 到 80.1", "79.8 到 80.2", "正好 80"], ["79.9 to 80.1", "79.8 to 80.2", "Exactly 80"])}
            answer={1}
            explain={t(
              "两段的误差会叠加：都做到上限是 80.2，都做到下限是 79.8。总长再要求 ±0.1，就和这两个尺寸冲突了。",
              "The two errors add up: both at the upper limit give 80.2, both at the lower limit 79.8. Requiring ±0.1 on the overall length as well conflicts with those two dimensions.",
            )}
          />
          <Issues s={s} c={c} kinds={["loop", "missing"]} />
        </>
      ),
    },
    {
      title: t("链式与基准：误差会不会累积", "Chain versus baseline: does error accumulate?"),
      body: byLocale(
        <>
          <p>孔的位置有两种标法。链式标注：一个接一个，台阶 30、到孔 1 是 15、孔距 20、到右端 15。基准标注：每个尺寸都从左端面量起。</p>
          <p>每个尺寸都是 ±{TOL}。下面的条带把每个特征相对左端面的最大误差放大 {MAG} 倍画出来。</p>
        </>,
        <>
          <p>
            There are two ways to dimension the hole positions. Chain dimensioning goes one after another: step 30, 15 to hole 1, 20 between the holes, 15 to the right end. Baseline dimensioning measures every dimension from
            the left end face.
          </p>
          <p>
            Every dimension is ±{TOL}. The strip below draws each feature's worst-case error relative to the left end face, {MAG}× larger.
          </p>
        </>,
      ),
      task: { label: t("两种标注各播放一次，对比误差条", "Play each scheme once and compare the error bars"), done: (s) => s.playedChain && s.playedBase },
      extra: ({ s, c }) => {
        const e = stackUp(s.scheme)
        return (
          <>
            <Predict
              question={t("链式标注下，右端面相对左端面最多差多少？", "With chain dimensioning, how far can the right end face be off relative to the left end face?")}
              options={["±0.1", "±0.2", "±0.4"]}
              answer={2}
              explain={t(
                "从左端面走到右端面要经过 4 个尺寸，每个 ±0.1，最坏情况全都偏向一边，累积到 ±0.4。",
                "Getting from the left end face to the right takes 4 dimensions, each ±0.1. In the worst case they all err the same way and add up to ±0.4.",
              )}
              onReveal={() => c.playStack()}
            />
            <div className="mt-4 flex items-center gap-2">
              <Segmented size="sm" aria-label={t("标注方式", "Dimensioning scheme")} value={s.scheme} onValueChange={(v) => c.setScheme(v)} options={SCHEME_OPTIONS} />
              <Button size="sm" variant="secondary" onClick={() => c.playStack()}>
                <Play />
                {t("播放累积", "Play the stack-up")}
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-small">
              <div className="rounded-md bg-sunken px-3 py-2">
                <div className="text-muted-foreground">{t("右端面的误差", "Error at the right end face")}</div>
                <div className="font-mono text-body font-medium tabular">±{e.x1.toFixed(1)}</div>
              </div>
              <div className="rounded-md bg-sunken px-3 py-2">
                <div className="text-muted-foreground">{t("两孔孔距的误差", "Error in the hole spacing")}</div>
                <div className="font-mono text-body font-medium tabular">±{s.scheme === "chain" ? TOL.toFixed(1) : (2 * TOL).toFixed(1)}</div>
              </div>
            </div>
            {s.playedChain && s.playedBase && (
              <Hint>
                {t(
                  "基准标注误差不累积，但两孔的孔距由 45 和 65 相减得到，误差反而是 ±0.2；链式标注直接给出孔距 20，孔距只差 ±0.1。哪个尺寸关系到装配，就直接标哪个：孔要对上另一个零件的两根销，就直接标孔距。",
                  "Baseline dimensioning doesn't accumulate error, but the hole spacing is 65 minus 45, so its error is actually ±0.2. Chain dimensioning gives the spacing 20 directly, so it is off by only ±0.1. Whichever dimension matters for assembly, give it directly: if the holes must line up with two pins on another part, dimension the hole spacing.",
                )}
              </Hint>
            )}
          </>
        )
      },
    },
    {
      title: t("标在最能看清的视图上", "Put it in the view that shows it best"),
      body: byLocale(
        <>
          <p>这张图尺寸是齐的，可好几个标错了地方：孔径和孔的位置标在主视图的虚线上，底板厚度标在左视图的虚线上。</p>
          <p>按国标，尺寸标在反映该结构最清晰的图形上：孔径标在投影为圆的视图上，台阶高度标在能看见台阶的主视图上。虚线只表示看不见的轮廓，尽量不在上面标尺寸。</p>
        </>,
        <>
          <p>This drawing has every dimension, but several are in the wrong place: the hole diameter and hole positions are on hidden lines in the front view, and the base thickness is on a hidden line in the left view.</p>
          <p>
            Under the GB standard, a dimension goes in the view that shows the feature most clearly: a hole diameter in the view where the hole appears as a circle, a step height in the front view, where you can see the step.
            Hidden lines only show outlines you can't see; avoid dimensioning to them.
          </p>
        </>,
      ),
      task: {
        label: t("把标错视图的尺寸挪到正确的视图（先删掉，再到对的视图里点）", "Move the dimensions in the wrong views to the right ones (delete each one, then click in the right view)"),
        done: (s) => analyse(s.dims, s.refs).clean,
      },
      extra: ({ s, c }) => <Issues s={s} c={c} />,
      note: t(
        "同一方向的几个尺寸，小的靠里、大的靠外，尺寸线和尺寸界线就不会交叉；同一个特征的尺寸尽量集中在一个视图里，读图时不用来回找。",
        "For several dimensions in the same direction, put the small ones inside and the big ones outside, so dimension lines and extension lines don't cross. Keep a feature's dimensions together in one view where you can, so the reader doesn't have to hunt between views.",
      ),
      noteTitle: t("制图惯例", "Drafting practice"),
    },
  ],
  quiz: [
    {
      q: t("总长 80 在主视图和俯视图里各标了一次，数值也一样。问题在哪？", "The overall length 80 is given once in the front view and once in the top view, with the same value. What's wrong?"),
      options: byLocale(
        ["没有问题，看图更方便", "重复标注：以后改图容易只改一处，两处数值对不上", "违反了长对正"],
        ["Nothing: it makes the drawing easier to read", "It's a duplicate: a later revision can easily change only one, and the values won't match", "It breaks the rule that the front and top views align in length"],
      ),
      answer: 1,
      explain: t(
        "GB/T 4458.4 规定每个尺寸一般只标一次。重复的尺寸现在一样，改图时却要同时维护两处，漏一处图纸就自相矛盾。",
        "GB/T 4458.4 says each dimension is normally given only once. The duplicates agree now, but every revision has to update both, and missing one makes the drawing contradict itself.",
      ),
    },
    {
      q: t("台阶长 30、右段长 50、总长 80 都标上，并且都要求 ±0.1。会怎样？", "Step length 30, right-hand section 50 and overall length 80 are all given, each to ±0.1. What happens?"),
      options: byLocale(
        ["更完整，加工更有依据", "形成封闭尺寸链，三个公差互相矛盾，必须空出一环或标成参考尺寸", "只是多余，不影响加工和检验"],
        [
          "It's more complete, so the shop has more to go on",
          "It forms a closed dimension chain: the three tolerances conflict, so one link must be left open or made a reference dimension",
          "It's merely redundant and doesn't affect making or inspecting the part",
        ],
      ),
      answer: 1,
      explain: t(
        "30 和 50 都合格时总长在 79.8 到 80.2 之间，和 80 ± 0.1 冲突。空出最不重要的一环，或者写成参考尺寸 (80)，不带公差也不检验。",
        "With 30 and 50 both in tolerance, the overall length is between 79.8 and 80.2, which conflicts with 80 ± 0.1. Leave out the least important link, or write it as a reference dimension (80), with no tolerance and no inspection.",
      ),
    },
    {
      q: t("两个孔要和另一个零件上的两根定位销配合，孔距最关键。孔的位置怎么标最好？", "Two holes must fit over two locating pins on another part, so the hole spacing matters most. What's the best way to dimension the hole positions?"),
      options: byLocale(
        ["两个孔都从左端面标（基准标注）", "标一个孔到左端面的距离，再直接标出孔距", "尺寸齐全就行，怎么标都一样"],
        ["Both holes from the left end face (baseline dimensioning)", "One hole from the left end face, then the hole spacing directly", "As long as every dimension is there, it makes no difference"],
      ),
      answer: 1,
      explain: t(
        "从左端面分别标两个孔，孔距是两个尺寸相减，误差 ±0.2；直接标孔距只有 ±0.1。功能上要紧的尺寸应直接标出，不要让它由别的尺寸间接算出来。",
        "Dimensioning each hole from the left end face makes the spacing the difference of two dimensions, with an error of ±0.2; dimensioning the spacing directly gives only ±0.1. Give functionally important dimensions directly; don't leave them to be worked out from others.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "每个特征都要定形、定位，尺寸齐全才能加工；每个尺寸只标一次，标在最能看清该结构的视图上，尽量不标在虚线上",
      "同一方向的尺寸不能首尾相接围成封闭链：空出一环，或把它标成带括号的参考尺寸",
      "基准标注误差不累积，链式标注误差逐环累加；关系到装配的功能尺寸要直接标出",
    ],
    [
      "Every feature needs size and location dimensions, and only a complete set lets the part be made. Give each dimension once, in the view that shows the feature most clearly, and avoid hidden lines",
      "Dimensions in one direction mustn't join end to end into a closed chain: leave one link open, or make it a reference dimension in parentheses",
      "Baseline dimensioning doesn't accumulate error; chain dimensioning adds it up link by link. Give functional dimensions that matter for assembly directly",
    ],
  ),
  next: {
    to: "/lesson/tolerance-fits",
    label: t("尺寸公差与配合", "Dimensional tolerances and fits"),
    text: t("±0.1 只是最简单的写法，孔和轴配在一起时公差怎么定。", "±0.1 is only the simplest way to write a tolerance. How do you set the tolerances when a hole and a shaft fit together?"),
  },
  overlay: ({ s }) => {
    const an = analyse(s.dims, s.refs)
    const status = !an.complete
      ? t(`缺 ${an.missing} 个`, `${an.missing} missing`)
      : has(an, "dup")
        ? t("有重复", "Duplicates")
        : has(an, "loop")
          ? t("封闭尺寸链", "Closed dimension chain")
          : has(an, "bad")
            ? t("有尺寸标错视图", "Dimension in the wrong view")
            : t("完整", "Complete")
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip>{t("第一角画法 · 单位 mm", "First-angle projection · mm")}</SceneChip>
        <SceneChip tone={an.clean ? undefined : "primary"} className={cn((has(an, "dup") || has(an, "loop")) && "text-destructive", an.clean && "text-success")}>
          {t(`尺寸 ${an.count} 个`, `${an.count} ${an.count === 1 ? "dimension" : "dimensions"}`)} · {status}
        </SceneChip>
        {s.refs.length > 0 && (
          <SceneChip>
            {t("参考尺寸", "Reference dimensions")} {s.refs.map((r) => `(${candText(r)})`).join(" ")}
          </SceneChip>
        )}
      </div>
    )
  },
}

export default lesson
