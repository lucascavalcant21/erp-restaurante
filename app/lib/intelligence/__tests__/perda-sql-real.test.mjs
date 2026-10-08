// stock.registerLoss contra o SQL REAL do estoque do repositório (EST-MOV-1,
// 2 e 3) num Postgres em memória (PGlite), com papel authenticated, auth.uid()
// e as permissões conferidas pelo banco (_estoque_pode → hefisto_user_can).
//
// TESTADO LOCAL (PGlite + SQL do repositório). Não é o banco de produção: o
// mesmo fluxo ainda precisa ser feito com um produto de teste no Héfisto real.
//
// O esquema base é o MESMO do teste do estoque (app/lib/estoque-movimento.test.mjs):
// a FIXTURE é lida daquele arquivo para não existir uma segunda cópia.
// Rode: PGLITE=<caminho de @electric-sql/pglite> node --test app/lib/intelligence/__tests__/perda-sql-real.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBancoF21, clienteSupabase } from "../../teste-banco-f21.mjs";
import { registrarMovimento, quantidadeDoLancamento, novaChave } from "../../estoque-movimento.mjs";
import { resolverContexto } from "../../server/contexto.mjs";
import { criarDbEscopado } from "../context/db-escopado.mjs";
import { montarContextoInteligencia } from "../context/context-engine.mjs";
import { criarVerificador } from "../permissions/mapa.mjs";
import { criarServicoDeAcoes } from "../actions/servico.mjs";
import { processarComando } from "../commands/command-bus.mjs";
import { criarMotorDeMetricas } from "../metrics/engine.mjs";
import { criarStoreMemoria } from "../audit/store-memoria.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const pular = !process.env.PGLITE && "PGLITE não informado";
const U = "seldeestrela";
const UID = { func: "11111111-1111-1111-1111-111111111111", ger: "22222222-2222-2222-2222-222222222222", sem: "33333333-3333-3333-3333-333333333333", outra: "44444444-4444-4444-4444-444444444444" };
const PERFIL = { func: "a0000000-0000-0000-0000-000000000001", ger: "a0000000-0000-0000-0000-000000000002", sem: "a0000000-0000-0000-0000-000000000003" };

function fixtureDoEstoque() {
  const src = fs.readFileSync(path.join(raiz, "app", "lib", "estoque-movimento.test.mjs"), "utf8");
  const m = src.match(/const FIXTURE = `([\s\S]*?)`;\r?\n/); // \r: checkout com CRLF no Windows
  assert.ok(m, "FIXTURE do teste do estoque não encontrada");
  return m[1];
}

