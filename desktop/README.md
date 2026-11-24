<p><img src="resources/icon-64.png" width="64" alt="Turnery"></p>

# Turnery

English · [简体中文](README.zh-CN.md)

Your local coding agent (Claude Code, Codex…) builds parametric parts through MCP or the command line. In the Turnery window you watch each step as it is built, drag parameters, change features and leave notes on faces or edges; the agent sees them on its next call.

The name: a turnery is a turning shop, where stock is held on a spindle and cut into shape pass by pass; a turn is also one round of an agent. The logo is a lowercase t extruded to a thickness, its top cut at an angle: a sketch extruded into a solid. The logo and icons are made by `resources/logo/make-logo.py` (exact geometry from build123d) and `scripts/make-icons.py`.

- The modeling is the same as in the Turnery workbench on the website: feature tree JSON, semantic selectors, the OpenCascade kernel (`app/src/studio`).
- The AI is either your own agent (then Turnery calls no model and needs no key) or the built-in assistant: the “Chat” (对话) button in the window’s title bar, with a model and key you set up (`~/.turnery/providers.json`, or the environment variable `TURNERY_API_KEY_<PRESET>`). From the command line: `turnery model`, `turnery ask "<one sentence>"`. The assistant can only call modeling commands. It and outside agents are each told separately what changed since their last call.
- The chat window can also be handed to Codex on your computer: click the model name under the chat and choose Codex under “Who answers”. It uses your own `codex` (0.171.0 or newer) and the ChatGPT subscription you signed in to with `codex login`; Turnery never signs you in and never touches its credentials. Codex works in the project folder; modeling commands run directly, and before it edits files, runs commands that change things or uses other tools it asks you in the chat. Settings are in `~/.turnery/agents.json`. The protocol is ACP (the codex-acp adapter ships in `dist/agents/`).
- A part is one `.turnery.json` file (feature tree JSON). It goes in git and you can edit it directly. Notes are in the `.notes.json` next to it.
- A folder is a project: the left panel lists its assemblies and parts. “File → New project” (文件 → 新建项目) makes a folder with an empty assembly and a shared parameter file of the same name. “+ Part” (+ 零件) at the bottom of an assembly's feature tree makes a new part (under `parts/`, using the project's parameters) or adds an existing part or a STEP file.
- New projects go under `~/.turnery/projects/` by default and are named by the time (`YYYYMMDDhhmmss`) unless you rename them. Opening a project opens the assembly named after the folder, if there is one.
- One project per window. Several projects can be open at once without getting in each other's way: each window has its own engine and kernel thread. When the current window already has a project, “New project” (新建项目) and “Open project” (打开项目) open a new window; a project is only ever open in one window. “File → New window” (文件 → 新建窗口, ⌥⌘N) opens an empty window.
- The home button in the title bar (⇧⌘H) closes the window's project and goes back to the start page. The start page lists recent projects and can open the example that ships with the app (a sensor enclosure). The first launch opens this example once: it is copied to `~/.turnery/projects/sensor-enclosure/`, and your changes stay in that copy.
- Explanations in the interface are tucked into a grey ⓘ: point at it to show all of it, move away to hide it. A click keeps it open until you click elsewhere or press Esc.
- ⌘= / ⌘- / ⌘0 zoom the whole window, and the zoom is kept for the next launch. In an assembly, select parts and press H to hide them; ⇧H shows every hidden part (the toolbar of the selected part has both as buttons too).

## Install and run

```bash
cd app && npm install --registry=https://registry.npmmirror.com      # the shared code and dependencies
cd ../desktop
ELECTRON_MIRROR=https://registry.npmmirror.com/-/binary/electron/ NODE_USE_ENV_PROXY=1 \
  npm install --registry=https://registry.npmmirror.com
npm run build      # builds into dist/
npm start          # opens Turnery
```

- The Electron binary is downloaded from GitHub; the mirrors above are for when a direct connection is slow. `NODE_USE_ENV_PROXY=1` makes Node's fetch use `https_proxy`.
- `npm run dev`: the window is served by the Vite dev server (hot reload). After changing the main process or the engine, run it again.
- `npm run dist`: packages `release/mac-arm64/Turnery.app`, then `scripts/release.mjs` signs it ad hoc and makes the dmg and the update zip in `release/upload/`. A local build writes no update manifest and is never pushed to installed apps.

