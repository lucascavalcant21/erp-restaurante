// Regressão: "ponho o valor de venda, salvo, e o sistema não salva" e
// "campo do ingrediente some depois de salvar" (29/09/2026).
//
// O banco falso tem as colunas que a PRODUÇÃO tem hoje (conferidas por
// select=<coluna>&limit=0, sem ler linha):
//   produtos: sem taxa_cartao, aliquota_imposto, observacoes
//   insumos:  sem peso_peca_g, pecas_por_kg
//
//   node scripts/test_salvar_preco_e_ingrediente.mjs
import { register } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

register("./stub-supabase-cliente.mjs", import.meta.url);

const COLUNAS = {
  produtos: new Set(["id", "unidade_id", "ficha_id", "preco_venda", "nome_produto", "categoria", "departamento", "embalagens", "created_at"]),
  insumos: new Set(["id", "unidade_id", "departamento", "nome", "nome_interno", "marca", "categoria", "codigo_interno",
    "tamanho_embalagem", "unidade_medida", "custo_compra", "custo_unitario", "preco_normalizado", "fornecedor_atual_id",
    "fornecedor", "densidade_g_ml", "peso_bruto_padrao", "perda_g", "perda_pct", "empanado", "ganho_pct",
    "custo_empanado_kg", "preco_atualizado_em", "preco_normalizado_anterior", "variacao_preco_pct", "created_at"]),
};

/** Banco em memória com a semântica que importa do PostgREST. */
function bancoFalso({ rlsBloqueiaUpdate = new Set() } = {}) {
  const linhas = { produtos: [], insumos: [], estoque_atual: [], estoque_itens: [], estoques: [], insumos_precos_historico: [], insumo_fornecedores: [] };
  let seq = 0;
  const colunaAusente = (tabela, obj) => {
    const cols = COLUNAS[tabela];
    if (!cols) return null;
    const faltando = Object.keys(obj).find((k) => !cols.has(k));
    return faltando ? { message: `column "${faltando}" of relation "${tabela}" does not exist`, code: "42703" } : null;
  };

  function construtor(tabela) {
    const st = { op: "select", filtros: [], valor: null, retorno: false, unico: false };
    const b = {
      select() { if (st.op === "select") st.op = "select"; else st.retorno = true; return b; },
      insert(v) { st.op = "insert"; st.valor = Array.isArray(v) ? v : [v]; return b; },
      update(v) { st.op = "update"; st.valor = v; return b; },
      upsert(v) { st.op = "upsert"; st.valor = Array.isArray(v) ? v : [v]; return b; },
      delete() { st.op = "delete"; return b; },
      eq(k, v) { st.filtros.push([k, v]); return b; },
      ilike() { return b; }, gte() { return b; }, in() { return b; }, order() { return b; }, limit() { return b; },
      single() { st.unico = true; return b; }, maybeSingle() { st.unico = true; return b; },
      then(ok, falha) { return Promise.resolve().then(executar).then(ok, falha); },
    };
    const casa = (l) => st.filtros.every(([k, v]) => l[k] === v);
    function executar() {
      const tab = (linhas[tabela] ||= []);
      if (st.op === "select") {
        const r = tab.filter(casa);
        return { data: st.unico ? r[0] || null : r, error: null };
      }
      if (st.op === "insert" || st.op === "upsert") {
        for (const v of st.valor) { const e = colunaAusente(tabela, v); if (e) return { data: null, error: e }; }
        const novas = st.valor.map((v) => ({ id: `id-${++seq}`, ...v }));
        tab.push(...novas);
        const data = novas.map((n) => ({ id: n.id }));
        return { data: st.unico ? data[0] : data, error: null };
      }
      if (st.op === "update") {
        const e = colunaAusente(tabela, st.valor); if (e) return { data: null, error: e };
        if (rlsBloqueiaUpdate.has(tabela)) return { data: [], error: null }; // RLS: 0 linhas, sem erro
        const alvo = tab.filter(casa);
        for (const l of alvo) Object.assign(l, st.valor);
        return { data: alvo.map((l) => ({ id: l.id })), error: null };
      }
      if (st.op === "delete") { linhas[tabela] = tab.filter((l) => !casa(l)); return { data: null, error: null }; }
      return { data: null, error: null };
    }
    return b;
  }

  return {
    linhas,
    cliente: {
      from: construtor,
      rpc: async () => ({ data: null, error: null }),
      auth: { getUser: async () => ({ data: { user: null } }) },
    },
  };
}

const usar = (banco) => { globalThis.__supabaseFalso = banco.cliente; return banco; };
const { salvarProduto } = await import("../app/lib/vendas.js");
const { salvarInsumo } = await import("../app/lib/operacao.js");

// ── PREÇO DE VENDA ──────────────────────────────────────────────────────────

