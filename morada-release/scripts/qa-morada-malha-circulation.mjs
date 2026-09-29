import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge=fs.readFileSync('src/backend/divaBridge.web.js','utf8');
const synthStart=bridge.indexOf('async function synthesizeCouncil');
const runStart=bridge.indexOf('export async function runDivaBrainTransport');
assert.ok(synthStart>=0 && runStart>synthStart,'Morada council synthesis block missing');
const synth=bridge.slice(synthStart,runStart);

assert.ok(synth.includes('callGatewayContribution'),'DIVA Raiz central gateway must own council synthesis');
assert.equal(synth.includes('callGeminiText'),false,'local provider must not own final council synthesis');
assert.ok(bridge.includes('BRAIN_CANONICAL_SYNTHESIS_UNAVAILABLE'),'Morada must fail closed when canonical OS synthesis is unavailable');
assert.ok(bridge.includes("finalProvider: 'DIVA_GATEWAY'"),'Morada response must expose central gateway as final authority');
assert.ok(bridge.includes("circulation: 'OS_MALHA'"),'Morada response must confirm OS/Malha circulation lane');

const repairIndex=bridge.indexOf('DIVA SELF-CHECK · CORREÇÃO');
assert.ok(repairIndex>0,'self-check repair missing');
const repairBlock=bridge.slice(Math.max(0,repairIndex-300),repairIndex+1200);
assert.ok(repairBlock.includes('callGatewayContribution'),'self-check repair must return through central DIVA gateway');
assert.ok(repairBlock.includes('final = repair'),'final receipt must correlate to the repaired gateway answer');

console.log('QA_MORADA_MALHA_CIRCULATION=PASS');
