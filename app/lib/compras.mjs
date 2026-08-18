// COMPRAS DO MÊS — a conta de quanto entrou de mercadoria.
// A compra não é digitada duas vezes: ela é a própria entrada de estoque.
// Cada entrada vale quantidade × custo do ingrediente, e o estoque em que ela
// caiu define a categoria (cozinha, bar, embalagens, limpeza, materiais).

export const CATEGORIAS_COMPRA = [
  "Cozinha", "Bar", "Embalagens", "Limpeza", "Materiais gerais", "Outros",
];

const POR_SLUG = {
  "cozinha": "Cozinha",
  "pre-preparos-cozinha": "Cozinha",
  "bar": "Bar",
  "pre-preparos-bar": "Bar",
  "embalagens-cozinha": "Embalagens",
  "embalagens-bar": "Embalagens",
  "limpeza": "Limpeza",
  "materiais-variados": "Materiais gerais",
  "deposito": "Materiais gerais",
};

const semAcento = (v) => {
  const d = String(v || "").normalize("NFD");
  let out = "";
  for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
  return out.toLowerCase().trim();
};

export function categoriaDaCompra(movimento, estoques = []) {
  const estoque = estoques.find(e => e.id === movimento?.estoque_id);
  const slug = String(estoque?.slug || movimento?.estoque?.slug || "").toLowerCase();
  if (POR_SLUG[slug]) return POR_SLUG[slug];
  // Estoque criado pelo usuário: decide pelo nome.
  const nome = semAcento(estoque?.nome || movimento?.estoque?.nome);
  if (nome.includes("embalagem")) return "Embalagens";
  if (nome.includes("limpeza")) return "Limpeza";
  if (nome.includes("bar") || nome.includes("bebida")) return "Bar";
  if (nome.includes("cozinha") || nome.includes("aliment")) return "Cozinha";
  if (nome.includes("material") || nome.includes("deposito")) return "Materiais gerais";
  return "Outros";
}

// Quanto custou aquela entrada. O custo vem do ingrediente: é o preço que a
// casa paga hoje por ele.
export function valorDaCompra(movimento) {
  const qtd = Number(movimento?.quantidade) || 0;
  const custo = Number(movimento?.insumo?.custo_compra ?? movimento?.insumo?.custo_unitario) || 0;
  return qtd * custo;
}

// Só entrada conta como compra: baixa, contagem e transferência não são gasto.
export const ehCompra = (m) => m?.tipo === "entrada";

// ── Períodos ────────────────────────────────────────────────────────────────
const p2 = (n) => String(n).padStart(2, "0");
export const isoData = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// modo: "dia" | "semana" | "mes" | "meses" (vários meses seguidos)
export function faixaCompras(referencia, modo, mesesJuntos = 3) {
  const base = new Date(referencia);
  base.setHours(0, 0, 0, 0);
  if (modo === "dia") return { de: new Date(base), ate: new Date(base) };
  if (modo === "semana") {
    const de = new Date(base);
    de.setDate(base.getDate() - base.getDay());
    const ate = new Date(de);
    ate.setDate(de.getDate() + 6);
    return { de, ate };
  }
  if (modo === "meses") {
    const quantos = Math.max(1, Number(mesesJuntos) || 1);
    return {
      de: new Date(base.getFullYear(), base.getMonth() - (quantos - 1), 1),
      ate: new Date(base.getFullYear(), base.getMonth() + 1, 0),
    };
  }
  return {
    de: new Date(base.getFullYear(), base.getMonth(), 1),
    ate: new Date(base.getFullYear(), base.getMonth() + 1, 0),
  };
}

export function andarPeriodo(referencia, modo, passo, mesesJuntos = 3) {
  const d = new Date(referencia);
  if (modo === "dia") d.setDate(d.getDate() + passo);
  else if (modo === "semana") d.setDate(d.getDate() + passo * 7);
  else if (modo === "meses") d.setMonth(d.getMonth() + passo * Math.max(1, Number(mesesJuntos) || 1));
  else d.setMonth(d.getMonth() + passo);
  return d;
}

export function rotuloPeriodo({ de, ate }, modo) {
  const curta = (d) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (modo === "dia") return de.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  if (modo === "semana") return `${curta(de)} a ${curta(ate)}`;
  if (modo === "meses") {
    const mes = (d) => d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    return `${mes(de)} até ${mes(ate)}`;
  }
  return de.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

// Soma por categoria, do maior para o menor.
export function totaisPorCategoria(compras, estoques = []) {
  const mapa = new Map(CATEGORIAS_COMPRA.map(c => [c, { total: 0, itens: 0 }]));
  compras.forEach(m => {
    const cat = categoriaDaCompra(m, estoques);
    const alvo = mapa.get(cat) || { total: 0, itens: 0 };
    alvo.total += valorDaCompra(m);
    alvo.itens += 1;
    mapa.set(cat, alvo);
  });
  return [...mapa.entries()]
    .filter(([, v]) => v.itens > 0)
    .sort((a, b) => b[1].total - a[1].total);
}
