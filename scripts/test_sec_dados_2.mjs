// SEC-DADOS-2 — páginas públicas do negócio pelo servidor, sem leitura anônima.
// Banco em memória; nada toca produção.
//
//   node scripts/test_sec_dados_2.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lerCardapioPublico, validarPedidoPublico, criarPedidoPublico,
  lerChamadaPublica, rotuloDaChamada, lerRastreioPublico, lerUnidadePublica,
} from "../app/lib/server/negocio-publico.mjs";

function banco(tabelas = {}, { falharItens = false } = {}) {
  const t = structuredClone(tabelas);
  let seq = 0;
  function from(nome) {
    const st = { op: "select", f: [], inn: [], gte: [], valor: null, unico: false, head: false, limite: null };
    const b = {
      select(_c, o) { if (st.op === "select") st.head = Boolean(o?.head); return b; },
      insert(v) { st.op = "insert"; st.valor = Array.isArray(v) ? v : [v]; return b; },
      delete() { st.op = "delete"; return b; },
      eq(k, v) { st.f.push([k, v]); return b; },
      in(k, v) { st.inn.push([k, v]); return b; },
      gte(k, v) { st.gte.push([k, v]); return b; },
      order() { return b; }, limit(n) { st.limite = n; return b; },
      maybeSingle() { st.unico = true; return b; }, single() { st.unico = true; return b; },
      then(ok, falha) { return Promise.resolve().then(exec).then(ok, falha); },
    };
    const casa = (l) => st.f.every(([k, v]) => String(l[k]) === String(v))
      && st.inn.every(([k, v]) => v.map(String).includes(String(l[k])))
      && st.gte.every(([k, v]) => String(l[k]) >= String(v));
    function exec() {
      const tab = (t[nome] ||= []);
      if (st.op === "select") {
        let r = tab.filter(casa);
        if (st.limite) r = r.slice(0, st.limite);
        if (st.head) return { count: r.length, error: null };
        return { data: st.unico ? r[0] || null : r, error: null };
      }
      if (st.op === "insert") {
        if (nome === "pedidos_itens" && falharItens) return { data: null, error: { message: "boom" } };
        const novas = st.valor.map((v) => ({ id: `id-${++seq}`, created_at: new Date().toISOString(), ...v }));
        tab.push(...novas);
        return { data: st.unico ? { id: novas[0].id } : novas, error: null };
      }
      if (st.op === "delete") { t[nome] = tab.filter((l) => !casa(l)); return { data: null, error: null }; }
      return { data: null, error: null };
    }
    return b;
  }
  return { db: { from }, t };
}

const BASE = {
  unidades: [{ id: "loja1", nome: "Loja", nome_fantasia: "Sal de Estrela", delivery_aberto: true, taxa_entrega_padrao: "5.00",
    cnpj: "00.000.000/0001-00", token_nfe: "SEGREDO-NFE", endereco_fiscal: "Rua X", config: { logo_url: "https://x/logo.png", interno: 1 } }],
  produtos: [
    { id: "p1", unidade_id: "loja1", ativo: true, nome_produto: "Burger", preco_venda: "30.00", categoria: "Lanches", custo: 9, margem: 70 },
    { id: "p2", unidade_id: "loja1", ativo: true, nome_produto: "Suco", preco_venda: "8.50", categoria: "Bebidas", custo: 2 },
    { id: "p3", unidade_id: "loja1", ativo: false, nome_produto: "Antigo", preco_venda: "1.00", categoria: "X" },
    { id: "p9", unidade_id: "outra", ativo: true, nome_produto: "De outra loja", preco_venda: "1.00", categoria: "X" },
  ],
  pedidos: [
    { id: "o1", unidade_id: "loja1", numero_pedido: 12, cliente_nome: "[MESA 4] Maria Souza", cliente_telefone: "61999990000",
      endereco_entrega: "Rua das Flores 10", valor_total: 50, status: "pronto", tipo_pedido: "cardapio", updated_at: "2026-09-30T10:00:00Z" },
    { id: "o2", unidade_id: "loja1", numero_pedido: 13, cliente_nome: null, cliente_telefone: "61988880000",
      endereco_entrega: "Av. Central 20", valor_total: 20, status: "preparando", tipo_pedido: "balcao", updated_at: "2026-09-30T09:00:00Z" },
  ],
  etiquetas: [{ codigo: "ABC123", produto: "Molho", lote: "L1", quantidade: 2, unidade: "kg", conservacao: "Refrigerado",
    manipulacao_em: "2026-09-29", validade_em: "2026-10-05", status: "ativa", custo_unitario: 12.5, saldo: 1.3, unidade_id: "loja1" }],
};

