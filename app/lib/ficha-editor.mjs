// Estado do editor de fichas — funções puras, testadas em ficha-editor.test.mjs.
//
// O editor trabalha com as quantidades na unidade-base do insumo (kg, L, un),
// que é como o custo é calculado; na hora de gravar, quantidadeParaGravar
// (ficha-modelo.mjs) devolve cada uma à unidade em que o insumo foi cadastrado.

import {
  parseNumero, converterParaBaseDoInsumo, custoUnitarioEfetivoInsumo, custoDeProduzirFicha,
  rendimentoPelosIngredientes, unidadePadraoDepartamento, arestasDeSubfichas, criariaCiclo,
} from "./ficha-calculos.mjs";
import { unidadeNormalizada as unidadeBaseDoInsumo } from "./ingredientes-utils.mjs";
import {
  tipoFichaDe, setorId, armazenamentoParaEditar, textoDeInstrucoes, validadePrincipal,
} from "./ficha-modelo.mjs";

// Em receita a cozinha pensa em g/ml, mas o custo do insumo é por kg/L.
// O campo aceita as duas: `modo` "sub" digita em g/ml, "base" em kg/L.
const SUB_UNIDADES = { kg: { sub: "g", fator: 1000 }, l: { sub: "ml", fator: 1000 } };
export const subUnidade = (unidade) => SUB_UNIDADES[String(unidade || "").toLowerCase()] || null;

// Sem acento e em minúsculas, para a busca achar "acucar" em "Açúcar".
const DIACRITICOS = new RegExp("[" + String.fromCharCode(0x0300) + "-" + String.fromCharCode(0x036f) + "]", "g");
const normalizar = (s) => String(s || "").toLowerCase().normalize("NFD").replace(DIACRITICOS, "").trim();

// Custo de 1 unidade do rendimento de um pré-preparo (o que entra no prato).
export function custoUnitarioDoPrePreparo(base, todasFichas = []) {
  return custoDeProduzirFicha(base, todasFichas) / (parseNumero(base?.rendimento_porcoes) || 1);
}

// Linha de fichas_ingredientes (do banco) → item do editor.
export function itemDeIngrediente(fi, todasFichas = []) {
  if (fi.subficha_id) {
    const base = todasFichas.find(f => f.id === fi.subficha_id);
    const unidade = base?.rendimento_unidade || "kg";
    return {
      chave: fi.subficha_id, tipo: "base", subficha_id: fi.subficha_id, insumo_id: null,
      nome: base?.nome_receita || "Pré-preparo removido",
      unidade, unidade_insumo: unidade,
      custo_unitario: base ? custoUnitarioDoPrePreparo(base, todasFichas) : 0,
      quantidade: parseNumero(fi.quantidade),
      fator: parseNumero(fi.fator_correcao),
      peso_medio_g: null,
      modo: subUnidade(unidade) ? "sub" : "base",
    };
  }
  const insumo = fi.insumos || {};
  const unidade = unidadeBaseDoInsumo(insumo.unidade_medida) || String(insumo.unidade_medida || "un").toLowerCase();
  return {
    chave: insumo.id || fi.insumo_id, tipo: "insumo", insumo_id: insumo.id || fi.insumo_id, subficha_id: null,
    nome: insumo.nome || "Ingrediente removido",
    unidade, unidade_insumo: insumo.unidade_medida || unidade,
    custo_unitario: custoUnitarioEfetivoInsumo(insumo),
    quantidade: converterParaBaseDoInsumo(fi.quantidade || 0, insumo.unidade_medida, unidade),
    // Perda vem do cadastro do ingrediente; cai no fator antigo da ficha se não houver.
    fator: insumo.empanado ? 0 : (parseNumero(insumo.perda_pct) || parseNumero(fi.fator_correcao)),
    peso_medio_g: insumo.peso_medio_g || null,
    modo: subUnidade(unidade) ? "sub" : "base",
  };
}

