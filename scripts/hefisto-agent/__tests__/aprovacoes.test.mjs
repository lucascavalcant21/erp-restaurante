// APROVACOES_PENDENTES.md é o histórico das decisões do dono: gravar um pedido ou uma
// decisão não pode reescrever as seções que já existem (sub-listas, notas, campos à mão).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { pedirAprovacao, lerAprovacoes, decidirAprovacao, contarPendentes } from "../aprovacoes.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, "..", "..", "..");
const CFG_REAL = JSON.parse(readFileSync(join(AQUI, "..", "config.json"), "utf8"));
const AGORA = new Date("2026-10-17T12:00:00Z");

// o formato que o dono usa à mão (APR-011): campo com sub-lista, campo só com sub-lista,
// sub-sub-item, item solto com linha em branco, continuação recuada, campo e parágrafo que
// o leitor não conhece, status fora da lista e nota depois do contador
const HISTORICO = [
  "# Aprovações pendentes",
  "",
  "Status: PENDENTE → APROVADO / REJEITADO → EXECUTADO. Não apague seções: é o histórico.",
  "",
  "**Pendentes agora: 1** (APR-007: falta só o merge do PR #171)",
  "",
  "### APR-007 · EXECUTADO EM PARTE",
  "",
  "- **Missão:** Pedidos do iFood",
  "- **Ação:** (1) Aplicar IFOOD_2_PEDIDOS.sql. (2) Merge do PR.",
  "- **Status:** EXECUTADO EM PARTE",
  "- **Nota:** aplicada 14/10; produção no ar antes: `5dea452`",
  "  continuação recuada da nota",
  "- **Observação do dono:** campo que o leitor não conhece",
  "- **Chave:** migracao:db/integracoes/IFOOD_2_PEDIDOS.sql",
  "",
  "Parágrafo solto escrito à mão dentro da seção.",
  "",
  "### APR-011 · PENDENTE",
  "",
  "- **Missão:** S-25, S-26, S-28 e B-013 — rotas de API sem login",
  "- **Ação:** merge do PR SEC-API-1 (deploy de produção)",
  "  - vercel.json manda todo /api para o Next (menos auth/policy e o cron antigo);",
  "  - sessão obrigatória nas rotas de IA, OCR e hefisto;",
  "    - inclusive ia-*",
  "  - cron sem segredo padrão",
  "- **Ambiente:** vercel (produção)",
  "- **Risco:** HIGH",
  "- **Motivo:** hoje qualquer pessoa usa as chaves de IA sem login",
  "- **Impacto:**",
  "  - quem usa logado não muda;",
  "",
  "  - chamadas sem login passam a dar 401;",
  "  - Detalhes em docs/brain/07_RELATORIOS/SEC_API_1_ROTAS.md",
  "- **Rollback:** reverter o commit do PR",
  "- **Status:** PENDENTE",
  "- **Criado em:** 2026-10-14",
  "- **Chave:** deploy:vercel.json:sec-api-1",
  "",
].join("\n");

const SEC_API_1 = {
  missao: "S-25, S-26, S-28 e B-013 — rotas de API sem login", acao: "merge do PR SEC-API-1 (deploy de produção)",
  ambiente: "vercel (produção)", risco: "HIGH", motivo: "hoje qualquer pessoa usa as chaves de IA sem login", chave: "deploy:vercel.json:sec-api-1",
};

function arquivo(texto = HISTORICO) {
  const arq = join(mkdtempSync(join(tmpdir(), "hefisto-apr-")), "APROVACOES_PENDENTES.md");
  writeFileSync(arq, texto);
  return arq;
}

test("aprovações: pedir acrescenta a seção no fim e não muda as que existem (sub-listas byte a byte)", () => {
  const arq = arquivo();
  const r = pedirAprovacao(arq, { missao: "HDEV-NOVA", acao: "Aplicar X.sql", ambiente: "supabase (produção)", risco: "HIGH", motivo: "escrita em produção", chave: "migracao:X.sql" }, AGORA);
  assert.deepEqual([r.aprovacao.id, r.nova], ["APR-012", true]);
  const depois = readFileSync(arq, "utf8");
  const existente = HISTORICO.replace("**Pendentes agora: 1**", "**Pendentes agora: 2**");
  assert.equal(depois.slice(0, existente.length), existente, "o que já existia só muda no contador (a nota depois dele fica)");
  assert.equal(depois.slice(existente.length), [
    "",
    "### APR-012 · PENDENTE",
    "",
    "- **Missão:** HDEV-NOVA",
    "- **Ação:** Aplicar X.sql",
    "- **Ambiente:** supabase (produção)",
    "- **Risco:** HIGH",
    "- **Motivo:** escrita em produção",
    "- **Impacto:** –",
    "- **Rollback:** desconhecido",
    "- **Evidências:** –",
    "- **Comando/alteração:** `–`",
    "- **Status:** PENDENTE",
    "- **Criado em:** 2026-10-17 12:00",
    "- **Chave:** migracao:X.sql",
    "",
  ].join("\n"));
  assert.deepEqual(lerAprovacoes(arq).map((a) => [a.id, a.status]), [["APR-007", "EXECUTADO EM PARTE"], ["APR-011", "PENDENTE"], ["APR-012", "PENDENTE"]]);
  assert.equal(lerAprovacoes(arq)[1].acao, "merge do PR SEC-API-1 (deploy de produção)");
});

