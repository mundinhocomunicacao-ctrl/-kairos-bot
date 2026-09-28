import fs from 'node:fs';
import assert from 'node:assert/strict';

const controller=new URL('./exact-remote-release-ee6e4332.mjs', import.meta.url);
assert.ok(fs.existsSync(controller),'controller must exist');
const src=fs.readFileSync(controller,'utf8');

const lockPath=new URL('./release-lock.json', import.meta.url);
assert.ok(fs.existsSync(lockPath),'release lock must exist beside the controller');
const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));
assert.equal(lock.policyVersion,'MUNDINHO_OS_LIVE_LOCK_V1','release lock policy version');
assert.equal(lock.mode,'frozen','live lock must default frozen');
assert.equal(lock.currentLive.sourceSha,'88ccd189cf2b61fd042a6fde2be558646818109c','release lock must pin approved live source');
assert.equal(lock.currentLive.releaseId,'wix-live-88ccd189','release lock must pin approved live release id');
assert.ok(lock.pendingReleaseRequest===null||(lock.pendingReleaseRequest.status==='APPROVED'&&lock.pendingReleaseRequest.approvedByHuman===true&&Boolean(lock.pendingReleaseRequest.approvedAt)),'release lock may contain only an explicit human-approved pending release request');

const schemaPath=new URL('./release-request.schema.json', import.meta.url);
const templatePath=new URL('./release-request.template.json', import.meta.url);
assert.ok(fs.existsSync(schemaPath),'release request schema must exist');
assert.ok(fs.existsSync(templatePath),'release request template must exist');
const requestTemplate=JSON.parse(fs.readFileSync(templatePath,'utf8'));
assert.equal(requestTemplate.status,'DRAFT','release request template must never default approved');
assert.equal(requestTemplate.approvedByHuman,false,'release request template must default to no human approval');
assert.equal(requestTemplate.qaReceipt,null,'release request template must not prefill QA receipt');
assert.equal(requestTemplate.buildReceipt,null,'release request template must not prefill build receipt');
assert.equal(requestTemplate.visualReceipt,null,'release request template must not prefill visual receipt');

assert.ok(src.includes("function assertReleaseUnlocked"),'controller must have a fail-closed release lock gate');
assert.ok(src.includes("RELEASE_LOCKED_NO_REQUEST"),'controller must refuse release when no explicit request exists');
assert.ok(src.includes("RELEASE_LOCK_SOURCE_MISMATCH"),'controller must reject a request for a different source SHA');
assert.ok(src.includes("RELEASE_LOCK_MIRROR_MISMATCH"),'controller must reject a request for a different mirror SHA');
assert.ok(src.includes("assertReleaseUnlocked()"),'controller must call release lock gate before build/auth/release');

assert.ok(src.includes("OS_LIVE_PROMOTION_ENABLED"),'controller must require external Render promotion kill switch');
assert.ok(src.includes("RELEASE_PROMOTION_DISABLED"),'controller must fail closed when external promotion switch is not explicitly enabled');
assert.ok(src.includes("OS_LIVE_EXPECTED_CURRENT_SOURCE_SHA"),'controller must bind external expected-current-live source');

assert.ok(src.includes("OS_LIVE_APPROVED_REQUEST_ID"),'controller must require the exact externally approved request id');
assert.ok(src.includes("OS_LIVE_APPROVED_SOURCE_SHA"),'controller must require the exact externally approved source sha');
assert.ok(src.includes("RELEASE_EXTERNAL_REQUEST_ID_MISMATCH"),'controller must reject a Git approval not mirrored by the external request id');
assert.ok(src.includes("RELEASE_EXTERNAL_SOURCE_MISMATCH"),'controller must reject a Git approval not mirrored by the external source sha');




assert.ok(!src.includes("await run('npm',['exec','vite','--','build','--minify','false']"),'runtime controller must not compile the artifact after build-phase healing');
assert.ok(!src.includes("await run('node',['scripts/package-wix-worker.mjs']"),'runtime controller must not package the Wix worker after build-phase healing');
assert.ok(!src.includes("await run('npm',['run','build:wix-worker']"),'runtime controller must not route this release through the hanging vinext wrapper');

const healHook=new URL('./render-build-heal-68b46dab.sh', import.meta.url);
assert.ok(fs.existsSync(healHook),'build-phase healing hook must exist');
const healSrc=fs.readFileSync(healHook,'utf8');
assert.ok(healSrc.includes('de8568fa10a42aae6cd25abb532f47a1c3ac27ec'),'healing hook must pin exact mirror');
assert.ok(healSrc.includes('68b46dabd6fa0191259225493350a35caea26567'),'healing hook must pin exact source');
assert.ok(healSrc.includes("npm exec vite -- build --minify false"),'healing hook must compile through direct Vite build');
assert.ok(healSrc.includes('scripts/package-wix-worker.mjs'),'healing hook must package Wix worker in build phase');
assert.ok(healSrc.includes('ROOT="$PWD"'),'healing hook must use actual build working directory');
assert.ok(!healSrc.includes('RENDER_PROJECT_DIR'),'healing hook must not trust Render relative project-dir metadata');
assert.ok(!healSrc.startsWith('#!/usr/bin/env bash\nset -euo pipefail'),'healing hook must not leak strict shell options into Render runtime wrapper');
assert.ok(healSrc.includes('(') && healSrc.includes('set -euo pipefail'),'healing hook must isolate strict mode inside a subshell');
assert.ok(src.includes('PREBUILT_ARTIFACT_PROOF_PATH'),'controller must require build-phase artifact proof');
assert.ok(src.includes("const READBACK_ONLY=process.env.READBACK_ONLY==='1'"),'controller must expose env-driven readback-only mode without re-releasing Wix');
assert.ok(src.includes('WIX_PREBUILT_ARTIFACT_PASS'),'controller must emit prebuilt artifact receipt');
assert.ok(!src.includes("await run('npm',['ci','--ignore-scripts']"),'runtime controller must not reinstall dependencies');

