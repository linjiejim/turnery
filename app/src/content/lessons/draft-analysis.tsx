import { ArrowDown, Box, Columns2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { DraftScene, MIN_SMOOTH, MIN_TEXTURE, PART, type DraftState } from "./draft-analysis.scene"
import type { LessonDef } from "./types"

/** 4.4.1 · 4.4.2 · 4.4.3 「注塑：拔模与分型线」. */

function Legend({ window }: { window?: boolean }) {
  const rows = [
    { cls: "bg-axis-y", text: t("正拔模：随型腔向上脱出", "Positive draft: releases upward with the cavity") },
    { cls: "bg-primary", text: t("负拔模：随型芯向下脱出", "Negative draft: releases downward with the core") },
    { cls: "bg-scene-modified", text: t("拔模不足：低于最小角度", "Too little draft: below the minimum angle") },
    {
      cls: "bg-axis-x",
      text: window
        ? t("倒扣：两半模具都脱不出", "Undercut: neither mold half can release it")
        : t("倒扣：反着开模方向倾斜", "Undercut: slopes against the pull direction"),
    },
  ]
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      {rows.map((r) => (
        <div key={r.cls} className="contents">
          <span className={`size-3 rounded-xs ${r.cls}`} />
          <span>{r.text}</span>
        </div>
      ))}
    </div>
  )
}

function MouldButton({ s, c }: { s: DraftState; c: DraftScene }) {
  return (
    <Button size="sm" variant="secondary" onClick={() => c.toggleMould()}>
      <Columns2 />
      {s.open > 0.5 ? t("合上模具", "Close the mold") : t("打开模具", "Open the mold")}
    </Button>
  )
}

function DraftSlider({ s, c }: { s: DraftState; c: DraftScene }) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label={t("拔模角", "Draft angle")}
      unit="°"
      value={s.draft}
      min={0}
      max={5}
      step={0.25}
      onChange={(v) => c.setDraft(v)}
      hint={t("侧壁、凸台、筋、孔一起按这个角度拔模。", "Side walls, bosses, ribs and holes all get this draft angle.")}
    />
  )
}

