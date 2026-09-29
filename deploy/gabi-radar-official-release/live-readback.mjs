import http from 'node:http';

const PORT=Number(process.env.PORT||10000);
const state={phase:'BOOT',done:false,results:[],error:null};
const urls=[
  'https://radar.gabi.mundinhocomunicacao.com/',
  'https://instant-dugewxsuwtwa-mundinhocomunicaca-1412.wix-site-host.com/'
];
function inspect(html,status,url){
 const start=html.indexOf('const radarCommercialMetrics=');
 const end=html.indexOf('const currentProposalCatalog=[',start);
 const block=start>=0&&end>start?html.slice(start,end):'';
 const checks={
  httpOk:status>=200&&status<400,
  presented68:html.includes('presented:68'),
  proposalSent18:html.includes('proposalSent:18'),
  mediaKitSent4:html.includes('mediaKitSent:4'),
  dm5:html.includes('dmApproached:5'),
  whatsapp8:html.includes('whatsappApproached:8'),
  emailPitch43:html.includes('emailPitchApproached:43'),
  totalTouches91:html.includes('totalTouches:91'),
  orbiVisual:html.includes('data-orbi-visual="diva-official-v1"'),
  divaRoot:html.includes('data-diva-root="DIVA_RAIZ"'),
  publicSafeV3:html.includes('GABI_RADAR_PUBLIC_SAFE_V3'),
  oldOrbAbsent:!html.includes('<span class="gabiOrbCore">DIVA</span>'),
  graphNoEmail:!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(block),
  graphNoPhone:!/(?:\+?55[\s().-]*)?(?:\(?\d{2}\)?[\s.-]*)?\d{4,5}[\s.-]?\d{4}/.test(block)
 };
 return {url,status,length:html.length,checks,pass:Object.values(checks).every(Boolean)};
}
async function main(){
 try{
  for(const base of urls){
   const u=base+(base.includes('?')?'&':'?')+'release='+Date.now();
   const res=await fetch(u,{redirect:'follow',headers:{'cache-control':'no-cache','user-agent':'Mundinho-Radar-Release-Probe/1.0'}});
   const html=await res.text();
   state.results.push(inspect(html,res.status,base));
  }
  state.done=true;state.phase=state.results.some(x=>x.url.includes('radar.gabi')&&x.pass)?'PASS':'FAIL';
  console.log('GABI_RADAR_LIVE_READBACK '+JSON.stringify(state));
 }catch(e){state.phase='ERROR';state.error=String(e?.stack||e);console.error('GABI_RADAR_LIVE_READBACK_ERROR '+state.error)}
}
http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify(state));}).listen(PORT,'0.0.0.0',()=>main());