assert.ok(src.includes("SOURCE_SHA='68b46dabd6fa0191259225493350a35caea26567'"),'must pin sovereign GitLab final SHA');
assert.ok(src.includes("MIRROR_SHA='de8568fa10a42aae6cd25abb532f47a1c3ac27ec'"),'must pin exact final GitHub mirror snapshot');
assert.ok(src.includes("siteId:'c80689f2-6627-45fa-a264-4ab2863ba306'"),'must target DIA A DIA live site');
assert.ok(src.includes("appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e'"),'must target live Wix app');
assert.ok(src.includes("CANONICAL='https://os.mundinhocomunicacao.com'"),'must prove human canonical domain');
assert.ok(src.includes("MATERIALIZE_FROM_PINNED_SUBMODULE=true"),'must materialize release from the already verified exact mirror submodule');
assert.ok(!src.includes("ARTIFACT_URL='https://mundinho-wix-remote-release-pty.onrender.com/artifact'"),'must not depend on remote artifact transport after exact mirror verification');
assert.ok(src.includes("WIX_ARTIFACT_EXACT_SHA_PASS"),'must verify artifact source SHA after extraction');
assert.ok(healSrc.includes('MUNDO_RUNTIME_ENV=wix-live'),'build-phase healing must repack the artifact with live runtime identity');
assert.ok(src.includes("EXPECTED_RELEASE_ID=`wix-live-${SOURCE_SHA.slice(0,8)}`"),'must bind live release id to canonical SHA');
assert.ok(src.includes("dr.data?.runtimeEnv==='wix-live'"),'live readback must prove wix-live runtime metadata');
assert.ok(src.includes("dr.data?.deploymentId===EXPECTED_RELEASE_ID"),'live readback must prove deployment id');
assert.ok(src.includes("state.live=await prove(LIVE.host,'LIVE')"),'must prove technical live host readback');
assert.ok(src.includes("provePrivacy(LIVE.host,'LIVE')"),'must prove technical live privacy metadata');
assert.ok(src.includes("state.canonical=await prove(CANONICAL,'CANONICAL')"),'must prove canonical domain readback');
assert.ok(src.includes("provePrivacy(CANONICAL,'CANONICAL')"),'must prove canonical privacy metadata');
assert.ok(!src.includes('PAGE_X_ROBOTS_MISSING'),'Wix protected-route redirects must not depend on unsupported X-Robots-Tag response headers');
assert.ok(!src.includes('PAGE_REFERRER_POLICY'),'Wix protected-route redirects must not depend on response-level Referrer-Policy headers');
assert.ok(src.includes("'LOGIN_META_MISSING_'"),'privacy audit must retain live HTML robots/referrer metadata proof');
assert.ok(src.includes("ROBOTS_TXT_FAIL"),'privacy audit must retain robots.txt deny-all proof');
assert.ok(src.includes("AUTH_REDIRECT_FAIL"),'privacy audit must retain authenticated-route redirect proof');
assert.ok(src.includes("qa-malha-pulse-consumer-runtime.mjs"),'controller must execute Malha pulse runtime QA');
assert.ok(src.includes("qa-diva-face-sync.mjs"),'controller must execute DIVA face-sync QA');
assert.ok(src.includes("qa-diva-ia-cognitive-router.mjs"),'controller must execute cognitive-router QA');
assert.ok(src.includes("OS_CIRCULATION_TARGETED_QA_PASS"),'controller must emit targeted circulation QA pass');
assert.ok(src.includes("LIVE_PRIVACY_METADATA_PASS 11/11")||src.includes("'_PRIVACY_METADATA_PASS 11/11'"),'controller must prove live page-by-page privacy metadata');
assert.ok(!src.includes("qa-diva-morada-brain.mjs"),'Morada brain gate is outside this release cut');
assert.ok(!src.includes("qa-inicio-morada-ssr.mjs"),'Morada SSR gate is outside this release cut');
assert.ok(src.includes("@wix/cli@latest"),'must publish through Wix CLI');
assert.ok(!src.includes("242b9d6f-71ad-40c6-b1d7-f1f0825e01be"),'must not publish legacy QA site');
assert.ok(!src.includes("radar.gabi.mundinhocomunicacao.com"),'must not touch Gabi Radar');
assert.ok(!src.includes("7687d145-056b-4cc0-9f6f-70c2bb32912e"),'must not target Gabi Radar site');
assert.ok(src.includes("MUNDINHO_OS_FINAL_RELEASE_COMPLETE"),'controller must emit final receipt');
console.log('QA_OS_A2960615_FINAL_RELEASE_CONTROLLER_PASS');
