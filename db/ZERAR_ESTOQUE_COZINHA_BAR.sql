-- ═══════════════════════════════════════════════════════════════════════════
-- ZERAR O SALDO DA COZINHA E DO BAR
--
-- Cole inteiro e execute. Não precisa trocar nada: encontra os estoques pelo
-- slug, então não é preciso saber o id da unidade.
--
-- Zera SÓ os estoques "cozinha" e "bar". Pré-preparos, embalagens, limpeza e
-- depósito ficam como estão — se quiser esses também, veja o fim do arquivo.
--
-- NÃO TEM DESFAZER.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── ANTES: quanto tem hoje ─────────────────────────────────────────────────
-- Rode só isto primeiro, para saber o que está sendo zerado.
select e.nome as estoque,
       count(*) filter (where ei.quantidade_atual > 0) as itens_com_saldo,
       count(*)                                        as itens_no_total
  from public.estoque_itens ei
  join public.estoques e on e.id = ei.estoque_id
 where e.slug in ('cozinha', 'bar')
 group by e.nome
 order by e.nome;


-- ── ZERAR ──────────────────────────────────────────────────────────────────
-- Tudo numa transação: ou zera as duas tabelas, ou não mexe em nenhuma.
begin;

-- Saldo dos estoques múltiplos, que é o que as telas de contagem mostram.
update public.estoque_itens ei
   set quantidade_atual = 0,
       updated_at = now()
  from public.estoques e
 where ei.estoque_id = e.id
   and e.slug in ('cozinha', 'bar');

-- Tabela antiga de saldo. Parte do sistema (produção, baixa por ficha) ainda
-- lê dela; deixar só uma zerada faria o saldo divergir dependendo da tela.
update public.estoque_atual ea
   set quantidade_atual = 0,
       updated_at = now()
 where ea.insumo_id in (
   select ei.insumo_id
     from public.estoque_itens ei
     join public.estoques e on e.id = ei.estoque_id
    where e.slug in ('cozinha', 'bar')
 );

commit;


-- ── DEPOIS: conferir que zerou ─────────────────────────────────────────────
select e.nome as estoque,
       count(*) filter (where ei.quantidade_atual > 0) as ainda_com_saldo
  from public.estoque_itens ei
  join public.estoques e on e.id = ei.estoque_id
 where e.slug in ('cozinha', 'bar')
 group by e.nome
 order by e.nome;
-- Se "ainda_com_saldo" vier 0 nas duas linhas, acabou. Se vier número, o banco
-- barrou o update por RLS — me mande o resultado que eu passo a correção.


-- ── SE QUISER ZERAR TUDO, NÃO SÓ COZINHA E BAR ─────────────────────────────
-- Tire os hífens das linhas abaixo. Isso pega pré-preparos, embalagens,
-- limpeza, depósito e qualquer outro estoque da unidade.
--
-- begin;
-- update public.estoque_itens set quantidade_atual = 0, updated_at = now();
-- update public.estoque_atual  set quantidade_atual = 0, updated_at = now();
-- commit;
