import { PenLine, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button, IconButton } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { CONS_NAMES, ConstraintsDofScene, GEO, HEIGHT, WIDTH, type ConsId, type DofState, type Scheme } from "./constraints-dof.scene"
import type { LessonDef, StepCtx } from "./types"

/**
 * 1.1.2 · 1.1.3 「几何约束与自由度」: DOF counting, geometric vs dimensional
 * constraints, fully / over-defined, and design intent. The DOF, the
 * redundant and the conflicting constraints all come from FreeCAD's solver.
 */
type Ctx = StepCtx<DofState, ConstraintsDofScene>

const BUTTONS: Record<ConsId, string> = byLocale(
  {
    h: "下边水平",
    v: "左边竖直",
    par: "上下平行",
    perp: "右边垂直",
    org: "重合原点",
    w: `宽 ${WIDTH}`,
    ht: `高 ${HEIGHT}`,
    eq: "左边 = 下边",
    topSame: `上边 ${WIDTH}`,
    topOther: `上边 ${WIDTH + 10}`,
  },
  {
    h: "Bottom horizontal",
    v: "Left vertical",
    par: "Top ∥ bottom",
    perp: "Right ⊥ bottom",
    org: "Coincident with origin",
    w: `Width ${WIDTH}`,
    ht: `Height ${HEIGHT}`,
    eq: "Left = bottom",
    topSame: `Top ${WIDTH}`,
    topOther: `Top ${WIDTH + 10}`,
  },
)

function AddButtons({ s, c, ids, disabled }: Ctx & { ids: ConsId[]; disabled?: (id: ConsId) => boolean }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ids.map((id) => (
        <Button key={id} size="sm" variant="secondary" disabled={s.solver !== "ready" || s.cons.includes(id) || disabled?.(id)} onClick={() => c.add(id)}>
          {BUTTONS[id]}
        </Button>
      ))}
    </div>
  )
}

function SolverState({ s }: { s: DofState }) {
  if (s.solver === "loading") return <Hint>{t("正在载入求解器…", "Loading the solver…")}</Hint>
  if (s.solver === "failed") return <Hint tone="warning">{t("求解器没有载入，刷新页面再试一次。", "The solver didn't load. Reload the page and try again.")}</Hint>
  return null
}

function ConstraintList({ s, c }: Ctx) {
  return (
    <div className="mt-4 rounded-lg border p-1.5">
      <div className="px-2 pb-1 pt-0.5 text-caption text-faint-foreground">{t("草图1 的约束", "Constraints in Sketch1")}</div>
      {s.cons.map((id) => {
        const bad = s.flagged.includes(id)
        return (
          <div key={id} className={cn("flex h-8 items-center gap-2 rounded-sm pl-2 text-small", bad && (s.status === "conflict" ? "bg-destructive-subtle text-destructive" : "bg-warning-subtle text-warning"))}>
            <span className="min-w-0 flex-1 truncate">{CONS_NAMES[id]}</span>
            <IconButton label={t("删除约束", "Delete constraint")} size="icon-sm" onClick={() => c.remove(id)}>
              <X />
            </IconButton>
          </div>
        )
      })}
    </div>
  )
}

