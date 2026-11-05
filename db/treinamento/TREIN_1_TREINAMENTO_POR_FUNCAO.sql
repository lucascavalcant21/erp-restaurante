/* TREIN-1 · TREINAMENTO POR ÁREA E FUNÇÃO

   STATUS: APLICADA em 05/11/2026, com a aprovação APR-017
   (docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md).

   POR QUÊ: o dono quer formar cada funcionário novo por área e função, com
   conta própria, prova, situações reais e aprovação do líder na prática
   (04/11/2026). Hoje `treinamentos` tem 0 linhas e o "concluído" fica só no
   aparelho, sem registrar quem aprendeu.

   FAZ (uma transação, só aditiva):
     1. 12 tabelas trein_*: trilhas, módulos, aulas, questões, gabaritos,
        itens de prática, matrículas e registros de progresso;
     2. RLS por unidade em todas. Conteúdo sem aprovação só aparece para quem
        cuida do conteúdo; progresso só para a própria pessoa e para o líder;
     3. gabarito sem nenhum grant: a prova é corrigida aqui no banco, e o
        navegador nunca recebe a resposta certa antes de a pessoa passar;
     4. nenhuma escrita direta: tudo passa por funções que conferem permissão,
        unidade e dono da matrícula. Líder não aprova a si mesmo;
     5. permissões treinamento.*: "ver o meu treinamento" para todos os perfis
        menos Somente ponto e Contador; treinamento.* para Gerente geral;
        treinamento.team.* para Supervisor de cozinha.
   NÃO FAZ: não muda `treinamentos`, `cursos`, fichas nem nenhum dado existente.
   O conteúdo em rascunho entra em arquivo separado: TREIN_2_RASCUNHOS.sql.

   VERIFICAÇÃO: o select do fim deve devolver a impressão anotada em APR-017.
   Testada no PGlite: app/lib/trein-1.test.mjs.
   ROLLBACK: TREIN_1_ROLLBACK.sql (apaga o progresso; não rodar sem decisão do dono). */

begin;

do $$
begin
  if to_regprocedure('public.hefisto_user_can(text,text)') is null
    or to_regprocedure('public.hefisto_ve_todas_unidades()') is null
    or to_regprocedure('public.hefisto_unidades_do_usuario()') is null
    or to_regprocedure('public.hefisto_user_in_unit(uuid,text)') is null then
    raise exception 'TREIN-1: funções de acesso ausentes. Nada foi alterado.';
  end if;
  if to_regclass('public.usuarios_erp') is null or to_regclass('public.unidades') is null
    or to_regclass('public.fichas_tecnicas') is null or to_regclass('public.perfil_permissoes') is null then
    raise exception 'TREIN-1: tabela base ausente. Nada foi alterado.';
  end if;
  if to_regclass('public.trein_modulos') is not null then
    raise exception 'TREIN-1: já aplicada. Nada foi alterado.';
  end if;
end $$;

/* ── Conteúdo ─────────────────────────────────────────────────────────────── */

create table public.trein_trilhas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  chave text not null,
  area text not null check (area in ('cozinha','bar','salao','gestao')),
  nome text not null,
  descricao text not null default '',
  nivel smallint not null default 1,
  ordem integer not null default 0,
  cargos text[] not null default '{}',
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (unidade_id, chave)
);

create table public.trein_modulos (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  chave text not null,
  area text not null check (area in ('geral','cozinha','bar','salao','gestao')),
  titulo text not null,
  descricao text not null default '',
  ordem integer not null default 0,
  tipo text not null default 'aulas' check (tipo in ('aulas','pratos')),
  departamento text check (departamento in ('cozinha','bar')),
  etapa text check (etapa in ('conhecer','montar','preparar')),
  status text not null default 'rascunho' check (status in ('rascunho','aprovado')),
  aprovado_por uuid references public.usuarios_erp(id),
  aprovado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (unidade_id, chave),
  check (tipo = 'aulas' or (departamento is not null and etapa is not null))
);

create table public.trein_trilha_modulos (
  trilha_id uuid not null references public.trein_trilhas(id) on delete cascade,
  modulo_id uuid not null references public.trein_modulos(id) on delete cascade,
  unidade_id text not null references public.unidades(id),
  ordem integer not null default 0,
  primary key (trilha_id, modulo_id)
);

create table public.trein_aulas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  modulo_id uuid not null references public.trein_modulos(id) on delete cascade,
  chave text not null,
  ordem integer not null default 0,
  titulo text not null,
  conteudo text not null default '',
  video_url text,
  cenas jsonb check (cenas is null or jsonb_typeof(cenas) = 'array'),
  duracao_minutos integer not null default 5 check (duracao_minutos between 1 and 240),
  fontes text not null default '',
  atualizado_por uuid references public.usuarios_erp(id),
  updated_at timestamptz not null default now(),
  unique (unidade_id, chave)
);

create table public.trein_questoes (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  modulo_id uuid not null references public.trein_modulos(id) on delete cascade,
  aula_id uuid references public.trein_aulas(id) on delete set null,
  chave text not null,
  tipo text not null default 'prova' check (tipo in ('prova','situacao')),
  ordem integer not null default 0,
  enunciado text not null,
  opcoes jsonb not null check (jsonb_typeof(opcoes) = 'array' and jsonb_array_length(opcoes) between 2 and 6),
  unique (unidade_id, chave)
);

