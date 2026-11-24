import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { getSupabaseServerClient } from "../../../lib/server/supabase-server.mjs";

// Login do paciente gerado pelo médico (dono, 21/11/2026). A equipe do
// consultório pede; o servidor cria (ou troca a senha de) um login no Auth
// ligado ao paciente. A senha aparece uma vez só, para entregar ao paciente.
// Quem pede precisa ter acesso ao consultório (checado com o login dela, RLS).
// Falha fechada: sem a chave de serviço no servidor, nada é criado.

const DOMINIO = "pacientes.hefisto.app";
const LETRAS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const senhaTemporaria = () => [...randomBytes(10)].map((b) => LETRAS[b % LETRAS.length]).join("");

export async function POST(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token) return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });
  if (!url || !anon) return NextResponse.json({ error: "Servidor sem configuração do banco." }, { status: 503 });
  const doUsuario = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });

  let corpo = {};
  try { corpo = await request.json(); } catch { /* vazio */ }
  const pacienteId = String(corpo.paciente_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(pacienteId)) return NextResponse.json({ error: "Paciente inválido." }, { status: 400 });

  const { data: pode } = await doUsuario.rpc("cons_pode_acessar", { p_unidade_id: "consultorio" });
  if (!pode) return NextResponse.json({ error: "Sem acesso ao consultório." }, { status: 403 });
  // Lido com o login de quem pede: se a RLS não mostra, não é desta equipe.
  const { data: paciente } = await doUsuario.from("cons_pacientes").select("id, nome, cpf, email, auth_user_id, login, ativo").eq("id", pacienteId).maybeSingle();
  if (!paciente || !paciente.ativo) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  let admin;
  try { admin = getSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "O servidor ainda não tem a chave de serviço (SUPABASE_SERVICE_ROLE_KEY) para criar logins.", semChave: true }, { status: 503 }); }

  const senha = senhaTemporaria();
  const login = paciente.login || (paciente.cpf ? paciente.cpf : `p${paciente.id.replace(/-/g, "").slice(0, 10)}`);
  if (paciente.auth_user_id) {
    const { error } = await admin.auth.admin.updateUserById(paciente.auth_user_id, { password: senha });
    if (error) return NextResponse.json({ error: "Não consegui trocar a senha." }, { status: 500 });
    return NextResponse.json({ login, senha, nova: false });
  }
  const { data: criado, error } = await admin.auth.admin.createUser({
    email: `${login.toLowerCase()}@${DOMINIO}`, password: senha, email_confirm: true,
    user_metadata: { tipo: "paciente_consultorio", nome: paciente.nome },
    app_metadata: { tipo: "paciente_consultorio" },
  });
  if (error || !criado?.user?.id) {
    const repetido = /already|registered|exists/i.test(error?.message || "");
    return NextResponse.json({ error: repetido ? "Já existe um login com esse CPF." : "Não consegui criar o login." }, { status: repetido ? 409 : 500 });
  }
  const { error: erroVinculo } = await admin.from("cons_pacientes").update({ auth_user_id: criado.user.id, login }).eq("id", paciente.id);
  if (erroVinculo) {
    await admin.auth.admin.deleteUser(criado.user.id).catch(() => {});
    return NextResponse.json({ error: "Não consegui ligar o login ao paciente." }, { status: 500 });
  }
  return NextResponse.json({ login, senha, nova: true });
}
