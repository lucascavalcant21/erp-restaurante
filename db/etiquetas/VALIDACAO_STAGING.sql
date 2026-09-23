/* VALIDAÇÃO DO 0001 EM STAGING — rode bloco a bloco, LENDO cada resultado.

   Isto não é um script para executar de uma vez e ir embora. Cada bloco tem um
   resultado esperado escrito ao lado; se não bater, pare e reporte antes de
   seguir.

   Pré-requisito: 0001_saldo_e_linhagem.sql já aplicado.
   NÃO rode isto em produção. NÃO rode 0002 ainda.
*/

/* ═══ 1. Os objetos existem? ══════════════════════════════════════════════ */
select 'colunas em etiquetas' as o, count(*) as n, 11 as esperado
  from information_schema.columns
 where table_schema='public' and table_name='etiquetas'
   and column_name in ('insumo_id','estoque_id','saldo','saldo_unidade','condicao_estoque',
     'producao_id','rastreavel','validade_original_em','aberta_em','regra_validade','encerrada_em')
union all
select 'tabelas novas', count(*), 4 from information_schema.tables
 where table_schema='public' and table_name in
   ('etiqueta_relacoes','etiqueta_eventos','etiqueta_operacoes','etiqueta_financeiro_pendente')
union all
select 'views novas', count(*), 2 from information_schema.views
 where table_schema='public' and table_name in
   ('vw_estoque_rastreabilidade','vw_etiquetas_pendentes_impressao')
union all
select 'RPCs novas', count(*), 10 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('etiqueta_registrar_entrada','etiqueta_vincular_producao',
   'etiqueta_abrir','etiqueta_usar','etiqueta_perda','etiqueta_fracionar','etiqueta_novo_ciclo',
   'etiqueta_reimprimir','etiqueta_marcar_impressa','get_etiqueta_publica')
union all
select 'movimento v2', count(*), 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='registrar_movimento_estoque_lote_v2';

/* ═══ 2. As FKs entraram? ═════════════════════════════════════════════════
   O 0001 avisa por NOTICE quando não consegue criar alguma. Se faltar aqui,
   procure o motivo no log da execução — órfão, tipo diferente ou tabela que
   não existe neste ambiente. */
select conname, conrelid::regclass as tabela, confrelid::regclass as referencia
  from pg_constraint
 where conname in ('etiquetas_insumo_fk','etiquetas_estoque_fk','etiquetas_producao_fk',
                   'movimentacoes_multi_etiqueta_fk')
 order by conname;
/* Esperado: 4 linhas. */

/* Se faltou alguma, isto mostra se é órfão: */
select 'insumo_id'  as coluna, count(*) as orfaos from public.etiquetas e
 where e.insumo_id is not null and not exists (select 1 from public.insumos i where i.id = e.insumo_id)
union all
select 'estoque_id', count(*) from public.etiquetas e
 where e.estoque_id is not null and not exists (select 1 from public.estoques s where s.id = e.estoque_id)
union all
select 'producao_id', count(*) from public.etiquetas e
 where e.producao_id is not null and not exists (select 1 from public.producao_diaria p where p.id = e.producao_id);
/* Esperado: zero em todas — as colunas são novas. */

/* ═══ 3. Nada foi mexido no que já existia ════════════════════════════════ */
select count(*) filter (where rastreavel) as rastreaveis,
       count(*) filter (where saldo is not null) as com_saldo,
       count(*) as total
  from public.etiquetas;
/* Esperado: rastreaveis = 0 e com_saldo = 0 logo depois da migração.
   Toda etiqueta que já existia continua exatamente como estava. */

/* ═══ 4. O QR público devolve só o que pode ═══════════════════════════════ */
select * from public.get_etiqueta_publica(
  (select codigo from public.etiquetas where codigo is not null order by created_at desc limit 1));
/* Esperado: 10 colunas, nenhuma delas saldo, custo, responsavel, insumo_id,
   estoque_id, producao_id ou id. */

/* ═══ 5. Smoke test de ponta a ponta ══════════════════════════════════════
   Cria uma etiqueta de teste, passa por recebimento → uso → perda, confere os
   saldos e DESFAZ tudo no fim. Rode inteiro, de uma vez.

   Troque os dois valores abaixo pelos de staging antes de rodar. */
do $smoke$
declare
  v_unidade text := 'TROQUE_PELA_UNIDADE';
  v_insumo  uuid := 'TROQUE-PELO-INSUMO-0000-000000000000';
  v_estoque uuid;
  v_etq public.etiquetas;
  v_saldo_antes numeric;
  v_saldo_depois numeric;
  v_mov uuid;
