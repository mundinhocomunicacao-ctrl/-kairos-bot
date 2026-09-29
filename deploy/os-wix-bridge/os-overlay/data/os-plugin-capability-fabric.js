import {PLUGIN_CELL_CANDIDATES_V1} from './plugin-cell-candidates-v1.js';

export const OS_PLUGIN_CAPABILITY_FABRIC=Object.freeze({
  version:'2026-09-29.alexandria-198-plugin-fabric-v2',
  inventoryType:'PLUGINS',
  historicalInventory:198,
  historicalPluginInventory:198,
  catalogMeaning:'CATALOGED_PLUGIN_NE_CONNECTED_AUTHORIZED_OR_PROVEN',
  classifiedRegistry:'PLUGIN_CELL_CANDIDATOS_V1',
  proofPolicy:'PROVE_BEFORE_PROMOTE',
  orchestrator:'DIVA',
  provenance:'PANDORA',
  learning:'ATENEU',
  router:'COLMEIA_PLUGIN_ROUTER',
  uiPolicy:'SURFACE_CAPABILITIES_NOT_CATALOG_DUMP',
  dualUsePolicy:'PLUGINS_SERVE_BUILD_AND_DAILY_OPERATION_WITH_SEPARATE_SCOPE_AUTH_AND_RECEIPTS',
  flow:Object.freeze(['NEED','ALEXANDRIA_198_PLUGINS','MATCH','AUTH','TEST','ROUTABLE_PROVEN','EXECUTE','RECEIPT','LEARN','DNA']),
  buildFabric:Object.freeze({
    purpose:'CONSTRUCT_TEST_RELEASE_OBSERVE_OS',
    stages:Object.freeze({
      source:Object.freeze(['GitLab','GitHub']),
      design:Object.freeze(['Canva','Adobe','Figma','Miro','Product Design']),
      engineering:Object.freeze(['GitHub','GitLab','Vercel','Render','Wix','AppDeploy']),
      qa:Object.freeze(['Vercel','Render','PostHog','Wix']),
      release:Object.freeze(['GitLab','GitHub','Render','Wix'])
    }),
    rule:'BUILD_PLUGIN_USE_REQUIRES_PROVEN_AUTHORIZED_ROUTE_AND_BUILD_RECEIPT'
  }),
  operationFabric:Object.freeze({
    purpose:'RUN_THE_12_OS_AREAS_AND_7_QUEUES_DAILY',
    stateModel:Object.freeze(['CATALOGED','AUTH_REQUIRED','TESTING','ROUTABLE_PROVEN','DEGRADED','BLOCKED']),
    routingRule:'AREA_OR_QUEUE_NEED_SELECTS_PLUGIN;PLUGIN_NEVER_SELECTS_THE_MISSION',
    receiptRule:'EVERY_OPERATIONAL_PLUGIN_ACTION_WITH_SIDE_EFFECT_REQUIRES_PANDORA_RECEIPT_AND_REREAD',
    fallbackRule:'IF_PRIMARY_PLUGIN_IS_NOT_ROUTABLE_PROVEN_USE_NEXT_PROVEN_PLUGIN_OR_SAFE_MANUAL_ROUTE'
  }),
  families:Object.freeze([
    'MEMORIA_CONHECIMENTO',
    'COMUNICACAO',
    'COMERCIAL',
    'CRIACAO',
    'ENGENHARIA',
    'PESQUISA_INTELIGENCIA',
    'DADOS_MEDICAO',
    'AUTOMACAO_ORQUESTRACAO'
  ]),
  queueRouting:Object.freeze({
    'social-insights':Object.freeze({angel:'ANJO 01 · PRISMA',families:Object.freeze(['PESQUISA_INTELIGENCIA','DADOS_MEDICAO','COMUNICACAO']),preferredPlugins:Object.freeze(['Metricool','Windsor.ai','vidIQ','Brand & Market Social Research']),mission:'qualificar sinais sociais e evidências'}),
    'creator-talent':Object.freeze({angel:'ANJO 02 · NEXO',families:Object.freeze(['PESQUISA_INTELIGENCIA','COMERCIAL','COMUNICACAO']),preferredPlugins:Object.freeze(['AI Vibe Prospecting','HubSpot','Google Contacts','Gmail']),mission:'conectar talento, marca, contexto e oportunidade'}),
    'pr':Object.freeze({angel:'ANJO 03 · VETOR',families:Object.freeze(['COMUNICACAO','PESQUISA_INTELIGENCIA','CRIACAO']),preferredPlugins:Object.freeze(['Brand & Market Social Research','Google Drive','Adobe','Canva']),mission:'transformar contexto em rota editorial executável'}),
    'connections':Object.freeze({angel:'ANJO 04 · FAROL',families:Object.freeze(['COMUNICACAO','MEMORIA_CONHECIMENTO','COMERCIAL']),preferredPlugins:Object.freeze(['Google Contacts','Gmail','Slack','HubSpot']),mission:'resolver relações, contatos, riscos e rotas humanas'}),
    'commercial':Object.freeze({angel:'ANJO 05 · ARCA',families:Object.freeze(['COMERCIAL','MEMORIA_CONHECIMENTO','DADOS_MEDICAO']),preferredPlugins:Object.freeze(['HubSpot','Google Drive','Gmail','Airtable']),mission:'preservar estado comercial e mover oportunidade com provenance'}),
    'prospecting':Object.freeze({angel:'ANJO 06 · PULSO',families:Object.freeze(['COMERCIAL','PESQUISA_INTELIGENCIA','AUTOMACAO_ORQUESTRACAO']),preferredPlugins:Object.freeze(['AI Vibe Prospecting','Exa','Firecrawl','HubSpot']),mission:'descobrir e qualificar novas rotas sem duplicar ativos'}),
    'mundo-products':Object.freeze({angel:'ANJO 07 · AURORA',families:Object.freeze(['CRIACAO','ENGENHARIA','AUTOMACAO_ORQUESTRACAO','MEMORIA_CONHECIMENTO']),preferredPlugins:Object.freeze(['Canva','Adobe','Figma','Google Drive','AppDeploy','Wix']),mission:'sintetizar capacidades e materializar entregáveis/produtos MUNDO'})
  }),
  areaRouting:Object.freeze({
    inicio:Object.freeze({capabilityFamilies:Object.freeze(['DADOS_MEDICAO','AUTOMACAO_ORQUESTRACAO','COMUNICACAO']),preferredPlugins:Object.freeze(['PostHog','Slack','Google Calendar','DIVA MCP'])}),
    radar:Object.freeze({capabilityFamilies:Object.freeze(['PESQUISA_INTELIGENCIA','DADOS_MEDICAO']),preferredPlugins:Object.freeze(['Brand & Market Social Research','Windsor.ai','Exa','Firecrawl'])}),
    social:Object.freeze({capabilityFamilies:Object.freeze(['PESQUISA_INTELIGENCIA','DADOS_MEDICAO','CRIACAO']),preferredPlugins:Object.freeze(['Windsor.ai','Metricool','vidIQ','Brand & Market Social Research','Adobe','Canva'])}),
    ideias:Object.freeze({capabilityFamilies:Object.freeze(['CRIACAO','PESQUISA_INTELIGENCIA','MEMORIA_CONHECIMENTO']),preferredPlugins:Object.freeze(['Canva','Adobe','Figma','Miro','Product Design'])}),
    contatos:Object.freeze({capabilityFamilies:Object.freeze(['COMERCIAL','COMUNICACAO','PESQUISA_INTELIGENCIA']),preferredPlugins:Object.freeze(['Google Contacts','HubSpot','AI Vibe Prospecting','Gmail'])}),
    pipeline:Object.freeze({capabilityFamilies:Object.freeze(['COMERCIAL','DADOS_MEDICAO','AUTOMACAO_ORQUESTRACAO']),preferredPlugins:Object.freeze(['HubSpot','Gmail','Google Drive','Airtable'])}),
    propostas:Object.freeze({capabilityFamilies:Object.freeze(['COMERCIAL','CRIACAO','MEMORIA_CONHECIMENTO','AUTOMACAO_ORQUESTRACAO']),preferredPlugins:Object.freeze(['Google Drive','Canva','Adobe','Figma','Gmail'])}),
    agenda:Object.freeze({capabilityFamilies:Object.freeze(['COMERCIAL','COMUNICACAO','AUTOMACAO_ORQUESTRACAO']),preferredPlugins:Object.freeze(['Google Calendar','Gmail','Slack','Make'])}),
    pr:Object.freeze({capabilityFamilies:Object.freeze(['COMUNICACAO','PESQUISA_INTELIGENCIA','CRIACAO']),preferredPlugins:Object.freeze(['Brand & Market Social Research','Google Drive','Adobe','Canva'])}),
    workspace:Object.freeze({capabilityFamilies:Object.freeze(['CRIACAO','COMUNICACAO','ENGENHARIA']),preferredPlugins:Object.freeze(['Google Drive','Canva','Adobe','Figma','AppDeploy'])}),
    explorer:Object.freeze({capabilityFamilies:Object.freeze(['MEMORIA_CONHECIMENTO','PESQUISA_INTELIGENCIA','DADOS_MEDICAO']),preferredPlugins:Object.freeze(['Google Drive','Notion','Exa','Firecrawl','Miro'])}),
    configuracoes:Object.freeze({capabilityFamilies:Object.freeze(['ENGENHARIA','AUTOMACAO_ORQUESTRACAO','DADOS_MEDICAO']),preferredPlugins:Object.freeze(['GitLab','GitHub','Wix','Vercel','Render','PostHog'])})
  }),
  systemRouting:Object.freeze({
    malha:Object.freeze({
      capabilityFamilies:Object.freeze(['AUTOMACAO_ORQUESTRACAO','COMUNICACAO','MEMORIA_CONHECIMENTO','ENGENHARIA']),
      role:'DISCOVER_MATCH_DISPATCH_SUPPORT',
      rule:'SELECT_CAPABILITY_BY_NEED_NOT_BY_VISUAL_PROMINENCE'
    })
  })
});

export function capabilityFabricSummary(){
  const classified=PLUGIN_CELL_CANDIDATES_V1.length;
  return Object.freeze({
    inventoryType:OS_PLUGIN_CAPABILITY_FABRIC.inventoryType,
    historicalInventory:OS_PLUGIN_CAPABILITY_FABRIC.historicalInventory,
    historicalPluginInventory:OS_PLUGIN_CAPABILITY_FABRIC.historicalPluginInventory,
    classified,
    unresolved:Math.max(0,OS_PLUGIN_CAPABILITY_FABRIC.historicalInventory-classified),
    families:OS_PLUGIN_CAPABILITY_FABRIC.families.length,
    areas:Object.keys(OS_PLUGIN_CAPABILITY_FABRIC.areaRouting).length,
    queues:Object.keys(OS_PLUGIN_CAPABILITY_FABRIC.queueRouting).length,
    buildStages:Object.keys(OS_PLUGIN_CAPABILITY_FABRIC.buildFabric.stages).length,
    operationStates:OS_PLUGIN_CAPABILITY_FABRIC.operationFabric.stateModel.length
  });
}
