import assert from 'node:assert/strict';
import {buildGabiIntentEvent,normalizeGabiIntentPayload,GABI_INTENT_VERSION} from '../lib/gabi-intent-writeback.mjs';

assert.equal(GABI_INTENT_VERSION,'gabi-intent-v1');

const normalized=normalizeGabiIntentPayload({
  brands:['Nike','Nike','Rare Beauty','  '],
  media:['Vogue Brasil','Forbes Brasil'],
  contentGoal:'Quero criar vídeos sobre vida adulta e Brasil ↔ EUA.',
  contentFormats:['vlog','câmera frontal'],
  consent:true
});
assert.deepEqual(normalized.brands,['Nike','Rare Beauty']);
assert.deepEqual(normalized.media,['Vogue Brasil','Forbes Brasil']);
assert.deepEqual(normalized.contentFormats,['vlog','câmera frontal']);
assert.equal(normalized.consent,true);

const built=buildGabiIntentEvent({
  payload:normalized,
  sessionId:'session-123',
  submittedAt:'2026-09-30T13:55:00.000Z'
});
assert.equal(built.event.event_type,'gabi.intent.self_reported');
assert.deepEqual(built.event.entity_ids,['talent:gabriella-saraivah']);
assert.equal(built.event.new_state.destination,'workspace');
assert.equal(built.event.new_state.kind,'observation');
assert.equal(built.event.new_state.payload.intentType,'GABI_INTENT');
assert.equal(built.event.new_state.payload.outreachAuthorized,false);
assert.equal(built.event.author_status,'unverified');
assert.match(built.event.idempotency_key,/^gabi-intent:/);
assert.equal(JSON.stringify(built).includes('email'),false);
assert.equal(JSON.stringify(built).includes('phone'),false);

assert.throws(
  ()=>normalizeGabiIntentPayload({brands:['Nike'],consent:false}),
  /GABI_INTENT_EXPLICIT_CONSENT_REQUIRED/
);

console.log('PASS · GABI_INTENT · explicit consent + internal writeback + no autonomous outreach');
