import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='deploy/morada-pandora-dispatch.mjs';
assert.ok(fs.existsSync(file),'dispatcher source missing');
const src=fs.readFileSync(file,'utf8');
for(const token of ['PANDORA_MISSION_ID','PANDORA_MISSION_KEY','PANDORA_TRIGGER_EVENT_ID','PANDORA_MISSION_TEXT','/_functions/pandoraMission','PANDORA_DISPATCH_RESULT']) {
  assert.ok(src.includes(token),'missing '+token);
}
assert.ok(!src.includes('DIVA_MORADA_GATEWAY_PRIVATE_KEY'),'must not carry private gateway key');
console.log('QA_MORADA_PANDORA_DISPATCH PASS');
