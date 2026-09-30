import {buildGabiIntentEvent,GABI_INTENT_VERSION} from '../../lib/gabi-intent-writeback.mjs';
import {executeDivaWriteback,recoverDivaWritebackEvent} from '../../lib/diva-writeback.mjs';

const ALLOWED_ORIGIN='https://radar.gabi.mundinhocomunicacao.com';
const safe=(v,n=300)=>String(v??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,n);

function cors(req,res){
  const origin=safe(req.headers.origin,300);
  if(origin===ALLOWED_ORIGIN){
    res.setHeader('Access-Control-Allow-Origin',ALLOWED_ORIGIN);
    res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers','content-type');
  }
  return origin===ALLOWED_ORIGIN;
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');
  res.setHeader('X-Robots-Tag','noindex,nofollow,noarchive');
  const allowed=cors(req,res);
  if(req.method==='OPTIONS')return allowed?res.status(204).end():res.status(403).end();
  if(!allowed)return res.status(403).json({ok:false,error:'origin_not_allowed'});
  if(req.method!=='POST')return res.status(405).json({ok:false,error:'method_not_allowed'});
  try{
    const built=buildGabiIntentEvent({
      payload:req.body||{},
      sessionId:req.body?.sessionId,
      submittedAt:new Date().toISOString()
    });
    const write=await executeDivaWriteback({event:built.event});
    if(!write.persisted)return res.status(503).json({ok:false,error:'intent_persistence_unavailable',reason:write.reason||null});
    const reread=await recoverDivaWritebackEvent({eventId:built.event.event_id});
    const verified=Boolean(reread?.found&&reread?.event?.event_id===built.event.event_id);
    if(!verified)return res.status(503).json({ok:false,error:'intent_reread_failed'});
    return res.status(200).json({
      ok:true,
      version:GABI_INTENT_VERSION,
      receiptId:built.event.event_id,
      persisted:true,
      verified:true,
      outreachAuthorized:false,
      message:'Salvei isso como preferência sua para a equipe considerar. Nada será enviado para marcas ou veículos automaticamente.'
    });
  }catch(error){
    const code=String(error?.message||error);
    if(code==='GABI_INTENT_EXPLICIT_CONSENT_REQUIRED')return res.status(400).json({ok:false,error:'explicit_consent_required'});
    if(code==='GABI_INTENT_EMPTY')return res.status(400).json({ok:false,error:'intent_empty'});
    return res.status(500).json({ok:false,error:'intent_writeback_failed'});
  }
}
