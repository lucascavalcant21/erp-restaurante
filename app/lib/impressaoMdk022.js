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
    console.log("[ETIQUETA][MDK022] WebUSB disponível");
  } else {
    console.warn("[ETIQUETA][MDK022] WebUSB indisponível neste navegador/dispositivo");
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
    console.log("[ETIQUETA][MDK022] dispositivo localizado");
    console.log("[ETIQUETA][MDK022] device.open OK");
    console.log("[ETIQUETA][MDK022] configuration OK");
    console.log(`[ETIQUETA][MDK022] interface ${impressoraConectadaCache._interfaceTarget ?? 0} claimed`);
    console.log(`[ETIQUETA][MDK022] endpoint OUT ${impressoraConectadaCache._endpointOutNumber ?? 2}`);
    return impressoraConectadaCache;
  }

  // 2. Busca nos dispositivos já autorizados pelo usuário
  const autorizados = await navigator.usb.getDevices();
  let device = autorizados.find(d => d.vendorId === 0x36FC && d.productId === 0x0513);

  if (device) {
    console.log("[ETIQUETA][MDK022] dispositivo localizado");
  } else {
    console.log("[ETIQUETA][MDK022] solicitando permissão do dispositivo...");
    device = await navigator.usb.requestDevice({
      filters: [
        { vendorId: 0x36FC, productId: 0x0513 }
      ]
    });
    console.log("[ETIQUETA][MDK022] dispositivo localizado");
  }

  if (!device) {
    throw new Error("Nenhuma impressora MDK-022 USB foi selecionada.");
  }

  // 3. Abre a comunicação USB
  if (!device.opened) {
    await device.open();
  }
  console.log("[ETIQUETA][MDK022] device.open OK");

  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }
  console.log("[ETIQUETA][MDK022] configuration OK");

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
    console.log(`[ETIQUETA][MDK022] interface ${interfaceTarget} claimed`);
  } catch (err) {
    if (!err.message?.includes("already claimed")) {
      console.warn(`[ETIQUETA][MDK022] Aviso ao reivindicar interface ${interfaceTarget}:`, err.message);
    } else {
      console.log(`[ETIQUETA][MDK022] interface ${interfaceTarget} claimed`);
    }
  }

  console.log(`[ETIQUETA][MDK022] endpoint OUT ${endpointOutNumber}`);
  device._endpointOutNumber = endpointOutNumber;
  device._interfaceTarget = interfaceTarget;
  impressoraConectadaCache = device;
  return device;
}

/**
 * Métricas e limites de layout por dimensão de etiqueta (203 DPI = 8 dots/mm)
 */
export const METRICAS_TAMANHO = {
  "60x40": {
    WIDTH_MM: 60,
    HEIGHT_MM: 40,
    WIDTH_DOTS: 480,
    HEIGHT_DOTS: 320,
    SAFE_LEFT: 16,
    SAFE_TOP: 10,
    MAX_TEXT_WIDTH: 448,
    QR_X: 335,
    QR_Y: 195,
    QR_CELL_SIZE: 3,
    CODE_X: 335,
    CODE_Y: 298,
  },
  "80x40": {
    WIDTH_MM: 80,
    HEIGHT_MM: 40,
    WIDTH_DOTS: 640,
    HEIGHT_DOTS: 320,
    SAFE_LEFT: 20,
    SAFE_TOP: 12,
    MAX_TEXT_WIDTH: 600,
    QR_X: 490,
    QR_Y: 195,
    QR_CELL_SIZE: 4,
    CODE_X: 490,
    CODE_Y: 298,
  },
  "60x60": {
    WIDTH_MM: 60,
    HEIGHT_MM: 60,
    WIDTH_DOTS: 480,
    HEIGHT_DOTS: 480,
    SAFE_LEFT: 16,
    SAFE_TOP: 12,
    MAX_TEXT_WIDTH: 448,
    QR_X: 335,
    QR_Y: 340,
    QR_CELL_SIZE: 3,
    CODE_X: 335,
    CODE_Y: 445,
  },
};

/**
 * Verifica se um texto contém acentos ou caracteres Unicode não-ASCII que exijam renderização via BITMAP.
 */
export function precisaRenderizacaoBitmap(texto) {
  if (!texto) return false;
  return /[^\x00-\x7F]/.test(String(texto));
}

