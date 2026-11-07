// OBSERVAÇÕES PRONTAS (pedido do dono, 07/11/2026)
//
// Botões que o garçom toca no item ("Sem cebola", "Sem gelo") em vez de
// digitar. Organizadas por setor (cozinha, bar) e por categoria do produto
// (ex.: Carnes: "Mal passada", "Ao ponto"). O texto livre continua valendo:
// as prontas entram no mesmo campo de observação, separadas por vírgula.
// Ficam em config_sistema.params.observacoes_prontas da unidade.

export const OBSERVACOES_PADRAO = {
  setor: {
    cozinha: ["Sem cebola", "Sem pimenta", "Sem sal", "Sem molho", "Bem passado", "Para viagem"],
    bar: ["Sem gelo", "Pouco gelo", "Sem açúcar", "Com adoçante", "Com limão", "Gelo à parte"],
  },
  categoria: {},
};

export const LIMITE_POR_LISTA = 20;
export const LIMITE_DO_TEXTO = 40;

const chaveDe = (t) => String(t || "").trim().toLowerCase();

/** Lista limpa: sem vazio, sem repetida (ignora maiúscula), texto curto, no máximo 20. */
export function limparLista(lista) {
  const vistos = new Set();
  const out = [];
  for (const item of Array.isArray(lista) ? lista : []) {
    const t = String(item ?? "").replace(/\s+/g, " ").replace(/,/g, " ").trim().slice(0, LIMITE_DO_TEXTO).trim();
    if (!t || vistos.has(chaveDe(t))) continue;
    vistos.add(chaveDe(t));
    out.push(t);
    if (out.length >= LIMITE_POR_LISTA) break;
  }
  return out;
}

/** Configuração salva + padrão. Categoria sem nenhuma observação some. */
export function mesclarObservacoes(salvo) {
  const s = salvo && typeof salvo === "object" ? salvo : {};
  const setorS = s.setor && typeof s.setor === "object" ? s.setor : {};
  const catS = s.categoria && typeof s.categoria === "object" ? s.categoria : {};
  const categoria = {};
  for (const [nome, lista] of Object.entries(catS)) {
    const n = String(nome || "").trim().slice(0, 60);
    const l = limparLista(lista);
    if (n && l.length) categoria[n] = l;
  }
  return {
    setor: {
      cozinha: Array.isArray(setorS.cozinha) ? limparLista(setorS.cozinha) : [...OBSERVACOES_PADRAO.setor.cozinha],
      bar: Array.isArray(setorS.bar) ? limparLista(setorS.bar) : [...OBSERVACOES_PADRAO.setor.bar],
    },
    categoria,
  };
}

/** Botões para um produto: as da categoria primeiro, depois as do setor, sem repetir. */
export function observacoesDoProduto(config, { departamento, categoria } = {}) {
  const c = mesclarObservacoes(config);
  const setor = /bar/i.test(String(departamento || "")) ? "bar" : "cozinha";
  const daCategoria = Object.entries(c.categoria).find(([nome]) => chaveDe(nome) === chaveDe(categoria))?.[1] || [];
  return limparLista([...daCategoria, ...c.setor[setor]]);
}

const partes = (obs) => String(obs || "").split(",").map((x) => x.trim()).filter(Boolean);

/** A observação já tem esta pronta? */
export function temObservacao(obs, pronta) {
  return partes(obs).some((p) => chaveDe(p) === chaveDe(pronta));
}

/** Toca no botão: põe ou tira a pronta, mantendo o que foi digitado. */
export function alternarObservacao(obs, pronta, limite = 120) {
  const lista = partes(obs);
  const sem = lista.filter((p) => chaveDe(p) !== chaveDe(pronta));
  const nova = sem.length === lista.length ? [...lista, String(pronta).trim()] : sem;
  return nova.join(", ").slice(0, limite);
}
