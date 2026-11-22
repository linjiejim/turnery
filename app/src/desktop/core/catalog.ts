// Every command the engine runs, registered once: name, description, zod
// input. The MCP server lists the agent's ones as tools, the CLI exposes them
// as `turnery call <name>`, and the window uses the user's ones over IPC.
//
// Descriptions and the guide are in the agent's language (lib/agent-lang.ts): COMMANDS and AGENT_GUIDE
// are fixed when this module loads (`turnery mcp` and the CLI settle the language before any import,
// desktop/src/lang-boot.ts); the website's server asks for each language with commandsIn / guideIn.
import { z } from "zod"
import { type AgentLang, agentLang, ta, withAgentLang } from "../../lib/agent-lang"
import { EdgeSelector, FaceSelector, Num, PlaneRef, Tree } from "../../studio/dsl"
import { Color, Finish } from "../../studio/appearance"
import { systemPrompt } from "../../studio/prompt"
import { STARTERS } from "../../studio/starters"
import { desktopTools, studioTools as webTools } from "../../studio/tools"

/** agent: MCP / CLI; user: only the window; both: either. */
export type Audience = "agent" | "user" | "both"

export type CommandSpec = { name: string; description: string; input: z.ZodObject; audience: Audience }

/** The commands with their descriptions in the agent's language when this runs (see commandsIn). */
function build(): CommandSpec[] {
  const Target = z
    .object({
      face: FaceSelector.optional(),
      edge: EdgeSelector.optional(),
      feature: z.string().optional().describe(ta("这个特征生成和修改的、现在仍存在的所有面（特征 id）", "Every face this feature created or modified that still exists (a feature id)")),
      part: z.string().optional().describe(ta("一个零件、参考体，或在装配里改零件时上下文里的零件（名字）", "A part, a reference body, or, when editing a part in an assembly, a part of the context (by name)")),
    })
    .describe(
      ta(
        "量哪里：一个面（face）或一条边（edge，选择器要正好选中一个），一个特征的面（feature），或一个零件（part）",
        "What to measure: a face (face) or an edge (edge; the selector must select exactly one), a feature's faces (feature), or a part (part)",
      ),
    )
  const V3 = z.tuple([z.number(), z.number(), z.number()])
  const VIEWS = ["iso", "front", "top", "right", "back", "bottom", "left"] as const

  /** Modelling tools of the web studio, as they are (look is replaced below: here it renders in the window). */
  const studioTools: CommandSpec[] = Object.entries({ ...webTools(), ...desktopTools() })
    // look renders in the window here; set_appearance also writes an assembly's part files (both below).
    .filter(([name]) => name !== "look" && name !== "set_appearance")
    .map(([name, t]) => ({ name, description: typeof t.description === "string" ? t.description : "", input: t.inputSchema as z.ZodObject, audience: "both" as const }))

  const own: CommandSpec[] = [
    {
      name: "guide",
      audience: "agent",
      description: ta(
        "Turnery 的建模说明：工作流程、坐标约定、选择器写法。第一次用 Turnery 时先读一遍。",
        "Turnery's modeling guide: the workflow, coordinate conventions, how to write selectors. Read it once the first time you use Turnery.",
      ),
      input: z.object({}),
    },
    {
      name: "open_part",
      audience: "both",
      description: ta(
        "打开一个零件文件（*.turnery.json，就是特征树 JSON）或装配文件（*.turnery-asm.json），之后的命令都作用在它上面；Turnery 窗口会切到它。文件不存在时要新建就设 create=true，可以用 template 从现成的特征树开始。写 context（装配文件）就是在装配里改这个零件：装配里的其他零件按相对位置半透明地显示在旁边，可以 look、measure、check 它们（只读）；不写 context 再打开一次就退出。",
        "Open a part file (*.turnery.json, which is the feature tree JSON) or an assembly file (*.turnery-asm.json); the commands after it act on it, and the Turnery window switches to it. To create the file when it doesn't exist, set create=true; template starts it from a ready-made feature tree. Writing context (an assembly file) edits this part in that assembly: the assembly's other parts show alongside it, semi-transparent, in their relative positions, and you can look, measure and check them (read-only); open it again without context to leave.",
      ),
      input: z.object({
        path: z
          .string()
          .describe(
            ta(
              "零件文件路径，相对当前目录或绝对路径，例如 parts/box.turnery.json；装配用 .turnery-asm.json 结尾",
              "Part file path, relative to the current directory or absolute, e.g. parts/box.turnery.json; an assembly ends in .turnery-asm.json",
            ),
          ),
        create: z.boolean().optional().describe(ta("文件不存在时新建", "Create the file if it doesn't exist")),
        context: z
          .string()
          .optional()
          .describe(
            ta(
              "在这个装配（.turnery-asm.json）里改这个零件：装配里要有一个 component 的 file 是它",
              "Edit this part in this assembly (.turnery-asm.json): the assembly must have a component whose file is this part",
            ),
          ),
        template: z
          .enum(STARTERS.map((s) => s.id) as [string, ...string[]])
          .optional()
          .describe(
            ta(
              `新建时用的现成特征树：${STARTERS.map((s) => `${s.id}（${s.title}）`).join("；")}`,
              `A ready-made feature tree to start from when creating: ${STARTERS.map((s) => `${s.id} (${s.title})`).join("; ")}`,
            ),
          ),
      }),
    },
    {
      name: "open_project",
      audience: "both",
      description: ta(
        "把一个文件夹作为项目打开：窗口左栏列出里面的装配和零件。create=true 时新建这个文件夹，并放一个同名的空装配（*.turnery-asm.json）和共享参数文件（*.params.json），然后打开装配。多个零件组成的东西先建项目。",
        "Open a folder as a project: the window's left sidebar lists the assemblies and parts in it. With create=true, create the folder, put in it an empty assembly (*.turnery-asm.json) and a shared parameter file (*.params.json) of the same name, then open the assembly. For a thing made of several parts, create a project first.",
      ),
      input: z.object({
        path: z.string().describe(ta("项目文件夹，相对当前目录或绝对路径，例如 pen", "Project folder, relative to the current directory or absolute, e.g. pen")),
        create: z.boolean().optional().describe(ta("文件夹不存在或还没有装配时新建", "Create it if the folder doesn't exist or has no assembly yet")),
      }),
    },
    {
      name: "list_parts",
      audience: "both",
      description: ta(
        "列出当前项目里的全部装配和零件（打开着的标出来）；没有项目时列出打开的零件。路径、特征数、未处理的备注数，以及哪个是当前零件。",
        "List every assembly and part in the current project (open ones marked); without a project, list the open parts. Paths, feature counts, open note counts, and which one is the current part.",
      ),
      input: z.object({}),
    },
    {
      name: "get_state",
      audience: "both",
      description: ta(
        "当前零件的完整状态：参数、特征树和每步结果、实体尺寸、未处理的备注、最近谁改了什么。",
        "The current part's full state: parameters, the feature tree and each step's result, solid dimensions, open notes, who changed what recently.",
      ),
      input: z.object({}),
    },
    {
      name: "set_tree",
      audience: "both",
      description: ta(
        "整体替换特征树（批量改、从别处拿来一棵树时用）。一步可以撤销。小改动优先用对应的特征工具或 edit_feature。",
        "Replace the whole feature tree (for batch edits, or a tree taken from elsewhere). It undoes in one step. For small changes, prefer the matching feature tool or edit_feature.",
      ),
      input: z.object({
        tree: Tree.describe(ta("完整的特征树：{ params, paramNotes?, features }", "The complete feature tree: { params, paramNotes?, features }")),
        base_rev: z
          .number()
          .int()
          .optional()
          .describe(
            ta(
              "基于哪个版本改的；中间有人改过模型就拒绝，避免覆盖别人的改动",
              "The revision this edit is based on; refused if someone changed the model in between, so nobody's changes are overwritten",
            ),
          ),
      }),
    },
    {
      name: "move_feature",
      audience: "both",
      description: ta(
        "调整特征顺序：by 为负往前移，为正往后移。不会越过它用到的或用到它的特征。",
        "Reorder a feature: a negative by moves it earlier, a positive by moves it later. It never moves past a feature it uses or that uses it.",
      ),
      input: z.object({ id: z.string(), by: z.number().int().describe(ta("移动几位，-1 = 往前一位", "How many places to move; -1 = one place earlier")) }),
    },
    {
      name: "undo",
      audience: "both",
      description: ta("撤销当前零件的上一次改动（不管是谁改的）。", "Undo the last change to the current part (whoever made it)."),
      input: z.object({}),
    },
    {
      name: "redo",
      audience: "both",
      description: ta("重做刚撤销的改动。", "Redo the change just undone."),
      input: z.object({}),
    },
    {
      name: "look",
      audience: "agent",
      description: ta(
        "在 Turnery 窗口里渲染当前模型的视图图片给你看，检查形状、位置和方向。窗口里未处理的备注会画成编号圆点。建完一个零件、改完备注指的地方，都要看一次。小的细节用 focus 放大，里面的结构用 section 剖开看；最后一步改动很小时会自动加一张特写。结果里写着每张图 1 px 多少 mm。",
        "Render view images of the current model in the Turnery window for you to see, to check shape, position and orientation. Open notes in the window are drawn as numbered dots. Look once after you finish a part, and once after you change the place a note points at. Zoom in on small details with focus; cut inner structure open with section; when the last change is small, a close-up is added automatically. The result says how many mm 1 px is in each image.",
      ),
      input: z.object({
        views: z
          .array(z.enum(VIEWS))
          .optional()
          .describe(
            ta(
              "缺省 iso、front、top、right；写了 section 时缺省是正对截面的那一张加 iso；写了 focus 时缺省 iso、front",
              "Default iso, front, top, right; with section, the default is the view facing the cut plus iso; with focus, the default is iso, front",
            ),
          ),
        highlight: z.string().optional().describe(ta("高亮这个特征生成的面", "Highlight the faces this feature created")),
        at: z.string().optional().describe(ta("回滚到这个特征那一步看（缺省最新一步）", "Roll back to this feature's step to look (default: the latest step)")),
        notes: z.boolean().optional().describe(ta("画出未处理备注的编号，缺省 true", "Draw the numbers of open notes; default true")),
        focus: z
          .union([
            z.string().describe(ta("特征 id：框住它生成和修改的面", "A feature id: frame the faces it created and modified")),
            z.object({ part: z.string().describe(ta("零件名或参考体的名字", "A part name or a reference body's name")) }),
            z.object({ faces: FaceSelector }),
          ])
          .optional()
          .describe(
            ta(
              "特写：每张图只框住这里（特征 id、{ part } 或 { faces }），看小细节时用",
              "Close-up: every image frames only this (a feature id, { part } or { faces }); use it to see small details",
            ),
          ),
        section: z
          .object({
            plane: z
              .enum(["XY", "XZ", "YZ"])
              .describe(
                ta(
                  "剖切的基准面：XY 去掉上面（+Z）一侧，XZ 去掉前面（-Y）一侧，YZ 去掉右面（+X）一侧",
                  "The datum plane to cut on: XY removes the upper (+Z) side, XZ removes the front (-Y) side, YZ removes the right (+X) side",
                ),
              ),
            offset: Num.optional().describe(
              ta(
                "基准面的偏移（XY 是 Z 值，XZ 是 Y 值，YZ 是 X 值），缺省过整件中心",
                "The plane's offset (for XY the Z value, for XZ the Y value, for YZ the X value); default: through the center of the whole model",
              ),
            ),
          })
          .optional()
          .describe(ta("剖视：切开看里面，例如零件之间的间隙、壁厚、内腔", "Section view: cut it open to see inside, e.g. gaps between parts, wall thickness, cavities")),
        dir: z
          .array(z.number())
          .length(3)
          .optional()
          .describe(ta("再加一张从这个方向看的图，例如 [1, 1, 0.3]", "Add one more image seen from this direction, e.g. [1, 1, 0.3]")),
        size: z.enum(["normal", "large"]).optional().describe(ta("large = 896×672（缺省 448×336）", "large = 896×672 (default 448×336)")),
        hide: z
          .array(z.string())
          .optional()
          .describe(ta("不画这些零件或参考体（按名字），例如藏起笔帽看里面", "Don't draw these parts or reference bodies (by name), e.g. hide the pen cap to see inside")),
        plain: z
          .boolean()
          .optional()
          .describe(
            ta(
              "画成白模，不按零件的颜色和质感（看形状、对比明暗时用）",
              "Draw the clay model (plain white), not the parts' color and finish (to look at shape or compare light and shade)",
            ),
          ),
      }),
    },
    {
      name: "set_appearance",
      audience: "both",
      description: ta(
        "设零件的颜色和质感：窗口里按它显示，导出 3MF、STEP 时带上，零件清单里列出。只改外观，不改几何、不重建。零件文件里：不写 parts 是整个零件，写 parts 是拆件后的某几个零件。装配里：parts 写装配里的零件名；自建零件缺省写进它自己的零件文件（用到它的装配都跟着变），标准件、外购件（STEP）、子装配，以及写了 where: \"assembly\" 的，写在这个装配的 component 上（拆开的零件「外壳/上盖」可以只改上盖）。在装配里单独设过的比零件文件的优先：要改回跟零件文件一致，where 写 \"assembly\"，color、finish 写 null。color、finish 写 null 是清除。",
        "Set parts' color and finish: the window shows it, 3MF and STEP exports carry it, the bill of materials lists it. It changes only appearance: no geometry change, no rebuild. In a part file: without parts it is the whole part; parts names some of the parts after a split. In an assembly: parts are part names in the assembly; a self-made part is written to its own part file by default (every assembly that uses it changes too); standard parts, purchased parts (STEP), subassemblies, and anything with where: \"assembly\" are written on this assembly's component (for a split part, \"Enclosure/Lid\" changes only the lid). What is set in the assembly takes precedence over the part file: to make it match the part file again, write where: \"assembly\" with color and finish null. null for color or finish clears it.",
      ),
      input: z.object({
        parts: z
          .array(z.string())
          .optional()
          .describe(
            ta(
              "零件名：拆件后的零件，或装配里的零件（get_state 的「外观」一行列着）；零件文件里不写就是整个零件",
              `Part names: parts after a split, or parts in the assembly (listed in get_state's "Appearance" line); in a part file, leave it out for the whole part`,
            ),
          ),
        color: Color.nullable().optional(),
        finish: Finish.nullable().optional(),
        where: z
          .enum(["file", "assembly"])
          .optional()
          .describe(
            ta(
              "装配里：file = 写进零件文件（自建零件的缺省），assembly = 只在这个装配里",
              "In an assembly: file = write it to the part file (the default for self-made parts), assembly = in this assembly only",
            ),
          ),
      }),
    },
    {
      name: "measure",
      audience: "both",
      description: ta(
        "测量：一个面或边的尺寸（直径、面积、长度）和坐标（平面的中心、圆心、轴线、直线的端点），两个之间的最短距离、夹角、平行面间距、圆心距、轴线间距。也能量两个特征（feature）或两个零件（part）之间的最短距离，0 = 接触，零件相交时给出重叠体积。由内核算，不要自己推算。",
        "Measure: a face's or edge's size (diameter, area, length) and coordinates (a plane's center, a circle's center, an axis, a line's end points); between two of them, the shortest distance, the angle, the distance between parallel faces, the center distance, the distance between axes. It also measures the shortest distance between two features (feature) or two parts (part): 0 = touching; when parts intersect it gives the overlap volume. The kernel computes it: don't work it out yourself.",
      ),
      input: z.object({ a: Target, b: Target.optional() }),
    },
    {
      name: "export",
      audience: "both",
      description:
        ta(
          "导出当前零件或装配：step（实体；多个零件时一个文件里多个带名字的零件）/ stl（多个零件时打包成 zip，每个零件一个文件）/ 3mf（给切片软件：一个文件，每个零件一个对象，单位毫米）、py（等价的 build123d 代码，装配不能导出）、json（特征树）、bom（零件清单 Markdown：名称、文件、数量、体积、外形）。",
          "Export the current part or assembly: step (solids; with several parts, several named parts in one file) / stl (with several parts, a zip with one file per part) / 3mf (for slicers: one file, one object per part, in millimeters), py (equivalent build123d code; assemblies can't be exported this way), json (the feature tree), bom (bill of materials in Markdown: name, file, quantity, volume, outer size). ",
        ) +
        ta(
          "出图：png（图片，要开着窗口）/ svg（黑白线稿，消隐，可标号，专利附图用）。",
          "Pictures: png (an image; needs the window open) / svg (black-and-white line drawing, hidden lines removed, can carry reference numbers, for patent drawings).",
        ),
      input: z.object({
        path: z
          .string()
          .describe(
            ta(
              "输出文件路径，相对当前目录；扩展名决定格式，除非写了 format",
              "Output file path, relative to the current directory; the extension sets the format unless format is given",
            ),
          ),
        format: z.enum(["step", "stl", "3mf", "py", "json", "bom", "png", "svg"]).optional(),
        view: z.enum(["iso", "front", "back", "left", "right", "top", "bottom"]).optional().describe(ta("出图视角", "The view to draw")),
        dir: z.array(z.number()).length(3).optional().describe(ta("出图方向（零件→眼睛），代替 view", "The direction to draw from (part → eye), instead of view")),
        projection: z.enum(["perspective", "orthographic"]).optional(),
        style: z.enum(["shaded", "lines", "xray"]).optional().describe(ta("png 样式", "png style")),
        explode: z.number().min(0).max(1).optional(),
        hide: z.array(z.string()).optional().describe(ta("去掉的零件", "Parts to leave out")),
        labels: z
          .union([z.enum(["none", "numbers", "names"]), z.record(z.string(), z.string())])
          .optional()
          .describe(ta('svg 标号：10、20…；零件名；或 { "零件名": "12" }', 'svg reference numbers: 10, 20…; part names; or { "part name": "12" }')),
        hidden_lines: z.boolean().optional().describe(ta("svg 虚线画挡住的线", "svg: draw hidden lines dashed")),
        background: z.enum(["white", "transparent"]).optional(),
      }),
    },
    {
      name: "share_params",
      audience: "both",
      description: ta(
        "让当前零件或装配用一个共享参数文件（*.params.json）：几个零件写同一个文件，就共用这些尺寸（例如笔杆内径和笔舌直径）。共享参数以文件为准；之后 set_params 改到它们时会写回这个文件，用到它的零件都会重建。move 把零件自己的参数移进共享文件；stop 停用（当前值抄回零件）。",
        "Make the current part or assembly use a shared parameter file (*.params.json): parts that name the same file share these dimensions (e.g. the barrel's inner diameter and the feed's diameter). For shared parameters the file is the source of truth; from then on, set_params on them writes back to this file, and every part that uses it rebuilds. move moves the part's own parameters into the shared file; stop stops using it (the current values are copied back into the part).",
      ),
      input: z.object({
        file: z
          .string()
          .optional()
          .describe(ta("共享参数文件，相对零件文件所在的文件夹，例如 pen.params.json", "The shared parameter file, relative to the part file's folder, e.g. pen.params.json")),
        create: z.boolean().optional().describe(ta("文件不存在时新建", "Create the file if it doesn't exist")),
        move: z.array(z.string()).optional().describe(ta("把零件自己的这些参数移进共享文件", "Move these parameters of the part's own into the shared file")),
        stop: z.boolean().optional().describe(ta("不再用共享参数文件", "Stop using the shared parameter file")),
      }),
    },
    {
      name: "get_notes",
      audience: "both",
      description: ta(
        "读用户在 Turnery 窗口里点在面或边上的备注：编号、写了什么、选中的是什么、一个已验证只选中它的选择器、草图坐标。直接用备注给的选择器，不要自己另写。",
        "Read the notes the user placed on faces or edges in the Turnery window: number, what they wrote, what is selected, a selector verified to select only it, sketch coordinates. Use the selector the note gives; don't write your own.",
      ),
      input: z.object({ status: z.enum(["open", "all"]).optional().describe(ta("缺省只看未处理的", "Default: open notes only")) }),
    },
    {
      name: "resolve_note",
      audience: "both",
      description: ta(
        "处理完一条备注后标为已处理，并用一句话告诉用户做了什么（显示在窗口里）。",
        "After dealing with a note, mark it resolved and tell the user in one sentence what you did (shown in the window).",
      ),
      input: z.object({
        id: z.string().describe(ta("备注 id，例如 n3", "Note id, e.g. n3")),
        reply: z.string().max(400).optional(),
        reopen: z.boolean().optional().describe(ta("重新打开", "Reopen it")),
      }),
    },
    {
      name: "request_pick",
      audience: "agent",
      description: ta(
        "请用户在 Turnery 窗口里点一个面或一条边，等用户点完返回它是什么和一个已验证的选择器。说不清用户指的是哪里时用它，比自己猜准。",
        "Ask the user to click a face or an edge in the Turnery window; when they have clicked, it returns what it is and a verified selector. Use it when you can't tell where the user means: it is more accurate than guessing.",
      ),
      input: z.object({
        prompt: z
          .string()
          .max(200)
          .describe(ta("显示给用户的一句话，例如「点一下要开孔的那个面」", 'One sentence shown to the user, e.g. "Click the face the hole goes in"')),
        kind: z.enum(["face", "edge", "any"]).optional(),
        timeout_sec: z
          .number()
          .int()
          .min(5)
          .max(280)
          .optional()
          .describe(
            ta(
              "最多等多久，缺省 120 秒；没点就返回，可以再调用一次接着等",
              "The longest to wait, default 120 seconds; if nothing is clicked it returns, and you can call it again to keep waiting",
            ),
          ),
      }),
    },
    {
      name: "show",
      audience: "agent",
      description: ta(
        "在 Turnery 窗口里高亮一个特征、一组面或边，指给用户看（例如「我说的是这两条边」）。clear=true 取消高亮。",
        'Highlight a feature, a set of faces, or edges in the Turnery window to point them out to the user (e.g. "these are the two edges I mean"). clear=true removes the highlight.',
      ),
      input: z.object({
        feature: z.string().optional().describe(ta("高亮这个特征生成的面", "Highlight the faces this feature created")),
        faces: FaceSelector.optional(),
        edges: EdgeSelector.optional(),
        label: z.string().max(80).optional().describe(ta("窗口里显示的说明", "The caption shown in the window")),
        clear: z.boolean().optional(),
      }),
    },
    // ---- the window only
    {
      name: "add_note",
      audience: "user",
      description: ta(
        "记一条备注：在点选的面或边上（pick），关于选中的零件（parts）、一个步骤（feature），框选或画笔标出的一片区域（region），或者整个零件。",
        "Add a note: on a picked face or edge (pick), about the selected parts (parts), a step (feature), a region marked with the box or the pen (region), or the whole part.",
      ),
      input: z.object({
        pick: z.record(z.string(), z.unknown()).optional(),
        text: z.string().max(600),
        parts: z.array(z.string().max(300)).max(100).optional(),
        feature: z.string().max(100).optional(),
        name: z.string().max(200).optional(),
        point: V3.optional(),
        part: z.string().max(300).optional(),
        region: z
          .object({
            shape: z.enum(["box", "pen"]),
            camera: z.object({ position: V3, target: V3, up: V3 }),
            rect: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
            strokes: z.array(z.array(V3).max(2000)).max(50).optional(),
            faces: z.number().int().min(0),
            bbox: z.tuple([V3, V3]).nullable(),
            origins: z.array(z.string()).max(200),
            parts: z.array(z.string()).max(200),
            image: z.string().max(12_000_000).optional(),
          })
          .optional(),
      }),
    },
    {
      name: "edit_tree",
      audience: "user",
      description: ta(
        "窗口里的人改特征树（新建、编辑一步）：整体替换。group 相同的连续修改合成一步撤销（一张表单一个 group）；改回到这一组开始前的样子（取消表单）就不留这一步。",
        "The person's edit in the window (making or editing a step): replaces the whole tree. Consecutive edits with the same group undo as one step (one group per form); changing it back to how it was before the group (a cancelled form) leaves no step.",
      ),
      input: z.object({ tree: Tree, base_rev: z.number().int().optional(), group: z.string().max(100).optional() }),
    },
    {
      name: "update_note",
      audience: "user",
      description: ta("改备注的文字，或删除、重开、标为已处理。", "Change a note's text, or delete, reopen or resolve it."),
      input: z.object({ id: z.string(), text: z.string().max(600).optional(), status: z.enum(["open", "resolved"]).optional(), remove: z.boolean().optional() }),
    },
    {
      name: "rename_file",
      audience: "user",
      description: ta(
        "给零件或装配文件改名（name 不带结尾）：文件和它的备注一起改，用到它的装配跟着改；打开着的照样开着。",
        "Rename a part or assembly file (name without the ending): the file and its notes are renamed together, and the assemblies that use it follow; if it is open it stays open.",
      ),
      input: z.object({ path: z.string(), name: z.string().max(80) }),
    },
    {
      name: "rename_part",
      audience: "user",
      description: ta(
        "给装配里的一个零件改名（id 是它的 component）：只改这个装配里的叫法，贴合、核对和备注里的名字跟着改。",
        "Rename a part in the assembly (id is its component): only its name in this assembly changes; the names in mates, checks and notes follow.",
      ),
      input: z.object({ id: z.string(), name: z.string().max(40) }),
    },
    {
      name: "close_part",
      audience: "user",
      description: ta("关闭一个零件（文件不动）。", "Close a part (the file is left as it is)."),
      input: z.object({ path: z.string() }),
    },
    {
      name: "close_project",
      audience: "user",
      description: ta("关闭项目和全部打开的文件（文件不动），窗口回到首页。", "Close the project and every open file (the files are left as they are); the window goes back to the home page."),
      input: z.object({}),
    },
    {
      name: "scan_project",
      audience: "user",
      description: ta("重新扫描项目文件夹（窗口回到前台时）。", "Scan the project folder again (when the window comes back to the front)."),
      input: z.object({}),
    },
    {
      name: "add_part",
      audience: "user",
      description: ta(
        "往当前装配里加零件：name 新建 parts/<name>.turnery.json 并在装配里编辑它（可以带上颜色和质感）；file 放一个已有的零件、装配或 STEP。",
        "Add a part to the current assembly: name creates parts/<name>.turnery.json and edits it in the assembly (it can come with a color and finish); file places an existing part, assembly or STEP.",
      ),
      input: z.object({ name: z.string().optional(), file: z.string().optional(), color: Color.optional(), finish: Finish.optional() }),
    },
  ]

  return [...own.slice(0, 2), ...studioTools, ...own.slice(2)]
}

