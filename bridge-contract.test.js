import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./server.js',import.meta.url),'utf8');
assert.doesNotThrow(()=>JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url),'utf8')));
assert.equal(source.includes('\\nconst'),false,'escaped newline corruption must be absent');

for(const invariant of [
  'WHATSSCALE_API_KEY',
  'WHATSSCALE_SESSION',
  'KAIROS_TRIGGER_SECRET',
  'KAIROS_TEST_TOKEN',
  '/send',
  '/test',
  'DIVA_1ON1_RELAY_ENABLED',
  'DIVA_RELAY_URL',
  'DIVA_RELAY_SECRET',
  'DIVA_WHATSAPP_ALLOWED_NUMBERS',
  '/webhooks/diva-1on1',
  '/v1/webhooks',
  '/v1/webhooks/subscribe',
  'signing_secret',
  'x-whatsscale-signature',
  'x-whatsscale-timestamp',
  'x-diva-whatsapp-relay-signature',
  'x-diva-whatsapp-relay-timestamp'
]){
  assert.ok(source.includes(invariant),`missing bridge invariant: ${invariant}`);
}

assert.ok(source.includes("trigger_type: '1on1'"),'subscription must use WhatsScale 1on1 trigger');
assert.ok(source.includes("row?.trigger_type === '1on1'"),'startup rotation must identify only the owned 1on1 subscription');
assert.ok(source.includes('row?.webhook_url === webhookUrl'),'startup rotation must never delete unrelated subscriptions');
assert.ok(source.includes("String(process.env.DIVA_1ON1_RELAY_ENABLED || '').toLowerCase() === 'true'"),'relay must default fail-closed');
assert.ok(source.includes("Math.abs(Math.floor(Date.now() / 1000) - ts) > 300"),'WhatsScale replay window must be enforced');
assert.ok(source.includes(".update(timestamp + '\\n')"),'Render to Wix relay signature must bind timestamp and raw body');
assert.ok(source.includes('allowedSender(fromNumber)'),'sender allowlist must be enforced before relay');
assert.ok(source.includes('extractDivaPrompt(data.body)'),'DIVA wake word must gate automatic replies');
assert.ok(source.includes('reply.replyOnlyToOrigin !== true'),'reply must be origin-bound');
assert.ok(source.includes('reply.recipient !== replyChatId'),'reply recipient must equal inbound contact');
assert.ok(source.includes('sendWhatsApp(reply.text, reply.recipient)'),'reply must return to exact origin contact');
assert.equal(source.includes('/api/diva-whatsapp-ingress'),false,'phantom ingress must not remain');
assert.equal(source.includes('/api/diva-whatsapp-reply-receipt'),false,'phantom receipt must not remain');

console.log('KAIROS_BASE_TRANSPORT_CONTRACT_OK');
console.log('DIVA_WHATSAPP_1ON1_RELAY_CONTRACT_OK');
