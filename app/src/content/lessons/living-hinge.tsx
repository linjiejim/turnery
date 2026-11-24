import { CircleCheck, CircleDashed, Play, Repeat, Syringe } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  FLEXES,
  L_GUIDE,
  lengthCheck,
  lengthFor,
  LivingHingeScene,
  MATERIALS,
  PC_ONCE,
  PC_REPEAT,
  strain180,
  T_GUIDE,
  thicknessCheck,
  type Gate,
  type HingeState,
  type Material,
} from "./living-hinge.scene"
import type { LessonDef } from "./types"

/** 6.5.4 「活动铰链」: strain from thickness and length, PP/PE only, gate across the hinge, flex it warm. */

const GATES: { value: Gate; label: string }[] = [
  { value: "side", label: t("侧边进胶", "Side gate") },
  { value: "two", label: t("两头进胶", "Two gates") },
  { value: "base", label: t("底座进胶", "Base gate") },
]

/** Strain at 180° on a 0–40 % bar, with PC's snap-fit limits marked. */
function StrainGauge({ e }: { e: number }) {
  const W = 248
  const max = 40
  const x = (v: number) => 4 + (Math.min(max, Math.max(0, v)) / max) * (W - 8)
  return (
    <svg width={W} height={40} viewBox={`0 0 ${W} 40`} className="mt-1 block text-foreground" aria-hidden>
      <rect x={4} y={8} width={W - 8} height={8} rx={2} fill="currentColor" fillOpacity={0.08} />
      <rect x={4} y={8} width={x(PC_ONCE) - 4} height={8} className="text-success" fill="currentColor" fillOpacity={0.3} />
      <line x1={x(e)} x2={x(e)} y1={3} y2={21} stroke="currentColor" strokeWidth={2} className="text-primary" />
      <line x1={x(PC_REPEAT)} x2={x(PC_REPEAT)} y1={8} y2={24} stroke="currentColor" strokeOpacity={0.5} />
      <text x={x(PC_REPEAT)} y={36} fill="currentColor" className="text-caption text-muted-foreground">
        {t(`PC 反复弯折约 ${PC_REPEAT}%`, `PC, repeated: ~${PC_REPEAT}%`)}
      </text>
      <text x={W - 4} y={36} textAnchor="end" fill="currentColor" className="text-caption text-muted-foreground tabular">
        {max}%
      </text>
    </svg>
  )
}

function CheckRow({ ok, warn, children }: { ok: boolean; warn?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-small", ok ? "text-success" : warn ? "text-warning" : "text-muted-foreground")}>
      {ok ? <CircleCheck className="size-3.5" /> : <CircleDashed className="size-3.5" />}
      <span>{children}</span>
    </div>
  )
}

