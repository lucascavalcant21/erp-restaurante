// Provedor Anthropic (Claude) do AIProvider — server-only, SDK oficial.
//
// Saída estruturada (output_config.format json_schema) com o esquema do
// catálogo: o modelo só consegue devolver uma interpretação no formato
// esperado, e o servidor ainda valida de novo. Esforço baixo (classificação),
// fallback de recusa do lado do servidor ("default").
//
// Configuração por ambiente: ANTHROPIC_API_KEY (obrigatória para ligar),
// HEFISTO_IA_MODELO (padrão claude-opus-5-5), HEFISTO_IA_DESLIGADA=1 desliga.

import Anthropic from "@anthropic-ai/sdk";

if (typeof window !== "undefined") throw new Error("SERVER_ONLY_MODULE: providers/anthropic.mjs");

export const MODELO_PADRAO = "claude-opus-5-5";

export function criarProvedorAnthropic({ apiKey = process.env.ANTHROPIC_API_KEY, modelo = process.env.HEFISTO_IA_MODELO || MODELO_PADRAO, cliente = null } = {}) {
  if (process.env.HEFISTO_IA_DESLIGADA === "1") return null;
  if (!apiKey && !cliente) return null;
  const client = cliente || new Anthropic({ apiKey, timeout: 20_000, maxRetries: 1 });

  return Object.freeze({
    nome: "anthropic",
    modelo,
    disponivel: () => true,
    async interpretar({ sistema, texto, esquemaJson }) {
      const inicio = Date.now();
      try {
        const r = await client.beta.messages.create({
          model: modelo,
          max_tokens: 1024,
          system: sistema,
          messages: [{ role: "user", content: texto }],
          output_config: { effort: "low", format: { type: "json_schema", schema: esquemaJson } },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
        const latenciaMs = Date.now() - inicio;
        const fallbackUsado = (r.usage?.iterations || []).some((i) => i.type === "fallback_message") ? r.model : null;
        if (r.stop_reason === "refusal") return { ok: false, motivo: "O modelo recusou interpretar o pedido.", latenciaMs };
        if (r.stop_reason === "max_tokens") return { ok: false, motivo: "Resposta do modelo incompleta.", latenciaMs };
        const textoSaida = (r.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
        let dados;
        try { dados = JSON.parse(textoSaida); } catch { return { ok: false, motivo: "Saída do modelo não é JSON válido.", latenciaMs }; }
        return {
          ok: true, dados, modelo: r.model, fallback: fallbackUsado, latenciaMs,
          uso: { entrada: r.usage?.input_tokens ?? null, saida: r.usage?.output_tokens ?? null },
        };
      } catch (e) {
        const latenciaMs = Date.now() - inicio;
        let motivo = "Falha ao falar com o provedor de IA.";
        if (e instanceof Anthropic.RateLimitError) motivo = "Limite de uso do provedor de IA atingido.";
        else if (e instanceof Anthropic.AuthenticationError) motivo = "Credencial do provedor de IA inválida.";
        else if (e instanceof Anthropic.BadRequestError) motivo = "Pedido recusado pelo provedor de IA.";
        else if (e instanceof Anthropic.APIConnectionError) motivo = "Sem conexão com o provedor de IA.";
        else if (e instanceof Anthropic.APIError) motivo = `Erro do provedor de IA (${e.status}).`;
        return { ok: false, motivo, latenciaMs };
      }
    },
  });
}
