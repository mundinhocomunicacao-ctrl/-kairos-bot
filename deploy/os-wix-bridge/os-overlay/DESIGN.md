# Mundinho OS · DESIGN

## Autoridade visual
A referência humana aprovada da Mesa é a Morada DIVA em `/cópia-sobre-mim`. O OS transpõe essa gramática para produto funcional sem transformar o mockup em imagem estática.

Ordem de autoridade: correção humana aprovada > Morada aprovada > este documento > runtime tokens > padrão histórico > inferência.

## Gramática
- Shell único nas 12 áreas: navegação branca arredondada, canvas neutro quente, superfícies claras, borda suave, sombra mínima.
- Tipografia: display editorial serifado para títulos; sans limpa para operação e dados.
- Azul cobalto = sistema, dados, navegação e ação funcional.
- Rosa = somente DIVA/ORBI, voz, escuta e presença. Nunca vira paleta geral.
- ORBI da Mesa = esfera Morada 64×64, mesma construção visual e estados. Pode existir em outros contextos pelo mesmo master, sem redesenho local.
- Densidade útil no primeiro viewport. Sem cards vazios, placeholders decorativos ou espaços mortos.
- Cada bloco deve responder a uma função: contexto, evidência, leitura, ação ou aprofundamento.

## Dados e gráficos
Gráfico “vivo” significa componente ligado a dataset/projeção real. Todo gráfico deve expor fonte, recorte, atualização/freshness, leitura e limite. Power BI é projeção, nunca fonte soberana. Fonte canônica permanece no MUNDO/CommercialCore/PANDORA/KAIROS/ATENEU.

## Transposição mockup → runtime
Método absorvido dos handoffs recentes: MAPA SEMÂNTICO → MAPA ESPACIAL → INVARIANTES → COMPONENTES → BINDINGS → ESTADOS → RESPONSIVIDADE → QA → HUMAN DELTA LEARNING.
- Mapa semântico: qual decisão a superfície ajuda a tomar.
- Mapa espacial: hierarquia, alinhamento, relações e densidade do mockup.
- Invariantes: shell, ORBI, tipografia, tokens, estados e navegação.
- Variáveis: conteúdo e visualizações mudam por área sem quebrar a gramática.
- Bindings: nenhum número inventado; dados vêm de endpoints/datasets reais.
- Human delta: correções humanas aprovadas atualizam o sistema, não um patch visual isolado.

## Rollout
Publicar uma página por vez. Ordem: Início/Mesa → Radar → Social Insights → Ideias → Contatos → Pipeline → Propostas → Agenda → PR → Workspace → Explorer/Alexandria → Configurações.
Cada página passa por: transposição funcional → dados reais → QA → publicação isolada → readback → próxima página.


## Radar · aprovado em 29/09/2026
Referência humana aprovada: dashboard claro e denso, com quatro métricas de topo, três visualizações vivas centrais, tabela de sinais qualificados e rail lateral da DIVA. O visual aprovado é autoridade para `/os/radar`.

Valores do mockup nunca são copiados como dados. O runtime deriva números de fontes reais e expõe freshness/provenance. Gráficos vivos respondem a `/api/intelligence-graphs`, `/api/live-projection` e fontes governadas do MUNDO.
