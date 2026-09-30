import crypto from 'node:crypto';
import {buildDivaProviderCandidates} from '../../lib/diva-cost-guard.mjs';
import {callGeminiGenerateContent} from '../../lib/diva-gemini-provider.mjs';
import {
  GABI_CLIENT_SAFE_POLICY_VERSION,
  projectGabiPublicContextRows,
  buildGabiPublicStudioResponse,
  assertGabiClientSafeOutput
} from '../../lib/gabi-client-safe-policy.mjs';
import {GABI_PROPOSAL_CREATIVE_CANON} from '../../lib/gabi-proposal-creative-canon.mjs';
import {classifyGabiOrbiCommand,buildGabiOrbiBlockedConfigEvent} from '../../lib/gabi-orbi-authority-policy.mjs';
import {buildGabiOrbiInteractionEvent,buildGabiOrbiDailyReport} from '../../lib/gabi-orbi-usage-intelligence.mjs';
import {publishGabiMentalSignal,readGabiMentalSignals,publishGabiMentalReport,publishGabiAdaptationSignal,readGabiAdaptationSignals} from '../../lib/gabi-orbi-mental-report.mjs';
import {buildHumanAdaptationSignal,deriveHumanInteractionProfile,humanAdaptationContext} from '../../lib/diva-human-adaptation.mjs';
import {routeOrbiProviderCandidates} from '../../lib/orbi-provider-router.mjs';
import {divaVoiceConversationInstruction} from '../../data/diva-voice-presence-contract.js';
import {DIVA_QUALITATIVE_DNA} from '../../data/diva-qualitative-dna.js';
import {DIVA_CREATIVE_RETROPLAN} from '../../data/diva-creative-retroplan-v1.js';

const ALLOWED_ORIGIN='https://radar.gabi.mundinhocomunicacao.com';

const safe=(v,n=4000)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);
const providerText=data=>{
  if(typeof data?.output_text==='string'&&data.output_text.trim())return data.output_text.trim();
  return(data?.output||[]).flatMap(x=>x?.content||[]).map(x=>typeof x?.text==='string'?x.text:'').filter(Boolean).join('\n').trim();
};
function cors(req,res){
  const origin=safe(req.headers.origin,300);
  if(origin===ALLOWED_ORIGIN){
    res.setHeader('Access-Control-Allow-Origin',ALLOWED_ORIGIN);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','content-type');
  }
  return origin===ALLOWED_ORIGIN;
}
function projectGabiPublicHistory(raw){
  return (Array.isArray(raw)?raw:[]).slice(-8).map(row=>{
    if(!row||!['user','assistant'].includes(row.role))return null;
    const content=safe(row.content,1800);
    if(!content)return null;
    if(row.role==='user'&&!classifyGabiOrbiCommand(content).allowed)return null;
    return{role:row.role,content};
  }).filter(Boolean).slice(-8);
}
function gabiClientSafeProceduralContext(){
  const q=DIVA_QUALITATIVE_DNA,c=DIVA_CREATIVE_RETROPLAN;
  return [
    'Contexto vem antes de oportunidade, formato ou frase de efeito.',
    'Transforme fatos em relações, significado e consequência antes de criar.',
    'Cena concreta, ação e mecanismo vêm antes de abstração e adjetivo.',
    'Teste internamente direções diferentes; escolha a que depende de Gabi + contexto + marca.',
    'Se trocar a marca ou a Gabi e a ideia continuar igual, ela ainda está genérica.',
    'A linguagem deve ser '+q.voice.qualities.slice(0,8).join(', ')+'.',
    'Evite bio como ideia, trend copiada, slogan vazio e maneirismos de IA.',
    'Regra de fanout: '+c.contextFanout.rule,
    'Contraprova: '+c.dialectic.antithesis.slice(0,4).join(' | '),
    'Redação: '+c.copyDoctrine.decontaminationRule
  ].join('\n');
}
function referenceLinks(query){
  const q=encodeURIComponent(safe(query,240)||'Gabriella Saraivah creator content');
  return[
    {type:'visual',label:'Referências visuais · Pinterest',url:'https://www.pinterest.com/search/pins/?q='+q},
    {type:'video',label:'Referências em vídeo · YouTube',url:'https://www.youtube.com/results?search_query='+q},
    {type:'video',label:'Referências curtas · TikTok',url:'https://www.tiktok.com/search?q='+q}
  ];
}
function isProposalRequest(brief,intent=''){
  const value=(safe(brief,1200)+' '+safe(intent,80)).toLowerCase();
  return /\b(proposta|proposal|parceria|campanha|brand partnership|branded content|apresenta[cç][aã]o comercial)\b/i.test(value);
}