// Opção escolhida na busca ("insumo:<id>" ou "base:<id>") → item do editor.
export function itemDeOpcao(valor, { insumos = [], embalagens = [], fichas = [] } = {}, quantidade = 0) {
  const [tipo, id] = String(valor || "").split(":");
  if (tipo === "base") {
    const base = fichas.find(f => f.id === id);
    if (!base) return null;
    return itemDeIngrediente({ subficha_id: base.id, quantidade, fator_correcao: 0 }, fichas);
  }
  const insumo = insumos.find(i => i.id === id) || embalagens.find(i => i.id === id);
  if (!insumo) return null;
  const item = itemDeIngrediente({ insumo_id: insumo.id, insumos: insumo, quantidade: 0, fator_correcao: 0 }, fichas);
  return { ...item, quantidade };
}

// Tudo o que pode virar ingrediente: insumos do setor, pré-preparos e
// embalagens. Fica de fora o pré-preparo que já usa esta ficha (direta ou
// indiretamente): ele formaria um ciclo e o custo não fecharia.
export function opcoesDeIngrediente({ insumos = [], embalagens = [], fichas = [], fichaId = null } = {}) {
  const arestas = arestasDeSubfichas(fichas);
  return [
    ...insumos.map(i => ({ valor: `insumo:${i.id}`, nome: i.nome, detalhe: i.unidade_medida, grupo: "Ingrediente" })),
    ...fichas
      .filter(f => tipoFichaDe(f) === "pre_preparo" && f.id !== fichaId)
      .filter(f => !fichaId || !criariaCiclo(fichaId, f.id, arestas))
      .map(f => ({ valor: `base:${f.id}`, nome: f.nome_receita, detalhe: f.rendimento_unidade, grupo: "Pré-preparo" })),
    ...embalagens.map(i => ({ valor: `insumo:${i.id}`, nome: i.nome, detalhe: i.unidade_medida, grupo: "Embalagem" })),
  ];
}

export function buscarOpcoes(opcoes, termo, limite = 8) {
  const alvo = normalizar(termo);
  if (!alvo) return [];
  return opcoes.filter(o => normalizar(o.nome).includes(alvo)).slice(0, limite);
}

// Custo dos itens do editor: custo unitário × quantidade bruta (com a perda do
// ingrediente). É a mesma conta de custoIngrediente/custoSubreceita.
export const custoDoItem = (i) => parseNumero(i.custo_unitario) * parseNumero(i.quantidade) * (1 + parseNumero(i.fator) / 100);
export const custoDosItens = (itens = []) => itens.reduce((soma, i) => soma + custoDoItem(i), 0);

// Preço por grama/ml ≥ R$ 1 (R$ 1.000/kg) quase sempre é cadastro errado:
// preço do pacote salvo como preço da grama.
export const precoSuspeito = (i) => ["g", "ml"].includes(String(i.unidade).toLowerCase()) && parseNumero(i.custo_unitario) >= 1;

// Rendimento: kg na cozinha, L no bar. Ficha que já rende noutra unidade (g,
// porções, unidades) mantém a unidade dela e não é somada sozinha — mudar a
// unidade mudaria o sentido das quantidades dos pratos que a usam.
export function rendimentoEhAutomatizavel(form) {
  const un = String(form?.rendimento_unidade || "").toLowerCase();
  return !form?.id || !un || un === unidadePadraoDepartamento(form?.departamento);
}

export function rendimentoSomado(itens, departamento) {
  return rendimentoPelosIngredientes(itens, departamento);
}

