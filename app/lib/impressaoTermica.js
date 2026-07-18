"use client";

// Perfis medidos fisicamente na EPSON TM-T20 deste computador (203 dpi).
// O corte fica deliberadamente desligado: a bobina adesiva precisa de uma
// calibração separada da distância entre a cabeça e a guilhotina.
export const PERFIS_TP20 = {
  // Bobina contínua de 80 mm (cabeça imprime 72 mm = 576 pontos), altura 40 mm.
  // Sem vão: bobina corrida — o comprimento é definido pelo conteúdo.
  "80x40": {
    id: "t20-80x40-v1",
    larguraPontos: 576,
    alturaPontos: 320,
    xConteudo: 0,
    larguraConteudo: 576,
    gapPontos: 0,
    descricao: "bobina 80 mm (72 mm úteis) × 40 mm",
  },
  "60x40": {
    id: "t20-60x40-v1",
    larguraPontos: 576,
    alturaPontos: 320,
    xConteudo: 48,
    larguraConteudo: 528,
    gapPontos: 16,
    descricao: "66 mm úteis × 40 mm · vão de 2 mm",
  },
  "60x60": {
    id: "t20-60x60-v1",
    larguraPontos: 576,
    alturaPontos: 480,
    xConteudo: 64,
    larguraConteudo: 480,
    gapPontos: 16,
    descricao: "60 mm úteis × 60 mm · vão de 2 mm",
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

function criarComandosEscPos(perfil, raster, bytesPorLinha, copias) {
  const partes = [[0x1b, 0x40]]; // ESC @
  const xL = bytesPorLinha & 0xff;
  const xH = (bytesPorLinha >> 8) & 0xff;
  const yL = perfil.alturaPontos & 0xff;
  const yH = (perfil.alturaPontos >> 8) & 0xff;
  for (let i = 0; i < copias; i += 1) {
    partes.push([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    partes.push(raster);
    partes.push([0x1b, 0x4a, perfil.gapPontos]); // avanço fixo de 2 mm
  }
  const tamanho = partes.reduce((total, parte) => total + parte.length, 0);
  const saida = new Uint8Array(tamanho);
  let offset = 0;
  partes.forEach((parte) => {
    saida.set(parte, offset);
    offset += parte.length;
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

export async function imprimirEtiquetasTp20({ impressora, tamanho, copias, dados }) {
  const perfil = PERFIS_TP20[tamanho];
  if (!perfil) throw new Error("Perfil de etiqueta não configurado");
  const quantidade = Math.max(1, Math.min(100, Number(copias) || 1));
  const qz = await obterQz();
  if (!qz.websocket.isActive()) throw new Error("Conecte e autorize a impressora antes de imprimir");
  if (!impressora) throw new Error("Selecione a impressora térmica");

  const qrImagem = await carregarQrDaPrevia();
  const canvas = criarCanvasEtiqueta(perfil, dados, qrImagem);
  const { raster, bytesPorLinha } = canvasParaRaster(canvas);
  const comandos = criarComandosEscPos(perfil, raster, bytesPorLinha, quantidade);
  const config = qz.configs.create(impressora, {
    encoding: "ISO-8859-1",
    jobName: `ERP Etiquetas ${dados.codigo}`,
  });
  await qz.print(config, [{
    type: "raw",
    format: "command",
    flavor: "base64",
    data: bytesParaBase64(comandos),
  }]);
  return { perfil: perfil.id, copias: quantidade };
}
