# Turnery plugin

Turnery is parametric CAD that a coding agent drives. The agent builds a part as a feature tree (sketches, extrusions, revolves, fillets, shells, holes, patterns, splits, assemblies), an OpenCascade kernel computes the geometry, and you watch every step in the Turnery window on your Mac. You can drag parameters, pin notes on faces for the agent to act on, and export STEP, STL, 3MF, PNG or patent-style SVG line drawings.

This plugin connects your agent to Turnery. It has two parts:

- **The `turnery` MCP server.** About 40 modeling tools: open or create a part, set parameters, add features, check the stated dimensions against the kernel, look at renders, measure, read your notes, and export.
- **The `build-part` skill.** It tells the agent when to use Turnery and how to work with it: read the guide, turn key dimensions into parameters, read every result, and verify dimensions with `check` and `measure` instead of claiming them.

## Requirements

- macOS (Apple silicon or Intel). Windows and Linux builds are planned.
- Turnery.app installed in `/Applications` or `~/Applications` and opened once. Download it from [Releases](https://github.com/linjiejim/turnery/releases/latest).
- An agent that runs on your Mac, such as Claude Code, Codex or WorkBuddy. Web chat cannot start local programs, so the tools do not load there.

## Install

Claude Code:

```
/plugin marketplace add linjiejim/turnery
/plugin install turnery@turnery
```

Codex:

```bash
codex plugin marketplace add linjiejim/turnery
codex plugin add turnery@turnery
```

WorkBuddy: add the marketplace `linjiejim/turnery` with **+** on the Plugins page, then install `turnery`.

Then ask for a part, for example "use Turnery to build a 60 × 40 × 25 mm box with 2 mm walls and M3 holes in the corners".

## What it runs and connects to

- The MCP server command is `scripts/turnery-mcp.sh`. It looks for the Turnery executable at `$TURNERY_BIN`, then `/Applications/Turnery.app/Contents/Resources/bin/turnery`, then `~/Applications/Turnery.app/...`, then `turnery` on `PATH`, and runs it as `turnery mcp`. It downloads and installs nothing. If the agent starts it inside the plugin's own folder (Codex does), it first moves to `~/.turnery/projects` so that no part is saved inside the plugin.
- `turnery mcp` opens the Turnery app if it isn't running, and talks to it over HTTP on `127.0.0.1` only. Your parts stay on your disk as `*.turnery.json` files in the folder you work in.
- The plugin sends nothing over the network and calls no model; your agent's own model does the reasoning. The Turnery app checks GitHub Releases for updates. Its optional built-in assistant, which this plugin does not use, sends your chats and the open part to the model provider you set up in the app, and keeps that key in `~/.turnery/providers.json`.

## License

MIT. Source, issues and documentation: <https://github.com/linjiejim/turnery>.
