#!/bin/bash
# Keep-alive: reergue API (3334) e preview (5173) se caírem. Roda destacado.
cd /home/lucssfeitosa/beautypass/beautypass
while true; do
  if ! ss -tlnp 2>/dev/null | grep -q ':3334'; then
    (cd apps/api && nohup node --env-file=.env dist/main.js >> /tmp/api.log 2>&1 &)
  fi
  if ! ss -tlnp 2>/dev/null | grep -q ':5173'; then
    (cd apps/web && nohup node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 5173 >> /tmp/vite.log 2>&1 &)
  fi
  sleep 10
done
