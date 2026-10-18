/* ══════════════════════════════════════════════════════════════════════════════
   MIGRATION: HÉFISTO EXPERIENCE — HEXP-001 (FASE 1)
   Chamados de garçom, enriquecimento gastronômico e pedidos de mesa integrados
   ══════════════════════════════════════════════════════════════════════════════

   SEGURANÇA (corrigido em 18/10/2026; a versão de 27732ad abria a tabela)
   - Antes: experience_chamados com select e update "to authenticated using
     (true)": qualquer logado de qualquer empresa lia os chamados (nome do
     cliente, observação) e mudava o status dos chamados das outras.
   - Agora: uma policy sec_unidade (padrão SEC-RLS-1): a equipe vê e atualiza
     só os chamados das próprias unidades; o super admin vê todas. O navegador
     não cria nem apaga chamado (sem grant de insert/delete): quem cria é a rota
     pública da mesa, pelo servidor (service_role, que não passa pelo RLS; por
     isso a policy "to service_role using (true)" antiga era inútil e saiu).
     O anon não tem grant.
   - Estado em produção (18/10/2026, só leitura): experience_chamados NÃO
     existe, e as colunas novas de produtos/pedidos também não. TESTADO NO
     SUPABASE REAL. Nenhum dado foi exposto.
   - ATENÇÃO antes de aplicar: as rotas /api/public/experience/[unidade]/chamados
     (GET/PATCH) e /api/dashboard/experience/intelligence não pedem login e
     usam a service_role (S-30 e S-31 em docs/brain/02_ARQUITETURA/SEGURANCA.md).
     Com esta migração aplicada, elas passam a expor dados reais. Feche as
     rotas antes.

   COMO RODAR: só com aprovação do dono (escrita de esquema em produção).
   Inteiro, de uma vez. O preflight aborta SEM mudar nada se faltar a SEC-RLS-1,
   uma das tabelas usadas, ou se experience_chamados já existir com uma policy
   desconhecida. Idempotente. Testado no PGlite: app/lib/seguranca-rls.test.mjs.
*/

begin;
set local lock_timeout = '5s';

-- ── PREFLIGHT (aborta sem mudar nada) ───────────────────────────────────────
do $$
declare pol record;
begin
  if to_regprocedure('public.hefisto_ve_todas_unidades()') is null or to_regprocedure('public.hefisto_unidades_do_usuario()') is null then
    raise exception 'HEXP-001 preflight: falta a SEC-RLS-1 (hefisto_ve_todas_unidades / hefisto_unidades_do_usuario). Nada foi alterado.';
  end if;
  if to_regclass('public.unidades') is null or to_regclass('public.mesas') is null or to_regclass('public.produtos') is null or to_regclass('public.pedidos') is null then
    raise exception 'HEXP-001 preflight: falta public.unidades, mesas, produtos ou pedidos. Nada foi alterado.';
  end if;
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'experience_chamados' loop
    if pol.policyname not in ('sec_unidade', 'experience_chamados_select_autenticado', 'experience_chamados_update_autenticado', 'experience_chamados_service_role') then
      raise exception 'HEXP-001 preflight: policy desconhecida "%" em public.experience_chamados. Revise antes. Nada foi alterado.', pol.policyname;
    end if;
  end loop;
end $$;

