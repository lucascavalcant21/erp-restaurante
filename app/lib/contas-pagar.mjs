// CONTAS A PAGAR — implementação definitiva (F2.2) sobre a fundação F2.1.
//
// Única camada que escreve em contas_pagar / fin_pagamentos. Substitui o
// contrato mínimo do HOTFIX FIN-CP-1 (que gravava status 'pago' direto).
//
// Arquitetura usada (aplicada em produção em 2026-10-01):
//   conta           → public.contas_pagar (+ colunas F2.1)
//   leitura         → public.vw_fin_contas_pagar (saldo, situação, legado)
//   pagamento       → rpc fin_registrar_pagamento   (parcial/integral, juros, multa, desconto)
//   estorno         → rpc fin_estornar_pagamento    (com motivo; nada é apagado)
//   cancelamento    → rpc fin_cancelar_conta_pagar  (com motivo; nada é apagado)
//   referências     → fin_categorias, fin_centros_custo, fornecedores
//
// Regras:
// - toda escrita confirma no banco (linha devolvida); sem confirmação = erro;
// - criação usa chave de idempotência gerada quando o formulário abre: um
//   retry (clique duplo, rede caiu) devolve as contas já criadas, sem duplicar;
// - pagamento/estorno/cancelamento só pelas RPCs (o app não grava pagamento);
// - contas antigas não são reescritas: aparecem pela view (ex.: "pago antigo");
// - unidade vem do contexto do ERP; nunca há unidade "de reserva".
//
// Funções com banco recebem o cliente (`db`) por parâmetro (testáveis).

export const STATUS_PENDENTE = "pendente";

// ─── Categorias ──────────────────────────────────────────────────────────────

// Texto antigo de contas_pagar.categoria: continua sendo lido pelo hub, DRE
// e relatórios atuais. Conta nova grava `categoria_codigo` (fin_categorias)
// e, por compatibilidade, o texto antigo correspondente abaixo.
export const CATEGORIAS_CONTA = [
  { id: "cmv", label: "CMV (Custo de Mercadoria Vendida)", cor: "bg-orange-500" },
  { id: "cmo", label: "CMO (Custo de Mão de Obra)", cor: "bg-blue-500" },
  { id: "custo_fixo", label: "Custo Fixo (Aluguel, Luz, etc)", cor: "bg-slate-600" },
  { id: "custo_variavel", label: "Custos Variáveis", cor: "bg-violet-500" },
  { id: "frete", label: "Fretes e Entregas", cor: "bg-teal-500" },
  { id: "limpeza", label: "Materiais de Limpeza", cor: "bg-cyan-500" },
  { id: "manutencao", label: "Manutenção", cor: "bg-stone-500" },
  { id: "marketing", label: "Custo Marketing", cor: "bg-pink-500" },
  { id: "investimento", label: "Investimentos", cor: "bg-emerald-500" },
  { id: "inventarios", label: "Inventários / Quebras", cor: "bg-red-500" },
  { id: "impostos", label: "Impostos e Taxas", cor: "bg-amber-500" },
  { id: "retirada_socio", label: "Retirada de Sócios (Lucro)", cor: "bg-indigo-500" },
  { id: "outros", label: "Outros", cor: "bg-slate-400" },
];

/** categoria_codigo (fin_categorias) → texto antigo usado pelas telas atuais. */
export function categoriaTextoCompat(codigo) {
  const c = String(codigo || "");
  if (c.startsWith("pessoal_")) return "cmo";
  if (/^(ocupacao_|utilidades_|adm_|fin_)/.test(c)) return "custo_fixo";
  if (c === "com_entregas") return "frete";
  if (c.startsWith("com_")) return "custo_variavel";
  if (c.startsWith("imp_")) return "impostos";
  if (c === "investimento_equipamentos") return "investimento";
  if (c === "retirada_socios") return "retirada_socio";
  if (["manutencao", "marketing", "limpeza", "outros"].includes(c)) return c;
  return "outros";
}

