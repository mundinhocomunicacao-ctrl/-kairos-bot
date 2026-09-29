import {cp, rm, rename, readFile, writeFile} from 'node:fs/promises';
import {glob} from 'node:fs/promises';
import {DIVA_GATEWAY_SECRET_ENV_KEYS} from '../data/diva-gateway-installation-registry.js';

const source='dist/mundinho_os';
const target='dist/wix-server';
await rm(target,{recursive:true,force:true});
await cp(source,target,{recursive:true});
const js=[];
for await (const p of glob(`${target}/**/*.js`)) js.push(p);
for(const p of js) await rename(p,p.slice(0,-3)+'.mjs');
for await (const p of glob(`${target}/**/*.mjs`)) {
  let s=await readFile(p,'utf8');
  s=s.replace(/(["'`])(\.{1,2}\/[^"'`]+)\.js\1/g,'$1$2.mjs$1');
  await writeFile(p,s);
}
await writeFile(`${target}/index.mjs`,await readFile(`${target}/index.mjs`,'utf8'));

const buildRequestedSha=String(process.env.MUNDO_RUNTIME_SOURCE_SHA||'').trim();
let canonicalSourceSha='';
try{canonicalSourceSha=String(await readFile('.release-source/canonical-sha.txt','utf8')).trim()}catch{}
if(!canonicalSourceSha)canonicalSourceSha=buildRequestedSha;
const runtimeEnv=String(process.env.MUNDO_RUNTIME_ENV||'wix-qa').trim();
const runtimeReleaseId=canonicalSourceSha?`${runtimeEnv}-${canonicalSourceSha.slice(0,8)}`:runtimeEnv;
const entry=`import worker from './index.mjs';
export default {async fetch(request,env,ctx){
  globalThis.process??={env:{}};
  globalThis.process.env??={};
  Object.assign(globalThis.process.env,{MUNDO_RUNTIME_SOURCE_SHA:${JSON.stringify(canonicalSourceSha)},MUNDO_BUILD_REQUESTED_SHA:${JSON.stringify(buildRequestedSha)},MUNDO_RUNTIME_ENV:${JSON.stringify(runtimeEnv)},MUNDO_RUNTIME_RELEASE_ID:${JSON.stringify(runtimeReleaseId)}});
  const gatewaySecretKeys=["DIVA_GATEWAY_SECRET_FERNANDO_CHATGPT","DIVA_GATEWAY_SECRET_FERNANDO_GEMINI","DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP","DIVA_GATEWAY_SECRET_FERNANDO_SLACK","DIVA_GATEWAY_SECRET_FERNANDO_WIX","DIVA_GATEWAY_SECRET_FERNANDO_API","DIVA_GATEWAY_SECRET_JOHNNY_CHATGPT","DIVA_GATEWAY_SECRET_JOHNNY_GEMINI","DIVA_GATEWAY_SECRET_JOHNNY_WHATSAPP","DIVA_GATEWAY_SECRET_JOHNNY_SLACK","DIVA_GATEWAY_SECRET_JOHNNY_WIX","DIVA_GATEWAY_SECRET_JOHNNY_API","DIVA_GATEWAY_SECRET_VITORIA_CHATGPT","DIVA_GATEWAY_SECRET_VITORIA_GEMINI","DIVA_GATEWAY_SECRET_VITORIA_WHATSAPP","DIVA_GATEWAY_SECRET_VITORIA_SLACK","DIVA_GATEWAY_SECRET_VITORIA_WIX","DIVA_GATEWAY_SECRET_VITORIA_API"];
  for(const key of ['MUNDINHO_SESSION_SECRET','DIVA_MCP_OAUTH_SECRET','DIVA_WRITEBACK_SECRET','DIVA_GENERATIVE_BRIDGE_ENDPOINT','WIX_CLIENT_ID','WIX_CLIENT_INSTANCE_ID','WIX_CLIENT_PUBLIC_KEY','WIX_CLIENT_SECRET','WIX_CLOUD_PROVIDER','WHATSSCALE_API_KEY','WHATSSCALE_SESSION','WHATSSCALE_WEBHOOK_SIGNING_SECRET','DIVA_WHATSAPP_ALLOWED_NUMBERS','DIVA_WHATSAPP_ALLOWED_GROUPS','DIVA_WHATSAPP_REPLY_URL','DIVA_WHATSAPP_REPLY_SECRET','DIVA_WHATSAPP_INGRESS_SECRET','DIVA_WHATSAPP_INSTALLATION_MAP_JSON','DIVA_WHATSAPP_DEFAULT_INSTALLATION_ID','DIVA_SLACK_SIGNING_SECRET','DIVA_SLACK_BOT_TOKEN','DIVA_SLACK_INSTALLATION_MAP_JSON','DIVA_SLACK_DEFAULT_INSTALLATION_ID','DIVA_GATEWAY_REGISTRY_JSON',...gatewaySecretKeys]){
    if(env?.[key]!=null && String(env[key]).trim()) globalThis.process.env[key]=String(env[key]);
  }
  return worker.fetch(request,env??{},ctx);
}};
`;
await writeFile(`${target}/entry.mjs`,entry);
await import('./qa-wix-static-assets.mjs');
