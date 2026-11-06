/* ECO-1: anotações da equipe (05/11/2026, pedido do dono).

   ADITIVA: cria area_anotacoes, onde a conta da cozinha ou do bar anota o que
   produzir hoje ou amanhã e pede o que falta. Pedido de compra aqui é só um aviso:
   não gera compra, conta a pagar nem movimento de estoque.
   A unidade da linha é conferida pela regra de unidade, como nas outras tabelas.
   ROLLBACK: db/ecossistema/ECO_1_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regclass('public.area_anotacoes') is not null then
    raise exception 'ECO-1: já aplicada. Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_ve_todas_unidades()') is null or to_regprocedure('public.hefisto_unidades_do_usuario()') is null then
    raise exception 'ECO-1: funções de acesso ausentes. Nada foi alterado.';
  end if;
end $$;

create table public.area_anotacoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  area text not null check (area in ('cozinha', 'bar', 'salao')),
  tipo text not null check (tipo in ('producao', 'compra')),
  para_dia date not null default current_date,
  texto text not null check (char_length(btrim(texto)) between 1 and 300),
  quantidade numeric check (quantidade is null or quantidade > 0),
  unidade text check (unidade is null or char_length(unidade) <= 10),
  quem text not null default '' check (char_length(quem) <= 120),
  status text not null default 'aberta' check (status in ('aberta', 'feita')),
  concluida_em timestamptz,
  created_at timestamptz not null default now()
);
create index area_anotacoes_lista on public.area_anotacoes (unidade_id, area, status, para_dia);

alter table public.area_anotacoes enable row level security;
revoke all on public.area_anotacoes from public, anon, authenticated;
grant select, insert, update on public.area_anotacoes to authenticated;

create policy sec_unidade on public.area_anotacoes for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.area_anotacoes'::regclass) then
    raise exception 'ECO-1: RLS desligado.';
  end if;
  if has_table_privilege('anon', 'public.area_anotacoes', 'select') then
    raise exception 'ECO-1: anon não pode ler.';
  end if;
end $$;

commit;
