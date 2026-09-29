import fs from 'node:fs';
import assert from 'node:assert/strict';

const bridge=fs.readFileSync('src/backend/divaBridge.web.js','utf8');
const http=fs.readFileSync('src/backend/http-functions.js','utf8');
const page=fs.readFileSync('src/pages/SOBRE MIM.c1dmp.js','utf8');
const identity=fs.readFileSync('src/backend/divaIdentity.js','utf8');
const council=fs.readFileSync('src/backend/divaCouncil.js','utf8');

for (const needle of [
  'DIVA_COUNCIL','callGatewayContribution','callGeminiText',
  'buildDivaIdentityPrompt','evaluateDivaSelfCheck','BRAIN_ALL_FAILED',
  "readSecretValue('ANTHROPIC-API-KEY')","readSecretValue('OPENAI_API_KEY')",
  "runtimePolicy.paid.includes('openai')","gpt-5.6-sol"
]) assert.ok(bridge.includes(needle),'bridge missing '+needle);

assert.ok(!bridge.includes("gpt-5.6-terra"),'stale OpenAI model remains');
assert.ok(bridge.includes('CHATGPT_VOICE_NATURAL_CONVERSATION'),'Morada conversational voice V3 reference missing');
assert.ok(bridge.includes('VOICE_CONVERSATION_STYLE'),'Morada shared voice style missing');
assert.ok(!bridge.includes('conversa com o Claude no chat'),'stale Claude-style language reference remains');
assert.ok(http.includes('DIVA_BRAIN_FAILURE_RECEIPT'),'failure receipt missing');
assert.ok(http.includes('receiptEventId: receipt?.pulseId || null'),'receipt correlation missing');
assert.ok(page.includes('createBrainSession'),'owner brain session missing');
assert.ok(page.includes("wixLocationFrontend.query?.divaBrain"),'session loop guard missing');
assert.ok(page.includes("#diva_brain="),'ephemeral fragment transport missing');
assert.ok(identity.includes('MODEL_IS_RESOURCE_NOT_IDENTITY'),'DIVA identity rule missing');
assert.ok(council.includes("mode: 'PARALLEL_ENSEMBLE'"),'council mode missing');
assert.ok(council.includes("'deepseek'") && council.includes("'openrouter'") && council.includes("'meta-llama'"),'inventory incomplete');

console.log('QA_MORADA_REAL_SOURCE_BRIDGE PASS');
