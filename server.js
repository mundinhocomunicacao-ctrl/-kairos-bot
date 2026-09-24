import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 10000);
const API_KEY = process.env.WHATSSCALE_API_KEY;
const SESSION = process.env.WHATSSCALE_SESSION || '';
const GROUP_JID = process.env.WHATSSCALE_GROUP_JID || '';
const TRIGGER_SECRET = process.env.KAIROS_TRIGGER_SECRET;
const TEST_TOKEN = process.env.KAIROS_TEST_TOKEN;
const BASE_URL = 'https://proxy.whatsscale.com';
const TEST_TEXT = '🧪 TESTE TÉCNICO KAIROS — rota cloud WhatsApp em validação. Não é uma edição KAIROS.';

const DIVA_1ON1_RELAY_ENABLED = String(process.env.DIVA_1ON1_RELAY_ENABLED || '').toLowerCase() === 'true';
const DIVA_RELAY_URL = String(process.env.DIVA_RELAY_URL || '').trim();
const DIVA_RELAY_SECRET = String(process.env.DIVA_RELAY_SECRET || '').trim();
const DIVA_WHATSAPP_ALLOWED_NUMBERS = String(process.env.DIVA_WHATSAPP_ALLOWED_NUMBERS || '').trim();

let testSent = false;
let divaWebhookSigningSecret = null;
let divaWebhookSubscriptionId = null;
let divaSubscriptionStatus = DIVA_1ON1_RELAY_ENABLED ? 'starting' : 'disabled';
let divaSubscriptionError = null;
const dedupe = new Map();
const DEDUPE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function safeEqual(a = '', b = '') {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && left.length > 0 && crypto.timingSafeEqual(left, right);
}

function clean(value, max = 12000) {
  return String(value ?? '').trim().slice(0, max);
}

function digits(value) {
  return clean(value, 256).replace(/\D/g, '');
}

function allowedSender(value) {
  const sender = digits(value);
  const allowed = new Set(DIVA_WHATSAPP_ALLOWED_NUMBERS.split(',').map(digits).filter(Boolean));
  return Boolean(sender && allowed.size && allowed.has(sender));
}

function extractDivaPrompt(value) {
  const text = clean(value, 12000);
  const match = text.match(/^\s*(?:@?diva)\b\s*[:,\-]?\s*(.*)$/isu);
  if (!match) return null;
  return clean(match[1] || '', 12000) || 'Oi, DIVA.';
}

function contactChatId(value) {
  const raw = clean(value, 256);
  if (!raw) return null;
  if (/@c\.us$/i.test(raw)) return raw;
  const phone = digits(raw);
  return phone ? phone + '@c.us' : null;
}

function cleanupDedupe(now = Date.now()) {
  for (const [key, expiresAt] of dedupe) if (expiresAt <= now) dedupe.delete(key);
}

function seen(key) {
  if (!key) return false;
  cleanupDedupe();
  return Boolean(dedupe.get(key) > Date.now());
}

