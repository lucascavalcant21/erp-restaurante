// SINALIZAÇÃO DIGITAL — banco e storage (só servidor).
//
// Duas portas:
//   • painel   (/api/sinalizacao)          — sessão + vínculo com a unidade +
//                                            permissão clientes.signage.*;
//   • TV       (/api/public/sinalizacao/tv) — sem login: a TV prova quem é com
//                                            um segredo de 32 bytes que só ela
//                                            tem; o banco guarda o SHA-256.
// As tabelas sinal_* não têm policy nem grant para anon/authenticated
// (db/SINAL_1_SINALIZACAO_DIGITAL.sql): tudo passa por aqui, com service_role.
// Unidade sempre filtrada na consulta: uma loja nunca mexe na TV de outra.
// Banco por parâmetro, para dar para testar com um banco falso.

import { createHash, randomBytes } from "node:crypto";
import {
  gerarCodigo, normalizarCodigo, validarEnvio, orientacaoPorMedida, validarPlaylist, normalizarConteudo,
  validarProgramacao, resolverConteudo, montarRoteiro, midiasUsadas, statusDaTela, resumoDasTelas,
  texto, uuidValido, VALIDADE_CODIGO_MS, ORIENTACOES, INTERVALO_TV_MS,
} from "../sinalizacao.mjs";
import { lerCardapioPublico } from "./negocio-publico.mjs";

export const BUCKET = "sinalizacao";
const TTL_TV_S = 12 * 60 * 60; // URL assinada da TV: 12 h (renova a cada consulta)
const TTL_PAINEL_S = 60 * 60;

const falha = (status, erro) => ({ ok: false, status, erro });
const ok = (dados = {}) => ({ ok: true, ...dados });
export const hashDe = (segredo) => createHash("sha256").update(String(segredo)).digest("hex");
const SEGREDO_RE = /^[A-Za-z0-9_-]{43}$/; // 32 bytes em base64url

const TABELA_FALTANDO = /relation .* does not exist|could not find the table|schema cache/i;
const semTabelas = (e) => !!e && TABELA_FALTANDO.test(e.message || "");
const ERRO_SEM_TABELAS = "A Sinalização digital ainda não foi ativada no banco (migração SINAL-1 aguardando aprovação).";

// ─── LEITURA DO PAINEL ───────────────────────────────────────────────────────

const COL_TELA = "id, nome, local, orientacao, conteudo, pareada_em, ultimo_contato, exibindo, aparelho, ativa, token_hash, created_at, updated_at";
const COL_MIDIA = "id, nome, tipo, mime, caminho, tamanho_bytes, duracao_seg, largura, altura, orientacao, versao, ativo, created_at";

async function urlsAssinadas(db, midias, ttl) {
  const mapa = new Map();
  const comCaminho = midias.filter((m) => m?.caminho);
  if (!comCaminho.length) return mapa;
  const { data, error } = await db.storage.from(BUCKET).createSignedUrls(comCaminho.map((m) => m.caminho), ttl);
  if (error || !Array.isArray(data)) return mapa;
  const porCaminho = new Map(data.filter((d) => d?.signedUrl && !d.error).map((d) => [d.path, d.signedUrl]));
  for (const m of comCaminho) if (porCaminho.has(m.caminho)) mapa.set(m.id, porCaminho.get(m.caminho));
  return mapa;
}

/** Tela para o painel: sem o hash do token, com status e o que passa agora. */
function telaParaPainel(t, agora) {
  const { token_hash, ...resto } = t;
  return { ...resto, pareada: !!token_hash, status: statusDaTela(t, agora) };
}

