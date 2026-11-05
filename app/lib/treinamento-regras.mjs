// Regras puras do treinamento: progresso, cenas do boneco e o que falta em cada
// prato. O banco decide quem passou; aqui só se organiza o que aparece na tela.

export const STATUS_MATRICULA = {
  em_andamento: "Em treinamento",
  aguardando_lider: "Aguardando o líder",
  aprovado: "Aprovado",
  cancelado: "Cancelado",
};

export const AREAS_TREINAMENTO = {
  geral: "Toda a casa",
  cozinha: "Cozinha",
  bar: "Bar",
  salao: "Salão",
  gestao: "Liderança",
};

/** Situação de cada módulo da trilha. Módulo de pratos não tem prova. */
export function resumirModulo(modulo, aulas, concluidas, tentativas) {
  if (modulo.tipo === "pratos") return { estado: "pratos", feitas: 0, total: 0, aprovado: false };
  const minhas = aulas.filter((a) => a.modulo_id === modulo.id);
  const feitas = minhas.filter((a) => concluidas.has(a.id)).length;
  const aprovado = tentativas.some((t) => t.modulo_id === modulo.id && t.aprovada);
  const estado = aprovado ? "aprovado" : feitas === minhas.length && minhas.length > 0 ? "prova" : feitas > 0 ? "andamento" : "novo";
  return { estado, feitas, total: minhas.length, aprovado };
}

/** Percentual da trilha, só com módulos que têm prova. Sem prova: null, não 0. */
export function progressoDaTrilha(modulos, aulas, concluidas, tentativas) {
  const comProva = modulos.filter((m) => m.tipo !== "pratos");
  if (!comProva.length) return null;
  const aprovados = comProva.filter((m) => resumirModulo(m, aulas, concluidas, tentativas).aprovado).length;
  return { aprovados, total: comProva.length, percentual: Math.round((aprovados / comProva.length) * 100) };
}

// ─── Cenas do boneco ─────────────────────────────────────────────────────────

export const DEMONSTRACOES_DISPONIVEIS = ["maos", "fogo", "faca", "termometro", "etiqueta", "balanca", "vinho", "coqueteleira", "mesa", "empratar", "bandeja", "panela", "alerta", "conversa"];

const DEMONSTRACOES = [
  ["vinho", /vinho|espumante|taça|saca-rolhas|cerveja|rolha/i],
  ["mesa", /talher|garfo|mesa padrão|montar a mesa|monte a mesa|guardanapo|jogo americano/i],
  ["maos", /lav[ea]|mãos|higiene pessoal/i],
  ["fogo", /fogo|incêndio|gás|queimadura/i],
  ["faca", /faca|cortou|corte\b/i],
  ["termometro", /°C|temperatura|geladeira|freezer|congel|resfri/i],
  ["etiqueta", /etiqueta|validade|identific/i],
  ["balanca", /balança|medida|dosador|porç|quantidade|fator de correção|custo|CMV/i],
  ["coqueteleira", /drink|batido|mexido|bartender|coquetel|gelo\b|dose/i],
  ["empratar", /emprat|finaliza|montagem|monte o prato|porção|borda do prato/i],
  ["bandeja", /mesa|prato|cliente|cardápio|pedido|salão|garçom/i],
  ["panela", /cozinh|cocção|panela|preparo|praça|mise en place|molho/i],
  ["alerta", /nunca|não |alergia|emergência|192|193/i],
];
const FALAS = ["apontar", "explicar", "mostrar"];

/** A demonstração é escolhida pelo texto da cena: a mais específica primeiro. */
export function demonstracaoDaCena(texto) {
  return DEMONSTRACOES.find(([, regra]) => regra.test(texto))?.[0] || "conversa";
}

const limparItem = (linha) => linha.replace(/^\s*(?:-|\d+\.)\s*/, "").trim();
const ehItem = (linha) => /^\s*(?:-|\d+\.)\s+/.test(linha);

/**
 * Divide a aula em cenas. Cada parágrafo é uma cena e cada lista vira uma cena
 * com seus itens. Listas longas são quebradas para o boneco não falar demais.
 */
