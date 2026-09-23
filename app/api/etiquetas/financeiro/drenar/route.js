import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../../lib/server/supabase-server.mjs";
import { autorizacaoDoCron, saudeDaFila } from "../../../../lib/etiqueta-financeiro-fila.mjs";
import { contaPagarDaPendencia, resumoDoProcessamento } from "../../../../lib/etiqueta-financeiro.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/* DRENADOR DA FILA DE PERDAS
 *
 * etiqueta_perda tira a comida do estoque e deixa a pendência financeira na
 * mesma transação. Este endpoint é quem transforma a pendência em conta a
 * pagar — e ele existe justamente para a consistência financeira NÃO depender
 * de alguém abrir a tela de etiquetas.
 *
 * Acionamento: o cron da Vercel declarado em vercel.json, no mesmo padrão de
 * /api/hefisto/automation/cron. A tela pode chamar também, para o operador ver
 * o efeito na hora, mas não é ela quem garante que a fila esvazia.
 *
 * Roda com service_role porque precisa atravessar unidades — por isso a porta
 * é fechada por segredo e, sem segredo configurado, não abre.
 */

const LIMITE_PADRAO = 50;

export async function POST(request) {
  return drenar(request);
}

/* GET responde o estado da fila sem processar: serve de health check e é o que
 * o cron da Vercel chama (crons fazem GET). */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get("apenasStatus") === "1") return status(request);
  return drenar(request);
}

function autorizar(request) {
  const { searchParams } = new URL(request.url);
  return autorizacaoDoCron({
    authorization: request.headers.get("authorization") || "",
    vercelCron: request.headers.get("x-vercel-cron") || "",
    segredoParam: searchParams.get("secret") || "",
    segredoEsperado: process.env.CRON_SECRET || "",
  });
}

async function status(request) {
  const auth = autorizar(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.motivo }, { status: 401 });
  let db;
  try { db = getSupabaseServerClient(); }
  catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 503 }); }

  const { data, error } = await db.from("vw_etiqueta_financeiro_fila").select("*");
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, fila: saudeDaFila(data || []), porUnidade: data || [] });
}

async function drenar(request) {
  const auth = autorizar(request);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.motivo }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unidadeId = searchParams.get("unidadeId") || null;
  const limite = Math.min(500, Math.max(1, Number(searchParams.get("limite")) || LIMITE_PADRAO));

  let db;
  try { db = getSupabaseServerClient(); }
  catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 503 }); }

  // Reserva atômica: dois drenadores simultâneos pegam lotes diferentes, e o
  // que ficou preso de uma execução que morreu volta para a fila sozinho.
  const { data: lote, error: erroLote } = await db.rpc("etiqueta_financeiro_reservar_lote", {
    p_unidade_id: unidadeId,
    p_limite: limite,
    p_executor: auth.origem || "cron",
  });
  if (erroLote) return NextResponse.json({ ok: false, error: erroLote.message }, { status: 500 });

  const resultados = [];
  for (const pendencia of lote || []) {
    const linha = contaPagarDaPendencia(pendencia);

    if (!linha) {
      // Perda de item sem custo cadastrado: não há o que lançar, mas também
      // não pode ficar rodando na fila para sempre.
      await db.rpc("etiqueta_financeiro_dispensar", {
        p_id: pendencia.id, p_motivo: "sem custo unitário cadastrado",
      });
      resultados.push({ id: pendencia.id, status: "dispensado", valor: 0 });
      continue;
    }

    const { data: conta, error: erroConta } = await db
      .from("contas_pagar").insert([linha]).select("id").single();

    if (erroConta) {
      await db.rpc("etiqueta_financeiro_marcar_erro", {
        p_id: pendencia.id, p_erro: erroConta.message || "falha ao lançar",
      });
      resultados.push({ id: pendencia.id, status: "erro", erro: erroConta.message });
      continue;
    }

    const { error: erroFecho } = await db.rpc("etiqueta_financeiro_marcar_lancado", {
      p_id: pendencia.id, p_conta_pagar_id: conta.id,
    });
    if (erroFecho) {
      // A conta existe mas a pendência não fechou. Não dá para desfazer daqui
      // sem risco, então o caso é reportado em vez de silenciado: a próxima
      // passada criaria uma segunda conta e alguém precisa saber disso.
      resultados.push({
        id: pendencia.id, status: "erro", valor: linha.valor,
        erro: `ATENÇÃO: conta ${conta.id} lançada, mas a pendência não fechou (${erroFecho.message}). Verifique antes da próxima passada.`,
      });
      continue;
    }
    resultados.push({ id: pendencia.id, status: "lancado", valor: linha.valor, contaId: conta.id });
  }

  const { data: fila } = await db.from("vw_etiqueta_financeiro_fila").select("*");
  return NextResponse.json({
    ok: true,
    origem: auth.origem,
    ...resumoDoProcessamento(resultados),
    fila: saudeDaFila(fila || []),
  });
}
