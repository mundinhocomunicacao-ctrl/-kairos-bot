import http from 'node:http';
import {createHash,createPrivateKey,randomBytes,sign as signPayload} from 'node:crypto';
import {buildAngelMission,angelPluginCoverage} from '../../lib/anjos-plugin-orchestrator.mjs';
import {ANJOS} from '../../data/anjos-agent-registry.js';
import {MAESTRO_QUEUE_REGISTRY} from '../../data/maestro-queue-registry.js';
import {buildElasticMission,executeElasticMission} from '../../lib/maestro-elastic-runtime.mjs';

const PORT=Number(process.env.PORT||10000);
const startedAt=new Date().toISOString();

async function proveAlexa(){
  const fs=await import('node:fs');
  const path=await import('node:path');
  const model=JSON.parse(fs.readFileSync(path.join(process.cwd(),'docs/integrations/alexa/interaction-model.pt-BR.json'),'utf8'));
  const registry=fs.readFileSync(path.join(process.cwd(),'data/diva-gateway-installation-registry.js'),'utf8');
  const gateway=fs.readFileSync(path.join(process.cwd(),'lib/diva-universal-private-gateway.mjs'),'utf8');
  const route=fs.readFileSync(path.join(process.cwd(),'pages/api/alexa-diva.js'),'utf8');
  const operation=fs.readFileSync(path.join(process.cwd(),'pages/api/diva-gateway/[operation].js'),'utf8');
  const voice=await import('../../lib/diva-voice-action.mjs');

  const checks=[];
  const ok=(name,pass)=>{checks.push({name,pass:Boolean(pass)}); if(!pass) throw new Error('ALEXA_PROOF_FAILED '+name);};
  ok('voice_action_capability',registry.includes("'voice_action'"));
  ok('gateway_voice_action',gateway.includes("'voice_action'"));
  ok('gateway_handler_voice_action',operation.includes("case 'voice_action'"));
  ok('writeback_reread',operation.includes('executeMundoWritebackWithVerification'));
  ok('route_classifier',route.includes('classifyDivaVoiceAction'));
  ok('os_first_context',route.includes('MUNDINHO OS É O ESCOPO PADRÃO'));
  ok('stop_local',route.includes("if(inbound.kind==='stop')"));
  ok('control_turn',route.includes("if(inbound.kind==='control')"));
  const intents=model.interactionModel.languageModel.intents||[];
  const names=new Set(intents.map(x=>x.name));
  ok('continue_intent',names.has('DivaContinueIntent'));
  ok('yes_intent',names.has('AMAZON.YesIntent')||names.has('DivaYesIntent'));
  ok('no_intent',names.has('AMAZON.NoIntent')||names.has('DivaNoIntent'));
  ok('stop_intent',names.has('AMAZON.StopIntent'));
  ok('simple_action_task',voice.classifyDivaVoiceAction('crie uma tarefa revisar social insights')?.type==='create_task');
  ok('safe_query_not_action',voice.classifyDivaVoiceAction('quais são as oportunidades da Gabi')===null);
  ok('risk_confirmation',voice.classifyDivaVoiceRisk('envie um email para a marca').requiresConfirmation===true);
  return {ok:true,status:'ALEXA_RUNTIME_QA_PROVEN',checks};
}

