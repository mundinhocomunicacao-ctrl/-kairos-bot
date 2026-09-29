import {ANJOS,ANJO_SHARED_ACCESS} from '../data/anjos-agent-registry.js';
import {PLUGIN_CELL_CANDIDATES_V1} from '../data/plugin-cell-candidates-v1.js';
import {DIVA_CAPABILITY_REGISTRY_V2} from './diva-capability-registry-v2.mjs';
import {CONNECTED_RESOURCE_REGISTRY} from './connected-resource-registry.mjs';

export const ANJO_PLUGIN_ORCHESTRATOR_VERSION='anjo-plugin-orchestrator-v1';

const normalize=value=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const unique=values=>[...new Set((values||[]).filter(Boolean).map(v=>String(v)))];

const resourceAliases=Object.freeze({
  'github':'github-mundinho',
  'gitlab':'gitlab-mundinho',
  'wix':'wix-mundinho',
  'google-drive':'google-drive-mundinho',
  'gmail':'gmail-mundinho',
  'google-calendar':'google-calendar-mundinho',
  'google-contacts':'google-contacts-mundinho',
  'slack':'slack-mundinho',
  'render':'render-mundinho',
  'supabase':'supabase-mundinho',
  'hugging-face':'huggingface-mundinho',
  'make':'make-mundinho'
});

function resolvePlugin(name){
  const needle=normalize(name);
  return PLUGIN_CELL_CANDIDATES_V1.find(row=>
    normalize(row.name)===needle ||
    normalize(row.source_name)===needle ||
    normalize(row.provider_id)===needle
  )||null;
}

function resolveRuntimeState(plugin){
  if(!plugin)return Object.freeze({state:'UNKNOWN_PLUGIN',routeState:'UNAVAILABLE'});
  const alias=resourceAliases[normalize(plugin.name)]||null;
  const resource=alias?CONNECTED_RESOURCE_REGISTRY.resources.find(row=>row.id===alias):null;
  if(resource?.status==='CONNECTED_PROVEN'){
    return Object.freeze({state:'VERIFIED',routeState:'ROUTABLE_PROVEN',resourceId:resource.id,lastVerifiedAt:resource.lastVerifiedAt||null});
  }
  const capability=DIVA_CAPABILITY_REGISTRY_V2.find(row=>row.name===plugin.name)||null;
  return Object.freeze({
    state:capability?.state||plugin.state||'UNKNOWN',
    routeState:'PROOF_REQUIRED',
    resourceId:resource?.id||null,
    lastVerifiedAt:resource?.lastVerifiedAt||null
  });
}

export function angelPluginCoverage(){
  const adapted=PLUGIN_CELL_CANDIDATES_V1.filter(plugin=>
    ANJOS.every(angel=>angel.pluginAdaptationTarget===1&&angel.pluginContract==='PLUGIN_CELL_CANDIDATOS_V1')
  );
  return Object.freeze({
    registry:'PLUGIN_CELL_CANDIDATOS_V1',
    totalPlugins:PLUGIN_CELL_CANDIDATES_V1.length,
    adaptedPlugins:adapted.length,
    coverage:PLUGIN_CELL_CANDIDATES_V1.length?adapted.length/PLUGIN_CELL_CANDIDATES_V1.length:0,
    means:'contract_adaptation_not_blanket_runtime_authorization'
  });
}

function angelCountFor(complexity){
  const level=String(complexity||'STANDARD').toUpperCase();
  if(level==='CRITICAL')return 7;
  if(level==='HIGH')return 5;
  if(level==='LOW')return 2;
  return 3;
}

export function buildAngelMission({
  missionId,
  intent='',
  complexity='STANDARD',
  requestedPlugins=[],
  requiredFronts=[],
  minimumAngels=null
}={}){
  const id=String(missionId||'').trim();
  if(!id)throw new Error('ANJO_MISSION_ID_REQUIRED');
  const count=Math.min(7,Math.max(1,Number.isFinite(Number(minimumAngels))&&Number(minimumAngels)>0?Number(minimumAngels):angelCountFor(complexity)));
  const angels=ANJOS.slice(0,count).map((angel,index)=>Object.freeze({
    id:angel.id,
    name:angel.name,
    missionStance:angel.missionStance,
    order:index+1,
    reportsTo:'DIVA',
    accessGovernor:'PANDORA',
    sharedAccessId:ANJO_SHARED_ACCESS.id
  }));
  const pluginPlan=unique(requestedPlugins).map(requested=>{
    const plugin=resolvePlugin(requested);
    const runtime=resolveRuntimeState(plugin);
    return Object.freeze({
      requested:String(requested),
      name:plugin?.name||String(requested),
      providerId:plugin?.provider_id||null,
      category:plugin?.category||null,
      declaredState:plugin?.state||'UNKNOWN',
      runtimeState:runtime.state,
      routeState:runtime.routeState,
      resourceId:runtime.resourceId||null,
      lastVerifiedAt:runtime.lastVerifiedAt||null,
      accessVia:'PANDORA',
      leaseRequired:true,
      sharedAcrossAngels:true,
      secretExposure:false
    });
  });
  const proofRequired=pluginPlan.filter(row=>row.routeState!=='ROUTABLE_PROVEN');
  return Object.freeze({
    schemaVersion:ANJO_PLUGIN_ORCHESTRATOR_VERSION,
    missionId:id,
    intent:String(intent||''),
    complexity:String(complexity||'STANDARD').toUpperCase(),
    orchestrator:'DIVA',
    accessGovernor:'PANDORA',
    sovereignRoot:'Mundinho Comunicação',
    requiredFronts:Object.freeze(unique(requiredFronts)),
    angels:Object.freeze(angels),
    pluginPlan:Object.freeze(pluginPlan),
    status:proofRequired.length?'READY_WITH_GATED_CAPABILITIES':'READY_TO_EXECUTE',
    proofRequired:Object.freeze(proofRequired.map(row=>row.name)),
    sharedAccess:ANJO_SHARED_ACCESS,
    rules:Object.freeze([
      'DIVA_FINAL_ROUTE_AUTHORITY',
      'PANDORA_LEASE_BEFORE_PLUGIN_USE',
      'NO_SECRET_COPY',
      'PROVE_BEFORE_PLUGIN_USE',
      'SHARED_ACCESS_POINTERS_NOT_SHARED_SECRETS',
      'APPEND_ONLY_PLUGIN_RECEIPTS',
      'REREAD_BEFORE_SUCCESS',
      'NO_SILENT_FAILOVER',
      'NO_PARALLEL_SOVEREIGNTY'
    ])
  });
}
