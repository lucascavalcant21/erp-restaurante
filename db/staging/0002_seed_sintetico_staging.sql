/* SEED SINTÉTICO DO STAGING — dados INVENTADOS, para o agente ter o que ler.

   Nada aqui veio de produção. Nomes são obviamente fictícios ("Restaurante
   Teste", "Insumo A"), valores são redondos e não existe uma única pessoa
   real: nenhum cliente, nenhum funcionário, nenhuma venda, nenhum CPF.

   Rode depois do 0001. Idempotente: usa chaves fixas e `on conflict do
   nothing`, então rodar de novo não duplica nada.
*/

/* ── Empresa e unidades ──────────────────────────────────────────────────── */
insert into public.empresas (id, nome, documento)
values ('11111111-1111-4111-8111-111111111111', 'Rede Teste Hefisto', null)
on conflict (id) do nothing;

insert into public.unidades (id, nome, cor, ativo, empresa_id) values
  ('unidade-teste-a', 'Restaurante Teste A', '#10B981', true, '11111111-1111-4111-8111-111111111111'),
  ('unidade-teste-b', 'Restaurante Teste B', '#3B82F6', true, '11111111-1111-4111-8111-111111111111')
on conflict (id) do nothing;

update public.unidades set empresa_id = '11111111-1111-4111-8111-111111111111'
where id in ('unidade-teste-a','unidade-teste-b') and empresa_id is null;

insert into public.setores (id, empresa_id, unidade_id, nome, codigo) values
  ('22222222-2222-4222-8222-222222222221', '11111111-1111-4111-8111-111111111111', 'unidade-teste-a', 'Cozinha', 'cozinha'),
  ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'unidade-teste-a', 'Bar', 'bar')
on conflict (id) do nothing;

/* ── Insumos e saldo ─────────────────────────────────────────────────────── */
insert into public.insumos (id, unidade_id, nome, departamento, categoria, unidade_medida, custo_unitario, estoque_minimo) values
  ('33333333-3333-4333-8333-000000000001', 'unidade-teste-a', 'Arroz agulhinha (teste)', 'cozinha', 'Grãos',     'kg', 6.00, 10),
  ('33333333-3333-4333-8333-000000000002', 'unidade-teste-a', 'Filé bovino (teste)',     'cozinha', 'Carnes',    'kg', 52.00, 5),
  ('33333333-3333-4333-8333-000000000003', 'unidade-teste-a', 'Alho (teste)',            'cozinha', 'Temperos',  'kg', 30.00, 2),
  ('33333333-3333-4333-8333-000000000004', 'unidade-teste-a', 'Limão (teste)',           'bar',     'Frutas',    'kg', 8.00,  3),
  ('33333333-3333-4333-8333-000000000005', 'unidade-teste-a', 'Cachaça (teste)',         'bar',     'Destilados','l',  25.00, 4)
on conflict (id) do nothing;

insert into public.estoque_atual (unidade_id, insumo_id, quantidade_atual) values
  ('unidade-teste-a', '33333333-3333-4333-8333-000000000001', 3),    /* abaixo do mínimo de propósito */
  ('unidade-teste-a', '33333333-3333-4333-8333-000000000002', 12),
  ('unidade-teste-a', '33333333-3333-4333-8333-000000000003', 0.5),  /* abaixo do mínimo */
  ('unidade-teste-a', '33333333-3333-4333-8333-000000000004', 9),
  ('unidade-teste-a', '33333333-3333-4333-8333-000000000005', 6)
on conflict (unidade_id, insumo_id) do nothing;

/* ── Fichas: um pré-preparo e dois pratos ────────────────────────────────── */
insert into public.fichas_tecnicas
  (id, unidade_id, nome_receita, codigo, categoria, departamento, eh_base, tipo_base, rendimento_porcoes, rendimento_unidade, peso_final_g, modo_preparo, cmv_meta) values
  ('44444444-4444-4444-8444-000000000001', 'unidade-teste-a', 'Arroz branco (teste)', 'FT-T01', 'Bases', 'cozinha', true,  'pre', 2.5, 'kg', null, '1. Refogar.\n2. Cozinhar.', 30),
  ('44444444-4444-4444-8444-000000000002', 'unidade-teste-a', 'Filé com arroz (teste)', 'FT-T02', 'Prato principal', 'cozinha', false, null, 0.45, 'kg', 420, '1. Grelhar o filé.\n2. Montar com o arroz.', 30),
  ('44444444-4444-4444-8444-000000000003', 'unidade-teste-a', 'Caipirinha (teste)', 'FT-T03', 'Drinks', 'bar', false, null, 0.35, 'l', 350, '1. Macerar o limão.\n2. Completar com gelo.', 25)
on conflict (id) do nothing;

