export const DIVA_GATEWAY_CORPORATE_ACTORS=Object.freeze({
  fernando:'fernando@mundinhocomunicacao.com',
  johnny:'johnny@mundinhocomunicacao.com',
  vitoria:'contato@mundinhocomunicacao.com',
  mundinho:'mundinhocomunicacao@gmail.com'
});

const DIVA_GATEWAY_STANDARD_SURFACES=Object.freeze(['chatgpt','gemini','whatsapp','slack','wix','api']);
export const DIVA_GATEWAY_INSTALLATION_SURFACES=Object.freeze([...DIVA_GATEWAY_STANDARD_SURFACES,'alexa']);
const DIVA_GATEWAY_ACTOR_SURFACES=Object.freeze({
  fernando:DIVA_GATEWAY_INSTALLATION_SURFACES,
  johnny:DIVA_GATEWAY_STANDARD_SURFACES,
  vitoria:DIVA_GATEWAY_STANDARD_SURFACES,
  mundinho:Object.freeze(['chatgpt'])
});

const BASE_CAPABILITIES=Object.freeze(['health','identify','open_context','event','execute','reread','receipt']);
const CORPORATE_SLACK_USER_IDS=Object.freeze({
  fernando:'U0C40L5JLKA',
  johnny:'U0C40KZV7FS',
  vitoria:'U0C34AW86NA'
});
const DIRECT_WRITEBACK_SURFACES=new Set(['chatgpt','gemini','wix','api']);
const VOICE_ACTION_SURFACES=new Set(['alexa','whatsapp']);

function secretEnv(actorKey,surface){
  return `DIVA_GATEWAY_SECRET_${actorKey.toUpperCase()}_${surface.toUpperCase()}`;
}

const entries={};
for(const [actorKey,actorId] of Object.entries(DIVA_GATEWAY_CORPORATE_ACTORS)){
  for(const surface of DIVA_GATEWAY_ACTOR_SURFACES[actorKey]||[]){
    const id=`${actorKey}-${surface}`;
    entries[id]=Object.freeze({
      actor_id:actorId,
      surfaces:Object.freeze([surface]),
      capabilities:Object.freeze([...BASE_CAPABILITIES,...(DIRECT_WRITEBACK_SURFACES.has(surface)?['writeback']:[]),...(VOICE_ACTION_SURFACES.has(surface)?['voice_action']:[])]),
      secret_env:secretEnv(actorKey,surface),
      enabled:true,
      credential_policy:'PER_INSTALLATION_REVOCABLE',
      least_privilege:true,
      external_identity:Object.freeze(surface==='slack'?{slack_user_id:CORPORATE_SLACK_USER_IDS[actorKey]}:{})
    });
  }
}

entries['morada-wix']=Object.freeze({
  actor_id:DIVA_GATEWAY_CORPORATE_ACTORS.mundinho,
  surfaces:Object.freeze(['wix']),
  capabilities:Object.freeze([...BASE_CAPABILITIES,'writeback']),
  auth_method:'ed25519',
  public_key_pem:`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAJJHSiX0xYEmqh26McGlsglKcn4KkupEU/Lq7XRlXzg8=
-----END PUBLIC KEY-----`,
  enabled:true,
  credential_policy:'PRIVATE_KEY_MORADA_PUBLIC_KEY_OS',
  least_privilege:true,
  external_identity:Object.freeze({
    site_id:'7aff6327-39c6-4be0-aa3f-5d50680eb337',
    surface:'DIVA_MORADA'
  })
});

export const DIVA_GATEWAY_INSTALLATION_REGISTRY=Object.freeze(entries);
export const DIVA_GATEWAY_SECRET_ENV_KEYS=Object.freeze(
  Object.values(DIVA_GATEWAY_INSTALLATION_REGISTRY).map(row=>row.secret_env).filter(Boolean)
);
