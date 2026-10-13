/* ═══════════════════════════════════════════════════════════════════════════
   RH-3 · CONVENÇÕES COLETIVAS, CONFIGURAÇÃO TRABALHISTA/CONTÁBIL E
          PERMISSÕES DE DEPARTAMENTO PESSOAL (HDEV-RH-001)

   STATUS: PROPOSTA. Rodar só com aprovação do dono.

   Pedido do dono (13/10/2026):
   1. Configurações da empresa: regime tributário, anexo, dados contábeis.
   2. Módulo de convenções coletivas: arquivo, vigência, cláusulas,
      parâmetros, exceções e histórico de alterações (versionado).
   3. Permissões separadas: proprietário, gerente, RH e contador, com
      aprovação de desligamentos e alterações contratuais.
   4. Cálculos parametrizáveis sem aplicar percentual desconhecido: a CCT só
      vale depois de revisada e ATIVADA (app/lib/trabalhista/regras-competencia.mjs).

   FAZ (uma transação; só cria; nenhuma linha existente é alterada):
     1. rh_config_trabalhista (1 por unidade/CNPJ): anexo do Simples, RAT/FAP,
        terceiros, contador, validação. O regime já existe em
        unidades.regime_tributario e não é duplicado.
     2. rh_convencoes (versionada: codigo + versao; substitui_id) com status
        rascunho → pendente_revisao → ativa → encerrada/revogada
     3. rh_convencao_clausulas (número, página, resumo, parâmetros, exceções,
        status de implementação, revisão do contador)
     4. rh_convencao_historico: trilha imutável (gatilho grava antes/depois)
     5. permissões dp.* (fora de rh.*, para o curinga rh.* do gerente e do RH
        não incluir aprovação) e o perfil "Contador":
          proprietário (administrador-geral, '*'): tudo, inclusive aprovar
          gerente-geral:   dp.contratos.solicitar, dp.desligamentos.solicitar
          recursos-humanos: dp.contratos.solicitar, dp.desligamentos.solicitar,
                            dp.convencoes.gerenciar, dp.config.ver
          contador (novo): dp.convencoes.revisar, dp.calculos.validar,
                           dp.config.ver, dp.config.editar, rh.payroll.view,
                           rh.employees.view
          APROVAR (dp.contratos.aprovar, dp.desligamentos.aprovar,
          dp.convencoes.ativar): só o proprietário até o dono decidir outra
          coisa — dá para conceder depois a um perfil ou usuário.
   NÃO FAZ: não cadastra a CCT (isso é feito pelo app, com o PDF, depois de
   aprovado), não ativa regra nenhuma, não muda folha.

   ROLLBACK (não rodar sem decisão do dono):
     drop table if exists public.rh_convencao_historico, public.rh_convencao_clausulas,
       public.rh_convencoes, public.rh_config_trabalhista cascade;
     drop function if exists public.rh_convencao_registrar_historico();
     delete from public.perfil_permissoes where permission_key like 'dp.%';
     delete from public.perfis_acesso where codigo = 'contador' and not exists
       (select 1 from public.usuarios_erp u where u.perfil_id = perfis_acesso.id);
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.rh_convencoes') is not null then
    raise exception 'RH-3: rh_convencoes já existe. Nada foi alterado.';
  end if;
  if not exists (select 1 from public.perfis_acesso where codigo = 'administrador-geral') then
    raise exception 'RH-3: perfil administrador-geral não encontrado. Nada foi alterado.';
  end if;
end $$;

-- 1. configuração trabalhista/contábil por unidade (CNPJ)
create table public.rh_config_trabalhista (
  unidade_id text primary key references public.unidades(id),
  anexo_simples text check (anexo_simples in ('I','II','III','IV','V')),
  rat_pct numeric check (rat_pct is null or rat_pct between 0 and 3),
  fap numeric check (fap is null or fap between 0.5 and 2),
  terceiros_pct numeric check (terceiros_pct is null or terceiros_pct between 0 and 10),
  contador_nome text, contador_crc text, contador_email text, contador_telefone text, escritorio_contabil text,
  observacoes text,
  validado_pelo_contador_em timestamptz, validado_pelo_contador_por uuid,
  atualizado_por uuid default auth.uid(), atualizado_em timestamptz not null default now()
);
comment on table public.rh_config_trabalhista is 'Dados contábeis/trabalhistas por unidade (CNPJ). Regime: unidades.regime_tributario. RH-3.';
alter table public.rh_config_trabalhista enable row level security;
create policy rh_config_ler on public.rh_config_trabalhista for select to authenticated
  using (public.hefisto_user_can('dp.config.ver', unidade_id) or public.hefisto_user_can('dp.config.editar', unidade_id));
create policy rh_config_gravar on public.rh_config_trabalhista for all to authenticated
  using (public.hefisto_user_can('dp.config.editar', unidade_id)) with check (public.hefisto_user_can('dp.config.editar', unidade_id));

-- 2. convenções (versionadas)
create table public.rh_convencoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas(id),
  unidades text[] not null default '{}',
  codigo text not null,
  versao int not null default 1 check (versao > 0),
  substitui_id uuid references public.rh_convencoes(id),
  nome text not null,
  sindicato_laboral text, sindicato_patronal text,
  vigencia_inicio date not null, vigencia_fim date not null check (vigencia_fim >= vigencia_inicio),
  data_assinatura date, registro_mte text,
  arquivo_ref text, arquivo_sha256 text, arquivo_paginas int,
  parametros jsonb not null default '{}'::jsonb,
  status text not null default 'pendente_revisao'
    check (status in ('rascunho','pendente_revisao','ativa','encerrada','revogada')),
  revisada_por uuid, revisada_em timestamptz,
  ativada_por uuid, ativada_em timestamptz,
  criado_por uuid default auth.uid(), created_at timestamptz not null default now(),
  unique (codigo, versao),
  check (status <> 'ativa' or (revisada_em is not null and ativada_em is not null))
);
create unique index rh_convencoes_uma_ativa_por_codigo on public.rh_convencoes (codigo) where status = 'ativa';
comment on table public.rh_convencoes is 'Convenções/acordos coletivos versionados. Só status ativa (revisada + ativada) muda cálculo. RH-3.';
alter table public.rh_convencoes enable row level security;
-- leitura: quem gerencia, revisa ou vê a folha de alguma unidade da convenção
create policy rh_convencoes_ler on public.rh_convencoes for select to authenticated using (
  exists (select 1 from unnest(unidades) u where public.hefisto_user_can('dp.convencoes.gerenciar', u)
       or public.hefisto_user_can('dp.convencoes.revisar', u) or public.hefisto_user_can('rh.payroll.view', u)));
create policy rh_convencoes_incluir on public.rh_convencoes for insert to authenticated with check (
  status in ('rascunho','pendente_revisao') and ativada_em is null
  and exists (select 1 from unnest(unidades) u where public.hefisto_user_can('dp.convencoes.gerenciar', u)));
-- alterar: gerenciar (rascunho/pendente), revisar (marca revisão), ativar (só quem tem dp.convencoes.ativar)
create policy rh_convencoes_alterar on public.rh_convencoes for update to authenticated
  using (exists (select 1 from unnest(unidades) u where public.hefisto_user_can('dp.convencoes.gerenciar', u)
       or public.hefisto_user_can('dp.convencoes.revisar', u) or public.hefisto_user_can('dp.convencoes.ativar', u)))
  with check (
    (status <> 'ativa' or exists (select 1 from unnest(unidades) u where public.hefisto_user_can('dp.convencoes.ativar', u))));
-- sem DELETE: convenção não se apaga; revoga-se

create table public.rh_convencao_clausulas (
  id uuid primary key default gen_random_uuid(),
  convencao_id uuid not null references public.rh_convencoes(id) on delete restrict,
  numero int not null check (numero > 0),
  titulo text not null,
  pagina text not null,
  resumo text,
  parametros jsonb not null default '{}'::jsonb,
  excecoes text,
  status_implementacao text not null
    check (status_implementacao in ('implementada','parametrizacao','juridica','informativa','nao_se_aplica')),
  exige_revisao boolean not null default false,
  revisao_status text not null default 'pendente' check (revisao_status in ('pendente','aprovada','rejeitada')),
  revisado_por uuid, revisado_em timestamptz, observacao_revisao text,
  unique (convencao_id, numero)
);
alter table public.rh_convencao_clausulas enable row level security;
create policy rh_clausulas_ler on public.rh_convencao_clausulas for select to authenticated
  using (exists (select 1 from public.rh_convencoes c where c.id = convencao_id));  -- herda a leitura da convenção (RLS acima)
create policy rh_clausulas_gravar on public.rh_convencao_clausulas for all to authenticated
  using (exists (select 1 from public.rh_convencoes c, unnest(c.unidades) u where c.id = convencao_id
         and (public.hefisto_user_can('dp.convencoes.gerenciar', u) or public.hefisto_user_can('dp.convencoes.revisar', u))))
  with check (exists (select 1 from public.rh_convencoes c, unnest(c.unidades) u where c.id = convencao_id
         and (public.hefisto_user_can('dp.convencoes.gerenciar', u) or public.hefisto_user_can('dp.convencoes.revisar', u))));

-- 4. histórico imutável
create table public.rh_convencao_historico (
  id bigint generated always as identity primary key,
  convencao_id uuid not null,
  tabela text not null,
  registro_id uuid not null,
  evento text not null,
  antes jsonb, depois jsonb,
  ator uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table public.rh_convencao_historico enable row level security;
create policy rh_conv_hist_ler on public.rh_convencao_historico for select to authenticated
  using (exists (select 1 from public.rh_convencoes c where c.id = convencao_id));
-- sem INSERT/UPDATE/DELETE para usuários: só o gatilho grava

create function public.rh_convencao_registrar_historico() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.rh_convencao_historico (convencao_id, tabela, registro_id, evento, antes, depois)
  values (
    (case when tg_table_name = 'rh_convencoes' then v->>'id' else v->>'convencao_id' end)::uuid,
    tg_table_name, (v->>'id')::uuid, lower(tg_op),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end);
  return null; -- gatilho AFTER: o retorno é ignorado
end $$;
revoke all on function public.rh_convencao_registrar_historico() from public, anon, authenticated;
create trigger rh_convencoes_historico after insert or update or delete on public.rh_convencoes
  for each row execute function public.rh_convencao_registrar_historico();
create trigger rh_convencao_clausulas_historico after insert or update or delete on public.rh_convencao_clausulas
  for each row execute function public.rh_convencao_registrar_historico();

-- 5. permissões dp.* e perfil Contador
insert into public.perfis_acesso (nome, codigo, descricao, tipo, sistema)
select 'Contador', 'contador', 'Revisa convenções e valida cálculos trabalhistas; vê folha e cadastro, sem editar colaboradores.', 'consulta', true
where not exists (select 1 from public.perfis_acesso where codigo = 'contador');

insert into public.perfil_permissoes (perfil_id, permission_key)
select p.id, k from public.perfis_acesso p
cross join lateral (values
  ('gerente-geral', 'dp.contratos.solicitar'), ('gerente-geral', 'dp.desligamentos.solicitar'),
  ('recursos-humanos', 'dp.contratos.solicitar'), ('recursos-humanos', 'dp.desligamentos.solicitar'),
  ('recursos-humanos', 'dp.convencoes.gerenciar'), ('recursos-humanos', 'dp.config.ver'),
  ('contador', 'dp.convencoes.revisar'), ('contador', 'dp.calculos.validar'), ('contador', 'dp.config.ver'),
  ('contador', 'dp.config.editar'), ('contador', 'rh.payroll.view'), ('contador', 'rh.employees.view')
) v(codigo, k)
where p.codigo = v.codigo and p.is_current
on conflict do nothing;

commit;

select 'tabelas' k, count(*)::text v from pg_tables where schemaname = 'public'
  and tablename in ('rh_config_trabalhista','rh_convencoes','rh_convencao_clausulas','rh_convencao_historico')
union all select 'permissões dp.*', count(*)::text from public.perfil_permissoes where permission_key like 'dp.%'
union all select 'perfil contador', count(*)::text from public.perfis_acesso where codigo = 'contador';
