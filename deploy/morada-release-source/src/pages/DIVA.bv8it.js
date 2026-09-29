/**
 * DIVA · MORADA · PAGE BOOT V6 · TOKEN + FALLBACK DE INTERAÇÃO
 * Página DIVA (/cópia-sobre-mim)
 *
 * Rotas:
 * 1) Primária: Portal ⇄ #divaBridge (HTML component) ⇄ Velo ⇄ askDiva
 * 2) Fallback A: Portal ⇄ token efêmero na URL ⇄ HTTP same-origin ⇄ cérebro
 * 3) Fallback B: Portal ⇄ Wix session storage ⇄ Velo ⇄ askDiva
 *
 * O token é capability curta, emitida apenas após owner-check e removida da URL em ~1,8s.
 * Nenhum e-mail, memberId ou secret é exposto no navegador.
 */

import { currentMember, authentication } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { session } from 'wix-storage-frontend';
import { sendDivaPulse, askDiva, getMoradaAccess, createBrainSession } from 'backend/divaBridge.web';

const G = 'DIVA_MORADA_AUTH_V1';

const STORAGE = Object.freeze({
    READY: 'DIVA_MORADA_BRAIN_STORAGE_READY_V1',
    REQUEST: 'DIVA_MORADA_BRAIN_REQUEST_V1',
    REPLY: 'DIVA_MORADA_BRAIN_REPLY_V1'
});

const STORAGE_REQUEST_MAX_AGE_MS = 45_000;
const STORAGE_POLL_MS = 250;
const STORAGE_READY_HEARTBEAT_MS = 10_000;

$w.onReady(async function () {

    console.log('[DIVA_MORADA_BOOT]');

    setupOrbBridge();
    setupStorageBrainBridge();

    try {
        const member = await currentMember.getMember();

        if (!member) {
            console.log('[DIVA_MORADA_STATUS]', 'VISITANTE_SEM_PULSO');
            return;
        }

        await publishBrainSessionToken();
        setInterval(() => publishBrainSessionToken(), 8 * 60 * 1000);

        const receipt = await sendDivaPulse({
            message: 'MORADA_DIVA_ON_READY',
            intent: 'HUMAN_INPUT',
            source: 'DIVA_MORADA_PAGE',
            surface: '/cópia-sobre-mim'
        });

        console.log('[DIVA_MORADA_RECEIPT]', JSON.stringify(receipt));

        if (receipt?.status === 'DIVA_CIRCUIT_COMPLETED') {
            console.log('[DIVA_MORADA_STATUS]', 'PULSE_CONFIRMED', receipt.memoryRecordId);
        } else {
            console.warn('[DIVA_MORADA_STATUS]', 'PULSE_NOT_CONFIRMED', receipt?.status);
        }

    } catch (error) {
        console.error('[DIVA_MORADA_ERROR]', error);
    }
});


