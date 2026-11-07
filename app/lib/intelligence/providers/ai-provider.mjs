// AIProvider — a ÚNICA porta do Intelligence Core para modelos de IA.
//
// Contrato (qualquer fornecedor: Anthropic hoje; OpenAI ou outro amanhã):
//   nome: string
//   disponivel(): boolean
//   interpretar({ sistema, texto, esquemaJson }) →
//     { ok: true, dados: object, uso: { entrada, saida }, modelo, fallback: string|null, latenciaMs }
//   | { ok: false, motivo: string, latenciaMs }
//
// O modelo NÃO acessa banco e NÃO executa nada. Dois usos:
//   • interpretar: classifica o pedido em uma intenção do catálogo, sem dado do
//     ERP (interpretacaoSchema valida a saída);
//   • responder (agente geral, agents/geral.mjs, decisão do dono 07/11/2026):
//     escreve a resposta com dados JÁ lidos pelo servidor, desta unidade e com a
//     permissão de quem pergunta; respostaLivreSchema valida a saída e a trava
//     de números corta valor que não está nos dados.

export const provedorNulo = Object.freeze({
  nome: "nenhum",
  disponivel: () => false,
  async interpretar() { return { ok: false, motivo: "Nenhum provedor de IA configurado.", latenciaMs: 0 }; },
});

let fabrica = null;

/** Registra a fábrica do provedor (feito pelo módulo de servidor). */
export function registrarFabricaDeProvedor(fn) { fabrica = fn; }

/** Provedor configurado no ambiente, ou o nulo. Nunca lança. */
export async function provedorConfigurado() {
  try {
    if (fabrica) return (await fabrica()) || provedorNulo;
  } catch {
    // fornecedor indisponível não derruba o Héfisto: cai para as regras
  }
  return provedorNulo;
}
