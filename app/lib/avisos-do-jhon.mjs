// O que o Jhon avisa ao dono agora, e o que ele propõe fazer.
//
// O Jhon nunca altera nada sozinho. Ele detecta, explica e propõe; quem
// aprova é o dono. Isso vale em dobro para o ponto: batida é documento
// trabalhista (Portaria MTP 671/2021). A marcação original não some, e todo
// ajuste precisa de autor e motivo — quem grava é `corrigirBatida`, que já
// faz isso. Este módulo só monta a proposta.
//
// Módulo puro: sem Supabase, sem relógio escondido. `agora` entra de fora,
// para o teste conseguir dizer "são 10:42 de sábado".
//
// O que NÃO está aqui, de propósito: ar-condicionado, luz, temperatura. Sem
// sensor ligado não existe dado, e aviso inventado é pior do que aviso
// nenhum. `fontesSemDado` diz isso à tela.
import { avisosDaOperacao, linkWhatsApp } from "./operacao-avisos.mjs";
import { horarioDoDia } from "./jornada-semana.mjs";

export const FUSO = "America/Sao_Paulo";

// A CLT tolera 5 minutos por marcação e 10 no dia (art. 58, §1º). Antes
// disso, chegar "atrasado" não é atraso.
export const TOLERANCIA_ATRASO_MIN = 10;

// Entrada mais de 2 horas longe da escala quase nunca é atraso: é batida no
// botão errado, tablet com hora errada ou alguém que bateu pelo colega. Aí o
// Jhon não cobra o funcionário, ele pergunta ao dono qual horário vale.
export const LIMITE_BATIDA_ESTRANHA_MIN = 120;

// Duas batidas seguidas com menos que isso entre elas é toque duplo.
export const MINUTOS_TOQUE_DUPLO = 5;

const ROTULO_BATIDA = {
  entrada: "entrada",
  saida_intervalo: "saída para o intervalo",
  retorno_intervalo: "volta do intervalo",
  saida_trabalho: "saída",
};

const CAMPO = {
  entrada: "hora_entrada",
  saida_intervalo: "hora_saida_intervalo",
  retorno_intervalo: "hora_retorno_intervalo",
  saida_trabalho: "hora_saida",
};

// ── Relógio de Brasília ─────────────────────────────────────────────────────
// O servidor da Vercel roda em UTC e o tablet pode estar com fuso errado:
// tudo aqui é lido no fuso da casa.
function partesSP(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(d).map(x => [x.type, x.value]));
  const dias = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    minutos: Number(p.hour) * 60 + Number(p.minute),
    diaSemana: dias[p.weekday],
  };
}

export const dataSP = (d) => partesSP(d)?.data ?? null;
export const horaSP = (iso) => {
  const p = iso ? partesSP(iso) : null;
  if (!p) return "--:--";
  return `${String(Math.floor(p.minutos / 60)).padStart(2, "0")}:${String(p.minutos % 60).padStart(2, "0")}`;
};

const paraMin = (hhmm) => {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

const diaDaSemanaDe = (dataISO) => {
  const [y, m, d] = String(dataISO).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
};

/** ISO de um horário de Brasília. `diaSeguinte` para saída depois da meia-noite. */
export function horaISO(dataReferencia, hhmm, diaSeguinte = false) {
  const min = paraMin(hhmm);
  if (min == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(dataReferencia || ""))) return null;
  let data = dataReferencia;
  if (diaSeguinte) {
    const [y, m, d] = data.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + 1));
    data = dt.toISOString().slice(0, 10);
  }
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const mm = String(min % 60).padStart(2, "0");
  return new Date(`${data}T${h}:${mm}:00-03:00`).toISOString();
}

// Diferença em minutos entre a hora batida e a da escala, no relógio do dia
// (sem data): 23:50 contra 00:10 é 20 minutos, não 23 horas.
function distanciaNoRelogio(minA, minB) {
  const bruta = Math.abs(minA - minB);
  return Math.min(bruta, 1440 - bruta);
}

const pessoaDe = (c) => (c ? { id: c.id, nome: c.nome || "Funcionário", telefone: c.telefone || "" } : null);
const primeiroNome = (n) => String(n || "").trim().split(/\s+/)[0] || "Funcionário";

// ── Ponto ───────────────────────────────────────────────────────────────────

