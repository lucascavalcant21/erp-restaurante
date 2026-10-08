// Testes do agente autônomo (scripts/hefisto-agent). Rodar: npm run test:agent
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "../lib.mjs";
import { rodar } from "../runner.mjs";
import { regenerarIndices, novaMissao, marcarPronta } from "../missoes.mjs";
import { relatorioStatus } from "../status.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CFG_REAL = JSON.parse(readFileSync(join(AQUI, "..", "config.json"), "utf8"));

function missao(id, extra = {}, corpo = `\n# ${id}\n\n## Objetivo\n\nx\n\n## Resultado\n\n## Histórico\n`) {
  return L.escreverFrontmatter({ id, titulo: `Missão ${id}`, status: "READY", prioridade: 2, dependencias: [], bloqueadores: [], tentativas: 0, ...extra }, corpo);
}

// ─── núcleo ──────────────────────────────────────────────────────────────────
test("frontmatter: ida e volta com texto, número, listas e dois-pontos", () => {
  const dados = { id: "HDEV-001", titulo: "Concluir HI-02: produção real", status: "READY", prioridade: 1, dependencias: [], bloqueadores: ["ACESSO-001", "ACESSO-002"], ultima_falha: "", vazio: "123" };
  const texto = L.escreverFrontmatter(dados, "\n# corpo\n");
  const lido = L.lerFrontmatter(texto);
  assert.deepEqual(lido.dados, dados);
  assert.equal(lido.corpo.trim(), "# corpo");
  assert.throws(() => L.escreverFrontmatter({ x: ["a,b"] }, ""), /lista inválido/);
  assert.throws(() => L.lerFrontmatter("---\nsem dois pontos\n---\n"), /frontmatter inválido/);
});

test("validação de missão aponta cada campo errado", () => {
  assert.deepEqual(L.validarMissao({ id: "HDEV-001", titulo: "t", status: "READY", prioridade: 1, dependencias: [], bloqueadores: [] }), []);
  const erros = L.validarMissao({ id: "x", status: "PRONTA", prioridade: 9, dependencias: "a", bloqueadores: null });
  assert.equal(erros.length, 6);
});

test("próxima missão: READY, sem bloqueador, dependências DONE, maior prioridade", () => {
  const ms = [
    { id: "HDEV-001", status: "DONE", prioridade: 1, dependencias: [], bloqueadores: [] },
    { id: "HDEV-002", status: "READY", prioridade: 2, dependencias: ["HDEV-001"], bloqueadores: [] },
    { id: "HDEV-003", status: "READY", prioridade: 1, dependencias: ["HDEV-009"], bloqueadores: [] },
    { id: "HDEV-004", status: "READY", prioridade: 1, dependencias: [], bloqueadores: ["ACESSO-001"] },
    { id: "HDEV-005", status: "BACKLOG", prioridade: 1, dependencias: [], bloqueadores: [] },
  ];
  assert.equal(L.proximaMissao(ms).id, "HDEV-002");
  assert.equal(L.proximaMissao(ms.filter((m) => m.id !== "HDEV-002")), null);
});

