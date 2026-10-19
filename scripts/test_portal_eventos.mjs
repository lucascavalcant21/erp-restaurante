// Pedido de orçamento do formulário público /eventos/[unidade].
//
// Antes o navegador anônimo fazia INSERT direto em `eventos` — recusado pelo
// banco (o anon não tem grant nem policy na tabela) — e todo lead se perdia. Agora grava
// o servidor. Testa: campos permitidos, unidade lida do banco (nunca do
// corpo), freio por telefone e por IP, banco sem a coluna `observacoes`
// (EVENTOS-ORC-1), a rota REAL com o supabase-js de verdade contra um
// PostgREST simulado, e que a página não grava mais direto nem importa nada
// do servidor.
//
//   node --test scripts/test_portal_eventos.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validarPedidoEvento, registrarPedidoEvento } from "../app/lib/server/portais-publicos.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// 18/10/2026 02:00 UTC = 17/10/2026 23:00 em São Paulo.
const AGORA = Date.parse("2026-10-18T02:00:00Z");
const FORM = {
  nome: "  Maria Souza Teste ", telefone: "(61) 99999-0000", tipo: "Casamento",
  data: "2026-12-12", convidados: "80", obs: "Queremos buffet de massas.",
  // Tentativas de escolher o que não é do cliente:
  unidade_id: "outra", funil_status: "FECHADO", tipo_evento: "especial", valor_contratado: 1, status: "cancelado",
};

// ─── banco em memória (mesma forma do supabase-js) ───────────────────────────
function banco(tabelas = {}, { semColunas = {}, quebrado = [] } = {}) {
  const t = structuredClone(tabelas);
  let seq = 0;
  function from(nome) {
    const st = { op: "select", f: [], gte: [], valor: null, unico: false, head: false };
    const b = {
      select(_c, o) { if (st.op === "select") st.head = Boolean(o?.head); return b; },
      insert(v) { st.op = "insert"; st.valor = Array.isArray(v) ? v : [v]; return b; },
      eq(k, v) { st.f.push([k, v]); return b; },
      gte(k, v) { st.gte.push([k, v]); return b; },
      maybeSingle() { st.unico = true; return b; }, single() { st.unico = true; return b; },
      then(ok, falha) { return Promise.resolve().then(exec).then(ok, falha); },
    };
    const casa = (l) => st.f.every(([k, v]) => String(l[k]) === String(v)) && st.gte.every(([k, v]) => String(l[k]) >= String(v));
    function exec() {
      if (quebrado.includes(nome)) return { data: null, error: { message: "connection refused" } };
      const tab = (t[nome] ||= []);
      if (st.op === "select") {
        const r = tab.filter(casa);
        if (st.head) return { count: r.length, error: null };
        return { data: st.unico ? r[0] || null : r, error: null };
      }
      const falta = Object.keys(st.valor[0]).find((k) => (semColunas[nome] || []).includes(k));
      if (falta) return { data: null, error: { message: `Could not find the '${falta}' column of '${nome}' in the schema cache` } };
      const novas = st.valor.map((v) => ({ id: `id-${++seq}`, created_at: new Date(AGORA).toISOString(), ...v }));
      tab.push(...novas);
      return { data: st.unico ? { id: novas[0].id } : novas.map((n) => ({ id: n.id })), error: null };
    }
    return b;
  }
  return { db: { from }, t };
}

const UNIDADES = [{ id: "seldeestrela", ativo: true }, { id: "fechada", ativo: false }, { id: "outra", ativo: true }];
const registrar = (b, slug, payload, extra = {}) => registrarPedidoEvento({ db: b.db, slug, payload, agora: AGORA, ...extra });

// ─── validação ───────────────────────────────────────────────────────────────
test("valida: lead sempre buffet em NOVO CONTATO; unidade, etapa, tipo e valor do cliente são ignorados", () => {
  const v = validarPedidoEvento("seldeestrela", FORM, { agora: AGORA });
  assert.equal(v.ok, true);
  assert.equal(v.slug, "seldeestrela");
  assert.deepEqual(v.payload, {
    nome: "Casamento de Maria",
    cliente_nome: "Maria Souza Teste",
    cliente_telefone: "(61) 99999-0000",
    tipo_evento: "buffet",
    funil_status: "NOVO CONTATO",
    data_evento: "2026-12-12",
    capacidade: 80,
    observacoes: "Queremos buffet de massas.",
  });
  for (const proibido of ["unidade_id", "status", "valor_contratado", "responsavel_id", "operacao_detalhes"]) {
    assert.equal(proibido in v.payload, false, proibido);
  }
});

