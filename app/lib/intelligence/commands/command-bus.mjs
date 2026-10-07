// COMMAND BUS — porta única de pedidos em linguagem natural (texto hoje; voz
// usa a mesma porta: o áudio vira texto ANTES de chegar aqui).
//
//   texto → INTENÇÃO (regras/IA, validada) → ENTIDADE/PARÂMETROS → tipo:
//     pergunta  → Orchestrator → especialistas → Metrics Engine (só leitura)
//     acao      → ActionRegistry/Serviço (pergunta o que falta → prévia → confirmação)
//     navegacao → rota da lista fechada, se o usuário pode abrir
//   → resposta tipada + auditoria do pedido (com correlation id)

import { s } from "../schemas/schema.mjs";
import { intencaoPorId, DESTINOS, INTENCOES, IDS_INTENCAO } from "./catalogo.mjs";
import { interpretar } from "./interpretar.mjs";
import { palavras } from "./interpretador-regras.mjs";
import { responderPergunta } from "../agents/orquestrador.mjs";
import { criarTrilha, NIVEL } from "../core/niveis.mjs";
import { auditar, ETAPA_AUDITORIA } from "../audit/auditoria.mjs";
import { canAccessRoute } from "../../permissions-catalog.mjs";

export const pedidoSchema = s.object({
  texto: s.opcional(s.string({ min: 1, max: 500 })),
  chave: s.opcional(s.string({ min: 8, max: 80, padrao: /^[A-Za-z0-9_\-:.]+$/ })),
  continuar: s.opcional(s.object({
    acaoId: s.uuid(),
    campo: s.string({ min: 1, max: 30, padrao: /^[A-Za-z]+$/ }),
    valor: s.opcional(s.string({ min: 1, max: 120 })),
    valorNumero: s.opcional(s.number({ min: 0.001, max: 100000 })),
  })),
  canal: s.opcional(s.enum(["texto", "voz"])),
  // O que a resposta ANTERIOR desta conversa citou (devolvido pelo servidor em
  // `referencia`). Não confiável: produto é reconferido no banco da unidade e
  // insight é procurado entre os recalculados agora — nunca usado como dado.
  conversa: s.opcional(s.object({
    intencao: s.opcional(s.enum(IDS_INTENCAO)),
    produto: s.opcional(s.object({ id: s.uuid(), nome: s.opcional(s.string({ max: 80 })) })),
    insights: s.opcional(s.array(s.string({ max: 80, padrao: /^[a-z_]+:[0-9a-f]{8}$/ }), { max: 5 })),
  })),
});

