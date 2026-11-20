import { t } from "../lib/i18n"
import { ta } from "../lib/agent-lang"
import { z } from "zod"
import { FASTENER_TYPES, SCREW_HEADS } from "./fasteners"
import { SCREW_SIZES } from "./holes"
import { PartAppearance } from "./appearance"

/**
 * The studio's model: a parameter table plus an ordered feature tree, as plain
 * JSON. The AI edits it only through tools whose inputs are these schemas; the
 * kernel rebuilds it deterministically.
 *
 * Conventions (also in the system prompt): Z up, millimetres, degrees, origin
 * at the centre of the part's base.
 *
 * The field descriptions are in the agent's language (lib/agent-lang.ts) as it stands when this
 * module loads: they are read where that language is settled at start (the MCP server, the CLI).
 */

/** A number (mm or degrees) or a parameter expression such as "L/2+3" (rule stated once in the system prompt). */
export const Num = z.union([z.number(), z.string()])
// Plain fixed-length arrays rather than tuples: simpler JSON Schema for every provider.
export const Vec2 = z.array(Num).length(2).describe("[x, y]")
export const Vec3 = z.array(Num).length(3).describe("[x, y, z]")
export const Axis = z.enum(["X", "Y", "Z"])
export const Dir = z.enum(["+X", "-X", "+Y", "-Y", "+Z", "-Z"])
export const SurfaceKind = z.enum(["plane", "cylinder", "cone", "sphere", "torus", "freeform"])
export const CurveKind = z.enum(["line", "circle", "freeform"])
export const PlaneName = z.enum(["XY", "XZ", "YZ"])

const AtCoord = z
  .object({ axis: Axis, value: Num })
  .describe(ta('中心落在这个坐标上，例如 { "axis": "Z", "value": "H" }', 'Its center lies at this coordinate, e.g. { "axis": "Z", "value": "H" }'))

const faceFields = {
  of: z.string().optional().describe(ta("只选这个特征生成、且现在仍存在的面（特征 id）", "Only faces this feature made that still exist (feature id)")),
  normal: Dir.optional().describe(ta("平面的外法向", "Outward normal of a planar face")),
  kind: SurfaceKind.optional(),
  extreme: Dir.optional().describe(ta('沿这个方向最靠外的面，例如 "+Z" = 最上面的面', 'The faces farthest out along this direction, e.g. "+Z" = the topmost faces')),
  at: AtCoord.optional(),
  radius: Num.optional().describe(ta("圆柱面、圆锥面或球面的半径", "Radius of a cylindrical, conical or spherical face")),
  near: Vec3.optional().describe(ta("只保留离这个点最近的一个", "Keep only the one closest to this point")),
}
const FaceBase = z.object(faceFields)

export const FaceSelector = z
  .object({
    ...faceFields,
    not: FaceBase.optional().describe(ta("从结果里去掉满足这些条件的面", "Remove the faces that meet these conditions from the result")),
    expect: z.number().int().positive().optional().describe(ta("预期选中几个；数量不符时报错并列出候选", "How many it should select; a different count is an error that lists the candidates")),
  })
  .describe(ta("按语义选面：所有条件同时满足。每次重建都重新解析，不依赖编号", "Selects faces by meaning: all conditions must hold. Resolved again on every rebuild; doesn't depend on numbering"))

const edgeFields = {
  of: z.string().optional().describe(ta("只选这个特征生成的面上的边（特征 id）", "Only edges on faces this feature made (feature id)")),
  faces: FaceSelector.optional().describe(ta("只选这些面的边界边", "Only the boundary edges of these faces")),
  outer: z
    .boolean()
    .optional()
    .describe(
      ta(
        "和 faces 一起写：只要这些面的外轮廓边，不要面上孔口的边（盖面外缘倒圆角时用）",
        "Use with faces: only the outer boundary edges of these faces, not the edges of holes in them (for filleting the outer rim of a top face)",
      ),
    ),
  parallel: Axis.optional().describe(ta("平行于这个轴的直线边", "Straight edges parallel to this axis")),
  kind: CurveKind.optional(),
  extreme: Dir.optional().describe(ta('沿这个方向最靠外的边，例如 "+Z" = 最上面一圈边', 'The edges farthest out along this direction, e.g. "+Z" = the topmost loop of edges')),
  at: AtCoord.optional(),
  radius: Num.optional().describe(ta("圆弧边的半径", "Radius of an arc edge")),
  near: Vec3.optional().describe(ta("只保留离这个点最近的一条", "Keep only the one closest to this point")),
}
const EdgeBase = z.object(edgeFields)

export const EdgeSelector = z
  .object({
    ...edgeFields,
    not: EdgeBase.optional().describe(
      ta('从结果里去掉满足这些条件的边，例如 { "extreme": "+Z" } = 除了最上面一圈', 'Remove the edges that meet these conditions from the result, e.g. { "extreme": "+Z" } = all but the topmost loop'),
    ),
    expect: z.number().int().positive().optional().describe(ta("预期选中几条；数量不符时报错并列出候选", "How many it should select; a different count is an error that lists the candidates")),
  })
  .describe(ta("按语义选边：所有条件同时满足。每次重建都重新解析，不依赖编号", "Selects edges by meaning: all conditions must hold. Resolved again on every rebuild; doesn't depend on numbering"))

