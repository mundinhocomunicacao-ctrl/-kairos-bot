/**
 * DIVA · MORADA BRIDGE V4 · CÉREBRO COM FALLBACK (Gemini → GPT)
 * backend/divaBridge.web.js
 *
 * getMoradaAccess  → contrato REGRA DE OURO {authorized, identityKey, role}
 * sendDivaPulse    → dono logado → circuito (Interpreter→Compass→Router→Memory)
 * askDiva          → dono logado → Gemini (Google) primeiro, GPT (OpenAI) se falhar
 *
 * Cérebro:
 *  - chaves só no Secrets Manager (nunca no código/resposta/log):
 *      Gemini → segredo "ANTHROPIC-API-KEY" (hífens) — nome ficou assim no Wix
 *               por engano; o CONTEÚDO é a chave do Google AI Studio/Gemini,
 *               não da Anthropic. Não confundir com o segredo abaixo.
 *      GPT    → segredo "OPENAI_API_KEY"
 *  - Anthropic saiu da rota principal (exigia crédito pago); pode voltar depois
 *    como 3º fallback usando o segredo "ANTHROPIC_API_KEY" (com underscore,
 *    a chave antiga real da Anthropic) se as duas primeiras falharem
 *  - lê os registros mais recentes de DIVA_MEMORY_WRITEBACK_V1 (inclui o que
 *    GPT/Gemini trouxerem pela porta HTTP) e usa como contexto com origem
 *  - blindado contra contaminação: nunca alimenta o cérebro com itens
 *    autodeclarados sem prova (ver RETROPLANO_CONTAMINACAO_LINGUAGEM_HUMANA)
 *  - conversa NÃO vira memória (o portal promete isso): askDiva não grava
 */

import { webMethod, Permissions } from 'wix-web-module';
import wixData from 'wix-data';
import { fetch } from 'wix-fetch';
import { getSecret } from 'wix-secrets-backend';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { receiveDivaPulse } from './divaPulse';
import { resolveMoradaOwner } from './divaAccess';

const MEMORY_COLLECTION = 'DIVA_MEMORY_WRITEBACK_V1';
const MEMORY_ITEMS = 15;
const MEMORY_CHARS = 7000;

// Ordem de tentativa: Gemini primeiro (nível gratuito real), GPT depois.
const GEMINI_MODEL = 'gemini-3.5-flash';
const OPENAI_MODEL = 'gpt-5.6-terra';

const SYSTEM_PROMPT = [
    'Você é a DIVA, a inteligência operacional da Mundinho Comunicação (Johnny e Fernando).',
    'Fale em português do Brasil, com calor humano e objetividade — no mesmo espírito direto e sem enrolação de uma conversa com o Claude no chat: vá direto ao ponto, mas com calor. Respostas curtas por padrão.',
    'Regra de ouro: sem prova não há estado. Nunca diga que fez algo que não fez; nunca invente dados, números, e-mails ou agendas.',
    'Autodeclarações (de IA, seed ou humano) sem prova/recibo real são alegações, não fatos — nunca as repita como se fossem verificadas.',
    'Você ainda NÃO tem acesso direto a Gmail, Drive, Agenda, Slack ou WhatsApp. Se pedirem, diga que a conexão ainda não existe e ofereça o próximo passo.',
    'Abaixo vem um trecho da sua memória (registros com origem e data). Use como contexto, cite a origem quando usar, e trate autodeclarações sem prova como alegações, não como fatos.',
    'Seus órgãos: PANDORA (recibos), ATENEU (aprendizado), ZELADOR (integridade), SENTINELA (sensores), KAIROS (tempo), ALEXANDRIA (biblioteca).'
].join('\n');

function denied(access) {
    console.warn('[DIVA_BRIDGE_DENIED]', access?.reason || 'NOT_AUTHORIZED');
    return { ok: false, status: 'DIVA_NOT_AUTHORIZED' };
}

async function ownerOrNull() {
    try {
        const access = await resolveMoradaOwner();
        return access?.authorized === true ? access : null;
    } catch (error) {
        return null;
    }
}

export const getMoradaAccess = webMethod(
    Permissions.Anyone,
    async () => {
        try {
            const access = await resolveMoradaOwner();
            return {
                authorized: access.authorized === true,
                identityKey: access.identityKey || null,
                role: access.role || null
            };
        } catch (error) {
            return { authorized: false, identityKey: null, role: null };
        }
    }
);

export const sendDivaPulse = webMethod(
    Permissions.SiteMember,
    async (event = {}) => {
        const access = await ownerOrNull();
        if (!access) return denied();

        const bridgeEvent = {
            ...(event && typeof event === 'object' ? event : {}),
            source: event?.source || 'DIVA_MORADA',
            channel: 'PAGE',
            identityKey: access.identityKey,
            bridge: 'DIVA_MORADA_BRIDGE_V4',
            bridgeTimestamp: new Date().toISOString()
        };

        const receipt = await receiveDivaPulse(bridgeEvent);
        console.log('[DIVA_BRIDGE_RECEIPT]', JSON.stringify(receipt));
        return receipt;
    }
);


