# Turnery：对话窗口接入本机 coding agent（先做 Codex）

- 状态：Codex 已在本机跑通（2026-11-24，未提交）；Jim：「调研后写 specs，然后直接推进，先把 Codex 跑通」，要求「用合法合规的方式接入，不要走灰色」。同一天 Jim 又要对话「默认做到侧边栏的第一个选项卡，不要单独的悬浮弹框」，见 D10
- 日期：2026-11-24
- 范围：桌面版对话窗口除了内置助手，还可以选 Codex。Turnery 用 ACP 启动用户自己装、自己登录的 Codex CLI；Codex 通过 `turnery mcp` 建模；它的回答、思考过程、工具调用和权限请求都显示在对话窗口里。这一轮只做 Codex。
- 不在范围：
  - Claude（合规上要 Jim 先做一个决定，见 D3）；OpenCode、Gemini CLI、Kimi CLI、Qwen Code 等别的 ACP agent（结构留好，下一步再接）；
  - Turnery 替用户登录、保存或转发任何 agent 的凭证；
  - Codex 的计划（plan）、子代理、diff 和终端输出的详细显示（只显示成一张通用的工具卡片）；
  - 网页版；ACP v2；Windows。
- 相关：`2026-11-10-turnery-assistant.md`（当时把「ACP，把外部 agent 拉进侧边栏」列为另议）、`2026-11-10-assistant-window.md`（对话窗口和历史）、`desktop/src/mcp/server.ts`（`turnery mcp`）、`desktop/src/main/assistant.ts`（内置助手的主进程）

## 为什么

已经有 Codex、Claude 订阅的人，现在要用 Turnery，得在终端里开着 agent、另开 Turnery 窗口看结果，两个窗口来回切。内置助手解决了「没有 agent 的人」的门槛，但要另买 API key。把用户已经在用的 agent 接进 Turnery 的对话窗口，就是同一个 agent、同一份订阅、同一套 MCP 工具，只是在 Turnery 里说话。

## 合规边界（2026-11-24 核对的原文）

