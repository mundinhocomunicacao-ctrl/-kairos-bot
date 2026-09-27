import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const PORT=process.env.PORT||10000;
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const REL=path.join(ROOT,'.wix-qa-release');
const SOURCE_SHA='8f9e456d0d337fd436a64e5f875e5d5874092f6f';
const MIRROR_COMMIT='f5889c802b912593cfc0e9c1578926539f499c49';
const QA={
  siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',
  appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',
  host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'
};
const gates=[
  'scripts/qa-os-navigation-contract.mjs',
  'scripts/qa-os-navigation-runtime.mjs',
  'scripts/qa-os-navigation-usage-order.mjs',
  'scripts/qa-os-ideas-primary-area.mjs',
  'scripts/qa-os-visual-reference-manifest.mjs',
  'scripts/qa-os-visual-language.mjs',
  'scripts/qa-social-insights-live-grid.mjs',
  'scripts/qa-social-content-first.mjs',
  'scripts/qa-social-insights-content-data-live.mjs',
  'scripts/qa-mobile-contract-sync.mjs',
  'scripts/qa-wix-packager-canonical-source-marker.mjs'
];
const state={
  phase:'BOOT',
  sourceSha:SOURCE_SHA,
  mirrorCommit:MIRROR_COMMIT,
  qaSiteId:QA.siteId,
  tests:[],
  build:null,
  auth:{status:'NOT_STARTED',userCode:null,verificationUri:null,expiresInSeconds:null},
  release:{attempted:false,status:'NOT_STARTED'},
  readback:null,
  productionAttempted:false,
  mutation:false,
  done:false,
  error:null
};

