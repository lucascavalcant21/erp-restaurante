// Saída das etiquetas do recebimento. Usa as mesmas impressoras da tela de
// Etiquetas: MDK-022 por USB, térmica por Bluetooth ou a impressão do aparelho.

import { criarEtiqueta, gerarCodigo } from "../etiquetas";
import { imprimirHtml } from "../imprimir";
import { WebUsbDisponivel, imprimirEtiquetaMdk022Usb } from "../impressaoMdk022";
import { impressoraBluetoothConectada } from "../impressaoBluetooth";
import { imprimirEtiquetasBluetooth } from "../impressaoTermica";
import { fetchPerfisEtiquetas } from "../parametros";
import { dataDaValidade, htmlDasEtiquetas } from "./etiquetas.mjs";

const VENDOR_MDK022 = 0x36fc;
const PRODUTO_MDK022 = 0x0513;

/**
 * Registra para o QR da etiqueta abrir o rastreio. Quantidade 0 de propósito: o
 * estoque já recebeu pela compra e criarEtiqueta somaria de novo. Se o registro
 * falhar, a etiqueta sai do mesmo jeito.
 */
export async function registrarEtiquetas(lista, { unidadeId, responsavel, usuario }) {
  const agora = new Date();
  const saida = [];
  for (const e of lista) {
    const codigo = gerarCodigo();
    const validade = dataDaValidade(e.validade);
    try {
      await criarEtiqueta({
        codigo, produto: e.produto, conservacao: e.conservacao, quantidade: 0, unidade: e.unidade,
        validade_dias: Math.max(0, Math.round((validade - agora) / 86400000)),
        manipulacao_em: agora.toISOString(), validade_em: validade.toISOString(),
        lote: "MARMITARIA", responsavel, status: "ativa", copias: e.copias, tipo_etiqueta: "fechado",
      }, unidadeId, { departamento: "marmitaria", usuario });
    } catch { /* a etiqueta impressa vale mais que o registro */ }
    saida.push({ ...e, codigo });
  }
  return saida;
}

function dadosDaEtiqueta(e, { unidadeNome, responsavel }) {
  return {
    // Número, não texto com vírgula: a térmica Bluetooth faz Number() e sumiria com o peso.
    produto: e.produto, quantidade: Number(e.quantidade), unidade: e.unidade, informarQuantidade: true,
    conservacao: e.conservacao, codigo: e.codigo, momento: new Date(), validade: dataDaValidade(e.validade),
    responsavel, lote: "MARMITARIA", unidadeNome, modeloEtiqueta: "validade", tipoEtiqueta: "fechado",
  };
}

async function perfilDaImpressora(unidadeId) {
  try {
    const lista = (await fetchPerfisEtiquetas(unidadeId))?.data || [];
    return lista.find((p) => p.setor === "marmitaria") || lista.find((p) => p.setor === "cozinha") || lista[0] || null;
  } catch { return null; }
}

async function mdk022Autorizada() {
  if (!WebUsbDisponivel()) return false;
  try {
    return (await navigator.usb.getDevices()).some((d) => d.vendorId === VENDOR_MDK022 && d.productId === PRODUTO_MDK022);
  } catch { return false; }
}

/**
 * `pedirPermissao` só vale em um toque da pessoa: o navegador não abre o pedido
 * de USB sozinho. Sem impressora pareada, cai na impressão do aparelho.
 */
export async function imprimirEtiquetas(lista, { unidadeId, unidadeNome = "", responsavel = "", recebidoEm = "", pedirPermissao = false }) {
  const ctx = { unidadeNome, responsavel };
  if (await mdk022Autorizada() || (pedirPermissao && WebUsbDisponivel())) {
    try {
      const perfilFisico = await perfilDaImpressora(unidadeId);
      for (const e of lista) await imprimirEtiquetaMdk022Usb({ dados: dadosDaEtiqueta(e, ctx), tamanho: "60x40", copias: e.copias, perfilFisico });
      return { via: "usb", error: null };
    } catch (e) {
      imprimirHtml(htmlDasEtiquetas(lista, { unidadeNome, responsavel, recebidoEm }));
      return { via: "navegador", error: e?.message || "Não consegui falar com a impressora USB." };
    }
  }
  if (impressoraBluetoothConectada()) {
    try {
      const perfilFisico = await perfilDaImpressora(unidadeId);
      for (const e of lista) await imprimirEtiquetasBluetooth({ tamanho: "60x40", copias: e.copias, larguraImpressora: "58mm", perfilFisico, dados: dadosDaEtiqueta(e, ctx) });
      return { via: "bluetooth", error: null };
    } catch (e) {
      imprimirHtml(htmlDasEtiquetas(lista, { unidadeNome, responsavel, recebidoEm }));
      return { via: "navegador", error: e?.message || "Não consegui falar com a impressora Bluetooth." };
    }
  }
  const ok = imprimirHtml(htmlDasEtiquetas(lista, { unidadeNome, responsavel, recebidoEm }));
  return { via: "navegador", error: ok ? null : "O aparelho não abriu a impressão." };
}
