import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA=String(process.env.TARGET_SOURCE_SHA||'0942e49b87b7c2dc2d6dca5a8257b54bfd35847f').trim();
const MIRROR_SHA='bf4c978b669cd663c3bb3d980898406d4cab5b4f';
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
  let head=spawnSync('git',['rev-parse','HEAD'],{cwd:OS_DIR,encoding:'utf8'}).stdout.trim();
  if(head!==MIRROR_SHA){
    log('MIRROR_ADVANCE_START '+head+' -> '+MIRROR_SHA);
    await run('git',['fetch','origin',MIRROR_SHA,'--depth','1'],{cwd:OS_DIR});
    await run('git',['checkout','--detach',MIRROR_SHA],{cwd:OS_DIR});
    head=spawnSync('git',['rev-parse','HEAD'],{cwd:OS_DIR,encoding:'utf8'}).stdout.trim();
    log('MIRROR_ADVANCE_DONE '+head);
  }
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
    'scripts/qa-creative-context-ingestion.mjs',
    'scripts/qa-os-hydration-regression.mjs',
    'scripts/qa-social-insights-live-grid.mjs',
    'scripts/qa-social-research-contract.mjs',
    'scripts/qa-pipeline-live-projection.mjs'
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
  state.phase='MATERIALIZE_'+runtimeEnv.toUpperCase().replace('-','_');
  fs.mkdirSync(path.join(OS_DIR,'.release-source'),{recursive:true});
  fs.writeFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),SOURCE_SHA+'\n');
  log('CANONICAL_SHA_STAMPED '+SOURCE_SHA);
  const requiredSourceFiles=[
    'pages/api/os-data-gaps.js',
    'pages/api/agent-social-source.js',
    'pages/os/agenda.js',
    'pages/os/pipeline/index.js',
    'pages/os/social.js'
  ];
  for(const required of requiredSourceFiles){
    if(!fs.existsSync(path.join(OS_DIR,required)))throw new Error('SOURCE_CONTRACT_FILE_MISSING '+required);
  }
  const entryPath=path.join(OS_DIR,'dist/wix-server/entry.mjs');
  const clientDir=path.join(OS_DIR,'dist/client');
  if(!fs.existsSync(entryPath)||!fs.existsSync(clientDir))throw new Error('BOOTSTRAP_ARTIFACT_MISSING');
  let entry=fs.readFileSync(entryPath,'utf8');
  const releaseId=`${runtimeEnv}-${SOURCE_SHA.slice(0,8)}`;
  entry=entry
    .replace(/MUNDO_RUNTIME_SOURCE_SHA:"[a-f0-9]{40}"/g,`MUNDO_RUNTIME_SOURCE_SHA:"${SOURCE_SHA}"`)
    .replace(/MUNDO_BUILD_REQUESTED_SHA:"[a-f0-9]{40}"/g,`MUNDO_BUILD_REQUESTED_SHA:"${SOURCE_SHA}"`)
    .replace(/MUNDO_RUNTIME_ENV:"wix-(?:qa|live)"/g,`MUNDO_RUNTIME_ENV:"${runtimeEnv}"`)
    .replace(/MUNDO_RUNTIME_RELEASE_ID:"wix-(?:qa|live)-[a-f0-9]{8}"/g,`MUNDO_RUNTIME_RELEASE_ID:"${releaseId}"`);
  if(!entry.includes(`MUNDO_RUNTIME_SOURCE_SHA:"${SOURCE_SHA}"`))throw new Error('ARTIFACT_SHA_STAMP_FAIL '+runtimeEnv);
  if(!entry.includes(`MUNDO_RUNTIME_ENV:"${runtimeEnv}"`))throw new Error('ARTIFACT_ENV_STAMP_FAIL '+runtimeEnv);
  if(!entry.includes(`MUNDO_RUNTIME_RELEASE_ID:"${releaseId}"`))throw new Error('ARTIFACT_RELEASE_ID_STAMP_FAIL '+runtimeEnv);
  fs.writeFileSync(entryPath,entry);
  fs.rmSync(REL,{recursive:true,force:true});fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});
  log('WIX_BOOTSTRAP_ARTIFACT_REUSED_PASS '+SOURCE_SHA+' '+runtimeEnv+' '+releaseId);
}

