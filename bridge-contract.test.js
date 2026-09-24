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
assert.ok(source.includes("row?.trigger_type === '1on1'"),'rotation must target only the DIVA 1on1 subscription');
assert.ok(source.includes('row?.webhook_url === webhookUrl'),'rotation must preserve unrelated subscriptions');
assert.ok(source.includes("String(process.env.DIVA_1ON1_RELAY_ENABLED || '').toLowerCase() === 'true'"),'relay must default fail-closed');
assert.ok(source.includes('allowedSender(fromNumber)'),'sender allowlist must gate relay');
assert.ok(source.includes('extractDivaPrompt(data.body)'),'DIVA wake word must gate replies');
assert.ok(source.includes('reply.replyOnlyToOrigin !== true'),'reply must be origin-bound');
assert.ok(source.includes('reply.recipient !== replyChatId'),'recipient must match inbound contact');
assert.ok(source.includes('sendWhatsApp(reply.text, reply.recipient)'),'reply must return to origin');
assert.equal(source.includes('/api/diva-whatsapp-ingress'),false,'phantom ingress must be removed');
assert.equal(source.includes('/api/diva-whatsapp-reply-receipt'),false,'phantom receipt must be removed');

console.log('KAIROS_BASE_TRANSPORT_CONTRACT_OK');
console.log('DIVA_WHATSAPP_1ON1_RELAY_CONTRACT_OK');
