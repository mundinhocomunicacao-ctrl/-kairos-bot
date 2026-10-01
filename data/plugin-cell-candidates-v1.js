export const PLUGIN_CELL_REGISTRY_VERSION='PLUGIN_CELL_CANDIDATOS_V1';
export const PLUGIN_CELL_PROOF_POLICY='PROVE_BEFORE_PROMOTE';
export const PLUGIN_CELL_CANDIDATES_V1=Object.freeze([
['GitHub','GitHub','GitHub','código/versionamento','OAuth2 / Personal Access Token','REST + GraphQL v4, api.github.com','CANDIDATE',null],
['GitLab','GitLab (Beta)','GitLab','código/versionamento','OAuth2 / Personal Access Token','REST + GraphQL, gitlab.com/api','CANDIDATE',null],
['Vercel','Vercel','Vercel','deploy/hosting','OAuth2 / API Token','REST, api.vercel.com','CANDIDATE','Já conectado nesta sessão via MCP, mas com escopo de conta pessoal — não do team correto (ver bloqueio em aberto)'],
['Google Drive','Google Drive','Google_Drive','armazenamento/documentos','OAuth2','Drive API v3','CANDIDATE','Já conectado e usado nesta sessão'],
['Gmail','Gmail','Gmail','e-mail','OAuth2','Gmail API','CANDIDATE',null],
['Google Calendar','Google Calendar','Google_Calendar','agenda','OAuth2','Calendar API v3','CANDIDATE',null],
['Google Contacts','Google Contacts','Google_Contacts','contatos','OAuth2','People API','CANDIDATE',null],
['Slack','Slack','Slack','comunicação','OAuth2 (bot/user token)','Web API + Events API','CANDIDATE','Já em uso na Malha (#diva-command etc.) segundo os registros do Mapa Central'],
['Notion','Notion','Notion','documentos/wiki','OAuth2 / Integration Token','Notion API','CANDIDATE',null],
['Airtable','Airtable','Airtable','banco de dados/planilha','OAuth2 / Personal Access Token','REST API v0','CANDIDATE',null],
['ClickUp','ClickUp','ClickUp','gestão de tarefas','OAuth2 / API Token','REST API v2','CANDIDATE',null],
['Linear','Linear','Linear','gestão de tarefas/engenharia','OAuth2 / API Key','GraphQL API','CANDIDATE',null],
['Coda','Coda','Coda','documentos/tabelas','API Token','REST API','CANDIDATE',null],
['Miro','Miro','Miro','quadro colaborativo','OAuth2','REST API v2','CANDIDATE',null],
['Figma','Figma','Figma','design','OAuth2 / Personal Access Token','REST API','CANDIDATE',null],
['Canva','Canva','Canva','design','OAuth2','Connect API','CANDIDATE',null],
['HubSpot','HubSpot','HubSpot','CRM/marketing','OAuth2 / Private App Token','REST API v3','CANDIDATE',null],
['Supabase','Supabase','Supabase','backend/banco de dados','API Key / Service Role Key','REST (PostgREST) + Auth + Storage API','CANDIDATE',null],
['Render','Render','Render','deploy/hosting','API Key','REST API','CANDIDATE',null],
['Replit','Replit','Replit','ambiente de código','OAuth2','REST/GraphQL (parcialmente público)','CANDIDATE',null],
['Make','Make','M_ke','automação/integração','API Key / OAuth2','REST API + Webhooks','CANDIDATE','Registrado como degradado por limite de plano segundo Mapa Mestre'],
['Windsor.ai','Windsor.ai','Windsor_ai','dados de marketing','OAuth2 / API Key','REST API','CANDIDATE','Já conectado nesta conta Claude (não testado no lado DIVA)'],
['Wix','Wix','Wix','site/CMS','OAuth2','Wix REST API','CANDIDATE','Já em uso confirmado como rail de produção (Wix QA, mencionado nos registros PANDORA)'],
['Opera Browser Connector','Opera Browser Connector','Opera_Browser_Connector','navegador/automação web','local/session','não documentado publicamente','UNKNOWN',null],
['SonarQube','SonarQube','SonarQube','qualidade de código','API Token','REST API','CANDIDATE',null],
['CodeRabbit','CodeRabbit','CodeRabbit','revisão de código IA','OAuth2 (via GitHub/GitLab)','não expõe API pública direta amplamente documentada','UNKNOWN',null],
['Hugging Face','Hugging Face','Hugging_Face','modelos de IA','API Token','Inference API + Hub API','CANDIDATE',null],
['Firecrawl','Firecrawl','Firecrawl','scraping/ingestão web','API Key','REST API','CANDIDATE',null],
['Exa','Exa','Exa','busca semântica','API Key','REST API','CANDIDATE',null],
['PostHog','PostHog','PostHog','analytics de produto','API Key','REST API','CANDIDATE',null],
['Descript','Descript','Descript','edição de áudio/vídeo','OAuth2 (API em beta fechado)','parcial/beta','UNKNOWN',null],
['HeyGen','HeyGen','HeyGen','vídeo com IA/avatar','API Key','REST API','CANDIDATE',null],
['Metricool','Metricool','Metricool','analytics de redes sociais','API Key','REST API','CANDIDATE',null]
].map(([name,source_name,provider_id,category,auth_type,known_api,state,note])=>Object.freeze({
  name,source_name,provider_id,category,auth_type,known_api,state,note
})));
