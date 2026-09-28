import http from 'node:http';
const PORT=Number(process.env.PORT||10000);
const state=Object.freeze({phase:'DISABLED_FOR_OS_RELEASE_ISOLATION',done:true,released:false,reason:'Gabi automatic release controller neutralized while OS exact-SHA release uses the shared forge branch.'});
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state,null,2))})
.listen(PORT,'0.0.0.0',()=>console.log('GABI_RELEASE_CONTROLLER_SAFE_NOOP'));
