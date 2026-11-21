# Turnery 开源社区与开放项目包架构规范

- 状态：实施中（2026-11-21）
- 日期：2026-11-21
- 范围：
  1. 开放、无平台锁定的项目包规范（`turnery.json`）；
  2. 开源社区 Hub 后端（SQLite + FTS5 全文搜索 + SHA-256 内容寻址对象存储 + GitHub OAuth / API Token / 本地自托管模式 + GitHub Webhook 自动同步）；
  3. 作品发布、不可变版本管理、持续更新、特征树结构化 Diff（复用 `describeTreeChange`）、`checks` 核对徽章与 Remix 谱系；
  4. 项目合集（Collection）：支持收录自己或他人的开源作品，按序编排、写策展备注、锁定指定版本或追踪最新版本；
  5. 社区前端页面（`/community`、`/community/@:handle/:slug`、`/community/@:handle/c/:slug`、`/community/@:handle`）与 Web 工作台一键发布/Remix 闭环；
  6. 保持 MIT 开源与零外部基础设施即可自托管。
- 不在首期范围：重型富文本评论审核系统（优先关联 GitHub 仓库/Discussions）、多租户企业 RBAC、付费交易。
- 相关：`app/src/hub/package.ts`、`app/server/hub/*`、`app/src/routes/community*.tsx`、`app/src/desktop/core/tree-diff.ts`、`docs/specs/2026-11-07-studio-share.md`、`docs/specs/2026-11-21-web-desktop-parity.md`

## 设计原则

1. **开放协议优先，不锁死数据**：一个 Turnery 社区作品本质上就是一个带 `turnery.json` 清单的标准项目文件夹。无论存在官方社区、作者的 GitHub 仓库，还是第三方自建的 Hub，文件格式 100% 一致，随时可按 ZIP 完整导出。
2. **发挥 Turnery 的差异化优势**：
   - 作品是极小的参数化 JSON 特征树，天然支持版本间结构化 Diff（参数增删改、特征增删改）而非黑盒 STL 替换；
   - 作品自带可执行的 `checks` 核对项，社区展示核对通过数，持续更新时可验证未破坏关键尺寸；
   - 浏览器端零成本运行 WASM 内核，社区画廊页只加载静态封面图（零 WASM 负担），详情页按需启动 3D 交互调参、时间轴回放、分析与导出。
3. **单机极简可自托管**：基于现有 Hono + Node 22 栈，使用 Node 22 内置 `node:sqlite`（WAL + FTS5）与内容寻址文件系统 `BlobStore`，无需额外数据库或 Redis 即可启动，同时通过接口抽象支持后续无缝切换 PostgreSQL 与 Cloudflare R2 / S3。
4. **与临时分享清晰分工**：保留现有 `/studio/s/:id` 作为免登录、不收录、一年无访问自动清理的临时快传；社区 `/community` 面向有身份、可检索、有开源协议、可持续迭代的公开作品与合集。

## 1. 开放项目包规范（`turnery.json`）

一个标准 Turnery 社区项目文件夹如下：

```text
my-enclosure/
├── turnery.json              # 包清单（开放规范 schema: 1）
├── README.md                 # 可选说明文档
├── enclosure.turnery.json    # 单零件入口，或 *.turnery-asm.json 装配体入口
├── enclosure.params.json     # 可选共享参数
├── parts/lid.turnery.json    # 可选子零件
└── assets/board.step         # 可选 STEP 参考件
```

`turnery.json` 核心字段（前后端共用 Zod Schema：`app/src/hub/package.ts`）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `schema` | `1` | 规范版本号，向后兼容 |
| `name` | `slug`（小写字母/数字/连字符） | 项目标识 |
| `title` | `{ zh?: string, en?: string }` 或 `string` | 中英双语标题 |
| `summary` | `{ zh?: string, en?: string }` 或 `string` | 一句话简介 |
| `version` | SemVer（如 `1.0.0`） | 当前版本号 |
| `license` | 枚举 | 必填明确开源协议：`CERN-OHL-P-2.0`、`CERN-OHL-S-2.0`、`CERN-OHL-W-2.0`、`CC-BY-4.0`、`CC-BY-SA-4.0`、`CC0-1.0`、`MIT`、`Apache-2.0` |
| `entry` | 相对路径 | 入口零件或装配体（如 `enclosure.turnery.json`） |
| `category` | 枚举 | `enclosure` / `bracket` / `mechanism` / `fastener` / `organizer` / `electronics` / `tool` / `other` |
| `tags` | `string[]`（≤ 10） | 标签 |
| `repository` | 可选 HTTPS URL | 关联 Git 仓库地址 |
| `forkedFrom` | 可选 `{ handle, slug, version? }` | Remix 来源署名 |

