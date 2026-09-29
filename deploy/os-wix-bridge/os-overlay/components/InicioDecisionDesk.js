import React,{useEffect,useMemo,useState} from 'react';
import {formatDateKeyLongPtBr,formatDateShortPtBr} from '../lib/ssr-display-format';
import {greetingForSaoPaulo} from '../lib/daypart-greeting';
import ContextOpenButton from './ContextOpenButton';
import ManualCommercialUpdate from './ManualCommercialUpdate';
import DivaAvatar2D from './DivaAvatar2D';
import useDivaVoicePresence from './useDivaVoicePresence';
import {divaVoiceConversationInstruction} from '../data/diva-voice-presence-contract';

const HOT=/negocia|resposta humana|interesse|budget|orçamento|pré-sele|material solicitado|rota útil|contato compartilhado/i;
const INACTIVE=/descart|perdid|cancelad|arquivad|encerrad|sem ação comercial ativa/i;
function actionable(x){return Boolean(x?.nextAction)&&!INACTIVE.test(`${x.status||''} ${x.nextAction||''}`)}
function score(x){let n=0;if(x.priority==='P0')n+=120;if(x.priority==='P1')n+=60;if(HOT.test(x.status||''))n+=45;if(x.lastInteraction)n+=8;if(x.nextAction)n+=10;return n}
function shortDate(value){return value?formatDateShortPtBr(value):'Agora'}
function Pill({value}){return <span className={HOT.test(value||'')?'state hot':'state'}>{value||'em contexto'}</span>}
function ActionRow({item}){const context={kind:'opportunity',title:item.title,status:item.status,summary:item.summary,nextAction:item.nextAction,events:item.history||[],evidence:item.evidence||[],provenance:item.provenance,sourceArea:'Mesa'};return <article className="mesaAction"><div><b>{item.title}</b><span>{item.nextAction||item.summary}</span></div><Pill value={item.priority||item.status}/><em>{shortDate(item.nextActionDate||item.lastInteraction)}</em><div className="rowActions"><ContextOpenButton context={context}/><a href={'/os/pipeline/'+item.slug}>Abrir</a></div></article>}

