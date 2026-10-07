// Casca HTTP /api/intelligence/*: sessão, unidade validada no banco, tenant do
// corpo ignorado, bloqueio por isolamento e limites. Usa a casca REAL
// (atenderInteligencia) com dependências de banco falsas.
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("../../../../scripts/stub-next-server.mjs", import.meta.url);
const { atenderInteligencia } = await import("../server/http.mjs");
const { processarComando, pedidoSchema } = await import("../commands/command-bus.mjs");
const { generateDailyBrief } = await import("../insights/daily-brief.mjs");
const { criarStoreMemoria } = await import("../audit/store-memoria.mjs");
const { bancoFalso, depsFalsas, UID_A, UID_B, AGORA } = await import("./apoio.mjs");
const { tabelasPadrao } = await import("./fixtures.mjs");

const ask = async ({ ic, motor, store, servicoAcoes, corpo, correlationId, nomeUsuario, provedor }) => {
  const p = pedidoSchema.parse({ texto: corpo.texto ?? null, chave: corpo.chave ?? null, continuar: corpo.continuar ?? null, canal: corpo.canal ?? null });
  if (!p.ok) return { corpo: { erro: "Pedido inválido." }, status: 400 };
  return { corpo: await processarComando({ pedido: p.valor, ic, motor, servicoAcoes, store, provedor, nomeUsuario, correlationId }) };
};

function pedido({ token = `tok-${UID_A}`, unidade = "loja-a", corpo = {}, metodo = "POST" } = {}) {
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  if (unidade) headers["x-hefisto-unidade"] = unidade;
  return new Request("http://localhost/api/intelligence/ask", { method: metodo, headers, body: metodo === "GET" ? undefined : JSON.stringify(corpo) });
}

const injecao = (opcoesBanco = {}, store = criarStoreMemoria()) => ({ deps: depsFalsas(), store, clienteDoUsuario: () => bancoFalso(tabelasPadrao(), opcoesBanco), provedor: null, agora: AGORA });

test("sem sessão: 401; token inválido: 401", async () => {
  assert.equal((await atenderInteligencia(pedido({ token: null }), ask, { injecao: injecao() })).status, 401);
  assert.equal((await atenderInteligencia(pedido({ token: "tok-forjado" }), ask, { injecao: injecao() })).status, 401);
});

test("TENANT: usuário da empresa A pedindo a unidade da empresa B no cabeçalho → 403", async () => {
  const r = await atenderInteligencia(pedido({ unidade: "loja-b", corpo: { texto: "Quanto vendi hoje?", chave: "chave-http-0001" } }), ask, { injecao: injecao() });
  assert.equal(r.status, 403);
  assert.equal((await r.json()).codigo, "UNIDADE_FORA_DO_ESCOPO");
});

test("TENANT: empresa/unidade no corpo do pedido são ignoradas; resposta é da unidade da sessão", async () => {
  const corpo = { texto: "Quanto vendi hoje?", chave: "chave-http-0002", empresa_id: "B", unidade_id: "loja-b", tela: { unidade_id: "loja-b", empresa_id: "B", rota: "/dashboard" } };
  const r = await atenderInteligencia(pedido({ corpo }), ask, { injecao: injecao() });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.match(j.texto, /R\$\s?1\.200,00/);
  assert.ok(!JSON.stringify(j).includes("999999"));
  assert.equal(r.headers.get("cache-control"), "no-store");
});

test("empresa B pela casca vê só os números dela", async () => {
  const r = await atenderInteligencia(pedido({ token: `tok-${UID_B}`, unidade: "loja-b", corpo: { texto: "Quanto vendi hoje?", chave: "chave-http-0003" } }), ask, { injecao: injecao() });
  assert.match((await r.json()).texto, /999\.999,00/);
});

test("sem unidade selecionada: 400 pedindo para escolher a unidade", async () => {
  const r = await atenderInteligencia(pedido({ unidade: null, corpo: { texto: "Quanto vendi hoje?", chave: "chave-http-0004" } }), ask, { injecao: injecao() });
  assert.equal(r.status, 400);
  assert.equal((await r.json()).codigo, "UNIDADE_NAO_SELECIONADA");
});

test("ISOLAMENTO: RLS quebrado → 500 bloqueado, sem dado, e bloqueio auditado", async () => {
  const store = criarStoreMemoria();
  const r = await atenderInteligencia(pedido({ corpo: { texto: "Quanto vendi hoje?", chave: "chave-http-0005" } }), ask, { injecao: injecao({ ignorarFiltros: true }, store) });
  assert.equal(r.status, 500);
  const j = await r.json();
  assert.equal(j.codigo, "ISOLAMENTO");
  assert.ok(!JSON.stringify(j).includes("999999") && !JSON.stringify(j).includes("1.200"));
  assert.ok(store.eventos.some((e) => e.etapa === "bloqueio"));
});

test("Daily Brief pela casca com dados reais da unidade", async () => {
  const r = await atenderInteligencia(pedido({ metodo: "GET" }), async ({ motor, store, nomeUsuario }) => ({ corpo: { brief: await generateDailyBrief({ motor, store, nomeUsuario }) } }), { injecao: injecao() });
  const j = await r.json();
  assert.equal(r.status, 200);
  assert.equal(j.brief.critical.length, 3);
  assert.equal(j.brief.escopo.unidadeId, "loja-a");
});

