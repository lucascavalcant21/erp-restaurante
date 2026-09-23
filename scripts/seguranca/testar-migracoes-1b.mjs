// Testes das migrações da Fase 1B num Postgres real local (PGlite).
// Mesma base da 1A (banco-teste.mjs), com duas empresas, unidade C e os perfis
// da matriz: super, administrador da empresa, gerentes A e B, RH, financeiro,
// cozinha, garçom, quiosque, sem perfil, autocadastro bloqueado e legado.
//
//   PGLITE_DIR=/caminho/node_modules/@electric-sql/pglite node --test scripts/seguranca/testar-migracoes-1b.mjs

import test from "node:test";
import assert from "node:assert/strict";
import { SQL, novoBanco, como, contar, relatorio, USUARIO, ler } from "./banco-teste.mjs";

const EMPRESA_DOIS = "e0000000-0000-0000-0000-000000000002";
const idErp = async (db, quem) => (await db.query(`select id from public.usuarios_erp where auth_user_id = '${USUARIO[quem]}'`)).rows[0]?.id;
const valor = async (db, quem, expr, opts) => {
  const r = await como(db, quem, `select ${expr} as v`, opts);
  if (!r.ok) throw new Error(r.erro);
  return r.linhas[0].v;
};

/* ───────────────────────── MIGRAÇÃO 01 ───────────────────────── */

test("01: recusa rodar sem a Etapa 3 e não altera nada", async () => {
  const db = await novoBanco("etapa2");
  await assert.rejects(db.exec(SQL.m01), /Etapa 3/);
  await db.exec("rollback");
  const f = await db.query("select to_regprocedure('public.hefisto_contexto_requisicao(text)') is null as ausente");
  assert.equal(f.rows[0].ausente, true);
});

test("01: idempotente e pós-check aprova", async () => {
  const db = await novoBanco("m01");
  const r = relatorio(await db.exec(SQL.m01));
  assert.ok(r.some((l) => l.verificacao === "Migração 01 concluída"));
  assert.ok(!r.some((l) => /pós-check/.test(l.etapa) && l.situacao !== "OK"));
});

test("01: escopo 'empresa' deixa de enxergar unidade de OUTRA empresa", async () => {
  const antes = await novoBanco("etapa3");
  assert.equal(await contar(antes, "adminEmpresa", "lancamentos"), 3, "reproduz o defeito: empresa valia como todas");
  const depois = await novoBanco("m01");
  assert.equal(await contar(depois, "adminEmpresa", "lancamentos"), 2);
  assert.equal(await contar(depois, "adminEmpresa", "unidades"), 2);
  assert.equal(await contar(depois, "super", "lancamentos"), 3);
});

test("01: perfil desativado deixa de dar permissão", async () => {
  const antes = await novoBanco("etapa3");
  await antes.exec("update public.perfis_acesso set ativo = false where codigo = 'gerente-geral'");
  assert.equal(await contar(antes, "gerenteA", "contas_pagar"), 1, "reproduz o defeito");
  const depois = await novoBanco("m01");
  await depois.exec("update public.perfis_acesso set ativo = false where codigo = 'gerente-geral'");
  assert.equal(await contar(depois, "gerenteA", "contas_pagar"), 0);
  assert.equal(await contar(depois, "gerenteA", "produtos"), 0, "sem perfil ativo, nem a tabela comum da unidade");
});

test("01: usuário SEM PERFIL e AUTOCADASTRO bloqueado ficam sem escopo", async () => {
  const antes = await novoBanco("etapa3");
  assert.equal(await contar(antes, "semPerfil", "produtos"), 3, "reproduz o defeito: ativo sem perfil via a unidade");
  const db = await novoBanco("m01");
  for (const quem of ["semPerfil", "autocadastro", "legado"]) {
    for (const t of ["produtos", "unidades", "colaboradores", "contas_pagar", "equipe_unidade"]) {
      assert.equal(await contar(db, quem, t), 0, `${quem} lê ${t}`);
    }
    assert.deepEqual(await valor(db, quem, "public.hefisto_escopo_unidades()"), []);
  }
});

test("01: contexto da requisição valida a unidade e tira a empresa do banco", async () => {
  const db = await novoBanco("m01");
  const propria = await valor(db, "gerenteA", "public.hefisto_contexto_requisicao('unidade-a')");
  assert.equal(propria.valido, true);
  assert.equal(propria.unidade_id, "unidade-a");
  assert.equal(propria.unidade_permitida, true);
  assert.ok(propria.permissoes.includes("rh.*"));
  const hefisto = (await db.query("select id from public.empresas where nome = 'Hefisto'")).rows[0].id;
  assert.equal(propria.empresa_id, hefisto);

  const alheia = await valor(db, "gerenteA", "public.hefisto_contexto_requisicao('unidade-b')");
  assert.equal(alheia.unidade_id, null, "unidade fora do escopo não volta");
  assert.equal(alheia.unidade_permitida, false);
  const inventada = await valor(db, "gerenteA", "public.hefisto_contexto_requisicao('nao-existe')");
  assert.equal(inventada.unidade_permitida, false);

  const outraEmpresa = await valor(db, "adminEmpresa", "public.hefisto_contexto_requisicao('unidade-c')");
  assert.equal(outraEmpresa.unidade_permitida, false);
  assert.notEqual(outraEmpresa.empresa_id, EMPRESA_DOIS);

  assert.deepEqual((await valor(db, "super", "public.hefisto_contexto_requisicao('unidade-c')")).permissoes, ["*"]);
  assert.equal((await valor(db, "legado", "public.hefisto_contexto_requisicao(null)")).cadastrado, false);
  assert.equal((await valor(db, "autocadastro", "public.hefisto_contexto_requisicao('unidade-a')")).valido, false);
  const anon = await como(db, "anon", "select public.hefisto_contexto_requisicao('unidade-a')");
  assert.equal(anon.ok, false);
});

