import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import { FilletShellOrderScene, type OrderState } from "./fillet-shell-order.scene"
import type { LessonDef, StepCtx } from "./types"

const R_VALUES = [2, 4, 6, 8]
const T_VALUES = [1.5, 2.5, 4]

function TreeStepper({ s, c, which }: StepCtx<OrderState, FilletShellOrderScene> & { which: 0 | 1 }) {
  const names =
    which === 0
      ? byLocale(["拉伸1", "圆角1", "抽壳1"], ["Extrude1", "Fillet1", "Shell1"])
      : byLocale(["拉伸1", "抽壳1", "圆角1"], ["Extrude1", "Shell1", "Fillet1"])
  const at = which === 0 ? s.ua : s.ub
  return (
    <div className="mt-3 flex gap-1.5">
      {names.map((n, i) => (
        <Button key={n} size="sm" variant={at === i + 1 ? "primary" : "secondary"} onClick={() => c.stepTo(which, i + 1)}>
          {i + 1}. {n}
        </Button>
      ))}
    </div>
  )
}

function ValuePicker({ label, values, value, onPick, unit = "mm" }: { label: string; values: number[]; value: number; onPick: (v: number) => void; unit?: string }) {
  return (
    <div className="mt-3">
      <div className="text-small font-medium">{label}</div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onPick(v)}
            className={cn(
              "h-7 min-w-12 rounded-sm border px-2 font-mono text-caption tabular transition-colors duration-(--duration-fast) hover:bg-accent",
              value === v && "border-primary bg-selected",
            )}
          >
            {v}
            <span className="text-faint-foreground">{unit}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** 1.3.4 · 1.2.7 「先圆角还是先抽壳」: feature order changes the part. */
const lesson: LessonDef<OrderState, FilletShellOrderScene> = {
  id: "fillet-shell-order",
  codes: ["1.2.7", "1.3.4"],
  title: t("先圆角，还是先抽壳", "Fillet first, or shell first?"),
  create: (v, emit) => new FilletShellOrderScene(v, emit),
  steps: [
    {
      title: t("同一个盒子，两种顺序", "One box, two orders"),
      body: byLocale(
        <>
          <p>左右两个盒子尺寸完全一样：外形 60 × 40 × 30，外圆角 R4，壁厚 2.5，顶面开口。唯一的区别是特征顺序。</p>
          <p>A 先倒外圆角再抽壳；B 先抽壳再倒外圆角。从外面看，几乎看不出差别。</p>
        </>,
        <>
          <p>The two boxes, left and right, have exactly the same dimensions: 60 × 40 × 30 overall, R4 outside fillets, wall thickness 2.5, open at the top. The only difference is the order of the features.</p>
          <p>A fillets the outside edges first, then shells; B shells first, then fillets the outside edges. From the outside, you can hardly tell them apart.</p>
        </>,
      ),
      extra: ({ s }) =>
        s.error ? (
          <Hint tone="warning">
            {t("模型没加载出来：", "The models didn't load: ")}
            {s.error}
          </Hint>
        ) : !s.ready ? (
          <Hint>{t("正在加载两个模型……", "Loading the two models…")}</Hint>
        ) : null,
      terms: ["fillet", "shell"],
    },
    {
      title: t("A：先圆角", "A: fillet first"),
      body: byLocale(
        <p>在 A 的特征树里一步步往下走。抽壳的时候，外圆角已经在了：抽壳把所有面向内偏移一个壁厚，外圆角也一起偏移成一个同心的内圆角。</p>,
        <p>
          Step down A's feature tree one feature at a time. When the shell runs, the outside fillets are already there: the shell offsets every face inward by the wall thickness,
          and the outside fillets are offset with them into concentric inside fillets.
        </p>,
      ),
      task: { label: t("走完 A 的三步，看抽壳生成了哪些面", "Step through all three of A's features, and see which faces the shell creates"), done: (s) => s.steppedA && s.ua === 3 },
      extra: (ctx) => <TreeStepper {...ctx} which={0} />,
    },
    {
      title: t("B：先抽壳", "B: shell first"),
      body: byLocale(
        <p>B 抽壳的时候还是尖角，内壁也是尖角。之后再倒外圆角，只削外面，里面的尖角不会跟着变。</p>,
        <p>When B is shelled, its corners are still sharp, so the inside walls get sharp corners too. The outside fillets added afterwards only cut away the outside; the sharp inside corners stay as they are.</p>,
      ),
      task: { label: t("走完 B 的三步", "Step through all three of B's features"), done: (s) => s.steppedB && s.ub === 3 },
      extra: (ctx) => <TreeStepper {...ctx} which={1} />,
    },
    {
      title: t("剖开看转角", "Cut it open to see the corners"),
      body: byLocale(
        <p>在半高处水平剖开，从上往下看转角处的壁。A 的壁处处一样厚；B 的外圆角把转角削薄了，内侧还是尖角，注塑时这里容易应力集中、缩痕不均。</p>,
        <p>
          Cut both boxes horizontally at half height and look down at the wall in the corners. A's wall is the same thickness everywhere. On B, the outside fillet has thinned the
          wall at the corner while the inside is still a sharp corner: in a molded part, this is where stress concentrates and the plastic shrinks unevenly.
        </p>,
      ),
      task: { label: t("打开剖切，对比两个转角", "Turn on the section view and compare the two corners"), done: (s) => s.cutSeen },
      extra: ({ s, c }) => {
        const w = FilletShellOrderScene.cornerWall(s.r, s.t)
        return (
          <>
            <label className="mt-3 flex items-center gap-2 text-small">
              <Switch checked={s.section} onCheckedChange={(v) => c.setSection(v)} />
              {t("剖切", "Section")}
            </label>
            <div className="mt-3 rounded-lg border p-3">
              <div className="text-small text-muted-foreground">
                {byLocale(
                  <>
                    转角处的最薄壁厚（R{s.r}，壁厚 {s.t}）
                  </>,
                  <>
                    Thinnest wall at the corner (R{s.r}, wall {s.t})
                  </>,
                )}
              </div>
              <div className="mt-1">
                <Readout label="A" value={w.a.toFixed(2)} unit="mm" tone="success" />
                <Readout label="B" value={w.b.toFixed(2)} unit="mm" tone={w.b < s.t * 0.7 ? "warning" : undefined} />
              </div>
              <p className="mt-2 text-caption text-faint-foreground">
                {t("B 的转角壁厚 = R − (R − 壁厚) × √2，外圆角越大越薄。", "B's wall at the corner = R − (R − wall) × √2: the larger the outside fillet, the thinner it gets.")}
              </p>
            </div>
          </>
        )
      },
    },
    {
      title: t("参数一变，谁先坏", "Change the parameters: which one breaks first?"),
      body: byLocale(
        <p>换几组圆角和壁厚。这些组合都在 OpenCascade 内核里实际算过，失败的结果没有隐藏。</p>,
        <p>Try a few combinations of fillet radius and wall thickness. Every combination was actually computed in the OpenCascade kernel, and the failures aren't hidden.</p>,
      ),
      task: { label: t("找到一组会失败的参数", "Find a combination that fails"), done: (s) => s.triedFail },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("把外圆角加大到 R8、壁厚减到 1.5，哪个盒子会建不出来？", "Raise the outside fillet to R8 and cut the wall thickness to 1.5. Which box can't be built?")}
            options={byLocale(["A 先圆角", "B 先抽壳", "都没问题"], ["A, fillet first", "B, shell first", "Both are fine"])}
            answer={1}
            explain={t(
              "B 的外圆角从外面削进转角，壁太薄时直接把壁吃穿，内核拒绝。A 的内圆角半径是 8 − 1.5 = 6.5，照样成立。",
              "B's outside fillet cuts into the corner from the outside. With a wall this thin it cuts right through, and the kernel refuses. A's inside fillet has a radius of 8 − 1.5 = 6.5, so A still builds.",
            )}
            onReveal={() => c.setParams(8, 1.5)}
          />
          <ValuePicker label={t("外圆角 R", "Outside fillet R")} values={R_VALUES} value={s.r} onPick={(r) => c.setParams(r, s.t)} />
          <ValuePicker label={t("壁厚", "Wall thickness")} values={T_VALUES} value={s.t} onPick={(t) => c.setParams(s.r, t)} />
          {s.failA && (
            <Hint tone="warning">
              {t("A 失败：", "A failed: ")}
              {c.failureText(0)}
            </Hint>
          )}
          {s.failB && (
            <Hint tone="warning">
              {t("B 失败：", "B failed: ")}
              {c.failureText(1)}
            </Hint>
          )}
        </>
      ),
      note: t(
        "SOLIDWORKS 帮助建议先圆角再抽壳；build123d 的茶杯示例却是先抽壳后圆角。两种都对，关键是知道各自会得到什么。",
        "The SOLIDWORKS help recommends filleting before shelling, yet build123d's tea cup example shells first and fillets afterwards. Both are valid; what matters is knowing what each one gives you.",
      ),
      noteTitle: t("各家做法", "How others do it"),
    },
  ],
  quiz: [
    {
      q: t(
        "想让抽壳后的内转角也是圆角、壁厚处处一样，应该怎么排？",
        "You want the inside corners to be rounded after shelling too, with the same wall thickness everywhere. In what order do you build it?",
      ),
      options: byLocale(["先抽壳，再倒外圆角", "先倒外圆角，再抽壳", "顺序无所谓"], ["Shell first, then fillet the outside", "Fillet the outside first, then shell", "The order doesn't matter"]),
      answer: 1,
      explain: t(
        "抽壳会把已有的外圆角向内偏移成同心内圆角；之后再倒的外圆角不会影响内侧。",
        "The shell offsets the existing outside fillets inward into concentric inside fillets. Outside fillets added afterwards don't affect the inside.",
      ),
    },
    {
      q: t("先抽壳再倒很大的外圆角，最可能出现什么问题？", "You shell first, then add a large outside fillet. What's the most likely problem?"),
      options: byLocale(
        ["圆角把转角处的壁削薄，甚至吃穿", "内角变圆", "盒子变重"],
        ["The fillet thins the wall at the corners, or even cuts through it", "The inside corners become round", "The box gets heavier"],
      ),
      answer: 0,
      explain: t(
        "外圆角从外面切进转角，内侧仍是尖角，转角处的壁厚 = R − (R − t)√2。",
        "The outside fillet cuts into the corner from the outside while the inside corner stays sharp, so the wall at the corner is R − (R − t)√2 thick.",
      ),
    },
    {
      q: t("先圆角后抽壳时，什么情况下抽壳会失败？", "When you fillet first and then shell, when does the shell fail?"),
      options: byLocale(
        ["圆角比壁厚大很多", "圆角恰好等于壁厚，内圆角半径为零", "壁厚很小"],
        ["The fillet is much larger than the wall thickness", "The fillet exactly equals the wall thickness, so the inside fillet radius is zero", "The wall is very thin"],
      ),
      answer: 1,
      explain: t(
        "内圆角半径 = 外圆角 − 壁厚；等于零时偏移面退化，内核算不出来。",
        "Inside fillet radius = outside fillet − wall thickness. When that is zero, the offset face degenerates and the kernel can't compute it.",
      ),
    },
  ],
  takeaways: byLocale(
    ["特征顺序会改变零件的形状和强度，不只是建模的先后", "先圆角再抽壳：内外同心，壁厚均匀", "失败的参数组合背后，是特征之间的几何约束"],
    [
      "Feature order changes the part's shape and strength; it's more than the sequence you modeled in",
      "Fillet, then shell: inside and outside are concentric, and the wall thickness is even",
      "Behind every failing combination of parameters is a geometric limit between features",
    ],
  ),
  next: {
    to: "/teardown/box_fillet_first",
    label: t("小盒子拆解", "Small box teardown"),
    text: t("在拆解页里换更多参数组合，看每一步生成和修改了哪些面。", "Try more parameter combinations on the teardown page, and see which faces each step creates and modifies."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
      <SceneChip>
        R{s.r} · {t("壁厚", "wall")} {s.t}
      </SceneChip>
      {s.section && <SceneChip tone="primary">{t("剖切中", "Section on")}</SceneChip>}
    </div>
  ),
}

export default lesson
