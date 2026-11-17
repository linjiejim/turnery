# 插件和市场收录

Turnery 的 agent 接入只有一样东西：`turnery mcp`（本机 stdio MCP 服务，在 Turnery.app 里）加上 `build-part` skill。各平台的包都从这两样生成，不另写一份。

| 包 | 位置 | 给谁 |
| --- | --- | --- |
| 插件 | `plugin/` | Claude Code（`.claude-plugin/plugin.json` + `.mcp.json`）、Codex / ChatGPT（`plugin.json` + `mcp.json`）、WorkBuddy / CodeBuddy（读 Claude 那套） |
| 插件市场 | `.claude-plugin/marketplace.json` | 三家都能直接 `marketplace add linjiejim/turnery` |
| npm 启动器 | `packages/turnery-mcp/` | `npx -y turnery-mcp`：WorkBuddy 连接器、MCP Registry、其他客户端 |
| WorkBuddy 连接器 | `connectors/workbuddy/` | WorkBuddy 官方连接器市场，`pack.mjs` 打包 |

为什么 Claude 和 Codex 各有一份 MCP 配置：Claude Code 展开 `${CLAUDE_PLUGIN_ROOT}`（WorkBuddy 的文档说它也展开），Codex 不展开（会报 No such file or directory），它要 `mcp.json` 里写 `./scripts/...`。两份都指向同一个 `scripts/turnery-mcp.sh`。

Codex 还总是在插件自己的目录里启动 MCP 服务（写不写 `cwd` 都一样，2026-11-17 用 Codex CLI 0.162 实测），而 `turnery mcp` 按工作目录解析相对路径，零件会存进插件缓存、更新时被删。所以启动脚本发现自己在插件目录里时先切到 `~/.turnery/projects`，skill 也要求 agent 传绝对路径。

## 现状（2026-11-17）

| 平台 | 用户自己装 | 官方收录 | 卡在哪 |
| --- | --- | --- | --- |
| Claude Code / Claude | ✓ 本仓库市场 | 待提交 | 无，可以直接提交 |
| Codex / ChatGPT | ✓ 本仓库市场（Codex CLI 0.162 实测能装、能起服务） | 走不通 | 本地 MCP 插件只收白名单合作方 |
| WorkBuddy | ✓ 本仓库市场（WorkBuddy 5.3 自带 CLI 实测能装；会话里起服务还没实测） | 待提交 | 先把 `turnery-mcp` 发到 npm |
| MCP Registry | — | 待提交 | 先把 `turnery-mcp` 发到 npm |

## 前置：发布 turnery-mcp 到 npm

WorkBuddy 连接器和 MCP Registry 都靠 `npx -y turnery-mcp` 起服务，包还没发过（`npm view turnery-mcp` 是 404）。包里只有一个找 Turnery.app 再转交 stdio 的脚本。发版时它的版本号跟着一起改，所以每次发版也 `npm publish` 一次：MCP Registry 要求 `server.json` 里的版本在 npm 上已经存在。

```bash
cd packages/turnery-mcp
npm login
npm publish --access public
```

发完在一个空目录里试 `npx -y turnery-mcp`，应该停在等输入（它在等 MCP 客户端），Ctrl-C 退出。

## Claude 目录（claude.ai、Cowork、Claude Code）

一次提交，三处都能搜到。官方市场 `claude-plugins-official` 不收外部提交，进的是目录（标 Community / Verified）。

1. 需要付费 claude.ai 账号（Pro / Max / Ultra 自己就能交），并在 claude.ai 连上 GitHub（能推 `linjiejim/turnery` 的账号）。
2. 本地自查：`claude plugin validate ./plugin --strict`。
3. 打开 <https://claude.ai/directory/manage> → **Submit new** → **Plugin bundle**。
   - Repository：`linjiejim/turnery`
   - Plugin path：`plugin`
   - Branch：留空（跟 main）
4. **Validate**。目录展示的介绍读 `plugin/README.md` 和 `plugin/.claude-plugin/plugin.json`。
5. Data handling：插件不读也不存个人数据；除了本机 `127.0.0.1` 不连别的服务；零件文件存在用户自己的目录里。如实写上两点：`turnery mcp` 会在 App 没开时把它打开；App 里可选的内置助手（插件不用它）会把对话和当前零件发给用户自己配置的模型服务，密钥存在 `~/.turnery/providers.json`。
6. Compliance 勾四项 → **Submit for review**，保留默认的 GitHub push webhook。