export async function lerPainel(db, unidade, { agora = new Date() } = {}) {
  const [rT, rM, rP, rR] = await Promise.all([
    db.from("sinal_telas").select(COL_TELA).eq("unidade_id", unidade).order("nome"),
    db.from("sinal_midias").select(COL_MIDIA).eq("unidade_id", unidade).eq("ativo", true).order("created_at", { ascending: false }),
    db.from("sinal_playlists").select("id, nome, orientacao, itens, ativa, updated_at").eq("unidade_id", unidade).order("nome"),
    db.from("sinal_programacoes").select("id, nome, playlist_id, tela_ids, dias_semana, hora_inicio, hora_fim, data_inicio, data_fim, prioridade, ativa, updated_at")
      .eq("unidade_id", unidade).order("prioridade", { ascending: false }),
  ]);
  const erro = rT.error || rM.error || rP.error || rR.error;
  if (semTabelas(erro)) return { ok: false, status: 200, semTabelas: true, erro: ERRO_SEM_TABELAS };
  if (erro) return falha(500, "Não foi possível carregar a Sinalização digital.");

  const midias = rM.data || [];
  const urls = await urlsAssinadas(db, midias, TTL_PAINEL_S);
  const programacoes = (rR.data || []).map((r) => ({ ...r, hora_inicio: r.hora_inicio?.slice(0, 5) || null, hora_fim: r.hora_fim?.slice(0, 5) || null }));
  const agoraMs = agora.getTime();
  const telas = (rT.data || []).map((t) => {
    const r = resolverConteudo({ tela: t, programacoes, agora });
    return { ...telaParaPainel(t, agoraMs), agora: { origem: r.origem, conteudo: r.conteudo, regra: r.regra } };
  });

  // Seções do cardápio para montar a página de cardápio na playlist.
  let categorias = [];
  const rc = await lerCardapioPublico({ db, unidade, agora }).catch(() => null);
  if (rc?.ok) categorias = (rc.cardapio.categorias || []).filter((c) => c.id !== "combos").map((c) => ({ id: c.id, nome: c.nome, pratos: c.produto_ids.length }));

  return ok({
    telas,
    resumo: resumoDasTelas(telas, agoraMs),
    midias: midias.map((m) => ({ ...m, duracao_seg: m.duracao_seg == null ? null : Number(m.duracao_seg), url: urls.get(m.id) || null })),
    playlists: rP.data || [],
    programacoes,
    categorias,
    cardapioDisponivel: !!rc?.ok,
  });
}

// ─── TELAS ───────────────────────────────────────────────────────────────────

/**
 * Pareia a TV que mostra `codigo` nesta unidade: cria a tela (ou reconecta
 * uma tela existente, quando vem `tela_id`) com o hash do segredo da TV.
 */
export async function parearTela(db, unidade, corpo, { quem = null, agora = new Date() } = {}) {
  const codigo = normalizarCodigo(corpo?.codigo);
  if (!codigo) return falha(400, "Código inválido. Digite os 6 caracteres que aparecem na TV.");
  const { data: par, error: eP } = await db.from("sinal_pareamentos").select("id, segredo_hash, aparelho, expira_em").eq("codigo", codigo).maybeSingle();
  if (semTabelas(eP)) return falha(409, ERRO_SEM_TABELAS);
  if (eP) return falha(500, "Não foi possível conferir o código.");
  if (!par || Date.parse(par.expira_em) < agora.getTime()) return falha(404, "Código não encontrado ou vencido. Confira a TV: o código muda a cada 30 minutos.");

  const dados = {
    token_hash: par.segredo_hash,
    pareada_em: agora.toISOString(),
    ultimo_contato: agora.toISOString(),
    aparelho: par.aparelho || null,
    updated_at: agora.toISOString(),
  };
  let tela;
  if (corpo?.tela_id) {
    if (!uuidValido(corpo.tela_id)) return falha(400, "Tela inválida.");
    const { data, error } = await db.from("sinal_telas").update(dados).eq("id", corpo.tela_id).eq("unidade_id", unidade).select("id, nome").maybeSingle();
    if (error) return falha(500, "Não foi possível parear a tela.");
    if (!data) return falha(404, "Tela não encontrada nesta unidade.");
    tela = data;
  } else {
    const nome = texto(corpo?.nome);
    if (!nome) return falha(400, "Dê um nome à tela (ex.: Parede 01 do salão).");
    const { data, error } = await db.from("sinal_telas").insert({
      unidade_id: unidade, nome, local: texto(corpo?.local) || null,
      orientacao: ORIENTACOES.includes(corpo?.orientacao) ? corpo.orientacao : "horizontal",
      conteudo: normalizarConteudo(corpo?.conteudo), criado_por: quem, ...dados,
    }).select("id, nome").single();
    if (error) return falha(500, "Não foi possível cadastrar a tela.");
    tela = data;
  }
  // O código já cumpriu o papel: some (a TV passa a se identificar pelo segredo).
  await db.from("sinal_pareamentos").delete().eq("id", par.id);
  return ok({ tela });
}

