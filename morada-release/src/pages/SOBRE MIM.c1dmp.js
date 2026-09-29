/**
 * DIVA · MORADA · PAGE BOOT V2
 * SUBSTITUI TODO o código da página /cópia-sobre-mim
 * (Editor → página "cópia-sobre-mim" → painel de código da página)
 *
 * Mudança em relação à V1:
 *  - visitante sem login NÃO dispara pulso (antes, cada visita tentava gravar).
 *  - membro logado dispara; o backend só grava se for owner (allowlist).
 */

import { currentMember } from 'wix-members-frontend';
import { sendDivaPulse, createBrainSession } from 'backend/divaBridge.web';
import wixLocationFrontend from 'wix-location-frontend';

$w.onReady(async function () {

    console.log('[DIVA_MORADA_BOOT]');

    try {
        const member = await currentMember.getMember();

        if (!member) {
            console.log('[DIVA_MORADA_STATUS]', 'VISITANTE_SEM_PULSO');
            return;
        }

        const receipt = await sendDivaPulse({
            message: 'MORADA_DIVA_ON_READY',
            intent: 'HUMAN_INPUT',
            source: 'DIVA_MORADA_PAGE',
            surface: '/cópia-sobre-mim'
        });

        console.log('[DIVA_MORADA_RECEIPT]', JSON.stringify(receipt));

        const marker = String(wixLocationFrontend.query?.divaBrain || '') === '1';
        if (!marker) {
            const session = await createBrainSession();
            if (session?.ok === true && session?.token) {
                const target = '/cópia-sobre-mim?divaBrain=1#diva_brain=' + encodeURIComponent(session.token);
                console.log('[DIVA_MORADA_BRAIN_SESSION]', 'MINTED_OWNER_CAPABILITY');
                wixLocationFrontend.to(target);
                return;
            }
            console.warn('[DIVA_MORADA_BRAIN_SESSION]', session?.status || 'SESSION_NOT_READY');
        }

        if (receipt?.status === 'DIVA_CIRCUIT_COMPLETED') {
            console.log('[DIVA_MORADA_STATUS]', 'PULSE_CONFIRMED', receipt.memoryRecordId);
        } else {
            console.warn('[DIVA_MORADA_STATUS]', 'PULSE_NOT_CONFIRMED', receipt?.status);
        }

    } catch (error) {
        console.error('[DIVA_MORADA_ERROR]', error?.message || 'UNKNOWN');
    }
});