/**
 * Ajusta e divide o texto para caber perfeitamente na largura disponível sem cortar.
 */
export function formatarTextoFitted(texto, maxLarguraDots = 448, preferenciaFonte = "3") {
  const t = String(texto || "").trim();
  if (!t) return { linhas: [], fonte: preferenciaFonte };

  const LARGURA_CHAR = {
    "4": 24,
    "3": 16,
    "2": 12,
    "1": 8,
  };

  const cap = (f) => Math.floor(maxLarguraDots / (LARGURA_CHAR[f] || 16));

  // 1. Tenta fonte preferencial em 1 linha
  if (t.length <= cap(preferenciaFonte)) {
    return { linhas: [t], fonte: preferenciaFonte };
  }

  // 2. Tenta 2 linhas na fonte preferencial (quebrando em espaço)
  const palavras = t.split(/\s+/);
  let l1 = "", l2 = "";
  const maxCharsPref = cap(preferenciaFonte);

  for (const p of palavras) {
    if ((l1 + " " + p).trim().length <= maxCharsPref) {
      l1 = (l1 + " " + p).trim();
    } else {
      l2 = (l2 + " " + p).trim();
    }
  }

  if (l1 && l2 && l2.length <= maxCharsPref) {
    return { linhas: [l1, l2], fonte: preferenciaFonte };
  }

  // 3. Tenta reduzir para a próxima fonte menor
  const fonteMenor = preferenciaFonte === "4" ? "3" : preferenciaFonte === "3" ? "2" : "1";
  const maxCharsMenor = cap(fonteMenor);

  if (t.length <= maxCharsMenor) {
    return { linhas: [t], fonte: fonteMenor };
  }

  // 4. Tenta 2 linhas na fonte menor
  l1 = ""; l2 = "";
  for (const p of palavras) {
    if ((l1 + " " + p).trim().length <= maxCharsMenor) {
      l1 = (l1 + " " + p).trim();
    } else {
      l2 = (l2 + " " + p).trim();
    }
  }

  if (l1 && l2 && l2.length <= maxCharsMenor) {
    return { linhas: [l1, l2], fonte: fonteMenor };
  }

  // 5. Se ainda não coube em 2 linhas, aplica reticências seguras em l2
  if (l1 && l2) {
    l2 = l2.slice(0, Math.max(1, maxCharsMenor - 3)) + "...";
    return { linhas: [l1, l2], fonte: fonteMenor };
  }

  return {
    linhas: [t.slice(0, maxCharsMenor), t.slice(maxCharsMenor, maxCharsMenor * 2)],
    fonte: fonteMenor,
  };
}

/**
 * Renderiza linhas de texto em Canvas 2D e converte para estrutura TSPL BITMAP 1-bit monocromática.
 * No TSPL BITMAP:
 * - 1 byte = 8 pixels horizontais (da esquerda para direita, MSB primeiro)
 * - Bit 0 = Preto (queima ponto térmico)
 * - Bit 1 = Branco (não queima)
 */