test("01: contexto de auditoria lê request id e canal dos cabeçalhos, sem aceitar lixo", async () => {
  const db = await novoBanco("m01");
  const ok = await valor(db, "gerenteA", "public.hefisto_contexto_auditoria()", { cabecalhos: { "x-request-id": "3f1c2b9a-0000-4000-8000-000000000001", "x-hefisto-canal": "quiosque" } });
  assert.equal(ok.request_id, "3f1c2b9a-0000-4000-8000-000000000001");
  assert.equal(ok.canal, "quiosque");
  assert.equal(ok.auth_user_id, USUARIO.gerenteA);
  const lixo = await valor(db, "gerenteA", "public.hefisto_contexto_auditoria()", { cabecalhos: { "x-request-id": "'; drop table x; --", "x-hefisto-canal": "root" } });
  assert.equal(lixo.request_id, null);
  assert.equal(lixo.canal, null);
});

test("01: ninguém concede o que não tem nem gerencia fora do escopo", async () => {
  const db = await novoBanco("m01");
  const fn = (sql) => valor(db, "servico", sql);
  assert.deepEqual(await fn(`public.hefisto_chaves_nao_concediveis('${USUARIO.gerenteA}', array['rh.employees.view','*','configuracoes.users.create'])`),
    ["*", "configuracoes.users.create"]);
  assert.deepEqual(await fn(`public.hefisto_chaves_nao_concediveis('${USUARIO.super}', array['*'])`), []);
  assert.deepEqual(await fn(`public.hefisto_chaves_nao_concediveis('${USUARIO.semPerfil}', array['dashboard.overview.view'])`), ["dashboard.overview.view"]);

  const alvo = async (quem) => idErp(db, quem);
  assert.equal(await fn(`public.hefisto_pode_gerenciar_usuario('${USUARIO.gerenteA}', '${await alvo("rhA")}')`), true);
  assert.equal(await fn(`public.hefisto_pode_gerenciar_usuario('${USUARIO.gerenteA}', '${await alvo("gerenteB")}')`), false, "outra unidade");
  assert.equal(await fn(`public.hefisto_pode_gerenciar_usuario('${USUARIO.gerenteA}', '${await alvo("super")}')`), false, "administrador geral");
  assert.equal(await fn(`public.hefisto_pode_gerenciar_usuario('${USUARIO.gerenteA}', '${await alvo("gerenteA")}')`), false, "a si mesmo");
  assert.equal(await fn(`public.hefisto_pode_gerenciar_usuario('${USUARIO.adminEmpresa}', '${await alvo("gerenteB")}')`), true, "unidade B é da empresa dele");
  assert.equal(await fn(`public.hefisto_pode_gerenciar_usuario('${USUARIO.semPerfil}', '${await alvo("garcomA")}')`), false, "ator inválido");

  const negados = await fn(`public.hefisto_escopos_nao_concediveis('${USUARIO.gerenteA}', '[{"data_scope":"todos"},{"data_scope":"unidade","unidade_id":"unidade-b"},{"data_scope":"unidade","unidade_id":"unidade-a"}]'::jsonb)`);
  assert.deepEqual(negados.map((e) => e.data_scope + ":" + (e.unidade_id || "")), ["todos:", "unidade:unidade-b"]);
  const hefisto = (await db.query("select id from public.empresas where nome = 'Hefisto'")).rows[0].id;
  assert.deepEqual(await fn(`public.hefisto_escopos_nao_concediveis('${USUARIO.adminEmpresa}', '[{"data_scope":"empresa","empresa_id":"${hefisto}"}]'::jsonb)`), []);
  assert.equal((await fn(`public.hefisto_escopos_nao_concediveis('${USUARIO.adminEmpresa}', '[{"data_scope":"empresa","empresa_id":"${EMPRESA_DOIS}"}]'::jsonb)`)).length, 1);
});

test("01: usuário logado não executa funções sobre terceiros (descobriria permissão alheia)", async () => {
  const db = await novoBanco("m01");
  for (const f of [`public.hefisto_chaves_nao_concediveis('${USUARIO.super}', array['*'])`,
    `public.hefisto_pode_gerenciar_usuario('${USUARIO.super}', gen_random_uuid())`,
    `public.hefisto_unidades_do_usuario('${USUARIO.super}')`,
    `public.hefisto_tem_alguma_permissao('${USUARIO.super}', array['*'])`,
    `public.hefisto_user_has_permission('${USUARIO.super}', 'rh.employees.view')`]) {
    const r = await como(db, "gerenteA", `select ${f}`);
    assert.equal(r.ok, false, `logado executou ${f}`);
    assert.match(r.erro, /permission denied/);
  }
});