test("anotar seção: insere no fim da seção certa ou cria a seção", () => {
  const c = "# t\n\n## Resultado\n\n- a\n\n## Histórico\n\n- h1\n";
  const r = L.anotarSecao(c, "Resultado", "b");
  assert.match(r, /## Resultado\n\n- a\n- b\n\n## Histórico/);
  assert.match(L.anotarSecao(c, "Evidências", "e"), /## Evidências\n\n- e\n$/);
});

test("anti-loop: mesma falha 3x bloqueia; sem progresso bloqueia; DONE só com validação verde", () => {
  const lim = { maxMesmaFalha: 3, maxSemProgresso: 2, maxTentativas: 6 };
  const falha = { assinatura: "abc", resumo: "teste x falhou" };
  let m = { status: "IN_PROGRESS", tentativas: 0 };
  for (let i = 0; i < 2; i++) { const r = L.decidir(m, { motorOk: true, validacoesOk: false, falha, progresso: true }, lim); m = r.missao; assert.equal(m.status, "READY"); }
  const r3 = L.decidir(m, { motorOk: true, validacoesOk: false, falha, progresso: true }, lim);
  assert.equal(r3.missao.status, "BLOCKED");
  assert.match(r3.motivo, /mesma falha repetiu 3x/);

  const outra = L.decidir({ ...m, status: "IN_PROGRESS" }, { motorOk: true, validacoesOk: false, falha: { assinatura: "zzz", resumo: "outra" }, progresso: true }, lim);
  assert.deepEqual([outra.missao.status, outra.missao.mesma_falha], ["READY", 1]);

  let p = { status: "IN_PROGRESS", tentativas: 0 };
  p = L.decidir(p, { motorOk: true, validacoesOk: true, falha: null, progresso: false }, lim).missao;
  const sem = L.decidir(p, { motorOk: true, validacoesOk: true, falha: null, progresso: false }, lim);
  assert.deepEqual([sem.missao.status, /sem progresso/.test(sem.motivo)], ["BLOCKED", true]);

  assert.equal(L.decidir({ status: "IN_PROGRESS" }, { motorOk: true, validacoesOk: true, falha: null, progresso: true, statusAgente: "DONE" }, lim).missao.status, "DONE");
  assert.equal(L.decidir({ status: "IN_PROGRESS" }, { motorOk: true, validacoesOk: false, falha, progresso: true, statusAgente: "DONE" }, lim).missao.status, "READY");
  assert.equal(L.decidir({ status: "IN_PROGRESS" }, { motorOk: true, validacoesOk: true, falha: null, progresso: true, statusAgente: "BLOCKED" }, lim).missao.status, "BLOCKED");
  assert.equal(L.decidir({ status: "IN_PROGRESS", tentativas: 5 }, { motorOk: true, validacoesOk: true, falha: null, progresso: true }, lim).missao.status, "BLOCKED");
});

test("assinatura de falha ignora tempos/números; resultado do agente lê a última linha válida", () => {
  assert.equal(L.assinaturaFalha("npm test", "falhou em 123ms\nnot ok 4"), L.assinaturaFalha("npm test", "falhou em 98ms\nnot ok 7"));
  assert.notEqual(L.assinaturaFalha("npm test", "erro A"), L.assinaturaFalha("npm test", "erro B"));
  const t = 'texto\nHEFISTO_RESULTADO: {"status":"IN_PROGRESS","resumo":"meio"}\nmais\nHEFISTO_RESULTADO: {"status":"DONE","resumo":"pronto"}';
  assert.deepEqual(L.lerResultadoDoAgente(t), { status: "DONE", resumo: "pronto" });
  assert.equal(L.lerResultadoDoAgente("HEFISTO_RESULTADO: {quebrado"), null);
  assert.equal(L.lerResultadoDoAgente('HEFISTO_RESULTADO: {"status":"INVENTADO"}').status, null);
});

test("trecho gerado: substitui só entre os marcadores e preserva o resto", () => {
  const t1 = L.atualizarTrechoGerado("# Missões\n\nnota do dono\n", "tabela 1");
  assert.match(t1, /nota do dono[\s\S]*tabela 1/);
  const t2 = L.atualizarTrechoGerado(`${t1}\nrodapé do dono\n`, "tabela 2");
  assert.ok(t2.includes("tabela 2") && !t2.includes("tabela 1") && t2.includes("rodapé do dono") && t2.includes("nota do dono"));
  const t3 = L.atualizarTrechoGerado(t2, "agente", "agente");
  assert.ok(t3.includes("tabela 2") && t3.includes("agente"));
});

test("heartbeat: nunca iniciado, rodando, travado, parado sem fim, encerrado", () => {
  const agora = new Date("2026-10-08T03:00:00Z");
  assert.equal(L.diagnostico(null).estado, "NUNCA_INICIADO");
  const s = { pid: 123, estado: "RODANDO", current_mission: "HDEV-001", last_heartbeat: "2026-10-08T02:58:00Z" };
  assert.equal(L.diagnostico(s, { agora, vivo: () => true }).estado, "RODANDO");
  assert.equal(L.diagnostico({ ...s, last_heartbeat: "2026-10-08T02:30:00Z" }, { agora, vivo: () => true }).estado, "TRAVADO");
  assert.match(L.diagnostico(s, { agora, vivo: () => false }).detalhe, /não existe mais/);
  assert.equal(L.diagnostico({ ...s, estado: "ENCERRADO", last_result: "fim: sem_missao" }, { agora, vivo: () => false }).estado, "PARADO");
  assert.equal(L.pidVivo(process.pid), true);
  assert.equal(L.pidVivo(-1), false);
});

test("relatório noturno: modelo com todas as seções, anotação e fim", () => {
  const dir = mkdtempSync(join(tmpdir(), "hefisto-noturno-"));
  const arq = L.garantirRelatorioNoturno(dir, "2026-10-08", "2026-10-08T01:00:00Z");
  for (const s of L.SECOES_NOTURNO) assert.ok(readFileSync(arq, "utf8").includes(`## ${s}`), s);
  L.anotarRelatorio(arq, "Commits", "abc123 feat: x");
  L.fecharRelatorio(arq, "2026-10-08T06:00:00Z");
  const t = readFileSync(arq, "utf8");
  assert.match(t, /## Commits\n\n- abc123 feat: x/);
  assert.match(t, /Fim: 2026-10-08T06:00:00Z/);
  assert.equal(L.garantirRelatorioNoturno(dir, "2026-10-08", "outro"), arq, "não recria o do mesmo dia");
});

// ─── runner de ponta a ponta (motor falso, sem git) ─────────────────────────
function montarAmbiente({ motor = "done", validacao = "ok", missoes } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), "hefisto-agente-"));
  const dirM = join(raiz, "brain", "missoes");
  mkdirSync(dirM, { recursive: true });
  for (const [id, extra] of Object.entries(missoes || { "HDEV-001": { prioridade: 1 }, "HDEV-002": { dependencias: ["HDEV-001"] }, "HDEV-003": { status: "BACKLOG" } })) {
    writeFileSync(join(dirM, `${id}.md`), missao(id, extra));
  }
  writeFileSync(join(raiz, "brain", "ATIVAS.md"), "# Missões ativas\n\nnota do dono\n");
  writeFileSync(join(raiz, "brain", "BACKLOG.md"), "# Backlog\n");
  writeFileSync(join(raiz, "brain", "STATUS.md"), "# Status\n");
  const motorJs = join(raiz, "motor-falso.mjs");
  writeFileSync(motorJs, `
import { readFileSync, writeFileSync } from "node:fs";
let entrada = ""; process.stdin.on("data", (d) => entrada += d); process.stdin.on("end", () => {
  const arq = process.env.HEFISTO_MISSAO_ARQUIVO;
  if (process.argv[2] === "done") {
    writeFileSync(arq, readFileSync(arq, "utf8").replace(/^status: .*$/m, "status: DONE"));
    console.log(JSON.stringify({ result: "trabalhei\\nHEFISTO_RESULTADO: " + JSON.stringify({ status: "DONE", resumo: "feito " + process.env.HEFISTO_MISSAO_ID }), total_cost_usd: 0.01 }));
  } else if (process.argv[2] === "nada") {
    console.log(JSON.stringify({ result: "não consegui" }));
  } else { process.exit(3); }
});`);
  const cfg = {
    caminhos: { cerebro: "brain", missoes: "brain/missoes", ativas: "brain/ATIVAS.md", backlog: "brain/BACKLOG.md", statusAtual: "brain/STATUS.md", noturnos: "brain/noturnos", estado: ".estado" },
    motor: { comando: process.execPath, args: [motorJs, motor], allowedTools: [], disallowedTools: [] },
    limites: { ...CFG_REAL.limites, maxMissoesPorExecucao: 10, maxSemProgresso: 5, heartbeatSegundos: 5 },
    validacoes: [{ nome: "teste", comando: validacao === "ok" ? `"${process.execPath}" -e "process.exit(0)"` : `"${process.execPath}" -e "console.log('not ok 1 - soma'); process.exit(1)"`, timeoutMin: 1 }],
    build: { comando: "true", quando: "nunca" },
    commitarMemoria: false,
    branchesProibidas: ["main", "master"],
  };
  const arqCfg = join(raiz, "config.json");
  writeFileSync(arqCfg, JSON.stringify(cfg));
  return { raiz, arqCfg, cfg, dirM };
}

