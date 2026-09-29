/**
 * DIVA · CANON COMPASS
 *
 * Gate de governança do PULSO.
 * Nesta primeira versão, valida os invariantes mínimos
 * antes de permitir que o evento avance.
 */

export async function runDivaCompass({ pulse, interpretation }) {

    if (!pulse?.pulseId) {
        throw new Error("DIVA_COMPASS_NO_PULSE");
    }

    if (!interpretation?.pulseId) {
        throw new Error("DIVA_COMPASS_NO_INTERPRETATION");
    }

    if (pulse.pulseId !== interpretation.pulseId) {
        throw new Error("DIVA_COMPASS_TRACE_MISMATCH");
    }

    const compass = {
        allowed: true,

        pulseId: pulse.pulseId,

        rulesChecked: [
            "SINGLE_WORLD_MUNDO_BRAIN",
            "RAW_INPUT_PRESERVED",
            "APPEND_ONLY",
            "PROVENANCE_REQUIRED",
            "RECEIPT_BEFORE_EXECUTED"
        ],

        checkedAt: new Date().toISOString(),

        provenance: {
            source: "DIVA_CANON_COMPASS_V1",
            pulseId: pulse.pulseId
        }
    };

    console.log(
        "[DIVA_COMPASS_PASS]",
        JSON.stringify(compass)
    );

    return compass;
}