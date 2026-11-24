import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Segmented } from "@/components/ui/segmented"
import { Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { bodyOf, freqOk, occOk, reachOf, ReachVisionScene, screenView, type Person, type ReachState, type Status } from "./reach-vision.scene"
import type { LessonDef } from "./types"

/** 6.2.4 「视线与可达范围」: normal line of sight, viewing zones, screen distance, reach envelopes, checking both ends. */

const PERSON_NAME: Record<Person, string> = { f5: t("女性 P5", "Woman P5"), m50: t("男性 P50", "Man P50"), m95: t("男性 P95", "Man P95") }
const STATUS_NAME: Record<Status, string> = { good: t("舒适", "Comfortable"), ok: t("勉强", "Marginal"), bad: t("不行", "Out of range") }
/** Reach reads as a zone: the normal area, the maximum area, or out of reach. */
const REACH_NAME: Record<Status, string> = { good: t("正常区", "Normal area"), ok: t("最大区", "Maximum area"), bad: t("够不着", "Out of reach") }
const STATUS_CLASS: Record<Status, string> = { good: "text-success", ok: "text-warning", bad: "text-destructive" }

function PersonSwitch({ s, c, only }: { s: ReachState; c: ReachVisionScene; only?: Person[] }) {
  const list = only ?? (["f5", "m50", "m95"] as Person[])
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("人体模型", "Mannequin")}</span>
      <Segmented size="sm" aria-label={t("人体模型", "Mannequin")} value={s.person} onValueChange={(p: Person) => c.setPerson(p)} options={list.map((v) => ({ value: v, label: PERSON_NAME[v] }))} />
    </div>
  )
}

/** Below horizontal as a positive "15°", above as "上 5°". */
const angleText = (a: number) => (a <= 0 ? t(`视线下 ${(-a).toFixed(0)}°`, `${(-a).toFixed(0)}° below`) : t(`视线上 ${a.toFixed(0)}°`, `${a.toFixed(0)}° above`))

const allGood = (p: Person, s: ReachState) => screenView(p, s.screen).status === "good" && freqOk(p, s.freq) && occOk(p, s.occ)

function Row({ name, st, detail, reach }: { name: string; st: Status; detail: string; reach?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-small">
      <span>{name}</span>
      <span className="text-right">
        <span className="font-mono text-caption tabular text-muted-foreground">{detail}</span> <span className={cn("font-medium", STATUS_CLASS[st])}>{(reach ? REACH_NAME : STATUS_NAME)[st]}</span>
      </span>
    </div>
  )
}

