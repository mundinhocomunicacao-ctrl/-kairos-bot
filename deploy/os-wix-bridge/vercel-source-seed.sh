#!/usr/bin/env bash
set -euo pipefail

EXPECTED_SHA='e5a3c8c3edaf74a79d83feb428effb43cc638ede'
BRIDGE='https://mundinho-wix-exact-44695-release.onrender.com/source-archive'

test "${VERCEL_ENV:-}" = 'production'
test "${VERCEL_GIT_COMMIT_SHA:-}" = "$EXPECTED_SHA"

ARCHIVE="/tmp/mundo-source-${EXPECTED_SHA}.tar.gz"
tar --exclude=.git --exclude=node_modules --exclude=.next --exclude=.vercel -czf "$ARCHIVE" .
export MUNDO_SOURCE_ARCHIVE="$ARCHIVE"
export MUNDO_SOURCE_DIGEST="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
export MUNDO_SOURCE_BRIDGE="$BRIDGE"

node --input-type=module <<'NODE'
import fs from 'node:fs';
import {getVercelOidcToken} from '@vercel/oidc';

const sha=process.env.VERCEL_GIT_COMMIT_SHA;
const token=await getVercelOidcToken();
if(!token)throw new Error('VERCEL_OIDC_MISSING');

const response=await fetch(process.env.MUNDO_SOURCE_BRIDGE,{
  method:'POST',
  headers:{
    authorization:'Bearer '+token,
    'content-type':'application/gzip',
    'x-source-sha':sha,
    'x-vercel-git-commit-sha':sha,
    'x-archive-sha256':process.env.MUNDO_SOURCE_DIGEST
  },
  body:fs.readFileSync(process.env.MUNDO_SOURCE_ARCHIVE)
});
const text=await response.text();
if(!response.ok)throw new Error('SOURCE_BRIDGE_'+response.status+'_'+text.slice(0,160));
console.log('VERCEL_SOURCE_BRIDGE_PASS '+text);
NODE
