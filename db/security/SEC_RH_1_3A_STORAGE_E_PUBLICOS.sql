/* SEC-RH-1.3A · STORAGE, RPC E FLUXOS PÚBLICOS DO RH
   ═══════════════════════════════════════════════════════════════════════════

   Projeto: sezccspqxgklicfndwxx (produção). Rode no SQL Editor, FASE A FASE.
   Cada fase diz quando pode rodar. Nenhuma fase apaga registro ou arquivo.

   ORDEM OBRIGATÓRIA
     FASE 0  diagnóstico (só leitura) ........................ agora
     FASE 1  aditiva: convites e token de treinamento ........ antes do deploy
     ── deploy do código da branch sec/rh-1-3a-storage ──
     FASE 2  referências: URL pública → storage://bucket/path  depois do deploy
     FASE 3  script scripts/sec_rh_mover_fotos_anexos.mjs .... depois da FASE 2
     FASE 4  Storage: rh-docs privado + policies ............. depois da FASE 3
     FASE 5  RPC extra_cadastro_publico e tabela candidatos .. depois do deploy

   POR QUE ESTA ORDEM
   Tornar rh-docs privado ANTES do deploy quebraria todo documento, atestado
   e regulamento já gravado: as telas abrem a URL pública. Depois do deploy
   elas pedem URL assinada ao servidor, que entende os dois formatos (URL
   antiga e storage://), então a troca do bucket não quebra nada.

   O QUE NÃO ESTÁ AQUI
   - `anexos` NÃO fica privado. Ele serve as imagens de produto do cardápio
     público de delivery (/delivery/[loja]); privado, o cardápio perde as
     fotos. O que é de RH sai de dentro dele (FASE 3) e o anon perde a
     LISTAGEM (FASE 4). O resto do bucket segue público de propósito.
*/


/* ═══ FASE 0 · DIAGNÓSTICO — somente leitura ════════════════════════════════ */

