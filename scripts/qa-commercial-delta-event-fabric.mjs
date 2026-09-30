import assert from 'node:assert/strict';
import {compileCommercialDelta,resolveCrmCommercialState,COMMERCIAL_DELTA_FABRIC_VERSION} from '../lib/commercial-delta-fabric.mjs';

assert.equal(COMMERCIAL_DELTA_FABRIC_VERSION,'commercial-delta-fabric-v1');

const alyne={
  brand:'Alyne Cosméticos',
  market:'BR',
  status:'contraproposta enviada · aguardando aceite',
  lastActionAt:'29/09/2026',
  origin:'05_FILA_ATIVA_2026-09-15',
  sourceRef:'05_PIPELINE!A6:O6',
  contact:'Millia · Social Media · Grupo Alyne',
  email:'private@alyne.example',
  whatsapp:'(85) 99999-9999',
  evidence:'Negociação de R$ 5.000; aguardando aceite.'
};
const state=resolveCrmCommercialState(alyne.status);
assert.equal(state.stageId,'counterproposal');
assert.equal(state.stageLabel,'contraproposta');
assert.equal(state.clientStatus,'Aguardando confirmação da marca');
assert.equal(state.temperature,'MORNA');

const compiled=compileCommercialDelta({row:alyne,previousStage:'proposal'});
assert.ok(compiled,'stage change must compile');
assert.equal(compiled.eventSpec.destination,'pipeline');
assert.equal(compiled.eventSpec.kind,'state_change');
assert.deepEqual(compiled.eventSpec.entityIds,['talent:gabriella-saraivah','brand:alyne-cosmeticos']);
assert.equal(compiled.eventSpec.payload.clientSafe,true);
assert.equal(compiled.eventSpec.payload.stage_candidate,'contraproposta');
assert.equal(compiled.eventSpec.payload.status,'Aguardando confirmação da marca');
assert.equal(compiled.eventSpec.evidenceIds[0],'05_PIPELINE!A6:O6');
assert.match(compiled.eventSpec.idempotencyKey,/^crm-delta:alyne-cosmeticos:counterproposal:/);

const serialized=JSON.stringify(compiled);
for(const forbidden of ['private@alyne.example','99999-9999','5.000','Millia · Social Media']){
  assert.equal(serialized.includes(forbidden),false,'commercial delta leaked sensitive input: '+forbidden);
}

const duplicate=compileCommercialDelta({row:alyne,previousStage:'counterproposal'});
assert.equal(duplicate,null,'same canonical stage must not emit another state-change event');

const material=compileCommercialDelta({
  row:{
    brand:'Constance',
    status:'material a enviar',
    market:'BR',
    lastActionAt:'15/09/2026',
    origin:'05_FILA_ATIVA_2026-09-15',
    sourceRef:'05_PIPELINE!A4:O4',
    email:'mkt@example.invalid'
  },
  previousStage:'human_response'
});
assert.equal(material.eventSpec.payload.stage_candidate,'material solicitado');
assert.equal(material.eventSpec.payload.status,'Material/proposta solicitado pela marca');
assert.equal(material.eventSpec.payload.temperature,'MORNA');

const introduced=compileCommercialDelta({
  row:{brand:'Marca Nova',status:'apresentada por DM',market:'BR',lastActionAt:'30/09/2026',sourceRef:'01_DMS_DIARIAS_BRASIL!A100:P100'},
  previousStage:'lead'
});
assert.equal(introduced.eventSpec.payload.stage_candidate,'introdução');
assert.equal(introduced.eventSpec.payload.status,'Apresentada à marca');

console.log('PASS · COMMERCIAL_DELTA_EVENT_FABRIC · CRM delta → canonical safe event spec');
