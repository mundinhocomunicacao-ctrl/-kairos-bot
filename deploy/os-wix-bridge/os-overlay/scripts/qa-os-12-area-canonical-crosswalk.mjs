import fs from 'node:fs';
import assert from 'node:assert/strict';
import {OS_12_AREA_OPERATIONAL_MAP,OS_12_AREA_ROWS} from '../data/os-12-area-operational-map.js';
import * as legacy from '../data/os-11-area-operational-map.js';

const expected=['inicio','radar','social','ideias','contatos','pipeline','propostas','agenda','pr','workspace','explorer','configuracoes'];
assert.deepEqual([...OS_12_AREA_OPERATIONAL_MAP.order],expected);
assert.equal(OS_12_AREA_ROWS.length,12);
assert.equal(OS_12_AREA_OPERATIONAL_MAP.areas.inicio.label,'Início / Morada');
assert.equal(OS_12_AREA_OPERATIONAL_MAP.areas.inicio.humanSurface,'MORADA_HUMAN_APPROVED_COPY');
assert.equal(OS_12_AREA_OPERATIONAL_MAP.areas.propostas.order,7);
assert.ok(OS_12_AREA_OPERATIONAL_MAP.menuGroups.find(x=>x.id==='comercial').areas.includes('propostas'));
assert.equal(OS_12_AREA_OPERATIONAL_MAP.workflow.optionalBranches.pr.required,false);
assert.equal(OS_12_AREA_OPERATIONAL_MAP.workflow.optionalBranches.pr.trigger,'ONLY_WHEN_PR_ADHERENCE_EXISTS');
assert.deepEqual([...OS_12_AREA_OPERATIONAL_MAP.systemAreas.malha.supportsAreas],expected);
assert.equal(legacy.OS_12_AREA_OPERATIONAL_MAP,OS_12_AREA_OPERATIONAL_MAP,'legacy shim must re-export canonical contract');
const shim=fs.readFileSync(new URL('../data/os-11-area-operational-map.js',import.meta.url),'utf8');
assert.ok(shim.includes("export * from './os-12-area-operational-map.js'"));
console.log('QA_OS_12_AREA_CANONICAL_CROSSWALK PASS');
