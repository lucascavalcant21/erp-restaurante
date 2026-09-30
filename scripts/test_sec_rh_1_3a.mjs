// SEC-RH-1.3A — arquivos de RH por URL assinada e portais públicos sem grant
// ao anon. Testa as regras de servidor com um banco em memória: autorização
// por unidade e permissão, arquivo que não pertence ao registro, convite de
// uso limitado, campos permitidos, nota calculada no servidor.
//
//   node scripts/test_sec_rh_1_3a.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { lerRef, montarRef, caminhoSeguro, ehLinkExterno } from "../app/lib/storage-ref.mjs";
import { carregarPermissoes, permite } from "../app/lib/server/permissoes-efetivas.mjs";
import {
  assinarUmArquivo, assinarArquivos, prepararEnvio, removerArquivo, ttlDaUrl, BUCKET_RH,
} from "../app/lib/server/rh-arquivos.mjs";
import {
  validarCadastroExtra, registrarCadastroExtra, lerConviteExtra, hashDoToken,
  validarCandidatura, registrarCandidatura, lerTreinamentoPublico,
} from "../app/lib/server/portais-publicos.mjs";

const HOST = "sezccspqxgklicfndwxx.supabase.co";
const urlPublica = (bucket, path) => `https://${HOST}/storage/v1/object/public/${bucket}/${path}`;

// ─── banco em memória ────────────────────────────────────────────────────────
function banco(tabelas = {}) {
  const t = structuredClone(tabelas);
  const assinadas = [];
  const envios = [];
  const removidos = [];
  let seq = 0;
  function from(nome) {
    const st = { op: "select", f: [], gte: [], valor: null, unico: false, head: false, retorno: false };
    const b = {
      select(_c, o) { if (st.op === "select") { st.head = Boolean(o?.head); } else st.retorno = true; return b; },
      insert(v) { st.op = "insert"; st.valor = Array.isArray(v) ? v : [v]; return b; },
      update(v) { st.op = "update"; st.valor = v; return b; },
      eq(k, v) { st.f.push([k, v]); return b; },
      gte(k, v) { st.gte.push([k, v]); return b; },
      maybeSingle() { st.unico = true; return b; }, single() { st.unico = true; return b; },
      then(ok, falha) { return Promise.resolve().then(exec).then(ok, falha); },
    };
    const casa = (l) => st.f.every(([k, v]) => String(l[k]) === String(v)) && st.gte.every(([k, v]) => String(l[k]) >= String(v));
    function exec() {
      const tab = (t[nome] ||= []);
      if (st.op === "select") {
        const r = tab.filter(casa);
        if (st.head) return { count: r.length, error: null };
        return { data: st.unico ? r[0] || null : r, error: null };
      }
      if (st.op === "insert") {
        const novas = st.valor.map((v) => ({ id: `id-${++seq}`, created_at: new Date().toISOString(), ...v }));
        tab.push(...novas);
        return { data: st.unico ? { id: novas[0].id } : novas.map((n) => ({ id: n.id })), error: null };
      }
      if (st.op === "update") {
        const alvo = tab.filter(casa);
        alvo.forEach((l) => Object.assign(l, st.valor));
        return { data: alvo.map((l) => ({ id: l.id })), error: null };
      }
      return { data: null, error: null };
    }
    return b;
  }
  const storage = {
    from: (bucket) => ({
      createSignedUrl: async (path, ttl) => { assinadas.push({ bucket, path, ttl }); return { data: { signedUrl: `https://${HOST}/storage/v1/object/sign/${bucket}/${path}?token=t&ttl=${ttl}` }, error: null }; },
      createSignedUploadUrl: async (path) => { envios.push({ bucket, path }); return { data: { token: "tok-upload", path, signedUrl: "x" }, error: null }; },
      remove: async (paths) => { removidos.push({ bucket, paths }); return { error: null }; },
    }),
  };
  return { db: { from, storage }, t, assinadas, envios, removidos };
}

