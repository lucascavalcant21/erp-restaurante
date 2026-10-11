// Migrações propostas do estoque (HDEV-EST-001) num Postgres em memória:
// db/EST_UNI_1 (unidade de compra) e db/EST_LOCAL_1 (local Salão).
// Confere: aplicar, reaplicar (idempotente / aborta sem mudar), dado antigo
// intacto, leitura do app antes e depois, e rollback.
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/estoque-migracoes.test.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : `\n      obtido:   ${JSON.stringify(obtido)}\n      esperado: ${JSON.stringify(esperado)}`}`);
};

if (!process.env.PGLITE) {
  console.log("PGLITE não informado: migrações NÃO testadas.");
  process.exit(1);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
const sql = (arq) => fs.readFileSync(path.join(raiz, "db", arq), "utf8");
const linhas = async (q) => (await pg.query(q)).rows;
const tenta = async (q) => { try { await pg.exec(q); return null; } catch (e) { await pg.exec("rollback").catch(() => {}); return e.message; } };

// Esquema mínimo, com as colunas e restrições de produção (auditoria 11/10/2026)
await pg.exec(`
  do $r$ begin create role anon; exception when duplicate_object then null; end $r$;
  do $r$ begin create role authenticated; exception when duplicate_object then null; end $r$;
  create table public.unidades (id text primary key);
  insert into public.unidades values ('seldeestrela');
  create table public.insumos (id uuid primary key default gen_random_uuid(), unidade_id text, nome text,
    unidade_medida text, unidade_comercial text, tamanho_embalagem numeric, conta_por_embalagem boolean);
  insert into public.insumos (unidade_id, nome, unidade_medida, unidade_comercial, tamanho_embalagem, conta_por_embalagem)
    values ('seldeestrela', 'Corona', 'ml', 'garrafa', 330, true), ('seldeestrela', 'Sal', 'kg', null, null, null);
  create table public.estoques (id uuid primary key default gen_random_uuid(), unidade_id text references public.unidades(id) on delete cascade,
    nome text, slug text, tipo text check (tipo in ('alimentos','bebidas','limpeza','materiais','embalagens')), descricao text,
    status text default 'ativo' check (status in ('ativo','inativo')), cor text default '#059669', icone text, permissoes jsonb default '[]',
    controla_validade boolean default false, controla_minimo boolean default true, locais_internos text[] default '{}', ordem int default 0,
    created_at timestamptz default now(), updated_at timestamptz default now(), unique (unidade_id, slug));
  insert into public.estoques (unidade_id, nome, slug, tipo) values
    ('seldeestrela','Bar','bar','bebidas'), ('seldeestrela','Pré-preparos do Salão','pre-preparos-salao','alimentos'),
    ('seldeestrela','Depósito','deposito','materiais');
  create table public.estoque_itens (id uuid primary key default gen_random_uuid(), estoque_id uuid, insumo_id uuid, quantidade_atual numeric);
  create table public.estoque_movimentacoes_multi (id uuid primary key default gen_random_uuid(), estoque_id uuid, estoque_destino_id uuid);
  insert into public.estoque_itens (estoque_id, insumo_id, quantidade_atual)
    select e.id, i.id, 3960 from public.estoques e, public.insumos i where e.slug = 'bar' and i.nome = 'Corona';