## 2. 不可变版本与持续更新

- 每次发布或更新都会生成一条**不可变 Release 记录**，包含：
  - `version`（同一项目内唯一，遵循 SemVer）；
  - `files`：项目内所有文件相对路径到 `sha256` 对象哈希与字节大小的映射；
  - `diff_summary`：相对上一版本自动计算的文件增删与特征树变化（调用 `describeTreeChange`）；
  - `checks_passed` / `checks_total` 与 `checks_json`：需求核对快照；
  - `changelog`：作者填写的更新说明；
  - `preview_blob`：等轴测封面图（PNG/WebP）的 blob 哈希。
- **内容寻址去重**：未修改的 `.step` 大文件或子零件在持续更新多个版本时复用同一个 SHA-256 blob，不重复占盘。
- **持续更新入口**：
  1. Web 工作台 / 社区详情页直接推送新版本；
  2. CLI / CI 携带 Personal API Token（`Authorization: Bearer trn_...`）调用 `POST /api/hub/projects/:handle/:slug/releases`；
  3. GitHub Webhook（`POST /api/hub/webhooks/github`）：校验 `X-Hub-Signature-256` 签名，接收仓库 Release/Tag 事件记录或拉取同步。

## 3. 项目合集（Collection）

支持两种形态：
1. **多零件/系列套件**：一个 Project 文件夹内包含多个 `*.turnery.json` / `*.turnery-asm.json` 与共享 `*.params.json`，详情页提供文件树切换与整包下载；
2. **策展型项目合集（Collection）**：独立的 `collections` + `collection_items` 实体（路由 `/community/@:handle/c/:slug`），有序收录作者自己或他人的开源作品，每项可：
   - **追踪最新（`pinned_release_id = NULL`）**：自动指向作品最新版本；
   - **锁定版本（`pinned_release_id` 指定版本）**：固定展示该版本，若原作者发布了更新版本，界面温和提示「有新版本可用」；
   - 附带策展说明（`note`）和自定义顺序（`position`）。

## 4. 数据存储与检索（`app/server/hub/`）

- **数据库**：`${STUDIO_DATA_DIR}/hub/hub.sqlite`（Node 22 `node:sqlite`，开启 `WAL` 与 `foreign_keys = ON`）。
  - 核心表：`users`、`api_tokens`、`projects`、`releases`、`project_stars`、`collections`、`collection_items`；
  - 全文检索：`projects_fts`（SQLite FTS5，索引标题、简介、标签、作者与分类）。
- **对象存储**：`BlobStore` 接口，默认实现 `FileBlobStore` 落盘于 `${STUDIO_DATA_DIR}/hub/blobs/<sha256前2位>/<sha256>`，原子写入，下载响应带 `Cache-Control: public, max-age=31536000, immutable`。

## 5. 认证与开源自托管模式

- **GitHub OAuth 2.0**：配置 `GITHUB_CLIENT_ID` 与 `GITHUB_CLIENT_SECRET` 后启用，使用 HMAC-SHA256 签名的 `HttpOnly` Cookie 会话（密钥取 `HUB_SESSION_SECRET`，未配时自动持久化随机密钥至 `${STUDIO_DATA_DIR}/hub/.session-secret` 权限 600）。
- **Personal API Token**：已登录用户可在个人页签发/吊销 `trn_...` 令牌（数据库仅存 SHA-256 哈希），供 CLI 和 GitHub Action 自动持续更新。
- **本地/自托管开放登录**：当设置 `HUB_LOCAL_AUTH=1`（或开发环境未配置 GitHub OAuth）时，开放轻量本地账号登录，方便本地开发、测试与内网自托管零配置体验；生产环境若未显式开启 `HUB_LOCAL_AUTH=1` 则强制要求 GitHub OAuth 或 Token。