export const PlaneRef = z
  .object({
    plane: PlaneName.describe(
      ta(
        "XY = 上视基准面（草图 x→X, y→Y，法向 +Z）；XZ = 前视基准面（x→X, y→Z，法向 -Y）；YZ = 右视基准面（x→Y, y→Z，法向 +X）",
        "XY = top datum plane (sketch x→X, y→Y, normal +Z); XZ = front datum plane (x→X, y→Z, normal -Y); YZ = right datum plane (x→Y, y→Z, normal +X)",
      ),
    ),
    offset: Num.optional().describe(ta("沿该基准面的坐标轴平移：XY 为 Z 值、XZ 为 Y 值、YZ 为 X 值", "Shift along the datum plane's axis: a Z value for XY, a Y value for XZ, an X value for YZ")),
    face: FaceSelector.optional().describe(
      ta(
        "贴在这个平面上。与 plane 平行时坐标沿用基准面，offset 从该面再算；不平行（斜面）时草图原点在这个面的中心，x 沿面内的水平方向，y 沿面往上，法向朝外",
        "Sit on this planar face. When it is parallel to plane, the coordinates stay those of the datum plane and offset counts from the face; when it isn't (an inclined face), the sketch origin is at the face's center, x runs level within the face, y runs up the face, and the normal points outward",
      ),
    ),
    tilt: z
      .object({ axis: Axis, angle: Num.describe(ta("角度，右手定则", "Angle, right-hand rule")) })
      .optional()
      .describe(ta("斜的基准面：把（平移后的）基准面绕过原点的这根坐标轴转一个角度", "Inclined datum plane: rotate the (offset) datum plane by an angle about this coordinate axis through the origin")),
  })
  .describe(ta("草图平面", "Sketch plane"))

const Center = Vec2.optional().describe(ta("中心，草图坐标，缺省 [0, 0]", "Center, in sketch coordinates; default [0, 0]"))

/** A point of a polyline or path as the site's assistant writes it: a corner, or a three-point arc. */
export const WebPoint = z.union([Vec2, z.object({ to: Vec2, via: Vec2.describe(ta("圆弧经过的中间点", "The intermediate point the arc passes through")) })])
/** Every point form (desktop agents): also a rounded corner and a smooth spline. */
export const Point = z.union([
  Vec2,
  z.object({ to: Vec2, via: Vec2.describe(ta("圆弧经过的中间点", "The intermediate point the arc passes through")) }),
  z.object({ to: Vec2, r: Num.describe(ta("这个拐角倒的圆角半径", "Fillet radius of this corner")) }).describe(ta("走到 to，这个拐角倒 R 圆角", "Go to to, rounding this corner with radius r")),
  z
    .object({ spline: z.array(Vec2).min(1).describe(ta("依次光滑经过这些点，最后一个是终点", "Pass smoothly through these points in order; the last one is the end point")) })
    .describe(ta("从上一个点出发的光滑样条", "A smooth spline from the previous point")),
])
export type Point = z.infer<typeof Point>
const Cut = z.boolean().optional().describe(ta("从本草图前面的图形里挖掉（做出内孔）", "Cut out of the shapes before it in this sketch (to make an inner hole)"))

export const SketchShape = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("rect"),
    w: Num.describe(ta("宽（草图 x 方向）", "Width (sketch x direction)")),
    h: Num.describe(ta("高（草图 y 方向）", "Height (sketch y direction)")),
    center: Center,
    r: Num.optional().describe(ta("四角圆角半径", "Fillet radius of the four corners")),
    cut: Cut,
  }),
  z.object({ type: z.literal("circle"), d: Num.describe(ta("直径", "Diameter")), center: Center, cut: Cut }),
  z.object({
    type: z.literal("polygon"),
    sides: Num.describe(ta("边数（≥3 的整数，可以写参数）", "Number of sides (an integer ≥ 3; may be a parameter)")),
    d: Num.describe(ta("外接圆直径", "Circumscribed circle diameter")),
    center: Center,
    rotate: Num.optional(),
    cut: Cut,
  }),
  z.object({
    type: z.literal("slot"),
    length: Num.describe(ta("总长（两端圆弧外缘之间）", "Overall length (between the outer ends of the two arcs)")),
    width: Num.describe(ta("宽 = 两端圆弧直径", "Width = diameter of the end arcs")),
    center: Center,
    angle: Num.optional().describe(ta("相对草图 x 轴的角度", "Angle from the sketch x axis")),
    cut: Cut,
  }),
  z.object({
    type: z.literal("text"),
    text: z
      .string()
      .min(1)
      .max(60)
      .describe(ta("文字内容（常用汉字、英文、数字和常用符号；\\n 换行）", "The text (common Chinese characters, English letters, digits and common symbols; \\n for a new line)")),
    size: Num.describe(ta("字号 mm：汉字高度约等于它，大写字母约 0.73 倍", "Font size in mm: a Chinese character is about this tall, a capital letter about 0.73 times")),
    center: Vec2.optional().describe(ta("文字外框的中心，草图坐标，缺省 [0, 0]", "Center of the text's bounding box, in sketch coordinates; default [0, 0]")),
    angle: Num.optional().describe(ta("相对草图 x 轴旋转的角度", "Rotation from the sketch x axis")),
    cut: Cut,
  }),
  z.object({
    type: z.literal("path"),
    points: z
      .array(Point)
      .min(2)
      .describe(ta("开放的线，依次连接，不自动闭合；只能用于薄壁拉伸（thin）和筋（rib）", "An open line: joined in order, not closed automatically; only for thin extrusions (thin) and ribs (rib)")),
  }),
  z.object({
    type: z.literal("polyline"),
    points: z
      .array(Point)
      .min(2)
      .describe(
        ta(
          "依次连接并自动闭合；{to, via} 表示三点圆弧，{to, r} 是倒圆角的拐角，{spline: [...]} 是光滑样条",
          "Joined in order and closed automatically; {to, via} is a three-point arc, {to, r} a rounded corner, {spline: [...]} a smooth spline",
        ),
      ),
    cut: Cut,
  }),
])

