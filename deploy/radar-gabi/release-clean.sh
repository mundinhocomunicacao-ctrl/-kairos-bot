#!/usr/bin/env bash
set -euo pipefail

SITE_ID="7687d145-056b-4cc0-9f6f-70c2bb32912e"
LIVE_URL="https://radar.gabi.mundinhocomunicacao.com/"
SOURCE_DIR="${GITHUB_WORKSPACE:-$(pwd)}/deploy/radar-gabi"
ROOT="${RUNNER_TEMP:-/tmp}/gabi-radar-clean"
RADAR_DIR="$ROOT/radar-gabi-site"

rm -rf "$ROOT"
mkdir -p "$RADAR_DIR/dist"

cp "$SOURCE_DIR/index.html" "$RADAR_DIR/index.html"
cp "$SOURCE_DIR/wix.config.json" "$RADAR_DIR/wix.config.json"

grep -F "$SITE_ID" "$RADAR_DIR/wix.config.json" >/dev/null
for forbidden in \
  "CLIENT_SAFE_GABI v2" \
  "voz ativa" \
  "sem acesso ao bastidor interno" \
  "segunda inspeção client-safe" \
  "pacote mínimo de dados" \
  "clientSafeContext:" \
  "<b>audit.</b>" \
  "base sintetizada" \
  "Evidência recuperada:" \
  "Material reconciliado no acervo" \
  "Estado reconciliado" \
  "totais estruturais só mudam após reconciliação"; do
  ! grep -F "$forbidden" "$RADAR_DIR/index.html" >/dev/null
done

grep -F "GABI_RADAR_PUBLIC_SAFE_V3" "$RADAR_DIR/index.html" >/dev/null
grep -F "DIVA Studio" "$RADAR_DIR/index.html" >/dev/null
cp "$RADAR_DIR/index.html" "$RADAR_DIR/dist/index.html"

cd "$RADAR_DIR"
WIX_CLI_KEY="${WIX_GABI_RADAR_API_KEY:-${WIX_MUNDO_API_KEY:-}}"
test -n "$WIX_CLI_KEY" || (echo "WIX_CLI_API_KEY_MISSING" && exit 1)
CI=1 npx --yes @wix/cli@latest login --api-key "$WIX_CLI_KEY"
unset WIX_CLI_KEY
CI=1 npx --yes @wix/cli@latest whoami
CI=1 npx --yes @wix/cli@latest release

CACHE_BUST="$(date +%s)"
curl -fsSL --retry 6 --retry-all-errors --retry-delay 5 "$LIVE_URL?release=$CACHE_BUST" -o /tmp/gabi-radar-live.html
grep -F "DIVA Studio" /tmp/gabi-radar-live.html >/dev/null
grep -F "GABI_RADAR_PUBLIC_SAFE_V3" /tmp/gabi-radar-live.html >/dev/null
grep -F "marcas no universo mapeado" /tmp/gabi-radar-live.html >/dev/null
grep -F "Histórico de relacionamento:" /tmp/gabi-radar-live.html >/dev/null
for forbidden in \
  "CLIENT_SAFE_GABI v2" \
  "voz ativa" \
  "sem acesso ao bastidor interno" \
  "segunda inspeção client-safe" \
  "pacote mínimo de dados" \
  "clientSafeContext:" \
  "base sintetizada" \
  "Evidência recuperada:"; do
  ! grep -F "$forbidden" /tmp/gabi-radar-live.html >/dev/null
done
echo "GABI_RADAR_CLEAN_RELEASE=PASS"
