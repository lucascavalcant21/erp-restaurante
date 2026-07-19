"use client";

// Comprime uma foto antes de mandar para as rotas de IA: celulares tiram fotos
// de 5-10MB, que estouram o limite de ~4,5MB do corpo da requisição na Vercel e
// faziam a leitura "sempre dar erro". Reduz para no máximo 1800px (nitidez
// suficiente para ler papel/cardápio) em JPEG 85%. Retorna o base64 puro.
export function comprimirFotoParaIA(file, maxLado = 1800, qualidade = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          let w = img.width, h = img.height;
          if (w > h && w > maxLado) { h = Math.round((h * maxLado) / w); w = maxLado; }
          else if (h > maxLado) { w = Math.round((w * maxLado) / h); h = maxLado; }
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", qualidade).split(",")[1] || "");
        } catch {
          resolve(String(ev.target.result).split(",")[1] || "");
        }
      };
      img.onerror = () => resolve(String(ev.target.result).split(",")[1] || "");
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
