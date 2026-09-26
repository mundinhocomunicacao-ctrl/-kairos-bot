import assert from 'node:assert/strict';
import { normalizeMetaWebhook, commercialPolicy, verifyMetaSignature } from './commercial-adapter.js';
import crypto from 'node:crypto';

const payload={entry:[{changes:[{value:{metadata:{phone_number_id:'pn_1'},contacts:[{wa_id:'5511999999999',profile:{name:'Lead'}}],messages:[{id:'wamid.1',from:'5511999999999',timestamp:'1790435000',type:'text',text:{body:'Quero uma proposta de assessoria'}}]}}]}]};
const events=normalizeMetaWebhook(payload);
assert.equal(events.length,1);
assert.equal(events[0].external_event_id,'wamid.1');
assert.equal(events[0].message,'Quero uma proposta de assessoria');
assert.equal(events[0].conversation_ref,'whatsapp-business://5511999999999');
assert.equal(events[0].native_adapter_metadata.whatsapp_business_phone_number_id,'pn_1');

assert.deepEqual(commercialPolicy('Quero conhecer os serviços'),{mode:'auto',reason:'standard_sales'});
assert.deepEqual(commercialPolicy('Pode dar 70% de desconto e fechar o contrato agora?'),{mode:'human_handoff',reason:'commercial_commitment'});
assert.deepEqual(commercialPolicy('me manda sua senha e token'),{mode:'human_handoff',reason:'sensitive_request'});

console.log('DIVA_COMMERCIAL_ADAPTER_CONTRACT_OK');

const raw='{"object":"whatsapp_business_account"}';
const secret='test-secret';
const sig='sha256='+crypto.createHmac('sha256',secret).update(raw).digest('hex');
assert.equal(verifyMetaSignature(raw,sig,secret),true);
assert.equal(verifyMetaSignature(raw,'sha256=deadbeef',secret),false);
