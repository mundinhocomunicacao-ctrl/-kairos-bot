import http from 'node:http';
import {createHash,createPrivateKey,randomBytes,sign as signPayload} from 'node:crypto';

const PORT=Number(process.env.PORT||10000);
const GATEWAY_VERSION='diva-universal-private-gateway-v0.1';
const INSTALLATION='morada-wix';
const GATEWAY_PATH='/api/diva-gateway/execute';
const GATEWAY_URL='https://os.mundinhocomunicacao.com/api/diva-gateway/execute';

function stableStringify(value){
  if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+stableStringify(value[k])).join(',')+'}';
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
function missionKeyFingerprint(value){return sha256(value).slice(0,16);}
function headersFor(body){
  const stored=String(process.env.DIVA_MORADA_GATEWAY_PRIVATE_KEY||'').trim();
  if(!stored)throw new Error('MORADA_PRIVATE_KEY_MISSING');
  const timestamp=new Date().toISOString();
  const nonce=randomBytes(18).toString('base64url');
  const material=[
    GATEWAY_VERSION,INSTALLATION,timestamp,nonce,'POST',GATEWAY_PATH,sha256(stableStringify(body))
  ].join('\n');
  const key=createPrivateKey(normalizePrivateKey(stored));
  const signature=signPayload(null,Buffer.from(material,'utf8'),key).toString('base64url');
  return {
    'content-type':'application/json',
    'x-diva-installation-id':INSTALLATION,
    'x-diva-timestamp':timestamp,
    'x-diva-nonce':nonce,
    'x-diva-signature':signature,
    'x-diva-signature-alg':'ed25519',
    'x-diva-gateway-version':GATEWAY_VERSION
  };
}
async function execute(){
  const missionId=String(process.env.PANDORA_MISSION_ID||'').trim();
  const missionKey=String(process.env.PANDORA_MISSION_KEY||'').trim();
  const message=String(process.env.PANDORA_MISSION_TEXT||'').trim();
  if(!missionId||!missionKey||!message)throw new Error('PANDORA_MISSION_ENV_INCOMPLETE');

  const body={
    surface_id:'wix',
    mission_id:missionId,
    message,
    history:[],
    currentRoute:'/cópia-sobre-mim',
    conversation_ref:'morada://sala-da-malha',
    context:'PANDORA_MISSION_AUTHORITY · deny-by-default · capability=malha_command · missionKeyFingerprint='+missionKeyFingerprint(missionKey)
  };
  const response=await fetch(GATEWAY_URL,{method:'POST',headers:headersFor(body),body:JSON.stringify(body)});
  const raw=await response.text();
  let json={};
  try{json=raw?JSON.parse(raw):{};}catch{}
  const result={
    phase:response.ok?'PANDORA_DIRECT_GATEWAY_VERIFIED':'PANDORA_DIRECT_GATEWAY_FAILED',
    ok:response.ok,
    httpStatus:response.status,
    missionId,
    missionKeyFingerprint:missionKeyFingerprint(missionKey),
    gatewayMissionId:response.headers.get('x-diva-gateway-mission-id')||missionId,
    gatewayEventId:response.headers.get('x-diva-gateway-event-id')||null,
    answer:String(json?.answer||json?.message||'').slice(0,4000),
    provider:json?.provider||null,
    model:json?.model||null,
    runtimeRequestId:json?.runtime?.requestId||null
  };
  console.log(result.phase+' '+JSON.stringify(result));
  return result;
}

let state={phase:'BOOTING',ok:false};
async function boot(){
  try{state=await execute();}
  catch(error){
    state={phase:'EXECUTOR_ERROR',ok:false,error:String(error?.message||error)};
    console.error('EXECUTOR_ERROR '+JSON.stringify(state));
  }
}
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state));
}).listen(PORT,'0.0.0.0',()=>console.log('PANDORA_DIRECT_GATEWAY_EXECUTOR_READY'));
void boot();
