// Leitura dos dados do CMV REAL (F2.4C) — recebe o cliente (`db`) por
// parâmetro (testável). Só LEITURA, exceto o lançamento opcional de
// faturamento diário (tabela fin_faturamento_diario, se existir).
//
// Fontes:
//   inventários   → estoque_contagens (fechadas, unidade inteira) + estoque_contagens_itens.valor_total (congelado)
//   compras       → vw_compras (status, total com frete/desconto) + compras_itens
//   produtos      → insumos (nome, departamento → grupo do CMV, categoria)
//   faturamento   → fin_faturamento_diario (opcional). Sem ela: NÃO APURADO, com o motivo.

import { lerValor, dataValida, unidadeValida } from "./contas-pagar.mjs";

const falha = (msg) => ({ data: null, error: msg });
const erroDb = (e) => (e ? e.message || String(e) : null);
export const MOTIVO_SEM_FATURAMENTO = "Não há fonte de faturamento no Héfisto: as vendas estão no Saipos, sem integração, e o faturamento diário informado ainda não foi habilitado.";
// data/hora vindas do banco: texto (Supabase) ou Date (driver) → texto ISO
const isoData = (v) => (v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));
const isoHora = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : String(v));
const tabelaAusente = (e) => /does not exist|não existe|schema cache|could not find/i.test(String(e?.message || e || ""));

export async function carregarDadosCmv(db, unidadeId) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(unidadeId)) return falha("Selecione uma unidade.");
  const [c, compras, ins, forn] = await Promise.all([
    db.from("estoque_contagens").select("id, tipo, data_referencia, status, estoque_id, fechada_em, fechada_por").eq("unidade_id", unidadeId).eq("status", "fechada"),
    db.from("vw_compras").select("*").eq("unidade_id", unidadeId),
    db.from("insumos").select("id, nome, departamento, categoria, unidade_medida").eq("unidade_id", unidadeId),
    db.from("fornecedores").select("id, nome"),
  ]);
  const erro = [c.error, compras.error, ins.error].find(Boolean);
  if (erro) return falha(erroDb(erro));
  const contagens = (c.data || []).filter((x) => !x.estoque_id);
  const idsC = contagens.map((x) => x.id);
  const idsCompra = (compras.data || []).map((x) => x.id);
  const [itC, itCp, fat] = await Promise.all([
    idsC.length ? db.from("estoque_contagens_itens").select("contagem_id, insumo_id, estoque_id, quantidade_contada, unidade_base, custo_unitario, valor_total").in("contagem_id", idsC) : { data: [] },
    idsCompra.length ? db.from("compras_itens").select("*").in("compra_id", idsCompra) : { data: [] },
    db.from("fin_faturamento_diario").select("data, vendas_brutas, cancelamentos, descontos, receita, fonte, observacao, updated_at").eq("unidade_id", unidadeId),
  ]);
  const erro2 = [itC.error, itCp.error].find(Boolean);
  if (erro2) return falha(erroDb(erro2));
  const itensPorContagem = new Map(idsC.map((id) => [id, []]));
  for (const i of itC.data || []) itensPorContagem.get(i.contagem_id)?.push({ ...i, quantidade_contada: Number(i.quantidade_contada), valor_total: i.valor_total == null ? null : Number(i.valor_total), custo_unitario: i.custo_unitario == null ? null : Number(i.custo_unitario) });
  let fonteFaturamento;
  if (fat.error) {
    fonteFaturamento = { disponivel: false, nome: null, motivo: tabelaAusente(fat.error) ? MOTIVO_SEM_FATURAMENTO : `Não foi possível ler o faturamento: ${erroDb(fat.error)}`, habilitado: !tabelaAusente(fat.error) };
  } else {
    fonteFaturamento = { disponivel: true, habilitado: true, nome: "faturamento diário informado no Héfisto (receita = vendas − cancelamentos − descontos)",
      dias: (fat.data || []).map((d) => ({ data: isoData(d.data), valor: Number(d.receita), detalhe: d })) };
  }
  return {
    data: {
      contagens: contagens.map((x) => ({ ...x, data_referencia: isoData(x.data_referencia), fechada_em: isoHora(x.fechada_em) })),
      itensPorContagem,
      compras: (compras.data || []).map((x) => ({ ...x, data_compra: isoData(x.data_compra), data_recebimento: isoData(x.data_recebimento), confirmada_em: isoHora(x.confirmada_em), created_at: isoHora(x.created_at),
        valor_total: Number(x.valor_total), valor_itens: Number(x.valor_itens) })),
      comprasItens: (itCp.data || []).map((i) => ({ ...i, quantidade_base: Number(i.quantidade_base ?? Number(i.quantidade_embalagens) * Number(i.conteudo_por_embalagem)), valor_total: Number(i.valor_total) })),
      insumoPorId: new Map((ins.data || []).map((i) => [i.id, i])),
      fornecedorPorId: new Map((forn.data || []).map((f) => [f.id, f])),
      fonteFaturamento,
    },
    error: null,
  };
}

/** Lança (ou corrige) o faturamento de um dia. Só funciona com a tabela opcional criada. */
export async function salvarFaturamentoDia(db, { unidade_id, data, vendas_brutas, cancelamentos = 0, descontos = 0, fonte, observacao = "" }) {
  if (!db) return falha("Banco indisponível.");
  if (!unidadeValida(unidade_id)) return falha("Selecione uma unidade.");
  if (!dataValida(data)) return falha("Informe a data.");
  const vb = lerValor(vendas_brutas); const ca = lerValor(cancelamentos || 0); const de = lerValor(descontos || 0);
  if (!Number.isFinite(vb) || vb < 0) return falha("Informe as vendas brutas do dia (zero se não abriu).");
  if (!Number.isFinite(ca) || ca < 0 || !Number.isFinite(de) || de < 0) return falha("Cancelamentos e descontos inválidos.");
  if (ca + de > vb + 0.004) return falha("Cancelamentos + descontos não podem passar das vendas brutas.");
  const f = String(fonte || "").trim();
  if (!f) return falha("Informe a fonte (ex.: Saipos — relatório de vendas do dia).");
  const campos = { vendas_brutas: Math.round(vb * 100) / 100, cancelamentos: Math.round(ca * 100) / 100, descontos: Math.round(de * 100) / 100, fonte: f, observacao: String(observacao || "").trim() || null };
  const ins = await db.from("fin_faturamento_diario").insert({ unidade_id, data, ...campos }).select("id").single();
  if (!ins.error) return { data: { id: ins.data.id, novo: true }, error: null };
  if (ins.error.code !== "23505") return falha(erroDb(ins.error));
  const up = await db.from("fin_faturamento_diario").update(campos).eq("unidade_id", unidade_id).eq("data", data).select("id");
  if (up.error) return falha(erroDb(up.error));
  return { data: { id: up.data?.[0]?.id, novo: false }, error: null };
}
