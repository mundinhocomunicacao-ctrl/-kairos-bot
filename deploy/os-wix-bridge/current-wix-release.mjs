import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA=String(process.env.OS_SOURCE_SHA||process.env.SOURCE_SHA||'').trim();
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'.canonical-gitlab-source');
const REL=path.join(ROOT,'.wix-os-live-release');
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';
const QA={siteId:'242b9d6f-71ad-40c6-b1d7-f1f0825e01be',appId:'8fabf7a9-b3c7-43af-ab51-e37968937afb',host:'https://mundinho-headless-qa-mundinhocomunicaca-1412.wix-site-host.com'};
const RELEASE_QA_FIRST=String(process.env.OS_RELEASE_QA_FIRST||'0')==='1';
const BRIDGE_AUDIENCE='https://mundinho-wix-exact-44695-release.onrender.com/source-archive';
const GITLAB_OIDC_ISSUER='https://gitlab.com';
const GITLAB_OIDC_JWKS='https://gitlab.com/oauth/discovery/keys';
const GITLAB_PROJECT_ID='86501645';
const GITLAB_PROJECT_PATH='mundinhocomunicacao/mundinhocomunicacao';
const ALLOWED_CI_ROLES=new Set(['maintainer','owner']);
const BRIDGE_ARCHIVE=path.join(ROOT,'.source-bridge-'+SOURCE_SHA+'.tar.gz');
let bridgeResolve=null;
let state={phase:'BOOT',ok:false,released:false,sourceSha:SOURCE_SHA,source:'GITLAB_CANONICAL_ARCHIVE',tests:[],error:null};

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
function decodePart(value){return JSON.parse(Buffer.from(String(value||''),'base64url').toString('utf8'))}
function audienceMatches(aud,expected){return Array.isArray(aud)?aud.includes(expected):String(aud||'')===expected}
function safeNumber(value){const n=Number(value);return Number.isFinite(n)?n:0}
async function verifyBridgeOidc(token){
  const raw=String(token||'').trim(),parts=raw.split('.');
  if(parts.length!==3)return null;
  let header,payload;try{header=decodePart(parts[0]);payload=decodePart(parts[1])}catch{return null}
  const now=Math.floor(Date.now()/1000);
  if(header?.alg!=='RS256'||!header?.kid)return null;
  if(payload?.iss!==GITLAB_OIDC_ISSUER||!audienceMatches(payload?.aud,BRIDGE_AUDIENCE))return null;
  if(String(payload?.project_id)!==GITLAB_PROJECT_ID||String(payload?.project_path)!==GITLAB_PROJECT_PATH)return null;
  if(String(payload?.ref)!=='main'||String(payload?.ref_path)!=='refs/heads/main'||String(payload?.ref_type)!=='branch'||String(payload?.ref_protected)!=='true')return null;
  if(!['api','web'].includes(String(payload?.pipeline_source||'')))return null;
  if(!ALLOWED_CI_ROLES.has(String(payload?.user_access_level||'').toLowerCase()))return null;
  if(String(payload?.sha||'')!==SOURCE_SHA||!payload?.job_id||!payload?.pipeline_id)return null;
  if(safeNumber(payload?.exp)<=now||safeNumber(payload?.nbf)>now+30||safeNumber(payload?.iat)>now+30)return null;
  let response;try{response=await fetch(GITLAB_OIDC_JWKS,{headers:{accept:'application/json'},cache:'no-store'})}catch{return null}
  if(!response.ok)return null;
  let jwks;try{jwks=await response.json()}catch{return null}
  const jwk=Array.isArray(jwks?.keys)?jwks.keys.find(key=>key?.kid===header.kid&&key?.kty==='RSA'&&(!key.alg||key.alg==='RS256')):null;
  if(!jwk)return null;
  try{
    const key=crypto.createPublicKey({key:jwk,format:'jwk'});
    const verifier=crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);verifier.end();
    if(!verifier.verify(key,Buffer.from(parts[2],'base64url')))return null;
  }catch{return null}
  return payload;
}
function assertSafeTar(archive){
  const entries=sh('tar',['-tzf',archive],ROOT);
  for(const raw of entries.split('\n').filter(Boolean)){
    const name=raw.replace(/^\.\//,'');
    if(name.startsWith('/')||name.split('/').some(part=>part==='..'))throw new Error('SOURCE_BRIDGE_ARCHIVE_PATH_INVALID');
  }
  const listing=sh('tar',['-tvzf',archive],ROOT);
  if(listing.split('\n').filter(Boolean).some(line=>!/^[-d]/.test(line)))throw new Error('SOURCE_BRIDGE_ARCHIVE_LINK_FORBIDDEN');
}
async function waitForBridgeArchive(){
  if(fs.existsSync(BRIDGE_ARCHIVE))return BRIDGE_ARCHIVE;
  state.phase='WAIT_SOURCE_BRIDGE';
  await new Promise((resolve,reject)=>{
    bridgeResolve=resolve;
    const timer=setTimeout(()=>reject(new Error('SOURCE_BRIDGE_TIMEOUT')),10*60*1000);
    timer.unref?.();
  });
  if(!fs.existsSync(BRIDGE_ARCHIVE))throw new Error('SOURCE_BRIDGE_ARCHIVE_MISSING');
  return BRIDGE_ARCHIVE;
}
async function receiveBridgeArchive(req,res){
  if(req.method!=='POST'||req.url!=='/source-archive')return false;
  const auth=String(req.headers.authorization||'');
  const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  const claims=await verifyBridgeOidc(token);
  if(!claims){res.writeHead(401);res.end('unauthorized');return true;}
  const suppliedSha=String(req.headers['x-source-sha']||'').trim();
  const suppliedDigest=String(req.headers['x-archive-sha256']||'').trim().toLowerCase();
  if(suppliedSha!==SOURCE_SHA||!/^[a-f0-9]{64}$/.test(suppliedDigest)){res.writeHead(409);res.end('source identity mismatch');return true;}
  const temp=BRIDGE_ARCHIVE+'.partial';
  const hash=crypto.createHash('sha256');let bytes=0;
  const out=fs.createWriteStream(temp,{flags:'w'});
  try{
    for await(const chunk of req){
      bytes+=chunk.length;
      if(bytes>512*1024*1024)throw new Error('SOURCE_BRIDGE_ARCHIVE_TOO_LARGE');
      hash.update(chunk);
      if(!out.write(chunk))await new Promise(resolve=>out.once('drain',resolve));
    }
    await new Promise((resolve,reject)=>out.end(err=>err?reject(err):resolve()));
    if(bytes<1||hash.digest('hex')!==suppliedDigest)throw new Error('SOURCE_BRIDGE_CHECKSUM_MISMATCH');
    assertSafeTar(temp);
    fs.renameSync(temp,BRIDGE_ARCHIVE);
    state.bridge={accepted:true,bytes,sha256:suppliedDigest,sourceSha:SOURCE_SHA,at:new Date().toISOString()};
    mark('SOURCE_BRIDGE_ARCHIVE_ACCEPTED','PASS',SOURCE_SHA);
    bridgeResolve?.();bridgeResolve=null;
    res.writeHead(201,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,sourceSha:SOURCE_SHA,bytes}));
  }catch(error){
    try{out.destroy();}catch{}
    fs.rmSync(temp,{force:true});
    res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:String(error?.message||error)}));
  }
  return true;
}
async function syncSource(){
  state.phase='SOURCE';
  if(!/^[0-9a-f]{40}$/i.test(SOURCE_SHA))throw new Error('OS_SOURCE_SHA_REQUIRED_EXACT_40');
  fs.rmSync(OS_DIR,{recursive:true,force:true});
  fs.mkdirSync(OS_DIR,{recursive:true});
  const archive=path.join(ROOT,'.canonical-'+SOURCE_SHA+'.tar.gz');
  const url='https://gitlab.com/mundinhocomunicacao/mundinhocomunicacao/-/archive/'+SOURCE_SHA+'/mundinhocomunicacao-'+SOURCE_SHA+'.tar.gz';
  let transport='direct-gitlab-archive';
  try{
    await run('curl',['--fail','--silent','--show-error','--location','--retry','2','--retry-all-errors','--retry-delay','1',url,'-o',archive],ROOT);
    assertSafeTar(archive);
    await run('tar',['-xzf',archive,'--strip-components=1','-C',OS_DIR],ROOT);
  }catch(error){
    fs.rmSync(archive,{force:true});
    const bridged=await waitForBridgeArchive();
    transport='gitlab-ci-source-bridge';
    await run('tar',['-xzf',bridged,'-C',OS_DIR],ROOT);
  }
  for(const required of ['package.json','package-lock.json','proxy.js','pages/api/release-version.js','scripts/package-wix-worker.mjs']){
    if(!fs.existsSync(path.join(OS_DIR,required)))throw new Error('CANONICAL_SOURCE_FILE_MISSING:'+required);
  }
  state.sourceTransport=transport;
  mark('SOURCE_PARITY','PASS',SOURCE_SHA+' '+transport);
}
function cgroupMemoryCurrent(){
  for(const file of ['/sys/fs/cgroup/memory.current','/sys/fs/cgroup/memory/memory.usage_in_bytes']){
    try{return Number(fs.readFileSync(file,'utf8').trim())||null}catch{}
  }
  return null;
}
async function reclaimRuntimeFileCache(){
  state.subphase='RUNTIME_FILE_CACHE_RECLAIM';
  const before=cgroupMemoryCurrent();
  try{await run('sync',[],ROOT)}catch{}
  const python=[
    'import os, pathlib',
    'roots=[pathlib.Path(r"'+OS_DIR.replace(/\\/g,'\\\\')+'")/"node_modules", pathlib.Path.home()/".npm"]',
    'hint=getattr(os,"POSIX_FADV_DONTNEED",4)',
    'count=0',
    'for root in roots:',
    '  if not root.exists(): continue',
    '  for p in root.rglob("*"):',
    '    try:',
    '      if not p.is_file(): continue',
    '      fd=os.open(str(p),os.O_RDONLY)',
    '      try: os.posix_fadvise(fd,0,0,hint); count+=1',
    '      finally: os.close(fd)',
    '    except Exception: pass',
    'print(count)'
  ].join('\\n');
  let filesHinted='unknown';
  try{filesHinted=sh('python3',['-c',python],ROOT)}catch{}
  try{fs.rmSync(path.join(process.env.HOME||ROOT,'.npm','_cacache'),{recursive:true,force:true})}catch{}
  await new Promise(resolve=>setTimeout(resolve,1200));
  const after=cgroupMemoryCurrent();
  mark('RUNTIME_FILE_CACHE_RECLAIM','PASS',JSON.stringify({beforeBytes:before,afterBytes:after,filesHinted}));
}