test("valida: telefone sai no formato do painel; +55 e sem máscara também valem", () => {
  const tel = (t) => validarPedidoEvento("seldeestrela", { ...FORM, telefone: t }, { agora: AGORA }).payload?.cliente_telefone;
  assert.equal(tel("61999990000"), "(61) 99999-0000");
  assert.equal(tel("+55 61 99999-0000"), "(61) 99999-0000");
  assert.equal(tel("(61) 3333-4444"), "(61) 3333-4444");
  for (const ruim of ["123", "999990000", "1234567890123456", ""]) {
    assert.equal(validarPedidoEvento("seldeestrela", { ...FORM, telefone: ruim }, { agora: AGORA }).status, 400, ruim);
  }
});

test("valida: data obrigatória (NOT NULL), real, a partir de hoje em São Paulo e até 5 anos", () => {
  const data = (d) => validarPedidoEvento("seldeestrela", { ...FORM, data: d }, { agora: AGORA });
  // Em UTC já é dia 18, mas em São Paulo ainda é 17: o dia 17 vale.
  assert.equal(data("2026-10-17").ok, true);
  assert.equal(data("2026-10-16").status, 400, "data passada");
  for (const ruim of ["", null, "2026-02-30", "12/12/2026", "2026-12-12T00:00", "2032-01-01"]) {
    assert.equal(data(ruim).status, 400, String(ruim));
  }
  assert.equal(data("2031-12-31").ok, true);
});

test("valida: convidados inteiro de 1 a 5000; nome, link e tipo", () => {
  const com = (c) => validarPedidoEvento("seldeestrela", { ...FORM, ...c }, { agora: AGORA });
  for (const ruim of [0, -3, 2.5, "abc", "", 5001]) assert.equal(com({ convidados: ruim }).status, 400, String(ruim));
  assert.equal(com({ convidados: 5000 }).payload.capacidade, 5000);
  assert.equal(com({ nome: "Jo" }).status, 400);
  assert.equal(com({ tipo: "Show de rock" }).payload.nome, "Evento de Maria", "tipo fora da lista vira 'Evento'");
  assert.equal(com({ obs: "x".repeat(5000) }).payload.observacoes.length, 2000);
  assert.equal(com({ obs: "   " }).payload.observacoes, null);
  assert.equal(validarPedidoEvento("../x", FORM, { agora: AGORA }).status, 400);
  assert.equal(validarPedidoEvento("seldeestrela", null, { agora: AGORA }).status, 400);
});

// ─── gravação ────────────────────────────────────────────────────────────────
test("grava: a unidade vem do banco; o id do evento não volta ao navegador", async () => {
  const b = banco({ unidades: UNIDADES });
  const { payload } = validarPedidoEvento("seldeestrela", FORM, { agora: AGORA });
  // Mesmo que alguém injete unidade_id no payload, vale a do banco.
  const r = await registrar(b, "seldeestrela", { ...payload, unidade_id: "outra" });
  assert.deepEqual(r, { ok: true });
  assert.equal(b.t.eventos.length, 1);
  const e = b.t.eventos[0];
  assert.equal(e.unidade_id, "seldeestrela");
  assert.equal(e.tipo_evento, "buffet");
  assert.equal(e.funil_status, "NOVO CONTATO");
  assert.equal(e.observacoes, "Queremos buffet de massas.");
});

test("grava: link de unidade inexistente ou inativa → 404, nada gravado", async () => {
  const b = banco({ unidades: UNIDADES });
  const { payload } = validarPedidoEvento("seldeestrela", FORM, { agora: AGORA });
  assert.equal((await registrar(b, "nao-existe", payload)).status, 404);
  assert.equal((await registrar(b, "fechada", payload)).status, 404);
  assert.equal(b.t.eventos?.length ?? 0, 0);
});

