import { tool, type ToolSet } from "ai"
import { z } from "zod"
import { agentLang, type AgentLang } from "../lib/agent-lang"
import { Check, DESKTOP_CHECKS, EdgeSelector, FaceSelector, Feature, Num, SketchShape, WebMode, WebPoint, type FeatureOp } from "./dsl"
import { Color, Finish } from "./appearance"

/**
 * The tools the model may call. Shared by the server (schemas + how results
 * are shown to the model) and the browser, which executes them against the
 * kernel (client-side tools: no `execute` here).
 *
 * Built once per language: `studioTools(lang)` / `desktopTools(lang)`. The website's server picks the
 * language each request names; everything else takes the agent's (lib/agent-lang.ts). The descriptions
 * written here follow that language; the field descriptions that come from dsl.ts are in the language
 * the process started in.
 */

type Say = (zh: string, en: string) => string
const sayIn =
  (lang: AgentLang): Say =>
  (zh, en) =>
    lang === "en" ? en : zh

const opDocs = (s: Say): Record<FeatureOp, string> => ({
  component: s(
    "装配里放一个零件：file 写零件文件（.turnery.json）、子装配（.turnery-asm.json）或外购件（.step），name 是它在装配里的名字，用 rotate、at 摆到位置（先旋转后平移）。只能用在装配文件（.turnery-asm.json）里；要改零件的形状，用 open_part 打开它的文件（加 context 写装配文件，就能看着其他零件改）。",
    "Places a part in an assembly: file is a part file (.turnery.json), a subassembly (.turnery-asm.json) or a purchased part (.step); name is its name in the assembly; rotate and at put it in position (rotate first, then translate). Only in an assembly file (.turnery-asm.json); to change a part's shape, open its file with open_part (with context set to the assembly file, you edit it with the other parts in view).",
  ),
  sketch: s(
    "在基准面（或贴在某个平面上）画一个闭合草图，可以由多个图形组合，cut=true 的图形挖掉前面的图形；图形也可以是文字（刻字、凸字）。草图本身不改变实体。",
    "Draws a closed sketch on a datum plane (or on a planar face). It can combine several shapes; a shape with cut=true cuts out of the shapes before it; a shape can also be text (engraved or embossed). A sketch doesn't change the solid by itself.",
  ),
  extrude: s(
    "把草图沿法向拉伸成实体：mode=add 加料、mode=cut 切除；direction=both 两侧对称（distance 是两侧加起来的总长）；through=true 切除贯穿；until 成形到下一面或某个面（柱子要长到上面的板时用 until: \"next\"，不要自己算距离）；thin 薄壁（等厚的壁，开放的线 path 也能用）；draft 拔模角（锥形凸台、带斜度的槽）。",
    "Extrudes a sketch along its normal into a solid: mode=add adds material, mode=cut removes it; direction=both is symmetric on both sides (distance is the total of both sides); through=true cuts through all; until goes up to the next face or a given face (for a post that must reach the plate above, use until: \"next\"; don't compute the distance yourself); thin makes a thin wall (even thickness; works with an open line path too); draft sets a draft angle (tapered bosses, sloped slots).",
  ),
  revolve: s(
    "把草图绕过原点的一根坐标轴旋转成回转体。轮廓只能在轴的一侧（可以贴着轴）。",
    "Revolves a sketch about a coordinate axis through the origin into a solid of revolution. The profile must be on one side of the axis (it may touch the axis).",
  ),
  fillet: s(
    "对选中的边做圆角。用语义选择器选边；半径不能大于相邻面的宽度或壁厚。外观圆角通常放在最后。",
    "Fillets the selected edges. Select the edges with semantic selectors; the radius can't be larger than the width of the adjacent faces or the wall thickness. Cosmetic fillets usually go last.",
  ),
  chamfer: s("对选中的边做倒角（等距）。", "Chamfers the selected edges (equal distance)."),
  shell: s(
    "抽壳：去掉 open 选中的面作为开口，向内留壁厚 t。注意抽壳前的外圆角半径要大于壁厚，内侧才有圆角。",
    "Shell: removes the faces open selects, as openings, and leaves a wall of thickness t inward. Note: outside fillets made before the shell need a radius larger than the wall thickness, or the inside gets no rounded corners.",
  ),
  hole: s(
    "在平面上打孔（简单孔 / 沉头孔 / 埋头孔），孔沿平面法向的反方向钻入；reverse=true 反过来。",
    "Makes holes in a plane (simple / counterbore / countersink), drilled opposite to the plane's normal; reverse=true drills the other way.",
  ),
  linear_pattern: s(
    "把加料、切除或孔特征沿方向复制成一排（可选第二方向成阵列）。",
    "Copies add, cut or hole features into a row along a direction (optionally a second direction, for a grid).",
  ),
  circular_pattern: s(
    "把加料、切除或孔特征绕过原点的坐标轴等分复制一圈（或指定总角度）。",
    "Copies add, cut or hole features evenly around a coordinate axis through the origin, over a full circle (or a given total angle).",
  ),
  mirror: s(
    "关于基准面镜像：给 features 时镜像这些特征，不给时镜像整个实体并合并。",
    "Mirrors about a datum plane: with features, mirrors those features; without, mirrors the whole solid and merges it.",
  ),
  sweep: s(
    "扫掠：圆形或矩形截面沿一条平面路径走一遍（把手、管子、线槽）。路径拐弯要圆滑，拐弯半径要大于截面半宽。",
    "Sweep: runs a circular or rectangular profile along a planar path (handles, pipes, cable channels). Bends in the path must be smooth, with a bend radius larger than half the profile's width.",
  ),
  loft: s(
    "放样：在两个以上的截面草图之间生成过渡实体（例如方变圆、键帽）。截面画在平行的偏移平面上。",
    "Loft: makes a solid that blends between two or more profile sketches (e.g. square to round, a keycap). Draw the profiles on parallel offset planes.",
  ),
  draft: s(
    "拔模：给侧壁加脱模斜度（注塑件常用 1–3°），中性面上的尺寸不变。先拔模、后倒圆角。",
    "Draft: adds a release taper to side walls (1–3° is common for injection-molded parts); dimensions on the neutral plane stay the same. Draft first, fillet after.",
  ),
  split: s(
    "拆件：用一个平面把实体切成两个有名字的零件（例如外壳拆成底壳和上盖、太长的杆切成两段打印）。之后的特征可以写 part 只改一个零件；切除和孔不写 part 时作用在碰到的所有零件上（螺丝孔穿过两件）。",
    "Split: cuts the solid with a plane into two named parts (e.g. an enclosure into a base and a lid, a rod too long to print into two pieces). Later features can set part to change one part only; cuts and holes without part act on every part they touch (a screw hole through both).",
  ),
  rib: s(
    "筋（加强筋）：草图里画一条开放的线（path），在线所在的平面上长出厚 t 的筋，线的两端会自动延长到墙，材料长在被实体围住的那一侧（例如 L 形支架的三角筋）。",
    "Rib (stiffening rib): draw an open line (path) in a sketch; a rib of thickness t grows in the line's plane, the line's ends are extended to the walls automatically, and the material goes on the side enclosed by the solid (e.g. the triangular rib of an L bracket).",
  ),
  thread: s(
    "螺纹：在圆柱面上做出真实的螺纹几何（ISO 公制 60° 牙型），轴的外圆做外螺纹，孔壁做内螺纹（孔一般先打成攻丝底孔或小径）。用于 3D 打印的螺纹盖、瓶口、M8 以上的螺栓螺母；小螺丝孔用 hole 的 standard（fit: tap 标装饰螺纹）或热熔螺母更合适。螺纹面很多，放在最后。",
    "Thread: makes real thread geometry on a cylindrical face (ISO metric 60° profile): an external thread on a shaft's outside, an internal thread on a hole wall (usually make the hole the tap drill or the minor diameter first). For 3D-printed screw caps, bottle necks, and bolts and nuts from M8 up; for small screw holes, hole's standard (fit: tap marks a cosmetic thread) or a heat-set insert suits better. Threads have many faces: put them last.",
  ),
  import: s(
    "导入一个 STEP 文件（例如开发板、元件的官方模型）。缺省作参考体：半透明显示，用来对齐尺寸、核对间隙（check 的 clearance）和干涉（interference），不并入零件也不导出；mode=add 并入实体，mode=cut 从实体里减去（按元件挖让位槽）。用 rotate、at 摆到位置上。",
    "Imports a STEP file (e.g. the official model of a dev board or a component). By default it is a reference body: shown see-through, used to line up dimensions and to check clearance (check's clearance) and interference (interference); not merged into the part and not exported. mode=add merges it into the solid, mode=cut subtracts it from the solid (cuts relief pockets shaped like the component). Put it in position with rotate and at.",
  ),
})

