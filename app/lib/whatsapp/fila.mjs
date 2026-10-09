// Fila de comandos do agente (db/whatsapp/WA_001_FILA.sql), server-only, service role.
// Sem a migração aplicada, tudo responde { indisponivel: true }: o canal segue
// funcionando para as perguntas sobre a empresa.

const PONTE_ONLINE_MS = 2 * 60_000;
const ausente = (e) => /PGRST20[25]|42P01|42883|does not exist|could not find/i.test(`${e?.code || ""} ${e?.message || ""}`);

/** @param {() => object} banco  cliente supabase-js com a service role */
export function criarFila(banco) {
  return {
    async enfileirar({ mensagemId, numero, comando, args }, agora = Date.now()) {
      const { error } = await banco().from("whatsapp_comandos").insert({ mensagem_id: mensagemId, numero, comando, args });
      if (error) {
        if (ausente(error)) return { indisponivel: true };
        if (error.code === "23505") return { duplicado: true };
        throw new Error("fila: falha ao gravar");
      }
      const { data } = await banco().from("whatsapp_ponte").select("visto_em").eq("id", 1).maybeSingle();
      const visto = data?.visto_em ? Date.parse(data.visto_em) : 0;
      return { ok: true, ponteOnline: agora - visto < PONTE_ONLINE_MS };
    },

    /** A ponte chegou: marca presença e pega até `limite` comandos. */
    async pegar(limite = 5) {
      const b = banco();
      const { error: ep } = await b.from("whatsapp_ponte").upsert({ id: 1, visto_em: new Date().toISOString() });
      if (ep) { if (ausente(ep)) return { indisponivel: true, itens: [] }; throw new Error("fila: falha ao marcar a ponte"); }
      const { data, error } = await b.rpc("whatsapp_pegar_comandos", { p_limite: limite });
      if (error) { if (ausente(error)) return { indisponivel: true, itens: [] }; throw new Error("fila: falha ao pegar comandos"); }
      return { itens: (data || []).map((c) => ({ id: c.id, comando: c.comando, args: c.args || {} })) };
    },

    /** Grava o resultado; devolve o número para quem responder (nunca vem da ponte). */
    async concluir(id, { ok, resposta }) {
      const { data, error } = await banco().from("whatsapp_comandos")
        .update({ status: ok ? "CONCLUIDO" : "FALHOU", resposta: String(resposta || "").slice(0, 8000), concluido_em: new Date().toISOString() })
        .eq("id", id).eq("status", "EM_EXECUCAO").select("numero").maybeSingle();
      if (error) throw new Error("fila: falha ao concluir");
      return data?.numero || null;
    },
  };
}
