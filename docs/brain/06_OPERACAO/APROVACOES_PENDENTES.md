# Aprovações pendentes

Pedidos do agente que **só o dono decide** (risco HIGH/CRITICAL, produção, banco real, ações da lista do CLAUDE.md).
O agente para só a etapa pedida e segue no resto. Regras em [[POLITICA_PUBLICACAO]].

- Ver: `npm run hefisto:aprovacoes`
- Decidir: `npm run hefisto:aprovacoes -- aprovar APR-001` ou `-- rejeitar APR-001 "motivo"`
- Depois de executar: `npm run hefisto:aprovacoes -- executado APR-001`

Status: PENDENTE → APROVADO / REJEITADO → EXECUTADO. Não apague seções: é o histórico.

**Pendentes agora: 1** (APR-011; APR-007: falta só o merge do PR #171)

### APR-001 · EXECUTADO

- **Missão:** HDEV-SEC-001
- **Ação:** Aplicar db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql no Supabase real (isolamento por unidade em 88 tabelas; liga RLS em colaboradores e registro_ponto)
- **Ambiente:** supabase (produção)
- **Risco:** HIGH
- **Motivo:** Mudança de RLS/policy em produção (CLAUDE.md: confirmação do dono). Corrige S-01 e S-02: hoje qualquer usuário logado de qualquer empresa lê e grava 88 tabelas, inclusive salário, CPF e ponto.
- **Impacto:** Hoje (1 unidade, 16 usuários): ninguém perde acesso (conferido no banco real, só leitura). Muda: outra empresa/unidade não vê nem grava. Trava ACCESS EXCLUSIVE breve em 88 tabelas (rodar fora do horário de pico). Insert sem unidade_id recebe a unidade do usuário.
- **Rollback:** db/security/SEC_RLS_1_ROLLBACK.sql (recria as policies guardadas em sec_backup_policies_sec_rls_1; testado no PGlite: volta exatamente ao estado anterior)
- **Evidências:** PGlite com as policies reais de produção: 8/8 (antes vaza; depois cada usuário só a sua unidade nas 88 tabelas; preflight aborta sem mudar nada com dado órfão, policy desconhecida e usuário sem unidade; rollback exato). Banco real (só leitura): 16/16 usuários passam; 0 linhas órfãs nas 88. Política: REVIEW/HIGH.
- **Comando/alteração:** `Rodar o arquivo inteiro (SQL Editor ou apply_migration). Depois: db/security/AUDITORIA_RLS.sql deve mostrar 0 'aguarda SEC-RLS-1' e 0 'NOVO'.`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-08 22:13
- **Decidido em:** 2026-10-09 00:17
- **Decidido por:** lucas
- **Nota:** Aplicada em 08/10/2026 ~21:20 (horário de Brasília) em sessão acompanhada. Verificação OK; impressão digital dd885d7643ca73191ec17bc356fed4c1; AUDITORIA_RLS: 0 aguarda, 0 NOVO, 33 fase 2
- **Chave:** migracao:db/security/SEC_RLS_1_ISOLAMENTO_POR_UNIDADE.sql

### APR-002 · EXECUTADO

- **Missão:** HDEV-SEC-002
- **Ação:** Aplicar db/security/SEC_RLS_2_FASE2.sql no Supabase real (fase 2 do isolamento: 31 tabelas, dados sensíveis de colaboradores, pode_ver_todas só super admin, token_nfe sem leitura pelo navegador)
- **Ambiente:** supabase (produção)
- **Risco:** HIGH
- **Motivo:** Mudança de RLS, policies, funções de acesso e privilégio de coluna em produção (CLAUDE.md: confirmação do dono). Fecha S-14, S-16 (token_nfe legível por qualquer logado) e S-17 (CPF/salário/documentos de RH legíveis na unidade); isola 33 tabelas restantes.
- **Impacto:** Hoje: gerente-geral (2) e super admin sem mudança. Cozinheiro (2) e somente-consulta (11) deixam de ver CPF, salário, endereço e documentos de RH dos colegas; as telas continuam com nome, cargo e horários (app atualizado). Registros legados (burguer, ticotico, todas, sem unidade) ficam só para o super admin, sem apagar nem mover. Exige o app novo (commit b5ba58b) no ar junto: unidades sem select * e tela fiscal sem ler o token. Trava ACCESS EXCLUSIVE breve em ~31 tabelas, lock_timeout 5s.
- **Rollback:** db/security/SEC_RLS_2_ROLLBACK.sql: recria as 37 policies e as 3 funções guardadas (sec_backup_policies_sec_rls_2 / sec_backup_funcoes_sec_rls_2) e devolve a leitura de token_nfe; testado no PGlite: volta exatamente ao estado da fase 1. Não apaga sec_dados_legados nem as 2 colunas unidade_id novas (aditivas).
- **Evidências:** PGlite com 2 empresas e as policies reais: os 15 testes obrigatórios + token_nfe + preflight + rollback (test:seguranca 24/24). test:agent 56/56, test:intelligence 130/130, test:qa 6/6, permissões OK, 55 testes do app OK, build OK. Simulação do preflight no banco real (só leitura): 0 tabelas faltando, 88 sec_unidade, 0 usuários sem unidade, 0 policies desconhecidas, 37 a trocar.
- **Comando/alteração:** `Rodar o arquivo inteiro (transação única; preflight aborta sem mudar nada). Depois: AUDITORIA_RLS.sql deve mostrar só as 3 linhas GLOBAL. NÃO inclui a reatribuição do evento (SEC_RLS_2_REATRIBUIR_EVENTO.sql precisa de aprovação própria).`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-09 02:02
- **Decidido em:** 2026-10-09 02:05
- **Decidido por:** lucas
- **Nota:** Aplicada em 09/10/2026 ~00:05 (horário de Brasília) em sessão acompanhada, pelo conector Supabase, arquivo inteiro numa transação; preflight e verificação internos passaram (commit). Produção no ar antes: `5dea452` (contém `b5ba58b`). AUDITORIA_RLS depois: só as 3 linhas GLOBAL, 0 aguarda, 0 NOVO (TESTADO NO SUPABASE REAL). Smoke HTTP de produção sem sessão OK (TESTADO EM PRODUÇÃO). **Validação no Supabase real (09/10 ~00:20, só leitura, papel `authenticated` com o `sub` de um usuário real de cada perfil), TESTADO NO SUPABASE REAL:** backup 37 policies + 3 funções; impressão `9810b27e3d9a604b28933f84751db167`; legados classificados 46 (AMBIGUO 28, LEGADO 17, ORFAO 1), nada apagado; `token_nfe` sem SELECT para authenticated e anon, `hefisto_token_nfe_configurado` = true. Cozinheiro e somente-consulta: 0 linhas diretas de colaboradores, 0 CPF/salário, 0 documentos de RH; lista operacional 23 sem campo sensível; escala 1, registro_ponto 392 (iguais ao gerente); 1 unidade; 0 linha fora da unidade. Gerente geral: 23 colaboradores com dados de RH, 1 documento de RH, 1 unidade, 0 fora da unidade. Super admin: vê os 15 registros legados de notas e os 16 usuários. Entre empresas: produção tem 1 empresa só; isolamento entre empresas TESTADO LOCAL (PGlite, 2 empresas, test:seguranca 24/24). Smoke HTTP de produção sem sessão OK depois da aplicação. **SEC-RLS-2 CONCLUÍDA EM PRODUÇÃO.** Pendente fora do banco: smoke com sessão (`HEFISTO_QA_TOKEN`).
- **Chave:** migracao:db/security/SEC_RLS_2_FASE2.sql

### APR-003 · EXECUTADO

- **Missão:** HDEV-WA-001
- **Ação:** Aplicar db/whatsapp/WA_001_FILA.sql no Supabase real (fila dos comandos do agente pelo WhatsApp: 2 tabelas novas e 1 função, só o servidor acessa)
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM
- **Motivo:** Escrita de esquema em produção (aditiva). Sem ela, os comandos do agente pelo WhatsApp respondem fila indisponível; perguntas sobre a empresa funcionam sem ela
- **Impacto:** –
- **Rollback:** db/whatsapp/WA_001_ROLLBACK.sql (apaga só a fila nova)
- **Evidências:** –
- **Comando/alteração:** `–`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-09 02:57
- **Decidido em:** 2026-10-09 03:02
- **Decidido por:** lucas
- **Nota:** aplicada 09/10 ~01:00 em sessão acompanhada; verificação OK: RLS ligado, 0 policy, sem SELECT para anon/authenticated, função só service_role; 0 tabelas sem RLS no schema public (TESTADO NO SUPABASE REAL)
- **Chave:** migracao:db/whatsapp/WA_001_FILA.sql

### APR-004 · EXECUTADO

- **Missão:** HDEV-WA-COEX-001
- **Ação:** Aplicar db/whatsapp/WA_002_EVENTOS.sql no Supabase real (trilha de auditoria do canal WhatsApp: 1 tabela nova, só o servidor acessa)
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM
- **Motivo:** Escrita de esquema em produção (aditiva). Os logs da Vercel duram 1 hora; sem a tabela, message_id, recibos e erros da Meta/YCloud se perdem. O canal funciona sem ela
- **Impacto:** –
- **Rollback:** db/whatsapp/WA_002_ROLLBACK.sql (apaga só a trilha nova)
- **Evidências:** –
- **Comando/alteração:** `–`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-10 11:24
- **Decidido em:** 2026-10-10 11:25
- **Decidido por:** lucas
- **Nota:** aplicada 10/10 ~08:30 em sessão acompanhada; verificação OK: RLS ligado, 0 policy, sem SELECT para anon/authenticated; 0 tabelas sem RLS; rota de saúde vê a tabela (TESTADO NO SUPABASE REAL)
- **Chave:** migracao:db/whatsapp/WA_002_EVENTOS.sql

### APR-005 · EXECUTADO

- **Missão:** Reformulação da Marmitaria (PR #168)
- **Ação:** Aplicar db/MARMITARIA_V2_REFORMULACAO.sql no Supabase real (tabela marmitaria_vendas com RLS sec_unidade, funções marmitaria_salvar_ficha e marmitaria_registrar_producao, 5 colunas em marmitaria_configuracoes)
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM
- **Motivo:** Escrita de esquema em produção (aditiva, nada apagado). Sem ela as telas novas da marmitaria mostram "atualização pendente" e o cadastro não salva
- **Impacto:** nenhum dado existente é alterado; funções SECURITY INVOKER (valem as policies de quem chama); EXECUTE só para authenticated
- **Rollback:** documentado no cabeçalho do arquivo (não rodar sem decisão do dono)
- **Evidências:** 37 casos no PGlite (app/lib/marmitaria/marmitaria-banco.test.mjs); ensaio no banco real em transação desfeita em 14/10 (salvar 2x = atualização, códigos MARM-0002/0003, RLS, venda) e rollback conferido
- **Status:** EXECUTADO
- **Criado em:** 2026-10-14
- **Decidido em:** 2026-10-14 (dono: "pode publicar e fazer o merger")
- **Nota:** aplicada 14/10 ~15:50; verificação 9/9 OK (tabela, RLS, policy, 2 funções, coluna, anon sem acesso, 167 fichas intactas); advisors sem alerta novo. PR #168 mergeado (7605a02). TESTADO NO SUPABASE REAL
- **Chave:** migracao:db/MARMITARIA_V2_REFORMULACAO.sql

### APR-006 · EXECUTADO EM PARTE

- **Missão:** Cadastro do iFood (PR do branch claude/ifood-cadastro)
- **Ação:** (1) Aplicar db/integracoes/IFOOD_1_CONEXAO.sql no Supabase real: 3 tabelas de integração, RLS sem policy, só o servidor acessa. (2) Dono cria a variável INTEGRATION_MASTER_KEY (32+ caracteres aleatórios) na Vercel, ambiente Production. (3) Merge do PR.
- **Ambiente:** supabase + vercel (produção)
- **Risco:** MEDIUM
- **Motivo:** sem as tabelas e sem a chave do cofre não há onde guardar a credencial do iFood com segurança
- **Rollback:** no cabeçalho do arquivo (apaga a conexão salva)
- **Evidências:** PGlite: anon/authenticated sem acesso às 3 tabelas, idempotente; 8 testes da lógica (segredo nunca volta à tela nem vai em texto puro; "Conectado" só com o merchant confirmado pelo iFood)
- **Status:** EXECUTADO EM PARTE
- **Criado em:** 2026-10-14
- **Decidido em:** 2026-10-14 (dono: "eu autorizo")
- **Nota:** (1) IFOOD-1 aplicada 14/10 e verificada (3 tabelas com RLS, 0 policies, anon/authenticated sem acesso). (3) PR #169 mergeado (2b7ab03). (2) INTEGRATION_MASTER_KEY criada pelo dono; deploy de produção de 17:31 confirmado pelo GitHub; servidor responde cofreConfigurado=true (TESTADO EM PRODUÇÃO, 14/10, sem expor valor). Falta só o cadastro das credenciais reais do iFood pelo dono.
- **Chave:** migracao:db/integracoes/IFOOD_1_CONEXAO.sql

### APR-007 · EXECUTADO EM PARTE

- **Missão:** Pedidos do iFood na Marmitaria (branch claude/ifood-2-pedidos)
- **Ação:** (1) Aplicar db/integracoes/IFOOD_2_PEDIDOS.sql no Supabase real: 3 tabelas (pedidos, itens → marmita, repasses), 5 colunas de fila em integration_events, 2 funções. (2) Merge do PR.
- **Ambiente:** supabase + vercel (produção)
- **Risco:** MEDIUM
- **Motivo:** sem as tabelas os pedidos do iFood não têm onde ser gravados; a tela mostra "atualização pendente"
- **Impacto:** nada existente é alterado (só colunas novas em integration_events, que está vazia). delivery_gravar_pedido só para service_role; marmitaria_baixar_pedidos passa por estoque_movimentar com o usuário logado. Sem credencial do iFood nada é buscado.
- **Rollback:** no cabeçalho do arquivo (apaga pedidos importados; vendas importadas ficam)
- **Evidências:** 26 casos de SQL real no PGlite (isolamento por unidade, idempotência, status só avança, baixa com versão); 37 casos de ponta a ponta da sincronização; 22 do núcleo; suíte app/lib inteira e build verdes
- **Status:** EXECUTADO EM PARTE
- **Criado em:** 2026-10-14
- **Decidido em:** 2026-10-14 (dono: "aprove a pr007")
- **Nota:** (1) migração ifood_2_pedidos aplicada 14/10 (~21h) e verificada: 3 tabelas com RLS (pedidos 2 policies, itens 1, repasses 1), anon sem acesso, authenticated sem gravar pedido nem mudar status (só separacao), delivery_gravar_pedido só service_role, marmitaria_baixar_pedidos só authenticated, 5 colunas novas na fila, 167 fichas intactas; ensaio em transação desfeita (pedido regravado = 1 linha, status não volta, venda 1x). Advisor: só o aviso esperado de SECURITY DEFINER executável por authenticated (mesmo padrão de estoque_movimentar). TESTADO NO SUPABASE REAL. (2) Merge do PR #171: pendente (bloqueado pela checagem de permissão do agente; o dono faz o merge).
- **Chave:** migracao:db/integracoes/IFOOD_2_PEDIDOS.sql

### APR-011 · PENDENTE

- **Missão:** S-25, S-26, S-28 e B-013 — rotas de API sem login; servidor antigo exposto
- **Ação:** merge do PR SEC-API-1 (deploy de produção)
  - vercel.json manda todo /api para o Next (menos auth/policy e o cron antigo);
  - sessão obrigatória nas rotas de IA, OCR e hefisto;
  - export só para super admin;
  - fiscal e integrações com vínculo de unidade;
  - cron sem segredo padrão
- **Ambiente:** vercel (produção)
- **Risco:** HIGH (muda o roteamento de produção e liga telas que estavam mortas, entre elas Usuários e Perfis)
- **Motivo:** hoje qualquer pessoa usa as chaves de IA (OpenAI pelo servidor antigo; Anthropic pelas rotas ia-*) e grava no Firestore antigo sem login
- **Impacto:**
  - quem usa logado não muda;
  - chamadas sem login passam a dar 401;
  - Usuários/Perfis, OCR, comprovante por e-mail e IAs de evidência/receita/cardápio voltam a funcionar;
  - Saipos sem mudança.
  - Detalhes em docs/brain/07_RELATORIOS/SEC_API_1_ROTAS.md
- **Rollback:** reverter o commit do PR (o vercel.json antigo volta inteiro); não há mudança de banco
- **Evidências:** 25 testes da SEC-API-1 (22 rotas reais com 401 sem sessão e sem chamar IA, integrações, cron); trava do vercel.json; app/lib 504/504; build; bundle sem service_role. Telas logadas NÃO VALIDADO (Preview sem variáveis públicas)
- **Status:** PENDENTE
- **Criado em:** 2026-10-14
- **Chave:** deploy:vercel.json:sec-api-1

### APR-012 · EXECUTADO

- **Missão:** Pedido do dono 17/10: Marmitaria e Eventos
- **Ação:** Aplicar db/EVENTOS_ORC_1_COLUNAS_DO_ORCAMENTO.sql no Supabase real (5 colunas novas em eventos: operacao_detalhes, historico_pagamentos, hora_inicio, hora_fim, observacoes)
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM
- **Motivo:** O banco real não tem essas colunas (conferido 17/10): o orçamento em etapas não grava nada, os pagamentos do evento falham, duplicar evento falha e a Agenda escondia os eventos. O app novo já avisa em vez de quebrar, mas só a migração faz o orçamento ficar salvo.
- **Impacto:** Só aditiva: colunas novas com default; nenhuma linha existente muda (2 eventos hoje). Não mexe em RLS, policy, grant, função nem trigger de eventos. Cria backup_eventos_eventos_orc_1_20261017 fora da API. Trava ACCESS EXCLUSIVE de milissegundos na tabela eventos.
- **Rollback:** alter table public.eventos drop column if exists observacoes, drop column if exists hora_fim, drop column if exists hora_inicio, drop column if exists historico_pagamentos, drop column if exists operacao_detalhes; (apaga o que foi gravado nelas; não rodar sem decisão do dono)
- **Evidências:** PGlite com as colunas reais de eventos: 6/6 (só aditiva, linha existente intacta, backup com RLS, reexecutável, preflight aborta com tipo divergente, gravação do orçamento e dos pagamentos passa). Impressão digital esperada 3ae8f62e5382a8a442f21fa488369feb.
- **Comando/alteração:** `Rodar o arquivo inteiro (SQL Editor ou apply_migration); conferir a impressão digital no select do fim.`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-17 19:09
- **Decidido em:** 2026-10-17
- **Decidido por:** lucas (no chat da sessão: "pode sim")
- **Nota:** Aplicada em 17/10/2026 ~20:00 UTC pelo conector Supabase (arquivo inteiro numa transação). Verificação OK: impressão digital 3ae8f62e5382a8a442f21fa488369feb (igual ao PGlite); 2 eventos intactos com os defaults; backup_eventos_eventos_orc_1_20261017 com 2 linhas, RLS ligado, 0 grants para o app; policy sec_unidade inalterada. Gravação do orçamento, pagamentos e hora como usuário real sob RLS: OK, em transação desfeita (TESTADO NO SUPABASE REAL)
- **Chave:** migracao:db/EVENTOS_ORC_1_COLUNAS_DO_ORCAMENTO.sql

### APR-013 · EXECUTADO

- **Missão:** B-025 — boletos antigos sem unidade na tabela `documentos`
- **Ação:** Rodar db/DOC_LEGADO_1_ARQUIVAR_DOCUMENTOS.sql no Supabase real (28 linhas pendentes sem unidade → status 'arquivado')
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM (UPDATE em 28 linhas de tabela antiga que nenhuma tela lê)
- **Motivo:** A tela Notas e Boletos foi trocada por Contas a Pagar; as 28 linhas (R$ 7.964,69, vencimentos 2020–2026) ficavam pendentes para sempre, sem unidade
- **Impacto:** Nenhuma tela lê `documentos`; nada apagado; valores, datas e descrições iguais
- **Rollback:** update public.documentos d set status = b.status from public.backup_documentos_doc_legado_1_20261017 b where d.id = b.id and d.status = 'arquivado';
- **Evidências:** PGlite 5/5 (só as 28 sem unidade, backup fora da API, preflight aborta com contagem diferente, rollback devolve o status)
- **Status:** EXECUTADO
- **Criado em:** 2026-10-17
- **Decidido em:** 2026-10-17
- **Decidido por:** lucas (no chat da sessão: "arquivar")
- **Nota:** Executado em 17/10/2026. Verificação: 28 arquivadas, 0 pendentes sem unidade, R$ 7.964,69; md5 de (id, valor, vencimento) antes = depois = fdd6c4cf0d7eddee75c20b680ff8a0f0; backup_documentos_doc_legado_1_20261017 com 28 linhas, RLS ligado, 0 grants para o app (TESTADO NO SUPABASE REAL)
- **Chave:** dados:db/DOC_LEGADO_1_ARQUIVAR_DOCUMENTOS.sql

### APR-014 · EXECUTADO

- **Missão:** Pedido do dono 18/10: fidelidade com cartões de selo por produto, cashback e cadastro pelo QR (CRM) com desconto
- **Ação:** Aplicar db/FIDELIDADE_1_SELOS_E_CASHBACK.sql no Supabase real
  - tabela nova `fidelidade_movimentos` (livro só de inclusão; RLS: só lê quem tem `clientes.loyalty.view` na unidade; ninguém grava direto);
  - trigger nova em `pedidos`: pedido pago/entregue dá selo e cashback; cancelado estorna;
  - funções da equipe (resgatar prêmio, usar cashback, lançar selo de balcão/ajuste) com permissão conferida no banco;
  - função só do servidor para o cliente usar o cashback num pedido do cardápio;
  - cadastro pelo QR: colunas novas em `clientes` (email, aniversario, cadastro_em, aceite_lgpd_em, aceita_novidades, origem) e em `pedidos` (desconto, desconto_origem); funções só do servidor para cadastrar e calcular o desconto
- **Ambiente:** supabase (produção)
- **Risco:** HIGH (trigger nova em `pedidos`, colunas novas em `clientes` e `pedidos`, e valor em dinheiro: cashback e desconto de cadastro baixam o total do pedido)
- **Motivo:** sem a tabela, o cardápio só mostra as regras do programa; o saldo dos clientes não existe. Quem dá selo é o banco, só em pedido concluído (pedido falso não ganha nada)
- **Impacto:**
  - nenhuma linha existente muda (só leitura de pedidos, itens e configuração);
  - o programa só começa quando o dono ligar em Cardápio digital → Fidelidade;
  - erro da fidelidade nunca trava o pedido (vira aviso no log)
- **Rollback:** no cabeçalho do SQL (apaga o livro e os saldos: exportar antes)
- **Evidências:** PGlite 16/16 (`app/lib/fidelidade-banco.test.mjs`):
  - só aditiva;
  - pedido enviado não ganha; concluído ganha uma vez; cancelado estorna;
  - sem telefone ou programa desligado não ganha;
  - configuração ruim não trava o pedido;
  - livro imutável;
  - resgate com permissão e saldo; lançamento com motivo;
  - cashback só pelo servidor, com telefone conferido; validade;
  - RLS por unidade;
  - saldo do app = saldo do banco;
  - cadastro: cria no CRM, não duplica, não troca nome de quem já existe; desconto só para cadastrado, primeiro pedido ou todos, validade; só o servidor chama.
  - Regras puras: `app/lib/fidelidade.test.mjs` 12/12.
  - TESTADO LOCAL. NÃO VALIDADO no Supabase real.
- **Impressão digital esperada:** 407bcd9c6a4b80101073aecb68d07928
- **Status:** EXECUTADO
- **Criado em:** 2026-10-18
- **Decidido em:** 2026-10-18
- **Decidido por:** lucas (no chat da sessão: "Sim, aplicar agora", depois de "já vai publicando tudo")
- **Nota:** Executado em 18/10/2026 (TESTADO NO SUPABASE REAL):
  - impressão digital 407bcd9c6a4b80101073aecb68d07928 (igual à do PGlite);
  - RLS ligado no livro, 1 policy, só SELECT para authenticated; reserva de cashback só para service_role;
  - backups com as mesmas contagens (clientes 0, pedidos 10).
  - Ensaio de escrita em transação desfeita:
    - pedido enviado não ganha; pago dá 2 selos e R$ 5,00 (5% de R$ 100); repetir o status não duplica; cancelado zera;
    - livro recusa alteração;
    - cadastro entra no CRM (origem qr); desconto 10% → 0 depois do 1º pedido → 10% de novo com o 1º cancelado.
  - Depois: 0 clientes, 0 lançamentos, 10 pedidos, config sem fidelidade (nada ficou).
  - O programa só começa quando o dono ligar em Cardápio digital → Fidelidade.
- **Chave:** banco:db/FIDELIDADE_1_SELOS_E_CASHBACK.sql

### APR-015 · EXECUTADO

- **Missão:** HEXP-001 (atendimento da mesa pelo QR: "Chamar garçom" e "Pedir a conta" no cardápio digital)
- **Ação:** Aplicar db/CHAMADOS_1_MESA.sql no Supabase real: tabela nova `experience_chamados` (o nome que o servidor e a tela do Salão já usam)
  - um chamado aberto por mesa e tipo (tocar várias vezes não vira fila);
  - limites de tamanho e de valores (tipo, status);
  - RLS por unidade (`sec_unidade`, como `pedidos`); anônimo sem acesso; a equipe lê e atualiza, não insere direto; o cliente chama pelo servidor
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM (só uma tabela nova; nenhuma tabela existente muda)
- **Motivo:** os botões já estão no cardápio da mesa; sem a tabela, o cliente vê "acene para a equipe" e nada chega ao Salão (conferido em 19/10: a tabela não existe no banco real)
- **Impacto:** nenhuma linha existente muda; depois de aplicada, o chamado aparece no Salão (faixa amarela e botão de chamados, também no celular do garçom)
- **Rollback:** `drop table if exists public.experience_chamados;` (apaga só os chamados)
- **Evidências:** PGlite 5/5 (`app/lib/chamados-banco.test.mjs`): só aditiva; preflight aborta na segunda vez; um aberto por mesa e tipo; limites; RLS por unidade, anônimo e equipe sem insert direto. Servidor 13/13 (`app/lib/experience.test.mjs`). Navegador (mock, Playwright): sem a tabela, o cliente é avisado para acenar; com a tabela simulada, chamar garçom, pedir a conta, outro celular da mesma mesa não duplica, japonês, Salão no computador e no celular. TESTADO LOCAL e EM MOCK. NÃO VALIDADO no Supabase real.
- **Impressão digital esperada:** 479c60f3e90fae069d1b785189a8ce22
- **Comando/alteração:** `Rodar o arquivo inteiro (SQL Editor ou apply_migration). O select do fim deve devolver 479c60f3e90fae069d1b785189a8ce22.`
- **Status:** EXECUTADO
- **Criado em:** 2026-10-19
- **Decidido em:** 2026-10-19
- **Decidido por:** lucas (no chat da sessão: "Aplicar e publicar")
- **Nota:** Executado em 19/10/2026 (TESTADO NO SUPABASE REAL):
  - impressão digital 479c60f3e90fae069d1b785189a8ce22 (igual à do PGlite);
  - RLS ligado, policy sec_unidade; grants: authenticated só SELECT e UPDATE; anon nada.
  - Ensaio de escrita em transação desfeita: segundo chamado igual da mesma mesa bloqueado; unidade inexistente recusada; equipe da unidade vê e atende (1/1); equipe não insere direto; anônimo bloqueado.
  - Depois: 0 linhas na tabela (nada ficou).
- **Chave:** banco:db/CHAMADOS_1_MESA.sql

### APR-016 · PENDENTE

- **Missão:** contas por função (pedido do dono, 04/11/2026): consultar a ficha técnica sem poder alterar
- **Ação:** Aplicar db/security/SEC_FICHAS_1_EDICAO_POR_PERMISSAO.sql no Supabase real
  - fichas, ingredientes, montagem e tabelas ligadas: ler continua igual; criar, alterar e apagar passam a exigir permissão de ficha, montagem, cardápio ou marmita
- **Ambiente:** supabase (produção)
- **Risco:** HIGH (muda RLS de 9 tabelas)
- **Motivo:** hoje qualquer usuário da unidade grava fichas pela API do banco, mesmo sem botão na tela (conferido em 04/11/2026)
- **Impacto:** 11 das 16 contas usam o perfil Somente consulta e deixam de gravar fichas. Antes de aplicar, confirmar se alguma delas edita fichas hoje e trocar o perfil se precisar
- **Rollback:** db/security/SEC_FICHAS_1_ROLLBACK.sql (só com decisão do dono)
- **Evidências:** PGlite 7/7 (`app/lib/sec-fichas-1.test.mjs`): consulta não grava, permissão continua gravando, outra unidade fora, preflight, rollback
- **Impressão digital esperada:** b300bf3a8f1a004da40d3eaf2f104a2a
- **Comando/alteração:** `Rodar o arquivo inteiro. O select do fim deve devolver b300bf3a8f1a004da40d3eaf2f104a2a.`
- **Status:** PENDENTE
- **Criado em:** 2026-11-04

### APR-017 · EXECUTADO

- **Missão:** HDEV-011
- **Ação:** Aplicar db/treinamento/TREIN_1_TREINAMENTO_POR_FUNCAO.sql e depois db/treinamento/TREIN_2_RASCUNHOS.sql no Supabase real
- **Ambiente:** supabase (produção)
- **Risco:** HIGH
- **Motivo:** Cria tabelas, policies, funções e grants, e adiciona permissões aos perfis (CLAUDE.md: confirmação do dono).
- **Impacto:** Só aditiva. 12 tabelas trein_* novas, com RLS por unidade; gabarito sem nenhum grant; escrita só por funções que conferem permissão. Todos os perfis menos Somente ponto e Contador ganham treinamento.my.view; Gerente geral ganha treinamento.*; Supervisor de cozinha ganha treinamento.team.*. Nenhuma linha existente muda. O conteúdo entra como rascunho, invisível para a equipe.
- **Rollback:** db/treinamento/TREIN_1_ROLLBACK.sql (apaga conteúdo editado e progresso; testado no PGlite).
- **Evidências:** TESTADO LOCAL: PGlite com o SQL real, cobrindo rascunho invisível, gabarito fechado, prova, limite de tentativas, escrita direta negada, isolamento entre unidades, líder não aprova a si mesmo, Estúdio, permissões, preflight, rollback e carga real dos rascunhos. NÃO VALIDADO no Supabase real.
- **Comando/alteração:** `Rodar TREIN_1 inteiro, conferir a impressão 75b3c57a6eea304ca11e7cf6ec551775; rodar TREIN_2 e conferir a contagem. Depois mesclar o PR.`
- **Status:** EXECUTADO
- **Execução:** 05/11/2026, com aprovação do dono na conversa e no aviso do Supabase. TESTADO NO SUPABASE REAL: impressão 75b3c57a6eea304ca11e7cf6ec551775; 12 tabelas com RLS; 33 módulos (8 de pratos aprovados), 56 aulas, 136 questões e gabaritos, 10 trilhas, 119 ligações, 63 itens de prática; hash das aulas igual ao do código. Lido como funcionário real em transação desfeita: 8 módulos e 10 trilhas visíveis; gabarito, importação e escrita direta negados.
- **Criado em:** 2026-11-05 01:00
- **Chave:** migracao:db/treinamento/TREIN_1_TREINAMENTO_POR_FUNCAO.sql

## APR-018 — MARM-PROD-1: produção de subprodutos da marmitaria

**Executada em 05/11/2026 com autorização do dono.** TESTADO NO SUPABASE REAL em transação desfeita (compra recebida e produção). `db/marmitaria/MARM_PROD_1_PREPAROS.sql`. Aditiva: cria dois locais de estoque e uma função. Rollback em `db/marmitaria/MARM_PROD_1_ROLLBACK.sql`.

## APR-019 — MARM-UNIDADE-1: unidade própria da marmitaria

**Executada em 05/11/2026 com autorização do dono.** `db/marmitaria/MARM_UNIDADE_1_UNIDADE_PROPRIA.sql`. Aditiva: unidade `marmitaria`, vazia, com cinco estoques e as funções da senha. TESTADO NO SUPABASE REAL em transação desfeita (senha, cadastro e subproduto; usuário comum sem acesso). Rollback em `db/marmitaria/MARM_UNIDADE_1_ROLLBACK.sql`.


## APR-020 — MARM-UNIDADE-2, 3 e 4: acesso à marmitaria pela senha

**Executadas em 05/11/2026 com autorização do dono.** Com a senha, o usuário ativo da mesma empresa recebe o escopo da unidade `marmitaria`. `hefisto_user_can` e `fin_pode_acessar_unidade` mudaram só para essa unidade, `compras`, `compras_itens` e `contas_pagar` ganharam a policy `marmitaria_escopo`, e sete tabelas de estoque e pagamentos ganharam leitura por `marmitaria_escopo_ler`. TESTADO NO SUPABASE REAL em transação desfeita. Rollbacks em `db/marmitaria/`.


## APR-021 — COM-4: cancelar a venda da comanda

**Executada em 07/11/2026 com autorização do dono** (`apply_migration com_4_cancelar_venda`). Verificação pós-aplicação passou: função presente, anon sem acesso, 3 colunas. TESTADO NO SUPABASE REAL em transação desfeita: fechar comanda de R$ 50 (dinheiro 20, crédito 30) e cancelar → venda e comanda canceladas, crédito cancelado, cancelamentos +50, devolver R$ 20 em dinheiro; segundo toque repetido; usuário sem `salao.sector.cancel` recusado. Nada ficou gravado.
- **O que faz:** três colunas novas em `vendas` (`cancelada_em`, `cancelada_por`, `motivo_cancelamento`) e a função `venda_cancelar(venda, motivo)`. Só aditiva; nada é apagado.
- **Regras da função:** permissão `salao.sector.cancel`; motivo obrigatório; recusa se o caixa da venda já fechou ou se cartão/Pix já foi conferido como recebido (aí é estorno pelo Financeiro). Cancela as contas a receber previstas da venda, soma o valor em `cancelamentos` no faturamento do dia, marca a venda e a comanda como canceladas. Segundo toque não soma de novo.
- **Evidência:** TESTADO LOCAL com o SQL real em PGlite (`app/lib/comanda-fechar-banco.test.mjs`, 17 casos novos). Tela TESTADO EM MOCK. TESTADO NO SUPABASE REAL (acima).
- **Rollback:** `db/comandas/COM_4_ROLLBACK.sql` (recusa rodar se já houver venda cancelada, para não perder o histórico).
- **Sem a COM-4 aplicada:** a lista "Vendas do caixa" aparece sem o botão de cancelar.


### APR-022 · EXECUTADO

- **Missão:** Sinalização digital (pedido do dono, 07/11/2026)
- **Ação:** Aplicar db/SINAL_1_SINALIZACAO_DIGITAL.sql no Supabase real (5 tabelas novas `sinal_*` e o bucket privado `sinalizacao`)
- **Ambiente:** supabase (produção)
- **Risco:** MEDIUM (só aditiva: nenhuma tabela existente tocada)
- **Motivo:** O módulo de TVs precisa das tabelas para parear telas e guardar mídias, playlists e programação.
- **Impacto:** Nenhum no que já existe. RLS ligado e sem grant para anon/authenticated: só o servidor acessa.
- **Rollback:** no cabeçalho do arquivo (drop das 5 tabelas e do bucket; não rodar sem decisão do dono).
- **Evidências:** PGlite 4/4 (`app/lib/sinalizacao-banco.test.mjs`); ensaio desfeito no banco real antes; aplicada com impressão 902d3121ff098c8bee0e2b508246c485 igual à do PGlite; anon e authenticated sem leitura nas 5 tabelas (has_table_privilege).
- **Status:** EXECUTADO
- **Criado em:** 2026-11-07 10:00
- **Decidido em:** 2026-11-07 10:27
- **Decidido por:** lucas (no chat: "Sim, pode criar")
- **Nota:** Aplicada em 07/11/2026 ~10:30 (horário de Brasília) em sessão acompanhada.
- **Chave:** migracao:db/SINAL_1_SINALIZACAO_DIGITAL.sql

### APR-023 · EXECUTADO

- **Missão:** Sinalização digital — horário de funcionamento da TV (pedido do dono, 07/11/2026)
- **Ação:** Aplicar db/SINAL_2_HORARIO_FUNCIONAMENTO.sql no Supabase real (coluna `sinal_telas.horario`)
- **Ambiente:** supabase (produção)
- **Risco:** LOW (uma coluna nova, nula; nenhuma linha alterada)
- **Motivo:** fora do horário a tela fica preta sozinha.
- **Rollback:** no cabeçalho do arquivo (drop da coluna; não rodar sem decisão do dono).
- **Evidências:** PGlite 5/5; banco real: coluna jsonb, 0 telas com horário, authenticated sem leitura.
- **Status:** EXECUTADO
- **Decidido em:** 2026-11-07 20:14
- **Decidido por:** lucas (no chat: "vamos fazer essa mudança no horário de funcionamento da tv")
- **Chave:** migracao:db/SINAL_2_HORARIO_FUNCIONAMENTO.sql

### APR-024 · EXECUTADO

- **Missão:** Planos e assinatura do Héfisto (pedido do dono, 14/11/2026)
- **Ação:** Aplicar db/SAAS_PLANOS_1_ASSINATURA.sql no Supabase real (tabela nova `empresa_assinatura` fora da API e função `hefisto_minha_assinatura()`)
- **Ambiente:** supabase (produção)
- **Risco:** LOW (só aditiva: tabela e função novas; não altera empresas, unidades, usuários nem RLS de outras tabelas)
- **Motivo:** Sem ela o Héfisto não sabe o plano de cada empresa: Minha conta mostra "Não registrado" e o plano Grátis não tranca nada
- **Impacto:** A empresa que já existe (a casa do dono) entra no plano Completo como cortesia, sem valor; nada muda para quem usa hoje
- **Rollback:** drop function if exists public.hefisto_minha_assinatura(); drop table if exists public.empresa_assinatura;
- **Evidências:** PGlite 12/12 (`app/lib/saas-planos-banco.test.mjs`: cortesia para a casa do dono, cada empresa vê só a sua, o app não lê nem grava a tabela, visitante sem login não chama a função, plano e forma de pagamento fora da lista recusados, rodar de novo aborta). Impressão digital esperada: a327899d3c010f1012d5a0ab051005a5
- **Status:** EXECUTADO
- **Decidido em:** 2026-11-14 00:45
- **Decidido por:** lucas (no chat: "1. Aprovo")
- **Nota:** Aplicada em 14/11/2026. Impressão digital a327899d3c010f1012d5a0ab051005a5 (igual à do PGlite); 0 empresas sem assinatura; a empresa existente ficou Completo/cortesia; nenhum grant de tabela para anon/authenticated; anon sem EXECUTE na função (TESTADO NO SUPABASE REAL). Achado: o dono é super_admin sem unidade principal, então a função devolve null para ele (a conta mostra "Não registrado"); os 15 usuários com unidade veem o plano. Nenhuma tela publicada em produção usa a tabela: o app dos tablets não muda.
- **Criado em:** 2026-11-14
- **Chave:** migracao:db/SAAS_PLANOS_1_ASSINATURA.sql
