/* ═══════════════════════════════════════════════════════════════════════════
   PLANO-DIA-1 · PLANO DO DIA APROVADO PELO DONO E TAREFAS MARCADAS PELA EQUIPE

   STATUS: ESCRITA, NÃO APLICADA. É do SISTEMA DE TESTE (branch hefisto-teste):
   o banco do restaurante não recebe. Aplicar no banco de teste depois que a
   estrutura for copiada para ele (ACESSO-008).

   PEDIDO DO DONO (14/11/2026): "eu mando para o Jhon; ele conversa com o Nico
   para encontrarem a melhor maneira de agilizar as tarefas diárias". O dono
   aprova o plano que os dois combinaram; a equipe vê no Nico e marca o que
   fez; o Jhon devolve o andamento ao dono.

   FAZ (uma transação; só aditiva):
     1. plano_dia: um plano por unidade e dia (aprovar de novo substitui o
        anterior, que fica guardado como 'substituido').
     2. plano_dia_tarefa: as tarefas, na ordem, com quem faz, quanto, a ficha ou
        o procedimento, e quem marcou feito e quando.
     3. hefisto_aprovar_plano_dia(unidade, data, pedido, tarefas jsonb): só quem
        configura a inteligência na unidade (o dono). Responsável que não é
        funcionário ativo da unidade e ficha de outra unidade viram nulo: não se
        grava id de outra empresa.
     4. hefisto_marcar_tarefa_plano(tarefa, feito, quem): quem usa a inteligência
        na unidade (tablet do Nico incluso) marca ou desmarca. Grava o login
        (feito_por), o nome de quem fez (no tablet compartilhado, o que a pessoa
        tocou na tela: é rótulo, não prova) e a hora.
     5. As duas tabelas: leitura por quem usa a inteligência na unidade; escrita
        SÓ pelas funções (sem grant de insert/update/delete).
   NÃO FAZ: não mexe em checklist, produção, estoque nem ponto.

   VERIFICAÇÃO: o select do fim devolve c8ae79c9c0448a3dc24cc5a3bd32f4dd
   (conferida no PGlite por app/lib/plano-dia-banco.test.mjs, 18 casos).

   ROLLBACK (não rodar sem decisão do dono; apaga os planos):
     drop function if exists public.hefisto_marcar_tarefa_plano(uuid, boolean, text);
     drop function if exists public.hefisto_aprovar_plano_dia(text, date, text, jsonb);
     drop table if exists public.plano_dia_tarefa;
     drop table if exists public.plano_dia;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regprocedure('public.hefisto_user_can(text, text)') is null then
    raise exception 'PLANO-DIA-1: falta hefisto_user_can(text, text). Nada foi alterado.';
  end if;
  if to_regclass('public.colaboradores') is null or to_regclass('public.fichas_tecnicas') is null then
    raise exception 'PLANO-DIA-1: faltam colaboradores ou fichas_tecnicas. Nada foi alterado.';
  end if;
  if to_regclass('public.plano_dia') is not null or to_regclass('public.plano_dia_tarefa') is not null then
    raise exception 'PLANO-DIA-1: as tabelas já existem. Nada foi alterado.';
  end if;
end $$;

create table public.plano_dia (
  id           uuid primary key default gen_random_uuid(),
  unidade_id   text not null,
  data         date not null,
  pedido       text check (pedido is null or length(pedido) <= 2000),
  status       text not null default 'ativo' check (status in ('ativo', 'substituido')),
  aprovado_por text,
  criado_por   uuid,
  aprovado_em  timestamptz not null default now()
);
create unique index plano_dia_um_ativo on public.plano_dia (unidade_id, data) where status = 'ativo';

create table public.plano_dia_tarefa (
  id                  uuid primary key default gen_random_uuid(),
  plano_id            uuid not null references public.plano_dia(id),
  unidade_id          text not null,
  ordem               int not null check (ordem between 1 and 60),
  titulo              text not null check (length(btrim(titulo)) between 2 and 160),
  tipo                text not null check (tipo in ('producao', 'limpeza', 'etiquetas', 'organizacao', 'outro')),
  ficha_id            uuid,
  ficha_nome          text,
  procedimento        text check (procedimento is null or length(procedimento) <= 160),
  quantidade          numeric check (quantidade is null or quantidade > 0),
  unidade_medida      text check (unidade_medida is null or length(unidade_medida) <= 20),
  responsavel_id      uuid,
  responsavel_nome    text,
  depois_do_intervalo boolean not null default false,
  motivo              text check (motivo is null or length(motivo) <= 300),
  feito_em            timestamptz,
  feito_por           uuid,
  feito_por_nome      text
);
create index plano_dia_tarefa_plano on public.plano_dia_tarefa (plano_id, ordem);

alter table public.plano_dia enable row level security;
alter table public.plano_dia_tarefa enable row level security;

create policy plano_dia_ler on public.plano_dia for select to authenticated
  using (public.hefisto_user_can('dashboard.intelligence.view', unidade_id));
create policy plano_dia_tarefa_ler on public.plano_dia_tarefa for select to authenticated
  using (public.hefisto_user_can('dashboard.intelligence.view', unidade_id));

revoke all on public.plano_dia, public.plano_dia_tarefa from anon, authenticated;
grant select on public.plano_dia, public.plano_dia_tarefa to authenticated;

create function public.hefisto_aprovar_plano_dia(p_unidade text, p_data date, p_pedido text, p_tarefas jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_plano uuid;
  v_t jsonb;
  v_ordem int := 0;
  v_resp uuid;
  v_resp_nome text;
  v_ficha uuid;
  v_ficha_nome text;
  v_tipo text;
  v_qtd numeric;
begin
  if auth.uid() is null or not public.hefisto_user_can('dashboard.intelligence.settings', p_unidade) then
    return jsonb_build_object('ok', false, 'erro', 'Só o dono aprova o plano do dia desta unidade.');
  end if;
  if p_data is null or p_data < current_date - 1 or p_data > current_date + 7 then
    return jsonb_build_object('ok', false, 'erro', 'Data do plano fora do período aceito.');
  end if;
  if jsonb_typeof(p_tarefas) is distinct from 'array' or jsonb_array_length(p_tarefas) = 0 or jsonb_array_length(p_tarefas) > 60 then
    return jsonb_build_object('ok', false, 'erro', 'O plano precisa ter de 1 a 60 tarefas.');
  end if;

  update public.plano_dia set status = 'substituido' where unidade_id = p_unidade and data = p_data and status = 'ativo';
  insert into public.plano_dia (unidade_id, data, pedido, aprovado_por, criado_por)
    values (p_unidade, p_data, left(p_pedido, 2000),
            (select coalesce(nullif(raw_user_meta_data->>'nome', ''), email) from auth.users where id = auth.uid()),
            auth.uid())
    returning id into v_plano;

  for v_t in select * from jsonb_array_elements(p_tarefas) loop
    v_ordem := v_ordem + 1;
    v_tipo := coalesce(v_t->>'tipo', 'outro');
    if v_tipo not in ('producao', 'limpeza', 'etiquetas', 'organizacao', 'outro') then v_tipo := 'outro'; end if;

    -- responsável: só funcionário ativo DESTA unidade; o nome vem do cadastro
    v_resp := null; v_resp_nome := null;
    if (v_t->>'responsavelId') ~ '^[0-9a-f-]{36}$' then
      select id, nome into v_resp, v_resp_nome from public.colaboradores
       where id = (v_t->>'responsavelId')::uuid and unidade_id = p_unidade and coalesce(status, 'ativo') = 'ativo';
    end if;
    -- ficha: só desta unidade; o nome vem da ficha
    v_ficha := null; v_ficha_nome := null;
    if (v_t->>'fichaId') ~ '^[0-9a-f-]{36}$' then
      select id, nome_receita into v_ficha, v_ficha_nome from public.fichas_tecnicas
       where id = (v_t->>'fichaId')::uuid and unidade_id = p_unidade;
    end if;
    v_qtd := null;
    if (v_t->>'quantidade') ~ '^[0-9]+(\.[0-9]+)?$' and (v_t->>'quantidade')::numeric > 0 then v_qtd := (v_t->>'quantidade')::numeric; end if;

    insert into public.plano_dia_tarefa (plano_id, unidade_id, ordem, titulo, tipo, ficha_id, ficha_nome, procedimento,
      quantidade, unidade_medida, responsavel_id, responsavel_nome, depois_do_intervalo, motivo)
    values (v_plano, p_unidade, v_ordem, left(btrim(coalesce(v_t->>'titulo', 'Tarefa')), 160), v_tipo, v_ficha, v_ficha_nome,
      left(nullif(btrim(v_t->>'procedimento'), ''), 160), v_qtd, case when v_qtd is null then null else left(nullif(v_t->>'unidade', ''), 20) end,
      v_resp, v_resp_nome, coalesce((v_t->>'depoisDoIntervalo')::boolean, false), left(nullif(v_t->>'motivo', ''), 300));
  end loop;

  return jsonb_build_object('ok', true, 'plano_id', v_plano, 'tarefas', v_ordem);
end $$;

create function public.hefisto_marcar_tarefa_plano(p_tarefa uuid, p_feito boolean, p_quem text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_unidade text;
  v_status text;
begin
  select t.unidade_id, p.status into v_unidade, v_status
    from public.plano_dia_tarefa t join public.plano_dia p on p.id = t.plano_id where t.id = p_tarefa;
  if v_unidade is null or auth.uid() is null or not public.hefisto_user_can('dashboard.intelligence.view', v_unidade) then
    return jsonb_build_object('ok', false, 'erro', 'Tarefa não encontrada.');
  end if;
  if v_status <> 'ativo' then
    return jsonb_build_object('ok', false, 'erro', 'Este plano foi substituído por um mais novo.');
  end if;
  update public.plano_dia_tarefa
     set feito_em = case when p_feito then now() else null end,
         feito_por = case when p_feito then auth.uid() else null end,
         -- tablet compartilhado: quem fez é informado na tela (rótulo); o login fica em feito_por
         feito_por_nome = case when p_feito then coalesce(left(nullif(btrim(p_quem), ''), 80),
                                (select coalesce(nullif(raw_user_meta_data->>'nome', ''), email) from auth.users where id = auth.uid())) else null end
   where id = p_tarefa;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.hefisto_aprovar_plano_dia(text, date, text, jsonb) from public, anon;
revoke all on function public.hefisto_marcar_tarefa_plano(uuid, boolean, text) from public, anon;
grant execute on function public.hefisto_aprovar_plano_dia(text, date, text, jsonb) to authenticated;
grant execute on function public.hefisto_marcar_tarefa_plano(uuid, boolean, text) to authenticated;

select md5(string_agg(table_name || '.' || column_name || ':' || data_type, ',' order by table_name, ordinal_position)) as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name in ('plano_dia', 'plano_dia_tarefa');

commit;
