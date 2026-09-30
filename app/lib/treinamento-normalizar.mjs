// Normalizador de treinamento, sem dependência de Supabase: o mesmo código
// serve à tela interna (treinamentos.js) e à rota pública do servidor
// (/api/public/treinamento/[token]).
//
// Bancos sem as colunas novas guardam os metadados no fim da descrição, num
// bloco [[HEFISTO_TREINAMENTO:{...}]]. Aqui eles voltam a ser campos.

export const MARCADOR = "\n[[HEFISTO_TREINAMENTO:";

export const normalizarTreinamento = item => {
  const descricao = String(item?.descricao || "");
  const inicio = descricao.lastIndexOf(MARCADOR);
  if (inicio < 0) return { ...item, departamento: item?.departamento || "salao", modulo: item?.modulo || "Geral", conteudo_texto: item?.conteudo_texto || descricao, duracao_minutos: Number(item?.duracao_minutos) || 5, obrigatorio: Boolean(item?.obrigatorio) };
  try {
    const meta = JSON.parse(descricao.slice(inicio + MARCADOR.length, descricao.length - 2));
    return { ...item, ...meta, descricao: descricao.slice(0, inicio), conteudo_texto: meta.conteudo_texto || descricao.slice(0, inicio) };
  } catch { return { ...item, departamento: "salao", modulo: "Geral", conteudo_texto: descricao }; }
};
