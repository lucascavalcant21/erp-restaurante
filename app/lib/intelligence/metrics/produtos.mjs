// Produtos para a inteligência: achar o produto que o usuário citou ("picanha")
// no cadastro DA UNIDADE, e as regras de unidade/custo do saldo — as mesmas
// do estoque (inventario-saldo.mjs / estoque-movimento.mjs / EST-MOV-1), sem
// regra paralela.
//
// O nome digitado é texto não confiável: só serve para COMPARAR com o
// cadastro. Nunca vira filtro de banco montado à mão nem instrução.

import { ehFracionavel, ehUnidadeContavel } from "../../inventario-saldo.mjs";
import { unidadeDoSaldo } from "../../estoque-movimento.mjs";
import { ler } from "../context/db-escopado.mjs";

export { unidadeDoSaldo };

export const CAMPOS_INSUMO = "id, nome, nome_interno, marca, unidade_medida, categoria, departamento, tamanho_embalagem, unidade_comercial, unidade_conteudo, permite_fracionado";

export function normalizar(t) {
  return String(t || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "kg", "g", "un", "l", "ml"]);
const tokens = (t) => normalizar(t).split(" ").filter((x) => x && !PALAVRAS_VAZIAS.has(x));
// "picanhas" → "picanha", "tomates" → "tomate" (plural simples do português)
const singular = (w) => (w.length > 4 && w.endsWith("es") && !w.endsWith("ses") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);

/**
 * Candidatos do cadastro para o termo, do mais provável ao menos.
 *   1. nome (ou nome interno) igual ao termo
 *   2. todas as palavras do termo aparecem no nome
 * Sem candidato → lista vazia (nada é inventado).
 */
export function candidatosDoTermo(insumos, termo, limite = 8) {
  const alvo = tokens(termo).map(singular);
  if (!alvo.length) return [];
  const exato = normalizar(termo);
  const exatoSingular = alvo.join(" ");
  const pontuados = [];
  for (const i of insumos || []) {
    const nomes = [i.nome, i.nome_interno].filter(Boolean);
    let melhor = 0;
    for (const n of nomes) {
      const nn = normalizar(n);
      const ts = new Set(tokens(n).map(singular));
      if (nn === exato || tokens(n).map(singular).join(" ") === exatoSingular) { melhor = Math.max(melhor, 100); continue; }
      const todos = alvo.every((a) => ts.has(a) || [...ts].some((t) => t.startsWith(a) && a.length >= 4));
      if (todos) melhor = Math.max(melhor, 60 - Math.min(ts.size, 20));
    }
    if (melhor > 0) pontuados.push({ insumo: i, pontos: melhor });
  }
  pontuados.sort((a, b) => b.pontos - a.pontos || String(a.insumo.nome).localeCompare(String(b.insumo.nome), "pt-BR"));
  const exatos = pontuados.filter((p) => p.pontos === 100);
  return (exatos.length ? exatos : pontuados).slice(0, limite).map((p) => p.insumo);
}

/** Lê o cadastro da unidade e resolve o termo. */
export async function resolverProduto(dbe, termo) {
  const insumos = await ler(dbe.from("insumos").select(CAMPOS_INSUMO).order("nome"), "insumos");
  return candidatosDoTermo(insumos || [], termo);
}

const saldoEmConteudo = (insumo) => ehFracionavel(insumo) && ehUnidadeContavel(insumo?.unidade_medida);
const fatorBase = (u) => (["kg", "l"].includes(String(u || "").trim().toLowerCase()) ? 1000 : 1);
const fatorSaldo = (insumo) => (saldoEmConteudo(insumo) ? Math.max(Number(insumo.tamanho_embalagem) || 1, 0.000001) : 1);

/**
 * Custo de 1 unidade do SALDO a partir do custo médio por unidade base
 * (g/ml/un). Mesma conta de estoque_movimentar (valor_unitario do movimento).
 */
export function custoPorUnidadeDoSaldo(custoMedioBase, insumo) {
  const c = Number(custoMedioBase);
  if (!Number.isFinite(c) || c < 0) return null;
  return Math.round((c * fatorBase(insumo?.unidade_medida) / fatorSaldo(insumo)) * 1e6) / 1e6;
}

export const fmtQtd = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
