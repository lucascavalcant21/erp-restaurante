// REGRAS TRABALHISTAS PARAMETRIZADAS PELA CCT (HDEV-RH-001).
//
// Funções puras: recebem a convenção (cct-foz-2026-2027.mjs ou outra versão
// com o mesmo formato) e devolvem o resultado COM os fundamentos — cada
// cálculo diz qual cláusula/página ou dispositivo legal usou. O que depende
// de interpretação volta com `exigeRevisao: true` e o motivo; nada aqui
// desconta salário, fecha rescisão ou altera folha: só calcula e alerta.

import { CCT_FOZ_2026_2027, citar } from "./cct-foz-2026-2027.mjs";

const DIA = 86400000;
const r2 = (n) => Math.round(Number(n) * 100) / 100;
const iso = (d) => d.toISOString().slice(0, 10);
const data = (s) => new Date(`${String(s).slice(0, 10)}T12:00:00Z`);
const somaDias = (s, n) => iso(new Date(data(s).getTime() + n * DIA));
const diffDias = (a, b) => Math.round((data(b) - data(a)) / DIA);
const minutos = (hhmm) => { const [h, m] = String(hhmm).split(":").map(Number); return h * 60 + (m || 0); };

/** Anos completos entre duas datas (aniversário). */
export function anosCompletos(inicio, fim) {
  const a = data(inicio), b = data(fim);
  let anos = b.getUTCFullYear() - a.getUTCFullYear();
  if (b.getUTCMonth() < a.getUTCMonth() || (b.getUTCMonth() === a.getUTCMonth() && b.getUTCDate() < a.getUTCDate())) anos--;
  return Math.max(0, anos);
}

// ── Contrato de experiência ────────────────────────────────────────────────
/**
 * Valida um contrato de experiência: { inicio, primeiro, prorrogacao?, readmissao? }.
 * readmissao: { desligadoEm, mesmaFuncao } quando a pessoa já trabalhou na empresa.
 * Datas contam o dia de início (30 dias a partir de 01/05 terminam em 30/05).
 */
export function validarExperiencia({ inicio, primeiro, prorrogacao = 0, readmissao = null }, cct = CCT_FOZ_2026_2027) {
  const r = cct.experiencia, erros = [], fundamentos = [r.legal];
  const p1 = Number(primeiro), p2 = Number(prorrogacao) || 0;
  if (!(p1 >= r.minimo_dias)) erros.push({ msg: `O 1º período precisa ter no mínimo ${r.minimo_dias} dias.`, fonte: citar({ clausula: 19, paragrafo: "1º", pagina: 4 }) });
  if (p2 > 0 && r.prorrogacao_nao_inferior_ao_primeiro && p2 < p1) erros.push({ msg: `A prorrogação (${p2} dias) não pode ser menor que o 1º período (${p1} dias).`, fonte: citar({ clausula: 19, paragrafo: "3º", pagina: 4 }) });
  if (p1 + p2 > r.maximo_total_dias) erros.push({ msg: `Os dois períodos somam ${p1 + p2} dias; o máximo é ${r.maximo_total_dias}.`, fonte: `${citar({ clausula: 19, paragrafo: "3º", pagina: 4 })}; CLT art. 445 parágrafo único` });
  if (readmissao?.desligadoEm && readmissao.mesmaFuncao && inicio) {
    const limite = somaDias(readmissao.desligadoEm, 0);
    const anos = anosCompletos(limite, inicio);
    if (anos < r.vedada_readmissao_mesma_funcao_anos) erros.push({ msg: `Readmissão na mesma função antes de ${r.vedada_readmissao_mesma_funcao_anos} anos do desligamento: contrato de experiência vedado.`, fonte: citar(r.fonte_readmissao) });
  }
  const fimPrimeiro = inicio ? somaDias(inicio, p1 - 1) : null;
  const fimTotal = inicio ? somaDias(inicio, p1 + p2 - 1) : null;
  fundamentos.unshift(citar(r.fonte));
  return { ok: erros.length === 0, erros, fimPrimeiro, fimTotal, totalDias: p1 + p2, fundamentos };
}

