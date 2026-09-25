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

const docsContract={base:"https://proxy.whatsscale.com",subscribe:"/v1/webhooks/subscribe",trigger:"group",filterId:"120363427121075030@g.us"};
assert.equal(docsContract.base,"https://proxy.whatsscale.com");
assert.equal(docsContract.subscribe,"/v1/webhooks/subscribe");
assert.equal(docsContract.trigger,"group");
assert.equal(docsContract.filterId,"120363427121075030@g.us");
console.log("WHATSCALE_DIRECT_SUBSCRIBE_CONTRACT_OK");

assert.match(source,/\/admin\/subscribe-diva/,"admin subscribe route must exist");
assert.match(source,/DIVA_SUBSCRIBE_TOKEN/,"admin subscribe route must be separately authenticated");
assert.match(source,/DIVA_WHATSAPP_WEBHOOK_URL/,"webhook target must be explicit");
assert.match(source,/\/v1\/webhooks\/subscribe/,"server must call WhatsScale subscribe endpoint");
assert.match(source,/trigger_type:\s*['"]group['"]/,"DIVA subscription must target the internal group");
assert.match(source,/filter_id:\s*DIVA_WHATSAPP_GROUP_JID/,"DIVA subscription must be scoped to one explicit group");
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
assert.match(source,/trigger_type\s*!==\s*['"]group['"]/,"Render webhook must ignore traffic outside the governed group trigger");
assert.match(source,/group_id[\s\S]{0,160}DIVA_WHATSAPP_GROUP_JID/,"Render webhook must compare inbound group id against the governed Comercial group");
assert.match(source,/unauthorized_group/,"Render webhook must reject non-allowlisted groups");
assert.match(source,/x-diva-bridge-signature/i,"Render must forward the raw event to Wix with an internal HMAC");
assert.match(source,/DIVA_INGRESS_URL/,"Render must forward to the governed Wix DIVA ingress");
console.log("DIVA_SELF_TERMINATING_WEBHOOK_CONTRACT_OK");

assert.match(source,/DIVA_STARTUP_CANARY/,"Render must support a non-delivery startup canary");
assert.match(source,/runDivaStartupCanary/,"Render must execute the canary through the real webhook path");
assert.match(source,/ignored_unauthorized_group/,"canary must require the Wix group allowlist to reject its synthetic group");
assert.match(source,/DIVA_WHATSAPP_CANARY_OK/,"successful canary must emit a secret-safe proof marker");
console.log("DIVA_WHATSAPP_STARTUP_CANARY_CONTRACT_OK");

assert.match(source,/verifyActiveWebhookSignature/,"provider HMAC verification must be a shared instance-local function");
assert.match(source,/forwardRawToDiva/,"Render→Wix forwarding must be a shared instance-local function");
assert.match(source,/DIVA_WHATSAPP_CANARY_FAILED/,"canary failures must be reported separately from subscription failures");
console.log("DIVA_CANARY_INSTANCE_LOCAL_FIX_CONTRACT_OK");

assert.match(source,/WHATSCALE_SEND_RECEIPT_SHAPE/,'send receipt shape must be observable without payload values');
assert.match(source,/topLevelKeys/,'receipt telemetry must expose top-level field names only');
assert.match(source,/nestedDataKeys/,'receipt telemetry must expose nested data field names only');
console.log('WHATSCALE_RECEIPT_SHAPE_OBSERVABILITY_CONTRACT_OK');

assert.match(source,/nestedUnderscoreDataKeys/,'receipt telemetry must expose _data field names without values');
assert.match(source,/upstream\?\.id/,'normalizer must support current top-level WhatsScale id');
console.log('WHATSCALE_MODERN_RECEIPT_CONTRACT_OK');


assert.match(source,/bridgeStats/,'bridge must keep secret-safe runtime counters');
assert.match(source,/providerWebhooksAccepted/,'health must distinguish real provider webhooks from internal canaries');
assert.match(source,/DIVA_WHATSAPP_INGRESS_ACCEPTED/,'real inbound webhook acceptance must emit a proof marker');
assert.match(source,/DIVA_WHATSAPP_WIX_RESULT/,'Render→Wix result must emit a proof marker');
assert.match(source,/DIVA_WHATSAPP_REPLY_SENT/,'Wix→Render→WhatsScale delivery must emit a proof marker');
console.log('DIVA_WHATSAPP_E2E_OBSERVABILITY_CONTRACT_OK');

assert.match(source,/\/admin\/canary-authorized/,'authorized DIVA canary route must exist');
assert.match(source,/runDivaAuthorizedCanary/,'authorized canary must use a dedicated function');
assert.match(source,/DIVA_REPLY_TOKEN/,'authorized canary must be protected by an existing backend-only bearer secret');
assert.match(source,/DIVA E2E OK/,'authorized canary must use a fixed non-user-controlled prompt');
assert.match(source,/DIVA_WHATSAPP_AUTHORIZED_CANARY_RESULT/,'authorized canary must emit a secret-safe proof marker');
console.log('DIVA_AUTHORIZED_CANARY_CONTRACT_OK');

assert.match(source,/DIVA_AUTHORIZED_CANARY_ON_START/,'authorized canary startup flag must exist');
assert.match(source,/DIVA_AUTHORIZED_CANARY_CHAT_ID/,'authorized canary target must come from backend environment');
assert.match(source,/divaAuthorizedCanaryOnStart/,'health must expose authorized canary enablement without the target');
assert.match(source,/runDivaAuthorizedCanary\(DIVA_AUTHORIZED_CANARY_CHAT_ID\)/,'startup must execute the authorized canary only with backend-configured target');
console.log('DIVA_AUTHORIZED_STARTUP_CANARY_CONTRACT_OK');


assert.match(source,/providerDiagnostics/,'health must expose secret-safe WhatsScale provider diagnostics');
assert.match(source,/authorizedTargetMatchesSessionSelf/,'provider diagnostics must compare authorized target to session self without exposing ids');
assert.match(source,/\/api\/sessions/,'provider diagnostics must inspect the connected WhatsScale session');
assert.match(source,/\/v1\/webhooks/,'provider diagnostics must inspect webhook subscription metadata');
assert.match(source,/\/deliveries\?limit=10/,'provider diagnostics must inspect recent provider delivery states');
console.log('DIVA_WHATSAPP_PROVIDER_DIAGNOSTICS_CONTRACT_OK');


assert.match(source,/sessionSelfLast4/,'provider diagnostics must expose only the last four digits of the connected session');
console.log('DIVA_WHATSAPP_SESSION_SUFFIX_CONTRACT_OK');


assert.match(source,/sessionCount/,'provider diagnostics must expose WhatsScale session count');
assert.match(source,/otherSessionSuffixes/,'provider diagnostics must expose only masked suffixes for alternate sessions');
console.log('DIVA_WHATSAPP_SESSION_INVENTORY_CONTRACT_OK');


assert.match(source,/DIVA_WHATSAPP_SESSION/,'DIVA may pin an explicit WhatsScale session');
assert.match(source,/activeDivaSession\s*=\s*DIVA_WHATSAPP_SESSION\s*\|\|\s*SESSION/,'DIVA must stay on its configured/base session instead of auto-switching');
assert.doesNotMatch(source,/function selectDivaSession/,'DIVA must not auto-select a different session');
assert.doesNotMatch(source,/cleanupStaleDivaSubscriptions/,'restart must never delete an existing webhook subscription automatically');
assert.match(source,/sendWhatsAppToChat\(chatId, text, activeDivaSession\)/,'DIVA replies must use the effective session');
console.log('DIVA_WHATSAPP_STABLE_SESSION_CONTRACT_OK');

assert.match(source,/DIVA_WHATSAPP_GROUP_JID/,'governed group id must come from backend environment');
assert.match(source,/120363427121075030@g\.us/,'Comercial Mundinho must be the fallback group target for this migration');
assert.match(source,/existing subscription.*preserved|existing_subscription_preserved/i,'duplicate subscribe must preserve the existing subscription instead of deleting it');
console.log('DIVA_WHATSAPP_COMERCIAL_GROUP_CONTRACT_OK');


assert.match(source,/DIVA_GATEWAY_URL/,'Render must know the live DIVA Universal Gateway URL');
assert.match(source,/DIVA_GATEWAY_INSTALLATION_ID/,'Render must use a per-installation Gateway identity');
assert.match(source,/DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP/,'Render must require the WhatsApp installation secret');
assert.match(source,/diva-universal-private-gateway-v0\.1/,'Render must sign with the canonical Gateway protocol version');
assert.match(source,/x-diva-installation-id/,'Render must send the Gateway installation id header');
assert.match(source,/x-diva-timestamp/,'Render must send a replay-guard timestamp');
assert.match(source,/x-diva-nonce/,'Render must send a unique nonce');
assert.match(source,/x-diva-signature/,'Render must HMAC-sign the exact Gateway body');
assert.match(source,/\/api\/diva-gateway\/execute/,'Render must call the canonical execute operation');
assert.match(source,/invokeDivaGatewayDirect/,'group ingress must use the direct Gateway client');
assert.match(source,/conversation_ref/,'WhatsApp group continuity must be preserved');
assert.match(source,/sendWhatsAppToChat\(DIVA_WHATSAPP_GROUP_JID[\s\S]{0,120}activeDivaSession\)/,'Gateway answer must be sent back to Comercial Mundinho');
assert.match(source,/DIVA_WHATSAPP_GATEWAY_RESULT/,'direct Gateway execution must emit a secret-safe proof marker');
assert.match(source,/DIVA_WHATSAPP_GATEWAY_CANARY_OK/,'startup canary must prove Render to DIVA Gateway without depending on provider ingress');
console.log('DIVA_DIRECT_GATEWAY_CONTRACT_OK');

const startupBlock=source.slice(source.indexOf("server.listen("));
const startupCanaryIndex=startupBlock.indexOf("await runDivaGatewayCanary()");
const autoSubscribeIndex=startupBlock.indexOf("ensureDivaSubscription()");
assert.ok(startupCanaryIndex>=0&&autoSubscribeIndex>=0&&startupCanaryIndex<autoSubscribeIndex,'direct Gateway canary must run before provider subscription so HTTP 402 cannot hide Gateway health');
console.log('DIVA_GATEWAY_CANARY_BEFORE_PROVIDER_CONTRACT_OK');
