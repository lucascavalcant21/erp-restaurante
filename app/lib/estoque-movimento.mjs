// ENTRADA E RETIRADA DE ESTOQUE, ESTORNO E AJUSTE DE INVENTÁRIO (EST-MOV-1).
//
// Tudo que muda saldo passa por funções do banco (db/EST_MOV_1_...sql), que
// conferem usuário e permissão lá dentro — a tela só pede:
//   estoque_movimentar          entrada/retirada com motivo, FEFO do banco, sem
//                               saldo negativo e sem lançamento duplicado (chave);
//   estoque_estornar            administrador autorizado + PIN; o original fica;
//   estoque_ajustar_inventario  administrador + PIN; aplica a diferença de um
//                               inventário fechado (produto não contado não vira 0);
//   estoque_seguranca_status / estoque_seguranca_salvar  PIN e contagem cega.
// O histórico é imutável no banco: nada aqui apaga, edita ou zera lançamento.
//
// Quantidade: o funcionário informa EMBALAGENS (as do cadastro) e/ou FRAÇÃO
// (kg/g, L/ml ou a própria unidade do cadastro). Ex.: 2 pacotes de 2 kg + 350 g
// = 4,35 kg; aceita soma ("6+4"). O banco grava a quantidade na unidade do
// SALDO (a do cadastro; garrafa fracionada: o conteúdo, regra de
// inventario-saldo.mjs) e o que foi digitado, para a auditoria.
//
// Funções com banco recebem o cliente (`db`) por parâmetro (testáveis).

import { novaChave } from "./contas-pagar.mjs";
import { ehGranel } from "./volume-embalagem.mjs";
import { ehFracionavel, ehUnidadeContavel, lerSoma } from "./inventario-saldo.mjs";

export { novaChave };

const r3 = (n) => Math.round(Number(n) * 1000) / 1000;
const fmt = (n) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
const mostrarUn = (u) => (String(u || "").trim().toLowerCase() === "l" ? "L" : (String(u || "").trim() || "un"));
function falha(msg, extra = {}) { return { data: null, error: msg, ...extra }; }

// ─── Motivos ─────────────────────────────────────────────────────────────────
export const MOTIVOS = {
  entrada: [
    // Compra entra no estoque ao CONFIRMAR em Compras (EST-MOV-4), com custo e
    // conta a pagar juntos. A tela de entrada não oferece "Compra" para a mesma
    // nota não entrar duas vezes; o banco ainda aceita (telas antigas).
    { codigo: "compra", rotulo: "Compra", pelaCompra: true },
    { codigo: "recebimento", rotulo: "Recebimento" },
    { codigo: "producao", rotulo: "Produção" },
    { codigo: "devolucao", rotulo: "Devolução" },
    { codigo: "transferencia_recebida", rotulo: "Transferência recebida" },
    { codigo: "ajuste_autorizado", rotulo: "Ajuste autorizado", admin: true },
  ],
  saida: [
    { codigo: "consumo", rotulo: "Consumo" },
    { codigo: "perda", rotulo: "Perda" },
    { codigo: "vencimento", rotulo: "Vencimento" },
    { codigo: "quebra", rotulo: "Quebra" },
    { codigo: "transferencia_enviada", rotulo: "Transferência" },
    { codigo: "producao", rotulo: "Produção" },
    { codigo: "ajuste_autorizado", rotulo: "Ajuste autorizado", admin: true },
  ],
};
const OUTROS_MOTIVOS = { estorno: "Estorno", ajuste_inventario: "Ajuste de inventário" };
export function rotuloMotivo(codigo) {
  return MOTIVOS.entrada.concat(MOTIVOS.saida).find((m) => m.codigo === codigo)?.rotulo || OUTROS_MOTIVOS[codigo] || null;
}

export const STATUS_AJUSTE = {
  ajustado: "Ajustado",
  sem_diferenca: "Sem diferença",
  ja_ajustado: "Já ajustado antes",
  sem_local: "Sem local: não ajustado",
  saldo_insuficiente: "Saldo atual menor que a diferença: não ajustado",
  unidade_mudou: "A unidade do cadastro mudou depois da contagem: não ajustado",
  existe_contagem_mais_recente: "Há uma contagem mais recente deste produto: ajuste por ela",
};

