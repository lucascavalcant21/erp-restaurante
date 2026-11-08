// Mesa e totem no estilo autoatendimento (pedido do dono, 08/11/2026):
// totem sem mesa e sem WhatsApp, número do pedido do dia e identificação na comanda.
// TESTADO EM MOCK (banco falso em memória com o mesmo encadeamento do supabase-js).
import test from "node:test";
import assert from "node:assert/strict";
import { validarPedidoPublico, criarPedidoPublico, inicioDoDiaSaoPaulo, numeroDoDia } from "./server/negocio-publico.mjs";

const base = (cliente) => ({ unidade: "loja", cliente: { nome: "Ana", ...cliente }, itens: [{ id: "p1", quantidade: 1 }] });

test("totem: consumo na casa sem mesa e sem WhatsApp; o nome vira [TOTEM]", () => {
  const r = validarPedidoPublico(base({ tipo: "qrcode", totem: true }));
  assert.equal(r.ok, true);
  assert.equal(r.pedido.totem, true);
  assert.equal(r.pedido.nome, "[TOTEM] Ana");
  assert.equal(r.pedido.telefone, null);
});

test("sem mesa e sem totem, o QR continua pedindo WhatsApp; totem com mesa vale como mesa", () => {
  assert.equal(validarPedidoPublico(base({ tipo: "qrcode" })).ok, false);
  const r = validarPedidoPublico(base({ tipo: "qrcode", totem: true, mesa: "7" }));
  assert.equal(r.pedido.totem, undefined);
  assert.equal(r.pedido.nome, "[MESA 7] Ana");
  assert.equal(validarPedidoPublico(base({ tipo: "delivery", totem: true, telefone: "45999990000", endereco: "Rua A, 1" })).pedido.totem, undefined, "totem só no consumo na casa");
});

test("início do dia em São Paulo", () => {
  assert.equal(inicioDoDiaSaoPaulo(Date.parse("2026-11-08T02:30:00Z")), "2026-11-07T03:00:00.000Z", "23h30 de sábado ainda é sábado");
  assert.equal(inicioDoDiaSaoPaulo(Date.parse("2026-11-08T03:10:00Z")), "2026-11-08T03:00:00.000Z");
});

