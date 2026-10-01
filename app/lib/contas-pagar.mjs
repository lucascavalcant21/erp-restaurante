// CONTAS A PAGAR — contrato mínimo (HOTFIX FIN-CP-1)
//
// Única camada que grava em public.contas_pagar. Usa SÓ as colunas que existem
// hoje em produção:
//   id, unidade_id, descricao, valor, data_vencimento, data_pagamento,
//   categoria, status, created_at, updated_at, recorrente
//
// Regras:
// - conta nasce 'pendente' com data_pagamento nula;
// - pagar e estornar são ações separadas da edição; edição nunca mexe em
//   status nem em data_pagamento;
// - pagamento é integral (não existe coluna de valor pago/saldo);
// - toda gravação confirma que a linha foi de fato alterada (.select) — sem
//   linha afetada é erro, nunca sucesso;
// - unidade vem do contexto do ERP; nunca há unidade "de reserva".
//
// As funções que falam com o banco recebem o cliente (`db`) por parâmetro para
// poderem ser testadas sem Supabase (contas-pagar.test.mjs).

export const STATUS_PENDENTE = "pendente";
export const STATUS_PAGO = "pago";

// Leitura tolera o legado; gravação usa só 'pendente' / 'pago'.
const GRAFIAS_PAGO = ["pago", "paga", "Pago", "Paga", "PAGO", "PAGA"];
const GRAFIAS_PENDENTE = ["pendente", "Pendente", "PENDENTE"];

// Categorias conhecidas (leitura). 'cmv' continua aqui para exibir o histórico,
// mas NÃO é oferecida para conta nova: compra de mercadoria não é CMV.
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
];
export const CATEGORIAS_NOVA_CONTA = CATEGORIAS_CONTA.filter((c) => c.id !== "cmv");
const IDS_CATEGORIA = new Set(CATEGORIAS_CONTA.map((c) => c.id));
const IDS_NOVA = new Set(CATEGORIAS_NOVA_CONTA.map((c) => c.id));

export function rotuloCategoria(id) {
  return CATEGORIAS_CONTA.find((c) => c.id === id)?.label || id || "Sem categoria";
}

/** 'pago' | 'pendente' | null (status desconhecido/legado não mapeado). */
export function statusPersistido(conta) {
  const s = String(conta?.status ?? "").trim();
  if (GRAFIAS_PAGO.includes(s)) return STATUS_PAGO;
  if (GRAFIAS_PENDENTE.includes(s)) return STATUS_PENDENTE;
  return null;
}

