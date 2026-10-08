// Núcleo do agente autônomo do Héfisto (sem efeitos colaterais além de
// leitura/escrita de arquivos que recebem o caminho). Usado por runner.mjs,
// status.mjs, missoes.mjs e pelos testes.
//
// Missão = um Markdown com frontmatter YAML simples (aparece como
// "propriedades" no Obsidian). Só o subconjunto que usamos:
//   chave: valor | "texto" | 3 | [a, b]
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { createHash } from "node:crypto";

export const STATUS = Object.freeze(["BACKLOG", "READY", "IN_PROGRESS", "BLOCKED", "VALIDATING", "DONE", "FAILED"]);
export const SECOES_MISSAO = Object.freeze(["Objetivo", "Critério de pronto", "Arquivos afetados", "Testes obrigatórios", "Resultado", "Evidências", "Histórico"]);

// ─── frontmatter ─────────────────────────────────────────────────────────────
function lerValor(bruto) {
  const v = bruto.trim();
  if (v === "") return "";
  if (v.startsWith("[") && v.endsWith("]")) {
    const dentro = v.slice(1, -1).trim();
    return dentro ? dentro.split(",").map((x) => lerValor(x)).filter((x) => x !== "") : [];
  }
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) return v.slice(1, -1).replace(/\\"/g, '"');
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  if (v === "true" || v === "false") return v === "true";
  return v;
}