-- Sem policy e sem grant: só as funções abaixo leem.
create table public.trein_gabaritos (
  questao_id uuid primary key references public.trein_questoes(id) on delete cascade,
  unidade_id text not null references public.unidades(id),
  correta integer not null check (correta >= 0),
  explicacao text not null default ''
);

create table public.trein_pratica_itens (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  trilha_id uuid not null references public.trein_trilhas(id) on delete cascade,
  ordem integer not null default 0,
  texto text not null,
  unique (trilha_id, texto)
);

/* ── Progresso ────────────────────────────────────────────────────────────── */

create table public.trein_matriculas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  usuario_id uuid not null references public.usuarios_erp(id),
  trilha_id uuid not null references public.trein_trilhas(id),
  status text not null default 'em_andamento' check (status in ('em_andamento','aguardando_lider','aprovado','cancelado')),
  matriculado_por uuid references public.usuarios_erp(id),
  iniciado_em timestamptz not null default now(),
  aprovado_por uuid references public.usuarios_erp(id),
  aprovado_em timestamptz
);
create unique index trein_matricula_viva on public.trein_matriculas (usuario_id, trilha_id) where status <> 'cancelado';
create index trein_matriculas_unidade on public.trein_matriculas (unidade_id, status);

create table public.trein_aulas_concluidas (
  matricula_id uuid not null references public.trein_matriculas(id) on delete cascade,
  aula_id uuid not null references public.trein_aulas(id) on delete cascade,
  unidade_id text not null references public.unidades(id),
  concluido_em timestamptz not null default now(),
  primary key (matricula_id, aula_id)
);

