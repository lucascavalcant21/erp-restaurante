"use client";

// IMPRESSORAS DESTE APARELHO (07/11/2026)
//
// O modelo da via é da unidade (banco). A impressora é do aparelho: o tablet
// da cozinha imprime na térmica da cozinha, o computador do caixa na do caixa.
// Por isso a escolha fica guardada aqui, por setor. Antes era uma configuração
// só por aparelho: com as telas da Cozinha e do Bar abertas no mesmo
// computador, as duas imprimiam na mesma impressora.
//
// Cinco formas de ligar, para servir qualquer impressora:
//   navegador  – janela de impressão (qualquer impressora instalada)
//   assistente – assistente de impressão no computador (USB ou rede com driver)
//   rede       – direto pelo IP da térmica na rede (porta 9100), pelo assistente
//   usb        – USB direto no Chrome (computador ou Android com cabo OTG)
//   bluetooth  – Bluetooth no Chrome do Android

import { escposDasVias, htmlDasVias } from "./impressao-modelos.mjs";
import { imprimirHtml } from "./imprimir";
import { assistenteImpressaoAtivo, conectarAssistenteImpressao, imprimirBytesNoAssistente } from "./impressaoTermica";
import { enviarBytesUsb } from "./impressaoUsb";
import { enviarBytesBluetooth } from "./impressaoBluetooth";

export const SETORES_DE_IMPRESSAO = {
  cozinha: "Cozinha",
  bar: "Bar",
  caixa: "Caixa",
};

export const CONEXOES = {
  navegador: { rotulo: "Janela de impressão", ajuda: "Qualquer impressora instalada. No Chrome aberto com --kiosk-printing, sai sem perguntar." },
  assistente: { rotulo: "Assistente de impressão", ajuda: "Impressora instalada no computador (USB ou rede). Precisa do assistente QZ Tray aberto." },
  rede: { rotulo: "Rede (IP da impressora)", ajuda: "Térmica ligada na rede por cabo ou Wi-Fi, sem driver. Precisa do assistente QZ Tray aberto." },
  usb: { rotulo: "USB direto", ajuda: "Cabo USB no Chrome do computador ou do Android (OTG). Sem driver e sem assistente." },
  bluetooth: { rotulo: "Bluetooth", ajuda: "Chrome do Android. O iPhone não permite Bluetooth no navegador." },
};

export const IMPRESSORA_PADRAO = { conexao: "navegador", impressora: "", ip: "", porta: 9100, largura: "80mm" };
const CHAVE = "impressoras-aparelho";
const IP_VALIDO = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

function normalizar(cfg) {
  const c = { ...IMPRESSORA_PADRAO, ...(cfg && typeof cfg === "object" ? cfg : {}) };
  if (!CONEXOES[c.conexao]) c.conexao = "navegador";
  if (c.largura !== "58mm") c.largura = "80mm";
  c.porta = Math.min(65535, Math.max(1, Math.round(Number(c.porta)) || 9100));
  c.ip = String(c.ip || "").trim();
  c.impressora = String(c.impressora || "");
  return c;
}

/** Impressora de cada setor neste aparelho. Lê a configuração antiga do KDS uma vez. */
export function lerImpressorasDoAparelho() {
  let salvo = null;
  try { salvo = JSON.parse(localStorage.getItem(CHAVE) || "null"); } catch { /* segue */ }
  if (!salvo || typeof salvo !== "object") {
    salvo = {};
    try {
      const antigo = JSON.parse(localStorage.getItem("kds-impressao") || "null");
      if (antigo && typeof antigo === "object") {
        const migrado = { conexao: antigo.modo === "assistente" ? "assistente" : "navegador", impressora: antigo.impressora || "", largura: antigo.largura };
        salvo = { cozinha: migrado, bar: migrado };
      }
    } catch { /* segue */ }
  }
  const saida = {};
  for (const s of Object.keys(SETORES_DE_IMPRESSAO)) saida[s] = normalizar(salvo[s]);
  return saida;
}

export function gravarImpressoraDoSetor(setor, cfg) {
  const todas = lerImpressorasDoAparelho();
  todas[setor] = normalizar(cfg);
  try { localStorage.setItem(CHAVE, JSON.stringify(todas)); } catch { /* segue */ }
  return todas;
}

/** O que falta para imprimir com esta configuração; null quando está pronta. */
export function faltaParaImprimir(cfg) {
  const c = normalizar(cfg);
  if (c.conexao === "assistente" && !c.impressora) return "Escolha a impressora do assistente.";
  if (c.conexao === "rede" && !IP_VALIDO.test(c.ip)) return "Informe o IP da impressora (ex.: 192.168.0.50).";
  return null;
}

/**
 * Imprime as vias (cada uma é uma lista de linhas do modelo) na impressora do
 * setor neste aparelho. Devolve { erro } quando não saiu.
 */
export async function imprimirNoSetor(setor, vias, { copias = 1, cortar = true, titulo } = {}) {
  const cfg = lerImpressorasDoAparelho()[setor] || normalizar();
  const falta = faltaParaImprimir(cfg);
  if (falta) return { erro: falta };
  const repetidas = [];
  for (const v of vias || []) for (let i = 0; i < Math.min(3, Math.max(1, copias)); i += 1) repetidas.push(v);
  if (!repetidas.length) return { erro: null };
  const nome = titulo || SETORES_DE_IMPRESSAO[setor] || "Via";
  try {
    if (cfg.conexao === "navegador") {
      let falhou = null;
      const ok = imprimirHtml(htmlDasVias(repetidas, { largura: cfg.largura, titulo: nome }), { aoFalhar: (e) => { falhou = e; } });
      return ok && !falhou ? { erro: null } : { erro: "O navegador não abriu a impressão." };
    }
    if (cfg.conexao === "assistente" || cfg.conexao === "rede") {
      if (!(await assistenteImpressaoAtivo())) await conectarAssistenteImpressao(cfg.impressora).catch(() => null);
      if (!(await assistenteImpressaoAtivo())) return { erro: "Assistente de impressão desconectado. Abra o QZ Tray neste computador." };
      const bytes = escposDasVias(repetidas, { largura: cfg.largura, cortar });
      if (cfg.conexao === "rede") await imprimirBytesNoAssistente({ host: cfg.ip, porta: cfg.porta, bytes, titulo: nome });
      else await imprimirBytesNoAssistente({ impressora: cfg.impressora, bytes, titulo: nome });
      return { erro: null };
    }
    const bytes = escposDasVias(repetidas, { largura: cfg.largura, cortar });
    if (cfg.conexao === "usb") await enviarBytesUsb(bytes);
    else await enviarBytesBluetooth(bytes);
    return { erro: null };
  } catch (e) {
    return { erro: e?.message || "A impressora não respondeu." };
  }
}
