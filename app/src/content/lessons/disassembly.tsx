import { Recycle, RotateCcw, Wrench } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { Hint, Predict } from "@/components/lesson-ui"
import {
  DisassemblyScene,
  designKey,
  FASTENER_NAME,
  fullTally,
  ORIGINAL,
  partsFor,
  removable,
  tallyOf,
  TOOL_NAME,
  type Design,
  type DisState,
  type Tally,
} from "./disassembly.scene"
import type { LessonDef } from "./types"

/** 6.5.6 「可拆解与回收」: take a speaker apart, count what it costs, redesign, sort the parts. */

type Row = { key: keyof Tally | "toolsN" | "fastN"; label: string; value: (x: Tally) => string; better: (now: Tally, was: Tally) => boolean }
const ROWS: Row[] = [
  { key: "steps", label: t("拆卸步骤", "Removal steps"), value: (x) => String(x.steps), better: (a, b) => a.steps < b.steps },
  { key: "toolsN", label: t("工具", "Tools"), value: (x) => String(x.tools.length), better: (a, b) => a.tools.length < b.tools.length },
  { key: "fastN", label: t("紧固方式", "Fastening kinds"), value: (x) => String(x.fasteners.length), better: (a, b) => a.fasteners.length < b.fasteners.length },
  { key: "glued", label: t("胶接处", "Glued joints"), value: (x) => String(x.glued), better: (a, b) => a.glued < b.glued },
  { key: "mixed", label: t("分不开的混合材料", "Inseparable mixes"), value: (x) => String(x.mixed), better: (a, b) => a.mixed < b.mixed },
  { key: "marked", label: t("标了材料的塑料件", "Plastic parts marked"), value: (x) => `${x.marked} / ${x.plastics}`, better: (a, b) => a.marked > b.marked },
]

function TallyPanel({ s }: { s: DisState }) {
  const now = tallyOf(s.design, s.removed)
  const was = fullTally(ORIGINAL)
  const compare = s.step >= 2
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-72 rounded-lg border bg-popover p-3 shadow-popover">
      <div className="flex items-baseline justify-between text-small">
        <span className="font-medium">{t("拆一台要多少功夫", "What it takes to strip one")}</span>
        {compare && <span className="text-caption text-muted-foreground">{t("原设计", "Original")}</span>}
      </div>
      <div className="mt-2 space-y-1">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-baseline gap-2 text-small">
            <span className="flex-1 text-muted-foreground">{r.label}</span>
            <span className={cn("w-12 text-right font-mono font-medium tabular", compare && r.better(now, was) && "text-success")}>{r.value(now)}</span>
            {compare && <span className="w-12 text-right font-mono tabular text-faint-foreground">{r.value(was)}</span>}
          </div>
        ))}
      </div>
      {now.tools.length > 0 && (
        <div className="mt-2 border-t pt-2 text-caption text-muted-foreground">
          {t("工具：", "Tools: ")}
          {now.tools.map((x) => TOOL_NAME[x]).join(t("、", ", "))}
        </div>
      )}
      {now.fasteners.length > 0 && (
        <div className="text-caption text-muted-foreground">
          {t("紧固：", "Fastening: ")}
          {now.fasteners.map((x) => FASTENER_NAME[x]).join(t("、", ", "))}
        </div>
      )}
    </div>
  )
}

/** What was just clicked, or why it won't come off yet. */
function Inspector({ s, c }: { s: DisState; c: DisassemblyScene }) {
  const specs = partsFor(s.design)
  const p = specs.find((x) => x.id === s.inspected)
  const name = (id: string) => specs.find((x) => x.id === id)?.name ?? id
  return (
    <>
      {s.blocked && <Hint tone="warning">{t(`还拆不下来：先拆${s.blocked.needs.map(name).join("、")}。`, `Won't come off yet: first remove the ${s.blocked.needs.map(name).join(", ")}.`)}</Hint>}
      {p && !s.blocked && (
        <div className="mt-3 rounded-lg border p-3 text-small">
          <div className="font-medium text-body">{p.name}</div>
          <div className="mt-1 text-muted-foreground">
            {t("材料：", "Material: ")}
            {s.design.marks || !p.plastic ? p.material : t("没有标记，认不出", "unmarked, can't tell")}
          </div>
          <div className="text-muted-foreground">{p.how}</div>
          {p.tools.length > 0 && <div className="text-muted-foreground">{t("工具：", "Tools: ")}{p.tools.map((x) => TOOL_NAME[x]).join(t("、", ", "))}</div>}
          {p.id === "front" && !s.design.mono && (
            <div className="mt-1 text-destructive">{t("软胶是注塑时熔在 PC 上的，扯不下来。", "The soft TPE was moulded onto the PC; it won't pull off.")}</div>
          )}
        </div>
      )}
      <Button size="sm" variant="ghost" className="mt-2" disabled={s.playing || s.removed.length === 0} onClick={() => c.reassemble()}>
        <RotateCcw />
        {t("重新装上", "Put it back")}
      </Button>
    </>
  )
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button size="sm" variant={on ? "primary" : "secondary"} aria-pressed={on} onClick={onClick}>
      {children}
    </Button>
  )
}

