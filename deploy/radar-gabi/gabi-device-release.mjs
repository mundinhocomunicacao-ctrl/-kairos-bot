import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SITE_ID='7687d145-056b-4cc0-9f6f-70c2bb32912e';
const APP_ID='97cc208c-a172-4f52-8427-1f301aa42049';
const LIVE_URL='https://radar.gabi.mundinhocomunicacao.com/';
const SOURCE_URL=String(process.env.GABI_ARTIFACT_URL||'').trim();
const SOURCE_SHA=String(process.env.GABI_CANONICAL_SOURCE_SHA||'').trim();
const ROOT=process.cwd();
const RELEASE_DIR=path.join(ROOT,'.gabi-wix-release');
let state={phase:'BOOTING',ok:false,released:false};

const requiredMarkers=[
  'data-diva-face="DIVA_GABI"',
  'data-diva-root="DIVA_RAIZ"',
  'data-orbi-visual="diva-official-v1"',
  'class="gabiDivaOrb divaAvatar2D hero state-ready"',
  'presented:68',
  'proposalSent:18',
  'mediaKitSent:4',
  'dmApproached:5',
  'whatsappApproached:8'
];
const forbiddenMarkers=['.divaRealModel','.divaStageHalo','.divaStageFloor','<model-viewer','static.wixstatic.com/3d/'];

async function prepare(){
  if(!/^https:\/\//.test(SOURCE_URL))throw new Error('GABI_ARTIFACT_URL_INVALID');
  if(!/^[a-f0-9]{40}$/i.test(SOURCE_SHA))throw new Error('GABI_CANONICAL_SOURCE_SHA_INVALID');
  const res=await fetch(SOURCE_URL,{redirect:'follow'});
  if(!res.ok)throw new Error('GABI_ARTIFACT_FETCH_FAILED:'+res.status);
  const html=await res.text();
  for(const marker of requiredMarkers)if(!html.includes(marker))throw new Error('GABI_REQUIRED_MARKER_MISSING:'+marker);
  for(const marker of forbiddenMarkers)if(html.includes(marker))throw new Error('GABI_FORBIDDEN_MARKER:'+marker);
  fs.rmSync(RELEASE_DIR,{recursive:true,force:true});
  fs.mkdirSync(path.join(RELEASE_DIR,'dist'),{recursive:true});
  fs.writeFileSync(path.join(RELEASE_DIR,'dist','index.html'),html);
  fs.writeFileSync(path.join(RELEASE_DIR,'wix.config.json'),JSON.stringify({
    projectType:'Site',appId:APP_ID,siteId:SITE_ID,site:{outputDirectory:'./dist'}
  },null,2));
  console.log('GABI_ARTIFACT_VALIDATED '+JSON.stringify({sourceSha:SOURCE_SHA,bytes:Buffer.byteLength(html)}));
}

async function deviceLogin(){
  await new Promise((resolve,reject)=>{
    const p=spawn('npx',['-y','@wix/cli@latest','login'],{
      cwd:RELEASE_DIR,env:{...process.env,AI_AGENT:'wix-headless-skill'},
      stdio:['ignore','pipe','pipe']
    });
    let buffer='';
    const scan=(chunk)=>{
      const s=String(chunk);process.stdout.write(s);buffer+=s;
      for(const line of buffer.split('\n')){
        try{
          const e=JSON.parse(line.trim());
          if(e.event==='awaiting_user'){
            state={...state,phase:'AWAITING_WIX_AUTH',userCode:e.userCode||null,verificationUri:e.verificationUri||null,authExpiresInSeconds:e.expiresInSeconds||null};
            console.log('GABI_WIX_AWAITING_USER '+JSON.stringify({userCode:state.userCode,verificationUri:state.verificationUri,expiresInSeconds:state.authExpiresInSeconds}));
          }
          if(e.event==='success')console.log('GABI_WIX_DEVICE_AUTH_SUCCESS_EVENT');
        }catch{}
      }
    };
    p.stdout.on('data',scan);p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error('wix login exit '+code)));
  });
  state={...state,userCode:null,verificationUri:null,authExpiresInSeconds:null};
  console.log('GABI_WIX_DEVICE_AUTH_PASS');
}

async function run(){
  try{
    state={phase:'PREPARE',ok:false,released:false,sourceSha:SOURCE_SHA};
    await prepare();
    state={...state,phase:'AUTH'};
    await deviceLogin();
    state={...state,phase:'RELEASE'};
    execFileSync('npx',['-y','@wix/cli@latest','release'],{
      cwd:RELEASE_DIR,stdio:'inherit',
      env:{...process.env,CI:'1',AI_AGENT:'wix-headless-skill'}
    });
    state={...state,phase:'READBACK'};
    let live='';
    for(let i=0;i<18;i++){
      const res=await fetch(LIVE_URL+'?dedupe='+Date.now()+'-'+i,{redirect:'follow',headers:{'cache-control':'no-cache'}});
      live=res.ok?await res.text():'';
      if(['presented:68','proposalSent:18','mediaKitSent:4','dmApproached:5','whatsappApproached:8'].every(x=>live.includes(x)))break;
      await new Promise(r=>setTimeout(r,5000));
    }
    for(const marker of ['presented:68','proposalSent:18','mediaKitSent:4','dmApproached:5','whatsappApproached:8']){
      if(!live.includes(marker))throw new Error('GABI_LIVE_READBACK_MISSING:'+marker);
    }
    state={phase:'WIX_GABI_LIVE_RELEASE_VERIFIED',ok:true,released:true,sourceSha:SOURCE_SHA,siteId:SITE_ID,appId:APP_ID};
    console.log('WIX_GABI_LIVE_RELEASE_VERIFIED '+JSON.stringify(state));
  }catch(error){
    state={...state,phase:'EXECUTOR_ERROR',ok:false,released:false,error:String(error?.message||error)};
    console.error('GABI_EXECUTOR_ERROR '+JSON.stringify(state));
  }
}

http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state));
}).listen(PORT,'0.0.0.0',()=>{console.log('GABI_WIX_RELEASE_EXECUTOR_READY');setImmediate(run);});
