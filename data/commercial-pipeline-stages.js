export const COMMERCIAL_PIPELINE_STAGES = Object.freeze([
  ['signal', 'sinal'],
  ['lead', 'lead'],
  ['contact_found', 'contato encontrado'],
  ['contact_shared', 'contato compartilhado'],
  ['contact_validated', 'contato validado'],
  ['introduction', 'introdução'],
  ['human_response', 'resposta humana'],
  ['interest', 'interesse'],
  ['material_requested', 'material solicitado'],
  ['material_sent', 'material enviado'],
  ['forwarded_internally', 'encaminhado internamente'],
  ['casting', 'casting'],
  ['budget_requested', 'budget solicitado'],
  ['proposal', 'orçamento'],
  ['counterproposal', 'contraproposta'],
  ['negotiation', 'negociação'],
  ['preselected', 'pré-seleção'],
  ['commercially_approved', 'aprovado comercialmente'],
  ['procurement', 'procurement'],
  ['contract_po', 'contrato/PO'],
  ['closed', 'fechado'],
  ['production', 'produção'],
  ['creative_approval', 'aprovação criativa'],
  ['published_delivered', 'publicado/entregue'],
  ['invoiced', 'faturado'],
  ['paid', 'pago']
].map(([id, label], index) => Object.freeze({ id, label, index })));

export const POST_PIPELINE_STATES = Object.freeze([
  Object.freeze({ id: 'post_campaign_relationship', label: 'pós-campanha/relacionamento' })
]);

const ALIASES = new Map([
  ['interesse inicial', 'interest'],
  ['casting/mapeamento', 'casting'],
  ['mapeamento', 'casting'],
  ['orçamento apresentado', 'proposal'],
  ['orcamento apresentado', 'proposal'],
  ['proposta', 'proposal'],
  ['procurement/documentação', 'procurement'],
  ['procurement/documentacao', 'procurement'],
  ['contrato', 'contract_po'],
  ['po', 'contract_po'],
  ['publicado', 'published_delivered'],
  ['entregue', 'published_delivered'],
  ['pós-campanha/relacionamento', 'post_campaign_relationship'],
  ['pos-campanha/relacionamento', 'post_campaign_relationship']
]);

function norm(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const BY_ID = new Map(COMMERCIAL_PIPELINE_STAGES.map(stage => [stage.id, stage]));
const BY_LABEL = new Map(COMMERCIAL_PIPELINE_STAGES.map(stage => [norm(stage.label), stage]));
const POST_BY_ID = new Map(POST_PIPELINE_STATES.map(stage => [stage.id, stage]));

export function resolveCommercialStage(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { valid: false, reason: 'stage-missing', raw };

  if (BY_ID.has(raw)) return { valid: true, stage: BY_ID.get(raw), source: 'id', raw };
  if (POST_BY_ID.has(raw)) return { valid: true, stage: POST_BY_ID.get(raw), source: 'post-pipeline-id', postPipeline: true, raw };

  const normalized = norm(raw);
  if (BY_LABEL.has(normalized)) return { valid: true, stage: BY_LABEL.get(normalized), source: 'canonical-label', raw };

  const aliasId = ALIASES.get(normalized);
  if (aliasId && BY_ID.has(aliasId)) return { valid: true, stage: BY_ID.get(aliasId), source: 'alias', raw };
  if (aliasId && POST_BY_ID.has(aliasId)) return { valid: true, stage: POST_BY_ID.get(aliasId), source: 'post-pipeline-alias', postPipeline: true, raw };

  return { valid: false, reason: 'unknown-stage', raw, normalized };
}

export function compareCommercialStages(a, b) {
  const left = resolveCommercialStage(a);
  const right = resolveCommercialStage(b);
  if (!left.valid || !right.valid || left.postPipeline || right.postPipeline) {
    return { comparable: false, left, right };
  }
  return { comparable: true, delta: right.stage.index - left.stage.index, left: left.stage, right: right.stage };
}

export function validateCommercialStageTransition({ from, to, evidence, correctionReason, provenance } = {}) {
  const left = resolveCommercialStage(from);
  const right = resolveCommercialStage(to);
  if (!left.valid) return { valid: false, reason: 'invalid-from-stage', detail: left };
  if (!right.valid) return { valid: false, reason: 'invalid-to-stage', detail: right };
  if (left.postPipeline || right.postPipeline) {
    return { valid: false, reason: 'post-pipeline-state-is-not-commercial-stage', from: left, to: right };
  }

  const delta = right.stage.index - left.stage.index;
  if (delta === 0) return { valid: true, kind: 'idempotent', from: left.stage, to: right.stage };

  const hasEvidence = Boolean(String(evidence ?? '').trim());
  const hasProvenance = Boolean(String(provenance ?? '').trim());
  if (delta > 0) {
    if (!hasEvidence || !hasProvenance) return { valid: false, reason: 'forward-transition-requires-evidence-and-provenance', from: left.stage, to: right.stage };
    return { valid: true, kind: delta === 1 ? 'forward' : 'forward-skip', skipped: Math.max(0, delta - 1), from: left.stage, to: right.stage };
  }

  const correction = String(correctionReason ?? '').trim();
  if (!correction || !hasProvenance) {
    return { valid: false, reason: 'backward-transition-requires-correction-and-provenance', from: left.stage, to: right.stage };
  }
  return { valid: true, kind: 'correction-or-reopen', from: left.stage, to: right.stage, correctionReason: correction };
}

export function createCommercialStageEvent({ entityId, from, to, evidence, provenance, correctionReason, occurredAt } = {}) {
  const validation = validateCommercialStageTransition({ from, to, evidence, provenance, correctionReason });
  if (!validation.valid) return { valid: false, validation };
  const entity = String(entityId ?? '').trim();
  if (!entity) return { valid: false, validation, reason: 'entity-id-missing' };
  return {
    valid: true,
    event: {
      type: 'commercial_stage_transition',
      entityId: entity,
      from: validation.from.id,
      to: validation.to.id,
      kind: validation.kind,
      occurredAt: occurredAt || null,
      evidence: evidence || null,
      provenance: provenance || null,
      correctionReason: correctionReason || null,
      appendOnly: true
    }
  };
}
