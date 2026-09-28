/**
 * DIVA · MORADA · NATIVE CANARY HOOK
 * Temporary native Wix trigger used to prove the first cognitive round-trip.
 * Safe by exact canary key; unrelated automation rows pass through untouched.
 */

import { runDivaBrainTransport } from './divaBridge.web';
import { receiveDivaPulse } from './divaPulse';

const CANARY_KIND = 'DIVA_BRAIN_CANARY';
const CANARY_KEY = 'DIVA_CANARY_20260927';

export async function DIVA_MORADA_AUTOMATION_V1_afterInsert(item, context) {
    if (item?.kind !== CANARY_KIND || item?.canaryKey !== CANARY_KEY) {
        return item;
    }

    try {
        const result = await runDivaBrainTransport(
            { text: CANARY_KEY, history: [] },
            'MORADA_OWNER_CANARY'
        );

        let receipt = null;

        if (result?.ok === true) {
            const pulseReceipt = await receiveDivaPulse({
                source: 'DIVA_MORADA_BRAIN',
                channel: 'WIX_DATA_HOOK',
                type: 'SYSTEM_EVENT',
                intent: 'MEMORY_WRITE',
                message: 'DIVA_REPLY_RECEIPT',
                surface: '/cópia-sobre-mim',
                identityKey: 'MORADA_OWNER',
                data: {
                    requestId: item?._id || CANARY_KEY,
                    requestTag: CANARY_KEY,
                    provider: result.provider || null,
                    model: result.model || null,
                    messageId: result.messageId || null,
                    brainStatus: result.status || null,
                    transport: 'WIX_NATIVE_DATA_HOOK_V1'
                }
            });

            receipt = {
                ok: pulseReceipt?.ok === true,
                status: pulseReceipt?.status || null,
                pulseId: pulseReceipt?.pulseId || null,
                memoryRecordId: pulseReceipt?.memoryRecordId || null
            };
        }

        item.canaryResult = {
            ok: result?.ok === true,
            status: result?.status || 'UNKNOWN',
            provider: result?.provider || null,
            model: result?.model || null,
            messageIdPresent: !!result?.messageId,
            replyPresent: typeof result?.text === 'string' && result.text.length > 0,
            receipt
        };

        return item;
    } catch (error) {
        item.canaryResult = {
            ok: false,
            status: 'CANARY_HOOK_ERROR',
            error: String(error?.message || 'UNKNOWN')
        };
        return item;
    }
}
