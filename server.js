import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const API_KEY = process.env.WHATSSCALE_API_KEY;
const SESSION = process.env.WHATSSCALE_SESSION || 'user_8b1cb7983c6d4999b2cffecca2da723a_08Q8thOB';
const GROUP_JID = process.env.WHATSSCALE_GROUP_JID || '120363411404153606@g.us';
const TRIGGER_SECRET = process.env.KAIROS_TRIGGER_SECRET;
const TEST_TOKEN = process.env.KAIROS_TEST_TOKEN;
const WHATSSCALE_WEBHOOK_SECRET = process.env.WHATSSCALE_WEBHOOK_SECRET;
const DIVA_INGRESS_URL = process.env.DIVA_INGRESS_URL;
const DIVA_BRIDGE_SECRET = process.env.DIVA_BRIDGE_SECRET;
const DIVA_SUBSCRIBE_TOKEN = process.env.DIVA_SUBSCRIBE_TOKEN;
const DIVA_WHATSAPP_WEBHOOK_URL = process.env.DIVA_WHATSAPP_WEBHOOK_URL;
const DIVA_REPLY_TOKEN = process.env.DIVA_REPLY_TOKEN;
const DIVA_AUTO_SUBSCRIBE = String(process.env.DIVA_AUTO_SUBSCRIBE || '').toLowerCase() === 'true';
const DIVA_STARTUP_CANARY = String(process.env.DIVA_STARTUP_CANARY || '').toLowerCase() === 'true';
const DIVA_AUTHORIZED_CANARY_ON_START = String(process.env.DIVA_AUTHORIZED_CANARY_ON_START || '').toLowerCase() === 'true';
const DIVA_AUTHORIZED_CANARY_CHAT_ID = String(process.env.DIVA_AUTHORIZED_CANARY_CHAT_ID || '').trim();
const DIVA_WHATSAPP_SESSION = String(process.env.DIVA_WHATSAPP_SESSION || '').trim();
const DIVA_WHATSAPP_GROUP_JID = String(process.env.DIVA_WHATSAPP_GROUP_JID || '120363427121075030@g.us').trim();
const DIVA_GATEWAY_URL = String(process.env.DIVA_GATEWAY_URL || 'https://mundinho-os-mundinhocomunicaca-0b12.wix-site-host.com/api/diva-gateway/execute').trim();
const DIVA_GATEWAY_PATH = '/api/diva-gateway/execute';
const DIVA_GATEWAY_INSTALLATION_ID = String(process.env.DIVA_GATEWAY_INSTALLATION_ID || 'fernando-whatsapp').trim();
const DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP = String(process.env.DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP || '').trim();
const DIVA_GATEWAY_VERSION = 'diva-universal-private-gateway-v0.1';
const BASE_URL = 'https://proxy.whatsscale.com';
const TEST_TEXT = '🧪 TESTE TÉCNICO KAIROS — rota cloud WhatsApp em validação. Não é uma edição KAIROS.';
let testSent = false;
let activeWebhookSecret = WHATSSCALE_WEBHOOK_SECRET || '';
let activeSubscriptionId = null;
let subscriptionPromise = null;
let lastCanaryStatus = 'not_run';
let activeDivaSession = DIVA_WHATSAPP_SESSION || SESSION;
const providerDiagnostics = {
  lastCheckedAt: null,
  sessionStatus: null,
  divaSessionAutoSelected: false,
  divaSessionLast4: null,
  sessionCount: null,
  sessionSelfLast4: null,
  otherSessionSuffixes: [],
  authorizedTargetMatchesSessionSelf: null,
  activeSubscriptionId: null,
  subscriptionIsActive: null,
  failureCount: null,
  lastTriggeredAt: null,
  lastSuccessAt: null,
  recentDeliveryStatusCounts: {},
  error: null
};

