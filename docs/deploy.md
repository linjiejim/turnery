# 部署

网站是纯静态站：`app/dist/` 加上烘焙好的 `app/public/models/`（构建时会一起拷进 `dist/models/`）。没有后端：工作台的 CAD 内核在浏览器里跑；2026-11-22 去掉网页上的对话和分享以后，服务器上也不再跑 API（见下面的「去掉工作台 API」）。

## 构建

```bash
cd app
npm ci --registry=https://registry.npmmirror.com
npm run check     # 类型检查、lint、设计守卫
npm run build     # 产出 app/dist，最后一步生成每个页面的 HTML、sitemap.xml 和 robots.txt
```

模型只有在改了 `models/` 之后才需要重新烘焙（`npm run bake`，需要 Python 环境，见 `docs/dev/models.md`）。烘焙结果提交在仓库里，所以只改前端时不需要 Python。

## 线上：jim-server

站点在 <https://turnery.linjiejim.com>，和 design.linjiejim.com 用同一套静态站做法：

- push 到 `main`（改了 `app/**` 或工作流本身）时，`.github/workflows/deploy.yml` 在 GitHub Actions 里跑 `npm ci` → `npm run check` → `npm run build` → 冒烟测试（`npm run e2e`），全部通过才上线。
- 静态产物 rsync 到 `/srv/turnery/releases/<sha7>`（`--link-dest` 复用上一版没变的文件），再原子地切换 `/srv/turnery/current` 软链；保留最近 5 个版本。
- 最后检查首页、一个深层路由和模型索引都返回 200。
- 需要仓库 environment `jim-server` 里的 `DEV_SERVER_HOST / PORT / USERNAME / SSH_KEY`（专用 CI 密钥，不是个人密钥）。

回滚：

```bash
ssh jim-server 'ls -t /srv/turnery/releases'
ssh jim-server 'ln -sfn /srv/turnery/releases/<sha7> /srv/turnery/current'
```

### 每个页面一份 HTML

网站是单页应用，微信、X 和搜索引擎的爬虫不运行 JavaScript，只看 HTML 里的 `<title>` 和 meta。所以 `npm run build` 的最后一步（`app/scripts/prerender.mjs`）把 `dist/index.html` 复制成每个页面一份，写入：

- 这一页的 `<title>` 和 description
- canonical 链接
- Open Graph / Twitter 标签：绝对地址，分享图是 `/og.png`，1200×630

| 文件 | 页面 |
| --- | --- |
| `dist/index.html` | 首页，也是未知路由的回落页 |
| `dist/<页面>/index.html` | `learn`、`teardown`、`practice`、`atlas`、`glossary`、`studio` |
| `dist/lesson/<id>/index.html` | 每节已注册的课 |
| `dist/teardown/<id>/index.html` | 每个烘焙好的模型 |
| `dist/en/…/index.html` | 上面每个页面的英文版（`/en`、`/en/learn`、`/en/lesson/<id>`……），和中文版用 `hreflang` 互指 |
| `dist/sitemap.xml`、`dist/robots.txt` | 全部上述页面 |

- 标题和描述写在 `app/src/lib/page-meta.ts`，浏览器里的 `document.title` 也用它。
- 新加的课和模型下次构建时自动生成，不用手动维护。
- 这些副本加载的是同一份 JS，打开后照常是单页应用。

服务器要先找 `{path}/index.html`，找不到再回落到 `/index.html`，见下面的 `try_files`。

- 服务器还是旧的 `try_files {path} /index.html` 时网站照常能用，只是每个页面都拿到首页的标题。
- 改好后用 `curl -s https://turnery.linjiejim.com/lesson/revolve | grep '<title>'` 验证，应该看到这节课的标题。

### Caddy

服务器上的 Caddy 配置（`/etc/caddy/Caddyfile`）：页面先找预渲染的 `{path}/index.html`，没有再回落到 `index.html`；带哈希的资源长期缓存；模型文件名不带哈希，重新烘焙后最多缓存 1 小时；页面本身不缓存（`header` 在 `try_files` 改写路径之前执行，所以按「不是 assets / models」匹配，而不是按 `/index.html`）。

```caddyfile
turnery.linjiejim.com {
	import logging
	encode {
		zstd
		gzip
		match {
			header Content-Type text/html*
			header Content-Type text/css*
			header Content-Type text/plain*
			header Content-Type text/javascript*
			header Content-Type application/json*
			header Content-Type application/javascript*
			header Content-Type application/wasm*
			header Content-Type image/svg+xml*
			header Content-Type model/gltf-binary*
		}
	}
	handle {
		root * /srv/turnery/current
		@glb path *.glb
		header @glb Content-Type model/gltf-binary
		@assets path /assets/*
		header @assets Cache-Control "public, max-age=31536000, immutable"
		@models path /models/*
		header @models Cache-Control "public, max-age=3600"
		@pages not path /assets/* /models/*
		header @pages Cache-Control "no-cache"
		try_files {path} {path}/index.html /index.html
		file_server {
			precompressed br gzip
		}
	}
}
```

