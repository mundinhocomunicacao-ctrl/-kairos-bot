import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {execFileSync,spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const SOURCE_SHA='30dbab743860b15a47479c2e57db5857e7561670';
const MIRROR_SHA='7a952d3bde3396a1fdd687f8589cabd5fd97a530';
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
  if(marker!==SOURCE_SHA){
    console.log('QA_SOURCE_MARKER_STALE '+JSON.stringify({marker,sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA}));
  }
  console.log('QA_SOURCE_PARITY_PASS '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,marker}));
}
async function repackReleaseIdentity(childEnv){
  const markerPath=path.join(OS_DIR,'.release-source/canonical-sha.txt');
  const originalMarker=String(fs.readFileSync(markerPath,'utf8')).trim();
  try{
    fs.writeFileSync(markerPath,SOURCE_SHA+'\n','utf8');
    await run('node',['scripts/package-wix-worker.mjs'],OS_DIR,childEnv);
  }finally{
    fs.writeFileSync(markerPath,originalMarker+'\n','utf8');
  }
  const entryPath=path.join(OS_DIR,'dist','wix-server','entry.mjs');
  if(!fs.existsSync(entryPath))throw new Error('QA_RELEASE_IDENTITY_ENTRY_MISSING:'+entryPath);
  const entry=String(fs.readFileSync(entryPath,'utf8'));
  if(!entry.includes(SOURCE_SHA))throw new Error('QA_RELEASE_IDENTITY_SHA_MISSING:'+SOURCE_SHA);
  console.log('QA_RELEASE_IDENTITY_REPACK_PASS '+JSON.stringify({
    sourceSha:SOURCE_SHA,
    mirrorSha:MIRROR_SHA,
    originalMarker,
    markerRestored:true
  }));
}
async function startPrebuiltWixWorker(port,childEnv){
  const wixAliasCandidates=[
    ['WIX_MUNDO_API_KEY',process.env.WIX_MUNDO_API_KEY],
    ['WIX_OS_API_KEY',process.env.WIX_OS_API_KEY],
    ['WIX_API_KEY',process.env.WIX_API_KEY]
  ];
  const selectedWixAlias=wixAliasCandidates.find(([,value])=>String(value||'').trim());
  if(selectedWixAlias){
    process.env.WIX_MUNDO_API_KEY=String(selectedWixAlias[1]).trim();
    childEnv={...childEnv,WIX_MUNDO_API_KEY:process.env.WIX_MUNDO_API_KEY};
    console.log('QA_WIX_DIRECT_AUTH_ALIAS '+JSON.stringify({configured:true,alias:selectedWixAlias[0]}));
  }else{
    console.log('QA_WIX_DIRECT_AUTH_ALIAS '+JSON.stringify({
      configured:false,
      aliases:wixAliasCandidates.map(([alias,value])=>({alias,present:Boolean(String(value||'').trim())}))
    }));
  }
  const entryPath=path.join(OS_DIR,'dist','wix-server','entry.mjs');
  if(!fs.existsSync(entryPath))throw new Error('QA_PREBUILT_WIX_WORKER_MISSING:'+entryPath);
  const loaded=await import(pathToFileURL(entryPath).href+'?qa='+Date.now());
  const worker=loaded?.default;
  if(!worker||typeof worker.fetch!=='function')throw new Error('QA_PREBUILT_WIX_WORKER_INVALID');
  const runtimeEnv={...process.env,...childEnv};
  const ctx={waitUntil(promise){Promise.resolve(promise).catch(error=>console.error('QA_WAIT_UNTIL_ERROR '+String(error?.message||error)))},passThroughOnException(){}};
  const server=http.createServer(async(req,res)=>{
    try{
      const chunks=[];
      for await(const chunk of req)chunks.push(Buffer.from(chunk));
      const body=chunks.length?Buffer.concat(chunks):null;
      const init={method:req.method||'GET',headers:req.headers};
      if(body&&body.length&&init.method!=='GET'&&init.method!=='HEAD')init.body=body;
      const request=new Request('http://127.0.0.1:'+port+(req.url||'/'),init);
      const response=await worker.fetch(request,runtimeEnv,ctx);
      res.statusCode=response.status;
      response.headers.forEach((value,key)=>res.setHeader(key,value));
      res.end(Buffer.from(await response.arrayBuffer()));
    }catch(error){
      console.error('QA_WIX_WORKER_HTTP_ERROR '+String(error?.stack||error));
      if(!res.headersSent)res.writeHead(500,{'content-type':'application/json'});
      res.end(JSON.stringify({ok:false,error:'qa_wix_worker_http_error'}));
    }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'0.0.0.0',resolve)});
  console.log('QA_WIX_WORKER_PREBUILT_RUNTIME_READY '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,port}));
  return server;
}

async function smoke(){
  const cookie='mundinho_session='+encodeURIComponent(sessionToken());
  let last=null;
  for(let attempt=1;attempt<=45;attempt++){
    try{
      const response=await fetch('http://127.0.0.1:'+PORT+'/api/live-projection',{
        headers:{cookie,'cache-control':'no-cache','x-qa-proof':'mr515'},
        signal:AbortSignal.timeout(8000)
      });
      const raw=await response.text();
      console.log('QA_LIVE_PROJECTION_ATTEMPT '+JSON.stringify({attempt,status:response.status}));
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
  const bootstrap=http.createServer((req,res)=>{
    res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
    res.end(JSON.stringify({ok:true,status:'warming',sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA}));
  });
  await new Promise((resolve,reject)=>{
    bootstrap.once('error',reject);
    bootstrap.listen(PORT,'0.0.0.0',resolve);
  });
  console.log('QA_BOOTSTRAP_PORT_READY '+PORT);

  verifySource();
  const childEnv={
    MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,
    MUNDO_RUNTIME_ENV:'render-qa-mr515',
    MUNDINHO_SESSION_SECRET:QA_SECRET
  };
  const preflightEnv={
    ...childEnv,
    WIX_OS_LIVE_SITE_ID:'c80689f2-6627-45fa-a264-4ab2863ba306'
  };
  await run('node',['scripts/qa-commercial-core-live-binding.mjs'],OS_DIR,preflightEnv);
  await run('node',['scripts/qa-google-login.mjs'],OS_DIR,childEnv);
  await repackReleaseIdentity(childEnv);
  const prebuiltWorker=path.join(OS_DIR,'dist','wix-server','entry.mjs');
  if(!fs.existsSync(prebuiltWorker))throw new Error('QA_PREBUILT_WIX_WORKER_MISSING:'+prebuiltWorker);
  console.log('QA_WIX_WORKER_PREBUILT_REUSE '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA}));

  await new Promise(resolve=>bootstrap.close(resolve));
  console.log('QA_BOOTSTRAP_PORT_RELEASED '+PORT);

  await startPrebuiltWixWorker(PORT,childEnv);
  await smoke();
}
main().catch(error=>{
  console.error('QA_PREVIEW_BOOT_FAIL '+String(error?.stack||error));
  process.exit(1);
});
