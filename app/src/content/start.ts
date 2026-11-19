import { t } from "@/lib/i18n"

/**
 * Where a newcomer starts, said without curriculum codes: the few lessons everything else builds on,
 * and for four kinds of learner, the lessons that matter to them first. Ids are interactive lessons
 * (content/lessons/index.ts); the learning path and the home page both show these.
 */

/** The foundation, in order: space, datums, sketch → solid, constraints, the feature tree. */
export const START_ROUTE = ["coordinates", "datum-planes", "sketch-to-solid", "constraints-dof", "feature-tree"] as const

/** What each stone of the route says: shorter than the lessons' titles. */
export const ROUTE_LABELS: Record<(typeof START_ROUTE)[number], string> = {
  coordinates: t("坐标系与视图", "Coordinates and views"),
  "datum-planes": t("基准面", "Datum planes"),
  "sketch-to-solid": t("从草图到实体", "Sketch to solid"),
  "constraints-dof": t("约束与自由度", "Constraints and DOF"),
  "feature-tree": t("特征树", "The feature tree"),
}

export type StartingPoint = { id: string; who: string; why: string; lessons: string[] }

/** The four ways in (they follow the personas of curriculum.json, in plain words). */
export const STARTING_POINTS: StartingPoint[] = [
  {
    id: "designer",
    who: t("产品和工业设计师", "Product and industrial designers"),
    why: t("先把曲面做顺，再看它能不能脱模。", "Make surfaces smooth first, then check they can come out of a mold."),
    lessons: ["sweep-loft", "curvature-continuity", "zebra-stripes", "draft-analysis"],
  },
  {
    id: "maker",
    who: t("3D 打印和创客", "Makers and 3D printing"),
    why: t("从草图到能打印的零件，再把几个零件装起来。", "From a sketch to a printable part, then a few parts that fit together."),
    lessons: ["sketch-to-solid", "fillet-shell-order", "print-overhang", "assembly-dof"],
  },
  {
    id: "engineer",
    who: t("硬件和机械工程师", "Hardware and mechanical engineers"),
    why: t("模型改得动、图纸看得懂、公差说得清。", "Models you can change, drawings you can read, tolerances you can state."),
    lessons: ["constraints-dof", "feature-tree", "tolerance-fits", "gdt-basics"],
  },
  {
    id: "software",
    who: t("从软件转做硬件", "Software people moving to hardware"),
    why: t("特征树就是一张依赖图：先弄懂它怎么重算、为什么会断。", "A feature tree is a dependency graph: learn how it rebuilds and why it breaks."),
    lessons: ["feature-tree", "constraints-dof", "print-overhang", "dimensioning"],
  },
]
