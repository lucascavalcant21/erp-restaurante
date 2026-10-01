// CONTAS A RECEBER, RECEBIMENTOS, CARTÕES, CONTAS FINANCEIRAS — F2.3
// sobre a fundação F2.1 (aplicada em produção em 2026-10-01). Sem migration.
//
//   recebível        → public.fin_contas_receber  (bruto, taxa prevista, líquido previsto gerado)
//   leitura          → public.vw_fin_contas_receber (saldo bruto, situação, atrasado derivado)
//   recebimento      → rpc fin_registrar_recebimento (bruto baixado × líquido creditado)
//   estorno          → rpc fin_estornar_recebimento (com motivo; nada é apagado)
//   cancelamento     → update guardado (status 'previsto' → 'cancelado' + data + motivo)
//   taxas            → public.fin_taxas_meio_pagamento (cadastro do dono; nada inventado)
//   contas fin.      → public.fin_contas_financeiras + vw_fin_saldo_contas_financeiras
//   fluxo            → public.vw_fin_fluxo_caixa (realizado × previsto, por data do dinheiro)
//
// Regra de ouro: RECEITA é o BRUTO (data da venda). O LÍQUIDO é dinheiro que
// entra (data do recebimento). Taxa sem cadastro/informação = "não informada"
// (nulo), nunca um percentual assumido.
//
// Funções com banco recebem o cliente (`db`) por parâmetro (testáveis).

import { hojeLocal, dataValida, lerValor, unidadeValida, novaChave, somarDias, somarMeses } from "./contas-pagar.mjs";

export { hojeLocal, novaChave };

// ─── Formas de recebimento (códigos canônicos do banco) ──────────────────────
export const MEIOS = [
  { codigo: "dinheiro", rotulo: "Dinheiro" },
  { codigo: "pix", rotulo: "PIX" },
  { codigo: "debito", rotulo: "Débito" },
  { codigo: "credito", rotulo: "Crédito" },
  { codigo: "voucher", rotulo: "Voucher" },
  { codigo: "boleto", rotulo: "Boleto" },
  { codigo: "transferencia", rotulo: "Transferência" },
  { codigo: "delivery_marketplace", rotulo: "Delivery (marketplace)" },
  { codigo: "outro", rotulo: "Outros" },
];
export const rotuloMeio = (c) => MEIOS.find((m) => m.codigo === c)?.rotulo || c || "—";
/** Meios que passam por adquirente/plataforma (têm taxa, bandeira, prazo). */
export const MEIOS_COM_TAXA = ["debito", "credito", "voucher", "delivery_marketplace", "pix", "boleto", "outro"];
export const MEIOS_CARTAO = ["debito", "credito", "voucher"];
/** Meios aceitos no cadastro de taxas (check do banco). */
export const MEIOS_TAXA = ["debito", "credito", "pix", "voucher", "delivery_marketplace", "boleto", "outro"];

export const MODALIDADES = [
  { codigo: "a_vista", rotulo: "À vista" },
  { codigo: "parcelado_loja", rotulo: "Parcelado (lojista)" },
  { codigo: "parcelado_emissor", rotulo: "Parcelado (emissor)" },
  { codigo: "pre_pago", rotulo: "Pré-pago" },
  { codigo: "nao_se_aplica", rotulo: "Não se aplica" },
];
export const rotuloModalidade = (c) => MODALIDADES.find((m) => m.codigo === c)?.rotulo || c || "—";

export const TIPOS_CONTA_FIN = [
  { codigo: "caixa", rotulo: "Caixa" },
  { codigo: "banco", rotulo: "Banco" },
  { codigo: "carteira_digital", rotulo: "Carteira digital" },
  { codigo: "adquirente", rotulo: "Adquirente (Stone, Cielo…)" },
  { codigo: "outro", rotulo: "Outro" },
];

export const ROTULO_SITUACAO_RECEBER = {
  previsto: "Pendente", parcial: "Parcial", recebido: "Recebido", atrasado: "Atrasado", cancelado: "Cancelado",
};
export const ORIGENS = { VENDA: "Venda", MANUAL: "Manual", IMPORTACAO: "Importação", MARKETPLACE: "Marketplace", OUTRO: "Outro" };

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const centavos = (n) => Math.round(Number(n) * 100);
function falha(msg) { return { data: null, error: msg }; }
function erroDb(e) { return e ? (e.message || String(e)) : null; }