test("grava: mesmo WhatsApp na mesma unidade — 3 em 10 minutos passam, o 4º é freado", async () => {
  const b = banco({ unidades: UNIDADES });
  const { payload } = validarPedidoEvento("seldeestrela", FORM, { agora: AGORA });
  for (let i = 0; i < 3; i += 1) assert.equal((await registrar(b, "seldeestrela", payload)).ok, true);
  assert.equal((await registrar(b, "seldeestrela", payload)).status, 429);
  assert.equal((await registrar(b, "outra", payload)).ok, true, "a contagem é por unidade");
  const outro = validarPedidoEvento("seldeestrela", { ...FORM, telefone: "61988887777" }, { agora: AGORA }).payload;
  assert.equal((await registrar(b, "seldeestrela", outro)).ok, true);
  assert.equal(b.t.eventos.length, 5);
});

test("banco sem a coluna observacoes (EVENTOS-ORC-1 pendente): o lead entra e o texto vai para operacao_detalhes", async () => {
  const b = banco({ unidades: UNIDADES }, { semColunas: { eventos: ["observacoes"] } });
  const { payload } = validarPedidoEvento("seldeestrela", FORM, { agora: AGORA });
  assert.deepEqual(await registrar(b, "seldeestrela", payload), { ok: true });
  const e = b.t.eventos[0];
  assert.equal("observacoes" in e, false);
  assert.deepEqual(e.operacao_detalhes, { pedido_publico: { observacoes: "Queremos buffet de massas." } });
  assert.equal(e.cliente_telefone, "(61) 99999-0000");

  // Sem observação, nada de operacao_detalhes inventado.
  const b2 = banco({ unidades: UNIDADES }, { semColunas: { eventos: ["observacoes"] } });
  const semObs = validarPedidoEvento("seldeestrela", { ...FORM, obs: "" }, { agora: AGORA }).payload;
  assert.equal((await registrar(b2, "seldeestrela", semObs)).ok, true);
  assert.equal("operacao_detalhes" in b2.t.eventos[0], false);
});

test("coluna essencial ausente ou banco fora → 503, sem gravar lead pela metade", async () => {
  const { payload } = validarPedidoEvento("seldeestrela", FORM, { agora: AGORA });
  const semTel = banco({ unidades: UNIDADES }, { semColunas: { eventos: ["cliente_telefone"] } });
  assert.equal((await registrar(semTel, "seldeestrela", payload)).status, 503);
  assert.equal(semTel.t.eventos?.length ?? 0, 0);
  assert.equal((await registrar(banco({ unidades: UNIDADES }, { quebrado: ["unidades"] }), "seldeestrela", payload)).status, 503);
  assert.equal((await registrar(banco({ unidades: UNIDADES }, { quebrado: ["eventos"] }), "seldeestrela", payload)).status, 503);
});

// ─── rota real (Next + supabase-js) contra um PostgREST simulado ─────────────
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "next/server") return next("next/server.js", ctx);
    return next(spec, ctx);
  },
});
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://supabase.teste";
process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste";

const chamadas = [];
const gravados = [];
const resposta = (corpo, status, headers = {}) =>
  new Response(corpo == null ? null : JSON.stringify(corpo), { status, headers: { "content-type": "application/json", ...headers } });
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  const metodo = (init.method || "GET").toUpperCase();
  const h = new Headers(init.headers);
  chamadas.push({ metodo, caminho: url.pathname, busca: url.searchParams.toString(), auth: h.get("authorization") });
  const objeto = (h.get("accept") || "").includes("vnd.pgrst.object");
  if (url.pathname === "/rest/v1/unidades") {
    const id = (url.searchParams.get("id") || "").replace(/^eq\./, "");
    const linhas = UNIDADES.filter((u) => u.id === id);
    if (objeto) return linhas.length === 1 ? resposta(linhas[0], 200) : resposta({ code: "PGRST116", message: "0 rows" }, 406);
    return resposta(linhas, 200);
  }
  if (url.pathname === "/rest/v1/eventos" && (metodo === "HEAD" || metodo === "GET")) {
    return new Response(null, { status: 200, headers: { "content-range": "*/0" } });
  }
  if (url.pathname === "/rest/v1/eventos" && metodo === "POST") {
    const corpo = JSON.parse(init.body);
    gravados.push(...(Array.isArray(corpo) ? corpo : [corpo]));
    return objeto ? resposta({ id: "ev-1" }, 201) : resposta([{ id: "ev-1" }], 201);
  }
  return resposta({ message: "rota inesperada no teste" }, 500);
};

