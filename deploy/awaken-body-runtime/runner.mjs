import http from 'node:http';
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

let moradaProbe=null;
let snapshot;
try{snapshot=await prove();}
catch(error){snapshot={ok:false,error:String(error?.stack||error),checkedAt:new Date().toISOString()};}

http.createServer((req,res)=>{
  if(req.method==='OPTIONS'){
    res.writeHead(204,{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'content-type'});
    return res.end();
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
  if(req.url==='/morada-probe'&&req.method==='GET'){
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
