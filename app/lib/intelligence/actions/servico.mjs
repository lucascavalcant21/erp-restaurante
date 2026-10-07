// SERVIÇO DE AÇÕES — ciclo de vida de toda ação da inteligência:
//
//   rascunho ──(campos completos)──► proposta ──(Confirmar)──► executando ──► executada
//      │  ▲ pergunta o que falta         │                          └──────► falhou
//      └──┴──────────────► cancelada ◄───┘ (Cancelar)   proposta vencida ► expirada
//
// Garantias:
//   - o pedido é guardado no SERVIDOR (store) com usuário e unidade do escopo;
//     o cliente só manda o id da ação e a resposta do campo perguntado;
//   - mesma chave de idempotência do mesmo usuário → a mesma ação (duplo envio
//     não cria duas); a confirmação troca o status de forma atômica (duplo
//     clique não executa duas vezes); e o banco ainda recebe a chave
//     "ia:<id>" (estoque_movimentar não grava o mesmo lançamento duas vezes);
//   - sem auditoria gravada, nada é executado (falha fechada);
//   - permissão conferida no banco ao propor e de novo ao confirmar.

import { acaoPorId, politicaDaAcao } from "./registry.mjs";
import { exigirAuditoria, auditar, ETAPA_AUDITORIA, redigir } from "../audit/auditoria.mjs";
import { s, mensagemDeErro } from "../schemas/schema.mjs";

export const VALIDADE_PROPOSTA_MIN = 10;

export const chaveSchema = s.string({ min: 8, max: 80, padrao: /^[A-Za-z0-9_\-:.]+$/ });

/**
 * @param {object} p
 * @param {object} p.store          store de ações/auditoria
 * @param {object} p.escopo         escopo autêntico
 * @param {object} p.dbe            banco escopado (leitura para preparar)
 * @param {object} p.dbUsuario      cliente do usuário (execução via funções do banco)
 * @param {object} p.verificador    criarVerificador(...)
 * @param {string} [p.nomeUsuario]
 * @param {string} [p.canal]
 * @param {() => Date} [p.relogio]
 */
