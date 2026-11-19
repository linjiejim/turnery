import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { areaOf, FULL, LAYER, loadAcrossOf, presetOf, PrintScene, type PresetId, type PrintState } from "./print-overhang.scene"
import type { LessonDef, StepDef } from "./types"

/** 4.1.1 · 4.1.2 「3D 打印：悬垂与摆放方向」. */

function strengthOf(s: PrintState) {
  const k = loadAcrossOf(s)
  if (k > 0.7) return { text: t("拉力跨过层线：最弱", "Pull across the layer lines: weakest"), tone: "warning" as const }
  if (k < 0.3) return { text: t("拉力沿着层线：最强", "Pull along the layer lines: strongest"), tone: "success" as const }
  return { text: t("斜着跨层：居中", "Across the layers at an angle: in between"), tone: undefined }
}

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-scene-modified" />
      <span>{t("超过阈值：需要支撑", "Over the threshold: needs support")}</span>
      <span className="size-3 rounded-xs bg-scene-modified/40" />
      <span>{t("接近阈值：还能打，表面会差一些", "Near the threshold: still prints, with a rougher surface")}</span>
      <span className="h-px w-3 bg-muted-foreground" />
      <span>{t("竖线：支撑会长在这里（示意）", "Vertical lines: where supports would go (schematic)")}</span>
    </div>
  )
}

function AreaReadout({ s }: { s: PrintState }) {
  const a = areaOf(s)
  return (
    <div className="mt-3">
      <Readout label={t("需要支撑的面积", "Area needing support")} value={a} unit="mm²" tone={a === 0 ? "success" : "warning"} />
    </div>
  )
}

const PRESET_OPTIONS: { value: PresetId; label: string }[] = [
  { value: "upright", label: t("立放", "Upright") },
  { value: "flipped", label: t("倒放", "Upside down") },
  { value: "side", label: t("侧放", "On its side") },
]

