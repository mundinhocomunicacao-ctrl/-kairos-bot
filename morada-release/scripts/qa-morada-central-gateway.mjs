import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge=fs.readFileSync('src/backend/divaBridge.web.js','utf8');
const http=fs.readFileSync('src/backend/http-functions.js','utf8');

for(const token of [
  "DIVA_MORADA_GATEWAY_PRIVATE_KEY",
  "morada-wix",
  "https://os.mundinhocomunicacao.com/api/diva-gateway/execute",
  "x-diva-installation-id",
  "x-diva-signature",
  "x-diva-signature-alg",
  "ed25519"
]) assert.ok(bridge.includes(token),'Morada central gateway bridge missing '+token);

const synthStart=bridge.indexOf('async function synthesizeCouncil');
const runStart=bridge.indexOf('export async function runDivaBrainTransport');
assert.ok(synthStart>=0 && runStart>synthStart,'Morada council synthesis block missing');
const synthesis=bridge.slice(synthStart,runStart);

assert.ok(synthesis.includes('callGatewayContribution'),'canonical DIVA gateway must own final council synthesis');
assert.equal(synthesis.includes('callGeminiText'),false,'provider contributors must not own final synthesis');
assert.ok(bridge.includes("status: 'BRAIN_CANONICAL_SYNTHESIS_UNAVAILABLE'"),'Morada must fail closed if canonical synthesis is unavailable');
assert.ok(bridge.includes("finalProvider: 'DIVA_GATEWAY'"),'final authority must be the central DIVA gateway');
assert.ok(bridge.includes("circulation: 'OS_MALHA'"),'Morada must expose canonical OS/Malha circulation');
assert.ok(http.includes('runDivaBrainTransport'),'HTTP same-origin bridge must reuse governed brain transport');

console.log('QA_MORADA_CENTRAL_GATEWAY PASS · local providers may contribute, but final synthesis and repair return through the signed central DIVA gateway');
