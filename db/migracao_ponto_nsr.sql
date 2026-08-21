-- ─────────────────────────────────────────────────────────────────────────────
-- LIVRO DE MARCAÇÕES COM NSR (ponto_marcacao) — layout REP-P
--
-- Por que existe: o ponto guardava UMA linha por dia e sobrescrevia os quatro
-- horários nela. Apagar uma batida não deixava buraco e alterar não deixava
-- rastro — o oposto do que a Portaria MTP 671/2021 exige.
--
-- Esta tabela é o Armazenamento de Registro de Ponto (ARP) do Anexo IX: uma
-- linha por marcação, NSR sequencial que nunca reinicia e encadeamento por
-- SHA-256 sobre o registro anterior. Os campos e o cálculo do hash seguem o
-- registro tipo "7" do Anexo V, para que o AFD saia direto daqui sem recalcular
-- nada — recalcular na exportação é o que tornava o NSR inútil.
--
-- registro_ponto CONTINUA existindo e é o que as telas leem: virou o resumo do
-- dia, derivado daqui. Trocar tudo de uma vez pararia o ponto da casa.
--
-- Correção de batida não apaga nada: entra uma marcação do tipo 'ajuste' com o
-- valor anterior, o autor e o motivo.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
--
-- ATENÇÃO se você já rodou a versão anterior deste arquivo E já tem marcações
-- gravadas: o cálculo do hash mudou para o do Anexo V, então a conferência vai
-- acusar as linhas antigas. Me avise que eu trato — a tabela é imutável de
-- propósito e não dá para reescrever as linhas.
-- ─────────────────────────────────────────────────────────────────────────────

create sequence if not exists public.ponto_nsr_seq as bigint start 1;

create table if not exists public.ponto_marcacao (
  id             uuid primary key default gen_random_uuid(),
  nsr            bigint not null default nextval('public.ponto_nsr_seq'),
  unidade_id     text not null,
  colaborador_id uuid not null,

  -- entrada | saida_intervalo | retorno_intervalo | saida_trabalho | ajuste
  tipo           text not null,

  -- Hora REAL da marcação. A tolerância da CLT não muda este valor: ela entra
  -- no cálculo, nunca no registro. O art. 74, II proíbe expressamente marcação
  -- com horário predeterminado ou contratual.
  marcado_em     timestamptz not null,
  -- Quando o servidor gravou. Campo 5 do registro tipo 7 e entra no hash: é a
  -- diferença entre os dois que denuncia marcação inserida depois.
  gravado_em     timestamptz not null default now(),
  data_referencia date not null,

  -- CPF fica gravado aqui, e não só em colaboradores: o AFD tem que refletir o
  -- CPF de quando a marcação aconteceu, e esta linha é imutável.
  cpf            text,

  -- Campo 6 do registro tipo 7: 01 mobile, 02 browser, 03 desktop,
  -- 04 dispositivo eletrônico, 05 outro. O tablet é navegador.
  coletor        text not null default '02',
  -- Campo 7: '0' marcação on-line, '1' off-line enviada depois.
  online         text not null default '0',

  origem         text not null default 'tablet',

  -- Só em 'ajuste': o que havia antes, quem mudou e por quê.
  valor_anterior timestamptz,
  tipo_alvo      text,
  registrado_por text,
  motivo         text,

  latitude       numeric,
  longitude      numeric,

  hash_anterior  text,
  hash           text,

  criado_em      timestamptz not null default now()
);

-- Colunas novas para quem rodou a versão anterior deste arquivo.
alter table public.ponto_marcacao add column if not exists gravado_em timestamptz not null default now();
alter table public.ponto_marcacao add column if not exists cpf     text;
alter table public.ponto_marcacao add column if not exists coletor text not null default '02';
alter table public.ponto_marcacao add column if not exists online  text not null default '0';

create unique index if not exists idx_ponto_marcacao_nsr on public.ponto_marcacao (nsr);
create index if not exists idx_ponto_marcacao_colab on public.ponto_marcacao (colaborador_id, data_referencia);
create index if not exists idx_ponto_marcacao_unidade on public.ponto_marcacao (unidade_id, data_referencia);


-- ── Data e hora no formato do Anexo V ───────────────────────────────────────
-- "AAAA-MM-ddThh:mm:00ZZZZZ", ex.: 2026-08-21T15:40:00-0300. O to_char devolve
-- o fuso como "-03"; o layout quer quatro dígitos.
create or replace function public.ponto_dh(p timestamptz)
returns text
language plpgsql
stable
set timezone = 'America/Sao_Paulo'
as $$
declare
  v_ofs text;
begin
  v_ofs := to_char(p, 'OF');
  if length(v_ofs) = 3 then
    v_ofs := v_ofs || '00';
  else
    v_ofs := replace(v_ofs, ':', '');
  end if;
  return to_char(p, 'YYYY-MM-DD"T"HH24:MI:"00"') || v_ofs;
end;
$$;


