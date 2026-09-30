import crypto from 'node:crypto';
import {resolveCommercialStage} from '../data/commercial-pipeline-stages.js';

export const COMMERCIAL_DELTA_FABRIC_VERSION='commercial-delta-fabric-v1';
export const GABI_COMMERCIAL_ENTITY_ID='talent:gabriella-saraivah';

const clean=(value,max=500)=>String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>clean(value,500).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const slugify=value=>norm(value).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,160);
const hash=value=>crypto.createHash('sha256').update(String(value||'')).digest('hex').slice(0,16);

const CLIENT_STATE = Object.freeze({
  signal:{clientStatus:'No radar',temperature:'FRIA'},
  lead:{clientStatus:'Mapeada',temperature:'FRIA'},
  contact_found:{clientStatus:'Rota de contato encontrada',temperature:'FRIA'},
  contact_shared:{clientStatus:'Marca respondeu com contato',temperature:'MORNA'},
  contact_validated:{clientStatus:'Contato validado pela Mundinho',temperature:'MORNA'},
  introduction:{clientStatus:'Apresentada à marca',temperature:'FRIA'},
  human_response:{clientStatus:'Marca respondeu',temperature:'MORNA'},
  interest:{clientStatus:'Marca demonstrou interesse',temperature:'MORNA'},
  material_requested:{clientStatus:'Material/proposta solicitado pela marca',temperature:'MORNA'},
  material_sent:{clientStatus:'Material enviado',temperature:'MORNA'},
  forwarded_internally:{clientStatus:'Encaminhada internamente pela marca',temperature:'MORNA'},
  casting:{clientStatus:'Em mapeamento/casting',temperature:'MORNA'},
  budget_requested:{clientStatus:'Orçamento solicitado',temperature:'MORNA'},
  proposal:{clientStatus:'Proposta enviada',temperature:'MORNA'},
  counterproposal:{clientStatus:'Contraproposta enviada',temperature:'MORNA'},
  negotiation:{clientStatus:'Em negociação',temperature:'QUENTE'},
  preselected:{clientStatus:'Em pré-seleção',temperature:'QUENTE'},
  commercially_approved:{clientStatus:'Aprovada',temperature:'QUENTE'},
  procurement:{clientStatus:'Em formalização',temperature:'QUENTE'},
  contract_po:{clientStatus:'Contrato/PO em andamento',temperature:'QUENTE'},
  closed:{clientStatus:'Fechada',temperature:'QUENTE'},
  production:{clientStatus:'Em produção',temperature:'QUENTE'},
  creative_approval:{clientStatus:'Em aprovação criativa',temperature:'QUENTE'},
  published_delivered:{clientStatus:'Publicado/entregue',temperature:'QUENTE'},
  invoiced:{clientStatus:'Faturado',temperature:'QUENTE'},
  paid:{clientStatus:'Pago',temperature:'QUENTE'}
});

const RULES = Object.freeze([
  {re:/contraproposta/,stage:'counterproposal'},
  {re:/aprovad[oa]\s+comercial|fechad[oa]|vamos\s+fechar|confirmad[oa]/,stage:'commercially_approved'},
  {re:/negocia[cç][aã]o|negociando|ajuste de proposta|ajustes de proposta/,stage:'negotiation'},
  {re:/proposta\s+enviad|orcamento\s+enviad|orçamento\s+enviad|proposta\s+apresentad|orcamento\s+apresentad|orçamento\s+apresentad/,stage:'proposal'},
  {re:/budget\s+solicitad|orcamento\s+solicitad|orçamento\s+solicitad|pediu\s+orcamento|pediu\s+orçamento/,stage:'budget_requested'},
  {re:/material\s+a\s+enviar|material\s+solicitad|midia\s+kit\s+solicitad|mídia\s+kit\s+solicitad|proposta\s+solicitad/,stage:'material_requested'},
  {re:/material\s+enviad|midia\s+kit\s+enviad|mídia\s+kit\s+enviad/,stage:'material_sent'},
  {re:/encaminhad[oa]\s+internamente|encaminhou\s+ao\s+marketing/,stage:'forwarded_internally'},
  {re:/interesse/,stage:'interest'},
  {re:/resposta\s+humana|respondeu|rota\s+aberta/,stage:'human_response'},
  {re:/contato\s+validado/,stage:'contact_validated'},
  {re:/contato\s+compartilhado|contato\s+recebido|e-?mail\s+recebido/,stage:'contact_shared'},
  {re:/apresentad[oa]\s+(?:por\s+)?(?:dm|e-?mail|whatsapp)|primeir[oa]\s+contato\s+enviad[oa]|dm\s+enviad[oa]/,stage:'introduction'},
  {re:/mapead[oa]|lead/,stage:'lead'}
]);