const opcoes = (amb, extra = {}) => ({ raiz: amb.raiz, config: amb.arqCfg, silencioso: true, semSinais: true, ...extra });

test("runner: faz a missão, respeita a dependência, atualiza índice, status e relatório", async () => {
  const amb = montarAmbiente();
  const r = await rodar(opcoes(amb));
  assert.deepEqual(r.missoes, ["HDEV-001", "HDEV-002"]);
  assert.equal(r.motivoFim, "sem_missao");
  const ms = Object.fromEntries(L.carregarMissoes(amb.dirM).map((m) => [m.id, m]));
  assert.deepEqual([ms["HDEV-001"].status, ms["HDEV-002"].status, ms["HDEV-003"].status], ["DONE", "DONE", "BACKLOG"]);
  assert.match(ms["HDEV-001"].corpo, /rodada 1 → DONE .*agente: feito HDEV-001.*custo US\$ 0\.01/);
  const ativas = readFileSync(join(amb.raiz, "brain", "ATIVAS.md"), "utf8");
  assert.ok(ativas.includes("nota do dono") && ativas.includes("[[HDEV-002]]") && ativas.includes("nenhuma missão READY"));
  assert.ok(readFileSync(join(amb.raiz, "brain", "BACKLOG.md"), "utf8").includes("[[HDEV-003]]"));
  const rel = readFileSync(r.relatorio, "utf8");
  assert.match(rel, /HDEV-001 rodada 1 → \*\*DONE\*\*/);
  assert.match(rel, /teste OK — TESTADO LOCAL/);
  assert.doesNotMatch(rel, /Fim: \(em andamento\)/);
  const st = L.lerStatus(join(amb.raiz, ".estado", "status.json"));
  assert.equal(st.estado, "ENCERRADO");
  assert.ok(!existsSync(join(amb.raiz, ".estado", "runner.lock")), "libera o lock");
  assert.match(readFileSync(join(amb.raiz, "brain", "STATUS.md"), "utf8"), /Estado: \*\*ENCERRADO\*\*/);
  assert.ok(readdirSync(join(amb.raiz, ".estado", "logs")).some((f) => f.includes("HDEV-001")), "log por missão");
});

