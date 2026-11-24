import { ArrowDown, ArrowUp, Columns2, Scissors } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Segmented } from "@/components/ui/segmented"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, Readout, SceneChip } from "@/components/lesson-ui"
import { byLocale, t } from "@/lib/i18n"
import { COST, costOf, FEATURES, OPTIONS, STEP_OF, UndercutScene, works, type Feature, type Sol, type UndercutState } from "./undercuts.scene"
import type { LessonDef } from "./types"

/** 4.4.4 「倒扣、侧抽、拾件」. */

const SOL_NAME: Record<Sol, string> = {
  slide: t("滑块", "Slide"),
  lifter: t("斜顶", "Lifter"),
  shutoff: t("碰穿开窗", "Shut-off"),
  pickout: t("拾件", "Pickout"),
  bumpoff: t("强脱", "Bump-off"),
  redesign: t("改设计", "Redesign"),
}

const FEATURE_NAME: Record<Feature, string> = {
  hole: t("侧孔", "Side hole"),
  catch: t("内侧卡扣", "Inside catch"),
  lip: t("唇边", "Lip"),
}

/** Why each choice works or doesn't, per feature. */
function verdict(f: Feature, sol: Sol, soft: boolean): string {
  const pickout = t(
    "一块活动镶件放进模具，跟零件一起顶出，再由人取下、放回。模具便宜，但每一模都要人手：周期长、不稳定，只适合样件和小批量。",
    "A loose insert goes into the mold, comes out with the part, and is taken off and put back by hand. The mold stays cheap, but every shot needs an operator: a long, uneven cycle, fine for prototypes and small runs only.",
  )
  if (f === "hole") {
    if (sol === "slide")
      return t(
        "滑块在开模前沿 −Y 退出，让出侧孔。模具多一套机构：更贵，周期略长，滑块的分型处还会在零件上留一圈夹线。",
        "The slide backs out along −Y before the mold opens and clears the hole. The mold gains a mechanism: it costs more, the cycle gets a little longer, and the slide's parting line leaves a witness line on the part.",
      )
    if (sol === "redesign")
      return t(
        "把孔改成通到底边的缺口：型腔和型芯在缺口里直接对碰，不要任何机构。代价是外形变了，要和造型、结构一起确认。",
        "Turn the hole into a notch that runs out to the bottom edge: cavity and core steel meet inside it, with no mechanism at all. The catch is that the shape has changed, so agree it with design and engineering.",
      )
    if (sol === "pickout") return pickout
    return t("斜顶装在型芯里、向内移动，是给内侧倒扣用的。外侧的孔用滑块更直接。", "A lifter sits in the core and moves inward: it is for undercuts on the inside. An outside hole is a job for a slide.")
  }
  if (f === "catch") {
    if (sol === "lifter")
      return t(
        "斜顶是型芯里一根斜着走的镶件：顶出时它跟着零件往上，同时向内滑开，让出卡扣。适合内侧倒扣；它要占顶出行程，模具也贵。",
        "A lifter is a core insert on an angled path: during ejection it rises with the part and slides inward at the same time, clearing the catch. It suits inside undercuts, but it takes up ejector stroke and adds mold cost.",
      )
    if (sol === "shutoff")
      return t(
        "在卡扣正上方的顶面开一个窗口，型腔的镶件从窗口伸下来，成形卡扣的上表面，开模时直接拔走。不要机构；代价是顶面多一个孔。对碰面要有拔模，Protolabs 建议至少 3°。",
        "Open a window in the top, right above the catch. Cavity steel reaches down through it to form the top of the catch and simply pulls out as the mold opens. No mechanism; the price is an extra hole in the top. The faces where the steel meets need draft: Protolabs suggests at least 3°.",
      )
    if (sol === "pickout") return pickout
    return t("滑块从外面进出，够不到壁内侧的面。", "A slide moves in and out from the outside: it can't reach a face on the inside of the wall.")
  }
  if (sol === "bumpoff")
    return soft
      ? t(
          "唇边浅、边缘倒圆或带 30–45° 的导入斜角时，软料零件顶出时能撑开、滑过型芯，再弹回原形。不要机构；只适合浅的倒扣，还要远离转角和筋这类撑着的地方。",
          "With a shallow lip and a rounded or 30–45° lead-in, a part in a flexible material stretches over the core as it is ejected and springs back. No mechanism; it only works for shallow undercuts, away from corners and ribs that stiffen the wall.",
        )
      : t(
          "PC、PC 合金这类硬料一般不强脱：会拉伤、发白甚至开裂。Covestro 的指南只给出约 2% 的倒扣量，而且要壁能变形、边缘倒圆。",
          "Stiff materials such as PC and PC blends are generally not bumped off: the part scuffs, whitens or even cracks. The Covestro guide allows only about 2% undercut, and only if the wall can flex and the edges are rounded.",
        )
  if (sol === "redesign")
    return t("去掉唇边，只靠卡扣固定。最便宜的倒扣，是不存在的倒扣。", "Drop the lip and let the catch do the holding. The cheapest undercut is the one that isn't there.")
  if (sol === "pickout") return pickout
  return t("唇边在内侧，滑块够不到。", "The lip is on the inside, where a slide can't reach.")
}

