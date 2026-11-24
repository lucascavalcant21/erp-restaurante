// Comprovante de cada batida no histórico da pessoa (dono, 24/11/2026: "não
// dá pra imprimir o comprovante, deixe em um histórico da pessoa"). A tela de
// sucesso do tablet não mostra mais o comprovante inteiro (com CPF, para quem
// estiver passando ver): ela avisa o NSR e o comprovante fica no "Meu
// histórico", uma linha por marcação do livro (ponto_marcacao, Portaria MTP
// 671/2021). No tablet da casa o CPF aparece mascarado; o número completo
// continua no livro e no AFD.

export const ROTULO_TIPO = Object.freeze({
  entrada: "Entrada",
  saida_intervalo: "Saída p/ intervalo",
  retorno_intervalo: "Volta do intervalo",
  saida_trabalho: "Saída do trabalho",
});

/** "702.028.382-93" → "•••.•••.382-93"; sem 11 dígitos, null. */
export function mascararCpf(cpf) {
  const d = String(cpf || "").replace(/\D/g, "");
  if (d.length !== 11) return null;
  return `•••.•••.${d.slice(6, 9)}-${d.slice(9)}`;
}

/** Rótulo da marcação: batida normal ou correção/desconsideração feita pelo gestor. */
export function rotuloDaMarcacao(m) {
  const base = ROTULO_TIPO[m?.tipo] || ROTULO_TIPO[m?.tipo_alvo] || "Marcação";
  const origem = String(m?.origem || "").toLowerCase();
  if (origem && !["tablet", "relogio", "relógio", "app", "online", "kiosk", "quiosque", ""].includes(origem)) {
    if (/corre|ajust|inclus|manual/.test(origem)) return `${ROTULO_TIPO[m?.tipo_alvo] || base} (correção)`;
  }
  return base;
}

/** Comprovantes do mês, do mais recente ao mais antigo. */
export function comprovantesDoMes(marcacoes) {
  return (Array.isArray(marcacoes) ? marcacoes : [])
    .filter((m) => m && m.nsr != null)
    .sort((a, b) => Number(b.nsr) - Number(a.nsr))
    .map((m) => ({
      id: m.id || String(m.nsr),
      nsr: Number(m.nsr),
      rotulo: rotuloDaMarcacao(m),
      em: m.marcado_em ? new Date(m.marcado_em) : null,
      dia: String(m.data_referencia || "").slice(0, 10),
      hash: m.hash || null,
    }));
}
