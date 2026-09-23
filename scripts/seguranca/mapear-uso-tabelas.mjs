// Mapa de USO REAL das tabelas pelo app: quais telas (e portanto quais
// permissões do catálogo) leem e escrevem cada tabela.
//
// Como funciona
//   - Cada app/**/page.js é uma entrada. A rota vira página do catálogo pela
//     mesma regra do menu (a página mais específica de pagesForRoute).
//   - Componentes (arquivos fora de app/lib) contam inteiros: tudo que eles e
//     o que importam fazem.
//   - Bibliotecas (app/lib) contam por FUNÇÃO: só as funções importadas pela
//     tela, mais as que essas funções chamam no mesmo arquivo ou importam.
//     Sem isso, importar uma função de vendas.js "usaria" as 20 tabelas do arquivo.
//   - Nome de tabela em variável: função auxiliar chamada com o nome
//     (ex.: insertOne("evento_pratos", ...)) é resolvida; lista de nomes
//     iterada dentro da função também. O que não dá para resolver fica em
//     DINAMICOS_MANUAIS, com o porquê.
//   - O que o layout do dashboard alcança vira "global".
//
// É heurística (sem parser completo): nos casos que não entende, erra para
// MAIS uso (função não encontrada = arquivo inteiro), nunca para menos.
//
// Uso:
//   node scripts/seguranca/mapear-uso-tabelas.mjs          tabela legível
//   node scripts/seguranca/mapear-uso-tabelas.mjs --json   para outros scripts

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const { pagesForRoute } = await import(pathToFileURL(path.join(raiz, "app/lib/permissions-catalog.mjs")).href);
const { semComentariosNemStrings } = await import(pathToFileURL(path.join(raiz, "app/lib/analise-codigo.mjs")).href);

const rel = (p) => path.relative(raiz, p).split(path.sep).join("/");

/**
 * Nome de tabela que nenhuma análise estática resolve. Cada linha diz o que o
 * código faz e por quê entra no mapa.
 */
export const DINAMICOS_MANUAIS = [
  { arquivo: "app/lib/producao.js", funcao: "registrarProducao", tabelas: ["drinks", "cardapio"], ops: ["select", "update"],
    motivo: "soma o estoque de produção no prato (cardápio) ou no drink (bar), escolhido pelo setor" },
  { arquivo: "app/lib/unidades.js", funcao: "removerUnidade", tabelas: ["*unidade*"], ops: ["delete"],
    motivo: "excluir unidade apaga, tabela por tabela, tudo que tem aquele unidade_id (cascata lida do erro de FK)" },
];

function listar(dir, filtro, saida = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".next", "api"].includes(e.name)) listar(p, filtro, saida); }
    else if (filtro.test(e.name)) saida.push(p);
  }
  return saida;
}