预计会被「Policy hold」转人工：`scripts/turnery-mcp.sh` 里用了 `$TURNERY_BIN`、`$HOME`，还调用插件目录外的 Turnery.app。这是插件的本意，`plugin/README.md` 的「What it runs and connects to」写清楚了，等人工看就行，不是拒绝。

上架后：claude.ai 网页聊天不加载本地 MCP，只有 skill；Cowork 在本机跑时加载；Claude Code 里显示为 `turnery@synced`。之后发版改了 `version` 推到 main，门户会自动扫新版本。

## OpenAI 目录（ChatGPT 和 Codex 共用）

2026-07 起 ChatGPT 的 app 目录并进了插件目录，ChatGPT 和 Codex 用同一个。Turnery 是本地 stdio MCP，在 OpenAI 那边属于「Desktop only」插件：

- 只能在 ChatGPT 桌面端安装，只在本机运行的会话里能用；
- **只收白名单合作方**：要把 OpenAI Platform 组织 ID 发给 OpenAI 的对接人，等对方把组织加白，才能在门户里提交。没有对接人就走不通；
- 加白后：<https://platform.openai.com> 完成个人身份验证 → Plugins → Create plugin → **Skills only** → Upload ZIP（把 `plugin/` 整个打包，`mcp.json` 在里面）。还要准备 website / support / privacy / terms 四个 HTTPS 链接、5 个正例 3 个反例、一段演示录屏。

在那之前，Codex 用户用本仓库市场就能装（README 里的两条命令），装好就有 MCP 服务和 skill。`plugin/plugin.json` 里的 `extensions.com.openai.interface` 决定 Codex 插件列表里显示的名字、简介、图标和示例提示。

## WorkBuddy

**插件（不用审核，已经能用）**：WorkBuddy 的插件系统兼容 Claude Code 格式，「插件」页点 **+** 加市场 `linjiejim/turnery` 就能装。自带 CLI 实测能装；在 WorkBuddy 会话里让它调一次 `guide`，确认服务真的起来了。

**官方连接器市场**（<https://open.workbuddy.cn>）：个人认证就能上架连接器。

1. 先完成上面的 npm 发布。
2. 注册开放平台，做个人认证。
3. 打包：`node connectors/workbuddy/pack.mjs`，得到 `connectors/workbuddy/dist/turnery-workbuddy-<版本>.zip`（`connector-meta.json`、`mcp.json`、`icon.png`、`skills/build-part/SKILL.md`）。
4. 开放平台 → 连接器 → 新建，选 **MCP + Skill**，上传或照 zip 里的内容填写，在测试环境里连一次。
5. 提交审核：安全扫描 → AI 审核 → 人工抽检，网上的实测说法是 7 个工作日左右。通过后是「待发布」，自己点发布才上架。

审核员很可能没有 Mac 或没装 Turnery。提交说明里写清楚：仅支持 macOS；先从 Releases 装 Turnery.app 并打开一次；不需要账号和密钥；连接器会用 `npx` 拉起 `turnery-mcp`，它只连本机的 Turnery。

连接器的 MCP 写的是不锁版本的 `npx -y turnery-mcp`，Turnery 发版一般不用重交连接器；但连接器里的 skill 是提交时的那份，`build-part` 改了要重新打包、重交审核。

## MCP Registry

`packages/turnery-mcp/server.json` 已经写好（名字 `io.github.linjiejim/turnery`，`package.json` 里有对应的 `mcpName`）。npm 发布之后：

```bash
brew install mcp-publisher
cd packages/turnery-mcp
mcp-publisher login github
mcp-publisher publish
```

## 发版时一起改的版本号

`desktop/package.json`（和 lock）、`plugin/.claude-plugin/plugin.json`、`plugin/plugin.json`、`packages/turnery-mcp/package.json`、`packages/turnery-mcp/server.json`（两处）。改完跑：

```bash
node connectors/workbuddy/pack.mjs --check
```

这个检查现在要手动跑，发版工作流（`turnery-release.yml`）只核对 tag 和 `desktop/package.json`。然后 `npm publish`（在 `packages/turnery-mcp`）和 `mcp-publisher publish`。Claude 目录跟 main 自动扫；Codex、WorkBuddy 插件用户 `marketplace update` 就拿到新版；WorkBuddy 连接器只在 skill 改了时重交。
