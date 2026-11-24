import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

// Cria a sala de vídeo da teleconsulta no Whereby (dono, 21/11/2026).
// A chave WHEREBY_API_KEY fica só no servidor. Quem chama precisa ter acesso
// ao consultório: a verificação usa o próprio login da pessoa (RLS do banco,
// cons_pode_acessar), sem service role. Sem a chave, responde 501 e a tela
// oferece colar o link de uma sala criada à mão.

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const codigo = () => [...randomBytes(40)].map((b) => ALFABETO[b % ALFABETO.length]).join("");

export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token) return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  if (!url || !anon) return NextResponse.json({ error: "Servidor sem configuração do banco." }, { status: 503 });
  const db = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

  let corpo = {};
  try { corpo = await request.json(); } catch { /* corpo vazio */ }
  const consultaId = String(corpo.consulta_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(consultaId)) return NextResponse.json({ error: "Consulta inválida." }, { status: 400 });

  const { data: pode, error: erroAcesso } = await db.rpc("cons_pode_acessar", { p_unidade_id: "consultorio" });
  if (erroAcesso || !pode) return NextResponse.json({ error: "Sem acesso ao consultório." }, { status: 403 });
  const { data: consulta } = await db.from("cons_consultas").select("id, unidade_id, fim, modalidade, status").eq("id", consultaId).maybeSingle();
  if (!consulta) return NextResponse.json({ error: "Consulta não encontrada." }, { status: 404 });
  if (["cancelada", "faltou", "atendida"].includes(consulta.status)) return NextResponse.json({ error: "Esta consulta não está mais aberta." }, { status: 409 });

  const termo = { versao: String(corpo.termo_versao || "").slice(0, 60), texto: String(corpo.termo_texto || "").slice(0, 8000) };
  if (!termo.versao || termo.texto.length < 50) return NextResponse.json({ error: "Termo de telemedicina ausente." }, { status: 400 });

  const chave = process.env.WHEREBY_API_KEY;
  if (!chave) return NextResponse.json({ error: "Falta a chave do Whereby no servidor (WHEREBY_API_KEY).", semChave: true }, { status: 501 });

  // Sala some sozinha 1 h depois do fim; damos 3 h de folga para atrasos.
  const endDate = new Date(new Date(consulta.fim).getTime() + 3 * 3600000).toISOString();
  let sala;
  try {
    const r = await fetch("https://api.whereby.dev/v1/meetings", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ endDate, fields: ["hostRoomUrl"], roomNamePrefix: "consulta" }),
    });
    if (!r.ok) {
      console.error("[teleconsulta] Whereby respondeu", r.status);
      return NextResponse.json({ error: `O Whereby recusou criar a sala (${r.status}).` }, { status: 502 });
    }
    sala = await r.json();
  } catch {
    return NextResponse.json({ error: "Não consegui falar com o Whereby." }, { status: 502 });
  }

  const linha = { consulta_id: consulta.id, unidade_id: consulta.unidade_id, provedor: "whereby", sala_url: sala.roomUrl, sala_medico_url: sala.hostRoomUrl || null, sala_id: sala.meetingId || null, termo_versao: termo.versao, termo_texto: termo.texto };
  const { data: existente } = await db.from("cons_teleconsultas").select("codigo").eq("consulta_id", consulta.id).maybeSingle();
  const { data, error } = existente
    ? await db.from("cons_teleconsultas").update(linha).eq("consulta_id", consulta.id).select("*").maybeSingle()
    : await db.from("cons_teleconsultas").insert({ ...linha, codigo: codigo() }).select("*").maybeSingle();
  if (error) return NextResponse.json({ error: "A sala foi criada, mas não consegui guardar." }, { status: 500 });
  if (consulta.modalidade !== "teleconsulta") await db.from("cons_consultas").update({ modalidade: "teleconsulta" }).eq("id", consulta.id);
  return NextResponse.json({ teleconsulta: data });
}
