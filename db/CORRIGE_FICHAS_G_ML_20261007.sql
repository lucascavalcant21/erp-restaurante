/* ═══════════════════════════════════════════════════════════════════════════
   CORREÇÃO · fichas com ingrediente em g/ml gravado em kg/L (07/10/2026)

   O editor antigo de fichas (fichas/page.js) gravava a quantidade em kg/L
   para insumos cadastrados em g/ml: 18 g virava 0,018 g (1000× menor a cada
   salvamento). Código corrigido em fix/ficha-gramas (da1c350).

   - Volta ×1000 as 15 linhas levantadas em 07/10 (lista fechada, por id), e
     SÓ se a quantidade ainda for a mesma vista no levantamento (se alguém
     já corrigiu na tela, a linha não é tocada).
   - Guarda antes/depois em backup_fichas_ingredientes_gml_20261007 (sem
     acesso pelo app: RLS ligado e sem grants).
   - As 4 linhas que já tinham virado 0,000 (Açaí 1L farinha amarela/açúcar,
     Açaí 1L tapioca/açúcar e farinha de tapioca, Arraia/óleo de soja) não
     têm como voltar: o dono redigita.
   Não apaga nada. Pode rodar de novo (a segunda vez não muda nada).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

create table if not exists public.backup_fichas_ingredientes_gml_20261007 (
  linha_id          uuid primary key,
  ficha_id          uuid,
  insumo_id         uuid,
  quantidade_antes  numeric,
  quantidade_depois numeric,
  feito_em          timestamptz not null default now()
);
alter table public.backup_fichas_ingredientes_gml_20261007 enable row level security;
revoke all on public.backup_fichas_ingredientes_gml_20261007 from public, anon, authenticated;

with alvo(linha_id, visto) as (values
  ('e77b5d0e-25d9-4639-bbb9-e4539b74da81'::uuid, 0.500),  -- Água c/ gás 500ml · Água com gás (ml)
  ('6ef7ab29-8316-4183-a276-4bffcd86e71c'::uuid, 0.015),  -- Arroz Paraense · Açafrão (g)
  ('a5d22bb0-c995-4dc1-9b32-1fbf0240608d'::uuid, 0.100),  -- Arroz Paraense · Óleo de soja (ml)
  ('0c6efaf7-4ff5-4bfa-87fa-07f457312a14'::uuid, 0.100),  -- Baião de Dois · Óleo de soja (ml)
  ('3e99d5cd-6773-453f-ad1d-9c79bb90e0cf'::uuid, 0.200),  -- Carne de sol - bolinho · Manteiga de garrafa (g)
  ('34c62d0e-20d6-4c57-b00e-62473be4f681'::uuid, 0.150),  -- Combo Foz do Iguaçu · Mini pastel costela (g)
  ('259b61e7-68df-4e83-80d7-c2a000aa4323'::uuid, 0.150),  -- Combo Foz do Iguaçu · Mini pastel queijo (g)
  ('04acc732-af35-4c98-bc59-b718ab7ad693'::uuid, 0.325),  -- Creme de cupuaçu · Açúcar (g)
  ('c5b85bc3-68d5-4423-a97d-6377f9aa45ed'::uuid, 0.300),  -- Creme de cupuaçu · Creme de leite (ml)
  ('1b1cb896-0478-4798-9126-d8eb9963164e'::uuid, 1.975),  -- Creme de cupuaçu · Leite condensado (g) = 5 latas de 395 g
  ('6cb72e99-39c6-43f3-8ca6-7abc5e592342'::uuid, 0.100),  -- Feijoada · Couve refogada (g)
  ('34416e30-8566-4611-8329-81951542db67'::uuid, 0.250),  -- Mini pastel costela (g)
  ('e26f98be-4323-4057-8d5e-d32851111765'::uuid, 0.240),  -- Mini pastel queijo (g)
  ('e0218940-bd65-47df-9a3c-bb9b46d8dc5a'::uuid, 0.030),  -- Shake - Guaraná amazônico · Amendoim (g)
  ('244c9c91-5dd5-4cf8-9d02-a6bda10a09c9'::uuid, 0.018)   -- Shake - Guaraná amazônico · Castanha de caju (g)
), salvo as (
  insert into public.backup_fichas_ingredientes_gml_20261007 (linha_id, ficha_id, insumo_id, quantidade_antes, quantidade_depois)
  select fi.id, fi.ficha_id, fi.insumo_id, fi.quantidade, fi.quantidade * 1000
    from public.fichas_ingredientes fi join alvo a on a.linha_id = fi.id
   where fi.quantidade = a.visto
  on conflict (linha_id) do nothing
  returning linha_id, quantidade_depois
)
update public.fichas_ingredientes fi
   set quantidade = s.quantidade_depois
  from salvo s
 where fi.id = s.linha_id;

commit;


/* ── CONFERÊNCIA (só leitura) ─────────────────────────────────────────────────
select f.nome_receita as ficha, i.nome as ingrediente, b.quantidade_antes as antes, fi.quantidade as agora, i.unidade_medida as un
  from public.backup_fichas_ingredientes_gml_20261007 b
  join public.fichas_ingredientes fi on fi.id = b.linha_id
  join public.insumos i on i.id = fi.insumo_id
  join public.fichas_tecnicas f on f.id = fi.ficha_id
 order by 1, 2;
   ──────────────────────────────────────────────────────────────────────────── */