export function criarBitmapTextoCanvas({
  linhas = [],
  maxLarguraDots = 448,
  alturaLinhaDots = 32,
  tamanhoFontePx = 28,
  ehNegrito = true,
}) {
  const numLinhas = Math.max(1, linhas.length);
  const width = Math.min(640, Math.max(80, maxLarguraDots));
  const height = numLinhas * alturaLinhaDots;
  const widthBytes = Math.ceil(width / 8);
  const totalBytes = widthBytes * height;

  const bitmapData = new Uint8Array(totalBytes);
  bitmapData.fill(0xFF); // 0xFF = Tudo branco no TSPL (0 = Preto, 1 = Branco)

  if (typeof document !== "undefined" || typeof OffscreenCanvas !== "undefined") {
    try {
      let canvas, ctx;
      if (typeof OffscreenCanvas !== "undefined") {
        canvas = new OffscreenCanvas(width, height);
        ctx = canvas.getContext("2d");
      } else {
        canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        ctx = canvas.getContext("2d");
      }

      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = "#000000";
        ctx.font = `${ehNegrito ? "bold " : ""}${tamanhoFontePx}px Arial, 'Helvetica Neue', sans-serif`;
        ctx.textBaseline = "top";

        linhas.forEach((linha, i) => {
          ctx.fillText(linha, 0, i * alturaLinhaDots + 2);
        });

        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            const ehPreto = a > 128 && (r * 0.299 + g * 0.587 + b * 0.114) < 160;
            if (ehPreto) {
              const byteIdx = y * widthBytes + Math.floor(x / 8);
              const bitPos = 7 - (x % 8);
              bitmapData[byteIdx] &= ~(1 << bitPos); // Bit 0 = Preto
            }
          }
        }
      }
    } catch (eCanvas) {
      console.warn("[MDK022] Fallback de bitmap canvas:", eCanvas.message);
    }
  } else {
    // Modo Node.js para testes unitários sem DOM: simula pixels pretos para validação
    linhas.forEach((linha, i) => {
      const startY = i * alturaLinhaDots + 4;
      const endY = startY + (alturaLinhaDots - 8);
      const textWidthDots = Math.min(width - 10, (linha || "").length * 14);
      for (let y = startY; y < endY && y < height; y++) {
        for (let x = 4; x < textWidthDots; x++) {
          const byteIdx = y * widthBytes + Math.floor(x / 8);
          const bitPos = 7 - (x % 8);
          bitmapData[byteIdx] &= ~(1 << bitPos);
        }
      }
    });
  }

  return {
    widthBytes,
    heightDots: height,
    data: bitmapData,
  };
}

/**
 * Concatena partes de texto ASCII e buffers binários BITMAP em um único Uint8Array contínuo para o TSPL job.
 */
export function concatenarChunksTspl(chunks = []) {
  const encoder = new TextEncoder();
  let totalLength = 0;

  const processed = chunks.map(chunk => {
    if (typeof chunk === "string") {
      const bytes = encoder.encode(chunk);
      totalLength += bytes.length;
      return bytes;
    } else if (chunk instanceof Uint8Array) {
      totalLength += chunk.length;
      return chunk;
    }
    return new Uint8Array(0);
  });

  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of processed) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

/**
 * Converte os dados da etiqueta gerados pelo ERP em comandos TSPL (retornando Uint8Array com suporte a BITMAP para Unicode).
 *
 * @param {Object} params
 * @param {Object} params.dados Dados completos da etiqueta (produto, conservacao, validade, etc.)
 * @param {string} params.tamanho Dimensão exata ("60x40", "80x40", "60x60", etc.)
 * @param {number} params.copias Quantidade de etiquetas a imprimir
 * @returns {Uint8Array} Buffer contendo todos os comandos TSPL e bitmaps binários
 */
