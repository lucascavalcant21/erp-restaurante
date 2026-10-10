// CENTRAL FINANCEIRA — motor puro (sem banco, sem React). Recebe o que as
// fontes oficiais devolveram e monta tudo o que a tela mostra. A tela não
// calcula nada; aqui não se inventa nada.
//
// Fontes (todas por unidade):
//   a pagar ............ vw_fin_contas_pagar   (saldo em aberto, vencida)        → resumoContas
//   a receber .......... vw_fin_contas_receber (saldo_bruto, situacao)            → resumoReceber
//   entradas/saídas .... vw_fin_fluxo_caixa    (natureza=realizado, direcao)      → resumoFluxo
//   saldo gerencial .... vw_fin_saldo_contas_financeiras
//   faturamento ........ fin_faturamento_diario (receita = vendas − cancel. − desc.)
//   CMV ................ inventários fechados + compras (cmv-real.mjs, último período fechado)
//   CMO ................ RH (salários) + recibos de extras pagos (cmo.mjs)
//   custos fixos ....... config_sistema.params.custos_fixos (custos-fixos.js)
//
// Estados de cada número (nunca R$ 0,00 quando não se sabe):
//   ok · zero (zero real, a fonte respondeu) · parcial · nao_apurado (fonte
//   existe, faltam dados) · insuficiente (depende de outro número ausente) ·
//   erro (a fonte não respondeu) · nao_calculado (depende de um fechamento que
//   ainda não existe, ex.: inventário fechado para o CMV realizado).
//
// Faturamento NUNCA vem do extrato/caixa: entrada de dinheiro não é venda.

import { resumoContas } from "./contas-pagar.mjs";
import { resumoReceber, resumoFluxo, somarDias } from "./contas-receber.mjs";
import { calcularCMO, pesoDoCMO } from "./cmo.mjs";

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const ddmmaaaa = (iso) => `${ddmm(iso)}/${iso.slice(0, 4)}`;
const diasEntre = (de, ate) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86400000);
const diasNoMes = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();
const fimDoMes = (iso) => `${iso.slice(0, 7)}-${String(diasNoMes(iso)).padStart(2, "0")}`;

export const PERIODOS = Object.freeze([
  { id: "hoje", rotulo: "Hoje" },
  { id: "7d", rotulo: "7 dias" },
  { id: "30d", rotulo: "30 dias" },
  { id: "mes", rotulo: "Mês atual" },
  { id: "personalizado", rotulo: "Personalizado" },
]);

export const ROTAS = Object.freeze({
  contasPagar: "/dashboard/financeiro/contas",
  contasVencidas: "/dashboard/financeiro/contas?situacao=vencido",
  contasHoje: "/dashboard/financeiro/contas?periodo=hoje",
  novaContaPagar: "/dashboard/financeiro/contas?nova=1",
  contasReceber: "/dashboard/financeiro/receber",
  caixa: "/dashboard/financeiro/caixa",
  fluxo: "/dashboard/financeiro/fluxo",
  dre: "/dashboard/financeiro/dre",
  compras: "/dashboard/operacao/compras",
  cmvReal: "/dashboard/operacao/estoque/cmv",
  faturamento: "/dashboard/operacao/estoque/cmv",
  custosPrecificacao: "/dashboard/financeiro/cmv",
  // custos-fixos e equilibrio redirecionam para a pizza: um destino só
  pizza: "/dashboard/financeiro/pizza",
  relatorios: "/dashboard/relatorios",
  fiscal: "/dashboard/gestao/fiscal",
  inteligencia: "/dashboard/inteligencia",
});

/**
 * Intervalo do filtro. Períodos de caixa vão até HOJE (não se soma o futuro).
 * @returns {{ de: string, ate: string, rotulo: string, valido: boolean, motivo?: string }}
 */
