export const GABI_INTENT_MATCH_VERSION='gabi-intent-commercial-match-v1';

const clean=(value,max=500)=>String(value??'')
  .replace(/[\u0000-\u001f\u007f]/g,' ')
  .replace(/\s+/g,' ')
  .trim()
  .slice(0,max);
const norm=value=>clean(value,500).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const uniq=values=>[...new Set((Array.isArray(values)?values:[]).map(v=>clean(v,180)).filter(Boolean))];

function brandOf(row={}){
  return clean(row.brand||row.marca||row.organizationName||row.organization,180);
}
function marketOf(row={}){
  return clean(row.market||row.pais||row.country,60).toUpperCase();
}
function safeStage(row={}){
  return clean(row.status||row.stage||row.etapa||row.pipelineStage,160);
}
function priorityOf(row={}){
  return clean(row.priority||row.prioridade,40);
}
function sourceRefOf(row={}){
  return clean(row.sourceRef||row.proofRef||row.provaRef||'',260);
}

export function matchGabiIntentToCommercialRows({intent={},crmRows=[]}={}){
  const desired=uniq(intent.brands).map(name=>({name,key:norm(name)})).filter(x=>x.key);
  if(!desired.length)return[];
  const rows=Array.isArray(crmRows)?crmRows:[];
  const matches=[];
  for(const row of rows){
    const brand=brandOf(row);
    const key=norm(brand);
    if(!key)continue;
    const desiredBrand=desired.find(x=>x.key===key);
    if(!desiredBrand)continue;
    matches.push(Object.freeze({
      version:GABI_INTENT_MATCH_VERSION,
      brand,
      market:marketOf(row)||null,
      stage:safeStage(row)||null,
      priority:priorityOf(row)||null,
      sourceRef:sourceRefOf(row)||null,
      recommendedAction:'REVIEW_ROUTE',
      outreachAuthorized:false,
      reason:'preferência explícita da Gabi encontrada no CRM; revisar rota e timing antes de qualquer contato',
      routingTarget:marketOf(row)==='EUA'?'VITORIA_EUA':'VITORIA_BR',
      provenance:Object.freeze({
        intent:'GABI_INTENT',
        commercialSource:sourceRefOf(row)||'crm_row'
      })
    }));
  }
  return Object.freeze(matches);
}
