// COMMAND BUS — porta única de pedidos em linguagem natural (texto hoje; voz
// usa a mesma porta: o áudio vira texto ANTES de chegar aqui).
//
//   texto → INTENÇÃO (regras/IA, validada) → ENTIDADE/PARÂMETROS → tipo:
//     pergunta  → Orchestrator → especialistas → Metrics Engine (só leitura)
//     acao      → ActionRegistry/Serviço (pergunta o que falta → prévia → confirmação)
//     navegacao → rota da lista fechada, se o usuário pode abrir
//   → resposta tipada + auditoria do pedido (com correlation id)

import { s } from "../schemas/schema.mjs";
import { intencaoPorId, DESTINOS, INTENCOES } from "./catalogo.mjs";
import { interpretar } from "./interpretar.mjs";
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
});

export const EXEMPLOS = Object.freeze([
  "Como foi minha empresa hoje?", "Quanto vendi esta semana?", "Quanto comprei esta semana?",
  "Qual produto teve maior aumento de preço?", "Quais produtos estão próximos do vencimento?",
  "Tem alguma diferença estranha no estoque?", "Quais contas vencem nos próximos dias?",
  "Como está meu CMV?", "Como está meu CMO?", "Perdi 2 kg de picanha",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    // "Por que aumentou?" olhando a Picanha: o produto vem da tela (reconferido no banco pelo agente)
    const params = { ...interp };
    if (!params.produto && ic.entidade?.tipo === "produto" && intencao?.requerProduto) params.produto = ic.entidade.nome || null;

    if (!intencao) {
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
      resposta = await servicoAcoes.iniciar({ acaoId: intencao.acao, params, comando: pedido.texto, chave: pedido.chave, correlationId });
      trilha.passar("acao", NIVEL.AGIR);
    } else {
      const ent = ic.entidade?.tipo === "produto" && ic.entidade.id && UUID.test(ic.entidade.id) && !interp.produto ? ic.entidade : null;
      const out = await responderPergunta({ intencao, params: { ...params, insumoIdTela: ent?.id || null }, ic, motor, store, nomeUsuario, trilha });
      resposta = { tipo: out.pergunta ? "pergunta" : "resposta", ...out };
    }
  }

  const consultas = motor.ambiente.dbe.consultas;
  const latenciaMs = Date.now() - inicio;
  const final = {
    ...resposta,
    interpretacao: interp ? { intencao: interp.intencao, origem, confianca: interp.confianca, periodo: interp.periodo, produto: interp.produto } : null,
    agentes: resposta.agentes || (intencao?.agentes || []),
    etapas: trilha.resumo(),
    correlationId,
    apuradoEm: motor.ambiente.apuradoEm,
    fontesConsultadas: [...new Set(consultas.map((c) => c.fonte))],
  };
  final.auditado = await auditar(store, ic.escopo, {
    correlationId, canal, etapa: ETAPA_AUDITORIA.PEDIDO,
    comando: pedido.texto ?? (pedido.continuar ? `[resposta ${pedido.continuar.campo}]` : null),
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
