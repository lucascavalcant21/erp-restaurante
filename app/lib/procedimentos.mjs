// PROCEDIMENTOS DA CASA (pedido do dono, 08/11/2026): o jeito do Seldeestrela de
// montar a mesa, montar o jardim, resolver uma reclamação… O Assistente ensina
// por aqui; sem procedimento cadastrado, ele dá a orientação padrão (SUGESTÃO).
//
// Guardado na Operação Inteligente (op_processos com categoria "procedimento",
// uma seção "Passo a passo" e, se houver, "Chame o gerente quando"). Sem tabela
// nova: dá até para rodar um procedimento como checklist depois.
// Funções puras: testadas em procedimentos.test.mjs.

export const CATEGORIA = "procedimento";
export const AREAS = Object.freeze([
  { id: "salao", rotulo: "Salão" },
  { id: "cozinha", rotulo: "Cozinha" },
  { id: "bar", rotulo: "Bar" },
  { id: "geral", rotulo: "Casa toda" },
]);
// Tipos de procedimento (14/11/2026): o Nico ensina a resolver uma situação,
// seguir uma rotina (abertura, fechamento), limpar e usar cada equipamento.
// Guardado em op_processos.conteudo.tipo (migração OP-CONTEUDO-1); sem a
// coluna, todo procedimento é "resolver", como antes.
export const TIPOS_PROCEDIMENTO = Object.freeze([
  { id: "resolver", rotulo: "Como resolver", plural: "Situações" },
  { id: "rotina", rotulo: "Rotina", plural: "Abertura e fechamento" },
  { id: "limpeza", rotulo: "Limpeza", plural: "Limpeza" },
  { id: "equipamento", rotulo: "Equipamento", plural: "Equipamentos" },
]);
export const VOLTAGENS = Object.freeze(["110 V", "220 V", "Bivolt", "Gás", "Não liga na tomada"]);
const tipoValido = (t) => (TIPOS_PROCEDIMENTO.some((x) => x.id === t) ? t : "resolver");
const SECAO_PASSOS = "Passo a passo";
const SECAO_GERENTE = "Chame o gerente quando";

const sem = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const VAZIAS = new Set(["o", "a", "os", "as", "de", "da", "do", "das", "dos", "e", "um", "uma", "no", "na", "nos", "nas", "em", "para", "pra", "com", "que", "se", "como", "eu", "situacao", "salao", "resolvo",
  "restaurante", "casa", "procedimento", "tenho", "fazer", "faco", "faz", "agora", "chegou", "cheguei", "hora", "ai", "aqui", "voce", "vou", "tem", "ja", "esse", "essa", "este", "esta", "isso", "qual", "quais", "nico", "certo", "jeito"]);
// Mesma palavra, outra forma: "como limpo a chapa?" acha "Limpeza da chapa".
const MESMA = {
  montagem: "montar", monto: "montar", monta: "montar", montando: "montar",
  limpar: "limpeza", limpo: "limpeza", limpa: "limpeza", limpando: "limpeza", higienizar: "limpeza", higienizacao: "limpeza", higienizo: "limpeza", higieniza: "limpeza",
  fechar: "fechamento", fecho: "fechamento", fecha: "fechamento", fechando: "fechamento",
  abrir: "abertura", abro: "abertura", abre: "abertura",
  uso: "usar", usa: "usar", utilizar: "usar", utilizo: "usar", manusear: "usar", manuseio: "usar", ligar: "usar", ligo: "usar",
  fogoes: "fogao", chapas: "chapa", fornos: "forno", freezers: "freezer",
};
const palavras = (v) => sem(v).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((p) => p.length > 1 && !VAZIAS.has(p)).map((p) => MESMA[p] || p);

/**
 * Rascunhos para o dono ajustar (não são o jeito da casa até ele salvar).
 * Os nomes batem com os botões do Assistente (Salão → Aconteceu um problema).
 */
