import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA='88ccd189cf2b61fd042a6fde2be558646818109c';
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const ENTRY=path.join(OS_DIR,'dist/wix-server/entry.mjs');
const ARCHIVE=path.join(ROOT,'os-88ccd189-artifact.tar.gz');

const MORADA_SITE_ID=String(process.env.MORADA_SITE_ID||'7aff6327-39c6-4be0-aa3f-5d50680eb337').trim();
const MORADA_EMBED_ID=String(process.env.MORADA_EMBED_ID||'fcb4b995-6595-4eae-9eb2-f93ae5e2e443').trim();
const MORADA_EMBED_FILE=path.join(ROOT,'deploy/os-wix-bridge/interaction-recovery-v6.html');
const MORADA_SOURCE_PUBLISH=/^(1|true|yes)$/i.test(String(process.env.MORADA_SOURCE_PUBLISH||''));
const MORADA_RELEASE_SHA=String(process.env.MORADA_RELEASE_SHA||'').trim();
const MORADA_SOURCE_DIR=path.join(ROOT,'morada');
const MORADA_LIVE='https://www.especialistabrandingeinfluencia.com';

function prepareArtifact(){
  const marker=fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8').trim();
  if(marker!==SOURCE_SHA)throw new Error('ARTIFACT_SOURCE_MARKER_MISMATCH '+marker);
  const entry=fs.readFileSync(ENTRY,'utf8');
  if(!entry.includes('MUNDO_RUNTIME_SOURCE_SHA:'+JSON.stringify(SOURCE_SHA)))throw new Error('ARTIFACT_RUNTIME_SHA_MISMATCH');
  execFileSync('tar',['-czf',ARCHIVE,'-C',OS_DIR,'dist'],{stdio:'inherit'});
  return Object.freeze({phase:'ARTIFACT_BRIDGE_READY',done:true,released:false,sourceSha:SOURCE_SHA,reason:'Safe transport only; release controller runs separately.'});
}

async function wixAuthHeaders(siteId){
  const aliases=[
    'WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY','WIX_OS_API_KEY'
  ];
  for(const alias of aliases){
    const value=String(process.env[alias]||'').trim();
    if(value)return {headers:{'content-type':'application/json',authorization:value,'wix-site-id':siteId},authMode:'api_key',authAlias:alias};
  }

  const clientId=String(process.env.WIX_CLIENT_ID||'').trim();
  const clientSecret=String(process.env.WIX_CLIENT_SECRET||'').trim();
  const instanceId=String(process.env.WIX_CLIENT_INSTANCE_ID||'').trim();
  if(!clientId||!clientSecret)throw new Error('WIX_INSTITUTIONAL_AUTH_MISSING');

  const tokenBody={grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret};
  if(instanceId)tokenBody.instance_id=instanceId;
  const response=await fetch('https://www.wixapis.com/oauth2/token',{
    method:'POST',
    headers:{'content-type':'application/json'},
    body:JSON.stringify(tokenBody)
  });
  const data=await response.json().catch(()=>({}));
  const token=String(data?.access_token||'').trim();
  if(!response.ok||!token)throw new Error('WIX_OAUTH_TOKEN_'+response.status);
  return {headers:{'content-type':'application/json',authorization:token,'wix-site-id':siteId},authMode:'oauth_client_credentials',authAlias:'WIX_CLIENT_ID'};
}

async function listEmbeds(headers){
  const response=await fetch('https://www.wixapis.com/embeds/v1/custom-embeds',{method:'GET',headers});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('WIX_EMBEDS_LIST_'+response.status+' '+String(data?.message||data?.error||''));
  return Array.isArray(data?.customEmbeds)?data.customEmbeds:[];
}