// ─── Quantidade: embalagens + fração ─────────────────────────────────────────
// Regra de embalagem fracionável é a de inventario-saldo.mjs (uma só no app):
// garrafa marcada como fracionada e cadastrada em "garrafa" guarda o SALDO em
// conteúdo (ml); o resto guarda na unidade do cadastro.
const MASSA = { kg: 1000, g: 1 };
const VOLUME = { l: 1000, ml: 1 };
const familia = (u) => {
  const x = String(u || "").trim().toLowerCase();
  if (x in MASSA) return { tabela: MASSA, unidades: ["kg", "g"] };
  if (x in VOLUME) return { tabela: VOLUME, unidades: ["L", "ml"] };
  return null;
};
const saldoEmConteudo = (insumo) => ehFracionavel(insumo) && ehUnidadeContavel(insumo?.unidade_medida);
const unidadeDoConteudoSaldo = (insumo) => String(insumo?.unidade_conteudo || "").trim() || "ml";

/** Em que unidade o estoque guarda o saldo do produto (a do cadastro; garrafa fracionada: o conteúdo). */
export function unidadeDoSaldo(insumo) {
  return mostrarUn(saldoEmConteudo(insumo) ? unidadeDoConteudoSaldo(insumo) : insumo?.unidade_medida);
}

/**
 * Unidades em que a fração pode ser digitada: kg↔g, L↔ml; o resto, só a do
 * cadastro. Aceita o produto (garrafa fracionada: a do conteúdo) ou a unidade.
 */
export function unidadesDaFracao(insumoOuUnidade) {
  const u = insumoOuUnidade && typeof insumoOuUnidade === "object"
    ? (saldoEmConteudo(insumoOuUnidade) ? unidadeDoConteudoSaldo(insumoOuUnidade) : insumoOuUnidade.unidade_medida)
    : insumoOuUnidade;
  const f = familia(u);
  return f ? f.unidades : [mostrarUn(u)];
}

/** Converte entre kg↔g e L↔ml; mesma unidade passa direto; outra combinação = null. */
export function paraUnidadeDoCadastro(qtd, unidadeDe, unidadeCadastro) {
  const de = String(unidadeDe || "").trim().toLowerCase();
  const para = String(unidadeCadastro || "").trim().toLowerCase();
  if (!de || de === para) return Number(qtd);
  const f = familia(para);
  if (!f || !(de in f.tabela)) return null;
  return (Number(qtd) * f.tabela[de]) / f.tabela[para];
}

/** A embalagem do cadastro ("pacote de 2 kg", "garrafa de 750 ml") ou null se é a granel. */
export function embalagemDoProduto(insumo) {
  const tamanho = Number(insumo?.tamanho_embalagem);
  if (!Number.isFinite(tamanho) || tamanho <= 0) return null;
  if (ehGranel(insumo)) return null;
  if (saldoEmConteudo(insumo)) {
    const nome = String(insumo?.unidade_comercial || insumo?.unidade_medida || "").trim() || "embalagem";
    return { tamanho, nome, emConteudo: true, texto: `${nome} de ${fmt(tamanho)} ${unidadeDoSaldo(insumo)}` };
  }
  const nome = String(insumo?.unidade_comercial || "").trim() || "embalagem";
  return { tamanho, nome, texto: `${nome} de ${fmt(tamanho)} ${mostrarUn(insumo?.unidade_medida)}` };
}

/**
 * Quantidade de um lançamento a partir do que foi digitado (aceita soma "6+4").
 * → { quantidade (unidade do cadastro), quantidadeSaldo (unidade do saldo, a que
 *     vai para o banco), unidade, unidadeSaldo, texto, detalhe,
 *     quantidade_informada, unidade_informada } | { erro }
 */
