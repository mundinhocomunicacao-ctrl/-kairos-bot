import assert from 'node:assert/strict';
import {OS_PLUGIN_CAPABILITY_FABRIC,capabilityFabricSummary} from '../data/os-plugin-capability-fabric.js';

const s=capabilityFabricSummary();
assert.equal(s.historicalInventory,198);
assert.equal(s.classified+ s.unresolved,198);
assert.equal(Object.keys(OS_PLUGIN_CAPABILITY_FABRIC.areaRouting).length,12);
assert.equal(OS_PLUGIN_CAPABILITY_FABRIC.inventoryType,'PLUGINS');
assert.equal(OS_PLUGIN_CAPABILITY_FABRIC.historicalPluginInventory,198);
assert.equal(OS_PLUGIN_CAPABILITY_FABRIC.catalogMeaning,'CATALOGED_PLUGIN_NE_CONNECTED_AUTHORIZED_OR_PROVEN');
assert.equal(OS_PLUGIN_CAPABILITY_FABRIC.buildFabric.purpose,'CONSTRUCT_TEST_RELEASE_OBSERVE_OS');
assert.equal(OS_PLUGIN_CAPABILITY_FABRIC.operationFabric.purpose,'RUN_THE_12_OS_AREAS_AND_7_QUEUES_DAILY');
assert.equal(Object.keys(OS_PLUGIN_CAPABILITY_FABRIC.queueRouting).length,7);
assert.equal(s.queues,7);
assert.deepEqual(OS_PLUGIN_CAPABILITY_FABRIC.flow,[
  'NEED','ALEXANDRIA','RUNTIME','MATCH','AUTH','TEST','RECEIPT','LEARN','DNA'
]);
for(const [queue,row] of Object.entries(OS_PLUGIN_CAPABILITY_FABRIC.queueRouting)){
  assert.ok(row.angel.startsWith('ANJO '),queue+' must have one canonical ANJO');
  assert.ok(row.families.length>=2,queue+' must use Alexandria capability families');
  assert.ok(row.preferredPlugins.length>=4,queue+' must have operational plugin routes');
}
for(const [area,row] of Object.entries(OS_PLUGIN_CAPABILITY_FABRIC.areaRouting)){
  assert.ok(row.capabilityFamilies.length>=2,area+' must use multiple capability families');
  assert.ok(row.preferredPlugins.length>=1,area+' must expose preferred plugin classes');
}
assert.equal(OS_PLUGIN_CAPABILITY_FABRIC.proofPolicy,'PROVE_BEFORE_PROMOTE');
assert.equal(OS_PLUGIN_CAPABILITY_FABRIC.uiPolicy,'SURFACE_CAPABILITIES_NOT_CATALOG_DUMP');
console.log('QA_OS_PLUGIN_CAPABILITY_FABRIC PASS',s);