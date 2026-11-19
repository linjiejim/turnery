import { EyeOff, RotateCcw, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { OpIcon } from "@/components/op-icon"
import { Hint, Predict, Readout } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { C, HOLE, R } from "./feature-tree.model"
import { DEFAULT_DEPTH, derive, FEATURES, FeatureTreeScene, type FtState } from "./feature-tree.scene"
import type { LessonDef, StepDef } from "./types"

/** 1.3.1 · 1.3.2 · 1.3.3 「特征树、父子关系与拓扑命名」. */

function Legend({ modified = true }: { modified?: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-primary" />
      <span>{t("这个特征生成的面", "Faces this feature created")}</span>
      {modified && (
        <>
          <span className="size-3 rounded-xs bg-scene-modified" />
          <span>{t("这个特征改动过的面（被切、被裁短）", "Faces this feature changed (cut into or trimmed)")}</span>
        </>
      )}
    </div>
  )
}

const STEPS: StepDef<FtState, FeatureTreeScene>[] = [
  {
    title: t("模型是一串特征", "A model is a list of features"),
    body: byLocale(
      <>
        <p>参数化模型不是一块「形状」，而是一串按顺序执行的操作：先拉伸出方块，再打孔，再倒圆角，最后倒角。左上角的特征树就是这串操作。</p>
        <p>每次改参数，软件都从上往下把这串操作重算一遍。所以特征树更像一段程序，模型是它的运行结果。</p>
      </>,
      <>
        <p>A parametric model isn't a “shape” but a list of operations run in order: extrude a block, then make a hole, then a fillet, and last a chamfer. The feature tree at the top left is that list.</p>
        <p>Every time you change a parameter, the software reruns the list from the top. So a feature tree is more like a program, and the model is what you get when it runs.</p>
      </>,
    ),
    task: {
      label: t("点特征树里的两个特征（或直接点模型上的面），看它们各自生成了哪些面", "Click two features in the feature tree (or faces on the model) to see which faces each one created"),
      done: (s) => s.seen.length >= 2,
    },
    extra: () => <Legend />,
    terms: ["extrude", "hole", "fillet", "chamfer"],
  },
  {
    title: t("回滚：倒回去看", "Rollback: step back and look"),
    body: byLocale(
      <>
        <p>回滚条把特征树「停」在某一行：它下面的特征暂时不算，模型回到当时的样子。特征没有被删除，拖回去就又回来了。</p>
        <p>回滚之后再加的新特征，会插在回滚条的位置，而不是树的最后。</p>
      </>,
      <>
        <p>The rollback bar “stops” the feature tree at a row: the features below it are skipped for now, and the model goes back to how it was at that point. Nothing is deleted; drag the bar back down and the features return.</p>
        <p>A new feature you add while rolled back goes in at the rollback bar, not at the end of the tree.</p>
      </>,
    ),
    task: { label: t("把回滚条退到「孔1」，再拉回最后", "Roll the bar back to “Hole1”, then drag it back to the end"), done: (s) => s.triedRollback && s.upTo === 4 },
    extra: ({ s, c }) => (
      <>
        <div className="mt-4 space-y-2">
          <div className="text-small font-medium">{t("回滚条停在", "Rollback bar at")}</div>
          <Segmented
            size="sm"
            value={String(s.upTo)}
            onValueChange={(v) => c.rollTo(Number(v))}
            options={FEATURES.map((f, i) => ({ value: String(i + 1), label: f.name }))}
            aria-label={t("回滚条位置", "Rollback bar position")}
          />
        </div>
        <Hint>
          {t(
            "高亮的是回滚条上方最后一个特征：蓝色是它新生成的面，橙色是它改动过的面。也可以直接点特征树里的行。",
            "The highlight is on the last feature above the rollback bar: blue for the faces it created, orange for the faces it changed. You can also click the rows in the feature tree.",
          )}
        </Hint>
      </>
    ),
    note: t(
      "SOLIDWORKS 叫「退回控制棒」，在 FeatureManager 设计树底部；Fusion 拖动时间轴末端的标记；Onshape 拖动特征列表里的回滚条。",
      "SOLIDWORKS has a rollback bar at the bottom of the FeatureManager design tree; in Fusion you drag the marker at the end of the timeline; in Onshape you drag the rollback bar in the Feature list.",
    ),
  },
  {
    title: t("父子关系：谁引用了谁", "Parent and child: what references what"),
    body: byLocale(
      <>
        <p>特征树右边的箭头是引用关系：孔1 画在拉伸1 的顶面上，圆角1 选了拉伸1 的一条边，倒角1 选的是圆角1 和右端面相交的那条圆弧边。被引用的是父，引用别人的是子。</p>
        <p>改动或删掉父特征，子特征就要重新找参考。找不到，就是重建错误。</p>
      </>,
      <>
        <p>
          The arrows on the right of the feature tree are references: Hole1 sits on the top face of Extrude1, Fillet1 uses an edge of Extrude1, and Chamfer1 uses the arc edge where Fillet1 meets the right end face. The feature being referenced is the parent;
          the one that references it is the child.
        </p>
        <p>Change or delete a parent, and its children have to find their references again. If they can't, that's a rebuild error.</p>
      </>,
    ),
    task: { label: t("压缩圆角1，看哪个特征出错", "Suppress Fillet1 and see which feature fails"), done: (s) => s.triedSuppress },
    extra: ({ s, c }) => (
      <>
        <Predict
          question={t("把圆角1 压缩掉（暂时不算），哪个特征会出错？", "Suppress Fillet1 (skip it for now). Which feature fails?")}
          options={byLocale(
            ["孔1，它在圆角1 前面", "倒角1，它用的边是圆角1 生成的", "都不会，软件会自动处理"],
            ["Hole1, because it comes before Fillet1", "Chamfer1, because the edge it uses was made by Fillet1", "Neither: the software sorts it out automatically"],
          )}
          answer={1}
          explain={t(
            "出错的只有引用了圆角1 的子特征。孔1 在圆角1 之前，只引用拉伸1，完全不受影响。",
            "Only the children that reference Fillet1 fail. Hole1 comes before Fillet1 and references only Extrude1, so it isn't affected at all.",
          )}
          onReveal={() => c.suppressFillet(true)}
        />
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => c.suppressFillet(!s.filletSuppressed)}>
            {s.filletSuppressed ? <RotateCcw /> : <EyeOff />}
            {s.filletSuppressed ? t("恢复圆角1", "Unsuppress Fillet1") : t("压缩圆角1", "Suppress Fillet1")}
          </Button>
        </div>
        {s.filletSuppressed && (
          <Hint tone="warning">
            {t(
              "倒角1 要的那条圆弧边不存在了，它没法生成，在特征树里变红。SOLIDWORKS 会标出重建错误，Fusion 时间轴上的图标变红，Onshape 特征列表里的名字变红。",
              "The arc edge Chamfer1 needs no longer exists, so it can't be built and turns red in the feature tree. SOLIDWORKS flags a rebuild error, Fusion turns its icon in the timeline red, and Onshape turns its name red in the Feature list.",
            )}
          </Hint>
        )}
      </>
    ),
    note: t(
      "压缩（Suppress）是暂时跳过一个特征，随时能恢复；删除才是真的去掉。想知道删一个特征会牵连谁，先压缩试试。",
      "Suppressing a feature skips it for now, and you can unsuppress it at any time; deleting really removes it. To find out what deleting a feature would drag down with it, suppress it first.",
    ),
    noteTitle: t("压缩和删除", "Suppress vs. delete"),
  },
  {
    title: t("拓扑命名：边换了名字", "Topological naming: an edge changes its name"),
    body: byLocale(
      <>
        <p>软件记住「倒角1 用的是哪条边」，靠的是给面和边起的内部名字，比如 Edge7。上游一变，模型重算，面和边可能被重新编号。</p>
        <p>这里孔1 是 {HOLE.depth} mm 深的盲孔。拉伸变薄到 {HOLE.depth} mm 以下，孔就打穿了底面，多出一圈新的边，后面的编号跟着变了。</p>
      </>,
      <>
        <p>
          The software remembers “which edge Chamfer1 uses” by the internal names it gives faces and edges, such as Edge7. When something upstream changes, the model is recomputed, and the faces and edges may be numbered differently.
        </p>
        <p>
          Here Hole1 is a blind hole {HOLE.depth} mm deep. Make the extrude {HOLE.depth} mm thick or less, and the hole breaks through the bottom face: a new loop of edges appears, and the numbers after it shift.
        </p>
      </>,
    ),
    task: { label: t(`把拉伸1 的深度改到 ${HOLE.depth} mm 以下`, `Change Extrude1's depth to ${HOLE.depth} mm or less`), done: (s) => s.depth <= HOLE.depth },
    extra: ({ s, c }) => (
      <>
        <Predict
          question={t("改了拉伸深度，倒角还在原来的边上吗？", "Once the extrude depth has changed, is the chamfer still on its original edge?")}
          options={byLocale(
            ["在，倒角跟着那条边走", "不一定：边被重新编号，倒角可能跳到别的边上", "倒角会被自动删掉"],
            ["Yes: the chamfer follows that edge", "Not necessarily: the edges get renumbered, and the chamfer may jump to a different edge", "The chamfer is deleted automatically"],
          )}
          answer={1}
          explain={t(
            "倒角记住的是编号 Edge7。重算之后 Edge7 指向了左端的边，倒角就做在了那里，而且不报错。这就是拓扑命名问题（TNP）。",
            "The chamfer remembers the number Edge7. After the rebuild, Edge7 points to the edge at the left end, so that's where the chamfer goes, without any error. This is the topological naming problem (TNP).",
          )}
          onReveal={() => c.setDepth(16)}
        />
        <ParamSlider
          className="mt-3 px-0"
          label={t("拉伸1 · 深度", "Extrude1 · depth")}
          value={s.depth}
          min={12}
          max={40}
          onChange={(v) => c.setDepth(v)}
          hint={t(`孔1 深 ${HOLE.depth} mm，从顶面往下量。`, `Hole1 is ${HOLE.depth} mm deep, measured down from the top face.`)}
        />
        {derive(s).wrongEdge && (
          <Hint tone="warning">
            {t(
              "比报错更糟：倒角悄悄换了位置，模型看起来没问题。虚线是本来想倒的边。",
              "Worse than an error: the chamfer has quietly moved, and the model looks fine. The dashed line is the edge you meant to chamfer.",
            )}
          </Hint>
        )}
      </>
    ),
    note: t(
      "这里用最朴素的方式演示：只按编号记边。FreeCAD 1.0 以前经常这样出错，1.0 加入了缓解算法但没有根治。SOLIDWORKS、Fusion、Onshape 的内部命名更稳，多数改动能跟住，但边被分割、合并或消失时，照样会丢参考或选错。",
      "This demo uses the crudest method: edges remembered by number alone. FreeCAD often went wrong this way before 1.0; version 1.0 added an algorithm that mitigates the problem but doesn't cure it. SOLIDWORKS, Fusion and Onshape name things more robustly and keep up with most changes, but when an edge is split, merged or disappears, they can still lose the reference or pick the wrong one.",
    ),
    noteTitle: t("各软件", "Across CAD packages"),
  },
  {
    title: t("选更稳的参考", "Choose references that hold up"),
    body: byLocale(
      <>
        <p>办法不是记住更多编号，而是让参考表达设计意图：「右端面和圆角面的交线」比「第 7 条边」稳得多，深度怎么改都指向同一条边。</p>
        <p>建模时的三条习惯：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>草图画在基准面上，少画在模型表面上。</li>
          <li>尺寸和位置参考原点、基准面和草图几何，少参考特征生成的边。</li>
          <li>圆角、倒角这类细节放在特征树最后，别让其他特征引用它们的边。</li>
        </ul>
      </>,
      <>
        <p>
          The cure isn't to remember more numbers but to make the reference express design intent: “where the right end face meets the fillet face” holds up far better than “edge number 7”, and points to the same edge however the depth changes.
        </p>
        <p>Three habits for modeling:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Draw sketches on datum planes rather than on model faces.</li>
          <li>Reference dimensions and positions to the origin, datum planes and sketch geometry rather than to edges that features create.</li>
          <li>Put details such as fillets and chamfers at the end of the feature tree, and don't let other features reference their edges.</li>
        </ul>
      </>,
    ),
    task: { label: t("把倒角1 的参考换成「右端面 ∩ 圆角面」", "Change Chamfer1's reference to “Right end face ∩ fillet face”"), done: (s) => s.refMode === "intent" && s.depth <= HOLE.depth },
    extra: ({ s, c }) => (
      <div className="mt-4 space-y-3">
        <div className="space-y-2">
          <div className="text-small font-medium">{t("倒角1 的参考", "Chamfer1's reference")}</div>
          <Segmented
            size="sm"
            value={s.refMode}
            onValueChange={(m) => c.setRefMode(m)}
            options={[
              { value: "index", label: t("按编号 Edge7", "By number: Edge7") },
              { value: "intent", label: t("右端面 ∩ 圆角面", "Right end face ∩ fillet face") },
            ]}
            aria-label={t("倒角1 的参考", "Chamfer1's reference")}
          />
        </div>
        <ParamSlider className="px-0" label={t("拉伸1 · 深度", "Extrude1 · depth")} value={s.depth} min={12} max={40} onChange={(v) => c.setDepth(v)} />
        {s.refMode === "intent" && (
          <Hint>
            {t(
              "换了参考，深度随便改，倒角都留在右端。但它仍然依赖圆角1：压缩圆角，它照样会断。这就是「细节放最后」的理由。",
              "With the new reference, change the depth all you like and the chamfer stays at the right end. But it still depends on Fillet1: suppress the fillet and it breaks just the same. That's the reason details go last.",
            )}
          </Hint>
        )}
      </div>
    ),
    note: t(
      "Onshape 按「哪个特征、哪条草图线生成了这个面」来记参考；Fusion 教程建议把圆角放到时间线最后；FreeCAD 建议参考基准面而不是生成的边。说法不同，原则一样。",
      "Onshape records a reference by “which feature, and which sketch line, created this face”; Fusion's tutorials advise putting fillets at the end of the timeline; FreeCAD advises referencing datum planes rather than generated edges. Different words, same principle.",
    ),
    noteTitle: t("各软件", "Across CAD packages"),
  },
]