// ─── Taxas ───────────────────────────────────────────────────────────────────

/**
 * Regra de taxa aplicável: ativa, mesmo meio e modalidade, parcelas no
 * intervalo e vigente na data. Adquirente/bandeira nulos na regra valem para
 * qualquer um; ganha a regra mais específica. Sem regra → null.
 */
export function escolherTaxa(regras, { meio, adquirente = null, bandeira = null, modalidade = "a_vista", parcelas = 1, data }) {
  const norm = (s) => String(s || "").trim().toLowerCase();
  const candidatas = (regras || []).filter((r) =>
    r.ativa !== false && r.meio === meio && r.modalidade === modalidade
    && Number(parcelas) >= Number(r.parcelas_min) && Number(parcelas) <= Number(r.parcelas_max)
    && String(r.vigente_desde).slice(0, 10) <= data && (!r.vigente_ate || String(r.vigente_ate).slice(0, 10) >= data)
    && (!r.adquirente || norm(r.adquirente) === norm(adquirente))
    && (!r.bandeira || norm(r.bandeira) === norm(bandeira)));
  if (!candidatas.length) return null;
  const peso = (r) => (r.adquirente ? 2 : 0) + (r.bandeira ? 1 : 0);
  return candidatas.sort((a, b) => peso(b) - peso(a) || String(b.vigente_desde).localeCompare(String(a.vigente_desde)))[0];
}

/** Valor da taxa = bruto × % + fixa. Regra nula → null (taxa não informada). */
export function calcularTaxa(regra, valorBruto) {
  if (!regra) return null;
  return r2(Number(valorBruto) * Number(regra.taxa_percentual) / 100 + Number(regra.taxa_fixa || 0));
}

// ─── Montagem dos recebíveis ─────────────────────────────────────────────────

/**
 * Divide uma venda em recebíveis. `recebiveis` = 1 (consolidado) ou N
 * (um por parcela). Bruto e taxa são divididos em centavos exatos (resto na
 * última). A previsão da parcela i = previsão da 1ª + (i-1) meses.
 */
export function montarRecebiveis({ valorBruto, valorTaxa, recebiveis = 1, primeiraPrevisao }) {
  const n = Math.trunc(Number(recebiveis) || 1);
  if (n < 1 || n > 120) throw new Error("Número de recebíveis inválido (1 a 120).");
  const divide = (total) => {
    const t = centavos(total), base = Math.floor(t / n);
    return Array.from({ length: n }, (_, i) => (i === n - 1 ? t - base * (n - 1) : base) / 100);
  };
  const brutos = divide(valorBruto);
  const taxas = valorTaxa == null ? Array(n).fill(null) : divide(valorTaxa);
  return brutos.map((b, i) => ({
    parcela_numero: i + 1, parcelas_total: n, valor_bruto: b, valor_taxa_previsto: taxas[i],
    data_prevista: somarMeses(primeiraPrevisao, i),
  }));
}

