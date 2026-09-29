import fs from 'node:fs';
import assert from 'node:assert/strict';

const controller = fs.readFileSync('scripts/morada-release-controller.mjs', 'utf8');

assert.ok(
  controller.includes("DIVA_COUNCIL"),
  'release controller must accept DIVA_COUNCIL as the canonical brain provider'
);
assert.ok(
  controller.includes("CANARY_CONSUMED"),
  'release controller must treat the one-shot consumed canary as prior proof'
);
assert.ok(
  !controller.includes("canary.data?.provider!=='DIVA_GATEWAY'"),
  'release controller must not reject the council architecture by requiring DIVA_GATEWAY'
);

console.log('QA_MORADA_RELEASE_CONTROLLER_COUNCIL PASS');
