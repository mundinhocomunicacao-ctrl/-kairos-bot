const {spawn}=require('node:child_process');
const http=require('node:http');
if(process.env.PART1_RUNTIME_HOOK!=='1'||process.argv.length!==1) return;

const root=process.cwd();
const port=Number(process.env.PORT||10000);
const childEnv={...process.env,NODE_OPTIONS:'',BASH_ENV:'',PART1_RUNTIME_HOOK:'0'};
const realCreate=http.createServer.bind(http);

const bootstrap=realCreate((req,res)=>{
  res.statusCode=503;
  res.setHeader('content-type','text/plain; charset=utf-8');
  res.end('MUNDINHO_OS_PART1_STARTING');
});
bootstrap.listen(port,'0.0.0.0',()=>console.log('PART1_BOOTSTRAP_PORT_READY='+port));

// Prevent the fixed Render probe start command from binding a second server.
http.createServer=()=>({listen(){return this;}});

const prep=[
  'set -euo pipefail',
  'git submodule sync --recursive',
  'git submodule update --init --recursive --force',
  'echo PART1_RUNTIME_OS_SHA=$(git -C os rev-parse HEAD)',
  'cd os',
  'npm run build:vinext'
].join(' && ');

const build=spawn('bash',['-lc',prep],{cwd:root,env:childEnv,stdio:'inherit'});
let app=null;

function terminate(sig){
  try{if(app) app.kill(sig);}catch{}
  try{build.kill(sig);}catch{}
  try{bootstrap.close();}catch{}
}

build.on('exit',(code)=>{
  if(code!==0){
    console.error('PART1_RUNTIME_BUILD_FAIL='+code);
    try{bootstrap.close();}catch{}
    process.exit(code==null?1:code);
    return;
  }
  console.log('PART1_RUNTIME_BUILD_PASS');
  bootstrap.close(()=>{
    app=spawn('./node_modules/.bin/wrangler',[
      'dev','--config','dist/server/wrangler.json',
      '--port',String(port),'--ip','0.0.0.0'
    ],{cwd:root+'/os',env:childEnv,stdio:'inherit'});
    app.on('exit',(appCode)=>process.exit(appCode==null?1:appCode));
  });
});

for(const sig of ['SIGTERM','SIGINT']) process.on(sig,()=>terminate(sig));
