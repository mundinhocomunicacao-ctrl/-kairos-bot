import http from 'node:http';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';

const PORT=process.env.PORT||10000;
const ROOT=process.cwd();
const QA_SITE=process.env.MUNDINHO_WIX_QA_SITE_ID||'242b9d6f-71ad-40c6-b1d7-f1f0825e01be';
const QA_APP=process.env.MUNDINHO_WIX_QA_APP_ID||'8fabf7a9-b3c7-43af-ab51-e37968937afb';
const SOURCE_SHA=process.env.MUNDO_RUNTIME_SOURCE_SHA||'be822ffc6353237a413222ea036bf6eabc45f8e4';
const REL=path.join(ROOT,'.wix-qa-release');
const state={phase:'BOOT',sourceSha:SOURCE_SHA,qaSiteId:QA_SITE,login:[],whoami:null,release:[],error:null,done:false};

function emit(phase,line){
  state.phase=phase;
  const s=String(line||'').trim();
  if(!s)return;
  if(phase==='LOGIN')state.login.push(s);
  else if(phase==='RELEASE')state.release.push(s);
  process.stdout.write('['+phase+'] '+s+'\n');
}
function run(cmd,args,cwd=ROOT,phase='RUN'){
  return new Promise((resolve,reject)=>{
    const p=spawn(cmd,args,{cwd,env:{...process.env,CI:'1'},stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>emit(phase,d));
    p.stderr.on('data',d=>emit(phase,d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve(code):reject(new Error(phase+'_EXIT_'+code)));
  });
}
function prepare(){
  fs.rmSync(REL,{recursive:true,force:true});
  fs.mkdirSync(REL,{recursive:true});
  fs.cpSync(path.join(ROOT,'os/dist/client'),path.join(REL,'client'),{recursive:true});
  fs.cpSync(path.join(ROOT,'os/dist/wix-server'),path.join(REL,'server'),{recursive:true});
  fs.writeFileSync(path.join(REL,'wix.config.json'),JSON.stringify({
    projectType:'Site',
    appId:QA_APP,
    siteId:QA_SITE,
    site:{outputDirectory:{client:'./client',server:'./server'}}
  },null,2));
}
async function main(){
  try{
    prepare();
    state.phase='LOGIN';
    emit('LOGIN','WIX_REMOTE_LOGIN_START');
    await run('npx',['--yes','@wix/cli@latest','login'],REL,'LOGIN');
    state.phase='WHOAMI';
    const chunks=[];
    const p=spawn('npx',['--yes','@wix/cli@latest','whoami'],{cwd:REL,env:{...process.env,CI:'1'}});
    p.stdout.on('data',d=>{chunks.push(String(d));emit('WHOAMI',d)});
    p.stderr.on('data',d=>{chunks.push(String(d));emit('WHOAMI',d)});
    await new Promise((resolve,reject)=>p.on('close',c=>c===0?resolve():reject(new Error('WHOAMI_EXIT_'+c))));
    state.whoami=chunks.join('').trim();
    state.phase='RELEASE';
    await run('npx',['--yes','@wix/cli@latest','release','--comment','DIVA remote QA '+SOURCE_SHA],REL,'RELEASE');
    state.phase='DONE';state.done=true;
  }catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error)}
}
http.createServer((req,res)=>{
  if(req.url==='/status'){res.setHeader('content-type','application/json');return res.end(JSON.stringify(state,null,2));}
  res.setHeader('content-type','text/plain; charset=utf-8');
  res.end('DIVA WIX REMOTE RELEASE\nphase='+state.phase+'\nsourceSha='+state.sourceSha+'\n');
}).listen(PORT,'0.0.0.0',()=>{console.log('REMOTE_WIX_RELEASE_CONTROL_READY',PORT);main();});
