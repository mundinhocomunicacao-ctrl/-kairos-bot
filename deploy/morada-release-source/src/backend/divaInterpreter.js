/**
 * DIVA · INTERPRETER
 * Transforma um PULSO bruto em uma interpretação estruturada.
 * O rawInput original permanece intacto.
 */

export async function interpretDivaPulse(pulse) {

    if (!pulse?.pulseId) {
        throw new Error("DIVA_INVALID_PULSE");
    }

    const rawInput = pulse.rawInput;

    const interpretation = {
        pulseId: pulse.pulseId,

        intent: detectIntent(rawInput),

        entities: extractEntities(rawInput),

        confidence: 1,

        provenance: {
            source: pulse.source,
            pulseId: pulse.pulseId,
            interpretedAt: new Date().toISOString(),
            interpreter: "DIVA_INTERPRETER_V1"
        }
    };

    console.log(
        "[DIVA_INTERPRETATION]",
        JSON.stringify(interpretation)
    );

    return interpretation;
}


function detectIntent(rawInput) {

    if (rawInput?.intent) {
        return String(rawInput.intent).toUpperCase();
    }

    if (rawInput?.message || rawInput?.text) {
        return "HUMAN_INPUT";
    }

    return "UNCLASSIFIED";
}


function extractEntities(rawInput) {

    if (!rawInput || typeof rawInput !== "object") {
        return [];
    }

    return Object.keys(rawInput)
        .filter(key =>
            !["message", "text", "intent"].includes(key)
        )
        .map(key => ({
            key,
            value: rawInput[key]
        }));
}