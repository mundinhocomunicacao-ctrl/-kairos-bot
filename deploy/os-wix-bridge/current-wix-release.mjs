import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA=String(process.env.OS_SOURCE_SHA||process.env.SOURCE_SHA||'').trim();
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'.canonical-gitlab-source');
const REL=path.join(ROOT,'.wix-os-live-release');
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
const RELEASE_QA_FIRST=String(process.env.OS_RELEASE_QA_FIRST||'0')==='1';
let state={phase:'BOOT',ok:false,released:false,sourceSha:SOURCE_SHA,source:'GITLAB_CANONICAL_ARCHIVE',tests:[],error:null};

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
  if(!/^[0-9a-f]{40}$/i.test(SOURCE_SHA))throw new Error('OS_SOURCE_SHA_REQUIRED_EXACT_40');
  fs.rmSync(OS_DIR,{recursive:true,force:true});
  fs.mkdirSync(OS_DIR,{recursive:true});
  const archive=path.join(ROOT,'.canonical-'+SOURCE_SHA+'.tar.gz');
  const url='https://gitlab.com/mundinhocomunicacao/mundinhocomunicacao/-/archive/'+SOURCE_SHA+'/mundinhocomunicacao-'+SOURCE_SHA+'.tar.gz';
  await run('curl',['--fail','--silent','--show-error','--location','--retry','5','--retry-all-errors','--retry-delay','2',url,'-o',archive],ROOT);
  await run('tar',['-xzf',archive,'--strip-components=1','-C',OS_DIR],ROOT);
  for(const required of ['package.json','package-lock.json','proxy.js','pages/api/release-version.js','scripts/package-wix-worker.mjs']){
    if(!fs.existsSync(path.join(OS_DIR,required)))throw new Error('CANONICAL_SOURCE_FILE_MISSING:'+required);
  }
  mark('SOURCE_PARITY','PASS',SOURCE_SHA+' direct-gitlab-archive');
}
async function qaAndBuild(){
  state.phase='QA_BUILD';
  await run('npm',['ci','--include=dev'],OS_DIR);
  for(const script of ['scripts/qa-resource-mesh-v1-1.mjs','scripts/qa-wix-canonical-rail.mjs','scripts/qa-os-domain-release-rail.mjs']){
    await run('node',[script],OS_DIR);
    mark('LOCAL_'+path.basename(script).replace(/\.mjs$/,'').toUpperCase());
  }
  await run('npm',['run','build:wix-worker'],OS_DIR,{MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,MUNDO_RUNTIME_ENV:'wix-live',NODE_OPTIONS:process.env.NODE_OPTIONS||'--max-old-space-size=1536'});
  const entry=path.join(OS_DIR,'dist','wix-server','entry.mjs');
  if(!fs.existsSync(entry))throw new Error('WIX_WORKER_ENTRY_MISSING');
  if(!fs.readFileSync(entry,'utf8').includes(SOURCE_SHA))throw new Error('WIX_WORKER_SOURCE_SHA_MISMATCH');
  fs.rmSync(REL,{recursive:true,force:true});
  fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist','client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist','wix-server'),path.join(REL,'server'),{recursive:true});
  mark('BUILD_WIX_WORKER','PASS',SOURCE_SHA);
}
function writeConfig(target){
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({projectType:'Site',appId:target.appId,siteId:target.siteId,site:{outputDirectory:{client:'./client',server:'./server'}}},null,2));
}
async function ensureAuth(){
  try{
    const who=sh('npx',['-y','@wix/cli@latest','whoami'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    if(who){mark('WIX_AUTH','PASS','cached');return;}
  }catch{}
  for(const alias of ['WIX_OS_API_KEY','WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY']){
    const value=String(process.env[alias]||'').trim();
    if(!value)continue;
    await run('npx',['-y','@wix/cli@latest','login','--api-key',value],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    mark('WIX_AUTH','PASS',alias);
    return;
  }
  throw new Error('WIX_AUTH_MISSING');
}
async function fetchJson(url,init={}){
  const response=await fetch(url,{...init,headers:{'cache-control':'no-cache',...(init.headers||{})},signal:AbortSignal.timeout(15000)});
  const raw=await response.text();
  let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  return {status:response.status,ok:response.ok,data,raw:raw.slice(0,500),headers:response.headers};
}
async function proveIdentity(host,label){
  for(let attempt=1;attempt<=36;attempt++){
    try{
      const [rv,dr,pr]=await Promise.all([
        fetchJson(host+'/api/release-version?proof='+Date.now()),
        fetchJson(host+'/api/diva-release?proof='+Date.now()),
        fetchJson(host+'/api/preview-readiness?proof='+Date.now())
      ]);
      if(rv.data?.sourceSha===SOURCE_SHA&&dr.data?.deploymentSha===SOURCE_SHA&&pr.data?.sourceSha===SOURCE_SHA&&pr.data?.status==='ready'){
        mark(label+'_IDENTITY_READBACK','PASS',SOURCE_SHA);
        return;
      }
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error(label+'_EXACT_SHA_READBACK_FAIL');
}
async function releaseTarget(target,label){
  state.phase='RELEASE_'+label;
  writeConfig(target);
  await run('npx',['-y','@wix/cli@latest','release'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
  mark(label+'_RELEASE_DISPATCH');
  await proveIdentity(target.host,label);
}
async function main(){
  try{
    await syncSource();
    await qaAndBuild();
    await ensureAuth();
    if(RELEASE_QA_FIRST)await releaseTarget(QA,'QA');
    await releaseTarget(LIVE,'LIVE');
    await proveIdentity(CANONICAL,'CANONICAL');
    state.phase='DONE';state.ok=true;state.released=true;state.status='OS_LIVE_EXACT_SHA_VERIFIED';
    console.log('OS_LIVE_EXACT_SHA_VERIFIED '+JSON.stringify({sourceSha:SOURCE_SHA}));
  }catch(error){
    state.phase='ERROR';state.ok=false;state.released=false;state.status='BLOCKED';state.error=String(error?.stack||error);
    console.error('OS_LIVE_EXACT_SHA_BLOCKED '+state.error);
  }
}
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.setHeader('cache-control','no-store');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>{console.log('OS_EXACT_GITLAB_RELEASE_CONTROLLER_READY');void main();});
