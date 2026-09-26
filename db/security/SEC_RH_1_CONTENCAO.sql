/* SEC-RH-1 · CONTENÇÃO — tirar o RH do alcance do anônimo.
   ═══════════════════════════════════════════════════════════════════════════

   O QUE FOI CONFIRMADO (25/09/2026, projeto sezccspqxgklicfndwxx)
   Usando SOMENTE a chave anônima pública — a mesma que vai embutida no bundle
   JavaScript do site publicado — e SEM LOGIN NENHUM, 22 tabelas de RH
   devolvem dado. Entre elas:

     colaboradores      21 linhas · cpf, rg, salario, chave_pix, endereco,
                        cep, data_nascimento, telefone, motivo_desligamento
                        e face_descritores (template biométrico facial)
     ponto_marcacao    596 linhas · cpf
     registro_ponto    323 linhas · face_foto_entrada, face_foto_saida
     rh_banco_horas    162 linhas
     rh_recibos_prest.  22 linhas · valor_diaria, valor_total, foto do recibo
     rh_atestados        5 linhas · cid (informação médica)

   O QUE ESTE ARQUIVO FAZ
   Revoga SELECT, INSERT, UPDATE e DELETE do role `anon` em todas as tabelas
   de RH que existem no banco. Nada além disso.

   O QUE ELE NÃO FAZ — de propósito
   Não toca em `authenticated`. Não toca em `service_role`. Não muda owner,
   schema nem RLS. Não remove policy. Não apaga linha. Não faz DROP.
   Não é a solução final: é o torniquete. O RLS multi-tenant vem depois, em
   SEC_RH_2.

   POR QUE REVOKE E NÃO RLS AGORA
   O PostgREST precisa do GRANT na tabela para responder. Sem o grant, o anon
   para de ler independentemente de haver RLS ou não — e é uma mudança de uma
   linha por tabela, reversível, sem reescrever regra de negócio. Ligar RLS
   agora, com as policies erradas, derrubaria o app inteiro.

   RISCO DE REGRESSÃO
   Baixo, e medido: a varredura do código não achou nenhuma tela de RH que
   consulte essas tabelas sem sessão. A chave anônima é usada para CRIAR o
   cliente Supabase; depois do login o JWT passa a valer e o papel efetivo é
   `authenticated`, que este arquivo não toca. As duas exceções conhecidas são
   páginas públicas de rastreio e portal de extras — nenhuma delas lê tabela
   desta lista.

   IDEMPOTENTE: rodar duas vezes não faz diferença. REVOKE do que já foi
   revogado é no-op.
*/

begin;

/* ═══ 1. AS 22 TABELAS HOJE EXPOSTAS ════════════════════════════════════════ */
revoke select, insert, update, delete on table public.colaboradores          from anon;
revoke select, insert, update, delete on table public.registro_ponto         from anon;
revoke select, insert, update, delete on table public.ponto_marcacao         from anon;
revoke select, insert, update, delete on table public.rh_atestados           from anon;
revoke select, insert, update, delete on table public.rh_espelho_fechado     from anon;
revoke select, insert, update, delete on table public.rh_banco_horas         from anon;
revoke select, insert, update, delete on table public.rh_recibos_prestacao   from anon;
revoke select, insert, update, delete on table public.rh_advertencias_colab  from anon;
revoke select, insert, update, delete on table public.rh_bonificacoes        from anon;
revoke select, insert, update, delete on table public.rh_atas                from anon;
revoke select, insert, update, delete on table public.rh_atas_reuniao        from anon;
revoke select, insert, update, delete on table public.rh_historico           from anon;
revoke select, insert, update, delete on table public.rh_cargos              from anon;
revoke select, insert, update, delete on table public.rh_feriados            from anon;
revoke select, insert, update, delete on table public.rh_folgas_esporadicas  from anon;
revoke select, insert, update, delete on table public.rh_regulamentos        from anon;
revoke select, insert, update, delete on table public.rh_tipos_bonificacao   from anon;
revoke select, insert, update, delete on table public.treinamentos           from anon;
revoke select, insert, update, delete on table public.escalas_dia            from anon;
revoke select, insert, update, delete on table public.documentos_rh          from anon;
revoke select, insert, update, delete on table public.extras_cadastros       from anon;
revoke select, insert, update, delete on table public.producao_diaria        from anon;

