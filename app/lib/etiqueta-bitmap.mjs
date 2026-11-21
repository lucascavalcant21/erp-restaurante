// Lê o BITMAP dos comandos TSPL da MDK-022 e devolve os pixels pretos, para a
// prévia na tela mostrar exatamente o que a impressora recebe.

/** { x, y, larguraBytes, altura, inicio } do primeiro BITMAP, ou null. */
export function lerBitmapTspl(bytes) {
  const texto = new TextDecoder("latin1").decode(bytes);
  const i = texto.indexOf("BITMAP ");
  if (i < 0) return null;
  const fimCab = texto.indexOf(",0,", i);
  if (fimCab < 0) return null;
  const [x, y, larguraBytes, altura] = texto.slice(i + 7, fimCab).split(",").map(Number);
  if (![x, y, larguraBytes, altura].every(Number.isFinite)) return null;
  return { x, y, larguraBytes, altura, inicio: fimCab + 3 };
}

/** Pinta de preto, em `rgba` (largura x altura, RGBA), os pontos do bitmap (0 = preto no TSPL). */
export function pintarBitmap(bytes, bmp, rgba, largura, altura) {
  for (let r = 0; r < bmp.altura; r++) {
    for (let c = 0; c < bmp.larguraBytes * 8; c++) {
      const byte = bytes[bmp.inicio + r * bmp.larguraBytes + (c >> 3)];
      if ((byte >> (7 - (c & 7))) & 1) continue;
      const px = bmp.x + c, py = bmp.y + r;
      if (px >= largura || py >= altura) continue;
      const k = (py * largura + px) * 4;
      rgba[k] = 0; rgba[k + 1] = 0; rgba[k + 2] = 0;
    }
  }
  return rgba;
}
