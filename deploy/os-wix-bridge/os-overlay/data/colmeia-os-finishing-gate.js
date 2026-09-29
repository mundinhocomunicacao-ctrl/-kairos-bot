export const COLMEIA_OS_FINISHING_GATE=Object.freeze({
  version:'2026-09-29.colmeia-os-finishing-v1',
  orchestrator:'DIVA',
  provenance:'PANDORA',
  learning:'ATENEU',
  time:'KAIROS',
  truth:'MUNDO',
  cells:Object.freeze([
    Object.freeze({id:'COL-01',focus:'SOCIAL',role:'Conteúdo, sinal, curva, corroboration e visibilidade da evidência.'}),
    Object.freeze({id:'COL-02',focus:'PR_IMAGEM',role:'Narrativa, clipping, apresentação e consequência pública.'}),
    Object.freeze({id:'COL-03',focus:'CULTURA_MUNDO',role:'Contexto, causalidade, propagação e mudança cultural.'}),
    Object.freeze({id:'COL-04',focus:'MERCADO_COMERCIAL',role:'Fit, relação, rota, pipeline, follow-up e consequência econômica.'}),
    Object.freeze({id:'COL-05',focus:'PRODUTO_SISTEMA',role:'Usabilidade, navegação, metadados, QA, integrações e regressão.'})
  ]),
  checks:Object.freeze([
    'TWELVE_PRIMARY_AREAS_ONLY',
    'MALHA_SUPPORTS_ALL_AREAS',
    'VISIBLE_MEDIA_FIRST',
    'GROUPING_NE_HIDING',
    'SOURCE_LINK_ALWAYS_VISIBLE',
    'NO_EMPTY_DECORATIVE_CARDS',
    'METADATA_INPUT_OUTPUT_PROVENANCE_LEARNING_TIME',
    'JOHNNY_COMMERCIAL_REQUESTS_MAPPED',
    'POWER_BI_IS_PROJECTION_NOT_TRUTH',
    'AGENT_ACCOUNT_STATE_EXPLICIT',
    'NO_EXTERNAL_ACCOUNT_CLAIM_WITHOUT_EVIDENCE',
    'SOCIAL_TO_IDEAS_PR_PIPELINE_HANDOFFS',
    'MOBILE_AND_DESKTOP_NAV_CONSISTENCY',
    'RECEIPT_REREAD_BEFORE_PROMOTION'
  ]),
  reviewSequence:Object.freeze([
    'OBSERVE',
    'CHALLENGE',
    'CORROBORATE',
    'FIX',
    'RECHECK',
    'DIVA_VALIDATE',
    'PANDORA_RECEIPT',
    'ATENEU_LEARNING'
  ]),
  releaseRule:'NO_PASS_BY_DECLARATION__CODE_AND_RUNTIME_EVIDENCE_REQUIRED'
});