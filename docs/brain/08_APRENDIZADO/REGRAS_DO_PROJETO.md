# Regras do projeto

As regras permanentes estão no `CLAUDE.md` da raiz; aqui fica o resumo para consulta rápida no Obsidian.

- **Prioridade:** segurança > integridade dos dados > funcionamento > novas features.
- **Nunca inventar número.** Sem base: DADOS INSUFICIENTES. Natureza de toda métrica: REAL / ESTIMATIVA / PROJEÇÃO / SIMULAÇÃO / HIPÓTESE.
- **Toda validação diz onde:** MOCK / LOCAL / SUPABASE REAL / PREVIEW / PRODUÇÃO / NÃO VALIDADO.
- **Reusar o ERP** (estoque, compras, financeiro, RH, eventos, CRM, fichas, permissões, auditoria). Nunca lógica paralela.
- **Migrações:**
  - só aditivas;
  - com preflight que aborta, transação, verificação e rollback documentado;
  - nunca aplicar destrutiva sem aprovação;
  - nunca rodar um rollback sem decisão do dono.
- **Produção:** merge na `main`, mudança de RLS/policy/grant, dados reais e integrações externas são ações controladas, com aprovação do dono.
- **Segredos:** só nome de variável; nunca valor em chat, código, commit, log ou memória.
- **Commits:**
  - pequenos, em português, prefixos `feat`, `fix`, `chore`, `docs` (como no histórico);
  - um checkpoint por etapa estável;
  - nunca na `main`, nunca force push.
- **Não reescrever módulo estável** só por estética.
