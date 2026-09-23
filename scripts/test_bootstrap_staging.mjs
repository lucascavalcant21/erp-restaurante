/* Aplica db/staging/0001 e 0002 num Postgres descartável (PGlite) e confere que
   o staging fica pronto para o agente: tabelas, funções, contexto de sessão,
   isolamento por unidade e as consultas que cada ferramenta faz.

   Não toca em banco nenhum de verdade. Classificação: UNIT_TESTED.

   Uso: node scripts/test_bootstrap_staging.mjs <caminho do @electric-sql/pglite>
   A última linha diz RESULTADO: OK ou RESULTADO: FALHOU.
*/
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PGLITE = process.argv[2];
if (!PGLITE) { console.error("Informe o caminho do @electric-sql/pglite."); process.exit(2); }
const { PGlite } = await import(pathToFileURL(path.join(PGLITE, "dist/index.js")).href);
const db = await PGlite.create();

let total = 0, falhas = 0;
const conferir = (titulo, obtido, esperado) => {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${titulo}${ok ? "" : `\n      esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`}`);
};
const uma = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const varias = async (sql, params = []) => (await db.query(sql, params)).rows;

/* ── Ambiente Supabase de mentira: papéis e o schema auth ────────────────── */
const UID_TESTE = "dddddddd-dddd-4ddd-8ddd-000000000001";
const UID_ESTRANHO = "eeeeeeee-eeee-4eee-8eee-000000000002";
await db.exec(`
  create role authenticated;
  create role service_role bypassrls;
  create role anon;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  insert into auth.users values ('${UID_TESTE}', 'teste.hefisto@exemplo.local'),
                                ('${UID_ESTRANHO}', 'estranho@exemplo.local');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('teste.uid', true), '')::uuid
  $$;
  grant usage on schema auth, public to authenticated, service_role, anon;
  grant execute on function auth.uid() to authenticated, service_role, anon;