function Dots({ n, max = 3, warn }: { n: number; max?: number; warn?: boolean }) {
  return (
    <span className="inline-flex gap-0.5 align-middle">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={cn("size-2 rounded-full", i < n ? (warn ? "bg-scene-modified" : "bg-foreground") : "bg-muted")} />
      ))}
    </span>
  )
}

function CostRow({ tool, cycle, label }: { tool: number; cycle: number; label?: string }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-small">
      {label && <span className="font-medium">{label}</span>}
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground">{t("模具成本", "Mold cost")}</span>
        <Dots n={tool} max={Math.max(3, tool)} />
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="text-muted-foreground">{t("周期", "Cycle time")}</span>
        <Dots n={cycle} max={Math.max(3, cycle)} warn={cycle >= 3} />
      </span>
    </div>
  )
}

function MouldButton({ s, c }: { s: UndercutState; c: UndercutScene }) {
  return (
    <Button size="sm" variant="secondary" onClick={() => c.toggleMould()}>
      <Columns2 />
      {s.open > 0 ? t("合上模具", "Close the mold") : t("打开模具", "Open the mold")}
    </Button>
  )
}

function Legend() {
  return (
    <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-2.5 gap-y-1.5 text-small">
      <span className="size-3 rounded-xs bg-axis-x" />
      <span>{t("倒扣：沿开模方向两边都看不见", "Undercut: hidden from both directions of the pull")}</span>
      <span className="size-3 rounded-xs bg-primary" />
      <span>{t("倒扣，但已由机构或镶件成形", "Undercut, but formed by a mechanism or insert")}</span>
      <span className="size-3 rounded-xs bg-scene-model" />
      <span>{t("能直接脱模", "Releases straight off")}</span>
    </div>
  )
}

/** Pick a solution for one feature, with the verdict and its cost. */
function Solve({ s, c, f }: { s: UndercutState; c: UndercutScene; f: Feature }) {
  const sol = s.sol[f]
  const ok = works(f, sol, s.soft)
  return (
    <>
      <div className="mt-4 text-small font-medium">{t(`${FEATURE_NAME[f]}怎么办`, `What to do about the ${FEATURE_NAME[f].toLowerCase()}`)}</div>
      <Segmented
        size="sm"
        className="mt-1.5"
        aria-label={FEATURE_NAME[f]}
        value={sol ?? "none"}
        onValueChange={(v) => v !== "none" && c.setSol(f, v as Sol)}
        options={OPTIONS[f].map((o) => ({ value: o, label: SOL_NAME[o] }))}
      />
      {sol && (
        <>
          <Hint tone={ok ? undefined : "warning"}>{verdict(f, sol, s.soft)}</Hint>
          {ok && <CostRow tool={COST[sol].tool} cycle={COST[sol].cycle} />}
        </>
      )}
      <div className="mt-3">
        <MouldButton s={s} c={c} />
      </div>
    </>
  )
}

function Material({ s, c }: { s: UndercutState; c: UndercutScene }) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <span className="text-small font-medium">{t("材料", "Material")}</span>
      <Segmented
        size="sm"
        aria-label={t("材料", "Material")}
        value={s.soft ? "soft" : "stiff"}
        onValueChange={(v) => c.setSoft(v === "soft")}
        options={[
          { value: "stiff", label: t("硬料 · PC、ABS", "Stiff · PC, ABS") },
          { value: "soft", label: t("软料 · PE、TPE", "Flexible · PE, TPE") },
        ]}
      />
    </div>
  )
}