function stateFromStage(stageId){
  const resolved=resolveCommercialStage(stageId);
  if(!resolved.valid||resolved.postPipeline)return null;
  const presentation=CLIENT_STATE[resolved.stage.id]||{clientStatus:resolved.stage.label,temperature:'MORNA'};
  return Object.freeze({
    stageId:resolved.stage.id,
    stageLabel:resolved.stage.label,
    clientStatus:presentation.clientStatus,
    temperature:presentation.temperature
  });
}

export function resolveCrmCommercialState(value){
  const raw=clean(value,300);
  if(!raw)return null;
  const direct=resolveCommercialStage(raw);
  let out=direct.valid&&!direct.postPipeline?stateFromStage(direct.stage.id):null;
  if(!out){
    const normalized=norm(raw);
    const rule=RULES.find(item=>item.re.test(normalized));
    out=rule?stateFromStage(rule.stage):null;
  }
  if(!out)return null;
  const normalized=norm(raw);
  if(out.stageId==='counterproposal'&&/aguardando\s+(?:aceite|confirmacao|confirmação)/.test(normalized)){
    return Object.freeze({...out,clientStatus:'Aguardando confirmação da marca',temperature:'MORNA'});
  }
  if(out.stageId==='proposal'&&/aguardando\s+resposta/.test(normalized)){
    return Object.freeze({...out,clientStatus:'Aguardando resposta da marca',temperature:'MORNA'});
  }
  return out;
}

function brandOf(row={}){
  return clean(row.brand||row.marca||row.organizationName||row.organizacao||row.organization,180);
}
function statusOf(row={}){
  return clean(row.status||row.stage||row.etapa||row.statusAtual||row.status_atual||row.pipelineStage,300);
}
function sourceRefOf(row={}){
  return clean(row.sourceRef||row.proofRef||row.provaRef||row.rangeRef||'',300);
}
function actionDateOf(row={}){
  return clean(row.lastActionAt||row.dataUltimaAcao||row.lastInteraction||row.date||row.data||'',80);
}
function marketOf(row={}){
  return clean(row.market||row.pais||row.country||'',40).toUpperCase();
}

export function compileCommercialDelta({row={},previousStage=null,talentEntityId=GABI_COMMERCIAL_ENTITY_ID}={}){
  const brand=brandOf(row);
  if(!brand)return null;
  const state=resolveCrmCommercialState(statusOf(row));
  if(!state)return null;

  const previous=resolveCrmCommercialState(previousStage);
  if(previous?.stageId===state.stageId)return null;

  const brandSlug=slugify(brand);
  if(!brandSlug)return null;
  const sourceRef=sourceRefOf(row);
  const occurredAt=actionDateOf(row);
  const market=marketOf(row);
  const fingerprint=hash([brandSlug,state.stageId,sourceRef,occurredAt].join('|'));
  const evidenceIds=sourceRef?[sourceRef]:[];
  const entityIds=[talentEntityId,'brand:'+brandSlug].filter(Boolean);

  const payload=Object.freeze({
    schema_version:COMMERCIAL_DELTA_FABRIC_VERSION,
    clientSafe:true,
    title:brand,
    brand,
    category:'comercial',
    status:state.clientStatus,
    summary:brand+': '+state.clientStatus+'.',
    sourceLabel:'Mundinho Comunicação',
    stage_candidate:state.stageLabel,
    stage_id:state.stageId,
    temperature:state.temperature,
    market:market||undefined,
    occurred_at:occurredAt||undefined
  });

  return Object.freeze({
    commercial:Object.freeze({brand,brandSlug,...state,market:market||null,occurredAt:occurredAt||null,sourceRef:sourceRef||null}),
    eventSpec:Object.freeze({
      destination:'pipeline',
      kind:'state_change',
      entityIds:Object.freeze(entityIds),
      payload,
      evidenceIds:Object.freeze(evidenceIds),
      source:'crm_vitoria_delta',
      sourceId:sourceRef||'crm:'+brandSlug,
      idempotencyKey:'crm-delta:'+brandSlug+':'+state.stageId+':'+fingerprint,
      confidence:sourceRef?1:0.85
    })
  });
}