`);
const antesInsumos = await linhas("select id, nome, unidade_medida, tamanho_embalagem from public.insumos order by nome");
const antesItens = await linhas("select estoque_id, insumo_id, quantidade_atual from public.estoque_itens");

// ── EST-UNI-1 ────────────────────────────────────────────────────────────────
conferir("app antes da migração: coluna nova ausente (cai no fallback colunaAusente)",
  /column .* does not exist/i.test(String(await tenta("select unidade_compra from public.insumos"))), true);
conferir("EST-UNI-1 aplica sem erro", await tenta(sql("EST_UNI_1_UNIDADE_DE_COMPRA.sql")), null);
conferir("EST-UNI-1 reaplicada: idempotente", await tenta(sql("EST_UNI_1_UNIDADE_DE_COMPRA.sql")), null);
conferir("backup de insumos feito antes, com RLS ligado", await linhas("select (select count(*)::int from public.backup_insumos_est_uni_1_20261011) n, (select relrowsecurity from pg_class where relname = 'backup_insumos_est_uni_1_20261011') rls"), [{ n: 2, rls: true }]);
conferir("colunas novas nascem nulas", await linhas("select nome, unidade_compra, fator_compra from public.insumos order by nome"),
  [{ nome: "Corona", unidade_compra: null, fator_compra: null }, { nome: "Sal", unidade_compra: null, fator_compra: null }]);
conferir("cadastro e saldo existentes intactos",
  [await linhas("select id, nome, unidade_medida, tamanho_embalagem from public.insumos order by nome"), await linhas("select estoque_id, insumo_id, quantidade_atual from public.estoque_itens")],
  [antesInsumos, antesItens]);
conferir("fator 12 aceito", await tenta("update public.insumos set unidade_compra = 'caixa', fator_compra = 12 where nome = 'Corona'"), null);
conferir("fator 0 recusado pela restrição", /insumos_fator_compra_positivo/.test(String(await tenta("update public.insumos set fator_compra = 0 where nome = 'Sal'"))), true);
await pg.exec("update public.insumos set unidade_compra = null, fator_compra = null");
conferir("rollback EST-UNI-1 remove só as duas colunas",
  [await tenta("alter table public.insumos drop column if exists fator_compra, drop column if exists unidade_compra"),
   await linhas("select id, nome, unidade_medida, tamanho_embalagem from public.insumos order by nome")], [null, antesInsumos]);

// ── EST-LOCAL-1 ──────────────────────────────────────────────────────────────
conferir("EST-LOCAL-1 aplica sem erro", await tenta(sql("EST_LOCAL_1_SALAO.sql")), null);
conferir("backup de estoques feito antes do Salão (3 locais), com RLS", await linhas("select (select count(*)::int from public.backup_estoques_est_local_1_20261011) n, (select relrowsecurity from pg_class where relname = 'backup_estoques_est_local_1_20261011') rls"), [{ n: 3, rls: true }]);
conferir("Salão criado vazio, tipo materiais", await linhas("select nome, slug, tipo, status from public.estoques where slug = 'salao'"),
  [{ nome: "Salão", slug: "salao", tipo: "materiais", status: "ativo" }]);
conferir("reaplicar aborta sem duplicar", [/já existe um local Salão/.test(String(await tenta(sql("EST_LOCAL_1_SALAO.sql")))),
  (await linhas("select count(*)::int n from public.estoques where slug = 'salao'"))[0].n], [true, 1]);
conferir("locais e saldos existentes intactos", [(await linhas("select count(*)::int n from public.estoques"))[0].n,
  await linhas("select estoque_id, insumo_id, quantidade_atual from public.estoque_itens")], [4, antesItens]);
const rollbackLocal = `delete from public.estoques e where e.unidade_id = 'seldeestrela' and e.slug = 'salao'
  and not exists (select 1 from public.estoque_itens i where i.estoque_id = e.id)
  and not exists (select 1 from public.estoque_movimentacoes_multi m where m.estoque_id = e.id or m.estoque_destino_id = e.id)`;
await pg.exec(`insert into public.estoque_itens (estoque_id, insumo_id, quantidade_atual) select e.id, i.id, 5 from public.estoques e, public.insumos i where e.slug = 'salao' and i.nome = 'Sal'`);
await pg.exec(rollbackLocal);
conferir("rollback NÃO apaga o Salão se já tem produto", (await linhas("select count(*)::int n from public.estoques where slug = 'salao'"))[0].n, 1);
await pg.exec("delete from public.estoque_itens where quantidade_atual = 5");
await pg.exec(rollbackLocal);
conferir("rollback apaga o Salão vazio", (await linhas("select count(*)::int n from public.estoques where slug = 'salao'"))[0].n, 0);

console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os casos passaram.");
process.exitCode = falhas ? 1 : 0;