export const MODELOS = Object.freeze([
  { nome: "Montar a mesa", area: "salao", quando: "Antes de abrir e a cada mesa liberada.", passos: [
    "Limpar e secar a mesa e as cadeiras.", "Colocar o jogo americano ou a toalha centralizada.", "Prato raso no centro, a dois dedos da borda.",
    "Garfo à esquerda, faca à direita com o fio para o prato.", "Copo acima da ponta da faca.", "Guardanapo dobrado sobre o prato ou à esquerda.",
    "Conferir sal, azeite, palitos e o QR Code do cardápio."], gerente: ["Faltar louça, talher ou toalha limpa."] },
  { nome: "Montar o jardim", area: "salao", quando: "Abertura do jardim (área externa).", passos: [
    "Varrer o piso e tirar folhas das mesas.", "Secar mesas e cadeiras se choveu.", "Posicionar as mesas no desenho da casa.",
    "Montar cada mesa como em 'Montar a mesa'.", "Ligar a iluminação e conferir as lâmpadas.", "Repelente e guarda-sóis prontos, conforme o tempo."], gerente: ["Previsão de chuva ou vento forte."] },
  { nome: "Cliente reclamou da comida", area: "salao", quando: "O cliente diz que o prato não está bom.", passos: [
    "Escutar sem interromper e pedir desculpas.", "Perguntar o que não agradou (sal, ponto, temperatura).", "Oferecer trocar o prato ou escolher outro.",
    "Levar o prato de volta e avisar a cozinha o motivo.", "Voltar à mesa para conferir se ficou tudo certo."], gerente: ["O cliente continuar insatisfeito.", "Pedir desconto ou não querer pagar."] },
  { nome: "Prato demorando", area: "salao", quando: "O pedido passou do tempo normal.", passos: [
    "Conferir na cozinha (KDS) em que etapa está o pedido.", "Voltar à mesa e dar um prazo honesto.", "Oferecer algo para beliscar ou uma bebida, se a casa permitir.",
    "Avisar a cozinha que a mesa está esperando."], gerente: ["Passar de 15 minutos do prazo dado."] },
  { nome: "Cliente com alergia", area: "salao", quando: "O cliente avisa que tem alergia ou intolerância.", passos: [
    "Perguntar a que ele é alérgico e anotar no pedido.", "Conferir na ficha técnica os alergênicos do prato.", "Confirmar com a cozinha antes de lançar o pedido.",
    "Nunca garantir que o prato é seguro sem a confirmação da cozinha.", "Avisar o cliente do que pode conter."], gerente: ["Qualquer dúvida sobre ingrediente ou contaminação."] },
  { nome: "Erro na conta", area: "salao", quando: "O cliente diz que a conta está errada.", passos: [
    "Pedir desculpas e conferir a conta item por item com o cliente.", "Comparar com os pedidos da mesa no sistema.", "Corrigir no caixa o que estiver errado.",
    "Entregar a conta nova antes de cobrar."], gerente: ["Precisar estornar um pagamento ou dar desconto."] },
  { nome: "Derramou bebida no cliente", area: "salao", quando: "Um acidente com bebida ou comida no cliente.", passos: [
    "Pedir desculpas na hora.", "Entregar guardanapos limpos e um pano úmido.", "Limpar a mesa e o chão para ninguém escorregar.",
    "Repor a bebida sem custo.", "Chamar o gerente para conversar com o cliente."], gerente: ["Sempre."] },
  { nome: "Cliente passou mal", area: "salao", quando: "O cliente se sente mal no salão.", passos: [
    "Chamar o gerente imediatamente.", "Levar o cliente a um lugar calmo e ventilado.", "Oferecer água e perguntar se tem alguma condição de saúde.",
    "Se for grave, ligar 192 (SAMU).", "Não dar remédio por conta própria."], gerente: ["Sempre."] },
  { nome: "Acabou um item do cardápio", area: "salao", quando: "Um prato ou bebida acabou no meio do serviço.", passos: [
    "Avisar a equipe e tirar o item do cardápio digital.", "Ao anotar o pedido, avisar o cliente antes.", "Sugerir um item parecido.",
    "Registrar o que acabou para a compra."], gerente: ["Acabar um item de muita saída."] },
  // 14/11/2026: rotina, limpeza e equipamento. Produto e quantidade ficam para
  // a casa preencher (cada uma usa o seu); o modelo só traz o caminho.
  { nome: "Fechamento do restaurante", tipo: "rotina", area: "geral", quando: "No fim do expediente, antes de ir embora.", apelidos: ["fechamento", "fechar"], passos: [
    { texto: "Desligar os equipamentos que não ficam ligados à noite." },
    { texto: "Limpar a chapa.", abreNome: "Limpeza da chapa" },
    { texto: "Limpar o fogão, boca por boca.", abreNome: "Limpeza do fogão" },
    { texto: "Guardar as sobras em pote fechado, com etiqueta e validade." },
    { texto: "Organizar as panelas e as vasilhas no lugar." },
    { texto: "Conferir a temperatura dos freezers e das geladeiras." },
    { texto: "Conferir a organização e as etiquetas do estoque." },
    { texto: "Limpar o piso.", abreNome: "Limpeza do piso" },
    { texto: "Tirar o lixo e trocar os sacos." },
    { texto: "Fechar o gás e a água e apagar as luzes." },
  ], gerente: ["Freezer ou geladeira fora da temperatura.", "Equipamento com defeito."] },
  { nome: "Abertura da cozinha", tipo: "rotina", area: "cozinha", quando: "Ao chegar, antes de começar a produção.", apelidos: ["abertura", "abrir a cozinha", "cheguei na cozinha"], passos: [
    { texto: "Bater o ponto." },
    { texto: "Lavar as mãos e vestir o uniforme completo (touca, dólmã, avental)." },
    { texto: "Ligar os equipamentos do turno." },
    { texto: "Conferir a temperatura das geladeiras e dos freezers." },
    { texto: "Ver com o Nico a produção do dia." },
    { texto: "Separar os ingredientes da primeira produção." },
  ], gerente: ["Faltar ingrediente para a produção do dia."] },
  { nome: "Limpeza da chapa", tipo: "limpeza", area: "cozinha", quando: "Depois de cada turno e no fechamento.", passos: [
    { texto: "Desligar a chapa e esperar ficar morna (não quente)." },
    { texto: "Raspar os resíduos com a espátula." },
    { texto: "Aplicar o desengordurante próprio para chapa.", produto: "", quantidade: "" },
    { texto: "Esfregar com a esponja ou pedra de chapa." },
    { texto: "Tirar o produto com pano úmido." },
    { texto: "Secar e passar uma camada fina de óleo." },
  ], gerente: ["A chapa não esquentar por igual."] },
  { nome: "Limpeza do fogão", tipo: "limpeza", area: "cozinha", quando: "No fechamento.", passos: [
    { texto: "Fechar o gás e esperar o fogão esfriar." },
    { texto: "Tirar as grelhas e as bocas (espalhadores)." },
    { texto: "Deixar grelhas e bocas de molho em água quente com desengordurante.", produto: "", quantidade: "" },
    { texto: "Limpar a mesa do fogão com esponja e desengordurante." },
    { texto: "Desentupir os furinhos das bocas com um palito, se precisar." },
    { texto: "Enxaguar, secar bem e montar de volta." },
    { texto: "Acender e conferir se a chama sai azul e por igual." },
  ], gerente: ["Cheiro de gás.", "Chama amarela ou falhando."] },
  { nome: "Limpeza do piso", tipo: "limpeza", area: "geral", quando: "No fechamento e quando sujar.", passos: [
    { texto: "Recolher o lixo e varrer." },
    { texto: "Preparar o balde com o produto na diluição do rótulo.", produto: "", quantidade: "" },
    { texto: "Passar o mop do fundo para a porta." },
    { texto: "Esfregar os cantos e embaixo dos equipamentos." },
    { texto: "Puxar a água para o ralo." },
    { texto: "Deixar a placa de piso molhado até secar." },
  ], gerente: [] },
  { nome: "Liquidificador", tipo: "equipamento", area: "cozinha", quando: "Sucos, molhos, cremes e massas leves.", equipamento: { local: "", cuidados: "Nunca ligar com o copo vazio. Não colocar líquido fervendo." }, passos: [
    { texto: "Conferir a voltagem na etiqueta antes de ligar na tomada." },
    { texto: "Encaixar o copo na base até travar." },
    { texto: "Colocar os ingredientes sem passar da marca máxima." },
    { texto: "Tampar e segurar a tampa ao ligar." },
    { texto: "Começar na velocidade baixa e aumentar aos poucos." },
    { texto: "Desligar e esperar a lâmina parar antes de abrir." },
    { texto: "Higienizar: tirar da tomada; lavar copo, tampa e lâmina com detergente neutro e esponja macia.", produto: "Detergente neutro", quantidade: "" },
    { texto: "Secar e guardar no lugar da casa." },
  ], gerente: ["Cheiro de queimado, barulho estranho ou fio danificado."] },
]);