test("01: garantias da Fase 1A continuam (garçom sem RH, PIN na unidade, livro só acréscimo)", async () => {
  const db = await novoBanco("m01");
  for (const t of ["colaboradores", "rh_atestados", "contas_pagar", "lancamentos"]) assert.equal(await contar(db, "garcomA", t), 0, t);
  assert.equal((await como(db, "gerenteA", "select public.pin_verificar('unidade-a','pin_gerente','9876') r")).linhas[0].r.ok, true);
  assert.equal((await como(db, "garcomA", "select public.pin_verificar('unidade-b','pin_gerente','9876') r")).ok, false);
  assert.equal((await como(db, "super", "delete from public.ponto_marcacao")).afetadas, 0);
  assert.equal(await contar(db, "anon", "colaboradores"), "negado");
});

test("01: rollback restaura as definições antigas; reaplicar funciona", async () => {
  const db = await novoBanco("m01");
  await db.exec(SQL.r01);
  assert.equal(await contar(db, "adminEmpresa", "lancamentos"), 3, "voltou o comportamento anterior");
  assert.equal((await db.query("select to_regprocedure('public.hefisto_contexto_requisicao(text)') is null as a")).rows[0].a, true);
  await db.exec(SQL.m01);
  assert.equal(await contar(db, "adminEmpresa", "lancamentos"), 2);
});

test("01: com uma empresa só, unidade sem empresa passa a ser dela; o rollback desfaz", async () => {
  const db = await novoBanco("etapa3");
  await db.exec(`delete from public.lancamentos where unidade_id = 'unidade-c'; delete from public.produtos where unidade_id = 'unidade-c';
    delete from public.unidades where id = 'unidade-c'; delete from public.empresas where id = '${EMPRESA_DOIS}';
    update public.unidades set empresa_id = null where id = 'unidade-b';`);
  const r = relatorio(await db.exec(SQL.m01));
  assert.ok(r.some((l) => /única empresa/.test(l.verificacao) && l.detalhe === "1"));
  assert.equal((await db.query("select empresa_id is not null as ok from public.unidades where id = 'unidade-b'")).rows[0].ok, true);
  assert.equal(await contar(db, "adminEmpresa", "lancamentos"), 2);
  await db.exec(SQL.r01);
  assert.equal((await db.query("select empresa_id is null as ok from public.unidades where id = 'unidade-b'")).rows[0].ok, true);
});

/* ───────────────────────── MIGRAÇÃO 02 ───────────────────────── */

test("02: recusa rodar sem a 01", async () => {
  const db = await novoBanco("etapa3");
  await assert.rejects(db.exec(SQL.m02), /migração 01/);
});

test("02: mapa e simulação em dia com o código", async () => {
  const { gerarLinhasMapa, blocoSql, aplicarNoArquivo, documento } = await import("./gerar-mapa-rls.mjs");
  const { gerarSimulacao02 } = await import("./gerar-simulacao-1b.mjs");
  const mapa = gerarLinhasMapa();
  const fonte = SQL.m02.replace(/\r\n/g, "\n");
  assert.equal(aplicarNoArquivo(fonte, blocoSql(mapa)), fonte, "rode node scripts/seguranca/gerar-mapa-rls.mjs");
  assert.equal(ler("docs/seguranca/FASE_1B_MAPA_RLS.md").replace(/\r\n/g, "\n"), documento(mapa), "rode node scripts/seguranca/gerar-mapa-rls.mjs");
  assert.equal(SQL.simulacao02.replace(/\r\n/g, "\n"), gerarSimulacao02(SQL.m02), "rode node scripts/seguranca/gerar-simulacao-1b.mjs");
});

test("02: idempotente, pós-check aprova e relatório mostra filhas e tabelas negadas", async () => {
  const db = await novoBanco("m02");
  const r = relatorio(await db.exec(SQL.m02));
  assert.ok(r.some((l) => l.verificacao === "Migração 02 concluída"));
  assert.ok(!r.some((l) => /pós-check/.test(l.etapa) && l.situacao !== "OK"));
  const negadas = r.find((l) => /que o app não usa/.test(l.verificacao)).detalhe;
  for (const t of ["tabela_esquecida", "anotacoes_soltas", "pedido_anexos", "acessos_modulo"]) assert.match(negadas, new RegExp(t));
  const filhas = r.find((l) => /tabela-pai/.test(l.verificacao)).detalhe;
  for (const t of ["pedidos_itens → pedidos", "fichas_ingredientes → fichas_tecnicas", "documentos_rh → colaboradores", "evento_pratos → eventos"]) assert.ok(filhas.includes(t), t);
});

test("02: simulação não grava nada e mostra a mudança antes de aplicar", async () => {
  const db = await novoBanco("m01");
  const antes = (await db.query("select count(*)::int n from pg_policies")).rows[0].n;
  const matriz = relatorio(await db.exec(SQL.simulacao02));
  const garcom = matriz.find((l) => l.login === "garcom.a" && l.tabela === "fichas_tecnicas");
  assert.deepEqual([garcom.ler_antes, garcom.ler_depois], ["1", "0"]);
  assert.match(garcom.escrever_antes, /D:unidade-a/);
  assert.equal(garcom.escrever_depois, "I:- U:- D:-");
  assert.equal((await db.query("select count(*)::int n from pg_policies")).rows[0].n, antes);
  assert.equal((await db.query("select to_regclass('hefisto_privado.mapa_rls_v2') is null as a")).rows[0].a, true);
});