export function hojeLocal(agora = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${agora.getFullYear()}-${p(agora.getMonth() + 1)}-${p(agora.getDate())}`;
}

/** Situação para exibir: 'pago' | 'vencida' | 'pendente' | 'desconhecido'. "Vencida" é derivada da data. */
export function situacaoConta(conta, hoje = hojeLocal()) {
  const st = statusPersistido(conta);
  if (st === STATUS_PAGO) return "pago";
  if (st === null) return "desconhecido";
  const venc = String(conta?.data_vencimento || "").slice(0, 10);
  return venc && venc < hoje ? "vencida" : "pendente";
}

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
function dataValida(s) {
  if (!DATA_RE.test(String(s || ""))) return false;
  const [a, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const UUID_ZERO = /^0{8}-0{4}-0{4}-0{4}-0{11}\d$/;
/** Unidade real do contexto: texto não vazio, nem "todas", nem o UUID falso antigo. */
export function unidadeValida(unidadeId) {
  const u = String(unidadeId ?? "").trim();
  return !!u && u !== "todas" && !UUID_ZERO.test(u);
}

export function lerValor(v) {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return NaN;
  // "1.234,56" → 1234.56 ; "1234,56" → 1234.56 ; "1234.56" → 1234.56
  const normal = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  return Number(normal);
}

/**
 * Valida e monta os campos editáveis (descricao, valor, data_vencimento,
 * categoria, recorrente). `categoriaAtual` permite manter na edição uma
 * categoria histórica (ex.: 'cmv') sem oferecê-la para conta nova.
 */
export function validarCamposConta(dados, { categoriaAtual = null } = {}) {
  const erros = [];
  const descricao = String(dados?.descricao ?? "").trim();
  const valor = Math.round(lerValor(dados?.valor) * 100) / 100;
  const data_vencimento = String(dados?.data_vencimento ?? "").slice(0, 10);
  const categoria = String(dados?.categoria ?? "").trim();

  if (!descricao) erros.push("Informe a descrição.");
  if (!Number.isFinite(valor) || valor <= 0) erros.push("O valor precisa ser maior que zero.");
  if (!dataValida(data_vencimento)) erros.push("Informe uma data de vencimento válida.");
  const aceita = IDS_NOVA.has(categoria) || (categoriaAtual && categoria === categoriaAtual && IDS_CATEGORIA.has(categoria));
  if (!aceita) {
    erros.push(categoria === "cmv"
      ? "CMV não é categoria de despesa: compra de mercadoria será tratada pelo módulo de Compras."
      : "Escolha uma categoria válida.");
  }
  return {
    ok: erros.length === 0,
    erros,
    campos: { descricao, valor, data_vencimento, categoria, recorrente: !!dados?.recorrente },
  };
}

function erroDb(error) {
  return error ? (error.message || String(error)) : null;
}
function falha(msg) {
  return { data: null, error: msg };
}

/** Cria conta 'pendente'. Retorna { data: { id }, error }. */
export async function criarContaPagar(db, dados) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(dados?.unidade_id)) return falha("Selecione uma unidade antes de lançar a conta.");
  const v = validarCamposConta(dados);
  if (!v.ok) return falha(v.erros.join(" "));
  const registro = {
    unidade_id: String(dados.unidade_id).trim(),
    ...v.campos,
    status: STATUS_PENDENTE,
    data_pagamento: null,
  };
  const { data, error } = await db.from("contas_pagar").insert([registro]).select("id").single();
  if (error) return falha(erroDb(error));
  if (!data?.id) return falha("O banco não confirmou a criação da conta.");
  return { data: { id: data.id }, error: null };
}

/**
 * Cria várias contas pendente numa única gravação (tudo ou nada). Se
 * qualquer item for inválido, nada é gravado e o erro diz quais.
 * Retorna { data: [ids], error }.
 */
export async function criarContasPagarEmLote(db, lista) {
  if (!db) return falha("Banco indisponível.");
  if (!Array.isArray(lista) || !lista.length) return { data: [], error: null };
  const registros = [];
  const erros = [];
  lista.forEach((d, i) => {
    const nome = String(d?.descricao || "").trim() || `item ${i + 1}`;
    if (!unidadeValida(d?.unidade_id)) { erros.push(`${nome}: unidade inválida`); return; }
    const v = validarCamposConta(d);
    if (!v.ok) { erros.push(`${nome}: ${v.erros.join(" ")}`); return; }
    registros.push({ unidade_id: String(d.unidade_id).trim(), ...v.campos, status: STATUS_PENDENTE, data_pagamento: null });
  });
  if (erros.length) return falha(`Nenhuma conta foi lançada. ${erros.join(" | ")}`);
  const { data, error } = await db.from("contas_pagar").insert(registros).select("id");
  if (error) return falha(erroDb(error));
  if ((data || []).length !== registros.length) return falha("O banco não confirmou todas as contas.");
  return { data: data.map((r) => r.id), error: null };
}

/** Edita só descricao/valor/vencimento/categoria/recorrente. Nunca status nem data_pagamento. */
export async function editarContaPagar(db, { id, unidade_id, categoriaAtual = null, ...dados }) {
  if (!db) return falha("Banco indisponível.");
  if (!id) return falha("Conta não informada.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  const v = validarCamposConta(dados, { categoriaAtual });
  if (!v.ok) return falha(v.erros.join(" "));
  const { data, error } = await db.from("contas_pagar")
    .update({ ...v.campos, updated_at: new Date().toISOString() })
    .eq("id", id).eq("unidade_id", unidade_id)
    .select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("Conta não encontrada nesta unidade (nada foi alterado).");
  return { data: { id }, error: null };
}

/** Marca como paga, com a data real informada. Só altera conta que ainda não está paga. */
export async function pagarContaPagar(db, { id, unidade_id, data_pagamento, hoje = hojeLocal() }) {
  if (!db) return falha("Banco indisponível.");
  if (!id) return falha("Conta não informada.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  const dia = String(data_pagamento ?? "").slice(0, 10);
  if (!dataValida(dia)) return falha("Informe a data real do pagamento.");
  if (dia > hoje) return falha("A data do pagamento não pode ser futura.");
  const lista = GRAFIAS_PAGO.map((s) => `"${s}"`).join(",");
  const { data, error } = await db.from("contas_pagar")
    .update({ status: STATUS_PAGO, data_pagamento: dia, updated_at: new Date().toISOString() })
    .eq("id", id).eq("unidade_id", unidade_id)
    .not("status", "in", `(${lista})`)
    .select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("Conta não encontrada nesta unidade ou já está paga (nada foi alterado).");
  return { data: { id, status: STATUS_PAGO, data_pagamento: dia }, error: null };
}

/** Estorno temporário: volta para 'pendente' e limpa a data. Só altera conta paga. Não apaga nada. */
export async function estornarContaPagar(db, { id, unidade_id }) {
  if (!db) return falha("Banco indisponível.");
  if (!id) return falha("Conta não informada.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  const { data, error } = await db.from("contas_pagar")
    .update({ status: STATUS_PENDENTE, data_pagamento: null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("unidade_id", unidade_id)
    .in("status", GRAFIAS_PAGO)
    .select("id");
  if (error) return falha(erroDb(error));
  if (!data?.length) return falha("Conta não encontrada nesta unidade ou não está paga (nada foi alterado).");
  return { data: { id, status: STATUS_PENDENTE }, error: null };
}

/**
 * Lança uma conta e, se o fluxo de origem declarou que ela já foi paga
 * (ex.: Manutenção com forma de pagamento informada), registra o pagamento
 * na data declarada — em duas operações verificadas, nunca "nasce paga".
 * Retorno: { data: { id, paga }, error, erroPagamento }.
 */
export async function lancarContaPagar(db, dados, { pagaEm = null } = {}) {
  const criada = await criarContaPagar(db, dados);
  if (criada.error) return { data: null, error: criada.error, erroPagamento: null };
  if (!pagaEm) return { data: { id: criada.data.id, paga: false }, error: null, erroPagamento: null };
  const paga = await pagarContaPagar(db, { id: criada.data.id, unidade_id: dados.unidade_id, data_pagamento: pagaEm });
  return { data: { id: criada.data.id, paga: !paga.error }, error: null, erroPagamento: paga.error };
}
