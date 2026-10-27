// MATERIAIS DA CASA: LIMPEZA, MÁQUINA DE LAVAR E EMBALAGENS (regras puras,
// testadas em materiais.test.mjs). Pedido do dono, 27/10/2026: "cadastro de
// produtos de limpeza, produtos da máquina de lavar (bar e cozinha) e
// embalagens, e cada um terá seu estoque".
//
// Nada paralelo: o produto é um insumo (departamento limpeza, maquina ou
// embalagens) e o saldo é o do estoque unificado (estoque_itens por local),
// movido só por estoque_movimentar. Cada grupo tem os seus locais.

export const GRUPOS_MATERIAIS = [
  {
    id: "limpeza",
    rotulo: "Limpeza",
    titulo: "Produtos de limpeza",
    rota: "/dashboard/operacao/materiais/limpeza",
    departamento: "limpeza",
    descricao: "Detergente, desinfetante, sabão, esponja, pano e o resto da faxina.",
    locais: [{ slug: "limpeza", rotulo: "Limpeza" }],
    categorias: ["Detergentes", "Desinfetantes", "Sabões", "Esponjas e panos", "Papéis", "Sacos de lixo", "Outros materiais"],
    unidades: ["un", "L", "ml", "kg", "g", "rolo", "pct", "cx"],
  },
  {
    id: "maquina",
    rotulo: "Máquina de lavar",
    titulo: "Produtos da máquina de lavar",
    rota: "/dashboard/operacao/materiais/maquina",
    departamento: "maquina",
    descricao: "Produtos da lava-louças: detergente, secante, sanitizante e desincrustante. Estoque separado da cozinha e do bar.",
    locais: [
      { slug: "maquina-cozinha", rotulo: "Máquina da Cozinha" },
      { slug: "maquina-bar", rotulo: "Máquina do Bar" },
    ],
    categorias: ["Detergente de máquina", "Secante", "Sanitizante", "Desincrustante", "Sal regenerador", "Outros"],
    unidades: ["L", "ml", "un", "kg", "g", "galão"],
  },
  {
    id: "embalagens",
    rotulo: "Embalagens",
    titulo: "Embalagens",
    rota: "/dashboard/operacao/materiais/embalagens",
    departamento: "embalagens",
    descricao: "Potes, marmitas, sacolas, copos e tampas do delivery e da marmitaria.",
    locais: [
      { slug: "embalagens-cozinha", rotulo: "Embalagens da Cozinha" },
      { slug: "embalagens-bar", rotulo: "Embalagens do Bar" },
      { slug: "embalagens-marmitaria", rotulo: "Embalagens da Marmitaria" },
    ],
    categorias: ["Potes", "Marmitas", "Sacolas", "Copos", "Tampas", "Talheres descartáveis", "Etiquetas", "Outros"],
    unidades: ["un", "pct", "cx", "rolo"],
  },
];

export const grupoMaterial = (id) => GRUPOS_MATERIAIS.find((g) => g.id === id) || null;

const texto = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const numero = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

/**
 * Confere o cadastro de um produto antes de gravar.
 * @returns {{ ok: true, produto } | { ok: false, erros: Record<string,string> }}
 */
export function validarMaterial(grupoId, form) {
  const grupo = grupoMaterial(grupoId);
  const erros = {};
  if (!grupo) return { ok: false, erros: { grupo: "Escolha limpeza, máquina de lavar ou embalagens." } };
  const nome = texto(form?.nome, 80);
  if (nome.length < 2) erros.nome = "Digite o nome do produto.";
  const categoria = grupo.categorias.includes(form?.categoria) ? form.categoria : grupo.categorias[grupo.categorias.length - 1];
  const unidade = grupo.unidades.includes(form?.unidade) ? form.unidade : grupo.unidades[0];
  const local = grupo.locais.some((l) => l.slug === form?.local) ? form.local : null;
  if (!local) erros.local = "Escolha em qual estoque ele fica.";
  const minimo = numero(form?.minimo);
  if (Number.isNaN(minimo) || (minimo != null && minimo < 0)) erros.minimo = "Mínimo inválido.";
  const custo = numero(form?.custo);
  if (Number.isNaN(custo) || (custo != null && custo < 0)) erros.custo = "Custo inválido.";
  if (Object.keys(erros).length) return { ok: false, erros };
  return { ok: true, produto: { nome, categoria, unidade, local, minimo: minimo ?? 0, custo: custo ?? 0, departamento: grupo.departamento } };
}

/**
 * Situação de cada produto em cada local do grupo, a partir dos itens do
 * estoque (estoque_itens com o slug do local). Sem item no local = não está
 * nesse estoque (não é "zero").
 * @param {Array} insumos [{ id, nome, categoria, unidade_medida }]
 * @param {Array} itens   [{ insumo_id, quantidade_atual, estoque_minimo, estoque_slug }]
 */
export function situacaoDosMateriais(grupoId, insumos, itens) {
  const grupo = grupoMaterial(grupoId);
  if (!grupo) return [];
  const slugs = new Set(grupo.locais.map((l) => l.slug));
  const porInsumo = new Map();
  for (const it of itens || []) {
    if (!slugs.has(it.estoque_slug)) continue;
    if (!porInsumo.has(it.insumo_id)) porInsumo.set(it.insumo_id, []);
    porInsumo.get(it.insumo_id).push(it);
  }
  return (insumos || []).map((ins) => {
    const locais = grupo.locais
      .map((l) => {
        const it = (porInsumo.get(ins.id) || []).find((x) => x.estoque_slug === l.slug);
        if (!it) return null;
        const saldo = Number(it.quantidade_atual) || 0;
        const minimo = Number(it.estoque_minimo) || 0;
        const estado = saldo <= 0 ? "zerado" : minimo > 0 && saldo < minimo ? "baixo" : "ok";
        return { slug: l.slug, rotulo: l.rotulo, saldo, minimo, estado, estoque_item_id: it.id || null };
      })
      .filter(Boolean);
    const pior = locais.some((l) => l.estado === "zerado") ? "zerado" : locais.some((l) => l.estado === "baixo") ? "baixo" : locais.length ? "ok" : "sem_estoque";
    return { ...ins, locais, estado: pior };
  }).sort((a, b) => ORDEM_ESTADO[a.estado] - ORDEM_ESTADO[b.estado] || String(a.nome).localeCompare(String(b.nome), "pt-BR"));
}
const ORDEM_ESTADO = { zerado: 0, baixo: 1, sem_estoque: 2, ok: 3 };

/** Totais do grupo para o topo da tela. */
export function resumoDosMateriais(lista) {
  const r = { total: 0, zerados: 0, baixos: 0 };
  for (const p of lista || []) {
    r.total++;
    if (p.estado === "zerado") r.zerados++;
    else if (p.estado === "baixo") r.baixos++;
  }
  return r;
}