const built: Partial<Record<AgentLang, CommandSpec[]>> = {}

/** Every command, described in `lang` (the website's server answers each request in its own language). */
export const commandsIn = (lang: AgentLang) => (built[lang] ??= withAgentLang(lang, build))

export const COMMANDS: CommandSpec[] = commandsIn(agentLang())
export const COMMAND = new Map(COMMANDS.map((c) => [c.name, c]))

export const agentCommands = () => COMMANDS.filter((c) => c.audience !== "user")

/** The agent's commands described in `lang`. */
export const agentCommandsIn = (lang: AgentLang) => commandsIn(lang).filter((c) => c.audience !== "user")

type Json = Record<string, unknown>
const toJson = (schema: z.ZodType): Json => {
  const s = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Json
  delete s.$schema
  return s
}

/**
 * Sub-schemas written once per tool under `$defs` and referred to by `$ref`: a selector is inlined at
 * every place it's used (a check item has a dozen), which made the tool list ~240 KB. Largest first, so
 * a plane reference is matched whole before the face selector inside it.
 */
const SHARED_DEFS: [string, z.ZodType][] = [
  ["PlaneRef", PlaneRef],
  ["EdgeSelector", EdgeSelector],
  ["FaceSelector", FaceSelector],
]

/** Equal as JSON, ignoring the description at the top (the same schema described for one use). */
function sameShape(a: unknown, b: Json): boolean {
  if (!a || typeof a !== "object" || Array.isArray(a)) return false
  const { description: _a, ...ra } = a as Json
  const { description: _b, ...rb } = b
  void _a
  void _b
  return JSON.stringify(ra) === JSON.stringify(rb)
}

