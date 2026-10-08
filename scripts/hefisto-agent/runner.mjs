#!/usr/bin/env node
// RUNNER do agente autônomo do Héfisto: `npm run hefisto:agent`.
//
// Ciclo (repete enquanto houver missão READY e os limites deixarem):
//   1. escolhe a missão READY de maior prioridade (dependências DONE, sem bloqueador);
//   2. marca IN_PROGRESS, grava heartbeat;
//   3. roda o motor (Claude Code em modo headless, `claude -p`) com o prompt da missão;
//   4. roda as validações (testes; build se o app mudou);
//   5. decide o novo estado (DONE / READY / BLOCKED) com as travas anti-loop;
//   6. atualiza índice de missões, STATUS_ATUAL, relatório noturno e commita a memória.
//
// Opções:
//   --raiz <dir>        raiz do repositório (padrão: diretório atual)
//   --config <arq>      outra configuração (padrão: scripts/hefisto-agent/config.json)
//   --dry-run           só mostra a missão escolhida e o prompt; não muda nada
//   --uma               no máximo uma missão nesta execução
// Parar com segurança: `npm run hefisto:parar` (cria .hefisto-agent/STOP).
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join, relative, resolve, dirname } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as L from "./lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));

function argumentos(argv) {
  const o = { raiz: process.cwd(), config: join(AQUI, "config.json"), dryRun: false, uma: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--raiz") o.raiz = resolve(argv[++i]);
    else if (a === "--config") o.config = resolve(argv[++i]);
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--uma") o.uma = true;
    else throw new Error(`opção desconhecida: ${a}`);
  }
  return o;
}

