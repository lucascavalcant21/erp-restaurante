// COMMAND GATEWAY do WhatsApp (HDEV-WA-001).
//
//   webhook Meta (assinatura conferida) → numeroAutorizado → deduplicação →
//   limite → interpretar → destino:
//     hefisto → Intelligence Core como o usuário do dono (sessão real, RLS)
//     agente  → fila; a ponte no PC do dono executa e responde
//     local   → ajuda
//
// Número não autorizado: nenhuma resposta (não confirma que o canal existe)
// e nada é executado. Tudo chega aqui por injeção (`deps`) para teste.
import { interpretar, AJUDA } from "./comandos.mjs";
import { numeroAutorizado, mascarar } from "./numero.mjs";
import { formatarResposta, formatarBrief } from "./formatar.mjs";

export const ACAO_BLOQUEADA = Object.freeze({
  tipo: "bloqueado",
  texto: "Ações pelo WhatsApp ainda não estão liberadas: aqui não há como conferir a prévia. Faça pela Central de Inteligência: https://app.hefisto.com.br/dashboard/inteligencia",
});

/** Pelo WhatsApp a inteligência só consulta e explica: nenhuma ação é iniciada nem continuada. */
export function bloquearAcoes(servico) {
  return { ...servico, iniciar: async () => ACAO_BLOQUEADA, responder: async () => ACAO_BLOQUEADA };
}

const vistos = new Map(); // id da mensagem → quando (dedupe dentro da instância)
const JANELA_DEDUPE_MS = 24 * 60 * 60 * 1000;
const MAX_IDADE_S = 10 * 60; // mensagem com mais de 10 min (reentrega antiga): ignora

export function jaVisto(id, agora = Date.now()) {
  for (const [k, t] of vistos) if (agora - t > JANELA_DEDUPE_MS) vistos.delete(k);
  if (vistos.has(id)) return true;
  vistos.set(id, agora);
  return false;
}
export const limparDedupe = () => vistos.clear();

const MSG_AGENTE_OFFLINE = "Recebi, mas a ponte do agente no seu computador está desligada. Rode `npm run hefisto:ponte` no PC; o comando fica na fila e roda quando ela ligar.";
const MSG_FILA_INDISPONIVEL = "Comandos do agente ainda não estão disponíveis: falta aplicar a fila do WhatsApp (APR-003). Perguntas sobre a empresa já funcionam.";

/**
 * @param {object} msg  { id, de, tipo, texto, ts }
 * @param {object} deps
 * @param {(numero:string)=>boolean} [deps.autorizado]
 * @param {(para:string, texto:string)=>Promise<object>} deps.enviar
 * @param {(texto:string, msg:object)=>Promise<object>} deps.perguntar  corpo de /ask
 * @param {(msg:object)=>Promise<object>} deps.brief                     corpo de /brief
 * @param {(item:object)=>Promise<{ok?:boolean, duplicado?:boolean, indisponivel?:boolean, ponteOnline?:boolean}>} deps.enfileirar
 * @param {(chave:string)=>boolean} [deps.limite]
 * @param {(evento:object)=>void} [deps.registrar]
 * @returns {Promise<{ resultado: string, comando?: string }>}
 */
export async function atenderMensagem(msg, deps, agora = Date.now()) {
  const registrar = deps.registrar || (() => {});
  const autorizado = deps.autorizado || ((n) => numeroAutorizado(n));
  if (!autorizado(msg.de)) { registrar({ resultado: "nao_autorizado", de: mascarar(msg.de) }); return { resultado: "nao_autorizado" }; }
  if (jaVisto(msg.id, agora)) return { resultado: "duplicado" };
  if (msg.ts && agora / 1000 - msg.ts > MAX_IDADE_S) { registrar({ resultado: "antiga", id: msg.id }); return { resultado: "antiga" }; }
  if (deps.limite && !deps.limite(`wa:${msg.de}`)) {
    await deps.enviar(msg.de, "Muitas mensagens em sequência. Aguarde um minuto.");
    return { resultado: "limite" };
  }
  if (!msg.texto) {
    await deps.enviar(msg.de, "Por enquanto eu só entendo mensagens de texto.\n\n" + AJUDA);
    return { resultado: "nao_texto" };
  }

  const c = interpretar(msg.texto);
  registrar({ resultado: "comando", comando: c.comando, destino: c.destino, id: msg.id, numero: msg.de });
  let texto;
  try {
    if (c.destino === "local") {
      texto = c.args?.desconhecido ? `Não reconheci esse comando.\n\n${AJUDA}` : AJUDA;
    } else if (c.destino === "hefisto") {
      texto = c.comando === "empresa"
        ? formatarRespostaOuErro(await deps.brief(msg), (b) => formatarBrief(b.brief))
        : formatarRespostaOuErro(await deps.perguntar(c.args.pergunta, msg), formatarResposta);
    } else {
      const f = await deps.enfileirar({ mensagemId: msg.id, numero: msg.de, comando: c.comando, args: c.args || {} });
      if (f?.indisponivel) texto = MSG_FILA_INDISPONIVEL;
      else if (f?.duplicado) return { resultado: "duplicado", comando: c.comando };
      else texto = f?.ponteOnline ? null : MSG_AGENTE_OFFLINE; // online: a ponte responde
    }
  } catch (e) {
    registrar({ resultado: "erro", comando: c.comando, id: msg.id, numero: msg.de, erro: e?.name || "Erro" });
    texto = "Não consegui concluir agora. Tente de novo em instantes.";
  }
  if (texto) await deps.enviar(msg.de, texto);
  return { resultado: "respondido", comando: c.comando };
}

/** Corpo de erro do core (401/403/429/503) vira a própria mensagem; o resto, o formatador. */
function formatarRespostaOuErro(corpo, formatar) {
  if (!corpo) return "Não consegui responder agora.";
  if (corpo.erro) return corpo.erro;
  return formatar(corpo);
}