const Base = {
  id: z
    .string()
    .regex(/^[A-Za-z][A-Za-z0-9_]*$/)
    .describe(ta('特征 id，英文，例如 "base", "pocket1"', 'Feature id, in English, e.g. "base", "pocket1"')),
  name: z.string().optional().describe(ta('中文显示名，例如 "底座拉伸"', 'Display name in the user\'s language, e.g. "Base extrude"')),
  intent: z.string().optional().describe(ta("一句话设计意图：为什么这样做", "Design intent in one sentence: why it is done this way")),
  suppressed: z.boolean().optional().describe(ta("压缩：暂时不参与重建（学习者在特征树里设置）", "Suppressed: left out of the rebuild for now (the learner sets this in the feature tree)")),
  part: z
    .string()
    .optional()
    .describe(
      ta(
        "零件名：只作用在这个零件上。加料时写一个还没有的名字，就新建一个零件（不和别的料合并）。有多个零件时不写：切除和孔作用在碰到的所有零件上，加料要正好接上一个零件",
        "Part name: acts on this part only. Adding material with a name that doesn't exist yet makes a new part (not merged with other material). Left out when there are several parts: cuts and holes act on every part they touch, and added material must join exactly one part",
      ),
    ),
}
const Mode = z
  .enum(["add", "cut", "intersect"])
  .optional()
  .describe(
    ta(
      "add = 加料（默认），cut = 切除，intersect = 求交（只留下和工具体重叠的部分）",
      "add = add material (default), cut = remove material, intersect = intersect (keep only what overlaps the tool body)",
    ),
  )
/** The site assistant's modes (intersect is desktop-only for now). */
export const WebMode = z.enum(["add", "cut"]).optional().describe(ta("add = 加料（默认），cut = 切除", "add = add material (default), cut = remove material"))

