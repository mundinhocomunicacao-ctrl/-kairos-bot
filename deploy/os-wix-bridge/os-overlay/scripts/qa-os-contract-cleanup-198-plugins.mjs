import fs from 'node:fs';
import assert from 'node:assert/strict';

assert.ok(fs.existsSync('data/os-12-area-operational-map.js'),'canonical 12-area contract file must exist');
const canonical=fs.readFileSync('data/os-12-area-operational-map.js','utf8');
assert.ok(canonical.includes("export const OS_12_AREA_OPERATIONAL_MAP"),'12-area export required');
assert.ok(canonical.includes("mode:'LINEAR_WITH_CONTEXTUAL_BRANCHES'"),'workflow must stay contextual');
assert.ok(canonical.includes("pr:Object.freeze({next:'workspace'"),'PR handoff may exist visually');
assert.ok(canonical.includes("optionalBranches"),'workflow must declare optional branches');
assert.ok(canonical.includes("pr:Object.freeze({required:false"),'PR must be explicitly non-mandatory');

const legacy=fs.readFileSync('data/os-11-area-operational-map.js','utf8');
assert.ok(legacy.includes("export * from './os-12-area-operational-map.js'"),'legacy file must be compatibility shim only');

const plugins=fs.readFileSync('data/os-plugin-capability-fabric.js','utf8');
assert.ok(plugins.includes("inventoryType:'PLUGINS'"),'198 inventory must be explicitly typed as plugins');
assert.ok(plugins.includes("historicalPluginInventory:198"),'historical inventory must be named as plugins');
assert.ok(plugins.includes("catalogMeaning:'CATALOGED_PLUGIN_NE_CONNECTED_AUTHORIZED_OR_PROVEN'"),'catalog semantics must distinguish catalog from runtime readiness');
assert.ok(plugins.includes("flow:Object.freeze(['NEED','ALEXANDRIA_198_PLUGINS'"),'flow must explicitly route through Alexandria 198 plugins');

console.log('QA_OS_CONTRACT_CLEANUP_198_PLUGINS PASS');
