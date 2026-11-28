// CUSTO POR DIA (pedido do dono, 28/11/2026):
// "Quanto é que eu gasto por dia de aluguel? De luz? Com um funcionário? Na
// equipe da manhã? De água? Quanto é que eu preciso vender por dia para me
// pagar todos esses custos?" — e o simulador do dia: "vendi X, o sistema
// mostra o que consegui pagar, qual meu custo diário antes do lucro, se faltou
// ou se já estou no lucro".
//
// Funções puras (testes em custo-do-dia.test.mjs). Reaproveita as fontes que
// já existem, sem conta paralela:
//   - contas da casa: config_sistema.params (contasPorDia, custo-diario.mjs);
//   - equipe contratada: cadastro do RH (salário, vale, taxa de serviço);
//   - extras: SÓ os recibos gerados (dono, 28/11/2026: "o funcionário que é
//     extra, o custo dele só vai aparecer no final da noite, quando eu gerar um
//     recibo dele"). Extra não entra em equipe, turno nem média do mês;
//   - pró-labore: proLaboreDoMes (composicao-preco.mjs);
//   - quanto sobra de cada venda: meta de CMV + despesas variáveis da casa
//     (DESPESAS_VARIAVEIS) ou as taxas do app do Delivery.
//
// Natureza: contas = INFORMADO pelo dono; equipe contratada = REAL (cadastro do
// RH); extras desta noite = REAL (recibos gerados com a data de hoje);
// venda mínima e simulação = ESTIMATIVA (usam a META de CMV, não o CMV real).
// Sem dias de operação não há "por dia": DADOS INSUFICIENTES.

import { DESPESAS_VARIAVEIS, proLaboreDoMes } from "./composicao-preco.mjs";
import { contasPorDia } from "./custo-diario.mjs";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const pos = (v) => Math.max(0, num(v));
const cent = (v) => Math.round(Number((num(v) * 100).toFixed(6)));

const ativo = (c) => (c?.status || "ativo") !== "inativo" && c?.ativo !== false;
const ehExtra = (c) => String(c?.tipo_contrato || "") === "Freelancer";

// Turno pelo horário de ENTRADA do cadastro. O RH não tem campo de turno; o
// horário de entrada é o que diz em que equipe a pessoa trabalha.
export const TURNOS = [
  { id: "manha", rotulo: "Equipe da manhã", ajuda: "entra antes das 12h" },
  { id: "tarde", rotulo: "Equipe da tarde", ajuda: "entra das 12h às 17h59" },
  { id: "noite", rotulo: "Equipe da noite", ajuda: "entra a partir das 18h" },
  { id: "sem_horario", rotulo: "Sem horário no cadastro", ajuda: "preencha o horário de entrada no RH" },
];

export function turnoDoHorario(hora) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || "").trim());
  if (!m) return "sem_horario";
  const h = Number(m[1]);
  if (!(h >= 0 && h <= 23)) return "sem_horario";
  if (h < 12) return "manha";
  if (h < 18) return "tarde";
  return "noite";
}

/* A equipe CONTRATADA por turno (contrato definitivo ou provisório), pessoa
 * por pessoa: (salário + vale-alimentação + taxa de serviço do mês + encargos
 * sobre o salário) ÷ dias de operação.
 * Extra (tipo_contrato Freelancer) não entra aqui de jeito nenhum: o custo
 * dele é o recibo da noite (extrasDoDia). Só é contado em `pessoasExtras`.
 * Contratado sem salário no cadastro não vira zero escondido: entra em
 * `semSalario`, para a tela avisar que falta dado.
 */