export const Feature = z.discriminatedUnion("op", [
  z.object({ ...Base, op: z.literal("sketch"), on: PlaneRef, shapes: z.array(SketchShape).min(1) }),
  z.object({
    ...Base,
    op: z.literal("extrude"),
    sketch: z.string().describe(ta("草图特征 id", "Sketch feature id")),
    distance: Num.optional().describe(ta("拉伸距离；用 until 或 through 时不写", "Extrude distance; leave it out with until or through")),
    mode: Mode,
    direction: z
      .enum(["normal", "reverse", "both"])
      .optional()
      .describe(ta("normal = 沿草图法向（默认），reverse = 反向，both = 两侧对称", "normal = along the sketch normal (default), reverse = the opposite way, both = symmetric on both sides")),
    through: z.boolean().optional().describe(ta("切除时贯穿全部（不写 distance）", "For a cut: through all (no distance)")),
    until: z
      .union([
        z
          .literal("next")
          .describe(
            ta(
              "成形到下一面：加料时一直长到碰到实体为止，切除时切到这段材料穿出为止",
              "Up to next: when adding, grow until it hits the solid; when cutting, cut until it comes out of this stretch of material",
            ),
          ),
        z.object({
          face: FaceSelector.describe(ta("成形到这个面（要正好选中一个）", "Up to this face (must select exactly one)")),
          offset: Num.optional().describe(ta("停在离这个面多远的地方，正值 = 还没到", "Stop this far from the face; positive = short of it")),
        }),
      ])
      .optional()
      .describe(
        ta(
          "成形到：设计意图是「到那个面为止」，不用自己算距离（不写 distance）。不需要就不要写这个字段",
          "Up to: the design intent is “as far as that face”, without computing the distance yourself (no distance). Leave this field out if you don't need it",
        ),
      ),
    thin: z
      .object({
        t: Num.describe(ta("壁厚", "Wall thickness")),
        side: z
          .enum(["center", "inside", "outside"])
          .optional()
          .describe(
            ta(
              "厚度加在线的哪一侧：center = 两侧各一半（缺省）；inside = 向里（封闭轮廓向内，开放的线向拐弯的那一侧）",
              "Which side of the line the thickness goes on: center = half on each side (default); inside = inward (into a closed profile; for an open line, toward the side it turns to)",
            ),
          ),
      })
      .optional()
      .describe(
        ta(
          "薄壁拉伸：只沿着轮廓线长出一圈等厚的壁；草图可以是开放的线（path）。普通的实心拉伸不要写这个字段",
          "Thin extrusion: grows only a wall of even thickness along the profile; the sketch may be an open line (path). Leave this field out for an ordinary solid extrusion",
        ),
      ),
    draft: Num.optional().describe(
      ta(
        "拔模角（度）：正值让侧壁沿拉伸方向向内收，一步拉出锥形凸台或带斜度的槽。不需要斜度就不要写",
        "Draft angle (degrees): a positive value tapers the side walls inward along the extrude direction, giving a tapered boss or a sloped slot in one step. Leave it out if you don't need a taper",
      ),
    ),
    onto: FaceSelector.optional().describe(
      ta(
        "沿这个面（平面或圆柱面，正好选中一个）的法向等深：草图沿草图法向投影到面上，切除时从面往里切 distance 深，加料时从面往外长 distance 高。圆柱面上刻字、凸字用它，各处深度一样。不需要就不要写",
        "Constant depth along the normal of this face (planar or cylindrical, exactly one selected): the sketch is projected onto the face along the sketch normal; a cut goes distance deep into the face, added material grows distance out from it. Use it for engraved and embossed text on a cylindrical face, so the depth is the same everywhere. Leave it out if you don't need it",
      ),
    ),
  }),
  z.object({
    ...Base,
    op: z.literal("revolve"),
    sketch: z.string(),
    axis: Axis.describe(ta("绕过原点的这根坐标轴旋转", "Revolve about this coordinate axis through the origin")),
    angle: Num.optional().describe(ta("角度，缺省 360", "Angle; default 360")),
    start: Num.optional().describe(
      ta(
        "起始角（度）：从草图所在的位置，绕轴按右手定则先转这么多再开始旋转",
        "Start angle (degrees): from where the sketch lies, first turn this much about the axis (right-hand rule), then start revolving",
      ),
    ),
    symmetric: z.boolean().optional().describe(ta("以草图所在的位置为中线，两侧各转 angle/2", "Use the sketch's position as the midline and turn angle/2 to each side")),
    mode: Mode,
  }),
  z.object({ ...Base, op: z.literal("fillet"), edges: EdgeSelector, r: Num.describe(ta("圆角半径", "Fillet radius")) }),
  z.object({ ...Base, op: z.literal("chamfer"), edges: EdgeSelector, d: Num.describe(ta("倒角距离", "Chamfer distance")) }),
  z.object({
    ...Base,
    op: z.literal("shell"),
    open: FaceSelector.describe(ta("要去掉（开口）的面", "Faces to remove (the openings)")),
    t: Num.describe(ta("壁厚，向内", "Wall thickness, inward")),
  }),
  z.object({
    ...Base,
    op: z.literal("hole"),
    on: PlaneRef.describe(ta("孔口所在平面，孔沿法向的反方向钻进去", "The plane the hole opens on; the hole is drilled opposite to its normal")),
    at: z.array(Vec2).min(1).describe(ta("孔中心，草图坐标", "Hole centers, in sketch coordinates")),
    d: Num.optional().describe(ta("孔径；用 standard 时不填", "Hole diameter; leave it out with standard")),
    standard: z
      .object({
        size: z.enum(SCREW_SIZES).describe(ta("公制螺纹规格", "Metric thread size")),
        fit: z
          .enum(["clearance", "close", "tap", "insert"])
          .optional()
          .describe(
            ta(
              "clearance = 普通过孔（缺省），close = 精配过孔，tap = 螺纹孔：钻攻丝底孔并标出装饰螺纹，insert = 热熔螺母孔（3D 打印件用：按常见标准款开孔，深度缺省为螺母长 + 1）",
              "clearance = normal clearance hole (default), close = close-fit clearance hole, tap = tapped hole: drills the tap drill and marks a cosmetic thread, insert = heat-set insert hole (for 3D-printed parts: sized for a common standard insert; depth defaults to the insert length + 1)",
            ),
          ),
        head: z
          .enum(["cbore", "csink"])
          .optional()
          .describe(
            ta(
              "过孔加沉头：cbore = 内六角圆柱头螺钉的沉孔，csink = 沉头螺钉的锥口",
              "Adds a head recess to the clearance hole: cbore = counterbore for a socket head cap screw, csink = countersink for a flat head screw",
            ),
          ),
      })
      .optional()
      .describe(
        ta(
          "标准孔：按 ISO 公制螺钉自动定孔径、沉孔和螺纹，不用自己查表",
          "Standard hole: sets the diameter, the counterbore or countersink and the thread from ISO metric screws, so you don't look up tables yourself",
        ),
      ),
    depth: Num.optional().describe(ta("孔深，缺省贯穿", "Hole depth; default through all")),
    cbore: z.object({ d: Num, depth: Num }).optional().describe(ta("沉头孔（柱形沉孔）", "Counterbore (cylindrical recess)")),
    csink: z.object({ d: Num, angle: Num.optional() }).optional().describe(ta("埋头孔（锥形，缺省 90°）", "Countersink (conical; default 90°)")),
    reverse: z.boolean().optional().describe(ta("沿法向钻（反过来）", "Drill along the normal (reversed)")),
  }),
  z.object({
    ...Base,
    op: z.literal("linear_pattern"),
    features: z.array(z.string()).min(1).describe(ta("要复制的加料/切除/孔特征 id", "Ids of the add / cut / hole features to copy")),
    dir: Dir,
    count: Num.describe(ta("总个数（含原来那个），≥2 的整数，可以写参数", "Total count (including the original), an integer ≥ 2; may be a parameter")),
    spacing: Num,
    dir2: Dir.optional(),
    count2: Num.optional().describe(ta("第二方向的个数", "Count in the second direction")),
    spacing2: Num.optional(),
  }),
  z.object({
    ...Base,
    op: z.literal("circular_pattern"),
    features: z.array(z.string()).min(1),
    axis: Axis.describe(ta("绕过原点的这根轴", "About this axis through the origin")),
    count: Num.describe(ta("总个数（含原来那个），≥2 的整数，可以写参数", "Total count (including the original), an integer ≥ 2; may be a parameter")),
    angle: Num.optional().describe(ta("总角度，缺省 360（等分整圈）", "Total angle; default 360 (evenly around the full circle)")),
  }),
  z.object({
    ...Base,
    op: z.literal("sweep"),
    path: z
      .object({
        on: PlaneRef.describe(ta("路径所在的平面", "The plane the path lies on")),
        points: z
          .array(Point)
          .min(2)
          .describe(ta("路径点（不闭合）；{to, via} 是三点圆弧，{spline: [...]} 是光滑样条", "Path points (not closed); {to, via} is a three-point arc, {spline: [...]} a smooth spline")),
        corner: Num.optional().describe(
          ta("直线拐角处自动倒的圆角半径（路径不能有尖角，否则截面会自交）", "Radius rounded automatically into straight corners (the path can't have sharp corners, or the profile self-intersects)"),
        ),
      })
      .describe(ta("扫掠路径", "Sweep path")),
    profile: z
      .discriminatedUnion("type", [
        z.object({ type: z.literal("circle"), d: Num }),
        z.object({ type: z.literal("rect"), w: Num.describe(ta("在路径平面内的宽", "Width in the path's plane")), h: Num.describe(ta("垂直于路径平面的高", "Height perpendicular to the path's plane")) }),
      ])
      .describe(ta("截面：放在路径起点、垂直于路径", "Profile: placed at the start of the path, perpendicular to it")),
    mode: Mode,
  }),
  z.object({
    ...Base,
    op: z.literal("loft"),
    sketches: z
      .array(z.string())
      .min(2)
      .describe(
        ta(
          "按顺序连接的草图（每个只能有一个闭合轮廓，通常画在一组平行的偏移平面上）",
          "Sketches joined in order (each with exactly one closed profile, usually on a set of parallel offset planes)",
        ),
      ),
    ruled: z.boolean().optional().describe(ta("true = 截面之间用直纹面（棱角分明），缺省光滑过渡", "true = ruled surfaces between the profiles (sharp edges); default is a smooth transition")),
    mode: Mode,
  }),
  z.object({
    ...Base,
    op: z.literal("draft"),
    faces: FaceSelector.describe(ta("要加拔模角的面（通常是侧壁）", "Faces to draft (usually side walls)")),
    angle: Num.describe(ta("拔模角，度；正值让侧壁朝开模方向向内收", "Draft angle in degrees; a positive value tapers the side walls inward toward the pull direction")),
    neutral: z
      .object({
        plane: PlaneName,
        offset: Num.optional(),
        face: FaceSelector.optional().describe(
          ta(
            "用这个平面作中性面（例如不在基准面上的分型面）；写了它时 plane、offset 不用",
            "Use this planar face as the neutral plane (e.g. a parting face not on a datum plane); with it, plane and offset aren't used",
          ),
        ),
      })
      .describe(ta("中性面：这里的尺寸保持不变，通常是分型面或底面", "Neutral plane: dimensions here stay the same; usually the parting plane or the bottom face")),
  }),
  z.object({
    ...Base,
    op: z.literal("split"),
    by: PlaneRef.describe(ta("切面：写法和草图平面一样（基准面加偏移，或贴在一个平面上）", "Cutting plane: written like a sketch plane (a datum plane plus offset, or on a planar face)")),
    parts: z
      .array(z.string().min(1).max(20))
      .length(2)
      .describe(
        ta(
          "切开后两侧的零件名：先写切面法向背面一侧的，再写法向一侧的（XY 的法向是 +Z：先下后上）",
          "Names of the parts on the two sides after the split: first the side behind the plane's normal, then the side it points to (XY's normal is +Z: bottom first, then top)",
        ),
      ),
    of: z.string().optional().describe(ta("已经有多个零件时，要拆哪一个", "Which part to split when there are already several")),
  }),
  z.object({
    ...Base,
    op: z.literal("import"),
    file: z
      .string()
      .min(1)
      .max(200)
      .describe(
        ta(
          "STEP 文件，相对零件文件所在的文件夹，例如 \"board.step\"。只在桌面版 Turnery 里能读文件",
          "STEP file, relative to the part file's folder, e.g. \"board.step\". Files can only be read in the Turnery desktop app",
        ),
      ),
    mode: z
      .enum(["reference", "add", "cut"])
      .optional()
      .describe(
        ta(
          "reference = 参考体（缺省）：只显示、用来对齐和核对间隙、干涉，不并入零件也不导出；add = 并入实体；cut = 从实体里减去（按元件挖让位槽）",
          "reference = reference body (default): only shown, used for alignment and for checking clearance and interference; not merged into the part and not exported; add = merged into the solid; cut = subtracted from the solid (cuts relief pockets shaped like the component)",
        ),
      ),
    rotate: z
      .array(z.object({ axis: Axis, angle: Num }))
      .max(3)
      .optional()
      .describe(ta("依次绕过原点的坐标轴旋转，角度用度；先旋转、后平移", "Rotations about coordinate axes through the origin, in order, in degrees; rotate first, then translate")),
    at: Vec3.optional().describe(ta("平移 [x, y, z]", "Translation [x, y, z]")),
  }),
  // Desktop (Turnery) only: an assembly (*.turnery-asm.json) is a tree of these, each a part file placed in it.
  z.object({
    ...Base,
    op: z.literal("component"),
    file: z
      .string()
      .min(1)
      .max(200)
      .optional()
      .describe(
        ta(
          "零件文件（.turnery.json）、子装配（.turnery-asm.json）或外购件（.step），相对装配文件所在的文件夹；放标准件时不写，写 standard",
          "Part file (.turnery.json), subassembly (.turnery-asm.json) or purchased part (.step), relative to the assembly file's folder; leave it out for a standard part and write standard instead",
        ),
      ),
    standard: z
      .object({
        type: z
          .enum(FASTENER_TYPES)
          .describe(
            ta(
              "screw 螺钉、nut 六角螺母（ISO 4032）、washer 平垫圈（ISO 7089）、insert 热熔螺母（3D 打印件用）",
              "screw = screw, nut = hex nut (ISO 4032), washer = flat washer (ISO 7089), insert = heat-set insert (for 3D-printed parts)",
            ),
          ),
        size: z.enum(SCREW_SIZES),
        head: z
          .enum(SCREW_HEADS)
          .optional()
          .describe(
            ta(
              "螺钉头：socket 内六角圆柱头（ISO 4762，缺省）、button 内六角半圆头（ISO 7380）、flat 内六角沉头（ISO 10642）、pan 十字盘头（ISO 7045）",
              "Screw head: socket = socket head cap (ISO 4762, default), button = button head socket (ISO 7380), flat = flat head socket countersunk (ISO 10642), pan = Phillips pan head (ISO 7045)",
            ),
          ),
        length: Num.optional().describe(
          ta("螺钉长度 mm（沉头螺钉含头，其余从头的底面算）", "Screw length in mm (including the head for flat head screws; from the underside of the head for the others)"),
        ),
      })
      .optional()
      .describe(
        ta(
          "标准件：不用零件文件，按 ISO 尺寸生成，零件清单里写规格。轴线沿 Z：螺钉头的底面（支承面）在 z=0、螺杆朝 -Z（沉头螺钉头顶在 z=0），螺母、垫圈从 z=0 往上，热熔螺母顶面在 z=0 往下",
          "Standard part: no part file; made to ISO dimensions, listed by its size in the BOM. Axis along Z: the underside of the screw head (bearing face) at z=0 with the shank toward -Z (for a flat head screw, the top of the head at z=0); nuts and washers go up from z=0; a heat-set insert's top face is at z=0 and it goes down",
        ),
      ),
    rotate: z
      .array(z.object({ axis: Axis, angle: Num }))
      .max(3)
      .optional()
      .describe(ta("依次绕过原点的坐标轴旋转，角度用度；先旋转、后平移", "Rotations about coordinate axes through the origin, in order, in degrees; rotate first, then translate")),
    at: Vec3.optional().describe(ta("平移 [x, y, z]，零件自己的原点放到这里", "Translation [x, y, z]: the part's own origin goes here")),
    mates: z
      .array(
        z.object({
          type: z
            .enum(["contact", "flush", "coaxial"])
            .describe(
              ta(
                "contact = 面贴面（两个平面法向相反、贴住）；flush = 平齐（法向相同、在同一平面）；coaxial = 同轴（圆柱面或圆锥面的轴线对齐，例如螺钉进孔）",
                "contact = face to face (two planar faces with opposite normals, touching); flush = flush (same normal, in the same plane); coaxial = coaxial (the axes of cylindrical or conical faces aligned, e.g. a screw in a hole)",
              ),
            ),
          face: FaceSelector.describe(ta("这个零件上的面，按它自己文件里的坐标选（不写 of）", "A face on this part, selected in its own file's coordinates (no of)")),
          to: z.object({
            part: z.string().describe(ta("前面已经放好的零件的名字", "Name of a part placed earlier")),
            face: FaceSelector.describe(ta("那个零件上的面，按它在装配里的位置选（不写 of）", "A face on that part, selected by its position in the assembly (no of)")),
          }),
          offset: Num.optional().describe(ta("contact / flush：沿法向留出的距离，正值 = 离开", "contact / flush: distance left along the normal; positive = apart")),
          flip: z.boolean().optional().describe(ta("coaxial：零件朝向反了时写 true", "coaxial: true when the part faces the wrong way")),
        }),
      )
      .max(3)
      .optional()
      .describe(
        ta(
          "贴合摆放：先按 rotate、at 放，再按顺序一条条满足（后一条只在前面留下的自由度里移动、转动），不用自己算坐标。to.face 选中几个面（例如 4 个孔）就放几个，零件清单里数量照算",
          "Placement by mates: placed by rotate and at first, then the mates are met one by one in order (each later one only moves and turns within the freedom the earlier ones leave), so you don't compute coordinates. As many faces as to.face selects (e.g. 4 holes), that many copies are placed, and the BOM counts them",
        ),
      ),
    hidden: z.boolean().optional().describe(ta("先不显示（还在装配里，导出、核对照常）", "Hidden for now (still in the assembly; exported and checked as usual)")),
    appearance: PartAppearance.optional().describe(
      ta(
        "只在这个装配里的颜色和质感，比零件文件自己的优先；标准件、外购件（STEP）的颜色写在这里。同一个 component 放的几个一起变。parts 按零件文件拆开后的零件名（上盖、底壳）分别设，比整体的优先",
        "Color and finish in this assembly only; takes precedence over the part file's own. Colors of standard parts and purchased parts (STEP) go here. All copies placed by the same component change together. parts sets each part by the names the part file is split into (e.g. lid, base), taking precedence over the whole",
      ),
    ),
  }),
  z.object({
    ...Base,
    op: z.literal("rib"),
    sketch: z
      .string()
      .describe(
        ta(
          "只含一条开放的线（path）的草图，画在筋所在的平面上；线的两端可以不碰到实体，会自动延长到墙",
          "A sketch with only one open line (path), drawn on the rib's plane; the line's ends needn't touch the solid: they are extended to the walls automatically",
        ),
      ),
    t: Num.describe(ta("筋厚，在草图平面两侧各一半", "Rib thickness, half on each side of the sketch plane")),
    flip: z
      .boolean()
      .optional()
      .describe(
        ta(
          "材料长在线的另一侧（两侧都被实体围住、自动判断不明确时才用）",
          "Put the material on the other side of the line (only when both sides are enclosed by the solid and the automatic choice is unclear)",
        ),
      ),
  }),
  z.object({
    ...Base,
    op: z.literal("thread"),
    faces: FaceSelector.describe(
      ta(
        "要做螺纹的圆柱面：轴的外圆是外螺纹，孔壁是内螺纹；可以一次选几个一样大的孔",
        "Cylindrical faces to thread: a shaft's outside gets an external thread, a hole wall an internal thread; you can select several holes of the same size at once",
      ),
    ),
    size: z.enum(SCREW_SIZES).optional().describe(ta("公制粗牙螺纹，按它定大径和螺距", "Metric coarse thread; sets the major diameter and pitch")),
    d: Num.optional().describe(ta("不用 size 时：螺纹大径", "Without size: the major diameter")),
    pitch: Num.optional().describe(ta("螺距；用 size 时缺省是粗牙螺距", "Pitch; with size, defaults to the coarse pitch")),
    length: Num.optional().describe(ta("螺纹长度，缺省整个圆柱面", "Thread length; default the whole cylindrical face")),
    from: Dir.optional().describe(ta('写了 length 时从圆柱面的哪一端量起，例如 "+Z" = 从上端往下', 'With length: which end of the cylindrical face to measure from, e.g. "+Z" = from the top end down')),
    clearance: Num.optional().describe(
      ta(
        "打印用的间隙（mm，缺省 0）：外螺纹做细、内螺纹做大这么多；FDM 打印常用 0.1–0.2",
        "Clearance for printing (mm, default 0): external threads are made this much thinner, internal ones this much larger; 0.1–0.2 is common for FDM printing",
      ),
    ),
    left: z.boolean().optional().describe(ta("左旋", "Left-handed")),
  }),
  z.object({
    ...Base,
    op: z.literal("mirror"),
    plane: PlaneName,
    offset: Num.optional(),
    features: z.array(z.string()).optional().describe(ta("要镜像的加料/切除/孔特征；缺省镜像整个实体", "Add / cut / hole features to mirror; by default the whole solid is mirrored")),
  }),
])

