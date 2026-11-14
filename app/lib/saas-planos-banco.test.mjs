// SQL REAL da migração SAAS-PLANOS-1 num Postgres em memória (PGlite). Rode com:
//   PGLITE=<caminho de @electric-sql/pglite> node app/lib/saas-planos-banco.test.mjs
// Sem PGLITE os testes NÃO rodam (o processo sai com código 2).
//
// Esquema mínimo copiado do banco real (14/11/2026): empresas (id uuid),
// unidades (id text, empresa_id uuid) e usuarios_erp (auth_user_id,
// unidade_principal_id, status).

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
  console.log("PGLITE não informado: testes de banco da SAAS-PLANOS-1 NÃO executados.");
  process.exit(2);
}

const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

const EMP_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"; // a casa do dono
const EMP_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"; // cliente novo (depois da migração)
const U_A = "11111111-1111-1111-1111-111111111111";
const U_B = "22222222-2222-2222-2222-222222222222";
const U_INATIVO = "33333333-3333-3333-3333-333333333333";

await pg.exec(`
  create role anon nologin; create role authenticated nologin;
  create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;

  create table public.empresas (id uuid primary key, nome text, documento text, ativo boolean default true, created_at timestamptz default now());
  create table public.unidades (id text primary key, nome text, empresa_id uuid references public.empresas(id));
  create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid, unidade_principal_id text, status text);
  insert into public.empresas (id, nome) values ('${EMP_A}', 'Sel de Estrela');
  insert into public.unidades values ('seldeestrela', 'Sel de Estrela', '${EMP_A}');
  insert into public.usuarios_erp (auth_user_id, unidade_principal_id, status) values
    ('${U_A}', 'seldeestrela', 'ativo'), ('${U_INATIVO}', 'seldeestrela', 'inativo');
`);

const sql = fs.readFileSync(path.join(raiz, "db", "SAAS_PLANOS_1_ASSINATURA.sql"), "utf8");
const res = await pg.exec(sql);
const verificacao = res.at(-2)?.rows?.[0] || res.find((r) => r.rows?.[0]?.impressao_digital)?.rows?.[0];
conferir("verificação: nenhuma empresa sem assinatura", Number(verificacao?.empresas_sem_assinatura), 0);
console.log(`     impressão digital: ${verificacao?.impressao_digital}`);

// Cliente novo depois da migração: plano Grátis.
await pg.exec(`
  insert into public.empresas (id, nome) values ('${EMP_B}', 'Outro restaurante');
  insert into public.unidades values ('outro', 'Outro', '${EMP_B}');
  insert into public.usuarios_erp (auth_user_id, unidade_principal_id, status) values ('${U_B}', 'outro', 'ativo');
  insert into public.empresa_assinatura (empresa_id, plano, situacao) values ('${EMP_B}', 'gratis', 'ativa');
`);

async function comoUsuario(uid, consulta) {
  await pg.exec("begin");
  try {
    await pg.exec(`set local role authenticated; select set_config('request.jwt.claim.sub', '${uid}', true);`);
    const r = await pg.query(consulta);
    return { linhas: r.rows };
  } catch (e) {
    return { erro: e.message };
  } finally {
    await pg.exec("rollback");
  }
}

const a = await comoUsuario(U_A, "select public.hefisto_minha_assinatura() as r");
conferir("a casa do dono fica no Completo por cortesia", a.linhas?.[0]?.r, { plano: "completo", situacao: "cortesia", periodicidade: "mensal", forma_pagamento: null, proximo_vencimento: null, valor_mensal_centavos: null });

const b = await comoUsuario(U_B, "select public.hefisto_minha_assinatura() as r");
conferir("cliente novo vê só a assinatura da empresa dele", b.linhas?.[0]?.r?.plano, "gratis");

const inativo = await comoUsuario(U_INATIVO, "select public.hefisto_minha_assinatura() as r");
conferir("usuário inativo não vê assinatura", inativo.linhas?.[0]?.r, null);

const direto = await comoUsuario(U_A, "select * from public.empresa_assinatura");
conferir("o app não lê a tabela direto (sem grant)", /permission denied/i.test(direto.erro || ""), true);

const grava = await comoUsuario(U_B, `update public.empresa_assinatura set plano = 'completo' where empresa_id = '${EMP_B}'`);
conferir("o cliente não se promove sozinho para o Completo", /permission denied/i.test(grava.erro || ""), true);

await pg.exec("begin");
let anonErro = null;
try {
  await pg.exec("set local role anon");
  await pg.query("select public.hefisto_minha_assinatura()");
} catch (e) { anonErro = e.message; }
await pg.exec("rollback");
conferir("visitante sem login não chama a função", /permission denied/i.test(anonErro || ""), true);

const plano = await pg.query(`select count(*)::int as n from public.empresa_assinatura where plano not in ('gratis','completo')`);
conferir("só existem os dois planos", plano.rows[0].n, 0);
let invalido = null;
try { await pg.exec(`update public.empresa_assinatura set plano = 'PRO' where empresa_id = '${EMP_B}'`); } catch (e) { invalido = e.message; }
conferir("plano fora da lista é recusado pelo banco", /check/i.test(invalido || ""), true);

let forma = null;
try { await pg.exec(`update public.empresa_assinatura set forma_pagamento = 'boleto' where empresa_id = '${EMP_B}'`); } catch (e) { forma = e.message; }
conferir("forma de pagamento fora de crédito, débito e Pix é recusada", /check/i.test(forma || ""), true);
await pg.exec(`update public.empresa_assinatura set periodicidade = 'anual', forma_pagamento = 'pix' where empresa_id = '${EMP_B}'`);
const anual = await comoUsuario(U_B, "select public.hefisto_minha_assinatura() as r");
conferir("assinatura anual no Pix aparece para o cliente", [anual.linhas?.[0]?.r?.periodicidade, anual.linhas?.[0]?.r?.forma_pagamento], ["anual", "pix"]);

let repetida = null;
try { await pg.exec(sql); } catch (e) { repetida = e.message; }
conferir("rodar de novo aborta no preflight sem mudar nada", /já existe/.test(repetida || ""), true);

console.log(falhas ? `\n${falhas} falha(s).` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