create table public.trein_tentativas (
  id uuid primary key default gen_random_uuid(),
  unidade_id text not null references public.unidades(id),
  matricula_id uuid not null references public.trein_matriculas(id) on delete cascade,
  modulo_id uuid not null references public.trein_modulos(id) on delete cascade,
  acertos integer not null,
  total integer not null,
  aprovada boolean not null,
  respostas jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index trein_tentativas_matricula on public.trein_tentativas (matricula_id, modulo_id, criado_em desc);

create table public.trein_pratica_avaliacoes (
  matricula_id uuid not null references public.trein_matriculas(id) on delete cascade,
  item_id uuid not null references public.trein_pratica_itens(id) on delete cascade,
  unidade_id text not null references public.unidades(id),
  aprovado boolean not null,
  observacao text not null default '',
  avaliado_por uuid not null references public.usuarios_erp(id),
  avaliado_em timestamptz not null default now(),
  primary key (matricula_id, item_id)
);

create table public.trein_pratos_validados (
  matricula_id uuid not null references public.trein_matriculas(id) on delete cascade,
  ficha_id uuid not null references public.fichas_tecnicas(id) on delete cascade,
  etapa text not null check (etapa in ('conhecer','montar','preparar')),
  unidade_id text not null references public.unidades(id),
  validado_por uuid not null references public.usuarios_erp(id),
  validado_em timestamptz not null default now(),
  primary key (matricula_id, ficha_id, etapa)
);

/* ── Quem é quem ──────────────────────────────────────────────────────────── */

create function public.trein_meu_usuario()
returns uuid language sql stable security definer set search_path to 'public'
as $$ select u.id from public.usuarios_erp u where u.auth_user_id = auth.uid() and u.status = 'ativo' limit 1 $$;

create function public.trein_na_unidade(p_unidade_id text)
returns boolean language sql stable security definer set search_path to 'public'
as $$ select public.hefisto_ve_todas_unidades() or p_unidade_id = any(public.hefisto_unidades_do_usuario()) $$;

create function public.trein_exigir(p_permissao text, p_unidade_id text)
returns void language plpgsql stable security definer set search_path to 'public'
as $$
begin
  if not public.hefisto_user_can(p_permissao, p_unidade_id) then
    raise exception 'Você não tem permissão para esta ação.' using errcode = '42501';
  end if;
end $$;

/* ── RLS: só leitura direta; escrita apenas pelas funções ─────────────────── */

do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array['trein_trilhas','trein_modulos','trein_trilha_modulos','trein_aulas','trein_questoes',
    'trein_gabaritos','trein_pratica_itens','trein_matriculas','trein_aulas_concluidas','trein_tentativas',
    'trein_pratica_avaliacoes','trein_pratos_validados'] loop
    execute format('alter table public.%I enable row level security', v_tabela);
    execute format('revoke all on public.%I from public, anon, authenticated', v_tabela);
    if v_tabela <> 'trein_gabaritos' then
      execute format('grant select on public.%I to authenticated', v_tabela);
    end if;
  end loop;
end $$;

create policy sec_ler on public.trein_trilhas for select to authenticated using (public.trein_na_unidade(unidade_id));
create policy sec_ler on public.trein_trilha_modulos for select to authenticated using (public.trein_na_unidade(unidade_id));
create policy sec_ler on public.trein_pratica_itens for select to authenticated using (public.trein_na_unidade(unidade_id));
create policy sec_ler on public.trein_modulos for select to authenticated using (
  public.trein_na_unidade(unidade_id)
  and (status = 'aprovado' or public.hefisto_user_can('treinamento.content.view', unidade_id))
);
create policy sec_ler on public.trein_aulas for select to authenticated using (
  exists (select 1 from public.trein_modulos m where m.id = trein_aulas.modulo_id)
);
create policy sec_ler on public.trein_questoes for select to authenticated using (
  exists (select 1 from public.trein_modulos m where m.id = trein_questoes.modulo_id)
);
create policy sec_ler on public.trein_matriculas for select to authenticated using (
  usuario_id = public.trein_meu_usuario() or public.hefisto_user_can('treinamento.team.view', unidade_id)
);
create policy sec_ler on public.trein_aulas_concluidas for select to authenticated using (
  exists (select 1 from public.trein_matriculas m where m.id = trein_aulas_concluidas.matricula_id)
);
create policy sec_ler on public.trein_tentativas for select to authenticated using (
  exists (select 1 from public.trein_matriculas m where m.id = trein_tentativas.matricula_id)
);
create policy sec_ler on public.trein_pratica_avaliacoes for select to authenticated using (
  exists (select 1 from public.trein_matriculas m where m.id = trein_pratica_avaliacoes.matricula_id)
);
create policy sec_ler on public.trein_pratos_validados for select to authenticated using (
  exists (select 1 from public.trein_matriculas m where m.id = trein_pratos_validados.matricula_id)
);

/* ── Funcionário ──────────────────────────────────────────────────────────── */

-- Matrícula da própria pessoa, ainda em curso. A unidade vem da matrícula.
create function public.trein_minha_matricula(p_matricula uuid)
returns public.trein_matriculas language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas;
begin
  select * into v from public.trein_matriculas m
   where m.id = p_matricula and m.usuario_id = public.trein_meu_usuario() and m.status in ('em_andamento','aguardando_lider');
  if not found then
    raise exception 'Treinamento não encontrado.' using errcode = '42501';
  end if;
  if not public.trein_na_unidade(v.unidade_id) then
    raise exception 'Treinamento não encontrado.' using errcode = '42501';
  end if;
  return v;
end $$;

create function public.trein_concluir_aula(p_matricula uuid, p_aula uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas := public.trein_minha_matricula(p_matricula);
begin
  if not exists (
    select 1 from public.trein_aulas a
      join public.trein_modulos m on m.id = a.modulo_id and m.status = 'aprovado'
      join public.trein_trilha_modulos tm on tm.modulo_id = m.id and tm.trilha_id = v.trilha_id
     where a.id = p_aula
  ) then
    raise exception 'Esta aula não faz parte do seu treinamento.' using errcode = '42501';
  end if;
  insert into public.trein_aulas_concluidas (matricula_id, aula_id, unidade_id)
  values (v.id, p_aula, v.unidade_id) on conflict do nothing;
end $$;

-- Interna: sem grant para authenticated.
create function public.trein_atualizar_status(p_matricula uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas;
  v_faltam integer;
  v_total integer;
begin
  select * into v from public.trein_matriculas where id = p_matricula;
  if v.status not in ('em_andamento','aguardando_lider') then return; end if;
  select count(*), count(*) filter (where not exists (
           select 1 from public.trein_tentativas t where t.matricula_id = v.id and t.modulo_id = m.id and t.aprovada))
    into v_total, v_faltam
    from public.trein_trilha_modulos tm
    join public.trein_modulos m on m.id = tm.modulo_id and m.tipo = 'aulas' and m.status = 'aprovado'
   where tm.trilha_id = v.trilha_id;
  update public.trein_matriculas
     set status = case when v_total > 0 and v_faltam = 0 then 'aguardando_lider' else 'em_andamento' end
   where id = v.id;
end $$;

-- Prova corrigida aqui, por SQL. Reprovou: volta só quantas acertou e o que rever.
create function public.trein_corrigir_prova(p_matricula uuid, p_modulo uuid, p_respostas jsonb)
returns jsonb language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas := public.trein_minha_matricula(p_matricula);
  v_total integer;
  v_acertos integer;
  v_aprovada boolean;
  v_recentes integer;
begin
  if jsonb_typeof(p_respostas) is distinct from 'object' then
    raise exception 'Respostas inválidas.';
  end if;
  if not exists (
    select 1 from public.trein_trilha_modulos tm
      join public.trein_modulos m on m.id = tm.modulo_id and m.status = 'aprovado' and m.tipo = 'aulas'
     where tm.trilha_id = v.trilha_id and tm.modulo_id = p_modulo
  ) then
    raise exception 'Esta prova não faz parte do seu treinamento.' using errcode = '42501';
  end if;
  if exists (select 1 from public.trein_tentativas t where t.matricula_id = v.id and t.modulo_id = p_modulo and t.aprovada) then
    raise exception 'Você já foi aprovado nesta prova.';
  end if;
  if exists (
    select 1 from public.trein_aulas a
     where a.modulo_id = p_modulo
       and not exists (select 1 from public.trein_aulas_concluidas c where c.matricula_id = v.id and c.aula_id = a.id)
  ) then
    raise exception 'Conclua todas as aulas antes da prova.';
  end if;
  select count(*) into v_recentes from public.trein_tentativas t
   where t.matricula_id = v.id and t.modulo_id = p_modulo and not t.aprovada and t.criado_em > now() - interval '1 hour';
  if v_recentes >= 3 then
    raise exception 'Revise as aulas e tente de novo daqui a 1 hora.';
  end if;

  select count(*), count(*) filter (where p_respostas ->> q.id::text = g.correta::text)
    into v_total, v_acertos
    from public.trein_questoes q join public.trein_gabaritos g on g.questao_id = q.id
   where q.modulo_id = p_modulo;
  if v_total = 0 then
    raise exception 'Esta prova ainda não tem questões.';
  end if;

  v_aprovada := v_acertos * 100 >= v_total * 80;
  insert into public.trein_tentativas (unidade_id, matricula_id, modulo_id, acertos, total, aprovada, respostas)
  values (v.unidade_id, v.id, p_modulo, v_acertos, v_total, v_aprovada, p_respostas);
  perform public.trein_atualizar_status(v.id);

  if v_aprovada then
    return jsonb_build_object('aprovada', true, 'acertos', v_acertos, 'total', v_total, 'correcao', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'questao_id', q.id, 'acertou', p_respostas ->> q.id::text = g.correta::text,
               'correta', g.correta, 'explicacao', g.explicacao) order by q.ordem), '[]'::jsonb)
        from public.trein_questoes q join public.trein_gabaritos g on g.questao_id = q.id
       where q.modulo_id = p_modulo));
  end if;
  return jsonb_build_object('aprovada', false, 'acertos', v_acertos, 'total', v_total, 'rever', (
    select coalesce(jsonb_agg(distinct a.titulo), '[]'::jsonb)
      from public.trein_questoes q
      join public.trein_gabaritos g on g.questao_id = q.id
      join public.trein_aulas a on a.id = q.aula_id
     where q.modulo_id = p_modulo and (p_respostas ->> q.id::text) is distinct from g.correta::text));