export type Feature = z.infer<typeof Feature>
export type FeatureOp = Feature["op"]
export type FaceSelector = z.infer<typeof FaceSelector>
export type EdgeSelector = z.infer<typeof EdgeSelector>
export type PlaneRef = z.infer<typeof PlaneRef>
export type SketchShape = z.infer<typeof SketchShape>

const Said = z.string().describe(ta("学习者的原话片段，如「壁厚 2」", "A snippet of the learner's own words, as they wrote them, e.g. “wall thickness 2”"))
const Pick = z
  .object({ face: FaceSelector.optional(), edge: EdgeSelector.optional() })
  .describe(ta("量哪里：一个面（face）或一条边（edge），选择器要正好选中一个", "Where to measure: a face (face) or an edge (edge); the selector must select exactly one"))
const Where = z
  .object({
    face: FaceSelector.optional(),
    edge: EdgeSelector.optional(),
    feature: z.string().optional().describe(ta("这个特征生成和修改的、现在仍存在的所有面（特征 id）", "All faces this feature made or modified that still exist (feature id)")),
    part: z.string().optional().describe(ta("零件名，或参考体（import 的 id 或名字）", "Part name, or a reference body (the import's id or name)")),
  })
  .describe(ta("一处：face 或 edge（选择器正好选中一个）、feature 或 part，写一个", "One place: face or edge (the selector selects exactly one), feature or part; write one of them"))