export async function salvarTela(db, unidade, corpo, { agora = new Date() } = {}) {
  if (!uuidValido(corpo?.id)) return falha(400, "Tela inválida.");
  const nome = texto(corpo.nome);
  if (!nome) return falha(400, "Dê um nome à tela.");
  const { data, error } = await db.from("sinal_telas").update({
    nome, local: texto(corpo.local) || null,
    orientacao: ORIENTACOES.includes(corpo.orientacao) ? corpo.orientacao : "horizontal",
    ativa: corpo.ativa !== false, updated_at: agora.toISOString(),
  }).eq("id", corpo.id).eq("unidade_id", unidade).select("id").maybeSingle();
  if (error) return falha(500, "Não foi possível salvar a tela.");
  if (!data) return falha(404, "Tela não encontrada nesta unidade.");
  return ok();
}

/**
 * "Trocar conteúdo": a mesma arte/playlist em uma, várias ou todas as telas.
 * `tela_ids: "todas"` = todas as telas da unidade. `conteudo: null` limpa.
 */
export async function trocarConteudo(db, unidade, corpo, { agora = new Date() } = {}) {
  const conteudo = corpo?.conteudo == null ? null : normalizarConteudo(corpo.conteudo);
  if (corpo?.conteudo != null && !conteudo) return falha(400, "Conteúdo inválido.");
  if (conteudo) {
    const tabela = conteudo.tipo === "playlist" ? "sinal_playlists" : "sinal_midias";
    const { data } = await db.from(tabela).select("id").eq("id", conteudo.id).eq("unidade_id", unidade).maybeSingle();
    if (!data) return falha(404, "Conteúdo não encontrado nesta unidade.");
  }
  let q = db.from("sinal_telas").update({ conteudo, updated_at: agora.toISOString() }).eq("unidade_id", unidade);
  if (corpo?.tela_ids !== "todas") {
    const ids = Array.isArray(corpo?.tela_ids) ? corpo.tela_ids.filter(uuidValido) : [];
    if (!ids.length) return falha(400, "Escolha pelo menos uma tela.");
    q = q.in("id", ids);
  }
  const { data, error } = await q.select("id");
  if (error) return falha(500, "Não foi possível trocar o conteúdo.");
  return ok({ telas: (data || []).length });
}

/** Desliga a TV do painel: o aparelho volta a mostrar um código novo. */
export async function desconectarTela(db, unidade, id, { agora = new Date() } = {}) {
  if (!uuidValido(id)) return falha(400, "Tela inválida.");
  const { data, error } = await db.from("sinal_telas").update({ token_hash: null, updated_at: agora.toISOString() })
    .eq("id", id).eq("unidade_id", unidade).select("id").maybeSingle();
  if (error) return falha(500, "Não foi possível desconectar a tela.");
  if (!data) return falha(404, "Tela não encontrada nesta unidade.");
  return ok();
}

