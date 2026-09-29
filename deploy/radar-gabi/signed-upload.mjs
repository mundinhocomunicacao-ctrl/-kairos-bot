import crypto from 'node:crypto';

const required = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(name + '=MISSING');
  return value;
};

const signedUrl = required('RADAR_SIGNED_UPLOAD_URL');
const sourceUrl = required('RADAR_ARTIFACT_URL');
const expectedMd5 = required('RADAR_EXPECTED_MD5').toLowerCase();
const expectedSize = Number(required('RADAR_EXPECTED_SIZE'));

const source = await fetch(sourceUrl, { redirect: 'follow' });
if (!source.ok) throw new Error('ARTIFACT_FETCH_FAILED status=' + source.status);
const bytes = Buffer.from(await source.arrayBuffer());
const md5 = crypto.createHash('md5').update(bytes).digest('hex');

if (bytes.length !== expectedSize) {
  throw new Error('ARTIFACT_SIZE_MISMATCH expected=' + expectedSize + ' actual=' + bytes.length);
}
if (md5 !== expectedMd5) {
  throw new Error('ARTIFACT_MD5_MISMATCH expected=' + expectedMd5 + ' actual=' + md5);
}

const upload = await fetch(signedUrl, {
  method: 'PUT',
  headers: { 'Content-Type': 'text/html' },
  body: bytes
});
if (!upload.ok) {
  const body = await upload.text().catch(() => '');
  throw new Error('SIGNED_UPLOAD_FAILED status=' + upload.status + ' body=' + body.slice(0, 200));
}

console.log('GABI_RADAR_SIGNED_UPLOAD=PASS');
console.log(JSON.stringify({ size: bytes.length, md5, source: sourceUrl.split('/').slice(-4).join('/') }));