const STEPS: StepDef<PrintState, PrintScene>[] = [
  {
    title: t("一层一层堆上去", "Built up layer by layer"),
    body: byLocale(
      <>
        <p>FDM 打印机把熔化的塑料一层层挤在上一层上面。每一层都得落在点什么上：平台、上一层，或者支撑。</p>
        <p>这是一个 T 形支架。拖动打印进度，看到左边横梁那一层时，它下面是什么？</p>
      </>,
      <>
        <p>An FDM printer extrudes molten plastic one layer at a time, each on top of the last. Every layer has to land on something: the build plate, the layer below, or supports.</p>
        <p>This is a T-shaped bracket. Drag the print progress. When you reach the layer with the left arm, what is underneath it?</p>
      </>,
    ),
    task: { label: t("把打印进度拖过左边横梁的底面", "Drag the print progress past the underside of the left arm"), done: (s) => s.reachedLedge },
    extra: ({ s, c }) => (
      <>
        <ParamSlider
          className="mt-3 px-0"
          label={t("打印进度", "Print progress")}
          value={Math.min(s.progress, FULL)}
          min={0}
          max={FULL}
          onChange={(v) => c.setProgress(v)}
          hint={t(
            `为了看得清，层线按 ${LAYER} mm 画；实际层高常在 0.1–0.3 mm。`,
            `To make them easy to see, layer lines are drawn ${LAYER} mm apart; real layer heights are usually 0.1–0.3 mm.`,
          )}
        />
        {s.reachedLedge && (
          <Hint>
            {t(
              "左边横梁的第一层直接挤在空气里，会塌下去。右边有一道斜面托着，每一层只比下一层多伸出一点。",
              "The left arm's first layer is extruded straight into the air and will sag. On the right, a slope holds the arm up: each layer sticks out only a little past the one below.",
            )}
          </Hint>
        )}
      </>
    ),
  },
  {
    title: t("悬垂角和 45° 规则", "The overhang angle and the 45° rule"),
    body: byLocale(
      <>
        <p>悬垂角按打印方向量：竖直的墙是 0°，朝下的水平面是 90°。角度越大，新的一层伸出去越多，底下托着的越少。</p>
        <p>FDM 常用的经验值是 45°：层高 0.2 mm、线宽 0.4 mm 时，每层伸出 0.2 mm，新线还有一半压在下面那层上。超过它就要加支撑。</p>
      </>,
      <>
        <p>
          The overhang angle is measured from the build direction: a vertical wall is 0°, and a horizontal face pointing down is 90°. The larger the angle, the further each new layer
          sticks out and the less there is underneath to hold it.
        </p>
        <p>
          The usual rule of thumb for FDM is 45°: with a 0.2 mm layer height and a 0.4 mm line width, each layer sticks out 0.2 mm, so half of each new line still rests on the layer
          below. Beyond that, you need supports.
        </p>
      </>,
    ),
    task: { label: t("先猜，再拖一下阈值看颜色怎么变", "Make a guess, then drag the threshold and watch the colors change"), done: (s) => s.showOverhang && s.triedThreshold },
    extra: ({ s, c }) => (
      <>
        <Predict
          question={t("左边横梁平的底面，和右边 45° 的斜面，哪个需要支撑？", "Which needs support: the flat underside of the left arm, or the 45° slope on the right?")}
          options={byLocale(
            ["两个都要：悬空的地方都要撑", "只有左边平的底面", "只有右边的斜面", "都不要"],
            ["Both: anything hanging in the air needs support", "Only the flat underside on the left", "Only the slope on the right", "Neither"],
          )}
          answer={1}
          explain={t(
            "水平朝下的面悬垂角是 90°，远超 45°。右边斜面刚好 45°，在 FDM 的经验极限内，可以不加支撑。",
            "A horizontal face pointing down has a 90° overhang, far past 45°. The slope on the right is exactly 45°, within the FDM rule of thumb, so it can print without support.",
          )}
          onReveal={() => c.reveal()}
        />
        {s.showOverhang && (
          <>
            <ParamSlider
              className="mt-3 px-0"
              label={t("悬垂阈值", "Overhang threshold")}
              unit="°"
              value={s.threshold}
              min={20}
              max={70}
              onChange={(v) => c.setThreshold(v)}
              hint={t("FDM 常用 45°。树脂打印（SLA）按设备和材料的指南来。", "FDM usually uses 45°. For resin printing (SLA), follow the guidelines for your printer and material.")}
            />
            <AreaReadout s={s} />
            <Legend />
          </>
        )}
      </>
    ),
    note: t(
      "两端都有支点的短距离水平跨可以「桥接」，不一定要支撑，但能跨多远取决于材料和机器，要试打。",
      "A short horizontal span with support at both ends can be “bridged” without supports, but how far you can bridge depends on the material and the machine, so do a test print.",
    ),
    noteTitle: t("例外", "Exception"),
  },
  {
    title: t("换个方向摆", "Turn the part around"),
    body: byLocale(
      <>
        <p>同一个零件，摆的方向不同，朝下的面就不同。切片软件里第一件事，往往就是把零件转到合适的方向。</p>
        <p>转动零件，找一个完全不需要支撑的方向。</p>
      </>,
      <>
        <p>Place the same part a different way, and different faces point down. Often the first thing you do in the slicer is turn the part to a good orientation.</p>
        <p>Rotate the part and find an orientation that needs no support at all.</p>
      </>,
    ),
    task: {
      label: t("找到一个需要支撑的面积为 0 的方向（阈值 45°）", "Find an orientation where the area needing support is 0 (threshold 45°)"),
      done: (s) => areaOf(s) === 0 && s.threshold <= 45 && (s.rotX !== 0 || s.rotY !== 0),
    },
    extra: ({ s, c }) => (
      <>
        <ParamSlider className="mt-3 px-0" label={t("绕 Y 轴转", "Rotate about Y")} unit="°" value={s.rotY} min={-180} max={180} step={15} onChange={(v) => c.setRotation({ rotY: v })} />
        <ParamSlider className="px-0" label={t("绕 X 轴转", "Rotate about X")} unit="°" value={s.rotX} min={-180} max={180} step={15} onChange={(v) => c.setRotation({ rotX: v })} />
        <AreaReadout s={s} />
        {s.threshold > 45 && <Hint tone="warning">{t("阈值被调高了，回到 45° 再找。", "The threshold has been raised. Set it back to 45° and look again.")}</Hint>}
        {areaOf(s) === 0 && s.threshold <= 45 && (s.rotX !== 0 || s.rotY !== 0) && (
          <Hint>
            {t(
              "找到了。倒过来放和侧着放都不需要支撑。下一步看看它们哪个更结实。",
              "Found it. Upside down and on its side both need no support. Next, see which of the two is stronger.",
            )}
          </Hint>
        )}
      </>
    ),
  },
  {
    title: t("层与层之间最弱", "Weakest between layers"),
    body: byLocale(
      <>
        <p>打印件不是各个方向一样结实。同一层里的塑料是连续挤出来的，层与层之间只靠熔合粘在一起，所以沿 Z 方向拉，最容易从层缝裂开。常见测试里，Z 向的抗拉强度只有层内方向的一半左右，有时更低，取决于材料和参数。</p>
        <p>这个支架用的时候竖杆受拉（蓝色箭头）。比一比三种摆法。</p>
      </>,
      <>
        <p>
          A printed part is not equally strong in every direction. Within a layer, the plastic is laid down in continuous lines; between layers, it is held together only where the layers
          fused. So a pull along Z is the most likely to split the part along a layer line. In typical tests, tensile strength along Z is only about half of that within a layer, sometimes
          less, depending on the material and the print settings.
        </p>
        <p>In use, this bracket's upright is in tension (blue arrow). Compare the three orientations.</p>
      </>,
    ),
    task: {
      label: t("找一个不用支撑、拉力又沿着层线的摆法", "Find an orientation that needs no support and puts the pull along the layer lines"),
      done: (s) => areaOf(s) === 0 && loadAcrossOf(s) < 0.3,
    },
    extra: ({ s, c }) => {
      const st = strengthOf(s)
      return (
        <>
          <Predict
            question={t("倒放不用支撑。竖杆受拉时，最可能怎么坏？", "Upside down needs no support. When the upright is pulled, how is it most likely to fail?")}
            options={byLocale(
              ["沿着两层之间裂开", "竖杆被均匀拉细", "不会坏：打印件各方向一样结实"],
              ["It splits between two layers", "The upright stretches thinner all along its length", "It won't fail: printed parts are equally strong in every direction"],
            )}
            answer={0}
            explain={t(
              "倒放时层线横着穿过竖杆，拉力正好把层与层拉开。不用支撑的方向，不一定是结实的方向。",
              "Upside down, the layer lines run straight across the upright, so the pull drags the layers apart. The orientation that needs no support isn't necessarily the strong one.",
            )}
          />
          <div className="mt-4 space-y-2">
            <Segmented size="sm" value={presetOf(s) ?? "upright"} onValueChange={(id) => c.preset(id)} options={PRESET_OPTIONS} aria-label={t("摆放方向", "Orientation")} />
            <div>
              <Readout label={t("需要支撑", "Needs support")} value={areaOf(s)} unit="mm²" tone={areaOf(s) === 0 ? "success" : "warning"} />
              <Readout label={t("竖杆", "Upright")} value={st.text} tone={st.tone} />
            </div>
          </div>
          {areaOf(s) === 0 && loadAcrossOf(s) < 0.3 && (
            <Hint>
              {t(
                "侧放两全：层线顺着竖杆，又没有朝下的面。没有两全的方向时，通常先保证受力，宁可多加支撑。",
                "On its side gets you both: the layer lines run along the upright, and no face points down. When no orientation gives you both, strength usually comes first, even if it means more supports.",
              )}
            </Hint>
          )}
        </>
      )
    },
    note: t(
      "侧放要求零件这一面足够平、足够稳。真实零件常常还要兼顾表面质量（贴平台的面最平）和打印时间。",
      "Printing on its side needs that face of the part to be flat and stable enough. Real parts often have to balance surface quality (the face on the build plate comes out flattest) and print time as well.",
    ),
    noteTitle: t("取舍", "Trade-offs"),
  },
  {
    title: t("在设计里就避开支撑", "Design the supports out"),
    body: byLocale(
      <>
        <p>比起每次靠摆方向，更好的办法是在建模时就让零件「自己撑得住」：把平的悬空面改成 45° 斜面或倒角。</p>
        <p>右边的横梁就是这样做的。给左边也加一道 45° 斜面试试。</p>
      </>,
      <>
        <p>
          Rather than counting on orientation every time, it's better to make the part “self-supporting” while you model it: turn flat overhanging faces into 45° slopes or chamfers.
        </p>
        <p>That's how the right arm is built. Try adding a 45° slope under the left arm too.</p>
      </>,
    ),
    task: {
      label: t("给左边横梁加上 45° 斜面，让立放也不需要支撑", "Add a 45° slope under the left arm so that upright needs no support either"),
      done: (s) => s.chamferLeft && areaOf(s) === 0,
    },
    extra: ({ s, c }) => (
      <>
        <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.setChamferLeft(!s.chamferLeft)}>
          {s.chamferLeft ? t("改回平的底面", "Back to a flat underside") : t("左边加 45° 斜面", "Add a 45° slope on the left")}
        </Button>
        <AreaReadout s={s} />
      </>
    ),
    note: t(
      "同样的思路：横着的圆孔顶部改成尖角（泪滴形孔），大的悬空平面加斜撑。这类做法叫面向增材制造的设计（DfAM）。",
      "The same idea elsewhere: give horizontal holes a pointed top (teardrop holes), and add angled braces under large overhanging flats. These habits are called design for additive manufacturing (DfAM).",
    ),
    noteTitle: t("常见做法", "Common practice"),
  },
]