`);

/* ── 1. O bootstrap roda inteiro, e roda duas vezes ──────────────────────── */
const bootstrap = fs.readFileSync(path.join(RAIZ, "db", "staging", "0001_bootstrap_estrutura_staging.sql"), "utf8");
const seed = fs.readFileSync(path.join(RAIZ, "db", "staging", "0002_seed_sintetico_staging.sql"), "utf8");
await db.exec(bootstrap);
conferir("1. bootstrap aplica num banco vazio", true, true);
await db.exec(seed);
await db.exec(bootstrap);
await db.exec(seed);
conferir("2. rodar bootstrap e seed de novo não quebra nem duplica",
  Number((await uma("select count(*)::int as n from insumos")).n), 5);

/* ── 2. Estrutura ────────────────────────────────────────────────────────── */
const tabelas = (await varias(`
  select table_name from information_schema.tables
  where table_schema='public' and table_name in
    ('empresas','unidades','setores','perfis_acesso','perfil_permissoes','usuarios_erp',
     'usuario_permissoes','usuario_escopos','insumos','estoque_atual','fichas_tecnicas',
     'fichas_ingredientes','produtos','colaboradores','producao_diaria','registro_ponto',
     'contas_pagar','lancamentos')
  order by 1`)).map(r => r.table_name);
conferir("3. as 18 tabelas do ERP mínimo existem", tabelas.length, 18);

const funcoes = (await varias(`
  select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and proname like 'hefisto\\_%' order by 1`)).map(r => r.proname);
conferir("4. funções de autorização criadas", funcoes, [
  "hefisto_permission_match", "hefisto_session_context", "hefisto_user_can",
  "hefisto_user_has_permission", "hefisto_user_in_company", "hefisto_user_in_unit_strict",
]);

/* ── 3. Usuário de teste (o 0003, com o e-mail do seed) ──────────────────── */
const usuarioDeTeste = fs.readFileSync(path.join(RAIZ, "db", "staging", "0003_usuario_de_teste.sql"), "utf8")
  .split("/* ── CONFERÊNCIA")[0];
await db.exec(usuarioDeTeste);
const cadastro = await uma(`
  select u.login, u.status, u.tipo_acesso, u.unidade_principal_id, u.super_admin,
         (select count(*)::int from usuario_escopos e where e.usuario_id=u.id) as escopos,
         (select count(*)::int from perfil_permissoes pp where pp.perfil_id=u.perfil_id) as permissoes
  from usuarios_erp u`);
conferir("5. usuário de teste ligado ao Auth, sem super_admin", cadastro,
  { login: "teste.hefisto", status: "ativo", tipo_acesso: "gerente", unidade_principal_id: "unidade-teste-a", super_admin: false, escopos: 1, permissoes: 8 });

/* ── 4. hefisto_session_context ──────────────────────────────────────────── */
const comoUsuario = async (uid) => { await db.exec(`select set_config('teste.uid', '${uid}', false);`); };
await comoUsuario(UID_TESTE);
const ctx = (await uma("select hefisto_session_context() as c")).c;
conferir("6. session_context devolve papel, unidade e permissões",
  [ctx?.papel, ctx?.unidade, ctx?.status, Array.isArray(ctx?.permissions) ? ctx.permissions.length : ctx?.permissions],
  ["gerente", "unidade-teste-a", "ativo", 8]);
await comoUsuario(UID_ESTRANHO);
conferir("7. login sem cadastro no ERP não recebe contexto", (await uma("select hefisto_session_context() as c")).c, null);
await db.exec("update usuarios_erp set status='bloqueado'");
await comoUsuario(UID_TESTE);
conferir("8. usuário bloqueado não recebe contexto", (await uma("select hefisto_session_context() as c")).c, null);
await db.exec("update usuarios_erp set status='ativo'");

/* ── 5. Isolamento por unidade ───────────────────────────────────────────── */
await comoUsuario(UID_TESTE);
conferir("9. enxerga a unidade dele e não a outra",
  [(await uma("select hefisto_user_in_unit_strict(auth.uid(),'unidade-teste-a') as v")).v,
   (await uma("select hefisto_user_in_unit_strict(auth.uid(),'unidade-teste-b') as v")).v,
   (await uma("select hefisto_user_in_unit_strict(auth.uid(), null) as v")).v],
  [true, false, false]);

/* ── 6. As consultas que cada ferramenta do agente faz, como authenticated ─ */
const comoAuthenticated = async (sql, params = []) => {
  await db.exec("set role authenticated;");
  try { return (await db.query(sql, params)).rows; }
  finally { await db.exec("reset role;"); }
};
await comoUsuario(UID_TESTE);

const criticos = await comoAuthenticated(`
  select i.nome, e.quantidade_atual, i.estoque_minimo
  from insumos i left join estoque_atual e on e.insumo_id = i.id
  where i.unidade_id = 'unidade-teste-a' and i.estoque_minimo > 0 and coalesce(e.quantidade_atual,0) < i.estoque_minimo`);
conferir("10. tool estoque_critico enxerga os itens em falta", criticos.length, 2);

const umProduto = await comoAuthenticated(`select nome from insumos where unidade_id='unidade-teste-a' and nome ilike '%arroz%'`);
conferir("11. tool consultar_estoque_produto acha pelo nome", umProduto.length, 1);

const producao = await comoAuthenticated(`
  select p.quantidade, f.nome_receita, c.nome
  from producao_diaria p
  left join fichas_tecnicas f on f.id = p.ficha_id
  left join colaboradores c on c.id = p.colaborador_id
  where p.unidade_id='unidade-teste-a' and p.created_at >= date_trunc('day', now())`);
conferir("12. tool producao_do_dia enxerga a produção de hoje", producao.length, 1);

const equipe = await comoAuthenticated(`
  select c.nome from registro_ponto r join colaboradores c on c.id = r.colaborador_id
  where r.unidade_id='unidade-teste-a' and r.data_referencia = current_date and r.entrada is not null and r.saida is null`);
conferir("13. tools equipe_trabalhando e pendencias_de_ponto enxergam a jornada aberta", equipe.length, 1);

const vencidas = await comoAuthenticated(`
  select valor from contas_pagar where unidade_id='unidade-teste-a' and data_vencimento < current_date and status <> 'pago'`);
conferir("14. tool contas_vencidas enxerga as vencidas em aberto", vencidas.length, 2);

const fichas = await comoAuthenticated(`
  select f.nome_receita, count(fi.id)::int as itens
  from fichas_tecnicas f left join fichas_ingredientes fi on fi.ficha_id = f.id
  where f.unidade_id='unidade-teste-a' and f.eh_base = false
  group by 1 order by 1`);
conferir("15. tool cmv_das_fichas enxerga pratos com ingredientes",
  fichas.map(f => [f.nome_receita, f.itens]), [["Caipirinha (teste)", 2], ["Filé com arroz (teste)", 2]]);

const precos = await comoAuthenticated(`select preco_venda from produtos where unidade_id='unidade-teste-a' and preco_venda is not null`);
conferir("16. o cardápio tem preço para o CMV ter denominador", precos.length, 2);

const caixa = await comoAuthenticated(`
  select tipo, sum(valor)::numeric as total from lancamentos
  where unidade_id='unidade-teste-a' and data >= date_trunc('month', current_date)::date
  group by 1 order by 1`);
conferir("17. tool resultado_financeiro enxerga entradas e saídas",
  caixa.map(l => l.tipo), ["entrada", "saida"]);

/* ── 7. O RLS está mesmo isolando ────────────────────────────────────────── */
await comoUsuario(UID_ESTRANHO);
const doEstranho = await comoAuthenticated(`select id from insumos`);
conferir("18. quem não é da unidade não lê linha nenhuma", doEstranho.length, 0);
const anonInsumos = await (async () => {
  await db.exec("set role anon;");
  try { return (await db.query("select id from insumos")).rows.length; }
  catch { return "sem permissão"; }
  finally { await db.exec("reset role;"); }
})();
conferir("19. anon não lê o estoque", anonInsumos, "sem permissão");

await comoUsuario(UID_TESTE);
const tentouEscrever = await (async () => {
  await db.exec("set role authenticated;");
  try { await db.exec("update usuarios_erp set super_admin = true"); } catch { /* sem grant */ }
  finally { await db.exec("reset role;"); }
  return (await uma("select bool_or(super_admin) as v from usuarios_erp")).v;
})();
conferir("20. usuário comum não se promove no staging", tentouEscrever, false);

console.log(`\n${total - falhas}/${total} verificações passaram.`);
console.log(falhas ? "RESULTADO: FALHOU" : "RESULTADO: OK");
process.exit(falhas ? 1 : 0);
