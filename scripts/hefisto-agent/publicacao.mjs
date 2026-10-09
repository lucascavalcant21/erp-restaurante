// PUBLICAÇÃO NA RODADA do runner (HDEV-PUBLISH-001): liga a política aos três destinos.
//
//   preview   (push do branch → Vercel gera o preview): AUTO_SAFE envia; senão o push espera.
//   migração  (arquivo db/**/*.sql novo/mudado): classifica, ensaia e decide se pode ir ao banco
//             real. Escrever o arquivo não é aplicar: aplicar sempre passa por aqui.
//   produção  (missão DONE com código): decide; APPROVAL_REQUIRED vira pedido ao dono.
//
// Tudo fica registrado: .hefisto-agent/publicacoes.jsonl, o trecho gerado de
// docs/brain/06_OPERACAO/DEPLOYS.md e, quando é com o dono, APROVACOES_PENDENTES.md.
// O runner não tem ferramenta para aplicar migração nem promover produção: AUTO_SAFE nesses
// dois só registra que a política liberaria (o dono decide quando conceder a ferramenta).
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";
import * as P from "./politica.mjs";
import { pedirAprovacao, contarPendentes } from "./aprovacoes.mjs";
import { atualizarTrechoGerado, lerStatus } from "./lib.mjs";

const D = P.DECISOES;

/** Arquivos de `git diff --name-only` + `git status --porcelain` (rodar com core.quotepath=false para acentos). */
export function arquivosMudados(diff = "", porcelain = "") {
  const lista = [
    ...diff.split("\n").map((l) => l.trim()),
    ...porcelain.split("\n").filter((l) => l.trim()).map((l) => l.slice(3).split(" -> ").pop().trim()),
  ].map((f) => f.replace(/^"|"$/g, "")).filter(Boolean);
  return [...new Set(lista)];
}

export function urlPreview(modelo, branch) {
  if (!modelo || !branch) return null;
  const slug = branch.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return modelo.replaceAll("{branch}", slug);
}

const linhaTabela = (r) => `| ${r.timestamp.slice(0, 16).replace("T", " ")} | ${r.tipo} | ${r.missao || "–"} | \`${(r.commit_sha || "–").slice(0, 7)}\` | ${r.decisao} (${r.risco}) | testes ${r.test_status} · build ${r.build_status} | ${r.deploy_url || r.alvo || "–"} | ${r.aprovacao || "–"} |`;

function registrar(C, registro) {
  if (!C.estado) return;
  const arq = join(C.estado, "publicacoes.jsonl");
  mkdirSync(dirname(arq), { recursive: true });
  appendFileSync(arq, `${JSON.stringify(registro)}\n`);
  if (C.deploys && existsSync(C.deploys)) {
    const ultimos = readFileSync(arq, "utf8").trim().split("\n").slice(-15).map((l) => JSON.parse(l)).reverse();
    const bloco = [
      "### Registro automático de publicações (gerado pelo runner; últimas 15)",
      "",
      "| Quando (UTC) | Tipo | Missão | Commit | Decisão (risco) | Evidência local | URL / alvo | Aprovação |",
      "|---|---|---|---|---|---|---|---|",
      ...ultimos.map(linhaTabela),
    ].join("\n");
    writeFileSync(C.deploys, atualizarTrechoGerado(readFileSync(C.deploys, "utf8"), bloco, "publicacoes"));
  }
}

/** origin/main já está dentro do HEAD? true/false; undefined se não deu para saber (sem rede/remoto). */
function branchEmDiaComMain(raiz) {
  const g = (...a) => spawnSync("git", a, { cwd: raiz, encoding: "utf8", timeout: 60000, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } });
  g("fetch", "-q", "origin", "main");
  if (g("rev-parse", "--verify", "-q", "origin/main").status !== 0) return undefined;
  return g("merge-base", "--is-ancestor", "origin/main", "HEAD").status === 0;
}

/**
 * Avalia a rodada. `resultados`: validações do runner [{ nome, ok }] (o build tem nome "build").
 * Devolve { preview, migracoes, producao } com a decisão de cada destino.
 */
