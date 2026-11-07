// Sinalização digital no servidor, com banco e storage falsos em memória.
// Rode: node --test app/lib/server/sinalizacao.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import {
  parearTela, trocarConteudo, desconectarTela, prepararEnvio, registrarMidia, excluirMidia,
  salvarPlaylist, excluirPlaylist, salvarProgramacao, registrarAparelho, conteudoDaTela, lerPainel,
  hashDe, assinaturaDoRoteiro, _limparCacheCardapio,
} from "./sinalizacao.mjs";

const U = "seldeestrela";
const OUTRA = "outra";
const AGORA = new Date("2026-11-09T15:00:00Z"); // segunda, 12:00 em São Paulo

// ─── banco falso (supabase-js) ───────────────────────────────────────────────
function bancoFalso(tabelas = {}, arquivos = []) {
  const dados = Object.fromEntries(Object.entries(tabelas).map(([k, v]) => [k, v.map((x) => ({ ...x }))]));
  const storage = new Set(arquivos);
  const removidos = [];
  const passa = (filtros) => (l) => filtros.every(([op, c, v]) => {
    if (op === "eq") return String(l[c]) === String(v);
    if (op === "in") return v.map(String).includes(String(l[c]));
    if (op === "lt") return l[c] != null && l[c] < v;
    return true;
  });
  function from(t) {
    const st = { op: "select", filtros: [], patch: null, linhas: null, unico: null, retornar: false };
    const run = () => {
      if (!(t in dados)) return { data: null, error: { message: `relation "public.${t}" does not exist` } };
      if (st.op === "insert") {
        const novas = st.linhas.map((l) => ({ id: l.id || crypto.randomUUID(), created_at: AGORA.toISOString(), ...l }));
        if (t === "sinal_pareamentos" && novas.some((n) => dados[t].some((x) => x.codigo === n.codigo))) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
        dados[t].push(...novas);
        return { data: st.unico ? novas[0] : novas, error: null };
      }
      const alvo = dados[t].filter(passa(st.filtros));
      if (st.op === "update") for (const l of alvo) Object.assign(l, st.patch);
      if (st.op === "delete") dados[t] = dados[t].filter((l) => !alvo.includes(l));
      const out = alvo.map((l) => ({ ...l }));
      if (st.unico === "maybe") return { data: out[0] ?? null, error: null };
      if (st.unico === "single") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: "not single" } };
      return { data: st.op === "select" || st.retornar ? out : null, error: null };
    };
    const b = {
      select() { if (st.op !== "select") st.retornar = true; return b; },
      insert(l) { st.op = "insert"; st.linhas = Array.isArray(l) ? l : [l]; return b; },
      update(p) { st.op = "update"; st.patch = p; return b; },
      delete() { st.op = "delete"; return b; },
      eq(c, v) { st.filtros.push(["eq", c, v]); return b; },
      in(c, v) { st.filtros.push(["in", c, v]); return b; },
      lt(c, v) { st.filtros.push(["lt", c, v]); return b; },
      order() { return b; },
      not() { return b; },
      neq() { return b; },
      limit() { return b; },
      single() { st.unico = "single"; return b; },
      maybeSingle() { st.unico = "maybe"; return b; },
      then(r, j) { return Promise.resolve().then(run).then(r, j); },
    };
    return b;
  }
  const bucket = {
    async createSignedUrls(paths) { return { data: paths.filter((p) => storage.has(p)).map((p) => ({ path: p, signedUrl: `https://st/${p}?token=x` })), error: null }; },
    async createSignedUploadUrl(p) { return { data: { token: `up-${p}` }, error: null }; },
    async list(pasta, { search }) { return { data: [...storage].filter((p) => p === `${pasta}/${search}`).map((p) => ({ name: p.split("/")[1] })), error: null }; },
    async remove(ps) { for (const p of ps) { storage.delete(p); removidos.push(p); } return { error: null }; },
  };
  return { dados, removidos, from, storage: { from: () => bucket } };
}

const vazio = () => ({
  sinal_telas: [], sinal_midias: [], sinal_playlists: [], sinal_programacoes: [], sinal_pareamentos: [],
  unidades: [{ id: U, nome: "Sel de Estrela" }, { id: OUTRA, nome: "Outra" }],
  produtos: [
    { id: "p1", unidade_id: U, nome_produto: "Baião arretado", preco_venda: 29.9, categoria: "Pratos", ativo: true },
    { id: "p2", unidade_id: OUTRA, nome_produto: "Prato de outra loja", preco_venda: 10, categoria: "Pratos", ativo: true },
  ],
  config_sistema: [], montagem: [], fichas_tecnicas: [], fichas_alergenicos: [],
});

