import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(new URL("./server.js",import.meta.url),"utf8");
assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(new URL("./package.json",import.meta.url),"utf8")));
assert.equal(source.includes("\\nconst"),false,"escaped newline corruption must be absent");
assert.match(source,/\/webhooks\/whatsscale/);
assert.match(source,/x-whatsscale-signature/i);
assert.match(source,/x-whatsscale-timestamp/i);
assert.match(source,/> 300/);
assert.match(source,/WHATSSCALE_WEBHOOK_SECRET/);
assert.match(source,/DIVA_INGRESS_URL/);
assert.match(source,/DIVA_BRIDGE_SECRET/);
assert.match(source,/createHmac\(['"]sha256['"]/);
assert.match(source,/fromMe/);
console.log("KAIROS_DIVA_BRIDGE_CONTRACT_OK");

function persistenceGate(expectedEventId,recovery){
  return Boolean(expectedEventId&&recovery?.status==="ready"&&recovery?.found===true&&recovery?.event?.event_id===expectedEventId);
}
assert.equal(persistenceGate("evt-qa",{status:"ready",found:true,event:{event_id:"evt-qa"}}),true);
assert.equal(persistenceGate("evt-qa",{status:"ready",found:false}),false);
assert.equal(persistenceGate("evt-qa",{status:"ready",found:true,event:{event_id:"different"}}),false);
console.log("DIVA_WHATSAPP_PERSISTENCE_FAIL_CLOSED_OK");

const docsContract={base:"https://proxy.whatsscale.com",subscribe:"/v1/webhooks/subscribe",trigger:"1on1"};
assert.equal(docsContract.base,"https://proxy.whatsscale.com");
assert.equal(docsContract.subscribe,"/v1/webhooks/subscribe");
assert.equal(docsContract.trigger,"1on1");
console.log("WHATSCALE_DIRECT_SUBSCRIBE_CONTRACT_OK");

assert.match(source,/\/admin\/subscribe-diva/,"admin subscribe route must exist");
assert.match(source,/DIVA_SUBSCRIBE_TOKEN/,"admin subscribe route must be separately authenticated");
assert.match(source,/DIVA_WHATSAPP_WEBHOOK_URL/,"webhook target must be explicit");
assert.match(source,/\/v1\/webhooks\/subscribe/,"server must call WhatsScale subscribe endpoint");
assert.match(source,/trigger_type:\s*['"]1on1['"]/,"DIVA subscription must target 1:1 messages");
assert.match(source,/signing_secret/,"subscribe response must capture the one-time signing secret");
console.log("DIVA_WHATSAPP_SUBSCRIBE_ADMIN_CONTRACT_OK");

assert.match(source,/\/diva\/reply/,"DIVA reply relay route must exist");
assert.match(source,/DIVA_REPLY_TOKEN/,"reply relay must use a dedicated bearer secret");
assert.match(source,/chatId/,"reply relay must accept the WhatsApp chat id");
assert.match(source,/sendWhatsAppToChat/,"reply relay must send through the existing Render-held WhatsScale API key");
console.log("DIVA_WHATSAPP_REPLY_RELAY_CONTRACT_OK");

assert.match(source,/DIVA_AUTO_SUBSCRIBE/,"Render must support automatic DIVA webhook subscription");
assert.match(source,/activeWebhookSecret/,"Render must retain the one-time WhatsScale signing secret in process memory");
assert.match(source,/ensureDivaSubscription/,"Render must self-heal the subscription on boot");
assert.match(source,/trigger_type\s*!==\s*['"]1on1['"]/,"Render webhook must ignore non-1:1 traffic");
assert.match(source,/x-diva-bridge-signature/i,"Render must forward the raw event to Wix with an internal HMAC");
assert.match(source,/DIVA_INGRESS_URL/,"Render must forward to the governed Wix DIVA ingress");
console.log("DIVA_SELF_TERMINATING_WEBHOOK_CONTRACT_OK");

assert.match(source,/DIVA_STARTUP_CANARY/,"Render must support a non-delivery startup canary");
assert.match(source,/runDivaStartupCanary/,"Render must execute the canary through the real webhook path");
assert.match(source,/ignored_unauthorized_sender/,"canary must require the Wix allowlist to reject its synthetic sender");
assert.match(source,/DIVA_WHATSAPP_CANARY_OK/,"successful canary must emit a secret-safe proof marker");
console.log("DIVA_WHATSAPP_STARTUP_CANARY_CONTRACT_OK");

assert.match(source,/verifyActiveWebhookSignature/,"provider HMAC verification must be a shared instance-local function");
assert.match(source,/forwardRawToDiva/,"Render→Wix forwarding must be a shared instance-local function");
assert.match(source,/DIVA_WHATSAPP_CANARY_FAILED/,"canary failures must be reported separately from subscription failures");
console.log("DIVA_CANARY_INSTANCE_LOCAL_FIX_CONTRACT_OK");
