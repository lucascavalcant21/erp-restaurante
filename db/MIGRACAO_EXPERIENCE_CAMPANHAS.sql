/* ══════════════════════════════════════════════════════════════════════════════
   MIGRATION: HÉFISTO EXPERIENCE — CAMPANHAS INTELIGENTES DE VENDAS (IA)
   Experience > Campanhas IA
   ══════════════════════════════════════════════════════════════════════════════

   SEGURANÇA (corrigido em 18/10/2026; a versão de ff18b9e abria a tabela)
   - Antes: "select using (true)" para public (anon incluso) e "for all to
     authenticated using (true)": qualquer pessoa lia, e qualquer logado de
     qualquer empresa criava, pausava e apagava campanhas das outras.
   - Agora: uma policy sec_unidade (padrão SEC-RLS-1): o usuário vê e grava só
     as próprias unidades; o super admin vê todas. O anon não tem grant.
     O cardápio público lê as campanhas pelo servidor (service_role), que não
     passa pelo RLS: nada muda para o cliente na mesa.
   - Estado em produção (18/10/2026, só leitura): a tabela NÃO existe.
     TESTADO NO SUPABASE REAL. Nenhum dado foi exposto.

   COMO RODAR: só com aprovação do dono (escrita de esquema em produção).
   Inteiro, de uma vez. O preflight aborta SEM mudar nada se faltar a SEC-RLS-1
   (funções de acesso), a tabela produtos/unidades, ou se a tabela já existir
   com uma policy desconhecida. Idempotente: reaplicar só reconfere.
   Testado no PGlite: app/lib/seguranca-rls.test.mjs (bloco Experience).
*/

begin;
set local lock_timeout = '5s';

-- ── PREFLIGHT (aborta sem mudar nada) ───────────────────────────────────────
do $$
declare pol record;
begin
  if to_regprocedure('public.hefisto_ve_todas_unidades()') is null or to_regprocedure('public.hefisto_unidades_do_usuario()') is null then
    raise exception 'EXPERIENCE-CAMPANHAS preflight: falta a SEC-RLS-1 (hefisto_ve_todas_unidades / hefisto_unidades_do_usuario). Nada foi alterado.';
  end if;
  if to_regclass('public.unidades') is null or to_regclass('public.produtos') is null then
    raise exception 'EXPERIENCE-CAMPANHAS preflight: falta public.unidades ou public.produtos. Nada foi alterado.';
  end if;
  -- tabela já criada (versão antiga ou outra pessoa): só troca policy que reconhece
  for pol in select policyname from pg_policies where schemaname = 'public' and tablename = 'experience_campanhas' loop
    if pol.policyname not in ('sec_unidade', 'experience_campanhas_select_all', 'experience_campanhas_all_auth') then
      raise exception 'EXPERIENCE-CAMPANHAS preflight: policy desconhecida "%" em public.experience_campanhas. Revise antes. Nada foi alterado.', pol.policyname;
    end if;
  end loop;
end $$;

-- ── TABELA ───────────────────────────────────────────────────────────────────
create table if not exists public.experience_campanhas (
  id                  uuid primary key default gen_random_uuid(),
  unidade_id          text not null references public.unidades(id),
  produto_id          uuid references public.produtos(id) on delete cascade,
  produto_nome        text not null,
  foto_url            text,
  mensagem_ia         text not null,
  local_exibicao      text not null default 'abertura', -- 'abertura', 'escolha', 'finalizacao'
  prioridade          text not null default 'media',    -- 'baixa', 'media', 'alta'
  frequencia          text not null default 'moderada',
  publico_alvo        text not null default 'todos',
  dias_semana         text[] default array['0','1','2','3','4','5','6'],
  hora_inicio         time default '11:00',
  hora_fim            time default '23:59',
  data_inicio         date default current_date,
  data_fim            date,
  objetivo            text default 'aumentar_ticket',
  status              text not null default 'ativa', -- 'ativa', 'pausada', 'encerrada'
  visualizacoes       integer default 0,
  cliques             integer default 0,
  adicoes_carrinho    integer default 0,
  compras_efetivas    integer default 0,
  receita_gerada      numeric(12,2) default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create index if not exists idx_experience_campanhas_unidade_status
  on public.experience_campanhas (unidade_id, status, local_exibicao);

-- ── SEGURANÇA (RLS por unidade, padrão SEC-RLS-1) ───────────────────────────
alter table public.experience_campanhas enable row level security;
revoke all on table public.experience_campanhas from anon;

-- versão antiga (ff18b9e), se chegou a rodar em algum banco
drop policy if exists experience_campanhas_select_all on public.experience_campanhas;
drop policy if exists experience_campanhas_all_auth on public.experience_campanhas;

drop policy if exists sec_unidade on public.experience_campanhas;
create policy sec_unidade on public.experience_campanhas for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));

-- ── VERIFICAÇÃO (aborta e desfaz tudo se algo não bateu) ────────────────────
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.experience_campanhas'::regclass) then
    raise exception 'EXPERIENCE-CAMPANHAS verificação: RLS desligado';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public' and tablename = 'experience_campanhas') <> 1
     or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'experience_campanhas' and policyname = 'sec_unidade') then
    raise exception 'EXPERIENCE-CAMPANHAS verificação: esperada só a policy sec_unidade';
  end if;
  if has_table_privilege('anon', 'public.experience_campanhas', 'select') then
    raise exception 'EXPERIENCE-CAMPANHAS verificação: anon lê a tabela';
  end if;
end $$;

commit;

/* ── CONFERÊNCIA (só leitura; rode depois) ─────────────────────────────────
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'experience_campanhas';
-- impressão digital: igual à das tabelas da SEC-RLS-1
select md5(qual || ':' || with_check) from pg_policies where schemaname = 'public' and tablename = 'experience_campanhas' and policyname = 'sec_unidade';
   ─────────────────────────────────────────────────────────────────────────── */

/* ── ROLLBACK (só com o dono) ───────────────────────────────────────────────
   Tabela nova: o rollback é apagar a tabela, e isso apaga as campanhas criadas
   (decisão do dono; exporte antes se houver dados):
     drop table if exists public.experience_campanhas;
   NÃO volte às policies abertas da versão antiga.
   ─────────────────────────────────────────────────────────────────────────── */
