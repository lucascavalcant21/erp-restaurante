# Aprovações pendentes

Pedidos do agente que **só o dono decide** (risco HIGH/CRITICAL, produção, banco real, ações da lista do CLAUDE.md).
O agente para só a etapa pedida e segue no resto. Regras em [[POLITICA_PUBLICACAO]].

- Ver: `npm run hefisto:aprovacoes`
- Decidir: `npm run hefisto:aprovacoes -- aprovar APR-001` ou `-- rejeitar APR-001 "motivo"`
- Depois de executar: `npm run hefisto:aprovacoes -- executado APR-001`

Status: PENDENTE → APROVADO / REJEITADO → EXECUTADO. Não apague seções: é o histórico.

**Pendentes agora: 2** (APR-011, APR-015; APR-007: falta só o merge do PR #171)

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

### APR-015 · PENDENTE

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
- **Status:** PENDENTE
- **Criado em:** 2026-10-19
- **Chave:** banco:db/CHAMADOS_1_MESA.sql

