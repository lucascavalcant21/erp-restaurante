// PEDIDO EM LOTE — "Adicione 3 kg de picanha, 4 kg de xarope de guaraná."
//
// Uma frase com vários itens vira um pedido por item, cada um com a SUA ação
// (produto, local, prévia e confirmação próprios). Nada é somado ou juntado:
// é exatamente o que aconteceria se a pessoa mandasse uma mensagem por item.
//
// Só vale para entrada e perda, e só quando TODOS os pedaços têm quantidade e
// produto e caem na mesma intenção. Em dúvida, não divide (segue o caminho de
// um item só, que pergunta o que falta).

import { interpretarPorRegras, normalizarTexto } from "./interpretador-regras.mjs";

const INTENCOES_EM_LOTE = new Set(["estoque.registrar_entrada", "estoque.registrar_perda"]);
const COMECA_COM_QUANTIDADE = /^(\d+(\.\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|meio|meia)\b/;
export const MAX_ITENS_LOTE = 12;

/**
 * @param {string} texto
 * @returns {{ intencao: string, itens: { texto: string, interpretacao: object }[] } | null}
 */
export function dividirEmItens(texto) {
  const original = String(texto || "").trim();
  if (!original) return null;
  // separadores: vírgula, ponto e vírgula, quebra de linha e "e" antes de número
  const t = original
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/(\d),(\d)/g, "$1\u0000$2") // "2,5 kg" não separa
    .replace(/\s+(e|mais)\s+(?=\d|um\b|uma\b|dois\b|duas\b|tres\b|quatro\b|cinco\b|seis\b|sete\b|oito\b|nove\b|dez\b|meio\b|meia\b)/gi, ";");
  const pedacos = t.split(/[;,\n]+/).map((p) => p.replace(/\u0000/g, ",").trim()).filter(Boolean);
  if (pedacos.length < 2) return null;

  // o verbo do pedido mora no primeiro pedaço, antes da primeira quantidade
  const primeiro = normalizarTexto(pedacos[0]);
  const m = primeiro.match(/^(.*?)\b(\d+(\.\d+)?|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|meio|meia)\b/);
  const prefixo = m ? m[1].trim() : "";
  if (!prefixo) return null;

  const itens = [];
  for (let i = 0; i < pedacos.length; i++) {
    const p = normalizarTexto(pedacos[i]);
    if (!p) continue;
    const frase = i === 0 ? p : COMECA_COM_QUANTIDADE.test(p) ? `${prefixo} ${p}` : null;
    if (!frase) return null;
    const r = interpretarPorRegras(frase);
    if (!r.ok) return null;
    itens.push({ texto: i === 0 ? pedacos[0] : `${prefixo} ${pedacos[i]}`, interpretacao: r.valor });
  }
  if (itens.length < 2 || itens.length > MAX_ITENS_LOTE) return null;
  const intencao = itens[0].interpretacao.intencao;
  if (!INTENCOES_EM_LOTE.has(intencao)) return null;
  if (!itens.every((x) => x.interpretacao.intencao === intencao && x.interpretacao.produto && x.interpretacao.quantidade)) return null;
  return { intencao, itens };
}
