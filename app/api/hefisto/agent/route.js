import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { responderComHefisto, MENSAGEM_INDISPONIVEL } from "../../../lib/hefisto-ai/agente.mjs";
import { criarProvedorOpenAI } from "../../../lib/hefisto-ai/provedor-openai";
import { configuracaoDoAmbiente, diagnosticoDeSessao } from "../../../lib/hefisto-ai/sessao.mjs";

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

const texto = (v) => String(v ?? "").trim();

function clienteDoUsuario(config, token) {
  return createClient(config.url, config.anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/* Diagnóstico sem segredo: só diz em que projeto o servidor está e se a IA
   está configurada. Serve para conferir se o Preview está com as mesmas
   variáveis do cliente. */
export async function GET() {
  const config = configuracaoDoAmbiente();
  return NextResponse.json({
    rota: "/api/hefisto/agent",
    supabase_configurado: config.faltando.length === 0,
    faltando: config.faltando,
    project_ref: config.projectRef || null,
    ia_configurada: !!texto(process.env.OPENAI_API_KEY),
    modelo: texto(process.env.OPENAI_MODEL) || null,
  });
}

export async function POST(request) {
  let corpo;
  try { corpo = await request.json(); } catch { return NextResponse.json({ error: "Dados inválidos." }, { status: 400 }); }

  const mensagem = texto(corpo?.mensagem);
  if (!mensagem) return NextResponse.json({ error: "Diga o que você precisa." }, { status: 400 });

  /* Ordem do diagnóstico: primeiro o que é culpa do ambiente (503), depois o
     que é culpa da sessão (401). Antes, servidor sem variável devolvia
     "Sessão ausente" e parecia problema de login. */
  const config = configuracaoDoAmbiente();
  const token = texto(request.headers.get("authorization")?.replace(/^Bearer\s+/i, ""));
  const triagem = diagnosticoDeSessao({ config, token });
  if (!triagem.ok) {
    /* Log sem token: só o diagnóstico e, quando for o caso, os dois refs. */
    console.error("[hefisto-agent]", triagem.corpo.diagnostico, triagem.corpo.faltando?.join(", ") || triagem.corpo.projeto_do_token || "");
    return NextResponse.json(triagem.corpo, { status: triagem.status });
  }

  const cliente = clienteDoUsuario(config, token);
  const { data: auth, error: erroAuth } = await cliente.auth.getUser(token);
  if (erroAuth || !auth?.user) {
    return NextResponse.json({
      error: "Sessão inválida ou expirada.",
      diagnostico: "token_invalido",
      motivo: texto(erroAuth?.message).slice(0, 120) || null,
    }, { status: 401 });
  }

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
