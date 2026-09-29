import {ANJOS} from './anjos-agent-registry.js';
import {MAESTRO_QUEUE_REGISTRY} from './maestro-queue-registry.js';

export const OS_CLOSURE_QUEUE_VERSION='2026-09-28.os-11x7-v1';

const ANGEL_IDS=Object.freeze(ANJOS.map(a=>a.id));
const PARENTS=new Set(MAESTRO_QUEUE_REGISTRY.queues.map(q=>q.id));
const roles=Object.freeze({
  'anjo-01-prisma':'DECOMPOSE',
  'anjo-02-nexo':'CONNECT',
  'anjo-03-vetor':'EXECUTE',
  'anjo-04-farol':'VERIFY',
  'anjo-05-arca':'PRESERVE',
  'anjo-06-pulso':'MONITOR',
  'anjo-07-aurora':'RECONCILE'
});
const q=(id,label,{surface=null,parentQueue,capabilities=[],priority='P1',objective,exitGate='RECEIPT_REREAD_CONFIRM'}={})=>{
  if(!PARENTS.has(parentQueue))throw new Error('OS_CLOSURE_UNKNOWN_PARENT_QUEUE '+id);
  return Object.freeze({
    id,label,surface,parentQueue,priority,objective,
    capabilities:Object.freeze(capabilities),
    angelPool:ANGEL_IDS,
    angelRoles:roles,
    allocation:'ALL_SEVEN_AVAILABLE_ROLE_STAGED',
    authority:'DIVA',
    accessGovernor:'PANDORA',
    transport:'CONECTOR',
    provenance:'PANDORA_APPEND_ONLY',
    exitGate,
    autoProvision:true,
    cleanRoom:true
  });
};

