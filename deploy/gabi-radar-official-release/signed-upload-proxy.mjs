import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT=Number(process.env.PORT||10000);
const ROOT=process.cwd();
const INDEX=path.join(ROOT,'deploy','gabi-radar-official-release','site','index.html');
const uploadUrl=String(process.env.WIX_SIGNED_UPLOAD_URL||'').trim();
const expectedHash=String(process.env.WIX_EXPECTED_STATIC_HASH||'').trim();
const expectedSize=Number(process.env.WIX_EXPECTED_STATIC_SIZE||0);
const state={phase:'BOOT',hash:null,size:null,status:null,done:false,error:null};

function log(s){console.log(String(s))}
async function main(){
  try{
    if(!uploadUrl) throw new Error('SIGNED_UPLOAD_URL_MISSING');
    const buf=fs.readFileSync(INDEX);
    const hash=crypto.createHash('sha256').update(buf).digest('hex');
    state.hash=hash;state.size=buf.length;
    if(expectedHash&&hash!==expectedHash) throw new Error('STATIC_HASH_MISMATCH');
    if(expectedSize&&buf.length!==expectedSize) throw new Error('STATIC_SIZE_MISMATCH');
    state.phase='PUT_STATIC';
    const res=await fetch(uploadUrl,{method:'PUT',headers:{'Content-Type':'text/html'},body:buf});
    state.status=res.status;
    if(!res.ok) throw new Error('SIGNED_PUT_FAILED_'+res.status+'_'+(await res.text()).slice(0,300));
    state.phase='DONE';state.done=true;
    log('GABI_SIGNED_STATIC_UPLOAD_PASS '+JSON.stringify({hash,size:buf.length,status:res.status}));
  }catch(e){
    state.phase='ERROR';state.error=String(e?.stack||e);
    console.error('GABI_SIGNED_STATIC_UPLOAD_FAIL '+state.error);
  }
}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state));})
.listen(PORT,'0.0.0.0',()=>{log('GABI_SIGNED_UPLOAD_PROXY_READY');main()});
