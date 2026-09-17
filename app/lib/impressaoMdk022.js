/**
 * Módulo de Impressão Direta WebUSB para Impressora de Etiquetas MDK-022 (TSPL)
 *
 * ESPECIFICAÇÕES DA IMPRESSORA:
 * - Vendor ID: 0x36FC (14076)
 * - Product ID: 0x0513 (1299)
 * - Interface: #0
 * - Endpoint OUT Bulk: #2
 * - Protocolo: TSPL (ASCII / UTF-8 com CRLF \r\n)
 */

let impressoraConectadaCache = null;

/**
 * Verifica se a API WebUSB está disponível no ambiente atual.
 */
export function WebUsbDisponivel() {
  const disponivel = typeof navigator !== "undefined" && !!(navigator.usb && typeof navigator.usb.getDevices === "function");
  if (disponivel) {
    console.log("[MDK022] WebUSB disponível");
  } else {
    console.warn("[MDK022] WebUSB indisponível neste navegador/dispositivo");
  }
  return disponivel;
}

/**
 * Procura ou solicita conexão WebUSB com a impressora MDK-022.
 */
export async function obterDispositivoMdk022() {
  if (!WebUsbDisponivel()) {
    throw new Error("WebUSB não é suportado neste dispositivo/navegador. Use o Google Chrome no Android ou o app Hefisto TWA.");
  }

  // 1. Se já temos a impressora em cache e aberta, reutiliza
  if (impressoraConectadaCache && impressoraConectadaCache.opened) {
    console.log("[MDK022] dispositivo encontrado no cache e aberto");
    return impressoraConectadaCache;
  }

  // 2. Busca nos dispositivos já autorizados pelo usuário
  const autorizados = await navigator.usb.getDevices();
  let device = autorizados.find(d => d.vendorId === 0x36FC && d.productId === 0x0513);

  if (device) {
    console.log("[MDK022] dispositivo encontrado nos autorizados (Vendor: 0x36FC, Product: 0x0513)");
  } else {
    console.log("[MDK022] dispositivo não encontrado nos autorizados. Solicitando permissão via requestDevice...");
    // Solicitando permissão com filtro exato para MDK-022
    device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x36FC, productId: 0x0513 }
      ]
    });
    console.log("[MDK022] dispositivo selecionado pelo usuário:", device.productName || "MDK-022");
  }

  if (!device) {
    throw new Error("Nenhuma impressora MDK-022 USB foi selecionada.");
  }

  // 3. Abre a comunicação USB
  if (!device.opened) {
    await device.open();
  }
  console.log("[MDK022] dispositivo aberto");

  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Encontra interface e endpoint OUT (Prioridade Interface #0 / Endpoint #2)
  let interfaceTarget = 0;
  let endpointOutNumber = 2;

  const interfaces = device.configuration?.interfaces || [];
  for (const iface of interfaces) {
    for (const alt of iface.alternates) {
      const outEp = alt.endpoints.find(e => e.direction === "out" && e.type === "bulk");
      if (outEp) {
        interfaceTarget = iface.interfaceNumber;
        endpointOutNumber = outEp.endpointNumber;
        break;
      }
    }
  }

  try {
    await device.claimInterface(interfaceTarget);
    console.log(`[MDK022] interface #${interfaceTarget} reivindicada`);
  } catch (err) {
    if (!err.message?.includes("already claimed")) {
      console.warn(`[MDK022] Aviso ao reivindicar interface #${interfaceTarget}:`, err.message);
    } else {
      console.log(`[MDK022] interface #${interfaceTarget} já estava reivindicada`);
    }
  }

  console.log(`[MDK022] endpoint OUT #${endpointOutNumber}`);
  device._endpointOutNumber = endpointOutNumber;
  impressoraConectadaCache = device;
  return device;
}

/**
 * Converte os dados da etiqueta gerados pelo ERP em comandos TSPL.
 *
 * @param {Object} params
 * @param {Object} params.dados Dados completos da etiqueta (produto, conservacao, validade, etc.)
 * @param {string} params.tamanho Dimensão exata ("80x40", "60x40", "60x60", etc.)
 * @param {number} params.copias Quantidade de etiquetas a imprimir
 * @returns {string} String contendo todos os comandos TSPL finalizados com \r\n
 */