test("02: garçom deixa de apagar ficha técnica e insumo (antes podia)", async () => {
  const antes = await novoBanco("m01");
  assert.equal((await como(antes, "garcomA", "delete from public.fichas_tecnicas where unidade_id = 'unidade-a'")).afetadas, 1, "reproduz o defeito");
  const db = await novoBanco("m02");
  assert.equal((await como(db, "garcomA", "delete from public.fichas_tecnicas where unidade_id = 'unidade-a'")).afetadas, 0);
  assert.equal((await como(db, "garcomA", "update public.insumos set custo_unitario = 0")).afetadas, 0);
  assert.equal((await como(db, "garcomA", "insert into public.fichas_tecnicas (unidade_id, nome_receita) values ('unidade-a', 'x')")).ok, false);
  assert.equal((await como(db, "cozinhaA", "update public.fichas_tecnicas set nome_receita = 'Molho novo' where unidade_id = 'unidade-a'")).afetadas, 1, "cozinha edita receita da própria unidade");
  assert.equal((await como(db, "cozinhaA", "update public.fichas_tecnicas set nome_receita = 'x' where unidade_id = 'unidade-b'")).afetadas, 0);
});

test("02: tabelas-filho seguem a unidade do pai (leitura e escrita)", async () => {
  const db = await novoBanco("m02");
  assert.equal(await contar(db, "gerenteA", "pedidos_itens"), 1);
  assert.equal(await contar(db, "gerenteB", "pedidos_itens"), 1);
  assert.equal(await contar(db, "super", "pedidos_itens"), 2);
  assert.equal(await contar(db, "gerenteA", "evento_pratos"), 1);
  assert.equal(await contar(db, "cozinhaA", "fichas_ingredientes"), 1);
  const alheio = await como(db, "gerenteA", "insert into public.pedidos_itens (pedido_id, quantidade, valor_unitario) values ('30000000-0000-0000-0000-00000000000b', 1, 1)");
  assert.equal(alheio.ok, false, "item em pedido de outra unidade");
  const proprio = await como(db, "gerenteA", "insert into public.pedidos_itens (pedido_id, quantidade, valor_unitario) values ('30000000-0000-0000-0000-00000000000a', 1, 1)");
  assert.ok(proprio.ok, proprio.erro);
  assert.equal((await como(db, "gerenteA", "delete from public.evento_pratos where evento_id = '40000000-0000-0000-0000-00000000000b'")).afetadas, 0);
  const orfao = await como(db, "gerenteA", "insert into public.pedidos_itens (pedido_id, quantidade) values (gen_random_uuid(), 1)");
  assert.equal(orfao.ok, false, "item sem pai conhecido");
});

test("02: documento de RH por funcionário: só RH da unidade do funcionário; cozinha e garçom nada", async () => {
  const db = await novoBanco("m02");
  assert.equal(await contar(db, "rhA", "documentos_rh"), 1);
  assert.equal(await contar(db, "cozinhaA", "documentos_rh"), 0);
  assert.equal(await contar(db, "garcomA", "documentos_rh"), 0);
  assert.equal(await contar(db, "financeiroA", "documentos_rh"), 0);
  assert.equal((await como(db, "rhA", "update public.documentos_rh set tipo = 'x' where colaborador_id = '20000000-0000-0000-0000-000000000002'")).afetadas, 0, "funcionário de outra unidade");
});

test("02: negar por padrão — tabela sem regra, filha só com FK e legado com senha ficam fechados até para o administrador geral", async () => {
  const db = await novoBanco("m02");
  for (const t of ["tabela_esquecida", "anotacoes_soltas", "pedido_anexos", "acessos_modulo"]) {
    assert.equal(await contar(db, "super", t), 0, `super lê ${t}`);
    assert.equal(await contar(db, "adminEmpresa", t), 0, `admin da empresa lê ${t}`);
  }
  assert.equal((await como(db, "super", "insert into public.tabela_esquecida (unidade_id, nota) values ('unidade-a','x')")).ok, false);
  assert.equal(await contar(db, "servico", "acessos_modulo"), 1, "a service role (servidor) continua lendo");
});

test("02: linha com unidade nula — lê quem tem a permissão; só escopo total escreve", async () => {
  const db = await novoBanco("m02");
  await db.exec("insert into public.produtos (unidade_id, nome_produto, preco_venda) values (null, 'Catálogo geral', 10)");
  assert.ok((await contar(db, "gerenteA", "produtos")) >= 4, "gerente lê a linha sem unidade");
  assert.equal(await contar(db, "semPerfil", "produtos"), 0);
  assert.equal((await como(db, "gerenteA", "update public.produtos set preco_venda = 1 where unidade_id is null")).afetadas, 0, "gerente de unidade não altera linha sem unidade");
  assert.equal((await como(db, "gerenteA", "insert into public.produtos (unidade_id, nome_produto) values (null, 'x')")).ok, false);
  assert.equal((await como(db, "super", "update public.produtos set preco_venda = 11 where unidade_id is null")).afetadas, 1);
});

