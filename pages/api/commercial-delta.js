import {getAuthorizedOSUser} from '../../lib/mundinho-api-auth';
import {handleCommercialDeltaRequest} from '../../lib/commercial-delta-fabric.mjs';
import {buildMundoWritebackEvent,executeMundoWritebackWithVerification} from '../../lib/mundo-writeback.mjs';

export default async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex,nofollow,noarchive');
  const actor=getAuthorizedOSUser(req);
  try{
    const result=await handleCommercialDeltaRequest({
      method:req.method,
      body:req.body||{},
      actor,
      persist:async eventSpec=>{
        const event=buildMundoWritebackEvent({...eventSpec,actor});
        return executeMundoWritebackWithVerification({event});
      }
    });
    return res.status(result.status).json(result.body);
  }catch(error){
    return res.status(500).json({
      ok:false,
      version:'commercial-delta-fabric-v1',
      error:'commercial_delta_execution_failed',
      reason:String(error?.message||error).slice(0,240)
    });
  }
}
