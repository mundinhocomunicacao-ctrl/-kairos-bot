import fs from 'node:fs';
import assert from 'node:assert/strict';

const src=fs.readFileSync(new URL('./remote-wix-release.mjs',import.meta.url),'utf8');
for(const token of [
  'MUNDINHO_WIX_LIVE_SITE_ID',
  'MUNDINHO_WIX_LIVE_APP_ID',
  'wix.config.json',
  '@wix/cli@latest',
  "['release']",
  'ARTIFACT_RUNTIME_SHA_MISMATCH',
  'WIX_OS_LIVE_RELEASE_VERIFIED'
]) assert.ok(src.includes(token),'missing OS live release contract token: '+token);
assert.ok(!src.includes('PANDORA_MISSION_ENV_INCOMPLETE'),'OS Wix release bridge must not be gated by Pandora mission env');
console.log('QA_OS_WIX_REMOTE_LIVE_RELEASE PASS');
