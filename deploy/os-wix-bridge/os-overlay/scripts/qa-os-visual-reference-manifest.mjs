import assert from 'node:assert/strict';
import {OS_VISUAL_REFERENCE_MANIFEST as M} from '../data/os-visual-reference-manifest.js';
assert.deepEqual(M.primaryAreas,['Início / Morada','Radar','Social Insights','Ideias','Contatos','Pipeline','Propostas','Agenda','PR','Workspace','Explorer / Alexandria','Configurações']);
assert.ok(M.visualPrinciples.includes('twelve primary areas plus transversal DIVA'));
assert.ok(M.visualPrinciples.includes('navigation follows Início → Observar → Criar → Comercial → Entregar → Conhecimento → Sistema'));
assert.ok(M.visualPrinciples.includes('DIVA may use contextual pink while functional system signals remain cobalt blue'));
assert.equal(Object.keys(M.adobe.references).length,5);
assert.equal(M.figma.fileKey,'eCTL14DEWK2x24f20nSliI');
console.log('QA_OS_VISUAL_REFERENCE_MANIFEST PASS');
