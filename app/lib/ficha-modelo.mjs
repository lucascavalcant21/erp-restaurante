// Modelo da ficha técnica: o que é um PRATO, o que é um PRÉ-PREPARO e o que
// cada um mostra. Funções puras, sem Supabase e sem React, testadas em
// ficha-modelo.test.mjs.
//
// Tipo e setor são coisas independentes:
//   tipo   prato       ficha rápida de MONTAGEM — o que vai no prato e como montar
//          pre_preparo ficha de PRODUÇÃO — rendimento, preparo, validade, custo
//   setor  cozinha | bar
//
// O tipo vem do campo estrutural que o banco já tem (`fichas_tecnicas.eh_base`),
// nunca do nome da categoria. O setor vem de `departamento`. Nenhuma coluna nova.
//
// Tudo o que muda de um tipo para o outro está em TIPOS_FICHA. Editor,
// visualização, PDF, Livro de Receitas e IA leem daqui — nenhuma tela decide
// sozinha se um campo aparece.

import {
  parseNumero, tipoDaFicha, custoDeProduzirFicha, converterParaBaseDoInsumo,
  unidadePadraoDepartamento, rendimentoPadronizado, pesoTotalDaFicha,
} from "./ficha-calculos.mjs";
import { unidadeNormalizada as unidadeBaseDoInsumo } from "./ingredientes-utils.mjs";
import { hasPermission, permissionKey } from "./permissions-catalog.mjs";

// O editor soma o rendimento pelos ingredientes com a mesma regra de antes.
export { rendimentoPelosIngredientes, unidadePadraoDepartamento, rendimentoPadronizado } from "./ficha-calculos.mjs";

// ─── Tipos ──────────────────────────────────────────────────────────────────

// `mostra` é a lista do que existe no tipo. O que não está aqui não aparece no
// editor, na visualização nem no PDF — não é "escondido", simplesmente não é
// montado. Os `false` ficam escritos de propósito, para ninguém precisar
// adivinhar se um campo foi esquecido ou tirado.
export const TIPOS_FICHA = {
  prato: {
    id: "prato",
    rotulo: "Prato",
    rotuloPlural: "Pratos",
    tituloDocumento: "FICHA DE PRATO",
    resumo: "Ficha de montagem: o que vai no prato, quanto e como montar.",
    // Verde da marca (o mesmo --accent do sistema).
    cor: "#047857",
    corSuave: "#ECFDF5",
    corLinha: "#A7F3D0",
    corVar: "var(--ficha-prato)",
    corSuaveVar: "var(--ficha-prato-soft)",
    corFgVar: "var(--ficha-prato-fg)",
    instrucoes: {
      titulo: "Montagem do prato",
      placeholder: "1. Posicionar o arroz no lado esquerdo do prato.\n2. Distribuir a picanha fatiada ao centro.\n3. Colocar a batata no lado direito.\n4. Servir vinagrete e farofa conforme a foto padrão.",
      vazio: "Nenhum passo de montagem cadastrado.",
    },
    // Seções com faixa colorida na ficha impressa; as demais têm só o título.
    destaques: ["ingredientes", "instrucoes"],
    // Rendimento do prato: o peso final servido, sempre em gramas. Não é a soma
    // crua dos ingredientes — cocção, redução, drenagem, absorção e perdas
    // mudam o número —, por isso é digitado. Mora em `peso_final_g`, que é
    // exatamente "o que sai pronto"; o rendimento interno em kg (soma dos
    // ingredientes) continua existindo para o CMV e não aparece na ficha.
    rendimento: { campo: "peso_final_g", unidadeFixa: "g", rotulo: "Rendimento", ajuda: "Peso final servido. Não precisa bater com a soma dos ingredientes." },
    mostra: {
      codigo: true,
      versaoEData: false,
      responsavel: false,
      categoria: true,
      setor: true,
      foto: true,
      rendimento: true,
      tempoPreparo: false,
      tempoCoccao: false,
      pesoFinal: false,
      instrucoes: true,
      armazenamento: false,
      equipamentos: false,
      alergenicos: false,
      custos: false,
      custoEmbalagem: false,
      observacoes: false,
      informacoesAdicionais: false,
    },
  },
  pre_preparo: {
    id: "pre_preparo",
    rotulo: "Pré-preparo",
    rotuloPlural: "Pré-preparos",
    tituloDocumento: "FICHA DE PRÉ-PREPARO",
    resumo: "Ficha de produção: rendimento, preparo, armazenamento e custo.",
    // Azul-petróleo: segunda identidade, para não confundir com o prato.
    cor: "#164E63",
    corSuave: "#ECFEFF",
    corLinha: "#A5D8E6",
    corVar: "var(--ficha-preparo)",
    corSuaveVar: "var(--ficha-preparo-soft)",
    corFgVar: "var(--ficha-preparo-fg)",
    instrucoes: {
      titulo: "Modo de preparo",
      placeholder: "1. Colocar o tucupi na panela.\n2. Acrescentar os ingredientes.\n3. Levar ao fogo.\n4. Reduzir até atingir o rendimento padrão.\n5. Resfriar conforme o procedimento interno.",
      vazio: "Nenhum passo de preparo cadastrado.",
    },
    destaques: ["ingredientes", "instrucoes", "armazenamento"],
    // Pré-preparo rende em peso ou volume (kg/L do setor, ou a unidade antiga
    // da ficha) — continua flexível, não vira grama fixa.
    rendimento: { campo: "rendimento_porcoes", unidadeFixa: null, rotulo: "Rendimento", ajuda: "" },
    mostra: {
      codigo: true,
      versaoEData: true,
      responsavel: true,
      categoria: true,
      setor: true,
      foto: true,
      rendimento: true,
      tempoPreparo: true,
      tempoCoccao: false,
      pesoFinal: true,
      instrucoes: true,
      armazenamento: true,
      equipamentos: true,
      alergenicos: true,
      custos: true,
      custoEmbalagem: false,
      observacoes: false,
      informacoesAdicionais: false,
    },
  },
};