insert into public.fichas_ingredientes (id, ficha_id, insumo_id, subficha_id, quantidade) values
  ('55555555-5555-4555-8555-000000000001', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000001', null, 1),
  ('55555555-5555-4555-8555-000000000002', '44444444-4444-4444-8444-000000000001', '33333333-3333-4333-8333-000000000003', null, 0.02),
  ('55555555-5555-4555-8555-000000000003', '44444444-4444-4444-8444-000000000002', '33333333-3333-4333-8333-000000000002', null, 0.25),
  ('55555555-5555-4555-8555-000000000004', '44444444-4444-4444-8444-000000000002', null, '44444444-4444-4444-8444-000000000001', 0.3),
  ('55555555-5555-4555-8555-000000000005', '44444444-4444-4444-8444-000000000003', '33333333-3333-4333-8333-000000000004', null, 0.12),
  ('55555555-5555-4555-8555-000000000006', '44444444-4444-4444-8444-000000000003', '33333333-3333-4333-8333-000000000005', null, 0.06)
on conflict (id) do nothing;

/* ── Cardápio: preço de venda, para o CMV ter denominador ────────────────── */
insert into public.produtos (id, unidade_id, nome_produto, ficha_id, preco_venda, departamento, categoria) values
  ('66666666-6666-4666-8666-000000000001', 'unidade-teste-a', 'Filé com arroz (teste)', '44444444-4444-4444-8444-000000000002', 62.00, 'cozinha', 'Prato principal'),
  ('66666666-6666-4666-8666-000000000002', 'unidade-teste-a', 'Caipirinha (teste)',     '44444444-4444-4444-8444-000000000003', 24.00, 'bar', 'Drinks')
on conflict (id) do nothing;

/* ── Equipe fictícia e ponto do dia ──────────────────────────────────────── */
insert into public.colaboradores (id, unidade_id, nome, cargo, departamento, ativo) values
  ('77777777-7777-4777-8777-000000000001', 'unidade-teste-a', 'Colaborador Teste 1', 'Cozinheiro', 'cozinha', true),
  ('77777777-7777-4777-8777-000000000002', 'unidade-teste-a', 'Colaborador Teste 2', 'Barman',     'bar',     true)
on conflict (id) do nothing;

insert into public.registro_ponto (id, unidade_id, colaborador_id, data_referencia, entrada, saida) values
  ('88888888-8888-4888-8888-000000000001', 'unidade-teste-a', '77777777-7777-4777-8777-000000000001', current_date, '08:00', null),
  ('88888888-8888-4888-8888-000000000002', 'unidade-teste-a', '77777777-7777-4777-8777-000000000002', current_date, '10:00', '16:00')
on conflict (id) do nothing;

/* ── Produção de hoje ────────────────────────────────────────────────────── */
insert into public.producao_diaria (id, unidade_id, ficha_id, colaborador_id, quantidade) values
  ('99999999-9999-4999-8999-000000000001', 'unidade-teste-a', '44444444-4444-4444-8444-000000000001', '77777777-7777-4777-8777-000000000001', 5)
on conflict (id) do nothing;

/* ── Financeiro fictício ─────────────────────────────────────────────────── */
insert into public.contas_pagar (id, unidade_id, descricao, fornecedor, valor, data_vencimento, status) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'unidade-teste-a', 'Fornecedor de hortifruti (teste)', 'Fornecedor Teste', 850.00, current_date - 5, 'pendente'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', 'unidade-teste-a', 'Energia elétrica (teste)',        'Concessionária Teste', 1200.00, current_date - 2, 'pendente'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'unidade-teste-a', 'Gás (teste)',                      'Fornecedor Teste', 400.00, current_date + 10, 'pendente')
on conflict (id) do nothing;

insert into public.lancamentos (id, unidade_id, tipo, categoria, descricao, valor, data) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000001', 'unidade-teste-a', 'entrada', 'Vendas',      'Venda do dia (teste)',  4200.00, date_trunc('month', current_date)::date + 2),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000002', 'unidade-teste-a', 'entrada', 'Vendas',      'Venda do dia (teste)',  3800.00, date_trunc('month', current_date)::date + 5),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000003', 'unidade-teste-a', 'saida',   'Insumos',     'Compra de insumos (teste)', 2100.00, date_trunc('month', current_date)::date + 3),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000004', 'unidade-teste-a', 'saida',   'Folha',       'Folha (teste)',         3000.00, date_trunc('month', current_date)::date + 6),
  ('bbbbbbbb-bbbb-4bbb-8bbb-000000000005', 'unidade-teste-a', 'saida',   'Utilidades',  'Energia (teste)',        900.00, date_trunc('month', current_date)::date + 7)
on conflict (id) do nothing;

/* ── Perfil de acesso do teste ───────────────────────────────────────────── */
insert into public.perfis_acesso (id, nome, codigo, descricao, tipo, sistema)
values ('cccccccc-cccc-4ccc-8ccc-000000000001', 'Teste Héfisto', 'teste-hefisto', 'Perfil do usuário de teste do agente de IA', 'sistema', true)
on conflict (id) do nothing;

insert into public.perfil_permissoes (perfil_id, permission_key)
select 'cccccccc-cccc-4ccc-8ccc-000000000001', k
from (values
  ('dashboard.overview.view'),
  ('estoque.overview.view'),
  ('cozinha.production.view'),
  ('rh.overview.view'),
  ('ponto.clock.view'),
  ('financeiro.cashflow.view'),
  ('financeiro.cmv.view'),
  ('financeiro.dre.view')
) as p(k)
on conflict (perfil_id, permission_key) do nothing;
