import type { Lesson, Module, Persona, Project, Track } from "@/content/curriculum"

/**
 * The curriculum's text in English (curriculum.json stays the Chinese source). Keyed by id; personas,
 * which have none, by their Chinese name. Only what is written in prose is here: a field left out
 * (an empty note, a prerequisite that is just a list of ids) keeps the Chinese value, which for those
 * is the same in both languages. The lessons' `en` field (the English CAD term shown beside the
 * Chinese title) is not touched: the English title below replaces the pair on English pages.
 */
export type CurriculumEn = {
  tracks: Record<string, { title: string; note?: string }>
  modules: Record<string, { title: string; note?: string }>
  lessons: Record<string, { title: string; goal: string; prereq?: string; interactiveNote?: string }>
  projects: Record<string, { title: string; prereq?: string }>
  personas: Record<string, { name: string; path?: string }>
}

export const CURRICULUM_EN: CurriculumEn = {
  tracks: {
    T0: { title: "Foundations: space, views and geometry", note: "Required for everyone, about 6–8 hours" },
    T1: { title: "Parametric part modeling", note: "The mechanical core, about 25–35 hours" },
    T2: { title: "Assemblies and mechanisms", note: "About 10–15 hours" },
    T3: { title: "Drawings and tolerances", note: "About 8–12 hours; 3.1 can also come straight after T1, as SOLIDWORKS Essentials does it" },
    T4: { title: "Design for manufacturing (DFM)", note: "About 12–18 hours" },
    T5: { title: "Curves, surfaces and styling", note: "The industrial design track, about 25–40 hours" },
    T6: {
      title: "Product design: form, ergonomics, CMF and product structure",
      note: "The other half of the industrial design track, about 20–30 hours: the surface track is about making faces smooth, this one is about what to make, who it is for and how it goes together",
    },
  },

  modules: {
    "M0.1": { title: "3D space and navigation" },
    "M0.2": { title: "Orthographic projection and reading drawings" },
    "M0.3": { title: "Geometry representations and files" },
    "M1.1": { title: "Sketches and constraints" },
    "M1.2": { title: "Basic features" },
    "M1.3": { title: "The feature tree and robust modeling", note: "Official courses treat this as a beginner skill: ACU 1.2.e, SW L8–L9" },
    "M1.4": { title: "Direct modeling and multi-body parts" },
    "M1.5": { title: "Advanced parametrics", note: "Intermediate" },
    "M2.1": { title: "Assembly basics" },
    "M2.2": { title: "Mechanisms and motion" },
    "M2.3": { title: "Top-down design", note: "Intermediate" },
    "M3.1": { title: "Engineering drawings" },
    "M3.2": { title: "Tolerances" },
    "M4.0": { title: "Choosing a process" },
    "M4.1": { title: "3D printing" },
    "M4.2": { title: "CNC machining" },
    "M4.3": { title: "Sheet metal" },
    "M4.4": { title: "Injection molding" },
    "M5.1": { title: "Curves" },
    "M5.2": { title: "Building surfaces" },
    "M5.3": { title: "Surface quality analysis" },
    "M5.4": { title: "Patch layout and an introduction to Class-A" },
    "M5.5": { title: "Freeform modeling" },
    "M5.6": { title: "From styling to engineering" },
    "M6.0": { title: "The design process", note: "A short read" },
    "M6.1": { title: "Form" },
    "M6.2": { title: "Ergonomics" },
    "M6.3": { title: "CMF: color, material and finish" },
    "M6.4": { title: "Presenting a design" },
    "M6.5": { title: "Product structure", note: "Turning a form into something that goes together" },
    "M6.6": { title: "From prototype to market", note: "A short read" },
  },

  lessons: {
    // T0
    "0.1.1": { title: "Coordinate systems and the right-hand rule", goal: "Point out the positive X, Y and Z directions from any view, and know that programs disagree on which axis is up", prereq: "None" },
    "0.1.2": { title: "View navigation and standard views", goal: "Use the standard views to bring any face of a model into view quickly" },
    "0.1.3": { title: "Origin, datum planes and datum axes", goal: "Understand that every piece of geometry needs a reference, and create offset, angled and mid-plane datums" },
    "0.1.4": { title: "Construction planes and coordinate input", goal: "Place points and lines precisely in a freeform modeler" },
    "0.2.1": { title: "Orthographic projection and three-view drawings", goal: "Derive the three views from a 3D part, and rebuild the 3D part from its three views" },
    "0.2.2": { title: "First-angle and third-angle projection", goal: "Recognize which projection method a drawing uses, and its symbol" },
    "0.2.3": { title: "Section, detail, auxiliary and broken views", goal: "Understand how cutting planes and hatching are shown", interactiveNote: "a cutting plane you can drag" },
    "0.2.4": { title: "Reading a drawing to model from it", goal: "Find the datums, the symmetry and the modeling order in a drawing" },
    "0.3.1": { title: "Solids, surfaces and meshes", goal: "Tell the three apart and know what each is for (CAD, printing, rendering)", prereq: "None" },
    "0.3.2": { title: "File formats and data exchange", goal: "Know which export formats lose the parameters and the history" },
    "0.3.3": { title: "Units, precision and material settings", goal: "Avoid the wrong unit or material that makes every mass wrong (a frequent CSWA mistake)", prereq: "None" },

    // T1
    "1.1.1": { title: "Sketch planes and anchoring to the origin", goal: "Attach every sketch to a datum and anchor it to the origin" },
    "1.1.2": { title: "Geometric constraints", goal: "Express how shapes relate with constraints instead of piling up dimensions" },
    "1.1.3": { title: "Dimensions and sketch degrees of freedom", goal: "Read the DOF count and fully define a sketch without redundant constraints", interactiveNote: "a drag test with a DOF counter" },
    "1.1.4": { title: "Construction geometry, project/convert entities, offset, trim and mirror", goal: "Reuse existing geometry so you need fewer constraints" },
    "1.1.5": { title: "Introduction to design intent", goal: "Constrain the same shape three ways, change a dimension, and compare how each one behaves" },
    "1.1.6": { title: "Parameters and equations", goal: "Drive the key dimensions with parameters", interactiveNote: "sliders that drive the model live" },
    "1.2.1": { title: "Extrude and end conditions", goal: "Choose the end condition that captures the design intent" },
    "1.2.2": { title: "Revolve", goal: "Model revolved parts and choose the axis of revolution" },
    "1.2.3": { title: "Booleans and multiple bodies", goal: "Understand that every feature is a Boolean operation on a body" },
    "1.2.4": { title: "Hole and thread features", goal: "Use a hole feature instead of cutting a sketched circle, so the manufacturing meaning is kept" },
    "1.2.5": { title: "Patterns and mirrors", goal: "Capture repetition in the design intent with patterns" },
    "1.2.6": { title: "Fillets and chamfers", goal: "Learn what order fillets go in and why they fail" },
    "1.2.7": { title: "Shell, rib and draft", goal: "Rough out a thin-walled part that could be injection molded" },
    "1.2.8": { title: "Sweep and loft", goal: "Build complex shapes from profiles and paths" },
    "1.3.1": { title: "The feature tree, timeline and rollback", goal: "See a model as a program that runs in order", interactiveNote: "a timeline you can drag" },
    "1.3.2": { title: "Parent–child relationships and choosing references", goal: "Predict which downstream features are affected when you edit or delete one", interactiveNote: "a visual dependency graph" },
    "1.3.3": { title: "The topological naming problem", goal: "Explain why changing an early feature breaks later ones, and know how to avoid it", interactiveNote: "watch an edge get renamed" },
    "1.3.4": { title: "Feature order strategy", goal: "Choose an order that is unlikely to fail", prereq: "1.3.2, 1.2.7" },
    "1.3.5": { title: "Diagnosing and fixing rebuild errors", goal: "Repair a model without redrawing it" },
    "1.3.6": { title: "Design change drills", goal: "Change the key dimensions and have the model still update as intended" },
    "1.4.1": { title: "Direct modeling", goal: "Decide when to edit geometry directly and when to use history-based modeling" },
    "1.4.2": { title: "Editing imported geometry", goal: "Modify a “dumb solid” that has no feature tree", prereq: "1.4.1, 0.3.2" },
    "1.4.3": { title: "Designing several parts in one context", goal: "Design mating parts side by side in the same context" },
    "1.5.1": { title: "Global variables and equations", goal: "Change one value and have the whole model follow" },
    "1.5.2": { title: "Configurations, variants and design tables", goal: "Manage a range of sizes from a single model" },
    "1.5.3": { title: "Mass properties, measurement and section analysis", goal: "Check a model by its volume, center of mass and sections (graded the way certification exams are)" },
    "1.5.4": { title: "Introduction to programmable features", goal: "Understand modeling logic as code" },

    // T2
    "2.1.1": { title: "Parts, components, subassemblies and BOM structure", goal: "Understand that an assembly references parts rather than copying them", prereq: "T1 basics" },
    "2.1.2": { title: "A rigid body's 6 degrees of freedom, and grounding", goal: "Say which degrees of freedom a part still has" },
    "2.1.3": { title: "Mates and joint types", goal: "Express the real motion with as few mates as possible" },
    "2.1.4": { title: "Over-definition, redundant mates and mate loops", goal: "Find and fix redundant mates (“fully defined is only a state; correctly defined is the goal”)" },
    "2.1.5": { title: "Interference and collision detection", goal: "Find interference and measure how much there is" },
    "2.2.1": { title: "Driving joints and motion studies", goal: "Move a mechanism through its degrees of freedom and check its limit positions" },
    "2.2.2": { title: "Common mechanisms", goal: "Express common mechanical motions with mates" },
    "2.3.1": { title: "In-context design and the risk of external references", goal: "Keep dependencies under control when one part references another's geometry", prereq: "2.1.x, 1.3.2" },
    "2.3.2": { title: "Skeleton and master models", goal: "Drive several parts from one layout" },
    "2.3.3": { title: "Standard parts, fasteners and hole alignment", goal: "Insert library parts and tie them to hole features" },

    // T3
    "3.1.1": { title: "Sheets, borders and title blocks", goal: "Set up a drawing template that follows the Chinese national standard (GB)" },
    "3.1.2": { title: "Creating views from the model", goal: "Choose a suitable set of views" },
    "3.1.3": { title: "Dimensioning principles", goal: "Make a drawing that can be both manufactured and inspected" },
    "3.1.4": { title: "Assembly drawings, balloons and the parts list", goal: "Produce the assembly documentation" },
    "3.2.1": { title: "Dimensional tolerances and fits", goal: "Choose a fit for a hole and shaft", interactiveNote: "an animated fit" },
    "3.2.2": { title: "Introduction to GD&T: datums and tolerance zones", goal: "Read the common geometric tolerance symbols", interactiveNote: "tolerance zones in 3D" },
    "3.2.3": { title: "Standards compared: GB/T, ISO and ASME Y14.5", goal: "Understand how Chinese and English-language drawings differ" },
    "3.2.4": { title: "Surface roughness and general notes", goal: "Write the basic general notes for a drawing" },

    // T4
    "4.0.1": { title: "Overview: additive, subtractive, sheet metal forming and injection molding", goal: "Choose a process for a part by quantity, material and cost", prereq: "T1 basics" },
    "4.1.1": { title: "Overhangs and supports", goal: "Design parts that print without supports", interactiveNote: "overhang shading" },
    "4.1.2": { title: "Print orientation and anisotropic strength", goal: "Choose the print orientation from the direction of the load" },
    "4.1.3": { title: "Minimum wall thickness, fine detail and bridging", goal: "Avoid features that won't print or that break easily" },
    "4.1.4": { title: "Clearances and print-in-place moving parts", goal: "Choose clearances for snap fits, hinges and threads (typically 0.2–0.5 mm)" },
    "4.2.1": { title: "Tool access and setup orientation", goal: "Tell whether a tool can reach a feature", interactiveNote: "a tool sweep demo" },
    "4.2.2": { title: "Inside corner radii and dog-bone/T-bone reliefs", goal: "Keep inside corner radii larger than 1/3 of the cavity depth" },
    "4.2.3": { title: "Ratio rules for cavity depth, hole depth, wall thickness and thread length", goal: "Keep cost down with ratio rules" },
    "4.2.4": { title: "Tolerances, surface finish and cost", goal: "Call out tight tolerances only where they are needed" },
    "4.3.1": { title: "How sheet metal is modeled", goal: "Use sheet metal features instead of cutting a solid" },
    "4.3.2": { title: "Bend radius, the neutral axis and the K-factor", goal: "Understand why the flat length depends on the K-factor", interactiveNote: "an animation of bending and unfolding" },
    "4.3.3": { title: "Bend reliefs, minimum flange length and hole-to-bend distance", goal: "Avoid tearing and distortion, knowing that every supplier's numbers differ" },
    "4.3.4": { title: "Flat patterns and DXF export", goal: "Deliver files for laser cutting" },
    "4.4.1": { title: "Uniform wall thickness, sink marks and warpage", goal: "Turn a solid part into one with uniform walls", interactiveNote: "a wall thickness heat map" },
    "4.4.2": { title: "Pull direction and draft", goal: "Run a draft analysis and fix what it finds" },
    "4.4.3": { title: "Parting lines", goal: "Choose where the parting line goes" },
    "4.4.4": { title: "Undercuts, side actions and pickouts", goal: "Recognize undercuts and choose how to deal with them" },
    "4.4.5": { title: "Ribs and bosses", goal: "Stiffen a part with ribs instead of thicker walls" },
    "4.4.6": { title: "Snap fits", goal: "Design snap fits that can be ejected from the mold" },
    "4.4.7": { title: "Fillets and stress concentration", goal: "Understand how inside and outside fillets relate to wall thickness" },

    // T5
    "5.1.1": { title: "NURBS curves: control points, degree, knots and edit points", goal: "Explain how the degree relates to the number of control points" },
    "5.1.2": { title: "Curve quality and rebuilding", goal: "Get a smooth curve from as few control points as possible" },
    "5.1.3": { title: "Curvature combs and curvature graphs", goal: "Spot inflection points and sudden jumps in curvature" },
    "5.1.4": { title: "Curve continuity: G0 / G1 / G2 / G3", goal: "Tell which continuity two curves have, and build the one you need" },
    "5.1.5": { title: "Blend and match curves", goal: "Turn a rounded rectangle from G1 into G2" },
    "5.2.1": { title: "Surfaces from curves", goal: "Choose the right way to build the surface for a shape" },
    "5.2.2": { title: "Surface continuity and matching", goal: "Bring adjacent surfaces to G1 or G2", prereq: "5.2.1, 5.1.4" },
    "5.2.3": { title: "Trim, split, knit and cap", goal: "Turn surfaces into a watertight solid" },
    "5.2.4": { title: "Offset and thicken", goal: "Get a part with real wall thickness from its outer surface" },
    "5.3.1": { title: "Zebra stripes and environment reflections", goal: "Use zebra stripes to tell G0, G1 and G2 apart" },
    "5.3.2": { title: "Curvature analysis (Gaussian and mean) and draft analysis", goal: "Find local dents and areas that won't release from the mold" },
    "5.3.3": { title: "Rolling-ball versus curvature-continuous fillets", goal: "See the difference in the highlights and choose between them" },
    "5.4.1": { title: "Patch layout: primary, transition and fillet surfaces", goal: "Plan the patch structure of a product" },
    "5.4.2": { title: "Four-sided patches, singularities and convergence points", goal: "Avoid triangular patches and degenerate points" },
    "5.4.3": { title: "Bézier vs NURBS, single-span surfaces and degree elevation", goal: "Understand why Class-A work prefers Bézier surfaces" },
    "5.4.4": { title: "Class-A: the idea and its quality criteria", goal: "Know what Class-A demands and which industries use it" },
    "5.5.1": { title: "Push-pull modeling with SubD, T-Splines and Fusion Form", goal: "Shape organic forms quickly" },
    "5.5.2": { title: "From SubD to NURBS, back into the engineering workflow", goal: "Hand a freeform shape over to engineering", prereq: "5.5.1, 5.2.3" },
    "5.6.1": { title: "Splitting a styled form into parts", goal: "Break a one-piece styled form into parts that can be manufactured", prereq: "5.2.4, M4.4" },
    "5.6.2": { title: "DFM review of styled parts", goal: "Meet the injection molding requirements without spoiling the design" },

    // T6
    "6.0.1": { title: "The design process: diverge, then converge", goal: "Know what each stage should produce and when to converge", prereq: "None" },
    "6.0.2": { title: "User research methods", goal: "Pick the method that answers your question: interviews, observation, surveys, usability tests" },
    "6.0.3": { title: "Writing a design brief", goal: "Put the target users, the situations of use, the constraints and the success criteria on one page" },
    "6.1.1": { title: "Visual thinning", goal: "Control how thick a product looks with tapered edges, chamfers and where the parting line goes", interactiveNote: "measure the apparent thickness from where the user looks" },
    "6.1.2": { title: "Fillet hierarchy and corners", goal: "Order large, medium and small fillets, and resolve the corner where three edges meet" },
    "6.1.3": { title: "Character lines and highlights", goal: "Steer highlights with hard creases, soft creases and fading surfaces", interactiveNote: "turn the light and watch the highlight lines" },
    "6.1.4": { title: "Proportion, massing and scale", goal: "Judge proportion by primary and secondary masses, visual weight and the scale of a hand" },
    "6.2.1": { title: "Body dimensions and percentiles", goal: "Size things for P5–P95, knowing there is no such thing as an average person", prereq: "None", interactiveNote: "a percentile slider" },
    "6.2.2": { title: "Grips and handles", goal: "Choose a handle's diameter and cross-section for the way it is held" },
    "6.2.3": { title: "How a button feels: the force–travel curve", goal: "Read a force–travel curve and shape the click with the structure", interactiveNote: "press the button and watch the curve being drawn" },
    "6.2.4": { title: "Sight lines and reach", goal: "Put screens and buttons where they can be seen clearly and reached" },
    "6.3.1": { title: "Materials and finishes", goal: "Understand roughness, metalness and what common surface finishes look like", prereq: "None", interactiveNote: "switch the finish on one model" },
    "6.3.2": { title: "Gloss shows every flaw", goal: "Know that glossy faces expose sink marks, and choose rib thickness and process for the finish", prereq: "4.4.1, 6.3.1" },
    "6.3.3": { title: "Texture and draft", goal: "Give a textured face enough draft for its texture depth", prereq: "4.4.2, 6.3.1" },
    "6.4.1": { title: "Perspective and ellipses", goal: "Find the horizon and the vanishing points, and line an ellipse's minor axis up with the axis of rotation", interactiveNote: "turn a cylinder and watch its ellipses" },
    "6.4.2": { title: "Lighting a product shot", goal: "Show the form clearly with key, fill and rim lights and the right focal length", interactiveNote: "drag the lights" },
    "6.4.3": { title: "Line weight and shading in sketches", goal: "Show volume with line weight and tonal values" },
    "6.5.1": { title: "Gap and flush", goal: "Predict the visible gaps and steps between parts from a tolerance stack", interactiveNote: "assemble 1,000 units in simulation" },
    "6.5.2": { title: "A feel for stiffness: wall thickness and ribs", goal: "Know that stiffness grows with the cube of the wall thickness, and use ribs instead of thicker walls" },
    "6.5.3": { title: "Seals and O-rings", goal: "Design a seal groove for the right squeeze and fill" },
    "6.5.4": { title: "Living hinges", goal: "Design a one-piece hinge for its material and strain" },
    "6.5.5": { title: "Laying out electronics and sizing openings", goal: "Place the PCB, battery and connectors, and work out how much clearance an opening in the housing needs" },
    "6.5.6": { title: "Design for disassembly and recycling", goal: "Use fewer fasteners and fewer mixed materials, so the product comes apart and its materials can be sorted" },
    "6.6.1": { title: "Prototype fidelity", goal: "Pick the prototype for the question you want answered: looks, structure or function" },
    "6.6.2": { title: "Safety and certification", goal: "Know where requirements such as drop tests, IP ratings and small-parts rules come from" },
    "6.6.3": { title: "Packaging and unboxing", goal: "Design the packaging and the unboxing as part of the product" },
  },

  projects: {
    P1: { title: "A 3D-printed storage box or phone stand (a first project for makers)", prereq: "T0, M1.1–1.3, M4.1" },
    P2: { title: "A sheet metal enclosure or bracket (for hardware engineers)", prereq: "T1, M4.3, T3" },
    P3: { title: "A handheld appliance housing: shape and draft → shell → screw bosses → ribs (industrial design meets engineering)", prereq: "M4.4, M6.5" },
    P4: { title: "A simple mechanism: a hinged box, gears or a linkage" },
    P5: { title: "A parametric part family (several size configurations)" },
    P6: { title: "Model-from-drawing challenge: graded like a certification exam, by the volume or center of mass you enter", prereq: "M0.2, T1" },
  },

  personas: {
    "产品/工业设计师": { name: "Product and industrial designers", path: "T0 → M5.1–5.3 → M6.1–6.4 → M1.1–1.3 (condensed) → M5.4–5.6 → M6.5 → M4.4 → P3" },
    Makers: { name: "Makers" },
    硬件工程师: { name: "Hardware engineers", path: "T0 → all of T1 → T2 → T3 → M4.2–4.4 → P2 / P4" },
    软件转硬件: {
      name: "Software developers moving into hardware",
      path: "T0 → T1 (above all 1.3, the dependency graph and TNP, and 1.5, parametrics and programmable features) → M4.1 → T2 → T3 basics → P1 / P5",
    },
  },
}

