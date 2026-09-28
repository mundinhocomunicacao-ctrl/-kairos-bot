/**
 * DIVA · MORADA · PAGE BOOT V5 · CÉREBRO COM TOKEN EFÊMERO
 * Página DIVA (/cópia-sobre-mim)
 *
 * Rotas:
 * 1) Primária: Portal ⇄ #divaBridge (HTML component) ⇄ Velo ⇄ askDiva
 * 2) Fallback: Portal ⇄ token efêmero na URL ⇄ HTTP same-origin ⇄ cérebro
 *
 * O token é capability curta, emitida apenas após owner-check e removida da URL em ~1,8s.
 * Nenhum e-mail, memberId ou secret é exposto no navegador.
 */

import { currentMember, authentication } from 'wix-members-frontend';
import wixLocationFrontend from 'wix-location-frontend';
import { sendDivaPulse, askDiva, getMoradaAccess, createBrainSession } from 'backend/divaBridge.web';

const G = 'DIVA_MORADA_AUTH_V1';

$w.onReady(async function () {

    console.log('[DIVA_MORADA_BOOT]');

    setupOrbBridge();

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