export const ORDEM_TIPOS = ["prato", "pre_preparo"];

// "prato" | "pre_preparo" a partir do registro do banco. Produto comprado pronto
// (cerveja, refrigerante) não é receita e fica de fora do receituário; quem
// perguntar por ele recebe "produto_pronto" e decide o que fazer.
export function tipoFichaDe(ficha) {
  const tipo = tipoDaFicha(ficha);
  if (tipo === "preparo") return "pre_preparo";
  return tipo; // "prato" | "produto_pronto"
}

export function configDoTipo(tipo) {
  return TIPOS_FICHA[tipo] || TIPOS_FICHA.prato;
}

export function configDaFicha(ficha) {
  return configDoTipo(tipoFichaDe(ficha));
}

// Variáveis de cor do tipo para as telas: `style={estiloDoTipo(cfg)}` num
// contêiner, e as classes usam var(--tipo), var(--tipo-soft) e var(--tipo-fg).
export function estiloDoTipo(tipoOuConfig) {
  const cfg = typeof tipoOuConfig === "string" ? configDoTipo(tipoOuConfig) : (tipoOuConfig || TIPOS_FICHA.prato);
  return { "--tipo": cfg.corVar, "--tipo-soft": cfg.corSuaveVar, "--tipo-fg": cfg.corFgVar };
}

// Colunas estruturais que o tipo grava. É isto que separa um do outro no banco.
export function marcadoresDoTipo(tipo) {
  return tipo === "pre_preparo"
    ? { eh_base: true, tipo_base: "pre" }
    : { eh_base: false, tipo_base: null };
}

// ─── Setores ────────────────────────────────────────────────────────────────

export const SETORES = {
  cozinha: { id: "cozinha", rotulo: "Cozinha" },
  bar: { id: "bar", rotulo: "Bar" },
};

export function setorId(departamento) {
  return String(departamento || "").toLowerCase() === "bar" ? "bar" : "cozinha";
}

export function setorDaFicha(ficha) {
  return SETORES[setorId(ficha?.departamento)];
}

// kg na cozinha, L no bar — o rendimento da ficha é sempre nessa unidade.
export function rotuloUnidadeSetor(departamento) {
  return unidadePadraoDepartamento(departamento) === "l" ? "L" : "kg";
}

// ─── Categorias ─────────────────────────────────────────────────────────────

// Listas iniciais, na ordem pedida pelo restaurante. A unidade pode criar e
// excluir categorias (fica em config_sistema); as que aparecem nas fichas
// também entram, para nenhuma ficha ficar com categoria "sumida".
export const CATEGORIAS_INICIAIS = {
  cozinha: {
    prato: ["Prato principal 1 pessoa", "Prato principal 2 pessoas", "Entradas", "Sobremesas", "Acompanhamentos"],
    pre_preparo: [
      "Empanamentos e farinhas", "Salmouras e marinadas", "Molhos e caldos", "Arroz, feijão e grãos",
      "Massas e recheios", "Carnes e proteínas", "Guarnições e acompanhamentos", "Sobremesas e bases doces",
      "Outros preparos",
    ],
  },
  bar: {
    prato: ["Cervejas", "Destilados", "Vinhos", "Chopp", "Água", "Refrigerantes", "Bombons"],
    pre_preparo: ["Xaropes", "Espumas", "Geleias", "Mixes e infusões", "Outros pré-preparos"],
  },
};

// A configuração salva usa as chaves antigas da tela: "principais" (pratos) e
// "preparos". Mantidas para não perder as categorias que a unidade já criou.
export const CHAVE_CONFIG_CATEGORIA = { prato: "principais", pre_preparo: "preparos" };

export function configCategoriasDoTipo(config = {}, departamento, tipo) {
  const doSetor = config?.[setorId(departamento)] || {};
  const chave = CHAVE_CONFIG_CATEGORIA[tipo] || "principais";
  // Configuração antiga (antes de existir a divisão) era plana e valia para pratos.
  const doTipo = doSetor?.[chave] || (chave === "principais" && !doSetor?.preparos ? doSetor : {});
  return {
    adicionais: Array.isArray(doTipo?.adicionais) ? doTipo.adicionais : [],
    excluidas: Array.isArray(doTipo?.excluidas) ? doTipo.excluidas : [],
  };
}