/** Validação do formulário de receita/recebível. */
export function validarRecebivel(d) {
  const erros = [];
  const descricao = String(d?.descricao ?? "").trim();
  const valor = r2(lerValor(d?.valor_bruto));
  const data_venda = String(d?.data_venda ?? "").slice(0, 10);
  const data_prevista = String(d?.data_prevista ?? "").slice(0, 10);
  const meio = String(d?.meio ?? "");
  const modalidade = String(d?.modalidade || "a_vista");
  const recebiveis = Math.trunc(Number(d?.recebiveis) || 1);
  const parcelasVenda = Math.trunc(Number(d?.parcelas_venda) || 1);
  // taxa: "regra" (calculada pelo cadastro), "informada" (digitada) ou "nao_informada"
  const modoTaxa = d?.modo_taxa || "nao_informada";
  const taxaInformada = d?.valor_taxa === "" || d?.valor_taxa == null ? null : r2(lerValor(d.valor_taxa));

  if (!descricao) erros.push("Informe a descrição.");
  if (!Number.isFinite(valor) || valor <= 0) erros.push("O valor bruto precisa ser maior que zero.");
  if (!dataValida(data_venda)) erros.push("Informe a data da venda/origem (competência da receita).");
  if (!dataValida(data_prevista)) erros.push("Informe a data prevista de recebimento.");
  else if (dataValida(data_venda) && data_prevista < data_venda) erros.push("A previsão não pode ser antes da data da venda.");
  if (!MEIOS.some((m) => m.codigo === meio)) erros.push("Escolha a forma de recebimento.");
  if (!MODALIDADES.some((m) => m.codigo === modalidade)) erros.push("Modalidade inválida.");
  if (recebiveis < 1 || recebiveis > 120) erros.push("Número de recebíveis inválido.");
  if (parcelasVenda < 1 || parcelasVenda > 120) erros.push("Número de parcelas da venda inválido.");
  if (modoTaxa === "informada" && (taxaInformada == null || !Number.isFinite(taxaInformada) || taxaInformada < 0 || taxaInformada > valor)) {
    erros.push("Taxa informada inválida (entre 0 e o valor bruto).");
  }
  return { ok: erros.length === 0, erros, campos: { descricao, valor, data_venda, data_prevista, meio, modalidade, recebiveis, parcelasVenda, modoTaxa, taxaInformada } };
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

/**
 * Cria a receita/recebível MANUAL (1 consolidado ou N recebíveis da mesma
 * venda, ligados pelo mesmo origem_id). `chave` = idempotência gerada quando o
 * formulário abre; repetir devolve o que já foi criado. `regras` = cadastro
 * de taxas (para modo_taxa "regra").
 */
export async function criarContaReceber(db, d, { chave, regras = [] } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(d?.unidade_id)) return falha("Selecione uma unidade antes de lançar.");
  if (!chave) return falha("Chave de idempotência ausente.");
  const v = validarRecebivel(d);
  if (!v.ok) return falha(v.erros.join(" "));
  const c = v.campos;

  let regra = null, valorTaxa = null;
  if (c.modoTaxa === "regra") {
    regra = escolherTaxa(regras, { meio: c.meio, adquirente: d.adquirente, bandeira: d.bandeira, modalidade: c.modalidade, parcelas: c.parcelasVenda, data: c.data_venda });
    if (!regra) return falha("Nenhuma taxa cadastrada para este meio/adquirente/bandeira/parcelas. Cadastre a taxa ou informe o valor.");
    valorTaxa = calcularTaxa(regra, c.valor);
  } else if (c.modoTaxa === "informada") {
    valorTaxa = c.taxaInformada;
  }

  let linhas;
  try { linhas = montarRecebiveis({ valorBruto: c.valor, valorTaxa, recebiveis: c.recebiveis, primeiraPrevisao: c.data_prevista }); }
  catch (e) { return falha(e.message); }

  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const grupo = UUID.test(chave) ? chave : novaChave();
  const obsVenda = c.parcelasVenda > 1 && c.recebiveis === 1 ? `Venda em ${c.parcelasVenda}x, recebível consolidado.` : null;
  const observacao = [String(d.observacao ?? "").trim(), obsVenda].filter(Boolean).join(" ") || null;
  const registros = linhas.map((l) => ({
    unidade_id: String(d.unidade_id).trim(),
    origem_tipo: "MANUAL",
    origem_id: grupo,
    descricao: c.recebiveis > 1 ? `${c.descricao} (${l.parcela_numero}/${l.parcelas_total})` : c.descricao,
    meio: c.meio,
    adquirente: String(d.adquirente ?? "").trim() || null,
    bandeira: String(d.bandeira ?? "").trim() || null,
    modalidade: c.modalidade,
    nsu: String(d.nsu ?? "").trim() || null,
    autorizacao: String(d.autorizacao ?? "").trim() || null,
    parcela_numero: l.parcela_numero,
    parcelas_total: l.parcelas_total,
    data_venda: c.data_venda,
    data_prevista: l.data_prevista,
    valor_bruto: l.valor_bruto,
    taxa_percentual_prevista: regra ? Number(regra.taxa_percentual) : null,
    taxa_fixa_prevista: regra ? Number(regra.taxa_fixa || 0) : null,
    valor_taxa_previsto: l.valor_taxa_previsto,
    taxa_regra_id: regra?.id || null,
    conta_financeira_prevista_id: d.conta_financeira_prevista_id || null,
    observacao,
    chave_idempotencia: c.recebiveis > 1 ? `${chave}:${l.parcela_numero}` : chave,
  }));
  const { data, error } = await db.from("fin_contas_receber").insert(registros).select("id");
  if (error) {
    if (error.code === "23505") {
      const { data: ex, error: e2 } = await db.from("fin_contas_receber").select("id")
        .eq("unidade_id", registros[0].unidade_id).in("chave_idempotencia", registros.map((r) => r.chave_idempotencia));
      if (!e2 && (ex || []).length === registros.length) return { data: ex.map((r) => r.id), error: null, idempotente: true };
    }
    return falha(erroDb(error));
  }
  if ((data || []).length !== registros.length) return falha("O banco não confirmou a criação.");
  return { data: data.map((r) => r.id), error: null, idempotente: false };
}

