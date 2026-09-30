import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const SOURCE_SHA='9f0048f6a0171d537fbdd3614d989f39c1304f3f';
const MIRROR_SHA='495d472a32616479943c675d3bc682b41db8669a';
const QA_SECRET='mundinho-mr515-render-qa-session-20260930-9f0048f6';
const QA_EMAIL='mundinhocomunicacao@gmail.com';

function sh(bin,args,cwd=ROOT,env={}){
  return String(execFileSync(bin,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...env}})||'').trim();
}
function run(bin,args,cwd=ROOT,env={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(bin,args,{cwd,env:{...process.env,...env},stdio:['ignore','inherit','inherit']});
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error(bin+' '+args.join(' ')+' exit '+code)));
  });
}
function sessionToken(){
  const body=Buffer.from(JSON.stringify({
    email:QA_EMAIL,
    exp:Date.now()+60*60*1000,
    iat:Date.now(),
    authMethod:'render-qa-mr515'
  })).toString('base64url');
  const sig=crypto.createHmac('sha256',QA_SECRET).update(body).digest('base64url');
  return body+'.'+sig;
}
function verifySource(){
  const head=sh('git',['rev-parse','HEAD'],OS_DIR);
  const marker=String(fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8')).trim();
  if(head!==MIRROR_SHA)throw new Error('QA_MIRROR_SHA_MISMATCH:'+head);
  if(marker!==SOURCE_SHA)throw new Error('QA_SOURCE_MARKER_MISMATCH:'+marker);
  console.log('QA_SOURCE_PARITY_PASS '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA}));
}
async function smoke(){
  const cookie='mundinho_session='+encodeURIComponent(sessionToken());
  let last=null;
  for(let attempt=1;attempt<=45;attempt++){
    try{
      const response=await fetch('http://127.0.0.1:'+PORT+'/api/live-projection',{
        headers:{cookie,'cache-control':'no-cache','x-qa-proof':'mr515'}
      });
      const raw=await response.text();
      let data={};try{data=raw?JSON.parse(raw):{}}catch{}
      last={status:response.status,data};
      if(
        response.status===200 &&
        data?.ok===true &&
        data?.live?.status==='ready' &&
        data?.live?.source==='wix-cms-live' &&
        data?.live?.readback==='consistent' &&
        data?.projection?.status==='ready' &&
        data?.projection?.source==='mundo-live-core'
      ){
        console.log('QA_LIVE_PROJECTION_PASS '+JSON.stringify({
          sourceSha:SOURCE_SHA,
          httpStatus:response.status,
          ok:data.ok,
          live:data.live,
          projection:{
            status:data.projection.status,
            source:data.projection.source,
            liveCount:data.projection.liveCount,
            coreOverlay:data.projection.coreOverlay,
            liveCore:data.projection.liveCore
          }
        }));
        return;
      }
    }catch(error){last={error:String(error?.message||error)}}
    await new Promise(resolve=>setTimeout(resolve,2000));
  }
  console.error('QA_LIVE_PROJECTION_FAIL '+JSON.stringify({
    sourceSha:SOURCE_SHA,
    last:last&&last.data?{
      status:last.status,
      ok:last.data?.ok,
      live:last.data?.live,
      projection:last.data?.projection?{
        status:last.data.projection.status,
        source:last.data.projection.source,
        reason:last.data.projection.reason
      }:null
    }:last
  }));
}
async function main(){
  verifySource();
  const childEnv={
    MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,
    MUNDO_RUNTIME_ENV:'render-qa-mr515',
    MUNDINHO_SESSION_SECRET:QA_SECRET
  };
  await run('node',['scripts/qa-commercial-core-live-binding.mjs'],OS_DIR,childEnv);
  await run('node',['scripts/qa-google-login.mjs'],OS_DIR,childEnv);
  await run('npm',['run','build:vinext'],OS_DIR,childEnv);
  console.log('QA_VINEXT_BUILD_PASS '+SOURCE_SHA);

  const app=spawn('npm',['run','start:vinext','--','--ip','0.0.0.0','--port',String(PORT)],{
    cwd:OS_DIR,
    env:{...process.env,...childEnv,PORT:String(PORT)},
    stdio:['ignore','inherit','inherit']
  });
  app.on('error',error=>{console.error('QA_APP_SPAWN_ERROR '+String(error?.message||error));process.exit(1)});
  app.on('close',code=>{console.error('QA_APP_EXIT '+code);process.exit(code||1)});
  await smoke();
}
main().catch(error=>{
  console.error('QA_PREVIEW_BOOT_FAIL '+String(error?.stack||error));
  process.exit(1);
});
