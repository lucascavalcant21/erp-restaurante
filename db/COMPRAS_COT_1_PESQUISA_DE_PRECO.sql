/* ═══════════════════════════════════════════════════════════════════════════
   COMPRAS-COT-1 · PESQUISA DE PREÇO DA LISTA DE COMPRAS

   STATUS: ESCRITA e testada no PGlite (app/lib/cotacoes-banco.test.mjs).
   NÃO APLICADA. Aplicar só com o OK do dono no chat.

   PEDIDO DO DONO (28/11/2026): "vou no supermercado X, esse produto custa 30;
   no Y custa 28; no Z custa tanto. O sistema compara esses locais com o que
   eu tenho cadastrado e diz qual é a melhor opção. Eu escolho; se o escolhido
   for diferente do cadastro, ele já atualiza o ingrediente (e a ficha e a
   precificação). Vou ter o histórico de cada ingrediente em cada lugar, com
   data e horário da pesquisa e qual eu escolhi."

   POR QUE TABELA NOVA: o preço por fornecedor de hoje (insumos_fornecedores)
   é apagado e recriado quando o ingrediente é salvo (sincronizarFornecedores,
   operacao.js), então não serve de histórico. E insumos_precos_historico guarda
   MUDANÇAS DO CUSTO do ingrediente; uma pesquisa não escolhida não é mudança
   de custo. A escolha continua gravando lá, pelo salvarInsumo de sempre.

   FAZ (uma transação; só aditiva):
     compras_cotacoes: uma linha por preço visto num local (fornecedor), com
     embalagem, marca, data/hora e se foi a escolhida.
       - a unidade vem do ingrediente (gatilho), nunca do corpo;
       - o local tem de ser da mesma unidade do ingrediente;
       - quem vê o ingrediente vê as cotações dele (RLS de insumos decide);
       - preço, embalagem, local e data não se alteram depois de gravados:
         só a marca "escolhida" muda (escolher/desfazer a escolha);
       - sem DELETE para ninguém: histórico.
   NÃO FAZ: não muda insumos, fornecedores, fichas, estoque nem permissões.

   VERIFICAÇÃO: o select do fim devolve a impressão digital das colunas de
   compras_cotacoes (conferida no PGlite por app/lib/cotacoes-banco.test.mjs).

   ROLLBACK (não rodar sem decisão do dono; apaga o histórico de pesquisas):
     drop table if exists public.compras_cotacoes;
     drop function if exists public.compras_cotacoes_antes();
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.insumos') is null or to_regclass('public.fornecedores') is null then
    raise exception 'COMPRAS-COT-1: faltam insumos ou fornecedores. Nada foi alterado.';
  end if;
  if to_regclass('public.compras_cotacoes') is not null then
    raise exception 'COMPRAS-COT-1: compras_cotacoes já existe. Nada foi alterado.';
  end if;
end $$;

create table public.compras_cotacoes (
  id                 uuid primary key default gen_random_uuid(),
  unidade_id         text not null,
  insumo_id          uuid not null references public.insumos(id),
  fornecedor_id      uuid not null references public.fornecedores(id),
  local_nome         text not null check (length(btrim(local_nome)) between 1 and 120),
  marca              text check (marca is null or length(marca) <= 120),
  preco              numeric(12,2) not null check (preco > 0 and preco < 1000000),
  tamanho_embalagem  numeric(14,4) not null check (tamanho_embalagem > 0 and tamanho_embalagem < 1000000),
  unidade_embalagem  text not null check (unidade_embalagem in ('g', 'kg', 'ml', 'l', 'un', 'garrafa', 'lata', 'barril', 'caixa', 'pct', 'pacote', 'maco', 'fardo')),
  preco_normalizado  numeric(16,6) not null check (preco_normalizado > 0),
  pesquisa_id        uuid,
  escolhida          boolean not null default false,
  escolhida_em       timestamptz,
  registrada_em      timestamptz not null default now(),
  registrada_por     uuid
);
create index compras_cotacoes_insumo on public.compras_cotacoes (insumo_id, registrada_em desc);
create index compras_cotacoes_local on public.compras_cotacoes (fornecedor_id, registrada_em desc);
create index compras_cotacoes_unidade on public.compras_cotacoes (unidade_id, registrada_em desc);

create function public.compras_cotacoes_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_unidade text;
begin
  if tg_op = 'UPDATE' then
    if new.insumo_id is distinct from old.insumo_id or new.fornecedor_id is distinct from old.fornecedor_id
       or new.preco is distinct from old.preco or new.tamanho_embalagem is distinct from old.tamanho_embalagem
       or new.unidade_embalagem is distinct from old.unidade_embalagem or new.preco_normalizado is distinct from old.preco_normalizado
       or new.marca is distinct from old.marca or new.local_nome is distinct from old.local_nome
       or new.pesquisa_id is distinct from old.pesquisa_id or new.unidade_id is distinct from old.unidade_id
       or new.registrada_em is distinct from old.registrada_em or new.registrada_por is distinct from old.registrada_por then
      raise exception 'A pesquisa de preço não se altera: só dá para marcar ou desmarcar como escolhida.';
    end if;
    new.escolhida_em := case when new.escolhida then coalesce(old.escolhida_em, now()) else null end;
    return new;
  end if;
  select unidade_id into v_unidade from public.insumos where id = new.insumo_id;
  if v_unidade is null then
    raise exception 'Ingrediente não encontrado.';
  end if;
  if not exists (select 1 from public.fornecedores where id = new.fornecedor_id and unidade_id = v_unidade) then
    raise exception 'Local de compra de outra unidade.';
  end if;
  new.unidade_id := v_unidade;
  new.registrada_por := auth.uid();
  new.registrada_em := now();
  new.escolhida_em := case when new.escolhida then now() else null end;
  return new;
end $$;

create trigger compras_cotacoes_antes
  before insert or update on public.compras_cotacoes
  for each row execute function public.compras_cotacoes_antes();

alter table public.compras_cotacoes enable row level security;

-- quem vê o ingrediente vê e registra as cotações dele (RLS de insumos decide,
-- consultando como o próprio usuário)
create policy compras_cotacoes_ler on public.compras_cotacoes for select to authenticated
  using (exists (select 1 from public.insumos i where i.id = compras_cotacoes.insumo_id));
create policy compras_cotacoes_criar on public.compras_cotacoes for insert to authenticated
  with check (exists (select 1 from public.insumos i where i.id = compras_cotacoes.insumo_id and i.unidade_id = compras_cotacoes.unidade_id));
create policy compras_cotacoes_escolher on public.compras_cotacoes for update to authenticated
  using (exists (select 1 from public.insumos i where i.id = compras_cotacoes.insumo_id))
  with check (exists (select 1 from public.insumos i where i.id = compras_cotacoes.insumo_id and i.unidade_id = compras_cotacoes.unidade_id));

revoke all on public.compras_cotacoes from anon, authenticated;
grant select, insert on public.compras_cotacoes to authenticated;
grant update (escolhida) on public.compras_cotacoes to authenticated;
revoke all on function public.compras_cotacoes_antes() from public, anon, authenticated;

select md5(string_agg(column_name || ':' || data_type, ',' order by ordinal_position)) as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name = 'compras_cotacoes';

commit;