// Unidades A e B; colaboradores um em cada.
const BASE = {
  colaboradores: [{ id: "cA", unidade_id: "A", foto_url: null }, { id: "cB", unidade_id: "B", foto_url: null }],
  usuario_escopos: [{ usuario_id: "uA", unidade_id: "A", data_scope: "unidade" }],
  documentos_rh: [
    { id: "d1", colaborador_id: "cA", url_arquivo: "storage://rh-docs/A/documentos/cA/x.pdf" },
    { id: "d2", colaborador_id: "cB", url_arquivo: "storage://rh-docs/B/documentos/cB/y.pdf" },
    // registro de A apontando para arquivo de B: tentativa de ler o de outra unidade
    { id: "d3", colaborador_id: "cA", url_arquivo: "storage://rh-docs/B/documentos/cB/y.pdf" },
    { id: "d4", colaborador_id: "cA", url_arquivo: urlPublica("rh-docs", "cA/antigo.pdf") },
    { id: "d5", colaborador_id: "cA", url_arquivo: urlPublica("rh-docs", "cB/de-outro.pdf") },
    { id: "d6", colaborador_id: "cA", url_arquivo: "https://drive.google.com/file/abc" },
    { id: "d7", colaborador_id: "cA", url_arquivo: null },
  ],
  rh_atestados: [{ id: "a1", colaborador_id: "cA", unidade_id: "A", arquivo_url: urlPublica("rh-docs", "atestados/cA/1.jpg") },
    { id: "a2", colaborador_id: "cA", unidade_id: "B", arquivo_url: "storage://rh-docs/A/atestados/cA/z.jpg" }],
  rh_regulamentos: [{ id: "r1", unidade_id: "A", url_pdf: urlPublica("rh-docs", "regulamento-A-123.pdf") },
    { id: "r2", unidade_id: "A", url_pdf: "storage://rh-docs/A/regulamento/A/n.pdf" }],
};
const USUARIO_A = { id: "uA", unidade_id: "A", super_admin: false };
const RH_LE = { superAdmin: false, concedidas: ["rh.employees.view"], negadas: [] };
const RH_TUDO = { superAdmin: false, concedidas: ["rh.*"], negadas: [] };
const SEM_RH = { superAdmin: false, concedidas: ["estoque.*"], negadas: [] };
const assinar = (b, perms, fonteId, id) => assinarUmArquivo({ db: b.db, usuario: USUARIO_A, perms, fonteId, id, ttl: 120, hostEsperado: HOST });

// ─── referência de arquivo ───────────────────────────────────────────────────
test("storage-ref: URL antiga, referência nova e caminhos maliciosos", () => {
  assert.deepEqual(lerRef(urlPublica("rh-docs", "cA/a%20b.pdf"), { hostEsperado: HOST }),
    { bucket: "rh-docs", path: "cA/a b.pdf", formato: "url_publica" });
  assert.deepEqual(lerRef("storage://rh-docs/A/x.pdf"), { bucket: "rh-docs", path: "A/x.pdf", formato: "ref" });
  assert.equal(lerRef("storage://rh-docs/../segredo"), null);
  assert.equal(lerRef("storage://rh-docs/A/%2e%2e/x"), null, "referência com caractere codificado é recusada");
  assert.equal(lerRef(urlPublica("rh-docs", "A/%2e%2e/x"), { hostEsperado: HOST }), null, "'..' codificado também é recusado");
  assert.equal(lerRef("https://outro.supabase.co/storage/v1/object/public/rh-docs/x", { hostEsperado: HOST }), null);
  assert.equal(caminhoSeguro("/abs"), false);
  assert.equal(caminhoSeguro("a\\b"), false);
  assert.throws(() => montarRef("rh-docs", "../x"));
  assert.equal(ehLinkExterno("https://drive.google.com/x", { hostEsperado: HOST }), true);
  assert.equal(ehLinkExterno(urlPublica("rh-docs", "x"), { hostEsperado: HOST }), false);
});