function avisosDePontoDeHoje({ colaboradores, pontosHoje, folgasHoje, atestadosHoje, agora }) {
  const sp = partesSP(agora);
  if (!sp) return [];
  const porColab = new Map((pontosHoje || []).filter(Boolean).map(r => [r.colaborador_id, r]));
  const folga = new Set(folgasHoje || []);
  const atestado = new Set(atestadosHoje || []);
  const avisos = [];

  for (const c of colaboradores || []) {
    if (!c || (c.status && c.status !== "ativo")) continue;
    if (folga.has(c.id) || atestado.has(c.id)) continue;
    const reg = porColab.get(c.id);
    // Registro de ontem ainda aberto (turno da madrugada): não é o dia de hoje.
    const regDeHoje = reg && reg.data_referencia === sp.data ? reg : null;
    const escala = horarioDoDia(c, sp.diaSemana);
    const pessoa = pessoaDe(c);
    const nome = primeiroNome(c.nome);

    // 1) Não bateu a entrada e já passou da hora.
    if (escala && !regDeHoje?.hora_entrada && !(reg && reg !== regDeHoje)) {
      const entradaMin = paraMin(escala.entrada);
      const atraso = sp.minutos - entradaMin;
      if (entradaMin != null && atraso > TOLERANCIA_ATRASO_MIN) {
        avisos.push({
          chave: `sem-entrada:${c.id}:${sp.data}`,
          origem: "ponto",
          gravidade: atraso > 60 ? "critico" : "atencao",
          titulo: `${nome} não bateu o ponto`,
          detalhe: `Escala de hoje começa às ${escala.entrada}. Já são ${atraso} min de atraso.`
            + (sp.diaSemana === 0 ? " Confira se não é folga de domingo." : ""),
          pessoa,
          mensagem: `Oi, ${nome}. Sua entrada hoje era às ${escala.entrada} e ainda não tem ponto batido. Está tudo bem? Vai chegar que horas?`,
          acao: { tipo: "cobrar" },
        });
      }
      continue;
    }

    if (!regDeHoje?.hora_entrada || !escala) continue;

    // 2) Bateu a entrada, mas longe demais da escala: pergunta qual vale.
    const batidaMin = partesSP(regDeHoje.hora_entrada)?.minutos;
    const entradaMin = paraMin(escala.entrada);
    if (batidaMin != null && entradaMin != null) {
      const distancia = distanciaNoRelogio(batidaMin, entradaMin);
      const bateu = horaSP(regDeHoje.hora_entrada);
      if (distancia > LIMITE_BATIDA_ESTRANHA_MIN) {
        avisos.push({
          chave: `entrada-estranha:${c.id}:${sp.data}`,
          origem: "ponto",
          gravidade: "atencao",
          titulo: `${nome} bateu a entrada às ${bateu}`,
          detalhe: `A escala de hoje é ${escala.entrada}. Pode ter sido batida errada. Qual horário vale?`,
          pessoa,
          mensagem: `Oi, ${nome}. Seu ponto de entrada hoje ficou às ${bateu}, e sua escala é ${escala.entrada}. Que horas você chegou de verdade?`,
          acao: ajusteProposto({ colaborador: c, dataReferencia: sp.data, tipo: "entrada", horaRegistrada: bateu, horaSugerida: escala.entrada }),
        });
      } else {
        const atraso = batidaMin - entradaMin;
        if (atraso > TOLERANCIA_ATRASO_MIN) {
          avisos.push({
            chave: `atrasou:${c.id}:${sp.data}`,
            origem: "ponto",
            gravidade: "atencao",
            titulo: `${nome} chegou ${atraso} min atrasado`,
            detalhe: `Escala às ${escala.entrada}, bateu às ${bateu}.`,
            pessoa,
            mensagem: `Oi, ${nome}. Hoje sua entrada ficou às ${bateu}, ${atraso} min depois da escala (${escala.entrada}). Aconteceu alguma coisa?`,
            acao: { tipo: "cobrar" },
          });
        }
      }
    }

    // 3) Toque duplo: duas batidas coladas.
    const toque = toqueDuplo(regDeHoje);
    if (toque) {
      avisos.push({
        chave: `toque-duplo:${c.id}:${sp.data}:${toque.tipo}`,
        origem: "ponto",
        gravidade: "atencao",
        titulo: `${nome}: ${ROTULO_BATIDA[toque.tipo]} ${toque.minutos} min depois da batida anterior`,
        detalhe: `Parece toque duplo no tablet (${horaSP(toque.anterior)} e ${horaSP(toque.atual)}). Qual é o horário certo da ${ROTULO_BATIDA[toque.tipo]}?`,
        pessoa,
        mensagem: `Oi, ${nome}. Seu ponto de hoje tem duas batidas quase juntas (${horaSP(toque.anterior)} e ${horaSP(toque.atual)}). Que horas foi a ${ROTULO_BATIDA[toque.tipo]} de verdade?`,
        acao: ajusteProposto({ colaborador: c, dataReferencia: sp.data, tipo: toque.tipo, horaRegistrada: horaSP(toque.atual), horaSugerida: null }),
      });
    }
  }
  return avisos;
}