const lesson: LessonDef<DraftState, DraftScene> = {
  id: "draft-analysis",
  codes: ["4.4.1", "4.4.2", "4.4.3"],
  title: t("注塑：拔模与分型线", "Injection molding: draft and parting lines"),
  create: (v, emit) => new DraftScene(v, emit),
  steps: [
    {
      title: t("两半模具，一个方向", "Two mold halves, one direction"),
      body: byLocale(
        <>
          <p>注塑件在两半钢模之间成形。型腔（定模）成形外表面，型芯（动模）成形内表面。塑料冷却后，两半沿同一条直线分开，这个方向叫开模方向。</p>
          <p>这个小盖子开口朝下：型腔向上拔，型芯向下退，零件再被顶出。</p>
        </>,
        <>
          <p>
            An injection-molded part takes shape between two steel mold halves. The cavity (the fixed half) forms the outside surface, and the core (the moving half) forms the inside
            surface. Once the plastic has cooled, the two halves separate along one straight line. That direction is the pull direction.
          </p>
          <p>This small cover opens downward: the cavity pulls off upward, the core drops away downward, and then the part is ejected.</p>
        </>,
      ),
      task: { label: t("打开模具，看两半怎么分开", "Open the mold and watch how the halves separate"), done: (s) => s.opened },
      extra: ({ s, c }) => (
        <div className="mt-3">
          <MouldButton s={s} c={c} />
        </div>
      ),
    },
    {
      title: t("拔模分析", "Draft analysis"),
      body: byLocale(
        <>
          <p>现在所有侧壁都是竖直的（拔模角 0°）。开模时竖直面全程贴着钢面摩擦：表面拉伤，零件还可能卡在模具里顶不出来。</p>
          <p>拔模分析按每个面的法向和开模方向的夹角上色。注意负拔模不是错：型芯一侧的面本来就朝下，跟着型芯走。橙色才是要改的。</p>
        </>,
        <>
          <p>
            Right now every side wall is vertical (0° draft). As the mold opens, a vertical face rubs against the steel the whole way: the surface gets scuffed, and the part can stick in
            the mold and fail to eject.
          </p>
          <p>
            Draft analysis colors each face by the angle between its normal and the pull direction. Negative draft is not an error: the faces on the core side are meant to face down and
            go with the core. Orange is what you need to fix.
          </p>
        </>,
      ),
      task: { label: t("从下面看看盒子里面：凸台、筋和内壁", "Look inside the box from below: the boss, the rib and the inner walls"), done: (s) => s.sawInside },
      extra: ({ c }) => (
        <>
          <Legend />
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.lookBelow()}>
            <ArrowDown />
            {t("从下面看", "View from below")}
          </Button>
        </>
      ),
      terms: ["draft"],
    },
    {
      title: t("加上拔模角", "Add draft"),
      body: byLocale(
        <>
          <p>给侧壁一个小斜度，开模的一瞬间零件就和钢面脱开了。</p>
          <p>
            Protolabs 的建议：竖直面最少 0.5°，多数情况 2°；经验上每 25 mm 深约 1°。这个盒子深 {PART.h} mm，分析阈值取 {MIN_SMOOTH}°。各家数值不同，以供应商的 DFM 报告为准。
          </p>
        </>,
        <>
          <p>Give the side walls a slight taper, and the part breaks free of the steel the moment the mold opens.</p>
          <p>
            Protolabs recommends at least 0.5° on vertical faces and 2° in most cases; a rule of thumb is about 1° per 25 mm of depth. This box is {PART.h} mm deep, so the analysis
            threshold here is {MIN_SMOOTH}°. Numbers vary from supplier to supplier: go by your supplier's DFM report.
          </p>
        </>,
      ),
      task: { label: t("把拔模角加到没有橙色的面", "Increase the draft until no face is orange"), done: (s) => s.draft > 0 && !s.hasLow },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("型腔要向上拔出，盒子外侧壁应该怎么斜？", "The cavity pulls off upward. Which way should the box's outer walls slope?")}
            options={byLocale(
              ["上窄下宽", "上宽下窄", "竖直就行，脱模剂会解决"],
              ["Narrower at the top, wider at the bottom", "Wider at the top, narrower at the bottom", "Vertical is fine; mold release will take care of it"],
            )}
            answer={0}
            explain={t(
              "外壁跟着型腔向上走，所以越往上越窄；内腔跟着型芯向下走，所以越往开口越宽。凸台和筋则是根部厚、端部薄。",
              "The outer walls leave upward with the cavity, so they get narrower toward the top. The inside leaves downward with the core, so it gets wider toward the opening. Bosses and ribs are thick at the base and thinner at the tip.",
            )}
            onReveal={() => c.setDraft(2)}
          />
          <DraftSlider s={s} c={c} />
          <Legend />
        </>
      ),
      terms: ["draft"],
    },
    {
      title: t("纹理要更大的拔模", "Textures need more draft"),
      body: byLocale(
        <>
          <p>外观面常做咬花纹理。纹理的凹凸在开模时会刮过钢面，所以带纹理的面要更大的拔模：Protolabs 对轻纹理（PM-T1、PM-T2）要求至少 3°，纹理越深要求越大。</p>
          <p>只有外观面（型腔侧）带纹理，内部结构还按光面算。</p>
        </>,
        <>
          <p>
            Cosmetic faces often get an etched mold texture. The texture's peaks and valleys scrape along the steel as the mold opens, so textured faces need more draft: Protolabs asks for
            at least 3° on light textures (PM-T1, PM-T2), and more the deeper the texture.
          </p>
          <p>Only the cosmetic faces (the cavity side) are textured. The features inside still count as smooth.</p>
        </>,
      ),
      task: {
        label: t(`换成轻纹理，再把拔模加到 ${MIN_TEXTURE}° 以上`, `Switch to a light texture, then raise the draft to ${MIN_TEXTURE}° or more`),
        done: (s) => s.texture && !s.hasLow,
      },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("外观面", "Cosmetic faces")}</span>
            <Segmented
              size="sm"
              aria-label={t("外观面", "Cosmetic faces")}
              value={s.texture ? "tex" : "smooth"}
              onValueChange={(v) => c.setTexture(v === "tex")}
              options={[
                { value: "smooth", label: t(`光面 · ${MIN_SMOOTH}°`, `Smooth · ${MIN_SMOOTH}°`) },
                { value: "tex", label: t(`轻纹理 · ${MIN_TEXTURE}°`, `Light texture · ${MIN_TEXTURE}°`) },
              ]}
            />
          </div>
          <DraftSlider s={s} c={c} />
          {s.texture && s.hasLow && (
            <Hint tone="warning">
              {byLocale(
                <>外壁变成了橙色：{s.draft}° 对光面够了，对纹理不够。</>,
                <>The outer walls turned orange: {s.draft}° is enough for a smooth finish, but not for a texture.</>,
              )}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("分型线", "Parting line"),
      body: byLocale(
        <>
          <p>两半模具在零件上的交界线叫分型线。拔模分析里，正拔模区和负拔模区的分界，就是分型线可以走的地方。</p>
          <p>这里它落在盒口外沿：外壁全在型腔里，内腔全在型芯里，盒口底面是两半钢模贴合的封胶面。分型线会在零件上留下一圈细痕，所以通常放在不显眼的边上。</p>
        </>,
        <>
          <p>
            The line on the part where the two mold halves meet is the parting line. In a draft analysis, the boundary between the positive-draft and negative-draft regions is where the
            parting line can run.
          </p>
          <p>
            Here it falls on the outer edge of the box's rim: the outer walls are entirely in the cavity, the inside entirely on the core, and the underside of the rim is the shut-off,
            where the two steel halves seal against each other. The parting line leaves a thin witness line around the part, so it usually goes on an edge where it won't be noticed.
          </p>
        </>,
      ),
      task: { label: t("打开模具，看分型线两边各归哪一半", "Open the mold and see which half each side of the parting line belongs to"), done: (s) => s.openedParting },
      extra: ({ s, c }) => (
        <div className="mt-3">
          <MouldButton s={s} c={c} />
        </div>
      ),
    },
    {
      title: t("倒扣：侧面的窗口", "Undercut: a window in the side"),
      body: byLocale(
        <>
          <p>在侧壁上开一个窗口。填满窗口的那块钢，向上拔会被窗口上沿勾住，向下退又被下沿挡住：两半都脱不出，这就是倒扣。</p>
          <p>解决办法：开模前让一块滑块（侧抽）沿 +X 先退出来。滑块让模具更贵、周期更长；能改设计就先改，比如把窗口改成从顶面通下来的缺口。</p>
        </>,
        <>
          <p>
            Cut a window in a side wall. The block of steel that fills the window catches on the window's top edge if it pulls up, and on the bottom edge if it drops down: neither half
            can release. That is an undercut.
          </p>
          <p>
            The fix: before the mold opens, a slide (side action) backs out along +X first. Slides make the mold more expensive and the cycle longer, so change the design first if you
            can, for example by turning the window into a notch that runs down from the top face.
          </p>
        </>,
      ),
      task: { label: t("试着开模，再加滑块重新开模", "Try to open the mold, then add a slide and open it again"), done: (s) => s.openedSlider },
      extra: ({ s, c }) => (
        <>
          <Legend window />
          <div className="mt-3 flex flex-wrap gap-2">
            <MouldButton s={s} c={c} />
            <Button size="sm" variant={s.slider ? "secondary" : "primary"} disabled={s.slider} onClick={() => c.setSlider(true)}>
              <Box />
              {t("加滑块", "Add a slide")}
            </Button>
          </div>
          {s.stuck && <Hint tone="warning">{t("型腔拔不动：窗口里的钢被零件勾住了。", "The cavity won't come off: the part has hooked the steel in the window.")}</Hint>}
        </>
      ),
      note: t(
        "侧抽只能在垂直于开模方向的平面里运动，还要能从外侧分型线够到。轻微倒扣有时可以强脱（零件变形后弹回），能不能用看材料和供应商。",
        "A side action can only move in a plane perpendicular to the pull direction, and it has to reach the feature from the parting line on the outside. A slight undercut can sometimes be stripped (bumped off: the part flexes and springs back); whether that works depends on the material and the supplier.",
      ),
      noteTitle: t("工艺说明", "Process note"),
    },
    {
      title: t("壁厚要均匀", "Keep the wall thickness uniform"),
      body: byLocale(
        <>
          <p>剖开看：外壁 {PART.t} mm；筋根部 1.5 mm，凸台壁 1.5 mm，都是主壁的 60%，不超过 40–60% 的上限。</p>
          <p>塑料从表面开始冷却，厚的地方最后凝固、收缩最多，会把表面拉出凹坑（缩痕），还会翘曲。所以凸台做成空心柱，加强靠筋，不靠把壁加厚。</p>
        </>,
        <>
          <p>
            Look at the section: the outer wall is {PART.t} mm, the rib is 1.5 mm at its root and the boss wall is 1.5 mm. Both are 60% of the main wall, at the top of the 40–60% range
            but not over it.
          </p>
          <p>
            Plastic cools from the surface inward. Thick areas solidify last and shrink the most, which pulls dents into the surface (sink marks) and also causes warping. So the boss is
            a hollow post, and strength comes from ribs, not from thicker walls.
          </p>
        </>,
      ),
      task: { label: t("比较空心柱和实心粗柱", "Compare a hollow boss with a thick solid one"), done: (s) => s.triedSolid && s.triedHollow },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("凸台", "Boss")}</span>
            <Segmented
              size="sm"
              aria-label={t("凸台", "Boss")}
              value={s.solidBoss ? "solid" : "hollow"}
              onValueChange={(v) => c.setSolidBoss(v === "solid")}
              options={[
                { value: "hollow", label: t("空心柱 + 筋", "Hollow + rib") },
                { value: "solid", label: t("实心粗柱", "Thick solid") },
              ]}
            />
          </div>
          <div className="mt-3">
            <Readout label={t("主壁", "Main wall")} value={PART.t} unit="mm" />
            <Readout
              label={s.solidBoss ? t("凸台实心直径", "Solid boss diameter") : t("凸台壁", "Boss wall")}
              value={s.solidBoss ? "13" : "1.5"}
              unit="mm"
              tone={s.solidBoss ? "warning" : "success"}
            />
          </div>
          <Hint>
            {t(
              "常用塑料的推荐壁厚大致在 1–3.5 mm（Protolabs：ABS 1.14–3.56 mm），具体取决于材料和零件大小。",
              "The recommended wall thickness for common plastics is roughly 1–3.5 mm (Protolabs: 1.14–3.56 mm for ABS), depending on the material and the size of the part.",
            )}
          </Hint>
        </>
      ),
      terms: ["shell", "rib"],
    },
  ],
  quiz: [
    {
      q: t("拔模分析里，一个盒子的内壁显示为「负拔模」，说明什么？", "In a draft analysis, a box's inner walls show “negative draft”. What does that mean?"),
      options: byLocale(
        ["这些面有问题，必须改", "它们朝开模方向的反向倾斜，随型芯一侧脱模，通常没问题", "零件放反了"],
        ["These faces are a problem and must be changed", "They slope the opposite way to the pull direction and release with the core; that is usually fine", "The part is upside down"],
      ),
      answer: 1,
      explain: t(
        "分析只给一个开模方向。型芯一侧的面本来就朝下，显示为负拔模；要改的是低于最小角度的面，以及两边都脱不出的倒扣。",
        "The analysis uses a single pull direction. Faces on the core side are meant to face down, so they show as negative draft. What you need to fix are faces below the minimum angle, and undercuts that neither half can release.",
      ),
    },
    {
      q: t("外观面从光面改成轻纹理，拔模角一般要怎样？", "When a cosmetic face goes from smooth to a light texture, what usually has to happen to the draft angle?"),
      options: byLocale(
        ["可以减小，纹理会帮助脱模", "不用变", "要加大，轻纹理通常至少 3°"],
        ["It can be smaller; the texture helps the part release", "Nothing; it stays the same", "It must be larger; light textures usually need at least 3°"],
      ),
      answer: 2,
      explain: t(
        "纹理的凹凸在开模时会刮伤或卡住，需要更大的拔模。Protolabs 对轻纹理要求至少 3°，纹理越深要求越大。",
        "The texture's peaks and valleys scuff or catch as the mold opens, so it needs more draft. Protolabs asks for at least 3° on light textures, and more the deeper the texture.",
      ),
    },
    {
      q: t("螺丝柱附近外表面出现凹坑，最合理的改法是？", "Dents show up on the outer surface near a screw boss. What is the most sensible fix?"),
      options: byLocale(
        ["把凸台做成实心，让它更结实", "凸台改成空心、壁厚取主壁的 40–60%，用筋加强", "把整个外壁加厚"],
        ["Make the boss solid so it's stronger", "Make the boss hollow, with a wall 40–60% of the main wall, and reinforce it with ribs", "Make the whole outer wall thicker"],
      ),
      answer: 1,
      explain: t(
        "凹坑是缩痕：厚处最后冷却、收缩最多。让壁厚均匀才能根治；加厚只会让缩痕更重。",
        "The dents are sink marks: thick areas cool last and shrink the most. Only uniform walls cure them; thickening the wall only makes the sink worse.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "先定开模方向：型腔成形外表面，型芯成形内表面，所有面都要朝自己那一半拔模",
      "光面至少 0.5°、通常 2°，轻纹理至少 3°；具体数值以供应商的 DFM 报告为准",
      "分型线在正负拔模的分界上；侧孔这类倒扣要靠滑块，能改设计先改设计；壁厚保持均匀",
    ],
    [
      "Set the pull direction first: the cavity forms the outside, the core forms the inside, and every face needs draft toward its own half",
      "Smooth faces need at least 0.5°, usually 2°; light textures at least 3°. Go by your supplier's DFM report for the actual numbers",
      "The parting line runs where positive draft meets negative draft. Undercuts such as side holes need slides, so change the design first if you can. Keep wall thickness uniform",
    ],
  ),
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>{t("开模方向 +Z", "Pull direction +Z")}</SceneChip>
      {s.step >= 1 && s.step <= 5 && (
        <SceneChip tone="primary">
          {t("拔模", "Draft")} {s.draft}° · {s.texture ? t("轻纹理", "Light texture") : t("光面", "Smooth")}
        </SceneChip>
      )}
      {s.section && <SceneChip>{t("剖面 · 前视", "Section · Front")}</SceneChip>}
    </div>
  ),
}

export default lesson