const bridgeStats = {
  providerWebhooksAccepted: 0,
  divaForwardAttempts: 0,
  divaForwardSuccess: 0,
  gatewayAttempts: 0,
  gatewaySuccess: 0,
  replyRelayRequests: 0,
  outboundSent: 0,
  lastWixStatus: null,
  lastGatewayStatus: null,
  lastProviderEventAt: null,
  lastReplyAt: null
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function safeEqual(a = '', b = '') {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function whatsScaleJson(path, init = {}) {
  if (!API_KEY) throw new Error('WHATSSCALE_API_KEY is not configured');
  const response = await fetch(BASE_URL + path, {
    ...init,
    headers: {
      'X-Api-Key': API_KEY,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {})
    }
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  return { response, data, raw };
}

function whatsappIdentityDigits(value=''){
  return String(value||'')
    .split('@')[0]
    .split(':')[0]
    .replace(/\D/g,'');
}

async function refreshProviderDiagnostics({force=false}={}){
  const now=Date.now();
  const last=providerDiagnostics.lastCheckedAt?Date.parse(providerDiagnostics.lastCheckedAt):0;
  if(!force&&last&&now-last<10000)return providerDiagnostics;
  providerDiagnostics.lastCheckedAt=new Date(now).toISOString();
  providerDiagnostics.error=null;
  try{
    const sessionsResult=await whatsScaleJson('/api/sessions');
    if(!sessionsResult.response.ok)throw new Error('sessions_http_'+sessionsResult.response.status);
    const sessions=Array.isArray(sessionsResult.data)?sessionsResult.data:[];
    const current=sessions.find(item=>String(item?.name||'')===String(activeDivaSession))||null;
    providerDiagnostics.sessionCount=sessions.length;
    providerDiagnostics.divaSessionAutoSelected=false;
    providerDiagnostics.otherSessionSuffixes=sessions
      .filter(item=>String(item?.name||'')!==String(activeDivaSession))
      .map(item=>String(item?.me?.id||'').replace(/\D/g,'').slice(-4))
      .filter(Boolean);
    providerDiagnostics.sessionStatus=current?.status||null;
    const selfId=String(current?.me?.id||'').trim();
    const selfDigits=whatsappIdentityDigits(selfId);
    providerDiagnostics.sessionSelfLast4=selfDigits?selfDigits.slice(-4):null;
    providerDiagnostics.divaSessionLast4=providerDiagnostics.sessionSelfLast4;
    const targetId=String(DIVA_AUTHORIZED_CANARY_CHAT_ID||'').trim();
    providerDiagnostics.authorizedTargetMatchesSessionSelf=Boolean(selfId&&targetId&&selfId===targetId);

    const hooksResult=await whatsScaleJson('/v1/webhooks');
    if(!hooksResult.response.ok)throw new Error('webhooks_http_'+hooksResult.response.status);
    const subscriptions=Array.isArray(hooksResult.data?.subscriptions)?hooksResult.data.subscriptions:[];
    const currentSub=subscriptions.find(item=>
      String(item?.session||'')===String(activeDivaSession)&&
      String(item?.trigger_type||'')==='group'&&
      String(item?.filter_id||'')===String(DIVA_WHATSAPP_GROUP_JID)&&
      String(item?.webhook_url||'')===String(DIVA_WHATSAPP_WEBHOOK_URL)
    )||null;
    providerDiagnostics.activeSubscriptionId=currentSub?.id||activeSubscriptionId||null;
    providerDiagnostics.subscriptionIsActive=currentSub?.is_active??null;
    providerDiagnostics.failureCount=currentSub?.failure_count??null;
    providerDiagnostics.lastTriggeredAt=currentSub?.last_triggered_at||null;
    providerDiagnostics.lastSuccessAt=currentSub?.last_success_at||null;

    const subId=providerDiagnostics.activeSubscriptionId;
    providerDiagnostics.recentDeliveryStatusCounts={};
    if(subId){
      const deliveriesResult=await whatsScaleJson('/v1/webhooks/'+encodeURIComponent(subId)+'/deliveries?limit=10');
      if(deliveriesResult.response.ok){
        const deliveries=Array.isArray(deliveriesResult.data?.deliveries)?deliveriesResult.data.deliveries:[];
        for(const delivery of deliveries){
          const status=String(delivery?.status||'unknown');
          providerDiagnostics.recentDeliveryStatusCounts[status]=(providerDiagnostics.recentDeliveryStatusCounts[status]||0)+1;
        }
      }
    }
  }catch(error){
    providerDiagnostics.error=String(error?.message||error).slice(0,160);
  }
  return providerDiagnostics;
}

async function sendWhatsAppToChat(chatId, text, sessionName=SESSION) {
  const recipient = String(chatId || '').trim();
  const message = String(text || '').trim();
  if (!recipient) throw new Error('chatId is required');
  if (!message) throw new Error('text is required');
  if (message.length > 4096) throw new Error('text exceeds WhatsScale 4096 character limit');
  const { response, data } = await whatsScaleJson('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({ session: sessionName, chatId: recipient, text: message })
  });
  if (!response.ok) {
    const err = new Error(`WhatsScale returned HTTP ${response.status}`);
    err.details = data;
    throw err;
  }
  const topLevelKeys = data && typeof data === 'object' ? Object.keys(data).sort() : [];
  const nestedDataKeys = data?.data && typeof data.data === 'object' ? Object.keys(data.data).sort() : [];
  const nestedUnderscoreDataKeys = data?._data && typeof data._data === 'object' ? Object.keys(data._data).sort() : [];
  const nestedKeyKeys = data?.key && typeof data.key === 'object' ? Object.keys(data.key).sort() : [];
  console.log('WHATSCALE_SEND_RECEIPT_SHAPE', { topLevelKeys, nestedDataKeys, nestedUnderscoreDataKeys, nestedKeyKeys });
  return data;
}

async function sendWhatsApp(text) {
  return sendWhatsAppToChat(GROUP_JID, text);
}

async function subscribeDivaWebhook() {
  if (!DIVA_WHATSAPP_WEBHOOK_URL) throw new Error('DIVA_WHATSAPP_WEBHOOK_URL is not configured');
  await refreshProviderDiagnostics({force:true});
  const payload = {
    session: activeDivaSession,
    webhook_url: DIVA_WHATSAPP_WEBHOOK_URL,
    trigger_type: 'group',
    filter_id: DIVA_WHATSAPP_GROUP_JID
  };
  let attempt = await whatsScaleJson('/v1/webhooks/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (attempt.response.status === 409) {
    const subscriptionId = String(attempt.data?.subscription_id || '');
    if (!subscriptionId) throw new Error('WhatsScale duplicate webhook without subscription_id');
    activeSubscriptionId = subscriptionId;
    console.log('DIVA_WHATSAPP_EXISTING_SUBSCRIPTION_PRESERVED',{subscriptionId});
    if (!activeWebhookSecret) {
      throw new Error('existing subscription preserved; signing secret unavailable in this process. Configure WHATSSCALE_WEBHOOK_SECRET instead of rotating the subscription');
    }
    return {
      subscription_id: subscriptionId,
      signing_secret: activeWebhookSecret,
      webhook_url: DIVA_WHATSAPP_WEBHOOK_URL,
      trigger_type: 'group',
      filter_id: DIVA_WHATSAPP_GROUP_JID,
      existing_subscription_preserved: true
    };
  }

  if (!attempt.response.ok) {
    const err = new Error(`WhatsScale subscribe returned HTTP ${attempt.response.status}`);
    err.details = attempt.data;
    throw err;
  }
  const signingSecret = String(attempt.data?.signing_secret || '');
  const subscriptionId = String(attempt.data?.subscription_id || '');
  if (!signingSecret || !subscriptionId) throw new Error('WhatsScale subscribe response missing signing_secret or subscription_id');
  activeWebhookSecret = signingSecret;
  activeSubscriptionId = subscriptionId;
  return {
    subscription_id: subscriptionId,
    signing_secret: signingSecret,
    webhook_url: attempt.data?.webhook_url || DIVA_WHATSAPP_WEBHOOK_URL,
    trigger_type: attempt.data?.trigger_type || 'group',
    filter_id: attempt.data?.filter_id || DIVA_WHATSAPP_GROUP_JID,
    existing_subscription_preserved: false
  };
}

async function ensureDivaSubscription(){
  if(subscriptionPromise)return subscriptionPromise;
  subscriptionPromise=subscribeDivaWebhook().finally(()=>{subscriptionPromise=null});
  return subscriptionPromise;
}

function verifyActiveWebhookSignature({raw,supplied,timestamp,nowSeconds=Math.floor(Date.now()/1000)}={}){
  const ts=Number(timestamp);
  if(!activeWebhookSecret||!raw||!supplied||!Number.isFinite(ts))return false;
  if(Math.abs(Number(nowSeconds)-ts)> 300)return false;
  const expected='sha256='+crypto.createHmac('sha256',activeWebhookSecret).update(raw).digest('hex');
  return safeEqual(String(supplied),expected);
}

function stableStringify(value){
  if(Array.isArray(value))return '['+value.map(stableStringify).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stableStringify(value[key])).join(',')+'}';
  }
  return JSON.stringify(value);
}

