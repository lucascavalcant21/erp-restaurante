-- ─────────────────────────────────────────────────────────────────────────────
-- CADASTRO DO FUNCIONÁRIO — transporte próprio e pontos da taxa de serviço
--
-- tipo_transporte: moto ou carro. Saber só que "tem transporte" deixava a
-- informação pela metade — vaga, seguro e quem pode fazer entrega dependem de
-- qual é.
--
-- pontos_taxa: a taxa de serviço é rateada por PONTOS, de 0,5 a 2. O valor em
-- reais de cada um só existe no fechamento do mês, quando se divide o que foi
-- arrecadado pela soma dos pontos de quem trabalhou. Guardar reais por pessoa
-- no cadastro obrigava a redigitar tudo todo mês, e qualquer esquecimento
-- pagava o mês anterior.
--
-- taxa_servico_mes CONTINUA existindo: é o valor em reais que a folha usa. O
-- que muda é de onde ele vem — do rateio, não da digitação.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores add column if not exists tipo_transporte text;
alter table public.colaboradores add column if not exists pontos_taxa numeric(3,1);

-- Só 0,5 / 1 / 1,5 / 2. Sem isso, um dedo trocado grava 20 pontos e a pessoa
-- leva metade da taxa da casa no fechamento.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'colaboradores_pontos_taxa_faixa'
  ) then
    alter table public.colaboradores
      add constraint colaboradores_pontos_taxa_faixa
      check (pontos_taxa is null or pontos_taxa in (0.5, 1, 1.5, 2));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'colaboradores_tipo_transporte_valor'
  ) then
    alter table public.colaboradores
      add constraint colaboradores_tipo_transporte_valor
      check (tipo_transporte is null or tipo_transporte in ('Moto', 'Carro'));
  end if;
end $$;

notify pgrst, 'reload schema';

-- Confira quem já tem os campos preenchidos:
select nome, tipo_transporte, pontos_taxa, taxa_servico_mes
  from public.colaboradores
 where unidade_id = 'seldeestrela'
 order by nome;
