// MOTOR DE DIREITOS TRABALHISTAS (HDEV-RH-001, Fase 4).
//
// Funções puras. Entram o vínculo real (rh_vinculos: categoria + regra de
// remuneração), a competência e os valores do mês; saem LINHAS, cada uma com
// valor, base, fundamento e se exige revisão. Os percentuais vêm da lei, da
// convenção (regras-competencia.mjs) ou das tabelas datadas
// (tabelas-oficiais.mjs): nenhum número jurídico mora aqui.
//
// Todo resultado nasce como SIMULAÇÃO. Passar a cálculo validado, pagamento
// registrado ou obrigação cumprida é ato de pessoa (contador/DP/financeiro),
// registrado fora daqui.

import { TABELAS, FGTS, tabelaDaCompetencia } from "./tabelas-oficiais.mjs";

// Muda quando a regra de cálculo muda: o cálculo gravado (RH-5) guarda com qual versão foi feito.
export const MOTOR_VERSAO = "2026-10-13.1";

export const SITUACOES = Object.freeze({
  simulacao: "Simulação — conta feita pelo Héfisto, ninguém conferiu",
  calculo_validado: "Cálculo validado — conferido pelo contador ou DP",
  pagamento_registrado: "Pagamento registrado — saiu do caixa, com comprovante",
  obrigacao_cumprida: "Obrigação cumprida — informada ao governo (eSocial, FGTS Digital, DCTFWeb)",
  substituido: "Substituído — refeito depois; guardado no histórico",
});

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const linha = (codigo, descricao, tipo, valor, { base = null, fundamento, exigeRevisao = false, motivo = null } = {}) =>
  ({ codigo, descricao, tipo, valor: r2(valor), base: base == null ? null : r2(base), fundamento, exigeRevisao, motivo });

// ── Valor da hora / do dia ─────────────────────────────────────────────────
/** Divisor mensal da jornada: 220 para 44h semanais (CLT art. 64); proporcional para jornada menor. */
export function divisorMensal(horasSemanais = 44) {
  const h = Number(horasSemanais) || 44;
  return r2((h / 6) * 30);
}

/** Valor da hora pela regra de remuneração do vínculo. */
export function valorHora({ regra, salario, horasSemanais = 44, horasDia = null }) {
  const s = Number(salario) || 0;
  if (regra === "hora") return { valor: r2(s), fundamento: "valor por hora combinado" };
  if (regra === "diaria") {
    if (!horasDia) return { valor: null, fundamento: null, faltando: "horas da diária combinada" };
    return { valor: r2(s / horasDia), fundamento: "diária ÷ horas da diária" };
  }
  if (regra === "mensal") { const d = divisorMensal(horasSemanais); return { valor: r2(s / d), fundamento: `salário ÷ ${d} (CLT art. 64)` }; }
  return { valor: null, fundamento: null, faltando: "regra de remuneração por serviço não tem valor-hora" };
}

// ── DSR sobre variáveis ────────────────────────────────────────────────────
/** Reflexo no descanso semanal das horas extras e adicionais habituais (Lei 605/49 art. 7º; Súmula 172 TST). */
export function dsrSobreVariaveis({ variaveis, diasUteis, diasDescanso }) {
  const u = Number(diasUteis) || 0, d = Number(diasDescanso) || 0;
  if (!u) return { valor: 0, faltando: "dias úteis do mês" };
  return { valor: r2((Number(variaveis) || 0) / u * d), fundamento: "Lei 605/49 art. 7º; Súmula 172 TST (variáveis ÷ dias úteis × domingos e feriados)" };
}

// ── INSS do empregado ──────────────────────────────────────────────────────
export function inssEmpregado(base, competencia, tabelas = TABELAS) {
  const t = tabelaDaCompetencia(competencia, tabelas);
  if (!t?.inss_empregado) return { valor: null, faltando: `tabela do INSS de ${competencia}` };
  const { faixas, fonte } = t.inss_empregado;
  const b = Math.max(0, Number(base) || 0);
  let total = 0, anterior = 0;
  for (const f of faixas) {
    if (b > anterior) total += (Math.min(b, f.ate) - anterior) * f.aliquota / 100;
    anterior = f.ate;
  }
  const teto = faixas[faixas.length - 1].ate;
  return { valor: r2(total), base: r2(b), acimaDoTeto: b > teto, fundamento: `${fonte} (alíquotas progressivas por faixa)`, conferidaContador: t.conferida_contador };
}