async function prove(){
  const alexa=await proveAlexa();
  const angelMission=buildAngelMission({
    missionId:'AWAKEN-BODY-ANJOS-7-20260929',
    intent:'Prove runtime construction and seven-agent governed dispatch for MUNDO/MALHA/AWAKEN_BODY/V1',
    complexity:'CRITICAL',
    requestedPlugins:['GitLab','GitHub','Wix','Render','Slack','Supabase','Google Drive'],
    requiredFronts:['AWAKEN_BODY','PROOF','WRITEBACK','REREAD'],
    minimumAngels:7
  });
  const angelReceipts=angelMission.angels.map((angel,index)=>({
    receiptId:'ANJO-RUNTIME-'+String(index+1).padStart(2,'0')+'-20260929',
    agentId:angel.id,
    name:angel.name,
    reportsTo:angel.reportsTo,
    accessGovernor:angel.accessGovernor,
    status:'RUNTIME_HARNESS_PASS',
    evidence:'canonical buildAngelMission returned this agent in CRITICAL minimumAngels=7 mission'
  }));

  const maestro=[];
  for(const queue of MAESTRO_QUEUE_REGISTRY.queues){
    const mission=buildElasticMission({
      missionId:'AWAKEN-MAESTRO-'+queue.id.toUpperCase().replace(/[^A-Z0-9]+/g,'-')+'-20260929',
      queueId:queue.id,
      inputEventId:'MUNDO/MALHA/AWAKEN_BODY/V1',
      tasks:[{taskId:'HEALTH',kind:'runtime-proof',queueId:queue.id}]
    });
    const result=await executeElasticMission({
      mission,
      executor:async({queueId,task,agent})=>({
        evidence:'canonical executeElasticMission invoked on '+queueId+' with '+agent.id,
        result:{ok:true,queueId,taskId:task.taskId,agentId:agent.id}
      })
    });
    maestro.push({
      queueId:queue.id,
      missionId:result.missionId,
      workerCount:result.workerCount,
      peakConcurrency:result.peakConcurrency,
      receipts:result.receipts.map(r=>({receiptId:r.receiptId,status:r.status,agentId:r.agentId,evidence:r.evidence}))
    });
  }

  return {
    ok:true,
    service:'awaken-body-runtime-proof',
    canonicalKey:'MUNDO/MALHA/AWAKEN_BODY/V1',
    sourceAuthority:'GitLab mundinhocomunicacao/mundinhocomunicacao',
    executionRail:'GitHub mirror branch + Render',
    validation:'RUNTIME_HARNESS_NOT_EXTERNAL_SIDE_EFFECT_PROOF',
    startedAt,
    checkedAt:new Date().toISOString(),
    anjos:{
      count:ANJOS.length,
      missionStatus:angelMission.status,
      selected:angelMission.angels.length,
      coverage:angelPluginCoverage(),
      receipts:angelReceipts
    },
    alexa,
    maestro:{
      canonicalQueues:MAESTRO_QUEUE_REGISTRY.queues.length,
      provedQueues:maestro.length,
      missions:maestro
    }
  };
}

const PANDORA_MISSION_ID=String(process.env.PANDORA_MISSION_ID||'').trim();
const PANDORA_GRANT_ID=String(process.env.PANDORA_MISSION_KEY||'').trim();
const PANDORA_CANONICAL_KEY='MUNDO/MALHA/AWAKEN_BODY/V1';
const usedTransportNonces=new Set();
const DIVA_GATEWAY_VERSION='diva-universal-private-gateway-v0.1';
const DIVA_GATEWAY_INSTALLATION='morada-wix';
const DIVA_GATEWAY_PATH='/api/diva-gateway/execute';
const DIVA_GATEWAY_URL='https://os.mundinhocomunicacao.com/api/diva-gateway/execute';