end $$;

/* ── Líder ────────────────────────────────────────────────────────────────── */

-- A unidade vem da trilha, e a pessoa precisa pertencer a ela.
create function public.trein_matricular(p_usuario uuid, p_trilha uuid)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_trilha public.trein_trilhas;
  v_auth uuid;
  v_id uuid;
begin
  select * into v_trilha from public.trein_trilhas where id = p_trilha and ativa;
  if not found then raise exception 'Trilha não encontrada.'; end if;
  perform public.trein_exigir('treinamento.team.create', v_trilha.unidade_id);
  select auth_user_id into v_auth from public.usuarios_erp where id = p_usuario and status = 'ativo';
  if v_auth is null or not public.hefisto_user_in_unit(v_auth, v_trilha.unidade_id) then
    raise exception 'Esta pessoa não pertence à unidade.';
  end if;
  insert into public.trein_matriculas (unidade_id, usuario_id, trilha_id, matriculado_por)
  values (v_trilha.unidade_id, p_usuario, p_trilha, public.trein_meu_usuario())
  on conflict (usuario_id, trilha_id) where status <> 'cancelado' do nothing
  returning id into v_id;
  if v_id is null then raise exception 'Esta pessoa já está nesta trilha.'; end if;
  return v_id;
end $$;

create function public.trein_cancelar_matricula(p_matricula uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas;
begin
  select * into v from public.trein_matriculas where id = p_matricula;
  if not found then raise exception 'Matrícula não encontrada.'; end if;
  perform public.trein_exigir('treinamento.team.cancel', v.unidade_id);
  update public.trein_matriculas set status = 'cancelado' where id = v.id and status <> 'aprovado';
end $$;

-- Matrícula para avaliar: o líder não avalia a si mesmo.
create function public.trein_matricula_para_avaliar(p_matricula uuid)
returns public.trein_matriculas language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas;
begin
  select * into v from public.trein_matriculas where id = p_matricula and status in ('em_andamento','aguardando_lider');
  if not found then raise exception 'Matrícula não encontrada.'; end if;
  perform public.trein_exigir('treinamento.team.approve', v.unidade_id);
  if v.usuario_id = public.trein_meu_usuario() then
    raise exception 'Outra pessoa precisa fazer esta avaliação.' using errcode = '42501';
  end if;
  return v;
end $$;

create function public.trein_avaliar_pratica(p_matricula uuid, p_item uuid, p_aprovado boolean, p_observacao text default '')
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas := public.trein_matricula_para_avaliar(p_matricula);
begin
  if not exists (select 1 from public.trein_pratica_itens i where i.id = p_item and i.trilha_id = v.trilha_id) then
    raise exception 'Este item não faz parte da trilha.';
  end if;
  insert into public.trein_pratica_avaliacoes (matricula_id, item_id, unidade_id, aprovado, observacao, avaliado_por)
  values (v.id, p_item, v.unidade_id, p_aprovado, left(coalesce(p_observacao, ''), 500), public.trein_meu_usuario())
  on conflict (matricula_id, item_id) do update
    set aprovado = excluded.aprovado, observacao = excluded.observacao,
        avaliado_por = excluded.avaliado_por, avaliado_em = now();
end $$;

create function public.trein_validar_prato(p_matricula uuid, p_ficha uuid, p_etapa text, p_validado boolean)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas := public.trein_matricula_para_avaliar(p_matricula);
begin
  if p_etapa not in ('conhecer','montar','preparar') then raise exception 'Etapa inválida.'; end if;
  if not exists (select 1 from public.fichas_tecnicas f where f.id = p_ficha and f.unidade_id = v.unidade_id) then
    raise exception 'Prato não encontrado nesta unidade.';
  end if;
  if p_validado then
    insert into public.trein_pratos_validados (matricula_id, ficha_id, etapa, unidade_id, validado_por)
    values (v.id, p_ficha, p_etapa, v.unidade_id, public.trein_meu_usuario()) on conflict do nothing;
  else
    delete from public.trein_pratos_validados where matricula_id = v.id and ficha_id = p_ficha and etapa = p_etapa;
  end if;
end $$;

-- Aprovação final: todas as provas e todos os itens de prática.
create function public.trein_concluir_trilha(p_matricula uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_matriculas := public.trein_matricula_para_avaliar(p_matricula);
  v_provas integer;
  v_provas_faltando integer;
  v_pratica_faltando integer;
begin
  select count(*), count(*) filter (where not exists (
           select 1 from public.trein_tentativas t where t.matricula_id = v.id and t.modulo_id = m.id and t.aprovada))
    into v_provas, v_provas_faltando
    from public.trein_trilha_modulos tm
    join public.trein_modulos m on m.id = tm.modulo_id and m.tipo = 'aulas'
   where tm.trilha_id = v.trilha_id;
  select count(*) into v_pratica_faltando
    from public.trein_pratica_itens i
   where i.trilha_id = v.trilha_id
     and not exists (select 1 from public.trein_pratica_avaliacoes a where a.matricula_id = v.id and a.item_id = i.id and a.aprovado);
  if v_provas = 0 then raise exception 'Esta trilha ainda não tem provas.'; end if;
  if v_provas_faltando > 0 then raise exception 'Faltam % prova(s) para concluir.', v_provas_faltando; end if;
  if v_pratica_faltando > 0 then raise exception 'Faltam % item(ns) da prática para concluir.', v_pratica_faltando; end if;
  update public.trein_matriculas
     set status = 'aprovado', aprovado_por = public.trein_meu_usuario(), aprovado_em = now()
   where id = v.id;
end $$;

-- Painel do líder. A permissão é conferida na unidade pedida.
create function public.trein_equipe(p_unidade_id text)
returns jsonb language plpgsql stable security definer set search_path to 'public'
as $$
begin
  perform public.trein_exigir('treinamento.team.view', p_unidade_id);
  return jsonb_build_object(
    'pessoas', (
      select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'cargo', u.cargo) order by u.nome), '[]'::jsonb)
        from public.usuarios_erp u
       where u.status = 'ativo' and u.auth_user_id is not null and public.hefisto_user_in_unit(u.auth_user_id, p_unidade_id)),
    'matriculas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', m.id, 'usuario_id', m.usuario_id, 'nome', u.nome, 'trilha_id', m.trilha_id, 'trilha', t.nome,
               'area', t.area, 'status', m.status, 'iniciado_em', m.iniciado_em, 'aprovado_em', m.aprovado_em,
               'provas_total', (select count(*) from public.trein_trilha_modulos tm
                                  join public.trein_modulos md on md.id = tm.modulo_id and md.tipo = 'aulas' and md.status = 'aprovado'
                                 where tm.trilha_id = m.trilha_id),
               'provas_feitas', (select count(distinct x.modulo_id) from public.trein_tentativas x where x.matricula_id = m.id and x.aprovada),
               'pratica_total', (select count(*) from public.trein_pratica_itens i where i.trilha_id = m.trilha_id),
               'pratica_feita', (select count(*) from public.trein_pratica_avaliacoes a where a.matricula_id = m.id and a.aprovado)
             ) order by m.iniciado_em desc), '[]'::jsonb)
        from public.trein_matriculas m
        join public.usuarios_erp u on u.id = m.usuario_id
        join public.trein_trilhas t on t.id = m.trilha_id
       where m.unidade_id = p_unidade_id and m.status <> 'cancelado'));