-- ── Hash encadeado (Anexo V, registro tipo 7) ──────────────────────────────
-- Entram, nesta ordem: NSR, tipo do registro, data/hora da marcação, CPF,
-- data/hora da gravação, identificador do coletor, on-line/off-line e o hash do
-- registro anterior. Os campos vão no mesmo tamanho em que serão gravados no
-- AFD — hash calculado sobre outra formatação não confere na verificação.
create or replace function public.ponto_marcacao_conteudo(
  p_nsr bigint, p_marcado_em timestamptz, p_cpf text,
  p_gravado_em timestamptz, p_coletor text, p_online text, p_anterior text)
returns text
language sql
stable
as $$
  select lpad(p_nsr::text, 9, '0')
      || '7'
      || public.ponto_dh(p_marcado_em)
      || lpad(regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g'), 12, '0')
      || public.ponto_dh(p_gravado_em)
      || lpad(coalesce(p_coletor, '02'), 2, '0')
      || coalesce(p_online, '0')
      || coalesce(p_anterior, '');
$$;

create or replace function public.ponto_marcacao_encadear()
returns trigger
language plpgsql
as $$
declare
  v_anterior text;
begin
  -- Serializa as inserções: sem o lock, duas batidas simultâneas leriam o mesmo
  -- hash anterior e a corrente nasceria bifurcada.
  perform pg_advisory_xact_lock(hashtext('ponto_marcacao'));

  if new.cpf is null then
    select regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') into new.cpf
      from public.colaboradores c where c.id = new.colaborador_id;
  end if;

  select m.hash into v_anterior
    from public.ponto_marcacao m
   order by m.nsr desc
   limit 1;

  new.hash_anterior := v_anterior;
  new.hash := encode(sha256(convert_to(
    public.ponto_marcacao_conteudo(
      new.nsr, new.marcado_em, new.cpf, new.gravado_em,
      new.coletor, new.online, v_anterior),
    'utf8')), 'hex');
  return new;
end;
$$;

drop trigger if exists trg_ponto_marcacao_encadear on public.ponto_marcacao;
create trigger trg_ponto_marcacao_encadear
  before insert on public.ponto_marcacao
  for each row execute function public.ponto_marcacao_encadear();


-- ── Imutabilidade ───────────────────────────────────────────────────────────
-- Anexo IX, item 7: os dados do ARP não podem ser apagados nem alterados,
-- direta ou indiretamente. Corrigir é inserir um 'ajuste'.
create or replace function public.ponto_marcacao_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Marcação de ponto não pode ser alterada nem apagada (NSR %). Registre um ajuste.',
    coalesce(old.nsr, -1);
end;
$$;

drop trigger if exists trg_ponto_marcacao_imutavel on public.ponto_marcacao;
create trigger trg_ponto_marcacao_imutavel
  before update or delete on public.ponto_marcacao
  for each row execute function public.ponto_marcacao_imutavel();


-- ── Conferência da corrente ─────────────────────────────────────────────────
-- Recalcula tudo e devolve as linhas onde o hash não fecha. Corrente íntegra
-- devolve zero linhas. Rode antes de entregar qualquer arquivo à fiscalização.
create or replace function public.ponto_marcacao_conferir()
returns table (nsr bigint, problema text)
language plpgsql
as $$
declare
  r record;
  v_anterior text := null;
  v_calc text;
begin
  for r in select * from public.ponto_marcacao order by nsr loop
    v_calc := encode(sha256(convert_to(
      public.ponto_marcacao_conteudo(
        r.nsr, r.marcado_em, r.cpf, r.gravado_em, r.coletor, r.online, v_anterior),
      'utf8')), 'hex');

    if r.hash is distinct from v_calc then
      nsr := r.nsr;
      problema := 'hash não confere — linha alterada ou anterior removida';
      return next;
    end if;

    v_anterior := r.hash;
  end loop;
end;
$$;


alter table public.ponto_marcacao enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='ponto_marcacao' and policyname='ponto_marcacao_ler') then
    create policy ponto_marcacao_ler on public.ponto_marcacao for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public'
                   and tablename='ponto_marcacao' and policyname='ponto_marcacao_inserir') then
    create policy ponto_marcacao_inserir on public.ponto_marcacao for insert with check (true);
  end if;
end $$;

-- Sem policy de update/delete: mesmo que alguém remova os gatilhos, a RLS
-- continua barrando pelo cliente.

notify pgrst, 'reload schema';


-- ─────────────────────────────────────────────────────────────────────────────
-- HORA DO SERVIDOR NA MARCAÇÃO (Anexo IX, itens 2 e 8.2)
--
-- O REP-P precisa obter a data e a hora "de forma confiável", sincronizadas com
-- a Hora Legal Brasileira com variação máxima de 30 segundos. O relógio do
-- tablet não serve: ele é ajustável por quem usa, e uma marcação com hora do
-- próprio aparelho não prova nada.
--
-- Com o default, o servidor carimba a hora e o cliente nem participa disso.
-- Importação e ajuste continuam podendo informar a hora, que é justamente o
-- caso em que ela NÃO é a de agora.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.ponto_marcacao alter column marcado_em set default now();

notify pgrst, 'reload schema';
