import wixData from 'wix-data';
import { sendPandoraMissionToMalhaInternal } from './divaBridge.web';

const COLLECTION='DIVA_MEMORY_WRITEBACK_V1';
const EXEC_EVENT='diva.morada.pandora.mission.execute';
const EXEC_STATUS='EXECUTE_REQUESTED';

export async function DIVA_MEMORY_WRITEBACK_V1_afterInsert(item, context) {
    try {
        if (String(item?.eventType || '') !== EXEC_EVENT) return item;
        if (String(item?.status || '') !== EXEC_STATUS) return item;

        const payload = item?.payload && typeof item.payload === 'object' ? item.payload : {};
        const missionId = String(payload?.missionId || '').trim().slice(0, 200);
        const missionKey = String(payload?.missionKey || '').trim().slice(0, 260);
        const text = String(payload?.text || payload?.message || '').trim().slice(0, 12000);
        const triggerEventId = String(item?.eventId || '').trim().slice(0, 200);

        if (!missionId || !missionKey || !text) return item;

        const result = await sendPandoraMissionToMalhaInternal({ missionId, missionKey, text });

        await wixData.insert(COLLECTION, {
            eventType: 'diva.morada.pandora.mission.execution.receipt',
            title: 'PANDORA · MORADA MACHINE EXECUTION RECEIPT',
            description: 'Resultado automático do hook de execução PANDORA no backend Wix.',
            domain: 'morada-malha',
            status: result?.ok ? 'EXECUTION_VERIFIED' : 'EXECUTION_FAILED',
            epistemicState: 'OBSERVED_EVENT',
            eventId: 'PANDORA_EXEC_RECEIPT_' + Date.now(),
            source: 'MORADA_BACKEND',
            validation: result?.ok ? 'PANDORA_MACHINE_EXECUTION_PROOF' : 'PANDORA_MACHINE_EXECUTION_FAILURE',
            payload: {
                missionId,
                missionKey,
                triggerEventId: triggerEventId || null,
                gatewayMissionId: result?.gatewayMissionId || null,
                authority: result?.authority || null,
                grantId: result?.grantId || null,
                httpStatus: result?.httpStatus || null,
                executionStatus: result?.status || null,
                answer: result?.answer || null,
                executedAt: new Date().toISOString()
            }
        }, { suppressAuth: true, suppressHooks: true });
    } catch (error) {
        console.error('[PANDORA_LEDGER_HOOK_ERROR]', error?.message || 'HOOK_FAILED');
    }
    return item;
}
