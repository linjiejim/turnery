import { ArrowDownToLine, Dices, Hammer } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  EXAG,
  FIT_NAME,
  fitOf,
  HOLES,
  IT,
  IT7_BY_SIZE,
  mm,
  NOMINAL,
  SHAFTS,
  size,
  ToleranceFitsScene,
  type FitState,
  type HoleId,
  type Pair,
  type ShaftId,
  type System,
} from "./tolerance-fits.scene"
import type { LessonDef } from "./types"

/** 3.2.1 「尺寸公差与配合」: tolerance bands, fundamental deviations, the three kinds of fit, hole basis vs shaft basis. */

const opts = <T extends string>(ids: readonly T[]) => ids.map((value) => ({ value, label: value }))
const GRADES = opts(["H6", "H7", "H8", "H9"] as const)
const LETTERS = opts(["f7", "g6", "h6", "k6", "n6", "p6", "s6"] as const)
const BASIS_SHAFT = opts(["g6", "h6", "k6", "n6", "p6"] as const)
const BASIS_HOLE = opts(["G7", "H7", "K7", "N7", "P7"] as const)
const PAIRS: { value: Pair; label: string }[] = [
  { value: "loose", label: t("最松的一对", "Loosest pair") },
  { value: "tight", label: t("最紧的一对", "Tightest pair") },
]
const SYSTEMS: { value: System; label: string }[] = [
  { value: "hole", label: t("基孔制 · 孔 H7", "Hole basis · hole H7") },
  { value: "shaft", label: t("基轴制 · 轴 h6", "Shaft basis · shaft h6") },
]

const W = 252
const TOP = 14
const BOTTOM = 196
const LO = -50
const HI = 60
const y = (um: number) => TOP + ((HI - um) / (HI - LO)) * (BOTTOM - TOP)

/** 公差带图: the zero line is the nominal size; each band spans from its lower to its upper deviation (µm). */
function BandDiagram({ s }: { s: FitState }) {
  const [ES, EI] = HOLES[s.hole]
  const [es, ei] = SHAFTS[s.shaft]
  const showShaft = s.step > 0
  const actual = s.pair !== "mid"
  const band = (x: number, hi: number, lo: number, name: string, tone: "hole" | "shaft", mark: number | null) => (
    <g>
      <rect
        x={x}
        y={y(hi)}
        width={52}
        height={Math.max(1, y(lo) - y(hi))}
        className={tone === "hole" ? "text-primary" : "text-foreground"}
        fill="currentColor"
        fillOpacity={tone === "hole" ? 0.16 : 0.1}
        stroke="currentColor"
        strokeWidth={1.2}
      />
      <text x={tone === "hole" ? x - 4 : x + 56} y={y(hi) + 4} textAnchor={tone === "hole" ? "end" : "start"} fill="currentColor" className="text-caption tabular">
        {hi > 0 ? `+${hi}` : hi}
      </text>
      <text x={tone === "hole" ? x - 4 : x + 56} y={y(lo) + 4} textAnchor={tone === "hole" ? "end" : "start"} fill="currentColor" className="text-caption tabular">
        {lo > 0 ? `+${lo}` : lo}
      </text>
      {mark !== null && <line x1={x - 3} x2={x + 55} y1={y(mark)} y2={y(mark)} stroke="currentColor" strokeWidth={2} />}
      <text x={x + 26} y={BOTTOM + 16} textAnchor="middle" fill="currentColor" className="text-caption font-medium">
        {name}
      </text>
    </g>
  )
  return (
    <svg width={W} height={BOTTOM + 22} viewBox={`0 0 ${W} ${BOTTOM + 22}`} className="block text-foreground" aria-label={t("公差带图", "Tolerance zone diagram")}>
      {[-40, -20, 20, 40].map((t) => (
        <g key={t} className="text-faint-foreground">
          <line x1={30} x2={34} y1={y(t)} y2={y(t)} stroke="currentColor" />
          <text x={27} y={y(t) + 4} textAnchor="end" fill="currentColor" className="text-caption tabular">
            {t > 0 ? `+${t}` : t}
          </text>
        </g>
      ))}
      <line x1={34} x2={34} y1={TOP} y2={BOTTOM} stroke="currentColor" strokeOpacity={0.25} />
      <line x1={34} x2={W - 4} y1={y(0)} y2={y(0)} stroke="currentColor" strokeWidth={1.2} />
      <text x={27} y={y(0) + 4} textAnchor="end" fill="currentColor" className="text-caption">
        0
      </text>
      <text x={38} y={y(0) + 15} fill="currentColor" className="text-caption text-muted-foreground">
        {t("零线", "Zero line")}
      </text>
      {band(76, ES, EI, t(`孔 ${s.hole}`, `Hole ${s.hole}`), "hole", actual ? s.dHole : null)}
      {showShaft && band(160, es, ei, t(`轴 ${s.shaft}`, `Shaft ${s.shaft}`), "shaft", actual && s.step > 0 ? s.dShaft : null)}
    </svg>
  )
}

