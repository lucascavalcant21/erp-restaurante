// ASSISTENTE CLICÁVEL (pedido do dono, 08/11/2026): "o funcionário tem que
// clicar mais do que digitar". Cada área tem atalhos de um toque; as listas
// (receitas, drinks, onde vai um ingrediente) viram botões; quando só dá para
// digitar (o nome de um ambiente, um problema diferente), a pergunta já vem
// com o comando pronto e a pessoa só completa.
//
// Só leitura: os atalhos levam aos mesmos comandos de sempre (fichas, estoque,
// salão), com as mesmas permissões. Nada aqui grava.

const sem = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const r = (texto, extra = {}) => ({ tipo: "resposta", texto, blocos: [], acoes: [], ...extra });
const op = (rotulo, comando, id = null) => ({ id: id || sem(rotulo).replace(/[^a-z0-9]+/g, "-").slice(0, 40), rotulo, comando });
const livre = (texto, comandoBase) => ({ ...r(texto), tipo: "pergunta", pergunta: { campo: "livre", texto, livre: true, comandoBase } });
const escolha = (texto, opcoes) => ({ ...r(texto), tipo: "pergunta", pergunta: { campo: "atalho", texto, opcoes } });

export const AREAS = Object.freeze({
  cozinha: { rotulo: "Cozinha", texto: "Cozinha: o que você vai fazer?", opcoes: [
    op("Fazer um prato", "Pratos da cozinha"),
    op("Fazer uma receita base (pré-preparo)", "Bases da cozinha"),
    op("Onde vai um ingrediente?", "Atalhos: ingrediente"),
    op("Quanto tenho de um produto?", "Atalhos: saldo"),
    op("Registrar uma perda", "Atalhos: perda"),
  ] },
  bar: { rotulo: "Bar", texto: "Bar: o que você vai fazer?", opcoes: [
    op("Fazer um drink", "Drinks do bar"),
    op("Fazer um xarope ou base", "Bases do bar"),
    op("Onde vai um ingrediente?", "Atalhos: ingrediente"),
    op("Quanto tenho de um produto?", "Atalhos: saldo"),
  ] },
  salao: { rotulo: "Salão", texto: "Salão: do que você precisa?", opcoes: [
    op("Aconteceu um problema", "Atalhos: problemas"),
    op("Montar uma mesa", "Montagem no salão: como montar a mesa para o serviço"),
    op("Montar um ambiente (jardim, varanda…)", "Atalhos: ambiente"),
    op("Quais pratos levam um ingrediente?", "Atalhos: ingrediente"),
    op("Como é feito um prato ou drink?", "Atalhos: prato"),
  ] },
  estoque: { rotulo: "Estoque", texto: "Estoque: o que você vai fazer?", opcoes: [
    op("Dar entrada no que chegou", "Atalhos: entrada"),
    op("Quanto tenho de um produto?", "Atalhos: saldo"),
    op("Registrar uma perda", "Atalhos: perda"),
    op("O que está vencendo?", "O que está vencendo?"),
  ] },
});

export const COMANDO_AREA = Object.freeze({ cozinha: "Atalhos da cozinha", bar: "Atalhos do bar", salao: "Atalhos do salão", estoque: "Atalhos do estoque" });

export const PROBLEMAS_SALAO = Object.freeze([
  "O cliente reclamou da comida",
  "O prato está demorando",
  "O cliente tem alergia",
  "Erro na conta",
  "Derramou bebida no cliente",
  "O cliente passou mal",
  "Acabou um item do cardápio",
]);

/** Pedidos de digitar o mínimo: a pergunta já vem com o comando pronto. */
const LIVRES = {
  ingrediente: () => livre("Qual ingrediente? Eu mostro em quais pratos, drinks e bases ele vai.", "Onde vai {valor}?"),
  saldo: () => livre("De qual produto? Eu mostro quanto tem e em qual setor.", "Quanto tenho de {valor}?"),
  perda: () => livre("O que foi perdido e quanto? Ex.: 2 kg de picanha que venceu.", "Perdi {valor}"),
  entrada: () => livre("O que chegou? Pode mandar vários. Ex.: 3 kg de picanha e 2 caixas de cerveja.", "Entrada de {valor}"),
  ambiente: () => livre("Qual ambiente? Ex.: jardim, varanda, salão de eventos.", "Montagem no salão: como montar o {valor}"),
  prato: () => livre("De qual prato ou drink?", "Como faz {valor}?"),
};

