import fs from 'node:fs';import assert from 'node:assert/strict';
import {OS_NAVIGATION_CONTRACT,CANONICAL_OS_PAGE_IDS,MOBILE_OS_DESTINATION_IDS} from '../data/os-navigation-contract.js';
const nav=fs.readFileSync(new URL('../components/CanonicalGlobalNavigation.js',import.meta.url),'utf8');
const osCatchAllUrl=new URL('../pages/os/[[...slug]].js',import.meta.url);
const osIndexUrl=new URL('../pages/os/index.js',import.meta.url);
const ids=['inicio','radar','social','ideias','contatos','pipeline','propostas','agenda','pr','workspace','explorer','configuracoes'];
const labels=['Início / Morada','Radar','Social Insights','Ideias','Contatos','Pipeline','Propostas','Agenda','PR','Workspace','Explorer','Configurações'];
assert.deepEqual(CANONICAL_OS_PAGE_IDS,ids);
assert.deepEqual(MOBILE_OS_DESTINATION_IDS,[...ids,'malha','diva']);
assert.equal(OS_NAVIGATION_CONTRACT.canonicalPages.length,12);
assert.equal(OS_NAVIGATION_CONTRACT.mobileNav.length,14);
assert.equal(OS_NAVIGATION_CONTRACT.diva.primaryArea,false);
assert.equal(OS_NAVIGATION_CONTRACT.diva.transversal,true);
assert.deepEqual(OS_NAVIGATION_CONTRACT.navigationGroups.map(x=>x.label),['OBSERVAR','CRIAR','COMERCIAL','ENTREGAR','CONHECIMENTO','SISTEMA']);
assert.equal(OS_NAVIGATION_CONTRACT.pwa.startUrl,'/os/inicio');
assert.equal(new Set(OS_NAVIGATION_CONTRACT.legacyCapabilities).size,OS_NAVIGATION_CONTRACT.legacyCapabilities.length);
for(const label of labels)assert.ok(nav.includes("'"+label+"'"),'missing human nav '+label);
for(const route of ['/os/radar','/os/agenda','/os/pipeline','/os/contatos','/os/workspace','/os/explorer','/os/social','/os/ideias','/os/pr','/os/configuracoes','/os/diva'])assert.ok(nav.includes(route),route);
assert.match(nav,/osAppRail/);assert.match(nav,/osMobileDock/);assert.match(nav,/\['ideias','Ideias','\/os\/ideias'\]/);

// Vinext rejects an explicit /os index alongside an optional /os/[[...slug]] route.
// The catch-all is the single owner of /os and must preserve the empty-slug -> inicio behavior.
assert.ok(fs.existsSync(osCatchAllUrl),'missing canonical /os optional catch-all route');
assert.equal(fs.existsSync(osIndexUrl),false,'duplicate /os index conflicts with optional catch-all route');
const osCatchAll=fs.readFileSync(osCatchAllUrl,'utf8');
assert.match(osCatchAll,/Array\.isArray\(params\?\.slug\)\?params\.slug:\[\]/,'catch-all must tolerate empty slug');
assert.match(osCatchAll,/parts\[0\]\|\|'inicio'/,'/os must resolve to inicio through the catch-all');

console.log('QA_OS_NAVIGATION_CONTRACT PASS · twelve primary areas + transversal Malha/DIVA + single-owner /os route.');