function OverHint({ s }: { s: DofState }) {
  if (s.status === "conflict")
    return (
      <Hint tone="warning">
        {t(
          "求解失败：标红的约束互相矛盾，草图没有解。删掉其中任意一条都能解开，但该删的通常是最后加的那条。SOLIDWORKS 把这种状态叫「过定义」，FreeCAD 叫「冲突约束」。",
          "The solve failed: the constraints marked in red contradict each other, so the sketch has no solution. Deleting any one of them fixes it, but the one to delete is usually the one you added last. SOLIDWORKS calls this state “Over Defined”; FreeCAD calls it “conflicting constraints”.",
        )}
      </Hint>
    )
  if (s.status === "redundant")
    return (
      <Hint tone="warning">
        {byLocale(
          <>「上边 {WIDTH}」和已有约束说的是同一件事：形状没变，自由度还是 0，但这条是多余的（FreeCAD 叫「冗余约束」，SOLIDWORKS 同样报过定义）。以后改宽度，它就会变成冲突。删掉它。</>,
          <>
            “Top {WIDTH}” says the same thing as constraints you already have. The shape didn't change and the DOF is still 0, but this one is redundant (FreeCAD calls it a “redundant constraint”; SOLIDWORKS reports Over Defined here too). Change the width later and it
            turns into a conflict. Delete it.
          </>,
        )}
      </Hint>
    )
  if (s.triedConflict && s.cons.includes("topOther") && s.dof === 0)
    return (
      <Hint>
        {byLocale(
          <>草图又能解了，但形状变了：「上边 {WIDTH + 10}」留了下来，被删掉的那条不再起作用。删哪一条，决定留下哪个设计意图。</>,
          <>The sketch solves again, but the shape has changed: “Top {WIDTH + 10}” stayed, and the one you deleted no longer applies. Which one you delete decides which design intent survives.</>,
        )}
      </Hint>
    )
  if (s.triedConflict && s.dof === 0) return <Hint>{t("恢复完全定义：自由度 0，没有多余约束。", "Fully defined again: 0 DOF and no redundant constraints.")}</Hint>
  return null
}

const SCHEMES: { value: Scheme; label: string }[] = [
  { value: "corner", label: t("角点定位", "Located by corner") },
  { value: "sym", label: t("关于原点对称", "Symmetric about origin") },
  { value: "ratio", label: t("高随宽变", "Height follows width") },
]

const SCHEME_TEXT: Record<Scheme, string> = byLocale(
  {
    corner: "左下角用两个尺寸定在原点左下方 30、20 处，再标宽和高。改宽度，矩形只往右长，左边不动。适合左边要贴着别的零件的情况。",
    sym: "对角两点关于原点对称，再标宽和高。改宽度，左右各长一半，中心一直在原点。对称零件这样画，后面镜像、装配都以原点为基准。",
    ratio: "角点和宽度同第一种，但高不标数值，用方程绑在宽上：高 = 宽 × 2/3。改宽度，往右、往上一起长，比例不变。软件里叫「方程式」或「用户参数」。",
  },
  {
    corner:
      "Two dimensions place the lower-left corner 30 to the left of and 20 below the origin; then the width and height are dimensioned. Change the width and the rectangle grows only to the right, while the left side stays put. Good for when the left side has to sit against another part.",
    sym: "Two opposite corners are symmetric about the origin; then the width and height are dimensioned. Change the width and each side grows by half, with the center always at the origin. Draw a symmetric part this way, and later mirrors and assembly can all use the origin as their reference.",
    ratio:
      "The corner and the width are set as in the first scheme, but the height gets no value: an equation ties it to the width, height = width × 2/3. Change the width and the rectangle grows right and up together, keeping its proportions. CAD packages call this “equations” or “user parameters”.",
  },
)

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="h-0.5 w-5 rounded-full bg-primary" />
      <span>{t("蓝色：欠定义，还能动", "Blue: under-defined, can still move")}</span>
      <span className="h-0.5 w-5 rounded-full bg-foreground" />
      <span>{t("黑色：完全定义，自由度为 0", "Black: fully defined, 0 degrees of freedom")}</span>
      <span className="h-2 w-5 rounded-xs bg-destructive" />
      <span>{t("红色标签：互相冲突的约束", "Red tags: constraints that conflict with each other")}</span>
    </div>
  )
}

