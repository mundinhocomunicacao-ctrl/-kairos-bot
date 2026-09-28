import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const PORT = process.env.PORT || 10000;
const ROOT = process.cwd();
const PROJECT = path.join(ROOT, 'deploy/morada-release/project');
const SITE_ID = '7aff6327-39c6-4be0-aa3f-5d50680eb337';
const CANARY_URL = 'https://www.especialistabrandingeinfluencia.com/_functions/divaCanary?nonce=m0aWKB9L8B-lHKj3gNZJMRU5Bh_C_TGaKvZc94WTh6E';

const state = {
  phase: 'BOOT',
  siteId: SITE_ID,
  auth: null,
  publish: null,
  health: null,
  canary: null,
  done: false,
  error: null
};

function log(message) {
  console.log(message);
  state.lastLog = String(message).slice(-1200);
}

function exec(command, args, cwd = ROOT, input = undefined) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    input,
    env: {...process.env, CI: '1', AI_AGENT: 'wix-headless-skill'},
    maxBuffer: 8 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result;
}

function curlJson(url) {
  const result = exec('curl', ['-fsSL', '--retry', '4', '--retry-all-errors', '--max-time', '120', url]);
  if (result.status !== 0) throw new Error('CURL_FAILED');
  return JSON.parse(result.stdout || '{}');
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function ensureAuth() {
  state.phase = 'AUTH';
  let who = exec('npx', ['-y', '@wix/cli@latest', 'whoami'], PROJECT);
  if (who.status === 0) {
    state.auth = {ok: true, method: 'SESSION'};
    log('WIX_AUTH_SESSION_PASS');
    return;
  }

  const aliases = [
    'WIX_RELEASE_API_KEY',
    'WIX_CLI_API_KEY',
    'WIX_API_KEY',
    'MUNDINHO_WIX_API_KEY',
    'WIX_MUNDO_API_KEY',
    'WIX_GABI_RADAR_API_KEY'
  ];
  const alias = aliases.find(name => Boolean(String(process.env[name] || '').trim()));

  if (alias) {
    const login = exec('npx', ['-y', '@wix/cli@latest', 'login', '--api-key', String(process.env[alias])], PROJECT);
    if (login.status !== 0) throw new Error('WIX_API_KEY_LOGIN_FAILED');

    who = exec('npx', ['-y', '@wix/cli@latest', 'whoami'], PROJECT);
    if (who.status !== 0) throw new Error('WIX_AUTH_NOT_CONFIRMED');

    state.auth = {ok: true, method: 'API_KEY', alias};
    log('WIX_AUTH_API_KEY_PASS ' + alias);
    return;
  }

  state.auth = {ok: false, method: 'DEVICE_CODE', status: 'AWAITING_USER'};
  await new Promise((resolve, reject) => {
    const child = spawn('npx', ['-y', '@wix/cli@latest', 'login'], {
      cwd: PROJECT,
      env: {...process.env, CI: '1', AI_AGENT: 'wix-headless-skill'},
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let buffer = '';
    const consume = (chunk) => {
      const s = String(chunk);
      process.stdout.write(s);
      buffer += s;
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        try {
          const event = JSON.parse(line);
          if (event.event === 'awaiting_user') {
            state.auth = {
              ok: false,
              method: 'DEVICE_CODE',
              status: 'AWAITING_USER',
              userCode: event.userCode || null,
              verificationUri: event.verificationUri || event.verificationUriComplete || null,
              expiresInSeconds: event.expiresInSeconds || null
            };
            log('DIVA_WIX_AWAITING_USER ' + JSON.stringify(state.auth));
          }
          if (event.event === 'success') {
            log('DIVA_WIX_DEVICE_AUTH_SUCCESS');
          }
        } catch {}
      }
    };
    child.stdout.on('data', consume);
    child.stderr.on('data', consume);
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('WIX_DEVICE_LOGIN_EXIT_' + code)));
  });

  who = exec('npx', ['-y', '@wix/cli@latest', 'whoami'], PROJECT);
  if (who.status !== 0) throw new Error('WIX_AUTH_NOT_CONFIRMED_AFTER_DEVICE_LOGIN');
  state.auth = {ok: true, method: 'DEVICE_CODE', status: 'AUTHENTICATED'};
  log('WIX_AUTH_DEVICE_PASS');
}

