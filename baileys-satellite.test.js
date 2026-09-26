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
"sock.sendMessage","/pair","processedMessageIds","messageTimestamp","DIVA_MESSAGE_MAX_AGE_MS","DIVA_FLOW_WATCHDOG_MS","DIVA_FLOW_WATCHDOG_RECYCLE"
]) assert.ok(src.includes(token),"missing contract token: "+token);
assert.ok(!src.includes("useMultiFileAuthState"),"must not use filesystem auth state");
console.log("DIVA_BAILEYS_SATELLITE_CONTRACT_OK");