/** Alertas de vencimento da experiência (padrão 15, 7, 3 e 1 dia antes). */
export function alertasExperiencia({ inicio, primeiro, prorrogacao = 0, prorrogado = false }, hoje, antecedencias = [15, 7, 3, 1]) {
  const fim = somaDias(inicio, (prorrogado ? Number(primeiro) + Number(prorrogacao) : Number(primeiro)) - 1);
  const faltam = diffDias(iso(data(hoje)), fim);
  const marco = antecedencias.find((d) => faltam === d) ?? null;
  const decisoes = prorrogado ? ["efetivar (prazo indeterminado)", "encerrar no término"] : ["prorrogar uma vez", "efetivar (prazo indeterminado)", "encerrar no término"];
  return { fim, faltam, alertarHoje: marco !== null, marco, vencido: faltam < 0, decisoes };
}

// ── Adicional noturno ──────────────────────────────────────────────────────
/**
 * Minutos e valor do adicional noturno de uma jornada (cl. 13: 25%, 22h–7h;
 * jornada iniciada após 5h não é noturna). Atravessa a meia-noite.
 * intervalos: [["HH:MM","HH:MM"], ...] não trabalhados.
 * horaReduzida: "22-05" (CLT art. 73 §1º, faixa legal) | "janela" (22h–7h inteira) | "nenhuma".
 * A leitura da hora reduzida entre 5h e 7h NÃO está na CCT: exigeRevisao.
 */
export function adicionalNoturno({ entrada, saida, intervalos = [], valorHora = 0, horaReduzida = "22-05" }, cct = CCT_FOZ_2026_2027) {
  const r = cct.adicional_noturno;
  const ini = minutos(entrada);
  let fim = minutos(saida); if (fim <= ini) fim += 1440;
  const fora = intervalos.map(([a, b]) => { let x = minutos(a), y = minutos(b); if (x < ini) { x += 1440; y += 1440; } if (y <= x) y += 1440; return [x, y]; });
  const jIni = minutos(r.inicio), jFim = minutos(r.fim); // 22:00 → 07:00 (dia seguinte)
  const exclusao = minutos(r.nao_noturno_se_inicio_apos);
  // jornada que começa depois das 5h e antes das 7h: a faixa 5h–7h daquela manhã não conta (cl. 13 §2º)
  const comecaNaManha = ini > exclusao && ini < jFim;
  const janelas = [[jIni - 1440, jFim], [jIni, jFim + 1440], [jIni + 1440, jFim + 2880]];
  let noturnoRelogio = 0, noturnoLegal = 0; // legal = parte entre 22h e 5h
  for (let m = ini; m < fim; m++) {
    if (fora.some(([a, b]) => m >= a && m < b)) continue;
    const naJanela = janelas.some(([a, b]) => m >= a && m < b);
    if (!naJanela) continue;
    const doDia = ((m % 1440) + 1440) % 1440;
    if (comecaNaManha && doDia >= exclusao && doDia < jFim && m < ini + 120) continue;
    noturnoRelogio++;
    if (doDia >= jIni || doDia < exclusao) noturnoLegal++;
  }
  const reduz = (min) => min * 60 / 52.5;
  const pagos = horaReduzida === "janela" ? reduz(noturnoRelogio)
    : horaReduzida === "22-05" ? reduz(noturnoLegal) + (noturnoRelogio - noturnoLegal)
    : noturnoRelogio;
  const valor = r2(valorHora * (pagos / 60) * (r.adicional_pct / 100));
  return {
    minutosNoturnosRelogio: noturnoRelogio, minutosEntre22e05: noturnoLegal, minutosNoturnosPagos: Math.round(pagos * 100) / 100,
    adicionalPct: r.adicional_pct, valor, excluidaPorInicioAposCinco: comecaNaManha,
    fundamentos: [citar(r.fonte), citar(r.fonte_exclusao), "CLT art. 73 §1º (hora noturna de 52min30s)"],
    exigeRevisao: noturnoRelogio > noturnoLegal, motivoRevisao: noturnoRelogio > noturnoLegal ? r.hora_reduzida.observacao : null,
  };
}

// ── Horas extras ───────────────────────────────────────────────────────────
export function horasExtras({ minutos: min, valorHora }, cct = CCT_FOZ_2026_2027) {
  const r = cct.hora_extra;
  const horas = Number(min) / 60;
  return { horas: r2(horas), adicionalPct: r.adicional_pct, valorAdicional: r2(valorHora * horas * r.adicional_pct / 100),
    valorTotal: r2(valorHora * horas * (1 + r.adicional_pct / 100)), fundamentos: [citar(r.fonte)] };
}

// ── Feriado trabalhado ─────────────────────────────────────────────────────
/**
 * Feriado trabalhado (cl. 17): compensar por antecipação no mesmo mês ou em
 * até 30 dias após; sem compensação, paga em dobro sem prejuízo do DSR.
 */