export function intervaloCentral(id, hoje, personalizado = {}) {
  if (!ISO.test(String(hoje))) return { de: null, ate: null, rotulo: "", valido: false, motivo: "Data de hoje inválida." };
  if (id === "hoje") return { de: hoje, ate: hoje, rotulo: `Hoje, ${ddmmaaaa(hoje)}`, valido: true };
  if (id === "7d") return { de: somarDias(hoje, -6), ate: hoje, rotulo: "Últimos 7 dias", valido: true };
  if (id === "30d") return { de: somarDias(hoje, -29), ate: hoje, rotulo: "Últimos 30 dias", valido: true };
  if (id === "personalizado") {
    const { de, ate } = personalizado || {};
    if (!ISO.test(String(de)) || !ISO.test(String(ate))) return { de: null, ate: null, rotulo: "Personalizado", valido: false, motivo: "Escolha as duas datas." };
    if (de > ate) return { de, ate, rotulo: "Personalizado", valido: false, motivo: "A data inicial é depois da final." };
    if (diasEntre(de, ate) > 366) return { de, ate, rotulo: "Personalizado", valido: false, motivo: "Período máximo: 1 ano." };
    return { de, ate, rotulo: `${ddmmaaaa(de)} a ${ddmmaaaa(ate)}`, valido: true };
  }
  const de = `${hoje.slice(0, 7)}-01`; // "mes" (padrão)
  return { de, ate: hoje, rotulo: `${MESES[Number(hoje.slice(5, 7)) - 1].replace(/^./, (c) => c.toUpperCase())} de ${hoje.slice(0, 4)}`, valido: true };
}

/** Faturamento oficial numa janela: dia faltando nunca vira zero. */
export function faturamentoNaJanela(fonte, de, ate) {
  if (!fonte) return { estado: "erro", motivo: "Fonte de faturamento não carregou." };
  if (fonte.erro) return { estado: "erro", motivo: fonte.erro };
  if (!fonte.disponivel) return { estado: "nao_apurado", motivo: fonte.motivo || "Fonte de vendas ainda não configurada." };
  const ateReal = ate;
  const esperados = diasEntre(de, ateReal) + 1;
  const dias = (fonte.dias || []).filter((d) => d.data >= de && d.data <= ateReal && Number.isFinite(Number(d.valor)));
  const lancados = new Set(dias.map((d) => d.data)).size;
  if (!lancados) return { estado: "nao_apurado", valor: null, lancados: 0, esperados, motivo: "Nenhum dia de faturamento lançado no período." };
  const valor = r2(dias.reduce((s, d) => s + Number(d.valor), 0));
  if (lancados < esperados) return { estado: "parcial", valor, lancados, esperados, motivo: `${lancados} de ${esperados} dias lançados: soma do que existe, sem estimar o resto.` };
  return { estado: "ok", valor, lancados, esperados };
}

// "grupo" das contas antigas é sempre LEGADO: a natureza diz o que a conta é
export const ROTULO_NATUREZA = Object.freeze({
  pessoal: "Pessoal (CMO)", mercadoria: "Mercadoria (CMV)", custo_variavel: "Custo variável", custo_fixo: "Custo fixo",
  despesa_administrativa: "Despesa administrativa", imposto: "Imposto", investimento: "Investimento", financeiro: "Financeiro",
});

const statusDaConta = (c, hoje) => {
  if (c.vencida) return { rotulo: "Vencida", tom: "critico", dias: diasEntre(c.data_vencimento, hoje) };
  if (c.data_vencimento === hoje) return { rotulo: "Vence hoje", tom: "atencao", dias: 0 };
  const em = diasEntre(hoje, c.data_vencimento);
  return { rotulo: em === 1 ? "Vence amanhã" : `Em ${em} dias`, tom: "info", dias: em };
};

