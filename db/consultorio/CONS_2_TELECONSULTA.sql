/* CONS-2: teleconsulta (21/11/2026, decisão do dono: vídeo pelo Whereby,
   guardando consentimento + registro, SEM gravar o vídeo).

   ADITIVA:
   - cons_consultas.modalidade ('presencial' | 'teleconsulta'), padrão presencial.
   - cons_teleconsultas: a sala de cada teleconsulta (link do paciente, link do
     médico, provedor) e um código secreto para o paciente entrar sem login.
   - cons_consentimentos: o aceite do termo de telemedicina pelo paciente
     (CFM 2.314/2022: aceite eletrônico que faz parte do registro do paciente),
     com o texto e a versão do termo aceitos. Não se altera nem se apaga.
   - Duas funções para o paciente SEM login, só com o código: ver o convite
     (primeiro nome, data, termo) e aceitar o termo, que devolve o link da sala.
     O link da sala só sai depois do aceite.

   ROLLBACK: db/consultorio/CONS_2_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regclass('public.cons_consultas') is null or to_regprocedure('public.cons_pode_acessar(text)') is null then
    raise exception 'CONS-2: aplique a CONS-1 antes. Nada foi alterado.';
  end if;
end $$;

alter table public.cons_consultas add column if not exists modalidade text not null default 'presencial';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cons_consultas_modalidade_ck') then
    alter table public.cons_consultas add constraint cons_consultas_modalidade_ck check (modalidade in ('presencial', 'teleconsulta'));
  end if;
end $$;

create table if not exists public.cons_teleconsultas (
  consulta_id uuid primary key references public.cons_consultas(id),
  unidade_id text not null references public.unidades(id),
  codigo text not null unique check (length(codigo) >= 32),
  provedor text not null default 'whereby',
  sala_url text,
  sala_medico_url text,
  sala_id text,
  termo_versao text not null,
  termo_texto text not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.cons_consentimentos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  paciente_id uuid not null references public.cons_pacientes(id),
  consulta_id uuid not null references public.cons_consultas(id),
  tipo text not null default 'telemedicina' check (tipo in ('telemedicina')),
  termo_versao text not null,
  termo_texto text not null,
  termo_md5 text not null,
  aceito_em timestamptz not null default now(),
  navegador text,
  unique (consulta_id, tipo)
);

create or replace function public.cons_conferir_tele() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cons_consultas c where c.id = new.consulta_id and c.unidade_id = new.unidade_id) then
    raise exception 'Consulta de outra unidade.';
  end if;
  return new;
end $$;
revoke all on function public.cons_conferir_tele() from public;

drop trigger if exists cons_teleconsultas_unidade on public.cons_teleconsultas;
create trigger cons_teleconsultas_unidade before insert or update on public.cons_teleconsultas for each row execute function public.cons_conferir_tele();
drop trigger if exists cons_teleconsultas_tocar on public.cons_teleconsultas;
create trigger cons_teleconsultas_tocar before update on public.cons_teleconsultas for each row execute function public.cons_tocar();

alter table public.cons_teleconsultas enable row level security;
alter table public.cons_consentimentos enable row level security;

drop policy if exists cons_ler on public.cons_teleconsultas;
drop policy if exists cons_criar on public.cons_teleconsultas;
drop policy if exists cons_alterar on public.cons_teleconsultas;
create policy cons_ler on public.cons_teleconsultas for select to authenticated using (public.cons_pode_acessar(unidade_id));
create policy cons_criar on public.cons_teleconsultas for insert to authenticated with check (public.cons_pode_acessar(unidade_id));
create policy cons_alterar on public.cons_teleconsultas for update to authenticated using (public.cons_pode_acessar(unidade_id)) with check (public.cons_pode_acessar(unidade_id));
drop policy if exists cons_ler on public.cons_consentimentos;
create policy cons_ler on public.cons_consentimentos for select to authenticated using (public.cons_pode_acessar(unidade_id));

revoke all on public.cons_teleconsultas, public.cons_consentimentos from anon;
revoke delete, truncate on public.cons_teleconsultas, public.cons_consentimentos from authenticated;
grant select, insert, update on public.cons_teleconsultas to authenticated;
grant select on public.cons_consentimentos to authenticated;
revoke insert, update on public.cons_consentimentos from authenticated;

-- Convite do paciente (sem login): só o mínimo. A sala só depois do aceite.
create or replace function public.cons_convite_teleconsulta(p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t record; c record; p record; aceito timestamptz;
begin
  if p_codigo is null or length(p_codigo) < 32 then return jsonb_build_object('ok', false, 'erro', 'Convite inválido.'); end if;
  select * into t from public.cons_teleconsultas where codigo = p_codigo;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Convite inválido ou expirado.'); end if;
  select * into c from public.cons_consultas where id = t.consulta_id;
  if c.status in ('cancelada', 'faltou') then return jsonb_build_object('ok', false, 'erro', 'Esta consulta foi cancelada.'); end if;
  select nome into p from public.cons_pacientes where id = c.paciente_id;
  select aceito_em into aceito from public.cons_consentimentos where consulta_id = c.id and tipo = 'telemedicina';
  return jsonb_build_object('ok', true,
    'primeiro_nome', split_part(btrim(p.nome), ' ', 1),
    'inicio', c.inicio, 'fim', c.fim,
    'termo_versao', t.termo_versao, 'termo_texto', t.termo_texto,
    'aceito_em', aceito,
    'sala_url', case when aceito is not null then t.sala_url end);
end $$;

-- Aceite do termo pelo paciente (sem login). Idempotente.
create or replace function public.cons_aceitar_termo(p_codigo text, p_navegador text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t record; c record;
begin
  if p_codigo is null or length(p_codigo) < 32 then return jsonb_build_object('ok', false, 'erro', 'Convite inválido.'); end if;
  select * into t from public.cons_teleconsultas where codigo = p_codigo;
  if not found then return jsonb_build_object('ok', false, 'erro', 'Convite inválido ou expirado.'); end if;
  select * into c from public.cons_consultas where id = t.consulta_id;
  if c.status in ('cancelada', 'faltou') then return jsonb_build_object('ok', false, 'erro', 'Esta consulta foi cancelada.'); end if;
  insert into public.cons_consentimentos (unidade_id, paciente_id, consulta_id, termo_versao, termo_texto, termo_md5, navegador)
  values (t.unidade_id, c.paciente_id, c.id, t.termo_versao, t.termo_texto, md5(t.termo_texto), left(p_navegador, 300))
  on conflict (consulta_id, tipo) do nothing;
  return jsonb_build_object('ok', true, 'sala_url', t.sala_url);
end $$;

revoke all on function public.cons_convite_teleconsulta(text) from public;
revoke all on function public.cons_aceitar_termo(text, text) from public;
grant execute on function public.cons_convite_teleconsulta(text) to anon, authenticated;
grant execute on function public.cons_aceitar_termo(text, text) to anon, authenticated;

do $$
declare n_pol int; n_col int;
begin
  select count(*) into n_pol from pg_policies where schemaname = 'public' and tablename in ('cons_teleconsultas', 'cons_consentimentos');
  select count(*) into n_col from information_schema.columns where table_schema = 'public' and table_name = 'cons_consultas' and column_name = 'modalidade';
  if n_pol <> 4 or n_col <> 1 then
    raise exception 'CONS-2: conferência falhou (regras %, coluna %). Nada foi alterado.', n_pol, n_col;
  end if;
end $$;

commit;
