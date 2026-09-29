import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA='5257e5aecb9da5aa48eb39c9d90be54c2f810222';
const MIRROR_SHA='ef51cb5938aca40e9ee2023e4098cab28443a965';
const APPROVAL='REC-20260929-HUMAN-APPROVAL-GATE-001';
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const REL=path.join(ROOT,'.wix-os-full-rollout-071a');
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';

let state={phase:'BOOT',ok:false,released:false,sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,approval:APPROVAL,tests:[],error:null};

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
  if(mirror!==MIRROR_SHA) throw new Error('MIRROR_SHA_MISMATCH:'+mirror);
  const marker=String(fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8')).trim();
  if(marker!==SOURCE_SHA) throw new Error('SOURCE_MARKER_MISMATCH:'+marker);
  mark('SOURCE_PARITY','PASS',SOURCE_SHA+' mirror='+MIRROR_SHA);
}
async function qaAndBuild(){
  state.phase='QA_BUILD';
  await run('node',['scripts/qa-malha-human-command.mjs'],OS_DIR);
  mark('QA_MALHA_HUMAN_COMMAND');
  await run('npm',['ci'],OS_DIR);
  mark('NPM_CI');
  await run('npm',['run','qa:release'],OS_DIR);
  mark('QA_RELEASE');
  await run('npm',['run','build:vinext'],OS_DIR);
  mark('BUILD_VINEXT');
  await run('npm',['run','build:wix-worker'],OS_DIR,{MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,MUNDO_RUNTIME_ENV:'wix-qa'});
  const entry=path.join(OS_DIR,'dist/wix-server/entry.mjs');
  if(!fs.existsSync(entry)) throw new Error('WIX_WORKER_ENTRY_MISSING');
  const built=fs.readFileSync(entry,'utf8');
  if(!built.includes(SOURCE_SHA)) throw new Error('WIX_WORKER_SOURCE_SHA_MISMATCH');
  mark('BUILD_WIX_WORKER','PASS',SOURCE_SHA);
  fs.rmSync(REL,{recursive:true,force:true});
  fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});
}
function writeConfig(target){
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({
    projectType:'Site',
    appId:target.appId,
    siteId:target.siteId,
    site:{outputDirectory:{client:'./client',server:'./server'}}
  },null,2));
}
async function ensureAuth(){
  state.phase='AUTH';
  for(const alias of ['WIX_OS_API_KEY','WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY']){
    const value=String(process.env[alias]||'').trim();
    if(!value) continue;
    await run('npx',['-y','@wix/cli@latest','login','--api-key',value],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    mark('WIX_AUTH','PASS',alias);
    return alias;
  }
  try{
    const who=sh('npx',['-y','@wix/cli@latest','whoami'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    if(who){mark('WIX_AUTH','PASS','cached');return 'cached';}
  }catch{}
  throw new Error('WIX_AUTH_MISSING');
}
async function fetchJson(url){
  const res=await fetch(url,{headers:{'cache-control':'no-cache'}});
  const raw=await res.text();
  let data={}; try{data=raw?JSON.parse(raw):{}}catch{}
  return {ok:res.ok,status:res.status,data,raw:raw.slice(0,500)};
}
async function prove(host,label){
  for(let i=1;i<=36;i++){
    try{
      const [rv,dr,pr]=await Promise.all([
        fetchJson(host+'/api/release-version?proof='+Date.now()),
        fetchJson(host+'/api/diva-release?proof='+Date.now()),
        fetchJson(host+'/api/preview-readiness?proof='+Date.now())
      ]);
      const source=rv.data?.sourceSha||pr.data?.sourceSha||dr.data?.deploymentSha;
      const ready=pr.data?.status;
      if(source===SOURCE_SHA && dr.data?.deploymentSha===SOURCE_SHA && ready==='ready'){
        const proof={releaseVersion:rv.data,divaRelease:dr.data,previewReadiness:pr.data};
        mark(label+'_READBACK','PASS',SOURCE_SHA);
        return proof;
      }
    }catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error(label+'_EXACT_SHA_READBACK_FAIL');
}
async function releaseTarget(target,label,runtimeEnv){
  state.phase='RELEASE_'+label;
  writeConfig(target);
  await run('npx',['-y','@wix/cli@latest','release'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
  mark(label+'_RELEASE_DISPATCH');
  const proof=await prove(target.host,label);
  return proof;
}
async function main(){
  try{
    console.log('OS_FULL_ROLLOUT_CONTROLLER_START '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,approval:APPROVAL}));
    await syncSource();
    await qaAndBuild();
    state.authAlias=await ensureAuth();
    state.qa=await releaseTarget(QA,'QA','wix-qa');
    state.live=await releaseTarget(LIVE,'LIVE','wix-live');
    state.canonical=await prove(CANONICAL,'CANONICAL');
    state.phase='DONE';state.ok=true;state.released=true;state.status='OS_FULL_ROLLOUT_VERIFIED';
    console.log('OS_FULL_ROLLOUT_VERIFIED '+JSON.stringify({sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,approval:APPROVAL}));
  }catch(error){
    state.phase='ERROR';state.ok=false;state.released=false;state.status='BLOCKED';
    state.error=String(error?.stack||error);
    console.error('OS_FULL_ROLLOUT_BLOCKED '+state.error);
  }
}
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>{
  console.log('OS_FULL_ROLLOUT_CONTROLLER_READY');
  void main();
});