function remember(key) {
  if (!key) return;
  dedupe.set(key, Date.now() + DEDUPE_TTL_MS);
  cleanupDedupe();
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function readRawBody(req, maxBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > maxBytes) throw new Error('payload_too_large');
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

async function whatsScaleRequest(path, init = {}) {
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
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  return { response, data };
}

async function sendWhatsApp(text, chatId = GROUP_JID) {
  const message = clean(text, 4096);
  const recipient = clean(chatId, 256);
  if (!message) throw new Error('text is required');
  if (!recipient) throw new Error('chatId is required');
  const { response, data } = await whatsScaleRequest('/api/sendText', {
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

function publicBaseUrl() {
  return clean(process.env.RENDER_EXTERNAL_URL, 1000).replace(/\/$/, '');
}

function divaWebhookUrl() {
  const base = publicBaseUrl();
  return base ? base + '/webhooks/diva-1on1' : null;
}

function relayConfigured() {
  return Boolean(
    API_KEY &&
    SESSION &&
    DIVA_RELAY_URL &&
    DIVA_RELAY_SECRET &&
    DIVA_WHATSAPP_ALLOWED_NUMBERS &&
    divaWebhookUrl()
  );
}

async function ensureDivaOneToOneSubscription() {
  if (!DIVA_1ON1_RELAY_ENABLED) {
    divaSubscriptionStatus = 'disabled';
    return;
  }
  if (!relayConfigured()) {
    divaSubscriptionStatus = 'configuration_error';
    divaSubscriptionError = 'missing_required_relay_configuration';
    return;
  }

  divaSubscriptionStatus = 'subscribing';
  divaSubscriptionError = null;
  const webhookUrl = divaWebhookUrl();

  try {
    const listed = await whatsScaleRequest('/v1/webhooks', { method: 'GET' });
    if (!listed.response.ok) throw new Error('list_webhooks_http_' + listed.response.status);
    const subscriptions = Array.isArray(listed.data?.subscriptions) ? listed.data.subscriptions : [];
    const existing = subscriptions.filter(row =>
      row?.session === SESSION &&
      row?.trigger_type === '1on1' &&
      row?.webhook_url === webhookUrl
    );

    for (const row of existing) {
      const id = clean(row?.id || row?.subscription_id, 256);
      if (!id) continue;
      const removed = await whatsScaleRequest('/v1/webhooks/' + encodeURIComponent(id), { method: 'DELETE' });
      if (!removed.response.ok && removed.response.status !== 404) {
        throw new Error('delete_webhook_http_' + removed.response.status);
      }
    }

    const subscribed = await whatsScaleRequest('/v1/webhooks/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        session: SESSION,
        webhook_url: webhookUrl,
        trigger_type: '1on1'
      })
    });
    if (!subscribed.response.ok) throw new Error('subscribe_webhook_http_' + subscribed.response.status);

    const signingSecret = clean(subscribed.data?.signing_secret, 10000);
    const subscriptionId = clean(subscribed.data?.subscription_id || subscribed.data?.id, 256);
    if (!signingSecret || !subscriptionId) throw new Error('subscribe_webhook_missing_secret_or_id');

    divaWebhookSigningSecret = signingSecret;
    divaWebhookSubscriptionId = subscriptionId;
    divaSubscriptionStatus = 'ready';
    divaSubscriptionError = null;
    console.log('DIVA_1ON1_SUBSCRIPTION_READY', { subscriptionId });
  } catch (error) {
    divaWebhookSigningSecret = null;
    divaWebhookSubscriptionId = null;
    divaSubscriptionStatus = 'error';
    divaSubscriptionError = clean(error?.message || error, 240);
    console.error('DIVA_1ON1_SUBSCRIPTION_ERROR', { error: divaSubscriptionError });
  }
}

function verifyWhatsScaleDelivery(raw, signature, timestamp) {
  if (!divaWebhookSigningSecret) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > 300) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', divaWebhookSigningSecret).update(raw).digest('hex');
  return safeEqual(signature, expected);
}

