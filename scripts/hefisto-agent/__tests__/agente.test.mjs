// Testes do agente autônomo (scripts/hefisto-agent). Rodar: npm run test:agent
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import * as L from "../lib.mjs";
import { rodar } from "../runner.mjs";
import { avaliarSql, decidirGancho, semLiterais } from "../guarda-sql.mjs";
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
  writeFileSync("argv-motor.json", JSON.stringify({ argv: process.argv.slice(2), guardaLog: process.env.HEFISTO_GUARDA_LOG, chaveApi: "ANTHROPIC_API_KEY" in process.env }));
  const linha = (o) => console.log(JSON.stringify(o));
  if (process.argv[2] === "extra" || process.argv[2] === "paga") {
    linha({ type: "system", subtype: "init", apiKeySource: process.argv[2] === "paga" ? "ANTHROPIC_API_KEY" : "none" });
    linha({ type: "rate_limit_event", rate_limit_info: { status: "allowed", isUsingOverage: process.argv[2] === "extra", overageStatus: "allowed", resetsAt: Number(process.env.VOLTA_EM || 0), unifiedWindows: { five_hour: { utilization: 1.0, resetsAt: Number(process.env.VOLTA_EM || 0) } } } });
    writeFileSync("chegou-ao-fim.txt", "o runner deveria ter matado antes");
    setTimeout(() => linha({ type: "result", result: "trabalhei pago" }), 20000);
    return;
  }
  if (process.argv[2] === "done") {
    writeFileSync(arq, readFileSync(arq, "utf8").replace(/^status: .*$/m, "status: DONE"));
    console.log(JSON.stringify({ result: "trabalhei\\nHEFISTO_RESULTADO: " + JSON.stringify({ status: "DONE", resumo: "feito " + process.env.HEFISTO_MISSAO_ID }), total_cost_usd: 0.01 }));
  } else if (process.argv[2] === "limite") {
    console.log(JSON.stringify({ is_error: true, result: "Claude AI usage limit reached|1760000000" })); process.exit(1);
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
  assert.match(dry.prompt, /brain[\\/]missoes[\\/]HDEV-001\.md/); // "\" no Windows
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

test("Windows sem Git Bash: regras Bash espelhadas em PowerShell; motor pode ser apontado por variável", () => {
  assert.deepEqual(L.comPowerShell(["Read", "Bash(git push --force:*)", "Bash(npm run:*)"]),
    ["Read", "Bash(git push --force:*)", "Bash(npm run:*)", "PowerShell(git push --force *)", "PowerShell(npm run *)"]);
  for (const p of ["PowerShell(git push --force *)", "PowerShell(git push origin main *)", "PowerShell(gh pr merge *)"]) {
    assert.ok(L.comPowerShell(CFG_REAL.motor.disallowedTools).includes(p), p);
  }
  assert.equal(L.comandoDoMotor(CFG_REAL, {}), "claude");
  assert.equal(L.comandoDoMotor(CFG_REAL, { HEFISTO_AGENT_CLAUDE: "C:\\Users\\x\\.local\\bin\\claude.exe" }), "C:\\Users\\x\\.local\\bin\\claude.exe");
  assert.doesNotMatch(L.INSTRUCAO_MOTOR, /["%]/, "a instrução passa pela trava do cmd");
});

test("preparar: claude que não é o Claude Code (app Desktop) e falta de login viram FALTA com o caminho", async () => {
  const { verificar } = await import("../preparar.mjs");
  const amb = montarAmbiente();
  const base = (args) => {
    if (args[0] === "rev-parse") return { ok: true, saida: amb.raiz };
    if (args[0] === "branch") return { ok: true, saida: "hefisto/noite-x" };
    return { ok: true, saida: "" };
  };
  const desktop = verificar(amb.raiz, amb.cfg, { executar: (a, args) => (args[0] === "--version" ? { ok: true, saida: "Claude 1.0.0" } : base(args)) });
  const item = desktop.find((i) => i.nome === "Claude Code (motor)");
  assert.equal(item.ok, false);
  assert.match(item.comoResolver, /where\.exe claude/);
  const semLogin = verificar(amb.raiz, amb.cfg, { executar: (a, args) => (args[0] === "--version" ? { ok: true, saida: "2.1.294 (Claude Code)" } : args[0] === "auth" ? { ok: false, saida: "" } : base(args)) });
  assert.equal(semLogin.find((i) => i.nome === "Login no Claude Code").ok, false);
});

test("configuração real: caminhos, limites e travas de segurança presentes", () => {
  for (const k of ["cerebro", "missoes", "ativas", "backlog", "statusAtual", "noturnos", "estado"]) assert.ok(CFG_REAL.caminhos[k], k);
  for (const proibido of ["Bash(git push --force:*)", "Bash(git push origin main:*)", "Bash(rm -rf:*)", "Bash(supabase db reset:*)", "Bash(gh pr merge:*)"]) assert.ok(CFG_REAL.motor.disallowedTools.includes(proibido), proibido);
  assert.ok(CFG_REAL.motor.args.includes("--max-budget-usd"), "teto de gasto por rodada");
  assert.equal(CFG_REAL.motor.args[CFG_REAL.motor.args.indexOf("--permission-mode") + 1], "dontAsk", "o que não está liberado é negado, sem perguntar");
  assert.ok(!CFG_REAL.motor.args.includes("--dangerously-skip-permissions"), "nunca pular permissões");
  assert.deepEqual(CFG_REAL.branchesProibidas, ["main", "master"]);
});

// ─── conectores do claude.ai (Supabase/Vercel) e guarda de SQL ───────────────
const PROJ = { projetos: ["sezccspqxgklicfndwxx"], projeto: "sezccspqxgklicfndwxx" };

test("guarda-sql: leitura passa embrulhada em transação somente leitura; escrita e truques são recusados", () => {
  const rls = "select set_config('request.jwt.claims', '{\"sub\":\"u1\",\"role\":\"authenticated\"}', true);\nset local role authenticated;\nselect auth.uid(), count(*) from estoque_saldos";
  for (const ok of ["select count(*) from produtos where unidade_id = $1", rls, "with t as (select 1) select case when 1 = 1 then 2 end from t;",
    "select 'drop table x; commit' as texto -- delete\n", "explain analyze select * from vendas limit 1", "/* /* */ commit; */ select 1", "select $a$ ; commit $a$", "SHOW search_path"]) {
    const r = avaliarSql(ok, PROJ);
    assert.ok(r.ok, `${ok} → ${r.motivo}`);
    assert.ok(r.consulta.startsWith("begin transaction read only;\n") && r.consulta.endsWith("\n;\nrollback;"), "sempre embrulhada");
  }
  const nega = {
    "insert into x values (1)": /não permitido/, "select 1; commit; delete from x": /não permitido: "commit"/, "do $$ begin delete from x; end $$": /não permitido/,
    "with d as (delete from x returning *) select * from d": /"delete" não é leitura/, "select * into nova from x": /"into"/,
    "select * from produtos for update": /"update"/, "select * from vault.decrypted_secrets": /segredo/, "select email from auth.users": /auth/,
    "select set_config('default_transaction_read_only', 'off', false)": /modo da transação/, "select pg_terminate_backend(1)": /administrativa/,
    "select dblink_exec('x')": /rede/, "select net.http_post('https://x')": /rede/, "select pg_read_file('/etc/passwd')": /arquivos/,
    "select 1 /* sem fim": /sem fim/, "select 'sem fim": /sem fim/, "   ": /vazia/, "select pg_sleep(600)": /pg_sleep/,
  };
  for (const [sql, motivo] of Object.entries(nega)) {
    const r = avaliarSql(sql, PROJ);
    assert.equal(r.ok, false, sql);
    assert.match(r.motivo, motivo, sql);
  }
  assert.match(avaliarSql("select 1", { projetos: ["sezccspqxgklicfndwxx"], projeto: "outro" }).motivo, /fora da lista/);
  assert.match(avaliarSql("select 1".padEnd(20001, " "), PROJ).motivo, /longa demais/);
  assert.equal(semLiterais("select E'it\\'s; commit'").texto, "select E''");
});

test("guarda-sql como gancho: aprova com a consulta trocada, nega com motivo, falha fechada", () => {
  const conectores = { supabase: { projetos: ["p1"] } };
  const ok = decidirGancho({ tool_name: "mcp__claude_ai_Supabase__execute_sql", tool_input: { project_id: "p1", query: "select 1" } }, conectores);
  assert.equal(ok.hookSpecificOutput.permissionDecision, "allow");
  assert.equal(ok.hookSpecificOutput.updatedInput.project_id, "p1");
  assert.match(ok.hookSpecificOutput.updatedInput.query, /^begin transaction read only;\nselect 1\n;\nrollback;$/);
  const nao = decidirGancho({ tool_name: "mcp__Supabase__execute_sql", tool_input: { project_id: "p1", query: "delete from x" } }, conectores);
  assert.equal(nao.hookSpecificOutput.permissionDecision, "deny");
  assert.match(nao.hookSpecificOutput.permissionDecisionReason, /só leitura/);
  assert.equal(decidirGancho({ tool_name: "Bash", tool_input: { command: "ls" } }, conectores), null, "não é com ela");

  // o script de verdade, como o Claude Code chama
  const guarda = join(AQUI, "..", "guarda-sql.mjs");
  const cfgArq = join(AQUI, "..", "config.json");
  const roda = (entrada) => spawnSync(process.execPath, [guarda, cfgArq], { input: entrada, encoding: "utf8" });
  const a = JSON.parse(roda(JSON.stringify({ tool_name: "mcp__Supabase__execute_sql", tool_input: { project_id: "sezccspqxgklicfndwxx", query: "select 1" } })).stdout);
  assert.equal(a.hookSpecificOutput.permissionDecision, "allow");
  const outroProjeto = JSON.parse(roda(JSON.stringify({ tool_name: "mcp__Supabase__execute_sql", tool_input: { project_id: "outro", query: "select 1" } })).stdout);
  assert.equal(outroProjeto.hookSpecificOutput.permissionDecision, "deny");
  const quebrado = JSON.parse(roda("isto não é json").stdout);
  assert.equal(quebrado.hookSpecificOutput.permissionDecision, "deny", "na dúvida, nega");
});

test("conectores: só leitura liberada; SQL só pela guarda; escrita e segredos negados em todos os prefixos", () => {
  const r = L.regrasConectores(CFG_REAL.conectores, { supabase: ["mcp__claude_ai_supabase__"] });
  for (const p of ["mcp__Supabase__", "mcp__claude_ai_Supabase__", "mcp__claude_ai_supabase__"]) {
    assert.ok(r.permitir.includes(`${p}list_tables`), p);
    assert.ok(!r.permitir.includes(`${p}execute_sql`), "SQL nunca liberado direto: só pela guarda");
    assert.ok(r.guardadas.includes(`${p}execute_sql`), p);
    assert.ok(r.negar.includes(`${p}apply_migration`), p);
  }
  for (const v of ["get_deployment", "get_runtime_logs", "web_fetch_vercel_url"]) assert.ok(r.permitir.includes(`mcp__claude_ai_Vercel__${v}`), v);
  for (const n of ["create_deployment", "request_promote", "edit_project_env", "get_project_env", "filter_project_envs", "buy_domain", "delete_project"]) {
    assert.ok(r.negar.some((g) => new RegExp(`^${g.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(`mcp__claude_ai_Vercel__${n}`)), n);
  }
  // nada liberado casa com o que é proibido, e todo nome liberado é de leitura
  const casa = (nome) => CFG_REAL.conectores.nuncaPermitir.some((g) => new RegExp(`^${g.replace(/\*/g, ".*")}$`).test(nome));
  for (const [, c] of L.entradasConectores(CFG_REAL.conectores)) {
    for (const f of c.leitura) {
      assert.ok(!casa(f), `${f} está liberado e proibido ao mesmo tempo`);
      assert.match(f, /^(list_|get_|search_|query_|execute_sql$|web_fetch_vercel_url$|generate_typescript_types$)/, f);
    }
  }
  // o gancho cobre todo nome de SQL
  const motor = L.configMotor(r, "node guarda");
  const re = new RegExp(motor.hooks.PreToolUse[0].matcher);
  for (const g of r.guardadas) assert.ok(re.test(g), g);
  assert.ok(!re.test("mcp__Supabase__execute_sqlx") && !re.test("Bash"));
  assert.deepEqual(motor.permissions, { allow: r.permitir, deny: r.negar });
  assert.equal(L.configMotor({ permitir: [], negar: [], guardadas: [] }, "x"), null);
  assert.throws(() => L.regrasConectores(CFG_REAL.conectores, { supabase: ["mcp__*__"] }), /inválido/);
  assert.match(L.comandoGuarda("C:\\Users\\x\\g.mjs", "C:\\Users\\x\\c.json"), /^node "C:\/Users\/x\/g\.mjs" "C:\/Users\/x\/c\.json"$/);
  // as regras vão no arquivo --settings: a linha de comando cabe no cmd do Windows (8191)
  const linha = L.prepararSpawn("claude", L.argumentosMotor(CFG_REAL, { settings: "C:\\Users\\lucas\\erp-restaurante\\.hefisto-agent\\motor-settings.json" }), "win32").arquivo;
  assert.ok(linha.length < 7000, `linha com ${linha.length} caracteres`);
  const args = L.argumentosMotor(CFG_REAL, { settings: "s.json" });
  assert.ok(args.indexOf("--settings") < args.indexOf("--allowedTools"), "--settings antes das listas, que engolem o resto");
});

function eventoInicio({ ferramentas = [], servidores = [], fonte = "none", extra = "rejected" } = {}) {
  return [
    "aviso qualquer no stderr",
    JSON.stringify({ type: "system", subtype: "init", claude_code_version: "2.1.294", apiKeySource: fonte, mcp_servers: servidores, tools: ["Read", "Bash", ...ferramentas] }),
    JSON.stringify({ type: "rate_limit_event", rate_limit_info: { status: "allowed", resetsAt: 1791487800, overageStatus: extra, isUsingOverage: false, unifiedWindows: { five_hour: { utilization: 0.89, resetsAt: 1791487800 } } } }),
    JSON.stringify({ type: "result", result: "ok" }),
  ].join("\n");
}

test("descoberta: lê os conectores carregados no início da execução (nomes reais dos prefixos)", () => {
  const saida = eventoInicio({
    servidores: [{ name: "claude.ai Supabase", status: "connected" }, { name: "claude.ai Vercel", status: "needs-auth" }, { name: "plugin:x:y", status: "failed" }],
    ferramentas: ["mcp__claude_ai_Supabase__execute_sql", "mcp__claude_ai_Supabase__list_tables", "mcp__claude_ai_Supabase__apply_migration", "mcp__plugin_x_y__z"],
  });
  const r = L.analisarInicio(saida, CFG_REAL.conectores);
  assert.deepEqual(r.conectores.supabase.prefixos, ["mcp__claude_ai_Supabase__"]);
  assert.deepEqual([r.conectores.supabase.ferramentas, r.conectores.supabase.leitura], [3, 2]);
  assert.deepEqual(r.conectores.vercel, { servidores: [{ nome: "claude.ai Vercel", status: "needs-auth" }], prefixos: [], ferramentas: 0, leitura: 0 });
  assert.equal(L.analisarInicio("sem json nenhum", CFG_REAL.conectores), null);
  assert.deepEqual(L.partesFerramentaMcp("mcp__plugin_pdf-viewer_pdf__list_pdfs"), { prefixo: "mcp__plugin_pdf-viewer_pdf__", servidor: "plugin_pdf-viewer_pdf", ferramenta: "list_pdfs" });
});

test("preparar: confere os conectores com um claude -p curto e grava os prefixos para o runner", async () => {
  const { verificar } = await import("../preparar.mjs");
  const amb = montarAmbiente();
  const cfg = { ...amb.cfg, conectores: CFG_REAL.conectores };
  const sondas = [];
  const executar = (a, args) => {
    if (args[0] === "rev-parse") return { ok: true, saida: amb.raiz };
    if (args[0] === "branch") return { ok: true, saida: "hefisto/noite-x" };
    if (args[0] === "--version") return { ok: true, saida: "2.1.294 (Claude Code)" };
    if (args[0] === "-p") {
      sondas.push(args);
      return { ok: true, saida: eventoInicio({ servidores: [{ name: "claude.ai Supabase", status: "connected" }, { name: "claude.ai Vercel", status: "needs-auth" }], ferramentas: ["mcp__claude_ai_Supabase__execute_sql"] }) };
    }
    return { ok: true, saida: "" };
  };
  const itens = verificar(amb.raiz, cfg, { executar });
  assert.equal(sondas.length, 1);
  assert.ok(sondas[0].includes("haiku") && sondas[0].includes("dontAsk") && sondas[0].includes("stream-json"), "sonda barata e sem ferramentas liberadas");
  const supa = itens.find((i) => i.nome === "Conector Supabase");
  assert.ok(supa.ok && !supa.aviso);
  assert.match(supa.detalhe, /mcp__claude_ai_Supabase__/);
  const vercel = itens.find((i) => i.nome === "Conector Vercel");
  assert.ok(vercel.aviso && /autorizar/.test(vercel.detalhe) && /\/mcp/.test(vercel.comoResolver));
  assert.ok(itens.filter((i) => i.nome.startsWith("Conector")).every((i) => i.ok), "conector ausente é aviso, não bloqueia a noite");
  const desc = JSON.parse(readFileSync(join(amb.raiz, ".estado", "conectores.json"), "utf8"));
  assert.deepEqual(desc.prefixos, { supabase: ["mcp__claude_ai_Supabase__"], vercel: [] });

  assert.match(itens.find((i) => i.nome === "Cobrança").detalhe, /plano do claude\.ai/);
  assert.match(itens.find((i) => i.nome === "Limite do plano").detalhe, /89% usado/);
  assert.match(itens.find((i) => i.nome === "Uso extra pago").detalhe, /desligado/);
  const apiLogin = verificar(amb.raiz, cfg, { executar: (a, args) => (args[0] === "auth" ? { ok: true, saida: '{"loggedIn": true, "authMethod": "api_key"}' } : executar(a, args)) });
  assert.equal(apiLogin.find((i) => i.nome === "Cobrança" && !i.ok)?.ok, false, "login pago (Console) = FALTA");

  // chave paga = FALTA; uso extra ligado = AVISO com onde desligar
  const pago = verificar(amb.raiz, cfg, { executar: (a, args) => (args[0] === "-p" ? { ok: true, saida: eventoInicio({ fonte: "ANTHROPIC_API_KEY", extra: "allowed" }) } : executar(a, args)) });
  assert.equal(pago.find((i) => i.nome === "Cobrança").ok, false);
  assert.match(pago.find((i) => i.nome === "Cobrança").comoResolver, /\/login/);
  const extra = pago.find((i) => i.nome === "Uso extra pago");
  assert.ok(extra.aviso && /para sozinho em 97%/.test(extra.detalhe) && /Configurações/.test(extra.comoResolver));

  sondas.length = 0;
  verificar(amb.raiz, cfg, { executar, sondarConectores: false });
  assert.equal(sondas.length, 0, "--sem-conectores pula a sonda");
});

test("runner: passa ao motor o --settings com as regras dos conectores e o gancho da guarda", async () => {
  const amb = montarAmbiente({ missoes: { "HDEV-001": { prioridade: 1 } } });
  const cfg = { ...amb.cfg, conectores: CFG_REAL.conectores };
  writeFileSync(amb.arqCfg, JSON.stringify(cfg));
  mkdirSync(join(amb.raiz, ".estado"), { recursive: true });
  writeFileSync(join(amb.raiz, ".estado", "conectores.json"), JSON.stringify({ verificadoEm: "2026-10-08T20:00:00Z", prefixos: { supabase: ["mcp__claude_ai_supabase__"] } }));

  const dry = await rodar(opcoes(amb, { dryRun: true }));
  assert.match(dry.conectores.resumo, /só leitura.*descoberta de 2026-10-08T20:00/);
  assert.ok(!existsSync(join(amb.raiz, ".estado", "motor-settings.json")), "dry-run não grava nada");

  await rodar(opcoes(amb, { uma: true }));
  const { argv, guardaLog } = JSON.parse(readFileSync(join(amb.raiz, "argv-motor.json"), "utf8"));
  const arq = argv[argv.indexOf("--settings") + 1];
  assert.equal(arq, join(amb.raiz, ".estado", "motor-settings.json"));
  const s = JSON.parse(readFileSync(arq, "utf8"));
  assert.ok(s.permissions.allow.includes("mcp__claude_ai_supabase__list_tables"), "prefixo descoberto também liberado");
  assert.ok(s.permissions.deny.includes("mcp__claude_ai_Supabase__apply_migration"));
  assert.ok(!s.permissions.allow.some((r) => r.endsWith("execute_sql")));
  assert.ok(new RegExp(s.hooks.PreToolUse[0].matcher).test("mcp__claude_ai_supabase__execute_sql"));
  assert.match(s.hooks.PreToolUse[0].hooks[0].command, /^node ".*guarda-sql\.mjs" ".*config\.json"$/);
  assert.equal(guardaLog, join(amb.raiz, ".estado", "logs", "guarda-sql.log"));
});

// ─── 24 horas por dia ────────────────────────────────────────────────────────
test("contínuo: faz as missões, espera quando não há READY (AGUARDANDO no status) e para com STOP", async () => {
  const amb = montarAmbiente();
  const esperas = [];
  const esperar = async (ms) => {
    esperas.push(ms);
    const st = L.lerStatus(join(amb.raiz, ".estado", "status.json"));
    assert.equal(st.estado, "AGUARDANDO");
    assert.equal(L.diagnostico(st, { vivo: () => true }).estado, "AGUARDANDO");
    if (esperas.length === 2) writeFileSync(join(amb.raiz, ".estado", "STOP"), "x");
  };
  const r = await rodar(opcoes(amb, { continuo: true, esperar }));
  assert.deepEqual(r.missoes, ["HDEV-001", "HDEV-002"]);
  assert.equal(r.motivoFim, "stop");
  assert.equal(esperas.length, 2, "espera em passos (heartbeat) até o STOP");
  assert.ok(esperas.every((ms) => ms <= 60000));
  assert.match(readFileSync(join(amb.raiz, "brain", "STATUS.md"), "utf8"), /Estado: \*\*ENCERRADO\*\*/);
});

test("teto de gasto do dia: uma execução para; o contínuo espera o dia virar", async () => {
  const amb = montarAmbiente({ missoes: { "HDEV-001": { prioridade: 1 }, "HDEV-002": {}, "HDEV-003": {} } });
  writeFileSync(amb.arqCfg, JSON.stringify({ ...amb.cfg, limites: { ...amb.cfg.limites, maxCustoPorDiaUsd: 0.015 } }));
  const r = await rodar(opcoes(amb));
  assert.deepEqual([r.missoes, r.motivoFim], [["HDEV-001", "HDEV-002"], "limite_custo"]);
  assert.match(readFileSync(r.relatorio, "utf8"), /teto de gasto do dia atingido \(US\$ 0\.02 de 0\.015\)/);
  assert.equal(L.lerStatus(join(amb.raiz, ".estado", "status.json")).custo_hoje_usd, 0.02);

  const amb2 = montarAmbiente({ missoes: { "HDEV-001": { prioridade: 1 }, "HDEV-002": {}, "HDEV-003": {} } });
  writeFileSync(amb2.arqCfg, JSON.stringify({ ...amb2.cfg, limites: { ...amb2.cfg.limites, maxCustoPorDiaUsd: 0.015 } }));
  let motivo = null;
  const r2 = await rodar(opcoes(amb2, { continuo: true, esperar: async () => { motivo = L.lerStatus(join(amb2.raiz, ".estado", "status.json")).last_result; writeFileSync(join(amb2.raiz, ".estado", "STOP"), "x"); } }));
  assert.equal(r2.motivoFim, "stop");
  assert.match(motivo, /teto de gasto.*volta amanhã/);
});

test("limite de uso do Claude não conta como falha: a missão volta para READY sem tentativa", async () => {
  const amb = montarAmbiente({ motor: "limite", missoes: { "HDEV-001": { prioridade: 1 } } });
  const r = await rodar(opcoes(amb, { uma: true }));
  assert.equal(r.motivoFim, "limite_uso");
  const m = L.carregarMissoes(amb.dirM)[0];
  assert.deepEqual([m.status, m.tentativas || 0, m.mesma_falha || 0], ["READY", 0, 0]);
  assert.match(m.corpo, /não contou: limite de uso do Claude/);

  const amb2 = montarAmbiente({ motor: "limite", missoes: { "HDEV-001": { prioridade: 1 } } });
  const esperas = [];
  const r2 = await rodar(opcoes(amb2, { continuo: true, esperar: async (ms) => { esperas.push(ms); if (esperas.length >= 3) writeFileSync(join(amb2.raiz, ".estado", "STOP"), "x"); } }));
  assert.equal(r2.motivoFim, "stop");
  assert.equal(L.carregarMissoes(amb2.dirM)[0].status, "READY", "nunca bloqueia por limite de uso");
  assert.ok(L.ehLimiteDeUso("You've hit your limit · resets 3pm"));
  assert.ok(!L.ehLimiteDeUso("not ok 1 - teste de rate limiter da API"), "texto comum não é limite de uso");
});

// ─── só o plano: nunca dinheiro a mais ───────────────────────────────────────
test("cobrança: chave paga, uso extra e perto do limite com extra ligado param o motor; plano normal segue", () => {
  assert.deepEqual(Object.keys(L.ambienteDoMotor({ ANTHROPIC_API_KEY: "x", ANTHROPIC_AUTH_TOKEN: "y", CLAUDE_CODE_USE_BEDROCK: "1", PATH: "p", ANTHROPIC_BASE_URL: "u" })), ["PATH", "ANTHROPIC_BASE_URL"]);
  assert.ok(L.vigiarCobranca({ type: "system", subtype: "init", apiKeySource: "ANTHROPIC_API_KEY" }).fatal);
  assert.equal(L.vigiarCobranca({ type: "system", subtype: "init", apiKeySource: "none" }), null);
  const ev = (info) => ({ type: "rate_limit_event", rate_limit_info: info });
  const volta = 1791487800;
  // como veio do Claude Code real (08/10): plano em 89%, uso extra recusado
  const real = L.vigiarCobranca(ev({ status: "allowed", resetsAt: volta, rateLimitType: "five_hour", overageStatus: "rejected", overageDisabledReason: "out_of_credits", isUsingOverage: false, unifiedWindows: { five_hour: { utilization: 0.89, resetsAt: volta }, seven_day: { utilization: 0.75, resetsAt: 1791597600 } } }));
  assert.equal(real.parar, undefined);
  assert.deepEqual([real.limite.uso, real.limite.janela, real.limite.extraLigado], [0.89, "five_hour", false]);
  assert.match(L.vigiarCobranca(ev({ isUsingOverage: true, resetsAt: volta })).parar, /uso extra pago/);
  assert.match(L.vigiarCobranca(ev({ status: "rejected", overageStatus: "rejected", resetsAt: volta })).parar, /limite do plano/);
  const perto = L.vigiarCobranca(ev({ status: "allowed_warning", overageStatus: "allowed", unifiedWindows: { five_hour: { utilization: 0.98, resetsAt: volta } } }));
  assert.match(perto.parar, /parou antes de cobrar/);
  assert.equal(perto.ate, volta * 1000);
  assert.equal(L.vigiarCobranca(ev({ status: "allowed_warning", overageStatus: "rejected", unifiedWindows: { five_hour: { utilization: 0.99, resetsAt: volta } } })).parar, undefined, "sem uso extra, gasta o plano até o fim");
  // evento real sem overageStatus (08/10, 96%): vale o último estado conhecido; sem nenhum, para por segurança
  const semInfo = { status: "allowed_warning", resetsAt: volta, rateLimitType: "five_hour", utilization: 0.98, isUsingOverage: false, surpassedThreshold: 0.9, unifiedWindows: { five_hour: { utilization: 0.98, resetsAt: volta } } };
  assert.equal(L.vigiarCobranca(ev(semInfo), { extraConhecido: false }).parar, undefined);
  assert.match(L.vigiarCobranca(ev(semInfo)).parar, /pode estar ligado/);
  assert.match(L.vigiarCobranca(ev({ status: "rejected", errorCode: "credits_required", resetsAt: volta })).parar, /limite do plano/);
  assert.ok(!L.fontePaga("none") && !L.fontePaga("oauth"));
  for (const f of ["ANTHROPIC_API_KEY", "apiKeyHelper", "/login managed key", "algo-novo"]) assert.ok(L.fontePaga(f), f);
  assert.equal(L.loginPago('{"loggedIn": true, "authMethod": "oauth_token"}'), false);
  assert.equal(L.loginPago('{"loggedIn": true, "authMethod": "claude.ai"}'), false);
  assert.equal(L.loginPago('{"loggedIn": true, "authMethod": "api_key"}'), "api_key");
  for (const t of ["You've hit your session limit · resets 3:45pm", "You've hit your weekly limit · resets Mon 12:00am", "Usage limit reached · limit resets 3:45pm"]) assert.ok(L.ehLimiteDeUso(t), t);
});

test("runner: tira a chave de API do motor; uso extra mata o motor na hora e espera o plano voltar", async () => {
  const antes = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "chave-falsa-do-teste";
  process.env.VOLTA_EM = String(Math.floor(Date.now() / 1000) + 3600);
  try {
    const amb = montarAmbiente({ motor: "extra", missoes: { "HDEV-001": { prioridade: 1 } } });
    const t0 = Date.now();
    const esperas = [];
    const r = await rodar(opcoes(amb, { continuo: true, esperar: async () => { esperas.push(L.lerStatus(join(amb.raiz, ".estado", "status.json")).last_result); writeFileSync(join(amb.raiz, ".estado", "STOP"), "x"); } }));
    assert.ok(Date.now() - t0 < 15000, "matou o motor sem esperar ele terminar");
    assert.equal(r.motivoFim, "stop");
    assert.equal(JSON.parse(readFileSync(join(amb.raiz, "argv-motor.json"), "utf8")).chaveApi, false, "o motor nunca recebe a chave de API");
    const m = L.carregarMissoes(amb.dirM)[0];
    assert.deepEqual([m.status, m.tentativas || 0], ["READY", 0]);
    assert.match(m.corpo, /não contou: o Claude começou a usar uso extra pago/);
    assert.match(esperas[0], /limite do plano; volta às/);
    const st = L.lerStatus(join(amb.raiz, ".estado", "status.json"));
    assert.equal(Date.parse(st.plano_volta_em), Number(process.env.VOLTA_EM) * 1000);
    assert.equal(st.plano.usandoExtra, true);
    assert.match(readFileSync(r.relatorio, "utf8"), /sem pagar a mais/);

    const paga = montarAmbiente({ motor: "paga", missoes: { "HDEV-001": { prioridade: 1 } } });
    const r2 = await rodar(opcoes(paga, { continuo: true, esperar: async () => assert.fail("cobrança paga não espera: para") }));
    assert.equal(r2.motivoFim, "cobranca_paga");
    assert.equal(L.carregarMissoes(paga.dirM)[0].status, "READY");
    assert.match(readFileSync(r2.relatorio, "utf8"), /não roda pago/);
  } finally {
    if (antes === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = antes;
    delete process.env.VOLTA_EM;
  }
});

// ─── sincronia com o GitHub (git de verdade, remoto local) ──────────────────
function gitEm(dir, ...args) {
  const r = spawnSync("git", args, { cwd: dir, encoding: "utf8", env: { ...process.env, GIT_EDITOR: "true" } });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}
function repoComRemoto(amb) {
  const remoto = mkdtempSync(join(tmpdir(), "hefisto-remoto-"));
  gitEm(remoto, "init", "-q", "--bare", "-b", "hefisto/teste");
  gitEm(amb.raiz, "init", "-q", "-b", "hefisto/teste");
  // core.autocrlf=true (padrão do Git no Windows) troca \n por \r\n no checkout e quebra a comparação do conteúdo
  for (const d of [amb.raiz]) { gitEm(d, "config", "user.name", "Agente"); gitEm(d, "config", "user.email", "agente@teste"); gitEm(d, "config", "core.autocrlf", "false"); }
  writeFileSync(join(amb.raiz, "x.txt"), "base\n");
  gitEm(amb.raiz, "add", "-A");
  gitEm(amb.raiz, "commit", "-q", "-m", "inicio");
  gitEm(amb.raiz, "remote", "add", "origin", remoto);
  gitEm(amb.raiz, "push", "-q", "-u", "origin", "hefisto/teste");
  const outro = mkdtempSync(join(tmpdir(), "hefisto-outro-"));
  gitEm(outro, "clone", "-q", "-c", "core.autocrlf=false", "-b", "hefisto/teste", remoto, ".");
  gitEm(outro, "config", "user.name", "Nuvem"); gitEm(outro, "config", "user.email", "nuvem@teste");
  return { remoto, outro };
}

test("sincronia: traz o que chegou no GitHub antes da missão e envia o trabalho depois, sem abrir editor", async () => {
  const amb = montarAmbiente({ missoes: { "HDEV-001": { prioridade: 1 } } });
  writeFileSync(amb.arqCfg, JSON.stringify({ ...amb.cfg, commitarMemoria: true }));
  writeFileSync(join(amb.raiz, ".gitignore"), ".estado/\nargv-motor.json\n");
  const { remoto, outro } = repoComRemoto(amb);
  // commit local que ainda não subiu (o caso do dono) + commit novo no GitHub (outra sessão)
  writeFileSync(join(amb.raiz, "local.txt"), "do computador\n");
  gitEm(amb.raiz, "add", "local.txt"); gitEm(amb.raiz, "commit", "-q", "-m", "trabalho local");
  writeFileSync(join(outro, "da-nuvem.txt"), "da nuvem\n");
  gitEm(outro, "add", "da-nuvem.txt"); gitEm(outro, "commit", "-q", "-m", "da nuvem"); gitEm(outro, "push", "-q");

  await rodar(opcoes(amb, { uma: true }));
  assert.ok(existsSync(join(amb.raiz, "da-nuvem.txt")), "trouxe o commit da nuvem (merge sem editor)");
  const noRemoto = spawnSync("git", ["log", "--format=%s", "hefisto/teste"], { cwd: remoto, encoding: "utf8" }).stdout;
  assert.match(noRemoto, /trabalho local/);
  assert.match(noRemoto, /chore\(brain\): HDEV-001 rodada 1 → DONE/);
  assert.match(noRemoto, /da nuvem/);
});

test("sincronia: conflito não trava a noite; desfaz o merge, registra e segue", async () => {
  const amb = montarAmbiente({ missoes: { "HDEV-001": { prioridade: 1 } } });
  writeFileSync(amb.arqCfg, JSON.stringify({ ...amb.cfg, commitarMemoria: true }));
  writeFileSync(join(amb.raiz, ".gitignore"), ".estado/\nargv-motor.json\n");
  const { outro } = repoComRemoto(amb);
  writeFileSync(join(amb.raiz, "x.txt"), "versão do computador\n");
  gitEm(amb.raiz, "commit", "-q", "-am", "local muda x");
  writeFileSync(join(outro, "x.txt"), "versão da nuvem\n");
  gitEm(outro, "commit", "-q", "-am", "nuvem muda x"); gitEm(outro, "push", "-q");

  const r = await rodar(opcoes(amb, { uma: true }));
  assert.equal(L.carregarMissoes(amb.dirM)[0].status, "DONE", "a missão seguiu");
  assert.equal(readFileSync(join(amb.raiz, "x.txt"), "utf8"), "versão do computador\n");
  assert.equal(spawnSync("git", ["status", "--porcelain", "x.txt"], { cwd: amb.raiz, encoding: "utf8" }).stdout, "", "sem merge pela metade");
  assert.match(readFileSync(r.relatorio, "utf8"), /conflito ao trazer origin\/hefisto\/teste/);
});