function Panel({ s }: { s: ReachState }) {
  const b = bodyOf(s.person)
  const v = screenView(s.person, s.screen)
  if (s.step === 0)
    return (
      <div className="w-72 space-y-1 rounded-lg border bg-popover p-3 text-small shadow-popover">
        <div className="mb-1 font-medium">
          {PERSON_NAME[s.person]} · {t("坐姿", "seated")}
        </div>
        {[
          [t("眼高（离地）", "Eye height (from floor)"), b.eye[1]],
          [t("肩高（离地）", "Shoulder height (from floor)"), b.shoulder[1]],
          [t("前臂加手长", "Forearm–hand length"), b.normal],
          [t("手臂长（肩到指尖）", "Arm length (shoulder to fingertip)"), b.max],
        ].map(([k, val]) => (
          <div key={k as string} className="flex justify-between gap-3">
            <span className="text-muted-foreground">{k}</span>
            <span className="font-mono tabular">{(val as number).toFixed(0)} mm</span>
          </div>
        ))}
        <div className="pt-1 text-caption text-muted-foreground">{t("ANSUR II · 座面按腘窝高度调好", "ANSUR II · seat set to popliteal height")}</div>
      </div>
    )
  if (s.step === 4)
    return (
      <div className="w-80 rounded-lg border bg-popover p-3 shadow-popover">
        <div className="mb-2 text-small font-medium">{t("两头都检查", "Check both ends")}</div>
        <div className="mb-1 text-caption text-muted-foreground">{t("屏幕要舒适，常用按键在正常区，旋钮不超出最大区", "Screen comfortable, frequent control in the normal area, knob within maximum reach")}</div>
        <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 text-small">
          <span />
          <span className="text-muted-foreground">{PERSON_NAME.f5}</span>
          <span className="text-muted-foreground">{PERSON_NAME.m95}</span>
          {(
            [
              [t("显示屏", "Screen"), (p: Person) => screenView(p, s.screen).status, STATUS_NAME],
              [t("常用按键", "Frequent control"), (p: Person) => reachOf(p, s.freq).status, REACH_NAME],
              [t("偶尔用的旋钮", "Occasional knob"), (p: Person) => reachOf(p, s.occ).status, REACH_NAME],
            ] as const
          ).map(([name, f, names]) => (
            <div key={name} className="contents">
              <span>{name}</span>
              {(["f5", "m95"] as Person[]).map((p) => (
                <span key={p} className={cn("font-medium", STATUS_CLASS[f(p)])}>
                  {names[f(p)]}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  if (s.step === 3) {
    const f = reachOf(s.person, s.freq)
    const o = reachOf(s.person, s.occ)
    return (
      <div className="w-80 space-y-1 rounded-lg border bg-popover p-3 shadow-popover">
        <Row reach name={t("常用按键", "Frequent control")} st={f.status} detail={t(`离肘 ${f.fromElbow.toFixed(0)}`, `${f.fromElbow.toFixed(0)} from elbow`)} />
        <Row reach name={t("偶尔用的旋钮", "Occasional knob")} st={o.status} detail={t(`离肩 ${o.fromShoulder.toFixed(0)}`, `${o.fromShoulder.toFixed(0)} from shoulder`)} />
        <div className="text-caption text-muted-foreground">{t(`正常区 ≤ ${b.normal.toFixed(0)} mm（肘）· 最大区 ≤ ${b.max.toFixed(0)} mm（肩）`, `Normal ≤ ${b.normal.toFixed(0)} mm (elbow) · maximum ≤ ${b.max.toFixed(0)} mm (shoulder)`)}</div>
      </div>
    )
  }
  return (
    <div className="w-80 space-y-1 rounded-lg border bg-popover p-3 shadow-popover">
      <Row name={t("显示屏", "Screen")} st={v.status} detail={`${angleText(v.angle)} · ${v.dist.toFixed(0)} mm`} />
      {s.step === 2 && (
        <div className="text-caption text-muted-foreground">
          {v.topAbove > 0 ? t(`屏幕顶边比眼睛高 ${v.topAbove.toFixed(0)} mm`, `Top of screen ${v.topAbove.toFixed(0)} mm above the eye`) : t("屏幕顶边不高于眼睛", "Top of screen at or below the eye")}
          {" · "}
          <span className={v.osha ? "text-success" : ""}>{v.osha ? t("符合 OSHA 建议", "Meets the OSHA advice") : t("OSHA：15–20°、50–100 cm", "OSHA: 15–20°, 50–100 cm")}</span>
        </div>
      )}
    </div>
  )
}

const lesson: LessonDef<ReachState, ReachVisionScene> = {
  id: "reach-vision",
  codes: ["6.2.4"],
  title: t("视线与可达范围", "Sight lines and reach"),
  create: (v, emit) => new ReachVisionScene(v, emit),
  steps: [
    {
      title: t("坐姿人体模型", "A seated mannequin"),
      body: byLocale(
        <>
          <p>这一节用一个坐姿人体模型检查产品布局：一台显示屏，两个控制件。模型的尺寸来自 ANSUR II 的坐姿眼高、肩高、上臂长、前臂加手长和手臂长，可以切换成女性 P5、男性 P50、男性 P95。</p>
          <p>每个尺寸都取同一个百分位，这样的人其实不存在，前面「没有平均人」讲过。P5 女性和 P95 男性模型只是两个检查用的边界。</p>
        </>,
        <>
          <p>
            This lesson checks a product layout with a seated mannequin: a screen and two controls. Its dimensions are ANSUR II's sitting eye height, shoulder height, upper arm, forearm–hand and arm
            lengths, and you can switch it between a P5 woman, a P50 man and a P95 man.
          </p>
          <p>Every dimension is taken at the same percentile, and no real person is like that, as “there is no average person” showed. The P5 woman and P95 man are just two boundaries to check against.</p>
        </>,
      ),
      task: { label: t("切换到女性 P5 和男性 P95 看看", "Switch to the P5 woman and the P95 man"), done: (s) => s.persons.includes("f5") && s.persons.includes("m95") },
      extra: ({ s, c }) => <PersonSwitch s={s} c={c} />,
    },
    {
      title: t("视线往下", "Sight goes down"),
      body: byLocale(
        <>
          <p>人放松坐着时，视线并不水平。只转眼睛、不动头时，看得最舒服的范围也有限。</p>
          <p>显示屏现在太高。先猜一猜，再拖动屏幕上的圆点，把它放进看得最舒服的区域。</p>
        </>,
        <>
          <p>When you sit relaxed, your line of sight isn't level. And moving only your eyes, not your head, you can only look comfortably over a limited range.</p>
          <p>The screen is too high. Guess first, then drag the dot on the screen to move it into the most comfortable zone.</p>
        </>,
      ),
      task: { label: t("把显示屏拖进绿色的最佳视区", "Drag the screen into the green optimum zone"), done: (s) => s.revealed && screenView("m50", s.screen).status === "good" },
      extra: ({ c }) => (
        <Predict
          question={t("放松坐着时，正常视线朝哪里？", "Sitting relaxed, where does the normal line of sight point?")}
          options={byLocale(["水平向前", "水平以下约 15°", "水平以上约 10°"], ["Level, straight ahead", "About 15° below horizontal", "About 10° above horizontal"])}
          answer={1}
          explain={t(
            "美军人机标准 MIL-STD-1472G 把正常视线定在水平以下约 15°。只转眼睛时，正常视线上下 15° 以内最舒服；最多往上 40°、往下 20°（都相对于正常视线）。",
            "MIL-STD-1472G, the U.S. military human engineering standard, puts the normal line of sight about 15° below horizontal. With the eyes alone, the 15° either side of it is optimum; at most 40° up and 20° down, both measured from the normal line of sight.",
          )}
          onReveal={() => c.reveal()}
        />
      ),
    },
    {
      title: t("看得清：距离和高度", "Seeing clearly: distance and height"),
      body: byLocale(
        <>
          <p>电脑显示屏还有更具体的建议（美国 OSHA 电脑工位指南）：屏幕中心在水平视线以下 15–20°，眼睛到屏幕 50–100 cm，屏幕顶边不高于眼睛。太近要往后仰，太远会往前探。</p>
          <p>这些是指南，不是硬性规定：字小的屏幕要近一些，大屏幕可以远一些。</p>
        </>,
        <>
          <p>
            For computer screens there's more specific advice (OSHA's computer workstations eTool): the centre of the screen 15–20° below horizontal eye level, 50–100 cm from the eyes, and the top of
            the screen no higher than the eyes. Too close and you lean back; too far and you crane forward.
          </p>
          <p>These are guidelines, not hard rules: a screen with small text wants to be closer, a large one can be further away.</p>
        </>,
      ),
      task: { label: t("让屏幕中心落在视线下 15–20°、50–100 cm", "Put the screen centre 15–20° below, 50–100 cm away"), done: (s) => screenView("m50", s.screen).osha },
      extra: ({ s }) => {
        const v = screenView("m50", s.screen)
        return (
          <div className="mt-4">
            <Readout label={t("视线角", "Angle")} value={angleText(v.angle)} />
            <Readout label={t("距离", "Distance")} value={v.dist.toFixed(0)} unit="mm" />
          </div>
        )
      },
    },
    {
      title: t("够得着：正常区和最大区", "Reach: normal and maximum"),
      body: byLocale(
        <>
          <p>手能够到的范围也分两层（Farley，1955）：上臂自然下垂，前臂绕肘转出的是正常作业区；整条手臂伸直绕肩转出的是最大可达区。常用的控制件放在正常区，偶尔用的不要超出最大区。拖动控制件上的圆点试试。</p>
          <p>够得着要照顾小个子，所以这里用女性 P5：前臂加手长约 401 mm，手臂长约 661 mm，都量到中指尖。要握住的东西还得再近一点。视图里把范围画成侧面的圆弧，真实的范围是立体的，也随姿势变。</p>
        </>,
        <>
          <p>
            Reach has two layers too (Farley, 1955). With the upper arm hanging naturally, the forearm swung about the elbow covers the normal working area; the whole arm, straight, swung about the
            shoulder covers the maximum reach. Put frequently used controls in the normal area, and keep occasional ones within the maximum. Drag the dots on the controls to try it.
          </p>
          <p>
            Reach has to suit small people, so this uses the P5 woman: forearm–hand length about 401 mm, arm length about 661 mm, both to the middle fingertip. Anything to be gripped has to be closer
            still. The view draws the envelopes as arcs in side view; real ones are three-dimensional and change with posture.
          </p>
        </>,
      ),
      task: { label: t("常用按键放进正常区，旋钮放进最大可达区", "Put the frequent control in the normal area and the knob within maximum reach"), done: (s) => freqOk("f5", s.freq) && occOk("f5", s.occ) },
    },
    {
      title: t("两头都要检查", "Check both ends"),
      body: byLocale(
        <>
          <p>布局要对一群人都成立。可达按女性 P5 定，大个子自然也够得到；视线两头都要看：两个人各自调好座椅坐下，眼睛高度差了将近 30 cm。</p>
          <p>现在的屏幕只照顾了小个子。切换两个模型，找一个对两个人都成立的布局。实在找不到，就是该做成可调的时候：可升降的显示器支架、可调的座椅。</p>
        </>,
        <>
          <p>A layout has to work for a whole range of people. Size reach to the P5 woman and the big people reach it too; but check sight at both ends: seated in chairs set for each of them, their eyes are almost 30 cm apart in height.</p>
          <p>Right now the screen suits only the small woman. Switch between the two mannequins and find a layout that works for both. If there isn't one, that's when to make it adjustable: a height-adjustable monitor arm, an adjustable seat.</p>
        </>,
      ),
      task: {
        label: t("三件东西对女性 P5 和男性 P95 都放对了", "All three placed right for both the P5 woman and the P95 man"),
        done: (s) => s.persons.includes("m95") && allGood("f5", s) && allGood("m95", s),
      },
      extra: ({ s, c }) => <PersonSwitch s={s} c={c} only={["f5", "m95"]} />,
    },
  ],
  quiz: [
    {
      q: t("放松坐着时，正常视线大约在哪里？", "Sitting relaxed, where is the normal line of sight?"),
      options: byLocale(["水平向前", "水平以下约 15°", "水平以上约 15°"], ["Level, straight ahead", "About 15° below horizontal", "About 15° above horizontal"]),
      answer: 1,
      explain: t(
        "正常视线在水平以下约 15°（MIL-STD-1472G）。所以显示屏中心通常放在眼睛以下，OSHA 建议 15–20°；放得比眼睛高，要一直抬头。",
        "The normal line of sight is about 15° below horizontal (MIL-STD-1472G). That's why screen centres usually go below the eyes, 15–20° in OSHA's advice; above eye level, you keep your head tilted back.",
      ),
    },
    {
      q: t("常用的按键应该放在哪里？", "Where should a frequently used control go?"),
      options: byLocale(
        ["手臂伸直刚好够到的地方", "前臂绕肘就能碰到的正常作业区", "越远越好，免得误碰"],
        ["Where the straight arm just reaches it", "In the normal working area the forearm reaches by swinging about the elbow", "As far away as possible, so it isn't hit by accident"],
      ),
      answer: 1,
      explain: t(
        "常用的放在正常作业区，不用抬臂伸肩。手臂伸直的最大可达区留给偶尔用的；防误碰要靠护罩、行程或确认，而不是放远。",
        "Frequent controls go in the normal area, with no need to raise and stretch the arm. The maximum reach is for occasional ones. Guard against accidental presses with covers, travel or confirmation, not by putting the control out of reach.",
      ),
    },
    {
      q: t("检查按键够不够得着，应该用哪个人体模型？", "Which mannequin should you check reach with?"),
      options: byLocale(["男性 P50", "女性 P5，也就是较小那一群里的小个子", "男性 P95"], ["The P50 man", "The P5 woman: the small end of the smaller group", "The P95 man"]),
      answer: 1,
      explain: t(
        "可达受小个子限制：P5 女性够得着，大个子也够得着。按 P50 做，一半人要伸长胳膊。视线和间隙还要用 P95 男性再检查一遍。",
        "Reach is limited by small people: if the P5 woman can reach it, so can the big people. Design for P50 and half of people stretch. Then check sight lines and clearances with the P95 man too.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "正常视线在水平以下约 15°，只转眼睛时上下 15° 以内最舒服；显示屏中心放在视线下 15–20°、50–100 cm",
      "常用控制件放在前臂绕肘的正常作业区，偶尔用的不超出手臂伸直的最大可达区",
      "可达按小个子定，视线两头都检查；一个位置满足不了所有人时，做成可调",
    ],
    [
      "The normal line of sight is about 15° below horizontal, and the 15° either side of it is most comfortable for the eyes alone; put a screen's centre 15–20° below, 50–100 cm away",
      "Put frequent controls in the normal area of the forearm swung about the elbow, and keep occasional ones within the straight arm's maximum reach",
      "Size reach to small people and check sight lines at both ends; when no one position suits everyone, make it adjustable",
    ],
  ),
  next: {
    to: "/teardown/toothbrush_handle",
    label: t("电动牙刷手柄拆解", "Electric toothbrush handle teardown"),
    text: t("看握持、按键位置和软胶包胶怎样落到一个真实的手柄上。", "See grip, button placement and a soft-touch overmold come together in a real handle."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{PERSON_NAME[s.person]}</SceneChip>
        <SceneChip>{t("侧视 · 指南值", "Side view · guideline values")}</SceneChip>
      </div>
      <Panel s={s} />
    </div>
  ),
}

export default lesson