const lesson: LessonDef<DofState, ConstraintsDofScene> = {
  id: "constraints-dof",
  codes: ["1.1.2", "1.1.3"],
  title: t("几何约束与自由度", "Geometric constraints and degrees of freedom"),
  create: (v, emit) => new ConstraintsDofScene(v, emit),
  steps: [
    {
      title: t("自由度：草图还能怎么动", "Degrees of freedom: how the sketch can still move"),
      body: byLocale(
        <>
          <p>草图里的每个点，在平面上能横着动、竖着动：2 个自由度。这个四边形有 4 个角点，一共 8 个自由度。</p>
          <p>左上角的数字不是写死的，是 FreeCAD 的草图求解器 planegcs 实时算出来的。</p>
        </>,
        <>
          <p>Every point in a sketch can move across and up or down in its plane: 2 degrees of freedom. This quadrilateral has 4 corners, so 8 degrees of freedom in all.</p>
          <p>The number at the top left isn't hard-coded: planegcs, FreeCAD's sketch solver, computes it live.</p>
        </>,
      ),
      task: { label: t("拖动一个蓝色角点，把四边形改个样子", "Drag a blue corner to change the quadrilateral's shape"), done: (s) => s.draggedOn.includes(0) },
      extra: ({ s }) => (
        <>
          <SolverState s={s} />
          {s.solver === "ready" && s.loadMs != null && (
            <div className="mt-3">
              <Readout label={t("求解器载入", "Solver load time")} value={s.loadMs} unit="ms" />
            </div>
          )}
          <Predict
            question={t("一条两端都没有约束的线段，有几个自由度？", "How many degrees of freedom does a line segment have when neither end is constrained?")}
            options={byLocale(["2 个：它只能平移", "3 个：位置加角度", "4 个：两个端点各 2 个"], ["2: it can only translate", "3: position plus angle", "4: 2 for each endpoint"])}
            answer={2}
            explain={t(
              "线段由两个端点决定，每个 2 个，共 4 个；换个说法是位置 2 个、角度 1 个、长度 1 个。4 条互不相连的线有 16 个自由度，首尾相连的 4 处「重合」各消掉 2 个，所以这里剩 8 个。",
              "A segment is set by its two endpoints, 2 each, so 4 in all; put another way, 2 for position, 1 for angle and 1 for length. Four unconnected lines have 16 degrees of freedom. Joining them end to end takes 4 “coincident” constraints, each removing 2, so 8 are left here.",
            )}
          />
        </>
      ),
      terms: ["sketch"],
    },
    {
      title: t("几何约束：先定关系", "Geometric constraints: relationships first"),
      body: byLocale(
        <>
          <p>几何约束描述的是关系：水平、竖直、平行、垂直。它们不带任何数值。</p>
          <p>每加一条，求解器就把形状挪到满足它的位置，自由度减 1。</p>
        </>,
        <>
          <p>Geometric constraints describe relationships: horizontal, vertical, parallel, perpendicular. They carry no values at all.</p>
          <p>Each time you add one, the solver moves the shape until it satisfies the constraint, and the degrees of freedom drop by 1.</p>
        </>,
      ),
      task: { label: t("把下面 4 条约束都加上", "Add all 4 constraints below"), done: (s) => GEO.every((id) => s.cons.includes(id)) },
      extra: (ctx) => (
        <>
          <SolverState s={ctx.s} />
          <AddButtons {...ctx} ids={GEO} />
          {GEO.every((id) => ctx.s.cons.includes(id)) && (
            <Hint>
              {t(
                "现在它一定是矩形，但还能整体移动、改宽改高：剩下的 4 个自由度是位置 2 个、大小 2 个。拖一下角点看看。",
                "Now it has to be a rectangle, but it can still move as a whole and change its width and height: the 4 degrees of freedom left are 2 for position and 2 for size. Drag a corner and see.",
              )}
            </Hint>
          )}
        </>
      ),
      note: t(
        "画矩形时，软件通常会自动加上水平、竖直这类约束。这里一条条手动加，是为了看清每条各消掉 1 个自由度。",
        "When you draw a rectangle, the software usually adds constraints such as horizontal and vertical for you. Here you add them by hand, one at a time, to see that each one removes 1 degree of freedom.",
      ),
    },
    {
      title: t("定位：挂到原点", "Position: anchor it to the origin"),
      body: byLocale(
        <>
          <p>位置也要约束。把左下角「重合」到原点，横向、纵向 2 个自由度一起消掉。</p>
          <p>原点是固定的，草图从此有了锚点。</p>
        </>,
        <>
          <p>Position needs constraining too. Make the lower-left corner “coincident” with the origin, and the 2 degrees of freedom, across and up-down, go at once.</p>
          <p>The origin is fixed, so from now on the sketch has an anchor.</p>
        </>,
      ),
      task: { label: t("添加「重合到原点」，再拖一下右上角", "Add “Coincident with origin”, then drag the top right corner"), done: (s) => s.cons.includes("org") && s.draggedOn.includes(2) },
      extra: (ctx) => (
        <>
          <AddButtons {...ctx} ids={["org"]} />
          {ctx.s.cons.includes("org") && (
            <Hint>{t("左下角拖不动了，它钉在原点上。其他角点还能动，但只能改宽和高。", "The lower-left corner won't drag any more: it's pinned to the origin. The other corners can still move, but only to change the width and height.")}</Hint>
          )}
        </>
      ),
      note: t(
        "没挂到原点或其他已有几何上的草图，永远是欠定义：在 SOLIDWORKS 里一直是蓝色，改模型时它可能被拖跑。",
        "A sketch that isn't tied to the origin or to other existing geometry is always under-defined: in SOLIDWORKS it stays blue, and it can get dragged out of place when the model changes.",
      ),
    },
    {
      title: t("尺寸：定大小", "Dimensions: set the size"),
      body: byLocale(
        <>
          <p>剩下 2 个自由度：宽和高。尺寸约束给出具体数值。</p>
          <p>最后一个不一定非用尺寸：「相等」也行，它让左边等于下边。自由度到 0，线条变黑，草图完全定义。</p>
        </>,
        <>
          <p>2 degrees of freedom are left: width and height. Dimensional constraints give them actual values.</p>
          <p>The last one needn't be a dimension: “Equal” works too, making the left side equal to the bottom. At 0 degrees of freedom the lines turn black, and the sketch is fully defined.</p>
        </>,
      ),
      task: { label: t("让自由度变成 0", "Bring the degrees of freedom down to 0"), done: (s) => s.dof === 0 && s.status === "ok" && s.cons.includes("w") },
      extra: (ctx) => {
        const { s } = ctx
        const defined = s.dof === 0 && s.status === "ok"
        return (
          <>
            <AddButtons {...ctx} ids={["w", "ht", "eq"]} disabled={(id) => (id === "ht" && s.cons.includes("eq")) || (id === "eq" && s.cons.includes("ht")) || (defined && !s.cons.includes(id))} />
            {defined && (
              <Hint>
                {s.cons.includes("eq") ? t("用「相等」代替了高度尺寸，得到一个正方形。", "“Equal” took the place of the height dimension, giving a square. ") : ""}
                {s.locked
                  ? t("完全定义的草图拖不动：形状只由约束和尺寸决定。想改大小，就改尺寸。", "A fully defined sketch can't be dragged: only the constraints and dimensions decide its shape. To change the size, change a dimension.")
                  : t("试着拖一下角点。", "Try dragging a corner.")}
              </Hint>
            )}
            <Legend />
          </>
        )
      },
    },
    {
      title: t("过定义：多一条就矛盾", "Over-defined: one constraint too many"),
      body: byLocale(
        <>
          <p>草图已经完全定义，再加约束就是「过定义」。它分两种：</p>
          <p>多余的：和已有约束说的是同一件事。冲突的：和已有约束互相矛盾，无解。</p>
        </>,
        <>
          <p>Once the sketch is fully defined, adding another constraint makes it “over-defined”. There are two kinds:</p>
          <p>Redundant: it says the same thing as constraints already there. Conflicting: it contradicts them, and there is no solution.</p>
        </>,
      ),
      task: {
        label: t(`先加「上边 ${WIDTH + 10}」看冲突，再删掉一条，让草图恢复完全定义`, `Add “Top ${WIDTH + 10}” to see a conflict, then delete one constraint so the sketch is fully defined again`),
        done: (s) => s.triedConflict && s.status === "ok" && s.dof === 0,
      },
      extra: (ctx) => (
        <>
          <Predict
            question={t(`草图已经完全定义，再加一个「上边 = ${WIDTH + 10}」，会怎样？`, `The sketch is already fully defined. What happens if you add “top = ${WIDTH + 10}”?`)}
            options={byLocale(
              [`上边变成 ${WIDTH + 10}，下边也跟着变成 ${WIDTH + 10}`, "求解失败：软件报过定义，列出互相冲突的约束", `上边 ${WIDTH + 10}、下边 ${WIDTH}，变成梯形`],
              [
                `The top becomes ${WIDTH + 10}, and the bottom follows to ${WIDTH + 10}`,
                "The solve fails: the software reports the sketch as over-defined and lists the conflicting constraints",
                `Top ${WIDTH + 10} and bottom ${WIDTH}: it turns into a trapezoid`,
              ],
            )}
            answer={1}
            explain={t(
              `下边已经是 ${WIDTH}，上边又必须和它平行、两侧竖直垂直，上边只能是 ${WIDTH}。${WIDTH + 10} 和这些约束矛盾，求解器解不出来，就把卷进冲突的约束全部列出来。`,
              `The bottom is already ${WIDTH}, and the top has to be parallel to it, with the sides vertical and perpendicular, so the top can only be ${WIDTH}. ${WIDTH + 10} contradicts those constraints. The solver can't find a solution, so it lists every constraint involved in the conflict.`,
            )}
            onReveal={() => ctx.c.add("topOther")}
          />
          <AddButtons {...ctx} ids={["topSame", "topOther"]} />
          <OverHint s={ctx.s} />
          <ConstraintList {...ctx} />
        </>
      ),
    },
    {
      title: t("设计意图：一个形状，三种约束", "Design intent: one shape, three ways to constrain it"),
      body: byLocale(
        <>
          <p>下面三种方案画出来都是 60 × 40 的矩形，自由度都是 0。区别出在改尺寸的时候：形状往哪边长，取决于你约束了什么。</p>
        </>,
        <>
          <p>The three schemes below all draw a 60 × 40 rectangle with 0 degrees of freedom. The difference shows when you change a dimension: which way the shape grows depends on what you constrained.</p>
        </>,
      ),
      task: { label: t("在三种方案下各改一次宽度", "Change the width once in each of the three schemes"), done: (s) => s.tried.length === 3 },
      extra: ({ s, c }) => (
        <>
          <Segmented className="mt-3" size="sm" value={s.scheme} onValueChange={(v) => c.setScheme(v)} options={SCHEMES} aria-label={t("约束方案", "Constraint scheme")} />
          <p className="mt-3 text-body">{SCHEME_TEXT[s.scheme]}</p>
          <ParamSlider className="mt-3 px-0" label={t("宽度", "Width")} value={s.width} min={40} max={100} onChange={(v) => c.setWidth(v)} hint={t("虚线是改之前的矩形。", "The dashed outline is the rectangle before the change.")} />
          <div className="mt-2 text-small text-muted-foreground">
            {t("已试：", "Tried: ")}
            {s.tried.length ? s.tried.map((id) => SCHEMES.find((x) => x.value === id)?.label).join(t("、", ", ")) : t("无", "none")}
          </div>
        </>
      ),
      note: t(
        "三种都对，选哪种取决于这个尺寸改的时候你希望哪里不动。把这个想清楚再加约束，就是「设计意图」。",
        "All three are correct. Which to choose depends on what you want to stay put when this dimension changes. Thinking that through before you add constraints is “design intent”.",
      ),
    },
  ],
  quiz: [
    {
      q: t("一个没有任何约束的圆，有几个自由度？", "How many degrees of freedom does a circle with no constraints have?"),
      options: byLocale(
        ["2 个：圆心的位置", "3 个：圆心横向、纵向，加半径", "4 个：和线段一样"],
        ["2: the position of the center", "3: the center across and up-down, plus the radius", "4: the same as a line segment"],
      ),
      answer: 1,
      explain: t(
        "圆由圆心和半径决定：圆心 2 个，半径 1 个。只记圆心会漏掉大小；线段的 4 个来自两个端点，圆没有第二个点。",
        "A circle is set by its center and its radius: 2 for the center, 1 for the radius. Counting only the center misses the size; a segment's 4 come from its two endpoints, and a circle has no second point.",
      ),
    },
    {
      q: t(
        "草图自由度已经是 0，又加了一个和现有约束完全一致的尺寸，会怎样？",
        "The sketch is already at 0 degrees of freedom, and you add a dimension that agrees exactly with the existing constraints. What happens?",
      ),
      options: byLocale(
        ["没有影响，多加更保险", "过定义：这条约束是冗余的，应该删掉", "自由度变成 −1，形状被拉坏"],
        ["Nothing; one more makes it safer", "Over-defined: this constraint is redundant and should be deleted", "The degrees of freedom go to −1 and the shape gets pulled apart"],
      ),
      answer: 1,
      explain: t(
        "冗余约束不改变形状，但软件会报过定义（FreeCAD 叫冗余约束）。以后改其中一个尺寸，它们就会互相冲突。完全定义的标准是自由度 0 且没有多余约束。",
        "A redundant constraint doesn't change the shape, but the software reports the sketch as over-defined (FreeCAD calls it a redundant constraint). Change one of those dimensions later, and they conflict. Fully defined means 0 degrees of freedom and no redundant constraints.",
      ),
    },
    {
      q: t(
        "一块对称的面板，宽度以后经常要改，而且希望它始终居中。草图怎么约束最好？",
        "A symmetric panel's width will change often, and the panel should always stay centered. What's the best way to constrain its sketch?",
      ),
      options: byLocale(
        ["左下角重合到原点，标宽和高", "关于原点对称，标宽和高", "先不加约束，要改的时候拖一下"],
        ["Lower-left corner coincident with the origin, then dimension width and height", "Symmetric about the origin, then dimension width and height", "No constraints for now; drag it when it needs changing"],
      ),
      answer: 1,
      explain: t(
        "对称约束让宽度变化平均分到两边，中心一直在原点。角点定位的方案改宽度时只往一边长；不加约束的草图拖完就没有确定的形状，下游特征也跟着不可靠。",
        "A symmetric constraint splits any change in width evenly between the two sides, so the center stays at the origin. With the corner-located scheme, a wider panel grows in one direction only; an unconstrained sketch has no definite shape after dragging, so the features downstream become unreliable too.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "自由度就是草图还能怎么动：点 2 个、线段 4 个、圆 3 个，每条约束消掉一部分",
      "几何约束管关系，尺寸约束管数值；自由度为 0 且没有多余约束，才算完全定义",
      "过定义分冗余和冲突；同一个形状有多种约束方案，按「改的时候哪里不动」来选",
    ],
    [
      "Degrees of freedom are the ways a sketch can still move: 2 for a point, 4 for a line segment, 3 for a circle, and each constraint removes some",
      "Geometric constraints set relationships, dimensional constraints set values; a sketch is fully defined only at 0 degrees of freedom with no redundant constraints",
      "Over-defined means redundant or conflicting; one shape can be constrained several ways, so choose by “what stays put when it changes”",
    ],
  ),
  next: {
    to: "/lesson/sketch-to-solid",
    label: t("从草图到实体", "From sketch to solid"),
    text: t("把完全定义的草图拉伸成实体，再改一个尺寸看下游怎么跟着变。", "Extrude a fully defined sketch into a solid, then change a dimension and watch what's downstream follow."),
  },
  overlay: ({ s }) => (
    <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
      <SceneChip>
        <PenLine className="text-primary" />
        {t("草图1 · 上视基准面 XY", "Sketch1 · Top plane XY")}
      </SceneChip>
      <DofChip s={s} />
    </div>
  ),
}

function DofChip({ s }: { s: DofState }) {
  if (s.solver === "loading") return <SceneChip className="text-muted-foreground">{t("求解器载入中", "Loading solver")}</SceneChip>
  if (s.solver === "failed") return <SceneChip className="text-destructive">{t("求解器没载入", "Solver didn't load")}</SceneChip>
  if (s.status === "conflict") return <SceneChip className="text-destructive">{t("过定义 · 冲突", "Over-defined · conflicting")}</SceneChip>
  if (s.status === "redundant") return <SceneChip className="text-warning">{t("过定义 · 冗余", "Over-defined · redundant")}</SceneChip>
  if (s.dof === 0) return <SceneChip>{t("完全定义", "Fully defined")}</SceneChip>
  return <SceneChip tone="primary">{byLocale(<>自由度 {s.dof}</>, <>DOF {s.dof}</>)}</SceneChip>
}

export default lesson
