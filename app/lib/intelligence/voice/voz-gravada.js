// Voz GRAVADA: o aparelho grava o áudio (MediaRecorder) e o servidor
// transcreve (/api/intelligence/voz). É o caminho do iPhone, onde o
// reconhecimento de voz do navegador não funciona — principalmente com o
// Héfisto instalado na tela inicial. Mesmo contrato do provedor do navegador.

import { transcreverAudio } from "../client/api";
import { audioDisponivel, falarTexto, calarVoz } from "../../hefisto-voz";

export const MAX_SEGUNDOS = 60;

/** Formato que o aparelho grava: mp4/AAC no iPhone, webm/opus no Android e no computador. */
export function formatoDeGravacao(suportado = (t) => (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported ? MediaRecorder.isTypeSupported(t) : false)) {
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"]) if (suportado(t)) return t;
  return "";
}

export function gravacaoDisponivel() {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && !!navigator?.mediaDevices?.getUserMedia;
}

const tempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * @param {() => string|null} unidadeAtual  unidade escolhida (vai no cabeçalho, o servidor confere)
 */
export function criarVozGravada(unidadeAtual) {
  return Object.freeze({
    nome: "gravada",
    disponivel: () => gravacaoDisponivel(),
    sinteseDisponivel: () => audioDisponivel(),
    ouvir({ onParcial, onFinal, onErro, onFim } = {}) {
      let gravador = null;
      let fluxo = null;
      let pedacos = [];
      let cancelado = false;
      let timer = null;
      let segundos = 0;
      const soltar = () => { clearInterval(timer); try { fluxo?.getTracks().forEach((t) => t.stop()); } catch { /* já parou */ } };
      const terminar = () => { soltar(); onFim?.(); };

      (async () => {
        try {
          fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (e) {
          onErro?.(e?.name === "NotAllowedError" ? "Permissão do microfone negada. No iPhone: Ajustes › Safari › Microfone (ou o ícone aA na barra) e permita para o Héfisto." : "Não encontrei um microfone neste aparelho.");
          terminar();
          return;
        }
        if (cancelado) { terminar(); return; }
        const tipo = formatoDeGravacao();
        try {
          gravador = new MediaRecorder(fluxo, tipo ? { mimeType: tipo } : undefined);
        } catch {
          onErro?.("Este aparelho não consegue gravar áudio aqui. Digite a mensagem.");
          terminar();
          return;
        }
        gravador.ondataavailable = (ev) => { if (ev.data?.size) pedacos.push(ev.data); };
        gravador.onstop = async () => {
          soltar();
          if (cancelado) { onFim?.(); return; }
          const blob = new Blob(pedacos, { type: gravador.mimeType || tipo || "audio/mp4" });
          pedacos = [];
          if (segundos < 1 || blob.size < 800) { onErro?.("Áudio curto demais. Toque no microfone, fale e toque no quadrado para enviar."); onFim?.(); return; }
          onParcial?.("Transcrevendo o áudio…");
          const r = await transcreverAudio(unidadeAtual(), blob);
          if (r?.ok && r.dados?.texto) onFinal?.(r.dados.texto);
          else onErro?.(r?.dados?.erro || "Não consegui transcrever o áudio agora.");
          onFim?.();
        };
        gravador.start(1000);
        onParcial?.(`Gravando ${tempo(0)}`);
        timer = setInterval(() => {
          segundos += 1;
          onParcial?.(`Gravando ${tempo(segundos)}`);
          if (segundos >= MAX_SEGUNDOS) { try { gravador.stop(); } catch { /* já parou */ } }
        }, 1000);
      })();

      return {
        // parar = enviar (como soltar o botão no WhatsApp)
        parar: () => { if (gravador && gravador.state !== "inactive") { try { gravador.stop(); } catch { /* já parou */ } } else { cancelado = true; } },
        cancelar: () => { cancelado = true; if (gravador && gravador.state !== "inactive") { try { gravador.stop(); } catch { /* já parou */ } } },
      };
    },
    falar: (texto) => falarTexto(texto),
    calar: () => calarVoz(),
  });
}