function log(message){console.log(message);state.lastLog=String(message).slice(-1500)}
function run(cmd,args,{cwd=ROOT,env={}}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(d));
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error(cmd+'_EXIT_'+code)));
  });
}
function curlJson(url){
  const r=spawnSync('curl',['-fsSL','--retry','3','--retry-all-errors','--retry-delay','2',url],{encoding:'utf8'});
  if(r.status!==0) throw new Error('CURL_FAIL '+url+' '+(r.stderr||'').trim());
  return JSON.parse(r.stdout||'{}');
}
function prepareRelease(){
  fs.rmSync(REL,{recursive:true,force:true});
  fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({
    projectType:'Site',
    appId:QA.appId,
    siteId:QA.siteId,
    site:{outputDirectory:{client:'./client',server:'./server'}}
  },null,2));
}
async function ensureAuth(){
  state.phase='WIX_AUTH_CHECK';
  state.auth.status='CHECKING';
  const env={...process.env,AI_AGENT:'wix-headless-skill'};
  const who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env});
  if(who.status===0){
    state.auth.status='VALID_SESSION';
    log('WIX_AUTH_VALID_SESSION');
    return;
  }
  state.phase='WIX_DEVICE_AUTH';
  state.auth.status='AWAITING_USER';
  await new Promise((resolve,reject)=>{
    const p=spawn('npx',['-y','@wix/cli@latest','login'],{cwd:REL,env,stdio:['ignore','pipe','pipe']});
    let buffer='';
    const consume=(d)=>{
      const s=String(d); process.stdout.write(s); buffer+=s;
      const lines=buffer.split('\n'); buffer=lines.pop()||'';
      for(const raw of lines){
        const line=raw.trim(); if(!line) continue;
        try{
          const e=JSON.parse(line);
          if(e.event==='awaiting_user'){
            state.auth.userCode=e.userCode||null;
            state.auth.verificationUri=e.verificationUri||e.verificationUriComplete||null;
            state.auth.expiresInSeconds=e.expiresInSeconds||e.expiresIn||null;
            log('WIX_DEVICE_AUTH_REQUIRED '+JSON.stringify({
              userCode:state.auth.userCode,
              verificationUri:state.auth.verificationUri,
              expiresInSeconds:state.auth.expiresInSeconds
            }));
          }
        }catch{}
      }
    };
    p.stdout.on('data',consume);
    p.stderr.on('data',consume);
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error('WIX_LOGIN_EXIT_'+code)));
  });
  const after=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env});
  if(after.status!==0) throw new Error('WIX_AUTH_NOT_CONFIRMED');
  state.auth.status='AUTHENTICATED';
  log('WIX_AUTH_CONFIRMED');
}
async function proveQa(){
  state.phase='QA_READBACK';
  for(let i=1;i<=30;i++){
    try{
      const nonce=Date.now()+'-'+i;
      const rv=curlJson(QA.host+'/api/release-version?proof='+nonce);
      const dr=curlJson(QA.host+'/api/diva-release?proof='+nonce);
      const pr=curlJson(QA.host+'/api/preview-readiness?proof='+nonce);
      const ok=rv.sourceSha===SOURCE_SHA &&
        dr.deploymentSha===SOURCE_SHA &&
        pr.sourceSha===SOURCE_SHA &&
        pr.status==='ready';
      if(ok){
        state.readback={
          status:'PASS',
          sourceSha:SOURCE_SHA,
          release:rv.release||null,
          deploymentId:dr.deploymentId||null,
          readiness:pr.status,
          writebackReady:pr.capabilities?.writebackReady===true,
          sessionReady:pr.capabilities?.sessionReady===true
        };
        log('ISOLATED_QA_EXACT_SHA_READBACK_PASS '+JSON.stringify(state.readback));
        return;
      }
      state.readback={status:'WAITING',observed:{rv:rv.sourceSha||null,dr:dr.deploymentSha||null,pr:pr.sourceSha||null,readiness:pr.status||null}};
    }catch(e){ state.readback={status:'WAITING',error:String(e)}; }
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error('ISOLATED_QA_EXACT_SHA_READBACK_FAIL');
}
async function main(){
  try{
    state.phase='SOURCE_PROOF';
    const marker=fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8').trim();
    if(marker!==SOURCE_SHA) throw new Error('SOURCE_MARKER_MISMATCH '+marker);
    log('SOURCE_MARKER_PASS '+SOURCE_SHA);

    state.phase='DEPENDENCIES';
    const vinextBin=path.join(OS_DIR,'node_modules','.bin','vinext');
    if(fs.existsSync(vinextBin)){
      log('DEPENDENCIES_REUSED_FROM_RENDER_BUILD');
    }else{
      state.phase='INSTALL';
      await run('npm',['ci'],{cwd:OS_DIR,env:{NODE_ENV:'development'}});
      log('DEPENDENCIES_INSTALLED_AT_RUNTIME');
    }

    state.phase='QA_GATES';
    for(const gate of gates){
      await run('node',[gate],{cwd:OS_DIR});
      state.tests.push({gate,status:'PASS'});
    }
    log('QA_GATES_PASS '+state.tests.length);

    state.phase='BUILD_PROOF';
    const entryPath=path.join(OS_DIR,'dist/wix-server/entry.mjs');
    if(!fs.existsSync(entryPath))throw new Error('PREBUILT_WIX_BUNDLE_MISSING');
    const entry=fs.readFileSync(entryPath,'utf8');
    if(!entry.includes(SOURCE_SHA))throw new Error('PREBUILT_WIX_BUNDLE_SHA_MISMATCH');
    state.build={status:'PASS',sourceSha:SOURCE_SHA,mode:'REUSED_RENDER_BUILD'};
    log('WIX_PREBUILT_EXACT_SHA_PASS '+SOURCE_SHA);

    prepareRelease();
    await ensureAuth();

    state.phase='RELEASE_QA';
    state.release={attempted:true,status:'RUNNING'};
    state.mutation=true;
    await run('npx',['-y','@wix/cli@latest','release','--comment','Mundinho OS isolated QA '+SOURCE_SHA],{
      cwd:REL,
      env:{CI:'1',AI_AGENT:'wix-headless-skill'}
    });
    state.release.status='SUBMITTED';
    log('WIX_ISOLATED_QA_RELEASE_SUBMITTED '+SOURCE_SHA);

    await proveQa();
    state.phase='DONE';
    state.release.status='PROVEN';
    state.done=true;
    log('DIVA_OS_ISOLATED_QA_COMPLETE '+SOURCE_SHA);
  }catch(e){
    state.phase='ERROR';
    state.error=String(e?.stack||e);
    console.error(state.error);
  }
}
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>{
  log('DIVA_OS_QA_ONLY_CONTROL_READY '+PORT);
  main();
});
