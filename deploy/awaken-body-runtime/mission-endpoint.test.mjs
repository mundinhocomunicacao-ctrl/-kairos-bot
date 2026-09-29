import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('./runner.mjs',import.meta.url),'utf8');

for(const needle of [
  "req.url==='/mission'",
  "startsWith('/mission?')",
  "process.env.PANDORA_MORADA_NONCE",
  "transportNonce===expectedNonce",
  "authority==='PANDORA'",
  "worldId==='MUNDO'",
  "canonicalKey==='MUNDO/MALHA/AWAKEN_BODY/V1'",
  "missionId===String(process.env.PANDORA_MISSION_ID||'')",
  "grantId===String(process.env.PANDORA_MISSION_KEY||'')",
  "sourceSurface==='MORADA_AUTOMATION'",
  "validation==='PANDORA_MISSION_AUTHORITY'",
  "DIVA_MORADA_GATEWAY_PRIVATE_KEY",
  "x-diva-signature",
  "ed25519",
  "https://os.mundinhocomunicacao.com/api/diva-gateway/execute",
  "PANDORA_SIGNED_GATEWAY_VERIFIED",
  "buildAngelMission",
  "minimumAngels:7",
  "MORADA_PANDORA_MISSION_VERIFIED"
]) assert.ok(src.includes(needle),'missing governed mission ingress contract: '+needle);

assert.equal(src.includes("grantId==='PANDORA::MORADA::"),false,'deterministic Pandora grant must not remain accepted');
assert.equal(src.includes('-----BEGIN PRIVATE KEY-----'),false,'private key PEM must never be embedded');

console.log('MISSION_ENDPOINT_CONTRACT PASS');