const QUIZ = [
  {
    q: t("把回滚条拖到「圆角1」上方，模型会怎样？", "You drag the rollback bar to just above “Fillet1”. What happens to the model?"),
    options: byLocale(
      ["圆角1 和它后面的特征暂时不算，模型回到倒圆角之前", "圆角1 被删除了", "只有圆角1 不显示，倒角1 照常显示"],
      ["Fillet1 and the features after it are skipped for now, and the model goes back to before the fillet", "Fillet1 is deleted", "Only Fillet1 disappears; Chamfer1 still shows as usual"],
    ),
    answer: 0,
    explain: t(
      "回滚条下面的所有特征都暂停计算，什么也没删。倒角1 在圆角1 之后，也一起暂停。",
      "Every feature below the rollback bar is paused, and nothing is deleted. Chamfer1 comes after Fillet1, so it's paused too.",
    ),
  },
  {
    q: t("删掉圆角1 后，倒角1 报错。最可能的原因是？", "After you delete Fillet1, Chamfer1 reports an error. What's the most likely cause?"),
    options: byLocale(
      ["倒角和圆角不能出现在同一个零件上", "倒角1 引用了圆角1 生成的边，那条边不存在了", "删除任何特征都会让后面的特征全部失效"],
      ["A chamfer and a fillet can't be in the same part", "Chamfer1 references an edge that Fillet1 created, and that edge no longer exists", "Deleting any feature breaks every feature after it"],
    ),
    answer: 1,
    explain: t(
      "只有引用了被删特征的子特征会出错。孔1 不引用圆角1，删掉圆角它照常。看依赖关系，就能预测谁会断。",
      "Only the children that reference the deleted feature fail. Hole1 doesn't reference Fillet1, so it's fine without the fillet. Look at the dependencies and you can predict what will break.",
    ),
  },
  {
    q: t("哪种做法最不容易遇到拓扑命名问题？", "Which practice is least likely to run into the topological naming problem?"),
    options: byLocale(
      ["草图画在基准面上，圆角倒角放在最后", "草图画在最新生成的模型面上，方便对齐", "每次改完尺寸，把出错的下游特征删掉重画"],
      [
        "Sketches on datum planes, fillets and chamfers at the end",
        "Sketches on the newest model faces, so they're easy to line up",
        "After every dimension change, delete the failing downstream features and redraw them",
      ],
    ),
    answer: 0,
    explain: t(
      "基准面不会因为模型重算而改名；细节特征放在最后，就没有别的特征引用它们的边。删掉重画能救急，但下次改尺寸还会再断。",
      "Datum planes don't get renamed when the model is recomputed, and with detail features at the end, no other feature references their edges. Deleting and redrawing gets you out of trouble this time, but the next dimension change breaks it again.",
    ),
  },
]

