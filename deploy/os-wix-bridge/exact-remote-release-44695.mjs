import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SHA='44695f53e34502bd654c027f08ba1290311ca85f';
const ARTIFACT='https://mundinho-os-main-44695f53-artifact.onrender.com/artifact';
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANON='https://os.mundinhocomunicacao.com';
const ROOT='/tmp/diva-wix-exact-44695';
const REL=path.join(ROOT,'release');
const TRANSCRIPT=path.join(ROOT,'login.typescript');

const state={
  phase:'BOOT',sourceSha:SHA,artifactUrl:ARTIFACT,
  deviceLoginUrl:'https://users.wix.com/login/device-login?color=developer&studio=true&referralInfo=cli',
  deviceCode:null,qa:null,live:null,canonical:null,error:null,done:false,events:[]
};

function event(phase,message){
  state.phase=phase;
  const clean=String(message||'').replace(/\x1b\[[0-?]*[ -\/]*[@-~]/g,'').trim();
  if(clean){
    state.events.push({at:new Date().toISOString(),phase,message:clean.slice(0,1200)});
    if(state.events.length>120) state.events.shift();
    console.log('['+phase+']',clean);
    const m=clean.match(/Copy this code to the clipboard:\s*([A-Z0-9]{6,12})/i);
    if(m) state.deviceCode=m[1].toUpperCase();
  }
}
function run(cmd,args,cwd=ROOT,phase='RUN',envExtra={}){
  return new Promise((resolve,reject)=>{
    const env={...process.env,...envExtra};
    const p=spawn(cmd,args,{cwd,env,stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>event(phase,d));
    p.stderr.on('data',d=>event(phase,d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error(phase+'_EXIT_'+code)));
  });
}
async function fetchJson(url){
  const r=await fetch(url,{headers:{accept:'application/json','cache-control':'no-cache'}});
  const text=await r.text();
  if(!r.ok) throw new Error('HTTP_'+r.status+' '+url+' '+text.slice(0,300));
  return JSON.parse(text);
}
async function waitProof(host,label){
  for(let i=1;i<=36;i++){
    try{
      const [rv,dr,pr]=await Promise.all([
        fetchJson(host+'/api/release-version?proof='+Date.now()+'-'+i),
        fetchJson(host+'/api/diva-release?proof='+Date.now()+'-'+i),
        fetchJson(host+'/api/preview-readiness?proof='+Date.now()+'-'+i)
      ]);
      const ok=rv.sourceSha===SHA && dr.deploymentSha===SHA && pr.sourceSha===SHA && pr.status==='ready';
      const proof={ok,sourceSha:rv.sourceSha||null,deploymentSha:dr.deploymentSha||null,readiness:pr.status||null,deploymentId:dr.deploymentId||null};
      state[label]=proof;
      event('PROOF_'+label.toUpperCase(),JSON.stringify(proof));
      if(ok)return proof;
    }catch(e){event('PROOF_'+label.toUpperCase(),String(e))}
    await new Promise(r=>setTimeout(r,5000));
  }
  throw new Error(label.toUpperCase()+'_EXACT_SHA_READBACK_FAILED');
}
function writeConfig(target){
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({
    projectType:'Site',appId:target.appId,siteId:target.siteId,
    site:{outputDirectory:{client:'./client',server:'./server'}}
  },null,2));
}
async function main(){
  try{
    fs.rmSync(ROOT,{recursive:true,force:true});
    fs.mkdirSync(ROOT,{recursive:true});
    event('ARTIFACT','download exact clean artifact '+SHA);
    await run('curl',['--fail','--show-error','--location','--retry','6',ARTIFACT,'-o',path.join(ROOT,'artifact.tar.gz')],ROOT,'ARTIFACT');
    fs.mkdirSync(path.join(ROOT,'unpack'),{recursive:true});
    await run('tar',['-xzf',path.join(ROOT,'artifact.tar.gz'),'-C',path.join(ROOT,'unpack')],ROOT,'ARTIFACT');
    const src=path.join(ROOT,'unpack','dist');
    const entry=path.join(src,'wix-server','entry.mjs');
    if(!fs.existsSync(entry)||!fs.readFileSync(entry,'utf8').includes(SHA)) throw new Error('ARTIFACT_SHA_MISMATCH');
    fs.mkdirSync(REL,{recursive:true});
    fs.cpSync(path.join(src,'client'),path.join(REL,'client'),{recursive:true});
    fs.cpSync(path.join(src,'wix-server'),path.join(REL,'server'),{recursive:true});
    event('ARTIFACT','ARTIFACT_EXACT_SHA_PASS '+SHA);

    writeConfig(QA);
    state.phase='AUTH';
    event('AUTH','WIX_DEVICE_LOGIN_START');
    await run('npx',['--yes','@wix/cli@latest','login'],REL,'AUTH',{TERM:'xterm-256color'});
    event('AUTH','WIX_LOGIN_PASS');
    await run('npx',['--yes','@wix/cli@latest','whoami'],REL,'AUTH',{CI:'1'});

    event('QA_RELEASE','release exact artifact to isolated QA');
    await run('npx',['--yes','@wix/cli@latest','release'],REL,'QA_RELEASE',{CI:'1'});
    await waitProof(QA.host,'qa');

    writeConfig(LIVE);
    event('LIVE_RELEASE','release SAME artifact to live Wix OS body');
    await run('npx',['--yes','@wix/cli@latest','release'],REL,'LIVE_RELEASE',{CI:'1'});
    await waitProof(LIVE.host,'live');

    try{
      const c=await fetchJson(CANON+'/api/diva-release?proof='+Date.now());
      state.canonical={deploymentSha:c.deploymentSha||null,deploymentId:c.deploymentId||null,exact:c.deploymentSha===SHA};
      event('CANONICAL',JSON.stringify(state.canonical));
    }catch(e){
      state.canonical={exact:false,error:String(e)};
      event('CANONICAL',String(e));
    }
    state.phase='DONE';state.done=true;
    event('DONE','QA_TO_LIVE_SAME_ARTIFACT_PASS '+SHA);
  }catch(e){
    state.phase='ERROR';state.error=String(e?.stack||e);event('ERROR',state.error);
  }
}

http.createServer((req,res)=>{
  if(req.url?.startsWith('/status')){
    res.setHeader('content-type','application/json');
    res.setHeader('cache-control','no-store');
    return res.end(JSON.stringify(state,null,2));
  }
  res.setHeader('content-type','text/plain; charset=utf-8');
  res.end('DIVA WIX EXACT REMOTE RELEASE\nphase='+state.phase+'\nsourceSha='+SHA+'\ndeviceCode='+(state.deviceCode||'pending')+'\n');
}).listen(PORT,'0.0.0.0',()=>{console.log('DIVA_WIX_EXACT_CONTROL_READY',PORT);main();});
