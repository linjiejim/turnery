import { CircleCheck, CircleX } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { deflection, GEO, MAT, mass, ribChecks, RULE, thicknessFor, type Panel } from "./stiffness-ribs.beam"
import { EXAG, fmt, StiffnessScene, type RibState } from "./stiffness-ribs.scene"
import type { LessonDef } from "./types"

/** 6.5.2 「刚度直觉：壁厚与筋」: stiffness goes with t³, ribs instead of a thicker wall, rib direction and height, moulding limits for ribs. */

const PLAIN: Panel = { t: 2, n: 0, h: 0, r: 0, across: false }
const D0 = deflection(PLAIN)
const M0 = mass(PLAIN)
const T1 = thicknessFor(1)
const M1 = mass({ ...PLAIN, t: T1 })

function Overlay({ s }: { s: RibState }) {
  const d = deflection(s)
  const m = mass(s)
  return (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        <SceneChip>{t(`ABS · 跨度 ${GEO.L} mm · 宽 ${GEO.b} mm · 中间压 ${GEO.F} N`, `ABS · span ${GEO.L} mm · width ${GEO.b} mm · ${GEO.F} N at mid-span`)}</SceneChip>
        <SceneChip>{s.section ? t("在跨中剖开", "Cut at mid-span") : t(`变形放大 ${EXAG} 倍`, `Bending drawn ${EXAG}× larger`)}</SceneChip>
      </div>
      <div className="w-fit rounded-lg border bg-popover px-3 py-2 shadow-popover">
        <div className="flex items-baseline gap-4 text-small">
          <span>
            <span className="text-muted-foreground">{t("变形", "Deflection")}</span> <span className={cn("font-mono font-medium tabular", d <= 1 && "text-success")}>{fmt(d)}</span>{" "}
            <span className="text-faint-foreground">mm</span>
          </span>
          <span>
            <span className="text-muted-foreground">{t("质量", "Mass")}</span> <span className="font-mono font-medium tabular">{m.toFixed(1)}</span> <span className="text-faint-foreground">g</span>
          </span>
          <span>
            <span className="text-muted-foreground">{t("刚度", "Stiffness")}</span> <span className="font-mono font-medium tabular">{(D0 / d).toFixed(1)}×</span>
          </span>
        </div>
        <div className="text-caption text-muted-foreground">{t("刚度以 2 mm 平板为 1×", "Stiffness relative to a plain 2 mm plate")}</div>
      </div>
    </div>
  )
}

/** Deflection and mass against wall thickness, both relative to the 2 mm plate. */
function ThickChart({ s }: { s: RibState }) {
  const W = 300
  const H = 150
  const x = (tt: number) => 30 + ((tt - 1.5) / 3.5) * (W - 56)
  const y = (r: number) => 10 + ((2.5 - Math.min(2.5, r)) / 2.5) * (H - 34)
  const ts = Array.from({ length: 36 }, (_, i) => 1.5 + i * 0.1)
  const path = (f: (tt: number) => number) => ts.map((tt, i) => `${i ? "L" : "M"} ${x(tt).toFixed(1)} ${y(f(tt)).toFixed(1)}`).join(" ")
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mt-3 block text-foreground" aria-label={t("变形和质量随壁厚变化", "Deflection and mass against wall thickness")}>
      {[0, 1, 2].map((r) => (
        <g key={r} className="text-faint-foreground">
          <line x1={30} x2={W - 10} y1={y(r)} y2={y(r)} stroke="currentColor" strokeOpacity={r === 1 ? 0.6 : 0.25} />
          <text x={24} y={y(r) + 4} textAnchor="end" fill="currentColor" className="text-caption tabular">
            {r}×
          </text>
        </g>
      ))}
      {[2, 3, 4, 5].map((tt) => (
        <text key={tt} x={x(tt)} y={H - 8} textAnchor="middle" fill="currentColor" className="text-caption tabular text-muted-foreground">
          {tt} mm
        </text>
      ))}
      <path d={path((tt) => (2 / tt) ** 3)} fill="none" className="text-primary" stroke="currentColor" strokeWidth={2} />
      <path d={path((tt) => tt / 2)} fill="none" className="text-scene-modified" stroke="currentColor" strokeWidth={2} />
      <line x1={x(s.t)} x2={x(s.t)} y1={8} y2={H - 24} stroke="currentColor" strokeDasharray="3 3" />
      <text x={x(4.2)} y={y((2 / 4.2) ** 3) - 6} fill="currentColor" className="text-caption text-primary">
        {t("变形", "Deflection")}
      </text>
      <text x={x(3.9)} y={y(3.9 / 2) - 6} fill="currentColor" className="text-caption text-scene-modified">
        {t("质量", "Mass")}
      </text>
    </svg>
  )
}

