// Política de publicação e banco (HDEV-PUBLISH-001): motor de decisão, migrações, aprovações e rodada.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { avaliarPolitica, classificarMigracao, ensaiarMigracao, rollbackIrmao, varrerSegredos, tipoDaMudanca, areasDosArquivos, PUBLICACAO_PADRAO } from "../politica.mjs";
import { pedirAprovacao, lerAprovacoes, decidirAprovacao, interpretarComando, processarComando, contarPendentes } from "../aprovacoes.mjs";
import { avaliarRodada, arquivosMudados, urlPreview } from "../publicacao.mjs";
import { estadoPublicacao } from "../status.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CFG_REAL = JSON.parse(readFileSync(join(AQUI, "..", "config.json"), "utf8"));

// tudo verde, fora de produção
const VERDE = { tests: "passed", build: "passed", secretsCheck: "ok", tenantIsolation: "ok", securityChecks: { rls: "ok" }, rollbackAvailable: true, conflicts: false };

// ─── motor de decisão (lista da seção 15) ────────────────────────────────────

test("política: mudança LOW → AUTO_SAFE", () => {
  const r = avaliarPolitica({ ...VERDE, changeType: "code", environment: "preview", affectedAreas: ["app"] });
  assert.equal(r.riskLevel, "LOW");
  assert.equal(r.decision, "AUTO_SAFE");
  assert.equal(r.approvalRequired, false);
  assert.deepEqual(r.requiredChecks, ["tests", "build", "secretsCheck"]);
  assert.equal(avaliarPolitica({ changeType: "docs", environment: "preview" }).decision, "AUTO_SAFE", "só docs não exige teste");
});

test("política: migração aditiva → AUTO_SAFE (quando o dono liga autoApplySafeMigrations)", () => {
  const e = { ...VERDE, changeType: "migration", environment: "supabase", migrationType: "SAFE" };
  const ligado = avaliarPolitica(e, { autoApplySafeMigrations: true });
  assert.equal(ligado.riskLevel, "MEDIUM");
  assert.equal(ligado.decision, "AUTO_SAFE");
  const padrao = avaliarPolitica(e);
  assert.equal(padrao.decision, "APPROVAL_REQUIRED", "padrão seguro: aplicar no banco real pede o dono");
  assert.match(padrao.reasons.join(" "), /autoApplySafeMigrations=false/);
  assert.equal(avaliarPolitica({ ...e, rollbackAvailable: false }, { autoApplySafeMigrations: true }).decision, "APPROVAL_REQUIRED", "sem rollback nunca é automático");
});

test("política: DROP → APPROVAL_REQUIRED (nenhuma chave libera)", () => {
  const tudoLigado = { autoPublishPreview: true, autoPublishProductionLowRisk: true, autoApplySafeMigrations: true, requireApprovalForHighRisk: false, requireApprovalForCritical: false };
  for (const e of [{ changeType: "drop_table" }, { changeType: "migration", migrationType: "CRITICAL" }, { changeType: "drop_column" }]) {
    const r = avaliarPolitica({ ...VERDE, environment: "supabase", ...e }, tudoLigado);
    assert.equal(r.riskLevel, "CRITICAL", JSON.stringify(e));
    assert.equal(r.decision, "APPROVAL_REQUIRED", JSON.stringify(e));
  }
});

test("política: travas → BLOCKED (RLS inseguro, teste, build, isolamento, segredo, conflito, branch velho)", () => {
  const casos = [
    [{ securityChecks: { rls: "insecure" } }, /RLS inseguro/],
    [{ tests: "failed" }, /teste falhou/],
    [{ build: "failed" }, /build falhou/],
    [{ tenantIsolation: "failed" }, /isolamento entre empresas/],
    [{ secretsCheck: "exposed" }, /segredo apareceu no bundle/],
    [{ conflicts: true }, /conflito/],
  ];
  for (const [extra, motivo] of casos) {
    const r = avaliarPolitica({ ...VERDE, changeType: "code", environment: "preview", ...extra }, { autoPublishProductionLowRisk: true });
    assert.equal(r.decision, "BLOCKED", JSON.stringify(extra));
    assert.match(r.reasons.join(" "), motivo);
  }
  const velho = avaliarPolitica({ ...VERDE, changeType: "code", environment: "production", previewValidated: true, branchUpToDate: false }, { autoPublishProductionLowRisk: true });
  assert.equal(velho.decision, "BLOCKED");
  assert.match(velho.reasons.join(" "), /desatualizado/);
});

