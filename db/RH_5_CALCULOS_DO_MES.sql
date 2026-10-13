/* ═══════════════════════════════════════════════════════════════════════════
   RH-5 · CÁLCULOS DO MÊS COM SITUAÇÃO (HDEV-RH-001, Fase 4b)

   STATUS: aplicada com a autorização permanente do dono para a missão de RH
   (13/10/2026), por ser aditiva e ensaiada.

   Guarda o retrato do cálculo do motor (app/lib/trabalhista/motor-direitos.mjs)
   por colaborador e competência, com a situação:
     simulacao            registrado pelo RH (rh.payroll.manage)
     calculo_validado     conferido pelo contador (dp.calculos.validar)
     pagamento_registrado (Fase 8, ligado a Contas a Pagar)
     obrigacao_cumprida   (Fase 8, eSocial / FGTS Digital / DCTFWeb)
     substituido          simulação refeita: a anterior fica guardada

   Regras (no banco, não na tela):
     - linhas, totais, pendências e autoria não mudam depois de gravados, e
       nada é apagado (gatilho);
     - registrar de novo o mesmo mês substitui a simulação anterior, mas é
       recusado se o mês já foi validado (o contador precisa reabrir);
     - exige vínculo de trabalho (RH-4) na competência;
     - validar com pendências exige observação do contador;
     - reabrir (volta a simulação) só quem valida, com motivo, e só antes do
       pagamento. Validar e reabrir gravam rh_historico.
   Escrita só pelas funções (sem policy de insert/update/delete).

   FAZ (uma transação; só cria; não altera nenhuma linha existente):
     1. rh_calculos_mes + RLS de leitura (rh.payroll.view ou dp.calculos.validar)
     2. gatilho de imutabilidade
     3. funções rh_calculo_registrar / rh_calculo_validar / rh_calculo_reabrir
   ROLLBACK (não rodar sem decisão do dono):
     drop function if exists public.rh_calculo_reabrir(uuid, text), public.rh_calculo_validar(uuid, text),
       public.rh_calculo_registrar(uuid, text, jsonb, jsonb, jsonb, jsonb);
     drop table if exists public.rh_calculos_mes cascade;
     drop function if exists public.rh_calculos_mes_imutavel();
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.rh_calculos_mes') is not null then raise exception 'RH-5: rh_calculos_mes já existe. Nada foi alterado.'; end if;
  if to_regclass('public.rh_vinculos') is null then raise exception 'RH-5: precisa da RH-4. Nada foi alterado.'; end if;
end $$;

create table public.rh_calculos_mes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete restrict,
  unidade_id text not null references public.unidades(id),
  vinculo_id uuid not null references public.rh_vinculos(id) on delete restrict,
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  versao int not null check (versao >= 1),
  situacao text not null default 'simulacao'
    check (situacao in ('simulacao','calculo_validado','pagamento_registrado','obrigacao_cumprida','substituido')),
  linhas jsonb not null check (jsonb_typeof(linhas) = 'array'),
  totais jsonb not null check (jsonb_typeof(totais) = 'object'),
  pendencias jsonb not null default '[]' check (jsonb_typeof(pendencias) = 'array'),
  meta jsonb not null default '{}' check (jsonb_typeof(meta) = 'object'),
  registrado_por uuid default auth.uid(),
  registrado_em timestamptz not null default now(),
  validado_por uuid,
  validado_em timestamptz,
  observacao_validacao text,
  substituido_por uuid references public.rh_calculos_mes(id),
  unique (colaborador_id, competencia, versao)
);
create unique index rh_calculos_mes_um_vigente on public.rh_calculos_mes (colaborador_id, competencia) where situacao <> 'substituido';
create index rh_calculos_mes_unidade on public.rh_calculos_mes (unidade_id, competencia);
comment on table public.rh_calculos_mes is 'Retrato do cálculo trabalhista do mês, com situação (simulação → validado → pago → obrigação). Escrita só por funções. RH-5.';

create function public.rh_calculos_mes_imutavel() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Cálculo do mês não é apagado: fica no histórico.'; end if;
  if new.linhas is distinct from old.linhas or new.totais is distinct from old.totais or new.pendencias is distinct from old.pendencias
     or new.meta is distinct from old.meta or new.colaborador_id is distinct from old.colaborador_id or new.vinculo_id is distinct from old.vinculo_id
     or new.competencia is distinct from old.competencia or new.versao is distinct from old.versao or new.unidade_id is distinct from old.unidade_id
     or new.registrado_por is distinct from old.registrado_por or new.registrado_em is distinct from old.registrado_em then
    raise exception 'Cálculo do mês: o conteúdo gravado não muda. Registre uma nova versão.';
  end if;
  -- substituído só aceita receber o ponteiro para a versão nova, uma vez
  if old.situacao = 'substituido' and (new.situacao <> 'substituido' or old.substituido_por is not null) then
    raise exception 'Cálculo substituído não muda.';
  end if;
  return new;
end $$;
revoke all on function public.rh_calculos_mes_imutavel() from public, anon, authenticated;
create trigger rh_calculos_mes_imutavel before update or delete on public.rh_calculos_mes
  for each row execute function public.rh_calculos_mes_imutavel();

alter table public.rh_calculos_mes enable row level security;
create policy rh_calculos_mes_ler on public.rh_calculos_mes for select to authenticated
  using (public.hefisto_user_can('rh.payroll.view', unidade_id) or public.hefisto_user_can('dp.calculos.validar', unidade_id));

-- Registrar (RH): grava nova versão; a simulação anterior do mesmo mês vira "substituido".
create function public.rh_calculo_registrar(p_colaborador uuid, p_competencia text, p_linhas jsonb, p_totais jsonb, p_pendencias jsonb, p_meta jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_unid text; v_vinc uuid; v_atual record; v_novo uuid; v_ini date;
begin
  select unidade_id into v_unid from colaboradores where id = p_colaborador;
  if v_unid is null then raise exception 'Colaborador não encontrado.'; end if;
  if not hefisto_user_can('rh.payroll.manage', v_unid) then raise exception 'Sem permissão para registrar cálculo da folha.'; end if;
  if p_competencia is null or p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Competência inválida (use AAAA-MM).'; end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' or jsonb_array_length(p_linhas) = 0 then raise exception 'Cálculo sem linhas.'; end if;
  if jsonb_typeof(p_totais) is distinct from 'object' then raise exception 'Cálculo sem totais.'; end if;
  v_ini := (p_competencia || '-01')::date;
  select id into v_vinc from rh_vinculos where colaborador_id = p_colaborador
    and inicio < v_ini + interval '1 month' and (fim is null or fim >= v_ini) order by inicio desc limit 1;
  if v_vinc is null then raise exception 'Sem vínculo de trabalho em %: registre o vínculo antes.', p_competencia; end if;

  select * into v_atual from rh_calculos_mes where colaborador_id = p_colaborador and competencia = p_competencia and situacao <> 'substituido' for update;
  if v_atual.id is not null and v_atual.situacao <> 'simulacao' then
    raise exception 'O cálculo de % já foi validado. Peça ao contador para reabrir antes de recalcular.', p_competencia;
  end if;
  if v_atual.id is not null then update rh_calculos_mes set situacao = 'substituido' where id = v_atual.id; end if;

  insert into rh_calculos_mes (colaborador_id, unidade_id, vinculo_id, competencia, versao, linhas, totais, pendencias, meta)
  values (p_colaborador, v_unid, v_vinc, p_competencia,
    coalesce((select max(versao) from rh_calculos_mes where colaborador_id = p_colaborador and competencia = p_competencia), 0) + 1,
    p_linhas, p_totais, coalesce(p_pendencias, '[]'), coalesce(p_meta, '{}'))
  returning id into v_novo;
  if v_atual.id is not null then update rh_calculos_mes set substituido_por = v_novo where id = v_atual.id; end if;
  return v_novo;
end $$;

-- Validar (contador): simulação → cálculo validado. Com pendências, exige observação.
create function public.rh_calculo_validar(p_id uuid, p_observacao text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from rh_calculos_mes where id = p_id for update;
  if r.id is null then raise exception 'Cálculo não encontrado.'; end if;
  if not hefisto_user_can('dp.calculos.validar', r.unidade_id) then raise exception 'Sem permissão para validar cálculo (perfil Contador ou proprietário).'; end if;
  if r.situacao <> 'simulacao' then raise exception 'Só uma simulação pode ser validada (situação atual: %).', r.situacao; end if;
  if jsonb_array_length(r.pendencias) > 0 and length(btrim(coalesce(p_observacao, ''))) < 5 then
    raise exception 'Este cálculo tem % pendência(s): escreva na observação como foram resolvidas.', jsonb_array_length(r.pendencias);
  end if;
  update rh_calculos_mes set situacao = 'calculo_validado', validado_por = auth.uid(), validado_em = now(),
    observacao_validacao = nullif(btrim(coalesce(p_observacao, '')), '') where id = p_id;
  insert into rh_historico (func_id, unidade_id, data, tipo_evento, valor_antigo, valor_novo, observacao)
  values (r.colaborador_id, r.unidade_id, current_date, 'folha', 'simulacao', 'calculo_validado',
    format('Cálculo de %s (versão %s) validado. Líquido %s. %s [cálculo %s]', r.competencia, r.versao, r.totais->>'liquido', coalesce(p_observacao, ''), r.id));
end $$;

-- Reabrir (contador): cálculo validado → simulação, com motivo. Depois do pagamento, não.
create function public.rh_calculo_reabrir(p_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select * into r from rh_calculos_mes where id = p_id for update;
  if r.id is null then raise exception 'Cálculo não encontrado.'; end if;
  if not hefisto_user_can('dp.calculos.validar', r.unidade_id) then raise exception 'Sem permissão para reabrir cálculo.'; end if;
  if r.situacao <> 'calculo_validado' then raise exception 'Só um cálculo validado (e ainda não pago) pode ser reaberto. Situação: %.', r.situacao; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Informe o motivo da reabertura.'; end if;
  update rh_calculos_mes set situacao = 'simulacao', validado_por = null, validado_em = null, observacao_validacao = null where id = p_id;
  insert into rh_historico (func_id, unidade_id, data, tipo_evento, valor_antigo, valor_novo, observacao)
  values (r.colaborador_id, r.unidade_id, current_date, 'folha', 'calculo_validado', 'simulacao',
    format('Cálculo de %s (versão %s) reaberto: %s [cálculo %s]', r.competencia, r.versao, p_motivo, r.id));
end $$;

revoke all on function public.rh_calculo_registrar(uuid, text, jsonb, jsonb, jsonb, jsonb) from public, anon;
revoke all on function public.rh_calculo_validar(uuid, text) from public, anon;
revoke all on function public.rh_calculo_reabrir(uuid, text) from public, anon;
grant execute on function public.rh_calculo_registrar(uuid, text, jsonb, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.rh_calculo_validar(uuid, text) to authenticated;
grant execute on function public.rh_calculo_reabrir(uuid, text) to authenticated;

commit;

-- verificação pós-aplicação
select 'tabela' k, coalesce(to_regclass('public.rh_calculos_mes')::text, 'FALTA') v
union all select 'rls', relrowsecurity::text from pg_class where oid = 'public.rh_calculos_mes'::regclass
union all select 'policies', count(*)::text from pg_policies where tablename = 'rh_calculos_mes'
union all select 'funcoes', count(*)::text from pg_proc where proname in ('rh_calculo_registrar','rh_calculo_validar','rh_calculo_reabrir');
