/* ═══════════════════════════════════════════════════════════════════════════
   LIMPEZA DOS LANÇAMENTOS DE TESTE DO FINANCEIRO (unidade seldeestrela)

   STATUS: PREPARADO, NÃO EXECUTADO. Rodar só depois de o dono aprovar a lista.
   Nada é apagado: o banco proíbe apagar pagamento/recebimento ("use o
   estorno"). Pagamentos e recebimentos são ESTORNADOS e as contas
   CANCELADAS, pelas funções do próprio sistema (fin_estornar_pagamento,
   fin_estornar_recebimento, fin_cancelar_conta_pagar), com motivo gravado.
   Efeito: somem dos totais (a pagar, fluxo de caixa, DRE); o registro fica.

   LISTA (conferida no banco em 11/10/2026):
   ┌───────────────────────────────────────┬──────────────────────────┬────────┬────────────┬───────────┐
   │ id                                    │ descrição                │ valor  │ data       │ ação      │
   ├───────────────────────────────────────┼──────────────────────────┼────────┼────────────┼───────────┤
   │ pag  bcc52ecc-6fa7-4187-bd85-f27fe8f4e298 │ TESTE F2.2           │  0,40  │ 2026-10-01 │ estornar  │
   │ pag  a7622a5e-5d4f-416d-9b0c-da4654453fce │ TESTE F2.2           │  0,60  │ 2026-10-01 │ estornar  │
   │ pag  9ec4403e-20f2-4adb-ae80-a0baf239ca33 │ TESTE F2.2           │  0,60  │ 2026-10-01 │ já estornado │
   │ conta 8b56c3d0-4138-428a-8ccd-e4ffb5001819 │ TESTE F2.2           │  1,00  │ 2026-10-01 │ cancelar  │
   │ pag  01ec090a-5d89-4dfb-8e89-20dcb7f77558 │ Salário: kmolm - klk │  0,79  │ 2026-10-09 │ estornar  │
   │ conta 789ae212-fcf9-419d-a906-999a78c7c10c │ Salário: kmolm - klk │  0,79  │ 2026-06-23 │ cancelar  │
   │ conta 5f70cbaa-7299-497f-9f7e-08f891eee574 │ Salário: kmolm - klk │  0,79  │ 2026-06-23 │ cancelar  │
   │ rec  5c1779b1-6951-4b46-8245-b0f127b34598 │ CAIXA TESTE F2.3     │  0,40  │ 2026-10-01 │ estornar  │
   │ receber f7b966e2-e460-4568-b53f-9aed63c0b8eb │ CAIXA TESTE F2.3   │  1,00  │ 2026-10-01 │ cancelar  │
   │ conta 75c86903-c85c-4e45-b041-b647fe115c45 │ Compra: 1x Açaí      │  9,00  │ 2026-07-15 │ SÓ SE O DONO CONFIRMAR (bloco 4) │
   └───────────────────────────────────────┴──────────────────────────┴────────┴────────────┴───────────┘

   PREFLIGHT: aborta sem mudar nada se qualquer linha da lista não estiver
   exatamente como acima (valor, descrição, situação), ou se algum pagamento
   já tiver sido estornado por outra pessoa.
   DESFAZER: estorno e cancelamento são definitivos no sistema (o banco não
   deixa "desestornar"). Para voltar, lança-se de novo, como lançamento novo.
   Sessão: as funções exigem usuário logado; o script usa o usuário que criou
   os testes (79d15633-…), dono da conta.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

select set_config('request.jwt.claims', '{"sub":"79d15633-2e5c-4b9e-b010-fb67b23c680b","role":"authenticated"}', true);
set local role authenticated;

do $$
declare v_motivo constant text := 'Lançamento de teste removido a pedido do dono (2026-10-11)';
begin
  -- 0. preflight: a lista tem que estar exatamente como foi aprovada
  if (select count(*) from public.fin_pagamentos where estornado_em is null and id in
       ('bcc52ecc-6fa7-4187-bd85-f27fe8f4e298','a7622a5e-5d4f-416d-9b0c-da4654453fce','01ec090a-5d89-4dfb-8e89-20dcb7f77558')) <> 3
     or (select coalesce(sum(valor_total), 0) from public.fin_pagamentos where id in
       ('bcc52ecc-6fa7-4187-bd85-f27fe8f4e298','a7622a5e-5d4f-416d-9b0c-da4654453fce','01ec090a-5d89-4dfb-8e89-20dcb7f77558')) <> 1.79
     or (select count(*) from public.fin_recebimentos where estornado_em is null and id = '5c1779b1-6951-4b46-8245-b0f127b34598' and valor_liquido_recebido = 0.40) <> 1
     or (select count(*) from public.contas_pagar where status <> 'cancelado' and id in
       ('8b56c3d0-4138-428a-8ccd-e4ffb5001819','789ae212-fcf9-419d-a906-999a78c7c10c','5f70cbaa-7299-497f-9f7e-08f891eee574')
       and descricao in ('TESTE F2.2','Salário: kmolm - klk')) <> 3
     or (select count(*) from public.fin_contas_receber where id = 'f7b966e2-e460-4568-b53f-9aed63c0b8eb' and descricao = 'CAIXA TESTE F2.3' and status <> 'cancelado') <> 1
     or exists (select 1 from public.fin_pagamentos where estornado_em is null and conta_pagar_id in
       ('8b56c3d0-4138-428a-8ccd-e4ffb5001819','789ae212-fcf9-419d-a906-999a78c7c10c','5f70cbaa-7299-497f-9f7e-08f891eee574')
       and id not in ('bcc52ecc-6fa7-4187-bd85-f27fe8f4e298','a7622a5e-5d4f-416d-9b0c-da4654453fce','01ec090a-5d89-4dfb-8e89-20dcb7f77558')) then
    raise exception 'LIMPEZA: a lista mudou desde a aprovação. Nada foi alterado.';
  end if;

  -- 1. estornar os pagamentos (a conta volta a pendente pelo recálculo do banco)
  perform public.fin_estornar_pagamento('bcc52ecc-6fa7-4187-bd85-f27fe8f4e298', v_motivo);
  perform public.fin_estornar_pagamento('a7622a5e-5d4f-416d-9b0c-da4654453fce', v_motivo);
  perform public.fin_estornar_pagamento('01ec090a-5d89-4dfb-8e89-20dcb7f77558', v_motivo);

  -- 2. cancelar as contas a pagar de teste
  perform public.fin_cancelar_conta_pagar('8b56c3d0-4138-428a-8ccd-e4ffb5001819', v_motivo);
  perform public.fin_cancelar_conta_pagar('789ae212-fcf9-419d-a906-999a78c7c10c', v_motivo);
  perform public.fin_cancelar_conta_pagar('5f70cbaa-7299-497f-9f7e-08f891eee574', v_motivo);

  -- 3. recebimento de teste: estorno + cancelamento da conta a receber
  --    (não há função de cancelar conta a receber; o check exige data e motivo)
  perform public.fin_estornar_recebimento('5c1779b1-6951-4b46-8245-b0f127b34598', v_motivo);
  update public.fin_contas_receber set status = 'cancelado', cancelado_em = now(), motivo_cancelamento = v_motivo
   where id = 'f7b966e2-e460-4568-b53f-9aed63c0b8eb';

  -- 4. "Compra: 1x Açaí" (R$ 9,00, 15/07): SÓ com confirmação do dono.
  --    Descomente a linha abaixo se ele confirmar que é teste:
  -- perform public.fin_cancelar_conta_pagar('75c86903-c85c-4e45-b041-b647fe115c45', v_motivo);
end $$;

commit;

-- verificação: nada destes ids pode seguir ativo nos totais
select 'pagamentos ativos' k, count(*) n from public.fin_pagamentos where estornado_em is null and id in
  ('bcc52ecc-6fa7-4187-bd85-f27fe8f4e298','a7622a5e-5d4f-416d-9b0c-da4654453fce','01ec090a-5d89-4dfb-8e89-20dcb7f77558')
union all select 'recebimento ativo', count(*) from public.fin_recebimentos where estornado_em is null and id = '5c1779b1-6951-4b46-8245-b0f127b34598'
union all select 'contas não canceladas', count(*) from public.contas_pagar where status <> 'cancelado' and id in
  ('8b56c3d0-4138-428a-8ccd-e4ffb5001819','789ae212-fcf9-419d-a906-999a78c7c10c','5f70cbaa-7299-497f-9f7e-08f891eee574')
union all select 'receber não cancelada', count(*) from public.fin_contas_receber where status <> 'cancelado' and id = 'f7b966e2-e460-4568-b53f-9aed63c0b8eb';
-- esperado: 0 nas quatro linhas