test("TTL da URL assinada: padrão 120 s, sempre entre 30 s e 10 min", () => {
  assert.equal(ttlDaUrl({}), 120);
  assert.equal(ttlDaUrl({ RH_ARQUIVO_URL_TTL_SEGUNDOS: "5" }), 30);
  assert.equal(ttlDaUrl({ RH_ARQUIVO_URL_TTL_SEGUNDOS: "86400" }), 600);
  assert.equal(ttlDaUrl({ RH_ARQUIVO_URL_TTL_SEGUNDOS: "abc" }), 120);
});

// ─── permissões efetivas ─────────────────────────────────────────────────────
test("permissões: perfil + allow − deny; perfil inativo tira tudo; falha nega", async () => {
  const b = banco({
    usuarios_erp: [{ id: "u1", perfil_id: "p1" }, { id: "u2", perfil_id: "p2" }],
    perfis_acesso: [{ id: "p1", ativo: true }, { id: "p2", ativo: false }],
    perfil_permissoes: [{ perfil_id: "p1", permission_key: "rh.*" }, { perfil_id: "p2", permission_key: "*" }],
    usuario_permissoes: [{ usuario_id: "u1", permission_key: "rh.payroll.view", effect: "deny" },
      { usuario_id: "u2", permission_key: "rh.employees.view", effect: "allow" }],
  });
  const p1 = await carregarPermissoes(b.db, { id: "u1" });
  assert.equal(permite(p1, "rh.employees.view"), true);
  assert.equal(permite(p1, "rh.payroll.view"), false, "deny vence o curinga do perfil");
  const p2 = await carregarPermissoes(b.db, { id: "u2" });
  assert.equal(permite(p2, "rh.employees.view"), false, "perfil inativo: nem a concessão direta vale");
  assert.equal(permite(await carregarPermissoes(b.db, { id: "u1", super_admin: true }), "rh.payroll.view"), true);
  const quebrado = { from: () => { throw new Error("rede"); } };
  assert.equal(permite(await carregarPermissoes(quebrado, { id: "u1" }), "rh.employees.view"), false);
});

// ─── assinar ─────────────────────────────────────────────────────────────────
test("autorizado na unidade do registro → URL assinada curta", async () => {
  const b = banco(BASE);
  const r = await assinar(b, RH_LE, "documento", "d1");
  assert.equal(r.ok, true);
  assert.match(r.url, /\/object\/sign\/rh-docs\/A\/documentos\/cA\/x\.pdf/);
  assert.deepEqual(b.assinadas, [{ bucket: "rh-docs", path: "A/documentos/cA/x.pdf", ttl: 120 }]);
  assert.ok(r.expiraEm);
});

test("registro de OUTRA unidade → 403, nada é assinado", async () => {
  const b = banco(BASE);
  const r = await assinar(b, RH_TUDO, "documento", "d2");
  assert.equal(r.status, 403);
  assert.equal(b.assinadas.length, 0);
});

test("sessão da unidade, sem permissão de RH → 403", async () => {
  const b = banco(BASE);
  const r = await assinar(b, SEM_RH, "documento", "d1");
  assert.equal(r.status, 403);
  assert.equal(r.codigo, "sem_permissao");
  assert.equal(b.assinadas.length, 0);
});

test("registro da unidade A apontando para arquivo da unidade B → 403", async () => {
  const b = banco(BASE);
  assert.equal((await assinar(b, RH_TUDO, "documento", "d3")).codigo, "referencia_inconsistente");
  assert.equal((await assinar(b, RH_TUDO, "documento", "d5")).codigo, "referencia_inconsistente", "URL antiga de outro colaborador");
  assert.equal(b.assinadas.length, 0);
});