test("TV nova: registra, mostra código; pareada no painel, passa a se identificar pelo segredo", async () => {
  const db = bancoFalso(vazio());
  const reg = await registrarAparelho(db, { agora: AGORA, aleatorio: (n) => Buffer.from(Array.from({ length: n }, (_, i) => (i * 13 + 5) % 256)) });
  assert.equal(reg.ok, true);
  assert.match(reg.codigo, /^\d{4}$/);
  assert.equal(db.dados.sinal_pareamentos[0].segredo_hash, hashDe(reg.segredo), "banco só guarda o hash");
  assert.ok(!JSON.stringify(db.dados).includes(reg.segredo), "o segredo em claro não fica no banco");

  const antes = await conteudoDaTela(db, { segredo: reg.segredo, agora: AGORA });
  assert.deepEqual([antes.estado, antes.codigo], ["aguardando", reg.codigo]);

  const p = await parearTela(db, U, { codigo: ` ${reg.codigo.slice(0, 2)} ${reg.codigo.slice(2)} `, nome: "Parede 01", orientacao: "vertical" }, { agora: AGORA, quem: "Lucas" });
  assert.equal(p.ok, true);
  assert.equal(db.dados.sinal_pareamentos.length, 0, "código usado some");
  const t = db.dados.sinal_telas[0];
  assert.deepEqual([t.unidade_id, t.orientacao, t.token_hash], [U, "vertical", hashDe(reg.segredo)]);

  const depois = await conteudoDaTela(db, { segredo: reg.segredo, agora: AGORA });
  assert.equal(depois.estado, "pareada");
  assert.deepEqual(depois.roteiro, [], "sem conteúdo: nada inventado");

  // Desconectar: a TV volta a pedir código.
  await desconectarTela(db, U, t.id, { agora: AGORA });
  assert.equal((await conteudoDaTela(db, { segredo: reg.segredo, agora: AGORA })).estado, "novo");
});

test("código vencido ou de outra forma inválido não pareia; segredo malformado é 'novo'", async () => {
  const db = bancoFalso({ ...vazio(), sinal_pareamentos: [{ id: "x", codigo: "0420", segredo_hash: "a".repeat(64), expira_em: "2026-11-09T14:00:00Z" }] });
  assert.equal((await parearTela(db, U, { codigo: "0420", nome: "TV" }, { agora: AGORA })).status, 404);
  assert.equal((await parearTela(db, U, { codigo: "123", nome: "TV" }, { agora: AGORA })).status, 400);
  assert.equal((await conteudoDaTela(db, { segredo: "curto", agora: AGORA })).estado, "novo");
});

test("envio: caminho na pasta da unidade; registrar exige o arquivo no storage e da mesma unidade", async () => {
  const db = bancoFalso(vazio());
  const prep = await prepararEnvio(db, U, { nome: "Baião", mime: "video/mp4", tamanho: 1000 }, { id: "a".repeat(24) });
  assert.equal(prep.caminho, `${U}/${"a".repeat(24)}.mp4`);
  const corpo = { caminho: prep.caminho, nome: "Baião", mime: "video/mp4", tamanho: 1000, duracao_seg: 14.4, largura: 1080, altura: 1920 };
  assert.equal((await registrarMidia(db, U, corpo)).status, 400, "arquivo ainda não chegou");
  const db2 = bancoFalso(vazio(), [prep.caminho]);
  const r = await registrarMidia(db2, U, corpo, { quem: "Lucas" });
  assert.equal(r.ok, true);
  const m = db2.dados.sinal_midias[0];
  assert.deepEqual([m.tipo, m.orientacao, m.duracao_seg], ["video", "vertical", 14.4]);
  assert.equal((await registrarMidia(db2, OUTRA, corpo)).status, 400, "outra loja não registra arquivo desta");
  assert.equal((await registrarMidia(db2, U, { ...corpo, caminho: `${U}/../x.mp4` })).status, 400);
  assert.equal((await prepararEnvio(db, U, { mime: "video/webm", tamanho: 10 })).ok, false);
});

const M1 = "55555555-5555-4555-8555-555555555555";
const P_ID = "33333333-3333-4333-8333-333333333333";
const T_ID = "11111111-1111-4111-8111-111111111111";
const T2_ID = "22222222-2222-4222-8222-222222222222";

