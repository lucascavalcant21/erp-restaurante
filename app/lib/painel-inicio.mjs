// Cálculos da tela inicial do painel. Tudo aqui é puro (recebe as linhas que
// os módulos já gravam e devolve números) para dar para testar sem banco.
//
// A tela inicial era um protótipo com números escritos à mão — "R$ 8.542",
// "Boa noite, Lucas" às onze da manhã, um casamento de exemplo. Cada número
// daqui sai da mesma regra que a tela do módulo usa, para os dois nunca
// discordarem.

import { normalizarEtapa } from "./evento-financeiro.mjs";

const SIGLAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

export function dataLocalISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Mesma faixa do relógio de ponto: madrugada ainda é "boa noite".
export function saudacao(agora = new Date()) {
  const h = agora.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

export function primeiroNome(nome) {
  const n = String(nome || "").trim().split(/\s+/)[0] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
}

// ─── Faturamento ─────────────────────────────────────────────────────────────

// A receita oficial é o faturamento diário informado (fin_faturamento_diario:
// vendas − cancelamentos − descontos), o mesmo do CMV % e do DRE. A tabela
// vendas (PDV interno) está vazia: as vendas da casa estão no Saipos.
export function seteDiasAte(agora = new Date()) {
  const de = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 6);
  return { de: dataLocalISO(de), ate: dataLocalISO(agora) };
}

// Dia sem lançamento fica null — nunca zero: zero é "a casa não vendeu".
export function resumirFaturamentoDiario(registros, agora = new Date()) {
  const porDia = new Map((registros || []).map((r) => [String(r.data).slice(0, 10), Number(r.receita)]));
  const dias = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i);
    const iso = dataLocalISO(d);
    const v = porDia.get(iso);
    dias.push({ iso, sigla: i === 0 ? "hoje" : SIGLAS[d.getDay()], dia: d.getDate(), total: Number.isFinite(v) ? r2(v) : null, hoje: i === 0, ontem: i === 1 });
  }
  const lancados = dias.filter((d) => d.total !== null);
  const ultimo = lancados[lancados.length - 1] || null;
  const outros = lancados.filter((d) => d !== ultimo);
  return {
    dias,
    ultimo: ultimo && { ...ultimo, rotulo: ultimo.hoje ? "Hoje" : ultimo.ontem ? "Ontem" : `${ultimo.sigla} ${String(ultimo.dia).padStart(2, "0")}` },
    mediaOutros: outros.length ? r2(outros.reduce((s, d) => s + d.total, 0) / outros.length) : null,
    totalLancado: r2(lancados.reduce((s, d) => s + d.total, 0)),
    diasLancados: lancados.length,
    diasSemLancamento: dias.filter((d) => d.total === null && !d.hoje).length,
  };
}

// Variação percentual; sem base (ontem zerado) não há comparação honesta.
export function variacao(atual, anterior) {
  const a = Number(atual) || 0;
  const b = Number(anterior) || 0;
  if (b <= 0) return null;
  return (a - b) / b;
}

// ─── Equipe (ponto do dia) ───────────────────────────────────────────────────

// Recebe o resultado de fetchPontoHoje: um registro por pessoa, já incluindo a
// jornada de ontem que virou a madrugada.
export function resumirEquipe(registros) {
  let trabalhando = 0, intervalo = 0, encerraram = 0;
  for (const r of registros || []) {
    if (!r?.hora_entrada) continue;
    if (r.hora_saida) { encerraram++; continue; }
    if (r.hora_saida_intervalo && !r.hora_retorno_intervalo) { intervalo++; continue; }
    trabalhando++;
  }
  return { trabalhando, intervalo, encerraram, presentes: trabalhando + intervalo };
}

// ─── Reservas e eventos ──────────────────────────────────────────────────────

export function reservasDoDia(reservas, hojeIso) {
  const lista = (reservas || [])
    .filter((r) => String(r?.data_reserva || "").slice(0, 10) === hojeIso)
    .filter((r) => !/cancel/i.test(String(r?.status || "")))
    .sort((a, b) => String(a.horario || "").localeCompare(String(b.horario || "")));
  return { lista, pessoas: lista.reduce((s, r) => s + (Number(r.qtd_pessoas) || 0), 0) };
}

// Eventos de hoje em diante que ainda vão acontecer. Cancelado e finalizado
// saem; a etapa passa pelo mesmo normalizador do funil.
export function proximosEventos(eventos, hojeIso, { dias = 30 } = {}) {
  const [a, m, d] = hojeIso.split("-").map(Number);
  const limiteIso = dataLocalISO(new Date(a, m - 1, d + dias));
  const futuros = (eventos || [])
    .map((e) => ({ ...e, dataIso: String(e?.data_evento || "").slice(0, 10), etapa: normalizarEtapa(e?.funil_status) }))
    .filter((e) => e.dataIso && e.dataIso >= hojeIso)
    .filter((e) => e.etapa !== "CANCELADO" && e.etapa !== "FINALIZADO")
    .sort((x, y) => x.dataIso.localeCompare(y.dataIso));
  return { lista: futuros, noPeriodo: futuros.filter((e) => e.dataIso <= limiteIso).length };
}

// ─── Contas a pagar ──────────────────────────────────────────────────────────

// Mesma regra da tela Contas a Pagar (resumoContas): conta aberta é pendente,
// parcial ou vencido; "vencida" vem pronta da view vw_fin_contas_pagar.
export function resumirContas(contas, hojeIso) {
  const abertas = (contas || []).filter((c) => ["pendente", "parcial", "vencido"].includes(c?.situacao));
  const vencidas = abertas.filter((c) => c.vencida || c.situacao === "vencido");
  const hoje = abertas.filter((c) => !(c.vencida || c.situacao === "vencido") && String(c.data_vencimento || "").slice(0, 10) === hojeIso);
  const soma = (xs) => r2(xs.reduce((s, c) => s + (Number(c.saldo) || 0), 0));
  return {
    vencidas: { qtd: vencidas.length, valor: soma(vencidas) },
    hoje: { qtd: hoje.length, valor: soma(hoje) },
  };
}

// ─── Estoque e mesas ─────────────────────────────────────────────────────────

// Mesma conta dos cartões da tela de Estoque (fetchEstoques): só entra item
// com mínimo definido (> 0) e saldo abaixo dele. Item zerado sem mínimo não é
// "crítico" — é item que ninguém configurou.
export function estoqueAbaixoDoMinimo(estoques, itens) {
  const nomes = new Map((estoques || []).map((e) => [e.id, e.nome]));
  const porEstoque = new Map();
  let total = 0;
  for (const it of itens || []) {
    if (!nomes.has(it.estoque_id)) continue;
    const minimo = Number(it.estoque_minimo);
    if (!(Number.isFinite(minimo) && minimo > 0)) continue;
    if (!(Number(it.quantidade_atual || 0) < minimo)) continue;
    total++;
    porEstoque.set(it.estoque_id, (porEstoque.get(it.estoque_id) || 0) + 1);
  }
  const lista = [...porEstoque.entries()]
    .map(([id, qtd]) => ({ id, nome: nomes.get(id), qtd }))
    .sort((a, b) => b.qtd - a.qtd);
  return { total, porEstoque: lista };
}

export function resumirMesas(mesas) {
  const total = (mesas || []).length;
  const ocupadas = (mesas || []).filter((m) => (m?.comandas?.length || 0) > 0).length;
  return { total, ocupadas, taxa: total ? ocupadas / total : 0 };
}
