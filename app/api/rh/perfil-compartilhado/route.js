import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CAMPOS_EDITAVEIS = [
  "nome", "telefone", "email", "cpf", "rg", "data_nascimento", "genero",
  "estado_civil", "escolaridade", "cidade_nascimento", "rua_av", "numero_casa",
  "bairro", "cidade_uf", "cep", "nome_pai", "nome_mae", "filhos", "chave_pix",
  "tem_transporte", "tipo_transporte", "usa_vale_transporte", "tem_filhos",
];

const CAMPOS_OBRIGATORIOS = [
  "nome", "telefone", "email", "cpf", "rg", "data_nascimento", "genero",
  "estado_civil", "escolaridade", "cidade_nascimento", "rua_av", "numero_casa",
  "bairro", "cidade_uf", "cep", "nome_pai", "nome_mae", "chave_pix",
];

function clientes() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon) return {};
  const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
  return {
    auth: createClient(url, anon, opcoes),
    db: createClient(url, service || anon, opcoes),
  };
}

function segredo() {
  return process.env.RH_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.FIREBASE_PRIVATE_KEY || "";
}

function assinatura(conteudo) {
  return createHmac("sha256", segredo()).update(conteudo).digest("base64url");
}

function criarToken(colaboradorId) {
  const payload = Buffer.from(JSON.stringify({
    id: colaboradorId,
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
    nonce: randomBytes(12).toString("hex"),
  })).toString("base64url");
  return `${payload}.${assinatura(payload)}`;
}

function validarToken(token) {
  if (!segredo() || !token || !token.includes(".")) return null;
  const [payload, recebida] = token.split(".");
  const esperada = assinatura(payload);
  const a = Buffer.from(recebida || "");
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!dados.id || !dados.exp || Date.now() > Number(dados.exp)) return null;
    return dados;
  } catch { return null; }
}

function perfilPublico(colaborador) {
  const perfil = { cargo: colaborador?.cargo || "", unidade_id: colaborador?.unidade_id || "" };
  for (const campo of CAMPOS_EDITAVEIS) perfil[campo] = colaborador?.[campo] ?? (campo === "filhos" ? [] : "");
  return perfil;
}

export async function POST(request) {
  const { auth, db } = clientes();
  if (!auth || !db || !segredo()) return NextResponse.json({ error: "Compartilhamento não configurado no servidor." }, { status: 503 });
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const { data: sessao } = await auth.auth.getUser(bearer);
  if (!sessao?.user) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const colaboradorId = String(body.colaboradorId || "");
  const { data: colaborador } = await db.from("colaboradores").select("id").eq("id", colaboradorId).maybeSingle();
  if (!colaborador) return NextResponse.json({ error: "Funcionário não encontrado." }, { status: 404 });
  const token = criarToken(colaboradorId);
  const origem = new URL(request.url).origin;
  return NextResponse.json({ url: `${origem}/rh/atualizar/${encodeURIComponent(token)}`, expiraEm: new Date(Date.now() + 30 * 86400000).toISOString() });
}

export async function GET(request) {
  const { db } = clientes();
  const token = new URL(request.url).searchParams.get("token");
  const dados = validarToken(token);
  if (!db || !dados) return NextResponse.json({ error: "Link inválido ou vencido." }, { status: 401 });
  const { data, error } = await db.from("colaboradores").select("*").eq("id", dados.id).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
  return NextResponse.json({ perfil: perfilPublico(data), expiraEm: new Date(dados.exp).toISOString() });
}

export async function PATCH(request) {
  const { db } = clientes();
  const body = await request.json().catch(() => ({}));
  const dados = validarToken(body.token);
  if (!db || !dados) return NextResponse.json({ error: "Link inválido ou vencido." }, { status: 401 });
  const atualizacao = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (Object.prototype.hasOwnProperty.call(body.perfil || {}, campo)) atualizacao[campo] = body.perfil[campo];
  }
  const ausentes = CAMPOS_OBRIGATORIOS.filter(campo => !String(atualizacao[campo] ?? "").trim());
  if (ausentes.length) return NextResponse.json({ error: "Preencha todas as perguntas obrigatórias." }, { status: 400 });
  if (typeof atualizacao.tem_transporte !== "boolean" || typeof atualizacao.usa_vale_transporte !== "boolean" || typeof atualizacao.tem_filhos !== "boolean") {
    return NextResponse.json({ error: "Responda todas as perguntas de transporte e dependentes." }, { status: 400 });
  }
  if (atualizacao.tem_transporte && !String(atualizacao.tipo_transporte || "").trim()) {
    return NextResponse.json({ error: "Informe o tipo de transporte." }, { status: 400 });
  }
  atualizacao.filhos = Array.isArray(atualizacao.filhos) ? atualizacao.filhos.filter(item => String(item?.nome || "").trim()) : [];
  if (atualizacao.tem_filhos && (!atualizacao.filhos.length || atualizacao.filhos.some(item => !String(item?.data_nascimento || "").trim()))) {
    return NextResponse.json({ error: "Informe o nome e a data de nascimento de todos os filhos ou dependentes." }, { status: 400 });
  }
  if (!atualizacao.tem_filhos) atualizacao.filhos = [];
  atualizacao.qtd_filhos = atualizacao.filhos.length;
  const { error } = await db.from("colaboradores").update(atualizacao).eq("id", dados.id);
  if (error) return NextResponse.json({ error: "Não foi possível salvar os dados." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
