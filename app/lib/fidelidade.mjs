// ═══════════════════════════════════════════════════════════════════════════
// Fidelidade do Héfisto: cartões de selo por produto e cashback.
//
// Regras puras (sem banco), as mesmas que a migração FIDELIDADE-1 aplica no
// Postgres. Quem dá o selo e o cashback é o BANCO, quando o pedido é
// concluído (pago/entregue); aqui ficam a configuração do dono, a leitura do
// saldo a partir do livro de lançamentos e as contas do resgate.
//
//   · Cartão de selo: o dono escolhe os produtos que valem selo (café,
//     hambúrguer, drink…), quantos selos completam o cartão e o prêmio. Pode
//     haver vários cartões ao mesmo tempo. 1 selo por unidade do produto (ou
//     1 por pedido, se o dono quiser).
//   · Cashback: % do que o cliente pagou nos itens, creditado quando o
//     pedido é concluído — por isso só dá para usar na PRÓXIMA visita/pedido.
//   · Validade: o saldo vence se o cliente ficar N dias sem ganhar selo (ou
//     cashback). 0 = não vence.
//   · Cadastro pelo QR: o cliente se cadastra (vira cliente do CRM) e ganha
//     um desconto nos pedidos pelo cardápio digital — só no primeiro ou em
//     todos, o dono escolhe. Quem confere o cadastro é o servidor/banco.
//
// Nada aqui inventa saldo: sem lançamento, o saldo é zero.
// ═══════════════════════════════════════════════════════════════════════════

export const LIMITES_FIDELIDADE = Object.freeze({ cartoes: 10, produtosPorCartao: 200, selosMin: 2, selosMax: 30, pctMin: 0.5, pctMax: 30, validadeMax: 730 });
export const STATUS_CONCLUIDO = Object.freeze(["pago", "entregue", "fechado", "finalizado", "concluido"]);
export const STATUS_CANCELADO = Object.freeze(["cancelado", "recusado"]);

