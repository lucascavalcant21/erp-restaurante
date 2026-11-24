/* ═══════════════════════════════════════════════════════════════════════════
   RH-FICHA-1 · FICHA DO FUNCIONÁRIO: ADVERTÊNCIAS, OCORRÊNCIAS, QUEBRAS,
   UNIFORMES, REUNIÕES, OBSERVAÇÕES E DOCUMENTOS ASSINADOS

   STATUS: ESCRITA, NÃO APLICADA. É do SISTEMA DE TESTE (branch hefisto-teste):
   o banco do restaurante não recebe. Aplicar no banco de teste depois que a
   estrutura for copiada para ele (ACESSO-008).

   PEDIDO DO DONO (14/11/2026): cada funcionário com tudo anexado — contrato,
   documentos, reuniões que participou e assinou, advertências verbais e por
   escrito, recorrências, observações do dia, ocorrências, quebras de produto,
   uniformes entregues (data e quantidade) e a cópia do documento assinado.

   FAZ (uma transação; só aditiva):
     1. rh_registros_colab: um livro por funcionário. Cada linha é um registro
        (advertência verbal/escrita, suspensão, ocorrência, observação, quebra,
        uniforme, reunião, documento, elogio), com a cópia assinada no bucket
        privado rh-docs (o caminho é gravado pelo servidor; a URL é assinada na
        hora de abrir).
     2. A unidade vem do cadastro do funcionário (gatilho), nunca do corpo da
        requisição: mandar outra unidade não muda nada.
     3. Registro é documento: NÃO se apaga (sem grant de delete). Errou? Anula,
        com motivo; a linha continua. Depois de criado, só mudam a assinatura,
        o anexo, as testemunhas, a devolução do uniforme e a anulação.
     4. RLS por permissão de RH na unidade (hefisto_user_can): ver exige
        rh.employees.view; criar e completar exigem rh.employees.create ou
        rh.employees.edit. Tablet de setor (sem RH) não lê nada.
   NÃO FAZ: não mexe em rh_advertencias_colab (as antigas aparecem na ficha só
   para leitura), não desconta nada em folha (quebra é só registro: desconto
   depende de acordo ou dolo, art. 462 da CLT, e é decisão do dono).

   VERIFICAÇÃO: o select do fim devolve a impressão digital das colunas:
   13996d29be16a222dc78a9a7738a39f2 (conferida no PGlite por
   app/lib/ficha-funcionario-banco.test.mjs, 18 casos).

   ROLLBACK (não rodar sem decisão do dono; apaga os registros):
     drop table if exists public.rh_registros_colab;
     drop function if exists public.rh_registros_colab_antes();
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.colaboradores') is null then
    raise exception 'RH-FICHA-1: tabela colaboradores não existe. Nada foi alterado.';
  end if;
  if to_regprocedure('public.hefisto_user_can(text, text)') is null then
    raise exception 'RH-FICHA-1: falta hefisto_user_can(text, text). Nada foi alterado.';
  end if;
  if to_regclass('public.rh_registros_colab') is not null then
    raise exception 'RH-FICHA-1: rh_registros_colab já existe. Nada foi alterado.';
  end if;
end $$;

create table public.rh_registros_colab (
  id               uuid primary key default gen_random_uuid(),
  unidade_id       text not null,
  colaborador_id   uuid not null references public.colaboradores(id),
  tipo             text not null check (tipo in (
                     'advertencia_verbal', 'advertencia_escrita', 'suspensao',
                     'ocorrencia', 'observacao', 'quebra', 'uniforme',
                     'reuniao', 'documento', 'elogio')),
  data             date not null default current_date,
  titulo           text not null check (length(btrim(titulo)) between 2 and 160),
  descricao        text check (descricao is null or length(descricao) <= 4000),
  gravidade        text check (gravidade is null or gravidade in ('leve', 'media', 'grave')),
  -- quebra e uniforme
  item             text check (item is null or length(item) <= 160),
  quantidade       numeric check (quantidade is null or quantidade > 0),
  tamanho          text check (tamanho is null or length(tamanho) <= 20),
  valor_centavos   bigint check (valor_centavos is null or valor_centavos >= 0),
  devolvido_em     date,
  -- assinatura
  assinado         boolean not null default false,
  assinado_em      timestamptz,
  recusou_assinar  boolean not null default false,
  testemunhas      text check (testemunhas is null or length(testemunhas) <= 300),
  arquivo_url      text,
  -- autoria e anulação
  registrado_por   text,
  criado_por       uuid default auth.uid(),
  anulado_em       timestamptz,
  anulado_motivo   text,
  created_at       timestamptz not null default now(),
  constraint rh_registros_colab_anulacao check (anulado_em is null or length(btrim(coalesce(anulado_motivo, ''))) >= 3),
  constraint rh_registros_colab_recusa check (not recusou_assinar or length(btrim(coalesce(testemunhas, ''))) >= 3)
);

create index rh_registros_colab_colab on public.rh_registros_colab (colaborador_id, data desc);
create index rh_registros_colab_unidade on public.rh_registros_colab (unidade_id, tipo, data desc);

create function public.rh_registros_colab_antes()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_unidade text;
begin
  if tg_op = 'INSERT' then
    -- tenant do banco: a unidade é a do funcionário, não a que veio no corpo
    select unidade_id into v_unidade from public.colaboradores where id = new.colaborador_id;
    if v_unidade is null then
      raise exception 'Funcionário sem unidade: não dá para registrar.';
    end if;
    new.unidade_id := v_unidade;
    new.criado_por := auth.uid();
    new.created_at := now();
    new.anulado_em := null;
    new.anulado_motivo := null;
    if new.assinado and new.assinado_em is null then new.assinado_em := now(); end if;
    return new;
  end if;

  -- UPDATE: o conteúdo do registro não muda; só o que completa o documento
  if new.unidade_id is distinct from old.unidade_id
     or new.colaborador_id is distinct from old.colaborador_id
     or new.tipo is distinct from old.tipo
     or new.data is distinct from old.data
     or new.titulo is distinct from old.titulo
     or new.descricao is distinct from old.descricao
     or new.gravidade is distinct from old.gravidade
     or new.item is distinct from old.item
     or new.quantidade is distinct from old.quantidade
     or new.tamanho is distinct from old.tamanho
     or new.valor_centavos is distinct from old.valor_centavos
     or new.registrado_por is distinct from old.registrado_por
     or new.criado_por is distinct from old.criado_por
     or new.created_at is distinct from old.created_at then
    raise exception 'Registro da ficha não se altera depois de criado. Anule com motivo e registre de novo.';
  end if;
  if old.anulado_em is not null then
    raise exception 'Registro anulado não se altera.';
  end if;
  if new.anulado_em is not null then
    new.anulado_em := now();
  end if;
  if new.assinado and not old.assinado then new.assinado_em := now(); end if;
  if not new.assinado then new.assinado_em := null; end if;
  return new;
end $$;

create trigger rh_registros_colab_antes
  before insert or update on public.rh_registros_colab
  for each row execute function public.rh_registros_colab_antes();

alter table public.rh_registros_colab enable row level security;

create policy rh_registros_colab_ler on public.rh_registros_colab
  for select to authenticated
  using (public.hefisto_user_can('rh.employees.view', unidade_id));

-- O WITH CHECK roda depois do gatilho BEFORE: a política confere a unidade
-- REAL do funcionário, não a que veio no corpo.
create policy rh_registros_colab_criar on public.rh_registros_colab
  for insert to authenticated
  with check (public.hefisto_user_can('rh.employees.create', unidade_id)
           or public.hefisto_user_can('rh.employees.edit', unidade_id));

create policy rh_registros_colab_completar on public.rh_registros_colab
  for update to authenticated
  using (public.hefisto_user_can('rh.employees.edit', unidade_id))
  with check (public.hefisto_user_can('rh.employees.edit', unidade_id));

revoke all on public.rh_registros_colab from anon, authenticated;
grant select, insert, update on public.rh_registros_colab to authenticated;
revoke all on function public.rh_registros_colab_antes() from public, anon, authenticated;

select md5(string_agg(column_name || ':' || data_type, ',' order by ordinal_position)) as impressao_digital
  from information_schema.columns
 where table_schema = 'public' and table_name = 'rh_registros_colab';

commit;
