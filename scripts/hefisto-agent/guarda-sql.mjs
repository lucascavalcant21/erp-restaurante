#!/usr/bin/env node
// GUARDA DE SQL do agente da noite (gancho PreToolUse do Claude Code).
//
// O runner liga este gancho só para o `execute_sql` do conector Supabase. Fora
// dele, o `execute_sql` não está na lista de permitidos: no modo dontAsk, ele é
// negado. Por isso a guarda falha FECHADA: se este script quebrar ou não rodar,
// o SQL não roda.
//
// O que ela faz com cada consulta:
//   1. recusa o que não é leitura (só SELECT, WITH, EXPLAIN, SHOW, VALUES, TABLE
//      e SET LOCAL), o que mexe no modo da transação, rede, arquivos do servidor,
//      funções administrativas e lugares com segredo (vault, auth.*, tokens);
//   2. confere o projeto (só o do Héfisto);
//   3. embrulha o que passou em `begin transaction read only; …; rollback;`.
//      Mesmo que algo escape do passo 1, o Postgres recusa qualquer escrita
//      (testado no Supabase real: "cannot execute CREATE TABLE in a read-only
//      transaction") e o rollback desfaz tudo.
//
// Uso (pelo runner): node guarda-sql.mjs <config.json>   (evento JSON na entrada)
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MAX_CARACTERES = 20000;

const INICIOS_PERMITIDOS = /^(select|with|explain|show|values|table)\b|^set local\b/;

// Palavras que, fora de textos e comentários, indicam escrita ou controle de transação.
const PALAVRAS_PROIBIDAS = /\b(insert|update|delete|merge|upsert|truncate|drop|alter|create|grant|revoke|copy|call|do|vacuum|cluster|reindex|refresh|lock|commit|rollback|abort|begin|start|savepoint|release|prepare|execute|deallocate|listen|notify|unlisten|discard|reset|checkpoint|load|import|into)\b/;

// Procurado em todo o texto (inclusive dentro de aspas e blocos $$).
const PROIBIDOS_EM_QUALQUER_LUGAR = [
  [/read[_\s]*only|read\s+write|transaction_isolation|session_authorization|session_replication_role/, "não pode mexer no modo da transação"],
  [/\bdblink|\bhttp(_[a-z]+)?\s*\(|\bnet\s*\.\s*http_|\bpg_net\b/, "o banco não pode acessar a rede"],
  [/\bpg_(terminate|cancel|signal)_backend|\bpg_reload_conf|\bpg_rotate_logfile|\bpg_switch_wal|\bpg_promote|\bpg_create_|\bpg_drop_|\bpg_replication_|\bpg_logical_/, "função administrativa do banco"],
  [/\bpg_read_(binary_)?file|\bpg_ls_|\bpg_stat_file|\blo_[a-z_]+\s*\(|\bpg_file_/, "arquivos do servidor"],
  [/\bpg_sleep/, "pg_sleep prende a conexão"],
  [/\bvault\b|\bdecrypted_|\bpgsodium|\bencrypted_password|_token\b|\bsecrets?\b/, "lugar com segredo"],
  [/\bauth\s*\.\s*(?!(uid|jwt|role|email)\s*\()[a-z_]+/, "tabelas internas de login (auth.*); use auth.uid()/auth.jwt() ou as tabelas do app"],
];

/** Troca comentários, textos ('…', E'…', "…", $tag$…$tag$) por marcadores, para analisar só o código. */
export function semLiterais(sql) {
  let out = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    const d = sql[i + 1];
    if (c === "-" && d === "-") {
      const f = sql.indexOf("\n", i);
      i = f < 0 ? n : f;
      out += " ";
      continue;
    }
    if (c === "/" && d === "*") {
      let prof = 1; // o Postgres aceita comentário dentro de comentário
      i += 2;
      while (i < n && prof) {
        if (sql[i] === "/" && sql[i + 1] === "*") { prof++; i += 2; } else if (sql[i] === "*" && sql[i + 1] === "/") { prof--; i += 2; } else i++;
      }
      if (prof) return { erro: "comentário /* sem fim" };
      out += " ";
      continue;
    }
    if (c === "'") {
      const comBarra = /[eE]/.test(sql[i - 1] || "") && !/[\w$]/.test(sql[i - 2] || "");
      i++;
      let fechou = false;
      while (i < n) {
        if (comBarra && sql[i] === "\\") { i += 2; continue; }
        if (sql[i] === "'") {
          if (sql[i + 1] === "'") { i += 2; continue; }
          i++; fechou = true; break;
        }
        i++;
      }
      if (!fechou) return { erro: "texto entre aspas sem fim" };
      out += "''";
      continue;
    }
    if (c === '"') {
      i++;
      let fechou = false;
      while (i < n) {
        if (sql[i] === '"') {
          if (sql[i + 1] === '"') { i += 2; continue; }
          i++; fechou = true; break;
        }
        i++;
      }
      if (!fechou) return { erro: "nome entre aspas duplas sem fim" };
      out += '"q"';
      continue;
    }
    if (c === "$" && !/[\w$]/.test(sql[i - 1] || "")) {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 70));
      if (m) {
        const f = sql.indexOf(m[0], i + m[0].length);
        if (f < 0) return { erro: "bloco $$ sem fim" };
        i = f + m[0].length;
        out += " $$ ";
        continue;
      }
    }
    out += c;
    i++;
  }
  return { texto: out };
}