/** Próximos compromissos: vencidas (mais antigas primeiro), hoje e 7 dias. */
export function compromissos(contasPagar = [], hoje, limite = 6) {
  const ate7 = somarDias(hoje, 7);
  const abertas = contasPagar.filter((c) => ["pendente", "parcial", "vencido"].includes(c.situacao) && Number(c.saldo) > 0);
  const vencidas = abertas.filter((c) => c.vencida).sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)));
  const hojeL = abertas.filter((c) => !c.vencida && c.data_vencimento === hoje);
  const prox = abertas.filter((c) => !c.vencida && c.data_vencimento > hoje && c.data_vencimento <= ate7)
    .sort((a, b) => String(a.data_vencimento).localeCompare(String(b.data_vencimento)));
  const todas = [...vencidas, ...hojeL, ...prox];
  return {
    contagem: { vencidas: vencidas.length, hoje: hojeL.length, proximos7: prox.length },
    total: todas.length,
    linhas: todas.slice(0, limite).map((c) => ({
      id: c.id, descricao: c.descricao || "Sem descrição",
      categoria: ROTULO_NATUREZA[c.natureza] || c.categoria_texto_antigo || "Sem categoria",
      vencimento: c.data_vencimento, vencimentoBr: c.data_vencimento ? ddmmaaaa(c.data_vencimento) : "—",
      valor: r2(c.saldo), status: statusDaConta(c, hoje), parcial: c.situacao === "parcial",
    })),
  };
}

const erroDe = (f) => (f?.error ? String(f.error) : null);

/**
 * Monta a central.
 * @param {object} p
 * @param {string} p.hoje                ISO local (America/Sao_Paulo)
 * @param {{de,ate,rotulo,valido}} p.intervalo
 * @param {object} p.fontes  { pagar:{data,error}, receber:{data,error}, fluxo:{data,error}, saldos:{data,error},
 *                             faturamento:{disponivel,dias,motivo,erro}, cmo:{colaboradores,recibos,error},
 *                             custosFixos:{data,incluirFolha,error}, cmv:{periodo:{…cmvRealPeriodo}|null,error,meta?} }
 */