export function equipePorTurno(colaboradores = [], { dias = 0, encargosPct = 0 } = {}) {
  const d = pos(dias);
  const enc = pos(encargosPct);
  const turnos = TURNOS.map((t) => ({ ...t, fixos: [], fixoMes: 0, fixoDia: 0 }));
  const porId = Object.fromEntries(turnos.map((t) => [t.id, t]));
  const semSalario = [];
  let extras = 0;

  for (const c of colaboradores || []) {
    if (!c || !ativo(c)) continue;
    const t = porId[turnoDoHorario(c.horario_entrada)];
    const base = { id: c.id, nome: c.nome || "Sem nome", cargo: c.cargo || "" };
    if (ehExtra(c)) { extras++; continue; }
    const salario = pos(c.salario);
    if (salario <= 0) { semSalario.push({ ...base, extra: false }); continue; }
    const mes = salario + pos(c.vale_alimentacao) + pos(c.taxa_servico_mes) + (salario * enc) / 100;
    const dia = d > 0 ? mes / d : null;
    t.fixos.push({ ...base, mes, dia });
    t.fixoMes += mes;
  }

  for (const t of turnos) {
    t.fixos.sort((a, b) => b.mes - a.mes);
    t.fixoDia = d > 0 ? t.fixoMes / d : null;
  }
  const fixoMes = turnos.reduce((s, t) => s + t.fixoMes, 0);
  return {
    turnos: turnos.filter((t) => t.fixos.length),
    fixoMes,
    fixoDia: d > 0 ? fixoMes / d : null,
    pessoasFixas: turnos.reduce((s, t) => s + t.fixos.length, 0),
    pessoasExtras: extras,
    semSalario,
  };
}

/* Extras de um dia: os recibos gerados com aquela data de trabalho. Também
 * soma o mês, só para referência. O recibo é o custo: pago ou ainda a pagar.
 * data: "AAAA-MM-DD" (dia local de quem olha).
 */
export function extrasDoDia(recibos = [], colaboradores = [], data = "") {
  const dia = String(data || "").slice(0, 10);
  const mes = dia.slice(0, 7);
  const nomes = new Map((colaboradores || []).filter(Boolean).map((c) => [c.id, c.nome || "Sem nome"]));
  const doDia = [];
  let mesTotal = 0;
  let mesRecibos = 0;
  for (const r of recibos || []) {
    if (!r) continue;
    const d = String(r.data_trabalho || "").slice(0, 10);
    const v = pos(r.valor_total);
    if (!d || v <= 0) continue;
    if (d.slice(0, 7) === mes) { mesTotal += v; mesRecibos++; }
    if (d === dia) doDia.push({ id: r.id, nome: nomes.get(r.colaborador_id) || r.nome_prestador || "Extra", valor: v, pago: !!r.pagamento_realizado });
  }
  doDia.sort((a, b) => b.valor - a.valor);
  return { data: dia, recibos: doDia, total: doDia.reduce((s, x) => s + x.valor, 0), mesTotal, mesRecibos };
}

/* Percentual de cada venda que vai embora antes de pagar qualquer conta:
 * meta de CMV + imposto + (no salão) maquininha e comissões da casa, ou (no
 * app) as taxas percentuais do app e a promoção paga pela loja.
 * Taxa fixa por pedido e entrega paga pela loja dependem de quantos pedidos:
 * só entram com o pedido médio (`ticketMedio`), viram % dele. Sem pedido
 * médio, `fixosSemTicket` avisa a tela.
 *
 * canal: null = salão/balcão; senão { nome, regras, descontoLojaPct } de
 * regrasDoCanalDelivery.
 */
export function descontosDaVenda(params = {}, canal = null, { ticketMedio = 0 } = {}) {
  const partes = [];
  const add = (rotulo, pct) => { if (pos(pct) > 0) partes.push({ rotulo, pct: pos(pct) }); };
  add("CMV (meta)", params.meta_cmv);
  add("Imposto", params.imposto_pct);
  if (!canal) {
    for (const [chave, rotulo] of DESPESAS_VARIAVEIS) if (chave !== "imposto_pct") add(rotulo, params[chave]);
  } else {
    let fixos = 0;
    for (const r of canal.regras || []) {
      if (r.tipo === "fixo_pedido") { fixos += pos(r.valor); continue; }
      if (r.tipo !== "percentual") continue;
      // O imposto da casa já entrou acima: não cobrar duas vezes.
      if (/imposto/i.test(r.nome || "")) continue;
      add(`${r.nome} (${canal.nome})`, r.valor);
    }
    add(`Promoção paga pela loja (${canal.nome})`, canal.descontoLojaPct);
    const t = pos(ticketMedio);
    if (fixos > 0 && t > 0) add(`Taxas por pedido (${canal.nome})`, (fixos / t) * 100);
    const pct = partes.reduce((s, p) => s + p.pct, 0);
    return { partes, pct, sobraPct: 100 - pct, temMetaCmv: pos(params.meta_cmv) > 0, fixosPorPedido: fixos, fixosSemTicket: fixos > 0 && !(t > 0) };
  }
  const pct = partes.reduce((s, p) => s + p.pct, 0);
  return { partes, pct, sobraPct: 100 - pct, temMetaCmv: pos(params.meta_cmv) > 0, fixosPorPedido: 0, fixosSemTicket: false };
}