/** Ops only the desktop app (Turnery) runs: they read files next to the part. Not offered to the site's assistant. */
export const DESKTOP_OPS = new Set<FeatureOp>(["import", "component", "thread"])

/** The site assistant's check items: without the desktop-only kinds. */
const WebCheck = z.discriminatedUnion(
  "kind",
  Check.options.filter((o) => !DESKTOP_CHECKS.has(o.shape.kind.value)) as unknown as [(typeof Check.options)[number], ...(typeof Check.options)[number][]],
)

type FeatureSchema = (typeof Feature.options)[number]

/** Every tool, its descriptions in one language. */
function build(lang: AgentLang) {
  const s = sayIn(lang)
  const OP_DOCS = opDocs(s)

  const checkTool = (items: z.ZodType) =>
    tool({
      description: s(
        "核对学习者提出的数值要求：每项由内核实际量出来，返回 ✓ / ✗，之后每次重建都会自动重算。学习者的话里有具体数值时，建模结束前必须调用一次。size 只量整个零件的外形（包围盒）；某一部分的尺寸（筋的高度、立板的厚度、孔距）用 distance 选两个面，或 thickness 选壁的一侧，选择器加 of、normal，正好选中要量的那个面。",
        "Checks the numeric requirements the learner stated: the kernel actually measures each item and returns ✓ / ✗, and re-measures it on every rebuild after that. When the learner's words contain specific numbers, you must call it once before you finish modeling. size measures only the whole part's overall size (bounding box); for the size of one portion (a rib's height, an upright's thickness, a hole spacing), use distance with two faces, or thickness with one side of the wall, adding of and normal to the selector so it selects exactly the face to measure.",
      ),
      inputSchema: z.object({
        items: z
          .array(items)
          .max(20)
          .optional()
          .describe(s("要核对的项；期望值只写学习者给的数字，不写参数名", "Items to check; expected values are only the numbers the learner gave, never parameter names")),
        remove: z.array(z.string()).optional().describe(s("学习者不再要求的项的 id", "Ids of the items the learner no longer requires")),
      }),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    })

  /** Sketch shapes as the site's assistant writes them: polyline and path points without splines or rounded corners. */
  const WebSketchShape = z.discriminatedUnion(
    "type",
    SketchShape.options.map((o) =>
      o.shape.type.value === "polyline" || o.shape.type.value === "path"
        ? (o as z.ZodObject).extend({
            points: z
              .array(WebPoint)
              .min(2)
              .describe(
                o.shape.type.value === "path"
                  ? s("开放的线，依次连接，不自动闭合；只能用于薄壁拉伸（thin）和筋（rib）", "An open line: joined in order, not closed automatically; only for thin extrusions (thin) and ribs (rib)")
                  : s("依次连接并自动闭合；{to, via} 表示三点圆弧", "Joined in order and closed automatically; {to, via} is a three-point arc"),
              ),
          })
        : o,
    ) as unknown as [(typeof SketchShape.options)[number], ...(typeof SketchShape.options)[number][]],
  )

  /**
   * A feature's input as the site's assistant sees it: without what only the desktop app's agents get so far
   * (intersect, revolve start / symmetric, extrude onto, spline and rounded-corner points). Its evals cover
   * the rest; these go to it once they're evaluated there.
   */
  function webShape(schema: FeatureSchema): Record<string, z.ZodType> {
    const { op: _op, ...shape } = schema.shape as Record<string, z.ZodType>
    void _op
    const out: Record<string, z.ZodType> = { ...shape }
    if ("mode" in out && out.mode !== undefined && schema.shape.op.value !== "import") out.mode = WebMode
    delete out.onto
    delete out.start
    delete out.symmetric
    if (schema.shape.op.value === "sketch") out.shapes = z.array(WebSketchShape).min(1)
    if (schema.shape.op.value === "sweep") {
      const path = (schema.shape as { path: z.ZodObject }).path
      out.path = path
        .extend({ points: z.array(WebPoint).min(2).describe(s("路径点（不闭合）；{to, via} 是三点圆弧", "Path points (not closed); {to, via} is a three-point arc")) })
        .describe(path.description ?? "")
    }
    return out
  }

  const AFTER = z.string().optional().describe(s("插到这个特征后面；缺省加在最后", "Insert after this feature; by default it goes at the end"))

  function featureTool(op: FeatureOp, shape: Record<string, z.ZodType>) {
    return tool({
      description: OP_DOCS[op],
      inputSchema: z.object({ ...shape, after: AFTER }),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    })
  }

  /** Every feature with every field: the desktop app's agents. */
  const featureTools = Object.fromEntries(
    Feature.options.map((schema) => {
      const { op: opField, ...shape } = schema.shape
      return [opField.value, featureTool(opField.value as FeatureOp, shape as Record<string, z.ZodType>)]
    }),
  ) as Record<FeatureOp, ReturnType<typeof tool>>

  /** The site's assistant: without the desktop-only ops and fields. */
  const webFeatureTools = Object.fromEntries(
    Feature.options.flatMap((schema) => {
      const op = schema.shape.op.value as FeatureOp
      return DESKTOP_OPS.has(op) ? [] : [[op, featureTool(op, webShape(schema))]]
    }),
  ) as Record<Exclude<FeatureOp, "import" | "component">, ReturnType<typeof tool>>

  const setParamsFields = {
    set: z.record(z.string(), Num).optional().describe(s("要新建或修改的参数", "Parameters to create or change")),
    remove: z.array(z.string()).optional().describe(s("要删除的参数名", "Names of the parameters to delete")),
    notes: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        s(
          '参数说明，给学习者看：每个新参数一句短中文，说清是什么尺寸、沿哪个方向，如 { "L": "总长，沿 X", "t": "壁厚" }',
          'Parameter notes, for the learner: one short sentence per new parameter, in the learner\'s language, saying what dimension it is and along which direction, e.g. { "L": "overall length, along X", "t": "wall thickness" }',
        ),
      ),
  }

  /** Tools of the desktop app's agents on top of STUDIO_TOOLS (see DESKTOP_OPS); `check` replaces the site's with every kind. */
  const desktop = {
    ...featureTools,
    set_params: tool({
      description: s(
        "新建、修改或删除命名参数。值可以是数字或引用其他参数的表达式（如 \"L-2*t\"）。关键尺寸都应该做成参数，特征里用参数名引用。零件用了共享参数文件（share_params）时，共享参数文件里已有的名字会写回那个文件；shared: true 把这次 set 的参数都写进共享文件。",
        "Creates, changes or deletes named parameters. A value can be a number or an expression that refers to other parameters (e.g. \"L-2*t\"). Make every key dimension a parameter and refer to it by name in features. When the part uses a shared parameter file (share_params), names already in that file are written back to it; shared: true writes all the parameters in this set into the shared file.",
      ),
      inputSchema: z.object({
        ...setParamsFields,
        shared: z
          .boolean()
          .optional()
          .describe(s("写进共享参数文件（零件要先用 share_params 指定共享参数文件）", "Write into the shared parameter file (the part must first name one with share_params)")),
      }),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    }),
    check: checkTool(Check),
  } satisfies ToolSet

  const studio = {
    set_params: tool({
      description: s(
        "新建、修改或删除命名参数。值可以是数字或引用其他参数的表达式（如 \"L-2*t\"）。关键尺寸都应该做成参数，特征里用参数名引用。",
        "Creates, changes or deletes named parameters. A value can be a number or an expression that refers to other parameters (e.g. \"L-2*t\"). Make every key dimension a parameter and refer to it by name in features.",
      ),
      inputSchema: z.object(setParamsFields),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    }),
    ...webFeatureTools,
    edit_feature: tool({
      description: s(
        "修改已有特征的字段（只写要改的字段，嵌套对象整体替换）。修复失败的特征时优先用它，不要再加一个新特征。",
        "Changes fields of an existing feature (write only the fields to change; nested objects are replaced as a whole). Use it first to fix a failed feature; don't add another feature.",
      ),
      inputSchema: z.object({
        id: z.string(),
        changes: z
          .record(z.string(), z.unknown())
          .describe(
            s(
              "要改的字段，例如 { \"r\": 3 } 或 { \"edges\": { \"parallel\": \"Z\" } }；写 null 删掉一个字段，例如 { \"thin\": null }",
              "Fields to change, e.g. { \"r\": 3 } or { \"edges\": { \"parallel\": \"Z\" } }; null removes a field, e.g. { \"thin\": null }",
            ),
          ),
      }),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    }),
    delete_feature: tool({
      description: s(
        "删除一个特征。如果后面有特征引用它，会报错并列出这些特征；cascade=true 时一起删除。",
        "Deletes a feature. If later features refer to it, this is an error that lists them; with cascade=true they are deleted too.",
      ),
      inputSchema: z.object({ id: z.string(), cascade: z.boolean().optional() }),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    }),
    check: checkTool(WebCheck),
    // The desktop app has its own set_appearance (it also writes colours into an assembly's part files).
    set_appearance: tool({
      description: s(
        "设零件的颜色和质感，只改外观、不改几何（学习者说「做成橙色」「上盖用透明的」，或想看最终效果时用）。不写 parts 是整个零件；拆件以后用 parts 分别设。color、finish 写 null 是清除。",
        "Sets a part's color and finish; changes only the appearance, not the geometry (use it when the learner says “make it orange” or “make the lid clear”, or wants to see the final look). Without parts it is the whole part; after a split, set each part with parts. null for color or finish clears it.",
      ),
      inputSchema: z.object({
        parts: z.array(z.string()).optional().describe(s("拆件以后的零件名；不写就是整个零件", "Part names after a split; without it, the whole part")),
        color: Color.nullable().optional(),
        finish: Finish.nullable().optional(),
      }),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    }),
    inspect: tool({
      description: s(
        "查看当前模型：tree = 特征树和每步结果；body = 包围盒、体积、质心；faces / edges = 列出面或边（可用选择器过滤），用来确认选择器会选中什么。",
        "Inspects the current model: tree = the feature tree and each step's result; body = bounding box, volume, center of mass; faces / edges = lists faces or edges (a selector can filter them), to confirm what a selector will select.",
      ),
      inputSchema: z.object({
        what: z.enum(["tree", "body", "faces", "edges"]),
        faces: FaceSelector.optional().describe(s("what=faces 时的过滤条件", "Filter for what=faces")),
        edges: EdgeSelector.optional().describe(s("what=edges 时的过滤条件", "Filter for what=edges")),
      }),
      toModelOutput: ({ output }) => ({ type: "text", value: textOf(output) }),
    }),
    look: tool({
      description: s(
        "渲染当前模型的视图图片给你看，用来检查形状、位置和方向是否符合预期。建完一个零件后至少看一次。",
        "Renders views of the current model as images for you, to check that the shape, position and orientation are as expected. Look at least once after you build a part.",
      ),
      inputSchema: z.object({
        views: z.array(z.enum(["iso", "front", "top", "right"])).optional().describe(s("缺省四个视图都要", "Default: all four views")),
        highlight: z.string().optional().describe(s("高亮这个特征生成的面", "Highlight the faces this feature made")),
      }),
      toModelOutput: ({ output }) => {
        const o = output as ToolOutput
        if (!o?.images?.length) return { type: "text", value: textOf(output) }
        return {
          type: "content",
          value: [
            { type: "text", text: textOf(output) },
            ...o.images.map((img) => ({ type: "file" as const, mediaType: "image/png", data: { type: "data" as const, data: img.split(",")[1] ?? img } })),
          ],
        }
      },
    }),
  } satisfies ToolSet

  return { desktop, studio }
}

const built: Partial<Record<AgentLang, ReturnType<typeof build>>> = {}
const toolsIn = (lang: AgentLang) => (built[lang] ??= build(lang))

/** The site assistant's tools, described in `lang` (the website's server: the language the request names). */
export const studioTools = (lang: AgentLang = agentLang()) => toolsIn(lang).studio

/** Tools of the desktop app's agents on top of the site's (see DESKTOP_OPS), described in `lang`. */
export const desktopTools = (lang: AgentLang = agentLang()) => toolsIn(lang).desktop

/**
 * The tools in the agent's language as it was when this module loaded: for their names and schemas.
 * Where the language can differ or change (the website's server, the desktop app's main process),
 * read the descriptions from studioTools(lang) / desktopTools(lang).
 */
export const STUDIO_TOOLS = studioTools()
export const DESKTOP_TOOLS = desktopTools()

export type StudioToolName = keyof typeof STUDIO_TOOLS

/** What the browser returns for every tool call. */
export type ToolOutput = {
  ok: boolean
  text: string
  /** look: PNG data URLs. Dropped from older turns before they reach the model. */
  images?: string[]
}

function textOf(output: unknown) {
  const o = output as ToolOutput
  return typeof o?.text === "string" ? o.text : JSON.stringify(output)
}
