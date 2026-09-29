import {OS_12_AREA_OPERATIONAL_MAP,OS_12_AREA_ROWS} from './os-12-area-operational-map';
export const OS_NAVIGATION_CONTRACT=Object.freeze({
  version:'2026-09-29.twelve-primary-areas-operational-order-v1',
  status:'wired_navigation_adapter',
  principle:'twelve-human-areas-propostas-primary-malha-diva-transversal-no-parallel-state',
  canonicalPages:OS_12_AREA_ROWS.map(row=>[row.id,row.label,row.route]),
  mobileNav:[...OS_12_AREA_ROWS.map(row=>[row.id,row.label,row.route]),['malha','Sala da Malha','/os/malha'],['diva','DIVA','/os/diva']],
  navigationGroups:OS_12_AREA_OPERATIONAL_MAP.menuGroups,
  mobileMore:[],
  legacyCapabilities:['malha','inicio','radar','pipeline','oportunidades','contatos','marcas','talentos','propostas','negociacoes','agenda','pendencias','kairos','diva','brain','conector','pr','social','tendencias','creators','calendario','war-room','financeiro','procurement','documentos','insights','personalizada','configuracoes','agentes','laboratorio-agentes','workspace','explorer','busca','ideias'],
  humanRouteMap:Object.fromEntries(OS_12_AREA_ROWS.map(row=>[row.id,row.route])),
  systemAreas:OS_12_AREA_OPERATIONAL_MAP.systemAreas,
  secondaryCapabilities:{
    oportunidades:'/os/oportunidades',
    marcas:'/os/marcas',
    talentos:'/os/talentos',
    negociacoes:'/os/negociacoes',
    emails:'/os/workspace?terminal=emails',
    mensagens:'/os/diva?area=Mensagens',
    planilhas:'/os/workspace?terminal=planilhas',
    arquivos:'/os/workspace?terminal=arquivos',
    agentes:'/os/agentes'
  },
  diva:{primaryArea:false,transversal:true,dedicatedRoutePreserved:true,globalAssistant:true,canonicalRoute:'/os/diva'},
  compatibility:{preserveLegacyDeepLinks:true,historyAndProvenancePreserved:true},
  mobile:{bottomDestinations:14,primaryAreasVisible:12,horizontalScroll:true,safeAreaRequired:true,touchTargetPx:44,responsiveProofRequired:true},
  pwa:{manifestDeferred:false,implemented:true,privacyFirst:true,startUrl:'/os/inicio',protectedNetworkOnly:['/os','/api','/auth'],offlineCache:['/offline.html','/manifest.webmanifest','/pwa-icon-180.png','/pwa-icon-192.png','/pwa-icon-512.png'],visualInstallProofRequired:true},
  wiring:{runtimeMutationAllowed:true,adapter:'CanonicalGlobalNavigation',primaryRoutes:[...OS_12_AREA_OPERATIONAL_MAP.order],nextGate:'authenticated-browser-regression-on-canonical-preview'},
  rules:[
    'The installed PWA is the Mundinho OS itself.',
    'Exactly twelve primary human surfaces are canonical and ordered by use: Início/Morada, Radar, Social Insights, Ideias, Contatos, Pipeline, Propostas, Agenda, PR, Workspace, Explorer/Alexandria and Configurações.',
    'Sala da Malha is a transversal system area at /os/malha and reuses MORADA_MALHA_ROOM; it is not a thirteenth business area and does not create parallel state.',
    'Navigation follows the human flow Morada → Observar → Criar → Comercial → Entregar → Conhecimento → Sistema; Social Insights é leitura social, Ideias é criação, Propostas e PR são áreas primárias próprias.',
    'Propostas is a governed primary commercial area at /os/propostas.',
    'PR is a primary area but a contextual optional branch; it is never mandatory for every commercial workflow.',
    'Alexandria holds a historical catalog of 198 plugins used both to build the OS and to operate it; cataloged does not mean connected, authorized or proven.'
    'Inteligência Viva reuses the existing Social Insights route and must consume evidence-backed live graphs, qualitative synthesis and daily feed sheets without rebuilding sources.',
    'Mundinho Social Insights is internal intelligence; client-safe applies only to Radar Gabi.',
    'No root surface may render decorative empty cards.',
    'Charts must be evidence-backed and interactive when the source supports it.',
    'History and provenance remain append-only.',
    'Functional system signals and intelligence use cobalt blue; pink is not the primary OS intelligence color.'
  ]
});
export const CANONICAL_OS_PAGE_IDS=OS_NAVIGATION_CONTRACT.canonicalPages.map(([id])=>id);
export const MOBILE_OS_DESTINATION_IDS=OS_NAVIGATION_CONTRACT.mobileNav.map(([id])=>id);
