# Changelog

English · [简体中文](CHANGELOG.zh-CN.md)

What changed in each version of Turnery, the desktop app. The first time you open Turnery after an update, “See what’s new” shows the same notes.

## 0.13.0 · 2026-11-23

### Heads-up

- The website’s workbench no longer has chat modeling or shared links. To have AI model with you, use the desktop app.

### New

- **Build features by hand.** The “+” at the end of the timeline opens a form that builds the step as you fill it in, and one undo takes the whole form back. The steps panel has “Edit”, “Move up a step” and “Move down a step”, and the parameters panel has “+ New parameter”.

### Improved

- The website’s workbench runs the desktop app’s engine: projects, assemblies, STEP, shared parameters, standard parts and 3MF work there too.

### Fixed

- A cut that removes the whole solid, or a revolve around the wrong axis, is an error in that step only; the rest of the part still shows.
- A parameter named like an expression function (such as floor) or the constant pi is refused right away, with the reason, instead of failing later in an expression with an unclear error.

## 0.12.0 · 2026-11-20

### New

- **Chinese and English.** The interface, the website and the docs come in both languages. The desktop app follows the system language, or the language menu in the title bar.
- What the agent reads (the guide, tool descriptions and kernel messages) is in English too.
- **Replay the modeling.** ‹ ▶ › at the bottom left of the feature timeline step through the features one by one, or play them from the first.
- Website: lessons, cards and teardown narration in English.

### Improved

- The workbench’s chat is simpler.
- The interface font is IBM Plex; Chinese in titles and buttons uses Plex Sans SC.
- Website: the learning page starts with where to begin, then splits by topic.
- Website: the workbench points to the desktop app at the top.

---

Older versions (Turnery 0.6.1–0.11.1, Arbor 0.2.0–0.5.0): see [GitHub Releases](https://github.com/linjiejim/turnery/releases).
