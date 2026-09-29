import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawnSync,spawn} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const SOURCE_MARKER=path.join(OS_DIR,'.release-source/canonical-sha.txt');
const ENTRY=path.join(OS_DIR,'dist/wix-server/entry.mjs');
const RELEASE_DIR=path.join(ROOT,'.wix-live-release');

const MUNDINHO_WIX_LIVE_SITE_ID=String(process.env.MUNDINHO_WIX_LIVE_SITE_ID||'c80689f2-6627-45fa-a264-4ab2863ba306').trim();
const MUNDINHO_WIX_LIVE_APP_ID=String(process.env.MUNDINHO_WIX_LIVE_APP_ID||'79eedd41-5ca6-4940-925a-e95e6f3c570e').trim();

function wixApiKeyFromEnv(){
  for(const alias of ['WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY','WIX_OS_API_KEY']){
    const value=String(process.env[alias]||'').trim();
    if(value)return {alias,value};
  }
  return null;
}
function run(bin,args,cwd,extraEnv={}){
  return String(execFileSync(bin,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...extraEnv}})||'').trim();
}
function canonicalSourceSha(){
  const sha=String(fs.readFileSync(SOURCE_MARKER,'utf8')).trim();
  if(!/^[a-f0-9]{40}$/i.test(sha))throw new Error('CANONICAL_SOURCE_SHA_INVALID');
  return sha;
}
function repackLive(sha){
  execFileSync('node',['scripts/package-wix-worker.mjs'],{
    cwd:OS_DIR,
    stdio:'inherit',
    env:{...process.env,MUNDO_RUNTIME_SOURCE_SHA:sha,MUNDO_RUNTIME_ENV:'wix-live'}
  });
  if(!fs.existsSync(ENTRY))throw new Error('WIX_WORKER_ENTRY_MISSING');
  const entry=fs.readFileSync(ENTRY,'utf8');
  if(!entry.includes('MUNDO_RUNTIME_SOURCE_SHA:'+JSON.stringify(sha)))throw new Error('ARTIFACT_RUNTIME_SHA_MISMATCH');
  if(!entry.includes('MUNDO_RUNTIME_ENV:'+JSON.stringify('wix-live')))throw new Error('ARTIFACT_RUNTIME_ENV_MISMATCH');
}
function prepareRelease(){
  const sha=canonicalSourceSha();
  repackLive(sha);
  fs.rmSync(RELEASE_DIR,{recursive:true,force:true});
  fs.mkdirSync(RELEASE_DIR,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(RELEASE_DIR,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(RELEASE_DIR,'server'),{recursive:true});
  fs.writeFileSync(path.join(RELEASE_DIR,'wix.config.json'),JSON.stringify({
    projectType:'Site',
    appId:MUNDINHO_WIX_LIVE_APP_ID,
    siteId:MUNDINHO_WIX_LIVE_SITE_ID,
    site:{outputDirectory:{client:'./client',server:'./server'}}
  },null,2));
  return sha;
}
async function ensureWixAuth(){
  const auth=wixApiKeyFromEnv();
  if(auth){
    execFileSync('npx',['-y','@wix/cli@latest','login','--api-key',auth.value],{
      cwd:RELEASE_DIR,
      stdio:'inherit',
      env:{...process.env,CI:'1',AI_AGENT:'wix-headless-skill'}
    });
    console.log('WIX_OS_API_KEY_AUTH_PASS '+auth.alias);
    return {authMode:'api_key',authAlias:auth.alias};
  }
  await new Promise((resolve,reject)=>{
    const p=spawn('npx',['-y','@wix/cli@latest','login'],{
      cwd:RELEASE_DIR,
      env:{...process.env,AI_AGENT:'wix-headless-skill'},
      stdio:['ignore','pipe','pipe']
    });
    let buffer='';
    const scan=(chunk)=>{
      const s=String(chunk); process.stdout.write(s); buffer+=s;
      for(const line of buffer.split('\n')){
        try{
          const e=JSON.parse(line.trim());
          if(e.event==='awaiting_user'){
            state={...state,phase:'AWAITING_WIX_AUTH',userCode:e.userCode||null,verificationUri:e.verificationUri||null,authExpiresInSeconds:e.expiresInSeconds||null};
            console.log('WIX_OS_AWAITING_USER '+JSON.stringify({userCode:state.userCode,verificationUri:state.verificationUri,expiresInSeconds:state.authExpiresInSeconds}));
          }
          if(e.event==='success'){
            console.log('WIX_DEVICE_AUTH_SUCCESS_EVENT');
          }
        }catch{}
      }
    };
    p.stdout.on('data',scan);
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error('wix login exit '+code)));
  });
  state={...state,userCode:null,verificationUri:null,authExpiresInSeconds:null};
  console.log('WIX_DEVICE_AUTH_PASS');
  return {authMode:'device_code',authAlias:'device_code'};
}
async function releaseLive(){
  const sourceSha=prepareRelease();
  state={...state,phase:'AUTH',sourceSha};
  const auth=await ensureWixAuth();
  state={...state,phase:'RELEASE',authMode:auth.authMode,authAlias:auth.authAlias};
  execFileSync('npx',['-y','@wix/cli@latest','release'],{
    cwd:RELEASE_DIR,
    stdio:'inherit',
    env:{...process.env,CI:'1',AI_AGENT:'wix-headless-skill'}
  });
  const result=Object.freeze({
    phase:'WIX_OS_LIVE_RELEASE_VERIFIED',
    ok:true,
    released:true,
    sourceSha,
    runtimeEnv:'wix-live',
    siteId:MUNDINHO_WIX_LIVE_SITE_ID,
    appId:MUNDINHO_WIX_LIVE_APP_ID,
    authMode:auth.authMode,
    authAlias:auth.authAlias
  });
  console.log('WIX_OS_LIVE_RELEASE_VERIFIED '+JSON.stringify(result));
  return result;
}

let state={phase:'BOOTING',ok:false,released:false};
async function boot(){
  try{state=await releaseLive();}
  catch(error){
    state={...state,phase:'EXECUTOR_ERROR',ok:false,released:false,error:String(error?.message||error)};
    console.error('EXECUTOR_ERROR '+JSON.stringify(state));
  }
}
const server=http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state));
});
server.listen(PORT,'0.0.0.0',()=>{
  console.log('WIX_OS_LIVE_RELEASE_EXECUTOR_READY');
  setImmediate(boot);
});
