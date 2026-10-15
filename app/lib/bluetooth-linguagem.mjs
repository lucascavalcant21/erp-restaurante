// Qual linguagem mandar pela impressora Bluetooth.
// Etiquetadora (MDK-022 e similares) só entende TSPL; impressora de cupom
// (bobina, "térmica de bolso") entende ESC/POS. Mandar a errada faz a
// impressora puxar papel em branco ou não fazer nada — o Bluetooth "conecta,
// mas não imprime".

export const LINGUAGENS_BLUETOOTH = {
  auto: "Automático",
  tspl: "TSPL (etiquetadora — MDK-022 e similares)",
  escpos: "ESC/POS (impressora de cupom / bobina)",
};

// Nomes que as etiquetadoras TSPL costumam anunciar no Bluetooth.
const NOME_ETIQUETADORA = /MDK|022|TSPL|LABEL|ETIQ|XP-?\d{3}B|GP-?\d|HPRT|ZJ-?9|D11|D110|PM-?2/i;

/**
 * @param escolha      "auto" | "tspl" | "escpos" (o que o usuário fixou)
 * @param printerType  tipo do perfil de etiqueta do setor ("mdk022", "tp20", "bluetooth")
 * @param nome         nome que a impressora anunciou no pareamento
 */
export function escolherLinguagemBluetooth({ escolha = "auto", printerType = "", nome = "" } = {}) {
  if (escolha === "tspl" || escolha === "escpos") return escolha;
  if (printerType === "mdk022") return "tspl";
  if (NOME_ETIQUETADORA.test(String(nome || ""))) return "tspl";
  return "escpos";
}

// iPhone/iPad: o Safari e todo navegador do iOS bloqueiam Bluetooth para sites.
// O Bluefy (App Store, gratuito) é um navegador que libera o Web Bluetooth.
export function ehAppleMovel(ua = "", maxTouchPoints = 0) {
  return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && Number(maxTouchPoints) > 1);
}
