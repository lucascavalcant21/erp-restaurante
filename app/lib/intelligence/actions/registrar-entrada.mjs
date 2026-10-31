// AÇÃO stock.registerEntry — "Dei entrada de 10 kg de batata.", "Chegaram 3 caixas de coca."
//
// Mesmo caminho da tela de Estoque → Movimentar (entrada): a quantidade passa
// por quantidadeDoLancamento (embalagens do cadastro e/ou fração kg/g, L/ml) e
// a gravação é registrarMovimento → RPC estoque_movimentar (EST-MOV-1), que
// confere a permissão NO BANCO com o usuário logado, cria o item no local na
// primeira entrada e não duplica (chave de idempotência).
//
// "Compra" não é motivo daqui: compra entra no estoque ao CONFIRMAR em Compras
// (EST-MOV-4), com custo e conta a pagar. Pela conversa só recebimento,
// produção, devolução e transferência recebida — como na tela.
//
// Fluxo: produto (mais de um → pergunta qual) → local (onde o produto já está;
// em dúvida → pergunta) → quantidade e unidade (embalagem do cadastro ou
// fração; em dúvida → pergunta) → motivo (ausente → pergunta) → prévia →
// confirmação → executor. Campo que falta é PERGUNTADO, nunca inventado.

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { CAMPOS_INSUMO, candidatosDoTermo, fmtQtd } from "../metrics/produtos.mjs";
import { quantidadeDoLancamento, unidadesDaFracao, embalagemDoProduto, saldoDepois, registrarMovimento } from "../../estoque-movimento.mjs";

export const MOTIVOS_ENTRADA = Object.freeze({
  recebimento: { rotulo: "Recebimento (chegou mercadoria)", codigo: "recebimento" },
  producao: { rotulo: "Produção (preparo da casa)", codigo: "producao" },
  devolucao: { rotulo: "Devolução", codigo: "devolucao" },
  transferencia_recebida: { rotulo: "Transferência recebida", codigo: "transferencia_recebida" },
});
const IDS_MOTIVO = Object.keys(MOTIVOS_ENTRADA);

// Palavras de embalagem ditas antes do produto ("3 caixas de coca"): a
// quantidade é em EMBALAGENS do cadastro, não na unidade do saldo.
const EMBALAGEM_DITA = /^(caixas?|cx|pacotes?|pct|fardos?|garrafas?|latas?|sacos?|engradados?|bandejas?|potes?|galoes|galao|baldes?|unidades?|pecas?|duzias?)\s+(de\s+|da\s+|do\s+)?/;
const semAcento = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** "Produzi…", "devolveram…", "veio transferido…": motivo deduzido do texto; sem pista, null (pergunta). */
export function motivoDaEntrada(texto) {
  const t = ` ${semAcento(texto)} `;
  if (/ (produzi|produzimos|producao|preparei|preparamos|fizemos|fiz) /.test(t)) return "producao";
  if (/ (devolveu|devolveram|devolucao|devolvido|devolvida) /.test(t)) return "devolucao";
  if (/ (transferencia|transferido|transferida|transferiram|veio da|veio do) /.test(t)) return "transferencia_recebida";
  if (/ (chegou|chegaram|recebi|recebemos|recebimento|entregaram|entregou) /.test(t)) return "recebimento";
  return null;
}

export const paramsSchema = s.object({
  produto: s.opcional(s.string({ min: 1, max: 80 })),
  insumoId: s.opcional(s.uuid()),
  estoqueId: s.opcional(s.uuid()),
  quantidade: s.opcional(s.number({ min: 0.001, max: 100000 })),
  unidade: s.opcional(s.string({ min: 1, max: 12, padrao: /^[A-Za-zçÇ]+$/ })),
  motivoEntrada: s.opcional(s.enum(IDS_MOTIVO)),
});

const pergunta = (campo, texto, opcoes = null, extra = {}) => ({ faltando: { campo, texto, opcoes, livre: !opcoes, ...extra } });

