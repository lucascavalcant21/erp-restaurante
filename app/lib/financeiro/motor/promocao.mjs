// Simulador de promoção (item 11 do documento do dono): quem paga o desconto,
// margem antes e depois, e quanto vender a mais para empatar.

import { centavos, multiplicar } from "./dinheiro.mjs";
import { resultadoDoItem } from "./resultado.mjs";

/**
 * desconto: { tipo: "percentual" | "fixo", valor, lojaPct = 100 } — lojaPct é
 * a parte do desconto paga pela loja (o resto é do app).
 */
export function simularPromocao({ precoListaC, custoC, regras = [], desconto, volumeBase = null, itensPorPedido = 1 }) {
  if (!(precoListaC > 0) || !(custoC > 0) || !desconto) return { status: "DADOS INSUFICIENTES", falta: ["preço, custo e desconto"] };
  const valorC = desconto.tipo === "fixo" ? centavos(desconto.valor) : multiplicar(precoListaC, Number(desconto.valor) / 100);
  if (valorC === null) return { status: "DADOS INSUFICIENTES", falta: ["valor do desconto"] };
  const loja = Math.min(100, Math.max(0, Number(desconto.lojaPct ?? 100))) / 100;
  const lojaC = Math.round(valorC * loja); const appC = valorC - lojaC;
  const antes = resultadoDoItem({ precoListaC, custoC, regras, itensPorPedido });
  const depois = resultadoDoItem({
    precoListaC, custoC, regras, itensPorPedido,
    descontoLojaPct: (lojaC / precoListaC) * 100, descontoAppPct: (appC / precoListaC) * 100,
  });
  const avisos = [];
  let volumeNecessario = null;
  if (depois.margemC <= 0) avisos.push("Contribuição negativa: cada venda na promoção dá prejuízo. Só com aprovação do gestor.");
  else if (Number(volumeBase) > 0 && antes.margemC > 0) volumeNecessario = Math.ceil((antes.margemC * Number(volumeBase)) / depois.margemC);
  return {
    status: "OK", descontoC: valorC, pagoPelaLojaC: lojaC, pagoPeloAppC: appC,
    antes, depois, volumeNecessario,
    volumeAdicional: volumeNecessario === null ? null : volumeNecessario - Number(volumeBase),
    avisos, natureza: "SIMULAÇÃO",
  };
}
