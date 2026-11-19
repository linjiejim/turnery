import { FoldHorizontal, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { SheetScene, bendAllowance, flatLength, type SheetState } from "./sheet-metal-bend.scene"
import type { LessonDef } from "./types"

/** 4.3.1 · 4.3.2 · 4.3.3 「钣金：折弯、K 因子与展开」. */

const mm = (n: number) => n.toFixed(2)

function Formula({ s }: { s: SheetState }) {
  const ba = bendAllowance(s)
  return (
    <div className="mt-4 rounded-md bg-sunken px-3 py-2 text-small">
      <div className="font-mono tabular">BA = π × (R + K × T) × θ / 180</div>
      <div className="mt-1 font-mono tabular text-muted-foreground">
        = π × ({s.R} + {s.K.toFixed(2)} × {s.T}) × {s.theta} / 180 = {mm(ba)} mm
      </div>
      <div className="mt-2">
        <Readout label={t("展开长 a + BA + b", "Flat length a + BA + b")} value={mm(flatLength(s))} unit="mm" tone="primary" />
      </div>
    </div>
  )
}

function KSlider({ s, c }: { s: SheetState; c: SheetScene }) {
  return (
    <ParamSlider
      className="mt-3 px-0"
      label={t("K 因子", "K-factor")}
      unit=""
      value={s.K}
      min={0.25}
      max={0.5}
      step={0.01}
      onChange={(v) => c.setParam("K", v)}
      hint={t("中性层到内表面的距离 ÷ 料厚。", "Distance from the neutral axis to the inside surface ÷ thickness.")}
    />
  )
}

const lesson: LessonDef<SheetState, SheetScene> = {
  id: "sheet-metal-bend",
  codes: ["4.3.1", "4.3.2", "4.3.3"],
  title: t("钣金：折弯、K 因子与展开", "Sheet metal: bends, K-factor and flat patterns"),
  create: (v, emit) => new SheetScene(v, emit),
  steps: [
    {
      title: t("一张板折出来", "Bent from one sheet"),
      body: byLocale(
        <>
          <p>钣金件是一整张等厚的板，先激光切出展开形状，再在折弯机上折成形。</p>
          <p>所以在 CAD 里要用钣金特征来建（基体法兰、边线法兰、折弯），而不是拿一块实体去切：软件得知道每个折弯的半径、料厚和 K 因子，才能把它展开回平板。</p>
        </>,
        <>
          <p>A sheet metal part is one sheet of constant thickness. Its flat shape is laser cut first, then bent to shape on a press brake.</p>
          <p>
            So in CAD you build it with sheet metal features (base flange, edge flange, bends) instead of cutting away at a solid block: the software has to know each bend's radius, the
            thickness and the K-factor to unfold the part back into a flat blank.
          </p>
        </>,
      ),
      task: { label: t("把板折到 90°", "Bend the sheet to 90°"), done: (s) => s.fold >= 0.999 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <ParamSlider className="px-0" label={t("折弯角度", "Bend angle")} unit="°" value={Math.round(s.fold * s.theta)} min={0} max={s.theta} onChange={(v) => c.setFold(v / s.theta)} />
          <Button size="sm" variant="secondary" onClick={() => c.playFold()}>
            <Play />
            {t("播放折弯", "Play the bend")}
          </Button>
        </div>
      ),
    },
    {
      title: t("中性层", "The neutral axis"),
      body: byLocale(
        <>
          <p>折弯时内侧被压短，外侧被拉长。中间有一层长度不变，叫中性层（虚线）。展开长度就按它来算。</p>
          <p>中性层不在正中间，而是偏向内侧：它到内表面的距离是 K·T，K 叫 K 因子，不超过 0.5。</p>
        </>,
        <>
          <p>
            In a bend, the inside is compressed and gets shorter, and the outside is stretched and gets longer. In between lies a layer whose length doesn't change: the neutral axis (the
            dashed line). The flat length is calculated along it.
          </p>
          <p>The neutral axis isn't in the exact middle; it sits toward the inside. Its distance from the inside surface is K·T, where K is the K-factor, which is at most 0.5.</p>
        </>,
      ),
      task: { label: t("拖动 K，看虚线在板厚里移动", "Drag K and watch the dashed line move through the thickness"), done: (s) => s.triedK },
      extra: ({ s, c }) => (
        <>
          <KSlider s={s} c={c} />
          <Hint>
            {t(
              "K 是经验值，和材料、R/T、折弯方式有关。Protolabs：R 小于 T 时，空气折弯约 0.33，压底折弯约 0.42，R 越大越接近 0.5。Xometry 的空气折弯表：R 在 1–3T 时软材料约 0.40。",
              "K is an empirical value that depends on the material, R/T and the bending method. Protolabs: with R less than T, about 0.33 for air bending and about 0.42 for bottoming, getting closer to 0.5 as R grows. Xometry's air bending table: about 0.40 for soft materials with R between 1T and 3T.",
            )}
          </Hint>
        </>
      ),
    },
    {
      title: t("折弯余量", "Bend allowance"),
      body: byLocale(
        <>
          <p>折弯区里中性层的弧长，叫折弯余量 BA。中性层半径是 R + K·T，转过 θ 度，弧长就是下面这个式子。</p>
          <p>这里 a、b 量的是两段直边（到折弯切线为止），展开长 = a + BA + b。</p>
        </>,
        <>
          <p>The arc length of the neutral axis through the bend is the bend allowance, BA. The neutral axis has radius R + K·T and turns through θ degrees, so its arc length is the formula below.</p>
          <p>Here a and b measure the two straight legs (up to the bend tangent lines), so the flat length = a + BA + b.</p>
        </>,
      ),
      task: { label: t("把 K 调到 0.5，看展开长怎么变", "Set K to 0.5 and see how the flat length changes"), done: (s) => s.kHigh },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("其他不变，K 从 0.33 增大到 0.5，展开长度会怎样？", "With everything else unchanged, K goes up from 0.33 to 0.5. What happens to the flat length?")}
            options={byLocale(["变长", "变短", "不变，K 只影响折弯力"], ["It gets longer", "It gets shorter", "It stays the same; K only affects the bending force"])}
            answer={0}
            explain={t(
              "K 越大，中性层离内侧越远，半径 R + K·T 越大，弧长 BA 越长，展开长度跟着变长。差值不大，但钣金的公差也很紧。",
              "A larger K puts the neutral axis further from the inside, so the radius R + K·T is larger, the arc length BA is longer, and the flat length grows with it. The difference is small, but sheet metal tolerances are tight too.",
            )}
            onReveal={() => c.raiseK()}
          />
          <Formula s={s} />
          <KSlider s={s} c={c} />
          <ParamSlider className="px-0" label={t("料厚 T", "Thickness T")} value={s.T} min={0.6} max={3} step={0.1} onChange={(v) => c.setParam("T", v)} />
          <ParamSlider
            className="px-0"
            label={t("内折弯半径 R", "Inside bend radius R")}
            value={s.R}
            min={0.5}
            max={6}
            step={0.25}
            onChange={(v) => c.setParam("R", v)}
            hint={t("Protolabs 的标准内半径：0.76、1.52、2.29、3.05 mm。", "Protolabs' standard inside radii: 0.76, 1.52, 2.29 and 3.05 mm.")}
          />
        </>
      ),
    },
    {
      title: t("展开", "The flat pattern"),
      body: byLocale(
        <>
          <p>钣金件最终交付的是展开图（平板图形，常导出 DXF 给激光切割）。展开时中性层长度不变，折弯区摊平成宽 BA 的一条带。</p>
          <p>展开图上画着折弯线：折弯机按它对位下刀。</p>
        </>,
        <>
          <p>
            What a sheet metal part finally goes out as is its flat pattern (the flat outline, often exported as a DXF for laser cutting). When the part is unfolded, the neutral axis keeps
            its length and the bend region lies flat as a strip BA wide.
          </p>
          <p>The flat pattern shows the bend lines: the press brake is lined up on them before the punch comes down.</p>
        </>,
      ),
      task: { label: t("展开成平板", "Unfold it flat"), done: (s) => s.unfolded },
      extra: ({ s, c }) => (
        <>
          <Button size="sm" variant="secondary" className="mt-3" onClick={() => c.toggleFlat()}>
            <FoldHorizontal />
            {s.fold > 0.5 ? t("展开", "Unfold") : t("折回", "Fold back")}
          </Button>
          <Formula s={s} />
        </>
      ),
    },
    {
      title: t("释放槽", "Bend relief"),
      body: byLocale(
        <>
          <p>现在法兰只占这条边的中间一段。折弯区的两端连着不折弯的板，金属在那里被强行撕开或挤出鼓包。</p>
          <p>办法是在折弯两端切出释放槽，让折弯区和旁边的板分开。</p>
        </>,
        <>
          <p>
            Now the flange takes up only the middle of this edge. At each end, the bend region is still joined to sheet that doesn't bend, so the metal there is forced to tear or bulge.
          </p>
          <p>The fix is to cut a bend relief at each end of the bend, so the bend region is separated from the sheet next to it.</p>
        </>,
      ),
      task: { label: t("加上释放槽", "Add bend reliefs"), done: (s) => s.relief },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="text-small font-medium">{t("折弯两端", "Ends of the bend")}</span>
            <Segmented
              size="sm"
              aria-label={t("释放槽", "Bend relief")}
              value={s.relief ? "on" : "off"}
              onValueChange={(v) => c.setRelief(v === "on")}
              options={[
                { value: "off", label: t("不处理", "Nothing") },
                { value: "on", label: t("释放槽", "Bend relief") },
              ]}
            />
          </div>
          <Hint>
            {t(
              "释放槽的尺寸各家说法相反：Protolabs 给的是上限（宽不超过 0.76 mm），Fictiv 给的是下限（宽至少取 T 和 0.76 mm 中的较大者，深至少 1.5T）。这里画的是宽 T、越过折弯区 1.5T。以供应商的 DFM 报告为准。",
              "Suppliers' guidance on relief size points opposite ways: Protolabs gives an upper limit (no wider than 0.76 mm), Fictiv a lower limit (at least the larger of T and 0.76 mm wide, and at least 1.5T deep). The reliefs drawn here are T wide and run 1.5T past the bend region. Go by your supplier's DFM report.",
            )}
          </Hint>
        </>
      ),
    },
    {
      title: t("最小法兰长度", "Minimum flange length"),
      body: byLocale(
        <>
          <p>法兰太短，折弯时搭不住下模的 V 槽，折不准甚至折不了。Protolabs 的规则：法兰长度至少 4 倍料厚。</p>
          <p>同理，孔和其他特征离折弯太近会被拉变形：Protolabs 要求 4T 以外，Fictiv 给的是 2.5T + R。</p>
        </>,
        <>
          <p>
            A flange that is too short can't span the V-opening of the lower die, so the bend comes out inaccurate or can't be made at all. Protolabs' rule: a flange must be at least 4
            times the material thickness long.
          </p>
          <p>Likewise, holes and other features too close to a bend get pulled out of shape: Protolabs wants them more than 4T away, and Fictiv gives 2.5T + R.</p>
        </>,
      ),
      task: { label: t("把法兰拉到 4T 以下看警告，再改回来", "Shorten the flange below 4T to see the warning, then set it back"), done: (s) => s.triedShort && s.b >= 4 * s.T },
      extra: ({ s, c }) => (
        <>
          <ParamSlider
            className="mt-3 px-0"
            label={t("法兰直段 b", "Flange straight length b")}
            value={s.b}
            min={2}
            max={30}
            onChange={(v) => c.setParam("b", v)}
            hint={t(
              `4T = ${(4 * s.T).toFixed(1)} mm。这里按直段算，比按外形尺寸算更保守。`,
              `4T = ${(4 * s.T).toFixed(1)} mm. This counts only the straight length, which is more conservative than measuring to the outside.`,
            )}
          />
          {s.b < 4 * s.T && <Hint tone="warning">{byLocale(<>法兰 {s.b} mm 小于 4T。</>, <>The {s.b} mm flange is shorter than 4T.</>)}</Hint>}
        </>
      ),
    },
  ],
  quiz: [
    {
      q: t("K 因子描述的是什么？", "What does the K-factor describe?"),
      options: byLocale(
        ["折弯回弹的角度", "中性层到折弯内表面的距离与料厚之比", "折弯半径与料厚之比"],
        ["The springback angle of a bend", "The distance from the neutral axis to the inside surface of the bend, divided by the thickness", "The bend radius divided by the thickness"],
      ),
      answer: 1,
      explain: t(
        "K = 中性层到内表面的距离 ÷ T，通常在 0.3–0.5 之间，不超过 0.5。",
        "K = distance from the neutral axis to the inside surface ÷ T. It usually lies between 0.3 and 0.5, and is never more than 0.5.",
      ),
    },
    {
      q: t("T = 2、R = 2、K = 0.4，折 90°，折弯余量 BA 约是多少？", "T = 2, R = 2, K = 0.4, bent to 90°. Roughly what is the bend allowance BA?"),
      options: byLocale(["约 3.1 mm", "约 4.4 mm", "约 6.3 mm"], ["About 3.1 mm", "About 4.4 mm", "About 6.3 mm"]),
      answer: 1,
      explain: t(
        "BA = π × (2 + 0.4 × 2) × 90 / 180 = π × 2.8 / 2 ≈ 4.40 mm。3.1 是只按内半径 R 算的弧长，6.3 是按外半径 R + T 算的。",
        "BA = π × (2 + 0.4 × 2) × 90 / 180 = π × 2.8 / 2 ≈ 4.40 mm. 3.1 is the arc length at the inside radius R alone; 6.3 uses the outside radius R + T.",
      ),
    },
    {
      q: t("法兰只占一条边的一部分时，为什么要在折弯两端加释放槽？", "When a flange covers only part of an edge, why add bend reliefs at both ends of the bend?"),
      options: byLocale(
        ["为了减重", "折弯区两端连着不折弯的板，会撕裂或鼓包", "为了让展开长度更准确"],
        ["To save weight", "The ends of the bend region are joined to sheet that doesn't bend, so they tear or bulge", "To make the flat length more accurate"],
      ),
      answer: 1,
      explain: t(
        "释放槽把折弯区和旁边的平板分开，金属可以自由变形。尺寸各家不同，以供应商为准。",
        "Reliefs separate the bend region from the flat sheet next to it, so the metal can deform freely. Sizes differ between suppliers; go by yours.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "钣金用钣金特征建：板厚不变，每个折弯带着 R、T、K，才能展开",
      "展开长 = 直段 + BA，BA = π(R + K·T)θ/180；K 越大展开越长",
      "法兰至少 4T，局部法兰两端加释放槽；数值以供应商的 DFM 报告为准",
    ],
    [
      "Build sheet metal with sheet metal features: the thickness stays constant and every bend carries its R, T and K, so the part can be unfolded",
      "Flat length = straight lengths + BA, where BA = π(R + K·T)θ/180; the larger K, the longer the flat pattern",
      "Flanges at least 4T long; partial flanges get bend reliefs at both ends. Go by your supplier's DFM report for the numbers",
    ],
  ),
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        T {s.T} · R {s.R} · K {s.K.toFixed(2)}
      </SceneChip>
      <SceneChip tone="primary">
        {Math.round(s.fold * s.theta)}° · {t("展开长", "Flat length")} {mm(flatLength(s))}
      </SceneChip>
    </div>
  ),
}

export default lesson
