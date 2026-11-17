# turnery-mcp

A thin launcher for the MCP server that ships inside the [Turnery](https://github.com/linjiejim/turnery) desktop app. It exists so MCP clients and registries that expect an installable package can start Turnery's server with `npx`:

```json
{ "mcpServers": { "turnery": { "command": "npx", "args": ["-y", "turnery-mcp"] } } }
```

It looks for `Turnery.app` in `/Applications` and `~/Applications` (or the path in `TURNERY_BIN`) and runs `turnery mcp` with this process's stdio. Turnery itself must be installed and opened once: <https://github.com/linjiejim/turnery/releases/latest>.

If you use Claude Code, Codex or WorkBuddy, the plugin in this repository is simpler (it adds a skill too):

```
/plugin marketplace add linjiejim/turnery
/plugin install turnery@turnery
```

```
codex plugin marketplace add linjiejim/turnery
codex plugin add turnery@turnery
```

In WorkBuddy, add the plugin marketplace `linjiejim/turnery` with **+** on the Plugins page, then install `turnery`.