export function categoriasDoTipo({ departamento, tipo, config = {}, fichas = [] }) {
  const setor = setorId(departamento);
  const { adicionais, excluidas } = configCategoriasDoTipo(config, setor, tipo);
  const dasFichas = fichas
    .filter(f => setorId(f.departamento) === setor && tipoFichaDe(f) === tipo)
    .map(f => f.categoria)
    .filter(Boolean);
  return [...new Set([...(CATEGORIAS_INICIAIS[setor]?.[tipo] || []), ...adicionais, ...dasFichas])]
    .filter(c => !excluidas.includes(c))
    .sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

// ─── Listas de referência ───────────────────────────────────────────────────

// Alergênicos de declaração obrigatória (RDC 727/2022) + "outros".
export const ALERGENICOS = [
  "Glúten", "Leite", "Ovos", "Soja", "Amendoim", "Castanhas",
  "Peixe", "Crustáceos", "Moluscos", "Gergelim", "Outros",
];

export const EQUIPAMENTOS_SUGERIDOS = [
  "Chapa", "Fritadeira", "Forno", "Fogão", "Panela", "Frigideira",
  "Liquidificador", "Processador", "Balança", "Faca", "Tábua de corte",
  "Espátula", "Fouet", "GN", "Batedeira", "Coifa", "Micro-ondas",
];

// Como o pré-preparo é conservado. Vai para `fichas_armazenamento.forma`.
export const CONSERVACOES = ["Refrigerado", "Congelado", "Temperatura ambiente", "Seco", "A vácuo"];

// Método do drink. Batido e mexido não são estilo: mudam o resultado no copo.
// Continua aqui porque fichas antigas do bar têm o método gravado e ele é
// levado para a montagem quando a ficha é aberta no editor novo.
export const METODOS_BAR = [
  { id: "batido", nome: "Batido (shaker)", ajuda: "Suco, xarope, creme ou clara de ovo" },
  { id: "mexido", nome: "Mexido (mixing glass)", ajuda: "Só destilados — límpido e sedoso" },
  { id: "montado", nome: "Montado no copo", ajuda: "Direto no copo do cliente, sem transferir" },
  { id: "liquidificador", nome: "Liquidificador", ajuda: "Frozen e batidas com gelo triturado" },
  { id: "dose", nome: "Dose pura", ajuda: "Servido puro, sem preparo" },
];
export const metodoBar = (id) => METODOS_BAR.find(m => m.id === id) || null;

export const TIPOS_GELO = [
  "Sem gelo", "Cubo", "Cubo grande", "Triturado (crushed)", "Esfera", "Gelo seco",
];

export const STATUS_FICHA = [
  { valor: "ativa", rotulo: "Ativa" },
  { valor: "inativa", rotulo: "Inativa" },
  { valor: "rascunho", rotulo: "Rascunho" },
];

// ─── Permissão de custo ─────────────────────────────────────────────────────

// Falha para o lado aberto onde o controle de acesso ainda não foi ligado
// (`gerenciado` falso), igual ao guarda de rota do painel — senão ninguém veria
// custo nenhum nessas instalações.
export function podeVerCustosFicha(sessao, departamento) {
  if (!sessao?.gerenciado) return true;
  return hasPermission(sessao, permissionKey("fichas", "recipes", "view_costs"))
    || hasPermission(sessao, permissionKey(setorId(departamento), "recipes", "view_costs"));
}

// ─── Formatação ─────────────────────────────────────────────────────────────

const numeroBR = (n, casas = 2) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: casas });

export const brl = (v) => `R$ ${(Number(v) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Custo por kg de pré-preparo pode ser miúdo; com duas casas "R$ 0,01" some
// justamente a informação que interessa.
export const brlUnitario = (v) => {
  const n = Number(v) || 0;
  const casas = n !== 0 && Math.abs(n) < 0.1 ? 4 : 2;
  return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}`;
};

const PLURAIS = { "porção": "porções", porcao: "porções", fatia: "fatias", pacote: "pacotes", "colher": "colheres" };

// A unidade vai junto da quantidade, num texto só: "300 g", "50 ml", "2 un".
// kg e L aparecem em g e ml — é como a cozinha pesa e como o exemplo do
// restaurante pede ("Tucupi 1.000 ml").
export function quantidadeComUnidade(quantidade, unidade) {
  const n = parseNumero(quantidade);
  const u = String(unidade || "").trim().toLowerCase().replace(/\.$/, "");
  if (u === "kg") return `${numeroBR(n * 1000, 1)} g`;
  if (u === "l") return `${numeroBR(n * 1000, 1)} ml`;
  if (u === "g" || u === "ml") return `${numeroBR(n, 1)} ${u}`;
  if (u === "mg") return `${numeroBR(n, 1)} mg`;
  if (!u || u === "un" || u === "unidade" || u === "unidades") return `${numeroBR(n, 2)} un`;
  if (u === "porcao" || u === "porção" || u === "porções") return `${numeroBR(n, 2)} ${n === 1 ? "porção" : "porções"}`;
  return `${numeroBR(n, 2)} ${n !== 1 && PLURAIS[u] ? PLURAIS[u] : u}`;
}

