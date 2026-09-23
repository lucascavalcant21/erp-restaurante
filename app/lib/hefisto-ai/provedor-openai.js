// ═══════════════════════════════════════════════════════════════
// provedor-openai.js — a única parte que fala com a OpenAI
//
// Responses API (POST /v1/responses). Só servidor: a chave nunca sai daqui, e
// este módulo estoura se for avaliado no navegador. Não existe, e não pode
// existir, NEXT_PUBLIC_OPENAI_API_KEY.
//
// O agente não conhece o formato da OpenAI: este arquivo traduz para
// { texto, chamadas: [{ id, nome, argumentos }] }.
// ═══════════════════════════════════════════════════════════════

if (typeof window !== "undefined") {
  throw new Error("[hefisto-ai] O provedor da IA é do servidor e foi importado no navegador.");
}

const ENDPOINT = "https://api.openai.com/v1/responses";
/* Modelo configurável por ambiente. O padrão existe só para não travar quem
   ainda não configurou; declare OPENAI_MODEL no ambiente de verdade. */
export const MODELO_PADRAO = "gpt-4.1-mini";

export function configuracaoOpenAI(env = process.env) {
  const chave = String(env.OPENAI_API_KEY || "").trim();
  if (!chave) {
    return { ok: false, erro: "OPENAI_API_KEY não configurada no servidor." };
  }
  return {
    ok: true,
    chave,
    modelo: String(env.OPENAI_MODEL || "").trim() || MODELO_PADRAO,
    timeoutMs: Number(env.OPENAI_TIMEOUT_MS) > 0 ? Number(env.OPENAI_TIMEOUT_MS) : 30000,
  };
}

/* Converte o histórico interno do agente para o formato da Responses API. */
function paraEntradaDaApi(entrada = []) {
  return entrada.map((item) => {
    if (item.role === "tool") {
      return { type: "function_call_output", call_id: item.chamadaId, output: String(item.conteudo ?? "") };
    }
    return { role: item.role || "user", content: String(item.content ?? "") };
  });
}

function daRespostaDaApi(json) {
  const saida = Array.isArray(json?.output) ? json.output : [];
  const chamadas = saida
    .filter((item) => item?.type === "function_call")
    .map((item) => {
      let argumentos = {};
      try { argumentos = item.arguments ? JSON.parse(item.arguments) : {}; } catch { argumentos = {}; }
      return { id: item.call_id || item.id, nome: item.name, argumentos };
    });
  const texto = String(
    json?.output_text ||
    saida
      .filter((item) => item?.type === "message")
      .flatMap((item) => (Array.isArray(item.content) ? item.content : []))
      .filter((c) => c?.type === "output_text")
      .map((c) => c.text)
      .join("\n")
  ).trim();
  return { texto, chamadas };
}

/** Provedor pronto para o agente. Devolve null quando não há configuração. */
export function criarProvedorOpenAI(env = process.env, buscar = fetch) {
  const config = configuracaoOpenAI(env);
  if (!config.ok) return null;

  return {
    modelo: config.modelo,
    async responder({ instrucoes, entrada, ferramentas }) {
      const controle = new AbortController();
      const relogio = setTimeout(() => controle.abort(), config.timeoutMs);
      try {
        const resposta = await buscar(ENDPOINT, {
          method: "POST",
          signal: controle.signal,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.chave}`,
          },
          body: JSON.stringify({
            model: config.modelo,
            instructions: instrucoes,
            input: paraEntradaDaApi(entrada),
            tools: ferramentas,
            tool_choice: "auto",
            max_output_tokens: 700,
            store: false,
          }),
        });
        if (!resposta.ok) {
          const corpo = await resposta.text().catch(() => "");
          /* Nunca ecoar a chave; o corpo da OpenAI não a contém, mas cortamos
             o texto para não vazar nada grande em log. */
          throw new Error(`OpenAI respondeu ${resposta.status}: ${corpo.slice(0, 200)}`);
        }
        return daRespostaDaApi(await resposta.json());
      } finally {
        clearTimeout(relogio);
      }
    },
  };
}