/** Replace every copy of a shared sub-schema below `node` with a `$ref`; returns the names it used. */
function refShared(node: unknown, defs: [string, Json][], used: Set<string>): unknown {
  if (Array.isArray(node)) return node.map((x) => refShared(x, defs, used))
  if (!node || typeof node !== "object") return node
  for (const [name, def] of defs) {
    if (!sameShape(node, def)) continue
    used.add(name)
    const desc = (node as Json).description
    return desc && desc !== def.description ? { $ref: `#/$defs/${name}`, description: desc } : { $ref: `#/$defs/${name}` }
  }
  return Object.fromEntries(Object.entries(node as Json).map(([k, v]) => [k, refShared(v, defs, used)]))
}

/**
 * A selector's `not` lists every field of the selector a second time. In the tool list it only says so:
 * the engine still validates what the agent writes against the full schema.
 */
function shortNot(def: Json): Json {
  const props = def.properties as Json | undefined
  const not = props?.not as Json | undefined
  if (!props || !not?.properties) return def
  const desc = String(not.description ?? "")
  return { ...def, properties: { ...props, not: { type: "object", description: ta(`${desc}；字段和上面一样（不含 not、expect）`, `${desc}; the same fields as above (without not, expect)`) } } }
}

type Slot = { parent: Record<string | number, unknown>; key: string | number; hint: string }
/** Every place under `s` that holds a sub-schema (not the `properties` maps themselves, not the entries of `$defs`). */
function schemaSlots(s: Json, out: Slot[] = [], hint = ""): Slot[] {
  const visit = (parent: Record<string | number, unknown>, key: string | number, h: string, candidate: boolean) => {
    const v = parent[key]
    if (!v || typeof v !== "object" || Array.isArray(v)) return
    if (candidate) out.push({ parent, key, hint: h })
    schemaSlots(v as Json, out, h)
  }
  if (s.properties && typeof s.properties === "object") for (const name of Object.keys(s.properties)) visit(s.properties as Json, name, name, true)
  if (s.$defs && typeof s.$defs === "object") for (const name of Object.keys(s.$defs)) visit(s.$defs as Json, name, name, false)
  for (const k of ["anyOf", "oneOf", "allOf"]) if (Array.isArray(s[k])) (s[k] as unknown[]).forEach((_, i) => visit(s[k] as Record<number, unknown>, i, hint, true))
  if (Array.isArray(s.items)) s.items.forEach((_, i) => visit(s.items as Record<number, unknown>, i, hint, true))
  else if (s.items) visit(s, "items", hint, true)
  if (s.additionalProperties && typeof s.additionalProperties === "object") visit(s, "additionalProperties", hint, true)
  return out
}

