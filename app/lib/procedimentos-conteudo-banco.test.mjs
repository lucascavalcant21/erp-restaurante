// SQL REAL da migração OP-CONTEUDO-1 num Postgres em memória (PGlite).
// Rode: PGLITE=<caminho de @electric-sql/pglite> node app/lib/procedimentos-conteudo-banco.test.mjs
// Sem PGLITE os testes NÃO rodam (o processo sai com código 2).

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
  console.log("PGLITE não informado: testes de banco do OP-CONTEUDO-1 NÃO executados.");
  process.exit(2);
}
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();

await pg.exec(`
  create table public.op_processos (id uuid primary key default gen_random_uuid(), unidade_id text, nome text, categoria text);
  create table public.op_itens (id uuid primary key default gen_random_uuid(), processo_id uuid, titulo text);
  insert into public.op_processos (unidade_id, nome, categoria) values ('casa', 'Montar a mesa', 'procedimento');
  insert into public.op_itens (titulo) values ('Limpar a mesa');
`);

const sql = fs.readFileSync(path.join(raiz, "db", "OP_CONTEUDO_1_FOTOS_VIDEOS_PROCEDIMENTOS.sql"), "utf8");
const res = await pg.exec(sql);
const digital = res.find((r) => r.rows?.[0]?.impressao_digital)?.rows?.[0]?.impressao_digital;
console.log(`     impressão digital: ${digital}`);

conferir("procedimento antigo ganha conteudo vazio", (await pg.query("select conteudo from public.op_processos")).rows[0].conteudo, {});
conferir("passo antigo ganha conteudo vazio", (await pg.query("select conteudo from public.op_itens")).rows[0].conteudo, {});
await pg.exec(`update public.op_itens set conteudo = '{"produto":"Desengordurante","quantidade":"50 ml","midias":[{"tipo":"video","url":"https://x/v.mp4"}]}'`);
conferir("passo guarda produto, quantidade e vídeo", (await pg.query("select conteudo->>'quantidade' as q from public.op_itens")).rows[0].q, "50 ml");
let erro = null;
try { await pg.exec(`update public.op_itens set conteudo = '[1,2]'`); } catch (e) { erro = e.message; }
conferir("lista no lugar de objeto é recusada", /op_itens_conteudo_objeto/.test(erro || ""), true);
erro = null;
try { await pg.exec(`update public.op_processos set conteudo = null`); } catch (e) { erro = e.message; }
conferir("conteudo nulo é recusado", /null/.test(erro || ""), true);
let repetida = null;
try { await pg.exec(sql); } catch (e) { repetida = e.message; }
conferir("rodar de novo aborta no preflight", /já existe/.test(repetida || ""), true);
conferir("impressão digital", digital, "09d81d652d476b94c5b327e76440869b");

console.log(falhas ? `\n${falhas} falha(s).` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
