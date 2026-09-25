#!/usr/bin/env bash
set -euo pipefail

SITE_ID="7687d145-056b-4cc0-9f6f-70c2bb32912e"
LIVE_URL="https://radar.gabi.mundinhocomunicacao.com/"
ROOT="${CI_PROJECT_DIR:-/tmp}/gabi-radar-clean"
RADAR_DIR="$ROOT/radar-gabi-site"
BUNDLE_BASE="https://raw.githubusercontent.com/mundinhocomunicacao-ctrl/-kairos-bot/58dd8d2259fe713fafaf8592bac8318fee531eae/deploy/radar-gabi"

rm -rf "$ROOT"
mkdir -p "$RADAR_DIR/dist"

curl -fsSL --retry 5 --retry-all-errors "$BUNDLE_BASE/index.html" -o "$RADAR_DIR/index.html"
curl -fsSL --retry 5 --retry-all-errors "$BUNDLE_BASE/wix.config.json" -o "$RADAR_DIR/wix.config.json"

grep -F "$SITE_ID" "$RADAR_DIR/wix.config.json" >/dev/null
for forbidden in   "CLIENT_SAFE_GABI v2"   "voz ativa"   "sem acesso ao bastidor interno"   "segunda inspeção client-safe"   "pacote mínimo de dados"   "clientSafeContext:"   "<b>audit.</b>"; do
  ! grep -F "$forbidden" "$RADAR_DIR/index.html" >/dev/null
done

cp "$RADAR_DIR/index.html" "$RADAR_DIR/dist/index.html"
cd "$RADAR_DIR"
if CI=1 npx --yes @wix/cli@latest whoami >/tmp/gabi-radar-wix-whoami.txt 2>&1; then
  echo "WIX_CLI_CACHED_SESSION=PASS"
else
  WIX_CLI_KEY="${WIX_GABI_RADAR_API_KEY:-${WIX_MUNDO_API_KEY:-}}"
  if [ -z "$WIX_CLI_KEY" ]; then
    echo "WIX_CLI_API_KEY_MISSING"
    exit 1
  fi
  CI=1 npx --yes @wix/cli@latest login --api-key "$WIX_CLI_KEY"
  unset WIX_CLI_KEY
fi
CI=1 npx --yes @wix/cli@latest whoami
CI=1 npx --yes @wix/cli@latest release

CACHE_BUST="$(date +%s)"
curl -fsSL --retry 5 --retry-all-errors "$LIVE_URL?release=$CACHE_BUST" -o /tmp/gabi-radar-live.html
grep -F "DIVA · Gabi" /tmp/gabi-radar-live.html >/dev/null
for forbidden in   "CLIENT_SAFE_GABI v2"   "voz ativa"   "sem acesso ao bastidor interno"   "segunda inspeção client-safe"   "pacote mínimo de dados"   "audit."; do
  ! grep -F "$forbidden" /tmp/gabi-radar-live.html >/dev/null
done
echo "GABI_RADAR_CLEAN_RELEASE=PASS"
