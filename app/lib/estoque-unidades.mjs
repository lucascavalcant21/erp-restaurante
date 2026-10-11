// UNIDADES DO ESTOQUE: compra → armazenamento → saldo (HDEV-EST-001).
//
// Três unidades, cada uma com fator explícito:
//   SALDO        a que o banco guarda em estoque_itens.quantidade_atual (g, kg,
//                ml, L, un — regra única em unidadeDoSaldo, estoque-movimento.mjs);
//   OPERACIONAL  a que o funcionário conta na prateleira: a embalagem do
//                cadastro (garrafa de 330 ml, pacote de 2 kg) ou a própria
//                unidade do saldo quando o produto é a granel;
//   COMPRA       a que chega do fornecedor (caixa com 12 garrafas). Opcional:
//                insumos.unidade_compra + insumos.fator_compra (quantas unidades
//                operacionais vêm numa unidade de compra).
//
// Ex.: Corona 330 ml, saldo em ml. 24 garrafas → 7.920 ml (saldo) e o saldo
// aparece como "24 garrafas". 2 caixas × 12 → 24 garrafas → 7.920 ml.
// Garrafa nunca vira ml digitado: a quantidade digitada é sempre interpretada
// na unidade escolhida e convertida aqui, com o fator à mostra.

import { quantidadeDoLancamento, embalagemDoProduto, unidadeDoSaldo, saldoEmEmbalagens } from "./estoque-movimento.mjs";

const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

function plural(nome, n) {
  const base = String(nome || "").trim();
  if (!base || n === 1 || /s$/i.test(base) || /^(kg|g|l|ml|un)$/i.test(base)) return base;
  if (/m$/i.test(base)) return `${base.slice(0, -1)}ns`;
  if (/ão$/i.test(base)) return `${base.slice(0, -2)}ões`;
  return /[rz]$/i.test(base) ? `${base}es` : `${base}s`;
}

/** Unidade de compra do cadastro ({ nome, fator }) ou null. fator = unidades operacionais por unidade de compra. */
export function unidadeDeCompra(insumo) {
  const nome = String(insumo?.unidade_compra || "").trim();
  const fator = Number(insumo?.fator_compra);
  if (!nome || !Number.isFinite(fator) || fator <= 0) return null;
  return { nome, fator };
}

/** Unidade em que o funcionário conta: a embalagem (com o conteúdo) ou a do saldo. */
export function unidadeOperacional(insumo) {
  const emb = embalagemDoProduto(insumo);
  const saldo = unidadeDoSaldo(insumo);
  if (!emb) return { nome: saldo, fatorSaldo: 1, embalagem: false, saldo };
  return { nome: emb.nome === "embalagem" && /^(ml|l)$/i.test(saldo) ? "unidade" : emb.nome, fatorSaldo: emb.tamanho, embalagem: true, saldo };
}

/** Perfil completo, para a tela mostrar os fatores (ex.: "1 caixa = 12 garrafas · 1 garrafa = 330 ml"). */
export function perfilUnidades(insumo) {
  const op = unidadeOperacional(insumo);
  const compra = unidadeDeCompra(insumo);
  const fatores = [];
  if (compra && op.embalagem) fatores.push(`1 ${compra.nome} = ${fmt(compra.fator)} ${plural(op.nome, compra.fator)}`);
  else if (compra) fatores.push(`1 ${compra.nome} = ${fmt(compra.fator)} ${op.saldo}`);
  if (op.embalagem) fatores.push(`1 ${op.nome} = ${fmt(op.fatorSaldo)} ${op.saldo}`);
  return { saldo: op.saldo, operacional: op, compra, fatores };
}

/**
 * Quantidade de um lançamento com unidade de compra opcional.
 * compras: quantas unidades de compra (caixas). Somadas às embalagens (garrafas)
 * pelo fator do cadastro, antes de virar saldo. O resto é quantidadeDoLancamento.
 */
export function quantidadeDoMovimento({ insumo, compras = "", embalagens = "", fracao = "", unidadeFracao = null } = {}) {
  const temCompra = String(compras ?? "").trim() !== "";
  if (!temCompra) return quantidadeDoLancamento({ insumo, embalagens, fracao, unidadeFracao });
  const compra = unidadeDeCompra(insumo);
  if (!compra) return { erro: "Este produto não tem unidade de compra no cadastro." };
  const nCompra = Number(String(compras).replace(",", "."));
  if (!Number.isFinite(nCompra) || nCompra < 0) return { erro: "Quantidade inválida." };
  if (!Number.isInteger(nCompra)) return { erro: `${compra.nome}: use número inteiro.` };
  const op = unidadeOperacional(insumo);
  const nEmb = String(embalagens ?? "").trim() === "" ? 0 : Number(String(embalagens).replace(",", "."));
  if (!Number.isFinite(nEmb) || nEmb < 0) return { erro: "Quantidade inválida." };
  if (op.embalagem) {
    const totalEmb = nCompra * compra.fator + nEmb;
    const q = quantidadeDoLancamento({ insumo, embalagens: String(totalEmb), fracao, unidadeFracao });
    if (q.erro) return q;
    const texto = `${fmt(nCompra)} ${plural(compra.nome, nCompra)} × ${fmt(compra.fator)}${nEmb ? ` + ${fmt(nEmb)}` : ""} = ${fmt(totalEmb)} ${plural(op.nome, totalEmb)} = ${fmt(q.quantidadeSaldo)} ${q.unidadeSaldo}`;
    return { ...q, texto, detalhe: { ...q.detalhe, compras: nCompra, unidade_compra: compra.nome, fator_compra: compra.fator },
      quantidade_informada: nCompra, unidade_informada: compra.nome };
  }
  // a granel: a unidade de compra vale fator × unidade do saldo
  if (String(fracao ?? "").trim() !== "" || nEmb) return { erro: `Informe só ${plural(compra.nome, 2)} ou só a quantidade.` };
  const fracSaldo = r3(nCompra * compra.fator);
  const q = quantidadeDoLancamento({ insumo, embalagens: "", fracao: String(fracSaldo).replace(".", ","), unidadeFracao: null });
  if (q.erro) return q;
  return { ...q, texto: `${fmt(nCompra)} ${plural(compra.nome, nCompra)} × ${fmt(compra.fator)} ${op.saldo} = ${fmt(q.quantidadeSaldo)} ${q.unidadeSaldo}`,
    detalhe: { ...q.detalhe, compras: nCompra, unidade_compra: compra.nome, fator_compra: compra.fator },
    quantidade_informada: nCompra, unidade_informada: compra.nome };
}