export function quantidadeDoLancamento({ insumo, embalagens = "", fracao = "", unidadeFracao = null } = {}) {
  const unidade = insumo?.unidade_medida || "un";
  const emConteudo = saldoEmConteudo(insumo);
  const unidadeSaldo = unidadeDoSaldo(insumo);
  const temEmb = String(embalagens ?? "").trim() !== "";
  const temFrac = String(fracao ?? "").trim() !== "";
  if (!temEmb && !temFrac) return { erro: "Informe a quantidade." };

  const emb = temEmb ? lerSoma(embalagens) : 0;
  const frac = temFrac ? lerSoma(fracao) : 0;
  if (!Number.isFinite(emb) || !Number.isFinite(frac)) return { erro: "Quantidade inválida." };
  if (emb < 0 || frac < 0) return { erro: "A quantidade não pode ser negativa." };
  if (!Number.isInteger(emb)) return { erro: "Embalagens: use número inteiro (o resto vai na fração)." };

  const embalagem = embalagemDoProduto(insumo);
  if (emb > 0 && !embalagem) return { erro: "Este produto não tem embalagem no cadastro: informe só a quantidade." };

  // a fração é digitada no conteúdo (garrafa fracionada) ou na unidade do cadastro
  const uBase = emConteudo ? unidadeDoConteudoSaldo(insumo) : unidade;
  const uFrac = unidadeFracao || mostrarUn(uBase);
  const fracBase = frac > 0 ? paraUnidadeDoCadastro(frac, uFrac, uBase) : 0;
  if (fracBase == null) return { erro: `A fração em ${mostrarUn(uFrac)} não combina com a unidade do produto (${mostrarUn(uBase)}).` };

  const tamanho = embalagem?.tamanho || 0;
  const brutoSaldo = emConteudo ? emb * tamanho + fracBase : emb * tamanho + fracBase;
  const quantidadeSaldo = r3(brutoSaldo);
  if (Math.abs(brutoSaldo - quantidadeSaldo) > 1e-9) return { erro: `Precisão máxima: 0,001 ${unidadeSaldo}. Confira a fração.` };
  if (quantidadeSaldo <= 0) return { erro: "A quantidade deve ser maior que zero." };
  if (quantidadeSaldo >= 1e9) return { erro: "Quantidade grande demais: confira o número." };
  const quantidade = emConteudo ? r3(quantidadeSaldo / tamanho) : quantidadeSaldo;

  const partes = [];
  if (emb > 0) partes.push(emConteudo ? `${fmt(emb)} ${embalagem.nome}${emb === 1 ? "" : "(s)"} fechada${emb === 1 ? "" : "s"}` : `${fmt(emb)} ${embalagem.nome}${emb === 1 ? "" : "(s)"} de ${fmt(tamanho)} ${mostrarUn(unidade)}`);
  if (frac > 0) partes.push(`${fmt(frac)} ${mostrarUn(uFrac)}`);
  const total = `${fmt(quantidadeSaldo)} ${unidadeSaldo}`;
  const texto = partes.length === 1 && frac > 0 && String(uFrac).toLowerCase() === String(unidadeSaldo).toLowerCase()
    ? total : `${partes.join(" + ")} = ${total}`;

  const so = emb > 0 && frac === 0 ? "emb" : (frac > 0 && emb === 0 ? "frac" : "misto");
  return {
    quantidade,
    quantidadeSaldo,
    unidade,
    unidadeSaldo,
    texto,
    detalhe: {
      embalagens: emb, tamanho_embalagem: embalagem?.tamanho ?? null, unidade_embalagem: embalagem?.nome ?? null,
      fracao: frac, unidade_fracao: frac > 0 ? mostrarUn(uFrac) : null,
    },
    quantidade_informada: so === "emb" ? emb : (so === "frac" ? frac : quantidadeSaldo),
    unidade_informada: so === "emb" ? embalagem.nome : (so === "frac" ? mostrarUn(uFrac) : unidadeSaldo),
  };
}

// ─── Busca do produto e saldo ────────────────────────────────────────────────
const normal = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Produtos para lançar num local. RETIRADA: só o que está neste local (com
 * saldo primeiro). ENTRADA: sem busca, os do local; com busca, o cadastro
 * inteiro (o produto passa a existir no local na primeira entrada).
 * Busca por nome, nome interno, código, marca ou fornecedor.
 */
export function produtosParaLancar({ insumos, itens, estoqueId, tipo, termo = "", limite = 40 }) {
  const saldoPorInsumo = new Map((itens || []).filter((i) => i.estoque_id === estoqueId).map((i) => [i.insumo_id, Number(i.quantidade_atual) || 0]));
  const t = normal(String(termo || "").trim());
  const casa = (i) => !t || [i.nome, i.nome_interno, i.codigo_interno, i.marca, i.fornecedor].some((v) => normal(v).includes(t));
  let lista = (insumos || []).filter(casa).map((i) => ({ insumo: i, vinculado: saldoPorInsumo.has(i.id), saldo: saldoPorInsumo.get(i.id) ?? 0 }));
  if (tipo === "saida" || !t) lista = lista.filter((p) => p.vinculado);
  lista.sort((a, b) => (Number(b.vinculado) - Number(a.vinculado))
    || (tipo === "saida" ? Number(b.saldo > 0) - Number(a.saldo > 0) : 0)
    || String(a.insumo.nome || "").localeCompare(String(b.insumo.nome || ""), "pt-BR", { sensitivity: "base" }));
  return lista.slice(0, limite);
}