export function gerarComandosTsplMdk022({ dados, tamanho = "80x40", copias = 1 }) {
  const [larguraStr = "80", alturaStr = "40"] = tamanho.split("x");
  const largura = parseInt(larguraStr, 10) || 80;
  const altura = parseInt(alturaStr, 10) || 40;

  const p = (n) => String(n).padStart(2, "0");
  const fmtDH = (d) => {
    if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}H${p(d.getMinutes())}`;
  };
  const fmtD = (d) => {
    if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const produto = (dados.produto || "").toUpperCase().trim();
  const conservacao = (dados.conservacao || "Resfriado").toUpperCase();
  const quantidade = dados.quantidade ? `${dados.quantidade} ${dados.unidade || "UN"}` : "";
  const lote = dados.lote ? `LOTE: ${dados.lote}` : "";
  const responsavel = (dados.responsavel || "").toUpperCase().trim();
  const codigo = dados.codigo || "";
  const modeloEtiqueta = dados.modeloEtiqueta || "validade";
  const tipoEtiqueta = dados.tipoEtiqueta || "aberto";
  const unidadeNome = (dados.unidadeNome || "").toUpperCase().trim();

  const dataManipulacao = fmtDH(dados.momento ? new Date(dados.momento) : new Date());
  const dataValidade = dados.validade ? (tipoEtiqueta === "aberto" ? fmtDH(new Date(dados.validade)) : fmtD(new Date(dados.validade))) : "—";

  // URL para rastreabilidade via QR Code nativo
  const urlRastreio = typeof window !== "undefined"
    ? `${window.location.origin}/rastreio/${codigo}`
    : `https://app.hefisto.com.br/rastreio/${codigo}`;

  let cmd = "";
  const add = (linha) => { cmd += linha + "\r\n"; };

  // 1. Configurações gerais da página TSPL
  add(`SIZE ${largura} mm,${altura} mm`);
  add("GAP 2 mm,0 mm");
  add("DIRECTION 1");
  add("CLS");

  // MODELO "SÓ O NOME"
  if (modeloEtiqueta === "nome") {
    add(`TEXT 30,30,"4",0,1,1,"${unidadeNome.slice(0, 30)}"`);
    add(`TEXT 30,90,"4",0,1,1,"${produto.slice(0, 24)}"`);
    if (produto.length > 24) {
      add(`TEXT 30,140,"3",0,1,1,"${produto.slice(24, 50)}"`);
    }
    if (quantidade) {
      add(`TEXT 30,200,"3",0,1,1,"QTD: ${quantidade}"`);
    }
    if (codigo) {
      add(`QRCODE 460,40,L,4,A,0,"${urlRastreio}"`);
      add(`TEXT 460,240,"2",0,1,1,"#${codigo}"`);
    }
    add(`PRINT ${Math.max(1, copias)},1`);
    return cmd;
  }

  // MODELO COMPLETO (VALIDADE)
  // Layout ajustado em Dots (203 DPI: 1 mm = 8 dots)
  // 80x40mm -> 640 x 320 dots | 60x40mm -> 480 x 320 dots
  const qrX = largura >= 80 ? 450 : 330;

  // Nome da Empresa/Unidade
  add(`TEXT 20,20,"2",0,1,1,"${unidadeNome.slice(0, 35)}"`);

  // Nome do Produto (Destaque)
  const prodLinha1 = produto.slice(0, 22);
  const prodLinha2 = produto.slice(22, 44);
  add(`TEXT 20,50,"3",0,1,1,"${prodLinha1}"`);
  if (prodLinha2) {
    add(`TEXT 20,90,"3",0,1,1,"${prodLinha2}"`);
  }

  // Conservação + Peso/Qtd + Lote
  let linhaDetalhes = `${conservacao}`;
  if (quantidade) linhaDetalhes += ` | ${quantidade}`;
  if (lote) linhaDetalhes += ` | ${lote}`;
  add(`TEXT 20,${prodLinha2 ? 130 : 100},"2",0,1,1,"${linhaDetalhes}"`);

  // Data de Manipulação / Etiquetagem
  const labelManip = tipoEtiqueta === "aberto" ? "MANIP:" : "ETIQ:";
  add(`TEXT 20,${prodLinha2 ? 165 : 135},"2",0,1,1,"${labelManip} ${dataManipulacao}"`);

  // Data de Validade (Destaque)
  add(`TEXT 20,${prodLinha2 ? 200 : 170},"3",0,1,1,"VAL: ${dataValidade}"`);

  // Responsável
  if (responsavel) {
    add(`TEXT 20,${prodLinha2 ? 245 : 215},"2",0,1,1,"RESP: ${responsavel.slice(0, 25)}"`);
  }

  // QR Code Nativo TSPL para Rastreio
  if (codigo) {
    add(`QRCODE ${qrX},35,L,3,A,0,"${urlRastreio}"`);
    add(`TEXT ${qrX},200,"2",0,1,1,"#${codigo}"`);
  }

  add(`PRINT ${Math.max(1, copias)},1`);
  return cmd;
}

/**
 * Envia uma etiqueta formatada em TSPL diretamente para a impressora MDK-022 via WebUSB.
 *
 * @param {Object} params
 * @param {Object} params.dados Dados da etiqueta
 * @param {string} params.tamanho Tamanho exato ("80x40", etc.)
 * @param {number} params.copias Quantidade de cópias
 * @returns {Promise<{ ok: boolean, bytes: number, status?: string }>}
 */
export async function imprimirEtiquetaMdk022Usb({ dados, tamanho = "80x40", copias = 1 }) {
  try {
    const device = await obterDispositivoMdk022();
    const endpointOut = device._endpointOutNumber || 2;

    const comandosTspl = gerarComandosTsplMdk022({ dados, tamanho, copias });
    const encoder = new TextEncoder();
    const buffer = encoder.encode(comandosTspl);

    console.log(`[MDK022] TSPL gerado: ${buffer.length} bytes`);
    console.log("[MDK022] transferOut iniciado");

    const resultado = await device.transferOut(endpointOut, buffer);

    console.log(`[MDK022] transferOut status: ${resultado.status}`);

    if (resultado.status === "ok") {
      console.log("[MDK022] impressão concluída com sucesso!");
      return {
        ok: true,
        bytes: resultado.bytesWritten || buffer.length,
        status: resultado.status
      };
    } else {
      throw new Error(`A impressora MDK-022 respondeu com o status: ${resultado.status}`);
    }
  } catch (err) {
    console.error("[MDK022] Erro na transmissão WebUSB MDK-022:", err.message || err);
    throw err;
  }
}