/** Passos digitados (um por linha ou lista) → lista limpa, sem vazios e sem numeração digitada. */
export function limparPassos(lista) {
  const arr = Array.isArray(lista) ? lista : String(lista || "").split(/\r?\n/);
  return arr.map((p) => limpo(String(p).replace(/^\s*\d{1,2}\s*[.):-]\s*/, ""))).filter(Boolean).slice(0, 40);
}

const MAX_MIDIAS = 6;
const urlSegura = (u) => /^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim());

/** Foto, vídeo ou link (YouTube etc.). Só https; o resto é descartado. */
export function limparMidias(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map((m) => ({ tipo: ["foto", "video", "link"].includes(m?.tipo) ? m.tipo : "link", url: String(m?.url || "").trim(), legenda: limpo(m?.legenda).slice(0, 120) || null }))
    .filter((m) => urlSegura(m.url))
    .slice(0, MAX_MIDIAS);
}

/**
 * Passos com detalhe: texto, como fazer, produto, quantidade, fotos/vídeos e o
 * procedimento que o passo abre. Aceita o formato antigo (texto por linha).
 */
export function limparEtapas(lista) {
  if (!Array.isArray(lista)) return limparPassos(lista).map((texto) => ({ texto }));
  return lista.map((p) => {
    if (typeof p === "string") return { texto: limparPassos([p])[0] || "" };
    const e = { texto: limparPassos([p?.texto || ""])[0] || "" };
    const detalhe = limpo(p?.detalhe).slice(0, 600);
    const produto = limpo(p?.produto).slice(0, 120);
    const quantidade = limpo(p?.quantidade).slice(0, 60);
    const midias = limparMidias(p?.midias);
    if (detalhe) e.detalhe = detalhe;
    if (produto) e.produto = produto;
    if (quantidade) e.quantidade = quantidade;
    if (midias.length) e.midias = midias;
    if (p?.abreId) e.abreId = String(p.abreId);
    if (limpo(p?.abreNome)) e.abreNome = limpo(p.abreNome).slice(0, 120);
    return e;
  }).filter((e) => e.texto).slice(0, 40);
}

