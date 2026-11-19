/**
 * The glossary's concept cards in English: laid over the Chinese entries in ../terms.ts on English
 * pages, keyed by the term's id. `aka` is what else the idea goes by, shown beside the name there (the
 * Chinese pages show the term's `en` field in that place instead).
 */
export type TermEn = {
  name: string
  aka?: string
  def: string
  why: string
}

export const TERMS_EN: Record<string, TermEn> = {
  datum: {
    name: "Datum",
    def: "The references you measure from and sketch on: the origin, the three default planes, datum axes, and the offset planes and mid-planes you add yourself.",
    why: "A sketch attached to a datum holds up better than one attached to a model face: when the model changes, the datum doesn't disappear.",
  },
  dof: {
    name: "Degrees of freedom",
    aka: "DOF",
    def: "How many independent ways the geometry can still change. A point in a plane has 2, a line segment 4, a circle 3 (two for the center, one for the radius).",
    why: "Each constraint or dimension you add takes one away; only at 0 is the sketch fully defined.",
  },
  "fully-defined": {
    name: "Fully defined",
    aka: "fully constrained",
    def: "A sketch with zero degrees of freedom: constraints and dimensions fix its shape and position completely, so it can't be dragged. Most packages draw it in black; under-defined geometry is blue, and over-defined geometry turns red or yellow.",
    why: "An under-defined sketch drifts out of shape as you edit it; an over-defined one has constraints fighting each other.",
  },
  constraint: {
    name: "Geometric constraint",
    def: "A rule that relates pieces of geometry: coincident, horizontal, vertical, parallel, perpendicular, tangent, concentric, symmetric, equal. It carries no value; values belong to dimensions.",
    why: "Stating relationships with constraints preserves design intent better than piling up dimensions.",
  },
  "design-intent": {
    name: "Design intent",
    def: "How the model should behave when it changes. The same shape can be constrained in several ways, and each responds differently when a dimension changes.",
    why: "Certification exams and real work both test it: change one dimension, and does the model update the way you meant?",
  },
  parameter: {
    name: "Parameters and equations",
    aka: "derived dimensions",
    def: "Give the key dimensions names and derive the rest from them with equations. For a gear: pitch diameter = module × number of teeth.",
    why: "Change one value and everything follows; part families are built this way.",
  },
  "construction-geometry": {
    name: "Construction geometry",
    def: "Lines, circles and points in a sketch that serve only as references: centerlines, axes of symmetry, layout boxes. They take part in constraints but never become a feature's profile.",
    why: "Lay out a skeleton in construction geometry first and hang the real profile on it: fewer constraints, clearer intent.",
  },
  configuration: {
    name: "Configurations",
    aka: "variants",
    def: "Several sets of parameter values and feature on/off states stored in one model, each set one size or variant. Kept as a table, they are called a design table or configuration table.",
    why: "One model covers a whole series (M3 to M8, say): change the design once and every size updates.",
  },
  "feature-tree": {
    name: "Feature tree",
    aka: "history, timeline",
    def: "The ordered list of modeling steps. SOLIDWORKS calls it the FeatureManager design tree, Fusion the timeline, Onshape the Feature list. The model is what you get by running the list from the top.",
    why: "Treat the model as a program that runs in order, and you can read other people's models and keep your own easy to change.",
  },
  "parent-child": {
    name: "Parent–child relationship",
    def: "When a later feature references geometry from an earlier one (a sketch, face or edge), the earlier feature is its parent. Change the parent and the child recomputes by its own rules; delete the parent and the child fails.",
    why: "Before you change a feature, know what its children are.",
  },
  rollback: {
    name: "Rollback",
    def: "Stepping the feature tree back to an earlier point for a while, so it rebuilds only up to there. SOLIDWORKS and Onshape have a rollback bar; in Fusion you drag the timeline marker.",
    why: "The fastest way to see how someone built a model: drag the rollback bar and step through it. The teardowns on this site work the same way.",
  },
  tnp: {
    name: "Topological naming problem",
    aka: "TNP",
    def: "When an upstream feature changes, the faces and edges that downstream features reference get renumbered, so those features attach to the wrong geometry or lose their reference and fail.",
    why: "The main reason that changing something early breaks everything after it. The cure: reference datums and sketches, and put fillets last.",
  },
  "feature-order": {
    name: "Feature order",
    def: "The same features in a different order can give a different part, or none at all. The classic case: fillet then shell gives concentric inside fillets and an even wall; shell then fillet leaves sharp inside corners.",
    why: "The order is itself a design decision.",
  },
  "dumb-solid": {
    name: "Dumb solid",
    def: "A solid imported from a neutral format such as STEP or IGES: only faces and edges, with no sketches, dimensions or feature tree.",
    why: "You can't go back and change its parameters; you can only edit its faces directly or keep adding features on top.",
  },
  mate: {
    name: "Mates and joints",
    def: "Relationships that fix how parts sit relative to each other: coincident, concentric, distance, angle. SOLIDWORKS and Onshape call them mates; Fusion calls them joints.",
    why: "A free part has 6 degrees of freedom, and mates take them away one by one. What's left is how the mechanism can move.",
  },
  "over-defined-mate": {
    name: "Over-defined and redundant mates",
    def: "Extra mates that constrain degrees of freedom already taken away. It looks fine until you change a dimension, and then the mates conflict and fail.",
    why: "Fully defined is only a state; correctly defined is the goal.",
  },
  "external-reference": {
    name: "External reference",
    aka: "in-context reference",
    def: "A part's sketch or feature references geometry in another part, usually because it was drawn off its neighbor inside an assembly. When the referenced part changes, this one follows.",
    why: "Handy and risky: take the part out of that assembly and the reference breaks, and many of them tie parts together and slow rebuilds down.",
  },
  "exploded-view": {
    name: "Exploded view",
    def: "An assembly shown with its parts pulled apart along their disassembly directions, to show how it is built and the order it goes together in.",
    why: "Explode along the real disassembly directions, in the reverse of the assembly order.",
  },
  projection: {
    name: "First- and third-angle projection",
    def: "The two ways to arrange orthographic views. In first-angle projection the top view goes below the front view; in third-angle, above it. China's GB/T 4458.1 uses first angle by default; the US and many English-language tutorials use third angle.",
    why: "Read the projection wrong and everything you model from the drawing comes out flipped.",
  },
  section: {
    name: "Section view",
    def: "The part cut open by an imaginary plane, showing the cut face and what lies behind it. Where the plane cuts through solid material, the drawing shows hatching.",
    why: "Internal features you can't see from outside (holes, cavities, ribs) are shown with section views.",
  },
  draft: {
    name: "Draft angle",
    def: "The taper of a molded part's side walls relative to the pull direction. Typically 0.5°–2°; textured surfaces need 3° or more.",
    why: "Without draft, the part scuffs on ejection or even sticks in the mold.",
  },
  "parting-line": {
    name: "Parting line",
    def: "The line on the part where the two halves of the mold (core and cavity) meet. It sets the draft direction and whether a mark shows on a cosmetic surface.",
    why: "Undercuts, draft and appearance all depend on where the parting line goes.",
  },
  "uniform-wall": {
    name: "Uniform wall thickness",
    def: "A molded part's walls kept as even as possible; ribs and screw bosses take 40%–60% of the adjacent wall thickness.",
    why: "Uneven walls cool unevenly, which causes sink marks and warping.",
  },
  overhang: {
    name: "Overhang",
    def: "In 3D printing, a part of the model that sticks out with nothing underneath it. FDM printers can usually print unsupported out to about 45°.",
    why: "The print orientation decides whether you need supports, and in which direction the part is weakest.",
  },
  "k-factor": {
    name: "K-factor",
    def: "In sheet metal bending, the distance from the inside surface to the neutral axis divided by the sheet thickness, usually 0.3–0.5. It determines the flat length.",
    why: "Get the K-factor wrong and the flat pattern is cut to the wrong size.",
  },
  continuity: {
    name: "G0 / G1 / G2 continuity",
    aka: "geometric continuity",
    def: "How smoothly two curves or surfaces meet at a seam. G0 means they only touch, G1 that their tangents match, G2 that their curvature matches too, and G3 that the rate of change of curvature matches as well.",
    why: "An ordinary fillet is only G1, so highlights break at the seam; cosmetic surfaces on products usually call for G2.",
  },
  "curvature-comb": {
    name: "Curvature comb",
    def: "Short lines drawn normal to a curve, each in proportion to the curvature at that point, so that changes in curvature show up as the teeth of a comb. A jump in the comb at a seam means the joint isn't G2.",
    why: "The basic tool for judging the quality of a curve.",
  },
  zebra: {
    name: "Zebra stripes",
    def: "Stripes reflected onto a surface from a striped environment. Stripes that break at a seam mean G0, stripes that kink mean G1, and stripes that flow smoothly across mean G2.",
    why: "It judges surface quality by reflections, the same highlights a product photo shows.",
  },
}
