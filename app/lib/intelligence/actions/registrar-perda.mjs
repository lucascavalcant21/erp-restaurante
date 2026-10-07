// AÇÃO stock.registerLoss — "Perdi 2 kg de picanha."
//
// NÃO existe lógica paralela de estoque aqui. A quantidade passa por
// quantidadeDoLancamento (estoque-movimento.mjs, a mesma da tela de
// movimentação) e a gravação é registrarMovimento → RPC estoque_movimentar
// (EST-MOV-1): retirada com motivo, FEFO nos lotes, sem saldo negativo, custo
// médio no movimento, histórico imutável, permissão conferida NO BANCO com o
// usuário logado e chave de idempotência.
//
// Fluxo: resolver produto (mais de um → pergunta qual) → local com saldo
// (mais de um → pergunta qual) → quantidade e unidade → motivo (ausente →
// pergunta) → impacto estimado pelo custo médio → prévia → confirmação →
// executor. Campo que falta é PERGUNTADO, nunca inventado.

import { s } from "../schemas/schema.mjs";
import { ler } from "../context/db-escopado.mjs";
import { CAMPOS_INSUMO, candidatosDoTermo, custoPorUnidadeDoSaldo, fmtQtd } from "../metrics/produtos.mjs";
import { quantidadeDoLancamento, unidadesDaFracao, saldoDepois, registrarMovimento } from "../../estoque-movimento.mjs";
import { NATUREZA } from "../core/contratos.mjs";
import { MOTIVOS_PERDA } from "../commands/catalogo.mjs";

export const MOTIVOS = Object.freeze({
  limpeza: { rotulo: "Limpeza / aparas", codigo: "perda", obs: "limpeza/aparas" },
  validade: { rotulo: "Validade", codigo: "vencimento", obs: null },
  erro_producao: { rotulo: "Erro de produção", codigo: "perda", obs: "erro de produção" },
  dano: { rotulo: "Dano / queda", codigo: "quebra", obs: null },
  outro: { rotulo: "Outro", codigo: "perda", obs: null },
});

export const paramsSchema = s.object({
  produto: s.opcional(s.string({ min: 1, max: 80 })),
  insumoId: s.opcional(s.uuid()),
  estoqueId: s.opcional(s.uuid()),
  quantidade: s.opcional(s.number({ min: 0.001, max: 100000 })),
  unidade: s.opcional(s.string({ min: 1, max: 12, padrao: /^[A-Za-zçÇ]+$/ })),
  motivo: s.opcional(s.enum(MOTIVOS_PERDA)),
  motivoTexto: s.opcional(s.string({ min: 3, max: 120 })),
});

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pergunta = (campo, texto, opcoes = null, extra = {}) => ({ faltando: { campo, texto, opcoes, livre: !opcoes, ...extra } });

