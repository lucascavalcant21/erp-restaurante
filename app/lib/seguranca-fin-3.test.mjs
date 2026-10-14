// SEC-FIN-3 (S-20): dado financeiro só para quem tem permissão financeira.
// SQL REAL no PGlite: F2.1 (tabelas, policies e as 5 RPCs financeiras), a
// tabela de faturamento da F2.4C, a migração SEC-FIN-3 e o rollback. As
// permissões passam pela função REAL hefisto_user_has_permission (perfil,
// permissões próprias, negar vence, validade).
//   PGLITE=… node --test app/lib/seguranca-fin-3.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { criarBancoF21 } from "./teste-banco-f21.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ler = (f) => fs.readFileSync(path.join(raiz, "db", f), "utf8");
const pular = !process.env.PGLITE && "PGLITE não informado";

const P = {
  super: "00000000-0000-0000-0000-0000000000f1",
  gerente: "00000000-0000-0000-0000-0000000000f2",    // gerente-geral: financeiro.* rh.* dashboard.*
  cozinheiro: "00000000-0000-0000-0000-0000000000f3",  // cozinha.* estoque.overview.view
  consulta: "00000000-0000-0000-0000-0000000000f4",    // somente-consulta
  caixa: "00000000-0000-0000-0000-0000000000f5",       // financeiro.cashflow.view + create
  negado: "00000000-0000-0000-0000-0000000000f6",      // financeiro.* no perfil, mas NEGAR cashflow.view
  expirado: "00000000-0000-0000-0000-0000000000f7",    // financeiro.*, acesso vencido
  marm: "00000000-0000-0000-0000-0000000000f8",        // só marmitaria.financial.view
  rh: "00000000-0000-0000-0000-0000000000f9",          // recursos-humanos: rh.*
};
const PERFIS = {
  gerente: ["financeiro.*", "rh.*", "dashboard.*"], cozinheiro: ["cozinha.*", "estoque.overview.view"],
  consulta: ["dashboard.overview.view", "estoque.overview.view", "relatorios.reports.view"],
  caixa: ["financeiro.cashflow.view", "financeiro.cashflow.create"], negado: ["financeiro.*"], expirado: ["financeiro.*"],
  marm: ["marmitaria.financial.view"], rh: ["rh.*"],
};
const SEC_TABELAS = ["gastos_administrativos", "marmitaria_vendas", "delivery_repasses", "extras_cadastros", "rh_recibos_prestacao", "rh_consumo_funcionarios"];
const FIN = ["contas_pagar", "fin_contas_financeiras", "fin_contas_receber", "fin_pagamentos", "fin_recebimentos", "fin_taxas_meio_pagamento", "fin_faturamento_diario"];

