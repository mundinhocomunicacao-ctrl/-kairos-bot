// MUNDO / ALEXANDRIA / SHARED BODY CONSTRUCTION MEMORY
import {MUNDINHO_BODY_CONSTRUCTION} from './mundinho-body-construction.js';
export const AGENT_BODY_CONSTRUCTION_MEMORY=Object.freeze({
 version:'agent-body-construction-memory-v1.0',canonicalIndex:'ALEXANDRIA',
 sourceContract:'data/mundinho-body-construction.js',
 knowledgeMode:'REFERENCE_NOT_COPY',
 universalRule:'EVERY_AGENT_KNOWS_THE_WHOLE_BODY_AND_BUILDS_ITS_OWN_PART',
 autonomyRule:'AUTONOMY_IS_EARNED_BY_EVIDENCE',
 sharedKnowledge:Object.freeze({
  brain:MUNDINHO_BODY_CONSTRUCTION.brain,
  mind:MUNDINHO_BODY_CONSTRUCTION.mind,
  constructionMethod:MUNDINHO_BODY_CONSTRUCTION.constructionMethod,
  stages:MUNDINHO_BODY_CONSTRUCTION.stages.map(x=>x.system)
 }),
 buildContract:Object.freeze(['IDENTIFY_MY_BODY_PART','READ_CANONICAL_CONTRACT','RESOLVE_DEPENDENCIES','BUILD_BOUNDED_PART','PRODUCE_EVIDENCE','REREAD_OR_TEST','RETURN_RECEIPT','HANDOFF_TO_NEXT_PART','LEARN_FROM_OUTCOME']),
 rules:Object.freeze([
  'NO_AGENT_OWNS_PARALLEL_TRUTH','NO_AGENT_BUILDS_OUTSIDE_AUTHORIZED_CAPABILITY',
  'EVERY_BUILD_HAS_PROVENANCE','EVERY_MATERIAL_BUILD_HAS_TEST_OR_REREAD',
  'FAILURE_RETURNS_EVIDENCE_NOT_SILENCE','LEARNING_RETURNS_TO_ATENEU',
  'INDEX_RETURNS_TO_ALEXANDRIA','HISTORY_RETURNS_TO_PANDORA'
 ])
});
export function bodyConstructionMemoryForAgent(agent={}){
 return Object.freeze({agentId:agent.id||null,role:agent.role||agent.capability||null,
  canonicalKnowledge:'ALEXANDRIA→BODY_CONSTRUCTION',wholeBodyAwareness:true,
  responsibility:'BUILD_ONLY_MY_AUTHORIZED_PART',buildContract:AGENT_BODY_CONSTRUCTION_MEMORY.buildContract,
  evidenceRequired:true,handoffRequired:true});
}
