# Changelog

English · [简体中文](CHANGELOG.zh-CN.md)

What changed in each version of Turnery, the desktop app. The first time you open Turnery after an update, “See what’s new” shows the same notes.

## 0.14.0 · 2026-11-25

### Heads-up

- Turnery keeps the steps it builds for your parts on this Mac (up to 1 GB, in `~/.turnery/cache/steps`), so they open quickly next time. Deleting the folder is safe: the parts are just built again.

### New

- **Cancel loading.** The loading card has “Cancel loading”, and opening another part while one is still loading stops that load at once. Parts an agent opens, and edits being applied, are never cancelled.
- **Codex in the chat.** The chat can be answered by Codex installed on this Mac and signed in with your own account. It models through Turnery, and its answers, tool calls and permission requests show in the chat. The chat is now the first tab of the right panel.
- **What’s new after an update.** After an update, Turnery says “Updated to x · See what’s new”, which opens the notes for that version.
- Website: an industrial design track: a product design topic, 35 new interactive lessons, 7 cards, 3 teardowns and a five-step project, P3.

### Improved

- **Big parts open much faster.** A part you have opened before opens again in about a second, and changing a late feature rebuilds from that step only. Opening a part for the first time is 2–4 times faster.
- Website: pages respond at once. A bar at the top shows while a page loads, a page starts downloading when you point at its link, and the first visit downloads half as much.
- Website: when a new version of the site is out, an open page offers to refresh.

### Fixed

- Spline points in a sketch make a smooth curve through every point, instead of twisting into an S between them.
- An arc of more than 90° that ends on a revolve’s axis is no longer refused as crossing the axis.
- A hollow ball (a part with a round cavity) exports to STEP as a complete solid.
- Exported 3MF files share the vertices where faces meet, so slicers no longer report open edges.
- An STL zip with Chinese file names opens with macOS’s own unzip.

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