// ── FGTS ───────────────────────────────────────────────────────────────────
export function fgts(base, { aprendiz = false } = {}) {
  const aliq = aprendiz ? FGTS.aprendiz : FGTS.aliquota;
  return { valor: r2((Number(base) || 0) * aliq / 100), aliquota: aliq, fundamento: FGTS.fonte };
}

// ── IRRF ───────────────────────────────────────────────────────────────────
/**
 * IRRF mensal: usa a dedução mais vantajosa (legal ou desconto simplificado)
 * e aplica a redução da Lei 15.270/2025 sobre o rendimento tributável bruto.
 * Não trata pensão alimentícia nem previdência privada: exigeRevisao quando houver.
 */
export function irrf({ rendimento, inss = 0, dependentes = 0, pensao = 0 }, competencia, tabelas = TABELAS) {
  const t = tabelaDaCompetencia(competencia, tabelas);
  if (!t?.irrf) return { valor: null, faltando: `tabela do IRRF de ${competencia}` };
  const { faixas, dependente, desconto_simplificado, reducao, fonte } = t.irrf;
  const bruto = Math.max(0, Number(rendimento) || 0);
  const legal = (Number(inss) || 0) + (Number(dependentes) || 0) * dependente + (Number(pensao) || 0);
  const deducao = Math.max(legal, desconto_simplificado);
  const base = Math.max(0, bruto - deducao);
  const f = faixas.find((x) => base <= x.ate);
  const imposto = Math.max(0, base * f.aliquota / 100 - f.deduzir);
  let red = 0;
  if (reducao && bruto <= reducao.isento_ate) red = Math.min(imposto, reducao.limite_isento);
  else if (reducao && bruto <= reducao.ate) red = Math.max(0, reducao.constante - reducao.fator * bruto);
  return {
    valor: r2(Math.max(0, imposto - red)), base: r2(base), deducao: r2(deducao),
    simplificado: deducao === desconto_simplificado && legal < desconto_simplificado,
    fundamento: fonte, exigeRevisao: Number(pensao) > 0, conferidaContador: t.conferida_contador,
  };
}

// ── Provisões do mês (custo do empregador, não sai no holerite) ────────────
export function provisoesMensais({ remuneracao, aprendiz = false }) {
  const rem = Number(remuneracao) || 0;
  const ferias = rem / 12, terco = ferias / 3, decimo = rem / 12;
  const fg = fgts(ferias + terco + decimo, { aprendiz });
  return [
    linha("prov_ferias", "Provisão de férias (1/12)", "provisao", ferias, { base: rem, fundamento: "CLT art. 129 e 146 (1/12 por mês trabalhado)" }),
    linha("prov_terco", "Provisão do 1/3 de férias", "provisao", terco, { base: ferias, fundamento: "CF art. 7º XVII" }),
    linha("prov_13", "Provisão do 13º (1/12)", "provisao", decimo, { base: rem, fundamento: "Lei 4.090/62 art. 1º §1º" }),
    linha("prov_fgts", "FGTS sobre as provisões", "provisao", fg.valor, { base: ferias + terco + decimo, fundamento: fg.fundamento }),
  ];
}

// ── Mês do colaborador ─────────────────────────────────────────────────────
/**
 * Calcula o mês conforme o vínculo.
 *  vinculo: { categoria, regra_remuneracao, salario_base } (rh_vinculos)
 *  mes: { competencia "AAAA-MM", salario (o do mês, se diferente do vínculo),
 *         adicionais: { valorExtra, valorNoturno, valorFeriado } (jornada-calculo),
 *         diasUteis, diasDescanso, taxaServico, valeAlimentacao, descontos,
 *         dependentes, aprendiz, regras (regras da competência, p/ rótulos) }
 * Devolve { situacao: "simulacao", linhas, totais, pendencias }.
 */
