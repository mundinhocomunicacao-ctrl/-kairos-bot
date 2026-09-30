import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA='6be4e1866174322941519ab52440a84431ae0f23';
const MIRROR_SHA='70a59cbd5dd5e33fa1e7dc3b0e9b652b0902fecd';
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const REL=path.join(ROOT,'.wix-os-pink-master-qa-20260929');
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
let state={phase:'BOOT',ok:false,released:false,sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,tests:[],error:null};

function run(bin,args,cwd=ROOT,extraEnv={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(bin,args,{cwd,env:{...process.env,...extraEnv},stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(d));
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error(bin+' '+args.join(' ')+' exit '+code)));
  });
}
function sh(bin,args,cwd=ROOT,extraEnv={}){
  return String(execFileSync(bin,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...extraEnv}})||'').trim();
}
function mark(gate,status='PASS',detail=null){
  state.tests.push({gate,status,detail,at:new Date().toISOString()});
  console.log(gate+'='+status+(detail?' '+detail:''));
}
async function syncSource(){
  state.phase='SOURCE';
  await run('git',['submodule','sync','--recursive'],ROOT);
  await run('git',['submodule','update','--init','--recursive'],ROOT);
  const mirror=sh('git',['-C',OS_DIR,'rev-parse','HEAD']);
  if(mirror!==MIRROR_SHA)throw new Error('MIRROR_SHA_MISMATCH:'+mirror);
  const marker=String(fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8')).trim();
  if(marker!==SOURCE_SHA)throw new Error('SOURCE_MARKER_MISMATCH:'+marker);
  mark('SOURCE_PARITY','PASS',SOURCE_SHA+' mirror='+MIRROR_SHA);
}
async function qaAndBuild(){
  state.phase='QA_BUILD';
  await run('npm',['ci'],OS_DIR);
  mark('NPM_CI');
  await run('node',['scripts/qa-approved-pink-master.mjs'],OS_DIR);
  mark('QA_APPROVED_PINK_MASTER');
  await run('npm',['run','qa:part1-seven-angels'],OS_DIR);
  mark('QA_PART1_HUMAN_CORE');
  await run('npm',['run','build:vinext'],OS_DIR,{NODE_OPTIONS:'--max-old-space-size=384'});
  mark('BUILD_VINEXT');
  await run('node',['scripts/package-wix-worker.mjs'],OS_DIR,{MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,MUNDO_RUNTIME_ENV:'wix-qa'});
  const entry=path.join(OS_DIR,'dist/wix-server/entry.mjs');
  if(!fs.existsSync(entry))throw new Error('WIX_WORKER_ENTRY_MISSING');
  const built=fs.readFileSync(entry,'utf8');
  if(!built.includes(SOURCE_SHA))throw new Error('WIX_WORKER_SOURCE_SHA_MISMATCH');
  if(!built.includes('wix-qa'))throw new Error('WIX_WORKER_ENV_MISMATCH');
  mark('BUILD_WIX_WORKER','PASS',SOURCE_SHA);
  fs.rmSync(REL,{recursive:true,force:true});
  fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({projectType:'Site',appId:QA.appId,siteId:QA.siteId,site:{outputDirectory:{client:'./client',server:'./server'}}},null,2));
}
async function ensureAuth(){
  state.phase='AUTH';
  for(const alias of ['WIX_OS_API_KEY','WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY']){
    const value=String(process.env[alias]||'').trim();
    if(!value)continue;
    await run('npx',['-y','@wix/cli@latest','login','--api-key',value],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    mark('WIX_AUTH','PASS',alias);
    return alias;
  }
  throw new Error('WIX_AUTH_MISSING');
}
async function fetchJson(url){
  const res=await fetch(url,{headers:{'cache-control':'no-cache'}});
  const raw=await res.text();
  let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  return {ok:res.ok,status:res.status,data,raw:raw.slice(0,500)};
}
async function prove(){
  state.phase='READBACK';
  for(let i=1;i<=36;i++){
    try{
      const [rv,dr,pr]=await Promise.all([
        fetchJson(QA.host+'/api/release-version?proof='+Date.now()),
        fetchJson(QA.host+'/api/diva-release?proof='+Date.now()),
        fetchJson(QA.host+'/api/preview-readiness?proof='+Date.now())
      ]);
      const source=rv.data?.sourceSha||pr.data?.sourceSha||dr.data?.deploymentSha;
      if(source===SOURCE_SHA&&dr.data?.deploymentSha===SOURCE_SHA&&pr.data?.sourceSha===SOURCE_SHA&&pr.data?.status==='ready'){
        mark('QA_READBACK','PASS',SOURCE_SHA);
        return {releaseVersion:rv.data,divaRelease:dr.data,previewReadiness:pr.data};
      }
    }catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error('QA_EXACT_SHA_READBACK_FAIL');
}
async function main(){
  try{
    console.log('OS_PINK_MASTER_QA_CONTROLLER_START '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA}));
    await syncSource();
    await qaAndBuild();
    state.authAlias=await ensureAuth();
    state.phase='RELEASE_QA';
    await run('npx',['-y','@wix/cli@latest','release'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    mark('QA_RELEASE_DISPATCH');
    state.qa=await prove();
    state.phase='DONE';state.ok=true;state.released=true;state.status='OS_PINK_MASTER_QA_VERIFIED';
    console.log('OS_PINK_MASTER_QA_VERIFIED '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA}));
  }catch(error){
    state.phase='ERROR';state.ok=false;state.released=false;state.status='BLOCKED';
    state.error=String(error?.stack||error);
    console.error('OS_PINK_MASTER_QA_BLOCKED '+state.error);
  }
}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2));}).listen(PORT,'0.0.0.0',()=>{
  console.log('OS_PINK_MASTER_QA_CONTROLLER_READY');
  void main();
});
