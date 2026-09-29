const path=require('node:path');
const {spawn}=require('node:child_process');
const http=require('node:http');
if(process.env.PART1_RUNTIME_HOOK!=='1'||process.argv.length!==1) return;
const port=String(process.env.PORT||10000);
const childEnv={...process.env,NODE_OPTIONS:'',PART1_RUNTIME_HOOK:'0'};
const child=spawn('npm',['run','start:vinext','--','--port',port,'--ip','0.0.0.0'],{
  cwd:path.join(process.cwd(),'os'),
  env:childEnv,
  stdio:'inherit'
});
http.createServer=()=>({listen(){return this;}});
child.on('exit',(code)=>process.exit(code==null?1:code));
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig);}catch{}});
