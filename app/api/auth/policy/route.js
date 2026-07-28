import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function service() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sezccspqxgklicfndwxx.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

const genericDenied = () => NextResponse.json({ ok: false, error: "Usuário ou senha incorretos." }, { status: 403 });
const privateIp = (ip = "") =>
  ip === "127.0.0.1" || ip === "::1" || /^10\./.test(ip) || /^192\.168\./.test(ip) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(ip);

export async function POST(request) {
  const db = service();
  // Compatibilidade durante a instalação da migração: o Auth continua operando,
  // mas as políticas avançadas só são aplicadas quando a chave do servidor existe.
  if (!db) return NextResponse.json({ ok: true, managed: false });
  let body;
  try { body = await request.json(); } catch { return genericDenied(); }
  const login = String(body.login || "").trim().toLowerCase();
  if (!login) return genericDenied();
  if (!/^[a-z0-9._@+-]+$/i.test(login)) return genericDenied();
  const { data: user } = await db.from("usuarios_erp").select("*").eq("login", login).maybeSingle();
  if (!user) return NextResponse.json({ ok: true, managed: false });

  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  const now = new Date();
  if (body.event === "failure") {
    const failures = Number(user.failed_attempts || 0) + 1;
    const blocked = failures >= Number(user.max_failed_attempts || 5);
    await db.from("usuarios_erp").update({
      failed_attempts: failures,
      locked_until: blocked ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : user.locked_until,
      status: blocked ? "bloqueado" : user.status,
    }).eq("id", user.id);
    await db.from("acessos_auditoria").insert({
      usuario_id: user.id, auth_user_id: user.auth_user_id, evento: "login_falhou", sucesso: false,
      ip, user_agent: request.headers.get("user-agent"), device_id: body.deviceId || null,
    });
    return genericDenied();
  }

  const local = new Date(now.toLocaleString("en-US", { timeZone: user.timezone || "America/Sao_Paulo" }));
  const day = local.getDay();
  const hhmm = local.toTimeString().slice(0, 5);
  const deviceIds = Array.isArray(user.allowed_device_ids) ? user.allowed_device_ids : [];
  const allowedIps = Array.isArray(user.allowed_ips) ? user.allowed_ips : [];
  const denied =
    user.status !== "ativo" ||
    (user.locked_until && new Date(user.locked_until) > now) ||
    (user.valid_from && new Date(user.valid_from) > now) ||
    (user.valid_until && new Date(user.valid_until) < now) ||
    (Array.isArray(user.allowed_days) && !user.allowed_days.includes(day)) ||
    (user.allowed_start_time && hhmm < user.allowed_start_time.slice(0, 5)) ||
    (user.allowed_end_time && hhmm > user.allowed_end_time.slice(0, 5)) ||
    (deviceIds.length && !deviceIds.includes(body.deviceId)) ||
    (!user.acesso_externo && !privateIp(ip) && !allowedIps.includes(ip));
  if (denied) {
    await db.from("acessos_auditoria").insert({
      usuario_id: user.id, auth_user_id: user.auth_user_id, evento: "login_bloqueado_por_politica",
      sucesso: false, ip, user_agent: request.headers.get("user-agent"), device_id: body.deviceId || null,
    });
    return genericDenied();
  }
  return NextResponse.json({ ok: true, managed: true });
}

export async function PUT(request) {
  const db = service();
  if (!db) return NextResponse.json({ ok: true });
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: auth } = await db.auth.getUser(token);
  if (!auth?.user) return genericDenied();
  const body = await request.json().catch(() => ({}));
  const { data: user } = await db.from("usuarios_erp").select("*").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!user) return NextResponse.json({ ok: true });
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
  await db.from("usuarios_erp").update({ failed_attempts: 0, locked_until: null, ultimo_acesso_em: new Date().toISOString() }).eq("id", user.id);
  await db.from("acessos_auditoria").insert({
    usuario_id: user.id, auth_user_id: auth.user.id, evento: "login_sucesso", sucesso: true,
    ip, user_agent: request.headers.get("user-agent"), device_id: body.deviceId || null,
  });
  return NextResponse.json({ ok: true });
}