test("URL pública ANTIGA continua abrindo — agora assinada", async () => {
  const b = banco(BASE);
  const r = await assinar(b, RH_LE, "documento", "d4");
  assert.equal(r.ok, true);
  assert.deepEqual(b.assinadas[0], { bucket: "rh-docs", path: "cA/antigo.pdf", ttl: 120 });
  const at = await assinar(b, RH_LE, "atestado", "a1");
  assert.equal(at.ok, true);
  const reg = await assinar(b, RH_LE, "regulamento", "r1");
  assert.equal(reg.ok, true);
  const regNovo = await assinar(b, RH_LE, "regulamento", "r2");
  assert.equal(regNovo.ok, true);
});

test("registro com unidade própria diferente da do colaborador → 403", async () => {
  const b = banco(BASE);
  assert.equal((await assinar(b, RH_TUDO, "atestado", "a2")).codigo, "referencia_inconsistente");
});

test("link externo sai como está, só depois da autorização; sem arquivo → 404", async () => {
  const b = banco(BASE);
  const ext = await assinar(b, RH_LE, "documento", "d6");
  assert.equal(ext.ok, true);
  assert.equal(ext.externo, true);
  assert.equal((await assinar(b, SEM_RH, "documento", "d6")).status, 403);
  assert.equal((await assinar(b, RH_LE, "documento", "d7")).status, 404);
});

test("fonte e id inválidos → 400; registro inexistente → 404", async () => {
  const b = banco(BASE);
  assert.equal((await assinar(b, RH_LE, "senhas", "d1")).status, 400);
  assert.equal((await assinar(b, RH_LE, "documento", "../d1")).status, 400);
  assert.equal((await assinar(b, RH_LE, "documento", "nao-existe")).status, 404);
});

test("lote: cada item autorizado sozinho; limite de tamanho", async () => {
  const b = banco(BASE);
  const r = await assinarArquivos({ db: b.db, usuario: USUARIO_A, perms: RH_LE, itens: [{ fonte: "documento", id: "d1" }, { fonte: "documento", id: "d2" }], ttl: 120, hostEsperado: HOST });
  assert.deepEqual(r.itens.map((i) => i.ok), [true, false]);
  const grande = await assinarArquivos({ db: b.db, usuario: USUARIO_A, perms: RH_LE, itens: Array(61).fill({ fonte: "documento", id: "d1" }) });
  assert.equal(grande.status, 400);
});

// ─── enviar ──────────────────────────────────────────────────────────────────
test("envio: o servidor escolhe o caminho, no bucket privado, com unidade e dono", async () => {
  const b = banco(BASE);
  const r = await prepararEnvio({ db: b.db, usuario: USUARIO_A, perms: RH_TUDO, fonteId: "atestado", donoId: "cA", nomeArquivo: "../../x.PDF", tamanho: 1000 });
  assert.equal(r.ok, true);
  assert.equal(r.bucket, BUCKET_RH);
  assert.match(r.path, /^A\/atestados\/cA\/[0-9a-f-]{36}\.pdf$/, "nome enviado pelo cliente não entra no caminho");
  assert.equal(r.ref, `storage://rh-docs/${r.path}`);
});

test("envio: colaborador de outra unidade, sem permissão, formato e tamanho", async () => {
  const b = banco(BASE);
  const base = { db: b.db, usuario: USUARIO_A, fonteId: "documento", nomeArquivo: "a.pdf", tamanho: 10 };
  assert.equal((await prepararEnvio({ ...base, perms: RH_TUDO, donoId: "cB" })).status, 403);
  assert.equal((await prepararEnvio({ ...base, perms: RH_LE, donoId: "cA" })).status, 403, "ler não dá direito de enviar");
  assert.equal((await prepararEnvio({ ...base, perms: RH_TUDO, donoId: "cA", nomeArquivo: "a.exe" })).status, 400);
  assert.equal((await prepararEnvio({ ...base, perms: RH_TUDO, donoId: "cA", tamanho: 999 * 1024 * 1024 })).status, 400);
  assert.equal(b.envios.length, 0);
});

