-- ══════════════════════════════════════════════════════════════════════════════
-- MIGRATION: HÉFISTO EXPERIENCE — CAMPANHAS INTELIGENTES DE VENDAS (IA)
-- Experience > Campanhas IA
-- ══════════════════════════════════════════════════════════════════════════════

create table if not exists experience_campanhas (
  id                  uuid primary key default gen_random_uuid(),
  unidade_id          text not null,
  produto_id          uuid references produtos(id) on delete cascade,
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
  on experience_campanhas (unidade_id, status, local_exibicao);

alter table experience_campanhas enable row level security;

-- NUNCA APLICADA (a tabela não existe no banco real, conferido em 18/10/2026).
-- Antes: leitura aberta a qualquer um (até sem login) e escrita para
-- qualquer usuário logado de qualquer empresa. Agora: isolamento por
-- unidade da SEC-RLS-1. O cardápio público lê pelo servidor.
drop policy if exists "experience_campanhas_select_all" on experience_campanhas;
drop policy if exists "experience_campanhas_all_auth" on experience_campanhas;
drop policy if exists sec_unidade on experience_campanhas;
create policy sec_unidade on experience_campanhas for all to authenticated
  using ((select public.hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(public.hefisto_unidades_do_usuario())))
  with check ((select public.hefisto_ve_todas_unidades()) or unidade_id::text in (select unnest(public.hefisto_unidades_do_usuario())));