function toqueDuplo(reg) {
  const ordem = ["entrada", "saida_intervalo", "retorno_intervalo", "saida_trabalho"];
  let anterior = null;
  for (const tipo of ordem) {
    const valor = reg[CAMPO[tipo]];
    if (!valor) continue;
    if (anterior) {
      const min = Math.round((new Date(valor) - new Date(anterior)) / 60000);
      if (min >= 0 && min < MINUTOS_TOQUE_DUPLO) {
        return { tipo, minutos: min, anterior, atual: valor };
      }
    }
    anterior = valor;
  }
  return null;
}

// Dias anteriores com entrada e sem saída: esqueceu de bater a saída.
function avisosDeSaidaEsquecida({ colaboradores, pontosAbertos }) {
  const porId = new Map((colaboradores || []).filter(Boolean).map(c => [c.id, c]));
  const avisos = [];
  for (const reg of pontosAbertos || []) {
    if (!reg?.hora_entrada || reg.hora_saida) continue;
    const c = porId.get(reg.colaborador_id);
    if (!c) continue;
    const escala = horarioDoDia(c, diaDaSemanaDe(reg.data_referencia));
    const nome = primeiroNome(c.nome);
    const dia = String(reg.data_referencia).split("-").reverse().slice(0, 2).join("/");
    avisos.push({
      chave: `sem-saida:${c.id}:${reg.data_referencia}`,
      origem: "ponto",
      gravidade: "atencao",
      titulo: `${nome} não bateu a saída em ${dia}`,
      detalhe: escala
        ? `Entrou às ${horaSP(reg.hora_entrada)}. A escala termina às ${escala.saida}. Qual horário vale?`
        : `Entrou às ${horaSP(reg.hora_entrada)} e o dia ficou aberto. Sem escala cadastrada, informe o horário.`,
      pessoa: pessoaDe(c),
      mensagem: `Oi, ${nome}. No dia ${dia} ficou sem a batida de saída. Que horas você saiu?`,
      acao: ajusteProposto({
        colaborador: c,
        dataReferencia: reg.data_referencia,
        tipo: "saida_trabalho",
        horaRegistrada: null,
        horaSugerida: escala?.saida ?? null,
        // Saída antes da entrada no relógio é turno que passou da meia-noite.
        diaSeguinte: escala ? paraMin(escala.saida) < paraMin(escala.entrada) : false,
      }),
    });
  }
  return avisos;
}

function ajusteProposto({ colaborador, dataReferencia, tipo, horaRegistrada, horaSugerida, diaSeguinte = false }) {
  return {
    tipo: "ajustar_ponto",
    colaboradorId: colaborador.id,
    colaboradorNome: colaborador.nome,
    dataReferencia,
    batida: tipo,
    rotuloBatida: ROTULO_BATIDA[tipo],
    horaRegistrada,
    horaSugerida,
    // A sugestão é a escala cadastrada, não o que aconteceu: natureza SUGESTÃO.
    naturezaSugestao: horaSugerida ? "SUGESTÃO (escala cadastrada)" : null,
    diaSeguinte,
  };
}

/**
 * O que gravar quando o dono escolhe. Devolve null para "manter como está"
 * (não há o que gravar) e `{ erro }` quando a escolha não fecha.
 *
 * escolha: "manter" | "sugerida" | "outro"
 */