/** Categoria aceita em conta nova? (nunca legado nem mercadoria/CMV). */
export function categoriaManualValida(codigo, categorias = null) {
  const c = String(codigo || "").trim();
  if (!c || c.startsWith("legado_") || c.startsWith("mercadoria")) return false;
  if (!categorias) return /^[a-z0-9_]+$/.test(c);
  const cat = categorias.find((x) => x.codigo === c);
  return !!cat && cat.ativa !== false && cat.permite_conta_manual !== false;
}

/** Agrupa categorias para <optgroup>, só as permitidas em conta manual. */
export const ROTULO_GRUPO = {
  PESSOAL: "Pessoal (CMO)", OCUPACAO: "Ocupação", UTILIDADES: "Utilidades", ADMINISTRATIVO: "Administrativo",
  COMERCIALIZACAO: "Comercialização", IMPOSTOS: "Impostos", MANUTENCAO: "Manutenção", MARKETING: "Marketing",
  LIMPEZA: "Limpeza", FINANCEIRO: "Financeiro", MERCADORIA: "Mercadoria", INVESTIMENTO: "Investimento",
  DISTRIBUICAO: "Distribuição", LEGADO: "Lançamentos antigos", OUTROS: "Outros",
};
export function gruposDeCategorias(categorias = [], { incluirCodigo = null } = {}) {
  const grupos = new Map();
  for (const c of [...categorias].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))) {
    const permitida = c.permite_conta_manual !== false && c.ativa !== false;
    if (!permitida && c.codigo !== incluirCodigo) continue;
    if (!grupos.has(c.grupo)) grupos.set(c.grupo, []);
    grupos.get(c.grupo).push(c);
  }
  return [...grupos.entries()].map(([grupo, itens]) => ({ grupo, rotulo: ROTULO_GRUPO[grupo] || grupo, itens }));
}

// ─── Datas, valores, unidade ─────────────────────────────────────────────────

