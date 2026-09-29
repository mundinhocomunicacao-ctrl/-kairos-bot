import fs from 'node:fs';
import assert from 'node:assert/strict';

const home=fs.readFileSync('components/MoradaDesktopHome.js','utf8');
const avatar=fs.readFileSync('components/DivaAvatar2D.js','utf8');
const page=fs.readFileSync('pages/os/inicio.js','utf8');

assert.ok(page.includes("import MoradaDesktopHome from '../../components/MoradaDesktopHome'"),'Inicio must keep MoradaDesktopHome as the Mesa owner');
assert.ok(home.includes('data-orbi-source="MORADA_SPHERE_64"'),'Mesa must stamp the exact Morada ORBI source');
assert.ok(home.includes('<DivaAvatar2D size="large"'),'Mesa central ORBI must use the Morada 64px sphere');
assert.ok(!home.includes('<DivaAvatar2D size="hero"'),'Mesa must not upscale the Morada ORBI into a different hero object');
for(const token of ['#ffddeb','#f98fc2','#ef3b91','#9d0e59'])assert.ok(avatar.includes(token),'Canonical ORBI palette missing '+token);
assert.ok(home.includes('OperationalBarChart'),'Mesa must include a live operational chart');
assert.ok(home.includes('data-chart-source="LIVE_PROJECTION"'),'Mesa live chart must declare its runtime source');
assert.ok(home.includes("source="CommercialCoreV1 + live projection""),'Mesa chart must disclose source');
assert.ok(home.includes("period="leitura atual""),'Mesa chart must disclose current reading window');
assert.ok(home.includes("updatedAt={todayKey||'agora'}"),'Mesa chart must disclose freshness');
console.log('QA_MESA_MORADA_FUNCTIONAL_TRANSPOSITION PASS');
