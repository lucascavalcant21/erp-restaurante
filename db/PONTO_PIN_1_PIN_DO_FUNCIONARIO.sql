/* ═══════════════════════════════════════════════════════════════════════════
   PONTO-PIN-1 · PIN DE 4 NÚMEROS DE CADA FUNCIONÁRIO PARA BATER O PONTO

   STATUS: ESCRITA, NÃO APLICADA. É do SISTEMA DE TESTE (branch hefisto-teste):
   o banco do restaurante não recebe. Aplicar no banco de teste depois que a
   estrutura for copiada para ele (ACESSO-008).

   DECISÃO DO DONO (14/11/2026): no tablet compartilhado (só ponto ou Nico +
   ponto), cada funcionário se identifica por um PIN de 4 números. Hoje o
   relógio de ponto do tablet mostra a lista de nomes e qualquer um toca no
   nome de outro.

   FAZ (uma transação; só aditiva):
     1. colaborador_pin: o PIN de cada funcionário, guardado só como hash
        (crypt/bcrypt do pgcrypto). Ninguém lê o PIN, nem o dono.
     2. ponto_pin_tentativas: cada tentativa no tablet (acertou ou não), para
        travar quem chuta: 5 erros em 10 minutos no mesmo login travam por 10
        minutos.
     3. As duas tabelas ficam fora da API (RLS ligado, sem política, sem grant).
     4. hefisto_definir_pin(colaborador, pin): quem pode editar funcionários
        daquela unidade (rh.employees.edit) define ou troca o PIN. Recusa PIN
        fraco (1111, 1234, 4321…) e PIN já usado por outra pessoa da unidade.
     5. hefisto_conferir_pin(unidade, pin): o tablet com permissão de bater
        ponto (ponto.clock.create) descobre QUEM é pelo PIN. Devolve só o id e
        o nome; o tablet segue com a batida como hoje.
     6. hefisto_tem_pin(unidade): lista quais funcionários já têm PIN (sem o
        PIN), para a tela do RH mostrar "PIN definido".
   NÃO FAZ: não muda colaboradores, ponto nem permissões; não grava batida.

   LIMITE CONHECIDO: a batida continua sendo gravada pela tela, como hoje. O PIN
   identifica a pessoa na tela do tablet; travar a batida no banco ao PIN fica
   para a próxima etapa (função de batida que exige o PIN).

   VERIFICAÇÃO: o select do fim devolve a impressão digital das colunas das
   duas tabelas: 3431fd46ddd8bdb846041b38d69a7985 (conferida no PGlite por
   app/lib/ponto-pin-banco.test.mjs). Funcionário com status diferente de
   'ativo' (no banco real: 'inativo') não bate ponto pelo PIN.

   ROLLBACK (não rodar sem decisão do dono; apaga os PINs):
     drop function if exists public.hefisto_tem_pin(text);
     drop function if exists public.hefisto_conferir_pin(text, text);
     drop function if exists public.hefisto_definir_pin(uuid, text);
     drop table if exists public.ponto_pin_tentativas;
     drop table if exists public.colaborador_pin;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.colaboradores') is null then
    raise exception 'PONTO-PIN-1: tabela colaboradores não existe. Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_user_can(text, text)') is null then
    raise exception 'PONTO-PIN-1: falta hefisto_user_can(text, text). Nada foi alterado.';
  end if;
  if to_regprocedure('extensions.crypt(text, text)') is null then
    raise exception 'PONTO-PIN-1: falta o pgcrypto (extensions.crypt). Nada foi alterado.';
  end if;
  if to_regclass('public.colaborador_pin') is not null then
    raise exception 'PONTO-PIN-1: colaborador_pin já existe. Nada foi alterado.';
  end if;
end $$;

create table public.colaborador_pin (
  colaborador_id uuid primary key references public.colaboradores(id) on delete cascade,
  unidade_id text not null,
  pin_hash text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index colaborador_pin_unidade_idx on public.colaborador_pin (unidade_id);

create table public.ponto_pin_tentativas (
  id bigserial primary key,
  unidade_id text not null,
  auth_user uuid,
  acertou boolean not null,
  em timestamptz not null default now()
);
create index ponto_pin_tentativas_idx on public.ponto_pin_tentativas (auth_user, em desc);

alter table public.colaborador_pin enable row level security;
alter table public.ponto_pin_tentativas enable row level security;
revoke all on public.colaborador_pin from anon, authenticated;
revoke all on public.ponto_pin_tentativas from anon, authenticated;
revoke all on sequence public.ponto_pin_tentativas_id_seq from anon, authenticated;

create function public.hefisto_definir_pin(p_colaborador uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_unidade text;
  v_ativo boolean;
begin
  select c.unidade_id, coalesce(c.status, 'ativo') = 'ativo' into v_unidade, v_ativo
    from public.colaboradores c where c.id = p_colaborador;
  if v_unidade is null then
    return jsonb_build_object('ok', false, 'erro', 'Funcionário não encontrado.');
  end if;
  if not public.hefisto_user_can('rh.employees.edit', v_unidade) then
    return jsonb_build_object('ok', false, 'erro', 'Sem permissão para definir o PIN deste funcionário.');
  end if;
  if coalesce(p_pin, '') !~ '^[0-9]{4}$' then
    return jsonb_build_object('ok', false, 'erro', 'O PIN tem 4 números.');
  end if;
  if p_pin ~ '^(.)\1{3}$' or p_pin in ('0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210') then
    return jsonb_build_object('ok', false, 'erro', 'PIN fácil de adivinhar. Escolha outro.');
  end if;
  if exists (
    select 1 from public.colaborador_pin p
     where p.unidade_id = v_unidade and p.colaborador_id <> p_colaborador
       and p.pin_hash = crypt(p_pin, p.pin_hash)
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Este PIN já é de outra pessoa da unidade. Escolha outro.');
  end if;
  insert into public.colaborador_pin (colaborador_id, unidade_id, pin_hash, atualizado_em, atualizado_por)
  values (p_colaborador, v_unidade, crypt(p_pin, gen_salt('bf', 8)), now(), auth.uid())
  on conflict (colaborador_id) do update
     set pin_hash = excluded.pin_hash, unidade_id = excluded.unidade_id,
         atualizado_em = now(), atualizado_por = auth.uid();
  return jsonb_build_object('ok', true);
end $$;

create function public.hefisto_conferir_pin(p_unidade text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_erros int;
  v_id uuid;
  v_nome text;
begin
  if not public.hefisto_user_can('ponto.clock.create', p_unidade) then
    return jsonb_build_object('ok', false, 'erro', 'Este aparelho não bate ponto nesta unidade.');
  end if;
  select count(*) into v_erros from public.ponto_pin_tentativas t
   where t.auth_user = auth.uid() and not t.acertou and t.em > now() - interval '10 minutes';
  if v_erros >= 5 then
    return jsonb_build_object('ok', false, 'bloqueado', true, 'erro', 'Muitos PINs errados. Aguarde 10 minutos ou chame o gerente.');
  end if;
  if coalesce(p_pin, '') ~ '^[0-9]{4}$' then
    select c.id, c.nome into v_id, v_nome
      from public.colaborador_pin p
      join public.colaboradores c on c.id = p.colaborador_id
     where p.unidade_id = p_unidade and c.unidade_id = p_unidade
       and coalesce(c.status, 'ativo') = 'ativo'
       and p.pin_hash = crypt(p_pin, p.pin_hash)
     limit 1;
  end if;
  insert into public.ponto_pin_tentativas (unidade_id, auth_user, acertou) values (p_unidade, auth.uid(), v_id is not null);
  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'PIN não encontrado.', 'restam', greatest(0, 4 - v_erros));
  end if;
  return jsonb_build_object('ok', true, 'colaborador_id', v_id, 'nome', v_nome);
end $$;

create function public.hefisto_tem_pin(p_unidade text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.colaborador_id from public.colaborador_pin p
   where p.unidade_id = p_unidade and public.hefisto_user_can('rh.employees.view', p_unidade)
$$;

revoke all on function public.hefisto_definir_pin(uuid, text) from public, anon;
revoke all on function public.hefisto_conferir_pin(text, text) from public, anon;
revoke all on function public.hefisto_tem_pin(text) from public, anon;
grant execute on function public.hefisto_definir_pin(uuid, text) to authenticated;
grant execute on function public.hefisto_conferir_pin(text, text) to authenticated;
grant execute on function public.hefisto_tem_pin(text) to authenticated;

select md5(string_agg(table_name || '.' || column_name || ':' || data_type, ',' order by table_name, ordinal_position)) as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name in ('colaborador_pin', 'ponto_pin_tentativas');

commit;
