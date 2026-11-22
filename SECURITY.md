# Security

English · [简体中文](#安全问题)

## Reporting a vulnerability

Please don't open a public issue for a security problem. Report it privately through GitHub: **Security → Report a vulnerability** on [linjiejim/turnery](https://github.com/linjiejim/turnery/security/advisories/new). Include what's affected (desktop app version, or the website page), how to reproduce it, and what an attacker could do with it.

You'll get an answer within a week. Once a fix is released, the advisory is published with credit to you unless you'd rather not be named.

## What is in scope

- **The desktop app**: the MCP server and CLI (`turnery mcp`, `turnery`), the local HTTP endpoint on 127.0.0.1, how it reads and writes project files, the built-in assistant's tool boundary (it may only call Turnery's modeling commands), how model API keys are stored, and the auto-updater (update packages are verified against a key built into the app).
- **The website** (turnery.linjiejim.com): a static site with no backend (the workbench's chat and shared links were removed in November 2026). In scope: anything that could leak a visitor's data or run someone else's code in their browser, for example through an imported feature tree or exported build123d code.

Only the latest release is supported; please check the problem is still there in it.

## 安全问题

请不要在公开 Issue 里报告安全问题。到 [linjiejim/turnery](https://github.com/linjiejim/turnery/security/advisories/new) 的 **Security → Report a vulnerability** 私下提交，写清影响范围（桌面版版本号或网站页面）、复现步骤和可能的危害。一周内会回复；修复发布后公开通告，并按你的意愿署名。范围同上：桌面版的 MCP 服务和命令行、本机 HTTP 接口、项目文件读写、内置助手的权限边界、模型 key 的保存、自动更新；网站是没有后端的静态站（工作台的对话和分享链接 2026 年 11 月去掉了），会泄露访客数据、或者让别人的代码在访客浏览器里运行的问题都在范围内，例如通过导入的特征树或导出的 build123d 代码。只支持最新版本。
