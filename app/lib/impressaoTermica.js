"use client";

// Perfis medidos fisicamente na EPSON TM-T20/M249A deste computador (203 dpi).
// O sistema não envia comando de corte: a bobina adesiva precisa de uma
// calibração separada da distância entre a cabeça e a guilhotina.
const DPI_TMT20 = 203;
const MM_POR_POLEGADA = 25.4;

export const CALIBRACAO_PADRAO_TMT20 = Object.freeze({ gapMm: 2 });

function limitar(numero, minimo, maximo) {
  return Math.min(maximo, Math.max(minimo, numero));
}

export function mmParaPontosTmT20(valorMm) {
  const mm = Number(valorMm);
  if (!Number.isFinite(mm)) return 0;
  return Math.round((mm * DPI_TMT20) / MM_POR_POLEGADA);
}

export function normalizarCalibracaoTmT20(calibracao = {}) {
  const bruto = calibracao?.gapMm;
  const informado = bruto === "" || bruto == null ? Number.NaN : Number(bruto);
  const gapMm = Number.isFinite(informado)
    ? limitar(informado, 0, 10)
    : CALIBRACAO_PADRAO_TMT20.gapMm;
  return { gapMm, gapPontos: limitar(mmParaPontosTmT20(gapMm), 0, 255) };
}

export const PERFIS_TP20 = {
  "60x40": {
    id: "t20-60x40-v1",
    larguraPontos: 576,
    alturaPontos: 320,
    xConteudo: 48,
    larguraConteudo: 528,
    descricao: "66 mm úteis × 40 mm",
  },
  "60x60": {
    id: "t20-60x60-v1",
    larguraPontos: 576,
    alturaPontos: 480,
    xConteudo: 64,
    larguraConteudo: 480,
    descricao: "60 mm úteis × 60 mm",
  },
};

let qzCarregado;

async function obterQz() {
  if (!qzCarregado) {
    qzCarregado = import("qz-tray").then((modulo) => modulo.default || modulo);
  }
  return qzCarregado;
}

export async function conectarAssistenteImpressao(preferida = "") {
  const qz = await obterQz();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect({ retries: 2, delay: 1 });
  }
  const impressoras = await qz.printers.find();
  const lista = Array.isArray(impressoras) ? impressoras : [impressoras].filter(Boolean);
  const exata = lista.find((nome) => nome === preferida);
  const termica = lista.find((nome) => /TM-?T20|TP-?20|POS-?80|CELAK/i.test(nome));
  // Nunca selecionar uma impressora comum automaticamente para receber RAW.
  const nome = exata || termica || "";
  return { nome, impressoras: lista };
}

export async function listarImpressoras() {
  const qz = await obterQz();
  if (!qz.websocket.isActive()) throw new Error("Assistente de impressão desconectado");
  const resultado = await qz.printers.find();
  return Array.isArray(resultado) ? resultado : [resultado].filter(Boolean);
}

export async function desconectarAssistenteImpressao() {
  const qz = await obterQz();
  if (qz.websocket.isActive()) await qz.websocket.disconnect();
}

export async function observarAssistenteImpressao({ aoFechar, aoErro } = {}) {
  const qz = await obterQz();
  qz.websocket.setClosedCallbacks(() => aoFechar?.());
  qz.websocket.setErrorCallbacks((evento) => aoErro?.(evento));
}

export async function assistenteImpressaoAtivo() {
  const qz = await obterQz();
  return qz.websocket.isActive();
}

function textoLimitado(ctx, texto, largura) {
  const original = String(texto || "");
  if (ctx.measureText(original).width <= largura) return original;
  let valor = original;
  while (valor.length > 1 && ctx.measureText(`${valor}…`).width > largura) valor = valor.slice(0, -1);
  return `${valor}…`;
}

function desenharTexto(ctx, texto, x, y, largura, { fonte = 18, negrito = true, alinhar = "left" } = {}) {
  ctx.font = `${negrito ? 700 : 500} ${fonte}px Arial, sans-serif`;
  ctx.textAlign = alinhar;
  ctx.textBaseline = "top";
  const valor = textoLimitado(ctx, texto, largura);
  ctx.fillText(valor, x, y);
}

function desenharLinha(ctx, x1, y, x2, espessura = 3) {
  ctx.fillRect(x1, y, Math.max(1, x2 - x1), espessura);
}

