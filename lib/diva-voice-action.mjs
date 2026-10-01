const CLEAN_LIMIT=1600;

function clean(value,limit=CLEAN_LIMIT){
  return Array.from(String(value??'')).slice(0,limit).join('').replace(/\s+/g,' ').trim();
}
function action(type,text,extra={}){
  const value=clean(text);
  return value?{type,text:value,...extra}:null;
}
function priorityValue(value){
  const v=clean(value,40).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(v==='alta'||v==='p1')return'P1';
  if(v==='media'||v==='p2')return'P2';
  if(v==='baixa'||v==='p3')return'P3';
  return null;
}
function ownerValue(value){
  const v=clean(value,80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  if(v==='fernando')return'Fernando';
  if(v==='johnny')return'Johnny';
  if(v==='vitoria')return'Vitória';
  return null;
}

function normalizedVoiceQuery(value){
  return clean(value,1200).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9@.]+/g,' ').replace(/\s+/g,' ').trim();
}

export function classifyDivaVoiceContextScope(message=''){
  const q=normalizedVoiceQuery(message);
  if(!q)return'default';
  const explicitCommercial=/\b(gabi|gabriella|saraivah|talento|marca|cliente|oportunidade|negociacao|negociacoes|proposta|propostas|campanha|creator|influenciador)\b/.test(q);
  if(explicitCommercial)return'default';
  const systemQuery=/\b(mundinho os|os mundinho|status do os|prioridades do os|prioridades do mundinho|prioridade do os|saude do os|saude do sistema|estado do os|estado do sistema|como esta o os|como esta o sistema|sistema mundinho|runtime|deploy|release|build do os|subida do os|bloqueio do os|bloqueios do os|integracoes do os|integracao do os|social insights|pipeline|agenda|contatos|crm|radar|workspace|explorer|configuracoes)\b/.test(q);
  return systemQuery?'mundinho_os_system':'default';
}

export function classifyDivaVoiceAction(message=''){
  const raw=clean(message);
  if(!raw)return null;
  let m;

  m=raw.match(/^(?:registre|registra|anote|salve)\s+(?:uma\s+)?nota(?:\s+(?:no|na)\s+(?:os|sistema|mundo))?\s+(.+)$/i);
  if(m)return action('record_note',m[1]);

  m=raw.match(/^(?:registre|registra|salve)\s+(?:um\s+)?aprendizado\s+(.+)$/i);
  if(m)return action('record_learning',m[1]);
  m=raw.match(/^aprenda\s+que\s+(.+)$/i);
  if(m)return action('record_learning',m[1]);

  m=raw.match(/^(?:registre|registra|salve)\s+(?:uma\s+)?decis[aã]o\s+(.+)$/i);
  if(m)return action('record_decision',m[1]);

  m=raw.match(/^(?:crie|criar|adicione|adicionar|inclua|incluir|coloque)\s+(?:uma\s+)?tarefa(?:\s+(?:no|na)\s+(?:os|sistema|agenda))?\s+(.+)$/i);
  if(m)return action('create_task',m[1]);
  m=raw.match(/^(?:coloque|adicione|inclua)\s+(?:na|no)\s+agenda\s+(.+)$/i);
  if(m)return action('create_task',m[1]);

  m=raw.match(/^(?:conclua|concluir|finalize|finalizar)\s+(?:a\s+)?tarefa\s+(.+)$/i);
  if(m)return action('complete_task',m[1].replace(/\s+como\s+conclu[ií]da$/i,''));
  m=raw.match(/^marque\s+(?:a\s+)?tarefa\s+(.+?)\s+como\s+conclu[ií]da$/i);
  if(m)return action('complete_task',m[1]);

  m=raw.match(/^(?:registre|registra|marque)\s+(?:um\s+)?bloqueio\s+(.+)$/i);
  if(m)return action('record_blocker',m[1]);
  m=raw.match(/^(?:resolva|resolver|feche|destrave|destravar|destrava)\s+(?:o\s+)?bloqueio\s+(.+)$/i);
  if(m)return action('resolve_blocker',m[1]);
  m=raw.match(/^marque\s+(?:o\s+)?bloqueio\s+(.+?)\s+como\s+resolvido$/i);
  if(m)return action('resolve_blocker',m[1]);

  m=raw.match(/^defina\s+prioridade\s+(alta|m[eé]dia|baixa|p1|p2|p3)\s+(?:para|na|na tarefa|para a tarefa)\s+(.+)$/i);
  if(m)return action('set_priority',m[2],{priority:priorityValue(m[1])});

  m=raw.match(/^atribua\s+(?:a\s+)?tarefa\s+(.+?)\s+(?:para|ao|[àa])\s+(fernando|johnny|vit[oó]ria)$/i);
  if(m)return action('assign_task',m[1],{owner:ownerValue(m[2])});

  m=raw.match(/^(?:uma\s+)?tarefa\s+(.+)$/i);
  if(m)return action('create_task',m[1]);
  m=raw.match(/^(?:uma\s+)?nota(?:\s+(?:no|na)\s+(?:os|sistema|mundo))?\s+(.+)$/i);
  if(m)return action('record_note',m[1]);
  m=raw.match(/^(?:um\s+)?aprendizado\s+(.+)$/i);
  if(m)return action('record_learning',m[1]);
  m=raw.match(/^(?:uma\s+)?decis[aã]o\s+(.+)$/i);
  if(m)return action('record_decision',m[1]);
  m=raw.match(/^(?:um\s+)?bloqueio\s+(.+)$/i);
  if(m)return action('record_blocker',m[1]);

  return null;
}

