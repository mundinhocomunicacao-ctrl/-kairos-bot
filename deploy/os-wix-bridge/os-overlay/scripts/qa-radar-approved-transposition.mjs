import fs from 'node:fs';
import assert from 'node:assert/strict';

const radar=fs.readFileSync('pages/os/radar.js','utf8');
for(const token of [
  'data-visual-reference="RADAR_APPROVED_20260929"',
  'radarMetricGrid',
  'radarTrendPanel',
  'radarIntensityPanel',
  'radarOpportunityMap',
  'Sinais qualificados',
  'radarDivaPanel',
  'data-chart-live="1"',
  "fetch('/api/intelligence-graphs'",
  "fetch('/api/live-projection'",
  '<DivaAvatar2D',
  'variant="morada"'
]) assert.ok(radar.includes(token),'Radar approved transposition missing '+token);

for(const fake of ['>124<','>87<','>12.4K<','>24<']) assert.ok(!radar.includes(fake),'Radar must not hardcode mock values '+fake);
for(const route of ['/os/social','/os/ideias','/os/propostas']) assert.ok(radar.includes(route),'Radar handoff missing '+route);
assert.ok(radar.includes('CRM_OPERATIONAL_SNAPSHOT.capturedAt'),'Radar must expose canonical freshness fallback');
console.log('QA_RADAR_APPROVED_TRANSPOSITION PASS');
