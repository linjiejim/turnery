import { ArrowDown, ArrowUp, CircleCheck, CircleX, Scissors } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { DfmScene, MIN_DRAFT, OUTER_DRAFT, PAD, passes, T_OK, WALL, type Check, type DfmState } from "./styling-dfm.scene"
import type { LessonDef } from "./types"

/** 5.6.2 「造型件的 DFM 回检」. */

const CHECK_NAME: Record<Check, string> = {
  draft: t("拔模", "Draft"),
  thick: t("壁厚", "Wall thickness"),
  undercut: t("倒扣", "Undercuts"),
}

function DraftLegend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-axis-y" />
      <span>{t(`拔模 ≥ ${MIN_DRAFT}°`, `Draft ≥ ${MIN_DRAFT}°`)}</span>
      <span className="size-3 rounded-xs bg-scene-modified" />
      <span>{t(`拔模不足 ${MIN_DRAFT}°`, `Under ${MIN_DRAFT}° of draft`)}</span>
      <span className="size-3 rounded-xs bg-axis-x" />
      <span>{t("倒扣", "Undercut")}</span>
    </div>
  )
}

function ThickLegend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-primary" />
      <span>{t(`偏薄：小于 ${T_OK[0]} mm`, `Thin: under ${T_OK[0]} mm`)}</span>
      <span className="size-3 rounded-xs bg-axis-y" />
      <span>{t(`正常：主壁 ${WALL} mm 左右`, `Normal: around the ${WALL} mm main wall`)}</span>
      <span className="size-3 rounded-xs bg-scene-modified" />
      <span>{t("偏厚", "Thick")}</span>
      <span className="size-3 rounded-xs bg-axis-x" />
      <span>{t("过厚：缩痕、变形的风险", "Too thick: risk of sink and warp")}</span>
    </div>
  )
}

function BeforeAfter({ value, onChange, after }: { value: boolean; onChange: (v: boolean) => void; after: string }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("对比", "Compare")}</span>
      <Segmented
        size="sm"
        aria-label={t("对比", "Compare")}
        value={value ? "after" : "before"}
        onValueChange={(v) => onChange(v === "after")}
        options={[
          { value: "before", label: t("改前", "Before") },
          { value: "after", label: after },
        ]}
      />
    </div>
  )
}

function Status({ ok }: { ok: boolean }) {
  return ok ? <CircleCheck className="text-success" /> : <CircleX className="text-warning" />
}