/**
 * Sub-schemas written out more than once in one tool (the point list of a path and of a polyline, the
 * two ends of a distance) move under `$defs`, largest saving first. Nothing is lost: only repeats go.
 */
function hoistRepeats(schema: Json): Json {
  const defs = (schema.$defs ?? {}) as Json
  for (let round = 0; round < 16; round++) {
    const seen = new Map<string, { n: number; hint: string }>()
    for (const slot of schemaSlots(schema)) {
      const node = slot.parent[slot.key] as Json
      if ("$ref" in node) continue
      const text = JSON.stringify(node)
      if (text.length < 120) continue
      const e = seen.get(text)
      if (e) e.n++
      else seen.set(text, { n: 1, hint: slot.hint })
    }
    let best: { text: string; hint: string; saving: number } | null = null
    for (const [text, { n, hint }] of seen) {
      const saving = (n - 1) * text.length - n * 28
      if (n > 1 && saving > 100 && (!best || saving > best.saving)) best = { text, hint, saving }
    }
    if (!best) break
    const hint = best.hint.replace(/[^A-Za-z0-9]/g, "")
    const base = (hint.length > 1 ? hint : "Target").replace(/^./, (c) => c.toUpperCase())
    let name = base
    for (let i = 2; name in defs; i++) name = `${base}${i}`
    for (const slot of schemaSlots(schema)) if (JSON.stringify(slot.parent[slot.key]) === best.text) slot.parent[slot.key] = { $ref: `#/$defs/${name}` }
    defs[name] = JSON.parse(best.text)
  }
  if (Object.keys(defs).length) schema.$defs = defs
  return schema
}