async function preparar(ctx, p) {
  const { dbe } = ctx;
  // 1. Produto ("caixas de coca" → embalagem dita + "coca")
  let termo = p.produto ? semAcento(p.produto) : null;
  let embalagemDita = false;
  if (termo && EMBALAGEM_DITA.test(termo)) { embalagemDita = true; termo = termo.replace(EMBALAGEM_DITA, "").trim() || null; }
  let insumo = null;
  if (p.insumoId) {
    insumo = await ler(dbe.from("insumos").select(CAMPOS_INSUMO).eq("id", p.insumoId).maybeSingle(), "insumos");
    if (!insumo) return { erro: "Produto não encontrado nesta unidade." };
  } else {
    if (!termo) return pergunta("produto", "Qual produto entrou no estoque?");
    const insumos = await ler(dbe.from("insumos").select(CAMPOS_INSUMO).order("nome"), "insumos") || [];
    const c = candidatosDoTermo(insumos, termo);
    if (!c.length) return pergunta("produto", `Não encontrei "${termo}" no cadastro desta unidade. Qual é o produto? (Produto novo se cadastra em Ingredientes antes da entrada.)`);
    if (c.length > 1) return pergunta("insumoId", "Encontrei mais de um produto. Qual deles?", c.map((i) => ({ id: i.id, rotulo: i.nome })));
    insumo = c[0];
  }

  // 2. Local: onde o produto já está; sem certeza, pergunta
  const estoques = ((await ler(dbe.from("estoques").select("id, nome, status"), "estoques")) || []).filter((e) => e.status !== "inativo");
  if (!estoques.length) return { erro: "Esta unidade não tem local de estoque ativo. Cadastre um em Estoque → Produtos e locais." };
  const porId = new Map(estoques.map((e) => [e.id, e]));
  const itens = ((await ler(dbe.from("estoque_itens").select("estoque_id, insumo_id, quantidade_atual").eq("insumo_id", insumo.id), "estoque_itens")) || []).filter((i) => porId.has(i.estoque_id));
  let estoqueId = p.estoqueId || null;
  if (estoqueId && !porId.has(estoqueId)) return { erro: "Esse local de estoque não existe nesta unidade." };
  if (!estoqueId) {
    const ondeEsta = [...new Set(itens.map((i) => i.estoque_id))];
    if (ondeEsta.length === 1) estoqueId = ondeEsta[0];
    else if (estoques.length === 1) estoqueId = estoques[0].id;
    else {
      const lista = ondeEsta.length ? ondeEsta.map((id) => porId.get(id)) : estoques;
      return pergunta("estoqueId", `Em qual local entra ${insumo.nome}?`, lista.map((e) => {
        const it = itens.find((i) => i.estoque_id === e.id);
        return { id: e.id, rotulo: it ? `${e.nome} (tem ${fmtQtd(it.quantidade_atual)})` : e.nome };
      }));
    }
  }
  const local = porId.get(estoqueId).nome;
  const saldo = Number(itens.find((i) => i.estoque_id === estoqueId)?.quantidade_atual) || 0;

  // 3. Quantidade e unidade (embalagem do cadastro ou fração da tela)
  const emb = embalagemDoProduto(insumo);
  const unidades = unidadesDaFracao(insumo);
  const opcoesUn = [...(emb ? [{ id: "embalagem", rotulo: `${emb.nome} (${emb.texto})` }] : []), ...unidades.map((u) => ({ id: u, rotulo: u }))];
  if (p.quantidade == null) return pergunta("quantidade", `Quanto de ${insumo.nome} entrou? (${opcoesUn.map((o) => (o.id === "embalagem" ? emb.nome : o.id)).join(", ")})`);
  let unidade = p.unidade ? (p.unidade.toLowerCase() === "embalagem" ? "embalagem" : unidades.find((u) => u.toLowerCase() === p.unidade.toLowerCase())) : null;
  if (p.unidade && !unidade) return pergunta("unidade", `${insumo.nome} é controlado em ${unidades.join("/")}${emb ? ` ou ${emb.nome}` : ""}. Em qual são os ${fmtQtd(p.quantidade)}?`, opcoesUn);
  if (!unidade && embalagemDita) {
    if (emb) unidade = "embalagem";
    else if (unidades.length === 1) unidade = unidades[0];
  }
  if (!unidade && opcoesUn.length > 1) return pergunta("unidade", `São ${fmtQtd(p.quantidade)} em quê?`, opcoesUn);
  unidade ||= unidades[0];
  const lanc = unidade === "embalagem"
    ? quantidadeDoLancamento({ insumo, embalagens: String(p.quantidade) })
    : quantidadeDoLancamento({ insumo, fracao: String(p.quantidade), unidadeFracao: unidade });
  if (lanc.erro) return pergunta("quantidade", `${lanc.erro} Informe a quantidade de novo.`);

  // 4. Motivo
  if (!p.motivoEntrada) return pergunta("motivoEntrada", "Qual é a origem da entrada? (Compra com nota se lança em Compras, para entrar com custo e conta a pagar.)", IDS_MOTIVO.map((m) => ({ id: m, rotulo: MOTIVOS_ENTRADA[m].rotulo })));
  const motivo = MOTIVOS_ENTRADA[p.motivoEntrada];

  const depois = saldoDepois(saldo, "entrada", lanc.quantidadeSaldo);
  return {
    pronto: {
      preview: {
        titulo: "Dar entrada no estoque",
        entidade: { tipo: "produto", id: insumo.id, nome: insumo.nome },
        linhas: [
          { rotulo: "Produto", valor: insumo.nome },
          { rotulo: "Local", valor: local },
          { rotulo: "Quantidade", valor: lanc.texto },
          { rotulo: "Motivo", valor: motivo.rotulo },
          { rotulo: "Saldo", valor: `${fmtQtd(saldo)} → ${fmtQtd(depois)} ${lanc.unidadeSaldo}` },
        ],
        impacto: null,
        saldoAntes: saldo, saldoDepois: depois, unidadeSaldo: lanc.unidadeSaldo,
      },
      payload: {
        unidade_id: ctx.escopo.unidadeId,
        estoque_id: estoqueId,
        insumo_id: insumo.id,
        tipo: "entrada",
        motivo: motivo.codigo,
        lancamento: { quantidade: lanc.quantidade, quantidadeSaldo: lanc.quantidadeSaldo, quantidade_informada: lanc.quantidade_informada, unidade_informada: lanc.unidade_informada, detalhe: lanc.detalhe },
        observacao: "Via Héfisto Intelligence",
        origem: "movimentacao",
      },
    },
  };
}

