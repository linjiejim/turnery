import { Eye, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { SurfaceMatchingScene, type Level, type MatchState } from "./surface-matching.scene"
import type { LessonDef } from "./types"

/** 5.2.2 「曲面连续性与匹配」. */

const LEVEL_LABEL: Record<Level, string> = {
  none: t("未匹配", "Unmatched"),
  G0: t("G0 位置", "G0 position"),
  G1: t("G1 相切", "G1 tangent"),
  G2: t("G2 曲率", "G2 curvature"),
}

function LevelSwitch({ s, c, withNone = true }: { s: MatchState; c: SurfaceMatchingScene; withNone?: boolean }) {
  const all: Level[] = withNone ? ["none", "G0", "G1", "G2"] : ["G0", "G1", "G2"]
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("匹配到", "Match to")}</span>
      <Segmented size="sm" aria-label={t("匹配到", "Match to")} value={s.level} onValueChange={(l: Level) => c.setLevel(l)} options={all.map((l) => ({ value: l, label: l === "none" ? LEVEL_LABEL.none : l }))} />
    </div>
  )
}

function ChangeScale() {
  return (
    <div className="mt-3">
      <div className="h-2 rounded-xs bg-linear-to-r from-scene-good via-scene-modified to-axis-x" />
      <div className="mt-1 flex justify-between text-caption text-muted-foreground">
        <span>{t("没动", "Unchanged")}</span>
        <span>{t("变了 6 mm 以上", "Moved 6 mm or more")}</span>
      </div>
    </div>
  )
}

function SeamReadouts({ s }: { s: MatchState }) {
  const r = s.report
  const rad = (k: number) => (Math.abs(k) < 1e-5 ? "∞" : Math.round(1 / Math.abs(k)).toString())
  return (
    <div className="mt-3 space-y-1">
      <div>
        <Readout label={t("缝隙", "Gap")} value={r.gap < 0.005 ? "0" : r.gap.toFixed(2)} unit="mm" tone={r.gap < 0.02 ? "success" : "warning"} />
        <Readout label={t("法向夹角", "Normal angle")} value={r.angle < 0.05 ? "0" : r.angle.toFixed(1)} unit="°" tone={r.angle < 0.1 ? "success" : "warning"} />
      </div>
      <div>
        <Readout label={t("横跨接缝的曲率半径 A / B", "Radius across the seam, A / B")} value={`${rad(r.kA)} / ${rad(r.kB)}`} unit="mm" tone={r.level === "G2" ? "success" : undefined} />
      </div>
    </div>
  )
}