test("preço de venda chega ao Cardápio mesmo com colunas que o banco não tem", async () => {
  const b = usar(bancoFalso());
  b.linhas.produtos.push({ id: "p1", unidade_id: "u1", ficha_id: "f1", preco_venda: 30, departamento: "cozinha" });
  // Exatamente o que o modal da lista de fichas envia.
  const r = await salvarProduto({ id: "p1", ficha_id: "f1", preco_venda: 42.5, embalagens: [], taxa_cartao: 3.5, aliquota_imposto: 6 });
  assert.equal(r.error, null);
  assert.equal(b.linhas.produtos[0].preco_venda, 42.5, "o preço novo tem de estar gravado");
  assert.deepEqual(r.colunasIgnoradas.sort(), ["aliquota_imposto", "taxa_cartao"]);
});

test("produto novo do vínculo automático nasce mesmo sem a coluna observacoes", async () => {
  const b = usar(bancoFalso());
  const r = await salvarProduto({ unidade_id: "u1", ficha_id: "f9", nome_produto: "Prato", preco_venda: 55, categoria: "Pratos Principais", departamento: "cozinha", observacoes: "Criado automaticamente pela Ficha Técnica." });
  assert.equal(r.error, null);
  assert.equal(b.linhas.produtos.length, 1);
  assert.equal(b.linhas.produtos[0].preco_venda, 55);
  assert.deepEqual(r.colunasIgnoradas, ["observacoes"]);
});

test("UPDATE barrado por RLS (0 linhas, sem erro) NÃO é tratado como salvo", async () => {
  const b = usar(bancoFalso({ rlsBloqueiaUpdate: new Set(["produtos"]) }));
  b.linhas.produtos.push({ id: "p1", preco_venda: 30, departamento: "cozinha" });
  const r = await salvarProduto({ id: "p1", preco_venda: 42.5 });
  assert.match(r.error || "", /Cardápio não foi alterado/);
  assert.equal(b.linhas.produtos[0].preco_venda, 30);
});

test("produto que não existe mais: erro, não sucesso silencioso", async () => {
  usar(bancoFalso());
  const r = await salvarProduto({ id: "sumiu", preco_venda: 10 });
  assert.match(r.error || "", /Cardápio não foi alterado/);
});

test("coluna essencial ausente não é descartada: vira erro", async () => {
  const b = usar(bancoFalso());
  COLUNAS.produtos.delete("preco_venda");
  try {
    b.linhas.produtos.push({ id: "p1", departamento: "cozinha" });
    const r = await salvarProduto({ id: "p1", preco_venda: 10 });
    assert.match(r.error || "", /preco_venda/);
  } finally { COLUNAS.produtos.add("preco_venda"); }
});

// ── INGREDIENTES ────────────────────────────────────────────────────────────

const INSUMO = {
  unidade_id: "u1", departamento: "cozinha", nome: "Frango", nome_interno: null, marca: null,
  categoria: "Carnes", codigo_interno: null, tamanho_embalagem: 1, unidade_medida: "kg",
  custo_compra: 20, custo_unitario: 20, preco_normalizado: 20, fornecedor_atual_id: null,
  fornecedor: null, densidade_g_ml: null, peso_bruto_padrao: null, perda_g: null, perda_pct: null,
  peso_peca_g: 180, pecas_por_kg: 5.556, empanado: false, ganho_pct: null, custo_empanado_kg: null,
};

test("ingrediente: campos sem coluna no banco são REPORTADOS, não somem calados", async () => {
  const b = usar(bancoFalso());
  const r = await salvarInsumo({ ...INSUMO });
  assert.equal(r.error, undefined);
  assert.deepEqual(r.colunasIgnoradas.sort(), ["pecas_por_kg", "peso_peca_g"]);
  assert.equal(b.linhas.insumos[0].custo_compra, 20, "o resto do cadastro grava");
});

test("ingrediente: edição também reporta o que não gravou", async () => {
  const b = usar(bancoFalso());
  b.linhas.insumos.push({ id: "i1", ...Object.fromEntries(Object.entries(INSUMO).filter(([k]) => COLUNAS.insumos.has(k))) });
  const r = await salvarInsumo({ id: "i1", ...INSUMO, custo_compra: 20 });
  assert.equal(r.error, undefined);
  assert.deepEqual(r.colunasIgnoradas.sort(), ["pecas_por_kg", "peso_peca_g"]);
});

test("ingrediente: com a migração aplicada, nada é ignorado", async () => {
  COLUNAS.insumos.add("peso_peca_g"); COLUNAS.insumos.add("pecas_por_kg");
  try {
    const b = usar(bancoFalso());
    const r = await salvarInsumo({ ...INSUMO });
    assert.deepEqual(r.colunasIgnoradas, []);
    assert.equal(b.linhas.insumos[0].peso_peca_g, 180);
  } finally { COLUNAS.insumos.delete("peso_peca_g"); COLUNAS.insumos.delete("pecas_por_kg"); }
});

