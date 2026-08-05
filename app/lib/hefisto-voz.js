// Camada de VOZ do Assistente Hefisto.
// Isola o reconhecimento (fala → texto) e a síntese (texto → fala) atrás de uma
// interface simples, para trocar o provedor depois (ex.: transcrição em servidor)
// sem mexer na tela. Hoje usa a API nativa do navegador.

const Reconhecimento = () =>
  (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;

export function vozDisponivel() {
  return !!Reconhecimento();
}

export function audioDisponivel() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// Cria uma sessão de escuta. Retorna { iniciar, parar }.
// onParcial: texto enquanto a pessoa fala. onFinal: frase pronta.
export function criarEscuta({ onParcial, onFinal, onErro, onFim } = {}) {
  const API = Reconhecimento();
  if (!API) return null;

  const rec = new API();
  rec.lang = "pt-BR";
  rec.continuous = false;        // uma frase por vez: comando curto
  rec.interimResults = true;     // mostra o texto enquanto fala
  rec.maxAlternatives = 1;

  let finalizado = "";

  rec.onresult = (evento) => {
    let parcial = "";
    for (let i = evento.resultIndex; i < evento.results.length; i++) {
      const trecho = evento.results[i][0].transcript;
      if (evento.results[i].isFinal) finalizado += trecho;
      else parcial += trecho;
    }
    if (parcial && onParcial) onParcial(parcial);
    if (finalizado && onFinal) { onFinal(finalizado.trim()); finalizado = ""; }
  };

  rec.onerror = (evento) => {
    const mapa = {
      "not-allowed": "Permissão do microfone negada. Autorize o microfone nas configurações do navegador.",
      "service-not-allowed": "O navegador bloqueou o microfone neste site.",
      "no-speech": "Não ouvi nada. Toque no microfone e fale de novo.",
      "audio-capture": "Não encontrei um microfone neste aparelho.",
      network: "Sem conexão para transcrever a fala.",
    };
    if (onErro) onErro(mapa[evento.error] || "Não consegui usar o microfone agora.");
  };

  rec.onend = () => { if (onFim) onFim(); };

  return {
    iniciar: () => { try { rec.start(); } catch { /* já estava ouvindo */ } },
    parar: () => { try { rec.stop(); } catch { /* já estava parado */ } },
  };
}

// Fala um texto. Silencioso quando o aparelho não suporta.
export function falar(texto, { velocidade = 1, volume = 1 } = {}) {
  if (!audioDisponivel() || !texto) return;
  try {
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(String(texto));
    fala.lang = "pt-BR";
    fala.rate = velocidade;
    fala.volume = volume;
    window.speechSynthesis.speak(fala);
  } catch { /* áudio é acessório, nunca quebra o fluxo */ }
}

export function calarVoz() {
  if (audioDisponivel()) { try { window.speechSynthesis.cancel(); } catch {} }
}