const lesson: LessonDef<MatchState, SurfaceMatchingScene> = {
  id: "surface-matching",
  codes: ["5.2.2"],
  title: t("曲面连续性与匹配", "Surface continuity and matching"),
  create: (v, emit) => new SurfaceMatchingScene(v, emit),
  steps: [
    {
      title: t("一排控制点管一阶", "One row of control points per order"),
      body: byLocale(
        <>
          <p>A 是一块顶面，B 是向下转折的面，中间一条接缝。匹配只改 B，从接缝往外一排一排地改。</p>
          <p>第 0 排放到 A 的边上：位置连续 G0。第 1 排和 A 最后两排连成直线：相切连续 G1。第 2 排再按 A 的弯曲程度摆好：曲率连续 G2。</p>
        </>,
        <>
          <p>A is a top face and B a face that turns down from it, with a seam between them. Matching changes only B, one row at a time, working outward from the seam.</p>
          <p>
            Row 0 goes onto A's edge: position continuity, G0. Row 1 lines up with A's last two rows: tangent continuity, G1. Row 2 is then placed to follow how A bends: curvature
            continuity, G2.
          </p>
        </>,
      ),
      task: { label: t("依次切到 G0、G1、G2，看哪一排在动", "Switch to G0, G1 and G2 in turn and watch which row moves"), done: (s) => (["G0", "G1", "G2"] as Level[]).every((l) => s.seen.includes(l)) },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("从 G1 改成 G2，B 的哪些控制点会动？", "Going from G1 to G2, which of B's control points move?")}
            options={byLocale(["B 的全部控制点", "只有第 2 排", "第 0 到第 2 排都要重新摆"], ["All of B's control points", "Only row 2", "Rows 0 to 2 all get placed again"])}
            answer={1}
            explain={t(
              "第 0、1 排已经满足位置和相切，G2 只再管一排：第 2 排。每升一阶，就多用掉一排控制点。",
              "Rows 0 and 1 already give position and tangency, so G2 takes over just one more row: row 2. Each order up uses one more row of control points.",
            )}
            onReveal={() => c.g1ToG2()}
          />
          <LevelSwitch s={s} c={c} />
          <SeamReadouts s={s} />
        </>
      ),
      note: t(
        "Rhino 用「匹配」MatchSrf，连续性选位置、正切或曲率；「混接曲面」BlendSrf 则在两面之间另建一块过渡面。SOLIDWORKS 的边界曲面、填充曲面在边线上设相切或曲率条件；Fusion 的面片可选 G0 / G1 / G2。",
        "Rhino uses MatchSrf, with Position, Tangency or Curvature continuity; BlendSrf instead builds a new transition surface between the two. SOLIDWORKS sets tangent or curvature conditions on the edges of a Boundary or Filled Surface; Fusion's Patch offers G0 / G1 / G2.",
      ),
      noteTitle: t("各软件叫法", "What each package calls it"),
    },
    {
      title: t("用斑马纹验收接缝", "Check the seam with zebra stripes"),
      body: byLocale(
        <>
          <p>控制点排对了，还要用反光确认。G0：条纹在接缝处错开。G1：条纹接上了，但拐出一个折。G2：条纹顺滑地流过接缝。</p>
          <p>条纹会随视角移动。转一转视图，让条纹扫过整条接缝。</p>
        </>,
        <>
          <p>With the control points in place, confirm it with reflections. G0: the stripes are offset at the seam. G1: they connect, but kink. G2: they flow smoothly across the seam.</p>
          <p>The stripes move with the view. Orbit a little so they sweep along the whole seam.</p>
        </>,
      ),
      task: { label: t("在斑马纹下看 G0、G1、G2", "Look at G0, G1 and G2 under zebra stripes"), done: (s) => (["G0", "G1", "G2"] as Level[]).every((l) => s.seenZebra.includes(l)) },
      extra: ({ s, c }) => (
        <>
          <LevelSwitch s={s} c={c} withNone={false} />
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("显示", "Display")}</span>
            <Segmented
              size="sm"
              aria-label={t("显示", "Display")}
              value={s.zebra ? "zebra" : "shaded"}
              onValueChange={(v) => c.setZebra(v === "zebra")}
              options={[
                { value: "shaded", label: t("着色", "Shaded") },
                { value: "zebra", label: t("斑马纹", "Zebra stripes") },
              ]}
            />
          </div>
        </>
      ),
    },
    {
      title: t("拖坏它，再匹配回来", "Break it, then match it again"),
      body: byLocale(
        <>
          <p>匹配不是一劳永逸。动一动接缝附近的控制点：B 的第 1、2 排，或者 A 的倒数第二排（黑圈），连续性马上就断，读数和条纹都会告诉你断在哪一阶。</p>
          <p>改了主面 A，就要把 B 重新匹配一次。</p>
        </>,
        <>
          <p>
            A match isn&apos;t forever. Move a control point near the seam (B&apos;s rows 1 and 2, or A&apos;s second-to-last row, the black circles) and the continuity breaks at once; the
            readouts and the stripes tell you at which order.
          </p>
          <p>Whenever you change the master A, match B to it again.</p>
        </>,
      ),
      task: { label: t("拖一个点把接缝弄坏，再重新匹配", "Drag a point to break the seam, then match again"), done: (s) => s.rematched },
      extra: ({ s, c }) => (
        <>
          <SeamReadouts s={s} />
          {s.broken && (
            <Hint tone="warning">
              {s.report.level === "none"
                ? t("接缝裂开了：连位置都不连续。", "The seam has opened: not even position is continuous.")
                : t(`接缝现在只有 ${s.report.level}，不再是 ${s.level}。`, `The seam is only ${s.report.level} now, no longer ${s.level}.`)}
            </Hint>
          )}
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.rematch()}>
            <Link2 />
            {t("重新匹配", "Match again")}
          </Button>
        </>
      ),
    },
    {
      title: t("匹配会改变 B 的形状", "Matching reshapes B"),
      body: byLocale(
        <>
          <p>匹配不只动边。G2 要动接缝外的三排控制点。B 如果只有 4 排（3 阶），三排都被 A 定死，只剩最外一排是自己的：原来的形状被挤到最后一段。</p>
          <p>给 B 更多控制点（升到 5 阶，或在接缝附近加结构线），匹配就只影响靠近接缝的一段。颜色表示 B 偏离自己原来形状的程度，灰色半透明的是匹配前的 B。</p>
        </>,
        <>
          <p>Matching moves more than the edge. G2 moves three rows out from the seam. If B has only 4 rows (degree 3), A fixes three of them and only the last row is B&apos;s own: its original shape gets squeezed into the last span.</p>
          <p>
            Give B more control points (raise it to degree 5, or add isoparms near the seam) and the match only affects a strip along the seam. The colours show how far B moved from its
            own shape; the translucent grey is B before matching.
          </p>
        </>,
      ),
      task: { label: t("3 阶和 5 阶都试一下", "Try both degree 3 and degree 5"), done: (s) => s.triedDegree3 && s.triedDegree5 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("B 是 3 阶，有 4 排控制点。G2 匹配要动其中几排？", "B is degree 3, with 4 rows of control points. How many rows does a G2 match move?")}
            options={byLocale(["1 排", "3 排：只剩 1 排是 B 自己的", "4 排全部"], ["1 row", "3 rows: only one is left as B's own", "All 4 rows"])}
            answer={1}
            explain={t(
              "位置、相切、曲率各占一排，G2 一共用掉 3 排。控制点越少，匹配改掉的部分越大。",
              "Position, tangency and curvature take one row each, so G2 uses 3 rows. The fewer control points, the more of the face the match rewrites.",
            )}
            onReveal={() => c.setDegree(3)}
          />
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("B 的阶数", "B's degree")}</span>
            <Segmented
              size="sm"
              aria-label={t("B 的阶数", "B's degree")}
              value={String(s.degree)}
              onValueChange={(v) => c.setDegree(Number(v) as 3 | 5)}
              options={[
                { value: "3", label: t("3 阶 · 4 排", "Degree 3 · 4 rows") },
                { value: "5", label: t("5 阶 · 6 排", "Degree 5 · 6 rows") },
              ]}
            />
          </div>
          <ChangeScale />
          <div className="mt-3">
            <Readout label={t("被改动的控制点", "Control points moved")} value={`12 / ${(s.degree + 1) * 4}`} />
            <Readout label={t("B 的形状最多变了", "B moved by up to")} value={s.change.toFixed(1)} unit="mm" tone="warning" />
          </div>
        </>
      ),
    },
    {
      title: t("谁当主面", "Which face is the master"),
      body: byLocale(
        <>
          <p>匹配时不动的一方是主面（目标），另一方去迁就它。主面应该是更重要、已经定稿的那块：大面、外观面、还有别的面也接在它身上的面。小的过渡面去迁就大面。</p>
          <p>反过来以 B 为主，被改的就是 A：顶面上一大片高光跟着变，接在 A 上的其他面也都要重做。</p>
        </>,
        <>
          <p>
            In a match, the face that stays put is the master (the target), and the other one adapts to it. The master should be the more important face, the one already signed off:
            the large face, the visible face, the face other surfaces also connect to. The small transition face adapts to the large one.
          </p>
          <p>Make B the master instead and A is the one that changes: a large area of highlights on the top face shifts, and every other face joined to A has to be redone.</p>
        </>,
      ),
      task: { label: t("以 B 为主试一次，再换回 A", "Try B as the master, then switch back to A"), done: (s) => s.backToA },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("主面", "Master")}</span>
            <Segmented
              size="sm"
              aria-label={t("主面", "Master")}
              value={s.master}
              onValueChange={(m) => c.setMaster(m as "A" | "B")}
              options={[
                { value: "A", label: t("A 顶面", "A, top face") },
                { value: "B", label: t("B 过渡面", "B, transition") },
              ]}
            />
          </div>
          <ChangeScale />
          <div className="mt-3">
            <Readout label={s.master === "A" ? t("B 变了", "B moved by") : t("A 变了", "A moved by")} value={s.change.toFixed(1)} unit="mm" tone="warning" />
          </div>
          {s.master === "B" && (
            <Hint tone="warning">
              {t("顶面 A 靠接缝的三排都被改了：它的高光变了，和 A 相接的其他面也要跟着重新匹配。", "The three rows of top face A nearest the seam were rewritten: its highlights changed, and every other face joined to A must be matched again.")}
            </Hint>
          )}
        </>
      ),
      note: t(
        "Rhino「匹配」有「互相衔接」选项：两个面都改，各让一步。只在两个面同样重要时用。",
        "Rhino's MatchSrf has an Average surfaces option: both faces change and meet halfway. Use it only when the two faces matter equally.",
      ),
    },
  ],
  quiz: [
    {
      q: t("接缝处斑马纹接上了但拐了一个折。要改到 G2，被匹配面最少要动哪些控制点？", "The zebra stripes connect at the seam but kink. To reach G2, which control points of the matched face must move, at the least?"),
      options: byLocale(
        ["只动接缝上的第 0 排", "第 2 排，第 0、1 排保持不变", "全部控制点"],
        ["Only row 0, on the seam", "Row 2, with rows 0 and 1 left as they are", "All of them"],
      ),
      answer: 1,
      explain: t(
        "条纹接上说明已经是 G1：第 0、1 排已经对了。曲率由第 2 排决定，只要再摆好它。",
        "Connected stripes mean it is already G1, so rows 0 and 1 are right. Curvature depends on row 2, so that is the one to place.",
      ),
    },
    {
      q: t("G2 匹配以后，被匹配的小面整个变了形。最可能的原因是？", "After a G2 match, the small matched face is distorted all over. What's the most likely cause?"),
      options: byLocale(
        ["匹配算法有误差", "它控制点太少：接缝外三排都被主面定死，自己的形状只剩最后一段", "斑马纹显示有误"],
        ["The matching algorithm is inaccurate", "It has too few control points: three rows are fixed by the master, and its own shape is left with only the last span", "The zebra display is wrong"],
      ),
      answer: 1,
      explain: t(
        "G2 用掉三排控制点。3 阶的面只有 4 排，几乎整片都被改写。升阶或加结构线，给它留出自己的形状。",
        "G2 uses three rows. A degree-3 face has only 4, so nearly all of it is rewritten. Raise the degree or add isoparms to leave room for its own shape.",
      ),
    },
    {
      q: t("顶面 A 是已经定稿的外观大面，B 是一块过渡面。匹配时谁当主面？", "Top face A is a large, signed-off visible face; B is a transition face. Which is the master when matching?"),
      options: byLocale(["A：让 B 去迁就 A", "B：小面容易改坏，应该保持不动", "无所谓，结果一样"], ["A: B adapts to A", "B: small faces are easy to ruin, so keep it fixed", "Either: the result is the same"]),
      answer: 0,
      explain: t(
        "被匹配的一方会变形。让重要的大面保持不动，变形落在过渡面上，也不会牵连接在 A 上的其他面。",
        "The matched face is the one that deforms. Keep the important large face fixed so the change lands on the transition face and doesn't ripple into the other faces joined to A.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "从接缝往外：第 0 排管位置（G0），第 1 排管相切（G1），第 2 排管曲率（G2）",
      "匹配会改被匹配面的形状：给它留够控制点，让变化只落在接缝附近",
      "主面选重要、已定稿的大面；改了主面要重新匹配，再用斑马纹验收",
    ],
    [
      "Working out from the seam: row 0 sets position (G0), row 1 tangency (G1), row 2 curvature (G2)",
      "Matching reshapes the matched face: give it enough control points so the change stays near the seam",
      "Make the important, signed-off face the master; after changing it, match again and check with zebra stripes",
    ],
  ),
  next: {
    to: "/lesson/trim-stitch",
    label: t("修剪、分割、缝合与封闭", "Trim, split, join and close"),
    text: t("面接好了，再把它们修剪、缝合成一个封闭的实体。", "With the faces meeting well, trim and join them into a closed solid."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        <Eye />
        {s.zebra ? t("斑马纹", "Zebra stripes") : s.step >= 3 ? t("偏离原形", "Change from own shape") : t("着色", "Shaded")}
      </SceneChip>
      <SceneChip tone="primary">{LEVEL_LABEL[s.level]}</SceneChip>
      {s.step === 4 && <SceneChip>{s.master === "A" ? t("主面 A", "Master A") : t("主面 B", "Master B")}</SceneChip>}
    </div>
  ),
}

export default lesson