export function feriadoTrabalhado({ feriado, compensadoEm = null, hoje }, cct = CCT_FOZ_2026_2027) {
  const r = cct.feriados;
  const prazo = somaDias(feriado, 30);
  const inicioMes = `${feriado.slice(0, 7)}-01`;
  const fundamentos = [citar(r.fonte)];
  if (compensadoEm) {
    const valida = (compensadoEm >= inicioMes && compensadoEm < feriado) || (compensadoEm > feriado && compensadoEm <= prazo);
    return { situacao: valida ? "compensado" : "compensacao_fora_do_prazo", prazo, devidoEmDobro: !valida, fundamentos };
  }
  const vencido = iso(data(hoje)) > prazo;
  return { situacao: vencido ? "pagar_em_dobro" : "pendente", prazo, faltam: diffDias(iso(data(hoje)), prazo), devidoEmDobro: vencido, fundamentos };
}

// ── Aviso prévio ───────────────────────────────────────────────────────────
/** Dias de aviso (cl. 23; Lei 12.506/2011). Proporcional só a favor do empregado: revisão do DP. */
export function avisoPrevio({ admissao, desligamento, modalidade = "trabalhado" }, cct = CCT_FOZ_2026_2027) {
  const r = cct.aviso_previo;
  const anos = anosCompletos(admissao, desligamento);
  const total = Math.min(r.maximo_dias, r.base_dias + r.por_ano_dias * anos);
  const cumprido = modalidade === "trabalhado" ? Math.min(total, r.cumprido_maximo_dias) : 0;
  return { anosCompletos: anos, diasTotais: total, diasCumpridos: cumprido, diasIndenizados: total - cumprido,
    fundamentos: [citar(r.fonte), r.legal], exigeRevisao: true,
    motivoRevisao: "Aplicação conforme o tipo de desligamento (dispensa, pedido de demissão, justa causa) depende de validação do DP." };
}

// ── Quinquênio ─────────────────────────────────────────────────────────────
export function quinquenio({ admissao, referencia, salarioBase }, cct = CCT_FOZ_2026_2027) {
  const r = cct.quinquenio;
  const desde = admissao > r.contagem_desde ? admissao : r.contagem_desde;
  const qtd = Math.floor(anosCompletos(desde, referencia) / r.anos);
  const pct = Math.min(r.teto_pct, qtd * r.pct_por_quinquenio);
  return { quinquenios: qtd, pct, valor: r2(Number(salarioBase) * pct / 100), contadoDesde: desde, fundamentos: [citar(r.fonte)] };
}

// ── Piso salarial ──────────────────────────────────────────────────────────
export function conferirPiso({ salarioMensal, aprendiz = false, jornadaParcial = false }, cct = CCT_FOZ_2026_2027) {
  const r = cct.piso;
  if (aprendiz) return { abaixoDoPiso: null, piso: null, fundamentos: [citar(r.aprendiz.fonte)], observacao: "Aprendiz: garantia mínima é o salário mínimo federal." };
  if (jornadaParcial) return { abaixoDoPiso: null, piso: r.mensal, fundamentos: [citar(r.fonte)], exigeRevisao: true, motivoRevisao: "A CCT não trata de piso proporcional para jornada parcial." };
  return { abaixoDoPiso: Number(salarioMensal) < r.mensal, piso: r.mensal, diferenca: r2(Math.max(0, r.mensal - Number(salarioMensal))), fundamentos: [citar(r.fonte)] };
}

// ── Auxílio-creche ─────────────────────────────────────────────────────────
/**
 * Reembolso do auxílio-creche (cl. 18). fimPeriodoLetivoSeisAnos: data do fim
 * do período letivo em que a criança completa 6 anos (vem da escola).
 */
