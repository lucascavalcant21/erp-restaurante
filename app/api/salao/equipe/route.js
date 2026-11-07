// EQUIPE DO SALÃO (07/11/2026): o caixa liga ou desliga, para cada garçom,
// "trocar e juntar mesas" e "cancelar item enviado".
//
// Rota estreita de propósito: quem tem salao.team.* só consegue mexer nessas
// duas permissões, só em contas de Garçom (perfil conta-garcom) e só da
// própria unidade. Nada além disso passa por aqui; o resto continua em
// Configurações → Usuários (dono). A unidade vem da requisição, mas o servidor
// confere no banco que quem pede e o garçom estão nela.

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "../../../lib/server/supabase-server.mjs";
import { PERFIL_GARCOM, PERMISSOES_DO_GARCOM } from "../../../lib/salao-equipe.mjs";


const json = (body, status = 200) => NextResponse.json(body, { status });

async function contexto(request, unidadeId, permissao) {
  let db;
  try { db = getSupabaseServerClient(); } catch { return { resposta: json({ error: "Servidor sem acesso administrativo configurado." }, 503) }; }
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { resposta: json({ error: "Sessão ausente." }, 401) };
  const { data: auth, error } = await db.auth.getUser(token);
  if (error || !auth?.user) return { resposta: json({ error: "Sessão inválida ou expirada." }, 401) };
  const unidade = String(unidadeId || "").trim();
  if (!unidade || unidade === "todas") return { resposta: json({ error: "Escolha a unidade." }, 400) };
  const [pode, naUnidade] = await Promise.all([
    db.rpc("hefisto_user_has_permission", { p_auth_user_id: auth.user.id, p_permission: permissao }),
    db.rpc("hefisto_user_in_unit", { p_auth_user_id: auth.user.id, p_unidade_id: unidade }),
  ]);
  if (!pode.data || !naUnidade.data) return { resposta: json({ error: "Você não tem permissão para a equipe do salão desta unidade." }, 403) };
  return { db, ator: auth.user, unidade };
}

/** Garçons da unidade (perfil conta-garcom), com o que cada um pode. */
async function garconsDaUnidade(db, unidade) {
  const { data: perfis } = await db.from("perfis_acesso").select("id").eq("codigo", PERFIL_GARCOM);
  const perfilIds = (perfis || []).map((p) => p.id);
  if (!perfilIds.length) return [];
  const { data: escopos } = await db.from("usuario_escopos").select("usuario_id").eq("unidade_id", unidade);
  const ids = [...new Set((escopos || []).map((e) => e.usuario_id))];
  if (!ids.length) return [];
  const { data: usuarios, error } = await db.from("usuarios_erp")
    .select("id, nome, login, status, super_admin, ultimo_acesso_em")
    .in("id", ids).in("perfil_id", perfilIds).order("nome");
  if (error) throw error;
  const lista = (usuarios || []).filter((u) => !u.super_admin);
  if (!lista.length) return [];
  const chaves = Object.values(PERMISSOES_DO_GARCOM).map((p) => p.chave);
  const { data: perms } = await db.from("usuario_permissoes").select("usuario_id, permission_key, effect")
    .in("usuario_id", lista.map((u) => u.id)).in("permission_key", chaves);
  return lista.map((u) => {
    const pode = {};
    for (const [id, p] of Object.entries(PERMISSOES_DO_GARCOM)) {
      pode[id] = (perms || []).some((x) => x.usuario_id === u.id && x.permission_key === p.chave && x.effect === "allow");
    }
    return { id: u.id, nome: u.nome, login: u.login, status: u.status, ultimoAcesso: u.ultimo_acesso_em, pode };
  });
}

export async function GET(request) {
  const unidade = new URL(request.url).searchParams.get("unidade");
  const c = await contexto(request, unidade, "salao.team.view");
  if (c.resposta) return c.resposta;
  try {
    return json({ garcons: await garconsDaUnidade(c.db, c.unidade), permissoes: PERMISSOES_DO_GARCOM });
  } catch {
    return json({ error: "Não foi possível ler a equipe." }, 500);
  }
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: "Dados inválidos." }, 400); }
  const c = await contexto(request, body?.unidade, "salao.team.edit");
  if (c.resposta) return c.resposta;
  const permissao = PERMISSOES_DO_GARCOM[body?.acao];
  if (!permissao) return json({ error: "Escolha uma das permissões do garçom." }, 400);
  try {
    // O alvo tem que ser garçom desta unidade: nada de dar permissão a outra conta.
    const garcons = await garconsDaUnidade(c.db, c.unidade);
    const alvo = garcons.find((g) => g.id === body.usuarioId);
    if (!alvo) return json({ error: "Garçom não encontrado nesta unidade." }, 404);
    const ligado = body.ligado === true;
    const del = await c.db.from("usuario_permissoes").delete().eq("usuario_id", alvo.id).eq("permission_key", permissao.chave);
    if (del.error) throw del.error;
    if (ligado) {
      const ins = await c.db.from("usuario_permissoes").insert({ usuario_id: alvo.id, permission_key: permissao.chave, effect: "allow" });
      if (ins.error) throw ins.error;
    }
    await c.db.from("permissoes_auditoria").insert({
      ator_auth_user_id: c.ator.id, alvo_tipo: "usuario", alvo_id: alvo.id, evento: "permissao_garcom",
      antes: { [permissao.chave]: alvo.pode[body.acao] }, depois: { [permissao.chave]: ligado, unidade: c.unidade },
    });
    return json({ ok: true, usuarioId: alvo.id, acao: body.acao, ligado });
  } catch {
    return json({ error: "Não foi possível salvar a permissão." }, 500);
  }
}