/** Saldo depois do lançamento (na unidade do cadastro). */
export function saldoDepois(saldo, tipo, quantidade) {
  const s = Number(saldo) || 0;
  const q = Number(quantidade) || 0;
  return r3(tipo === "saida" ? s - q : s + q);
}

// ─── Banco ───────────────────────────────────────────────────────────────────
const PIN_VALIDO = /^\d{4,8}$/;

/** Resposta das funções: {ok:false} é PIN errado/bloqueado (a tentativa fica gravada). */
export const MSG_BANCO_DESATUALIZADO = "O banco ainda não recebeu a atualização do estoque (EST-MOV). Avise o administrador.";
export const bancoDesatualizado = (msg) => /could not find the function|function .* does not exist|schema cache|PGRST202/i.test(String(msg || ""));
function lerRpc(r) {
  if (r?.error) {
    const msg = r.error.message || String(r.error);
    return bancoDesatualizado(msg) ? falha(MSG_BANCO_DESATUALIZADO, { semBanco: true }) : falha(msg);
  }
  const d = r?.data;
  if (d && d.ok === false) return falha(d.erro || "Não autorizado.", { pin: !!d.pin });
  return { data: d, error: null };
}

/**
 * Entrada ou retirada. `chave` deve ser criada uma vez por confirmação na tela
 * (novaChave()) e reenviada igual se a rede falhar: o banco não duplica.
 */
export async function registrarMovimento(db, p = {}) {
  if (!db) return falha("Banco indisponível.");
  const tipo = p.tipo;
  if (!["entrada", "saida"].includes(tipo)) return falha("Escolha ENTRADA ou RETIRADA.");
  const motivo = MOTIVOS[tipo].find((m) => m.codigo === p.motivo);
  if (!motivo) return falha(`Escolha o motivo da ${tipo === "entrada" ? "entrada" : "retirada"}.`);
  if (!p.unidade_id || !p.estoque_id || !p.insumo_id) return falha("Selecione o estoque e o produto.");
  const l = p.lancamento;
  if (!l || l.erro || !(Number(l.quantidade) > 0)) return falha(l?.erro || "Informe a quantidade.");
  if (!p.chave) return falha("Lançamento sem identificador: recarregue a tela.");
  if (motivo.admin) {
    if (String(p.justificativa || "").trim().length < 3) return falha("Informe o motivo do ajuste.");
    if (!PIN_VALIDO.test(String(p.pin || ""))) return falha("Digite o PIN do administrador (4 a 8 números).", { pin: true });
  }
  const r = await db.rpc("estoque_movimentar", {
    p_unidade_id: p.unidade_id, p_estoque_id: p.estoque_id, p_insumo_id: p.insumo_id,
    p_tipo: tipo, p_motivo: motivo.codigo, p_quantidade: l.quantidadeSaldo ?? l.quantidade,
    p_validade: tipo === "entrada" ? (p.validade || null) : null,
    p_quantidade_informada: l.quantidade_informada ?? null, p_unidade_informada: l.unidade_informada ?? null,
    p_detalhe: l.detalhe || null, p_observacao: p.observacao || null, p_responsavel_nome: p.responsavel_nome || null,
    p_chave: p.chave, p_pin: motivo.admin ? String(p.pin) : null, p_justificativa: motivo.admin ? String(p.justificativa).trim() : null,
    p_origem: p.origem || "movimentacao",
  });
  return lerRpc(r);
}

/** Estorno (só administrador autorizado + PIN). O lançamento original continua no histórico. */
export async function estornarMovimento(db, { movimento_id, justificativa, pin, chave } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!movimento_id) return falha("Escolha a movimentação.");
  if (String(justificativa || "").trim().length < 3) return falha("Informe o motivo do estorno.");
  if (!PIN_VALIDO.test(String(pin || ""))) return falha("Digite o PIN do administrador (4 a 8 números).", { pin: true });
  const r = await db.rpc("estoque_estornar", {
    p_movimento_id: movimento_id, p_justificativa: String(justificativa).trim(), p_pin: String(pin), p_chave: chave || null,
  });
  return lerRpc(r);
}

