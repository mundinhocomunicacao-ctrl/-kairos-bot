import {DIVA_QUALITATIVE_DNA_VERSION} from './diva-qualitative-dna';
import {DIVA_VOICE_PRESENCE_CONTRACT} from './diva-voice-presence-contract';

export const DIVA_ORBI_PARITY_VERSION='diva-orbi-parity-v1';
export const DIVA_ORBI_VISUAL_VERSION='diva-official-v1';
export const DIVA_ORBI_INTERFACE_VERSION='diva-orbi-interface-v1';

export const DIVA_ORBI_PARITY_CONTRACT=Object.freeze({
  version:DIVA_ORBI_PARITY_VERSION,
  authority:'DIVA_RAIZ',
  principle:'ONE_DIVA_ONE_DNA_N_EQUIVALENT_ORBS',
  dnaVersion:DIVA_QUALITATIVE_DNA_VERSION,
  interfaceVersion:DIVA_ORBI_INTERFACE_VERSION,
  visualVersion:DIVA_ORBI_VISUAL_VERSION,
  voicePresenceVersion:DIVA_VOICE_PRESENCE_CONTRACT.id,
  visualMaster:'components/DivaAvatar2D.js',
  behaviorMaster:'data/diva-voice-presence-contract.js',
  memoryMaster:'lib/diva-face-sync.mjs',
  canonicalFaces:Object.freeze(['DIVA_RAIZ','MUNDO_ASSESSORIA','MUNDO_MARKETING','MUNDO_CREATOR','MUNDO_PR','DIVA_GABI']),
  specializationOnlyBy:Object.freeze(['domain','tools','sources','permissions','operational_context','specialized_capabilities','access_limits','safety_filters','data_visibility']),
  forbidden:Object.freeze(['NEW_FACE','INDEPENDENT_PERSONALITY','PARALLEL_SOVEREIGNTY','COMPETING_MEMORY','VISUAL_DRIFT','INTERACTION_DRIFT','SPECIALTY_AS_IDENTITY','MORADA_SIDE_EFFECT']),
  excludedChangeTracks:Object.freeze(['MORADA']),
  conflictPolicy:'LATEST_APPROVED_HUMAN_CORRECTION_THEN_MASTER_THEN_WRITTEN_RULE_THEN_HISTORY_THEN_INFERENCE',
  completionGate:Object.freeze(['WRITE','RECEIPT','REREAD','COMPARE_MASTER','QA_PASS'])
});
