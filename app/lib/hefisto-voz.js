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
// continuo: a pessoa fala uma lista longa ("5 de alho, 3 de tomate e 10 de
// cebola") com pausas no meio. Sem isso o navegador encerra no primeiro
// silêncio e corta a frase. silencioMs = quanto tempo de silêncio encerra.
export function criarEscuta({ onParcial, onFinal, onErro, onFim, continuo = false, silencioMs = 3500 } = {}) {
  const API = Reconhecimento();
  if (!API) return null;

  const rec = new API();
  rec.lang = "pt-BR";
  rec.continuous = !!continuo;
  rec.interimResults = true;     // mostra o texto enquanto fala
  rec.maxAlternatives = 1;

  let finalizado = "";
  let encerrando = false;        // parada pedida (pelo usuário ou pelo silêncio)
  let timerSilencio = null;

  const entregar = () => {
    clearTimeout(timerSilencio);
    const frase = finalizado.trim();
    finalizado = "";
    if (frase && onFinal) onFinal(frase);
  };

  rec.onresult = (evento) => {
    let parcial = "";
    for (let i = evento.resultIndex; i < evento.results.length; i++) {
      const trecho = evento.results[i][0].transcript;
      if (evento.results[i].isFinal) finalizado += `${trecho} `;
      else parcial += trecho;
    }
    if (onParcial) onParcial(`${finalizado}${parcial}`.trim());

    if (continuo) {
      // Cada trecho reinicia a contagem: só encerra depois do silêncio cheio.
      clearTimeout(timerSilencio);
      timerSilencio = setTimeout(() => { encerrando = true; try { rec.stop(); } catch { /* já parou */ } }, silencioMs);
      return;
    }
    if (finalizado) entregar();
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

  rec.onend = () => {
    // O Chrome encerra sozinho depois de alguns segundos mesmo em modo
    // contínuo. Enquanto a pessoa não mandou parar, religa e segue ouvindo.
    if (continuo && !encerrando) {
      try { rec.start(); return; } catch { /* não deu para religar: encerra */ }
    }
    entregar();
    if (onFim) onFim();
  };

  return {
    iniciar: () => { encerrando = false; try { rec.start(); } catch { /* já estava ouvindo */ } },
    parar: () => { encerrando = true; clearTimeout(timerSilencio); try { rec.stop(); } catch { /* já estava parado */ } },
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
