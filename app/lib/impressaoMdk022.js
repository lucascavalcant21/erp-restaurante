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
    try {
      device = await navigator.usb.requestDevice({
        filters: [
          { vendorId: 0x36FC, productId: 0x0513 }
        ]
      });
      console.log("[ETIQUETA][MDK022] dispositivo localizado");
    } catch (err) {
      if (err.name === 'NotFoundError' || err.message.includes('No device selected')) {
        throw new Error("Nenhuma impressora foi selecionada. Por favor, conecte a MDK-022 via USB, clique em Imprimir e selecione a impressora na lista que aparecer na tela.");
      }
      throw err;
    }
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
    SAFE_TOP: 6,
    SAFE_BOTTOM: 6,
    PRINT_OFFSET_Y: 0,
    MAX_TEXT_WIDTH: 448,
    QR_X: 350,
    QR_Y: 175,
    QR_CELL_SIZE: 3,
    CODE_X: 350,
    CODE_Y: 268,
  },
  "80x40": {
    WIDTH_MM: 80,
    HEIGHT_MM: 40,
    WIDTH_DOTS: 640,
    HEIGHT_DOTS: 320,
    SAFE_LEFT: 20,
    SAFE_TOP: 8,
    SAFE_BOTTOM: 8,
    PRINT_OFFSET_Y: 0,
    MAX_TEXT_WIDTH: 600,
    QR_X: 490,
    QR_Y: 175,
    QR_CELL_SIZE: 4,
    CODE_X: 490,
    CODE_Y: 268,
  },
  "60x60": {
    WIDTH_MM: 60,
    HEIGHT_MM: 60,
    WIDTH_DOTS: 480,
    HEIGHT_DOTS: 480,
    SAFE_LEFT: 16,
    SAFE_TOP: 8,
    SAFE_BOTTOM: 8,
    PRINT_OFFSET_Y: 0,
    MAX_TEXT_WIDTH: 448,
    QR_X: 350,
    QR_Y: 320,
    QR_CELL_SIZE: 3,
    CODE_X: 350,
    CODE_Y: 415,
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
 * Função utilitária genérica que executa renderização visual Canvas 2D e converte o resultado em buffer 1-bit monocromático TSPL BITMAP.
 */
export function renderizarCanvasParaBitmap(drawFn, width = 448, height = 32) {
  const widthBytes = Math.ceil(width / 8);
  const totalBytes = widthBytes * height;

  const bitmapData = new Uint8Array(totalBytes);
  bitmapData.fill(0xFF); // 0xFF = Branco no TSPL (0 = Preto)

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
        ctx.textBaseline = "top";

        drawFn(ctx, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const r = pixels[idx];
            const g = pixels[idx + 1];
            const b = pixels[idx + 2];
            const a = pixels[idx + 3];

            // Threshold de luminância para térmica 203 DPI (180 = preto nítido sem fechar loops de 'A', 'R', 'O', '0', 'B')
            const ehPreto = a > 128 && (r * 0.299 + g * 0.587 + b * 0.114) < 180;
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
    // Modo Node.js para testes unitários em CLI sem DOM
    const startY = 2;
    const endY = height - 2;
    for (let y = startY; y < endY && y < height; y++) {
      for (let x = 4; x < width - 10; x++) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitPos = 7 - (x % 8);
        bitmapData[byteIdx] &= ~(1 << bitPos);
      }
    }
  }

  return {
    widthBytes,
    heightDots: height,
    data: bitmapData,
  };
}

/**
 * Renderiza linhas de texto em Canvas 2D e converte para estrutura TSPL BITMAP 1-bit monocromática.
 */
export function criarBitmapTextoCanvas({
  linhas = [],
  maxLarguraDots = 448,
  alturaLinhaDots = 32,
  tamanhoFontePx = 28,
  ehNegrito = true,
}) {
  const numLinhas = Math.max(1, linhas.length);
  const height = numLinhas * alturaLinhaDots;

  return renderizarCanvasParaBitmap((ctx) => {
    ctx.fillStyle = "#000000";
    ctx.font = `${ehNegrito ? "bold " : ""}${tamanhoFontePx}px Arial, 'Helvetica Neue', sans-serif`;
    ctx.textBaseline = "top";

    linhas.forEach((linha, i) => {
      ctx.fillText(linha, 0, i * alturaLinhaDots + 2);
    });
  }, maxLarguraDots, height);
}

/**
 * Renderiza a Segunda Linha (Conservação + Peso/Qtd) em Canvas 2D com Negrito Real.
 */
