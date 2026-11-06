// Contas rápidas: uma função pronta para o dono criar o acesso em segundos.
//
// O servidor lê este catálogo pelo id do modelo: a lista de permissões nunca vem
// do navegador. Nenhum modelo dá custo, edição de ficha nem exclusão; quem
// precisar de mais recebe depois, em Configurações > Perfis.
const ESTOQUE_DIA_A_DIA = ["estoque.operation.view", "estoque.movements.view", "estoque.movements.create"];
// Conta da área: vê o saldo e retira. A entrada vem pela compra, e o banco recusa
// entrada para quem só tem estoque.outputs.create (_estoque_pode).
const ESTOQUE_SO_RETIRAR = ["estoque.operation.view", "estoque.movements.view", "estoque.outputs.view", "estoque.outputs.create"];
const ETIQUETAS = ["estoque.labels.view", "estoque.labels.create", "estoque.labels.print"];
const TREINAMENTO = "treinamento.my.view";
const LIDERAR_TREINAMENTO = ["treinamento.team.view", "treinamento.team.create", "treinamento.team.approve"];

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
    permissoes: ["bar.sector.view", "bar.recipes.view", ...ESTOQUE_DIA_A_DIA, TREINAMENTO, ...LIDERAR_TREINAMENTO],
  },
  {
    id: "equipe-bar",
    codigo: "conta-equipe-bar",
    nome: "Equipe do bar",
    descricao: "Conta do bar: consulta fichas e montagem, imprime etiquetas, retira do estoque, anota a produção e pede compras.",
    setor: "Bar",
    icone: "Wine",
    paginaInicial: "/dashboard/bar",
    pode: ["Consultar fichas, montagem e cardápio", "Retirar do estoque", "Imprimir fichas e etiquetas", "Anotar a produção e pedir compras"],
    naoPode: ["Alterar fichas", "Ver custos", "Adicionar ao estoque"],
    permissoes: ["bar.sector.view", "bar.search.view", "bar.notes.view", "bar.notes.create", "bar.recipes.view", "bar.recipes.print", ...ESTOQUE_SO_RETIRAR, ...ETIQUETAS, TREINAMENTO],
  },
  {
    id: "equipe-cozinha",
    codigo: "conta-equipe-cozinha",
    nome: "Equipe da cozinha",
    descricao: "Conta da cozinha: consulta fichas e montagem, imprime etiquetas, retira do estoque, anota a produção e pede compras.",
    setor: "Cozinha",
    icone: "ChefHat",
    paginaInicial: "/dashboard/cozinha",
    pode: ["Consultar fichas, montagem e cardápio", "Retirar do estoque", "Imprimir fichas e etiquetas", "Anotar a produção e pedir compras"],
    naoPode: ["Alterar fichas", "Ver custos", "Adicionar ao estoque"],
    permissoes: ["cozinha.sector.view", "cozinha.search.view", "cozinha.notes.view", "cozinha.notes.create", "cozinha.recipes.view", "cozinha.recipes.print", ...ESTOQUE_SO_RETIRAR, ...ETIQUETAS, TREINAMENTO],
  },
  {
    id: "garcom",
    codigo: "conta-garcom",
    nome: "Garçom",
    descricao: "Conta do salão: lança os pedidos da mesa, separa por pessoa, envia à cozinha e ao bar e pede a conta ao caixa.",
    setor: "Salão",
    icone: "ConciergeBell",
    paginaInicial: "/dashboard/mesas",
    pode: ["Abrir mesas e lançar pedidos", "Separar os itens por pessoa", "Enviar à cozinha e ao bar", "Pedir a conta ao caixa"],
    naoPode: ["Receber pagamentos", "Cancelar item enviado", "Ver custos"],
    permissoes: ["salao.tables.view", "salao.tables.create", TREINAMENTO],
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