async function main() {
  try {
    state.phase = 'SOURCE_PROOF';
    const config = JSON.parse(fs.readFileSync(path.join(PROJECT, 'wix.config.json'), 'utf8'));
    if (config.siteId !== SITE_ID) throw new Error('MORADA_SITE_ID_MISMATCH');
    if (!fs.existsSync(path.join(PROJECT, 'src/backend/divaBridge.web.js'))) throw new Error('DIVA_BRIDGE_MISSING');
    if (!fs.existsSync(path.join(PROJECT, 'src/backend/http-functions.js'))) throw new Error('DIVA_HTTP_FUNCTIONS_MISSING');
    if (!fs.existsSync(path.join(PROJECT, 'src/backend/data.js'))) throw new Error('DIVA_CANARY_HOOK_MISSING');
    log('MORADA_SOURCE_PROOF_PASS');

    await ensureAuth();

    state.phase = 'PUBLISH';
    let publish = exec('npx', ['-y', '@wix/cli@latest', 'publish', '-y'], PROJECT, '\n');
    if (publish.status !== 0) {
      log('WIX_PUBLISH_Y_FALLBACK');
      publish = exec('npx', ['-y', '@wix/cli@latest', 'publish'], PROJECT, '\n');
    }
    if (publish.status !== 0) {
      state.publish = {ok: false, exitCode: publish.status};
      throw new Error('WIX_PUBLISH_FAILED');
    }
    state.publish = {ok: true};
    log('MORADA_WIX_PUBLISH_PASS');

    state.phase = 'HEALTH';
    for (let i = 0; i < 18; i++) {
      try {
        const h = curlJson('https://www.especialistabrandingeinfluencia.com/_functions/divaHealth?proof=' + Date.now());
        if (h?.ok === true && h?.service === 'DIVA_MORADA_HTTP_INGRESS') {
          state.health = {ok: true, service: h.service, version: h.version || null};
          break;
        }
      } catch {}
      await sleep(5000);
    }
    if (!state.health?.ok) throw new Error('DIVA_HEALTH_NOT_PROVEN');
    log('DIVA_HEALTH_PASS');

    state.phase = 'CANARY';
    const result = curlJson(CANARY_URL + '&proof=' + Date.now());
    state.canary = {
      ok: result?.ok === true,
      status: result?.status || null,
      provider: result?.provider || null,
      model: result?.model || null,
      messageIdPresent: !!result?.messageId,
      replyPresent: typeof result?.text === 'string' && result.text.length > 0,
      receipt: result?.receipt ? {
        ok: result.receipt.ok === true,
        status: result.receipt.status || null,
        pulseId: result.receipt.pulseId || null,
        memoryRecordId: result.receipt.memoryRecordId || null
      } : null
    };

    if (!(state.canary.ok && state.canary.replyPresent && state.canary.receipt?.ok && state.canary.receipt?.memoryRecordId)) {
      throw new Error('DIVA_CANARY_NOT_PROVEN');
    }

    state.phase = 'DONE';
    state.done = true;
    log('DIVA_MORADA_FIRST_THOUGHT_PROVEN ' + state.canary.receipt.memoryRecordId);
  } catch (error) {
    state.phase = 'ERROR';
    state.error = String(error?.message || error);
    console.error(error?.stack || error);
  }
}

http.createServer((req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(state, null, 2));
}).listen(PORT, '0.0.0.0', () => {
  log('DIVA_MORADA_RELEASE_CONTROLLER_READY ' + PORT);
  main();
});