function limparEquipamento(eq) {
  const e = {};
  if (VOLTAGENS.includes(eq?.voltagem)) e.voltagem = eq.voltagem;
  const local = limpo(eq?.local).slice(0, 160);
  const cuidados = limpo(eq?.cuidados).slice(0, 400);
  if (local) e.local = local;
  if (cuidados) e.cuidados = cuidados;
  return e;
}

const apelidosDe = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,\n]/)).map(limpo).filter(Boolean).slice(0, 12);

/** Procedimento → o formato da Operação Inteligente (processo + seções + itens). */
export function paraEstrutura(proc, unidadeId, { comConteudo = false } = {}) {
  const etapas = limparEtapas(proc.passos);
  const gerente = limparPassos(proc.gerente);
  const tipo = tipoValido(proc.tipo);
  const item = (t, conteudo) => ({
    titulo: t.slice(0, 300), tipo: "FEITO_NAO_FEITO", obrigatorio: false,
    ...(comConteudo ? { conteudo: conteudo || {} } : {}),
  });
  const conteudoDaEtapa = ({ texto, ...resto }) => resto;
  const conteudo = {
    tipo,
    ...(tipo === "equipamento" ? { equipamento: limparEquipamento(proc.equipamento) } : {}),
    midias: limparMidias(proc.midias),
    apelidos: apelidosDe(proc.apelidos),
  };
  return {
    processo: {
      ...(proc.id ? { id: proc.id } : {}),
      unidade_id: String(unidadeId), nome: limpo(proc.nome).slice(0, 120), descricao: limpo(proc.quando).slice(0, 500) || null,
      categoria: CATEGORIA, setor: AREAS.some((a) => a.id === proc.area) ? proc.area : "salao", criticidade: "normal", ativo: true, arquivado: false,
      ...(comConteudo ? { conteudo } : {}),
    },
    secoes: [
      { titulo: SECAO_PASSOS, itens: etapas.map((e) => item(e.texto, conteudoDaEtapa(e))) },
      ...(gerente.length ? [{ titulo: SECAO_GERENTE, itens: gerente.map((g) => item(g)) }] : []),
    ],
  };
}

/** O conteúdo tem algo que só cabe com a migração OP-CONTEUDO-1? */
export function precisaDeConteudo(proc) {
  const { processo, secoes } = paraEstrutura(proc, "x", { comConteudo: true });
  const c = processo.conteudo;
  return c.tipo !== "resolver" || c.midias.length > 0 || c.apelidos.length > 0 || Object.keys(c.equipamento || {}).length > 0
    || secoes.some((s) => s.itens.some((i) => Object.keys(i.conteudo || {}).length > 0));
}

