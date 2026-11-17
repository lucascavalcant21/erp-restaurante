/* ═══════════════════════════════════════════════════════════════════════════
   GASTOS-1 · GASTO DETALHADO (O QUE FOI COMPRADO, CATEGORIA E PARA QUEM)

   STATUS: ESCRITA. Do SISTEMA DE TESTE (branch hefisto-teste): o banco do
   restaurante não recebe.

   PEDIDO DO DONO (17/11/2026): "comprei uma frigideira, uma panela, um avental
   pro funcionário, uma camisa, uma touca… tudo tem que estar na nossa
   planilha de custos: naquele mês isso foi comprado, para quê e para quem
   (qualquer funcionário ou um funcionário específico); separo por categorias:
   aventais, toucas, materiais de limpeza, detergente, sabão".

   O dinheiro continua no Financeiro: cada gasto é uma conta a pagar (o DRE e o
   caixa já contam). Esta migração só acrescenta o DETALHE da conta.

   FAZ (uma transação; só aditiva):
     1. Duas categorias novas no plano de contas: utensilios ("Utensílios e
        equipamentos pequenos") e uniformes_epi ("Uniformes e EPI").
     2. gastos_detalhe: uma linha por conta a pagar com o item, a quantidade,
        o tipo do gasto, a data e o destino (geral ou um funcionário).
        - quem vê a conta vê o detalhe; quem grava a conta grava o detalhe
          (as políticas consultam contas_pagar, que já tem RLS por unidade);
        - a unidade vem da conta (gatilho), nunca do corpo;
        - funcionário só da mesma unidade da conta;
        - o detalhe não se altera depois de gravado (anular = cancelar a conta).
   NÃO FAZ: não muda contas_pagar, compras, estoque nem permissões.

   VERIFICAÇÃO: o select do fim devolve a impressão digital das colunas de
   gastos_detalhe: 89a161c93f2106338f57493827411cdd (conferida no PGlite por
   app/lib/gastos-banco.test.mjs).

   ROLLBACK (não rodar sem decisão do dono; apaga os detalhes, as contas ficam):
     drop table if exists public.gastos_detalhe;
     drop function if exists public.gastos_detalhe_antes();
     delete from public.fin_categorias where codigo in ('utensilios', 'uniformes_epi')
       and not exists (select 1 from public.contas_pagar where categoria_codigo in ('utensilios', 'uniformes_epi'));
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.contas_pagar') is null or to_regclass('public.fin_categorias') is null or to_regclass('public.colaboradores') is null then
    raise exception 'GASTOS-1: faltam contas_pagar, fin_categorias ou colaboradores. Nada foi alterado.';
  end if;
  if to_regclass('public.gastos_detalhe') is not null then
    raise exception 'GASTOS-1: gastos_detalhe já existe. Nada foi alterado.';
  end if;
end $$;

insert into public.fin_categorias (codigo, nome, grupo, natureza, permite_conta_manual, exige_revisao, ativa, ordem)
values
  ('utensilios', 'Utensílios e equipamentos pequenos', 'MANUTENCAO', 'despesa_fixa', true, false, true, 205),
  ('uniformes_epi', 'Uniformes e EPI', 'PESSOAL', 'pessoal', true, false, true, 55)
on conflict (codigo) do nothing;

create table public.gastos_detalhe (
  id              uuid primary key default gen_random_uuid(),
  unidade_id      text not null,
  conta_pagar_id  uuid not null unique references public.contas_pagar(id),
  data            date not null,
  tipo_gasto      text not null check (tipo_gasto in ('utensilios', 'uniformes_epi', 'limpeza', 'manutencao', 'outros')),
  item            text not null check (length(btrim(item)) between 2 and 160),
  quantidade      numeric check (quantidade is null or (quantidade > 0 and quantidade < 1000000)),
  valor_total     numeric(12,2) not null check (valor_total > 0),
  destino         text not null default 'geral' check (destino in ('geral', 'colaborador')),
  colaborador_id  uuid references public.colaboradores(id),
  observacao      text check (observacao is null or length(observacao) <= 500),
  criado_por      uuid,
  created_at      timestamptz not null default now(),
  constraint gastos_detalhe_destino check ((destino = 'colaborador') = (colaborador_id is not null))
);
create index gastos_detalhe_unidade_data on public.gastos_detalhe (unidade_id, data desc);
create index gastos_detalhe_colaborador on public.gastos_detalhe (colaborador_id) where colaborador_id is not null;

create function public.gastos_detalhe_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_unidade text;
begin
  if tg_op = 'UPDATE' then
    raise exception 'O detalhe do gasto não se altera. Cancele a conta a pagar e lance de novo.';
  end if;
  select unidade_id into v_unidade from public.contas_pagar where id = new.conta_pagar_id;
  if v_unidade is null then
    raise exception 'Conta a pagar não encontrada.';
  end if;
  new.unidade_id := v_unidade;
  new.criado_por := auth.uid();
  new.created_at := now();
  if new.colaborador_id is not null and not exists (
    select 1 from public.colaboradores where id = new.colaborador_id and unidade_id = v_unidade
  ) then
    raise exception 'Funcionário de outra unidade.';
  end if;
  return new;
end $$;

create trigger gastos_detalhe_antes
  before insert or update on public.gastos_detalhe
  for each row execute function public.gastos_detalhe_antes();

alter table public.gastos_detalhe enable row level security;

-- vê/grava o detalhe quem vê a conta (RLS de contas_pagar decide; consulta como o próprio usuário)
create policy gastos_detalhe_ler on public.gastos_detalhe for select to authenticated
  using (exists (select 1 from public.contas_pagar c where c.id = gastos_detalhe.conta_pagar_id));
create policy gastos_detalhe_criar on public.gastos_detalhe for insert to authenticated
  with check (exists (select 1 from public.contas_pagar c where c.id = gastos_detalhe.conta_pagar_id and c.unidade_id = gastos_detalhe.unidade_id));

revoke all on public.gastos_detalhe from anon, authenticated;
grant select, insert on public.gastos_detalhe to authenticated;
revoke all on function public.gastos_detalhe_antes() from public, anon, authenticated;

select md5(string_agg(column_name || ':' || data_type, ',' order by ordinal_position)) as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name = 'gastos_detalhe';

commit;