export function auxilioCreche({ matricula, requeridoEm, fimPeriodoLetivoSeisAnos, mesReferencia, valorNota, notaEmNomeDoEmpregado, outroGenitorRecebe = false }, cct = CCT_FOZ_2026_2027) {
  const r = cct.auxilio_creche, pendencias = [];
  if (!requeridoEm || diffDias(matricula, requeridoEm) > r.requerimento_prazo_dias || diffDias(matricula, requeridoEm) < 0) pendencias.push(`Requerimento por escrito em até ${r.requerimento_prazo_dias} dias da matrícula.`);
  if (!notaEmNomeDoEmpregado) pendencias.push("Nota fiscal da creche/escola em nome do empregado.");
  if (outroGenitorRecebe) pendencias.push("Ambos os genitores na categoria: o benefício é pago a um só.");
  if (!fimPeriodoLetivoSeisAnos) pendencias.push("Data do fim do período letivo em que a criança completa 6 anos.");
  else if (`${mesReferencia}-01` > fimPeriodoLetivoSeisAnos) pendencias.push("Criança já passou do período letivo em que completou 6 anos.");
  const valor = pendencias.length ? 0 : r2(Math.min(Number(valorNota) || 0, r.teto_mensal));
  return { elegivel: pendencias.length === 0, valorReembolso: valor, teto: r.teto_mensal, pendencias, prazoReembolsoDias: r.reembolso_prazo_dias, fundamentos: [citar(r.fonte)] };
}

// ── Férias proporcionais ───────────────────────────────────────────────────
/** Avos de férias: 1/12 por mês ou fração superior a 14 dias (cl. 41); justa causa não tem. */
export function avosFerias({ inicioPeriodo, fim, justaCausa = false }, cct = CCT_FOZ_2026_2027) {
  const fundamentos = [citar(cct.ferias.fonte), "CF art. 7º XVII (1/3)"];
  if (justaCausa) return { avos: 0, fundamentos, exigeRevisao: true, motivoRevisao: "Justa causa: confirmar com o DP." };
  let avos = 0, cursor = inicioPeriodo;
  for (;;) {
    const a = data(cursor); const prox = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, a.getUTCDate(), 12));
    if (iso(prox) <= somaDias(fim, 1)) { avos++; cursor = iso(prox); if (avos >= 12) break; continue; }
    if (diffDias(cursor, fim) + 1 > 14) avos++;
    break;
  }
  return { avos: Math.min(12, avos), terco: true, fundamentos };
}

// ── Escala, folga, intervalo, rescisão, adiantamento ──────────────────────
export function domingoNoMes({ folgas = [], ano, mes }, cct = CCT_FOZ_2026_2027) {
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}`;
  const domingos = folgas.filter((f) => f.startsWith(prefixo) && data(f).getUTCDay() === 0);
  return { ok: domingos.length >= cct.dsr_domingo.minimo_por_mes, domingos, fundamentos: [citar(cct.dsr_domingo.fonte)] };
}

export function escalaPublicadaATempo({ publicadaEm, inicioEscala }, cct = CCT_FOZ_2026_2027) {
  const antecedencia = diffDias(publicadaEm, inicioEscala);
  return { ok: antecedencia >= cct.escala_folgas.publicar_antecedencia_dias, antecedencia, fundamentos: [citar(cct.escala_folgas.fonte)] };
}

export function conferirIntervalo({ jornadaMin, intervaloMin }, cct = CCT_FOZ_2026_2027) {
  const r = cct.intervalo;
  if (jornadaMin <= r.jornada_acima_de_min) return { ok: true, fundamentos: ["CLT art. 71 §1º"] };
  return { ok: intervaloMin >= r.minimo_min && intervaloMin <= r.maximo_min, fundamentos: [citar(r.fonte), "CLT art. 71"] };
}

export function prazoRescisao({ termino }, cct = CCT_FOZ_2026_2027) {
  return { pagarAte: somaDias(termino, cct.rescisao.prazo_pagamento_dias), fundamentos: [citar(cct.rescisao.fonte), "CLT art. 477 §6º (10 dias; a CCT fixa 8)"], exigeRevisao: true };
}

export function adiantamentoObrigatorio({ empregados, recusaExpressa = false }, cct = CCT_FOZ_2026_2027) {
  const r = cct.adiantamento;
  const obrigatorio = empregados >= r.dispensa.menos_de_empregados && !recusaExpressa;
  return { obrigatorio, ateDia: r.ate_dia, faixaPct: [r.minimo_pct, r.maximo_pct], fundamentos: [citar(r.fonte), citar(r.dispensa.fonte)] };
}

/** Contribuições sindicais: nunca geram desconto automático. */
export function contribuicaoNegocial(_, cct = CCT_FOZ_2026_2027) {
  const r = cct.contribuicao_negocial_laboral;
  return { descontoAutomatico: false, exigeRevisao: true, parcelas: r.parcelas, valor: r.valor, inicio: r.inicio,
    motivoRevisao: "Desconto depende de validação jurídica e do controle de oposição de cada empregado.", fundamentos: [citar(r.fonte)] };
}