test("corpo inválido (não-JSON ou grande demais) é recusado", async () => {
  const req = new Request("http://localhost/x", { method: "POST", headers: { authorization: `Bearer tok-${UID_A}`, "x-hefisto-unidade": "loja-a" }, body: "{quebrado" });
  assert.equal((await atenderInteligencia(req, ask, { injecao: injecao() })).status, 400);
  const grande = pedido({ corpo: { texto: "x".repeat(20000) } });
  assert.equal((await atenderInteligencia(grande, ask, { injecao: injecao() })).status, 400);
});

test("perfil sem a permissão da Central de Inteligência: 403 antes de qualquer consulta", async () => {
  const { PERMISSAO_INTELIGENCIA } = await import("../server/http.mjs");
  const { allPermissionKeys } = await import("../../permissions-catalog.mjs");
  assert.ok(allPermissionKeys().includes(PERMISSAO_INTELIGENCIA));
  const inj = injecao();
  let consultou = false;
  inj.clienteDoUsuario = () => { consultou = true; return bancoFalso(tabelasPadrao()); };
  const r = await atenderInteligencia(pedido({ token: "tok-restrito", corpo: { texto: "Quanto vendi hoje?", chave: "chave-http-0009" } }), ask, { injecao: inj });
  assert.equal(r.status, 403);
  assert.equal(consultou, false);
});

// ── Inteligência > Configurações (metas, alertas, sensibilidade) ─────────────
const { obterPreferencias, alterarPreferencias } = await import("../server/preferencias.mjs");
const { feedbackSchema, linhaDeFeedback, estruturaDoInsight } = await import("../memory/feedback.mjs");

test("configurações: quem só vê a Central não altera (403, conferido no banco) e o bloqueio fica auditado", async () => {
  const store = criarStoreMemoria();
  const inj = { ...injecao({}, store), deps: depsFalsas({ negar: ["dashboard.intelligence.settings"] }) };
  const get = await atenderInteligencia(pedido({ metodo: "GET" }), obterPreferencias, { injecao: inj });
  const g = await get.json();
  assert.equal(g.podeConfigurar, false);
  assert.deepEqual([g.preferencias.sensibilidade, g.preferencias.metas.mensal], ["normal", null]);
  const put = await atenderInteligencia(pedido({ metodo: "PUT", corpo: { metas: { mensal: 120000 } } }), alterarPreferencias, { injecao: inj });
  assert.equal(put.status, 403);
  assert.equal(await store.lerPreferencias("loja-a"), null, "nada gravado");
  assert.ok(store.eventos.some((e) => e.etapa === "bloqueio"));
});

test("configurações: meta mensal gravada na unidade DA SESSÃO (unidade do corpo ignorada), auditada antes/depois", async () => {
  const store = criarStoreMemoria();
  const corpo = { metas: { mensal: 120000, semanal: null, diaria: null }, sensibilidade: "alta", alertas: { estoque: true, financeiro: true, compras: false, rh: true, vendas: true }, unidade_id: "loja-b", empresa_id: "B" };
  const r = await atenderInteligencia(pedido({ metodo: "PUT", corpo }), alterarPreferencias, { injecao: injecao({}, store) });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.deepEqual([j.preferencias.metas.mensal, j.preferencias.sensibilidade, j.preferencias.alertas.compras, j.podeConfigurar], [120000, "alta", false, true]);
  assert.equal(j.sugestao.hoje.de, "mensal");
  assert.equal(await store.lerPreferencias("loja-b"), null, "empresa B intocada");
  assert.equal((await store.lerPreferencias("loja-a")).meta_faturamento_mensal, 120000);
  const conf = store.eventos.filter((e) => e.etapa === "configuracao");
  assert.equal(conf.length, 2);
  assert.deepEqual([conf[0].antes.metas.mensal, conf[0].depois.metas.mensal, conf[0].unidade_id], [null, 120000, "loja-a"]);
});

test("configurações: meta inválida é recusada; sem auditoria não grava", async () => {
  const store = criarStoreMemoria();
  const r = await atenderInteligencia(pedido({ metodo: "PUT", corpo: { metas: { mensal: -1 } } }), alterarPreferencias, { injecao: injecao({}, store) });
  assert.equal(r.status, 400);
  const fora = criarStoreMemoria({ falharAuditoria: true });
  const r2 = await atenderInteligencia(pedido({ metodo: "PUT", corpo: { metas: { mensal: 1000 } } }), alterarPreferencias, { injecao: injecao({}, fora) });
  assert.equal(r2.status, 503);
  assert.equal(await fora.lerPreferencias("loja-a"), null);
});

test("pergunta respondida vira feedback ESTRUTURADO com a evidência recalculada no servidor", async () => {
  const store = criarStoreMemoria();
  const brief = async ({ motor }) => ({ corpo: await generateDailyBrief({ motor, store }) });
  const b = await (await atenderInteligencia(pedido({ metodo: "GET" }), brief, { injecao: injecao({}, store) })).json();
  const p = b.perguntasAbertas.find((x) => x.insightTipo === "contagem_falta");
  const f = feedbackSchema.parse({ insightId: p.insightId, insightTipo: p.insightTipo, resposta: "opcao", opcao: "erro_contagem", comentario: null });
  assert.equal(f.ok, true);
  const insight = [...b.critical, ...b.warnings].find((i) => i.id === p.insightId);
  const linha = linhaDeFeedback({ unidadeId: "loja-a", empresaId: null, userId: UID_A }, f.valor, AGORA, estruturaDoInsight(insight));
  assert.deepEqual([linha.pergunta_id, linha.entidade_tipo, linha.opcao_id, linha.unidade_id], [p.insightId, "produto", "erro_contagem", "loja-a"]);
  assert.ok(linha.contexto.evidencias.length > 0);
  assert.ok(JSON.stringify(linha.contexto).length <= 3500);
});
