// Regras de taxa de um canal (contrato) aplicadas a uma venda.
//
// Cada regra:
//   { nome, tipo: "percentual" | "fixo_pedido" | "mensal",
//     base: "preco_lista" | "preco_pago" | "receita_loja",   (só percentual)
//     valor,            // % para percentual; reais para fixo e mensal
//     vigencia: { de: "AAAA-MM-DD", ate: "AAAA-MM-DD" | null } }
//
// Bases (por item):
//   preco_lista  = preço do cardápio do canal;
//   preco_pago   = o que o cliente pagou (lista − desconto da loja − do app);
//   receita_loja = lista − desconto da loja (o desconto do app não sai da loja).
// Fixo por pedido é dividido pelos itens do pedido; mensal, pelos itens do mês.
// Sem itens do mês, a mensalidade não entra e o resultado avisa.

import { centavos, fracao, multiplicar } from "./dinheiro.mjs";

export function regraVigente(regra, dataIso) {
  if (!dataIso) return true;
  const de = regra?.vigencia?.de; const ate = regra?.vigencia?.ate;
  if (de && dataIso < de) return false;
  if (ate && dataIso > ate) return false;
  return true;
}

/** Bases de um item, em centavos. */
export function basesDaVenda({ precoListaC, descontoLojaC = 0, descontoAppC = 0 }) {
  return {
    preco_lista: precoListaC,
    preco_pago: precoListaC - descontoLojaC - descontoAppC,
    receita_loja: precoListaC - descontoLojaC,
  };
}

/**
 * Taxas de UM item vendido. Devolve linhas por regra e o total em centavos
 * (inteiro, arredondado por linha), e os avisos.
 */
export function taxasDoItem({ regras = [], precoListaC, descontoLojaC = 0, descontoAppC = 0, itensPorPedido = 1, itensNoMes = null, data = null }) {
  const b = basesDaVenda({ precoListaC, descontoLojaC, descontoAppC });
  const linhas = []; const avisos = [];
  for (const r of regras) {
    if (!regraVigente(r, data)) continue;
    if (r.tipo === "percentual") {
      const f = fracao(r.valor);
      const base = b[r.base || "preco_lista"];
      if (f === null || base === undefined) { avisos.push(`Regra "${r.nome}" sem valor ou base.`); continue; }
      linhas.push({ nome: r.nome, tipo: r.tipo, base: r.base || "preco_lista", valorC: multiplicar(base, f), exatoC: base * f });
    } else if (r.tipo === "fixo_pedido") {
      const c = centavos(r.valor);
      if (c === null) { avisos.push(`Regra "${r.nome}" sem valor.`); continue; }
      { const e = c / Math.max(1, Number(itensPorPedido) || 1); linhas.push({ nome: r.nome, tipo: r.tipo, valorC: Math.round(e), exatoC: e }); }
    } else if (r.tipo === "mensal") {
      const c = centavos(r.valor);
      if (c === null) { avisos.push(`Regra "${r.nome}" sem valor.`); continue; }
      if (!(Number(itensNoMes) > 0)) { avisos.push(`Mensalidade "${r.nome}" fora da conta: falta a quantidade vendida no mês.`); continue; }
      { const e = c / Number(itensNoMes); linhas.push({ nome: r.nome, tipo: r.tipo, valorC: Math.round(e), exatoC: e }); }
    }
  }
  // totalExatoC (sem arredondar) serve à busca do preço mínimo: arredondar a
  // taxa para baixo poderia aprovar um preço que não paga a margem.
  return { linhas, totalC: linhas.reduce((t, l) => t + l.valorC, 0), totalExatoC: linhas.reduce((t, l) => t + l.exatoC, 0), avisos, bases: b };
}

/** Atalho: regras simples "todas sobre o preço de lista" a partir de percentuais. */
export const regrasPercentuais = (pcts) => pcts.map((p, i) => ({ nome: p.nome || `Taxa ${i + 1}`, tipo: "percentual", base: p.base || "preco_lista", valor: p.valor ?? p }));