export function criarBitmapTextoComQuantidade({
  textoEsquerda = "RESFRIADO / MANIPULADO",
  textoDireita = "500 g",
  maxLarguraDots = 448,
}) {
  return renderizarCanvasParaBitmap((ctx, width) => {
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    // Conservação / Tipo em Negrito
    ctx.font = "bold 18px Arial, 'Helvetica Neue', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(textoEsquerda, 0, 2);

    // Peso / Quantidade em Negrito
    if (textoDireita) {
      ctx.textAlign = "right";
      ctx.fillText(textoDireita, width, 2);
    }
  }, maxLarguraDots, 22);
}

/**
 * Renderiza o Bloco de Datas e Lote em Canvas 2D com Rótulos em Negrito e Destaque para Validade.
 */
export function criarBitmapBlocoDatas({
  labelManip = "MANIPULAÇÃO:",
  dataManipulacao = "17/09/26 - 00:00",
  dataValidade = "20/09/26 - 00:00",
  lote = "COZINHA",
  maxLarguraDots = 448,
}) {
  return renderizarCanvasParaBitmap((ctx) => {
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    // Linha 1: MANIPULAÇÃO: 17/09/26 00:00
    ctx.font = "bold 16px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillText(labelManip, 0, 2);
    ctx.font = "16px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillText(dataManipulacao, 150, 2);

    // Linha 2: VALIDADE: 20/09/26 00:00 (DESTAQUE BOLD MAIOR E MAIS FORTE)
    ctx.font = "bold 18px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillText("VALIDADE:", 0, 22);
    ctx.fillText(dataValidade, 150, 22);

    // Linha 3: LOTE: COZINHA
    ctx.font = "bold 16px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillText("LOTE:", 0, 43);
    ctx.font = "16px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillText(lote || "COZINHA", 150, 43);
  }, maxLarguraDots, 63);
}

/**
 * Renderiza o campo Responsável em Canvas 2D com "RESP.:" em Negrito e nome completo.
 */
export function criarBitmapResponsavel({
  responsavel = "JOSEPH ANDREY GOMES DA SILVA",
  maxLarguraDots = 448,
}) {
  const r = (responsavel || "").trim();
  const fit = formatarTextoFitted(`RESP.: ${r}`, maxLarguraDots, "2");
  const ehMultiLinha = fit.linhas.length > 1;
  const altura = ehMultiLinha ? 38 : 20;

  return renderizarCanvasParaBitmap((ctx) => {
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    if (!ehMultiLinha) {
      ctx.font = "bold 16px Arial, 'Helvetica Neue', sans-serif";
      ctx.fillText("RESP.:", 0, 2);
      ctx.font = "16px Arial, 'Helvetica Neue', sans-serif";
      ctx.fillText(r, 65, 2);
    } else {
      ctx.font = "bold 16px Arial, 'Helvetica Neue', sans-serif";
      ctx.fillText("RESP.:", 0, 2);
      ctx.font = "16px Arial, 'Helvetica Neue', sans-serif";
      ctx.fillText(fit.linhas[0].replace(/^RESP\.:\s*/, ""), 65, 2);
      ctx.fillText(fit.linhas[1] || "", 65, 20);
    }
  }, maxLarguraDots, altura);
}

/**
 * Renderiza o Rodapé da Empresa em Canvas 2D com SELDEESTRELA em Negrito.
 */
