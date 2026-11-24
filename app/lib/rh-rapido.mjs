// RH RÁPIDO (pedido do dono, 23/11/2026): "folga de domingo, feriados, o
// funcionário bateu o ponto errado, dar folga, o funcionário está doente — tudo
// mais prático e mais rápido". Regras puras da tela Ações rápidas do RH
// (app/dashboard/rh/rapido). Gravar continua pelas funções de app/lib/rh.js.
//
// Folga de domingo: a regra da casa é 1 por mês (2 para mulheres), a mesma de
// folgas-domingo.mjs. Nada aqui proíbe: avisa, e quem lança é o gerente.

import { horarioDoDia } from "./jornada-semana.mjs";
import { ehDomingo, folgasDeDomingoNoMes, nomeDoMes } from "./folgas-domingo.mjs";

const p2 = (n) => String(n).padStart(2, "0");
const isoUTC = (d) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const diaUTC = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);

export const limiteDomingos = (colab) => (colab?.genero === "Feminino" ? 2 : 1);
export const ativo = (c) => (c?.status || "ativo") === "ativo";
export const primeiroNome = (nome) => String(nome || "").trim().split(/\s+/)[0] || "";

/** Domingos do mês de `hoje` e do seguinte (a escala que se monta). */
export function domingosDaEscala(hoje, meses = 2) {
  const [a, m] = String(hoje).split("-").map(Number);
  const out = [];
  const d = new Date(Date.UTC(a, m - 1, 1, 12));
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7));
  const fim = new Date(Date.UTC(a, m - 1 + meses, 1, 12));
  for (; d < fim; d.setUTCDate(d.getUTCDate() + 7)) {
    const data = isoUTC(d);
    out.push({ data, anoMes: data.slice(0, 7), passou: data < hoje, rotulo: `${p2(d.getUTCDate())}/${p2(d.getUTCMonth() + 1)}` });
  }
  return out;
}

/** Trabalha domingo pela ficha (dias_trabalho com 0 e horário). Sem dias na ficha: conta como trabalha. */
export const trabalhaDomingo = (c) => !!horarioDoDia(c, 0);

/**
 * Grade de folgas de domingo: uma linha por funcionário ativo, uma coluna por
 * domingo. Cada linha diz, por mês, quantas folgas tem e se falta ou passou do
 * limite; cada coluna diz quantas pessoas folgam naquele domingo.
 */
export function escalaDeDomingos(colaboradores = [], folgas = [], domingos = []) {
  const porColab = new Map();
  for (const f of folgas) {
    const lista = porColab.get(f.colaborador_id) || [];
    lista.push(f);
    porColab.set(f.colaborador_id, lista);
  }
  const meses = [...new Set(domingos.map((d) => d.anoMes))];
  const linhas = colaboradores.filter(ativo)
    .map((c) => {
      const fs = porColab.get(c.id) || [];
      const limite = limiteDomingos(c);
      const celulas = domingos.map((d) => {
        const f = fs.find((x) => String(x.data_folga).slice(0, 10) === d.data);
        return { data: d.data, folga: !!f, folgaId: f?.id || null };
      });
      const porMes = meses.map((anoMes) => {
        const n = folgasDeDomingoNoMes(fs, anoMes).length;
        return { anoMes, rotulo: nomeDoMes(anoMes), n, limite, situacao: n === 0 ? "falta" : n > limite ? "acima" : n < limite ? "pode_mais" : "ok" };
      });
      return { id: c.id, nome: c.nome, primeiro: primeiroNome(c.nome), cargo: c.cargo || "", limite, trabalhaDomingo: trabalhaDomingo(c), celulas, porMes };
    })
    .sort((a, b) => (b.trabalhaDomingo - a.trabalhaDomingo) || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
  const colunas = domingos.map((d, i) => ({ ...d, deFolga: linhas.filter((l) => l.celulas[i].folga).map((l) => l.primeiro) }));
  const faltando = linhas.filter((l) => l.trabalhaDomingo).flatMap((l) => l.porMes.filter((m) => m.situacao === "falta").map((m) => ({ nome: l.primeiro, anoMes: m.anoMes })));
  return { linhas, colunas, meses, faltando };
}

/** Datas de um período (inclusive), no máximo 60 dias. */
export function diasDoPeriodo(inicio, fim) {
  if (!inicio) return [];
  const a = diaUTC(inicio);
  const b = diaUTC(fim || inicio);
  if (b < a) return [];
  const out = [];
  for (const d = new Date(a); d <= b && out.length < 60; d.setUTCDate(d.getUTCDate() + 1)) out.push(isoUTC(d));
  return out;
}

export function somarDias(iso, n) {
  const d = diaUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return isoUTC(d);
}

/**
 * Folga em um ou mais dias para uma ou mais pessoas: o que grava e o que pula
 * (quem já tem folga naquele dia). Sem gravar nada aqui.
 */
export function planoDeFolgas({ colaboradores = [], ids = [], datas = [], folgas = [], motivo = "" }) {
  const gravar = [];
  const pulados = [];
  for (const id of ids) {
    const c = colaboradores.find((x) => x.id === id);
    if (!c) continue;
    for (const data of datas) {
      const ja = folgas.some((f) => f.colaborador_id === id && String(f.data_folga).slice(0, 10) === data);
      if (ja) pulados.push({ id, nome: primeiroNome(c.nome), data });
      else gravar.push({ colaborador_id: id, nome: primeiroNome(c.nome), data_folga: data, descricao: motivo || (ehDomingo(data) ? "Domingo" : "Folga") });
    }
  }
  return { gravar, pulados };
}

/** Atestado: confere o período antes de gravar. */
export function conferirAtestado({ colaboradorId, inicio, dias, fim }) {
  const erros = [];
  if (!colaboradorId) erros.push("Escolha o funcionário.");
  if (!inicio) erros.push("Escolha o primeiro dia.");
  const ate = fim || (Number(dias) > 0 ? somarDias(inicio, Number(dias) - 1) : inicio);
  if (inicio && ate < inicio) erros.push("O último dia é antes do primeiro.");
  if (inicio && diasDoPeriodo(inicio, ate).length > 30) erros.push("Atestado de mais de 30 dias: lance pela ficha do funcionário (afastamento).");
  return { erros, data_inicio: inicio, data_fim: ate, dias: inicio ? diasDoPeriodo(inicio, ate).length : 0 };
}

/** Feriados nacionais de data fixa, para sugerir no ano. Os móveis (Carnaval, Paixão, Corpus Christi) e os locais o dono lança. */
export function feriadosNacionaisFixos(ano) {
  return [
    ["01-01", "Confraternização Universal"], ["04-21", "Tiradentes"], ["05-01", "Dia do Trabalho"], ["09-07", "Independência do Brasil"],
    ["10-12", "Nossa Senhora Aparecida"], ["11-02", "Finados"], ["11-15", "Proclamação da República"], ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"], ["12-25", "Natal"],
  ].map(([md, nome]) => ({ data: `${ano}-${md}`, nome }));
}

/** Sugestões que ainda não estão cadastradas, de hoje em diante. */
export function feriadosParaSugerir(hoje, cadastrados = []) {
  const ano = Number(String(hoje).slice(0, 4));
  const ja = new Set(cadastrados.map((f) => String(f.data).slice(0, 10)));
  return [...feriadosNacionaisFixos(ano), ...feriadosNacionaisFixos(ano + 1)].filter((f) => f.data >= hoje && !ja.has(f.data)).slice(0, 6);
}