type Curriculum = { tracks: Track[]; projects: Project[]; personas: Persona[] }

/** The curriculum with the English laid over it; anything the overlay lacks stays Chinese. Ids and numbers are untouched. */
export function localizeCurriculum<C extends Curriculum>(data: C, en: CurriculumEn = CURRICULUM_EN): C {
  const lesson = (l: Lesson): Lesson => {
    const e = en.lessons[l.id]
    if (!e) return l
    return { ...l, title: e.title, goal: e.goal, prereq: e.prereq ?? l.prereq, interactiveNote: l.interactiveNote && (e.interactiveNote ?? l.interactiveNote) }
  }
  const mod = (m: Module): Module => {
    const e = en.modules[m.id]
    return { ...m, title: e?.title ?? m.title, note: e?.note ?? m.note, lessons: m.lessons.map(lesson) }
  }
  return {
    ...data,
    tracks: data.tracks.map((t) => {
      const e = en.tracks[t.id]
      return { ...t, title: e?.title ?? t.title, note: e?.note ?? t.note, modules: t.modules.map(mod) }
    }),
    projects: data.projects.map((p) => {
      const e = en.projects[p.id]
      return e ? { ...p, title: e.title, prereq: e.prereq ?? p.prereq } : p
    }),
    personas: data.personas.map((p) => {
      const e = en.personas[p.name]
      return e ? { name: e.name, path: e.path ?? p.path } : p
    }),
  }
}
