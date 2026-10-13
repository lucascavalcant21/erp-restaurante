/* ═══════════════════════════════════════════════════════════════════════════
   RH-4 · VÍNCULOS E TRANSIÇÕES CONTRATUAIS (HDEV-RH-001, Fase 3)

   STATUS: aplicada com autorização permanente do dono para a missão de RH
   (13/10/2026: "publica tudo e vai para a fase 3 sem me perguntar").

   Três conceitos separados:
     categoria jurídica  rh_vinculos.categoria (eventual, intermitente,
                         clt_experiencia, clt_indeterminado, outro)
     fase                calculada a partir das datas (app/lib/vinculos.mjs)
     remuneração         rh_vinculos.regra_remuneracao (mensal, diaria, hora, servico)

   Um vínculo nunca é sobrescrito: mudança de categoria fecha o atual (fim) e
   abre outro ligado a ele (vinculo_anterior_id). O início de um vínculo não
   muda depois de criado (gatilho). Transições (prorrogação, efetivação,
   mudança de categoria, alteração salarial) são SOLICITADAS
   (dp.contratos.solicitar) e DECIDIDAS (dp.contratos.aprovar) por funções
   que validam CLT art. 445/451 e, com convenção ativa, a CCT (cl. 19:
   mínimo 30, prorrogação não menor que o 1º período, total ≤ 90). Cada
   decisão grava rh_historico (imutável, RH-2).

   FAZ (uma transação; só cria; não altera nenhuma linha existente de
   colaboradores — o retrato atual vira o 1º vínculo de cada um):
     1. rh_vinculos (+ um aberto por colaborador, início imutável)
     2. rh_vinculo_transicoes
     3. funções rh_transicao_solicitar / rh_transicao_decidir
     4. carga inicial: 1 vínculo por colaborador a partir do cadastro atual.
        Sem data de início: usa o 1º recibo de prestação ou a data de
        cadastro e marca inicio_estimado = true (nada é inventado como real).
   ROLLBACK (não rodar sem decisão do dono):
     drop function if exists public.rh_transicao_decidir(uuid, boolean, text), public.rh_transicao_solicitar(uuid, text, date, jsonb, text, text);
     drop table if exists public.rh_vinculo_transicoes, public.rh_vinculos cascade;
     drop function if exists public.rh_vinculos_inicio_imutavel();
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.rh_vinculos') is not null then raise exception 'RH-4: rh_vinculos já existe. Nada foi alterado.'; end if;
  if to_regclass('public.rh_convencoes') is null then raise exception 'RH-4: precisa da RH-3. Nada foi alterado.'; end if;
end $$;

create table public.rh_vinculos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete restrict,
  unidade_id text not null references public.unidades(id),
  categoria text not null check (categoria in ('eventual','intermitente','clt_experiencia','clt_indeterminado','outro')),
  regra_remuneracao text not null check (regra_remuneracao in ('mensal','diaria','hora','servico')),
  inicio date not null,
  inicio_estimado boolean not null default false,
  experiencia_dias int check (experiencia_dias is null or experiencia_dias between 1 and 90),
  prorrogacao_dias int check (prorrogacao_dias is null or prorrogacao_dias between 1 and 89),
  fim date,
  motivo_fim text,
  salario_base numeric check (salario_base is null or salario_base >= 0),
  vinculo_anterior_id uuid references public.rh_vinculos(id),
  convencao_id uuid references public.rh_convencoes(id),
  documento_ref text,
  criado_por uuid default auth.uid(),
  created_at timestamptz not null default now(),
  check (fim is null or fim >= inicio),
  check (categoria = 'clt_experiencia' or (experiencia_dias is null and prorrogacao_dias is null)),
  check (coalesce(experiencia_dias, 0) + coalesce(prorrogacao_dias, 0) <= 90)
);
create unique index rh_vinculos_um_aberto_por_colaborador on public.rh_vinculos (colaborador_id) where fim is null;
create index rh_vinculos_colaborador on public.rh_vinculos (colaborador_id, inicio);
comment on table public.rh_vinculos is 'Vínculos de trabalho (categoria jurídica + regra de remuneração). Nunca sobrescritos. RH-4.';

create function public.rh_vinculos_inicio_imutavel() returns trigger language plpgsql as $$
begin
  if new.inicio is distinct from old.inicio or new.colaborador_id is distinct from old.colaborador_id or new.categoria is distinct from old.categoria then
    raise exception 'Vínculo: início, colaborador e categoria não mudam depois de criados. Registre uma transição.';
  end if;
  return new;
end $$;
create trigger rh_vinculos_inicio_imutavel before update on public.rh_vinculos
  for each row execute function public.rh_vinculos_inicio_imutavel();

alter table public.rh_vinculos enable row level security;
create policy rh_vinculos_ler on public.rh_vinculos for select to authenticated
  using (public.hefisto_user_can('rh.employees.view', unidade_id) or colaborador_id in (select unnest(public.hefisto_meus_colaboradores())));
-- sem INSERT/UPDATE/DELETE direto: só pelas funções abaixo

create table public.rh_vinculo_transicoes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references public.colaboradores(id) on delete restrict,
  unidade_id text not null references public.unidades(id),
  vinculo_id uuid not null references public.rh_vinculos(id),
  tipo text not null check (tipo in ('prorrogacao','efetivacao','mudanca_categoria','alteracao_salarial')),
  vigencia date not null,
  dados jsonb not null default '{}'::jsonb,
  motivo text not null check (length(btrim(motivo)) >= 3),
  documento_ref text,
  fundamentos text[] not null default '{}',
  status text not null default 'solicitada' check (status in ('solicitada','aprovada','recusada','cancelada')),
  solicitado_por uuid default auth.uid(), solicitado_em timestamptz not null default now(),
  decidido_por uuid, decidido_em timestamptz, observacao_decisao text,
  novo_vinculo_id uuid references public.rh_vinculos(id)
);
create index rh_transicoes_colaborador on public.rh_vinculo_transicoes (colaborador_id, solicitado_em desc);
create unique index rh_transicoes_uma_pendente on public.rh_vinculo_transicoes (vinculo_id, tipo) where status = 'solicitada';
alter table public.rh_vinculo_transicoes enable row level security;
create policy rh_transicoes_ler on public.rh_vinculo_transicoes for select to authenticated
  using (public.hefisto_user_can('rh.employees.view', unidade_id));

-- regras de experiência: CLT sempre; CCT cl. 19 quando há convenção ativa da unidade
create function public.rh_validar_experiencia(p_unidade text, p_primeiro int, p_prorrogacao int) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare v_cct boolean; v_erros text[] := '{}';
begin
  select exists (select 1 from rh_convencoes where status = 'ativa' and unidades @> array[p_unidade]) into v_cct;
  if p_primeiro + coalesce(p_prorrogacao, 0) > 90 then v_erros := v_erros || 'Os dois períodos passam de 90 dias (CLT art. 445 parágrafo único).'; end if;
  if v_cct and p_primeiro < 30 then v_erros := v_erros || 'O 1º período precisa ter no mínimo 30 dias (CCT Foz 2026/2027, cl. 19 §1º, p. 4).'; end if;
  if v_cct and p_prorrogacao is not null and p_prorrogacao < p_primeiro then
    v_erros := v_erros || format('A prorrogação (%s dias) não pode ser menor que o 1º período (%s dias) (CCT Foz 2026/2027, cl. 19 §3º, p. 4).', p_prorrogacao, p_primeiro);
  end if;
  return v_erros;
end $$;

create function public.rh_transicao_solicitar(p_colaborador uuid, p_tipo text, p_vigencia date, p_dados jsonb, p_motivo text, p_documento text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_v rh_vinculos%rowtype; v_erros text[] := '{}'; v_id uuid; v_fim1 date; v_fund text[] := '{}';
begin
  select * into v_v from rh_vinculos where colaborador_id = p_colaborador and fim is null;
  if v_v.id is null then raise exception 'Colaborador sem vínculo aberto.'; end if;
  if not hefisto_user_can('dp.contratos.solicitar', v_v.unidade_id) and not hefisto_user_can('dp.contratos.aprovar', v_v.unidade_id) then
    raise exception 'Sem permissão para solicitar alteração contratual.';
  end if;
  if p_vigencia is null then raise exception 'Informe a data de vigência.'; end if;
  if p_vigencia < v_v.inicio then raise exception 'A vigência não pode ser anterior ao início do vínculo (%).', v_v.inicio; end if;

  if p_tipo = 'prorrogacao' then
    if v_v.categoria <> 'clt_experiencia' then raise exception 'Só contrato de experiência pode ser prorrogado.'; end if;
    if v_v.prorrogacao_dias is not null then raise exception 'A experiência já foi prorrogada uma vez (CLT art. 451).'; end if;
    v_fim1 := v_v.inicio + v_v.experiencia_dias - 1;
    if current_date > v_fim1 then raise exception 'O 1º período terminou em %: a prorrogação precisava ser feita antes. Registre a efetivação.', v_fim1; end if;
    v_erros := rh_validar_experiencia(v_v.unidade_id, v_v.experiencia_dias, (p_dados->>'dias')::int);
    if (p_dados->>'dias') is null then v_erros := v_erros || 'Informe os dias da prorrogação.'; end if;
    p_vigencia := v_fim1 + 1;
    v_fund := array['CLT art. 445 parágrafo único e art. 451', 'CCT Foz 2026/2027, cl. 19 §3º, p. 4 (com convenção ativa)'];
  elsif p_tipo = 'efetivacao' then
    if v_v.categoria not in ('clt_experiencia','eventual','intermitente','outro') then raise exception 'Este vínculo já é por prazo indeterminado.'; end if;
    v_fund := array['CLT art. 443 e 451 (contrato por prazo indeterminado)'];
  elsif p_tipo = 'mudanca_categoria' then
    if (p_dados->>'categoria') is null or (p_dados->>'categoria') not in ('eventual','intermitente','clt_experiencia','clt_indeterminado','outro') then raise exception 'Informe a nova categoria.'; end if;
    if (p_dados->>'categoria') = v_v.categoria then raise exception 'A nova categoria é igual à atual.'; end if;
    if (p_dados->>'categoria') = 'clt_experiencia' then
      v_erros := rh_validar_experiencia(v_v.unidade_id, coalesce((p_dados->>'experiencia_dias')::int, 0), null);
      if (p_dados->>'experiencia_dias') is null then v_erros := v_erros || 'Informe os dias do 1º período de experiência.'; end if;
    end if;
    v_fund := array['Mudança de categoria registrada como novo vínculo; o anterior fica no histórico'];
  elsif p_tipo = 'alteracao_salarial' then
    if (p_dados->>'salario') is null or (p_dados->>'salario')::numeric <= 0 then raise exception 'Informe o novo salário.'; end if;
    if p_vigencia > current_date then raise exception 'Registre o reajuste na data em que ele passa a valer (vigência futura ainda não é aplicada).'; end if;
    v_fund := array['CCT Foz 2026/2027, cl. 30, p. 7 (vedada redução salarial na mudança de função)'];
  else
    raise exception 'Tipo de transição inválido.';
  end if;

  if array_length(v_erros, 1) > 0 then raise exception '%', array_to_string(v_erros, ' '); end if;

  insert into rh_vinculo_transicoes (colaborador_id, unidade_id, vinculo_id, tipo, vigencia, dados, motivo, documento_ref, fundamentos)
  values (p_colaborador, v_v.unidade_id, v_v.id, p_tipo, p_vigencia, coalesce(p_dados, '{}'::jsonb), p_motivo, p_documento, v_fund)
  returning id into v_id;
  return v_id;
end $$;

create function public.rh_transicao_decidir(p_transicao uuid, p_aprovar boolean, p_observacao text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare t rh_vinculo_transicoes%rowtype; v rh_vinculos%rowtype; c colaboradores%rowtype; v_novo uuid; v_cat text; v_status text; v_tipo text; v_sal_ant numeric;
begin
  select * into t from rh_vinculo_transicoes where id = p_transicao for update;
  if t.id is null then raise exception 'Transição não encontrada.'; end if;
  if t.status <> 'solicitada' then raise exception 'Esta transição já foi decidida.'; end if;
  if not hefisto_user_can('dp.contratos.aprovar', t.unidade_id) then raise exception 'Sem permissão para aprovar alteração contratual.'; end if;
  select * into v from rh_vinculos where id = t.vinculo_id for update;
  if v.fim is not null then raise exception 'O vínculo desta solicitação já foi encerrado.'; end if;
  select * into c from colaboradores where id = t.colaborador_id for update;

  if not p_aprovar then
    update rh_vinculo_transicoes set status = 'recusada', decidido_por = auth.uid(), decidido_em = now(), observacao_decisao = p_observacao where id = t.id;
    return null;
  end if;

  if t.tipo = 'prorrogacao' then
    update rh_vinculos set prorrogacao_dias = (t.dados->>'dias')::int where id = v.id;
    insert into rh_historico (func_id, unidade_id, data, tipo_evento, valor_antigo, valor_novo, observacao)
    values (c.id, c.unidade_id, t.vigencia, 'contrato', format('Experiência %s dias', v.experiencia_dias),
      format('Experiência %s + %s dias (até %s)', v.experiencia_dias, t.dados->>'dias', to_char(v.inicio + v.experiencia_dias + (t.dados->>'dias')::int - 1, 'DD/MM/YYYY')),
      format('Prorrogação aprovada. %s [transição %s]', t.motivo, t.id));
  elsif t.tipo in ('efetivacao', 'mudanca_categoria') then
    v_cat := case when t.tipo = 'efetivacao' then 'clt_indeterminado' else t.dados->>'categoria' end;
    if t.vigencia <= v.inicio then raise exception 'A nova fase precisa começar depois do início do vínculo atual (%).', v.inicio; end if;
    update rh_vinculos set fim = t.vigencia - 1, motivo_fim = case when t.tipo = 'efetivacao' then 'efetivado (prazo indeterminado)' else 'mudança de categoria' end where id = v.id;
    insert into rh_vinculos (colaborador_id, unidade_id, categoria, regra_remuneracao, inicio, experiencia_dias, salario_base, vinculo_anterior_id, convencao_id)
    values (c.id, c.unidade_id, v_cat,
      case when v_cat in ('clt_experiencia','clt_indeterminado') then 'mensal' when v_cat = 'intermitente' then 'hora' else coalesce(t.dados->>'regra_remuneracao', v.regra_remuneracao) end,
      t.vigencia, case when v_cat = 'clt_experiencia' then (t.dados->>'experiencia_dias')::int end,
      coalesce((t.dados->>'salario')::numeric, v.salario_base), v.id,
      (select id from rh_convencoes where status = 'ativa' and unidades @> array[c.unidade_id] limit 1))
    returning id into v_novo;
    v_tipo := case when v_cat = 'eventual' then 'Freelancer' else 'Fixo' end;
    v_status := case v_cat when 'clt_indeterminado' then 'Definitivo' when 'clt_experiencia' then format('Experiência (%s dias)', t.dados->>'experiencia_dias') else 'Definitivo' end;
    update colaboradores set tipo_contrato = v_tipo, status_contrato = v_status,
      data_admissao = case when c.tipo_contrato = 'Freelancer' and v_tipo = 'Fixo' then t.vigencia else c.data_admissao end
    where id = c.id;
    insert into rh_historico (func_id, unidade_id, data, tipo_evento, valor_antigo, valor_novo, observacao)
    values (c.id, c.unidade_id, t.vigencia, 'contrato', coalesce(c.tipo_contrato, '') || ' / ' || coalesce(c.status_contrato, ''), v_tipo || ' / ' || v_status,
      format('%s aprovada. %s [transição %s]', case when t.tipo = 'efetivacao' then 'Efetivação' else 'Mudança de categoria' end, t.motivo, t.id));
  elsif t.tipo = 'alteracao_salarial' then
    v_sal_ant := c.salario;
    update colaboradores set salario = (t.dados->>'salario')::numeric where id = c.id;
    update rh_vinculos set salario_base = (t.dados->>'salario')::numeric where id = v.id;
    insert into rh_historico (func_id, unidade_id, data, tipo_evento, valor_antigo, valor_novo, observacao)
    values (c.id, c.unidade_id, t.vigencia, 'salario', coalesce(v_sal_ant::text, '—'), t.dados->>'salario', format('Alteração salarial aprovada. %s [transição %s]', t.motivo, t.id));
  end if;

  update rh_vinculo_transicoes set status = 'aprovada', decidido_por = auth.uid(), decidido_em = now(), observacao_decisao = p_observacao, novo_vinculo_id = v_novo where id = t.id;
  return coalesce(v_novo, v.id);
end $$;

revoke all on function public.rh_validar_experiencia(text, int, int) from public, anon;
revoke all on function public.rh_transicao_solicitar(uuid, text, date, jsonb, text, text) from public, anon;
revoke all on function public.rh_transicao_decidir(uuid, boolean, text) from public, anon;
grant execute on function public.rh_transicao_solicitar(uuid, text, date, jsonb, text, text) to authenticated;
grant execute on function public.rh_transicao_decidir(uuid, boolean, text) to authenticated;
grant execute on function public.rh_validar_experiencia(text, int, int) to authenticated;

-- 4. carga inicial: o retrato atual de cada colaborador vira o 1º vínculo
insert into public.rh_vinculos (colaborador_id, unidade_id, categoria, regra_remuneracao, inicio, inicio_estimado, experiencia_dias, fim, motivo_fim, salario_base, convencao_id)
select c.id, c.unidade_id,
  case when c.tipo_contrato = 'Freelancer' then 'eventual'
       when c.status_contrato ilike '%experi%' then 'clt_experiencia' else 'clt_indeterminado' end,
  case when c.tipo_contrato = 'Freelancer' then 'diaria' else 'mensal' end,
  coalesce(c.data_admissao, (select min(r.data_trabalho) from public.rh_recibos_prestacao r where r.colaborador_id = c.id), c.created_at::date),
  c.data_admissao is null,
  case when c.tipo_contrato <> 'Freelancer' and c.status_contrato ilike '%experi%'
       then coalesce(nullif(substring(c.status_contrato from '(\d+)'), '')::int, 45) end,
  case when coalesce(c.status, 'ativo') = 'inativo'
       then greatest(coalesce(c.data_desligamento, c.data_admissao, c.created_at::date),
                     coalesce(c.data_admissao, (select min(r.data_trabalho) from public.rh_recibos_prestacao r where r.colaborador_id = c.id), c.created_at::date)) end,
  case when coalesce(c.status, 'ativo') = 'inativo' then coalesce(c.tipo_desligamento, 'desligado') || case when c.data_desligamento is null then ' (data de saída não registrada)' else '' end end,
  nullif(c.salario, 0),
  (select id from public.rh_convencoes where status = 'ativa' and unidades @> array[c.unidade_id] limit 1)
from public.colaboradores c;

commit;

select categoria, count(*) filter (where fim is null) abertos, count(*) filter (where fim is not null) encerrados, count(*) filter (where inicio_estimado) inicio_estimado
from public.rh_vinculos group by categoria order by 1;
