import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const ROOT=process.cwd();
const SNAPSHOT_CHUNKS=path.join(ROOT,'deploy/morada-wix-snapshot-chunks');
const WORKDIR='/tmp/morada-wix-pandora-release';
const MORADA_SITE_ID=String(process.env.MORADA_SITE_ID||'7aff6327-39c6-4be0-aa3f-5d50680eb337').trim();

function readChunks(){
  const files=['chunk-01.json','chunk-02.json','chunk-03.json','chunk-04.json'];
  const rows=[];
  for(const name of files){
    const doc=JSON.parse(fs.readFileSync(path.join(SNAPSHOT_CHUNKS,name),'utf8'));
    rows.push(...(Array.isArray(doc.files)?doc.files:[]));
  }
  if(rows.length!==70)throw new Error('MORADA_SNAPSHOT_FILE_COUNT_'+rows.length);
  return rows;
}

function materializeSnapshot(){
  fs.rmSync(WORKDIR,{recursive:true,force:true});
  fs.mkdirSync(WORKDIR,{recursive:true});
  const rows=readChunks();
  for(const row of rows){
    const target=path.join(WORKDIR,row.path);
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,String(row.content??''),'utf8');
  }
  return rows.length;
}

function run(cmd,args,cwd=WORKDIR,env=process.env){
  return execFileSync(cmd,args,{cwd,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}

function wixApiKey(){
  for(const alias of ['WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY','WIX_OS_API_KEY']){
    const value=String(process.env[alias]||'').trim();
    if(value)return {alias,value};
  }
  return null;
}

function ensureWixCli(){
  try{return run('wix',['--version'],ROOT);}catch{}
  run('npm',['install','-g','@wix/cli@latest'],ROOT);
  return run('wix',['--version'],ROOT);
}

function authenticateWix(){
  const api=wixApiKey();
  if(api){
    run('wix',['login','--api-key',api.value],WORKDIR);
    return {mode:'api_key',alias:api.alias};
  }
  try{
    const who=run('wix',['whoami'],WORKDIR);
    if(who)return {mode:'existing_session',alias:'wix_whoami'};
  }catch{}
  throw new Error('WIX_AUTH_UNAVAILABLE_NO_API_KEY_OR_SESSION');
}

function qa(){
  const output=run('node',['scripts/qa-morada-pandora-authority.mjs'],WORKDIR);
  if(!output.includes('QA_MORADA_PANDORA_AUTHORITY PASS'))throw new Error('MORADA_PANDORA_QA_FAIL');
  return output;
}

async function health(){
  const response=await fetch('https://www.especialistabrandingeinfluencia.com/_functions/divaHealth',{headers:{'cache-control':'no-cache'}});
  const data=await response.json().catch(()=>({}));
  return {httpStatus:response.status,data};
}

async function release(){
  const files=materializeSnapshot();
  const qaOutput=qa();
  const cliVersion=ensureWixCli();
  const auth=authenticateWix();
  const publishOutput=run('wix',['publish','-y'],WORKDIR);
  await new Promise(r=>setTimeout(r,8000));
  const live=await health();
  if(live.httpStatus!==200)throw new Error('MORADA_HEALTH_HTTP_'+live.httpStatus);
  if(live.data?.pandoraMachineAuthority!=='OWNER_OR_PANDORA_MISSION_AUTHORITY_V1'){
    throw new Error('MORADA_PANDORA_LIVE_MARKER_MISSING');
  }
  return Object.freeze({
    phase:'MORADA_PANDORA_RELEASE_VERIFIED',
    done:true,
    released:true,
    siteId:MORADA_SITE_ID,
    snapshotFiles:files,
    qa:'PASS',
    qaOutput,
    cliVersion,
    authMode:auth.mode,
    authAlias:auth.alias,
    publishOutput:publishOutput.slice(-2000),
    health:live
  });
}

let state=Object.freeze({phase:'BOOTING',done:false,released:false});

async function boot(){
  try{
    state=await release();
    console.log('MORADA_PANDORA_RELEASE_VERIFIED '+JSON.stringify({
      siteId:state.siteId,
      snapshotFiles:state.snapshotFiles,
      qa:state.qa,
      authMode:state.authMode,
      authAlias:state.authAlias,
      healthStatus:state.health.httpStatus,
      pandoraMachineAuthority:state.health.data?.pandoraMachineAuthority||null
    }));
  }catch(error){
    state=Object.freeze({phase:'EXECUTOR_ERROR',done:true,released:false,error:String(error?.stack||error)});
    console.error(state.error);
  }
}

http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  if(req.url==='/manifest')return res.end(JSON.stringify(state));
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>console.log('WIX_RELEASE_CONTROL_READY'));

void boot();