/** The feature tree drawn as a dependency graph: rows are features, arcs are references. */
function FeatureGraph({ s, c }: { s: FtState; c: FeatureTreeScene }) {
  const d = derive(s)
  const ROW = 40
  const rows = [
    { key: "plane", name: t("上视基准面", "Top plane"), op: "plane" as const, caption: t("基准", "Datum"), fi: 0 },
    { key: "sketch1", name: t("草图1", "Sketch1"), op: "sketch" as const, caption: t("画在 上视基准面", "On the Top plane"), fi: 0 },
    { key: "extrude1", name: t("拉伸1", "Extrude1"), op: "extrude" as const, caption: t(`轮廓：草图1 · 深 ${s.depth}`, `Profile: Sketch1 · depth ${s.depth}`), fi: 1 },
    {
      key: "hole1",
      name: t("孔1", "Hole1"),
      op: "hole" as const,
      caption: t(`拉伸1 的顶面 · Ø${HOLE.r * 2} 深 ${HOLE.depth}`, `Top face of Extrude1 · Ø${HOLE.r * 2}, ${HOLE.depth} deep`),
      fi: 2,
    },
    { key: "fillet1", name: t("圆角1", "Fillet1"), op: "fillet" as const, caption: s.filletSuppressed ? t("已压缩", "Suppressed") : t(`拉伸1 的一条边 · R${R}`, `An edge of Extrude1 · R${R}`), fi: 3 },
    {
      key: "chamfer1",
      name: t("倒角1", "Chamfer1"),
      op: "chamfer" as const,
      caption: d.chamferError
        ? t("找不到 Edge7", "Can't find Edge7")
        : s.refMode === "intent"
          ? t("右端面 ∩ 圆角面", "Right end face ∩ fillet face")
          : d.wrongEdge
            ? t("Edge7 · 选错了边，没报错", "Edge7 · wrong edge, no error")
            : t(`圆角1 的边 Edge7 · ${C} mm`, `Fillet1's edge Edge7 · ${C} mm`),
      fi: 4,
    },
  ]
  const at = (key: string) => rows.findIndex((r) => r.key === key)
  const arrows: { from: string; to: string; tone?: "error" | "warning" }[] =
    s.step >= 2
      ? [
          { from: "plane", to: "sketch1" },
          { from: "sketch1", to: "extrude1" },
          { from: "extrude1", to: "hole1" },
          { from: "extrude1", to: "fillet1" },
          { from: "fillet1", to: "chamfer1", tone: d.chamferError ? "error" : d.wrongEdge ? "warning" : undefined },
          ...(s.refMode === "intent" ? [{ from: "extrude1", to: "chamfer1" }] : []),
        ]
      : []
  const interactive = s.step === 0 || s.step === 1
  const x0 = 0
  return (
    <div className="absolute left-3 top-3 w-64 rounded-lg border bg-popover p-1.5 shadow-popover">
      <div className="flex items-center justify-between px-2 pb-1 pt-0.5 text-caption text-faint-foreground">
        <span>{t("特征树", "Feature tree")}</span>
        {s.step >= 2 && <span>{t("箭头：父 → 子", "Arrows: parent → child")}</span>}
      </div>
      <div className="relative">
        {rows.map((r) => {
          const active = r.fi === 0 || r.fi <= s.upTo
          const focus = (s.step === 0 && s.selected === r.key) || (s.step === 1 && r.fi === s.upTo)
          const error = r.key === "chamfer1" && d.chamferError
          const warn = r.key === "chamfer1" && d.wrongEdge
          const suppressed = r.key === "fillet1" && s.filletSuppressed
          const Row = interactive && r.fi > 0 ? "button" : "div"
          return (
            <div key={r.key}>
              <Row
                type={Row === "button" ? "button" : undefined}
                onClick={
                  Row === "button"
                    ? () => (s.step === 0 ? c.select(FEATURES[r.fi - 1].id) : c.rollTo(r.fi))
                    : undefined
                }
                className={cn(
                  "flex w-[calc(100%-56px)] items-center gap-2 rounded-sm px-2 text-left [&_svg]:size-3.5",
                  Row === "button" && "hover:bg-accent",
                  focus && "bg-selected",
                  !active && "opacity-40",
                )}
                style={{ height: ROW }}
              >
                {error ? <TriangleAlert className="shrink-0 text-destructive" /> : <OpIcon op={r.op} className={cn("shrink-0", warn ? "text-warning" : "text-muted-foreground")} />}
                <span className="min-w-0">
                  <span className={cn("block text-small", error && "text-destructive", suppressed && "text-faint-foreground line-through")}>{r.name}</span>
                  <span className={cn("block truncate text-caption", error ? "text-destructive" : warn ? "text-warning" : "text-faint-foreground")}>{r.caption}</span>
                </span>
              </Row>
              {s.step === 1 && r.fi === s.upTo && <div className="mx-2 my-0.5 h-0.5 w-[calc(100%-72px)] rounded-full bg-primary" aria-label={t("回滚条", "Rollback bar")} />}
            </div>
          )
        })}
        {arrows.length > 0 && (
          <svg className="pointer-events-none absolute right-0 top-0 h-full w-14 overflow-visible" aria-hidden>
            {arrows.map((a) => {
              const i = at(a.from)
              const j = at(a.to)
              const y1 = i * ROW + ROW / 2
              const y2 = j * ROW + ROW / 2
              const k = 10 + (j - i) * 9 + (a.from === "extrude1" && a.to === "chamfer1" ? 8 : 0)
              const cls = a.tone === "error" ? "text-destructive" : a.tone === "warning" ? "text-warning" : "text-muted-foreground"
              return (
                <g key={`${a.from}-${a.to}`} className={cls} fill="none" stroke="currentColor" strokeWidth={1.25}>
                  <path d={`M ${x0 + 2} ${y1} C ${x0 + k} ${y1}, ${x0 + k} ${y2}, ${x0 + 2} ${y2}`} strokeDasharray={a.tone === "error" ? "3 3" : undefined} />
                  <path d={`M ${x0 + 7} ${y2 - 3.5} L ${x0 + 2} ${y2} L ${x0 + 7} ${y2 + 3.5}`} />
                </g>
              )
            })}
          </svg>
        )}
      </div>
      {s.step >= 3 && (
        <div className="border-t px-2 pt-1.5 text-caption text-muted-foreground">
          <Readout label={t("孔1", "Hole1")} value={s.depth <= HOLE.depth ? t("已打穿", "Through") : t("盲孔", "Blind")} tone={s.depth <= HOLE.depth ? "warning" : undefined} />
          {s.depth !== DEFAULT_DEPTH && <Readout label={t("深度", "Depth")} value={s.depth} unit="mm" />}
        </div>
      )}
    </div>
  )
}