export function compileCommercialDeltaBatch({rows=[],previousByBrand={}}={}){
  return (Array.isArray(rows)?rows:[]).flatMap(row=>{
    const brand=brandOf(row);
    const key=slugify(brand);
    const compiled=compileCommercialDelta({row,previousStage:previousByBrand?.[key]||previousByBrand?.[brand]||null});
    return compiled?[compiled]:[];
  });
}


export async function executeCommercialDeltaBatch({rows=[],previousByBrand={},persist}={}){
  if(typeof persist!=='function')throw new Error('COMMERCIAL_DELTA_PERSIST_REQUIRED');
  const selected=compileCommercialDeltaBatch({rows,previousByBrand});
  const receipts=[];
  for(const item of selected){
    const result=await persist(item.eventSpec,item);
    receipts.push(Object.freeze({
      brand:item.commercial.brand,
      brandSlug:item.commercial.brandSlug,
      stageId:item.commercial.stageId,
      clientStatus:item.commercial.clientStatus,
      idempotencyKey:item.eventSpec.idempotencyKey,
      persisted:Boolean(result?.persisted),
      verified:Boolean(result?.verified),
      gabiRadarPersisted:Boolean(result?.gabiRadar?.persisted),
      status:result?.status||null,
      reason:result?.reason||null
    }));
  }
  return Object.freeze({
    inputCount:Array.isArray(rows)?rows.length:0,
    selectedCount:selected.length,
    executedCount:receipts.length,
    persistedCount:receipts.filter(x=>x.persisted).length,
    verifiedCount:receipts.filter(x=>x.verified).length,
    radarPersistedCount:receipts.filter(x=>x.gabiRadarPersisted).length,
    receipts:Object.freeze(receipts)
  });
}


export async function handleCommercialDeltaRequest({method='POST',body={},actor=null,persist}={}){
  if(!actor)return{status:401,body:{ok:false,version:COMMERCIAL_DELTA_FABRIC_VERSION,error:'unauthorized'}};
  if(String(method||'').toUpperCase()!=='POST')return{status:405,body:{ok:false,version:COMMERCIAL_DELTA_FABRIC_VERSION,error:'method_not_allowed'}};
  const rows=Array.isArray(body?.rows)?body.rows:null;
  if(!rows)return{status:400,body:{ok:false,version:COMMERCIAL_DELTA_FABRIC_VERSION,error:'rows_required'}};
  if(rows.length>100)return{status:413,body:{ok:false,version:COMMERCIAL_DELTA_FABRIC_VERSION,error:'batch_too_large',maxRows:100}};
  const result=await executeCommercialDeltaBatch({
    rows,
    previousByBrand:body?.previousByBrand&&typeof body.previousByBrand==='object'?body.previousByBrand:{},
    persist
  });
  const ok=result.executedCount===result.verifiedCount;
  return{
    status:ok?200:207,
    body:{
      ok,
      version:COMMERCIAL_DELTA_FABRIC_VERSION,
      inputCount:result.inputCount,
      selectedCount:result.selectedCount,
      executedCount:result.executedCount,
      persistedCount:result.persistedCount,
      verifiedCount:result.verifiedCount,
      radarPersistedCount:result.radarPersistedCount,
      receipts:result.receipts
    }
  };
}
