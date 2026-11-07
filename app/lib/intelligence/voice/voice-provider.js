// VoiceProvider — voz desacoplada do Command Bus.
//
//   ÁUDIO → speech-to-text (provedor) → TEXTO → /api/intelligence/ask (o mesmo
//   caminho do teclado, canal "voz") → resposta → text-to-speech opcional
//
// O Command Bus nunca sabe de onde o texto veio: trocar o reconhecimento do
// navegador por uma transcrição no servidor (Whisper, Deepgram…) é trocar
// este provedor, sem mexer no núcleo. Hoje: Web Speech API do navegador,
// pelo módulo que o ERP já usa (app/lib/hefisto-voz.js), ou GRAVAÇÃO + transcrição
// no servidor (voz-gravada.js) onde o navegador não reconhece (iPhone).
//
// Contrato:
//   nome, disponivel(), sinteseDisponivel()
//   ouvir({ onParcial, onFinal, onErro, onFim }) → { parar }
//   falar(texto) / calar()

import { vozDisponivel, audioDisponivel, criarEscuta, falarTexto, calarVoz } from "../../hefisto-voz";
import { criarVozGravada } from "./voz-gravada";

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

/** iPhone/iPad (inclui iPad que se apresenta como Mac). */
export function ehIOS(nav = typeof navigator !== "undefined" ? navigator : null) {
  if (!nav) return false;
  return /iPhone|iPad|iPod/i.test(nav.userAgent || "") || (/Macintosh/i.test(nav.userAgent || "") && (nav.maxTouchPoints || 0) > 1);
}

/**
 * Provedor de voz ativo. Ponto único de troca.
 *  - iPhone/iPad, ou navegador sem reconhecimento: GRAVA e o servidor transcreve;
 *  - demais (Android/Chrome): reconhecimento do navegador (texto aparece enquanto fala).
 * @param {{ unidadeAtual?: () => string|null, forcarGravada?: boolean }} [opcoes]
 */
export function provedorDeVoz({ unidadeAtual = () => null, forcarGravada = false } = {}) {
  const gravada = criarVozGravada(unidadeAtual);
  if (gravada.disponivel() && (forcarGravada || ehIOS() || !vozDisponivel())) return gravada;
  return vozDoNavegador;
}