export function criarBitmapEmpresa({
  empresaBold = "SELDEESTRELA",
  subtitulo = "COMIDAS NORTISTAS",
  codigo = "",
  maxLarguraDots = 320,
}) {
  return renderizarCanvasParaBitmap((ctx) => {
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    ctx.font = "bold 22px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillText(empresaBold, 0, 2);

    ctx.font = "13px Arial, 'Helvetica Neue', sans-serif";
    ctx.fillText(subtitulo, 0, 26);

    if (codigo) {
      ctx.font = "bold 12px monospace, monospace";
      ctx.fillText(`#${codigo}`, 0, 42);
    }
  }, maxLarguraDots, 56);
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

export function gerarComandosTsplMdk022({ dados, tamanho = "60x40", copias = 1, perfilFisico = null }) {
  let m = METRICAS_TAMANHO[tamanho] || METRICAS_TAMANHO["60x40"];

  let wMm = m.WIDTH_MM;
  let hMm = m.HEIGHT_MM;
  let gapMm = 2;
  let safeLeft = m.SAFE_LEFT;
  let safeTop = m.SAFE_TOP;
  let maxTextWidth = m.MAX_TEXT_WIDTH;
  let qrX = m.QR_X;
  let qrY = m.QR_Y;
  let qrCell = m.QR_CELL_SIZE;
  let codeX = m.CODE_X;
  let codeY = m.CODE_Y;
  let direction = 1;

  if (perfilFisico) {
    wMm = perfilFisico.widthMm || 60;
    hMm = perfilFisico.heightMm || 40;
    gapMm = perfilFisico.gapMm ?? 2;
    const dpi = perfilFisico.dpi || 203;
    const mmToDots = (mm) => Math.round(mm * (dpi / 25.4));
    
    // Calcula margens físicas
    const mL = mmToDots(perfilFisico.marginLeftMm ?? 2);
    const mR = mmToDots(perfilFisico.marginRightMm ?? 2);
    const mT = mmToDots(perfilFisico.marginTopMm ?? 1);
    
    // Offsets de hardware
    const offX = mmToDots(perfilFisico.offsetXmm || 0);
    const offY = mmToDots(perfilFisico.offsetYmm || 0);

    safeLeft = mL + offX;
    safeTop = mT + offY;
    const widthDots = mmToDots(wMm);
    const heightDots = mmToDots(hMm);
    maxTextWidth = widthDots - (mL + mR);

    // Ajusta o QR para o canto inferior direito com margens
    qrCell = wMm > 70 ? 4 : 3;
    const qrSize = qrCell * 33; // ~33 módulos no QR
    qrX = widthDots - mR - qrSize + offX;
    qrY = heightDots - mmToDots(perfilFisico.marginBottomMm ?? 2) - qrSize + offY;
    
    codeX = qrX;
    codeY = qrY + qrSize + 5;
    
    // Ajuste de rotação para TSPL (0 ou 1 no DIRECTION, TSPL não roda 90 perfeitamente sem o comando ROTATE ou DIRECTION 0/1 dependendo do driver)
    direction = (perfilFisico.rotation === 180 || perfilFisico.rotation === 270) ? 0 : 1;
  }

  const p = (n) => String(n).padStart(2, "0");
  const fmtDH = (d) => {
    if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} - ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const fmtD = (d) => {
    if (!(d instanceof Date) || !Number.isFinite(d.getTime())) return "—";
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
  };

  const produto = (dados.produto || "").toUpperCase().trim();
  const conservacao = (dados.conservacao || "Resfriado").toUpperCase();
  const quantidade = dados.quantidade ? `${dados.quantidade} ${dados.unidade || "UN"}` : "";
  const lote = dados.lote ? `${dados.lote}` : "COZINHA";
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

  addHeader(`SIZE ${wMm} mm,${hMm} mm`);
  addHeader(`GAP ${gapMm} mm,0 mm`);
  addHeader(`DIRECTION ${direction}`);
  if (perfilFisico && (perfilFisico.offsetXmm !== 0 || perfilFisico.offsetYmm !== 0)) {
    // Comandos de referência opcionais no TSPL, mas offset já está na renderização via coords.
    // addHeader(`REFERENCE ${mmToDots(perfilFisico.offsetXmm)},${mmToDots(perfilFisico.offsetYmm)}`);
  }
  addHeader("CLS");
  chunks.push(headerCmd);

  // MODELO "SOMENTE NOME"
  if (modeloEtiqueta === "nome") {
    let asciiNome = "";
    const fitNome = formatarTextoFitted(produto, maxTextWidth, "4");
    const bmpNome = criarBitmapTextoCanvas({
      linhas: fitNome.linhas,
      maxLarguraDots: maxTextWidth,
      alturaLinhaDots: 36,
      tamanhoFontePx: 32,
      ehNegrito: true,
    });

    asciiNome += `BITMAP ${safeLeft},${safeTop},${bmpNome.widthBytes},${bmpNome.heightDots},0,`;
    chunks.push(asciiNome);
    chunks.push(bmpNome.data);
    chunks.push("\r\n");

    let tailNome = "";
    if (quantidade) {
      tailNome += `TEXT ${safeLeft},${safeTop + bmpNome.heightDots + 10},"3",0,1,1,"QTD: ${quantidade}"\r\n`;
    }
    tailNome += `PRINT ${Math.max(1, copias)},1\r\n`;
    chunks.push(tailNome);

    return concatenarChunksTspl(chunks);
  }

  // TESTE DE CALIBRAÇÃO SE SOLICITADO
  if (dados.testeCalibracao) {
    const dW = mmToDots(wMm) || 480;
    const dH = mmToDots(hMm) || 320;
    let txt = `TEXT ${Math.floor(dW/2)},${Math.floor(dH/2)},"3",0,1,1,2,"TESTE HEFISTO"\r\n`;
    txt += `TEXT ${Math.floor(dW/2)},${Math.floor(dH/2) + 30},"2",0,1,1,2,"${wMm} x ${hMm} mm"\r\n`;
    txt += `TEXT ${safeLeft},${safeTop},"2",0,1,1,"+"\r\n`; // top left
    txt += `TEXT ${dW - safeLeft - 20},${safeTop},"2",0,1,1,"+"\r\n`; // top right
    txt += `TEXT ${safeLeft},${dH - 30},"2",0,1,1,"+"\r\n`; // bot left
    txt += `TEXT ${dW - safeLeft - 20},${dH - 30},"2",0,1,1,"+"\r\n`; // bot right
    txt += `PRINT ${Math.max(1, copias)},1\r\n`;
    chunks.push(txt);
    return concatenarChunksTspl(chunks);
  }

  // MODELO COMPLETO (VALIDADE) — ESTRUTURA VISUAL
  let y = safeTop; 

  // 1. PRODUTO NO TOPO (NÍVEL 1 — MAIOR E BOLD FORTE)
  const fitProd = formatarTextoFitted(produto, maxTextWidth, "4");
  const bmpProd = criarBitmapTextoCanvas({
    linhas: fitProd.linhas,
    maxLarguraDots: maxTextWidth,
    alturaLinhaDots: fitProd.linhas.length > 1 ? 26 : 32,
    tamanhoFontePx: fitProd.fonte === "4" ? 30 : fitProd.fonte === "3" ? 22 : 18,
    ehNegrito: true,
  });

  let cmdProdBmp = `BITMAP ${safeLeft},${y},${bmpProd.widthBytes},${bmpProd.heightDots},0,`;
  chunks.push(cmdProdBmp);
  chunks.push(bmpProd.data);
  chunks.push("\r\n");

  y += bmpProd.heightDots + 2;

  // 2. CONSERVAÇÃO / TIPO + PESO (NÍVEL 2 — BOLD)
  const labelTipo = tipoEtiqueta === "aberto" ? "MANIPULADO" : "FECHADO";
  const textoConser = `${conservacao} / ${labelTipo}`;
  const bmpSegundaLinha = criarBitmapTextoComQuantidade({
    textoEsquerda: textoConser,
    textoDireita: quantidade,
    maxLarguraDots: maxTextWidth,
  });

  let cmdSegundaBmp = `BITMAP ${safeLeft},${y},${bmpSegundaLinha.widthBytes},${bmpSegundaLinha.heightDots},0,`;
  chunks.push(cmdSegundaBmp);
  chunks.push(bmpSegundaLinha.data);
  chunks.push("\r\n");

  y += bmpSegundaLinha.heightDots + 2;

  // 3. DIVISÓRIA 1 (Linha fina horizontal)
  let restAscii = `BAR ${safeLeft},${y},${maxTextWidth},2\r\n`;
  y += 4;
  chunks.push(restAscii);

  // 4. DATAS & LOTE (NÍVEL 3 — RÓTULOS EM NEGRITO, VALIDADE DESTACADA)
  const labelManip = tipoEtiqueta === "aberto" ? "MANIPULAÇÃO:" : "ETIQUETADO: ";
  const bmpDatas = criarBitmapBlocoDatas({
    labelManip,
    dataManipulacao,
    dataValidade,
    lote,
    maxLarguraDots: maxTextWidth,
  });

  let cmdDatasBmp = `BITMAP ${safeLeft},${y},${bmpDatas.widthBytes},${bmpDatas.heightDots},0,`;
  chunks.push(cmdDatasBmp);
  chunks.push(bmpDatas.data);
  chunks.push("\r\n");

  y += bmpDatas.heightDots + 2;

  // 5. SEGUNDA DIVISÓRIA
  let div2Ascii = `BAR ${safeLeft},${y},${maxTextWidth},2\r\n`;
  y += 4;
  chunks.push(div2Ascii);

  // 6. RESPONSÁVEL (RESP. em Negrito, Nome completo)
  const bmpResp = criarBitmapResponsavel({
    responsavel,
    maxLarguraDots: maxTextWidth,
  });

  let cmdRespBmp = `BITMAP ${safeLeft},${y},${bmpResp.widthBytes},${bmpResp.heightDots},0,`;
  chunks.push(cmdRespBmp);
  chunks.push(bmpResp.data);
  chunks.push("\r\n");

  y += bmpResp.heightDots + 4;

  // 7. RODAPÉ & QR CODE (SELDEESTRELA em Negrito, QR mais alto no canto inferior direito)
  const maxLarguraEmpresa = maxTextWidth - (qrCell * 33) - 10;
  const bmpEmpresa = criarBitmapEmpresa({
    empresaBold: "SELDEESTRELA",
    subtitulo: "COMIDAS NORTISTAS",
    codigo,
    maxLarguraDots: Math.max(100, maxLarguraEmpresa),
  });

  const yEmpresa = Math.max(y, qrY);
  let cmdEmpresaBmp = `BITMAP ${safeLeft},${yEmpresa},${bmpEmpresa.widthBytes},${bmpEmpresa.heightDots},0,`;
  chunks.push(cmdEmpresaBmp);
  chunks.push(bmpEmpresa.data);
  chunks.push("\r\n");

  let footerAscii = "";
  if (codigo) {
    footerAscii += `QRCODE ${Math.max(0, qrX)},${Math.max(0, qrY)},L,${qrCell},A,0,"${urlRastreio}"\r\n`;
    footerAscii += `TEXT ${Math.max(0, codeX)},${Math.max(0, codeY)},"1",0,1,1,"#${codigo}"\r\n`;
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
 * @param {Object} params.perfilFisico Perfil físico customizado
 * @returns {Promise<{ ok: boolean, bytes: number, status?: string }>}
 */
export async function imprimirEtiquetaMdk022Usb({ dados, tamanho = "60x40", copias = 1, perfilFisico = null, onStatusChange }) {
  try {
    if (onStatusChange) onStatusChange("Conectando à MDK-022...");
    
    if (typeof gerarComandosTsplMdk022 !== 'function') {
      throw new Error("ERRO PRINCIPAL: gerarComandosTsplMdk022 is not defined ou não é uma função.");
    }

    const device = await obterDispositivoMdk022();
    const endpointOut = device._endpointOutNumber || 2;

    const buffer = gerarComandosTsplMdk022({ dados, tamanho, copias, perfilFisico });

    const bytesGerados = buffer.length;
    console.log(`[ETIQUETA][MDK022] TSPL gerado: ${bytesGerados} bytes`);
    
    if (bytesGerados === 0) {
      throw new Error("Nenhum byte gerado pelos comandos TSPL.");
    }

    if (onStatusChange) onStatusChange("Enviando etiqueta...");
    console.log("[ETIQUETA][MDK022] transferOut iniciado");

    const resultado = await device.transferOut(endpointOut, buffer);
    const bytesEnviados = resultado.bytesWritten ?? 0;
    const status = resultado.status;

    console.log(`[ETIQUETA][MDK022] transferOut status: ${status}, bytes enviados: ${bytesEnviados}`);
    
    const diagnostico = [
      `Vendor ID: 0x${device.vendorId.toString(16).toUpperCase()} (${device.vendorId})`,
      `Product ID: 0x${device.productId.toString(16).toUpperCase()} (${device.productId})`,
      `Interface: #${device._interfaceTarget ?? 0}`,
      `Endpoint OUT: #${endpointOut}`,
      `Tamanho: ${perfilFisico ? `${perfilFisico.widthMm}x${perfilFisico.heightMm}` : tamanho}`,
      `GAP: ${perfilFisico?.gapMm ?? 2} mm`,
      `Bytes gerados: ${bytesGerados}`,
      `Bytes enviados: ${bytesEnviados}`,
      `Status: ${status}`
    ].join("\\n");

    if (status !== "ok" || bytesEnviados === 0) {
      throw new Error(`Falha no envio da etiqueta.\\n\\nDiagnóstico:\\n${diagnostico}`);
    }

    console.log("[ETIQUETA][MDK022] impressão finalizada");
    if (onStatusChange) onStatusChange("Etiqueta enviada para MDK-022.");
    
    return {
      ok: true,
      bytes: bytesEnviados,
      status: status,
      vendorId: device.vendorId,
      productId: device.productId,
      interfaceNumber: device._interfaceTarget ?? 0,
      endpointNumber: endpointOut,
      diagnostico
    };
  } catch (err) {
    console.error("[ETIQUETA][MDK022] Erro na transmissão WebUSB MDK-022:", err.message || err);
    throw err;
  }
}


/**
 * Envia uma fila completa de etiquetas em lote para a MDK-022 via WebUSB em uma única conexão contínua.
 *
 * @param {Object} params
 * @param {Array} params.fila Fila de itens a imprimir
 * @param {string} params.tamanho Tamanho ("60x40", etc.)
 * @param {Object} params.responsavel Responsável que está etiquetando
 * @param {Object} params.unidadeInfo Informações da unidade ERP
 * @param {string} params.setor Setor ("cozinha" ou "bar")
 * @param {Date} params.momento Data/hora da manipulação
 * @param {Function} params.onStatusChange Callback para atualização de progresso na interface
 * @param {Object} params.perfilFisico Perfil físico customizado
 * @returns {Promise<{ ok: boolean, processadas: number, total: number, erro?: string }>}
 */
export async function imprimirFilaMdk022Usb({
  fila = [],
  tamanho = "60x40",
  responsavel,
  unidadeInfo,
  setor = "cozinha",
  momento = new Date(),
  onStatusChange,
  perfilFisico = null
}) {
  if (!Array.isArray(fila) || fila.length === 0) {
    throw new Error("A fila de etiquetas está vazia.");
  }

  const totalEtiquetas = fila.reduce((acc, p) => acc + Math.max(1, Math.floor(Number(p.copias) || 1)), 0);

  if (onStatusChange) onStatusChange("Conectando à MDK-022...");
  
  if (typeof gerarComandosTsplMdk022 !== 'function') {
    throw new Error("ERRO PRINCIPAL: gerarComandosTsplMdk022 is not defined ou não é uma função.");
  }

  // Conecta uma ÚNICA vez via WebUSB
  const device = await obterDispositivoMdk022();
  const endpointOut = device._endpointOutNumber || 2;

  let processadas = 0;
  const nomeResponsavel = (responsavel?.nome || responsavel || "").toUpperCase().trim();
  const nomeUnidade = (unidadeInfo?.nome_fantasia || unidadeInfo?.nome || "SELDEESTRELA COMIDAS NORTISTAS").toUpperCase().trim();
  const lotePadrao = setor === "bar" ? "BAR" : "COZINHA";

  const validadeDe = (mom, dias) => new Date(mom.getTime() + Math.max(0, Number(dias) || 0) * 86400000);

  for (let i = 0; i < fila.length; i++) {
    const item = fila[i];
    const copiasItem = Math.max(1, Math.floor(Number(item.copias) || 1));

    if (onStatusChange) {
      onStatusChange(`Imprimindo etiqueta ${processadas + 1} de ${totalEtiquetas}...`);
    }

    const dadosEtiqueta = {
      ...item,
      produto: item.nome || item.produto,
      unidadeNome: nomeUnidade,
      momento: momento || new Date(),
      validade: item.validade ? new Date(item.validade) : validadeDe(momento, item.dias || 3),
      responsavel: nomeResponsavel,
      lote: item.lote || lotePadrao,
    };

    const buffer = gerarComandosTsplMdk022({
      dados: dadosEtiqueta,
      tamanho,
      copias: copiasItem,
      perfilFisico
    });

    const bytesGerados = buffer.length;
    if (bytesGerados === 0) {
      throw new Error(`Nenhum byte gerado pelos comandos TSPL para a etiqueta ${i + 1}.`);
    }

    try {
      const resultado = await device.transferOut(endpointOut, buffer);
      const bytesEnviados = resultado.bytesWritten ?? 0;
      const status = resultado.status;

      if (status !== "ok" || bytesEnviados === 0) {
        throw new Error(`Impressora respondeu com status: ${status}. Bytes enviados: ${bytesEnviados}`);
      }
      processadas += copiasItem;
    } catch (errTransfer) {
      const msgErro = errTransfer?.message || String(errTransfer);
      console.error(`[ETIQUETA][MDK022] Erro na transmissão no lote (item ${i + 1}):`, msgErro);
      return {
        ok: false,
        processadas,
        total: totalEtiquetas,
        erro: `Impressão interrompida na etiqueta ${processadas + 1} de ${totalEtiquetas}. Erro: ${msgErro}`,
      };
    }
  }

  if (onStatusChange) {
    onStatusChange(`✓ ${totalEtiquetas} etiquetas enviadas para MDK-022`);
  }

  return {
    ok: true,
    processadas: totalEtiquetas,
    total: totalEtiquetas,
  };
}