function escreverValor(v) {
  if (Array.isArray(v)) {
    for (const x of v) if (/[,\[\]]/.test(String(x))) throw new Error(`item de lista inválido para o frontmatter: ${x}`);
    return `[${v.join(", ")}]`;
  }
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v ?? "");
  if (s === "" || /^[\s"[]|[\s]$|^-?\d+(\.\d+)?$|^(true|false)$|\n/.test(s)) return `"${s.replace(/\n/g, " ").replace(/"/g, '\\"')}"`;
  return s;
}

export function lerFrontmatter(texto) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(texto);
  if (!m) return { dados: {}, corpo: texto };
  const dados = {};
  for (const linha of m[1].split(/\r?\n/)) {
    if (!linha.trim() || linha.trim().startsWith("#")) continue;
    const i = linha.indexOf(":");
    if (i < 1) throw new Error(`frontmatter inválido: "${linha}"`);
    dados[linha.slice(0, i).trim()] = lerValor(linha.slice(i + 1));
  }
  return { dados, corpo: texto.slice(m[0].length) };
}

export function escreverFrontmatter(dados, corpo) {
  const linhas = Object.entries(dados).map(([k, v]) => `${k}: ${escreverValor(v)}`);
  return `---\n${linhas.join("\n")}\n---\n${corpo.startsWith("\n") ? corpo : `\n${corpo}`}`;
}

// ─── missões ─────────────────────────────────────────────────────────────────
export function validarMissao(m) {
  const erros = [];
  if (!/^[A-Z]+-\d{3,}$/.test(String(m.id || ""))) erros.push("id deve ser como HDEV-001");
  if (!m.titulo) erros.push("titulo obrigatório");
  if (!STATUS.includes(m.status)) erros.push(`status deve ser um de ${STATUS.join(", ")}`);
  if (!Number.isInteger(m.prioridade) || m.prioridade < 1 || m.prioridade > 5) erros.push("prioridade deve ser 1 (mais alta) a 5");
  if (!Array.isArray(m.dependencias)) erros.push("dependencias deve ser lista");
  if (!Array.isArray(m.bloqueadores)) erros.push("bloqueadores deve ser lista");
  return erros;
}

export function lerMissao(arquivo) {
  const { dados, corpo } = lerFrontmatter(readFileSync(arquivo, "utf8"));
  const m = { tentativas: 0, sem_progresso: 0, mesma_falha: 0, ultima_falha: "", dependencias: [], bloqueadores: [], ...dados, arquivo, corpo };
  return m;
}

export function gravarMissao(m) {
  const { arquivo, corpo, ...dados } = m;
  writeFileSync(arquivo, escreverFrontmatter(dados, corpo));
}

export function carregarMissoes(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => lerMissao(join(dir, f)));
}

/** READY, sem bloqueador, com todas as dependências DONE; menor prioridade primeiro, depois id. */
export function proximaMissao(missoes) {
  const feitas = new Set(missoes.filter((m) => m.status === "DONE").map((m) => m.id));
  return missoes
    .filter((m) => m.status === "READY" && !(m.bloqueadores || []).length && (m.dependencias || []).every((d) => feitas.has(d)))
    .sort((a, b) => a.prioridade - b.prioridade || String(a.id).localeCompare(String(b.id)))[0] || null;
}

/** Acrescenta uma linha datada na seção indicada do corpo (cria a seção se faltar). */
export function anotarSecao(corpo, secao, texto) {
  const cab = `## ${secao}`;
  const linhas = corpo.split("\n");
  let i = linhas.findIndex((l) => l.trim() === cab);
  if (i < 0) {
    return `${corpo.replace(/\s*$/, "")}\n\n${cab}\n\n- ${texto}\n`;
  }
  let fim = i + 1;
  while (fim < linhas.length && !/^## /.test(linhas[fim])) fim++;
  let ins = fim;
  while (ins > i + 1 && linhas[ins - 1].trim() === "") ins--;
  if (ins === i + 1) linhas.splice(ins, 0, "", `- ${texto}`); // seção vazia: linha em branco depois do título
  else linhas.splice(ins, 0, `- ${texto}`);
  return linhas.join("\n");
}

// ─── anti-loop ───────────────────────────────────────────────────────────────
/** Assinatura estável de uma falha: comando + fim da saída, sem números (tempos, pids, linhas). */
export function assinaturaFalha(comando, saida = "") {
  const fim = String(saida).split("\n").map((l) => l.trim()).filter(Boolean).slice(-8).join("\n");
  const norm = `${comando}\n${fim}`.replace(/\d+(\.\d+)?/g, "#").replace(/[0-9a-f]{7,40}/gi, "h");
  return createHash("sha1").update(norm).digest("hex").slice(0, 12);
}

/**
 * Decide o novo estado da missão depois de uma rodada.
 * @param {object} m          missão relida do disco (o agente pode ter mudado status)
 * @param {object} rodada     { motorOk, validacoesOk, falha: {assinatura, resumo}|null, progresso: bool, statusAgente }
 * @param {object} limites    { maxMesmaFalha, maxSemProgresso, maxTentativas }
 * @returns {{ missao: object, motivo: string }}
 */
export function decidir(m, rodada, limites) {
  const n = { ...m, tentativas: (m.tentativas || 0) + 1 };
  const declarado = rodada.statusAgente || m.status;

  if (rodada.falha) {
    n.mesma_falha = rodada.falha.assinatura === m.ultima_falha ? (m.mesma_falha || 0) + 1 : 1;
    n.ultima_falha = rodada.falha.assinatura;
  } else {
    n.mesma_falha = 0;
    n.ultima_falha = "";
  }
  n.sem_progresso = rodada.progresso ? 0 : (m.sem_progresso || 0) + 1;

  if (declarado === "BLOCKED") return { missao: { ...n, status: "BLOCKED" }, motivo: "o agente declarou bloqueio" };
  if (declarado === "DONE" && rodada.validacoesOk && rodada.motorOk) return { missao: { ...n, status: "DONE" }, motivo: "critério de pronto declarado e validações verdes" };
  if (n.mesma_falha >= limites.maxMesmaFalha) return { missao: { ...n, status: "BLOCKED" }, motivo: `a mesma falha repetiu ${n.mesma_falha}x: ${rodada.falha.resumo}` };
  if (n.sem_progresso >= limites.maxSemProgresso) return { missao: { ...n, status: "BLOCKED" }, motivo: `${n.sem_progresso} rodadas sem progresso (sem commit nem mudança de estado)` };
  if (n.tentativas >= limites.maxTentativas) return { missao: { ...n, status: "BLOCKED" }, motivo: `limite de ${limites.maxTentativas} rodadas atingido` };
  if (declarado === "DONE") return { missao: { ...n, status: "READY" }, motivo: `declarada DONE, mas ${rodada.falha ? `falhou: ${rodada.falha.resumo}` : "o motor falhou"} — volta para READY` };
  return { missao: { ...n, status: "READY" }, motivo: rodada.falha ? `falhou: ${rodada.falha.resumo} — tenta de novo` : "progresso parcial — continua na próxima rodada" };
}

/** Extrai a última linha `HEFISTO_RESULTADO: {...}` que o agente escreve no fim. */
export function lerResultadoDoAgente(texto) {
  const linhas = String(texto || "").split("\n").filter((l) => l.includes("HEFISTO_RESULTADO:"));
  for (const l of linhas.reverse()) {
    try {
      const j = JSON.parse(l.slice(l.indexOf("HEFISTO_RESULTADO:") + "HEFISTO_RESULTADO:".length).trim());
      if (j && typeof j === "object") return { status: STATUS.includes(j.status) ? j.status : null, resumo: String(j.resumo || "").slice(0, 500) };
    } catch { /* linha malformada: tenta a anterior */ }
  }
  return null;
}

// ─── índice (MISSÕES_ATIVAS / BACKLOG) ──────────────────────────────────────
const marcadores = (nome) => [`<!-- hefisto-agent:${nome}:inicio -->`, `<!-- hefisto-agent:${nome}:fim -->`];

export function tabelaMissoes(missoes, filtro) {
  const lista = missoes.filter(filtro).sort((a, b) => a.prioridade - b.prioridade || String(a.id).localeCompare(String(b.id)));
  if (!lista.length) return "_nenhuma_";
  const cel = (s) => String(s ?? "").replace(/\|/g, "/");
  return ["| id | título | status | prioridade | depende de | bloqueadores | rodadas |", "|---|---|---|---|---|---|---|",
    ...lista.map((m) => `| [[${m.id}]] | ${cel(m.titulo)} | ${m.status} | ${m.prioridade} | ${cel((m.dependencias || []).join(", ")) || "–"} | ${cel((m.bloqueadores || []).join(", ")) || "–"} | ${m.tentativas || 0} |`)].join("\n");
}

/** Substitui só o trecho gerado entre os marcadores; o resto do arquivo é do dono. */
export function atualizarTrechoGerado(texto, gerado, nome = "indice") {
  const [inicio, fim] = marcadores(nome);
  const bloco = `${inicio}\n${gerado}\n${fim}`;
  const a = texto.indexOf(inicio);
  const b = texto.indexOf(fim);
  if (a >= 0 && b > a) return texto.slice(0, a) + bloco + texto.slice(b + fim.length);
  return `${texto.replace(/\s*$/, "")}\n\n${bloco}\n`;
}

export function indiceAtivas(missoes, agora = new Date()) {
  const prox = proximaMissao(missoes);
  return [
    `_Gerado por \`npm run hefisto:missoes\` em ${agora.toISOString().slice(0, 16).replace("T", " ")} UTC. Edite as missões em \`missoes/\`, não esta tabela._`,
    "",
    `**Próxima automática:** ${prox ? `[[${prox.id}]] — ${prox.titulo}` : "nenhuma missão READY sem bloqueio"}`,
    "",
    "### Em andamento / prontas / validando",
    tabelaMissoes(missoes, (m) => ["IN_PROGRESS", "READY", "VALIDATING"].includes(m.status)),
    "",
    "### Bloqueadas",
    tabelaMissoes(missoes, (m) => m.status === "BLOCKED" || m.status === "FAILED"),
    "",
    "### Concluídas",
    tabelaMissoes(missoes, (m) => m.status === "DONE"),
  ].join("\n");
}

export function indiceBacklog(missoes) {
  return tabelaMissoes(missoes, (m) => m.status === "BACKLOG");
}

// ─── relatório noturno ───────────────────────────────────────────────────────
export const SECOES_NOTURNO = Object.freeze(["Missões trabalhadas", "Implementado", "Bugs encontrados", "Bugs corrigidos", "Testes", "Builds", "Commits", "PRs", "Preview", "Banco", "Segurança", "Bloqueadores", "Acessos necessários", "Próxima missão", "O que está pronto para uso"]);

export function modeloNoturno(data, inicio) {
  return [`# Relatório Noturno Héfisto — ${data}`, "", `Início: ${inicio}`, "Fim: (em andamento)", "",
    ...SECOES_NOTURNO.flatMap((s) => [`## ${s}`, ""]), ""].join("\n");
}

export function garantirRelatorioNoturno(dir, data, inicio) {
  const arq = join(dir, `${data}.md`);
  if (!existsSync(arq)) { mkdirSync(dir, { recursive: true }); writeFileSync(arq, modeloNoturno(data, inicio)); }
  return arq;
}

export function anotarRelatorio(arquivo, secao, texto) {
  writeFileSync(arquivo, anotarSecao(readFileSync(arquivo, "utf8"), secao, texto));
}

export function fecharRelatorio(arquivo, fim) {
  writeFileSync(arquivo, readFileSync(arquivo, "utf8").replace(/^Fim: .*$/m, `Fim: ${fim}`));
}

// ─── processo do motor (Linux/macOS/Windows) ────────────────────────────────
/**
 * No Windows, o `claude` instalado pelo npm é `claude.cmd`. Desde o Node 20,
 * um .cmd só roda com shell; então montamos a linha para o cmd.exe com cada
 * argumento entre aspas. Recusa o que o cmd interpretaria (" % e quebra de
 * linha) em vez de tentar escapar.
 */
export function prepararSpawn(comando, args, plataforma = process.platform) {
  if (plataforma !== "win32") return { arquivo: comando, args, shell: false };
  for (const a of [comando, ...args]) {
    if (/["%\r\n]/.test(String(a))) throw new Error(`argumento inseguro para o cmd do Windows: ${a}`);
  }
  return { arquivo: [comando, ...args].map((a) => `"${a}"`).join(" "), args: [], shell: true };
}

/**
 * No Windows sem Git Bash o Claude Code usa a ferramenta PowerShell, e regra
 * `Bash(...)` não vale para ela. Espelha cada `Bash(prefixo:*)` como
 * `PowerShell(prefixo *)` para as permissões e proibições valerem nos dois.
 */
export function comPowerShell(regras = []) {
  const extra = regras.map((r) => /^Bash\((.+):\*\)$/.exec(r)).filter(Boolean).map((m) => `PowerShell(${m[1]} *)`);
  return [...new Set([...regras, ...extra])];
}

/** Executável do motor: HEFISTO_AGENT_CLAUDE (ex.: %USERPROFILE%\.local\bin\claude.exe) ou o da configuração. */
export function comandoDoMotor(cfg, env = process.env) {
  return env.HEFISTO_AGENT_CLAUDE || cfg.motor.comando;
}

// ─── conectores do claude.ai (Supabase, Vercel) no agente da noite ──────────
// Os conectores ligados no claude.ai aparecem sozinhos no Claude Code logado com
// a mesma conta, com nomes `mcp__<servidor>__<ferramenta>`. O formato exato do
// <servidor> não é documentado; por isso há prefixos padrão na configuração e o
// `hefisto:preparar` descobre os reais (`.hefisto-agent/conectores.json`).

/** "mcp__claude_ai_Supabase__execute_sql" → { prefixo, servidor, ferramenta } */
export function partesFerramentaMcp(nome) {
  const m = /^mcp__(.+?)__(.+)$/.exec(String(nome));
  return m ? { prefixo: `mcp__${m[1]}__`, servidor: m[1], ferramenta: m[2] } : null;
}

/** Conectores da configuração (ignora `_leia` e `nuncaPermitir`). */
export function entradasConectores(conectores = {}) {
  return Object.entries(conectores || {}).filter(([, c]) => c && typeof c === "object" && !Array.isArray(c) && c.reconhecer);
}

/**
 * Regras para o motor: `permitir` (só ferramentas de leitura), `negar` (o que
 * nunca roda sem o dono) e `guardadas` (o SQL: fora da lista de permitidos, só
 * roda se o gancho guarda-sql aprovar; se o gancho falhar, o modo dontAsk nega).
 */
export function regrasConectores(conectores = {}, descobertos = {}) {
  const permitir = [];
  const negar = [];
  const guardadas = [];
  for (const [chave, c] of entradasConectores(conectores)) {
    const prefixos = [...new Set([...(c.prefixos || []), ...((descobertos || {})[chave] || [])])];
    for (const p of prefixos) {
      if (!/^mcp__[A-Za-z0-9_.-]+__$/.test(p)) throw new Error(`prefixo de conector inválido: ${p}`);
      for (const f of c.leitura || []) if (!(c.sqlGuardado || []).includes(f)) permitir.push(p + f);
      for (const f of c.sqlGuardado || []) guardadas.push(p + f);
      for (const f of conectores.nuncaPermitir || []) negar.push(p + f);
    }
  }
  return { permitir, negar, guardadas };
}

/** Comando do gancho: `node "<guarda>" "<config>"` (barras normais servem no bash, cmd e PowerShell). */
export function comandoGuarda(arquivoGuarda, arquivoConfig) {
  const barra = (p) => String(p).replaceAll("\\", "/");
  return `node "${barra(arquivoGuarda)}" "${barra(arquivoConfig)}"`;
}

/**
 * Arquivo --settings do motor: as regras dos conectores (permissions) e o gancho
 * PreToolUse só nas ferramentas guardadas. Vão num arquivo, e não na linha de
 * comando, porque o cmd do Windows corta linhas com mais de 8191 caracteres.
 */
export function configMotor(regras, comando) {
  const out = {};
  if (regras.permitir.length || regras.negar.length) out.permissions = { allow: regras.permitir, deny: regras.negar };
  if (regras.guardadas.length) {
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out.hooks = { PreToolUse: [{ matcher: `^(${regras.guardadas.map(esc).join("|")})$`, hooks: [{ type: "command", command: comando, timeout: 30 }] }] };
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Lê a saída `--output-format stream-json --verbose` de uma execução curta e
 * diz quais conectores carregaram (evento system/init: mcp_servers e tools).
 */
export function analisarInicio(saida, conectores = {}) {
  const init = String(saida).split(/\r?\n/).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .find((j) => j && j.type === "system" && j.subtype === "init");
  if (!init) return null;
  const servidores = (init.mcp_servers || []).map((s) => ({ nome: String(s.name), status: String(s.status) }));
  const ferramentas = (init.tools || []).filter((t) => String(t).startsWith("mcp__")).map(partesFerramentaMcp).filter(Boolean);
  const porConector = {};
  for (const [chave, c] of entradasConectores(conectores)) {
    const re = new RegExp(c.reconhecer, "i");
    const doConector = ferramentas.filter((p) => re.test(p.servidor));
    porConector[chave] = {
      servidores: servidores.filter((s) => re.test(s.nome)),
      prefixos: [...new Set(doConector.map((p) => p.prefixo))],
      ferramentas: doConector.length,
      leitura: doConector.filter((p) => (c.leitura || []).includes(p.ferramenta) || (c.sqlGuardado || []).includes(p.ferramenta)).length,
    };
  }
  return { versao: init.claude_code_version || null, origemChave: init.apiKeySource || null, conectores: porConector };
}

/**
 * Argumentos do `claude -p`. A instrução posicional e o --settings vêm ANTES das
 * listas, porque --allowedTools/--disallowedTools consomem todos os argumentos seguintes.
 */
export function argumentosMotor(cfg, { settings = null } = {}) {
  const args = [...cfg.motor.args, INSTRUCAO_MOTOR];
  if (settings) args.push("--settings", settings);
  if (cfg.motor.allowedTools?.length) args.push("--allowedTools", ...comPowerShell(cfg.motor.allowedTools));
  if (cfg.motor.disallowedTools?.length) args.push("--disallowedTools", ...comPowerShell(cfg.motor.disallowedTools));
  return args;
}

/** Instrução curta como argumento; o prompt completo vai pela entrada padrão (forma documentada do `claude -p`). */
export const INSTRUCAO_MOTOR = "Siga as instrucoes completas recebidas pela entrada padrao desta execucao.";

/** Encerra o processo e os filhos (no Windows, o cmd.exe e o claude por baixo). */
export function comandoParaMatar(pid, plataforma = process.platform) {
  return plataforma === "win32" ? { arquivo: "taskkill", args: ["/pid", String(pid), "/T", "/F"] } : null;
}

// ─── heartbeat / status ─────────────────────────────────────────────────────
export function lerStatus(arq) {
  try { return JSON.parse(readFileSync(arq, "utf8")); } catch { return null; }
}

export function gravarStatus(arq, parcial) {
  const atual = lerStatus(arq) || {};
  const novo = { ...atual, ...parcial, last_heartbeat: new Date().toISOString() };
  mkdirSync(dirname(arq), { recursive: true });
  writeFileSync(arq, JSON.stringify(novo, null, 2));
  return novo;
}

export function pidVivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

/** RODANDO | TRAVADO | PARADO | NUNCA_INICIADO, com o porquê. */
export function diagnostico(status, { agora = new Date(), vivo = pidVivo, travadoAposMinutos = 15 } = {}) {
  if (!status) return { estado: "NUNCA_INICIADO", detalhe: "nenhum status gravado ainda" };
  const idadeMin = (agora - new Date(status.last_heartbeat)) / 60000;
  if (status.estado === "ENCERRADO") return { estado: "PARADO", detalhe: `encerrado normalmente: ${status.last_result || "sem resultado"}` };
  if (!vivo(status.pid)) return { estado: "PARADO", detalhe: `o processo ${status.pid} não existe mais (encerrou sem registrar fim)` };
  if (idadeMin > travadoAposMinutos) return { estado: "TRAVADO", detalhe: `processo vivo, mas sem heartbeat há ${Math.round(idadeMin)} min` };
  return { estado: "RODANDO", detalhe: `missão ${status.current_mission || "–"}, heartbeat há ${Math.max(0, Math.round(idadeMin))} min` };
}

export function registrarLog(arq, linha) {
  mkdirSync(dirname(arq), { recursive: true });
  appendFileSync(arq, `${new Date().toISOString()} ${linha}\n`);
}
