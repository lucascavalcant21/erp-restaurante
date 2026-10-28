// Visão de todos os produtos do estoque: saldo em cada local, ritmo de saída
// e entrada (dia/semana/mês) e a sugestão de mínimo/máximo. Regras em
// estoque-ritmo.mjs. Lê com a sessão do usuário (RLS por unidade); grava só o
// mínimo/máximo do item (estoque_itens), nunca o saldo.

import { supabase, isSupabaseReady } from "./supabase";
import { coberturaDias, ritmoDoProduto, situacaoDoItem, sugerirMinMax, unidadeInteira, PADRAO_RITMO } from "./estoque-ritmo.mjs";
import { areaDoLocal } from "./estoque-areas.mjs";
import { unidadeOperacional } from "./estoque-unidades.mjs";
import { unidadeDoSaldo, paraUnidadeDoCadastro } from "./estoque-movimento.mjs";
import { precoNormalizadoDoInsumo, unidadeNormalizada } from "./ingredientes-utils.mjs";

const DIA = 86400000;

export async function carregarVisaoEstoque(unidadeId, { janelaDias = PADRAO_RITMO.janelaDias, regras = {}, hoje = new Date() } = {}) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { linhas: [], estoques: [], erro: "Escolha uma unidade." };
  const desde = new Date(hoje.getTime() - janelaDias * DIA).toISOString();
  const [rE, rIt] = await Promise.all([
    supabase.from("estoques").select("id, nome, slug, tipo, status").eq("unidade_id", unidadeId).eq("status", "ativo").order("ordem"),
    supabase.from("estoque_itens").select("id, estoque_id, insumo_id, quantidade_atual, estoque_minimo, estoque_maximo").eq("unidade_id", unidadeId).limit(5000),
  ]);
  if (rE.error || rIt.error) return { linhas: [], estoques: [], erro: "Não foi possível ler o estoque agora." };
  const itens = rIt.data || [];
  const ids = [...new Set(itens.map((i) => i.insumo_id))];
  const insumos = new Map();
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase.from("insumos").select("id, nome, categoria, unidade_medida, departamento, unidade_comercial, tamanho_embalagem, custo_unitario, custo_compra, preco_normalizado").in("id", ids.slice(i, i + 300));
    if (error) return { linhas: [], estoques: [], erro: "Não foi possível ler os produtos agora." };
    for (const x of data || []) insumos.set(x.id, x);
  }
  const { data: movs, error: eM } = await supabase.from("estoque_movimentacoes_multi")
    .select("id, estoque_id, insumo_id, tipo, quantidade, motivo, created_at, estorno_de_id, inventario_id")
    .eq("unidade_id", unidadeId).gte("created_at", desde).order("created_at", { ascending: true }).limit(20000);
  if (eM) return { linhas: [], estoques: [], erro: "Não foi possível ler o histórico de movimentos." };
  // O movimento que foi estornado também sai da conta (o estorno aponta para ele).
  const estornados = new Set((movs || []).filter((m) => m.estorno_de_id).map((m) => m.estorno_de_id));
  const porItem = new Map();
  for (const m of movs || []) {
    const k = `${m.estoque_id}|${m.insumo_id}`;
    if (!porItem.has(k)) porItem.set(k, []);
    porItem.get(k).push({ ...m, estornado: estornados.has(m.id) });
  }
  const estoques = rE.data || [];
  const estoquePorId = new Map(estoques.map((e) => [e.id, e]));
  const linhas = itens
    .filter((it) => estoquePorId.has(it.estoque_id) && insumos.has(it.insumo_id))
    .map((it) => {
      const ins = insumos.get(it.insumo_id);
      const est = estoquePorId.get(it.estoque_id);
      const ritmo = ritmoDoProduto(porItem.get(`${it.estoque_id}|${it.insumo_id}`) || [], { hoje, janelaDias, ...regras });
      const sugestao = sugerirMinMax(ritmo, { ...regras, inteiro: unidadeInteira(ins.unidade_medida) || /^(ml|g)$/i.test(String(ins.unidade_medida || "").trim()) });
      // Bar: conta em garrafas/latas (o saldo segue em ml/L no banco). A
      // sugestão arredonda para garrafas inteiras (ninguém pede 8,3 garrafas).
      const op = unidadeOperacional(ins);
      const contagem = op.embalagem && String(ins.departamento || "").toLowerCase() === "bar" && Number(op.fatorSaldo) > 0 ? { nome: op.nome, fator: Number(op.fatorSaldo) } : null;
      if (contagem && sugestao.ok) {
        const emb = (v) => Math.round(Math.ceil(Number(v) / contagem.fator - 1e-9) * contagem.fator * 1000) / 1000;
        Object.assign(sugestao, { minimo: emb(sugestao.minimo), maximo: emb(sugestao.maximo) });
      }
      // Valor (pedido do dono, 28/10/2026: "1 garrafa R$ 5; como tem 6 no
      // estoque, R$ 30"). Mesmo preço das fichas técnicas (por kg/L/un, do
      // cadastro) levado à unidade do saldo: ESTIMATIVA; sem preço, null.
      // (custo_unitario não serve: 2 casas decimais zeram o preço por ml.)
      const preco = precoNormalizadoDoInsumo(ins);
      const fatorUn = paraUnidadeDoCadastro(1, unidadeDoSaldo(ins), unidadeNormalizada(ins.unidade_medida));
      const custoSaldo = preco > 0 && fatorUn != null ? preco * fatorUn : null;
      const saldoNum = Number(it.quantidade_atual) || 0;
      const valor = custoSaldo == null ? null : {
        unidade: op.embalagem ? op.nome : unidadeDoSaldo(ins),
        unitario: Math.round(custoSaldo * (op.embalagem ? Number(op.fatorSaldo) : 1) * 100) / 100,
        total: Math.round(custoSaldo * Math.max(0, saldoNum) * 100) / 100,
      };
      return {
        id: it.id, estoque_id: it.estoque_id, insumo_id: it.insumo_id, valor,
        nome: ins.nome, categoria: ins.categoria || "", unidade: unidadeDoSaldo(ins),
        contagem,
        local: est.nome, area: areaDaTela(est),
        saldo: Number(it.quantidade_atual) || 0, minimo: Number(it.estoque_minimo) || 0, maximo: Number(it.estoque_maximo) || 0,
        ritmo, sugestao, cobertura: coberturaDias(it.quantidade_atual, ritmo),
        situacao: situacaoComUso(situacaoDoItem({ saldo: it.quantidade_atual, minimo: it.estoque_minimo, maximo: it.estoque_maximo }), ritmo, it.estoque_minimo),
      };
    });
  return { linhas, estoques, erro: null };
}

