import assert from 'node:assert/strict';
import fs from 'node:fs';

const api=fs.readFileSync('pages/api/gabi-diva-studio.js','utf8');
const html=fs.readFileSync('radar-gabi-site/index.html','utf8');

for(const token of [
  "function isRadarQuestion",
  "mode:'answer'",
  "RADAR KNOWLEDGE",
  "projectGabiPublicContextRows",
  "routeOrbiProviderCandidates",
  "orbiId:'ORBI_GABI'",
  "faceId:'DIVA_GABI'"
]) assert.ok(api.includes(token),'Gabi ask-anything broker missing: '+token);

for(const token of [
  'Oi, eu sou a DIVA',
  'Pode me perguntar',
  'Como estão minhas propostas?',
  'Quais marcas estão mais perto de avançar?',
  'O que estão falando de mim?',
  'Me explica como funciona minha leitura de mídia',
  'O que a Mundinho está trabalhando por mim agora?',
  'function gabiRadarKnowledgeContext',
  "data-studio-intent=\"ask\"",
  "raw.mode==='answer'"
]) assert.ok(html.includes(token),'Gabi ask-anything UI/context missing: '+token);

assert.ok(html.includes('currentProposalCatalog'),'knowledge snapshot must reuse Radar proposal catalog');
assert.ok(html.includes('radarCommercialMetrics'),'knowledge snapshot must reuse Radar commercial metrics');
assert.ok(html.includes('latestClientSafeRows'),'knowledge snapshot must reuse live client-safe rows');
assert.equal(html.includes("fetch('/api/ai'"),false,'Gabi must not bypass isolated broker');
assert.ok(api.includes("CLIENT_SAFE_GABI"),'client-safe broker policy must remain');
assert.ok(api.includes("assertGabiClientSafeOutput"),'output scan must remain');

const privateTerms=['CONTATO','E-MAIL','WHATSAPP'];
const knowledgeStart=html.indexOf('function gabiRadarKnowledgeContext');
const knowledgeEnd=html.indexOf('function gabiStudioPushTurn',knowledgeStart);
const knowledgeFn=html.slice(knowledgeStart,knowledgeEnd);
for(const term of privateTerms){
  assert.equal(/\b(contact|email|phone|whatsapp)\s*:/i.test(knowledgeFn),false,'knowledge context may not serialize private field: '+term);
}

console.log('PASS · GABI_DIVA_ASK_ANYTHING · same ORBI/provider fabric + richer safe Radar knowledge');
