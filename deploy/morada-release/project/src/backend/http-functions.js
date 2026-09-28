/**
 * DIVA · MORADA HTTP INGRESS V2 · UMA CHAVE POR IA
 * backend/http-functions.js
 *
 *   GET  /_functions/divaHealth   → saúde da porta (público, não lê nem grava)
 *   POST /_functions/divaPulse    → header x-diva-key obrigatório
 *
 * Chaves (Secrets Manager; o valor nunca aparece em código, resposta ou log):
 *   DIVA_KEY_GPT     → quem usar grava como origem AI_GPT
 *   DIVA_KEY_GEMINI  → quem usar grava como origem AI_GEMINI
 *   DIVA_BRIDGE_KEY  → integrações gerais (Pipedream etc.) → EXTERNAL
 * A origem vem da CHAVE, não do corpo: ninguém se passa por outra IA.
 * O "source" que vier no corpo fica guardado como claimedSource.
 *
 * Sem nenhum segredo criado: 503 (porta fechada). Chave errada: 403.
 */

import { ok, badRequest, forbidden, serverError, response } from 'wix-http-functions';
import { getSecret } from 'wix-secrets-backend';
import wixData from 'wix-data';
import { receiveDivaPulse } from './divaPulse';
import { runDivaBrainTransport, verifyBrainSessionToken } from './divaBridge.web';

const KEYS = [
    { secret: 'DIVA_KEY_GPT', origin: 'AI_GPT' },
    { secret: 'DIVA_KEY_GEMINI', origin: 'AI_GEMINI' },
    { secret: 'DIVA_BRIDGE_KEY', origin: 'EXTERNAL' }
];

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function sameKey(a, b) {
    const x = String(a || '');
    const y = String(b || '');
    let diff = x.length ^ y.length;
    const len = Math.max(x.length, y.length);
    for (let i = 0; i < len; i++) {
        diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
    }
    return diff === 0 && x.length > 0;
}

async function loadKeys() {
    const loaded = [];
    for (const k of KEYS) {
        try {
            const value = await getSecret(k.secret);
            if (value) loaded.push({ origin: k.origin, value });
        } catch (error) {
            // segredo não existe: ignora
        }
    }
    return loaded;
}

export function get_divaHealth(request) {
    return ok({
        headers: JSON_HEADERS,
        body: {
            ok: true,
            service: 'DIVA_MORADA_HTTP_INGRESS',
            version: 'V2',
            time: new Date().toISOString()
        }
    });
}

export async function post_divaPulse(request) {

    const keys = await loadKeys();

    if (!keys.length) {
        return response({
            status: 503,
            headers: JSON_HEADERS,
            body: { ok: false, status: 'INGRESS_NOT_CONFIGURED' }
        });
    }

    const provided = request.headers['x-diva-key'];
    const match = keys.find(k => sameKey(provided, k.value));

    if (!match) {
        return forbidden({
            headers: JSON_HEADERS,
            body: { ok: false, status: 'DIVA_FORBIDDEN' }
        });
    }

    let body;
    try {
        body = await request.body.json();
    } catch (error) {
        return badRequest({ headers: JSON_HEADERS, body: { ok: false, status: 'INVALID_JSON' } });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return badRequest({ headers: JSON_HEADERS, body: { ok: false, status: 'INVALID_PULSE' } });
    }

    try {
        const receipt = await receiveDivaPulse({
            ...body,
            source: match.origin,
            channel: 'HTTP',
            data: {
                ...(body.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : {}),
                claimedSource: body.source || null
            }
        });

        const publicReceipt = {
            ok: receipt?.ok === true,
            status: receipt?.status || 'UNKNOWN',
            origin: match.origin,
            pulseId: receipt?.pulseId || null,
            memoryRecordId: receipt?.memoryRecordId || null
        };

        return publicReceipt.ok
            ? ok({ headers: JSON_HEADERS, body: publicReceipt })
            : serverError({ headers: JSON_HEADERS, body: publicReceipt });

    } catch (error) {
        console.error('[DIVA_HTTP_INGRESS_ERROR]', error?.message);
        return serverError({ headers: JSON_HEADERS, body: { ok: false, status: 'DIVA_INGRESS_ERROR' } });
    }
}


/**
 * POST /_functions/divaAsk
 * Ponte cognitiva same-origin da Morada.
 * Exige capability curta emitida por createBrainSession() após owner-check.
 * A conversa não é persistida; somente um receipt operacional da resposta.
 */
