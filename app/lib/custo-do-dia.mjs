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
//   - equipe: cadastro do RH (salário, vale, taxa de serviço) e diárias pagas
//     dos extras (calcularCMO, cmo.mjs);
//   - pró-labore: proLaboreDoMes (composicao-preco.mjs);
//   - quanto sobra de cada venda: meta de CMV + despesas variáveis da casa
//     (DESPESAS_VARIAVEIS) ou as taxas do app do Delivery.
//
// Natureza: contas = INFORMADO pelo dono; equipe fixa = REAL (cadastro do RH);
// extras por dia = ESTIMATIVA (diárias pagas no mês ÷ dias de operação);
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

/* A equipe por turno, pessoa por pessoa.
 *
 * Contratado: (salário + vale-alimentação + taxa de serviço do mês + encargos
 * sobre o salário) ÷ dias de operação. Extra: a diária do cadastro já é o
 * custo de um dia — ele custa isso nos dias em que vem; dividir de novo diria
 * que um extra de R$ 130 custa R$ 5 por dia.
 * Contratado sem salário no cadastro não vira zero escondido: entra em
 * `semSalario`, para a tela avisar que falta dado.
 */
export function equipePorTurno(colaboradores = [], { dias = 0, encargosPct = 0 } = {}) {
  const d = pos(dias);
  const enc = pos(encargosPct);
  const turnos = TURNOS.map((t) => ({ ...t, fixos: [], extras: [], fixoMes: 0, fixoDia: 0, extrasDiaria: 0 }));
  const porId = Object.fromEntries(turnos.map((t) => [t.id, t]));
  const semSalario = [];

  for (const c of colaboradores || []) {
    if (!c || !ativo(c)) continue;
    const t = porId[turnoDoHorario(c.horario_entrada)];
    const base = { id: c.id, nome: c.nome || "Sem nome", cargo: c.cargo || "" };
    if (ehExtra(c)) {
      const diaria = pos(c.salario);
      if (diaria <= 0) { semSalario.push({ ...base, extra: true }); continue; }
      t.extras.push({ ...base, diaria });
      t.extrasDiaria += diaria;
      continue;
    }
    const salario = pos(c.salario);
    if (salario <= 0) { semSalario.push({ ...base, extra: false }); continue; }
    const mes = salario + pos(c.vale_alimentacao) + pos(c.taxa_servico_mes) + (salario * enc) / 100;
    const dia = d > 0 ? mes / d : null;
    t.fixos.push({ ...base, mes, dia });
    t.fixoMes += mes;
  }

  for (const t of turnos) {
    t.fixos.sort((a, b) => b.mes - a.mes);
    t.extras.sort((a, b) => b.diaria - a.diaria);
    t.fixoDia = d > 0 ? t.fixoMes / d : null;
  }
  const fixoMes = turnos.reduce((s, t) => s + t.fixoMes, 0);
  return {
    turnos: turnos.filter((t) => t.fixos.length || t.extras.length),
    fixoMes,
    fixoDia: d > 0 ? fixoMes / d : null,
    pessoasFixas: turnos.reduce((s, t) => s + t.fixos.length, 0),
    pessoasExtras: turnos.reduce((s, t) => s + t.extras.length, 0),
    semSalario,
  };
}

/* Percentual de cada venda que vai embora antes de pagar qualquer conta:
 * meta de CMV + imposto + (no salão) maquininha e comissões da casa, ou (no
 * app) as taxas percentuais do app. Taxa fixa por pedido e entrega paga pela
 * loja não entram: dependem de quantos pedidos, não do valor vendido.
 *
 * canal: null = salão/balcão; senão { nome, regras } de regrasDoCanalDelivery.
 */
export function descontosDaVenda(params = {}, canal = null) {
  const partes = [];
  const add = (rotulo, pct) => { if (pos(pct) > 0) partes.push({ rotulo, pct: pos(pct) }); };
  add("CMV (meta)", params.meta_cmv);
  add("Imposto", params.imposto_pct);
  if (!canal) {
    for (const [chave, rotulo] of DESPESAS_VARIAVEIS) if (chave !== "imposto_pct") add(rotulo, params[chave]);
  } else {
    for (const r of canal.regras || []) {
      if (r.tipo !== "percentual") continue;
      // O imposto da casa já entrou acima: não cobrar duas vezes.
      if (/imposto/i.test(r.nome || "")) continue;
      add(`${r.nome} (${canal.nome})`, r.valor);
    }
  }
  const pct = partes.reduce((s, p) => s + p.pct, 0);
  return { partes, pct, sobraPct: 100 - pct, temMetaCmv: pos(params.meta_cmv) > 0 };
}

/* O custo do dia inteiro, conta por conta, e a venda mínima para pagá-lo. */
export function custoDoDia({ params = {}, colaboradores = [], extrasPagosMes = 0, canal = null, referencia = new Date() } = {}) {
  const dias = pos(params.dias_operacao_mes);
  const temDias = dias > 0;
  const contas = contasPorDia(params, dias);
  const equipe = equipePorTurno(colaboradores, { dias, encargosPct: params.encargos_folha_pct });
  const extrasMes = pos(extrasPagosMes);
  const proLabore = proLaboreDoMes(params.pro_labore, referencia);

  const porDia = (mes) => (temDias ? mes / dias : null);
  // Ordem do simulador: primeiro quem trabalha, depois a casa, por último a
  // retirada dos sócios. É a ordem em que o dinheiro do dia costuma ir embora.
  const linhas = [];
  if (equipe.fixoMes > 0) linhas.push({ id: "equipe", grupo: "equipe", rotulo: "Equipe fixa", mes: equipe.fixoMes, dia: porDia(equipe.fixoMes), natureza: "REAL" });
  if (extrasMes > 0) linhas.push({ id: "extras", grupo: "equipe", rotulo: "Extras (média do mês)", mes: extrasMes, dia: porDia(extrasMes), natureza: "ESTIMATIVA" });
  for (const c of contas.itens) linhas.push({ id: c.chave, grupo: "casa", rotulo: c.rotulo, mes: c.mes, dia: porDia(c.mes), natureza: "INFORMADO" });
  for (const p of proLabore.partes) linhas.push({ id: `pl-${p.rotulo}`, grupo: "prolabore", rotulo: `Pró-labore · ${p.rotulo}`, mes: p.valor, dia: porDia(p.valor), natureza: "INFORMADO" });

  const totalMes = linhas.reduce((s, l) => s + l.mes, 0);
  const totalDia = porDia(totalMes);
  const descontos = descontosDaVenda(params, canal);

  let vendaMinimaDia = null;
  let motivo = null;
  if (!temDias) motivo = "Informe quantos dias a casa abre no mês para ver o custo por dia.";
  else if (totalMes <= 0) motivo = "Nenhum custo cadastrado: preencha aluguel, energia, água e a equipe no RH.";
  else if (descontos.sobraPct <= 0) motivo = `CMV e taxas somam ${descontos.pct.toFixed(1).replace(".", ",")}% da venda: não sobra nada para pagar as contas, em nenhum valor de venda.`;
  else vendaMinimaDia = Math.ceil((totalDia / (descontos.sobraPct / 100)) * 100) / 100;

  return {
    dias, temDias, linhas, contas, equipe, proLabore,
    extrasMes, extrasDia: porDia(extrasMes),
    totalMes, totalDia,
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