`/version.json` 是构建时写下的提交号（`app/vite.config.ts`），落在「不是 assets / models」那一类，也是 `no-cache`。开着旧页面的标签页回到前台时（以及每 10 分钟）读它，和自己打包时的提交号不一样就提示「新版本已发布，刷新后生效 · 刷新页面」（`src/components/new-version-prompt.tsx`），不会自己刷新。改 Caddy 时别让它被缓存。

### 旧域名 arbor.linjiejim.com 和 featuretree.linjiejim.com

项目改过两次名：2026-11-08 从 FeatureTree 改成 Arbor，2026-11-10 改成 Turnery。站点现在在 `turnery.linjiejim.com`，静态站在 `/srv/turnery`。当时还有工作台 API（`/root/turnery/api`，进程 `turnery-api`，端口 18914），2026-11-22 去掉了。

服务器上的搬迁写在 `app/scripts/move-to-turnery.sh` 里，分两步，都可以重复运行，改 Caddy 前先备份、校验通过才重载：

```bash
ssh jim-server 'sh -s prepare' < app/scripts/move-to-turnery.sh   # 改部署路径的 PR 合并之前
ssh jim-server 'sh -s switch' < app/scripts/move-to-turnery.sh    # 那个 PR 部署完成之后
```

- `prepare`：建新目录，复制密钥，把线上版本硬链接成新目录的第一个版本，在 Caddy 里加上新域名（和旧域名并存）。
- 改路径后的第一次部署停掉了旧进程 `arbor-api`（同一个端口），把分享数据复制到新目录，再启动 `turnery-api`。
- `switch`：两个旧域名改成只做交接，watchtower 的健康检查改到新域名。

旧域名切换后：

- `/api/*` 用 308 转到新域名（API 去掉以后，那边只剩网站本身），静态文件用 301。
- 页面一律返回 `moved.html`（`app/public/moved.html`）。浏览器的本地存储按域名分开，所以这一页先读出这个浏览器在旧域名上的学习进度和工作台模型，放在网址片段 `#arbor-move=…` 里，打开新域名的同一个路径；新域名启动时合并进来，再把片段从地址里去掉（`src/lib/moved.ts`）。存储的键名两次改名都没变（`arbor:progress` 等），所以合并逻辑是同一套。
- 片段不会发给服务器。自己填的 DeepSeek key 和对话记录不带过去。

旧目录留到 2026-11-17 前后，确认没问题后删掉：

```bash
ssh jim-server 'rm -rf /srv/featuretree /root/featuretree /srv/arbor /root/arbor'
```

Caddy 默认不认识 `.glb`，不给 Content-Type 也就不压缩；上面显式设了 `model/gltf-binary` 并加进压缩列表。网格数据压缩率很高，例如一个 276 KB 的齿轮 GLB 用 zstd 传输只有 45 KB。

### 去掉工作台 API（2026-11-22）

网页工作台原来有对话建模和分享链接，由 `app/server` 这个小服务转发对话、存分享（进程 `turnery-api`，Caddy 把 `/api/*` 转给 `127.0.0.1:18914`，托管 key 在 `/root/turnery/shared/.env`）。这些都去掉了（`docs/specs/2026-11-22-web-without-chat.md`），部署流程也不再上传、重启 API。服务器上剩下的东西由 `app/scripts/retire-api.sh` 清理，在去掉 `app/server` 的 PR 部署完成以后运行一次：

```bash
ssh jim-server 'sh -s' < app/scripts/retire-api.sh
```

- 从 `turnery.linjiejim.com` 的站点块里去掉 `handle /api/*`，改前先备份 Caddyfile，校验通过才重载，不通过就恢复原样。
- `pm2 delete turnery-api`，再 `pm2 save`。
- 把 `/root/turnery/api/data`（分享和每日花费）打包成 `/root/turnery/api-data-<日期>.tgz`，再删掉 `/root/turnery/api` 和 `/root/turnery/shared/.env`。
- 每一步已经做过就跳过，可以重复运行。

删掉 `.env` 不会让 key 失效：托管的 OpenRouter / DeepSeek key 由 Jim 到服务商后台吊销，脚本最后会提醒。旧的分享链接不迁移，`/studio/s/:id` 现在落到 404。

## 体积参考

| 内容 | 大小 |
| --- | --- |
| 首页入口 JS | 约 177 KB（gzip） |
| three.js 分块 | 约 178 KB（gzip），长期缓存 |
| 每节课 | 4–10 KB（gzip），按需加载 |
| 一个零件的一组参数（含全部步骤） | 40–750 KB（未压缩） |
| 全部烘焙模型 | 约 14 MB，按需加载，只下载看到的那组 |

面向国内用户时，把静态资源放在国内可访问的节点上，不要依赖 jsDelivr、unpkg 这类境外 CDN。