export async function excluirTela(db, unidade, id) {
  if (!uuidValido(id)) return falha(400, "Tela inválida.");
  const { data, error } = await db.from("sinal_telas").delete().eq("id", id).eq("unidade_id", unidade).select("id");
  if (error) return falha(500, "Não foi possível excluir a tela.");
  if (!data?.length) return falha(404, "Tela não encontrada nesta unidade.");
  return ok();
}

// ─── MÍDIAS ──────────────────────────────────────────────────────────────────

/** Passo 1 do envio: o navegador recebe um endereço assinado e manda o arquivo direto ao Storage. */
export async function prepararEnvio(db, unidade, corpo, { id = randomBytes(12).toString("hex") } = {}) {
  const v = validarEnvio(corpo);
  if (!v.ok) return falha(400, v.erro);
  const caminho = `${unidade}/${id}.${v.ext}`;
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(caminho);
  if (error || !data?.token) {
    if (/bucket not found/i.test(error?.message || "")) return falha(409, ERRO_SEM_TABELAS);
    return falha(500, "Não foi possível preparar o envio.");
  }
  return ok({ caminho, token: data.token });
}

/** Passo 2: o arquivo chegou; registra no acervo (confere que existe e é desta unidade). */
export async function registrarMidia(db, unidade, corpo, { quem = null } = {}) {
  const v = validarEnvio(corpo);
  if (!v.ok) return falha(400, v.erro);
  const caminho = String(corpo?.caminho || "");
  const prefixo = `${unidade}/`;
  if (!caminho.startsWith(prefixo) || !/^[A-Za-z0-9_-]+\/[a-f0-9]{24}\.(jpg|png|webp|mp4)$/.test(caminho) || !caminho.endsWith(`.${v.ext}`)) {
    return falha(400, "Arquivo inválido.");
  }
  const nomeArquivo = caminho.slice(prefixo.length);
  const { data: lista, error: eL } = await db.storage.from(BUCKET).list(unidade, { search: nomeArquivo, limit: 1 });
  if (eL || !lista?.some((o) => o.name === nomeArquivo)) return falha(400, "O arquivo não chegou. Envie de novo.");
  const dur = Number(corpo.duracao_seg);
  const largura = Number.isInteger(corpo.largura) && corpo.largura > 0 ? corpo.largura : null;
  const altura = Number.isInteger(corpo.altura) && corpo.altura > 0 ? corpo.altura : null;
  const { data, error } = await db.from("sinal_midias").insert({
    unidade_id: unidade, nome: v.nome, tipo: v.tipo, mime: v.mime, caminho, tamanho_bytes: v.tamanho,
    duracao_seg: v.tipo === "video" && dur > 0 && dur <= 3600 ? Math.round(dur * 100) / 100 : null,
    largura, altura, orientacao: orientacaoPorMedida(largura, altura), criado_por: quem,
  }).select("id").single();
  if (error) return falha(500, "Não foi possível registrar o arquivo.");
  return ok({ id: data.id });
}

export async function renomearMidia(db, unidade, corpo, { agora = new Date() } = {}) {
  if (!uuidValido(corpo?.id)) return falha(400, "Mídia inválida.");
  const nome = texto(corpo.nome);
  if (!nome) return falha(400, "Dê um nome à mídia.");
  const { data, error } = await db.from("sinal_midias").update({ nome, updated_at: agora.toISOString() })
    .eq("id", corpo.id).eq("unidade_id", unidade).select("id").maybeSingle();
  if (error) return falha(500, "Não foi possível renomear.");
  if (!data) return falha(404, "Mídia não encontrada nesta unidade.");
  return ok();
}

/**
 * Tira a mídia do acervo e apaga o arquivo. Playlists que a usavam seguem
 * sem ela (o roteiro pula mídia que não existe); tela com ela fixa fica sem
 * conteúdo fixo.
 */
