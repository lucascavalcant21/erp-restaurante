// INTERPRETAÇÃO HÍBRIDA: regras primeiro (determinístico, sem custo, sem
// rede); IA só quando as regras não têm certeza. As duas saídas passam pelo
// MESMO esquema. IA fora do ar, recusando ou devolvendo algo inválido → fica
// a interpretação das regras (ou "desconhecido"), nunca um chute.

import { interpretacaoSchema } from "./catalogo.mjs";
import { interpretarPorRegras } from "./interpretador-regras.mjs";
import { promptDoInterpretador, mensagemDoUsuario } from "../prompts/interpretador.mjs";

const DESCONHECIDO = Object.freeze({ intencao: "desconhecido", periodo: null, dias: null, produto: null, quantidade: null, unidade: null, motivo: null, destino: null, confianca: "baixa" });

/**
 * @returns {Promise<{ interpretacao: object, origem: "regras"|"ia", ia: object|null }>}
 */
export async function interpretar({ texto, modulo = null, provedor = null }) {
  const r = interpretarPorRegras(texto);
  const regras = r.ok ? r.valor : DESCONHECIDO;
  if (regras.intencao !== "desconhecido" && regras.confianca === "alta") return { interpretacao: regras, origem: "regras", ia: null };
  if (!provedor?.disponivel?.()) return { interpretacao: regras, origem: "regras", ia: null };

  const resp = await provedor.interpretar({
    sistema: promptDoInterpretador(),
    texto: mensagemDoUsuario(texto, { modulo }),
    esquemaJson: interpretacaoSchema.json(),
  });
  const meta = { provedor: provedor.nome, modelo: resp.modelo || provedor.modelo || null, uso: resp.uso || null, latenciaMs: resp.latenciaMs ?? null, fallback: resp.fallback || null };
  if (!resp.ok) return { interpretacao: regras, origem: "regras", ia: { ...meta, erro: resp.motivo } };
  const v = interpretacaoSchema.parse(resp.dados);
  if (!v.ok) return { interpretacao: regras, origem: "regras", ia: { ...meta, erro: "saída da IA fora do esquema" } };
  return { interpretacao: v.valor, origem: "ia", ia: meta };
}
