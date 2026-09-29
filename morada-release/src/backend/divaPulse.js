/**
 * DIVA · PULSE RECEIVER V2
 * SUBSTITUI TODO o conteúdo de: backend/divaPulse.js
 *
 * Mudança em relação à V1:
 *  - safeEvent passa a PRESERVAR message / intent / surface / history / context /
 *    channel / identityKey (antes eram descartados e o pulso chegava vazio,
 *    como UNCLASSIFIED).
 *  - limites de tamanho para não gravar payload gigante.
 *  - campos de segredo nunca entram no rawInput.
 * O circuito (Interpreter → Compass → Router → Memory) não muda.
 */

import { interpretDivaPulse } from './divaInterpreter';
import { runDivaCompass } from './divaCompass';
import { routeDivaDecision } from './divaRouter';
import { writeDivaMemory } from './divaMemory';

const MAX_TEXT = 4000;
const MAX_CONTEXT = 2000;
const MAX_HISTORY = 20;
const BLOCKED_KEYS = ['token', 'secret', 'password', 'apikey', 'api_key', 'authorization', 'key'];

function createPulseId() {
    return `diva_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function clip(value, max) {
    if (value === undefined || value === null) return undefined;
    const text = String(value);
    return text.length > max ? text.slice(0, max) : text;
}

function stripSecrets(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const clean = {};
    for (const [k, v] of Object.entries(obj)) {
        if (BLOCKED_KEYS.includes(String(k).toLowerCase())) continue;
        clean[k] = v;
    }
    return clean;
}

function safeEvent(event) {
    const message = clip(event?.message ?? event?.text, MAX_TEXT);

    const raw = {
        source: event?.source || 'DIVA_MORADA',
        channel: event?.channel || 'UNKNOWN',
        type: event?.type || (message ? 'HUMAN_MESSAGE' : 'UNKNOWN'),
        intent: event?.intent ? String(event.intent).toUpperCase() : undefined,
        message,
        surface: clip(event?.surface, 300),
        context: clip(event?.context, MAX_CONTEXT),
        history: Array.isArray(event?.history) ? event.history.slice(-MAX_HISTORY) : undefined,
        data: stripSecrets(event?.data) || {},
        externalId: event?.externalId || null,
        identityKey: event?.identityKey || null,
        bridge: event?.bridge || null,
        bridgeTimestamp: event?.bridgeTimestamp || null
    };

    Object.keys(raw).forEach(k => raw[k] === undefined && delete raw[k]);
    return raw;
}

export async function receiveDivaPulse(event = {}) {
    const receivedAt = new Date().toISOString();

    if (!event || typeof event !== 'object') {
        return { ok: false, status: 'INVALID_PULSE', receivedAt };
    }

    const pulse = {
        pulseId: createPulseId(),
        timestamp: receivedAt,
        rawInput: safeEvent(event),
        source: event.source || 'DIVA_MORADA',
        surface: 'especialistabrandingeinfluencia.com',
        route: 'DIVA_PULSE',
        provenance: {
            receivedAt,
            receivedBy: 'DIVA_PULSE_RECEIVER_V2'
        }
    };

    try {
        const interpretation = await interpretDivaPulse(pulse);

        const compass = await runDivaCompass({ pulse, interpretation });

        const decision = await routeDivaDecision({ pulse, interpretation, compass });

        if (compass?.allowed !== true || decision?.ok !== true) {
            return {
                ok: false,
                status: 'DIVA_CIRCUIT_BLOCKED',
                pulseId: pulse.pulseId,
                receivedAt,
                completedAt: new Date().toISOString(),
                trace: ['PULSE_RECEIVED', 'INTERPRETED', 'CANON_CHECKED', 'BLOCKED']
            };
        }

        const memory = await writeDivaMemory({ pulse, interpretation });

        const confirmed = memory?.ok === true && memory?.status === 'DIVA_MEMORY_CONFIRMED';

        return {
            ok: confirmed,
            status: confirmed ? 'DIVA_CIRCUIT_COMPLETED' : 'DIVA_MEMORY_NOT_CONFIRMED',
            pulseId: pulse.pulseId,
            receivedAt,
            completedAt: new Date().toISOString(),
            destination: decision?.destination || null,
            trace: [
                'PULSE_RECEIVED',
                'INTERPRETED',
                'CANON_CHECKED',
                'ROUTED',
                'MEMORY_WRITE_REQUESTED',
                confirmed ? 'MEMORY_REREAD_CONFIRMED' : 'MEMORY_REREAD_FAILED'
            ],
            memoryRecordId: memory?.recordId || null
        };

    } catch (error) {
        console.error('[DIVA_CIRCUIT_ERROR]', { pulseId: pulse.pulseId, message: error?.message });

        return {
            ok: false,
            status: 'DIVA_CIRCUIT_ERROR',
            error: error?.message || 'UNKNOWN',
            pulseId: pulse.pulseId,
            receivedAt,
            completedAt: new Date().toISOString()
        };
    }
}