export function ajusteDaEscolha(acao, escolha, { horaDigitada = "", quemAprovou = "", motivo = "" } = {}) {
  if (!acao || acao.tipo !== "ajustar_ponto") return { erro: "Este aviso não é de ponto." };
  if (escolha === "manter") return null;
  const quem = String(quemAprovou || "").trim();
  if (!quem) return { erro: "Falta quem aprovou o ajuste." };

  let hhmm;
  if (escolha === "sugerida") hhmm = acao.horaSugerida;
  else if (escolha === "outro") hhmm = String(horaDigitada || "").trim();
  else return { erro: "Escolha inválida." };

  if (paraMin(hhmm) == null || paraMin(hhmm) >= 1440) return { erro: "Informe um horário válido (ex.: 08:00)." };
  if (acao.horaRegistrada && hhmm === acao.horaRegistrada) return null;

  // Saída depois da meia-noite: a sugestão já sabe; no horário digitado, só
  // é dia seguinte se ficar antes da entrada da escala (o dono não precisa
  // pensar nisso).
  const diaSeguinte = escolha === "sugerida" ? Boolean(acao.diaSeguinte) : Boolean(acao.diaSeguinte && paraMin(hhmm) < 12 * 60);

  const origem = escolha === "sugerida" ? "horário da escala" : "horário informado pelo dono";
  return {
    unidadeId: null, // quem chama preenche: tenant vem da sessão, não do aviso
    colaboradorId: acao.colaboradorId,
    dataReferencia: acao.dataReferencia,
    tipo: acao.batida,
    novaHoraISO: horaISO(acao.dataReferencia, hhmm, diaSeguinte),
    registradoPor: quem,
    motivo: [
      `Ajuste aprovado por ${quem} no aviso do Jhon`,
      `${acao.rotuloBatida}: ${acao.horaRegistrada ?? "sem batida"} → ${hhmm} (${origem})`,
      String(motivo || "").trim(),
    ].filter(Boolean).join(". "),
  };
}

// ── Junta tudo ──────────────────────────────────────────────────────────────

/**
 * Avisos do Jhon para o dono.
 *
 * Cada fonte é opcional. Fonte que não veio (null/undefined) entra em
 * `fontesSemDado` em vez de virar "está tudo certo": lista vazia porque não
 * leu é diferente de lista vazia porque não tem problema.
 */
export function avisosDoJhon({
  agora = new Date(),
  colaboradores,
  pontosHoje,
  pontosAbertos,
  folgasHoje = [],
  atestadosHoje = [],
  execucoes,
  ncs,
} = {}) {
  const fontesSemDado = [];
  const avisos = [];

  if (colaboradores && pontosHoje) {
    avisos.push(...avisosDePontoDeHoje({ colaboradores, pontosHoje, folgasHoje, atestadosHoje, agora }));
  } else {
    fontesSemDado.push({ fonte: "Ponto de hoje", motivo: "não consegui ler os funcionários ou as batidas de hoje" });
  }

  if (colaboradores && pontosAbertos) {
    avisos.push(...avisosDeSaidaEsquecida({ colaboradores, pontosAbertos }));
  } else {
    fontesSemDado.push({ fonte: "Saídas esquecidas", motivo: "não consegui ler os dias anteriores do ponto" });
  }

  if (execucoes || ncs) {
    for (const a of avisosDaOperacao({ execucoes: execucoes || [], ncs: ncs || [], colaboradores: colaboradores || [], agora })) {
      avisos.push({ ...a, origem: "operacao", acao: { tipo: "cobrar" } });
    }
  }
  if (!execucoes) fontesSemDado.push({ fonte: "Checklists e produção", motivo: "não consegui ler as rotinas de hoje" });
  if (!ncs) fontesSemDado.push({ fonte: "Não conformidades", motivo: "não consegui ler as ocorrências abertas" });

  fontesSemDado.push({ fonte: "Ar-condicionado, luzes e temperatura", motivo: "nenhum sensor ligado ao Héfisto" });

  for (const a of avisos) {
    a.whatsapp = a.pessoa?.telefone ? linkWhatsApp(a.pessoa.telefone, a.mensagem) : null;
  }

  const peso = { critico: 0, atencao: 1 };
  const ordemOrigem = { ponto: 0, operacao: 1 };
  avisos.sort((a, b) =>
    (peso[a.gravidade] ?? 9) - (peso[b.gravidade] ?? 9)
    || (ordemOrigem[a.origem] ?? 9) - (ordemOrigem[b.origem] ?? 9)
    || String(a.titulo).localeCompare(String(b.titulo), "pt-BR"));

  return { avisos, fontesSemDado };
}

// Avisos dispensados ficam por dia e por aparelho: amanhã o mesmo problema,
// se voltar, volta a aparecer.
export function semDispensados(avisos, dispensados) {
  const fora = new Set(dispensados || []);
  return (avisos || []).filter(a => !fora.has(a.chave));
}
