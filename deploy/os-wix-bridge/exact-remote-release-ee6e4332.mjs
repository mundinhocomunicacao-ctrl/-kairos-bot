import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const PORT=process.env.PORT||10000;
const SOURCE_SHA='0ef4fd81aa7e313cb78abf9933f00039aa4360cf';
const MIRROR_SHA='15b1f732255d2c528d5bf4f71ab6eecf2ba78b21';
const ROOT=process.cwd(),OS_DIR=path.join(ROOT,'os'),REL=path.join(ROOT,'.wix-os-release-0ef4fd81');
const LIVE={siteId:'c80689f2-6627-45fa-a264-4ab2863ba306',appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e',host:'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com'};
const CANONICAL='https://os.mundinhocomunicacao.com';
const ARTIFACT_URL='https://mundinho-os-current-be822-artifact-v2.onrender.com/artifact';
const state={phase:'BOOT',sourceSha:SOURCE_SHA,mirrorSha:MIRROR_SHA,userCode:null,verificationUri:null,live:null,canonical:null,tests:[],error:null,done:false};
function log(x){console.log(x);state.lastLog=String(x).slice(-1500)}
function sh(cmd,cwd=ROOT,env={}){const r=spawnSync('bash',['-lc',cmd],{cwd,encoding:'utf8',env:{...process.env,...env}});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);if(r.status!==0)throw new Error('shell failed '+r.status+': '+cmd);return String(r.stdout||'').trim()}
function run(cmd,args,{cwd=ROOT,env={}}={}){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>process.stdout.write(d));p.stderr.on('data',d=>process.stderr.write(d));p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error(cmd+' exit '+c)))})}
function writeConfig(){fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({projectType:'Site',appId:LIVE.appId,siteId:LIVE.siteId,site:{outputDirectory:{client:'./client',server:'./server'}}},null,2))}
async function fetchJson(url){const res=await fetch(url,{headers:{'cache-control':'no-cache'}});const raw=await res.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}return{ok:res.ok,status:res.status,data}}
async function prove(host,label){for(let i=1;i<=36;i++){try{const dr=await fetchJson(host+'/api/diva-release?proof='+Date.now());const pr=await fetchJson(host+'/api/preview-readiness?proof='+Date.now());if(dr.ok&&pr.ok&&dr.data?.deploymentSha===SOURCE_SHA&&pr.data?.sourceSha===SOURCE_SHA&&pr.data?.status==='ready'){log(label+'_EXACT_SHA_PASS '+SOURCE_SHA);return{dr:dr.data,pr:pr.data}}}catch{}await new Promise(r=>setTimeout(r,5000))}throw new Error(label+'_EXACT_SHA_READBACK_FAIL')}
async function materializeArtifact(){
 state.phase='ARTIFACT';
 const res=await fetch(ARTIFACT_URL+'?source='+SOURCE_SHA,{headers:{'cache-control':'no-cache'}});
 if(!res.ok)throw new Error('ARTIFACT_FETCH_FAILED '+res.status);
 const artifactPath=path.join(ROOT,'os-release-0ef4fd81.tar.gz');
 fs.writeFileSync(artifactPath,Buffer.from(await res.arrayBuffer()));
 fs.rmSync(path.join(OS_DIR,'dist'),{recursive:true,force:true});
 await run('tar',['-xzf',artifactPath,'-C',OS_DIR],{cwd:ROOT});
 const entryPath=path.join(OS_DIR,'dist/wix-server/entry.mjs');
 if(!fs.existsSync(entryPath))throw new Error('ARTIFACT_ENTRY_MISSING');
 const entry=fs.readFileSync(entryPath,'utf8');
 if(!entry.includes(SOURCE_SHA))throw new Error('ARTIFACT_SHA_MISMATCH');
 state.tests.push({gate:'artifact',status:'PASS'});
 log('WIX_ARTIFACT_EXACT_SHA_PASS '+SOURCE_SHA);
}
async function ensureAuth(){state.phase='WIX_AUTH';const env={...process.env,AI_AGENT:'wix-headless-skill'};const apiKey=String(process.env.WIX_OS_API_KEY||process.env.WIX_MUNDO_API_KEY||process.env.WIX_API_KEY||'').trim();if(apiKey){await run('npx',['-y','@wix/cli@latest','login','--api-key',apiKey],{cwd:REL,env});log('WIX_API_KEY_AUTH_PASS');return}const who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env,timeout:30000});if(who.status===0){log('WIX_AUTH_ALREADY_VALID');return}await new Promise((resolve,reject)=>{const p=spawn('npx',['-y','@wix/cli@latest','login'],{cwd:REL,env,stdio:['ignore','pipe','pipe']});let b='';p.stdout.on('data',d=>{const s=String(d);process.stdout.write(s);b+=s;for(const line of b.split('\n')){try{const e=JSON.parse(line.trim());if(e.event==='awaiting_user'){state.userCode=e.userCode||null;state.verificationUri=e.verificationUri||null;state.phase='AWAITING_WIX_AUTH';log('DIVA_OS_WIX_AWAITING_USER '+JSON.stringify({userCode:state.userCode,verificationUri:state.verificationUri,expiresInSeconds:e.expiresInSeconds||null}))}}catch{}}});p.stderr.on('data',d=>process.stderr.write(d));p.on('error',reject);p.on('close',c=>c===0?resolve():reject(new Error('wix login exit '+c)))});const after=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{cwd:REL,encoding:'utf8',env,timeout:30000});if(after.status!==0)throw new Error('WIX_AUTH_FAILED_AFTER_DEVICE_LOGIN');log('WIX_AUTH_PASS')}
async function main(){try{
 state.phase='SOURCE';await run('bash',['-lc','git submodule sync --recursive && git submodule update --init --recursive os'],{cwd:ROOT});const mirror=sh('git -C os rev-parse HEAD');if(mirror!==MIRROR_SHA)throw new Error('MIRROR_SHA_MISMATCH '+mirror);const marker=fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8').trim();if(marker!==SOURCE_SHA)throw new Error('SOURCE_MARKER_MISMATCH '+marker);log('SOURCE_EXACT_SHA_PASS '+SOURCE_SHA+' mirror='+MIRROR_SHA);
 state.phase='CONTROLLER_QA';await run('node',['deploy/os-wix-bridge/qa-os-e7cd45bf-live-release.mjs'],{cwd:ROOT});state.tests.push({gate:'controller',status:'PASS'});
 state.phase='QA';try{await run('npm',['ci','--include=dev'],{cwd:OS_DIR,env:{NODE_ENV:'development'}})}catch{await run('npm',['install','--include=dev','--no-audit','--no-fund'],{cwd:OS_DIR,env:{NODE_ENV:'development'}})}await run('npm',['run','qa:release'],{cwd:OS_DIR});state.tests.push({gate:'qa:release',status:'PASS'});
 await materializeArtifact();fs.rmSync(REL,{recursive:true,force:true});fs.mkdirSync(REL,{recursive:true});fs.cpSync(path.join(OS_DIR,'dist/client'),path.join(REL,'client'),{recursive:true});fs.cpSync(path.join(OS_DIR,'dist/wix-server'),path.join(REL,'server'),{recursive:true});writeConfig();log('WIX_BUILD_PASS '+SOURCE_SHA+' via_artifact');
 await ensureAuth();state.phase='RELEASE_LIVE';await run('npx',['-y','@wix/cli@latest','release'],{cwd:REL,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});log('WIX_LIVE_RELEASE_DISPATCHED '+SOURCE_SHA);
 state.phase='READBACK_LIVE';state.live=await prove(LIVE.host,'LIVE');
 state.phase='READBACK_CANONICAL';state.canonical=await prove(CANONICAL,'CANONICAL');
 state.phase='DONE';state.done=true;log('DIVA_OS_0EF4FD81_RELEASE_COMPLETE '+SOURCE_SHA);
}catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error)}}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))}).listen(PORT,'0.0.0.0',()=>{log('DIVA_OS_0EF4FD81_RELEASE_CONTROL_READY '+PORT);main()});
