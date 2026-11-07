import { NextResponse } from "next/server";
import { autorizarLeituraDaUnidade } from "../../../lib/server/autorizacao-unidade.mjs";
import { carregarPermissoes, permite } from "../../../lib/server/permissoes-efetivas.mjs";
import {
  lerPainel, parearTela, salvarTela, trocarConteudo, desconectarTela, excluirTela,
  prepararEnvio, registrarMidia, renomearMidia, excluirMidia,
  salvarPlaylist, excluirPlaylist, salvarProgramacao, excluirProgramacao,
} from "../../../lib/server/sinalizacao.mjs";

// Painel da Sinalização digital (TVs de marketing).
//   GET  ?unidadeId=…                 telas, mídias, playlists, programação
//   POST { unidadeId, acao, … }       ações abaixo
// Sessão verificada no Supabase, unidade pelo vínculo do usuário (nunca pela
// palavra do navegador) e permissão clientes.signage.* (catálogo de permissões).

export const dynamic = "force-dynamic";

const VER = ["clientes.signage.view"];
const CRIAR = ["clientes.signage.create"];
const EDITAR = ["clientes.signage.edit"];
const EXCLUIR = ["clientes.signage.delete"];

const ACOES = {
  parear: { chaves: CRIAR, f: (a, c, o) => parearTela(a.db, c.unidadeId, c, o) },
  salvar_tela: { chaves: EDITAR, f: (a, c) => salvarTela(a.db, c.unidadeId, c) },
  trocar_conteudo: { chaves: EDITAR, f: (a, c) => trocarConteudo(a.db, c.unidadeId, c) },
  desconectar_tela: { chaves: EDITAR, f: (a, c) => desconectarTela(a.db, c.unidadeId, c.id) },
  excluir_tela: { chaves: EXCLUIR, f: (a, c) => excluirTela(a.db, c.unidadeId, c.id) },
  preparar_envio: { chaves: CRIAR, f: (a, c) => prepararEnvio(a.db, c.unidadeId, c) },
  registrar_midia: { chaves: CRIAR, f: (a, c, o) => registrarMidia(a.db, c.unidadeId, c, o) },
  renomear_midia: { chaves: EDITAR, f: (a, c) => renomearMidia(a.db, c.unidadeId, c) },
  excluir_midia: { chaves: EXCLUIR, f: (a, c) => excluirMidia(a.db, c.unidadeId, c.id) },
  salvar_playlist: { chaves: [...CRIAR, ...EDITAR], f: (a, c, o) => salvarPlaylist(a.db, c.unidadeId, c, o) },
  excluir_playlist: { chaves: EXCLUIR, f: (a, c) => excluirPlaylist(a.db, c.unidadeId, c.id) },
  salvar_programacao: { chaves: [...CRIAR, ...EDITAR], f: (a, c, o) => salvarProgramacao(a.db, c.unidadeId, c, o) },
  excluir_programacao: { chaves: EXCLUIR, f: (a, c) => excluirProgramacao(a.db, c.unidadeId, c.id) },
};

const erro = (mensagem, status) => NextResponse.json({ ok: false, erro: mensagem }, { status });
const responder = (r) => NextResponse.json(r, { status: r.ok || r.semTabelas ? 200 : r.status || 500 });

async function autorizar(request, unidadeId, chaves) {
  const a = await autorizarLeituraDaUnidade(request, unidadeId);
  if (a.erro) return { resposta: erro(a.erro.mensagem, a.erro.status) };
  const perms = await carregarPermissoes(a.db, a.usuario);
  if (!permite(perms, chaves)) return { resposta: erro("Sem permissão para esta ação na Sinalização digital.", 403) };
  return a;
}

export async function GET(request) {
  const unidadeId = new URL(request.url).searchParams.get("unidadeId");
  const a = await autorizar(request, unidadeId, VER);
  if (a.resposta) return a.resposta;
  return responder(await lerPainel(a.db, unidadeId));
}

export async function POST(request) {
  const corpo = await request.json().catch(() => null);
  if (!corpo || typeof corpo !== "object") return erro("Pedido inválido.", 400);
  const acao = ACOES[corpo.acao];
  if (!acao) return erro("Ação desconhecida.", 400);
  const a = await autorizar(request, corpo.unidadeId, acao.chaves);
  if (a.resposta) return a.resposta;
  try {
    return responder(await acao.f(a, corpo, { quem: a.usuario?.nome || null }));
  } catch (e) {
    return erro("Falha no servidor ao executar a ação.", 500);
  }
}
