// COMMAND BUS — porta única de pedidos em linguagem natural (texto hoje; voz
// usa a mesma porta: o áudio vira texto ANTES de chegar aqui).
//
//   texto → INTENÇÃO (regras/IA, validada) → ENTIDADE/PARÂMETROS → tipo:
//     pergunta  → Orchestrator → especialistas → Metrics Engine (só leitura)
//     acao      → ActionRegistry/Serviço (pergunta o que falta → prévia → confirmação)
//     navegacao → rota da lista fechada, se o usuário pode abrir
//   → resposta tipada + auditoria do pedido (com correlation id)

import { assistenteDoContexto } from "../../assistentes.mjs";
import { s } from "../schemas/schema.mjs";
import { intencaoPorId, DESTINOS, INTENCOES, IDS_INTENCAO } from "./catalogo.mjs";
import { interpretar } from "./interpretar.mjs";
import { palavras } from "./interpretador-regras.mjs";
import { motivoDaEntrada, MOTIVOS_ENTRADA } from "../actions/registrar-entrada.mjs";
import { dividirEmItens } from "./lote.mjs";
import { paramsDoComando } from "../actions/criar-ficha.mjs";
import { responderLivre, FOCO_SALAO } from "../agents/geral.mjs";
import { sugestoesDaResposta } from "./sugestoes.mjs";
import { notaSchema } from "../actions/lancar-nota.mjs";
import { responderPergunta } from "../agents/orquestrador.mjs";
import { criarTrilha, NIVEL } from "../core/niveis.mjs";
import { auditar, ETAPA_AUDITORIA } from "../audit/auditoria.mjs";
import { canAccessRoute, hasPermission } from "../../permissions-catalog.mjs";
import { buscarProcedimento } from "../agents/procedimentos.mjs";

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
  // leitura da foto da DANFE (/api/ocr): começa o lançamento da compra (purchase.fromInvoice)
  nota: s.opcional(notaSchema),
  // O que a resposta ANTERIOR desta conversa citou (devolvido pelo servidor em
  // `referencia`). Não confiável: produto é reconferido no banco da unidade e
  // insight é procurado entre os recalculados agora — nunca usado como dado.
  conversa: s.opcional(s.object({
    intencao: s.opcional(s.enum(IDS_INTENCAO)),
    produto: s.opcional(s.object({ id: s.uuid(), nome: s.opcional(s.string({ max: 80 })) })),
    insights: s.opcional(s.array(s.string({ max: 80, padrao: /^[a-z_]+:[0-9a-f]{8}$/ }), { max: 5 })),
    // ficha técnica citada ("quanto custa 200 g DESSA receita?", "montar um prato com ESSA base"): reconferida no banco
    ficha: s.opcional(s.object({ id: s.uuid(), nome: s.opcional(s.string({ max: 80 })) })),
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

const fmtQ = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const PALAVRA_MOTIVO = Object.freeze({ recebimento: "recebimento", producao: "producao", devolucao: "devolucao", transferencia_recebida: "transferencia" });

/** Vários itens numa frase: o motivo é perguntado UMA vez; depois, uma ação por item. */
export async function processarLote({ lote, intencao, pedido, servicoAcoes, correlationId }) {
  const descr = lote.itens.map(({ interpretacao: i }) => `${fmtQ(i.quantidade)}${i.unidade ? ` ${i.unidade}` : ""} de ${i.produto}`);
  const entrada = intencao.acao === "stock.registerEntry";
  const motivoEntrada = entrada ? motivoDaEntrada(pedido.texto) : null;
  if (entrada && !motivoEntrada) {
    return {
      tipo: "pergunta",
      texto: `Entendi ${lote.itens.length} itens: ${descr.join("; ")}. Qual é a origem da entrada?`,
      pergunta: {
        campo: "motivoEntrada", texto: "Qual é a origem da entrada? (Compra com nota se lança em Compras, para entrar com custo e conta a pagar.)",
        opcoes: Object.entries(MOTIVOS_ENTRADA).map(([id, m]) => ({ id, rotulo: m.rotulo, comando: `Dei entrada por ${PALAVRA_MOTIVO[id]} de ${descr.join(", ")}` })),
      },
    };
  }
  const base = String(pedido.chave || "").slice(0, 76);
  const itens = [];
  for (let n = 0; n < lote.itens.length; n++) {
    const { texto, interpretacao } = lote.itens[n];
    const params = { ...interpretacao, ...(entrada ? { motivoEntrada } : {}) };
    const r = await servicoAcoes.iniciar({ acaoId: intencao.acao, params, comando: texto, chave: base ? `${base}:${n + 1}` : null, correlationId });
    itens.push({ ...r, item: descr[n] });
  }
  const aConfirmar = itens.filter((x) => x.tipo === "confirmacao").length;
  const texto = aConfirmar === itens.length
    ? `${itens.length} itens separados, cada um no local dele. Confira e confirme:`
    : `${itens.length} itens. ${aConfirmar ? `${aConfirmar} pronto(s) para confirmar; ` : ""}os outros precisam de uma resposta:`;
  return { tipo: "lote", texto, itens };
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
  let lote = null;

  if (pedido.continuar) {
    const c = pedido.continuar;
    resposta = await servicoAcoes.responder({ acaoId: c.acaoId, campo: c.campo, valor: c.valorNumero ?? c.valor, correlationId });
    trilha.passar("acao", NIVEL.AGIR);
  } else if (pedido.nota) {
    // foto da nota lida: cada item é conferido na conversa e a compra sai com prévia e CONFIRMAR
    intencao = intencaoPorId("compras.foto_nota");
    interp = { intencao: intencao.id, confianca: 1, periodo: null, produto: null };
    origem = "regras";
    trilha.passar("acao", NIVEL.AGIR);
    resposta = await servicoAcoes.iniciar({ acaoId: "purchase.fromInvoice", params: { nota: pedido.nota }, comando: `Foto da nota${pedido.nota.numero ? ` ${pedido.nota.numero}` : ""}${pedido.nota.fornecedor ? ` — ${pedido.nota.fornecedor}` : ""}`.slice(0, 500), chave: pedido.chave, correlationId });
    // o que foi lido, antes da primeira pergunta (a pessoa confere se a leitura pegou a nota certa)
    if (resposta?.texto && ["pergunta", "confirmacao"].includes(resposta.tipo)) {
      const n = pedido.nota;
      const total = n.valor_total ? `, total ${Number(n.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "";
      resposta = { ...resposta, texto: `Li a nota${n.numero ? ` ${n.numero}` : ""}${n.fornecedor ? ` de ${n.fornecedor}` : ""}: ${n.itens.length} ${n.itens.length === 1 ? "item" : "itens"}${total}. ${resposta.texto}` };
    }
  } else if (!pedido.texto) {
    resposta = { tipo: "nao_entendi", texto: "Diga ou digite o que você precisa.", sugestoes: EXEMPLOS.slice(0, 5) };
  } else if ((lote = dividirEmItens(pedido.texto))) {
    // "Adicione 3 kg de picanha, 4 kg de xarope": uma ação por item, cada uma com prévia própria
    intencao = intencaoPorId(lote.intencao);
    interp = { ...lote.itens[0].interpretacao, produto: null, quantidade: null, unidade: null };
    origem = "regras";
    trilha.passar("recomendacao", NIVEL.RECOMENDAR);
    resposta = await processarLote({ lote, intencao, pedido, servicoAcoes, correlationId });
    trilha.passar("acao", NIVEL.AGIR);
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
    const usaProduto = intencao && (intencao.requerProduto || intencao.acao === "stock.registerLoss" || intencao.acao === "stock.registerEntry" || intencao.id === "estoque.saldo_produto");
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
    } else if (intencao?.id === "salao.orientacao") {
      // salão: primeiro o procedimento que a casa cadastrou (REAL, sem modelo de linguagem);
      // sem cadastro, o passo a passo padrão do agente geral (SUGESTÃO). Nada é gravado.
      const sessaoServidor = { gerenciado: true, super_admin: ic.usuario.superAdmin, permissions: [...(ic.permissoes || [])] };
      const podeEditar = hasPermission(sessaoServidor, "dashboard.intelligence.settings") || canAccessRoute(sessaoServidor, "/dashboard/operacao/inteligente");
      const daCasa = await buscarProcedimento({ texto: pedido.texto, dbe: motor.ambiente.dbe, podeEditar });
      if (daCasa.resposta) {
        resposta = daCasa.resposta;
      } else {
        const livre = await responderLivre({ texto: pedido.texto, motor, store, provedor, nomeUsuario, exemplos: EXEMPLOS, foco: FOCO_SALAO, assistente: assistenteDoContexto(ic) });
        resposta = { ...livre.resposta, agentes: ["geral"], acoes: [...(livre.resposta.acoes || []), ...(daCasa.cadastrar ? [daCasa.cadastrar] : [])] };
        if (livre.ia) ia = { ...(ia || {}), ...livre.ia };
      }
      trilha.passar("explicacao", NIVEL.ANALISAR);
    } else if (!intencao) {
      // nenhum comando pronto: o agente geral responde com os dados do sistema (nunca "não sei")
      const livre = await responderLivre({ texto: pedido.texto, motor, store, provedor, nomeUsuario, exemplos: EXEMPLOS, assistente: assistenteDoContexto(ic) });
      resposta = { ...livre.resposta, agentes: ["geral"] };
      if (livre.ia) ia = { ...(ia || {}), ...livre.ia };
      trilha.passar("explicacao", NIVEL.ANALISAR);
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
      if (intencao.acao === "stock.registerEntry") params.motivoEntrada = motivoDaEntrada(pedido.texto);
      const paramsAcao = intencao.acao === "recipe.create" ? paramsDoComando(pedido.texto, conversa) : params;
      resposta = await servicoAcoes.iniciar({ acaoId: intencao.acao, params: paramsAcao, comando: pedido.texto, chave: pedido.chave, correlationId });
      trilha.passar("acao", NIVEL.AGIR);
    } else {
      const insumoIdContexto = usaProduto && semProdutoDito && produtoCtx && !produtoCtx.ambiguo ? produtoCtx.id : null;
      // ficha da conversa: só o id volta ao servidor, e a métrica procura entre as fichas DESTA unidade
      const fichaIdContexto = conversa?.ficha?.id && UUID.test(conversa.ficha.id) ? conversa.ficha.id : null;
      const out = await responderPergunta({ intencao, params: { ...params, insumoIdContexto, fichaIdContexto, texto: pedido.texto }, ic, motor, store, nomeUsuario, trilha });
      resposta = { tipo: out.pergunta ? "pergunta" : "resposta", ...out };
    }
  }

  const consultas = motor.ambiente.dbe.consultas;
  const latenciaMs = Date.now() - inicio;
  // O que esta resposta citou: volta no próximo pedido como `conversa` ("Por quê?", "Perdi 2 kg.")
  const produtoCitado = resposta.referencia?.produto || resposta.confirmacao?.entidade || null;
  const fichaCitada = resposta.referencia?.ficha?.id && UUID.test(resposta.referencia.ficha.id) ? { id: resposta.referencia.ficha.id, nome: resposta.referencia.ficha.nome || null } : null;
  const referencia = intencao || produtoCitado || fichaCitada ? {
    intencao: intencao && IDS_INTENCAO.includes(intencao.id) ? intencao.id : null,
    produto: produtoCitado?.id && UUID.test(produtoCitado.id) ? { id: produtoCitado.id, nome: produtoCitado.nome || null } : null,
    insights: Array.isArray(resposta.referencia?.insights) ? resposta.referencia.insights.slice(0, 5) : null,
    // a ficha citada continua valendo na conversa até outra ser citada
    ficha: fichaCitada || (pedido.conversa?.ficha?.id ? { id: pedido.conversa.ficha.id, nome: pedido.conversa.ficha.nome || null } : null),
  } : null;
  // próximos passos: toda resposta termina com o que dá para perguntar em seguida
  const sugestoes = sugestoesDaResposta({ intencao: intencao?.id || null, resposta, referencia, interpretacao: interp, texto: pedido.texto || "" });
  const final = {
    ...resposta,
    ...(sugestoes.length ? { sugestoes } : {}),
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