/* O custo do dia inteiro, conta por conta, e a venda mínima para pagá-lo. */
export function custoDoDia({ params = {}, colaboradores = [], extrasHoje = 0, canal = null, ticketMedio = 0, referencia = new Date() } = {}) {
  const dias = pos(params.dias_operacao_mes);
  const temDias = dias > 0;
  const contas = contasPorDia(params, dias);
  const equipe = equipePorTurno(colaboradores, { dias, encargosPct: params.encargos_folha_pct });
  const extras = pos(extrasHoje);
  const proLabore = proLaboreDoMes(params.pro_labore, referencia);

  const porDia = (mes) => (temDias ? mes / dias : null);
  // Ordem do simulador: primeiro quem trabalha, depois a casa, por último a
  // retirada dos sócios. É a ordem em que o dinheiro do dia costuma ir embora.
  const linhas = [];
  if (equipe.fixoMes > 0) linhas.push({ id: "equipe", grupo: "equipe", rotulo: "Equipe contratada", mes: equipe.fixoMes, dia: porDia(equipe.fixoMes), natureza: "REAL" });
  for (const c of contas.itens) linhas.push({ id: c.chave, grupo: "casa", rotulo: c.rotulo, mes: c.mes, dia: porDia(c.mes), natureza: "INFORMADO" });
  for (const p of proLabore.partes) linhas.push({ id: `pl-${p.rotulo}`, grupo: "prolabore", rotulo: `Pró-labore · ${p.rotulo}`, mes: p.valor, dia: porDia(p.valor), natureza: "INFORMADO" });

  const totalMes = linhas.reduce((s, l) => s + l.mes, 0);
  const totalDia = porDia(totalMes);
  const descontos = descontosDaVenda(params, canal, { ticketMedio });
  // Hoje = o custo fixo do dia + os extras dos recibos desta noite.
  const linhasHoje = extras > 0 && temDias
    ? [...linhas.slice(0, equipe.fixoMes > 0 ? 1 : 0), { id: "extras_hoje", grupo: "extras", rotulo: "Extras desta noite (recibos)", mes: null, dia: extras, natureza: "REAL" }, ...linhas.slice(equipe.fixoMes > 0 ? 1 : 0)]
    : linhas;
  const totalHoje = totalDia != null ? totalDia + extras : null;

  let vendaMinimaDia = null;
  let motivo = null;
  if (!temDias) motivo = "Informe quantos dias a casa abre no mês para ver o custo por dia.";
  else if (totalMes <= 0) motivo = "Nenhum custo cadastrado: preencha aluguel, energia, água e a equipe no RH.";
  else if (descontos.sobraPct <= 0) motivo = `CMV e taxas somam ${descontos.pct.toFixed(1).replace(".", ",")}% da venda: não sobra nada para pagar as contas, em nenhum valor de venda.`;
  else vendaMinimaDia = Math.ceil((totalDia / (descontos.sobraPct / 100)) * 100) / 100;

  const minima = (valorDia) => (valorDia != null && descontos.sobraPct > 0 && !motivo ? Math.ceil((valorDia / (descontos.sobraPct / 100)) * 100) / 100 : null);
  return {
    dias, temDias, linhas, linhasHoje, contas, equipe, proLabore,
    extrasHoje: extras,
    totalMes, totalDia, totalHoje,
    vendaMinimaHoje: extras > 0 ? minima(totalHoje) : vendaMinimaDia,
    grupos: {
      equipe: linhas.filter((l) => l.grupo === "equipe").reduce((s, l) => s + l.mes, 0),
      casa: contas.totalMes,
      prolabore: proLabore.total,
    },
    descontos,
    vendaMinimaDia,
    vendaMinimaMes: vendaMinimaDia != null ? vendaMinimaDia * dias : null,
    motivo,
  };
}

/* Simulador do dia: com a venda de hoje, o que deu para pagar.
 *
 * De cada venda sai primeiro o CMV e as taxas (descontos.pct); o que sobra
 * paga as contas do dia, na ordem das linhas, até acabar. Contas em centavos:
 * pago + falta de cada linha bate com o custo da linha, e a soma dos pagos
 * bate com o que sobrou da venda (ou com o custo do dia, quando sobrou mais).
 */