function FitPanel({ s }: { s: FitState }) {
  const f = fitOf(s.hole, s.shaft)
  const [ES, EI] = HOLES[s.hole]
  const out = s.dHole > ES || s.dHole < EI
  return (
    <div className="pointer-events-none absolute left-3 top-3 space-y-2">
      <div className="flex gap-2">
        <SceneChip>{t(`Ø${NOMINAL} · 尺寸段 18–30 mm`, `Ø${NOMINAL} · size range 18–30 mm`)}</SceneChip>
        <SceneChip>{t(`3D 里直径偏差放大 ${EXAG} 倍`, `Diameter deviations shown ${EXAG}× larger in 3D`)}</SceneChip>
      </div>
      <div className="w-72 rounded-lg border bg-popover p-3 shadow-popover">
        <div className="mb-1 flex items-baseline justify-between text-small">
          <span className="font-medium">{t("公差带图", "Tolerance zone diagram")}</span>
          <span className="text-caption text-muted-foreground">{t("单位 µm", "in µm")}</span>
        </div>
        <BandDiagram s={s} />
        {s.step === 0 ? (
          <div className={cn("mt-1 text-small", out ? "text-destructive" : "text-success")}>
            {t(`实际孔径 Ø${size(s.dHole)}`, `Actual hole Ø${size(s.dHole)}`)} · {out ? t("超差，不合格", "out of tolerance, rejected") : t("在公差带内，合格", "inside the tolerance zone, accepted")}
          </div>
        ) : s.step === 1 ? (
          <div className="mt-1 text-small text-muted-foreground">
            {t(`轴 ${s.shaft}：Ø${size(SHAFTS[s.shaft][1])} ~ Ø${size(SHAFTS[s.shaft][0])}`, `Shaft ${s.shaft}: Ø${size(SHAFTS[s.shaft][1])} to Ø${size(SHAFTS[s.shaft][0])}`)}
          </div>
        ) : (
          <div className="mt-1 space-y-0.5 text-small">
            <div className={cn("font-medium", f.kind === "clearance" ? "text-success" : f.kind === "interference" ? "text-destructive" : "text-warning")}>
              {s.hole}/{s.shaft} · {FIT_NAME[f.kind]}
            </div>
            <div className="font-mono text-caption tabular text-muted-foreground">
              {f.kind === "interference" ? `Ymin ${mm(f.maxClear)}  Ymax ${mm(f.minClear)}` : f.kind === "clearance" ? `Xmax ${mm(f.maxClear)}  Xmin ${mm(f.minClear)}` : `Xmax ${mm(f.maxClear)}  Ymax ${mm(f.minClear)}`}
            </div>
            {s.pair !== "mid" && (
              <div className="text-caption text-muted-foreground">
                {t("这一对：", "This pair: ")}
                {s.dHole - s.dShaft > 0
                  ? t(`间隙 ${mm(s.dHole - s.dShaft)}`, `clearance ${mm(s.dHole - s.dShaft)}`)
                  : s.dHole === s.dShaft
                    ? t("间隙为 0，刚好贴合", "zero clearance, just touching")
                    : t(`过盈 ${mm(s.dHole - s.dShaft)}`, `interference ${mm(s.dHole - s.dShaft)}`)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/** Push / press buttons and what happened. */
function Assemble({ s, c }: { s: FitState; c: ToleranceFitsScene }) {
  const free = s.dHole - s.dShaft >= 0
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={s.insert >= 1} onClick={() => c.pushIn()}>
          <ArrowDownToLine />
          {t("用手推进去", "Push in by hand")}
        </Button>
        {!free && (
          <Button size="sm" variant="secondary" disabled={s.pressed} onClick={() => c.press()}>
            <Hammer />
            {t("压入", "Press in")}
          </Button>
        )}
      </div>
      {s.insert >= 1 && free && (
        <Hint>
          {s.dHole > s.dShaft
            ? t("有间隙，轴一推就进去，还能在孔里晃。间隙越大晃得越厉害。", "There's clearance: the shaft slides in with a push and can rock in the hole. The more clearance, the more it rocks.")
            : t("间隙为 0：推得进去，但不会晃，这是 H7/h6 这类定位配合最紧的情况。", "Zero clearance: it pushes in but doesn't rock. This is the tightest case of a locational fit such as H7/h6.")}
        </Hint>
      )}
      {s.blocked && !free && !s.pressed && (
        <Hint tone="warning">
          {t(
            "轴比孔大，手推不进去。要用压力机压入，或者把孔加热胀大再装（热装）。",
            "The shaft is bigger than the hole, so it won't go in by hand. Press it in with a press, or heat the part with the hole so the hole expands, then fit it (a shrink fit).",
          )}
        </Hint>
      )}
      {s.pressed && s.insert >= 1 && (
        <Hint>
          {t(
            "压进去以后，轴和孔靠弹性变形互相抱紧，不加键也能传递一定的扭矩，拆下来就难了。",
            "Once pressed in, the shaft and hole grip each other through elastic deformation. The joint can transmit some torque without a key, but it's hard to take apart.",
          )}
        </Hint>
      )}
    </>
  )
}

const lesson: LessonDef<FitState, ToleranceFitsScene> = {
  id: "tolerance-fits",
  codes: ["3.2.1"],
  title: t("尺寸公差与配合", "Dimensional tolerances and fits"),
  create: (v, emit) => new ToleranceFitsScene(v, emit),
  steps: [
    {
      title: t("公差：允许的变动范围", "Tolerance: the permitted range of variation"),
      body: byLocale(
        <>
          <p>没有哪台机床能把孔正好做成 20 mm。图纸上写 Ø20H7，意思是孔径可以在 20.000 到 20.021 mm 之间，量出来落在这个范围里就合格。</p>
          <p>20 叫公称尺寸。实际尺寸允许偏离它的上限叫上极限偏差（孔记作 ES），下限叫下极限偏差（EI）。两者之差就是公差。左上角的公差带图以公称尺寸为零线，把这个范围画成一条带。</p>
          <p>H7 里的数字 7 是标准公差等级 IT7。数字越大，公差越大，越好加工，也越不精确。</p>
        </>,
        <>
          <p>No machine tool can make a hole exactly 20 mm. Ø20H7 on a drawing means the hole diameter may be anywhere from 20.000 to 20.021 mm; if it measures within that range, it passes.</p>
          <p>
            20 is the nominal size. The upper limit on how far the actual size may deviate from it is the upper limit deviation (written ES for a hole); the lower limit is the lower limit deviation (EI). The difference
            between them is the tolerance. The tolerance zone diagram at the top left takes the nominal size as its zero line and draws this range as a band.
          </p>
          <p>The 7 in H7 is the standard tolerance grade IT7. The bigger the number, the bigger the tolerance: easier to make, and less precise.</p>
        </>,
      ),
      task: { label: t("把实际孔径拖到公差带外，再换一个公差等级", "Drag the actual hole size outside the tolerance zone, then switch to another tolerance grade"), done: (s) => s.sawOut && s.grades.length >= 2 },
      extra: ({ s, c }) => (
        <>
          <ParamSlider
            className="mt-4 px-0"
            label={t("这个孔实际做到", "This hole actually came out at")}
            unit="µm"
            value={s.dHole}
            min={-10}
            max={60}
            onChange={(v) => c.setActualHole(v)}
            hint={t(`偏差 ${s.dHole} µm，即 Ø${size(s.dHole)}`, `A deviation of ${s.dHole} µm, so Ø${size(s.dHole)}`)}
          />
          <div className="mt-3">
            <Segmented size="sm" aria-label={t("孔的公差等级", "Hole tolerance grade")} value={s.hole} onValueChange={(v) => c.setHole(v as HoleId)} options={GRADES} />
          </div>
          <div className="mt-3 rounded-md bg-sunken px-3 py-2 text-small">
            <div className="text-muted-foreground">{t("18–30 mm 的标准公差", "Standard tolerances for 18–30 mm")}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-caption tabular">
              {[5, 6, 7, 8, 9].map((g) => (
                <span key={g}>
                  IT{g} {IT[g]}
                </span>
              ))}
            </div>
            <div className="mt-1.5 text-muted-foreground">{t("同是 IT7，零件越大公差越大：", "Same grade IT7, but the bigger the part, the bigger the tolerance:")}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-caption tabular">
              {IT7_BY_SIZE.map(([r, v]) => (
                <span key={r} className={cn(r === "18–30" && "text-primary")}>
                  {r} mm: {v}
                </span>
              ))}
            </div>
          </div>
        </>
      ),
      note: t(
        "数值取自 GB/T 1800.1—2020 和 GB/T 1800.2—2020（对应 ISO 286-1、286-2：2010），单位 µm。旧国标把公称尺寸叫「基本尺寸」。",
        "Values from GB/T 1800.1—2020 and GB/T 1800.2—2020 (equivalent to ISO 286-1 and 286-2:2010), in µm. Older Chinese standards called the nominal size the “basic size”.",
      ),
      noteTitle: t("出处", "Source"),
    },
    {
      title: t("基本偏差：字母管位置", "Fundamental deviation: the letter sets the position"),
      body: byLocale(
        <>
          <p>公差等级只管带有多宽，带放在零线的哪里由字母决定，叫基本偏差。小写字母是轴，大写是孔。</p>
          <p>轴的 a 到 g 整条带在零线下面，轴比公称尺寸小；h 的上偏差为 0，正好贴着零线；js 跨在零线两边；k 到 zc 在零线上面，轴比公称尺寸大。孔的字母正好反过来，H 的下偏差为 0。</p>
        </>,
        <>
          <p>
            The tolerance grade sets only how wide the band is. Where the band sits relative to the zero line is set by the letter, called the fundamental deviation. Lowercase letters are for shafts, uppercase for holes.
          </p>
          <p>
            For shafts, a to g put the whole band below the zero line, so the shaft is smaller than nominal; h has an upper deviation of 0 and sits right on the zero line; js straddles it; k to zc lie above it, so the shaft
            is larger than nominal. Hole letters work the other way round: H has a lower deviation of 0.
          </p>
        </>,
      ),
      task: { label: t("试 4 个不同的轴，看公差带怎么移动", "Try 4 different shafts and watch the band move"), done: (s) => s.letters.length >= 4 },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("轴 p6 和公称尺寸 Ø20 比，是大还是小？", "Is a p6 shaft bigger or smaller than the nominal Ø20?")}
            options={byLocale(["比 Ø20 小", "比 Ø20 大", "正好跨着 Ø20"], ["Smaller than Ø20", "Bigger than Ø20", "It straddles Ø20"])}
            answer={1}
            explain={t(
              "p 在 k 之后，公差带整个在零线上方：p6 的轴是 Ø20.022 到 Ø20.035，比 Ø20 大。配上 H7 的孔，它就比孔还粗。",
              "p comes after k, so the band lies entirely above the zero line: a p6 shaft is Ø20.022 to Ø20.035, bigger than Ø20. Paired with an H7 hole, it is even bigger than the hole.",
            )}
            onReveal={() => c.setShaft("p6")}
          />
          <div className="mt-4">
            <Segmented size="sm" aria-label={t("轴的公差带", "Shaft tolerance class")} value={s.shaft} onValueChange={(v) => c.setShaft(v as ShaftId)} options={LETTERS} />
          </div>
          <div className="mt-2 text-small text-muted-foreground">
            {t("已试", "Tried")} <span className="tabular">{s.letters.length}</span>
            {t(" 个：", ": ")}
            {s.letters.join(t("、", ", ")) || t("还没有", "none yet")}
          </div>
        </>
      ),
    },
    {
      title: t("间隙、过渡、过盈", "Clearance, transition, interference"),
      body: byLocale(
        <>
          <p>孔和轴的公差带一对比，配合就定了：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>间隙配合：孔带整个在轴带上方，任取一对都有间隙。</li>
            <li>过盈配合：孔带整个在轴带下方，轴总比孔大，要压进去。</li>
            <li>过渡配合：两条带有重叠，可能有间隙，也可能有过盈。</li>
          </ul>
          <p>最大间隙 Xmax 是最大的孔配最小的轴；另一头是最小的孔配最大的轴，得到最小间隙 Xmin，或者最大过盈 Ymax（负值）。</p>
        </>,
        <>
          <p>Compare the hole's band with the shaft's, and the fit follows:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Clearance fit: the hole band lies entirely above the shaft band, so any pair has clearance.</li>
            <li>Interference fit: the hole band lies entirely below the shaft band; the shaft is always bigger than the hole and has to be pressed in.</li>
            <li>Transition fit: the two bands overlap, so a pair may have clearance or interference.</li>
          </ul>
          <p>
            The maximum clearance Xmax comes from the largest hole with the smallest shaft. At the other end, the smallest hole with the largest shaft gives the minimum clearance Xmin, or the maximum interference Ymax (a
            negative value).
          </p>
        </>,
      ),
      task: {
        label: t("三种配合各装一次：拖轴顶上的蓝点往下推，推不动就压入", "Assemble each of the three fits once: drag the blue dot on top of the shaft down, and press it in if it won't go"),
        done: (s) => s.fits.length >= 3,
      },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4 space-y-2">
            <Segmented size="sm" aria-label={t("轴的公差带", "Shaft tolerance class")} value={s.shaft} onValueChange={(v) => c.setShaft(v as ShaftId)} options={LETTERS} />
            <div>
              <Segmented size="sm" aria-label={t("取哪一对零件", "Which pair of parts")} value={s.pair === "loose" ? "loose" : "tight"} onValueChange={(v) => c.setPair(v)} options={PAIRS} />
            </div>
          </div>
          <Assemble s={s} c={c} />
          <div className="mt-3 flex flex-wrap gap-1.5 text-caption">
            {(["clearance", "transition", "interference"] as const).map((k) => (
              <span key={k} className={cn("rounded-sm px-1.5 py-0.5", s.fits.includes(k) ? "bg-success-subtle text-success" : "bg-muted text-muted-foreground")}>
                {FIT_NAME[k]}
              </span>
            ))}
          </div>
        </>
      ),
      note: t(
        "常用的基孔制配合和典型用途：H8/f7 精密转动；H7/g6 滑动，能转能移、定位准；H7/h6 定位间隙，装拆方便；H7/k6、H7/n6 过渡，精确定位；H7/p6 过盈定位，要压入；H7/s6 中等压入，传递扭矩。",
        "Common hole-basis fits and typical uses: H8/f7 close running; H7/g6 sliding, free to turn and slide with accurate location; H7/h6 locational clearance, easy to assemble and take apart; H7/k6 and H7/n6 transition, for accurate location; H7/p6 locational interference, pressed in; H7/s6 medium drive, transmits torque.",
      ),
      noteTitle: t("怎么选", "Choosing a fit"),
    },
    {
      title: t("过渡配合：抽到哪对算哪对", "Transition fits: it depends on the pair you get"),
      body: byLocale(
        <>
          <p>H7/k6 的两条带有重叠。同一批零件里随手拿一对，可能松，也可能紧。</p>
          <p>所以过渡配合用在要求定位准、又要能拆的地方，比如齿轮、带轮装在轴上：装的时候用木槌轻敲，靠键传扭矩。</p>
        </>,
        <>
          <p>The two bands of H7/k6 overlap. Pick any pair from the same batch, and it may be loose or it may be tight.</p>
          <p>
            So transition fits are used where location must be accurate but the parts must still come apart, such as a gear or pulley on a shaft: it goes on with light taps of a mallet, and a key carries the torque.
          </p>
        </>,
      ),
      task: {
        label: t("多抽几对，直到既抽到有间隙的，也抽到有过盈的", "Draw pairs until you have had at least one with clearance and one with interference"),
        done: (s) => s.samples.some((x) => x > 0) && s.samples.some((x) => x < 0),
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("从合格的 H7 孔和 k6 轴里各随手拿一个，装起来会怎样？", "Take any in-tolerance H7 hole and any in-tolerance k6 shaft. What happens when you fit them together?")}
            options={byLocale(["一定有间隙", "一定有过盈", "可能有间隙，也可能有过盈"], ["There's always clearance", "There's always interference", "There may be clearance, or there may be interference"])}
            answer={2}
            explain={t(
              "孔在 20.000–20.021 之间，轴在 20.002–20.015 之间。大孔配小轴有间隙，最多 0.019；小孔配大轴有过盈，最多 0.015。",
              "The hole is between 20.000 and 20.021, the shaft between 20.002 and 20.015. A large hole with a small shaft gives clearance, up to 0.019; a small hole with a large shaft gives interference, up to 0.015.",
            )}
            onReveal={() => c.sample()}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => c.sample()}>
              <Dices />
              {t("随机取一对", "Draw a random pair")}
            </Button>
          </div>
          {s.pair === "sample" && <Assemble s={s} c={c} />}
          <SampleStrip samples={s.samples} />
        </>
      ),
    },
    {
      title: t("基孔制与基轴制", "Hole-basis and shaft-basis systems"),
      body: byLocale(
        <>
          <p>配合有两种组织法。基孔制：孔一律用 H，靠换轴的公差带得到松紧不同的配合。基轴制：轴一律用 h，靠换孔。</p>
          <p>国标优先用基孔制。孔要靠钻头、铰刀、拉刀这些定尺寸刀具加工，用塞规检验；孔都用 H，一个尺寸只备一套刀具和量规。轴车一刀磨一刀，什么尺寸都好做。</p>
          <p>基轴制用在轴不便加工的时候：直接用冷拉光轴，或者一根轴上要装好几个松紧不同的零件。滚动轴承外圈和座孔的配合也按基轴制。</p>
        </>,
        <>
          <p>
            Fits are organized in one of two ways. Hole basis: every hole is H, and you get looser or tighter fits by changing the shaft's tolerance class. Shaft basis: every shaft is h, and you change the hole instead.
          </p>
          <p>
            GB prefers the hole-basis system. Holes are made with fixed-size tools such as drills, reamers and broaches, and checked with plug gauges; if every hole is H, each size needs only one set of tools and gauges. A
            shaft is simply turned and ground, which can hit any size.
          </p>
          <p>
            The shaft-basis system is for when the shaft is awkward to machine: cold-drawn bar used as it comes, or one shaft that carries several parts with different fits. The fit between a rolling bearing's outer ring
            and its housing bore is also shaft basis.
          </p>
        </>,
      ),
      task: { label: t("找出和 H7/g6 松紧完全一样的基轴制配合", "Find the shaft-basis fit that is exactly as tight as H7/g6"), done: (s) => s.pairs.includes("H7/g6") && s.pairs.includes("G7/h6") },
      extra: ({ s, c }) => {
        const f = fitOf(s.hole, s.shaft)
        return (
          <>
            <div className="mt-4 space-y-2">
              <Segmented size="sm" aria-label={t("配合制", "Fit system")} value={s.system} onValueChange={(v) => c.setSystem(v)} options={SYSTEMS} />
              <div>
                {s.system === "hole" ? (
                  <Segmented size="sm" aria-label={t("轴的公差带", "Shaft tolerance class")} value={s.shaft} onValueChange={(v) => c.setShaft(v as ShaftId)} options={BASIS_SHAFT} />
                ) : (
                  <Segmented size="sm" aria-label={t("孔的公差带", "Hole tolerance class")} value={s.hole} onValueChange={(v) => c.setHole(v as HoleId)} options={BASIS_HOLE} />
                )}
              </div>
            </div>
            <div className="mt-3">
              <Readout label={f.kind === "interference" ? "Ymin" : "Xmax"} value={mm(f.maxClear)} unit="mm" />
              <Readout label={f.kind === "clearance" ? "Xmin" : "Ymax"} value={mm(f.minClear)} unit="mm" />
            </div>
            {s.pairs.includes("H7/g6") && s.pairs.includes("G7/h6") && (
              <Hint>
                {t(
                  "H7/g6 和 G7/h6 的间隙都是 0.007–0.041：标准里专门让同名的两种配合松紧相同。K7/h6 对 H7/k6、P7/h6 对 H7/p6 也一样，可以切过去看看。",
                  "H7/g6 and G7/h6 both give a clearance of 0.007–0.041: the standard deliberately makes the two fits with matching letters equally tight. The same goes for K7/h6 and H7/k6, and for P7/h6 and H7/p6; switch over and see.",
                )}
              </Hint>
            )}
          </>
        )
      },
      note: t(
        "装配图上把配合写成分数：Ø20H7/g6，分子是孔，分母是轴。零件图上只写各自的一半：孔 Ø20H7，轴 Ø20g6；也可以直接写极限偏差，比如孔的上偏差 +0.021、下偏差 0。",
        "On an assembly drawing a fit is written as a fraction, Ø20H7/g6: the hole above the line, the shaft below. Each part drawing shows only its own half: the hole Ø20H7, the shaft Ø20g6. You can also write the limit deviations directly, for example an upper deviation of +0.021 and a lower deviation of 0 for the hole.",
      ),
      noteTitle: t("图上怎么标", "On the drawing"),
    },
  ],
  quiz: [
    {
      q: t("孔 Ø25H7 和 Ø25H8，哪个更难加工？", "Which hole is harder to make: Ø25H7 or Ø25H8?"),
      options: byLocale(
        ["H7：公差 0.021，比 H8 的 0.033 窄", "H8：数字大，精度高", "一样，字母都是 H"],
        ["H7: its tolerance of 0.021 is narrower than H8's 0.033", "H8: the bigger number means higher precision", "Neither: both are H"],
      ),
      answer: 0,
      explain: t(
        "数字是标准公差等级，越大公差越宽。18–30 mm 段里 IT7 = 21 µm，IT8 = 33 µm。H 只说明下偏差为 0，两者的带都从 Ø25.000 开始。",
        "The number is the standard tolerance grade: the bigger it is, the wider the tolerance. In the 18–30 mm range, IT7 = 21 µm and IT8 = 33 µm. The H only says the lower deviation is 0, so both bands start at Ø25.000.",
      ),
    },
    {
      q: t("H7/k6 是什么配合？", "What kind of fit is H7/k6?"),
      options: byLocale(
        ["间隙配合，一定能推进去", "过渡配合，随手拿的一对可能有间隙也可能有过盈", "过盈配合，一定要压入"],
        ["A clearance fit: it always pushes in", "A transition fit: any given pair may have clearance or interference", "An interference fit: it always has to be pressed in"],
      ),
      answer: 1,
      explain: t(
        "k6 的轴带（+2 到 +15 µm）和 H7 的孔带（0 到 +21 µm）重叠。最大间隙 0.019，最大过盈 0.015，装配时一般轻敲装入。",
        "The k6 shaft band (+2 to +15 µm) overlaps the H7 hole band (0 to +21 µm). Maximum clearance 0.019, maximum interference 0.015; it is usually assembled with light taps.",
      ),
    },
    {
      q: t("为什么国标优先用基孔制？", "Why does GB prefer the hole-basis system?"),
      options: byLocale(
        ["孔比轴重要", "孔用定尺寸的刀具和塞规加工检验，孔都用 H 可以少备刀具量规", "基孔制的配合更紧"],
        ["Holes matter more than shafts", "Holes are made and checked with fixed-size tools and plug gauges, so making every hole H means fewer tools and gauges", "Hole-basis fits are tighter"],
      ),
      answer: 1,
      explain: t(
        "钻头、铰刀、拉刀和塞规的尺寸是固定的，孔的公差带种类越少越省事；轴车削、磨削什么尺寸都好做。松紧同名的基孔制和基轴制配合，间隙或过盈相同，紧不紧和制度无关。",
        "Drills, reamers, broaches and plug gauges come in fixed sizes, so the fewer hole tolerance classes the better; turning and grinding make a shaft to any size easily. A hole-basis fit and the shaft-basis fit with matching letters have the same clearance or interference, so how tight a fit is has nothing to do with the system.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "公差 = 上极限偏差 − 下极限偏差；公差等级（IT 后的数字）管带宽，字母（基本偏差）管带的位置",
      "孔带在轴带上方是间隙配合，在下方是过盈配合，重叠是过渡配合；看最大、最小间隙或过盈来判断",
      "优先用基孔制：孔一律 H，换轴的字母得到不同松紧；H7/g6 滑动、H7/h6 定位、H7/k6 过渡、H7/p6 压入",
    ],
    [
      "Tolerance = upper limit deviation − lower limit deviation. The tolerance grade (the number after IT) sets the band's width; the letter (the fundamental deviation) sets its position",
      "Hole band above the shaft band: clearance fit; below it: interference fit; overlapping: transition fit. Judge by the maximum and minimum clearance or interference",
      "Prefer hole basis: every hole H, and change the shaft's letter for a looser or tighter fit. H7/g6 sliding, H7/h6 locating, H7/k6 transition, H7/p6 press fit",
    ],
  ),
  next: {
    to: "/lesson/gdt-basics",
    label: t("GD&T 入门", "Introduction to GD&T"),
    text: t("尺寸公差只管大小，形状、方向、位置要靠几何公差。", "A size tolerance only controls size; form, orientation and location take geometric tolerances."),
  },
  overlay: ({ s }) => <FitPanel s={s} />,
}

/** Each random pair as a dot: right of zero has clearance, left has interference. */
function SampleStrip({ samples }: { samples: number[] }) {
  if (!samples.length) return null
  const x = (um: number) => 8 + ((um + 20) / 40) * 224
  return (
    <div className="mt-4">
      <div className="text-small text-muted-foreground">{t(`抽到的 ${samples.length} 对`, `${samples.length} ${samples.length === 1 ? "pair" : "pairs"} drawn`)}</div>
      <svg width={240} height={44} viewBox="0 0 240 44" className="mt-1 block text-foreground" aria-label={t("抽样结果", "Pairs drawn")}>
        <line x1={8} x2={232} y1={22} y2={22} stroke="currentColor" strokeOpacity={0.25} />
        <line x1={x(0)} x2={x(0)} y1={8} y2={30} stroke="currentColor" />
        {samples.map((v, i) => (
          <circle key={i} cx={x(v)} cy={22} r={4} className={v > 0 ? "text-success" : "text-destructive"} fill="currentColor" fillOpacity={0.75} />
        ))}
        <text x={x(-10)} y={42} textAnchor="middle" fill="currentColor" className="text-caption text-muted-foreground">
          {t("过盈", "Interference")}
        </text>
        <text x={x(10)} y={42} textAnchor="middle" fill="currentColor" className="text-caption text-muted-foreground">
          {t("间隙", "Clearance")}
        </text>
      </svg>
    </div>
  )
}

export default lesson