-- 1. TABELA DE CHAMADOS DE GARÇOM / ATENDIMENTO DE MESA
create table if not exists public.experience_chamados (
  id                  uuid primary key default gen_random_uuid(),
  unidade_id          text not null references public.unidades(id),
  mesa_id             uuid references public.mesas(id) on delete set null,
  mesa_numero         text not null,
  tipo                text not null default 'garcom', -- 'garcom', 'agua', 'talheres', 'guardanapos', 'limpeza', 'conta', 'duvida'
  status              text not null default 'pendente', -- 'pendente', 'em_atendimento', 'concluido', 'cancelado'
  solicitante_nome    text,
  observacao          text,
  atendido_por        text,
  atendido_em         timestamptz,
  concluido_em        timestamptz,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Índices para consulta ultrarrápida do Salão e do Cliente
create index if not exists idx_experience_chamados_unidade_status
  on public.experience_chamados (unidade_id, status, created_at desc);

create index if not exists idx_experience_chamados_mesa_pendente
  on public.experience_chamados (mesa_id, status) where status in ('pendente', 'em_atendimento');

-- 2. ENRIQUECIMENTO GASTRONÔMICO ADITIVO EM PRODUTOS (PRESERVANDO DADOS EXISTENTES)
alter table public.produtos add column if not exists descricao               text;
alter table public.produtos add column if not exists tempo_preparo_min       integer;
alter table public.produtos add column if not exists harmonizacao            text;
alter table public.produtos add column if not exists alergenicos             text;
alter table public.produtos add column if not exists historia_gastronomica   text;
alter table public.produtos add column if not exists destaque_experience     boolean default false;

-- 3. RASTREIO DE EXPERIÊNCIA E IDEMPOTÊNCIA EM PEDIDOS
alter table public.pedidos add column if not exists origem_experience        boolean default false;
alter table public.pedidos add column if not exists chave_idempotencia       text;

-- 4. SEGURANÇA (RLS por unidade, padrão SEC-RLS-1)
alter table public.experience_chamados enable row level security;
revoke all on table public.experience_chamados from anon;
-- chamado nasce pela rota pública da mesa (servidor); a equipe só lê e atualiza
revoke insert, delete, truncate on table public.experience_chamados from authenticated;

-- versão antiga (27732ad), se chegou a rodar em algum banco
drop policy if exists experience_chamados_select_autenticado on public.experience_chamados;
drop policy if exists experience_chamados_update_autenticado on public.experience_chamados;
drop policy if exists experience_chamados_service_role on public.experience_chamados;

drop policy if exists sec_unidade on public.experience_chamados;
create policy sec_unidade on public.experience_chamados for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

-- ── VERIFICAÇÃO (aborta e desfaz tudo se algo não bateu) ────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.experience_chamados'::regclass) then
    raise exception 'HEXP-001 verificação: RLS desligado';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'experience_chamados') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'experience_chamados' and policyname = 'sec_unidade') then
    raise exception 'HEXP-001 verificação: esperada só a policy sec_unidade';
  end if;
  if has_table_privilege('anon', 'public.experience_chamados', 'select') or has_table_privilege('authenticated', 'public.experience_chamados', 'insert')
     or has_table_privilege('authenticated', 'public.experience_chamados', 'delete') then
    raise exception 'HEXP-001 verificação: anon lê, ou o navegador cria/apaga chamado';
  end if;
  if (select count(*) from information_schema.columns where table_schema = 'public'
       and ((table_name = 'produtos' and column_name in ('descricao','tempo_preparo_min','harmonizacao','alergenicos','historia_gastronomica','destaque_experience'))
         or (table_name = 'pedidos' and column_name in ('origem_experience','chave_idempotencia')))) <> 8 then
    raise exception 'HEXP-001 verificação: faltam colunas novas em produtos/pedidos';
  end if;
end $$;

commit;

/* ── CONFERÊNCIA (só leitura; rode depois) ─────────────────────────────────
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'experience_chamados';
select privilege_type, grantee from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'experience_chamados' and grantee in ('anon', 'authenticated') order by 2, 1;
   ─────────────────────────────────────────────────────────────────────────── */

/* ── ROLLBACK (só com o dono) ───────────────────────────────────────────────
   Tabela e colunas novas: o rollback apaga os chamados e o conteúdo das
   colunas (decisão do dono; exporte antes se houver dados):
     drop table if exists public.experience_chamados;
     alter table public.produtos drop column if exists descricao, drop column if exists tempo_preparo_min,
       drop column if exists harmonizacao, drop column if exists alergenicos,
       drop column if exists historia_gastronomica, drop column if exists destaque_experience;
     alter table public.pedidos drop column if exists origem_experience, drop column if exists chave_idempotencia;
   NÃO volte às policies abertas da versão antiga.
   ─────────────────────────────────────────────────────────────────────────── */
