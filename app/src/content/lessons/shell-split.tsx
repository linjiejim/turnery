import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { H, SplitScene, ZW, type Preset, type ScrewSide, type SplitState } from "./shell-split.scene"
import type { LessonDef } from "./types"

/** 5.6.1 「外观件拆件与结构化」. */

const extraText = (s: SplitState) =>
  s.extraLine === "both"
    ? t("两个壳都有", "On both shells")
    : s.extraLine === "top"
      ? t("上壳多一条", "One more on the top shell")
      : s.extraLine === "bottom"
        ? t("下壳多一条", "One more on the bottom shell")
        : t("没有", "None")

function HeightSlider({ s, c }: { s: SplitState; c: SplitScene }) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label={t("分型高度", "Split height")}
      value={s.h}
      min={4}
      max={H - 4}
      step={0.5}
      onChange={(v) => c.setSplit({ h: v })}
      hint={t(`腰线（最宽处，带美工线）在 ${ZW} mm。`, `The waistline (widest section, with the groove) is at ${ZW} mm.`)}
    />
  )
}

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-axis-y" />
      <span>{t("拔模足够", "Enough draft")}</span>
      <span className="size-3 rounded-xs bg-scene-modified" />
      <span>{t("拔模不足 1°", "Under 1° of draft")}</span>
      <span className="size-3 rounded-xs bg-axis-x" />
      <span>{t("倒扣", "Undercut")}</span>
      <span className="h-0 w-3 border-t border-dashed border-muted-foreground" />
      <span>{t("这个壳的模具自己的分模线", "A parting line the shell's own mold needs")}</span>
    </div>
  )
}

