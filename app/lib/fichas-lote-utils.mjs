export function ordenarFichasDocumento(fichas, ordem = "selecao", idsPersonalizados = []) {
  const lista = [...(fichas || [])];
  if (ordem === "selecao") return lista;
  if (ordem === "nome") {
    return lista.sort((a, b) => String(a.nome_receita || "").localeCompare(String(b.nome_receita || ""), "pt-BR"));
  }
  if (ordem === "categoria") {
    return lista.sort((a, b) =>
      String(a.categoria || "Sem categoria").localeCompare(String(b.categoria || "Sem categoria"), "pt-BR")
      || String(a.nome_receita || "").localeCompare(String(b.nome_receita || ""), "pt-BR"));
  }
  if (ordem === "tipo") {
    const tipo = ficha => ficha.eh_base
      ? "Pré-preparo"
      : (ficha.tipo_base === "produto_pronto" ? "Produto pronto" : "Prato");
    return lista.sort((a, b) => tipo(a).localeCompare(tipo(b), "pt-BR")
      || String(a.nome_receita || "").localeCompare(String(b.nome_receita || ""), "pt-BR"));
  }
  if (ordem === "personalizada") {
    const posicao = new Map(idsPersonalizados.map((id, indice) => [id, indice]));
    return lista.sort((a, b) => (posicao.get(a.id) ?? 1e9) - (posicao.get(b.id) ?? 1e9));
  }
  return lista;
}

export function estimarPaginasDocumento(quantidade, { capa = false, indice = false, modelo = "gerencial" } = {}) {
  const porFicha = modelo === "resumido" ? 0.5 : 1;
  return Math.max(1, Math.ceil((Number(quantidade) || 0) * porFicha) + (capa ? 1 : 0) + (indice ? 1 : 0));
}

export function separarFichasPorDependencias(fichas, dependencias) {
  const porFicha = dependencias?.porFicha || {};
  const vinculadas = (fichas || []).filter(ficha => (porFicha[ficha.id] || []).length > 0);
  const livres = (fichas || []).filter(ficha => (porFicha[ficha.id] || []).length === 0);
  return { vinculadas, livres };
}
