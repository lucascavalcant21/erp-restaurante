/* Registro — aplicado em produção em 08/10/2026 (quantidades informadas pelo dono).
   As 4 linhas de ficha que tinham virado 0,000 com o erro do editor antigo
   (g/ml gravado em kg). Na ficha a quantidade fica na unidade do cadastro.
   Cópia de antes em backup_correcoes_cadastro_20261007. */
insert into public.backup_correcoes_cadastro_20261007 (tabela, registro_id, antes, motivo)
select 'fichas_ingredientes', fi.id, to_jsonb(fi), 'quantidade redigitada pelo dono 08/10'
  from public.fichas_ingredientes fi
 where fi.id in ('a29030d7-e16e-4738-872c-66486c7c6c7a','f21f3c02-1058-46e3-aef1-c40acc53285c','fee6e9c0-892e-46d0-bfc3-a8ca8edb3b3a','2150526f-969d-42b2-9940-cf7647ef7e19')
on conflict do nothing;

with v(id, qtd) as (values
  ('a29030d7-e16e-4738-872c-66486c7c6c7a'::uuid, 0.090),  -- Açaí 1L farinha amarela · açúcar 90 g (cadastro em kg)
  ('f21f3c02-1058-46e3-aef1-c40acc53285c'::uuid, 0.090),  -- Açaí 1L farinha de tapioca · açúcar 90 g
  ('fee6e9c0-892e-46d0-bfc3-a8ca8edb3b3a'::uuid, 0.040),  -- Açaí 1L farinha de tapioca · farinha de tapioca 40 g (kg)
  ('2150526f-969d-42b2-9940-cf7647ef7e19'::uuid, 50)      -- Arraia · óleo de soja 50 ml (cadastro em ml)
)
update public.fichas_ingredientes fi set quantidade = v.qtd
  from v where fi.id = v.id and fi.quantidade = 0;
