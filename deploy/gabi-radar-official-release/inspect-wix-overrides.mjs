import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const state={done:false,error:null};
function log(s){console.log(String(s))}
try{
  const dir=path.join(os.tmpdir(),'wix-cli-inspect');
  fs.rmSync(dir,{recursive:true,force:true});
  const n=spawnSync('npm',['install','--prefix',dir,'@wix/cli@latest','--no-audit','--no-fund'],{encoding:'utf8',timeout:180000});
  if(n.status!==0) throw new Error('npm install failed '+n.stderr);
  const root=path.join(dir,'node_modules','@wix','cli');
  function findFile(p,name){
    for(const ent of fs.readdirSync(p,{withFileTypes:true})){
      const full=path.join(p,ent.name);
      if(ent.isDirectory()){const f=findFile(full,name);if(f)return f}
      else if(ent.name===name)return full;
    }
    return null;
  }
  const file=findFile(root,'chunk-D7ORRBCE.js');
  if(!file) throw new Error('chunk-D7ORRBCE.js missing under '+root);
  log('WIX_OVERRIDE_CHUNK '+file);
  const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
  const ranges=[[5188,5248],[2160,2185],[1380,1410],[1735,1785]];
  for(const [a,b] of ranges){
    log('WIX_OVERRIDE_SOURCE_RANGE '+a+'-'+b);
    for(let i=a;i<=b&&i<=lines.length;i++) log(String(i).padStart(5,' ')+' '+lines[i-1]);
  }
  state.done=true;
}catch(e){state.error=String(e?.stack||e);console.error(state.error)}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state));}).listen(PORT,'0.0.0.0',()=>log('WIX_OVERRIDE_INSPECTOR_READY'));
