import { Link2, Trash2, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { byLocale, t } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { ParamSlider } from "@/components/param-slider"
import { Hint, Predict, SceneChip } from "@/components/lesson-ui"
import { AssemblyScene, derive, DOFS, type AsmState } from "./assembly-dof.scene"
import type { LessonDef, StepDef } from "./types"

/** 2.1.2 · 2.1.3 · 2.1.4 「零件的 6 个自由度与配合」. */

const STEPS: StepDef<AsmState, AssemblyScene>[] = [
  {
    title: t("自由的零件有 6 个自由度", "A free part has 6 degrees of freedom"),
    body: byLocale(
      <>
        <p>装配里的零件，在没有任何配合之前，可以沿 X、Y、Z 三个方向移动，也可以绕这三根轴转动。一共 6 个自由度。</p>
        <p>底座是固定的：装配里总要有一个零件钉在原地，作为其他零件的参照。摆臂还是自由的，每个箭头代表它的一个自由度，可以直接拖。</p>
      </>,
      <>
        <p>Before it has any mates, a part in an assembly can move along X, Y and Z, and it can rotate about each of those three axes: 6 degrees of freedom in all.</p>
        <p>
          The base is fixed: an assembly always needs one part pinned in place as the reference for the others. The arm is still free. Each arrow stands for one of its degrees of
          freedom, and you can drag the arrows directly.
        </p>
      </>,
    ),
    task: {
      label: t("拖动两个不同的箭头：一个移动，一个转动", "Drag two different arrows: one translation and one rotation"),
      done: (s) => s.used.some((d) => d[0] === "t") && s.used.some((d) => d[0] === "r"),
    },
    note: t(
      "SOLIDWORKS 里第一个放进装配体的零件默认「固定」，树里名字前有 (f)；Fusion 叫「固定」（Ground）；Onshape 也叫「固定」（Fix）。",
      "In SOLIDWORKS, the first part you place in an assembly is fixed by default, with (f) in front of its name in the tree. Fusion calls this Ground, and Onshape calls it Fix.",
    ),
    noteTitle: t("各软件", "Across packages"),
  },
  {
    title: t("同心：轴对轴", "Concentric: axis to axis"),
    body: byLocale(
      <>
        <p>配合描述两个零件之间的几何关系。「同心」让摆臂销的轴线和底座孔的轴线重合。</p>
        <p>先猜一猜它会去掉几个自由度。</p>
      </>,
      <>
        <p>A mate describes a geometric relationship between two parts. “Concentric” makes the axis of the arm's pin coincide with the axis of the hole in the base.</p>
        <p>First, guess how many degrees of freedom it takes away.</p>
      </>,
    ),
    task: { label: t("加上同心配合，再沿 Z 方向拖一下摆臂", "Add the concentric mate, then drag the arm along Z"), done: (s) => s.concentric && s.slid },
    extra: ({ s, c }) => (
      <>
        <Predict
          question={t("只加一个同心配合，摆臂还剩几个自由度？", "With just one concentric mate, how many degrees of freedom does the arm have left?")}
          options={byLocale(
            ["0 个，已经装好了", "1 个，只能转", "2 个，能沿轴滑，也能绕轴转", "4 个"],
            ["0: it's fully assembled", "1: it can only rotate", "2: it can slide along the axis and rotate about it", "4"],
          )}
          answer={2}
          explain={t(
            "两条轴线重合，就不能横向移动、也不能歪斜，去掉了 4 个；但沿着轴滑动和绕着轴转动都还在。",
            "With the two axes coinciding, the arm can't move sideways and can't tilt, which takes away 4. But sliding along the axis and rotating about it are both still there.",
          )}
          onReveal={() => c.addConcentric()}
        />
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.concentric} onClick={() => c.addConcentric()}>
          <Link2 />
          {t("添加同心配合", "Add concentric mate")}
        </Button>
        {s.concentric && (
          <Hint>
            {t(
              "剩下的两个箭头就是剩下的自由度。拖蓝色直箭头，摆臂只会沿轴上下滑。",
              "The two arrows left are the degrees of freedom left. Drag the straight blue arrow, and the arm only slides up and down along the axis.",
            )}
          </Hint>
        )}
      </>
    ),
  },
  {
    title: t("重合：面贴面", "Coincident: face to face"),
    body: byLocale(
      <>
        <p>再加一个「重合」：摆臂底面贴到底座顶面上。面贴面本来能去掉 3 个自由度（1 个移动、2 个转动），其中两个转动已经被同心去掉了，这次只新去掉沿 Z 的滑动。</p>
        <p>剩下 1 个：绕销转动。这就是铰链。</p>
      </>,
      <>
        <p>
          Now add a “coincident” mate: the bottom face of the arm sits on the top face of the base. Face to face can take away 3 degrees of freedom (1 translation, 2 rotations), but
          the concentric mate has already removed those two rotations, so this time the only new one removed is sliding along Z.
        </p>
        <p>That leaves 1: rotation about the pin. That's a hinge.</p>
      </>,
    ),
    task: {
      label: t("加上重合配合，再拖转动箭头，让摆臂转过 45° 以上", "Add the coincident mate, then drag the rotation arrow to turn the arm through 45° or more"),
      done: (s) => s.coincident && s.turned >= 45,
    },
    extra: ({ s, c }) => (
      <>
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.coincident} onClick={() => c.addCoincident()}>
          <Link2 />
          {t("添加重合配合", "Add coincident mate")}
        </Button>
        {s.coincident && (
          <Hint>
            {t(
              `怎么拖它都只会绕销转：剩下的运动必须满足所有配合。转过 ${Math.round(s.turned)}°。`,
              `However you drag it, it only turns about the pin: whatever motion is left has to satisfy every mate. Turned through ${Math.round(s.turned)}°.`,
            )}
          </Hint>
        )}
      </>
    ),
    note: t(
      "Fusion 用「联接」一次给出运动类型：旋转联接（Revolute）就等于这里的同心加重合。Onshape 的配合也按运动类型分，比如 Revolute。SOLIDWORKS 是一个个加基本配合，也有现成的「铰链」配合。",
      "Fusion uses a joint to set the type of motion in one go: a Revolute joint equals the concentric plus coincident here. Onshape's mates are also sorted by type of motion, such as Revolute. SOLIDWORKS adds basic mates one at a time, and it also has a ready-made Hinge mate.",
    ),
    noteTitle: t("各软件", "Across packages"),
  },
  {
    title: t("锁住最后一个自由度", "Locking the last degree of freedom"),
    body: byLocale(
      <>
        <p>想让摆臂停在某个角度，就再加一个「角度」配合：摆臂侧面和底座前面成 40°。自由度变成 0，零件「完全定义」，箭头都没了。</p>
        <p>角度配合的数值可以改，摆臂会被它带着转。机构仿真里，驱动就是这样改出来的。</p>
      </>,
      <>
        <p>
          To hold the arm at a particular angle, add an “angle” mate: the side face of the arm at 40° to the front face of the base. The degrees of freedom drop to 0, the part is
          “fully defined”, and the arrows are gone.
        </p>
        <p>You can change the angle mate's value, and the arm turns with it. In a motion simulation, this is how a part is driven.</p>
      </>,
    ),
    task: { label: t("加上角度配合，再改一次角度", "Add the angle mate, then change the angle"), done: (s) => s.angleMate && s.angle !== 40 },
    extra: ({ s, c }) => (
      <>
        <Button size="sm" variant="secondary" className="mt-3" disabled={s.angleMate} onClick={() => c.addAngle()}>
          <Link2 />
          {t("添加角度配合", "Add angle mate")}
        </Button>
        {s.angleMate && <ParamSlider className="mt-3 px-0" label={t("角度1", "Angle1")} unit="°" value={s.angle} min={0} max={180} step={5} onChange={(v) => c.setAngle(v)} />}
      </>
    ),
    note: t(
      "只想把零件整个钉死、不关心关系时，可以用 SOLIDWORKS 的「锁定」配合或 Fusion 的「刚性」联接，一次去掉全部 6 个。但这样就没有设计意图了：改了底座，它不会跟着走。",
      "When you just want to pin a part down and don't care about the relationship, a SOLIDWORKS Lock mate or a Fusion Rigid joint takes away all 6 at once. But then there's no design intent: change the base, and the part won't follow.",
    ),
    noteTitle: t("锁定", "Lock"),
  },
  {
    title: t("多一个配合，反而出错", "One mate too many breaks it"),
    body: byLocale(
      <>
        <p>零件已经完全定义，再加配合只会和已有的配合「抢」同一个自由度。比如加一个「平行：摆臂侧面 ∥ 底座前面」，它和角度配合管的都是绕销转动。</p>
        <p>两个配合说法不一样时就冲突，叫过定义；说法碰巧一样时叫冗余，现在不报错，改个尺寸就会出事。</p>
      </>,
      <>
        <p>
          Once the part is fully defined, any mate you add only “competes” with an existing mate for the same degree of freedom. Add “parallel: arm side face ∥ base front face”, for
          example, and it controls rotation about the pin, just as the angle mate does.
        </p>
        <p>
          When the two mates disagree, they conflict: that's called over-defined. When they happen to agree, they're called redundant: there's no error now, but change a dimension
          and things go wrong.
        </p>
      </>,
    ),
    task: { label: t("加一个平行配合，再把多余的那个删掉", "Add a parallel mate, then delete the extra one"), done: (s) => s.triedParallel && !s.parallel },
    extra: ({ s, c }) => {
      const d = derive(s)
      return (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" disabled={s.parallel} onClick={() => c.setParallel(true)}>
              <Link2 />
              {t("添加平行配合", "Add parallel mate")}
            </Button>
            {s.parallel && (
              <Button size="sm" variant="secondary" onClick={() => c.setParallel(false)}>
                <Trash2 />
                {t("删除平行配合", "Delete parallel mate")}
              </Button>
            )}
            {d.conflict && (
              <Button size="sm" variant="secondary" onClick={() => c.setAngle(0)}>
                {t("角度改成 0°", "Set the angle to 0°")}
              </Button>
            )}
          </div>
          {d.conflict && (
            <Hint tone="warning">
              {t(
                `过定义：角度1 要 ${s.angle}°，平行1 要 0°，两者不可能同时满足。虚影是平行配合想要的位置。SOLIDWORKS 会把冲突的配合标红并提示过定义。`,
                `Over-defined: Angle1 wants ${s.angle}° and Parallel1 wants 0°, and both can't be satisfied at once. The ghost shows where the parallel mate wants the arm. SOLIDWORKS marks the conflicting mates in red and reports that the assembly is over-defined.`,
              )}
            </Hint>
          )}
          {d.redundant && (
            <Hint tone="warning">
              {t(
                "现在两个配合碰巧一致，看起来没事，但它们是冗余的：有的软件直接报过定义，有的能解但留下隐患，下次把角度改成 30°，马上冲突。",
                "Right now the two mates happen to agree, so it looks fine, but they're redundant: some packages report over-defined straight away, and others solve it but leave a trap. The next time you change the angle to 30°, they conflict at once.",
              )}
            </Hint>
          )}
          {s.triedParallel && !s.parallel && (
            <Hint>
              {t(
                "删掉多余的配合，问题就没了。完全定义只是状态，正确定义才是目标（SOLIDWORKS 官方博客）。",
                "Delete the extra mate and the problem is gone. Fully defined is only a state; correctly defined is the goal (from the official SOLIDWORKS blog).",
              )}
            </Hint>
          )}
        </>
      )
    },
    note: t(
      "所以不要因为零件「还能动」就继续堆配合。先想清楚它应该怎么动，用最少的配合表达这个运动。",
      "So don't keep piling on mates just because a part “can still move”. First work out how it should move, then express that motion with as few mates as possible.",
    ),
    noteTitle: t("习惯", "Good habit"),
  },
]

