const {spawn}=require('node:child_process');
const http=require('node:http');
if(process.env.PART1_RUNTIME_HOOK!=='1'||process.argv.length!==1) return;
const root=process.cwd();
const port=String(process.env.PORT||10000);
const childEnv={...process.env,NODE_OPTIONS:'',BASH_ENV:'',PART1_RUNTIME_HOOK:'0'};
const cmd=[
  'set -euo pipefail',
  'git submodule sync --recursive',
  'git submodule update --init --recursive --force',
  'echo PART1_RUNTIME_OS_SHA=$(git -C os rev-parse HEAD)',
  'cd os',
  'npm ci',
  'npm run build:vinext',
  'exec ./node_modules/.bin/wrangler dev --config dist/server/wrangler.json --port '+port+' --ip 0.0.0.0'
].join(' && ');
const child=spawn('bash',['-lc',cmd],{cwd:root,env:childEnv,stdio:'inherit'});
http.createServer=()=>({listen(){return this;}});
child.on('exit',(code)=>process.exit(code==null?1:code));
for(const sig of ['SIGTERM','SIGINT'])process.on(sig,()=>{try{child.kill(sig);}catch{}});
