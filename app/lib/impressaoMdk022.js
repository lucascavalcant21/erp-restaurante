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
  "80x40": {
    WIDTH_MM: 80,
    HEIGHT_MM: 40,
    WIDTH_DOTS: 640,
    HEIGHT_DOTS: 320,
    SAFE_LEFT: 20,
    SAFE_TOP: 16,
    MAX_TEXT_WIDTH: 430, // 640 - 20(left) - 170(QR) - 20(gap)
    QR_X: 460,
    QR_Y: 20,
    QR_CELL_SIZE: 4,
    CODE_X: 460,
    CODE_Y: 205,
  },
  "60x40": {
    WIDTH_MM: 60,
    HEIGHT_MM: 40,
    WIDTH_DOTS: 480,
    HEIGHT_DOTS: 320,
    SAFE_LEFT: 16,
    SAFE_TOP: 16,
    MAX_TEXT_WIDTH: 310,
    QR_X: 340,
    QR_Y: 20,
    QR_CELL_SIZE: 3,
    CODE_X: 340,
    CODE_Y: 190,
  },
  "60x60": {
    WIDTH_MM: 60,
    HEIGHT_MM: 60,
    WIDTH_DOTS: 480,
    HEIGHT_DOTS: 480,
    SAFE_LEFT: 20,
    SAFE_TOP: 20,
    MAX_TEXT_WIDTH: 300,
    QR_X: 330,
    QR_Y: 30,
    QR_CELL_SIZE: 4,
    CODE_X: 330,
    CODE_Y: 220,
  },
};

/**
 * Converte string JS (UTF-16) em Uint8Array codificado em Windows-1252 (CP1252).
 * Isso corrige os caracteres acentuados corrompidos em impressoras TSPL nativas.
 */
export function encodeCp1252(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      const map = {
        0x00C1: 0xC1, 0x00C0: 0xC0, 0x00C2: 0xC2, 0x00C3: 0xC3, 0x00C4: 0xC4, // Á À Â Ã Ä
        0x00E1: 0xE1, 0x00E0: 0xE0, 0x00E2: 0xE2, 0x00E3: 0xE3, 0x00E4: 0xE4, // á à â ã ä
        0x00C9: 0xC9, 0x00C8: 0xC8, 0x00CA: 0xCA, 0x00CB: 0xCB, // É È Ê Ë
        0x00E9: 0xE9, 0x00E8: 0xE8, 0x00EA: 0xEA, 0x00EB: 0xEB, // é è ê ë
        0x00CD: 0xCD, 0x00CC: 0xCC, 0x00CE: 0xCE, 0x00CF: 0xCF, // Í Ì Î Ï
        0x00ED: 0xED, 0x00EC: 0xEC, 0x00EE: 0xEE, 0x00EF: 0xEF, // í ì î ï
        0x00D3: 0xD3, 0x00D2: 0xD2, 0x00D4: 0xD4, 0x00D5: 0xD5, 0x00D6: 0xD6, // Ó Ò Ô Õ Ö
        0x00F3: 0xF3, 0x00F2: 0xF2, 0x00F4: 0xF4, 0x00F5: 0xF5, 0x00F6: 0xF6, // ó ò ô õ ö
        0x00DA: 0xDA, 0x00D9: 0xD9, 0x00DB: 0xDB, 0x00DC: 0xDC, // Ú Ù Û Ü
        0x00FA: 0xFA, 0x00F9: 0xF9, 0x00FB: 0xFB, 0x00FC: 0xFC, // ú ù û ü
        0x00C7: 0xC7, 0x00E7: 0xE7, // Ç ç
        0x00BA: 0xBA, 0x00AA: 0xAA, 0x00B0: 0xB0, // º ª °
      };
      if (map[code]) {
        bytes.push(map[code]);
      } else if (code <= 0xFF) {
        bytes.push(code);
      } else {
        const norm = str[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        bytes.push(norm.charCodeAt(0) < 128 ? norm.charCodeAt(0) : 63);
      }
    }
  }
  return new Uint8Array(bytes);
}

/**
 * Ajusta e divide o texto para caber perfeitamente na largura disponível sem cortar.
 */
