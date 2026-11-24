// IMPLANTAÇÃO (pedido do dono, 14/11/2026): "a pessoa comprou o Héfisto. A
// primeira coisa é cadastrar todas as suas informações (endereço, nome do
// estabelecimento, água, energia, custo fixo, ficha técnica, produtos, bar,
// salão). Depois o Jhon começa a fazer perguntas e ela vai complementando. O
// Jhon passa para o Nico e vice-versa, e a inteligência vai se formando:
// entendem a necessidade, o que ela busca, qual faturamento quer alcançar."
//
// Dois pedaços, os dois puros e testados (implantacao.test.mjs):
//   · ETAPAS do cadastro: o status vem do que está CADASTRADO de verdade
//     (contagens lidas do banco), nunca de um "marquei como feito".
//   · PERGUNTAS do Jhon: uma de cada vez, depois do básico. As respostas
//     formam o PERFIL DO NEGÓCIO (REAL: foi o dono quem disse), guardado em
//     config_sistema.params.perfil_negocio. O Jhon usa tudo; o Nico recebe só
//     o que é da operação (nada de faturamento, meta ou dinheiro).

import { DESPESAS_OPERACIONAIS } from "./composicao-preco.mjs";

export const ETAPAS = Object.freeze([
  { id: "estabelecimento", titulo: "Dados do estabelecimento", texto: "Nome, endereço, cidade e telefone.", rota: "/dashboard/configuracoes", essencial: true },
  { id: "custos", titulo: "Custos fixos do mês", texto: "Aluguel, energia, água, gás e o que mais pesa todo mês.", rota: null, essencial: true },
  { id: "equipe", titulo: "Equipe e horários", texto: "Quem trabalha e em que horário.", rota: "/dashboard/rh", essencial: true },
  { id: "ingredientes", titulo: "Ingredientes", texto: "O que você compra, com o preço.", rota: "/dashboard/operacao/ingredientes", essencial: true },
  { id: "fichas", titulo: "Fichas técnicas", texto: "A receita de cada prato, em gramas.", rota: "/dashboard/operacao/fichas", essencial: true },
  { id: "produtos", titulo: "Produtos e cardápio", texto: "O que você vende e por quanto.", rota: "/dashboard/operacao/produtos", essencial: true },
  { id: "bar", titulo: "Bar", texto: "Drinks e bebidas com ficha.", rota: "/dashboard/operacao/drinks", essencial: false, servico: "bar" },
  { id: "salao", titulo: "Salão", texto: "Mesas do salão.", rota: "/dashboard/mesas", essencial: false, servico: "salao" },
  { id: "meta", titulo: "Meta de vendas", texto: "Quanto quer vender por dia, semana ou mês.", rota: "/dashboard", essencial: false },
]);

const MINIMO_INGREDIENTES = 5;
const MINIMO_CUSTOS = 2;
const pos = (v) => Number(v) > 0;
const limpo = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

/**
 * Status de cada etapa pelo que está cadastrado.
 * dados: { unidade, params, contagens: { colaboradoresComHorario, insumos, fichas, fichasBar, produtos, mesas } }
 * Contagem que não pôde ser lida vem null: a etapa fica "sem_dado", não "pendente".
 */