## 6. REST API 概览

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/hub/me` | GET | 当前登录态、可用认证方式 |
| `/api/hub/auth/github` / `.../callback` | GET | GitHub OAuth 登录与回调 |
| `/api/hub/auth/local` | POST | 本地/自托管登录（受环境变量门控） |
| `/api/hub/auth/logout` | POST | 退出登录 |
| `/api/hub/tokens` | GET / POST | 列出 / 签发 API Token |
| `/api/hub/tokens/:id` | DELETE | 吊销 API Token |
| `/api/hub/projects` | GET / POST | 搜索筛选列表 / 发布新作品（含初始版本） |
| `/api/hub/projects/:handle/:slug` | GET / PATCH / DELETE | 详情与版本列表 / 更新元数据 / 归档删除 |
| `/api/hub/projects/:handle/:slug/releases` | POST | 发布新版本（持续更新，自动算 Diff） |
| `/api/hub/projects/:handle/:slug/releases/:version` | GET | 指定版本元信息与文件列表 |
| `/api/hub/projects/:handle/:slug/releases/:version/bundle` | GET | 获取完整项目文件内容（供在线 3D 预览、Remix 与拉取） |
| `/api/hub/projects/:handle/:slug/star` | POST / DELETE | 收藏 / 取消收藏 |
| `/api/hub/blobs/:sha256` | GET | 不可变对象下载（封面图、单个文件） |
| `/api/hub/collections` | GET / POST | 浏览 / 创建项目合集 |
| `/api/hub/collections/:handle/:slug` | GET / PATCH / DELETE | 合集详情 / 更新 / 删除 |
| `/api/hub/collections/:handle/:slug/items` | POST | 向合集添加或更新作品条目（支持排序与版本锁定） |
| `/api/hub/collections/:handle/:slug/items/:projectId` | DELETE | 从合集移除作品 |
| `/api/hub/users/:handle` | GET | 作者主页（作品与合集） |
| `/api/hub/webhooks/github` | POST | GitHub 仓库 Release/Tag 自动同步入口 |

## 7. 安全防线

1. **严格路径校验**：拒绝绝对路径、`..` 路径穿越、隐藏文件（`.git/`、`.env`）与私有批注文件（`*.notes.json`）；校验所有 `uses`/`import`/`component` 相对引用必须落在项目根内。
2. **内容与格式校验**：每个特征树文件必经 `checkTree()`（特征数 ≤ 200、参数 ≤ 100、字符串 ≤ 500、阵列 ≤ 500）；共享参数经 `SharedFile` 校验；`.step`/`.stp` 必须包含 `ISO-10303-21` 头部且单文件 ≤ 10 MB；整包 ≤ 50 文件、总计 ≤ 20 MB。
3. **密钥泄露兜底**：拒绝包含 `sk-...`、`ghp_...`、`github_pat_...`、`AKIA...` 等疑似密钥的文本上传。
4. **防 XSS**：所有标题/简介/标签纯文本渲染；README 与 changelog 仅通过无原始 HTML 的 Markdown 渲染；封面图只接受白名单 `image/png`、`image/webp`、`image/jpeg`（拒绝 `image/svg+xml`）。
5. **限速与权限**：写操作按 IP 与用户双重限速；仅作品/合集所有者可推送新版本、编辑元数据或删除；API Token 仅存哈希、创建时明文展示一次。

## 8. 验收标准

- 单元测试覆盖 `turnery.json` 校验、路径穿越拦截、密钥拦截、STEP 文件头检查、版本 Diff 计算与 ZIP 打包/解包；
- 服务端集成测试覆盖认证（本地/Token）、发布、持续更新（含 blob 去重与特征树 Diff）、FTS5 搜索筛选、收藏、合集增删改排序与版本锁定、越权拒绝（403）及安全拦截；
- Web 端可在不加载 WASM 的情况下秒开 `/community` 列表，点击作品后进入完整 3D 交互预览与分析，可一键「在工作台打开 / Remix」以及在工作台「发布/更新到社区」；
- 保持 `npm run check`、`npm run build`、`npm run build:api` 全绿。