/**
 * Edita só o que mudou. Bruto e taxa só podem mudar se nada foi recebido.
 * Nunca mexe em status (recebimento/estorno/cancelamento têm ações próprias).
 */
export async function editarContaReceber(db, { id, unidade_id, contaAtual, ...d }) {
  if (!db) return falha("Banco indisponível.");
  if (!id || !contaAtual) return falha("Conta não informada.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  if (contaAtual.situacao === "cancelado") return falha("Conta cancelada não pode ser editada.");
  const igual = (a, b) => (a ?? null) === (b ?? null);
  const txt = (x) => String(x ?? "").trim() || null;
  const patch = {};
  const descricao = txt(d.descricao);
  if (!descricao) return falha("Informe a descrição.");
  if (!igual(descricao, contaAtual.descricao)) patch.descricao = descricao;
  for (const campo of ["adquirente", "bandeira", "nsu", "autorizacao", "observacao"]) {
    if (campo in d && !igual(txt(d[campo]), contaAtual[campo] ?? null)) patch[campo] = txt(d[campo]);
  }
  if ("conta_financeira_prevista_id" in d && !igual(d.conta_financeira_prevista_id || null, contaAtual.conta_financeira_prevista_id || null)) {
    patch.conta_financeira_prevista_id = d.conta_financeira_prevista_id || null;
  }
  for (const campo of ["data_venda", "data_prevista"]) {
    if (campo in d) {
      const v = String(d[campo] ?? "").slice(0, 10);
      if (!dataValida(v)) return falha("Data inválida.");
      if (v !== String(contaAtual[campo] ?? "").slice(0, 10)) patch[campo] = v;
    }
  }
  const dv = patch.data_venda || String(contaAtual.data_venda).slice(0, 10);
  const dp = patch.data_prevista || String(contaAtual.data_prevista).slice(0, 10);
  if (dp < dv) return falha("A previsão não pode ser antes da data da venda.");
  const teveRecebimento = Number(contaAtual.bruto_baixado || 0) > 0;
  if ("valor_bruto" in d) {
    const vb = r2(lerValor(d.valor_bruto));
    if (Math.abs(vb - Number(contaAtual.valor_bruto)) > 0.004) {
      if (teveRecebimento) return falha("O valor bruto não pode mudar depois de haver recebimento. Estorne antes, se for o caso.");
      if (!(vb > 0)) return falha("O valor bruto precisa ser maior que zero.");
      patch.valor_bruto = vb;
    }
  }
  if ("valor_taxa_previsto" in d) {
    const vt = d.valor_taxa_previsto === "" || d.valor_taxa_previsto == null ? null : r2(lerValor(d.valor_taxa_previsto));
    if (!igual(vt, contaAtual.valor_taxa_previsto == null ? null : Number(contaAtual.valor_taxa_previsto))) {
      if (teveRecebimento) return falha("A taxa prevista não pode mudar depois de haver recebimento.");
      if (vt != null && (!Number.isFinite(vt) || vt < 0 || vt > (patch.valor_bruto ?? Number(contaAtual.valor_bruto)))) return falha("Taxa inválida.");
      patch.valor_taxa_previsto = vt;
      patch.taxa_regra_id = null; patch.taxa_percentual_prevista = null; patch.taxa_fixa_prevista = null;
    }
  }
  if (!Object.keys(patch).length) return { data: { id, alterados: [] }, error: null };
  const { data, error } = await db.from("fin_contas_receber").update(patch).eq("id", id).eq("unidade_id", unidade_id).select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("Conta não encontrada nesta unidade (nada foi alterado).");
  return { data: { id, alterados: Object.keys(patch) }, error: null };
}

/** Recebimento pela RPC: bruto baixado (receita quitada) × líquido creditado (dinheiro). */
export async function registrarRecebimento(db, p, { hoje = hojeLocal() } = {}) {
  if (!db) return falha("Banco indisponível.");
  const dia = String(p?.recebido_em ?? "").slice(0, 10);
  const bruto = p?.valor_bruto_baixado === "" || p?.valor_bruto_baixado == null ? null : r2(lerValor(p.valor_bruto_baixado));
  const liquido = r2(lerValor(p?.valor_liquido_recebido));
  if (!p?.conta_receber_id) return falha("Conta não informada.");
  if (!p?.chave) return falha("Chave de idempotência ausente.");
  if (!dataValida(dia)) return falha("Informe a data real do recebimento.");
  if (dia > hoje) return falha("A data do recebimento não pode ser futura.");
  if (bruto != null && (!Number.isFinite(bruto) || bruto <= 0)) return falha("O valor bruto baixado precisa ser maior que zero.");
  if (p.saldo_bruto != null && bruto != null && bruto > Number(p.saldo_bruto) + 0.004) return falha(`Valor maior que o saldo (saldo bruto: ${Number(p.saldo_bruto).toFixed(2)}).`);
  if (!Number.isFinite(liquido) || liquido < 0) return falha("Informe o valor líquido que entrou.");
  const baseBruto = bruto ?? (p.saldo_bruto != null ? Number(p.saldo_bruto) : null);
  if (baseBruto != null && liquido > baseBruto + 0.004) return falha("O líquido não pode ser maior que o bruto baixado (acréscimos ainda não são suportados).");
  const { data, error } = await db.rpc("fin_registrar_recebimento", {
    p_conta_receber_id: p.conta_receber_id,
    p_recebido_em: dia,
    p_valor_liquido_recebido: liquido,
    p_valor_bruto_baixado: bruto,
    p_conta_financeira_id: p.conta_financeira_id || null,
    p_conciliacao_referencia: String(p.conciliacao_referencia ?? "").trim() || null,
    p_observacao: String(p.observacao ?? "").trim() || null,
    p_chave_idempotencia: p.chave,
  });
  if (error) return falha(erroDb(error));
  if (!data?.recebimento_id) return falha("O banco não confirmou o recebimento.");
  return { data, error: null };
}

export async function estornarRecebimento(db, { recebimento_id, motivo }) {
  if (!db) return falha("Banco indisponível.");
  if (!recebimento_id) return falha("Recebimento não informado.");
  if (!String(motivo ?? "").trim()) return falha("Informe o motivo do estorno.");
  const { data, error } = await db.rpc("fin_estornar_recebimento", { p_recebimento_id: recebimento_id, p_motivo: String(motivo).trim() });
  if (error) return falha(erroDb(error));
  if (!data?.status) return falha("O banco não confirmou o estorno.");
  return { data, error: null };
}

/**
 * Cancela recebível sem nenhum recebimento ativo. Não há RPC de cancelamento
 * na F2.1: o update só vale se o status persistido ainda for 'previsto' (as
 * RPCs mantêm 'parcial'/'recebido' enquanto houver recebimento ativo).
 * O CHECK do banco exige data e motivo. Nada é apagado.
 */
export async function cancelarContaReceber(db, { id, unidade_id, motivo }) {
  if (!db) return falha("Banco indisponível.");
  if (!id) return falha("Conta não informada.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  if (!String(motivo ?? "").trim()) return falha("Informe o motivo do cancelamento.");
  const { data, error } = await db.from("fin_contas_receber")
    .update({ status: "cancelado", cancelado_em: new Date().toISOString(), motivo_cancelamento: String(motivo).trim() })
    .eq("id", id).eq("unidade_id", unidade_id).eq("status", "previsto").select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("Só é possível cancelar conta sem recebimento (estorne antes) e ainda não cancelada.");
  return { data: { id, status: "cancelado" }, error: null };
}

// ─── Contas financeiras e taxas ──────────────────────────────────────────────

/** Conta financeira: saldo inicial é OBRIGATÓRIO e informado pelo usuário (nunca presumido). */
export async function criarContaFinanceira(db, d) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(d?.unidade_id)) return falha("Selecione uma unidade.");
  const nome = String(d?.nome ?? "").trim();
  if (!nome) return falha("Informe o nome da conta.");
  if (!TIPOS_CONTA_FIN.some((t) => t.codigo === d?.tipo)) return falha("Escolha o tipo da conta.");
  if (d?.saldo_inicial === "" || d?.saldo_inicial == null) return falha("Informe o saldo inicial real (pode ser 0,00 se a conta começa zerada).");
  const saldo = r2(lerValor(d.saldo_inicial));
  if (!Number.isFinite(saldo)) return falha("Saldo inicial inválido.");
  const em = String(d?.saldo_inicial_em ?? "").slice(0, 10);
  if (!dataValida(em)) return falha("Informe a data do saldo inicial.");
  const { data, error } = await db.from("fin_contas_financeiras")
    .insert([{ unidade_id: String(d.unidade_id).trim(), nome, tipo: d.tipo, saldo_inicial: saldo, saldo_inicial_em: em }]).select("id");
  if (error) return falha(error.code === "23505" ? "Já existe uma conta com esse nome nesta unidade." : erroDb(error));
  if (!data?.length) return falha("O banco não confirmou a criação.");
  return { data: { id: data[0].id }, error: null };
}

