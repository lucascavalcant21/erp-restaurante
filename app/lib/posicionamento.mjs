// POSICIONAMENTO (pedido do dono, 23/11/2026): quanto de cada produto vai no
// prato. O dono cadastra "Filé de frango 200 g", "Picanha média de 250 g",
// "Batata frita 100 g, mínimo 90 g, máximo 100 g" na Cozinha › Posicionamento,
// e a equipe pergunta ao Nico ou ao Jhon: "posicionamento" mostra a lista toda;
// "quantas gramas é o posicionamento do filé?" mostra só aquele produto.
//
// Guardado em config_sistema.params.posicionamento (todos os aparelhos da
// unidade veem o mesmo). Nada é inventado: sem cadastro, o assistente diz que
// não tem e aponta onde cadastrar.

export const UNIDADES_POSICIONAMENTO = Object.freeze([
  { id: "g", rotulo: "gramas" },
  { id: "ml", rotulo: "ml" },
  { id: "un", rotulo: "unidades" },
]);

const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/** "200", "200,5", "200 g" → 200; vazio ou inválido → null. */
export function numeroPos(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) / 10 : null;
}

export function novoIdPos() {
  return `pos_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizarItemPos(i = {}) {
  const unidade = UNIDADES_POSICIONAMENTO.some((u) => u.id === i.unidade) ? i.unidade : "g";
  return {
    id: i.id || novoIdPos(),
    nome: limpo(i.nome).slice(0, 80),
    unidade,
    alvo: numeroPos(i.alvo),
    min: numeroPos(i.min),
    max: numeroPos(i.max),
    media: !!i.media,
    obs: limpo(i.obs).slice(0, 160),
    atualizado_em: i.atualizado_em || null,
  };
}

/** Lista guardada (aceita formato antigo/vazio) → { itens } ordenados por nome. */
export function normalizarPosicionamento(v) {
  const itens = (Array.isArray(v?.itens) ? v.itens : Array.isArray(v) ? v : [])
    .map(normalizarItemPos)
    .filter((i) => i.nome);
  itens.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return { versao: 1, itens };
}

/** Erros do item antes de salvar (lista vazia = pode salvar). */
export function conferirItemPos(item, outros = []) {
  const i = normalizarItemPos(item);
  const erros = [];
  if (!i.nome) erros.push("Escreva o nome do produto.");
  if (!i.alvo) erros.push(i.media ? "Escreva a média." : "Escreva quanto vai no prato.");
  if (i.min && i.max && i.min > i.max) erros.push("O mínimo está maior que o máximo.");
  if (i.alvo && i.min && i.alvo < i.min) erros.push("O peso do prato está abaixo do mínimo.");
  if (i.alvo && i.max && i.alvo > i.max) erros.push("O peso do prato está acima do máximo.");
  const chave = semAcento(i.nome);
  if (chave && outros.some((o) => o.id !== i.id && semAcento(limpo(o.nome)) === chave)) erros.push("Já tem um produto com esse nome.");
  return erros;
}

const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const un = (u) => (u === "un" ? "un" : u || "g");

/** Texto principal: "200 g" ou "Média de 250 g". */
export function textoAlvo(i) {
  if (!i?.alvo) return "sem peso";
  return `${i.media ? "Média de " : ""}${fmt(i.alvo)} ${un(i.unidade)}`;
}

/** Faixa: "de 90 a 100 g", "mínimo 90 g", "máximo 100 g" ou "". */
export function textoFaixa(i) {
  const u = un(i?.unidade);
  if (i?.min && i?.max) return `de ${fmt(i.min)} a ${fmt(i.max)} ${u}`;
  if (i?.min) return `mínimo ${fmt(i.min)} ${u}`;
  if (i?.max) return `máximo ${fmt(i.max)} ${u}`;
  return "";
}

export function textoItemPos(i) {
  const faixa = textoFaixa(i);
  return `${i.nome}: ${textoAlvo(i).replace(/^Média/, "média")}${faixa ? ` (${faixa})` : ""}`;
}

// ─── Busca e pergunta ───────────────────────────────────────────────────────

const VAZIAS = new Set([
  "a", "o", "as", "os", "de", "do", "da", "dos", "das", "e", "em", "no", "na", "nos", "nas", "um", "uma", "com", "pra", "para", "me", "mostra", "mostre", "ver",
  "qual", "quais", "quanto", "quanta", "quantos", "quantas", "grama", "gramas", "g", "gr", "peso", "pesa", "vai", "vao", "leva", "levam", "tem", "ser", "sao", "fica",
  "posicionamento", "posicionamentos", "posicionado", "posicionada", "posicionados", "posicionadas", "posiciona", "posicionar", "posicao",
  "porcionamento", "porcionado", "porcionada", "prato", "pratos", "cada", "lista", "todos", "tudo", "hoje", "certo", "correto",
]);

const tokensPos = (t) => semAcento(t).replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);

/**
 * "posicionamento" → { todos: true }; "quantas gramas é posicionado o filé de
 * frango" → { termo: "file frango" }; "qual o peso da batata frita" →
 * { termo, soPergunta: true } (só vale se achar o produto). Outro texto → null.
 */
export function interpretarPosicionamento(texto) {
  const t = semAcento(texto);
  if (!t || t.length > 120) return null;
  const temPalavra = /\bposicion|\bporcionament|\bposicao\b/.test(t);
  const pergunta = /\bquant[oa]s? (gramas?|g|gr)\b|\bqual (e |o )?(peso|posicionamento)\b|\bquantas? gramas?\b/.test(t);
  if (!temPalavra && !pergunta) return null;
  const termo = tokensPos(t).filter((w) => !VAZIAS.has(w) && !/^\d+$/.test(w)).join(" ");
  if (!termo) return temPalavra ? { todos: true } : null;
  return { termo, soPergunta: !temPalavra };
}

/** Produtos cujo nome tem todas as palavras procuradas (começo da palavra). */
export function buscarPosicionamento(itens = [], termo = "", { aproximado = true } = {}) {
  const q = tokensPos(termo).filter((w) => !VAZIAS.has(w));
  if (!q.length) return [];
  const casa = (nome) => {
    const ws = tokensPos(nome);
    return q.every((p) => ws.some((w) => w.startsWith(p) || (p.length > 3 && w.startsWith(p.replace(/s$/, "")))));
  };
  let achados = itens.filter((i) => casa(i.nome));
  if (!achados.length && aproximado && q.length > 1) {
    // "filé de frango grelhado" sem cadastro igual: aceita quem tem a maioria das palavras
    const pontos = (i) => q.filter((p) => tokensPos(i.nome).some((w) => w.startsWith(p))).length;
    const melhor = Math.max(0, ...itens.map(pontos));
    if (melhor >= Math.ceil(q.length / 2)) achados = itens.filter((i) => pontos(i) === melhor);
  }
  return achados;
}

export const ROTA_POSICIONAMENTO = "/dashboard/operacao/posicionamento?dept=cozinha";

/**
 * Resposta do assistente (no aparelho, sem internet), no formato das respostas
 * locais. null = a pergunta não é de posicionamento.
 * @param {string} texto
 * @param {{ posicionamento?: object }|null} cache  o que o aparelho guardou
 */
export function respostaDoPosicionamento(texto, cache) {
  const pedido = interpretarPosicionamento(texto);
  if (!pedido) return null;
  const acoes = [{ rotulo: "Abrir o posicionamento", rota: ROTA_POSICIONAMENTO }];
  if (!cache) {
    if (pedido.soPergunta) return null;
    return { tipo: "local", local: true, atualizar: true, texto: "Ainda estou baixando o posicionamento neste aparelho. Tente de novo em alguns segundos.", acoes };
  }
  const { itens } = normalizarPosicionamento(cache.posicionamento);
  if (!itens.length) {
    if (pedido.soPergunta) return null;
    return { tipo: "local", local: true, atualizar: true, texto: "O posicionamento ainda não foi cadastrado. Cadastre em Cozinha › Posicionamento.", acoes };
  }
  if (pedido.todos) {
    return { tipo: "local", local: true, atualizar: true, texto: "Posicionamento", blocos: [{ tipo: "posicionamento", itens, termo: null }], acoes };
  }
  const achados = buscarPosicionamento(itens, pedido.termo, { aproximado: !pedido.soPergunta });
  if (!achados.length) {
    if (pedido.soPergunta) return null; // "quantas gramas de arroz para 10 pessoas" etc. segue o caminho normal
    return {
      tipo: "local", local: true, atualizar: true,
      texto: `Não tem posicionamento cadastrado para "${pedido.termo}". Veja a lista:`,
      blocos: [{ tipo: "posicionamento", itens, termo: null }], acoes,
    };
  }
  return {
    tipo: "local", local: true, atualizar: true,
    texto: achados.length === 1 ? textoItemPos(achados[0]) : "Posicionamento",
    blocos: [{ tipo: "posicionamento", itens: achados, termo: pedido.termo }], acoes,
  };
}
