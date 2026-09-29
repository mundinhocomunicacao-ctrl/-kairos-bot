import React,{useEffect,useMemo,useState} from 'react';
import {useRouter} from 'next/router';
import {requireOSAuth} from '../../lib/os-auth';
import ContextualDivaDock from '../../components/ContextualDivaDock';
import {OperationalBarChart} from '../../components/OperationalCharts';
import {BRAIN_DASHBOARD_SNAPSHOT as BRAIN} from '../../data/brain-dashboard-snapshot';
import {CRM_OPERATIONAL_SNAPSHOT} from '../../data/crm-operational-snapshot-current';
import {OS_CARDS} from '../../data/os-cards';
import {collectOpportunityResearch,buildOpportunityPrompt} from '../../data/opportunity-prompt-mother';
import {PROPOSAL_GENERATOR_CONTRACT,proposalVisualMemoryFor,proposalGeneratorContext} from '../../data/proposal-generator-contract';

const candidateLabel=x=>x.organization||x.segment||x.title||'Oportunidade';
const evidenceLabel=x=>x.stage||x.status||'contexto materializado';
const proposalCandidateRows=()=>[
  ...(CRM_OPERATIONAL_SNAPSHOT.pipeline||[]),
  ...(OS_CARDS.propostas||[]),
  ...(BRAIN.opportunities||[])
].map((row,index)=>({...row,id:row.id||row.opportunityId||row.slug||('proposal-'+index)}));
const dedupeProposalCandidates=rows=>{const seen=new Set();return rows.filter(row=>{const key=String(row.organization||row.title||row.segment||row.id||'').trim().toLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true})};