export function formatarTextoFitted(texto, maxLarguraDots = 430, preferenciaFonte = "3") {
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
 * Converte os dados da etiqueta gerados pelo ERP em comandos TSPL.
 *
 * @param {Object} params
 * @param {Object} params.dados Dados completos da etiqueta (produto, conservacao, validade, etc.)
 * @param {string} params.tamanho Dimensão exata ("80x40", "60x40", "60x60", etc.)
 * @param {number} params.copias Quantidade de etiquetas a imprimir
 * @returns {string} String contendo todos os comandos TSPL finalizados com \r\n
 */
export function gerarComandosTsplMdk022({ dados, tamanho = "80x40", copias = 1 }) {
  const m = METRICAS_TAMANHO[tamanho] || METRICAS_TAMANHO["80x40"];

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
  add(`SIZE ${m.WIDTH_MM} mm,${m.HEIGHT_MM} mm`);
  add("GAP 2 mm,0 mm");
  add("DIRECTION 1");
  add("CODEPAGE 1252");
  add("CLS");

  // MODELO "SOMENTE NOME"
  if (modeloEtiqueta === "nome") {
    const fitNome = formatarTextoFitted(produto, m.WIDTH_DOTS - (m.SAFE_LEFT * 2), "4");
    if (unidadeNome) {
      add(`TEXT ${m.SAFE_LEFT},${m.SAFE_TOP},"2",0,1,1,"${unidadeNome.slice(0, 35)}"`);
    }
    let yCurrent = m.SAFE_TOP + 40;
    for (const linha of fitNome.linhas) {
      add(`TEXT ${m.SAFE_LEFT},${yCurrent},"${fitNome.fonte}",0,1,1,"${linha}"`);
      yCurrent += fitNome.fonte === "4" ? 36 : 28;
    }
    if (quantidade) {
      add(`TEXT ${m.SAFE_LEFT},${yCurrent + 10},"3",0,1,1,"QTD: ${quantidade}"`);
    }
    add(`PRINT ${Math.max(1, copias)},1`);
    return cmd;
  }

  // MODELO COMPLETO (VALIDADE) - ESTRUTURA PROFISSIONAL 80x40
  // 1. Nome da Empresa / Unidade
  add(`TEXT ${m.SAFE_LEFT},${m.SAFE_TOP},"2",0,1,1,"${unidadeNome.slice(0, 35)}"`);

  // 2. Nome do Produto (Destaque Principal de Texto)
  let y = m.SAFE_TOP + 26;
  const fitProd = formatarTextoFitted(produto, m.MAX_TEXT_WIDTH, "4");
  for (const linha of fitProd.linhas) {
    add(`TEXT ${m.SAFE_LEFT},${y},"${fitProd.fonte}",0,1,1,"${linha}"`);
    y += fitProd.fonte === "4" ? 34 : 26;
  }

  // 3. Conservação + Peso/Qtd + Lote
  let linhaDetalhes = `${conservacao}`;
  if (quantidade) linhaDetalhes += ` | ${quantidade}`;
  if (lote) linhaDetalhes += ` | ${lote}`;
  add(`TEXT ${m.SAFE_LEFT},${y},"2",0,1,1,"${linhaDetalhes}"`);
  y += 24;

  // 4. Data de Manipulação / Etiquetagem
  const labelManip = tipoEtiqueta === "aberto" ? "MANIP:" : "ETIQ:";
  add(`TEXT ${m.SAFE_LEFT},${y},"2",0,1,1,"${labelManip} ${dataManipulacao}"`);
  y += 26;

  // 5. Data de Validade (Destaque Fácil de Localizar na Cozinha)
  add(`TEXT ${m.SAFE_LEFT},${y},"3",0,1,1,"VAL:   ${dataValidade}"`);
  y += 32;

  // 6. Responsável (Ajuste automático para nomes longos como "CEDEINE DEL VALLE TABLANTE FLORES")
  if (responsavel) {
    const textoResp = `RESP: ${responsavel}`;
    const fitResp = formatarTextoFitted(textoResp, m.MAX_TEXT_WIDTH, "2");
    for (const linha of fitResp.linhas) {
      add(`TEXT ${m.SAFE_LEFT},${y},"${fitResp.fonte}",0,1,1,"${linha}"`);
      y += 22;
    }
  }

  // 7. QR Code Nativo TSPL para Rastreio (Canto Direito)
  if (codigo) {
    add(`QRCODE ${m.QR_X},${m.QR_Y},L,${m.QR_CELL_SIZE},A,0,"${urlRastreio}"`);
    add(`TEXT ${m.CODE_X},${m.CODE_Y},"2",0,1,1,"#${codigo}"`);
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
export async function imprimirEtiquetaMdk022Usb({ dados, tamanho = "80x40", copias = 1, onStatusChange }) {
  try {
    if (onStatusChange) onStatusChange("Conectando à MDK-022...");
    const device = await obterDispositivoMdk022();
    const endpointOut = device._endpointOutNumber || 2;

    const comandosTspl = gerarComandosTsplMdk022({ dados, tamanho, copias });
    const buffer = encodeCp1252(comandosTspl);

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
