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
// + receitas da casa que o Nico responde (23/11/2026): posicionamento, salmoura, empanados, molhos e estoque de bases (só ver).
const NICO_CONSULTA = ["cozinha.search.view", "cozinha.recipes.view", "bar.search.view", "bar.recipes.view",
  "cozinha.portioning.view", "cozinha.brines.view", "cozinha.breading.view", "cozinha.sauces.view", "cozinha.base_stock.view",
  // fritadeira e coifa: ver o passo a passo e registrar "fiz agora" / reagendar (24/11/2026)
  "cozinha.equipment.view", "cozinha.equipment.record"];
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
    permissoes: ["cozinha.sector.view", "cozinha.search.view", "cozinha.notes.view", "cozinha.notes.create", "cozinha.recipes.view", "cozinha.recipes.print", "cozinha.equipment.view", "cozinha.equipment.record", ...ESTOQUE_SO_RETIRAR, ...ETIQUETAS, TREINAMENTO],
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
function contaRapidaPorIdInterno(id) { return CONTAS_RAPIDAS.find((c) => c.id === id); }

// MÓDULOS (dono, 24/11/2026): "não tem que ter chefe de bar, função; tem que
// ter Cozinha, Bar, RH, ponto dos funcionários, salão. Eu vou selecionar quais
// eu vou querer." A conta junta as permissões dos módulos marcados. Cada módulo
// segue a regra dos modelos: só ver, retirar, imprimir e registrar; nada de
// editar, excluir, custo ou valor. O servidor monta a lista pelo id dos módulos.
export const MODULOS_CONTA = Object.freeze([
  {
    id: "cozinha", nome: "Cozinha", icone: "ChefHat", setor: "Cozinha", paginaInicial: "/dashboard/cozinha",
    pode: ["Fichas, montagem e cardápio da cozinha (só ver)", "Retirar do estoque da cozinha", "Etiquetas", "Fritadeira e coifa"],
    permissoes: [...contaRapidaPorIdInterno("equipe-cozinha").permissoes],
  },
  {
    id: "bar", nome: "Bar", icone: "Wine", setor: "Bar", paginaInicial: "/dashboard/bar",
    pode: ["Fichas de drinks e montagem (só ver)", "Retirar do estoque do bar", "Etiquetas"],
    permissoes: [...contaRapidaPorIdInterno("equipe-bar").permissoes],
  },
  {
    id: "salao", nome: "Salão", icone: "ConciergeBell", setor: "Salão", paginaInicial: "/dashboard/mesas",
    pode: ["Abrir mesas e lançar pedidos", "Enviar à cozinha e ao bar"],
    permissoes: [...contaRapidaPorIdInterno("garcom").permissoes],
  },
  {
    id: "rh", nome: "RH", icone: "Users", paginaInicial: "/dashboard/rh",
    pode: ["Ver o resumo da equipe, escala e folgas", "Ver e imprimir a janta dos funcionários", "Ver o organograma"],
    naoPode: ["Ver salários, documentos e dados pessoais", "Alterar ponto, folha ou cadastro"],
    permissoes: ["rh.overview.view", "rh.quick.view", "rh.staff_menu.view", "rh.staff_menu.print", "rh.orgchart.view", "treinamento.my.view"],
  },
  {
    id: "ponto", nome: "Ponto dos funcionários", icone: "Clock", paginaInicial: "/dashboard/rh/ponto",
    pode: ["Bater o ponto (cada um com o seu PIN)"],
    permissoes: ["ponto.clock.view", "ponto.clock.create"],
  },
  {
    id: "nico", nome: "Nico", icone: "Sparkles", paginaInicial: "/dashboard/inteligencia/assistente",
    pode: ["Perguntar ao Nico (toque, texto ou áudio)", "Fichas e como fazer, sem custo"],
    permissoes: ["dashboard.intelligence.view", ...NICO_CONSULTA, ...ETIQUETAS, TREINAMENTO],
  },
]);