async function qaAndBuild(){
  state.phase='QA_BUILD';
  state.subphase='NPM_CI_LOW_MEMORY';
  await run('npm',['ci','--include=dev','--no-audit','--no-fund','--prefer-offline'],OS_DIR,{
    NODE_OPTIONS:'--max-old-space-size=256',
    npm_config_maxsockets:'4'
  });
  mark('NPM_CI_LOW_MEMORY','PASS','heap=256 maxsockets=4');
  for(const script of ['scripts/qa-resource-mesh-v1-1.mjs','scripts/qa-wix-canonical-rail.mjs','scripts/qa-os-domain-release-rail.mjs']){
    await run('node',[script],OS_DIR);
    mark('LOCAL_'+path.basename(script).replace(/\.mjs$/,'').toUpperCase());
  }
  await reclaimRuntimeFileCache();
  state.subphase='BUILD_WIX_WORKER_LOW_MEMORY';
  await run('npm',['run','build:wix-worker'],OS_DIR,{
    MUNDO_RUNTIME_SOURCE_SHA:SOURCE_SHA,
    MUNDO_RUNTIME_ENV:'wix-live',
    NODE_OPTIONS:'--max-old-space-size=192'
  });
  const entry=path.join(OS_DIR,'dist','wix-server','entry.mjs');
  if(!fs.existsSync(entry))throw new Error('WIX_WORKER_ENTRY_MISSING');
  if(!fs.readFileSync(entry,'utf8').includes(SOURCE_SHA))throw new Error('WIX_WORKER_SOURCE_SHA_MISMATCH');
  fs.rmSync(REL,{recursive:true,force:true});
  fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist','client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(OS_DIR,'dist','wix-server'),path.join(REL,'server'),{recursive:true});
  mark('BUILD_WIX_WORKER','PASS',SOURCE_SHA);
}
function writeConfig(target){
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({projectType:'Site',appId:target.appId,siteId:target.siteId,site:{outputDirectory:{client:'./client',server:'./server'}}},null,2));
}
async function ensureAuth(){
  try{
    const who=sh('npx',['-y','@wix/cli@latest','whoami'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    if(who){mark('WIX_AUTH','PASS','cached');return;}
  }catch{}
  for(const alias of ['WIX_OS_API_KEY','WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY']){
    const value=String(process.env[alias]||'').trim();
    if(!value)continue;
    await run('npx',['-y','@wix/cli@latest','login','--api-key',value],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    mark('WIX_AUTH','PASS',alias);
    return;
  }
  throw new Error('WIX_AUTH_MISSING');
}
async function fetchJson(url,init={}){
  const response=await fetch(url,{...init,headers:{'cache-control':'no-cache',...(init.headers||{})},signal:AbortSignal.timeout(15000)});
  const raw=await response.text();
  let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  return {status:response.status,ok:response.ok,data,raw:raw.slice(0,500),headers:response.headers};
}
async function proveIdentity(host,label){
  for(let attempt=1;attempt<=36;attempt++){
    try{
      const [rv,dr,pr]=await Promise.all([
        fetchJson(host+'/api/release-version?proof='+Date.now()),
        fetchJson(host+'/api/diva-release?proof='+Date.now()),
        fetchJson(host+'/api/preview-readiness?proof='+Date.now())
      ]);
      if(rv.data?.sourceSha===SOURCE_SHA&&dr.data?.deploymentSha===SOURCE_SHA&&pr.data?.sourceSha===SOURCE_SHA&&pr.data?.status==='ready'){
        mark(label+'_IDENTITY_READBACK','PASS',SOURCE_SHA);
        return;
      }
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,5000));
  }
  throw new Error(label+'_EXACT_SHA_READBACK_FAIL');
}
async function releaseTarget(target,label){
  state.phase='RELEASE_'+label;
  writeConfig(target);
  await run('npx',['-y','@wix/cli@latest','release'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
  mark(label+'_RELEASE_DISPATCH');
  await proveIdentity(target.host,label);
}
async function main(){
  try{
    await syncSource();
    await qaAndBuild();
    await ensureAuth();
    if(RELEASE_QA_FIRST)await releaseTarget(QA,'QA');
    await releaseTarget(LIVE,'LIVE');
    await proveIdentity(CANONICAL,'CANONICAL');
    state.phase='DONE';state.ok=true;state.released=true;state.status='OS_LIVE_EXACT_SHA_VERIFIED';
    console.log('OS_LIVE_EXACT_SHA_VERIFIED '+JSON.stringify({sourceSha:SOURCE_SHA}));
  }catch(error){
    state.phase='ERROR';state.ok=false;state.released=false;state.status='BLOCKED';state.error=String(error?.stack||error);
    console.error('OS_LIVE_EXACT_SHA_BLOCKED '+state.error);
  }
}
http.createServer(async(req,res)=>{
  res.setHeader('cache-control','no-store');
  if(await receiveBridgeArchive(req,res))return;
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>{console.log('OS_EXACT_GITLAB_RELEASE_CONTROLLER_READY');void main();});
