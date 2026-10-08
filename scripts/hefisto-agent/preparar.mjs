#!/usr/bin/env node
// PREPARAR: `npm run hefisto:preparar` — confere tudo antes de deixar o agente
// rodando (Windows, macOS ou Linux) e cria o branch da noite com a data,
// sem depender de sintaxe de terminal (o `$(date +%F)` não existe no CMD).
//   -- --sem-branch   não cria/troca de branch
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as L from "./lib.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));

function rodar(arquivo, args, cwd) {
  const p = L.prepararSpawn(arquivo, args);
  const r = spawnSync(p.arquivo, p.args, { cwd, encoding: "utf8", shell: p.shell, windowsHide: true, timeout: 60000 });
  return { ok: r.status === 0, saida: `${r.stdout || ""}${r.stderr || ""}`.trim() };
}

export function verificar(raiz, cfg, { criarBranch = true, hoje = new Date().toISOString().slice(0, 10), executar = rodar } = {}) {
  const itens = [];
  const add = (ok, nome, detalhe, comoResolver = "") => itens.push({ ok, nome, detalhe, comoResolver });

  const [maior] = process.versions.node.split(".").map(Number);
  add(maior >= 20, "Node.js", `v${process.versions.node}`, "Instale o Node.js 20 ou mais novo (nodejs.org).");

  const topo = executar("git", ["rev-parse", "--show-toplevel"], raiz);
  if (!topo.ok) {
    add(false, "Repositório git", "esta pasta não é o projeto", "Entre na pasta do projeto (cd erp-restaurante) ou clone: git clone https://github.com/lucascavalcant21/erp-restaurante.git");
    return itens;
  }
  add(true, "Repositório git", topo.saida.split("\n").pop());

  let branch = executar("git", ["branch", "--show-current"], raiz).saida;
  if (cfg.branchesProibidas.includes(branch)) {
    if (!criarBranch) add(false, "Branch de trabalho", `está em ${branch}`, "Troque para um branch de trabalho; o agente não trabalha na main.");
    else {
      const nome = `hefisto/noite-${hoje}`;
      const existe = executar("git", ["rev-parse", "--verify", "--quiet", nome], raiz).ok;
      const r = executar("git", existe ? ["checkout", nome] : ["checkout", "-b", nome], raiz);
      add(r.ok, "Branch de trabalho", r.ok ? `${existe ? "voltou para" : "criado"} ${nome} (a partir de ${branch})` : r.saida.split("\n").pop(), "Confira se há alterações não salvas: git status");
      if (r.ok) branch = nome;
    }
  } else add(true, "Branch de trabalho", branch);

  const temAgente = existsSync(join(raiz, "scripts", "hefisto-agent", "runner.mjs"));
  add(temAgente, "Código do agente neste branch", temAgente ? "scripts/hefisto-agent presente" : "ausente",
    "O agente ainda não está na main. Use o branch do PR: git fetch origin && git checkout claude/fervent-bell-t363k5 (depois rode este comando de novo).");

  add(existsSync(join(raiz, "node_modules")), "Dependências", existsSync(join(raiz, "node_modules")) ? "node_modules presente" : "faltam", "Rode: npm ci");

  const motor = L.comandoDoMotor(cfg);
  const claude = executar(motor, ["--version"], raiz);
  const ehClaudeCode = claude.ok && /Claude Code/i.test(claude.saida);
  add(ehClaudeCode, "Claude Code (motor)",
    ehClaudeCode ? claude.saida.split("\n")[0] : claude.ok ? `"${motor}" respondeu, mas não é o Claude Code (pode ser o app Claude Desktop)` : "não encontrado no PATH",
    claude.ok
      ? "Veja qual claude está no PATH (where.exe claude) e aponte o certo: set HEFISTO_AGENT_CLAUDE=%USERPROFILE%\\.local\\bin\\claude.exe"
      : "Instale o Claude Code (docs/autonomous/COMO_USAR.md, seção \"Instalar o Claude Code no Windows\") e abra um terminal novo.");
  if (ehClaudeCode) {
    const login = executar(motor, ["auth", "status"], raiz);
    add(login.ok, "Login no Claude Code", login.ok ? "logado" : "não logado", "Rode `claude` uma vez dentro da pasta do projeto e faça login no navegador.");
  }
  if (process.env.ANTHROPIC_API_KEY) {
    itens.push({ ok: true, aviso: true, nome: "Cobrança", detalhe: "ANTHROPIC_API_KEY está definida neste terminal: o agente vai cobrar na API, não na sua assinatura",
      comoResolver: "Se quiser usar a assinatura, remova a variável deste terminal (CMD: set ANTHROPIC_API_KEY=)." });
  }

  try {
    const missoes = L.carregarMissoes(join(raiz, cfg.caminhos.missoes));
    const erros = missoes.flatMap((m) => L.validarMissao(m));
    const prox = L.proximaMissao(missoes);
    add(!erros.length && !!prox, "Missões", erros.length ? erros.join("; ") : prox ? `próxima: ${prox.id} — ${prox.titulo}` : "nenhuma READY",
      erros.length ? "Corrija o frontmatter indicado." : "Libere uma missão: npm run hefisto:missoes -- pronta HDEV-00X");
  } catch (e) {
    add(false, "Missões", e.message, "Confira docs/brain/03_ROADMAP/missoes");
  }

  const stop = existsSync(join(raiz, cfg.caminhos.estado, "STOP"));
  add(!stop, "Pedido de parada", stop ? "STOP presente" : "nenhum", "Libere: npm run hefisto:parar -- --liberar");
  return itens;
}

if (process.argv[1] && process.argv[1].endsWith("preparar.mjs")) {
  const cfg = JSON.parse(readFileSync(join(AQUI, "config.json"), "utf8"));
  const itens = verificar(process.cwd(), cfg, { criarBranch: !process.argv.includes("--sem-branch") });
  for (const i of itens) {
    console.log(`${i.aviso ? "AVISO" : i.ok ? "OK  " : "FALTA"} ${i.nome}: ${i.detalhe}`);
    if ((!i.ok || i.aviso) && i.comoResolver) console.log(`      → ${i.comoResolver}`);
  }
  const ok = itens.every((i) => i.ok);
  console.log(ok ? "\nTudo pronto. Para a noite: npm run hefisto:noite   (ver antes: npm run hefisto:agent -- --dry-run)" : "\nResolva os itens FALTA e rode de novo: npm run hefisto:preparar");
  process.exit(ok ? 0 : 1);
}
