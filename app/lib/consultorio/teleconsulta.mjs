// TELECONSULTA (dono, 21/11/2026): vídeo pelo Whereby, sem gravar o vídeo.
// No registro do paciente ficam: o aceite do termo (texto e versão aceitos),
// o horário de início e fim e a ficha da consulta (CFM 2.314/2022).
// O termo abaixo é um MODELO para o médico revisar; não é parecer jurídico.

export const TERMO_PADRAO = [
  "TERMO DE CONSENTIMENTO PARA TELECONSULTA",
  "Autorizo a realização da minha consulta médica por telemedicina (vídeo), com o médico responsável por este atendimento, e a transmissão das minhas imagens e dados de saúde por meio da plataforma de vídeo usada pelo consultório.",
  "Entendo que a teleconsulta não substitui o atendimento presencial: como não há exame físico completo, o médico pode me orientar a ir ao consultório ou a um serviço de saúde, e posso a qualquer momento pedir o atendimento presencial.",
  "Fui informado(a) de que o vídeo não é gravado. O atendimento é registrado no meu prontuário, com data, horário e as informações da consulta, protegido pelo sigilo médico e pela Lei Geral de Proteção de Dados.",
  "Declaro que estou em local reservado e que as informações que eu passar são verdadeiras.",
].join("\n\n");

/** Termo em uso: o do consultório (editado pelo médico) ou o modelo. */
export function termoEmUso(config = {}) {
  const t = config?.termo_telemedicina;
  const texto = String(t?.texto || "").trim() || TERMO_PADRAO;
  const versao = String(t?.versao || "").trim() || "modelo-1";
  return { texto, versao };
}

/** Código secreto do convite (40 caracteres, só letras e números). */
export function gerarCodigo(aleatorio) {
  const bytes = aleatorio || (() => { const b = new Uint8Array(30); globalThis.crypto.getRandomValues(b); return b; })();
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; s.length < 40; i++) s += alfabeto[bytes[i % bytes.length] % alfabeto.length] + (i < bytes.length ? "" : "");
  return s.slice(0, 40);
}

export const linkDoPaciente = (origem, codigo) => `${String(origem || "").replace(/\/$/, "")}/teleconsulta/${codigo}`;

export function conviteWhatsApp({ paciente, inicio, link, consultorio = "consultório" }) {
  const d = new Date(inicio);
  const data = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const nome = String(paciente?.nome || "").trim().split(/\s+/)[0] || "";
  return `Olá${nome ? `, ${nome}` : ""}! Sua teleconsulta no ${consultorio} é ${data}, às ${hora}. Na hora, abra este link pelo celular ou computador (com câmera e microfone), leia o termo e entre na sala: ${link}`;
}

/** Endereço da sala para embutir na tela (Whereby aceita parâmetros na URL). */
export function salaEmbutida(url, { nome = "", minimal = true } = {}) {
  if (!/^https:\/\//.test(String(url || ""))) return null;
  try {
    const u = new URL(url);
    if (/whereby\.com$/i.test(u.hostname)) {
      if (nome) u.searchParams.set("displayName", nome);
      if (minimal) u.searchParams.set("minimal", "");
      u.searchParams.set("lang", "pt");
    }
    return u.toString();
  } catch { return null; }
}

/** Duração em minutos entre início e fim do atendimento. */
export function duracaoMin(inicio, fim) {
  const a = new Date(inicio).getTime(), b = new Date(fim).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? Math.round((b - a) / 60000) : null;
}
