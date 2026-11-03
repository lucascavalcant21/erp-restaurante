// Cálculo de adicionais da jornada — noturno, hora extra e feriado.
//
// Módulo puro, sem Supabase, para poder ser testado direto no node. O que está
// aqui decide quanto a casa paga, então cada regra abaixo cita a norma que a
// obriga: mudança sem base legal aqui vira passivo ou pagamento indevido.

// ── Trabalho noturno (CLT art. 73) ──────────────────────────────────────────
// Urbano: das 22h às 5h. O adicional é de no mínimo 20% e a hora noturna é
// REDUZIDA — vale 52min30s. Ou seja, 60 minutos de relógio dentro da faixa
// contam como 1h08 para pagamento. Ignorar a hora ficta subpaga em 14%.
export const NOTURNO_INICIO_H = 22;
export const NOTURNO_FIM_H = 5;

// Regras de pagamento. O padrão é o mínimo legal (CLT), que é o que o
// Héfisto sempre pagou. Convenção coletiva entra por `opcoes.regras` (ver
// app/lib/trabalhista/regras-competencia.mjs), só para a competência em que
// ela vale e depois de ativada — folha fechada nunca é recalculada aqui.
export const REGRAS_CLT = Object.freeze({
  id: "clt",
  noturnoPct: 20, extraPct: 50, feriadoPct: 100,
  noturnoInicioH: NOTURNO_INICIO_H, noturnoFimH: NOTURNO_FIM_H,
  naoNoturnoSeInicioAposH: null, // regra só de convenção
  horaFictaSoEntre22e5: true,
  fundamentos: ["CLT art. 73 (noturno 20%, 22h–5h, hora de 52min30s)", "CF art. 7º XVI (extra +50%)", "Lei 605/49 art. 9º (feriado em dobro)"],
});
export const HORA_FICTA_MIN = 52.5;

// Tolerância de marcação (CLT art. 58 §1º): até 5 min por marcação não são
// descontados nem contados como extra, respeitado o teto de 10 min no dia.
export const TOLERANCIA_MARCACAO_MIN = 5;
export const TOLERANCIA_TETO_DIA_MIN = 10;

// Limite legal de hora extra (CLT art. 59, caput): no máximo 2 horas por dia.
// É também o que o acordo de banco de horas da casa combina com cada
// trabalhador. Passar disso não é "mais hora extra" — é infração, e continua
// devido. Por isso o dia que estoura vem marcado, não silenciosamente somado.
export const EXTRA_MAXIMA_DIA_MIN = 120;

const MIN = 60000;

// Interseção de dois intervalos, em minutos. Base de tudo que segue.
function minutosEmComum(iniA, fimA, iniB, fimB) {
  const ini = Math.max(iniA, iniB);
  const fim = Math.min(fimA, fimB);
  return fim > ini ? (fim - ini) / MIN : 0;
}

// As duas noites que podem tocar um turno: a que começa no dia anterior (para
// quem entra depois da meia-noite) e a que começa no próprio dia. Elas não se
// sobrepõem, então somar as duas é seguro.
function janelasNoturnas(referencia, inicioH = NOTURNO_INICIO_H, fimH = NOTURNO_FIM_H) {
  const janelas = [];
  for (const deslocamento of [-1, 0]) {
    const ini = new Date(referencia);
    ini.setDate(ini.getDate() + deslocamento);
    ini.setHours(inicioH, 0, 0, 0);
    const fim = new Date(ini);
    fim.setDate(fim.getDate() + 1);
    fim.setHours(fimH, 0, 0, 0);
    janelas.push([ini.getTime(), fim.getTime()]);
  }
  return janelas;
}