test("02: catálogo global exige a permissão, não a unidade", async () => {
  const db = await novoBanco("m02");
  assert.equal(await contar(db, "gerenteA", "suprimentos_catalogo"), 1);
  assert.equal(await contar(db, "garcomA", "suprimentos_catalogo"), 0);
  assert.equal(await contar(db, "cozinhaA", "suprimentos_catalogo"), 0);
});

test("02: financeiro não altera RH; RH não mexe no financeiro além da folha; cozinha não lê RH", async () => {
  const db = await novoBanco("m02");
  assert.equal((await como(db, "financeiroA", "update public.colaboradores set salario = 1")).afetadas, 0);
  assert.equal((await como(db, "financeiroA", "delete from public.rh_atestados")).afetadas, 0);
  assert.equal(await contar(db, "financeiroA", "rh_atestados"), 0);
  assert.equal((await como(db, "rhA", "delete from public.contas_pagar")).afetadas, 0);
  assert.equal((await como(db, "rhA", "update public.lancamentos set valor = 0")).afetadas, 0);
  assert.equal(await contar(db, "rhA", "notas_fiscais"), 0);
  for (const t of ["colaboradores", "rh_atestados", "rh_banco_horas", "documentos_rh", "rh_recibos_prestacao"]) assert.equal(await contar(db, "cozinhaA", t), 0, t);
});

test("02: RH sem a permissão de folha não lê o financeiro (a regra é a permissão, não o cargo)", async () => {
  const db = await novoBanco("m02");
  assert.ok((await contar(db, "rhA", "contas_pagar")) > 0, "com rh.payroll.view lê contas da folha");
  await db.exec(`insert into public.usuario_permissoes (usuario_id, permission_key, effect)
    select id, k, 'deny' from public.usuarios_erp, unnest(array['rh.payroll.*','rh.overview.view_values']) k
    where auth_user_id = '${USUARIO.rhA}'`);
  assert.equal(await contar(db, "rhA", "contas_pagar"), 0);
  assert.equal(await contar(db, "rhA", "lancamentos"), 0);
});

test("02: gerente A x gerente B e administrador da empresa x outra empresa", async () => {
  const db = await novoBanco("m02");
  for (const t of ["vendas", "eventos", "mesas", "pedidos"]) {
    const a = await contar(db, "gerenteA", t);
    const b = await contar(db, "gerenteB", t);
    const tudo = await contar(db, "super", t);
    assert.ok(a > 0 && b > 0 && a < tudo && b < tudo, `${t}: A=${a} B=${b} total=${tudo}`);
  }
  assert.equal((await como(db, "gerenteA", "update public.vendas set total = 0 where unidade_id = 'unidade-b'")).afetadas, 0);
  assert.equal(await contar(db, "adminEmpresa", "lancamentos"), 2);
  assert.equal((await como(db, "adminEmpresa", "update public.lancamentos set valor = 0 where unidade_id = 'unidade-c'")).afetadas, 0);
});

test("02: sem perfil, autocadastro e legado — zero em todas as tabelas, inclusive filhas", async () => {
  const db = await novoBanco("m02");
  const tabelas = (await db.query("select tabela from hefisto_privado.rls_aplicado order by 1")).rows.map((r) => r.tabela);
  for (const quem of ["semPerfil", "autocadastro", "legado"]) {
    for (const t of tabelas) assert.equal(await contar(db, quem, t), 0, `${quem} lê ${t}`);
  }
});

test("02: rollback volta ao estado da Etapa 3; reaplicar funciona", async () => {
  const db = await novoBanco("m02");
  await db.exec(SQL.r02);
  assert.equal((await como(db, "garcomA", "delete from public.fichas_tecnicas where unidade_id = 'unidade-a'")).afetadas, 1, "voltou a regra anterior");
  assert.equal(await contar(db, "anon", "fichas_tecnicas"), "negado", "rollback não reabre o anônimo");
  assert.equal((await db.query("select to_regclass('hefisto_privado.mapa_rls_v2') is null as a")).rows[0].a, true);
  await db.exec(SQL.m02);
  assert.equal((await como(db, "garcomA", "delete from public.insumos where unidade_id = 'unidade-a'")).afetadas, 0);
});

test("01: rollback recusa rodar com a 02 aplicada", async () => {
  const db = await novoBanco("m02");
  await assert.rejects(db.exec(SQL.r01), /desfaça antes/);
});

/* ───────────────────────── MIGRAÇÕES 03 e 04: BIOMETRIA ───────────────────────── */

const COLAB_A = "20000000-0000-0000-0000-000000000001";
const COLAB_B = "20000000-0000-0000-0000-000000000002";
const CAMPOS_QUIOSQUE = ["acesso_todas_areas", "area_escala", "ativo", "cargo", "id", "nome", "setor", "status", "tem_biometria", "tipo_contrato"];
const PROIBIDOS = ["cpf", "rg", "salario", "chave_pix", "rua_av", "bairro", "cep", "nome_mae", "email", "telefone", "data_nascimento", "face_descritores"];
const descritor = (x) => Array.from({ length: 128 }, (_, i) => Number((x + i / 1000).toFixed(3)));
const hojeBrasil = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

test("03: recusa rodar sem a 01", async () => {
  const db = await novoBanco("etapa3");
  await assert.rejects(db.exec(SQL.m03), /migração 01/);
});

