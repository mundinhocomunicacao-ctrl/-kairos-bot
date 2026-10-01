import crypto from 'node:crypto';
import {buildMundoContextPackage} from '../../../lib/mundo-context-package.mjs';
import {ingestUniversalCapture} from '../../../lib/mundo-universal-ingestion.mjs';
import {
  buildMundoWritebackEvent,
  executeMundoWritebackWithVerification,
  rereadMundoWriteback
} from '../../../lib/mundo-writeback.mjs';
import {resolveSessionSecret} from '../../../lib/session-secret-bootstrap-node.mjs';
import {classifyDivaVoiceAction,buildDivaVoiceActionWriteback,buildDivaVoiceActionSpeech} from '../../../lib/diva-voice-action.mjs';
import {
  appendGatewayMissionControlEvent,
  getGatewayMissionRegistryCapability,
  resolveGatewayMissionForRequest
} from '../../../lib/diva-gateway-mission-registry.mjs';
import {
  DIVA_UNIVERSAL_GATEWAY_VERSION,
  DIVA_UNIVERSAL_GATEWAY_OPERATIONS,
  assertDivaGatewayMission,
  authenticateDivaGatewayRequestAsync,
  buildDivaGatewayEnvelope,
  getDivaGatewayCapability
} from '../../../lib/diva-universal-private-gateway.mjs';
import {
  MORADA_DIVA_PARITY_VERSION,
  buildMoradaDivaParityFrame,
  serializeMoradaDivaParityFrame
} from '../../../lib/morada-diva-parity.mjs';
import {persistMoradaEpisode} from '../../../lib/morada-episodic-memory.mjs';

const OPERATIONS=new Set(DIVA_UNIVERSAL_GATEWAY_OPERATIONS);

function safe(value,limit=12000){
  const text=String(value??'');
  return Array.from(text).slice(0,limit).join('');
}
function json(res,status,payload){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Diva-Gateway-Version',DIVA_UNIVERSAL_GATEWAY_VERSION);
  return res.status(status).json(payload);
}
function actorFrom(auth){return{email:auth.actor_id,id:auth.actor_id};}
function operationFrom(req){
  const raw=Array.isArray(req.query?.operation)?req.query.operation[0]:req.query?.operation;
  return safe(raw,80).trim();
}
function signedPath(operation){return `/api/diva-gateway/${operation}`;}
function missionEventId(body,envelope){
  return safe(body?.target_event_id||body?.persisted_event_id||body?.receipt_event_id||envelope?.event_id,240).trim();
}
function trimHistory(history){
  return (Array.isArray(history)?history:[]).slice(-12).map(row=>{
    if(!row||!['user','assistant'].includes(row.role))return null;
    const content=safe(row.content,1800).trim();
    return content?{role:row.role,content}:null;
  }).filter(Boolean);
}

export function mintGatewaySessionCookie({actorId,installationId,env=process.env,nowMs=Date.now()}={}){
  const secret=resolveSessionSecret(env);
  if(!secret)return null;
  const payload={
    email:String(actorId||'').trim().toLowerCase(),
    authMethod:'diva-universal-private-gateway',
    gatewayInstallationId:String(installationId||'').trim(),
    exp:nowMs+120000
  };
  const body=Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature=crypto.createHmac('sha256',secret).update(body).digest('base64url');
  return `mundinho_session=${encodeURIComponent(body+'.'+signature)}`;
}

