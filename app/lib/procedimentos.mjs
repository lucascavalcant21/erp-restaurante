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
const SECAO_PASSOS = "Passo a passo";
const SECAO_GERENTE = "Chame o gerente quando";

const sem = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const VAZIAS = new Set(["o", "a", "os", "as", "de", "da", "do", "das", "dos", "e", "um", "uma", "no", "na", "nos", "nas", "em", "para", "pra", "com", "que", "se", "como", "eu", "situacao", "salao", "resolvo"]);
const MESMA = { montagem: "montar", monto: "montar", monta: "montar", montando: "montar" };
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
]);

/** Passos digitados (um por linha ou lista) → lista limpa, sem vazios e sem numeração digitada. */
export function limparPassos(lista) {
  const arr = Array.isArray(lista) ? lista : String(lista || "").split(/\r?\n/);
  return arr.map((p) => limpo(String(p).replace(/^\s*\d{1,2}\s*[.):-]\s*/, ""))).filter(Boolean).slice(0, 40);
}

/** Procedimento → o formato da Operação Inteligente (processo + seções + itens). */
export function paraEstrutura(proc, unidadeId) {
  const passos = limparPassos(proc.passos);
  const gerente = limparPassos(proc.gerente);
  const item = (t) => ({ titulo: t.slice(0, 300), tipo: "FEITO_NAO_FEITO", obrigatorio: false });
  return {
    processo: {
      ...(proc.id ? { id: proc.id } : {}),
      unidade_id: String(unidadeId), nome: limpo(proc.nome).slice(0, 120), descricao: limpo(proc.quando).slice(0, 500) || null,
      categoria: CATEGORIA, setor: AREAS.some((a) => a.id === proc.area) ? proc.area : "salao", criticidade: "normal", ativo: true, arquivado: false,
    },
    secoes: [
      { titulo: SECAO_PASSOS, itens: passos.map(item) },
      ...(gerente.length ? [{ titulo: SECAO_GERENTE, itens: gerente.map(item) }] : []),
    ],
  };
}

/** Processo completo (com seções e itens) → procedimento para a tela e o Assistente. */
export function deEstrutura(p) {
  const secoes = [...(p?.secoes || [])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const daSecao = (titulo) => (secoes.find((s) => s.titulo === titulo)?.itens || []).slice().sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)).map((i) => limpo(i.titulo)).filter(Boolean);
  const passos = daSecao(SECAO_PASSOS);
  return {
    id: p.id, nome: limpo(p.nome), quando: limpo(p.descricao), area: p.setor || "salao",
    passos: passos.length ? passos : secoes.flatMap((s) => (s.titulo === SECAO_GERENTE ? [] : (s.itens || []).map((i) => limpo(i.titulo)))).filter(Boolean),
    gerente: daSecao(SECAO_GERENTE), atualizado: p.updated_at || null,
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
  if (!limparPassos(proc.passos).length) erros.passos = "Escreva pelo menos um passo.";
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
  let melhor = null;
  let empate = false;
  for (const p of lista || []) {
    const ps = [...new Set([...palavras(p.nome)])];
    if (!ps.length) continue;
    const em = ps.filter((w) => daFrase.has(w) || [...daFrase].some((f) => f.length >= 5 && w.length >= 5 && (f.startsWith(w.slice(0, 5)) || w.startsWith(f.slice(0, 5))))).length;
    const nota = em / ps.length + (em === ps.length ? 1 : 0);
    if (em / ps.length < 0.6) continue;
    if (!melhor || nota > melhor.nota) { melhor = { p, nota }; empate = false; } else if (nota === melhor.nota) empate = true;
  }
  return melhor && !empate ? melhor.p : null;
}

/** Modelo padrão com o mesmo nome (para "Cadastrar o jeito da casa" já vir preenchido). */
export function modeloPorNome(nome) {
  const alvo = sem(nome);
  return MODELOS.find((m) => sem(m.nome) === alvo) || null;
}