export async function post_divaAsk(request) {
    const authHeader = String(request.headers?.authorization || '');
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    const verified = await verifyBrainSessionToken(token);
    if (!verified?.ok) {
        return response({
            status: 401,
            headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
            body: { ok: false, status: verified?.status || 'DIVA_BRAIN_SESSION_INVALID' }
        });
    }

    let body;
    try {
        body = await request.body.json();
    } catch (error) {
        return badRequest({
            headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
            body: { ok: false, status: 'INVALID_JSON' }
        });
    }

    const text = String(body?.text || '').slice(0, 4000).trim();
    const history = Array.isArray(body?.history) ? body.history.slice(-10) : [];
    const requestId = String(body?.id || '').slice(0, 120);

    if (!text) {
        return badRequest({
            headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
            body: { ok: false, status: 'EMPTY' }
        });
    }

    let result;
    try {
        result = await runDivaBrainTransport({ text, history }, 'MORADA_OWNER');
    } catch (error) {
        console.error('[DIVA_HTTP_BRAIN_ERROR]', error?.message);
        return serverError({
            headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
            body: { ok: false, status: 'BRAIN_CALL_FAILED' }
        });
    }

    let receipt = null;
    if (result?.ok === true) {
        try {
            const requestTag = /^DIVA_CANARY_[A-Z0-9_-]+$/i.test(text) ? text : null;
            const pulseReceipt = await receiveDivaPulse({
                source: 'DIVA_MORADA_BRAIN',
                channel: 'HTTP_INTERNAL',
                type: 'SYSTEM_EVENT',
                intent: 'MEMORY_WRITE',
                message: 'DIVA_REPLY_RECEIPT',
                surface: '/cópia-sobre-mim',
                identityKey: 'MORADA_OWNER',
                data: {
                    requestId: requestId || null,
                    requestTag,
                    provider: result.provider || null,
                    model: result.model || null,
                    messageId: result.messageId || null,
                    brainStatus: result.status || null,
                    transport: 'HTTP_CAPABILITY_V1'
                }
            });

            receipt = {
                ok: pulseReceipt?.ok === true,
                status: pulseReceipt?.status || null,
                pulseId: pulseReceipt?.pulseId || null,
                memoryRecordId: pulseReceipt?.memoryRecordId || null
            };
        } catch (error) {
            console.error('[DIVA_HTTP_BRAIN_RECEIPT_ERROR]', error?.message);
            receipt = { ok: false, status: 'RECEIPT_FAILED' };
        }
    }

    return ok({
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
        body: {
            ok: result?.ok === true,
            status: result?.status || 'UNKNOWN',
            text: result?.ok ? result.text : null,
            provider: result?.provider || null,
            model: result?.model || null,
            messageId: result?.messageId || null,
            receipt
        }
    });
}


/**
 * GET /_functions/divaCanary
 * Canário técnico efêmero. Remover após a primeira prova cognitiva.
 */
export async function get_divaCanary(request) {
    const CANARY_KEY = 'DIVA_CANARY_20260927';

    // One-shot: after the first verified cognitive receipt exists, this endpoint is inert.
    try {
        const previous = await wixData
            .query('DIVA_MEMORY_WRITEBACK_V1')
            .contains('rawInput', CANARY_KEY)
            .limit(1)
            .find({ suppressAuth: true });

        if ((previous?.items || []).length > 0) {
            return response({
                status: 410,
                headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
                body: { ok: false, status: 'CANARY_CONSUMED' }
            });
        }
    } catch (error) {
        console.warn('[DIVA_CANARY_PRECHECK]', error?.message);
    }

    const provided = String(request?.query?.nonce || '');
    if (provided !== 'm0aWKB9L8B-lHKj3gNZJMRU5Bh_C_TGaKvZc94WTh6E') {
        return forbidden({
            headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
            body: { ok: false, status: 'CANARY_FORBIDDEN' }
        });
    }

    const requestId = CANARY_KEY;
    let result;
    try {
        result = await runDivaBrainTransport(
            { text: requestId, history: [] },
            'MORADA_OWNER_CANARY'
        );
    } catch (error) {
        return serverError({
            headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
            body: { ok: false, status: 'CANARY_BRAIN_CALL_FAILED' }
        });
    }

    let receipt = null;
    if (result?.ok === true) {
        const pulseReceipt = await receiveDivaPulse({
            source: 'DIVA_MORADA_BRAIN',
            channel: 'HTTP_INTERNAL',
            type: 'SYSTEM_EVENT',
            intent: 'MEMORY_WRITE',
            message: 'DIVA_REPLY_RECEIPT',
            surface: '/cópia-sobre-mim',
            identityKey: 'MORADA_OWNER',
            data: {
                requestId,
                requestTag: requestId,
                provider: result.provider || null,
                model: result.model || null,
                messageId: result.messageId || null,
                brainStatus: result.status || null,
                transport: 'HTTP_CANARY_EPHEMERAL_V1'
            }
        });
        receipt = {
            ok: pulseReceipt?.ok === true,
            status: pulseReceipt?.status || null,
            pulseId: pulseReceipt?.pulseId || null,
            memoryRecordId: pulseReceipt?.memoryRecordId || null
        };
    }

    return ok({
        headers: { ...JSON_HEADERS, 'Cache-Control': 'no-store' },
        body: {
            ok: result?.ok === true,
            status: result?.status || 'UNKNOWN',
            text: result?.ok ? result.text : null,
            provider: result?.provider || null,
            model: result?.model || null,
            messageId: result?.messageId || null,
            receipt
        }
    });
}