export default function InicioDecisionDesk({email,projection,todayKey,greeting='Olá.'}){
 const[liveGreeting,setLiveGreeting]=useState(greeting);
 useEffect(()=>{const refresh=()=>setLiveGreeting(greetingForSaoPaulo());refresh();const timer=setInterval(refresh,60000);return()=>clearInterval(timer)},[]);
 const pipeline=useMemo(()=>[...(projection?.currentCards||projection?.cards||[])].filter(actionable).sort((a,b)=>score(b)-score(a)),[projection]);
 const followups=useMemo(()=>[...(projection?.operational?.followups||[])].filter(actionable).sort((a,b)=>String(a.nextActionDate||'').localeCompare(String(b.nextActionDate||''))),[projection]);
 const signals=useMemo(()=>[...(projection?.operational?.radar||[])].slice(0,5),[projection]);
 const now=pipeline.slice(0,4);
 const hot=pipeline.filter(x=>x.priority==='P0'||HOT.test(x.status||'')).slice(0,4);
 const moving=followups.slice(0,4);
 const continueItem=now[0]||moving[0]||null;
 const today=formatDateKeyLongPtBr(todayKey);
 const displayName=String(email||'').split('@')[0]||'Mundinho';
 const counters=[
  {label:'follow-ups pendentes',value:followups.length,href:'/os/pipeline'},
  {label:'frentes pedindo atenção',value:hot.length,href:'/os/pipeline'},
  {label:'sinais novos',value:signals.length,href:'/os/radar'},
  {label:'frentes ativas',value:pipeline.length,href:'/os/pipeline'}
 ];
 const divaHomeVoice=useDivaVoicePresence({
  faceId:'DIVA_RAIZ',
  onUtterance:async text=>{
    const response=await fetch('/api/ai-bridge',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        message:text,
        history:[],
        attachments:[],
        context:`Mundinho OS · Mesa · ${displayName} · presença de voz silenciosa. Preserve contexto autorizado e não exponha linguagem técnica interna.\n${divaVoiceConversationInstruction('DIVA_RAIZ')}`
      })
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.message||'DIVA_HOME_VOICE_FAILED');
    return String(data?.answer||data?.message||'').trim();
  }
 });
 function activateHomeDiva(){
  if(divaHomeVoice.speaking){divaHomeVoice.interruptAndListen();return}
  if(!divaHomeVoice.conversationOpen){divaHomeVoice.startSession();return}
  if(!divaHomeVoice.listening)divaHomeVoice.interruptAndListen();
 }
 const workspace=[
  ['Alexandria','Memória, contexto e estratégia','/os/brain'],
  ['E-mails','Comunique com contexto','/os/diva?context=e-mails'],
  ['CRM / Follow-up','Acompanhe relações e oportunidades','/os/contatos'],
  ['Propostas','Crie, revise e organize propostas','/os/propostas'],
  ['Mensagens','Concentre conversas e sinais','/os/contatos'],
  ['Planilhas','Leia e atualize dados operacionais','/os/workspace'],
  ['Canva','Produção visual conectada','/os/workspace'],
  ['Drive / Arquivos','Arquivos e evidências do MUNDO','/os/workspace']
 ];
 return <main className="mesaRef" data-area-mode="decision-surface" data-visual-reference="mesa-20260926" data-canonical-status="HUMAN_APPROVED_TARGET" data-regression-status="RESTORED" data-authority="LAST_HUMAN_APPROVED" data-governance="DIVA_PANDORA">
  <section className="mesaMain">
   <div className="mesaEyebrow">DIVA / MESA</div>
   <h1>Sua central de inteligência</h1>
   <p className="mesaLead">Converse, peça, crie, organize e mova o negócio com a DIVA. Inteligência, memória, estratégia e execução em um só lugar.</p>

   <div className="mesaHero">
    <div className="divaOrbWrap">
      <div className="orbit orbit1"/><div className="orbit orbit2"/>
      <button type="button" className={"divaOrb state-"+divaHomeVoice.state} onClick={activateHomeDiva} aria-label="Conversar com a DIVA" aria-pressed={divaHomeVoice.conversationOpen}><DivaAvatar2D size="hero" state={divaHomeVoice.listening?"listening":divaHomeVoice.speaking?"speaking":divaHomeVoice.thinking?"thinking":"ready"}/></button><div className="divaOrbControls" data-orbi-voice-menu="true"><button type="button" className={'divaOrbMic '+(divaHomeVoice.micMuted?'is-muted':'')} onClick={divaHomeVoice.toggleMicMute} aria-pressed={divaHomeVoice.micMuted} aria-label={divaHomeVoice.micMuted?'Desmutar microfone':'Mutar microfone'}>{divaHomeVoice.micMuted?'🔇 Microfone':'🎙 Microfone'}</button><button type="button" className="divaOrbStop" onClick={divaHomeVoice.stopSession} disabled={!divaHomeVoice.conversationOpen}>Parar</button></div>
    </div>
    <div className="divaTalk">
      <small>DIVA</small>
      <h2>{liveGreeting} {displayName}.</h2>
      <p>Estou pronta para ler o que mudou, cruzar contexto e abrir a próxima ação sem tirar você da Mesa.</p>
      <div className="quickActions">
       {now.slice(0,4).map((x,i)=><a href={'/os/pipeline/'+x.slug} key={x.slug}>{i===0?'Priorizar agora':'Abrir frente'} · {x.title}<span>→</span></a>)}
       {!now.length&&<a href="/os/diva">Perguntar à DIVA o que fazer agora<span>→</span></a>}
      </div>
    </div>
   </div>

   <div className="commandBar">
    <a href="/os/diva">Fale ou digite para operar a DIVA…</a>
    <div><a href="/os/diva?mode=image">Imagem</a><a href="/os/diva?mode=video">Vídeo</a><a href="/os/diva?mode=attachment">Anexo</a><a href="/os/workspace">Drive</a><a href="/os/busca">Pesquisa</a></div>
   </div>

   <ManualCommercialUpdate/>

   <section className="moradaParityGrid" aria-label="Estrutura principal da Morada">
    <article className="moradaHub"><header><div><small>INTELLIGENCE HUB</small><h2>Conexões e capacidades</h2></div><a href="/os/configuracoes">Ver estado →</a></header><div className="moradaHubGrid">
      <a href="/os/explorer"><b>Alexandria</b><span>Memória, contexto e evidência.</span></a>
      <a href="/os/contatos"><b>CRM / Follow-up</b><span>{pipeline.length} frentes materializadas.</span></a>
      <a href="/os/propostas"><b>Propostas</b><span>Criação, revisão e histórico comercial.</span></a>
      <a href="/os/workspace"><b>Drive / Arquivos</b><span>Documentos e entregáveis do MUNDO.</span></a>
    </div></article>
    <article className="moradaToday"><header><small>HOJE</small><h2>KAIROS</h2></header><div className="moradaTodayRows"><span><b>{pipeline.length}</b> movimentos confirmados</span><span><b>{followups.length}</b> próximos movimentos</span><span><b>{hot.length}</b> itens pedindo atenção</span></div></article>
    <article className="moradaRadarConversations"><header><small>RADAR DE CONVERSAS</small><h2>O que mudou nas conversas?</h2></header><p>{followups.length?'Há movimentos materializados na fila comercial. Abra Pipeline para agir com contexto.':'Nenhum movimento novo confirmado nesta leitura; nada é inventado.'}</p><a href="/os/pipeline">Abrir Pipeline →</a></article>
   </section>

   <section className="workspace">
    <header><div><h2>Seu Workspace</h2><p>Acesse os módulos da DIVA. Tudo conectado a partir de uma conversa.</p></div><a href="/os/personalizada">Personalizar</a></header>
    <div className="workspaceGrid">{workspace.map(([title,desc,href])=><a href={href} className="workspaceCard" key={title}><b>{title}</b><span>{desc}</span><em>Explorar →</em></a>)}</div>
   </section>
  </section>

  <aside className="mesaRail">
   <section><header><h3>Hoje</h3><span>{today}</span></header><div className="counterList">{counters.map(x=><a href={x.href} key={x.label}><b>{x.value}</b><span>{x.label}</span><em>›</em></a>)}</div></section>
   {now.length?<section><header><h3>Próximas ações sugeridas</h3></header><div className="suggestions">{now.map(x=><a href={'/os/pipeline/'+x.slug} key={x.slug}>• {x.nextAction||x.title}</a>)}</div></section>:null}
   {signals.length?<section><header><h3>MUDOU</h3></header><div className="suggestions">{signals.map(x=><a href="/os/radar" key={x.slug||x.title}>• {x.title}</a>)}</div></section>:null}
   {hot.length?<section><header><h3>PRECISA DE VOCÊ</h3></header><div className="suggestions">{hot.map(x=><a href={'/os/pipeline/'+x.slug} key={'you:'+x.slug}>• {x.title}</a>)}</div></section>:null}
   {moving.length?<section><header><h3>EM MOVIMENTO</h3></header><div className="suggestions">{moving.map(x=><a href={'/os/pipeline/'+x.slug} key={'moving:'+x.slug}>• {x.nextAction||x.title}</a>)}</div></section>:null}
   {continueItem?<section><header><h3>CONTINUAR</h3></header><div className="suggestions"><a href={'/os/pipeline/'+continueItem.slug}>• {continueItem.title} — {continueItem.nextAction}</a></div></section>:null}
   <section className="railDiva"><button type="button" className="railDivaVoice" onClick={activateHomeDiva} aria-label="Conversar com a DIVA"><DivaAvatar2D size="compact" state={divaHomeVoice.listening?"listening":divaHomeVoice.speaking?"speaking":divaHomeVoice.thinking?"thinking":"ready"}/></button><div><b>DIVA sempre com você</b><span>{divaHomeVoice.micMuted?"Microfone mutado. A DIVA continua presente.":divaHomeVoice.listening?"Ouvindo você…":divaHomeVoice.thinking?"Entendendo…":divaHomeVoice.speaking?"Respondendo… pode interromper quando quiser.":"Toque para abrir uma conversa por voz."}</span><div className="railDivaVoiceControls" data-orbi-voice-menu="true"><button type="button" className="railDivaMic" onClick={divaHomeVoice.toggleMicMute} aria-pressed={divaHomeVoice.micMuted}>{divaHomeVoice.micMuted?'🔇 Microfone':'🎙 Microfone'}</button><button type="button" className="railDivaStop" onClick={divaHomeVoice.stopSession} disabled={!divaHomeVoice.conversationOpen}>Parar</button></div></div><a href="/os/diva">→</a></section>
  </aside>

  {now.length?<section className="mesaNow">
   <header><small>AGORA</small><h2>O que pede movimento.</h2></header>
   <div>{now.map(x=><ActionRow key={x.slug} item={x}/>)}</div>
  </section>:null}

  <style jsx global>{`
   .mesaRef{max-width:1540px;margin:0 auto;padding:24px clamp(18px,3vw,42px) 100px;display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:18px;color:var(--mundo-ink,#121216);background:linear-gradient(180deg,#F7F4EE 0%,#F2EFE8 100%)}
   .mesaMain,.mesaRail>section,.mesaNow{background:rgba(255,255,255,.82);border:1px solid rgba(17,24,39,.07);border-radius:28px;box-shadow:0 12px 36px rgba(52,38,45,.05)}
   .mesaMain{padding:26px}.mesaEyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;color:#175CFF}.mesaRef h1{font:400 clamp(44px,5vw,72px)/.96 var(--mundo-display,Georgia,serif);letter-spacing:-.055em;margin:8px 0 10px}.mesaLead{max-width:790px;font-size:14px;line-height:1.55;color:var(--mundo-muted)}
   .moradaParityGrid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(240px,.7fr);gap:14px;margin:16px 0 18px}.moradaParityGrid>article{background:#fff;border:1px solid rgba(17,24,39,.07);border-radius:24px;padding:18px}.moradaParityGrid header{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.moradaParityGrid small{font-size:8px;font-weight:900;letter-spacing:.13em;color:#175CFF}.moradaParityGrid h2{margin:4px 0 0;font-size:21px;letter-spacing:-.035em}.moradaParityGrid a{text-decoration:none}.moradaHub{grid-row:span 2}.moradaHubGrid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:15px}.moradaHubGrid a{display:grid;gap:5px;padding:14px;border:1px solid #E8E4DE;border-radius:16px;color:#17111A;background:#FAF9F6}.moradaHubGrid b{font-size:11px}.moradaHubGrid span{font-size:9px;color:#6E6069;line-height:1.4}.moradaTodayRows{display:grid;gap:9px;margin-top:14px}.moradaTodayRows span{display:flex;gap:8px;align-items:baseline;font-size:9px;color:#6E6069}.moradaTodayRows b{font-size:23px;color:#17111A}.moradaRadarConversations p{font-size:10px;line-height:1.5;color:#6E6069}.moradaRadarConversations>a{font-size:9px;font-weight:900;color:#175CFF}@media(max-width:860px){.moradaParityGrid{grid-template-columns:1fr}.moradaHub{grid-row:auto}.moradaHubGrid{grid-template-columns:1fr 1fr}}
   .mesaHero{display:grid;grid-template-columns:minmax(330px,.95fr) minmax(320px,1.05fr);gap:26px;align-items:center;margin:28px 0 18px}.divaOrbWrap{position:relative;min-height:410px;display:grid;place-items:center}.divaOrb{appearance:none;border:0;padding:0;cursor:pointer;font:inherit;width:285px;height:285px;border-radius:50%;display:grid;place-items:center;background:transparent;box-shadow:none;position:relative;z-index:2}.divaOrbControls{position:absolute;left:50%;bottom:-40px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;z-index:5}.divaOrbMic,.divaOrbStop{border:1px solid var(--mundo-line,#E5E7EB);background:#fff;border-radius:999px;padding:7px 11px;font-size:8px;font-weight:900;cursor:pointer;white-space:nowrap}.divaOrbMic.is-muted{background:#271d23;color:#fff;border-color:#271d23}.divaOrbStop:disabled{opacity:.34;cursor:default}.railDivaVoiceControls{display:flex;align-items:center;gap:7px;margin-top:6px}.railDivaMic,.railDivaStop{border:0;background:transparent;color:#D2247B;font-size:8px;font-weight:900;cursor:pointer;padding:0}.railDivaStop:disabled{opacity:.4;cursor:default}.divaOrb:focus-visible{outline:3px solid rgba(23,92,255,.34);outline-offset:6px}.orbit{position:absolute;border:1px solid rgba(217,74,134,.18);border-radius:50%;animation:orbitSpin 28s linear infinite}.orbit1{width:350px;height:350px}.orbit2{width:390px;height:390px;animation-direction:reverse;animation-duration:36s}
   .divaTalk{background:linear-gradient(180deg,#F3F6FF,#FBFCFF);border:1px solid rgba(23,92,255,.14);border-radius:22px;padding:22px}.divaTalk small{font-size:9px;font-weight:900;color:#175CFF}.divaTalk h2{font-size:26px;margin:5px 0 8px}.divaTalk p{font-size:12px;line-height:1.55;color:var(--mundo-muted)}.quickActions{display:grid;gap:8px;margin-top:16px}.quickActions a{display:flex;justify-content:space-between;gap:12px;align-items:center;text-decoration:none;color:inherit;background:white;border:1px solid rgba(17,24,39,.07);border-radius:999px;padding:11px 14px;font-size:9px}.quickActions span{color:#175CFF}
   .commandBar{border:1px solid rgba(17,24,39,.08);border-radius:24px;padding:12px 14px;background:white}.commandBar>a{display:block;padding:10px 12px;text-decoration:none;color:#8b8790;border:1px solid #eee8eb;border-radius:999px}.commandBar>div{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.commandBar>div a{font-size:8px;text-decoration:none;color:#35313a;border:1px solid #eee8eb;border-radius:999px;padding:7px 10px}
   .workspace{margin-top:22px}.workspace header{display:flex;justify-content:space-between;gap:18px;align-items:end}.workspace h2{font:400 26px var(--mundo-display,Georgia,serif);margin:0}.workspace p{font-size:9px;color:var(--mundo-muted);margin:3px 0 0}.workspace header>a{font-size:9px;color:#175CFF;text-decoration:none}.workspaceGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:12px}.workspaceCard{display:block;text-decoration:none;color:inherit;border:1px solid rgba(17,24,39,.07);border-radius:18px;padding:14px;background:white;min-height:118px}.workspaceCard b{display:block;font-size:11px}.workspaceCard span{display:block;font-size:8px;line-height:1.45;color:var(--mundo-muted);margin-top:5px}.workspaceCard em{display:inline-block;font-style:normal;font-size:8px;color:#175CFF;margin-top:14px}
   .railMesh div{display:grid;gap:4px;margin:10px 0}.railMesh div b{font-size:16px}.railMesh div span,.railMesh>a{font-size:8px;line-height:1.45;color:var(--mundo-muted);text-decoration:none}.railMesh>a{color:#175CFF;font-weight:900}.mesaRail{display:grid;gap:14px;align-content:start}.mesaRail>section{padding:16px}.mesaRail header{display:flex;justify-content:space-between;align-items:center;gap:12px}.mesaRail h3{margin:0;font-size:17px}.mesaRail header span{font-size:8px;color:var(--mundo-muted)}.counterList{display:grid;gap:8px;margin-top:12px}.counterList a{display:grid;grid-template-columns:36px 1fr 12px;gap:8px;align-items:center;text-decoration:none;color:inherit;background:#F5F7FC;border-radius:18px;padding:12px}.counterList b{font-size:21px}.counterList span{font-size:9px;color:var(--mundo-muted)}.counterList em{font-style:normal}.suggestions{display:grid;gap:9px;margin-top:12px}.suggestions a,.suggestions span{font-size:9px;line-height:1.45;color:#4f4851;text-decoration:none}.railDiva{display:grid!important;grid-template-columns:42px 1fr 20px;gap:10px;align-items:center;background:linear-gradient(135deg,#243B6B,#175CFF)!important;color:white}.railDiva b,.railDiva span{display:block}.railDiva b{font-size:11px}.railDiva span{font-size:8px;color:#DCE6FF;margin-top:3px}.railDiva a{color:white;text-decoration:none}.railDivaVoice{appearance:none;border:0;background:transparent;padding:0;cursor:pointer;display:grid;place-items:center}
   .mesaNow{grid-column:1/-1;padding:22px;display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px}.mesaNow small{font-size:9px;font-weight:900;letter-spacing:.14em;color:#175CFF}.mesaNow h2{font:400 30px var(--mundo-display,Georgia,serif);margin:5px 0}.mesaNow p{font-size:9px;color:var(--mundo-muted)}.mesaAction{display:grid;grid-template-columns:minmax(0,1fr) auto auto auto;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid #eee8eb}.mesaAction:last-child{border-bottom:0}.mesaAction b{display:block;font-size:11px}.mesaAction div>span{display:block;font-size:8px;color:var(--mundo-muted);margin-top:3px}.mesaAction em{font-style:normal;font-size:7px;color:var(--mundo-muted)}.state{font-size:7px;border:1px solid #eee8eb;border-radius:999px;padding:5px 6px;color:var(--mundo-muted)}.state.hot{color:#175CFF;background:#EEF3FF}.rowActions{display:flex;gap:5px}.rowActions>a{font-size:8px;font-weight:900;color:#175CFF;text-decoration:none}

   /* MORADA/DIVA VISUAL RECONCILIATION · source parity with live Wix bridge */
   .mesaRef{max-width:1560px;margin:0 auto;padding:16px 16px 96px 0;grid-template-columns:minmax(0,1fr) 330px;gap:16px;background:transparent;font-family:"DM Sans",Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
   .mesaMain,.mesaRail>section,.mesaNow{background:#fff;border:1px solid #EDE3E8;border-radius:24px;box-shadow:none}.mesaMain{padding:26px}
   .mesaEyebrow{color:#175CFF;font-size:11px;font-weight:700;letter-spacing:.18em}.mesaRef h1{font-family:"DM Serif Display",Georgia,"Times New Roman",serif;font-size:clamp(40px,4.2vw,56px);line-height:1.03;letter-spacing:-.025em;font-weight:400}
   .mesaLead{font-size:16px;color:#4A3B46;max-width:720px}.mesaHero{grid-template-columns:380px minmax(0,1fr);gap:16px;margin:8px 0 14px}.divaOrbWrap{width:380px;min-height:370px}
   .divaOrb{width:270px;height:270px;background:transparent;box-shadow:none}
   .divaOrb strong{font:700 58px/1 "DM Sans",Inter,sans-serif;letter-spacing:-.02em;color:#fff;text-shadow:0 2px 18px rgba(11,67,201,.25)}.orbit1{width:350px;height:350px;border-color:rgba(23,92,255,.16)}.orbit2{display:none}
   .sat b{font-size:11px}.sat small{font-size:10px;color:#6E6069}
   .divaTalk{background:#F4F7FF;border:1px solid #DCE8FF;border-radius:20px;padding:16px}.divaTalk small{color:#0B43C9}.divaTalk h2{font-family:"DM Serif Display",Georgia,serif;font-weight:400;font-size:30px}.divaTalk p{font-size:14px;color:#6E6069}
   .commandBar{margin-top:14px;padding:7px;border:1px solid #EDE3E8;border-radius:999px;background:#fff;box-shadow:0 10px 26px rgba(23,92,255,.06)}
   .workspace{margin-top:20px;border-top:1px solid #EDE3E8;padding-top:20px}.workspace h2{font-family:"DM Serif Display",Georgia,serif;font-size:30px}.workspaceGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid #EDE3E8}
   .workspaceCard{min-height:auto;border:0;border-bottom:1px solid #EDE3E8;border-radius:0;background:transparent;padding:16px 10px}.workspaceCard:nth-child(odd){border-right:1px solid #EDE3E8}
   .mesaRail{gap:16px}.mesaRail>section{padding:20px}.counterList a{background:#F5F7FC;border-radius:16px}.railDiva{background:#17111A!important}

   @keyframes divaOrbFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.012)}}@keyframes divaSpeakPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.025);filter:brightness(1.05)}}@keyframes orbitSpin{to{transform:rotate(360deg)}}
   @media(prefers-reduced-motion:reduce){.divaOrb,.orbit{animation:none!important}}
   @media(max-width:1180px){.mesaRef{grid-template-columns:1fr}.mesaRail{grid-template-columns:repeat(2,minmax(0,1fr))}.workspaceGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
   @media(max-width:820px){.mesaRef{padding:14px}.mesaHero{grid-template-columns:1fr;min-width:0}.divaOrbWrap{width:100%;min-width:0;min-height:350px}.divaOrb{width:240px;height:240px}.orbit1{width:300px;height:300px}.orbit2{width:330px;height:330px}.mesaRail{grid-template-columns:1fr}.mesaNow{grid-template-columns:1fr}.workspaceGrid{grid-template-columns:1fr 1fr}}
   @media(max-width:560px){.mesaMain{padding:18px}.workspaceGrid{grid-template-columns:1fr}.mesaAction{grid-template-columns:minmax(0,1fr) auto}.mesaAction em{display:none}.rowActions{grid-column:1/-1}}
  `}</style>
 </main>
}