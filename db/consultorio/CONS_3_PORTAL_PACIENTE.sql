/* STATUS: APLICADA no banco do restaurante (sezccspqxgklicfndwxx) em 24/11/2026 com o OK do dono (BLQ-024: um sistema só).
 CONS-3: portal do paciente (21/11/2026, pedido do dono: "conta do paciente
   com login e senha gerados pelo médico, onde ele marca nova consulta e vê as
   informações e o vídeo").

   ADITIVA:
   - cons_pacientes.auth_user_id e login: o vínculo com o login do paciente
     (criado pelo servidor, com a chave de serviço, a pedido da equipe).
   - cons_fichas.orientacoes: o que o médico escreve PARA o paciente.
   - Funções do paciente (só o próprio, pelo login): meus dados, minhas
     consultas (com o convite da teleconsulta), tipos de consulta, horários
     livres, marcar, cancelar e os resumos das consultas (sem as anotações
     internas do médico; a leitura fica registrada).
   O paciente NÃO ganha acesso às tabelas: tudo passa por essas funções.
   Login de paciente não tem cadastro no ERP (usuarios_erp), então não abre
   nada do restaurante, do delivery, dos eventos nem da equipe do consultório.

   ROLLBACK: db/consultorio/CONS_3_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regclass('public.cons_teleconsultas') is null then
    raise exception 'CONS-3: aplique a CONS-1 e a CONS-2 antes. Nada foi alterado.';
  end if;
  if to_regclass('public.config_sistema') is null then
    raise exception 'CONS-3: falta config_sistema. Nada foi alterado.';
  end if;
end $$;

alter table public.cons_pacientes add column if not exists auth_user_id uuid;
alter table public.cons_pacientes add column if not exists login text;
alter table public.cons_fichas add column if not exists orientacoes text;
create unique index if not exists cons_pacientes_auth_unico on public.cons_pacientes (auth_user_id) where auth_user_id is not null;
create unique index if not exists cons_pacientes_login_unico on public.cons_pacientes (lower(login)) where login is not null;

-- O paciente do login atual (ou nada).
create or replace function public.cons_eu_paciente()
returns public.cons_pacientes language sql stable security definer set search_path = public as $$
  select p.* from public.cons_pacientes p where p.auth_user_id = auth.uid() and p.ativo and auth.uid() is not null limit 1
$$;

create or replace function public.cons_paciente_eu()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.cons_pacientes;
begin
  p := public.cons_eu_paciente();
  if p.id is null then return jsonb_build_object('ok', false); end if;
  return jsonb_build_object('ok', true, 'nome', p.nome, 'telefone', p.telefone, 'email', p.email,
    'convenio', (select c.nome from public.cons_convenios c where c.id = p.convenio_id));
end $$;

create or replace function public.cons_paciente_consultas()
returns table (id uuid, inicio timestamptz, fim timestamptz, status text, modalidade text, tipo text, valor numeric, pago boolean, convite text, termo_aceito boolean)
language plpgsql stable security definer set search_path = public as $$
declare p public.cons_pacientes;
begin
  p := public.cons_eu_paciente();
  if p.id is null then return; end if;
  return query
    select c.id, c.inicio, c.fim, c.status, c.modalidade, t.nome, c.valor, c.pago_em is not null,
           tc.codigo, exists (select 1 from public.cons_consentimentos k where k.consulta_id = c.id)
      from public.cons_consultas c
      left join public.cons_tipos_consulta t on t.id = c.tipo_id
      left join public.cons_teleconsultas tc on tc.consulta_id = c.id
     where c.paciente_id = p.id
     order by c.inicio desc
     limit 200;
end $$;

create or replace function public.cons_paciente_tipos()
returns table (id uuid, nome text, minutos integer, valor numeric)
language plpgsql stable security definer set search_path = public as $$
declare p public.cons_pacientes; v_valores jsonb;
begin
  p := public.cons_eu_paciente();
  if p.id is null then return; end if;
  select c.valores into v_valores from public.cons_convenios c where c.id = p.convenio_id and c.ativo;
  return query
    select t.id, t.nome, t.minutos,
           coalesce(nullif(v_valores ->> t.id::text, '')::numeric, t.valor_particular)
      from public.cons_tipos_consulta t
     where t.unidade_id = p.unidade_id and t.ativo
     order by t.ordem, t.nome;
end $$;

-- Horários livres de um dia (fuso de Brasília), de 30 em 30 minutos, dentro do
-- horário de atendimento cadastrado, a partir de 1 hora daqui, até 90 dias.
create or replace function public.cons_paciente_horarios(p_tipo_id uuid, p_dia date)
returns setof timestamptz language plpgsql stable security definer set search_path = public as $$
declare p public.cons_pacientes; v_min int; v_ini time; v_fim time; v_t timestamptz; v_ate timestamptz; v_params jsonb;
begin
  p := public.cons_eu_paciente();
  if p.id is null then return; end if;
  select t.minutos into v_min from public.cons_tipos_consulta t where t.id = p_tipo_id and t.unidade_id = p.unidade_id and t.ativo;
  if v_min is null then return; end if;
  if p_dia is null or p_dia < (now() at time zone 'America/Sao_Paulo')::date or p_dia > (now() at time zone 'America/Sao_Paulo')::date + 90 then return; end if;
  select cs.params into v_params from public.config_sistema cs where cs.unidade_id = p.unidade_id limit 1;
  begin
    v_ini := coalesce(nullif(v_params -> 'consultorio_custos' -> 'expediente' ->> 'inicio', ''), '08:00')::time;
    v_fim := coalesce(nullif(v_params -> 'consultorio_custos' -> 'expediente' ->> 'fim', ''), '18:00')::time;
  exception when others then v_ini := '08:00'; v_fim := '18:00';
  end;
  v_t := (p_dia + v_ini) at time zone 'America/Sao_Paulo';
  v_ate := (p_dia + v_fim) at time zone 'America/Sao_Paulo';
  while v_t + make_interval(mins => v_min) <= v_ate loop
    if v_t >= now() + interval '1 hour' and not exists (
        select 1 from public.cons_consultas c
         where c.unidade_id = p.unidade_id and c.status not in ('cancelada', 'faltou')
           and c.inicio < v_t + make_interval(mins => v_min) and c.fim > v_t) then
      return next v_t;
    end if;
    v_t := v_t + interval '30 minutes';
  end loop;
end $$;

create or replace function public.cons_paciente_marcar(p_tipo_id uuid, p_inicio timestamptz, p_modalidade text default 'presencial', p_motivo text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.cons_pacientes; t public.cons_tipos_consulta; v_valores jsonb; v_id uuid; v_valor numeric;
begin
  p := public.cons_eu_paciente();
  if p.id is null then return jsonb_build_object('ok', false, 'erro', 'Login sem cadastro de paciente.'); end if;
  if p_modalidade not in ('presencial', 'teleconsulta') then return jsonb_build_object('ok', false, 'erro', 'Modalidade inválida.'); end if;
  select * into t from public.cons_tipos_consulta where id = p_tipo_id and unidade_id = p.unidade_id and ativo;
  if t.id is null then return jsonb_build_object('ok', false, 'erro', 'Tipo de consulta indisponível.'); end if;
  if (select count(*) from public.cons_consultas c where c.paciente_id = p.id and c.status in ('agendada', 'confirmada') and c.inicio > now()) >= 3 then
    return jsonb_build_object('ok', false, 'erro', 'Você já tem 3 consultas marcadas. Fale com o consultório para marcar mais.');
  end if;
  if not exists (select 1 from public.cons_paciente_horarios(p_tipo_id, (p_inicio at time zone 'America/Sao_Paulo')::date) h where h = p_inicio) then
    return jsonb_build_object('ok', false, 'erro', 'Esse horário não está mais livre. Escolha outro.');
  end if;
  select c.valores into v_valores from public.cons_convenios c where c.id = p.convenio_id and c.ativo;
  v_valor := coalesce(nullif(v_valores ->> t.id::text, '')::numeric, t.valor_particular);
  insert into public.cons_consultas (unidade_id, paciente_id, tipo_id, convenio_id, inicio, fim, status, modalidade, motivo, valor, observacao)
  values (p.unidade_id, p.id, t.id, case when v_valores is not null then p.convenio_id end, p_inicio, p_inicio + make_interval(mins => t.minutos),
          'agendada', p_modalidade, nullif(left(btrim(coalesce(p_motivo, '')), 500), ''), v_valor, 'Marcada pelo paciente no portal')
  returning id into v_id;
  return jsonb_build_object('ok', true, 'consulta_id', v_id);
end $$;

-- Cancela a própria consulta com pelo menos 2 horas de antecedência.
create or replace function public.cons_paciente_cancelar(p_consulta_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare p public.cons_pacientes; c public.cons_consultas;
begin
  p := public.cons_eu_paciente();
  if p.id is null then return jsonb_build_object('ok', false, 'erro', 'Login sem cadastro de paciente.'); end if;
  select * into c from public.cons_consultas where id = p_consulta_id and paciente_id = p.id;
  if c.id is null then return jsonb_build_object('ok', false, 'erro', 'Consulta não encontrada.'); end if;
  if c.status not in ('agendada', 'confirmada') then return jsonb_build_object('ok', false, 'erro', 'Essa consulta não pode mais ser cancelada por aqui.'); end if;
  if c.inicio < now() + interval '2 hours' then return jsonb_build_object('ok', false, 'erro', 'Faltam menos de 2 horas: fale com o consultório.'); end if;
  update public.cons_consultas set status = 'cancelada', observacao = trim(both ' ' from coalesce(observacao, '') || ' Cancelada pelo paciente no portal.') where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

-- Resumos das consultas para o paciente (sem as anotações internas). Leitura registrada.
create or replace function public.cons_paciente_resumos()
returns table (data timestamptz, modalidade text, queixa text, diagnostico text, cid text, conduta text, exames text, medicacao text, orientacoes text, retorno_dias integer)
language plpgsql security definer set search_path = public as $$
declare p public.cons_pacientes;
begin
  p := public.cons_eu_paciente();
  if p.id is null then return; end if;
  insert into public.cons_acessos (unidade_id, usuario_id, paciente_id, acao) values (p.unidade_id, auth.uid(), p.id, 'leu');
  return query
    select f.criado_em, coalesce(c.modalidade, 'presencial'), f.queixa, f.diagnostico, f.cid, f.conduta, f.exames, f.medicacao, f.orientacoes, f.retorno_dias
      from public.cons_fichas f left join public.cons_consultas c on c.id = f.consulta_id
     where f.paciente_id = p.id
     order by f.criado_em desc
     limit 100;
end $$;

do $$
declare f text;
begin
  foreach f in array array['cons_eu_paciente()', 'cons_paciente_eu()', 'cons_paciente_consultas()', 'cons_paciente_tipos()',
    'cons_paciente_horarios(uuid,date)', 'cons_paciente_marcar(uuid,timestamptz,text,text)', 'cons_paciente_cancelar(uuid)', 'cons_paciente_resumos()'] loop
    execute format('revoke all on function public.%s from public', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$
begin
  if (select count(*) from information_schema.columns where table_schema = 'public' and
       ((table_name = 'cons_pacientes' and column_name in ('auth_user_id', 'login')) or (table_name = 'cons_fichas' and column_name = 'orientacoes'))) <> 3
     or to_regprocedure('public.cons_paciente_marcar(uuid,timestamptz,text,text)') is null then
    raise exception 'CONS-3: conferência falhou. Nada foi alterado.';
  end if;
end $$;

commit;
