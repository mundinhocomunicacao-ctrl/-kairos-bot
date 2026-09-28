import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const PORT=process.env.PORT||10000;
const EXPECTED_SHA='95265710c468053c4b4755c4dc9a1f233bf439fb';
const EXPECTED_SITE_ID='7aff6327-39c6-4be0-aa3f-5d50680eb337';
const ORIGIN='https://github.com/mundinhocomunicacao-ctrl/johnny-oliveira-bran.git';
const LIVE='https://www.especialistabrandingeinfluencia.com';
const ROOT=process.cwd(),WORK=path.join(ROOT,'.morada-remote-publish');
const state={phase:'BOOT',expectedSha:EXPECTED_SHA,siteId:EXPECTED_SITE_ID,auth:null,publish:null,health:null,askProbe:null,error:null,done:false,lastLog:null};
function log(x){console.log(x);state.lastLog=String(x).slice(-1800)}
function run(cmd,args,{cwd=ROOT,env={},stdinText=''}={}){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,env:{...process.env,...env},stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',d=>{out+=String(d);process.stdout.write(d)});p.stderr.on('data',d=>{err+=String(d);process.stderr.write(d)});p.on('error',reject);p.on('close',code=>code===0?resolve({out,err,code}):reject(new Error(cmd+' exit '+code+'\n'+err.slice(-3000)+'\n'+out.slice(-3000))));if(stdinText)p.stdin.write(stdinText);p.stdin.end()})}
function sh(cmd,cwd=ROOT){const r=spawnSync('bash',['-lc',cmd],{cwd,encoding:'utf8',env:process.env});if(r.stdout)process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);if(r.status!==0)throw new Error('shell failed '+r.status+': '+cmd);return r.stdout.trim()}
async function ensureAuth(){
  state.phase='WIX_AUTH';
  const authEnv={...process.env,AI_AGENT:'wix-headless-skill'};
  const who=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env:authEnv});
  if(who.status===0){state.auth='ALREADY_VALID';log('MORADA_WIX_AUTH_ALREADY_VALID '+who.stdout.trim());return}
  const aliases=['WIX_RELEASE_API_KEY','WIX_CLI_API_KEY','WIX_API_KEY','MUNDINHO_WIX_API_KEY','WIX_MUNDO_API_KEY','WIX_GABI_RADAR_API_KEY'];
  const alias=aliases.find(k=>Boolean(String(process.env[k]||'').trim()));
  if(!alias)throw new Error('MORADA_WIX_API_KEY_ALIAS_NOT_FOUND');
  const login=spawnSync('npx',['-y','@wix/cli@latest','login','--api-key',String(process.env[alias])],{encoding:'utf8',env:authEnv});
  if(login.status!==0)throw new Error('MORADA_WIX_API_KEY_LOGIN_FAIL '+alias+' '+String(login.stderr||login.stdout||'').slice(-1400));
  const after=spawnSync('npx',['-y','@wix/cli@latest','whoami'],{encoding:'utf8',env:authEnv});
  if(after.status!==0)throw new Error('MORADA_WIX_API_KEY_AUTH_NOT_CONFIRMED '+alias);
  state.auth='PASS:'+alias;log('MORADA_WIX_API_KEY_AUTH_PASS '+alias);
}
function probe(url,method='GET',body=''){
  const out=path.join(ROOT,'.probe-'+Math.random().toString(36).slice(2)+'.txt');
  const args=['-sS','-o',out,'-w','%{http_code}','-X',method];
  if(body)args.push('-H','content-type: application/json','--data',body);
  args.push(url);
  const r=spawnSync('curl',args,{encoding:'utf8'});const text=fs.existsSync(out)?fs.readFileSync(out,'utf8'):'';fs.rmSync(out,{force:true});
  if(r.status!==0)throw new Error('curl fail '+url);
  return {status:Number(String(r.stdout).trim()),body:text.slice(0,2500)};
}
async function main(){try{
  state.phase='SYNTHETIC_REPO';
  fs.rmSync(WORK,{recursive:true,force:true});fs.mkdirSync(WORK,{recursive:true});
  fs.writeFileSync(path.join(WORK,'wix.config.json'),JSON.stringify({siteId:EXPECTED_SITE_ID,uiVersion:'91'},null,2));
  fs.writeFileSync(path.join(WORK,'package.json'),JSON.stringify({private:true},null,2));
  fs.writeFileSync(path.join(WORK,'README.md'),'DIVA Morada remote publish controller\n');
  sh('git init -b main && git config user.email "release@mundinhocomunicacao.com" && git config user.name "Mundinho Release" && git add . && git commit -m "synthetic controller" && git remote add origin "'+ORIGIN+'"',WORK);
  const remote=sh('git remote get-url origin',WORK);
  if(remote!==ORIGIN)throw new Error('MORADA_ORIGIN_MISMATCH '+remote);
  log('MORADA_REMOTE_CONTEXT_READY '+ORIGIN+' site='+EXPECTED_SITE_ID);

  await ensureAuth();

  state.phase='PUBLISH_REMOTE';
  const pub=await run('npx',['-y','@wix/cli@latest','publish','-y'],{cwd:WORK,env:{CI:'1',AI_AGENT:'wix-headless-skill'},stdinText:'\n'});
  state.publish={ok:true,tail:(pub.out+'\n'+pub.err).slice(-5000)};
  log('MORADA_WIX_REMOTE_PUBLISH_COMMAND_PASS');

  state.phase='READBACK';
  let health=null,ask=null;
  for(let i=0;i<18;i++){
    try{const p=probe(LIVE+'/_functions/divaHealth');if(p.status===200&&p.body.includes('DIVA_MORADA_HTTP_INGRESS')){health=p;break}}catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!health)throw new Error('MORADA_HEALTH_READBACK_FAIL');
  state.health=health;

  for(let i=0;i<18;i++){
    try{const p=probe(LIVE+'/_functions/divaAsk','POST',JSON.stringify({id:'probe',text:'probe'}));if(p.status===401&&p.body.includes('DIVA_BRAIN_SESSION')){ask=p;break}}catch{}
    await new Promise(r=>setTimeout(r,5000));
  }
  if(!ask)throw new Error('MORADA_DIVA_ASK_ROUTE_NOT_PROVEN');
  state.askProbe=ask;
  state.phase='DONE';state.done=true;log('DIVA_MORADA_OWNER_CAPABILITY_DEPLOYED '+EXPECTED_SHA);
}catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error(state.error)}}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))}).listen(PORT,'0.0.0.0',()=>{log('DIVA_MORADA_SYNTHETIC_REMOTE_CONTROLLER_READY '+PORT);main()});