/** Ajuste do saldo pelo inventário fechado (só administrador + PIN). `itens` = ids dos itens; null = todos. */
export async function ajustarInventario(db, { contagem_id, justificativa, pin, itens = null } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!contagem_id) return falha("Escolha o inventário.");
  if (String(justificativa || "").trim().length < 3) return falha("Informe o motivo do ajuste.");
  if (!PIN_VALIDO.test(String(pin || ""))) return falha("Digite o PIN do administrador (4 a 8 números).", { pin: true });
  const r = await db.rpc("estoque_ajustar_inventario", {
    p_contagem_id: contagem_id, p_justificativa: String(justificativa).trim(), p_pin: String(pin),
    p_itens: Array.isArray(itens) && itens.length ? itens : null,
  });
  return lerRpc(r);
}

/**
 * Correção de produto já contado (inventário aberto): só administrador + PIN
 * (EST-MOV-2). `lancamento` = quantidadeDoLancamento(...) na unidade do cadastro;
 * zero é aceito aqui (corrigir para "não tinha nada").
 */
export async function corrigirItemContagem(db, { item_id, quantidade, justificativa, pin } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!item_id) return falha("Escolha o produto.");
  const q = Number(quantidade);
  if (!Number.isFinite(q) || q < 0) return falha("Informe a quantidade correta.");
  if (String(justificativa || "").trim().length < 3) return falha("Informe o motivo da correção.");
  if (!PIN_VALIDO.test(String(pin || ""))) return falha("Digite o PIN do administrador (4 a 8 números).", { pin: true });
  return lerRpc(await db.rpc("estoque_contagem_corrigir_item", {
    p_item_id: item_id, p_quantidade: r3(q), p_justificativa: String(justificativa).trim(), p_pin: String(pin),
  }));
}

/** O que a tela pode mostrar/fazer: contagem cega, permissões, PIN padrão (só para administrador). */
export async function lerSegurancaEstoque(db, unidade_id) {
  if (!db) return falha("Banco indisponível.");
  if (!unidade_id) return falha("Selecione uma unidade.");
  return lerRpc(await db.rpc("estoque_seguranca_status", { p_unidade_id: unidade_id }));
}

/** Trocar o PIN e/ou a contagem cega (permissão de configurar + PIN atual). */
export async function salvarSegurancaEstoque(db, { unidade_id, pin_atual, pin_novo = null, pin_confirmacao = null, contagem_cega = null } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!unidade_id) return falha("Selecione uma unidade.");
  if (!PIN_VALIDO.test(String(pin_atual || ""))) return falha("Digite o PIN atual (4 a 8 números).", { pin: true });
  if (pin_novo != null && pin_novo !== "") {
    if (!PIN_VALIDO.test(String(pin_novo))) return falha("O PIN novo deve ter de 4 a 8 números.");
    if (pin_confirmacao != null && String(pin_confirmacao) !== String(pin_novo)) return falha("A confirmação não é igual ao PIN novo.");
  }
  const novo = pin_novo != null && pin_novo !== "" ? String(pin_novo) : null;
  if (novo == null && contagem_cega == null) return falha("Nada para salvar.");
  return lerRpc(await db.rpc("estoque_seguranca_salvar", {
    p_unidade_id: unidade_id, p_pin_atual: String(pin_atual), p_pin_novo: novo,
    p_contagem_cega: contagem_cega == null ? null : !!contagem_cega,
  }));
}

/** Pode aparecer o botão ESTORNAR? (entrada/retirada, não é estorno, não foi estornado). */
export function podeEstornar(mov, estornados = new Set()) {
  return !!mov && ["entrada", "saida"].includes(mov.tipo) && !mov.estorno_de_id && !estornados.has(mov.id) && !ehEntradaDeCompra(mov);
}

/** Entrada feita ao confirmar uma compra: volta só cancelando a compra (estoque, custo e conta juntos). */
export function ehEntradaDeCompra(mov) {
  return !!mov && mov.origem === "compra" && !!mov.detalhe_quantidade?.compra_item_id;
}