/** Só nome e ativa: saldo inicial e data não mudam (mudariam o saldo histórico). */
export async function editarContaFinanceira(db, { id, unidade_id, nome, ativa }) {
  if (!db) return falha("Banco indisponível.");
  if (!id || !unidadeValida(unidade_id)) return falha("Conta não informada.");
  const patch = {};
  if (nome != null) { const n = String(nome).trim(); if (!n) return falha("Informe o nome."); patch.nome = n; }
  if (ativa != null) patch.ativa = !!ativa;
  const { data, error } = await db.from("fin_contas_financeiras").update(patch).eq("id", id).eq("unidade_id", unidade_id).select("id");
  if (error) return falha(error.code === "23505" ? "Já existe uma conta com esse nome nesta unidade." : erroDb(error));
  if (!data?.length) return falha("Conta não encontrada nesta unidade.");
  return { data: { id }, error: null };
}

export async function criarTaxa(db, d) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(d?.unidade_id)) return falha("Selecione uma unidade.");
  if (!MEIOS_TAXA.includes(d?.meio)) return falha("Escolha o meio.");
  if (!MODALIDADES.some((m) => m.codigo === d?.modalidade)) return falha("Escolha a modalidade.");
  const pct = r2(lerValor(d?.taxa_percentual));
  const fixa = d?.taxa_fixa === "" || d?.taxa_fixa == null ? 0 : r2(lerValor(d.taxa_fixa));
  const dias = Math.trunc(Number(d?.dias_para_recebimento));
  const pmin = Math.trunc(Number(d?.parcelas_min) || 1), pmax = Math.trunc(Number(d?.parcelas_max) || pmin);
  if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return falha("Informe a taxa percentual (0 a 99,99).");
  if (!Number.isFinite(fixa) || fixa < 0) return falha("Taxa fixa inválida.");
  if (!Number.isInteger(dias) || dias < 0) return falha("Informe em quantos dias o dinheiro cai.");
  if (pmin < 1 || pmax < pmin) return falha("Faixa de parcelas inválida.");
  const desde = String(d?.vigente_desde ?? "").slice(0, 10);
  if (!dataValida(desde)) return falha("Informe desde quando a taxa vale.");
  const { data, error } = await db.from("fin_taxas_meio_pagamento").insert([{
    unidade_id: String(d.unidade_id).trim(), meio: d.meio, adquirente: String(d.adquirente ?? "").trim() || null,
    bandeira: String(d.bandeira ?? "").trim() || null, modalidade: d.modalidade, parcelas_min: pmin, parcelas_max: pmax,
    taxa_percentual: pct, taxa_fixa: fixa, dias_para_recebimento: dias, vigente_desde: desde,
  }]).select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("O banco não confirmou o cadastro.");
  return { data: { id: data[0].id }, error: null };
}

