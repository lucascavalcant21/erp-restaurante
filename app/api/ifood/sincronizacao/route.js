import { NextResponse } from "next/server";
import { autorizarLeituraDaUnidade } from "../../../lib/server/autorizacao-unidade.mjs";
import { carregarPermissoes, permite } from "../../../lib/server/permissoes-efetivas.mjs";
import { decryptCredentials } from "../../../lib/server/crypto-vault.mjs";
import { clientePedidos, sincronizarUnidade, reprocessar, resumoSincronizacao, salvarPreferencias } from "../../../lib/server/ifood-sync.mjs";

// Sincronização dos pedidos do iFood da unidade.
//   GET  ?unidadeId=…                                situação + histórico (sem segredo)
//   POST { unidadeId, acao: "sincronizar" }           busca agora (polling + fila)
//   POST { unidadeId, acao: "reprocessar", eventoIds? }
//   POST { unidadeId, acao: "preferencias", baixaEstoque: "producao" | "pedido" }
// Sessão verificada no Supabase, unidade pelo vínculo do usuário e permissão.

export const dynamic = "force-dynamic";
const ifood = clientePedidos();

const VER = ["vendas.ifood.view", "marmitaria.settings.view", "marmitaria.stock.view", "marmitaria.overview.view"];
const OPERAR = ["vendas.ifood.edit", "vendas.ifood.settings", "marmitaria.settings.edit", "marmitaria.settings.settings", "marmitaria.stock.edit"];
const CONFIGURAR = ["vendas.ifood.settings", "vendas.ifood.edit", "marmitaria.settings.edit", "marmitaria.settings.settings"];
const erro = (mensagem, status) => NextResponse.json({ ok: false, erro: mensagem }, { status });

async function autorizar(request, unidadeId, chaves) {
  const a = await autorizarLeituraDaUnidade(request, unidadeId);
  if (a.erro) return { resposta: erro(a.erro.mensagem, a.erro.status) };
  const perms = await carregarPermissoes(a.db, a.usuario);
  if (!permite(perms, chaves)) return { resposta: erro("Sem permissão para esta ação do iFood nesta unidade.", 403) };
  return a;
}

export async function GET(request) {
  const unidadeId = new URL(request.url).searchParams.get("unidadeId");
  const a = await autorizar(request, unidadeId, [...VER, ...OPERAR]);
  if (a.resposta) return a.resposta;
  const r = await resumoSincronizacao(a.db, unidadeId);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}

export async function POST(request) {
  const corpo = await request.json().catch(() => ({}));
  const unidadeId = corpo?.unidadeId;
  const acao = corpo?.acao;
  const a = await autorizar(request, unidadeId, acao === "preferencias" ? CONFIGURAR : OPERAR);
  if (a.resposta) return a.resposta;
  try {
    if (acao === "sincronizar") {
      const r = await sincronizarUnidade(a.db, { unidadeId, decifrar: decryptCredentials, ifood });
      return NextResponse.json(r, { status: 200 });
    }
    if (acao === "reprocessar") {
      const ids = Array.isArray(corpo.eventoIds) ? corpo.eventoIds.filter((x) => typeof x === "string").slice(0, 500) : null;
      return NextResponse.json(await reprocessar(a.db, { unidadeId, eventoIds: ids }), { status: 200 });
    }
    if (acao === "preferencias") {
      const r = await salvarPreferencias(a.db, unidadeId, { baixaEstoque: corpo.baixaEstoque });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    return erro("Ação desconhecida.", 400);
  } catch {
    return erro("Falha no servidor ao sincronizar o iFood.", 500);
  }
}