const QUIZ = [
  {
    q: t("FDM 打印里，悬垂角怎么量？", "In FDM printing, how is the overhang angle measured?"),
    options: byLocale(
      ["面和打印平台的夹角", "面偏离竖直方向的角度：竖墙 0°，朝下的平面 90°", "零件绕 Z 轴转过的角度"],
      ["The angle between the face and the build plate", "How far the face leans away from vertical: a vertical wall is 0°, a flat face pointing down is 90°", "How far the part is rotated about Z"],
    ),
    answer: 1,
    explain: t(
      "悬垂角看的是面朝下倾斜了多少。竖墙每层都落在下一层正上方，朝下的平面整层都悬空。",
      "The overhang angle is how far a face tilts toward facing down. On a vertical wall each layer sits right on top of the one below; on a flat face pointing down, the whole layer hangs in the air.",
    ),
  },
  {
    q: t("一个零件立放时没有任何悬垂，但用的时候沿 Z 方向受拉。最该担心什么？", "A part has no overhangs at all when printed upright, but in use it is pulled along Z. What should worry you most?"),
    options: byLocale(["表面不够光滑", "层与层之间被拉开", "支撑太难拆"], ["The surface isn't smooth enough", "The layers being pulled apart", "Supports that are hard to remove"]),
    answer: 1,
    explain: t(
      "层间只靠熔合粘接，是打印件最弱的方向。受力方向最好沿着层线，而不是跨过层线。",
      "Layers are held together only where they fused, so that is a printed part's weakest direction. Loads should run along the layer lines, not across them.",
    ),
  },
  {
    q: t("设计时想让一块平的悬空面不用支撑，最直接的改法是？", "You want a flat overhanging face to print without support. What is the most direct change to the design?"),
    options: byLocale(["把阈值调到 90°", "把它改成 45° 左右的斜面或倒角", "把零件做得更厚"], ["Set the threshold to 90°", "Turn it into a slope or chamfer of about 45°", "Make the part thicker"]),
    answer: 1,
    explain: t(
      "改阈值只是骗过了检查，打出来还是会塌。改成斜面，每层只伸出一点点，下面一直有东西托着。",
      "Changing the threshold only fools the check; the print will still sag. With a slope, each layer sticks out only a little and always has something underneath it.",
    ),
  },
]