// Peso/volume em gramas (ou ml) mostrado na unidade do setor: "1,6 kg", "750 ml".
export function textoPesoFinal(pesoG, departamento) {
  const g = parseNumero(pesoG);
  if (!(g > 0)) return "";
  const bar = setorId(departamento) === "bar";
  if (g >= 1000) return `${numeroBR(g / 1000, 3)} ${bar ? "L" : "kg"}`;
  return `${numeroBR(g, 1)} ${bar ? "ml" : "g"}`;
}

// Unidades de rendimento que não são peso nem volume (fichas antigas).
const RENDIMENTO_CONTADO = ["un", "unidade", "porcao", "porção", "porções"];
const rendimentoContado = (ficha) => RENDIMENTO_CONTADO.includes(String(ficha?.rendimento_unidade || "").toLowerCase());

// Rendimento na unidade do setor: "2,5 kg", "1,2 L". Ficha antiga que rende em
// unidades mostra a contagem ("20 un"), com o peso ao lado quando dá para saber.
export function textoRendimento(ficha) {
  const rend = parseNumero(ficha?.rendimento_porcoes);
  if (!(rend > 0)) return "";
  const padrao = rendimentoPadronizado(ficha);
  const emPeso = `${numeroBR(padrao.valor, 3)} ${padrao.unidade === "l" ? "L" : "kg"}`;
  if (!rendimentoContado(ficha)) return emPeso;
  const contagem = quantidadeComUnidade(rend, ficha.rendimento_unidade);
  const pesoG = pesoTotalDaFicha(rend, ficha.rendimento_unidade, ficha.peso_porcao_g);
  return pesoG > 0 ? `${contagem} (${emPeso})` : contagem;
}

// Rendimento do prato: peso final servido, sempre em gramas ("420 g").
export function textoRendimentoPrato(ficha) {
  const g = parseNumero(ficha?.peso_final_g);
  return g > 0 ? `${numeroBR(g, 0)} g` : "";
}

// O rendimento no modelo do tipo: gramas no prato, peso/volume no pré-preparo.
export function textoRendimentoDoTipo(ficha, tipo = tipoFichaDe(ficha)) {
  return tipo === "pre_preparo" ? textoRendimento(ficha) : textoRendimentoPrato(ficha);
}

export function textoTempo(minutos) {
  const n = parseNumero(minutos);
  if (!(n > 0)) return "";
  if (n < 60) return `${numeroBR(n, 0)} min`;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}

const dataBR = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? "" : dt.toLocaleDateString("pt-BR");
};

const texto = (v) => String(v ?? "").trim();

export function fotoDaFicha(ficha) {
  const img = texto(ficha?.imagem);
  if (!img) return "";
  return img.startsWith("data:") ? img : `data:image/jpeg;base64,${img}`;
}

// ─── Ingredientes ───────────────────────────────────────────────────────────

// Uma linha por ingrediente, só nome e quantidade — sem coluna de observação.
// A quantidade gravada está na unidade do insumo (g, kg, L...) ou, se for um
// pré-preparo, na unidade do rendimento dele.
export function ingredientesDaFicha(ficha, todasFichas = []) {
  return (ficha?.fichas_ingredientes || []).map(fi => {
    if (fi.subficha_id) {
      const base = todasFichas.find(f => f.id === fi.subficha_id);
      return {
        nome: base?.nome_receita || "Pré-preparo removido",
        quantidade: quantidadeComUnidade(fi.quantidade, base?.rendimento_unidade || "kg"),
        prePreparo: true,
      };
    }
    const insumo = fi.insumos || {};
    const base = unidadeBaseDoInsumo(insumo.unidade_medida) || String(insumo.unidade_medida || "un").toLowerCase();
    return {
      nome: insumo.nome || "Ingrediente removido",
      quantidade: quantidadeComUnidade(converterParaBaseDoInsumo(fi.quantidade, insumo.unidade_medida, base), base),
      prePreparo: false,
    };
  });
}

// ─── Instruções (montagem ou modo de preparo) ───────────────────────────────

// Separa o texto em passos. Aceita "1. Fazer", "1) Fazer", "- Fazer" e linhas
// soltas. Linha que começa com "•" (ou recuada) é detalhe do passo anterior —
// é o formato que a IA devolve ("   • Panela · Fogo médio · 5 min").
// "Tempo total: 35 min" vira nota, não passo.
export function passosDeTexto(textoLivre) {
  const passos = [];
  const notas = [];
  for (const bruta of String(textoLivre || "").split(/\r?\n/)) {
    if (!bruta.trim()) continue;
    const recuada = /^\s{2,}\S/.test(bruta) || /^\s*[•·]/.test(bruta);
    const limpa = bruta.trim().replace(/^[•·]\s*/, "").replace(/^\d+\s*[.)\-–:]\s*/, "").replace(/^[-–]\s+/, "").trim();
    if (!limpa) continue;
    if (/^tempo total\s*:/i.test(limpa)) { notas.push(limpa); continue; }
    if (recuada && passos.length) passos[passos.length - 1].detalhes.push(limpa);
    else passos.push({ texto: limpa, detalhes: [] });
  }
  return { passos, notas };
}

