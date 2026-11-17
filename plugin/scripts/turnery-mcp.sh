#!/bin/sh
# Starts the MCP server that ships inside Turnery.app. stdout is the protocol channel: messages go to stderr.
# The server resolves relative part paths against its working directory. Claude Code starts it in the user's
# project; Codex starts plugin servers in the plugin's own folder, which an update replaces. There,
# move to Turnery's projects folder so nothing is saved inside the plugin (the skill also asks for absolute paths).
plugin_dir=$(cd "$(dirname "$0")/.." && pwd -P)
case "$(pwd -P)/" in
  "$plugin_dir"/*)
    projects="${TURNERY_HOME:-$HOME/.turnery}/projects"
    mkdir -p "$projects" && cd "$projects" || exit 1
    ;;
esac
for bin in "$TURNERY_BIN" \
  "/Applications/Turnery.app/Contents/Resources/bin/turnery" \
  "$HOME/Applications/Turnery.app/Contents/Resources/bin/turnery"; do
  if [ -n "$bin" ] && [ -x "$bin" ]; then exec "$bin" mcp "$@"; fi
done
if command -v turnery >/dev/null 2>&1; then exec turnery mcp "$@"; fi
echo "Turnery.app was not found. Install it from https://github.com/linjiejim/turnery/releases/latest, open it once, then reconnect the turnery MCP server or restart your agent. Set TURNERY_BIN if it lives somewhere else." >&2
exit 1