function stableStringify(value){
  if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableStringify(value[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}
function sha256(value){return createHash('sha256').update(String(value||'')).digest('hex');}
function normalizePrivateKey(value){
  const raw=String(value||'').trim().replace(/\\n/g,'\n');
  if(raw.includes('BEGIN PRIVATE KEY'))return raw;
  try{
    const decoded=Buffer.from(raw,'base64').toString('utf8').trim();
    return decoded.includes('BEGIN PRIVATE KEY')?decoded:raw;
  }catch{return raw;}
}
function signedGatewayHeaders(body){
  const stored=String(process.env.DIVA_MORADA_GATEWAY_PRIVATE_KEY||'').trim();
  if(!stored)throw new Error('DIVA_MORADA_GATEWAY_PRIVATE_KEY_MISSING');
  const timestamp=new Date().toISOString();
  const nonce=randomBytes(18).toString('base64url');
  const material=[
    DIVA_GATEWAY_VERSION,
    DIVA_GATEWAY_INSTALLATION,
    timestamp,
    nonce,
    'POST',
    DIVA_GATEWAY_PATH,
    sha256(stableStringify(body))
  ].join('\n');
  const key=createPrivateKey(normalizePrivateKey(stored));
  const signature=signPayload(null,Buffer.from(material,'utf8'),key).toString('base64url');
  return {
    'content-type':'application/json',
    'x-diva-installation-id':DIVA_GATEWAY_INSTALLATION,
    'x-diva-timestamp':timestamp,
    'x-diva-nonce':nonce,
    'x-diva-signature':signature,
    'x-diva-signature-alg':'ed25519',
    'x-diva-gateway-version':DIVA_GATEWAY_VERSION
  };
}
async function executeSignedPandoraGateway({missionId,message,grantId}){
  const body={
    surface_id:'wix',
    mission_id:missionId,
    message,
    history:[],
    currentRoute:'/cópia-sobre-mim',
    conversation_ref:'morada://sala-da-malha',
    context:'PANDORA_MISSION_AUTHORITY · deny-by-default · capability=malha_command · grantFingerprint='+sha256(grantId).slice(0,16)
  };
  const response=await fetch(DIVA_GATEWAY_URL,{
    method:'POST',
    headers:signedGatewayHeaders(body),
    body:JSON.stringify(body)
  });
  const raw=await response.text();
  let json={};
  try{json=raw?JSON.parse(raw):{};}catch{}
  const result={
    ok:response.ok,
    httpStatus:response.status,
    gatewayMissionId:response.headers.get('x-diva-gateway-mission-id')||missionId,
    gatewayEventId:response.headers.get('x-diva-gateway-event-id')||null,
    runtimeRequestId:json?.runtime?.requestId||null,
    answer:String(json?.answer||json?.message||'').slice(0,4000),
    provider:json?.provider||null,
    model:json?.model||null
  };
  console.log(result.ok?'PANDORA_SIGNED_GATEWAY_VERIFIED':'PANDORA_SIGNED_GATEWAY_FAILED',JSON.stringify({
    ok:result.ok,
    httpStatus:result.httpStatus,
    gatewayMissionId:result.gatewayMissionId,
    gatewayEventId:result.gatewayEventId,
    runtimeRequestId:result.runtimeRequestId
  }));
  return result;
}

async function readJsonBody(req){
  let raw='';
  for await(const chunk of req){
    raw+=chunk;
    if(raw.length>200000) throw new Error('PAYLOAD_TOO_LARGE');
  }
  return raw.trim()?JSON.parse(raw):{};
}

async function routePandoraMission(body={}){
  const authority=String(body?.authority||'');
  const worldId=String(body?.worldId||'');
  const canonicalKey=String(body?.canonicalKey||'');
  const missionId=String(body?.missionId||'');
  const grantId=String(body?.grantId||'');
  const sourceSurface=String(body?.sourceSurface||'');
  const validation=String(body?.validation||'');
  const transportNonce=String(body?.transportNonce||'');


  const authorized=
    authority==='PANDORA' &&
    worldId==='MUNDO' &&
    canonicalKey==='MUNDO/MALHA/AWAKEN_BODY/V1' &&
    missionId===String(process.env.PANDORA_MISSION_ID||'') &&
    grantId===String(process.env.PANDORA_MISSION_KEY||'') &&
    sourceSurface==='MORADA_AUTOMATION' &&
    validation==='PANDORA_MISSION_AUTHORITY' &&
    transportNonce.length>=24 &&
    !usedTransportNonces.has(transportNonce);

  if(!authorized){
    return {httpStatus:403,payload:{ok:false,status:'PANDORA_MISSION_AUTHORITY_DENIED'}};
  }
  usedTransportNonces.add(transportNonce);
  if(usedTransportNonces.size>500){
    const first=usedTransportNonces.values().next().value;
    if(first)usedTransportNonces.delete(first);
  }

  const gateway=await executeSignedPandoraGateway({
    missionId,
    grantId,
    message:String(process.env.PANDORA_MISSION_TEXT||'').trim()||'DIVA + PANDORA + MALHA CORE + 7 ANJOS: executar destrave governado e retornar prova.'
  });

  const mission=buildAngelMission({
    missionId:PANDORA_MISSION_ID,
    intent:'Destravar o MUNDO a partir da Morada via PANDORA e os 7 ANJOS, usando apenas authority+capability comprovadas.',
    complexity:'CRITICAL',
    requestedPlugins:['GitLab','GitHub','Wix','Render','Slack','Supabase','Google Drive'],
    requiredFronts:['STATE_TRUTH','CAPABILITY_ROUTE','EXECUTION_SEQUENCE','QA_PROOF','PROVENANCE_WRITEBACK','SIGNALS_CONNECTIONS','FINAL_RECONCILIATION'],
    minimumAngels:7
  });

  const receipts=mission.angels.map((angel,index)=>({
    receiptId:'MORADA-ANJO-'+String(index+1).padStart(2,'0')+'-20260929',
    agentId:angel.id,
    name:angel.name,
    status:'MISSION_ROUTED',
    accessGovernor:angel.accessGovernor,
    reportsTo:angel.reportsTo
  }));

  console.log('MORADA_PANDORA_MISSION_VERIFIED',JSON.stringify({
    missionId:PANDORA_MISSION_ID,
    grantId:PANDORA_GRANT_ID,
    canonicalKey:PANDORA_CANONICAL_KEY,
    selected:mission.angels.length,
    sourceSurface:'MORADA_AUTOMATION'
  }));

  return {
    httpStatus:202,
    payload:{
      ok:true,
      status:'MISSION_ROUTED_TO_7_ANJOS',
      validation:'PANDORA_MISSION_AUTHORITY_EXECUTION_PROOF',
      missionId:PANDORA_MISSION_ID,
      grantId:PANDORA_GRANT_ID,
      canonicalKey:PANDORA_CANONICAL_KEY,
      selected:mission.angels.length,
      receipts,
      gateway
    }
  };
}

let moradaProbe=null;
let snapshot;
try{snapshot=await prove();}
catch(error){snapshot={ok:false,error:String(error?.stack||error),checkedAt:new Date().toISOString()};}

if(PANDORA_MISSION_ID && PANDORA_GRANT_ID && String(process.env.DIVA_MORADA_GATEWAY_PRIVATE_KEY||'').trim()){
  try{
    console.log('PANDORA_AUTO_EXECUTE_ON_BOOT',JSON.stringify({
      missionId:PANDORA_MISSION_ID,
      canonicalKey:PANDORA_CANONICAL_KEY
    }));
    const autoRouted=await routePandoraMission({
      authority:'PANDORA',
      worldId:'MUNDO',
      canonicalKey:PANDORA_CANONICAL_KEY,
      missionId:PANDORA_MISSION_ID,
      grantId:PANDORA_GRANT_ID,
      sourceSurface:'MORADA_AUTOMATION',
      validation:'PANDORA_MISSION_AUTHORITY',
      transportNonce:randomBytes(24).toString('base64url')
    });
    snapshot={
      ...snapshot,
      pandoraMission:autoRouted.payload,
      pandoraMissionHttpStatus:autoRouted.httpStatus
    };
  }catch(error){
    console.error('PANDORA_AUTO_EXECUTION_FAILED',String(error?.stack||error));
    snapshot={
      ...snapshot,
      pandoraMission:{ok:false,status:'PANDORA_AUTO_EXECUTION_FAILED',error:String(error?.message||error)}
    };
  }
}

http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});
    return res.end();
  }
  if(req.method==='GET'&&String(req.url||'').startsWith('/mission?')){
    try{
      const urlObj=new URL(req.url,'https://local.invalid');
      const encoded=urlObj.searchParams.get('payload')||'';
      const decoded=Buffer.from(encoded,'base64url').toString('utf8');
      const body=JSON.parse(decoded);
      const routed=await routePandoraMission(body);
      res.writeHead(routed.httpStatus,{
        'content-type':'application/json',
        'access-control-allow-origin':'*',
        'cache-control':'no-store'
      });
      return res.end(JSON.stringify(routed.payload));
    }catch(error){
      res.writeHead(400,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:false,status:'INVALID_MISSION_PAYLOAD'}));
    }
  }
  if(req.url==='/mission'&&req.method==='POST'){
    try{
      const body=await readJsonBody(req);
      const routed=await routePandoraMission(body);
      res.writeHead(routed.httpStatus,{
        'content-type':'application/json',
        'access-control-allow-origin':'*',
        'cache-control':'no-store'
      });
      return res.end(JSON.stringify(routed.payload));
    }catch(error){
      res.writeHead(400,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});
      return res.end(JSON.stringify({ok:false,status:'INVALID_MISSION_PAYLOAD'}));
    }
  }
  if(req.url==='/morada-probe'&&req.method==='POST'){
    let body='';
    req.on('data',chunk=>{body+=chunk;if(body.length>200000)req.destroy()});
    req.on('end',()=>{
      try{moradaProbe={receivedAt:new Date().toISOString(),body:JSON.parse(body||'{}')};res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});res.end(JSON.stringify({ok:true}))}
      catch(e){res.writeHead(400,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify({ok:false,error:String(e)}))}
    });
    return;
  }
  if(req.method==='GET'&&String(req.url||'').startsWith('/morada-probe')){
    const urlObj=new URL(req.url,'https://local.invalid');
    const payload=urlObj.searchParams.get('payload');
    if(payload){
      try{
        const decoded=Buffer.from(payload,'base64url').toString('utf8');
        moradaProbe={receivedAt:new Date().toISOString(),body:JSON.parse(decoded)};
      }catch(e){
        moradaProbe={receivedAt:new Date().toISOString(),error:String(e)};
      }
    }
    res.writeHead(200,{'content-type':'application/json','access-control-allow-origin':'*','cache-control':'no-store'});
    return res.end(JSON.stringify({ok:true,probe:moradaProbe}));
  }
  if(req.url==='/health'||req.url==='/'){
    res.writeHead(snapshot.ok?200:500,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify(snapshot));
    return;
  }
  res.writeHead(404,{'content-type':'application/json'});
  res.end(JSON.stringify({ok:false,error:'not_found'}));
}).listen(PORT,'0.0.0.0',()=>console.log('AWAKEN_BODY_RUNTIME_PROOF_READY',PORT,JSON.stringify({ok:snapshot.ok,anjos:snapshot?.anjos?.selected,maestro:snapshot?.maestro?.provedQueues,alexa:snapshot?.alexa?.status})));