// Minutos de RELÓGIO dentro da faixa noturna, já descontado o intervalo — que
// não é tempo trabalhado e portanto não gera adicional.
export function minutosNoturnosRelogio(entrada, saida, intervaloIni = null, intervaloFim = null, faixa = null) {
  const ini = new Date(entrada).getTime();
  const fim = new Date(saida).getTime();
  if (!(fim > ini)) return 0;
  const inicioH = faixa?.inicioH ?? NOTURNO_INICIO_H;
  const fimH = faixa?.fimH ?? NOTURNO_FIM_H;

  let total = 0;
  for (const [jIni, jFim] of janelasNoturnas(new Date(entrada), inicioH, fimH)) {
    let trecho = minutosEmComum(ini, fim, jIni, jFim);
    if (trecho > 0 && intervaloIni && intervaloFim) {
      const pIni = new Date(intervaloIni).getTime();
      const pFim = new Date(intervaloFim).getTime();
      if (pFim > pIni) trecho -= minutosEmComum(pIni, pFim, jIni, jFim);
    }
    if (trecho > 0) total += trecho;
  }
  if (faixa?.naoNoturnoSeInicioAposH != null) {
    const e = new Date(entrada);
    const minutoDoDia = e.getHours() * 60 + e.getMinutes();
    if (minutoDoDia > faixa.naoNoturnoSeInicioAposH * 60 && minutoDoDia < fimH * 60) {
      const fimDaFaixa = new Date(e); fimDaFaixa.setHours(fimH, 0, 0, 0);
      let manha = minutosEmComum(ini, fim, ini, fimDaFaixa.getTime());
      if (manha > 0 && intervaloIni && intervaloFim) {
        const pIni = new Date(intervaloIni).getTime(), pFim = new Date(intervaloFim).getTime();
        if (pFim > pIni) manha -= minutosEmComum(pIni, pFim, ini, fimDaFaixa.getTime());
      }
      total -= Math.max(0, manha);
    }
  }
  return Math.round(Math.max(0, total));
}

// Converte minutos de relógio em minutos de hora noturna ficta.
export function comHoraFicta(minutosRelogio) {
  return Math.round(minutosRelogio * 60 / HORA_FICTA_MIN);
}

// Minutos efetivamente trabalhados no dia (fora o intervalo).
// Onde a jornada PAGA começa. Não é a batida: é a batida ou o início do turno,
// o que vier depois.
//
// Quem chega 15:00 num turno que abre 15:40 ficou 40 min à disposição por
// conta própria, e isso não é trabalho — nem extra. Contar dava hora extra a
// quem só chegou cedo. Chegar DEPOIS não é tocado aqui: atraso é atraso.
//
// A batida real continua intocada no livro e na tela. Carimbar 15:40 por cima
// de quem bateu 15:00 seria horário predeterminado, que o art. 74, II da CLT
// (Portaria MTP 671/2021) proíbe — o ajuste é sempre no cálculo, nunca no
// registro.
export function inicioPagoDoDia(reg, horarioEntrada = null) {
  const batida = new Date(reg.hora_entrada).getTime();
  const inicioMin = minutosDoHorario(horarioEntrada);
  if (inicioMin === null) return batida;
  const turno = new Date(reg.hora_entrada);
  turno.setHours(Math.floor(inicioMin / 60), inicioMin % 60, 0, 0);
  // Turno da madrugada: se o início calculado caiu depois da batida por mais
  // de meio dia, é porque a batida é do dia seguinte — aí vale a batida.
  const diff = turno.getTime() - batida;
  if (diff > 12 * 60 * MIN) return batida;
  return Math.max(batida, turno.getTime());
}

export function minutosTrabalhados(reg, horarioEntrada = null) {
  if (!reg?.hora_entrada || !reg?.hora_saida) return 0;
  const ini = inicioPagoDoDia(reg, horarioEntrada);
  const fim = new Date(reg.hora_saida).getTime();
  if (!(fim > ini)) return 0;
  let total = (fim - ini) / MIN;
  if (reg.hora_saida_intervalo && reg.hora_retorno_intervalo) {
    const pIni = new Date(reg.hora_saida_intervalo).getTime();
    const pFim = new Date(reg.hora_retorno_intervalo).getTime();
    if (pFim > pIni) total -= (pFim - pIni) / MIN;
  }
  return Math.round(Math.max(0, total));
}

// Minutos de intervalo efetivamente tirados no dia (0 se não bateu as duas).
export function intervaloTiradoMin(reg) {
  if (!reg?.hora_saida_intervalo || !reg?.hora_retorno_intervalo) return 0;
  const d = (new Date(reg.hora_retorno_intervalo).getTime() - new Date(reg.hora_saida_intervalo).getTime()) / MIN;
  return d > 0 ? Math.round(d) : 0;
}

// Aplica a tolerância a uma diferença.
//
// Ultrapassado o limite, conta o período INTEIRO e não só o excedente — é o que
// diz a Súmula 366 do TST. Sair 7 min depois são 7 min de extra, não 2.
//
// tetoRestante implementa o limite de 10 min diários: a partir do momento em
// que o dia já consumiu a folga, não há mais tolerância a conceder.
export function aplicarTolerancia(diferencaMin, toleranciaMin = TOLERANCIA_MARCACAO_MIN, tetoRestante = TOLERANCIA_TETO_DIA_MIN) {
  const folga = Math.min(toleranciaMin, Math.max(0, tetoRestante));
  if (diferencaMin > 0 && diferencaMin <= folga) {
    return { minutos: 0, consumido: diferencaMin };
  }
  return { minutos: diferencaMin, consumido: 0 };
}

