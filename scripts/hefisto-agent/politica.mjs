#!/usr/bin/env node
// POLÍTICA DE PUBLICAÇÃO E BANCO do agente autônomo (HDEV-PUBLISH-001).
//
// Um só lugar decide se uma alteração pode seguir sozinha:
//   avaliarPolitica(entrada) → { riskLevel, decision, reasons, requiredChecks, approvalRequired }
//   decision: AUTO_SAFE (segue) · APPROVAL_REQUIRED (pede ao dono e para só essa etapa) · BLOCKED (falta evidência ou algo falhou)
//
// Regras fixas (nenhuma configuração desliga):
//   - teste/build falhou, isolamento entre empresas falhou, RLS inseguro, segredo no bundle,
//     conflito não resolvido ou branch desatualizado (para produção) → BLOCKED;
//   - CRITICAL sempre pede aprovação; HIGH em produção sempre pede aprovação;
//   - migração destrutiva ou sem rollback nunca é automática.
// As chaves de `publicacao` no config.json só LIBERAM o que já é seguro (LOW/MEDIUM com tudo verde).
//
// CLI:  node scripts/hefisto-agent/politica.mjs migracao <arquivo.sql> [...]   classifica e ensaia (PGLITE=… para checar sintaxe)
//       node scripts/hefisto-agent/politica.mjs avaliar '<json da entrada>'
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, resolve, basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { semLiterais } from "./guarda-sql.mjs";

