// Ícones do cardápio digital, com os mesmos traços do protótipo aprovado
// (docs/cardapio-digital/telas). String = <path d>, { c: [cx, cy, r] } =
// círculo, { r: [x, y, w, h, rx] } = retângulo. `cheio` = preenchido.

const ICONES = {
  busca: [{ c: [11, 11, 7] }, "m20 20-3.5-3.5"],
  ampliar: [{ c: [11, 11, 7] }, "m20 20-3.5-3.5M11 8v6M8 11h6"],
  globo: [{ c: [12, 12, 9] }, "M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"],
  wifi: ["M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0", { c: [12, 19.5, 1] }],
  sino: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  estrela: ["M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"],
  alvo: [{ c: [12, 12, 8] }, { c: [12, 12, 3] }],
  livro: ["M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"],
  filtro: ["M3 5h18M6 12h12M10 19h4"],
  seta: ["M5 12h14M13 6l6 6-6 6"],
  voltar: ["M15 6l-6 6 6 6"],
  fechar: ["M6 6l12 12M18 6 6 18"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  alerta: ["M12 3 2 20h20L12 3z", "M12 10v4M12 17h.01"],
  relogio: [{ c: [12, 13, 8] }, "M12 9v4l2.5 2M9.5 2.5h5"],
  info: [{ c: [12, 12, 9] }, "M12 11v5M12 8v.5"],
  lua: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"],
  brilho: ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"],
  video: [{ r: [3, 5, 18, 14, 2] }, "m10 9 5 3-5 3z"],
  casa: ["M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"],
  pedidos: ["M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"],
  lapis: ["M4 20h4L19 9l-4-4L4 16v4z", "M14 6l4 4"],
  lixeira: ["M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"],
  descontos: ["M3 12V4h8l10 10-8 8zM7.5 8h.01"],
  perfil: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0"],
};
const CHEIOS = {
  play: ["M7 4v16l13-8z"],
  pimenta: ["M14 3c0 1.5 1 2.5 2 3 3 1 4 4 3 7-1.5 4.5-7 8-13 8 0-3 3-4 5-7 2-3 1-6 3-8 .5-.5 0-2 0-3z"],
};

export const NOMES_ICONES = [...Object.keys(ICONES), ...Object.keys(CHEIOS)];

function desenho(partes) {
  return partes.map((p, i) => {
    if (typeof p === "string") return <path key={i} d={p} />;
    if (p.c) return <circle key={i} cx={p.c[0]} cy={p.c[1]} r={p.c[2]} />;
    return <rect key={i} x={p.r[0]} y={p.r[1]} width={p.r[2]} height={p.r[3]} rx={p.r[4]} />;
  });
}

export default function Icone({ nome, tamanho = 18, traco = 2, className, style }) {
  if (CHEIOS[nome]) {
    return (
      <svg aria-hidden="true" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="currentColor" className={className} style={style}>
        {desenho(CHEIOS[nome])}
      </svg>
    );
  }
  const partes = ICONES[nome];
  if (!partes) return null;
  return (
    <svg aria-hidden="true" width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={traco} strokeLinecap="round" strokeLinejoin="round" className={className} style={style}>
      {desenho(partes)}
    </svg>
  );
}
