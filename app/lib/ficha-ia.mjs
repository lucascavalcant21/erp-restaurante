// Pedidos à IA para montar fichas e a limpeza da resposta. Puro (sem fetch),
// testado em ficha-ia.test.mjs; as rotas /api/ia-ficha e /api/ia-preparo só
// fazem a chamada.
//
// O tipo da ficha manda no pedido: PRATO é ficha de montagem, PRÉ-PREPARO é
// ficha de produção. A IA nunca inventa validade nem custo: armazenamento só
// volta preenchido se a receita disser, e alergênico só da lista oficial.

import { ALERGENICOS, CONSERVACOES, setorId } from "./ficha-modelo.mjs";

const UNIDADES = ["kg", "g", "l", "ml", "un"];
const ALERGENICOS_DECLARAVEIS = ALERGENICOS.filter(a => a !== "Outros");

export function tipoDoPedido(tipo) {
  return tipo === "pre_preparo" ? "pre_preparo" : "prato";
}

export function promptDaFichaIA({ tipo, departamento } = {}) {
  const setor = setorId(departamento) === "bar" ? "bar" : "cozinha";
  if (tipoDoPedido(tipo) === "prato") {
    return `Você é um chef que transforma uma receita solta (texto e/ou foto) numa FICHA DE PRATO do setor "${setor}" de um restaurante.

A ficha de prato é uma ficha de MONTAGEM: mostra ao funcionário quais itens vão no prato, em que quantidade e como montar. Não é receita de produção.

Extraia:
1. "nome_receita": o nome do prato como aparece no cardápio.
2. "ingredientes": o que vai NO PRATO PRONTO, com a quantidade de UM prato servido:
   - "nome": limpo e genérico, sem marca e sem quantidade no nome. Componente preparado antes (arroz branco, molho madeira, farofa da casa, xarope) entra pelo nome do componente, não pelos ingredientes dele.
   - "quantidade": só o número.
   - "unidade": exatamente um destes: "kg", "g", "l", "ml", "un".
3. "montagem": passos curtos da MONTAGEM do prato (onde vai cada item, ordem, finalização e apresentação), no imperativo. Não descreva o preparo dos componentes.
4. "rendimento_g": peso final servido de UM prato, em gramas (número inteiro). É o peso que vai à mesa, depois de cozinhar e escorrer — pode ser menor que a soma crua dos ingredientes. Se não der para estimar, use null.

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois:
{
  "nome_receita": "...",
  "ingredientes": [ { "nome": "...", "quantidade": 0, "unidade": "g" } ],
  "montagem": [ "...", "..." ],
  "rendimento_g": 0
}`;
  }
  return `Você é um chef que transforma uma receita solta (texto e/ou foto) numa FICHA DE PRÉ-PREPARO do setor "${setor}" de um restaurante.

A ficha de pré-preparo é uma ficha de PRODUÇÃO (molhos, caldos, bases, arroz, xaropes, preparações intermediárias).

Extraia:
1. "nome_receita": o nome do pré-preparo.
2. "ingredientes": TODOS os ingredientes, com a quantidade da receita inteira:
   - "nome": limpo e genérico, sem marca e sem quantidade no nome.
   - "quantidade": só o número.
   - "unidade": exatamente um destes: "kg", "g", "l", "ml", "un".
3. "modo_preparo": etapas numeradas. Para cada uma:
   - "descricao": o que fazer, direto e no imperativo.
   - "equipamento": panela/utensílio usado, ou "".
   - "fogo": exatamente um destes: "Não vai ao fogo", "Fogo baixo", "Fogo médio", "Fogo alto".
   - "tempo": tempo estimado da etapa (ex.: "5 min").
4. "tempo_preparo_min": tempo total em minutos (número inteiro), somando as etapas.
5. "equipamentos": lista de equipamentos e utensílios necessários (ex.: "Panela 10 L", "Fouet", "Balança").
6. "alergenicos": só os que os ingredientes contêm, usando APENAS estes nomes: ${ALERGENICOS_DECLARAVEIS.join(", ")}.
7. "armazenamento": preencha SOMENTE o que a receita informar; NÃO invente validade nem forma de guardar.
   - "recipiente": ex.: "Cuba GN com tampa", ou "".
   - "conservacao": um destes: ${CONSERVACOES.map(c => `"${c}"`).join(", ")}, ou "".
   - "validade_dias": número, ou null.

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois:
{
  "nome_receita": "...",
  "ingredientes": [ { "nome": "...", "quantidade": 0, "unidade": "kg" } ],
  "modo_preparo": [ { "descricao": "...", "equipamento": "...", "fogo": "...", "tempo": "..." } ],
  "tempo_preparo_min": 0,
  "equipamentos": [ "..." ],
  "alergenicos": [ "..." ],
  "armazenamento": { "recipiente": "", "conservacao": "", "validade_dias": null }
}`;
}

const texto = (v) => String(v ?? "").trim();
const numero = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function ingredientesLimpos(lista) {
  return (Array.isArray(lista) ? lista : [])
    .map(ing => {
      let unidade = texto(ing?.unidade || ing?.unidade_lida).toLowerCase();
      if (!UNIDADES.includes(unidade)) unidade = "un";
      return { nome: texto(ing?.nome), quantidade_lida: numero(ing?.quantidade ?? ing?.quantidade_lida), unidade_lida: unidade };
    })
    .filter(ing => ing.nome);
}

