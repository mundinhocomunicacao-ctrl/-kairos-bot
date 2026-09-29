/**
 * DIVA · MEMORY WRITEBACK V2
 * SUBSTITUI TODO o conteúdo de: backend/divaMemory.js
 *
 * WRITE → REREAD → VERIFY → MEMORY RECEIPT
 *
 * Mudança em relação à V1 (a correção principal):
 *  - o INSERT agora usa { suppressAuth: true }, igual ao reread.
 *    Antes, o insert rodava com a permissão de quem chamou; como a coleção
 *    só aceita escrita de ADMIN, qualquer chamada que não fosse do dono
 *    logado como admin falhava e o circuito caía em DIVA_CIRCUIT_ERROR.
 *  - SEGURANÇA: esta função só é chamada pelo divaPulse, que por sua vez
 *    só é alcançado pelo divaBridge (gate owner) ou pelo http-functions
 *    (gate por segredo). Não exponha writeDivaMemory em arquivo .web.js.
 * Os campos gravados são os mesmos de antes (schema real da coleção).
 */

import wixData from 'wix-data';

const MEMORY_COLLECTION = 'DIVA_MEMORY_WRITEBACK_V1';

export async function writeDivaMemory({ pulse, interpretation } = {}) {

    if (!pulse?.pulseId) {
        throw new Error('DIVA_MEMORY_NO_PULSE_ID');
    }

    if (!interpretation?.pulseId) {
        throw new Error('DIVA_MEMORY_NO_INTERPRETATION');
    }

    if (pulse.pulseId !== interpretation.pulseId) {
        throw new Error('DIVA_MEMORY_TRACE_MISMATCH');
    }

    const timestamp = new Date();

    const memoryRecord = {
        eventId: pulse.pulseId,
        rawInput: JSON.stringify(pulse.rawInput ?? {}),
        interpretation: JSON.stringify(interpretation ?? {}),
        source: pulse.source || 'DIVA_MORADA',
        timestamp,
        provenance: JSON.stringify({
            source: 'DIVA_MEMORY_WRITEBACK_V1',
            pulseId: pulse.pulseId,
            origin: pulse.source || 'DIVA_MORADA',
            channel: pulse.rawInput?.channel || 'UNKNOWN',
            writtenAt: timestamp.toISOString()
        })
    };

    // 1 — WRITE (elevado: execução backend da própria DIVA, já passou pelo gate)
    const written = await wixData.insert(MEMORY_COLLECTION, memoryRecord, { suppressAuth: true });

    if (!written?._id) {
        throw new Error('DIVA_MEMORY_WRITE_NO_ID');
    }

    // 2 — REREAD (consistente, após a escrita)
    const reread = await wixData.get(MEMORY_COLLECTION, written._id, {
        suppressAuth: true,
        consistentRead: true
    });

    // 3 — VERIFY
    const verification = {
        recordIdMatch: reread?._id === written._id,
        eventIdMatch: reread?.eventId === pulse.pulseId,
        rawInputMatch: reread?.rawInput === memoryRecord.rawInput,
        interpretationMatch: reread?.interpretation === memoryRecord.interpretation
    };

    const verified = Object.values(verification).every(Boolean);

    const receipt = {
        ok: verified,
        status: verified ? 'DIVA_MEMORY_CONFIRMED' : 'DIVA_MEMORY_NOT_CONFIRMED',
        eventId: pulse.pulseId,
        recordId: written._id,
        collection: MEMORY_COLLECTION,
        writtenAt: written?._createdDate
            ? new Date(written._createdDate).toISOString()
            : timestamp.toISOString(),
        rereadAt: new Date().toISOString(),
        verification,
        provenance: {
            source: 'DIVA_MEMORY_WRITEBACK_V2',
            pulseId: pulse.pulseId,
            recordId: written._id
        }
    };

    console.log('[DIVA_MEMORY_RECEIPT]', JSON.stringify(receipt));

    if (!verified) {
        throw new Error('DIVA_MEMORY_REREAD_VALIDATION_FAILED');
    }

    return receipt;
}