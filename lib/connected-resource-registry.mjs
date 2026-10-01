export const CONNECTED_RESOURCE_REGISTRY_VERSION='connected-resource-registry-v1.1';

export const CONNECTED_RESOURCE_REGISTRY=Object.freeze({
  version:CONNECTED_RESOURCE_REGISTRY_VERSION,
  reconciledAt:'2026-09-27',
  rules:['PROVE_BEFORE_CONNECTED','AUTH_IS_NOT_CAPACITY','FREE_FIRST','NO_SECRET_STORAGE','NO_PRODUCTION_MUTATION','NO_ACCOUNT_IDENTITY_IN_PUBLIC_HEALTH'],
  resources:[
    {id:'google-drive-mundinho',kind:'STORAGE_DATA',status:'CONNECTED_PROVEN',costClass:'ALREADY_AVAILABLE',capabilities:['drive','docs','sheets','slides','store','retrieve','workspace'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-27',evidence:'Google Drive connector root access responded successfully in current session.'},
    {id:'gmail-mundinho',kind:'COMMUNICATION',status:'CONNECTED_PROVEN',costClass:'ALREADY_AVAILABLE',capabilities:['email','threads','attachments','email_search','email_read','email_action'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-27',evidence:'Gmail profile endpoint responded successfully for an authorized Mundinho account in current session.'},
    {id:'google-calendar-mundinho',kind:'TIME',status:'CONNECTED_PROVEN',costClass:'ALREADY_AVAILABLE',capabilities:['calendar','availability','events'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-27',evidence:'Google Calendar profile endpoint responded successfully in current session.'},
    {id:'google-contacts-mundinho',kind:'RELATIONSHIP_DATA',status:'CONNECTED_PROVEN',costClass:'ALREADY_AVAILABLE',capabilities:['contacts','identity-resolution','contacts_search','contact_read','directory'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-27',evidence:'Google Contacts profile endpoint responded successfully in current session.'},
    {id:'slack-mundinho',kind:'COMMUNICATION_ORCHESTRATION',status:'CONNECTED_PROVEN',costClass:'ALREADY_AVAILABLE',capabilities:['signals','missions','threads','agent-control-plane','channels','messages','coordination'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-27',evidence:'Canonical Malha channels accepted messages and returned receipts in current session.'},
    {id:'gitlab-mundinho',kind:'CODE_INFRA',status:'CONNECTED_PROVEN',costClass:'ALREADY_AVAILABLE',capabilities:['repo','merge-request','ci','issues','repository','commit','governance'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-27',evidence:'Sovereign project read/write and issue operations succeeded in current session.'},
    {id:'github-mundinho',kind:'CODE_INFRA',status:'CONNECTED_PROVEN',costClass:'ALREADY_AVAILABLE',capabilities:['repo','pull-request','issues','repository','search','code'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-27',evidence:'Authorized organization code search succeeded in current session.'},
    {id:'wix-mundinho',kind:'SITE_INFRA',status:'CONNECTED_PROVEN',costClass:'MIXED_FREE_AND_EXISTING',capabilities:['site','cms','headless','backend','domain','velo','business_apis','custom_embeds','developer_docs'],executionSurface:'WIX_CONNECTOR_API',lastVerifiedAt:'2026-09-27',evidence:'Wix site context, CMS and Custom Embed live reads succeeded in current session.'},
    {id:'render-mundinho',kind:'RUNTIME_INFRA',status:'CONNECTED_PROVEN',costClass:'EXISTING_FREE_AND_STARTER',capabilities:['deploy','preview','runtime','services','deploys','logs','metrics','release_bridge'],executionSurface:'RENDER_RUNTIME',lastVerifiedAt:'2026-09-27',evidence:'Workspace and live services/deploys read successfully in current session.'},

    {id:'huggingface-mundinho',kind:'AI_OPEN_MODELS',status:'CONNECTED_PROVEN_STALE',costClass:'FREE_ACCOUNT',capabilities:['model_discovery','open_models','jobs_read'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-20',evidence:'Previously authenticated; requires fresh proof before routing.'},
    {id:'make-mundinho',kind:'AUTOMATION',status:'CONNECTED_REPORTED_STALE',costClass:'UNKNOWN',capabilities:['scenario','scheduled_ingest'],executionSurface:'EXTERNAL_AUTOMATION',lastVerifiedAt:'2026-09-09',evidence:'Historical scenario registry only; current execution/auth not reproved in this session.'},
    {id:'werify-mundinho',kind:'WHATSAPP_ARCHIVE',status:'CONNECTED_REPORTED_STALE',costClass:'UNKNOWN',capabilities:['conversation_search','read'],executionSurface:'CHATGPT_CONNECTOR',lastVerifiedAt:'2026-09-09',evidence:'Historical plugin connection; current runtime must be reproved before routing.'},

    {id:'supabase-mundinho',kind:'DATA_INFRA',status:'CONNECTED_PROVEN',costClass:'EXISTING',capabilities:['database','auth','storage','edge','rls','vault'],executionSurface:'SUPABASE_RUNTIME',lastVerifiedAt:'2026-09-27',evidence:'Project diva-baileys-auth-qa ACTIVE_HEALTHY; Edge Function diva-baileys-vault ACTIVE; encrypted auth-state table present.'},
    {id:'figma',kind:'DESIGN',status:'CANDIDATE',costClass:'UNKNOWN',capabilities:['design','design_system']},
    {id:'canva',kind:'DESIGN',status:'CANDIDATE',costClass:'UNKNOWN',capabilities:['design','presentation','assets']},
    {id:'adobe',kind:'CREATIVE',status:'DISCOVERED',costClass:'UNKNOWN',capabilities:['creative_assets','pdf','image']},
    {id:'fal',kind:'GENERATIVE_MEDIA',status:'DISCOVERED',costClass:'UNKNOWN',capabilities:['image','video','audio','3d']},
    {id:'openai-provider',kind:'AI_PROVIDER',status:'CANDIDATE',costClass:'UNKNOWN',capabilities:['reasoning','code','synthesis']},
    {id:'gemini-provider',kind:'AI_PROVIDER',status:'CANDIDATE',costClass:'UNKNOWN',capabilities:['reasoning','research','multimodal']},
    {id:'anthropic-provider',kind:'AI_PROVIDER',status:'CANDIDATE',costClass:'UNKNOWN',capabilities:['reasoning','long_context','critique']},
    {id:'notebooklm-enterprise',kind:'KNOWLEDGE_SYNTHESIS',status:'DISCOVERED',costClass:'UNKNOWN',capabilities:['source_ingest','cross_source_synthesis']}
  ]
});

export function connectedResources(){
  return CONNECTED_RESOURCE_REGISTRY.resources.filter(r=>r.status==='CONNECTED_PROVEN');
}

export function routableFreeResources(){
  return CONNECTED_RESOURCE_REGISTRY.resources.filter(r=>r.status==='CONNECTED_PROVEN'&&['ALREADY_AVAILABLE','FREE_ACCOUNT'].includes(r.costClass));
}

export function resourceStateCounts(){
  return CONNECTED_RESOURCE_REGISTRY.resources.reduce((acc,row)=>{
    acc[row.status]=(acc[row.status]||0)+1;
    return acc;
  },{});
}