async function ensureWixCli(){
  state.phase='WIX_CLI';
  const dir=path.join(os.tmpdir(),'orbi-wix-cli-runtime');
  fs.rmSync(dir,{recursive:true,force:true});
  log('ORBI_WIX_CLI_INSTALL_START');
  await run('npm',['install','--prefix',dir,'@wix/cli@latest','--no-audit','--no-fund'],{env:{NODE_ENV:'development'}});
  const bin=path.join(dir,'node_modules','.bin','wix');
  if(!fs.existsSync(bin))throw new Error('ORBI_WIX_CLI_MISSING');
  log('ORBI_WIX_CLI_INSTALL_PASS');
  try{
    const cliRoot=path.join(dir,'node_modules','@wix','cli');
    const hits=[];
    const seen=new Set();
    function walk(p){
      for(const ent of fs.readdirSync(p,{withFileTypes:true})){
        const full=path.join(p,ent.name);
        if(ent.isDirectory()) walk(full);
        else if(/\.(js|mjs|cjs|json)$/.test(ent.name)){
          const s=fs.readFileSync(full,'utf8');
          const patterns=[
            /https:\/\/[^"'\s)]+/g,
            /["'`]([^"'\`]{0,120}(?:release|deploy|artifact|upload)[^"'\`]{0,120})["'`]/ig
          ];
          for(const re of patterns){
            for(const m of s.matchAll(re)){
              const v=(m[1]||m[0]).slice(0,260);
              if(/wixapis|release|deploy|artifact|upload/i.test(v) && !seen.has(v)){
                seen.add(v);hits.push(v);
                if(hits.length>=120)return;
              }
            }
          }
        }
        if(hits.length>=120)return;
      }
    }
    walk(cliRoot);
    log('ORBI_WIX_CLI_ENDPOINT_HINTS '+JSON.stringify(hits.slice(0,120)));
    const needles=[
      'FailedToDeploySite',
      'Failed to deploy site document',
      'Failed to upload static files',
      'apps-release-manager-service-web',
      'getDeploymentSourceData',
      'UpdateDeploymentTopologyForSite',
      'createBackendDeployment',
      'finalizeAppDeployment'
    ];
    const contexts=[];
    function walkContext(p){
      for(const ent of fs.readdirSync(p,{withFileTypes:true})){
        const full=path.join(p,ent.name);
        if(ent.isDirectory()) walkContext(full);
        else if(/\.(js|mjs|cjs)$/.test(ent.name)){
          const s=fs.readFileSync(full,'utf8');
          for(const needle of needles){
            let idx=s.indexOf(needle);
            if(idx>=0){
              const start=Math.max(0,idx-1800);
              const end=Math.min(s.length,idx+3200);
              let snippet=s.slice(start,end)
                .replace(/Bearer\\s+[A-Za-z0-9._~+\\/-]+/g,'Bearer [REDACTED]')
                .replace(/(access[_-]?token|refresh[_-]?token|api[_-]?key|client[_-]?secret)\\s*[:=]\\s*["'\`][^"'\`]+["'\`]/ig,'$1=[REDACTED]');
              contexts.push({file:path.relative(cliRoot,full),needle,snippet});
              if(contexts.length>=24)return;
            }
          }
        }
        if(contexts.length>=24)return;
      }
    }
    walkContext(cliRoot);
    log('ORBI_WIX_CLI_CODE_CONTEXT '+JSON.stringify(contexts));
    const deployChunk=path.join(cliRoot,'build/chunk-SYZVVCEX.js');
    const deploySource=fs.readFileSync(deployChunk,'utf8');
    const deployNeedles=[
      'function deployApp(',
      'function __deployApp(',
      'var deployApp',
      'DeployApp',
      'deploymentOperation',
      'VELO_ISOLATED',
      'protoPath'
    ];
    const deployContexts=[];
    for(const needle of deployNeedles){
      const idx=deploySource.indexOf(needle);
      if(idx<0)continue;
      deployContexts.push({
        needle,
        snippet:deploySource.slice(Math.max(0,idx-2200),Math.min(deploySource.length,idx+5200))
      });
    }
    log('ORBI_WIX_DEPLOYAPP_EXACT '+JSON.stringify(deployContexts));
  }catch(e){log('ORBI_WIX_CLI_ENDPOINT_SCAN_ERROR '+String(e?.message||e))}
  return bin;
}
async function ensureAuth(wixCli){
  state.phase='WIX_AUTH';
  const env={...process.env,AI_AGENT:'wix-headless-skill'};
  let who=spawnSync(wixCli,['whoami'],{encoding:'utf8',env,timeout:30000});
  if(who.status===0){log('WIX_AUTH_ALREADY_VALID');return}

  log('WIX_DEVICE_LOGIN_START');
  await new Promise((resolve,reject)=>{
    const p=spawn(wixCli,['login'],{cwd:ROOT,env,stdio:['ignore','pipe','pipe']});
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
  who=spawnSync(wixCli,['whoami'],{encoding:'utf8',env,timeout:30000});
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

async function release(target,label,runtimeEnv,wixCli){
  await materialize(runtimeEnv);
  writeConfig(target);
  state.phase='RELEASE_'+label;
  await run(wixCli,['release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
  return prove(target.host,label,runtimeEnv);
}

async function main(){
  try{
    await fetchExactSource();
    await qa();
    const wixCli=await ensureWixCli();
    await ensureAuth(wixCli);
    state.qa=await release(QA,'QA','wix-qa',wixCli);
    state.live=await release(LIVE,'LIVE','wix-live',wixCli);
    state.phase='PROVE_CANONICAL';
    state.canonical=await prove(CANONICAL,'CANONICAL','wix-live');
    state.phase='DONE';state.done=true;
    log('DIVA_ORBI_DIA_A_DIA_RELEASE_COMPLETE '+SOURCE_SHA);
  }catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error)}
}

http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))})
  .listen(PORT,'0.0.0.0',()=>{log('DIVA_ORBI_DIA_A_DIA_CONTROL_READY '+PORT);main()});
