/**
 * DIVA · DECISION ROUTER
 *
 * Recebe PULSO + interpretação + bússola.
 * Só permite avanço quando o Compass autoriza.
 */

export async function routeDivaDecision({
    pulse,
    interpretation,
    compass
}) {

    if (!pulse?.pulseId) {
        throw new Error("DIVA_ROUTER_NO_PULSE");
    }

    if (!compass?.allowed) {
        return {
            ok: false,
            status: "BLOCKED",
            pulseId: pulse.pulseId,
            reason: "CANON_FAILURE"
        };
    }

    const intent = interpretation?.intent || "UNCLASSIFIED";

    let destination;

    switch (intent) {

        case "HUMAN_INPUT":
            destination = "DIVA_PROCESS";
            break;

        case "MEMORY_WRITE":
            destination = "MEMORY_WRITE";
            break;

        case "WIX_ACTION":
            destination = "WIX_ACTION";
            break;

        default:
            destination = "NEEDS_CLASSIFICATION";
    }

    const decision = {
        ok: true,
        status: "ROUTED",
        pulseId: pulse.pulseId,
        intent,
        destination,

        routedAt: new Date().toISOString(),

        provenance: {
            source: "DIVA_DECISION_ROUTER_V1",
            pulseId: pulse.pulseId
        }
    };

    console.log(
        "[DIVA_ROUTED]",
        JSON.stringify(decision)
    );

    return decision;
}