let defsCache: { raw: [string, Json][]; out: Map<string, Json> } | null = null
/** The shared schemas as generated (to match against) and as written out (smaller ones inside referenced). */
function sharedDefs() {
  if (defsCache) return defsCache
  const raw = SHARED_DEFS.map(([name, s]) => [name, toJson(s)] as [string, Json])
  const out = new Map(
    raw.map(([name, def], i) => {
      const { description, ...body } = def
      const inner = shortNot(refShared(body, raw.slice(i + 1), new Set()) as Json)
      return [name, description ? { ...inner, description } : inner]
    }),
  )
  defsCache = { raw, out }
  return defsCache
}

/**
 * `set_tree` takes a whole feature tree: its full schema is every feature tool's schema at once (~100 KB).
 * The agent writes features exactly as it calls the feature tools; the engine validates the tree.
 */
const treeJson = (): Json => ({
  type: "object",
  description: ta(
    "完整的特征树 { uses?, params, paramNotes?, features, checks? }。features 里每一项写 op（特征工具的名字，如 sketch、extrude、fillet）加上和那个工具一样的字段；checks 的每一项和 check 工具的 items 一样。整棵树按特征工具的参数校验，有错会说明是哪一项。",
    "The complete feature tree { uses?, params, paramNotes?, features, checks? }. Each item of features has op (the feature tool's name, such as sketch, extrude, fillet) plus the same fields as that tool; each item of checks is the same as an item of the check tool's items. The whole tree is validated against the feature tools' parameters; an error says which item.",
  ),
  properties: {
    uses: { type: "string", description: ta("共享参数文件（share_params 写的）", "The shared parameter file (written by share_params)") },
    params: { type: "object", additionalProperties: { type: ["number", "string"] } },
    paramNotes: { type: "object", additionalProperties: { type: "string" } },
    features: { type: "array", items: { type: "object", properties: { op: { type: "string" }, id: { type: "string" } }, required: ["op", "id"] } },
    checks: { type: "array", items: { type: "object" } },
  },
  required: ["params", "features"],
})