function comConteudo() {
  const base = vazio();
  base.sinal_midias = [
    { id: M1, unidade_id: U, nome: "Picanha", tipo: "imagem", mime: "image/png", caminho: `${U}/${"b".repeat(24)}.png`, tamanho_bytes: 10, versao: 1, ativo: true, orientacao: "horizontal" },
    { id: "66666666-6666-4666-8666-666666666666", unidade_id: OUTRA, nome: "De outra", tipo: "imagem", mime: "image/png", caminho: `${OUTRA}/${"c".repeat(24)}.png`, tamanho_bytes: 10, versao: 1, ativo: true },
  ];
  base.sinal_telas = [
    { id: T_ID, unidade_id: U, nome: "Parede 01", orientacao: "horizontal", token_hash: hashDe("S".repeat(43)), ativa: true, conteudo: null },
    { id: T2_ID, unidade_id: U, nome: "Totem", orientacao: "vertical", token_hash: null, ativa: true, conteudo: null },
    { id: "77777777-7777-4777-8777-777777777777", unidade_id: OUTRA, nome: "TV da outra", orientacao: "horizontal", ativa: true, conteudo: null },
  ];
  return base;
}

test("playlist só aceita mídia da própria unidade; publicar em todas não toca a TV de outra loja", async () => {
  const db = bancoFalso(comConteudo(), [`${U}/${"b".repeat(24)}.png`]);
  const ruim = await salvarPlaylist(db, U, { nome: "X", itens: [{ tipo: "midia", midia_id: "66666666-6666-4666-8666-666666666666" }] });
  assert.equal(ruim.status, 400);
  const pl = await salvarPlaylist(db, U, { nome: "Almoço", itens: [{ tipo: "midia", midia_id: M1 }, { tipo: "cardapio", titulo: "Almoço executivo" }] }, { quem: "Lucas" });
  assert.equal(pl.ok, true);
  assert.equal(pl.versao, 1);
  db.dados.sinal_playlists[0].versao = 1;
  const v2 = await salvarPlaylist(db, U, { id: pl.id, nome: "Almoço", itens: [{ tipo: "cardapio" }] });
  assert.equal(v2.versao, 2, "cada edição vira uma versão nova");
  assert.equal((await salvarPlaylist(db, OUTRA, { id: pl.id, nome: "x", itens: [{ tipo: "cardapio" }] })).status, 404, "outra loja não edita");
  const r = await trocarConteudo(db, U, { tela_ids: "todas", conteudo: { tipo: "playlist", id: pl.id } }, { agora: AGORA });
  assert.equal(r.telas, 2);
  assert.equal(db.dados.sinal_telas.find((t) => t.unidade_id === OUTRA).conteudo, null);
  // Conteúdo de outra loja não entra.
  assert.equal((await trocarConteudo(db, OUTRA, { tela_ids: "todas", conteudo: { tipo: "playlist", id: pl.id } })).status, 404);
});