// "Outros" dividido (pedido do dono, 28/10/2026): Embalagens e Marmitaria
// têm aba própria; Depósito e Materiais seguem em Outros.
export function areaDaTela(est) {
  const a = areaDoLocal(est);
  if (a !== "outros") return a;
  const n = String(est?.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/marmit/.test(n)) return "marmitaria";
  if (/embalag/.test(n) || String(est?.tipo || "") === "embalagens") return "embalagens";
  return "outros";
}

// Zerado num local onde nada entrou nem saiu na janela e sem mínimo: o produto
// só está cadastrado ali (não "acabou"). Vai para o fim da lista.
function situacaoComUso(situacao, ritmo, minimo) {
  return situacao === "zerado" && !ritmo.saida.vezes && !ritmo.entrada.vezes && !(Number(minimo) > 0) ? "parado" : situacao;
}

/** Grava mínimo e máximo de um ou mais itens (o saldo não muda). */
export async function salvarMinMax(alteracoes) {
  const falhas = [];
  for (const a of alteracoes) {
    const minimo = Math.max(0, Number(a.minimo) || 0);
    const maximo = Math.max(0, Number(a.maximo) || 0);
    if (maximo && maximo < minimo) { falhas.push({ id: a.id, erro: "Máximo menor que o mínimo." }); continue; }
    const { error } = await supabase.from("estoque_itens").update({ estoque_minimo: minimo, estoque_maximo: maximo || null, updated_at: new Date().toISOString() }).eq("id", a.id);
    if (error) falhas.push({ id: a.id, erro: "Não foi possível salvar." });
  }
  return { falhas };
}