const CheckBase = {
  id: z.string().describe(ta("短英文 id，如 size、wall、holes；同 id 会覆盖原来那一项", "Short English id, e.g. size, wall, holes; the same id replaces the earlier item")),
  said: Said,
  tol: z.number().positive().optional().describe(ta("容差，缺省长度 0.01 mm、角度 0.05°", "Tolerance; default 0.01 mm for lengths, 0.05° for angles")),
}

const PrintPart = z.string().optional().describe(ta("只看这个零件（名字）；不写就每个零件都看", "Only this part (name); without it, every part is checked"))

/** A requirement the learner stated, measured by the kernel on every rebuild (expected values are plain numbers). */
export const Check = z.discriminatedUnion("kind", [
  z.object({
    ...CheckBase,
    kind: z.literal("size"),
    expect: z.array(z.number()).length(3).describe(ta("沿 X、Y、Z 的外形尺寸", "Overall size along X, Y, Z")),
    axes: z.enum(["xyz", "any"]).optional().describe(ta("any = 不管方向，排序后比较", "any = ignore orientation, compare sorted")),
  }),
  z.object({ ...CheckBase, kind: z.literal("thickness"), faces: FaceSelector.describe(ta("壁的一侧的面（平面）", "A face on one side of the wall (planar)")), expect: z.number() }),
  z.object({
    ...CheckBase,
    kind: z.literal("holes"),
    faces: FaceSelector.describe(ta("孔壁的圆柱面，例如 { kind: \"cylinder\", of: \"h1\" }", "Cylindrical faces of the hole walls, e.g. { kind: \"cylinder\", of: \"h1\" }")),
    count: z.number().int().positive(),
    d: z.number().optional().describe(ta("孔径", "Hole diameter")),
    thread: z.string().optional().describe(ta("螺纹规格，如 M4：按攻丝底孔核对", "Thread size, e.g. M4: checked against the tap drill")),
  }),
  z.object({ ...CheckBase, kind: z.literal("distance"), a: Pick, b: Pick, expect: z.number() }),
  z.object({
    ...CheckBase,
    kind: z.literal("pcd"),
    faces: FaceSelector.describe(ta("各个孔的圆柱面", "The cylindrical faces of the holes")),
    count: z.number().int().positive(),
    expect: z.number().describe(ta("节圆直径", "Pitch circle diameter")),
    axis: z.enum(["X", "Y", "Z"]).optional(),
  }),
  z.object({ ...CheckBase, kind: z.literal("angle"), a: FaceSelector, b: FaceSelector, expect: z.number() }),
  z.object({ ...CheckBase, kind: z.literal("volume"), min: z.number().optional(), max: z.number().optional() }),
  // Against a reference body brought in with `import` (desktop app): fit around a board, a part to mate with.
  z.object({
    ...CheckBase,
    kind: z.literal("clearance"),
    ref: z.string().describe(ta("参考体的特征 id（import），或一个零件的名字", "The reference body's feature id (import), or a part's name")),
    min: z.number().describe(ta("和它之间最小的间隙，mm", "Minimum clearance to it, mm")),
  }),
  z.object({
    ...CheckBase,
    kind: z.literal("interference"),
    ref: z.string().describe(ta("参考体的特征 id（import），或一个零件的名字：其余部分不能和它相交", "The reference body's feature id (import), or a part's name: nothing else may intersect it")),
  }),
  // Desktop (Turnery) only for now: left out of the site assistant's `check` (tools.ts).
  z.object({
    ...CheckBase,
    kind: z.literal("position"),
    at: Pick,
    axis: z.enum(["X", "Y", "Z"]).optional().describe(ta("只核对这一个坐标；不写时核对 [x, y, z]", "Check only this coordinate; without it, check [x, y, z]")),
    expect: z.union([z.number(), z.array(z.number()).length(3)]).describe(ta("写了 axis 时是一个数，没写时是 [x, y, z]", "One number with axis, [x, y, z] without")),
  }),
  z.object({
    ...CheckBase,
    kind: z.literal("gap"),
    a: Where,
    b: Where,
    min: z.number().optional().describe(ta("至少隔这么远（相交就不过）", "At least this far apart (intersecting fails)")),
    max: z.number().optional().describe(ta("最多隔这么远；0 = 必须贴上", "At most this far apart; 0 = must touch")),
  }),
  // 3D printing: can it be printed as modelled, without support, with walls a nozzle can lay down?
  z.object({
    ...CheckBase,
    kind: z.literal("overhang"),
    max: z.number().optional().describe(ta("允许的悬垂角（度），缺省 45：竖直的墙是 0，水平朝下的面是 90", "Allowed overhang angle (degrees), default 45: a vertical wall is 0, a horizontal downward face 90")),
    up: Dir.optional().describe(ta("打印时朝上的方向，缺省 +Z；上盖要翻过来打就写 -Z", "The direction that points up when printing; default +Z; write -Z for a lid printed upside down")),
    area: z.number().optional().describe(ta("允许需要支撑的面积 mm²，缺省 1", "Area allowed to need support, mm²; default 1")),
    part: PrintPart,
  }),
  z.object({
    ...CheckBase,
    kind: z.literal("min_wall"),
    min: z.number().positive().describe(ta("壁最薄允许多少 mm（0.4 喷嘴一般写 0.8）", "Thinnest wall allowed, mm (usually 0.8 for a 0.4 nozzle)")),
    part: PrintPart,
  }),
  z.object({
    ...CheckBase,
    kind: z.literal("bed"),
    up: Dir.optional().describe(ta("打印时朝上的方向，缺省 +Z", "The direction that points up when printing; default +Z")),
    min: z.number().optional().describe(ta("贴在打印平台上的面积至少多少 mm²；不写就只报告", "Minimum area on the print bed, mm²; without it, only reported")),
    part: PrintPart,
  }),
])