function sha256Hex(value){
  return crypto.createHash('sha256').update(String(value||'')).digest('hex');
}

function divaGatewayHeaders(body){
  if(!DIVA_GATEWAY_INSTALLATION_ID)throw new Error('DIVA_GATEWAY_INSTALLATION_ID is not configured');
  if(!DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP)throw new Error('DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP is not configured');
  const timestamp=new Date().toISOString();
  const nonce=crypto.randomUUID();
  const material=[
    DIVA_GATEWAY_VERSION,
    DIVA_GATEWAY_INSTALLATION_ID,
    timestamp,
    nonce,
    'POST',
    DIVA_GATEWAY_PATH,
    sha256Hex(stableStringify(body))
  ].join('\n');
  const signature=crypto.createHmac('sha256',DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP).update(material).digest('hex');
  return{
    'content-type':'application/json',
    'x-diva-installation-id':DIVA_GATEWAY_INSTALLATION_ID,
    'x-diva-timestamp':timestamp,
    'x-diva-nonce':nonce,
    'x-diva-signature':signature,
    'x-diva-gateway-version':DIVA_GATEWAY_VERSION
  };
}

function extractDivaPrompt(message=''){
  const text=String(message||'').trim();
  const match=text.match(/^\s*@?diva\b\s*[:,\-]?\s*(.*)$/isu);
  if(!match)return null;
  return String(match[1]||'').trim()||'Oi, DIVA.';
}

