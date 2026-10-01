/* Produção integrada: custo do insumo empanado passa a considerar a perda.
   Aprovado pelo dono em 01/10/2026 (PARTE 3 de proposta_custo_rendimento_empanamento.sql).

   operacao_custo_insumo (db/migracao_operacao_integrada.sql) calculava o
   empanado como  compra / (1 + ganho) + empanamento,  sem a perda de limpeza.
   A regra do app (app/lib/custo-rendimento.mjs) é:
       compra / rendimento / (1 + ganho) + empanamento por kg final
   Ingrediente comum não muda: a perda dele entra pelo fator da linha da
   ficha (fichas_ingredientes.fator_correcao), corrigido em 01/10/2026.

   QUANDO RODAR: só num banco que JÁ TEM a produção integrada instalada com a
   versão antiga. Sem a função, não faz nada. Desde 01/10/2026 a própria
   migracao_operacao_integrada.sql já cria a função corrigida — quem instalar
   a partir dela NÃO precisa deste arquivo.

   Só substitui a função se ela existir; guarda a definição atual antes.
   Lê as colunas novas por to_jsonb, para não quebrar se alguma faltar. */

begin;

create table if not exists public.sec_backup_funcoes_custo (
  funcao text primary key, definicao text not null, salvo_em timestamptz not null default now()
);
alter table public.sec_backup_funcoes_custo enable row level security;
revoke all on table public.sec_backup_funcoes_custo from anon, authenticated;

do $$
begin
  if to_regprocedure('public.operacao_custo_insumo(uuid)') is null then
    raise notice 'operacao_custo_insumo não existe neste banco: nada a corrigir.';
    return;
  end if;

  insert into public.sec_backup_funcoes_custo (funcao, definicao)
  values ('operacao_custo_insumo', pg_get_functiondef('public.operacao_custo_insumo(uuid)'::regprocedure))
  on conflict do nothing;

  execute $fn$
create or replace function public.operacao_custo_insumo(p_insumo uuid)
returns numeric language plpgsql stable security invoker set search_path = public as $body$
declare i public.insumos%rowtype; j jsonb; base numeric; tamanho numeric; un text;
  bruto numeric; perda_g numeric; perda_pct numeric; rend numeric := 1;
begin
  select * into strict i from public.insumos where id = p_insumo;
  j := to_jsonb(i);
  un := lower(i.unidade_medida);
  tamanho := coalesce(nullif(i.tamanho_embalagem,0),1);
  -- Preço normalizado está em kg/L. Retorno está na unidade física do insumo.
  base := coalesce(nullif(i.preco_normalizado,0),
    coalesce(nullif(i.custo_compra,0),i.custo_unitario*tamanho,0)
      / tamanho * case when un in ('g','ml') then 1000 else 1 end,0);
  if coalesce((j->>'empanado')::boolean,false) then
    -- Rendimento: mesma regra de rendimentoDoInsumo (custo-rendimento.mjs).
    bruto := nullif(j->>'peso_bruto_padrao','')::numeric;
    perda_g := nullif(j->>'perda_g','')::numeric;
    perda_pct := nullif(j->>'perda_pct','')::numeric;
    if bruto > 0 and perda_g is not null then
      if perda_g >= 0 and perda_g < bruto then rend := (bruto - perda_g) / bruto; end if;
    elsif perda_pct is not null and perda_pct >= 0 and perda_pct < 100 then
      rend := 1 - perda_pct / 100;
    end if;
    base := base / rend / greatest(1 + greatest(coalesce((j->>'ganho_pct')::numeric,0),0)/100, 0.000001)
      + case when un in ('kg','g') then coalesce((j->>'custo_empanado_kg')::numeric,0) else 0 end;
  end if;
  return base / case when un in ('g','ml') then 1000 else 1 end;
end $body$;
$fn$;
end $$;

commit;

/* CONFERÊNCIA (só leitura) */
select 'função existe' as item, count(*)::text as valor
  from pg_proc where oid = to_regprocedure('public.operacao_custo_insumo(uuid)')
union all
select 'função já considera a perda', count(*)::text
  from pg_proc where oid = to_regprocedure('public.operacao_custo_insumo(uuid)') and prosrc ilike '%rendimentoDoInsumo%'
union all
select 'definição antiga guardada', count(*)::text from public.sec_backup_funcoes_custo where funcao = 'operacao_custo_insumo'
union all
select 'ingredientes empanados', count(*)::text from public.insumos where empanado is true;

/* ROLLBACK (só se precisar): rode o texto guardado em
   select definicao from public.sec_backup_funcoes_custo where funcao = 'operacao_custo_insumo'; */
