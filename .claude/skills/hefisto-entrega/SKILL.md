---
name: hefisto-entrega
description: Como testar, versionar e publicar no Héfisto (GitHub lucascavalcant21/erp-restaurante + Vercel erp-restaurante, domínio app.hefisto.com.br). Use ao rodar a suíte de testes, criar branch/commit/PR, resolver conflito, conferir checks e deploy, ou investigar falha de build/preview.
---

# Testes, GitHub e Vercel

Skill de base: não depende de nenhuma outra.

## Testes (antes de cada commit relevante)

| Suíte | Comando |
|---|---|
| Unitários | `node --test app/lib/*.test.mjs app/lib/**/*.test.mjs` |
| Rotas e permissões | `node app/lib/permissions-catalog.test.mjs` |
| Intelligence | `npm run test:intelligence` |
| Agente, QA, WhatsApp | `npm run test:agent`, `npm run test:qa`, `npm run test:whatsapp` |
| Skills | `npm run test:skills` |
| SQL real (PGlite) | `PGLITE=<caminho>/node_modules/@electric-sql/pglite node app/lib/<arquivo>.test.mjs` |
| Build | `npm run build` (apague `.next` antes; o OneDrive quebra o `readlink`) |

- Falha que já existe na `main` não é regressão sua: rode o mesmo teste na `main` e diga isso no relatório, com o nome do teste.
- Sem `PGLITE`, os testes de SQL **pulam**. Pular não é passar.
- Teste que depende da data de hoje: fixe a data (modelo: `app/lib/contas-pagar.test.mjs`).

## Git

- Nunca trabalhe na `main`. Branch `claude/<assunto>` ou `hefisto/<missao>-<data>`.
- Commits pequenos, em português, com o prefixo do histórico (`feat`, `fix`, `docs`, `chore`, `feat(estoque)`…).
- Nunca commitar `docs/brain/06_OPERACAO/STATUS_ATUAL.md` nem `docs/brain/07_RELATORIOS/NOTURNOS/*`.
- Conflito: leia os dois lados e decida arquivo a arquivo. Nada de resolução automática em lote (ours/theirs). Arquivo apagado de um lado e corrigido do outro: confira quem usa antes de decidir.

## PR e publicação

1. Push do branch; PR com: o que mudou para o dono, testes rodados e onde cada coisa foi validada (MOCK / LOCAL / SUPABASE REAL / PREVIEW / PRODUÇÃO / NÃO VALIDADO).
2. Espere os checks (`gh pr checks <n>`). Falhou: corrija e reteste.
3. **Merge na `main` = publicação em produção.** Só com autorização explícita do dono, no chat, para aqueles PRs. O `.claude/settings.json` bloqueia `gh pr merge`, push na `main`, force push e `vercel --prod` de propósito. Não contorne.
4. Depois do merge: confira o deploy de Production na Vercel e abra a tela afetada em `app.hefisto.com.br`.

## Problemas conhecidos

- **Preview sem login (`MISSING_PUBLIC_SUPABASE_CONFIG`):** as variáveis `NEXT_PUBLIC_SUPABASE_*` estão só no ambiente Production da Vercel. Isso não é bug do código.
- **Chrome lento com pouca memória:** valide pelo DOM/JS e com iframes de 390 px e 820 px. Diga que a largura foi simulada, não um aparelho de verdade.
