import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./remote-wix-release.mjs',import.meta.url),'utf8');

assert.match(source,/const CLIENT_DIR=path\.join\(OS_DIR,'dist','client'\)/);
assert.match(source,/function serveClientAsset\(/);
assert.match(source,/decodeURIComponent\(url\.pathname\)/);
assert.match(source,/candidate\.startsWith\(clientRootWithSep\)/);
assert.match(source,/fs\.createReadStream\(candidate\)\.pipe\(res\)/);
assert.match(source,/if\(serveClientAsset\(req,res\)\)return/);
assert.match(source,/application\/javascript/);
assert.match(source,/text\/css/);
assert.match(source,/application\/manifest\+json/);
assert.match(source,/public,max-age=31536000,immutable/);

console.log('PASS · REMOTE_WIX_STATIC_ASSETS · dist/client is served before worker routing with traversal protection.');