/** JSON Schema of a command's input, for MCP `tools/list`: shared selectors under `$defs`. */
export function inputJsonSchema(spec: CommandSpec): Record<string, unknown> {
  const s = toJson(spec.input)
  if (spec.name === "set_tree") (s.properties as Json).tree = treeJson()
  const { raw, out: defs } = sharedDefs()
  const used = new Set<string>()
  const result = refShared(s, raw, used) as Json
  // A shared schema may refer to a smaller one (a plane reference holds a face selector).
  for (const name of [...used]) for (const m of JSON.stringify(defs.get(name)).matchAll(/#\/\$defs\/(\w+)/g)) used.add(m[1])
  if (used.size) result.$defs = structuredClone(Object.fromEntries(SHARED_DEFS.filter(([n]) => used.has(n)).map(([n]) => [n, defs.get(n)])))
  return hoistRepeats(result)
}

/** Inputs that name files: resolved against the caller's directory before they reach the engine. */
export const PATH_FIELDS: Record<string, string[]> = { open_part: ["path"], export: ["path"] }

/** The sections of the web studio's system prompt that are about modelling, not teaching: their headings in each language. */
const PROMPT_SECTIONS: [zh: string, en: string][] = [
  ["数值", "Numbers"],
  ["坐标与基准面", "Coordinates and datum planes"],
  ["扫掠、放样、拔模", "Sweep, loft, draft"],
  ["建模习惯", "Modeling habits"],
  ["文字", "Text"],
  ["选择器", "Selectors"],
]

function promptSections(lang: AgentLang) {
  const blocks = systemPrompt(lang).split(/\n(?=## )/)
  return blocks.filter((b) => PROMPT_SECTIONS.some(([zh, en]) => b.startsWith(`## ${lang === "en" ? en : zh}`))).join("\n\n")
}

const GUIDE_ZH = `# Turnery：用工具建参数化零件

零件是一棵特征树（JSON 文件 *.turnery.json）：参数表 + 有序的特征（草图、拉伸、旋转、圆角、抽壳、孔、阵列……），几何由 OpenCascade 内核算出。几个零件可以组成装配（*.turnery-asm.json），共用一个参数文件。用户在 Turnery 窗口里实时看到你的每一步，可以拖参数、改特征、在面或边上留备注。

这份说明较长；如果你看到的被截断了，先调用 guide 读全文（尤其是「零件和装配」「曲面和精细形状」两节）。

## 工作方式
0. 开建前先用一两句话说出：要建的是什么（例如「钢笔：有钢制笔尖的自来水笔」，不是圆珠笔）、由哪几个零件组成、做到什么程度、用单文件还是装配（见「零件和装配」）。拿不准是什么东西、要不要某个部件，先问用户。
1. 先 open_part（path 写零件文件，相对当前目录；新零件加 create: true）。窗口会切到这个零件。
2. set_params 把关键尺寸定成参数（短英文名），特征里用参数名或表达式引用；notes 给每个参数写一句说明。每个特征写 name（中文短名）和 intent（设计意图）。
3. 每次调用后读结果：✓ 继续；✗ 按提示用 edit_feature 修好，不要叠一个新特征绕开；⚠ 要处理。
4. 不确定选择器会选中什么时，先用 inspect（faces 或 edges，带同样的选择器）看一眼。
5. 需求里有具体数字时，建完调用 check：每个数值要求一项（外形 size、壁厚 thickness、孔 holes、距离 distance、节圆 pcd、角度 angle、体积 volume、坐标 position），said 写用户的原话，期望值写用户给的数字（不写参数名）。这些要求存进零件，之后每次重建都自动重算，窗口里也看得到。size 只量整个零件的外形；局部尺寸用 distance 或 thickness，让选择器正好选中要量的面。✗ 时先确认量的位置对不对；确实没做到再改模型，不要为了通过去改期望值。
   验证要看得到、量得出，不要只凭自己推算就说做好了：
   - 用 look 看外形和方向。结果里写着每张图 1 px 多少 mm：小于几个像素的细节看不清，用 focus（特征 id、{ part }、{ faces }）放大，用 section 剖开看里面（间隙、壁厚、内腔），用 hide 藏起挡住的零件。最后一步改动很小时会自动加一张特写，看它。不要说「请到窗口里放大看」就收尾。
   - 要 3D 打印的零件，建完再加三项：overhang（不加支撑能不能打；up 写打印时朝上的方向，上盖翻过来打就写 "-Z"）、min_wall（最薄的壁，0.4 喷嘴写 0.8）、bed（贴在打印平台上的面积）。有多个零件时用 part 分开核对。悬垂不过，先想换个方向打或者把朝下的面改成 45° 的倒角，不要直接说「需要支撑」。
   - 应该贴在一起的地方（笔尖压在笔舌上、盖子落在止口上），加一条 gap（a、b 写 face / edge / feature / part，max: 0 = 必须贴上；min = 至少隔多远）。
   - 两处之间的距离、某个面或孔在哪，用 measure（也能量两个特征或两个零件之间），不要自己算。
   - 每步结果里的 ⚠（没接上、只碰到边、极小碎面、窄缝、薄壁、零件重叠）要处理或说明。窄缝多半是该贴上的没贴上（凸台差一点碰到墙）；薄壁是孔、槽离边太近。
   - of 选不到时，报错会说满足其余条件的面记在哪个特征名下：共面的面合并后记在先生成它的特征名下，去掉 of 改用 normal、extreme、near。
6. 用户在窗口里留的备注用 get_notes 读，处理完用 resolve_note 写一句回复。说不清用户指的是哪个面时，用 request_pick 请用户在窗口里点一下；要指给用户看时用 show。
7. 结果开头写着「自你上次调用以来……」时，说明用户或文件改过模型：以最新状态为准，不要把用户的改动改回去。
8. 交付用 export（step / stl / 3mf / py / json）；要图就导出 png（图片）或 svg（黑白线稿，可标号，专利附图用）。特征树文件也可以直接读写，保存后窗口会自动重建；改完文件用 get_state 看重建结果。

${promptSections("zh")}

## 零件和装配
| 情况 | 用什么 |
| --- | --- |
| 一个实体切开（外壳的底壳和上盖、超长的杆分段打印） | 单文件 + split |
| 最多 3 件紧密配合、共用很多尺寸的零件（笔尖和笔舌、盒子和盖板） | 单文件：加料时 part 写一个新名字 |
| 要复用的零件、标准件、外购件（STEP）、超过 3 件，或者体积大、要分开维护 | 多文件装配 |
- 单文件新建零件：加料（拉伸、旋转、扫掠、放样）写 part: "笔尖"，名字还不存在就新建一个零件，不和别的料合并（重叠会给 ⚠）。第一次加料写的 part 就是主体的名字；没写的话，主体叫「主体」。之后写 part 只改那个零件；修形、刻字只切它自己。
- 项目：多个零件组成的东西，先 open_project（path 写文件夹名，create: true），会建好同名的空装配和共享参数文件并打开装配。零件放在 parts/ 下（open_part path: "pen/parts/笔杆.turnery.json" create: true），再在装配里用 component 放进来。list_parts 列出项目里的全部文件。
- 装配：每个零件一个文件（*.turnery.json），装配是 *.turnery-asm.json（open_part create: true 新建）。装配里只放 component：file 写零件文件、子装配或 .step 外购件，name 是它在装配里的名字，rotate、at 摆位置（先转后移，可以写参数），或者用 mates 贴合（见下一节）。装配不能放几何特征：要改形状就 open_part 打开那个零件。
- 共用尺寸：share_params 让零件和装配用同一个共享参数文件（*.params.json，move 把已有参数移进去）。共享参数以文件为准，set_params 改到它们会写回文件，用到它的零件一起重建。
- 在装配里改零件：open_part 带 context: "pen.turnery-asm.json"，装配里的其他零件按相对位置半透明地显示在旁边；look 能看到它们，measure 的 part、check 的 gap / clearance / interference 能写它们的名字。不带 context 再打开一次就退出。
- 装配建好后：check 用 gap 核对该贴上的地方、interference 核对不该相交的地方；look 用 hide 和 section 看里面；export 出 step、stl（多零件打包成 zip）和 bom（零件清单）。

## 颜色和质感
- 用户说了颜色（「上盖做成橙色」「螺丝用黑色」），或者要看最终效果、区分几类零件时，用 set_appearance 设：color 写色板名（white、silver、gray、black、red、orange、yellow、green、teal、blue、purple、pink），要还原具体的耗材、喷漆颜色时写 #RRGGBB；finish 写 matte 哑光（缺省）、metal 金属、clear 透明（例如透明外壳，能看到里面的板子）。
- 颜色只是外观：不改几何、不重建，窗口里随时可以关掉看白模。没设颜色的零件是白模，标准件按金属色、STEP 外购件按深灰显示。
- 零件文件里：拆件后用 parts 分别设（上盖橙、底壳灰）；没拆就是整个零件。装配里：自建零件的颜色缺省写进它自己的零件文件，标准件和外购件写在装配的 component 上（component 也可以直接带 appearance，拆开的零件用 appearance.parts 分别设）。同一类零件设同一种颜色，零件清单和导出的 3MF 也按颜色分开。
- 同一个零件在不同装配里要不同颜色（样机橙色、量产黑色）：where: "assembly" 只改这个装配，零件文件不变。get_state 的「外观」一行里标着「这个装配里单独设的」；这些零件改零件文件，这个装配里看不到变化。
- look 的图按颜色画，结果里有一行颜色图例；要看纯形状写 plain: true。

## 标准件和贴合摆放
- 螺钉、螺母、垫圈、热熔螺母不用建零件文件：component 写 standard（不写 file），例如 {"type":"screw","size":"M3","head":"socket","length":10}；head：socket 内六角圆柱头（缺省）、button 半圆头、flat 沉头、pan 盘头。零件清单（export bom）按规格合并计数。
- 标准件自己的坐标：轴线沿 Z；螺钉头的底面（支承面）在 z=0、螺杆朝 -Z（沉头螺钉头顶在 z=0）；螺母、垫圈从 z=0 往上；热熔螺母顶面在 z=0 往下。
- 贴合摆放（mates）代替手算坐标：按顺序满足，后一条只在前面留下的自由度里移动、转动。contact = 面贴面（例如盖子底面贴盒口），flush = 平齐（两个侧面在同一平面），coaxial = 同轴（螺钉进孔）。face 选这个零件上的面（按它自己文件里的坐标），to 写前面放好的零件名和它上面的面（按装配里的位置）；都不写 of。
- 一次放一排：to.face 选中几个不同轴（或不共面）的面，就放几个，零件名带 #1、#2…。例如 M3 内六角螺钉进盖子的 4 个过孔：mates = [{type:"coaxial", face:{kind:"cylinder"}, to:{part:"盖子", face:{kind:"cylinder", radius:1.7}}}, {type:"contact", face:{normal:"-Z", extreme:"+Z"}, to:{part:"盖子", face:{normal:"+Z", extreme:"+Z"}}}]（先同轴、再贴合）。
- 盖子：contact 底面贴盒口，再用两条 flush 把两个侧面对齐，位置就定了。
- 结果里写「没有完全做到」时，说明前面的贴合不让它这样动：换顺序，或用 rotate 先转到大致方向。
- 3D 打印件拧螺丝：塑料上打 hole 的 standard（fit: "insert"）热熔螺母孔，装配里放 standard type: "insert"；或者 fit: "tap" 让螺丝自攻。

## 螺纹
- 真实螺纹几何用 thread：faces 选圆柱面，轴的外圆做外螺纹、孔壁做内螺纹（孔先打成小径或攻丝底孔）；size（M2–M12 粗牙）或 d + pitch；length + from 只做一段；clearance 是打印间隙（FDM 常用 0.1–0.2）。
- 适合螺纹盖、瓶口、M8 以上的螺栓螺母；一般的螺丝孔用 hole 的 standard（fit: "tap" 只标装饰螺纹）或热熔螺母，更快也更好打印。
- 螺纹面很多，一个螺纹要几秒：放在最后，改前面的尺寸时会重建它。

## 曲面和精细形状
- 求交：拉伸、旋转、扫掠、放样写 mode: "intersect"，只留下和工具体重叠的部分（例如笔尖 = 半圆锥薄壳 ∩ 盾形轮廓）。有多个零件时写 part。
- 旋转：start 是起始角（从草图所在的位置按右手定则先转），symmetric: true 以草图为中线两侧各转一半。转一部分的回转面（例如只要朝 -Y 的半圈）用它们，不要把截面画到另一侧去凑。
- 草图点：{ "spline": [[x, y], …] } 是光滑样条（依次经过这些点），{ "to": [x, y], "r": 2 } 是倒 R2 圆角的拐角。笔尖肩部、笔夹末端这类有机曲线用它们，不要用三点圆弧拼。
- 沿面等深：拉伸写 onto（选中一个平面或圆柱面），草图投影到面上，切除时从面往里切 distance 深，加料时往外长 distance 高。圆柱面上刻字、凸字用它，各处深度一样；草图放在要刻的那一侧。

## 导入 STEP（开发板、元件的官方模型）
- import 读一个 STEP 文件，路径相对零件文件所在的文件夹（可以是子文件夹，如 "vendor/board.step"）。先用 import 把它放进来（缺省是参考体），再用 inspect body 或 get_state 看它的尺寸，用 rotate、at 摆到要的位置（先旋转后平移，单位 mm）。
- 参考体半透明显示，不并入零件、不导出。它的面可以选：选择器里 of 写 import 的 id（或名字），再加 normal、extreme、near、kind，例如板子底面 { "of": "board", "normal": "-Z", "extreme": "-Z" }。可以用在 inspect、measure、check（distance / gap / position）和 sketch、hole 的 on.face 上：开口、支撑柱直接对着板上的面定位，板子换了位置它们跟着走，不要自己抄坐标。参考体的面不能改（圆角、倒角、抽壳选不到）；不写 of 的选择器只在零件自己的面里选。在装配里改零件时，旁边的零件同样可以用 of 写它的名字来选面。
- 核对配合用 check：clearance（ref 写 import 的 id，min 写最小间隙）和 interference（不能相交）。改了参数或外壳以后，它们每次重建都会重算。
- mode=cut 从实体里减去整个导入体（给元件挖让位槽，通常先把元件的外形放大一点更合适）；mode=add 并入实体。
- 文件换了新版本，窗口会自动重建。

## 做不到的
目前不支持钣金、曲面加厚。装配的贴合只用来摆放（按顺序算一次），不是约束求解，也没有运动。标准件只有公制粗牙 M2–M12，螺钉上的螺纹只画成光杆（装饰）。做不到就直说，并给出最接近的做法。不要编造工具没有的参数。`

const GUIDE_EN = `# Turnery: build parametric parts with tools

A part is a feature tree (a JSON file, *.turnery.json): a parameter table + an ordered list of features (sketch, extrude, revolve, fillet, shell, hole, pattern…); the OpenCascade kernel computes the geometry. Several parts can make up an assembly (*.turnery-asm.json) and share one parameter file. The user sees each of your steps live in the Turnery window and can drag parameters, edit features, and leave notes on faces or edges.

This guide is long. If what you see is cut off, first call guide to read all of it (especially the two sections "Parts and assemblies" and "Curved surfaces and fine shapes").

## How to work
0. Before you start building, say in one or two sentences: what you are building (for example "fountain pen: an ink pen with a steel nib", not a ballpoint pen), which parts it is made of, how far you will take it, and whether you use a single file or an assembly (see "Parts and assemblies"). If you are not sure what the thing is, or whether a component is wanted, ask the user first.
1. First call open_part (path: the part file, relative to the current directory; for a new part add create: true). The window switches to this part.
2. Use set_params to make the key dimensions parameters (short English names), and refer to them in features by parameter name or expression; in notes, write one sentence describing each parameter. Give every feature a name (a short name in the user's language) and an intent (the design intent).
3. Read the result after every call: ✓ go on; ✗ fix it with edit_feature as the message says, don't stack a new feature on top to work around it; ⚠ must be dealt with.
4. When you are not sure what a selector will select, look first with inspect (faces or edges, with the same selector).
5. When the request has specific numbers, call check after building: one item per numeric requirement (size for the outer size, thickness for a wall thickness, holes for holes, distance for a distance, pcd for a pitch circle, angle for an angle, volume for the volume, position for coordinates). In said, write the user's own words (in their language); as the expected value, write the number the user gave (not a parameter name). These requirements are stored in the part, recomputed automatically on every rebuild from then on, and visible in the window. size only measures the whole part's outer size; for local dimensions use distance or thickness, with selectors that select exactly the faces to measure. On ✗, first make sure you measured the right place; only if the model really misses it, change the model. Don't change the expected value to make it pass.
   Verify by seeing and measuring. Don't say it's done based only on your own reasoning:
   - Use look to check the shape and orientation. The result says how many mm 1 px is in each image: details smaller than a few pixels can't be seen; zoom in with focus (a feature id, { part }, { faces }), cut it open with section to see inside (gaps, wall thickness, cavities), and hide the parts in the way with hide. When the last change is small, a close-up is added automatically: look at it. Don't finish by saying "zoom in in the window to see".
   - For a part to be 3D printed, add three more items after building: overhang (whether it prints without supports; up is the direction that faces up when printing: for a lid printed upside down write "-Z"), min_wall (the thinnest wall; for a 0.4 nozzle write 0.8), bed (the area that sits on the print bed). With several parts, check each one separately with part. If overhang fails, first think of printing in another orientation or turning the downward-facing faces into 45° chamfers; don't just say "it needs supports".
   - Where things should sit against each other (a nib pressed onto the feed, a lid resting on its lip), add a gap item (a, b: face / edge / feature / part; max: 0 = must touch; min = at least this far apart).
   - For the distance between two places, or where a face or hole is, use measure (it also measures between two features or two parts). Don't compute it yourself.
   - Deal with or explain every ⚠ in a step's result (not connected, touching only at an edge, tiny sliver faces, narrow gap, thin wall, parts overlapping). A narrow gap usually means something that should touch doesn't (a boss falls just short of the wall); a thin wall means a hole or slot is too close to an edge.
   - When of selects nothing, the error says which feature name the faces meeting the other conditions are recorded under: coplanar faces, once merged, are recorded under the feature that made them first. Drop of and use normal, extreme, near instead.
6. Read the notes the user leaves in the window with get_notes; when you are done with one, write a one-sentence reply with resolve_note. When you can't tell which face the user means, use request_pick to ask the user to click it in the window; to point something out to the user, use show.
7. When a result begins with "Since your last call…", the user or the file changed the model: go by the latest state, and don't change the user's changes back.
8. Deliver with export (step / stl / 3mf / py / json); for pictures, export png (an image) or svg (black-and-white line drawing, can carry reference numbers, for patent drawings). You can also read and write the feature tree file directly: when it is saved the window rebuilds automatically; after you edit the file, see the rebuild result with get_state.

${promptSections("en")}

## Parts and assemblies
| Situation | Use |
| --- | --- |
| One solid cut apart (an enclosure's base and lid, an extra-long rod printed in segments) | Single file + split |
| Up to 3 closely fitting parts that share many dimensions (nib and feed, box and lid plate) | Single file: when adding material, give part a new name |
| Parts to reuse, standard parts, purchased parts (STEP), more than 3 parts, or large parts to maintain separately | Multi-file assembly |
- A new part in a single file: on a feature that adds material (extrude, revolve, sweep, loft) write part: "Nib". If that name doesn't exist yet, a new part is created, not merged with other material (overlap gives ⚠). The part written on the first material-adding feature is the main body's name; if none is written, the main body is called "主体". After that, writing part changes only that part; modifying features and engraving cut only that part.
- Projects: for a thing made of several parts, first call open_project (path: the folder name, create: true); it creates an empty assembly and a shared parameter file with the same name and opens the assembly. Put the parts under parts/ (open_part path: "pen/parts/barrel.turnery.json" create: true), then place them in the assembly with component. list_parts lists every file in the project.
- Assemblies: one file per part (*.turnery.json); the assembly is *.turnery-asm.json (create it with open_part create: true). An assembly holds only components: file is a part file, a subassembly or a purchased .step part; name is its name in the assembly; rotate and at place it (rotate first, then move; parameters allowed), or mate it with mates (see the next section). An assembly can't hold geometry features: to change a shape, open that part with open_part.
- Shared dimensions: share_params makes parts and assemblies use the same shared parameter file (*.params.json; move moves existing parameters into it). For shared parameters the file is the source of truth: set_params on them writes back to the file, and the parts that use it rebuild together.
- Editing a part in an assembly: open_part with context: "pen.turnery-asm.json"; the assembly's other parts show alongside it, semi-transparent, in their relative positions; look shows them, and measure's part and check's gap / clearance / interference can name them. Open it again without context to leave.
- Once the assembly is built: check with gap the places that should touch and with interference the places that must not intersect; look inside with look's hide and section; export step, stl (several parts packed into a zip) and bom (bill of materials).

## Color and finish
- When the user names a color ("make the lid orange", "black screws"), or wants to see the final look or tell groups of parts apart, set it with set_appearance: color is a palette name (white, silver, gray, black, red, orange, yellow, green, teal, blue, purple, pink), or #RRGGBB to match a specific filament or paint color; finish is matte (default), metal, or clear (transparent, e.g. a clear case that shows the board inside).
- Color is only appearance: no geometry change, no rebuild, and the window can switch it off at any time to show the clay (plain white) model. Parts without a color are plain white; standard parts show in a metal color, purchased STEP parts in dark gray.
- In a part file: after a split, set each part with parts (lid orange, base gray); without a split it is the whole part. In an assembly: a self-made part's color is written to its own part file by default; standard and purchased parts get it on the assembly's component (a component can also carry appearance directly; for split parts set each one with appearance.parts). Give the same kind of part the same color; the bill of materials and the exported 3MF are split by color too.
- The same part in different colors in different assemblies (orange prototype, black production): where: "assembly" changes only this assembly and leaves the part file as it is. In get_state's "Appearance" line these are marked "(set in this assembly)"; changing their part file shows no change in this assembly.
- look draws in color, and its result has a line with the color legend; for the plain shape write plain: true.

## Standard parts and placing with mates
- Screws, nuts, washers and heat-set inserts need no part file: write standard on the component (no file), for example {"type":"screw","size":"M3","head":"socket","length":10}; head: socket = socket head cap screw (default), button = button head, flat = flat (countersunk) head, pan = pan head. The bill of materials (export bom) counts them merged by spec.
- A standard part's own coordinates: the axis is along Z; the underside of a screw head (the bearing face) is at z=0 with the shank toward -Z (for a flat head screw, the top of the head is at z=0); nuts and washers go up from z=0; a heat-set insert's top face is at z=0 and it goes down.
- Place with mates instead of computing coordinates by hand: they are satisfied in order, and each one only moves and turns the part within the degrees of freedom the earlier ones left. contact = face against face (e.g. the lid's bottom face on the box's rim), flush = flush (two side faces in one plane), coaxial = coaxial (a screw into a hole). face selects a face on this part (in its own file's coordinates); to gives the name of a part placed earlier and a face on it (in its position in the assembly); neither uses of.
- A row at once: when to.face selects several faces on different axes (or not coplanar), that many are placed, and the part names get #1, #2…. For example, M3 socket head screws into the lid's 4 clearance holes: mates = [{type:"coaxial", face:{kind:"cylinder"}, to:{part:"Lid", face:{kind:"cylinder", radius:1.7}}}, {type:"contact", face:{normal:"-Z", extreme:"+Z"}, to:{part:"Lid", face:{normal:"+Z", extreme:"+Z"}}}] (coaxial first, then contact).
- A lid: contact puts its bottom face on the box's rim, then two flush mates align two side faces, and its position is fixed.
- When the result says a mate "isn't fully met", the earlier mates don't let it move that way: change the order, or first turn it to roughly the right orientation with rotate.
- Screws into 3D printed parts: in the plastic, make a heat-set insert hole with hole's standard (fit: "insert") and place a standard type: "insert" in the assembly; or use fit: "tap" so the screw taps its own thread.

## Threads
- For real thread geometry use thread: faces selects cylindrical faces; a shaft's outer cylinder gets an external thread, a hole wall an internal thread (make the hole at the minor diameter or the tap drill size first); size (M2–M12 coarse) or d + pitch; length + from for only a section; clearance is the printing clearance (0.1–0.2 is common for FDM).
- It suits screw caps, bottle necks, and bolts and nuts from M8 up; for ordinary screw holes use hole's standard (fit: "tap" only marks a cosmetic thread) or heat-set inserts: faster, and better to print.
- A thread has many faces and takes a few seconds: put it last; changing earlier dimensions rebuilds it.

## Curved surfaces and fine shapes
- Intersect: on extrude, revolve, sweep and loft, mode: "intersect" keeps only the part that overlaps the tool body (e.g. a nib = half-cone thin shell ∩ shield-shaped outline). With several parts, write part.
- Revolve: start is the start angle (turned first, from where the sketch is, by the right-hand rule); symmetric: true turns half to each side, with the sketch in the middle. For a partial revolved surface (e.g. only the half turn facing -Y) use these; don't draw the profile on the other side to fake it.
- Sketch points: { "spline": [[x, y], …] } is a smooth spline (through these points in order); { "to": [x, y], "r": 2 } is a corner rounded with an R2 fillet. Use them for organic curves such as a nib's shoulder or the end of a pen clip; don't piece them together from three-point arcs.
- Even depth along a face: write onto on an extrude (selecting a planar or cylindrical face); the sketch is projected onto the face; a cut goes distance deep into the face, added material grows distance high out of it. Use it for engraved or raised text on a cylindrical face, so the depth is the same everywhere; put the sketch on the side to be engraved.

## Importing STEP (official models of dev boards and components)
- import reads a STEP file; the path is relative to the part file's folder (a subfolder works, e.g. "vendor/board.step"). First bring it in with import (a reference body by default), then see its size with inspect body or get_state, and put it where you want with rotate and at (rotate first, then translate; in mm).
- A reference body shows semi-transparent; it is not merged into the part and not exported. Its faces can be selected: in a selector, write the import's id (or name) as of, then add normal, extreme, near, kind, e.g. the board's bottom face { "of": "board", "normal": "-Z", "extreme": "-Z" }. This works in inspect, measure, check (distance / gap / position) and the on.face of sketch and hole: place openings and standoffs directly against faces on the board, so they follow when the board moves; don't copy coordinates yourself. A reference body's faces can't be modified (fillet, chamfer and shell can't select them); a selector without of selects only among the part's own faces. When you edit a part in an assembly, you can likewise select faces of the parts beside it by writing a part's name as of.
- Check the fit with check: clearance (ref: the import's id, min: the minimum clearance) and interference (must not intersect). After you change parameters or the enclosure, they are recomputed on every rebuild.
- mode=cut subtracts the whole imported body from the solid (to cut a clearance pocket for a component; it is usually better to enlarge the component's shape a little first); mode=add merges it into the solid.
- When the file is replaced by a new version, the window rebuilds automatically.

## What it can't do
Sheet metal and surface thickening are not supported yet. Assembly mates only place parts (computed once, in order); they are not a constraint solver, and there is no motion. Standard parts are metric coarse M2–M12 only, and the thread on a screw is drawn as a plain shank (cosmetic). If something can't be done, say so plainly and give the closest approach. Don't invent parameters the tools don't have.`

export const AGENT_GUIDE = ta(GUIDE_ZH, GUIDE_EN)

/** The guide in `lang`. */
export const guideIn = (lang: AgentLang) => (lang === "en" ? GUIDE_EN : GUIDE_ZH)
