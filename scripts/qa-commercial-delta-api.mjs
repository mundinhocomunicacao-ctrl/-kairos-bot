import assert from 'node:assert/strict';
import {handleCommercialDeltaRequest} from '../lib/commercial-delta-fabric.mjs';

const unauthorized=await handleCommercialDeltaRequest({method:'POST',body:{rows:[]},actor:null,persist:async()=>({})});
assert.equal(unauthorized.status,401);

const wrongMethod=await handleCommercialDeltaRequest({method:'GET',body:{},actor:{id:'qa'},persist:async()=>({})});
assert.equal(wrongMethod.status,405);

const calls=[];
const ok=await handleCommercialDeltaRequest({
  method:'POST',
  actor:{id:'qa-user'},
  body:{
    rows:[{
      brand:'Alyne Cosméticos',
      status:'contraproposta enviada · aguardando aceite',
      market:'BR',
      lastActionAt:'29/09/2026',
      sourceRef:'05_PIPELINE!A6:O6',
      contact:'Pessoa Privada',
      email:'private@example.com',
      whatsapp:'+55 11 99999-9999'
    }],
    previousByBrand:{'alyne-cosmeticos':'proposal'}
  },
  persist:async spec=>{calls.push(spec);return{status:'ready',persisted:true,verified:true,gabiRadar:{persisted:true}}}
});
assert.equal(ok.status,200);
assert.equal(ok.body.ok,true);
assert.equal(ok.body.version,'commercial-delta-fabric-v1');
assert.equal(ok.body.selectedCount,1);
assert.equal(ok.body.verifiedCount,1);
assert.equal(ok.body.radarPersistedCount,1);
const serialized=JSON.stringify(ok.body);
for(const forbidden of ['Pessoa Privada','private@example.com','99999-9999']){
  assert.equal(serialized.includes(forbidden),false,'HTTP response leaked source-row PII: '+forbidden);
}

const empty=await handleCommercialDeltaRequest({
  method:'POST',actor:{id:'qa-user'},body:{rows:[],previousByBrand:{}},persist:async()=>({verified:true})
});
assert.equal(empty.status,200);
assert.equal(empty.body.selectedCount,0);

console.log('PASS · COMMERCIAL_DELTA_HTTP_CONTRACT · auth + no raw CRM echo + receipt-only response');
