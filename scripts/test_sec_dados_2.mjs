// SEC-DADOS-2 — páginas públicas do negócio pelo servidor, sem leitura anônima.
// Banco em memória; nada toca produção.
//
//   node scripts/test_sec_dados_2.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lerCardapioPublico, validarPedidoPublico, criarPedidoPublico, lerFotoPublica, decodificarFotoDaFicha, lerPedidosPublicos, etapaDoPedido,
  lerChamadaPublica, rotuloDaChamada, lerRastreioPublico, lerUnidadePublica,
} from "../app/lib/server/negocio-publico.mjs";

function banco(tabelas = {}, { falharItens = false } = {}) {
  const t = structuredClone(tabelas);
  let seq = 0;
  function from(nome) {
    const st = { op: "select", f: [], inn: [], gte: [], neq: [], nulo: [], like: [], valor: null, unico: false, head: false, limite: null };
    const b = {
      select(_c, o) { if (st.op === "select") st.head = Boolean(o?.head); return b; },
      insert(v) { st.op = "insert"; st.valor = Array.isArray(v) ? v : [v]; return b; },
      delete() { st.op = "delete"; return b; },
      eq(k, v) { st.f.push([k, v]); return b; },
      in(k, v) { st.inn.push([k, v]); return b; },
      gte(k, v) { st.gte.push([k, v]); return b; },
      neq(k, v) { st.neq.push([k, v]); return b; },
      not(k, op, v) { if (op === "is" && v === null) st.nulo.push(k); return b; },
      like(k, v) { st.like.push([k, new RegExp(`^${String(v).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*")}$`)]); return b; },
      order() { return b; }, limit(n) { st.limite = n; return b; },
      maybeSingle() { st.unico = true; return b; }, single() { st.unico = true; return b; },
      then(ok, falha) { return Promise.resolve().then(exec).then(ok, falha); },
    };
    const casa = (l) => st.f.every(([k, v]) => String(l[k]) === String(v))
      && st.inn.every(([k, v]) => v.map(String).includes(String(l[k])))
      && st.gte.every(([k, v]) => String(l[k]) >= String(v))
      && st.neq.every(([k, v]) => String(l[k]) !== String(v))
      && st.nulo.every((k) => l[k] != null)
      && st.like.every(([k, re]) => re.test(String(l[k] ?? "")));
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
        const novas = st.valor.map((v) => ({ id: `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`, created_at: new Date().toISOString(), ...v }));
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
const CHAVES_PRODUTO = ["alergenicos", "categoria_id", "descricao", "destaque", "harmoniza", "id", "imagem_url", "nome", "pode_conter", "preco", "preco_original", "promocao_id", "selos"];
const COM_FICHAS = {
  ...structuredClone(BASE),
  produtos: [
    ...BASE.produtos.map((p) => (p.id === "p1" ? { ...p, ficha_id: "f1", departamento: "cozinha" } : p)),
    { id: "p4", unidade_id: "loja1", ativo: true, nome_produto: "Café", preco_venda: "0.00", categoria: "Bebidas" },
    { id: "p5", unidade_id: "loja1", ativo: true, nome_produto: "Prato tirado", preco_venda: "40.00", categoria: "Lanches", ficha_id: "f2" },
    { id: "p6", unidade_id: "loja1", ativo: true, nome_produto: "Aponta pra outra", preco_venda: "20.00", categoria: "Lanches", ficha_id: "f9" },
  ],
  fichas_tecnicas: [
    { id: "f1", unidade_id: "loja1", nome_receita: "Burger", nome_comercial: "Burger da casa", descricao_comercial: "Pão de fermentação natural.",
      categoria: "Sanduíches", departamento: "cozinha", ativo: true, status: "ativa", imagem: "/9j/4AAQSkZJRgABAQ==", custo_porcao: 9.1 },
    { id: "f2", unidade_id: "loja1", nome_receita: "Antiga", ativo: false, status: "ativa" },
    { id: "f9", unidade_id: "outra", nome_comercial: "SEGREDO DA OUTRA LOJA", descricao_comercial: "receita alheia", categoria: "Outra", ativo: true, status: "ativa" },
  ],
  fichas_alergenicos: [
    { ficha_id: "f1", unidade_id: "loja1", alergenico: "Glúten" },
    { ficha_id: "f9", unidade_id: "outra", alergenico: "NAO-DEVE-APARECER" },
  ],
  config_sistema: [{ id: "c1", unidade_id: "loja1", params: {
    meta_cmv: 31, custo_aluguel_mes: 12345, faturamento_mes_ref: 160000,
    cardapio_digital: {
      tema: { cor_primaria: "#2f5d3a" },
      itens: { p2: { destaque: true, selos: ["vegano"] } },
      promocoes: [{ id: "suco", titulo: "Suco em dobro", tipo: "preco", preco_promocional: 6, produto_ids: ["p2"] }],
    },
  } }],
};

test("cardápio: pratos ligados à ficha técnica, preço do produto, sem custo nem parâmetro financeiro", async () => {
  const r = await lerCardapioPublico({ db: banco(COM_FICHAS).db, unidade: "loja1" });
  assert.equal(r.ok, true);
  const c = r.cardapio;
  assert.deepEqual(c.produtos.map((p) => p.id).sort(), ["p1", "p2", "p6"], "sem inativo, sem preço zero, sem ficha desativada");
  for (const p of c.produtos) assert.deepEqual(Object.keys(p).sort(), CHAVES_PRODUTO);
  const p1 = c.produtos.find((p) => p.id === "p1");
  assert.equal(p1.nome, "Burger da casa");
  assert.equal(p1.descricao, "Pão de fermentação natural.");
  assert.deepEqual(p1.alergenicos, ["Glúten"]);
  assert.equal(p1.preco, 30);
  assert.equal(p1.imagem_url, "/api/public/cardapio/loja1/foto/p1", "foto da ficha sai por rota, não em base64");
  const p6 = c.produtos.find((p) => p.id === "p6");
  assert.equal(p6.nome, "Aponta pra outra", "ficha de outra loja não entra");
  const p2 = c.produtos.find((p) => p.id === "p2");
  assert.deepEqual([p2.preco, p2.preco_original, p2.promocao_id], [6, 8.5, "suco"]);
  assert.equal(c.tema.cor_primaria, "#2f5d3a");
  assert.deepEqual(c.unidade, { nome: "Sal de Estrela", delivery_aberto: true, taxa_entrega: 5, cidade: "", uf: "", horario: "", endereco: "", telefone: "" });
  const json = JSON.stringify(r);
  assert.doesNotMatch(json, /SEGREDO|0001-00|Rua X|NAO-DEVE-APARECER|receita alheia|12345|160000|meta_cmv|custo|9\.1|4AAQ/);
  assert.equal((await lerCardapioPublico({ db: banco(BASE).db, unidade: "nao-existe" })).status, 404);
  assert.equal((await lerCardapioPublico({ db: banco(BASE).db, unidade: "../x" })).status, 404);
  assert.equal((await lerCardapioPublico({ db: null, unidade: "loja1" })).status, 503, "sem banco não há pratos de demonstração");
});

test("cardápio: banco antigo sem as colunas novas ainda mostra os produtos", async () => {
  const b = banco(BASE);
  const from = b.db.from;
  b.db.from = (nome) => {
    const q = from(nome);
    const select = q.select;
    q.select = (cols, o) => (nome === "produtos" && /ficha_id/.test(cols || "")
      ? { ...q, then: (ok) => Promise.resolve({ data: null, error: { message: 'column produtos.ficha_id does not exist' } }).then(ok) }
      : select.call(q, cols, o));
    return q;
  };
  const r = await lerCardapioPublico({ db: b.db, unidade: "loja1" });
  assert.equal(r.ok, true);
  assert.deepEqual(r.cardapio.produtos.map((p) => p.id).sort(), ["p1", "p2"]);
});

test("foto da ficha: só imagem de verdade, só de produto ativo da loja", async () => {
  assert.equal(decodificarFotoDaFicha("/9j/4AAQSkZJRgABAQ==").tipo, "image/jpeg");
  assert.equal(decodificarFotoDaFicha("data:image/png;base64,iVBORw0KGgoAAAA=").tipo, "image/png");
  assert.equal(decodificarFotoDaFicha("PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"), null, "svg/html não passa");
  assert.equal(decodificarFotoDaFicha("data:text/html;base64,PGgxPg=="), null);
  assert.equal(decodificarFotoDaFicha("não é base64"), null);
  const db = banco(COM_FICHAS).db;
  const ok = await lerFotoPublica({ db, unidade: "loja1", produto: "p1" });
  assert.equal(ok.ok, true);
  assert.equal(ok.tipo, "image/jpeg");
  assert.equal((await lerFotoPublica({ db, unidade: "outra", produto: "p1" })).status, 404);
  assert.equal((await lerFotoPublica({ db, unidade: "loja1", produto: "p6" })).status, 404, "ficha de outra loja");
  assert.equal((await lerFotoPublica({ db, unidade: "loja1", produto: "../p1" })).status, 404);
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

test("pedido: cobra o preço da promoção que vale agora, não o que a tela mostrou", async () => {
  const b = banco(COM_FICHAS);
  const v = validarPedidoPublico({ ...PEDIDO, itens: [{ id: "p2", quantidade: 3, preco_venda: 0.01 }] });
  const r = await criarPedidoPublico({ db: b.db, pedido: v.pedido });
  assert.equal(r.ok, true);
  assert.equal(r.total, 3 * 6 + 5, "promoção de R$ 6 + taxa de entrega");
  assert.deepEqual(r.itens, [{ id: "p2", quantidade: 3, preco: 6 }]);
  assert.equal(b.t.pedidos_itens.at(-1).valor_unitario, 6);
  // Promoção que acabou: volta o preço do produto.
  const semPromo = structuredClone(COM_FICHAS);
  semPromo.config_sistema[0].params.cardapio_digital.promocoes[0].data_fim = "2020-01-01";
  const r2 = await criarPedidoPublico({ db: banco(semPromo).db, pedido: v.pedido });
  assert.equal(r2.total, 3 * 8.5 + 5);
});

test("pedido: prato oculto, sem preço ou com a ficha desativada é recusado", async () => {
  const oculto = structuredClone(COM_FICHAS);
  oculto.config_sistema[0].params.cardapio_digital.itens.p1 = { oculto: true };
  for (const [nome, tabelas, id] of [["oculto", oculto, "p1"], ["preço zero", COM_FICHAS, "p4"], ["ficha desativada", COM_FICHAS, "p5"]]) {
    const b = banco(tabelas);
    const v = validarPedidoPublico({ ...PEDIDO, itens: [{ id, quantidade: 1 }] });
    const r = await criarPedidoPublico({ db: b.db, pedido: v.pedido });
    assert.equal(r.status, 409, nome);
    assert.equal(b.t.pedidos.length, 2, `${nome}: nada gravado`);
  }
});

test("pedido na mesa: WhatsApp opcional, vale com delivery fechado e tem freio por mesa", async () => {
  const fechada = banco({ ...BASE, unidades: [{ ...BASE.unidades[0], delivery_aberto: false }] });
  const v = validarPedidoPublico({ unidade: "loja1", cliente: { tipo: "qrcode", nome: "Ana", mesa: "4" }, itens: [{ id: "p1", quantidade: 1 }] });
  assert.equal(v.ok, true);
  assert.equal(v.pedido.telefone, null);
  const r = await criarPedidoPublico({ db: fechada.db, pedido: v.pedido });
  assert.equal(r.ok, true, "delivery fechado não fecha o salão");
  const criado = fechada.t.pedidos.at(-1);
  assert.equal(criado.cliente_nome, "[MESA 4] Ana");
  assert.equal(criado.cliente_telefone, null);
  assert.equal(validarPedidoPublico({ unidade: "loja1", cliente: { tipo: "qrcode", nome: "Ana" }, itens: [{ id: "p1", quantidade: 1 }] }).status, 400, "sem mesa, WhatsApp obrigatório");
  assert.equal(validarPedidoPublico({ unidade: "loja1", cliente: { tipo: "qrcode", nome: "Ana", mesa: "4", telefone: "12" }, itens: [{ id: "p1", quantidade: 1 }] }).status, 400, "WhatsApp informado tem que ser válido");
  const b = banco({ ...BASE, pedidos: [] });
  for (let i = 0; i < 8; i++) assert.equal((await criarPedidoPublico({ db: b.db, pedido: v.pedido })).ok, true);
  assert.equal((await criarPedidoPublico({ db: b.db, pedido: v.pedido })).status, 429, "9º pedido da mesma mesa em 10 min");
  const outraMesa = validarPedidoPublico({ unidade: "loja1", cliente: { tipo: "qrcode", nome: "Ana", mesa: "44" }, itens: [{ id: "p1", quantidade: 1 }] });
  assert.equal((await criarPedidoPublico({ db: b.db, pedido: outraMesa.pedido })).ok, true, "a mesa 44 não é a 4");
});

test("cardápio: endereço e telefone da loja só saem se o dono ligar; cidade e horário sim", async () => {
  const comLoja = structuredClone(COM_FICHAS);
  Object.assign(comLoja.unidades[0], { cidade: "Foz do Iguaçu", uf: "pr", bairro: "Centro", endereco: "Av. Brasil", numero: "10", horario_funcionamento: "18h às 0h", telefone_contato: "45999990000" });
  const r1 = await lerCardapioPublico({ db: banco(comLoja).db, unidade: "loja1" });
  assert.deepEqual([r1.cardapio.unidade.cidade, r1.cardapio.unidade.uf, r1.cardapio.unidade.horario], ["Foz do Iguaçu", "PR", "18h às 0h"]);
  assert.equal(r1.cardapio.unidade.endereco, "");
  assert.equal(r1.cardapio.unidade.telefone, "");
  comLoja.config_sistema[0].params.cardapio_digital.info = { mostrar_endereco: true, mostrar_telefone: true };
  const r2 = await lerCardapioPublico({ db: banco(comLoja).db, unidade: "loja1" });
  assert.equal(r2.cardapio.unidade.endereco, "Av. Brasil, 10 · Centro");
  assert.equal(r2.cardapio.unidade.telefone, "45999990000");
});

test("delivery: pedido mínimo recusado no servidor; acima do valor, entrega grátis", async () => {
  const regras = structuredClone(COM_FICHAS);
  regras.config_sistema[0].params.cardapio_digital.entrega = { pedido_minimo: 50, gratis_acima: 80 };
  const pouco = validarPedidoPublico({ ...PEDIDO, itens: [{ id: "p1", quantidade: 1 }] });
  const b1 = banco(regras);
  const r1 = await criarPedidoPublico({ db: b1.db, pedido: pouco.pedido });
  assert.equal(r1.status, 409);
  assert.equal(r1.codigo, "pedido_minimo");
  assert.equal(b1.t.pedidos.length, 2, "nada gravado");
  const muito = validarPedidoPublico({ ...PEDIDO, itens: [{ id: "p1", quantidade: 3 }] });
  const r2 = await criarPedidoPublico({ db: banco(regras).db, pedido: muito.pedido });
  assert.equal(r2.ok, true);
  assert.equal(r2.taxa, 0);
  assert.equal(r2.total, 90);
  const mesa = validarPedidoPublico({ unidade: "loja1", cliente: { tipo: "qrcode", nome: "Ana", mesa: "2" }, itens: [{ id: "p1", quantidade: 1 }] });
  assert.equal((await criarPedidoPublico({ db: banco(regras).db, pedido: mesa.pedido })).ok, true, "na mesa não há mínimo");
});

test("meus pedidos: só os ids do aparelho, só etapa, total e itens; nunca nome, telefone ou endereço", async () => {
  const b = banco(COM_FICHAS);
  const v = validarPedidoPublico(PEDIDO);
  const r = await criarPedidoPublico({ db: b.db, pedido: v.pedido });
  assert.match(r.id, /^[0-9a-f-]{36}$/);
  const lidos = await lerPedidosPublicos({ db: b.db, unidade: "loja1", ids: [r.id, "nao-e-uuid", "../x"] });
  assert.equal(lidos.ok, true);
  assert.equal(lidos.pedidos.length, 1);
  assert.deepEqual(Object.keys(lidos.pedidos[0]).sort(), ["criado_em", "etapa", "id", "itens", "tipo", "total"]);
  assert.equal(lidos.pedidos[0].etapa, "recebido");
  assert.doesNotMatch(JSON.stringify(lidos), /João|97777|Rua A/);
  assert.deepEqual((await lerPedidosPublicos({ db: b.db, unidade: "outra", ids: [r.id] })).pedidos, [], "outra loja não vê");
  assert.deepEqual((await lerPedidosPublicos({ db: b.db, unidade: "loja1", ids: [] })).pedidos, []);
  assert.equal(etapaDoPedido("preparando_delivery"), "preparo");
  assert.equal(etapaDoPedido("saiu"), "saiu");
  assert.equal(etapaDoPedido("pago"), "entregue");
  assert.equal(etapaDoPedido("cancelado"), "cancelado");
  assert.equal(etapaDoPedido("xyz"), "andamento");
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
