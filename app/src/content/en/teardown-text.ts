import type { BakedFeature, BakedPart, BakedVariant, Manifest } from "@/three/baked"

/**
 * The teardown pages' own text in English. Each public/models/<id>/manifest.json is baked from the
 * build123d models in Chinese; on English pages loadManifest lays this over it (localizeManifest):
 * for a part, its features' text, parameter labels and failure explanations; for an assembly, its
 * parts' names, materials, processes, notes and motion labels, and its design notes. Ids, ops,
 * numbers, code, views and focus boxes stay as baked, and anything missing here stays Chinese.
 *
 * Feature names (「拉伸2」) are not here: the page shows them as "Extrude2" (featureNameEn).
 */
export type FeatureEn = Partial<Pick<BakedFeature, "title" | "why" | "summary" | "summaryTemplate" | "pitfall">>

export type PartTextEn = {
  kind: "part"
  /** Parameter labels, by parameter id. */
  params: Record<string, string>
  /** By feature id. A summary keeps the Chinese one's numbers in the same order, a template its {param}s. */
  features: Record<string, FeatureEn>
  /** Why a feature fails with some values, by feature id. */
  failures: Record<string, string>
  /** A failed combination's reason where the baker wrote it in Chinese, by that text (the kernel's own are English). */
  reasons?: Record<string, string>
}

export type AssemblyPartEn = Partial<Pick<BakedPart, "name" | "note">> & { motion?: string }

export type AssemblyTextEn = {
  kind: "assembly"
  /** By part id. Materials and processes are shared words (MATERIALS_EN, PROCESSES_EN). */
  parts: Record<string, AssemblyPartEn>
  /** The design notes, in the Chinese order. */
  notes: string[]
}

export type TeardownTextEn = PartTextEn | AssemblyTextEn

/** Parameter units: a count has none in English (「4 个」 is just 4). */
export const UNITS_EN: Record<string, string> = { 个: "" }

/** Materials named in the assemblies, by their Chinese name (ABS, PMMA… stay as they are). */
export const MATERIALS_EN: Record<string, string> = { 不锈钢: "Stainless steel", 硅胶: "Silicone" }

/** Manufacturing processes named in the assemblies, by their Chinese name. */
export const PROCESSES_EN: Record<string, string> = {
  注塑: "Injection molding",
  外购: "Bought-in",
  "SMT 贴片": "SMT assembly",
  "注塑 / 激光切割": "Injection molding / laser cutting",
  标准件: "Standard part",
  模压: "Compression molding",
}

/** Words baked into the models' scenes besides the standard planes (those are bakedWords' own). */
export const SCENE_WORDS_EN: Record<string, string> = {
  齿根圆柱顶面: "Top face of the root cylinder",
  分度圆: "Pitch circle",
  齿顶圆: "Tip circle",
}

/** A scene label in English: 「分度圆 Ø27」 → "Pitch circle Ø27", 「基准面1」 → "Plane1". */
export function sceneWordsEn(text: string, words: Record<string, string> = SCENE_WORDS_EN) {
  let out = text.replace(/基准面(\d+)/g, "Plane$1")
  for (const w of Object.keys(words).sort((a, b) => b.length - a.length)) out = out.split(w).join(words[w])
  return out
}

// Shared by the two small boxes, which start the same way.
const BOX_START: Record<string, FeatureEn> = {
  sk1: {
    title: "Base rectangle",
    why: "Both versions start from the same sketch: a 60 × 40 rectangle on the top plane, centered on the origin.",
    summary: "Top plane · 60.0 × 40.0",
    summaryTemplate: "Top plane · {L} × {W}",
  },
  ext1: {
    title: "Solid box",
    why: "Extrude it into a solid block. Up to here A and B are identical; they part ways at the next step.",
    summary: "Height 30.0",
    summaryTemplate: "Height {H}",
  },
}
const BOX_PARAMS: Record<string, string> = { L: "Length", W: "Width", H: "Height", r: "Outer fillet", t: "Wall thickness" }

