import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const PORT=process.env.PORT||10000;
const SOURCE_SHA='c8c2b70cb42888509738240c9c357e60d5481ee8';
const SOURCE_REPO='https://github.com/mundinhocomunicacao-ctrl/mundinho-os-live.git';
const SOURCE_REF='sync/os-reference-restore-c8c2b70c';
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';
const ROOT=process.cwd(), SRC=path.join(ROOT,'os'), REL=path.join(ROOT,'.wix-os-reference-release');
const state={phase:'BOOT',sourceSha:SOURCE_SHA,sourceRef:SOURCE_REF,userCode:null,verificationUri:null,qa:null,live:null,canonical:null,error:null,done:false};

function run(cmd,args,{cwd=ROOT,env={}}={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(d));
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);
    p.on('close',c=>c===0?resolve():reject(new Error(cmd+' exit '+c)));
  });
}
function sh(cmd,cwd=ROOT){
  const r=spawnSync('bash',['-lc',cmd],{cwd,encoding:'utf8',env:process.env,maxBuffer:64*1024*1024});
  if(r.stdout)process.stdout.write(r.stdout);
  if(r.stderr)process.stderr.write(r.stderr);
  if(r.status!==0)throw new Error('shell failed '+r.status+': '+cmd);
  return r.stdout.trim();
}
function writeConfig(target){
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({
    projectType:'Site',appId:target.appId,siteId:target.siteId,
    site:{outputDirectory:{client:'./client',server:'./server'}}
  },null,2));
}
async function login(){
  state.phase='WIX_AUTH';
  const env={...process.env,AI_AGENT:'wix-headless-skill'};
  const who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env});
  if(who.status===0){console.log('WIX_ALREADY_LOGGED_IN '+who.stdout.trim());return;}
  await new Promise((resolve,reject)=>{
    const p=spawn('npx',['-y','@wix/cli@latest','login'],{env,stdio:['ignore','pipe','pipe']});
    let buf='';
    const onData=d=>{
      const s=String(d);process.stdout.write(s);buf+=s;
      for(const line of buf.split('\n')){
        try{
          const ev=JSON.parse(line.trim());
          if(ev.event==='awaiting_user'){
            state.userCode=ev.userCode;state.verificationUri=ev.verificationUri;
            console.log('DIVA_WIX_AWAITING_USER '+JSON.stringify({userCode:ev.userCode,verificationUri:ev.verificationUri,expiresInSeconds:ev.expiresInSeconds}));
          }
        }catch{}
      }
    };
    p.stdout.on('data',onData);p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error('wix login exit '+c)));
  });
  const after=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env});
  if(after.status!==0)throw new Error('WIX_WHOAMI_FAILED_AFTER_LOGIN');
  console.log('WIX_AUTH_PASS '+after.stdout.trim());
}
function fetchJson(url){
  const out=sh(`curl -fsSL --retry 5 --retry-all-errors "${url}"`);
  return JSON.parse(out||'{}');
}
async function prove(host,label){
  for(let i=1;i<=40;i++){
    try{
      const dr=fetchJson(host+'/api/diva-release?proof='+Date.now());
      if(dr.deploymentSha===SOURCE_SHA){
        console.log(label+'_SHA_PASS '+JSON.stringify(dr));
        return dr;
      }
    }catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error(label+'_SHA_READBACK_FAIL');
}
function sourceGate(){
  const must=[
    ["pages/os/index.js","export {default,getServerSideProps} from './inicio';"],
    ["components/CanonicalGlobalNavigation.js","['agenda','Agenda'"],
    ["components/CanonicalGlobalNavigation.js","['pipeline','Pipeline'"],
    ["components/CanonicalGlobalNavigation.js","['workspace','Workspace'"],
    ["components/CanonicalGlobalNavigation.js","['explorer','Explorer'"],
    ["components/CanonicalGlobalNavigation.js","['configuracoes','Configurações'"],
    ["data/social-insights-contract.js","INTERNAL_MUNDINHO"],
    ["data/social-insights-contract.js","primaryNetworks:['Instagram','TikTok','Kwai','YouTube']"],
    ["components/OperationalCharts.js","data-chart-live"],
    ["pages/os/social.js","POR QUE ESTÁ AQUI"],
    ["pages/os/social.js","O QUE CONTRIBUI"],
    ["pages/os/social.js","SocialConversation"],
    ["pages/os/propostas.js","Refinar"],
    ["pages/os/propostas.js","Regenerar"]
  ];
  for(const [file,needle] of must){
    const value=fs.readFileSync(path.join(SRC,file),'utf8');
    if(!value.includes(needle))throw new Error('SOURCE_GATE_FAIL '+file+' :: '+needle);
  }
  const mesa=fs.readFileSync(path.join(SRC,'components/InicioDecisionDesk.js'),'utf8');
  if(!/#FFE4EF|#F6A8C8|#EF6A9F|#D94A86/.test(mesa))throw new Error('DIVA_PINK_REFERENCE_GATE_FAIL');
  console.log('REFERENCE_SOURCE_GATE_PASS '+SOURCE_SHA);
}
async function main(){
  try{
    state.phase='SOURCE';
    if(!fs.existsSync(path.join(SRC,'package.json')))throw new Error('OS_SUBMODULE_MISSING');
    const marker=fs.readFileSync(path.join(SRC,'.release-source/canonical-sha.txt'),'utf8').trim();
    if(marker!==SOURCE_SHA)throw new Error('SOURCE_MARKER_MISMATCH '+marker);
    sourceGate();

    state.phase='TEST_BUILD';
    const lockPath=path.join(SRC,'package-lock.json');
    const vendored=path.join(ROOT,'deploy/os-wix-bridge/os-package-lock-c8c2.json');
    if(!fs.existsSync(vendored))throw new Error('VENDORED_PACKAGE_LOCK_MISSING');
    fs.copyFileSync(vendored,lockPath);
    console.log('PACKAGE_LOCK_EXACT_COPY',fs.statSync(lockPath).size);
    sh(`pwd; ls -lah package.json package-lock.json; node -e "const x=require('./package-lock.json'); console.log('LOCKFILE_VERSION',x.lockfileVersion,'LOCK_NAME',x.name)"`,SRC);
    sh('npx -y npm@10.9.4 ci --no-audit --no-fund',SRC);
    const gates=[
      'node scripts/qa-os-navigation-contract.mjs',
      'node scripts/qa-os-navigation-runtime.mjs',
      'node scripts/qa-os-visual-reference-manifest.mjs',
      'node scripts/qa-os-definitivo-5pages.mjs',
      'node scripts/qa-social-insights-live-grid.mjs',
      'node scripts/qa-social-content-first.mjs',
      'node scripts/qa-os-visual-language.mjs',
      'node scripts/qa-mobile-contract-sync.mjs'
    ];
    for(const g of gates)sh(g,SRC);
    sh(`MUNDO_RUNTIME_SOURCE_SHA=${SOURCE_SHA} MUNDO_RUNTIME_ENV=wix-live npm run build:wix-worker`,SRC);
    const entry=fs.readFileSync(path.join(SRC,'dist/wix-server/entry.mjs'),'utf8');
    if(!entry.includes(SOURCE_SHA))throw new Error('BUILD_SHA_MISMATCH');
    console.log('REFERENCE_BUILD_PASS '+SOURCE_SHA);

    await login();

    state.phase='PACKAGE';
    fs.rmSync(REL,{recursive:true,force:true});fs.mkdirSync(REL,{recursive:true});
    fs.cpSync(path.join(SRC,'dist/client'),path.join(REL,'client'),{recursive:true});
    fs.cpSync(path.join(SRC,'dist/wix-server'),path.join(REL,'server'),{recursive:true});

    state.phase='RELEASE_QA';writeConfig(QA);
    await run('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
    state.qa=await prove(QA.host,'QA');

    state.phase='RELEASE_LIVE';writeConfig(LIVE);
    await run('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
    state.live=await prove(LIVE.host,'LIVE');

    state.phase='PROVE_CANONICAL';
    state.canonical=await prove(CANONICAL,'CANONICAL');
    state.phase='DONE';state.done=true;
  }catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error);}
}
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>{console.log('DIVA_OS_REFERENCE_RELEASE_READY '+PORT);main();});
