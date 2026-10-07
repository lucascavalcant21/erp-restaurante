// VoiceProvider — voz desacoplada do Command Bus.
//
//   ÁUDIO → speech-to-text (provedor) → TEXTO → /api/intelligence/ask (o mesmo
//   caminho do teclado, canal "voz") → resposta → text-to-speech opcional
//
// O Command Bus nunca sabe de onde o texto veio: trocar o reconhecimento do
// navegador por uma transcrição no servidor (Whisper, Deepgram…) é trocar
// este provedor, sem mexer no núcleo. Hoje: Web Speech API do navegador,
// pelo módulo que o ERP já usa (app/lib/hefisto-voz.js).
//
// Contrato:
//   nome, disponivel(), sinteseDisponivel()
//   ouvir({ onParcial, onFinal, onErro, onFim }) → { parar }
//   falar(texto) / calar()

import { vozDisponivel, audioDisponivel, criarEscuta, falarTexto, calarVoz } from "../../hefisto-voz";

export const vozDoNavegador = Object.freeze({
  nome: "web-speech",
  disponivel: () => vozDisponivel(),
  sinteseDisponivel: () => audioDisponivel(),
  ouvir({ onParcial, onFinal, onErro, onFim } = {}) {
    const escuta = criarEscuta({ onParcial, onFinal, onErro, onFim, continuo: false });
    if (!escuta) { onErro?.("Este navegador não tem reconhecimento de voz. Use o Chrome no celular ou digite."); return { parar() {} }; }
    escuta.iniciar();
    return { parar: () => escuta.parar() };
  },
  falar: (texto) => falarTexto(texto),
  calar: () => calarVoz(),
});

/** Provedor de voz ativo. Ponto único de troca. */
export function provedorDeVoz() {
  return vozDoNavegador;
}