test("03: idempotente; copia sem apagar; tabelas privadas sem acesso direto", async () => {
  const db = await novoBanco("m03");
  const r = relatorio(await db.exec(SQL.m03));
  assert.ok(r.some((l) => l.verificacao === "Migração 03 concluída"));
  assert.equal((await db.query("select count(*)::int n from hefisto_privado.biometria_facial")).rows[0].n, 2);
  assert.equal((await db.query("select count(*)::int n from public.colaboradores where face_descritores is not null")).rows[0].n, 2, "a 03 não apaga");
  for (const quem of ["super", "rhA", "quiosqueA", "anon"]) {
    const x = await como(db, quem, "select count(*) from hefisto_privado.biometria_facial");
    assert.equal(x.ok, false, `${quem} leu a tabela privada`);
  }
  assert.equal((await como(db, "servico", "select count(*)::int n from hefisto_privado.biometria_facial")).linhas[0].n, 2);
});

test("03: QUIOSQUE recebe só os campos mínimos, só da própria unidade, só com permissão", async () => {
  const db = await novoBanco("m03");
  const r = await como(db, "quiosqueA", "select public.ponto_quiosque_equipe('unidade-a') e");
  assert.ok(r.ok, r.erro);
  const equipe = r.linhas[0].e;
  assert.equal(equipe.length, 1);
  assert.deepEqual(Object.keys(equipe[0]).sort(), CAMPOS_QUIOSQUE);
  for (const p of PROIBIDOS) assert.equal(p in equipe[0], false, `quiosque recebeu ${p}`);
  assert.equal(JSON.stringify(equipe).includes("222.222.222-22"), false);
  for (const [quem, unidade] of [["quiosqueA", "unidade-b"], ["garcomA", "unidade-a"], ["cozinhaA", "unidade-a"], ["semPerfil", "unidade-a"], ["gerenteB", "unidade-a"]]) {
    const x = await como(db, quem, `select public.ponto_quiosque_equipe('${unidade}')`);
    assert.equal(x.ok, false, `${quem} em ${unidade}`);
  }
  assert.match((await como(db, "anon", "select public.ponto_quiosque_equipe('unidade-a')")).erro, /permission denied/);
});

test("03: descritores só para o reconhecimento, só id + vetores, e o acesso fica registrado", async () => {
  const db = await novoBanco("m03");
  const r = await como(db, "quiosqueA", "select public.ponto_quiosque_biometria('unidade-a') b", { cabecalhos: { "x-request-id": "req-biometria-0001", "x-hefisto-canal": "quiosque" } });
  assert.ok(r.ok, r.erro);
  assert.equal(r.linhas[0].b.length, 1);
  assert.deepEqual(Object.keys(r.linhas[0].b[0]).sort(), ["descritores", "id"]);
  const log = (await db.query("select evento, unidade_id, quantidade, request_id, canal, auth_user_id from hefisto_privado.biometria_acessos order by id desc limit 1")).rows[0];
  assert.deepEqual({ ...log }, { evento: "descritores_lidos_quiosque", unidade_id: "unidade-a", quantidade: 1, request_id: "req-biometria-0001", canal: "quiosque", auth_user_id: USUARIO.quiosqueA });
  for (const quem of ["garcomA", "cozinhaA", "financeiroA", "gerenteB"]) {
    assert.equal((await como(db, quem, "select public.ponto_quiosque_biometria('unidade-a')")).ok, false, quem);
  }
});

test("03: turno só do colaborador da unidade; marcação com hora do servidor e dia válido", async () => {
  const db = await novoBanco("m03");
  const turno = await como(db, "quiosqueA", `select public.ponto_quiosque_turno('${COLAB_A}') t`);
  assert.ok(turno.ok, turno.erro);
  assert.deepEqual(Object.keys(turno.linhas[0].t).sort(), ["horario_dom_entrada", "horario_entrada", "horario_por_dia", "horarios_dia"]);
  assert.equal((await como(db, "quiosqueA", `select public.ponto_quiosque_turno('${COLAB_B}')`)).ok, false);

  const hoje = hojeBrasil();
  const ok = await como(db, "quiosqueA", `select public.ponto_marcacao_registrar('{"unidade_id":"unidade-a","colaborador_id":"${COLAB_A}","tipo":"entrada","data_referencia":"${hoje}","origem":"tablet"}') m`);
  assert.ok(ok.ok, ok.erro);
  assert.ok(ok.linhas[0].m.nsr);
  const horaForjada = await como(db, "quiosqueA", `select public.ponto_marcacao_registrar('{"unidade_id":"unidade-a","colaborador_id":"${COLAB_A}","tipo":"entrada","data_referencia":"${hoje}","marcado_em":"2020-01-01T08:00:00-03:00"}')`);
  assert.equal(horaForjada.ok, false, "quiosque não escolhe a hora");
  const outroDia = await como(db, "quiosqueA", `select public.ponto_marcacao_registrar('{"unidade_id":"unidade-a","colaborador_id":"${COLAB_A}","tipo":"entrada","data_referencia":"2020-01-01"}')`);
  assert.equal(outroDia.ok, false, "dia de referência forjado");
  const outraUnidade = await como(db, "quiosqueA", `select public.ponto_marcacao_registrar('{"unidade_id":"unidade-a","colaborador_id":"${COLAB_B}","tipo":"entrada","data_referencia":"${hoje}"}')`);
  assert.equal(outraUnidade.ok, false, "funcionário de outra unidade");
  const campoExtra = await como(db, "quiosqueA", `select public.ponto_marcacao_registrar('{"unidade_id":"unidade-a","colaborador_id":"${COLAB_A}","tipo":"entrada","data_referencia":"${hoje}","cpf":"000","hash":"x"}') m`);
  assert.ok(campoExtra.ok, campoExtra.erro);
  assert.notEqual((await db.query(`select cpf from public.ponto_marcacao where nsr = ${campoExtra.linhas[0].m.nsr}`)).rows[0].cpf, "000", "cpf e hash não vêm do cliente");
  const ajuste = await como(db, "rhA", `select public.ponto_marcacao_registrar('{"unidade_id":"unidade-a","colaborador_id":"${COLAB_A}","tipo":"ajuste","tipo_alvo":"entrada","data_referencia":"2026-08-01","marcado_em":"2026-08-01T15:40:00-03:00","registrado_por":"RH","motivo":"esqueceu"}') m`);
  assert.ok(ajuste.ok, ajuste.erro);
});

