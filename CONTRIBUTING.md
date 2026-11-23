# Contributing

English · [简体中文](CONTRIBUTING.zh-CN.md)

> Code is MIT and lesson text and docs are CC BY 4.0; by contributing you agree to license your contribution the same way.

Bug reports, typo fixes, corrections, new lessons and new teardown models are all welcome, in English or Chinese. This guide covers how to run things, what to check before you open a pull request, how the two languages work, and why every content correction needs a source.

## Run it

You need:

- Node.js 22 (CI uses it; 20 or later usually works).
- Python 3.11 or later, only if you change `models/`.

The website, the browser workbench and the desktop window's interface all live in `app/`:

```bash
git clone https://github.com/linjiejim/turnery.git
cd turnery/app
npm ci
npm run dev         # http://localhost:5287, English pages under /en
```

The baked teardown models are committed in `app/public/models/`, so front-end work needs no Python.

The desktop app (Electron, the MCP server and the CLI) lives in `desktop/` and builds the window from `app/`:

```bash
cd desktop
npm ci
npm run build                         # desktop/dist
TURNERY_HOME=/tmp/turnery-dev npm start   # opens the window, apart from an installed Turnery
```

Point your agent at the build you are working on with `node desktop/dist/cli.mjs mcp` instead of the installed app (see [`desktop/README.md`](desktop/README.md)).

## Before you open a pull request

```bash
cd app
npm run check       # types, oxlint, design guards, unit tests
npm run build       # production build, plus one prerendered HTML page per route
npm run e2e         # Playwright, when you changed something on screen
```

```bash
cd desktop
npm run check && npm test && npm run build
```

CI runs the same steps; all of them have to pass.

- oxlint with zero warnings.
- The design guards (`app/src/tests/design`) stop raw colour values, font sizes under 12px and hand-rolled popovers.
- The i18n guard stops a `t()` pair whose English half still has Chinese in it.

## Two languages

The interface exists in Chinese and English: the website's English pages are under `/en/…`, and the desktop window follows the system language or the language menu in its title bar. How it works and what is and isn't translated: [`docs/i18n.md`](docs/i18n.md). The rules you'll meet most:

- Every string on screen is written as a pair where it's used: `t("回到最新", "Back to latest")`. Keep the Chinese exactly as it is (tests match it) and put the English next to it.
- Text for the agent or a model (the MCP guide, tool descriptions, tool results, kernel and engine messages, system prompts) is written with `ta("中文", "English")`, which follows the agent's language, not `t()`. Keep output that code parses (✓ ✗ ⚠ prefixes, line layout) the same shape in both.
- Lessons and cards carry both languages in place (`byLocale(<>中文</>, <>English</>)` for rich text; quiz options in the same order in both). The course catalog and the teardowns' narration are overlays in `app/src/content/en/`; a re-baked model with new text needs its English there too.
- English copy: sentence case, short sentences, verbs on buttons, no "Please". Chinese copy: short sentences, 「」 quotes, a space between Chinese and Latin text or numbers, buttons as verb + object in six characters or fewer.

## Write a lesson

Full guide (Chinese): [`docs/dev/lesson-authoring.md`](docs/dev/lesson-authoring.md). In short:

- A lesson is two files in `app/src/content/lessons/`: `<id>.scene.ts`, the scene controller, and `<id>.tsx`, the steps, text, tasks and quiz.
- Start from `revolve` (the most standard) or `sketch-to-solid` (the most interactive).
- 4–7 steps, one concept each: every step turns the camera to what matters, the task happens in 3D, and the easy mistake is guessed before it is shown.
- Three quiz questions at the end, each with an explanation.
- In dev mode open `/lesson/<file name>`; register it in `lessons/index.ts` (and its English title in `content/en/lessons.ts`) before it ships.

## Write a teardown model

Full guide (Chinese): [`docs/dev/models.md`](docs/dev/models.md).

Models are written in [build123d](https://github.com/gumyr/build123d) under `models/parts/<id>.py` or `models/assemblies/<id>.py`, and baked offline into GLB by `turnerybake`:

```bash
python3 -m venv .venv
.venv/bin/pip install -r models/requirements.txt
cd models && ../.venv/bin/python -m turnerybake <id>    # bake one model
```

- Put `# @step <id>` before each feature and call `r.solid` or `r.sketch` once after it.
- A parameter combination that fails is teaching material: give it a `failures` explanation.
- Re-bake after changing a model and commit the changes in `app/public/models/<id>/` with it.

## Design rules

The interface is built on jim-uiux; this project's own conventions are in [`docs/DESIGN.md`](docs/DESIGN.md). The ones that come up most:

- **Colour**: semantic tokens only (`bg-primary`, `text-muted-foreground`, `--scene-*`), never colour values. The 3D scene reads its colours from the theme tokens too.
- **Type**: the type scale only (`text-caption` and up), nothing under 12px; weights 400 / 500 / 600.
- **Popovers**: use the dialogs, drawers and popovers in `components/ui/`, never your own. Changes to `components/ui/` follow jim-uiux upstream: open an issue first.
- **Coordinates**: Z is up; when you mention SOLIDWORKS, say that it defaults to Y up.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), one change per commit. The history is mostly written in Chinese; either language is fine for yours.

```
fix(app): bring the part closer in the first step of the 3D printing lesson
feat(content): add the "tolerances and fits" lesson
docs: add the license and third-party notices
```

- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`.
- Scopes: `app` (website, workbench, window), `desktop` (Electron, MCP, CLI), `turnery` (the app as a whole, releases), `content` (lesson text, terms, curriculum), `models` (models and the baker), `ci`.
- The body says why. For a content correction, the body carries the source.
- `feat`, `fix` and `perf` subjects are the first draft of the desktop app's release notes ([`desktop/README.md`](desktop/README.md#releasing)), so say what changed for the people using Turnery, not which component you touched.

## Content corrections need a source

What the course says about engineering is learned as the right answer, so every correction has to be traceable.

1. **Open an issue first** with the "Content correction" template: which lesson and step, what it says now, what it should say, and the source.
2. **Sources, most trusted first**:
   - **The standard itself**: GB/T, ISO, ASME… with number, year and clause, e.g. "GB/T 4457.5-2013, clause 4.1".
   - **The software's official help**: software, version and interface language, with a link, e.g. "SOLIDWORKS 2022 Help (English) · Sheet Properties".
   - **Published textbooks and handbooks**: title, edition and page.
   - **Forum posts and blogs**: supporting evidence only, never the only source.
3. **When a command's name differs between versions or languages**, say which version, or write "varies by version"; don't generalise from one.
4. **Once merged**, the source goes in the commit body, and where useful in a comment next to the text ("see GB/T 14692").

Suggestions without a source are welcome too, and we will look into them, but the lesson text won't change until there is one.

## Security

Please don't report security issues in public issues: see [`SECURITY.md`](SECURITY.md).

## License

Code is under MIT ([`LICENSE`](LICENSE)); lesson text and docs are under CC BY 4.0 ([`LICENSE-content`](LICENSE-content)). When you add a third-party dependency or asset, add its license and link to [`THIRD_PARTY.md`](THIRD_PARTY.md). Dependencies whose license isn't compatible with MIT (a GPL library bundled into the site, for example) can't be accepted.

Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).