/** Decide sobre uma consulta. { ok, motivo?, consulta? (já embrulhada em transação somente leitura) } */
export function avaliarSql(consulta, { projetos = [], projeto } = {}) {
  const nao = (motivo) => ({ ok: false, motivo });
  if (typeof consulta !== "string" || !consulta.trim()) return nao("consulta vazia");
  if (consulta.length > MAX_CARACTERES) return nao(`consulta longa demais (máximo ${MAX_CARACTERES} caracteres)`);
  if (projetos.length && !projetos.includes(projeto)) return nao(`projeto ${projeto || "(vazio)"} fora da lista permitida (${projetos.join(", ")})`);

  const limpo = semLiterais(consulta);
  if (limpo.erro) return nao(limpo.erro);
  const codigo = limpo.texto.toLowerCase().replace(/\s+/g, " ");
  const comandos = codigo.split(";").map((s) => s.trim()).filter(Boolean);
  if (!comandos.length) return nao("consulta vazia");
  for (const s of comandos) {
    const t = s.replace(/^\(+\s*/, "");
    if (!INICIOS_PERMITIDOS.test(t)) return nao(`comando não permitido: "${t.split(" ").slice(0, 3).join(" ")}"`);
  }
  const palavra = PALAVRAS_PROIBIDAS.exec(codigo);
  if (palavra) return nao(`"${palavra[1]}" não é leitura`);

  const tudo = consulta.toLowerCase().replaceAll('"', "").replace(/\s+/g, " ");
  for (const [re, motivo] of PROIBIDOS_EM_QUALQUER_LUGAR) if (re.test(tudo)) return nao(motivo);

  return { ok: true, consulta: `begin transaction read only;\n${consulta}\n;\nrollback;` };
}

const REGRA = "À noite o banco é só leitura: SELECT, WITH, EXPLAIN, SHOW, VALUES, TABLE e SET LOCAL (para testar RLS com set_config e set local role). Escrita de teste fica para uma sessão acompanhada: registre o que precisa em BLOQUEADORES.md.";

/** Resposta do gancho PreToolUse para um evento do Claude Code. */
export function decidirGancho(evento, conectores = {}) {
  const nome = String(evento?.tool_name || "");
  if (!/__execute_sql$/.test(nome)) return null; // não é com esta guarda
  const entrada = evento.tool_input || {};
  const r = avaliarSql(entrada.query, { projetos: conectores.supabase?.projetos || [], projeto: entrada.project_id });
  const saida = r.ok
    ? { permissionDecision: "allow", permissionDecisionReason: "guarda-sql: leitura em transação somente leitura", updatedInput: { ...entrada, query: r.consulta } }
    : { permissionDecision: "deny", permissionDecisionReason: `guarda-sql recusou: ${r.motivo}. ${REGRA}` };
  return { hookSpecificOutput: { hookEventName: "PreToolUse", ...saida } };
}

function registrar(linha) {
  const arq = process.env.HEFISTO_GUARDA_LOG;
  if (!arq) return;
  try { mkdirSync(dirname(arq), { recursive: true }); appendFileSync(arq, `${new Date().toISOString()} ${linha}\n`); } catch { /* log não decide nada */ }
}

if (process.argv[1] && process.argv[1].endsWith("guarda-sql.mjs")) {
  let entrada = "";
  process.stdin.on("data", (d) => { entrada += d; });
  process.stdin.on("end", () => {
    let resposta;
    try {
      const cfg = process.argv[2] ? JSON.parse(readFileSync(process.argv[2], "utf8")) : {};
      const evento = JSON.parse(entrada);
      resposta = decidirGancho(evento, cfg.conectores || {});
      if (resposta) registrar(`${resposta.hookSpecificOutput.permissionDecision} ${evento.tool_name} ${JSON.stringify(String(evento.tool_input?.query || "").slice(0, 2000))}`);
    } catch (e) {
      // na dúvida, nega
      resposta = { hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: `guarda-sql falhou (${e.message}); consulta não executada.` } };
      registrar(`deny erro ${e.message}`);
    }
    if (resposta) process.stdout.write(JSON.stringify(resposta));
  });
}