async function callDivaRelay(payload) {
  if (!DIVA_RELAY_URL || !DIVA_RELAY_SECRET) throw new Error('DIVA relay is not configured');
  const raw = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = 'sha256=' + crypto.createHmac('sha256', DIVA_RELAY_SECRET)
    .update(timestamp + '\n')
    .update(raw)
    .digest('hex');

  const response = await fetch(DIVA_RELAY_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-diva-whatsapp-relay-signature': signature,
      'x-diva-whatsapp-relay-timestamp': timestamp
    },
    body: raw
  });
  const responseText = await response.text();
  let responseBody = {};
  try { responseBody = responseText ? JSON.parse(responseText) : {}; } catch { responseBody = { raw: responseText }; }
  if (!response.ok || responseBody?.ok !== true) {
    const err = new Error('diva_relay_http_' + response.status);
    err.details = responseBody;
    throw err;
  }
  return responseBody;
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
        divaOneToOneRelayEnabled: DIVA_1ON1_RELAY_ENABLED,
        divaRelayConfigured: relayConfigured(),
        divaOneToOneSubscriptionStatus: divaSubscriptionStatus,
        divaOneToOneSubscriptionReady: Boolean(
          divaWebhookSigningSecret &&
          divaWebhookSubscriptionId &&
          divaSubscriptionStatus === 'ready'
        ),
        divaSubscriptionError
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

    if (req.method === 'POST' && url.pathname === '/webhooks/diva-1on1') {
      if (!DIVA_1ON1_RELAY_ENABLED) return json(res, 404, { ok: false, error: 'relay_disabled' });
      if (divaSubscriptionStatus !== 'ready' || !divaWebhookSigningSecret) {
        return json(res, 503, { ok: false, error: 'subscription_not_ready' });
      }

      const raw = await readRawBody(req);
      if (!verifyWhatsScaleDelivery(
        raw,
        String(req.headers['x-whatsscale-signature'] || ''),
        req.headers['x-whatsscale-timestamp']
      )) {
        return json(res, 401, { ok: false, error: 'invalid_whatsscale_signature' });
      }

      let envelope = {};
      try { envelope = raw.length ? JSON.parse(raw.toString('utf8')) : {}; } catch {
        return json(res, 400, { ok: false, error: 'invalid_json' });
      }
      if (envelope?.event_type !== 'incoming.message' || envelope?.trigger_type !== '1on1') {
        return json(res, 202, { ok: true, accepted: false, reason: 'unsupported_event' });
      }

      const data = envelope?.data && typeof envelope.data === 'object' ? envelope.data : {};
      if (data?.from_me === true || data?.fromMe === true) {
        return json(res, 202, { ok: true, accepted: false, reason: 'from_me' });
      }

      const fromNumber = digits(data.from_number || data.chat_id);
      if (!allowedSender(fromNumber)) {
        return json(res, 202, { ok: true, accepted: false, reason: 'sender_not_allowed' });
      }

      const prompt = extractDivaPrompt(data.body);
      if (!prompt) {
        return json(res, 202, { ok: true, accepted: false, reason: 'diva_wake_word_missing' });
      }

      const replyChatId = contactChatId(data.from_number || data.chat_id);
      if (!replyChatId || digits(replyChatId) !== fromNumber) {
        return json(res, 202, { ok: true, accepted: false, reason: 'origin_chat_invalid' });
      }

      const eventId = clean(envelope.event_id, 256) || null;
      const messageId = clean(data.message_id, 256) || null;
      const dedupeKey = eventId || messageId;
      if (seen(dedupeKey)) {
        return json(res, 200, { ok: true, accepted: true, dispatched: false, reason: 'duplicate' });
      }

      const relay = await callDivaRelay({
        eventId,
        messageId,
        text: clean(data.body, 12000),
        fromNumber,
        fromName: clean(data.from_name, 256) || null,
        chatId: replyChatId
      });

      const reply = relay?.reply;
      if (!reply || reply.replyOnlyToOrigin !== true || reply.recipient !== replyChatId) {
        return json(res, 502, { ok: false, error: 'diva_reply_origin_contract_failed' });
      }
      if (typeof reply.text !== 'string' || !reply.text.trim() || reply.text.length > 4096) {
        return json(res, 502, { ok: false, error: 'diva_reply_text_invalid' });
      }

      const sent = await sendWhatsApp(reply.text, reply.recipient);
      remember(dedupeKey);
      return json(res, 200, {
        ok: true,
        accepted: true,
        dispatched: true,
        messageId: sent?.key?.id ?? null,
        eventId
      });
    }

    if (req.method === 'POST' && url.pathname === '/webhooks/whatsscale') {
      return json(res, 410, { ok: false, error: 'legacy_diva_bridge_retired_use_diva_1on1' });
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
      message: clean(error?.message || error, 500),
      details: error?.details ? '[redacted]' : undefined
    });
    return json(res, 502, { ok: false, error: clean(error?.message || 'upstream error', 240) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`kairos-whatsapp-cloud listening on ${PORT}`);
  console.log('DIVA_1ON1_RELAY_READINESS', {
    enabled: DIVA_1ON1_RELAY_ENABLED,
    configured: relayConfigured(),
    subscriptionStatus: divaSubscriptionStatus
  });
  void ensureDivaOneToOneSubscription();
});