export async function excluirMidia(db, unidade, id, { agora = new Date() } = {}) {
  if (!uuidValido(id)) return falha(400, "Mídia inválida.");
  const { data: m } = await db.from("sinal_midias").select("id, caminho").eq("id", id).eq("unidade_id", unidade).maybeSingle();
  if (!m) return falha(404, "Mídia não encontrada nesta unidade.");
  const { error } = await db.from("sinal_midias").delete().eq("id", id).eq("unidade_id", unidade);
  if (error) return falha(500, "Não foi possível excluir a mídia.");
  await db.storage.from(BUCKET).remove([m.caminho]).catch(() => {});
  const { data: telas } = await db.from("sinal_telas").select("id, conteudo").eq("unidade_id", unidade);
  const comEla = (telas || []).filter((t) => t.conteudo?.tipo === "midia" && t.conteudo?.id === id).map((t) => t.id);
  if (comEla.length) await db.from("sinal_telas").update({ conteudo: null, updated_at: agora.toISOString() }).eq("unidade_id", unidade).in("id", comEla);
  return ok();
}

// ─── PLAYLISTS ───────────────────────────────────────────────────────────────

export async function salvarPlaylist(db, unidade, corpo, { quem = null, agora = new Date() } = {}) {
  const v = validarPlaylist(corpo);
  if (!v.ok) return falha(400, v.erro);
  const ids = midiasUsadas(v.playlist.itens);
  if (ids.length) {
    const { data } = await db.from("sinal_midias").select("id").eq("unidade_id", unidade).in("id", ids);
    const daLoja = new Set((data || []).map((m) => m.id));
    if (ids.some((id) => !daLoja.has(id))) return falha(400, "A playlist tem mídia que não é desta unidade.");
  }
  if (corpo?.id) {
    if (!uuidValido(corpo.id)) return falha(400, "Playlist inválida.");
    const { data, error } = await db.from("sinal_playlists").update({ ...v.playlist, ativa: corpo.ativa !== false, updated_at: agora.toISOString() })
      .eq("id", corpo.id).eq("unidade_id", unidade).select("id").maybeSingle();
    if (error) return falha(500, "Não foi possível salvar a playlist.");
    if (!data) return falha(404, "Playlist não encontrada nesta unidade.");
    return ok({ id: data.id });
  }
  const { data, error } = await db.from("sinal_playlists").insert({ unidade_id: unidade, ...v.playlist, criado_por: quem }).select("id").single();
  if (error) return falha(500, "Não foi possível criar a playlist.");
  return ok({ id: data.id });
}

/** Excluir a playlist leva junto as regras de programação dela e solta as telas que a tinham fixa. */
export async function excluirPlaylist(db, unidade, id, { agora = new Date() } = {}) {
  if (!uuidValido(id)) return falha(400, "Playlist inválida.");
  const { data, error } = await db.from("sinal_playlists").delete().eq("id", id).eq("unidade_id", unidade).select("id");
  if (error) return falha(500, "Não foi possível excluir a playlist.");
  if (!data?.length) return falha(404, "Playlist não encontrada nesta unidade.");
  const { data: telas } = await db.from("sinal_telas").select("id, conteudo").eq("unidade_id", unidade);
  const comEla = (telas || []).filter((t) => t.conteudo?.tipo === "playlist" && t.conteudo?.id === id).map((t) => t.id);
  if (comEla.length) await db.from("sinal_telas").update({ conteudo: null, updated_at: agora.toISOString() }).eq("unidade_id", unidade).in("id", comEla);
  return ok();
}

// ─── PROGRAMAÇÃO ─────────────────────────────────────────────────────────────