/* ═══ 2. AS QUE JÁ RESPONDEM 401, POR GARANTIA ══════════════════════════════
   Hoje estão bloqueadas, mas o bloqueio pode estar vindo de RLS e não de
   grant. Deixar explícito custa nada e fecha a porta dos dois lados. */
revoke select, insert, update, delete on table public.funcionarios            from anon;
revoke select, insert, update, delete on table public.holerites               from anon;
revoke select, insert, update, delete on table public.func_documentos         from anon;
revoke select, insert, update, delete on table public.advertencias            from anon;
revoke select, insert, update, delete on table public.avisos                  from anon;
revoke select, insert, update, delete on table public.cursos                  from anon;
revoke select, insert, update, delete on table public.producoes               from anon;
revoke select, insert, update, delete on table public.rh_consumo_funcionarios from anon;
revoke select, insert, update, delete on table public.usuarios_erp            from anon;

commit;

/* ═══ 3. CONFERÊNCIA — rode logo depois, na mesma sessão ════════════════════
   Se alguma linha voltar com `ainda_le = true`, o privilégio NÃO vinha de um
   grant direto ao anon: vem de PUBLIC, e o anon herda. Nesse caso o REVOKE
   acima não resolveu aquela tabela — veja o bloco 4. */
with alvo(tabela) as (values
  ('colaboradores'),('registro_ponto'),('ponto_marcacao'),('rh_atestados'),
  ('rh_espelho_fechado'),('rh_banco_horas'),('rh_recibos_prestacao'),
  ('rh_advertencias_colab'),('rh_bonificacoes'),('rh_atas'),('rh_atas_reuniao'),
  ('rh_historico'),('rh_cargos'),('rh_feriados'),('rh_folgas_esporadicas'),
  ('rh_regulamentos'),('rh_tipos_bonificacao'),('treinamentos'),('escalas_dia'),
  ('documentos_rh'),('extras_cadastros'),('producao_diaria'),
  ('funcionarios'),('holerites'),('func_documentos'),('advertencias'),
  ('avisos'),('cursos'),('producoes'),('rh_consumo_funcionarios'),('usuarios_erp')
)
select a.tabela,
       has_table_privilege('anon', 'public.' || a.tabela, 'SELECT') as ainda_le,
       has_table_privilege('anon', 'public.' || a.tabela, 'INSERT') as ainda_escreve,
       has_table_privilege('authenticated', 'public.' || a.tabela, 'SELECT') as auth_le
  from alvo a
 where exists (select 1 from pg_class c
                where c.relname = a.tabela and c.relnamespace = 'public'::regnamespace)
 order by ainda_le desc, ainda_escreve desc, a.tabela;

/* ESPERADO: ainda_le = false e ainda_escreve = false em TODAS.
   auth_le deve continuar true — é o app logado, e ele não pode parar. */

/* ═══ 4. SE ALGUMA CONTINUAR LEGÍVEL (grant via PUBLIC) ═════════════════════

   Só rode isto para as tabelas que o bloco 3 apontou, UMA A UMA, conferindo o
   app entre elas. Revogar de PUBLIC tem estouro maior: `authenticated`
   também herda de PUBLIC, então este comando pode tirar o acesso do app. Por
   isso a linha seguinte devolve explicitamente o acesso ao authenticated.

     revoke select, insert, update, delete on table public.<tabela> from public;
     grant  select, insert, update, delete on table public.<tabela> to authenticated;

   Confira a tela correspondente antes de passar para a próxima tabela.

   ═══ 5. ROLLBACK ═══════════════════════════════════════════════════════════
   Este arquivo só retira privilégio; desfazer é devolvê-lo. Só faça isso se a
   contenção quebrar algo que não dá para consertar de outro jeito, e saiba
   que devolver o grant reabre a exposição.

     grant select on table public.<tabela> to anon;

   Não existe rollback "em bloco" de propósito: reabrir 22 tabelas de uma vez
   não deveria ser fácil.

   ═══ 6. O QUE AINDA FICA DE FORA ═══════════════════════════════════════════
   - Funções SECURITY DEFINER executáveis por anon continuam sendo um caminho
     de leitura. O bloco 6 do DIAGNOSTICO lista quais existem.
   - DEFAULT PRIVILEGES: se houver grant padrão para anon no schema public,
     toda tabela nova nasce exposta. Bloco 5 do DIAGNOSTICO.
   - Isolamento entre unidades para usuário LOGADO: não é tratado aqui. É o
     SEC_RH_2.
   ═══════════════════════════════════════════════════════════════════════════ */
