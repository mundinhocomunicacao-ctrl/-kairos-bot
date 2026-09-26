const COMMITMENT=/\b(contrato|assinar|fechar|fechamento|desconto|%|garantia|exclusividade|multa|prazo de pagamento|parcelamento)\b/iu;
const SENSITIVE=/\b(senha|password|token|api[ -]?key|chave secreta|c[oó]digo de verifica[cç][aã]o|2fa)\b/iu;

export function commercialPolicy(message=''){
  const text=String(message||'').trim();
  if(SENSITIVE.test(text))return{mode:'human_handoff',reason:'sensitive_request'};
  if(COMMITMENT.test(text))return{mode:'human_handoff',reason:'commercial_commitment'};
  return{mode:'auto',reason:'standard_sales'};
}

export function normalizeMetaWebhook(payload={}){
  const events=[];
  for(const entry of Array.isArray(payload.entry)?payload.entry:[]){
    for(const change of Array.isArray(entry?.changes)?entry.changes:[]){
      const value=change?.value||{};
      const phoneNumberId=String(value?.metadata?.phone_number_id||'').trim();
      const contacts=new Map((Array.isArray(value?.contacts)?value.contacts:[]).map(c=>[String(c?.wa_id||''),c]));
      for(const message of Array.isArray(value?.messages)?value.messages:[]){
        if(message?.type!=='text')continue;
        const from=String(message?.from||'').replace(/\D/g,'');
        const body=String(message?.text?.body||'').trim();
        const id=String(message?.id||'').trim();
        if(!from||!body||!id)continue;
        const contact=contacts.get(from);
        const policy=commercialPolicy(body);
        events.push({
          surface_id:'whatsapp_business',
          message:body,
          conversation_ref:'whatsapp-business://'+from,
          external_event_id:id,
          currentRoute:'/webhooks/meta/whatsapp',
          attachments:[],
          evidence_ids:[],
          adapter_metadata:{
            schema_version:'diva-surface-adapter-v0.1',
            surface_id:'whatsapp_business',
            supplied_keys:['whatsapp_business_phone_number_id','whatsapp_message_id','whatsapp_sender_id','commercial_policy']
          },
          context:[
            'CANAL AUTORIZADO: WhatsApp Business comercial da Mundinho Comunicação.',
            'DIVA Comercial usa o mesmo Universal Private Gateway e a mesma governança do MUNDO.',
            'Nunca exponha segredos, tokens ou contexto privado de outras superfícies.',
            policy.mode==='human_handoff'
              ?'GATE HUMANO OBRIGATÓRIO: não assumir compromisso comercial irreversível; preparar resposta e encaminhar para aprovação humana.'
              :'MODO COMERCIAL AUTOMÁTICO: qualificar intenção, esclarecer serviços e avançar a conversa sem inventar preço, disponibilidade ou condição.'
          ].join('\n'),
          history:[],
          native_adapter_metadata:{
            whatsapp_business_phone_number_id:phoneNumberId||null,
            whatsapp_message_id:id,
            whatsapp_sender_id:from,
            whatsapp_sender_name:String(contact?.profile?.name||'').slice(0,160)||null,
            commercial_policy:policy
          }
        });
      }
    }
  }
  return events;
}