| Agent | 官方怎么说 | Turnery 怎么做 |
| --- | --- | --- |
| Codex | OpenAI 的 [Codex App Server 文档](https://learn.chatgpt.com/docs/app-server)：「If you’ve built a local or open-source application using Codex app-server authentication, you can continue using it」；「App-server authentication has never been permitted for commercial or hosted services.」 | Turnery 是 MIT 开源、在用户本机运行、免费，属于前一种。用用户 PATH 上 OpenAI 发布的 `codex`；登录用 Codex 自己的 ChatGPT 登录（用户在终端里 `codex login`，token 由 Codex 自己存、自己刷新）。Turnery 不读 `~/.codex/auth.json`，不发起登录，不经手任何请求。协议转换用 ACP 官方组织维护的 `@agentclientprotocol/codex-acp`（Apache-2.0）。以后 Turnery 若要收费或托管，必须改用 Sign in with ChatGPT。 |
| Claude | [Claude Code 的 Legal and compliance](https://code.claude.com/docs/en/legal-and-compliance)：允许「an end user signing in to the unmodified Claude Code binary with their own Claude subscription」；但在自己的产品里运行 Claude Code 要同意 Commercial Terms，程序不能改、不能去掉它的登录方式、不能代付或转售用量；「developers may not collect, store, or intermediate Claude.ai credentials」。[Agent SDK 概览](https://code.claude.com/docs/en/agent-sdk/overview)：未经批准，第三方不能在产品里提供 claude.ai 登录。 | 这一轮不做（D3）。要做时只能用用户自己装的、未修改的 `claude`，登录只走 Anthropic 自己的流程，Turnery 不碰凭证，界面上不用「Claude Code」当功能名。 |
| OpenCode、Gemini、Kimi、Qwen | 原生支持 ACP，各用各的登录 | 接入时逐个查条款，写进这张表。 |

## 设计

### 结构

| 层 | 位置 | 内容 |
| --- | --- | --- |
| 翻译 | `app/src/desktop/core/acp-stream.ts` | ACP 的 `session/update` → AI SDK 的 `UIMessageChunk`。纯逻辑，有单测 |
| 连接 | `app/src/desktop/core/agents.ts` | agent 表（目前只有 Codex）；用 `@agentclientprotocol/sdk`（v1 stable）连适配器，管会话、一轮、权限请求。不 import electron |
| 主进程 | `desktop/src/main/agents.ts` | 找 `codex`、读写 `~/.turnery/agents.json`、IPC、启动适配器、窗口关掉时收尾 |
| 打包 | `desktop/scripts/build.mjs` | 把 codex-acp 的单文件产物拷到 `dist/agents/codex-acp.mjs`，LICENSE 放在旁边 |
| 窗口 | `ui/model-settings.tsx`、`ui/assistant-panel.tsx`、`use-assistant.ts` | 「谁来回答」、底栏的模型和权限选择、权限卡片、通用工具卡片 |

代码放在 `app/src` 下的原因和内置助手一样：主进程打包时从 `desktop/src` 裸 import 会解析到另一份依赖。

### 进程

```
Turnery 主进程
 └─ Electron 当 Node 跑 dist/agents/codex-acp.mjs        （ACP，stdio）
     └─ 用户自己的 codex app-server                       （Codex 的官方接口）
         └─ Electron 当 Node 跑 dist/cli.mjs mcp          （MCP：Turnery 的建模命令）
             └─ HTTP 回到正在运行的 Turnery 引擎           （和外部 agent 一样，用户在窗口里看每一步）
```

- 整个 App 只起一个 codex-acp，第一次用到时才启动，App 退出时关掉，挂了下次用到时再起。每个对话一个 ACP 会话。
- 从 Finder 打开的 App 没有 nvm、Homebrew 的 PATH，`codex` 的启动脚本又要 `node`：用登录 shell（`$SHELL -ilc`）取一次 PATH 和 `codex` 的位置，用这个 PATH 启动适配器。设置里可以手填 `codex` 的位置。
- `CODEX_PATH` 指向找到的 `codex`。`CODEX_CONFIG` 里注册 Turnery 的 MCP 服务器：`command` 是 `process.execPath`，`args` 是 `[dist/cli.mjs, "mcp"]`，`env` 带上 `ELECTRON_RUN_AS_NODE`、`TURNERY_HOME`、`TURNERY_LANG`，并设 `default_tools_approval_mode = "approve"`（D5）。
- 会话的 `cwd` 是项目文件夹；没有项目时是零件所在的文件夹；都没有时是 `~/.turnery/projects`。实测 Codex 启动的 `turnery mcp` 工作目录就是会话的 `cwd`。`routeAgent` 加一条规则：调用既没绑定窗口、也没指名文件时，交给打开了这个 `cwd` 所在项目的窗口。
- `session/new` 带 `systemPrompt`（append 模式）：你在 Turnery App 的对话窗口里和用户说话，用户在旁边的 Turnery 窗口里实时看到每一步；建模用 turnery 工具；不要用 Computer Use 或 shell 去操作 Turnery 窗口、打开文件。

### 一轮

窗口照旧调 `assistantSend`，多带一个对话编号。选的是 Codex 时，主进程：

1. 找到或建好这个对话的会话（见「接续」），新会话按默认值设好模型、推理强度、权限模式。
2. 发 `session/prompt`：先一行上下文（窗口里打开的零件、所在项目），再是用户这一句。
3. 把 `session/update` 翻译成 chunk，走现有的 `turnery:assistant` 通道。窗口的 `useChat`、消息组件、工具卡片、历史保存都不用改：

| ACP | 窗口里 |
| --- | --- |
| `agent_message_chunk` | `text-start` / `text-delta`，换了 `messageId` 就开新的一段 |
| `agent_thought_chunk` | `reasoning-*`，和现在的「思考过程」一样折叠 |
| `tool_call`，`rawInput.server === "turnery"` | `tool-<命令名>`，`input` 是参数：和内置助手一样的卡片，带特征名 |
| `tool_call`，其他 | `tool-agent-<kind>`（运行命令、读取、修改文件、联网……），`input.name` 是 `title` |
| `tool_call_update`，`completed` / `failed` | `tool-output-available`：`{ ok, text, images }`，MCP 结果里的图片转成 data URL |
| `session/request_permission` | `data-permission` 卡片（见下） |
| 一轮结束（`PromptResponse`） | `finish`，`messageMetadata` 带 `usage`（输入 = 未缓存 + 缓存）和 `agent: { id, session }` |

`usage_update`、`available_commands_update`、`session_info_update`、`plan` 这一轮都不显示。

停止：发 `session/cancel`，还没回答的权限请求一律回 `cancelled`。

### 权限

- 建模命令不问（D5）。其余由 Codex 自己的权限模式决定要不要问；问的时候对话里出现一张卡片：Codex 给的标题和内容，按钮是「允许一次」「这次对话都允许」「拒绝」。不给「总是允许」：它会写进用户自己的 Codex 配置，超出 Turnery 该管的范围（D9）。
- 卡片在窗口里以 `data-permission` 部分存在。点了以后主进程回答 Codex，同一个部分更新成「已允许 / 已拒绝」。

### 接续

- 对话照旧存在 `~/.turnery/chats/`；助手消息的 metadata 里记着 `agent` 和 `session`。
- 主进程里没有这个对话的会话时（App 重启过、打开了旧对话），先用记下的 `session` 调 `session/resume`；失败就新开一个会话，第一句前面带上最近 8 轮的文字。
- 项目换了（`cwd` 不同）也新开会话。

### 设置

`~/.turnery/agents.json`：

```json
{ "use": "codex", "codex": { "path": "/opt/homebrew/bin/codex", "model": "gpt-6.2-sol", "reasoning_effort": "medium", "mode": "read-only" } }
```

- 设置对话框顶部加「谁来回答」：内置助手 / Codex。选 Codex 时显示找到的程序和版本、登录状态（只写套餐名，比如「已登录 ChatGPT」，不显示邮箱），以及没装、没登录、版本太旧时该运行的命令；「重新检查」再查一遍。
- 对话底栏：「Codex · 模型 · 推理强度 · 权限」，几个小下拉框的选项来自会话的 `configOptions`；改了马上作用到当前会话，也记成默认值。
- 权限只列「只读」「可改项目文件」「自动审查」三档，默认只读（D6）。

## 验收

1. 本机装了 `codex` 并用 `codex login` 登录过：设置里选 Codex，能看到版本和「已登录」；保存后对话底栏显示「Codex · 模型」。
2. 在打开的项目里说「做一个 20 mm 的立方体」：窗口里实时长出特征；对话里出现工具卡片（打开零件、拉伸、核对……），`look` 的图片显示在卡片里；回答结束后显示用量。
3. 建模命令不弹权限卡片。Codex 要用别的工具（改文件、别的 MCP）时出现权限卡片，点「拒绝」后它没做。
4. 停止按钮能停下一轮，之后还能接着发。
5. 没装 `codex` 或没登录：设置里写清楚怎么装、怎么登录，发送按钮不可用，不出现看不懂的报错。
6. 关掉 App 再打开旧对话，接着说话，Codex 记得前面说过的内容（resume 或带上文）。
7. Turnery 的代码不读写 `~/.codex/` 下的任何文件；codex-acp 的许可证写进 `THIRD_PARTY.md`，打包时放进 `dist/agents/`。
8. 内置助手照旧可用；`npm run check` 和单测通过。

## 已定

| | 决定 | 理由 | 没选的 |
| --- | --- | --- | --- |
| D1 | 用 ACP，经 codex-acp 接 Codex | 以后接 OpenCode、Gemini、Kimi 用同一套代码；codex-acp 本身就是建在 Codex 官方 app-server 上的 | 直接接 `codex app-server`：只能接 Codex 一家。`codex exec --json`：没有权限请求，也没法接续会话 |
| D2 | 用用户自己装的 `codex`，不随 App 打包 `@openai/codex` | 「官方 harness、原本的订阅」就是用户在终端里用的那一份，登录状态、配置、技能都一样；打包要多约 100 MB，还得跟着发版 | 打包一份：体积大，版本和用户的不一致。代价是要求 `codex` ≥ 0.171.0（codex-acp 2.10 依赖的版本），太旧时提示更新 |
| D3 | Claude 这一轮不做 | 条款允许用户用订阅登录未修改的 Claude Code，但「在产品里运行 Claude Code」要开发者同意 Commercial Terms；Agent SDK 文档又写着未经批准不能提供 claude.ai 登录。要不要同意、要不要先问 Anthropic，是 Jim 的决定 | 现在就用 claude-agent-acp 接：等于替 Jim 做了这个决定 |
| D4 | Turnery 不发起任何登录 | 登录完全留在 agent 自己的程序里（`codex login`），Turnery 经手不到凭证，也不像是在「提供 ChatGPT 登录」 | 用 ACP 的 `authenticate` 在 App 里触发登录：技术上是 Codex 自己的流程，但没必要多这一步 |
| D5 | Turnery 的 MCP 服务器写在 `CODEX_CONFIG` 里，`default_tools_approval_mode = "approve"` | 建模一步一问就没法用；这些命令只动项目里的零件文件，和内置助手的权限一样。实测：走 ACP 的 `mcpServers` 时，codex-acp 只传 `command/args/env`，批准设置会丢；用户 `config.toml` 里已有同名 `turnery` 时，还会直接跳过我们这一份 | 走 `mcpServers` 加每步弹卡片 |
| D6 | 默认只读，不提供「完全访问」 | 实测：权限都自动允许时，Codex 会用用户自己配的 Computer Use 去操作真实桌面。只读模式下读文件、跑只读命令不问，写和联网要问 | 默认「自动审查」：少问几次，但写文件不经过人 |
| D7 | 一个 codex-acp 进程，每个对话一个会话 | 省内存；会话靠 `cwd` 回到对应的窗口 | 每个对话一个进程：每个都要多起一个 codex app-server |
| D8 | 主进程把 ACP 翻译成 AI SDK 的 chunk，窗口沿用 `useChat` | 消息组件、工具卡片、历史保存、状态行全部复用，和内置助手用同一个对话窗口 | 窗口里另写一套 ACP 的消息模型 |
| D9 | 权限卡片不给「总是允许」 | 那会写进用户自己的 Codex 配置 | 原样列出 Codex 给的全部选项 |
| D10 | 对话是右侧面板的第一个页签（默认选中），去掉浮动和固定列两种模式；标题栏「对话」按钮切到这个页签，再按一下收起右栏。没打开文件时右栏只有「对话」；首页（没有项目）没有右栏也没有这个按钮 | Jim 2026-11-24。对话由 `AssistantProvider` 持有，挂在页签里也不会因为切零件而丢（2026-11-10 拿出来的原因已经不在了）；对话在跑时页签和右栏图标上转圈 | 保留浮动窗口作为选项 |
| D11 | Codex 说在等审批、4 秒内却没有审批到 Turnery 时，对话里提示「审批可能在你自己配的审批工具里」 | 实测：用户 `~/.codex/hooks.json` 里的 PermissionRequest 钩子（Jim 用的 Vibe Island）会先接走审批，Turnery 收不到，对话就一直等。用户自己的配置 Turnery 不改，只说清楚 | 在 `CODEX_CONFIG` 里关掉用户的钩子：改了用户自己的 agent 行为；实测 `hooks = {}` 也关不掉 hooks.json |
| D12 | 按「停止」时，除了发 `session/cancel`，还把这一轮没回答的权限请求都回成 `cancelled` | ACP 要求这样做；不这样做 agent 等回答、Turnery 等这一轮结束，互相卡住（假 agent 的单测测出来的） | — |
| D13 | 同一段对话的几轮排队执行：「停止」以后，下一句等上一轮真正收尾再发；清理只清自己这一轮的回调和权限请求 | Codex 审查（P1）：停止后窗口马上能发下一句，旧一轮收尾时的文字会串进新回答，清理还会取消新一轮的权限请求。单测复现过 | 停止后锁住输入框直到收尾：要多一个界面状态 |
| D14 | 会话按「窗口 + 对话」分开；同一个 Codex 会话已经在别的窗口里接着用时，不再 resume，新开会话并带上文 | Codex 审查：同一段历史对话在两个窗口里打开会共用会话，一边关窗或换文件夹会关掉另一边的 | — |
| D15 | 每一轮都把「这个会话没看到的部分」带在前面：上一次由这个会话回答之后的所有消息（新会话就是全部，最近 16 条） | Codex 审查：中途切到内置助手再切回 Codex，Codex 看不到中间几轮。原来只在新会话时带上文 | 记录每个会话收到过哪些消息：要多存一份状态 |
| D16 | 权限按钮用 agent 自己的措辞，中文界面逐句翻译；「以后都拦这个网站」这类 `reject_always` 也不给 | Codex 审查：按种类改写会把「不运行，接着做」和「告诉它怎么改」写成同一个「拒绝」。`reject_always` 和「总是允许」一样会写进用户的 Codex 配置（补 D9） | — |
| D17 | 在一个窗口里改「谁来回答」，所有窗口的对话栏跟着变；改了 Codex 程序的位置就重启适配器 | Codex 审查：另一个窗口显示的和实际发给的对不上；换了路径还在用旧程序 | — |
| D18 | 嵌套项目（`/w` 和 `/w/sub` 各开一个窗口）按 cwd 找窗口时，找最深的那个 | Codex 审查（P1）：原来找到第一个包含它的项目，会把子项目的调用发到父项目窗口 | — |

## 实施清单

- [x] `app/package.json` 加 `@agentclientprotocol/sdk`，`desktop/package.json` 的 devDependencies 加 `@agentclientprotocol/codex-acp`（固定 2.10.0）；构建时拷贝单文件和 LICENSE；`THIRD_PARTY.md`
- [x] `core/acp-stream.ts` 和单测
- [x] `core/agents.ts`：连接、会话、一轮、权限、接续
- [x] `main/agents.ts`：找 codex（登录 shell）、版本、登录状态、`agents.json`、IPC；`assistant-send` 按选择分流
- [x] `routeAgent` 按 `cwd` 找窗口
- [x] 窗口：谁来回答、Codex 状态、底栏选项、权限卡片、通用工具卡片、空状态文案、中英文
- [x] 用真实 Codex 端到端跑一遍并截图（`TURNERY_HOME` 指到 /tmp）
- [x] 对话改成右侧面板第一个页签（D10），删掉 `assistant-window.tsx`、`assistant-layout.ts` 和它们的测试
- [x] 收尾：状态、落地记录、README 里「AI 来自……」那一段

## 落地记录

2026-11-24，在 worktree 分支 `claude/local-coding-agent-turnery-a8c2c7` 上，**没有提交、没有合并、没有发版**。

做了什么：

- 照上面的设计接上 Codex：codex-acp 2.10.0 的单文件放在 `dist/agents/codex-acp.mjs`，由 `dist/agents/launch.mjs` 用 Electron 的 Node 启动（启动前去掉 `ELECTRON_RUN_AS_NODE`，免得 Codex 跑的命令继承它）。
- 登录状态问 `auth/status`，一直问到 Codex 读完账号为止（大约 2 秒）。问不出来时显示「没能确认是否已登录」，不当作已登录。
- 对话挪进右侧面板（D10）；加了审批没到 Turnery 时的提示（D11）；「停止」会取消还开着的权限请求（D12）。
- Codex 审查（gpt-6-astra，审查的是还没提交的全部改动）提了 7 条，2 条 P1、5 条 P2。逐条核实后都属实，全部修了（D13–D18）；第 2 轮审查没有跑。

和方案不同的地方：

- `AgentClient` 不自己 spawn 进程，由主进程传进一个 `AgentProcess`，带 stdio 的 web 流，这样 `app/src/desktop/core` 里不出现 node 模块。
- 对话编号通过 `sendMessage` 的 `body` 传到 transport，不用 ref。
- `agents()` 默认只启动正在用的那个 agent 去问登录状态。设置里切到别的 agent 时才问它（`agents("status")`），点「重新检查」时重新查找并重启（`agents("recheck")`）。

验证到了哪一步：

- `npm run check`（app：三套 tsc、oxlint、42 个测试文件 581 个测试）通过；desktop 的 tsc 通过；`node desktop/scripts/build.mjs` 通过。
- 新增单测 `acp-stream.test.ts` 共 16 个（拿掉 D13 的排队后，「停止后的尾巴」那个测试会挂），覆盖：真实 Codex 消息格式的翻译、`look` 图片、其他工具的卡片、等审批的提示，以及用进程内的假 ACP agent 跑通的权限流程（没有「总是允许」，「允许一次」能传回去，「停止」会取消）。
- 用真实 Codex（0.171.0，Jim 的 ChatGPT 登录，模型 6.2 Sol / Low）在 Playwright 驱动的桌面版里端到端跑过，`TURNERY_HOME` 设在 /tmp：
  - 设置里显示「已登录（ChatGPT Prolite）」；
  - 说「做一个 20 mm 的立方体」，窗口里实时出现特征，对话里有工具卡片和 `look` 的图，回答结束显示用量；
  - 切到别的页签时「对话」页签在转圈；
  - 重启 App 后打开历史对话接着问，Codex 记得前面的内容（resume 成功，缓存 99%）；
  - `CODEX_HOME` 设成空目录时，显示「还没登录」和 `codex login`。

没验证的：

- **真实 Codex 发出的权限卡片没有在窗口里看到过。** Jim 的 Codex 配了 Vibe Island 的 PermissionRequest 钩子，shell 和写文件的审批都先被它接走（这正是 D11 的由来）。用真实 Codex 测权限会把审批弹到 Jim 的桌面，所以权限流程只用假 agent 做了单测，卡片的样子没截图。D11 的提示也只做了单测。
- 「可改项目文件」「自动审查」两档没跑过。
- 没在第二台机器或没装 nvm 的环境里试过找 `codex`（用登录 shell 找）。
- 打包后的 `.app` 没试过。

顺带发现：只读模式下，Codex 写 `/tmp` 不需要审批，这是 Codex 沙箱本身的规则；写项目文件夹才要审批。
