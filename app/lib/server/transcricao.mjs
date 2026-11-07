// TRANSCRIÇÃO DE ÁUDIO NO SERVIDOR (fala → texto) para o Assistente Héfisto.
//
// Por quê: no iPhone (principalmente com o Héfisto instalado na tela inicial)
// o reconhecimento de voz do navegador não funciona ("Não consegui usar o
// microfone agora"). O aparelho então GRAVA o áudio e o servidor transcreve
// com a mesma chave que já lê as notas fiscais (OPENAI_API_KEY, /api/ocr).
//
// O texto volta para o celular e segue o caminho de sempre (/api/intelligence/ask,
// canal "voz"): a transcrição não decide nada, não grava nada e não vê dados.
// O áudio não é guardado.

export const MAX_BYTES_AUDIO = 5 * 1024 * 1024; // ~5 min de áudio comprimido; o app corta em 60 s
export const MODELO_PADRAO = "gpt-4o-mini-transcribe";
export const MODELO_RESERVA = "whisper-1";

const TIPOS = new Map([
  ["audio/mp4", "m4a"], ["audio/x-m4a", "m4a"], ["audio/m4a", "m4a"], ["audio/aac", "m4a"],
  ["audio/webm", "webm"], ["audio/ogg", "ogg"], ["audio/mpeg", "mp3"], ["audio/wav", "wav"], ["audio/x-wav", "wav"],
  ["video/mp4", "mp4"], ["video/webm", "webm"],
]);

/** Vocabulário da casa: ajuda a transcrição a acertar nomes do restaurante. */
export const DICA_VOCABULARIO = "Restaurante. Estoque, ficha técnica, picanha, xarope de guaraná, quilo, kg, gramas, litros, ml, CMV, CMO, nota fiscal, DANFE, fornecedor, Cozinha, Bar, Salão, Héfisto.";

/** Tipo e extensão aceitos (ignora parâmetros como ";codecs=opus"). */
export function tipoDoAudio(mime) {
  const base = String(mime || "").split(";")[0].trim().toLowerCase();
  return TIPOS.has(base) ? { mime: base, ext: TIPOS.get(base) } : null;
}

/**
 * Valida o arquivo recebido. Retorna { ok:true } ou { ok:false, status, erro }.
 * @param {{ size:number, type:string }|null} arquivo
 */
export function validarAudio(arquivo) {
  if (!arquivo || typeof arquivo.size !== "number") return { ok: false, status: 400, erro: "Áudio não recebido." };
  if (arquivo.size < 800) return { ok: false, status: 400, erro: "Áudio curto demais. Segure um pouco mais e fale de novo." };
  if (arquivo.size > MAX_BYTES_AUDIO) return { ok: false, status: 413, erro: "Áudio grande demais. Fale em mensagens de até 1 minuto." };
  if (!tipoDoAudio(arquivo.type)) return { ok: false, status: 415, erro: "Formato de áudio não suportado." };
  return { ok: true };
}

/** Limpa o texto devolvido (espaços, aspas soltas, tamanho do pedido). */
export function limparTranscricao(t) {
  return String(t || "").replace(/\s+/g, " ").replace(/^["'“”\s]+|["'“”\s]+$/g, "").trim().slice(0, 500);
}

/**
 * Transcreve com a OpenAI. `fetchImpl` permite testar sem rede.
 * @returns {Promise<{ ok:true, texto:string, modelo:string } | { ok:false, status:number, erro:string }>}
 */
export async function transcrever({ arquivo, chave, modelo = MODELO_PADRAO, fetchImpl = fetch }) {
  const v = validarAudio(arquivo);
  if (!v.ok) return v;
  if (!chave) return { ok: false, status: 503, erro: "Transcrição de voz não configurada no servidor (OPENAI_API_KEY)." };
  const tipo = tipoDoAudio(arquivo.type);
  const tentar = async (m) => {
    const corpo = new FormData();
    corpo.append("file", arquivo, `voz.${tipo.ext}`);
    corpo.append("model", m);
    corpo.append("language", "pt");
    corpo.append("prompt", DICA_VOCABULARIO);
    corpo.append("response_format", "json");
    const r = await fetchImpl("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: corpo });
    let dados = null;
    try { dados = await r.json(); } catch { /* corpo não-JSON */ }
    return { r, dados };
  };
  let { r, dados } = await tentar(modelo);
  // modelo indisponível na conta: tenta o clássico uma vez
  if (!r.ok && modelo !== MODELO_RESERVA && (r.status === 404 || /model/i.test(dados?.error?.message || ""))) {
    modelo = MODELO_RESERVA;
    ({ r, dados } = await tentar(modelo));
  }
  if (!r.ok) {
    return { ok: false, status: r.status === 429 ? 429 : 502, erro: r.status === 429 ? "Muitas transcrições agora. Tente de novo em instantes." : "Não consegui transcrever o áudio agora." };
  }
  const texto = limparTranscricao(dados?.text);
  if (!texto) return { ok: false, status: 422, erro: "Não entendi o áudio. Fale mais perto do microfone." };
  return { ok: true, texto, modelo };
}