export function gerarComandosTsplMdk022({ dados, tamanho = "60x40", copias = 1 }) {
  const m = METRICAS_TAMANHO[tamanho] || METRICAS_TAMANHO["60x40"];

  const p = (n) => String(n).padStart(2, "0");
  const fmtDH = (d) => {
    if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`;
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

  const dataManipulacao = fmtDH(dados.momento ? new Date(dados.momento) : new Date());
  const dataValidade = dados.validade ? (tipoEtiqueta === "aberto" ? fmtDH(new Date(dados.validade)) : fmtD(new Date(dados.validade))) : "—";

  const urlRastreio = typeof window !== "undefined"
    ? `${window.location.origin}/rastreio/${codigo}`
    : `https://app.hefisto.com.br/rastreio/${codigo}`;

  const chunks = [];
  let headerCmd = "";
  const addHeader = (linha) => { headerCmd += linha + "\r\n"; };

  addHeader(`SIZE ${m.WIDTH_MM} mm,${m.HEIGHT_MM} mm`);
  addHeader("GAP 2 mm,0 mm");
  addHeader("DIRECTION 1");
  addHeader("CLS");
  chunks.push(headerCmd);

  // MODELO "SOMENTE NOME"
  if (modeloEtiqueta === "nome") {
    let asciiNome = "";
    const fitNome = formatarTextoFitted(produto, m.MAX_TEXT_WIDTH, "4");
    const bmpNome = criarBitmapTextoCanvas({
      linhas: fitNome.linhas,
      maxLarguraDots: m.MAX_TEXT_WIDTH,
      alturaLinhaDots: 36,
      tamanhoFontePx: 30,
      ehNegrito: true,
    });

    asciiNome += `BITMAP ${m.SAFE_LEFT},${m.SAFE_TOP + 10},${bmpNome.widthBytes},${bmpNome.heightDots},0,`;
    chunks.push(asciiNome);
    chunks.push(bmpNome.data);
    chunks.push("\r\n");

    let tailNome = "";
    if (quantidade) {
      tailNome += `TEXT ${m.SAFE_LEFT},${m.SAFE_TOP + 10 + bmpNome.heightDots + 10},"3",0,1,1,"QTD: ${quantidade}"\r\n`;
    }
    tailNome += `PRINT ${Math.max(1, copias)},1\r\n`;
    chunks.push(tailNome);

    return concatenarChunksTspl(chunks);
  }

  // MODELO COMPLETO (VALIDADE) - DESIGN 60x40 (480 x 320 dots)
  // 1. PRODUTO NO TOPO (Destaque máximo com Bitmap 1-bit para acentos impecáveis)
  let y = m.SAFE_TOP;
  const fitProd = formatarTextoFitted(produto, m.MAX_TEXT_WIDTH, "4");
  const bmpProd = criarBitmapTextoCanvas({
    linhas: fitProd.linhas,
    maxLarguraDots: m.MAX_TEXT_WIDTH,
    alturaLinhaDots: fitProd.linhas.length > 1 ? 26 : 32,
    tamanhoFontePx: fitProd.fonte === "4" ? 28 : fitProd.fonte === "3" ? 22 : 18,
    ehNegrito: true,
  });

  let bodyAscii = `BITMAP ${m.SAFE_LEFT},${y},${bmpProd.widthBytes},${bmpProd.heightDots},0,`;
  chunks.push(bodyAscii);
  chunks.push(bmpProd.data);
  chunks.push("\r\n");

  y += bmpProd.heightDots + 4;

  // 2. CONSERVAÇÃO / TIPO (Esquerda) + PESO / QUANTIDADE (Direita)
  let restAscii = "";
  const labelTipo = tipoEtiqueta === "aberto" ? "MANIPULADO" : "FECHADO";
  const textoConser = `${conservacao} / ${labelTipo}`;
  restAscii += `TEXT ${m.SAFE_LEFT},${y},"2",0,1,1,"${textoConser}"\r\n`;

  if (quantidade) {
    const xQtd = Math.max(280, m.WIDTH_DOTS - m.SAFE_LEFT - (quantidade.length * 12));
    restAscii += `TEXT ${xQtd},${y},"2",0,1,1,"${quantidade}"\r\n`;
  }
  y += 20;

  // 3. DIVISÓRIA 1
  restAscii += `BAR ${m.SAFE_LEFT},${y},${m.MAX_TEXT_WIDTH},2\r\n`;
  y += 6;

  // 4. DATAS & LOTE
  const labelManip = tipoEtiqueta === "aberto" ? "MANIPULACAO:" : "ETIQUETADO: ";
  restAscii += `TEXT ${m.SAFE_LEFT},${y},"2",0,1,1,"${labelManip} ${dataManipulacao}"\r\n`;
  y += 20;

  restAscii += `TEXT ${m.SAFE_LEFT},${y},"3",0,1,1,"VALIDADE:    ${dataValidade}"\r\n`;
  y += 24;

  const textoLote = dados.lote ? `LOTE:        ${dados.lote}` : "LOTE:        COZINHA";
  restAscii += `TEXT ${m.SAFE_LEFT},${y},"2",0,1,1,"${textoLote}"\r\n`;
  y += 20;

  // 5. DIVISÓRIA 2
  restAscii += `BAR ${m.SAFE_LEFT},${y},${m.MAX_TEXT_WIDTH},2\r\n`;
  y += 6;

  chunks.push(restAscii);

  // 6. RESPONSÁVEL
  if (responsavel) {
    const textoResp = `RESP.: ${responsavel}`;
    const fitResp = formatarTextoFitted(textoResp, m.MAX_TEXT_WIDTH, "2");

    if (precisaRenderizacaoBitmap(responsavel)) {
      const bmpResp = criarBitmapTextoCanvas({
        linhas: fitResp.linhas,
        maxLarguraDots: m.MAX_TEXT_WIDTH,
        alturaLinhaDots: 20,
        tamanhoFontePx: 16,
        ehNegrito: true,
      });
      const cmdRespBmp = `BITMAP ${m.SAFE_LEFT},${y},${bmpResp.widthBytes},${bmpResp.heightDots},0,`;
      chunks.push(cmdRespBmp);
      chunks.push(bmpResp.data);
      chunks.push("\r\n");
      y += bmpResp.heightDots + 4;
    } else {
      let respTextCmd = "";
      for (const linha of fitResp.linhas) {
        respTextCmd += `TEXT ${m.SAFE_LEFT},${y},"${fitResp.fonte}",0,1,1,"${linha}"\r\n`;
        y += 20;
      }
      chunks.push(respTextCmd);
    }
  }

  // 7. RODAPÉ (EMPRESA + QR CODE + CÓDIGO)
  let footerAscii = "";
  footerAscii += `TEXT ${m.SAFE_LEFT},265,"2",0,1,1,"SELDEESTRELA"\r\n`;
  footerAscii += `TEXT ${m.SAFE_LEFT},285,"1",0,1,1,"COMIDAS NORTISTAS"\r\n`;

  if (codigo) {
    footerAscii += `QRCODE ${m.QR_X},${m.QR_Y},L,${m.QR_CELL_SIZE},A,0,"${urlRastreio}"\r\n`;
    footerAscii += `TEXT ${m.CODE_X},${m.CODE_Y},"1",0,1,1,"#${codigo}"\r\n`;
  }

  footerAscii += `PRINT ${Math.max(1, copias)},1\r\n`;
  chunks.push(footerAscii);

  return concatenarChunksTspl(chunks);
}

/**
 * Função/Etiqueta de Diagnóstico para testar fisicamente todos os acentos em Português na MDK-022.
 */
export function gerarEtiquetaDiagnosticoTsplMdk022() {
  const dadosDiagnostico = {
    produto: "AÇAFRÃO / CÚRCUMA",
    conservacao: "RESFRIADO",
    lote: "COZINHA",
    momento: new Date(),
    validade: new Date(Date.now() + 3 * 86400000),
    responsavel: "JOSEPH ANDREY GOMES DA SILVA",
    codigo: "DIAG12345",
    modeloEtiqueta: "validade",
    tipoEtiqueta: "aberto",
    unidadeNome: "SELDEESTRELA COMIDAS NORTISTAS",
  };

  return gerarComandosTsplMdk022({ dados: dadosDiagnostico, tamanho: "60x40", copias: 1 });
}

/**
 * Envia uma etiqueta formatada em TSPL diretamente para a impressora MDK-022 via WebUSB.
 *
 * @param {Object} params
 * @param {Object} params.dados Dados da etiqueta
 * @param {string} params.tamanho Tamanho exato ("60x40", etc.)
 * @param {number} params.copias Quantidade de cópias
 * @returns {Promise<{ ok: boolean, bytes: number, status?: string }>}
 */
export async function imprimirEtiquetaMdk022Usb({ dados, tamanho = "60x40", copias = 1, onStatusChange }) {
  try {
    if (onStatusChange) onStatusChange("Conectando à MDK-022...");
    const device = await obterDispositivoMdk022();
    const endpointOut = device._endpointOutNumber || 2;

    const buffer = gerarComandosTsplMdk022({ dados, tamanho, copias });

    console.log(`[ETIQUETA][MDK022] TSPL gerado: ${buffer.length} bytes`);
    
    if (onStatusChange) onStatusChange("Enviando etiqueta...");
    console.log("[ETIQUETA][MDK022] transferOut iniciado");

    const resultado = await device.transferOut(endpointOut, buffer);

    console.log(`[ETIQUETA][MDK022] transferOut status: ${resultado.status}`);

    if (resultado.status === "ok") {
      console.log("[ETIQUETA][MDK022] impressão finalizada");
      if (onStatusChange) onStatusChange("Etiqueta enviada para MDK-022.");
      return {
        ok: true,
        bytes: resultado.bytesWritten || buffer.length,
        status: resultado.status,
        vendorId: device.vendorId,
        productId: device.productId,
        interfaceNumber: device._interfaceTarget ?? 0,
        endpointNumber: endpointOut
      };
    } else {
      throw new Error(`A impressora MDK-022 respondeu com o status: ${resultado.status}`);
    }
  } catch (err) {
    console.error("[ETIQUETA][MDK022] Erro na transmissão WebUSB MDK-022:", err.message || err);
    throw err;
  }
}
