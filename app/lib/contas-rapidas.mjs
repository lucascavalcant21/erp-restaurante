// Contas rápidas: uma função pronta para o dono criar o acesso em segundos.
//
// O servidor lê este catálogo pelo id do modelo: a lista de permissões nunca vem
// do navegador. Nenhum modelo dá custo, edição de ficha nem exclusão; quem
// precisar de mais recebe depois, em Configurações > Perfis.
const ESTOQUE_DIA_A_DIA = ["estoque.operation.view", "estoque.movements.view", "estoque.movements.create"];
const ETIQUETAS = ["estoque.labels.view", "estoque.labels.create", "estoque.labels.print"];

export const CONTAS_RAPIDAS = Object.freeze([
  {
    id: "chefe-bar",
    codigo: "conta-chefe-bar",
    nome: "Chefe de bar",
    descricao: "Consulta as fichas de drinks e lança entrada e retirada no estoque.",
    setor: "Bar",
    icone: "Martini",
    paginaInicial: "/dashboard/bar",
    pode: ["Ver as fichas de drinks", "Adicionar e retirar do estoque"],
    naoPode: ["Alterar fichas", "Ver custos"],
    permissoes: ["bar.sector.view", "bar.recipes.view", ...ESTOQUE_DIA_A_DIA],
  },
  {
    id: "equipe-bar",
    codigo: "conta-equipe-bar",
    nome: "Equipe do bar",
    descricao: "Consulta fichas, usa o estoque e imprime fichas e etiquetas do bar.",
    setor: "Bar",
    icone: "Wine",
    paginaInicial: "/dashboard/bar",
    pode: ["Ver as fichas de drinks", "Adicionar e retirar do estoque", "Imprimir fichas e etiquetas"],
    naoPode: ["Alterar fichas", "Ver custos"],
    permissoes: ["bar.sector.view", "bar.recipes.view", "bar.recipes.print", ...ESTOQUE_DIA_A_DIA, ...ETIQUETAS],
  },
  {
    id: "equipe-cozinha",
    codigo: "conta-equipe-cozinha",
    nome: "Equipe da cozinha",
    descricao: "Consulta fichas, usa o estoque e imprime fichas e etiquetas da cozinha.",
    setor: "Cozinha",
    icone: "ChefHat",
    paginaInicial: "/dashboard/cozinha",
    pode: ["Ver as fichas técnicas", "Adicionar e retirar do estoque", "Imprimir fichas e etiquetas"],
    naoPode: ["Alterar fichas", "Ver custos"],
    permissoes: ["cozinha.sector.view", "cozinha.recipes.view", "cozinha.recipes.print", ...ESTOQUE_DIA_A_DIA, ...ETIQUETAS],
  },
  {
    id: "somente-ponto",
    // Perfil que já existe no banco: não se cria outro igual.
    codigo: "somente-ponto",
    nome: "Só ponto",
    descricao: "Abre direto no relógio de ponto, para o tablet da casa.",
    icone: "Clock",
    tipoAcesso: "terminal_ponto",
    paginaInicial: "/dashboard/rh/ponto",
    // Tablet compartilhado: não há uma pessoa dona da senha para trocá-la.
    trocarSenha: false,
    pode: ["Bater o ponto"],
    naoPode: ["Abrir qualquer outra tela"],
    permissoes: ["ponto.clock.view", "ponto.clock.create"],
  },
]);

export const contaRapidaPorId = (id) => CONTAS_RAPIDAS.find((c) => c.id === id) || null;

/** "Ana Paula Souza" vira "ana.souza": curto de digitar no tablet. */
export function sugerirLogin(nome) {
  const partes = String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  return partes.length === 1 ? partes[0] : `${partes[0]}.${partes.at(-1)}`;
}

/** Senha temporária sem letras parecidas (l/1, O/0), para ditar sem erro. */
export function gerarSenhaTemporaria(aleatorio = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n) {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => letras[aleatorio(letras.length)]).join("");
}
