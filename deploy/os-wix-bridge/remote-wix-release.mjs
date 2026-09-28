import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const PORT=Number(process.env.PORT||10000);
const SOURCE_SHA='9bc0a248b1d2f830cfda7bf6e92998b353ec29c7';
const ROOT=process.cwd();
const OS_DIR=path.join(ROOT,'os');
const ENTRY=path.join(OS_DIR,'dist/wix-server/entry.mjs');
const ARCHIVE=path.join(ROOT,'os-9bc0a248-artifact.tar.gz');

function prepareArtifact(){
  const marker=fs.readFileSync(path.join(OS_DIR,'.release-source/canonical-sha.txt'),'utf8').trim();
  if(marker!==SOURCE_SHA)throw new Error('ARTIFACT_SOURCE_MARKER_MISMATCH '+marker);
  const entry=fs.readFileSync(ENTRY,'utf8');
  if(!entry.includes('MUNDO_RUNTIME_SOURCE_SHA:'+JSON.stringify(SOURCE_SHA)))throw new Error('ARTIFACT_RUNTIME_SHA_MISMATCH');
  execFileSync('tar',['-czf',ARCHIVE,'-C',OS_DIR,'dist'],{stdio:'inherit'});
  return Object.freeze({phase:'ARTIFACT_BRIDGE_READY',done:true,released:false,sourceSha:SOURCE_SHA,reason:'Safe transport only; release controller runs separately.'});
}
let state;
try{state=prepareArtifact();console.log('OS_ARTIFACT_BRIDGE_READY '+SOURCE_SHA)}
catch(error){state=Object.freeze({phase:'ARTIFACT_BRIDGE_ERROR',done:true,released:false,sourceSha:SOURCE_SHA,error:String(error?.stack||error)});console.error(state.error)}

http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost');
  if(u.pathname==='/artifact'&&state.phase==='ARTIFACT_BRIDGE_READY'){
    res.setHeader('content-type','application/gzip');
    return fs.createReadStream(ARCHIVE).pipe(res);
  }
  res.setHeader('content-type','application/json');
  if(u.pathname==='/manifest')return res.end(JSON.stringify(state));
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>console.log('OS_FINAL_ARTIFACT_TRANSPORT_ONLY'));