function HingePanel({ s }: { s: HingeState }) {
  const e = strain180(s.t, s.L)
  if (s.step === 3)
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
        <SceneChip>{t("俯视 · 模具打开时的样子", "Top view · as moulded")}</SceneChip>
        <SceneChip tone="primary">{s.fill > 0 && s.fill < 1.2 ? t("注射中", "Filling") : t("蓝色：已充满", "Blue: filled")}</SceneChip>
      </div>
    )
  return (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{t(`一个零件 · ${s.material}`, `One part · ${s.material}`)}</SceneChip>
        {s.step === 0 && <SceneChip tone="primary">{t(`开合 ${Math.round((s.phi * 180) / Math.PI)}°`, `Folded ${Math.round((s.phi * 180) / Math.PI)}°`)}</SceneChip>}
      </div>
      {s.step >= 1 && (
        <div className="w-72 rounded-lg border bg-popover p-3 shadow-popover">
          <div className="flex items-baseline justify-between text-small">
            <span className="font-medium">{t("合上 180° 时外侧应变", "Outer strain, folded 180°")}</span>
            <span className="font-mono font-medium tabular text-primary">{e.toFixed(1)}%</span>
          </div>
          <StrainGauge e={e} />
          <div className="text-caption text-muted-foreground">{t("简化：ε ≈ π·t ÷ 2L", "Simplified: ε ≈ π·t ÷ 2L")}</div>
          {s.step === 4 && (
            <div className="mt-2 space-y-1 border-t pt-2">
              <CheckRow ok={FLEXES(s.material)}>{t(`材料 ${s.material}`, `Material ${s.material}`)}</CheckRow>
              <CheckRow ok={thicknessCheck(s.t) === "good"} warn={thicknessCheck(s.t) === "warn"}>
                {t(`厚度 ${s.t.toFixed(2)} mm（指南 ${T_GUIDE[0]}–${T_GUIDE[1]}）`, `Thickness ${s.t.toFixed(2)} mm (guide ${T_GUIDE[0]}–${T_GUIDE[1]})`)}
              </CheckRow>
              <CheckRow ok={lengthCheck(s.L) === "good"} warn={lengthCheck(s.L) === "warn"}>
                {t(`长度 ${s.L.toFixed(1)} mm（约 1.5）`, `Length ${s.L.toFixed(1)} mm (about 1.5)`)}
              </CheckRow>
              <CheckRow ok={s.gate === "base"}>{t("熔体横穿铰链", "Melt flows across the hinge")}</CheckRow>
              <CheckRow ok={s.flexed}>{t("出模后趁热折过", "Flexed warm, out of the mould")}</CheckRow>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const lesson: LessonDef<HingeState, LivingHingeScene> = {
  id: "living-hinge",
  codes: ["6.5.4"],
  title: t("活动铰链", "Living hinges"),
  create: (v, emit) => new LivingHingeScene(v, emit),
  steps: [
    {
      title: t("一个零件，自带铰链", "One part with its own hinge"),
      body: byLocale(
        <>
          <p>药盒、洗发水瓶的翻盖、工具盒的小格子：盒子和盖子是同一个注塑件，中间连着一层很薄的塑料，这就是活动铰链。</p>
          <p>它省掉了一个零件、一根销轴和一道装配工序。代价是这层薄膜每开合一次，都要被狠狠地弯一次。</p>
        </>,
        <>
          <p>Pill boxes, flip-top shampoo caps, the little compartments in a tackle box: the box and its lid are one moulding, joined by a very thin strip of plastic. That strip is a living hinge.</p>
          <p>It saves a part, a pin and an assembly step. The price is that the strip gets bent hard every single time the lid opens or closes.</p>
        </>,
      ),
      task: { label: t("拖动盖子上的蓝点，把盒子合上", "Drag the blue dot on the lid to close the box"), done: (s) => s.closedOnce },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label={t("开合角度", "Fold angle")} unit="°" value={Math.round((s.phi * 180) / Math.PI)} min={0} max={180} step={5} onChange={(v) => c.setPhi((v * Math.PI) / 180)} />
          <Button size="sm" variant="secondary" onClick={() => c.playFold()}>
            <Play />
            {s.phi > Math.PI / 2 ? t("打开盒子", "Open the box") : t("合上盒子", "Close the box")}
          </Button>
        </div>
      ),
    },
    {
      title: t("弯 180°，外侧拉长多少", "Folded 180°: how far the outside stretches"),
      body: byLocale(
        <>
          <p>合上时薄膜弯成半圆：外侧被拉长，内侧被压短。简化估算，应变 ε ≈ t ÷ 2R；薄膜长 L 弯成半圆，R ≈ L ÷ π，所以 ε ≈ π·t ÷ 2L。</p>
          <p>0.3 mm 厚、1.5 mm 长的铰链，外侧要拉长约 31%。可大多数硬塑料只允许几个百分点：Covestro 的卡扣设计指南给 PC 一次性卡扣的允许应变约 4%，反复使用还要再打六折。</p>
        </>,
        <>
          <p>Closed, the strip bends into a semicircle: the outside stretches, the inside is squashed. As a simple estimate, the strain is ε ≈ t ÷ 2R; a strip of length L bent into a semicircle has R ≈ L ÷ π, so ε ≈ π·t ÷ 2L.</p>
          <p>A hinge 0.3 mm thick and 1.5 mm long stretches about 31% on the outside. Most rigid plastics allow only a few percent: Covestro's snap-fit design guide gives PC about 4% for a snap assembled once, and about 60% of that for repeated use.</p>
        </>,
      ),
      task: { label: t("把应变压到 2.4% 以下，看铰链要多长", "Bring the strain under 2.4% and see how long the hinge gets"), done: (s) => s.triedLong },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("铰链长度从 1.5 mm 加到 3 mm，应变会怎样？", "Make the hinge 3 mm long instead of 1.5 mm. What happens to the strain?")}
            options={byLocale(["减半", "变成四分之一", "不变，只看厚度"], ["It halves", "It drops to a quarter", "No change: only thickness matters"])}
            answer={0}
            explain={t("长度加倍，半圆的半径也加倍，外侧的拉伸减半：31% 变成约 16%。", "Twice the length gives a semicircle of twice the radius, so the outer stretch halves: 31% becomes about 16%.")}
            onReveal={() => c.setL(3)}
          />
          <ParamSlider className="mt-3 px-0" label={t("铰链厚度 t", "Hinge thickness t")} value={s.t} min={0.1} max={1} step={0.01} onChange={(v) => c.setT(v)} />
          <ParamSlider className="px-0" label={t("铰链长度 L", "Hinge length L")} value={s.L} min={0.5} max={20} step={0.1} onChange={(v) => c.setL(v)} />
          <Readout label={t("应变", "Strain")} value={strain180(s.t, s.L).toFixed(1)} unit="%" tone={strain180(s.t, s.L) <= PC_REPEAT ? "success" : "primary"} />
          <Readout label={t("弯曲半径", "Bend radius")} value={(s.L / Math.PI).toFixed(2)} unit="mm" />
          {s.triedLong && (
            <Hint>
              {t(
                `厚 ${s.t.toFixed(2)} mm 时要约 ${lengthFor(s.t, PC_REPEAT).toFixed(0)} mm 长：那已经是一根弹簧片，盖子会晃，也不像铰链了。所以活动铰链只能靠扛得住大应变的材料。`,
                `At ${s.t.toFixed(2)} mm thick it takes about ${lengthFor(s.t, PC_REPEAT).toFixed(0)} mm: that's a spring strip, the lid flops about, and it's no longer a hinge. So a living hinge needs a material that survives huge strain.`,
              )}
            </Hint>
          )}
        </>
      ),
      note: t(
        "这里把薄膜当成均匀弯成圆弧的薄板。真实铰链两端有圆角过渡，弯曲集中在最薄处，局部应变更大。",
        "This treats the strip as a thin plate bent evenly into an arc. A real hinge has radiused shoulders and bends most at its thinnest point, so the local strain is higher.",
      ),
      noteTitle: t("简化", "Simplified"),
    },
    {
      title: t("材料：PP 和 PE", "Material: PP and PE"),
      body: byLocale(
        <>
          <p>PP 和 PE 第一次弯折时会被冷拉：薄膜里的分子顺着弯折方向排开，之后能反复弯折，远远超过屈服点也不断。一份 PP 铰链设计资料提到，做得好的均聚 PP 铰链测到约一百万次还没坏。PP 是首选，PE 其次。</p>
          <p>ABS、PC、PS 这类硬塑料超过屈服就发白，折几次就开裂。它们做翻盖要用真的销轴铰链，或者别的结构。</p>
        </>,
        <>
          <p>PP and PE are cold-drawn the first time they fold: the molecules in the strip line up across the fold, and from then on the hinge bends again and again, far past its yield point, without breaking. One PP hinge design guide reports that well-made homopolymer PP hinges had not failed after about a million flexes. PP comes first, PE second.</p>
          <p>Rigid plastics like ABS, PC and PS whiten once they're past yield and crack after a few folds. A lid in those needs a real pin hinge, or some other design.</p>
        </>,
      ),
      task: {
        label: t("各试一种能用和不能用的材料", "Try one material that works and one that doesn't"),
        done: (s) => s.materialsRun.some(FLEXES) && s.materialsRun.some((m) => !FLEXES(m)),
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("同样的铰链改用 ABS 做，开合 10 次会怎样？", "Make the same hinge in ABS and open and close it 10 times. What happens?")}
            options={byLocale(["和 PP 一样", "发白，几次后开裂", "根本合不上"], ["Same as PP", "It whitens and cracks after a few folds", "It won't close at all"])}
            answer={1}
            explain={t("合上时外侧要拉长 30% 左右，ABS 只承受得了几个百分点。第一次就发白，几次后开裂（次数看牌号，这里只是示意）。", "Closing stretches the outside by about 30%, and ABS only takes a few percent. It whitens on the first fold and cracks after a few (how many depends on the grade; this is illustrative).")}
            onReveal={() => {
              c.setMaterial("ABS")
              c.runCycles()
            }}
          />
          <Segmented className="mt-3" size="sm" value={s.material} onValueChange={(v) => c.setMaterial(v as Material)} options={MATERIALS.map((m) => ({ value: m, label: m }))} aria-label={t("材料", "Material")} />
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => c.runCycles()}>
              <Repeat />
              {t("开合 10 次", "Cycle 10 times")}
            </Button>
          </div>
        </>
      ),
    },
    {
      title: t("进胶方向：料要横穿铰链", "Gating: melt must cross the hinge"),
      body: byLocale(
        <>
          <p>铰链的寿命来自分子取向。熔体要垂直于铰链线流过去，一口气穿过薄膜，分子才沿着弯折方向排开。</p>
          <p>浇口放错了：料顺着铰链流，取向和折痕平行，容易沿折痕撕开；两股料在铰链上碰头，留下熔接线，一折就裂。</p>
        </>,
        <>
          <p>A hinge's life comes from molecular orientation. The melt has to flow at right angles to the hinge line and cross the strip in one go, so the molecules line up across the fold.</p>
          <p>Gate it wrong and either the melt runs along the hinge, leaving the orientation parallel to the fold so it splits along it, or two flow fronts meet on the hinge and leave a weld line that cracks on the first fold.</p>
        </>,
      ),
      task: { label: t("换一个让料横穿铰链的浇口，再注一次", "Pick a gate that sends the melt across the hinge and fill again"), done: (s) => s.gatesRun.includes("base") },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("底座和盖子各开一个浇口，两边同时进胶，铰链会怎样？", "Gate both the base and the lid, filling from both ends at once. What happens at the hinge?")}
            options={byLocale(["进胶更快，铰链更好", "两股料在铰链上相遇，留下熔接线", "没有区别"], ["Faster fill, better hinge", "The two fronts meet on the hinge and leave a weld line", "No difference"])}
            answer={1}
            explain={t("两股料各走一半，正好在中间的铰链上碰头。熔接线处分子没有连成一片，是最弱的地方。", "Each front fills half and they meet exactly on the hinge in the middle. At a weld line the molecules don't knit together, so it's the weakest spot.")}
            onReveal={() => c.playFill("two")}
          />
          <Segmented className="mt-3" size="sm" value={s.gate} onValueChange={(v) => c.setGate(v)} options={GATES} aria-label={t("浇口位置", "Gate position")} />
          <div className="mt-2">
            <Button size="sm" variant="secondary" onClick={() => c.playFill()}>
              <Syringe />
              {t("注射", "Inject")}
            </Button>
          </div>
        </>
      ),
    },
    {
      title: t("出模就折，尺寸照指南", "Flex it warm, size it by the guides"),
      body: byLocale(
        <>
          <p>刚出模、还温热的时候把铰链折几下，薄膜被冷拉、取向固定下来，寿命高得多。</p>
          <p>厚度各家说法不一：Protolabs 建议约 0.3 mm 厚、1.5 mm 长；一份 PP 铰链设计资料建议先做 0.20–0.25 mm，需要时加到 0.38 mm；Fictiv 写 0.2–0.5 mm。太薄填不满、会撕，太厚取向不够、寿命短。按材料商和模厂的资料定，并从薄的开始：改模时把铰链改厚是去钢料，容易。</p>
        </>,
        <>
          <p>Fold the hinge a few times straight out of the mould while it's still warm: the strip is cold-drawn, the orientation sets, and it lasts far longer.</p>
          <p>Guides disagree on thickness: Protolabs suggests about 0.3 mm thick and 1.5 mm long; one PP hinge design guide says start at 0.20–0.25 mm and go up to 0.38 mm if needed; Fictiv says 0.2–0.5 mm. Too thin and it won't fill and may tear; too thick and it doesn't orient well and dies early. Go by your resin supplier's and moulder's data, and start thin: making the hinge thicker later means removing steel, which is the easy way round.</p>
        </>,
      ),
      task: {
        label: t("趁热折几下，再把厚度和长度调进指南范围", "Flex it warm, then bring thickness and length into the guide range"),
        done: (s) => s.flexed && FLEXES(s.material) && thicknessCheck(s.t) === "good" && lengthCheck(s.L) === "good",
      },
      extra: ({ s, c }) => (
        <>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.flexWarm()}>
            <Repeat />
            {t("趁热折几下", "Flex it warm")}
          </Button>
          <ParamSlider className="mt-3 px-0" label={t("铰链厚度 t", "Hinge thickness t")} value={s.t} min={0.1} max={1} step={0.01} onChange={(v) => c.setT(v)} />
          <ParamSlider className="px-0" label={t("铰链长度 L", "Hinge length L")} value={s.L} min={0.5} max={6} step={0.1} onChange={(v) => c.setL(v)} />
          {thicknessCheck(s.t) === "bad" && s.t < T_GUIDE[0] && <Hint tone="warning">{t("太薄：熔体挤不过去，容易缺料，铰链会撕。", "Too thin: the melt struggles through, short shots are likely and the hinge tears.")}</Hint>}
          {thicknessCheck(s.t) !== "good" && s.t > T_GUIDE[1] && (
            <Hint tone="warning">{t("偏厚：取向不够，弯折寿命下降，合盖也更费劲。", "On the thick side: less orientation, shorter flex life, and the lid is stiffer to close.")}</Hint>
          )}
          {lengthCheck(s.L) !== "good" && (
            <Hint>
              {s.L < L_GUIDE[0]
                ? t("太短：弯曲集中，应变更大。", "Too short: the bend is concentrated and the strain is higher.")
                : t("偏长：盖子容易晃、对不齐，铰链也更难充满。", "On the long side: the lid wobbles and misaligns, and the hinge is harder to fill.")}
            </Hint>
          )}
        </>
      ),
      note: t(
        "绿色的长度范围（1–3 mm）只是围绕常见的 1.5 mm 画的示意，不是标准值。",
        "The green length band (1–3 mm) is only drawn round the common 1.5 mm for illustration; it isn't a standard value.",
      ),
      noteTitle: t("说明", "Note"),
    },
  ],
  quiz: [
    {
      q: t("一个 ABS 外壳想加一个活动铰链翻盖。最合理的做法是？", "You want a living-hinge flip lid on an ABS housing. What's the sensible move?"),
      options: byLocale(
        ["把铰链做薄一点就行", "这个件改用 PP，或者改成销轴铰链", "把铰链做厚些，更结实"],
        ["Just make the hinge a bit thinner", "Make this part in PP, or use a pin hinge", "Make the hinge thicker so it's stronger"],
      ),
      answer: 1,
      explain: t(
        "做薄能降一点应变，但合上 180° 时仍有十几个百分点，ABS 只承受几个百分点。做厚应变更大。活动铰链就要 PP 或 PE。",
        "Thinner lowers the strain a little, but a 180° fold still means well over 10%, while ABS takes only a few percent. Thicker raises the strain. A living hinge wants PP or PE.",
      ),
    },
    {
      q: t("铰链厚度从 0.3 mm 改到 0.6 mm，长度不变，合上时外侧应变会？", "The hinge goes from 0.3 mm to 0.6 mm thick, same length. The outer strain when closed will…"),
      options: byLocale(["减半：更厚更结实", "加倍", "不变"], ["Halve: thicker is stronger", "Double", "Stay the same"]),
      answer: 1,
      explain: t(
        "ε ≈ π·t ÷ 2L，应变和厚度成正比。厚铰链不是更结实，而是被拉得更狠，取向也更差。",
        "ε ≈ π·t ÷ 2L: strain is proportional to thickness. A thicker hinge isn't stronger, it's stretched harder and orients worse.",
      ),
    },
    {
      q: t("为什么刚出模就要把铰链折几下？", "Why fold the hinge a few times straight out of the mould?"),
      options: byLocale(
        ["检查有没有缺料", "趁热冷拉，让分子沿弯折方向取向，寿命大大提高", "合上了方便装箱"],
        ["To check for short shots", "To cold-draw it while warm, so the molecules orient across the fold and it lasts far longer", "So it ships closed"],
      ),
      answer: 1,
      explain: t(
        "温热时第一次弯折把薄膜冷拉开，分子顺着弯折方向排列，之后才能反复弯折远超屈服点而不断。",
        "The first fold while warm cold-draws the strip and lines the molecules up across the fold. Only then can it flex again and again far past yield without breaking.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "合上 180° 时外侧应变 ≈ π·t ÷ 2L，常见尺寸下是几十个百分点，远超硬塑料的允许值",
      "只用 PP（首选）或 PE；ABS、PC、PS 会发白开裂，翻盖改用销轴铰链",
      "浇口让熔体横穿铰链、别在铰链上留熔接线；出模趁热折几下；厚度约 0.2–0.4 mm，以材料商和模厂的资料为准",
    ],
    [
      "Folded 180°, the outer strain is ≈ π·t ÷ 2L: tens of percent at usual sizes, far beyond what rigid plastics allow",
      "Use PP (first choice) or PE only; ABS, PC and PS whiten and crack, so give those a pin hinge",
      "Gate so the melt crosses the hinge with no weld line on it, flex it warm out of the mould, and take the thickness (about 0.2–0.4 mm) from your resin supplier's and moulder's guides",
    ],
  ),
  next: {
    to: "/lesson/electronics-layout",
    label: t("电子件布局与开孔公差", "PCB layout and opening tolerances"),
    text: t("把电路板、电池和接口装进外壳。", "Fit the board, the battery and the connector into the housing."),
  },
  overlay: ({ s }) => <HingePanel s={s} />,
}

export default lesson
