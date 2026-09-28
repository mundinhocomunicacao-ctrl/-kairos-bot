#!/usr/bin/env bash
set -euo pipefail

SOURCE_SHA="68b46dabd6fa0191259225493350a35caea26567"
MIRROR_SHA="de8568fa10a42aae6cd25abb532f47a1c3ac27ec"
RELEASE_ID="wix-live-68b46dab"
ROOT="${RENDER_PROJECT_DIR:-$PWD}"
OS_DIR="$ROOT/os"
PROOF="$OS_DIR/.wix-prebuilt-68b46dab.json"

if [[ "${MUNDINHO_RENDER_PREBUILD_HEAL:-0}" != "1" ]]; then
  return 0 2>/dev/null || exit 0
fi

# Runtime bash shells inherit BASH_ENV too. A valid proof means the build phase
# already completed, so remain silent to avoid contaminating command stdout.
if [[ -f "$PROOF" ]]; then
  return 0 2>/dev/null || exit 0
fi

echo "ANJO_BUILD_HEAL_START source=$SOURCE_SHA mirror=$MIRROR_SHA"
cd "$ROOT"
git submodule sync --recursive
git submodule update --init --recursive os

actual_mirror="$(git -C os rev-parse HEAD)"
[[ "$actual_mirror" == "$MIRROR_SHA" ]] || { echo "ANJO_BUILD_HEAL_MIRROR_MISMATCH $actual_mirror" >&2; exit 31; }
actual_source="$(tr -d '\n' < os/.release-source/canonical-sha.txt)"
[[ "$actual_source" == "$SOURCE_SHA" ]] || { echo "ANJO_BUILD_HEAL_SOURCE_MISMATCH $actual_source" >&2; exit 32; }

cd "$OS_DIR"
npm ci --ignore-scripts
NODE_ENV=production MUNDO_RUNTIME_SOURCE_SHA="$SOURCE_SHA" MUNDO_RUNTIME_ENV=wix-live npm exec vite -- build --minify false
NODE_ENV=production MUNDO_RUNTIME_SOURCE_SHA="$SOURCE_SHA" MUNDO_RUNTIME_ENV=wix-live node scripts/package-wix-worker.mjs

ENTRY="$OS_DIR/dist/wix-server/entry.mjs"
test -f "$ENTRY"
grep -F "$SOURCE_SHA" "$ENTRY" >/dev/null
grep -F "wix-live" "$ENTRY" >/dev/null
grep -F "$RELEASE_ID" "$ENTRY" >/dev/null

printf '%s\n' "{\"ok\":true,\"sourceSha\":\"$SOURCE_SHA\",\"mirrorSha\":\"$MIRROR_SHA\",\"runtimeEnv\":\"wix-live\",\"releaseId\":\"$RELEASE_ID\",\"builder\":\"render-build-phase-vite-direct\"}" > "$PROOF"
echo "ANJO_BUILD_HEAL_PASS source=$SOURCE_SHA mirror=$MIRROR_SHA release=$RELEASE_ID"
cd "$ROOT"
return 0 2>/dev/null || exit 0