/** Desativar = encerrar vigência hoje (o histórico de recebíveis guarda a taxa usada). */
export async function encerrarTaxa(db, { id, unidade_id, hoje = hojeLocal() }) {
  if (!db) return falha("Banco indisponível.");
  const { data, error } = await db.from("fin_taxas_meio_pagamento").update({ ativa: false, vigente_ate: hoje })
    .eq("id", id).eq("unidade_id", unidade_id).select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("Taxa não encontrada nesta unidade.");
  return { data: { id }, error: null };
}

// ─── Resumos (caixa ≠ competência; receita ≠ dinheiro) ───────────────────────

export function podeReceber(c) { return ["previsto", "parcial", "atrasado"].includes(c?.situacao) && Number(c?.saldo_bruto) > 0; }
export function podeCancelarReceber(c) { return ["previsto", "atrasado"].includes(c?.situacao) && Number(c?.bruto_baixado || 0) === 0 && c?.status_persistido === "previsto"; }

/**
 * Resumo do topo de Contas a Receber.
 * - aReceberBruto / aReceberLiquido: saldo em aberto (líquido nulo se alguma taxa não foi informada);
 * - atrasado: bruto em aberto com previsão vencida;
 * - recebido no período (caixa): líquido que entrou, bruto baixado e taxas efetivas, por data do recebimento;
 * - receita (competência): bruto das contas com data da venda no período, exceto canceladas.
 */
