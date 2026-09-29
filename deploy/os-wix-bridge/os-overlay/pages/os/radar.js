import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import DivaAvatar2D from '../../components/DivaAvatar2D';
import {requireOSAuth} from '../../lib/os-auth';
import {cardsFor} from '../../data/os-cards';
import {CRM_OPERATIONAL_SNAPSHOT} from '../../data/crm-operational-snapshot-current';
import {SOCIAL_FIRST_INJECTION,SOCIAL_SOURCE_REGISTRY} from '../../data/social-source-registry-2026-09-16';

const HOT=/resposta humana|material solicitado|interesse|contato compartilhado|e-mail recebido|formulário|proposta|negocia/i;
const DATE_KEYS=['published_at','publishedAt','observedAt','date','updatedAt','lastInteraction','nextActionDate'];
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const itemDate=item=>DATE_KEYS.map(k=>item?.[k]).find(v=>v&&Number.isFinite(Date.parse(v)))||null;
const safeArray=value=>Array.isArray(value)?value:[];
const short=(value,max=54)=>{const s=String(value||'');return s.length>max?s.slice(0,max-1)+'…':s};
const fmtDate=value=>{if(!value)return'—';try{return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(value))}catch{return'—'}};
const monthKey=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d.toISOString().slice(0,7):null};
const monthLabel=key=>{if(!key)return'';const [y,m]=key.split('-').map(Number);return new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(new Date(Date.UTC(y,m-1,1))).replace('.','')};
const origin=item=>item?.provenance||item?.source||item?.owner||'MUNDO';