/** Check kinds only the desktop app's agents get (the site's assistant keeps its tested set). */
export const DESKTOP_CHECKS = new Set(["position", "gap", "overhang", "min_wall", "bed"])
export type Check = z.infer<typeof Check>

export const Tree = z.object({
  /** Desktop (Turnery): a shared parameter file (*.params.json) next to the part; its parameters win over the part's own. */
  uses: z.string().min(1).max(200).optional(),
  params: z.record(z.string(), Num),
  /** One line per parameter for people (「总长，沿 X」); never used in calculations. */
  paramNotes: z.record(z.string(), z.string()).optional(),
  features: z.array(Feature),
  /** The learner's numeric requirements, re-measured on every rebuild. */
  checks: z.array(Check).optional(),
  /** Colour and finish: the whole part, and per part after a split. Never changes the geometry. */
  appearance: PartAppearance.optional(),
})
export type Tree = z.infer<typeof Tree>

export const EMPTY_TREE: Tree = { params: {}, features: [] }

/** Chinese op names as used across the site (ops.ts). */
export const OP_NAMES: Record<FeatureOp, string> = {
  sketch: "草图",
  extrude: "拉伸",
  revolve: "旋转",
  fillet: "圆角",
  chamfer: "倒角",
  shell: "抽壳",
  hole: "孔",
  linear_pattern: "线性阵列",
  circular_pattern: "圆周阵列",
  mirror: "镜像",
  sweep: "扫掠",
  loft: "放样",
  draft: "拔模",
  rib: "筋",
  split: "拆件",
  import: "导入",
  component: "零件",
  thread: "螺纹",
}