test("política: trava vence CRITICAL (DROP com teste falhando é BLOCKED, não um pedido ao dono)", () => {
  const r = avaliarPolitica({ ...VERDE, changeType: "migration", environment: "supabase", migrationType: "CRITICAL", tests: "failed" });
  assert.equal(r.riskLevel, "CRITICAL");
  assert.equal(r.decision, "BLOCKED");
});

test("política: HIGH → APPROVAL_REQUIRED; em produção, mesmo com a chave desligada", () => {
  const prod = { ...VERDE, changeType: "code", environment: "production", affectedAreas: ["financeiro"], previewValidated: true, branchUpToDate: true };
  const r = avaliarPolitica(prod, { autoPublishProductionLowRisk: true, requireApprovalForHighRisk: false });
  assert.equal(r.riskLevel, "HIGH");
  assert.equal(r.decision, "APPROVAL_REQUIRED");
  assert.equal(avaliarPolitica({ ...VERDE, changeType: "migration", environment: "supabase", migrationType: "REVIEW" }, { autoApplySafeMigrations: true }).decision, "APPROVAL_REQUIRED", "REVIEW = HIGH");
});

test("política: produção LOW/MEDIUM — padrão pede o dono; ligada, exige preview validado e branch em dia", () => {
  const prod = { ...VERDE, changeType: "code", environment: "production", previewValidated: true, branchUpToDate: true };
  assert.equal(avaliarPolitica(prod).decision, "APPROVAL_REQUIRED");
  assert.match(avaliarPolitica(prod).reasons.join(" "), /autoPublishProductionLowRisk=false/);
  assert.equal(avaliarPolitica(prod, { autoPublishProductionLowRisk: true }).decision, "AUTO_SAFE");
  const semPreview = avaliarPolitica({ ...prod, previewValidated: false }, { autoPublishProductionLowRisk: true });
  assert.equal(semPreview.decision, "BLOCKED");
  assert.deepEqual(semPreview.faltam, ["previewValidated"]);
});

test("política: sem evidência não publica no escuro; padrões seguros", () => {
  const r = avaliarPolitica({ changeType: "code", environment: "preview" });
  assert.equal(r.decision, "BLOCKED");
  assert.match(r.reasons.join(" "), /faltam verificações: tests, build, secretsCheck/);
  assert.equal(avaliarPolitica({ ...VERDE, changeType: "code", environment: "preview" }, { autoPublishPreview: false }).decision, "APPROVAL_REQUIRED");
  assert.deepEqual(PUBLICACAO_PADRAO, { autoPublishPreview: true, autoPublishProductionLowRisk: false, autoApplySafeMigrations: false, requireApprovalForHighRisk: true, requireApprovalForCritical: true });
  // a configuração real mantém os padrões seguros
  for (const k of ["autoPublishProductionLowRisk", "autoApplySafeMigrations"]) assert.equal(CFG_REAL.publicacao[k], false, k);
  for (const k of ["requireApprovalForHighRisk", "requireApprovalForCritical"]) assert.equal(CFG_REAL.publicacao[k], true, k);
  for (const t of ["apply_migration", "merge_*"]) assert.ok(CFG_REAL.conectores.nuncaPermitir.includes(t), `${t} continua negado`);
  assert.ok(CFG_REAL.motor.disallowedTools.includes("Bash(gh pr merge:*)"));
  assert.ok(CFG_REAL.motor.disallowedTools.includes("Bash(node scripts/hefisto-agent/aprovacoes.mjs aprovar:*)"), "o agente não aprova o próprio pedido");
});

// ─── classificação de migrações ──────────────────────────────────────────────

