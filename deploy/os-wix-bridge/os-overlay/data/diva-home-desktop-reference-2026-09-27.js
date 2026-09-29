export const DIVA_HOME_DESKTOP_REFERENCE_2026_09_27=Object.freeze({
  id:'diva-home-desktop-reference-2026-09-27',
  status:'REFERENCE_MOCKUP_NOT_CANONICAL_UI',
  provenance:Object.freeze({
    source:'DIVA Home (desktop)-html 2.zip',
    files:Object.freeze(['Main.dc.html','README.md','support.js','vendor/react.js','vendor/react-dom.js']),
    receivedAt:'2026-09-27',
    sourceDeclaration:'Design mockup exported as standalone page; replicate design decisions, do not copy runtime wholesale.'
  }),
  referenceOnly:true,
  productionCode:false,
  usefulPatterns:Object.freeze([
    'DIVA_FIRST_PLANE',
    'CENTRAL_INTELLIGENCE_HEADLINE',
    'VISIBLE_DIVA_OPERATIONAL_STATE',
    'SINGLE_MULTIMODAL_COMMAND_BAR',
    'TODAY_CONTEXT_FIRST',
    'OPERATIONAL_MODULES_BELOW_PRIMARY_INTENT',
    'CLEAR_MODULE_DESTINATIONS',
    'PILL_STATES_FOR_TRANSIENT_MODES',
    'LIGHT_SURFACES_WITH_HIGH_CONTRAST_INK',
    'EDITORIAL_SERIF_PLUS_FUNCTIONAL_SANS'
  ]),
  observedStructure:Object.freeze({
    viewportWidth:1440,
    canvasMinHeight:1080,
    outerPadding:'48px 72px 96px',
    headline:'Sua central de inteligência',
    states:Object.freeze(['Ocioso','Ouvindo','Pensando','Buscando','Executando','Concluído']),
    commandBar:Object.freeze(['text','voice','image','video','file','send']),
    modules:Object.freeze(['Hoje','Alexandria','E-mails','CRM / Follow-up','Propostas','Mensagens','Planilhas','Arquivos']),
    observedRoutes:Object.freeze(['/api/ai-bridge','/api/kairos/dashboard','/alexandria','/email-center','/crm','/commercial'])
  }),
  observedVisualTokens:Object.freeze({
    sourceCanvas:'#F3ECF3',
    sourceSurface:'#FFFFFF',
    sourceInk:'#18140F',
    sourcePinkAccent:'#C13868',
    sourceFonts:Object.freeze(['Fraunces','Work Sans']),
    sourceOrb:'pink radial gradient'
  }),
  canonReconciliation:Object.freeze({
    preserve:Object.freeze([
      'central DIVA presence',
      'single primary command surface',
      'operational-state visibility',
      'intent-first hierarchy',
      'editorial + functional typography contrast',
      'light surface hierarchy'
    ]),
    doNotPromote:Object.freeze([
      'pink/lilac canvas as global OS language',
      'pink accent as primary OS signal',
      'hardcoded mock operational data',
      'developer endpoint labels in client-safe production UI',
      'mock routes without verified destinations'
    ]),
    currentCanonWins:Object.freeze([
      'warm neutral paper background',
      'functional cobalt blue',
      'Georgia/Inter current OS typography unless separately approved',
      'twelve primary areas for Mundinho OS, including Propostas, Ideas and PR as sovereign surfaces',
      'DIVA avatar may retain pink as contextual identity mark'
    ])
  })
});
