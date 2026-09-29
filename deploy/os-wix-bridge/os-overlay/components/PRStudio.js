import Link from 'next/link';
import {CRM_OPERATIONAL_SNAPSHOT} from '../data/crm-operational-snapshot-current';
import {cardsFor} from '../data/os-cards';
import DataGapHeartbeat from './DataGapHeartbeat';

const evidenceText=item=>item.summary||item.status||item.nextAction||'Sem leitura materializada.';
const routeOpen=item=>/contato|e-mail|email|resposta humana|formulário|whatsapp|assessor|jornalista|imprensa/i.test(`${item.status||''} ${item.nextAction||''} ${item.summary||''}`);
const prRelevant=item=>/proposta|material|pitch|pr|imprensa|editorial|release|mídia kit|media kit|comunicação|narrativa|conteúdo/i.test(`${item.status||''} ${item.nextAction||''} ${item.summary||''}`);

function divaHref(item,task){
  return `/os/diva?area=${encodeURIComponent('PR Studio')}&context=${encodeURIComponent(item.title||'Oportunidade')}&prompt=${encodeURIComponent(`${task}. Use somente fatos comprovados no MUNDO. Contexto do Pipeline: ${item.status||''}. Evidência atual: ${item.summary||''}. Próxima ação: ${item.nextAction||''}. Separe fato, hipótese, lacuna e ação.`)}`;
}
function materialHref(item,tool,material){
  return `/os/diva?area=${encodeURIComponent('PR Studio')}&context=${encodeURIComponent(item.title||'Oportunidade')}&prompt=${encodeURIComponent(`Crie um ${material} para ${item.title} e prepare a saída visual em ${tool}. Preserve a gramática visual do Radar da Gabi: contexto → evidência → leitura → ação → aprofundamento. Não invente dados.`)}`;
}

function ContextCard({item}){
  return <article className="prContextCard">
    <div className="prCardTop"><small>{item.market||'BR'} · {item.priority||'P2'}</small><span>{item.status||'em contexto'}</span></div>
    <h3>{item.title}</h3>
    <p>{evidenceText(item)}</p>
    <div className="prContextFact"><b>CONTEXTO</b><span>{item.nextAction||'Sem próxima ação materializada.'}</span></div>
    <div className="prContextActions"><Link href={'/os/pipeline/'+item.slug}>Abrir proposta →</Link><Link href={divaHref(item,'Identifique os ângulos editoriais sustentados por esta oportunidade')}>Gerar ângulos →</Link></div>
  </article>
}

function AngleCard({item,index}){
  const labels=['Fato que merece pauta','Narrativa que pode ganhar imprensa','Timing que pode virar gancho','Relação que merece aprofundamento'];
  return <article className="prAngleCard">
    <small>ÂNGULO {String(index+1).padStart(2,'0')}</small>
    <h3>{labels[index%labels.length]}</h3>
    <p>{evidenceText(item)}</p>
    <div><b>O que sustenta</b><span>{item.status||'registro do Pipeline'}</span></div>
    <div><b>O que falta validar</b><span>Veículo, editoria, exclusividade e dado novo permanecem lacunas até evidência adicional.</span></div>
    <footer><Link href={divaHref(item,'Transforme este contexto em um pitch editorial curto, específico e verificável')}>Transformar em pitch →</Link></footer>
  </article>
}

function MaterialCard({item,title,material}){
  return <article className="prMaterialCard">
    <div className="prMaterialPreview"><small>PREVIEW · {material.toUpperCase()}</small><b>{item.title}</b><span>contexto + evidência + leitura + ação</span></div>
    <h3>{title}</h3>
    <p>Material nasce do mesmo contexto do Pipeline e preserva provenance.</p>
    <div className="prMaterialActions"><Link href={materialHref(item,'Canva',material)}>Criar no Canva</Link><Link href={materialHref(item,'Adobe',material)}>Criar no Adobe</Link></div>
  </article>
}