// Jornada contratada do dia, em minutos, a partir do cadastro do colaborador.
// Devolve null quando o cadastro não tem horário — aí não dá para dizer o que é
// hora extra, e o dia não gera extra em vez de gerar um número inventado.
export function jornadaContratadaMin(colaborador, dataISO) {
  if (!colaborador) return null;
  const dia = new Date(`${String(dataISO).slice(0, 10)}T12:00:00`).getDay();
  const ehDomingo = dia === 0;
  const entrada = (ehDomingo && colaborador.horario_dom_entrada) || colaborador.horario_entrada;
  const saida = (ehDomingo && colaborador.horario_dom_saida) || colaborador.horario_saida;
  if (!entrada || !saida) return null;

  const emMin = (hhmm) => {
    const [h, m] = String(hhmm).split(":").map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  };
  const ini = emMin(entrada);
  let fim = emMin(saida);
  if (ini == null || fim == null) return null;
  // Turno que vira a meia-noite: 15:40 → 00:00 são 8h20, não -15h40.
  if (fim <= ini) fim += 24 * 60;

  const intervalo = Number(colaborador.tempo_intervalo) || 0;
  return Math.max(0, fim - ini - intervalo);
}

// ── Adicionais dia a dia ────────────────────────────────────────────────────
//
// opcoes.contratadaDoDia(dataISO) → minutos contratados naquele dia, ou null.
// Sem ela, hora extra não é calculada: o excedente só existe em relação a uma
// jornada contratada, e chutar isso erra o pagamento nos dois sentidos.
export function calcularAdicionaisPorDia(pontosMes, feriados = [], opcoes = {}) {
  const {
    toleranciaMin = TOLERANCIA_MARCACAO_MIN,
    tetoDiaMin = TOLERANCIA_TETO_DIA_MIN,
    contratadaDoDia = null,
    // Hora em que o turno abre naquele dia ("15:40"). Sem ela o cálculo segue
    // como antes, contando da batida — nenhuma tela quebra por não passar.
    entradaDoDia = null,
    regras = REGRAS_CLT,
    // Regra da casa (dono, 19/10/2026): voltar antes do fim do intervalo não
    // muda o salário. Com o intervalo contratado informado, o tempo que a
    // pessoa deixou de tirar não conta como hora extra. Sem ele, como antes.
    intervaloContratadoDoDia = null,
    // Regra da casa (CCT Foz cl. 17): feriado compensado com folga em até 30
    // dias não é pago em dobro. Devolve true para o dia compensado.
    feriadoCompensado = null,
  } = opcoes;
  const faixa = { inicioH: regras.noturnoInicioH, fimH: regras.noturnoFimH, naoNoturnoSeInicioAposH: regras.naoNoturnoSeInicioAposH };
  const faixaLegal = { inicioH: NOTURNO_INICIO_H, fimH: NOTURNO_FIM_H, naoNoturnoSeInicioAposH: regras.naoNoturnoSeInicioAposH };

  const feriadosSet = new Set((feriados || []).map(f => (f?.data || f)).map(d => String(d).slice(0, 10)));
  const dias = [];

  (pontosMes || []).forEach(reg => {
    if (!reg.hora_entrada || !reg.hora_saida) return;
    const data = String(reg.data_referencia).slice(0, 10);
    const horarioEntrada = entradaDoDia ? entradaDoDia(data) : null;
    const trabalhado = minutosTrabalhados(reg, horarioEntrada);
    if (trabalhado <= 0) return;

    // Noturno: minutos de relógio na faixa 22h–5h, convertidos pela hora ficta.
    const noturnoRelogio = minutosNoturnosRelogio(
      reg.hora_entrada, reg.hora_saida,
      reg.hora_saida_intervalo, reg.hora_retorno_intervalo, faixa,
    );
    // Hora ficta (52min30s) só na faixa legal 22h–5h; o que a convenção
    // estende (ex.: 5h–7h) conta pelo relógio até o contador validar outra
    // leitura (regras-cct.mjs, adicionalNoturno → exigeRevisao).
    const noturnoLegal = regras.horaFictaSoEntre22e5 && (regras.noturnoFimH !== NOTURNO_FIM_H || regras.noturnoInicioH !== NOTURNO_INICIO_H)
      ? Math.min(noturnoRelogio, minutosNoturnosRelogio(reg.hora_entrada, reg.hora_saida, reg.hora_saida_intervalo, reg.hora_retorno_intervalo, faixaLegal))
      : noturnoRelogio;
    const minNoturno = comHoraFicta(noturnoLegal) + (noturnoRelogio - noturnoLegal);

    // Extra: o que passou da jornada contratada, com a tolerância do dia.
    let minExtra = 0;
    const contratada = contratadaDoDia ? contratadaDoDia(data) : null;
    if (Number.isFinite(contratada) && contratada > 0) {
      let paraExtra = trabalhado;
      const intervaloContratado = intervaloContratadoDoDia ? Number(intervaloContratadoDoDia(data)) : NaN;
      if (Number.isFinite(intervaloContratado) && intervaloContratado > 0) {
        const tirado = intervaloTiradoMin(reg);
        paraExtra -= Math.max(0, intervaloContratado - tirado);
      }
      const excedente = paraExtra - contratada;
      if (excedente > 0) {
        minExtra = aplicarTolerancia(excedente, toleranciaMin, tetoDiaMin).minutos;
      }
    }

    // Feriado trabalhado: o dia inteiro é pago com adicional (CLT art. 9º da
    // Lei 605/49 — trabalho em feriado sem folga compensatória, em dobro).
    const minFeriado = feriadosSet.has(data) && !(feriadoCompensado && feriadoCompensado(data)) ? trabalhado : 0;

    // Estourou o teto do art. 59: os minutos continuam devidos, mas o dia
    // precisa aparecer para quem monta a escala — senão a irregularidade só
    // vira problema quando alguém reclama.
    const extraAcimaDoLimite = Math.max(0, minExtra - EXTRA_MAXIMA_DIA_MIN);

    if (minNoturno > 0 || minExtra > 0 || minFeriado > 0) {
      dias.push({
        data, minNoturno, minNoturnoRelogio: noturnoRelogio, minExtra, minFeriado,
        minTrabalhado: trabalhado, extraAcimaDoLimite,
      });
    }
  });

  return dias.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

// Ninguém bate a entrada antes do turno começar.
//
// Por que BLOQUEAR em vez de gravar o horário do turno: registro_ponto segue o
// livro de marcações, e o livro guarda a hora REAL — o art. 74, II da CLT
// proíbe marcação com horário predeterminado. Carimbar 15:40 em quem bateu
// 15:39 seria exatamente isso. Barrando na hora, a marcação que entra já é a
// verdadeira, e a Súmula 366 continua valendo onde ela vale: no cálculo.
//
// A janela de 6 horas existe para o caso legítimo de quem foi chamado bem mais
// cedo. Quem chega às 15:39 para um turno de 15:40 está adiantado e espera um
// minuto; quem bate às 9h de um turno de 15:40 não está "adiantado", está
// começando outro expediente, e travar essa pessoa apagaria hora extra real.
// Os minutos apurados acima, virados em dinheiro.
//
// Adicional noturno de 20% sobre a hora normal (CLT art. 73), hora extra com
// +50% (CF art. 7º XVI) e feriado trabalhado com +100% (Lei 605/49 art. 9º).
// Hora normal = salário ÷ 220 (divisor CLT).
//
// Atenção ao que cada valor significa, porque a folha soma isto ao salário:
// `valorNoturno` é SÓ o adicional de 20% (a hora em si já está no salário),
// enquanto `valorExtra` é a hora cheia mais 50% — a extra não está no salário.
// Trocar um pelo outro paga a mais ou a menos e ninguém percebe no total.
//
// Estava dentro de rh.js, que importa o Supabase e por isso o node não
// consegue carregar para testar. Aqui roda sozinho: é a mesma razão pela qual
// `calcularAdicionaisPorDia` já mora neste arquivo.
export function calcularAdicionaisMes(pontosMes, salarioBase, feriados = [], opcoes = {}) {
  const regras = opcoes.regras || REGRAS_CLT;
  const valorHora = (Number(salarioBase) || 0) / 220;
  const totais = calcularAdicionaisPorDia(pontosMes, feriados, opcoes)
    .reduce((a, d) => ({
      minNoturno: a.minNoturno + d.minNoturno,
      minExtra: a.minExtra + d.minExtra,
      minFeriado: a.minFeriado + d.minFeriado,
    }), { minNoturno: 0, minExtra: 0, minFeriado: 0 });
  const { minNoturno, minExtra, minFeriado } = totais;

  const valorNoturno = (minNoturno / 60) * valorHora * regras.noturnoPct / 100;   // só o adicional (CLT 20%)
  const valorExtra = (minExtra / 60) * valorHora * (1 + regras.extraPct / 100);    // hora cheia + adicional (CLT 50%)
  const valorFeriado = (minFeriado / 60) * valorHora * regras.feriadoPct / 100;    // adicional (dobro = 100%)
  return {
    minNoturno, minExtra, minFeriado,
    regras: regras.id, fundamentos: regras.fundamentos,
    valorNoturno: Math.round(valorNoturno * 100) / 100,
    valorExtra: Math.round(valorExtra * 100) / 100,
    valorFeriado: Math.round(valorFeriado * 100) / 100,
  };
}

export const ANTECIPACAO_MAXIMA_BLOQUEADA_MIN = 6 * 60;

// Hora contratada de entrada no dia. A regra tem tres niveis e ja existia
// escrita duas vezes (horarioDoDia no RH, entradaDoDia no ponto). Aqui vira
// uma so: jornada por dia da semana ganha de domingo, que ganha do fixo.
// Duas copias da mesma regra e uma copia esperando divergir.
export function entradaContratada(colaborador, base = new Date()) {
  if (!colaborador) return "";
  const wd = String(base.getDay());
  const porDia = colaborador.horario_por_dia
    && colaborador.horarios_dia
    && colaborador.horarios_dia[wd]
    && colaborador.horarios_dia[wd].e;
  if (porDia) return colaborador.horarios_dia[wd].e;
  if (base.getDay() === 0 && colaborador.horario_dom_entrada) return colaborador.horario_dom_entrada;
  return colaborador.horario_entrada || "";
}

// Mesma regra de entradaContratada, mas a partir da data em texto ("2026-08-30").
//
// O T12:00:00 não é enfeite: `new Date("2026-08-30")` é meia-noite UTC, que no
// nosso fuso é dia 29 às 21h — getDay() devolveria o dia anterior e o domingo
// pegaria o horário de sábado. Meio-dia fica longe das duas bordas.
export function entradaContratadaDoDia(colaborador, dataISO) {
  if (!colaborador || !dataISO) return "";
  return entradaContratada(colaborador, new Date(`${String(dataISO).slice(0, 10)}T12:00:00`));
}

export function minutosDoHorario(horario) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(horario || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Devolve os minutos que faltam para o turno começar, ou 0 quando pode bater.
export function minutosAteOTurno(horarioEntrada, agora = new Date()) {
  const inicio = minutosDoHorario(horarioEntrada);
  if (inicio === null) return 0; // sem horário cadastrado, sem restrição
  const atual = agora.getHours() * 60 + agora.getMinutes();
  const falta = inicio - atual;
  if (falta <= 0) return 0;
  return falta <= ANTECIPACAO_MAXIMA_BLOQUEADA_MIN ? falta : 0;
}

// Opções de cálculo com as regras da casa (dono, 19/10/2026), para toda tela
// que mostra ou paga adicionais usar a mesma conta:
//  · hora extra é paga na folha (o relógio não manda mais para o banco);
//  · voltar antes do fim do intervalo não muda o salário;
//  · feriado trabalhado é pago em dobro, salvo folga de compensação ("Compensação
//    de feriado") marcada em até 30 dias depois (CCT Foz cl. 17).
export function opcoesDaCasa(colaborador, { folgas = [], regras, entradaDoDia } = {}) {
  const minhas = (folgas || []).filter(f => !f?.colaborador_id || f.colaborador_id === colaborador?.id);
  const compensacoes = minhas
    // Só a folga marcada como compensação ("Compensação de feriado"); a antiga
    // "Extra / Feriado" era genérica e não prova compensação.
    .filter(f => /compensa/i.test(String(f?.descricao || "")) && /feriado/i.test(String(f?.descricao || "")))
    .map(f => String(f.data_folga).slice(0, 10));
  const somaDias = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  return {
    ...(regras ? { regras } : {}),
    ...(entradaDoDia ? { entradaDoDia } : {}),
    contratadaDoDia: (d) => jornadaContratadaMin(colaborador, d),
    intervaloContratadoDoDia: () => Number(colaborador?.tempo_intervalo) || 0,
    feriadoCompensado: (d) => compensacoes.some(c => c > d && c <= somaDias(d, 30)),
  };
}