test("runner: a mesma falha 3x bloqueia a missão e o runner segue/termina (não gira a noite toda)", async () => {
  const amb = montarAmbiente({ motor: "nada", validacao: "falha", missoes: { "HDEV-010": { prioridade: 1 } } });
  const r = await rodar(opcoes(amb));
  assert.deepEqual(r.missoes, ["HDEV-010", "HDEV-010", "HDEV-010"]);
  const m = L.carregarMissoes(amb.dirM)[0];
  assert.equal(m.status, "BLOCKED");
  assert.equal(m.mesma_falha, 3);
  assert.match(readFileSync(r.relatorio, "utf8"), /## Bloqueadores\n\n- HDEV-010: a mesma falha repetiu 3x/);
});

test("runner: motor que não existe conta como falha e acaba bloqueando, sem derrubar o runner", async () => {
  const amb = montarAmbiente({ missoes: { "HDEV-020": { prioridade: 1 } } });
  const cfg = { ...amb.cfg, motor: { ...amb.cfg.motor, comando: join(amb.raiz, "nao-existe-motor") , args: [] } };
  writeFileSync(amb.arqCfg, JSON.stringify(cfg));
  const r = await rodar(opcoes(amb));
  assert.equal(L.carregarMissoes(amb.dirM)[0].status, "BLOCKED");
  assert.equal(r.motivoFim, "sem_missao");
});

test("runner: STOP impede começar; dry-run não muda nada; --uma faz só uma", async () => {
  const amb = montarAmbiente();
  mkdirSync(join(amb.raiz, ".estado"), { recursive: true });
  writeFileSync(join(amb.raiz, ".estado", "STOP"), "x");
  assert.equal((await rodar(opcoes(amb))).motivoFim, "stop");
  assert.ok(L.carregarMissoes(amb.dirM).every((m) => m.status !== "DONE"));

  const amb2 = montarAmbiente();
  const antes = readFileSync(join(amb2.dirM, "HDEV-001.md"), "utf8");
  const dry = await rodar(opcoes(amb2, { dryRun: true }));
  assert.equal(dry.motivoFim, "dry_run");
  assert.match(dry.prompt, /brain\/missoes\/HDEV-001\.md/);
  assert.match(dry.prompt, /HEFISTO_RESULTADO/);
  assert.equal(readFileSync(join(amb2.dirM, "HDEV-001.md"), "utf8"), antes);

  const uma = await rodar(opcoes(amb2, { uma: true }));
  assert.deepEqual([uma.missoes, uma.motivoFim], [["HDEV-001"], "limite_missoes"]);
});

test("missões e status: índice valida dependência inexistente; nova missão; pronta zera contadores", () => {
  const amb = montarAmbiente({ missoes: { "HDEV-001": { status: "BLOCKED", tentativas: 4, mesma_falha: 3 }, "HDEV-002": { dependencias: ["HDEV-999"] } } });
  const cfg = amb.cfg;
  const r = regenerarIndices(amb.raiz, cfg);
  assert.equal(r.ok, false);
  assert.match(r.erros[0], /HDEV-999, que não existe/);
  const nova = novaMissao(amb.raiz, cfg, "Previsão de vendas", { prioridade: 2 });
  assert.equal(nova.id, "HDEV-003");
  assert.equal(L.lerMissao(nova.arquivo).status, "BACKLOG");
  const p = marcarPronta(amb.raiz, cfg, "HDEV-001");
  assert.deepEqual([p.status, p.tentativas, p.mesma_falha], ["READY", 0, 0]);
  const s = relatorioStatus(amb.raiz, cfg);
  assert.equal(s.estado, "NUNCA_INICIADO");
  assert.equal(s.proxima, "HDEV-001 — Missão HDEV-001");
});

test("Windows: claude.cmd vai pelo cmd com cada argumento entre aspas; recusa o que o cmd interpretaria", () => {
  const linux = L.prepararSpawn("claude", ["-p", "--allowedTools", "Bash(npm run:*)"], "linux");
  assert.deepEqual(linux, { arquivo: "claude", args: ["-p", "--allowedTools", "Bash(npm run:*)"], shell: false });
  const win = L.prepararSpawn("claude", ["-p", "--allowedTools", "Bash(npm run:*)", "Read"], "win32");
  assert.deepEqual(win, { arquivo: '"claude" "-p" "--allowedTools" "Bash(npm run:*)" "Read"', args: [], shell: true });
  assert.equal(L.prepararSpawn("C:\\Program Files\\nodejs\\node.exe", ["x.mjs"], "win32").arquivo, '"C:\\Program Files\\nodejs\\node.exe" "x.mjs"');
  assert.throws(() => L.prepararSpawn("claude", ['-p "injeção"'], "win32"), /inseguro/);
  assert.throws(() => L.prepararSpawn("claude", ["%PATH%"], "win32"), /inseguro/);
  assert.deepEqual(L.comandoParaMatar(42, "win32"), { arquivo: "taskkill", args: ["/pid", "42", "/T", "/F"] });
  assert.equal(L.comandoParaMatar(42, "linux"), null);
  // a configuração real passa pela trava do Windows (nenhum argumento perigoso)
  assert.doesNotThrow(() => L.prepararSpawn(CFG_REAL.motor.comando, [...CFG_REAL.motor.args, "--allowedTools", ...CFG_REAL.motor.allowedTools, "--disallowedTools", ...CFG_REAL.motor.disallowedTools], "win32"));
});

test("preparar: fora do repositório explica o que fazer; na main cria o branch da noite com a data", async () => {
  const { verificar } = await import("../preparar.mjs");
  const fora = verificar(tmpdir(), CFG_REAL, { executar: () => ({ ok: false, saida: "fatal: not a git repository" }) });
  assert.equal(fora.find((i) => i.nome === "Repositório git").ok, false);
  assert.match(fora.find((i) => i.nome === "Repositório git").comoResolver, /git clone/);

  const amb = montarAmbiente();
  const chamadas = [];
  const executar = (arquivo, args) => {
    chamadas.push([arquivo, ...args].join(" "));
    if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return { ok: true, saida: amb.raiz };
    if (args[0] === "branch") return { ok: true, saida: "main" };
    if (args[0] === "rev-parse" && args[1] === "--verify") return { ok: false, saida: "" };
    if (args[0] === "checkout") return { ok: true, saida: "" };
    if (args[0] === "--version") return { ok: true, saida: "2.1.293 (Claude Code)" };
    return { ok: true, saida: "" };
  };
  const itens = verificar(amb.raiz, amb.cfg, { executar, hoje: "2026-10-08" });
  assert.ok(chamadas.includes("git checkout -b hefisto/noite-2026-10-08"), chamadas.join(" | "));
  assert.match(itens.find((i) => i.nome === "Branch de trabalho").detalhe, /criado hefisto\/noite-2026-10-08 \(a partir de main\)/);
  assert.equal(itens.find((i) => i.nome === "Missões").ok, true);
});

test("configuração real: caminhos, limites e travas de segurança presentes", () => {
  for (const k of ["cerebro", "missoes", "ativas", "backlog", "statusAtual", "noturnos", "estado"]) assert.ok(CFG_REAL.caminhos[k], k);
  for (const proibido of ["Bash(git push --force:*)", "Bash(git push origin main:*)", "Bash(rm -rf:*)", "Bash(supabase db reset:*)", "Bash(gh pr merge:*)"]) assert.ok(CFG_REAL.motor.disallowedTools.includes(proibido), proibido);
  assert.ok(CFG_REAL.motor.args.includes("--max-budget-usd"), "teto de gasto por rodada");
  assert.ok(!CFG_REAL.motor.args.includes("--dangerously-skip-permissions"), "nunca pular permissões");
  assert.deepEqual(CFG_REAL.branchesProibidas, ["main", "master"]);
});
