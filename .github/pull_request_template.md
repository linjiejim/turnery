## What changed · 改了什么

<!-- One or two sentences: what and why. Link the issue with "Closes #123". · 一两句话：改了什么、为什么。关联的 Issue 写 Closes #123。 -->

## How it was checked · 怎么验证的

<!-- Which pages or steps you looked at; before/after screenshots for anything visual. `node .github/scripts/pr-assets.mjs <PR number> before.png after.png` prints the markdown to paste here (CONTRIBUTING.md, "Screenshots and recordings"); uploads are public, so no user data or keys. From a fork, drag the images in. · 在哪些页面、哪几步看过；有视觉改动请附前后截图。`node .github/scripts/pr-assets.mjs <PR号> before.png after.png` 打印能贴在这里的 markdown（CONTRIBUTING.zh-CN.md「PR 里的截图和录屏」）；传上去就公开，别放用户数据和密钥。从 fork 提的 PR 直接把图拖进来。 -->

## Checklist · 检查

- [ ] `cd app && npm run check` passes (zero oxlint warnings) · 通过（oxlint 零警告）
- [ ] `npm run build` passes · 通过
- [ ] Changed `desktop/`: `cd desktop && npm run check && npm test && npm run build` · 改了桌面版
- [ ] Changed `models/`: re-baked, with the changes in `app/public/models/` · 改了模型：已重新烘焙并一起提交
- [ ] New text on screen is written in both languages, `t("中文", "English")` ([docs/i18n.md](../docs/i18n.md)) · 界面新文字写了中英两种
- [ ] Changed lesson text: every claim has a source, given below or in the commit body · 改了课程文字：说法有出处
- [ ] New third-party dependency or asset: added to `THIRD_PARTY.md` · 新增第三方依赖或素材：已写进 `THIRD_PARTY.md`
- [ ] UI follows `docs/DESIGN.md` (semantic tokens, type scale, no hand-rolled popovers) · 界面符合 `docs/DESIGN.md`

## Sources (required for content changes) · 出处（内容改动必填）

<!-- Standard number and clause, official help link (version and language), textbook title, edition and page. · 标准号与条款、官方帮助链接（注明版本和语言）、教材书名版次页码。 -->
