import http from "node:http";
import crypto from "node:crypto";
import QRCode from "qrcode";
import makeWASocket,{DisconnectReason,useMultiFileAuthState,fetchLatestBaileysVersion} from "@whiskeysockets/baileys";

const PORT=Number(process.env.PORT||10000);
const AUTH_DIR=process.env.BAILEYS_AUTH_DIR||"./baileys-auth";
const GROUP_JID=process.env.DIVA_WHATSAPP_GROUP_JID||"120363411404153606@g.us";
const DIVA_RELAY_URL=process.env.DIVA_RELAY_URL||"";
const DIVA_LOCAL_RELAY_SECRET=process.env.DIVA_LOCAL_RELAY_SECRET||"";
let sock=null, qrDataUrl=null, connection="booting", lastError=null;

const wake=s=>/^\s*(?:@?diva)\b[\s,:;!?-]*/i.test(String(s||""));
const textOf=m=>m?.message?.conversation||m?.message?.extendedTextMessage?.text||m?.message?.imageMessage?.caption||m?.message?.videoMessage?.caption||"";
const safe=(a,b)=>{const A=Buffer.from(a),B=Buffer.from(b);return A.length===B.length&&crypto.timingSafeEqual(A,B)};

async function relay(message,eventId){
 const ts=String(Math.floor(Date.now()/1000)),nonce=crypto.randomUUID();
 const body={surface_id:"whatsapp",conversation_ref:"whatsapp://"+GROUP_JID,message,event_id:eventId,native_adapter_metadata:{whatsapp_group_id:GROUP_JID}};
 const raw=JSON.stringify(body);
 const material=["diva-local-relay-v0.1",ts,nonce,raw].join("\n");
 const sig=crypto.createHmac("sha256",DIVA_LOCAL_RELAY_SECRET).update(material).digest("hex");
 const u=new URL(DIVA_RELAY_URL);
 const res=await fetch(u,{method:"POST",headers:{"content-type":"application/json","x-diva-local-timestamp":ts,"x-diva-local-nonce":nonce,"x-diva-local-signature":"sha256="+sig},body:raw});
 const data=await res.json().catch(()=>({}));
 if(!res.ok)throw new Error("relay "+res.status+" "+String(data.error||"failed"));
 return data;
}

async function connect(){
 const {state,saveCreds}=await useMultiFileAuthState(AUTH_DIR);
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
 sock.ev.on("messages.upsert",async ({messages,type})=>{
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
 if(req.method==="GET"&&u.pathname==="/health"){res.writeHead(200,{"content-type":"application/json","cache-control":"no-store"});return res.end(JSON.stringify({ok:true,service:"diva-baileys-satellite",connection,groupConfigured:Boolean(GROUP_JID),relayConfigured:Boolean(DIVA_RELAY_URL&&DIVA_LOCAL_RELAY_SECRET),lastError}))}
 res.writeHead(404);res.end("not found");
}).listen(PORT,"0.0.0.0",()=>{console.log("DIVA_BAILEYS_SATELLITE_LISTENING",PORT);connect().catch(e=>{lastError=String(e?.message||e);connection="failed"})});
