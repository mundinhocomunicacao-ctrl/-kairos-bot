import fs from 'node:fs';
import assert from 'node:assert/strict';

const controller=new URL('./exact-remote-release-ee6e4332.mjs', import.meta.url);
assert.ok(fs.existsSync(controller),'controller must exist');
const src=fs.readFileSync(controller,'utf8');

assert.ok(src.includes("SOURCE_SHA='204911c17f8d1e59ced2783473f5b2956cd36321'"),'must pin canonical GitLab SHA');
assert.ok(src.includes("MIRROR_SHA='780cc2296ab4c6773ce26cd368b500f3062e9032'"),'must pin exact GitHub mirror commit');
assert.ok(src.includes("siteId:'c80689f2-6627-45fa-a264-4ab2863ba306'"),'must target DIA A DIA live site');
assert.ok(src.includes("appId:'79eedd41-5ca6-4940-925a-e95e6f3c570e'"),'must target live Wix app');
assert.ok(src.includes("CANONICAL='https://os.mundinhocomunicacao.com'"),'must prove human canonical domain');
assert.ok(src.includes("state.live=await prove(LIVE.host,'LIVE')"),'must prove technical live host readback');
assert.ok(src.includes("state.canonical=await prove(CANONICAL,'CANONICAL')"),'must prove canonical domain readback');
assert.ok(src.includes("git -C os rev-parse HEAD"),'must verify mirror commit');
assert.ok(src.includes("build:wix-worker"),'must build Wix artifact from source');
assert.ok(src.includes("@wix/cli@latest"),'must publish through Wix CLI');
assert.ok(!src.includes("242b9d6f-71ad-40c6-b1d7-f1f0825e01be"),'must not publish legacy QA site');
assert.ok(!src.includes("radar.gabi.mundinhocomunicacao.com"),'must not touch Gabi Radar');
assert.ok(!src.includes("7687d145-056b-4cc0-9f6f-70c2bb32912e"),'must not target Gabi Radar site');
console.log('QA_OS_204911C1_LIVE_RELEASE_CONTROLLER_PASS');
