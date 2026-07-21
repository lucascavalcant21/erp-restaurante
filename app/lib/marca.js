// Logo "Seldeestrela" para os cabeçalhos impressos (livro de receitas, fichas,
// guias). Recriada como SVG embutido — sem a linha "Comidas Nortistas" — para
// funcionar em qualquer impressão sem depender de arquivo/fonte externa.
// Verde da marca com a estrela vermelha no canto, como no logo original.
export function logoSeldeestrelaSVG(altura = 46) {
  const w = altura * 4.6;
  return `<svg viewBox="0 0 460 100" width="${w}" height="${altura}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Seldeestrela" style="display:block">
    <text x="8" y="70" font-family="'Segoe Script','Brush Script MT','Lucida Handwriting',cursive" font-size="66" font-weight="700" fill="#1f7a33" font-style="italic">Seldeestrela</text>
    <path fill="#c62828" d="M430 8 l6.5 13.2 14.6 2.1 -10.6 10.3 2.5 14.5 -13-6.9 -13 6.9 2.5-14.5 -10.6-10.3 14.6-2.1z"/>
  </svg>`;
}

// Versão em bloco, centralizada, para capas e cabeçalhos.
export function logoSeldeestrelaHTML(altura = 46) {
  return `<div class="marca-seldeestrela" style="display:flex;justify-content:center;align-items:center">${logoSeldeestrelaSVG(altura)}</div>`;
}