test("ingrediente novo é vinculado à área de estoque do setor (o .catch() impedia)", async () => {
  const b = usar(bancoFalso());
  b.linhas.estoques.push({ id: "e-coz", unidade_id: "u1", slug: "cozinha", nome: "Cozinha" });
  const r = await salvarInsumo({ ...INSUMO });
  assert.ok(r.id);
  assert.equal(b.linhas.estoque_itens.length, 1, "o vínculo com a área de estoque tem de ser gravado");
  assert.equal(b.linhas.estoque_itens[0].estoque_id, "e-coz");
});

// ── PERDA: salvar é configuração de custo, não movimento de estoque ─────────

test("salvar perda atualiza o fator das fichas e NÃO movimenta estoque", async () => {
  const b = usar(bancoFalso());
  const campos = Object.fromEntries(Object.entries(INSUMO).filter(([k]) => COLUNAS.insumos.has(k)));
  b.linhas.insumos.push({ id: "i1", ...campos });
  b.linhas.estoque_atual.push({ unidade_id: "u1", insumo_id: "i1", quantidade_atual: 7 });
  // Linha gravada pela versão antiga: 15 lido como "+15%".
  b.linhas.fichas_ingredientes = [
    { id: "fi1", ficha_id: "f1", insumo_id: "i1", quantidade: 0.2, fator_correcao: 15 },
    { id: "fi2", ficha_id: "f2", insumo_id: "outro", quantidade: 1, fator_correcao: 20 },
  ];
  const r = await salvarInsumo({ id: "i1", ...INSUMO, peso_bruto_padrao: 1000, perda_g: 150, perda_pct: 15 });
  assert.equal(r.error, undefined);
  assert.equal(r.fichasAtualizadas, 1);
  const [fi1, fi2] = b.linhas.fichas_ingredientes;
  assert.ok(Math.abs(fi1.fator_correcao - 17.6471) < 0.0001, `fator ${fi1.fator_correcao}`);
  assert.equal(fi1.quantidade, 0.2, "a quantidade da receita não muda");
  assert.equal(fi2.fator_correcao, 20, "ficha de outro ingrediente intocada");
  assert.equal(b.linhas.estoque_atual.length, 1);
  assert.equal(b.linhas.estoque_atual[0].quantidade_atual, 7, "saldo intocado");
  assert.equal((b.linhas.estoque_movimentacoes || []).length, 0);
  assert.equal((b.linhas.estoque_movimentacoes_multi || []).length, 0);
});

test("ingrediente sem perda não reescreve o FC digitado nas fichas", async () => {
  const b = usar(bancoFalso());
  const campos = Object.fromEntries(Object.entries(INSUMO).filter(([k]) => COLUNAS.insumos.has(k)));
  b.linhas.insumos.push({ id: "i1", ...campos });
  b.linhas.fichas_ingredientes = [{ id: "fi1", ficha_id: "f1", insumo_id: "i1", quantidade: 1, fator_correcao: 25 }];
  const r = await salvarInsumo({ id: "i1", ...INSUMO, custo_compra: 22 });
  assert.equal(r.fichasAtualizadas, 0);
  assert.equal(b.linhas.fichas_ingredientes[0].fator_correcao, 25);
});

// ── TRAVA: nenhuma consulta do supabase-js encadeada em .catch() ─────────────

test("nenhuma consulta do supabase encadeada direto em .catch()", () => {
  const raiz = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const achados = [];
  const andar = (d) => {
    for (const nome of readdirSync(d)) {
      if (nome === "node_modules" || nome === ".next") continue;
      const p = join(d, nome);
      if (statSync(p).isDirectory()) { andar(p); continue; }
      if (!/\.(m?js|jsx)$/.test(nome) || /\.test\.|scripts[\\/]/.test(p)) continue;
      const s = readFileSync(p, "utf8");
      let i = -1;
      while ((i = s.indexOf(".catch(", i + 1)) >= 0) {
        const inicio = Math.max(s.lastIndexOf(";", i), s.lastIndexOf("{\n", i), s.lastIndexOf("=>", i) - 1);
        const expr = s.slice(inicio + 1, i);
        if (!/\.(from|rpc)\s*\(/.test(expr) || /\.(then|finally)\s*\(|\bfetch\s*\(|\bstorage\b/.test(expr)) continue;
        achados.push(`${relative(raiz, p)}:${s.slice(0, i).split("\n").length}`);
      }
    }
  };
  for (const d of ["app", "backend_cloud_code"]) andar(join(raiz, d));
  assert.deepEqual(achados, [], "o builder do supabase-js não tem .catch(): a consulta nunca é enviada");
});
