// Folga de domingo na tela de Folgas do RH. Antes a lista só tinha os PRÓXIMOS
// domingos e data passada era recusada — mas a folga do mês que passou também
// precisa ser lançada (esquecimento, escala combinada de boca): sem ela o
// espelho do mês fica sem "FOLGA DE DOMINGO" naquele dia.
//
// Agora a lista vai do 1º dia do mês passado até 5 semanas à frente, agrupada
// por mês. Data passada é permitida, mas pede confirmação com o que muda.

const p2 = (n) => String(n).padStart(2, "0");
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const isoUTC = (d) => `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
const diaUTC = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);

export const ehDomingo = (iso) => diaUTC(iso).getUTCDay() === 0;
export const dataCurta = (iso) => { const [, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}`; };
export const nomeDoMes = (anoMes) => { const [a, m] = String(anoMes).split("-").map(Number); return `${MESES[m - 1]}/${a}`; };

/**
 * Domingos que a tela oferece, agrupados por mês: do 1º dia do mês passado até
 * `semanasAFrente` semanas depois de hoje. hoje = "AAAA-MM-DD" (data local).
 */
export function domingosParaFolga(hoje, semanasAFrente = 5) {
  const [a, m] = hoje.split("-").map(Number);
  const inicio = new Date(Date.UTC(a, m - 2, 1, 12));
  const fim = diaUTC(hoje);
  fim.setUTCDate(fim.getUTCDate() + semanasAFrente * 7);
  const mesAtual = hoje.slice(0, 7);
  const mesPassado = isoUTC(inicio).slice(0, 7);

  const d = new Date(inicio);
  d.setUTCDate(d.getUTCDate() + ((7 - d.getUTCDay()) % 7)); // primeiro domingo
  const meses = [];
  for (; d <= fim; d.setUTCDate(d.getUTCDate() + 7)) {
    const data = isoUTC(d);
    const anoMes = data.slice(0, 7);
    let grupo = meses[meses.length - 1];
    if (!grupo || grupo.anoMes !== anoMes) {
      grupo = {
        anoMes,
        rotulo: nomeDoMes(anoMes),
        relativo: anoMes === mesPassado ? "mês passado" : anoMes === mesAtual ? "este mês" : "",
        domingos: [],
      };
      meses.push(grupo);
    }
    grupo.domingos.push({ data, label: dataCurta(data), passou: data < hoje });
  }
  return meses;
}

/** Folgas de domingo que a pessoa já tem no mês (a regra é 1 por mês). */
export function folgasDeDomingoNoMes(folgas, anoMes) {
  return (folgas || [])
    .map((f) => String(f?.data_folga || "").slice(0, 10))
    .filter((d) => d.startsWith(`${anoMes}-`) && ehDomingo(d))
    .sort();
}

/**
 * Avisos antes de gravar uma folga. Lista vazia = grava direto. Com avisos, a
 * tela pede confirmação — nada aqui proíbe, porque quem lança é o gerente.
 *   pontoDoDia: registro_ponto da pessoa nesse dia (ou null)
 */
export function avisosDaFolga({ data, hoje, nome = "", folgas = [], pontoDoDia = null, horaLocal = (iso) => iso, genero = "" }) {
  const avisos = [];
  const quem = nome ? String(nome).split(" ")[0] : "A pessoa";
  const trabalhou = !!pontoDoDia?.hora_entrada;
  if (data < hoje) {
    avisos.push(trabalhou
      ? `${dataCurta(data)} já passou: é uma folga retroativa.`
      : `${dataCurta(data)} já passou: é uma folga retroativa. O espelho de ${nomeDoMes(data.slice(0, 7))} passa a mostrar a folga nesse dia.`);
  }
  if (trabalhou) {
    avisos.push(`${quem} bateu ponto nesse dia (entrada ${horaLocal(pontoDoDia.hora_entrada)}). Com ponto batido, o espelho continua mostrando o dia como trabalhado.`);
  }
  if (ehDomingo(data)) {
    const outras = folgasDeDomingoNoMes(folgas, data.slice(0, 7)).filter((d) => d !== data);
    const limite = genero === "Feminino" ? 2 : 1;
    if (outras.length >= limite) avisos.push(`${quem} já tem ${outras.length} folga(s) de domingo em ${nomeDoMes(data.slice(0, 7))} (${outras.map(dataCurta).join(", ")}). A regra é ${limite} por mês${genero === "Feminino" ? " para mulheres" : ""}.`);
  }
  return avisos;
}
