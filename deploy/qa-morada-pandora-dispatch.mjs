import assert from 'node:assert/strict';
import fs from 'node:fs';

const file='deploy/morada-pandora-dispatch.mjs';
assert.ok(fs.existsSync(file),'dispatcher source missing');
const src=fs.readFileSync(file,'utf8');

for(const token of [
  'PANDORA_MISSION_ID',
  'PANDORA_MISSION_KEY',
  'PANDORA_TRIGGER_EVENT_ID',
  'PANDORA_MISSION_TEXT',
  '/_functions/pandoraMission',
  'PANDORA_HTTP_EXECUTION_VERIFIED',
  'receiptId',
  'gatewayMissionId'
]) assert.ok(src.includes(token),'missing dispatcher token '+token);

assert.ok(!src.includes('DIVA_MORADA_GATEWAY_PRIVATE_KEY'),'dispatcher must not carry Morada private key');
assert.ok(!src.includes('BEGIN PRIVATE KEY'),'dispatcher must not embed private key');

console.log('QA_MORADA_PANDORA_DISPATCH PASS');
