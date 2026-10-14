import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/server/supabase-server.mjs";
import { decryptCredentials } from "../../../lib/server/crypto-vault.mjs";
import { clientePedidos, sincronizarTodas } from "../../../lib/server/ifood-sync.mjs";

// Agendador: busca os eventos do iFood de TODAS as unidades conectadas, guarda,
// confirma (ACK) e processa a fila. Protegido por CRON_SECRET (falha fechada:
// sem a variável, não roda em ambiente nenhum).
//
// A documentação recomenda polling a cada 30 s. A Vercel só agenda de minuto
// em minuto (e o plano atual pode limitar a frequência); por isso o caminho
// principal é o webhook, com este polling como rede de segurança. Ver
// docs/brain/07_RELATORIOS/IFOOD_PEDIDOS_2026-10-14.md.

export const dynamic = "force-dynamic";
const ifood = clientePedidos();

export async function GET(request) {
  const segredo = process.env.CRON_SECRET;
  if (!segredo) return NextResponse.json({ ok: false, erro: "CRON_SECRET não configurado." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${segredo}`) return NextResponse.json({ ok: false, erro: "não autorizado" }, { status: 401 });
  let db;
  try { db = getSupabaseServerClient(); } catch { return NextResponse.json({ ok: false, erro: "Servidor sem credencial do banco." }, { status: 503 }); }
  const r = await sincronizarTodas(db, { decifrar: decryptCredentials, ifood });
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