async function executar(ctx, payload, { chave }) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) {
    return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  }
  if (payload.tipo !== "entrada" || !MOTIVOS_ENTRADA[payload.motivo]) return { ok: false, erro: "Ação recusada: entrada inválida." };
  const r = await registrarMovimento(ctx.dbUsuario, { ...payload, chave, responsavel_nome: null });
  if (r.error) return { ok: false, erro: r.error };
  const d = r.data || {};
  return {
    ok: true,
    resultado: { movimentoId: d.movimento_id, idempotente: d.idempotente === true, valorTotal: d.valor_total ?? null, unidadeMedida: d.unidade_medida ?? null },
    antes: { saldo: d.saldo_anterior },
    depois: { saldo: d.saldo_posterior },
  };
}

export const registrarEntrada = Object.freeze({
  id: "stock.registerEntry",
  nome: "Dar entrada no estoque",
  descricao: "Entrada de produto no estoque (recebimento, produção, devolução, transferência recebida), pela mesma regra da tela de movimentação.",
  modulo: "estoque",
  capacidade: "registrar_entrada",
  risco: "MEDIUM",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["produto", "insumoId", "estoqueId", "quantidade", "unidade", "motivoEntrada"],
  validacoes: [
    "produto existe no cadastro da unidade da sessão",
    "local de estoque ativo da unidade",
    "quantidade > 0 na embalagem do cadastro ou na unidade (kg↔g, L↔ml)",
    "motivo informado pelo usuário (compra fica em Compras)",
    "permissão de entrada conferida no banco (estoque_movimentar)",
  ],
  rollback: "Estorno pela tela de Estoque → Movimentar (administrador + PIN): o lançamento original fica no histórico.",
  paramsSchema,
  preparar,
  executar,
});
