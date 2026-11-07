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
 * Nomes do cadastro que aparecem INTEIROS na frase dita ("quanto tenho de xarope
 * de cupuaçu" contém "Xarope de cupuaçu" e "Cupuaçu"): ganha o nome mais longo.
 * Assim o recorte do pedido ("cupuaçu", "eu montar eu saber vatapá") não
 * decide sozinho qual é o produto. Vazio quando nenhum nome cabe na frase.
 * Com `alvo` (palavras do termo recortado), só valem nomes que dividem ao menos
 * uma palavra com ele — "quanto tenho de sal" não vira "Sal" por acaso numa
 * frase sobre outra coisa.
 */
export function candidatosNaFrase(lista, frase, limite = 8, alvo = null) {
  const daFrase = new Set(tokens(frase).map(singular));
  if (!daFrase.size) return [];
  const doAlvo = alvo?.length ? new Set(alvo) : null;
  let melhor = 0;
  const achados = [];
  for (const i of lista || []) {
    let pontos = 0;
    for (const n of [i.nome, i.nome_interno].filter(Boolean)) {
      const ts = tokens(n).map(singular);
      if (!ts.length || !ts.every((t) => daFrase.has(t))) continue;
      if (doAlvo && !ts.some((t) => doAlvo.has(t))) continue;
      pontos = Math.max(pontos, ts.length);
    }
    if (pontos) { achados.push({ i, pontos }); melhor = Math.max(melhor, pontos); }
  }
  return achados.filter((x) => x.pontos === melhor)
    .sort((a, b) => String(a.i.nome).localeCompare(String(b.i.nome), "pt-BR"))
    .slice(0, limite).map((x) => x.i);
}

/**
 * Último recurso: o termo veio com palavras a mais ("eu montar eu saber vatapá").
 * Vale o cadastro que tem MAIS palavras fortes (4+ letras) do termo; empate
 * volta tudo, e quem chama pergunta "qual deles?". Nunca escolhe sozinho.
 */
export function candidatosParciais(lista, alvo, limite = 8) {
  const fortes = [...new Set(alvo.filter((a) => a.length >= 4))];
  if (!fortes.length) return [];
  let melhor = 0;
  const achados = [];
  for (const i of lista || []) {
    let pontos = 0;
    for (const n of [i.nome, i.nome_interno].filter(Boolean)) {
      const ts = tokens(n).map(singular);
      pontos = Math.max(pontos, fortes.filter((a) => ts.some((t) => t === a || (t.startsWith(a) && a.length >= 5))).length);
    }
    if (pontos) { achados.push({ i, pontos }); melhor = Math.max(melhor, pontos); }
  }
  return achados.filter((x) => x.pontos === melhor)
    .sort((a, b) => String(a.i.nome).localeCompare(String(b.i.nome), "pt-BR"))
    .slice(0, limite).map((x) => x.i);
}

/**
 * Candidatos do cadastro para o termo, do mais provável ao menos.
 *   0. (com `frase`) nome do cadastro dito inteiro no pedido — o mais longo
 *   1. nome (ou nome interno) igual ao termo
 *   2. todas as palavras do termo aparecem no nome
 *   3. (com `parcial`) o nome com mais palavras fortes do termo
 * Sem candidato → lista vazia (nada é inventado).
 * @param {object[]} insumos  (ou fichas: qualquer lista com nome/nome_interno)
 * @param {string} termo      o que o interpretador recortou
 * @param {number} [limite]
 * @param {{ frase?: string|null, parcial?: boolean }} [opcoes]
 */
export function candidatosDoTermo(insumos, termo, limite = 8, { frase = null, parcial = false } = {}) {
  const alvo = tokens(termo).map(singular);
  if (frase) {
    const naFrase = candidatosNaFrase(insumos, frase, limite, alvo);
    if (naFrase.length) return naFrase;
  }
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
  if (exatos.length) return exatos.slice(0, limite).map((p) => p.insumo);
  if (pontuados.length) return pontuados.slice(0, limite).map((p) => p.insumo);
  return parcial && alvo.length > 1 ? candidatosParciais(insumos, alvo, limite) : [];
}

/** O candidato é o nome exato do termo (ou o único nome dito inteiro)? Então não precisa perguntar. */
export function ehNomeExato(item, termo) {
  const alvo = tokens(termo).map(singular).join(" ");
  return [item?.nome, item?.nome_interno].filter(Boolean).some((n) => tokens(n).map(singular).join(" ") === alvo);
}

/** Lê o cadastro da unidade e resolve o termo. */
export async function resolverProduto(dbe, termo, frase = null) {
  const insumos = await ler(dbe.from("insumos").select(CAMPOS_INSUMO).order("nome"), "insumos");
  return candidatosDoTermo(insumos || [], termo, 8, { frase });
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
