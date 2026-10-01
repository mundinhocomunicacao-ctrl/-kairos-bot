export const CAPABILITY_STATES=Object.freeze(['UNKNOWN','DISCOVERED','CANDIDATE','VERIFIED']);

import {PLUGIN_CELL_CANDIDATES_V1} from '../data/plugin-cell-candidates-v1.js';

const pluginCellByName=new Map(PLUGIN_CELL_CANDIDATES_V1.map(row=>[row.name,row]));

const discoveredProviders=[
  ['AI Vibe Prospecting','AI_Vibe_Prospecting'],['AccurateScribe.ai','AccurateScribe_ai'],['Ad Superpowers','Ad_Superpowers'],['Adobe','Adobe'],['Adobe Marketing Agent','Adobe_Marketing_Agent'],['Agentic Slides by SlidesGPT','Agentic_Slides_by_SlidesGPT'],['Airtable','Airtable'],['AppDeploy','AppDeploy'],['ArmorCodex','ArmorCodex'],['B12 Website Generator','B12_Website_Generator'],['Botpress','Botpress'],['Brand & Market Social Research','Brand'],['Break The Web News','Break_The_Web_News'],['Canva','Canva'],['ClickUp','ClickUp'],['CoDiscover','CoDiscover'],['Coda','Coda'],['Code Tytor Python','Code_Tytor'],['Codex Tasks','Codex_Tasks'],['Cody Reading','Cody_Reading'],['CodeRabbit','CodeRabbit'],['Descript','Descript'],['Exa','Exa'],['Expertise Live Chatbot','Expertise_Live_Chatbot'],['Figma','Figma'],['Firecrawl','Firecrawl'],['Genspark AI Slides','Genspark_AI_Slides'],['GitHub','GitHub'],['GitLab','GitLab'],['Git Diff Patcher Bridge','Git_Diff_Patcher_Bridge'],['Gmail','Gmail'],['Google Calendar','Google_Calendar'],['Google Contacts','Google_Contacts'],['Google Drive','Google_Drive'],['Granola','Granola'],['Grow My Website','Grow_My_Website'],['HeyGen','HeyGen'],['Higgsfield','Higgsfield'],['HubSpot','HubSpot'],['Hugging Face','Hugging_Face'],['InsightfulPipe','InsightfulPipe'],['Linear','Linear'],['Make','M_ke'],['Mailopoly Inbox','Mailopoly_Inbox'],['Manus','Manus'],['MetaMetrics Lexile Analyzer','MetaMetrics'],['Metricool','Metricool'],['Miro','Miro'],['NeuronSearchLab','NeuronSearchLab'],['Notion','Notion'],['OpenAI Platform','OpenAI_Platform'],['Opera Browser Connector','Opera_Browser_Connector'],['Plugin Management','Plugin_Management'],['PostHog','PostHog'],['Post Metadata Extractor','Post_Metadata_Extractor'],['Remote Desktop Commander','Remote_Desktop_Commander'],['Render','Render'],['Replit','Replit'],['Slack','Slack'],['Slides AI','Slides_AI'],['Socialstats','Socialstats'],['SonarQube','SonarQube'],['Supabase','Supabase'],['Systeme.io','Systeme_io'],['Tariff Code Compliance','Tariff_Code_Compliance'],['VSI AI Automation','VSI_AI_Automation'],['Vercel','Vercel'],['Werify','Werify'],['Windsor.ai','Windsor_ai'],['Wix','Wix'],['YepCode','YepCode'],['fal','fal'],['Skillquiver','skills:skillquiver']
];

export {PLUGIN_CELL_CANDIDATES_V1};

export const DIVA_CAPABILITY_REGISTRY_V2=Object.freeze(discoveredProviders.map(([name,provider_id])=>{
  const source=pluginCellByName.get(name)||null;
  return Object.freeze({
    id:'cap_'+provider_id.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''),
    name,
    source_name:source?.source_name||name,
    provider_id,
    state:source?.state||'DISCOVERED',
    category:source?.category||null,
    auth_type:source?.auth_type||null,
    known_api:source?.known_api||null,
    note:source?.note||null,
    source_registry:source?'PLUGIN_CELL_CANDIDATOS_V1':'CHATGPT_PLUGIN_DISCOVERY',
    exposure:'GATEWAY_INTERNAL',
    public_mcp_tool:false,
    proof_policy:'PROVE_BEFORE_PROMOTE',
    verification:null
  });
}));

export function findDivaCapability(nameOrProvider){
  const needle=String(nameOrProvider||'').trim().toLowerCase();
  return DIVA_CAPABILITY_REGISTRY_V2.find(row=>row.name.toLowerCase()===needle||row.source_name.toLowerCase()===needle||row.provider_id.toLowerCase()===needle)||null;
}

export function capabilityMatch(query=''){
  const needle=String(query||'').trim().toLowerCase();
  if(!needle)return[];
  return DIVA_CAPABILITY_REGISTRY_V2.filter(row=>row.name.toLowerCase().includes(needle)||row.source_name.toLowerCase().includes(needle)||row.provider_id.toLowerCase().includes(needle)||String(row.category||'').toLowerCase().includes(needle));
}

function hasVerificationReceipt(evidence={}){
  return Boolean(evidence.receipt_id&&evidence.auth_ok===true&&evidence.call_ok===true&&evidence.response_ok===true&&evidence.reread_ok===true);
}

export function promoteCapabilityState(capability,targetState,evidence={}){
  if(!capability)throw new Error('DIVA_CAPABILITY_NOT_FOUND');
  if(!CAPABILITY_STATES.includes(targetState))throw new Error('DIVA_CAPABILITY_STATE_INVALID');
  const currentIndex=CAPABILITY_STATES.indexOf(capability.state);
  const targetIndex=CAPABILITY_STATES.indexOf(targetState);
  if(targetIndex<currentIndex)throw new Error('DIVA_CAPABILITY_STATE_REGRESSION_DENIED');
  if(targetState==='VERIFIED'&&!hasVerificationReceipt(evidence))throw new Error('DIVA_CAPABILITY_RECEIPT_REQUIRED');
  return Object.freeze({
    ...capability,
    state:targetState,
    verification:targetState==='VERIFIED'?Object.freeze({
      receipt_id:String(evidence.receipt_id),auth_ok:true,call_ok:true,response_ok:true,reread_ok:true
    }):capability.verification
  });
}