async function executeCanonicalDiva({req,res,auth,envelope,body,missionContinuity,missionControl}){
  const {default:aiBridgeHandler}=await import('../ai-bridge.js');
  const cookie=mintGatewaySessionCookie({actorId:auth.actor_id,installationId:auth.installation_id});
  if(!cookie)return json(res,503,{ok:false,error:'canonical_session_unavailable',event_id:envelope.event_id,mission_id:envelope.mission_id});
  const message=safe(body.message||body.query,12000);
  const moradaParityFrame=auth.installation_id==='morada-wix'
    ?buildMoradaDivaParityFrame({
      message,
      missionId:envelope.mission_id,
      currentHead:process.env.VERCEL_GIT_COMMIT_SHA||process.env.GIT_COMMIT_SHA||null,
      preferredSurface:envelope.surface_id
    })
    :null;
  const moradaEpisodeReceipt=moradaParityFrame
    ?await persistMoradaEpisode({
      message,
      missionId:envelope.mission_id,
      eventId:envelope.event_id,
      actor:actorFrom(auth)
    })
    :null;

  let gatewayIngressPulse={status:'degraded',persisted:false,verified:false,reason:'not_attempted'};
  try{
    gatewayIngressPulse=await ingestUniversalCapture({
      text:message,
      attachments:Array.isArray(body.attachments)?body.attachments.slice(0,20):[],
      actor:actorFrom(auth),
      resolvedEntityIds:Array.isArray(body.resolved_entity_ids)?body.resolved_entity_ids.slice(0,50):[],
      source:'diva_universal_private_gateway',
      sourceId:envelope.event_id,
      channel:envelope.surface_id,
      signalInScope:true,
      signalType:'PULSE_CANDIDATE',
      observedAt:envelope.timestamp,
      evidenceIds:Array.isArray(body.evidence_ids)?body.evidence_ids.slice(0,100):[],
      extra:{
        mission_id:envelope.mission_id,
        installation_id:envelope.installation_id,
        surface_id:envelope.surface_id,
        event_class:'PULSE_CIRCULATION',
        circulation_origin:envelope.surface_id,
        circulation_route:['PANDORA','MALHA','KAIROS','ATENEU','DIVA_ROOT'],
        canonical_promotion:false
      }
    });
  }catch(error){
    gatewayIngressPulse={status:'degraded',persisted:false,verified:false,reason:safe(error?.message||error,360)};
    console.error('DIVA_GATEWAY_INGRESS_PULSE_FAIL',gatewayIngressPulse.reason);
  }
  const gatewayIngressPulseReceipt={
    status:gatewayIngressPulse?.status||'unknown',
    persisted:Boolean(gatewayIngressPulse?.persisted),
    verified:Boolean(gatewayIngressPulse?.verified),
    eventId:gatewayIngressPulse?.write?.eventId||gatewayIngressPulse?.event?.event_id||null,
    signalId:gatewayIngressPulse?.event?.new_state?.payload?.signal_passport?.signal_id||null,
    route:['PANDORA','MALHA','KAIROS','ATENEU','DIVA_ROOT'],
    canonicalPromotion:false
  };
  req.headers={...(req.headers||{}),cookie};
  req.body={
    ...body,
    moradaParityFrame,
    moradaEpisodeReceipt,
    gatewayIngressPulse:gatewayIngressPulseReceipt,
    gatewayMissionContinuity:missionContinuity,
    gatewayMissionControl:missionControl,
    message,
    history:trimHistory(body.history),
    currentRoute:safe(body.currentRoute||body.route||`/gateway/${envelope.surface_id}`,400),
    context:[
      serializeMoradaDivaParityFrame(moradaParityFrame),
      moradaEpisodeReceipt?`MORADA_EPISODIC_MEMORY=${JSON.stringify(moradaEpisodeReceipt)}`:'',
      `GATEWAY_INGRESS_PULSE=${JSON.stringify(gatewayIngressPulseReceipt)}`,
      safe(body.context,8000),
      `DIVA_UNIVERSAL_PRIVATE_GATEWAY ${DIVA_UNIVERSAL_GATEWAY_VERSION}`,
      `mission_id=${envelope.mission_id}`,
      `surface_id=${envelope.surface_id}`,
      `installation_id=${envelope.installation_id}`,
      `event_id=${envelope.event_id}`,
      'CONTEXTO: reconstruir apenas estado relevante; não tratar histórico da superfície como memória canônica.',
      'EPISTEMIA: PROVE BEFORE PROMOTE.'
    ].filter(Boolean).join('\n')
  };
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Diva-Gateway-Version',DIVA_UNIVERSAL_GATEWAY_VERSION);
  res.setHeader('X-Diva-Gateway-Mission-Id',envelope.mission_id);
  res.setHeader('X-Diva-Gateway-Event-Id',envelope.event_id);
  res.setHeader('X-Diva-Gateway-Installation-Id',envelope.installation_id);
  res.setHeader('X-Diva-Gateway-Mission-Mode',String(missionContinuity?.mode||'UNKNOWN'));
  res.setHeader('X-Diva-Gateway-Mission-Registry',missionControl?.persisted?'persisted':'partial');
  if(moradaParityFrame)res.setHeader('X-Diva-Morada-Parity',MORADA_DIVA_PARITY_VERSION);
  if(moradaEpisodeReceipt)res.setHeader('X-Diva-Morada-Memory',String(moradaEpisodeReceipt.status||'unknown'));
  res.setHeader('X-Diva-Gateway-Pulse',gatewayIngressPulseReceipt.verified?'verified':gatewayIngressPulseReceipt.status);
  if(gatewayIngressPulseReceipt.eventId)res.setHeader('X-Diva-Gateway-Pulse-Event-Id',gatewayIngressPulseReceipt.eventId);
  return aiBridgeHandler(req,res);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return json(res,405,{ok:false,error:'method_not_allowed'});

  const operation=operationFrom(req);
  if(!OPERATIONS.has(operation))return json(res,404,{ok:false,error:'unknown_operation'});

  let body=req.body&&typeof req.body==='object'&&!Array.isArray(req.body)?req.body:{};
  const auth=await authenticateDivaGatewayRequestAsync({
    headers:req.headers||{},
    method:'POST',
    path:signedPath(operation),
    body
  });
  if(!auth.ok){
    const status=auth.reason==='installation_secret_unavailable'?503:401;
    return json(res,status,{ok:false,error:auth.reason});
  }

  let missionContinuity={missionId:null,mode:'NONE',surfaceId:String(body.surface_id||body.surface||auth.surfaces?.[0]||'api'),previousSurfaceId:null};
  let missionControl={status:'skipped',persisted:false,reason:'operation_without_mission'};
  if(!['health','identify'].includes(operation)){
    try{
      missionContinuity=await resolveGatewayMissionForRequest({auth,body});
    }catch(error){
      return json(res,503,{ok:false,error:safe(error?.message||error,360),mission_continuity:{mode:'UNAVAILABLE',mission_id:null}});
    }
    if(!missionContinuity?.missionId){
      return json(res,409,{ok:false,error:missionContinuity?.reason||'active_mission_not_found',mission_continuity:{...missionContinuity,mission_id:null}});
    }
    body={...body,mission_id:missionContinuity.missionId};
  }

  try{assertDivaGatewayMission(operation,body);}
  catch(error){return json(res,400,{ok:false,error:String(error?.message||error)});}

  const envelope=buildDivaGatewayEnvelope({auth,operation,body});
  const actor=actorFrom(auth);

  if(!['health','identify'].includes(operation)){
    try{
      missionControl=await appendGatewayMissionControlEvent({
        missionId:envelope.mission_id,
        actorId:auth.actor_id,
        installationId:auth.installation_id,
        surfaceId:envelope.surface_id,
        conversationRef:body.conversation_ref||body.conversationRef||null,
        eventId:envelope.event_id,
        state:['RESUMED','REUSED'].includes(missionContinuity.mode)?'CONTINUED':'ACTIVE',
        nextAction:body.next_action||`CONTINUE_${operation.toUpperCase()}`,
        continuityMode:missionContinuity.mode,
        previousSurfaceId:missionContinuity.previousSurfaceId||null,
        contextId:body.context_id||null
      });
    }catch(error){
      missionControl={status:'failed',persisted:false,reason:safe(error?.message||error,360)};
    }
  }
  res.setHeader('X-Diva-Gateway-Mission-Mode',String(missionContinuity?.mode||'NONE'));
  res.setHeader('X-Diva-Gateway-Mission-Registry',missionControl?.persisted?'persisted':'partial');

  try{
    switch(operation){
      case 'health':
        return json(res,200,{ok:true,gateway:getDivaGatewayCapability(),mission_registry:getGatewayMissionRegistryCapability(),envelope});
      case 'identify':
        return json(res,200,{ok:true,identity:{actor_id:auth.actor_id,installation_id:auth.installation_id,surfaces:auth.surfaces,capabilities:auth.capabilities},mission_registry:getGatewayMissionRegistryCapability(),envelope});
      case 'open_context':{
        const history=trimHistory(body.history);
        const context=buildMundoContextPackage({
          query:safe(body.query||body.message,12000),
          history,
          body:{...body,currentRoute:safe(body.currentRoute||body.route||`/gateway/${envelope.surface_id}`,400)},
          actor,
          decisions:Array.isArray(body.decisions)?body.decisions.slice(-20):[],
          events:Array.isArray(body.events)?body.events.slice(-30):[],
          extraEvidence:[{type:'gateway_provenance',source:'diva_universal_private_gateway',installation_id:envelope.installation_id,surface_id:envelope.surface_id,mission_id:envelope.mission_id}]
        });
        return json(res,200,{ok:true,envelope,mission_continuity:{...missionContinuity,registry:missionControl},context_pack:context});
      }
      case 'event':{
        const result=await ingestUniversalCapture({
          text:safe(body.message||body.text||body.query,12000),
          attachments:Array.isArray(body.attachments)?body.attachments.slice(0,20):[],
          actor,
          resolvedEntityIds:Array.isArray(body.resolved_entity_ids)?body.resolved_entity_ids.slice(0,50):[],
          source:'diva_universal_private_gateway',
          sourceId:envelope.event_id,
          channel:envelope.surface_id,
          signalInScope:body.signal_in_scope===true,
          signalType:safe(body.signal_type||'observation',120),
          observedAt:body.observed_at||envelope.timestamp,
          evidenceIds:Array.isArray(body.evidence_ids)?body.evidence_ids.slice(0,100):[],
          extra:{mission_id:envelope.mission_id,installation_id:envelope.installation_id,surface_id:envelope.surface_id}
        });
        return json(res,result.verified||result.status==='ignored'?200:(result.persisted?502:503),{ok:Boolean(result.verified||result.status==='ignored'),envelope,mission_continuity:{...missionContinuity,registry:missionControl},result});
      }
      case 'execute':
        return executeCanonicalDiva({req,res,auth,envelope,body,missionContinuity,missionControl});
      case 'voice_action':{
        const voiceAction=classifyDivaVoiceAction(safe(body.message||body.query,12000));
        if(!voiceAction)return json(res,400,{ok:false,error:'voice_action_not_recognized',envelope,mission_continuity:{...missionContinuity,registry:missionControl}});
        const spec=buildDivaVoiceActionWriteback({action:voiceAction});
        const event=buildMundoWritebackEvent({
          destination:spec.destination,
          kind:spec.kind,
          actor,
          entityIds:Array.isArray(body.resolved_entity_ids)?body.resolved_entity_ids.slice(0,50):[],
          payload:{...spec.payload,mission_id:envelope.mission_id,installation_id:envelope.installation_id,surface_id:envelope.surface_id},
          evidenceIds:Array.isArray(body.evidence_ids)?body.evidence_ids.slice(0,100):[],
          source:'diva_voice_action',
          sourceId:safe(body.external_event_id||envelope.event_id,500),
          idempotencyKey:safe('voice:'+envelope.installation_id+':'+(body.external_event_id||envelope.event_id),500),
          confidence:1
        });
        const result=await executeMundoWritebackWithVerification({event});
        return json(res,result.verified?200:(result.persisted?502:503),{
          ok:result.verified,
          envelope,
          mission_continuity:{...missionContinuity,registry:missionControl},
          action:voiceAction,
          event_id:event.event_id,
          answer:buildDivaVoiceActionSpeech({action:voiceAction,verified:result.verified}),
          result
        });
      }
      case 'writeback':{
        const event=buildMundoWritebackEvent({
          destination:safe(body.destination,80),
          kind:safe(body.kind,80),
          actor,
          entityIds:Array.isArray(body.entity_ids)?body.entity_ids.slice(0,100):[],
          payload:{...(body.payload&&typeof body.payload==='object'&&!Array.isArray(body.payload)?body.payload:{}),mission_id:envelope.mission_id,installation_id:envelope.installation_id,surface_id:envelope.surface_id},
          evidenceIds:Array.isArray(body.evidence_ids)?body.evidence_ids.slice(0,100):[],
          source:'diva_universal_private_gateway',
          sourceId:envelope.event_id,
          idempotencyKey:safe(body.idempotency_key||`gateway:${envelope.installation_id}:${envelope.mission_id}:${envelope.event_id}`,500),
          confidence:body.confidence
        });
        const result=await executeMundoWritebackWithVerification({event});
        return json(res,result.verified?200:(result.persisted?502:503),{ok:result.verified,envelope,mission_continuity:{...missionContinuity,registry:missionControl},event_id:event.event_id,result});
      }
      case 'reread':{
        const eventId=missionEventId(body,envelope);
        if(!eventId)return json(res,400,{ok:false,error:'target_event_id_required',envelope});
        const reread=await rereadMundoWriteback({eventId});
        return json(res,reread?.found?200:404,{ok:Boolean(reread?.found),envelope,mission_continuity:{...missionContinuity,registry:missionControl},target_event_id:eventId,reread});
      }
      case 'receipt':{
        const eventId=missionEventId(body,envelope);
        if(!eventId)return json(res,400,{ok:false,error:'target_event_id_required',envelope});
        const reread=await rereadMundoWriteback({eventId});
        const verified=Boolean(reread?.found&&reread?.event?.event_id===eventId);
        return json(res,verified?200:404,{ok:verified,envelope,mission_continuity:{...missionContinuity,registry:missionControl},receipt:{event_id:eventId,verified,status:verified?'VERIFIED':'NOT_FOUND',reread}});
      }
      default:
        return json(res,404,{ok:false,error:'unknown_operation'});
    }
  }catch(error){
    return json(res,400,{ok:false,error:safe(error?.message||error,360),envelope});
  }
}