export function oQueAVendaPagou({ venda = 0, sobraPct = 0, linhas = [] } = {}) {
  const vendaC = cent(pos(venda));
  const sobraC = Math.max(0, Math.round((vendaC * num(sobraPct)) / 100));
  let resta = sobraC;
  const pagas = (linhas || []).filter((l) => l.dia != null).map((l) => {
    const custoC = cent(l.dia);
    const pagoC = Math.min(custoC, resta);
    resta -= pagoC;
    const faltaC = custoC - pagoC;
    return { ...l, custoC, pagoC, faltaC, status: faltaC === 0 ? "pago" : pagoC > 0 ? "parcial" : "falta" };
  });
  const custoDiaC = pagas.reduce((s, l) => s + l.custoC, 0);
  const pagoC = pagas.reduce((s, l) => s + l.pagoC, 0);
  return {
    vendaC,
    saiuAntesC: vendaC - sobraC,
    sobraC,
    custoDiaC,
    pagoC,
    faltouC: custoDiaC - pagoC,
    lucroC: resta,
    pctCoberto: custoDiaC > 0 ? Math.min(100, (pagoC / custoDiaC) * 100) : null,
    linhas: pagas,
    situacao: vendaC <= 0 ? "sem_venda" : custoDiaC - pagoC > 0 ? "faltou" : resta > 0 ? "lucro" : "empatou",
  };
}

/* CMO pessoa por pessoa (dono, 28/11/2026: "dentro do CMO a porcentagem de
 * cada funcionário cadastrado ou extra também").
 *
 * Peso de cada pessoa no mês: contratado = salário + vale + taxa de serviço +
 * encargos; extra = diárias PAGAS a ele no mês (recibos). O CMO que cabe num
 * produto é repartido por esses pesos, em centavos, somando exatamente o
 * valor do grupo. É ESTIMATIVA: o peso vem do cadastro e dos recibos de hoje.
 */
export function pesosDaEquipeNoMes({ colaboradores = [], recibos = [], encargosPct = 0, referencia = new Date() } = {}) {
  const ref = new Date(referencia);
  const de = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-01`;
  const ate = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}-31`;
  const pagoNoMes = new Map();
  for (const r of recibos || []) {
    if (!r?.pagamento_realizado || !r.colaborador_id) continue;
    const d = String(r.data_pagamento || r.data_trabalho || "").slice(0, 10);
    if (d < de || d > ate) continue;
    pagoNoMes.set(r.colaborador_id, (pagoNoMes.get(r.colaborador_id) || 0) + pos(r.valor_total));
  }
  const enc = pos(encargosPct);
  const pessoas = [];
  for (const c of colaboradores || []) {
    if (!c || !ativo(c)) continue;
    const base = { id: c.id, nome: c.nome || "Sem nome", cargo: c.cargo || "", extra: ehExtra(c) };
    const mes = ehExtra(c)
      ? pagoNoMes.get(c.id) || 0
      : pos(c.salario) > 0 ? pos(c.salario) + pos(c.vale_alimentacao) + pos(c.taxa_servico_mes) + (pos(c.salario) * enc) / 100 : 0;
    if (mes > 0) pessoas.push({ ...base, mes });
  }
  return pessoas.sort((a, b) => b.mes - a.mes);
}

/** Reparte `valorC` centavos pelos pesos `mes` (maior resto): soma exata. */
export function repartirPorPeso(valorC, pessoas = []) {
  const total = (pessoas || []).reduce((s, p) => s + pos(p.mes), 0);
  const v = Math.round(num(valorC));
  if (!(total > 0) || v === 0) return (pessoas || []).map((p) => ({ ...p, centavos: 0, parte: 0 }));
  const exatos = pessoas.map((p) => (v * pos(p.mes)) / total);
  const base = exatos.map((x) => Math.floor(x));
  let falta = v - base.reduce((s, x) => s + x, 0);
  const ordem = exatos.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; falta > 0; k = (k + 1) % ordem.length, falta--) base[ordem[k][1]]++;
  return pessoas.map((p, i) => ({ ...p, centavos: base[i], parte: (pos(p.mes) / total) * 100 }));
}
