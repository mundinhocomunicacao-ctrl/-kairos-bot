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

const docsContract={base:"https://proxy.whatsscale.com",subscribe:"/v1/webhooks/subscribe",trigger:"group"};
assert.equal(docsContract.base,"https://proxy.whatsscale.com");
assert.equal(docsContract.subscribe,"/v1/webhooks/subscribe");
assert.equal(docsContract.trigger,"group");
console.log("WHATSCALE_DIRECT_SUBSCRIBE_CONTRACT_OK");

assert.match(source,/function\s+divaReplyReceiptUrl\s*\(/);
assert.match(source,/diva-whatsapp-reply-receipt/);
assert.match(source,/alreadyDispatched/);
assert.match(source,/alreadyReserved/);
assert.match(source,/replyOnlyToOrigin/);
assert.match(source,/recipient\s*!==\s*GROUP_JID/);
assert.match(source,/sendWhatsApp\(reply\.text\)/);
assert.match(source,/source_event_id/);
assert.match(source,/provider_message_id/);
assert.match(source,/request_id/);
assert.match(source,/trace_id/);
assert.match(source,/persisted\s*!==\s*true/);
console.log("DIVA_WHATSAPP_ROUNDTRIP_CONTRACT_OK");

const relayRequirements=[
  'DIVA_1ON1_RELAY_ENABLED',
  'DIVA_RELAY_URL',
  'DIVA_RELAY_SECRET',
  'DIVA_WHATSAPP_ALLOWED_NUMBERS',
  '/webhooks/diva-1on1',
  '/v1/webhooks',
  '/v1/webhooks/subscribe',
  'signing_secret',
  'x-diva-whatsapp-relay-signature',
  'x-diva-whatsapp-relay-timestamp'
];
for(const requirement of relayRequirements){
  assert.ok(source.includes(requirement),`missing 1:1 relay contract: ${requirement}`);
}
assert.ok(source.includes("trigger_type:'1on1'")||source.includes("trigger_type: '1on1'"),'WhatsScale subscription must be 1on1');
assert.ok(source.includes('sendWhatsApp(reply.text, reply.recipient)'),'reply must return to the exact origin contact');
assert.equal(source.includes('/api/diva-whatsapp-ingress'),false,'legacy phantom ingress must be removed');
assert.equal(source.includes('/api/diva-whatsapp-reply-receipt'),false,'legacy phantom receipt route must be removed');
console.log('DIVA_WHATSAPP_1ON1_RELAY_CONTRACT_OK');
