import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA=String(process.env.TARGET_SOURCE_SHA||'20daa504b8cd514e8cca2ab4f700f47b3cce0c9e').trim();
const MIRROR_SHA='ff5b902047002f59181b37284ed5c3f389416e56';
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const REL=path.join(ROOT,'.wix-os-orbi-release');
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';
const state={phase:'BOOT',sourceSha:SOURCE_SHA,userCode:null,verificationUri:null,qa:null,live:null,canonical:null,tests:[],error:null,done:false,lastLog:null};

function log(x){console.log(x);state.lastLog=String(x).slice(-1600)}
function run(cmd,args,{cwd=ROOT,env={}}={}){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>process.stdout.write(d));p.stderr.on('data',d=>process.stderr.write(d));p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(cmd+' exit '+c)))})}
function writeConfig(t){fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({projectType:'Site',appId:t.appId,siteId:t.siteId,site:{outputDirectory:{client:'./client',server:'./server'}}},null,2))}
async function fetchJson(url){const r=await fetch(url,{headers:{'cache-control':'no-cache'}});if(!r.ok)throw new Error('HTTP_'+r.status+' '+url);return r.json()}

async function fetchExactSource(){
  state.phase='SOURCE';
  const head=spawnSync('git',['rev-parse','HEAD'],{cwd:OS_DIR,encoding:'utf8'}).stdout.trim();
  if(head!==MIRROR_SHA)throw new Error('MIRROR_SHA_MISMATCH '+head);
  for(const file of ['package.json','pages/os/diva.js','data/diva-voice-presence-contract.js','radar-gabi-site/index.html','scripts/qa-diva-orb-silent-presence.mjs']) if(!fs.existsSync(path.join(OS_DIR,file))) throw new Error('SOURCE_FILE_MISSING '+file);
  log('SOURCE_EXACT_MIRROR_PASS gitlab='+SOURCE_SHA+' mirror='+MIRROR_SHA);
}

async function qa(){
  state.phase='QA';
  if(fs.existsSync(path.join(OS_DIR,'node_modules'))){log('NPM_DEPS_REUSE_PASS')}else{await run('npm',['ci','--include=dev'],{cwd:OS_DIR,env:{NODE_ENV:'development'}})};
  const gates=[
    'scripts/qa-diva-orb-silent-presence.mjs',
    'scripts/qa-os-navigation-contract.mjs',
    'scripts/qa-os-navigation-runtime.mjs',
    'scripts/qa-pr-studio-surface.mjs',
    'scripts/qa-diva-face-sync.mjs',
    'scripts/qa-diva-art-direction-core.mjs',
    'scripts/qa-creative-context-ingestion.mjs'
  ];
  for(const gate of gates){await run('node',[gate],{cwd:OS_DIR});state.tests.push({gate,status:'PASS'})}
  const contract=fs.readFileSync(path.join(OS_DIR,'data/diva-voice-presence-contract.js'),'utf8');
  const radar=fs.readFileSync(path.join(OS_DIR,'radar-gabi-site/index.html'),'utf8');
  if(!contract.includes("policy:'CLIENT_SAFE_GABI'"))throw new Error('GABI_CLIENT_SAFE_POLICY_MISSING');
  if(!radar.includes('/api/gabi-diva-studio'))throw new Error('GABI_BROKER_ROUTE_MISSING');
  if(!radar.includes('GABI_RADAR_PUBLIC_SAFE_V3'))throw new Error('GABI_PUBLIC_SAFE_MARKER_MISSING');
  log('GABI_ORBI_CLIENT_SAFE_GUARD_PASS · read-only contract check; no Gabi target in release');
}

