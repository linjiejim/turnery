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
  "process-cost": {
    title: "Process overview: choosing by quantity",
    gist: "Seven ways to make one tray (three kinds of printing, CNC, urethane casting, molding, sheet metal); unit cost = one-off cost ÷ quantity + cost per part, on a log chart: drag the quantity, find the break-evens, change the assumptions and watch them move; then material, geometry, tolerance and lead time.",
  },
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
  undercuts: {
    title: "Undercuts, side actions and pickouts",
    gist: "An undercut is a face neither direction of the pull can see: turn the pull and watch the red update live, solve a side hole, an inside catch and a lip with a slide, lifter, shut-off, pickout, bump-off or redesign, then tally mold cost and cycle time.",
  },
  "snap-fits": {
    title: "Snap fits: sizing a cantilever and molding it",
    gist: "Live cantilever strain from ε = 1.5·t·y / L² with a strain-colored beam, the tapered beam, material limits and repeated assembly, lead versus return angle (self-locking), and a window under the hook so it can be molded.",
  },

  // T5
  "nurbs-curves": {
    title: "NURBS curves: control points, degree and knots",
    gist: "Drag control points to see that only degree + 1 spans move, switch between degrees 1, 2, 3 and 5, read the knot vector against the point count, drag edit points, and use a weight to draw an exact circle.",
  },
  "curve-rebuild": {
    title: "Curve quality and rebuilding",
    gist: "A hand-traced 46-point curve with a jittery comb: rebuild it by point count and degree against a deviation plot and a tolerance band, find the fewest points with no inflections, and see how too tight a tolerance traces the noise.",
  },
  "curvature-continuity": {
    title: "Curvature combs and G0 / G1 / G2 continuity",
    gist: "Read a curvature comb, drag control points to make G0, G1 and G2, and see why the arcs of a rounded rectangle are only G1.",
  },
  "surface-from-curves": {
    title: "Surfaces from curves",
    gist: "One panel built five ways (loft, one- and two-rail sweeps, network, edge curves) with their isoparms and deviation; matching curve sets to commands; why a loft twists or folds with misordered or reversed sections, and ripples through too many.",
  },
  "surface-matching": {
    title: "Surface continuity and matching",
    gist: "Rows 0, 1 and 2 of control points set G0, G1 and G2 when matching; check the seam with zebra stripes, break it and match again, see how matching reshapes a face with too few control points, and choose the master.",
  },
  "trim-stitch": {
    title: "Trim, split, join and close",
    gist: "Show naked edges, see why the join tolerance mustn't just be raised, extend and trim, match and cap six surfaces into a closed solid (the volume appears), and see how split differs from trim.",
  },
  "offset-thicken": {
    title: "Offset and thicken",
    gist: "Drag the wall thickness and watch the surface offset along its normals: why it self-intersects (a swallowtail) once the radius on the offset side is smaller than the wall, inward versus outward, the minimum-radius check, and three fixes.",
  },
  "zebra-stripes": {
    title: "Zebra stripes: judging surfaces by their reflections",
    gist: "Stripes that break, kink or flow smoothly mean G0, G1 or G2; pick out the G2 surface in a blind test, and see how fillets and blends differ in their highlights.",
  },
  "curvature-analysis": {
    title: "Curvature analysis and draft analysis",
    gist: "Principal, Gaussian and mean curvature maps, a blind hunt for a 0.3 mm dent, why developable surfaces unroll flat, and draft analysis with the parting line on a styled body.",
  },
  "patch-layout": {
    title: "Patch layout: primary, transition and fillet surfaces",
    gist: "One mouse, two layouts: one big trimmed surface versus primaries, transitions and corner patches. Compare isoparms and zebra stripes, label the 17 patches by clicking, then build it layer by layer.",
  },
  "singularities": {
    title: "Four-sided patches, poles and singular points",
    gist: "A dome collapsed to a pole versus a trimmed four-sided patch: converging isoparms and pinched zebra stripes, why a pole on a revolved shape is fine, the ring of control points next to the pole, and degenerate three-sided corners with two fixes.",
  },
  "bezier-class-a": {
    title: "Single-span patches, degree elevation and Class-A",
    gist: "Read one control net as a single degree-5 span or as several degree-3 or degree-2 spans and watch the comb and zebra stripes at the knot lines; elevate the degree without changing the shape; smooth a lumpy net by hand; join patches G1 / G2 / G3; and pick the sample closest to Class-A.",
  },
  "subd-modeling": {
    title: "SubD push-pull and conversion to NURBS",
    gist: "Push and pull a control cage into a handle with live Catmull–Clark subdivision, crease a sharp edge, find the star points, then convert to NURBS and see the patches and the continuity around star points.",
  },
  "shell-split": {
    title: "Splitting a styled housing: parting line, lip and assembly",
    gist: "Split a one-piece housing into two shells: only the widest section gives a single line, the parting line against the highlight and a shadow groove, the lip and groove in section, and screws from the bottom along the pull direction.",
  },
  "styling-dfm": {
    title: "DFM review of a styled part",
    gist: "Run draft, wall-thickness and undercut checks on a styled part without touching the Class-A surface: draft the inner walls, core out the thick thumb pad from inside, move the parting line to the character line, before and after until all three pass.",
  },

  // T6
  "visual-thinning": {
    title: "Visual thinning",
    gist: "Measure how thick a product looks from where the user really sits or stands: a tucked, curved-under or chamfered base faces down, away from the light, and is foreshortened; a top chamfer reads as top; a dark base and the parting line change only the bright band, not the outline.",
  },
  "fillet-hierarchy": {
    title: "Fillet hierarchy and corners",
    gist: "Rank the vertical, top and bottom fillets; equal radii make a spherical corner, unequal ones a torus if the biggest goes first, and the wrong order fails or leaves a crease; finish corners with a corner blend and check them with zebra stripes.",
  },
  "character-lines": {
    title: "Character lines and highlights",
    gist: "Drag a strip lamp and watch the highlight travel: a hard crease gives a light/shadow edge, a soft crease a thin line of light, and on a fading line the highlight leaves before the crease ends; a line catches light over about twice its crease angle.",
  },
  "proportion-scale": {
    title: "Proportion, massing and scale",
    gist: "A kettle's primary, secondary and tertiary masses; squint at the outline and measure the primary's share; the visual center of mass and the tipping angle; a real-size hand beside the same form from 5 to 50 cm, and why sizes set by the hand can't be scaled.",
  },
  anthropometry: {
    title: "Body dimensions and percentiles",
    gist: "Hand breadth as a distribution, and percentiles; why an opening sized to the average shuts out half; clearance to P95 and reach to P5; one size, sizes or adjustable; and why there is no average person.",
  },
  grip: {
    title: "Grip and handles",
    gist: "Power and precision grips; how handle diameter depends on the grip and the size of the hand; non-round sections for torque and orientation; and why to skip finger grooves.",
  },
  "button-feel": {
    title: "Button feel: the force–travel curve",
    gist: "Press a silicone key cut in half and watch its force–travel curve draw itself: F1, F2 and the return stroke, the snap ratio, tuning the web's thickness and angle, and why too much snap makes a key stick.",
  },
  "reach-vision": {
    title: "Sight lines and reach",
    gist: "Drag a screen and controls around a seated mannequin: the normal line of sight and optimum viewing zone, screen distance and height, normal and maximum reach, and checking both ends, P5 woman and P95 man.",
  },
  "perspective-ellipses": {
    title: "Perspective and ellipses",
    gist: "The viewport is your eye: the horizon is at eye height and horizontal edges vanish on it, in one-, two- and three-point perspective; drag a line onto an ellipse's minor axis and it lies on the cylinder's axis; the further from the horizon, the rounder the ellipse.",
  },
  "gap-flush": {
    title: "Gap and flush",
    gist: "A cover in a base: the tolerance chain behind gap and flush, worst case versus RSS, 1000 simulated assemblies; tighten the biggest link or shorten the chain with a common datum, then hide what's left with a designed step and a shadow line.",
  },
  "stiffness-ribs": {
    title: "A feel for stiffness: wall thickness and ribs",
    gist: "A simply supported ABS panel under a center load: double the wall and deflection drops to 1/8 for twice the mass; ribs instead of thickness, running with the bending, height beating thickness; molded ribs 40–60 % of the wall and no taller than about 3 walls, or they sink and won't fill.",
  },
  seals: {
    title: "Seals and O-ring grooves",
    gist: "An O-ring squashed in section: setting groove depth and width by squeeze and gland fill, leaving room for heat and swell, a plastic lid bowing between screws, and what an IP rating means.",
  },
  "living-hinge": {
    title: "Living hinges",
    gist: "Closing a one-piece box: the hinge's outer strain ≈ π·t ÷ 2L, why only PP or PE will do, gating the melt across the hinge, flexing it warm out of the mold, and sizing it from the guides.",
  },
  "electronics-layout": {
    title: "PCB layout and opening tolerances",
    gist: "Drop the board on its bosses, move the battery out of the antenna keep-out, leave room for a swelling cell, then size the USB-C opening from the plug overmold and the tolerance stack.",
  },
  disassembly: {
    title: "Design for disassembly",
    gist: "Take a small speaker apart part by part while a tally counts steps, tools, fastening kinds, glued joints and mixed materials; redesign with one screw type, snaps, a single plastic and >PP< marks, then sort it for recycling.",
  },
}

/** The lessons with the English title and gist laid over them; a lesson the overlay lacks stays Chinese. */
export function localizeLessons(list: LessonMeta[], en: Record<string, { title: string; gist: string }> = LESSONS_EN): LessonMeta[] {
  return list.map((l) => (en[l.id] ? { ...l, title: en[l.id].title, gist: en[l.id].gist } : l))
}