// Etapas estruturadas → texto de passos, no formato que a ficha já entende
// (detalhes numa linha recuada com "•"). Sem emoji: vai para a ficha impressa.
export function etapasEmTexto(etapas = [], tempoTotal = "") {
  const linhas = (Array.isArray(etapas) ? etapas : [])
    .map(et => ({
      descricao: typeof et === "string" ? texto(et) : texto(et?.descricao),
      detalhes: typeof et === "string" ? [] : [texto(et?.equipamento), texto(et?.fogo), texto(et?.tempo)].filter(Boolean),
    }))
    .filter(et => et.descricao)
    .map((et, i) => `${i + 1}. ${et.descricao}${et.detalhes.length ? `\n   • ${et.detalhes.join(" · ")}` : ""}`);
  if (texto(tempoTotal)) linhas.push(`Tempo total: ${texto(tempoTotal)}`);
  return linhas.join("\n");
}

export function normalizarFichaIA(obj = {}, { tipo } = {}) {
  const t = tipoDoPedido(tipo);
  const base = {
    tipo: t,
    nome_receita: texto(obj?.nome_receita),
    ingredientes: ingredientesLimpos(obj?.ingredientes),
  };
  if (t === "prato") {
    const passos = Array.isArray(obj?.montagem) ? obj.montagem : (Array.isArray(obj?.modo_preparo) ? obj.modo_preparo : []);
    // Rendimento do prato: peso final servido, em gramas. Sem estimativa da IA
    // fica vazio e o editor sugere a soma dos ingredientes.
    const rendimento = Math.round(numero(obj?.rendimento_g ?? obj?.peso_final_g));
    return { ...base, modo_preparo: etapasEmTexto(passos), peso_final_g: rendimento > 0 ? rendimento : null };
  }
  const oficiais = new Map(ALERGENICOS_DECLARAVEIS.map(a => [a.toLowerCase(), a]));
  const arm = obj?.armazenamento || {};
  const conservacao = CONSERVACOES.find(c => c.toLowerCase() === texto(arm.conservacao).toLowerCase()) || "";
  const validade = numero(arm.validade_dias);
  const tempo = Math.round(numero(obj?.tempo_preparo_min));
  return {
    ...base,
    modo_preparo: etapasEmTexto(obj?.modo_preparo, tempo > 0 ? `${tempo} min` : ""),
    tempo_preparo: tempo > 0 ? tempo : null,
    equipamentos: [...new Set((Array.isArray(obj?.equipamentos) ? obj.equipamentos : []).map(texto).filter(Boolean))],
    alergenicos: [...new Set((Array.isArray(obj?.alergenicos) ? obj.alergenicos : [])
      .map(a => oficiais.get(texto(a).toLowerCase())).filter(Boolean))],
    armazenamento: {
      recipiente: texto(arm.recipiente),
      forma: conservacao,
      validade_dias: validade > 0 ? String(Math.round(validade)) : "",
    },
  };
}

// "Organizar com IA" dentro do editor: explicação solta → passos.
export function promptDasInstrucoes({ tipo, explicacao, nomeReceita, ingredientes = [] } = {}) {
  const lista = ingredientes.length
    ? ingredientes.map(i => `- ${texto(i.nome)}${i.quantidade ? ` (${texto(i.quantidade)})` : ""}`).join("\n")
    : "(não informados)";
  if (tipoDoPedido(tipo) === "prato") {
    return `Você é um chef que padroniza a MONTAGEM de pratos de restaurante.
O funcionário vai explicar com as próprias palavras como o prato é montado. Organize isso em passos curtos de montagem: onde vai cada item, em que ordem, finalização e apresentação. Não descreva o preparo dos componentes.

PRATO: ${texto(nomeReceita) || "(sem nome)"}
ITENS DO PRATO:
${lista}

EXPLICAÇÃO:
"${texto(explicacao)}"

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois:
{ "etapas": [ { "descricao": "..." } ] }`;
  }
  return `Você é um chef que padroniza fichas de PRODUÇÃO (pré-preparos) de cozinha profissional.
O cozinheiro vai explicar com as próprias palavras como faz. Organize em etapas numeradas; para cada uma, deduza com bom senso de cozinha:
- "descricao": o que fazer, direto e no imperativo.
- "equipamento": panela/utensílio, ou "".
- "fogo": exatamente um destes: "Não vai ao fogo", "Fogo baixo", "Fogo médio", "Fogo alto".
- "tempo": tempo estimado da etapa (ex.: "5 min").
No final, "tempo_total" somando as etapas (ex.: "35 min").

PRÉ-PREPARO: ${texto(nomeReceita) || "(sem nome)"}
INGREDIENTES:
${lista}

EXPLICAÇÃO:
"${texto(explicacao)}"

Responda ESTRITAMENTE com um JSON válido, sem texto antes ou depois:
{ "etapas": [ { "descricao": "...", "equipamento": "...", "fogo": "...", "tempo": "..." } ], "tempo_total": "..." }`;
}

export function textoDasInstrucoesIA(obj = {}, { tipo } = {}) {
  const etapas = Array.isArray(obj?.etapas) ? obj.etapas : [];
  if (tipoDoPedido(tipo) === "prato") return etapasEmTexto(etapas.map(e => (typeof e === "string" ? e : texto(e?.descricao))));
  return etapasEmTexto(etapas, obj?.tempo_total);
}