function buildDivaGatewayBody(providerEvent={}){
  const data=providerEvent?.data&&typeof providerEvent.data==='object'?providerEvent.data:{};
  const message=String(data.body||'').trim();
  const eventId=String(providerEvent?.event_id||data.message_id||'').trim();
  return{
    surface_id:'whatsapp',
    message,
    conversation_ref:'whatsapp://'+DIVA_WHATSAPP_GROUP_JID,
    ...(eventId?{external_event_id:eventId}:{}),
    currentRoute:'/webhooks/whatsscale',
    attachments:[],
    evidence_ids:[],
    adapter_metadata:{
      schema_version:'diva-surface-adapter-v0.1',
      surface_id:'whatsapp',
      supplied_keys:['whatsapp_group_id','whatsapp_message_id','whatsapp_sender_id','whatsapp_trigger_type']
    },
    context:[
      'CANAL AUTORIZADO: grupo interno do WhatsApp via Render/WhatsScale.',
      'A entrada usa o DIVA Universal Private Gateway; não existe runtime paralelo.',
      'GRUPO WHATSAPP: '+DIVA_WHATSAPP_GROUP_JID,
      data.participant_name?'NOME OBSERVADO NO WHATSAPP: '+String(data.participant_name).slice(0,160):''
    ].filter(Boolean).join('\n'),
    history:[],
    native_adapter_metadata:{
      whatsapp_group_id:DIVA_WHATSAPP_GROUP_JID,
      whatsapp_message_id:String(data.message_id||'').slice(0,256)||null,
      whatsapp_sender_id:String(data.participant_id||'').slice(0,256)||null,
      whatsapp_trigger_type:'group'
    }
  };
}

async function invokeDivaGatewayDirect(providerEvent={}){
  if(!DIVA_GATEWAY_URL)throw new Error('DIVA_GATEWAY_URL is not configured');
  const body=buildDivaGatewayBody(providerEvent);
  bridgeStats.gatewayAttempts+=1;
  const response=await fetch(DIVA_GATEWAY_URL,{
    method:'POST',
    headers:divaGatewayHeaders(body),
    body:JSON.stringify(body)
  });
  const raw=await response.text();
  let data={};
  try{data=raw?JSON.parse(raw):{}}catch{data={raw}}
  const answer=String(data?.answer||data?.result?.answer||data?.payload?.answer||'').trim();
  bridgeStats.lastGatewayStatus=response.ok?'ok':String(data?.error||('http_'+response.status)).slice(0,120);
  if(!response.ok||!answer){
    const error=new Error('DIVA Gateway returned '+response.status+(answer?'':' without answer'));
    error.details={status:response.status,error:String(data?.error||'').slice(0,200)};
    throw error;
  }
  bridgeStats.gatewaySuccess+=1;
  console.log('DIVA_WHATSAPP_GATEWAY_RESULT',{
    httpStatus:response.status,
    gatewayAttempts:bridgeStats.gatewayAttempts,
    gatewaySuccess:bridgeStats.gatewaySuccess,
    missionMode:String(response.headers.get('x-diva-gateway-mission-mode')||'').slice(0,40),
    answerChars:answer.length
  });
  return{answer,data,status:response.status};
}