function setupStorageBrainBridge() {
    let lastRequestId = null;
    let busy = false;

    const markReady = () => {
        try {
            session.setItem(STORAGE.READY, JSON.stringify({
                channel: G,
                type: 'DIVA_MORADA_BRIDGE_READY',
                transport: 'WIX_SESSION_STORAGE',
                bridgeVersion: 'V6_STORAGE_FALLBACK',
                capabilities: ['brain', 'auth-state'],
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('[DIVA_STORAGE_READY]', error?.message);
        }
    };

    const poll = async () => {
        if (busy) return;

        let raw = null;
        try {
            raw = session.getItem(STORAGE.REQUEST);
        } catch (error) {
            console.warn('[DIVA_STORAGE_READ]', error?.message);
            return;
        }

        if (!raw) return;

        let request;
        try {
            request = JSON.parse(raw);
        } catch (error) {
            session.removeItem(STORAGE.REQUEST);
            return;
        }

        const id = String(request?.id || '').trim();
        const createdAt = Number(request?.createdAt || 0);

        if (!id) {
            session.removeItem(STORAGE.REQUEST);
            return;
        }

        if (id === lastRequestId) return;

        if (!createdAt || Math.abs(Date.now() - createdAt) > STORAGE_REQUEST_MAX_AGE_MS) {
            session.removeItem(STORAGE.REQUEST);
            return;
        }

        lastRequestId = id;
        busy = true;
        session.removeItem(STORAGE.REQUEST);

        let result;
        try {
            result = await askDiva({
                text: String(request?.text || ''),
                history: Array.isArray(request?.history) ? request.history.slice(-10) : []
            });
        } catch (error) {
            result = { ok: false, status: 'BRAIN_CALL_FAILED' };
        }

        try {
            session.setItem(STORAGE.REPLY, JSON.stringify({
                channel: G,
                type: 'DIVA_REPLY',
                transport: 'WIX_SESSION_STORAGE',
                id,
                ok: result?.ok === true,
                status: result?.status || 'UNKNOWN',
                text: result?.ok ? result.text : null,
                model: result?.model || null,
                provider: result?.provider || null,
                messageId: result?.messageId || null,
                createdAt: Date.now()
            }));
        } catch (error) {
            console.error('[DIVA_STORAGE_REPLY]', error?.message);
        } finally {
            busy = false;
        }
    };

    markReady();
    setInterval(markReady, STORAGE_READY_HEARTBEAT_MS);
    setInterval(poll, STORAGE_POLL_MS);

    console.log('[DIVA_STORAGE_BRIDGE]', 'READY');
}

async function publishBrainSessionToken() {
    try {
        const brainSession = await createBrainSession();
        if (!brainSession?.ok || !brainSession?.token) {
            console.warn('[DIVA_BRAIN_SESSION]', brainSession?.status || 'NOT_READY');
            return;
        }

        wixLocationFrontend.queryParams.add({
            __diva_bt: brainSession.token
        });

        setTimeout(() => {
            try {
                wixLocationFrontend.queryParams.remove(['__diva_bt']);
            } catch (error) {
                // best effort: o token já expira no backend
            }
        }, 1800);

        console.log('[DIVA_BRAIN_SESSION]', 'READY', brainSession.expiresAt || '');
    } catch (error) {
        console.warn('[DIVA_BRAIN_SESSION]', error?.message || 'ERROR');
    }
}

function setupOrbBridge() {

    let bridge;

    try {
        bridge = $w('#divaBridge');
        if (!bridge || typeof bridge.onMessage !== 'function') throw new Error('NO_BRIDGE');
    } catch (error) {
        console.warn('[DIVA_ORB_BRIDGE]', 'SEM_ELEMENTO_divaBridge');
        return;
    }

    const send = payload => {
        try {
            bridge.postMessage({ channel: G, type: 'FROM_VELO', payload });
        } catch (error) {
            console.warn('[DIVA_ORB_BRIDGE_SEND]', error?.message);
        }
    };

    const pushState = async () => {
        let access = { authorized: false };
        let member = null;
        try { access = await getMoradaAccess(); } catch (error) { /* negado */ }
        try { member = await currentMember.getMember(); } catch (error) { /* visitante */ }

        const state = access.authorized ? 'AUTHORIZED' : (member ? 'DENIED' : 'GUEST');

        send({
            channel: G,
            type: 'DIVA_MORADA_STATE',
            state,
            access: access.authorized ? { accessLevel: access.role, routeRef: 'DIVA_MORADA_WORKSPACE' } : null
        });
    };

    bridge.onMessage(async event => {
        const message = event?.data;
        if (!message || message.channel !== G) return;

        if (message.type === 'DIVA_MORADA_BRIDGE_READY') {
            pushState();
            return;
        }

        if (message.type !== 'TO_VELO' || !message.payload) return;

        const request = message.payload;

        if (request.type === 'DIVA_MORADA_AUTH_CHECK') {
            pushState();
            return;
        }

        if (request.type === 'DIVA_MORADA_LOGIN_REQUEST') {
            try { await authentication.promptLogin({ mode: 'login' }); } catch (error) { /* cancelado */ }
            pushState();
            return;
        }

        if (request.type === 'DIVA_ASK') {
            let result;
            try {
                result = await askDiva({ text: request.text, history: request.history });
            } catch (error) {
                result = { ok: false, status: 'BRAIN_CALL_FAILED' };
            }

            console.log('[DIVA_BRAIN]', result?.status, result?.messageId || '');

            send({
                channel: G,
                type: 'DIVA_REPLY',
                id: request.id,
                ok: result?.ok === true,
                status: result?.status || 'UNKNOWN',
                text: result?.ok ? result.text : null,
                model: result?.model || null,
                provider: result?.provider || null,
                messageId: result?.messageId || null
            });
        }
    });

    send({ channel: G, type: 'VELO_READY' });
}