test("migração SAFE: tabela, índice, coluna nula, policy com filtro, função, view, grant controlado; rollback em comentário", () => {
  const r = classificarMigracao(`
begin;
create table if not exists public.metas (id uuid primary key, unidade_id uuid not null);
alter table public.metas enable row level security;
create index if not exists metas_unidade on public.metas (unidade_id);
alter table public.insumos add column if not exists marca text;
drop policy if exists "metas da unidade" on public.metas;
create policy "metas da unidade" on public.metas for select to authenticated using (hefisto_user_can(unidade_id, 'x'));
create or replace function public.metas_total(p uuid) returns int language sql as $$ select count(*)::int from public.metas where unidade_id = p $$;
create or replace view public.v_metas as select * from public.metas;
grant select on public.metas to authenticated;
revoke all on function public.metas_total(uuid) from public, anon;
do $$ begin if not exists (select 1 from pg_tables where tablename = 'insumos') then raise exception 'preflight: falta insumos'; end if; end $$;
commit;
/* ── ROLLBACK (só com o dono) ──
drop table public.metas;
*/`);
  assert.equal(r.classe, "SAFE", JSON.stringify(r.achados.filter((a) => a.classe !== "SAFE")));
  assert.deepEqual(r.tabelas, ["insumos", "metas"]);
  assert.equal(r.rollback, true);
  assert.equal(r.transacao, true);
  assert.equal(r.preflight, true);
  assert.ok(r.travas.some((t) => /ACCESS EXCLUSIVE em insumos/.test(t)), "ADD COLUMN trava a tabela existente");
  assert.ok(!r.travas.some((t) => / em metas/.test(t)), "tabela nova não conta como trava");
});

test("migração REVIEW: ALTER COLUMN, constraint, RLS ligado em tabela existente, SECURITY DEFINER, UPDATE com filtro, EXECUTE", () => {
  for (const sql of [
    "alter table public.insumos alter column nome set not null;",
    "alter table public.insumos add constraint nome_unico unique (nome);",
    "alter table public.colaboradores enable row level security;",
    "create or replace function public.f() returns void language plpgsql security definer as $$ begin end $$;",
    "update public.insumos set marca = 'x' where marca is null;",
    "alter table public.insumos add column codigo text not null;",
    "do $$ begin execute format('select 1'); end $$;",
    "grant select on public.insumos to anon;",
  ]) assert.equal(classificarMigracao(sql).classe, "REVIEW", sql);
});

test("migração CRITICAL: DROP, TRUNCATE, DELETE/UPDATE em massa, desliga RLS, policy aberta (inclusive dentro de DO)", () => {
  for (const [sql, rls] of [
    ["drop table public.compras;", false],
    ["alter table public.compras drop column total;", false],
    ["truncate public.estoque_lotes;", false],
    ["delete from public.registro_ponto;", false],
    ["update public.insumos set custo = 0;", false],
    ["alter table public.compras disable row level security;", true],
    [`create policy "tudo" on public.compras for all to authenticated using (true) with check (true);`, true],
    ["do $$ begin delete from public.compras; end $$;", false],
  ]) {
    const r = classificarMigracao(sql);
    assert.equal(r.classe, "CRITICAL", sql);
    assert.equal(r.rlsInseguro, rls, `rlsInseguro: ${sql}`);
  }
  // palavras perigosas dentro de texto não contam
  assert.equal(classificarMigracao("comment on table public.x is 'não use drop table aqui';").classe, "SAFE");
  assert.equal(classificarMigracao("select 'truncate' as palavra;").classe, "SAFE");
});

test("migração: as do repositório com policy aberta saem CRITICAL e RLS inseguro (achado real)", () => {
  const raiz = join(AQUI, "..", "..", "..");
  const arq = join(raiz, "db", "migracao_central_comando.sql");
  if (!existsSync(arq)) return;
  const r = classificarMigracao(readFileSync(arq, "utf8"));
  assert.equal(r.classe, "CRITICAL");
  assert.equal(r.rlsInseguro, true);
});

