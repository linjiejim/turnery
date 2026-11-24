import { Columns2, MoveDown, MoveUp, Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import {
  forceFactor,
  LOCK_ANGLE,
  MATERIALS,
  maxStrain,
  MU,
  permissible,
  REPEAT,
  SnapScene,
  strainAt,
  type Material,
  type Mould,
  type SnapState,
} from "./snap-fits.scene"
import type { LessonDef } from "./types"

/** 4.4.6 「卡扣」. */

const pct = (v: number) => v.toFixed(2)
const passes = (s: SnapState) => maxStrain(s) <= permissible(s) + 1e-9

function Dims({ s, c }: { s: SnapState; c: SnapScene }) {
  return (
    <div className="mt-3">
      <ParamSlider className="px-0" label={t("梁长 L", "Beam length L")} value={s.L} min={6} max={24} step={0.5} onChange={(v) => c.setDims({ L: v })} />
      <ParamSlider className="px-0" label={t("根部厚 t", "Root thickness t")} value={s.t} min={1} max={3.5} step={0.1} onChange={(v) => c.setDims({ t: v })} />
      <ParamSlider className="px-0" label={t("钩深 y", "Hook depth y")} value={s.y} min={0.5} max={2.5} step={0.1} onChange={(v) => c.setDims({ y: v })} />
    </div>
  )
}

/** Live strain against the material's limit. */
function StrainMeter({ s }: { s: SnapState }) {
  const e = maxStrain(s)
  const pm = permissible(s)
  const max = Math.max(pm * 1.6, e * 1.1)
  return (
    <div className="mt-3 rounded-md border p-3">
      <div className="flex items-baseline justify-between text-small">
        <span className="font-medium">{s.tapered ? "ε ≈ 0.92 · t · y / L²" : "ε = 1.5 · t · y / L²"}</span>
        <span className="text-caption text-muted-foreground">{s.tapered ? t("渐缩到一半", "Tapered to half") : t("等截面", "Constant section")}</span>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-muted">
        <div className={cn("absolute inset-y-0 left-0 rounded-full", e > pm ? "bg-axis-x" : "bg-axis-y")} style={{ width: `${Math.min(100, (e / max) * 100)}%` }} />
        <div className="absolute -inset-y-1 w-0.5 bg-foreground" style={{ left: `${(pm / max) * 100}%` }} />
      </div>
      <div className="mt-2">
        <Readout label={t("最大应变", "Max strain")} value={pct(e)} unit="%" tone={e > pm ? "warning" : "success"} />
        <Readout label={t("许用", "Permissible")} value={pct(pm)} unit="%" />
      </div>
    </div>
  )
}

const MATERIAL_OPTIONS = (Object.keys(MATERIALS) as Material[]).map((m) => ({ value: m, label: MATERIALS[m].name }))

/** Mating (or separating) force over deflection force, against the face angle: W/P = (μ + tan α) / (1 − μ tan α). */
function ForceChart({ s }: { s: SnapState }) {
  const W = 300
  const H = 150
  const L = 30
  const B = 24
  const T = 8
  const R = 10
  const yMax = 6
  const x = (deg: number) => L + (deg / 90) * (W - L - R)
  const y = (f: number) => T + (1 - Math.min(f, yMax) / yMax) * (H - T - B)
  const pts: string[] = []
  for (let a = 0; a < LOCK_ANGLE; a += 0.5) {
    const f = forceFactor(a)
    if (f > yMax) break
    pts.push(`${x(a).toFixed(1)},${y(f).toFixed(1)}`)
  }
  const mark = (deg: number, name: string, tone: string) => {
    const f = forceFactor(deg)
    const off = f === Infinity || f > yMax
    const cy = off ? y(yMax) : y(f)
    // Off the chart (self-locking): pinned to the top edge, its name below the dot.
    return (
      <g className={tone}>
        <circle cx={x(deg)} cy={cy} r={4} fill="currentColor" />
        <text x={x(deg) + (deg > 70 ? -7 : 7)} y={off ? cy + 16 : cy + 4} textAnchor={deg > 70 ? "end" : "start"} fill="currentColor" className="text-caption">
          {name}
        </text>
      </g>
    )
  }
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-3 block text-foreground" aria-label={t("装配力系数曲线", "Mating force factor curve")}>
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.4} />
      <line x1={L} x2={L} y1={T} y2={y(0)} stroke="currentColor" strokeOpacity={0.4} />
      {[0, 30, 60, 90].map((a) => (
        <text key={a} x={x(a)} y={H - 8} textAnchor="middle" fill="currentColor" className="text-caption text-muted-foreground">
          {a}°
        </text>
      ))}
      {[0, 2, 4, 6].map((f) => (
        <text key={f} x={L - 5} y={y(f) + 4} textAnchor="end" fill="currentColor" className="text-caption text-muted-foreground">
          {f}
        </text>
      ))}
      <rect x={x(LOCK_ANGLE)} y={T} width={x(90) - x(LOCK_ANGLE)} height={y(0) - T} className="text-scene-modified" fill="currentColor" fillOpacity={0.12} />
      <line x1={x(LOCK_ANGLE)} x2={x(LOCK_ANGLE)} y1={T} y2={y(0)} stroke="currentColor" strokeDasharray="3 3" strokeOpacity={0.6} />
      <text x={x(LOCK_ANGLE) + 4} y={T + 12} fill="currentColor" className="text-caption text-muted-foreground">
        {t("自锁", "Self-locking")}
      </text>
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} />
      {mark(s.lead, t("导入", "Lead"), "text-primary")}
      {mark(s.ret, t("退出", "Return"), "text-scene-modified")}
    </svg>
  )
}

