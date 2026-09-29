export const OS_VISUAL_REFERENCE_MANIFEST=Object.freeze({
  version:'2026-09-26.visual-reference-manifest-v1',
  status:'QA_REFERENCE_SET_COMPLETE',
  canonicalRoot:'Mundinho Comunicação',
  product:'Mundinho OS',
  primaryAreas:['Início / Morada','Radar','Social Insights','Ideias','Contatos','Pipeline','Propostas','Agenda','PR','Workspace','Explorer / Alexandria','Configurações'],
  visualPrinciples:[
    'warm neutral paper background',
    'rounded white left navigation rail',
    'editorial serif + clean sans',
    'functional cobalt blue',
    'DIVA as a living visual presence',
    'dense first viewport with useful information',
    'no empty cards or filler modules',
    'no black media placeholders',
    'no excessive whitespace',
    'twelve primary areas plus transversal DIVA',
    'navigation follows Início → Observar → Criar → Comercial → Entregar → Conhecimento → Sistema',
    'DIVA may use contextual pink while functional system signals remain cobalt blue'
  ],
  figma:{
    role:'editable source of truth',
    fileName:'Mundinho OS · Design Canônico · 2026-09-26',
    fileKey:'eCTL14DEWK2x24f20nSliI',
    state:'FILE_CREATED_CANVAS_WRITE_BLOCKED',
    blocker:'Figma MCP Starter plan tool-call limit'
  },
  adobe:{
    role:'visual exploration and polish',
    boardId:'urn:aaid:sc:US:82080284-8f29-445e-ac4e-a7fd816098e9',
    boardState:'ADD_ITEMS_BLOCKED_504',
    references:{
      Mesa:{
        outputUrl:'https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:c4256822-f38f-4113-b410-899937e0acc4',
        requestId:'0b49e9ca-8cba-4825-91b0-c235dcc3a978',
        state:'GENERATED_PREVIEWED'
      },
      Radar:{
        outputUrl:'https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:e85b0879-0870-4c58-b318-a2a16b3e8b41',
        requestId:'3c47de3d-de85-48ac-8652-119e10a06430',
        state:'GENERATED_PREVIEWED'
      },
      'CRM & Relações':{
        outputUrl:'https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:ff3b46bd-7a7e-4e86-a43d-6c2d17c99708',
        requestId:'e11cf545-188c-4914-b351-f144a5e4ff22',
        state:'GENERATED_PREVIEWED'
      },
      'Social Insights':{
        outputUrl:'https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:adcea045-c305-49fd-8417-e6898f43d6b5',
        state:'GENERATED_PREVIEWED'
      },
      Propostas:{
        outputUrl:'https://photoshop-api.adobe.io/v2/short-url/urn:aaid:ps:US:f22a8f57-7376-47bb-a56a-1316d68b021a',
        state:'GENERATED_PREVIEWED'
      }
    }
  },
  miro:{
    role:'flow and architecture',
    state:'NO_EXISTING_MUNDINHO_OS_BOARD',
    rule:'do not create a new board without explicit human confirmation'
  },
  externalProviders:{
    Claude:{desiredRole:'copy and verbal architecture',state:'NO_OPERATIONAL_ROUTE_FOUND'},
    DeepSeek:{desiredRole:'visual exploration',state:'NO_OPERATIONAL_ROUTE_FOUND'},
    Qwen:{desiredRole:'visual exploration',state:'NO_OPERATIONAL_ROUTE_FOUND'},
    Kimi:{desiredRole:'visual exploration',state:'NO_OPERATIONAL_ROUTE_FOUND'}
  },
  handoffRule:'Use this manifest as reference provenance only. Do not render Adobe mockups directly in production. Convert approved visual decisions into editable Figma/components, then validate against the twelve-area runtime with Ideas as a primary creation surface and transversal DIVA.'
});