test("a TV recebe o roteiro: mídia com URL assinada e cardápio com preço do sistema da própria loja", async () => {
  _limparCacheCardapio();
  const db = bancoFalso(comConteudo(), [`${U}/${"b".repeat(24)}.png`]);
  const pl = await salvarPlaylist(db, U, { nome: "Almoço", itens: [{ tipo: "midia", midia_id: M1, duracao_seg: 8 }, { tipo: "cardapio" }] });
  await trocarConteudo(db, U, { tela_ids: [T_ID], conteudo: { tipo: "playlist", id: pl.id } });
  const r = await conteudoDaTela(db, { segredo: "S".repeat(43), exibindo: { chave: `${M1}:1`, nome: "Picanha", midia_id: M1, tipo: "imagem" }, agora: AGORA });
  assert.equal(r.estado, "pareada");
  assert.equal(r.origem, "fixo");
  assert.deepEqual(r.roteiro.map((s) => s.tipo), ["imagem", "cardapio"]);
  assert.match(r.roteiro[0].url, /^https:\/\/st\//);
  assert.equal(r.roteiro[0].duracao_seg, 8);
  const pratos = r.roteiro[1].pagina.itens.map((i) => [i.nome, i.preco]);
  assert.deepEqual(pratos, [["Baião arretado", 29.9]], "só a loja da TV, preço do sistema");
  // Monitoramento: último contato e o que está passando.
  const t = db.dados.sinal_telas.find((x) => x.id === T_ID);
  assert.equal(t.ultimo_contato, AGORA.toISOString());
  assert.equal(t.exibindo.nome, "Picanha");
  // A assinatura não muda só porque a URL assinada mudou.
  const outra = r.roteiro.map((s) => (s.url ? { ...s, url: s.url + "&novo" } : s));
  assert.equal(assinaturaDoRoteiro(outra), r.assinatura);
});

test("programação vence o conteúdo fixo dentro do horário", async () => {
  _limparCacheCardapio();
  const db = bancoFalso(comConteudo(), [`${U}/${"b".repeat(24)}.png`]);
  const fixo = await salvarPlaylist(db, U, { nome: "Base", itens: [{ tipo: "cardapio" }] });
  const almoco = await salvarPlaylist(db, U, { nome: "Almoço", itens: [{ tipo: "midia", midia_id: M1 }] });
  await trocarConteudo(db, U, { tela_ids: [T_ID], conteudo: { tipo: "playlist", id: fixo.id } });
  const regra = await salvarProgramacao(db, U, { nome: "Almoço de semana", playlist_id: almoco.id, tela_ids: [T_ID], dias_semana: [1, 2, 3, 4, 5], hora_inicio: "11:00", hora_fim: "15:00", prioridade: 110 });
  assert.equal(regra.ok, true);
  db.dados.sinal_programacoes[0].hora_inicio = "11:00:00"; // o banco devolve time com segundos
  db.dados.sinal_programacoes[0].hora_fim = "15:00:00";
  const r = await conteudoDaTela(db, { segredo: "S".repeat(43), agora: AGORA });
  assert.deepEqual([r.origem, r.regra, r.roteiro[0]?.midia_id], ["programacao", "Almoço de semana", M1]);
  const noite = await conteudoDaTela(db, { segredo: "S".repeat(43), agora: new Date("2026-11-09T23:00:00Z") });
  assert.equal(noite.origem, "fixo");
  // Regra com tela de outra loja é recusada.
  assert.equal((await salvarProgramacao(db, U, { nome: "x", playlist_id: almoco.id, tela_ids: ["77777777-7777-4777-8777-777777777777"] })).status, 400);
});

test("excluir mídia apaga o arquivo e solta a tela que a tinha fixa; excluir playlist solta a tela", async () => {
  const db = bancoFalso(comConteudo(), [`${U}/${"b".repeat(24)}.png`]);
  await trocarConteudo(db, U, { tela_ids: [T_ID], conteudo: { tipo: "midia", id: M1 } });
  assert.equal((await excluirMidia(db, OUTRA, M1)).status, 404, "outra loja não apaga");
  assert.equal((await excluirMidia(db, U, M1)).ok, true);
  assert.deepEqual(db.removidos, [`${U}/${"b".repeat(24)}.png`]);
  assert.equal(db.dados.sinal_telas.find((t) => t.id === T_ID).conteudo, null);
  const pl = await salvarPlaylist(db, U, { nome: "Base", itens: [{ tipo: "cardapio" }] });
  await trocarConteudo(db, U, { tela_ids: [T2_ID], conteudo: { tipo: "playlist", id: pl.id } });
  await excluirPlaylist(db, U, pl.id);
  assert.equal(db.dados.sinal_telas.find((t) => t.id === T2_ID).conteudo, null);
});

test("painel: sem o hash do token, com status; sem tabelas avisa que falta a migração", async () => {
  const db = bancoFalso(comConteudo(), [`${U}/${"b".repeat(24)}.png`]);
  db.dados.sinal_telas[0].ultimo_contato = new Date(AGORA.getTime() - 30000).toISOString();
  const p = await lerPainel(db, U, { agora: AGORA });
  assert.equal(p.ok, true);
  assert.equal(p.telas.length, 2, "só as telas da unidade");
  assert.ok(p.telas.every((t) => !("token_hash" in t)));
  assert.deepEqual(p.telas.map((t) => [t.nome, t.status, t.pareada]), [["Parede 01", "no_ar", true], ["Totem", "aguardando", false]]);
  assert.equal(p.midias.length, 1);
  assert.match(p.midias[0].url, /^https:/);
  const semTab = await lerPainel(bancoFalso({ unidades: [] }), U, { agora: AGORA });
  assert.deepEqual([semTab.ok, semTab.semTabelas], [false, true]);
});