test("foto de colaborador ainda não cadastrado vai para 'novo' e é lida pela unidade", async () => {
  const b = banco(BASE);
  const env = await prepararEnvio({ db: b.db, usuario: USUARIO_A, perms: RH_TUDO, fonteId: "foto_colaborador", donoId: null, unidadeId: "A", nomeArquivo: "f.jpg", tamanho: 10 });
  assert.match(env.path, /^A\/fotos\/novo\//);
  b.t.colaboradores[0].foto_url = env.ref;
  assert.equal((await assinar(b, RH_LE, "foto_colaborador", "cA")).ok, true);
  const semUnidade = await prepararEnvio({ db: b.db, usuario: USUARIO_A, perms: RH_TUDO, fonteId: "foto_colaborador", donoId: null, unidadeId: "B", nomeArquivo: "f.jpg", tamanho: 10 });
  assert.equal(semUnidade.status, 403);
});

test("remover: autoriza, confere o dono e só então apaga o objeto", async () => {
  const b = banco(BASE);
  assert.equal((await removerArquivo({ db: b.db, usuario: USUARIO_A, perms: RH_LE, fonteId: "documento", id: "d1", hostEsperado: HOST })).status, 403);
  assert.equal((await removerArquivo({ db: b.db, usuario: USUARIO_A, perms: RH_TUDO, fonteId: "documento", id: "d3", hostEsperado: HOST })).status, 403);
  const ok = await removerArquivo({ db: b.db, usuario: USUARIO_A, perms: RH_TUDO, fonteId: "documento", id: "d1", hostEsperado: HOST });
  assert.deepEqual([ok.ok, ok.removido], [true, true]);
  assert.deepEqual(b.removidos, [{ bucket: "rh-docs", paths: ["A/documentos/cA/x.pdf"] }]);
});

// ─── portal de extras ────────────────────────────────────────────────────────
const FORM = {
  nome: "Maria Teste", telefone: "(61) 99999-0000", funcao_principal: "Garçom", dias_disponiveis: ["sab", "xyz"],
  data_nascimento: "1995-02-10", interesse: "ambos",
  status: "aprovado", colaborador_id: "cA", chave_pix: "roubada", unidade_id: "B",
};

test("cadastro de extra: só campos permitidos; status, vínculo e PIX do cliente são ignorados", () => {
  const v = validarCadastroExtra("A", FORM, { q1: "Sim", "bad key": "x" });
  assert.equal(v.ok, true);
  assert.equal(v.payload.unidade_id, "A", "a unidade vem da URL do portal, não do corpo");
  for (const proibido of ["status", "colaborador_id", "chave_pix"]) assert.equal(proibido in v.payload, false, proibido);
  assert.deepEqual(v.payload.dias_disponiveis, ["sab"]);
  assert.deepEqual(v.payload.respostas, { q1: "Sim" });
  assert.equal(validarCadastroExtra("A", { ...FORM, telefone: "123" }).status, 400);
  assert.equal(validarCadastroExtra("A", { ...FORM, data_nascimento: "2031-01-01" }).status, 400);
  assert.equal(validarCadastroExtra("../x", FORM).status, 400);
});

test("cadastro: unidade inexistente 404; convite só com interesse em CLT; limite por telefone", async () => {
  const b = banco({ unidades: [{ id: "A" }] });
  const v = validarCadastroExtra("A", FORM);
  assert.equal((await registrarCadastroExtra({ db: b.db, payload: { ...v.payload, unidade_id: "Z" } })).status, 404);
  const r = await registrarCadastroExtra({ db: b.db, payload: v.payload });
  assert.equal(r.ok, true);
  assert.match(r.convite, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(b.t.extras_convites[0].token_hash, hashDoToken(r.convite), "só o hash vai para o banco");
  assert.equal("id" in r, false, "o id do cadastro não volta ao navegador");
  const soExtra = await registrarCadastroExtra({ db: b.db, payload: { ...v.payload, interesse: "extra" } });
  assert.equal(soExtra.convite, null);
  // Mesmo telefone: 3 envios em 10 minutos passam, o 4º é freado.
  assert.equal((await registrarCadastroExtra({ db: b.db, payload: v.payload })).ok, true);
  assert.equal((await registrarCadastroExtra({ db: b.db, payload: v.payload })).status, 429);
});

test("convite: devolve só os campos do formulário, expira e se gasta", async () => {
  const b = banco({ unidades: [{ id: "A" }] });
  const v = validarCadastroExtra("A", FORM);
  const { convite } = await registrarCadastroExtra({ db: b.db, payload: v.payload });
  const r = await lerConviteExtra({ db: b.db, token: convite });
  assert.equal(r.ok, true);
  assert.equal(r.dados.nome, "Maria Teste");
  assert.deepEqual(Object.keys(r.dados).sort(), ["cidade", "data_nascimento", "endereco", "bairro", "escolaridade", "experiencia", "funcao_principal", "nome", "telefone", "tem_filhos"].filter((k) => k in r.dados).sort());
  for (const nunca of ["id", "unidade_id", "status", "respostas", "chave_pix", "observacoes"]) assert.equal(nunca in r.dados, false, nunca);
  await lerConviteExtra({ db: b.db, token: convite });
  await lerConviteExtra({ db: b.db, token: convite });
  assert.equal((await lerConviteExtra({ db: b.db, token: convite })).status, 404, "3 usos e acabou");
  assert.equal((await lerConviteExtra({ db: b.db, token: "x".repeat(43) })).status, 404);
  assert.equal((await lerConviteExtra({ db: b.db, token: b.t.extras_cadastros[0].id })).status, 404, "o id do cadastro não serve de convite");
  const { convite: c2 } = await registrarCadastroExtra({ db: banco({ unidades: [{ id: "A" }] }).db, payload: v.payload });
  const expirado = await lerConviteExtra({ db: b.db, token: c2, agora: Date.now() + 31 * 60 * 1000 });
  assert.equal(expirado.status, 404);
});

// ─── candidatura ─────────────────────────────────────────────────────────────
test("candidatura: nota e status calculados no servidor, não vindos do navegador", async () => {
  const gerarLaudo = (resp) => ({ nota_ia: Object.keys(resp).length * 10, avaliacao_ia: "laudo do servidor" });
  const v = validarCandidatura("A", { nome: "João Teste", telefone: "61999990000", cpf: "123", nota_ia: 100, status: "Contratado" }, { p1: "a" }, { gerarLaudo });
  assert.equal(v.status, 400, "CPF inválido é recusado");
  const ok = validarCandidatura("A", { nome: "João Teste", telefone: "61999990000", nota_ia: 100, status: "Contratado", url_curriculo: "https://x" }, { p1: "a", p2: "b" }, { gerarLaudo });
  assert.equal(ok.payload.nota_ia, 20);
  assert.equal(ok.payload.status, "Novo");
  assert.equal(ok.payload.url_curriculo, null);
  const b = banco({ unidades: [{ id: "A" }] });
  assert.equal((await registrarCandidatura({ db: b.db, payload: ok.payload })).ok, true);
  assert.equal(b.t.candidatos.length, 1);
});

// ─── treinamento público ─────────────────────────────────────────────────────
test("treinamento público: por token, só campos publicáveis", async () => {
  const token = "a".repeat(64);
  const b = banco({ treinamentos: [{ id: "t1", unidade_id: "A", token_publico: token, titulo: "Boas-vindas", descricao: "Texto", link_video: "https://youtu.be/x", criado_por: "gerente", created_at: "2026-01-01" }] });
  const r = await lerTreinamentoPublico({ db: b.db, token });
  assert.equal(r.ok, true);
  assert.equal(r.treinamento.titulo, "Boas-vindas");
  for (const nunca of ["id", "unidade_id", "token_publico", "criado_por", "created_at"]) assert.equal(nunca in r.treinamento, false, nunca);
  assert.equal((await lerTreinamentoPublico({ db: b.db, token: "t1" })).status, 404, "o id do registro não abre o treinamento");
  assert.equal((await lerTreinamentoPublico({ db: b.db, token: "b".repeat(64) })).status, 404);
});