end $$;

/* ── Conteúdo: revisão e aprovação ────────────────────────────────────────── */

create function public.trein_gabarito_do_modulo(p_modulo uuid)
returns table (questao_id uuid, correta integer, explicacao text)
language plpgsql stable security definer set search_path to 'public'
as $$
declare
  v_unidade text;
begin
  select unidade_id into v_unidade from public.trein_modulos where id = p_modulo;
  if v_unidade is null then raise exception 'Módulo não encontrado.'; end if;
  perform public.trein_exigir('treinamento.content.view', v_unidade);
  return query
    select g.questao_id, g.correta, g.explicacao
      from public.trein_gabaritos g join public.trein_questoes q on q.id = g.questao_id
     where q.modulo_id = p_modulo;
end $$;

create function public.trein_salvar_aula(p_aula uuid, p_titulo text, p_conteudo text, p_video_url text, p_duracao integer)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_unidade text;
begin
  select unidade_id into v_unidade from public.trein_aulas where id = p_aula;
  if v_unidade is null then raise exception 'Aula não encontrada.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v_unidade);
  if btrim(coalesce(p_titulo, '')) = '' or btrim(coalesce(p_conteudo, '')) = '' then
    raise exception 'Preencha o título e o conteúdo.';
  end if;
  if nullif(btrim(coalesce(p_video_url, '')), '') is not null and p_video_url !~ '^https://' then
    raise exception 'O vídeo precisa de um link https.';
  end if;
  -- Texto novo invalida as falas antigas: o boneco nunca diz outra coisa.
  update public.trein_aulas
     set titulo = btrim(p_titulo), conteudo = p_conteudo, video_url = nullif(btrim(coalesce(p_video_url, '')), ''),
         cenas = case when conteudo = p_conteudo then cenas end,
         duracao_minutos = greatest(1, least(240, coalesce(p_duracao, 5))),
         atualizado_por = public.trein_meu_usuario(), updated_at = now()
   where id = p_aula;
end $$;

