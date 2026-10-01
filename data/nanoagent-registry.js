import {bodyConstructionMemoryForAgent} from './agent-body-construction-memory.js';
// MUNDO / FORJA / NANOAGENTES
// Canonical logical-worker registry. Nanoagents are bounded micro-capabilities, not strategic personas.
// Historical alias: "nanorobô". Canonical name: NANOAGENTE.

export const NANOAGENT_REGISTRY_VERSION = 'mundo-nanoagents-v3.0-300';

export const NANOAGENT_FAMILIES = Object.freeze([
  Object.freeze({ code: 'A', slug: 'coleta', name: 'Coleta', mission: 'captura sinais e mudanças autorizadas sem interpretar estrategicamente' }),
  Object.freeze({ code: 'B', slug: 'normalizacao', name: 'Normalização', mission: 'normaliza formatos, campos, datas, canais e payloads' }),
  Object.freeze({ code: 'C', slug: 'identidade', name: 'Identidade & Deduplicação', mission: 'resolve identidade, aliases, duplicatas e vínculos sem apagar histórico' }),
  Object.freeze({ code: 'D', slug: 'qualidade', name: 'Qualidade', mission: 'verifica integridade, freshness, contratos, schemas e divergências' }),
  Object.freeze({ code: 'E', slug: 'calculo', name: 'Cálculo', mission: 'executa cálculos determinísticos, scores, contagens e projeções' }),
  Object.freeze({ code: 'F', slug: 'evidencia', name: 'Evidência', mission: 'coleta, ancora e valida provenance, evidências e trilhas de auditoria' }),
  Object.freeze({ code: 'G', slug: 'dashboards', name: 'Dashboards', mission: 'projeta dados governados para cards, filas, painéis e superfícies do OS' }),
  Object.freeze({ code: 'H', slug: 'operacao', name: 'Operação', mission: 'executa retries, health checks, recovery, sincronização e observabilidade' }),
]);

export const NANOAGENT_CAPABILITIES = Object.freeze([
  'watcher','fetcher','freshness','sync','entity-resolver','deduper','reconciler','integrity',
  'retry','recovery','temporal','evidence','indexer','health','noise-filter','contract-check',
  'idempotency','append-only','permission-check','cost-check','queue-check','dead-letter','schema-check',
  'route-check','readiness','persistence-check','reread-check','replay-check','drift-check','orphan-check',
  'latency-check','cache-check','source-check','conflict-check','provenance-check','dashboard-feed',
  'alert-check','handoff-check','rollback-check','smoke-check',
]);

const pad = value => String(value).padStart(3, '0');

const buildNanoagent = index => {
  const ordinal = index + 1;
  const family = NANOAGENT_FAMILIES[index % NANOAGENT_FAMILIES.length];
  const capability = NANOAGENT_CAPABILITIES[Math.floor(index / NANOAGENT_FAMILIES.length) % NANOAGENT_CAPABILITIES.length];
  const shard = Math.floor(index / (NANOAGENT_FAMILIES.length * NANOAGENT_CAPABILITIES.length)) + 1;

  return Object.freeze({
    id: `NA-${pad(ordinal)}`,
    canonicalName: `Nanoagente ${pad(ordinal)} · ${family.name} · ${capability}`,
    type: 'nanoagent',
    historicalAliases: Object.freeze([`nanorobo-${pad(ordinal)}`]),
    family: family.slug,
    familyCode: family.code,
    capability,
    shard,
    reportsTo: 'DIVA',
    governance: Object.freeze({
      structuralAuthority: 'ARQUIVISTA',
      historyAuthority: 'PANDORA/AGENTE_DE_HISTORICO',
      integrityAuthority: 'ZELADOR',
      anomalyEscalation: 'SENTINELA',
      accessAuthority: 'GUARDIAO',
      urgencyAuthority: 'KAIROS',
      costAuthority: 'COST_GUARD',
    }),
    operatingMode: 'logical-worker',
    status: 'ACTIVE_LOGICAL',
    runtimeValidated: false,
    strategicAuthority: false,
    canMutateStructure: false,
    improvementRequiresAuthorization: true,
    costPolicy: 'ZERO_COST_DEFAULT',
    deterministicWhenPossible: true,
    idempotent: true,
    appendOnly: true,
    observable: true,
    restartable: true,
    permissionBounded: true,
    sourceBounded: true,
    timeBounded: true,
    retryPolicy: 'bounded-retry-with-dead-letter',
    provenanceRequired: true,
    sourceContract: `nanoagent://${family.slug}/${capability}/v1`,
    inputContract: Object.freeze(['event', 'context_pack', 'permissions', 'provenance']),
    outputContract: Object.freeze(['result', 'status', 'evidence', 'provenance', 'metrics']),
    bodyConstructionMemory: bodyConstructionMemoryForAgent({id:`NA-${pad(ordinal)}`,capability}),
  });
};

export const NANOAGENT_REGISTRY = Object.freeze(
  Array.from({ length: 300 }, (_, index) => buildNanoagent(index)),
);

export const NANOAGENT_POLICY = Object.freeze({
  canonicalCount: 300,
  canonicalHome: 'MUNDO/03_FORJA/CORE/NANOAGENTES',
  catalog: '00_CATALOGO',
  contracts: '01_CONTRATOS',
  provenance: '02_REGISTRO_E_PROVENANCE',
  aliases: Object.freeze(['nanorobo', 'nanorobos', 'nanoagente', 'nanoagentes']),
  principles: Object.freeze([
    'microcapability-not-strategic-persona','deterministic-when-possible','idempotent','append-only',
    'observable','versioned','restartable','permission-bounded','source-bounded','cost-bounded',
    'time-bounded','retry-with-dead-letter','provenance-required','improvement-requires-human-authorization',
  ]),
});

export function getNanoagent(id) {
  return NANOAGENT_REGISTRY.find(agent => agent.id === id) || null;
}

export function listNanoagentsByFamily(family) {
  return NANOAGENT_REGISTRY.filter(agent => agent.family === family);
}

export function nanoagentRegistrySummary() {
  const byFamily = Object.fromEntries(
    NANOAGENT_FAMILIES.map(family => [
      family.slug,
      NANOAGENT_REGISTRY.filter(agent => agent.family === family.slug).length,
    ]),
  );
  return Object.freeze({
    version: NANOAGENT_REGISTRY_VERSION,
    total: NANOAGENT_REGISTRY.length,
    activeLogical: NANOAGENT_REGISTRY.filter(agent => agent.status === 'ACTIVE_LOGICAL').length,
    runtimeValidated: NANOAGENT_REGISTRY.filter(agent => agent.runtimeValidated).length,
    byFamily: Object.freeze(byFamily),
  });
}
