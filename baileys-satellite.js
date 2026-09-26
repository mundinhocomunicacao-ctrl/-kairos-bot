import http from "node:http";
import crypto from "node:crypto";
import QRCode from "qrcode";
import makeWASocket,{DisconnectReason,fetchLatestBaileysVersion,BufferJSON,initAuthCreds,proto} from "@whiskeysockets/baileys";

const PORT=Number(process.env.PORT||10000);
const GROUP_JID=process.env.DIVA_WHATSAPP_GROUP_JID||"120363411404153606@g.us";
const DIVA_RELAY_URL=process.env.DIVA_RELAY_URL||"";
const DIVA_LOCAL_RELAY_SECRET=process.env.DIVA_LOCAL_RELAY_SECRET||"";
const DIVA_GATEWAY_INSTALLATION_ID=process.env.DIVA_GATEWAY_INSTALLATION_ID||"fernando-whatsapp";
const DIVA_GATEWAY_VERSION="diva-universal-private-gateway-v0.1";
const DIVA_LOCAL_RELAY_PATH="/diva/local-relay";
const DIVA_AUTH_VAULT_URL=process.env.DIVA_AUTH_VAULT_URL||"";
const DIVA_AUTH_VAULT_SECRET=process.env.DIVA_AUTH_VAULT_SECRET||"";
const DIVA_AUTH_INSTANCE=process.env.DIVA_AUTH_INSTANCE||"diva-whatsapp-main";
let sock=null,qrDataUrl=null,connection="booting",lastError=null;

const wake=s=>/^\s*(?:@?diva)\b[\s,:;!?-]*/i.test(String(s||""));
const textOf=m=>m?.message?.conversation||m?.message?.extendedTextMessage?.text||m?.message?.imageMessage?.caption||m?.message?.videoMessage?.caption||"";
const stableStringify=value=>Array.isArray(value)?"["+value.map(stableStringify).join(",")+"]":value&&typeof value==="object"?"{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+stableStringify(value[k])).join(",")+"}":JSON.stringify(value);
const sha256Hex=value=>crypto.createHash("sha256").update(String(value||"")).digest("hex");

function vaultKey(){
 if(!DIVA_AUTH_VAULT_SECRET)throw new Error("DIVA_AUTH_VAULT_SECRET is not configured");
 return crypto.createHash("sha256").update(DIVA_AUTH_VAULT_SECRET+"\ndiva-baileys-auth-v1").digest();
}
function encryptValue(value){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",vaultKey(),iv);
 const plain=Buffer.from(JSON.stringify(value,BufferJSON.replacer));
 const ciphertext=Buffer.concat([cipher.update(plain),cipher.final()]);
 return{ciphertext:ciphertext.toString("base64"),iv:iv.toString("base64"),auth_tag:cipher.getAuthTag().toString("base64")};
}
function decryptValue(record){
 const decipher=crypto.createDecipheriv("aes-256-gcm",vaultKey(),Buffer.from(record.iv,"base64"));
 decipher.setAuthTag(Buffer.from(record.auth_tag,"base64"));
 const plain=Buffer.concat([decipher.update(Buffer.from(record.ciphertext,"base64")),decipher.final()]).toString("utf8");
 return JSON.parse(plain,BufferJSON.reviver);
}
async function vault(body){
 if(!DIVA_AUTH_VAULT_URL||!DIVA_AUTH_VAULT_SECRET)throw new Error("DIVA auth vault is not configured");
 const res=await fetch(DIVA_AUTH_VAULT_URL,{method:"POST",headers:{"content-type":"application/json","x-diva-vault-secret":DIVA_AUTH_VAULT_SECRET},body:JSON.stringify({instance_key:DIVA_AUTH_INSTANCE,...body})});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error("vault "+res.status+" "+String(data.error||"failed"));
 return data;
}
async function createVaultAuthState(){
 const initial=await vault({action:"get",record_keys:["creds"]});
 const credsRecord=initial.records?.find(r=>r.record_key==="creds");
 const creds=credsRecord?decryptValue(credsRecord):initAuthCreds();
 const saveCreds=async()=>{
   const enc=encryptValue(creds);
   await vault({action:"set",records:[{record_key:"creds",...enc}]});
 };
 const keys={
   get:async(type,ids)=>{
     const recordKeys=ids.map(id=>type+":"+id);
     const out=await vault({action:"get",record_keys:recordKeys});
     const byKey=new Map((out.records||[]).map(r=>[r.record_key,r]));
     const result={};
     for(const id of ids){
       const record=byKey.get(type+":"+id);
       if(!record)continue;
       let value=decryptValue(record);
       if(type==="app-state-sync-key"&&value)value=proto.Message.AppStateSyncKeyData.fromObject(value);
       result[id]=value;
     }
     return result;
   },
   set:async(data)=>{
     const records=[],delete_keys=[];
     for(const [type,entries] of Object.entries(data||{})){
       for(const [id,value] of Object.entries(entries||{})){
         const record_key=type+":"+id;
         if(value==null)delete_keys.push(record_key);
         else records.push({record_key,...encryptValue(value)});
       }
     }
     if(records.length||delete_keys.length)await vault({action:"set",records,delete_keys});
   }
 };
 return{state:{creds,keys},saveCreds};
}