// Estado inicial do editor. `ficha` nula = ficha nova; `rascunho` vem da IA.
export function estadoInicialDoEditor({ departamento, tipo = null, ficha = null, rascunho = null, todasFichas = [], complementos = null }) {
  const dept = setorId(ficha?.departamento || rascunho?.departamento || departamento);
  if (ficha) {
    // Sem os complementos (ainda carregando), vale só o texto da própria ficha:
    // o que está nas tabelas filhas entra quando elas chegam, senão uma ficha
    // antiga abriria com meia montagem.
    const instrucoes = complementos ? textoDeInstrucoes(ficha, complementos) : String(ficha.modo_preparo || "").trim();
    return {
      form: {
        id: ficha.id,
        unidade_id: ficha.unidade_id || null,
        codigo: ficha.codigo || "",
        nome_receita: ficha.nome_receita || "",
        categoria: ficha.categoria || "",
        departamento: dept,
        imagem: ficha.imagem || "",
        modo_preparo: instrucoes,
        rendimento_porcoes: ficha.rendimento_porcoes != null ? String(ficha.rendimento_porcoes) : "",
        rendimento_unidade: ficha.rendimento_unidade || unidadePadraoDepartamento(dept),
        tempo_preparo: ficha.tempo_preparo != null ? String(ficha.tempo_preparo) : "",
        peso_final_g: ficha.peso_final_g != null ? String(ficha.peso_final_g) : "",
        responsavel: ficha.responsavel || "",
        alergenicos_pode_conter: ficha.alergenicos_pode_conter || "",
        // Não aparece no editor: só entra na conta do custo por porção.
        peso_porcao_g: ficha.peso_porcao_g ?? "",
      },
      itens: (ficha.fichas_ingredientes || []).map(fi => itemDeIngrediente(fi, todasFichas)),
      armazenamento: armazenamentoParaEditar(complementos?.armazenamento, ficha),
      armazenamentoOriginal: complementos?.armazenamento || null,
      equipamentos: (complementos?.equipamentos || []).map(e => (typeof e === "string" ? e : e?.nome)).filter(Boolean),
      alergenicos: (complementos?.alergenicos || []).map(a => (typeof a === "string" ? a : a?.alergenico)).filter(Boolean),
      // Ficha existente abre com o rendimento gravado. O prato (que não mostra
      // rendimento) continua somando os ingredientes como antes, exceto quando
      // tem peso de porção — aí o rendimento define quantas porções saem e não
      // pode mudar sem a pessoa ver. O pré-preparo só soma se ela pedir.
      autoRendimento: tipoFichaDe(ficha) === "prato"
        && !(parseNumero(ficha.peso_porcao_g) > 0)
        && rendimentoEhAutomatizavel({ id: ficha.id, departamento: dept, rendimento_unidade: ficha.rendimento_unidade }),
    };
  }
  // Rascunho da IA já vem com ingredientes: o rendimento sai da soma deles na
  // hora, como sairia se tivessem sido digitados um a um.
  const itensDoRascunho = rascunho?.itens || [];
  const somaInicial = itensDoRascunho.length ? rendimentoPelosIngredientes(itensDoRascunho, dept) : null;
  // Prato novo: o rendimento é o peso final servido, em gramas. Começa na soma
  // dos ingredientes (ou no que a IA estimou) e é para ser ajustado à mão —
  // cozinhar, reduzir e escorrer mudam o peso que vai ao cliente.
  const pesoInicialDoPrato = tipo === "prato"
    ? (parseNumero(rascunho?.peso_final_g) > 0
      ? String(Math.round(parseNumero(rascunho.peso_final_g)))
      : (somaInicial ? String(Math.round(somaInicial.valor * 1000)) : ""))
    : "";
  return {
    form: {
      id: null,
      unidade_id: null,
      codigo: "",
      nome_receita: rascunho?.nome_receita || "",
      categoria: rascunho?.categoria || "",
      departamento: dept,
      imagem: "",
      modo_preparo: rascunho?.modo_preparo || "",
      rendimento_porcoes: rascunho?.rendimento_porcoes ? String(rascunho.rendimento_porcoes) : (somaInicial ? String(somaInicial.valor) : "1"),
      rendimento_unidade: somaInicial ? somaInicial.unidade : unidadePadraoDepartamento(dept),
      tempo_preparo: rascunho?.tempo_preparo ? String(rascunho.tempo_preparo) : "",
      peso_final_g: pesoInicialDoPrato,
      responsavel: "",
      alergenicos_pode_conter: "",
    },
    itens: itensDoRascunho,
    // O rascunho da IA já vem no formato do editor (recipiente, forma, validade_dias).
    armazenamento: { recipiente: "", forma: "", local_armazenamento: "", validade_dias: "", ...(rascunho?.armazenamento || {}) },
    armazenamentoOriginal: null,
    equipamentos: rascunho?.equipamentos || [],
    alergenicos: rascunho?.alergenicos || [],
    autoRendimento: true,
  };
}

// Reaproveitado pela tela de detalhe e pela etiqueta.
export { validadePrincipal };