const git = (raiz, ...args) => {
  const r = spawnSync("git", args, { cwd: raiz, encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
};

function executar(comando, { cwd, timeoutMin = 10 }) {
  const r = spawnSync(comando, { cwd, shell: true, encoding: "utf8", timeout: timeoutMin * 60000, maxBuffer: 64 * 1024 * 1024 });
  const saida = `${r.stdout || ""}\n${r.stderr || ""}`;
  return { ok: r.status === 0, codigo: r.status ?? (r.signal ? `sinal ${r.signal}` : "?"), saida, fim: saida.trim().split("\n").slice(-12).join("\n") };
}

function montarPrompt(raiz, m, rodada, branch) {
  const modelo = readFileSync(join(AQUI, "prompt.md"), "utf8");
  const hist = m.corpo.split("## Histórico")[1]?.trim().split("\n").filter((l) => l.startsWith("- ")).slice(-5).join("\n");
  return modelo
    .replaceAll("{{ARQUIVO_MISSAO}}", relative(raiz, m.arquivo))
    .replaceAll("{{ID_MISSAO}}", m.id)
    .replaceAll("{{RODADA}}", String(rodada))
    .replaceAll("{{BRANCH}}", branch || "(sem git)")
    .replaceAll("{{HISTORICO}}", hist ? `Últimas rodadas desta missão:\n${hist}` : "Primeira rodada desta missão.");
}

/** Roda o motor com heartbeat; mata se passar do tempo. */
function rodarMotor(cfg, prompt, { cwd, env, aoBater, timeoutMin }) {
  return new Promise((resolver) => {
    const args = [...cfg.motor.args];
    if (cfg.motor.allowedTools?.length) args.push("--allowedTools", ...cfg.motor.allowedTools);
    if (cfg.motor.disallowedTools?.length) args.push("--disallowedTools", ...cfg.motor.disallowedTools);
    let filho;
    try {
      filho = spawn(cfg.motor.comando, args, { cwd, env: { ...process.env, ...env }, stdio: ["pipe", "pipe", "pipe"] });
    } catch (e) {
      return resolver({ ok: false, codigo: "spawn", saida: String(e.message), texto: "" });
    }
    let saida = "";
    let erro = "";
    let morto = false;
    filho.stdout.on("data", (d) => { saida += d; });
    filho.stderr.on("data", (d) => { erro += d; });
    const batida = setInterval(aoBater, Math.max(5, cfg.limites.heartbeatSegundos) * 1000);
    const limite = setTimeout(() => { morto = true; filho.kill("SIGTERM"); setTimeout(() => filho.kill("SIGKILL"), 10000); }, timeoutMin * 60000);
    rodarMotor.atual = filho;
    filho.on("error", (e) => { erro += String(e.message); });
    filho.on("close", (codigo) => {
      clearInterval(batida); clearTimeout(limite); rodarMotor.atual = null;
      // --output-format json: um objeto com `result`; senão, texto puro
      let texto = saida;
      let custo = null;
      try { const j = JSON.parse(saida); texto = String(j.result ?? ""); custo = j.total_cost_usd ?? null; } catch { /* texto puro */ }
      resolver({ ok: codigo === 0 && !morto, codigo: morto ? "timeout" : codigo, saida: `${saida}\n${erro}`, texto, custo });
    });
    filho.stdin.end(prompt);
  });
}

export async function rodar(opcoes) {
  const raiz = opcoes.raiz;
  const cfg = JSON.parse(readFileSync(opcoes.config, "utf8"));
  const C = Object.fromEntries(Object.entries(cfg.caminhos).map(([k, v]) => [k, join(raiz, v)]));
  const arqStatus = join(C.estado, "status.json");
  const arqStop = join(C.estado, "STOP");
  const arqLock = join(C.estado, "runner.lock");
  const arqLog = join(C.estado, "logs", "runner.log");
  const log = (s) => { L.registrarLog(arqLog, s); if (!opcoes.silencioso) console.log(s); };

  const missoes = L.carregarMissoes(C.missoes);
  for (const m of missoes) {
    const erros = L.validarMissao(m);
    if (erros.length) throw new Error(`${relative(raiz, m.arquivo)}: ${erros.join("; ")}`);
  }

  if (opcoes.dryRun) {
    const m = L.proximaMissao(missoes);
    if (!m) { log("dry-run: nenhuma missão READY sem bloqueio."); return { missoes: [], motivoFim: "sem_missao" }; }
    log(`dry-run: próxima missão ${m.id} — ${m.titulo}`);
    const prompt = montarPrompt(raiz, m, (m.tentativas || 0) + 1, git(raiz, "branch", "--show-current"));
    if (!opcoes.silencioso) console.log(`\n${prompt}`);
    return { missoes: [m.id], motivoFim: "dry_run", prompt };
  }

  // uma execução por vez
  mkdirSync(C.estado, { recursive: true });
  const lock = L.lerStatus(arqLock);
  if (lock && L.pidVivo(lock.pid) && lock.pid !== process.pid) throw new Error(`já existe um runner rodando (pid ${lock.pid}). Use npm run hefisto:status.`);
  writeFileSync(arqLock, JSON.stringify({ pid: process.pid, desde: new Date().toISOString() }));
  if (existsSync(arqStop)) { rmSync(arqLock, { force: true }); log("STOP presente: nada a fazer. Apague .hefisto-agent/STOP (ou rode npm run hefisto:agent -- depois de remover) para voltar."); return { missoes: [], motivoFim: "stop" }; }

  const inicio = new Date();
  const hoje = inicio.toISOString().slice(0, 10);
  const relatorio = L.garantirRelatorioNoturno(C.noturnos, hoje, inicio.toISOString());
  L.gravarStatus(arqStatus, { estado: "RODANDO", pid: process.pid, agent_started_at: inicio.toISOString(), current_mission: null, last_result: null });
  log(`runner iniciado (pid ${process.pid})`);

  let missaoAtual = null;
  const encerrar = (motivo) => {
    if (missaoAtual) {
      const m = L.lerMissao(missaoAtual);
      if (m.status === "IN_PROGRESS") { m.status = "READY"; m.corpo = L.anotarSecao(m.corpo, "Histórico", `${new Date().toISOString().slice(0, 16)} interrompida (${motivo}); volta para READY`); L.gravarMissao(m); }
    }
    rodarMotor.atual?.kill("SIGTERM");
    L.gravarStatus(arqStatus, { estado: "ENCERRADO", last_result: `interrompido: ${motivo}` });
    rmSync(arqLock, { force: true });
  };
  const sinal = (s) => { log(`recebido ${s}: encerrando com segurança`); encerrar(s); process.exit(130); };
  if (!opcoes.semSinais) { process.once("SIGINT", sinal); process.once("SIGTERM", sinal); }

  const feitas = [];
  let motivoFim = "sem_missao";
  try {
    for (;;) {
      if (existsSync(arqStop)) { motivoFim = "stop"; break; }
      if (feitas.length >= (opcoes.uma ? 1 : cfg.limites.maxMissoesPorExecucao)) { motivoFim = "limite_missoes"; break; }
      if ((Date.now() - inicio) / 3600000 >= cfg.limites.maxHoras) { motivoFim = "limite_horas"; break; }

      const todas = L.carregarMissoes(C.missoes);
      const m = L.proximaMissao(todas);
      if (!m) { motivoFim = "sem_missao"; break; }

      const rodada = (m.tentativas || 0) + 1;
      const branch = git(raiz, "branch", "--show-current");
      if (branch && cfg.branchesProibidas.includes(branch)) throw new Error(`o runner não trabalha no branch ${branch}. Crie um branch de trabalho (ex.: hefisto/noite-${hoje}).`);

      m.status = "IN_PROGRESS";
      m.atualizado_em = hoje;
      m.corpo = L.anotarSecao(m.corpo, "Histórico", `${new Date().toISOString().slice(0, 16)} rodada ${rodada} iniciada (branch ${branch || "–"})`);
      L.gravarMissao(m);
      missaoAtual = m.arquivo;
      const conteudoAntes = readFileSync(m.arquivo, "utf8");
      const headAntes = git(raiz, "rev-parse", "HEAD");
      const sujoAntes = git(raiz, "status", "--porcelain");
      L.gravarStatus(arqStatus, { estado: "RODANDO", current_mission: m.id, last_checkpoint: headAntes });
      log(`missão ${m.id} rodada ${rodada}: ${m.titulo}`);

      const t0 = Date.now();
      const motor = await rodarMotor(cfg, montarPrompt(raiz, m, rodada, branch), {
        cwd: raiz,
        env: { HEFISTO_MISSAO_ID: m.id, HEFISTO_MISSAO_ARQUIVO: m.arquivo, HEFISTO_AGENT: "1" },
        timeoutMin: cfg.limites.maxMinutosPorMissao,
        aoBater: () => L.gravarStatus(arqStatus, { estado: "RODANDO", current_mission: m.id }),
      });
      L.registrarLog(join(C.estado, "logs", `${hoje}-${m.id}.log`), `rodada ${rodada} motor=${motor.codigo}\n${motor.saida.slice(-20000)}`);
      const declarado = L.lerResultadoDoAgente(motor.texto);
      const depois = L.lerMissao(m.arquivo);
      const headDepois = git(raiz, "rev-parse", "HEAD");

      // validações (e build se o app mudou nesta rodada)
      const resultados = [];
      for (const v of cfg.validacoes) resultados.push({ nome: v.nome, comando: v.comando, ...executar(v.comando, { cwd: raiz, timeoutMin: v.timeoutMin }) });
      const mudou = headAntes && headDepois ? `${git(raiz, "diff", "--name-only", headAntes, headDepois) || ""}\n${git(raiz, "status", "--porcelain") || ""}` : "";
      if (cfg.build?.quando === "sempre" || (cfg.build?.quando === "se_app_mudou" && /(^|\s|\/)app\//m.test(mudou))) {
        resultados.push({ nome: "build", comando: cfg.build.comando, ...executar(cfg.build.comando, { cwd: raiz, timeoutMin: cfg.build.timeoutMin }) });
      }
      const falhou = !motor.ok ? { comando: `motor (${motor.codigo})`, fim: motor.saida.trim().split("\n").slice(-8).join("\n") } : resultados.find((r) => !r.ok);
      const falha = falhou ? { assinatura: L.assinaturaFalha(falhou.comando, falhou.fim), resumo: `${falhou.nome || falhou.comando}: ${falhou.fim.split("\n").pop()?.slice(0, 160) || "erro"}` } : null;

      const progresso = Boolean((headAntes && headDepois && headAntes !== headDepois) || readFileSync(m.arquivo, "utf8") !== conteudoAntes || (sujoAntes !== null && git(raiz, "status", "--porcelain") !== sujoAntes));
      const statusAgente = declarado?.status || (depois.status !== "IN_PROGRESS" ? depois.status : null);
      const { missao: decidida, motivo } = L.decidir(depois, { motorOk: motor.ok, validacoesOk: resultados.every((r) => r.ok), falha, progresso, statusAgente }, cfg.limites);

      const minutos = Math.round((Date.now() - t0) / 60000);
      const commits = headAntes && headDepois && headAntes !== headDepois ? (git(raiz, "log", "--format=%h %s", `${headAntes}..${headDepois}`) || "").split("\n").filter(Boolean) : [];
      decidida.atualizado_em = hoje;
      decidida.corpo = L.anotarSecao(decidida.corpo, "Histórico",
        `${new Date().toISOString().slice(0, 16)} rodada ${rodada} → ${decidida.status} (${motivo}); ${commits.length} commit(s); ${minutos} min${declarado?.resumo ? `; agente: ${declarado.resumo}` : ""}${motor.custo != null ? `; custo US$ ${Number(motor.custo).toFixed(2)}` : ""}`);
      L.gravarMissao(decidida);
      missaoAtual = null;

      // memória: índice, status, relatório
      const atualizadas = L.carregarMissoes(C.missoes);
      if (existsSync(C.ativas)) writeFileSync(C.ativas, L.atualizarTrechoGerado(readFileSync(C.ativas, "utf8"), L.indiceAtivas(atualizadas)));
      if (existsSync(C.backlog)) writeFileSync(C.backlog, L.atualizarTrechoGerado(readFileSync(C.backlog, "utf8"), L.indiceBacklog(atualizadas)));
      L.anotarRelatorio(relatorio, "Missões trabalhadas", `${m.id} rodada ${rodada} → **${decidida.status}** — ${motivo} (${minutos} min)`);
      L.anotarRelatorio(relatorio, "Testes", `${m.id}: ${resultados.map((r) => `${r.nome} ${r.ok ? "OK" : `FALHOU (${r.codigo})`}`).join(" · ")} — TESTADO LOCAL`);
      if (resultados.some((r) => r.nome === "build")) L.anotarRelatorio(relatorio, "Builds", `${m.id}: build ${resultados.find((r) => r.nome === "build").ok ? "OK" : "FALHOU"}`);
      for (const c of commits) L.anotarRelatorio(relatorio, "Commits", c);
      if (decidida.status === "BLOCKED") L.anotarRelatorio(relatorio, "Bloqueadores", `${m.id}: ${motivo}`);
      if (decidida.status === "DONE") L.anotarRelatorio(relatorio, "O que está pronto para uso", `${m.id} — ${m.titulo} (ver Evidências na missão)`);
      const ultimo = `${m.id} → ${decidida.status}: ${motivo}`;
      L.gravarStatus(arqStatus, { estado: "RODANDO", current_mission: null, last_checkpoint: headDepois, last_result: ultimo });
      if (existsSync(C.statusAtual)) writeFileSync(C.statusAtual, L.atualizarTrechoGerado(readFileSync(C.statusAtual, "utf8"), blocoStatus(L.lerStatus(arqStatus), atualizadas), "agente"));
      commitarMemoria(raiz, cfg, `chore(brain): ${m.id} rodada ${rodada} → ${decidida.status}`, log);
      log(ultimo);
      feitas.push(m.id);
    }
  } finally {
    const prox = L.proximaMissao(L.carregarMissoes(C.missoes));
    L.anotarRelatorio(relatorio, "Próxima missão", prox ? `${prox.id} — ${prox.titulo}` : `nenhuma READY (fim: ${motivoFim})`);
    L.fecharRelatorio(relatorio, new Date().toISOString());
    L.gravarStatus(arqStatus, { estado: "ENCERRADO", current_mission: null, last_result: `fim: ${motivoFim}; missões nesta execução: ${feitas.join(", ") || "nenhuma"}` });
    if (existsSync(C.statusAtual)) writeFileSync(C.statusAtual, L.atualizarTrechoGerado(readFileSync(C.statusAtual, "utf8"), blocoStatus(L.lerStatus(arqStatus), L.carregarMissoes(C.missoes)), "agente"));
    commitarMemoria(raiz, cfg, `chore(brain): fim da execução do agente (${motivoFim})`, log);
    rmSync(arqLock, { force: true });
    log(`runner encerrado: ${motivoFim}`);
  }
  return { missoes: feitas, motivoFim, relatorio };
}

function blocoStatus(s, missoes) {
  const prox = L.proximaMissao(missoes);
  return [
    "### Agente autônomo (gerado pelo runner)",
    `- Estado: **${s?.estado || "–"}** · início: ${s?.agent_started_at || "–"} · último heartbeat: ${s?.last_heartbeat || "–"}`,
    `- Missão atual: ${s?.current_mission || "nenhuma"} · último checkpoint: \`${(s?.last_checkpoint || "–").slice(0, 10)}\``,
    `- Último resultado: ${s?.last_result || "–"}`,
    `- Próxima missão READY: ${prox ? `[[${prox.id}]] — ${prox.titulo}` : "nenhuma"}`,
  ].join("\n");
}

function commitarMemoria(raiz, cfg, mensagem, log) {
  if (!cfg.commitarMemoria) return;
  const branch = git(raiz, "branch", "--show-current");
  if (!branch || cfg.branchesProibidas.includes(branch)) return;
  if (git(raiz, "add", "--", cfg.caminhos.cerebro) === null) return;
  const staged = spawnSync("git", ["diff", "--cached", "--quiet", "--", cfg.caminhos.cerebro], { cwd: raiz });
  if (staged.status === 0) return; // nada para commitar
  const r = spawnSync("git", ["commit", "-q", "-m", mensagem, "--", cfg.caminhos.cerebro], { cwd: raiz, encoding: "utf8" });
  if (r.status !== 0) log(`aviso: commit da memória falhou: ${(r.stderr || "").trim().split("\n").pop()}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  rodar(argumentos(process.argv.slice(2))).then((r) => process.exit(r.motivoFim === "erro" ? 1 : 0)).catch((e) => {
    console.error(`hefisto-agent: ${e.message}`);
    process.exit(1);
  });
}