// ─── cardápio ────────────────────────────────────────────────────────────────
test("cardápio: só produtos ativos da loja, sem custo nem margem; da loja, sem CNPJ nem token", async () => {
  const r = await lerCardapioPublico({ db: banco(BASE).db, unidade: "loja1" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.produtos.map((p) => p.id).sort(), ["p1", "p2"]);
  for (const p of r.produtos) assert.deepEqual(Object.keys(p).sort(), ["categoria", "id", "nome_produto", "preco_venda"]);
  assert.deepEqual(r.unidade, { nome: "Sal de Estrela", aberta: true, taxa_entrega: 5 });
  assert.doesNotMatch(JSON.stringify(r), /SEGREDO-NFE|0001-00|Rua X/);
  assert.equal((await lerCardapioPublico({ db: banco(BASE).db, unidade: "nao-existe" })).status, 404);
  assert.equal((await lerCardapioPublico({ db: banco(BASE).db, unidade: "../x" })).status, 404);
});

// ─── pedido ──────────────────────────────────────────────────────────────────
const PEDIDO = { unidade: "loja1", cliente: { tipo: "delivery", nome: "João", telefone: "(61) 97777-0000", endereco: "Rua A 1" },
  itens: [{ id: "p1", quantidade: 2, preco_venda: 0.01 }, { id: "p2", quantidade: 1, preco_venda: 0.01 }] };

test("pedido: preço e total vêm do BANCO — o preço mandado pelo navegador é ignorado", async () => {
  const b = banco(BASE);
  const v = validarPedidoPublico(PEDIDO);
  assert.equal(v.ok, true);
  const r = await criarPedidoPublico({ db: b.db, pedido: v.pedido });
  assert.equal(r.ok, true);
  assert.equal(r.total, 2 * 30 + 8.5 + 5, "2 burgers + 1 suco + taxa de entrega");
  const criado = b.t.pedidos.at(-1);
  assert.equal(criado.valor_total, 73.5);
  assert.equal(criado.status, "novo_online");
  const itens = b.t.pedidos_itens.filter((i) => i.pedido_id === criado.id);
  assert.deepEqual(itens.map((i) => i.valor_unitario).sort(), [30, 8.5].sort());
});

test("pedido de mesa não cobra taxa de entrega nem exige endereço", async () => {
  const b = banco(BASE);
  const v = validarPedidoPublico({ ...PEDIDO, cliente: { tipo: "qrcode", nome: "Ana", telefone: "61977770000" }, itens: [{ id: "p2", quantidade: 2 }] });
  const r = await criarPedidoPublico({ db: b.db, pedido: v.pedido });
  assert.equal(r.total, 17);
  assert.equal(b.t.pedidos.at(-1).endereco_entrega, null);
});

test("pedido: produto inativo, de outra loja ou inexistente → recusado e nada é gravado", async () => {
  for (const id of ["p3", "p9", "nao-existe"]) {
    const b = banco(BASE);
    const v = validarPedidoPublico({ ...PEDIDO, itens: [{ id, quantidade: 1 }] });
    const r = await criarPedidoPublico({ db: b.db, pedido: v.pedido });
    assert.equal(r.status, 409, id);
    assert.equal(b.t.pedidos.length, 2, `${id}: nenhum pedido novo`);
  }
});

test("pedido: loja fechada → 409; se os itens falharem, o pedido é desfeito", async () => {
  const fechada = banco({ ...BASE, unidades: [{ ...BASE.unidades[0], delivery_aberto: false }] });
  const v = validarPedidoPublico(PEDIDO);
  assert.equal((await criarPedidoPublico({ db: fechada.db, pedido: v.pedido })).status, 409);
  const b = banco(BASE, { falharItens: true });
  const r = await criarPedidoPublico({ db: b.db, pedido: v.pedido });
  assert.equal(r.status, 503);
  assert.equal(b.t.pedidos.length, 2, "o pedido sem itens não fica na cozinha");
});

test("pedido: validação de entrada e freio por telefone", async () => {
  assert.equal(validarPedidoPublico({ ...PEDIDO, cliente: { ...PEDIDO.cliente, telefone: "123" } }).status, 400);
  assert.equal(validarPedidoPublico({ ...PEDIDO, cliente: { ...PEDIDO.cliente, endereco: "" } }).status, 400);
  assert.equal(validarPedidoPublico({ ...PEDIDO, cliente: { ...PEDIDO.cliente, tipo: "retirada" } }).status, 400);
  assert.equal(validarPedidoPublico({ ...PEDIDO, itens: [{ id: "p1", quantidade: 0 }] }).status, 400);
  assert.equal(validarPedidoPublico({ ...PEDIDO, itens: [{ id: "p1", quantidade: 999 }] }).status, 400);
  assert.equal(validarPedidoPublico({ ...PEDIDO, itens: [] }).status, 400);
  const b = banco(BASE);
  const v = validarPedidoPublico(PEDIDO);
  for (let i = 0; i < 5; i++) assert.equal((await criarPedidoPublico({ db: b.db, pedido: v.pedido })).ok, true);
  assert.equal((await criarPedidoPublico({ db: b.db, pedido: v.pedido })).status, 429, "6º pedido do mesmo telefone em 10 min");
});

// ─── chamada ─────────────────────────────────────────────────────────────────
test("chamada: só rótulo, status e horário — telefone, endereço e valor nunca saem", async () => {
  const r = await lerChamadaPublica({ db: banco(BASE).db, unidade: "loja1" });
  assert.equal(r.ok, true);
  for (const p of r.pedidos) assert.deepEqual(Object.keys(p).sort(), ["id", "rotulo", "status", "updated_at"]);
  assert.doesNotMatch(JSON.stringify(r), /61999990000|61988880000|Flores|Central|Souza/);
  assert.deepEqual(r.pedidos.map((p) => p.rotulo).sort(), ["#13", "MARIA"]);
});

test("rótulo da TV: tira o [MESA n] e usa só o primeiro nome", () => {
  assert.equal(rotuloDaChamada({ cliente_nome: "[MESA 4] Maria Souza" }), "MARIA");
  assert.equal(rotuloDaChamada({ cliente_nome: "joão" }), "JOÃO");
  assert.equal(rotuloDaChamada({ numero_pedido: 7 }), "#7");
});

// ─── rastreio ────────────────────────────────────────────────────────────────
test("rastreio: só o que está impresso na etiqueta — sem custo, saldo ou unidade da loja", async () => {
  const r = await lerRastreioPublico({ db: banco(BASE).db, codigo: "ABC123" });
  assert.equal(r.ok, true);
  assert.equal(r.etiqueta.produto, "Molho");
  for (const proibido of ["custo_unitario", "saldo", "unidade_id"]) assert.equal(proibido in r.etiqueta, false, proibido);
  assert.equal((await lerRastreioPublico({ db: banco(BASE).db, codigo: "NAOEXISTE" })).status, 404);
  assert.equal((await lerRastreioPublico({ db: banco(BASE).db, codigo: "a'b" })).status, 404);
});

// ─── unidade ─────────────────────────────────────────────────────────────────
test("unidade pública: nome e logo; CNPJ, endereço fiscal e token da NF-e nunca saem", async () => {
  const r = await lerUnidadePublica({ db: banco(BASE).db, unidade: "loja1" });
  assert.deepEqual(r.unidade, { nome: "Sal de Estrela", logo_url: "https://x/logo.png" });
  assert.doesNotMatch(JSON.stringify(r), /SEGREDO-NFE|0001-00|Rua X|interno/);
});