export default function PRStudio(){
  const pipeline=CRM_OPERATIONAL_SNAPSHOT.pipeline||[];
  const candidates=pipeline.filter(prRelevant);
  const contexts=(candidates.length?candidates:pipeline).slice(0,6);
  const angles=contexts.slice(0,4);
  const routeItems=contexts.filter(routeOpen).slice(0,5);
  const lead=contexts[0]||{};
  const prHistory=cardsFor('pr');
  const prResults=prHistory.filter(item=>/publica|matéria|materia|clipping|repercuss|cobertura|imprensa/i.test(`${item.status||''} ${item.summary||''} ${(item.history||[]).join(' ')}`)).slice(0,8);
  const materials=[
    ['Press one-sheet','one-sheet editorial'],
    ['Press release','release de imprensa'],
    ['Card editorial','card visual de pauta'],
    ['Resumo para imprensa','resumo executivo visual']
  ];

  return <main className="prStudio osVisualSequence" data-area-mode="pr-studio">
    <header className="prHero">
      <div><small>CRIAÇÃO · PR STUDIO</small><h1>PR com contexto, evidência e próxima ação.</h1><p>A pauta nasce do que já existe no Pipeline. O Studio cruza oportunidade, narrativa, material e rota sem transformar hipótese em fato.</p></div>
      <div className="prHeroActions"><Link href="/os/pipeline">Abrir Pipeline</Link><Link className="primary" href={lead.slug?divaHref(lead,'Faça uma leitura PR executiva do contexto atual e diga o que merece ação agora'):'/os/diva'}>Leitura da DIVA</Link></div>
    </header>
    <DataGapHeartbeat surface="pr"/>

    <section className="osEvidenceBand" aria-label="Pulso PR">
      <article><b>{contexts.length}</b><span>contextos selecionados do Pipeline</span></article>
      <article><b>{angles.length}</b><span>ângulos editoriais visíveis</span></article>
      <article><b>{routeItems.length}</b><span>rotas com contato ou resposta materializada</span></article>
      <article><b>{materials.length}</b><span>formatos de material acionáveis</span></article>
    </section>

    <section className="osVisualSection">
      <div className="osVisualLead"><div><small>CONTEXTO PR</small><h2>O que no Pipeline merece leitura editorial.</h2><p>Propostas, materiais, respostas e movimentos reais aparecem antes da ideia criativa. O motivo de existir é o próprio contexto.</p></div><div className="osVisualAction"><Link href="/os/pipeline">Ver pipeline completo →</Link></div></div>
      <div className="prContextGrid">{contexts.map(item=><ContextCard item={item} key={item.slug||item.title}/>)}</div>
    </section>

    <section className="osVisualSection">
      <div className="osVisualLead"><div><small>ÂNGULOS EDITORIAIS</small><h2>Possibilidades de pauta sustentadas pela evidência.</h2><p>Cada ângulo mostra o que sustenta a leitura, o que ainda falta validar e qual ação editorial pode vir depois.</p></div></div>
      <div className="prAngleGrid">{angles.map((item,index)=><AngleCard item={item} index={index} key={item.slug||item.title}/>)}</div>
    </section>

    <section className="osVisualSection">
      <div className="osVisualLead"><div><small>CLIPPING & CONTINUIDADE</small><h2>O resultado volta para o Studio.</h2><p>Quando uma pauta vira matéria, cobertura ou repercussão materializada, ela deixa de ser fim de linha: vira evidência para a próxima leitura editorial.</p></div></div>
      {prResults.length?<div className="prContinuityGrid">{prResults.map(item=><article key={item.slug||item.title}><small>RESULTADO PR</small><h3>{item.title}</h3><p>{item.summary||item.status}</p><div><b>PRÓXIMO ÂNGULO</b><Link href={divaHref(item,'Leia este resultado de PR e proponha apenas o próximo ângulo sustentado pela cobertura e pelo contexto atual')}>Encontrar continuidade →</Link></div></article>)}</div>:<div className="osReadingBlock"><small>CLIPPING & CONTINUIDADE</small><h3>Nenhum resultado PR novo foi materializado nesta fonte.</h3><p>Assim que clipping ou repercussão entrar no MUNDO, o Studio passa a usá-lo como evidência para o próximo ângulo.</p></div>}
    </section>

    <section className="osVisualSection">
      <div className="osVisualLead"><div><small>MATERIAIS PR</small><h2>Da leitura para uma peça pronta.</h2><p>Canva e Adobe aparecem como saída de produção visual, nunca como botão decorativo.</p></div></div>
      <div className="prMaterialGrid">{materials.map(([title,material],index)=><MaterialCard key={material} item={contexts[index%Math.max(contexts.length,1)]||lead} title={title} material={material}/>)}</div>
    </section>

    <section className="osVisualSection">
      <div className="osVisualLead"><div><small>ROTAS DE IMPRENSA</small><h2>Para quem isso pode ir e o que fazemos agora.</h2><p>Rotas só aparecem quando o histórico materializa contato, resposta ou canal. Sem evidência, o Studio sinaliza a lacuna em vez de inventar uma lista.</p></div><div className="osVisualAction"><Link href="/os/contatos">Abrir Relações →</Link></div></div>
      {routeItems.length?<div className="prRoutes">{routeItems.map(item=><article key={item.slug||item.title}><small>{item.market||'BR'} · ROTA MATERIALIZADA</small><h3>{item.title}</h3><p>{item.status}</p><b>{item.nextAction||'Abrir histórico e definir próxima ação.'}</b><div><Link href={'/os/pipeline/'+item.slug}>Ver contexto →</Link><Link href={divaHref(item,'Prepare a abordagem de imprensa para esta rota sem inventar contato ou informação ausente')}>Preparar abordagem →</Link></div></article>)}</div>:<div className="osReadingBlock"><small>LACUNA DE ROTA</small><h3>Nenhum contato de imprensa foi promovido sem evidência.</h3><p>Use Relações para investigar contatos e só então promover uma rota ao PR Studio.</p></div>}
    </section>

    <style jsx global>{`
      .prStudio{max-width:1480px;margin:0 auto;padding:34px clamp(18px,3.4vw,52px) 110px}.prHero{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:30px;align-items:end;padding:22px 0 30px;border-bottom:1px solid var(--mundo-line)}.prHero small,.prStudio small{font-size:9px;font-weight:900;letter-spacing:.14em;color:var(--mundo-signal)}.prHero h1{font-size:clamp(52px,7vw,94px);line-height:.9;letter-spacing:-.07em;margin:9px 0 15px;max-width:1050px}.prHero p{font-size:14px;line-height:1.6;color:var(--mundo-muted);max-width:850px}.prHeroActions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.prHeroActions a,.prContextActions a,.prMaterialActions a,.prRoutes a{font-size:9px;font-weight:850;text-decoration:none;border:1px solid var(--mundo-line);border-radius:999px;padding:9px 11px;background:#fff}.prHeroActions .primary{background:var(--mundo-ink);color:#fff;border-color:var(--mundo-ink)}
      .prContextGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.prContextCard{background:#fff;border:1px solid var(--mundo-line);border-radius:22px;padding:17px;display:flex;flex-direction:column;min-height:280px}.prCardTop{display:flex;justify-content:space-between;gap:8px}.prCardTop span{font-size:8px;color:var(--mundo-muted)}.prContextCard h3{font-size:23px;margin:18px 0 7px}.prContextCard>p{font-size:10px;line-height:1.5;color:var(--mundo-muted)}.prContextFact{margin-top:auto;padding:11px 0;border-top:1px solid var(--mundo-line)}.prContextFact b{display:block;font-size:7px;color:var(--mundo-signal);margin-bottom:4px}.prContextFact span{font-size:9px;line-height:1.45}.prContextActions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
      .prAngleGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:18px}.prAngleCard{border-top:1px solid var(--mundo-line-strong);padding:18px 0 4px}.prAngleCard h3{font-size:29px;margin:8px 0}.prAngleCard>p{font-size:12px;line-height:1.55;color:var(--mundo-muted)}.prAngleCard>div{display:grid;gap:4px;padding:10px 0;border-top:1px solid var(--mundo-line)}.prAngleCard>div b{font-size:8px;color:var(--mundo-signal)}.prAngleCard>div span{font-size:9px;line-height:1.45}.prAngleCard footer{margin-top:10px}.prAngleCard footer a{font-size:9px;font-weight:900;color:var(--mundo-signal)}
      .prMaterialGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:18px}.prMaterialCard{background:#fff;border:1px solid var(--mundo-line);border-radius:22px;padding:12px}.prMaterialPreview{aspect-ratio:4/3;border-radius:16px;background:linear-gradient(145deg,#EEF4FF,#FFFFFF);border:1px solid #DCE6F7;padding:14px;display:flex;flex-direction:column;justify-content:flex-end}.prMaterialPreview small{margin-bottom:auto}.prMaterialPreview b{font-size:20px;line-height:1.05}.prMaterialPreview span{font-size:8px;color:var(--mundo-muted);margin-top:6px}.prMaterialCard h3{font-size:18px;margin:12px 0 5px}.prMaterialCard>p{font-size:9px;line-height:1.45;color:var(--mundo-muted)}.prMaterialActions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
      .prContinuityGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.prContinuityGrid article{background:#fff;border:1px solid var(--mundo-line);border-radius:20px;padding:15px}.prContinuityGrid h3{font-size:19px;margin:8px 0 5px}.prContinuityGrid p{font-size:9px;line-height:1.45;color:var(--mundo-muted)}.prContinuityGrid article>div{display:flex;justify-content:space-between;gap:8px;align-items:center;border-top:1px solid var(--mundo-line);padding-top:10px}.prContinuityGrid article>div b{font-size:7px;color:var(--mundo-signal)}.prContinuityGrid a{font-size:8px;font-weight:900;color:var(--mundo-signal);text-decoration:none}.prRoutes{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.prRoutes article{background:var(--mundo-ink);color:#fff;border-radius:22px;padding:16px}.prRoutes article small{color:#93C5FD}.prRoutes h3{font-size:22px;margin:12px 0 5px}.prRoutes p{font-size:9px;color:#CBD5E1}.prRoutes b{display:block;font-size:9px;line-height:1.45;margin:14px 0}.prRoutes article div{display:flex;gap:6px;flex-wrap:wrap}.prRoutes a{background:#fff;color:var(--mundo-ink);border-color:#fff}
      @media(max-width:1050px){.prContextGrid,.prRoutes{grid-template-columns:1fr 1fr}.prMaterialGrid{grid-template-columns:1fr 1fr}}@media(max-width:720px){.prStudio{padding:22px 14px 92px}.prHero{grid-template-columns:1fr}.prHeroActions{justify-content:flex-start}.prContextGrid,.prAngleGrid,.prMaterialGrid,.prRoutes{grid-template-columns:1fr}.osEvidenceBand{grid-template-columns:1fr 1fr}}
    `}</style>
  </main>;
}