export function cenasDaAula(conteudo, { maximoDeItens = 5 } = {}) {
  const cenas = [];
  for (const bloco of String(conteudo || "").split(/\n\s*\n/)) {
    const linhas = bloco.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim());
    if (!linhas.length) continue;
    const titulo = !ehItem(linhas[0]) && linhas.slice(1).some(ehItem) ? linhas[0].trim() : "";
    const itens = linhas.filter(ehItem).map(limparItem);
    const soltas = linhas.filter((l) => !ehItem(l)).map((l) => l.trim()).filter((l) => l !== titulo);
    if (!itens.length) {
      cenas.push({ texto: soltas.join(" "), itens: [] });
      continue;
    }
    for (let i = 0; i < itens.length; i += maximoDeItens) {
      cenas.push({ texto: i === 0 ? titulo : `${titulo} Continuando:`.trim(), itens: itens.slice(i, i + maximoDeItens) });
    }
    if (soltas.length) cenas.push({ texto: soltas.join(" "), itens: [] });
  }
  return cenas.map((c, i) => {
    const fala = [c.texto, ...c.itens].filter(Boolean).join(". ").replace(/\.\.+/g, ".");
    return { ...c, fala, demonstracao: demonstracaoDaCena(fala), gesto: FALAS[i % FALAS.length] };
  });
}

const FRASES_MAXIMO = 500;

/** Valida o que a IA devolveu. Fala vazia sai; demonstração desconhecida vem do texto. */
export function normalizarCenasDaIA(bruto) {
  const lista = Array.isArray(bruto) ? bruto : Array.isArray(bruto?.cenas) ? bruto.cenas : [];
  return lista
    .map((c) => ({ fala: String(c?.fala || "").replace(/\s+/g, " ").trim().slice(0, FRASES_MAXIMO), demonstracao: c?.demonstracao }))
    .filter((c) => c.fala)
    .slice(0, 40)
    .map((c, i) => ({
      fala: c.fala, texto: c.fala, itens: [], gesto: FALAS[i % FALAS.length],
      demonstracao: DEMONSTRACOES_DISPONIVEIS.includes(c.demonstracao) ? c.demonstracao : demonstracaoDaCena(c.fala),
    }));
}

/** Cenas salvas no Estúdio ou, sem elas, as do texto da aula. */
export const cenasParaTocar = (aula) => (Array.isArray(aula?.cenas) && aula.cenas.length ? aula.cenas : cenasDaAula(aula?.conteudo));

const nomePrato = (f) => f?.nome_comercial || f?.nome_receita || "este prato";

/**
 * Aula do prato, montada só com o que está na ficha. Sem modo de preparo, o
 * boneco diz que falta. Nunca completa a receita por conta própria.
 */
export function cenasDoPrato(ficha, guia, etapa) {
  const bar = ficha?.departamento === "bar";
  const nome = nomePrato(ficha);
  const itens = (ficha?.fichas_ingredientes || []).map((i) => i?.insumos?.nome).filter((n) => n && !/^ingrediente$/i.test(n.trim()));
  const cenas = [{ texto: `${nome}.`, itens: [], fala: ficha?.descricao_comercial ? `${nome}. ${ficha.descricao_comercial}` : `Agora vamos falar de ${nome}.`, demonstracao: bar ? "coqueteleira" : "bandeja" }];
  for (let i = 0; i < itens.length; i += 6) {
    const parte = itens.slice(i, i + 6);
    cenas.push({ texto: i === 0 ? "Leva:" : "E também:", itens: parte, fala: `${i === 0 ? "Leva" : "E também"}: ${parte.join(", ")}.`, demonstracao: "balanca" });
  }
  if (bar) {
    const servico = [ficha?.copo && `Copo: ${ficha.copo}`, ficha?.tipo_gelo && `Gelo: ${ficha.tipo_gelo}`, ficha?.metodo_bar && `Método: ${ficha.metodo_bar}`, ficha?.guarnicao && `Guarnição: ${ficha.guarnicao}`].filter(Boolean);
    if (servico.length) cenas.push({ texto: "Serviço:", itens: servico, fala: `${servico.join(". ")}.`, demonstracao: "coqueteleira" });
  } else if (ficha?.guarnicao) {
    cenas.push({ texto: "Guarnição:", itens: [ficha.guarnicao], fala: `Guarnição: ${ficha.guarnicao}.`, demonstracao: "empratar" });
  }
  if (ficha?.alergenicos_pode_conter) cenas.push({ texto: "Atenção aos alérgenos:", itens: [ficha.alergenicos_pode_conter], fala: `Atenção: pode conter ${ficha.alergenicos_pode_conter}.`, demonstracao: "alerta" });
  if (etapa === "montar") {
    if (guiaEscrito(guia)) cenas.push(...cenasDaAula(guia.descritivo).map((c) => ({ ...c, demonstracao: bar ? "coqueteleira" : "empratar" })));
    else cenas.push({ texto: "A montagem deste item ainda não foi escrita.", itens: [], fala: "A montagem deste item ainda não foi escrita. Veja com o seu líder.", demonstracao: "alerta" });
  }
  if (etapa === "preparar") {
    if (preparoEscrito(ficha)) cenas.push(...cenasDaAula(ficha.modo_preparo).map((c) => ({ ...c, demonstracao: bar ? "coqueteleira" : "panela" })));
    else cenas.push({ texto: "O modo de preparo ainda não foi escrito.", itens: [], fala: "O modo de preparo ainda não foi escrito. Veja com o seu líder.", demonstracao: "alerta" });
  }
  return cenas.map((c, i) => ({ ...c, gesto: FALAS[i % FALAS.length] }));
}

