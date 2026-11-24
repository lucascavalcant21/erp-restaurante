/* STATUS: APLICADA no banco do restaurante (sezccspqxgklicfndwxx) em 24/11/2026 com o OK do dono (BLQ-024: um sistema só).
 CONS-1: consultório médico (21/11/2026, decisão do dono: "vamos implementar
   no app"; consultório como unidade própria na mesma conta, como o Delivery).

   ADITIVA: cria a unidade "consultorio" (vazia) na mesma empresa do Delivery e
   seis tabelas novas: tipos de consulta, convênios, pacientes, consultas, fichas
   de atendimento e registro de acesso às fichas. Não altera nem lê nada do
   restaurante, do delivery ou dos eventos.

   ACESSO (dado de saúde, sensível na LGPD):
   - cons_pode_acessar: só quem tem a unidade do consultório como principal, um
     escopo explícito nela, ou é administrador da MESMA empresa. Escopo de
     empresa (gerente do restaurante) NÃO dá acesso ao consultório.
   - Fichas (diagnóstico, conduta): só o médico que escreveu lê e altera. Nem o
     administrador lê ficha de outro médico. Sem exclusão.
   - Leitura das fichas pela função cons_fichas_do_paciente, que registra quem
     abriu (cons_acessos); criar e alterar ficha também ficam registrados.
   - Sem exclusão de paciente, consulta, tipo ou convênio: inativa ou cancela.

   ROLLBACK: db/consultorio/CONS_1_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if not exists (select 1 from public.unidades where id = 'marmitaria' and empresa_id is not null) then
    raise exception 'CONS-1: unidade do Delivery sem empresa. Nada foi alterado.';
  end if;
  if to_regclass('public.usuarios_erp') is null or to_regclass('public.usuario_escopos') is null then
    raise exception 'CONS-1: faltam as tabelas de usuários. Nada foi alterado.';
  end if;
  if to_regprocedure('auth.uid()') is null then
    raise exception 'CONS-1: falta auth.uid(). Nada foi alterado.';
  end if;
end $$;

insert into public.unidades (id, nome, cor, ativo, empresa_id)
select 'consultorio', 'Consultório', '#0f766e', true, empresa_id from public.unidades where id = 'marmitaria'
on conflict (id) do nothing;

-- Quem enxerga o consultório (ver o cabeçalho).
create or replace function public.cons_pode_acessar(p_unidade_id text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.usuarios_erp u
     where u.auth_user_id = auth.uid() and u.status = 'ativo'
       and (u.locked_until is null or u.locked_until <= now())
       and (
         u.unidade_principal_id = p_unidade_id
         or exists (select 1 from public.usuario_escopos e where e.usuario_id = u.id and e.unidade_id = p_unidade_id)
         or (u.super_admin and exists (
               select 1 from public.unidades up join public.unidades uc on uc.empresa_id = up.empresa_id
                where up.id = u.unidade_principal_id and uc.id = p_unidade_id and up.empresa_id is not null))
       )
  )
$$;
revoke all on function public.cons_pode_acessar(text) from public;
grant execute on function public.cons_pode_acessar(text) to authenticated;

create or replace function public.cons_tocar() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

create table if not exists public.cons_tipos_consulta (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  nome text not null check (length(btrim(nome)) > 0),
  minutos integer not null default 30 check (minutos between 5 and 480),
  valor_particular numeric(12,2) check (valor_particular is null or valor_particular >= 0),
  eh_retorno boolean not null default false,
  ativo boolean not null default true,
  ordem integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cons_convenios (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  nome text not null check (length(btrim(nome)) > 0),
  prazo_dias integer check (prazo_dias is null or prazo_dias between 0 and 365),
  valores jsonb not null default '{}'::jsonb check (jsonb_typeof(valores) = 'object'),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cons_pacientes (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  nome text not null check (length(btrim(nome)) > 1),
  cpf text check (cpf is null or cpf ~ '^[0-9]{11}$'),
  telefone text,
  email text,
  nascimento date,
  sexo text check (sexo is null or sexo in ('F', 'M', 'O')),
  convenio_id uuid references public.cons_convenios(id),
  carteirinha text,
  observacoes text,
  aceita_whatsapp boolean not null default false,
  ativo boolean not null default true,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists cons_pacientes_cpf_unico on public.cons_pacientes (unidade_id, cpf) where cpf is not null;
create index if not exists cons_pacientes_nome on public.cons_pacientes (unidade_id, lower(nome));

create table if not exists public.cons_consultas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  paciente_id uuid not null references public.cons_pacientes(id),
  tipo_id uuid references public.cons_tipos_consulta(id),
  convenio_id uuid references public.cons_convenios(id),
  inicio timestamptz not null,
  fim timestamptz not null,
  status text not null default 'agendada'
    check (status in ('agendada', 'confirmada', 'chegou', 'em_atendimento', 'atendida', 'faltou', 'cancelada')),
  motivo text,
  valor numeric(12,2) check (valor is null or valor >= 0),
  forma_pagamento text,
  pago_em timestamptz,
  chegada_em timestamptz,
  atendimento_inicio timestamptz,
  atendimento_fim timestamptz,
  retorno_de uuid references public.cons_consultas(id),
  observacao text,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim > inicio)
);
create index if not exists cons_consultas_agenda on public.cons_consultas (unidade_id, inicio);
create index if not exists cons_consultas_paciente on public.cons_consultas (paciente_id, inicio);

create table if not exists public.cons_fichas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  paciente_id uuid not null references public.cons_pacientes(id),
  consulta_id uuid unique references public.cons_consultas(id),
  medico_id uuid not null default auth.uid(),
  queixa text,
  anotacoes text,
  diagnostico text,
  cid text,
  conduta text,
  exames text,
  medicacao text,
  retorno_dias integer check (retorno_dias is null or retorno_dias between 0 and 730),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists cons_fichas_paciente on public.cons_fichas (paciente_id, criado_em desc);

create table if not exists public.cons_acessos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  usuario_id uuid not null,
  paciente_id uuid,
  ficha_id uuid,
  acao text not null check (acao in ('leu', 'criou', 'alterou')),
  em timestamptz not null default now()
);
create index if not exists cons_acessos_paciente on public.cons_acessos (paciente_id, em desc);

-- Integridade entre tabelas: tudo da mesma unidade.
create or replace function public.cons_conferir_unidade() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name in ('cons_consultas', 'cons_fichas') then
    if not exists (select 1 from public.cons_pacientes p where p.id = new.paciente_id and p.unidade_id = new.unidade_id) then
      raise exception 'Paciente de outra unidade.';
    end if;
  end if;
  if tg_table_name = 'cons_consultas' then
    if new.tipo_id is not null and not exists (select 1 from public.cons_tipos_consulta t where t.id = new.tipo_id and t.unidade_id = new.unidade_id) then
      raise exception 'Tipo de consulta de outra unidade.';
    end if;
    if new.convenio_id is not null and not exists (select 1 from public.cons_convenios c where c.id = new.convenio_id and c.unidade_id = new.unidade_id) then
      raise exception 'Convênio de outra unidade.';
    end if;
  end if;
  if tg_table_name = 'cons_pacientes' then
    if new.convenio_id is not null
       and not exists (select 1 from public.cons_convenios c where c.id = new.convenio_id and c.unidade_id = new.unidade_id) then
      raise exception 'Convênio de outra unidade.';
    end if;
  end if;
  if tg_table_name = 'cons_fichas' then
    if new.consulta_id is not null and not exists (select 1 from public.cons_consultas c where c.id = new.consulta_id and c.paciente_id = new.paciente_id) then
      raise exception 'A consulta não é deste paciente.';
    end if;
    if tg_op = 'UPDATE' and new.medico_id <> old.medico_id then
      raise exception 'A ficha não muda de médico.';
    end if;
  end if;
  return new;
end $$;

-- Registro de criar e alterar ficha.
create or replace function public.cons_registrar_ficha() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.cons_acessos (unidade_id, usuario_id, paciente_id, ficha_id, acao)
  values (new.unidade_id, coalesce(auth.uid(), new.medico_id), new.paciente_id, new.id, case when tg_op = 'INSERT' then 'criou' else 'alterou' end);
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['cons_tipos_consulta', 'cons_convenios', 'cons_pacientes', 'cons_consultas', 'cons_fichas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_tocar', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.cons_tocar()', t || '_tocar', t);
  end loop;
  foreach t in array array['cons_pacientes', 'cons_consultas', 'cons_fichas'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_unidade', t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.cons_conferir_unidade()', t || '_unidade', t);
  end loop;
end $$;
drop trigger if exists cons_fichas_registro on public.cons_fichas;
create trigger cons_fichas_registro after insert or update on public.cons_fichas for each row execute function public.cons_registrar_ficha();

-- RLS
alter table public.cons_tipos_consulta enable row level security;
alter table public.cons_convenios enable row level security;
alter table public.cons_pacientes enable row level security;
alter table public.cons_consultas enable row level security;
alter table public.cons_fichas enable row level security;
alter table public.cons_acessos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['cons_tipos_consulta', 'cons_convenios', 'cons_pacientes', 'cons_consultas'] loop
    execute format('drop policy if exists cons_ler on public.%I', t);
    execute format('drop policy if exists cons_criar on public.%I', t);
    execute format('drop policy if exists cons_alterar on public.%I', t);
    execute format('create policy cons_ler on public.%I for select to authenticated using (public.cons_pode_acessar(unidade_id))', t);
    execute format('create policy cons_criar on public.%I for insert to authenticated with check (public.cons_pode_acessar(unidade_id))', t);
    execute format('create policy cons_alterar on public.%I for update to authenticated using (public.cons_pode_acessar(unidade_id)) with check (public.cons_pode_acessar(unidade_id))', t);
  end loop;
end $$;

drop policy if exists cons_ficha_ler on public.cons_fichas;
drop policy if exists cons_ficha_criar on public.cons_fichas;
drop policy if exists cons_ficha_alterar on public.cons_fichas;
create policy cons_ficha_ler on public.cons_fichas for select to authenticated
  using (medico_id = auth.uid() and public.cons_pode_acessar(unidade_id));
create policy cons_ficha_criar on public.cons_fichas for insert to authenticated
  with check (medico_id = auth.uid() and public.cons_pode_acessar(unidade_id));
create policy cons_ficha_alterar on public.cons_fichas for update to authenticated
  using (medico_id = auth.uid() and public.cons_pode_acessar(unidade_id))
  with check (medico_id = auth.uid() and public.cons_pode_acessar(unidade_id));

drop policy if exists cons_acesso_ler on public.cons_acessos;
create policy cons_acesso_ler on public.cons_acessos for select to authenticated
  using (public.cons_pode_acessar(unidade_id) and (usuario_id = auth.uid()
    or exists (select 1 from public.cons_fichas f where f.id = cons_acessos.ficha_id and f.medico_id = auth.uid())));

revoke all on public.cons_tipos_consulta, public.cons_convenios, public.cons_pacientes, public.cons_consultas, public.cons_fichas, public.cons_acessos from anon;
revoke delete, truncate on public.cons_tipos_consulta, public.cons_convenios, public.cons_pacientes, public.cons_consultas, public.cons_fichas, public.cons_acessos from authenticated;
grant select, insert, update on public.cons_tipos_consulta, public.cons_convenios, public.cons_pacientes, public.cons_consultas, public.cons_fichas to authenticated;
grant select on public.cons_acessos to authenticated;
revoke insert, update on public.cons_acessos from authenticated;

-- Fichas do paciente, do médico logado, registrando a leitura.
create or replace function public.cons_fichas_do_paciente(p_paciente_id uuid)
returns setof public.cons_fichas language plpgsql security definer set search_path = public as $$
declare v_unidade text;
begin
  select unidade_id into v_unidade from public.cons_pacientes where id = p_paciente_id;
  if auth.uid() is null or v_unidade is null or not public.cons_pode_acessar(v_unidade) then
    raise exception 'Sem acesso a este paciente.';
  end if;
  insert into public.cons_acessos (unidade_id, usuario_id, paciente_id, acao) values (v_unidade, auth.uid(), p_paciente_id, 'leu');
  return query select f.* from public.cons_fichas f
    where f.paciente_id = p_paciente_id and f.medico_id = auth.uid()
    order by f.criado_em desc;
end $$;
revoke all on function public.cons_fichas_do_paciente(uuid) from public;
grant execute on function public.cons_fichas_do_paciente(uuid) to authenticated;
revoke all on function public.cons_conferir_unidade() from public;
revoke all on function public.cons_registrar_ficha() from public;

-- Impressão digital: confere o que foi criado antes de confirmar.
do $$
declare n_tab int; n_rls int; n_pol int;
begin
  select count(*) into n_tab from pg_tables where schemaname = 'public' and tablename like 'cons\_%';
  select count(*) into n_rls from pg_tables where schemaname = 'public' and tablename like 'cons\_%' and rowsecurity;
  select count(*) into n_pol from pg_policies where schemaname = 'public' and tablename like 'cons\_%';
  if n_tab <> 6 or n_rls <> 6 or n_pol <> 16 then
    raise exception 'CONS-1: conferência falhou (tabelas %, com RLS %, regras %). Nada foi alterado.', n_tab, n_rls, n_pol;
  end if;
  if not exists (select 1 from public.unidades where id = 'consultorio') then
    raise exception 'CONS-1: unidade do consultório não criada. Nada foi alterado.';
  end if;
end $$;

commit;
