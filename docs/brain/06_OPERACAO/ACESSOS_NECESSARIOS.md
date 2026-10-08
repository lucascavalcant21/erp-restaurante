# Acessos necessários

O agente registra aqui tudo que precisa de fora e **continua trabalhando no que não depende disso**. Nunca coloque o valor de um segredo aqui nem no chat: só onde configurar.

## Acessos detectados (08/10/2026)

| Serviço | Estado | Como |
|---|---|---|
| GitHub | ✅ | Conector GitHub (push, PR) e `gh` CLI no ambiente da nuvem |
| Supabase | ✅ leitura/SQL | Conector Supabase do claude.ai. A rede do container não alcança `*.supabase.co` |
| Vercel | ⚠️ parcial | Lista projetos, deploys e nomes de variáveis. **Sem logs nem acesso a deploy protegido** (time não autorizado) |
| Navegador | ✅ local | Playwright 1.56 + Chromium em `/opt/pw-browsers`. Sem rede para o preview/produção |
| Google (Gmail, Drive, Calendar) | ⚠️ | Conectores existem e pedem autorização no claude.ai |
| Meta / WhatsApp | ❌ | Nada configurado (só variáveis antigas de preview no Vercel) |

---

## ACESSO-001

- **Serviço:** ambiente de nuvem do Claude Code (rede)
- **Motivo:** fazer o smoke test do preview e da produção (HTTP real) e a QA com Playwright
- **O que precisa ser liberado:**
  - adicionar `app.hefisto.com.br` (e, se quiser testar previews, `*.vercel.app`) em **Allowed domains**;
  - onde: barra de título da sessão → ambiente → Edit → Network access.
- **Escopo mínimo:** só esses domínios
- **Risco:** BAIXO
- **Como validar depois:** `curl -s -o /dev/null -w '%{http_code}' https://app.hefisto.com.br/api/intelligence/brief` deve dar 401 (sem sessão)
- **Estado:** PENDENTE

## ACESSO-002

- **Serviço:** Vercel (conector do claude.ai)
- **Motivo:** ler os logs de runtime do deploy e abrir previews protegidos
- **O que precisa ser liberado:** autorizar o time `lucas-cavalcante` na conexão Vercel do claude.ai (Configurações → Conectores → Vercel)
- **Escopo mínimo:** leitura de deploys e logs do projeto `erp-restaurante`
- **Risco:** BAIXO
- **Como validar depois:** `get_runtime_logs` do projeto responde (hoje dá 403)
- **Estado:** PENDENTE

## ACESSO-003

- **Serviço:** Héfisto (usuário de teste para o agente)
- **Motivo:** login real no preview e na produção para o smoke autenticado (API 200/403, Central, contexto de tela)
- **O que precisa ser liberado:**
  - criar o usuário `hefisto-agent` com perfil **gerente-geral** na unidade de produção, ou numa unidade de teste;
  - colocar e-mail e senha como variáveis **secretas do ambiente** (`HEFISTO_QA_EMAIL`, `HEFISTO_QA_SENHA`), nunca no chat nem no repositório.
- **Escopo mínimo:** um usuário, uma unidade. Sem super admin.
- **Risco:** MÉDIO (é um login real com acesso gerencial)
- **Como validar depois:** o smoke (`scripts/qa/smoke-intelligence.mjs`, HDEV-001) passa
- **Estado:** PENDENTE

## ACESSO-004

- **Serviço:** produção (aprovação do dono)
- **Motivo:** mesclar o PR #127 na `main` (publica o Intelligence Core)
- **O que precisa ser liberado:** aprovação explícita, depois do smoke no preview (ACESSO-001 e 003)
- **Escopo mínimo:** um merge; rollback instantâneo para o deploy `dpl_AqdMC…` se algo falhar
- **Risco:** ALTO (produção)
- **Como validar depois:** smoke em produção + nenhuma página quebrada (Playwright)
- **Estado:** PENDENTE

## ACESSO-005

- **Serviço:** máquina local do dono (runner noturno)
- **Motivo:** rodar `npm run hefisto:noite` com o Claude Code local
- **O que precisa ser liberado:**
  - `claude` instalado e logado;
  - conectores MCP Supabase, Vercel e GitHub configurados no Claude Code local;
  - um branch de trabalho (nunca a `main`).
- **Escopo mínimo:** o repositório clonado
- **Risco:** BAIXO a MÉDIO (o agente edita, commita e faz push no branch dele)
- **Como validar depois:** `npm run hefisto:preparar` mostra tudo OK (Windows/macOS/Linux); depois `npm run hefisto:agent -- --dry-run`
- **Estado:** EM ANDAMENTO
  - 08/10: o dono tentou no Windows (CMD) fora da pasta do projeto.
  - Instruções para Windows e `hefisto:preparar` criados.
  - Opcional: na nuvem dá para usar uma Rotina.

## ACESSO-006

- **Serviço:** Meta (WhatsApp Business Platform)
- **Motivo:** HI-06, WhatsApp Command Channel (HDEV-007)
- **O que precisa ser liberado:**
  - conta Meta Business verificada;
  - app com o produto WhatsApp;
  - número de telefone;
  - token de sistema (permanente);
  - App Secret;
  - URL do webhook apontando para o Héfisto.

  Tudo como variável secreta no Vercel.
- **Escopo mínimo:** `whatsapp_business_messaging` e `whatsapp_business_management` para um número
- **Risco:** MÉDIO
- **Como validar depois:** mensagem de teste do número de teste da Meta chega assinada e é respondida
- **Estado:** PENDENTE (futuro)

## ACESSO-007

- **Serviço:** Google (Gmail, Drive, Calendar; futuramente Search Console e Business Profile)
- **Motivo:** integrações futuras e relatórios
- **O que precisa ser liberado:** autorizar os conectores no claude.ai (hoje pedem autenticação)
- **Escopo mínimo:** leitura, por conector, quando houver missão que precise
- **Risco:** BAIXO
- **Como validar depois:** o conector lista recursos
- **Estado:** PENDENTE (sem missão ainda)
