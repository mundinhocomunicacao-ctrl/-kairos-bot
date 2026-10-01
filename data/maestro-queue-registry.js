const queue=(id,label,agents,metrics,nextAction)=>Object.freeze({id,label,provisioning:'INDEPENDENT',clean:true,status:'PROVISIONED_CLEAN',blocker:null,nextAction,agents:Object.freeze(agents),metrics:Object.freeze(metrics),entryRules:Object.freeze(['material evidence or explicit governed mission','dedupe before activation','provenance required']),exitRules:Object.freeze(['next movement explicit','receipt attached when action occurs']),sla:'queue-owned'});

export const MAESTRO_QUEUE_REGISTRY=Object.freeze({
  version:'2026-09-25.canonical-7-v2',owner:'MAESTRO',reportsTo:'DIVA',canonicalBase:'Comercial/Base Comercial Única + entidades centrais MUNDO',queueCount:7,
  rules:Object.freeze({provisioningPerQueue:'INDEPENDENT',sharedProvisioning:false,appendOnlyHistory:true,noDuplicateActiveMission:true,blockedQueueDoesNotBlockOthers:true,cleanMeans:'no duplicated active mission, no superseded attempt in active lane, one explicit next action',runtimeClaimRequiresReceipt:true}),
  transversalCapabilities:Object.freeze(['release','radar','sanitation']),
  queues:Object.freeze([
    queue('social-insights','Social Insights',['maestro','kairos','conector','pandora'],['fresh signals','promoted insights','evidence coverage'],'PULL_AND_VALIDATE_SOCIAL_SIGNALS'),
    queue('creator-talent','Creator · Talento',['maestro','conector','curador','pandora'],['talent opportunities','matches','response evidence'],'MATCH_TALENT_WITH_CURRENT_OPPORTUNITY'),
    queue('pr','PR',['maestro','conector','curador','pandora'],['press opportunities','routes','placements'],'ADVANCE_EVIDENCE_BACKED_PR_ROUTE'),
    queue('connections','Conexões',['maestro','fofoqueiro','contact-preservation-agent','pandora'],['validated routes','resolved contacts','orphan contexts'],'RESOLVE_RELATION_AND_ROUTE_CONTEXT'),
    queue('commercial','Comercial',['maestro','conector','curador','pandora'],['active opportunities','follow-ups due','conversion'],'PULL_CURRENT_MATERIALIZED_COMMERCIAL_OPPORTUNITIES'),
    queue('prospecting','Prospecção',['maestro','conector','curador','pandora'],['qualified prospects','dedupe rate','routes found'],'QUALIFY_AND_ROUTE_NEW_PROSPECTS'),
    queue('mundo-products','Produtos MUNDO',['maestro','conector','provador','pandora'],['product opportunities','validated offers','learning receipts'],'ADVANCE_VALIDATED_MUNDO_PRODUCT_MISSIONS')
  ])
});
export function activeMaestroQueue(id){return MAESTRO_QUEUE_REGISTRY.queues.find(q=>q.id===id)||null;}
export function maestroQueueSummary(){const queues=MAESTRO_QUEUE_REGISTRY.queues;return Object.freeze({total:queues.length,blocked:queues.filter(q=>q.status==='BLOCKED_EXTERNAL').length,clean:queues.filter(q=>q.clean).length,activeBlockers:queues.filter(q=>q.blocker).map(q=>({id:q.id,blocker:q.blocker,nextAction:q.nextAction}))});}
