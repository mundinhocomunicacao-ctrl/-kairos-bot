import React,{useMemo} from 'react';
import DivaAvatar2D from './DivaAvatar2D';
import useDivaVoicePresence from './useDivaVoicePresence';
import {divaVoiceConversationInstruction} from '../data/diva-voice-presence-contract';
import {OperationalBarChart} from './OperationalCharts';

const HOT=/negocia|resposta humana|interesse|budget|orçamento|pré-sele|material solicitado|rota útil|contato compartilhado/i;
const active=x=>Boolean(x?.nextAction)&&!/descart|perdid|cancelad|arquivad|encerrad/i.test(String(x?.status||''));
const displayName=email=>String(email||'Mundinho').split('@')[0]||'Mundinho';

export default function MoradaDesktopHome({email,projection,todayKey,greeting='Olá.'}){
 const pipeline=useMemo(()=>[...(projection?.currentCards||projection?.cards||projection?.operational?.pipeline||[])].filter(active),[projection]);
 const followups=useMemo(()=>[...(projection?.operational?.followups||[])].filter(active),[projection]);
 const signals=useMemo(()=>[...(projection?.operational?.radar||[])].slice(0,6),[projection]);
 const hot=pipeline.filter(x=>x.priority==='P0'||HOT.test(String(x.status||'')));
 const name=displayName(email);
 const livePulseItems=[
  {label:'Frentes ativas',value:pipeline.length,note:'projeção comercial atual'},
  {label:'Follow-ups',value:followups.length,note:'próximos movimentos'},
  {label:'Pedem atenção',value:hot.length,note:'prioridade ou resposta humana'},
  {label:'Sinais',value:signals.length,note:'radar materializado'}
 ];
 const voice=useDivaVoicePresence({
  faceId:'DIVA_RAIZ',
  onUtterance:async text=>{
   const r=await fetch('/api/ai-bridge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,history:[],attachments:[],context:`Mundinho OS · Morada Desktop · ${name}. ${divaVoiceConversationInstruction('DIVA_RAIZ')}`})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d?.message||'DIVA_HOME_VOICE_FAILED');
   return String(d?.answer||d?.message||'').trim();
  }
 });
 const activate=()=>{if(voice.speaking){voice.interruptAndListen();return}if(!voice.conversationOpen){voice.startSession();return}if(!voice.listening)voice.interruptAndListen()};
 const workspace=[
  ['Alexandria','Memória, contexto, decisões e evidência.','/os/explorer'],
  ['E-mails','Leitura e rascunhos com contexto.','/os/diva?context=e-mails'],
  ['CRM / Follow-up',`${pipeline.length} frentes materializadas agora.`,'/os/pipeline'],
  ['Propostas','Criação, revisão e histórico comercial.','/os/propostas'],
  ['Mensagens','Conversas e sinais autorizados.','/os/contatos'],
  ['Planilhas','Fontes governadas e dados operacionais.','/os/workspace'],
  ['Arquivos','Drive, documentos e evidências.','/os/workspace'],
  ['Configurações','Fontes, saúde, integrações e permissões.','/os/configuracoes']
 ];
 return <main className="moradaDesktop" data-area-mode="morada-desktop" data-canonical="MORADA_COMBINADA">
  <section className="moradaCenter">
   <section className="moradaConversation card">
    <header><div><small>DIVA</small><h1>Sua central de inteligência</h1><p>Converse, peça, crie, organize e mova o trabalho. O que estiver conectado aparece com evidência; o que ainda não estiver, não é inventado.</p></div><span>{name}</span></header>
    <div className="conversationGrid">
     <div className="orbiStage">
      <div className="ring ringA"/><div className="ring ringB"/>
      <button className="orbiButton" type="button" onClick={activate} aria-label="Conversar com a DIVA" data-orbi-source="MORADA_SPHERE_64"><DivaAvatar2D size="large" variant="morada" state={voice.listening?'listening':voice.speaking?'speaking':voice.thinking?'thinking':'ready'}/></button>
      <div className="sat mundo"><b>MUNDO</b><small>contexto</small></div>
      <div className="sat brain"><b>BRAIN</b><small>estratégia</small></div>
      <div className="sat pandora"><b>PANDORA</b><small>memória</small></div>
      <div className="sat kairos"><b>KAIROS</b><small>tempo + movimento</small></div>
      <div className="orbiState">{voice.listening?'Ouvindo você…':voice.thinking?'Entendendo…':voice.speaking?'Respondendo…':'Presente'}</div>
     </div>
     <div className="moradaTalk">
      <small>DIVA · CONVERSA</small><h2>{greeting} {name}.</h2>
      <p>Posso ler o que mudou, recuperar contexto, abrir uma frente ou transformar uma oportunidade em ação sem tirar você daqui.</p>
      <div className="moradaQuick">{pipeline.slice(0,4).map((x,i)=><a key={x.slug||x.title} href={'/os/pipeline/'+(x.slug||'')}>{i===0?'Priorizar agora':'Abrir frente'} · {x.title}<span>→</span></a>)}{!pipeline.length?<a href="/os/pipeline">Abrir Pipeline real<span>→</span></a>:null}</div>
     </div>
    </div>
    <div className="moradaComposer"><a href="/os/diva">Fale ou digite para a DIVA…</a><button type="button" onClick={voice.toggleMicMute}>{voice.micMuted?'🔇':'🎙'}</button><a href="/os/diva">→</a></div>
    <div className="moradaNote">Conversa ≠ memória · dados internos ≠ client-safe · writeback só vale após reread.</div>
   </section>

   <section className="moradaHub card">
    <header><div><small>INTELLIGENCE HUB</small><h2>Conexões e capacidades</h2></div><a href="/os/configuracoes">Ver estado →</a></header>
    <div className="hubGrid">
      <a href="/os/explorer"><b>Alexandria</b><span>Memória, contexto e evidência.</span><em>ativo</em></a>
      <a href="/os/pipeline"><b>CRM / Follow-up</b><span>{pipeline.length} frentes materializadas.</span><em>ativo</em></a>
      <a href="/os/propostas"><b>Propostas</b><span>Geração a partir do contexto comercial real.</span><em>ativo</em></a>
      <a href="/os/social"><b>Social Insights</b><span>Conteúdo, sinais e leitura multirrede.</span><em>ativo</em></a>
      <a href="/os/radar"><b>Radar</b><span>O que está mudando lá fora.</span><em>ativo</em></a>
      <a href="/os/workspace"><b>Drive / Arquivos</b><span>Documentos e evidências do MUNDO.</span><em>ativo</em></a>
    </div>
   </section>

   <section className="moradaLivePulse card" data-chart-source="LIVE_PROJECTION">
    <OperationalBarChart
      eyebrow="MESA · MOVIMENTO VIVO"
      title="O trabalho que está se movendo agora"
      items={livePulseItems}
      question="Onde há movimento real, atenção humana ou sinal novo nesta leitura?"
      source="CommercialCoreV1 + live projection"
      period="leitura atual"
      updatedAt={todayKey||'agora'}
      unit="itens"
      reading="A barra mostra volume operacional atual. Clique em uma linha para inspecionar a leitura; o total não substitui contexto, provenance ou próxima ação."
      limitation="Os grupos podem se sobrepor. Isto é uma leitura operacional da projeção atual, não uma soma de universo comercial."
    />
   </section>
  </section>

  <aside className="moradaRight">
   <section className="moradaKairos card"><header><div><small>HOJE</small><h2>KAIROS</h2></div><span>{todayKey}</span></header><div className="kairosRows"><div><b>{pipeline.length}</b><span>movimentos confirmados</span></div><div><b>{followups.length}</b><span>próximos movimentos</span></div><div><b>{hot.length}</b><span>itens pedindo atenção</span></div></div><p>KAIROS = tempo + movimento.</p></section>
   <section className="moradaConversationRadar card"><header><small>RADAR DE CONVERSAS</small><h2>O que mudou nas minhas conversas?</h2></header>{followups.length?<div className="conversationRows">{followups.slice(0,5).map(x=><a key={x.slug||x.title} href={'/os/pipeline/'+(x.slug||'')}><b>{x.title}</b><span>{x.nextAction}</span></a>)}</div>:<p>Nenhum movimento novo confirmado nesta leitura. Nada é simulado.</p>}<a href="/os/pipeline">Abrir Pipeline →</a></section>
   <section className="moradaSignals card"><header><small>MUDOU</small><h2>Sinais recentes</h2></header>{signals.length?signals.map(x=><a key={x.slug||x.title} href="/os/radar"><b>{x.title}</b><span>{x.summary||x.nextAction}</span></a>):<p>Sem sinal novo confirmado.</p>}</section>
  </aside>

  <section className="moradaWorkspace card">
   <header><div><small>SEU WORKSPACE</small><h2>Tudo parte da conversa.</h2></div><span>capacidades entram quando estão comprovadas</span></header>
   <div className="workspaceGrid">{workspace.map(([title,desc,href])=><a href={href} key={title}><b>{title}</b><span>{desc}</span><em>Explorar →</em></a>)}</div>
  </section>

  <style jsx global>{`
   .moradaDesktop{max-width:1540px;margin:0 auto;padding:16px 18px 96px 0;display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;color:#17111A;font-family:"DM Sans",Inter,system-ui,-apple-system,"Segoe UI",sans-serif}
   .moradaDesktop .card{background:#fff;border:1px solid #EDE3E8;border-radius:24px;box-shadow:none}.moradaCenter{display:grid;gap:16px}.moradaConversation{padding:24px}.moradaConversation>header,.moradaHub>header,.moradaWorkspace>header,.moradaKairos>header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start}.moradaConversation small,.moradaHub small,.moradaWorkspace small,.moradaRight small{font-size:8px;font-weight:900;letter-spacing:.14em;color:#175CFF}.moradaConversation h1{font:400 clamp(44px,5vw,64px)/.98 "DM Serif Display",Georgia,serif;letter-spacing:-.035em;margin:5px 0 10px}.moradaConversation>header p{max-width:760px;color:#6E6069;font-size:13px;line-height:1.55}.moradaConversation>header>span{font-size:9px;color:#6E6069}
   .conversationGrid{display:grid;grid-template-columns:310px minmax(0,1fr);gap:22px;align-items:center}.orbiStage{min-height:300px;position:relative;display:grid;place-items:center}.orbiButton{width:64px;height:64px;border:0;background:transparent;padding:0;cursor:pointer;position:relative;z-index:3}.ring{position:absolute;border:1px solid rgba(239,59,145,.14);border-radius:50%}.ringA{width:180px;height:180px}.ringB{width:230px;height:230px;border-style:dashed;opacity:.38}.sat{position:absolute;z-index:4;background:#fff;border:1px solid #EDE3E8;border-radius:14px;padding:8px 10px;display:grid;box-shadow:0 8px 22px rgba(23,92,255,.05)}.sat b{font-size:9px}.sat small{font-size:7px;color:#6E6069;letter-spacing:0}.sat.mundo{top:28px;left:12px}.sat.brain{top:30px;right:12px}.sat.pandora{bottom:44px;left:8px}.sat.kairos{bottom:42px;right:8px}.orbiState{position:absolute;bottom:12px;font-size:9px;font-weight:800;color:#B10C59}
   .moradaTalk{background:#F4F7FF;border:1px solid #DCE8FF;border-radius:20px;padding:20px}.moradaTalk h2{font:400 30px/1.05 "DM Serif Display",Georgia,serif;margin:5px 0 9px}.moradaTalk p{font-size:12px;line-height:1.55;color:#6E6069}.moradaQuick{display:grid;gap:7px;margin-top:14px}.moradaQuick a{display:flex;justify-content:space-between;gap:12px;border:1px solid #E7ECFA;border-radius:999px;padding:10px 12px;background:#fff;text-decoration:none;color:#17111A;font-size:9px}.moradaQuick span{color:#175CFF}
   .moradaComposer{display:grid;grid-template-columns:1fr auto auto;gap:7px;align-items:center;border:1px solid #EDE3E8;border-radius:999px;padding:7px;margin-top:10px}.moradaComposer>a:first-child{padding:9px 12px;color:#8A8188;text-decoration:none}.moradaComposer button,.moradaComposer>a:last-child{border:0;border-radius:999px;background:#17111A;color:#fff;width:34px;height:34px;display:grid;place-items:center;text-decoration:none;cursor:pointer}.moradaNote{font-size:7px;color:#8A8188;margin:8px 4px 0}
   .moradaHub{padding:20px}.moradaLivePulse{padding:18px}.moradaLivePulse .opChart{border:0!important;padding:0!important}.moradaHub h2,.moradaWorkspace h2,.moradaRight h2{font:400 26px "DM Serif Display",Georgia,serif;margin:4px 0}.moradaHub header>a,.moradaConversationRadar>a{font-size:9px;color:#175CFF;text-decoration:none;font-weight:800}.hubGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.hubGrid a{display:grid;gap:5px;border:1px solid #EDE3E8;border-radius:16px;padding:14px;text-decoration:none;color:#17111A;background:#FAF9F6}.hubGrid b{font-size:10px}.hubGrid span{font-size:8px;line-height:1.4;color:#6E6069}.hubGrid em{font-style:normal;font-size:7px;color:#175CFF}
   .moradaRight{display:grid;align-content:start;gap:16px}.moradaRight>.card{padding:18px}.moradaRight p{font-size:9px;line-height:1.5;color:#6E6069}.kairosRows{display:grid;gap:8px;margin:14px 0}.kairosRows div{display:flex;align-items:baseline;gap:8px;padding:10px;background:#F7F7F5;border-radius:14px}.kairosRows b{font-size:24px}.kairosRows span{font-size:8px;color:#6E6069}.conversationRows,.moradaSignals{display:grid;gap:7px}.conversationRows a,.moradaSignals>a{display:grid;gap:3px;padding:10px 0;border-bottom:1px solid #F0E8EE;text-decoration:none;color:#17111A}.conversationRows b,.moradaSignals b{font-size:9px}.conversationRows span,.moradaSignals span{font-size:8px;line-height:1.4;color:#6E6069}
   .moradaWorkspace{grid-column:1/-1;padding:20px}.moradaWorkspace>header>span{font-size:8px;color:#6E6069}.workspaceGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#EDE3E8;border:1px solid #EDE3E8;margin-top:14px}.workspaceGrid a{display:grid;gap:5px;background:#fff;padding:14px;text-decoration:none;color:#17111A}.workspaceGrid b{font-size:10px}.workspaceGrid span{font-size:8px;line-height:1.4;color:#6E6069}.workspaceGrid em{font-size:8px;font-style:normal;color:#175CFF;margin-top:5px}
   @media(max-width:1180px){.moradaDesktop{grid-template-columns:1fr;padding-right:14px}.moradaRight{grid-template-columns:repeat(3,1fr)}.moradaWorkspace{grid-column:1}.hubGrid{grid-template-columns:repeat(2,1fr)}}
   @media(max-width:820px){.conversationGrid{grid-template-columns:1fr}.orbiStage{min-height:280px}.moradaRight{grid-template-columns:1fr}.workspaceGrid{grid-template-columns:repeat(2,1fr)}}
   @media(max-width:560px){.moradaDesktop{padding:12px}.moradaConversation{padding:16px}.moradaConversation h1{font-size:40px}.orbiStage{min-height:250px}.orbiButton{width:64px;height:64px}.ringA{width:160px;height:160px}.ringB{width:210px;height:210px}.hubGrid,.workspaceGrid{grid-template-columns:1fr}}
  `}</style>
 </main>
}
