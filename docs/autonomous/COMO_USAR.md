# Héfisto: agente autônomo — como usar

O agente pega a próxima missão pronta, trabalha, testa, corrige, commita e documenta sozinho. Ele só para por bloqueio real: acesso, credencial, decisão ou aprovação.

## COMO INICIAR

**No seu computador (Windows, macOS ou Linux).** Todos os comandos são iguais no CMD, no PowerShell e no terminal do Mac/Linux. Abra o terminal **dentro da pasta do projeto**.

**1. Só na primeira vez:** pegar o projeto e o branch que tem o agente. Enquanto o PR #127 não entrar na `main`, o agente só existe nesse branch.

```
cd %USERPROFILE%
git clone https://github.com/lucascavalcant21/erp-restaurante.git
cd erp-restaurante
git checkout claude/fervent-bell-t363k5
npm ci
```

- `%USERPROFILE%` é para o CMD. No PowerShell use `cd ~`.
- Se você já tem a pasta do projeto, entre nela e rode `git fetch origin`, depois `git checkout claude/fervent-bell-t363k5`, depois `git pull`.

**2. Toda noite:**

```
cd %USERPROFILE%\erp-restaurante
npm run hefisto:preparar
npm run hefisto:agent -- --dry-run
npm run hefisto:noite
```

- `npm run hefisto:preparar` confere Node, git, branch, `claude`, dependências e missões. Se você estiver na `main`, ele cria o branch `hefisto/noite-AAAA-MM-DD`. Diz o que falta e como resolver.
- `npm run hefisto:agent -- --dry-run` mostra a missão que vai pegar; não muda nada.
- `npm run hefisto:noite` roda a noite inteira e reinicia sozinho se cair. Deixe a janela aberta e o computador sem suspender.

**Só uma missão:** `npm run hefisto:agent -- --uma`.

**Precisa de:**
- **Git e Node.js 20+.**
- **Claude Code instalado e logado uma vez.** Ver "Instalar o Claude Code no Windows" abaixo.
- **Para o agente alcançar o banco e o deploy:** os conectores Supabase/Vercel/GitHub configurados no Claude Code do computador (`claude mcp`). Sem eles, ele trabalha só no código e nos testes locais.

**Na nuvem (claude.ai/code), sem computador ligado:**
1. Crie uma **Rotina** agendada, por exemplo todo dia às 23:50, com uma sessão nova por disparo, neste repositório.
2. Use este prompt:

   > Rode o ciclo autônomo do Héfisto (skill `hefisto-ciclo` e `CLAUDE.md`). Trabalhe a próxima missão READY e continue nas seguintes enquanto houver tempo, até 3 missões. Commite e faça push no seu branch, atualize o PR, gere o relatório noturno em `docs/brain/07_RELATORIOS/NOTURNOS/` e termine com a linha HEFISTO_RESULTADO.

Peça na sessão e o agente cria a Rotina.

## COMO PARAR

| Quero | Comando |
|---|---|
| Parar depois da missão atual | `npm run hefisto:parar` |
| Parar agora (a missão volta para READY) | `npm run hefisto:parar -- --agora` |
| Liberar de novo | `npm run hefisto:parar -- --liberar` |
| Na nuvem | Pause ou apague a Rotina, ou crie `.hefisto-agent/STOP` no branch |

## ONDE VEJO…

| O quê | Onde |
|---|---|
| **Status** (rodando / travado / parado) | `npm run hefisto:status` · `docs/brain/06_OPERACAO/STATUS_ATUAL.md` |
| **Fila de missões** | `docs/brain/03_ROADMAP/MISSÕES_ATIVAS.md` · `npm run hefisto:missoes` |
| **Bloqueadores** | `docs/brain/03_ROADMAP/BLOQUEADORES.md` |
| **Acessos necessários** | `docs/brain/06_OPERACAO/ACESSOS_NECESSARIOS.md` |
| **Relatório da noite** | `docs/brain/07_RELATORIOS/NOTURNOS/AAAA-MM-DD.md` |
| **Log técnico** | `.hefisto-agent/logs/` (fora do git) |

## ONDE COLOCO NOVAS IDEIAS

- **Ideia solta:** `docs/brain/09_INBOX/IDEIAS_DO_DONO.md`. Pedido concreto: `docs/brain/09_INBOX/PEDIDOS_NOVOS.md`. O agente lê e transforma em missão.
- **Criar uma missão direto:** `npm run hefisto:missoes -- nova "Previsão de vendas" --prioridade 2 --depende HDEV-002`. Ela nasce em BACKLOG.
- **Liberar para o agente:** `npm run hefisto:missoes -- pronta HDEV-00X`.

## O QUE O AGENTE FAZ SOZINHO

- Ler, criar e alterar código; refatorar o que está trabalhando.
- Criar e rodar testes e o build; corrigir o que quebrou.
- Instalar dependências confiáveis.
- Branch, commits pequenos, push do branch dele, PR em rascunho.
- Testar o preview (Playwright) e ler logs.
- Escrever migrações aditivas (escrever, não aplicar em produção).
- Ler o banco real; testar escrita só dentro de transação desfeita.
- Atualizar a documentação e a memória (`docs/brain`).

## O QUE EXIGE SUA APROVAÇÃO

- **Banco:** `DROP`, `DELETE` em massa, `TRUNCATE`, migração destrutiva, mudança de RLS/policy/grant em produção, rodar rollback.
- **Produção:** merge na `main` / deploy.
- **Dinheiro:** pagamentos, transferências, orçamento de anúncio, excluir campanha.
- **Contas e ambiente:** excluir usuário, senha/2FA, apagar ambiente, trocar segredo crítico.
- Qualquer coisa irreversível.

O agente registra o pedido em BLOQUEADORES/ACESSOS e segue no resto.

## TRAVAS DE SEGURANÇA (`scripts/hefisto-agent/config.json`)

- **Teto de gasto por rodada:** `--max-budget-usd 10`. Ajuste se quiser.
- **Ferramentas permitidas e proibidas.** Proibidas: force push, push na main, `reset --hard`, `rm -rf`, reset/push de banco, merge de PR, deploy de produção, `psql`, `curl`.
- **Por execução:** até 6 missões, 8 horas, 90 minutos por missão.
- **Anti-loop:**
  - a mesma falha 3x → BLOCKED;
  - 2 rodadas sem progresso → BLOCKED;
  - 6 rodadas → BLOCKED.
- **Lock:** um runner por vez.
- **Heartbeat** a cada minuto. O status acusa TRAVADO depois de 15 minutos sem sinal, com código de saída 2, para um cron poder reagir.

## NAVEGADOR DO AGENTE (perfil dedicado `hefisto-agent`)

- **QA usa o Playwright com Chromium próprio**, nunca o seu navegador pessoal.
  - Em cada teste, um contexto limpo.
  - Quando precisar manter login: `chromium.launchPersistentContext('.hefisto-agent/browser/hefisto-agent')`. Fica fora do git.
- **Login de teste:** usuário `hefisto-agent` (ACESSO-003).
  - Credenciais só como variáveis secretas do ambiente: `HEFISTO_QA_EMAIL`, `HEFISTO_QA_SENHA`.
  - Nunca no chat nem no repositório.