test("03: foto da batida — quiosque grava, RH com permissão vê (e fica registrado), cozinha não", async () => {
  const db = await novoBanco("m03");
  await db.exec(`update public.registro_ponto set data_referencia = '${hojeBrasil()}'`);
  const grava = await como(db, "quiosqueA", `select public.ponto_evidencia_facial_registrar('${COLAB_A}', 'saida_trabalho', 'QUJDRA==', 0.31) r`);
  assert.ok(grava.ok, grava.erro);
  const invalida = await como(db, "quiosqueA", `select public.ponto_evidencia_facial_registrar('${COLAB_A}', 'saida_trabalho', 'data:image/png;base64,QUJD', 0.3)`);
  assert.equal(invalida.ok, false);
  assert.equal((await como(db, "garcomA", `select public.ponto_evidencia_facial_registrar('${COLAB_A}', 'entrada', 'QUJD', 0.3)`)).ok, false);
  const registro = grava.linhas[0].r.registro_ponto_id;
  const ver = await como(db, "rhA", `select public.ponto_evidencia_facial_ver('${registro}') v`);
  assert.ok(ver.ok, ver.erro);
  assert.equal(ver.linhas[0].v.length, 2, "entrada copiada + saída nova");
  assert.equal((await db.query("select count(*)::int n from hefisto_privado.biometria_acessos where evento = 'foto_batida_vista'")).rows[0].n, 1);
  assert.equal((await como(db, "cozinhaA", `select public.ponto_evidencia_facial_ver('${registro}')`)).ok, false);
  assert.equal((await como(db, "gerenteB", `select public.ponto_evidencia_facial_ver('${registro}')`)).ok, false);
});

test("03: cadastro facial valida formato e consentimento; situação sem descritor; remover apaga em todo lugar", async () => {
  const db = await novoBanco("m03");
  const tres = JSON.stringify([descritor(0.1), descritor(0.2), descritor(0.3)]);
  const ok = await como(db, "rhA", `select public.biometria_cadastrar('${COLAB_A}', '${tres}'::jsonb, 'termo-2026-09') r`);
  assert.ok(ok.ok, ok.erro);
  const reg = (await db.query(`select consentimento_por, termo_versao, capturas, origem from hefisto_privado.biometria_facial where colaborador_id = '${COLAB_A}'`)).rows[0];
  assert.deepEqual({ ...reg }, { consentimento_por: USUARIO.rhA, termo_versao: "termo-2026-09", capturas: 3, origem: "cadastro" });
  assert.equal((await como(db, "rhA", `select public.biometria_cadastrar('${COLAB_A}', '${JSON.stringify([descritor(1), descritor(2)])}'::jsonb, 'termo')`)).ok, false, "2 capturas");
  assert.equal((await como(db, "rhA", `select public.biometria_cadastrar('${COLAB_A}', '[[1,2],[3],[4]]'::jsonb, 'termo')`)).ok, false, "vetor curto");
  assert.equal((await como(db, "rhA", `select public.biometria_cadastrar('${COLAB_A}', '${tres}'::jsonb, '')`)).ok, false, "sem termo");
  assert.equal((await como(db, "garcomA", `select public.biometria_cadastrar('${COLAB_A}', '${tres}'::jsonb, 't')`)).ok, false);
  assert.equal((await como(db, "rhA", `select public.biometria_cadastrar('${COLAB_B}', '${tres}'::jsonb, 't')`)).ok, false, "funcionário de outra unidade");

  const sit = await como(db, "rhA", "select public.biometria_situacao('unidade-a') s");
  assert.equal(JSON.stringify(sit.linhas[0].s).includes("descritores"), false);
  assert.equal(sit.linhas[0].s.length, 1);

  assert.ok((await como(db, "rhA", `select public.biometria_remover('${COLAB_A}')`)).ok);
  assert.equal((await db.query(`select count(*)::int n from hefisto_privado.biometria_facial where colaborador_id = '${COLAB_A}'`)).rows[0].n, 0);
  assert.equal((await db.query(`select face_descritores is null and face_cadastrado_em is null as ok from public.colaboradores where id = '${COLAB_A}'`)).rows[0].ok, true);
});