export async function salvarProgramacao(db, unidade, corpo, { quem = null, agora = new Date() } = {}) {
  const v = validarProgramacao(corpo);
  if (!v.ok) return falha(400, v.erro);
  const { data: pl } = await db.from("sinal_playlists").select("id").eq("id", v.regra.playlist_id).eq("unidade_id", unidade).maybeSingle();
  if (!pl) return falha(404, "Playlist não encontrada nesta unidade.");
  if (v.regra.tela_ids.length) {
    const { data } = await db.from("sinal_telas").select("id").eq("unidade_id", unidade).in("id", v.regra.tela_ids);
    if ((data || []).length !== v.regra.tela_ids.length) return falha(400, "A regra tem tela que não é desta unidade.");
  }
  if (corpo?.id) {
    if (!uuidValido(corpo.id)) return falha(400, "Regra inválida.");
    const { data, error } = await db.from("sinal_programacoes").update({ ...v.regra, updated_at: agora.toISOString() })
      .eq("id", corpo.id).eq("unidade_id", unidade).select("id").maybeSingle();
    if (error) return falha(500, "Não foi possível salvar a regra.");
    if (!data) return falha(404, "Regra não encontrada nesta unidade.");
    return ok({ id: data.id });
  }
  const { data, error } = await db.from("sinal_programacoes").insert({ unidade_id: unidade, ...v.regra, criado_por: quem }).select("id").single();
  if (error) return falha(500, "Não foi possível criar a regra.");
  return ok({ id: data.id });
}

export async function excluirProgramacao(db, unidade, id) {
  if (!uuidValido(id)) return falha(400, "Regra inválida.");
  const { data, error } = await db.from("sinal_programacoes").delete().eq("id", id).eq("unidade_id", unidade).select("id");
  if (error) return falha(500, "Não foi possível excluir a regra.");
  if (!data?.length) return falha(404, "Regra não encontrada nesta unidade.");
  return ok();
}

// ─── TV ──────────────────────────────────────────────────────────────────────

/** A TV abriu /tv pela primeira vez (ou foi desconectada): ganha um segredo e um código. */
export async function registrarAparelho(db, { aparelho = "", agora = new Date(), aleatorio = randomBytes } = {}) {
  // Limpa códigos vencidos (só desta tabela de passagem; nenhum dado de loja).
  await db.from("sinal_pareamentos").delete().lt("expira_em", agora.toISOString());
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const segredo = aleatorio(32).toString("base64url");
    const codigo = gerarCodigo(aleatorio);
    const expira_em = new Date(agora.getTime() + VALIDADE_CODIGO_MS).toISOString();
    const { error } = await db.from("sinal_pareamentos").insert({ codigo, segredo_hash: hashDe(segredo), aparelho: texto(aparelho, 200) || null, expira_em });
    if (!error) return ok({ segredo, codigo, expira_em });
    if (semTabelas(error)) return falha(503, "Serviço indisponível no momento.");
    if (!/duplicate|unique/i.test(error.message || "")) return falha(503, "Serviço indisponível no momento.");
  }
  return falha(503, "Serviço indisponível no momento.");
}

// Cardápio por unidade, guardado 60 s por instância: 20 TVs perguntando a
// cada 30 s não viram 40 leituras do cardápio por minuto.
const cacheCardapio = new Map();
async function cardapioDaUnidade(db, unidade, agora) {
  const c = cacheCardapio.get(unidade);
  if (c && agora.getTime() - c.em < 60 * 1000) return c.cardapio;
  const r = await lerCardapioPublico({ db, unidade, agora }).catch(() => null);
  const cardapio = r?.ok ? r.cardapio : null;
  cacheCardapio.set(unidade, { em: agora.getTime(), cardapio });
  return cardapio;
}
export const _limparCacheCardapio = () => cacheCardapio.clear();

/** Assinatura do roteiro sem as URLs (que mudam a cada consulta): a TV só recarrega quando muda de verdade. */
export function assinaturaDoRoteiro(slides) {
  const sem = slides.map(({ url, ...s }) => s);
  return createHash("sha256").update(JSON.stringify(sem)).digest("hex").slice(0, 16);
}

/**
 * A TV pergunta "o que eu mostro?" a cada 30 s e conta o que está passando.
 * Respostas:
 *   { estado: "pareada", tela, roteiro, assinatura }
 *   { estado: "aguardando", codigo, expira_em }   — mostrar o código
 *   { estado: "novo" }                            — segredo desconhecido: registrar de novo
 */
