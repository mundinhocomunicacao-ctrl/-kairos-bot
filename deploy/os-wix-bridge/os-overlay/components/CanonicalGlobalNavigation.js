import Link from 'next/link';
import {useRouter} from 'next/router';
import GlobalCommandPalette from './GlobalCommandPalette';
import GlobalOperationalControls from './GlobalOperationalControls';
import {OS_12_AREA_OPERATIONAL_MAP,OS_12_AREA_ROWS} from '../data/os-12-area-operational-map';

export const CANONICAL_NAV=OS_12_AREA_ROWS.map(row=>[row.id,row.label,row.route]);

export const NAV_GROUPS=OS_12_AREA_OPERATIONAL_MAP.menuGroups.map(group=>[group.label,[...group.areas]]);

const NAV_BY_KEY=Object.fromEntries(CANONICAL_NAV.map(item=>[item[0],item]));

function currentKey(asPath=''){
  const raw=String(asPath||'');
  const path=raw.split('?')[0].split('#')[0];
  if(path.startsWith('/os/radar')||path.startsWith('/os/tendencias'))return'radar';
  if(path.startsWith('/os/agenda')||path.startsWith('/os/calendario'))return'agenda';
  if(path.startsWith('/os/propostas'))return'propostas';
  if(path.startsWith('/os/pipeline')||path.startsWith('/os/oportunidades')||path.startsWith('/os/negociacoes'))return'pipeline';
  if(path.startsWith('/os/contatos')||path.startsWith('/os/marcas')||path.startsWith('/os/talentos'))return'contatos';
  if(path.startsWith('/os/pr'))return'pr';
  if(path.startsWith('/os/workspace')||path.startsWith('/os/documentos'))return'workspace';
  if(path.startsWith('/os/explorer')||path.startsWith('/os/brain')||path.startsWith('/os/busca'))return'explorer';
  if(path.startsWith('/os/social'))return'social';
  if(path.startsWith('/os/ideias'))return'ideias';
  if(path.startsWith('/os/malha'))return'malha';
  if(path.startsWith('/os/configuracoes')||path.startsWith('/os/agentes')||path.startsWith('/os/laboratorio-agentes'))return'configuracoes';
  return'inicio';
}

const GLYPHS={inicio:'⌂',radar:'◎',agenda:'▦',pipeline:'◆',propostas:'▤',contatos:'◌',workspace:'▣',explorer:'◈',social:'⌁',ideias:'✦',pr:'PR',configuracoes:'⚙',malha:'⌘'};

