import {MUNDO_WEB_BRAND,MUNDO_WEB_BRAND_VERSION} from './web-brand-kit';

export const OS_DESIGN_SYSTEM_VERSION=`mundo-mineral-cobalt-v2-2026-09-27`;

export const OS_VISUAL_RESEARCH={
  source:'MUNDO OS · HOME SHELL MORADA + Radar da Gabi reference · 27/09/2026',
  referenceUrl:'https://www.especialistabrandingeinfluencia.com/c%C3%B3pia-sobre-mim',
  references:MUNDO_WEB_BRAND.research.sampleSize,
  territories:MUNDO_WEB_BRAND.territories,
  synthesis:{
    composition:'grandes blocos editoriais com muito respiro, conteúdo primeiro e decoração reduzida',
    typography:'sans pesada para manchetes + sans operacional para leitura contínua',
    surfaces:'branco quase puro sobre canvas neutro muito leve, bordas suaves e elevação mínima',
    signal:'azul funcional como acento operacional; preto profundo como ação primária',
    navigation:'grupos de navegação em cápsulas claras com estado ativo escuro',
    intelligence:'DIVA integrada ao sistema sem competir com a informação principal',
    grammar:'todas as superfícies usam a mesma sequência visual: contexto → evidência → leitura → ação → aprofundamento'
  }
};