// Transforma as etapas estruturadas antigas (tabela fichas_etapas) em texto.
function etapasEmTexto(etapas = []) {
  return etapas
    .filter(e => texto(e?.titulo) || texto(e?.instrucao))
    .map((e, i) => {
      const cabeca = [texto(e.titulo), texto(e.instrucao)].filter(Boolean).join(": ");
      const extras = [
        e.tempo_min ? `${e.tempo_min} min` : "",
        texto(e.temperatura), texto(e.equipamento), texto(e.observacao),
      ].filter(Boolean);
      return `${i + 1}. ${cabeca}${extras.length ? `\n   • ${extras.join(" · ")}` : ""}`;
    })
    .join("\n");
}

// Fichas de prato antigas guardavam parte da montagem em campos que o modelo
// novo não tem (guarnição, método, copo, gelo). Quando a ficha ainda não tem
// texto de montagem, esses dados viram linhas do texto — nada se perde.
function montagemLegada(ficha, montagemPassos = []) {
  const linhas = montagemPassos
    .map(p => texto(typeof p === "string" ? p : p?.descricao))
    .filter(Boolean)
    .map((d, i) => `${i + 1}. ${d}`);
  const padrao = texto(ficha?.padrao_montagem);
  if (!linhas.length && padrao && !/^conforme foto$/i.test(padrao)) linhas.push(padrao);
  const extras = [
    metodoBar(ficha?.metodo_bar) ? `Método: ${metodoBar(ficha.metodo_bar).nome}` : "",
    texto(ficha?.copo) ? `Copo: ${texto(ficha.copo)}` : "",
    texto(ficha?.tipo_gelo) ? `Gelo: ${texto(ficha.tipo_gelo)}` : "",
    texto(ficha?.guarnicao) ? `Guarnição: ${texto(ficha.guarnicao)}` : "",
  ].filter(Boolean);
  return [...linhas, ...extras].join("\n");
}

// O texto das instruções da ficha: montagem no prato, modo de preparo no
// pré-preparo. Mora em `modo_preparo` nos dois tipos — o rótulo é que muda.
// Fichas antigas sem esse texto caem para o que tinham antes.
export function textoDeInstrucoes(ficha, complementos = {}) {
  const atual = texto(ficha?.modo_preparo);
  if (atual) return atual;
  if (tipoFichaDe(ficha) === "pre_preparo") return etapasEmTexto(complementos?.etapas || []);
  return montagemLegada(ficha, complementos?.montagem || complementos?.montagem_passos || []);
}

// ─── Armazenamento ──────────────────────────────────────────────────────────

const dias = (n) => `${numeroBR(n, 0)} ${Number(n) === 1 ? "dia" : "dias"}`;
const temValor = (v) => v !== null && v !== undefined && v !== "" && parseNumero(v) > 0;

// De onde vem a validade principal: a coluna da forma de conservação escolhida
// (congelado usa a de congelado; o resto, a de refrigerado), depois a outra, e
// por último a validade gravada na própria ficha.
function origemDaValidade(armazenamento = {}, ficha = {}) {
  const arm = armazenamento || {};
  const ordem = arm.forma === "Congelado"
    ? ["validade_congelado_dias", "validade_refrigerado_dias"]
    : ["validade_refrigerado_dias", "validade_congelado_dias"];
  for (const coluna of ordem) if (temValor(arm[coluna])) return { coluna, valor: parseNumero(arm[coluna]) };
  if (temValor(ficha?.validade_dias)) return { coluna: "validade_dias", valor: parseNumero(ficha.validade_dias) };
  return null;
}

export function validadePrincipal(armazenamento = {}, ficha = {}) {
  return origemDaValidade(armazenamento, ficha)?.valor ?? null;
}

// Duas linhas, como na ficha impressa: "Forma / recipiente" e "Local e
// validade". Observações do armazenamento não entram — o campo saiu do modelo.
export function linhasDeArmazenamento(armazenamento = {}, ficha = {}) {
  const arm = armazenamento || {};
  const linhas = [];
  const recipiente = texto(arm.recipiente);
  if (recipiente) linhas.push({ rotulo: "Forma / recipiente", valor: recipiente });

  const origem = origemDaValidade(arm, ficha);
  const lugar = [texto(arm.forma), texto(arm.local_armazenamento)].filter(Boolean).join(" · ");
  // Validades antigas que não são a principal continuam aparecendo: são
  // informação de conservação, não observação.
  const outras = [
    origem?.coluna !== "validade_refrigerado_dias" && temValor(arm.validade_refrigerado_dias) ? `refrigerado ${dias(arm.validade_refrigerado_dias)}` : "",
    origem?.coluna !== "validade_congelado_dias" && temValor(arm.validade_congelado_dias) ? `congelado ${dias(arm.validade_congelado_dias)}` : "",
    temValor(arm.validade_apos_aberto_dias) ? `após aberto ${dias(arm.validade_apos_aberto_dias)}` : "",
    temValor(arm.validade_apos_preparo_horas) ? `após o preparo ${numeroBR(arm.validade_apos_preparo_horas, 0)} h` : "",
  ].filter(Boolean);
  const validade = origem ? `validade ${dias(origem.valor)}` : "";
  const partes = [lugar, [validade, ...outras].filter(Boolean).join("; ")].filter(Boolean);
  if (partes.length) linhas.push({ rotulo: "Local e validade", valor: partes.join(" — ") });
  return linhas;
}