const OP_NAMES_EN: Record<FeatureOp, string> = {
  sketch: "Sketch",
  extrude: "Extrude",
  revolve: "Revolve",
  fillet: "Fillet",
  chamfer: "Chamfer",
  shell: "Shell",
  hole: "Hole",
  linear_pattern: "Linear pattern",
  circular_pattern: "Circular pattern",
  mirror: "Mirror",
  sweep: "Sweep",
  loft: "Loft",
  draft: "Draft",
  rib: "Rib",
  split: "Split",
  import: "Import",
  component: "Part",
  thread: "Thread",
}

/**
 * A kind of feature, named in the interface's language. OP_NAMES stays Chinese: the kernel and the
 * agent's messages use it, and names like 「拉伸2」 are made from it.
 */
export const opLabel = (op: FeatureOp) => t(OP_NAMES[op], OP_NAMES_EN[op])

/** A kind of feature, named in the agent's language (a description in what the agent reads; never a name). */
export const opAgentName = (op: FeatureOp) => ta(OP_NAMES[op], OP_NAMES_EN[op])

/** Display name: the model's own name, else 「拉伸2」 style numbering. */
export function displayName(tree: Tree, f: Feature) {
  if (f.name) return f.name
  const same = tree.features.filter((x) => x.op === f.op)
  return `${OP_NAMES[f.op]}${same.indexOf(f) + 1}`
}

/** Features that add or remove material through a tool body (patternable). */
export const TOOL_OPS: FeatureOp[] = ["extrude", "revolve", "hole", "sweep", "loft"]

/**
 * The name a component shows as (and its parts are called): its `name`, else the file's name without the ending.
 * Stays Chinese in both languages: it is a name, which mates (`to.part`), checks and notes saved in files refer to.
 */
export function componentName(f: { name?: string; file?: string; standard?: { type: string; size: string } }) {
  if (f.name) return f.name
  if (!f.file) return f.standard ? `${f.standard.size} ${{ screw: "螺钉", nut: "螺母", washer: "垫圈", insert: "热熔螺母" }[f.standard.type] ?? ""}`.trim() : "零件"
  return (f.file.split(/[\\/]/).pop() ?? f.file).replace(/\.((turnery|arbor)-asm\.json|(turnery|arbor)\.json|json|step|stp)$/i, "")
}
