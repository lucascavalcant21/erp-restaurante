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
// O que o Nico do tablet consulta: fichas e busca da cozinha e do bar, sem custo.
const NICO_CONSULTA = ["cozinha.search.view", "cozinha.recipes.view", "bar.search.view", "bar.recipes.view"];
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
  // Tablets do Nico (decisão do dono, 14/11/2026): o dono escolhe o que cada
  // tablet tem — só ponto (acima), Nico + ponto ou só Nico — e o sistema gera
  // o login e a senha, que abrem direto na tela escolhida. O Nico consulta
  // fichas, imprime etiquetas, ensina os procedimentos e o treinamento; nunca
  // vê custo, margem nem nada de gestão (isso é do Jhon, o assistente do dono).
  {
    id: "tablet-nico",
    codigo: "conta-tablet-nico",
    nome: "Tablet do Nico",
    descricao: "Abre direto no Nico: fichas e como fazer, etiquetas, procedimentos do salão e treinamento.",
    icone: "Sparkles",
    tipoAcesso: "setor", // conta compartilhada do aparelho (valores aceitos: usuarios_erp_tipo_acesso_check)
    paginaInicial: "/dashboard/inteligencia/assistente",
    trocarSenha: false,
    pode: ["Perguntar ao Nico (por toque, texto ou áudio)", "Ver fichas de pratos e drinks", "Imprimir etiquetas", "Fazer o treinamento"],
    naoPode: ["Ver custos ou margem", "Abrir financeiro, RH ou configurações", "Bater o ponto"],
    permissoes: ["dashboard.intelligence.view", ...NICO_CONSULTA, ...ETIQUETAS, TREINAMENTO],
  },
  {
    id: "tablet-nico-ponto",
    codigo: "conta-tablet-nico-ponto",
    nome: "Tablet do Nico + ponto",
    descricao: "Abre no Nico e também bate o ponto da equipe (cada um com o seu PIN).",
    icone: "Sparkles",
    tipoAcesso: "setor", // conta compartilhada do aparelho (valores aceitos: usuarios_erp_tipo_acesso_check)
    paginaInicial: "/dashboard/inteligencia/assistente",
    trocarSenha: false,
    pode: ["Tudo do Tablet do Nico", "Bater o ponto"],
    naoPode: ["Ver custos ou margem", "Abrir financeiro, RH ou configurações"],
    permissoes: ["dashboard.intelligence.view", ...NICO_CONSULTA, ...ETIQUETAS, TREINAMENTO, "ponto.clock.view", "ponto.clock.create"],
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
