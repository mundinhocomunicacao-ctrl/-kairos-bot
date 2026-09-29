const target=String(process.env.RELEASE_TARGET||'').trim();
if(target==='gabi-radar-live-readback'){
  await import('../gabi-radar-official-release/live-readback.mjs');
}else if(target==='gabi-wix-cli-introspect'){
  await import('../gabi-radar-official-release/wix-cli-introspect.mjs');
}else if(target==='inspect-wix-overrides'){
  await import('../gabi-radar-official-release/inspect-wix-overrides.mjs');
}else if(target==='gabi-radar-signed-upload'){
  await import('../gabi-radar-official-release/signed-upload-proxy.mjs');
}else if(target==='gabi-radar-dedupe'){
  await import('../gabi-radar-official-release/release-controller-dedupe.mjs');
}else{
  await import('./exact-remote-release-ee6e4332-os.mjs');
}