/* 0.1 · A RPC, como está no banco (PARTE F). */
select p.oid::regprocedure::text                                   as assinatura,
       case when p.prosecdef then 'DEFINER' else 'INVOKER' end     as seguranca,
       pg_get_userbyid(p.proowner)                                 as owner,
       coalesce(array_to_string(p.proconfig, ', '), '(sem search_path fixo)') as config,
       has_function_privilege('anon',          p.oid, 'EXECUTE')   as anon_executa,
       has_function_privilege('authenticated', p.oid, 'EXECUTE')   as auth_executa,
       exists (select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
                where a.grantee = 0 and a.privilege_type = 'EXECUTE') as public_executa,
       (select string_agg(m[1], ', ')
          from regexp_matches(p.prosrc, '''([a-z_]+)''\s*,', 'g') m) as campos_devolvidos
  from pg_proc p
 where p.pronamespace = 'public'::regnamespace
   and p.proname in ('extra_cadastro_publico', 'unidade_publica', 'portal_extras_publico');

/* 0.2 · Buckets e policies do Storage (PARTE K). */
select id, public, file_size_limit from storage.buckets order by public desc, id;

select policyname, cmd, roles, qual as usando, with_check as com_check,
       (roles && array['anon', 'public']::name[])             as vale_para_anon,
       coalesce(qual, '') || coalesce(with_check, '') ~ 'bucket_id' as filtra_bucket
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
 order by policyname;

/* 0.3 · Objetos por bucket e pasta — contagem, sem nome de arquivo (PARTE 3). */
select bucket_id,
       case when split_part(name, '/', 1) ~ '^[a-z][a-z_-]*$'
            then split_part(name, '/', 1) else '<id>' end as pasta,
       count(*) as objetos
  from storage.objects
 where bucket_id in ('rh-docs', 'anexos')
 group by 1, 2 order by 1, 2;

/* 0.4 · URLs gravadas nas colunas de arquivo de RH, por formato (PARTE L).
   Só contagem. Coluna que não existe aparece como "coluna ausente".
   query_to_xml deixa contar em tabela/coluna variável sem DO nem função.
   No format(): %I = tabela (1º argumento), %2$I = coluna (2º). */
with alvo(tabela, coluna) as (values
  ('documentos_rh', 'url_arquivo'), ('rh_atestados', 'arquivo_url'),
  ('rh_regulamentos', 'url_pdf'),   ('colaboradores', 'foto_url'),
  ('funcionarios', 'foto_url'),     ('holerites', 'arquivo_url'),
  ('func_documentos', 'arquivo_url'), ('cursos', 'arquivo_url'),
  ('rh_atas', 'arquivo_url'),       ('candidatos', 'url_curriculo')
),
existe as (
  select a.*, exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = a.tabela
                         and c.column_name = a.coluna) as ok
    from alvo a
),
formatos(formato, cond) as (values
  ('vazio',                       '%2$I is null or btrim(%2$I) = '''''),
  ('storage:// (modelo novo)',    '%2$I like ''storage://%%'''),
  ('URL pública rh-docs',         '%2$I ~ ''/storage/v1/object/public/rh-docs/'''),
  ('URL pública anexos',          '%2$I ~ ''/storage/v1/object/public/anexos/'''),
  ('outra URL do Storage',        '%2$I ~ ''/storage/v1/object/'' and %2$I !~ ''/storage/v1/object/public/(rh-docs|anexos)/'''),
  ('link externo',                '%2$I ~* ''^https?://'' and %2$I !~ ''/storage/v1/object/'''),
  ('outro texto',                 '%2$I !~* ''^(https?://|storage://)'' and btrim(%2$I) <> ''''')
)
select e.tabela, e.coluna, f.formato,
       case when not e.ok then null else
         (xpath('/row/n/text()', query_to_xml(
            format('select count(*) as n from public.%I where ' || f.cond, e.tabela, e.coluna),
            false, true, '')))[1]::text::bigint
       end as registros,
       case when not e.ok then 'coluna ausente' end as obs
  from existe e cross join formatos f
 order by e.tabela, f.formato;


/* ═══ FASE 1 · ADITIVA — pode rodar ANTES do deploy ═════════════════════════
   Só CRIA: uma tabela nova, um índice, uma coluna nova e um índice único.
   Não há DROP, TRUNCATE, DELETE, UPDATE, REVOKE nem GRANT; não toca em
   Storage, bucket, policy existente ou RPC. Idempotente: rodar de novo não
   muda nada ("if not exists" em tudo).

   Sobre grants: a tabela nova nasce com RLS LIGADO e NENHUMA policy. Com
   isso, anon e authenticated não leem nem gravam uma linha sequer, mesmo que
   os privilégios padrão do Supabase deem grant de tabela a eles. O REVOKE
   explícito (defesa em profundidade) fica para a FASE 5. Só o servidor, com
   service_role, usa a tabela. */
begin;

/* 1.1 · Convite de uso limitado para o portal de vagas (PARTE G).
   Guarda só o HASH do token. "on delete cascade" é regra da tabela NOVA:
   se um cadastro de extra for apagado, os convites dele vão junto. */
create table if not exists public.extras_convites (
  id                 uuid primary key default gen_random_uuid(),
  token_hash         text not null unique,
  extras_cadastro_id uuid not null references public.extras_cadastros(id) on delete cascade,
  escopo             text not null default 'vaga_prefill' check (escopo in ('vaga_prefill')),
  expira_em          timestamptz not null,
  usos_restantes     integer not null default 3 check (usos_restantes >= 0),
  revogado_em        timestamptz,
  ultimo_uso_em      timestamptz,
  criado_em          timestamptz not null default now()
);
create index if not exists idx_extras_convites_expira on public.extras_convites (expira_em);
alter table public.extras_convites enable row level security;

/* 1.2 · Token público do treinamento (PARTE I).
   Coluna nova com DEFAULT volátil: o Postgres calcula um valor PARA CADA
   linha existente no próprio ADD COLUMN — sem UPDATE. 64 hex de dois UUID v4
   (244 bits aleatórios), sem depender de pgcrypto. Se a coluna já existir,
   o comando não faz nada. */
alter table public.treinamentos
  add column if not exists token_publico text
  default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
create unique index if not exists uq_treinamentos_token_publico on public.treinamentos (token_publico);

commit;

/* 1.3 · Conferência (só leitura). */
select 'extras_convites existe'            as item, (to_regclass('public.extras_convites') is not null)::text as valor
union all
select 'extras_convites RLS ligado', relrowsecurity::text from pg_class where oid = to_regclass('public.extras_convites')
union all
select 'extras_convites policies', count(*)::text from pg_policies where schemaname = 'public' and tablename = 'extras_convites'
union all
select 'extras_convites linhas', count(*)::text from public.extras_convites
union all
select 'treinamentos total', count(*)::text from public.treinamentos
union all
select 'treinamentos com token', count(token_publico)::text from public.treinamentos
union all
select 'tokens distintos', count(distinct token_publico)::text from public.treinamentos;
/* ESPERADO: existe = true, RLS = true, policies = 0, linhas = 0,
   "treinamentos total" = "com token" = "tokens distintos". */

/* ROLLBACK FASE 1 — NÃO faz parte da execução; só se precisar desfazer:
     drop table if exists public.extras_convites;
     drop index if exists public.uq_treinamentos_token_publico;
     alter table public.treinamentos drop column if exists token_publico;
   Efeito: o portal de vagas perde o pré-preenchimento (o cadastro continua) e
   os links públicos de treinamento param de abrir. */


/* ═══ FASE 2 · REFERÊNCIAS — DEPOIS do deploy ══════════════════════════════

   2.0 · CONTAGEM — somente leitura. Rode ANTES e DEPOIS do 2.1.
   Por coluna de arquivo de RH, só números:
     url_rh_total      URL pública do próprio projeto, na pasta de RH
     convertiveis      dessas, as que o 2.1 converte (sem caractere codificado)
     nao_convertiveis  as que têm "%" no caminho — o 2.1 NÃO toca nelas
     ja_convertidas    já estão como storage://
   CRITÉRIO DE PARADA: nao_convertiveis > 0 em qualquer linha → NÃO rode o
   2.1; me mande a tabela. (Elas continuariam abrindo pelo servidor, que lê o
   formato antigo, mas a sua regra é parar.) */
with alvo(tabela, coluna, pasta) as (values
  ('documentos_rh',   'url_arquivo', 'rh-docs/'),
  ('rh_atestados',    'arquivo_url', 'rh-docs/'),
  ('rh_regulamentos', 'url_pdf',     'rh-docs/'),
  ('colaboradores',   'foto_url',    'anexos/fotos/'),
  ('funcionarios',    'foto_url',    'anexos/fotos/'),
  ('holerites',       'arquivo_url', 'anexos/holerites/'),
  ('func_documentos', 'arquivo_url', 'anexos/documentos/'),
  ('cursos',          'arquivo_url', 'anexos/cursos/'),
  ('rh_atas',         'arquivo_url', 'anexos/atas/')
),
existe as (
  select a.*, exists (select 1 from information_schema.columns c
                       where c.table_schema = 'public' and c.table_name = a.tabela
                         and c.column_name = a.coluna) as ok
    from alvo a
),
conta as (
  select e.tabela, e.coluna, e.ok,
         case when e.ok then query_to_xml(format(
           'select count(*) filter (where %2$I like %3$L) as url_rh_total,
                   count(*) filter (where %2$I like %3$L and %2$I not like ''%%\%%%%'') as convertiveis,
                   count(*) filter (where %2$I like %3$L and %2$I like ''%%\%%%%'') as nao_convertiveis,
                   count(*) filter (where %2$I like ''storage://%%'') as ja_convertidas
              from public.%1$I',
           e.tabela, e.coluna,
           'https://sezccspqxgklicfndwxx.supabase.co/storage/v1/object/public/' || e.pasta || '%'),
           false, true, '') end as x
    from existe e
)
select tabela, coluna,
       case when not ok then 'coluna ausente' else 'ok' end as situacao,
       (xpath('/row/url_rh_total/text()',     x))[1]::text::int as url_rh_total,
       (xpath('/row/convertiveis/text()',     x))[1]::text::int as convertiveis,
       (xpath('/row/nao_convertiveis/text()', x))[1]::text::int as nao_convertiveis,
       (xpath('/row/ja_convertidas/text()',   x))[1]::text::int as ja_convertidas
  from conta
 order by tabela;

/* 2.1 · CONVERSÃO
   Troca a URL pública gravada por storage://bucket/caminho, que não abre
   nada sozinha. Guarda o valor antigo numa tabela de backup (sem grant a
   ninguém além do owner/service_role) para o rollback.

   Só converte URL do PRÓPRIO projeto, dos buckets de RH, e sem caractere
   codificado (%). Não apaga URL nem arquivo: o arquivo continua no mesmo
   lugar, e o servidor o encontra pelo bucket/caminho. */
begin;

create table if not exists public.sec_rh_backup_urls (
  tabela       text not null,
  registro_id  text not null,
  coluna       text not null,
  valor_antigo text not null,
  migrado_em   timestamptz not null default now(),
  primary key (tabela, registro_id, coluna)
);
alter table public.sec_rh_backup_urls enable row level security;
revoke all on table public.sec_rh_backup_urls from anon, authenticated;

do $$
declare
  alvo record;
  prefixo constant text := 'https://sezccspqxgklicfndwxx.supabase.co/storage/v1/object/public/';
  n bigint;
begin
  for alvo in
    select * from (values
      ('documentos_rh',   'url_arquivo', 'rh-docs/'),
      ('rh_atestados',    'arquivo_url', 'rh-docs/'),
      ('rh_regulamentos', 'url_pdf',     'rh-docs/'),
      ('colaboradores',   'foto_url',    'anexos/fotos/'),
      ('funcionarios',    'foto_url',    'anexos/fotos/'),
      ('holerites',       'arquivo_url', 'anexos/holerites/'),
      ('func_documentos', 'arquivo_url', 'anexos/documentos/'),
      ('cursos',          'arquivo_url', 'anexos/cursos/'),
      ('rh_atas',         'arquivo_url', 'anexos/atas/')
    ) v(tabela, coluna, pasta)
  loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = alvo.tabela and column_name = alvo.coluna) then
      raise notice '% .% — coluna ausente, pulada', alvo.tabela, alvo.coluna;
      continue;
    end if;

    execute format(
      'insert into public.sec_rh_backup_urls (tabela, registro_id, coluna, valor_antigo)
       select %L, id::text, %L, %I from public.%I
        where %I like %L and %I not like ''%%\%%%%''
       on conflict do nothing',
      alvo.tabela, alvo.coluna, alvo.coluna, alvo.tabela,
      alvo.coluna, prefixo || alvo.pasta || '%', alvo.coluna);

    execute format(
      'update public.%I set %I = ''storage://'' || substr(%I, %s)
        where %I like %L and %I not like ''%%\%%%%''',
      alvo.tabela, alvo.coluna, alvo.coluna, length(prefixo) + 1,
      alvo.coluna, prefixo || alvo.pasta || '%', alvo.coluna);
    get diagnostics n = row_count;
    raise notice '% .% — % registro(s) convertido(s)', alvo.tabela, alvo.coluna, n;
  end loop;
end $$;

commit;

/* Conferência: rode de novo o 2.0. Esperado: convertiveis = 0 em todas as
   linhas, e ja_convertidas = (ja_convertidas de antes + convertiveis de
   antes). Os arquivos NÃO mudaram de lugar.

   ROLLBACK FASE 2 — devolve exatamente o valor antigo:
     do $$ declare b record; begin
       for b in select * from public.sec_rh_backup_urls loop
         execute format('update public.%I set %I = %L where id::text = %L',
                        b.tabela, b.coluna, b.valor_antigo, b.registro_id);
       end loop; end $$;
   Não apague sec_rh_backup_urls antes de a FASE 4 estar validada. */


/* ═══ FASE 3 · FOTOS DE RH DENTRO DE `anexos` ══════════════════════════════
   Não é SQL. Copiar objeto entre buckets precisa da API do Storage:
     node scripts/sec_rh_mover_fotos_anexos.mjs            (simulação: só conta)
     node scripts/sec_rh_mover_fotos_anexos.mjs --aplicar  (copia, aponta, apaga o original)
   Roda com SUPABASE_SERVICE_ROLE_KEY no ambiente de quem executa. Não baixa
   nem imprime arquivo; imprime contagens. */


/* ═══ FASE 4 · STORAGE — DEPOIS da FASE 3 ══════════════════════════════════ */

/* 4.1 · rh-docs privado. A partir daqui, URL pública de rh-docs responde
   erro; as telas já usam URL assinada. */
update storage.buckets set public = false where id = 'rh-docs';

/* 4.2 · Policies: este bloco NÃO executa nada. Ele GERA um comando por
   policy de storage.objects para você revisar e rodar um a um:

   - policy que cita rh-docs .................. DROP. O servidor usa
     service_role, que não depende de policy.
   - policy que vale para anon/public ......... passa a valer só para
     authenticated (ALTER POLICY ... TO — não cria policy nova). Efeito: o
     anon deixa de LISTAR `anexos`; a URL pública de bucket público continua
     abrindo, porque ela não passa por policy.
   - policy sem filtro de bucket .............. ganha "bucket_id <> 'rh-docs'"
     no USING (e no WITH CHECK, se houver): nenhum login lista, baixa, envia
     ou apaga direto no rh-docs.
   Cada comando respeita o tipo: INSERT só aceita WITH CHECK; SELECT e DELETE
   só USING; UPDATE e ALL, os dois. */
select case
         when coalesce(qual, '') || coalesce(with_check, '') ~ 'rh-docs'
           then format('drop policy %I on storage.objects;', policyname)
         when partes.para_quem = '' and partes.usando = '' and partes.checando = ''
           then '-- sem mudança: ' || policyname
         else format('alter policy %I on storage.objects%s%s%s;',
                     policyname, partes.para_quem, partes.usando, partes.checando)
       end as comando_sugerido,
       policyname, cmd, roles
  from pg_policies,
       lateral (select
         case when roles && array['anon', 'public']::name[] then ' to authenticated' else '' end as para_quem,
         case when cmd <> 'INSERT' and coalesce(qual, '') !~ 'bucket_id'
              then format(' using ((%s) and bucket_id <> ''rh-docs'')', coalesce(qual, 'true')) else '' end as usando,
         case when cmd in ('INSERT', 'UPDATE', 'ALL') and coalesce(with_check, '') !~ 'bucket_id'
               and (cmd = 'INSERT' or with_check is not null)
              then format(' with check ((%s) and bucket_id <> ''rh-docs'')', coalesce(with_check, 'true')) else '' end as checando
       ) partes
 where schemaname = 'storage' and tablename = 'objects'
 order by 1;

/* Se algum ALTER falhar, me mande a linha — não improvise.

   ROLLBACK FASE 4
     update storage.buckets set public = true where id = 'rh-docs';
     (e o inverso de cada ALTER/DROP que você rodou — anote antes: a coluna
     "usando"/"com_check" da consulta 0.2 é o estado original)
   Voltar rh-docs a público reabre TODOS os documentos por URL. */


/* ═══ FASE 5 · RPC E TABELA candidatos — DEPOIS do deploy ═════════════════
   O portal de vagas passou a usar /api/public/extras/convite e
   /api/public/vagas/candidatura. Nada no código chama mais a RPC nem grava
   em candidatos como anon. */
begin;

/* 5.1 · PARTE J — assinatura exata. A função NÃO é apagada: fica sem
   chamador anônimo. Se a 0.1 mostrar public_executa = true, PARE e me mande:
   revogar de PUBLIC afeta authenticated também. */
revoke execute on function public.extra_cadastro_publico(uuid) from anon;

/* 5.1b · Convites: defesa em profundidade. Desde a FASE 1 o RLS sem policy
   já bloqueia; aqui sai também o grant de tabela que os privilégios padrão
   do Supabase dão a anon e authenticated. */
revoke all on table public.extras_convites from anon, authenticated;

/* 5.2 · candidatos respondia 200 ao anon com 31 linhas em 29/09/2026 —
   nome, telefone, endereço e, em versões antigas do formulário, CPF. */
revoke select, insert, update, delete on table public.candidatos from anon;

commit;

/* 5.3 · Conferência. */
select 'extra_cadastro_publico(uuid)' as objeto,
       has_function_privilege('anon', 'public.extra_cadastro_publico(uuid)', 'EXECUTE') as anon
union all
select 'candidatos SELECT', has_table_privilege('anon', 'public.candidatos', 'SELECT')
union all
select 'candidatos INSERT', has_table_privilege('anon', 'public.candidatos', 'INSERT')
union all
select 'extras_convites SELECT', has_table_privilege('anon', 'public.extras_convites', 'SELECT');
/* ESPERADO: false nas quatro. */

/* ROLLBACK FASE 5
     grant execute on function public.extra_cadastro_publico(uuid) to anon;
     grant insert on table public.candidatos to anon;
   Só se o deploy tiver sido revertido — com o código novo nada usa isso, e
   devolver o grant reabre a exposição. */