test("03: expurgo apaga só foto vencida", async () => {
  const db = await novoBanco("m03");
  await db.exec("update hefisto_privado.ponto_evidencia_facial set expira_em = now() - interval '1 day'");
  assert.equal((await db.query("select hefisto_privado.expurgar_evidencias_faciais() n")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from hefisto_privado.ponto_evidencia_facial")).rows[0].n, 0);
});

test("03: app antigo continua sincronizado até a 04 (gatilho)", async () => {
  const db = await novoBanco("m03");
  await db.exec(`update public.colaboradores set face_descritores = '[[9,9,9]]' where id = '${COLAB_B}'`);
  const b = (await db.query(`select descritores from hefisto_privado.biometria_facial where colaborador_id = '${COLAB_B}'`)).rows[0];
  assert.deepEqual(b.descritores, [[9, 9, 9]]);
});

test("03: rollback devolve às colunas antigas o que só existia no app novo", async () => {
  const db = await novoBanco("m03");
  const tres = JSON.stringify([descritor(0.4), descritor(0.5), descritor(0.6)]);
  await db.exec(`update public.colaboradores set face_descritores = null where id = '${COLAB_A}'`);
  assert.ok((await como(db, "rhA", `select public.biometria_cadastrar('${COLAB_A}', '${tres}'::jsonb, 'termo')`)).ok);
  await db.exec(SQL.r03);
  const col = (await db.query(`select jsonb_array_length(face_descritores) n from public.colaboradores where id = '${COLAB_A}'`)).rows[0].n;
  assert.equal(col, 3);
  assert.equal((await db.query("select to_regclass('hefisto_privado.biometria_facial') is null as a")).rows[0].a, true);
  assert.equal((await db.query("select to_regclass('hefisto_privado.biometria_acessos') is not null as a")).rows[0].a, true, "trilha de acesso fica");
  await db.exec(SQL.m03);
});

test("04: recusa sem a 03; limpa as colunas antigas e trava regravação", async () => {
  const sem03 = await novoBanco("m02");
  await assert.rejects(sem03.exec(SQL.m04), /migração 03/);

  const db = await novoBanco("m04");
  assert.equal((await db.query("select count(*)::int n from public.colaboradores where face_descritores is not null")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from public.registro_ponto where face_foto_entrada is not null or face_foto_saida is not null")).rows[0].n, 0);
  assert.equal((await db.query("select count(*)::int n from hefisto_privado.biometria_facial")).rows[0].n, 2, "nada se perdeu");
  const regravar = await como(db, "super", `update public.colaboradores set face_descritores = '[[1]]' where id = '${COLAB_A}'`);
  assert.equal(regravar.ok, false);
  assert.match(regravar.erro, /biometria_cadastrar/);
  assert.equal((await como(db, "servico", `update public.registro_ponto set face_foto_entrada = 'x'`)).ok, false, "nem com a service role");
});

test("04: quiosque sem leitura direta de colaboradores e do livro; funções continuam servindo", async () => {
  const antes = await novoBanco("m03");
  assert.equal(await contar(antes, "quiosqueA", "colaboradores"), 1, "antes da 04 o quiosque ainda lia direto");
  const db = await novoBanco("m04");
  assert.equal(await contar(db, "quiosqueA", "colaboradores"), 0);
  assert.equal(await contar(db, "quiosqueA", "ponto_marcacao"), 0);
  assert.equal((await como(db, "quiosqueA", "insert into public.ponto_marcacao (unidade_id, colaborador_id, tipo) values ('unidade-a', '20000000-0000-0000-0000-000000000001', 'entrada')")).ok, false, "grava só pela função");
  assert.ok((await como(db, "quiosqueA", "select public.ponto_quiosque_equipe('unidade-a')")).ok);
  assert.ok((await como(db, "quiosqueA", "select public.ponto_quiosque_biometria('unidade-a')")).ok);
  const hoje = hojeBrasil();
  assert.ok((await como(db, "quiosqueA", `select public.ponto_marcacao_registrar('{"unidade_id":"unidade-a","colaborador_id":"${COLAB_A}","tipo":"entrada","data_referencia":"${hoje}"}')`)).ok);
  assert.equal(await contar(db, "rhA", "colaboradores"), 1, "RH continua lendo o cadastro (sem biometria)");
});

test("04: reaplicar a 02 depois da 04 mantém o quiosque sem leitura direta; rollback da 04 devolve tudo", async () => {
  const db = await novoBanco("m04");
  await db.exec(SQL.m02);
  assert.equal(await contar(db, "quiosqueA", "colaboradores"), 0);
  await db.exec(SQL.r04);
  assert.equal((await db.query("select count(*)::int n from public.colaboradores where face_descritores is not null")).rows[0].n, 2);
  assert.equal(await contar(db, "quiosqueA", "colaboradores"), 1);
  assert.ok((await como(db, "super", `update public.colaboradores set face_descritores = '[[7]]' where id = '${COLAB_B}'`)).ok, "trava removida");
  await assert.rejects(db.exec(SQL.r03).then(() => db.exec(SQL.r03)), /não está aplicada/);
});
