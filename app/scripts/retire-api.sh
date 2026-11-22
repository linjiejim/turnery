#!/bin/sh
# Takes the studio API (chat and shared links on the website, removed 2026-11-22) off jim-server.
# Run once after the PR that removes app/server has deployed; safe to re-run, each step skips
# when it is already done:
#
#   ssh jim-server 'sh -s' < app/scripts/retire-api.sh
#
#   1. Caddy: drop `handle /api/*` (and the comment about event streams) from the
#      turnery.linjiejim.com site. Backs up the Caddyfile first and reloads only a valid one.
#   2. PM2: delete the process turnery-api and save the process list.
#   3. Data: /root/turnery/api/data (shared links, the daily budget) goes into
#      /root/turnery/api-data-<date>.tgz; then /root/turnery/api and the secrets in
#      /root/turnery/shared/.env are removed.
#   4. Reminds you to revoke the hosted key at the provider: deleting the file doesn't.
set -e
CF=/etc/caddy/Caddyfile
SITE=turnery.linjiejim.com
API=/root/turnery/api
ENV_FILE=/root/turnery/shared/.env

backup() {
  TS=$(date +%Y%m%d-%H%M%S)
  mkdir -p /root/deploy-backups
  cp -a "$CF" "/root/deploy-backups/Caddyfile.backup-$TS"
}
reload_or_restore() {
  # Not fatal under `set -e`: a failure here must still reach the restore below.
  chown -R caddy:caddy /var/log/caddy || true
  if caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1 && systemctl reload caddy; then
    return 0
  fi
  # Not valid, or valid and not taken: back to the file Caddy is running, so a re-run starts over.
  cp -a "/root/deploy-backups/Caddyfile.backup-$TS" "$CF"
  echo "Caddyfile 校验或重载没通过，已经恢复原样。"
  exit 1
}
# The turnery.linjiejim.com site block, on its own.
site_block() {
  awk -v site="$SITE" '$0 == site " {" { on = 1 } on { print } on && /^\}$/ { on = 0 }' "$1"
}

# 1. Caddy
if ! site_block "$CF" | grep -q .; then
  echo "Caddyfile 里没找到 $SITE 的站点块，什么都没改。"
  exit 1
fi
if site_block "$CF" | grep -qE '^[[:space:]]*(handle /api/\*|# No text/event-stream here)'; then
  backup
  # Inside the site block: skip the comment line, and `handle /api/* { … }` up to its closing brace.
  awk -v site="$SITE" '
    $0 == site " {" { on = 1 }
    on && /^[[:space:]]*# No text\/event-stream here/ { next }
    on && !depth && /^[[:space:]]*handle \/api\/\* \{/ { depth = 1; next }
    depth { n = gsub(/\{/, "{"); m = gsub(/\}/, "}"); depth += n - m; next }
    on && /^\}$/ { on = 0 }
    { print }
  ' "/root/deploy-backups/Caddyfile.backup-$TS" > "$CF"
  if ! site_block "$CF" | grep -q 'root \* /srv/turnery/current' || site_block "$CF" | grep -q '/api/'; then
    cp -a "/root/deploy-backups/Caddyfile.backup-$TS" "$CF"
    echo "去掉 /api/* 以后 $SITE 的站点块不对，Caddyfile 已经恢复原样，什么都没改。"
    exit 1
  fi
  reload_or_restore
  echo "Caddy：$SITE 不再转发 /api/*（备份 /root/deploy-backups/Caddyfile.backup-$TS）。"
else
  echo "Caddy：$SITE 已经没有 /api/*。"
fi

# 2. PM2
# nvm.sh isn't written for `set -e`: source it where a failing line inside doesn't end the script.
if [ -s "$HOME/.nvm/nvm.sh" ]; then
  . "$HOME/.nvm/nvm.sh" >/dev/null || true
fi
if command -v pm2 >/dev/null 2>&1 && pm2 describe turnery-api >/dev/null 2>&1; then
  pm2 delete turnery-api >/dev/null
  pm2 save >/dev/null
  echo "PM2：删掉了 turnery-api。"
else
  echo "PM2：已经没有 turnery-api。"
fi

# 3. Data and secrets
if [ -d "$API/data" ]; then
  OUT="/root/turnery/api-data-$(date +%Y%m%d).tgz"
  tar -czf "$OUT.tmp" -C "$API" data
  tar -tzf "$OUT.tmp" >/dev/null
  mv -f "$OUT.tmp" "$OUT"
  echo "数据：打包到 $OUT（$(du -h "$OUT" | cut -f1)）。"
fi
if [ -e "$API" ]; then
  rm -rf "$API"
  echo "删掉了 $API。"
else
  echo "$API 已经删掉了。"
fi
KEYS=""
if [ -f "$ENV_FILE" ]; then
  # Only the variable names: the values never reach the terminal.
  KEYS=$(grep -oE '^(OPENROUTER|DEEPSEEK)_API_KEY' "$ENV_FILE" | tr '\n' ' ' | sed 's/ $//' || true)
  rm -f "$ENV_FILE"
  rmdir /root/turnery/shared 2>/dev/null || true
  echo "删掉了 $ENV_FILE（里面的 key：${KEYS:-没有}）。"
else
  echo "$ENV_FILE 已经删掉了。"
fi

# Check: the site still answers, /api/health is now the site's own page, nothing listens on 18914.
sleep 2
echo "网站：$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 "https://$SITE/lesson/revolve")"
echo "/api/health：$(curl -s -o /dev/null -w '%{http_code} %{content_type}' --max-time 20 "https://$SITE/api/health")（应该是网页，不是 JSON）"
if command -v ss >/dev/null 2>&1 && ss -ltn 'sport = :18914' | grep -q LISTEN; then
  echo "注意：18914 端口还有进程在监听。"
fi

# 4. The key
echo
echo "最后一步要你自己做：到服务商后台吊销网站用的托管 key。删掉文件不会让 key 失效。"
echo "  OpenRouter：https://openrouter.ai/settings/keys"
echo "  DeepSeek：  https://platform.deepseek.com/api_keys"
echo "本机评测（npm run eval:studio）读的是本机 ~/.config/turnery/ 里的 key；它和服务器上的是同一个的话，吊销后在那里换成新 key。"