const ratio = (v: number) => (v === Infinity ? "∞" : v.toFixed(2))

const lesson: LessonDef<SnapState, SnapScene> = {
  id: "snap-fits",
  codes: ["4.4.6"],
  title: t("卡扣：悬臂梁怎么算、怎么脱模", "Snap fits: sizing a cantilever and molding it"),
  create: (v, emit) => new SnapScene(v, emit),
  steps: [
    {
      title: t("卡扣怎么扣上", "How a snap fit goes together"),
      body: byLocale(
        <>
          <p>零件 A 上立着一根悬臂梁，顶端带钩。零件 B 往下压：它的边沿着钩子的导入斜面把梁推开，滑过钩尖以后，梁弹回原位，钩子扣住 B。</p>
          <p>装配时梁弯一下，装好后应该回到不受力的状态。所以要算的是装配那一下的最大应变。</p>
        </>,
        <>
          <p>
            A cantilever beam with a hook on its end stands on part A. Part B is pushed down: its edge rides along the hook's lead face and pushes the beam aside, slides past the tip,
            and the beam springs back so the hook holds B.
          </p>
          <p>The beam bends briefly during assembly and should be back to a stress-free state once assembled. What you size, then, is the peak strain in that one moment.</p>
        </>,
      ),
      task: { label: t("把 B 装上去", "Snap part B on"), done: (s) => s.snapped },
      extra: ({ s, c }) => (
        <>
          <ParamSlider
            className="mt-3 px-0"
            label={t("装配进度", "Assembly progress")}
            unit=""
            value={Math.round(s.progress * 100) / 100}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => c.setProgress(v)}
          />
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => c.assemble()}>
            <Play />
            {t("播放装配", "Play the assembly")}
          </Button>
          <div className="mt-3">
            <Readout label={t("钩子此刻被推开", "Hook pushed aside now")} value={c.deflection().toFixed(2)} unit="mm" />
          </div>
        </>
      ),
    },
    {
      title: t("最大应变：ε = 1.5 · t · y / L²", "Peak strain: ε = 1.5 · t · y / L²"),
      body: byLocale(
        <>
          <p>钩子被推开的距离等于钩深 y。对等截面的矩形梁，根部外层纤维的应变是 ε = 1.5 · t · y / L²：和厚度、钩深成正比，和梁长的平方成反比。</p>
          <p>梁的颜色是此刻的应变：根部最大，越往上越小。默认材料 PC/ABS，一次装配许用 2.5%。</p>
        </>,
        <>
          <p>
            The hook is pushed aside by exactly its depth y. For a beam of constant rectangular section, the strain in the outer fibre at the root is ε = 1.5 · t · y / L²: proportional to
            the thickness and the hook depth, and inversely proportional to the square of the length.
          </p>
          <p>The beam is coloured by the strain right now: highest at the root, falling off toward the tip. The material is PC/ABS, permissible 2.5% for a single assembly.</p>
        </>,
      ),
      task: { label: t("调 L、t、y，让最大应变不超过许用值", "Adjust L, t and y until the peak strain is within the permissible value"), done: (s) => passes(s) },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("其他不变，梁长 L 加倍，根部应变变成多少？", "With everything else the same, what happens to the root strain if you double the length L?")}
            options={byLocale(["一半", "四分之一", "不变"], ["Half", "A quarter", "No change"])}
            answer={1}
            explain={t(
              "应变和 L² 成反比，L 加倍应变变成四分之一。加长梁是降应变最有效的办法，前提是空间放得下。",
              "Strain goes with 1/L², so doubling L cuts it to a quarter. A longer beam is the most effective way to lower strain, if there's room for it.",
            )}
            onReveal={() => c.setDims({ L: Math.min(24, s.L * 2) })}
          />
          <Dims s={s} c={c} />
          <StrainMeter s={s} />
        </>
      ),
      note: t(
        "公式来自 Covestro（原 Bayer）《Snap-Fit Joints for Plastics》表 1 的 y = 0.67 · ε · L² / t，是简化的梁理论，假设对面的零件不变形。梁根部要倒圆，指南建议不小于 0.38 mm（0.015 in）。",
        "The formula is y = 0.67 · ε · L² / t from table 1 of Covestro's (formerly Bayer's) Snap-Fit Joints for Plastics: simplified beam theory, assuming the mating part doesn't flex. Round the root: the guide suggests at least 0.38 mm (0.015 in).",
      ),
      noteTitle: t("出处", "Source"),
    },
    {
      title: t("渐缩梁", "A tapered beam"),
      body: byLocale(
        <>
          <p>等截面梁的应变全堆在根部，梁的上半段几乎不出力。让厚度从根部线性减到钩子处的一半，应变沿梁更均匀，同样的钩深下根部应变约降到原来的 61%。</p>
          <p>Covestro 的说法是：同样的许用应变下，许用钩深能多出 60% 以上。</p>
        </>,
        <>
          <p>
            In a constant-section beam the strain piles up at the root and the upper half hardly works. Let the thickness fall linearly to half at the hook, and the strain spreads more
            evenly: for the same hook depth, the root strain drops to about 61%.
          </p>
          <p>Covestro puts it the other way: for the same permissible strain, the hook can be more than 60% deeper.</p>
        </>,
      ),
      task: { label: t("两种梁都看一遍，比较颜色和读数", "Look at both beams and compare the colors and readings"), done: (s) => s.triedTaper && s.triedConst },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("梁", "Beam")}</span>
            <Segmented
              size="sm"
              aria-label={t("梁", "Beam")}
              value={s.tapered ? "taper" : "const"}
              onValueChange={(v) => c.setTapered(v === "taper")}
              options={[
                { value: "const", label: t("等截面", "Constant") },
                { value: "taper", label: t("渐缩到一半", "Tapered to half") },
              ]}
            />
          </div>
          <StrainMeter s={s} />
          <div className="mt-2">
            <Readout label={t("等截面", "Constant")} value={pct(strainAt({ ...s, tapered: false }, s.y) * 100)} unit="%" />
            <Readout label={t("渐缩", "Tapered")} value={pct(strainAt({ ...s, tapered: true }, s.y) * 100)} unit="%" />
          </div>
          <Dims s={s} c={c} />
        </>
      ),
      note: t(
        "渐缩加在梁的背面，钩子那一面保持竖直：这样钩子下面那一面能从下方脱模（最后一步会看到）。也可以让宽度渐缩。",
        "The taper goes on the back of the beam and the hook side stays vertical, so the face under the hook can release downward (you'll see why in the last step). Tapering the width works too.",
      ),
      noteTitle: t("设计细节", "Design detail"),
    },
    {
      title: t("材料的许用应变", "The material's permissible strain"),
      body: byLocale(
        <>
          <p>许用应变看材料，而且看用法：只装一次，可以用到表里的值；要反复拆装，Covestro 建议只用约 60%。</p>
          <p>换材料、换成反复拆装，再调尺寸让它重新通过。</p>
        </>,
        <>
          <p>The permissible strain depends on the material, and on how the joint is used: assembled once, you can use the table value; taken apart and put back often, Covestro suggests only about 60% of it.</p>
          <p>Change the material, switch to repeated assembly, then adjust the dimensions until it passes again.</p>
        </>,
      ),
      task: { label: t("选「反复拆装」，并让它通过", "Choose repeated assembly and make it pass"), done: (s) => s.repeated && passes(s) },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 text-small font-medium">{t("材料", "Material")}</div>
          <Segmented size="sm" className="mt-1.5" aria-label={t("材料", "Material")} value={s.material} onValueChange={(v) => c.setMaterial(v)} options={MATERIAL_OPTIONS} />
          <div className="mt-3 flex items-center gap-3">
            <span className="text-small font-medium">{t("用法", "Use")}</span>
            <Segmented
              size="sm"
              aria-label={t("用法", "Use")}
              value={s.repeated ? "repeat" : "once"}
              onValueChange={(v) => c.setRepeated(v === "repeat")}
              options={[
                { value: "once", label: t("装一次", "Assembled once") },
                { value: "repeat", label: t(`反复拆装 × ${REPEAT}`, `Repeated × ${REPEAT}`) },
              ]}
            />
          </div>
          <StrainMeter s={s} />
          <Dims s={s} c={c} />
        </>
      ),
      note: t(
        "数值来自 Covestro（原 Bayer）《Part and Mold Design》表 4-1：23 °C 下一次装配的短时许用应变（PA 干态 4%，调湿 6%；PC+GF20 指含 20% 玻纤的 PC）。不同牌号、温度、玻纤含量都会变，以所用牌号的材料商数据为准。",
        "Values from table 4-1 of Covestro's (formerly Bayer's) Part and Mold Design guide: short-term permissible strain for a single assembly at 23 °C (PA 4% dry, 6% conditioned; PC+GF20 is PC with 20% glass fibre). They change with grade, temperature and glass content: use the supplier's data for your grade.",
      ),
      noteTitle: t("数据来源", "Data source"),
    },
    {
      title: t("导入角和退出角", "Lead angle and return angle"),
      body: byLocale(
        <>
          <p>装配力由导入角决定，拆开的力由退出角决定，算法相同：W = P · (μ + tan α) / (1 − μ · tan α)，P 是把梁推开的力。</p>
          <p>角度越陡，力越大；当 μ · tan α 到 1，分母为零：怎么拉都拉不开，这叫自锁。退出角做成 90° 就是永久连接，要拆只能用手或工具把钩子拨开。</p>
        </>,
        <>
          <p>
            The lead angle sets the force to assemble, the return angle the force to pull apart, and both follow the same formula: W = P · (μ + tan α) / (1 − μ · tan α), where P is the
            force that bends the beam aside.
          </p>
          <p>
            The steeper the angle, the larger the force. Once μ · tan α reaches 1 the denominator is zero: no amount of pulling will separate it. That is self-locking. A 90° return angle
            makes a permanent joint: to take it apart you push the hook back by hand or with a tool.
          </p>
        </>,
      ),
      task: {
        label: t("各拉一次：一个能拆的退出角，一个自锁的", "Pull once with a separable return angle and once with a self-locking one"),
        done: (s) => s.pulledSeparable && s.pulledLocked,
      },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-3 px-0" label={t("导入角", "Lead angle")} unit="°" value={s.lead} min={15} max={60} onChange={(v) => c.setAngles({ lead: v })} />
          <ParamSlider className="px-0" label={t("退出角", "Return angle")} unit="°" value={s.ret} min={30} max={90} onChange={(v) => c.setAngles({ ret: v })} />
          <ForceChart s={s} />
          <div className="mt-1">
            <Readout label={t("装配力 / P", "Mating force / P")} value={ratio(forceFactor(s.lead))} />
            <Readout label={t("拆开力 / P", "Separating force / P")} value={ratio(forceFactor(s.ret))} tone={forceFactor(s.ret) === Infinity ? "warning" : undefined} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => c.assemble()}>
              <MoveDown />
              {t("装上", "Snap on")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => c.pullOff()}>
              <MoveUp />
              {t("往上拉", "Pull off")}
            </Button>
          </div>
        </>
      ),
      note: t(
        `μ 取 ${MU}：Covestro 表 3 里 PC 对钢约 0.45–0.55，同种塑料互相摩擦再乘约 1.2。μ 越大，自锁角越小（这里约 ${Math.round(LOCK_ANGLE)}°）。实际拆开力还受梁的变形和倒圆影响，以样件实测为准。`,
        `μ is ${MU}: Covestro's table 3 gives about 0.45–0.55 for PC on steel, times about 1.2 for two parts of the same plastic. The higher μ, the lower the self-locking angle (about ${Math.round(LOCK_ANGLE)}° here). The real pull-off force also depends on how the beam deforms and on edge radii: measure it on samples.`,
      ),
      noteTitle: t("摩擦系数", "Friction"),
    },
    {
      title: t("钩子本身就是倒扣", "The hook is an undercut"),
      body: byLocale(
        <>
          <p>钩子下面那一面朝下，正下方是零件 A 的底板：型腔向上拔不出它，型芯向下也被底板挡住。</p>
          <p>常用做法是在底板上、钩子正下方开一个窗口，让型芯的镶针从下面伸上来成形钩子下面，开模时原路退回去，不要任何机构。实在不能开窗，才用滑块。</p>
        </>,
        <>
          <p>The face under the hook looks down, and right below it is part A's base: the cavity can't pull it out upward, and the core going down is blocked by the base.</p>
          <p>
            The usual answer is a window in the base right under the hook. A core pin comes up through it to form the underside of the hook and drops back the way it came, with no
            mechanism. Only if a window is impossible do you use a slide.
          </p>
        </>,
      ),
      task: { label: t("让钩子能脱模，再打开模具", "Make the hook moldable, then open the mold"), done: (s) => s.openedMould },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("钩子下面", "Under the hook")}</span>
            <Segmented
              size="sm"
              aria-label={t("钩子下面", "Under the hook")}
              value={s.mould}
              onValueChange={(v: Mould) => c.setMould(v)}
              options={[
                { value: "none", label: t("不处理", "Nothing") },
                { value: "window", label: t("底板开窗", "Window in base") },
                { value: "slide", label: t("滑块", "Slide") },
              ]}
            />
          </div>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.toggleMould()}>
            <Columns2 />
            {s.open > 0 ? t("合上模具", "Close the mold") : t("打开模具", "Open the mold")}
          </Button>
          {s.mould === "window" && (
            <Hint>
              {t(
                "窗口让零件 A 多了一个孔：有密封、防尘或外观要求时要先确认。镶针和窗口的对碰面要有拔模。",
                "The window adds a hole to part A: check it first if the part must seal, keep dust out or look clean. The faces where the pin meets the window need draft.",
              )}
            </Hint>
          )}
          {s.mould === "slide" && (
            <Hint>
              {t(
                "滑块也能做，但模具更贵、周期略长；一个零件上卡扣多，滑块就多。",
                "A slide works too, but it costs more and lengthens the cycle a little; with many snaps on one part, the slides multiply.",
              )}
            </Hint>
          )}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("梁长不变，把根部厚度 t 加倍，装配时的最大应变？", "With the same length, you double the root thickness t. What happens to the peak strain during assembly?"),
      options: byLocale(["减半，因为梁更结实", "加倍", "不变，应变只看钩深"], ["It halves, because the beam is stronger", "It doubles", "No change: strain depends only on the hook depth"]),
      answer: 1,
      explain: t(
        "推开的距离固定为钩深，厚的梁弯同样的距离，外层纤维拉得更多：ε 和 t 成正比。要降应变，加长梁、减薄或做渐缩。",
        "The beam is pushed aside by the hook depth regardless. A thicker beam bent by the same amount stretches its outer fibre more: ε is proportional to t. To lower strain, lengthen the beam, thin it, or taper it.",
      ),
    },
    {
      q: t("一个要经常拆装的电池盖卡扣，许用应变怎么取？", "A battery-cover snap that will be opened often: what permissible strain do you use?"),
      options: byLocale(
        ["和只装一次一样", "约为一次装配值的 60%", "可以更大，材料用久了会适应"],
        ["The same as for a single assembly", "About 60% of the single-assembly value", "Higher: the material gets used to it"],
      ),
      answer: 1,
      explain: t(
        "反复变形会累积损伤。Covestro 的指南建议，频繁拆装时取一次装配值的约 60%。",
        "Repeated flexing accumulates damage. The Covestro guide suggests about 60% of the single-assembly value for frequent separation and rejoining.",
      ),
    },
    {
      q: t("卡扣的钩子下面朝着底板，量产时最省的做法是？", "The underside of a snap hook faces the base. What is the cheapest way to mold it in production?"),
      options: byLocale(
        ["在钩子正下方的底板上开窗，让型芯镶针从下面成形", "加一个滑块", "加大拔模角，硬拔出来"],
        ["A window in the base right under the hook, so a core pin forms it from below", "Add a slide", "Add more draft and force it out"],
      ),
      answer: 0,
      explain: t(
        "开窗以后，钩子下面就能从下方「看见」，直拉的型芯就能成形，不需要机构。滑块可行但更贵；拔模解决不了倒扣。",
        "With a window, the underside of the hook can “see” downward, so a straight-pull core can form it with no mechanism. A slide works but costs more; draft can't fix an undercut.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "等截面悬臂卡扣 ε = 1.5 · t · y / L²：应变和厚度、钩深成正比，和梁长平方成反比；厚度渐缩到一半，同样钩深下应变约降到 61%",
      "许用应变看材料和牌号（Covestro，一次装配：PC 4%，PC/ABS 2.5%，ABS 1.8%）；反复拆装取约 60%",
      "导入角管装配力，退出角管能不能拆，μ · tan α 到 1 就自锁；钩子本身是倒扣，在它正下方开窗让型芯成形",
    ],
    [
      "For a constant-section cantilever snap, ε = 1.5 · t · y / L²: strain grows with thickness and hook depth and falls with the square of the length. Tapering to half thickness cuts it to about 61% for the same hook",
      "Permissible strain depends on material and grade (Covestro, single assembly: PC 4%, PC/ABS 2.5%, ABS 1.8%); use about 60% for repeated assembly",
      "The lead angle sets the assembly force and the return angle whether it comes apart: it self-locks once μ · tan α reaches 1. The hook is an undercut: a window under it lets the core form it",
    ],
  ),
  next: {
    to: "/lesson/shell-split",
    label: t("外观件拆件", "Splitting a styled housing"),
    text: t("卡扣和螺丝要连起来的上下壳：分在哪、止口怎么做、从哪边装。", "The two shells that snaps and screws hold together: where to split, how the lip works, which side to assemble from."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
      <SceneChip>
        {MATERIALS[s.material].name} · {s.repeated ? t("反复拆装", "repeated") : t("装一次", "once")}
      </SceneChip>
      {s.step >= 1 && s.step <= 3 && (
        <SceneChip tone={passes(s) ? "primary" : undefined}>
          ε {pct(maxStrain(s))}% / {pct(permissible(s))}%
        </SceneChip>
      )}
      {s.step === 5 && <SceneChip>{t("开模方向 ±Z", "Pull direction ±Z")}</SceneChip>}
    </div>
  ),
}

export default lesson
