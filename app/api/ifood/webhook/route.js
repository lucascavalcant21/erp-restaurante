import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/server/supabase-server.mjs";
import { decryptCredentials } from "../../../lib/server/crypto-vault.mjs";
import { receberWebhook } from "../../../lib/server/ifood-sync.mjs";

// Webhook do iFood (eventos de pedido). Só para aplicativos centralizados,
// cadastrado no Portal do Desenvolvedor com a URL desta rota.
// Valida a assinatura sobre o corpo cru com o Client Secret de cada unidade
// conectada; guarda e responde 202 rápido (a documentação pede < 2 s). O
// processamento é feito pela fila (/api/ifood/poll e "Sincronizar agora").
// Nunca devolve detalhe de erro nem ecoa o corpo.

export const dynamic = "force-dynamic";

export async function POST(request) {
  const corpoBruto = await request.text();
  let db;
  try { db = getSupabaseServerClient(); } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
  try {
    const r = await receberWebhook(db, { corpoBruto, assinatura: request.headers.get("x-ifood-signature"), decifrar: decryptCredentials });
    return NextResponse.json(r.corpo, { status: r.status });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, provider: "IFOOD" });
}
