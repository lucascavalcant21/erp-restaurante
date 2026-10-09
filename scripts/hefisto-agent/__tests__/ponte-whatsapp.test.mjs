// HDEV-WA-001: a ponte do WhatsApp executa no PC com as mesmas funções dos comandos npm.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executar, bloqueadoresAbertos, textoAprovacoes } from "../ponte-whatsapp.mjs";
import { pedirAprovacao, lerAprovacoes } from "../aprovacoes.mjs";

function ambiente() {
  const raiz = mkdtempSync(join(tmpdir(), "ponte-wa-"));
  const cfg = { caminhos: { cerebro: "brain", missoes: "brain/missoes", estado: ".estado", aprovacoes: "brain/APROVACOES.md" }, limites: { travadoAposMinutos: 15 } };
  mkdirSync(join(raiz, "brain", "missoes"), { recursive: true });
  mkdirSync(join(raiz, "brain", "03_ROADMAP"), { recursive: true });
  writeFileSync(join(raiz, "brain", "APROVACOES.md"), "# Aprovações\n");
  return { raiz, cfg };
}

test("bloqueadores: só os abertos, um por ID (a última linha vale)", () => {
  const md = [
    "| ID | Bloqueia | O que falta | Quem resolve | Desde | Estado |", "|---|---|---|---|---|---|",
    "| BLQ-001 | [[HDEV-001]] | rede | Dono | 07/10 | PENDENTE |",
    "| BLQ-009 | fase 2 | APR-002 | Dono | 08/10 | PENDENTE |",
    "| BLQ-005 | RLS | APR-001 | Dono | 07/10 | RESOLVIDO 08/10 |",
    "| BLQ-009 | fase 2 | APR-002 | Dono | 08/10 | RESOLVIDO 09/10 |",
  ].join("\n");
  assert.deepEqual(bloqueadoresAbertos(md).map((b) => b.id), ["BLQ-001"]);
});

test("parar cria STOP; continuar remove e inicia o agente se não estiver rodando", () => {
  const { raiz, cfg } = ambiente();
  const r1 = executar({ comando: "parar" }, { raiz, cfg });
  assert.ok(r1.ok && existsSync(join(raiz, ".estado", "STOP")));
  let iniciado = 0;
  const r2 = executar({ comando: "continuar" }, { raiz, cfg, iniciarAgente: () => { iniciado++; return 4242; } });
  assert.ok(r2.ok && !existsSync(join(raiz, ".estado", "STOP")));
  assert.equal(iniciado, 1);
  assert.match(r2.resposta, /pid 4242/);
});

test("aprovar pelo WhatsApp muda o status, registra a origem e não executa nada", () => {
  const { raiz, cfg } = ambiente();
  const arq = join(raiz, "brain", "APROVACOES.md");
  pedirAprovacao(arq, { missao: "HDEV-WA-001", acao: "Aplicar WA_001_FILA.sql", ambiente: "supabase", risco: "MEDIUM", motivo: "fila", rollback: "WA_001_ROLLBACK.sql", chave: "migracao:wa" });
  assert.match(textoAprovacoes(lerAprovacoes(arq)), /APR-001\* \[PENDENTE\]/);
  const r = executar({ comando: "aprovar", args: { id: "APR-001", nota: "" } }, { raiz, cfg });
  assert.ok(r.ok, r.resposta);
  const a = lerAprovacoes(arq)[0];
  assert.equal(a.status, "APROVADO");
  assert.match(a.decidido_por, /WhatsApp/);
  assert.match(r.resposta, /não é executado sozinho/);
  assert.equal(executar({ comando: "aprovar", args: { id: "APR-001" } }, { raiz, cfg }).ok, false, "não aprova duas vezes");
  assert.equal(executar({ comando: "rejeitar", args: { id: "APR-099" } }, { raiz, cfg }).ok, false);
  assert.ok(readFileSync(arq, "utf8").includes("APROVADO"));
});

test("status, missões e comando desconhecido", () => {
  const { raiz, cfg } = ambiente();
  assert.match(executar({ comando: "status" }, { raiz, cfg }).resposta, /^\*Agente: /);
  assert.match(executar({ comando: "missoes" }, { raiz, cfg }).resposta, /^\*Missões\*/);
  assert.equal(executar({ comando: "bloqueadores" }, { raiz, cfg }).resposta, "Nenhum bloqueador aberto.");
  assert.equal(executar({ comando: "rm -rf" }, { raiz, cfg }).ok, false);
});