function Redesign({ s, c, keys }: { s: DisState; c: DisassemblyScene; keys: (keyof Design)[] }) {
  const names: Record<keyof Design, string> = {
    oneScrew: t("统一螺钉", "One screw type"),
    snaps: t("卡扣代替胶", "Snaps, not glue"),
    mono: t("改单一材料", "Single material"),
    marks: t("标材料", "Mark materials"),
  }
  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {keys.map((k) => (
          <Toggle key={k} on={s.design[k]} onClick={() => c.setDesign({ [k]: !s.design[k] })}>
            {names[k]}
          </Toggle>
        ))}
      </div>
      <Button size="sm" variant="secondary" disabled={s.playing} onClick={() => c.replay()}>
        <Wrench />
        {t("再拆一遍", "Strip it again")}
      </Button>
    </div>
  )
}

const lesson: LessonDef<DisState, DisassemblyScene> = {
  id: "disassembly",
  codes: ["6.5.6"],
  title: t("可拆解与回收", "Design for disassembly"),
  create: (v, emit) => new DisassemblyScene(v, emit),
  steps: [
    {
      title: t("先拆一遍", "Take it apart first"),
      body: byLocale(
        <>
          <p>一台小音箱，电池不行了，或者到了寿命。点零件把它拆下来：顺序不对就拆不动。面板记着拆了几步、用了几种工具、碰到几种紧固方式、几处胶。</p>
          <p>修理的人和回收厂都要走一遍同样的路。拆得越费劲，越可能被整个丢进粉碎机，塑料混在一起。</p>
        </>,
        <>
          <p>A small speaker whose battery has died, or which has simply reached the end of its life. Click parts to take them off; in the wrong order they won't budge. The panel counts the steps, the tools, the kinds of fastening and the glued joints.</p>
          <p>Repairers and recyclers both have to follow the same path. The harder it is, the more likely the whole thing goes into a shredder, plastics and all.</p>
        </>,
      ),
      task: {
        label: t("把能拆的都拆下来", "Take off everything that comes off"),
        done: (s) => removable(s.design).every((id) => s.removed.includes(id)),
      },
      extra: ({ s, c }) => <Inspector s={s} c={c} />,
    },
    {
      title: t("哪里最费事", "Where it hurts"),
      body: byLocale(
        <>
          <p>标红的是胶接和分不开的材料。胶要加热、要撬，常常拆坏；粘死的电池最麻烦，撬破软包还可能起火。</p>
          <p>前壳是 PC 上包了一圈 TPE 软胶：两种塑料在模具里熔在一起，用机械方法分不开。</p>
        </>,
        <>
          <p>Red marks the glued joints and the materials that can't be separated. Adhesive needs heat and prying and often breaks things; a glued-in battery is the worst, and puncturing the pouch while prying can start a fire.</p>
          <p>The front housing is PC with a band of soft TPE moulded onto it: the two plastics fused in the mould, and no mechanical method parts them.</p>
        </>,
      ),
      task: { label: t("点前壳，试着把软胶分下来", "Click the front housing and try to get the soft band off"), done: (s) => s.triedFront },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("这样的前壳到了回收厂，最可能的结局是？", "At a recycling plant, what most likely happens to this front housing?")}
            options={byLocale(
              ["分成 PC 和 TPE，各自再生", "当混合料：降级使用或者焚烧", "整件直接拿去再用"],
              ["It's split into PC and TPE and each is recycled", "It goes as mixed plastic: downcycled or burned", "It's reused as is"],
            )}
            answer={1}
            explain={t(
              "两种塑料熔在一起，分不开，也很难认。混在一起的料性能差，通常只能降级使用或者焚烧回收能量。",
              "Fused together, the two plastics can't be separated and are hard to identify. Mixed plastic performs poorly, so it's usually downcycled or burned for energy.",
            )}
            onReveal={() => c.tryRemove("front")}
          />
          <Inspector s={s} c={c} />
        </>
      ),
    },
    {
      title: t("改紧固：一种螺钉，不用胶", "Fastening: one screw type, no glue"),
      body: byLocale(
        <>
          <p>螺钉统一成一种，一把螺丝刀就够。电池放进卡扣支架、用拉环取出；喇叭线改成插头；网罩改成卡扣。不用加热，也不用烙铁。</p>
          <p>法规也在往这边走：欧盟电池法规（EU）2023/1542 第 11 条要求，从 2027 年 2 月起，产品里的便携式电池要能由用户用市售工具拆换，不用加热或溶剂（有例外）。生态设计法规（EU）2024/1781 也把可维修、可回收列进了可以对产品提出要求的方面。</p>
        </>,
        <>
          <p>Use one kind of screw, so one screwdriver does it. Put the battery in a snap bracket with a pull tab, give the speaker wires a plug, snap the grille on. No heat, no soldering iron.</p>
          <p>Regulation is heading the same way: Article 11 of the EU Batteries Regulation (EU) 2023/1542 requires, from February 2027, that portable batteries in products be removable and replaceable by the user with commercially available tools, without heat or solvents (with exceptions). The Ecodesign for Sustainable Products Regulation (EU) 2024/1781 also lists reparability and recyclability among the product aspects it can set requirements for.</p>
        </>,
      ),
      task: {
        label: t("两个改法都打开，再拆一遍", "Turn both changes on and strip it again"),
        done: (s) => s.replays.some((k) => k.startsWith("11")),
      },
      extra: ({ s, c }) => (
        <>
          <Redesign s={s} c={c} keys={["oneScrew", "snaps"]} />
          <Inspector s={s} c={c} />
        </>
      ),
      note: t(
        "法规条文有适用范围和例外，这里只说方向。做具体产品时查最新的法规文本和对应的产品规则。",
        "The regulations have scopes and exceptions; this only gives the direction. For a real product, check the current texts and the rules for that product group.",
      ),
      noteTitle: t("法规", "Regulations"),
    },
    {
      title: t("改材料：一种塑料，标上记号", "Materials: one plastic, marked"),
      body: byLocale(
        <>
          <p>前后壳都用 PP，握感靠模具上的纹理，不再包 TPE。同一种塑料可以整块进同一条回收线。</p>
          <p>外壳内侧按 ISO 11469 刻上材料记号，比如 &gt;PP&lt;，分拣的人一看就知道它进哪一堆。缩写来自 ISO 1043，填料也要写出来，比如含 30% 矿物填料的 PP 写成 &gt;PP-MD30&lt;。</p>
        </>,
        <>
          <p>Make both housings PP and get the grip from a moulded texture instead of a TPE overmould. One plastic can go whole into one recycling stream.</p>
          <p>Mould a material mark inside the housing to ISO 11469, such as &gt;PP&lt;, so whoever sorts it knows at a glance where it goes. The abbreviations come from ISO 1043, and fillers are spelled out too: PP with 30% mineral filler is &gt;PP-MD30&lt;.</p>
        </>,
      ),
      task: {
        label: t("换成单一材料、标上记号，再拆一遍", "Switch to a single material, add the marks, and strip it again"),
        done: (s) => s.replays.some((k) => k.endsWith("11")),
      },
      extra: ({ s, c }) => (
        <>
          <Redesign s={s} c={c} keys={["oneScrew", "snaps", "mono", "marks"]} />
          <Inspector s={s} c={c} />
        </>
      ),
    },
    {
      title: t("分拣：每个零件进哪一堆", "Sorting: where each part goes"),
      body: byLocale(
        <>
          <p>最后看结果。原设计里，认不出材料的后壳、分不开的前壳、粘着胶的标签都进了混合料；改过以后，塑料件都能进同一种塑料的回收。</p>
          <p>电池永远单独收：混进粉碎线会起火。</p>
        </>,
        <>
          <p>Now the result. In the original, the unmarked rear housing, the inseparable front and the glued label all end up as mixed waste; after the redesign, every plastic part goes to one single-plastic stream.</p>
          <p>Batteries are always collected separately: in a shredding line they start fires.</p>
        </>,
      ),
      task: { label: t("两种设计各分拣一次", "Sort both designs once"), done: (s) => s.sortedSeen.length >= 2 },
      extra: ({ s, c }) => (
        <div className="mt-3 space-y-2">
          <Segmented
            size="sm"
            value={designKey(s.design) === designKey(ORIGINAL) ? "original" : "improved"}
            onValueChange={(v) => c.sort(v)}
            options={[
              { value: "original", label: t("原设计", "Original") },
              { value: "improved", label: t("改进后", "Redesigned") },
            ]}
            aria-label={t("设计", "Design")}
          />
          <div>
            <Button size="sm" variant="secondary" disabled={s.playing} onClick={() => c.sort(designKey(s.design) === designKey(ORIGINAL) ? "original" : "improved")}>
              <Recycle />
              {t("分拣", "Sort")}
            </Button>
          </div>
          {s.sortedDesign !== "none" && (
            <Hint tone={s.sortedDesign === "original" ? "warning" : undefined}>
              {s.sortedDesign === "original"
                ? t("3 件进了混合料：标签、认不出的后壳、分不开的前壳。", "3 parts end up mixed: the label, the unmarked rear housing and the inseparable front.")
                : t("塑料件都进了同一种塑料的回收，混合料里什么也没有。", "Every plastic part goes to one single-plastic stream; nothing is left as mixed.")}
            </Hint>
          )}
        </div>
      ),
    },
  ],
  quiz: [
    {
      q: t("一台产品用了梅花 T6、十字 PH00、十字 PH1 三种螺钉。改成一种的主要好处是？", "A product uses Torx T6, Phillips PH00 and Phillips PH1 screws. The main gain from using one type is…"),
      options: byLocale(["螺钉更便宜", "拆装只要一把工具，维修和回收都更快", "看起来更整齐"], ["Cheaper screws", "One tool does the job, so repair and recycling are faster", "It looks tidier"]),
      answer: 1,
      explain: t(
        "每多一种螺钉就多一次换工具，也多一种可能找不到的工具。统一以后，产线装配也一样省事。",
        "Every extra screw type means another tool change, and another tool someone may not have. One type helps assembly on the line too.",
      ),
    },
    {
      q: t("PC 外壳上包注了一圈 TPE 软胶，回收时的问题是？", "TPE is overmoulded onto a PC housing. What's the problem at recycling time?"),
      options: byLocale(
        ["TPE 用久了会自己脱落", "两种塑料熔在一起，分不开，只能当混合料", "没有问题，都是塑料"],
        ["The TPE peels off by itself with age", "The two plastics are fused and can't be separated, so it counts as mixed", "None: it's all plastic"],
      ),
      answer: 1,
      explain: t(
        "不同塑料大多互不相容，混在一起再生性能很差。要软的手感，可以把软胶做成能拆下来的单独零件，或者用模具纹理代替。",
        "Most plastics don't mix well, and recycled blends perform poorly. For a soft feel, make the soft part a separate, removable piece, or use a moulded texture instead.",
      ),
    },
    {
      q: t("外壳内侧刻着 >PP<，它是什么？", "The inside of a housing is marked >PP<. What is it?"),
      options: byLocale(
        ["品牌标志", "按 ISO 11469 标的材料记号：这是聚丙烯", "表示能进微波炉"],
        ["A brand logo", "A material mark to ISO 11469: this part is polypropylene", "It means microwave-safe"],
      ),
      answer: 1,
      explain: t(
        "尖括号里是 ISO 1043 的材料缩写，填料也会写上（如 >PP-MD30<）。分拣的人不用猜，同种塑料才能进同一条回收线。",
        "Between the angle brackets is the ISO 1043 abbreviation, with any filler added (e.g. >PP-MD30<). Sorters don't have to guess, and only like plastics can share a recycling stream.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "数一数：拆几步、几种工具、几种紧固方式、几处胶、几处分不开的材料，越少越好",
      "统一螺钉，卡扣和插接代替胶和焊锡；电池要能用普通工具拆换，这也是欧盟法规的方向",
      "一个产品尽量只用一种塑料，别把不同塑料熔在一起；按 ISO 11469 标上 >PP< 这样的记号",
    ],
    [
      "Count it: steps, tools, fastening kinds, glued joints, inseparable materials. Fewer is better",
      "One screw type; snaps and connectors instead of glue and solder; a battery that ordinary tools can swap, which is where EU rules are heading",
      "Use as few plastics as you can and don't fuse different ones together; mark parts to ISO 11469, like >PP<",
    ],
  ),
  overlay: ({ s }) => <TallyPanel s={s} />,
}

export default lesson
