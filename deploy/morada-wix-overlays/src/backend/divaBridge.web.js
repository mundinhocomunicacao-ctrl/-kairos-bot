/**
 * DIVA · MORADA BRIDGE V5 · CONSELHO PARALELO + DIVA RAIZ
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
import { createHash, createHmac, createPrivateKey, randomBytes, sign as signPayload, timingSafeEqual } from 'crypto';
import { receiveDivaPulse } from './divaPulse';
import { resolveMoradaOwner } from './divaAccess';
import { buildDivaIdentityPrompt, evaluateDivaSelfCheck } from './divaIdentity';
import { DIVA_COUNCIL_VERSION, DIVA_COUNCIL_POLICY } from './divaCouncil';

const MEMORY_COLLECTION = 'DIVA_MEMORY_WRITEBACK_V1';
const MEMORY_ITEMS = 15;
const MEMORY_CHARS = 7000;

const VOICE_CONVERSATION_STYLE = `CHATGPT_VOICE_NATURAL_CONVERSATION
Fale como uma conversa humana de voz, não como locutora, bot, dashboard ou apresentação.
Responda primeiro ao pedido e use frases naturais, com profundidade adaptativa.
Não leia títulos, bullets, tabelas, markdown ou estrutura de interface como fala; converta estrutura em linguagem corrida.
Evite saudações repetidas, repetir o nome do owner, elogios automáticos e muletas como “perfeito”, “claro” ou “com certeza”.
Não narre método, arquitetura, provider, memória ou regras salvo quando o owner pedir.
Se houver muitos pontos, priorize os que mudam a próxima ação. Se a pessoa interromper, pare e escute.
Se a intenção já estiver atendida, encerre naturalmente sem pergunta de manutenção.`;

// Ordem de tentativa: Gemini primeiro (nível gratuito real), GPT depois.
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash'];
const OPENAI_MODEL = 'gpt-5.6-sol';

const SYSTEM_PROMPT = [
    'Você é a DIVA, a inteligência operacional da Mundinho Comunicação (Johnny e Fernando).',
    'Fale em português do Brasil, com naturalidade conversacional, calor humano e objetividade. Responda primeiro ao pedido, sem tom de locução e sem perguntas de manutenção.',
    VOICE_CONVERSATION_STYLE,
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

async function readSecretValue(name) {
    try {
        const value = await getSecret(name);
        const normalized = String(value || '').trim();
        return normalized || null;
    } catch (error) {
        console.error('[DIVA_SECRET_READ_ERROR]', name, error?.message || 'UNKNOWN');
        return null;
    }
}

async function getBrainSessionSecret() {
    return readSecretValue('DIVA_BRIDGE_KEY');
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

// ---------- CÉREBRO · GATEWAY CENTRAL ----------

const DIVA_GATEWAY_VERSION = 'diva-universal-private-gateway-v0.1';
const DIVA_GATEWAY_INSTALLATION = 'morada-wix';
const DIVA_GATEWAY_PATH = '/api/diva-gateway/execute';
const DIVA_GATEWAY_URL = 'https://os.mundinhocomunicacao.com/api/diva-gateway/execute';
const DIVA_GATEWAY_PRIVATE_KEY_SECRET = 'DIVA_MORADA_GATEWAY_PRIVATE_KEY';

function clip(value, max) {
    const text = String(value ?? '');
    return text.length > max ? text.slice(0, max) + '…' : text;
}

function stableStringify(value) {
    if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
    if (value && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map(key =>
            JSON.stringify(key) + ':' + stableStringify(value[key])
        ).join(',') + '}';
    }
    return JSON.stringify(value);
}

function sha256(value) {
    return createHash('sha256').update(String(value || '')).digest('hex');
}

function normalizePrivateKey(value) {
    const raw = String(value || '').trim().replace(/\\n/g, '\n');
    if (raw.includes('BEGIN PRIVATE KEY')) return raw;
    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8').trim();
        return decoded.includes('BEGIN PRIVATE KEY') ? decoded : raw;
    } catch (error) {
        return raw;
    }
}

function gatewaySignatureMaterial({ timestamp, nonce, body }) {
    return [
        DIVA_GATEWAY_VERSION,
        DIVA_GATEWAY_INSTALLATION,
        timestamp,
        nonce,
        'POST',
        DIVA_GATEWAY_PATH,
        sha256(stableStringify(body))
    ].join('\n');
}

async function gatewayHeaders(body) {
    const stored = await readSecretValue(DIVA_GATEWAY_PRIVATE_KEY_SECRET);
    if (!stored) throw new Error('DIVA_MORADA_GATEWAY_PRIVATE_KEY_MISSING');

    const timestamp = new Date().toISOString();
    const nonce = randomBytes(18).toString('base64url');
    const privateKey = createPrivateKey(normalizePrivateKey(stored));
    const material = gatewaySignatureMaterial({ timestamp, nonce, body });
    const signature = signPayload(null, Buffer.from(material, 'utf8'), privateKey).toString('base64url');

    return {
        'content-type': 'application/json',
        'x-diva-installation-id': DIVA_GATEWAY_INSTALLATION,
        'x-diva-timestamp': timestamp,
        'x-diva-nonce': nonce,
        'x-diva-signature': signature,
        'x-diva-signature-alg': 'ed25519',
        'x-diva-gateway-version': DIVA_GATEWAY_VERSION
    };
}

function gatewayHistory(history) {
    return (Array.isArray(history) ? history : [])
        .slice(-10)
        .map(turn => ({
            role: turn?.role === 'assistant' ? 'assistant' : 'user',
            content: clip(turn?.content, 1800).trim()
        }))
        .filter(turn => turn.content);
}

async function callCentralGateway(body) {
    const headers = await gatewayHeaders(body);
    const response = await fetch(DIVA_GATEWAY_URL, {
        method: 'post',
        headers,
        body: JSON.stringify(body)
    });

    let json = {};
    try {
        json = await response.json();
    } catch (error) {
        json = {};
    }

    return { response, json };
}

const PANDORA_AUTHORITY_EVENT = 'diva.morada.pandora.mission.authority';
const PANDORA_AUTHORITY_VALIDATION = 'PANDORA_MISSION_AUTHORITY';
const PANDORA_AUTHORITY_SCOPE = 'MORADA_BACKEND_MACHINE';

async function resolvePandoraMissionAuthority({ missionId, capability, missionKey } = {}) {
    const mission = String(missionId || '').trim();
    const requestedCapability = String(capability || '').trim();
    if (!mission) return { authorized: false, reason: 'PANDORA_MISSION_ID_REQUIRED' };
    if (!requestedCapability) return { authorized: false, reason: 'PANDORA_CAPABILITY_REQUIRED' };
    const requestedMissionKey = String(missionKey || '').trim();
    if (!requestedMissionKey) return { authorized: false, reason: 'PANDORA_MISSION_KEY_REQUIRED' };

    let result;
    try {
        result = await wixData
            .query(MEMORY_COLLECTION)
            .eq('eventType', PANDORA_AUTHORITY_EVENT)
            .eq('status', 'AUTHORIZED_REREAD_VERIFIED')
            .eq('source', 'PANDORA')
            .limit(100)
            .find({ suppressAuth: true });
    } catch (error) {
        console.error('[PANDORA_AUTHORITY_LOOKUP_ERROR]', error?.message || 'LOOKUP_FAILED');
        return { authorized: false, reason: 'PANDORA_AUTHORITY_LEDGER_UNAVAILABLE' };
    }

    const now = Date.now();
    const match = (result?.items || []).find(row => {
        const payload = row?.payload && typeof row.payload === 'object' ? row.payload : {};
        const capabilities = Array.isArray(payload.capabilities)
            ? payload.capabilities.map(value => String(value || '').trim())
            : [];
        const expiresAt = Date.parse(String(payload.expiresAt || ''));
        return String(row.validation || '') === PANDORA_AUTHORITY_VALIDATION &&
            String(row.epistemicState || '') === 'OBSERVED_EVENT' &&
            String(payload.authority || '') === 'PANDORA' &&
            String(payload.worldId || '') === 'MUNDO' &&
            String(payload.missionId || '') === mission &&
            String(payload.routeRef || '') === 'DIVA_MORADA_WORKSPACE' &&
            String(payload.scope || '') === PANDORA_AUTHORITY_SCOPE &&
            payload.denyByDefault === true &&
            payload.rereadVerified === true &&
            String(payload.grantId || '').trim() === requestedMissionKey &&
            Number.isFinite(expiresAt) &&
            expiresAt > now &&
            capabilities.includes(requestedCapability);
    });

    if (!match) return { authorized: false, reason: 'PANDORA_MISSION_AUTHORITY_NOT_FOUND' };
    return {
        authorized: true,
        authority: 'PANDORA_MISSION_AUTHORITY',
        missionId: mission,
        capability: requestedCapability,
        grantId: String(match?.payload?.grantId || '')
    };
}


function gatewayMissionId(conversationRef) {
    return 'mission_' + sha256(DIVA_GATEWAY_INSTALLATION + ':' + conversationRef).slice(0, 24);
}

const COUNCIL_POLICY_COLLECTION = 'DIVA_MORADA_AUTOMATION_V1';
const COUNCIL_POLICY_ITEM = 'diva-morada-council-policy-v1';

function safeHistoryForGemini(history) {
    return (Array.isArray(history) ? history : []).slice(-10).map(turn => ({
        role: turn?.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: clip(turn?.content, 1800) }]
    })).filter(turn => turn.parts[0].text.trim());
}

async function loadCouncilRuntimePolicy() {
    try {
        const row = await wixData.get(COUNCIL_POLICY_COLLECTION, COUNCIL_POLICY_ITEM, { suppressAuth: true });
        const paid = Array.isArray(row?.payload?.costAuthorizedProviders)
            ? row.payload.costAuthorizedProviders.map(v => String(v).toLowerCase())
            : [];
        return { paid };
    } catch (error) {
        return { paid: [] };
    }
}

async function callGeminiText({ text, history = [], context = '', system = '' }) {
    const apiKey = await readSecretValue('ANTHROPIC-API-KEY');
    if (!apiKey) return { ok: false, provider: 'gemini', status: 'GEMINI_NOT_CONFIGURED' };

    let lastStatus = 'GEMINI_ALL_FAILED';
    for (const model of GEMINI_MODELS) {
        try {
            const response = await fetch(
                'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent',
                {
                    method: 'post',
                    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: system || buildDivaIdentityPrompt({ context, question: text }) }] },
                        contents: [...safeHistoryForGemini(history), { role: 'user', parts: [{ text: clip(text, 8000) }] }],
                        generationConfig: { maxOutputTokens: 5000 }
                    })
                }
            );
            const raw = await response.text();
            let data = {};
            try { data = raw ? JSON.parse(raw) : {}; } catch (error) {}
            if (!response.ok) {
                lastStatus = 'GEMINI_' + response.status;
                if (![400, 404].includes(Number(response.status))) break;
                continue;
            }
            const answer = (data?.candidates || [])
                .flatMap(candidate => candidate?.content?.parts || [])
                .map(part => typeof part?.text === 'string' ? part.text : '')
                .filter(Boolean)
                .join('\n')
                .trim();
            if (!answer) {
                lastStatus = 'GEMINI_EMPTY_RESPONSE';
                continue;
            }
            return { ok: true, provider: 'gemini', model, text: answer, status: 'OK' };
        } catch (error) {
            lastStatus = 'GEMINI_EXCEPTION';
            break;
        }
    }
    return { ok: false, provider: 'gemini', status: lastStatus };
}

async function callOpenAIText({ text, history = [], context = '' }) {
    const apiKey = await readSecretValue('OPENAI_API_KEY');
    if (!apiKey) return { ok: false, provider: 'openai', status: 'OPENAI_NOT_CONFIGURED' };
    try {
        const transcript = gatewayHistory(history)
            .map(turn => (turn.role === 'assistant' ? 'ASSISTANT: ' : 'USER: ') + turn.content)
            .join('\n');
        const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'post',
            headers: { 'content-type': 'application/json', authorization: 'Bearer ' + apiKey },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                instructions: buildDivaIdentityPrompt({ context, question: text }),
                input: transcript ? transcript + '\n\nUSER: ' + clip(text, 8000) : clip(text, 8000),
                max_output_tokens: 5000
            })
        });
        const raw = await response.text();
        let data = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch (error) {}
        if (!response.ok) return { ok: false, provider: 'openai', status: 'OPENAI_' + response.status };
        const answer = (data?.output || [])
            .flatMap(item => item?.content || [])
            .map(part => typeof part?.text === 'string' ? part.text : '')
            .filter(Boolean)
            .join('\n')
            .trim();
        return answer
            ? { ok: true, provider: 'openai', model: data?.model || OPENAI_MODEL, text: answer, status: 'OK' }
            : { ok: false, provider: 'openai', status: 'OPENAI_EMPTY_RESPONSE' };
    } catch (error) {
        return { ok: false, provider: 'openai', status: 'OPENAI_EXCEPTION' };
    }
}

async function callGatewayContribution(input, identityLabel) {
    const text = clip(input?.text, 4000).trim();
    const conversationRef = 'morada-owner:' + sha256(identityLabel).slice(0, 24);
    const baseBody = {
        surface_id: 'wix',
        message: text,
        history: gatewayHistory(input?.history),
        currentRoute: '/cópia-sobre-mim',
        conversation_ref: conversationRef,
        context: 'DIVA_MORADA owner-only · ONE_DIVA_MANY_SURFACES · provider é recurso, não identidade.\n' + VOICE_CONVERSATION_STYLE
    };

    try {
        let result = await callCentralGateway(baseBody);
        let reason = String(result.json?.error || result.json?.message || '').slice(0, 120);
        if (result.response.status === 409 && reason === 'active_mission_not_found') {
            result = await callCentralGateway({ ...baseBody, mission_id: gatewayMissionId(conversationRef) });
            reason = String(result.json?.error || result.json?.message || '').slice(0, 120);
        }
        if (!result.response.ok) {
            return { ok: false, provider: 'gateway', status: 'DIVA_GATEWAY_HTTP_' + result.response.status };
        }
        const reply = String(result.json?.answer || '').trim();
        if (!reply) return { ok: false, provider: 'gateway', status: 'DIVA_GATEWAY_EMPTY' };
        return {
            ok: true,
            provider: 'gateway',
            upstreamProvider: result.json?.provider || null,
            model: result.json?.model || null,
            text: reply,
            status: 'OK',
            messageId: result.json?.runtime?.requestId || result.response.headers?.get?.('x-diva-gateway-event-id') || null,
            missionId: result.response.headers?.get?.('x-diva-gateway-mission-id') || null
        };
    } catch (error) {
        return { ok: false, provider: 'gateway', status: 'DIVA_GATEWAY_EXCEPTION' };
    }
}

function providerLeak(answer) {
    return /\b(?:eu sou|sou|como)\s+(?:o\s+|a\s+)?(?:gemini|chatgpt|claude|openai|anthropic)\b/i.test(String(answer || ''));
}

function identityDrift(answer) {
    return /\b(?:não sou a diva|sou outra diva|nova diva|substitu[íi] a diva)\b/i.test(String(answer || ''));
}

async function synthesizeCouncil({ text, contributions, identityLabel }) {
    const gatewayCandidate = contributions.find(row => row.provider === 'gateway') || null;
    if (contributions.length === 1 && gatewayCandidate) return gatewayCandidate;

    const material = contributions.map((row, index) =>
        'PERSPECTIVA ' + (index + 1) + ':\n' + clip(row.text, 7000)
    ).join('\n\n');

    const synthesisPrompt = [
        'DIVA_ROOT_SYNTHESIS',
        'Pergunta original do owner:',
        clip(text, 5000),
        'Material do conselho silencioso:',
        material,
        'Entregue UMA resposta final da DIVA. Preserve convergências, sinalize incerteza material e não mencione providers nem painel interno.',
        'REGRA DE CIRCULAÇÃO: esta síntese precisa retornar pela DIVA central para atravessar OS → PANDORA → MALHA → KAIROS → ATENEU → DIVA Raiz antes de chegar à Morada.'
    ].join('\n\n');

    const synthesis = await callGatewayContribution({ text: synthesisPrompt, history: [] }, identityLabel);
    if (synthesis.ok) return synthesis;
    if (gatewayCandidate) return gatewayCandidate;
    return { ok: false, provider: 'gateway', status: 'DIVA_GATEWAY_SYNTHESIS_REQUIRED' };
}

export async function runDivaBrainTransport(input = {}, identityLabel = 'MORADA_OWNER') {
    const text = clip(input?.text, 4000).trim();
    if (!text) return { ok: false, status: 'EMPTY', attempts: [] };

    const runtimePolicy = await loadCouncilRuntimePolicy();
    const tasks = [
        callGatewayContribution(input, identityLabel),
        callGeminiText({
            text,
            history: input?.history,
            context: 'Morada owner-only. Use memória governada apenas quando disponível; não invente estado.\n' + VOICE_CONVERSATION_STYLE
        })
    ];

    if (runtimePolicy.paid.includes('openai')) {
        tasks.push(callOpenAIText({
            text,
            history: input?.history,
            context: 'Morada owner-only. OpenAI participa como recurso do Conselho DIVA, nunca como identidade.\n' + VOICE_CONVERSATION_STYLE
        }));
    }

    const rows = await Promise.all(tasks);
    const successful = rows.filter(row => row?.ok === true && row.text);
    const attempts = rows.map(row => row.provider + ':' + row.status);

    if (!successful.length) {
        return {
            ok: false,
            status: 'BRAIN_ALL_FAILED',
            provider: 'DIVA_COUNCIL',
            model: 'ensemble',
            councilVersion: DIVA_COUNCIL_VERSION,
            attempts
        };
    }

    let final = await synthesizeCouncil({ text, contributions: successful, identityLabel });
    if (!final?.ok || final.provider !== 'gateway') {
        return {
            ok: false,
            status: 'BRAIN_CANONICAL_SYNTHESIS_UNAVAILABLE',
            provider: 'DIVA_COUNCIL',
            model: 'ensemble',
            councilVersion: DIVA_COUNCIL_VERSION,
            attempts
        };
    }
    let answer = String(final?.text || '').trim();

    let selfCheck = evaluateDivaSelfCheck({
        answer,
        providerLeak: providerLeak(answer),
        identityDrift: identityDrift(answer)
    });

    if (!selfCheck.pass) {
        const repair = await callGatewayContribution({
            text: [
                'DIVA SELF-CHECK · CORREÇÃO',
                'Falhas: ' + selfCheck.reasons.join(', '),
                'Pergunta original: ' + text,
                'Resposta candidata: ' + answer,
                'Reescreva mantendo conteúdo útil, sem assumir identidade de provider e sem inventar fatos.',
                'Retorne a correção pela DIVA central e preserve a circulação OS → PANDORA → MALHA.'
            ].join('\n\n'),
            history: []
        }, identityLabel);
        if (repair.ok) {
            answer = repair.text;
            final = repair;
            selfCheck = evaluateDivaSelfCheck({
                answer,
                providerLeak: providerLeak(answer),
                identityDrift: identityDrift(answer)
            });
        }
    }

    if (!selfCheck.pass) {
        return {
            ok: false,
            status: 'DIVA_SELF_CHECK_FAILED',
            provider: 'DIVA_COUNCIL',
            model: 'ensemble',
            councilVersion: DIVA_COUNCIL_VERSION,
            attempts
        };
    }

    const gateway = successful.find(row => row.provider === 'gateway');
    return {
        ok: true,
        status: 'BRAIN_OK',
        text: answer,
        provider: 'DIVA_COUNCIL',
        model: 'ensemble',
        councilMode: DIVA_COUNCIL_POLICY.mode,
        councilVersion: DIVA_COUNCIL_VERSION,
        contributors: successful.map(row => row.provider),
        finalProvider: 'DIVA_GATEWAY',
        circulation: 'OS_MALHA',
        messageId: final?.messageId || gateway?.messageId || null,
        missionId: final?.missionId || gateway?.missionId || null,
        attempts
    };
}


export async function sendPandoraMissionToMalhaInternal(input = {}) {
        const missionId = String(input?.missionId || '').trim().slice(0, 200);
        const message = String(input?.text || input?.message || '').trim().slice(0, 12000);

        const missionKey = String(input?.missionKey || '').trim().slice(0, 260);
        const authority = await resolvePandoraMissionAuthority({
            missionId,
            capability: 'malha_command',
            missionKey
        });

        if (!authority.authorized) {
            console.warn('[PANDORA_MORADA_DENIED]', authority.reason || 'NOT_AUTHORIZED');
            return { ok: false, status: authority.reason || 'PANDORA_MISSION_AUTHORITY_REQUIRED' };
        }
        if (!message) return { ok: false, status: 'PANDORA_MISSION_TEXT_REQUIRED' };

        const body = {
            surface_id: 'wix',
            mission_id: missionId,
            message,
            history: [],
            currentRoute: '/cópia-sobre-mim',
            conversation_ref: 'morada://sala-da-malha',
            context: 'PANDORA_MISSION_AUTHORITY · deny-by-default · capability=malha_command'
        };

        try {
            const result = await callCentralGateway(body);
            const answer = String(result?.json?.answer || result?.json?.message || '').trim();
            return {
                ok: result?.response?.ok === true,
                status: result?.response?.ok ? 'PANDORA_MISSION_DELIVERED' : 'PANDORA_MISSION_GATEWAY_FAILED',
                missionId,
                authority: authority.authority,
                grantId: authority.grantId,
                httpStatus: result?.response?.status || null,
                answer: answer || null,
                gatewayMissionId: result?.response?.headers?.get?.('x-diva-gateway-mission-id') || missionId
            };
        } catch (error) {
            console.error('[PANDORA_MORADA_GATEWAY_ERROR]', error?.message || 'CALL_FAILED');
            return {
                ok: false,
                status: 'PANDORA_MISSION_GATEWAY_EXCEPTION',
                missionId,
                authority: authority.authority
            };
        }
    }

export const sendPandoraMissionToMalha = webMethod(
    Permissions.Anyone,
    async (input = {}) => sendPandoraMissionToMalhaInternal(input)
);

export const askDiva = webMethod(
    Permissions.SiteMember,
    async (input = {}) => {
        const access = await ownerOrNull();
        if (!access) return denied();
        return runDivaBrainTransport(input, access.identityKey || 'MORADA_OWNER');
    }
);