async function runDivaGatewayCanary(){
  if(!DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP)throw new Error('DIVA direct Gateway secret unavailable');
  const eventId='diva_gateway_canary_'+Date.now();
  const result=await invokeDivaGatewayDirect({
    event_id:eventId,
    event_type:'incoming.message',
    trigger_type:'group',
    data:{
      message_id:eventId+'_msg',
      group_id:DIVA_WHATSAPP_GROUP_JID,
      participant_id:'gateway-canary@lid',
      participant_phone:'',
      participant_name:'DIVA Gateway Canary',
      body:'DIVA: responda apenas DIVA GATEWAY OK',
      from_me:false
    }
  });
  console.log('DIVA_WHATSAPP_GATEWAY_CANARY_OK',{eventId,answerChars:result.answer.length});
  return{ok:true,eventId,answerChars:result.answer.length};
}

async function forwardRawToDiva(raw,timestamp){
  if(!DIVA_INGRESS_URL||!DIVA_BRIDGE_SECRET)throw new Error('DIVA ingress bridge is not configured');
  const signature=crypto.createHmac('sha256',DIVA_BRIDGE_SECRET).update(raw).digest('hex');
  const upstream=await fetch(DIVA_INGRESS_URL,{
    method:'POST',
    headers:{
      'content-type':'application/json',
      'x-diva-bridge-signature':signature,
      'x-whatsscale-timestamp':String(timestamp||'')
    },
    body:raw
  });
  const responseText=await upstream.text();
  let responseBody={};
  try{responseBody=responseText?JSON.parse(responseText):{}}catch{responseBody={raw:responseText}}
  return {upstream,responseBody};
}

async function runDivaStartupCanary(){
  if(!activeWebhookSecret)throw new Error('active WhatsScale webhook secret unavailable');
  const nowSeconds=Math.floor(Date.now()/1000);
  const eventId='diva_canary_'+nowSeconds;
  const raw=JSON.stringify({
    event_id:eventId,
    event_type:'incoming.message',
    trigger_type:'group',
    session:activeDivaSession,
    data:{
      message_id:eventId+'_msg',
      group_id:'000000000000@g.us',
      participant_id:'000000000000@lid',
      participant_phone:'000000000000',
      participant_name:'DIVA QA Canary',
      body:'DIVA: canary interno',
      from_me:false
    }
  });
  const providerSignature='sha256='+crypto.createHmac('sha256',activeWebhookSecret).update(raw).digest('hex');
  if(!verifyActiveWebhookSignature({raw,supplied:providerSignature,timestamp:nowSeconds,nowSeconds})){
    lastCanaryStatus='failed';
    throw new Error('DIVA startup canary provider signature verification failed');
  }
  const {upstream,responseBody}=await forwardRawToDiva(raw,nowSeconds);
  const wixStatus=responseBody?.status||null;
  if(!upstream.ok||wixStatus!=='ignored_unauthorized_group'){
    lastCanaryStatus='failed';
    throw new Error('DIVA startup canary failed: '+upstream.status+' '+String(wixStatus||responseBody?.error||'unexpected').slice(0,200));
  }
  lastCanaryStatus='passed';
  console.log('DIVA_WHATSAPP_CANARY_OK',{eventId,wixStatus});
  return {ok:true,eventId,wixStatus};
}

async function runDivaAuthorizedCanary(chatId){
  const candidate=String(chatId||'').trim();
  if(!/^\d{10,15}@c\.us$/.test(candidate))throw new Error('authorized canary chatId must be a WhatsApp contact id');
  const number=candidate.slice(0,-5);
  const nowSeconds=Math.floor(Date.now()/1000);
  const eventId='diva_authorized_canary_'+nowSeconds;
  const raw=JSON.stringify({
    event_id:eventId,
    event_type:'incoming.message',
    trigger_type:'1on1',
    session:activeDivaSession,
    data:{
      message_id:eventId+'_msg',
      from_number:number,
      from_id:candidate,
      chat_id:candidate,
      from_name:'DIVA Authorized Canary',
      body:'DIVA, responda apenas: DIVA E2E OK',
      from_me:false
    }
  });
  const {upstream,responseBody}=await forwardRawToDiva(raw,nowSeconds);
  const wixStatus=String(responseBody?.status||responseBody?.error||'unknown').slice(0,120);
  const responseKeys=responseBody&&typeof responseBody==='object'?Object.keys(responseBody).sort():[];
  console.log('DIVA_WHATSAPP_AUTHORIZED_CANARY_RESULT',{
    eventId,
    httpStatus:upstream.status,
    wixStatus,
    responseKeys
  });
  if(!upstream.ok)throw new Error('DIVA authorized canary failed: '+upstream.status+' '+wixStatus);
  return {ok:true,eventId,wixStatus,responseKeys};
}

