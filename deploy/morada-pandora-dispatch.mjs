import http from 'node:http';

const PORT=Number(process.env.PORT||10000);
const ENDPOINT=String(process.env.MORADA_PANDORA_ENDPOINT||'https://www.especialistabrandingeinfluencia.com/_functions/pandoraMission').trim();

function required(name,max=12000){
  const value=String(process.env[name]||'').trim().slice(0,max);
  if(!value)throw new Error(name+'_MISSING');
  return value;
}

let state={phase:'BOOTING',ok:false};

async function dispatch(){
  const missionId=required('PANDORA_MISSION_ID',200);
  const missionKey=required('PANDORA_MISSION_KEY',260);
  const triggerEventId=required('PANDORA_TRIGGER_EVENT_ID',220);
  const text=required('PANDORA_MISSION_TEXT',12000);
  const body={missionId,missionKey,triggerEventId,text};

  const response=await fetch(ENDPOINT,{
    method:'POST',
    headers:{'content-type':'application/json','accept':'application/json'},
    body:JSON.stringify(body),
    redirect:'follow'
  });
  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{};}catch{data={raw:raw.slice(0,2000)}}
  state={
    phase:data?.status||'PANDORA_DISPATCH_RESPONSE',
    ok:response.ok&&data?.ok===true&&data?.status==='PANDORA_HTTP_EXECUTION_VERIFIED',
    httpStatus:response.status,
    missionId:data?.missionId||missionId,
    triggerEventId:data?.triggerEventId||triggerEventId,
    authority:data?.authority||null,
    gatewayMissionId:data?.gatewayMissionId||null,
    receiptId:data?.receiptId||null,
    responseStatus:data?.status||null,
    body:data
  };
  console.log('PANDORA_DISPATCH_RESULT '+JSON.stringify(state));
}

http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(state));
}).listen(PORT,'0.0.0.0',()=>{
  console.log('DIVA_ROOT_MALHA_DISPATCHER_READY');
  dispatch().catch(error=>{
    state={phase:'DISPATCH_ERROR',ok:false,error:String(error?.message||error)};
    console.error('PANDORA_DISPATCH_ERROR '+JSON.stringify(state));
  });
});