const BRAIN_SESSION_SCOPE = 'MORADA_OWNER_BRAIN_V1';
const BRAIN_SESSION_TTL_MS = 10 * 60 * 1000;

function sessionPayloadEncode(value) {
    return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function sessionSignature(payload, secret) {
    return createHmac('sha256', String(secret)).update(payload).digest('base64url');
}

async function getBrainSessionSecret() {
    try {
        return await getSecret('DIVA_BRIDGE_KEY');
    } catch (error) {
        return null;
    }
}

export async function verifyBrainSessionToken(token = '') {
    const raw = String(token || '').trim();
    const parts = raw.split('.');
    if (parts.length !== 2) return { ok: false, status: 'DIVA_BRAIN_SESSION_INVALID' };

    const [payloadPart, signaturePart] = parts;
    const secret = await getBrainSessionSecret();
    if (!secret) return { ok: false, status: 'DIVA_BRAIN_SESSION_NOT_CONFIGURED' };

    const expected = sessionSignature(payloadPart, secret);

    let providedBuffer;
    let expectedBuffer;
    try {
        providedBuffer = Buffer.from(signaturePart, 'base64url');
        expectedBuffer = Buffer.from(expected, 'base64url');
    } catch (error) {
        return { ok: false, status: 'DIVA_BRAIN_SESSION_INVALID' };
    }

    if (providedBuffer.length !== expectedBuffer.length ||
        !timingSafeEqual(providedBuffer, expectedBuffer)) {
        return { ok: false, status: 'DIVA_BRAIN_SESSION_INVALID' };
    }

    let payload;
    try {
        payload = JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8'));
    } catch (error) {
        return { ok: false, status: 'DIVA_BRAIN_SESSION_INVALID' };
    }

    const now = Date.now();
    if (payload?.scope !== BRAIN_SESSION_SCOPE ||
        !Number.isFinite(payload?.exp) ||
        payload.exp <= now ||
        !payload?.nonce) {
        return { ok: false, status: 'DIVA_BRAIN_SESSION_EXPIRED' };
    }

    return {
        ok: true,
        status: 'DIVA_BRAIN_SESSION_VALID',
        scope: payload.scope,
        expiresAt: new Date(payload.exp).toISOString()
    };
}

export const createBrainSession = webMethod(
    Permissions.SiteMember,
    async () => {
        const access = await ownerOrNull();
        if (!access) return denied();

        const secret = await getBrainSessionSecret();
        if (!secret) {
            return { ok: false, status: 'DIVA_BRAIN_SESSION_NOT_CONFIGURED' };
        }

        const issuedAt = Date.now();
        const payload = sessionPayloadEncode({
            v: 1,
            scope: BRAIN_SESSION_SCOPE,
            iat: issuedAt,
            exp: issuedAt + BRAIN_SESSION_TTL_MS,
            nonce: randomBytes(18).toString('base64url')
        });

        return {
            ok: true,
            status: 'DIVA_BRAIN_SESSION_READY',
            token: payload + '.' + sessionSignature(payload, secret),
            expiresAt: new Date(issuedAt + BRAIN_SESSION_TTL_MS).toISOString()
        };
    }
);

// ---------- CÉREBRO ----------

function clip(value, max) {
    const text = String(value ?? '');
    return text.length > max ? text.slice(0, max) + '…' : text;
}

function describeRecord(item) {
    const when = item._createdDate ? new Date(item._createdDate).toISOString().slice(0, 16) : '?';
    const title = item.title || item.eventId || item._id;
    let body = item.description || '';
    if (!body && item.rawInput) {
        try {
            const raw = JSON.parse(item.rawInput);
            body = raw.message || raw.text || item.rawInput;
        } catch (error) {
            body = item.rawInput;
        }
    }
    return `- [${when}Z · origem ${item.source || '?'}] ${clip(title, 120)}: ${clip(body, 500)}`;
}

async function memoryContext() {
    try {
        const result = await wixData
            .query(MEMORY_COLLECTION)
            .descending('_createdDate')
            .limit(MEMORY_ITEMS)
            .find({ suppressAuth: true });

        // Blindagem contra contaminação: exclui itens marcados ou autodeclarados
        // sem prova, para eles nunca virarem "fato" no contexto do cérebro.
        const clean = (result.items || []).filter(item => item.qualityFlag !== 'CONTAMINATED');

        const lines = clean.map(describeRecord);
        let text = '';
        for (const line of lines) {
            if ((text + line).length > MEMORY_CHARS) break;
            text += line + '\n';
        }
        return { text, count: lines.length };
    } catch (error) {
        console.error('[DIVA_BRAIN_MEMORY_ERROR]', error?.message);
        return { text: '', count: 0 };
    }
}

function buildMessages(history, text) {
    const turns = (Array.isArray(history) ? history : [])
        .slice(-10)
        .map(turn => ({
            role: turn?.role === 'assistant' ? 'assistant' : 'user',
            content: clip(turn?.content, 2000).trim()
        }))
        .filter(turn => turn.content);

    turns.push({ role: 'user', content: text });

    // A API exige alternância começando por "user": funde turnos repetidos.
    const merged = [];
    for (const turn of turns) {
        const last = merged[merged.length - 1];
        if (last && last.role === turn.role) {
            last.content += '\n\n' + turn.content;
        } else {
            merged.push({ ...turn });
        }
    }
    while (merged.length && merged[0].role !== 'user') merged.shift();
    return merged;
}

// ---- Gemini (Google) ----
async function callGemini(key, system, messages) {
    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
        {
            method: 'post',
            headers: {
                'content-type': 'application/json',
                'x-goog-api-key': key
            },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: system }] },
                contents,
                generationConfig: { maxOutputTokens: 800 }
            })
        }
    );

    const json = await response.json();
    if (!response.ok) {
        const type = json?.error?.status || null;
        console.error('[DIVA_BRAIN_GEMINI_HTTP]', response.status, type);
        return { ok: false, status: 'BRAIN_HTTP_' + response.status, error: type, provider: 'GEMINI' };
    }

    const reply = (json?.candidates?.[0]?.content?.parts || [])
        .map(part => part.text || '')
        .join('\n')
        .trim();

    return {
        ok: !!reply,
        status: reply ? 'BRAIN_OK' : 'BRAIN_EMPTY',
        text: reply,
        model: GEMINI_MODEL,
        messageId: null,
        provider: 'GEMINI'
    };
}