async function banco() {
  const pg = await criarBancoF21(raiz, "", { secFin2: true });
  await pg.exec(ler("F2_4C_FATURAMENTO_DIARIO_OPCIONAL.sql"));
  await pg.exec(`
    -- usuários, perfis e permissões como em produção
    create table public.perfis_acesso (id uuid primary key default gen_random_uuid(), codigo text unique);
    create table public.perfil_permissoes (perfil_id uuid references public.perfis_acesso(id), permission_key text);
    create table public.usuarios_erp (id uuid primary key default gen_random_uuid(), auth_user_id uuid unique, status text default 'ativo',
      super_admin boolean default false, perfil_id uuid, locked_until timestamptz, valid_from timestamptz, valid_until timestamptz,
      timezone text, allowed_days smallint[], allowed_start_time time, allowed_end_time time);
    create table public.usuario_permissoes (usuario_id uuid, permission_key text, effect text);
    create function public.hefisto_permission_match(granted text, wanted text) returns boolean language sql immutable as $$
      select granted = '*' or granted = wanted or granted = split_part(wanted,'.',1) || '.*'
        or granted = split_part(wanted,'.',1) || '.' || split_part(wanted,'.',2) || '.*' $$;
    create function public.hefisto_user_has_permission(p_auth_user_id uuid, p_permission text) returns boolean language plpgsql stable security definer set search_path = public as $$
    declare v_user usuarios_erp%rowtype; v_local timestamp;
    begin
      select * into v_user from usuarios_erp where auth_user_id = p_auth_user_id;
      if not found or v_user.status <> 'ativo' then return false; end if;
      if v_user.locked_until is not null and v_user.locked_until > now() then return false; end if;
      if v_user.valid_from is not null and v_user.valid_from > now() then return false; end if;
      if v_user.valid_until is not null and v_user.valid_until < now() then return false; end if;
      v_local := now() at time zone coalesce(v_user.timezone,'America/Sao_Paulo');
      if not (extract(dow from v_local)::smallint = any(v_user.allowed_days)) then return false; end if;
      if v_user.allowed_start_time is not null and v_local::time < v_user.allowed_start_time then return false; end if;
      if v_user.allowed_end_time is not null and v_local::time > v_user.allowed_end_time then return false; end if;
      if v_user.super_admin then return true; end if;
      if exists (select 1 from usuario_permissoes up where up.usuario_id = v_user.id and up.effect='deny' and hefisto_permission_match(up.permission_key, p_permission)) then return false; end if;
      return exists (select 1 from usuario_permissoes up where up.usuario_id = v_user.id and up.effect='allow' and hefisto_permission_match(up.permission_key, p_permission))
        or exists (select 1 from perfil_permissoes pp where pp.perfil_id = v_user.perfil_id and hefisto_permission_match(pp.permission_key, p_permission));
    end $$;
    -- escopo multiunidade (modelo sec_unidade) com o mesmo dublê de unidade da F2.1
    create function public.hefisto_ve_todas_unidades() returns boolean language sql stable security definer as $$ select public.pode_ver_todas() $$;
    create function public.hefisto_unidades_do_usuario() returns text[] language sql stable security definer as $$ select array[public.auth_unidade_id()] $$;
  `);
  for (const [nome, chaves] of Object.entries(PERFIS)) {
    await pg.query("insert into public.perfis_acesso (codigo) values ($1)", [nome]);
    for (const k of chaves) await pg.query("insert into public.perfil_permissoes select id, $2 from public.perfis_acesso where codigo = $1", [nome, k]);
  }
  for (const [nome, uid] of Object.entries(P)) {
    await pg.query(`insert into public.usuarios_erp (auth_user_id, super_admin, perfil_id, valid_until)
      select $1, $2, (select id from public.perfis_acesso where codigo = $3), $4`, [uid, nome === "super", nome, nome === "expirado" ? "2020-01-01" : null]);
  }
  await pg.query("insert into public.usuario_permissoes select id, 'financeiro.cashflow.view', 'deny' from public.usuarios_erp where auth_user_id = $1", [P.negado]);
  for (const t of SEC_TABELAS) {
    await pg.exec(`create table public.${t} (id uuid primary key default gen_random_uuid(), unidade_id text, valor numeric);
      alter table public.${t} enable row level security;
      ${t === "delivery_repasses"
        ? `create policy sec_unidade_ler on public.${t} for select to authenticated using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));`
        : `create policy sec_unidade on public.${t} for all to authenticated using ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())))
            with check ((select public.hefisto_ve_todas_unidades()) or unidade_id in (select unnest(public.hefisto_unidades_do_usuario())));`}
      grant select, insert, update, delete on public.${t} to authenticated;
      insert into public.${t} (unidade_id, valor) values ('seldeestrela', 100), ('outra', 200);`);
  }
  // dados financeiros nas duas unidades (como superusuário)
  await pg.exec(`
    insert into public.contas_pagar (id, unidade_id, descricao, valor, data_vencimento, status) values
      ('c0000000-0000-0000-0000-000000000001', 'seldeestrela', 'Aluguel', 1000, current_date, 'pendente'),
      ('c0000000-0000-0000-0000-000000000002', 'seldeestrela', 'Luz', 300, current_date, 'pendente'),
      ('c0000000-0000-0000-0000-000000000003', 'outra', 'Aluguel B', 900, current_date, 'pendente');
    insert into public.fin_contas_financeiras (unidade_id, nome, tipo, saldo_inicial, saldo_inicial_em) values ('seldeestrela', 'Banco A', 'banco', 0, current_date), ('outra', 'Banco B', 'banco', 0, current_date);
    insert into public.fin_faturamento_diario (unidade_id, data, vendas_brutas, fonte) values ('seldeestrela', current_date, 5000, 'informado'), ('outra', current_date, 7000, 'informado');
  `);
  return pg;
}

