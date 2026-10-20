import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/server/supabase-server.mjs";

export const dynamic = "force-dynamic";

function adminClient() {
  try {
    return getSupabaseServerClient();
  } catch {
    return null;
  }
}

// Em memória caso o banco esteja indisponível
let logsEmMemoria = [];

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const unidadeId = searchParams.get("unidade") || "matriz";
  const db = adminClient();

  if (db) {
    try {
      // 1. Tenta carregar de acessos_auditoria do Supabase
      const { data: logsBanco, error } = await db
        .from("acessos_auditoria")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (!error && Array.isArray(logsBanco) && logsBanco.length > 0) {
        const formatados = logsBanco.map((l) => ({
          id: l.id,
          app_id: l.usuario_id || "sistema",
          app_nome: l.app_nome || "App Hefisto",
          login: l.login || "login",
          unidade_id: unidadeId,
          sucesso: l.sucesso !== false,
          evento: l.evento || "login",
          timestamp: l.created_at,
          ip: l.ip || "Rede Local",
          dispositivo: l.user_agent ? parseUa(l.user_agent).dispositivo : "Dispositivo",
          navegador: l.user_agent ? parseUa(l.user_agent).navegador : "Navegador",
          local: `Unidade ${unidadeId === "matriz" ? "Matriz" : unidadeId}`,
        }));
        return NextResponse.json({ logs: formatados });
      }
    } catch (_) {}
  }

  return NextResponse.json({ logs: logsEmMemoria });
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = (forwarded ? forwarded.split(",")[0] : request.headers.get("x-real-ip")) || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || "";
  const infoUa = parseUa(userAgent);

  const novoLog = {
    id: body.id || `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    app_id: body.app_id || "sistema",
    app_nome: body.app_nome || "App Hefisto",
    login: body.login || "desconhecido",
    unidade_id: body.unidade_id || "matriz",
    sucesso: body.sucesso !== false,
    evento: body.evento || "acesso",
    detalhes: body.detalhes || "",
    timestamp: new Date().toISOString(),
    ip,
    dispositivo: body.dispositivo || infoUa.dispositivo,
    navegador: body.navegador || infoUa.navegador,
    tipoTela: body.tipoTela || infoUa.tipoTela,
    local: body.local || `Unidade ${body.unidade_id === "matriz" ? "Matriz" : body.unidade_id || "Local"} · IP ${ip}`,
  };

  // Guarda em memória
  logsEmMemoria = [novoLog, ...logsEmMemoria].slice(0, 500);

  // Tenta persistir no Supabase se disponível
  const db = adminClient();
  if (db) {
    try {
      await db.from("acessos_auditoria").insert({
        evento: novoLog.evento,
        sucesso: novoLog.sucesso,
        ip: novoLog.ip,
        user_agent: userAgent,
        device_id: novoLog.app_id,
      });
    } catch (_) {}
  }

  return NextResponse.json({ ok: true, log: novoLog });
}

function parseUa(ua = "") {
  let dispositivo = "Computador / Desktop";
  let tipoTela = "Desktop";

  if (/ipad/i.test(ua)) {
    dispositivo = "Apple iPad";
    tipoTela = "Tablet";
  } else if (/tablet|(android(?!.*mobile))/i.test(ua)) {
    dispositivo = "Tablet Android";
    tipoTela = "Tablet";
  } else if (/iphone/i.test(ua)) {
    dispositivo = "Apple iPhone";
    tipoTela = "Smartphone";
  } else if (/mobile|android/i.test(ua)) {
    dispositivo = "Celular Android";
    tipoTela = "Smartphone";
  } else if (/windows/i.test(ua)) {
    dispositivo = "Computador Windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    dispositivo = "Apple Mac";
  } else if (/linux/i.test(ua)) {
    dispositivo = "Terminal Linux";
  }

  let navegador = "Navegador Web";
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) navegador = "Google Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) navegador = "Apple Safari";
  else if (/firefox/i.test(ua)) navegador = "Mozilla Firefox";
  else if (/edg/i.test(ua)) navegador = "Microsoft Edge";

  return { dispositivo, navegador, tipoTela };
}
