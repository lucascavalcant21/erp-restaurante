/* SEC-RH-1.3 · CONTENÇÃO — as 18 tabelas de RH que o anon ainda alcança.
   ═══════════════════════════════════════════════════════════════════════════

   ORDEM
     1. SEC_RH_1_3_DIAGNOSTICO.sql, blocos 1 e 2 — conferir que a lista abaixo
        bate com o catálogo. Se o bloco 1 trouxer tabela "padrão de nome" com
        acesso anon que NÃO está aqui, pare e me mande: ela entra por decisão,
        não por regex.
     2. Este arquivo.
     3. SEC_RH_1_3_DIAGNOSTICO.sql, blocos 1 e 2 de novo — conferência.

   DE ONDE VEIO A LISTA
   Sondagem de 29/09/2026 pelo PostgREST, com SOMENTE a chave anônima e sem
   login, requisição HEAD (nenhum registro trafegou). Das 22 expostas no
   SEC-RH-1, as 4 já contidas (colaboradores, registro_ponto, ponto_marcacao,
   rh_atestados) respondem 401. As outras 18 respondem 200:

     devolvem linha ao anon hoje          respondem 200, 0 linhas visíveis
     ──────────────────────────────       ────────────────────────────────
     rh_banco_horas          172          extras_cadastros
     rh_recibos_prestacao     22          producao_diaria
     rh_feriados              20          rh_advertencias_colab
     rh_cargos                16          rh_atas
     rh_folgas_esporadicas     8          rh_bonificacoes
     rh_espelho_fechado        6          rh_historico
     rh_atas_reuniao           3          rh_regulamentos
     documentos_rh             1          rh_tipos_bonificacao
     escalas_dia               1          treinamentos

   "0 linhas visíveis" não é seguro: o grant existe, e a primeira linha
   inserida (ou a primeira policy afrouxada) passa a sair.

   O QUE FAZ: revoga SELECT, INSERT, UPDATE, DELETE do role anon. Só isso.
   NÃO toca authenticated, service_role, owner, schema, RLS ou policies.
   NÃO faz GRANT a ninguém. NÃO apaga linha. Idempotente.

   REGRESSÕES ESPERADAS — duas telas PÚBLICAS usam estas tabelas sem login:

     /extras/[unidade]   portal onde o candidato a extra se cadastra.
                         Faz INSERT em extras_cadastros como anon e pede o id
                         de volta (.select("id")). Depois deste arquivo, o
                         cadastro público para de funcionar.
                         Observação: o banco já não tem policy de SELECT para
                         anon nessa tabela, e INSERT ... RETURNING exige
                         passar pela policy de SELECT — é provável que o
                         portal JÁ esteja falhando hoje. Não confirmei porque
                         confirmar exigiria inserir em produção.

     /treinamento/[id]   link público de treinamento gerado em
                         /dashboard/salao/treinamento. Lê treinamentos como
                         anon. O anon hoje já enxerga 0 linhas nela — se a
                         tabela tiver registros (bloco 1, linhas_aprox), o
                         link público já não funciona hoje.

   A saída certa para as duas é rota de servidor (service_role só no
   servidor) — não devolver grant ao anon. Fica para depois da contenção.
*/

begin;

/* ═══ 1. AS 18 ══════════════════════════════════════════════════════════════ */
revoke select, insert, update, delete on table public.rh_banco_horas         from anon;
revoke select, insert, update, delete on table public.rh_recibos_prestacao   from anon;
revoke select, insert, update, delete on table public.rh_feriados            from anon;
revoke select, insert, update, delete on table public.rh_cargos              from anon;
revoke select, insert, update, delete on table public.rh_folgas_esporadicas  from anon;
revoke select, insert, update, delete on table public.rh_espelho_fechado     from anon;
revoke select, insert, update, delete on table public.rh_atas_reuniao        from anon;
revoke select, insert, update, delete on table public.documentos_rh          from anon;
revoke select, insert, update, delete on table public.escalas_dia            from anon;
revoke select, insert, update, delete on table public.extras_cadastros       from anon;
revoke select, insert, update, delete on table public.producao_diaria        from anon;
revoke select, insert, update, delete on table public.rh_advertencias_colab  from anon;
revoke select, insert, update, delete on table public.rh_atas                from anon;
revoke select, insert, update, delete on table public.rh_bonificacoes        from anon;
revoke select, insert, update, delete on table public.rh_historico           from anon;
revoke select, insert, update, delete on table public.rh_regulamentos        from anon;
revoke select, insert, update, delete on table public.rh_tipos_bonificacao   from anon;
revoke select, insert, update, delete on table public.treinamentos           from anon;

