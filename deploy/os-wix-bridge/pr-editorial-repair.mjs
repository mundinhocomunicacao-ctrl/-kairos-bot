import fs from 'node:fs';
import path from 'node:path';
import {spawn,execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const PR_SITE_ID='24f64fb6-36d8-4463-a559-edd14f7a4cc4';
const PR_HOST='https://instant-rpvirnspwegq-mundinhocomunicaca-1412.wix-site-host.com';
const BRAIN_SCRIPT='https://www.especialistabrandingeinfluencia.com/_functions/prBridgeScript';
const WORK=path.join(ROOT,'.pr-editorial-live-project');
const ZIP=path.join(ROOT,'.pr-editorial-live-project.zip');

function sh(bin,args,cwd=ROOT,env={}){
  return String(execFileSync(bin,args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],env:{...process.env,...env}})||'').trim();
}
function run(bin,args,cwd=ROOT,env={}){
  return new Promise((resolve,reject)=>{
    const p=spawn(bin,args,{cwd,env:{...process.env,...env},stdio:['ignore','pipe','pipe']});
    p.stdout.on('data',d=>process.stdout.write(d));
    p.stderr.on('data',d=>process.stderr.write(d));
    p.on('error',reject);
    p.on('close',code=>code===0?resolve():reject(new Error(bin+' '+args.join(' ')+' exit '+code)));
  });
}
async function main(){
  console.log('PR_EDITORIAL_REPAIR_START '+PR_SITE_ID);
  fs.rmSync(WORK,{recursive:true,force:true});
  fs.rmSync(ZIP,{force:true});
  fs.mkdirSync(WORK,{recursive:true});

  const download='https://www.wix.com/_api/wixstro-deployments/v1/instant-sites/'+PR_SITE_ID+'/download.zip';
  await run('curl',['--fail','--silent','--show-error','--location','--retry','4','--retry-all-errors','--retry-delay','2',download,'-o',ZIP]);
  await run('unzip',['-q',ZIP,'-d',WORK]);

  const configPath=path.join(WORK,'wix.config.json');
  if(!fs.existsSync(configPath))throw new Error('PR_WIX_CONFIG_MISSING');
  const cfg=JSON.parse(fs.readFileSync(configPath,'utf8'));
  if(String(cfg?.siteId||'')!==PR_SITE_ID)throw new Error('PR_SITE_ID_MISMATCH:'+String(cfg?.siteId||''));

  const htmlFiles=[];
  const walk=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const p=path.join(dir,entry.name);
      if(entry.isDirectory())walk(p);
      else if(/\.html?$/i.test(entry.name))htmlFiles.push(p);
    }
  };
  walk(WORK);
  if(!htmlFiles.length)throw new Error('PR_HTML_MISSING');
  const index=htmlFiles.find(p=>path.basename(p).toLowerCase()==='index.html'&&path.dirname(p)===WORK)||htmlFiles[0];
  let html=fs.readFileSync(index,'utf8');
  const tag='<script src="'+BRAIN_SCRIPT+'" defer></script>';
  if(!html.includes(BRAIN_SCRIPT)){
    if(/<\/body>/i.test(html))html=html.replace(/<\/body>/i,tag+'\n</body>');
    else if(/<\/head>/i.test(html))html=html.replace(/<\/head>/i,tag+'\n</head>');
    else html+='\n'+tag+'\n';
    fs.writeFileSync(index,html,'utf8');
  }
  if(!fs.readFileSync(index,'utf8').includes(BRAIN_SCRIPT))throw new Error('PR_BRIDGE_INJECTION_FAIL');
  console.log('PR_BRIDGE_INJECTED '+path.relative(WORK,index));

  let authed=false;
  try{authed=Boolean(sh('npx',['-y','@wix/cli@latest','whoami'],WORK,{CI:'1',AI_AGENT:'wix-headless-skill'}));}catch{}
  if(!authed){
    for(const alias of ['WIX_OS_API_KEY','WIX_MUNDO_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY']){
      const value=String(process.env[alias]||'').trim();
      if(!value)continue;
      await run('npx',['-y','@wix/cli@latest','login','--api-key',value],WORK,{CI:'1',AI_AGENT:'wix-headless-skill'});
      console.log('PR_WIX_AUTH=PASS '+alias);
      authed=true;
      break;
    }
  }
  if(!authed)throw new Error('PR_WIX_AUTH_MISSING');

  await run('npx',['-y','@wix/cli@latest','release'],WORK,{CI:'1',AI_AGENT:'wix-headless-skill'});
  console.log('PR_RELEASE_DISPATCH=PASS '+PR_SITE_ID);

  let htmlReadback=false;
  for(let attempt=1;attempt<=30;attempt++){
    try{
      const response=await fetch(PR_HOST+'/?diva-pr-proof='+Date.now(),{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
      const body=await response.text();
      if(response.ok&&body.includes(BRAIN_SCRIPT)){htmlReadback=true;break;}
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,4000));
  }
  if(!htmlReadback)throw new Error('PR_BRIDGE_HTML_READBACK_FAIL');

  const brain=await fetch(BRAIN_SCRIPT,{headers:{'cache-control':'no-cache'},signal:AbortSignal.timeout(15000)});
  const brainBody=await brain.text();
  if(!brain.ok||!brainBody.includes('DIVA_PR_CLIENT_SAFE_BRIDGE_V1'))throw new Error('PR_BRAIN_SCRIPT_READBACK_FAIL');

  console.log('PR_EDITORIAL_BRIDGE_LIVE_VERIFIED '+JSON.stringify({
    siteId:PR_SITE_ID,
    host:PR_HOST,
    contract:'DIVA_PR_CLIENT_SAFE_BRIDGE_V1'
  }));
}
main().catch(error=>{
  console.error('PR_EDITORIAL_REPAIR_BLOCKED '+String(error?.stack||error));
  process.exit(1);
});