const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const centavos = (v) => Math.round((Number(v) || 0) * 100) / 100;
const texto = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const inteiro = (v, min, max, padrao) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao; };
const numero = (v, min, max, padrao) => {
  const n = Number(typeof v === "string" ? v.replace(",", ".") : v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : padrao;
};
const DIA_MS = 86400000;

export const FIDELIDADE_PADRAO = Object.freeze({
  ativo: false,
  cartoes: Object.freeze([]),
  cashback: Object.freeze({ ativo: false, percentual: 5, minimo_pedido: 0, validade_dias: 60, uso_maximo_pct: 50 }),
  cadastro: Object.freeze({ ativo: false, desconto_pct: 10, aplica: "primeiro", validade_dias: 0, pedir_email: false, pedir_aniversario: true }),
});

/** Só os dígitos do telefone, sem o 55 do Brasil. Fora de 10–11 dígitos: vazio (sem fidelidade). */
export function normalizarTelefone(v) {
  let d = String(v ?? "").replace(/\D/g, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : "";
}

function normalizarCartao(c, i) {
  if (!c || typeof c !== "object") return null;
  const id = ID_RE.test(String(c.id ?? "")) ? String(c.id) : `cartao-${i + 1}`;
  const nome = texto(c.nome, 40);
  const produto_ids = [...new Set((Array.isArray(c.produto_ids) ? c.produto_ids : []).map(String).filter((x) => ID_RE.test(x)))]
    .slice(0, LIMITES_FIDELIDADE.produtosPorCartao);
  return {
    id,
    nome: nome || "Cartão de selos",
    ativo: c.ativo !== false,
    produto_ids,
    selos: inteiro(c.selos, LIMITES_FIDELIDADE.selosMin, LIMITES_FIDELIDADE.selosMax, 10),
    por: c.por === "pedido" ? "pedido" : "unidade",
    recompensa: texto(c.recompensa, 80),
    validade_dias: inteiro(c.validade_dias, 0, LIMITES_FIDELIDADE.validadeMax, 0),
  };
}

/** Configuração do dono (config_sistema.params.fidelidade), limpa. Campo ruim volta ao padrão. */
export function normalizarFidelidade(raw) {
  const c = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const vistos = new Set();
  const cartoes = (Array.isArray(c.cartoes) ? c.cartoes : []).map(normalizarCartao).filter((x) => {
    if (!x || vistos.has(x.id)) return false;
    vistos.add(x.id);
    return true;
  }).slice(0, LIMITES_FIDELIDADE.cartoes);
  const cb = c.cashback && typeof c.cashback === "object" ? c.cashback : {};
  const P = FIDELIDADE_PADRAO.cashback;
  const cad = c.cadastro && typeof c.cadastro === "object" ? c.cadastro : {};
  const PC = FIDELIDADE_PADRAO.cadastro;
  return {
    ativo: c.ativo === true,
    cartoes,
    cashback: {
      ativo: cb.ativo === true,
      percentual: centavos(numero(cb.percentual, LIMITES_FIDELIDADE.pctMin, LIMITES_FIDELIDADE.pctMax, P.percentual)),
      minimo_pedido: centavos(numero(cb.minimo_pedido, 0, 100000, P.minimo_pedido)),
      validade_dias: inteiro(cb.validade_dias, 0, LIMITES_FIDELIDADE.validadeMax, P.validade_dias),
      uso_maximo_pct: inteiro(cb.uso_maximo_pct, 1, 100, P.uso_maximo_pct),
    },
    cadastro: {
      ativo: cad.ativo === true,
      desconto_pct: inteiro(cad.desconto_pct, 1, 50, PC.desconto_pct),
      aplica: cad.aplica === "sempre" ? "sempre" : "primeiro",
      validade_dias: inteiro(cad.validade_dias, 0, LIMITES_FIDELIDADE.validadeMax, PC.validade_dias),
      pedir_email: cad.pedir_email === true,
      pedir_aniversario: cad.pedir_aniversario !== false,
    },
  };
}

/** O que dá para MOSTRAR (e o que está valendo): programa ligado, cartões ativos com produto e prêmio. */
export function fidelidadeVigente(cfg) {
  const f = normalizarFidelidade(cfg);
  if (!f.ativo) return { cartoes: [], cashback: null, cadastro: null };
  return {
    cartoes: f.cartoes.filter((c) => c.ativo && c.produto_ids.length && c.recompensa),
    cashback: f.cashback.ativo ? f.cashback : null,
    cadastro: f.cadastro.ativo ? f.cadastro : null,
  };
}

/**
 * Selos que um pedido CONCLUÍDO rende, por cartão. `itens`: [{ produto_id,
 * quantidade }]. Por unidade: 2 cafés = 2 selos. Por pedido: 1 selo se o
 * pedido tem o produto.
 */
export function selosDoPedido(itens, cfg) {
  const { cartoes } = fidelidadeVigente(cfg);
  const out = [];
  for (const c of cartoes) {
    const ids = new Set(c.produto_ids);
    const qtd = (itens || []).reduce((s, i) => s + (ids.has(String(i.produto_id)) ? Math.max(0, Math.floor(Number(i.quantidade) || 0)) : 0), 0);
    if (qtd > 0) out.push({ cartao_id: c.id, selos: c.por === "pedido" ? 1 : qtd });
  }
  return out;
}

/** Cashback de um pedido concluído: % do que foi pago nos itens (sem a taxa de entrega e sem o cashback usado nele). */
export function cashbackDoPedido(subtotalItens, cfg, { cashbackUsado = 0 } = {}) {
  const { cashback } = fidelidadeVigente(cfg);
  if (!cashback) return 0;
  const base = centavos(Math.max(0, (Number(subtotalItens) || 0) - Math.max(0, Number(cashbackUsado) || 0)));
  if (base <= 0 || base < cashback.minimo_pedido) return 0;
  return centavos((base * cashback.percentual) / 100);
}

/**
 * Saldo a partir do livro (fidelidade_movimentos) de UM cliente: selos por
 * cartão e cashback. Vence quando o último crédito é mais velho que a
 * validade (o banco zera de vez no próximo crédito, com um lançamento
 * "expira"; aqui o saldo vencido já aparece como 0).
 */
export function saldoDoCliente(movimentos, cfg, agora = Date.now()) {
  const f = normalizarFidelidade(cfg);
  const porCartao = new Map(f.cartoes.map((c) => [c.id, c]));
  const t = typeof agora === "number" ? agora : new Date(agora).getTime();
  const cartoes = {};
  const cash = { total: 0, ultimo_credito: null };
  for (const m of movimentos || []) {
    const quando = new Date(m.created_at).getTime();
    if (String(m.tipo).startsWith("selo")) {
      const id = String(m.cartao_id || "");
      const s = (cartoes[id] ||= { total: 0, ultimo_credito: null });
      s.total += Math.round(Number(m.selos) || 0);
      if (m.tipo === "selo" || (m.tipo === "selo_ajuste" && Number(m.selos) > 0)) s.ultimo_credito = Math.max(s.ultimo_credito || 0, quando);
    } else if (String(m.tipo).startsWith("cashback")) {
      cash.total = centavos(cash.total + (Number(m.valor) || 0));
      if (m.tipo === "cashback" || (m.tipo === "cashback_ajuste" && Number(m.valor) > 0)) cash.ultimo_credito = Math.max(cash.ultimo_credito || 0, quando);
    }
  }
  const venceu = (ultimo, dias) => Boolean(dias && ultimo && ultimo + dias * DIA_MS < t);
  const saidaCartoes = {};
  for (const [id, s] of Object.entries(cartoes)) {
    const c = porCartao.get(id);
    const vencido = venceu(s.ultimo_credito, c?.validade_dias);
    const selos = vencido ? 0 : Math.max(0, s.total);
    saidaCartoes[id] = {
      selos,
      vencidos: vencido ? Math.max(0, s.total) : 0,
      vence_em: c?.validade_dias && s.ultimo_credito && !vencido ? new Date(s.ultimo_credito + c.validade_dias * DIA_MS).toISOString() : null,
      necessarios: c?.selos || null,
      completos: c ? Math.floor(selos / c.selos) : 0,
    };
  }
  const cvencido = venceu(cash.ultimo_credito, f.cashback.validade_dias);
  return {
    cartoes: saidaCartoes,
    cashback: {
      saldo: cvencido ? 0 : Math.max(0, cash.total),
      vencido: cvencido ? Math.max(0, cash.total) : 0,
      vence_em: f.cashback.validade_dias && cash.ultimo_credito && !cvencido ? new Date(cash.ultimo_credito + f.cashback.validade_dias * DIA_MS).toISOString() : null,
    },
  };
}

/** Quanto do cashback dá para usar neste pedido: o saldo, até o teto (% do pedido) do dono. */
export function cashbackUsavel(saldo, totalPedido, cfg) {
  const { cashback } = fidelidadeVigente(cfg);
  if (!cashback) return 0;
  const teto = centavos(((Number(totalPedido) || 0) * cashback.uso_maximo_pct) / 100);
  return centavos(Math.max(0, Math.min(Number(saldo) || 0, teto)));
}

/** Progresso do cartão para mostrar ao cliente: selos no cartão atual e quantos faltam. */
export function progressoDoCartao(cartao, selos) {
  const n = Math.max(0, Math.floor(Number(selos) || 0));
  const necessarios = cartao?.selos || 10;
  const completos = Math.floor(n / necessarios);
  const noCartao = n - completos * necessarios;
  return { no_cartao: noCartao, necessarios, faltam: completos ? 0 : necessarios - noCartao, completos };
}

/** Cartões que um produto alimenta (para o selo "vale selo" no prato). */
export function cartoesDoProduto(produtoId, cfg) {
  const id = String(produtoId);
  return fidelidadeVigente(cfg).cartoes.filter((c) => c.produto_ids.includes(id));
}

/** O que sai no cardápio público: só o que o cliente precisa ver (sem dado de ninguém). */
export function fidelidadePublica(cfg, idsVisiveis) {
  const { cartoes, cashback, cadastro } = fidelidadeVigente(cfg);
  const visiveis = idsVisiveis ? new Set(idsVisiveis) : null;
  const lista = cartoes.map((c) => ({
    id: c.id, nome: c.nome, selos: c.selos, por: c.por, recompensa: c.recompensa, validade_dias: c.validade_dias,
    produto_ids: visiveis ? c.produto_ids.filter((x) => visiveis.has(x)) : c.produto_ids,
  })).filter((c) => c.produto_ids.length);
  if (!lista.length && !cashback && !cadastro) return null;
  return {
    cartoes: lista,
    cashback: cashback ? { ...cashback } : null,
    cadastro: cadastro ? { desconto_pct: cadastro.desconto_pct, aplica: cadastro.aplica, pedir_email: cadastro.pedir_email, pedir_aniversario: cadastro.pedir_aniversario } : null,
  };
}

/** Desconto do cadastro sobre os itens (centavos). `pct` vem do banco; 0 = sem desconto. */
export function descontoDoCadastro(subtotalItens, pct) {
  const p = Math.min(50, Math.max(0, Number(pct) || 0));
  return centavos(((Number(subtotalItens) || 0) * p) / 100);
}

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

/**
 * Cadastro feito pelo cliente no QR: nome, WhatsApp, e-mail e aniversário
 * (opcionais, conforme o dono pediu) e o aceite da LGPD. Devolve os campos
 * limpos ou o erro (código + campo).
 */
export function validarCadastro(corpo, cfg) {
  const c = corpo && typeof corpo === "object" ? corpo : {};
  const { cadastro } = fidelidadeVigente(cfg);
  if (!cadastro) return { ok: false, codigo: "cadastro_fechado" };
  const nome = texto(c.nome, 80);
  if (nome.length < 2) return { ok: false, codigo: "nome" };
  const tel = normalizarTelefone(c.telefone);
  if (!tel) return { ok: false, codigo: "telefone" };
  const email = texto(c.email, 254).toLowerCase();
  if (email && !EMAIL_RE.test(email)) return { ok: false, codigo: "email" };
  let aniversario = null;
  const a = String(c.aniversario ?? "").trim();
  if (a) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
    const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
    const ok = d && d.getUTCMonth() === +m[2] - 1 && +m[1] >= 1900 && d.getTime() <= Date.now();
    if (!ok) return { ok: false, codigo: "aniversario" };
    aniversario = a;
  }
  if (c.aceite !== true) return { ok: false, codigo: "aceite" };
  return {
    ok: true,
    cadastro: { nome, telefone: tel, email: cadastro.pedir_email ? email || null : null, aniversario: cadastro.pedir_aniversario ? aniversario : null, novidades: c.novidades === true },
  };
}