export function montarCentral({ hoje, intervalo, fontes = {} }) {
  const f = fontes;
  const errosFontes = [];
  const anotar = (nome, fonte) => { const e = erroDe(fonte); if (e) errosFontes.push({ fonte: nome, erro: e }); return e; };

  // ── A PAGAR (posição de hoje, não depende do filtro) ──
  const ePagar = anotar("Contas a pagar", f.pagar);
  let aPagar;
  if (ePagar || !f.pagar) aPagar = { estado: "erro", motivo: ePagar || "Não carregou." };
  else {
    const rows = f.pagar.data || [];
    const r = resumoContas(rows, [], null, hoje);
    const abertas = rows.filter((c) => ["pendente", "parcial", "vencido"].includes(c.situacao));
    const nVencidas = abertas.filter((c) => c.vencida).length;
    const hojeRows = abertas.filter((c) => !c.vencida && c.data_vencimento === hoje);
    aPagar = {
      estado: r.aPagar > 0 ? "ok" : "zero", valor: r.aPagar, tom: r.vencido > 0 ? "critico" : r.aPagar > 0 ? "neutro" : "positivo",
      vencido: r.vencido, nVencidas, proximos7: r.proximos7,
      venceHoje: r2(hojeRows.reduce((s, c) => s + Number(c.saldo || 0), 0)), nVenceHoje: hojeRows.length,
      motivo: r.aPagar > 0 ? null : "Nenhuma conta a pagar em aberto.",
    };
  }

  // ── A RECEBER (posição de hoje) ──
  const eRec = anotar("Contas a receber", f.receber);
  let aReceber;
  if (eRec || !f.receber) aReceber = { estado: "erro", motivo: eRec || "Não carregou." };
  else {
    const rows = f.receber.data || [];
    const r = resumoReceber(rows, [], null);
    const ate7 = somarDias(hoje, 7);
    const prox7 = r2(rows.filter((c) => ["previsto", "parcial"].includes(c.situacao) && c.data_prevista >= hoje && c.data_prevista <= ate7)
      .reduce((t, c) => t + Number(c.saldo_bruto || 0), 0));
    aReceber = {
      estado: r.aReceberBruto > 0 ? "ok" : "zero", valor: r.aReceberBruto, atrasado: r.atrasado, proximos7: prox7,
      tom: r.atrasado > 0 ? "atencao" : "neutro", motivo: r.aReceberBruto > 0 ? null : "Nenhuma conta a receber em aberto.",
    };
  }

  // ── FLUXO REALIZADO NO PERÍODO ──
  const eFlu = anotar("Fluxo de caixa", f.fluxo);
  let fluxo;
  if (!intervalo?.valido) fluxo = { estado: "insuficiente", motivo: intervalo?.motivo || "Período inválido." };
  else if (eFlu || !f.fluxo) fluxo = { estado: "erro", motivo: eFlu || "Não carregou." };
  else {
    const rows = (f.fluxo.data || []).filter((l) => l.data >= intervalo.de && l.data <= intervalo.ate);
    const rf = resumoFluxo(rows);
    const lancamentos = rows.filter((l) => l.natureza === "realizado").length;
    fluxo = {
      estado: lancamentos ? "ok" : "zero", entradas: rf.realizado.entradas, saidas: rf.realizado.saidas, saldo: rf.realizado.saldo, lancamentos,
      incluiLegado: rf.incluiLegado, motivo: lancamentos ? null : "Nenhum recebimento ou pagamento registrado no período.",
    };
  }

  // ── SALDO GERENCIAL (contas financeiras) ──
  const eSal = anotar("Contas financeiras", f.saldos);
  const ativas = (f.saldos?.data || []).filter((x) => x.ativa !== false);
  const saldoGerencial = eSal ? { estado: "erro", motivo: eSal }
    : !ativas.length ? { estado: "nao_apurado", motivo: "Nenhuma conta financeira (banco/caixa) cadastrada." }
    : { estado: "ok", valor: r2(ativas.reduce((t, x) => t + Number(x.saldo_calculado || 0), 0)), contas: ativas.length,
        semSaldoInicial: ativas.filter((x) => !x.saldo_inicial_em).length };

  // ── FATURAMENTO (fonte de vendas, nunca o extrato) ──
  const fatPeriodo = intervalo?.valido ? faturamentoNaJanela(f.faturamento, intervalo.de, intervalo.ate) : { estado: "insuficiente", motivo: intervalo?.motivo };
  const mesDe = `${hoje.slice(0, 7)}-01`;
  const fatMes = faturamentoNaJanela(f.faturamento, mesDe, hoje);
  if (f.faturamento?.erro) errosFontes.push({ fonte: "Faturamento", erro: f.faturamento.erro });

  // ── CMO (mês corrente) ──
  const eCmo = anotar("RH / extras", f.cmo);
  let cmo;
  if (eCmo || !f.cmo) cmo = { estado: "erro", motivo: eCmo || "Não carregou." };
  else {
    const c = calcularCMO({ colaboradores: f.cmo.colaboradores || [], recibos: f.cmo.recibos || [], referencia: new Date(`${hoje}T12:00:00`), modo: "mes" });
    const pct = fatMes.estado === "ok" ? pesoDoCMO(c.total, fatMes.valor) : null;
    cmo = {
      estado: c.total > 0 ? "ok" : "zero", valor: r2(c.total), folha: r2(c.folha), extras: r2(c.extras), extrasEmAberto: r2(c.extrasEmAberto),
      pct: pct == null ? null : r2(pct),
      motivoPct: pct == null ? (fatMes.estado === "parcial" ? "Percentual indisponível: faturamento do mês está parcial." : "Percentual indisponível porque o faturamento ainda não foi apurado.") : null,
      motivo: c.total > 0 ? null : "Nenhum salário ativo nem diária paga no mês.",
    };
  }

  // ── CUSTOS FIXOS (mensal) ──
  const eCf = anotar("Custos fixos", f.custosFixos);
  let custosFixos;
  if (eCf || !f.custosFixos) custosFixos = { estado: "erro", motivo: eCf || "Não carregou." };
  else {
    const lista = f.custosFixos.data || [];
    const semFolha = r2(lista.reduce((s, c) => s + (Number(c.valor) || 0), 0));
    custosFixos = lista.length
      ? { estado: "ok", valor: semFolha, itens: lista.length, incluiFolhaNaTela: !!f.custosFixos.incluirFolha,
          pct: fatMes.estado === "ok" && fatMes.valor > 0 ? r2((semFolha / fatMes.valor) * 100) : null,
          motivoPct: fatMes.estado === "ok" ? null : "Percentual não calculado: faturamento do mês não apurado." }
      : { estado: "nao_apurado", motivo: "Nenhum custo fixo cadastrado (aluguel, energia, água…)." };
  }

  // ── CMV (último período de inventário fechado) ──
  const eCmv = anotar("CMV", f.cmv);
  let cmv;
  const pc = f.cmv?.periodo || null;
  const meta = Number(f.cmv?.meta) > 0 ? Number(f.cmv.meta) : null;
  if (eCmv || !f.cmv) cmv = { estado: "erro", motivo: eCmv || "Não carregou." };
  else if (!pc) cmv = { estado: "nao_calculado", motivo: "Sem inventário fechado (estoque inicial e final contados). O CMV estimado das fichas fica em Custos e precificação e não é mostrado como realizado.", meta };
  else if (pc.cmv_real == null) cmv = { estado: "nao_apurado", motivo: (pc.motivos || [])[0] || "CMV do período não apurado.", periodo: { de: pc.de, ate: pc.ate }, meta };
  else {
    const pct = pc.cmv_pct == null ? null : r2(pc.cmv_pct);
    cmv = {
      estado: "ok", valor: r2(pc.cmv_real), pct, periodo: { de: pc.de, ate: pc.ate }, meta,
      saude: pct == null || meta == null ? null : pct <= meta ? "saudavel" : "acima",
      motivoPct: pct == null ? "Percentual indisponível: sem faturamento do mesmo período." : null,
      estoqueInicial: pc.estoque_inicial, compras: pc.compras, estoqueFinal: pc.estoque_final,
    };
  }

  // ── MARGEM, LUCRO E PONTO DE EQUILÍBRIO (só com tudo do MESMO mês) ──
  const faltam = [];
  if (fatMes.estado !== "ok") faltam.push("faturamento do mês completo");
  const cmvDoMes = cmv.estado === "ok" && cmv.periodo?.de === mesDe && cmv.periodo?.ate >= fimDoMes(hoje) ? cmv : null;
  if (!cmvDoMes) faltam.push("CMV apurado do mês (inventário no início e no fim do mês)");
  if (cmo.estado !== "ok" && cmo.estado !== "zero") faltam.push("CMO");
  if (custosFixos.estado !== "ok") faltam.push("custos fixos cadastrados");
  let resultado;
  if (faltam.length) {
    const motivo = `Dados insuficientes: falta ${faltam.join(", ")}.`;
    resultado = { margem: { estado: "insuficiente", motivo }, lucro: { estado: "insuficiente", motivo }, pontoEquilibrio: { estado: "insuficiente", motivo } };
  } else {
    const fat = fatMes.valor;
    const lucro = r2(fat - cmvDoMes.valor - cmo.valor - custosFixos.valor);
    const cmvPct = cmvDoMes.valor / fat;
    const fixos = cmo.valor + custosFixos.valor;
    const peMes = cmvPct < 1 ? r2(fixos / (1 - cmvPct)) : null;
    const dm = diasNoMes(hoje);
    resultado = {
      lucro: { estado: "ok", valor: lucro },
      margem: { estado: "ok", pct: r2((lucro / fat) * 100) },
      pontoEquilibrio: peMes == null ? { estado: "insuficiente", motivo: "CMV ≥ 100% do faturamento." }
        : { estado: "ok", mensal: peMes, diario: r2(peMes / dm), semanal: r2((peMes / dm) * 7) },
    };
  }

  // ── PRECISA DA SUA ATENÇÃO (só problemas reais) ──
  const alertas = [];
  if (aPagar.estado === "ok" && aPagar.vencido > 0) alertas.push({
    id: "vencidas", prioridade: "critico", titulo: `${aPagar.nVencidas} conta(s) vencida(s)`, valor: aPagar.vencido,
    impacto: "Juros, multa e risco de corte de fornecimento.", acao: "Resolver", href: ROTAS.contasVencidas,
  });
  if (aPagar.estado === "ok" && aPagar.nVenceHoje > 0) alertas.push({
    id: "hoje", prioridade: "atencao", titulo: `${aPagar.nVenceHoje} conta(s) vencem hoje`, valor: aPagar.venceHoje,
    impacto: "Pagar hoje evita atraso.", acao: "Ver contas", href: ROTAS.contasHoje,
  });
  if (aReceber.estado === "ok" && aReceber.atrasado > 0) alertas.push({
    id: "receber", prioridade: "atencao", titulo: "Recebimentos atrasados", valor: aReceber.atrasado,
    impacto: "Dinheiro que já deveria ter entrado.", acao: "Cobrar / baixar", href: ROTAS.contasReceber,
  });
  if (fatPeriodo.estado === "nao_apurado" || fatPeriodo.estado === "parcial") alertas.push({
    id: "faturamento", prioridade: "atencao", titulo: fatPeriodo.estado === "parcial" ? "Faturamento parcial" : "Faturamento não apurado",
    impacto: "Sem faturamento não há CMV %, CMO %, margem nem lucro.", motivo: fatPeriodo.motivo, acao: "Lançar faturamento", href: ROTAS.faturamento,
  });
  if (saldoGerencial.estado === "nao_apurado") alertas.push({
    id: "contas-financeiras", prioridade: "informativo", titulo: "Saldo de caixa/banco não apurado", impacto: saldoGerencial.motivo, acao: "Cadastrar contas", href: ROTAS.caixa,
  });
  else if (saldoGerencial.estado === "ok" && saldoGerencial.semSaldoInicial > 0) alertas.push({
    id: "saldo-inicial", prioridade: "informativo", titulo: "Conta financeira sem saldo inicial", impacto: "O saldo gerencial não reflete o banco até informar o saldo inicial.", acao: "Informar", href: ROTAS.caixa,
  });
  if (cmv.saude === "acima") alertas.push({
    id: "cmv", prioridade: "atencao", titulo: "CMV acima da meta", impacto: `CMV ${cmv.pct}% · meta ${cmv.meta}%`, acao: "Analisar", href: ROTAS.cmvReal,
  });
  for (const e of errosFontes) alertas.push({ id: `erro-${e.fonte}`, prioridade: "critico", titulo: `${e.fonte}: erro ao carregar`, impacto: e.erro, acao: "Tentar novamente", recarregar: true });
  const ordem = { critico: 0, atencao: 1, informativo: 2 };
  alertas.sort((a, b) => ordem[a.prioridade] - ordem[b.prioridade]);

  // ── RESUMO DO HÉFISTO (só fatos acima) ──
  const resumo = [];
  if (aPagar.estado === "ok" && aPagar.vencido > 0) resumo.push({ tom: "critico", texto: `${aPagar.nVencidas} conta(s) vencida(s), somando ${brl(aPagar.vencido)}.` });
  if (fatPeriodo.estado === "nao_apurado") resumo.push({ tom: "atencao", texto: "Faturamento ainda não apurado: indicadores em % ficam indisponíveis." });
  if (fatPeriodo.estado === "parcial") resumo.push({ tom: "atencao", texto: `Faturamento parcial: ${fatPeriodo.lancados} de ${fatPeriodo.esperados} dias lançados.` });
  if (fluxo.estado === "ok") resumo.push({ tom: fluxo.saldo < 0 ? "atencao" : "positivo", texto: `Saldo de caixa do período ${fluxo.saldo < 0 ? "negativo" : "positivo"}: ${brl(fluxo.saldo)}.` });
  if (cmv.estado === "ok" && cmv.pct != null) resumo.push({ tom: cmv.saude === "acima" ? "atencao" : "info", texto: `CMV realizado de ${cmv.pct}% (${ddmm(cmv.periodo.de)} a ${ddmm(cmv.periodo.ate)}).` });
  else if (cmv.estado === "nao_calculado" || cmv.estado === "nao_apurado") resumo.push({ tom: "info", texto: "CMV realizado ainda não calculado (faltam inventários fechados)." });

  return {
    intervalo, hoje,
    cards: { aPagar, aReceber, fluxo, faturamento: fatPeriodo, saldoGerencial },
    indicadores: { cmv, cmo, custosFixos, ...resultado },
    alertas, compromissos: f.pagar && !ePagar ? compromissos(f.pagar.data || [], hoje) : null,
    resumo: resumo.slice(0, 4), errosFontes,
  };
}

function brl(v) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
