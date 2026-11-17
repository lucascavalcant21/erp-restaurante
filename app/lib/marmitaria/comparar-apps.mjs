// Simulador de vendas por app e comparativo entre eles (pedido do dono,
// 17/11/2026: "vamos ter nosso simulador de vendas por app e comparativo
// entre eles").
//
// As mesmas vendas (quantos de cada item por dia) simuladas em cada app com
// o preço e as taxas daquele app; depois, a "mistura": que parte das vendas
// vai para cada app, e o resultado do mês somado, com equipe e custos fixos
// descontados UMA vez. Reusa simularVendas (painel-lucro.mjs) e as linhas do
// Cardápio de cada app (cardapioDeVendas). Item sem preço no app não entra na
// conta daquele app e aparece listado (nada de preço emprestado de outro app).
// Tudo SIMULAÇÃO.

import { simularVendas } from "./painel-lucro.mjs";

const r2 = (v) => Math.round(Number(v) * 100) / 100;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * @param {object} p
 * @param {Array<{canal:{id,nome}, linhas:Array}>} p.porCanal  linhas do Cardápio calculadas em cada app
 * @param {Object<string, number>} p.quantidades  id do item → quantas por dia
 * @param {number} p.diasMes
 * @param {object|null} p.embutidos  { cmoMes, fixosMes } (equipe e custos fixos do mês)
 * @param {Object<string, number>} p.mix  id do app → % das vendas (a soma deveria dar 100)
 */
export function compararApps({ porCanal = [], quantidades = {}, diasMes = 25, embutidos = null, mix = {} } = {}) {
  const pedidos = Object.values(quantidades).reduce((t, q) => t + (num(q) > 0 ? num(q) : 0), 0);
  const apps = porCanal.map(({ canal, linhas }) => {
    // a sobra do app, sem descontar equipe e fixos (entram depois, uma vez só)
    const s = simularVendas({ linhas, quantidades, diasMes, embutidos: null });
    const pedidos = Object.entries(quantidades).filter(([, q]) => num(q) > 0);
    const semPreco = pedidos.filter(([id]) => {
      const l = linhas.find((x) => x.id === id);
      return !l || l.lucro == null || !l.sim?.com?.valido;
    }).map(([id]) => linhas.find((x) => x.id === id)?.nome || "Item");
    const m = s.mes;
    const sobraMes = r2(s.itens.reduce((t, i) => t + i.sobraDia, 0) * s.dias);
    const lucroMes = embutidos ? r2(sobraMes - (embutidos.cmoMes || 0) - (embutidos.fixosMes || 0)) : null;
    return {
      id: canal.id, nome: canal.nome, dias: s.dias,
      pedidosDia: s.itens.reduce((t, i) => t + i.quantidade, 0),
      faturamentoMes: m.faturamento, produtosMes: m.produtos, taxasMes: m.taxas, sobraMes, lucroMes,
      taxasPct: m.faturamento > 0 ? r2((m.taxas / m.faturamento) * 100) : null,
      sobraPorPedido: s.itens.length ? r2(s.itens.reduce((t, i) => t + i.sobraDia, 0) / s.itens.reduce((t, i) => t + i.quantidade, 0)) : null,
      sobraDia: s.itens.reduce((t, i) => t + i.sobraDia, 0),
      itens: s.itens,
      semPreco,
      completo: semPreco.length === 0 && s.itens.length > 0,
    };
  });

  // ranking só entre os apps em que todos os itens têm preço (comparação justa)
  const comparaveis = apps.filter((a) => a.completo);
  const melhor = comparaveis.length ? comparaveis.reduce((b, a) => (a.sobraMes > b.sobraMes ? a : b)) : null;
  for (const a of apps) a.diferencaParaMelhor = melhor && a.completo ? r2(a.sobraMes - melhor.sobraMes) : null;

  // mistura: cada app recebe sua parte das vendas; equipe e fixos uma vez
  const somaMix = Object.values(mix).reduce((t, v) => t + (num(v) > 0 ? num(v) : 0), 0);
  let mistura = null;
  if (somaMix > 0 && pedidos > 0) {
    const partes = apps.map((a) => {
      const pct = num(mix[a.id]) > 0 ? num(mix[a.id]) : 0;
      const f = pct / 100;
      return { id: a.id, nome: a.nome, pct, pedidosDia: r2(a.pedidosDia * f), faturamentoMes: r2(a.faturamentoMes * f), taxasMes: r2(a.taxasMes * f), sobraMes: r2(a.sobraMes * f), semPreco: pct > 0 ? a.semPreco : [] };
    });
    const sobraMes = r2(partes.reduce((t, p) => t + p.sobraMes, 0));
    const faturamentoMes = r2(partes.reduce((t, p) => t + p.faturamentoMes, 0));
    const lucroMes = embutidos ? r2(sobraMes - (embutidos.cmoMes || 0) - (embutidos.fixosMes || 0)) : null;
    mistura = {
      partes, somaPct: r2(somaMix), fechaEm100: Math.abs(somaMix - 100) < 0.01,
      faturamentoMes, taxasMes: r2(partes.reduce((t, p) => t + p.taxasMes, 0)), sobraMes, lucroMes,
      lucroPct: lucroMes != null && faturamentoMes > 0 ? r2((lucroMes / faturamentoMes) * 100) : null,
      // se tudo fosse vendido no melhor app, quanto a mais sobraria
      ganhoNoMelhor: melhor ? r2(melhor.sobraMes * (somaMix / 100) - sobraMes) : null,
      semPreco: [...new Set(partes.flatMap((p) => p.semPreco))],
    };
  }
  return { apps, melhor: melhor ? { id: melhor.id, nome: melhor.nome } : null, mistura, faltandoFixos: !embutidos || embutidos.cmoMes == null || embutidos.fixosMes == null };
}

/** Mistura inicial: partes iguais entre os apps (o dono ajusta). */
export function mixIgual(canais = []) {
  if (!canais.length) return {};
  const base = Math.floor(100 / canais.length);
  const out = Object.fromEntries(canais.map((c) => [c.id, base]));
  out[canais[0].id] += 100 - base * canais.length;
  return out;
}
