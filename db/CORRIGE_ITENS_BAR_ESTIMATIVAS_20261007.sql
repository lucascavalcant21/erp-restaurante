/* ═══════════════════════════════════════════════════════════════════════════
   ITENS DO BAR COM PREÇO DE PREENCHIMENTO (R$ 1,00/ml) — ESTIMATIVAS
   Autorizado pelo dono em 07/10/2026 ("inventa os números"). Cada preço novo
   fica no histórico com origem "Estimativa autorizada pelo dono" — trocar
   pelo valor real quando houver nota.

   Estimativas usadas (laranja R$ 8/kg e limão R$ 10/kg são do dono):
     Gelo ............ saco de 5 kg por R$ 12,00 (R$ 2,40/kg); nas fichas
                       "1"/"2" viram 100 g / 200 g (1 porção = 100 g)
     Anis estrelado .. R$ 0,30 a estrela (un)
     Cravo ........... R$ 0,03 o cravo (un)
     Canela em pau ... R$ 0,90 o pau (un)
     Sal ............. R$ 3,00/kg; borda da Marguerita = 5 g
     Casca de laranja  R$ 0,04 a casca (5 g × R$ 8/kg)
     Laranja do bar .. vira "Laranja (rodela)": R$ 0,16 (20 g × R$ 8/kg)
     Laranja cozinha . R$ 1,60 a unidade (200 g × R$ 8/kg)
     Limão do bar .... vira "Limão (unidade)": R$ 0,80 (80 g × R$ 10/kg)
     Leite condensado  o Boto cor de rosa passa a usar o de lata (395 g por
                       R$ 10): 100 ml ≈ 130 g; o de lata vale cozinha e bar
   Nada é apagado; antes de mudar, cópia em backup_correcoes_cadastro_20261007.
   Pode rodar de novo (a segunda vez não muda nada).
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

insert into public.backup_correcoes_cadastro_20261007 (tabela, registro_id, antes, motivo)
select 'insumos', i.id, to_jsonb(i), 'estimativa autorizada pelo dono 07/10'
  from public.insumos i
 where i.id in ('309f05cf-1006-4bba-aadb-f79e5dbdeac1', '1a63af6a-15ba-419e-8b65-d80008442868', '45062ba7-12b8-4f46-8b5b-053aa014ebdf',
                '886edf2c-1623-44cf-8e99-5827430443fa', '298d51d0-18b6-41de-8dce-f066b664c2b1', '6421b4f7-6c97-430e-9408-acc8f2e5623f',
                '86bf27a0-d9ab-40f2-a5fc-fff63fa7e967', '0183754c-6de8-4ea7-ae63-9db4822f77b3', 'c1ab29f5-3fe0-406a-ab21-09b90afcba7b',
                '71db4c0b-6789-466f-acff-bbcc104dfe6d')
on conflict do nothing;
insert into public.backup_correcoes_cadastro_20261007 (tabela, registro_id, antes, motivo)
select 'fichas_ingredientes', fi.id, to_jsonb(fi), 'estimativa autorizada pelo dono 07/10'
  from public.fichas_ingredientes fi
 where fi.insumo_id in ('309f05cf-1006-4bba-aadb-f79e5dbdeac1', '298d51d0-18b6-41de-8dce-f066b664c2b1', '9023989d-fe0a-4468-9324-82163370804e')
on conflict do nothing;

-- 1. fichas (antes de mudar a unidade do cadastro; só se ele ainda estiver em ml)
update public.fichas_ingredientes fi set quantidade = fi.quantidade * 0.1          -- gelo: 1/2 → 0,1/0,2 kg
 where fi.insumo_id = '309f05cf-1006-4bba-aadb-f79e5dbdeac1'
   and exists (select 1 from public.insumos i where i.id = fi.insumo_id and lower(i.unidade_medida) = 'ml');
update public.fichas_ingredientes fi set quantidade = 0.005                         -- sal: borda = 5 g
 where fi.insumo_id = '298d51d0-18b6-41de-8dce-f066b664c2b1'
   and exists (select 1 from public.insumos i where i.id = fi.insumo_id and lower(i.unidade_medida) = 'ml');
update public.fichas_ingredientes set insumo_id = '71db4c0b-6789-466f-acff-bbcc104dfe6d', quantidade = 130
 where insumo_id = '9023989d-fe0a-4468-9324-82163370804e';                           -- leite condensado: 100 ml ≈ 130 g

-- 2. cadastros (histórico primeiro, com os valores de antes)
with p(id, nome_novo, un, emb, preco, setores) as (values
  ('309f05cf-1006-4bba-aadb-f79e5dbdeac1'::uuid, null::text,           'kg', 5::numeric,   12::numeric,   null::text[]),
  ('1a63af6a-15ba-419e-8b65-d80008442868'::uuid, null,                 'un', 1,            0.30,          null),
  ('45062ba7-12b8-4f46-8b5b-053aa014ebdf'::uuid, null,                 'un', 1,            0.03,          null),
  ('886edf2c-1623-44cf-8e99-5827430443fa'::uuid, null,                 'un', 1,            0.90,          null),
  ('298d51d0-18b6-41de-8dce-f066b664c2b1'::uuid, null,                 'kg', 1,            3,             null),
  ('6421b4f7-6c97-430e-9408-acc8f2e5623f'::uuid, null,                 'un', 1,            0.04,          null),
  ('86bf27a0-d9ab-40f2-a5fc-fff63fa7e967'::uuid, 'Laranja (rodela)',   'un', 1,            0.16,          null),
  ('0183754c-6de8-4ea7-ae63-9db4822f77b3'::uuid, null,                 'un', 1,            1.60,          null),
  ('c1ab29f5-3fe0-406a-ab21-09b90afcba7b'::uuid, 'Limão (unidade)',    'un', 1,            0.80,          null),
  ('71db4c0b-6789-466f-acff-bbcc104dfe6d'::uuid, null,                 'g',  395,          10,            array['cozinha','bar'])
), calc as (
  select i.*, p.nome_novo, p.un as nova_un, p.emb as nova_emb, p.preco as novo_preco, p.setores,
         coalesce(nullif(i.preco_normalizado, 0),
                  i.custo_compra / nullif(i.tamanho_embalagem * case lower(i.unidade_medida) when 'g' then 0.001 when 'ml' then 0.001 else 1 end, 0)) as norm_antes,
         p.preco / (p.emb * case p.un when 'g' then 0.001 when 'ml' then 0.001 else 1 end) as norm_novo,
         (lower(i.unidade_medida), i.tamanho_embalagem, i.custo_compra) is distinct from (p.un, p.emb, p.preco) as muda_preco
    from public.insumos i join p on p.id = i.id
   where (lower(i.unidade_medida), i.tamanho_embalagem, i.custo_compra) is distinct from (p.un, p.emb, p.preco)
      or (p.nome_novo is not null and i.nome is distinct from p.nome_novo)
      or (p.setores is not null and i.departamentos is distinct from p.setores)
), hist as (
  insert into public.insumos_precos_historico (unidade_id, insumo_id, insumo_nome, fornecedor_id, fornecedor_nome,
       embalagem_quantidade_anterior, embalagem_unidade_anterior, embalagem_quantidade_nova, embalagem_unidade_nova,
       valor_anterior, valor_novo, preco_normalizado_anterior, preco_normalizado_novo, diferenca_valor, diferenca_percentual, origem, usuario_nome)
  select c.unidade_id, c.id, coalesce(c.nome_novo, c.nome), c.fornecedor_atual_id, c.fornecedor,
         c.tamanho_embalagem, c.unidade_medida, c.nova_emb, c.nova_un,
         c.custo_compra, c.novo_preco, c.norm_antes, c.norm_novo, c.norm_novo - c.norm_antes,
         case when c.norm_antes > 0 then round((c.norm_novo - c.norm_antes) / c.norm_antes * 100, 2) end,
         'Estimativa autorizada pelo dono (07/10/2026)', 'Ajuste pelo Claude'
    from calc c where c.muda_preco
  returning insumo_id
)
update public.insumos i
   set nome = coalesce(c.nome_novo, i.nome),
       unidade_medida = c.nova_un, tamanho_embalagem = c.nova_emb, custo_compra = c.novo_preco, custo_unitario = c.novo_preco / c.nova_emb,
       preco_normalizado_anterior = case when c.muda_preco then c.norm_antes else i.preco_normalizado_anterior end,
       preco_normalizado = c.norm_novo,
       variacao_preco_pct = case when c.muda_preco and c.norm_antes > 0 then round((c.norm_novo - c.norm_antes) / c.norm_antes * 100, 2) else i.variacao_preco_pct end,
       preco_atualizado_em = case when c.muda_preco then now() else i.preco_atualizado_em end,
       departamentos = coalesce(c.setores, i.departamentos)
  from calc c
 where i.id = c.id;

commit;
