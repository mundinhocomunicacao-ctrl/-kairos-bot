import fs from 'node:fs';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('./exact-remote-release-ee6e4332.mjs',import.meta.url),'utf8');
for(const token of [
  'e14d631e53c26bcba36457adfa670037fb192a70',
  '86d4cdd2e5d76ef9d36ea5e49c5e69daf47d2c39',
  '68b46dabd6fa0191259225493350a35caea26567',
  'MUNDO_RUNTIME_ENV',
  'wix-live',
  '@wix/cli@latest',
  'release',
  'WIX_EXACT_LIVE_VERIFIED',
  'RELEASE_LOCK_PASS'
]) assert.ok(src.includes(token),'missing exact release token '+token);
console.log('QA_E14D_EXACT_WIX_RELEASE PASS');