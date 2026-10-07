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
const EXTERNAL_BUILDER_ONLY=true;
const BRIDGE_AUDIENCE='https://mundinho-wix-exact-44695-release.onrender.com/source-archive';
const GITLAB_OIDC_ISSUER='https://gitlab.com';
const GITLAB_OIDC_JWKS='https://gitlab.com/oauth/discovery/keys';
const GITLAB_PROJECT_ID='86501645';
const GITLAB_PROJECT_PATH='mundinhocomunicacao/mundinhocomunicacao';
const GITHUB_OIDC_ISSUER='https://token.actions.githubusercontent.com';
const GITHUB_OIDC_JWKS='https://token.actions.githubusercontent.com/.well-known/jwks';
const GITHUB_REPOSITORY='mundinhocomunicacao-ctrl/mundinho-os-live';
const GITHUB_REF='refs/heads/main';
const GITHUB_TRANSPORT_REPOSITORY='mundinhocomunicacao-ctrl/mundinho-os-live';
const GITHUB_TRANSPORT_COMMIT=String(process.env.OS_GITHUB_TRANSPORT_COMMIT||'').trim();
const GITHUB_TRANSPORT_TREE_SHA=String(process.env.OS_GITHUB_TRANSPORT_TREE_SHA||'').trim();
const VERCEL_SOURCE_BRIDGE_ENABLED=String(process.env.VERCEL_SOURCE_BRIDGE_ENABLED||'0')==='1';
const VERCEL_OIDC_ISSUER='https://oidc.vercel.com/mundinho-os';
const VERCEL_OIDC_JWKS='https://oidc.vercel.com/mundinho-os/.well-known/jwks';
const VERCEL_OWNER_ID='team_soWYtG1mYrODtpdbhFUdjjuB';
const VERCEL_OWNER_SLUG='mundinho-os';
const VERCEL_PROJECT_ID='prj_ul6yOIcg4pTEV9OaQ1U8iZztOqcJ';
const VERCEL_AUDIENCE='https://vercel.com/mundinho-os';
const VERCEL_PROJECT='mundo-release-exact';
const ALLOWED_CI_ROLES=new Set(['maintainer','owner']);
const ALLOWED_CI_USER_IDS=new Set(['42210703']);
const BRIDGE_ARCHIVE=path.join(ROOT,'.source-bridge-'+SOURCE_SHA+'.tar.gz');
const BUILD_ARCHIVE=path.join(ROOT,'.external-build-'+SOURCE_SHA+'.tar.gz');
let bridgeResolve=null;
let buildResolve=null;
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
  const reject=(reason)=>{console.error('GITLAB_OIDC_REJECT='+reason);return null;};
  const raw=String(token||'').trim(),parts=raw.split('.');
  if(parts.length!==3)return reject('shape');
  let header,payload;try{header=decodePart(parts[0]);payload=decodePart(parts[1])}catch{return reject('decode')}
  const now=Math.floor(Date.now()/1000);
  if(header?.alg!=='RS256'||!header?.kid)return reject('header');
  if(payload?.iss!==GITLAB_OIDC_ISSUER)return reject('issuer');
  if(!audienceMatches(payload?.aud,BRIDGE_AUDIENCE))return reject('audience');
  if(String(payload?.project_id)!==GITLAB_PROJECT_ID||String(payload?.project_path)!==GITLAB_PROJECT_PATH)return reject('project');
  if(String(payload?.ref)!=='main'||String(payload?.ref_path)!=='refs/heads/main'||String(payload?.ref_type)!=='branch'||String(payload?.ref_protected)!=='true')return reject('ref');
  if(!['api','web'].includes(String(payload?.pipeline_source||'')))return reject('pipeline_source');
  const role=String(payload?.user_access_level||'').toLowerCase();
  const principalId=String(payload?.user_id||'');
  const principalAuthorized=ALLOWED_CI_ROLES.has(role)||(!role&&ALLOWED_CI_USER_IDS.has(principalId));
  if(!principalAuthorized)return reject(role?'role':'principal');
  if(String(payload?.sha||'')!==SOURCE_SHA||!payload?.job_id||!payload?.pipeline_id)return reject('source_identity');
  if(safeNumber(payload?.exp)<=now||(payload?.nbf!=null&&safeNumber(payload.nbf)>now+30)||safeNumber(payload?.iat)>now+30)return reject('time');
  let response;try{response=await fetch(GITLAB_OIDC_JWKS,{headers:{accept:'application/json'},cache:'no-store'})}catch{return reject('jwks_fetch')}
  if(!response.ok)return reject('jwks_http');
  let jwks;try{jwks=await response.json()}catch{return reject('jwks_json')}
  const jwk=Array.isArray(jwks?.keys)?jwks.keys.find(key=>key?.kid===header.kid&&key?.kty==='RSA'&&(!key.alg||key.alg==='RS256')):null;
  if(!jwk)return reject('kid');
  try{
    const key=crypto.createPublicKey({key:jwk,format:'jwk'});
    const verifier=crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);verifier.end();
    if(!verifier.verify(key,Buffer.from(parts[2],'base64url')))return reject('signature');
  }catch{return reject('signature_error')}
  console.log('GITLAB_OIDC_ACCEPT='+(role?'role:'+role:'principal:'+principalId));
  return payload;
}
function parseVercelSubjectClaims(value){
  const parts=String(value||'').split(':').filter(Boolean);
  if(parts.length<6||parts.length%2!==0)return null;
  const claims={};
  for(let i=0;i<parts.length;i+=2){
    const key=String(parts[i]||'').trim();
    const item=String(parts[i+1]||'').trim();
    if(!key||!item||Object.prototype.hasOwnProperty.call(claims,key))return null;
    claims[key]=item;
  }
  return claims;
}
async function verifyVercelOidc(token){
  const reject=(reason)=>{console.error('VERCEL_OIDC_REJECT='+reason);return null;};
  if(!VERCEL_SOURCE_BRIDGE_ENABLED)return reject('disabled');
  const raw=String(token||'').trim(),parts=raw.split('.');
  if(parts.length!==3)return reject('shape');
  let header,payload;try{header=decodePart(parts[0]);payload=decodePart(parts[1])}catch{return reject('decode')}
  const now=Math.floor(Date.now()/1000);
  if(header?.alg!=='RS256'||!header?.kid)return reject('header');
  if(payload?.iss!==VERCEL_OIDC_ISSUER)return reject('issuer');
  if(!audienceMatches(payload?.aud,VERCEL_AUDIENCE))return reject('audience');
  const subjectClaims=parseVercelSubjectClaims(payload?.sub);
  if(!subjectClaims||
    subjectClaims?.owner!==VERCEL_OWNER_SLUG||
    subjectClaims?.project!==VERCEL_PROJECT||
    subjectClaims?.environment!==String(payload?.environment||''))return reject('subject');
  if(String(payload?.owner||'')!==VERCEL_OWNER_SLUG||String(payload?.owner_id||'')!==VERCEL_OWNER_ID)return reject('owner');
  if(String(payload?.project||'')!==VERCEL_PROJECT||String(payload?.project_id||'')!==VERCEL_PROJECT_ID)return reject('project');
  if(String(payload?.environment||'')!=='production')return reject('environment');
  if(safeNumber(payload?.exp)<=now||(payload?.nbf!=null&&safeNumber(payload.nbf)>now+30)||safeNumber(payload?.iat)>now+30)return reject('time');
  let response;try{response=await fetch(VERCEL_OIDC_JWKS,{headers:{accept:'application/json'},cache:'no-store'})}catch{return reject('jwks_fetch')}
  if(!response.ok)return reject('jwks_http');
  let jwks;try{jwks=await response.json()}catch{return reject('jwks_json')}
  const jwk=Array.isArray(jwks?.keys)?jwks.keys.find(key=>key?.kid===header.kid&&key?.kty==='RSA'&&(!key.alg||key.alg==='RS256')):null;
  if(!jwk)return reject('kid');
  try{
    const key=crypto.createPublicKey({key:jwk,format:'jwk'});
    const verifier=crypto.createVerify('RSA-SHA256');
    verifier.update(`${parts[0]}.${parts[1]}`);verifier.end();
    if(!verifier.verify(key,Buffer.from(parts[2],'base64url')))return reject('signature');
  }catch{return reject('signature_error')}
  console.log('VERCEL_OIDC_ACCEPT=production_project_bound');
  return payload;
}
async function verifyGitHubOidc(token){
  const raw=String(token||'').trim(),parts=raw.split('.');
  if(parts.length!==3)return null;
  let header,payload;try{header=decodePart(parts[0]);payload=decodePart(parts[1])}catch{return null}
  const now=Math.floor(Date.now()/1000);
  if(header?.alg!=='RS256'||!header?.kid)return null;
  if(payload?.iss!==GITHUB_OIDC_ISSUER||!audienceMatches(payload?.aud,BRIDGE_AUDIENCE))return null;
  if(String(payload?.repository||'')!==GITHUB_REPOSITORY)return null;
  if(String(payload?.repository_owner||'')!=='mundinhocomunicacao-ctrl')return null;
  if(String(payload?.ref||'')!==GITHUB_REF||String(payload?.ref_type||'')!=='branch')return null;
  if(!['push','workflow_dispatch'].includes(String(payload?.event_name||'')))return null;
  if(safeNumber(payload?.exp)<=now||safeNumber(payload?.nbf)>now+30||safeNumber(payload?.iat)>now+30)return null;
  let response;try{response=await fetch(GITHUB_OIDC_JWKS,{headers:{accept:'application/json'},cache:'no-store'})}catch{return null}
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
  let provider='gitlab';
  let claims=await verifyBridgeOidc(token);
  if(!claims){claims=await verifyVercelOidc(token);provider='vercel';}
  if(!claims){res.writeHead(401);res.end('unauthorized');return true;}
  const suppliedSha=String(req.headers['x-source-sha']||'').trim();
  if(provider==='vercel'&&String(req.headers['x-vercel-git-commit-sha']||'').trim()!==SOURCE_SHA){res.writeHead(409);res.end('vercel source identity mismatch');return true;}
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
    state.bridge={accepted:true,provider,bytes,sha256:suppliedDigest,sourceSha:SOURCE_SHA,at:new Date().toISOString()};
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
async function serveBridgeArchive(req,res){
  const pathname=String(req.url||'').split('?')[0];
  if(req.method!=='GET'||pathname!=='/source-archive')return false;
  const auth=String(req.headers.authorization||'');
  const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  const claims=await verifyGitHubOidc(token);
  if(!claims){res.writeHead(401);res.end('unauthorized');return true;}
  const requestedSha=String(req.headers['x-source-sha']||'').trim();
  if(requestedSha!==SOURCE_SHA){res.writeHead(409);res.end('source identity mismatch');return true;}
  if(!fs.existsSync(BRIDGE_ARCHIVE)){res.writeHead(409);res.end('source archive unavailable');return true;}
  const digest=state.bridge?.sha256||crypto.createHash('sha256').update(fs.readFileSync(BRIDGE_ARCHIVE)).digest('hex');
  const bytes=fs.statSync(BRIDGE_ARCHIVE).size;
  res.writeHead(200,{
    'content-type':'application/gzip',
    'content-length':String(bytes),
    'cache-control':'no-store',
    'x-source-sha':SOURCE_SHA,
    'x-archive-sha256':digest
  });
  fs.createReadStream(BRIDGE_ARCHIVE).pipe(res);
  mark('SOURCE_BRIDGE_GITHUB_DOWNLOAD','PASS',SOURCE_SHA);
  return true;
}
async function waitForBuildArtifact(){
  if(fs.existsSync(BUILD_ARCHIVE))return BUILD_ARCHIVE;
  state.phase='WAIT_EXTERNAL_BUILD';
  state.status='AWAIT_EXTERNAL_BUILD_ARTIFACT';
  await new Promise((resolve,reject)=>{
    buildResolve=resolve;
    const timer=setTimeout(()=>reject(new Error('EXTERNAL_BUILD_ARTIFACT_TIMEOUT')),20*60*1000);
    timer.unref?.();
  });
  if(!fs.existsSync(BUILD_ARCHIVE))throw new Error('EXTERNAL_BUILD_ARTIFACT_MISSING');
  return BUILD_ARCHIVE;
}
async function receiveBuildArtifact(req,res){
  if(req.method!=='POST'||req.url!=='/build-artifact')return false;
  const auth=String(req.headers.authorization||'');
  const token=auth.startsWith('Bearer ')?auth.slice(7).trim():'';
  const claims=await verifyGitHubOidc(token);
  if(!claims){res.writeHead(401);res.end('unauthorized');return true;}
  const suppliedSha=String(req.headers['x-source-sha']||'').trim();
  const suppliedDigest=String(req.headers['x-artifact-sha256']||'').trim().toLowerCase();
  if(suppliedSha!==SOURCE_SHA||!/^[a-f0-9]{64}$/.test(suppliedDigest)){res.writeHead(409);res.end('build identity mismatch');return true;}
  const temp=BUILD_ARCHIVE+'.partial';
  const hash=crypto.createHash('sha256');let bytes=0;
  const out=fs.createWriteStream(temp,{flags:'w'});
  try{
    for await(const chunk of req){
      bytes+=chunk.length;
      if(bytes>512*1024*1024)throw new Error('EXTERNAL_BUILD_ARTIFACT_TOO_LARGE');
      hash.update(chunk);
      if(!out.write(chunk))await new Promise(resolve=>out.once('drain',resolve));
    }
    await new Promise((resolve,reject)=>out.end(err=>err?reject(err):resolve()));
    if(bytes<1||hash.digest('hex')!==suppliedDigest)throw new Error('EXTERNAL_BUILD_ARTIFACT_CHECKSUM_MISMATCH');
    assertSafeTar(temp);
    fs.renameSync(temp,BUILD_ARCHIVE);
    state.externalBuild={accepted:true,bytes,sha256:suppliedDigest,sourceSha:SOURCE_SHA,at:new Date().toISOString()};
    mark('EXTERNAL_BUILD_ARTIFACT_ACCEPTED','PASS',SOURCE_SHA);
    buildResolve?.();buildResolve=null;
    res.writeHead(201,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,sourceSha:SOURCE_SHA,bytes}));
  }catch(error){
    try{out.destroy();}catch{}
    fs.rmSync(temp,{force:true});
    res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({ok:false,error:String(error?.message||error)}));
  }
  return true;
}
async function prepareExternalBuildRelease(){
  const archive=await waitForBuildArtifact();
  fs.rmSync(REL,{recursive:true,force:true});
  fs.mkdirSync(REL,{recursive:true});
  await run('tar',['-xzf',archive,'-C',REL],ROOT);
  const entry=path.join(REL,'server','entry.mjs');
  if(!fs.existsSync(path.join(REL,'client')))throw new Error('EXTERNAL_BUILD_CLIENT_MISSING');
  if(!fs.existsSync(entry))throw new Error('EXTERNAL_BUILD_SERVER_ENTRY_MISSING');
  if(!fs.readFileSync(entry,'utf8').includes(SOURCE_SHA))throw new Error('EXTERNAL_BUILD_SOURCE_SHA_MISMATCH');
  mark('EXTERNAL_BUILD_ARTIFACT_VERIFIED','PASS',SOURCE_SHA);
}
async function proveGitTreeParity(dir,expectedTree){
  if(!/^[0-9a-f]{40}$/i.test(String(expectedTree||'')))throw new Error('GITHUB_TRANSPORT_TREE_SHA_REQUIRED');
  const gitDir=path.join(dir,'.git');
  fs.rmSync(gitDir,{recursive:true,force:true});
  await run('git',['init','-q'],dir);
  await run('git',['add','-Af','.'],dir);
  const actual=sh('git',['write-tree'],dir);
  fs.rmSync(gitDir,{recursive:true,force:true});
  if(actual!==expectedTree)throw new Error('GITHUB_TRANSPORT_TREE_MISMATCH expected='+expectedTree+' actual='+actual);
  mark('GITHUB_TRANSPORT_TREE_PARITY','PASS',actual);
  return actual;
}
async function tryGitHubTreeTransport(){
  if(!/^[0-9a-f]{40}$/i.test(GITHUB_TRANSPORT_COMMIT)||!/^[0-9a-f]{40}$/i.test(GITHUB_TRANSPORT_TREE_SHA))return false;
  const archive=path.join(ROOT,'.github-transport-'+GITHUB_TRANSPORT_COMMIT+'.tar.gz');
  const url='https://codeload.github.com/'+GITHUB_TRANSPORT_REPOSITORY+'/tar.gz/'+GITHUB_TRANSPORT_COMMIT;
  fs.rmSync(archive,{force:true});
  fs.rmSync(OS_DIR,{recursive:true,force:true});
  fs.mkdirSync(OS_DIR,{recursive:true});
  await run('curl',['--fail','--silent','--show-error','--location','--retry','5','--retry-all-errors','--retry-delay','2',url,'-o',archive],ROOT);
  assertSafeTar(archive);
  await run('tar',['-xzf',archive,'--strip-components=1','-C',OS_DIR],ROOT);
  await proveGitTreeParity(OS_DIR,GITHUB_TRANSPORT_TREE_SHA);
  fs.rmSync(BRIDGE_ARCHIVE,{force:true});
  await run('tar',['-czf',BRIDGE_ARCHIVE,'-C',OS_DIR,'.'],ROOT);
  assertSafeTar(BRIDGE_ARCHIVE);
  const digest=crypto.createHash('sha256').update(fs.readFileSync(BRIDGE_ARCHIVE)).digest('hex');
  state.bridge={accepted:true,provider:'github-tree-proven-transport',bytes:fs.statSync(BRIDGE_ARCHIVE).size,sha256:digest,sourceSha:SOURCE_SHA,transportCommit:GITHUB_TRANSPORT_COMMIT,transportTree:GITHUB_TRANSPORT_TREE_SHA,at:new Date().toISOString()};
  mark('SOURCE_BRIDGE_ARCHIVE_ACCEPTED','PASS',SOURCE_SHA+' github-tree-proven-transport');
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
    let transported=false;
    try{transported=await tryGitHubTreeTransport()}catch(transportError){
      console.error('GITHUB_TRANSPORT_REJECT='+String(transportError?.message||transportError));
      fs.rmSync(OS_DIR,{recursive:true,force:true});
      fs.mkdirSync(OS_DIR,{recursive:true});
    }
    if(transported){
      transport='github-tree-proven-transport';
    }else{
      const bridged=await waitForBridgeArchive();
      transport='gitlab-ci-source-bridge';
      await run('tar',['-xzf',bridged,'-C',OS_DIR],ROOT);
    }
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
async function interactiveWixDeviceLogin(){
  state.phase='WIX_AUTH_DEVICE_LOGIN';
  state.status='AWAITING_WIX_DEVICE_AUTHORIZATION';
  state.auth={status:'STARTING_DEVICE_LOGIN',startedAt:new Date().toISOString()};
  await new Promise((resolve,reject)=>{
    const child=spawn('npx',['-y','@wix/cli@latest','login'],{
      cwd:REL,
      env:{...process.env,CI:'0',AI_AGENT:'wix-headless-skill',NO_COLOR:'1'},
      stdio:['ignore','pipe','pipe']
    });
    let buffer='';
    const consume=(chunk,stream)=>{
      const raw=String(chunk||'');
      if(stream==='stdout')process.stdout.write(raw);else process.stderr.write(raw);
      buffer+=raw;
      const lines=buffer.split(/\r?\n/);
      buffer=lines.pop()||'';
      for(const line of lines){
        const trimmed=line.trim();
        if(!trimmed)continue;
        try{
          const event=JSON.parse(trimmed);
          if(event?.event==='awaiting_user'&&event?.verificationUri&&event?.userCode){
            state.auth={
              status:'AWAITING_USER',
              verificationUri:String(event.verificationUri),
              userCode:String(event.userCode),
              expiresInSeconds:Number(event.expiresInSeconds)||600,
              observedAt:new Date().toISOString()
            };
            mark('WIX_DEVICE_AUTH_CHALLENGE','PASS','user-action-required');
          }else if(event?.event==='success'){
            state.auth={status:'AUTHORIZED',email:event?.email||null,userId:event?.userId||null,observedAt:new Date().toISOString()};
            mark('WIX_DEVICE_AUTH','PASS','authorized');
          }
        }catch{}
      }
    };
    child.stdout.on('data',d=>consume(d,'stdout'));
    child.stderr.on('data',d=>consume(d,'stderr'));
    child.on('error',reject);
    child.on('close',code=>code===0?resolve():reject(new Error('WIX_DEVICE_LOGIN_EXIT_'+code)));
    const timer=setTimeout(()=>{try{child.kill('SIGTERM')}catch{};reject(new Error('WIX_DEVICE_LOGIN_TIMEOUT'))},11*60*1000);
    timer.unref?.();
  });
}
async function ensureAuth(){
  try{
    const who=sh('npx',['-y','@wix/cli@latest','whoami'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    if(who){mark('WIX_AUTH','PASS','cached');state.auth={status:'AUTHORIZED',mode:'cached'};return;}
  }catch{}
  for(const alias of ['WIX_OS_API_KEY','WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY']){
    const value=String(process.env[alias]||'').trim();
    if(!value)continue;
    await run('npx',['-y','@wix/cli@latest','login','--api-key',value],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
    mark('WIX_AUTH','PASS',alias);
    state.auth={status:'AUTHORIZED',mode:'api-key',alias};
    return;
  }
  const durableAuthRequired=String(process.env.WIX_DURABLE_AUTH_REQUIRED||'1').trim()!=='0';
  if(durableAuthRequired){
    mark('WIX_AUTH_DURABLE_CREDENTIAL','MISS','durable-api-key-required');
    state.auth={status:'BLOCKED',mode:'durable-api-key-required'};
    throw new Error('WIX_DURABLE_AUTH_REQUIRED_API_KEY_MISSING');
  }
  mark('WIX_AUTH_DURABLE_CREDENTIAL','MISS','explicit-manual-recovery-enabled');
  await interactiveWixDeviceLogin();
  const who=sh('npx',['-y','@wix/cli@latest','whoami'],REL,{CI:'1',AI_AGENT:'wix-headless-skill'});
  if(!who)throw new Error('WIX_DEVICE_AUTH_REREAD_FAILED');
  state.auth={...(state.auth||{}),status:'AUTHORIZED',mode:'device-login',reread:true};
  mark('WIX_AUTH','PASS','device-login');
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
    if(EXTERNAL_BUILDER_ONLY){
      state.phase='EXTERNAL_BUILD_READY';state.ok=true;state.released=false;state.status='SOURCE_ARCHIVE_READY_FOR_GITHUB_BUILDER';
      mark('EXTERNAL_BUILD_HANDOFF','PASS',SOURCE_SHA);
      console.log('SOURCE_ARCHIVE_READY_FOR_GITHUB_BUILDER '+SOURCE_SHA);
      await prepareExternalBuildRelease();
      await ensureAuth();
      await releaseTarget(LIVE,'LIVE');
      await proveIdentity(CANONICAL,'CANONICAL');
      state.phase='DONE';state.ok=true;state.released=true;state.status='OS_LIVE_EXACT_SHA_VERIFIED';
      console.log('OS_LIVE_EXACT_SHA_VERIFIED '+JSON.stringify({sourceSha:SOURCE_SHA,builder:'github-hosted'}));
      return;
    }
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
  if(await receiveBuildArtifact(req,res))return;
  if(await serveBridgeArchive(req,res))return;
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>{console.log('OS_EXACT_GITLAB_RELEASE_CONTROLLER_READY');void main();});
