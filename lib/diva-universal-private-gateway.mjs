import crypto from 'node:crypto';
import {MUNDINHO_ALLOWED_EMAILS} from './session-token.mjs';
import {DIVA_GATEWAY_INSTALLATION_REGISTRY} from '../data/diva-gateway-installation-registry.js';
import {resolveDivaGatewaySecret} from './diva-gateway-secret-resolver.mjs';

export const DIVA_UNIVERSAL_GATEWAY_VERSION='diva-universal-private-gateway-v0.1';
export const DIVA_UNIVERSAL_GATEWAY_OPERATIONS=Object.freeze([
  'health','identify','open_context','event','execute','voice_action','writeback','reread','receipt'
]);
export const DIVA_UNIVERSAL_GATEWAY_REPLAY_WINDOW_MS=5*60*1000;

const ACTORS=new Set(MUNDINHO_ALLOWED_EMAILS.map(x=>String(x).toLowerCase()));
const OPERATIONS=new Set(DIVA_UNIVERSAL_GATEWAY_OPERATIONS);
const NONCES=globalThis.__DIVA_UNIVERSAL_GATEWAY_NONCES__||new Map();
globalThis.__DIVA_UNIVERSAL_GATEWAY_NONCES__=NONCES;

function stableStringify(value){
  if(Array.isArray(value))return `[${value.map(stableStringify).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value){return crypto.createHash('sha256').update(String(value||'')).digest('hex');}
function safeHexEqual(actual,expected){
  const a=Buffer.from(String(actual||''),'utf8');
  const b=Buffer.from(String(expected||''),'utf8');
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
}
function header(headers,name){
  if(headers?.get)return String(headers.get(name)||'').trim();
  const target=String(name).toLowerCase();
  for(const [k,v] of Object.entries(headers||{}))if(String(k).toLowerCase()===target)return String(v||'').trim();
  return '';
}
function cleanupNonces(nowMs){
  for(const [key,expiresAt] of NONCES)if(expiresAt<=nowMs)NONCES.delete(key);
}
function operationFromPath(path=''){
  const op=String(path).split('?')[0].split('/').filter(Boolean).at(-1)||'';
  return OPERATIONS.has(op)?op:null;
}
function parseRegistry(env,{requireSecret=true}={}){
  const raw=String(env?.DIVA_GATEWAY_REGISTRY_JSON||'').trim();
  let parsed=DIVA_GATEWAY_INSTALLATION_REGISTRY;
  if(raw){
    try{parsed=JSON.parse(raw)}catch{return{ok:false,reason:'registry_invalid_json',entries:{}}}
  }
  if(parsed?.installations&&typeof parsed.installations==='object'&&!Array.isArray(parsed.installations))parsed=parsed.installations;
  if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')return{ok:false,reason:'registry_invalid_shape',entries:{}};
  const entries={};
  for(const [installationId,row] of Object.entries(parsed)){
    if(!row||typeof row!=='object'||Array.isArray(row))continue;
    if(Object.prototype.hasOwnProperty.call(row,'secret'))continue;
    const actorId=String(row.actor_id||'').trim().toLowerCase();
    const authMethod=String(row.auth_method||'hmac_sha256').trim().toLowerCase();
    const secretEnv=String(row.secret_env||'').trim();
    const secret=secretEnv?String(env?.[secretEnv]||'').trim():'';
    const publicKeyPem=String(row.public_key_pem||'').trim();
    const surfaces=[...new Set((Array.isArray(row.surfaces)?row.surfaces:[]).map(String).map(x=>x.trim()).filter(Boolean))];
    const capabilities=[...new Set((Array.isArray(row.capabilities)?row.capabilities:[]).map(String).filter(x=>OPERATIONS.has(x)))];
    if(row.enabled===false||!ACTORS.has(actorId)||!surfaces.length||!capabilities.length)continue;
    if(authMethod==='ed25519'){
      if(!publicKeyPem.includes('BEGIN PUBLIC KEY')||Object.prototype.hasOwnProperty.call(row,'private_key_pem'))continue;
      entries[String(installationId)]={installation_id:String(installationId),actor_id:actorId,auth_method:'ed25519',public_key_pem:publicKeyPem,surfaces,capabilities};
      continue;
    }
    if(authMethod!=='hmac_sha256'||!/^DIVA_GATEWAY_SECRET_[A-Z0-9_]+$/.test(secretEnv)||(requireSecret&&!secret))continue;
    entries[String(installationId)]={installation_id:String(installationId),actor_id:actorId,auth_method:'hmac_sha256',secret_env:secretEnv,secret,surfaces,capabilities};
  }
  return Object.keys(entries).length?{ok:true,entries}:{ok:false,reason:'registry_has_no_active_installations',entries:{}};
}
function signatureMaterial({installationId,timestamp,nonce,method,path,body}){
  return [
    DIVA_UNIVERSAL_GATEWAY_VERSION,
    String(installationId||''),
    String(timestamp||''),
    String(nonce||''),
    String(method||'GET').toUpperCase(),
    String(path||''),
    digest(stableStringify(body??{}))
  ].join('\n');
}

export function signDivaGatewayRequest({installationId,secret,timestamp=new Date().toISOString(),nonce=crypto.randomUUID(),method='POST',path='/',body={}}={}){
  const material=signatureMaterial({installationId,timestamp,nonce,method,path,body});
  const signature=crypto.createHmac('sha256',String(secret||'')).update(material).digest('hex');
  return{
    'x-diva-installation-id':String(installationId||''),
    'x-diva-timestamp':String(timestamp),
    'x-diva-nonce':String(nonce),
    'x-diva-signature':signature,
    'x-diva-signature-alg':'hmac-sha256',
    'x-diva-gateway-version':DIVA_UNIVERSAL_GATEWAY_VERSION
  };
}

export function signDivaGatewayRequestEd25519({installationId,privateKeyPem,timestamp=new Date().toISOString(),nonce=crypto.randomUUID(),method='POST',path='/',body={}}={}){
  const material=signatureMaterial({installationId,timestamp,nonce,method,path,body});
  const privateKey=crypto.createPrivateKey(String(privateKeyPem||''));
  const signature=crypto.sign(null,Buffer.from(material,'utf8'),privateKey).toString('base64url');
  return{
    'x-diva-installation-id':String(installationId||''),
    'x-diva-timestamp':String(timestamp),
    'x-diva-nonce':String(nonce),
    'x-diva-signature':signature,
    'x-diva-signature-alg':'ed25519',
    'x-diva-gateway-version':DIVA_UNIVERSAL_GATEWAY_VERSION
  };
}

function verifyInstallationSignature(installation,{signature,material}={}){
  if(installation?.auth_method==='ed25519'){
    try{
      const publicKey=crypto.createPublicKey(installation.public_key_pem);
      return crypto.verify(null,Buffer.from(material,'utf8'),publicKey,Buffer.from(String(signature||''),'base64url'));
    }catch{return false;}
  }
  const expected=crypto.createHmac('sha256',installation.secret).update(material).digest('hex');
  return safeHexEqual(signature,expected);
}

export function authenticateDivaGatewayRequest({headers={},method='POST',path='/',body={},env=process.env,nowMs=Date.now()}={}){
  const installationId=header(headers,'x-diva-installation-id');
  const timestamp=header(headers,'x-diva-timestamp');
  const nonce=header(headers,'x-diva-nonce');
  const signature=header(headers,'x-diva-signature');
  if(!installationId||!timestamp||!nonce||!signature)return{ok:false,reason:'missing_gateway_auth'};
  const registry=parseRegistry(env);
  if(!registry.ok)return{ok:false,reason:registry.reason};
  const installation=registry.entries[installationId];
  if(!installation)return{ok:false,reason:'unknown_or_revoked_installation'};
  const operation=operationFromPath(path);
  if(!operation)return{ok:false,reason:'unknown_operation'};
  if(!installation.capabilities.includes(operation))return{ok:false,reason:'capability_denied'};
  const parsedTs=Date.parse(timestamp);
  if(!Number.isFinite(parsedTs)||Math.abs(nowMs-parsedTs)>DIVA_UNIVERSAL_GATEWAY_REPLAY_WINDOW_MS)return{ok:false,reason:'timestamp_outside_replay_window'};
  cleanupNonces(nowMs);
  const nonceKey=`${installationId}:${nonce}`;
  if(NONCES.has(nonceKey))return{ok:false,reason:'replay_detected'};
  const material=signatureMaterial({installationId,timestamp,nonce,method,path,body});
  if(!verifyInstallationSignature(installation,{signature,material}))return{ok:false,reason:'signature_invalid'};
  const surfaceId=String(body?.surface_id||body?.surface||'').trim();
  if(surfaceId&&!installation.surfaces.includes(surfaceId)&&!installation.surfaces.includes('*'))return{ok:false,reason:'surface_denied'};
  NONCES.set(nonceKey,nowMs+DIVA_UNIVERSAL_GATEWAY_REPLAY_WINDOW_MS);
  return{
    ok:true,
    actor_id:installation.actor_id,
    installation_id:installation.installation_id,
    surfaces:[...installation.surfaces],
    capabilities:[...installation.capabilities],
    operation,
    provenance:['diva_gateway_installation_registry',installation.auth_method==='ed25519'?'ed25519_public_key':'hmac_sha256','timestamp_and_nonce_replay_guard']
  };
}

export async function authenticateDivaGatewayRequestAsync({
  headers={},method='POST',path='/',body={},env=process.env,nowMs=Date.now(),fetchImpl=globalThis.fetch
}={}){
  const installationId=header(headers,'x-diva-installation-id');
  const timestamp=header(headers,'x-diva-timestamp');
  const nonce=header(headers,'x-diva-nonce');
  const signature=header(headers,'x-diva-signature');
  if(!installationId||!timestamp||!nonce||!signature)return{ok:false,reason:'missing_gateway_auth'};
  const registry=parseRegistry(env,{requireSecret:false});
  if(!registry.ok)return{ok:false,reason:registry.reason};
  const installation=registry.entries[installationId];
  if(!installation)return{ok:false,reason:'unknown_or_revoked_installation'};
  const operation=operationFromPath(path);
  if(!operation)return{ok:false,reason:'unknown_operation'};
  if(!installation.capabilities.includes(operation))return{ok:false,reason:'capability_denied'};
  const parsedTs=Date.parse(timestamp);
  if(!Number.isFinite(parsedTs)||Math.abs(nowMs-parsedTs)>DIVA_UNIVERSAL_GATEWAY_REPLAY_WINDOW_MS)return{ok:false,reason:'timestamp_outside_replay_window'};
  cleanupNonces(nowMs);
  const nonceKey=`${installationId}:${nonce}`;
  if(NONCES.has(nonceKey))return{ok:false,reason:'replay_detected'};
  if(installation.auth_method!=='ed25519'&&!installation.secret){
    try{installation.secret=await resolveDivaGatewaySecret(installation.secret_env,{env,fetchImpl});}
    catch{return{ok:false,reason:'installation_secret_unavailable'};}
  }
  const material=signatureMaterial({installationId,timestamp,nonce,method,path,body});
  if(!verifyInstallationSignature(installation,{signature,material}))return{ok:false,reason:'signature_invalid'};
  const surfaceId=String(body?.surface_id||body?.surface||'').trim();
  if(surfaceId&&!installation.surfaces.includes(surfaceId)&&!installation.surfaces.includes('*'))return{ok:false,reason:'surface_denied'};
  NONCES.set(nonceKey,nowMs+DIVA_UNIVERSAL_GATEWAY_REPLAY_WINDOW_MS);
  return{
    ok:true,
    actor_id:installation.actor_id,
    installation_id:installation.installation_id,
    surfaces:[...installation.surfaces],
    capabilities:[...installation.capabilities],
    operation,
    provenance:['diva_gateway_installation_registry',installation.auth_method==='ed25519'?'ed25519_public_key':'wix_secrets_manager_fallback',installation.auth_method==='ed25519'?'asymmetric_no_secret_copy':'hmac_sha256','timestamp_and_nonce_replay_guard']
  };
}

export function getDivaGatewayCapability({env=process.env}={}){
  const registry=parseRegistry(env);
  return{
    version:DIVA_UNIVERSAL_GATEWAY_VERSION,
    configured:registry.ok,
    reason:registry.ok?'ready':registry.reason,
    installation_count:registry.ok?Object.keys(registry.entries).length:0,
    operations:[...DIVA_UNIVERSAL_GATEWAY_OPERATIONS],
    auth:'per_installation_hmac_sha256_or_ed25519',
    replay_guard:'timestamp_plus_nonce_process_guard',
    secret_policy:'hmac_secret_env_or_ed25519_public_key_only_no_inline_private_key'
  };
}

export function buildDivaGatewayEnvelope({auth,operation,body={},eventId=null,timestamp=new Date().toISOString()}={}){
  if(!auth?.ok)throw new Error('DIVA_GATEWAY_AUTH_REQUIRED');
  if(!OPERATIONS.has(operation))throw new Error('DIVA_GATEWAY_OPERATION_INVALID');
  if(!auth.capabilities?.includes(operation))throw new Error('DIVA_GATEWAY_CAPABILITY_DENIED');
  const surfaceId=String(body.surface_id||body.surface||auth.surfaces?.[0]||'unknown').slice(0,160);
  const missionId=body.mission_id?String(body.mission_id).slice(0,200):null;
  const canonicalEventId=eventId||String(body.event_id||'').slice(0,240)||`gw_evt_${digest(`${auth.installation_id}:${missionId||'none'}:${operation}:${timestamp}:${stableStringify(body)}`).slice(0,32)}`;
  return{
    version:DIVA_UNIVERSAL_GATEWAY_VERSION,
    operation,
    actor_id:auth.actor_id,
    installation_id:auth.installation_id,
    surface_id:surfaceId,
    mission_id:missionId,
    event_id:canonicalEventId,
    timestamp,
    capabilities:[...auth.capabilities],
    provenance:[...new Set([...(auth.provenance||[]),'diva_universal_private_gateway'])],
    context_policy:'reconstruct_relevant_state_not_full_conversation',
    epistemic_policy:'prove_before_promote'
  };
}

export function assertDivaGatewayMission(operation,body={}){
  if(['health','identify'].includes(operation))return true;
  const missionId=String(body?.mission_id||'').trim();
  if(!missionId)throw new Error('DIVA_GATEWAY_MISSION_ID_REQUIRED');
  return true;
}
