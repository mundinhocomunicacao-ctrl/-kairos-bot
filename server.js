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
const BASE_URL = 'https://proxy.whatsscale.com';
const TEST_TEXT = '🧪 TESTE TÉCNICO KAIROS — rota cloud WhatsApp em validação. Não é uma edição KAIROS.';
let testSent = false;

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
  return {
    subscription_id: subscriptionId,
    signing_secret: signingSecret,
    webhook_url: attempt.data?.webhook_url || DIVA_WHATSAPP_WEBHOOK_URL,
    trigger_type: attempt.data?.trigger_type || '1on1'
  };
}

function normalize(upstream) {
  return {
    ok: true,
    remoteJid: upstream?.key?.remoteJid ?? null,
    messageId: upstream?.key?.id ?? null,
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
        divaIngressConfigured: Boolean(DIVA_INGRESS_URL),
        divaBridgeSecretConfigured: Boolean(DIVA_BRIDGE_SECRET),
        divaSubscribeTokenConfigured: Boolean(DIVA_SUBSCRIBE_TOKEN),
        divaWhatsappWebhookUrlConfigured: Boolean(DIVA_WHATSAPP_WEBHOOK_URL),
        divaReplyTokenConfigured: Boolean(DIVA_REPLY_TOKEN),
        bridgeConfigured: Boolean(WHATSSCALE_WEBHOOK_SECRET && DIVA_INGRESS_URL && DIVA_BRIDGE_SECRET)
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
      const subscription = await subscribeDivaWebhook();
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
      if (!WHATSSCALE_WEBHOOK_SECRET || !DIVA_INGRESS_URL || !DIVA_BRIDGE_SECRET) {
        return json(res, 503, { ok: false, error: 'bridge is not configured' });
      }
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const raw = Buffer.concat(chunks).toString('utf8');
      const supplied = String(req.headers['x-whatsscale-signature'] || '');
      const webhookTimestamp = Number(req.headers['x-whatsscale-timestamp'] || 0);
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (!Number.isFinite(webhookTimestamp) || Math.abs(nowSeconds - webhookTimestamp) > 300) {
        return json(res, 401, { ok: false, error: 'stale webhook timestamp' });
      }
      const expected = 'sha256=' + crypto.createHmac('sha256', WHATSSCALE_WEBHOOK_SECRET).update(raw).digest('hex');
      if (!safeEqual(supplied, expected)) return json(res, 401, { ok: false, error: 'invalid webhook signature' });

      const body = raw ? JSON.parse(raw) : {};
      const remoteJid = body?.data?.key?.remoteJid ?? body?.key?.remoteJid ?? null;
      const fromMe = body?.data?.key?.fromMe ?? body?.key?.fromMe ?? false;
      if (remoteJid !== GROUP_JID) return json(res, 202, { ok: true, accepted: false, reason: 'group_not_allowed' });
      if (fromMe) return json(res, 202, { ok: true, accepted: false, reason: 'from_me' });

      const canonical = JSON.stringify({
        event: 'messages.upsert',
        instance: SESSION,
        data: body.data ?? body
      });
      const signature = crypto.createHmac('sha256', DIVA_BRIDGE_SECRET).update(canonical).digest('hex');
      const upstream = await fetch(DIVA_INGRESS_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-diva-signature': signature },
        body: canonical
      });
      const responseText = await upstream.text();
      let responseBody;
      try { responseBody = JSON.parse(responseText); } catch { responseBody = { raw: responseText }; }
      return json(res, upstream.ok ? 200 : 502, { ok: upstream.ok, diva: responseBody });
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
  console.log('DIVA_BRIDGE_READINESS', {
    whatsScaleWebhookSecretConfigured:Boolean(WHATSSCALE_WEBHOOK_SECRET),
    divaIngressConfigured:Boolean(DIVA_INGRESS_URL),
    divaBridgeSecretConfigured:Boolean(DIVA_BRIDGE_SECRET),
    divaSubscribeTokenConfigured:Boolean(DIVA_SUBSCRIBE_TOKEN),
    divaWhatsappWebhookUrlConfigured:Boolean(DIVA_WHATSAPP_WEBHOOK_URL),
    divaReplyTokenConfigured:Boolean(DIVA_REPLY_TOKEN),
    bridgeConfigured:Boolean(WHATSSCALE_WEBHOOK_SECRET && DIVA_INGRESS_URL && DIVA_BRIDGE_SECRET)
  });
});