export const EXEMPLOS = Object.freeze([
  "Como foi minha empresa hoje?", "Quanto vendi esta semana?", "Quanto comprei esta semana?",
  "Qual produto teve maior aumento de preço?", "Quais produtos estão próximos do vencimento?",
  "Tem alguma diferença estranha no estoque?", "Quais contas vencem nos próximos dias?",
  "Como está meu CMV?", "Como está meu CMO?", "Perdi 2 kg de picanha",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VERBOS_VARIACAO = new Set(["aumentou", "subiu", "diminuiu", "caiu", "mudou", "aumentaram", "subiram"]);
const INSIGHT_EXPLICAR = Object.freeze({ id: "insight.explicar", tipo: "pergunta", agentes: ["operacoes"] });

/**
 * Produto de que a pessoa está falando sem dizer o nome: o da TELA aberta e/ou
 * o da RESPOSTA ANTERIOR. Os dois iguais (ou só um) → esse. Diferentes →
 * ambíguo: o Héfisto pergunta, não escolhe.
 */
export function produtoDoContexto(ic, conversa) {
  const tela = ic.entidade?.tipo === "produto" && ic.entidade.id && UUID.test(ic.entidade.id)
    ? { id: ic.entidade.id, nome: ic.entidade.nome || null, origem: "tela" } : null;
  const anterior = conversa?.produto?.id ? { id: conversa.produto.id, nome: conversa.produto.nome || null, origem: "conversa" } : null;
  if (tela && anterior && tela.id !== anterior.id) return { ambiguo: [tela, anterior] };
  return tela || anterior || null;
}

/** "Por quê?" sobre o quê: a resposta anterior manda; depois a tela; sem nada, pergunta. */
export function resolverPorQue({ texto, conversa, produtoCtx }) {
  const temVerbo = palavras(texto).some((w) => VERBOS_VARIACAO.has(w));
  const produto = produtoCtx && !produtoCtx.ambiguo ? produtoCtx : null;
  if (temVerbo && produto) return { intencao: intencaoPorId("produto.explicar_variacao") };
  if (conversa?.insights?.length) return { intencao: INSIGHT_EXPLICAR, params: { insightId: conversa.insights[0] } };
  if (["custos.cmv", "custos.por_que_cmv"].includes(conversa?.intencao)) return { intencao: intencaoPorId("custos.por_que_cmv") };
  if (conversa?.intencao === "vendas.faturamento") return { intencao: INSIGHT_EXPLICAR, params: { modulo: "vendas" } };
  if (produto || temVerbo) return { intencao: intencaoPorId("produto.explicar_variacao") };
  return null;
}

/**
 * @param {object} p
 * @param {object} p.pedido         já validado por pedidoSchema
 * @param {object} p.ic             contexto da inteligência (Context Engine)
 * @param {object} p.motor          Metrics Engine
 * @param {object} p.servicoAcoes   criarServicoDeAcoes(...)
 * @param {object} p.store
 * @param {object} [p.provedor]     AIProvider
 * @param {string} [p.nomeUsuario]
 * @param {string} p.correlationId
 */
export async function processarComando({ pedido, ic, motor, servicoAcoes, store, provedor = null, nomeUsuario = "", correlationId }) {
  const inicio = Date.now();
  const trilha = criarTrilha();
  const canal = pedido.canal === "voz" ? "voz" : "texto";
  let resposta;
  let interp = null;
  let origem = null;
  let ia = null;
  let intencao = null;

  if (pedido.continuar) {
    const c = pedido.continuar;
    resposta = await servicoAcoes.responder({ acaoId: c.acaoId, campo: c.campo, valor: c.valorNumero ?? c.valor, correlationId });
    trilha.passar("acao", NIVEL.AGIR);
  } else if (!pedido.texto) {
    resposta = { tipo: "nao_entendi", texto: "Diga ou digite o que você precisa.", sugestoes: EXEMPLOS.slice(0, 5) };
  } else {
    ({ interpretacao: interp, origem, ia } = await interpretar({ texto: pedido.texto, modulo: ic.tela.modulo, provedor }));
    intencao = intencaoPorId(interp.intencao);
    const params = { ...interp };
    const conversa = pedido.conversa || null;
    const produtoCtx = produtoDoContexto(ic, conversa);
    let porQue = null;
    if (intencao?.id === "conversa.por_que") {
      porQue = resolverPorQue({ texto: pedido.texto, conversa, produtoCtx });
      if (porQue) { intencao = porQue.intencao; Object.assign(params, porQue.params || {}); }
    }
    // Produto não dito ("Perdi 2 kg.", "Quanto tenho?", "Por que aumentou?"):
    // vem do contexto pelo ID e é reconferido no cadastro DA UNIDADE (o nome é só rótulo).
    const usaProduto = intencao && (intencao.requerProduto || intencao.acao === "stock.registerLoss" || intencao.id === "estoque.saldo_produto");
    const semProdutoDito = !interp.produto;

    if (intencao?.id === "conversa.por_que") {
      resposta = { tipo: "pergunta", texto: "Por que o quê?", pergunta: { campo: "assunto", livre: true, texto: "Sobre o que você quer a explicação? Ex.: \"por que o CMV subiu?\", \"por que a picanha aumentou?\" ou \"tem alguma coisa errada?\"" } };
      trilha.passar("explicacao", NIVEL.OBSERVAR);
    } else if (usaProduto && semProdutoDito && produtoCtx?.ambiguo) {
      const base = String(pedido.texto).trim().replace(/[.!?]+$/, "");
      resposta = {
        tipo: "pergunta", texto: "De qual produto você está falando?",
        pergunta: { campo: "produto", texto: "De qual produto você está falando?", opcoes: produtoCtx.ambiguo.map((p) => ({ id: p.id, rotulo: `${p.nome || "produto"} (${p.origem === "tela" ? "tela aberta" : "conversa"})`, comando: `${base} de ${p.nome}` })).filter((o) => !/ de (null|undefined)$/.test(o.comando)) },
      };
    } else if (!intencao) {
      resposta = { tipo: "nao_entendi", texto: "Não entendi o pedido. Veja exemplos do que eu sei responder:", sugestoes: EXEMPLOS };
    } else if (intencao.tipo === "navegacao") {
      const d = DESTINOS[interp.destino];
      const [caminho, busca = ""] = d.rota.split("?");
      const sessaoServidor = { gerenciado: true, super_admin: ic.usuario.superAdmin, permissions: [...(ic.permissoes || [])] };
      resposta = canAccessRoute(sessaoServidor, caminho, busca)
        ? { tipo: "navegacao", texto: `Abrindo ${d.rotulo}.`, rota: d.rota }
        : { tipo: "bloqueado", texto: `Você não tem acesso a ${d.rotulo}.` };
      trilha.passar("acao", NIVEL.OBSERVAR);
    } else if (intencao.tipo === "acao") {
      trilha.passar("recomendacao", NIVEL.RECOMENDAR);
      if (usaProduto && semProdutoDito && produtoCtx && !produtoCtx.ambiguo) params.insumoId = produtoCtx.id;
      resposta = await servicoAcoes.iniciar({ acaoId: intencao.acao, params, comando: pedido.texto, chave: pedido.chave, correlationId });
      trilha.passar("acao", NIVEL.AGIR);
    } else {
      const insumoIdContexto = usaProduto && semProdutoDito && produtoCtx && !produtoCtx.ambiguo ? produtoCtx.id : null;
      const out = await responderPergunta({ intencao, params: { ...params, insumoIdContexto }, ic, motor, store, nomeUsuario, trilha });
      resposta = { tipo: out.pergunta ? "pergunta" : "resposta", ...out };
    }
  }

  const consultas = motor.ambiente.dbe.consultas;
  const latenciaMs = Date.now() - inicio;
  // O que esta resposta citou: volta no próximo pedido como `conversa` ("Por quê?", "Perdi 2 kg.")
  const produtoCitado = resposta.referencia?.produto || resposta.confirmacao?.entidade || null;
  const referencia = intencao || produtoCitado ? {
    intencao: intencao && IDS_INTENCAO.includes(intencao.id) ? intencao.id : null,
    produto: produtoCitado?.id && UUID.test(produtoCitado.id) ? { id: produtoCitado.id, nome: produtoCitado.nome || null } : null,
    insights: Array.isArray(resposta.referencia?.insights) ? resposta.referencia.insights.slice(0, 5) : null,
  } : null;
  const final = {
    ...resposta,
    referencia,
    interpretacao: interp ? {
      intencao: intencao?.id || interp.intencao, origem, confianca: interp.confianca, periodo: interp.periodo, produto: interp.produto,
      // "por quê?" resolvido pelo contexto: fica registrado de onde veio
      ...(intencao && intencao.id !== interp.intencao ? { deduzidaDe: interp.intencao } : {}),
    } : null,
    agentes: resposta.agentes || (intencao?.agentes || []),
    etapas: trilha.resumo(),
    correlationId,
    apuradoEm: motor.ambiente.apuradoEm,
    fontesConsultadas: [...new Set(consultas.map((c) => c.fonte))],
  };
  final.auditado = await auditar(store, ic.escopo, {
    correlationId, canal, etapa: ETAPA_AUDITORIA.PEDIDO,
    comando: pedido.texto ?? (pedido.continuar ? `[resposta ${pedido.continuar.campo}]` : null),
    entidadeTipo: ic.entidade?.tipo || null, entidadeId: ic.entidade?.id || null,
    intencao: final.interpretacao, agentes: final.agentes, consultas,
    recomendacao: resposta.tipo === "resposta" ? resposta.texto : null,
    acaoId: resposta.confirmacao?.acaoId || resposta.pergunta?.acaoId || resposta.resultado?.acaoId || null,
    resultado: { tipo: resposta.tipo, nivel: final.etapas.nivel },
    latenciaMs, provedor: ia?.provedor || null, modelo: ia?.modelo || null,
    tokensEntrada: ia?.uso?.entrada ?? null, tokensSaida: ia?.uso?.saida ?? null,
    fallback: ia?.erro ? `regras (IA: ${ia.erro})` : ia?.fallback || null,
  });
  return final;
}

export { INTENCOES };