export const PERSONAGENS = {
  geral: { nome: "Hélio", funcao: "Instrutor do Héfisto", roupa: "instrutor" },
  cozinha: { nome: "Chef Tico", funcao: "Instrutor da cozinha", roupa: "chef" },
  bar: { nome: "Nina", funcao: "Instrutora do bar", roupa: "bartender" },
  salao: { nome: "Davi", funcao: "Instrutor do salão", roupa: "garcom" },
  gestao: { nome: "Clara", funcao: "Instrutora de liderança", roupa: "lider" },
};
export const personagemDaArea = (area) => PERSONAGENS[area] || PERSONAGENS.geral;

// ─── Pratos ──────────────────────────────────────────────────────────────────

const normalizar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const preparoEscrito = (ficha) => String(ficha?.modo_preparo || "").trim().length > 20;

// Guia gerado da ficha é só a lista "Ingredientes:", que a tela já mostra.
export const guiaEscrito = (guia) => {
  const texto = String(guia?.descritivo || "").trim();
  return texto.length > 20 && !/^ingredientes:/i.test(texto);
};

export function guiaDaFicha(ficha, guias) {
  const nome = normalizar(ficha?.nome_receita);
  return (guias || []).find((g) => normalizar(g.nome) === nome) || null;
}

/** Quais fichas entram em cada etapa, sem custo e sem preço. */
export function fichasDaEtapa(fichas, departamento, etapa) {
  const ativas = (fichas || []).filter((f) => f.departamento === departamento && f.ativo !== false);
  if (etapa === "preparar") return departamento === "bar" ? ativas.filter((f) => f.eh_base) : ativas;
  return ativas.filter((f) => !f.eh_base);
}

/** O que falta para ensinar este prato. Falta nunca é preenchida por conta própria. */
export function faltasDoPrato(ficha, guia, etapa) {
  const faltas = [];
  if (!(ficha?.fichas_ingredientes?.length > 0)) faltas.push("ingredientes");
  if (etapa === "preparar" && !preparoEscrito(ficha)) faltas.push("modo de preparo");
  if (etapa === "montar") {
    if (!guiaEscrito(guia) && !preparoEscrito(ficha)) faltas.push("passo a passo da montagem");
    if (!(guia?.foto_url || ficha?.montagem_foto || ficha?.imagem)) faltas.push("foto");
  }
  return faltas;
}

/** Contagem do Estúdio: o que falta completar nas fichas para o treinamento. */
export function pendenciasDeFichas(fichas, guias) {
  const resumo = {};
  for (const departamento of ["cozinha", "bar"]) {
    const preparar = fichasDaEtapa(fichas, departamento, "preparar");
    const montar = fichasDaEtapa(fichas, departamento, "montar");
    const semPreparo = preparar.filter((f) => !preparoEscrito(f));
    const semMontagem = montar.filter((f) => faltasDoPrato(f, guiaDaFicha(f, guias), "montar").length > 0);
    resumo[departamento] = { preparar: preparar.length, semPreparo: semPreparo.map((f) => f.nome_receita), montar: montar.length, semMontagem: semMontagem.map((f) => f.nome_receita) };
  }
  return resumo;
}

export const temPreencher = (conteudo) => /\[PREENCHER/.test(String(conteudo || ""));

export function mensagemDeErro(erro) {
  const texto = String(erro?.message || erro || "");
  if (/trein_|does not exist|schema cache|could not find/i.test(texto)) return "O treinamento ainda não foi ativado nesta unidade.";
  return texto || "Não foi possível concluir agora.";
}