export function calcularMes(vinculo, mes) {
  const pendencias = [];
  const linhas = [];
  const comp = mes.competencia;
  const cat = vinculo?.categoria;

  if (!vinculo) return { situacao: "simulacao", linhas, totais: null, pendencias: ["Sem vínculo registrado: registre o vínculo no prontuário antes de calcular."] };
  if (cat === "eventual") {
    return { situacao: "simulacao", linhas, totais: null, pendencias: [
      "Trabalho eventual não entra na folha CLT: o pagamento é por serviço prestado, com recibo (controle de extras).",
      "Se o serviço se repete com habitualidade, revise o enquadramento com o contador: pode ser vínculo de emprego (CLT art. 3º).",
    ] };
  }
  if (cat === "outro") return { situacao: "simulacao", linhas, totais: null, pendencias: ["Modalidade \"outra\": o cálculo depende da definição do contador."] };

  const regras = mes.regras;
  const salario = Number(mes.salario ?? vinculo.salario_base) || 0;
  const ad = mes.adicionais || {};
  const extra = Number(ad.valorExtra) || 0, noturno = Number(ad.valorNoturno) || 0, feriado = Number(ad.valorFeriado) || 0;

  if (!salario) pendencias.push("Salário-base não informado no vínculo.");
  linhas.push(linha("salario", cat === "intermitente" ? "Remuneração do período (intermitente)" : "Salário-base", "provento", salario,
    { fundamento: cat === "intermitente" ? "CLT art. 452-A" : "contrato de trabalho" }));
  if (extra) linhas.push(linha("extra", `Horas extras (+${regras?.extraPct ?? "?"}%)`, "provento", extra, { fundamento: (regras?.fundamentos || []).join("; ") }));
  if (noturno) linhas.push(linha("noturno", `Adicional noturno (+${regras?.noturnoPct ?? "?"}%)`, "provento", noturno, { fundamento: (regras?.fundamentos || []).join("; ") }));
  if (feriado) linhas.push(linha("feriado", `Feriado trabalhado (+${regras?.feriadoPct ?? "?"}%)`, "provento", feriado, { fundamento: "Lei 605/49 art. 9º" }));

  const variaveis = extra + noturno;
  if (variaveis) {
    const d = dsrSobreVariaveis({ variaveis, diasUteis: mes.diasUteis, diasDescanso: mes.diasDescanso });
    if (d.faltando) pendencias.push(`DSR sobre horas extras e adicionais não calculado: falta ${d.faltando}.`);
    else if (d.valor) linhas.push(linha("dsr", "DSR sobre extras e adicionais", "provento", d.valor, { base: variaveis, fundamento: d.fundamento }));
  }

  // Intermitente: férias + 1/3, 13º e DSR proporcionais pagos ao fim de cada período (CLT art. 452-A §6º)
  if (cat === "intermitente" && salario) {
    const f = salario / 12;
    linhas.push(linha("int_ferias", "Férias proporcionais + 1/3", "provento", f + f / 3, { base: salario, fundamento: "CLT art. 452-A §6º II", exigeRevisao: true, motivo: "13º e férias do intermitente têm base própria de INSS e IRRF: confirme a apuração com o contador." }));
    linhas.push(linha("int_13", "13º proporcional", "provento", salario / 12, { base: salario, fundamento: "CLT art. 452-A §6º III", exigeRevisao: true, motivo: "13º e férias do intermitente têm base própria de INSS e IRRF: confirme a apuração com o contador." }));
  }

  const taxa = Number(mes.taxaServico) || 0;
  if (taxa) linhas.push(linha("taxa", "Taxa de serviço (gorjeta)", "provento", taxa,
    { fundamento: "CLT art. 457 §3º (Lei 13.419/2017); Súmula 354 TST: integra INSS e FGTS, não DSR, extras nem aviso" }));

  const baseTributavel = linhas.filter((l) => l.tipo === "provento").reduce((s, l) => s + l.valor, 0);

  const va = Number(mes.valeAlimentacao) || 0;
  if (va) linhas.push(linha("va", "Vale-alimentação (benefício)", "beneficio", va,
    { fundamento: "CLT art. 457 §2º: não integra a remuneração", exigeRevisao: true, motivo: "Confirme com o contador se é pago em cartão/ticket (PAT) ou em dinheiro: em dinheiro, integra o salário." }));

  const inss = inssEmpregado(baseTributavel, comp);
  if (inss.valor == null) pendencias.push(`INSS não calculado: sem ${inss.faltando}.`);
  else linhas.push(linha("inss", "INSS do empregado", "desconto", inss.valor, { base: inss.base, fundamento: inss.fundamento,
    exigeRevisao: !inss.conferidaContador, motivo: inss.conferidaContador ? null : "Tabela ainda não conferida pelo contador." }));

  const ir = irrf({ rendimento: baseTributavel, inss: inss.valor || 0, dependentes: mes.dependentes }, comp);
  if (ir.valor == null) pendencias.push(`IRRF não calculado: sem ${ir.faltando}.`);
  else if (ir.valor > 0) linhas.push(linha("irrf", "IRRF", "desconto", ir.valor, { base: ir.base, fundamento: ir.fundamento, exigeRevisao: true,
    motivo: "Confirme dependentes e pensão alimentícia no cadastro." }));

  const desc = Number(mes.descontos) || 0;
  if (desc) linhas.push(linha("descontos", "Vales / adiantamentos", "desconto", desc, { fundamento: "CLT art. 462 (adiantamento)" }));

  const fg = fgts(baseTributavel, { aprendiz: mes.aprendiz });
  linhas.push(linha("fgts", `FGTS (${fg.aliquota}%, depósito do empregador)`, "encargo", fg.valor, { base: baseTributavel, fundamento: fg.fundamento }));

  if (cat !== "intermitente") linhas.push(...provisoesMensais({ remuneracao: baseTributavel, aprendiz: mes.aprendiz }));

  const soma = (tipo) => r2(linhas.filter((l) => l.tipo === tipo).reduce((s, l) => s + l.valor, 0));
  const proventos = soma("provento"), beneficios = soma("beneficio"), descontos = soma("desconto");
  const encargos = soma("encargo"), provisoes = soma("provisao");
  pendencias.push("Encargos patronais (INSS da empresa, RAT, terceiros) dependem do regime tributário: configure com o contador.");
  return {
    situacao: "simulacao",
    linhas,
    totais: { proventos, beneficios, descontos, liquido: r2(proventos + beneficios - descontos), baseTributavel: r2(baseTributavel),
      encargos, provisoes, custoEmpresa: r2(proventos + beneficios + encargos + provisoes) },
    pendencias,
  };
}

/** Dias úteis e de descanso (domingos + feriados que não caem no domingo) da competência "AAAA-MM". */
export function diasDoMes(competencia, feriados = []) {
  const [ano, mes] = String(competencia).split("-").map(Number);
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const fer = new Set(feriados.map((f) => String(f?.data ?? f).slice(0, 10)));
  let descanso = 0;
  for (let d = 1; d <= total; d++) {
    const dia = `${competencia}-${String(d).padStart(2, "0")}`;
    if (new Date(`${dia}T12:00:00Z`).getUTCDay() === 0 || fer.has(dia)) descanso++;
  }
  return { diasUteis: total - descanso, diasDescanso: descanso };
}

/** O cálculo gravado ainda bate com o de agora? Compara os totais (centavos). */
export function mesmoResultado(gravado, atual) {
  if (!gravado?.totais || !atual?.totais) return false;
  const k = ["proventos", "beneficios", "descontos", "liquido", "encargos", "provisoes"];
  return k.every((c) => Math.round((Number(gravado.totais[c]) || 0) * 100) === Math.round((Number(atual.totais[c]) || 0) * 100));
}