/** Processo completo (com seções e itens) → procedimento para a tela e o Assistente. */
export function deEstrutura(p) {
  const secoes = [...(p?.secoes || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const ordenar = (itens) => (itens || []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const etapa = (i) => ({ ...limparEtapas([{ ...(i.conteudo || {}), texto: i.titulo }])[0] });
  const daSecao = (titulo) => ordenar(secoes.find((s) => s.titulo === titulo)?.itens).filter((i) => limpo(i.titulo));
  let itensPassos = daSecao(SECAO_PASSOS);
  if (!itensPassos.length) itensPassos = secoes.flatMap((s) => (s.titulo === SECAO_GERENTE ? [] : ordenar(s.itens))).filter((i) => limpo(i.titulo));
  const etapas = itensPassos.map(etapa).filter((e) => e.texto);
  const c = p?.conteudo && typeof p.conteudo === "object" ? p.conteudo : {};
  const tipo = tipoValido(c.tipo);
  return {
    id: p.id, nome: limpo(p.nome), quando: limpo(p.descricao), area: p.setor || "salao",
    tipo, equipamento: tipo === "equipamento" ? limparEquipamento(c.equipamento) : {}, midias: limparMidias(c.midias), apelidos: apelidosDe(c.apelidos),
    passos: etapas.map((e) => e.texto),
    etapas,
    gerente: daSecao(SECAO_GERENTE).map((i) => limpo(i.titulo)), atualizado: p.updated_at || null,
  };
}

/** Junta as linhas lidas (processos, seções, itens) nos procedimentos da tela e do Assistente. */
export function montarProcedimentos(procs, secoes, itens) {
  return (procs || []).map((p) => deEstrutura({
    ...p,
    secoes: (secoes || []).filter((s) => s.processo_id === p.id).map((s) => ({ ...s, itens: (itens || []).filter((i) => i.secao_id === s.id) })),
  }));
}

/** Erros do formulário (vazio = pode salvar). */
export function validarProcedimento(proc) {
  const erros = {};
  if (limpo(proc.nome).length < 3) erros.nome = "Dê um nome (ex.: Montar a mesa).";
  if (!limparEtapas(proc.passos).length) erros.passos = "Escreva pelo menos um passo.";
  return erros;
}

/**
 * O procedimento da casa que responde a frase ("Situação no salão: o cliente
 * reclamou da comida. Como resolvo?"). Vale quando todas as palavras do nome
 * estão na frase, ou quando a maioria (60%+) está e nenhum outro empata.
 * Sem certeza: null (o Assistente usa a orientação padrão).
 */
export function procedimentoParaTexto(lista, texto) {
  const daFrase = new Set(palavras(texto));
  if (!daFrase.size) return null;
  const parecida = (w) => daFrase.has(w) || [...daFrase].some((f) => f.length >= 5 && w.length >= 5 && (f.startsWith(w.slice(0, 5)) || w.startsWith(f.slice(0, 5))));
  let melhor = null;
  let empate = false;
  for (const p of lista || []) {
    const ps = [...new Set([...palavras(p.nome)])];
    if (!ps.length) continue;
    const em = ps.filter(parecida).length;
    // apelido inteiro na frase ("fechar", "fechamento") vale mais que o nome pela metade
    const apelido = apelidosDe(p.apelidos).some((a) => { const w = palavras(a); return w.length && w.every(parecida); });
    if (em / ps.length < 0.6 && !apelido) continue;
    // nome com mais palavras batendo vence ("Limpeza da chapa" antes de "Chapa")
    const nota = (apelido ? 3 : 0) + em / ps.length + (em === ps.length ? 1 : 0) + em * 0.01;
    if (!melhor || nota > melhor.nota) { melhor = { p, nota }; empate = false; } else if (nota === melhor.nota) empate = true;
  }
  return melhor && !empate ? melhor.p : null;
}

/** O procedimento que um passo abre: pelo id e, se mudou, pelo nome. */
export function procedimentoDoPasso(etapa, lista) {
  if (!etapa) return null;
  const porId = etapa.abreId ? (lista || []).find((p) => p.id === etapa.abreId) : null;
  if (porId) return porId;
  if (!etapa.abreNome) return null;
  const alvo = sem(etapa.abreNome);
  return (lista || []).find((p) => sem(p.nome) === alvo) || null;
}

/** Modelo padrão com o mesmo nome (para "Cadastrar o jeito da casa" já vir preenchido). */
export function modeloPorNome(nome) {
  const alvo = sem(nome);
  return MODELOS.find((m) => sem(m.nome) === alvo) || null;
}