let cache = null;
async function banco() {
  if (cache) return cache;
  const pg = await criarBancoF21(raiz, fixtureDoEstoque(), { pgcrypto: true });
  for (const f of ["migracao_estoque_lotes.sql", "migracao_estoque_bebidas.sql", "security/SEC_EST_1_ESTOQUE_ITENS_LOTES_POR_UNIDADE.sql",
    "EST_MOV_1_HISTORICO_IMUTAVEL_E_MOVIMENTOS.sql", "EST_MOV_2_CONTAGEM_SEM_EDICAO.sql", "EST_MOV_3_FECHA_ESCRITA_DIRETA.sql"]) {
    await pg.exec(fs.readFileSync(path.join(raiz, "db", f), "utf8"));
  }
  // colunas de cadastro que existem em produção e o Héfisto lê (busca do produto)
  await pg.exec("alter table public.insumos add column if not exists nome_interno text, add column if not exists marca text;");
  await pg.exec(`
    insert into public.perfil_permissoes (perfil_id, permission_key) values
      ('${PERFIL.func}', 'estoque.movements.create'), ('${PERFIL.ger}', 'estoque.*'), ('${PERFIL.sem}', 'estoque.overview.view');
    insert into public.usuarios_erp (auth_user_id, nome, perfil_id, unidade_principal_id, tipo_acesso) values
      ('${UID.func}', 'Ana (funcionária)', '${PERFIL.func}', '${U}', 'funcionario'),
      ('${UID.ger}', 'Gil (gerente)', '${PERFIL.ger}', '${U}', 'gerente'),
      ('${UID.sem}', 'Sol (só vê)', '${PERFIL.sem}', '${U}', 'funcionario'),
      ('${UID.outra}', 'Oto (outra loja)', '${PERFIL.func}', 'outra', 'funcionario');
  `);
  const um = async (sql, p = []) => (await pg.query(sql, p)).rows[0];
  const cozinha = (await um(`insert into public.estoques (unidade_id, nome, slug) values ($1, 'Cozinha', 'cozinha') returning id`, [U])).id;
  // PRODUTO DE TESTE (nunca um produto de operação)
  const picanha = (await um(`insert into public.insumos (unidade_id, nome, unidade_medida, tamanho_embalagem, unidade_comercial) values ($1, 'Picanha Teste Héfisto', 'kg', 1, 'kg') returning id`, [U])).id;
  const alcatra = (await um(`insert into public.insumos (unidade_id, nome, unidade_medida, tamanho_embalagem, unidade_comercial) values ($1, 'Alcatra Teste Héfisto', 'kg', 1, 'kg') returning id`, [U])).id;
  await pg.exec(`insert into public.estoque_custos (unidade_id, insumo_id, custo_medio_base, saldo_referencia, origem_tipo) values
    ('${U}', '${picanha}', 0.0689, 0, 'COMPRA'), ('${U}', '${alcatra}', 0.0689, 0, 'COMPRA')`);
  const ger = clienteSupabase(pg, { uid: UID.ger });
  for (const [insumo, kg, validade] of [[picanha, "5", "2026-10-09"], [picanha, "7,5", "2026-10-20"], [alcatra, "5", "2026-10-09"], [alcatra, "7,5", "2026-10-20"]]) {
    const r = await registrarMovimento(ger, { unidade_id: U, estoque_id: cozinha, insumo_id: insumo, tipo: "entrada", motivo: "recebimento",
      lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg", tamanho_embalagem: 1, unidade_comercial: "kg" }, fracao: kg }), validade, chave: novaChave() });
    assert.equal(r.error, null);
  }
  cache = { pg, um, cozinha, picanha, alcatra };
  return cache;
}

/** RequestContext REAL (resolverContexto) com a permissão conferida no banco (hefisto_user_can). */
function depsDoBanco(pg) {
  const uidDoToken = (t) => (String(t).startsWith("tok-") ? String(t).slice(4) : null);
  const como = async (uid, sql, p) => {
    await pg.exec("reset role");
    await pg.query("select set_config('request.jwt.claim.sub', $1, false)", [uid]);
    await pg.exec("set role authenticated");
    try { return (await pg.query(sql, p)).rows; } finally { await pg.exec("reset role"); }
  };
  return {
    async validarToken(token) { const uid = uidDoToken(token); return uid ? { id: uid } : null; },
    async contextoDoBanco(token, unidade) {
      const uid = uidDoToken(token);
      const u = (await pg.query("select id, perfil_id, unidade_principal_id from public.usuarios_erp where auth_user_id = $1", [uid])).rows[0];
      if (!u) return { autenticado: false };
      const chaves = (await pg.query("select permission_key from public.perfil_permissoes where perfil_id = $1", [u.perfil_id])).rows.map((r) => r.permission_key);
      const permitida = !unidade || unidade === u.unidade_principal_id;
      return { autenticado: true, cadastrado: true, valido: true, auth_user_id: uid, usuario_erp_id: u.id, super_admin: false, perfil_id: u.perfil_id,
        unidade_id: permitida ? unidade : null, unidade_permitida: permitida, empresa_id: null, unidades: [u.unidade_principal_id], permissoes: chaves, negacoes: [] };
    },
    async podeFazer(token, permissao, unidade) {
      return (await como(uidDoToken(token), "select public.hefisto_user_can($1, $2) as ok", [permissao, unidade]))[0].ok === true;
    },
  };
}

async function hefisto(quem, { store = criarStoreMemoria(), tela = null } = {}) {
  const b = await banco();
  const deps = depsDoBanco(b.pg);
  const r = await resolverContexto({ token: `tok-${UID[quem]}`, unidadeSolicitada: U, canal: "agente", requestId: "req-perda-0001", deps });
  if (!r.ok) return { recusado: r };
  const ctx = r.contexto;
  const agora = new Date();
  const ic = montarContextoInteligencia({ requestContext: ctx, tela, agora });
  const dbUsuario = clienteSupabase(b.pg, { uid: UID[quem] });
  const dbe = criarDbEscopado(dbUsuario, ic.escopo);
  const verificador = criarVerificador(ctx, deps);
  const motor = criarMotorDeMetricas({ dbe, escopo: ic.escopo, verificador, agora });
  const servicoAcoes = criarServicoDeAcoes({ store, escopo: ic.escopo, dbe, dbUsuario, verificador, nomeUsuario: "Ana", relogio: () => new Date() });
  let n = 0;
  const pedir = (texto, extra = {}) => processarComando({ pedido: { texto, chave: extra.chave || `envio-perda-${quem}-${++n}`, ...extra }, ic, motor, servicoAcoes, store, provedor: null, nomeUsuario: "Ana", correlationId: `corr-${n}` });
  const continuar = (acaoId, campo, valor) => processarComando({ pedido: { continuar: { acaoId, campo, valor } }, ic, motor, servicoAcoes, store, provedor: null, correlationId: "corr-c" });
  return { ...b, pedir, continuar, servicoAcoes, store, dbUsuario };
}

const saldo = async (um, estoque, insumo) => Number((await um("select quantidade_atual from public.estoque_itens where estoque_id = $1 and insumo_id = $2", [estoque, insumo]))?.quantidade_atual ?? 0);
const lotes = async (pg, estoque, insumo) => (await pg.query("select validade::text v, quantidade::float q from public.estoque_lotes where estoque_id = $1 and insumo_id = $2 and quantidade > 0 order by validade", [estoque, insumo])).rows.map((r) => `${r.v}=${r.q}`);
const movimentos = async (um, insumo) => Number((await um("select count(*)::int n from public.estoque_movimentacoes_multi where insumo_id = $1", [insumo])).n);

test("Perdi 2 kg → motivo → prévia → nada gravado antes → CONFIRMAR → uma baixa pela estoque_movimentar real", { skip: pular }, async () => {
  const h = await hefisto("func");
  const { pg, um, cozinha, picanha } = h;
  const antes = { saldo: await saldo(um, cozinha, picanha), movimentos: await movimentos(um, picanha), lotes: await lotes(pg, cozinha, picanha) };
  assert.deepEqual(antes, { saldo: 12.5, movimentos: 2, lotes: ["2026-10-09=5", "2026-10-20=7.5"] });

  const r1 = await h.pedir("Perdi 2 kg de picanha teste héfisto.");
  assert.equal(r1.tipo, "pergunta", JSON.stringify(r1).slice(0, 300));
  assert.equal(r1.pergunta.campo, "motivo");
  const r2 = await h.continuar(r1.pergunta.acaoId, "motivo", "limpeza");
  assert.equal(r2.tipo, "confirmacao");
  const linhas = Object.fromEntries(r2.confirmacao.linhas.map((l) => [l.rotulo, l.valor]));
  assert.deepEqual([linhas.Produto, linhas.Local, linhas.Quantidade, linhas.Saldo], ["Picanha Teste Héfisto", "Cozinha", "2 kg", "12,5 → 10,5 kg"]);
  assert.match(linhas["Impacto estimado"], /^R\$\s?137,80 \(ESTIMATIVA — custo médio\)$/);
  assert.equal(await movimentos(um, picanha), 2, "nada gravado antes de confirmar");
  assert.equal(await saldo(um, cozinha, picanha), 12.5);

  const r3 = await h.servicoAcoes.confirmar({ acaoId: r2.confirmacao.acaoId });
  assert.equal(r3.tipo, "resultado_acao", JSON.stringify(r3).slice(0, 300));
  const depois = { saldo: await saldo(um, cozinha, picanha), movimentos: await movimentos(um, picanha), lotes: await lotes(pg, cozinha, picanha) };
  assert.deepEqual(depois, { saldo: 10.5, movimentos: 3, lotes: ["2026-10-09=3", "2026-10-20=7.5"] }, "FEFO: sai do lote que vence primeiro");

  const mov = await um("select * from public.estoque_movimentacoes_multi where chave_idempotencia = $1", [`ia:${r2.confirmacao.acaoId}`]);
  assert.deepEqual(
    [mov.tipo, mov.motivo, mov.origem, Number(mov.quantidade), mov.unidade_medida, Number(mov.saldo_anterior), Number(mov.saldo_posterior), mov.registrado_por, mov.usuario_nome, mov.responsavel_nome, Number(mov.valor_total), mov.custo_origem, mov.unidade_id],
    ["saida", "perda", "movimentacao", 2, "kg", 12.5, 10.5, UID.func, "Ana (funcionária)", null, 137.8, "custo_medio", U]);
  assert.equal(mov.observacao, "Via Héfisto Intelligence — limpeza/aparas");

  // auditoria da inteligência: pedido → proposta → confirmação → execução, com antes/depois
  const etapas = h.store.eventos.map((e) => e.etapa);
  for (const et of ["pedido", "acao_proposta", "acao_confirmada", "acao_executada"]) assert.ok(etapas.includes(et), `auditoria sem ${et}`);
  const exec = h.store.eventos.find((e) => e.etapa === "acao_executada");
  assert.deepEqual([Number(exec.antes.saldo), Number(exec.depois.saldo), exec.entidade_id, exec.unidade_id], [12.5, 10.5, picanha, U]);

  // IDEMPOTÊNCIA: confirmar de novo, e reenviar a MESMA chave direto ao banco
  const r4 = await h.servicoAcoes.confirmar({ acaoId: r2.confirmacao.acaoId });
  assert.equal(r4.repetido, true);
  const reenvio = await registrarMovimento(h.dbUsuario, { unidade_id: U, estoque_id: cozinha, insumo_id: picanha, tipo: "saida", motivo: "perda",
    lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg", tamanho_embalagem: 1, unidade_comercial: "kg" }, fracao: "2" }), chave: `ia:${r2.confirmacao.acaoId}` });
  assert.deepEqual([reenvio.error, reenvio.data.idempotente, reenvio.data.movimento_id], [null, true, mov.id]);
  assert.deepEqual({ saldo: await saldo(um, cozinha, picanha), movimentos: await movimentos(um, picanha) }, { saldo: 10.5, movimentos: 3 }, "não duplicou");
});

test("mesma regra da tela: a baixa do Héfisto e a da tela de movimentação gravam o mesmo movimento", { skip: pular }, async () => {
  const h = await hefisto("func");
  const { um, cozinha, alcatra, picanha } = h;
  // tela (Estoque → Movimentar): mesma quantidade, mesmo motivo, outro produto de teste
  const tela = await registrarMovimento(clienteSupabase(h.pg, { uid: UID.func }), { unidade_id: U, estoque_id: cozinha, insumo_id: alcatra, tipo: "saida", motivo: "perda",
    lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg", tamanho_embalagem: 1, unidade_comercial: "kg" }, fracao: "2" }), chave: novaChave() });
  assert.equal(tela.error, null);
  const movTela = await um("select * from public.estoque_movimentacoes_multi where id = $1", [tela.data.movimento_id]);
  const movIa = await um("select * from public.estoque_movimentacoes_multi where insumo_id = $1 and tipo = 'saida' order by created_at desc limit 1", [picanha]);
  const campos = (m) => [m.tipo, m.motivo, m.origem, Number(m.quantidade), m.unidade_medida, Number(m.saldo_anterior) - Number(m.saldo_posterior), Number(m.valor_unitario), Number(m.valor_total), m.custo_origem, m.registrado_por, JSON.stringify(m.lotes)];
  assert.deepEqual(campos(movIa), campos(movTela));
});

test("sem permissão de retirada: o Héfisto recusa antes de criar a ação (e o banco também recusaria)", { skip: pular }, async () => {
  const h = await hefisto("sem");
  const antes = await movimentos(h.um, h.picanha);
  const r = await h.pedir("Perdi 1 kg de picanha teste héfisto por queda");
  assert.equal(r.tipo, "bloqueado", JSON.stringify(r).slice(0, 300));
  assert.equal(h.store.acoes.size, 0);
  assert.ok(h.store.eventos.some((e) => e.etapa === "bloqueio"));
  const direto = await registrarMovimento(h.dbUsuario, { unidade_id: U, estoque_id: h.cozinha, insumo_id: h.picanha, tipo: "saida", motivo: "perda",
    lancamento: quantidadeDoLancamento({ insumo: { unidade_medida: "kg" }, fracao: "1" }), chave: novaChave() });
  assert.match(direto.error || "", /Sem permissão/);
  assert.equal(await movimentos(h.um, h.picanha), antes);
});

test("usuário de outra unidade não abre a inteligência desta unidade", { skip: pular }, async () => {
  const h = await hefisto("outra");
  assert.ok(h.recusado, "contexto recusado");
  assert.equal(h.recusado.status, 403);
});

test("saldo insuficiente: explica e não grava", { skip: pular }, async () => {
  const h = await hefisto("func");
  const antes = await movimentos(h.um, h.picanha);
  const r = await h.pedir("Perdi 500 kg de picanha teste héfisto por queda");
  assert.match(JSON.stringify(r), /Saldo insuficiente/);
  assert.equal(await movimentos(h.um, h.picanha), antes);
});