// ─── Custos ─────────────────────────────────────────────────────────────────

// Custos do pré-preparo, sem embalagem (pré-preparo não é vendido embalado).
// O total é o mesmo número que o ERP usa quando o pré-preparo entra num prato:
// a conta é a de custoDeProduzirFicha, não uma cópia.
export function custosDoPrePreparo(ficha, todasFichas = []) {
  const ingredientes = custoDeProduzirFicha({ ...ficha, custo_embalagens_total: 0 }, todasFichas);
  const total = custoDeProduzirFicha(ficha, todasFichas);
  // Por unidade do rendimento: é o número que entra nos pratos. Ficha antiga
  // em unidades custa "por un"; as demais, por kg ou L.
  if (rendimentoContado(ficha)) {
    const qtd = parseNumero(ficha?.rendimento_porcoes);
    const un = String(ficha.rendimento_unidade).toLowerCase();
    return { ingredientes, total, porUnidade: qtd > 0 ? total / qtd : null, unidade: un === "un" || un === "unidade" ? "un" : "porção" };
  }
  const rend = rendimentoPadronizado(ficha);
  return {
    ingredientes,
    total,
    porUnidade: rend.valor > 0 ? total / rend.valor : null,
    unidade: rend.unidade === "l" ? "L" : "kg",
  };
}

// Custo da ficha e custo por porção — a conta do CMV, igual à da listagem.
// Porções: o rendimento em porções/unidades, ou o peso total dividido pelo
// peso da porção. Sem nenhum dos dois, a receita inteira é uma porção.
export function custoPorPorcaoDaFicha(ficha, todasFichas = []) {
  const custoTotal = custoDeProduzirFicha(ficha, todasFichas);
  const un = String(ficha?.rendimento_unidade || "porcao").toLowerCase();
  const rend = parseNumero(ficha?.rendimento_porcoes);
  const pesoPorcao = parseNumero(ficha?.peso_porcao_g);
  let porcoes = 0;
  if (un === "porcao" || un === "un") porcoes = rend;
  else {
    const pesoTotal = pesoTotalDaFicha(rend, un, pesoPorcao);
    porcoes = pesoTotal > 0 && rend > 0 && pesoPorcao > 0 ? pesoTotal / pesoPorcao : 0;
  }
  return { custoTotal, custoPorcao: porcoes > 0 ? custoTotal / porcoes : custoTotal };
}

// A embalagem do produto do Cardápio entra no custo da ficha (é assim que o
// CMV do prato sempre foi calculado). Devolve cópias com custo_embalagens_total.
export function comCustoDeEmbalagens(fichas = [], produtos = [], embalagensEstoque = []) {
  return fichas.map(ficha => {
    const produto = produtos.find(item => item.ficha_id === ficha.id);
    const doProduto = Array.isArray(produto?.embalagens) ? produto.embalagens : [];
    const custoPorPorcao = doProduto.reduce((total, item) => {
      const embalagem = embalagensEstoque.find(emb => String(emb.id) === String(item.embalagem_id));
      return total + (Number(embalagem?.preco_unitario) || 0) * (Number(item.qtd) || 0);
    }, 0);
    const rendimento = Math.max(1, Number(ficha.rendimento_porcoes) || 1);
    return { ...ficha, custo_embalagens_total: custoPorPorcao * rendimento };
  });
}

// ─── Dados da ficha para tela e documento ───────────────────────────────────

const par = (rotulo, valor) => ({ rotulo, valor: texto(valor) });
const soPreenchidos = (lista) => lista.filter(item => item.valor);