const lesson: LessonDef<DfmState, DfmScene> = {
  id: "styling-dfm",
  codes: ["5.6.2"],
  title: t("造型件的 DFM 回检", "DFM review of a styled part"),
  create: (v, emit) => new DfmScene(v, emit),
  steps: [
    {
      title: t("造型交过来了", "The styled part arrives"),
      body: byLocale(
        <>
          <p>这是一个手持设备的上盖。外表面是造型给定的 A 面（蓝色）：底边一圈内收、一条清晰的腰线、{OUTER_DRAFT}° 的斜壁、肩部圆角，顶上鼓起一个拇指位。</p>
          <p>内侧是结构快速抽出来的壳。接下来跑三项检查：拔模、壁厚、倒扣。规则只有一条：A 面不能动，所有修改都放在内侧，或者放在模具上。</p>
        </>,
        <>
          <p>
            This is the top cover of a handheld device. The outside is the Class-A surface from design (blue): a tuck-under around the bottom edge, a crisp character line, walls
            drafted {OUTER_DRAFT}°, a shoulder radius, and a raised thumb pad on top.
          </p>
          <p>
            The inside is a quick shell from engineering. Three checks come next: draft, wall thickness and undercuts. There is one rule: the Class-A surface can't change. Every fix
            goes on the inside, or into the mold.
          </p>
        </>,
      ),
      task: { label: t("看一眼内侧", "Take a look at the inside"), done: (s) => s.lookedInside },
      extra: ({ c }) => (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => c.lookInside()}>
            <ArrowUp />
            {t("看内侧", "View the inside")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => c.lookOutside()}>
            <ArrowDown />
            {t("看外面", "View the outside")}
          </Button>
        </div>
      ),
    },
    {
      title: t("检查一：拔模", "Check 1: draft"),
      body: byLocale(
        <>
          <p>拔模分析按开模方向上色：型腔向上，成形外面；型芯向下，成形里面。外面的斜壁有 {OUTER_DRAFT}°，没问题。里面的侧壁是竖直抽出来的，0°，橙色。</p>
          <p>底边那一圈红色是倒扣，留到第三项。</p>
        </>,
        <>
          <p>
            The draft analysis colors by the pull direction: the cavity goes up and forms the outside, the core goes down and forms the inside. The outer walls have {OUTER_DRAFT}°: fine.
            The inner walls were shelled straight down: 0°, orange.
          </p>
          <p>The red band around the bottom edge is an undercut: that's check three.</p>
        </>,
      ),
      task: { label: t("让内侧没有橙色", "Get rid of the orange on the inside"), done: (s) => passes(s).draft },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("外面不能动，内壁的拔模往哪边斜？", "The outside can't change. Which way should the inner walls slope?")}
            options={byLocale(
              ["上窄下宽：开口一侧最宽", "上宽下窄：顶上最宽", "不用斜，脱模剂能解决"],
              ["Narrower at the top, widest at the opening", "Wider at the top, narrowest at the opening", "No slope needed: mold release will handle it"],
            )}
            answer={0}
            explain={t(
              "型芯向下退出，内腔就要越往开口越宽。内壁往里收一点，壁厚只在根部多一点点，外观完全不变。",
              "The core leaves downward, so the hollow must widen toward the opening. Leaning the inner walls in a little adds a hair of thickness at the top and leaves the outside untouched.",
            )}
            onReveal={() => c.setDraftIn(1.5)}
          />
          <ParamSlider className="mt-3 px-0" label={t("内壁拔模", "Inner wall draft")} unit="°" value={s.draftIn} min={0} max={3} step={0.25} onChange={(v) => c.setDraftIn(v)} />
          <BeforeAfter value={s.draftIn > 0} onChange={(v) => c.setDraftIn(v ? 1.5 : 0)} after={t("内壁加拔模", "Inner draft added")} />
          <DraftLegend />
        </>
      ),
      note: t(
        "拔模阈值这里取 1°。Protolabs 建议竖直面至少 0.5°，多数情况 2°；咬花面要更大。以供应商的 DFM 报告为准。",
        "The threshold here is 1°. Protolabs recommends at least 0.5° on vertical faces and 2° in most cases, more on textured faces. Go by your supplier's DFM report.",
      ),
      noteTitle: t("阈值", "Threshold"),
    },
    {
      title: t("检查二：壁厚", "Check 2: wall thickness"),
      body: byLocale(
        <>
          <p>主壁 {WALL} mm。拇指位在外面鼓起来 {PAD.h} mm，里面却是平的：那一块厚到 {WALL + PAD.h} mm。</p>
          <p>厚处最后冷却，收缩最多，表面会被拉出凹坑（缩痕），偏偏出现在拇指放的地方；冷却时间也被它拖长。从里面掏空，让内表面跟着鼓起来，壁厚回到 {WALL} mm。</p>
        </>,
        <>
          <p>
            The main wall is {WALL} mm. The thumb pad rises {PAD.h} mm on the outside while the inside stays flat: that patch is {WALL + PAD.h} mm thick.
          </p>
          <p>
            Thick areas cool last and shrink the most, pulling a dent into the surface (a sink mark), right where the thumb rests, and they stretch the cooling time. Core it out from
            the inside so the inner surface follows the bump, and the wall is back to {WALL} mm.
          </p>
        </>,
      ),
      task: { label: t("从内侧掏空拇指位，让壁厚通过", "Core out the thumb pad from inside and pass the thickness check"), done: (s) => s.coreOut && passes(s).thick },
      extra: ({ s, c }) => (
        <>
          <BeforeAfter value={s.coreOut} onChange={(v) => c.setCoreOut(v)} after={t("从内侧掏空", "Cored out")} />
          <Button size="sm" variant={s.section ? "secondary" : "ghost"} className="mt-3" onClick={() => c.setSection(!s.section)}>
            <Scissors />
            {s.section ? t("取消剖切", "Remove the section") : t("剖开看", "Cut it open")}
          </Button>
          <div className="mt-3">
            <Readout label={t("最厚", "Thickest")} value={s.tMax.toFixed(1)} unit="mm" tone={s.tMax > T_OK[1] ? "warning" : "success"} />
            <Readout label={t("最薄", "Thinnest")} value={s.tMin.toFixed(1)} unit="mm" tone={s.tMin < T_OK[0] ? "warning" : "success"} />
          </div>
          <ThickLegend />
        </>
      ),
      note: t(
        "壁厚算法是简化的：每个点到对面表面最近点的距离。真实软件还会用球法或射线法，结果在圆角和转角处略有不同。",
        "The thickness here is simplified: each point's distance to the nearest point of the opposite surface. Real tools also offer sphere or ray methods, which differ a little at fillets and corners.",
      ),
      noteTitle: t("说明", "Note"),
    },
    {
      title: t("检查三：倒扣", "Check 3: undercuts"),
      body: byLocale(
        <>
          <p>底边那一圈内收让零件显得轻薄。可是分型线放在底边时，型腔要从上面把它拔出来，内收的面朝下，被零件自己挡住：倒扣。</p>
          <p>不用改造型，也不用滑块：把分型线从底边移到腰线上。腰线以下这一圈改由型芯一侧成形，朝下正好能脱；分型线还刚好落在这条棱上，看不出来。</p>
        </>,
        <>
          <p>The tuck-under around the bottom edge makes the part look slimmer. But with the parting line on the bottom edge, the cavity has to pull it out upward, and the tucked faces point down, blocked by the part itself: an undercut.</p>
          <p>
            No restyling and no slides needed: move the parting line from the bottom edge up to the character line. The band below it is then formed from the core side, where facing
            down is exactly right, and the parting line sits on the crease, where nobody will see it.
          </p>
        </>,
      ),
      task: { label: t("把分型线移到腰线上", "Move the parting line to the character line"), done: (s) => s.plCrease && passes(s).undercut },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("分型线", "Parting line")}</span>
            <Segmented
              size="sm"
              aria-label={t("分型线", "Parting line")}
              value={s.plCrease ? "crease" : "edge"}
              onValueChange={(v) => c.setPl(v === "crease")}
              options={[
                { value: "edge", label: t("改前 · 底边", "Before · bottom edge") },
                { value: "crease", label: t("改后 · 腰线", "After · character line") },
              ]}
            />
          </div>
          <div className="mt-3">
            <Readout label={t("倒扣", "Undercut")} value={s.underCount > 0 ? t("有", "Yes") : t("无", "None")} tone={s.underCount > 0 ? "warning" : "success"} />
          </div>
        </>
      ),
      note: t(
        "这样型芯一侧要多出一圈钢包住内收的那一段，分型面不再是平的底面，模具结构要和模具厂确认。",
        "The core side now needs a ring of steel around the tucked band, and the parting surface is no longer the flat bottom: confirm the mold layout with the moldmaker.",
      ),
      noteTitle: t("模具上的代价", "The cost in the mold"),
    },
    {
      title: t("复检：三项全绿", "Re-check: all three green"),
      body: byLocale(
        <>
          <p>三处修改都在内侧或模具上，A 面一处没动。逐项再跑一遍。</p>
        </>,
        <>
          <p>All three fixes are on the inside or in the mold, and the Class-A surface hasn't changed anywhere. Run each check once more.</p>
        </>,
      ),
      task: { label: t("三项检查都看一遍，全部通过", "Run all three checks and see them all pass"), done: (s) => s.ranAll.draft && s.ranAll.thick && s.ranAll.undercut && Object.values(passes(s)).every(Boolean) },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("检查", "Check")}</span>
            <Segmented
              size="sm"
              aria-label={t("检查", "Check")}
              value={s.check}
              onValueChange={(v: Check) => c.setCheck(v)}
              options={(Object.keys(CHECK_NAME) as Check[]).map((k) => ({ value: k, label: CHECK_NAME[k] }))}
            />
          </div>
          <table className="mt-4 w-full text-small">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="pb-1 font-medium">{t("检查", "Check")}</th>
                <th className="pb-1 font-medium">{t("改前", "Before")}</th>
                <th className="pb-1 font-medium">{t("改在哪", "Fix")}</th>
              </tr>
            </thead>
            <tbody className="align-top">
              <tr className="border-t">
                <td className="py-1.5 pr-2">{CHECK_NAME.draft}</td>
                <td className="py-1.5 pr-2">{t("内壁 0°", "Inner walls 0°")}</td>
                <td className="py-1.5">{t(`内壁加 ${s.draftIn}°`, `${s.draftIn}° on the inner walls`)}</td>
              </tr>
              <tr className="border-t">
                <td className="py-1.5 pr-2">{CHECK_NAME.thick}</td>
                <td className="py-1.5 pr-2">{t(`拇指位 ${WALL + PAD.h} mm`, `Thumb pad ${WALL + PAD.h} mm`)}</td>
                <td className="py-1.5">{t("从内侧掏空", "Cored out from inside")}</td>
              </tr>
              <tr className="border-t">
                <td className="py-1.5 pr-2">{CHECK_NAME.undercut}</td>
                <td className="py-1.5 pr-2">{t("底边内收", "Tuck-under")}</td>
                <td className="py-1.5">{t("分型线移到腰线", "Parting line on the character line")}</td>
              </tr>
            </tbody>
          </table>
          {s.check === "thick" && <ThickLegend />}
          {s.check !== "thick" && <DraftLegend />}
          {!Object.values(passes(s)).every(Boolean) && <Hint tone="warning">{t("还有一项没通过。", "One check still fails.")}</Hint>}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("A 面不能动，内壁拔模不够，怎么改？", "The Class-A surface is fixed and the inner walls lack draft. What do you change?"),
      options: byLocale(
        ["在内壁加拔模，开口一侧最宽", "让造型把外表面也改斜", "加大顶出力，硬顶出来"],
        ["Add draft to the inner walls, widest at the opening", "Ask design to slope the outside too", "Push harder with the ejectors"],
      ),
      answer: 0,
      explain: t(
        "内壁由型芯成形，拔模加在内侧就够了，壁厚只略有变化，外观不受影响。硬顶会拉伤、顶白甚至变形。",
        "The core forms the inner walls, so draft added there is enough; the wall changes only slightly and the appearance not at all. Forcing it out scuffs, whitens or deforms the part.",
      ),
    },
    {
      q: t("外观上鼓起的拇指位，背面是平的，会怎样？", "A raised thumb pad on the outside has a flat back. What happens?"),
      options: byLocale(
        ["局部变厚：缩痕、冷却时间变长", "更结实，是好事", "没影响，壁厚只看侧壁"],
        ["A local thick spot: sink marks and a longer cooling time", "It's stronger, which is good", "Nothing: wall thickness is only about the side walls"],
      ),
      answer: 0,
      explain: t(
        "壁厚要处处均匀。造型上的凸起要从内侧掏空，让内表面跟着外形走；需要刚度就加筋，不要加厚。",
        "Wall thickness should be even everywhere. Core styling bumps out from the inside so the inner surface follows the form; if you need stiffness, add ribs rather than thickness.",
      ),
    },
    {
      q: t("底边内收造成倒扣，不改造型的办法是？", "A tuck-under at the bottom edge makes an undercut. How do you fix it without restyling?"),
      options: byLocale(
        ["把分型线移到内收上方的棱线上", "加滑块包住一整圈", "加大拔模角"],
        ["Move the parting line up to the crease above the tuck-under", "Add slides all the way around", "Add more draft"],
      ),
      answer: 0,
      explain: t(
        "分型线移到最宽处的棱线上，内收那一圈改由型芯一侧成形，倒扣就没了，分型线还藏在棱上。一整圈滑块也能做，但贵得多；拔模解决不了倒扣。",
        "With the parting line on the crease at the widest section, the tucked band is formed from the core side, the undercut disappears, and the line hides on the crease. Slides all around would work but cost far more; draft can't cure an undercut.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "造型件的 DFM 回检看三项：拔模、壁厚、倒扣；A 面是给定的，修改放在内侧和模具上",
      "内壁加拔模，开口一侧最宽；外形上的凸起从内侧掏空，壁厚跟着外形走",
      "外观造成的倒扣先看分型线：移到最宽处的棱线上，倒扣消失，分型线也藏住了",
    ],
    [
      "A DFM review of a styled part checks three things: draft, wall thickness and undercuts. The Class-A surface is given: fixes go on the inside and into the mold",
      "Draft the inner walls so the opening is widest; core out styling bumps from the inside so the wall follows the form",
      "For an undercut the styling creates, look at the parting line first: on the crease at the widest section, the undercut disappears and the line hides",
    ],
  ),
  next: {
    to: "/lesson/draft-analysis",
    label: t("注塑：拔模与分型线", "Injection molding: draft and parting lines"),
    text: t("回到基础：拔模角、纹理和分型线的规则。", "Back to the basics: the rules for draft angles, textures and parting lines."),
  },
  overlay: ({ s }) => {
    const p = passes(s)
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <SceneChip tone="primary">{t("A 面未改动", "Class-A surface unchanged")}</SceneChip>
        {s.step >= 1 &&
          (Object.keys(CHECK_NAME) as Check[]).map((k) => (
            <SceneChip key={k} className={cn(s.check === k && "ring-1 ring-ring")}>
              <Status ok={p[k]} />
              {CHECK_NAME[k]}
            </SceneChip>
          ))}
      </div>
    )
  },
}

export default lesson