export default function CanonicalGlobalNavigation(){
  const router=useRouter();
  if(!String(router.asPath||'').startsWith('/os'))return null;
  const current=currentKey(router.asPath);
  return <>
    <aside className="osAppRail" aria-label="Mundinho OS">
      <Link className="osAppBrand" href="/os/inicio">
        <span className="osDivaMark">D</span>
        <span><b>DIVA</b><small>Mundinho OS</small></span>
      </Link>
      <nav className="osHumanNav" aria-label="Páginas principais">
        {(()=>{const[,label,href]=NAV_BY_KEY.inicio;const meta=OS_12_AREA_OPERATIONAL_MAP.areas.inicio;return <section className="osNavGroup osNavHome"><Link data-area-id="inicio" data-area-order={meta.order} data-area-group={meta.group} data-workflow-step={meta.order} className={current==='inicio'?'on':''} href={href}><i>{GLYPHS.inicio}</i><span>{label}</span></Link></section>})()}
        {NAV_GROUPS.map(([group,keys])=><section className="osNavGroup" key={group}><small>{group}</small>{keys.map(key=>{const[,label,href]=NAV_BY_KEY[key];const meta=OS_12_AREA_OPERATIONAL_MAP.areas[key];return <Link key={key} data-area-id={key} data-area-order={meta.order} data-area-group={meta.group} data-workflow-step={meta.order} className={current===key?'on':''} href={href}><i>{GLYPHS[key]}</i><span>{label}</span></Link>})}</section>)}
      </nav>
      <div className="osRailFooter">
        <GlobalOperationalControls/>
        <GlobalCommandPalette/>
        <Link className={current==='malha'?'osRailMalha on':'osRailMalha'} href="/os/malha">⌘ <span>Sala da Malha</span></Link>
        <Link className="osRailDiva" href="/os/diva">✦ <span>Falar com a DIVA</span></Link>
      </div>
    </aside>
    <nav className="osMobileDock" aria-label="Áreas do Mundinho OS">
      {CANONICAL_NAV.map(([key,label,href])=>{const meta=OS_12_AREA_OPERATIONAL_MAP.areas[key];return <Link key={key} data-area-id={key} data-area-order={meta.order} data-area-group={meta.group} className={current===key?'on':''} href={href}><i>{GLYPHS[key]}</i><span>{label}</span></Link>})}
      <Link className={current==='malha'?'malha on':'malha'} href="/os/malha"><i>⌘</i><span>Sala da Malha</span></Link>
      <Link className="diva" href="/os/diva"><i>✦</i><span>DIVA</span></Link>
    </nav>
    <style jsx global>{`
      :root{--os-rail-w:232px;--agency-bar-h:0px}
      body{padding-left:calc(var(--os-rail-w) + 38px)!important;padding-top:0!important;background:#F4F1EA!important}
      .side,.brainSide,.canonicalGlobalSide,.canonicalGlobalMobile,.agencyBar,.agencyMobile{display:none!important}
      .shell,.brainShell{grid-template-columns:minmax(0,1fr)!important;width:100%!important;max-width:none!important}
      .main,.brainMain{min-width:0!important;max-width:none!important}
      .osAppRail{position:fixed;z-index:160;left:18px;top:18px;bottom:18px;width:var(--os-rail-w);display:flex;flex-direction:column;background:rgba(255,255,255,.95);border:1px solid rgba(17,18,20,.07);border-radius:28px;padding:16px 13px;box-shadow:0 22px 60px rgba(35,31,25,.10);backdrop-filter:blur(22px);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .osAppBrand{display:flex;align-items:center;gap:11px;text-decoration:none;color:#17191D;padding:5px 7px 18px}.osDivaMark{width:38px;height:38px;border-radius:50%;background:radial-gradient(circle at 32% 24%,#DCE8FF 0,#7DA7FF 38%,#175CFF 68%,#0B43C9 100%);color:#fff;display:grid;place-items:center;font:700 18px/1 Georgia,serif;box-shadow:0 10px 24px rgba(23,92,255,.20)}.osAppBrand b{display:block;font:600 21px/.95 Georgia,serif;letter-spacing:-.04em}.osAppBrand small{display:block;margin-top:4px;color:#777D84;font-size:8px;font-weight:750;letter-spacing:.04em}
      .osHumanNav{display:grid;gap:9px;padding:4px 0;overflow:auto}.osNavGroup{display:grid;gap:3px}.osNavGroup>small{padding:8px 10px 3px;font-size:7px;font-weight:900;letter-spacing:.15em;color:#A19B91}.osHumanNav a{display:grid;grid-template-columns:26px 1fr;align-items:center;gap:8px;min-height:40px;padding:0 10px;border-radius:15px;text-decoration:none;color:#6B7078;font-size:11px;font-weight:720;transition:.15s}.osHumanNav a i{font-style:normal;color:#8A9098;text-align:center}.osHumanNav a:hover{background:#F5F3EE;color:#17191D}.osHumanNav a.on{background:#17191D;color:#fff}.osHumanNav a.on i{color:#D7FF3F}
      .osRailFooter{margin-top:auto;border-top:1px solid #ECE8DF;padding-top:10px;display:grid;gap:5px}.osRailMalha,.osRailDiva{display:flex;align-items:center;gap:8px;min-height:42px;padding:0 11px;border-radius:13px;text-decoration:none;font-size:10px;font-weight:850}.osRailMalha{background:#F1EFEA;color:#17191D}.osRailMalha.on{background:#17191D;color:#fff}.osRailDiva{background:#175CFF;color:#fff}

      /* MORADA/DIVA VISUAL RECONCILIATION */
      :root{--os-rail-w:196px}
      body{padding-left:252px!important;background:#F7F3F1!important;font-family:"DM Sans",Inter,system-ui,-apple-system,"Segoe UI",sans-serif!important}
      .osAppRail{left:16px;top:16px;bottom:16px;width:196px;padding:22px 12px;background:#fff;border:1px solid #EDE3E8;border-radius:28px;box-shadow:none;backdrop-filter:none}
      .osAppBrand{flex-direction:column;align-items:center;gap:4px;padding:0 0 20px;text-align:center}
      .osDivaMark{width:48px;height:48px;background:radial-gradient(circle at 34% 28%,#fff 0,#DCE8FF 8%,#7DA7FF 28%,#175CFF 60%,#0B43C9 100%);box-shadow:0 10px 24px rgba(23,92,255,.20);font-size:0}
      .osDivaMark:after{content:"";width:12px;height:12px;border-radius:50%;background:#fff;opacity:.94;box-shadow:0 0 0 6px rgba(255,255,255,.18)}
      .osAppBrand b{font:700 26px/1 "DM Sans",Inter,sans-serif;letter-spacing:-.03em}.osAppBrand small{font-size:8.5px;letter-spacing:.12em;color:#6E6069}
      .osHumanNav{gap:3px;padding:0}.osNavGroup{gap:3px}.osNavGroup>small{padding:9px 14px 4px;font-size:7px;color:#A19B91}
      .osHumanNav a{grid-template-columns:18px 1fr;gap:10px;min-height:42px;padding:0 14px;border-radius:14px;color:#3A2D37;font-size:12px;font-weight:600}.osHumanNav a:hover{background:#F5F7FC}.osHumanNav a.on{background:#EEF3FF;color:#175CFF}.osHumanNav a.on i{color:#175CFF}
      .osRailFooter{border-color:#EDE3E8}.osRailDiva{background:#17111A;color:#fff}

      /* MORADA AREA SURFACE NORMALIZATION · applies to all 12 primary pages */
      main[data-area-mode],main.health{background:transparent!important;max-width:1480px!important;margin:0 auto!important}
      main[data-area-mode]>header,main.health>header{background:#fff!important;border:1px solid #EDE3E8!important;border-radius:26px!important;padding:24px!important;box-shadow:none!important}
      main[data-area-mode] section,main.health section{scroll-margin-top:24px}
      main[data-area-mode] h1,main.health h1{color:#17111A!important}
      main[data-area-mode] h2,main.health h2{color:#17111A}
      main[data-area-mode] article,main.health article{box-shadow:none}
      main[data-area-mode] button,main[data-area-mode] input,main[data-area-mode] textarea,main.health button,main.health input,main.health textarea{font-family:"DM Sans",Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
      /* MORADA 12-PAGE HARD SHELL */
      #__next main:not(.moradaDesktop){max-width:1480px!important;margin:0 auto!important;padding:24px 24px 110px 0!important;background:transparent!important;color:#17111A!important;font-family:"DM Sans",Inter,system-ui,-apple-system,"Segoe UI",sans-serif!important}
      #__next main:not(.moradaDesktop)>header{background:#fff!important;border:1px solid #EDE3E8!important;border-radius:24px!important;padding:22px!important;box-shadow:none!important;margin-bottom:16px!important}
      #__next main:not(.moradaDesktop)>header h1{font-family:"DM Serif Display",Georgia,serif!important;font-weight:400!important;letter-spacing:-.035em!important}
      #__next main:not(.moradaDesktop) article,#__next main:not(.moradaDesktop) section{box-shadow:none!important}
      #__next main:not(.moradaDesktop) a{transition:opacity .15s ease,background .15s ease}
      #__next main:not(.moradaDesktop) a:hover{opacity:.86}
      .osMobileDock{display:none}
      @media(max-width:900px){body{padding-left:0!important;padding-bottom:92px!important}.osAppRail{display:none!important}.osMobileDock{position:fixed;z-index:170;left:10px;right:10px;bottom:10px;display:flex;align-items:center;gap:4px;overflow-x:auto;scrollbar-width:none;background:rgba(255,255,255,.97);border:1px solid #E4E0D7;border-radius:24px;padding:6px;padding-bottom:max(6px,env(safe-area-inset-bottom));box-shadow:0 18px 48px rgba(15,23,42,.12);backdrop-filter:blur(18px)}.osMobileDock::-webkit-scrollbar{display:none}.osMobileDock a{flex:0 0 auto;min-width:67px;min-height:54px;display:grid;place-items:center;align-content:center;gap:4px;text-decoration:none;color:#737A83;border-radius:18px;padding:5px 10px;font-size:8px;font-weight:800;white-space:nowrap}.osMobileDock a i{font-style:normal;font-size:14px}.osMobileDock a.on{background:#17191D;color:#fff}.osMobileDock a.diva{background:#175CFF;color:#fff}}
    `}</style>
  </>;
}
