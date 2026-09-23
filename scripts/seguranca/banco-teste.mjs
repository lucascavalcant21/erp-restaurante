// Banco de teste compartilhado pelos testes de migração (PGlite, Postgres 18 em
// WebAssembly). Monta a base que reproduz a produção de 16/09/2026, roda o
// controle de acesso real e aplica as migrações até a etapa pedida.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const ler = (rel) => fs.readFileSync(path.join(raiz, rel), "utf8");

async function carregarPGlite() {
  if (process.env.PGLITE_DIR) {
    return (await import(pathToFileURL(path.join(process.env.PGLITE_DIR, "dist/index.js")).href)).PGlite;
  }
  try {
    return (await import("@electric-sql/pglite")).PGlite;
  } catch {
    throw new Error("PGlite não encontrado. Rode: npm i --no-save @electric-sql/pglite@0.5.8 (ou defina PGLITE_DIR).");
  }
}
export const PGlite = await carregarPGlite();

export const SQL = {
  base: ler("db/testes/base_simulada_supabase.sql"),
  rbac: ler("docs/controle-acesso-rbac.sql").replace(/create extension if not exists pgcrypto;/i, ""),
  dados: ler("db/testes/dados_simulados.sql"),
  etapa1: ler("db/migracao_hotfix_anon.sql"),
  etapa2: ler("db/migracao_hotfix_anon_etapa2_revogar.sql"),
  etapa3: ler("db/migracao_rbac_tabelas_sensiveis.sql"),
  simulacao3: ler("db/testes/simular_rbac_etapa3.sql"),
  rollback1: ler("db/rollback_hotfix_anon_etapa1.sql"),
  rollback2: ler("db/rollback_hotfix_anon_etapa2.sql"),
  rollback3: ler("db/rollback_rbac_tabelas_sensiveis.sql"),
  m01: ler("db/1b/01_contexto_escopo_concessao.sql"),
  r01: ler("db/1b/rollback_01_contexto_escopo_concessao.sql"),
};
const opcional = (rel) => (fs.existsSync(path.join(raiz, rel)) ? ler(rel) : null);
Object.assign(SQL, {
  m02: opcional("db/1b/02_rls_permissao_e_tabelas_filho.sql"),
  r02: opcional("db/1b/rollback_02_rls_permissao_e_tabelas_filho.sql"),
  simulacao02: opcional("db/testes/simular_1b_02.sql"),
  m03: opcional("db/1b/03_biometria_e_ponto_isolados.sql"),
  r03: opcional("db/1b/rollback_03_biometria_e_ponto_isolados.sql"),
  m04: opcional("db/1b/04_biometria_limpeza.sql"),
  r04: opcional("db/1b/rollback_04_biometria_limpeza.sql"),
});

export const USUARIO = {
  super: "00000000-0000-0000-0000-000000000001",
  gerenteA: "00000000-0000-0000-0000-000000000002",
  garcomA: "00000000-0000-0000-0000-000000000003",
  rhA: "00000000-0000-0000-0000-000000000004",
  pontoA: "00000000-0000-0000-0000-000000000005",
  legado: "00000000-0000-0000-0000-000000000006",
  financeiroB: "00000000-0000-0000-0000-000000000007",
  cozinhaA: "00000000-0000-0000-0000-000000000008",
  adminEmpresa: "00000000-0000-0000-0000-000000000009",
  gerenteB: "00000000-0000-0000-0000-000000000010",
  quiosqueA: "00000000-0000-0000-0000-000000000011",
  semPerfil: "00000000-0000-0000-0000-000000000012",
  autocadastro: "00000000-0000-0000-0000-000000000013",
  financeiroA: "00000000-0000-0000-0000-000000000014",
};

export const ORDEM = ["etapa1", "etapa2", "etapa3", "m01", "m02", "m03", "m04"];

export async function novoBanco(ate) {
  const db = new PGlite();
  await db.exec(SQL.base);
  await db.exec(SQL.rbac);
  await db.exec(SQL.dados);
  if (ate) for (const etapa of ORDEM.slice(0, ORDEM.indexOf(ate) + 1)) await db.exec(SQL[etapa]);
  return db;
}

/**
 * Executa como anon, como um usuário (authenticated com o JWT dele) ou como
 * service_role. `cabecalhos` simula o request.headers que o PostgREST repassa.
 */
export async function como(db, quem, sql, { cabecalhos = null } = {}) {
  const papel = quem === "anon" ? "anon" : quem === "servico" ? "service_role" : "authenticated";
  const claims = quem === "anon" || quem === "servico" ? "" : JSON.stringify({ sub: USUARIO[quem] });
  const headers = cabecalhos ? JSON.stringify(cabecalhos).replace(/'/g, "''") : "";
  await db.exec(`reset role; select set_config('request.jwt.claims', '${claims}', false); select set_config('request.headers', '${headers}', false); set role ${papel};`);
  try {
    const r = await db.query(sql);
    return { ok: true, linhas: r.rows, afetadas: r.affectedRows };
  } catch (e) {
    return { ok: false, erro: e.message };
  } finally {
    await db.exec("reset role;");
  }
}

export const contar = async (db, quem, tabela) => {
  const r = await como(db, quem, `select count(*)::int as n from public.${tabela}`);
  return r.ok ? r.linhas[0].n : (/permission denied/.test(r.erro) ? "negado" : `erro: ${r.erro}`);
};

export const relatorio = (resultado) => resultado[resultado.length - 1].rows;