async function como(pg, uid, unidade, fn) {
  await pg.exec("reset role");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false), set_config('test.unidade', $2, false), set_config('test.rede', $3, false)",
    [uid || "", unidade, String(uid === P.super)]);
  await pg.exec(uid ? "set role authenticated" : "set role anon");
  try { return await fn(); } finally { await pg.exec("reset role"); }
}
const contar = (pg, uid, t, unidade = "seldeestrela") => como(pg, uid, unidade, async () => {
  try { return (await pg.query(`select count(*)::int n from public.${t}`)).rows[0].n; } catch { return "erro"; }
});
const tentar = (pg, uid, sql, params = [], unidade = "seldeestrela") => como(pg, uid, unidade, async () => {
  try { const r = await pg.query(sql, params); return { ok: true, n: r.affectedRows ?? r.rows?.length }; } catch (e) { return { ok: false, erro: e.message }; }
});

test("SEC-FIN-3: antes, depois e rollback — leitura, escrita, RPCs, unidade cruzada", { skip: pular }, async () => {
  const pg = await banco();
  // ANTES: o problema (S-20) — cozinheiro e consulta leem tudo da unidade
  assert.equal(await contar(pg, P.cozinheiro, "contas_pagar"), 2, "antes: cozinheiro lê contas a pagar");
  assert.equal(await contar(pg, P.consulta, "fin_contas_financeiras"), 1, "antes: consulta lê banco");
  assert.equal(await contar(pg, P.cozinheiro, "extras_cadastros"), 1, "antes: cozinheiro lê cadastro de extras");
  const antesRpc = await tentar(pg, P.cozinheiro, "select public.fin_registrar_pagamento('c0000000-0000-0000-0000-000000000002', current_date, 10)");
  assert.equal(antesRpc.ok, true, "antes: cozinheiro registra pagamento pela RPC");

  await pg.exec(ler("security/SEC_FIN_3_PERMISSAO_FINANCEIRA.sql"));
  await assert.rejects(pg.exec(ler("security/SEC_FIN_3_PERMISSAO_FINANCEIRA.sql")), /não está como esperado/, "preflight recusa reaplicar");
  await pg.exec("rollback");

  // DEPOIS: leitura
  for (const t of [...FIN, ...SEC_TABELAS]) {
    assert.equal(await contar(pg, P.cozinheiro, t), 0, `cozinheiro não lê ${t}`);
    assert.equal(await contar(pg, P.consulta, t), 0, `somente-consulta não lê ${t}`);
    assert.equal(await contar(pg, P.expirado, t), 0, `acesso vencido não lê ${t}`);
    assert.equal(await contar(pg, null, t), "erro", `anônimo não lê ${t}`);
  }
  assert.equal(await contar(pg, P.gerente, "contas_pagar"), 2, "gerente lê as contas da unidade");
  assert.equal(await contar(pg, P.gerente, "contas_pagar", "outra"), 1, "na outra unidade, só as de lá");
  assert.equal(await contar(pg, P.gerente, "fin_contas_financeiras"), 1, "gerente lê o banco da unidade (não o da outra)");
  assert.equal(await contar(pg, P.super, "contas_pagar"), 3, "super admin: visão consolidada");
  assert.equal(await contar(pg, P.caixa, "fin_contas_financeiras"), 1, "caixa lê contas financeiras");
  assert.equal(await contar(pg, P.caixa, "extras_cadastros"), 0, "caixa não lê cadastro de extras (RH)");
  assert.equal(await contar(pg, P.negado, "contas_pagar"), 2, "negar cashflow.view: ainda lê contas pelo DRE (financeiro.dre.view)");
  assert.equal(await contar(pg, P.negado, "fin_contas_financeiras"), 0, "negar cashflow.view: não lê o banco");
  assert.equal(await contar(pg, P.marm, "contas_pagar"), 2, "marmitaria financeiro lê contas (DRE da marmitaria)");
  assert.equal(await contar(pg, P.marm, "marmitaria_vendas"), 1, "marmitaria financeiro lê vendas da marmitaria");
  assert.equal(await contar(pg, P.marm, "fin_contas_financeiras"), 0, "marmitaria financeiro não lê bancos");
  assert.equal(await contar(pg, P.rh, "extras_cadastros"), 1, "RH lê cadastro de extras");
  assert.equal(await contar(pg, P.rh, "rh_recibos_prestacao"), 1, "RH lê recibos");
  assert.equal(await contar(pg, P.rh, "contas_pagar"), 0, "RH não lê contas a pagar");

  // DEPOIS: escrita direta pela API
  assert.equal((await tentar(pg, P.cozinheiro, "insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status) values ('seldeestrela','x',1,current_date,'pendente')")).ok, false, "cozinheiro não cria conta");
  assert.equal((await tentar(pg, P.gerente, "insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status) values ('seldeestrela','x',1,current_date,'pendente')")).ok, true, "gerente cria conta");
  assert.equal((await tentar(pg, P.gerente, "insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status) values ('outra','x',1,current_date,'pendente')")).ok, false, "gerente não cria conta em outra unidade");
  assert.equal((await tentar(pg, P.marm, "insert into public.contas_pagar (unidade_id, descricao, valor, data_vencimento, status) values ('seldeestrela','x',1,current_date,'pendente')")).ok, false, "quem só vê não grava");
  const upd = await tentar(pg, P.consulta, "update public.contas_pagar set valor = 0 where unidade_id = 'seldeestrela'");
  assert.equal(upd.ok && upd.n > 0, false, "somente-consulta não altera conta");
  assert.equal((await tentar(pg, P.cozinheiro, "insert into public.extras_cadastros (unidade_id, valor) values ('seldeestrela', 1)")).ok, false, "cozinheiro não grava extras");
  assert.equal((await tentar(pg, P.rh, "insert into public.extras_cadastros (unidade_id, valor) values ('seldeestrela', 1)")).ok, true, "RH grava extras");

  // DEPOIS: RPCs financeiras (SECURITY DEFINER) — a ação exige a permissão
  const rpcPagar = (uid, id = "c0000000-0000-0000-0000-000000000002") => tentar(pg, uid, `select public.fin_registrar_pagamento('${id}', current_date, 10)`);
  assert.match((await rpcPagar(P.cozinheiro)).erro || "", /Sem permissão financeira/, "cozinheiro não paga pela RPC");
  assert.match((await rpcPagar(P.consulta)).erro || "", /Sem permissão financeira/, "consulta não paga pela RPC");
  assert.equal((await rpcPagar(P.caixa)).ok, true, "caixa (cashflow.create) registra pagamento");
  assert.match((await tentar(pg, P.caixa, "select public.fin_cancelar_conta_pagar('c0000000-0000-0000-0000-000000000001', 'teste')")).erro || "", /Sem permissão financeira/, "caixa não cancela conta (precisa excluir/aprovar)");
  assert.equal((await tentar(pg, P.gerente, "select public.fin_cancelar_conta_pagar('c0000000-0000-0000-0000-000000000001', 'teste')")).ok, true, "gerente cancela conta");
  assert.match((await rpcPagar(P.gerente, "c0000000-0000-0000-0000-000000000003")).erro || "", /não encontrada nesta unidade/, "gerente não paga conta de outra unidade");
  const pag = (await pg.query("select id from public.fin_pagamentos where estornado_em is null order by created_at desc limit 1")).rows[0].id;
  assert.match((await tentar(pg, P.caixa, `select public.fin_estornar_pagamento('${pag}', 'teste')`)).erro || "", /Sem permissão financeira/, "caixa não estorna");
  assert.equal((await tentar(pg, P.gerente, `select public.fin_estornar_pagamento('${pag}', 'teste')`)).ok, true, "gerente estorna");
  assert.match((await tentar(pg, P.expirado, "select public.fin_registrar_pagamento('c0000000-0000-0000-0000-000000000002', current_date, 1)")).erro || "", /Sem permissão financeira/, "acesso vencido não paga");

  // ROLLBACK: volta exatamente ao comportamento anterior
  await pg.exec(ler("security/SEC_FIN_3_ROLLBACK.sql"));
  assert.equal(await contar(pg, P.cozinheiro, "contas_pagar") > 0, true, "rollback: comportamento antigo de volta");
  assert.equal((await rpcPagar(P.cozinheiro)).ok, true, "rollback: RPC antiga de volta");
  const resto = (await pg.query("select count(*)::int n from pg_proc where proname = 'hefisto_tem_alguma'")).rows[0].n;
  assert.equal(resto, 0, "rollback remove o verificador");
});
