import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { responderComHefisto, MENSAGEM_INDISPONIVEL } from "../../../lib/hefisto-ai/agente.mjs";
import { criarProvedorOpenAI } from "../../../lib/hefisto-ai/provedor-openai";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* Rota do Héfisto com IA. Somente leitura.
 *
 * Quem é a pessoa, o que ela pode ver e em que unidade ela está NÃO vem do
 * frontend: vem do token dela. O frontend manda a pergunta e o contexto da
 * tela; o resto o servidor descobre sozinho.
 *
 * O cliente do Supabase é criado com a chave anônima MAIS o token do usuário,
 * então toda consulta de ferramenta passa pelo RLS como se fosse ela mesma
 * navegando. Service role não entra aqui.
 */

function clienteDoUsuario(token) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon || !token) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

const texto = (v) => String(v ?? "").trim();

export async function POST(request) {
  let corpo;
  try { corpo = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }

  const mensagem = texto(corpo?.mensagem);
  if (!mensagem) return NextResponse.json({ error: "Diga o que você precisa." }, { status: 400 });

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cliente = clienteDoUsuario(token);
  if (!cliente) return NextResponse.json({ error: "Sessão ausente." }, { status: 401 });

  const { data: auth, error: erroAuth } = await cliente.auth.getUser(token);
  if (erroAuth || !auth?.user) return NextResponse.json({ error: "Sessão inválida ou expirada." }, { status: 401 });

  /* Papel, permissões e unidade saem do cadastro do servidor. Se o contexto
     não vier, a sessão fica sem permissão nenhuma e só sobra navegação. */
  let sessao = { id: auth.user.id, gerenciado: false, permissions: [] };
  try {
    const { data } = await cliente.rpc("hefisto_session_context");
    if (data && data.status === "ativo") sessao = { ...data, id: auth.user.id, gerenciado: true };
  } catch {
    /* RBAC ainda não instalado neste ambiente: segue sem permissões. */
  }

  /* A unidade pedida pelo frontend só vale se for a do cadastro ou se a pessoa
     enxerga a rede inteira. */
  const pedida = texto(corpo?.contexto?.unidadeId);
  const daSessao = texto(sessao.unidade);
  const veRede = sessao.super_admin === true || sessao.permissions === "*";
  const unidadeId = pedida && (veRede || pedida === daSessao) ? pedida : daSessao;

  const provedor = criarProvedorOpenAI();
  if (!provedor) {
    return NextResponse.json({ ok: false, tipo: "INDISPONIVEL", texto: MENSAGEM_INDISPONIVEL }, { status: 503 });
  }

  const contexto = {
    unidadeId,
    unidadeNome: texto(corpo?.contexto?.unidadeNome) || null,
    rota: texto(corpo?.contexto?.rota).slice(0, 120) || null,
    modulo: texto(corpo?.contexto?.modulo).slice(0, 60) || null,
    entidade: texto(corpo?.contexto?.entidade).slice(0, 120) || null,
    setor: ["cozinha", "bar"].includes(texto(corpo?.contexto?.setor)) ? texto(corpo.contexto.setor) : null,
  };

  const resultado = await responderComHefisto({
    mensagem: mensagem.slice(0, 2000),
    contexto,
    sessao,
    unidadeId,
    cliente,
    provedor,
  });

  if (resultado.tipo === "INDISPONIVEL") {
    console.error("[hefisto-agent]", resultado.detalhe || "provedor indisponível");
    return NextResponse.json({ ok: false, tipo: "INDISPONIVEL", texto: MENSAGEM_INDISPONIVEL }, { status: 503 });
  }

  return NextResponse.json({
    ok: resultado.ok,
    tipo: resultado.tipo,
    texto: resultado.texto,
    rota: resultado.rota || null,
    ferramentas: (resultado.ferramentas || []).map((f) => f.id),
  });
}