export const TEARDOWN_TEXT_EN: Record<string, TeardownTextEn> = {
  mug: {
    kind: "part",
    params: {
      H: "Height",
      D: "Rim diameter",
      d: "Base diameter",
      rb: "Bottom fillet",
      t: "Wall thickness",
      rl: "Rim fillet",
      reach: "Handle reach",
      span: "Handle span",
      ha: "Handle section thickness",
      hb: "Handle section width",
      rj: "Handle root fillet",
    },
    features: {
      sk1: {
        title: "Body half-section",
        why: "For a revolved part you draw only half the section; the revolve makes the other half. The section is drawn on the back of the mug, the side away from the handle, so the revolve's seam ends up there, clear of the handle.",
        summary: "Front plane · H96 · Ø84 / Ø72",
        summaryTemplate: "Front plane · H{H} · Ø{D} / Ø{d}",
        pitfall: "If the profile crosses the centerline, the revolve intersects itself and fails.",
      },
      rev1: {
        title: "Body",
        why: "First you get a solid “blank”. Every later feature adds to it or cuts from it, like a piece of bar stock on a lathe.",
        summary: "360° · about the centerline",
        summaryTemplate: "360° · about the centerline",
      },
      fil1: {
        title: "Outer bottom fillet",
        why: "Fillet the outer bottom edge before the shell: the shell offsets it inward into a concentric inner fillet, so the wall at the corner is as thick as everywhere else.",
        pitfall: "If the fillet radius equals the wall thickness exactly, the shell after it fails; if it's smaller, the inside corner comes out sharp. Try setting the two to the same value in the parameters.",
      },
      shell1: {
        title: "Hollow out the body",
        why: "The shell turns the solid into a thin-walled part with an even wall: the selected top face is opened, and every other face is offset inward by the wall thickness. Note that the kernel counts the ring-shaped face at the rim as the top face, “changed”, not as a new face.",
        summary: "Wall thickness 3.5 · top face removed",
        summaryTemplate: "Wall thickness {t} · top face removed",
      },
      fil2: {
        title: "Rim fillet",
        why: "The edges your lips touch must be smooth. This fillet depends only on the rim, so it goes before the handle: changing the handle later won't touch it.",
        summary: "R1.2 · inner and outer edges",
        summaryTemplate: "R{rl} · inner and outer edges",
        pitfall: "A radius over half the wall thickness doesn't fit: the inner and outer fillets run into each other.",
      },
      sk2: {
        title: "Handle path",
        why: "The path is drawn on the body's plane of symmetry, so the handle comes out symmetric left to right on its own. Both ends reach into the wall, so the swept handle can join the body as one solid.",
        summary: "Front plane · reach 30 · span 54",
        summaryTemplate: "Front plane · reach {reach} · span {span}",
      },
      sk3: {
        title: "Handle section",
        why: "The section is drawn on the plane normal to the path at its start. An ellipse is easier to grip than a circle: the narrow side rests against your fingers, and the wide side takes the load.",
        summary: "Ellipse 5.5×9 (semi-axes)",
        summaryTemplate: "Ellipse {ha}×{hb} (semi-axes)",
      },
      sweep1: {
        title: "Handle",
        why: "Moving the section along the path makes the handle, and at the same time it's merged with the body into one solid. The merge opens the handle's way into the wall, so the wall shows as “changed”.",
        summary: "Along Sketch2 · merged with the body",
        summaryTemplate: "Along Sketch2 · merged with the body",
      },
      fil3: {
        title: "Handle root fillet",
        why: "The fillet at the handle's root comes last: it uses the intersection edges that only exist after the merge; placed any earlier, it would have no edge to pick. With the fillet last, changes to earlier features are unlikely to break it.",
        pitfall: "Too large a root fillet eats into the handle's section or reaches inside the mug.",
      },
    },
    failures: {
      shell1:
        "The bottom fillet equals the wall thickness exactly. The shell has to offset the outer fillet inward into an inner fillet of radius “fillet − wall thickness”; when that radius is exactly zero, the face degenerates and the kernel can't compute it. With a fillet smaller than the wall, the kernel falls back to a sharp inner corner; with a larger one, the inner corner is a concentric fillet. In real models, make the fillet clearly larger than the wall thickness.",
      fil2: "The rim fillet doesn't fit: the two fillets together are wider than the wall.",
      fil3: "The handle root fillet failed: the geometry near the intersection is too narrow for the fillet to roll through. Reduce the fillet radius or thicken the handle.",
      sweep1: "The handle sweep failed: the path bends too sharply, and the section intersects itself at the bend.",
    },
  },

  box_fillet_first: {
    kind: "part",
    params: BOX_PARAMS,
    features: {
      ...BOX_START,
      fil1: {
        title: "Outer fillet",
        why: "Version A fillets the solid block first: the four vertical edges and the four bottom edges, leaving the top loop for the opening. Filleting a solid block is the easy case: there's no wall thickness to worry about.",
        summary: "R4 · vertical + bottom edges, 8 in all",
        summaryTemplate: "R{r} · vertical + bottom edges, 8 in all",
        pitfall: "The radius here decides whether the shell in the next step can succeed: it has to be larger than the wall thickness.",
      },
      shell1: {
        title: "Hollow out the box",
        why: "The shell offsets every face inward by the wall thickness, and the outer fillets become concentric inner fillets of radius “r − t”. So A's inside corners are round, and the wall at the corners is as thick as on the flat sides. Compare version B: its inside corners are sharp, and the wall is thinner at the corners.",
        summary: "Wall thickness 2.5 · top face removed",
        summaryTemplate: "Wall thickness {t} · top face removed",
        pitfall: "When the fillet equals the wall thickness exactly, the inner fillet's radius is zero and the shell fails. When the fillet is smaller than the wall, the inside corners turn sharp again.",
      },
    },
    failures: {
      shell1:
        "The outer fillet equals the wall thickness. The shell has to offset the R fillet inward into an inner fillet of radius “fillet − wall thickness”, and when that is exactly zero the kernel can't compute it. Make the fillet clearly larger than the wall and the inside corners are concentric fillets; clearly smaller, and they're sharp.",
    },
  },

  box_shell_first: {
    kind: "part",
    params: BOX_PARAMS,
    features: {
      ...BOX_START,
      shell1: {
        title: "Hollow out the box",
        why: "Version B shells first. At this point every edge of the box is sharp, so the cavity's corners are sharp too. Compare version A: it filleted first, so after the shell its inside corners are concentric fillets.",
        summary: "Wall thickness 2.5 · top face removed",
        summaryTemplate: "Wall thickness {t} · top face removed",
      },
      fil1: {
        title: "Outer fillet",
        why: "Then fillet the four outer vertical edges and the four bottom edges. The inside corners stay sharp, so the wall is thinner at the corners than on the flat sides: only “r − 1.41 × (r − t)” is left at the vertical edges, and only “r − 1.73 × (r − t)” at the bottom corners where three edges meet. A doesn't have this problem: its wall is the same thickness everywhere.",
        summary: "R4 · outer vertical + bottom edges, 8 in all",
        summaryTemplate: "R{r} · outer vertical + bottom edges, 8 in all",
        pitfall: "The larger the fillet and the thinner the wall, the more easily the fillet cuts through the corners. In an injection-molded part, thinned corners also sink and crack, so outer fillets usually go before the shell.",
      },
    },
    failures: {
      fil1: "The outer fillet cut through the wall at the corners. When the wall is very thin, the kernel refuses outright; when it only just cuts through, the kernel returns a solid that looks fine but whose inner and outer surfaces pass through each other, which only a self-intersection check catches. Use a smaller fillet or a thicker wall, or switch to version A: fillet, then shell.",
    },
    reasons: { "转角处的壁被圆角吃穿：内核给出了自相交的实体": "The fillet cut through the wall at the corners: the kernel returned a self-intersecting solid" },
  },

  brick: {
    kind: "part",
    params: {
      nx: "Studs along the length",
      ny: "Studs along the width",
      H: "Brick height",
      t: "Wall thickness",
      ds: "Stud diameter",
      hs: "Stud height",
      dt: "Tube outer diameter",
      rf: "Stud fillet",
    },
    features: {
      sk1: {
        title: "Base rectangle",
        why: "The outline isn't typed in as fixed numbers; it's computed from the stud count: side length = 8 × count − 0.2. The 0.2 is the gap left between two bricks side by side, 0.1 off each side. Change the count later and the size follows on its own.",
        summary: "Top plane · 4×2 studs · pitch 8",
        summaryTemplate: "Top plane · {nx}×{ny} studs · pitch 8",
        pitfall: "Draw it at exact multiples of 8 and two bricks side by side squeeze against each other and won't fit.",
      },
      ext1: {
        title: "Brick body",
        why: "Extrude the rectangle into a solid brick. The 9.6 height is a standard brick's: three plates stacked make exactly one brick.",
        summary: "Height 9.6",
        summaryTemplate: "Height {H}",
      },
      shell1: {
        title: "Hollow out the brick",
        why: "Pick the bottom face as the opening; every other face is offset inward by the wall thickness. The shell comes before the studs: the brick is still a simple box, which is when a shell is most reliable, and studs added afterwards don't get hollowed out.",
        summary: "Wall thickness 1.2 · bottom face removed",
        summaryTemplate: "Wall thickness {t} · bottom face removed",
        pitfall: "Add the studs before the shell and they get hollowed out into little cups too.",
      },
      boss1: {
        title: "First stud",
        why: "Make just one stud first, in the pattern's first position. The pattern copies this “seed” feature, so changing the stud diameter later means changing it in this one place.",
      },
      pat1: {
        title: "Stud pattern",
        why: "A rectangular pattern fills the top with studs at a pitch of 8; the count in each direction is the stud count from the parameters. The pattern spreads out symmetrically from the brick's center, so the studs are always centered.",
        summary: "4×2 · spacing 8",
        summaryTemplate: "{nx}×{ny} · spacing 8",
      },
      tube1: {
        title: "Bottom tube",
        why: "The tube stands right in the middle of four studs. Its outer diameter, 6.51, presses against all four studs around it at once, and that's what holds the brick tight. A brick with a single row of studs has no room for a hollow tube, so it gets thin solid pins between the studs instead; a 1×1 brick needs nothing at all.",
        summary: "Ø6.51 · from the bottom to the top wall",
        summaryTemplate: "Ø{dt} · from the bottom to the top wall",
        pitfall: "The tube has to stop at the underside of the top wall: too short, and it doesn't join the top wall and ends up as a floating piece.",
      },
      fil1: {
        title: "Stud top edges",
        why: "A small fillet on the studs' top edges keeps them from scratching your fingers as you put bricks together and pull them apart, and helps them line up. The fillet comes last, so changing the pattern count earlier doesn't make it lose its edges.",
      },
    },
    failures: {
      shell1: "The shell failed: the wall is too thick to leave room for the cavity.",
      fil1: "The stud fillet doesn't fit: its radius is larger than the stud's height or radius.",
    },
  },

  keycap: {
    kind: "part",
    params: {
      B: "Base side length",
      TX: "Top length",
      TY: "Top width",
      H: "Height",
      R: "Dish sphere radius",
      t: "Wall thickness",
      ds: "Stem outer diameter",
      rf: "Top edge fillet",
    },
    features: {
      sk1: {
        title: "Base profile",
        why: "The keycap's base is an 18 × 18 square: the 19.05 pitch of a 1u key position, minus the gaps on either side.",
        summary: "Top plane · 18 × 18",
        summaryTemplate: "Top plane · {B} × {B}",
      },
      sk2: {
        title: "Top profile",
        why: "The top is drawn on a plane 8 mm above the base, a size smaller than the base. One sketch large, one small: the loft in the next step joins them.",
        summary: "Plane1 (height 8) · 12.5 × 14",
        summaryTemplate: "Plane1 (height {H}) · {TX} × {TY}",
      },
      loft1: {
        title: "Keycap shape",
        why: "The loft joins the base and the top with four sloped sides. The slope itself is a generous draft angle: when the keycap is ejected from the mold, its sides don't rub against the mold.",
        summary: "Sketch1 → Sketch2 · ruled",
        summaryTemplate: "Sketch1 → Sketch2 · ruled",
        pitfall: "Both sketches need the same number of vertices, or the loft comes out twisted.",
      },
      cut1: {
        title: "Spherical dish",
        why: "A large sphere cuts a shallow dish into the top, so your fingertip lands right in the middle. The dish's opening is fixed at Ø11; the larger the sphere's radius, the shallower the dish: R25 gives a depth of 0.6, R50 only 0.3.",
        summary: "Sphere R35 · dish opening Ø11",
        summaryTemplate: "Sphere R{R} · dish opening Ø11",
        pitfall: "The sphere's pole mustn't land at the center of the dish. The surface is degenerate at the pole and the shell after it would fail, so the sphere is first turned 90° to lay its poles on the side.",
      },
      shell1: {
        title: "Hollow out the keycap",
        why: "The shell opens from the bottom face, and the top wall is offset downward along with the spherical surface, so even under the dish the top wall is one even wall thickness. Uneven walls are the worst thing for a molded part: thick spots cool slowly, and the surface sinks into dimples.",
        summary: "Wall thickness 1.5 · bottom face removed",
        summaryTemplate: "Wall thickness {t} · bottom face removed",
      },
      sk3: {
        title: "Cross stem section",
        why: "The stem's section is a Ø5.5 circle minus a cross-shaped hole. The 4 × 1.17 cross matches the cross-shaped tip of an MX switch stem; a slight interference is enough to hold it tight.",
        summary: "1 above the base · Ø5.5 circle − cross 4 × 1.17",
        summaryTemplate: "1 above the base · Ø{ds} circle − cross 4 × 1.17",
      },
      ext1: {
        title: "Cross stem",
        why: "The stem grows upward until it reaches the underside of the top wall. In CAD you'd usually pick the “up to next” end condition; here the height of the lowest point of that underside is computed, and the stem goes 0.3 further, into the top wall. The effect is the same, and the dimension is written out plainly.",
        summary: "To the underside of the top wall + 0.3",
        summaryTemplate: "To the underside of the top wall + 0.3",
        pitfall: "Stopping at the lowest point of the underside leaves a gap around the stem: the underside of the top wall is spherical and rises the farther it is from the center.",
      },
      fil1: {
        title: "Four top edges",
        why: "Last, put a small fillet on the four edges of the top so they don't feel sharp. Because it's last, changing the dish or the wall thickness earlier won't touch it.",
        pitfall: "The fillet can't be larger than the distance from the dish's opening to the edge, or it runs into the dish.",
      },
    },
    failures: {
      shell1: "The shell failed: the top wall, offset downward, ran into the side walls, or the dish is too deep.",
      ext1: "The stem didn't join the top wall into one solid.",
      fil1: "The top edge fillet doesn't fit: it reaches into the dish.",
    },
  },

  gear: {
    kind: "part",
    params: { m: "Module", z: "Number of teeth", alpha: "Pressure angle", B: "Face width", c: "Bore chamfer" },
    features: {
      sk1: {
        title: "Root circle",
        why: "Every circle on a gear comes from the module and the number of teeth: the pitch circle is d = m × z, the tip circle lies one m outside it, and the root circle 1.25 m inside it. The sketch draws only the root circle; the other circles are construction lines, kept as references for drawing the tooth later.",
        summary: "Pitch diameter d = m × z = 1.5 × 18 = 27",
        pitfall: "Don't type the pitch diameter in as a number: change the number of teeth later and it no longer matches.",
      },
      ext1: {
        title: "Root cylinder",
        why: "Extrude the root cylinder first: it's the gear blank. The teeth are added onto it later, one by one.",
        summary: "Face width 8",
        summaryTemplate: "Face width {B}",
      },
      sk2: {
        title: "One tooth",
        why: "The sketch sits on the top face of the root cylinder. The tooth flank is an involute: the path traced by the end of a string as you unwind it, kept taut, from the base circle. When two teeth mesh, this curve keeps the transmission ratio constant at every moment. Here a spline runs through 8 points between the base circle and the tip circle, and the other flank is a mirror of it.",
        summary: "Pressure angle 20° · involute profile",
        summaryTemplate: "Pressure angle {alpha}° · involute profile",
        pitfall: "With fewer than 17 teeth, real gear cutting undercuts part of the tooth root. What's drawn here is the theoretical tooth form.",
      },
      ext2: {
        title: "First tooth",
        why: "Extrude the tooth profile down from the top face by one face width, merging it with the blank. The tooth's foot deliberately reaches a little inside the root circle: the two solids overlap, which makes the merge reliable.",
        summary: "Face width 8 · merged",
        summaryTemplate: "Face width {B} · merged",
      },
      pat1: {
        title: "Circular pattern",
        why: "Copy the first tooth around the center axis into z teeth, equally spaced. To change the number of teeth you only change the pattern's count; the tooth profile and the circles are recomputed to follow.",
        summary: "18 instances · equally spaced over 360°",
        summaryTemplate: "{z} instances · equally spaced over 360°",
      },
      hole1: {
        title: "Shaft bore",
        why: "The bore diameter is 0.4 × the pitch diameter, rounded, so it's a derived dimension too: as the gear grows, the bore grows with it, and the rim always keeps enough thickness.",
        summary: "Ø11 ≈ 0.4 × pitch diameter · through all",
        pitfall: "Too large a bore leaves the rim under the tooth roots too thin, and under load it cracks from the root.",
      },
      cha1: {
        title: "Bore and tooth-tip chamfers",
        why: "The bore chamfer makes it easier to press the gear onto the shaft. Chamfering both ends of the tooth tips removes the sharp edges, so they don't scratch anything during assembly and are less likely to chip. The chamfers go last: they only dress the edges and don't change any dimensional relationship.",
        summary: "Bore C0.5 · tooth tips C0.375",
      },
    },
    failures: {
      ext2: "The tooth didn't merge with the blank into one solid.",
      pat1: "The patterned teeth didn't merge with the blank into one solid.",
      cha1: "The chamfer failed: the tooth tips are too narrow for a chamfer this size.",
    },
  },

  enclosure_bottom: {
    kind: "part",
    params: {
      W: "Length",
      L: "Width",
      R: "Corner radius",
      H: "Height",
      a: "Draft angle",
      t: "Wall thickness",
      D: "Screw boss outer diameter",
      dh: "Screw hole diameter",
      rf: "Boss root fillet",
    },
    features: {
      sk1: {
        title: "Outline",
        why: "The outline is drawn as a rounded rectangle, so the four large vertical corner rounds are already in the sketch and need no fillet of their own. Sketch fillets are more robust than solid fillets: the draft and shell that follow work on a clean shape.",
        summary: "Top plane · 68.0 × 52.0 · R10.0",
        summaryTemplate: "Top plane · {W} × {L} · R{R}",
      },
      ext1: {
        title: "Solid case",
        why: "Extrude it to 11 mm; the top face is the parting plane between the top and bottom cases. The top case also grows upward from this face, so the two parts line up here.",
        summary: "Height 11.0",
        summaryTemplate: "Height {H}",
      },
      dft1: {
        title: "Outer wall draft",
        why: "The outer walls draw in by 1° going down. The neutral plane is on the parting plane at z = 11, so the outline there stays 68 × 52 and meets the top case exactly; it gets smaller toward the bottom, so the part comes out of the cavity as soon as the mold opens. The four corner rounds are drafted too, which makes them conical faces.",
        summary: "1° · neutral plane z = 11.0 · narrowing downward",
        summaryTemplate: "{a}° · neutral plane z = {H} · narrowing downward",
        pitfall: "Put the neutral plane on the bottom face instead, and it's the outline at the parting plane that changes, so it no longer lines up with the top case.",
      },
      shell1: {
        title: "Hollow out the case",
        why: "Shell it with the top face removed; the floor is as thick as the side walls. Because the draft comes before the shell, the inner walls are offset from the outer ones and carry the same 1°, so the core pulls out just as well.",
        summary: "Wall thickness 1.8 · top face removed",
        summaryTemplate: "Wall thickness {t} · top face removed",
        pitfall: "Shell first and draft afterwards, and you have to pick the inner and outer rings of faces separately: it's easy to miss one, and the wall ends up uneven.",
      },
      boss1: {
        title: "Screw bosses",
        why: "Four screw bosses rise from the floor to z = 10.8, and the circuit board rests on their tops. The bosses stand about 3 mm from the side walls, which leaves room for the screwdriver and the battery holder.",
        summary: "Ø6 × 4 · floor to z = 10.8",
        summaryTemplate: "Ø{D} × 4 · floor to z = 10.8",
        pitfall: "Put a boss right against the side wall and the wall gets very thick there, leaving a sink mark on the outside.",
      },
      rib1: {
        title: "Ribs",
        why: "Each screw boss gets a rib to each of the two nearest side walls, so driving the screw doesn't push the boss crooked. The ribs are 60% of the wall thickness, so where a rib meets the wall it isn't thick enough to sink. The ribs are lower than the bosses, leaving room above them for the components on the board.",
        summary: "Rib thickness 0.6 × 1.8 · height 5.2",
        summaryTemplate: "Rib thickness 0.6 × {t} · height 5.2",
        pitfall: "Make a rib as thick as the wall and a sink mark shows on the other side.",
      },
      hole1: {
        title: "Screw clearance holes",
        why: "The holes go from the bottom face all the way through the screw bosses. Self-tapping screws come in from the bottom, pass through the circuit board and screw into the top case's bosses; on the bottom case these are only clearance holes, slightly larger than the M2 screws.",
        summary: "Ø2.4 × 4 · through all",
        summaryTemplate: "Ø{dh} × 4 · through all",
      },
      fil1: {
        title: "Boss root fillets",
        why: "A small fillet where the bosses meet the floor keeps stress from concentrating in a sharp corner and helps the plastic flow. The fillet goes last: the ribs and holes are settled, and it only dresses the intersection edges.",
        pitfall: "Too large a root fillet piles a ring of material around the boss's base, which makes it thick again and causes sink.",
      },
    },
    failures: {
      dft1: "The draft failed: the kernel couldn't turn the cylindrical faces at the corners into conical ones.",
      shell1: "The shell failed: the wall is too thick to leave room for the cavity.",
      rib1: "The ribs didn't join the screw bosses and side walls into one solid.",
      fil1: "The boss root fillet doesn't fit: it runs into the bottom of the ribs.",
    },
  },

  enclosure: {
    kind: "assembly",
    parts: {
      bottom: {
        name: "Bottom case",
        note: "The wall is 1.8 thick everywhere. The screw bosses' outer diameter is about 2.5 times the hole diameter, with ribs on two sides tying them to the side walls; the ribs are 60% of the wall thickness, so no sink marks show on the other side.",
      },
      battery: {
        name: "Coin cell CR2032",
        note: "Sits in the battery holder on the back of the circuit board. Its size is standard, so you use the manufacturer's STEP file instead of drawing it yourself.",
      },
      pcb: {
        name: "Circuit board (PCBA)",
        note: "The board is clamped between the upper and lower sets of screw bosses, with its four holes concentric with the bosses. Its outline is 1.2 smaller than the case's cavity on each side, which leaves assembly clearance.",
      },
      display: {
        name: "Display module",
        note: "For a bought-in part, an envelope built from the datasheet is enough: the outline, the thickness and where the FPC cable comes out are what the mechanical design really cares about.",
      },
      lens: {
        name: "Lens",
        note: "Attached from the inside of the top case, 2 mm larger than the window on each side; the overlap carries the glue. Its cosmetic face points outward and must not have ejector pin marks.",
      },
      top: {
        name: "Top case",
        note: "The parting line sits at the seam between the two cases (z = 11), so the cosmetic faces carry no parting line. The screw bosses grow down from the top wall, and the self-tapping screws are driven in from the bottom.",
      },
      screws: {
        name: "Self-tapping screw M2×15",
        note: "Goes in from the bottom, through the bottom case and the circuit board, and into the top case's bosses. Those bosses have only a Ø1.8 pilot hole, smaller than the screw, so the screw taps its own thread as it goes in; the thread engagement is about 3 mm.",
      },
      feet: {
        name: "Silicone foot",
        note: "The feet cover the screw heads exactly: one part does two jobs, keeping the case from sliding and hiding the screws. Each foot has a shallow recess on its upper side to clear the screw head.",
      },
    },
    notes: [
      "The two cases line up at the parting plane z = 11, and both drafts start from this plane: the bottom case narrows going down and the top case going up, so the outline at the seam is exactly the same on both.",
      "The screws go in from the bottom and are then covered by the feet, so no screw shows on the cosmetic faces.",
      "The circuit board isn't held by snap fits; it's clamped between the two sets of screw bosses. The bottom case's bosses hold it up from below, the top case's bosses press down on it, and each screw locks three parts at once.",
      "Bought-in parts (the battery, the display) are modeled only as envelopes: the outline, the thickness and where the cables come out are all you need.",
    ],
  },

  hinge_box: {
    kind: "assembly",
    parts: {
      body: {
        name: "Box body",
        note: "Three knuckles grow out of the outside of the back wall, molded in one shot with the body. The knuckle holes are drawn at the pin's nominal size, Ø2, with an interference tolerance, so once the pin is pressed in it stays put.",
      },
      lid: {
        name: "Lid",
        note: "Its two knuckles fit into the gaps between the body's three knuckles. The knuckle holes are Ø2.2, 0.2 larger than the pin, so the lid can turn about the pin.",
        motion: "Opening angle",
      },
      pin: {
        name: "Hinge pin Ø2×48",
        note: "Goes in last, from the side, through all five knuckles. To take the box apart, push the pin out along its axis and the lid comes off.",
      },
    },
    notes: [
      "Free in space, the lid has 6 degrees of freedom: 3 translations and 3 rotations. The hinge pin locks 5 of them and leaves only the rotation about the pin's axis.",
      "One pin, two fits: an interference fit in the body's knuckles, so the pin doesn't slide out; a clearance fit in the lid's knuckles, so the lid can turn.",
      "Neighboring knuckles have 0.4 mm of axial clearance between them, so their end faces don't rub as the lid turns. With too much clearance the lid wobbles along the axis: an extra degree of freedom you don't want.",
      "The hinge axis sits outside the back wall, right on the plane where the body and the lid meet, so when the lid opens its back edge swings around the axis without hitting the body.",
    ],
  },
}