export async function conteudoDaTela(db, { segredo, exibindo = null, aparelho = "", agora = new Date() } = {}) {
  if (!SEGREDO_RE.test(String(segredo || ""))) return ok({ estado: "novo" });
  const h = hashDe(segredo);
  const { data: tela, error } = await db.from("sinal_telas").select("id, unidade_id, nome, orientacao, conteudo, ativa").eq("token_hash", h).maybeSingle();
  if (semTabelas(error)) return falha(503, "Serviço indisponível no momento.");
  if (error) return falha(503, "Serviço indisponível no momento.");

  if (!tela) {
    const { data: par } = await db.from("sinal_pareamentos").select("codigo, expira_em").eq("segredo_hash", h).maybeSingle();
    if (par && Date.parse(par.expira_em) > agora.getTime()) return ok({ estado: "aguardando", codigo: par.codigo, expira_em: par.expira_em });
    return ok({ estado: "novo" });
  }

  const visto = exibindo && typeof exibindo === "object"
    ? { chave: texto(exibindo.chave, 120), nome: texto(exibindo.nome, 120), midia_id: uuidValido(exibindo.midia_id) ? exibindo.midia_id : null, tipo: texto(exibindo.tipo, 20) }
    : null;
  await db.from("sinal_telas").update({ ultimo_contato: agora.toISOString(), exibindo: visto, aparelho: texto(aparelho, 200) || null }).eq("id", tela.id);

  const info = { nome: tela.nome, orientacao: tela.orientacao };
  if (tela.ativa === false) return ok({ estado: "pareada", tela: info, roteiro: [], assinatura: "pausada", pausada: true, intervalo_ms: INTERVALO_TV_MS });

  const { data: regras } = await db.from("sinal_programacoes")
    .select("id, nome, playlist_id, tela_ids, dias_semana, hora_inicio, hora_fim, data_inicio, data_fim, prioridade, ativa, updated_at")
    .eq("unidade_id", tela.unidade_id).eq("ativa", true);
  const programacoes = (regras || []).map((r) => ({ ...r, hora_inicio: r.hora_inicio?.slice(0, 5) || null, hora_fim: r.hora_fim?.slice(0, 5) || null }));
  const r = resolverConteudo({ tela, programacoes, agora });

  let itens = [];
  if (r.conteudo?.tipo === "playlist") {
    const { data: pl } = await db.from("sinal_playlists").select("itens, ativa").eq("id", r.conteudo.id).eq("unidade_id", tela.unidade_id).maybeSingle();
    if (pl && pl.ativa !== false) itens = Array.isArray(pl.itens) ? pl.itens : [];
  } else if (r.conteudo?.tipo === "midia") {
    itens = [{ tipo: "midia", midia_id: r.conteudo.id }];
  }

  const ids = midiasUsadas(itens);
  let midias = new Map();
  let urls = new Map();
  if (ids.length) {
    const { data } = await db.from("sinal_midias").select("id, nome, tipo, caminho, duracao_seg, versao, orientacao").eq("unidade_id", tela.unidade_id).eq("ativo", true).in("id", ids);
    const lista = data || [];
    midias = new Map(lista.map((m) => [m.id, m]));
    urls = await urlsAssinadas(db, lista, TTL_TV_S);
  }
  const usaCardapio = itens.some((i) => i?.tipo === "cardapio");
  const cardapio = usaCardapio ? await cardapioDaUnidade(db, tela.unidade_id, agora) : null;
  const roteiro = montarRoteiro({ itens, midias, urls, cardapio });
  return ok({
    estado: "pareada",
    tela: info,
    origem: r.origem,
    regra: r.regra?.nome || null,
    roteiro,
    assinatura: assinaturaDoRoteiro(roteiro),
    loja: cardapio?.unidade?.nome || null,
    intervalo_ms: INTERVALO_TV_MS,
  });
}