test("migração: declaração de variável no DO não é comando; rollback em arquivo irmão do padrão do repositório", () => {
  const r = classificarMigracao("do $$ declare v_total numeric := 0; r record; begin v_total := 1; raise notice '%', v_total; end $$;");
  assert.equal(r.classe, "SAFE", JSON.stringify(r.achados));
  const irmaos = ["IC_01_INTELLIGENCE_CORE.sql", "IC_01_PREFLIGHT.sql", "IC_01_ROLLBACK.sql", "F2_1_FUNDACAO_FINANCEIRA.sql", "F2_1_FUNDACAO_FINANCEIRA_ROLLBACK.sql", "01_whatsapp_channel.sql", "rollback_01_whatsapp_channel.sql", "migracao_x.sql"];
  assert.equal(rollbackIrmao("IC_01_INTELLIGENCE_CORE.sql", irmaos), "IC_01_ROLLBACK.sql");
  assert.equal(rollbackIrmao("F2_1_FUNDACAO_FINANCEIRA.sql", irmaos), "F2_1_FUNDACAO_FINANCEIRA_ROLLBACK.sql");
  assert.equal(rollbackIrmao("01_whatsapp_channel.sql", irmaos), "rollback_01_whatsapp_channel.sql");
  assert.equal(rollbackIrmao("migracao_x.sql", irmaos), null);
});

test("ensaio (dry-run): sem PGLITE é só análise estática e diz que a sintaxe NÃO foi validada", async () => {
  const r = await ensaiarMigracao("create table public.x (id int);", { pglite: "" });
  assert.equal(r.classe, "SAFE");
  assert.equal(r.sintaxe, "NÃO VALIDADO");
  assert.equal(r.ensaio, "análise estática");
});

test("ensaio (dry-run) com PGLITE: sintaxe ok, erro de sintaxe e dependência ausente", { skip: !process.env.PGLITE && "PGLITE não informado" }, async () => {
  assert.equal((await ensaiarMigracao("create table public.x (id int); create index on public.x (id);")).sintaxe, "ok");
  assert.match((await ensaiarMigracao("create tabel public.x (id int);")).sintaxe, /^erro/);
  const dep = await ensaiarMigracao("alter table public.nao_existe add column y text;");
  assert.equal(dep.sintaxe, "ok até a primeira dependência");
  assert.match(dep.dependencias[0], /42P01/);
});

// ─── segredo no bundle ───────────────────────────────────────────────────────

test("segredo no bundle: nome da service role, JWT de service_role e valor da variável", () => {
  const dir = mkdtempSync(join(tmpdir(), "hefisto-bundle-"));
  mkdirSync(join(dir, "chunks"));
  writeFileSync(join(dir, "chunks", "a.js"), "const url = process.env.NEXT_PUBLIC_SUPABASE_URL;");
  assert.equal(varrerSegredos(dir).estado, "ok");
  const payload = Buffer.from(JSON.stringify({ role: "service_role", iss: "supabase" })).toString("base64url");
  writeFileSync(join(dir, "chunks", "b.js"), `const k = "eyJhbGciOiJIUzI1NiJ9.${payload}.assinatura123";`);
  const r = varrerSegredos(dir);
  assert.equal(r.estado, "exposed");
  assert.match(r.achados.join(" "), /service_role/);
  writeFileSync(join(dir, "chunks", "b.js"), "x");
  writeFileSync(join(dir, "c.js"), "const s = 'valor-secreto-bem-comprido-123';");
  assert.equal(varrerSegredos(dir, { valores: ["valor-secreto-bem-comprido-123"] }).estado, "exposed");
  assert.equal(varrerSegredos(join(dir, "nao-existe")).estado, "not_run");
});

// ─── aprovações ──────────────────────────────────────────────────────────────