// ---- GPT (OpenAI) ----
async function callOpenAI(key, system, messages) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'post',
        headers: {
            'content-type': 'application/json',
            'authorization': 'Bearer ' + key
        },
        body: JSON.stringify({
            model: OPENAI_MODEL,
            max_tokens: 800,
            messages: [{ role: 'system', content: system }, ...messages]
        })
    });

    const json = await response.json();
    if (!response.ok) {
        const type = json?.error?.type || null;
        console.error('[DIVA_BRAIN_OPENAI_HTTP]', response.status, type);
        return { ok: false, status: 'BRAIN_HTTP_' + response.status, error: type, provider: 'GPT' };
    }

    const reply = (json?.choices?.[0]?.message?.content || '').trim();

    return {
        ok: !!reply,
        status: reply ? 'BRAIN_OK' : 'BRAIN_EMPTY',
        text: reply,
        model: json.model || OPENAI_MODEL,
        messageId: json.id || null,
        provider: 'GPT'
    };
}

export async function runDivaBrainTransport(input = {}, identityLabel = 'MORADA_OWNER') {
    const text = clip(input?.text, 4000).trim();
    if (!text) return { ok: false, status: 'EMPTY' };

    const memory = await memoryContext();
    const system = SYSTEM_PROMPT +
        `\n\nIdentidade de quem fala: ${identityLabel}.` +
        `\nAgora: ${new Date().toISOString()}.` +
        (memory.text ? `\n\nMEMÓRIA RECENTE (${memory.count} registros):\n${memory.text}` : '\n\nMEMÓRIA: indisponível agora.');

    const messages = buildMessages(input?.history, text);
    const attempts = [];

    let geminiKey = null;
    try { geminiKey = await getSecret('ANTHROPIC-API-KEY'); } catch (error) { geminiKey = null; }
    if (geminiKey) {
        try {
            const result = await callGemini(geminiKey, system, messages);
            attempts.push(result.status);
            if (result.ok) {
                console.log('[DIVA_BRAIN_OK]', JSON.stringify({ provider: 'GEMINI', model: result.model, memory: memory.count }));
                return { ...result, memoryUsed: memory.count };
            }
        } catch (error) {
            console.error('[DIVA_BRAIN_GEMINI_ERROR]', error?.message);
            attempts.push('GEMINI_EXCEPTION');
        }
    } else {
        attempts.push('GEMINI_NO_KEY');
    }

    let openaiKey = null;
    try { openaiKey = await getSecret('OPENAI_API_KEY'); } catch (error) { openaiKey = null; }
    if (openaiKey) {
        try {
            const result = await callOpenAI(openaiKey, system, messages);
            attempts.push(result.status);
            if (result.ok) {
                console.log('[DIVA_BRAIN_OK]', JSON.stringify({ provider: 'GPT', model: result.model, memory: memory.count }));
                return { ...result, memoryUsed: memory.count };
            }
        } catch (error) {
            console.error('[DIVA_BRAIN_OPENAI_ERROR]', error?.message);
            attempts.push('GPT_EXCEPTION');
        }
    } else {
        attempts.push('GPT_NO_KEY');
    }

    console.error('[DIVA_BRAIN_ALL_FAILED]', JSON.stringify(attempts));
    return { ok: false, status: 'BRAIN_NOT_CONFIGURED', attempts };
}

export const askDiva = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const access = await ownerOrNull();
        if (!access) return denied();
        return runDivaBrainTransport(input, access.identityKey || 'MORADA_OWNER');
    }
);