export const OS_CLOSURE_QUEUE_REGISTRY=Object.freeze({
  version:OS_CLOSURE_QUEUE_VERSION,
  owner:'MAESTRO',
  reportsTo:'DIVA',
  sovereignParents:7,
  model:'ELASTIC_SUBQUEUES_UNDER_CANONICAL_MAESTRO_QUEUES',
  queueCount:14,
  rules:Object.freeze([
    'PRESERVE_SEVEN_CANONICAL_SOVEREIGN_QUEUES',
    'PROVISION_SUBQUEUE_ON_DEMAND',
    'ALL_SEVEN_ANGELS_AVAILABLE_TO_EVERY_CLOSURE_MISSION',
    'CAPABILITY_MATCH_CHOOSES_LEAD_NOT_SOVEREIGNTY',
    'NO_SECRET_COPY',
    'NO_DUPLICATE_ACTIVE_MISSION',
    'APPEND_ONLY_RECEIPTS',
    'WRITE_REREAD_CONFIRM_BEFORE_CLOSE'
  ]),
  queues:Object.freeze([
    q('os-mesa-decision','Mesa · decisão',{surface:'inicio',parentQueue:'commercial',capabilities:['commercial','calendar','research','data'],objective:'Fechar a Mesa como superfície de decisão, upload/contexto e próxima ação comprovada.'}),
    q('os-agenda-time','Agenda · tempo',{surface:'agenda',parentQueue:'commercial',capabilities:['calendar','commercial','data','automation'],objective:'Materializar tempo operacional, semana, compromissos, calendário cultural e janelas KAIROS.'}),
    q('os-pipeline-commercial','Pipeline · comercial',{surface:'pipeline',parentQueue:'commercial',capabilities:['commercial','crm','data','measurement'],objective:'Fechar stage board, timeline, follow-up, financeiro/procurement e evidência.'}),
    q('os-contacts-relations','Contatos · relações',{surface:'contatos',parentQueue:'connections',capabilities:['crm','research','data','governance'],objective:'Fechar rede relacional, timeline, identidade, rotas de entrada e provenance.'}),
    q('os-radar-intelligence','Radar · inteligência',{surface:'radar',parentQueue:'social-insights',capabilities:['research','social','measurement','strategy'],objective:'Fechar observatório externo com timeline, evidência, consequência e ação.'}),
    q('os-social-open-sea','Social · Mar Aberto',{surface:'social',parentQueue:'social-insights',capabilities:['social','research','measurement','data'],priority:'P0',objective:'Materializar visualizadores dinâmicos, ASSESSORADO/LISTENING, Mar Aberto, comments/search e demanda.'}),
    q('os-explorer-research','Explorer · investigação',{surface:'explorer',parentQueue:'connections',capabilities:['research','data','governance','reasoning'],objective:'Fechar busca global, evidence graph, timeline e navegação investigativa.'}),
    q('os-ideas-creative','Ideias · criação',{surface:'ideias',parentQueue:'mundo-products',capabilities:['strategy','design','commercial','social'],objective:'Fechar reflexo automático sinal/pipeline → seed criativo → proposta/visual com evidence gate.'}),
    q('os-pr-editorial','PR · editorial',{surface:'pr',parentQueue:'pr',capabilities:['communication','research','design','commercial'],objective:'Fechar Pipeline → ângulo → material → imprensa → clipping → continuidade com receipts.'}),
    q('os-workspace-execution','Workspace · execução',{surface:'workspace',parentQueue:'mundo-products',capabilities:['documentation','automation','design','data'],objective:'Fechar árvore/contexto, terminais, Comparison Canvas e relação documento↔entidade↔missão.'}),
    q('os-system-governance','Configurações · sistema',{surface:'configuracoes',parentQueue:'mundo-products',capabilities:['governance','verification','measurement','recovery'],objective:'Fechar health, fontes, authority, coverage, providers e metadata atual sem legado visual.'}),
    q('os-data-ingestion','Transversal · ingestão',{parentQueue:'connections',capabilities:['data','research','automation','governance'],objective:'Resolver lacunas de fonte/dado para qualquer superfície.'}),
    q('os-visual-verification','Transversal · visual QA',{parentQueue:'mundo-products',capabilities:['design','verification','measurement'],objective:'Validar 1440/1024/768/375, DOM, console, network e botões das 11 áreas.'}),
    q('os-release-e2e','Transversal · release E2E',{parentQueue:'mundo-products',capabilities:['deploy','verification','recovery','governance'],priority:'P0',objective:'Publicar o mesmo OS e fechar receipt/readback/rollback do SHA aprovado.'})
  ])
});

export function osClosureQueueForSurface(surface){
  return OS_CLOSURE_QUEUE_REGISTRY.queues.find(row=>row.surface===String(surface||''))||null;
}

export function buildOsClosureQueueMission(surface,{missionId=null}={}){
  const queue=osClosureQueueForSurface(surface);
  if(!queue)throw new Error('OS_CLOSURE_SURFACE_UNKNOWN');
  const raw=missionId||('OS-CLOSURE-'+String(surface).toUpperCase()+'-'+OS_CLOSURE_QUEUE_VERSION);
  const id=String(raw).replace(/[^A-Z0-9-]+/gi,'-');
  return Object.freeze({
    missionId:id,
    queue,
    orchestrator:'DIVA',
    accessGovernor:'PANDORA',
    angels:Object.freeze({
      count:7,
      angels:Object.freeze(ANJOS.map((angel,index)=>Object.freeze({
        id:angel.id,
        name:angel.name,
        role:roles[angel.id]||'SUPPORT',
        order:index+1,
        reportsTo:'DIVA'
      })))
    }),
    completion:'RECEIPT_REREAD_CONFIRM'
  });
}

export function osClosureSummary(){
  return Object.freeze({
    version:OS_CLOSURE_QUEUE_REGISTRY.version,
    queues:OS_CLOSURE_QUEUE_REGISTRY.queues.length,
    surfaceQueues:OS_CLOSURE_QUEUE_REGISTRY.queues.filter(q=>q.surface).length,
    transversalQueues:OS_CLOSURE_QUEUE_REGISTRY.queues.filter(q=>!q.surface).length,
    angelsPerQueue:7
  });
}
