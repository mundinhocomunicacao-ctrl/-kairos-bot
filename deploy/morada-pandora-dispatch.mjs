import http from 'node:http';

const PORT=Number(process.env.PORT||10000);
const endpoint=String(process.env.MORADA_PANDORA_ENDPOINT||'https://www.especialistabrandingeinfluencia.com/_functions/pandoraMission').trim();

function need(name,max){
  const value=String(process.env[name]||'').trim().slice(0,max);
  if(!value)throw new Error(name+'_MISSING');
  return value;
}

let state={ok:false,status:'BOOTING'};

async function dispatch(){
  const missionId=need('PANDORA_MISSION_ID',200);
  const missionKey=need('PANDORA_MISSION_KEY',260);
  const triggerEventId=need('PANDORA_TRIGGER_EVENT_ID',220);
  const text=need('PANDORA_MISSION_TEXT',12000);
  const response=await fetch(endpoint,{
    method:'POST',
    headers:{'content-type':'application/json',accept:'application/json'},
    body:JSON.stringify({missionId,missionKey,triggerEventId,text}),
    redirect:'follow'
  });
  const raw=await response.text();
  let body={};
  try{body=raw?JSON.parse(raw):{}}catch{body={raw:raw.slice(0,2000)}}
  state={
    ok:response.ok&&body?.ok===true,
    status:body?.status||'PANDORA_DISPATCH_RESPONSE',
    httpStatus:response.status,
    missionId:body?.missionId||missionId,
    triggerEventId:body?.triggerEventId||triggerEventId,
    authority:body?.authority||null,
    gatewayMissionId:body?.gatewayMissionId||null,
    receiptId:body?.receiptId||null,
    body
  };
  console.log('PANDORA_DISPATCH_RESULT '+JSON.stringify(state));
}

http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(state));
}).listen(PORT,'0.0.0.0',()=>{
  console.log('DIVA_ROOT_MALHA_QA_EXECUTOR_READY');
  dispatch().catch(error=>{
    state={ok:false,status:'DISPATCH_ERROR',error:String(error?.message||error)};
    console.error('PANDORA_DISPATCH_RESULT '+JSON.stringify(state));
  });
});
