// 「直接做」 on the website: the desktop app's built-in assistant (the same commands, the same guide),
// with its commands run by the engine in the learner's browser (studio/web-host). The server lists the
// tools and streams the model; the page executes each call and sends the result back.
import { jsonSchema, tool, type ToolSet } from "ai"
import { agentCommandsIn, guideIn, inputJsonSchema } from "../desktop/core/catalog"
import { type AgentLang, withAgentLang } from "../lib/agent-lang"

/** What the desktop assistant can do that a web page can't: point at the model in the window, notes for outside agents. */
export const WEB_LEFT_OUT = new Set(["guide", "request_pick", "show", "get_notes", "resolve_note"])

const WEB_ZH = `

## 在网页工作台里
- 这是 Turnery 网站的工作台，不是桌面版：项目和文件都存在用户这个浏览器里，项目是一个文件夹，路径相对当前项目写（parts/盖.turnery.json）。
- 没有 request_pick、show 和备注。要用户指出位置，请他用视口左边的「标注」点在模型上再发消息；他标的位置会附在消息里。
- export 写出的文件留在项目里，用户看不到下载。用户要文件时，告诉他点顶栏的「导出」。
- 用户在页面上的改动（拖参数、改特征、换文件）在下一条消息的状态里。`

const WEB_EN = `

## In the website's workbench
- This is the Turnery website's workbench, not the desktop app: projects and files are kept in the user's browser. A project is a folder; write paths relative to the current project (parts/lid.turnery.json).
- There is no request_pick, show or notes. To have the user point at something, ask them to mark it on the model with 「Annotate」 on the left of the view and send a message; where they marked comes with the message.
- Files export writes stay in the project; the user doesn't get a download. When they want a file, tell them to use 「Export」 in the top bar.
- What the user changed on the page (dragging parameters, editing features, switching files) is in the state that comes with their next message.`

/** The system prompt of 「直接做」: the desktop guide and what is different here. */
export const webAgentGuide = (lang: AgentLang) => guideIn(lang) + (lang === "en" ? WEB_EN : WEB_ZH)

const cache: Partial<Record<AgentLang, ToolSet>> = {}

/** The commands as tools without `execute`: the page runs them. Results with pictures go to the model as images. */
export function webAgentTools(lang: AgentLang): ToolSet {
  return (cache[lang] ??= withAgentLang(lang, () =>
    Object.fromEntries(
      agentCommandsIn(lang)
        .filter((spec) => !WEB_LEFT_OUT.has(spec.name))
        .map((spec) => [
          spec.name,
          tool({
            description: spec.description,
            inputSchema: jsonSchema(inputJsonSchema(spec)),
            toModelOutput: ({ output }: { output: unknown }) => {
              const o = output as { text?: string; images?: string[] } | null
              const text = o?.text ?? String(output)
              if (!o?.images?.length) return { type: "text" as const, value: text }
              return {
                type: "content" as const,
                value: [{ type: "text" as const, text }, ...o.images.map((img) => ({ type: "file" as const, mediaType: "image/png", data: { type: "data" as const, data: img.split(",")[1] ?? img } }))],
              }
            },
          } as never),
        ]),
    ),
  ))
}

/** The state that rides on the learner's message: what get_state said when they sent it. */
export const webAgentState = (lang: AgentLang, state: string) =>
  lang === "en"
    ? `## The state when this message was sent\n(Added by Turnery, not written by the user. For changes you make with tools after this, go by the tool results.)\n${state}`
    : `## 发这条消息时的状态\n（Turnery 自动附上，不是用户写的。之后你用工具做的改动以工具结果为准。）\n${state}`
