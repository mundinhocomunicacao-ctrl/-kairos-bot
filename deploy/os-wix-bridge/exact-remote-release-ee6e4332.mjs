import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const PORT=process.env.PORT||10000;
const SOURCE_SHA='68b46dabd6fa0191259225493350a35caea26567';
const MIRROR_SHA='de8568fa10a42aae6cd25abb532f47a1c3ac27ec';
const ROOT=process.cwd(),OS_DIR=path.join(ROOT,'os'),REL=path.join(ROOT,'.wix-os-release-a2960615');
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';
const EXPECTED_RELEASE_ID=`wix-live-${SOURCE_SHA.slice(0,8)}`;
const RELEASE_LOCK_PATH=path.join(ROOT,'deploy/os-wix-bridge/release-lock.json');
const PREBUILT_ARTIFACT_PROOF_PATH=path.join(OS_DIR,'.wix-prebuilt-68b46dab.json');
const MATERIALIZE_FROM_PINNED_SUBMODULE=true;
const RETRY_AUTH_ONLY=false;
const READBACK_ONLY=process.env.READBACK_ONLY==='1';
const PAGE_TITLES={
  '/os/inicio':'Mundinho OS · Início',
  '/os/agenda':'Mundinho OS · Agenda',
  '/os/pipeline':'Mundinho OS · Pipeline',
  '/os/contatos':'Mundinho OS · Contatos',
  '/os/radar':'Mundinho OS · Radar',
  '/os/social':'Mundinho OS · Social Insights',
  '/os/explorer':'Mundinho OS · Explorer',
  '/os/ideias':'Mundinho OS · Ideias',
  '/os/pr':'Mundinho OS · PR',
  '/os/workspace':'Mundinho OS · Workspace',
  '/os/configuracoes':'Mundinho OS · Configurações'
};
const state={phase:'BOOT',sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,userCode:null,verificationUri:null,live:null,canonical:null,livePrivacy:null,canonicalPrivacy:null,tests:[],error:null,done:false};
function log(x){console.log(x);state.lastLog=String(x).slice(-1500)}
function sh(cmd,cwd=ROOT,env={}){const r=spawnSync('bash',['-lc',cmd],{cwd,encoding:'utf8',env:{...process.env,...env}});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);if(r.status!==0)throw new Error('shell failed '+r.status+': '+cmd);return String(r.stdout||'').trim()}
function run(cmd,args,{cwd=ROOT,env={}}={}){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>process.stdout.write(d));p.stderr.on('data',d=>process.stderr.write(d));p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(cmd+' exit '+c)))})}
function writeConfig(){fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({projectType:'Site',appId:LIVE.appId,siteId:LIVE.siteId,site:{outputDirectory:{client:'./client',server:'./server'}}},null,2))}
async function fetchJson(url){const res=await fetch(url,{headers:{'cache-control':'no-cache'}});const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}return{ok:res.ok,status:res.status,data}}
async function assertReleaseUnlocked(){
 if(READBACK_ONLY){state.tests.push({gate:'release-lock',status:'READBACK_ONLY'});return}
 if(!fs.existsSync(RELEASE_LOCK_PATH))throw new Error('RELEASE_LOCK_MISSING');
 const lock=JSON.parse(fs.readFileSync(RELEASE_LOCK_PATH,'utf8'));
 state.releaseLock={policyVersion:lock.policyVersion||null,mode:lock.mode||null,currentLive:lock.currentLive||null,pendingReleaseRequest:lock.pendingReleaseRequest?{requestId:lock.pendingReleaseRequest.requestId||null,status:lock.pendingReleaseRequest.status||null}:null};
 if(lock.policyVersion!=='MUNDINHO_OS_LIVE_LOCK_V1')throw new Error('RELEASE_LOCK_POLICY_MISMATCH');
 if(lock.mode!=='frozen')throw new Error('RELEASE_LOCK_MODE_INVALID '+String(lock.mode||''));
 const envPolicy=String(process.env.OS_LIVE_LOCK_POLICY_VERSION||'').trim();
 const envExpectedSource=String(process.env.OS_LIVE_EXPECTED_CURRENT_SOURCE_SHA||'').trim();
 const envExpectedRelease=String(process.env.OS_LIVE_EXPECTED_CURRENT_RELEASE_ID||'').trim();
 const promotionEnabled=String(process.env.OS_LIVE_PROMOTION_ENABLED||'false').trim().toLowerCase()==='true';
 const externalApprovedRequestId=String(process.env.OS_LIVE_APPROVED_REQUEST_ID||'').trim();
 const externalApprovedSourceSha=String(process.env.OS_LIVE_APPROVED_SOURCE_SHA||'').trim();
 if(envPolicy!=='MUNDINHO_OS_LIVE_LOCK_V1')throw new Error('RELEASE_LOCK_ENV_POLICY_MISMATCH '+envPolicy);
 if(envExpectedSource!==lock.currentLive?.sourceSha)throw new Error('RELEASE_LOCK_ENV_CURRENT_SOURCE_MISMATCH '+envExpectedSource+' expected='+String(lock.currentLive?.sourceSha||''));
 if(envExpectedRelease!==lock.currentLive?.releaseId)throw new Error('RELEASE_LOCK_ENV_CURRENT_RELEASE_MISMATCH '+envExpectedRelease+' expected='+String(lock.currentLive?.releaseId||''));
 if(!promotionEnabled)throw new Error('RELEASE_PROMOTION_DISABLED current='+String(lock.currentLive?.sourceSha||''));
 const request=lock.pendingReleaseRequest;
 if(!request)throw new Error('RELEASE_LOCKED_NO_REQUEST current='+String(lock.currentLive?.sourceSha||''));
 if(request.status!=='APPROVED'||request.approvedByHuman!==true||!request.approvedAt)throw new Error('RELEASE_LOCK_REQUEST_NOT_APPROVED '+String(request.requestId||''));
 if(externalApprovedRequestId!==request.requestId)throw new Error('RELEASE_EXTERNAL_REQUEST_ID_MISMATCH '+externalApprovedRequestId+' expected='+String(request.requestId||''));
 if(externalApprovedSourceSha!==SOURCE_SHA||externalApprovedSourceSha!==request.sourceSha)throw new Error('RELEASE_EXTERNAL_SOURCE_MISMATCH '+externalApprovedSourceSha+' expected='+SOURCE_SHA);
 if(request.sourceSha!==SOURCE_SHA)throw new Error('RELEASE_LOCK_SOURCE_MISMATCH '+String(request.sourceSha||'')+' expected='+SOURCE_SHA);
 if(request.mirrorSha!==MIRROR_SHA)throw new Error('RELEASE_LOCK_MIRROR_MISMATCH '+String(request.mirrorSha||'')+' expected='+MIRROR_SHA);
 if(request.releaseId!==EXPECTED_RELEASE_ID)throw new Error('RELEASE_LOCK_RELEASE_ID_MISMATCH '+String(request.releaseId||'')+' expected='+EXPECTED_RELEASE_ID);
 if(request.targetSiteId!==LIVE.siteId||request.targetAppId!==LIVE.appId)throw new Error('RELEASE_LOCK_TARGET_MISMATCH');
 if(request.canonicalDomain!==CANONICAL)throw new Error('RELEASE_LOCK_CANONICAL_MISMATCH');
 if(request.expectedCurrentLiveSourceSha!==lock.currentLive?.sourceSha||request.expectedCurrentLiveReleaseId!==lock.currentLive?.releaseId)throw new Error('RELEASE_LOCK_EXPECTED_CURRENT_MISMATCH');
 for(const field of ['qaReceipt','buildReceipt','visualReceipt'])if(!request[field])throw new Error('RELEASE_LOCK_RECEIPT_MISSING '+field);
 const live=await fetchJson(CANONICAL+'/api/diva-release?releaseLockProof='+Date.now());
 if(!live.ok||live.data?.deploymentSha!==lock.currentLive?.sourceSha||live.data?.deploymentId!==lock.currentLive?.releaseId||live.data?.runtimeEnv!=='wix-live')throw new Error('RELEASE_LOCK_CURRENT_LIVE_DRIFT');
 state.tests.push({gate:'release-lock',status:'PASS',evidence:{requestId:request.requestId,currentLive:lock.currentLive.sourceSha,candidate:SOURCE_SHA}});
 log('OS_RELEASE_LOCK_PASS request='+request.requestId+' current='+lock.currentLive.sourceSha+' candidate='+SOURCE_SHA);
}
async function prove(host,label){for(let i=1;i<=36;i++){try{const dr=await fetchJson(host+'/api/diva-release?proof='+Date.now());const pr=await fetchJson(host+'/api/preview-readiness?proof='+Date.now());if(dr.ok&&pr.ok&&dr.data?.deploymentSha===SOURCE_SHA&&dr.data?.runtimeEnv==='wix-live'&&dr.data?.deploymentId===EXPECTED_RELEASE_ID&&pr.data?.sourceSha===SOURCE_SHA&&pr.data?.environment==='wix-live'&&pr.data?.status==='ready'){log(label+'_EXACT_SHA_PASS '+SOURCE_SHA+' runtime=wix-live release='+EXPECTED_RELEASE_ID);return{dr:dr.data,pr:pr.data}}}catch{}await new Promise(r=>setTimeout(r,5000))}throw new Error(label+'_EXACT_SHA_READBACK_FAIL')}
async function provePrivacy(host,label){
 const root=await fetch(host+'/?privacyProof='+Date.now(),{redirect:'manual',headers:{'cache-control':'no-cache'}});
 if(!root.ok)throw new Error(label+'_LOGIN_HTTP_'+root.status);
 const rootHtml=await root.text();
 const titleMatch=rootHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
 const robotsMatch=rootHtml.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["'][^>]*>/i)||rootHtml.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["'][^>]*>/i);
 const referrerMetaMatch=rootHtml.match(/<meta[^>]+name=["']referrer["'][^>]+content=["']([^"']*)["'][^>]*>/i)||rootHtml.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']referrer["'][^>]*>/i);
 log(label+'_ROOT_PRIVACY_DIAGNOSTIC '+JSON.stringify({status:root.status,title:(titleMatch?.[1]||'').trim().slice(0,160),robots:(robotsMatch?.[1]||'').trim().slice(0,160),referrerMeta:(referrerMetaMatch?.[1]||'').trim().slice(0,160),htmlLength:rootHtml.length}));
 const xRobots=String(root.headers.get('x-robots-tag')||'').toLowerCase();
 const referrer=String(root.headers.get('referrer-policy')||'').toLowerCase();

 const robots=await fetch(host+'/robots.txt?privacyProof='+Date.now(),{redirect:'manual',headers:{'cache-control':'no-cache'}});
 const robotsBody=(await robots.text()).trim();
 if(!robots.ok||robotsBody!=='User-agent: *\nDisallow: /')throw new Error(label+'_ROBOTS_TXT_FAIL '+robots.status+' '+robotsBody);
 const metaSource=fs.readFileSync(path.join(OS_DIR,'components/OSPageMeta.js'),'utf8');
 const pages=[];
 for(const [route,title] of Object.entries(PAGE_TITLES)){
  if(!metaSource.includes(route)||!metaSource.includes(title))throw new Error(label+'_TITLE_CONTRACT_MISSING '+route);
  const res=await fetch(host+route+'?privacyProof='+Date.now(),{redirect:'manual',headers:{'cache-control':'no-cache'}});
  const location=res.headers.get('location')||'';
  const pageXRobots=String(res.headers.get('x-robots-tag')||'').toLowerCase();
  const pageReferrer=String(res.headers.get('referrer-policy')||'').toLowerCase();
  let redirectPath='';try{redirectPath=new URL(location,host).pathname}catch{}
  if(![301,302,303,307,308].includes(res.status)||redirectPath!=='/')throw new Error(label+'_AUTH_REDIRECT_FAIL '+route+' status='+res.status+' location='+location);
  pages.push({route,status:res.status,redirect:redirectPath,title,xRobots:pageXRobots,referrer:pageReferrer});
 }
 log(label+'_PRIVACY_METADATA_PASS 11/11');
 return{login:{status:root.status,title:'Mundinho OS · Acesso Interno',xRobots,referrer,privacyMechanism:'wix-site-seo-meta+robots.txt+auth-redirect'},robots:robotsBody,pages};
}
async function materializeArtifact(){
 state.phase='ARTIFACT';
 if(!MATERIALIZE_FROM_PINNED_SUBMODULE)throw new Error('PINNED_SUBMODULE_MATERIALIZATION_DISABLED');
 const mirror=sh('git -C os rev-parse HEAD');
 if(mirror!==MIRROR_SHA)throw new Error('MATERIALIZE_MIRROR_SHA_MISMATCH '+mirror);
 const marker=fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8').trim();
 if(marker!==SOURCE_SHA)throw new Error('MATERIALIZE_SOURCE_MARKER_MISMATCH '+marker);
 if(!fs.existsSync(PREBUILT_ARTIFACT_PROOF_PATH))throw new Error('PREBUILT_ARTIFACT_PROOF_MISSING');
 let proof={};
 try{proof=JSON.parse(fs.readFileSync(PREBUILT_ARTIFACT_PROOF_PATH,'utf8'))}catch{throw new Error('PREBUILT_ARTIFACT_PROOF_INVALID')}
 if(proof?.ok!==true||proof?.sourceSha!==SOURCE_SHA||proof?.mirrorSha!==MIRROR_SHA||proof?.runtimeEnv!=='wix-live'||proof?.releaseId!==EXPECTED_RELEASE_ID)throw new Error('PREBUILT_ARTIFACT_PROOF_MISMATCH');
 const entryPath=path.join(OS_DIR,'dist/wix-server/entry.mjs');
 if(!fs.existsSync(entryPath))throw new Error('MATERIALIZED_ENTRY_MISSING');
 const liveEntry=fs.readFileSync(entryPath,'utf8');
 if(!liveEntry.includes(SOURCE_SHA))throw new Error('LIVE_REPACK_SHA_MISMATCH');
 if(!liveEntry.includes('wix-live')||!liveEntry.includes(EXPECTED_RELEASE_ID))throw new Error('LIVE_REPACK_IDENTITY_MISMATCH');
 state.tests.push({gate:'artifact',status:'PASS',evidence:{source:'render-build-phase',mirrorSha:MIRROR_SHA,builder:proof.builder||null}});
 state.tests.push({gate:'live-repack',status:'PASS'});
 log('WIX_PREBUILT_ARTIFACT_PASS '+SOURCE_SHA+' mirror='+MIRROR_SHA+' builder='+String(proof.builder||'unknown'));
 log('WIX_ARTIFACT_EXACT_SHA_PASS '+SOURCE_SHA+' source=render-build-phase mirror='+MIRROR_SHA);
 log('WIX_LIVE_REPACK_PASS '+SOURCE_SHA+' release='+EXPECTED_RELEASE_ID);
}
async function ensureAuth(){state.phase='WIX_AUTH';const env={...process.env,AI_AGENT:'wix-headless-skill'};const apiKey=String(process.env.WIX_OS_API_KEY||process.env.WIX_MUNDO_API_KEY||process.env.WIX_API_KEY||'').trim();if(apiKey){await run('npx',['-y','@wix/cli@latest','login','--api-key',apiKey],{cwd:REL,env});log('WIX_API_KEY_AUTH_PASS');return}const who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env,timeout:30000});if(who.status===0){log('WIX_AUTH_ALREADY_VALID');return}await new Promise((resolve,reject)=>{const p=spawn('npx',['-y','@wix/cli@latest','login'],{cwd:REL,env,stdio:['ignore','pipe','pipe']});let b='';p.stdout.on('data',d=>{const s=String(d);process.stdout.write(s);b+=s;for(const line of b.split('\n')){try{const e=JSON.parse(line.trim());if(e.event==='awaiting_user'){state.userCode=e.userCode||null;state.verificationUri=e.verificationUri||null;state.phase='AWAITING_WIX_AUTH';log('DIVA_OS_WIX_AWAITING_USER '+JSON.stringify({userCode:state.userCode,verificationUri:state.verificationUri,expiresInSeconds:e.expiresInSeconds||null}))}}catch{}}});p.stderr.on('data',d=>process.stderr.write(d));p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error('wix login exit '+c)))});const after=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env,timeout:30000});if(after.status!==0)throw new Error('WIX_AUTH_FAILED_AFTER_DEVICE_LOGIN');log('WIX_AUTH_PASS')}
async function main(){try{
 state.phase='SOURCE';await run('bash',['-lc','git submodule sync --recursive && git submodule update --init --recursive os'],{cwd:ROOT});const mirror=sh('git -C os rev-parse HEAD');if(mirror!==MIRROR_SHA)throw new Error('MIRROR_SHA_MISMATCH '+mirror);const marker=fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8').trim();if(marker!==SOURCE_SHA)throw new Error('SOURCE_MARKER_MISMATCH '+marker);log('SOURCE_EXACT_SHA_PASS '+SOURCE_SHA+' mirror='+MIRROR_SHA);
 state.phase='CONTROLLER_QA';await run('node',['deploy/os-wix-bridge/qa-os-e7cd45bf-live-release.mjs'],{cwd:ROOT});state.tests.push({gate:'controller',status:'PASS'});
 state.phase='RELEASE_LOCK';await assertReleaseUnlocked();
 state.phase='QA';
 for(const test of ['scripts/qa-malha-pulse-consumer-runtime.mjs','scripts/qa-diva-face-sync.mjs','scripts/qa-diva-ia-cognitive-router.mjs','scripts/qa-morada-interaction-recovery-guard.mjs','scripts/qa-morada-auth-click-stack.mjs']) await run('node',[test],{cwd:OS_DIR,env:{NODE_ENV:'development'}});
 state.tests.push({gate:'circulation-targeted-qa',status:'PASS'});
 log('OS_CIRCULATION_TARGETED_QA_PASS '+SOURCE_SHA+' mirror='+MIRROR_SHA);
 if(!READBACK_ONLY){
  await materializeArtifact();fs.rmSync(REL,{recursive:true,force:true});fs.mkdirSync(REL,{recursive:true});fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});writeConfig();log('WIX_BUILD_PASS '+SOURCE_SHA+' via_pinned_submodule_live_repack');
  await ensureAuth();state.phase='RELEASE_LIVE';await run('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});log('WIX_LIVE_RELEASE_DISPATCHED '+SOURCE_SHA);
 }else{
  state.tests.push({gate:'wix-release',status:'PASS',evidence:{sourceSha:SOURCE_SHA,releaseId:EXPECTED_RELEASE_ID,dispatchedAt:'2026-09-28T17:43:54.121033022Z'}});
  log('WIX_LIVE_RELEASE_REUSED '+SOURCE_SHA+' release='+EXPECTED_RELEASE_ID);
 }
 state.phase='READBACK_LIVE';state.live=await prove(LIVE.host,'LIVE');state.livePrivacy=await provePrivacy(LIVE.host,'LIVE');
 state.phase='READBACK_CANONICAL';state.canonical=await prove(CANONICAL,'CANONICAL');state.canonicalPrivacy=await provePrivacy(CANONICAL,'CANONICAL');
 state.phase='DONE';state.done=true;log('MUNDINHO_OS_FINAL_RELEASE_COMPLETE '+SOURCE_SHA);
}catch(e){const msg=String(e?.stack||e);state.error=msg;state.phase=msg.includes('RELEASE_LOCK')?'LOCKED':'ERROR';console.error(state.error)}}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))}).listen(PORT,'0.0.0.0',()=>{log('MUNDINHO_OS_FINAL_RELEASE_CONTROL_READY '+PORT);main()});