function seriesByMonth(groups){
 const keys=[...new Set(groups.flatMap(g=>g.items.map(itemDate).filter(Boolean).map(monthKey).filter(Boolean)))].sort().slice(-5);
 if(!keys.length)return{keys:[],series:[]};
 return{keys,series:groups.map(g=>({label:g.label,tone:g.tone,values:keys.map(k=>g.items.filter(x=>monthKey(itemDate(x))===k).length)}))};
}
function statusScore(item){
 const text=String(item?.status||'')+' '+String(item?.nextAction||'');
 return{
  x:clamp(18+(item?.nextAction?24:0)+(HOT.test(text)?34:0)+(item?.priority==='P0'?18:item?.priority==='P1'?10:0),12,94),
  y:clamp(18+(item?.lastInteraction?22:0)+(HOT.test(text)?30:0)+(item?.priority==='P0'?22:item?.priority==='P1'?12:0),12,94)
 };
}
function routeFor(item){
 const text=(String(item?.title||'')+' '+String(item?.summary||'')+' '+String(item?.nextAction||'')).toLowerCase();
 if(/proposta|negocia|budget|orçamento/.test(text))return'/os/propostas';
 if(/social|creator|conteúdo|conteudo/.test(text))return'/os/social';
 return'/os/ideias';
}
function MetricCard({label,value,source,breakdown=[],tone='pink'}){
 const max=Math.max(1,...breakdown);
 return <article className={'radarMetric '+tone}>
  <div className="radarMetricTop"><span className="radarMetricIcon">◎</span><b>{label}</b></div>
  <div className="radarMetricValue"><strong>{value}</strong><div className="miniBars" aria-hidden="true">{breakdown.slice(-8).map((v,i)=><i key={i} style={{height:(18+Math.round(v/max*28))+'px'}}/>)}</div></div>
  <footer><span>Fonte: {source}</span><em><i/> atualização viva</em></footer>
 </article>
}
function TrendPanel({groups,freshness}){
 const data=useMemo(()=>seriesByMonth(groups),[groups]);
 const palette={pink:'#FF3B91',violet:'#6C4BFF',blue:'#3388FF'};
 const width=560,height=215,pad=34;
 const max=Math.max(1,...data.series.flatMap(s=>s.values));
 const points=values=>values.map((v,i)=>({x:pad+(data.keys.length<=1?0.5:i/(data.keys.length-1))*(width-pad*2),y:height-pad-(v/max)*(height-pad*2)}));
 return <section className="radarPanel radarTrendPanel" data-chart-live="1">
  <header><div><h2>Tendências em destaque</h2><p>Menções e interesse ao longo do tempo</p></div><Link href="/os/social">Ver todas →</Link></header>
  <div className="trendLegend">{data.series.map(s=><span key={s.label}><i style={{background:palette[s.tone]}}/>{s.label}</span>)}</div>
  {data.keys.length?<svg viewBox={'0 0 '+width+' '+height} role="img" aria-label="Sinais materializados ao longo do tempo">
   {[0,1,2,3].map(n=><line key={n} x1={pad} x2={width-pad} y1={pad+n*((height-pad*2)/3)} y2={pad+n*((height-pad*2)/3)} stroke="#ECEAF0" strokeWidth="1"/>)}
   {data.series.map(s=>{const pts=points(s.values);return <g key={s.label}><polyline fill="none" stroke={palette[s.tone]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pts.map(p=>p.x+','+p.y).join(' ')}/>{pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke={palette[s.tone]} strokeWidth="2"/>)}</g>})}
   {data.keys.map((k,i)=><text key={k} x={pad+(data.keys.length<=1?0.5:i/(data.keys.length-1))*(width-pad*2)} y={height-8} textAnchor="middle" fontSize="11" fill="#7A7280">{monthLabel(k)}</text>)}
  </svg>:<div className="radarNoTemporal">Ainda não há datas suficientes para desenhar uma curva temporal confiável.</div>}
  <footer><span>Fonte: social + Radar + projeção comercial</span><em><i/> {freshness?'Atualizado '+fmtDate(freshness):'leitura atual'}</em></footer>
 </section>
}
function IntensityPanel({rows,freshness}){
 const max=Math.max(1,...rows.map(x=>x.value));
 return <section className="radarPanel radarIntensityPanel" data-chart-live="1">
  <header><div><h2>Intensidade dos sinais</h2><p>Volume materializado por frente nesta leitura</p></div><Link href="/os/explorer">Ver fontes →</Link></header>
  <div className="intensityRows">{rows.map(x=><div key={x.label}><span>{x.label}</span><div><i style={{width:Math.max(8,Math.round(x.value/max*100))+'%'}}/></div><b>{x.value}</b></div>)}</div>
  <footer><span>Fonte: MUNDO + fontes governadas</span><em><i/> {freshness?'Atualizado '+fmtDate(freshness):'leitura atual'}</em></footer>
 </section>
}
function OpportunityMap({items,freshness}){
 const points=items.slice(0,7).map((item,index)=>({...item,...statusScore(item),tone:index%3}));
 return <section className="radarPanel radarOpportunityMap" data-chart-live="1">
  <header><div><h2>Mapa de oportunidades</h2><p>Força do sinal × prontidão comercial</p></div><Link href="/os/pipeline">Ver todas →</Link></header>
  <div className="oppMap" role="img" aria-label="Mapa vivo de oportunidades">
   <span className="mapAxis y">Força do sinal</span><span className="mapAxis x">Prontidão comercial</span>
   <i className="gridV"/><i className="gridH"/>
   <span className="mapTag observe">OBSERVAR</span><span className="mapTag priority">PRIORIZAR</span><span className="mapTag analyse">EM ANÁLISE</span><span className="mapTag explore">EXPLORAR</span>
   {points.map((p,i)=><Link key={p.slug||p.title||i} href={'/os/pipeline/'+(p.slug||'')} className={'oppPoint tone'+p.tone} style={{left:p.x+'%',bottom:p.y+'%'}} title={p.title}><i/><span>{short(p.title,20)}</span></Link>)}
  </div>
  <p className="mapNote">Score operacional derivado do estado, prioridade, interação e próxima ação comprovados — não é previsão.</p>
  <footer><span>Fonte: Pipeline + live projection</span><em><i/> {freshness?'Atualizado '+fmtDate(freshness):'leitura atual'}</em></footer>
 </section>
}
function QualifiedSignals({items}){
 return <section className="radarQualified">
  <header><div><h2>Sinais qualificados</h2><p>Evidências que já têm origem, contexto e uma rota de aprofundamento.</p></div><div><span>Mais recentes</span></div></header>
  <div className="radarTable" role="table" aria-label="Sinais qualificados"><div className="radarTR radarTH" role="row"><span>Sinal</span><span>Origem</span><span>Data</span><span>Rota sugerida</span><span>Ações</span></div>
   {items.slice(0,7).map((item,i)=>{const route=routeFor(item);return <div className="radarTR" role="row" key={(item.slug||item.title||i)+i}><span><b>{short(item.title||'Sinal materializado',64)}</b><small>{short(item.summary||item.status||'',74)}</small></span><span>{short(origin(item),26)}</span><span>{fmtDate(itemDate(item))}</span><span>{short(item.nextAction||'Aprofundar contexto antes de agir.',50)}</span><span><Link href={route}>Abrir rota</Link><Link href="/os/explorer">Contexto</Link></span></div>})}
  </div>
 </section>
}
function DivaRadarPanel({signals}){
 const top=signals.slice(0,3);
 return <aside className="radarDivaPanel">
  <header><div><b>DIVA</b><span>Sua analista de inteligência.</span></div><em><i/> ORBI online</em></header>
  <div className="radarOrbi"><DivaAvatar2D size="hero" variant="morada" state="ready"/></div>
  <p>Aqui estão os principais sinais desta leitura, com base nas evidências disponíveis no Radar e nas fontes conectadas.</p>
  <div className="divaRadarCards">{top.map((item,i)=><article key={(item.slug||item.title||i)+i}><span>{i===0?'↗':i===1?'✦':'◎'}</span><div><b>{i===0?'Sinal em foco':i===1?'Oportunidade identificada':'Ação sugerida'}</b><p>{short(item.nextAction||item.summary||item.title,116)}</p></div></article>)}</div>
  <Link className="radarDivaCTA" href="/os/diva?context=radar">Ver análise completa →</Link>
 </aside>
}

