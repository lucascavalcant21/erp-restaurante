// Liga o Command Gateway ao mundo real (server-only): Meta/YCloud, Intelligence
// Core (mesma casca atenderInteligencia das rotas /api/intelligence), a fila e a
// trilha de auditoria do canal.
import { atenderInteligencia } from "../intelligence/server/http.mjs";
import { handlerAsk, handlerBrief } from "../intelligence/server/handlers.mjs";
import { dentroDoLimite } from "../server/limite-por-ip.mjs";
import { getSupabaseServerClient } from "../server/supabase-server.mjs";
import { enviar as enviarPeloProvedor, provedor } from "./envio.mjs";
import { tokenDoDono, esquecerSessaoDoDono } from "./sessao-dono.mjs";
import { criarFila } from "./fila.mjs";
import { criarAuditoriaWa } from "./auditoria.mjs";
import { bloquearAcoes } from "./gateway.mjs";

const URL_INTERNA = "https://interno.hefisto/api/intelligence";

async function chamarCore({ caminho, metodo, corpo, handler, limitePorMinuto, env }) {
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const token = await tokenDoDono({ env });
    const headers = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    if (env.WHATSAPP_DONO_UNIDADE) headers["x-hefisto-unidade"] = env.WHATSAPP_DONO_UNIDADE;
    const req = new Request(`${URL_INTERNA}/${caminho}`, { method: metodo, headers, body: metodo === "GET" ? undefined : JSON.stringify(corpo) });
    const res = await atenderInteligencia(req, handler, { limitePorMinuto, canal: "whatsapp" });
    const json = await res.json().catch(() => null);
    if (res.status === 401 && tentativa === 0) { esquecerSessaoDoDono(); continue; } // token revogado: abre outra sessão
    return json;
  }
  return null;
}

export const filaDoServidor = () => criarFila(() => getSupabaseServerClient());

let auditoria = null;
/** Trilha do canal (uma por instância). Sem service role: só log. */
export function auditoriaDoServidor(env = process.env) {
  if (!auditoria) auditoria = criarAuditoriaWa(env.SUPABASE_SERVICE_ROLE_KEY ? () => getSupabaseServerClient() : null);
  return auditoria;
}

/** Envia pelo provedor configurado e audita cada parte (message_id ou erro). */
export async function enviarAuditado({ para, texto, comandoId = null, env = process.env }) {
  const r = await enviarPeloProvedor({ para, texto, env });
  const registrar = auditoriaDoServidor(env);
  const base = { provedor: provedor(env), direcao: "saida", numero: para, comandoId };
  if (r.ok && r.ids?.length) for (const wamid of r.ids) await registrar({ ...base, wamid, resultado: "aceito" });
  else await registrar({ ...base, resultado: r.ok ? "aceito_sem_id" : "erro", erro: r.ok ? null : `${r.status || ""} ${r.erro || ""}`.trim() });
  return r;
}

export function depsDoServidor(env = process.env) {
  const fila = filaDoServidor();
  const registrar = auditoriaDoServidor(env);
  return {
    enviar: (para, texto) => enviarAuditado({ para, texto, env }),
    perguntar: (pergunta, msg) => chamarCore({
      caminho: "ask", metodo: "POST", env, limitePorMinuto: 30,
      corpo: { texto: pergunta, chave: `wa-${String(msg.id).replace(/[^A-Za-z0-9_\-:.]/g, "").slice(-60)}`, canal: "texto" },
      handler: handlerAsk({ envolverAcoes: bloquearAcoes }),
    }),
    brief: () => chamarCore({ caminho: "brief", metodo: "GET", env, limitePorMinuto: 12, handler: handlerBrief() }),
    enfileirar: (item) => fila.enfileirar(item),
    limite: (chave) => dentroDoLimite(chave, { maximo: 20, janelaMs: 60_000 }),
    // eventos do gateway: entrada reconhecida, não autorizada, duplicada, antiga, erro
    registrar: (e) => registrar({
      provedor: provedor(env), direcao: "entrada", wamid: e.id || null, numero: e.numero || null,
      comando: e.comando || null, resultado: e.resultado || null, erro: e.erro || null,
    }),
  };
}
