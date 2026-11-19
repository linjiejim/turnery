import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { fmt, linearLayout, MARGIN, PatternMirrorScene, polarStep, type PatternMirrorState } from "./pattern-mirror.scene"
import type { LessonDef } from "./types"

/** 1.2.5 「阵列与镜像」: copy a seed feature by a rule — linear, circular, mirror. */

function outHint(s: PatternMirrorState) {
  const lay = linearLayout(s)
  return (
    <>
      {lay.outCount > 0 && (
        <Hint tone="warning">
          {byLocale(
            <>有 {lay.outCount} 个孔超出了板边。真实软件里，部分在外的孔会在板边切出缺口，完全在外的什么也切不到，有的软件会直接报错。</>,
            <>
              {lay.outCount === 1 ? "1 hole runs" : `${lay.outCount} holes run`} past the edge of the plate. In real software, a hole that's partly outside cuts a notch in the
              plate edge, one that's completely outside cuts nothing, and some packages simply report an error.
            </>,
          )}
        </Hint>
      )}
      {lay.outCount === 0 && lay.overlap && (
        <Hint tone="warning">
          {t(
            "间距小于孔径，相邻的孔连成了一条槽。总长驱动守住了边界，但板短孔多时会挤在一起：这时该减数量，或者给间距设下限。",
            "The spacing is smaller than the hole diameter, so neighboring holes merge into a slot. Driving by total length kept the holes inside the plate, but on a short plate with many holes they crowd together: reduce the count, or set a minimum spacing.",
          )}
        </Hint>
      )}
    </>
  )
}

