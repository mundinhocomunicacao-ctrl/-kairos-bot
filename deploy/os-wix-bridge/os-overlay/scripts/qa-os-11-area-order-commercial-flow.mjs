import fs from 'node:fs';
import assert from 'node:assert/strict';
import {OS_11_AREA_OPERATIONAL_MAP,OS_11_AREA_ROWS} from '../data/os-11-area-operational-map.js';

const nav=fs.readFileSync(new URL('../data/os-navigation-contract.js',import.meta.url),'utf8');
const home=fs.readFileSync(new URL('../data/os-home-surface-contract.js',import.meta.url),'utf8');
const globalNav=fs.readFileSync(new URL('../components/CanonicalGlobalNavigation.js',import.meta.url),'utf8');
const social=fs.readFileSync(new URL('../pages/os/social.js',import.meta.url),'utf8');
const propostas=fs.readFileSync(new URL('../pages/os/propostas.js',import.meta.url),'utf8');
const pipeline=fs.readFileSync(new URL('../pages/os/pipeline/index.js',import.meta.url),'utf8');
const areaApi=fs.readFileSync(new URL('../pages/api/os-area-map.js',import.meta.url),'utf8');

const expectedOrder=['inicio','radar','social','ideias','contatos','pipeline','propostas','agenda','pr','workspace','explorer','configuracoes'];
assert.deepEqual([...OS_11_AREA_OPERATIONAL_MAP.order],expectedOrder,'12 areas must follow the approved human-use order');
assert.equal(OS_11_AREA_ROWS.length,12,'exactly twelve primary areas');
for(const group of ['observar','criar','comercial','entregar','conhecimento','sistema']){
  assert.ok(OS_11_AREA_OPERATIONAL_MAP.menuGroups.some(row=>row.id===group),'missing navigation group '+group);
}
assert.equal(OS_11_AREA_OPERATIONAL_MAP.areas.inicio.route,'/os/inicio','canonical Inicio must point to /os/inicio');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.areas.propostas.route,'/os/propostas','Propostas must be a primary area');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.areas.propostas.order,7,'Propostas must follow Pipeline in canonical order');
assert.ok(globalNav.includes("return'propostas'"),'Propostas must resolve as its own global area');
assert.ok(globalNav.includes('data-area-order={meta.order}'),'navigation must expose area order metadata');
assert.ok(home.includes("pr:Object.freeze({"),'PR must be its own human home area');
assert.ok(home.includes("if(p.startsWith('/os/pr'))return'pr'"),'PR path must resolve to PR, not Workspace');
assert.ok(social.includes("fetch('/api/os-morada-flow'"),'Social Insights DIVA must use the unified OS→Morada flow');
assert.ok(!social.includes("fetch('/api/ai'"),'Social Insights must not bypass Morada flow');
assert.ok(propostas.includes("fetch('/api/os-morada-flow'"),'Proposal intelligence must use the unified OS→Morada flow');
assert.ok(!propostas.includes("fetch('/api/ai-bridge'"),'Proposal intelligence must not bypass Morada flow');
assert.ok(pipeline.includes('/os/propostas?context='),'Pipeline must expose Propostas as a contextual capability');
assert.ok(areaApi.includes('johnnyCommercialRules'),'runtime metadata endpoint must expose Johnny commercial rules');
assert.ok(nav.includes('OS_11_AREA_OPERATIONAL_MAP'),'navigation contract must derive from canonical area metadata');

// RED 2026-09-29: intelligent OS crosswalk + Malha + governance metadata.
assert.equal(OS_11_AREA_OPERATIONAL_MAP.intelligenceModel,'DIVA_ANJOS_PANDORA_ATENEU','OS intelligence model must name the coordinated intelligence layer');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.requestWindow.timezone,'America/Sao_Paulo','recent-request mapping must be time-zone explicit');
assert.ok(Array.isArray(OS_11_AREA_OPERATIONAL_MAP.recentRequestCrosswalk),'recent requests must be projected as a cross-area graph');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.recentRequestCrosswalk.some(row=>row.id==='REQ-20260929-OS-INTELLIGENT-VERSION'),'current intelligent OS request must be mapped');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.recentRequestCrosswalk.some(row=>row.id==='REQ-20260929-JOHNNY-COMMERCIAL'),'Johnny commercial request cluster must be mapped');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.primaryArea,false,'Sala da Malha remains transversal, not a 12th primary area');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.route,'/os/malha','Sala da Malha must expose the canonical OS route');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.orchestrator,'DIVA','DIVA must orchestrate the Sala da Malha');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.provenance,'PANDORA','PANDORA must govern provenance');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.learning,'ATENEU','ATENEU must receive learning');
assert.equal(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.support,true,'Sala da Malha must explicitly operate as a support layer');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.supportModes.includes('HELP'),'Sala da Malha support must include HELP');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.supportModes.includes('SYNC_AND_HELP'),'Sala da Malha support must include SYNC_AND_HELP');
assert.deepEqual([...OS_11_AREA_OPERATIONAL_MAP.systemAreas.malha.supportsAreas],expectedOrder,'Sala da Malha support must span all twelve primary areas');
for(const row of OS_11_AREA_ROWS){
  assert.ok(row.metadata,'every primary area must expose intelligence metadata');
  assert.ok(Array.isArray(row.metadata.inputs)&&row.metadata.inputs.length,'every area must declare inputs');
  assert.ok(Array.isArray(row.metadata.outputs)&&row.metadata.outputs.length,'every area must declare outputs');
  assert.ok(Array.isArray(row.metadata.agents)&&row.metadata.agents.includes('ANJOS'),'every area must be executable by ANJOS under DIVA');
  assert.equal(row.metadata.provenance,'PANDORA','every area must declare PANDORA provenance');
  assert.equal(row.metadata.learning,'ATENEU','every area must declare ATENEU learning');
  assert.equal(row.metadata.time,'KAIROS','every area must declare KAIROS temporal semantics');
}
assert.ok(OS_11_AREA_OPERATIONAL_MAP.johnnyCommercialRequests.some(x=>x==='DASHBOARD_RESPONSE_AND_FOLLOWUP_VISIBILITY'),'Johnny dashboard visibility request must be preserved');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.johnnyCommercialRequests.some(x=>x==='AUTO_NEXT_ACTION_OWNER_DASHBOARD_UPDATE'),'commercial event ingestion must create next action, owner and dashboard update');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.johnnyRecentCommercialActivity.some(x=>x.brand==='Amo Beleza'),'Amo Beleza outreach must be mapped from recent Johnny activity');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.johnnyRecentCommercialActivity.some(x=>x.brand==='Authentic Beauty Concept'),'Authentic Beauty Concept outreach must be mapped');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.johnnyRecentCommercialActivity.some(x=>x.brand==='Adaptogen Science'),'Adaptogen Science outreach must be mapped');
assert.ok(OS_11_AREA_OPERATIONAL_MAP.johnnyRecentCommercialActivity.every(x=>x.provenance&&x.occurredAt),'recent commercial activity must preserve provenance and time');
assert.ok(areaApi.includes('recentRequestCrosswalk'),'runtime API must expose recent request crosswalk');
assert.ok(areaApi.includes('systemAreas'),'runtime API must expose Sala da Malha system metadata');
assert.ok(areaApi.includes('johnnyCommercialRequests'),'runtime API must expose Johnny commercial request cluster');

console.log('QA_OS_12_AREA_ORDER_AND_COMMERCIAL_FLOW PASS');