function resolver(de, spec) {
  const base = path.resolve(path.dirname(de), spec);
  for (const c of [base, `${base}.js`, `${base}.mjs`, path.join(base, "index.js")]) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const ehLib = (arq) => rel(arq).startsWith("app/lib/");

/* ── Operações num trecho ──────────────────────────────────────────────── */
function opsDaCadeia(cadeia, tabela) {
  const ops = [];
  const escrita = /\.(insert|upsert|update|delete)\(/.exec(cadeia);
  const op = escrita ? escrita[1] : "select";
  if (op === "upsert") ops.push({ tabela, op: "insert" }, { tabela, op: "update" });
  else ops.push({ tabela, op });
  if (escrita && /\.select\(/.test(cadeia)) ops.push({ tabela, op: "select" });
  const comUnidade = /unidade_id/.test(cadeia) || /carimbarUnidade/.test(cadeia);
  return ops.map((o) => ({ ...o, comUnidade }));
}

function cadeiaApos(trecho, indice) {
  const resto = trecho.slice(indice, indice + 700);
  const corte = resto.search(/;\s*\n|\n\s*\n|\bconst\s|\blet\s|\bawait\s(?!supabase)/);
  return corte > 0 ? resto.slice(0, corte) : resto;
}

const ehStorage = (trecho, indice) => /storage\s*\.?\s*$/.test(trecho.slice(Math.max(0, indice - 40), indice));

/** .from("tabela") literal */
function operacoesLiterais(fonte, inicio, fim) {
  const trecho = fonte.slice(inicio, fim);
  const ops = [];
  for (const m of trecho.matchAll(/\.from\(\s*["'`]([a-z0-9_]+)["'`]\s*\)/g)) {
    if (ehStorage(trecho, m.index)) continue;
    ops.push(...opsDaCadeia(cadeiaApos(trecho, m.index), m[1]));
  }
  return ops;
}

/* ── Análise de um arquivo ─────────────────────────────────────────────── */
const cacheArquivo = new Map();

function parametros(limpo, inicioParen) {
  let p = 1, k = inicioParen + 1;
  for (; k < limpo.length && p > 0; k++) { if (limpo[k] === "(") p++; else if (limpo[k] === ")") p--; }
  const dentro = limpo.slice(inicioParen + 1, k - 1);
  let prof = 0, atual = "", lista = [];
  for (const ch of dentro) {
    if ("({[".includes(ch)) prof++;
    if (")}]".includes(ch)) prof--;
    if (ch === "," && prof === 0) { lista.push(atual); atual = ""; } else atual += ch;
  }
  if (atual.trim()) lista.push(atual);
  return { nomes: lista.map((s) => (/^\s*([A-Za-z_$][\w$]*)/.exec(s) || [])[1] || null), fimParen: k };
}

function analisarArquivo(arq) {
  if (cacheArquivo.has(arq)) return cacheArquivo.get(arq);
  const fonte = fs.readFileSync(arq, "utf8");
  const limpo = semComentariosNemStrings(fonte);

  const importados = new Map();
  const arquivosInteiros = new Set();
  for (const m of fonte.matchAll(/import\s+([^;]*?)\s+from\s*["'`](\.{1,2}\/[^"'`]+)["'`]/g)) {
    const alvo = resolver(arq, m[2]);
    if (!alvo) continue;
    const clausula = m[1];
    const chaves = /\{([^}]*)\}/.exec(clausula);
    if (chaves) {
      for (const parte of chaves[1].split(",")) {
        const [orig, local] = parte.trim().split(/\s+as\s+/);
        if (orig) importados.set((local || orig).trim(), { arquivo: alvo, nome: orig.trim() });
      }
    }
    const semChaves = clausula.replace(/\{[^}]*\}/, "").replace(/,/g, " ").trim();
    if (semChaves) {
      if (/^\*\s+as\s+/.test(semChaves) || !ehLib(alvo)) arquivosInteiros.add(alvo);
      else importados.set(semChaves.split(/\s+/)[0], { arquivo: alvo, nome: "default" });
    }
  }
  for (const m of fonte.matchAll(/(?:import\s*\(\s*|export\s[^;]*?from\s*)["'`](\.{1,2}\/[^"'`]+)["'`]/g)) {
    const alvo = resolver(arq, m[1]);
    if (alvo) arquivosInteiros.add(alvo);
  }

  // Funções de topo: nome -> { faixa, params }
  const funcoes = new Map();
  const reFunc = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z0-9_$]+)\s*\(|^(?:export\s+)?(?:const|let)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/gm;
  for (const m of limpo.matchAll(reFunc)) {
    const nome = m[1] || m[2];
    let inicioCorpo = m.index + m[0].length;
    let params = [];
    if (m[1]) {
      const r = parametros(limpo, m.index + m[0].length - 1);
      params = r.nomes;
      inicioCorpo = r.fimParen;
    } else if (m[3]) {
      params = m[3].startsWith("(") ? parametros(m[3], 0).nomes : [m[3]];
    }
    const i = limpo.indexOf("{", inicioCorpo - 1);
    const entre = limpo.slice(inicioCorpo, i === -1 ? undefined : i);
    let faixa;
    if (i === -1 || /\S/.test(entre.replace(/=>/, ""))) {
      const fimLinha = limpo.indexOf("\n", m.index + m[0].length);
      faixa = [m.index, fimLinha === -1 ? limpo.length : fimLinha];
    } else {
      let prof = 0, fim = i;
      for (; fim < limpo.length; fim++) {
        if (limpo[fim] === "{") prof++;
        else if (limpo[fim] === "}") { prof--; if (prof === 0) { fim++; break; } }
      }
      faixa = [m.index, fim];
    }
    funcoes.set(nome, { faixa, params });
    if (/export\s+default/.test(m[0])) funcoes.set("default", { faixa, params });
  }

  // Auxiliares dinâmicas: .from(parametro) — o nome da tabela chega pelo argumento.
  const auxiliares = new Map();
  for (const [nome, f] of funcoes) {
    const corpo = fonte.slice(...f.faixa);
    for (const m of corpo.matchAll(/\.from\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
      if (ehStorage(corpo, m.index)) continue;
      const pos = f.params.indexOf(m[1]);
      if (pos < 0) continue;
      const lista = auxiliares.get(nome) || { pos, ops: [] };
      lista.ops.push(...opsDaCadeia(cadeiaApos(corpo, m.index), "?").map((o) => ({ op: o.op, comUnidade: o.comUnidade })));
      auxiliares.set(nome, lista);
    }
  }

  const r = { arq, fonte, limpo, importados, arquivosInteiros, funcoes, auxiliares };
  cacheArquivo.set(arq, r);
  return r;
}

/** Operações de um trecho: literais, chamadas a auxiliares dinâmicas e listas iteradas. */
function operacoesDoTrecho(a, ini, fim, auxiliaresVisiveis) {
  const ops = operacoesLiterais(a.fonte, ini, fim);
  const trecho = a.fonte.slice(ini, fim);

  for (const [nome, aux] of auxiliaresVisiveis) {
    if (aux.pos !== 0) continue;
    for (const m of trecho.matchAll(new RegExp(`(^|[^\\w$.])${nome}\\(\\s*["'\`]([a-z0-9_]+)["'\`]`, "g"))) {
      for (const o of aux.ops) ops.push({ tabela: m[2], op: o.op, comUnidade: o.comUnidade });
    }
  }

  // .from(variavel) que não é parâmetro: a variável percorre nomes escritos no mesmo trecho.
  for (const m of trecho.matchAll(/\.from\(\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    if (ehStorage(trecho, m.index)) continue;
    const ehParametro = [...a.funcoes.values()].some((f) => f.faixa[0] <= ini + m.index && ini + m.index < f.faixa[1] && f.params.includes(m[1]));
    if (ehParametro) continue;
    const nomes = [...trecho.matchAll(/["'`]([a-z]+(?:_[a-z0-9]+)+)["'`]/g)].map((x) => x[1]);
    const cadeia = cadeiaApos(trecho, m.index);
    for (const t of new Set(nomes)) ops.push(...opsDaCadeia(cadeia, t).map((o) => ({ ...o, incerto: true })));
  }
  return ops;
}

/* ── Alcance: arquivo inteiro ou função ────────────────────────────────── */
function coletar(arq, nomeFuncao, acumulado, visitados) {
  const chave = `${arq}#${nomeFuncao || "*"}`;
  if (visitados.has(chave)) return;
  visitados.add(chave);
  const a = analisarArquivo(arq);

  const inteiro = !nomeFuncao || !ehLib(arq) || !a.funcoes.has(nomeFuncao);
  const faixa = inteiro ? [0, a.fonte.length] : a.funcoes.get(nomeFuncao).faixa;

  // Auxiliares do próprio arquivo e as importadas por este arquivo.
  const auxiliaresVisiveis = new Map(a.auxiliares);
  for (const [local, alvo] of a.importados) {
    const aux = analisarArquivo(alvo.arquivo).auxiliares.get(alvo.nome);
    if (aux) auxiliaresVisiveis.set(local, aux);
  }

  for (const op of operacoesDoTrecho(a, faixa[0], faixa[1], auxiliaresVisiveis)) acumulado.push({ ...op, arquivo: rel(arq) });
  for (const d of DINAMICOS_MANUAIS) {
    if (d.arquivo === rel(arq) && (inteiro || d.funcao === nomeFuncao)) {
      for (const t of d.tabelas) for (const op of d.ops) acumulado.push({ tabela: t, op, arquivo: rel(arq), manual: d.motivo });
    }
  }

  const corpo = a.limpo.slice(...faixa);
  for (const [local, alvo] of a.importados) {
    if (new RegExp(`(^|[^A-Za-z0-9_$.])${local.replace(/\$/g, "\\$")}([^A-Za-z0-9_$]|$)`).test(corpo)) coletar(alvo.arquivo, alvo.nome, acumulado, visitados);
  }
  if (!inteiro) {
    for (const [outra] of a.funcoes) {
      if (outra === nomeFuncao || outra === "default") continue;
      if (new RegExp(`(^|[^A-Za-z0-9_$.])${outra.replace(/\$/g, "\\$")}\\s*\\(`).test(corpo)) coletar(arq, outra, acumulado, visitados);
    }
  } else {
    for (const outro of a.arquivosInteiros) coletar(outro, null, acumulado, visitados);
  }
}

function usoDe(entrada) {
  const acumulado = [];
  coletar(entrada, null, acumulado, new Set());
  return acumulado;
}

function tabelasDefinidasEmSql() {
  const nomes = new Set();
  const andar = (d) => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (!["avulsos_locais", "testes"].includes(e.name)) andar(p); }
      else if (/.sql$/.test(e.name)) {
        for (const m of fs.readFileSync(p, "utf8").matchAll(/create table (?:if not exists )?(?:public.)?"?([a-z0-9_]+)"?/gi)) nomes.add(m[1].toLowerCase());
      }
    }
  };
  andar(path.join(raiz, "db"));
  andar(path.join(raiz, "docs"));
  return nomes;
}

/* ── Páginas → permissões ─────────────────────────────────────────────── */
function rotaDaPagina(arq) {
  return (rel(arq).replace(/^app/, "").replace(/\/page\.js$/, "") || "/").replace(/\[([^\]]+)\]/g, "x");
}
function paginasDoCatalogo(rota) {
  const cands = pagesForRoute(rota);
  if (!cands.length) return [];
  const maisLongo = Math.max(...cands.map((c) => c.parsed.path.length));
  // Rotas com ?dept=: a mesma tela serve cozinha e bar, então valem todas as variantes.
  return pagesForRoute(rota, "").concat(["cozinha", "bar"].flatMap((d) => pagesForRoute(rota, `dept=${d}`)))
    .filter((c) => c.parsed.path.length === maisLongo)
    .map(({ module, page }) => ({ chave: `${module.id}.${page.id}`, acoes: page.actions }));
}

export function mapearUso() {
  cacheArquivo.clear();
  const uso = new Map();
  const marcar = (o, origem) => {
    if (!uso.has(o.tabela)) uso.set(o.tabela, { select: new Set(), insert: new Set(), update: new Set(), delete: new Set(), arquivos: new Set(), comUnidade: false, incerto: false, confirmado: false, manual: new Set() });
    const u = uso.get(o.tabela);
    if (!o.incerto) u.confirmado = true;
    u[o.op].add(origem);
    u.arquivos.add(o.arquivo);
    if (o.comUnidade) u.comUnidade = true;
    if (o.incerto) u.incerto = true;
    if (o.manual) u.manual.add(o.manual);
  };

  const globais = [
    ...usoDe(path.join(raiz, "app/dashboard/layout.js")),
    ...(fs.existsSync(path.join(raiz, "app/layout.js")) ? usoDe(path.join(raiz, "app/layout.js")) : []),
  ];
  for (const o of globais) marcar(o, "global");

  const acoesPorPagina = {};
  for (const pagina of listar(path.join(raiz, "app"), /^page\.js$/)) {
    const rota = rotaDaPagina(pagina);
    let origens;
    if (!rota.startsWith("/dashboard")) origens = [`publica:${rota}`];
    else {
      const cat = paginasDoCatalogo(rota);
      for (const c of cat) acoesPorPagina[c.chave] = c.acoes;
      origens = cat.length ? [...new Set(cat.map((c) => c.chave))] : [`sem_catalogo:${rota}`];
    }
    for (const o of usoDe(pagina)) for (const origem of origens) marcar(o, origem);
  }

  // Nome visto só como texto perto de um .from(variavel) e nunca confirmado
  // (uso literal, auxiliar ou create table nos SQL do repositório) não é tabela.
  const definidasEmSql = tabelasDefinidasEmSql();
  const tabelas = [...uso.entries()].filter(([t, u]) => u.confirmado || definidasEmSql.has(t)).sort((a, b) => a[0].localeCompare(b[0])).map(([tabela, u]) => ({
    tabela,
    select: [...u.select].sort(), insert: [...u.insert].sort(), update: [...u.update].sort(), delete: [...u.delete].sort(),
    filtraPorUnidade: u.comUnidade,
    incerto: u.incerto,
    manual: [...u.manual],
    arquivos: [...u.arquivos].sort(),
  }));
  return { tabelas, acoesPorPagina };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { tabelas, acoesPorPagina } = mapearUso();
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ tabelas, acoesPorPagina }, null, 1));
  } else {
    for (const t of tabelas) {
      const marcas = [t.filtraPorUnidade && "unidade_id no código", t.incerto && "nome dinâmico", t.manual.length && "manual"].filter(Boolean);
      console.log(`\n${t.tabela}${marcas.length ? `  [${marcas.join("; ")}]` : ""}`);
      for (const op of ["select", "insert", "update", "delete"]) if (t[op].length) console.log(`  ${op.padEnd(6)} ${t[op].join(" ")}`);
    }
    console.log(`\n${tabelas.length} tabelas`);
  }
}
