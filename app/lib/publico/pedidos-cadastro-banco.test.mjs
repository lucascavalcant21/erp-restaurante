// SQL REAL da PUB-1 (pedidos de cadastro da página inicial) em PGlite.
// Rode com PGLITE=<caminho de @electric-sql/pglite>. Sem PGLITE, sai com 2.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { clienteSupabase } from "../teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
if (!process.env.PGLITE) { console.log("PGLITE não informado: testes NÃO executados."); process.exit(2); }
let falhas = 0;
const conferir = (nome, obtido, esperado) => {
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${nome}${ok ? "" : ` obtido ${JSON.stringify(obtido)} esperado ${JSON.stringify(esperado)}`}`);
};
const { PGlite } = await import(pathToFileURL(path.join(process.env.PGLITE, "dist", "index.js")).href);
const pg = new PGlite();
const DONO = "bddf8616-ce7c-4f0d-a48e-f478ec14ddc4", CLIENTE = "44444444-4444-4444-4444-444444444444";
await pg.exec(`
  create role anon nologin; create role authenticated nologin; create schema auth;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated; grant usage on schema public to anon, authenticated;
`);
const sql = fs.readFileSync(path.join(raiz, "db", "publico", "PUB_1_PEDIDOS_CADASTRO.sql"), "utf8");
await pg.exec(sql);
await pg.exec(sql);
conferir("rodar de novo não quebra nem duplica o dono", (await pg.query("select count(*)::int n from public.hefisto_admins_plataforma")).rows[0].n, 1);

const anon = clienteSupabase(pg, { uid: "" });
const dono = clienteSupabase(pg, { uid: DONO });
const cliente = clienteSupabase(pg, { uid: CLIENTE });
const pedido = (extra = {}) => ({ p_area: "consultorio", p_plano: "gratis", p_nome: "Ana Lima", p_whatsapp: "(81) 99999-0000",
  p_email: " Ana@Exemplo.com ", p_negocio: "Clínica Ana", p_cidade: "Recife", p_mensagem: "Quero testar", p_aceite: true, ...extra });

let r = await anon.rpc("hefisto_pedir_cadastro", pedido());
conferir("sem login: pede cadastro", r.data, { ok: true });
r = await anon.rpc("hefisto_pedir_cadastro", pedido({ p_aceite: false, p_whatsapp: "81988887777", p_email: "b@b.com" }));
conferir("sem o aceite não grava", r.data, { ok: false, erro: "aceite" });
r = await anon.rpc("hefisto_pedir_cadastro", pedido({ p_area: "banco", p_whatsapp: "81988887777", p_email: "b@b.com" }));
conferir("área desconhecida é recusada", r.data, { ok: false, erro: "area" });
r = await anon.rpc("hefisto_pedir_cadastro", pedido({ p_whatsapp: "123", p_email: "b@b.com" }));
conferir("WhatsApp inválido é recusado", r.data, { ok: false, erro: "whatsapp" });
r = await anon.rpc("hefisto_pedir_cadastro", pedido({ p_whatsapp: "81988887777", p_email: "sem-arroba" }));
conferir("e-mail inválido é recusado", r.data, { ok: false, erro: "email" });
r = await anon.rpc("hefisto_pedir_cadastro", pedido({ p_email: "outro@x.com" }));
conferir("mesmo WhatsApp em 24 h: responde ok sem gravar de novo", r.data, { ok: true });

r = await anon.from("hefisto_pedidos_cadastro").select("id");
conferir("sem login não lê os pedidos", [!!r.error || (r.data?.length ?? 0) === 0], [true]);
r = await anon.from("hefisto_pedidos_cadastro").insert({ area: "eventos", nome: "Direto", whatsapp: "81977776666", email: "d@d.com", consentimento: "x" });
conferir("sem login não grava direto na tabela", !!r.error, true);
r = await cliente.from("hefisto_pedidos_cadastro").select("id");
conferir("login de empresa cliente não lê os pedidos", r.data?.length ?? 0, 0);
r = await cliente.from("hefisto_admins_plataforma").select("auth_user_id");
conferir("login comum não lê a lista de administradores", !!r.error || (r.data?.length ?? 0) === 0, true);

r = await dono.from("hefisto_pedidos_cadastro").select("id, area, whatsapp, email, status, consentimento");
conferir("dono da plataforma lê: um pedido, normalizado", r.data?.map((p) => [p.area, p.whatsapp, p.email, p.status]), [["consultorio", "81999990000", "ana@exemplo.com", "novo"]]);
conferir("o aceite fica guardado com o texto", /Aceito que o Héfisto/.test(r.data?.[0]?.consentimento || ""), true);
const ID = r.data?.[0]?.id;
r = await dono.from("hefisto_pedidos_cadastro").update({ status: "em_contato", observacao: "Liguei" }).eq("id", ID).select("status, atualizado_por");
conferir("dono muda o status (e fica registrado quem mudou)", [r.error, r.data?.[0]?.status, r.data?.[0]?.atualizado_por], [null, "em_contato", DONO]);
r = await dono.from("hefisto_pedidos_cadastro").update({ email: "trocado@x.com" }).eq("id", ID);
conferir("nem o dono troca os dados que a pessoa mandou", !!r.error, true);
r = await cliente.from("hefisto_pedidos_cadastro").update({ status: "descartado" }).eq("id", ID).select("id");
conferir("login de empresa cliente não muda status", r.data?.length ?? 0, 0);
r = await anon.rpc("hefisto_eh_admin_plataforma", {});
conferir("sem login a checagem de administrador nem roda", !!r.error, true);

await pg.exec("reset role");
await pg.exec(`insert into public.hefisto_pedidos_cadastro (area, nome, whatsapp, email, consentimento)
  select 'eventos', 'Lote ' || g, '8197777' || lpad(g::text, 4, '0'), 'l' || g || '@x.com', 'x' from generate_series(1, 60) g`);
r = await anon.rpc("hefisto_pedir_cadastro", pedido({ p_whatsapp: "81911112222", p_email: "novo@x.com" }));
conferir("enxurrada (60 na última hora): segura novos pedidos", r.data, { ok: false, erro: "ocupado" });

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTodos os casos passaram.");
process.exit(falhas ? 1 : 0);
