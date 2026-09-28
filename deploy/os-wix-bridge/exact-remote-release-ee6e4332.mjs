import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const MORADA=path.join(ROOT,'morada');
const EXPECTED_SOURCE='c8b5dcc0158e505f64cf430332d5362026d6fb78';
const SITE='https://www.especialistabrandingeinfluencia.com';
const CANARY_NONCE='m0aWKB9L8B-lHKj3gNZJMRU5Bh_C_TGaKvZc94WTh6E';
const PORT=Number(process.env.PORT||10000);
const state={phase:'BOOT',done:false,error:null,sourceSha:EXPECTED_SOURCE,userCode:null,verificationUri:null,proofs:{}};

function log(message){console.log(message)}
function run(command,args=[],{cwd=ROOT,env={},input=null,timeout=15*60*1000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:['pipe','pipe','pipe']});
    let out='',err='';
    const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('COMMAND_TIMEOUT '+command))},timeout);
    child.stdout.on('data',d=>{const s=String(d);out+=s;process.stdout.write(s)});
    child.stderr.on('data',d=>{const s=String(d);err+=s;process.stderr.write(s)});
    child.on('error',e=>{clearTimeout(timer);reject(e)});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve({out,err}):reject(new Error('COMMAND_FAIL '+command+' '+code+' '+(err||out).slice(-1800)))});
    if(input!=null)child.stdin.write(input);
    child.stdin.end();
  });
}
function sh(command,cwd=ROOT){
  const r=spawnSync('bash',['-lc',command],{cwd,encoding:'utf8',timeout:30000});
  if(r.status!==0)throw new Error('SHELL_FAIL '+command+' '+String(r.stderr||r.stdout||'').slice(-1200));
  return String(r.stdout||'').trim();
}
async function ensureWixCli(){
  const dir=path.join(os.tmpdir(),'morada-wix-cli-runtime');
  fs.rmSync(dir,{recursive:true,force:true});
  log('MORADA_WIX_CLI_INSTALL_START');
  await run('npm',['install','--prefix',dir,'@wix/cli@latest','--no-audit','--no-fund'],{env:{NODE_ENV:'development'}});
  const bin=path.join(dir,'node_modules','.bin','wix');
  if(!fs.existsSync(bin))throw new Error('MORADA_WIX_CLI_MISSING');
  log('MORADA_WIX_CLI_INSTALL_PASS');
  return bin;
}
async function ensureAuth(wixCli){
  state.phase='WIX_AUTH';
  const env={...process.env,AI_AGENT:'wix-headless-skill'};
  log('MORADA_WIX_AUTH_CHECK_START');
  const who=spawnSync(wixCli,['whoami'],{encoding:'utf8',env,timeout:20000});
  if(who.status===0){log('MORADA_WIX_AUTH_ALREADY_VALID '+who.stdout.trim());return}
  await new Promise((resolve,reject)=>{
    const p=spawn(wixCli,['login'],{env,stdio:['ignore','pipe','pipe']});
    let buffer='';
    p.stdout.on('data',d=>{
      const s=String(d);process.stdout.write(s);buffer+=s;
      for(const line of buffer.split('\n')){
        try{
          const event=JSON.parse(line.trim());
          if(event.event==='awaiting_user'){
            state.userCode=event.userCode;
            state.verificationUri=event.verificationUri;
            log('DIVA_MORADA_WIX_AWAITING_USER '+JSON.stringify({userCode:event.userCode,verificationUri:event.verificationUri,expiresInSeconds:event.expiresInSeconds}));
          }
        }catch{}
      }
    });
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error('MORADA_WIX_LOGIN_EXIT_'+code)));
  });
  const after=spawnSync(wixCli,['whoami'],{encoding:'utf8',env,timeout:20000});
  if(after.status!==0)throw new Error('MORADA_WIX_AUTH_NOT_CONFIRMED');
  log('MORADA_WIX_AUTH_PASS '+after.stdout.trim());
}
async function jsonFetch(url,options={}){
  const response=await fetch(url,{...options,headers:{...(options.headers||{}),'cache-control':'no-cache'}});
  const raw=await response.text();
  let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  return{status:response.status,ok:response.ok,data};
}
async function prove(){
  state.phase='PROVE_HEALTH';
  let health=null;
  for(let i=0;i<12;i++){
    health=await jsonFetch(SITE+'/_functions/divaHealth?proof='+Date.now()).catch(()=>null);
    if(health?.status===200&&health.data?.service==='DIVA_MORADA_HTTP_INGRESS')break;
    await new Promise(r=>setTimeout(r,5000));
  }
  if(health?.status!==200||health.data?.service!=='DIVA_MORADA_HTTP_INGRESS')throw new Error('MORADA_HEALTH_FAIL '+JSON.stringify(health));
  state.proofs.health={status:health.status,service:health.data.service,version:health.data.version};
  log('DIVA_MORADA_HEALTH_PASS');

  state.phase='PROVE_SESSION_GUARD';
  const guard=await jsonFetch(SITE+'/_functions/divaAsk?proof='+Date.now(),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'release-guard',text:'probe'})
  });
  if(guard.status!==401||!String(guard.data?.status||'').startsWith('DIVA_BRAIN_SESSION_'))throw new Error('MORADA_SESSION_GUARD_FAIL '+JSON.stringify(guard));
  state.proofs.sessionGuard={status:guard.status,brainStatus:guard.data.status};
  log('DIVA_MORADA_SESSION_GUARD_PASS');

  state.phase='PROVE_BRAIN_CANARY';
  const canary=await jsonFetch(SITE+'/_functions/divaCanary?nonce='+encodeURIComponent(CANARY_NONCE)+'&proof='+Date.now());
  if(canary.status!==200||canary.data?.ok!==true||canary.data?.status!=='BRAIN_OK'||canary.data?.provider!=='DIVA_GATEWAY'||canary.data?.receipt?.ok!==true){
    throw new Error('MORADA_CENTRAL_GATEWAY_CANARY_FAIL '+JSON.stringify(canary));
  }
  state.proofs.canary={
    status:canary.status,
    brainStatus:canary.data.status,
    provider:canary.data.provider,
    model:canary.data.model||null,
    receiptStatus:canary.data.receipt?.status||null,
    pulseId:canary.data.receipt?.pulseId||null,
    memoryRecordId:canary.data.receipt?.memoryRecordId||null
  };
  log('DIVA_MORADA_CENTRAL_GATEWAY_CANARY_PASS '+JSON.stringify(state.proofs.canary));
}
async function main(){
  try{
    state.phase='SOURCE';
    await run('bash',['-lc','git submodule sync --recursive && git submodule update --init --recursive morada'],{cwd:ROOT});
    const source=sh('git rev-parse HEAD',MORADA);
    if(source!==EXPECTED_SOURCE)throw new Error('MORADA_SOURCE_SHA_MISMATCH '+source);
    log('DIVA_MORADA_SOURCE_EXACT_PASS '+source);

    state.phase='QA';
    await run('node',['scripts/qa-morada-central-gateway.mjs'],{cwd:MORADA});
    state.proofs.qa='PASS';
    log('QA_MORADA_CENTRAL_GATEWAY_PASS');

    const wixCli=await ensureWixCli();
    await ensureAuth(wixCli);

    state.phase='PUBLISH';
    await run(wixCli,['publish','-y'],{cwd:MORADA,input:'\n',env:{AI_AGENT:'wix-headless-skill'}});
    state.proofs.publish='PASS';
    log('DIVA_MORADA_WIX_PUBLISH_PASS');

    await new Promise(r=>setTimeout(r,12000));
    await prove();

    state.phase='DONE';state.done=true;
    log('DIVA_MORADA_CENTRAL_GATEWAY_RELEASE_COMPLETE '+EXPECTED_SOURCE);
  }catch(error){
    state.phase='ERROR';state.error=String(error?.stack||error);console.error(state.error);
  }
}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))})
  .listen(PORT,'0.0.0.0',()=>{log('DIVA_MORADA_RELEASE_CONTROL_READY '+PORT);main()});