export default function Propostas({email}){
  const router=useRouter();
  const candidates=useMemo(()=>dedupeProposalCandidates(proposalCandidateRows()).slice(0,48),[]);
  const[selectedId,setSelectedId]=useState(candidates[0]?.id||'');
  const[brief,setBrief]=useState('');
  const[proposalFormat,setProposalFormat]=useState('ONE_PAGE');
  const[proposalOrientation,setProposalOrientation]=useState('HORIZONTAL');
  const[answer,setAnswer]=useState('');
  const[busy,setBusy]=useState(false);
  const[error,setError]=useState('');
  const[researchState,setResearchState]=useState('');
  const[approved,setApproved]=useState(false);
  const[scannerPass,setScannerPass]=useState(false);
  const[packaged,setPackaged]=useState(false);
  const[scannerReceipt,setScannerReceipt]=useState('');
  const[packagePdfRef,setPackagePdfRef]=useState('');
  const[packageJpegRef,setPackageJpegRef]=useState('');
  const[selectedVersion,setSelectedVersion]=useState('');
  const[missionId,setMissionId]=useState('');
  useEffect(()=>{if(!router.isReady)return;const wanted=String(router.query.context||'').trim().toLowerCase();if(!wanted)return;const hit=candidates.find(x=>candidateLabel(x).toLowerCase().includes(wanted)||wanted.includes(candidateLabel(x).toLowerCase()));if(hit)setSelectedId(hit.id)},[router.isReady,router.query.context,candidates]);
  const selected=candidates.find(x=>String(x.id)===String(selectedId))||candidates[0]||null;
  const brand=selected?candidateLabel(selected):'';
  const visualMemory=proposalVisualMemoryFor(brand);
  const resetDraft=()=>{setAnswer('');setApproved(false);setScannerPass(false);setPackaged(false);setScannerReceipt('');setPackagePdfRef('');setPackageJpegRef('');setSelectedVersion('');setError('');setResearchState('')};
  async function invokeDiva(message,context){
    const r=await fetch('/api/os-morada-flow',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      message,
      mission_id:missionId||undefined,
      currentRoute:'/os/propostas',
      conversation_ref:'os://propostas',
      context
    })});
    const nextMission=String(r.headers.get('x-diva-mission-id')||'').trim();
    if(nextMission)setMissionId(nextMission);
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.message||data.error||'Falha no fluxo DIVA/Morada.');
    return data;
  }

  async function generate(){
    if(!selected||busy)return;
    setBusy(true);resetDraft();setResearchState('Pesquisando evidências públicas…');
    try{
      const research=await collectOpportunityResearch({brand});
      setResearchState('Montando proposta com Prompt‑Mãe + memória visual + provenance…');
      const basePrompt=buildOpportunityPrompt({brand,talent:selected.talentFit||'talento a validar',card:{...selected,summary:[selected.scope,brief].filter(Boolean).join(' · ')},research});
      const governed=[basePrompt,proposalGeneratorContext({brand}),'FORMAT: '+proposalFormat,'ORIENTATION: '+proposalOrientation,'SAÍDA: gere somente um DRAFT_GENERATED. Não declare APPROVED, SCANNER_PASS, MATERIALIZED ou PACKAGED.'].join('\n\n');
      const data=await invokeDiva(governed,'Mundinho OS · GERADOR DE PROPOSTAS · DRAFT_GENERATED only · preservar provenance e versão');
      const text=String(data.answer||data.message||'').trim();
      if(!text)throw new Error('A geração não retornou conteúdo materializável.');
      setAnswer(text);setSelectedVersion('DRAFT_GENERATED');setResearchState('DRAFT_GENERATED · aguardando revisão humana.');
    }catch(e){setError(String(e?.message||e));setResearchState('')}finally{setBusy(false)}
  }

  async function reviseDraft(mode){
    if(!answer||busy)return;
    setBusy(true);setError('');setResearchState(mode==='refine'?'Refinando o DRAFT_GENERATED sem promover estado…':'Regenerando o DRAFT_GENERATED sem promover estado…');
    try{
      const prompt=(mode==='refine'
        ?'Refine este DRAFT_GENERATED preservando fatos, provenance, marca, talento, escopo e intenção. Melhore clareza, argumento e executabilidade sem inventar informação.'
        :'Regere uma alternativa materialmente diferente para este DRAFT_GENERATED, preservando os mesmos fatos e provenance. Não promova estado.')+'\n\nMARCA: '+brand+'\nBRIEF: '+brief+'\nDRAFT ATUAL:\n'+answer;
      const d=await invokeDiva(prompt,'Mundinho OS · Propostas · revisão inline · DRAFT_GENERATED only');
      const next=String(d.answer||d.message||'').trim();
      if(!next)throw new Error('A revisão não retornou conteúdo.');
      setAnswer(next);setApproved(false);setSelectedVersion('DRAFT_GENERATED');setResearchState('DRAFT_GENERATED atualizado · aguardando revisão humana.');
    }catch(e){setError(String(e?.message||e));setResearchState('')}finally{setBusy(false)}
  }

  async function approveDraft(){
    if(!answer||approved||busy)return;
    setBusy(true);setError('');setResearchState('Registrando aprovação humana separada…');
    try{
      const r=await fetch('/api/mundo-ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        text:'[PROPOSAL_STATE_TRANSITION]\nFROM: DRAFT_GENERATED\nTO: APPROVED\nBRAND: '+brand+'\nHUMAN_APPROVAL: true\nVERSION_FINGERPRINT: '+String(answer).slice(0,240),
        source:'proposal_generator_human_approval',
        sourceId:'proposal-approval:'+Date.now(),
        channel:'mundinho_os',
        surface:'propostas',
        attachments:[]
      })});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.status==='failed')throw new Error(d.reason||d.message||'Falha ao registrar aprovação.');
      if(!d.verified)throw new Error('A aprovação foi registrada, mas o reread ainda não confirmou o evento.');
      setApproved(true);setSelectedVersion('APPROVED');setResearchState('APPROVED · evento humano verificado. SCANNER ainda pendente.');
    }catch(e){setError(String(e?.message||e));setResearchState('')}finally{setBusy(false)}
  }

  async function registerScannerPass(){
    if(!approved||!scannerReceipt.trim()||busy)return;
    setBusy(true);setError('');setResearchState('Registrando evidência do Scanner…');
    try{
      const r=await fetch('/api/mundo-ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        text:'[PROPOSAL_STATE_TRANSITION]\nFROM: APPROVED\nTO: SCANNER_PASS\nBRAND: '+brand+'\nSCANNER RECEIPT: '+scannerReceipt.trim(),
        source:'proposal_generator_scanner_pass',
        sourceId:'proposal-scanner-pass:'+Date.now(),
        channel:'mundinho_os',
        surface:'propostas',
        attachments:[{name:'scanner-receipt',type:'text/reference',reference:scannerReceipt.trim()}]
      })});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.status==='failed')throw new Error(d.reason||d.message||'Falha ao registrar Scanner.');
      if(!d.verified)throw new Error('O Scanner foi registrado, mas o reread ainda não confirmou o evento.');
      setScannerPass(true);setSelectedVersion('SCANNER_PASS');setResearchState('SCANNER_PASS · evidência registrada e relida.');
    }catch(e){setError(String(e?.message||e));setResearchState('')}finally{setBusy(false)}
  }

  async function packageProposal(){
    if(!scannerPass||!packagePdfRef.trim()||!packageJpegRef.trim()||busy)return;
    setBusy(true);setError('');setResearchState('Registrando pacote final…');
    try{
      const r=await fetch('/api/mundo-ingest',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        text:'[PROPOSAL_STATE_TRANSITION]\nFROM: SCANNER_PASS\nTO: PACKAGED\nBRAND: '+brand+'\nPDF HQ: '+packagePdfRef.trim()+'\nJPEG INLINE: '+packageJpegRef.trim(),
        source:'proposal_generator_packaged',
        sourceId:'proposal-packaged:'+Date.now(),
        channel:'mundinho_os',
        surface:'propostas',
        attachments:[
          {name:'proposal.pdf',type:'application/pdf',reference:packagePdfRef.trim()},
          {name:'proposal-inline.jpg',type:'image/jpeg',reference:packageJpegRef.trim()}
        ]
      })});
      const d=await r.json().catch(()=>({}));
      if(!r.ok||d.status==='failed')throw new Error(d.reason||d.message||'Falha ao registrar pacote.');
      if(!d.verified)throw new Error('O pacote foi registrado, mas o reread ainda não confirmou o evento.');
      setPackaged(true);setSelectedVersion('PACKAGED');setResearchState('PACKAGED · PDF HQ + JPEG INLINE verificados no MUNDO.');
    }catch(e){setError(String(e?.message||e));setResearchState('')}finally{setBusy(false)}
  }

  const materializationHref=approved?('/os/diva?area='+encodeURIComponent('Propostas')+'&context='+encodeURIComponent(brand)+'&prompt='+encodeURIComponent(
    'Materialize a proposta APROVADA usando '+PROPOSAL_GENERATOR_CONTRACT.identity.salesDesignIndex+' + '+PROPOSAL_GENERATOR_CONTRACT.identity.canvaMap+' + '+PROPOSAL_GENERATOR_CONTRACT.identity.approvedMaster+'. Recupere '+visualMemory.mundo+' e '+visualMemory.brand+'. Aplique MASTER → FINGERPRINT → SCANNER DE LAYOUT → MATERIALIZAÇÃO HQ → SCAN/DIFF. Não declare SCANNER_PASS sem evidência. Gere PDF HQ e JPEG INLINE somente da mesma versão aprovada. Rascunho: '+answer
  )):'#';
  const proposalGateGraph=[{label:'DRAFT_GENERATED',value:answer?1:0,note:'rascunho materializado'},{label:'APPROVED',value:approved?1:0,note:'aprovação humana'},{label:'SCANNER_PASS',value:scannerPass?1:0,note:'evidência de layout'},{label:'PACKAGED',value:packaged?1:0,note:'PDF/JPEG registrados'}];
  const sendHref=packaged?('/os/diva?area='+encodeURIComponent('Propostas')+'&context='+encodeURIComponent(brand)+'&prompt='+encodeURIComponent('Prepare o envio desta proposta PACKAGED. Use somente o PDF HQ '+packagePdfRef.trim()+' e o JPEG INLINE '+packageJpegRef.trim()+'. Confirme destinatário, assunto e mensagem antes de qualquer envio externo.')):'#';

  return <><main className="proposalStudio" data-area-mode="proposal-studio" data-proposal-state={selectedVersion||'EMPTY'}>
    <header className="proposalHero">
      <div><small>GERADOR DE PROPOSTAS · MUNDINHO OS</small><h1>Proposta começa no contexto, não no documento.</h1><p>As referências das pastas viram regra operacional: memória visual, versão, Scanner, materialização HQ e pacote de e-mail são fases diferentes. Nenhuma delas é presumida.</p></div>
      <span>{email}</span>
    </header>

    <section className="proposalGraph"><OperationalBarChart title="Gate da proposta selecionada" items={proposalGateGraph} question="Qual etapa está realmente comprovada para esta proposta?" source="MUNDO · proposta selecionada" period="sessão atual + receipts persistidos" updatedAt={selectedVersion||'sem transição promovida'} unit="estado binário" reading="Cada barra vale 1 somente quando aquele gate já foi materializado nesta proposta; etapas posteriores não são inferidas." limitation="Este gráfico descreve a proposta selecionada, não o volume total do pipeline."/></section>

    <section className="proposalLayout">
      <aside className="proposalContext">
        <div><small>CONTEXTO</small><h2>Escolha a frente.</h2></div>
        <div className="proposalCandidates">{candidates.map(x=><button type="button" key={x.id} className={String(x.id)===String(selected?.id)?'on':''} onClick={()=>{setSelectedId(x.id);resetDraft()}}><b>{candidateLabel(x)}</b><span>{evidenceLabel(x)}</span><em>{x.contact||x.owner||'relação em enriquecimento'}</em></button>)}</div>
      </aside>

      <section className="proposalComposer">
        {selected?<><div className="proposalEvidence">
          <div><small>MARCA / FRENTE</small><b>{brand}</b></div>
          <div><small>ESTADO</small><b>{selectedVersion||'SEM RASCUNHO'}</b></div>
          <div><small>CONTATO</small><b>{selected.contact||'não materializado'}</b></div>
          <div><small>FIT / TALENTO</small><b>{selected.talentFit||'a validar'}</b></div>
        </div>

        <div className="proposalMemory"><div><small>MEMÓRIA VISUAL MUNDO</small><b>{visualMemory.mundo}</b></div><div><small>MEMÓRIA VISUAL DA MARCA</small><b>{visualMemory.brand}</b></div><div><small>IDENTIDADE</small><b>18_SALES_DESIGN_INDEX + 19_CANVA_MAP</b></div></div>

        <div className="proposalFormatPicker">
          <div><small>FORMATO</small><div className="proposalOptionRow">
            <button type="button" className={proposalFormat==='ONE_PAGE'?'on':''} onClick={()=>setProposalFormat('ONE_PAGE')}>One Page</button>
            <button type="button" className={proposalFormat==='SLIDES_3'?'on':''} onClick={()=>setProposalFormat('SLIDES_3')}>3 slides</button>
            <button type="button" className={proposalFormat==='SLIDES_5'?'on':''} onClick={()=>setProposalFormat('SLIDES_5')}>5 slides</button>
          </div></div>
          <div><small>ORIENTAÇÃO</small><div className="proposalOptionRow">
            <button type="button" className={proposalOrientation==='VERTICAL'?'on':''} onClick={()=>setProposalOrientation('VERTICAL')}>Vertical</button>
            <button type="button" className={proposalOrientation==='HORIZONTAL'?'on':''} onClick={()=>setProposalOrientation('HORIZONTAL')}>Horizontal</button>
          </div></div>
        </div>
        <div className="proposalBrief"><label htmlFor="proposal-brief">O que esta proposta precisa resolver?</label><textarea id="proposal-brief" value={brief} onChange={e=>setBrief(e.target.value)} placeholder="Ex.: a marca respondeu por e-mail e pediu uma proposta para outubro. Quero uma direção simples, vendável e específica para esse momento."/></div>

        <div className="proposalContract"><small>PROCESSO BUSER / WIDI · SCANNER DE LAYOUT</small><p>MASTER → FINGERPRINT → SCANNER → MATERIALIZAÇÃO HQ → SCAN/DIFF → SCANNER_PASS → JPEG INLINE + PDF HQ → PACKAGED → READBACK.</p><span>ÚLTIMA VERSÃO HUMANA APROVADA é soberana. Canva/URL, preço, contato, evidência e aprovação nunca são inventados.</span></div>

        <div className="proposalStateFlow">
          {PROPOSAL_GENERATOR_CONTRACT.states.map(state=><span key={state} data-on={selectedVersion===state||state==='APPROVED'&&approved||state==='SCANNER_PASS'&&scannerPass||state==='PACKAGED'&&packaged?'1':'0'}>{state}</span>)}
        </div>

        <div className="proposalActions">
          <button type="button" onClick={generate} disabled={busy}>{busy?'Gerando…':'Gerar proposta →'}</button>
          <button type="button" onClick={approveDraft} disabled={busy||!answer||approved}>Aprovar proposta</button>
          <a className={!approved?'disabled':''} aria-disabled={!approved} href={materializationHref}>Materializar / rodar Scanner</a>
        </div>

        {approved?<div className="proposalGateBox"><label>SCANNER RECEIPT<input value={scannerReceipt} onChange={e=>setScannerReceipt(e.target.value)} placeholder="Receipt, URL ou referência verificável do Scanner"/></label><button type="button" onClick={registerScannerPass} disabled={busy||!approved||!scannerReceipt.trim()}>Registrar SCANNER_PASS</button></div>:null}

        {scannerPass?<div className="proposalGateBox package"><label>PDF HQ<input value={packagePdfRef} onChange={e=>setPackagePdfRef(e.target.value)} placeholder="URL/arquivo/referência do PDF HQ"/></label><label>JPEG INLINE<input value={packageJpegRef} onChange={e=>setPackageJpegRef(e.target.value)} placeholder="URL/arquivo/referência do JPEG INLINE"/></label><button type="button" onClick={packageProposal} disabled={busy||!scannerPass||!packagePdfRef.trim()||!packageJpegRef.trim()}>Registrar PACKAGED</button></div>:null}

        <div className="proposalActions"><a className={!packaged?'disabled':''} aria-disabled={!packaged} href={sendHref}>Enviar</a></div>

        <div className="proposalSecondaryActions"><a href="/os/ideias">Banco de ideias</a><a href="/os/contatos">Relações</a><a href="/os/pipeline">Pipeline</a></div>
        {researchState?<div className="proposalStatus">{researchState}</div>:null}
        {error?<div className="proposalError">{error}</div>:null}
        {answer?<article className="proposalDraft"><header><small>DRAFT_GENERATED · EDITÁVEL INLINE · REVISÃO HUMANA OBRIGATÓRIA</small><div><button type="button" onClick={()=>reviseDraft('refine')} disabled={busy}>Refinar</button><button type="button" onClick={()=>reviseDraft('regenerate')} disabled={busy}>Regenerar</button><button type="button" onClick={()=>navigator.clipboard?.writeText(answer)}>Copiar</button><a href={'/os/diva?area='+encodeURIComponent('Propostas')+'&context='+encodeURIComponent(brand)+'&prompt='+encodeURIComponent('Revise este DRAFT_GENERATED. Não promova estado. Preserve fatos, provenance e versão: '+answer)}>Revisar com DIVA →</a></div></header><textarea aria-label="Proposta editável" value={answer} onChange={e=>{setAnswer(e.target.value);setApproved(false);setSelectedVersion('DRAFT_GENERATED')}}/></article>:null}
        </>:<div className="proposalNoContext"><b>Nenhuma frente materializada.</b><span>O gerador não inventa uma marca só para preencher a tela.</span></div>}
      </section>
    </section>
  </main>
  <ContextualDivaDock area="Propostas" context="geração de proposta, memória visual, evidências, Sales Design, aprovação humana, Scanner e materialização"/>
  <style jsx global>{`
    .proposalStudio{max-width:1500px;margin:0 auto;padding:32px clamp(18px,3.4vw,52px) 110px;color:var(--mundo-ink,#17191D)}
    .proposalHero{display:flex;justify-content:space-between;gap:24px;align-items:end;padding:28px 0 24px;border-bottom:1px solid var(--mundo-line,#DED9CF)}.proposalHero small{font-size:9px;font-weight:900;letter-spacing:.14em;color:#175CFF}.proposalHero h1{font:400 clamp(44px,5vw,72px)/.96 Georgia,serif;letter-spacing:-.055em;margin:8px 0 10px}.proposalHero p{max-width:800px;font-size:12px;line-height:1.55;color:var(--mundo-muted,#6F6A62)}.proposalHero>span{font-size:8px;color:var(--mundo-muted)}
    .proposalGraph{margin-top:18px}.proposalLayout{display:grid;grid-template-columns:310px minmax(0,1fr);gap:14px;margin-top:18px}.proposalContext,.proposalComposer{background:#fff;border:1px solid var(--mundo-line,#DED9CF);border-radius:22px}.proposalContext{padding:16px;align-self:start;position:sticky;top:18px;max-height:calc(100vh - 36px);overflow:auto}.proposalContext small,.proposalContract small,.proposalDraft small,.proposalMemory small{font-size:8px;font-weight:900;letter-spacing:.12em;color:#175CFF}.proposalContext h2{font:400 27px Georgia,serif;margin:5px 0 12px}.proposalCandidates{display:grid;gap:6px}.proposalCandidates button{text-align:left;border:1px solid transparent;border-radius:13px;background:#F7F5F0;padding:10px;cursor:pointer}.proposalCandidates button.on{border-color:#175CFF;background:#EEF3FF}.proposalCandidates b,.proposalCandidates span,.proposalCandidates em{display:block}.proposalCandidates b{font-size:10px}.proposalCandidates span{font-size:8px;color:#175CFF;margin-top:3px}.proposalCandidates em{font-size:7px;font-style:normal;color:#777D84;margin-top:3px}
    .proposalComposer{padding:18px}.proposalEvidence,.proposalMemory{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:var(--mundo-line,#DED9CF);border:1px solid var(--mundo-line,#DED9CF)}.proposalEvidence>div,.proposalMemory>div{background:#fff;padding:11px}.proposalEvidence small,.proposalEvidence b,.proposalMemory small,.proposalMemory b{display:block}.proposalEvidence small,.proposalMemory small{font-size:7px;font-weight:900;color:#777D84}.proposalEvidence b,.proposalMemory b{font-size:9px;margin-top:4px;word-break:break-word}.proposalMemory{grid-template-columns:1fr 1fr 1.2fr;margin-top:8px}.proposalFormatPicker{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.proposalFormatPicker>div{padding:11px;border:1px solid #DED9CF;border-radius:14px;background:#FBFAF7}.proposalFormatPicker small{font-size:8px;font-weight:900;letter-spacing:.12em;color:#777D84}.proposalOptionRow{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px}.proposalOptionRow button{border:1px solid #DED9CF;background:#fff;border-radius:999px;padding:8px 10px;font-size:8px;font-weight:850;cursor:pointer}.proposalOptionRow button.on{background:#17191D;color:#fff;border-color:#17191D}.proposalBrief{margin-top:16px}.proposalBrief label{display:block;font:400 28px Georgia,serif;margin-bottom:8px}.proposalBrief textarea{width:100%;min-height:125px;border:1px solid var(--mundo-line,#DED9CF);border-radius:16px;padding:14px;resize:vertical;font:500 12px/1.5 Inter,sans-serif}.proposalContract{margin-top:12px;background:#F7F5F0;border-radius:15px;padding:13px}.proposalContract p{font-size:9px;line-height:1.5;margin:5px 0}.proposalContract span{font-size:8px;color:#777D84}.proposalStateFlow{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.proposalStateFlow span{font-size:7px;font-weight:900;border:1px solid #DED9CF;border-radius:999px;padding:6px 8px;color:#777D84}.proposalStateFlow span[data-on="1"]{background:#EEF3FF;color:#175CFF;border-color:#BFD1FF}
    .proposalActions,.proposalSecondaryActions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}.proposalGateBox{margin-top:10px;padding:12px;border:1px solid #DED9CF;border-radius:14px;background:#FBFAF7;display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.proposalGateBox.package{grid-template-columns:1fr 1fr auto}.proposalGateBox label{font-size:8px;font-weight:900;color:#777D84}.proposalGateBox input{display:block;width:100%;margin-top:5px;border:1px solid #DED9CF;border-radius:10px;padding:9px;background:#fff;font-size:9px}.proposalGateBox button{border:0;border-radius:999px;background:#17191D;color:#fff;padding:10px 12px;font-size:8px;font-weight:900}.proposalActions button,.proposalActions a,.proposalSecondaryActions a{border:1px solid var(--mundo-line,#DED9CF);border-radius:999px;background:#fff;color:#17191D;text-decoration:none;padding:10px 13px;font-size:9px;font-weight:850}.proposalActions button:first-child{background:#175CFF;color:#fff;border-color:#175CFF}.proposalActions button:disabled,.proposalActions a.disabled{opacity:.38;pointer-events:none}.proposalSecondaryActions a{padding:7px 10px;color:#175CFF}.proposalStatus,.proposalError{margin-top:10px;border-radius:12px;padding:10px;font-size:9px}.proposalStatus{background:#EEF3FF;color:#175CFF}.proposalError{background:#FFF0F0;color:#A51D2D}.proposalDraft{margin-top:14px;border-top:1px solid var(--mundo-line,#DED9CF);padding-top:14px}.proposalDraft header{display:flex;justify-content:space-between;gap:12px;align-items:center}.proposalDraft header div{display:flex;gap:6px}.proposalDraft header button,.proposalDraft header a{border:1px solid var(--mundo-line,#DED9CF);background:#fff;border-radius:999px;padding:7px 9px;font-size:8px;text-decoration:none;color:#175CFF}.proposalDraft textarea{width:100%;min-height:360px;white-space:pre-wrap;font:500 11px/1.6 Inter,sans-serif;background:#FBFAF7;border:1px solid #DED9CF;border-radius:15px;padding:16px;margin:10px 0 0;resize:vertical}.proposalNoContext{display:grid;gap:5px;padding:30px}.proposalNoContext span{font-size:9px;color:#777D84}
    @media(max-width:900px){.proposalFormatPicker{grid-template-columns:1fr}.proposalGateBox,.proposalGateBox.package{grid-template-columns:1fr}.proposalLayout{grid-template-columns:1fr}.proposalContext{position:static;max-height:none}.proposalCandidates{grid-template-columns:1fr 1fr}.proposalEvidence,.proposalMemory{grid-template-columns:1fr 1fr}.proposalHero{display:block}}@media(max-width:560px){.proposalStudio{padding:20px 14px 96px}.proposalCandidates,.proposalEvidence,.proposalMemory{grid-template-columns:1fr}.proposalDraft header{display:block}.proposalDraft header div{margin-top:8px}}
  `}</style></>;
}
export async function getServerSideProps(ctx){return requireOSAuth(ctx.req)}