export default function Radar({email}){
 const trends=cardsFor('tendencias');
 const calendar=cardsFor('calendario');
 const social=cardsFor('social');
 const creators=cardsFor('creators');
 const verifiedSocial=[...SOCIAL_FIRST_INJECTION,...SOCIAL_SOURCE_REGISTRY.filter(x=>x.section==='social')];
 const fallbackSignals=[...verifiedSocial,...trends,...calendar,...social].slice(0,24);
 const fallbackCommercial=CRM_OPERATIONAL_SNAPSHOT.pipeline.filter(x=>HOT.test(String(x.status||'')+' '+String(x.nextAction||''))).slice(0,12);
 const[live,setLive]=useState(null);
 useEffect(()=>{let active=true;Promise.all([
  fetch('/api/intelligence-graphs',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null),
  fetch('/api/live-projection',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null)
 ]).then(([graphs,projection])=>{if(active)setLive({graphs,projection})});return()=>{active=false}},[]);
 const liveRadar=safeArray(live?.projection?.projection?.operational?.radar);
 const liveCards=safeArray(live?.projection?.projection?.currentCards||live?.projection?.projection?.cards);
 const signals=liveRadar.length?liveRadar:fallbackSignals;
 const commercial=liveCards.length?liveCards.filter(x=>HOT.test(String(x.status||'')+' '+String(x.nextAction||''))).slice(0,12):fallbackCommercial;
 const freshness=live?.projection?.live?.fetchedAt||live?.graphs?.snapshot?.generatedAt||CRM_OPERATIONAL_SNAPSHOT.capturedAt;
 const metricBreakdown={
  market:[trends.length,calendar.length,social.length,signals.length],
  culture:[calendar.length,trends.length,creators.length],
  social:[verifiedSocial.length,social.length],
  qualified:[commercial.length,liveCards.length||CRM_OPERATIONAL_SNAPSHOT.pipeline.length]
 };
 const intensity=[
  {label:'Sinais materializados',value:signals.length},
  {label:'Social',value:verifiedSocial.length},
  {label:'Janelas culturais',value:calendar.length},
  {label:'Tendências',value:trends.length},
  {label:'Creators',value:creators.length}
 ];
 const trendGroups=[
  {label:'Social',tone:'pink',items:verifiedSocial},
  {label:'Radar',tone:'violet',items:signals},
  {label:'Comercial',tone:'blue',items:commercial}
 ];
 return <main className="radarApproved" data-area-mode="radar-live-dashboard" data-visual-reference="RADAR_APPROVED_20260929">
  <div className="radarTopline"><Link href="/os/busca">⌕ <span>Pergunte para a DIVA ou busque em todo o OS...</span><kbd>⌘ K</kbd></Link><div><span>{email||'Mundinho'}</span><Link href="/os/configuracoes">⚙</Link></div></div>
  <div className="radarLayout">
   <section className="radarCanvas">
    <header className="radarHero"><div><small>RADAR</small><div><h1>Radar</h1><p><b>Sinais vivos do mercado, da cultura e das conversas.</b><span>Inteligência em tempo real para você agir no momento certo.</span></p></div></div><span>{freshness?'Atualizado '+fmtDate(freshness):'Leitura atual'}</span></header>
    <section className="radarMetricGrid">
     <MetricCard label="Sinais de mercado" value={signals.length} source="live projection + MUNDO" breakdown={metricBreakdown.market} tone="pink"/>
     <MetricCard label="Movimentos culturais" value={trends.length+calendar.length} source="tendências + calendário" breakdown={metricBreakdown.culture} tone="violet"/>
     <MetricCard label="Evidência social" value={verifiedSocial.length} source="social + fontes governadas" breakdown={metricBreakdown.social} tone="blue"/>
     <MetricCard label="Oportunidades qualificadas" value={commercial.length} source="Pipeline + DIVA" breakdown={metricBreakdown.qualified} tone="pink"/>
    </section>
    <section className="radarChartGrid">
     <TrendPanel groups={trendGroups} freshness={freshness}/>
     <IntensityPanel rows={intensity} freshness={freshness}/>
     <OpportunityMap items={commercial} freshness={freshness}/>
    </section>
    <QualifiedSignals items={signals}/>
   </section>
   <DivaRadarPanel signals={signals}/>
  </div>
  <style jsx global>{\`
   .radarApproved{max-width:1500px!important;padding:18px 18px 100px 0!important;color:#111B3D;background:#F7F4F2!important}
   .radarTopline{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 14px}.radarTopline>a{width:min(560px,56vw);min-height:40px;display:flex;align-items:center;gap:10px;padding:0 14px;border:1px solid #E7E8EF;border-radius:999px;background:#fff;color:#7C8190;text-decoration:none;font-size:10px;box-shadow:0 8px 24px rgba(35,43,72,.05)}.radarTopline kbd{margin-left:auto;border:1px solid #E8EAF2;border-radius:8px;padding:4px 7px;background:#F8F9FC;font-size:8px}.radarTopline>div{display:flex;align-items:center;gap:10px;font-size:9px}.radarTopline>div a{width:34px;height:34px;display:grid;place-items:center;border:1px solid #E7E8EF;border-radius:50%;background:#fff;text-decoration:none}
   .radarLayout{display:grid;grid-template-columns:minmax(0,1fr) 286px;gap:14px;align-items:start}.radarCanvas{min-width:0}.radarHero{display:flex!important;justify-content:space-between!important;gap:20px!important;align-items:center!important;padding:16px 18px!important;margin:0 0 12px!important;background:#fff!important;border:1px solid #ECEAF0!important;border-radius:22px!important}.radarHero>div>small{font-size:8px;font-weight:900;letter-spacing:.16em;color:#40547F}.radarHero>div>div{display:flex;gap:18px;align-items:center;margin-top:5px}.radarHero h1{font:400 50px/.95 "DM Serif Display",Georgia,serif!important;letter-spacing:-.04em!important;margin:0;color:#101C45!important}.radarHero p{display:grid;gap:2px;margin:0;color:#39507A;font-size:11px}.radarHero p b{font-weight:700}.radarHero p span{font-size:9px}.radarHero>span{font-size:8px;color:#69738E;border:1px solid #E7E8EF;border-radius:10px;padding:8px 10px;background:#FBFCFF}
   .radarMetricGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:10px}.radarMetric{background:#fff;border:1px solid #ECEAF0;border-radius:18px;padding:14px;min-width:0}.radarMetricTop{display:flex;align-items:center;gap:8px;font-size:9px}.radarMetricIcon{width:26px;height:26px;display:grid;place-items:center;border-radius:9px;background:#FFF0F6;color:#FF2A87}.radarMetric.violet .radarMetricIcon{background:#F1EDFF;color:#6C4BFF}.radarMetric.blue .radarMetricIcon{background:#EDF5FF;color:#2F80ED}.radarMetricValue{display:flex;align-items:end;justify-content:space-between;gap:10px;margin-top:8px}.radarMetricValue strong{font:400 28px/1 "DM Serif Display",Georgia,serif;color:#111C46}.miniBars{height:50px;display:flex;align-items:end;gap:3px}.miniBars i{width:6px;border-radius:3px 3px 1px 1px;background:#F5B6D3}.radarMetric.violet .miniBars i{background:#CFC1FF}.radarMetric.blue .miniBars i{background:#AFCFFF}.radarMetric footer,.radarPanel footer{display:flex;justify-content:space-between;gap:8px;margin-top:11px;padding-top:9px;border-top:1px solid #F0EEF3;font-size:7px;color:#7F8495}.radarMetric footer em,.radarPanel footer em{font-style:normal;white-space:nowrap}.radarMetric footer em i,.radarPanel footer em i,.radarDivaPanel header em i{display:inline-block;width:6px;height:6px;border-radius:50%;background:#14A66D;margin-right:5px}
   .radarChartGrid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:10px}.radarPanel{background:#fff;border:1px solid #ECEAF0;border-radius:18px;padding:14px;min-width:0}.radarPanel>header{display:flex;justify-content:space-between;align-items:start;gap:10px;margin-bottom:10px}.radarPanel h2{font:400 20px/1.05 "DM Serif Display",Georgia,serif;margin:0;color:#131E45}.radarPanel header p{font-size:8px;color:#7180A0;margin:4px 0 0}.radarPanel header a{font-size:8px;color:#2668E8;text-decoration:none;white-space:nowrap}.trendLegend{display:flex;gap:12px;align-items:center;font-size:7px;color:#66718B;margin-bottom:6px}.trendLegend span{display:flex;align-items:center;gap:5px}.trendLegend i{width:7px;height:7px;border-radius:50%}.radarTrendPanel svg{width:100%;height:190px;display:block}.radarNoTemporal{height:190px;display:grid;place-items:center;text-align:center;color:#7F8495;font-size:9px;border:1px dashed #E4E5EC;border-radius:14px}
   .intensityRows{display:grid;gap:11px;margin-top:12px}.intensityRows>div{display:grid;grid-template-columns:minmax(100px,1.15fr) minmax(70px,1fr) 28px;gap:8px;align-items:center}.intensityRows span{font-size:8px;color:#263451}.intensityRows>div>div{height:9px;background:#F2F3F8;border-radius:999px;overflow:hidden}.intensityRows i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,#FF5AA4,#6C4BFF)}.intensityRows b{font-size:9px;text-align:right}
   .oppMap{position:relative;height:228px;margin:10px 0 4px;border-left:1px solid #DDE2EC;border-bottom:1px solid #DDE2EC;background:linear-gradient(90deg,transparent 49.8%,#EEF0F5 50%,transparent 50.2%),linear-gradient(0deg,transparent 49.8%,#EEF0F5 50%,transparent 50.2%)}.mapAxis{position:absolute;font-size:7px;color:#77809A}.mapAxis.y{left:-18px;top:50%;transform:translate(-50%,-50%) rotate(-90deg)}.mapAxis.x{left:50%;bottom:-18px;transform:translateX(-50%)}.mapTag{position:absolute;font-size:6px;font-weight:900;border-radius:6px;padding:4px 6px}.mapTag.observe{left:6px;top:4px;background:#FFF0F6;color:#FF3B91}.mapTag.priority{right:4px;top:4px;background:#EDF4FF;color:#3177F4}.mapTag.analyse{left:6px;bottom:5px;background:#F2F2F5;color:#777}.mapTag.explore{right:4px;bottom:5px;background:#F1EDFF;color:#6C4BFF}.oppPoint{position:absolute;transform:translate(-50%,50%);text-decoration:none;color:#25314F}.oppPoint>i{display:block;width:14px;height:14px;border-radius:50%;background:#3A83F7;border:3px solid rgba(255,255,255,.78);box-shadow:0 0 0 1px rgba(36,70,140,.12)}.oppPoint.tone0>i{width:23px;height:23px;background:#FF5A9E}.oppPoint.tone1>i{background:#7C5CFF}.oppPoint span{position:absolute;left:12px;top:-3px;min-width:70px;font-size:6px;background:rgba(255,255,255,.9);border:1px solid #EEF0F5;border-radius:5px;padding:3px}.mapNote{font-size:6.5px;line-height:1.35;color:#7E8494;margin:16px 0 0}
   .radarQualified{margin-top:10px;background:#fff;border:1px solid #ECEAF0;border-radius:18px;padding:14px}.radarQualified>header{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:10px}.radarQualified h2{font:400 21px "DM Serif Display",Georgia,serif;margin:0;color:#152044}.radarQualified header p{font-size:8px;color:#7180A0;margin:3px 0 0}.radarQualified header>div:last-child span{font-size:8px;border:1px solid #E7E9EF;border-radius:10px;padding:8px 10px;color:#4D5874}.radarTable{display:grid}.radarTR{display:grid;grid-template-columns:1.4fr .7fr .45fr 1.1fr .75fr;gap:10px;align-items:center;min-height:42px;border-top:1px solid #F0EEF3;font-size:7.5px;color:#52607D}.radarTH{min-height:30px;border:0;background:#F8F9FC;border-radius:10px;padding:0 8px;font-size:6.5px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#76809A}.radarTR>span:first-child{display:grid;gap:2px}.radarTR b{font-size:8px;color:#1C2949}.radarTR small{font-size:6.5px;color:#7E879B}.radarTR>span:last-child{display:flex;gap:5px;flex-wrap:wrap}.radarTR a{font-size:6.5px;text-decoration:none;color:#2369EB;background:#EDF4FF;border-radius:6px;padding:5px 7px}
   .radarDivaPanel{position:sticky;top:16px;background:linear-gradient(180deg,#fff 0%,#FFF8FC 100%);border:1px solid #ECEAF0;border-radius:20px;padding:14px;min-height:620px}.radarDivaPanel>header{display:flex;justify-content:space-between;gap:10px}.radarDivaPanel header>div{display:grid}.radarDivaPanel header b{font:400 25px/1 "DM Serif Display",Georgia,serif;color:#111B3D}.radarDivaPanel header span{font-size:8px;color:#66728C;margin-top:3px}.radarDivaPanel header em{font-style:normal;font-size:7px;color:#66728C}.radarOrbi{height:190px;display:grid;place-items:center;overflow:hidden}.radarOrbi .divaAvatar2D.hero{--d:160px!important}.radarDivaPanel>p{font-size:10px;line-height:1.4;color:#394A6C}.divaRadarCards{display:grid;gap:8px;margin:12px 0}.divaRadarCards article{display:grid;grid-template-columns:34px 1fr;gap:9px;background:#fff;border:1px solid #ECEAF0;border-radius:14px;padding:10px}.divaRadarCards article>span{width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:#FFF0F6;color:#FF2F89}.divaRadarCards article:nth-child(2)>span{background:#F1EDFF;color:#6C4BFF}.divaRadarCards article:nth-child(3)>span{background:#EDF4FF;color:#2D75ED}.divaRadarCards b{font:400 12px "DM Serif Display",Georgia,serif;color:#162044}.divaRadarCards p{font-size:7.5px;line-height:1.35;color:#5E6A84;margin:3px 0 0}.radarDivaCTA{display:flex;justify-content:center;align-items:center;min-height:38px;border-radius:10px;background:#082B74;color:#fff!important;text-decoration:none;font-size:8px;font-weight:800}
   @media(max-width:1180px){.radarLayout{grid-template-columns:1fr}.radarDivaPanel{position:static;min-height:auto}.radarMetricGrid{grid-template-columns:repeat(2,1fr)}.radarChartGrid{grid-template-columns:1fr 1fr}.radarOpportunityMap{grid-column:1/-1}}
   @media(max-width:760px){.radarApproved{padding:12px 12px 96px!important}.radarTopline>a{width:100%}.radarTopline>div{display:none}.radarHero{align-items:flex-start!important}.radarHero>div>div{display:grid;gap:7px}.radarHero h1{font-size:42px!important}.radarHero>span{display:none}.radarMetricGrid,.radarChartGrid{grid-template-columns:1fr}.radarOpportunityMap{grid-column:auto}.radarTR{grid-template-columns:1fr}.radarTH{display:none}.radarTR{padding:10px 0}.radarTR>span:nth-child(2):before{content:"Origem · "}.radarTR>span:nth-child(3):before{content:"Data · "}.radarTR>span:nth-child(4):before{content:"Rota · "}}
  \`}</style>
 </main>
}
export async function getServerSideProps({req}){const auth=requireOSAuth(req);if(auth.redirect)return auth;return{props:{...auth.props}}}
