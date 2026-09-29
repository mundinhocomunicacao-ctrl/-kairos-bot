import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const PORT=Number(process.env.PORT||10000);
const SITE='https://www.especialistabrandingeinfluencia.com';
const CANARY_NONCE='m0aWKB9L8B-lHKj3gNZJMRU5Bh_C_TGaKvZc94WTh6E';
const state={phase:'BOOT',done:false,error:null,sourceSha:process.env.RENDER_GIT_COMMIT||null,proofs:{}};

function log(message){console.log(message)}
function run(command,args=[],{cwd=ROOT,env={},input=null,timeout=15*60*1000}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args,{cwd,env:{...process.env,...env},stdio:['pipe','pipe','pipe']});
    let out='',err='',timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('COMMAND_TIMEOUT '+command))},timeout);
    child.stdout.on('data',d=>{const s=String(d);out+=s;process.stdout.write(s)});
    child.stderr.on('data',d=>{const s=String(d);err+=s;process.stderr.write(s)});
    child.on('error',e=>{clearTimeout(timer);reject(e)});
    child.on('close',code=>{clearTimeout(timer);code===0?resolve({out,err}):reject(new Error('COMMAND_FAIL '+command+' '+code+' '+(err||out).slice(-1600)))});
    if(input!=null)child.stdin.write(input);
    child.stdin.end();
  });
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
  const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  return{status:response.status,ok:response.ok,data};
}
async function prove(){
  state.phase='PROVE_HEALTH';
  const health=await jsonFetch(SITE+'/_functions/divaHealth?proof='+Date.now());
  if(health.status!==200||health.data?.service!=='DIVA_MORADA_HTTP_INGRESS')throw new Error('MORADA_HEALTH_FAIL '+JSON.stringify(health));
  state.proofs.health=health;log('DIVA_MORADA_HEALTH_PASS');

  state.phase='PROVE_SESSION_GUARD';
  const guard=await jsonFetch(SITE+'/_functions/divaAsk?proof='+Date.now(),{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id:'release-guard',text:'probe'})
  });
  if(guard.status!==401||!String(guard.data?.status||'').startsWith('DIVA_BRAIN_SESSION_'))throw new Error('MORADA_SESSION_GUARD_FAIL '+JSON.stringify(guard));
  state.proofs.sessionGuard=guard;log('DIVA_MORADA_SESSION_GUARD_PASS');

  state.phase='PROVE_BRAIN_CANARY';
  const canary=await jsonFetch(SITE+'/_functions/divaCanary?nonce='+encodeURIComponent(CANARY_NONCE)+'&proof='+Date.now());
  const alreadyProven=canary.status===410&&canary.data?.status==='CANARY_CONSUMED';
  if(alreadyProven){
    state.proofs.canary=canary;
    log('DIVA_MORADA_COUNCIL_CANARY_ALREADY_PROVEN');
    return;
  }
  if(canary.status!==200||canary.data?.ok!==true||canary.data?.status!=='BRAIN_OK'||canary.data?.provider!=='DIVA_COUNCIL'||canary.data?.model!=='ensemble'||canary.data?.receipt?.ok!==true){
    throw new Error('MORADA_COUNCIL_CANARY_FAIL '+JSON.stringify(canary));
  }
  state.proofs.canary=canary;
  log('DIVA_MORADA_COUNCIL_CANARY_PASS '+JSON.stringify({provider:canary.data.provider,model:canary.data.model,receiptStatus:canary.data.receipt?.status,pulseId:canary.data.receipt?.pulseId||null,memoryRecordId:canary.data.receipt?.memoryRecordId||null}));
}
async function main(){
  if(String(process.env.RUN_RELEASE_ON_BOOT||'1')==='0'){state.phase='IDLE';log('DIVA_MORADA_RELEASE_CONTROLLER_IDLE');return}
  try{
    state.phase='QA';
    await run('node',['scripts/qa-morada-central-gateway.mjs']);
    state.proofs.qa='PASS';log('QA_MORADA_CENTRAL_GATEWAY_PASS');

    const wixCli=await ensureWixCli();
    await ensureAuth(wixCli);

    state.phase='PUBLISH';
    await run(wixCli,['publish','-y'],{input:'\n',env:{AI_AGENT:'wix-headless-skill'}});
    state.proofs.publish='PASS';log('DIVA_MORADA_WIX_PUBLISH_PASS');

    await new Promise(r=>setTimeout(r,12000));
    await prove();

    state.phase='DONE';state.done=true;
    log('DIVA_MORADA_CENTRAL_GATEWAY_RELEASE_COMPLETE '+(state.sourceSha||'unknown'));
  }catch(error){
    state.phase='ERROR';state.error=String(error?.stack||error);console.error(state.error);
  }
}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))})
  .listen(PORT,'0.0.0.0',()=>{log('DIVA_MORADA_RELEASE_CONTROL_READY '+PORT);main()});
