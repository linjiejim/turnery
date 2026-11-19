import { RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import {
  bFirst,
  flatError,
  FRAME_CELLS,
  FRAME_NAME,
  GdtScene,
  HOLE,
  MAG,
  perpError,
  posError,
  SETUP,
  setupError,
  SIZE_TOL,
  SYMBOL_PATHS,
  TOL,
  type FrameKind,
  type GdtState,
  type Standard,
} from "./gdt-basics.scene"
import type { LessonDef } from "./types"

/** 3.2.2 「GD&T 入门：基准与公差带」: frames, flatness, perpendicularity, position, the datum frame, GB vs ASME. */

/** A feature control frame, the same as in the 3D view. */
function Fcf({ kind, className }: { kind: FrameKind; className?: string }) {
  return (
    <span className={cn("inline-flex items-stretch border border-foreground bg-popover font-mono text-small tabular", className)}>
      <span className="flex items-center px-1.5 py-0.5">
        <svg viewBox="0 0 24 16" width={24} height={16} fill="none" stroke="currentColor" strokeWidth={1.4} aria-label={FRAME_NAME[kind]}>
          <path d={SYMBOL_PATHS[kind]} />
        </svg>
      </span>
      {FRAME_CELLS[kind].map((c) => (
        <span key={c} className="flex items-center border-l border-foreground px-1.5 py-0.5">
          {c}
        </span>
      ))}
    </span>
  )
}

const FRAME_TEXT: Record<FrameKind, string> = {
  flat: t(
    "平面度 0.05：顶面必须整个夹在相距 0.05 的两个平行平面之间。属于形状公差，不用基准。",
    "Flatness 0.05: the whole top face must lie between two parallel planes 0.05 apart. It is a form tolerance and uses no datum.",
  ),
  perp: t(
    "垂直度 0.05，基准 A：B 面必须夹在相距 0.05、并且垂直于基准 A 的两个平行平面之间。属于方向公差。",
    "Perpendicularity 0.05 to datum A: face B must lie between two parallel planes 0.05 apart that are perpendicular to datum A. It is an orientation tolerance.",
  ),
  pos: t(
    "位置度 Ø0.1，基准 A、B、C：孔的轴线必须落在直径 0.1 的圆柱里，圆柱的轴线在理论正确位置上。属于位置公差。",
    "Position Ø0.1 to datums A, B and C: the hole's axis must lie inside a cylinder 0.1 in diameter whose axis is at the true position. It is a location tolerance.",
  ),
}

const STANDARDS: { value: Standard; label: string }[] = [
  { value: "iso", label: t("国标 · 独立原则", "GB · independency principle") },
  { value: "asme", label: "ASME · Rule #1" },
]

const DOF = [0, 3, 5, 6]

const verdict = (ok: boolean) => (ok ? t("合格", "in tolerance") : t("超差", "out of tolerance"))

function Status({ s }: { s: GdtState }) {
  const chip = (text: string, ok: boolean) => <SceneChip className={ok ? "text-success" : "text-destructive"}>{text}</SceneChip>
  return (
    <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
      <SceneChip>{t(`几何误差放大 ${MAG} 倍`, `Geometric errors shown ${MAG}× larger`)}</SceneChip>
      {s.step === 1 && chip(t(`平面度误差 ${flatError(s).toFixed(3)} · ${verdict(flatError(s) <= TOL.flat)}`, `Flatness error ${flatError(s).toFixed(3)} · ${verdict(flatError(s) <= TOL.flat)}`), flatError(s) <= TOL.flat)}
      {s.step === 2 && chip(t(`垂直度误差 ${perpError(s).toFixed(3)} · ${verdict(perpError(s) <= TOL.perp)}`, `Perpendicularity error ${perpError(s).toFixed(3)} · ${verdict(perpError(s) <= TOL.perp)}`), perpError(s) <= TOL.perp)}
      {s.step === 3 && chip(t(`位置度误差 Ø${posError(s).toFixed(3)} · ${verdict(posError(s) <= TOL.pos + 1e-9)}`, `Position error Ø${posError(s).toFixed(3)} · ${verdict(posError(s) <= TOL.pos + 1e-9)}`), posError(s) <= TOL.pos + 1e-9)}
      {s.step === 4 && (
        <SceneChip tone="primary">
          {t("已限制自由度", "Degrees of freedom removed:")} {DOF[s.order.length]} / 6{s.order.length > 0 && ` · ${s.order.join(" → ")}`}
        </SceneChip>
      )}
      {s.step === 5 &&
        chip(
          t(
            `弯曲 ${s.bow.toFixed(2)} · ${s.standard === "iso" ? "国标" : "ASME"}判${s.standard === "iso" || s.bow <= SIZE_TOL ? "合格" : "超差"}`,
            `Bend ${s.bow.toFixed(2)} · ${s.standard === "iso" ? "GB" : "ASME"}: ${s.standard === "iso" || s.bow <= SIZE_TOL ? "in tolerance" : "out of tolerance"}`,
          ),
          s.standard === "iso" || s.bow <= SIZE_TOL,
        )}
    </div>
  )
}

const lesson: LessonDef<GdtState, GdtScene> = {
  id: "gdt-basics",
  codes: ["3.2.2"],
  title: t("GD&T 入门：基准与公差带", "Introduction to GD&T: datums and tolerance zones"),
  create: (v, emit) => new GdtScene(v, emit),
  steps: [
    {
      title: t("框格：一行写清一个要求", "The feature control frame: one requirement per line"),
      body: byLocale(
        <>
          <p>尺寸公差只管大小。面平不平、歪不歪、孔偏没偏，要靠几何公差。老教材叫形位公差，英文常说 GD&amp;T。</p>
          <p>每个要求写在一个公差框格里，从左到右：特征符号、公差值、基准字母。基准字母写在方框里，用一个三角形连到作为基准的面上，叫基准符号。这块板的底面是 A，左面是 B，前面是 C。</p>
        </>,
        <>
          <p>
            A size tolerance controls only size. Whether a face is flat, whether it leans, whether a hole is off position: for that you need geometric tolerances. Older Chinese textbooks call them form and position
            tolerances; in English they usually go by GD&amp;T.
          </p>
          <p>
            Each requirement goes in a feature control frame. From left to right: the characteristic symbol, the tolerance value, and the datum letters. A datum letter sits in a square, joined by a triangle to the face that
            serves as the datum: this is the datum feature symbol. On this plate, the bottom face is A, the left face B and the front face C.
          </p>
        </>,
      ),
      task: { label: t("点 3D 里的三个框格，看各管哪个面", "Click the three frames in the 3D view to see which face each one controls"), done: (s) => s.seen.length >= 3 },
      extra: ({ s }) =>
        s.frame ? (
          <div className="mt-4 rounded-lg border p-3">
            <Fcf kind={s.frame} />
            <p className="mt-2 text-body">{FRAME_TEXT[s.frame]}</p>
          </div>
        ) : (
          <Hint>{t("框格亮起的那个面，就是它管的被测要素。", "The face that lights up is the toleranced feature that frame controls.")}</Hint>
        ),
      note: t(
        "GB/T 1182—2018（对应 ISO 1101:2017）把几何公差分成形状、方向、位置、跳动四类。形状公差只看要素自己，方向和位置公差都要相对基准。",
        "GB/T 1182—2018 (equivalent to ISO 1101:2017) sorts geometric tolerances into four types: form, orientation, location and run-out. A form tolerance looks only at the feature itself; orientation and location tolerances are both relative to datums.",
      ),
      noteTitle: t("国标", "GB standard"),
    },
    {
      title: t("平面度：两个平行平面", "Flatness: two parallel planes"),
      body: byLocale(
        <>
          <p>平面度的公差带是两个平行平面，间距等于公差值 0.05。实际表面整个落在两个平面之间，就合格。</p>
          <p>平面度是形状公差，没有基准：两个平面可以跟着表面一起倾斜、上下移动，只要找得到一个位置把表面夹住就行。</p>
        </>,
        <>
          <p>The tolerance zone for flatness is two parallel planes, spaced by the tolerance value, 0.05. If the whole actual surface lies between them, the face passes.</p>
          <p>
            Flatness is a form tolerance, so it has no datum: the two planes may tilt and move up and down with the surface. All that matters is that some position exists where they hold the whole surface between them.
          </p>
        </>,
      ),
      task: {
        label: t("拖顶面中间的蓝点，让起伏超差；再调回 0.05 以内，把整个面倾斜看看", "Drag the blue dot in the middle of the top face until the bulge is out of tolerance; then bring it back within 0.05 and tilt the whole face"),
        done: (s) => s.sawFlatFail && s.triedTilt,
      },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("顶面本身很平（起伏 0.02），但整个面斜了 0.1。平面度 0.05 合格吗？", "The top face itself is very flat (a bulge of 0.02), but the whole face is tilted by 0.1. Does it pass flatness 0.05?")}
            options={byLocale(["不合格，斜了 0.1", "合格：公差带跟着面一起斜", "要先看基准"], ["No: it's tilted by 0.1", "Yes: the tolerance zone tilts with the face", "You need to know the datum first"])}
            answer={1}
            explain={t(
              "平面度只管面自己平不平，不管它朝哪。两个平行平面跟着斜过去，0.02 的起伏照样夹得住。要管倾斜，得用相对基准的方向公差。",
              "Flatness controls only whether the face itself is flat, not which way it faces. The two parallel planes tilt along with it and still hold the 0.02 bulge. To control tilt, you need an orientation tolerance relative to a datum.",
            )}
            onReveal={() => {
              c.setBulge(0.02)
              c.setTilt(0.1)
            }}
          />
          <ParamSlider className="mt-4 px-0" label={t("起伏", "Bulge")} value={s.bulge} min={0} max={0.1} step={0.005} onChange={(v) => c.setBulge(v)} />
          <ParamSlider
            className="mt-1 px-0"
            label={t("整个面倾斜", "Tilt of the whole face")}
            value={s.tilt}
            min={-0.12}
            max={0.12}
            step={0.01}
            onChange={(v) => c.setTilt(v)}
            hint={t("面的一端比另一端高出多少。", "How much higher one end of the face is than the other.")}
          />
        </>
      ),
    },
    {
      title: t("垂直度：相对基准 A", "Perpendicularity: relative to datum A"),
      body: byLocale(
        <>
          <p>垂直度的公差带也是两个平行平面，相距 0.05，但必须垂直于基准 A（底面）。B 面可以整体平移，却不能歪：顶边相对底边偏出 0.05 以上就超差。</p>
          <p>同样是倾斜，平面度不在乎，垂直度在乎。区别就在基准：方向公差的公差带要对着基准摆正。</p>
        </>,
        <>
          <p>
            The perpendicularity zone is also two parallel planes 0.05 apart, but they must be perpendicular to datum A (the bottom face). Face B may shift as a whole, but it may not lean: if its top edge sits more than 0.05
            out from its bottom edge, it is out of tolerance.
          </p>
          <p>The same tilt that flatness ignores, perpendicularity catches. The difference is the datum: an orientation tolerance zone has to be squared up to its datum.</p>
        </>,
      ),
      task: { label: t("拖 B 面顶边的蓝点让它倾斜：先超差，再拖回合格", "Drag the blue dot on face B's top edge to make it lean: first out of tolerance, then back in"), done: (s) => s.sawPerpFail && s.sawPerpPass },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("B 面很平，只是向外斜了 0.08。平面度 0.05 和垂直度 0.05 分别合格吗？", "Face B is very flat, but it leans out by 0.08. Does it pass flatness 0.05? Does it pass perpendicularity 0.05?")}
            options={byLocale(["都合格", "平面度合格，垂直度超差", "都超差"], ["Both pass", "Flatness passes, perpendicularity fails", "Both fail"])}
            answer={1}
            explain={t(
              "面是平的，平面度的公差带跟着斜就能夹住；垂直度的公差带必须垂直于 A，0.05 宽的两个竖直平面夹不住斜出 0.08 的面。",
              "The face is flat, so the flatness zone just tilts with it and holds it. The perpendicularity zone must be perpendicular to A: two vertical planes 0.05 apart can't hold a face that leans out 0.08.",
            )}
            onReveal={() => c.setLean(0.08)}
          />
          <div className="mt-4">
            <Readout label={t("垂直度误差", "Perpendicularity error")} value={perpError(s).toFixed(3)} unit="mm" tone={perpError(s) <= TOL.perp ? "success" : "warning"} />
          </div>
        </>
      ),
      note: t(
        "方向公差顺带管住形状：B 面的平面度误差不可能超过它的垂直度公差。所以已经标了垂直度，就不必再标同样大小的平面度。",
        "An orientation tolerance also controls form: face B's flatness error can't exceed its perpendicularity tolerance. So once perpendicularity is specified, there's no need to add a flatness tolerance of the same value.",
      ),
      noteTitle: t("顺带", "A free bonus"),
    },
    {
      title: t("位置度：圆柱形公差带", "Position: a cylindrical tolerance zone"),
      body: byLocale(
        <>
          <p>孔的位置用方框里的 30 和 25 给出，叫理论正确尺寸。它们不带公差，只定出孔该在的「真实位置」；偏多少由框格管。</p>
          <p>框格里的 Ø0.1 表示公差带是直径 0.1 的圆柱，孔的轴线整个落在圆柱里才合格。</p>
          <p>对比 ±0.05 的坐标公差（虚线方框）：往斜角偏 0.07 的孔也算合格，往正右偏 0.06 却不合格。螺钉穿不穿得过去只看偏了多远，不看往哪偏，所以圆柱公差带更合理。</p>
        </>,
        <>
          <p>
            The hole's location is given by the boxed 30 and 25, called theoretically exact dimensions. They carry no tolerance; they only fix the “true position” where the hole should be. How far it may stray is up to
            the frame.
          </p>
          <p>The Ø0.1 in the frame means the tolerance zone is a cylinder 0.1 in diameter. The hole passes only if its whole axis lies inside that cylinder.</p>
          <p>
            Compare a ±0.05 coordinate tolerance (the dashed square): with it, a hole off by 0.07 toward a corner passes, yet one off by 0.06 straight to the right fails. Whether a screw goes through depends only on how far
            the hole is off, not in which direction, so a cylindrical zone makes more sense.
          </p>
        </>,
      ),
      task: { label: t("拖孔的中心：拖出公差带，再拖回来", "Drag the hole's center out of the tolerance zone, then back in"), done: (s) => s.sawPosOut && s.posBack },
      extra: ({ s }) => (
        <div className="mt-4">
          <Readout label={t("偏 X", "Offset X")} value={s.dx.toFixed(3)} unit="mm" />
          <Readout label={t("偏 Y", "Offset Y")} value={s.dy.toFixed(3)} unit="mm" />
          <Readout label={t("位置度", "Position")} value={`Ø${posError(s).toFixed(3)}`} tone={posError(s) <= TOL.pos + 1e-9 ? "success" : "warning"} />
        </div>
      ),
      note: t(
        "ASME Y14.5 把理论正确尺寸叫基本尺寸（basic dimension），同样画方框。孔的位置度常在公差值后加 Ⓜ（最大实体要求）：孔做得越大，允许的位置偏差也越大，国标和 ASME 都有这个规则。",
        "ASME Y14.5 calls a theoretically exact dimension a basic dimension, and boxes it the same way. A hole's position tolerance often has Ⓜ after the value (the maximum material requirement; MMC in ASME): the larger the hole is made, the more position error is allowed. GB and ASME both have this rule.",
      ),
      noteTitle: t("GB 与 ASME", "GB and ASME"),
    },
    {
      title: t("基准 A、B、C：按顺序装夹", "Datums A, B, C: set the part up in order"),
      body: byLocale(
        <>
          <p>框格里基准字母的顺序，就是检验时把零件靠上去的顺序。第一基准 A：底面贴平平台，3 点接触，限制 3 个自由度；第二基准 B：推靠山，2 点接触，再限制 2 个；第三基准 C：顶到挡块，1 点，限制最后 1 个。这叫 3-2-1 定位。</p>
          <p>这块板的 B 面向外斜了 0.04（垂直度合格），孔中心离 B 面底边 29.94。</p>
        </>,
        <>
          <p>
            The order of the datum letters in the frame is the order in which the part is brought against the fixture for inspection. Primary datum A: the bottom face sits flat on the surface plate, touching at 3 points and
            removing 3 degrees of freedom. Secondary datum B: pushed against the angle plate, touching at 2 points and removing 2 more. Tertiary datum C: pushed up to the stop, touching at 1 point and removing the last one.
            This is called 3-2-1 location.
          </p>
          <p>On this plate, face B leans out by 0.04 (within its perpendicularity tolerance), and the hole's center is 29.94 from face B's bottom edge.</p>
        </>,
      ),
      task: { label: t("点基准符号，按 A、B、C 装好；再重新装夹，先靠 B", "Click the datum symbols to set the part up in the order A, B, C; then set it up again, starting with B"), done: (s) => s.doneABC && s.triedBFirst },
      extra: ({ s, c }) => {
        const done = s.order.length === 3
        return (
          <>
            <div className="mt-4 flex items-center gap-2">
              <Fcf kind="pos" />
              <Button size="sm" variant="secondary" disabled={s.order.length === 0} onClick={() => c.resetSetup()}>
                <RotateCcw />
                {t("重新装夹", "Set up again")}
              </Button>
            </div>
            {done && !bFirst(s.order) && s.order[0] === "A" && (
              <Hint>
                {byLocale(
                  <>
                    A 面先贴平，孔的轴线和平台垂直。B 面斜，只有顶边碰到靠山，孔中心离靠山 {(HOLE.x + SETUP.ex + SETUP.lean).toFixed(2)}，位置度 Ø{setupError(s.order).toFixed(2)}。
                  </>,
                  <>
                    With A seated flat first, the hole's axis is perpendicular to the surface plate. Face B leans, so only its top edge touches the angle plate: the hole's center is {(HOLE.x + SETUP.ex + SETUP.lean).toFixed(2)}{" "}
                    from it, and the position error is Ø{setupError(s.order).toFixed(2)}.
                  </>,
                )}
              </Hint>
            )}
            {done && bFirst(s.order) && (
              <Hint tone="warning">
                {byLocale(
                  <>
                    先靠 B，零件被斜的 B 面带着转了一个角，底面只剩一条边挨着平台，孔的轴线也跟着斜了。同一个零件，位置度从 Ø{setupError(["A", "B", "C"]).toFixed(2)} 变成 Ø{setupError(s.order).toFixed(2)}。A 是装配时贴合的安装面，所以图纸让它当第一基准。
                  </>,
                  <>
                    Seated against B first, the part is turned by the leaning face B: only one edge of the bottom face touches the surface plate, and the hole's axis tilts with it. Same part, but the position error goes
                    from Ø{setupError(["A", "B", "C"]).toFixed(2)} to Ø{setupError(s.order).toFixed(2)}. A is the mounting face that seats against the mating part in the assembly, which is why the drawing makes it the
                    primary datum.
                  </>,
                )}
              </Hint>
            )}
          </>
        )
      },
      note: t(
        "ASME Y14.5 和 GB/T 1182 都用框格里的字母顺序表示第一、第二、第三基准，建立方式也一样；ASME 把平台、靠山这些叫 datum feature simulator（基准要素模拟体）。",
        "ASME Y14.5 and GB/T 1182 both use the letter order in the frame for the primary, secondary and tertiary datums, and set them up the same way. ASME calls the surface plate, the angle plate and the like datum feature simulators.",
      ),
      noteTitle: t("GB 与 ASME", "GB and ASME"),
    },
    {
      title: t("国标与 ASME：尺寸公差管不管形状", "GB versus ASME: does a size tolerance control form?"),
      body: byLocale(
        <>
          <p>板厚 20 ± 0.1，被压弯了，可每一处量出来都是 20.00。合格吗？两套标准的默认规则不同：</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>国标 GB/T 4249（对应 ISO 8015）默认独立原则：尺寸公差只管局部尺寸，两点一量都在 19.9 到 20.1 之间就合格，弯不弯不管。要管形状，另标平面度、直线度，或在尺寸后加 Ⓔ（包容要求）。</li>
            <li>ASME Y14.5 默认 Rule #1（包容原则）：尺寸在最大实体 20.1 时形状必须完美，整块板要能放进相距 20.1 的两个平行平面之间。</li>
          </ul>
        </>,
        <>
          <p>The plate is 20 ± 0.1 thick. It has been bent, yet it measures 20.00 everywhere. Does it pass? The two standards have different default rules:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              GB/T 4249 (equivalent to ISO 8015) defaults to the independency principle: a size tolerance controls only local sizes. If every two-point measurement is between 19.9 and 20.1, the plate passes, bent or not. To
              control form, add a flatness or straightness tolerance, or put Ⓔ (the envelope requirement) after the size.
            </li>
            <li>ASME Y14.5 defaults to Rule #1 (the envelope principle): at the maximum material size, 20.1, the form must be perfect, so the whole plate must fit between two parallel planes 20.1 apart.</li>
          </ul>
        </>,
      ),
      task: { label: t("拖板中间的蓝点把板压弯 0.1 以上，用两种标准各判一次", "Drag the blue dot in the middle of the plate to bend it by more than 0.1, then judge it under each standard"), done: (s) => s.judged.length >= 2 },
      extra: ({ s, c }) => (
        <>
          <div className="mt-4">
            <Segmented size="sm" aria-label={t("按哪个标准判", "Standard to judge by")} value={s.standard} onValueChange={(v) => c.setStandard(v)} options={STANDARDS} />
          </div>
          <ParamSlider className="mt-3 px-0" label={t("弯曲", "Bend")} value={s.bow} min={0} max={0.2} step={0.01} onChange={(v) => c.setBow(v)} />
          {s.bow > SIZE_TOL && (
            <Hint tone={s.standard === "asme" ? "warning" : undefined}>
              {s.standard === "asme"
                ? t(`弯了 ${s.bow.toFixed(2)}，加上 20.00 的厚度，放不进 20.1 的包容边界：按 ASME 超差。`, `Bent by ${s.bow.toFixed(2)} on top of its 20.00 thickness, it no longer fits the 20.1 envelope: out of tolerance under ASME.`)
                : t(`每处厚度都是 20.00，在 19.9 到 20.1 之间：按国标合格。要限制弯曲，图上得另外标出来。`, `Every local thickness is 20.00, between 19.9 and 20.1: it passes under GB. To limit the bend, the drawing has to call it out separately.`)}
            </Hint>
          )}
        </>
      ),
      note: t(
        "ASME 图纸上想取消包容原则，在尺寸后加 Ⓘ（独立原则）；国标图纸上没标几何公差的要素，形状按 GB/T 1184 的未注公差检验。",
        "On an ASME drawing, to waive the envelope principle, put Ⓘ (independency) after the size. On a GB drawing, a feature with no geometric tolerance has its form inspected against the general tolerances of GB/T 1184.",
      ),
      noteTitle: t("读图时", "Reading the drawing"),
    },
  ],
  quiz: [
    {
      q: t("B 面本身很平，只是相对底面 A 向外斜了 0.08。平面度 0.05 和垂直度 0.05 | A 各自合格吗？", "Face B itself is very flat, but it leans out by 0.08 relative to the bottom face A. Does it pass flatness 0.05? Does it pass perpendicularity 0.05 | A?"),
      options: byLocale(["都合格", "平面度合格，垂直度超差", "都超差"], ["Both pass", "Flatness passes, perpendicularity fails", "Both fail"]),
      answer: 1,
      explain: t(
        "平面度是形状公差，公差带可以跟着面倾斜；垂直度的公差带必须垂直于基准 A，宽 0.05 的带夹不住斜出 0.08 的面。",
        "Flatness is a form tolerance, so its zone may tilt with the face. The perpendicularity zone must be perpendicular to datum A, and a zone 0.05 wide can't hold a face that leans out 0.08.",
      ),
    },
    {
      q: t("框格 ⌖ | Ø0.1 | A | B | C 里，A、B、C 的先后说明什么？", "In the frame ⌖ | Ø0.1 | A | B | C, what does the order of A, B and C tell you?"),
      options: byLocale(
        ["只是字母顺序，可以随意换", "装夹顺序：先让 A 面 3 点贴平，再靠 B 面 2 点，最后 C 面 1 点", "A 的精度要求最高"],
        ["It's just alphabetical; you can swap them freely", "The setup order: first seat face A flat on 3 points, then B against 2 points, and last C against 1 point", "A has the tightest accuracy requirement"],
      ),
      answer: 1,
      explain: t(
        "第一基准限制 3 个自由度，第二基准 2 个，第三基准 1 个。顺序换了，基准面不完美时零件会摆成另一个姿态，测出的位置度也会变。",
        "The primary datum removes 3 degrees of freedom, the secondary 2 and the tertiary 1. Change the order, and when the datum faces aren't perfect the part settles in a different orientation, so the measured position error changes too.",
      ),
    },
    {
      q: t("板厚 20 ± 0.1，弯了 0.3，但处处厚 20.00。按国标的默认规则，厚度这个尺寸合格吗？", "A plate is 20 ± 0.1 thick. It is bent by 0.3 but is 20.00 thick everywhere. Under the GB default rule, does the thickness pass?"),
      options: byLocale(
        ["合格：国标默认独立原则，尺寸公差只管局部尺寸", "不合格：放不进 20.1 的包容边界", "要看材料"],
        ["Yes: GB defaults to the independency principle, so a size tolerance controls only local sizes", "No: it doesn't fit the 20.1 envelope", "It depends on the material"],
      ),
      answer: 0,
      explain: t(
        "放不进包容边界就不合格，是 ASME Rule #1 的判法。国标默认独立原则，要限制弯曲，得另标平面度或直线度，或者在尺寸后加 Ⓔ。",
        "Failing it because it won't fit the envelope is how ASME Rule #1 judges it. GB defaults to the independency principle: to limit the bend, add a flatness or straightness tolerance, or put Ⓔ after the size.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "框格从左到右：特征符号、公差值（带 Ø 是圆柱形公差带）、基准字母（按第一、第二、第三的顺序）",
      "平面度：两平行平面，可随意倾斜；垂直度：两平行平面，必须垂直于基准；位置度：以理论正确尺寸定出的真实位置为轴线的圆柱",
      "基准按 A、B、C 的顺序 3-2-1 建立；国标默认独立原则，ASME 默认包容原则（Rule #1）",
    ],
    [
      "A feature control frame reads left to right: characteristic symbol, tolerance value (a Ø means a cylindrical zone), then datum letters in primary, secondary, tertiary order",
      "Flatness: two parallel planes, free to tilt. Perpendicularity: two parallel planes that must be perpendicular to the datum. Position: a cylinder whose axis is the true position set by theoretically exact dimensions",
      "Datums are set up 3-2-1 in the order A, B, C. GB defaults to the independency principle; ASME defaults to the envelope principle (Rule #1)",
    ],
  ),
  overlay: ({ s }) => <Status s={s} />,
}

export default lesson
