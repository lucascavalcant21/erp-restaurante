// DEPOIMENTOS DA PÁGINA INICIAL.
//
// Regra do Héfisto: nada inventado. Só entra aqui depoimento de cliente REAL,
// com autorização dele para publicar o nome e o texto. Enquanto a lista estiver
// vazia, a página diz que os depoimentos chegam com os primeiros clientes.
//
// Formato: { nome: "Nome Sobrenome", negocio: "Restaurante X, Recife", area: "restaurante", texto: "...", autorizadoEm: "AAAA-MM-DD" }

export const DEPOIMENTOS = Object.freeze([]);

/** Só os que têm nome, texto e data da autorização. */
export const depoimentosPublicaveis = (lista = DEPOIMENTOS) =>
  lista.filter((d) => d && String(d.nome || "").trim() && String(d.texto || "").trim() && /^\d{4}-\d{2}-\d{2}$/.test(String(d.autorizadoEm || "")));