export function statusDasEtapas({ unidade = null, params = {}, contagens = {}, perfil = null } = {}) {
  const servicos = respostaDe(perfil, "servicos") || [];
  const temBar = respostaDe(perfil, "tem_bar");
  const semSalao = servicos.length > 0 && !servicos.includes("Salão");
  const conta = (k) => (contagens[k] == null ? null : Number(contagens[k]) || 0);
  const st = (ok, n = null) => (n === null && ok === null ? "sem_dado" : ok ? "feito" : "pendente");

  const custosInformados = DESPESAS_OPERACIONAIS.filter(([k]) => pos(params?.[k])).length;
  const lista = ETAPAS.map((e) => {
    switch (e.id) {
      case "estabelecimento": {
        const ok = Boolean(limpo(unidade?.nome_fantasia || unidade?.nome) && limpo(unidade?.endereco) && limpo(unidade?.cidade));
        return { ...e, status: unidade ? (ok ? "feito" : "pendente") : "sem_dado", detalhe: ok ? limpo(unidade.nome_fantasia || unidade.nome) : "Falta nome, endereço ou cidade." };
      }
      case "custos":
        return { ...e, status: custosInformados >= MINIMO_CUSTOS ? "feito" : "pendente", detalhe: `${custosInformados} de ${DESPESAS_OPERACIONAIS.length} informados` };
      case "equipe": { const n = conta("colaboradoresComHorario"); return { ...e, status: st(n === null ? null : n >= 1, n), detalhe: n === null ? null : `${n} com horário` }; }
      case "ingredientes": { const n = conta("insumos"); return { ...e, status: st(n === null ? null : n >= MINIMO_INGREDIENTES, n), detalhe: n === null ? null : `${n} cadastrados` }; }
      case "fichas": { const n = conta("fichas"); return { ...e, status: st(n === null ? null : n >= 1, n), detalhe: n === null ? null : `${n} fichas` }; }
      case "produtos": { const n = conta("produtos"); return { ...e, status: st(n === null ? null : n >= 1, n), detalhe: n === null ? null : `${n} produtos` }; }
      case "bar": {
        if (temBar === "Não") return { ...e, status: "dispensada", detalhe: "Você disse que não tem bar." };
        const n = conta("fichasBar"); return { ...e, status: st(n === null ? null : n >= 1, n), detalhe: n === null ? null : `${n} drinks` };
      }
      case "salao": {
        if (semSalao) return { ...e, status: "dispensada", detalhe: "Sem atendimento no salão." };
        const n = conta("mesas"); return { ...e, status: st(n === null ? null : n >= 1, n), detalhe: n === null ? null : `${n} mesas` };
      }
      case "meta": {
        const ok = pos(params?.meta_vendas?.valor) || pos(respostaDe(perfil, "faturamento_meta"));
        return { ...e, status: ok ? "feito" : "pendente", detalhe: ok ? "Definida" : null };
      }
      default: return { ...e, status: "pendente" };
    }
  });
  const contam = lista.filter((e) => e.status !== "dispensada");
  const feitas = contam.filter((e) => e.status === "feito").length;
  return {
    etapas: lista, feitas, total: contam.length,
    pct: contam.length ? Math.round((feitas / contam.length) * 100) : 0,
    basicoPronto: lista.filter((e) => e.essencial && e.id === "estabelecimento").every((e) => e.status === "feito"),
    proxima: lista.find((e) => e.status === "pendente") || null,
  };
}

// ── Perguntas do Jhon ───────────────────────────────────────────────────────
// publico "ambos": o Nico também recebe (operação). "jhon": só o Jhon (gestão).
export const PERGUNTAS = Object.freeze([
  { id: "tipo_negocio", texto: "Que tipo de casa é a sua?", tipo: "escolha", opcoes: ["Restaurante", "Marmitaria", "Bar", "Lanchonete", "Pizzaria", "Cafeteria", "Buffet e eventos", "Outro"], publico: "ambos" },
  { id: "servicos", texto: "Como você atende?", tipo: "multipla", opcoes: ["Salão", "Delivery próprio", "iFood", "Retirada", "Eventos", "Marmitas"], publico: "ambos" },
  { id: "tem_bar", texto: "Tem bar (drinks preparados)?", tipo: "escolha", opcoes: ["Sim", "Não"], publico: "ambos" },
  { id: "horario", texto: "Em que dias e horários abre?", tipo: "horario", dica: "Ex.: terça a domingo, das 11h às 23h", publico: "ambos" },
  { id: "estilo_cozinha", texto: "Qual o estilo da cozinha?", tipo: "texto", dica: "Ex.: comida paraense, caseira, japonesa", publico: "ambos" },
  { id: "lugares", texto: "Quantos lugares tem o salão?", tipo: "numero", unidade: "lugares", publico: "ambos" },
  { id: "maior_dor", texto: "O que mais te tira o sono hoje?", tipo: "multipla", opcoes: ["CMV alto", "Desperdício", "Equipe atrasa ou falta", "Atendimento demorado", "Estoque sem controle", "Não sei se tenho lucro", "Outro"], publico: "jhon" },
  { id: "faturamento_atual", texto: "Quanto você fatura por mês hoje, mais ou menos?", tipo: "numero", unidade: "R$ por mês", permiteNaoSei: true, publico: "jhon" },
  { id: "faturamento_meta", texto: "Quanto você quer faturar por mês?", tipo: "numero", unidade: "R$ por mês", publico: "jhon" },
  { id: "objetivo", texto: "O que você quer alcançar nos próximos 6 meses?", tipo: "texto", dica: "Ex.: abrir a segunda loja, baixar o CMV para 30%", publico: "jhon" },
]);

