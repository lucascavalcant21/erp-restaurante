---
name: hefisto-diagnostico
description: Diagnóstico de problema em produção ou no preview do Héfisto (tela quebrada, erro 500, login falhando, MISSING_PUBLIC_SUPABASE_CONFIG, "X is not defined", dado sumido, deploy com falha). Use quando o dono relatar que algo parou de funcionar, antes de mexer no código.
---

# Diagnóstico

Ordem fixa: **reproduzir → isolar → causa → correção mínima → teste → relatório**. Nada de corrigir no escuro.

## 1. Reproduzir sem mudar nada

- Onde: produção (`app.hefisto.com.br`), preview ou local? Qual tela, qual usuário, desde quando?
- Abra a tela e leia o console e a rede. Erro de JS no console costuma dar a linha.
- Último deploy: `gh pr list --state merged --limit 5` e o histórico de deploys na Vercel. O erro começou junto com um merge?

## 2. Causas já vistas (confira primeiro)

| Sintoma | Causa conhecida |
|---|---|
| Login no preview: `MISSING_PUBLIC_SUPABASE_CONFIG` | `NEXT_PUBLIC_SUPABASE_*` só existem no ambiente Production da Vercel. Não é bug do código. Não invente valor. |
| Tela cai com "Loader2 is not defined" ou outro nome | Import faltando, introduzido num commit recente. Ache-o com `git log -S`. |
| `ChunkLoadError` depois de deploy | Aba antiga com bundle velho (`app/lib/erro-chunk.mjs` trata) |
| Build local: `readlink EINVAL` | OneDrive dentro de `.next`: apague `.next` |
| RPC "function does not exist" | O código chama objeto que não existe no banco (ex.: `registrar_movimento_estoque`). Confira no catálogo. |
| Saldo de estoque absurdo (24 ml no lugar de 24 garrafas) | Conversão de unidade: veja `hefisto-estoque` |

## 3. Isolar

- Banco: leitura sob RLS como o usuário afetado. Siga `hefisto-seguranca-supabase`.
- Código: rode o teste do módulo; escreva um teste que reproduz o bug **antes** de corrigir.

## 4. Corrigir e entregar

- A menor correção que resolve a causa, num branch, com teste. Publicar segue `hefisto-entrega`: merge na `main` só com o OK do dono.
- Hotfix urgente não pula teste nem autorização.

## Proibido para "destravar"

Desligar autenticação ou RLS, trocar senha, mexer em dado de produção, apagar ambiente ou variável na Vercel. Registre em `docs/brain/06_OPERACAO/INCIDENTES.md` e o bug em `docs/brain/05_QUALIDADE/BUGS.md`.

## Relatório

O que quebrou, para quem e desde quando. A causa, com a evidência. A correção e onde foi validada. O que ainda falta.
