// Impressão da via da cozinha/bar: pelo assistente QZ (impressora térmica no
// computador, sem perguntar nada) ou pela janela de impressão do navegador
// (no Chrome aberto com --kiosk-printing ela também sai sem perguntar).

import { htmlDasVias } from "./comanda-impressao.mjs";
import { imprimirHtml } from "./imprimir";
import { assistenteImpressaoAtivo, imprimirHtmlNoAssistente } from "./impressaoTermica";

export const CONFIG_PADRAO = { auto: false, modo: "navegador", impressora: "", largura: "80mm" };

export function lerConfigImpressao() {
  try {
    const salvo = JSON.parse(localStorage.getItem("kds-impressao") || "null");
    return salvo && typeof salvo === "object" ? { ...CONFIG_PADRAO, ...salvo } : { ...CONFIG_PADRAO };
  } catch {
    return { ...CONFIG_PADRAO };
  }
}

export function gravarConfigImpressao(cfg) {
  try { localStorage.setItem("kds-impressao", JSON.stringify(cfg)); } catch { /* segue */ }
}

/** Imprime as vias; devolve { erro } quando não saiu. */
export async function imprimirVias(tickets, { modo, impressora, largura, setor, unidade }) {
  const html = htmlDasVias(tickets, { setor, unidade, largura });
  if (modo === "assistente") {
    if (!impressora) return { erro: "Escolha a impressora do assistente." };
    if (!(await assistenteImpressaoAtivo())) return { erro: "Assistente de impressão desconectado." };
    try {
      await imprimirHtmlNoAssistente({ impressora, html, larguraMm: largura === "58mm" ? 58 : 80, titulo: setor === "bar" ? "Bar" : "Cozinha" });
      return { erro: null };
    } catch (e) {
      return { erro: e?.message || "A impressora não respondeu." };
    }
  }
  let falhou = null;
  const ok = imprimirHtml(html, { aoFalhar: (e) => { falhou = e; } });
  return ok && !falhou ? { erro: null } : { erro: "O navegador não abriu a impressão." };
}
