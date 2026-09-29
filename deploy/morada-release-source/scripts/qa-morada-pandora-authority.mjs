import assert from 'node:assert/strict';
import fs from 'node:fs';

const bridge=fs.readFileSync('src/backend/divaBridge.web.js','utf8');
const dataHook=fs.readFileSync('src/backend/data.js','utf8');

for(const needle of [
  "PANDORA_AUTHORITY_EVENT = 'diva.morada.pandora.mission.authority'",
  "AUTHORIZED_REREAD_VERIFIED",
  "PANDORA_MISSION_AUTHORITY",
  "MORADA_BACKEND_MACHINE",
  "payload.denyByDefault === true",
  "payload.rereadVerified === true",
  "expiresAt > now",
  "capabilities.includes(requestedCapability)",
  "capability: 'malha_command'",
  "conversation_ref: 'morada://sala-da-malha'",
  "sendPandoraMissionToMalha"
]) assert.ok(bridge.includes(needle),'missing Pandora authority contract: '+needle);

assert.equal(bridge.includes('BEGIN PRIVATE KEY'),false,'private key material must never be embedded');
assert.ok(bridge.includes("DIVA_MORADA_GATEWAY_PRIVATE_KEY"),'gateway must continue to use backend secret reference');
assert.ok(bridge.includes("export const askDiva = webMethod("),'owner brain path must remain present');
assert.ok(bridge.includes('sendPandoraMissionToMalhaInternal'),'internal Pandora executor must exist');
for(const needle of [
  'DIVA_MEMORY_WRITEBACK_V1_afterInsert',
  "diva.morada.pandora.mission.execute",
  "EXECUTE_REQUESTED",
  'sendPandoraMissionToMalhaInternal',
  'suppressHooks: true',
  'PANDORA_MACHINE_EXECUTION_PROOF'
]) assert.ok(dataHook.includes(needle),'missing Pandora ledger hook contract: '+needle);

console.log('QA_MORADA_PANDORA_AUTHORITY PASS');