const lesson: LessonDef<SplitState, SplitScene> = {
  id: "shell-split",
  codes: ["5.6.1"],
  title: t("外观件拆件：分型线、止口与装配", "Splitting a styled housing: parting line, lip and assembly"),
  create: (v, emit) => new SplitScene(v, emit),
  steps: [
    {
      title: t("一体的造型，两个零件", "One form, two parts"),
      body: byLocale(
        <>
          <p>造型给的是一个整体：平整的顶面，肩部一圈大圆角，腰上一道美工线。它是空心的，里面要装电路板。</p>
          <p>封闭的空壳没法一次注塑：型芯放进去就拿不出来，零件也装不进去。所以要拆成上壳和下壳，每个都是开口的壳，各自开模。</p>
        </>,
        <>
          <p>Design hands over one whole form: a flat top, a large radius around the shoulder, a groove around the waist. It is hollow, and a circuit board has to go inside.</p>
          <p>
            A closed hollow shell can't be molded in one shot: once the core is inside, it can't come out, and nothing can be put in. So it is split into a top and a bottom
            shell, each open on one side and molded on its own.
          </p>
        </>,
      ),
      task: { label: t("把两个壳拉开", "Pull the two shells apart"), done: (s) => s.explode >= 10 },
      extra: ({ s, c }) => (
        <ParamSlider className="mt-3 px-0" label={t("拉开", "Pull apart")} value={s.explode} min={0} max={30} step={0.5} onChange={(v) => c.setExplode(v)} />
      ),
    },
    {
      title: t("分在哪：两个壳各自脱模", "Where to split: each shell has to release"),
      body: byLocale(
        <>
          <p>两个壳各开一副模，都沿 Z 开模。从壳的口沿往外看：先是朝口沿一侧脱模的面，过了最宽的地方，就换成朝另一侧脱模。</p>
          <p>最宽处如果不在口沿上，这个壳的模具就得在最宽处再分一次模，产品上多一条分模线。美工线如果整条落在一个壳里，它的凹槽还会变成倒扣。</p>
        </>,
        <>
          <p>
            Each shell gets its own mold, pulled along Z. Walk outward from a shell's rim: first come faces that release toward the rim side; past the widest point they switch to
            releasing the other way.
          </p>
          <p>
            If the widest point isn't at the rim, that shell's mold has to split again at the widest point, leaving one more parting line on the product. And if the groove falls
            entirely inside one shell, its recess becomes an undercut.
          </p>
        </>,
      ),
      task: { label: t("先放到别处看看问题，再找一个干净的高度", "Try a height that causes trouble, then find a clean one"), done: (s) => s.triedOff && s.foundClean },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("分型面放在哪，两个壳都只有口沿这一条线？", "Where should the split go so each shell has just the one line at its rim?")}
            options={byLocale(["顶部的肩部圆角上", "腰线：最宽的那一圈", "正中间的高度"], ["On the shoulder radius at the top", "The waistline: the widest section", "Halfway up"])}
            answer={1}
            explain={t(
              "两个壳的脱模方向在最宽处翻转。分型面放在最宽处，两边的模具分型线都和口沿重合，产品上只有一条线。",
              "The release direction flips at the widest section. Split there, and both molds' parting lines coincide with the rims: one line on the product.",
            )}
            onReveal={() => c.setSplit({ h: ZW })}
          />
          <HeightSlider s={s} c={c} />
          <div className="mt-2">
            <Readout label={t("倒扣", "Undercut")} value={s.undercut ? t("有", "Yes") : t("无", "No")} tone={s.undercut ? "warning" : "success"} />
            <Readout label={t("多出的分模线", "Extra parting line")} value={extraText(s)} tone={s.extraLine ? "warning" : "success"} />
          </div>
          <Legend />
        </>
      ),
    },
    {
      title: t("分型线和高光", "The parting line and the highlight"),
      body: byLocale(
        <>
          <p>两个壳之间总有一条缝，往往还有一点错位（段差）。它落在哪，决定了看不看得见。</p>
          <p>切过高光带：亮面被一条暗线切断，最显眼。在侧面上：看得见。藏进美工线这种阴影里，或者做成一个台阶，就几乎看不出来。</p>
        </>,
        <>
          <p>There is always a gap between two shells, often with a slight mismatch (a step). Where it falls decides whether anyone sees it.</p>
          <p>
            Across the highlight: a dark line cuts the bright band, the most visible place of all. On the side wall: visible. Hidden in a shadow such as the groove, or turned into a
            deliberate step: almost invisible.
          </p>
        </>,
      ),
      task: { label: t("先放到高光带上，再放回美工线里", "Put it on the highlight first, then back in the groove"), done: (s) => s.sawHighlight && s.sawGroove },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("位置", "Position")}</span>
            <Segmented
              size="sm"
              aria-label={t("位置", "Position")}
              value={c.region(s)}
              onValueChange={(v: Preset) => c.preset(v)}
              options={[
                { value: "highlight", label: t("肩部高光上", "On the highlight") },
                { value: "side", label: t("侧面上", "On the side") },
                { value: "groove", label: t("美工线里", "In the groove") },
              ]}
            />
          </div>
          <HeightSlider s={s} c={c} />
          <ParamSlider
            className="px-0"
            label={t("倾斜", "Tilt")}
            unit="°"
            value={s.tilt}
            min={-10}
            max={10}
            step={0.5}
            onChange={(v) => c.setSplit({ tilt: v })}
            hint={t("斜着走的分型线，要和最宽处、美工线一起设计，否则会切出美工线。", "A sloping split has to be designed together with the widest section and the groove, or it runs out of the groove.")}
          />
        </>
      ),
      note: t(
        "转一转视角：高光带跟着视线在肩部移动，而美工线里一直是暗的。常见的美工线约 0.5 × 0.5 mm，这里放大画了。另一种藏法是「面刮」：让上壳外形比下壳大 0.1–0.15 mm，错位永远朝一个方向，看起来像设计好的台阶。",
        "Orbit the view: the highlight slides along the shoulder with your eye, while the groove stays dark. A typical groove is about 0.5 × 0.5 mm; it's drawn larger here. Another way to hide the gap is to make the top shell 0.1–0.15 mm larger than the bottom, so any mismatch always steps the same way and reads as a designed step.",
      ),
      noteTitle: t("看的时候", "While you look"),
    },
    {
      title: t("止口：对齐，也挡住视线", "The lip: alignment, and it blocks the view"),
      body: byLocale(
        <>
          <p>剖开口沿看。平口对接时，两个壳只靠螺丝定位，稍有变形就错开，缝里还能直接看进壳里：漏光、进灰。</p>
          <p>止口是下壳内侧的一圈凸边（公止口），插进上壳的凹槽（母止口）里：两个壳互相定位，外面的缝更均匀，视线也被挡住了。</p>
        </>,
        <>
          <p>Cut through the rim and look. With a plain butt joint the shells are located only by the screws: any warp shows as a step, and you can see straight into the housing through the gap. Light leaks out, dust gets in.</p>
          <p>
            A lip is a raised rim on the inside of the bottom shell (the male lip) that fits into a groove in the top shell (the female side). The shells locate each other, the gap
            outside gets more even, and the line of sight is blocked.
          </p>
        </>,
      ),
      task: { label: t("平口和止口都看一遍", "Look at both the plain joint and the lip"), done: (s) => s.triedLip && s.triedPlain },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("口沿", "Rim")}</span>
            <Segmented
              size="sm"
              aria-label={t("口沿", "Rim")}
              value={s.lip ? "lip" : "plain"}
              onValueChange={(v) => c.setLip(v === "lip")}
              options={[
                { value: "plain", label: t("平口", "Plain") },
                { value: "lip", label: t("止口", "Lip and groove") },
              ]}
            />
          </div>
          <ParamSlider className="mt-3 px-0" label={t("缝隙", "Gap")} value={s.explode} min={0} max={1.5} step={0.05} onChange={(v) => c.setExplode(v)} />
          <Hint>
            {t(
              "常见经验：公止口宽约为壁厚的一半，高约为宽的 1–1.5 倍；配合面单边留 0.05–0.1 mm，顶部留 0.1–0.2 mm 避空；配合面也要拔模。各厂标准不同。",
              "Common practice: the male lip is about half the wall thick and 1–1.5 times as tall as it is wide; leave 0.05–0.1 mm per side on the fit and 0.1–0.2 mm clear at the top; the fit faces need draft too. Every company has its own standard.",
            )}
          </Hint>
        </>
      ),
      note: t(
        "公止口一般做在较薄、或者更容易受力变形的那个壳上，放在内侧，外力压过来时被另一个壳顶住。",
        "The male lip usually goes on the thinner shell, or the one more likely to be pushed in, on the inside, so a push from outside is taken by the other shell.",
      ),
      noteTitle: t("放在哪个壳", "Which shell gets it"),
    },
    {
      title: t("螺丝从哪边来", "Which side the screws come from"),
      body: byLocale(
        <>
          <p>螺丝从看不见的底面打进来，穿过下壳的过孔，拧进上壳的长螺丝柱：顶面保持完整。</p>
          <p>螺丝柱、止口、筋都沿 Z 方向，装配方向和开模方向一致：它们能直接脱模，装配也只需一个直线动作。</p>
        </>,
        <>
          <p>The screws come in from the hidden bottom face, pass through clearance holes in the bottom shell and thread into long bosses in the top shell: the top stays clean.</p>
          <p>Bosses, lip and ribs all run along Z, so the assembly direction matches the pull direction: they release straight from the mold, and assembly is one straight motion.</p>
        </>,
      ),
      task: { label: t("选螺丝从底面进，播放装配", "Choose screws from the bottom and play the assembly"), done: (s) => s.assembled },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("螺丝", "Screws")}</span>
            <Segmented
              size="sm"
              aria-label={t("螺丝", "Screws")}
              value={s.screws ?? "none"}
              onValueChange={(v) => v !== "none" && c.setScrews(v as ScrewSide)}
              options={[
                { value: "bottom", label: t("从底面打", "From the bottom") },
                { value: "top", label: t("从顶面打", "From the top") },
              ]}
            />
          </div>
          <Button size="sm" variant="secondary" className="mt-3" disabled={!s.screws} onClick={() => c.assemble()}>
            <Play />
            {t("播放装配", "Play the assembly")}
          </Button>
          {s.screws === "top" && (
            <Hint tone="warning">
              {t(
                "螺丝头落在顶面的外观面上：要加装饰盖或脚垫遮住，还会在顶面留下缩痕的风险。能从底面进就从底面进。",
                "The screw heads land on the cosmetic top: they need covers, and the bosses behind the top risk sink marks there. Screw from the bottom whenever you can.",
              )}
            </Hint>
          )}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("拆上下壳时，分型面最好放在哪？", "When splitting a housing into two shells, where is the best place for the split?"),
      options: byLocale(
        ["高光最亮的地方，显得利落", "最宽的那一圈，并藏进美工线或台阶", "随便放，后面喷漆能盖住"],
        ["Where the highlight is brightest, for a crisp look", "On the widest section, hidden in a groove or a step", "Anywhere: paint will cover it"],
      ),
      answer: 1,
      explain: t(
        "放在最宽处，两副模具的分型线都和口沿重合，只有一条线；藏进阴影，缝和错位都看不出来。切过高光，暗线最显眼；喷漆盖不住缝。",
        "On the widest section, both molds' parting lines coincide with the rims, so there's only one line; in a shadow, the gap and any mismatch disappear. Across a highlight, the dark line is at its most visible, and paint can't hide a gap.",
      ),
    },
    {
      q: t("上下壳之间做止口，主要为了什么？", "What is the lip and groove between two shells mainly for?"),
      options: byLocale(
        ["定位两个壳，挡住从缝里看进去的视线", "让壳更厚、更结实", "方便脱模"],
        ["Locating the shells and blocking the view through the gap", "Making the shells thicker and stronger", "Making them easier to release from the mold"],
      ),
      answer: 0,
      explain: t(
        "止口让两个壳互相对准，缝更均匀，也挡住光和灰。壳的刚度主要靠壁厚和筋；止口本身也要拔模，并不帮助脱模。",
        "The lip makes the shells line each other up, evens out the gap and keeps light and dust out. A shell's stiffness comes mainly from its walls and ribs, and the lip needs draft itself rather than helping release.",
      ),
    },
    {
      q: t("消费电子外壳的螺丝，一般从哪边打？", "Which side do the screws of a consumer electronics housing usually come from?"),
      options: byLocale(
        ["从顶面，维修方便", "从底面或不显眼的一面，顶面保持完整", "从侧面，两个壳都不受影响"],
        ["From the top, for easy servicing", "From the bottom or another hidden face, keeping the top intact", "From the side, so neither shell is affected"],
      ),
      answer: 1,
      explain: t(
        "螺丝和螺丝柱都沿装配方向（也就是开模方向）：从底面进，螺丝头藏起来，上壳只多出内部的螺丝柱。侧向的螺丝需要侧向的孔，又是倒扣。",
        "Screws and bosses follow the assembly direction, which is the pull direction: from the bottom, the heads are hidden and the top shell only gains bosses inside. Screws from the side need side holes: undercuts again.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "分型面放在最宽的那一圈：两个壳都只在口沿有一条线；放在别处，会多一条分模线，凹槽还会变成倒扣",
      "缝要藏：别切过高光，放进美工线、台阶这类阴影里",
      "止口定位、遮缝，配合面留 0.05–0.1 mm 并拔模；螺丝从底面进，装配方向和开模方向一致",
    ],
    [
      "Split on the widest section: each shell then has a single line at its rim. Anywhere else adds a parting line, and a groove can become an undercut",
      "Hide the gap: keep it off the highlight and put it in a shadow, such as a groove or a step",
      "A lip and groove locates the shells and hides the gap (0.05–0.1 mm on the fit, with draft). Screws come in from the bottom, along the same direction as the pull",
    ],
  ),
  next: {
    to: "/lesson/styling-dfm",
    label: t("造型件的 DFM 回检", "DFM review of a styled part"),
    text: t("拆好的外观件再过一遍拔模、壁厚、倒扣，而且不碰外观面。", "Run the split part through draft, wall thickness and undercut checks, without touching the cosmetic surface."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
      <SceneChip>
        {t("分型", "Split")} z {s.h} mm{s.tilt !== 0 ? ` · ${t("倾斜", "tilt")} ${s.tilt}°` : ""}
      </SceneChip>
      {s.step === 1 && (
        <SceneChip tone={!s.undercut && !s.extraLine ? "primary" : undefined}>
          {!s.undercut && !s.extraLine ? t("两个壳都干净", "Both shells clean") : s.undercut ? t("有倒扣", "Undercut") : t("多一条分模线", "Extra parting line")}
        </SceneChip>
      )}
      {s.step === 3 && <SceneChip>{t("剖面 · 前视", "Section · Front")}</SceneChip>}
    </div>
  ),
}

export default lesson