const ROTA = path.join(raiz, "app", "api", "public", "eventos", "[unidade]", "orcamento", "route.js");
let ip = 0;
async function postar(slug, corpo, { mesmoIp } = {}) {
  const { POST } = await import(pathToFileURL(ROTA).href);
  const req = new Request(`http://app.teste/api/public/eventos/${slug}/orcamento`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": mesmoIp || `10.0.0.${++ip}` },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });
  const r = await POST(req, { params: Promise.resolve({ unidade: slug }) });
  return { status: r.status, json: await r.json() };
}
const limpar = () => { chamadas.length = 0; gravados.length = 0; };
// Datas relativas a hoje, para os testes da rota não envelhecerem.
const DAQUI_30_DIAS = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
const form = { ...FORM, data: DAQUI_30_DIAS };

test("rota: grava pelo servidor com a unidade do link (lida do banco); resposta mínima", async () => {
  limpar();
  const r = await postar("seldeestrela", { unidade: "outra", unidade_id: "outra", form });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.deepEqual(r.json, { ok: true });
  assert.equal(gravados.length, 1);
  assert.equal(gravados[0].unidade_id, "seldeestrela", "o corpo pedia 'outra' e foi ignorado");
  assert.equal(gravados[0].tipo_evento, "buffet");
  assert.equal(gravados[0].funil_status, "NOVO CONTATO");
  assert.equal(gravados[0].data_evento, DAQUI_30_DIAS);
  const leitura = chamadas.find((c) => c.caminho === "/rest/v1/unidades");
  assert.match(leitura.busca, /id=eq\.seldeestrela/);
  assert.ok(chamadas.every((c) => c.auth === "Bearer chave-de-teste"), "service_role só aqui, no servidor");
});

test("rota: isca, corpo inválido e campo ruim não tocam no banco", async () => {
  limpar();
  assert.deepEqual((await postar("seldeestrela", { form, website: "http://spam" })).json, { ok: true });
  assert.equal((await postar("seldeestrela", "não é json")).status, 400);
  const ruim = await postar("seldeestrela", { form: { ...form, telefone: "1" } });
  assert.equal(ruim.status, 400);
  assert.equal(ruim.json.erro, "Informe um WhatsApp com DDD.");
  assert.equal((await postar("..%2Fx", { form })).status, 400);
  assert.equal(chamadas.length, 0);
});

test("rota: link de unidade inexistente → 404 sem INSERT", async () => {
  limpar();
  const r = await postar("nao-existe", { form });
  assert.equal(r.status, 404);
  assert.equal(gravados.length, 0);
  assert.equal(chamadas.some((c) => c.metodo === "POST"), false);
});

test("rota: freio por IP — o 6º envio em 10 minutos do mesmo IP é recusado", async () => {
  limpar();
  const status = [];
  for (let i = 0; i < 6; i += 1) status.push((await postar("seldeestrela", { form, website: "isca" }, { mesmoIp: "10.9.9.9" })).status);
  assert.deepEqual(status, [200, 200, 200, 200, 200, 429]);
});

// ─── página pública ──────────────────────────────────────────────────────────
test("página /eventos/[unidade]: envia pela rota, sem gravar direto e sem nada do servidor", () => {
  const src = fs.readFileSync(path.join(raiz, "app", "eventos", "[unidade]", "page.js"), "utf8");
  assert.doesNotMatch(src, /supabase\s*\.\s*from\(/, "nada de INSERT direto pelo anon");
  assert.doesNotMatch(src, /lib\/server|SERVICE_ROLE|service_role/i, "service_role nunca no navegador");
  assert.match(src, /\/api\/public\/eventos\/\$\{encodeURIComponent\(unidadeStr\)\}\/orcamento/);
  assert.match(src, /name="website"/, "campo-isca presente");
  assert.doesNotMatch(src, /bg-slate-900/, "paleta clara hf-*");
});