const lesson: LessonDef<PrintState, PrintScene> = {
  id: "print-overhang",
  codes: ["4.1.1", "4.1.2"],
  title: t("3D 打印：悬垂与摆放方向", "3D printing: overhangs and orientation"),
  create: (v, emit) => new PrintScene(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: byLocale(
    [
      "每一层都要落在东西上：悬垂角超过约 45°（FDM）的朝下面需要支撑",
      "摆放方向决定哪些面朝下，转一转常能省掉支撑",
      "层与层之间最弱：让主要受力沿着层线；最好在设计时就用斜面代替平的悬空面",
    ],
    [
      "Every layer has to land on something: downward faces with an overhang of more than about 45° (FDM) need support",
      "The orientation decides which faces point down; turning the part often saves you the supports",
      "Parts are weakest between layers, so run the main loads along the layer lines. Better still, design slopes in place of flat overhanging faces",
    ],
  ),
  overlay: ({ s }) => {
    const area = areaOf(s)
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <SceneChip>{t("打印方向 Z 向上", "Build direction: Z up")}</SceneChip>
        {s.showOverhang && (
          <>
            <SceneChip className={cn(area === 0 ? "text-success" : "text-warning")}>
              {t("需要支撑", "Needs support")} {area} mm²
            </SceneChip>
            <SceneChip>
              {t("阈值", "Threshold")} {s.threshold}°
            </SceneChip>
          </>
        )}
        {s.step === 3 && <SceneChip>{strengthOf(s).text}</SceneChip>}
      </div>
    )
  },
}

export default lesson
