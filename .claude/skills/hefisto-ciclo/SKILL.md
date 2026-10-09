---
name: hefisto-ciclo
description: Ciclo de trabalho autônomo do Héfisto. Use ao começar ou continuar o desenvolvimento do Héfisto sem instruções detalhadas ("continue", "rode o ciclo", "pegue a próxima missão", rotina noturna, execução pelo runner hefisto:agent) e ao concluir uma missão de docs/brain/03_ROADMAP/missoes.
---

# Ciclo autônomo do Héfisto

Siga o `CLAUDE.md` da raiz. Este é o passo a passo de uma rodada.

## 1. Situar-se (2 minutos)

1. Leia `docs/brain/06_OPERACAO/STATUS_ATUAL.md`, `docs/brain/03_ROADMAP/MISSÕES_ATIVAS.md` e `docs/brain/03_ROADMAP/BLOQUEADORES.md`.
2. Leia `docs/brain/09_INBOX/*`. Pedido novo do dono vira missão em BACKLOG, ou é resolvido na hora se for pequeno.
3. Escolha a missão:
   - Se o runner mandou uma missão, é ela.
   - Senão, rode `npm run hefisto:missoes`: a "próxima automática" é a READY de maior prioridade, com dependências DONE e sem bloqueador.
   - Sem missão READY: diga isso, sugira a próxima a liberar e pare.
4. `git status` e branch: nunca trabalhe na `main`/`master`. Se estiver nela, crie `hefisto/<missao>-<data>`.

## 2. Executar

OBJETIVO → INVESTIGAÇÃO → PLANO (curto, na própria missão) → IMPLEMENTAÇÃO → TESTE → ERRO → CORREÇÃO → RETESTE → VALIDAÇÃO → COMMIT → DOCUMENTAÇÃO.

- **Investigue no código e no banco real** (leitura) antes de supor: o esquema do repositório não é confiável.
- **Teste de verdade:**
  - testes `node:test`;
  - PGlite para SQL (`PGLITE=…`);
  - Playwright para tela (`/opt/pw-browsers`);
  - leitura sob RLS no Supabase para dado real.
- **Commit a cada etapa estável** (checkpoint). Push do branch de trabalho.
- **Teste falhou, build quebrou, bug seu:** corrija e reteste. Não é bloqueio.
- **Mesma falha 3x sem progresso:**
  - pare de insistir;
  - registre as tentativas na missão;
  - marque BLOCKED;
  - vá para uma parte independente ou para outra missão.
- **Precisa de acesso, credencial, aprovação ou decisão de produto:**
  - registre em `BLOQUEADORES.md`;
  - se for acesso, também em `06_OPERACAO/ACESSOS_NECESSARIOS.md`, no formato de lá;
  - continue no que não depende disso.

## 3. Fechar a rodada (obrigatório)

1. Na missão (`docs/brain/03_ROADMAP/missoes/<ID>.md`):
   - **Resultado:** o que mudou para o dono;
   - **Evidências:** cada item com TESTADO EM MOCK / LOCAL / NO SUPABASE REAL / NO PREVIEW / EM PRODUÇÃO / NÃO VALIDADO;
   - `status` no frontmatter:
     - **DONE**: só com o critério de pronto cumprido e validado;
     - **BLOCKED**: bloqueio real registrado;
     - ou mantenha IN_PROGRESS.
2. Memória:
   - bugs em `05_QUALIDADE/BUGS.md`;
   - decisões em `04_DECISOES/*`;
   - aprendizados em `08_APRENDIZADO/*`;
   - o resumo em `06_OPERACAO/STATUS_ATUAL.md` (fora do trecho do runner).
3. `npm run hefisto:missoes` (valida e regenera o índice). Commit da memória. Push.
4. A última linha da resposta deve ser exatamente:

```
HEFISTO_RESULTADO: {"status":"DONE|BLOCKED|IN_PROGRESS","resumo":"uma frase"}
```

## 4. Continuar

Se ainda há tempo e existe outra missão READY sem bloqueio, comece a próxima. O runner faz isso sozinho; numa sessão interativa, siga em frente sem esperar prompt, a menos que o dono tenha pedido outra coisa.