test("aprovações: pedir com a mesma chave troca só os campos que mudaram", () => {
  const arq = arquivo();
  // mesmos valores + um campo novo: a sub-lista da Ação fica; Evidências entra na ordem do dono
  const r = pedirAprovacao(arq, { ...SEC_API_1, evidencias: "25 testes da SEC-API-1" }, AGORA);
  assert.deepEqual([r.aprovacao.id, r.nova, r.aprovacao.evidencias], ["APR-011", false, "25 testes da SEC-API-1"]);
  const comEvidencias = HISTORICO.replace("- **Rollback:** reverter o commit do PR\n", "- **Rollback:** reverter o commit do PR\n- **Evidências:** 25 testes da SEC-API-1\n");
  assert.equal(readFileSync(arq, "utf8"), comEvidencias);

  // valor novo num campo: troca o campo inteiro (com a sub-lista dele); o resto não muda
  pedirAprovacao(arq, { ...SEC_API_1, impacto: "sem login: 401" }, AGORA);
  const impactoAntigo = HISTORICO.slice(HISTORICO.indexOf("- **Impacto:**\n"), HISTORICO.indexOf("- **Rollback:**"));
  assert.equal(readFileSync(arq, "utf8"), comEvidencias.replace(impactoAntigo, "- **Impacto:** sem login: 401\n"));
  assert.equal(contarPendentes(arq), 1);
});

test("aprovações: decidir troca só o título, o status e as linhas da decisão", () => {
  const arq = arquivo();
  const a = decidirAprovacao(arq, "APR-011", "APROVADO", { por: "lucas", nota: "pode publicar", agora: AGORA, env: {} });
  assert.equal(a.status, "APROVADO");
  const esperado = HISTORICO
    .replace("**Pendentes agora: 1**", "**Pendentes agora: 0**")
    .replace("### APR-011 · PENDENTE", "### APR-011 · APROVADO")
    .replace("- **Status:** PENDENTE\n- **Criado em:** 2026-10-14\n", "- **Status:** APROVADO\n- **Criado em:** 2026-10-14\n- **Decidido em:** 2026-10-17 12:00\n- **Decidido por:** lucas\n- **Nota:** pode publicar\n");
  assert.equal(readFileSync(arq, "utf8"), esperado);

  decidirAprovacao(arq, "APR-011", "EXECUTADO", { por: "lucas", agora: new Date("2026-10-17T15:30:00Z"), env: {} });
  assert.equal(readFileSync(arq, "utf8"), esperado
    .replace("### APR-011 · APROVADO", "### APR-011 · EXECUTADO")
    .replace("- **Status:** APROVADO", "- **Status:** EXECUTADO")
    .replace("- **Decidido em:** 2026-10-17 12:00", "- **Decidido em:** 2026-10-17 15:30"), "sem nota nova: a nota da aprovação fica");
});

test("aprovações: arquivo com CRLF continua CRLF e intacto", () => {
  const crlf = HISTORICO.replaceAll("\n", "\r\n");
  const arq = arquivo(crlf);
  pedirAprovacao(arq, { missao: "HDEV-NOVA", acao: "y", ambiente: "production", risco: "HIGH", motivo: "z" }, AGORA);
  const depois = readFileSync(arq, "utf8");
  assert.ok(depois.startsWith(crlf.replace("**Pendentes agora: 1**", "**Pendentes agora: 2**")));
  assert.ok(!/[^\r]\n/.test(depois), "só CRLF");
  assert.equal(lerAprovacoes(arq).at(-1).id, "APR-012");
});

test("aprovações: `aprovacoes.mjs pedir` (a CLI) não muda nada do APROVACOES_PENDENTES.md real além do contador", () => {
  const real = readFileSync(join(RAIZ, CFG_REAL.caminhos.aprovacoes), "utf8");
  const cwd = mkdtempSync(join(tmpdir(), "hefisto-apr-cli-"));
  const arq = join(cwd, CFG_REAL.caminhos.aprovacoes);
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(arq, real);
  const r = spawnSync(process.execPath, [join(AQUI, "..", "aprovacoes.mjs"), "pedir", "--missao", "HDEV-TESTE", "--acao", "teste da CLI", "--ambiente", "preview", "--risco", "LOW", "--motivo", "round trip"], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  const depois = readFileSync(arq, "utf8");
  const pend = lerAprovacoes(arq).filter((a) => a.status === "PENDENTE").length;
  const existente = real.replace(/^(\*\*Pendentes agora: )\d+/m, `$1${pend}`);
  assert.equal(depois.slice(0, existente.length), existente);
  assert.match(depois.slice(existente.length), /^\n### APR-\d+ · PENDENTE\n\n- \*\*Missão:\*\* HDEV-TESTE\n[^#]*$/);
});
