# Héfisto — Cérebro do projeto

Memória operacional do Héfisto, para o dono e para o agente autônomo.

**Como abrir no Obsidian:** "Open folder as vault" → `docs/brain`. Não precisa do app aberto: tudo é Markdown versionado no git.

## Comece por aqui

| Quero saber… | Abra |
|---|---|
| Como está o projeto agora | [[STATUS_ATUAL]] |
| O que o agente está fazendo / vai fazer | [[MISSÕES_ATIVAS]] |
| O que está travado | [[BLOQUEADORES]] |
| O que preciso liberar (acessos) | [[ACESSOS_NECESSARIOS]] |
| O que aconteceu à noite | `07_RELATORIOS/NOTURNOS/` (um arquivo por dia) |
| Onde deixo uma ideia ou um pedido | [[IDEIAS_DO_DONO]] · [[PEDIDOS_NOVOS]] |
| Para onde o produto vai | [[VISAO_HEFISTO]] · [[ROADMAP]] |

## Mapa

- `01_VISAO`: [[VISAO_HEFISTO]] · [[PRINCIPIOS_PRODUTO]] · [[OBJETIVOS_LONGO_PRAZO]]
- `02_ARQUITETURA`: [[ARQUITETURA_ATUAL]] · [[INTELLIGENCE_CORE]] · [[BANCO_SUPABASE]] · [[INTEGRACOES]] · [[SEGURANCA]]
- `03_ROADMAP`: [[ROADMAP]] · [[MISSÕES_ATIVAS]] · [[BACKLOG]] · [[BLOQUEADORES]] · `missoes/` (uma missão por arquivo)
- `04_DECISOES`: [[DECISOES_ARQUITETURAIS]] · [[DECISOES_PRODUTO]]
- `05_QUALIDADE`: [[BUGS]] · [[TESTES]] · [[REGRESSOES]] · [[DEBITO_TECNICO]]
- `06_OPERACAO`: [[STATUS_ATUAL]] · [[ACESSOS_NECESSARIOS]] · [[DEPLOYS]] · [[INCIDENTES]]
- `07_RELATORIOS`: `DIARIOS/` · `MISSOES/` · `NOTURNOS/`
- `08_APRENDIZADO`: [[PADROES_DESCOBERTOS]] · [[ERROS_QUE_NAO_DEVEM_REPETIR]] · [[REGRAS_DO_PROJETO]]
- `09_INBOX`: [[IDEIAS_DO_DONO]] · [[PEDIDOS_NOVOS]]

## Regras desta memória

- **Só informação útil:**
  - decisão, arquitetura, problema importante, solução, aprendizado, bloqueador, mudança de estado ou conclusão;
  - nunca a lista de comandos triviais.
- **Toda afirmação de que algo funciona diz onde foi validada:** TESTADO EM MOCK · TESTADO LOCAL · TESTADO NO SUPABASE REAL · TESTADO NO PREVIEW · TESTADO EM PRODUÇÃO · NÃO VALIDADO.
- **Nunca segredo:** nem valor de chave, senha ou token; só o NOME da variável.
- **Trechos `<!-- hefisto-agent:… -->`** são regenerados pelo runner. O resto do arquivo é livre.

Como ligar e desligar o agente: `docs/autonomous/COMO_USAR.md`.
