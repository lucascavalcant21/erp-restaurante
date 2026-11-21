"use client";

// Prévia da etiqueta 60x40 desenhada pelo MESMO código que vai para a
// impressora MDK-022 (gerarComandosTsplMdk022): o que aparece na tela é o que
// sai no papel (pedido do dono, 21/11/2026, depois dos modelos sem QR Code,
// "aberto" com faixas pretas e "fechado" com letras maiores).

import { useEffect, useState } from "react";
import { gerarComandosTsplMdk022 } from "../../lib/impressaoMdk022";
import { lerBitmapTspl, pintarBitmap } from "../../lib/etiqueta-bitmap.mjs";

const LARGURA = 480; // 60 mm a 203 dpi
const ALTURA = 320;  // 40 mm a 203 dpi

export default function PreviaEtiqueta60x40({ dados, largura = "60mm", altura = "40mm", className = "", style }) {
  // Imagem (e não canvas) para a fila de impressão e a confirmação, que
  // copiam a prévia como HTML, levarem o desenho junto.
  const [src, setSrc] = useState("");
  const chave = JSON.stringify(dados || {});

  useEffect(() => {
    if (typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.width = LARGURA;
    canvas.height = ALTURA;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(LARGURA, ALTURA);
    img.data.fill(255);
    try {
      const bytes = gerarComandosTsplMdk022({ dados: JSON.parse(chave), tamanho: "60x40", copias: 1 });
      const bmp = lerBitmapTspl(bytes);
      if (bmp) pintarBitmap(bytes, bmp, img.data, LARGURA, ALTURA);
    } catch {
      // sem desenho: fica a etiqueta em branco
    }
    ctx.putImageData(img, 0, 0);
    setSrc(canvas.toDataURL("image/png"));
  }, [chave]);

  const estilo = { width: largura, height: altura, display: "block", background: "#fff", imageRendering: "pixelated", ...style };
  if (!src) return <div className={className} style={estilo} aria-hidden="true" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={`Etiqueta de ${dados?.produto || "produto"}`} className={className} style={estilo} />;
}