create function public.trein_salvar_questao(p_questao uuid, p_enunciado text, p_opcoes jsonb, p_correta integer, p_explicacao text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_unidade text;
begin
  select unidade_id into v_unidade from public.trein_questoes where id = p_questao;
  if v_unidade is null then raise exception 'Questão não encontrada.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v_unidade);
  if btrim(coalesce(p_enunciado, '')) = '' or jsonb_typeof(p_opcoes) is distinct from 'array'
    or jsonb_array_length(p_opcoes) not between 2 and 6
    or p_correta is null or p_correta < 0 or p_correta >= jsonb_array_length(p_opcoes) then
    raise exception 'Confira a pergunta, as opções e a resposta certa.';
  end if;
  update public.trein_questoes set enunciado = btrim(p_enunciado), opcoes = p_opcoes where id = p_questao;
  update public.trein_gabaritos set correta = p_correta, explicacao = coalesce(p_explicacao, '') where questao_id = p_questao;
end $$;

-- Falas do boneco, escritas à mão ou sugeridas pela IA e revisadas aqui.
create function public.trein_salvar_cenas(p_aula uuid, p_cenas jsonb)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_unidade text;
begin
  select unidade_id into v_unidade from public.trein_aulas where id = p_aula;
  if v_unidade is null then raise exception 'Aula não encontrada.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v_unidade);
  if p_cenas is not null and (jsonb_typeof(p_cenas) <> 'array' or jsonb_array_length(p_cenas) > 60) then
    raise exception 'Falas inválidas.';
  end if;
  update public.trein_aulas set cenas = p_cenas, atualizado_por = public.trein_meu_usuario(), updated_at = now() where id = p_aula;
end $$;

-- Criar conteúdo novo. Tudo nasce como rascunho. A unidade é conferida na permissão.
create function public.trein_criar_modulo(p_unidade_id text, p_area text, p_titulo text, p_descricao text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  perform public.trein_exigir('treinamento.content.edit', p_unidade_id);
  if btrim(coalesce(p_titulo, '')) = '' then raise exception 'Dê um nome ao módulo.'; end if;
  insert into public.trein_modulos (unidade_id, chave, area, titulo, descricao, ordem)
  values (p_unidade_id, 'novo-' || gen_random_uuid(), p_area, btrim(p_titulo), coalesce(p_descricao, ''),
          (select coalesce(max(ordem), 0) + 10 from public.trein_modulos where unidade_id = p_unidade_id))
  returning id into v_id;
  return v_id;
end $$;

create function public.trein_salvar_modulo(p_modulo uuid, p_titulo text, p_descricao text)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_unidade text;
begin
  select unidade_id into v_unidade from public.trein_modulos where id = p_modulo;
  if v_unidade is null then raise exception 'Módulo não encontrado.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v_unidade);
  if btrim(coalesce(p_titulo, '')) = '' then raise exception 'Dê um nome ao módulo.'; end if;
  update public.trein_modulos set titulo = btrim(p_titulo), descricao = coalesce(p_descricao, '') where id = p_modulo;
end $$;

create function public.trein_criar_aula(p_modulo uuid, p_titulo text, p_conteudo text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_modulos;
  v_id uuid;
begin
  select * into v from public.trein_modulos where id = p_modulo and tipo = 'aulas';
  if not found then raise exception 'Módulo não encontrado.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v.unidade_id);
  if btrim(coalesce(p_titulo, '')) = '' or btrim(coalesce(p_conteudo, '')) = '' then
    raise exception 'Preencha o título e o conteúdo.';
  end if;
  insert into public.trein_aulas (unidade_id, modulo_id, chave, ordem, titulo, conteudo, atualizado_por)
  values (v.unidade_id, v.id, 'novo-' || gen_random_uuid(),
          (select coalesce(max(ordem), 0) + 1 from public.trein_aulas where modulo_id = v.id),
          btrim(p_titulo), p_conteudo, public.trein_meu_usuario())
  returning id into v_id;
  return v_id;
end $$;

create function public.trein_criar_questao(p_aula uuid, p_tipo text, p_enunciado text, p_opcoes jsonb, p_correta integer, p_explicacao text)
returns uuid language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_aulas;
  v_id uuid;
begin
  select * into v from public.trein_aulas where id = p_aula;
  if not found then raise exception 'Aula não encontrada.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v.unidade_id);
  if p_tipo not in ('prova','situacao') or btrim(coalesce(p_enunciado, '')) = ''
    or jsonb_typeof(p_opcoes) is distinct from 'array' or jsonb_array_length(p_opcoes) not between 2 and 6
    or p_correta is null or p_correta < 0 or p_correta >= jsonb_array_length(p_opcoes) then
    raise exception 'Confira a pergunta, as opções e a resposta certa.';
  end if;
  insert into public.trein_questoes (unidade_id, modulo_id, aula_id, chave, tipo, ordem, enunciado, opcoes)
  values (v.unidade_id, v.modulo_id, v.id, 'novo-' || gen_random_uuid(), p_tipo,
          (select coalesce(max(ordem), 0) + 1 from public.trein_questoes where aula_id = v.id), btrim(p_enunciado), p_opcoes)
  returning id into v_id;
  insert into public.trein_gabaritos (questao_id, unidade_id, correta, explicacao)
  values (v_id, v.unidade_id, p_correta, coalesce(p_explicacao, ''));
  return v_id;
end $$;

-- Remover só em rascunho: módulo aprovado pode ter progresso de alguém.
create function public.trein_remover_aula(p_aula uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_unidade text;
  v_status text;
begin
  select a.unidade_id, m.status into v_unidade, v_status
    from public.trein_aulas a join public.trein_modulos m on m.id = a.modulo_id where a.id = p_aula;
  if v_unidade is null then raise exception 'Aula não encontrada.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v_unidade);
  if v_status <> 'rascunho' then raise exception 'Volte o módulo para rascunho antes de remover.'; end if;
  delete from public.trein_questoes where aula_id = p_aula;
  delete from public.trein_aulas where id = p_aula;
end $$;

create function public.trein_remover_questao(p_questao uuid)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_unidade text;
  v_status text;
begin
  select q.unidade_id, m.status into v_unidade, v_status
    from public.trein_questoes q join public.trein_modulos m on m.id = q.modulo_id where q.id = p_questao;
  if v_unidade is null then raise exception 'Questão não encontrada.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v_unidade);
  if v_status <> 'rascunho' then raise exception 'Volte o módulo para rascunho antes de remover.'; end if;
  delete from public.trein_questoes where id = p_questao;
end $$;

-- Colocar ou tirar um módulo de uma trilha. Módulo e trilha precisam ser da mesma unidade.
create function public.trein_ligar_modulo(p_modulo uuid, p_trilha uuid, p_ligar boolean)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_unidade text;
begin
  select m.unidade_id into v_unidade
    from public.trein_modulos m join public.trein_trilhas t on t.id = p_trilha and t.unidade_id = m.unidade_id
   where m.id = p_modulo;
  if v_unidade is null then raise exception 'Módulo ou trilha não encontrados.'; end if;
  perform public.trein_exigir('treinamento.content.edit', v_unidade);
  if p_ligar then
    insert into public.trein_trilha_modulos (trilha_id, modulo_id, unidade_id, ordem)
    values (p_trilha, p_modulo, v_unidade, (select coalesce(max(ordem), 0) + 1 from public.trein_trilha_modulos where trilha_id = p_trilha))
    on conflict do nothing;
  else
    delete from public.trein_trilha_modulos where trilha_id = p_trilha and modulo_id = p_modulo;
  end if;
end $$;

-- Aula com [PREENCHER ...] não vai para a equipe.
create function public.trein_aprovar_modulo(p_modulo uuid, p_aprovar boolean)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v public.trein_modulos;
begin
  select * into v from public.trein_modulos where id = p_modulo;
  if not found then raise exception 'Módulo não encontrado.'; end if;
  perform public.trein_exigir('treinamento.content.approve', v.unidade_id);
  if p_aprovar then
    if exists (select 1 from public.trein_aulas a where a.modulo_id = v.id and a.conteudo like '%[PREENCHER%') then
      raise exception 'Preencha os trechos marcados com [PREENCHER] antes de aprovar.';
    end if;
    if v.tipo = 'aulas' and (
      not exists (select 1 from public.trein_aulas a where a.modulo_id = v.id)
      or (select count(*) from public.trein_questoes q where q.modulo_id = v.id) < 3
    ) then
      raise exception 'O módulo precisa de aulas e de pelo menos 3 questões.';
    end if;
    update public.trein_modulos set status = 'aprovado', aprovado_por = public.trein_meu_usuario(), aprovado_em = now() where id = v.id;
  else
    update public.trein_modulos set status = 'rascunho', aprovado_por = null, aprovado_em = null where id = v.id;
  end if;
end $$;

/* ── Carga do conteúdo: só o dono do banco executa (TREIN_2) ──────────────── */

create function public.trein_importar_pacote(p_unidade_id text, p_pacote jsonb)
returns void language plpgsql security definer set search_path to 'public'
as $$
declare
  v_m jsonb;
  v_a jsonb;
  v_q jsonb;
  v_t jsonb;
  v_modulo uuid;
  v_aula uuid;
  v_trilha uuid;
  v_questao uuid;
  v_ordem integer;
begin
  for v_m in select * from jsonb_array_elements(p_pacote -> 'modulos') loop
    insert into public.trein_modulos (unidade_id, chave, area, titulo, descricao, ordem, tipo, departamento, etapa, status)
    values (p_unidade_id, v_m ->> 'chave', v_m ->> 'area', v_m ->> 'titulo', coalesce(v_m ->> 'descricao', ''),
            coalesce((v_m ->> 'ordem')::integer, 0), coalesce(v_m ->> 'tipo', 'aulas'), v_m ->> 'departamento', v_m ->> 'etapa',
            case when v_m ->> 'tipo' = 'pratos' then 'aprovado' else 'rascunho' end)
    on conflict (unidade_id, chave) do nothing
    returning id into v_modulo;
    continue when v_modulo is null;  -- já existe: edição do dono nunca é sobrescrita.
    v_ordem := 0;
    for v_a in select * from jsonb_array_elements(coalesce(v_m -> 'aulas', '[]'::jsonb)) loop
      v_ordem := v_ordem + 1;
      insert into public.trein_aulas (unidade_id, modulo_id, chave, ordem, titulo, conteudo, duracao_minutos, fontes)
      values (p_unidade_id, v_modulo, v_a ->> 'chave', v_ordem, v_a ->> 'titulo', v_a ->> 'conteudo',
              coalesce((v_a ->> 'duracao_minutos')::integer, 5), coalesce(v_a ->> 'fontes', ''))
      returning id into v_aula;
      for v_q in select * from jsonb_array_elements(coalesce(v_a -> 'questoes', '[]'::jsonb)) loop
        insert into public.trein_questoes (unidade_id, modulo_id, aula_id, chave, tipo, ordem, enunciado, opcoes)
        values (p_unidade_id, v_modulo, v_aula, v_q ->> 'chave', coalesce(v_q ->> 'tipo', 'prova'),
                coalesce((v_q ->> 'ordem')::integer, 0), v_q ->> 'enunciado', v_q -> 'opcoes')
        returning id into v_questao;
        insert into public.trein_gabaritos (questao_id, unidade_id, correta, explicacao)
        values (v_questao, p_unidade_id, (v_q ->> 'correta')::integer, coalesce(v_q ->> 'explicacao', ''));
      end loop;
    end loop;
  end loop;

  for v_t in select * from jsonb_array_elements(p_pacote -> 'trilhas') loop
    insert into public.trein_trilhas (unidade_id, chave, area, nome, descricao, nivel, ordem, cargos)
    values (p_unidade_id, v_t ->> 'chave', v_t ->> 'area', v_t ->> 'nome', coalesce(v_t ->> 'descricao', ''),
            coalesce((v_t ->> 'nivel')::smallint, 1), coalesce((v_t ->> 'ordem')::integer, 0),
            array(select jsonb_array_elements_text(coalesce(v_t -> 'cargos', '[]'::jsonb))))
    on conflict (unidade_id, chave) do nothing
    returning id into v_trilha;
    continue when v_trilha is null;
    insert into public.trein_trilha_modulos (trilha_id, modulo_id, unidade_id, ordem)
    select v_trilha, m.id, p_unidade_id, x.ordem::integer
      from jsonb_array_elements_text(v_t -> 'modulos') with ordinality as x(chave, ordem)
      join public.trein_modulos m on m.unidade_id = p_unidade_id and m.chave = x.chave;
    insert into public.trein_pratica_itens (unidade_id, trilha_id, ordem, texto)
    select p_unidade_id, v_trilha, x.ordem::integer, x.texto
      from jsonb_array_elements_text(coalesce(v_t -> 'pratica', '[]'::jsonb)) with ordinality as x(texto, ordem);
  end loop;
end $$;

/* ── Grants das funções ───────────────────────────────────────────────────── */

do $$
declare
  v_fn regprocedure;
begin
  for v_fn in
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'trein\_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', v_fn);
  end loop;
end $$;

grant execute on function public.trein_meu_usuario() to authenticated;
grant execute on function public.trein_na_unidade(text) to authenticated;
grant execute on function public.trein_concluir_aula(uuid, uuid) to authenticated;
grant execute on function public.trein_corrigir_prova(uuid, uuid, jsonb) to authenticated;
grant execute on function public.trein_matricular(uuid, uuid) to authenticated;
grant execute on function public.trein_cancelar_matricula(uuid) to authenticated;
grant execute on function public.trein_avaliar_pratica(uuid, uuid, boolean, text) to authenticated;
grant execute on function public.trein_validar_prato(uuid, uuid, text, boolean) to authenticated;
grant execute on function public.trein_concluir_trilha(uuid) to authenticated;
grant execute on function public.trein_equipe(text) to authenticated;
grant execute on function public.trein_gabarito_do_modulo(uuid) to authenticated;
grant execute on function public.trein_salvar_aula(uuid, text, text, text, integer) to authenticated;
grant execute on function public.trein_salvar_questao(uuid, text, jsonb, integer, text) to authenticated;
grant execute on function public.trein_aprovar_modulo(uuid, boolean) to authenticated;
grant execute on function public.trein_salvar_cenas(uuid, jsonb) to authenticated;
grant execute on function public.trein_criar_modulo(text, text, text, text) to authenticated;
grant execute on function public.trein_salvar_modulo(uuid, text, text) to authenticated;
grant execute on function public.trein_criar_aula(uuid, text, text) to authenticated;
grant execute on function public.trein_criar_questao(uuid, text, text, jsonb, integer, text) to authenticated;
grant execute on function public.trein_remover_aula(uuid) to authenticated;
grant execute on function public.trein_remover_questao(uuid) to authenticated;
grant execute on function public.trein_ligar_modulo(uuid, uuid, boolean) to authenticated;

/* ── Permissões ───────────────────────────────────────────────────────────── */

insert into public.perfil_permissoes (perfil_id, permission_key)
select p.id, 'treinamento.my.view' from public.perfis_acesso p
 where p.is_current and p.codigo not in ('somente-ponto', 'contador')
   and not exists (select 1 from public.perfil_permissoes x where x.perfil_id = p.id and x.permission_key = 'treinamento.my.view');
insert into public.perfil_permissoes (perfil_id, permission_key)
select p.id, c.chave from public.perfis_acesso p
  join (values ('gerente-geral', 'treinamento.*'), ('supervisor-cozinha', 'treinamento.team.*'), ('conta-chefe-bar', 'treinamento.team.*')) as c(codigo, chave)
    on c.codigo = p.codigo
 where p.is_current
   and not exists (select 1 from public.perfil_permissoes x where x.perfil_id = p.id and x.permission_key = c.chave);

commit;

/* Impressão digital. */
select md5(
  (select string_agg(tablename || ':' || policyname || ':' || cmd, ',' order by tablename, policyname) from pg_policies where schemaname = 'public' and tablename like 'trein\_%')
  || '|' ||
  (select string_agg(p.oid::regprocedure::text, ',' order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname like 'trein\_%')
) as impressao_digital;