const ORDEM_MODULOS = MODULOS_CONTA.map((m) => m.id);
export const NAO_PODE_MODULOS = Object.freeze(["Ver custos, margem ou valores", "Alterar ou excluir fichas e cadastros", "Abrir financeiro e configurações"]);

/**
 * Conta a partir dos módulos marcados. null se não houver módulo válido.
 * Devolve o mesmo formato dos modelos (o servidor cria o perfil pelo código).
 */
export function contaDosModulos(ids) {
  const escolhidos = ORDEM_MODULOS.filter((id) => (ids || []).includes(id)).map((id) => MODULOS_CONTA.find((m) => m.id === id));
  if (!escolhidos.length) return null;
  const soPonto = escolhidos.length === 1 && escolhidos[0].id === "ponto";
  const um = escolhidos.length === 1 ? escolhidos[0] : null;
  return {
    id: `modulos:${escolhidos.map((m) => m.id).join("+")}`,
    codigo: `conta-mod-${escolhidos.map((m) => m.id).join("-")}`,
    nome: escolhidos.map((m) => m.nome).join(" + "),
    descricao: `Conta com: ${escolhidos.map((m) => m.nome).join(", ")}.`,
    setor: um?.setor || null,
    icone: um?.icone || "KeyRound",
    tipoAcesso: soPonto ? "terminal_ponto" : "setor",
    // um módulo: abre nele; vários: o Início mostra só os módulos liberados
    paginaInicial: um ? um.paginaInicial : escolhidos.some((m) => m.id === "nico") ? "/dashboard/inteligencia/assistente" : "/dashboard",
    trocarSenha: false,
    pode: escolhidos.flatMap((m) => m.pode),
    naoPode: [...NAO_PODE_MODULOS, ...escolhidos.flatMap((m) => m.naoPode || [])],
    permissoes: [...new Set(escolhidos.flatMap((m) => m.permissoes))],
    modulos: escolhidos.map((m) => m.id),
  };
}


/** "Ana Paula Souza" vira "ana.souza": curto de digitar no tablet. */
export function sugerirLogin(nome) {
  const partes = String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  return partes.length === 1 ? partes[0] : `${partes[0]}.${partes.at(-1)}`;
}

// Login e senha a partir do nome do restaurante (dono, 24/11/2026): "o sistema cria um
// login com base no nome do meu restaurante… e a senha também; eu posso usar ou editar".
//   login: seldeestrela123, o próximo seldeestrela1234, depois seldeestrela12345…
//   senha: Seldeestrela + 4 números sorteados (não a sequência: sequência qualquer um adivinha).

/** "Sel de Estrela Ltda" → "seldeestrela" (sem acento, espaço nem símbolo). */
export function baseDoRestaurante(nome) {
  const b = String(nome || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/\b(ltda|me|eireli|epp|s\/?a)\b/g, " ").replace(/[^a-z0-9]/g, "");
  return b.slice(0, 24) || "hefisto";
}

/** Primeiro login livre: base + 123, + 1234, + 12345… */
export function loginDoRestaurante(nome, existentes = []) {
  const base = baseDoRestaurante(nome);
  const usados = new Set(existentes.map((l) => String(l || "").trim().toLowerCase()));
  let sufixo = "123";
  for (let proximo = 4; usados.has(`${base}${sufixo}`); proximo++) sufixo += String(proximo % 10);
  return `${base}${sufixo}`;
}

/** "Seldeestrela" + 4 números sorteados. */
export function senhaDoRestaurante(nome, aleatorio = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n) {
  const base = baseDoRestaurante(nome);
  return `${base.charAt(0).toUpperCase()}${base.slice(1)}${1000 + aleatorio(9000)}`;
}

/** Senha temporária sem letras parecidas (l/1, O/0), para ditar sem erro. */
export function gerarSenhaTemporaria(aleatorio = (n) => crypto.getRandomValues(new Uint32Array(1))[0] % n) {
  const letras = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 10 }, () => letras[aleatorio(letras.length)]).join("");
}
