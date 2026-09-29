import {getAuthorizedOSUser} from '../../lib/mundinho-api-auth';
import {OS_12_AREA_OPERATIONAL_MAP,OS_12_AREA_ROWS} from '../../data/os-12-area-operational-map';

export default function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');
  const actor=getAuthorizedOSUser(req);
  if(!actor)return res.status(401).json({ok:false,message:'Acesso restrito.'});
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  return res.status(200).json({
    ok:true,
    actor:{email:actor.email},
    version:OS_12_AREA_OPERATIONAL_MAP.version,
    authority:OS_12_AREA_OPERATIONAL_MAP.authority,
    governance:OS_12_AREA_OPERATIONAL_MAP.governance,
    order:OS_12_AREA_OPERATIONAL_MAP.order,
    groups:OS_12_AREA_OPERATIONAL_MAP.menuGroups,
    areas:OS_12_AREA_ROWS,
    systemAreas:OS_12_AREA_OPERATIONAL_MAP.systemAreas,
    requestWindow:OS_12_AREA_OPERATIONAL_MAP.requestWindow,
    recentRequestCrosswalk:OS_12_AREA_OPERATIONAL_MAP.recentRequestCrosswalk,
    secondaryCapabilities:OS_12_AREA_OPERATIONAL_MAP.secondaryCapabilities,
    commercialFlow:OS_12_AREA_OPERATIONAL_MAP.commercialFlow,
    johnnyCommercialRules:OS_12_AREA_OPERATIONAL_MAP.johnnyCommercialRules,
    johnnyCommercialRequests:OS_12_AREA_OPERATIONAL_MAP.johnnyCommercialRequests,
    johnnyRecentCommercialActivity:OS_12_AREA_OPERATIONAL_MAP.johnnyRecentCommercialActivity
  });
}
