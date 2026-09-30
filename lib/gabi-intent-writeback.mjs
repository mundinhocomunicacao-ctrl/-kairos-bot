import crypto from 'node:crypto';

export const GABI_INTENT_VERSION='gabi-intent-v1';
export const GABI_INTENT_ENTITY_ID='talent:gabriella-saraivah';

const clean=(value,max=600)=>String(value??'')
  .replace(/[\u0000-\u001f\u007f]/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .slice(0,max);

const uniq=(values,maxItems=20,maxLen=180)=>[...new Set(
  (Array.isArray(values)?values:[])
    .map(v=>clean(v,maxLen))
    .filter(Boolean)
)].slice(0,maxItems);

export function normalizeGabiIntentPayload(input={}){
  const consent=input?.consent===true;
  if(!consent)throw new Error('GABI_INTENT_EXPLICIT_CONSENT_REQUIRED');
  const brands=uniq(input.brands,20,160);
  const media=uniq(input.media,20,160);
  const contentFormats=uniq(input.contentFormats,12,120);
  const contentGoal=clean(input.contentGoal,800);
  const notes=clean(input.notes,800);
  if(!brands.length&&!media.length&&!contentFormats.length&&!contentGoal&&!notes){
    throw new Error('GABI_INTENT_EMPTY');
  }
  return Object.freeze({
    brands:Object.freeze(brands),
    media:Object.freeze(media),
    contentFormats:Object.freeze(contentFormats),
    contentGoal,
    notes,
    consent:true
  });
}

function fingerprint(value){
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0,20);
}

export function buildGabiIntentEvent({payload,sessionId='',submittedAt=null}={}){
  const normalized=normalizeGabiIntentPayload(payload);
  const session=clean(sessionId,160)||'anonymous-radar-session';
  const occurredAt=clean(submittedAt,80)||new Date().toISOString();
  const intentFingerprint=fingerprint({
    entity:GABI_INTENT_ENTITY_ID,
    session,
    brands:normalized.brands,
    media:normalized.media,
    contentFormats:normalized.contentFormats,
    contentGoal:normalized.contentGoal,
    notes:normalized.notes
  });
  const idempotencyKey='gabi-intent:'+intentFingerprint;
  const eventId='evt_'+crypto.createHash('sha256').update('gabi-intent-v1:'+idempotencyKey).digest('hex').slice(0,32);
  return Object.freeze({
    event:Object.freeze({
      event_id:eventId,
      event_type:'gabi.intent.self_reported',
      timestamp:occurredAt,
      source:'radar_gabi_anamnesis',
      source_id:'session:'+fingerprint(session),
      channel:'radar_gabi',
      author:null,
      author_status:'unverified',
      entity_ids:Object.freeze([GABI_INTENT_ENTITY_ID]),
      previous_state_ref:null,
      new_state:Object.freeze({
        destination:'workspace',
        kind:'observation',
        payload:Object.freeze({
          schema_version:GABI_INTENT_VERSION,
          intentType:'GABI_INTENT',
          selfReported:true,
          consentRecorded:true,
          outreachAuthorized:false,
          brands:normalized.brands,
          media:normalized.media,
          contentFormats:normalized.contentFormats,
          contentGoal:normalized.contentGoal||undefined,
          notes:normalized.notes||undefined
        })
      }),
      epistemic_class:'SELF_REPORTED_PREFERENCE',
      confidence:1,
      evidence_ids:Object.freeze(['radar_gabi_explicit_submission']),
      permissions:Object.freeze(['write:workspace']),
      created_by_runtime:GABI_INTENT_VERSION,
      deployment_sha:process.env.VERCEL_GIT_COMMIT_SHA||process.env.GIT_COMMIT_SHA||null,
      idempotency_key:idempotencyKey
    }),
    normalized
  });
}
