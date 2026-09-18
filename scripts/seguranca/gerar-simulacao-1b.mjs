// Gera db/testes/simular_1b_02.sql a partir de db/1b/02_rls_permissao_e_tabelas_filho.sql.
//
// Mesmo desenho da simulação da Etapa 3: roda EXATAMENTE o corpo da migração
// dentro de uma função temporária, mede, e desfaz com uma exceção controlada.
// Além de CONTAR o que cada usuário ativo lê, mostra em quais unidades ele
// poderia inserir, alterar e apagar (I:/U:/D:), antes e depois.
//
// Uso: node scripts/seguranca/gerar-simulacao-1b.mjs [--verificar]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ORIGEM = path.join(raiz, "db/1b/02_rls_permissao_e_tabelas_filho.sql");
const DESTINO = path.join(raiz, "db/testes/simular_1b_02.sql");

export function tabelasDoMapa(fonte) {
  const ini = fonte.indexOf("/* <<MAPA_INICIO>>");
  const fim = fonte.indexOf("/* <<MAPA_FIM>> */");
  const bloco = fonte.slice(ini, fim);
  return [...new Set([...bloco.matchAll(/^\s*\('([a-z0-9_]+)'/gm)].map((m) => m[1]))].sort();
}

export function gerarSimulacao02(fonteBruta) {
  const fonte = fonteBruta.replace(/\r\n/g, "\n");
  const iFim = fonte.indexOf("/* <<FIM_DA_APLICACAO>>");
  if (iFim < 0) throw new Error("marca <<FIM_DA_APLICACAO>> não encontrada na migração 02");
  let corpo = fonte.slice(0, iFim);
  const iBegin = corpo.search(/^begin;\s*$/m);
  corpo = corpo.slice(iBegin).replace(/^begin;\s*\n/, "");
  if (corpo.includes("$corpo_1b02$")) throw new Error("o corpo não pode conter o marcador $corpo_1b02$");
  const tabelas = tabelasDoMapa(fonte);

  return `/*
  ARQUIVO GERADO por scripts/seguranca/gerar-simulacao-1b.mjs — não edite à mão.

  SIMULAÇÃO DA MIGRAÇÃO 1B-02 (DRY RUN) — PODE RODAR NO SUPABASE, NÃO GRAVA NADA.
  Rode DEPOIS da migração 01 e ANTES da 02.

  Roda o MESMO corpo de db/1b/02_rls_permissao_e_tabelas_filho.sql e desfaz
  tudo no fim. Para cada usuário ATIVO e cada tabela do mapa:
    ler_antes / ler_depois          quantas linhas ele enxerga (negado = sem privilégio)
    escrever_antes / escrever_depois  em quais unidades pode inserir (I), alterar (U)
                                      e apagar (D): "*" = todas, "-" = nenhuma,
                                      "antiga" = regra anterior sem mapa (não medida)
  Procure quem PERDEU leitura ou escrita de que precisa para trabalhar. Se houver,
  ajuste o perfil do usuário (ou o mapa, em scripts/seguranca/mapa-rls-curado.mjs)
  antes de aplicar a 02 de verdade.
*/

create temp table if not exists hefisto_matriz_1b02 (
  login text, perfil text, unidade text, tabela text,
  ler_antes text, ler_depois text, escrever_antes text, escrever_depois text,
  primary key (login, tabela)
);
truncate hefisto_matriz_1b02;

create or replace function pg_temp.hefisto_medir(p_fase text)
returns jsonb
language plpgsql
as $f$
declare
  u record;
  t text;
  c text;
  n text;
  v_unidades text[];
  v_escrita text;
  v_tabs constant text[] := array[${tabelas.map((t) => `'${t}'`).join(", ")}];
  v_regras jsonb := '{}'::jsonb;
  v_res jsonb := '{}'::jsonb;
begin
  /* Regras de escrita lidas ANTES de trocar de papel (o usuário não lê hefisto_privado). */
  foreach t in array v_tabs loop
    if to_regclass(format('public.%I', t)) is null then continue; end if;
    foreach c in array array['insert', 'update', 'delete'] loop
      if p_fase = 'depois' then
        v_regras := v_regras || jsonb_build_object(t || '|' || c, coalesce((
          select to_jsonb(m.permissoes) from hefisto_privado.mapa_rls_v2 m
          join hefisto_privado.rls_aplicado r on r.tabela = m.tabela and m.comando = any (r.comandos)
          where m.tabela = t and m.comando = c), 'null'::jsonb));
      elsif to_regclass('hefisto_privado.mapa_rls') is not null
            and exists (select 1 from hefisto_privado.mapa_rls m where m.tabela = t) then
        v_regras := v_regras || jsonb_build_object(t || '|' || c, coalesce((
          select to_jsonb(m.permissoes) from hefisto_privado.mapa_rls m where m.tabela = t and m.comando = c), 'null'::jsonb));
      elsif exists (select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t and p.policyname = 'hefisto_unidade') then
        v_regras := v_regras || jsonb_build_object(t || '|' || c, '["*escopo*"]'::jsonb);
      else
        v_regras := v_regras || jsonb_build_object(t || '|' || c, '"antiga"'::jsonb);
      end if;
    end loop;
  end loop;

  for u in
    select eu.auth_user_id, eu.login, coalesce(pa.codigo, '(sem perfil)') as perfil,
           coalesce(eu.unidade_principal_id, case when eu.super_admin then '*' else '(sem unidade)' end) as unidade
    from public.usuarios_erp eu
    left join public.perfis_acesso pa on pa.id = eu.perfil_id
    where eu.status = 'ativo'
    order by eu.login
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', u.auth_user_id, 'role', 'authenticated')::text, true);
    perform set_config('request.jwt.claim.sub', u.auth_user_id::text, true);
    execute 'set local role authenticated';
    foreach t in array v_tabs loop
      if to_regclass(format('public.%I', t)) is null then continue; end if;
      begin
        execute format('select count(*)::text from public.%I', t) into n;
      exception when insufficient_privilege then
        n := 'negado';
      end;
      v_escrita := '';
      foreach c in array array['insert', 'update', 'delete'] loop
        if v_regras -> (t || '|' || c) = '"antiga"'::jsonb then
          v_unidades := array['antiga'];
        elsif jsonb_typeof(v_regras -> (t || '|' || c)) is distinct from 'array' then
          v_unidades := array[]::text[];
        elsif v_regras -> (t || '|' || c) = '["*escopo*"]'::jsonb then
          v_unidades := public.hefisto_escopo_unidades();
        else
          v_unidades := public.hefisto_unidades_com_permissao(array(select jsonb_array_elements_text(v_regras -> (t || '|' || c))));
        end if;
        v_escrita := v_escrita || upper(left(c, 1)) || ':' ||
          case when cardinality(v_unidades) = 0 then '-' else array_to_string(v_unidades, ',') end || ' ';
      end loop;
      v_res := v_res || jsonb_build_object(u.login || '|' || u.perfil || '|' || u.unidade || '|' || t,
                                           jsonb_build_object('ler', n, 'escrever', trim(v_escrita)));
    end loop;
    execute 'reset role';
  end loop;
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  return v_res;
end;
$f$;

create or replace function pg_temp.hefisto_simular_1b02(p_corpo text)
returns void
language plpgsql
as $f$
declare
  v_antes jsonb;
  v_depois jsonb;
begin
  v_antes := pg_temp.hefisto_medir('antes');
  begin
    execute p_corpo;
    v_depois := pg_temp.hefisto_medir('depois');
    raise exception 'hefisto_simulacao_desfazer';
  exception when raise_exception then
    if sqlerrm <> 'hefisto_simulacao_desfazer' then raise; end if;
  end;
  insert into hefisto_matriz_1b02 (login, perfil, unidade, tabela, ler_antes, ler_depois, escrever_antes, escrever_depois)
  select split_part(a.key, '|', 1), split_part(a.key, '|', 2), split_part(a.key, '|', 3), split_part(a.key, '|', 4),
         a.value ->> 'ler', v_depois -> a.key ->> 'ler', a.value ->> 'escrever', v_depois -> a.key ->> 'escrever'
  from jsonb_each(v_antes) a;
end;
$f$;

select pg_temp.hefisto_simular_1b02($corpo_1b02$
${corpo}$corpo_1b02$);

select login, perfil, unidade, tabela, ler_antes, ler_depois, escrever_antes, escrever_depois,
       case when ler_antes is distinct from ler_depois or escrever_antes is distinct from escrever_depois then 'MUDOU' else '' end as mudou
from hefisto_matriz_1b02
order by login, tabela;
`;
}

const executadoDireto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const gerado = gerarSimulacao02(fs.readFileSync(ORIGEM, "utf8"));
  if (process.argv.includes("--verificar")) {
    const atual = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, "utf8").replace(/\r\n/g, "\n") : "";
    if (atual !== gerado) {
      console.error("db/testes/simular_1b_02.sql está desatualizado. Rode: node scripts/seguranca/gerar-simulacao-1b.mjs");
      process.exit(1);
    }
    console.log("simulação da 1B-02 em dia com a migração");
  } else {
    fs.writeFileSync(DESTINO, gerado);
    console.log("gerado:", path.relative(raiz, DESTINO));
  }
}