function normalize(upstream) {
  return {
    ok: true,
    remoteJid: upstream?.key?.remoteJid ?? null,
    messageId: upstream?.key?.id ?? upstream?.id ?? null,
    fromMe: upstream?.key?.fromMe ?? null,
    status: upstream?.status ?? null,
    messageTimestamp: upstream?.messageTimestamp ?? null
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      await refreshProviderDiagnostics();
      return json(res, 200, {
        ok: true,
        service: 'kairos-whatsapp-cloud',
        apiKeyConfigured: Boolean(API_KEY),
        triggerSecretConfigured: Boolean(TRIGGER_SECRET),
        testTokenConfigured: Boolean(TEST_TOKEN),
        sessionConfigured: Boolean(SESSION),
        divaDedicatedSessionConfigured: Boolean(DIVA_WHATSAPP_SESSION),
        divaUsingBaseSession: activeDivaSession===SESSION,
        groupConfigured: Boolean(GROUP_JID),
        divaGroupConfigured: Boolean(DIVA_WHATSAPP_GROUP_JID),
        divaGatewayConfigured: Boolean(DIVA_GATEWAY_URL && DIVA_GATEWAY_INSTALLATION_ID && DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP),
        whatsScaleWebhookSecretConfigured: Boolean(WHATSSCALE_WEBHOOK_SECRET),
        activeWebhookSecretConfigured: Boolean(activeWebhookSecret),
        activeSubscriptionId: activeSubscriptionId || null,
        divaIngressConfigured: Boolean(DIVA_INGRESS_URL),
        divaBridgeSecretConfigured: Boolean(DIVA_BRIDGE_SECRET),
        divaSubscribeTokenConfigured: Boolean(DIVA_SUBSCRIBE_TOKEN),
        divaWhatsappWebhookUrlConfigured: Boolean(DIVA_WHATSAPP_WEBHOOK_URL),
        divaReplyTokenConfigured: Boolean(DIVA_REPLY_TOKEN),
        divaAutoSubscribe: DIVA_AUTO_SUBSCRIBE,
        divaStartupCanary: DIVA_STARTUP_CANARY,
        divaAuthorizedCanaryOnStart: DIVA_AUTHORIZED_CANARY_ON_START,
        divaAuthorizedCanaryTargetConfigured: Boolean(DIVA_AUTHORIZED_CANARY_CHAT_ID),
        canaryStatus:lastCanaryStatus,
        bridgeConfigured: Boolean(activeWebhookSecret && (
          (DIVA_GATEWAY_URL && DIVA_GATEWAY_INSTALLATION_ID && DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP) ||
          (DIVA_INGRESS_URL && DIVA_BRIDGE_SECRET)
        )),
        bridgeStats:{...bridgeStats},
        providerDiagnostics:{...providerDiagnostics}
      });
    }

    if (req.method === 'GET' && url.pathname === '/test') {
      if (!TEST_TOKEN) return json(res, 503, { ok: false, error: 'KAIROS_TEST_TOKEN is not configured' });
      const token = url.searchParams.get('token') || '';
      if (!safeEqual(token, TEST_TOKEN)) return json(res, 401, { ok: false, error: 'unauthorized' });
      if (testSent) return json(res, 409, { ok: false, error: 'test already sent in this instance' });
      const upstream = await sendWhatsApp(TEST_TEXT);
      testSent = true;
      return json(res, 200, { ...normalize(upstream), test: true, countedAsEdition: false });
    }

    if (req.method === 'POST' && url.pathname === '/admin/subscribe-diva') {
      if (!DIVA_SUBSCRIBE_TOKEN) return json(res, 503, { ok: false, error: 'DIVA_SUBSCRIBE_TOKEN is not configured' });
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!safeEqual(token, DIVA_SUBSCRIBE_TOKEN)) return json(res, 401, { ok: false, error: 'unauthorized' });
      const subscription = await ensureDivaSubscription();
      return json(res, 200, { ok: true, ...subscription });
    }

    if (req.method === 'POST' && url.pathname === '/admin/canary-authorized') {
      if (!DIVA_REPLY_TOKEN) return json(res, 503, { ok: false, error: 'DIVA_REPLY_TOKEN is not configured' });
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!safeEqual(token, DIVA_REPLY_TOKEN)) return json(res, 401, { ok: false, error: 'unauthorized' });
      const body = await readBody(req);
      const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
      if (!/^\d{10,15}@c\.us$/.test(chatId)) return json(res, 400, { ok: false, error: 'valid WhatsApp contact chatId is required' });
      const result = await runDivaAuthorizedCanary(chatId);
      return json(res, 200, result);
    }

    if (req.method === 'POST' && url.pathname === '/diva/reply') {
      if (!DIVA_REPLY_TOKEN) return json(res, 503, { ok: false, error: 'DIVA_REPLY_TOKEN is not configured' });
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!safeEqual(token, DIVA_REPLY_TOKEN)) return json(res, 401, { ok: false, error: 'unauthorized' });
      const body = await readBody(req);
      const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!chatId || !text) return json(res, 400, { ok: false, error: 'chatId and text are required' });
      bridgeStats.replyRelayRequests += 1;
      const upstream = await sendWhatsAppToChat(chatId, text, activeDivaSession);
      bridgeStats.outboundSent += 1;
      bridgeStats.lastReplyAt = new Date().toISOString();
      console.log('DIVA_WHATSAPP_REPLY_SENT',{
        replyRelayRequests:bridgeStats.replyRelayRequests,
        outboundSent:bridgeStats.outboundSent
      });
      return json(res, 200, normalize(upstream));
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/whatsscale') {
      const directGatewayReady=Boolean(DIVA_GATEWAY_URL&&DIVA_GATEWAY_INSTALLATION_ID&&DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP);
      const legacyIngressReady=Boolean(DIVA_INGRESS_URL&&DIVA_BRIDGE_SECRET);
      if (!activeWebhookSecret || (!directGatewayReady&&!legacyIngressReady)) {
        return json(res, 503, { ok: false, error: 'bridge is not configured' });
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      const supplied=String(req.headers['x-whatsscale-signature']||'');
      const webhookTimestamp=Number(req.headers['x-whatsscale-timestamp']||0);
      if(!verifyActiveWebhookSignature({raw,supplied,timestamp:webhookTimestamp})){
        return json(res,401,{ok:false,error:'invalid or stale webhook signature'});
      }

      const body = raw ? JSON.parse(raw) : {};
      if (body?.trigger_type !== 'group') return json(res, 202, { ok: true, accepted: false, reason: 'non_group' });
      if (String(body?.data?.group_id||'') !== DIVA_WHATSAPP_GROUP_JID) return json(res, 202, { ok: true, accepted: false, reason: 'unauthorized_group' });
      if (body?.event_type && body.event_type !== 'incoming.message') return json(res, 202, { ok: true, accepted: false, reason: 'event_type' });
      if (body?.data?.from_me === true || body?.data?.fromMe === true) return json(res, 202, { ok: true, accepted: false, reason: 'from_me' });

      const eventId=String(body?.event_id||'').slice(0,128)||null;
      bridgeStats.providerWebhooksAccepted += 1;
      bridgeStats.lastProviderEventAt = new Date().toISOString();
      console.log('DIVA_WHATSAPP_INGRESS_ACCEPTED',{
        eventId,
        providerWebhooksAccepted:bridgeStats.providerWebhooksAccepted
      });
      if(!extractDivaPrompt(body?.data?.body||'')){
        return json(res,202,{ok:true,accepted:false,reason:'without_diva_wake_word'});
      }

      bridgeStats.divaForwardAttempts += 1;
      if(directGatewayReady){
        try{
          const gateway=await invokeDivaGatewayDirect(body);
          await sendWhatsAppToChat(DIVA_WHATSAPP_GROUP_JID,gateway.answer,activeDivaSession);
          bridgeStats.divaForwardSuccess += 1;
          bridgeStats.lastReplyAt=new Date().toISOString();
          return json(res,200,{ok:true,status:'replied',runtime:'diva_universal_private_gateway',event_id:eventId});
        }catch(error){
          console.error('DIVA_WHATSAPP_DIRECT_GATEWAY_FAILED',{eventId,message:String(error?.message||error).slice(0,300)});
          return json(res,502,{ok:false,error:'diva_gateway_failed'});
        }
      }

      const {upstream,responseBody}=await forwardRawToDiva(raw,webhookTimestamp);
      if(upstream.ok)bridgeStats.divaForwardSuccess += 1;
      bridgeStats.lastWixStatus=String(responseBody?.status||responseBody?.error||'unknown').slice(0,120);
      console.log('DIVA_WHATSAPP_WIX_RESULT',{
        eventId,
        httpStatus:upstream.status,
        wixStatus:bridgeStats.lastWixStatus,
        divaForwardAttempts:bridgeStats.divaForwardAttempts,
        divaForwardSuccess:bridgeStats.divaForwardSuccess
      });
      return json(res,upstream.ok?200:502,{ok:upstream.ok,diva:responseBody});
    }

    if (req.method === 'POST' && url.pathname === '/send') {
      if (!TRIGGER_SECRET) return json(res, 503, { ok: false, error: 'KAIROS_TRIGGER_SECRET is not configured' });
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!safeEqual(token, TRIGGER_SECRET)) return json(res, 401, { ok: false, error: 'unauthorized' });

      const body = await readBody(req);
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!text) return json(res, 400, { ok: false, error: 'text is required' });
      if (text.length > 4096) return json(res, 400, { ok: false, error: 'text exceeds WhatsScale 4096 character limit' });

      const upstream = await sendWhatsApp(text);
      return json(res, 200, normalize(upstream));
    }

    return json(res, 404, { ok: false, error: 'not found' });
  } catch (error) {
    console.error('request_failed', {
      message: error?.message,
      details: error?.details
    });
    return json(res, 502, { ok: false, error: error?.message || 'upstream error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`kairos-whatsapp-cloud listening on ${PORT}`);
  if(DIVA_AUTO_SUBSCRIBE){
    ensureDivaSubscription()
      .then(async info=>{
        console.log('DIVA_WHATSCALE_SUBSCRIPTION_READY',{subscriptionId:info.subscription_id,triggerType:info.trigger_type,webhookUrl:info.webhook_url});
        if(DIVA_STARTUP_CANARY){
          try{
            if(DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP)await runDivaGatewayCanary();
            else await runDivaStartupCanary();
          }catch(error){console.error('DIVA_WHATSAPP_CANARY_FAILED',{message:String(error?.message||error).slice(0,500)})}
        }
        if(DIVA_AUTHORIZED_CANARY_ON_START){
          if(!DIVA_AUTHORIZED_CANARY_CHAT_ID){
            console.error('DIVA_WHATSAPP_AUTHORIZED_CANARY_FAILED',{message:'authorized canary target not configured'});
          }else{
            try{await runDivaAuthorizedCanary(DIVA_AUTHORIZED_CANARY_CHAT_ID)}
            catch(error){console.error('DIVA_WHATSAPP_AUTHORIZED_CANARY_FAILED',{message:String(error?.message||error).slice(0,500)})}
          }
        }
      })
      .catch(error=>console.error('DIVA_WHATSCALE_SUBSCRIPTION_FAILED',{message:String(error?.message||error).slice(0,500)}));
  }
  console.log('DIVA_BRIDGE_READINESS', {
    whatsScaleWebhookSecretConfigured:Boolean(WHATSSCALE_WEBHOOK_SECRET),
    divaIngressConfigured:Boolean(DIVA_INGRESS_URL),
    divaBridgeSecretConfigured:Boolean(DIVA_BRIDGE_SECRET),
    divaSubscribeTokenConfigured:Boolean(DIVA_SUBSCRIBE_TOKEN),
    divaWhatsappWebhookUrlConfigured:Boolean(DIVA_WHATSAPP_WEBHOOK_URL),
    divaReplyTokenConfigured:Boolean(DIVA_REPLY_TOKEN),
    divaAutoSubscribe:DIVA_AUTO_SUBSCRIBE,
    divaAuthorizedCanaryOnStart:DIVA_AUTHORIZED_CANARY_ON_START,
    divaAuthorizedCanaryTargetConfigured:Boolean(DIVA_AUTHORIZED_CANARY_CHAT_ID),
    divaGroupConfigured:Boolean(DIVA_WHATSAPP_GROUP_JID),
    divaGatewayConfigured:Boolean(DIVA_GATEWAY_URL&&DIVA_GATEWAY_INSTALLATION_ID&&DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP),
    activeWebhookSecretConfigured:Boolean(activeWebhookSecret),
    activeSubscriptionId:activeSubscriptionId||null,
    bridgeConfigured:Boolean(activeWebhookSecret && (
      (DIVA_GATEWAY_URL&&DIVA_GATEWAY_INSTALLATION_ID&&DIVA_GATEWAY_SECRET_FERNANDO_WHATSAPP) ||
      (DIVA_INGRESS_URL&&DIVA_BRIDGE_SECRET)
    ))
  });
});