/* ═══ 2. AS QUE JÁ RESPONDEM 401 AO SELECT ══════════════════════════════════
   O 401 do PostgREST prova que o anon não LÊ. Não prova que não ESCREVE:
   uma tabela pode ter INSERT para anon sem SELECT, e isso não se testa por
   HTTP sem escrever em produção. REVOKE do que não existe é no-op. */
revoke select, insert, update, delete on table public.colaboradores           from anon;
revoke select, insert, update, delete on table public.registro_ponto          from anon;
revoke select, insert, update, delete on table public.ponto_marcacao          from anon;
revoke select, insert, update, delete on table public.rh_atestados            from anon;
revoke select, insert, update, delete on table public.funcionarios            from anon;
revoke select, insert, update, delete on table public.holerites               from anon;
revoke select, insert, update, delete on table public.func_documentos         from anon;
revoke select, insert, update, delete on table public.advertencias            from anon;
revoke select, insert, update, delete on table public.producoes               from anon;
revoke select, insert, update, delete on table public.rh_consumo_funcionarios from anon;
revoke select, insert, update, delete on table public.registros_ponto         from anon;
revoke select, insert, update, delete on table public.usuarios_erp            from anon;
revoke select, insert, update, delete on table public.avisos                  from anon;
revoke select, insert, update, delete on table public.cursos                  from anon;

commit;

/* ═══ 3. CONFERÊNCIA IMEDIATA (PASSO 5) ═════════════════════════════════════
   Qualquer linha que voltar aqui é uma tabela em que o anon AINDA tem
   privilégio depois do REVOKE. A coluna `origem` diz de onde vem.
   Se voltar linha: PARE nela. Não rode REVOKE ... FROM PUBLIC por conta
   própria — authenticated também herda de PUBLIC. Me mande o resultado. */
with alvo(tabela) as (values
  ('rh_banco_horas'),('rh_recibos_prestacao'),('rh_feriados'),('rh_cargos'),
  ('rh_folgas_esporadicas'),('rh_espelho_fechado'),('rh_atas_reuniao'),
  ('documentos_rh'),('escalas_dia'),('extras_cadastros'),('producao_diaria'),
  ('rh_advertencias_colab'),('rh_atas'),('rh_bonificacoes'),('rh_historico'),
  ('rh_regulamentos'),('rh_tipos_bonificacao'),('treinamentos'),
  ('colaboradores'),('registro_ponto'),('ponto_marcacao'),('rh_atestados'),
  ('funcionarios'),('holerites'),('func_documentos'),('advertencias'),
  ('producoes'),('rh_consumo_funcionarios'),('registros_ponto'),('usuarios_erp'),
  ('avisos'),('cursos')
),
t as (
  select a.tabela, c.oid, c.relowner, c.relacl
    from alvo a
    join pg_class c on c.relname = a.tabela and c.relnamespace = 'public'::regnamespace
),
p as (
  select t.tabela, t.oid, priv.nome
    from t, (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) priv(nome)
   where has_table_privilege('anon', t.oid, priv.nome)
)
select p.tabela,
       p.nome as privilegio,
       case
         when exists (select 1 from t, aclexplode(coalesce(t.relacl, acldefault('r', t.relowner))) a
                       where t.oid = p.oid and a.grantee = 0 and a.privilege_type = p.nome)
           then 'PUBLIC'
         when exists (select 1 from pg_auth_members m
                       where m.member = 'anon'::regrole)
           then 'herança de role (ver pg_auth_members)'
         else 'desconhecida — investigar'
       end as origem,
       'anon, authenticated e qualquer role sem grant próprio' as roles_afetadas_por_revoke_public
  from p
 order by p.tabela, p.nome;

/* ESPERADO: zero linhas. */

/* ═══ 4. ROLLBACK ═══════════════════════════════════════════════════════════
   Desfazer = devolver o grant, e isso REABRE a exposição. Não existe bloco
   pronto de propósito. Se uma tela autenticada quebrar, o problema não é
   este arquivo: ele não toca authenticated. As duas telas públicas acima
   quebram por desenho — a correção delas é rota de servidor.
   ═══════════════════════════════════════════════════════════════════════════ */
