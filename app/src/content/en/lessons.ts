import type { LessonMeta } from "@/content/lessons/types"

/**
 * The interactive lessons' title and one-line gist in English, by lesson id (content/lessons/index.ts
 * keeps the Chinese). Only these two: the lessons themselves are still in Chinese.
 */
export const LESSONS_EN: Record<string, { title: string; gist: string }> = {
  // T0
  coordinates: {
    title: "Coordinate systems and views",
    gist: "X/Y/Z and the right-hand rule; orbit, pan and zoom; finding a face with the view cube; and Z-up versus Y-up.",
  },
  "datum-planes": {
    title: "Datum planes: the reference for all geometry",
    gist: "The three default datum planes; offset, angled and mid-plane datums; and why a sketch sits on a datum plane.",
  },
  projection: {
    title: "Orthographic projection: three views, first and third angle",
    gist: "Projecting inside the glass box, hidden lines, unfolding into three views and how they line up, and first-angle versus third-angle projection and their symbols.",
  },
  "section-views": {
    title: "Section views: cutting a part open",
    gist: "Drag a cutting plane through a part: the shape of the section, cutting on the centerline, 45° hatching, and why where you cut decides what the view shows.",
  },

  // T1
  "sketch-to-solid": {
    title: "From sketch to solid",
    gist: "Datum planes, sketches, constraints and degrees of freedom, extrude, and how downstream features follow when you change something upstream.",
  },
  "constraints-dof": {
    title: "Geometric constraints and degrees of freedom",
    gist: "Count degrees of freedom live with the FreeCAD solver: geometric constraints, dimensions, fully defined and over-defined (redundant / conflicting), and three ways to constrain one shape.",
  },
  revolve: {
    title: "Revolve: half a profile, once around an axis",
    gist: "A revolved part needs only half its profile; the angle, where the axis goes, and why a profile that crosses the axis fails.",
  },
  "pattern-mirror": {
    title: "Patterns and mirrors",
    gist: "Copying a seed feature by rule: linear patterns driven by spacing or by overall length, how a circular pattern divides the circle, and modeling half a part to mirror it.",
  },
  "fillet-chamfer": {
    title: "Fillets and chamfers",
    gist: "Pick edges to fillet and chamfer; why the radius has a limit; a fillet is tangent (G1), a chamfer leaves a corner (G0); and why fillets come last.",
  },
  "fillet-shell-order": {
    title: "Fillet first, or shell first?",
    gist: "One box, two feature orders: cut it open to see the wall at the corners, and change the parameters to see which fails first. The geometry comes from a real kernel.",
  },
  "sweep-loft": {
    title: "Sweep and loft",
    gist: "Sweeping a profile along a path, and why a bend that's too tight intersects itself; lofting between profiles, why misaligned start points twist, and how guide curves control the middle.",
  },
  "feature-tree": {
    title: "The feature tree, parent–child links and topological naming",
    gist: "A feature tree is a program rerun in order: rollback, parent–child references, a chamfer that fails once its fillet is deleted, and topological naming, where edges get renumbered.",
  },

  // T2
  "assembly-dof": {
    title: "A part's 6 degrees of freedom, and mates",
    gist: "The 6 degrees of freedom of a rigid body, which ones concentric, coincident and angle mates remove, and why redundant mates make an assembly over-defined.",
  },

  // T3
  dimensioning: {
    title: "Dimensioning principles",
    gist: "Click edges in three views to add dimensions: missing, duplicate and closed dimension chains are caught as you go, error stack-up in chain versus baseline dimensioning, and which view a dimension belongs in.",
  },
  "tolerance-fits": {
    title: "Dimensional tolerances and fits",
    gist: "Tolerance zone diagrams, IT grades and fundamental deviations; fit H7 with g6 / h6 / k6 / p6 in 3D for clearance, transition and interference fits; and hole-basis versus shaft-basis systems.",
  },
  "gdt-basics": {
    title: "Introduction to GD&T: datums and tolerance zones",
    gist: "Reading a feature control frame; 3D tolerance zones for flatness, perpendicularity and position, with a feature you drag in and out of tolerance; the 3-2-1 order of datums A/B/C; and the independency principle of GB and ISO versus ASME Rule #1.",
  },

  // T4
  "print-overhang": {
    title: "3D printing: overhangs and orientation",
    gist: "Overhang angles and the 45° rule, turning the part to do without supports, why the bond between layers is the weakest, and designing slopes in place of overhanging faces.",
  },
  "sheet-metal-bend": {
    title: "Sheet metal: bends, K-factor and flat patterns",
    gist: "The neutral axis and K-factor, bend allowance (BA) and flat length, bend lines on the flat pattern, bend reliefs and minimum flange length.",
  },
  "draft-analysis": {
    title: "Injection molding: draft and parting lines",
    gist: "Pull direction, draft analysis shading, why textured faces need more draft, parting lines, side holes as undercuts and the slides that form them, and uniform wall thickness.",
  },

  // T5
  "curvature-continuity": {
    title: "Curvature combs and G0 / G1 / G2 continuity",
    gist: "Read a curvature comb, drag control points to make G0, G1 and G2, and see why the arcs of a rounded rectangle are only G1.",
  },
  "zebra-stripes": {
    title: "Zebra stripes: judging surfaces by their reflections",
    gist: "Stripes that break, kink or flow smoothly mean G0, G1 or G2; pick out the G2 surface in a blind test, and see how fillets and blends differ in their highlights.",
  },
}

/** The lessons with the English title and gist laid over them; a lesson the overlay lacks stays Chinese. */
export function localizeLessons(list: LessonMeta[], en: Record<string, { title: string; gist: string }> = LESSONS_EN): LessonMeta[] {
  return list.map((l) => (en[l.id] ? { ...l, title: en[l.id].title, gist: en[l.id].gist } : l))
}
