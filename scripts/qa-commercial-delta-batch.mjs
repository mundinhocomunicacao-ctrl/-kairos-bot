import assert from 'node:assert/strict';
import {executeCommercialDeltaBatch} from '../lib/commercial-delta-fabric.mjs';

const calls=[];
const persist=async eventSpec=>{
  calls.push(eventSpec);
  return {status:'ready',persisted:true,verified:true,gabiRadar:{status:'ready',persisted:true,eventId:eventSpec.idempotencyKey}};
};

const result=await executeCommercialDeltaBatch({
  rows:[
    {brand:'Alyne Cosméticos',status:'contraproposta enviada · aguardando aceite',market:'BR',lastActionAt:'29/09/2026',sourceRef:'05_PIPELINE!A6:O6'},
    {brand:'Constance',status:'material a enviar',market:'BR',lastActionAt:'15/09/2026',sourceRef:'05_PIPELINE!A4:O4'}
  ],
  previousByBrand:{'alyne-cosmeticos':'proposal','constance':'material_requested'},
  persist
});

assert.equal(result.selectedCount,1,'idempotent stage must be skipped');
assert.equal(result.executedCount,1);
assert.equal(result.verifiedCount,1);
assert.equal(result.radarPersistedCount,1);
assert.equal(calls.length,1);
assert.equal(calls[0].payload.title,'Alyne Cosméticos');
assert.equal(calls[0].payload.status,'Aguardando confirmação da marca');
assert.equal(result.receipts[0].brand,'Alyne Cosméticos');
assert.equal(result.receipts[0].verified,true);
assert.equal(result.receipts[0].gabiRadarPersisted,true);

await assert.rejects(
  ()=>executeCommercialDeltaBatch({rows:[{brand:'A',status:'lead'}]}),
  /COMMERCIAL_DELTA_PERSIST_REQUIRED/
);

console.log('PASS · COMMERCIAL_DELTA_BATCH_EXECUTION · material deltas only → verified receipts');