async function relay(message,eventId){
 const timestamp=new Date().toISOString(),nonce=crypto.randomUUID();
 const body={surface_id:"whatsapp",conversation_ref:"whatsapp://"+GROUP_JID,message,event_id:eventId,native_adapter_metadata:{whatsapp_group_id:GROUP_JID}};
 const material=[DIVA_GATEWAY_VERSION,DIVA_GATEWAY_INSTALLATION_ID,timestamp,nonce,"POST",DIVA_LOCAL_RELAY_PATH,sha256Hex(stableStringify(body))].join("\n");
 const sig=crypto.createHmac("sha256",DIVA_LOCAL_RELAY_SECRET).update(material).digest("hex");
 const res=await fetch(new URL(DIVA_RELAY_URL),{method:"POST",headers:{"content-type":"application/json","x-diva-installation-id":DIVA_GATEWAY_INSTALLATION_ID,"x-diva-timestamp":timestamp,"x-diva-nonce":nonce,"x-diva-signature":sig,"x-diva-gateway-version":DIVA_GATEWAY_VERSION},body:JSON.stringify(body)});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error("relay "+res.status+" "+String(data.error||"failed"));
 return data;
}

async function connect(){
 const {state,saveCreds}=await createVaultAuthState();
 const {version}=await fetchLatestBaileysVersion();
 sock=makeWASocket({auth:state,version,printQRInTerminal:false,syncFullHistory:false,markOnlineOnConnect:false});
 sock.ev.on("creds.update",saveCreds);
 sock.ev.on("connection.update",async u=>{
   if(u.qr){qrDataUrl=await QRCode.toDataURL(u.qr);connection="pairing"}
   if(u.connection==="open"){qrDataUrl=null;connection="open";lastError=null}
   if(u.connection==="close"){
     connection="closed";
     const status=u.lastDisconnect?.error?.output?.statusCode;
     if(status!==DisconnectReason.loggedOut)setTimeout(connect,2500);
   }
 });
 sock.ev.on("messages.upsert",async({messages,type})=>{
   if(type!=="notify")return;
   for(const m of messages){
     if(m.key?.fromMe||m.key?.remoteJid!==GROUP_JID)continue;
     const text=textOf(m);
     if(!wake(text))continue;
     try{
       const out=await relay(text,m.key?.id||crypto.randomUUID());
       if(out?.answer)await sock.sendMessage(GROUP_JID,{text:String(out.answer)});
     }catch(e){lastError=String(e?.message||e).slice(0,300)}
   }
 });
}

const page=()=>`<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DIVA · WhatsApp</title><style>body{font-family:system-ui;background:#f4f1eb;color:#171717;padding:28px}.c{max-width:620px;margin:auto;background:#fff;border-radius:24px;padding:28px;box-shadow:0 10px 35px #0001}h1{font-family:Georgia,serif}img{width:min(360px,100%)}.ok{padding:8px 12px;border-radius:99px;background:#edf6ee;display:inline-block}</style><main class=c><span class=ok>Estado: ${connection}</span><h1>DIVA · WhatsApp</h1>${qrDataUrl?`<p>No WhatsApp: Configurações → Dispositivos conectados → Conectar dispositivo.</p><img src="${qrDataUrl}">`:`<p>${connection==="open"?"WhatsApp vinculado. DIVA está ouvindo o grupo.":"Preparando pareamento…"}</p>`}<p>Esta tela não exibe credenciais nem mensagens.</p></main></html>`;

http.createServer((req,res)=>{
 const u=new URL(req.url,"http://localhost");
 if(req.method==="GET"&&(u.pathname==="/"||u.pathname==="/pair")){res.writeHead(200,{"content-type":"text/html; charset=utf-8","cache-control":"no-store"});return res.end(page())}
 if(req.method==="GET"&&u.pathname==="/health"){res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});return res.end(JSON.stringify({ok:true,service:"diva-baileys-satellite",connection,groupConfigured:Boolean(GROUP_JID),relayConfigured:Boolean(DIVA_RELAY_URL&&DIVA_LOCAL_RELAY_SECRET),vaultConfigured:Boolean(DIVA_AUTH_VAULT_URL&&DIVA_AUTH_VAULT_SECRET),lastError}))}
 res.writeHead(404);res.end("not found");
}).listen(PORT,"0.0.0.0",()=>{console.log("DIVA_BAILEYS_SATELLITE_LISTENING",PORT);connect().catch(e=>{lastError=String(e?.message||e);connection="failed"})});
