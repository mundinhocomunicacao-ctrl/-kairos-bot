import {
  verifyAlexaRequest,
  normalizeAlexaInbound,
  buildAlexaResponse
} from '../../lib/alexa-diva-gateway-adapter.mjs';
import {
  invokeDivaGatewaySurface,
  resolveNativeSurfaceInstallationId
} from '../../lib/diva-gateway-native-client.mjs';
import {classifyDivaVoiceAction,classifyDivaVoiceRisk,classifyDivaVoiceContextScope} from '../../lib/diva-voice-action.mjs';
import {normalizeAlexaSessionState,buildAlexaSessionState,resolveAlexaControlTurn} from '../../lib/alexa-diva-session-state.mjs';

export const config={api:{bodyParser:false}};

const MAX_BODY_BYTES=256_000;

async function readRawBody(req){
  const chunks=[];let size=0;
  for await(const chunk of req){
    const buf=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    size+=buf.length;
    if(size>MAX_BODY_BYTES)throw new Error('payload_too_large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}
function respond(res,status,payload){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('Pragma','no-cache');
  return res.status(status).json(payload);
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  if(req.method!=='POST')return respond(res,405,{ok:false,error:'method_not_allowed'});

  const skillId=String(process.env.DIVA_ALEXA_SKILL_ID||'amzn1.ask.skill.55955ad9-9398-46ea-bb14-add74a0aedc0').trim();
  if(!skillId)return respond(res,503,{ok:false,error:'diva_alexa_skill_id_missing'});

  let rawBody;
  try{rawBody=await readRawBody(req)}catch(error){
    return respond(res,error?.message==='payload_too_large'?413:400,{ok:false,error:error?.message||'invalid_body'});
  }

  let envelope;
  try{envelope=JSON.parse(rawBody.toString('utf8'))}catch{
    return respond(res,400,{ok:false,error:'invalid_json'});
  }

  const verified=await verifyAlexaRequest({
    rawBody,
    headers:req.headers||{},
    envelope,
    expectedSkillId:skillId
  });
  if(!verified.ok)return respond(res,400,{ok:false,error:verified.reason});

  const inbound=normalizeAlexaInbound(envelope);
  const priorState=normalizeAlexaSessionState(inbound.sessionAttributes);
  if(inbound.kind==='session_end')return respond(res,200,{version:'1.0',response:{}});
  if(inbound.kind==='launch'){
    return respond(res,200,buildAlexaResponse({
      text:'Pode falar.',
      reprompt:'Pode falar normal.',
      shouldEndSession:false,
      sessionAttributes:buildAlexaSessionState({prior:priorState,pendingFollowup:''})
    }));
  }
  if(inbound.kind==='stop'){
    return respond(res,200,buildAlexaResponse({text:'Tá.',shouldEndSession:true,sessionAttributes:{}}));
  }
  if(inbound.kind==='control'){
    const turn=resolveAlexaControlTurn({control:inbound.control,state:priorState});
    if(turn.kind==='local'){
      const voiceOptions=turn.voiceMode==='read_artifact'?{maxChars:800,maxSentences:8,continuationPrompt:true,continuationText:'Quer que eu continue?'}:{continuationPrompt:false};
      const local=buildAlexaResponse({text:turn.text,reprompt:'O que você precisa?',shouldEndSession:false,voiceOptions,sessionAttributes:turn.state});
      local.sessionAttributes={...turn.state,last_spoken:local.response.outputSpeech.text};
      return respond(res,200,local);
    }
    inbound.kind='query';
    inbound.message=turn.message;
    inbound.voiceMode=turn.voiceMode||priorState.voice_mode||'default';
  }
  if(inbound.kind==='help'){
    return respond(res,200,buildAlexaResponse({
      text:'Pode falar normal. Eu consigo te atualizar, continuar uma frente, criar tarefa, anotar decisão ou registrar bloqueio.',
      reprompt:'O que você precisa?',
      shouldEndSession:false
    }));
  }
  if(!['query','action'].includes(inbound.kind)||!inbound.message){
    return respond(res,200,buildAlexaResponse({
      text:'Não peguei. Pode dizer só status, nova tarefa, bloqueio ou o nome da área.',
      reprompt:'O que você precisa?',
      shouldEndSession:false
    }));
  }

  let installationId;
  try{
    installationId=resolveNativeSurfaceInstallationId({
      externalId:inbound.userId,
      mapJson:process.env.DIVA_ALEXA_INSTALLATION_MAP_JSON||'',
      defaultInstallationId:process.env.DIVA_ALEXA_DEFAULT_INSTALLATION_ID||'fernando-alexa',
      surfaceId:'alexa'
    });
  }catch(error){
    console.error('DIVA_ALEXA_IDENTITY_ERROR',{message:String(error?.message||error).slice(0,240)});
    return respond(res,200,buildAlexaResponse({
      text:'Esta conta Alexa ainda não está autorizada na DIVA.',
      shouldEndSession:true
    }));
  }

  const voiceAction=classifyDivaVoiceAction(inbound.message);
  const voiceRisk=classifyDivaVoiceRisk(inbound.message);
  const voiceMode=inbound.voiceMode||priorState.voice_mode||'default';
  const artifactLabel=inbound.artifactLabel||priorState.artifact_label||'';
  const contextScope=inbound.contextScopeHint|| (voiceAction?'default':classifyDivaVoiceContextScope(inbound.message));
  if(!voiceAction&&voiceRisk.requiresConfirmation){
    return respond(res,200,buildAlexaResponse({
      text:'Essa ação pode ter impacto externo ou comercial. Por segurança, confirme e execute pelo Mundinho OS ou pelo ChatGPT da DIVA.',
      reprompt:'Você pode me pedir uma tarefa simples do OS ou fazer uma consulta.',
      shouldEndSession:false
    }));
  }

  try{
    const generated=await invokeDivaGatewaySurface({
      installationId,
      surfaceId:'alexa',
      operation:voiceAction?'voice_action':'execute',
      message:inbound.message,
      conversationRef:inbound.conversationRef,
      externalEventId:inbound.externalEventId,
      currentRoute:'/api/alexa-diva',
      contextScope,
      context:[
        'CANAL AUTORIZADO: Amazon Alexa Custom Skill privada.',
        'A Alexa é apenas uma superfície da DIVA Universal Private Gateway; não existe cérebro paralelo.',
        'MUNDINHO OS É O ESCOPO PADRÃO: priorize estado, evolução, bloqueios, tarefas e próximos movimentos do OS/MUNDO.',
        'Não presumir Gabriella Saraivah como assunto padrão; só entrar no contexto Gabi quando Fernando mencionar Gabi, Gabriella, talento, marca ou oportunidade relacionada.',
        contextScope==='mundinho_os_system'?'ESCOPO DE SISTEMA: excluir memória de talentos, marcas, oportunidades e negociações; responder somente sobre estado operacional, runtime, tarefas, bloqueios, integrações e evolução do Mundinho OS.':'',
        'ESCUTA PRIMEIRO: o humano é dono do turno. Se ele interromper, corrigir ou continuar a frase, pare de produzir e escute antes de responder.',
        'PENSE FUNDO, FALE O SUFICIENTE: a análise interna pode ser ampla; a primeira fala deve resolver sem ocupar espaço desnecessário. Curto é preferência de voz, não limite rígido.',
        'SILÊNCIO É VÁLIDO: não faça pergunta de manutenção, não preencha pausa e não tente ter a última palavra quando a intenção já estiver atendida.',
        'FILTRO HUMANO DE VOZ: responda primeiro e não narre seu raciocínio, metodologia, fontes, IDs ou arquitetura salvo se pedirem.',
        'Se houver muitos pontos, fale só os dois que mudam a próxima ação e ofereça aprofundar. Não leia listas.',
        'Fale pt-BR natural, concreto e simples. Não use gíria forçada, slogan, taxonomia ou jargão interno para parecer humano.',
        priorState.last_user_message||priorState.last_answer?`CONTINUIDADE DA SESSÃO DE VOZ — último pedido: ${priorState.last_user_message||'n/d'} · última resposta: ${priorState.last_answer||'n/d'}`:'',
        voiceMode==='task_list'?'EXCEÇÃO DE LISTA: o usuário pediu explicitamente lista de tarefas; pode numerar itens curtos e acionáveis. Fora deste modo, não leia listas.':'',
        voiceMode==='draft'?'ARTEFATO DE TEXTO: gere o rascunho completo e pronto para uso. A interface de voz falará apenas a confirmação e entregará o conteúdo integral no cartão da Alexa. Não afirme envio.':''
      ].join('\n'),
      metadata:{
        alexa_user_id:inbound.userId,
        alexa_request_id:inbound.externalEventId,
        alexa_locale:inbound.locale
      }
    });
    const answer=String(generated?.payload?.answer||'').trim();
    if(!answer)throw new Error('diva_gateway_empty_answer');
    let spokenSource=answer;
    let card=null;
    let voiceOptions={};
    let pendingFollowup='deepen';
    if(voiceMode==='task_list'){
      voiceOptions={maxChars:850,maxSentences:8,continuationPrompt:true,continuationText:'Quer que eu continue?'};
      card={title:'DIVA · tarefas',content:answer};
      pendingFollowup='continue_list';
    }else if(voiceMode==='draft'){
      spokenSource=`Criei o rascunho de ${artifactLabel||'texto'}. Quer que eu leia?`;
      voiceOptions={maxChars:220,maxSentences:2,continuationPrompt:false};
      card={title:`DIVA · ${artifactLabel||'rascunho'}`,content:answer};
      pendingFollowup='artifact_created';
    }else if(voiceMode==='daily_brief'){
      voiceOptions={maxChars:420,maxSentences:3,continuationPrompt:false};
      pendingFollowup='deepen';
    }
    const response=buildAlexaResponse({
      text:spokenSource,
      reprompt:voiceMode==='draft'?'Quer que eu leia?':'O que você precisa?',
      shouldEndSession:false,
      voiceOptions,
      card,
      sessionAttributes:{}
    });
    response.sessionAttributes=buildAlexaSessionState({
      prior:priorState,
      missionId:generated.mission_id||null,
      userMessage:inbound.message,
      answer,
      spoken:response.response.outputSpeech.text,
      pendingFollowup,
      voiceMode,
      artifactLabel
    });
    return respond(res,200,response);
  }catch(error){
    console.error('DIVA_ALEXA_GATEWAY_ERROR',{
      requestId:inbound.externalEventId||null,
      message:String(error?.message||error).slice(0,500)
    });
    return respond(res,200,buildAlexaResponse({
      text:'A DIVA está conectada, mas não conseguiu concluir essa resposta agora.',
      reprompt:'Você pode tentar de novo.',
      shouldEndSession:false
    }));
  }
}