async function carregarQrDaPrevia() {
  const svg = document.querySelector('[data-qr-etiqueta="true"]');
  if (!svg) throw new Error("O QR Code da etiqueta ainda não está pronto");
  const copia = svg.cloneNode(true);
  copia.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copia.setAttribute("width", svg.getAttribute("width") || "128");
  copia.setAttribute("height", svg.getAttribute("height") || "128");
  const xml = new XMLSerializer().serializeToString(copia);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    return await new Promise((resolve, reject) => {
      const imagem = new Image();
      imagem.onload = () => resolve(imagem);
      imagem.onerror = () => reject(new Error("Não foi possível preparar o QR Code"));
      imagem.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

function formatarData(data, comHora = false) {
  const d = data instanceof Date ? data : new Date(data);
  const p = (n) => String(n).padStart(2, "0");
  const dia = `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
  return comHora ? `${dia} ${p(d.getHours())}H${p(d.getMinutes())}` : dia;
}

function criarCanvasEtiqueta(perfil, dados, qrImagem) {
  const canvas = document.createElement("canvas");
  canvas.width = perfil.larguraPontos;
  canvas.height = perfil.alturaPontos;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.imageSmoothingEnabled = false;

  const alto = perfil.alturaPontos > 400;
  const x = perfil.xConteudo;
  const largura = perfil.larguraConteudo;
  const pad = alto ? 20 : 14;
  const esquerda = x + pad;
  const direita = x + largura - pad;
  const larguraInterna = direita - esquerda;

  const tituloFim = alto ? 70 : 48;
  desenharTexto(ctx, String(dados.produto || "PRODUTO").toUpperCase(), esquerda, alto ? 18 : 11, larguraInterna, { fonte: alto ? 35 : 27 });
  desenharLinha(ctx, esquerda, tituloFim, direita, alto ? 4 : 3);

  const infoY = alto ? 82 : 57;
  desenharTexto(ctx, String(dados.conservacao || "").toUpperCase(), esquerda, infoY, larguraInterna * 0.55, { fonte: alto ? 24 : 18 });
  desenharTexto(ctx, `PESO: ${dados.quantidade}${dados.unidade !== "UN" ? ` ${dados.unidade}` : ""}`, direita, infoY, larguraInterna * 0.45, { fonte: alto ? 24 : 18, alinhar: "right" });
  const infoFim = alto ? 116 : 84;
  desenharLinha(ctx, esquerda, infoFim, direita, alto ? 4 : 3);

  const dataY = alto ? 130 : 94;
  const fonteData = alto ? 22 : 17;
  const fechado = dados.tipoEtiqueta === "fechado" || dados.tipoEtiqueta === "dia";
  const rotuloData = fechado ? "ETIQUETADO:" : "MANIPULACAO:";
  const valorData = formatarData(dados.momento, !fechado);
  desenharTexto(ctx, rotuloData, esquerda, dataY, larguraInterna * 0.43, { fonte: fonteData });
  desenharTexto(ctx, valorData, direita, dataY, larguraInterna * 0.57, { fonte: fonteData, alinhar: "right" });
  if (fechado) {
    const faixaY = alto ? 159 : 116;
    const faixaH = alto ? 31 : 27;
    ctx.fillStyle = "#000";
    ctx.fillRect(esquerda, faixaY, larguraInterna, faixaH);
    ctx.fillStyle = "#fff";
    desenharTexto(ctx, `VAL: ${formatarData(dados.validade)}`, esquerda + 7, faixaY + 3, larguraInterna - 14, { fonte: alto ? 23 : 18 });
    ctx.fillStyle = "#000";
  } else {
    desenharTexto(ctx, "VALIDADE:", esquerda, dataY + (alto ? 31 : 24), larguraInterna * 0.43, { fonte: fonteData });
    desenharTexto(ctx, formatarData(dados.validade, true), direita, dataY + (alto ? 31 : 24), larguraInterna * 0.57, { fonte: fonteData, alinhar: "right" });
  }
  const datasFim = alto ? 194 : 146;
  desenharLinha(ctx, esquerda, datasFim, direita, alto ? 4 : 3);

  desenharTexto(ctx, `RESP.: ${String(dados.responsavel || "—").toUpperCase()}`, esquerda, alto ? 210 : 158, larguraInterna, { fonte: alto ? 22 : 17 });
  if (dados.lote) desenharTexto(ctx, `LOTE/SIF: ${dados.lote}`, esquerda, alto ? 240 : 181, larguraInterna, { fonte: alto ? 19 : 14 });

  const rodapeY = alto ? 300 : 210;
  desenharLinha(ctx, esquerda, rodapeY, direita, alto ? 4 : 3);
  const qr = alto ? 116 : 76;
  const qrX = direita - qr;
  const qrY = perfil.alturaPontos - pad - qr;
  ctx.drawImage(qrImagem, qrX, qrY, qr, qr);

  const textoRodapeW = Math.max(80, qrX - esquerda - 12);
  const unidade = String(dados.unidadeNome || "").toUpperCase();
  const cnpj = dados.cnpj ? `CNPJ ${dados.cnpj}` : "";
  const endereco = String(dados.endereco || "").toUpperCase();
  const localizacao = String(dados.localizacao || "").toUpperCase();
  const fonteRodape = alto ? 17 : 13;
  let y = rodapeY + (alto ? 12 : 8);
  [unidade, cnpj, endereco, localizacao, `#${dados.codigo}`].filter(Boolean).forEach((linha) => {
    desenharTexto(ctx, linha, esquerda, y, textoRodapeW, { fonte: fonteRodape });
    y += alto ? 23 : 17;
  });

  return canvas;
}

function criarCanvasTeste(perfil, calibracao, numero) {
  const canvas = document.createElement("canvas");
  canvas.width = perfil.larguraPontos;
  canvas.height = perfil.alturaPontos;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000";
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 4;

  const margem = 5;
  const esquerda = limitar(perfil.xConteudo + margem, margem, canvas.width - margem - 40);
  const largura = Math.max(40, Math.min(perfil.larguraConteudo - (margem * 2), canvas.width - esquerda - margem));
  ctx.strokeRect(esquerda, margem, largura, canvas.height - (margem * 2));

  ctx.setLineDash([10, 8]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(esquerda, Math.round(canvas.height / 2));
  ctx.lineTo(esquerda + largura, Math.round(canvas.height / 2));
  ctx.stroke();
  ctx.setLineDash([]);

  const etiqueta40 = perfil.id.includes("60x40");
  const tamanho = etiqueta40 ? "60 x 40 mm" : "60 x 60 mm";
  const alturaMm = etiqueta40 ? 40 : 60;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 32px Arial, sans-serif";
  ctx.fillText(`TESTE ${numero} DE 2`, esquerda + (largura / 2), canvas.height * 0.27);
  ctx.font = "700 24px Arial, sans-serif";
  ctx.fillText(`EPSON TM-T20 · ${tamanho}`, esquerda + (largura / 2), canvas.height * 0.43);
  ctx.font = "600 20px Arial, sans-serif";
  ctx.fillText(`PASSO: ${(alturaMm + calibracao.gapMm).toFixed(1)} mm`, esquerda + (largura / 2), canvas.height * 0.66);
  ctx.fillText("SEM COMANDO DE CORTE", esquerda + (largura / 2), canvas.height * 0.78);
  return canvas;
}

function canvasParaRaster(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const bytesPorLinha = Math.ceil(canvas.width / 8);
  const raster = new Uint8Array(bytesPorLinha * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const p = (y * canvas.width + x) * 4;
      const luminosidade = (pixels[p] * 0.299) + (pixels[p + 1] * 0.587) + (pixels[p + 2] * 0.114);
      if (pixels[p + 3] > 80 && luminosidade < 185) {
        raster[(y * bytesPorLinha) + Math.floor(x / 8)] |= (0x80 >> (x % 8));
      }
    }
  }
  return { raster, bytesPorLinha };
}

function criarComandosEscPos(perfil, raster, bytesPorLinha, copias, calibracao = {}) {
  const ajuste = normalizarCalibracaoTmT20(calibracao);
  const partes = [
    [0x1b, 0x40], // ESC @: inicializa a impressora
    [0x1d, 0x50, 0xcb, 0xcb], // GS P 203 203: unidade vertical exata de 1/203"
  ];
  const xL = bytesPorLinha & 0xff;
  const xH = (bytesPorLinha >> 8) & 0xff;
  const yL = perfil.alturaPontos & 0xff;
  const yH = (perfil.alturaPontos >> 8) & 0xff;
  for (let i = 0; i < copias; i += 1) {
    partes.push([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    partes.push(raster);
    if (ajuste.gapPontos > 0) partes.push([0x1b, 0x4a, ajuste.gapPontos]);
  }
  // Compatibilidade TM-T20/M249A: não enviar ESC i, ESC m ou GS V (corte).
  const tamanho = partes.reduce((total, parte) => total + parte.length, 0);
  const saida = new Uint8Array(tamanho);
  let offset = 0;
  partes.forEach((parte) => {
    saida.set(parte, offset);
    offset += parte.length;
  });
  return saida;
}

function juntarBytes(...blocos) {
  const tamanho = blocos.reduce((total, bloco) => total + bloco.length, 0);
  const saida = new Uint8Array(tamanho);
  let offset = 0;
  blocos.forEach((bloco) => {
    saida.set(bloco, offset);
    offset += bloco.length;
  });
  return saida;
}

function bytesParaBase64(bytes) {
  let binario = "";
  const bloco = 0x8000;
  for (let i = 0; i < bytes.length; i += bloco) {
    binario += String.fromCharCode(...bytes.subarray(i, Math.min(i + bloco, bytes.length)));
  }
  return btoa(binario);
}

async function enviarRaw({ impressora, comandos, jobName }) {
  const qz = await obterQz();
  if (!qz.websocket.isActive()) throw new Error("Conecte e autorize a impressora antes de imprimir");
  if (!impressora) throw new Error("Selecione a impressora térmica");
  const config = qz.configs.create(impressora, {
    encoding: "ISO-8859-1",
    jobName,
  });
  await qz.print(config, [{
    type: "raw",
    format: "command",
    flavor: "base64",
    data: bytesParaBase64(comandos),
  }]);
}

export async function imprimirEtiquetasTp20({ impressora, tamanho, copias, dados, calibracao }) {
  const perfil = PERFIS_TP20[tamanho];
  if (!perfil) throw new Error("Perfil de etiqueta não configurado");
  const quantidade = Math.max(1, Math.min(100, Number(copias) || 1));

  const qrImagem = await carregarQrDaPrevia();
  const canvas = criarCanvasEtiqueta(perfil, dados, qrImagem);
  const { raster, bytesPorLinha } = canvasParaRaster(canvas);
  const ajuste = normalizarCalibracaoTmT20(calibracao);
  const comandos = criarComandosEscPos(perfil, raster, bytesPorLinha, quantidade, ajuste);
  await enviarRaw({ impressora, comandos, jobName: `ERP Etiquetas ${dados.codigo}` });
  return { perfil: perfil.id, copias: quantidade, gapMm: ajuste.gapMm, comandoCorte: false };
}

export async function imprimirTesteTmT20({ impressora, tamanho, calibracao }) {
  const perfil = PERFIS_TP20[tamanho];
  if (!perfil) throw new Error("Perfil de etiqueta não configurado");
  const ajuste = normalizarCalibracaoTmT20(calibracao);
  const comandos = juntarBytes(...[1, 2].map((numero) => {
    const canvas = criarCanvasTeste(perfil, ajuste, numero);
    const { raster, bytesPorLinha } = canvasParaRaster(canvas);
    return criarComandosEscPos(perfil, raster, bytesPorLinha, 1, ajuste);
  }));
  await enviarRaw({ impressora, comandos, jobName: `Teste Epson TM-T20 ${tamanho}` });
  return { perfil: perfil.id, copias: 2, gapMm: ajuste.gapMm, comandoCorte: false };
}

export async function avancarPapelTmT20({ impressora, milimetros }) {
  const mm = limitar(Number(milimetros) || 0, 0, 20);
  const pontos = limitar(mmParaPontosTmT20(mm), 0, 255);
  if (pontos < 1) return { milimetros: 0, pontos: 0 };
  const comandos = Uint8Array.from([
    0x1b, 0x40,
    0x1d, 0x50, 0xcb, 0xcb,
    0x1b, 0x4a, pontos,
  ]);
  await enviarRaw({ impressora, comandos, jobName: `Avanço Epson TM-T20 ${mm}mm` });
  return { milimetros: mm, pontos, comandoCorte: false };
}