const QUIZ = [
  {
    q: t("一个销和一个孔加了同心配合，销还剩哪些自由度？", "A pin and a hole have a concentric mate. Which degrees of freedom does the pin have left?"),
    options: byLocale(
      ["什么都不剩", "沿轴滑动和绕轴转动", "只剩绕轴转动", "沿 X、Y、Z 移动"],
      ["None", "Sliding along the axis and rotating about it", "Only rotating about the axis", "Moving along X, Y and Z"],
    ),
    answer: 1,
    explain: t(
      "同心去掉了横向移动和两种歪斜，共 4 个；沿轴滑和绕轴转还在。再加一个面重合，才只剩转动。",
      "Concentric removes sideways movement and the two kinds of tilt, 4 in all; sliding along the axis and rotating about it remain. Only when you add a coincident mate between faces is rotation all that's left.",
    ),
  },
  {
    q: t("零件已经完全定义，又加了一个和已有配合一致的配合，会怎样？", "A part is already fully defined, and you add a mate that agrees with an existing one. What happens?"),
    options: byLocale(
      ["更稳固，配合越多越好", "形成冗余：现在可能不报错，但一改尺寸就容易过定义", "软件会自动删掉它"],
      ["It's held more firmly: the more mates the better", "It's redundant: there may be no error now, but change a dimension and it easily becomes over-defined", "The software deletes it automatically"],
    ),
    answer: 1,
    explain: t(
      "冗余配合和已有配合抢同一个自由度。数值碰巧一致时能解，一旦尺寸或角度变化就互相冲突。",
      "A redundant mate competes with an existing mate for the same degree of freedom. While the values happen to agree it solves, but as soon as a dimension or an angle changes, the two conflict.",
    ),
  },
  {
    q: t("想让摆臂能绕销转动，最合适的配合组合是？", "You want the arm to turn about the pin. Which combination of mates fits best?"),
    options: byLocale(["同心 + 重合", "同心 + 重合 + 平行", "锁定"], ["Concentric + coincident", "Concentric + coincident + parallel", "Lock"]),
    answer: 0,
    explain: t(
      "同心加重合正好留下绕轴转动这 1 个自由度，也就是铰链；Fusion 里一个旋转联接就够了。再加平行会把转动也锁住，锁定则全部锁死。",
      "Concentric plus coincident leaves exactly 1 degree of freedom, rotation about the axis: a hinge. In Fusion, one Revolute joint is enough. Adding parallel locks the rotation as well, and Lock locks everything.",
    ),
  },
]