const NUM = /\d+(?:\.\d+)?/g

/**
 * A baked summary in English. The baker writes one summary per parameter combination, derived values
 * included (the gear's pitch diameter), so a template filled from the parameters can't stand in for
 * it. The English summary for the default values carries the same numbers in the same order, and
 * another combination's numbers drop into it one by one. Undefined when the baked summary isn't the
 * default one's wording with other numbers.
 */
export function summaryEn(zhDefault: string, enDefault: string, zhBaked: string): string | undefined {
  const from = zhDefault.match(NUM) ?? []
  const to = zhBaked.match(NUM) ?? []
  if (zhBaked.replace(NUM, "#") !== zhDefault.replace(NUM, "#") || (enDefault.match(NUM) ?? []).join() !== from.join()) return undefined
  let i = 0
  return enDefault.replace(NUM, () => to[i++])
}

/** Only the fields the overlay has: an English field left out keeps the Chinese. */
const given = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/** A teardown's manifest with the English laid over it; whatever the overlay lacks stays as baked. */
export function localizeManifest<M extends Manifest>(m: M, overlay: Record<string, TeardownTextEn> = TEARDOWN_TEXT_EN): M {
  const en = overlay[m.id]
  if (m.kind === "assembly") {
    const a = en?.kind === "assembly" ? en : undefined
    return {
      ...m,
      parts: m.parts.map((p) => {
        const e = a?.parts[p.id]
        return {
          ...p,
          name: e?.name ?? p.name,
          note: e?.note ?? p.note,
          material: MATERIALS_EN[p.material] ?? p.material,
          process: PROCESSES_EN[p.process] ?? p.process,
          motion: p.motion && e?.motion ? { ...p.motion, label: e.motion } : p.motion,
        }
      }),
      notes: m.notes.map((n, i) => a?.notes[i] ?? n),
    }
  }
  const t = en?.kind === "part" ? en : undefined
  const zhSummary = new Map(m.features.map((f) => [f.id, f.summary]))
  const variant = (v: BakedVariant): BakedVariant => {
    const out = { ...v }
    if (v.reason && t?.reasons?.[v.reason]) out.reason = t.reasons[v.reason]
    if (v.summaries)
      out.summaries = Object.fromEntries(
        Object.entries(v.summaries).map(([id, s]) => {
          const e = t?.features[id]?.summary
          return [id, (e && summaryEn(zhSummary.get(id) ?? "", e, s)) || s]
        }),
      )
    return out
  }
  return {
    ...m,
    params: m.params.map((p) => ({ ...p, label: t?.params[p.id] ?? p.label, unit: UNITS_EN[p.unit] ?? p.unit })),
    features: m.features.map((f) => ({ ...f, ...given(t?.features[f.id] ?? {}) })),
    failures: Object.fromEntries(Object.entries(m.failures).map(([id, s]) => [id, t?.failures[id] ?? s])),
    variants: Object.fromEntries(Object.entries(m.variants).map(([k, v]) => [k, variant(v)])),
  }
}