begin
  select id into v_estoque from public.estoques
   where unidade_id = v_unidade and slug = 'cozinha' limit 1;
  if v_estoque is null then raise exception 'SMOKE: estoque "cozinha" não existe em %', v_unidade; end if;

  select coalesce(quantidade_atual, 0) into v_saldo_antes from public.estoque_itens
   where estoque_id = v_estoque and insumo_id = v_insumo;
  v_saldo_antes := coalesce(v_saldo_antes, 0);

  insert into public.etiquetas (unidade_id, codigo, produto, quantidade, unidade, validade_em,
    responsavel, departamento, tipo_etiqueta, insumo_id, condicao_estoque, saldo_unidade, custo_unit)
  values (v_unidade, 'SMOKE-' || substr(md5(random()::text),1,6), 'SMOKE TESTE', 1,
    (select unidade_medida from public.insumos where id = v_insumo),
    now() + interval '2 days', 'Validação', 'cozinha', 'fechado', v_insumo, 'fechado',
    (select unidade_medida from public.insumos where id = v_insumo), 10)
  returning * into v_etq;

  /* recebimento */
  v_etq := public.etiqueta_registrar_entrada(v_etq.id, null, 'Validação', 'smoke-' || v_etq.id::text);
  select quantidade_atual into v_saldo_depois from public.estoque_itens
   where estoque_id = v_etq.estoque_id and insumo_id = v_insumo;
  if v_saldo_depois <> v_saldo_antes + 1 then
    raise exception 'SMOKE: entrada não somou 1 (antes %, depois %)', v_saldo_antes, v_saldo_depois;
  end if;

  /* o evento aponta para um movimento REAL */
  select movimento_id into v_mov from public.etiqueta_eventos
   where etiqueta_id = v_etq.id and tipo = 'recebida';
  if v_mov is null or not exists (select 1 from public.estoque_movimentacoes_multi m
                                   where m.id = v_mov and m.etiqueta_id = v_etq.id) then
    raise exception 'SMOKE: evento sem movimento correspondente';
  end if;

  /* retry com a mesma chave não pode movimentar de novo */
  perform public.etiqueta_registrar_entrada(v_etq.id, null, 'Validação', 'smoke-' || v_etq.id::text);
  select quantidade_atual into v_saldo_depois from public.estoque_itens
   where estoque_id = v_etq.estoque_id and insumo_id = v_insumo;
  if v_saldo_depois <> v_saldo_antes + 1 then
    raise exception 'SMOKE: retry movimentou de novo (saldo %)', v_saldo_depois;
  end if;

  /* impressão não movimenta */
  perform public.etiqueta_marcar_impressa(v_etq.id, null, 'Validação');
  select quantidade_atual into v_saldo_depois from public.estoque_itens
   where estoque_id = v_etq.estoque_id and insumo_id = v_insumo;
  if v_saldo_depois <> v_saldo_antes + 1 then
    raise exception 'SMOKE: impressão mexeu no estoque'; end if;

  /* perda de 0,4 deixa pendência financeira */
  v_etq := public.etiqueta_perda(v_etq.id, 0.4, 'Smoke test', null, 'Validação');
  if not exists (select 1 from public.etiqueta_financeiro_pendente where etiqueta_id = v_etq.id) then
    raise exception 'SMOKE: perda não gerou pendência financeira';
  end if;

  raise notice 'SMOKE OK — desfazendo';
  raise exception 'SMOKE_ROLLBACK';   /* aborta de propósito: staging fica limpo */
exception
  when others then
    if sqlerrm = 'SMOKE_ROLLBACK' then
      raise notice 'Smoke test passou e foi desfeito.';
    else
      raise;
    end if;
end
$smoke$;

/* ═══ 6. Concorrência de verdade (duas sessões) ═══════════════════════════
   Abra DUAS abas do SQL Editor.

   Aba 1:
     begin;
     select * from public.etiqueta_usar('<id da etiqueta>', 0.1);
     -- NÃO comite ainda

   Aba 2 (deve FICAR ESPERANDO, não erro na hora):
     select * from public.etiqueta_usar('<mesma etiqueta>', 0.1);

   Volte à aba 1:
     commit;

   A aba 2 destrava e desconta a partir do saldo JÁ atualizado. Se ela tivesse
   retornado na hora, a trava não estaria funcionando.

   Depois, o mesmo par com a MESMA p_idempotency_key: a aba 2 deve devolver o
   resultado da aba 1 sem descontar nada. */

/* ═══ 7. Rastreabilidade medida ═══════════════════════════════════════════ */
select estoque_slug, insumo_nome, unidade_medida,
       saldo_total, saldo_rastreado, saldo_nao_rastreado
  from public.vw_estoque_rastreabilidade
 where saldo_total > 0
 order by saldo_nao_rastreado desc
 limit 30;
/* Logo depois da migração: saldo_rastreado = 0 em tudo, e não_rastreado =
   total. Isso é o esperado — nenhuma etiqueta antiga foi inventada. */

/* ═══ 8. Fluxos ANTIGOS continuam iguais ══════════════════════════════════
   Rode na tela, não aqui, e confira que nada mudou:
     entrada · saída · transferência · contagem · produção do dia ·
     etiqueta antiga · baixa antiga · perda antiga · tela multiestoque.

   Esta consulta ajuda a ver se algum saldo saiu da linha: */
select e.slug, i.nome, it.quantidade_atual,
       (select coalesce(sum(l.quantidade),0) from public.estoque_lotes l
         where l.estoque_id = it.estoque_id and l.insumo_id = it.insumo_id) as soma_dos_lotes
  from public.estoque_itens it
  join public.estoques e on e.id = it.estoque_id
  join public.insumos  i on i.id = it.insumo_id
 where it.quantidade_atual <> (select coalesce(sum(l.quantidade),0) from public.estoque_lotes l
        where l.estoque_id = it.estoque_id and l.insumo_id = it.insumo_id);
/* Esperado: ZERO linhas. Qualquer linha aqui é item cujo saldo discorda da soma
   dos lotes — e isso precisa ser investigado antes de seguir. */