async function patchMoradaEmbed(){
  const html=fs.readFileSync(MORADA_EMBED_FILE,'utf8');
  if(!html.includes('diva-interaction-recovery-v6'))throw new Error('MORADA_V6_SOURCE_MARKER_MISSING');
  if(!html.includes("site.style.setProperty('pointer-events',isBlocked?'auto':'none','important')"))throw new Error('MORADA_V6_SITE_BYPASS_MISSING');

  const auth=await wixAuthHeaders(MORADA_SITE_ID);
  const beforeList=await listEmbeds(auth.headers);
  const before=beforeList.find(x=>x.id===MORADA_EMBED_ID);
  if(!before)throw new Error('MORADA_EMBED_NOT_FOUND');

  const body={customEmbed:{
    id:MORADA_EMBED_ID,
    revision:String(before.revision),
    name:'DIVA Morada · Interaction Recovery V6 · Wix Host Bypass',
    enabled:true,
    loadOnce:false,
    position:'BODY_END',
    embedData:{category:'ESSENTIAL',html}
  }};

  const response=await fetch('https://www.wixapis.com/embeds/v1/custom-embeds/'+encodeURIComponent(MORADA_EMBED_ID),{
    method:'PATCH',
    headers:auth.headers,
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error('WIX_EMBED_PATCH_'+response.status+' '+String(data?.message||data?.error||''));

  const afterList=await listEmbeds(auth.headers);
  const after=afterList.find(x=>x.id===MORADA_EMBED_ID);
  const liveHtml=String(after?.embedData?.html||'');
  const verified=Boolean(
    after?.enabled===true &&
    liveHtml.includes('diva-interaction-recovery-v6') &&
    liveHtml.includes("site.style.setProperty('pointer-events',isBlocked?'auto':'none','important')")
  );
  if(!verified)throw new Error('MORADA_V6_REREAD_FAILED');

  return Object.freeze({
    phase:'MORADA_EMBED_PATCH_VERIFIED',
    done:true,
    released:true,
    siteId:MORADA_SITE_ID,
    embedId:MORADA_EMBED_ID,
    beforeRevision:String(before.revision),
    afterRevision:String(after.revision),
    name:after.name,
    enabled:after.enabled===true,
    marker:'diva-interaction-recovery-v6',
    siteContainerBypass:true,
    delegatedFallback:true,
    authMode:auth.authMode,
    authAlias:auth.authAlias
  });
}


function wixApiKeyFromEnv(){
  const aliases=['WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY','WIX_OS_API_KEY'];
  for(const alias of aliases){
    const value=String(process.env[alias]||'').trim();
    if(value)return {alias,value};
  }
  return null;
}

async function publishMoradaSource(){
  if(!fs.existsSync(MORADA_SOURCE_DIR))throw new Error('MORADA_SOURCE_DIR_MISSING');
  const sourceSha=String(execFileSync('git',['-C',MORADA_SOURCE_DIR,'rev-parse','HEAD'],{encoding:'utf8'})).trim();
  if(!sourceSha)throw new Error('MORADA_SOURCE_SHA_MISSING');
  if(MORADA_RELEASE_SHA&&sourceSha!==MORADA_RELEASE_SHA)throw new Error('MORADA_RELEASE_SHA_MISMATCH '+sourceSha+' expected='+MORADA_RELEASE_SHA);

  const bridge=fs.readFileSync(path.join(MORADA_SOURCE_DIR,'src/backend/divaBridge.web.js'),'utf8');
  const hook=fs.readFileSync(path.join(MORADA_SOURCE_DIR,'src/backend/data.js'),'utf8');
  for(const token of [
    'sendPandoraMissionToMalhaInternal',
    'PANDORA_MISSION_AUTHORITY',
    'AUTHORIZED_REREAD_VERIFIED'
  ]) if(!bridge.includes(token))throw new Error('MORADA_PANDORA_BRIDGE_MISSING '+token);
  for(const token of [
    'DIVA_MEMORY_WRITEBACK_V1_afterInsert',
    'diva.morada.pandora.mission.execute',
    'EXECUTE_REQUESTED',
    'PANDORA_MACHINE_EXECUTION_PROOF'
  ]) if(!hook.includes(token))throw new Error('MORADA_PANDORA_HOOK_MISSING '+token);

  execFileSync('node',['scripts/qa-morada-pandora-authority.mjs'],{cwd:MORADA_SOURCE_DIR,stdio:'inherit'});

  let authMode='existing_session';
  let authAlias='existing_session';
  try{
    const whoami=String(execFileSync('npx',['-y','@wix/cli@latest','whoami'],{
      cwd:MORADA_SOURCE_DIR,encoding:'utf8',env:{...process.env,CI:'1',AI_AGENT:'wix-headless-skill'}
    })).trim();
    console.log('MORADA_WIX_EXISTING_SESSION_PASS '+whoami.replace(/\s+/g,' '));
  }catch{
    const auth=wixApiKeyFromEnv();
    if(!auth)throw new Error('MORADA_WIX_AUTH_UNAVAILABLE');
    execFileSync('npx',['-y','@wix/cli@latest','login','--api-key',auth.value],{
      cwd:MORADA_SOURCE_DIR,stdio:'inherit',env:{...process.env,CI:'1',AI_AGENT:'wix-headless-skill'}
    });
    authMode='api_key';
    authAlias=auth.alias;
    console.log('MORADA_WIX_API_KEY_AUTH_PASS '+auth.alias);
  }

  execFileSync('npx',['-y','@wix/cli@latest','publish','-y'],{
    cwd:MORADA_SOURCE_DIR,stdio:'inherit',env:{...process.env,CI:'1',AI_AGENT:'wix-headless-skill'}
  });
  console.log('MORADA_WIX_PUBLISH_PASS '+sourceSha);

  await new Promise(r=>setTimeout(r,10000));
  const healthResponse=await fetch(MORADA_LIVE+'/_functions/divaHealth?proof='+Date.now(),{headers:{'cache-control':'no-cache'}});
  const health=await healthResponse.json().catch(()=>({}));
  if(!healthResponse.ok)throw new Error('MORADA_HEALTH_HTTP_'+healthResponse.status);
  if(health?.pandoraMachineAuthority!=='OWNER_OR_PANDORA_MISSION_AUTHORITY_V1')throw new Error('MORADA_PANDORA_HEALTH_MARKER_MISSING');
  if(health?.malhaFlow!=='ONLINE')throw new Error('MORADA_MALHA_FLOW_NOT_ONLINE');
  console.log('MORADA_PANDORA_MACHINE_AUTHORITY_LIVE '+sourceSha);

  return Object.freeze({
    phase:'MORADA_SOURCE_PUBLISH_VERIFIED',
    done:true,
    released:true,
    sourceSha,
    siteId:MORADA_SITE_ID,
    authMode,
    authAlias,
    health:{
      ok:health?.ok===true,
      interactionBuild:health?.interactionBuild||null,
      releaseRail:health?.releaseRail||null,
      malhaFlow:health?.malhaFlow||null,
      pandoraMachineAuthority:health?.pandoraMachineAuthority||null
    }
  });
}

let state=Object.freeze({phase:'BOOTING',done:false,released:false});

async function boot(){
  try{
    if(MORADA_SOURCE_PUBLISH){
      state=await publishMoradaSource();
      return;
    }
    if(/^(1|true|yes)$/i.test(String(process.env.MORADA_EMBED_PATCH||''))){
      state=await patchMoradaEmbed();
      console.log('MORADA_EMBED_PATCH_VERIFIED '+JSON.stringify({embedId:state.embedId,beforeRevision:state.beforeRevision,afterRevision:state.afterRevision,authMode:state.authMode,authAlias:state.authAlias}));
      return;
    }
    state=prepareArtifact();
    console.log('OS_ARTIFACT_BRIDGE_READY '+SOURCE_SHA);
  }catch(error){
    state=Object.freeze({phase:'EXECUTOR_ERROR',done:true,released:false,error:String(error?.stack||error)});
    console.error(state.error);
  }
}

http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/artifact'&&state.phase==='ARTIFACT_BRIDGE_READY'){
    res.setHeader('content-type','application/gzip');
    return fs.createReadStream(ARCHIVE).pipe(res);
  }
  res.setHeader('content-type','application/json');
  if(u.pathname==='/manifest')return res.end(JSON.stringify(state));
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>console.log('WIX_RELEASE_CONTROL_READY'));

void boot();
