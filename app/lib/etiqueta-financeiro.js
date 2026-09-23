import { supabase, isSupabaseReady } from "./supabase";
import { contaPagarDaPendencia, resumoDoProcessamento } from "./etiqueta-financeiro.mjs";

// Drena a fila de perdas para contas_pagar.
//
// Idempotente por construção: a pendência só sai de 'pendente' depois que a
// conta existe, e etiqueta_financeiro_pendente tem índice único por evento de
// perda. Rodar duas vezes seguidas não gera dois lançamentos; rodar depois de
// uma falha de rede retoma de onde parou.
//
// Pode ser chamada pela tela (um botão "lançar perdas pendentes"), por um cron
// ou logo depois da própria perda. Não é chamada de dentro da RPC de propósito:
// o banco não deve depender de o app estar de pé para fechar a transação.

export async function listarPerdasPendentes(unidadeId, limite = 100) {
  if (!isSupabaseReady()) return { data: [], error: "Sistema indisponível" };
  let q = supabase
    .from("etiqueta_financeiro_pendente")
    .select("*")
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(limite);
  if (unidadeId && unidadeId !== "todas") q = q.eq("unidade_id", unidadeId);
  const { data, error } = await q;
  return { data: data || [], error: error?.message || null };
}

export async function processarPerdasPendentes(unidadeId, { limite = 100 } = {}) {
  const { data: pendencias, error } = await listarPerdasPendentes(unidadeId, limite);
  if (error) return { ...resumoDoProcessamento([]), error };

  const resultados = [];
  for (const pendencia of pendencias) {
    const linha = contaPagarDaPendencia(pendencia);
    if (!linha) {
      // Perda de item sem custo cadastrado: não há o que lançar, mas a
      // pendência não pode ficar rodando na fila para sempre.
      await supabase.from("etiqueta_financeiro_pendente")
        .update({ status: "dispensado", processado_em: new Date().toISOString() })
        .eq("id", pendencia.id);
      resultados.push({ id: pendencia.id, status: "dispensado", valor: 0 });
      continue;
    }

    const { data: conta, error: erroConta } = await supabase
      .from("contas_pagar").insert([linha]).select("id").single();

    if (erroConta) {
      // Fica pendente: a próxima passada tenta de novo. O contador de
      // tentativas e o motivo ficam na linha, para não virar falha silenciosa.
      await supabase.rpc("etiqueta_financeiro_marcar_erro", {
        p_id: pendencia.id, p_erro: erroConta.message || "falha ao lançar",
      }).catch(() => {});
      resultados.push({ id: pendencia.id, status: "erro", erro: erroConta.message });
      continue;
    }

    const { error: erroFecho } = await supabase.rpc("etiqueta_financeiro_marcar_lancado", {
      p_id: pendencia.id, p_conta_pagar_id: conta.id,
    });
    if (erroFecho) {
      // A conta existe mas a pendência não fechou. Reportar em vez de fingir:
      // a próxima passada criaria uma segunda conta, e é isso que o operador
      // precisa saber agora.
      resultados.push({
        id: pendencia.id, status: "erro", valor: linha.valor,
        erro: `Conta ${conta.id} lançada, mas a pendência não fechou: ${erroFecho.message}`,
      });
      continue;
    }
    resultados.push({ id: pendencia.id, status: "lancado", valor: linha.valor, contaId: conta.id });
  }

  return { ...resumoDoProcessamento(resultados), error: null };
}

export { contaPagarDaPendencia, resumoDoProcessamento } from "./etiqueta-financeiro.mjs";
