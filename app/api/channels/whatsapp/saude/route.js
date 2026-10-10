// Saúde do canal WhatsApp (HDEV-WA-COEX-001). Mesma autenticação da ponte:
// Authorization: Bearer <WHATSAPP_PONTE_SEGREDO>. Nunca devolve segredo:
// só configurado sim/não, contagens, números mascarados e estados.
import { timingSafeEqual } from "node:crypto";
import { configuracao, numerosYCloud } from "../../../../lib/whatsapp/saude.mjs";
import { getSupabaseServerClient } from "../../../../lib/server/supabase-server.mjs";
import { dentroDoLimite } from "../../../../lib/server/limite-por-ip.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SEM_CACHE = { "Cache-Control": "no-store" };
const json = (corpo, status = 200) => Response.json(corpo, { status, headers: SEM_CACHE });

function autorizada(request) {
  const segredo = process.env.WHATSAPP_PONTE_SEGREDO || "";
  if (segredo.length < 32) return false;
  const dado = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(dado), b = Buffer.from(segredo);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function banco() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { disponivel: false };
  try {
    const db = getSupabaseServerClient();
    const desde = new Date(Date.now() - 24 * 3600_000).toISOString();
    const out = { disponivel: true };
    const ev = await db.from("whatsapp_eventos").select("direcao,status,resultado,erro_codigo").gte("criado_em", desde).limit(500);
    if (ev.error) out.auditoria = { tabela: false };
    else {
      const cont = {};
      for (const r of ev.data) { const k = `${r.direcao}:${r.status || r.resultado || "-"}`; cont[k] = (cont[k] || 0) + 1; }
      out.auditoria = { tabela: true, ultimas24h: cont, erros: [...new Set(ev.data.map((r) => r.erro_codigo).filter(Boolean))].slice(0, 10) };
    }
    const fila = await db.from("whatsapp_comandos").select("status").in("status", ["PENDENTE", "EM_EXECUCAO"]).limit(100);
    out.filaPendente = fila.error ? null : fila.data.length;
    const ponte = await db.from("whatsapp_ponte").select("visto_em").eq("id", 1).maybeSingle();
    out.ponteVistaHaS = ponte.data?.visto_em ? Math.round((Date.now() - Date.parse(ponte.data.visto_em)) / 1000) : null;
    return out;
  } catch {
    return { disponivel: false };
  }
}

export async function GET(request) {
  if (!dentroDoLimite("wa-saude", { maximo: 20, janelaMs: 60_000 })) return json({ erro: "limite" }, 429);
  if (!autorizada(request)) return json({ erro: "não autorizada" }, 401);
  const [b, yc] = await Promise.all([banco(), numerosYCloud()]);
  return json({ config: configuracao(), banco: b, ycloud: yc, em: new Date().toISOString() });
}