export function classifyDivaVoiceRisk(message=''){
  const raw=clean(message).toLowerCase();
  const critical=/^(?:envie|manda|mande|publique|publica|apague|delete|exclua|pague|compre|contrate|cancele|mude\s+o\s+est[aá]gio|altere\s+o\s+est[aá]gio|feche\s+(?:o|a)\s+neg[oó]cio)/i.test(raw);
  return critical?{level:'critical',requiresConfirmation:true}:{level:'normal',requiresConfirmation:false};
}

export function buildDivaVoiceActionWriteback({action:input}={}){
  if(!input?.type||!clean(input.text))throw new Error('DIVA_VOICE_ACTION_INVALID');
  const base={voice_action_type:input.type,text:clean(input.text),status:'recorded'};
  switch(input.type){
    case'record_note':return{destination:'workspace',kind:'observation',payload:{...base,record_type:'note'}};
    case'record_learning':return{destination:'workspace',kind:'learning',payload:{...base,record_type:'learning'}};
    case'record_decision':return{destination:'workspace',kind:'decision',payload:{...base,record_type:'decision'}};
    case'create_task':return{destination:'agenda',kind:'artifact',payload:{...base,record_type:'task',status:'open'}};
    case'complete_task':return{destination:'agenda',kind:'state_change',payload:{...base,record_type:'task',status:'done'}};
    case'record_blocker':return{destination:'configuracoes',kind:'observation',payload:{...base,record_type:'blocker',status:'blocked'}};
    case'resolve_blocker':return{destination:'configuracoes',kind:'state_change',payload:{...base,record_type:'blocker',status:'resolved'}};
    case'set_priority':return{destination:'agenda',kind:'state_change',payload:{...base,record_type:'task',status:'open',priority:input.priority||null}};
    case'assign_task':return{destination:'agenda',kind:'state_change',payload:{...base,record_type:'task',status:'open',owner:input.owner||null}};
    default:throw new Error('DIVA_VOICE_ACTION_UNSUPPORTED');
  }
}

export function buildDivaVoiceActionSpeech({action:input,verified=false}={}){
  if(!input)return'Não peguei uma ação segura aí.';
  if(!verified)return'Eu entendi, mas a gravação não confirmou. Não vou dizer que ficou salvo.';
  const text=clean(input.text,400);
  switch(input.type){
    case'create_task':return'Feito. Criei a tarefa: '+text+'.';
    case'complete_task':return'Feito. Marquei como concluída: '+text+'.';
    case'record_note':return'Anotado: '+text+'.';
    case'record_learning':return'Aprendi e registrei: '+text+'.';
    case'record_decision':return'Fechado. Registrei a decisão: '+text+'.';
    case'record_blocker':return'Registrei o bloqueio: '+text+'.';
    case'resolve_blocker':return'Resolvido. Fechei o bloqueio: '+text+'.';
    case'set_priority':return'Feito. Prioridade '+(input.priority||'')+' para '+text+'.';
    case'assign_task':return'Feito. '+text+' ficou com '+(input.owner||'o responsável definido')+'.';
    default:return'Feito. A ação ficou registrada.';
  }
}
