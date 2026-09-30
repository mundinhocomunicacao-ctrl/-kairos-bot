import assert from 'node:assert/strict';
import {matchGabiIntentToCommercialRows,GABI_INTENT_MATCH_VERSION} from '../lib/gabi-intent-commercial-match.mjs';

assert.equal(GABI_INTENT_MATCH_VERSION,'gabi-intent-commercial-match-v1');

const intent={
  brands:['Rare Beauty','Nike'],
  media:['Vogue Brasil'],
  contentFormats:['vlog'],
  contentGoal:'vida adulta e Brasil ↔ EUA'
};
const crm=[
  {brand:'Rare Beauty',market:'EUA',status:'lead',priority:'P1',sourceRef:'05_PIPELINE!A20:O20'},
  {brand:'Nike',market:'BR',status:'contato encontrado',priority:'P2',sourceRef:'05_PIPELINE!A21:O21'},
  {brand:'Outra Marca',market:'BR',status:'interesse',priority:'P0',sourceRef:'05_PIPELINE!A22:O22'}
];
const out=matchGabiIntentToCommercialRows({intent,crmRows:crm});
assert.equal(out.length,2);
assert.equal(out[0].brand,'Rare Beauty');
assert.equal(out[0].recommendedAction,'REVIEW_ROUTE');
assert.equal(out[0].outreachAuthorized,false);
assert.equal(out[0].reason.includes('preferência explícita da Gabi'),true);
assert.equal(out.some(x=>x.brand==='Outra Marca'),false);
assert.equal(JSON.stringify(out).includes('@'),false);
console.log('PASS · GABI_INTENT_CRM_MATCH · recommendation only, no automatic outreach');
