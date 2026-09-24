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
const BASE_URL = 'https://proxy.whatsscale.com';
const TEST_TEXT = '🧪 TESTE TÉCNICO KAIROS — rota cloud WhatsApp em validação. Não é uma edição KAIROS.';
let testSent = false;
let activeWebhookSecret = WHATSSCALE_WEBHOOK_SECRET || '';
let activeSubscriptionId = null;
let subscriptionPromise = null;
let lastCanaryStatus = 'not_run';

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

async function sendWhatsAppToChat(chatId, text) {
  const recipient = String(chatId || '').trim();
  const message = String(text || '').trim();
  if (!recipient) throw new Error('chatId is required');
  if (!message) throw new Error('text is required');
  if (message.length > 4096) throw new Error('text exceeds WhatsScale 4096 character limit');
  const { response, data } = await whatsScaleJson('/api/sendText', {
    method: 'POST',
    body: JSON.stringify({ session: SESSION, chatId: recipient, text: message })
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
  const payload = {
    session: SESSION,
    webhook_url: DIVA_WHATSAPP_WEBHOOK_URL,
    trigger_type: '1on1'
  };
  let attempt = await whatsScaleJson('/v1/webhooks/subscribe', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (attempt.response.status === 409) {
    const subscriptionId = attempt.data?.subscription_id;
    if (!subscriptionId) throw new Error('WhatsScale duplicate webhook without subscription_id');
    const removed = await whatsScaleJson('/v1/webhooks/' + encodeURIComponent(subscriptionId), {
      method: 'DELETE'
    });
    if (!removed.response.ok) throw new Error('WhatsScale duplicate webhook could not be rotated');
    attempt = await whatsScaleJson('/v1/webhooks/subscribe', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
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
    trigger_type: attempt.data?.trigger_type || '1on1'
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
    trigger_type:'1on1',
    session:SESSION,
    data:{
      message_id:eventId+'_msg',
      from_number:'000000000000',
      from_id:'000000000000@c.us',
      chat_id:'000000000000',
      from_name:'DIVA QA Canary',
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
  if(!upstream.ok||wixStatus!=='ignored_unauthorized_sender'){
    lastCanaryStatus='failed';
    throw new Error('DIVA startup canary failed: '+upstream.status+' '+String(wixStatus||responseBody?.error||'unexpected').slice(0,200));
  }
  lastCanaryStatus='passed';
  console.log('DIVA_WHATSAPP_CANARY_OK',{eventId,wixStatus});
  return {ok:true,eventId,wixStatus};
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
      return json(res, 200, {
        ok: true,
        service: 'kairos-whatsapp-cloud',
        apiKeyConfigured: Boolean(API_KEY),
        triggerSecretConfigured: Boolean(TRIGGER_SECRET),
        testTokenConfigured: Boolean(TEST_TOKEN),
        sessionConfigured: Boolean(SESSION),
        groupConfigured: Boolean(GROUP_JID),
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
        canaryStatus:lastCanaryStatus,
        bridgeConfigured: Boolean(activeWebhookSecret && DIVA_INGRESS_URL && DIVA_BRIDGE_SECRET)
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

    if (req.method === 'POST' && url.pathname === '/diva/reply') {
      if (!DIVA_REPLY_TOKEN) return json(res, 503, { ok: false, error: 'DIVA_REPLY_TOKEN is not configured' });
      const auth = req.headers.authorization || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
      if (!safeEqual(token, DIVA_REPLY_TOKEN)) return json(res, 401, { ok: false, error: 'unauthorized' });
      const body = await readBody(req);
      const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : '';
      const text = typeof body.text === 'string' ? body.text.trim() : '';
      if (!chatId || !text) return json(res, 400, { ok: false, error: 'chatId and text are required' });
      const upstream = await sendWhatsAppToChat(chatId, text);
      return json(res, 200, normalize(upstream));
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/whatsscale') {
      if (!activeWebhookSecret || !DIVA_INGRESS_URL || !DIVA_BRIDGE_SECRET) {
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
      if (body?.trigger_type !== '1on1') return json(res, 202, { ok: true, accepted: false, reason: 'non_1on1' });
      if (body?.event_type && body.event_type !== 'incoming.message') return json(res, 202, { ok: true, accepted: false, reason: 'event_type' });
      if (body?.data?.from_me === true || body?.data?.fromMe === true) return json(res, 202, { ok: true, accepted: false, reason: 'from_me' });

      const {upstream,responseBody}=await forwardRawToDiva(raw,webhookTimestamp);
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
          try{await runDivaStartupCanary()}
          catch(error){console.error('DIVA_WHATSAPP_CANARY_FAILED',{message:String(error?.message||error).slice(0,500)})}
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
    activeWebhookSecretConfigured:Boolean(activeWebhookSecret),
    activeSubscriptionId:activeSubscriptionId||null,
    bridgeConfigured:Boolean(activeWebhookSecret && DIVA_INGRESS_URL && DIVA_BRIDGE_SECRET)
  });
});
