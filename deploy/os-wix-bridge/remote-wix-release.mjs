import http from 'node:http';

const PORT=process.env.PORT||10000;
const SOURCE_SHA='723b28094c3b83903235d768af543ca09080af37';
const gitlabAliases=['GITLAB_TOKEN','GITLAB_PAT','GITLAB_ACCESS_TOKEN'];
const wixAliases=['WIX_MUNDO_API_KEY','WIX_GABI_RADAR_API_KEY','WIX_API_KEY','WIX_CLI_API_KEY','WIX_RELEASE_API_KEY','MUNDINHO_WIX_API_KEY'];
const present=(names)=>names.filter(name=>Boolean(process.env[name]));
const state={
  phase:'BOOTSTRAP_SAFE',
  sourceSha:SOURCE_SHA,
  gitlabCredentialAliases:present(gitlabAliases),
  wixCredentialAliases:present(wixAliases),
  mutation:false,
  releaseAttempted:false,
  productionAttempted:false,
  readyForExactGitLabArchive:present(gitlabAliases).length>0,
  readyForWixQaAuth:present(wixAliases).length>0
};
console.log('DIVA_WIX_BOOTSTRAP_SAFE',JSON.stringify({
  sourceSha:state.sourceSha,
  gitlabCredentials:state.gitlabCredentialAliases.length,
  wixCredentials:state.wixCredentialAliases.length,
  mutation:false
}));
http.createServer((req,res)=>{
  res.setHeader('content-type','application/json');
  res.end(JSON.stringify(state,null,2));
}).listen(PORT,'0.0.0.0',()=>console.log('REMOTE_WIX_BOOTSTRAP_CONTROL_READY',PORT));