export const perguntaPorId = (id) => PERGUNTAS.find((p) => p.id === id) || null;

/** Resposta salva, já no formato da pergunta. */
export function respostaDe(perfil, id) {
  const r = perfil?.respostas?.[id];
  return r && r.valor !== undefined ? r.valor : undefined;
}

/** Valida e normaliza a resposta. Devolve { valor } ou { erro }. */
export function validarResposta(pergunta, entrada) {
  if (!pergunta) return { erro: "Pergunta desconhecida." };
  if (pergunta.permiteNaoSei && entrada === "nao_sei") return { valor: "nao_sei" };
  switch (pergunta.tipo) {
    case "escolha":
      return pergunta.opcoes.includes(entrada) ? { valor: entrada } : { erro: "Escolha uma das opções." };
    case "multipla": {
      const lista = (Array.isArray(entrada) ? entrada : []).filter((x) => pergunta.opcoes.includes(x));
      return lista.length ? { valor: [...new Set(lista)] } : { erro: "Escolha pelo menos uma." };
    }
    case "numero": {
      const n = Number(String(entrada ?? "").replace(/\./g, "").replace(",", "."));
      return Number.isFinite(n) && n > 0 ? { valor: Math.round(n * 100) / 100 } : { erro: "Digite um número." };
    }
    default: {
      const t = limpo(entrada).slice(0, 300);
      return t.length >= 2 ? { valor: t } : { erro: "Escreva a resposta." };
    }
  }
}

/** Grava a resposta no perfil (imutável: devolve um perfil novo). */
export function responder(perfil, id, valor, agora = new Date()) {
  return { ...(perfil || {}), respostas: { ...(perfil?.respostas || {}), [id]: { valor, em: agora.toISOString() } } };
}

/** Próxima pergunta do Jhon: só depois do básico, uma de cada vez, pulando o que não se aplica. */
export function proximaPergunta(perfil, { basicoPronto = true } = {}) {
  if (!basicoPronto) return null;
  const servicos = respostaDe(perfil, "servicos") || [];
  for (const p of PERGUNTAS) {
    if (respostaDe(perfil, p.id) !== undefined) continue;
    if (p.id === "lugares" && servicos.length && !servicos.includes("Salão")) continue;
    return p;
  }
  return null;
}

const valorEmTexto = (p, v) => {
  if (v === "nao_sei") return "não sabe";
  if (Array.isArray(v)) return v.join(", ");
  if (p.tipo === "numero" && p.unidade?.startsWith("R$")) return `R$ ${Number(v).toLocaleString("pt-BR")} por mês`;
  if (p.tipo === "numero") return `${Number(v).toLocaleString("pt-BR")} ${p.unidade || ""}`.trim();
  return String(v);
};

/**
 * O perfil em texto para o prompt. Para o Nico, só o que é da operação:
 * faturamento, meta, objetivo e dores de gestão ficam com o Jhon.
 */
export function perfilParaPrompt(perfil, { para = "jhon" } = {}) {
  const linhas = PERGUNTAS
    .filter((p) => para === "jhon" || p.publico === "ambos")
    .map((p) => ({ p, v: respostaDe(perfil, p.id) }))
    .filter(({ v }) => v !== undefined)
    .map(({ p, v }) => `- ${p.texto} ${valorEmTexto(p, v)}.`);
  return linhas.length ? ["PERFIL DO NEGÓCIO (o dono disse):", ...linhas].join("\n") : "";
}

/** Quanto o Jhon já conhece do negócio (perguntas respondidas). */
export function conhecimento(perfil) {
  const respondidas = PERGUNTAS.filter((p) => respostaDe(perfil, p.id) !== undefined).length;
  return { respondidas, total: PERGUNTAS.length, pct: Math.round((respondidas / PERGUNTAS.length) * 100) };
}
