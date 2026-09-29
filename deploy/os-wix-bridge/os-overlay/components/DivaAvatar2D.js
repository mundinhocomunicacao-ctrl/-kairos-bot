import {DIVA_ORBI_VISUAL_VERSION,DIVA_ORBI_INTERFACE_VERSION} from '../data/diva-orbi-parity-contract';
export default function DivaAvatar2D({state='ready',size='compact',label=false,variant='canonical'}){
  const status=state==='thinking'?'entendendo':state==='listening'?'ouvindo você':state==='speaking'?'respondendo':'presente';
  return <span className={`divaAvatar2D ${size} variant-${variant} state-${state}`} data-diva-avatar="orbi" data-orbi-visual={DIVA_ORBI_VISUAL_VERSION} data-orbi-interface={DIVA_ORBI_INTERFACE_VERSION} aria-label={`DIVA · ${status}`}>
    <span className="divaOrbHalo" aria-hidden="true"/>
    <span className="divaOrbCore" aria-hidden="true"><i className="divaOrbLight"/><i className="divaOrbMist"/><i className="divaOrbPulse"/></span>
    {label?<span className="divaAvatarLabel"><b>DIVA</b><small>{status}</small></span>:null}
    <style jsx>{`
      .divaAvatar2D{--d:38px;position:relative;display:inline-flex;align-items:center;gap:8px;min-width:var(--d);min-height:var(--d);isolation:isolate}
      .divaAvatar2D.medium{--d:48px}.divaAvatar2D.large{--d:64px}.divaAvatar2D.hero{--d:clamp(168px,22vw,260px)}
      .divaOrbHalo{position:absolute;width:var(--d);height:var(--d);border-radius:50%;background:radial-gradient(circle,rgba(239,24,120,.18),rgba(239,24,120,0) 68%);transform:scale(1.42);filter:blur(1px)}
      .divaOrbCore{position:relative;width:var(--d);height:var(--d);display:grid;place-items:center;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 34% 28%,#fff 0 5%,#ffddeb 20%,#f98fc2 43%,#ef3b91 67%,#9d0e59 100%);border:1px solid rgba(181,20,94,.12);box-shadow:0 9px 26px rgba(184,26,105,.17),inset 0 0 20px rgba(255,255,255,.42)}
      .divaOrbLight{position:absolute;width:44%;height:32%;left:17%;top:12%;border-radius:50%;background:rgba(255,255,255,.48);filter:blur(5px);transform:rotate(-18deg)}
      .divaOrbMist{position:absolute;inset:18% 9% 5% 25%;border-radius:50%;background:radial-gradient(circle at 65% 55%,rgba(255,255,255,.12),rgba(95,30,92,.12) 54%,transparent 72%);filter:blur(2px)}
      .divaOrbPulse{position:absolute;width:20%;height:20%;border-radius:50%;background:rgba(255,255,255,.42);box-shadow:0 0 18px rgba(255,255,255,.7)}
      .variant-morada .divaOrbCore{background:radial-gradient(circle at 34% 27%,#fff 0 5%,#ffddeb 19%,#f991c3 43%,#ef3b91 68%,#991058 100%);box-shadow:0 10px 28px rgba(184,26,105,.2),inset 0 0 24px rgba(255,255,255,.44)}
      .variant-morada .divaOrbLight{left:17%;top:11%;width:46%;height:31%;background:rgba(255,255,255,.5)}
      .variant-morada .divaOrbPulse{width:16%;height:16%;background:rgba(255,255,255,.48);box-shadow:0 0 15px rgba(255,255,255,.78)}
      .divaAvatarLabel{display:grid}.divaAvatarLabel>b{font-size:9px;letter-spacing:.11em;color:#b10c59}.divaAvatarLabel small{font-size:8px;color:#776b73;margin-top:2px}
      .state-ready .divaOrbHalo{animation:divaBreathe 4.8s ease-in-out infinite}.state-ready .divaOrbCore{animation:divaFloat 5.6s ease-in-out infinite}
      .state-thinking .divaOrbHalo,.state-listening .divaOrbHalo{animation:divaPulse 1.55s ease-in-out infinite}.state-listening .divaOrbCore{box-shadow:0 9px 28px rgba(184,26,105,.24),0 0 0 5px rgba(239,24,120,.07),inset 0 0 20px rgba(255,255,255,.46)}
      .state-speaking .divaOrbHalo{animation:divaSpeakHalo .82s ease-in-out infinite}.state-speaking .divaOrbPulse{animation:divaSpeakCore .48s ease-in-out infinite alternate}
      @keyframes divaBreathe{0%,100%{transform:scale(1.38);opacity:.7}50%{transform:scale(1.56);opacity:.34}}@keyframes divaFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}@keyframes divaPulse{50%{transform:scale(1.62);opacity:.48}}@keyframes divaSpeakHalo{0%,100%{transform:scale(1.38);opacity:.68}50%{transform:scale(1.72);opacity:.22}}@keyframes divaSpeakCore{to{transform:scale(1.48);opacity:.58}}
      @media(prefers-reduced-motion:reduce){.divaOrbHalo,.divaOrbCore,.divaOrbPulse{animation:none!important}}
    `}</style>
  </span>
}
