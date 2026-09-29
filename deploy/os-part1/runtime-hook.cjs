const path=require('node:path');
const {spawn}=require('node:child_process');
const http=require('node:http');
if(process.env.PART1_RUNTIME_HOOK!=='1'||process.argv.length!==1) return;
const root=process.cwd();
const port=String(process.env.PORT||10000);
const childEnv={...process.env,NODE_OPTIONS:'',PART1_RUNTIME_HOOK:'0'};
const wrangler=path.join(root,'os','node_modules','.bin','wrangler');
const config=path.join(root,'part1-runtime-bundle','server','wrangler.json');
const child=spawn(wrangler,['dev','--config',config,'--port',port,'--ip','0.0.0.0'],{
  cwd:root,
  env:childEnv,
  stdio:'inherit'
});
http.createServer=()=>({listen(){return this;}});
child.on('exit',(code)=>process.exit(code==null?1:code));
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig);}catch{}});