export function criarServicoDeAcoes({ store, escopo, dbe, dbUsuario, verificador, nomeUsuario = "", canal = "web", relogio = () => new Date() }) {
  const dono = { unidadeId: escopo.unidadeId, authUserId: escopo.userId };
  const aud = (e) => ({ canal, agora: relogio(), ...e });

  async function permitido(def) {
    return def.capacidade ? verificador.pode(def.capacidade) : false;
  }

  function cartaoDeConfirmacao(rec, def) {
    const pol = politicaDaAcao(def);
    return {
      tipo: "confirmacao",
      texto: `${rec.preview.titulo}: confira e confirme.`,
      confirmacao: {
        acaoId: rec.id, acao: def.id, titulo: rec.preview.titulo, linhas: rec.preview.linhas, risco: def.risco,
        confirmacaoExplicita: pol.confirmacaoExplicita, expiraEm: rec.expira_em, rollback: def.rollback,
      },
    };
  }

  function estado(rec, def) {
    switch (rec.status) {
      case "proposta": return cartaoDeConfirmacao(rec, def);
      case "executada": return resultadoExecutado(rec, def, true);
      case "executando": return { tipo: "aguarde", texto: "Esta ação já está sendo executada." };
      case "cancelada": return { tipo: "erro_acao", texto: "Esta ação foi cancelada." };
      case "expirada": return { tipo: "erro_acao", texto: "A confirmação expirou. Faça o pedido de novo." };
      case "falhou": return { tipo: "erro_acao", texto: `A ação falhou: ${rec.erro || "erro desconhecido"}` };
      default: return null;
    }
  }

  function resultadoExecutado(rec, def, repetido = false) {
    const r = rec.resultado || {};
    const un = rec.preview?.unidadeSaldo || r.unidadeMedida || "";
    const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
    const linhas = [
      ...(rec.preview?.linhas || []).filter((l) => ["Produto", "Local", "Quantidade", "Motivo"].includes(l.rotulo)),
      rec.antes?.saldo != null ? { rotulo: "Saldo", valor: `${fmt(rec.antes.saldo)} → ${fmt(rec.depois?.saldo)} ${un}` } : null,
      r.valorTotal != null ? { rotulo: "Valor do movimento", valor: `${Number(r.valorTotal).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (custo médio)` } : null,
    ].filter(Boolean);
    return {
      tipo: "resultado_acao",
      texto: def.id === "stock.registerLoss" ? "Perda registrada." : "Ação executada.",
      resultado: { acaoId: rec.id, acao: def.id, linhas, movimentoId: r.movimentoId || null, repetido },
      acoes: [{ rotulo: "Ver movimentações", rota: "/dashboard/operacao/estoque/movimentar" }],
    };
  }

  async function avancar(rec, def, correlationId) {
    let prep;
    try {
      prep = await def.preparar({ dbe, escopo }, rec.params || {});
    } catch (e) {
      prep = { erro: e?.ausente ? `${e.message}` : "Não foi possível preparar a ação agora." };
    }
    if (prep.erro) {
      await store.transicionarAcao({ id: rec.id, ...dono, de: ["rascunho"], para: "cancelada", campos: { erro: prep.erro }, agora: relogio() });
      await auditar(store, escopo, aud({ correlationId, etapa: ETAPA_AUDITORIA.BLOQUEIO, acaoId: rec.id, acaoTipo: def.id, risco: def.risco, erro: prep.erro }));
      return { tipo: "erro_acao", texto: prep.erro, acaoId: rec.id };
    }
    if (prep.faltando) {
      return { tipo: "pergunta", texto: prep.faltando.texto, pergunta: { acaoId: rec.id, ...prep.faltando } };
    }
    const expira = new Date(relogio().getTime() + VALIDADE_PROPOSTA_MIN * 60000).toISOString();
    const prop = await store.transicionarAcao({
      id: rec.id, ...dono, de: ["rascunho"], para: "proposta",
      campos: { preview: prep.pronto.preview, payload: prep.pronto.payload, expira_em: expira, entidade_id: prep.pronto.preview.entidade?.id || null },
      agora: relogio(),
    });
    if (!prop) return { tipo: "erro_acao", texto: "Esta ação mudou de estado enquanto era preparada. Faça o pedido de novo." };
    await exigirAuditoria(store, escopo, aud({
      correlationId, etapa: ETAPA_AUDITORIA.PROPOSTA, acaoId: rec.id, acaoTipo: def.id, risco: def.risco,
      entidadeTipo: prop.preview.entidade?.tipo, entidadeId: prop.preview.entidade?.id, antes: { saldo: prop.preview.saldoAntes },
      depois: { saldoPrevisto: prop.preview.saldoDepois }, resultado: { status: "proposta", impacto: prop.preview.impacto || null },
    }));
    return cartaoDeConfirmacao(prop, def);
  }

  return {
    /** Pedido novo de ação (vindo do Command Bus). */
    async iniciar({ acaoId, params = {}, comando = "", chave, correlationId }) {
      const def = acaoPorId(acaoId);
      const pol = politicaDaAcao(def);
      if (!pol.permitido) {
        await auditar(store, escopo, aud({ correlationId, etapa: ETAPA_AUDITORIA.BLOQUEIO, comando, acaoTipo: acaoId, risco: def?.risco || null, erro: pol.motivo }));
        return { tipo: "bloqueado", texto: pol.motivo };
      }
      if (!(await permitido(def))) {
        await auditar(store, escopo, aud({ correlationId, etapa: ETAPA_AUDITORIA.BLOQUEIO, comando, acaoTipo: acaoId, risco: def.risco, erro: "sem permissão" }));
        return { tipo: "bloqueado", texto: "Você não tem permissão para essa ação nesta unidade." };
      }
      const ch = chaveSchema.parse(chave);
      if (!ch.ok) return { tipo: "erro_acao", texto: "Pedido sem identificador de envio: recarregue a tela." };
      const limpos = Object.fromEntries(def.campos.map((c) => [c, params[c] ?? null]));
      const v = def.paramsSchema.parse(limpos);
      const inicial = v.ok ? v.valor : Object.fromEntries(def.campos.map((c) => [c, null]));
      const agora = relogio().toISOString();
      const rec = await store.criarAcao({
        unidade_id: escopo.unidadeId, empresa_id: escopo.empresaId, auth_user_id: escopo.userId, correlation_id: correlationId,
        chave_idempotencia: ch.valor, tipo: def.id, risco: def.risco, status: "rascunho", comando: redigir(comando),
        params: inicial, preview: null, payload: null, resultado: null, erro: null,
        expira_em: new Date(relogio().getTime() + VALIDADE_PROPOSTA_MIN * 60000).toISOString(), created_at: agora, updated_at: agora,
      });
      if (rec.repetida && rec.status !== "rascunho") return { ...estado(rec, def), repetido: true };
      return avancar(rec, def, correlationId);
    },

    /** Resposta do usuário à pergunta de um campo que faltava. */
    async responder({ acaoId, campo, valor, correlationId }) {
      const rec = await store.buscarAcao({ id: acaoId, ...dono });
      if (!rec) return { tipo: "erro_acao", texto: "Ação não encontrada." };
      const def = acaoPorId(rec.tipo);
      if (rec.status !== "rascunho") return estado(rec, def) || { tipo: "erro_acao", texto: "Esta ação não está esperando resposta." };
      if (!def.campos.includes(campo)) return { tipo: "erro_acao", texto: "Campo inválido para esta ação." };
      const um = def.paramsSchema.forma[campo].parse(valor);
      if (!um.ok || um.valor == null) return { tipo: "pergunta", texto: `Resposta inválida: ${mensagemDeErro(um) || "vazia"}. Tente de novo.`, pergunta: { acaoId, campo, texto: "Tente de novo.", livre: true } };
      const novos = { ...rec.params, [campo]: um.valor };
      if (campo === "produto") { novos.insumoId = null; novos.estoqueId = null; }
      if (campo === "insumoId") novos.estoqueId = null;
      const atual = await store.transicionarAcao({ id: rec.id, ...dono, de: ["rascunho"], para: "rascunho", campos: { params: novos }, agora: relogio() });
      if (!atual) return { tipo: "erro_acao", texto: "Esta ação mudou de estado. Faça o pedido de novo." };
      return avancar(atual, def, correlationId || rec.correlation_id);
    },

    /** Confirmar: o ÚNICO caminho que chama o executor. */
    async confirmar({ acaoId, confirmacaoTexto = null, correlationId }) {
      const rec = await store.buscarAcao({ id: acaoId, ...dono });
      if (!rec) return { tipo: "erro_acao", texto: "Ação não encontrada." };
      const def = acaoPorId(rec.tipo);
      const pol = politicaDaAcao(def);
      if (rec.status !== "proposta") return { ...(estado(rec, def) || { tipo: "erro_acao", texto: "Esta ação não está aguardando confirmação." }), repetido: rec.status === "executada" };
      if (Date.parse(rec.expira_em) <= relogio().getTime()) {
        await store.transicionarAcao({ id: rec.id, ...dono, de: ["proposta"], para: "expirada", agora: relogio() });
        return { tipo: "erro_acao", texto: "A confirmação expirou. Faça o pedido de novo." };
      }
      if (!pol.permitido) return { tipo: "bloqueado", texto: pol.motivo };
      if (pol.confirmacaoExplicita && confirmacaoTexto !== "CONFIRMAR") return { tipo: "erro_acao", texto: "Esta ação exige digitar CONFIRMAR." };
      if (!(await permitido(def))) return { tipo: "bloqueado", texto: "Você não tem permissão para essa ação nesta unidade." };

      const exec = await store.transicionarAcao({ id: rec.id, ...dono, de: ["proposta"], para: "executando", campos: { confirmada_em: relogio().toISOString() }, agora: relogio() });
      if (!exec) {
        const agora = await store.buscarAcao({ id: acaoId, ...dono });
        return { ...(estado(agora, def) || { tipo: "erro_acao", texto: "Esta ação já foi tratada." }), repetido: true };
      }
      const corr = correlationId || rec.correlation_id;
      try {
        await exigirAuditoria(store, escopo, aud({ correlationId: corr, etapa: ETAPA_AUDITORIA.CONFIRMACAO, acaoId: rec.id, acaoTipo: def.id, risco: def.risco, entidadeTipo: rec.preview?.entidade?.tipo, entidadeId: rec.preview?.entidade?.id }));
      } catch (e) {
        await store.transicionarAcao({ id: rec.id, ...dono, de: ["executando"], para: "falhou", campos: { erro: e.message }, agora: relogio() });
        return { tipo: "erro_acao", texto: e.message };
      }

      let r;
      const inicio = Date.now();
      try {
        r = await def.executar({ dbUsuario, escopo, nomeUsuario }, rec.payload, { chave: `ia:${rec.id}` });
      } catch {
        r = { ok: false, erro: "Falha inesperada ao executar a ação." };
      }
      const latenciaMs = Date.now() - inicio;
      if (!r.ok) {
        await store.transicionarAcao({ id: rec.id, ...dono, de: ["executando"], para: "falhou", campos: { erro: r.erro }, agora: relogio() });
        await auditar(store, escopo, aud({ correlationId: corr, etapa: ETAPA_AUDITORIA.FALHA, acaoId: rec.id, acaoTipo: def.id, risco: def.risco, entidadeTipo: rec.preview?.entidade?.tipo, entidadeId: rec.preview?.entidade?.id, erro: r.erro, latenciaMs }));
        return { tipo: "erro_acao", texto: r.erro };
      }
      const feito = await store.transicionarAcao({
        id: rec.id, ...dono, de: ["executando"], para: "executada",
        campos: { resultado: r.resultado, antes: r.antes, depois: r.depois, executada_em: relogio().toISOString() }, agora: relogio(),
      });
      const auditado = await auditar(store, escopo, aud({
        correlationId: corr, etapa: ETAPA_AUDITORIA.EXECUCAO, acaoId: rec.id, acaoTipo: def.id, risco: def.risco,
        entidadeTipo: rec.preview?.entidade?.tipo, entidadeId: rec.preview?.entidade?.id, antes: r.antes, depois: r.depois,
        resultado: r.resultado, latenciaMs,
      }));
      const saida = resultadoExecutado(feito || { ...rec, resultado: r.resultado, antes: r.antes, depois: r.depois }, def);
      if (!auditado) saida.avisos = ["A ação foi executada, mas o registro final da auditoria falhou; o movimento está no histórico do estoque."];
      return saida;
    },

    async cancelar({ acaoId, correlationId }) {
      const rec = await store.buscarAcao({ id: acaoId, ...dono });
      if (!rec) return { tipo: "erro_acao", texto: "Ação não encontrada." };
      const c = await store.transicionarAcao({ id: rec.id, ...dono, de: ["rascunho", "proposta"], para: "cancelada", agora: relogio() });
      if (!c) return estado(rec, acaoPorId(rec.tipo)) || { tipo: "erro_acao", texto: "Esta ação não pode mais ser cancelada." };
      await auditar(store, escopo, aud({ correlationId: correlationId || rec.correlation_id, etapa: ETAPA_AUDITORIA.CANCELAMENTO, acaoId: rec.id, acaoTipo: rec.tipo }));
      return { tipo: "cancelado", texto: "Cancelado. Nada foi alterado." };
    },
  };
}
