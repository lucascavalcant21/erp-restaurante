// RITMO DO ESTOQUE: quanto sai e quanto entra por dia, semana e mês, e a
// sugestão de estoque mínimo e máximo (regras puras, testadas em
// estoque-ritmo.test.mjs). Pedido do dono, 27/10/2026: "que eu possa criar um
// estoque mínimo e máximo conforme o sistema entenda quanto eu retiro e
// quanto eu adiciono por dia, semana e mês".
//
// Natureza dos números: o ritmo é REAL (soma dos movimentos gravados); a
// sugestão de mínimo/máximo é ESTIMATIVA. Sem histórico suficiente, não há
// sugestão: DADOS INSUFICIENTES, com o motivo.
//
// Conta como saída o que tirou o produto do local (consumo, perda, uso,
// transferência enviada). Não conta: estorno, ajuste de contagem/inventário
// (corrigem número, não são uso) e o movimento estornado.

export const PADRAO_RITMO = Object.freeze({
  janelaDias: 60,        // histórico olhado
  minimoDiasHistorico: 14, // menos que isso: insuficiente
  minimoSaidas: 3,       // menos saídas que isso: insuficiente
  prazoReposicaoDias: 2, // do pedido até chegar
  segurancaDias: 2,      // folga para semana mais forte
  intervaloCompraDias: 7, // de quanto em quanto tempo compra
});

const DIA = 86400000;
const NAO_E_USO = /^(estorno|ajuste|inventario|contagem|correcao|correção)/i;

/** O movimento conta como uso/reposição real? (estorno e ajuste de contagem não contam) */
export function movimentoConta(m) {
  if (!m || m.estornado || m.estorno_de_id) return false;
  if (NAO_E_USO.test(String(m.motivo || ""))) return false;
  if (m.inventario_id) return false;
  return m.tipo === "entrada" || m.tipo === "saida";
}

const arred = (n, casas = 3) => Math.round(n * 10 ** casas) / 10 ** casas;

/**
 * Ritmo de um produto num local.
 * @param {Array} movimentos [{ tipo, quantidade, motivo, created_at, estorno_de_id, inventario_id, estornado }]
 * @param {object} opcoes { hoje: Date, janelaDias, minimoDiasHistorico, minimoSaidas }
 */
export function ritmoDoProduto(movimentos, opcoes = {}) {
  const cfg = { ...PADRAO_RITMO, ...opcoes };
  const hoje = cfg.hoje instanceof Date ? cfg.hoje : new Date();
  const inicioJanela = hoje.getTime() - cfg.janelaDias * DIA;
  const validos = (movimentos || []).filter(movimentoConta)
    .map((m) => ({ ...m, t: new Date(m.created_at || m.data_movimento).getTime(), q: Math.abs(Number(m.quantidade) || 0) }))
    .filter((m) => Number.isFinite(m.t) && m.t >= inicioJanela && m.t <= hoje.getTime() && m.q > 0);

  const saidas = validos.filter((m) => m.tipo === "saida");
  const entradas = validos.filter((m) => m.tipo === "entrada");
  const totalSaida = saidas.reduce((s, m) => s + m.q, 0);
  const totalEntrada = entradas.reduce((s, m) => s + m.q, 0);

  // Dias de histórico: do primeiro movimento da janela até hoje (produto novo
  // não é dividido por 60 dias que ele não tinha).
  const primeiro = validos.length ? Math.min(...validos.map((m) => m.t)) : null;
  const diasHistorico = primeiro == null ? 0 : Math.max(1, Math.ceil((hoje.getTime() - primeiro) / DIA));

  const porDia = (total) => (diasHistorico ? total / diasHistorico : 0);
  const saida = { dia: arred(porDia(totalSaida)), semana: arred(porDia(totalSaida) * 7), mes: arred(porDia(totalSaida) * 30), total: arred(totalSaida), vezes: saidas.length };
  const entrada = { dia: arred(porDia(totalEntrada)), semana: arred(porDia(totalEntrada) * 7), mes: arred(porDia(totalEntrada) * 30), total: arred(totalEntrada), vezes: entradas.length };

  let insuficiente = null;
  if (!validos.length) insuficiente = "Sem entradas nem retiradas registradas neste local.";
  else if (diasHistorico < cfg.minimoDiasHistorico) insuficiente = `Só ${diasHistorico} dia(s) de histórico; precisa de ${cfg.minimoDiasHistorico}.`;
  else if (saidas.length < cfg.minimoSaidas) insuficiente = `Só ${saidas.length} retirada(s) no período; precisa de ${cfg.minimoSaidas}.`;

  return { diasHistorico, saida, entrada, insuficiente, natureza: "REAL" };
}

/**
 * Sugestão de mínimo e máximo pelo ritmo de saída.
 *   mínimo = saída por dia × (prazo de reposição + folga)
 *   máximo = mínimo + saída por dia × intervalo entre compras
 * Arredonda para cima na unidade do produto (inteiro quando ele é contado em
 * unidade/garrafa/pacote).
 */
export function sugerirMinMax(ritmo, opcoes = {}) {
  const cfg = { ...PADRAO_RITMO, ...opcoes };
  if (!ritmo || ritmo.insuficiente) return { ok: false, motivo: ritmo?.insuficiente || "Sem ritmo calculado.", natureza: "DADOS INSUFICIENTES" };
  const d = ritmo.saida.dia;
  if (!(d > 0)) return { ok: false, motivo: "Nada saiu no período.", natureza: "DADOS INSUFICIENTES" };
  const inteiro = cfg.inteiro === true;
  const cima = (n) => (inteiro ? Math.ceil(n - 1e-9) : Math.ceil(n * 100 - 1e-9) / 100);
  const minimo = cima(d * (cfg.prazoReposicaoDias + cfg.segurancaDias));
  const maximo = Math.max(minimo, cima(minimo + d * cfg.intervaloCompraDias));
  return {
    ok: true, minimo, maximo, natureza: "ESTIMATIVA",
    explicacao: `Sai ${fmt(d)}/dia. Mínimo = ${cfg.prazoReposicaoDias + cfg.segurancaDias} dias de uso (reposição ${cfg.prazoReposicaoDias} + folga ${cfg.segurancaDias}); máximo = mínimo + ${cfg.intervaloCompraDias} dias (compra a cada ${cfg.intervaloCompraDias}).`,
  };
}

const fmt = (n) => (Math.round(n * 100) / 100).toLocaleString("pt-BR");

/** Dias que o saldo atual aguenta no ritmo de saída (null sem ritmo). */
export function coberturaDias(saldo, ritmo) {
  const d = ritmo?.saida?.dia;
  if (!ritmo || ritmo.insuficiente || !(d > 0)) return null;
  return Math.floor((Number(saldo) || 0) / d);
}

/** Situação do item contra mínimo e máximo gravados. */
export function situacaoDoItem({ saldo, minimo, maximo }) {
  const s = Number(saldo) || 0;
  const mn = Number(minimo) || 0;
  const mx = Number(maximo) || 0;
  if (s <= 0) return "zerado";
  if (mn > 0 && s < mn) return "baixo";
  if (mx > 0 && s > mx) return "acima";
  return "ok";
}

/** A unidade é contada inteira (un, garrafa, pacote, caixa…)? */
export function unidadeInteira(unidade) {
  return /^(un|und|unid|unidade|unidades|garrafa|garrafas|lata|latas|pct|pacote|pacotes|cx|caixa|caixas|rolo|rolos|galao|galão|fardo|fardos|dz|duzia)$/i.test(String(unidade || "").trim());
}
