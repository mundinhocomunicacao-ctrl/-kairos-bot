import http from 'node:http';
import {buildAngelMission,angelPluginCoverage} from '../../lib/anjos-plugin-orchestrator.mjs';
import {ANJOS} from '../../data/anjos-agent-registry.js';
import {MAESTRO_QUEUE_REGISTRY} from '../../data/maestro-queue-registry.js';
import {buildElasticMission,executeElasticMission} from '../../lib/maestro-elastic-runtime.mjs';

const PORT=Number(process.env.PORT||10000);
const startedAt=new Date().toISOString();

async function prove(){
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
    maestro:{
      canonicalQueues:MAESTRO_QUEUE_REGISTRY.queues.length,
      provedQueues:maestro.length,
      missions:maestro
    }
  };
}

let snapshot;
try{snapshot=await prove();}
catch(error){snapshot={ok:false,error:String(error?.stack||error),checkedAt:new Date().toISOString()};}

http.createServer((req,res)=>{
  if(req.url==='/health'||req.url==='/'){
    res.writeHead(snapshot.ok?200:500,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify(snapshot));
    return;
  }
  res.writeHead(404,{'content-type':'application/json'});
  res.end(JSON.stringify({ok:false,error:'not_found'}));
}).listen(PORT,'0.0.0.0',()=>console.log('AWAKEN_BODY_RUNTIME_PROOF_READY',PORT,JSON.stringify({ok:snapshot.ok,anjos:snapshot?.anjos?.selected,maestro:snapshot?.maestro?.provedQueues})));