export function resumoReceber(contas, recebimentosPeriodo, periodo) {
  const abertas = contas.filter((c) => ["previsto", "parcial", "atrasado"].includes(c.situacao));
  const soma = (xs, f) => r2(xs.reduce((s, x) => s + (Number(f(x)) || 0), 0));
  const liquidoAberto = abertas.some((c) => c.valor_liquido_previsto == null)
    ? null
    : soma(abertas, (c) => Number(c.saldo_bruto) * Number(c.valor_liquido_previsto) / Number(c.valor_bruto));
  const ativos = recebimentosPeriodo.filter((r) => !r.estornado_em);
  return {
    aReceberBruto: soma(abertas, (c) => c.saldo_bruto),
    aReceberLiquido: liquidoAberto,
    atrasado: soma(abertas.filter((c) => c.situacao === "atrasado"), (c) => c.saldo_bruto),
    recebidoLiquido: periodo ? soma(ativos, (r) => r.valor_liquido_recebido) : null,
    recebidoBruto: periodo ? soma(ativos, (r) => r.valor_bruto_baixado) : null,
    taxasEfetivas: periodo ? soma(ativos, (r) => r.valor_taxa_efetiva) : null,
    receitaCompetencia: periodo
      ? soma(contas.filter((c) => c.situacao !== "cancelado" && c.data_venda >= periodo.de && c.data_venda <= periodo.ate), (c) => c.valor_bruto)
      : null,
  };
}

/**
 * Recebível em aberto com taxa não informada vem do fluxo com valor nulo (o
 * líquido não é conhecido). Anexa o saldo BRUTO dele (`bruto_sem_taxa`), para a
 * tela mostrar quanto está em aberto sem inventar o líquido.
 */
export function anexarBrutoSemTaxa(linhas, recebiveis) {
  const bruto = new Map((recebiveis || []).map((r) => [r.id, Number(r.saldo_bruto)]));
  return linhas.map((l) => (l.natureza === "previsto" && l.origem === "conta_receber" && l.valor == null && bruto.has(l.referencia_id)
    ? { ...l, bruto_sem_taxa: bruto.get(l.referencia_id) } : l));
}

/**
 * Fluxo: totais de realizado e previsto separados (nunca somados como dinheiro disponível).
 * Previsto a receber: `entradas` soma só o líquido conhecido; os recebíveis com
 * taxa não informada ficam fora dela e aparecem à parte pelo bruto
 * (`brutoSemTaxa`, null se o bruto de algum não pôde ser lido).
 */
export function resumoFluxo(linhas) {
  const s = (natureza, direcao) => r2(linhas.filter((l) => l.natureza === natureza && l.direcao === direcao && l.valor != null)
    .reduce((t, l) => t + Number(l.valor), 0));
  const previstoEntrada = linhas.filter((l) => l.natureza === "previsto" && l.direcao === "entrada");
  const semTaxa = previstoEntrada.filter((l) => l.valor == null);
  return {
    realizado: { entradas: s("realizado", "entrada"), saidas: s("realizado", "saida"), saldo: r2(s("realizado", "entrada") - s("realizado", "saida")) },
    previsto: {
      entradas: s("previsto", "entrada"), saidas: s("previsto", "saida"),
      entradasIncompletas: semTaxa.length > 0,
      entradasConhecidas: previstoEntrada.some((l) => l.valor != null),
      brutoSemTaxa: semTaxa.every((l) => l.bruto_sem_taxa != null) ? r2(semTaxa.reduce((t, l) => t + Number(l.bruto_sem_taxa), 0)) : null,
    },
    incluiLegado: linhas.some((l) => l.origem === "pagamento_legado"),
  };
}

export { somarDias };
