import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const state={done:false,error:null,matches:[]};
function log(s){console.log(String(s))}
function walk(p,out=[]){
  for(const ent of fs.readdirSync(p,{withFileTypes:true})){
    const full=path.join(p,ent.name);
    if(ent.isDirectory()) walk(full,out);
    else if(ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}
try{
  const dir=path.join(os.tmpdir(),'wix-cli-inspect');
  fs.rmSync(dir,{recursive:true,force:true});
  const n=spawnSync('npm',['install','--prefix',dir,'@wix/cli@latest','--no-audit','--no-fund'],{encoding:'utf8',timeout:180000});
  if(n.status!==0) throw new Error('npm install failed '+n.stderr);
  const root=path.join(dir,'node_modules','@wix','cli');
  for(const file of walk(root)){
    const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);
    for(let i=0;i<lines.length;i++){
      const line=lines[i];
      const hit=
        /BACKEND_WORKER/.test(line) ||
        /createComponentsOverride/.test(line) ||
        /modifiedComponents/.test(line) ||
        /CreateComponentsOverride/.test(line);
      if(!hit) continue;
      const a=Math.max(0,i-12), b=Math.min(lines.length,i+22);
      const excerpt=lines.slice(a,b).map((x,j)=>String(a+j+1).padStart(5,' ')+' '+x).join(' ↵ ');
      state.matches.push({file:path.basename(file),line:i+1,excerpt});
      log('WIX_FOCUSED_MATCH '+path.basename(file)+':'+(i+1)+' '+excerpt);
    }
  }
  state.done=true;
}catch(e){state.error=String(e?.stack||e);console.error(state.error)}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state));})
.listen(PORT,'0.0.0.0',()=>log('WIX_FOCUSED_INSPECTOR_READY'));