const lesson: LessonDef<PatternMirrorState, PatternMirrorScene> = {
  id: "pattern-mirror",
  codes: ["1.2.5"],
  title: t("阵列与镜像", "Patterns and mirrors"),
  create: (v, emit) => new PatternMirrorScene(v, emit),
  steps: [
    {
      title: t("先有一个种子", "Start with a seed"),
      body: byLocale(
        <>
          <p>一排孔、一圈螺栓孔、左右对称的两只耳朵，在 CAD 里都不是一个个画出来的。先做一个，再让软件按规则复制。</p>
          <p>被复制的那个特征叫「种子」，也叫源特征。后面所有的实例都引用它。</p>
        </>,
        <>
          <p>A row of holes, a ring of bolt holes, a pair of symmetric lugs: in CAD you don't draw them one at a time. You make one, then have the software copy it by a rule.</p>
          <p>The feature being copied is called the “seed”, or the source feature. Every instance that follows references it.</p>
        </>,
      ),
      task: { label: t("在视图里点选板上的孔", "Click the hole on the plate in the view"), done: (s) => s.seedPicked },
      terms: ["pattern"],
    },
    {
      title: t("线性阵列：数量和间距", "Linear pattern: count and spacing"),
      body: byLocale(
        <>
          <p>线性阵列要三样东西：方向、数量、间距。这里方向是 X 轴，间距是相邻两个孔中心之间的距离。</p>
          <p>数量包含种子本身。5 个孔只有 4 个间隔，首尾中心距是 4 × 间距。</p>
        </>,
        <>
          <p>A linear pattern needs three things: a direction, a count and a spacing. Here the direction is the X axis, and the spacing is the distance between the centers of neighboring holes.</p>
          <p>The count includes the seed itself. 5 holes have only 4 gaps, so the first and last centers are 4 × spacing apart.</p>
        </>,
      ),
      task: { label: t("把数量调到 5 个", "Set the count to 5"), done: (s) => s.count >= 5 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 space-y-2">
            <ParamSlider className="px-0" label={t("数量", "Count")} unit={t("个", "")} value={s.count} min={2} max={8} onChange={(v) => c.setCount(v)} />
            <ParamSlider className="px-0" label={t("间距", "Spacing")} value={s.spacing} min={10} max={30} onChange={(v) => c.setSpacing(v)} />
          </div>
          {outHint(s)}
        </>
      ),
      note: t(
        "SOLIDWORKS、Fusion、Onshape 的数量都含种子。有的软件还能改成输入首尾之间的总距离，下一步就讲它。",
        "In SOLIDWORKS, Fusion and Onshape, the count includes the seed. Some packages also let you enter the total distance from the first to the last instead; that's the next step.",
      ),
      terms: ["pattern"],
    },
    {
      title: t("间距驱动还是总长驱动", "Driven by spacing, or by total length"),
      body: byLocale(
        <>
          <p>同样 5 个孔，有两种说法。「间距驱动」：孔距固定。「总长驱动」：首尾两个孔之间的距离固定，间距 = 总长 ÷ (数量 − 1)。</p>
          <p>这里把总长关联到板长：总长 = 板长 − 2 × {MARGIN} mm 边距。板变了，哪种说法还成立？</p>
        </>,
        <>
          <p>
            The same 5 holes can be specified in two ways. “Driven by spacing”: the hole pitch is fixed. “Driven by total length”: the distance between the first and last holes is
            fixed, and spacing = total length ÷ (count − 1).
          </p>
          <p>Here the total length is tied to the plate length: total length = plate length − 2 × {MARGIN} mm of margin. When the plate changes, which one still holds?</p>
        </>,
      ),
      task: { label: t("两种方式下都把板长缩到 100 mm 以下", "In both modes, shrink the plate to under 100 mm"), done: (s) => s.shrunkSpacing && s.shrunkLength },
      extra: ({ s, c }) => {
        const lay = linearLayout(s)
        return (
          <>
            <Predict
              question={t("间距 22 mm 的 5 个孔，板长从 120 缩到 80，会怎样？", "There are 5 holes at 22 mm spacing, and the plate shrinks from 120 to 80. What happens?")}
              options={byLocale(
                ["5 个孔自动挤进 80 mm 的板里", "孔距不变，最后两个孔跑到板边外", "阵列自动减到放得下的数量"],
                ["The 5 holes squeeze onto the 80 mm plate by themselves", "The pitch stays the same, and the last two holes end up past the plate edge", "The pattern drops to as many holes as fit"],
              )}
              answer={1}
              explain={t(
                "间距驱动只守住孔距。板变短，阵列不会自己收缩，也不会自己删实例。想让孔跟着板走，就用总长驱动，或者把间距写成板长的方程。",
                "Driving by spacing holds only the pitch. When the plate gets shorter, the pattern doesn't shrink, and it doesn't delete instances by itself. To make the holes follow the plate, drive by total length, or write the spacing as an equation of the plate length.",
              )}
              onReveal={() => c.revealShrink()}
            />
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-small font-medium">{t("驱动方式", "Driven by")}</span>
                <Segmented
                  size="sm"
                  value={s.mode}
                  onValueChange={(m) => c.setMode(m)}
                  options={[
                    { value: "spacing", label: t("间距驱动", "Spacing") },
                    { value: "length", label: t("总长驱动", "Total length") },
                  ]}
                />
              </div>
              <ParamSlider className="px-0" label={t("板长", "Plate length")} value={s.plateLen} min={70} max={160} onChange={(v) => c.setPlateLen(v)} />
              <div>
                <Readout label={t("间距", "Spacing")} value={fmt(lay.spacing)} unit="mm" tone={s.mode === "length" ? "primary" : undefined} />
                <Readout label={t("首尾中心距", "First to last center")} value={fmt(lay.spacing * (s.count - 1))} unit="mm" />
              </div>
            </div>
            {outHint(s)}
          </>
        )
      },
      terms: ["pattern"],
    },
    {
      title: t("改种子，实例全跟着变", "Change the seed, and every instance follows"),
      body: byLocale(
        <>
          <p>阵列出来的实例不是独立的孔，它们引用种子。改种子的直径，所有实例一起变；单独改其中一个实例是改不了的。</p>
          <p>某个位置不想要孔，用阵列的「跳过实例」，而不是删掉重画。</p>
        </>,
        <>
          <p>The instances a pattern creates aren't independent holes: they reference the seed. Change the seed's diameter and all the instances change with it; you can't change one instance on its own.</p>
          <p>If you don't want a hole at some position, use the pattern's “skip instances” option instead of deleting and redrawing.</p>
        </>,
      ),
      task: { label: t("改一次种子孔的直径", "Change the seed hole's diameter"), done: (s) => s.diamChanged },
      extra: ({ s, c }) => (
        <>
          <ParamSlider
            className="mt-3 px-0"
            label={t("种子 · 孔径", "Seed · hole diameter")}
            value={s.diameter}
            min={4}
            max={16}
            onChange={(v) => c.setDiameter(v)}
            hint={t("橙色的是跟着种子重算的实例。", "The orange holes are the instances, recomputed from the seed.")}
          />
          {outHint(s)}
        </>
      ),
    },
    {
      title: t("圆周阵列：绕轴均布", "Circular pattern: evenly spaced around an axis"),
      body: byLocale(
        <>
          <p>法兰上的螺栓孔绕中心轴均布。圆周阵列要一根轴、数量和角度。</p>
          <p>转满 360° 时，间隔 = 360° ÷ 数量：最后一个孔和第一个相邻，不重叠。不满一圈时，首尾两个孔分别落在起点和终点，间隔 = 总角度 ÷ (数量 − 1)。</p>
        </>,
        <>
          <p>The bolt holes on a flange are evenly spaced around the central axis. A circular pattern needs an axis, a count and an angle.</p>
          <p>
            Over a full 360°, the spacing = 360° ÷ count: the last hole sits next to the first, not on top of it. Over less than a full turn, the first and last holes land on the
            start and the end, and the spacing = total angle ÷ (count − 1).
          </p>
        </>,
      ),
      task: { label: t("数量设为 6，再试一个小于 360° 的总角度", "Set the count to 6, then try a total angle under 360°"), done: (s) => s.polarSix && s.triedPartial },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 space-y-2">
            <ParamSlider className="px-0" label={t("数量", "Count")} unit={t("个", "")} value={s.polarCount} min={3} max={12} onChange={(v) => c.setPolarCount(v)} />
            <ParamSlider className="px-0" label={t("总角度", "Total angle")} unit="°" value={s.polarAngle} min={30} max={360} step={15} onChange={(v) => c.setPolarAngle(v)} />
          </div>
          <div className="mt-2">
            <Readout label={t("间隔", "Spacing")} value={fmt(polarStep(s.polarCount, s.polarAngle))} unit="°" tone="primary" />
            <Readout label={t("算法", "Calculation")} value={s.polarAngle >= 360 ? `360 ÷ ${s.polarCount}` : `${s.polarAngle} ÷ ${s.polarCount - 1}`} />
          </div>
        </>
      ),
      note: t(
        "多数软件的「等间距」都按这个规则算。如果整圈也用 ÷ (数量 − 1)，最后一个孔会和第一个重合。",
        "Most packages' “equal spacing” option follows this rule. If a full turn were also divided by (count − 1), the last hole would land on top of the first.",
      ),
      terms: ["pattern"],
    },
    {
      title: t("镜像：只建一半", "Mirror: model only half"),
      body: byLocale(
        <>
          <p>左右对称的零件只建一半，再关于中间的平面镜像。镜像出来的那一半跟着种子走：改这一半，另一半自动对称地变。</p>
          <p>拖动凸台顶上的蓝点挪一挪，或者改它的高度。</p>
        </>,
        <>
          <p>
            For a part that's symmetric left to right, model only one half, then mirror it about the middle plane. The mirrored half follows the seed: change this half, and the
            other half changes symmetrically by itself.
          </p>
          <p>Drag the blue dot on top of the boss to move it, or change its height.</p>
        </>,
      ),
      task: { label: t("移动这一侧的凸台，或改它的高度", "Move the boss on this side, or change its height"), done: (s) => s.mirrorEdited },
      extra: ({ s, c }) => <ParamSlider className="mt-3 px-0" label={t("凸台高度", "Boss height")} value={s.bossH} min={8} max={30} onChange={(v) => c.setBossH(v)} />,
      noteTitle: t("镜像特征和镜像实体", "Mirroring features vs. mirroring bodies"),
      note: t(
        "镜像特征只复制选中的几个特征，比如这个凸台；镜像实体把整个实体翻过去，再和原来的合并。两种都要改种子那一侧：镜像出来的一侧不能单独编辑。",
        "Mirroring features copies only the features you pick, such as this boss; mirroring a body flips the whole body over and merges it with the original. Either way, you edit the seed side: the mirrored side can't be edited on its own.",
      ),
      terms: ["mirror"],
    },
  ],
  quiz: [
    {
      q: t(
        "线性阵列数量 4、间距 20 mm，第一个和最后一个孔的中心距是多少？",
        "A linear pattern has a count of 4 and a spacing of 20 mm. How far apart are the centers of the first and last holes?",
      ),
      options: ["80 mm", "60 mm", "20 mm"],
      answer: 1,
      explain: t(
        "数量包含种子，4 个实例只有 3 个间隔：3 × 20 = 60 mm。按 4 × 20 算，是把数量当成了间隔数。",
        "The count includes the seed, so 4 instances have only 3 gaps: 3 × 20 = 60 mm. Working it out as 4 × 20 mistakes the count for the number of gaps.",
      ),
    },
    {
      q: t("法兰上要 6 个螺栓孔均布一整圈，相邻两孔之间是多少度？", "A flange needs 6 bolt holes evenly spaced around a full circle. How many degrees apart are neighboring holes?"),
      options: byLocale(["60°", "72°，即 360° ÷ 5", "取决于孔径"], ["60°", "72°, that is 360° ÷ 5", "It depends on the hole diameter"]),
      answer: 0,
      explain: t(
        "整圈时首尾相邻，6 个孔把 360° 分成 6 份。÷ (数量 − 1) 只用于不满一圈、首尾都落在端点上的情况。",
        "Over a full circle the last hole sits next to the first, so 6 holes divide 360° into 6 equal parts. Dividing by (count − 1) is only for less than a full turn, where the first and last holes both land on the end points.",
      ),
    },
    {
      q: t(
        "左右对称的支架已经做完，现在要把右边的凸台挪一下。哪种建法改起来最省事？",
        "A bracket that's symmetric left to right is finished, and now the boss on the right has to move. Which way of modeling it makes that change easiest?",
      ),
      options: byLocale(
        ["左右各建一遍，两边分别改", "只建左边一半再镜像，改左边那一半", "直接拖动镜像出来的右半边"],
        ["Model each side separately, and change both", "Model only the left half, mirror it, and change the left half", "Drag the mirrored right half directly"],
      ),
      answer: 1,
      explain: t(
        "镜像出来的一侧是跟随的结果，不能单独编辑；改种子那一侧，两边一起变。各建一遍迟早会出现只改了一边的情况。",
        "The mirrored side is a result that follows the seed, and it can't be edited on its own; change the seed side, and both sides change together. Model each side separately, and sooner or later only one of them gets changed.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "阵列和镜像复制的是规则：改种子，所有实例跟着变",
      "间距驱动守住孔距，总长驱动守住边界；先想清楚哪个要跟着零件走",
      "圆周阵列整圈用 360° ÷ 数量，不满一圈用 总角度 ÷ (数量 − 1)；对称件只建一半再镜像",
    ],
    [
      "Patterns and mirrors copy by a rule: change the seed, and every instance follows",
      "Driving by spacing holds the pitch; driving by total length holds the boundaries. Decide first which one should follow the part",
      "A full circular pattern uses 360° ÷ count; less than a full turn uses total angle ÷ (count − 1). For a symmetric part, model half and mirror it",
    ],
  ),
  overlay: ({ s }) => {
    const lay = linearLayout(s)
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        {s.step === 0 && (
          <SceneChip>
            {t("孔1", "Hole1")} · Ø{s.diameter}
          </SceneChip>
        )}
        {s.step >= 1 && s.step <= 3 && (
          <>
            <SceneChip>
              {t("孔1", "Hole1")} · Ø{s.diameter}
            </SceneChip>
            <SceneChip tone="primary">
              {t("线性阵列", "Linear pattern")} · {s.count} × {fmt(lay.spacing)} mm
              {s.step === 2 ? (s.mode === "spacing" ? t(" · 间距驱动", " · by spacing") : t(" · 总长驱动", " · by total length")) : ""}
            </SceneChip>
          </>
        )}
        {s.step === 4 && (
          <SceneChip tone="primary">
            {t("圆周阵列", "Circular pattern")} · {s.polarCount} × {fmt(polarStep(s.polarCount, s.polarAngle))}°
          </SceneChip>
        )}
        {s.step === 5 && <SceneChip tone="primary">{t("镜像 · 右视基准面 YZ", "Mirror · Right plane YZ")}</SceneChip>}
      </div>
    )
  },
}

export default lesson
