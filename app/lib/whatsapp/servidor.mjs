// Liga o Command Gateway ao mundo real (server-only): Meta, Intelligence Core
// (mesma casca atenderInteligencia das rotas /api/intelligence) e a fila.
import { atenderInteligencia } from "../intelligence/server/http.mjs";
import { handlerAsk, handlerBrief } from "../intelligence/server/handlers.mjs";
import { dentroDoLimite } from "../server/limite-por-ip.mjs";
import { getSupabaseServerClient } from "../server/supabase-server.mjs";
import { enviar as enviarPeloProvedor } from "./envio.mjs";
import { tokenDoDono, esquecerSessaoDoDono } from "./sessao-dono.mjs";
import { criarFila } from "./fila.mjs";
import { mascarar } from "./numero.mjs";
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

export function depsDoServidor(env = process.env) {
  const fila = filaDoServidor();
  return {
    enviar: async (para, texto) => {
      const r = await enviarPeloProvedor({ para, texto, env });
      if (!r.ok) console.error("[whatsapp] envio falhou", mascarar(para), r.status || "", r.erro || "");
      else console.log("[whatsapp] envio", JSON.stringify({ para: mascarar(para), ids: r.ids || [] }));
      return r;
    },
    perguntar: (pergunta, msg) => chamarCore({
      caminho: "ask", metodo: "POST", env, limitePorMinuto: 30,
      corpo: { texto: pergunta, chave: `wa-${String(msg.id).replace(/[^A-Za-z0-9_\-:.]/g, "").slice(-60)}`, canal: "texto" },
      handler: handlerAsk({ envolverAcoes: bloquearAcoes }),
    }),
    brief: () => chamarCore({ caminho: "brief", metodo: "GET", env, limitePorMinuto: 12, handler: handlerBrief() }),
    enfileirar: (item) => fila.enfileirar(item),
    limite: (chave) => dentroDoLimite(chave, { maximo: 20, janelaMs: 60_000 }),
    registrar: (e) => console.log("[whatsapp]", JSON.stringify(e)),
  };
}
