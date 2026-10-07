/* ═══════════════════════════════════════════════════════════════════════════
   CORREÇÃO DE CADASTROS E FICHAS — pedida pelo dono em 07/10/2026

   Preços informados pelo dono: açúcar R$ 17/kg, limão R$ 10/kg,
   castanha de caju R$ 35/kg (laranja R$ 8/kg fica para quando houver o peso
   por unidade/rodela — as fichas usam "1 laranja", não gramas).

   1. Preço (com registro em insumos_precos_historico, como a tela faz):
      - Açúcar 9cd765d1 (cozinha e bar): 5 kg por R$ 16,50 → 1 kg por R$ 17,00
      - Limão 9ca845ba (cozinha, kg): R$ 15 → R$ 10/kg, passa a valer no bar
      - Castanha de caju b991718b (cozinha, g): 500 g por R$ 32,70 → 1.000 g
        por R$ 35,00, passa a valer no bar
   2. Fichas trocam o cadastro sem preço/duplicado pelo cadastro certo:
      - Açúcar 5e1374f3 (g, R$ 0) → Açúcar 9cd765d1 (kg): quantidade ÷ 1000
      - Farinha de tapioca 90498e4a (g, R$ 0) → e92a3796 (kg, R$ 50): ÷ 1000
      - Castanha de caju do bar 56956a57 (g) → b991718b (g): mesma quantidade
   3. Drinks usam a RECEITA do xarope (custo da ficha) no lugar do item com
      preço de preenchimento R$ 1,00/ml:
      - Xarope de cajá 0c4116dd (ml) → ficha "Xarope de caja" 123e3402 (rende L): ÷ 1000
      - Xarope de morango caseiro e7662837 (ml) → ficha "Xarope de morango"
        9750142c (rende ml): mesma quantidade
   Nada é apagado. Antes de mudar, cada linha vai para
   backup_correcoes_cadastro_20261007 (sem acesso pelo app). Pode rodar de
   novo: a segunda vez não muda nada.
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

create table if not exists public.backup_correcoes_cadastro_20261007 (
  tabela      text not null,
  registro_id uuid not null,
  antes       jsonb not null,
  motivo      text,
  feito_em    timestamptz not null default now(),
  primary key (tabela, registro_id)
);
alter table public.backup_correcoes_cadastro_20261007 enable row level security;
revoke all on public.backup_correcoes_cadastro_20261007 from public, anon, authenticated;

-- 0. cópia de tudo o que vai mudar
insert into public.backup_correcoes_cadastro_20261007 (tabela, registro_id, antes, motivo)
select 'insumos', i.id, to_jsonb(i), 'preço informado pelo dono 07/10'
  from public.insumos i
 where i.id in ('9cd765d1-3e70-4dcf-b8a0-8f72e18e57b9', '9ca845ba-eb3d-44ab-ac19-43c42026daca', 'b991718b-9b3f-4fdc-98ac-19ba54a1a5ac')
on conflict do nothing;
insert into public.backup_correcoes_cadastro_20261007 (tabela, registro_id, antes, motivo)
select 'fichas_ingredientes', fi.id, to_jsonb(fi), 'troca para o cadastro certo 07/10'
  from public.fichas_ingredientes fi
 where fi.insumo_id in ('5e1374f3-b3dc-4135-a16c-82fad8059ba7', '90498e4a-7fca-4c8a-bef5-345e1542ce23', '56956a57-cfd0-4747-a4bf-87b17fd0aff6',
                        '0c4116dd-3665-4e0e-92f9-7c46edd38b6a', 'e7662837-6b12-494e-bbe3-39393e6f4319')
on conflict do nothing;

-- 1. preços (histórico primeiro, com os valores de antes)
with p(id, emb, preco, setores) as (values
  ('9cd765d1-3e70-4dcf-b8a0-8f72e18e57b9'::uuid, 1::numeric,    17::numeric, array['cozinha','bar']),
  ('9ca845ba-eb3d-44ab-ac19-43c42026daca'::uuid, 1::numeric,    10::numeric, array['cozinha','bar']),
  ('b991718b-9b3f-4fdc-98ac-19ba54a1a5ac'::uuid, 1000::numeric, 35::numeric, array['cozinha','bar'])
), calc as (
  select i.*, p.emb as nova_emb, p.preco as novo_preco, p.setores,
         coalesce(nullif(i.preco_normalizado, 0),
                  i.custo_compra / nullif(i.tamanho_embalagem * case lower(i.unidade_medida) when 'g' then 0.001 when 'ml' then 0.001 else 1 end, 0)) as norm_antes,
         p.preco / (p.emb * case lower(i.unidade_medida) when 'g' then 0.001 when 'ml' then 0.001 else 1 end) as norm_novo
    from public.insumos i join p on p.id = i.id
   where (i.custo_compra, i.tamanho_embalagem) is distinct from (p.preco, p.emb)
), hist as (
  insert into public.insumos_precos_historico (unidade_id, insumo_id, insumo_nome, fornecedor_id, fornecedor_nome,
       embalagem_quantidade_anterior, embalagem_unidade_anterior, embalagem_quantidade_nova, embalagem_unidade_nova,
       valor_anterior, valor_novo, preco_normalizado_anterior, preco_normalizado_novo, diferenca_valor, diferenca_percentual, origem, usuario_nome)
  select c.unidade_id, c.id, c.nome, c.fornecedor_atual_id, c.fornecedor,
         c.tamanho_embalagem, c.unidade_medida, c.nova_emb, c.unidade_medida,
         c.custo_compra, c.novo_preco, c.norm_antes, c.norm_novo, c.norm_novo - c.norm_antes,
         case when c.norm_antes > 0 then round((c.norm_novo - c.norm_antes) / c.norm_antes * 100, 2) end,
         'Preço informado pelo dono (07/10/2026)', 'Ajuste pelo Claude'
    from calc c
  returning insumo_id
)
update public.insumos i
   set tamanho_embalagem = c.nova_emb, custo_compra = c.novo_preco, custo_unitario = c.novo_preco / c.nova_emb,
       preco_normalizado_anterior = c.norm_antes, preco_normalizado = c.norm_novo,
       variacao_preco_pct = case when c.norm_antes > 0 then round((c.norm_novo - c.norm_antes) / c.norm_antes * 100, 2) end,
       preco_atualizado_em = now(), departamentos = c.setores
  from calc c
 where i.id = c.id;

-- 2. fichas: cadastro sem preço/duplicado → cadastro certo
update public.fichas_ingredientes set insumo_id = '9cd765d1-3e70-4dcf-b8a0-8f72e18e57b9', quantidade = quantidade / 1000
 where insumo_id = '5e1374f3-b3dc-4135-a16c-82fad8059ba7';                       -- açúcar g → kg
update public.fichas_ingredientes set insumo_id = 'e92a3796-279e-4b8c-a011-a3245204b390', quantidade = quantidade / 1000
 where insumo_id = '90498e4a-7fca-4c8a-bef5-345e1542ce23';                       -- farinha de tapioca g → kg
update public.fichas_ingredientes set insumo_id = 'b991718b-9b3f-4fdc-98ac-19ba54a1a5ac'
 where insumo_id = '56956a57-cfd0-4747-a4bf-87b17fd0aff6';                       -- castanha g → g

-- 3. drinks: receita do xarope no lugar do item de R$ 1,00/ml
update public.fichas_ingredientes set insumo_id = null, subficha_id = '123e3402-2aad-49a2-bf5b-f0acf8c43402', quantidade = quantidade / 1000
 where insumo_id = '0c4116dd-3665-4e0e-92f9-7c46edd38b6a';                       -- xarope de cajá ml → L
update public.fichas_ingredientes set insumo_id = null, subficha_id = '9750142c-9486-450f-a205-9ae25a0457af'
 where insumo_id = 'e7662837-6b12-494e-bbe3-39393e6f4319';                       -- xarope de morango ml → ml

commit;


/* ── CONFERÊNCIA (só leitura) ─────────────────────────────────────────────────
select b.tabela, coalesce(i.nome, f.nome_receita) as o_que, b.antes ->> 'quantidade' as qtd_antes, fi.quantidade as qtd_agora,
       coalesce(ni.nome, sf.nome_receita) as agora_usa, b.antes ->> 'custo_compra' as preco_antes, i.custo_compra as preco_agora
  from public.backup_correcoes_cadastro_20261007 b
  left join public.insumos i on b.tabela = 'insumos' and i.id = b.registro_id
  left join public.fichas_ingredientes fi on b.tabela = 'fichas_ingredientes' and fi.id = b.registro_id
  left join public.fichas_tecnicas f on f.id = fi.ficha_id
  left join public.insumos ni on ni.id = fi.insumo_id
  left join public.fichas_tecnicas sf on sf.id = fi.subficha_id
 order by 1, 2;
   ──────────────────────────────────────────────────────────────────────────── */