const lesson: LessonDef<FtState, FeatureTreeScene> = {
  id: "feature-tree",
  codes: ["1.3.1", "1.3.2", "1.3.3"],
  title: t("特征树、父子关系与拓扑命名", "The feature tree, parent–child links and topological naming"),
  create: (v, emit) => new FeatureTreeScene(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: byLocale(
    [
      "特征树是按顺序重算的程序，回滚条决定算到哪一步",
      "子特征引用父特征的面和边：父特征变了或没了，子特征就要重新找参考，找不到就报错",
      "拓扑命名问题：上游一改，面和边会重新编号，下游可能悄悄选错；参考基准面和草图，细节特征放最后",
    ],
    [
      "A feature tree is a program rerun in order, and the rollback bar decides how far it runs",
      "Children reference their parents' faces and edges: when a parent changes or goes away, its children must find their references again, and fail if they can't",
      "The topological naming problem: change something upstream and faces and edges get renumbered, so downstream features may quietly pick the wrong ones. Reference datum planes and sketches, and put detail features last",
    ],
  ),
  next: {
    to: "/teardown/mug",
    label: t("马克杯拆解", "Mug teardown"),
    text: t("在一个真实零件上逐个特征回滚，看每一步生成了哪些面。", "Roll a real part back one feature at a time and see which faces each step created."),
  },
  overlay: ({ s, c }) => <FeatureGraph s={s} c={c} />,
}

export default lesson