test("aprovações: pede, não duplica, transições, agente não aprova, persiste no formato do dono", () => {
  const arq = join(mkdtempSync(join(tmpdir(), "hefisto-apr-")), "APROVACOES_PENDENTES.md");
  const pedido = { missao: "HDEV-001", acao: "Publicar em produção", ambiente: "production", risco: "HIGH", motivo: "área financeira", rollback: "instant rollback", comando: "gh pr merge 127", chave: "producao:x" };
  const a = pedirAprovacao(arq, pedido, new Date("2026-10-08T20:00:00Z"));
  assert.equal(a.aprovacao.id, "APR-001");
  assert.equal(a.nova, true);
  const b = pedirAprovacao(arq, { ...pedido, evidencias: "testes ok" });
  assert.equal(b.nova, false, "mesmo alvo pendente: atualiza");
  assert.equal(contarPendentes(arq), 1);
  const texto = readFileSync(arq, "utf8");
  for (const r of ["### APR-001 · PENDENTE", "**Missão:** HDEV-001", "**Ação:**", "**Ambiente:** production", "**Risco:** HIGH", "**Motivo:**", "**Impacto:**", "**Rollback:** instant rollback", "**Evidências:** testes ok", "**Comando/alteração:** `gh pr merge 127`", "**Status:** PENDENTE"]) assert.ok(texto.includes(r), r);

  assert.throws(() => decidirAprovacao(arq, "APR-001", "APROVADO", { env: { HEFISTO_AGENT: "1" } }), /só o dono/);
  assert.throws(() => decidirAprovacao(arq, "APR-001", "EXECUTADO", { env: {} }), /PENDENTE; não pode ir para EXECUTADO/);
  assert.equal(decidirAprovacao(arq, "apr-001", "APROVADO", { por: "Lucas", env: {} }).status, "APROVADO");
  assert.equal(decidirAprovacao(arq, "APR-001", "EXECUTADO", { env: { HEFISTO_AGENT: "1" } }).status, "EXECUTADO", "quem executou registra");
  assert.throws(() => decidirAprovacao(arq, "APR-001", "APROVADO", { env: {} }), /EXECUTADO/);
  const c = pedirAprovacao(arq, pedido);
  assert.equal(c.aprovacao.id, "APR-002", "o anterior já foi executado: pedido novo");
  assert.deepEqual(lerAprovacoes(arq).map((x) => [x.id, x.status]), [["APR-001", "EXECUTADO"], ["APR-002", "PENDENTE"]]);
  assert.throws(() => pedirAprovacao(arq, { missao: "X" }), /sem "Ação"/);
});

test("aprovações pelo canal futuro (WhatsApp): comando, só o dono autorizado", () => {
  assert.deepEqual(interpretarComando("APROVAR APR-001"), { acao: "APROVADO", id: "APR-001", resto: "" });
  assert.deepEqual(interpretarComando("rejeitar apr-7 risco alto demais"), { acao: "REJEITADO", id: "APR-007", resto: "risco alto demais" });
  assert.equal(interpretarComando("aprova tudo"), null);
  const arq = join(mkdtempSync(join(tmpdir(), "hefisto-apr-")), "A.md");
  pedirAprovacao(arq, { missao: "HDEV-001", acao: "x", ambiente: "production", risco: "HIGH", motivo: "y" });
  assert.equal(processarComando(arq, "APROVAR APR-001", { autorizado: false, env: {} }).ok, false);
  assert.equal(lerAprovacoes(arq)[0].status, "PENDENTE");
  const r = processarComando(arq, "REJEITAR APR-001 agora não", { autorizado: true, origem: "whatsapp", env: {} });
  assert.equal(r.ok, true);
  assert.equal(lerAprovacoes(arq)[0].status, "REJEITADO");
  assert.equal(lerAprovacoes(arq)[0].decidido_por, "dono via whatsapp");
  assert.equal(processarComando(arq, "APROVAR APR-009", { autorizado: true, env: {} }).ok, false);
});

// ─── rodada do runner ────────────────────────────────────────────────────────

function ambiente() {
  const raiz = mkdtempSync(join(tmpdir(), "hefisto-pub-"));
  mkdirSync(join(raiz, "db"), { recursive: true });
  mkdirSync(join(raiz, "brain"), { recursive: true });
  writeFileSync(join(raiz, "brain", "DEPLOYS.md"), "# Deploys\n\nnota do dono\n");
  const C = { estado: join(raiz, ".estado"), aprovacoes: join(raiz, "brain", "APROVACOES.md"), deploys: join(raiz, "brain", "DEPLOYS.md") };
  return { raiz, C, cfg: { publicacao: { urlPreview: "https://app-git-{branch}-time.vercel.app" } } };
}
const OK = [{ nome: "intelligence", ok: true }, { nome: "agente", ok: true }];