## Download, install and update

Download `Turnery-<version>-arm64.dmg` from [GitHub Releases](https://github.com/linjiejim/turnery/releases/latest) (`x64` for an Intel Mac) and drag Turnery to Applications. Turnery is not signed by Apple, so macOS blocks it the first time you open it: go to System Settings → Privacy & Security and click “Open Anyway”. Or run `xattr -dr com.apple.quarantine /Applications/Turnery.app` in a terminal.

Once installed, Turnery updates itself: it checks 15 seconds after launch and then every 6 hours. It reads `turnery-update.json` from the latest release, downloads the zip for this machine in the background, verifies its size, SHA-256 and signature (the public key is built into the app, `desktop/src/update/public-key.ts`), and unpacks it into a hidden folder `.turnery-update/` next to the app. When the download is ready, the title bar shows “Restart to update to x.y.z” (重启以更新到 x.y.z). You don't have to click it: the new version goes in the next time you quit Turnery.

- Menu Turnery → “Check for updates…” (检查更新…): checks now and tells you the result (up to date, downloading, or why it failed).
- The first launch after an update says “Updated to x.y.z · See what’s new” (已更新到 x.y.z · 查看更新内容) for a few seconds; “See what’s new” lists what changed in every version since the one you had. Menu Turnery → “What’s new…” (查看更新内容…) shows all of it. The notes are built into the app (`desktop/CHANGELOG.md`, in the window's language); a first install says nothing.
- Menu Turnery → “Check for updates automatically” (自动检查更新): untick it to stop the automatic checks. The setting is stored in `~/.turnery/settings.json`.
- Only a Turnery.app in a writable location can update itself: not when it runs straight from the dmg, and not when macOS runs it in isolation (App Translocation). Checking for updates tells you why.
- Downloads go through Chromium's network stack and follow the system proxy.
- For testing, the environment variable `TURNERY_UPDATE_URL` points to another manifest; the signature is still verified.

### Releasing

What changed is written once, in [`CHANGELOG.md`](CHANGELOG.md) and its Chinese twin [`CHANGELOG.zh-CN.md`](CHANGELOG.zh-CN.md): one section per version, the groups Heads-up / New / Improved / Fixed (注意 / 新增 / 改进 / 修复), the rules in jim-uiux's `references/patterns/updates.md`. The release page, the `notes` in `turnery-update.json` and the app's “What’s new” all come from there.

1. Draft the next section from the commits since the last tag (`feat`, `fix`, `perf` and breaking changes go in; the version is worked out from them, or give `--version x.y.z`):
   ```bash
   cd desktop
   node scripts/release-notes.mjs draft --write --tag-prefix turnery-v
   node scripts/release-notes.mjs draft --write --tag-prefix turnery-v --file CHANGELOG.zh-CN.md
   ```
2. Edit both drafts into plain words for the people using the app: one thing per line, in the right group, nothing they wouldn't notice; no commit or PR numbers, module names or refactors. Changes only the website sees start with “Website:” (网站：) or go. The two files keep the same versions, groups and number of items (`app/src/tests/unit/release-notes.test.ts`).
3. Change `version` in `desktop/package.json` (and the version at the top of `package-lock.json`) to the one drafted, commit it with the notes as `chore(turnery): <version>`, and merge into main. CI fails when the version in `package.json` has no section in either file.
4. Push the tag `turnery-v<version>`. The workflow `.github/workflows/turnery-release.yml` checks that the tag matches the version, then builds the arm64 and x64 packages on macOS, signs and packages them, creates a draft release and uploads the dmgs, the zips and `turnery-update.json`. The draft's notes are the version's section, English then Chinese, then the download line; `turnery-update.json` carries the same notes (the signatures don't cover them). A version without a section is drafted from the commits, with a warning on the run: fix it before publishing. A release that already exists keeps its notes.
5. Check the draft, then publish it and mark it latest: `gh release edit turnery-v<version> --draft=false --latest`. Installed apps read only the latest published release, so the update goes out at this step. The latest release of this repository is reserved for Turnery.

Correct the notes in the changelog before tagging, not in the draft: the app shows what it was built with. A published section doesn't change afterwards; say what was wrong in the next version's notes.

The repository was called `featuretree` (until 2026-11-08) and then `arbor` (until 2026-11-10), and the app was once called Arbor. The rename changed the bundle id (`com.linjiejim.arbor` → `com.linjiejim.turnery`), so Arbor 0.5.x and earlier do not update to Turnery on their own: download it once by hand. Don't create a repository named `featuretree` or `arbor` again, or GitHub's redirects from the old addresses break. Old files still work: `*.arbor.json` and `*.arbor-asm.json` still open and save, and new files are `*.turnery.json`. On Turnery's first launch, `~/.arbor` is renamed to `~/.turnery` as a whole (left alone while the old Arbor is still running).

Update packages are signed with an ed25519 private key, stored in the repository secret `TURNERY_UPDATE_KEY` (PEM). The maintainer keeps a local backup in `~/.arbor-release/update-key.pem`. Installed apps accept only updates signed with this key: changing the key means replacing `public-key.ts` too, and everyone has to download the app again by hand. Before writing the manifest, `release.mjs` verifies the signature with the built-in public key, so a wrong key fails at release time and not on users' machines.

## Connect an agent

“Connect an agent” (接入 Agent) at the top right of the window gives the full commands for this machine. They look like this:

```bash
claude mcp add --scope user turnery -- /Applications/Turnery.app/Contents/Resources/bin/turnery mcp
```

```bash
codex mcp add turnery -- /Applications/Turnery.app/Contents/Resources/bin/turnery mcp
```

Claude Code can also install the plugin, which brings a `build-part` skill along with the MCP server:

```
/plugin marketplace add linjiejim/turnery
/plugin install turnery@turnery
```

The plugin is in the repository's `plugin/`. `plugin/scripts/turnery-mcp.sh` finds the installed Turnery (`/Applications`, `~/Applications` or the environment variable `TURNERY_BIN`); when it can't, it says on stderr where to get it. `packages/turnery-mcp/` is an npm launcher that does the same, for the MCP Registry and for clients that only take `npx`.

When running from source, use `desktop/bin/turnery` as the path. Other MCP agents take it in their `mcpServers` config (`command` + `args: ["mcp"]`).

Then tell the agent, for example: “Use turnery to build an 80×50×30 box, 2 mm walls, R4 outer fillets, M3 tapped holes in the four corners. Check the dimensions and take a look when you are done.”

## How it works

```
Claude Code / Codex ──MCP (stdio)──► turnery mcp ──HTTP 127.0.0.1──► Turnery main process: engine ◄──IPC──► window
                     turnery CLI ───────────────────┘                  │ OpenCascade in a worker thread
                                                                      ▼
                                              your project folder: part.turnery.json, part.notes.json
```

- **The engine** (`app/src/desktop/core/engine.ts`) holds the open parts, undo, notes and every command. It does not depend on the platform: the Electron main process and the command line run the same code.
- **The kernel** runs in a Node worker thread (`desktop/src/engine/kernel-thread.ts`), one kernel per part (the 4 most recently used). Switching back to a part reuses its last result, with no rebuild. When the wasm heap goes over 1.4 GB, the thread is replaced and only the current part is replayed; the other parts are rebuilt when they are next used.
- **`turnery mcp`** passes every call to the running app, which is why each step shows in the window. If the app is not open, it starts it (without taking focus). If the app can't start, it runs an engine without a window in its own process (then `look` and `request_pick` are unavailable).
- **Which window a call goes to, with several open**: the window whose project contains the part or folder. `open_project` on a project that isn't open yet uses an empty window or opens a new one. Otherwise the call stays in the window this agent used last. So two agents working on two projects each get their own window. When a window is closed, its engine is kept as long as an agent has used it in the last 10 minutes (`look` opens the window again); otherwise it is released.
- **Headless mode**: `turnery mcp --headless` (or the environment variable `TURNERY_HEADLESS=1`) starts the app in the background when it isn't running, with no window and no Dock icon; `look` still renders, in a hidden window. Launching Turnery or running `turnery open` brings the window up, and so does an agent calling `request_pick`. After 30 minutes without calls it quits. An app that is already running is used as it is, headless or not.
- **Every edit counts, whoever makes it**: the agent, you in the window, or the file itself (an editor, git). Every change is recorded under “Activity” (动态) and can be undone. On the agent's next call, the result starts with “自你上次调用以来，用户改了：W 40 → 45” (since your last call, the user changed: W 40 → 45), so it does not change your edit back.
- **Discovery**: on launch the app writes its port and a random token to `~/.turnery/engine.json` (mode 600) and how to start itself to `~/.turnery/app.json`. It listens on 127.0.0.1 only and checks the Host header.

## Tools for the agent (40)

| Group | Tools |
| --- | --- |
| Parts and assemblies | `guide`, `open_project` (a folder as a project; `create` makes an empty assembly and parameter file), `open_part` (a part `.turnery.json` or an assembly `.turnery-asm.json`; with `context`, you edit the part inside the assembly, with the other parts shown translucent around it), `list_parts` (every assembly and part in the project), `get_state`, `share_params` (several parts share one parameter file `*.params.json`) |
| Modeling (the same as the web workbench) | `set_params`, `sketch`, `extrude`, `revolve`, `fillet`, `chamfer`, `shell`, `hole`, `linear_pattern`, `circular_pattern`, `mirror`, `sweep`, `loft`, `draft`, `split`, `rib`, `edit_feature`, `delete_feature` |
| Modeling only in the desktop app | `import`: reads a STEP file (the official model of a dev board or component), as a reference body by default; `component`: places a part file, a sub-assembly, a STEP file or a standard part (`standard`: ISO screws, nuts, washers, heat-set inserts) in an assembly, positioned with `rotate` / `at` or with `mates` (face to face, flush, concentric; select several holes and it places one in each); `thread`: real thread geometry (external and internal, M2–M12 coarse or a custom pitch, with optional print clearance). The modeling tools also take a few more forms: when adding material, a new name in `part` makes a new part; `mode: "intersect"` intersects; `revolve.start` / `symmetric`; `spline` sketch points and corner fillets `r`; `extrude.onto` engraves at an even depth along a plane or a cylinder; `fit: "insert"` on `hole` for heat-set insert holes; `outer` when selecting edges (only the outer loop of the face) |
| Whole-tree edits | `set_tree` (with `base_rev` to avoid overwriting), `move_feature`, `undo`, `redo` |
| Seeing | `inspect`, `look` (images of views rendered by the window; `focus` close-ups, `section` cuts, `dir` any direction, `hide` to hide parts; adds a close-up on its own when the last change was small; the result gives the scale), `measure` (between faces, edges, features and parts; gives coordinates) |
| Checking and delivering | `check` (the same requirement check list as the web workbench: stored in the part and re-measured on every rebuild; the desktop app adds `position` coordinates, `gap` the distance between two things (`max: 0` = must touch), `clearance` and `interference`, the last two against reference bodies or parts), `export` (step / stl (several parts are zipped) / py / json / bom bill of materials, standard parts counted together by size) |
| Working with you | `get_notes`, `resolve_note`, `request_pick` (asks you to click a face or an edge in the window and waits until you do), `show` (highlights something in the window for you) |

The result of every step flags common problems: new material that doesn't connect (with the distance), material touching only at an edge or a point, tiny sliver faces, narrow gaps (two facing faces less than 1 mm apart with nothing between them), thin walls (under 0.8 mm), and a new part overlapping another. A feature added without `after` goes before any text features at the end.

In the tool list (MCP `tools/list`), the schemas for selecting faces, edges and datum planes are written once per tool (`$defs` + `$ref`), and `set_tree` only describes its format and leaves validation to the engine. `not` in a selector only says “same fields as above”, and other structures that appear twice in one tool (the points of paths and polylines, the two ends of a distance) are also written once. The whole list is about 68,000 characters (about 240,000 at first, 87,000 in 0.5.1).

How assemblies are written and the rules for them: `docs/specs/2026-11-07-arbor-agent-modeling.md` (in Chinese).

The full guide is in the MCP instructions (`guide` reads it too); the coordinate conventions and selector syntax are the same text as the web workbench's prompt.

## Command line

```bash
turnery help
turnery call open_part path=box create=true
turnery call set_params '{"set":{"L":80,"W":50}}'
turnery check box '{"size":[80,50,30],"solids":1}'     # no window needed
turnery export box out/box.step
turnery look box -o shots/                             # needs the window; opens the app if it isn't running
turnery setup                                          # prints the commands that connect each agent
```

- `--headless`: starts the app in the background when it isn't running, without a window (see headless mode above).
- `--no-app`: doesn't connect to the app and computes in its own process (for CI and scripts; name the part with `--part`; no `look`). For MCP, set the environment variable `TURNERY_NO_APP=1`. This is what `--headless` used to mean; it was renamed in 0.5.0.

## Development

```bash
cd app && npx vitest run src/tests/unit/desktop.test.ts   # the engine's unit tests (real kernel)
cd desktop && npm run check                               # type checks for the main process, engine, MCP and CLI
node scripts/smoke-mcp.mjs                                 # a run through the official MCP client (no window)
node scripts/smoke-mcp.mjs --app                           # against the running app, including look and show
TURNERY_HOME=/tmp/turnery-dev npm start                    # kept apart from the installed Turnery (the single-instance lock and ~/.turnery both move to this folder)
npm start -- --remote-debugging-port=9223                  # then:
node scripts/cdp.mjs shot out.png                          #   screenshot the window (several windows: TURNERY_CDP_WINDOW=<n>, listed by cdp.mjs windows)
node scripts/cdp.mjs click 520 470                         #   click in the window (CSS pixels)
../.venv/bin/python -I resources/logo/make-logo.py         # regenerate the logo (SVG, the path for the website, favicon)
python3 -I scripts/make-icons.py                           # make the app icons from the logo
```

Where the code is:

| Where | What |
| --- | --- |
| `app/src/desktop/core/` | The engine, the command table (MCP and the CLI are generated from it), checks, notes, change summaries, protocol types |
| `app/src/desktop/` | The window: reuses the web workbench's viewport, feature tree, parameter, measuring and section components |
| `app/vite.desktop.config.ts`, `app/desktop.html` | The window's build entry |
| `desktop/src/main/` | The Electron main process, preload, the connect commands |
| `desktop/src/engine/` | The kernel thread, files, `~/.turnery`, the local HTTP server, connecting to the app or a windowless engine |
| `desktop/src/mcp/`, `desktop/src/cli/` | `turnery mcp` and the `turnery` command line |

## Known limitations

- macOS packages only (arm64 and x64), without Apple signing or notarization: the first launch has to be allowed in System Settings.
- The window is in English and Chinese (the language menu in the title bar; the system language until you pick one). What the agent reads is still in Chinese: the guide, the tool descriptions and the kernel's messages. Tool names and fields are English.
- No “code feature”: shapes the feature tree can't express can't be made yet (plans in `docs/specs/2026-11-07-arbor-desktop.md`, in Chinese).
- Mates only place parts (computed once, in order). They are not a constraint solver, and there is no motion. Standard parts are metric coarse M2–M12 only, and screw threads are drawn as plain shanks.
- A real thread takes a few seconds and adds many faces, so put it last. The build123d export leaves threads out (build123d has no thread command of its own).
- Faces of an imported STEP can be selected to measure, check, sketch on and drill (put the import's id in `of` in the selector), but can't be clicked in the window yet, and `extrude`'s `until` can't grow up to them yet. STEP faces have no stable names, so they are selected by position and direction only. `mode: "cut"` subtracts the component's own shape; to leave a clearance, enlarge it somewhere else first.
- `request_pick` waits at most 280 seconds per call. If nothing is clicked by then it returns; the agent calls it again with the same prompt to keep waiting, and a click in between is not lost.
