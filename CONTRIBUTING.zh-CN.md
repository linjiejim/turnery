# 参与贡献

[English](CONTRIBUTING.md) · 简体中文

> 代码按 MIT，课程文字和文档按 CC BY 4.0 发布；提交贡献即表示你同意按同样的许可发布。

欢迎改错字、纠正说法、报 bug、提新课，也欢迎直接写一节课或一个拆解模型。这份说明讲怎么跑起来、提交前查什么，以及内容纠错为什么一定要给出处。

## 跑起来

需要：

- Node.js 22。CI 用的是这个版本，20 以上一般也行。
- 改 `models/` 时还要 Python 3.11 以上。

```bash
git clone https://github.com/linjiejim/turnery.git
cd turnery/app
npm ci              # 国内网络慢时加 --registry=https://registry.npmmirror.com
npm run dev         # http://localhost:5287
```

只改前端不需要 Python：烘焙好的模型已经提交在 `app/public/models/`。

## 提交前检查

```bash
cd app
npm run check       # 类型检查 + oxlint + 设计守卫 + 单元测试
npm run build       # 生产构建，并为每个页面生成带标题和描述的 HTML
```

`npm run check` 和 `npm run build` 都要通过；CI 部署前也跑这两步。

- oxlint 要零警告。
- 设计守卫（`src/tests/design`）会拦住：
  - 裸色值
  - 12px 以下的字号
  - 手写的弹层

## 写一节课

完整说明见 [`docs/dev/lesson-authoring.md`](docs/dev/lesson-authoring.md)。要点：

- 一节课由两个文件组成，放在 `app/src/content/lessons/`：
  - `<id>.scene.ts`：场景控制器。
  - `<id>.tsx`：步骤、文字、任务、小测。
- 参考 `revolve`（最标准）和 `sketch-to-solid`（交互最多）。
- 4–7 步，一步一个概念：
  - 每步自动转到关键视角。
  - 任务在 3D 里完成。
  - 易错处先猜再看。
- 最后 3 道小测，每题都有解释。
- 开发模式下打开 `/lesson/<文件名>` 就能试；上线前在 `lessons/index.ts` 里注册。

## 写一个拆解模型

完整说明见 [`docs/dev/models.md`](docs/dev/models.md)。

模型用 [build123d](https://github.com/gumyr/build123d) 写在 `models/parts/<id>.py` 或 `models/assemblies/<id>.py`，由烘焙器 `turnerybake` 离线算成 GLB。

```bash
python3 -m venv .venv
.venv/bin/pip install -r models/requirements.txt
cd models && ../.venv/bin/python -m turnerybake <id>    # 只烘焙一个模型
```

规则：

- 每个特征前写 `# @step <id>`，每个特征后调用一次 `r.solid` 或 `r.sketch`。
- 失败的参数组合是教学内容，给它写好 `failures` 解释。
- 改了模型就重新烘焙，把 `app/public/models/<id>/` 的变化一起提交。

## 设计规则

界面基于 jim-uiux，项目自己的约定见 [`docs/DESIGN.md`](docs/DESIGN.md)。最常碰到的几条：

- **颜色**：只用语义 token（`bg-primary`、`text-muted-foreground`、`--scene-*`），不写颜色值。3D 场景的颜色也从主题 token 读取。
- **字号**：只用字号阶梯（`text-caption` 及以上），不小于 12px。
- **字重**：只用 400 / 500 / 600。
- **弹层**：用 `components/ui/` 里的对话框、抽屉、浮层，不手写。
- **ui 组件**：`components/ui/` 下的组件和 jim-uiux 上游保持一致，要改请先提 Issue 说明。
- **文案**：
  - 简体中文，短句。
  - 引号用「」。
  - 中英文、中文与数字之间加空格。
  - 按钮写「动词 + 对象」，不超过 6 个字。
- **坐标**：Z 轴朝上；提到 SOLIDWORKS 时说明它默认 Y 轴朝上。

## 中英两种语言

界面有中文和英文两版：网站的英文页面在 `/en/…` 下，桌面版跟随系统语言，也可以在标题栏切换。机制和规则见 [`docs/i18n.md`](docs/i18n.md)，最常碰到的几条：

- 界面上的每一句都写成一对：`t("回到最新", "Back to latest")`。中文原样保留（测试按中文匹配），英文写在旁边。
- 给 agent、模型看的文字（MCP 说明、工具描述、工具结果、内核和引擎的消息、系统提示）用 `ta("中文", "English")`，它跟随 agent 的语言，不用 `t()`。会被代码解析的输出（✓ ✗ ⚠ 开头、行的格式）两种语言保持一样的结构。
- 互动课和图文卡在原处写两种语言（富文本用 `byLocale(<>中文</>, <>English</>)`，小测选项两种语言顺序一致）。课程目录和拆解讲解的英文是 `app/src/content/en/` 里的覆盖层；重新烘焙的模型有了新文字，英文也要补上。
- 英文文案：句首大写其余小写，短句，按钮用动词，不写 “Please”。
- `npm run check` 里有一项守卫：`t()` 的英文一半不能还留着中文。

## 提交规范

用 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/v1.0.0/)，主题用中文，一个提交只做一件事：

```
fix(app): 3D 打印课第一步把零件拉近
feat(content): 新增「尺寸公差与配合」互动课
docs: 添加许可证与第三方声明
```

- 类型：`feat`、`fix`、`docs`、`refactor`、`test`、`chore`、`ci`。
- 范围：
  - `app`：网站代码。
  - `content`：课程文字、术语、大纲。
  - `models`：模型和烘焙器。
  - `ci`：工作流。
- 正文写为什么这样改；内容纠错在正文里写出处。
- `feat`、`fix`、`perf` 的标题是桌面版更新内容的初稿（[`desktop/README.zh-CN.md`](desktop/README.zh-CN.md#发布)「发布」），写成用的人看得懂的一句话，不写改了哪个组件。

## 内容纠错：必须给出处

课程里的工程说法会被当成「标准答案」学，所以每一处纠错都要能查到依据。

1. **先开 Issue**，用「内容纠错」模板。写清：
   - 哪节课、哪一步
   - 原文怎么写
   - 应该怎么写
   - 出处
2. **出处按可信度从高到低**：
   - **标准原文**：GB/T、ISO、ASME 等，写明标准号、年份和条款，例如「GB/T 4457.5-2013 第 4.1 条」。
   - **软件官方帮助**：写明软件、版本和界面语言，并附链接，例如「SOLIDWORKS 2022 帮助（简体中文）· 图纸属性」。
   - **正式出版的教材、手册**：写明书名、版次和页码。
   - **论坛帖子和个人博客**：只能作旁证，不能单独作依据。
3. **软件叫法因版本、语言而异时**，写清是哪个版本，或者改成「因版本而异」，不要以偏概全。
4. **改动合并后**，出处写进提交正文。需要时也写进课程里的注释，例如「见 GB/T 14692」。

没有出处的修改建议也欢迎提，我们会去核对；但在找到依据之前不会改课程文字。

## 许可

提交的代码按 MIT（[`LICENSE`](LICENSE)），课程文字和文档按 CC BY 4.0（[`LICENSE-content`](LICENSE-content)）发布。引入新的第三方依赖或素材时，在 [`THIRD_PARTY.md`](THIRD_PARTY.md) 里补上许可证和链接。不接受许可证和 MIT 不兼容的依赖，例如 GPL 的库直接打进网站产物。
