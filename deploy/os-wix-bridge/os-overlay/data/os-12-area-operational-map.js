const meta=(decisionQuestion,inputs,outputs,commercialTouchpoints=[])=>Object.freeze({
  decisionQuestion,
  inputs:Object.freeze(inputs),
  outputs:Object.freeze(outputs),
  agents:Object.freeze(['DIVA','ANJOS']),
  orchestrator:'DIVA',
  provenance:'PANDORA',
  learning:'ATENEU',
  time:'KAIROS',
  execution:'RECEIVED_NE_EXECUTION_PROOF',
  commercialTouchpoints:Object.freeze(commercialTouchpoints)
});

export const OS_12_AREA_OPERATIONAL_MAP=Object.freeze({
  version:'2026-09-29.canonical-12-area-crosswalk-v1',
  authority:'LAST_HUMAN_APPROVED',
  governance:'DIVA_PANDORA_ATENEU',
  intelligenceModel:'DIVA_ANJOS_PANDORA_ATENEU',
  requestWindow:Object.freeze({
    timezone:'America/Sao_Paulo',
    from:'2026-09-28',
    through:'2026-09-29',
    rule:'RECENT_REQUESTS_ARE_METADATA_INPUTS_NOT_PARALLEL_TRUTH'
  }),
  order:Object.freeze(['inicio','radar','social','ideias','contatos','pipeline','propostas','agenda','pr','workspace','explorer','configuracoes']),
  workflow:Object.freeze({
    mode:'LINEAR_WITH_CONTEXTUAL_BRANCHES',
    start:'inicio',
    sequence:Object.freeze(['inicio','radar','social','ideias','contatos','pipeline','propostas','agenda','pr','workspace','explorer','configuracoes']),
    rule:'EVERY_AREA_CAN_HANDOFF_CONTEXT_TO_THE_NEXT_AREA_WITHOUT_CREATING_PARALLEL_STATE',
    optionalBranches:Object.freeze({
      pr:Object.freeze({required:false,trigger:'ONLY_WHEN_PR_ADHERENCE_EXISTS',skipTo:'workspace'}),
      workspace:Object.freeze({required:false,trigger:'ONLY_WHEN_DELIVERABLE_MATERIALIZATION_IS_NEEDED',skipTo:'explorer'})
    }),
    handoffs:Object.freeze({
      inicio:Object.freeze({next:'radar',reason:'começar pelo que mudou'}),
      radar:Object.freeze({next:'social',reason:'aprofundar sinal em evidência social'}),
      social:Object.freeze({next:'ideias',reason:'transformar evidência em hipótese/ideia'}),
      ideias:Object.freeze({next:'contatos',reason:'resolver pessoas, marcas e rotas reais'}),
      contatos:Object.freeze({next:'pipeline',reason:'materializar oportunidade e estado atual'}),
      pipeline:Object.freeze({next:'propostas',reason:'converter oportunidade contextualizada em proposta'}),
      propostas:Object.freeze({next:'agenda',reason:'agendar próximo movimento, retorno ou deadline'}),
      agenda:Object.freeze({next:'pr',reason:'ativar narrativa pública quando houver aderência'}),
      pr:Object.freeze({next:'workspace',reason:'materializar entregáveis e peças'}),
      workspace:Object.freeze({next:'explorer',reason:'preservar documentos, evidências e relações'}),
      explorer:Object.freeze({next:'configuracoes',reason:'auditar fontes, gaps e provenance'}),
      configuracoes:Object.freeze({next:'inicio',reason:'fechar ciclo e retornar à operação'})
    })
  }),
  menuGroups:Object.freeze([
    Object.freeze({id:'observar',label:'OBSERVAR',areas:Object.freeze(['radar','social'])}),
    Object.freeze({id:'criar',label:'CRIAR',areas:Object.freeze(['ideias'])}),
    Object.freeze({id:'comercial',label:'COMERCIAL',areas:Object.freeze(['contatos','pipeline','propostas','agenda'])}),
    Object.freeze({id:'entregar',label:'ENTREGAR',areas:Object.freeze(['pr','workspace'])}),
    Object.freeze({id:'conhecimento',label:'CONHECIMENTO',areas:Object.freeze(['explorer'])}),
    Object.freeze({id:'sistema',label:'SISTEMA',areas:Object.freeze(['configuracoes'])})
  ]),
  areas:Object.freeze({
    inicio:Object.freeze({
      order:1,label:'Início / Morada',route:'/os/inicio',group:'HOME',humanSurface:'MORADA_HUMAN_APPROVED_COPY',
      purpose:'Ver o que mudou, decidir onde agir e abrir a próxima frente.',
      endpoints:Object.freeze(['/api/live-projection','/api/intelligence-graphs','/api/os-morada-flow','/api/mundo-writeback']),
      related:Object.freeze(['/os/radar','/os/pipeline','/os/propostas','/os/malha']),
      metadata:meta(
        'O que mudou, o que exige decisão humana e qual é a próxima ação?',
        ['PULSOS','PIPELINE_STATE','KAIROS_WINDOWS','PANDORA_RECEIPTS','ATENEU_LEARNINGS'],
        ['PRIORITIES','NEXT_ACTIONS','BLOCKERS','DECISION_CONTEXT'],
        ['PIPELINE_VISIBILITY','FOLLOW_UP_VISIBILITY','DASHBOARD_UPDATE']
      )
    }),
    radar:Object.freeze({
      order:2,label:'Radar',route:'/os/radar',group:'OBSERVAR',
      purpose:'Ler mudança externa antes de promover sinal a oportunidade.',
      endpoints:Object.freeze(['/api/live-projection','/api/intelligence-graphs','/api/os-morada-flow']),
      related:Object.freeze(['/os/social','/os/ideias','/os/contatos','/os/pipeline','/os/malha']),
      metadata:meta(
        'Qual mudança externa é material e para qual frente ela deve circular?',
        ['MARKET_SIGNALS','CULTURAL_SIGNALS','PUBLIC_EVIDENCE','SOCIAL_EVIDENCE','KAIROS'],
        ['QUALIFIED_SIGNAL','OPPORTUNITY_CANDIDATE','ROUTING_HINT'],
        ['PROSPECTING_TRIGGER','BRAND_CATEGORY_SIGNAL']
      )
    }),
    social:Object.freeze({
      order:3,label:'Social Insights',route:'/os/social',group:'OBSERVAR',
      purpose:'Separar conteúdo, comportamento, curva e leitura antes de aplicação.',
      endpoints:Object.freeze(['/api/social-insights-live','/api/intelligence-graphs','/api/os-morada-flow']),
      related:Object.freeze(['/os/radar','/os/ideias','/os/propostas','/os/pr','/os/malha']),
      metadata:meta(
        'Que comportamento ou prova social sustenta uma hipótese comercial ou criativa?',
        ['SOCIAL_CONTENT','AUDIENCE_BEHAVIOR','TREND_CURVES','COMMENTS','CREATORS','PLATFORM_SOURCE'],
        ['EVIDENCE_BACKED_INSIGHT','CREATIVE_INPUT','COMMERCIAL_PROOF','TALENT_BRAND_FIT'],
        ['PROPOSAL_EVIDENCE','TALENT_BRAND_FIT']
      )
    }),
    ideias:Object.freeze({
      order:4,label:'Ideias',route:'/os/ideias',group:'CRIAR',
      purpose:'Transformar inteligência já digerida em hipótese testável e ação.',
      endpoints:Object.freeze(['/api/idea-auto-feed','/api/creative-hive','/api/os-morada-flow','/api/mundo-writeback']),
      related:Object.freeze(['/os/social','/os/radar','/os/propostas','/os/pr','/os/workspace','/os/malha']),
      metadata:meta(
        'Qual hipótese merece virar mecanismo, ideia, proposta ou teste?',
        ['RADAR_SIGNAL','SOCIAL_INSIGHT','COMMERCIAL_CONTEXT','ATENEU_LEARNING'],
        ['TESTABLE_IDEA','CONCEPT','PROPOSAL_INPUT','PR_ANGLE'],
        ['COMMERCIAL_IDEA','PROPOSAL_CONCEPT','CATEGORY_ALTERNATIVES']
      )
    }),
    contatos:Object.freeze({
      order:5,label:'Contatos',route:'/os/contatos',group:'COMERCIAL',
      purpose:'Resolver entidade, relação, canal, histórico e rota humana antes do outreach.',
      endpoints:Object.freeze(['/api/contacts','/api/mundo-writeback','/api/os-morada-flow']),
      related:Object.freeze(['/os/pipeline','/os/propostas','/os/explorer','/os/malha']),
      metadata:meta(
        'Quem é a entidade, qual é a relação atual e qual rota humana legítima existe?',
        ['CONTACTS','RELATIONSHIPS','MESSAGE_HISTORY','PROVENANCE','ENTITY_RESOLUTION'],
        ['RESOLVED_ENTITY','CONTACT_ROUTE','RELATIONSHIP_STATE','NEXT_CHANNEL'],
        ['NEW_CONTACT','WHO_REPLIED','ACTIVE_RELATIONSHIP','ROUTE_BEFORE_OUTREACH']
      )
    }),
    pipeline:Object.freeze({
      order:6,label:'Pipeline',route:'/os/pipeline',group:'COMERCIAL',
      purpose:'Mover oportunidade pelo último estado comprovado com próxima ação, prazo e evidência.',
      endpoints:Object.freeze(['/api/live-projection','/api/mundo-writeback','/api/contacts','/api/os-morada-flow']),
      related:Object.freeze(['/os/contatos','/os/agenda','/os/propostas','/os/malha']),
      metadata:meta(
        'Qual é o último estado comprovado desta oportunidade e o que precisa acontecer agora?',
        ['COMMERCIAL_EVENTS','CONTACT_STATE','PROPOSALS','NEGOTIATIONS','PANDORA_RECEIPTS'],
        ['CURRENT_STATE','NEXT_ACTION','OWNER','DEADLINE','STAGE_CHANGE'],
        ['PROPOSAL_CREATED','PROPOSAL_SENT','NEGOTIATION_OPEN','MATERIAL_PENDING','STAGE_CHANGE']
      )
    }),
    propostas:Object.freeze({
      order:7,label:'Propostas',route:'/os/propostas',group:'COMERCIAL',
      purpose:'Recuperar contexto comercial, histórico e master antes de gerar, aprovar, materializar e empacotar uma proposta.',
      endpoints:Object.freeze(['/api/os-morada-flow','/api/mundo-ingest','/api/mundo-writeback']),
      related:Object.freeze(['/os/pipeline','/os/ideias','/os/workspace','/os/social','/os/malha']),
      metadata:meta(
        'Qual proposta deve existir para esta oportunidade, com qual contexto, master, evidência e estado de aprovação?',
        ['PIPELINE_CONTEXT','CRM_HISTORY','PROPOSAL_HISTORY','MASTER','VISUAL_MEMORY','RADAR/SOCIAL_INSIGHTS'],
        ['DRAFT_GENERATED','APPROVED','SCANNER_PASS','MATERIALIZED','PACKAGED'],
        ['PROPOSAL_CREATED','PROPOSAL_SENT','PROPOSAL_APPROVED','PROPOSAL_PACKAGED']
      )
    }),
    agenda:Object.freeze({
      order:8,label:'Agenda',route:'/os/agenda',group:'COMERCIAL',
      purpose:'Operar KAIROS comercial: follow-up, janela crítica, canal e consequência.',
      endpoints:Object.freeze(['/api/live-projection','/api/mundo-writeback']),
      related:Object.freeze(['/os/pipeline','/os/contatos','/os/malha']),
      metadata:meta(
        'Quando agir, por qual canal e qual consequência existe se perdermos a janela?',
        ['PIPELINE_NEXT_ACTIONS','FOLLOW_UPS','MEETINGS','KAIROS_WINDOWS'],
        ['FOLLOW_UP_QUEUE','DEADLINES','REMINDERS','TIMING_RISK'],
        ['AWAITING_RETURN','FOLLOW_UP_NEEDED','SEVEN_DAY_DEFAULT_WHEN_APPLICABLE']
      )
    }),
    pr:Object.freeze({
      order:9,label:'PR',route:'/os/pr',group:'ENTREGAR',
      purpose:'Converter contexto em ângulo editorial, clipping, rota de imprensa e ação.',
      endpoints:Object.freeze(['/api/live-projection','/api/os-morada-flow','/api/mundo-writeback']),
      related:Object.freeze(['/os/social','/os/radar','/os/ideias','/os/workspace','/os/malha']),
      metadata:meta(
        'Que narrativa pública é sustentada por evidência e qual rota editorial existe?',
        ['PIPELINE_CONTEXT','SOCIAL_EVIDENCE','RADAR_SIGNAL','MEDIA_RELATIONS','CLIPPING'],
        ['PR_ANGLE','PITCH_INPUT','CLIPPING_CONTEXT','MEDIA_ROUTE'],
        ['REPUTATION_EVIDENCE','COMMERCIAL_TO_PR_HANDOFF']
      )
    }),
    workspace:Object.freeze({
      order:10,label:'Workspace',route:'/os/workspace',group:'ENTREGAR',
      purpose:'Executar entregáveis e abrir ferramentas sem criar uma nova fonte de verdade.',
      endpoints:Object.freeze(['/api/mundo-writeback','/api/os-morada-flow','GOOGLE_DRIVE']),
      related:Object.freeze(['/os/pr','/os/ideias','/os/propostas','/os/malha']),
      metadata:meta(
        'Qual entregável precisa ser produzido a partir do estado canônico existente?',
        ['APPROVED_CONTEXT','PROPOSAL_CONTEXT','PR_CONTEXT','FILES','TEMPLATES'],
        ['DELIVERABLE','DRAFT','MATERIAL','FILE_REFERENCE'],
        ['PROPOSAL_MATERIAL','PENDING_MATERIAL','CANVA_ADOBE_HANDOFF']
      )
    }),
    explorer:Object.freeze({
      order:11,label:'Explorer',route:'/os/explorer',group:'CONHECIMENTO',
      purpose:'Investigar evidência, relação, memória e provenance antes de promover hipótese.',
      endpoints:Object.freeze(['/api/contacts','/api/os-morada-flow','/api/mundo-writeback']),
      related:Object.freeze(['/os/contatos','/os/pipeline','/os/busca','/os/malha']),
      metadata:meta(
        'Que evidência existe, de onde veio e o que ainda é lacuna antes de decidir?',
        ['PANDORA_PROVENANCE','ALEXANDRIA','FILES','RELATIONS','EVENT_HISTORY'],
        ['EVIDENCE_GRAPH','GAPS','SOURCE_CHAIN','CONTEXT_PACK'],
        ['ENTITY_RESEARCH','COMMERCIAL_HISTORY','RELATIONSHIP_EVIDENCE']
      )
    }),
    configuracoes:Object.freeze({
      order:12,label:'Configurações',route:'/os/configuracoes',group:'SISTEMA',
      purpose:'Ler saúde, integrações, permissões, versões, receipts e QA.',
      endpoints:Object.freeze(['/api/resource-mesh','/api/diva-health','/api/os-implementation-receipt']),
      related:Object.freeze(['/os/agentes','/os/diva','/os/malha']),
      metadata:meta(
        'O corpo está saudável, autorizado, verificável e sem regressão?',
        ['HEALTH','CAPABILITIES','AUTHORITY','VERSION','QA','RECEIPTS'],
        ['HEALTH_STATE','CAPABILITY_STATE','AUTHORITY_STATE','QA_GATE','RELEASE_EVIDENCE'],
        ['INTEGRATION_HEALTH','WRITEBACK_REREAD_STATUS']
      )
    })
  }),
  systemAreas:Object.freeze({
    malha:Object.freeze({
      id:'malha',
      label:'Sala da Malha',
      route:'/os/malha',
      primaryArea:false,
      transversal:true,
      support:true,
      supportModes:Object.freeze(['ASK','SYNC','HELP','SYNC_AND_HELP']),
      supportsAreas:Object.freeze(['inicio','radar','social','ideias','contatos','pipeline','propostas','agenda','pr','workspace','explorer','configuracoes']),
      supportRule:'SALA_DA_MALHA_SUPPORTS_ANY_PRIMARY_AREA_WITHOUT_CREATING_PARALLEL_STATE',
      transport:'MORADA_MALHA_ROOM',
      orchestrator:'DIVA',
      executors:Object.freeze(['ANJOS','CAPABILITY_MATCHED_AGENTS']),
      provenance:'PANDORA',
      learning:'ATENEU',
      time:'KAIROS',
      authority:'requireMoradaOwner()',
      executionSemantics:'RECEIVED_NE_EXECUTION_PROOF',
      cycle:Object.freeze(['REQUEST','ROUTE','RECEIVED','EXECUTE','RESULT','PANDORA_RECEIPT','ATENEU_LEARNING','REREAD'])
    })
  }),
  secondaryCapabilities:Object.freeze({}),
  commercialFlow:Object.freeze([
    'RADAR_SIGNAL',
    'SOCIAL_EVIDENCE',
    'IDEA_OR_HYPOTHESIS',
    'ENTITY_RESOLUTION',
    'CONTACT_ROUTE',
    'PIPELINE_OPPORTUNITY',
    'FOLLOW_UP',
    'PROPOSAL_OR_NEGOTIATION',
    'RESULT',
    'WRITEBACK_REREAD_LEARNING'
  ]),
  johnnyCommercialRules:Object.freeze([
    'RECONCILE_BEFORE_CREATE',
    'ROUTE_RESOLVE_BEFORE_OUTREACH',
    'DO_NOT_REPROSPECT_ACTIVE_CONTACT',
    'HUMAN_RESPONSE_BEATS_COLD_PROSPECTING',
    'MATERIAL_REQUESTED_IS_HOT',
    'PROPOSAL_REQUESTED_IS_HOT',
    'EMAIL_SENT_DOES_NOT_CLOSE_OTHER_CHANNELS',
    'RESPONSE_IS_NOT_PROPOSAL',
    'PROPOSAL_IS_NOT_NEGOTIATION',
    'SENT_IS_NOT_CLOSED',
    'FOLLOW_UP_DEFAULT_SEVEN_DAYS_WHEN_APPLICABLE',
    'PROVENANCE_REQUIRED'
  ]),
  johnnyCommercialRequests:Object.freeze([
    'DASHBOARD_RESPONSE_AND_FOLLOWUP_VISIBILITY',
    'SHOW_LAST_INTERACTIONS',
    'SHOW_NEW_CONTACTS',
    'SHOW_STAGE_CHANGES',
    'SHOW_PENDING_MATERIALS',
    'INGEST_NEW_CONTACT_EVENT',
    'INGEST_PROPOSAL_CREATED_OR_SENT_EVENT',
    'INGEST_FOLLOW_UP_NEEDED_EVENT',
    'INGEST_NEGOTIATION_OPEN_EVENT',
    'AUTO_NEXT_ACTION_OWNER_DASHBOARD_UPDATE',
    'CONNECT_CULTURE_INSIGHT_TALENT_BRAND_CATEGORY_IDEA_ROUTE_PROSPECTING_ACTION',
    'PRESERVE_UMBRELLA_CONCEPT_AND_ALTERNATIVE_BRAND_CATEGORY_ROUTES'
  ]),
  johnnyRecentCommercialActivity:Object.freeze([
    Object.freeze({brand:'Adaptogen Science',occurredAt:'2026-09-28T10:55:35-03:00',event:'PROPOSAL_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e84cb44979815',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda','workspace'])}),
    Object.freeze({brand:'Baggio Café',occurredAt:'2026-09-28T11:04:00-03:00',event:'PROPOSAL_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e854688b13dd2',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda','workspace'])}),
    Object.freeze({brand:'Authentic Beauty Concept',occurredAt:'2026-09-28T11:49:45-03:00',event:'PROPOSAL_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e87e4ecb0500a',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda','workspace'])}),
    Object.freeze({brand:'Açaí da Barra',occurredAt:'2026-09-28T12:07:45-03:00',event:'PROPOSAL_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e88ec78f338a3',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda','workspace'])}),
    Object.freeze({brand:'Klauterre',occurredAt:'2026-09-28T12:23:03-03:00',event:'PROPOSAL_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e89cd211c564c',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda','workspace'])}),
    Object.freeze({brand:'Authentic Beauty Concept',occurredAt:'2026-09-28T12:43:57-03:00',event:'CONTACT_ROUTE_ADVANCED',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e8afed2d5cd6f',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda'])}),
    Object.freeze({brand:'Avène',occurredAt:'2026-09-28T12:47:48-03:00',event:'PROPOSAL_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e8b372791ca55',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda','workspace'])}),
    Object.freeze({brand:'Amo Beleza',occurredAt:'2026-09-28T17:57:05-03:00',event:'PROPOSAL_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e9ce9850e1aef',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda','workspace'])}),
    Object.freeze({brand:'Fluency',occurredAt:'2026-09-28T18:11:55-03:00',event:'FOLLOW_UP_SENT',owner:'JOHNNY',talent:'Gabriella Saraivah',source:'GMAIL',sourceRef:'1a0e9dc2cfebe512',provenance:'PANDORA_CANDIDATE',areas:Object.freeze(['contatos','pipeline','agenda'])})
  ]),
  recentRequestCrosswalk:Object.freeze([
    Object.freeze({
      id:'REQ-20260929-OS-INTELLIGENT-VERSION',
      source:'HUMAN',
      summary:'Subir versão inteligente do OS cruzando pedidos recentes, 12 áreas, metadados e Sala da Malha.',
      areas:Object.freeze(['inicio','radar','social','ideias','contatos','pipeline','propostas','agenda','pr','workspace','explorer','configuracoes']),
      systemAreas:Object.freeze(['malha']),
      actors:Object.freeze(['DIVA','ANJOS','PANDORA','ATENEU']),
      status:'MAPPED_TO_RUNTIME_METADATA'
    }),
    Object.freeze({
      id:'REQ-20260929-JOHNNY-COMMERCIAL',
      source:'JOHNNY_COMMERCIAL',
      summary:'Consolidar pedidos comerciais recentes em visibilidade, eventos, próxima ação e cruzamento cultura→insight→talento→marca/categoria→ideia→rota→prospecção.',
      areas:Object.freeze(['radar','social','ideias','contatos','pipeline','agenda','workspace','explorer']),
      systemAreas:Object.freeze(['malha']),
      actors:Object.freeze(['DIVA','ANJOS','PANDORA','ATENEU']),
      status:'MAPPED_TO_COMMERCIAL_METADATA'
    }),
    Object.freeze({
      id:'REQ-20260929-SALA-MALHA',
      source:'HUMAN',
      summary:'Sala da Malha conectada ao OS e Morada como transporte/orquestração, sem criar estado paralelo.',
      areas:Object.freeze(['inicio','configuracoes']),
      systemAreas:Object.freeze(['malha']),
      actors:Object.freeze(['DIVA','ANJOS','PANDORA','ATENEU']),
      status:'TRANSVERSAL_SYSTEM_AREA'
    }),
    Object.freeze({
      id:'REQ-20260929-MORADA-PRESERVE-HUMAN-UI',
      source:'HUMAN',
      summary:'Preservar interface humana aprovada da Morada; novas assimilações ficam em memória/runtime.',
      areas:Object.freeze(['workspace','configuracoes']),
      systemAreas:Object.freeze(['malha']),
      actors:Object.freeze(['DIVA','PANDORA']),
      status:'PRESERVATION_GUARD'
    }),
    Object.freeze({
      id:'REQ-20260929-BODY-CIRCULATION',
      source:'HUMAN',
      summary:'Conectar MUNDO, Morada, DIVA, Malha, ORBIs, OS, satélites e agentes sem reabrir arquitetura.',
      areas:Object.freeze(['inicio','configuracoes','explorer']),
      systemAreas:Object.freeze(['malha']),
      actors:Object.freeze(['DIVA','ANJOS','PANDORA','ATENEU']),
      status:'CIRCULATION_METADATA'
    })
  ])
});

export const OS_12_AREA_ORDER=OS_12_AREA_OPERATIONAL_MAP.order;
export const OS_12_AREA_ROWS=OS_12_AREA_ORDER.map(id=>Object.freeze({id,...OS_12_AREA_OPERATIONAL_MAP.areas[id]}));
// Compatibility aliases: old import names now resolve to the 12-area canon.
export const OS_11_AREA_OPERATIONAL_MAP=OS_12_AREA_OPERATIONAL_MAP;
export const OS_11_AREA_ORDER=OS_12_AREA_ORDER;
export const OS_11_AREA_ROWS=OS_12_AREA_ROWS;
