// HORÁRIO DE FUNCIONAMENTO tocando, não digitando (dono, 24/11/2026: "nesses
// dias que você abre deveria abrir um calendário e um relógio"). Os dias são
// botões da semana, as horas o relógio do celular, com um segundo turno
// opcional (almoço + jantar). O que é guardado continua sendo um texto curto
// ("Ter a Dom, 11h às 15h e 18h às 23h"), o mesmo formato de antes.

export const DIAS_SEMANA = Object.freeze([
  { id: 1, curto: "Seg" }, { id: 2, curto: "Ter" }, { id: 3, curto: "Qua" }, { id: 4, curto: "Qui" },
  { id: 5, curto: "Sex" }, { id: 6, curto: "Sáb" }, { id: 0, curto: "Dom" },
]);
const ORDEM = DIAS_SEMANA.map((d) => d.id);
const CURTO = Object.fromEntries(DIAS_SEMANA.map((d) => [d.id, d.curto]));

/** "11:00" → "11h"; "18:30" → "18h30"; "00:00" → "0h". */
export function horaCurta(hhmm) {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const h = Number(m[1]);
  return m[2] === "00" ? `${h}h` : `${h}h${m[2]}`;
}

/** Dias escolhidos → "Ter a Dom", "Seg, Qua e Sex", "Todos os dias". */
export function textoDosDias(ids = []) {
  const set = new Set(ids);
  const ord = ORDEM.filter((d) => set.has(d));
  if (!ord.length) return "";
  if (ord.length === 7) return "Todos os dias";
  // sequências seguidas na ordem Seg..Dom
  const blocos = [];
  for (const d of ord) {
    const ult = blocos[blocos.length - 1];
    if (ult && ORDEM.indexOf(d) === ORDEM.indexOf(ult[ult.length - 1]) + 1) ult.push(d);
    else blocos.push([d]);
  }
  const partes = blocos.flatMap((b) => (b.length >= 3 ? [`${CURTO[b[0]]} a ${CURTO[b[b.length - 1]]}`] : b.map((d) => CURTO[d])));
  return partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/**
 * @param {{ dias: number[], turnos: { abre: string, fecha: string }[] }} h
 * @returns {{ texto: string } | { erro: string }}
 */
export function textoDoHorario({ dias = [], turnos = [] } = {}) {
  if (!dias.length) return { erro: "Toque nos dias em que abre." };
  const validos = turnos.filter((t) => horaCurta(t.abre) && horaCurta(t.fecha));
  if (!validos.length) return { erro: "Escolha a hora em que abre e a que fecha." };
  if (validos.some((t) => t.abre === t.fecha)) return { erro: "A hora de abrir e a de fechar não podem ser iguais." };
  const horas = validos.map((t) => `${horaCurta(t.abre)} às ${horaCurta(t.fecha)}`).join(" e ");
  return { texto: `${textoDosDias(dias)}, ${horas}` };
}
