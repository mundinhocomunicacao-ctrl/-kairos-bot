import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const PORT=process.env.PORT||10000;
const SOURCE_SHA='44695f53e34502bd654c027f08ba1290311ca85f';
const ARTIFACT_URL='https://mundinho-os-main-44695f53-artifact.onrender.com/artifact';
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';
const ROOT=process.cwd(), REL=path.join(ROOT,'.wix-os-release');
const state={phase:'BOOT',sourceSha:SOURCE_SHA,userCode:null,verificationUri:null,qa:null,live:null,canonical:null,error:null,done:false};

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
  const r=spawnSync('bash',['-lc',cmd],{cwd,encoding:'utf8',env:process.env});
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
  const who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env:{...process.env,AI_AGENT:'wix-headless-skill'}});
  if(who.status===0){console.log('WIX_ALREADY_LOGGED_IN');return;}
  await new Promise((resolve,reject)=>{
    const p=spawn('npx',['-y','@wix/cli@latest','login'],{
      env:{...process.env,AI_AGENT:'wix-headless-skill'},
      stdio:['ignore','pipe','pipe']
    });
    let buf='';
    const onData=d=>{
      const s=String(d); process.stdout.write(s); buf+=s;
      for(const line of buf.split('\n')){
        try{
          const ev=JSON.parse(line.trim());
          if(ev.event==='awaiting_user'){
            state.userCode=ev.userCode; state.verificationUri=ev.verificationUri;
            console.log('DIVA_WIX_AWAITING_USER '+JSON.stringify({userCode:ev.userCode,verificationUri:ev.verificationUri,expiresInSeconds:ev.expiresInSeconds}));
          }
        }catch{}
      }
    };
    p.stdout.on('data',onData); p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject); p.on('close',c=>c===0?resolve():reject(new Error('wix login exit '+c)));
  });
  const after=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env:{...process.env,AI_AGENT:'wix-headless-skill'}});
  if(after.status!==0)throw new Error('WIX_WHOAMI_FAILED_AFTER_LOGIN');
  console.log('WIX_AUTH_PASS '+after.stdout.trim());
}
function fetchJson(url){
  const out=sh(`curl -fsSL --retry 4 --retry-all-errors "${url}"`);
  return JSON.parse(out||'{}');
}
async function prove(host,label){
  for(let i=1;i<=30;i++){
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
async function main(){
  try{
    await login();
    state.phase='FETCH_ARTIFACT';
    fs.rmSync(REL,{recursive:true,force:true}); fs.mkdirSync(REL,{recursive:true});
    sh(`curl -fsSL --retry 8 --retry-all-errors "${ARTIFACT_URL}" -o /tmp/os44695.tar.gz`);
    fs.rmSync('/tmp/os44695',{recursive:true,force:true}); fs.mkdirSync('/tmp/os44695',{recursive:true});
    sh('tar -xzf /tmp/os44695.tar.gz -C /tmp/os44695');
    const entry=fs.readFileSync('/tmp/os44695/dist/wix-server/entry.mjs','utf8');
    if(!entry.includes(SOURCE_SHA))throw new Error('ARTIFACT_SHA_MISMATCH');
    fs.cpSync('/tmp/os44695/dist/client',path.join(REL,'client'),{recursive:true});
    fs.cpSync('/tmp/os44695/dist/wix-server',path.join(REL,'server'),{recursive:true});
    console.log('ARTIFACT_EXACT_SHA_PASS '+SOURCE_SHA);

    state.phase='RELEASE_QA'; writeConfig(QA);
    await run('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
    state.qa=await prove(QA.host,'QA');

    state.phase='RELEASE_LIVE'; writeConfig(LIVE);
    await run('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
    state.live=await prove(LIVE.host,'LIVE');

    state.phase='PROVE_CANONICAL';
    state.canonical=await prove(CANONICAL,'CANONICAL');
    state.phase='DONE'; state.done=true;
  }catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error);}
}
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>{console.log('DIVA_OS_ONLY_RELEASE_CONTROL_READY '+PORT);main();});