// Tudo o que a ficha mostra, já decidido pelo tipo. A visualização na tela e o
// PDF desenham a partir daqui; seção sem conteúdo volta como `null` e não é
// desenhada.
export function dadosDaFicha(ficha, { todasFichas = [], complementos = null, mostrarCustos = false } = {}) {
  const tipo = tipoFichaDe(ficha) === "pre_preparo" ? "pre_preparo" : "prato";
  const config = TIPOS_FICHA[tipo];
  const m = config.mostra;
  const setor = setorDaFicha(ficha);
  const comp = complementos || {
    etapas: ficha?.etapas, equipamentos: ficha?.equipamentos, alergenicos: ficha?.alergenicos,
    armazenamento: ficha?.armazenamento, montagem: ficha?.montagem_passos,
  };

  const cabecalho = soPreenchidos([
    m.codigo ? par("Código", ficha?.codigo) : null,
    m.versaoEData ? par("Versão", ficha?.versao || "1.0") : null,
    m.versaoEData ? par("Data", dataBR(ficha?.atualizado_em || ficha?.updated_at || ficha?.created_at)) : null,
    m.responsavel ? par("Responsável", ficha?.responsavel) : null,
  ].filter(Boolean));

  const identificacao = soPreenchidos([
    m.categoria ? par("Categoria", ficha?.categoria) : null,
    m.rendimento ? par(config.rendimento.rotulo, textoRendimentoDoTipo(ficha, tipo)) : null,
    m.tempoPreparo ? par("Tempo de preparo", textoTempo(ficha?.tempo_preparo)) : null,
    m.pesoFinal ? par(setor.id === "bar" ? "Volume final" : "Peso final", textoPesoFinal(ficha?.peso_final_g, ficha?.departamento)) : null,
    m.setor ? par("Setor", setor.rotulo) : null,
  ].filter(Boolean));

  const { passos, notas } = passosDeTexto(m.instrucoes ? textoDeInstrucoes(ficha, comp) : "");

  const armazenamento = m.armazenamento ? linhasDeArmazenamento(comp?.armazenamento, ficha) : [];
  const equipamentos = m.equipamentos
    ? (comp?.equipamentos || []).map(e => texto(typeof e === "string" ? e : e?.nome)).filter(Boolean)
    : [];
  const alergenicos = m.alergenicos
    ? (comp?.alergenicos || []).map(a => texto(typeof a === "string" ? a : a?.alergenico)).filter(Boolean)
    : [];

  let custos = null;
  if (m.custos && mostrarCustos) {
    const c = custosDoPrePreparo(ficha, todasFichas);
    custos = [
      { rotulo: "Custo dos ingredientes", valor: brl(c.ingredientes) },
      { rotulo: "Custo total", valor: brl(c.total), forte: true },
      ...(c.porUnidade != null ? [{ rotulo: `Custo por ${c.unidade}`, valor: brlUnitario(c.porUnidade) }] : []),
    ];
  }

  return {
    tipo,
    config,
    setor,
    nome: texto(ficha?.nome_receita) || "Sem nome",
    codigo: texto(ficha?.codigo),
    foto: m.foto ? fotoDaFicha(ficha) : "",
    cabecalho,
    identificacao,
    ingredientes: ingredientesDaFicha(ficha, todasFichas),
    instrucoes: passos.length || notas.length ? { titulo: config.instrucoes.titulo, passos, notas } : null,
    armazenamento: armazenamento.length ? armazenamento : null,
    equipamentos: equipamentos.length ? equipamentos : null,
    // Alergênico é declaração: "não contém" também é informação.
    alergenicos: m.alergenicos
      ? { contem: alergenicos, podeConter: texto(ficha?.alergenicos_pode_conter) }
      : null,
    custos,
  };
}

// ─── Gravação ───────────────────────────────────────────────────────────────

const numeroOuNulo = (v) => (v === "" || v === null || v === undefined ? null : parseNumero(v));

// Colunas de `fichas_tecnicas` que o editor grava, por tipo.
//
// Na edição, o que NÃO é do tipo simplesmente não entra no UPDATE: tempo de
// cocção, observações, preço, embalagem e afins de fichas antigas continuam no
// banco, intocados — só deixam de ser usados. Nada é apagado.
//
// Preço de venda e meta de CMV do prato são do Cardápio e do ERP, não da
// ficha: na edição ficam como estão; numa ficha nova a meta nasce em 30%.
export function camposParaGravar(tipo, form = {}, { novo = false, unidadeId = null, agora = new Date().toISOString() } = {}) {
  const departamento = setorId(form.departamento);
  const campos = {
    nome_receita: texto(form.nome_receita),
    categoria: texto(form.categoria) || null,
    departamento,
    imagem: texto(form.imagem) || null,
    ...marcadoresDoTipo(tipo),
    // O rendimento continua existindo no prato: é dele que sai o custo por
    // porção do CMV. Só não é mais digitado — vem da soma dos ingredientes.
    rendimento_porcoes: parseNumero(form.rendimento_porcoes) || 1,
    rendimento_unidade: texto(form.rendimento_unidade) || unidadePadraoDepartamento(departamento),
    // Montagem (prato) ou modo de preparo (pré-preparo): o mesmo campo de texto.
    modo_preparo: String(form.modo_preparo ?? "").trim(),
    atualizado_em: agora,
  };

  // Rendimento do prato: o peso final servido, digitado em gramas.
  if (tipo === "prato") campos.peso_final_g = numeroOuNulo(form.peso_final_g);
  if (parseNumero(form.custo_embalagem) > 0) {
    campos.custo_embalagem = parseNumero(form.custo_embalagem);
    campos.custo_embalagens_total = parseNumero(form.custo_embalagem) * (parseNumero(form.rendimento_porcoes) || 1);
  }
  if (parseNumero(form.preco_venda) > 0) {
    campos.preco_venda = parseNumero(form.preco_venda);
  }
  if (form.taxa_maquininha !== "" && form.taxa_maquininha != null) {
    campos.taxa_maquininha = parseNumero(form.taxa_maquininha);
  }
  if (form.imposto_pct !== "" && form.imposto_pct != null) {
    campos.imposto_pct = parseNumero(form.imposto_pct);
  }
  if (form.cmv_meta != null && form.cmv_meta !== "" && novo) {
    campos.cmv_meta = parseNumero(form.cmv_meta);
  }

  if (tipo === "pre_preparo") {
    campos.tempo_preparo = numeroOuNulo(form.tempo_preparo);
    campos.peso_final_g = numeroOuNulo(form.peso_final_g);
    campos.responsavel = texto(form.responsavel) || null;
    campos.alergenicos_pode_conter = texto(form.alergenicos_pode_conter) || null;
    // Espelho da validade principal na própria ficha: etiquetas e telas antigas
    // leem daqui quando a tabela de armazenamento não existe.
    campos.validade_dias = numeroOuNulo(form.validade_dias);
  }

  if (novo) {
    campos.unidade_id = unidadeId;
    campos.versao = "1.0";
    campos.cmv_meta = 30;
    campos.peso_porcao_g = null;
  }
  return campos;
}

