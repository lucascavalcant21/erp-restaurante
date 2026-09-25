/* Chama os HANDLERS REAIS de /exportar-afd, /exportar-aej e
   /api/comprovante-email e confere o contrato de status.

   Sem rede: o caminho "sem sessão" decide antes de qualquer consulta, então o
   Supabase nunca é chamado. As variáveis abaixo existem só para o cliente de
   servidor conseguir ser construído — a chave é falsa de propósito e não
   autentica nada.

   next/server nao resolve em Node puro, entao o hook em scripts/stub-next-server.mjs
   o substitui. Uso:

     node --import "data:text/javascript,import{register}from'node:module';import{pathToFileURL}from'node:url';register('./scripts/stub-next-server.mjs',pathToFileURL('./'));" scripts/test_rotas_exportacao_protegidas.mjs
*/
process.env.HEFISTO_ENV = "test";
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-falsa-so-para-construir-o-cliente";

let total = 0, falhas = 0;
const conferir = (titulo, obtido, esperado) => {
  total++;
  const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
  if (!ok) falhas++;
  console.log(`${ok ? "ok  " : "FALHA"} ${titulo}${ok ? "" : `  (esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)})`}`);
};

const pedidoGet = (url, token) => new Request(url, {
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
const pedidoPost = (url, corpo, token) => new Request(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(corpo),
});

const BASE = "https://exemplo.test";
const { GET: afd } = await import("../app/exportar-afd/route.js");
const { GET: aej } = await import("../app/exportar-aej/route.js");
const { POST: comprovante } = await import("../app/api/comprovante-email/route.js");

/* ── A. Sem sessão ───────────────────────────────────────────────────────── */
conferir("A. GET /exportar-afd sem sessão → 401",
  (await afd(pedidoGet(`${BASE}/exportar-afd?unidadeId=A`))).status, 401);
conferir("B. GET /exportar-aej sem sessão → 401",
  (await aej(pedidoGet(`${BASE}/exportar-aej?unidadeId=A`))).status, 401);
conferir("C. POST /api/comprovante-email sem sessão → 401",
  (await comprovante(pedidoPost(`${BASE}/api/comprovante-email`, { nsr: 1 }))).status, 401);

/* ── Sem sessão, o parâmetro nem é olhado ────────────────────────────────── */
conferir("D. sem sessão E sem unidadeId ainda é 401, não 400",
  (await afd(pedidoGet(`${BASE}/exportar-afd`))).status, 401);
conferir("D2. o mesmo no AEJ",
  (await aej(pedidoGet(`${BASE}/exportar-aej`))).status, 401);
/* ↑ Quem não está logado não descobre nem se o parâmetro estava certo. */

/* ── Token inexistente também é 401 ──────────────────────────────────────── */
conferir("E. token inventado → 401",
  (await afd(pedidoGet(`${BASE}/exportar-afd?unidadeId=A`, "token-que-nao-existe"))).status, 401);

/* ── A resposta não vaza dado ────────────────────────────────────────────── */
const semSessao = await afd(pedidoGet(`${BASE}/exportar-afd?unidadeId=A`));
const corpo = await semSessao.text();
conferir("F. a resposta de 401 não traz CPF, NSR nem nome", [
  /\d{11}/.test(corpo), /nsr/i.test(corpo), corpo.length < 200,
], [false, false, true]);
conferir("F2. e não manda baixar arquivo nenhum",
  semSessao.headers.get("content-disposition"), null);

console.log(`\n${total - falhas}/${total} verificações passaram.`);
console.log(falhas ? "RESULTADO: FALHOU" : "RESULTADO: OK");
process.exit(falhas ? 1 : 0);