/** Undercut area still unsolved: every feature before the per-feature steps, then only those handled so far. */
const totalRed = (s: UndercutState) => {
  const shown = s.step >= 2 && s.step <= 4 ? FEATURES.filter((f) => STEP_OF[f] <= s.step) : FEATURES
  return shown.reduce((a, f) => a + s.red[f], s.red.body)
}

const lesson: LessonDef<UndercutState, UndercutScene> = {
  id: "undercuts",
  codes: ["4.4.4"],
  title: t("倒扣、侧抽、拾件", "Undercuts, side actions and pickouts"),
  create: (v, emit) => new UndercutScene(v, emit),
  steps: [
    {
      title: t("两边都看不见的面", "Faces neither half can see"),
      body: byLocale(
        <>
          <p>开模时型腔向上走，型芯向下退。每个面都得「看得见」其中一边：顺着开模方向往外看，没有零件自己挡着。成形它的钢才拔得出来。</p>
          <p>从上面看、从下面看都看不见的面就是倒扣。这个小盖子有三个典型的：侧壁上的接口孔、壁内侧的卡扣、开口内沿的一段唇边。倒扣面标成红色。</p>
        </>,
        <>
          <p>
            As the mold opens, the cavity goes up and the core drops away. Every face has to “see” one of the two sides: looking out along the pull direction, nothing of the part
            itself may be in the way. Only then can the steel that formed it pull out.
          </p>
          <p>
            A face you can't see from above or from below is an undercut. This small cover has three typical ones: a connector hole in a side wall, a catch on the inside of a wall,
            and a short lip along the inside of the opening. Undercut faces are red.
          </p>
        </>,
      ),
      task: { label: t("从上面看一次，再从下面看一次", "Look from above once, then from below"), done: (s) => s.lookedTop && s.lookedBottom },
      extra: ({ s, c }) => (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => c.look("top")}>
              <ArrowDown />
              {t("从上面看", "View from above")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => c.look("bottom")}>
              <ArrowUp />
              {t("从下面看", "View from below")}
            </Button>
            <Button size="sm" variant={s.cutaway ? "secondary" : "ghost"} onClick={() => c.setCutaway(!s.cutaway)}>
              <Scissors />
              {s.cutaway ? t("盖回顶面", "Put the top back") : t("揭开顶面", "Lift off the top")}
            </Button>
          </div>
          {s.lookedTop && s.lookedBottom && (
            <Hint>
              {t(
                "两个方向都没看到红色：它们正是两边都看不见的面。揭开顶面，从里面才看得到。",
                "No red from either direction: these are exactly the faces neither side can see. Lift off the top and you can see them from inside.",
              )}
            </Hint>
          )}
          <Legend />
        </>
      ),
    },
    {
      title: t("转动开模方向", "Turn the pull direction"),
      body: byLocale(
        <>
          <p>开模方向不是随便定的。转一转，红色会实时变化：竖直的侧壁一旦和开模方向不平行，就有一侧反着斜，也成了倒扣。</p>
          <p>主方向由大的形体决定。这个盒子开口朝下，只能沿 Z 开模；小的局部特征再各自想办法。</p>
        </>,
        <>
          <p>
            The pull direction isn't arbitrary. Turn it and watch the red update live: as soon as the vertical walls stop being parallel to the pull, the walls on one side lean the wrong
            way and become undercuts too.
          </p>
          <p>The main direction is set by the big shape. This box opens downward, so it can only be pulled along Z; the small local features then each need a solution of their own.</p>
        </>,
      ),
      task: { label: t("先猜，再把倾斜拖到 30° 以上看看", "Make a guess, then tilt the pull past 30°"), done: (s) => s.triedTilt },
      extra: ({ s, c }) => (
        <>
          <Predict
            question={t("改成沿侧孔的轴线（−Y）开模，会怎样？", "What happens if you pull along the axis of the side hole (−Y) instead?")}
            options={byLocale(
              ["侧孔解决了，其他不受影响", "侧孔解决了，但盒子本身成了倒扣", "三个倒扣都消失了"],
              ["The hole is solved and nothing else changes", "The hole is solved, but the box itself becomes an undercut", "All three undercuts disappear"],
            )}
            answer={1}
            explain={t(
              "侧孔是沿 −Y 打通的，但盒子的内腔开口朝下：从侧面拔，顶面和侧壁都挡住了型芯。为一个小孔转动整个开模方向，得不偿失。",
              "The hole runs through along −Y, but the box's hollow opens downward: pulled sideways, the top and the walls trap the core. Turning the whole mold for one small hole costs far more than it saves.",
            )}
            onReveal={() => c.pullAlongHole()}
          />
          <ParamSlider className="mt-3 px-0" label={t("倾斜", "Tilt")} unit="°" value={s.tilt} min={0} max={90} step={1} onChange={(v) => c.setPull({ tilt: v })} />
          <ParamSlider
            className="px-0"
            label={t("朝向", "Heading")}
            unit="°"
            value={s.heading}
            min={-180}
            max={180}
            step={5}
            onChange={(v) => c.setPull({ heading: v })}
            hint={t("朝向 −90° 指向 −Y，也就是侧孔的轴线。", "A heading of −90° points to −Y, the axis of the side hole.")}
          />
          <div className="mt-3">
            <Readout label={t("倒扣面积", "Undercut area")} value={totalRed(s)} unit="mm²" tone={s.tilt === 0 ? undefined : "warning"} />
          </div>
          <Legend />
        </>
      ),
      note: t(
        "这里的侧壁按 0° 画，只为看清倒扣。实际零件所有沿开模方向的面都要拔模，见「注塑：拔模与分型线」。",
        "The walls here are drawn at 0° only so the undercuts read clearly. On a real part every face along the pull needs draft: see “Injection molding: draft and parting lines”.",
      ),
      noteTitle: t("说明", "Note"),
    },
    {
      title: t("侧孔：滑块，还是改设计", "Side hole: a slide, or a redesign"),
      body: byLocale(
        <>
          <p>侧孔在外侧，沿 −Y 打通。成形它的那块钢，沿 Z 往哪边拔都被孔的上下沿挡住。</p>
          <p>选一种办法，再打开模具看它怎么工作。注意每种办法花在哪里：模具上的钢和机构，还是每一模的时间。</p>
        </>,
        <>
          <p>The side hole is on the outside and runs through along −Y. Whichever way along Z the steel that forms it tries to go, the hole's top or bottom edge stops it.</p>
          <p>Pick a solution, then open the mold to see it work. Notice where each one costs you: in steel and mechanisms, or in time on every shot.</p>
        </>,
      ),
      task: { label: t("选一种可行的办法，打开模具", "Pick a solution that works and open the mold"), done: (s) => s.ran.hole && works("hole", s.sol.hole, s.soft) },
      extra: ({ s, c }) => <Solve s={s} c={c} f="hole" />,
    },
    {
      title: t("内侧卡扣：斜顶或碰穿", "Inside catch: a lifter, or a shut-off"),
      body: byLocale(
        <>
          <p>卡扣长在壁的内侧，它的上表面朝着顶面。型芯往下退时，卡扣上方那块钢会被卡扣勾住。</p>
          <p>顶面已经揭开，能看到卡扣上表面是红的。内侧的倒扣滑块够不到，要换别的办法。</p>
        </>,
        <>
          <p>The catch sits on the inside of the wall, with its top face looking up at the ceiling. As the core drops away, the steel above the catch is hooked by it.</p>
          <p>The top has been lifted off so you can see the catch's top face in red. A slide can't reach an undercut on the inside, so this needs a different solution.</p>
        </>,
      ),
      task: { label: t("选一种可行的办法，打开模具", "Pick a solution that works and open the mold"), done: (s) => s.ran.catch && works("catch", s.sol.catch, s.soft) },
      extra: ({ s, c }) => <Solve s={s} c={c} f="catch" />,
    },
    {
      title: t("唇边：能不能强脱", "Lip: can it be bumped off?"),
      body: byLocale(
        <>
          <p>开口内沿这段唇边只有 1.2 mm 深。这么浅的倒扣，有时不用任何机构：顶出时零件撑开、滑过型芯，再弹回来，这叫强脱。</p>
          <p>能不能强脱主要看材料：换一下材料再试。</p>
        </>,
        <>
          <p>
            The lip along the inside of the opening is only 1.2 mm deep. An undercut this shallow can sometimes do without any mechanism: during ejection the part stretches over the
            core and springs back. That is a bump-off (stripping).
          </p>
          <p>Whether it works depends mostly on the material: switch materials and try again.</p>
        </>,
      ),
      task: { label: t("让唇边顺利脱模", "Get the lip to release"), done: (s) => s.ran.lip && works("lip", s.sol.lip, s.soft) },
      extra: ({ s, c }) => (
        <>
          <Material s={s} c={c} />
          <Solve s={s} c={c} f="lip" />
        </>
      ),
      note: t(
        "Covestro（原 Bayer）的指南：圆形件按 (D−d)/D 计算倒扣量，PA6、TPU 这类软料一般可到 5%，理想条件下 10%；PC、PC 合金一般不强脱，壁能变形、边缘倒圆时约 2%。具体以材料商和模具厂的意见为准。",
        "From the Covestro (formerly Bayer) guide: for round parts the undercut is (D−d)/D. Flexible resins such as unfilled PA6 and TPU can usually take 5%, up to 10% in ideal conditions; stiff PC and PC blends are generally not stripped, or about 2% if the wall can flex and the edges are rounded. Check with the material supplier and the moldmaker.",
      ),
      noteTitle: t("强脱的经验值", "Bump-off rules of thumb"),
    },
    {
      title: t("先改设计，再上机构", "Redesign first, mechanisms last"),
      body: byLocale(
        <>
          <p>三个倒扣一起算账。机构不只是模具费：还要维护，还带来隐性成本，比如废品、披锋和停机。拾件的代价在周期上，每一模都要人手。</p>
          <p>顺序是：能改设计就改；不行用碰穿、强脱这类不加机构的办法；再不行才上滑块、斜顶。</p>
        </>,
        <>
          <p>
            Now add up all three. A mechanism costs more than the mold: it needs maintenance and brings hidden costs such as scrap, flash and downtime. A pickout costs you cycle time
            instead, with an operator on every shot.
          </p>
          <p>The order: redesign if you can; failing that, a shut-off or a bump-off that adds no mechanism; only then slides and lifters.</p>
        </>,
      ),
      task: {
        label: t("三个倒扣都解决，模具成本不超过一格，周期不变", "Solve all three with at most one dot of mold cost and no extra cycle time"),
        done: (s) => FEATURES.every((f) => works(f, s.sol[f], s.soft)) && costOf(s).tool <= 1 && costOf(s).cycle === 0,
      },
      extra: ({ s, c }) => {
        const total = costOf(s)
        return (
          <>
            {FEATURES.map((f) => (
              <div key={f} className="mt-3 flex items-center gap-3">
                <span className="w-20 shrink-0 text-small font-medium">{FEATURE_NAME[f]}</span>
                <Segmented
                  size="sm"
                  aria-label={FEATURE_NAME[f]}
                  value={s.sol[f] ?? "none"}
                  onValueChange={(v) => v !== "none" && c.setSol(f, v as Sol)}
                  options={OPTIONS[f].filter((o) => works(f, o, true)).map((o) => ({ value: o, label: SOL_NAME[o] }))}
                />
              </div>
            ))}
            <Material s={s} c={c} />
            <CostRow tool={total.tool} cycle={total.cycle} label={t("合计", "Total")} />
            {FEATURES.some((f) => !s.sol[f]) ? (
              <Hint tone="warning">{t("还有倒扣没选办法。", "An undercut still has no solution.")}</Hint>
            ) : (
              FEATURES.some((f) => !works(f, s.sol[f], s.soft)) && (
                <Hint tone="warning">{t("唇边还没解决：强脱要配软料。", "The lip is still unsolved: a bump-off needs a flexible material.")}</Hint>
              )
            )}
            <div className="mt-3">
              <MouldButton s={s} c={c} />
            </div>
          </>
        )
      },
    },
  ],
  quiz: [
    {
      q: t("拔模分析把一个面标成倒扣，意思是？", "A draft analysis marks a face as an undercut. What does that mean?"),
      options: byLocale(
        ["它的拔模角小于 1°", "沿开模方向两边都看不见它：成形它的钢拔不出来", "它在零件的内侧"],
        ["Its draft angle is under 1°", "Neither direction of the pull can see it: the steel that forms it can't come out", "It is on the inside of the part"],
      ),
      answer: 1,
      explain: t(
        "拔模不足是脱模困难，倒扣是根本脱不出。内侧的面大多能随型芯脱出，只有被零件自己挡住的才是倒扣。",
        "Too little draft makes release hard; an undercut makes it impossible. Most inside faces release with the core: only those the part itself blocks are undercuts.",
      ),
    },
    {
      q: t("外壳侧壁要开一个接口孔，年产几十万件。最先考虑什么？", "A housing needs a connector hole in a side wall, at hundreds of thousands of parts a year. What do you look at first?"),
      options: byLocale(
        ["用拾件，模具最便宜", "先看能不能改成通到边缘的缺口，不行再上滑块", "强脱，顶出时让孔撑开"],
        ["A pickout: the cheapest mold", "Whether it can become a notch that runs out to the edge; if not, a slide", "A bump-off: let the hole stretch open during ejection"],
      ),
      answer: 1,
      explain: t(
        "拾件每一模都要人手，大批量下周期和人工吃掉了省下的模具费。强脱只适用于浅的倒扣，打通的孔脱不出来。",
        "A pickout needs an operator on every shot: at volume, cycle time and labor eat up the money saved on the mold. Bump-offs only work for shallow undercuts, not a hole straight through.",
      ),
    },
    {
      q: t("壁内侧的卡扣，用斜顶和在顶面开窗碰穿相比？", "For a catch on the inside of a wall, how does a lifter compare with a shut-off through a window in the top?"),
      options: byLocale(
        ["碰穿不要机构，但顶面多一个孔；斜顶外观完整，模具更贵", "两者一样，只是叫法不同", "斜顶更便宜，因为不用开窗"],
        ["The shut-off needs no mechanism but leaves a hole in the top; the lifter keeps the outside intact but costs more", "They're the same thing under different names", "The lifter is cheaper because there's no window"],
      ),
      answer: 0,
      explain: t(
        "碰穿靠型腔的钢穿过窗口直接成形倒扣面，模具简单；代价落在外观上。斜顶是会动的机构，模具贵、要维护，但外表面不受影响。",
        "A shut-off lets cavity steel reach through the window and form the undercut face directly, so the mold stays simple; the cost lands on the appearance. A lifter is a moving mechanism, expensive and needing maintenance, but it leaves the outside untouched.",
      ),
    },
  ],
  takeaways: byLocale(
    [
      "倒扣是沿开模方向两边都看不见的面；主开模方向由大的形体决定，局部特征再各自解决",
      "解决办法按代价排：改设计，碰穿或强脱，滑块或斜顶，最后是拾件（周期最长，留给样件和小批量）",
      "每个机构都加模具费、维护和周期；能在设计阶段消掉的倒扣，别留给模具",
    ],
    [
      "An undercut is a face neither direction of the pull can see. The big shape sets the main pull; local features each get their own solution",
      "Rank the solutions by cost: redesign, then a shut-off or a bump-off, then slides and lifters, and last a pickout (the longest cycle, for prototypes and small runs)",
      "Every mechanism adds mold cost, maintenance and cycle time. Design out the undercuts you can before they reach the mold",
    ],
  ),
  next: {
    to: "/lesson/snap-fits",
    label: t("卡扣", "Snap fits"),
    text: t("卡扣的钩子本身就是倒扣：怎么算应变，又怎么让它能脱模。", "A snap hook is an undercut by design: how to size its strain, and how to make it moldable."),
  },
  overlay: ({ s }) => {
    const total = costOf(s, s.step === 5 ? undefined : FEATURES.filter((f) => s.step >= 2 && STEP_OF[f] <= s.step))
    return (
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2">
        <SceneChip>{s.tilt === 0 ? t("开模方向 +Z", "Pull direction +Z") : t(`开模方向 倾斜 ${s.tilt}° · 朝向 ${s.heading}°`, `Pull direction tilted ${s.tilt}° · heading ${s.heading}°`)}</SceneChip>
        <SceneChip tone={totalRed(s) > 0 ? undefined : "primary"}>
          {t("倒扣面积", "Undercut area")} {totalRed(s)} mm²
        </SceneChip>
        {s.step >= 2 && (
          <SceneChip>
            {t("模具", "Mold")} +{total.tool} · {t("周期", "Cycle")} +{total.cycle}
          </SceneChip>
        )}
      </div>
    )
  },
}

export default lesson