export const OS_VISUAL_DIRECTION={
  name:'MUNDO OS · Morada smart-home grammar + Radar data grammar',
  intent:'Aplicar ao OS a gramática de home inteligente da Morada da DIVA — presença, contexto, ação e continuidade — usando a paleta soberana do OS; para superfícies de dados, preservar a gramática evidence-first do Radar da Gabi.',
  corporateBridge:MUNDO_WEB_BRAND.corporateBridge,
  referenceUrl:'https://radar.gabi.mundinhocomunicacao.com/',
  principles:[
    'doze áreas primárias em ordem de uso: Início/Morada, Radar, Social Insights, Ideias, Contatos, Pipeline, Propostas, Agenda, PR, Workspace, Explorer/Alexandria e Configurações; DIVA permanece transversal e capacidades especializadas ficam contextuais',
    'rosa não é linguagem sistêmica: fica reservado ao ORBI/DIVA e seus estados de presença; o restante do OS usa neutros quentes + azul funcional',
    'pipeline verde não substitui aprovação visual',
    'a Morada da DIVA é a referência ativa para estrutura de home, presença e fluxo; Radar Gabi permanece referência para leitura de dados e evidência',
    'fundo branco com nuance neutra muito leve e superfícies brancas',
    'manchetes grandes em sans pesada com contraste forte',
    'azul funcional como acento editorial e de inteligência',
    'preto profundo para estados ativos e ações primárias',
    'homes estruturadas em faixas editoriais, relações e estados; cards só quando a entidade exige contenção explícita',
    'navegação em cápsulas quando houver agrupamento de áreas ou estados',
    'muito respiro e baixa densidade decorativa',
    'DIVA integrada sem transformar a interface em painel técnico',
    'a lógica, os dados e a arquitetura do OS não mudam com a camada visual',
    'produção só muda após comparação visual humana com a referência',
    'Mesa, Radar, CRM & Relações, Social Insights, Propostas e superfícies secundárias compartilham a mesma gramática visual',
    'mudança de área muda o conteúdo e a ação, nunca a lógica visual fundamental',
    'todo bloco deve ter função de leitura, evidência, decisão, ação ou aprofundamento; bloco decorativo ou repetido deve ser removido',
    'gráficos sempre mostram contexto e consequência; nunca aparecem como decoração isolada',
    'cards sem próximo passo, evidência ou aprofundamento não são superfícies válidas do OS',
    'cada endpoint do runtime deve ter uma home humana correspondente; endpoint técnico nunca é a arquitetura visível'
  ],
  palette:{
    ...MUNDO_WEB_BRAND.palette,
    paper:'#F4F0E8',
    surface:'#FFFFFF',
    ink:'#111111',
    muted:'#626873',
    line:'#D9DEE7',
    signal:'#175CFF',
    intelligence:'#0B8F87',
    success:'#248A67',
    warning:'#B97818',
    danger:'#C74C57'
  },
  typography:{
    ...MUNDO_WEB_BRAND.typography,
    display:'Georgia, "Times New Roman", serif',
    interface:'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    activeDisplay:'Georgia, "Times New Roman", serif',
    activeInterface:'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  imagePolicy:{...MUNDO_WEB_BRAND.imagePolicy,thirdPartyLogos:'forbidden',brandMarks:'text-only',approvedReference:'Gabi Resultados · Mundinho OS'}
};

export const OS_GLOBAL_THEME_CSS=`
:root{
 --mundo-paper:#F4F0E8;--mundo-paper-bright:#FFFFFF;--mundo-surface:#FFFFFF;--mundo-surface-soft:#ECEFF4;
 --mundo-ink:#111111;--mundo-graphite:#292724;--mundo-muted:#626873;--mundo-line:#D9DEE7;--mundo-line-strong:#C6CEDA;
 --mundo-signal:#175CFF;--mundo-signal-soft:#EAF0FF;--mundo-intelligence:#0B8F87;--mundo-acid:#EAF1FF;
 --mundo-success:#248A67;--mundo-warning:#B97818;--mundo-danger:#C74C57;
 --mundo-display:Georgia,"Times New Roman",serif;--mundo-ui:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
 --mundo-mono:"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
 --mundo-radius-sm:12px;--mundo-radius-md:18px;--mundo-radius-lg:24px;
 --mundo-shadow:0 22px 60px rgba(38,34,28,.09);--mundo-shadow-soft:0 10px 26px rgba(38,34,28,.055)
}
*{box-sizing:border-box}
html{background:var(--mundo-paper)!important}
body{margin:0;background:
 radial-gradient(circle at 12% -8%,rgba(255,255,255,.96),transparent 34%),
 linear-gradient(180deg,#FAFBFD 0%,var(--mundo-paper) 100%)!important;color:var(--mundo-ink)!important;
 font-family:var(--mundo-ui)!important;letter-spacing:-.008em}
a{color:inherit}::selection{background:var(--mundo-signal-soft);color:var(--mundo-ink)}
.main,.page,.canonicalHub,.brainMain,.homeDesk,.radarPage,.pipe,.contacts,.workspaceLive{
 width:min(100%,1640px)!important;max-width:none!important;margin:0 auto!important;
 padding-left:clamp(20px,3.8vw,64px)!important;padding-right:clamp(20px,3.8vw,64px)!important
}
h1,h2,.editorialTitle,.hero h1,.headline h1,.top h1,.canonicalHub h1,.editorialHero h1{
 font-family:var(--mundo-display)!important;color:var(--mundo-ink)!important;font-weight:400!important;letter-spacing:-.045em!important
}
.hero h1,.headline h1,.canonicalHub h1,.editorialHero h1{font-size:clamp(58px,7vw,108px)!important;line-height:.88!important}
h3{letter-spacing:-.025em}p{line-height:1.58}
.editorialHero{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(260px,.3fr);gap:48px;align-items:end;padding:58px 0 34px;border-bottom:1px solid var(--mundo-line)}
.editorialHero small{font-size:9px;font-weight:850;letter-spacing:.16em;text-transform:uppercase;color:var(--mundo-signal)}
.editorialHero p{font-size:14px;line-height:1.65;color:var(--mundo-muted);max-width:780px}
.editorialHeroAside{align-self:stretch;display:flex;flex-direction:column;justify-content:space-between;padding:20px;border-left:1px solid var(--mundo-line)}
.editorialHeroAside strong{font-family:var(--mundo-display);font-size:28px;font-weight:400;line-height:1.05}
.editorialHeroAside span{font-size:9px;line-height:1.5;color:var(--mundo-muted)}
.editorialMetricBand,.pulse,.radarPulse,.pipelinePulse,.contactPulse,.workPulse{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:0!important;margin:0!important;border-bottom:1px solid var(--mundo-line)}
.editorialMetricBand>article,.pulse>article,.radarPulse>article,.pipelinePulse>article,.contactPulse>article,.workPulse>article{
 background:transparent!important;border:0!important;border-right:1px solid var(--mundo-line)!important;border-radius:0!important;box-shadow:none!important;padding:18px 20px!important
}
.editorialMetricBand>article:last-child,.pulse>article:last-child,.radarPulse>article:last-child,.pipelinePulse>article:last-child,.contactPulse>article:last-child,.workPulse>article:last-child{border-right:0!important}
.editorialMetricBand b,.pulse b,.radarPulse b,.pipelinePulse b,.contactPulse b,.workPulse b{font-family:var(--mundo-display)!important;font-weight:400!important;font-size:34px!important;letter-spacing:-.035em!important}
.editorialMetricBand span,.pulse span,.radarPulse span,.pipelinePulse span,.contactPulse span,.workPulse span{font-size:9px!important;color:var(--mundo-muted)!important}
.editorialSection{padding:34px 0;border-bottom:1px solid var(--mundo-line)}
.editorialSectionHead{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:end;margin-bottom:18px}
.editorialSectionHead small{font-size:9px;font-weight:850;letter-spacing:.15em;color:var(--mundo-signal);text-transform:uppercase}
.editorialSectionHead h2{font-size:clamp(31px,4vw,48px)!important;line-height:1!important;margin:5px 0 6px!important}
.editorialSectionHead p{margin:0;color:var(--mundo-muted);font-size:11px;max-width:740px}
.editorialSectionHead>a{font-size:9px;font-weight:850;color:var(--mundo-signal);text-decoration:none}
.card,.focusCard,.continueBox,.kpi,.miniStat,.stat,.resource,.module,.flexCard,.result,.evidenceCard,.contactCard,.opportunityCard,.pipelineCard,.panel,.surface,.detail,.fofo-wrap,.fofo-round,.integrationGrid article,.detailGrid article{
 background:var(--mundo-surface)!important;border:0!important;border-top:1px solid var(--mundo-line)!important;border-radius:0!important;box-shadow:none!important
}
[data-visual-reset="mundo-visual-reset-v1"]{position:relative}
[data-visual-reset="mundo-visual-reset-v1"]::before{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,var(--mundo-signal),transparent 35%)}
.resetMesa .operationalSequence{display:grid;grid-template-columns:minmax(0,1fr);gap:0}
.resetRadar .signalGrid{grid-template-columns:minmax(0,.7fr) minmax(0,1.3fr)!important}
.resetPipeline .dealGrid{display:grid!important;grid-template-columns:repeat(4,minmax(260px,1fr))!important;gap:0!important;overflow-x:auto!important}
.resetRelations .networkGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.resetCreation .workLanes{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important}
.resetSocial .contentWall,.resetSocial .playerMatrix{grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr)!important}
.resetMesa .pulse{grid-template-columns:repeat(4,minmax(0,1fr))!important;margin:0 0 44px!important;border-top:1px solid var(--mundo-line)}
.resetMesa .sequenceLanes{grid-template-columns:minmax(0,1.35fr) minmax(0,.85fr) minmax(0,.8fr)!important}
.resetMesa .signalBand{margin-left:clamp(40px,9vw,150px)!important;background:var(--mundo-ink)!important}
.resetRadar .radarPulse{grid-template-columns:repeat(4,minmax(0,1fr))!important;margin-bottom:46px!important}
.resetRadar .signalGrid{display:block!important;border-top:1px solid var(--mundo-line)!important}
.resetRadar .radarSignal{display:grid!important;grid-template-columns:160px minmax(0,1fr) minmax(240px,.55fr)!important;gap:28px!important;min-height:0!important;padding:28px 0!important;border-right:0!important;border-bottom:1px solid var(--mundo-line)!important;align-items:start}
.resetRadar .radarSignal>div{display:grid!important;gap:8px!important}.resetRadar .radarSignal h3{font-family:var(--mundo-display)!important;font-size:clamp(26px,3vw,42px)!important;margin:0!important}.resetRadar .radarSignal>b{grid-column:2}.resetRadar .radarSignal>p{grid-column:2;margin:4px 0 0!important;font-size:11px!important}.resetRadar .radarSignal section{grid-column:3;grid-row:1/4;margin:0!important;background:transparent!important;border-left:1px solid var(--mundo-line)!important;border-radius:0!important;padding:0 0 0 24px!important}
.resetPipeline .dealGrid{scroll-snap-type:x mandatory;padding-bottom:14px!important}.resetPipeline .dealCard{scroll-snap-align:start;min-height:360px!important;border:0!important;border-right:1px solid var(--mundo-line)!important;padding:22px!important;background:transparent!important}.resetPipeline .followGrid{display:block!important;border-top:1px solid var(--mundo-line)!important}.resetPipeline .followCard{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(260px,.7fr) auto!important;gap:22px!important;border:0!important;border-bottom:1px solid var(--mundo-line)!important;border-radius:0!important;background:transparent!important}
.resetRelations .relationEditorial{border-top:1px solid var(--mundo-line)!important;padding-top:30px!important}.resetRelations .networkGrid article{border:0!important;border-top:1px solid var(--mundo-line)!important;border-radius:0!important;background:transparent!important;padding:20px 0!important}.resetRelations .contactGrid{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:0!important}.resetRelations .contactCard{border:0!important;border-right:1px solid var(--mundo-line)!important;border-top:1px solid var(--mundo-line)!important;border-radius:0!important;background:transparent!important;padding:20px!important}
.resetCreation .workLanes{border-top:1px solid var(--mundo-line)!important}.resetCreation .lane{border:0!important;border-right:1px solid var(--mundo-line)!important;border-radius:0!important;background:transparent!important;padding:24px!important}.resetCreation .lane:last-child{border-right:0!important}.resetCreation .workCard{border:0!important;border-top:1px solid var(--mundo-line)!important;border-radius:0!important;background:transparent!important;padding:18px 0!important}
.resetSocial .hero{grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr)!important}.resetSocial .editorialRule{height:1px;background:var(--mundo-line);margin:32px 0}.resetSocial .playerMatrix,.resetSocial .contentWall{gap:0!important;border-top:1px solid var(--mundo-line)!important}.resetSocial .readingBlock,.resetSocial .viewer,.resetSocial .executiveOverview{border-radius:0!important;box-shadow:none!important}

@media(max-width:900px){
 .resetMesa .sequenceLanes{grid-template-columns:1fr!important}
 .resetMesa .signalBand{margin-left:0!important}
 .resetRadar .signalGrid,.resetRelations .networkGrid,.resetCreation .workLanes,.resetSocial .contentWall,.resetSocial .playerMatrix{grid-template-columns:1fr!important}
 .resetPipeline .dealGrid{grid-template-columns:minmax(280px,88vw)!important}
}
.card:hover,.focusCard:hover,.continueBox:hover,.resource:hover,.module:hover,.contactCard:hover,.opportunityCard:hover,.pipelineCard:hover{box-shadow:var(--mundo-shadow-soft)!important;border-color:var(--mundo-line-strong)!important}
.badge,.status,.pill,.chips span,.fofo-pill,.fofo-class,.cardFreshness,.freshness span{border-radius:999px!important;box-shadow:none!important}
.primary,.btn,.driveBtn{background:var(--mundo-ink)!important;color:#fff!important;border:1px solid var(--mundo-ink)!important;border-radius:999px!important;min-height:42px!important;box-shadow:none!important}
input,select,textarea,.globalSearch input,.contactSearch,.searchInput,.filters select{border-radius:12px!important;box-shadow:none!important;border-color:var(--mundo-line)!important;background:var(--mundo-surface)!important;color:var(--mundo-ink)!important}
.tabs,.contactTabs{display:flex!important;gap:3px!important;width:max-content!important;max-width:100%!important;overflow:auto!important;background:transparent!important;border:0!important;border-radius:0!important;padding:0!important;box-shadow:none!important;border-bottom:1px solid var(--mundo-line)!important}
.tabs button,.contactTabs button{background:transparent!important;border:0!important;border-radius:0!important;padding:10px 12px!important;border-bottom:2px solid transparent!important}
.tabs button.on,.contactTabs button.on{background:transparent!important;color:var(--mundo-ink)!important;border-bottom-color:var(--mundo-signal)!important}
.crumb,.breadcrumb,.eyebrow,.sectionHead small,.queueHead small,.top>small,.resourcesHead>small{font-family:var(--mundo-ui)!important;font-weight:850!important;color:var(--mundo-signal)!important;letter-spacing:.15em!important;text-transform:uppercase!important}
.osVisualSequence{display:grid;gap:18px}.osVisualSection{padding:32px 0;border-top:1px solid var(--mundo-line)}.osVisualSection:first-child{border-top:0}
.osVisualLead{display:grid;grid-template-columns:minmax(0,1fr) minmax(240px,.42fr);gap:28px;align-items:end}.osVisualLead small{font-size:9px;font-weight:850;letter-spacing:.15em;text-transform:uppercase;color:var(--mundo-signal)}
.osVisualLead h2{font-size:clamp(30px,4vw,50px);line-height:1;margin:7px 0}.osVisualLead p{margin:0;color:var(--mundo-muted);max-width:780px}
.osVisualAction{display:flex;justify-content:flex-end;gap:7px;flex-wrap:wrap}.osVisualAction a,.osVisualAction button{border:1px solid var(--mundo-line);background:#fff;color:var(--mundo-ink);border-radius:999px;padding:9px 12px;font-size:9px;font-weight:850}.osVisualAction .primary{background:var(--mundo-ink)!important;color:#fff!important}
.osReadingBlock{background:var(--mundo-surface);border:1px solid var(--mundo-line);border-radius:18px;padding:18px}.osReadingBlock small{font-size:8px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:var(--mundo-signal)}
.osReadingBlock h3{font-family:var(--mundo-display);font-size:24px;font-weight:400;margin:6px 0}.osReadingBlock p{margin:0;color:var(--mundo-muted)}
@media(max-width:900px){
 .main,.page,.canonicalHub,.brainMain,.homeDesk,.radarPage,.pipe,.contacts,.workspaceLive{padding-left:16px!important;padding-right:16px!important}
 .editorialHero{grid-template-columns:1fr;padding-top:24px}.editorialHeroAside{border-left:0;border-top:1px solid var(--mundo-line);padding-left:0}
 .editorialMetricBand,.pulse,.radarPulse,.pipelinePulse,.contactPulse,.workPulse{grid-template-columns:1fr 1fr!important}
 .editorialMetricBand>article:nth-child(2),.pulse>article:nth-child(2),.radarPulse>article:nth-child(2),.pipelinePulse>article:nth-child(2),.contactPulse>article:nth-child(2),.workPulse>article:nth-child(2){border-right:0!important}
 .editorialMetricBand>article:nth-child(-n+2),.pulse>article:nth-child(-n+2),.radarPulse>article:nth-child(-n+2),.pipelinePulse>article:nth-child(-n+2),.contactPulse>article:nth-child(-n+2),.workPulse>article:nth-child(-n+2){border-bottom:1px solid var(--mundo-line)}
 .editorialSectionHead{grid-template-columns:1fr}
}
`;

export default OS_VISUAL_DIRECTION;
