import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');

for(const needle of [
  "req.url==='/mission'",
  "authority==='PANDORA'",
  "worldId==='MUNDO'",
  "canonicalKey==='MUNDO/MALHA/AWAKEN_BODY/V1'",
  "missionId==='MUNDO::MALHA_CORE::ANJOS7::UNLOCK::20260929'",
  "grantId==='PANDORA::MORADA::MUNDO::MALHA_CORE::ANJOS7::UNLOCK::20260929'",
  "sourceSurface==='MORADA_AUTOMATION'",
  "validation==='PANDORA_MISSION_AUTHORITY'",
  "buildAngelMission",
  "minimumAngels:7",
  "MORADA_PANDORA_MISSION_VERIFIED"
]) assert.ok(src.includes(needle),'missing governed mission ingress contract: '+needle);

console.log('MISSION_ENDPOINT_CONTRACT PASS');
