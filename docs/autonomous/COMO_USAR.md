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

**24 horas por dia:** no lugar do `hefisto:noite`, use `npm run hefisto:continuo`.
- Ele não para quando acabam as missões: espera 15 minutos e confere de novo. Missão nova que você liberar (`npm run hefisto:missoes -- pronta HDEV-00X`) entra sozinha.
- **Teto de gasto por dia:** US$ 40 (`maxCustoPorDiaUsd` no `config.json`). Bateu o teto, ele espera o dia virar.
- **Limite de uso do Claude:** se a sua assinatura bater o limite, ele espera 30 minutos e tenta de novo. A missão não conta como falha.
- Cada dia tem o seu relatório em `docs/brain/07_RELATORIOS/NOTURNOS/AAAA-MM-DD.md`.
- Deixe o computador ligado e sem suspender (Windows: Configurações → Sistema → Energia → "Suspender: Nunca").
- `npm run hefisto:status` mostra **AGUARDANDO** quando ele está esperando missão, teto ou limite.

**Só uma missão:** `npm run hefisto:agent -- --uma`.

**Precisa de:**
- **Git e Node.js 20+.**
- **Claude Code instalado e logado uma vez.** Ver "Instalar o Claude Code no Windows" abaixo.
- **Para o agente ler o banco e o deploy:** os conectores Supabase e Vercel que você já ligou no claude.ai. Eles aparecem sozinhos no Claude Code do computador quando você entra com a **mesma conta**. Ver "Conectores à noite" abaixo. Sem eles, o agente trabalha só no código e nos testes locais.

### Instalar o Claude Code no Windows (uma vez)

O app Claude Desktop **não** basta: o agente precisa do Claude Code de linha de comando. Requisitos: Windows 10 1809+ de 64 bits e plano Pro, Max, Team ou Enterprise. Fonte: https://code.claude.com/docs/en/setup.md.

| Onde | Comando |
|---|---|
| **CMD** (cole a linha inteira) | `curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd` |
| **PowerShell** | `irm https://claude.ai/install.ps1 \| iex` |
| Alternativa com npm (Node 22+) | `npm install -g @anthropic-ai/claude-code` |

Depois:
1. **Feche e abra o terminal** e confira: `claude --version`. Deve aparecer `… (Claude Code)`.
2. **Faça login uma vez:** rode `claude` dentro da pasta do projeto. O navegador abre; entre e depois feche com `/exit`.
3. **Se `claude` não for encontrado:** o instalador põe o programa em `%USERPROFILE%\.local\bin\claude.exe`. Adicione essa pasta ao PATH do usuário (Configurações → Variáveis de ambiente), ou aponte direto: `set HEFISTO_AGENT_CLAUDE=%USERPROFILE%\.local\bin\claude.exe`.
4. **Se `claude` abrir o app Claude Desktop:** um Claude Desktop antigo pode ter tomado o nome. Rode `where.exe claude` e use o `HEFISTO_AGENT_CLAUDE` acima.
5. **Recomendado: Git for Windows** (https://git-scm.com/downloads/win). O agente roda os comandos no Git Bash. Sem ele, usa o PowerShell, e as regras do agente cobrem os dois.

**Cobrança:** se a variável `ANTHROPIC_API_KEY` estiver definida no seu computador, o `claude -p` cobra na API, e não na sua assinatura. O `npm run hefisto:preparar` avisa quando isso acontece.

### Conectores à noite (Supabase e Vercel)

**Você não precisa configurar nada de novo.** Os conectores que já estão ligados no claude.ai valem também no Claude Code do computador, desde que:
- você tenha entrado no `claude` com a **mesma conta** do claude.ai (`claude`, depois `/login`);
- a variável `ANTHROPIC_API_KEY` **não** esteja definida. Com ela, o Claude Code usa a API e os conectores do claude.ai não carregam.

**Conferir:** `npm run hefisto:preparar` faz um teste rápido (modelo haiku, centavos) e mostra uma linha para cada conector:
- `OK Conector Supabase: carregado …`: pronto.
- `AVISO … precisa autorizar`: rode `claude` na pasta do projeto, digite `/mcp`, escolha o conector e **Authenticate**.
- `AVISO … não apareceu`: confira a conta e a `ANTHROPIC_API_KEY` (acima).
- Para pular o teste: `npm run hefisto:preparar -- --sem-conectores`.

**O que o agente pode fazer com eles à noite (sem ninguém olhando):**

| Pode (leitura) | Nunca, sem você |
|---|---|
| **Supabase:** consultar com SQL de leitura, listar tabelas, migrações e extensões, ver os avisos de segurança e desempenho (advisors), ler os logs, buscar na documentação | aplicar migração, escrever no banco (mesmo em teste), criar/apagar/resetar branch, mexer em funções e segredos, pausar ou restaurar o projeto |
| **Vercel:** ver projetos, deploys, logs de build e de execução, erros, domínios; abrir uma URL do deploy; buscar na documentação | deploy, promover ou reverter produção, ver ou mudar variáveis de ambiente, mudar projeto, domínio ou firewall, comprar qualquer coisa |

**Como isso é garantido** (não depende do agente obedecer):
- O motor roda no modo `dontAsk`: qualquer ferramenta fora da lista de leitura é **negada**. As de escrita nem aparecem para ele.
- O SQL passa pela guarda `scripts/hefisto-agent/guarda-sql.mjs`:
  - aceita só `SELECT`, `WITH`, `EXPLAIN`, `SHOW`, `VALUES`, `TABLE` e `SET LOCAL`;
  - só no projeto do Héfisto;
  - recusa tudo que mexe no modo da transação, rede, arquivos do servidor, funções administrativas e lugares com segredo (`vault`, `auth.*`);
  - roda a consulta dentro de `begin transaction read only … rollback`: mesmo que algo escape, o Postgres recusa qualquer escrita, e o `rollback` desfaz tudo.
- **Falha fechada:** se a guarda quebrar ou não rodar, o SQL é negado.
- **Log:**
  - cada consulta aprovada ou recusada fica em `.hefisto-agent/logs/guarda-sql.log`;
  - as regras em vigor ficam em `.hefisto-agent/motor-settings.json`;
  - os conectores encontrados ficam em `.hefisto-agent/conectores.json`.

Escrita de teste no banco real (o `do $$ … raise exception $$` do `CLAUDE.md`) só numa sessão com você acompanhando.

**GitHub:** o agente usa o `git` e o `gh` do computador (push só no branch dele; merge proibido). Para o `gh`, rode `gh auth login` uma vez.

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
- **Ferramentas permitidas e proibidas** (modo `dontAsk`: o que não está liberado é negado).
  - Proibidas: force push, push na main, `reset --hard`, `rm -rf`, reset/push de banco, merge de PR, deploy de produção, `psql`, `curl`.
- **Conectores Supabase/Vercel só leitura**, com o SQL pela guarda (seção "Conectores à noite"). Lista em `conectores` no `config.json`.
- **Por execução** (`hefisto:noite`): até 6 missões e 8 horas. No `hefisto:continuo` esses dois não valem; vale o teto de gasto por dia.
- **Por missão:** 90 minutos por rodada.
- **Teto de gasto por dia:** US$ 40 (`maxCustoPorDiaUsd`).
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
