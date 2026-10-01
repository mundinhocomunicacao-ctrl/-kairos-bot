import { NANOAGENT_REGISTRY } from './nanoagent-registry.js';

export const MAESTRO_ELASTIC_NANOAGENT_POOL=Object.freeze({
  version:'2026-09-25.v2',
  owner:'MAESTRO',
  reportsTo:'DIVA',
  logicalRegistrySize:NANOAGENT_REGISTRY.length,
  maxConcurrentWorkers:150,
  defaultActiveWorkers:0,
  allocationMode:'ELASTIC_ON_DEMAND',
  authority:'MISSION_SINGLE_AUTHORITY',
  aggregation:'CONECTOR',
  provenance:'PANDORA',
  rules:Object.freeze([
    'NO_DUPLICATE_ACTIVE_MISSION',
    'INDEPENDENT_SUBTASKS_ONLY',
    'CAPABILITY_MATCH_REQUIRED',
    'BOUNDED_RETRY',
    'IDEMPOTENT_EFFECTS_ONLY',
    'APPEND_ONLY_RECEIPTS',
    'NO_RUNTIME_VALIDATION_BY_DECLARATION',
    'RETURN_TO_RESERVE_AFTER_MISSION'
  ]),
  canonicalQueues:Object.freeze([
    'social-insights',
    'creator-talent',
    'pr',
    'connections',
    'commercial',
    'prospecting',
    'mundo-products'
  ])
});

export function maestroElasticPoolSummary(){
  return Object.freeze({
    registered:MAESTRO_ELASTIC_NANOAGENT_POOL.logicalRegistrySize,
    maxConcurrent:MAESTRO_ELASTIC_NANOAGENT_POOL.maxConcurrentWorkers,
    activeByDefault:MAESTRO_ELASTIC_NANOAGENT_POOL.defaultActiveWorkers,
    reserve:Math.max(0,MAESTRO_ELASTIC_NANOAGENT_POOL.logicalRegistrySize-MAESTRO_ELASTIC_NANOAGENT_POOL.defaultActiveWorkers),
    runtimeValidated:NANOAGENT_REGISTRY.filter(agent=>agent.runtimeValidated===true).length,
    queues:MAESTRO_ELASTIC_NANOAGENT_POOL.canonicalQueues.length
  });
}