async function preparar(ctx, p) {
  const { dbe } = ctx;
  // 1. Produto
  let insumo = null;
  if (p.insumoId) {
    insumo = await ler(dbe.from("insumos").select(CAMPOS_INSUMO).eq("id", p.insumoId).maybeSingle(), "insumos");
    if (!insumo) return { erro: "Produto não encontrado nesta unidade." };
  } else {
    if (!p.produto) return pergunta("produto", "Qual produto foi perdido?");
    const insumos = await ler(dbe.from("insumos").select(CAMPOS_INSUMO).order("nome"), "insumos") || [];
    const c = candidatosDoTermo(insumos, p.produto);
    if (!c.length) return pergunta("produto", `Não encontrei "${p.produto}" no cadastro desta unidade. Qual é o produto?`);
    if (c.length > 1) return pergunta("insumoId", "Encontrei mais de um produto. Qual deles?", c.map((i) => ({ id: i.id, rotulo: i.nome })));
    insumo = c[0];
  }

  // 2. Local com saldo
  const itens = await ler(dbe.from("estoque_itens").select("estoque_id, insumo_id, quantidade_atual").eq("insumo_id", insumo.id).gt("quantidade_atual", 0), "estoque_itens") || [];
  const estoques = new Map(((await ler(dbe.from("estoques").select("id, nome, status"), "estoques")) || []).filter((e) => e.status !== "inativo").map((e) => [e.id, e]));
  const locais = itens.filter((i) => estoques.has(i.estoque_id));
  if (!locais.length) return { erro: `${insumo.nome} não tem saldo em nenhum estoque desta unidade: não há o que baixar.` };
  let item = p.estoqueId ? locais.find((i) => i.estoque_id === p.estoqueId) : null;
  if (p.estoqueId && !item) return { erro: "Esse local não tem saldo do produto." };
  if (!item && locais.length > 1) {
    return pergunta("estoqueId", `${insumo.nome} está em mais de um local. De qual saiu a perda?`, locais.map((i) => ({ id: i.estoque_id, rotulo: `${estoques.get(i.estoque_id).nome} (${fmtQtd(i.quantidade_atual)})` })));
  }
  item ||= locais[0];
  const local = estoques.get(item.estoque_id).nome;

  // 3. Quantidade e unidade (regra da tela de movimentação)
  const unidades = unidadesDaFracao(insumo);
  if (p.quantidade == null) return pergunta("quantidade", `Quanto de ${insumo.nome} foi perdido? (em ${unidades.join(" ou ")})`);
  let unidade = p.unidade ? unidades.find((u) => u.toLowerCase() === p.unidade.toLowerCase()) : null;
  if (p.unidade && !unidade) return pergunta("unidade", `${insumo.nome} é controlado em ${unidades.join("/")}. Em qual unidade são os ${fmtQtd(p.quantidade)}?`, unidades.map((u) => ({ id: u, rotulo: u })));
  if (!unidade && unidades.length > 1) return pergunta("unidade", `São ${fmtQtd(p.quantidade)} em qual unidade?`, unidades.map((u) => ({ id: u, rotulo: u })));
  unidade ||= unidades[0];
  const lanc = quantidadeDoLancamento({ insumo, fracao: String(p.quantidade), unidadeFracao: unidade });
  if (lanc.erro) return pergunta("quantidade", `${lanc.erro} Informe a quantidade de novo.`);
  const saldo = Number(item.quantidade_atual) || 0;
  if (lanc.quantidadeSaldo > saldo + 0.0005) {
    return { erro: `Saldo insuficiente: há ${fmtQtd(saldo)} ${lanc.unidadeSaldo} de ${insumo.nome} em ${local} e a perda informada é de ${fmtQtd(lanc.quantidadeSaldo)} ${lanc.unidadeSaldo}.` };
  }

  // 4. Motivo
  if (!p.motivo) return pergunta("motivo", "Qual foi o motivo?", MOTIVOS_PERDA.map((m) => ({ id: m, rotulo: MOTIVOS[m].rotulo })));
  if (p.motivo === "outro" && !p.motivoTexto) return pergunta("motivoTexto", "Descreva o motivo em poucas palavras.");
  const motivo = MOTIVOS[p.motivo];

  // 5. Impacto (ESTIMATIVA pelo custo médio vigente; o banco grava o custo real do movimento)
  let impacto = null;
  try {
    const custo = await ler(dbe.from("estoque_custos").select("insumo_id, custo_medio_base").eq("insumo_id", insumo.id).maybeSingle(), "estoque_custos");
    const cu = custo ? custoPorUnidadeDoSaldo(custo.custo_medio_base, insumo) : null;
    if (cu != null) impacto = { valor: Math.round(lanc.quantidadeSaldo * cu * 100) / 100, natureza: NATUREZA.ESTIMATIVA, base: "custo médio vigente" };
  } catch (e) {
    if (!e.ausente) throw e;
  }

  const depois = saldoDepois(saldo, "saida", lanc.quantidadeSaldo);
  const obs = p.motivo === "outro" ? p.motivoTexto : motivo.obs;
  return {
    pronto: {
      preview: {
        titulo: "Registrar perda de estoque",
        entidade: { tipo: "produto", id: insumo.id, nome: insumo.nome },
        linhas: [
          { rotulo: "Produto", valor: insumo.nome },
          { rotulo: "Local", valor: local },
          { rotulo: "Quantidade", valor: lanc.texto },
          { rotulo: "Motivo", valor: p.motivo === "outro" ? `Outro: ${p.motivoTexto}` : motivo.rotulo },
          { rotulo: "Saldo", valor: `${fmtQtd(saldo)} → ${fmtQtd(depois)} ${lanc.unidadeSaldo}` },
          { rotulo: "Impacto estimado", valor: impacto ? `${brl(impacto.valor)} (ESTIMATIVA — custo médio)` : "Sem custo médio cadastrado para estimar" },
        ],
        impacto,
        saldoAntes: saldo, saldoDepois: depois, unidadeSaldo: lanc.unidadeSaldo,
      },
      payload: {
        unidade_id: ctx.escopo.unidadeId,
        estoque_id: item.estoque_id,
        insumo_id: insumo.id,
        tipo: "saida",
        motivo: motivo.codigo,
        lancamento: { quantidade: lanc.quantidade, quantidadeSaldo: lanc.quantidadeSaldo, quantidade_informada: lanc.quantidade_informada, unidade_informada: lanc.unidade_informada, detalhe: lanc.detalhe },
        observacao: `Via Héfisto Intelligence${obs ? ` — ${obs}` : ""}`.slice(0, 200),
        origem: "movimentacao",
      },
    },
  };
}

async function executar(ctx, payload, { chave }) {
  if (!payload || payload.unidade_id !== ctx.escopo.unidadeId) {
    return { ok: false, erro: "Ação recusada: a unidade da ação não é a unidade da sessão." };
  }
  // A MESMA função da tela de movimentação (EST-MOV-1), com o cliente do usuário.
  // Quem lançou o banco grava sozinho (registrado_por = auth.uid(), usuario_nome).
  // "Responsável" é opcional na tela e é QUEM perdeu, não quem lançou: fica vazio.
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

export const registrarPerda = Object.freeze({
  id: "stock.registerLoss",
  nome: "Registrar perda de estoque",
  descricao: "Baixa do estoque com motivo de perda (perda, vencimento ou quebra), pela mesma regra da tela de movimentação.",
  modulo: "estoque",
  capacidade: "registrar_perda",
  risco: "MEDIUM",
  disponivel: true,
  precisaConfirmacao: true,
  campos: ["produto", "insumoId", "estoqueId", "quantidade", "unidade", "motivo", "motivoTexto"],
  validacoes: [
    "produto existe no cadastro da unidade da sessão",
    "local de estoque ativo com saldo do produto",
    "quantidade > 0 na unidade do cadastro (kg↔g, L↔ml)",
    "quantidade ≤ saldo do local (o banco confere de novo)",
    "motivo informado pelo usuário",
    "permissão de retirada conferida no banco (estoque_movimentar)",
  ],
  rollback: "Estorno pela tela de Estoque → Movimentar (administrador + PIN): o lançamento original fica no histórico e o estorno devolve o saldo aos mesmos lotes.",
  paramsSchema,
  preparar,
  executar,
});
