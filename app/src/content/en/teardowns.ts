import type { ModelIndexEntry } from "@/three/model-index"

/**
 * The teardowns' catalog text in English. public/models/index.json is written by the model baker in
 * Chinese; this lays English over the fields shown on cards and in page titles, by model id. Ids,
 * `kind` and the counts stay as baked. The teardown pages themselves (the manifest's steps) are
 * still in Chinese.
 */
export type TeardownEn = { title: string; subtitle: string; teaches: string[] }

export const TEARDOWNS_EN: Record<string, TeardownEn> = {
  mug: {
    title: "Mug",
    subtitle: "Revolve · fillet · shell · sweep",
    teaches: ["A revolved part needs only half its profile", "Fillet before you shell", "A sweep's path and profile", "Fillets go last"],
  },
  brick: {
    title: "Building brick",
    subtitle: "Driven by a count · shell · rectangular pattern",
    teaches: ["Drive the dimensions with a count", "Shell before adding the studs", "Rectangular patterns", "The tubes underneath grip the studs"],
  },
  box_fillet_first: {
    title: "Small box A: fillet, then shell",
    subtitle: "Fillet order compared · one box, two ways",
    teaches: ["Feature order decides the result", "The shell offsets the fillets", "Inner and outer fillets share a center, so the wall stays even"],
  },
  box_shell_first: {
    title: "Small box B: shell, then fillet",
    subtitle: "Fillet order compared · one box, two ways",
    teaches: ["Feature order decides the result", "A fillet added afterwards rounds only the outside", "The wall gets thinner at the corners"],
  },
  keycap: {
    title: "Mechanical keyboard keycap",
    subtitle: "Loft · spherical cut · shell · cross stem",
    teaches: [
      "The loft makes the sloped sides, and the draft comes with it",
      "The sphere's radius sets the depth of the dish",
      "The shell makes the top as thick as the skirt",
      "The stem extrudes up to the underside of the top",
    ],
  },
  gear: {
    title: "Spur gear",
    subtitle: "Involute · driven by module and tooth count · circular pattern",
    teaches: ["A derived dimension: pitch diameter = m × z", "Draw just one tooth", "Circular patterns", "The bore scales with the gear"],
  },
  enclosure_bottom: {
    title: "Thermo-hygrometer bottom case",
    subtitle: "Draft · shell · screw bosses · ribs",
    teaches: ["The wall is the same thickness everywhere", "Draft lets the part come out of the mold", "Ribs tie the screw bosses to the side walls", "Ribs are about 60% of the wall thickness"],
  },
  enclosure: {
    title: "Desktop thermo-hygrometer",
    subtitle: "Top and bottom cases · screw bosses · exploded view",
    teaches: ["The two cases line up at the parting plane", "The screw bosses clamp the circuit board", "Bought-in parts are modeled as envelopes only", "The explode direction is the disassembly direction"],
  },
  hinge_box: {
    title: "Hinged box",
    subtitle: "Knuckles · pin · mates and degrees of freedom",
    teaches: ["The knuckles alternate along a single axis", "Interference fits and clearance fits", "The mates leave a single rotational degree of freedom"],
  },
  mouse_shell: {
    title: "Wireless mouse shell",
    subtitle: "Splines · lofted surface · shell · split line · draft",
    teaches: ["Big surfaces first, fillets after", "Concentric inner and outer fillets keep the wall even", "The split line goes where the fingers meet the palm", "The shell needs draft inside and out"],
  },
  toothbrush_handle: {
    title: "Electric toothbrush handle",
    subtitle: "Varying-section loft · button flat · overmold pockets · sealing",
    teaches: [
      "The section changes along the length: a steady grip, and you can feel which way it faces",
      "The button sits on a flat",
      "An overmold pocket needs a shut-off step at its edge",
      "Neither the button nor the charging recess leaves an opening to the outside",
    ],
  },
  desk_lamp: {
    title: "Desk lamp",
    subtitle: "Counterweight · friction hinge · heat sinking · cable routing",
    teaches: [
      "The center of mass stays over the base, so the lamp doesn't tip",
      "The friction hinge leaves a single rotational degree of freedom",
      "The LEDs' heat goes into the aluminum head",
      "The cable runs through the hinge's hollow axle",
    ],
  },
}

/** Difficulty levels, as the baker and the planned cards write them. */
export const LEVELS_EN: Record<string, string> = { 入门: "Beginner", 进阶: "Intermediate", 高级: "Advanced" }

/** What a planned card is (content/teardowns.ts). Display only: code compares the index's own `kind`. */
export const PLANNED_KINDS_EN: Record<string, string> = { 单零件: "Part", 装配: "Assembly" }

/**
 * The planned cards, by their Chinese title. The teardown index hides a planned card once a baked model
 * has the same title, so a planned model's English title must match its baked twin's (tested).
 */
export const PLANNED_EN: Record<string, { title: string; subtitle: string }> = {
  直齿轮: { title: "Spur gear", subtitle: "Involute · driven by module and tooth count" },
  六角螺栓与螺母: { title: "Hex bolt and nut", subtitle: "Polygon · chamfer · thread" },
  钣金支架: { title: "Sheet metal bracket", subtitle: "Flange · bend · flat pattern" },
  手电筒: { title: "Flashlight", subtitle: "Revolved parts · threads · assembly order" },
}

/** The model index with the English laid over it; whatever the overlay lacks stays as baked. */
export function localizeIndex(index: Record<string, ModelIndexEntry>, en: Record<string, TeardownEn> = TEARDOWNS_EN, levels: Record<string, string> = LEVELS_EN): Record<string, ModelIndexEntry> {
  return Object.fromEntries(
    Object.entries(index).map(([id, m]) => {
      const e = en[m.id]
      const level = levels[m.level] ?? m.level
      return [id, e ? { ...m, title: e.title, subtitle: e.subtitle, teaches: e.teaches, level } : { ...m, level }]
    }),
  )
}

type Planned = { title: string; subtitle: string; level: string; kind: string }

/** The planned cards in English; whatever the overlay lacks stays Chinese. */
export function localizePlanned<P extends Planned>(list: P[], en: Record<string, { title: string; subtitle: string }> = PLANNED_EN): P[] {
  return list.map((p) => ({
    ...p,
    title: en[p.title]?.title ?? p.title,
    subtitle: en[p.title]?.subtitle ?? p.subtitle,
    level: LEVELS_EN[p.level] ?? p.level,
    kind: PLANNED_KINDS_EN[p.kind] ?? p.kind,
  }))
}