export function hojeLocal(agora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
export function dataValida(s) {
  if (!DATA_RE.test(String(s || ""))) return false;
  const [a, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function somarDias(iso, dias) {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

/** Soma meses mantendo o dia (limitado ao último dia do mês). */
export function somarMeses(iso, meses) {
  const [a, m, d] = iso.split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(d, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** "2026-09" ou "2026-09-15" → "2026-09-01" (competência é o mês). */
export function competenciaDe(valor) {
  const s = String(valor || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})/);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-01`;
  return dataValida(iso) ? iso : null;
}

const UUID_ZERO = /^0{8}-0{4}-0{4}-0{4}-0{11}\d$/;
export function unidadeValida(unidadeId) {
  const u = String(unidadeId ?? "").trim();
  return !!u && u !== "todas" && !UUID_ZERO.test(u);
}

export function lerValor(v) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normal);
}
const centavos = (n) => Math.round(n * 100);

export function novaChave() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Situação (vem da view; aqui só rótulo) ──────────────────────────────────

export const ROTULO_SITUACAO = {
  pendente: "Pendente", parcial: "Parcial", pago: "Pago", vencido: "Vencido",
  cancelado: "Cancelado", desconhecido: "Status desconhecido",
};
export function rotuloSituacao(conta) {
  if (conta?.situacao === "pago" && conta?.pagamento_legado) return "Pago antigo";
  return ROTULO_SITUACAO[conta?.situacao] || "Status desconhecido";
}
export function podeReceberPagamento(conta) {
  return ["pendente", "parcial", "vencido"].includes(conta?.situacao) && !conta?.pagamento_legado && Number(conta?.saldo) > 0;
}
export function podeCancelar(conta) {
  return ["pendente", "vencido"].includes(conta?.situacao) && !conta?.pagamento_legado && Number(conta?.valor_pago || 0) === 0;
}

// ─── Validação e montagem ────────────────────────────────────────────────────

/**
 * Campos editáveis de uma conta. `categoriaAtual` permite manter, numa
 * edição, a categoria que a conta já tem (mesmo que não seja mais oferecida).
 */
export function validarConta(dados, { categorias = null, categoriaAtual = null, exigirCompetencia = true } = {}) {
  const erros = [];
  const descricao = String(dados?.descricao ?? "").trim();
  const valor = Math.round(lerValor(dados?.valor) * 100) / 100;
  const data_vencimento = String(dados?.data_vencimento ?? "").slice(0, 10);
  const competencia = competenciaDe(dados?.competencia);
  const categoria_codigo = String(dados?.categoria_codigo ?? "").trim();
  const centro = String(dados?.centro_custo_codigo ?? "").trim() || null;
  const fornecedor = String(dados?.fornecedor_id ?? "").trim() || null;

  if (!descricao) erros.push("Informe a descrição.");
  if (!Number.isFinite(valor) || valor <= 0) erros.push("O valor precisa ser maior que zero.");
  if (!dataValida(data_vencimento)) erros.push("Informe uma data de vencimento válida.");
  if (exigirCompetencia && !competencia) erros.push("Informe a competência (mês a que a despesa pertence).");
  const mantem = categoriaAtual && categoria_codigo === categoriaAtual;
  if (!mantem && !categoriaManualValida(categoria_codigo, categorias)) {
    erros.push(categoria_codigo.startsWith("mercadoria") || categoria_codigo === "cmv"
      ? "Compra de mercadoria não é lançada como despesa nem como CMV: ela terá o módulo de Compras."
      : "Escolha uma categoria válida.");
  }
  if (fornecedor && !/^[0-9a-f-]{36}$/i.test(fornecedor)) erros.push("Fornecedor inválido.");

  return {
    ok: erros.length === 0,
    erros,
    campos: {
      descricao, valor, data_vencimento, competencia,
      categoria_codigo,
      categoria: categoriaTextoCompat(categoria_codigo),
      centro_custo_codigo: centro,
      fornecedor_id: fornecedor,
      documento_numero: String(dados?.documento_numero ?? "").trim() || null,
      observacao: String(dados?.observacao ?? "").trim() || null,
      recorrente: !!dados?.recorrente,
    },
  };
}

/**
 * Divide um valor em N parcelas exatas em centavos (o resto vai para a
 * última) com vencimentos mensais a partir do primeiro. A competência é a
 * mesma para todas: a despesa pertence ao mês em que foi contraída.
 */
export function montarParcelas(valorTotal, parcelas, primeiroVencimento) {
  const n = Math.trunc(Number(parcelas) || 1);
  if (n < 1 || n > 120) throw new Error("Número de parcelas inválido (1 a 120).");
  const total = centavos(valorTotal);
  const base = Math.floor(total / n);
  return Array.from({ length: n }, (_, i) => ({
    parcela_numero: i + 1,
    parcelas_total: n,
    valor: (i === n - 1 ? total - base * (n - 1) : base) / 100,
    data_vencimento: somarMeses(primeiroVencimento, i),
  }));
}

function falha(msg) {
  return { data: null, error: msg };
}
function erroDb(error) {
  return error ? (error.message || String(error)) : null;
}

// ─── Escrita ─────────────────────────────────────────────────────────────────

/**
 * Cria uma conta (ou N parcelas) numa única gravação.
 * `chave` = chave de idempotência gerada ao abrir o formulário. Repetir a
 * mesma chave devolve as contas já criadas (idempotente: true).
 */
export async function criarContaPagar(db, dados, { chave, categorias = null, origem_tipo = "MANUAL", origem_id = null } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(dados?.unidade_id)) return falha("Selecione uma unidade antes de lançar a conta.");
  if (!chave) return falha("Chave de idempotência ausente.");
  const v = validarConta(dados, { categorias });
  if (!v.ok) return falha(v.erros.join(" "));
  const nParcelas = Math.trunc(Number(dados?.parcelas) || 1);
  let linhas;
  try {
    linhas = nParcelas > 1
      ? montarParcelas(v.campos.valor, nParcelas, v.campos.data_vencimento)
      : [{ parcela_numero: null, parcelas_total: null, valor: v.campos.valor, data_vencimento: v.campos.data_vencimento }];
  } catch (e) {
    return falha(e.message);
  }
  // grupo das parcelas é uuid; a chave do formulário já é (novaChave), senão gera um
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const grupo = nParcelas > 1 ? (dados.grupo_parcelas_id || (UUID.test(chave) ? chave : novaChave())) : null;
  const registros = linhas.map((l) => ({
    unidade_id: String(dados.unidade_id).trim(),
    ...v.campos,
    descricao: nParcelas > 1 ? `${v.campos.descricao} (${l.parcela_numero}/${l.parcelas_total})` : v.campos.descricao,
    valor: l.valor,
    data_vencimento: l.data_vencimento,
    recorrente: nParcelas > 1 ? false : v.campos.recorrente,
    status: STATUS_PENDENTE,
    data_pagamento: null,
    origem_tipo,
    origem_id,
    grupo_parcelas_id: grupo,
    parcela_numero: l.parcela_numero,
    parcelas_total: l.parcelas_total,
    chave_idempotencia: nParcelas > 1 ? `${chave}:${l.parcela_numero}` : chave,
  }));
  const chaves = registros.map((r) => r.chave_idempotencia);
  const { data, error } = await db.from("contas_pagar").insert(registros).select("id");
  if (error) {
    if (error.code === "23505") {
      const { data: existentes, error: e2 } = await db.from("contas_pagar").select("id")
        .eq("unidade_id", registros[0].unidade_id).in("chave_idempotencia", chaves);
      if (!e2 && (existentes || []).length === registros.length) {
        return { data: existentes.map((r) => r.id), error: null, idempotente: true };
      }
    }
    return falha(erroDb(error));
  }
  if ((data || []).length !== registros.length) return falha("O banco não confirmou a criação da conta.");
  return { data: data.map((r) => r.id), error: null, idempotente: false };
}

/** Várias contas independentes (ex.: fechamento de folha) — tudo ou nada. */
export async function criarContasPagarEmLote(db, lista, { chave, origem_tipo = "MANUAL" } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!Array.isArray(lista) || !lista.length) return { data: [], error: null };
  if (!chave) return falha("Chave de idempotência ausente.");
  const registros = [];
  const erros = [];
  lista.forEach((d, i) => {
    const nome = String(d?.descricao || "").trim() || `item ${i + 1}`;
    if (!unidadeValida(d?.unidade_id)) { erros.push(`${nome}: unidade inválida`); return; }
    const v = validarConta(d);
    if (!v.ok) { erros.push(`${nome}: ${v.erros.join(" ")}`); return; }
    registros.push({
      unidade_id: String(d.unidade_id).trim(), ...v.campos, status: STATUS_PENDENTE, data_pagamento: null,
      origem_tipo, origem_id: d.origem_id || null, chave_idempotencia: d.chave_idempotencia || `${chave}:${i + 1}`,
    });
  });
  if (erros.length) return falha(`Nenhuma conta foi lançada. ${erros.join(" | ")}`);
  const { data, error } = await db.from("contas_pagar").insert(registros).select("id");
  if (error) return falha(erroDb(error));
  if ((data || []).length !== registros.length) return falha("O banco não confirmou todas as contas.");
  return { data: data.map((r) => r.id), error: null };
}

/**
 * Edita os campos descritivos. Grava SÓ o que o usuário mudou (comparado com
 * a conta como a view a mostra), para nunca preencher sozinho uma conta
 * antiga (categoria/competência inferidas continuam inferidas se não forem
 * trocadas). Nunca mexe em status, data_pagamento nem pagamentos. O valor só
 * muda se a conta ainda não teve pagamento.
 */
export async function editarContaPagar(db, { id, unidade_id, contaAtual, ...dados }, { categorias = null } = {}) {
  if (!db) return falha("Banco indisponível.");
  if (!id || !contaAtual) return falha("Conta não informada.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  if (contaAtual.situacao === "cancelado") return falha("Conta cancelada não pode ser editada.");
  const v = validarConta(dados, { categorias, categoriaAtual: contaAtual.categoria_codigo || null });
  if (!v.ok) return falha(v.erros.join(" "));
  const c = v.campos;
  const igual = (a, b) => (a ?? null) === (b ?? null);
  const patch = {};
  if (!igual(c.descricao, contaAtual.descricao)) patch.descricao = c.descricao;
  if (Math.abs(c.valor - Number(contaAtual.valor_original)) > 0.004) {
    if (Number(contaAtual.valor_pago || 0) > 0 || contaAtual.pagamento_legado) {
      return falha("O valor não pode mudar depois de haver pagamento. Estorne os pagamentos antes, se for o caso.");
    }
    patch.valor = c.valor;
  }
  if (!igual(c.data_vencimento, String(contaAtual.data_vencimento || "").slice(0, 10) || null)) patch.data_vencimento = c.data_vencimento;
  if (!igual(c.competencia, String(contaAtual.competencia_efetiva || "").slice(0, 10) || null)) patch.competencia = c.competencia;
  if (!igual(c.categoria_codigo, contaAtual.categoria_codigo)) {
    patch.categoria_codigo = c.categoria_codigo;
    patch.categoria = c.categoria;
  }
  if (!igual(c.centro_custo_codigo, contaAtual.centro_custo_codigo)) patch.centro_custo_codigo = c.centro_custo_codigo;
  if (!igual(c.fornecedor_id, contaAtual.fornecedor_id)) patch.fornecedor_id = c.fornecedor_id;
  if (!igual(c.documento_numero, contaAtual.documento_numero)) patch.documento_numero = c.documento_numero;
  if (!igual(c.observacao, contaAtual.observacao)) patch.observacao = c.observacao;
  if (c.recorrente !== !!contaAtual.recorrente) patch.recorrente = c.recorrente;
  if (!Object.keys(patch).length) return { data: { id, alterados: [] }, error: null };
  const { data, error } = await db.from("contas_pagar").update(patch)
    .eq("id", id).eq("unidade_id", unidade_id).select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("Conta não encontrada nesta unidade (nada foi alterado).");
  return { data: { id, alterados: Object.keys(patch) }, error: null };
}

/** Pagamento (parcial ou integral) pela RPC. */
export async function registrarPagamento(db, p, { hoje = hojeLocal() } = {}) {
  if (!db) return falha("Banco indisponível.");
  const valor = Math.round(lerValor(p?.valor_principal) * 100) / 100;
  const juros = p?.juros === "" || p?.juros == null ? 0 : Math.round(lerValor(p.juros) * 100) / 100;
  const multa = p?.multa === "" || p?.multa == null ? 0 : Math.round(lerValor(p.multa) * 100) / 100;
  const desconto = p?.desconto === "" || p?.desconto == null ? 0 : Math.round(lerValor(p.desconto) * 100) / 100;
  const dia = String(p?.pago_em ?? "").slice(0, 10);
  if (!p?.conta_pagar_id) return falha("Conta não informada.");
  if (!p?.chave) return falha("Chave de idempotência ausente.");
  if (!dataValida(dia)) return falha("Informe a data real do pagamento.");
  if (dia > hoje) return falha("A data do pagamento não pode ser futura.");
  if (!Number.isFinite(valor) || valor <= 0) return falha("O valor pago precisa ser maior que zero.");
  if ([juros, multa, desconto].some((x) => !Number.isFinite(x) || x < 0)) return falha("Juros, multa e desconto não podem ser negativos.");
  if (p.saldo != null && valor > Number(p.saldo) + 0.004) return falha(`Valor maior que o saldo da conta (saldo: ${Number(p.saldo).toFixed(2)}).`);
  if (desconto > valor + juros + multa) return falha("O desconto não pode ser maior que o total pago.");
  const { data, error } = await db.rpc("fin_registrar_pagamento", {
    p_conta_pagar_id: p.conta_pagar_id,
    p_pago_em: dia,
    p_valor_principal: valor,
    p_juros: juros,
    p_multa: multa,
    p_desconto: desconto,
    p_forma_pagamento: p.forma_pagamento || null,
    p_conta_financeira_id: p.conta_financeira_id || null,
    p_observacao: String(p.observacao ?? "").trim() || null,
    p_chave_idempotencia: p.chave,
  });
  if (error) return falha(erroDb(error));
  if (!data?.pagamento_id) return falha("O banco não confirmou o pagamento.");
  return { data, error: null };
}

export async function estornarPagamento(db, { pagamento_id, motivo }) {
  if (!db) return falha("Banco indisponível.");
  if (!pagamento_id) return falha("Pagamento não informado.");
  if (!String(motivo ?? "").trim()) return falha("Informe o motivo do estorno.");
  const { data, error } = await db.rpc("fin_estornar_pagamento", { p_pagamento_id: pagamento_id, p_motivo: String(motivo).trim() });
  if (error) return falha(erroDb(error));
  if (!data?.status) return falha("O banco não confirmou o estorno.");
  return { data, error: null };
}

export async function cancelarConta(db, { conta_pagar_id, motivo }) {
  if (!db) return falha("Banco indisponível.");
  if (!conta_pagar_id) return falha("Conta não informada.");
  if (!String(motivo ?? "").trim()) return falha("Informe o motivo do cancelamento.");
  const { data, error } = await db.rpc("fin_cancelar_conta_pagar", { p_conta_pagar_id: conta_pagar_id, p_motivo: String(motivo).trim() });
  if (error) return falha(erroDb(error));
  if (data?.status !== "cancelado") return falha("O banco não confirmou o cancelamento.");
  return { data, error: null };
}

/**
 * Lança conta vinda de outro módulo (RH, Manutenção). Se o módulo declarou
 * que já foi paga, registra o pagamento integral pela RPC na data declarada.
 * Retorno: { data: { id, paga }, error, erroPagamento }.
 */
export async function lancarContaPagar(db, dados, { chave, origem_tipo, origem_id = null, pagaEm = null } = {}) {
  const criada = await criarContaPagar(db, dados, { chave, origem_tipo, origem_id });
  if (criada.error) return { data: null, error: criada.error, erroPagamento: null };
  const id = criada.data[0];
  if (!pagaEm) return { data: { id, paga: false }, error: null, erroPagamento: null };
  const pg = await registrarPagamento(db, {
    conta_pagar_id: id, pago_em: pagaEm, valor_principal: lerValor(dados.valor), chave: `${chave}:pagamento`,
  });
  return { data: { id, paga: !pg.error }, error: null, erroPagamento: pg.error };
}

// ─── Recorrência (sob demanda, nunca ao abrir a tela) ────────────────────────

/**
 * Plano das contas recorrentes a gerar para a competência alvo. Modelo = conta
 * marcada como recorrente, que não foi ela mesma gerada por recorrência e não
 * está cancelada. O vencimento mantém a distância (em meses) entre a
 * competência e o vencimento do modelo. O índice único
 * (recorrencia_origem_id, competencia) impede duplicar com dois cliques/abas.
 */
export function planejarRecorrentes(contas, competenciaAlvo) {
  const alvo = competenciaDe(competenciaAlvo);
  if (!alvo) return [];
  const mesesEntre = (a, b) => {
    const [ya, ma] = a.split("-").map(Number);
    const [yb, mb] = b.split("-").map(Number);
    return (yb - ya) * 12 + (mb - ma);
  };
  const jaGeradas = new Set(contas.filter((c) => c.recorrencia_origem_id)
    .map((c) => `${c.recorrencia_origem_id}|${String(c.competencia_efetiva).slice(0, 10)}`));
  return contas
    .filter((c) => c.recorrente && !c.recorrencia_origem_id && c.situacao !== "cancelado")
    .filter((c) => String(c.competencia_efetiva).slice(0, 10) < alvo)
    .filter((c) => !jaGeradas.has(`${c.id}|${alvo}`))
    .map((c) => ({
      modelo: c,
      competencia: alvo,
      data_vencimento: somarMeses(String(c.data_vencimento).slice(0, 10), mesesEntre(String(c.competencia_efetiva).slice(0, 10), alvo)),
    }));
}

export async function gerarRecorrentes(db, { unidade_id, contas, competenciaAlvo }) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  const plano = planejarRecorrentes(contas, competenciaAlvo);
  let criadas = 0, existentes = 0;
  const erros = [];
  for (const p of plano) {
    const m = p.modelo;
    const registro = {
      unidade_id, descricao: m.descricao, valor: Number(m.valor_original),
      data_vencimento: p.data_vencimento, competencia: p.competencia,
      categoria_codigo: m.categoria_codigo, categoria: m.categoria_texto_antigo || categoriaTextoCompat(m.categoria_codigo),
      centro_custo_codigo: m.centro_custo_codigo || null, fornecedor_id: m.fornecedor_id || null,
      documento_numero: null, observacao: m.observacao || null,
      recorrente: false, recorrencia_origem_id: m.id, origem_tipo: "RECORRENTE",
      status: STATUS_PENDENTE, data_pagamento: null,
      chave_idempotencia: `rec:${m.id}:${p.competencia}`,
    };
    const { data, error } = await db.from("contas_pagar").insert([registro]).select("id");
    if (error?.code === "23505") existentes++;
    else if (error) erros.push(`${m.descricao}: ${erroDb(error)}`);
    else if (data?.length === 1) criadas++;
    else erros.push(`${m.descricao}: o banco não confirmou`);
  }
  return { data: { criadas, existentes, planejadas: plano.length }, error: erros.length ? erros.join(" | ") : null };
}

// ─── Período e resumo (caixa ≠ competência) ──────────────────────────────────

/** Intervalo fechado [de, ate] em datas ISO. tipo: hoje | semana | mes | personalizado. */
export function intervaloPeriodo(tipo, hoje = hojeLocal(), personalizado = {}) {
  if (tipo === "hoje") return { de: hoje, ate: hoje };
  if (tipo === "semana") {
    const [a, m, d] = hoje.split("-").map(Number);
    const dow = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
    const segunda = somarDias(hoje, -((dow + 6) % 7));
    return { de: segunda, ate: somarDias(segunda, 6) };
  }
  if (tipo === "mes") {
    const de = `${hoje.slice(0, 7)}-01`;
    return { de, ate: somarDias(somarMeses(de, 1), -1) };
  }
  const de = dataValida(personalizado.de) ? personalizado.de : null;
  const ate = dataValida(personalizado.ate) ? personalizado.ate : null;
  if (!de || !ate || de > ate) return null;
  return { de, ate };
}

/**
 * Resumo do topo. Tudo é CALCULADO a partir das contas registradas no
 * Héfisto (não é DRE). "Pago no período" é caixa: soma das saídas dos
 * pagamentos no período (+ pagamentos antigos sem histórico, sinalizados).
 */
export function resumoContas(contas, pagamentosPeriodo, periodo, hoje = hojeLocal()) {
  const abertas = contas.filter((c) => ["pendente", "parcial", "vencido"].includes(c.situacao));
  const soma = (xs, f) => Math.round(xs.reduce((s, x) => s + (Number(f(x)) || 0), 0) * 100) / 100;
  const ate7 = somarDias(hoje, 7);
  const legadoNoPeriodo = periodo
    ? contas.filter((c) => c.pagamento_legado && c.data_ultimo_pagamento >= periodo.de && c.data_ultimo_pagamento <= periodo.ate)
    : [];
  return {
    aPagar: soma(abertas, (c) => c.saldo),
    vencido: soma(abertas.filter((c) => c.vencida), (c) => c.saldo),
    proximos7: soma(abertas.filter((c) => !c.vencida && c.data_vencimento >= hoje && c.data_vencimento <= ate7), (c) => c.saldo),
    pagoNoPeriodo: periodo
      ? soma(pagamentosPeriodo.filter((p) => !p.estornado_em), (p) => p.valor_total) + soma(legadoNoPeriodo, (c) => c.valor_original)
      : null,
    pagoNoPeriodoIncluiLegado: legadoNoPeriodo.length > 0,
  };
}