function RibSliders({ s, c, only }: { s: RibState; c: StiffnessScene; only?: ("n" | "h" | "r")[] }) {
  const show = (k: "n" | "h" | "r") => !only || only.includes(k)
  return (
    <div className="mt-3 space-y-0.5">
      {show("n") && <ParamSlider className="px-0" label={t("筋的数量", "Number of ribs")} unit="" value={s.n} min={0} max={6} onChange={(v) => c.setRib({ n: v })} />}
      {show("h") && <ParamSlider className="px-0" label={t("筋高", "Rib height")} value={s.h} min={0} max={15} step={0.5} onChange={(v) => c.setRib({ h: v })} />}
      {show("r") && <ParamSlider className="px-0" label={t("筋厚", "Rib thickness")} value={s.r} min={0.6} max={3} step={0.1} onChange={(v) => c.setRib({ r: v })} />}
    </div>
  )
}

function Rules({ s }: { s: RibState }) {
  const k = ribChecks(s)
  const rows: [boolean, string][] = [
    [!k.thick && !k.thin, t(`筋厚 ${s.r.toFixed(1)} mm 是壁厚的 ${Math.round((s.r / s.t) * 100)}%（建议 40–60%）`, `Rib ${s.r.toFixed(1)} mm is ${Math.round((s.r / s.t) * 100)}% of the wall (aim for 40–60 %)`)],
    [!k.tall, t(`筋高 ${s.h} mm 是壁厚的 ${(s.h / s.t).toFixed(1)} 倍（不超过 ${RULE.height} 倍）`, `Rib height ${s.h} mm is ${(s.h / s.t).toFixed(1)}× the wall (no more than ${RULE.height}×)`)],
    [!k.crowded, t(`筋之间的空隙不小于 ${RULE.spacing} 倍壁厚`, `Space between ribs at least ${RULE.spacing}× the wall`)],
    [deflection(s) <= 1, t(`变形 ${fmt(deflection(s))} mm（不超过 1 mm）`, `Deflection ${fmt(deflection(s))} mm (1 mm at most)`)],
  ]
  return (
    <ul className="mt-3 space-y-1 text-small">
      {rows.map(([ok, text]) => (
        <li key={text} className={cn("flex items-start gap-1.5", ok ? "text-success" : "text-warning")}>
          {ok ? <CircleCheck className="mt-0.5 size-4 shrink-0" /> : <CircleX className="mt-0.5 size-4 shrink-0" />}
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}

const lesson: LessonDef<RibState, StiffnessScene> = {
  id: "stiffness-ribs",
  codes: ["6.5.2"],
  title: t("刚度直觉：壁厚与筋", "A feel for stiffness: wall thickness and ribs"),
  create: (v, emit) => new StiffnessScene(v, emit),
  steps: [
    {
      title: t("加厚一倍，变形变成几分之一？", "Double the wall: what happens to the deflection?"),
      body: byLocale(
        <>
          <p>板受力弯曲，弯多少取决于两样东西：材料有多硬（弹性模量 E），截面是什么形状（惯性矩 I）。变形和 E·I 成反比。</p>
          <p>对宽 b、厚 t 的平板，I = b·t³/12。这块 ABS 板厚 2 mm，架在相距 150 mm 的两根支撑上，中间压 10 N，大约是一个手指用力按下去。</p>
        </>,
        <>
          <p>How far a plate bends under a load depends on two things: how stiff the material is (its modulus E) and the shape of the cross-section (its second moment of area I). Deflection goes as 1 / (E·I).</p>
          <p>For a flat plate of width b and thickness t, I = b·t³/12. This ABS plate is 2 mm thick, resting on two supports 150 mm apart, with 10 N pressing on the middle: about a firm press with one finger.</p>
        </>,
      ),
      task: { label: t("把壁厚加到 4 mm，看变形", "Take the wall to 4 mm and watch the deflection"), done: (s) => s.tried4 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("壁厚从 2 mm 加到 4 mm，中间的变形变成原来的多少？", "Thicken the wall from 2 mm to 4 mm. What fraction of the deflection is left?")}
            options={byLocale(["一半", "四分之一", "八分之一"], ["Half", "A quarter", "An eighth"])}
            answer={2}
            explain={t(
              `I 和 t³ 成正比：厚度翻倍，I 变成 2³ = 8 倍，变形只剩 1/8，从 ${fmt(D0)} mm 降到 ${fmt(D0 / 8)} mm。重量只翻了一倍。`,
              `I goes with t³: double the thickness and I becomes 2³ = 8 times larger, so only 1/8 of the deflection is left, from ${fmt(D0)} mm to ${fmt(D0 / 8)} mm. The mass only doubles.`,
            )}
            onReveal={() => c.doubleIt()}
          />
          <ParamSlider className="mt-3 px-0" label={t("壁厚", "Wall thickness")} value={s.t} min={1.5} max={5} step={0.1} onChange={(v) => c.setT(v)} />
        </>
      ),
      note: t(
        `数值按简支梁公式 δ = F·L³ / (48·E·I) 算，E 取 ${MAT.E / 1000} GPa（ABS 的典型值，牌号不同在 2.0–2.6 GPa 之间），忽略了剪切变形和板沿宽度方向的弯曲。`,
        `Numbers come from the simply supported beam formula δ = F·L³ / (48·E·I), with E = ${MAT.E / 1000} GPa (typical for ABS; grades range from about 2.0 to 2.6 GPa), ignoring shear deflection and bending across the width.`,
      ),
      noteTitle: t("怎么算的", "How it's computed"),
    },
    {
      title: t("刚度来得便宜，重量来得贵", "Stiffness comes cheap, mass doesn't"),
      body: byLocale(
        <>
          <p>刚度随厚度的三次方涨，重量只随厚度的一次方涨，看上去加厚很划算。</p>
          <p>可是对注塑件，厚壁意味着更多材料，冷却时间大致和壁厚的平方成正比，周期变长；厚的地方还容易缩痕和翘曲。外形尺寸往往也不允许你往里加厚。</p>
        </>,
        <>
          <p>Stiffness rises with the cube of the thickness and mass only in proportion to it, so thickening looks like a bargain.</p>
          <p>
            But for a moulded part a thick wall means more material, and cooling time grows roughly with the square of the wall, so the cycle gets longer; thick areas also sink and warp. And the outside
            dimensions often leave no room to thicken inwards.
          </p>
        </>,
      ),
      task: { label: t("只靠加厚，把变形压到 1 mm 以内", "Get the deflection under 1 mm by thickening alone"), done: (s) => s.reached },
      extra: ({ s, c }) => (
        <>
          <ParamSlider className="mt-4 px-0" label={t("壁厚", "Wall thickness")} value={s.t} min={1.5} max={5} step={0.1} onChange={(v) => c.setT(v)} />
          <ThickChart s={s} />
          <div className="text-caption text-muted-foreground">{t("相对 2 mm 平板：蓝线是变形，橙线是质量", "Relative to the 2 mm plate: blue is deflection, orange is mass")}</div>
          {s.reached && (
            <Hint>
              {t(
                `要 ${T1.toFixed(1)} mm 才够：质量从 ${M0.toFixed(0)} g 变成 ${M1.toFixed(0)} g，多了 ${Math.round((M1 / M0 - 1) * 100)}%。下一步换个办法。`,
                `It takes ${T1.toFixed(1)} mm: the mass goes from ${M0.toFixed(0)} g to ${M1.toFixed(0)} g, ${Math.round((M1 / M0 - 1) * 100)}% more. Next, another way.`,
              )}
            </Hint>
          )}
        </>
      ),
    },
    {
      title: t("用筋代替加厚", "Ribs instead of a thicker wall"),
      body: byLocale(
        <>
          <p>筋是立在板背面的薄板。I 里每一块材料按它到中性层距离的平方加权，筋把材料放到了离中性层很远的地方，所以很少的材料就换来很大的刚度。</p>
          <p>壁厚保持 2 mm，在背面加几根顺着跨度方向的筋。</p>
        </>,
        <>
          <p>A rib is a thin wall standing on the back of the plate. In I, every bit of material is weighted by the square of its distance from the neutral axis, and a rib puts material far from it: a little material buys a lot of stiffness.</p>
          <p>Keep the wall at 2 mm and add a few ribs on the back, running along the span.</p>
        </>,
      ),
      task: { label: t("壁厚不变，用筋把变形压到 1 mm 以内", "Keep the wall, and get the deflection under 1 mm with ribs"), done: (s) => s.n > 0 && !s.across && deflection(s) <= 1 },
      extra: ({ s, c }) => (
        <>
          <RibSliders s={s} c={c} />
          <div className="mt-2">
            <Readout label={t("加筋方案", "With ribs")} value={mass(s).toFixed(1)} unit="g" tone={deflection(s) <= 1 ? "success" : undefined} />
            <Readout label={t(`加厚到 ${T1.toFixed(1)} mm`, `Thickened to ${T1.toFixed(1)} mm`)} value={M1.toFixed(1)} unit="g" />
          </div>
          <div className="text-caption text-muted-foreground">{t("两种方案都按变形 1 mm 比较质量", "Both compared at a deflection of 1 mm")}</div>
        </>
      ),
      terms: ["rib"],
    },
    {
      title: t("筋要顺着弯的方向，越高越管用", "Ribs must run with the bending, and height counts most"),
      body: byLocale(
        <>
          <p>筋只有顺着弯曲方向连续时才起作用。横着跨过去的筋在弯曲方向上是断开的，板照样弯，只是更重了。</p>
          <p>顺着放的筋，高度比厚度管用得多：筋自己的 I 和高度的三次方成正比，而且越高，材料离中性层越远。</p>
        </>,
        <>
          <p>A rib only helps when it is continuous in the direction of bending. Ribs across the span are broken up along that direction: the plate bends just the same, only heavier.</p>
          <p>For ribs running with the span, height matters much more than thickness: the rib's own I grows with the cube of its height, and a taller rib puts material further from the neutral axis.</p>
        </>,
      ),
      task: { label: t("把筋横过来试一次，再改回顺着放", "Turn the ribs across once, then back along the span"), done: (s) => s.triedAcross && s.backAlong },
      extra: ({ s, c }) => {
        const taller = deflection({ ...s, h: s.h * 2 })
        const thicker = deflection({ ...s, r: s.r * 2 })
        return (
          <>
            <Predict
              question={t("把这 3 根筋转 90°，横跨在板上。变形会怎样？", "Turn these 3 ribs through 90° so they run across the plate. What happens to the deflection?")}
              options={byLocale(["和顺着放一样小", "几乎回到没有筋的时候，只是更重了", "比没有筋时还大"], ["It stays as small as before", "It goes back to about the plain plate's, only heavier", "It gets bigger than with no ribs"])}
              answer={1}
              explain={t(
                "沿跨度方向看，横筋只是一段一段的凸块，弯矩还得靠 2 mm 的板来扛。按梁的模型，横筋不增加这个方向的刚度。",
                "Seen along the span, cross ribs are just a row of separate lumps; the 2 mm plate still carries the bending. In the beam model they add no stiffness in this direction.",
              )}
              onReveal={() => c.setAcross(true)}
            />
            <div className="mt-3">
              <Segmented
                size="sm"
                aria-label={t("筋的方向", "Rib direction")}
                value={s.across ? "across" : "along"}
                onValueChange={(v) => c.setAcross(v === "across")}
                options={[
                  { value: "along", label: t("顺着跨度", "Along the span") },
                  { value: "across", label: t("横跨", "Across") },
                ]}
              />
            </div>
            <RibSliders s={s} c={c} only={["h", "r"]} />
            {!s.across && s.n > 0 && (
              <div className="mt-2 text-small text-muted-foreground">
                {t(`现在 ${fmt(deflection(s))} mm。筋高加倍 → ${fmt(taller)} mm；筋厚加倍 → ${fmt(thicker)} mm。`, `Now ${fmt(deflection(s))} mm. Double the height → ${fmt(taller)} mm; double the thickness → ${fmt(thicker)} mm.`)}
              </div>
            )}
          </>
        )
      },
      note: t(
        "真实的面板两个方向都会弯，所以常把筋做成井字或放射状；这里只看一个方向的梁，规律是一样的。",
        "A real panel bends both ways, which is why ribs are often laid out as a grid or radially; this beam looks at one direction only, and the rule is the same.",
      ),
      noteTitle: t("两个方向", "Both directions"),
    },
    {
      title: t("注塑件的筋：不能太厚，也不能太高", "Moulded ribs: not too thick, not too tall"),
      body: byLocale(
        <>
          <p>注塑件的筋有几条经验规则：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>筋根部厚度约为壁厚的 40–60%。筋和壁交汇的地方是全件最厚的一处，最后冷却，收缩时把正面拉出一道凹痕，叫缩痕。</li>
            <li>筋高一般不超过壁厚的 3 倍。又高又薄的筋熔料难灌满、气难排，还容易粘在模具里；筋要有拔模（常见 0.5–1°），越高顶端越薄。</li>
            <li>两根筋之间至少留 2 倍壁厚，模具里那片钢才够厚、冷却得了。</li>
          </ul>
          <p>想更硬，就多加几根矮而薄的筋，而不是一根又高又厚的。</p>
        </>,
        <>
          <p>Moulded ribs follow a few rules of thumb:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>The rib's base is about 40–60 % of the wall. Where a rib meets the wall is the thickest spot in the part; it cools last, and as it shrinks it pulls a dent into the show face: a sink mark.</li>
            <li>
              A rib is usually no taller than about 3 times the wall. Tall, thin ribs are hard to fill and vent and tend to stick in the mould; ribs also need draft (commonly 0.5–1°), so the taller they
              are, the thinner the tip.
            </li>
            <li>Leave at least 2 times the wall between ribs, so the steel between them in the mould is thick enough to cool.</li>
          </ul>
          <p>For more stiffness, add more short, thin ribs rather than one tall, thick one.</p>
        </>,
      ),
      task: { label: t("让每条规则都通过，变形仍在 1 mm 以内", "Pass every rule while keeping the deflection under 1 mm"), done: (s) => ribChecks(s).ok && s.n > 0 && !s.across && deflection(s) <= 1 },
      extra: ({ s, c }) => (
        <>
          <Rules s={s} />
          <RibSliders s={s} c={c} />
        </>
      ),
      note: t(
        "Protolabs 的注塑设计指南建议筋厚为相邻壁厚的 40–60%；Bayer（现 Covestro）的《Part and Mold Design》建议筋厚约为壁厚的一半、筋间距至少 2 倍壁厚，并把筋高限制在筋根部厚度的约 3 倍（比按壁厚算更保守）。具体数字随材料、外观要求和供应商不同，以模厂的意见为准。",
        "Protolabs' injection moulding guidance puts rib thickness at 40–60 % of the adjoining wall; Bayer's (now Covestro's) Part and Mold Design guide suggests about half the wall, ribs spaced at least 2 walls apart, and a height of about 3 times the rib's base thickness (stricter than 3 times the wall). The exact numbers vary with material, cosmetic requirements and supplier, so follow your moulder.",
      ),
      noteTitle: t("出处", "Sources"),
      terms: ["rib"],
    },
  ],
  quiz: [
    {
      q: t("壁厚从 2 mm 加到 3 mm，板的弯曲刚度大约变成多少倍？", "A wall goes from 2 mm to 3 mm. Roughly how many times stiffer in bending is the plate?"),
      options: byLocale(["1.5 倍：和厚度成正比", "2.25 倍：和厚度的平方成正比", "约 3.4 倍：和厚度的三次方成正比"], ["1.5×: in proportion to thickness", "2.25×: with the square of thickness", "About 3.4×: with the cube of thickness"]),
      answer: 2,
      explain: t("I = b·t³/12，所以刚度 ∝ t³：(3/2)³ ≈ 3.4。重量只增加 1.5 倍。", "I = b·t³/12, so stiffness goes with t³: (3/2)³ ≈ 3.4. The mass rises only 1.5 times."),
    },
    {
      q: t("在 2 mm 的 ABS 面板背面加筋，哪种最可能在正面留下缩痕？", "Ribs on the back of a 2 mm ABS panel: which is most likely to leave a sink mark on the front?"),
      options: byLocale(["1.0 mm 厚、5 mm 高", "2.0 mm 厚、4 mm 高", "1.2 mm 厚、6 mm 高"], ["1.0 mm thick, 5 mm tall", "2.0 mm thick, 4 mm tall", "1.2 mm thick, 6 mm tall"]),
      answer: 1,
      explain: t(
        "缩痕来自筋和壁交汇处的厚料，看的是筋的厚度：2.0 mm 是壁厚的 100%，远超 40–60%。另两种厚度在 50–60%，高度也没超过壁厚的 3 倍。",
        "Sink comes from the thick material where rib meets wall, so rib thickness is what counts: 2.0 mm is 100 % of the wall, far over 40–60 %. The other two are at 50–60 % and no taller than 3 times the wall.",
      ),
    },
    {
      q: t("为什么加筋比加厚更省材料？", "Why do ribs stiffen a panel with less material than a thicker wall?"),
      options: byLocale(
        ["筋把材料放到离中性层远的地方，那里的材料对 I 贡献最大", "筋用的材料比板更硬", "筋让零件变轻了，所以变形小"],
        ["Ribs put material far from the neutral axis, where it adds most to I", "Ribs are made of stiffer material than the plate", "Ribs make the part lighter, so it deflects less"],
      ),
      answer: 0,
      explain: t(
        "同一个零件只有一种材料，E 不变。I 里每块材料按到中性层距离的平方计，筋把很少的材料放到很远处，所以刚度涨得快、重量涨得慢。",
        "A part is one material, so E doesn't change. Each bit of material counts in I by the square of its distance from the neutral axis; ribs put a little material a long way out, so stiffness climbs fast and mass slowly.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "弯曲刚度 ∝ E·I，平板的 I = b·t³/12：壁厚翻倍，刚度变 8 倍，重量只翻倍",
      "筋把材料放到远离中性层的地方，用很少的材料换很大的刚度；要顺着弯曲方向，高度比厚度管用",
      "注塑件的筋：厚度约为壁厚的 40–60%，高度一般不超过壁厚的 3 倍，间距至少 2 倍壁厚",
    ],
    [
      "Bending stiffness goes with E·I, and a plate's I = b·t³/12: double the wall and it is 8 times stiffer for twice the mass",
      "Ribs put material far from the neutral axis, buying a lot of stiffness for little material; run them with the bending, and favour height over thickness",
      "Moulded ribs: about 40–60 % of the wall thick, usually no taller than 3 walls, at least 2 walls apart",
    ],
  ),
  next: {
    to: "/lesson/living-hinge",
    label: t("活动铰链", "Living hinges"),
    text: t("反过来：故意做一处很薄、很软的地方让它弯。", "The other way round: a spot made thin and flexible on purpose, so it bends."),
  },
  overlay: ({ s }) => <Overlay s={s} />,
}

export default lesson