function isRadarQuestion(brief,intent=''){
  if(safe(intent,80)==='ask')return true;
  const value=safe(brief,1400).toLowerCase();
  return /\b(status|propostas?|marcas?|avan[cç]|m[ií]dia|mat[eé]rias?|imagem|pontua[cç][aã]o|radar|mundinho|estrat[eé]gia|o que (?:voc[eê]s?|a equipe) (?:est[aá]|est[aã]o) fazendo|o que mudou|como estou|quem respondeu|quem est[aá] perto)\b/i.test(value);
}

function contentFallbackResult({brief,intent,rows}){
  const signal=rows[0]||{};
  const topic=safe(brief,180)||safe(signal.title,180)||'um momento real da sua rotina';
  const why=safe(signal.summary,420)||'A ideia parte de um contexto que combina com o momento e deixa espaço para uma leitura pessoal.';
  return{
    mode:'content',
    headline:'Uma ideia para gravar agora',
    idea:'Vamos transformar o tema que você trouxe em uma peça curta, pessoal e visual, começando por uma situação real antes de explicar demais.',
    whyNow:why,
    hook:'“Tem uma coisa sobre isso que eu nunca mostro direito…”',
    script:[
      '0–3s · Abra com o hook olhando direto para a câmera.',
      '3–12s · Mostre a situação real em vez de explicar tudo.',
      '12–22s · Conte o detalhe que torna essa história sua.',
      '22–30s · Feche com uma pergunta ou pequena conclusão pessoal.'
    ],
    shotList:['Plano direto para câmera','1 detalhe de ambiente','1 movimento ou transição simples','Plano final mais próximo'],
    production:'Celular, luz natural e edição rápida. Priorize autenticidade sobre excesso de produção.',
    caption:'Uma legenda curta que complete a história sem repetir o vídeo.',
    searchTerms:{visual:topic+' visual storytelling creator',video:topic+' reel tiktok storytelling'},
    nextPrompt:intent==='record_now'?'Crie uma segunda versão ainda mais simples para gravar em até 15 minutos.':'Crie três variações com tons diferentes.'
  };
}
function proposalFallbackResult({brief,rows}){
  const signal=rows[0]||{};
  const topic=safe(brief,220)||safe(signal.title,180)||'a marca';
  const proof=[safe(signal.summary,260),safe(signal.status,120)].filter(Boolean);
  return{
    mode:'proposal',
    headline:'Uma proposta que nasce de uma situação real',
    idea:'A direção precisa ligar a marca a uma situação concreta da vida da Gabi, com um papel que mude o que acontece e seja fácil de visualizar.',
    whyNow:'O ponto de partida é o momento que você trouxe, sem inventar fatos para preencher lacunas.',
    hook:'A marca entra porque faz alguma coisa acontecer — não só porque aparece.',
    script:[],
    shotList:[],
    production:'',
    caption:'',
    searchTerms:{visual:topic+' campaign visual creator',video:topic+' branded content creator'},
    nextPrompt:'Me diga o objetivo da marca ou o produto principal e eu deixo a proposta ainda mais específica.',
    proposal:{
      opportunity:'Existe uma oportunidade de transformar o contexto trazido em uma história comercial específica, sem depender de uma ideia genérica de influência.',
      talentFit:'Gabriella deve entrar pela parte real da vida, trajetória ou comportamento que torna essa parceria diferente de simplesmente contratar alcance.',
      ideaName:'UMA IDEIA QUE MUDA A HISTÓRIA',
      concept:'A proposta parte de uma cena concreta e dá à marca uma função indispensável dentro dela.',
      execution:[
        'Começar por uma situação que já faria sentido para a Gabi sem publicidade.',
        'Introduzir a marca no momento em que ela provoca uma decisão, acesso, transformação ou solução.',
        'Mostrar a consequência dessa entrada em uma execução simples de visualizar.',
        'Fechar com um desdobramento que possa crescer apenas se enriquecer a ideia.'
      ],
      brandRole:'A marca deve ocupar uma função clara: facilitar, ensinar, transformar, dar acesso, criar o desafio ou participar organicamente da rotina.',
      proof:proof.length?proof:['Usar apenas credenciais e dados que provem por que Gabi faz sentido para esta oportunidade.'],
      extensions:['Conteúdo hero','Desdobramentos sociais','PR ou extensão editorial quando houver pauta real'],
      nextStep:'Definir produto, objetivo e janela da marca para fechar a versão pronta para apresentação.'
    }
  };
}
function answerFallbackResult({brief,rows}){
  const items=(Array.isArray(rows)?rows:[]).slice(0,12);
  const evidence=items.slice(0,5).map(x=>[safe(x.title,160),safe(x.status,100),safe(x.summary,260)].filter(Boolean).join(' · ')).filter(Boolean);
  return{
    mode:'answer',
    headline:'O que eu consigo ver no seu Radar agora',
    answer:evidence.length
      ?'Eu consigo te responder a partir do que está atualizado no seu Radar. Aqui está a leitura mais útil para a sua pergunta.'
      :'Eu ainda não tenho evidência suficiente nesta leitura para te responder com segurança.',
    bullets:evidence,
    nextPrompt:'Se quiser, eu aprofundo uma marca, uma proposta, mídia ou uma ideia específica.',
    searchTerms:{visual:'',video:''}
  };
}
function fallbackResult({brief,intent,rows}){
  if(isRadarQuestion(brief,intent))return answerFallbackResult({brief,rows});
  return isProposalRequest(brief,intent)
    ?proposalFallbackResult({brief,rows})
    :contentFallbackResult({brief,intent,rows});
}
function parseGenerated(text,fallback){
  const clean=safe(text,22000).replace(/^\s*```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
  try{
    const parsed=JSON.parse(clean);
    if(parsed&&typeof parsed==='object'){
      if(parsed.mode==='answer'||fallback.mode==='answer'){
        return{
          mode:'answer',
          headline:safe(parsed.headline,180)||fallback.headline,
          answer:safe(parsed.answer||parsed.idea,2200)||fallback.answer,
          bullets:(Array.isArray(parsed.bullets)?parsed.bullets:fallback.bullets||[]).slice(0,8).map(x=>safe(x,600)).filter(Boolean),
          nextPrompt:safe(parsed.nextPrompt,500)||fallback.nextPrompt,
          searchTerms:{visual:'',video:''}
        };
      }
      const proposalMode=parsed.mode==='proposal'||fallback.mode==='proposal';
      return{
        mode:proposalMode?'proposal':'content',
        headline:safe(parsed.headline,180)||fallback.headline,
        idea:safe(parsed.idea,1400)||fallback.idea,
        whyNow:safe(parsed.whyNow,1000)||fallback.whyNow,
        hook:safe(parsed.hook,600)||fallback.hook,
        script:(Array.isArray(parsed.script)?parsed.script:fallback.script||[]).slice(0,8).map(x=>safe(x,600)).filter(Boolean),
        shotList:(Array.isArray(parsed.shotList)?parsed.shotList:fallback.shotList||[]).slice(0,8).map(x=>safe(x,320)).filter(Boolean),
        production:safe(parsed.production,900)||fallback.production,
        caption:safe(parsed.caption,800)||fallback.caption,
        searchTerms:{
          visual:safe(parsed.searchTerms?.visual,240)||fallback.searchTerms.visual,
          video:safe(parsed.searchTerms?.video,240)||fallback.searchTerms.video
        },
        nextPrompt:safe(parsed.nextPrompt,500)||fallback.nextPrompt,
        ...(proposalMode?{proposal:parsedProposal(parsed,fallback)}:{})
      };
    }
  }catch{}
  return fallback.mode==='answer'?{...fallback,answer:clean||fallback.answer}:{...fallback,idea:clean||fallback.idea};
}
async function callResponses(provider,{system,message,history=[],maxOutputTokens=1800}){
  const prior=(Array.isArray(history)?history:[]).slice(-8).map(row=>({
    role:row?.role==='assistant'?'assistant':'user',
    content:[{type:'input_text',text:safe(row?.content,1200)}]
  })).filter(row=>row.content[0].text);
  const input=[{role:'system',content:system},...prior,{role:'user',content:[{type:'input_text',text:message}]}];
  const payload={model:provider.model,input,max_output_tokens:maxOutputTokens};
  const headers={'content-type':'application/json',authorization:provider.token};
  if(provider.siteId)headers['wix-site-id']=provider.siteId;
  const response=await fetch(provider.endpoint,{method:'POST',headers,body:JSON.stringify(payload)});
  const raw=await response.text();let data={};try{data=raw?JSON.parse(raw):{}}catch{}
  if(!response.ok)throw new Error('provider_'+response.status);
  const answer=providerText(data);if(!answer)throw new Error('empty_response');
  return answer;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  const allowed=cors(req,res);
  if(req.method==='OPTIONS')return allowed?res.status(204).end():res.status(403).end();
  if(!allowed)return res.status(403).json({ok:false,error:'origin_not_allowed'});
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});

  const intent=safe(req.body?.intent||'surprise',60);
  const brief=safe(req.body?.brief,1200);
  const history=projectGabiPublicHistory(req.body?.history);
  const priorAdaptation=readGabiAdaptationSignals();
  const gabiProfile=deriveHumanInteractionProfile(priorAdaptation,{humanRef:'human:gabi'});
  const gabiAdaptation=gabiProfile.samples?humanAdaptationContext(gabiProfile,{faceId:'DIVA_GABI'}):'';
  publishGabiAdaptationSignal(buildHumanAdaptationSignal({humanRef:'human:gabi',faceId:'DIVA_GABI',message:brief}));
  const authority=classifyGabiOrbiCommand(brief);
  if(!authority.allowed){
    const blocked=buildGabiOrbiBlockedConfigEvent({command:brief});
    publishGabiMentalSignal(blocked);
    publishGabiMentalReport(buildGabiOrbiDailyReport({events:readGabiMentalSignals()}));
    return res.status(200).json(buildGabiPublicStudioResponse({
      mode:'content',
      headline:'Essa parte fica com a Mundinho',
      idea:authority.userSafeResponse,
      whyNow:'Você pode continuar usando a DIVA normalmente para ideias, contexto, propostas e dúvidas.',
      hook:'',
      script:[],
      shotList:[],
      production:'',
      caption:'',
      searchTerms:{visual:'',video:''},
      nextPrompt:'Me diga o que você quer criar ou entender agora.'
    },[]));
  }
  const rawPreset=req.body?.preset&&typeof req.body.preset==='object'?req.body.preset:{};
  const preset={format:safe(rawPreset.format,100),duration:safe(rawPreset.duration,60),tone:safe(rawPreset.tone,120),production:safe(rawPreset.production,180),location:safe(rawPreset.location,60)};
  const rows=projectGabiPublicContextRows(req.body?.context);
  const answerMode=isRadarQuestion(brief,intent);
  const proposalMode=!answerMode&&isProposalRequest(brief,intent);
  const fallback=fallbackResult({brief,intent,rows});
  const context=JSON.stringify(rows);
  const outputContract=answerMode
    ?`Retorne SOMENTE JSON válido com:
mode:"answer", headline, answer, bullets(array), nextPrompt.
Responda diretamente à pergunta usando apenas RADAR KNOWLEDGE. Se faltar evidência, diga o que falta sem inventar.`
    :proposalMode
      ?`Retorne SOMENTE JSON válido com:
mode:"proposal",
headline, idea, whyNow, hook,
proposal:{opportunity,talentFit,ideaName,concept,execution(array),brandRole,proof(array),extensions(array),nextStep},
searchTerms:{visual,video}, nextPrompt.
Os campos de proposta precisam ser específicos e visualizáveis. Não invente pesquisa de marca que não esteja no contexto.`
      :`Retorne SOMENTE JSON válido com:
mode:"content", headline, idea, whyNow, hook, script(array), shotList(array), production, caption, searchTerms:{visual,video}, nextPrompt.`;
  const proposalCanon=proposalMode?'\n\nMÉTODO INTERNO PARA PROPOSTAS — NÃO EXPLIQUE AO USUÁRIO:\n'+GABI_PROPOSAL_CREATIVE_CANON:'';
  const proceduralIntelligence=gabiClientSafeProceduralContext();
  const system=`CLIENT_SAFE_GABI · ${GABI_CLIENT_SAFE_POLICY_VERSION}
Você é DIVA · Gabi, parceira criativa da Gabriella Saraivah dentro do Radar.
Você não acessa nem revela contatos, mensagens privadas, margens, segredos, credenciais, Slack ou bastidores internos da agência.\nUse SOMENTE o RADAR KNOWLEDGE fornecido abaixo, que já é uma projeção permitida para a Gabriella, e o briefing escrito por ela.
Se faltar contexto, assuma menos e sinalize a lacuna de modo natural; nunca invente fatos.
Fale diretamente com a Gabi como uma diretora criativa presente, clara, calorosa e objetiva.
${proceduralIntelligence}
HISTÓRICO EFÊMERO DA SESSÃO: use as mensagens anteriores apenas para continuidade, correções, referências e mudanças de contexto desta conversa. Não transforme esse histórico em memória persistente e nunca presuma contexto que não esteja nele ou no Radar.\n${divaVoiceConversationInstruction('DIVA_GABI')}\n${gabiAdaptation}
Use o PRESET ADAPTATIVO como direção de formato, duração, tom e produção. Ele pode ser refinado pelo briefing e nunca deve deixar a resposta genérica.
Nunca repita o briefing literalmente nem coloque a fala da Gabi entre aspas para transformá-la em ideia: interprete o pedido.
Nunca mencione na resposta termos de implementação ou segurança como client-safe, policy, provider, modo local, fallback, filtro, inspeção, pacote de dados, backend, memória interna, dados permitidos ou sistemas da agência.
O campo whyNow deve explicar por que a ideia funciona criativamente agora; nunca deve explicar de onde vieram os dados.
Se o pedido mencionar uma proposta para uma marca, trate como proposta criativa e comercial: oportunidade, fit da Gabi, conceito, execução, papel da marca, provas, desdobramentos e próximo passo. Não invente preços, condições comerciais, contatos ou fatos sobre a marca.
Entregue uma ideia original, executável e com linguagem natural; inspiração não é cópia.
${outputContract}
Nunca inclua dados de contato, valores, credenciais ou bastidores operacionais.${proposalCanon}`;
  const message=`INTENÇÃO: ${intent}
BRIEF: ${brief||'Escolha a melhor direção criativa disponível e me surpreenda.'}
PRESET ADAPTATIVO: ${JSON.stringify(preset)}
RADAR KNOWLEDGE: ${context}`;

  let result=fallback,provider='client-safe-deterministic-fallback';
  const allowedCandidates=buildDivaProviderCandidates(process.env).filter(p=>p&&(
    p.routeClass==='managed_wix_credits'||p.routeClass==='free_tier_external'
  ));
  const providerRouting=routeOrbiProviderCandidates({
    candidates:allowedCandidates,
    orbiId:'ORBI_GABI',
    faceId:'DIVA_GABI',
    message:brief,
    intent
  });
  const candidates=providerRouting.ordered;
  for(const candidate of candidates){
    try{
      const answer=candidate.routeClass==='free_tier_external'
        ?await callGeminiGenerateContent(candidate,{system,message,history,attachments:[]})
        :await callResponses(candidate,{system,message,history,maxOutputTokens:proposalMode?2600:answerMode?1800:1800});
      result=parseGenerated(answer,fallback);provider=candidate.source;break;
    }catch(error){
      console.warn('GABI_DIVA_STUDIO_PROVIDER_FAILURE',{provider:candidate.source,error:safe(error?.message||error,180)});
    }
  }

  try{
    assertGabiClientSafeOutput(result);
    const query=[result.searchTerms?.visual,result.searchTerms?.video,brief,result.headline].filter(Boolean).join(' ');
    const references=answerMode?[]:referenceLinks(query);
    assertGabiClientSafeOutput(references);
    const interactionId='gabi-'+crypto.randomUUID();
    const mentalSignal=buildGabiOrbiInteractionEvent({
      interactionId,
      question:brief,
      intent,
      result,
      routePlan:providerRouting.route.routePlan,
      capabilities:providerRouting.mission.capabilities,
      capacity:{known:false}
    });
    publishGabiMentalSignal(mentalSignal);
    publishGabiMentalReport(buildGabiOrbiDailyReport({events:readGabiMentalSignals()}));
    return res.status(200).json(buildGabiPublicStudioResponse({...result,interactionId},references));
  }catch(error){
    console.error('GABI_DIVA_STUDIO_CLIENT_SAFE_BLOCK',{reasons:error?.reasons||[]});
    return res.status(422).json({
      ok:false,
      error:'creative_output_blocked',
      message:'Não consegui usar essa resposta. Reformule o pedido e eu tento outra direção.'
    });
  }
}