export const RISCOS = Object.freeze(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const DECISOES = Object.freeze({ AUTO: "AUTO_SAFE", APROVACAO: "APPROVAL_REQUIRED", BLOQUEADO: "BLOCKED" });
export const CLASSES_MIGRACAO = Object.freeze(["SAFE", "REVIEW", "CRITICAL"]);

/** Padrões seguros: só preview é automático. Produção e aplicar migração pedem o dono até ele ligar. */
export const PUBLICACAO_PADRAO = Object.freeze({
  autoPublishPreview: true,
  autoPublishProductionLowRisk: false,
  autoApplySafeMigrations: false,
  requireApprovalForHighRisk: true,
  requireApprovalForCritical: true,
});

/** Ações que SEMPRE pedem o dono (seção 3 da missão). */
export const ACOES_DO_DONO = Object.freeze({
  drop_table: "DROP TABLE", drop_column: "DROP COLUMN", truncate: "TRUNCATE", delete_massa: "DELETE em massa",
  update_massa_sem_rollback: "UPDATE em massa sem rollback claro", migracao_irreversivel: "migração irreversível",
  rls_critico: "alteração crítica de RLS", desativar_auth: "desativar autenticação", segredo: "alterar segredo",
  senha_2fa: "alterar senha/2FA", excluir_usuario: "excluir usuário", pagamento: "pagamento",
  transferencia: "transferência financeira", orcamento_anuncio: "aumentar orçamento de anúncio",
  excluir_campanha: "excluir campanha", dns: "alterar DNS", dominio: "alterar domínio",
  producao_irreversivel: "alteração irreversível em produção",
});

const maior = (a, b) => (RISCOS.indexOf(a) >= RISCOS.indexOf(b) ? a : b);
const PRODUCAO = new Set(["production", "producao", "produção"]);
const BANCO_REAL = new Set(["supabase", "supabase-production", "supabase-producao", "banco-real"]);
// áreas em que um erro vira vazamento, dinheiro errado ou porta aberta
const AREAS_SENSIVEIS = /^(auth|login|permiss|rls|tenant|empresa|financeiro|fin_|pagamento|seguran|middleware|server|segredo|secret)/i;

/**
 * Decide uma alteração. Entrada (tudo opcional, ausência = não verificado):
 *   changeType: docs | code | config | migration | <chave de ACOES_DO_DONO>
 *   environment: local | preview | production | supabase
 *   affectedAreas: [..]       migrationType: SAFE | REVIEW | CRITICAL
 *   tests, build: passed | failed | not_run      securityChecks: { rls: ok | insecure }
 *   rollbackAvailable: bool   tenantIsolation: ok | failed      secretsCheck: ok | exposed
 *   branchUpToDate: bool      conflicts: bool                    previewValidated: bool
 *   criticalRegression: bool
 */
export function avaliarPolitica(entrada = {}, publicacao = {}) {
  const p = { ...PUBLICACAO_PADRAO, ...publicacao };
  const e = { affectedAreas: [], ...entrada };
  const amb = String(e.environment || "preview").toLowerCase();
  const producao = PRODUCAO.has(amb);
  const banco = BANCO_REAL.has(amb);
  const tipo = String(e.changeType || "code");
  const sensivel = (e.affectedAreas || []).filter((a) => AREAS_SENSIVEIS.test(a));
  const riscos = []; // [nível, motivo]

  // ── risco ──
  if (ACOES_DO_DONO[tipo]) riscos.push(["CRITICAL", `ação que sempre exige o dono: ${ACOES_DO_DONO[tipo]}`]);
  if (e.migrationType === "CRITICAL") riscos.push(["CRITICAL", "migração CRITICAL (destrutiva, desliga RLS ou pode misturar empresas)"]);
  if (e.migrationType === "REVIEW") riscos.push(["HIGH", "migração REVIEW (muda coluna, constraint, RLS, função crítica ou faz backfill)"]);
  if (e.migrationType === "SAFE") riscos.push(["MEDIUM", "migração aditiva (SAFE)"]);
  if (tipo === "docs") riscos.push(["LOW", "só documentação/memória"]);
  if (tipo === "code" || tipo === "config") riscos.push([producao ? "MEDIUM" : "LOW", producao ? "código em produção" : "código fora de produção"]);
  if (sensivel.length) riscos.push([producao || banco ? "HIGH" : "MEDIUM", `área sensível: ${sensivel.join(", ")}`]);
  if ((producao || banco || e.migrationType) && e.rollbackAvailable === false) riscos.push(["HIGH", "rollback desconhecido"]);
  const riskLevel = riscos.reduce((r, [n]) => maior(r, n), "LOW");

  // ── verificações exigidas para este ambiente/mudança ──
  const requiredChecks = [];
  if (tipo !== "docs") requiredChecks.push("tests");
  if (tipo === "code" || tipo === "config") requiredChecks.push("build", "secretsCheck");
  if (producao || banco || e.migrationType || sensivel.length) requiredChecks.push("tenantIsolation", "securityChecks.rls", "rollbackAvailable");
  if (producao) requiredChecks.push("previewValidated", "branchUpToDate");

  // ── travas (BLOCKED) ──
  const travas = [];
  if (e.tests === "failed") travas.push("teste falhou");
  if (e.build === "failed") travas.push("build falhou");
  if (e.tenantIsolation === "failed") travas.push("isolamento entre empresas falhou (CRÍTICO)");
  if (e.securityChecks?.rls === "insecure") travas.push("RLS inseguro");
  if (e.secretsCheck === "exposed") travas.push("segredo apareceu no bundle");
  if (e.conflicts) travas.push("conflito não resolvido");
  if (e.criticalRegression) travas.push("regressão crítica encontrada");
  if (producao && e.branchUpToDate === false) travas.push("branch desatualizado em relação à main");
  const ok = (c) => ({
    // not_applicable: mudança fora do app (ex.: scripts/), que não passa pelo build do Next nem vai para o bundle
    tests: e.tests === "passed", build: e.build === "passed" || e.build === "not_applicable", secretsCheck: e.secretsCheck === "ok" || e.secretsCheck === "not_applicable",
    tenantIsolation: e.tenantIsolation === "ok", "securityChecks.rls": e.securityChecks?.rls === "ok",
    rollbackAvailable: e.rollbackAvailable === true, previewValidated: e.previewValidated === true, branchUpToDate: e.branchUpToDate === true,
  })[c];
  const faltam = requiredChecks.filter((c) => !ok(c));

  const reasons = riscos.map(([n, m]) => `${n}: ${m}`);
  const sair = (decision, extra) => ({ riskLevel, decision, reasons: [...reasons, ...extra], requiredChecks, approvalRequired: decision === DECISOES.APROVACAO, faltam });

  if (travas.length) return sair(DECISOES.BLOQUEADO, travas.map((t) => `BLOQUEADO: ${t}`));
  // ação do dono ou CRITICAL: nunca automático, mesmo com tudo verde (a configuração não muda isso)
  if (riskLevel === "CRITICAL") return sair(DECISOES.APROVACAO, ["CRITICAL: sempre exige aprovação do dono"]);
  if (riskLevel === "HIGH" && (producao || banco || p.requireApprovalForHighRisk !== false)) return sair(DECISOES.APROVACAO, ["HIGH: exige aprovação do dono"]);
  if ((e.migrationType || producao || banco) && e.rollbackAvailable === false) return sair(DECISOES.APROVACAO, ["sem rollback conhecido: exige aprovação"]);
  // falta evidência: não publica no escuro (volta a avaliar depois de rodar o que falta)
  if (faltam.length) return sair(DECISOES.BLOQUEADO, [`faltam verificações: ${faltam.join(", ")}`]);
  // LOW/MEDIUM com tudo verde: as chaves de configuração decidem se segue sozinho
  if (producao && !p.autoPublishProductionLowRisk) return sair(DECISOES.APROVACAO, ["produção automática desligada (autoPublishProductionLowRisk=false)"]);
  if (banco && !p.autoApplySafeMigrations) return sair(DECISOES.APROVACAO, ["aplicar migração automática desligado (autoApplySafeMigrations=false)"]);
  if (!producao && !banco && amb === "preview" && !p.autoPublishPreview) return sair(DECISOES.APROVACAO, ["preview automático desligado (autoPublishPreview=false)"]);
  return sair(DECISOES.AUTO, ["AUTO_SAFE: risco baixo/médio, verificações verdes"]);
}

// ─── migrações ───────────────────────────────────────────────────────────────

const TRAVA = { "ACCESS EXCLUSIVE": "bloqueia leitura e escrita da tabela enquanto roda", SHARE: "bloqueia escrita na tabela enquanto roda" };

/** Corpos de `DO $$ … $$` (executam na hora) para analisar também. */
function corposDo(sql) {
  const out = [];
  const re = /\bdo\s+(\$[A-Za-z_]*\$)([\s\S]*?)\1/gi;
  let m;
  while ((m = re.exec(sql))) out.push(m[2]);
  return out;
}

const semEsquema = (n) => n.replace(/^public\./, "");
/** Mesma chave para `drop X nome` e `create X nome` (policy: pela tabela, porque o nome entre aspas some na leitura). */
function chaveRecriar(tipo, c) {
  if (tipo === "policy") return `policy:${alvoDoComando(c)}`;
  const resto = c
    .replace(/^(drop|create(?: or replace)?(?: unique)?(?: constraint)?)\s+(policy|function|procedure|trigger|materialized view|view|index)\s+/, "")
    .replace(/^((if (not )?exists|concurrently)\s+)+/, "");
  return `${tipo}:${semEsquema(/^([\w.]+)/.exec(resto)?.[1] || "")}`;
}
/** Tabela que o comando escreve/altera (não as que só lê). */
function alvoDoComando(c) {
  const m = /^(?:create table(?: if not exists)?|alter table(?: if exists)?(?: only)?|drop table(?: if exists)?|truncate(?: table)?|insert into|update(?: only)?|delete from|create (?:unique )?index(?: concurrently)?(?: if not exists)? [\w.]+ on|(?:create|alter|drop) policy(?: if exists)? "?[\w ]*"? on|(?:create|drop) trigger(?: if exists)? \w+ (?:before|after|instead of)[\w ,]* on|drop trigger(?: if exists)? \w+ on)\s+(?:only\s+)?([a-z_][\w]*(?:\.[a-z_]\w*)?)(?![\w.(])/.exec(c);
  return m ? semEsquema(m[1]) : null;
}

/** Classe e motivo de UM comando (minúsculo, sem textos/comentários). `ctx`: tabelas criadas e o que é recriado no arquivo. */
function classificarComando(c, ctx = { criadas: new Set(), recriadas: new Set() }) {
  const R = (classe, motivo, trava = null) => ({ classe, motivo, trava });
  if (/^with\b/.test(c)) return /\)\s*(update|delete from|insert into)\b/.test(c) ? R("REVIEW", "WITH … UPDATE/DELETE/INSERT (backfill)") : null;
  if (/^(begin|commit|end|start transaction|set |reset |select |raise |perform |notify |comment on |analyze\b|savepoint |release |values |table |explain )/.test(`${c} `)) return null;
  if (/^(if|else|elsif|end if|loop|end loop|return|declare|exception|when|for |foreach|continue|exit|get diagnostics|null)\b/.test(c)) return null; // plpgsql dentro de DO
  // declaração de variável do DO ("v_total numeric := 0", "r record") e atribuição ("v := …")
  if (ctx.dentroDeDo && (/^[a-z_]\w* (constant )?[a-z_][\w.]*(\(\d+(, ?\d+)?\))?(\[\])?( not null)?( (:=|default) .*)?$/.test(c) || /^[a-z_][\w.]* :?= /.test(c))) return null;
  if (/^do\b/.test(c)) return null; // o corpo é analisado à parte
  if (/^create (temp|temporary) table\b/.test(c)) return R("SAFE", "tabela temporária (some no fim da sessão)");
  if (/^execute\b/.test(c)) return R("REVIEW", "SQL dinâmico (EXECUTE): não dá para analisar o que roda");
  if (/^truncate\b/.test(c)) return R("CRITICAL", "TRUNCATE apaga todas as linhas");
  if (/^drop (table|schema|database|column|type|sequence|extension|role|user|owned|materialized view)\b/.test(c)) return R("CRITICAL", `DROP ${c.split(" ")[1].toUpperCase()} apaga estrutura e dados`, "ACCESS EXCLUSIVE");
  if (/^drop (policy|function|procedure|trigger|view|index|rule|aggregate|operator)\b/.test(c)) {
    const tipo = c.split(" ")[1];
    return ctx.recriadas.has(chaveRecriar(tipo, c))
      ? R("SAFE", `DROP ${tipo.toUpperCase()} seguido de recriação no mesmo arquivo`)
      : R("REVIEW", `DROP ${tipo.toUpperCase()} sem recriar no mesmo arquivo (troca de comportamento)`);
  }
  if (/^drop\b/.test(c)) return R("CRITICAL", "DROP");
  if (/^delete from\b/.test(c)) return /\bwhere\b/.test(c) ? R("REVIEW", "DELETE com filtro (confira quantas linhas)") : R("CRITICAL", "DELETE sem WHERE (em massa)");
  if (/^update\b/.test(c)) return /\bwhere\b/.test(c) ? R("REVIEW", "UPDATE com filtro (backfill: confira volume e rollback)") : R("CRITICAL", "UPDATE sem WHERE (em massa)");
  if (/^alter table\b/.test(c)) {
    if (/\b(disable row level security|no force row level security)\b/.test(c)) return R("CRITICAL", "desliga RLS", "ACCESS EXCLUSIVE");
    if (/\bdrop column\b/.test(c)) return R("CRITICAL", "DROP COLUMN apaga dados", "ACCESS EXCLUSIVE");
    if (ctx.criadas.has(alvoDoComando(c))) return R("SAFE", "ALTER em tabela criada nesta migração");
    if (/\b(alter column|rename|set data type|type\b)/.test(c)) return R("REVIEW", "muda coluna/nome/tipo (pode quebrar código e reescrever a tabela)", "ACCESS EXCLUSIVE");
    if (/\b(add constraint|drop constraint|validate constraint)\b/.test(c)) return R("REVIEW", "muda constraint", "ACCESS EXCLUSIVE");
    if (/\b(enable row level security|force row level security)\b/.test(c)) return R("REVIEW", "liga RLS (mudança relevante de acesso)", "ACCESS EXCLUSIVE");
    if (/\bowner to\b/.test(c)) return R("REVIEW", "troca dono da tabela");
    if (/\badd column\b/.test(c)) {
      return /\bnot null\b/.test(c) && !/\bdefault\b/.test(c)
        ? R("REVIEW", "ADD COLUMN NOT NULL sem DEFAULT falha com linhas existentes", "ACCESS EXCLUSIVE")
        : R("SAFE", "ADD COLUMN aditivo", "ACCESS EXCLUSIVE");
    }
    return R("REVIEW", "ALTER TABLE não reconhecido", "ACCESS EXCLUSIVE");
  }
  if (/^(create|alter) policy\b/.test(c)) {
    if (/\b(using|with check)\s*\(\s*true\s*\)/.test(c)) return R("CRITICAL", "policy aberta (USING/WITH CHECK true) pode misturar empresas");
    // "auth.role() = 'authenticated'" (o texto vira '' na leitura) = qualquer logado de qualquer empresa
    if (/\b(using|with check)\s*\(\s*\(?\s*auth\.role\(\)\s*=\s*''(::text)?\s*\)?\s*\)/.test(c)) return R("CRITICAL", "policy aberta (auth.role() = 'authenticated': qualquer logado) pode misturar empresas");
    if (/\bor\s*\(?\s*\w*\.?unidade_id\s+is\s+null\b/.test(c)) return R("REVIEW", "policy deixa linhas sem unidade visíveis para todos (… OR unidade_id IS NULL)");
    if (/\bto\s+(anon|public)\b/.test(c)) return R("REVIEW", "policy para anon/public");
    return c.startsWith("alter") ? R("REVIEW", "ALTER POLICY (mudança relevante de RLS)") : R("SAFE", "CREATE POLICY");
  }
  if (/^create (or replace )?(function|procedure)\b/.test(c)) {
    return /\bsecurity definer\b/.test(c) ? R("REVIEW", "função SECURITY DEFINER (roda com poder do dono; confira search_path e tenant)") : R("SAFE", "CREATE FUNCTION");
  }
  if (/^create (or replace )?trigger\b|^create constraint trigger\b/.test(c)) return R("REVIEW", "trigger muda o efeito de escritas existentes", "SHARE ROW EXCLUSIVE");
  if (/^create (unique )?index concurrently\b/.test(c)) return R("SAFE", "CREATE INDEX CONCURRENTLY");
  if (/^create (unique )?index\b/.test(c)) return R("SAFE", "CREATE INDEX", "SHARE");
  if (/^create (table|schema|sequence|type|domain)\b/.test(c)) return R("SAFE", `CREATE ${c.split(" ")[1].toUpperCase()}`);
  if (/^create (or replace )?(view|materialized view)\b/.test(c)) return R("SAFE", "CREATE VIEW");
  if (/^create extension\b/.test(c)) return R("REVIEW", "CREATE EXTENSION");
  if (/^grant\b/.test(c)) return /\bto\s+(anon|public)\b|\ball\b/.test(c) ? R("REVIEW", "GRANT amplo (anon/public/ALL)") : R("SAFE", "GRANT controlado");
  if (/^revoke\b/.test(c)) {
    const de = /\bfrom\s+(.+)$/.exec(c)?.[1].split(",").map((s) => s.trim()) || [];
    return de.length && de.every((r) => r === "anon" || r === "public")
      ? R("SAFE", "REVOKE de anon/public (endurece acesso)")
      : R("REVIEW", "REVOKE (pode tirar acesso do app)");
  }
  if (/^insert into\b/.test(c)) return /\bselect\b/.test(c) ? R("REVIEW", "INSERT … SELECT (backfill)") : R("SAFE", "INSERT de valores");
  if (/^alter (function|procedure|view|sequence|type|schema|default privileges)\b/.test(c)) return R("REVIEW", `ALTER ${c.split(" ")[1].toUpperCase()}`);
  return R("REVIEW", `comando não reconhecido: "${c.split(" ").slice(0, 3).join(" ")}"`);
}

/**
 * Classifica uma migração: SAFE (aditiva) · REVIEW (pede o dono) · CRITICAL (destrutiva/insegura).
 * Também diz tabelas afetadas, travas, se tem rollback documentado, transação e preflight.
 */
export function classificarMigracao(sql) {
  const achados = [];
  const tabelas = new Set();
  const travas = new Set();
  // 1ª passada: comandos (do arquivo e dos blocos DO), tabelas criadas e objetos recriados
  const comandos = [];
  const ler = (texto, dentroDeDo) => {
    const limpo = semLiterais(texto);
    if (limpo.erro) { achados.push({ classe: "REVIEW", comando: "(texto)", motivo: `não deu para ler: ${limpo.erro}` }); return; }
    // plpgsql (corpo de DO): o comando vem logo depois de begin/then/else/loop, sem ";"
    const separador = dentroDeDo ? /;|\b(?:begin|then|else|elsif|loop|declare)\b/i : /;/;
    for (const bruto of limpo.texto.split(separador)) {
      const c = (bruto || "").toLowerCase().replace(/\s+/g, " ").trim();
      if (c) comandos.push({ c, dentroDeDo });
    }
  };
  ler(sql, false);
  for (const corpo of corposDo(sql)) ler(corpo, true);
  // SQL dinâmico (EXECUTE format('…')): o perigo fica dentro do texto. Procura fora dos comentários.
  const semComentarios = sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");
  if (/disable\s+row\s+level\s+security|no\s+force\s+row\s+level\s+security/i.test(semComentarios) && !achados.some((a) => /desliga RLS/.test(a.motivo))) {
    achados.push({ classe: "CRITICAL", comando: "(SQL dinâmico)", motivo: "desliga RLS (dentro de texto executado)" });
  }
  if (/\b(using|with check)\s*\(\s*(true|\(?\s*auth\.role\(\)\s*=\s*'authenticated')/i.test(semComentarios) && !achados.some((a) => /policy aberta/.test(a.motivo))) {
    achados.push({ classe: "CRITICAL", comando: "(SQL dinâmico)", motivo: "policy aberta (USING/WITH CHECK true) dentro de texto executado" });
  }
  const ctx = { criadas: new Set(), recriadas: new Set() };
  for (const { c } of comandos) {
    if (/^create table\b/.test(c)) ctx.criadas.add(alvoDoComando(c));
    const cr = /^create (?:or replace )?(?:unique )?(?:constraint )?(policy|function|procedure|trigger|view|materialized view|index)\b/.exec(c);
    if (cr) ctx.recriadas.add(chaveRecriar(cr[1].split(" ").pop(), c));
  }
  // 2ª passada: classifica
  for (const { c, dentroDeDo } of comandos) {
    const alvo = alvoDoComando(c);
    if (alvo) tabelas.add(alvo);
    const r = classificarComando(c, { ...ctx, dentroDeDo });
    if (!r) continue;
    if (r.trava && !ctx.criadas.has(alvo)) travas.add(`${r.trava}${alvo ? ` em ${alvo}` : ""}: ${TRAVA[r.trava] || "trava a tabela"}`);
    achados.push({ classe: r.classe, comando: c.slice(0, 120), motivo: dentroDeDo ? `${r.motivo} (dentro de DO)` : r.motivo });
  }
  const classe = achados.reduce((k, a) => (CLASSES_MIGRACAO.indexOf(a.classe) > CLASSES_MIGRACAO.indexOf(k) ? a.classe : k), "SAFE");
  const baixo = sql.toLowerCase();
  return {
    classe,
    achados,
    tabelas: [...tabelas].sort(),
    travas: [...travas],
    // rollback documentado: bloco/linha de comentário que começa com "ROLLBACK" (padrão das migrações do repositório)
    rollback: /(\/\*|--)[\s─—-]*rollback\b/i.test(sql),
    transacao: /^\s*begin\b|\bbegin\s*;/m.test(baixo),
    preflight: /preflight|pré-?checagem|pre-?check/i.test(sql),
    verificacao: /confer[êe]ncia|verifica[çc][ãa]o|impress[ãa]o digital|fingerprint/i.test(sql),
    comandos: achados.length,
    // desligar RLS ou policy aberta: RLS inseguro (BLOCKED na política), não só "pedir o dono"
    rlsInseguro: achados.some((a) => a.classe === "CRITICAL" && /RLS|policy aberta/.test(a.motivo)),
  };
}

/**
 * Rollback em arquivo irmão, no padrão do repositório: `IC_01_ROLLBACK.sql` ao lado de
 * `IC_01_INTELLIGENCE_CORE.sql`, `F2_1_…_ROLLBACK.sql`, `rollback_01_x.sql` ao lado de `01_x.sql`.
 */
export function rollbackIrmao(nome, irmaos) {
  const base = nome.replace(/\.sql$/i, "");
  const prefixo = base.split("_").slice(0, 2).join("_");
  return irmaos.find((f) => f !== nome && /rollback/i.test(f) && /\.sql$/i.test(f) && (
    f.toLowerCase() === `rollback_${nome.toLowerCase()}` || f.toLowerCase().startsWith(`${base.toLowerCase()}_rollback`) || (prefixo.length >= 4 && f.startsWith(`${prefixo}_`))
  )) || null;
}

/**
 * Ensaio (dry-run) local: classificação + tentativa de rodar no PGlite (banco vazio)
 * dentro de uma transação desfeita. Sem PGLITE, só a análise estática.
 * Erro de sintaxe → `sintaxe: "erro"`; objeto ausente → dependência que o banco real precisa ter.
 */
export async function ensaiarMigracao(sql, { pglite = process.env.PGLITE } = {}) {
  const analise = classificarMigracao(sql);
  const r = { ...analise, sintaxe: "NÃO VALIDADO", dependencias: [], ensaio: "análise estática" };
  if (!pglite) return r;
  try {
    const mod = await import(pathToFileURL(join(resolve(pglite), "dist", "index.js")).href).catch(() => import(pglite));
    const pg = new mod.PGlite();
    try {
      await pg.exec(`begin;\n${sql.replace(/^\s*(begin|commit)\s*;\s*$/gim, "")}\n;rollback;`);
      r.sintaxe = "ok";
      r.ensaio = "PGlite: rodou e foi desfeito (banco vazio)";
    } catch (e) {
      const cod = e?.code || "";
      if (cod === "42601") r.sintaxe = `erro: ${e.message}`;
      else { r.sintaxe = "ok até a primeira dependência"; r.dependencias.push(`${cod} ${e.message}`); }
      r.ensaio = "PGlite: transação desfeita";
    } finally { await pg.close?.(); }
  } catch (e) {
    r.ensaio = `PGlite indisponível (${e.message}); só análise estática`;
  }
  return r;
}

// ─── segredo no bundle ───────────────────────────────────────────────────────

// O nome da variável no bundle já é falha; o JWT do service_role tem "role":"service_role" no payload.
const SEGREDOS = [
  [/SUPABASE_SERVICE_ROLE_KEY/, "nome SUPABASE_SERVICE_ROLE_KEY no bundle"],
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/, "JWT de service_role"],
  [/\bsk-ant-[A-Za-z0-9_-]{20,}/, "chave da Anthropic"],
  [/\bsb_secret_[A-Za-z0-9_-]{10,}/, "chave secreta do Supabase"],
];

/** Varre o bundle do navegador (.next/static) atrás de segredo. { estado: ok | exposed | not_run, achados } */
export function varrerSegredos(dir, { valores = [] } = {}) {
  if (!existsSync(dir)) return { estado: "not_run", achados: [], motivo: `${dir} não existe (sem build)` };
  const achados = [];
  const pilha = [dir];
  while (pilha.length) {
    const d = pilha.pop();
    for (const nome of readdirSync(d)) {
      const f = join(d, nome);
      const st = statSync(f);
      if (st.isDirectory()) { pilha.push(f); continue; }
      if (!/\.(js|mjs|cjs|json|html|txt|map)$/.test(nome) || st.size > 20 * 1024 * 1024) continue;
      const t = readFileSync(f, "utf8");
      for (const [re, motivo] of SEGREDOS) if (re.test(t)) achados.push(`${motivo} em ${f}`);
      for (const v of valores) if (v && v.length >= 16 && t.includes(v)) achados.push(`valor de variável secreta em ${f}`);
    }
  }
  return { estado: achados.length ? "exposed" : "ok", achados };
}

// ─── rodada do runner → entrada da política ──────────────────────────────────

/** Áreas a partir dos arquivos mudados. */
export function areasDosArquivos(arquivos) {
  const a = new Set();
  for (const f of arquivos) {
    if (/^app\/lib\/server\/|^app\/api\//.test(f)) a.add("server");
    if (/permiss|rbac/i.test(f)) a.add("permissoes");
    if (/auth|login|middleware/i.test(f)) a.add("auth");
    if (/financeiro|\/fin[_-]|pagamento|contas-(pagar|receber)/i.test(f)) a.add("financeiro");
    if (/^db\/security\/|rls/i.test(f)) a.add("rls");
    if (/^app\//.test(f)) a.add("app");
    if (/^db\//.test(f)) a.add("banco");
    if (/^scripts\//.test(f)) a.add("ferramentas");
    if (/^docs\/|\.md$/.test(f)) a.add("docs");
  }
  return [...a];
}

export function tipoDaMudanca(arquivos) {
  if (!arquivos.length) return "docs";
  if (arquivos.some((f) => /^db\/.*\.sql$/i.test(f))) return "migration";
  if (arquivos.every((f) => /^docs\/|\.md$/i.test(f))) return "docs";
  if (arquivos.every((f) => /\.(json|ya?ml|toml)$|^\.|config/i.test(f))) return "config";
  return "code";
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...resto] = process.argv.slice(2);
  if (cmd === "migracao" && resto.length) {
    let pior = "SAFE";
    for (const arq of resto) {
      const r = await ensaiarMigracao(readFileSync(arq, "utf8"));
      const irma = rollbackIrmao(basename(arq), readdirSync(dirname(resolve(arq))));
      if (irma) r.rollback = true;
      if (CLASSES_MIGRACAO.indexOf(r.classe) > CLASSES_MIGRACAO.indexOf(pior)) pior = r.classe;
      const d = avaliarPolitica({ changeType: "migration", environment: "supabase", migrationType: r.classe, rollbackAvailable: r.rollback, tests: "passed", tenantIsolation: "ok", securityChecks: { rls: r.rlsInseguro ? "insecure" : "ok" } });
      console.log(`${arq}: ${r.classe} → aplicar no banco real: ${d.decision} (${d.riskLevel})`);
      console.log(`  tabelas: ${r.tabelas.join(", ") || "–"} · rollback: ${r.rollback ? `sim${irma ? ` (${irma})` : ""}` : "NÃO"} · transação: ${r.transacao ? "sim" : "não"} · preflight: ${r.preflight ? "sim" : "não"} · verificação: ${r.verificacao ? "sim" : "não"}`);
      console.log(`  ensaio: ${r.ensaio} · sintaxe: ${r.sintaxe}${r.dependencias.length ? ` · dependência: ${r.dependencias[0]}` : ""}`);
      for (const t of r.travas) console.log(`  trava: ${t}`);
      for (const a of r.achados.filter((x) => x.classe !== "SAFE")) console.log(`  ${a.classe}: ${a.motivo} — ${a.comando}`);
    }
    process.exit(pior === "SAFE" ? 0 : pior === "REVIEW" ? 3 : 4);
  } else if (cmd === "avaliar" && resto.length) {
    console.log(JSON.stringify(avaliarPolitica(JSON.parse(resto.join(" "))), null, 2));
  } else {
    console.log("uso: politica.mjs migracao <arquivo.sql> [...]  |  politica.mjs avaliar '<json>'");
    process.exit(1);
  }
}
