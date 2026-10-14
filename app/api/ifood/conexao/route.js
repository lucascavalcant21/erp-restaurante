import { NextResponse } from "next/server";
import { autorizarLeituraDaUnidade } from "../../../lib/server/autorizacao-unidade.mjs";
import { carregarPermissoes, permite } from "../../../lib/server/permissoes-efetivas.mjs";
import { encryptCredentials, decryptCredentials } from "../../../lib/server/crypto-vault.mjs";
import { lerConexao, salvarConexao, testarConexao, desconectar, clienteIfood } from "../../../lib/server/ifood-conexao.mjs";

// Cadastro da conexão do iFood da unidade.
//   GET  ?unidadeId=…                     situação (sem segredo)
//   POST { unidadeId, acao: "salvar", merchantId, clientId, clientSecret }
//   POST { unidadeId, acao: "testar" }    teste real no iFood
//   POST { unidadeId, acao: "desconectar" }
// Sessão verificada no Supabase, unidade pelo vínculo do usuário (não pela
// palavra do navegador) e permissão de configurar o iFood ou a marmitaria.

export const dynamic = "force-dynamic";

const VER = ["vendas.ifood.view", "marmitaria.settings.view"];
const CONFIGURAR = ["vendas.ifood.settings", "vendas.ifood.edit", "marmitaria.settings.edit", "marmitaria.settings.settings"];
const cofreConfigurado = () => String(process.env.INTEGRATION_MASTER_KEY || "").length >= 32;
const erro = (mensagem, status) => NextResponse.json({ ok: false, erro: mensagem }, { status });

async function autorizar(request, unidadeId, chaves) {
  const a = await autorizarLeituraDaUnidade(request, unidadeId);
  if (a.erro) return { resposta: erro(a.erro.mensagem, a.erro.status) };
  const perms = await carregarPermissoes(a.db, a.usuario);
  if (!permite(perms, chaves)) return { resposta: erro("Sem permissão para configurar o iFood desta unidade.", 403) };
  return a;
}

export async function GET(request) {
  const unidadeId = new URL(request.url).searchParams.get("unidadeId");
  const a = await autorizar(request, unidadeId, [...VER, ...CONFIGURAR]);
  if (a.resposta) return a.resposta;
  const r = await lerConexao(a.db, unidadeId, { cofreConfigurado: cofreConfigurado() });
  return NextResponse.json(r, { status: r.ok || r.semTabelas ? 200 : 500 });
}

export async function POST(request) {
  const corpo = await request.json().catch(() => ({}));
  const unidadeId = corpo?.unidadeId;
  const a = await autorizar(request, unidadeId, CONFIGURAR);
  if (a.resposta) return a.resposta;

  try {
    if (corpo.acao === "salvar") {
      const r = await salvarConexao(a.db, unidadeId, corpo, { cifrar: encryptCredentials, cofreConfigurado: cofreConfigurado(), quem: a.usuario?.nome || null });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (corpo.acao === "testar") {
      const r = await testarConexao(a.db, unidadeId, { decifrar: decryptCredentials, ifood: clienteIfood() });
      return NextResponse.json(r, { status: 200 });
    }
    if (corpo.acao === "desconectar") {
      return NextResponse.json(await desconectar(a.db, unidadeId), { status: 200 });
    }
    return erro("Ação desconhecida.", 400);
  } catch (e) {
    // nunca ecoa o corpo (tem segredo); só a mensagem
    return erro(`Falha no servidor: ${e?.message || "erro inesperado"}`, 500);
  }
}