/** Saldo como o funcionário conta: "24 garrafas", "12 garrafas + 100 ml", "1,5 kg". */
export function saldoOperacional(insumo, saldo) {
  const s = r3(Number(saldo) || 0);
  const op = unidadeOperacional(insumo);
  if (!op.embalagem) return `${fmt(s)} ${op.saldo}`;
  if (s <= 0) return `0 ${plural(op.nome, 0)}`;
  const emb = saldoEmEmbalagens(insumo, s);
  if (!emb) return `${fmt(s)} ${op.saldo}`;
  const inteiras = emb.inteiras;
  const sobra = emb.sobra;
  if (!(sobra > 0)) return `${fmt(inteiras)} ${plural(op.nome, inteiras)}`;
  return inteiras > 0 ? `${fmt(inteiras)} ${plural(op.nome, inteiras)} + ${fmt(sobra)} ${op.saldo}` : `${fmt(sobra)} ${op.saldo} (aberta)`;
}

/**
 * Situação de um produto num local. Ordem: inativo > não conferido > zerado >
 * abaixo do mínimo > normal. "Não conferido" = nunca entrou numa contagem
 * fechada: o saldo existe, mas ninguém confirmou na prateleira. O painel não
 * pode chamar de "seguro" um estoque com produto não conferido.
 */
export function situacaoDoItem({ saldo, minimo = null, conferido = false, ativo = true } = {}) {
  if (ativo === false) return "inativo";
  if (!conferido) return "nao_conferido";
  const s = Number(saldo) || 0;
  if (s <= 0) return "zerado";
  const m = Number(minimo);
  if (Number.isFinite(m) && m > 0 && s < m) return "abaixo";
  return "normal";
}

/**
 * O mínimo do local (estoque_itens.estoque_minimo) é digitado na unidade
 * operacional: "15" na Amstel 600 ml são 15 garrafas, não 15 ml (dado real).
 * Converte para a unidade do saldo antes de comparar.
 */
export function minimoNoSaldo(insumo, minimo) {
  const m = Number(minimo);
  if (!Number.isFinite(m) || m <= 0) return null;
  const op = unidadeOperacional(insumo);
  return op.embalagem ? r3(m * op.fatorSaldo) : m;
}

/** Inativo = sem saldo e sem movimento há `dias` (o banco não tem "ativo" por item). */
export function itemInativo({ saldo, ultimaMovimentacao }, agora = new Date(), dias = 90) {
  if ((Number(saldo) || 0) > 0) return false;
  if (!ultimaMovimentacao) return true;
  return agora.getTime() - new Date(ultimaMovimentacao).getTime() > dias * 86400000;
}

export const SITUACOES = [
  { id: "nao_conferido", rotulo: "Não conferido" },
  { id: "zerado", rotulo: "Zerado" },
  { id: "abaixo", rotulo: "Abaixo do mínimo" },
  { id: "normal", rotulo: "Normal" },
  { id: "inativo", rotulo: "Inativo" },
];

/** Resumo do painel. seguro só quando não há não conferido, zerado nem abaixo. */
export function resumoSituacoes(itens) {
  const cont = Object.fromEntries(SITUACOES.map((s) => [s.id, 0]));
  for (const i of itens || []) cont[situacaoDoItem(i)]++;
  const seguro = (itens || []).length > 0 && cont.nao_conferido === 0 && cont.zerado === 0 && cont.abaixo === 0;
  return { ...cont, total: (itens || []).length, seguro };
}

/** Saldo de um produto em vários locais (cadastro mestre único, saldos independentes). */
export function saldosPorLocal(itens, insumoId, locais) {
  const nome = new Map((locais || []).map((l) => [l.id, l.nome]));
  return (itens || []).filter((i) => i.insumo_id === insumoId)
    .map((i) => ({ estoqueId: i.estoque_id, local: nome.get(i.estoque_id) || "—", saldo: Number(i.quantidade_atual) || 0 }))
    .sort((a, b) => b.saldo - a.saldo);
}
