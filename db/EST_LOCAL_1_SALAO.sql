/* ═══════════════════════════════════════════════════════════════════════════
   EST-LOCAL-1 · LOCAL DE ESTOQUE "SALÃO" (unidade seldeestrela)

   STATUS: PROPOSTA (HDEV-EST-001). Rodar só com aprovação do dono.

   Hoje a área Salão só tem "Pré-preparos do Salão" (tipo alimentos). Papéis,
   descartáveis e utensílios do salão não têm onde ficar. Este script cria UM
   local novo, vazio. Nenhum produto é copiado: o cadastro (insumos) é um só;
   o produto passa a existir no Salão na primeira entrada ou transferência
   (estoque_itens nasce pelo estoque_movimentar / estoque_transferir).

   BACKUP: plano FREE do Supabase (sem backup automático). O passo 0 copia
   a tabela estoques para backup_estoques_est_local_1_20261011.

   FAZ (uma transação; aditiva):
     0. backup_estoques_est_local_1_20261011 (cópia de estoques)
     1. estoques: insere 'Salão' (slug 'salao', tipo 'materiais', ativo).
        Tipo materiais = transfere com "Materiais variados" e "Depósito".
   NÃO FAZ: não mexe nos 11 locais existentes, em saldo, lote, movimento,
   custo nem em "Pré-preparos do Salão".
   ABORTA sem mudar nada se já houver local com slug 'salao' ou nome 'Salão'.

   VERIFICAÇÃO: o select do fim mostra 1 linha 'Salão' com 0 itens.
   ROLLBACK (não rodar sem decisão do dono; só funciona com o local vazio):
     delete from public.estoques e where e.unidade_id = 'seldeestrela' and e.slug = 'salao'
       and not exists (select 1 from public.estoque_itens i where i.estoque_id = e.id)
       and not exists (select 1 from public.estoque_movimentacoes_multi m where m.estoque_id = e.id or m.estoque_destino_id = e.id);
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if not exists (select 1 from public.unidades where id = 'seldeestrela') then
    raise exception 'EST-LOCAL-1: unidade seldeestrela não existe. Nada foi alterado.';
  end if;
  if exists (select 1 from public.estoques where unidade_id = 'seldeestrela'
             and (slug = 'salao' or lower(btrim(nome)) in ('salão', 'salao'))) then
    raise exception 'EST-LOCAL-1: já existe um local Salão. Nada foi alterado.';
  end if;
end $$;

create table if not exists public.backup_estoques_est_local_1_20261011 as table public.estoques;
-- cópia fora da API: RLS ligado sem política e sem grant para o app
alter table public.backup_estoques_est_local_1_20261011 enable row level security;
revoke all on public.backup_estoques_est_local_1_20261011 from anon, authenticated;

insert into public.estoques (unidade_id, nome, slug, tipo, descricao, status, cor, controla_validade, controla_minimo, locais_internos, permissoes, ordem)
values ('seldeestrela', 'Salão', 'salao', 'materiais', 'Papéis, descartáveis e utensílios do salão', 'ativo', '#52525b', false, true, '{}', '[]'::jsonb, 5);

commit;

select e.nome, e.slug, e.tipo, e.status, (select count(*) from public.estoque_itens i where i.estoque_id = e.id) itens
  from public.estoques e where e.unidade_id = 'seldeestrela' and e.slug = 'salao';
