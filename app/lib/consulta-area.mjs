// Busca da equipe (pedido do dono, 05/11/2026): quem é da cozinha ou do bar acha
// ficha, montagem e cardápio sem editar nada. Tudo passa por estas listas de
// campos, para custo e margem nunca chegarem à tela.

export const AREAS_DA_EQUIPE = { cozinha: "Cozinha", bar: "Bar" };

export const areaValida = (valor) => (Object.hasOwn(AREAS_DA_EQUIPE, valor) ? valor : "");

const semAcento = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export const chaveDoNome = semAcento;

export function fichaParaConsulta(ficha = {}, montagem = null) {
  const daTabela = [...(ficha.fichas_montagem_passos || [])].sort((a, b) => Number(a.ordem) - Number(b.ordem)).map((p) => p.descricao);
  const daFicha = Array.isArray(ficha.montagem_sequencia) ? ficha.montagem_sequencia.map((p) => (typeof p === "string" ? p : p?.descricao || p?.texto || "")) : [];
  const passos = (daTabela.length ? daTabela : daFicha).filter(Boolean);
  return {
    id: `ficha:${ficha.id}`,
    tipo: ficha.eh_base ? "Pré-preparo" : "Ficha técnica",
    nome: ficha.nome_comercial || ficha.nome_receita || "",
    categoria: ficha.categoria || "",
    foto: ficha.imagem || ficha.montagem_foto || montagem?.foto_url || "",
    descricao: ficha.descricao_comercial || ficha.descricao || "",
    rendimento: ficha.rendimento_porcoes ? `${ficha.rendimento_porcoes} ${ficha.rendimento_unidade || "porções"}` : "",
    validadeDias: ficha.validade_dias || null,
    ingredientes: (ficha.fichas_ingredientes || []).map((i) => ({
      nome: i.insumos?.nome || i.subficha?.nome_receita || "",
      quantidade: i.quantidade ?? null,
      unidade: i.insumos?.unidade_medida || "",
    })).filter((i) => i.nome),
    preparo: ficha.modo_preparo || "",
    montagem: passos.length ? passos.join("\n") : montagem?.descritivo || "",
    alergenicos: ficha.alergenicos_pode_conter || "",
    copo: ficha.copo || "",
    gelo: ficha.tipo_gelo || "",
    guarnicao: ficha.guarnicao || "",
  };
}

export function produtoParaConsulta(produto = {}) {
  return {
    id: `produto:${produto.id}`,
    fichaId: produto.ficha_id ? `ficha:${produto.ficha_id}` : "",
    tipo: "Cardápio",
    nome: produto.nome_produto || "",
    categoria: produto.categoria || "",
    foto: produto.imagem_url || "",
    preco: Number(produto.preco_venda) > 0 ? Number(produto.preco_venda) : null,
    ingredientes: [],
  };
}

/** Junta ficha, montagem e cardápio. O produto com ficha aparece só na ficha, com o preço dela. */
export function montarConsulta({ fichas = [], montagens = [], produtos = [] } = {}) {
  const porNome = new Map(montagens.map((m) => [semAcento(m.nome), m]));
  const lista = fichas.map((f) => fichaParaConsulta(f, porNome.get(semAcento(f.nome_receita))));
  const indice = new Map(lista.flatMap((i) => [[semAcento(i.nome), i], [i.id, i]]));
  for (const p of produtos) {
    if (p.ativo === false || !p.nome_produto) continue;
    const item = produtoParaConsulta(p);
    const ficha = indice.get(item.fichaId) || indice.get(semAcento(item.nome));
    if (ficha) { ficha.preco = item.preco; continue; }
    lista.push(item);
    indice.set(semAcento(item.nome), item);
  }
  return lista.filter((i) => i.nome).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Todas as palavras precisam aparecer: no nome, na categoria ou nos ingredientes. */
export function buscarNaConsulta(lista = [], termo = "") {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  if (!palavras.length) return lista;
  return lista.filter((i) => {
    const alvo = semAcento([i.nome, i.categoria, i.tipo, ...i.ingredientes.map((x) => x.nome)].join(" "));
    return palavras.every((p) => alvo.includes(p));
  });
}

// ─── Anotações ─────────────────────────────────────────────────────────────

export const diaIso = (data = new Date(), somaDias = 0) => {
  const d = new Date(data);
  d.setDate(d.getDate() + somaDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function validarAnotacao({ tipo, texto, quantidade, quem } = {}) {
  if (!["producao", "compra"].includes(tipo)) return "Escolha o tipo da anotação.";
  const limpo = String(texto || "").trim();
  if (!limpo) return tipo === "compra" ? "Escreva o que precisa comprar." : "Escreva o que vai ser produzido.";
  if (limpo.length > 300) return "Use até 300 letras.";
  if (quantidade !== "" && quantidade !== null && quantidade !== undefined && !(Number(quantidade) > 0)) return "A quantidade precisa ser maior que zero.";
  if (!String(quem || "").trim()) return "Escolha quem está anotando.";
  return null;
}

/** Abertas primeiro; no dia, a mais antiga no topo. */
export function ordenarAnotacoes(lista = []) {
  return [...lista].sort((a, b) => (a.status === b.status ? 0 : a.status === "aberta" ? -1 : 1)
    || String(a.para_dia).localeCompare(String(b.para_dia))
    || String(a.created_at).localeCompare(String(b.created_at)));
}