// ─── banco falso ─────────────────────────────────────────────────────────────
function bancoFalso(tabelas) {
  const t = Object.fromEntries(Object.entries(tabelas).map(([k, v]) => [k, v.map((x) => ({ ...x }))]));
  let seq = 0;
  function consulta(nome) {
    const filtros = [];
    let modo = "select";
    let dados = null;
    let opts = {};
    let unico = null;
    let lim = null;
    const linhas = () => (t[nome] || []).filter((r) => filtros.every((f) => f(r)));
    const q = {
      select(_c, o = {}) { if (modo === "select") opts = o; else opts.retornar = true; return q; },
      eq(c, v) { filtros.push((r) => String(r[c]) === String(v)); return q; },
      neq(c, v) { filtros.push((r) => r[c] !== v); return q; },
      in(c, l) { filtros.push((r) => l.map(String).includes(String(r[c]))); return q; },
      not(c, _op, v) { filtros.push((r) => r[c] !== v && r[c] != null); return q; },
      gte(c, v) { filtros.push((r) => String(r[c]) >= String(v)); return q; },
      lte(c, v) { filtros.push((r) => String(r[c]) <= String(v)); return q; },
      like(c, v) { const re = new RegExp(`^${v.replace(/[[\]]/g, "\\$&").replace(/%/g, ".*")}$`); filtros.push((r) => re.test(String(r[c] || ""))); return q; },
      order() { return q; },
      limit(n) { lim = n; return q; },
      insert(l) { modo = "insert"; dados = l; return q; },
      update(d) { modo = "update"; dados = d; return q; },
      delete() { modo = "delete"; return q; },
      maybeSingle() { unico = "talvez"; return q; },
      single() { unico = "um"; return q; },
      then(ok, erro) { return Promise.resolve(executar()).then(ok, erro); },
    };
    function executar() {
      if (modo === "insert") {
        const novos = dados.map((d) => ({ id: d.id || `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, created_at: new Date(Date.parse("2026-11-08T15:00:00Z") + seq * 1000).toISOString(), ...d }));
        t[nome] = [...(t[nome] || []), ...novos];
        return { data: unico ? novos[0] : novos, error: null };
      }
      if (modo === "update") { for (const r of linhas()) Object.assign(r, dados); return { data: null, error: null }; }
      if (modo === "delete") { const fora = new Set(linhas()); t[nome] = t[nome].filter((r) => !fora.has(r)); return { data: null, error: null }; }
      let l = linhas();
      if (lim != null) l = l.slice(0, lim);
      if (opts.head) return { data: null, count: l.length, error: null };
      if (unico) return { data: l[0] || null, error: null };
      return { data: l, error: null };
    }
    return q;
  }
  return { tabelas: t, from: consulta, rpc: async () => ({ data: null, error: { message: "sem rpc" } }) };
}

const P1 = "11111111-1111-4111-8111-111111111111";
const loja = () => bancoFalso({
  unidades: [{ id: "loja", nome: "Loja", delivery_aberto: true }],
  produtos: [{ id: P1, unidade_id: "loja", ativo: true, nome_produto: "Tacacá", preco_venda: 32, categoria: "Pratos" }],
  config_sistema: [],
  montagem: [],
  pedidos: [
    { id: "a0000000-0000-4000-8000-000000000001", unidade_id: "loja", created_at: "2026-11-07T20:00:00.000Z", cliente_nome: "ontem" },
    { id: "a0000000-0000-4000-8000-000000000002", unidade_id: "loja", created_at: "2026-11-08T12:00:00.000Z", cliente_nome: "hoje cedo" },
    { id: "a0000000-0000-4000-8000-000000000003", unidade_id: "outra", created_at: "2026-11-08T12:30:00.000Z", cliente_nome: "outra loja" },
  ],
  pedidos_itens: [],
});
const AGORA = Date.parse("2026-11-08T15:30:00Z");

test("pedido do totem: número do dia (só desta unidade, desde a meia-noite) e senha na comanda", async () => {
  const db = loja();
  const v = validarPedidoPublico({ unidade: "loja", cliente: { tipo: "qrcode", totem: true, nome: "Bia" }, itens: [{ id: P1, quantidade: 2 }] });
  const r = await criarPedidoPublico({ db, pedido: v.pedido, agora: AGORA });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(r.numero, "002", "o de ontem e o da outra loja não contam");
  const gravado = db.tabelas.pedidos.find((p) => p.id === r.id);
  assert.equal(gravado.identificacao, "Totem · Senha 002");
  assert.equal(gravado.cliente_nome, "[TOTEM] Bia");
  assert.equal(gravado.tipo_pedido, "qrcode");
  assert.equal(gravado.valor_total, 64, "preço do cardápio no servidor");
});

test("pedido da mesa: número e mesa na identificação; o segundo pedido ganha o número seguinte", async () => {
  const db = loja();
  const pedir = () => criarPedidoPublico({ db, pedido: validarPedidoPublico({ unidade: "loja", cliente: { tipo: "qrcode", mesa: "12", nome: "Caio" }, itens: [{ id: P1, quantidade: 1 }] }).pedido, agora: AGORA });
  const a = await pedir();
  const b = await pedir();
  assert.deepEqual([a.numero, b.numero], ["002", "003"]);
  assert.equal(db.tabelas.pedidos.find((p) => p.id === b.id).identificacao, "Mesa 12 · Pedido 003");
});

test("sem conseguir contar, o pedido segue sem número (nada inventado)", async () => {
  const db = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: "x" } }) }) }) }) };
  assert.equal(await numeroDoDia({ db, unidade: "loja", id: "x" }), null);
});

test("modelos do editor: ponto da carne e 'Deseja retirar algo?' com os ingredientes da ficha", async () => {
  const { MODELO_PONTO, grupoRetirarDaFicha, opcoesDeRetirar } = await import("./cardapio-painel.mjs");
  const { normalizarGrupo, precoDaLinha } = await import("./cardapio-digital.mjs");
  assert.equal(normalizarGrupo(MODELO_PONTO).min, 1);
  assert.deepEqual(opcoesDeRetirar(["Camarão 40/60", "Cebola roxa - kg", "Sal fino", "Óleo de soja", "Jambu (maço)", "cebola roxa", "Gelo", "Leite de coco 200ml"]).map((o) => o.nome),
    ["Camarão", "Cebola roxa", "Jambu", "Leite de coco"]);
  assert.equal(grupoRetirarDaFicha(["Sal", "Água"]), null, "só básicos: não oferece");
  const g = normalizarGrupo({ ...grupoRetirarDaFicha(["Cebola", "Coentro"]), id: "retirar" });
  const prato = { id: "p", preco: 40, grupos: [g] };
  const l = precoDaLinha(prato, { retirar: [g.opcoes[0].id] });
  assert.deepEqual([l.ok, l.preco, l.texto], [true, 40, "Sem: Cebola"], "tirar não muda o preço e a cozinha lê 'Sem'");
});

test("painel de senhas: o totem aparece com a senha; a mesa não (é servida na mesa)", async () => {
  const { lerChamadaPublica, senhaDaChamada, vaiParaChamada } = await import("./server/negocio-publico.mjs");
  assert.equal(senhaDaChamada({ identificacao: "Totem · Senha 042" }), "042");
  assert.equal(senhaDaChamada({ identificacao: "Mesa 12 · Pedido 042" }), "");
  assert.equal(vaiParaChamada({ tipo_pedido: "qrcode", cliente_nome: "[MESA 3] Ana" }), false);
  const db = bancoFalso({ pedidos: [
    { id: "t1", unidade_id: "loja", tipo_pedido: "qrcode", cliente_nome: "[TOTEM] Bia Souza", identificacao: "Totem · Senha 007", status: "pronto", updated_at: "2026-11-08T15:00:00Z", cliente_telefone: "45999990000" },
    { id: "m1", unidade_id: "loja", tipo_pedido: "qrcode", cliente_nome: "[MESA 3] Ana", status: "pronto", updated_at: "2026-11-08T15:01:00Z" },
    { id: "b1", unidade_id: "loja", tipo_pedido: "balcao", cliente_nome: "Caio", status: "preparando", updated_at: "2026-11-08T15:02:00Z" },
    { id: "x1", unidade_id: "outra", tipo_pedido: "qrcode", cliente_nome: "[TOTEM] Zé", identificacao: "Totem · Senha 001", status: "pronto", updated_at: "2026-11-08T15:03:00Z" },
  ] });
  const r = await lerChamadaPublica({ db, unidade: "loja" });
  assert.deepEqual(r.pedidos.map((p) => [p.id, p.rotulo, p.senha]).sort(), [["b1", "CAIO", ""], ["t1", "BIA", "007"]]);
  assert.ok(!JSON.stringify(r).includes("4599999"), "telefone nunca sai");
});
