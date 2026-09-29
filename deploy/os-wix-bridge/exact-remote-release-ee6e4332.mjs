import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync,spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA='e14d631e53c26bcba36457adfa670037fb192a70';
const MIRROR_SHA='86d4cdd2e5d76ef9d36ea5e49c5e69daf47d2c39';
const CURRENT_LIVE_SHA='68b46dabd6fa0191259225493350a35caea26567';
const CURRENT_LIVE_RELEASE='wix-live-68b46dab';
const RELEASE_ID='wix-live-e14d631e';
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const REL=path.join(ROOT,'.wix-live-e14d631e');
const LOCK=path.join(ROOT,'deploy/os-wix-bridge/release-lock.json');
const SITE_ID='c80689f2-6627-45fa-a264-4ab2863ba306';
const APP_ID='79eedd41-5ca6-4940-925a-e95e6f3c570e';
const CANONICAL='https://os.mundinhocomunicacao.com';
const LIVE_HOST='https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com';

const state={phase:'BOOT',ok:false,released:false,sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,tests:[],error:null};

function sh(cmd,args,cwd=ROOT,env={}){
  return String(execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...env}})||'').trim();
}
function runAsync(cmd,args,{cwd=ROOT,env={}}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:'inherit'});
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error(cmd+' exit '+code)));
  });
}
function assertLock(){
  const lock=JSON.parse(fs.readFileSync(LOCK,'utf8'));
  const req=lock.pendingReleaseRequest||{};
  if(lock.policyVersion!=='MUNDINHO_OS_LIVE_LOCK_V1') throw new Error('RELEASE_LOCK_POLICY_MISMATCH');
  if(lock.mode!=='frozen') throw new Error('RELEASE_LOCK_MODE_MISMATCH');
  if(lock.currentLive?.sourceSha!==CURRENT_LIVE_SHA||lock.currentLive?.releaseId!==CURRENT_LIVE_RELEASE) throw new Error('RELEASE_LOCK_CURRENT_LIVE_MISMATCH');
  if(req.status!=='APPROVED'||req.approvedByHuman!==true) throw new Error('RELEASE_LOCK_NOT_APPROVED');
  if(req.sourceSha!==SOURCE_SHA||req.mirrorSha!==MIRROR_SHA||req.releaseId!==RELEASE_ID) throw new Error('RELEASE_LOCK_CANDIDATE_MISMATCH');
  if(req.targetSiteId!==SITE_ID||req.targetAppId!==APP_ID) throw new Error('RELEASE_LOCK_TARGET_MISMATCH');
  const envPolicy=String(process.env.OS_LIVE_LOCK_POLICY_VERSION||'').trim();
  const envCurrent=String(process.env.OS_LIVE_EXPECTED_CURRENT_SOURCE_SHA||'').trim();
  const envCurrentRel=String(process.env.OS_LIVE_EXPECTED_CURRENT_RELEASE_ID||'').trim();
  const envReq=String(process.env.OS_LIVE_APPROVED_REQUEST_ID||'').trim();
  const envSource=String(process.env.OS_LIVE_APPROVED_SOURCE_SHA||'').trim();
  const promotion=String(process.env.OS_LIVE_PROMOTION_ENABLED||'false').toLowerCase()==='true';
  if(envPolicy!=='MUNDINHO_OS_LIVE_LOCK_V1'||envCurrent!==CURRENT_LIVE_SHA||envCurrentRel!==CURRENT_LIVE_RELEASE||envReq!==req.requestId||envSource!==SOURCE_SHA||!promotion) throw new Error('RELEASE_LOCK_ENV_MISMATCH');
  state.tests.push({gate:'release-lock',status:'PASS'});
  console.log('RELEASE_LOCK_PASS '+req.requestId);
}
function assertSource(){
  const mirror=sh('git',['-C',OS_DIR,'rev-parse','HEAD']);
  if(mirror!==MIRROR_SHA) throw new Error('MIRROR_SHA_MISMATCH '+mirror);
  const marker=fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8').trim();
  if(marker!==SOURCE_SHA) throw new Error('SOURCE_MARKER_MISMATCH '+marker);
  state.tests.push({gate:'source',status:'PASS'});
  console.log('SOURCE_EXACT_SHA_PASS '+SOURCE_SHA+' mirror='+MIRROR_SHA);
}
async function build(){
  state.phase='BUILD';
  await runAsync('npm',['ci','--include=dev'],{cwd:OS_DIR});
  await runAsync('npm',['run','build:wix-worker'],{cwd:OS_DIR,env:{MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,MUNDO_RUNTIME_ENV:'wix-live'}});
  const entry=fs.readFileSync(path.join(OS_DIR,'dist/wix-server/entry.mjs'),'utf8');
  if(!entry.includes('MUNDO_RUNTIME_SOURCE_SHA:'+JSON.stringify(SOURCE_SHA))) throw new Error('ARTIFACT_RUNTIME_SHA_MISMATCH');
  if(!entry.includes('MUNDO_RUNTIME_ENV:'+JSON.stringify('wix-live'))) throw new Error('ARTIFACT_RUNTIME_ENV_MISMATCH');
  fs.rmSync(REL,{recursive:true,force:true}); fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({projectType:'Site',appId:APP_ID,siteId:SITE_ID,site:{outputDirectory:{client:'./client',server:'./server'}}},null,2));
  state.tests.push({gate:'build',status:'PASS'});
  console.log('WIX_LIVE_BUILD_PASS '+SOURCE_SHA);
}
async function auth(){
  state.phase='AUTH';
  fs.mkdirSync(REL,{recursive:true});
  const apiKey=String(process.env.WIX_OS_API_KEY||process.env.WIX_MUNDO_API_KEY||process.env.WIX_API_KEY||'').trim();
  if(apiKey){
    await runAsync('npx',['-y','@wix/cli@latest','login','--api-key',apiKey],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
    console.log('WIX_API_KEY_AUTH_PASS');
    return;
  }
  const who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env:{...process.env,CI:'1',AI_AGENT:'wix-headless-skill'},timeout:30000});
  if(who.status===0&&String(who.stdout||'').trim()){console.log('WIX_AUTH_ALREADY_VALID');return;}
  await new Promise((resolve,reject)=>{
    const p=spawn('npx',['-y','@wix/cli@latest','login'],{cwd:REL,env:{...process.env,AI_AGENT:'wix-headless-skill'},stdio:['ignore','pipe','pipe']});
    let buffer='';
    const scan=(chunk)=>{
      const s=String(chunk); process.stdout.write(s); buffer+=s;
      for(const line of buffer.split('\n')){
        try{
          const e=JSON.parse(line.trim());
          if(e.event==='awaiting_user'){
            state.phase='AWAITING_WIX_AUTH';
            state.userCode=e.userCode||null;
            state.verificationUri=e.verificationUri||null;
            state.authExpiresInSeconds=e.expiresInSeconds||null;
            console.log('WIX_E14D_AWAITING_USER '+JSON.stringify({userCode:state.userCode,verificationUri:state.verificationUri,expiresInSeconds:state.authExpiresInSeconds}));
          }
        }catch{}
      }
    };
    p.stdout.on('data',scan);
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error('wix login exit '+code)));
  });
  const after=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env:{...process.env,AI_AGENT:'wix-headless-skill'},timeout:30000});
  if(after.status!==0)throw new Error('WIX_AUTH_FAILED_AFTER_DEVICE_LOGIN');
  state.userCode=null; state.verificationUri=null; state.authExpiresInSeconds=null;
  console.log('WIX_DEVICE_AUTH_PASS');
}
async function fetchJson(url){
  const res=await fetch(url,{headers:{'cache-control':'no-cache'}});
  const raw=await res.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch{}
  return {ok:res.ok,status:res.status,data};
}
async function prove(host,label){
  for(let i=0;i<36;i++){
    const r=await fetchJson(host+'/api/diva-release?proof='+Date.now());
    if(r.ok&&r.data?.deploymentSha===SOURCE_SHA&&r.data?.deploymentId===RELEASE_ID&&r.data?.runtimeEnv==='wix-live'){
      console.log(label+'_EXACT_SHA_PASS '+SOURCE_SHA);
      return r.data;
    }
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error(label+'_EXACT_SHA_READBACK_FAIL');
}
async function main(){
  try{
    assertLock();
    assertSource();
    await auth();
    await build();
    state.phase='RELEASE';
    await runAsync('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
    console.log('WIX_RELEASE_DISPATCHED '+SOURCE_SHA);
    state.phase='READBACK';
    state.live=await prove(LIVE_HOST,'LIVE');
    state.canonical=await prove(CANONICAL,'CANONICAL');
    state.phase='DONE'; state.ok=true; state.released=true;
    console.log('WIX_EXACT_LIVE_VERIFIED '+SOURCE_SHA);
  }catch(error){
    state.phase='ERROR'; state.error=String(error?.stack||error);
    console.error('WIX_EXACT_RELEASE_ERROR '+state.error);
  }
}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))}).listen(PORT,'0.0.0.0',()=>{console.log('WIX_E14D_EXACT_RELEASE_CONTROLLER_READY');void main();});
