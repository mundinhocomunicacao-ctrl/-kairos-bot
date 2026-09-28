import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const ROOT=process.cwd();
const SITE_DIR=path.join(ROOT,'deploy','gabi-radar-official-release','site');
const INDEX=path.join(SITE_DIR,'index.html');
const CONFIG=path.join(SITE_DIR,'wix.config.json');
const DIST=path.join(SITE_DIR,'dist');
const LIVE='https://radar.gabi.mundinhocomunicacao.com/';
const SOURCE_SHA='e7cd45bf38ee4a3dd6bd1eab3b84cb2e1f97b16f';
const state={phase:'BOOT',sourceSha:SOURCE_SHA,userCode:null,verificationUri:null,auth:false,released:false,readback:null,error:null,done:false,lastLog:null};

function log(v){const s=String(v);console.log(s);state.lastLog=s.slice(-1800)}
function run(cmd,args,{cwd=ROOT,env={}}={}){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});p.stdout.on('data',d=>{process.stdout.write(d);parseAuth(String(d))});p.stderr.on('data',d=>process.stderr.write(d));p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(cmd+' exit '+code)))})}
function parseAuth(chunk){for(const line of chunk.split(/\r?\n/)){try{const e=JSON.parse(line.trim());if(e.event==='awaiting_user'){state.userCode=e.userCode||null;state.verificationUri=e.verificationUri||null;state.phase='AWAITING_WIX_AUTH';log('GABI_WIX_AWAITING_USER '+JSON.stringify({userCode:state.userCode,verificationUri:state.verificationUri,expiresInSeconds:e.expiresInSeconds||null}))}if(e.event==='success'){log('GABI_WIX_DEVICE_AUTH_SUCCESS')}}catch{}}}

function verifySource(){
  state.phase='VERIFY_SOURCE';
  const html=fs.readFileSync(INDEX,'utf8');
  const cfg=JSON.parse(fs.readFileSync(CONFIG,'utf8'));
  const checks={
    siteId:cfg.siteId==='7687d145-056b-4cc0-9f6f-70c2bb32912e',
    appId:cfg.appId==='97cc208c-a172-4f52-8427-1f301aa42049',
    official:html.includes('data-orbi-visual="diva-official-v1"'),
    clientSafe:html.includes('GABI_RADAR_PUBLIC_SAFE_V3'),
    broker:html.includes('/api/gabi-diva-studio'),
    noOldCore:!html.includes('<span class="gabiOrbCore">DIVA</span>'),
    literalParity:html.includes('class="gabiDivaOrb divaAvatar2D large state-ready"')&&html.includes('data-diva-avatar="orbi"'),
    neutralStage:!html.includes('background:radial-gradient(circle at 50% 22%,#76518d')
  };
  if(Object.values(checks).some(v=>!v))throw new Error('SOURCE_CONTRACT_FAIL '+JSON.stringify(checks));
  fs.rmSync(DIST,{recursive:true,force:true});fs.mkdirSync(DIST,{recursive:true});
  fs.copyFileSync(INDEX,path.join(DIST,'index.html'));
  log('GABI_SOURCE_CONTRACT_PASS '+JSON.stringify(checks));
}

async function ensureCli(){
  state.phase='INSTALL_WIX_CLI';
  const dir=path.join(os.tmpdir(),'gabi-radar-wix-cli');
  fs.rmSync(dir,{recursive:true,force:true});
  await run('npm',['install','--prefix',dir,'@wix/cli@latest','--no-audit','--no-fund'],{env:{NODE_ENV:'development'}});
  const bin=path.join(dir,'node_modules','.bin','wix');
  if(!fs.existsSync(bin))throw new Error('WIX_CLI_MISSING');
  log('GABI_WIX_CLI_READY');
  return bin;
}

async function ensureAuth(bin){
  state.phase='WIX_AUTH_CHECK';
  const env={CI:'1',AI_AGENT:'wix-headless-skill'};
  let who=spawnSync(bin,['whoami'],{cwd:SITE_DIR,encoding:'utf8',env:{...process.env,...env},timeout:30000});
  if(who.status===0){state.auth=true;log('GABI_WIX_AUTH_ALREADY_VALID');return}
  state.phase='WIX_DEVICE_LOGIN';
  await run(bin,['login'],{cwd:SITE_DIR,env});
  who=spawnSync(bin,['whoami'],{cwd:SITE_DIR,encoding:'utf8',env:{...process.env,...env},timeout:30000});
  if(who.status!==0)throw new Error('WIX_AUTH_FAILED_AFTER_DEVICE_LOGIN');
  state.auth=true;state.phase='WIX_AUTH_PASS';log('GABI_WIX_AUTH_PASS');
}

async function release(bin){
  state.phase='WIX_RELEASE';
  await run(bin,['release'],{cwd:SITE_DIR,env:{CI:'1',AI_AGENT:'wix-headless-skill'}});
  state.released=true;log('GABI_WIX_RELEASE_PASS');
}

async function readback(){
  state.phase='LIVE_READBACK';
  let last={};
  for(let i=0;i<30;i++){
    const url=LIVE+'?orbi_release='+Date.now();
    const res=await fetch(url,{headers:{'cache-control':'no-cache'}});
    const html=await res.text();
    last={
      http:res.status,
      official:html.includes('data-orbi-visual="diva-official-v1"'),
      clientSafe:html.includes('GABI_RADAR_PUBLIC_SAFE_V3'),
      broker:html.includes('/api/gabi-diva-studio'),
      noOldCore:!html.includes('<span class="gabiOrbCore">DIVA</span>'),
      literalParity:html.includes('class="gabiDivaOrb divaAvatar2D large state-ready"')&&html.includes('data-diva-avatar="orbi"'),
      neutralStage:!html.includes('background:radial-gradient(circle at 50% 22%,#76518d'),
      hasHumanLabel:html.includes('Toque para conversar')&&html.includes("'Entendendo'"),
      voiceMenu:html.includes('class="gabiOrbiMenu"')&&html.includes('id="gabiStudioMicMute"')&&html.includes('id="gabiStudioStop"'),
      conversationalVoice:html.includes('Entendendo…')&&html.includes('Respondendo… pode me interromper quando quiser.')
    };
    if(res.ok&&last.official&&last.clientSafe&&last.broker&&last.noOldCore&&last.literalParity&&last.neutralStage&&last.voiceMenu&&last.conversationalVoice){state.readback=last;log('GABI_RADAR_LIVE_READBACK_PASS '+JSON.stringify(last));return}
    await new Promise(r=>setTimeout(r,4000));
  }
  state.readback=last;throw new Error('GABI_RADAR_LIVE_READBACK_FAIL '+JSON.stringify(last));
}

async function main(){
  try{
    verifySource();
    const cli=await ensureCli();
    await ensureAuth(cli);
    await release(cli);
    await readback();
    state.phase='DONE';state.done=true;log('GABI_RADAR_OFFICIAL_ORBI_RELEASE_COMPLETE '+SOURCE_SHA);
  }catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error)}
}

http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))})
.listen(PORT,'0.0.0.0',()=>{log('GABI_RADAR_RELEASE_CONTROLLER_READY '+PORT);main()});