function DofPanel({ s }: { s: AsmState }) {
  const d = derive(s)
  const mates = [
    s.concentric && { name: t("同心1", "Concentric1"), what: t("销轴 ↔ 孔轴", "pin axis ↔ hole axis") },
    s.coincident && { name: t("重合1", "Coincident1"), what: t("摆臂底面 ↔ 底座顶面", "arm bottom ↔ base top") },
    s.angleMate && { name: t("角度1", "Angle1"), what: `${s.angle}°`, bad: d.conflict },
    s.parallel && { name: t("平行1", "Parallel1"), what: t("摆臂侧面 ∥ 底座前面", "arm side ∥ base front"), bad: d.conflict, warn: d.redundant },
  ].filter(Boolean) as { name: string; what: string; bad?: boolean; warn?: boolean }[]
  const status = d.conflict ? t("过定义", "Over-defined") : d.free.length === 0 ? t("完全定义", "Fully defined") : t(`自由度 ${d.free.length}`, `${d.free.length} DOF`)
  return (
    <div className="pointer-events-none absolute left-3 top-3 w-60 space-y-2">
      <SceneChip tone={d.free.length > 0 && !d.conflict ? "primary" : undefined} className={cn("w-fit", d.conflict && "text-destructive")}>
        {d.conflict && <TriangleAlert />}
        {t("摆臂", "Arm")} · {status}
      </SceneChip>
      <div className="rounded-lg border bg-popover p-1.5 shadow-popover">
        <div className="grid grid-cols-3 gap-1">
          {DOFS.map((x) => {
            const free = d.free.includes(x.id)
            return (
              <span
                key={x.id}
                className={cn("rounded-sm px-1.5 py-0.5 text-center text-caption", free ? "bg-selected text-foreground" : "text-faint-foreground line-through")}
              >
                {x.name}
              </span>
            )
          })}
        </div>
        <div className="mt-1.5 border-t px-1 pt-1.5 text-caption text-faint-foreground">{t("配合", "Mates")}</div>
        {mates.length === 0 && <div className="px-1 pb-0.5 text-small text-muted-foreground">{t("还没有", "None yet")}</div>}
        {mates.map((m) => (
          <div key={m.name} className={cn("flex items-baseline gap-2 px-1 py-0.5 text-small", m.bad && "text-destructive", m.warn && "text-warning")}>
            <span className="shrink-0 font-medium">{m.name}</span>
            <span className={cn("truncate text-caption", !m.bad && !m.warn && "text-muted-foreground")}>{m.what}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const lesson: LessonDef<AsmState, AssemblyScene> = {
  id: "assembly-dof",
  codes: ["2.1.2", "2.1.3", "2.1.4"],
  title: t("零件的 6 个自由度与配合", "A part's 6 degrees of freedom, and mates"),
  create: (v, emit) => new AssemblyScene(v, emit),
  steps: STEPS,
  quiz: QUIZ,
  takeaways: byLocale(
    [
      "自由的刚体有 6 个自由度：3 个移动、3 个转动；装配里要有一个零件固定",
      "每个配合去掉一些自由度：同心去掉 4 个，面重合去掉 3 个，重叠的部分不重复计算",
      "先想好零件该怎么动，用最少的配合表达它；冗余配合迟早变成过定义",
    ],
    [
      "A free rigid body has 6 degrees of freedom: 3 translations and 3 rotations. An assembly needs one fixed part",
      "Each mate takes away some degrees of freedom: concentric takes 4, a coincident mate between faces takes 3, and what they share isn't counted twice",
      "Decide first how the part should move, and express that with as few mates as possible; redundant mates sooner or later become over-defined",
    ],
  ),
  overlay: ({ s }) => <DofPanel s={s} />,
}

export default lesson
