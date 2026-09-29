import fs from 'node:fs';
import assert from 'node:assert/strict';
import {OS_NAVIGATION_CONTRACT} from '../data/os-navigation-contract.js';

const routes={
  inicio:'pages/os/inicio.js',
  radar:'pages/os/radar.js',
  social:'pages/os/social.js',
  ideias:'pages/os/ideias.js',
  contatos:'pages/os/contatos.js',
  pipeline:'pages/os/pipeline/index.js',
  propostas:'pages/os/propostas.js',
  agenda:'pages/os/agenda.js',
  pr:'pages/os/pr.js',
  workspace:'pages/os/workspace.js',
  explorer:'pages/os/explorer.js',
  configuracoes:'pages/os/configuracoes.js'
};

assert.equal(OS_NAVIGATION_CONTRACT.canonicalPages.length,12,'OS must expose exactly twelve primary human areas');
assert.deepEqual(
  OS_NAVIGATION_CONTRACT.canonicalPages.map(([id])=>id),
  Object.keys(routes),
  'Primary area order must match the canonical 12-area workflow'
);

for(const [id,file] of Object.entries(routes)){
  assert.ok(fs.existsSync(file),id+' primary area file must exist');
  const src=fs.readFileSync(file,'utf8');
  assert.ok(src.includes('requireOSAuth'),id+' must stay behind OS auth');
  assert.ok(/export default/.test(src),id+' must render a page');
  assert.ok(!/return\s*\{?\s*redirect\s*:/.test(src),id+' must be a materialized primary surface, not a redirect');
}

const home=fs.readFileSync(routes.inicio,'utf8');
assert.ok(home.includes('resolveHomeProjection'),'Home must use fail-safe SSR projection');
const agenda=fs.readFileSync(routes.agenda,'utf8');
assert.ok(agenda.includes('AGENDA · TEMPO OPERACIONAL'),'Agenda must render its own canonical time surface');
assert.ok(agenda.includes('agendaRows')&&agenda.includes('projection?.operational?.followups'),'Agenda must materialize governed follow-ups through the current projection');
assert.ok(!agenda.includes('OperationalActionView'),'Agenda must not mount a second legacy navigation shell');
const explorer=fs.readFileSync(routes.explorer,'utf8');
assert.ok(explorer.includes('EXPLORER · PESQUISA'),'Explorer must render its own canonical research surface');
assert.ok(explorer.includes('BRAIN_DASHBOARD_SNAPSHOT'),'Explorer must project governed Brain evidence');
assert.ok(!explorer.includes('CanonicalBrainPage'),'Explorer must not mount a second legacy navigation shell');

console.log('QA_TWELVE_PRIMARY_AREAS_RUNTIME PASS · 12/12 primary areas are materialized, authenticated surfaces');
