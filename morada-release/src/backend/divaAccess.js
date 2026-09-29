/**
 * DIVA · MORADA ACCESS V1
 * Arquivo NOVO: backend/divaAccess.js
 *
 * Gate único de identidade da Morada (deny-by-default).
 * Só libera quem tem match EXATO em DIVA_MORADA_ACCESS_V1:
 *   memberId + loginEmail + status AUTHORIZED + accessLevel OWNER
 *   + policyKey MORADA_OWNER + routeRef DIVA_MORADA_WORKSPACE
 *
 * Nunca devolve e-mail, memberId ou a allowlist.
 * Devolve no máximo: { authorized, identityKey, role }.
 */

import wixData from 'wix-data';
import { currentMember } from 'wix-members-backend';

const ACCESS_COLLECTION = 'DIVA_MORADA_ACCESS_V1';

const DENIED = Object.freeze({
    authorized: false,
    identityKey: null,
    role: null
});

export async function resolveMoradaOwner() {

    let member;

    try {
        member = await currentMember.getMember({ fieldsets: ['FULL'] });
    } catch (error) {
        return { ...DENIED, reason: 'NO_MEMBER' };
    }

    if (!member || !member._id) {
        return { ...DENIED, reason: 'NO_MEMBER' };
    }

    const memberId = String(member._id);
    const email = String(member.loginEmail || '').trim().toLowerCase();

    if (!email) {
        return { ...DENIED, reason: 'NO_LOGIN_EMAIL' };
    }

    let result;

    try {
        result = await wixData
            .query(ACCESS_COLLECTION)
            .eq('status', 'AUTHORIZED')
            .eq('accessLevel', 'OWNER')
            .eq('policyKey', 'MORADA_OWNER')
            .eq('routeRef', 'DIVA_MORADA_WORKSPACE')
            .limit(50)
            .find({ suppressAuth: true });
    } catch (error) {
        console.error('[DIVA_ACCESS_LOOKUP_ERROR]', error?.message);
        return { ...DENIED, reason: 'LOOKUP_FAILED' };
    }

    const match = (result?.items || []).find(record =>
        String(record.memberId || '') === memberId &&
        String(record.loginEmail || '').trim().toLowerCase() === email
    );

    if (!match) {
        return { ...DENIED, reason: 'NOT_IN_ALLOWLIST' };
    }

    return {
        authorized: true,
        identityKey: match._id,
        role: match.accessLevel
    };
}