function areaDoTexto(t) {
  if (/\bcozinha\b/.test(t)) return "cozinha";
  if (/\bbar\b/.test(t)) return "bar";
  if (/\bsalao\b/.test(t)) return "salao";
  if (/\bestoque\b/.test(t)) return "estoque";
  return null;
}

export const HANDLERS_MENU = {
  async "assistente.menu"({ params }) {
    const t = sem(params.texto);
    if (/\bproblemas?\b/.test(t)) {
      return escolha("O que aconteceu?", [
        ...PROBLEMAS_SALAO.map((p) => op(p, `Situação no salão: ${p.toLowerCase()}. Como resolvo?`)),
        op("Outro problema (escrever)", "Atalhos: outro problema"),
      ]);
    }
    if (/outro problema/.test(t)) return livre("Conte rapidinho o que aconteceu.", "Situação no salão: {valor}. Como resolvo?");
    for (const [chave, f] of Object.entries(LIVRES)) if (new RegExp(`atalhos:? ${chave}\\b`).test(t)) return f();
    const area = areaDoTexto(t);
    if (area) return escolha(AREAS[area].texto, AREAS[area].opcoes);
    return escolha("Em que área você está agora?", Object.entries(AREAS).map(([k, a]) => op(a.rotulo, COMANDO_AREA[k], k)));
  },

  async "fichas.listar"({ motor, params }) {
    const t = sem(params.texto);
    const departamento = /\bbar\b|drinks?|drinques?|bebidas?|xaropes?/.test(t) ? "bar" : /\bcozinha\b|pratos?/.test(t) ? "cozinha" : null;
    const base = /\bbases?\b|xaropes?|pre-?preparo/.test(t) ? true : /drinks?|drinques?|pratos?|bebidas?/.test(t) ? false : null;
    const m = await motor.listRecipes({ departamento, base });
    if (m.status !== "ok" && m.status !== "parcial") return r(m.motivo || "Não há fichas para mostrar.", { natureza: "DADOS_INSUFICIENTES" });
    const fichas = m.detalhes.fichas;
    const qual = departamento === "bar" ? (base ? "xarope ou base" : "drink") : base ? "receita base" : "prato";
    return escolha(`Qual ${qual} você vai fazer? (${fichas.length})`, fichas.map((f) => op(f.nome, `Vou preparar ${f.nome}`, f.id)));
  },

  async "fichas.onde_vai"({ motor, params }) {
    const termo = String(params.produto || "").trim();
    if (!termo || /^(um|uma|o|a)?\s*(ingrediente|produto|item|algo|coisa)$/.test(sem(termo))) return LIVRES.ingrediente();
    const m = await motor.whereUsed({ termo, frase: params.texto || null });
    if (m.status === "insuficiente" && m.detalhes?.ambiguo) {
      return escolha(m.motivo, m.detalhes.opcoes.map((o) => op(o.nome, `Onde vai ${o.nome}?`, o.id)));
    }
    if (m.status !== "ok" && m.status !== "parcial") return r(m.motivo || "Não consegui ver as fichas agora.", { natureza: "DADOS_INSUFICIENTES" });
    const { produto, fichas } = m.detalhes;
    if (!fichas.length) return r(`${produto.nome} não aparece em nenhuma ficha técnica desta unidade.`);
    const linha = (f) => `${f.nome}${f.quantidade ? ` (${f.quantidade})` : f.via ? ` (dentro de ${f.via})` : ""}`;
    const texto = `${produto.nome} vai em ${fichas.length} ficha${fichas.length > 1 ? "s" : ""}: ${fichas.slice(0, 12).map(linha).join("; ")}${fichas.length > 12 ? "…" : ""}.`;
    return {
      ...escolha(texto, fichas.slice(0, 20).map((f) => op(f.nome, `Como faz ${f.nome}?`, f.id))),
      texto,
      blocos: [{ tipo: "lista", titulo: `Onde vai ${produto.nome}`, itens: fichas.map((f) => ({ rotulo: f.nome, valor: f.quantidade || (f.via ? `dentro de ${f.via}` : f.base ? "base" : "—") })) }],
    };
  },
};