export async function avaliarRodada({ raiz, cfg, C, arquivos, resultados, branch, head, missao, missaoDone = false, conflito = false, agora = new Date(), emDiaComMain = branchEmDiaComMain }) {
  const pub = { ...P.PUBLICACAO_PADRAO, ...(cfg.publicacao || {}) };
  const testes = resultados.filter((r) => r.nome !== "build");
  const build = resultados.find((r) => r.nome === "build");
  const appMudou = arquivos.some((f) => f.startsWith("app/"));
  const test_status = testes.length ? (testes.every((r) => r.ok) ? "passed" : "failed") : "not_run";
  const build_status = build ? (build.ok ? "passed" : "failed") : appMudou ? "not_run" : "not_applicable";
  const segredos = build?.ok
    ? P.varrerSegredos(join(raiz, ".next", "static"), { valores: [process.env.SUPABASE_SERVICE_ROLE_KEY] })
    : { estado: appMudou ? "not_run" : "not_applicable", achados: [] };
  // isolamento entre empresas: a suíte da inteligência tem os casos (LOCAL); o smoke do preview, o real
  const smoke = C.estado ? lerStatus(join(C.estado, "preview.json")) : null;
  const smokeDesteCommit = smoke && head && smoke.commit_sha === head;
  const suiteIsolamento = testes.find((r) => /intelligence/i.test(r.nome));
  const tenantIsolation = smokeDesteCommit && smoke.critico ? "failed" : suiteIsolamento?.ok ? "ok" : "unknown";
  const areas = P.areasDosArquivos(arquivos);
  const base = { tests: test_status, build: build_status, secretsCheck: segredos.estado === "exposed" ? "exposed" : segredos.estado, tenantIsolation, conflicts: Boolean(conflito), affectedAreas: areas };

  // ── migrações ──
  const migracoes = [];
  for (const arquivo of arquivos.filter((f) => /^db\/.*\.sql$/i.test(f) && existsSync(join(raiz, f)))) {
    const sql = readFileSync(join(raiz, arquivo), "utf8");
    const ensaio = await P.ensaiarMigracao(sql);
    const irma = P.rollbackIrmao(basename(arquivo), readdirSync(join(raiz, dirname(arquivo))));
    const rollback = ensaio.rollback || Boolean(irma);
    const decisao = P.avaliarPolitica({
      ...base, changeType: "migration", environment: "supabase", migrationType: ensaio.classe, rollbackAvailable: rollback,
      securityChecks: { rls: ensaio.rlsInseguro ? "insecure" : "ok" },
    }, pub);
    const item = { arquivo, classe: ensaio.classe, rollback, ensaio, decisao, aprovacao: null };
    if (decisao.decision === D.APROVACAO && C.aprovacoes) {
      const r = pedirAprovacao(C.aprovacoes, {
        missao: missao.id, acao: `Aplicar a migração ${arquivo} no Supabase real`, ambiente: "supabase (produção)", risco: decisao.riskLevel,
        motivo: decisao.reasons.join("; "),
        impacto: `tabelas: ${ensaio.tabelas.join(", ") || "–"}${ensaio.travas.length ? `; travas: ${ensaio.travas.join("; ")}` : ""}`,
        rollback: rollback ? `documentado (${ensaio.rollback ? "no próprio arquivo" : irma})` : "NÃO documentado",
        evidencias: `classe ${ensaio.classe}; ensaio: ${ensaio.ensaio}; sintaxe ${ensaio.sintaxe}; testes ${test_status}`,
        comando: `apply_migration ${arquivo} (commit ${(head || "").slice(0, 7)})`, chave: `migracao:${arquivo}`,
      }, agora);
      item.aprovacao = r.aprovacao.id;
    }
    registrar(C, {
      timestamp: agora.toISOString(), tipo: "migração", missao: missao.id, branch, commit_sha: head, deploy_url: null, alvo: arquivo,
      build_status, test_status, decisao: decisao.decision, risco: decisao.riskLevel, classe: ensaio.classe, motivos: decisao.reasons, aprovacao: item.aprovacao,
      executado: false, nota: decisao.decision === D.AUTO ? "política liberaria; o runner não aplica (sem ferramenta de escrita no banco)" : null,
    });
    migracoes.push(item);
  }
  const piorMigracao = migracoes.reduce((k, m) => (P.CLASSES_MIGRACAO.indexOf(m.classe) > P.CLASSES_MIGRACAO.indexOf(k) ? m.classe : k), migracoes.length ? "SAFE" : null);

  // ── preview (o push do branch) ──
  const rlsDoBranch = migracoes.some((m) => m.ensaio.rlsInseguro) ? "insecure" : "ok";
  const preview = {
    decisao: P.avaliarPolitica({ ...base, changeType: P.tipoDaMudanca(arquivos), environment: "preview", rollbackAvailable: true, securityChecks: { rls: rlsDoBranch } }, pub),
    deploy_url: urlPreview(pub.urlPreview, branch),
  };
  if (arquivos.length) {
    registrar(C, {
      timestamp: agora.toISOString(), tipo: "preview", missao: missao.id, branch, commit_sha: head, deploy_url: preview.deploy_url,
      build_status, test_status, decisao: preview.decisao.decision, risco: preview.decisao.riskLevel, motivos: preview.decisao.reasons, segredos: segredos.achados,
    });
  }

  // ── produção (só quando a missão fecha com código) ──
  let producao = null;
  const temCodigo = arquivos.some((f) => !/^docs\/|\.md$/i.test(f));
  if (missaoDone && temCodigo) {
    const decisao = P.avaliarPolitica({
      ...base, changeType: P.tipoDaMudanca(arquivos.filter((f) => !/^db\//.test(f))), environment: "production",
      rollbackAvailable: true, // Vercel: instant rollback para o deploy anterior (DEPLOYS.md)
      previewValidated: Boolean(smokeDesteCommit && smoke.ok && smoke.completo && !smoke.critico),
      branchUpToDate: emDiaComMain(raiz), securityChecks: { rls: rlsDoBranch },
    }, pub);
    producao = { decisao, aprovacao: null };
    if (decisao.decision === D.APROVACAO && C.aprovacoes) {
      const r = pedirAprovacao(C.aprovacoes, {
        missao: missao.id, acao: `Publicar o branch ${branch} em produção (merge na main)`, ambiente: "production (Vercel)", risco: decisao.riskLevel,
        motivo: decisao.reasons.join("; "), impacto: `áreas: ${areas.join(", ") || "–"}`,
        rollback: "Vercel instant rollback para o deploy de produção anterior (ver DEPLOYS.md)",
        evidencias: `testes ${test_status} · build ${build_status} · segredos ${segredos.estado} · preview ${smokeDesteCommit ? `smoke ${smoke.ok ? "OK" : "falhou"} em ${smoke.base_url}` : "NÃO VALIDADO neste commit"}`,
        comando: `gh pr merge (branch ${branch}, commit ${(head || "").slice(0, 7)})`, chave: `producao:${branch}`,
      }, agora);
      producao.aprovacao = r.aprovacao.id;
    }
    registrar(C, {
      timestamp: agora.toISOString(), tipo: "produção", missao: missao.id, branch, commit_sha: head, deploy_url: null, alvo: "main",
      build_status, test_status, decisao: decisao.decision, risco: decisao.riskLevel, motivos: decisao.reasons, aprovacao: producao.aprovacao, executado: false,
    });
  }

  return {
    preview, migracoes, producao, piorMigracao,
    pendentes: C.aprovacoes ? contarPendentes(C.aprovacoes) : 0,
    resumo: [
      `preview ${preview.decisao.decision} (${preview.decisao.riskLevel})`,
      ...migracoes.map((m) => `migração ${m.arquivo}: ${m.classe} → ${m.decisao.decision}${m.aprovacao ? ` [${m.aprovacao}]` : ""}`),
      producao ? `produção ${producao.decisao.decision} (${producao.decisao.riskLevel})${producao.aprovacao ? ` [${producao.aprovacao}]` : ""}` : null,
    ].filter(Boolean).join(" · "),
  };
}
