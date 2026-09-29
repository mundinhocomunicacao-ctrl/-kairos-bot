import React,{useEffect,useState} from 'react';
import MoradaDesktopHome from '../../components/MoradaDesktopHome';
import ContextualDivaDock from '../../components/ContextualDivaDock';
import {requireOSAuth} from '../../lib/os-auth';
import {getWixLiveBrainContext} from '../../lib/wix-live-context';
import {buildMundoCommercialProjection} from '../../lib/mundo-commercial-projection';
import {bootstrapSessionSecret} from '../../lib/session-secret-bootstrap-node.mjs';
import {greetingForSaoPaulo} from '../../lib/daypart-greeting';
import crypto from 'node:crypto';
import {saoPauloDateKey} from '../../lib/ssr-display-format';
import {resolveHomeProjection,minimalHomeProjection} from '../../lib/inicio-server-projection.mjs';

function hasMaterialProjection(value){return Boolean((value?.currentCards||value?.cards||[]).length||(value?.operational?.pipeline||[]).length||(value?.operational?.followups||[]).length||(value?.operational?.radar||[]).length)}
export default function Inicio({email,projection,todayKey,greeting}){const[liveProjection,setLiveProjection]=useState(projection);useEffect(()=>{let active=true;fetch('/api/live-projection',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(data=>{if(active&&data?.projection&&hasMaterialProjection(data.projection))setLiveProjection(data.projection)}).catch(()=>{});return()=>{active=false}},[]);return <><MoradaDesktopHome email={email} projection={liveProjection||projection} todayKey={todayKey} greeting={greeting}/><ContextualDivaDock area="Início" context="Morada, prioridades, follow-ups, frentes comerciais e sinais do dia"/></>}
export async function getServerSideProps(ctx){
 ctx.res.setHeader('Cache-Control','private, no-store, max-age=0');const auth=requireOSAuth(ctx.req);if(auth.redirect)return auth;
 try{await bootstrapSessionSecret(process.env)}catch(error){console.error('HOME_SESSION_BOOTSTRAP_WARN',String(error?.message||error).slice(0,240))}
 let projection=null;const secret=String(process.env.MUNDINHO_SESSION_SECRET||'').trim();
 if(secret){try{const canonical='GET\n/api/internal-live-projection\n';const signature=crypto.createHmac('sha256',secret).update(canonical).digest('hex');const proto=String(ctx.req.headers['x-forwarded-proto']||'https').split(',')[0].trim();const host=String(ctx.req.headers.host||'').trim();const response=await fetch(proto+'://'+host+'/api/internal-live-projection',{headers:{'x-mundo-internal-signature':signature}});if(response.ok){const data=await response.json();projection=data?.projection||null}}catch(error){console.error('HOME_INTERNAL_PROJECTION_WARN',String(error?.message||error).slice(0,240))}}
 projection=await resolveHomeProjection({existingProjection:projection,loadLive:()=>getWixLiveBrainContext({force:true}),buildProjection:({live})=>buildMundoCommercialProjection({live}),onError:error=>console.error('HOME_SSR_FALLBACK',String(error?.message||error).slice(0,240))});
 let todayKey='';let greeting='Olá.';try{todayKey=saoPauloDateKey()}catch{}try{greeting=greetingForSaoPaulo()}catch{}
 return{props:{...auth.props,todayKey,greeting,projection:projection||minimalHomeProjection('HOME_SSR_FALLBACK')}};
}