// Validação do editor. Vazia = pode salvar.
export function validarEditor(tipo, form = {}, ingredientes = []) {
  const erros = [];
  if (!texto(form.nome_receita)) erros.push(tipo === "prato" ? "Digite o nome do prato." : "Digite o nome do pré-preparo.");
  const validos = ingredientes.filter(i => parseNumero(i?.quantidade) > 0);
  if (!validos.length) erros.push("Adicione pelo menos um ingrediente com quantidade.");
  if (tipo === "pre_preparo" && !(parseNumero(form.rendimento_porcoes) > 0)) erros.push("Informe o rendimento do pré-preparo.");
  if (parseNumero(form.tempo_preparo) < 0) erros.push("O tempo de preparo não pode ser negativo.");
  if (parseNumero(form.peso_final_g) < 0) erros.push("O peso final não pode ser negativo.");
  return erros;
}

// Armazenamento do editor → linha de fichas_armazenamento.
//
// Parte do `atual` (o que o banco tem) para não zerar o que o editor não mostra:
// temperaturas, validade após aberto, observações antigas. A validade digitada
// vai para a coluna da forma de conservação escolhida.
export function armazenamentoParaGravar(atual = {}, editado = {}) {
  const anterior = atual || {};
  const proximo = { ...anterior };
  proximo.recipiente = texto(editado.recipiente) || null;
  proximo.forma = texto(editado.forma) || null;
  proximo.local_armazenamento = texto(editado.local_armazenamento) || null;
  const validade = numeroOuNulo(editado.validade_dias);
  const colunaNova = proximo.forma === "Congelado" ? "validade_congelado_dias" : "validade_refrigerado_dias";
  // Se a forma mudou (refrigerado <-> congelado), a validade que o editor
  // mostrava vinha da outra coluna: ela sai de lá para não aparecer duas vezes.
  const origemAnterior = origemDaValidade(anterior, {})?.coluna;
  if (origemAnterior && origemAnterior !== colunaNova) proximo[origemAnterior] = null;
  proximo[colunaNova] = validade;
  return proximo;
}

// O inverso: o que o editor mostra a partir do banco.
export function armazenamentoParaEditar(armazenamento = {}, ficha = {}) {
  const arm = armazenamento || {};
  const validade = validadePrincipal(arm, ficha);
  return {
    recipiente: texto(arm.recipiente),
    forma: texto(arm.forma),
    local_armazenamento: texto(arm.local_armazenamento),
    validade_dias: validade == null ? "" : String(validade),
  };
}

// Quantidade do editor (sempre na unidade-base: kg, L, un) → quantidade
// gravada, que fica na unidade do insumo. Para insumo em kg/L/un é a mesma;
// para insumo cadastrado em g ou ml, o banco guarda em g/ml. Sem esta volta,
// cada vez que a ficha era salva a quantidade encolhia mil vezes.
// É o inverso exato de converterParaBaseDoInsumo, que só converte g->kg e ml->L.
export function quantidadeParaGravar(quantidadeBase, unidadeInsumo) {
  const q = parseNumero(quantidadeBase);
  const de = String(unidadeInsumo || "").trim().toLowerCase();
  if (de === "g" || de === "ml") return q * 1000;
  return q;
}

// Separa a lista por tipo, mantendo a ordem: é assim que o índice do Livro de
// Receitas agrupa pratos e pré-preparos.
export function agruparPorTipo(fichas = []) {
  const grupos = { prato: [], pre_preparo: [] };
  for (const f of fichas) {
    const tipo = tipoFichaDe(f);
    if (tipo === "prato" || tipo === "pre_preparo") grupos[tipo].push(f);
  }
  return grupos;
}

// Receituário é prato e pré-preparo. Produto pronto e ficha inativada não
// entram no Livro de Receitas.
export function entraNoReceituario(ficha) {
  const tipo = tipoFichaDe(ficha);
  if (tipo !== "prato" && tipo !== "pre_preparo") return false;
  return String(ficha?.status || "ativa").toLowerCase() !== "inativa";
}