async function materialize(runtimeEnv){
  state.phase='BUILD_'+runtimeEnv.toUpperCase().replace('-','_');
  fs.mkdirSync(path.join(OS_DIR,'.release-source'),{recursive:true});
  fs.writeFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),SOURCE_SHA+'\n');
  log('CANONICAL_SHA_STAMPED '+SOURCE_SHA);
  await run('npm',['run','build:wix-worker'],{cwd:OS_DIR,env:{MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,MUNDO_RUNTIME_ENV:runtimeEnv}});
  const entry=fs.readFileSync(path.join(OS_DIR,'dist/wix-server/entry.mjs'),'utf8');
  if(!entry.includes(SOURCE_SHA))throw new Error('BUILD_SHA_MISMATCH '+runtimeEnv);
  fs.rmSync(REL,{recursive:true,force:true});fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});
  log('WIX_BUILD_PASS '+SOURCE_SHA+' '+runtimeEnv);
}

async function ensureAuth(){
  state.phase='WIX_AUTH';
  const env={...process.env,AI_AGENT:'wix-headless-skill'};
  let who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env,timeout:30000});
  if(who.status===0){log('WIX_AUTH_ALREADY_VALID');return}

  log('WIX_DEVICE_LOGIN_START');
  await new Promise((resolve,reject)=>{
    const p=spawn('npx',['-y','@wix/cli@latest','login'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
    let buffer='';
    const timer=setTimeout(()=>{try{p.kill('SIGKILL')}catch{};reject(new Error('WIX_DEVICE_LOGIN_TIMEOUT'))},10*60*1000);
    p.stdout.on('data',d=>{
      const s=String(d);process.stdout.write(s);buffer+=s;
      for(const line of buffer.split('\n')){
        try{
          const event=JSON.parse(line.trim());
          if(event.event==='awaiting_user'){
            state.userCode=event.userCode||null;
            state.verificationUri=event.verificationUri||null;
            log('DIVA_WIX_AWAITING_USER '+JSON.stringify({userCode:state.userCode,verificationUri:state.verificationUri,expiresInSeconds:event.expiresInSeconds||null}));
          }
        }catch{}
      }
    });
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',e=>{clearTimeout(timer);reject(e)});
    p.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(new Error('WIX_DEVICE_LOGIN_EXIT_'+code))});
  });
  who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env,timeout:30000});
  if(who.status!==0)throw new Error('WIX_WHOAMI_FAILED_AFTER_LOGIN');
  log('WIX_AUTH_PASS');
}

async function prove(host,label,expectedEnv){
  for(let i=1;i<=36;i++){
    try{
      const dr=await fetchJson(host+'/api/diva-release?proof='+Date.now());
      const pr=await fetchJson(host+'/api/preview-readiness?proof='+Date.now());
      if(dr.deploymentSha===SOURCE_SHA&&pr.sourceSha===SOURCE_SHA&&pr.status==='ready'&&(!expectedEnv||dr.runtimeEnv===expectedEnv)){
        log(label+'_EXACT_SHA_PASS '+SOURCE_SHA+(expectedEnv?' env='+expectedEnv:''));
        return{dr,pr};
      }
    }catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error(label+'_EXACT_SHA_READBACK_FAIL');
}

async function release(target,label,runtimeEnv){
  await materialize(runtimeEnv);
  writeConfig(target);
  state.phase='RELEASE_'+label;
  await run('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
  return prove(target.host,label,runtimeEnv);
}

async function main(){
  try{
    await fetchExactSource();
    await qa();
    await ensureAuth();
    state.qa=await release(QA,'QA','wix-qa');
    state.live=await release(LIVE,'LIVE','wix-live');
    state.phase='PROVE_CANONICAL';
    state.canonical=await prove(CANONICAL,'CANONICAL','wix-live');
    state.phase='DONE';state.done=true;
    log('DIVA_ORBI_DIA_A_DIA_RELEASE_COMPLETE '+SOURCE_SHA);
  }catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error)}
}

http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))})
  .listen(PORT,'0.0.0.0',()=>{log('DIVA_ORBI_DIA_A_DIA_CONTROL_READY '+PORT);main()});