test("rodada: preview AUTO_SAFE com URL e registro; teste falhou segura o push", async () => {
  const { raiz, C, cfg } = ambiente();
  const r = await avaliarRodada({ raiz, cfg, C, arquivos: ["scripts/x.mjs"], resultados: OK, branch: "claude/abc_1", head: "abc1234def", missao: { id: "HDEV-001" } });
  assert.equal(r.preview.decisao.decision, "AUTO_SAFE");
  assert.equal(r.preview.deploy_url, "https://app-git-claude-abc-1-time.vercel.app");
  assert.equal(r.producao, null, "missão não fechou: não pede produção");
  const deploys = readFileSync(C.deploys, "utf8");
  assert.ok(deploys.startsWith("# Deploys\n\nnota do dono"), "não mexe no texto do dono");
  assert.match(deploys, /\| preview \| HDEV-001 \| `abc1234` \| AUTO_SAFE \(LOW\) \| testes passed · build not_applicable \|/);
  const reg = readFileSync(join(C.estado, "publicacoes.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  for (const k of ["deploy_url", "commit_sha", "branch", "build_status", "test_status", "timestamp"]) assert.ok(k in reg[0], k);

  const falhou = await avaliarRodada({ raiz, cfg, C, arquivos: ["app/page.js"], resultados: [{ nome: "intelligence", ok: false }, { nome: "build", ok: true }], branch: "b", head: "h", missao: { id: "HDEV-001" } });
  assert.equal(falhou.preview.decisao.decision, "BLOCKED");
  const buildQuebrado = await avaliarRodada({ raiz, cfg, C, arquivos: ["app/page.js"], resultados: [...OK, { nome: "build", ok: false }], branch: "b", head: "h", missao: { id: "HDEV-001" } });
  assert.match(buildQuebrado.preview.decisao.reasons.join(" "), /build falhou/);
  const semBuild = await avaliarRodada({ raiz, cfg, C, arquivos: ["app/page.js"], resultados: OK, branch: "b", head: "h", missao: { id: "HDEV-001" } });
  assert.equal(semBuild.preview.decisao.decision, "BLOCKED", "app mudou e o build não rodou");
});

test("rodada: migração nova vira pedido ao dono (sem duplicar); policy aberta segura o push do branch", async () => {
  const { raiz, C, cfg } = ambiente();
  writeFileSync(join(raiz, "db", "IC_02.sql"), "begin;\ncreate table public.y (id int);\ncommit;\n/* ── ROLLBACK ──\ndrop table public.y;\n*/\n");
  const args = { raiz, cfg, C, arquivos: ["db/IC_02.sql"], resultados: OK, branch: "b", head: "h1", missao: { id: "HDEV-009" } };
  const r = await avaliarRodada(args);
  assert.equal(r.migracoes[0].classe, "SAFE");
  assert.equal(r.migracoes[0].decisao.decision, "APPROVAL_REQUIRED", "aplicar no banco real é com o dono (chave desligada)");
  assert.equal(r.migracoes[0].aprovacao, "APR-001");
  assert.equal(r.preview.decisao.decision, "AUTO_SAFE", "escrever o arquivo não é aplicar: o branch pode subir");
  await avaliarRodada({ ...args, head: "h2" });
  assert.equal(lerAprovacoes(C.aprovacoes).length, 1, "mesma migração pendente: atualiza o pedido");
  assert.match(lerAprovacoes(C.aprovacoes)[0].comando, /h2/);

  writeFileSync(join(raiz, "db", "ABERTA.sql"), `create policy "x" on public.y for all to authenticated using (true);`);
  const aberta = await avaliarRodada({ ...args, arquivos: ["db/ABERTA.sql"] });
  assert.equal(aberta.migracoes[0].decisao.decision, "BLOCKED");
  assert.equal(aberta.preview.decisao.decision, "BLOCKED", "RLS inseguro não sobe nem para o preview");
});

test("rodada: missão DONE com código pede produção ao dono, com evidências; preview validado conta só no mesmo commit", async () => {
  const { raiz, C, cfg } = ambiente();
  mkdirSync(C.estado, { recursive: true });
  mkdirSync(join(raiz, ".next", "static"), { recursive: true }); // bundle do build (varrido atrás de segredo)
  writeFileSync(join(raiz, ".next", "static", "a.js"), "console.log(1)");
  writeFileSync(join(C.estado, "preview.json"), JSON.stringify({ commit_sha: "h1", ok: true, critico: false, completo: true, base_url: "https://p" }));
  const args = { raiz, cfg, C, arquivos: ["app/dashboard/inteligencia/page.js"], resultados: [...OK, { nome: "build", ok: true }], branch: "b", head: "h1", missao: { id: "HDEV-001" }, missaoDone: true, emDiaComMain: () => true };
  const r = await avaliarRodada(args);
  assert.equal(r.producao.decisao.decision, "APPROVAL_REQUIRED");
  assert.equal(r.producao.aprovacao, "APR-001");
  const apr = lerAprovacoes(C.aprovacoes)[0];
  assert.match(apr.evidencias, /smoke OK em https:\/\/p/);
  assert.match(apr.rollback, /instant rollback/);
  // ligando a chave, LOW/MEDIUM com preview validado no mesmo commit passa
  const ligado = await avaliarRodada({ ...args, cfg: { publicacao: { autoPublishProductionLowRisk: true } } });
  assert.equal(ligado.producao.decisao.decision, "AUTO_SAFE");
  const outroCommit = await avaliarRodada({ ...args, head: "h9", cfg: { publicacao: { autoPublishProductionLowRisk: true } } });
  assert.equal(outroCommit.producao.decisao.decision, "BLOCKED");
  assert.match(outroCommit.producao.decisao.reasons.join(" "), /previewValidated/);
  // smoke com vazamento entre empresas: CRÍTICO
  writeFileSync(join(C.estado, "preview.json"), JSON.stringify({ commit_sha: "h1", ok: false, critico: true, completo: true }));
  assert.match((await avaliarRodada(args)).preview.decisao.reasons.join(" "), /isolamento entre empresas/);
});

test("arquivos mudados e URL do preview", () => {
  assert.deepEqual(arquivosMudados("app/a.js\ndb/x.sql\n", " M app/a.js\n?? \"docs/brain/n\\303\\243o.md\"\nR  velho.js -> novo.js\n"), ["app/a.js", "db/x.sql", "docs/brain/n\\303\\243o.md", "novo.js"]);
  assert.equal(urlPreview("https://p-git-{branch}.app", "Claude/Fervent-Bell"), "https://p-git-claude-fervent-bell.app");
  assert.equal(tipoDaMudanca(["docs/a.md", "README.md"]), "docs");
  assert.equal(tipoDaMudanca(["app/a.js", "db/x.sql"]), "migration");
  assert.deepEqual(areasDosArquivos(["app/lib/server/supabase.mjs"]).sort(), ["app", "server"]);
});

test("status: modo de publicação, produção, migration e aprovações pendentes", () => {
  const { raiz, C } = ambiente();
  pedirAprovacao(C.aprovacoes, { missao: "HDEV-001", acao: "x", ambiente: "production", risco: "HIGH", motivo: "y" });
  const cfg = { caminhos: { aprovacoes: "brain/APROVACOES.md" }, publicacao: CFG_REAL.publicacao };
  const s = estadoPublicacao(raiz, cfg, { politica: { migracao: "REVIEW", preview: "AUTO_SAFE", producao: "APPROVAL_REQUIRED" } });
  assert.equal(s.modo, "AUTO SAFE");
  assert.match(s.producao, /^aguardando aprovação/);
  assert.equal(s.ultima_migracao, "review");
  assert.equal(s.aprovacoes_pendentes, 1);
  assert.match(estadoPublicacao(raiz, { caminhos: {}, publicacao: { autoPublishProductionLowRisk: true } }, null).producao, /^permitida/);
});
