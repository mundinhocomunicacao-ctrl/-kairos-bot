import assert from "node:assert/strict";
import fs from "node:fs";
const src=fs.readFileSync(new URL("./baileys-satellite.js",import.meta.url),"utf8");
for(const token of [
"makeWASocket","createVaultAuthState","BufferJSON","initAuthCreds","messages.upsert",
'type!=="notify"&&type!=="append"',"DIVA_INITIAL_BUFFER_FORCE_FLUSH","sock?.ev?.flush?.()",
"120363411404153606@g.us","fromMe","DIVA_RELAY_URL","DIVA_AUTH_VAULT_URL",
"DIVA_AUTH_VAULT_SECRET","aes-256-gcm","x-diva-vault-secret","x-diva-installation-id",
"x-diva-timestamp","x-diva-nonce","x-diva-signature","x-diva-gateway-version",
"diva-universal-private-gateway-v0.1","stableStringify","conversation_ref","whatsapp://",
"sock.sendMessage","/pair","processedMessageIds","messageTimestamp","DIVA_MESSAGE_MAX_AGE_MS","DIVA_FLOW_WATCHDOG_MS","DIVA_FLOW_WATCHDOG_RECYCLE","DIVA_SUPERVISED_RESTART","process.exit(1)","bootInProgress","DIVA_STARTUP_GRACE_MS","DIVA_TAKEOVER_WAIT"
]) assert.ok(src.includes(token),"missing contract token: "+token);
assert.ok(!src.includes("useMultiFileAuthState"),"must not use filesystem auth state");
assert.ok(src.includes("const silentBaileysLogger={"),"Baileys runtime must declare an explicit silent logger");
assert.ok(src.includes("child(){return this}"),"silent Baileys logger must satisfy child logger contract");
assert.ok(src.includes("logger:silentBaileysLogger"),"makeWASocket must receive the explicit silent logger");
assert.ok(src.includes('head.startsWith("Closing session:")'),"libsignal Closing session dumps must be intercepted");
assert.ok(src.includes("DIVA_SIGNAL_SESSION_ROTATION_REDACTED"),"sensitive Signal session dump must be replaced by a sanitized marker");
assert.ok(src.includes("function safeRelayTarget()"),"relay diagnostics must expose only a sanitized target fingerprint");
assert.ok(src.includes("return{origin:u.origin,path:u.pathname}"),"relay target diagnostics must omit URL query and credentials");
assert.ok(src.includes('retryAfter=res.headers.get("retry-after")||null'),"relay 429 diagnostics must preserve retry-after without logging secrets");
console.log("DIVA_BAILEYS_SATELLITE_CONTRACT_OK");
assert.ok(!src.includes("setTimeout(connect,2500)"),"must not reconnect Baileys in-process");

assert.ok(src.includes("setTimeout(startConnect,DIVA_STARTUP_GRACE_MS)"),"new Render instance must become healthy before taking over the shared Baileys session");

for(const token of ["runRelayCanary","DIVA_LOCAL_RELAY_CANARY_OK","DIVA_LOCAL_RELAY_CANARY_FAILED","without_diva_wake_word"])
  assert.ok(src.includes(token),"missing relay canary token: "+token);
assert.ok(src.includes('relay("healthcheck","relay_canary_"+Date.now())'),"relay canary must verify signed local relay without sending a WhatsApp message");
