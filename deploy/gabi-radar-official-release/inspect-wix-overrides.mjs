import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const state={done:false,error:null,excerpts:[]};
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
  const files=walk(root);
  const needles=['updateManifestWithBackendWorker','createComponentsOverride','modifiedComponents','backendWorker'];
  for(const file of files){
    const content=fs.readFileSync(file,'utf8');
    for(const needle of needles){
      let p=content.indexOf(needle);
      if(p>=0){
        const excerpt=content.slice(Math.max(0,p-7000),Math.min(content.length,p+15000));
        state.excerpts.push({file,needle,excerpt});
        log('WIX_SOURCE_MATCH '+needle+' '+file);
      }
    }
  }
  state.done=true;
}catch(e){state.error=String(e?.stack||e);console.error(state.error)}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state));}).listen(PORT,'0.0.0.0',()=>log('WIX_OVERRIDE_INSPECTOR_READY'));
