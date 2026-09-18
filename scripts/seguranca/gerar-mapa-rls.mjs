// Gera o MAPA DE RLS da migração 1B-02: tabela → comando → permissões → escopo.
//
// Fontes, em ordem de precedência:
//   1. mapa-rls-curado.mjs      decisões à mão (fora, negado, global, pai, sensíveis da 1B)
//   2. Etapa 3                  mapa sensível já revisado na Fase 1A (lido do próprio .sql)
//   3. mapear-uso-tabelas.mjs   uso REAL medido no código: a tela que lê a tabela
//                               dá a chave .view da página; a que escreve dá as
//                               ações de escrita da página no catálogo
//
// O resultado é escrito ENTRE as marcas <<MAPA_INICIO>> e <<MAPA_FIM>> do
// arquivo da migração (e em docs/seguranca/FASE_1B_MAPA_RLS.md). O teste de
// migrações falha se o arquivo estiver desatualizado em relação ao código.
//
// Uso: node scripts/seguranca/gerar-mapa-rls.mjs [--verificar]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mapearUso } from "./mapear-uso-tabelas.mjs";
import {
  TABELAS_FORA, ESCOPO_NEGADO, ESCOPO_GLOBAL, PAI, SENSIVEIS_1B, FORA_DA_CASCATA, ACOES_POR_COMANDO,
} from "./mapa-rls-curado.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const MIGRACAO = path.join(raiz, "db/1b/02_rls_permissao_e_tabelas_filho.sql");
export const DOC = path.join(raiz, "docs/seguranca/FASE_1B_MAPA_RLS.md");
const COMANDOS = ["select", "insert", "update", "delete"];
const CASCATA = ["configuracoes.units.delete", "configuracoes.stores.delete", "gestao.units.delete"];

export function mapaDaEtapa3(fonte = fs.readFileSync(path.join(raiz, "db/migracao_rbac_tabelas_sensiveis.sql"), "utf8")) {
  const mapa = {};
  for (const m of fonte.matchAll(/\(\s*'([a-z0-9_]+)',\s*'(select|insert|update|delete)',\s*array\[([^\]]*)\]/g)) {
    const chaves = [...m[3].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    (mapa[m[1]] ||= {})[m[2]] = chaves;
  }
  return mapa;
}

function chavesDaOrigem(origem, comando, acoesPorPagina) {
  if (origem === "global") return ["*escopo*"];
  if (/^(publica|sem_catalogo):/.test(origem)) return [];
  const acoes = acoesPorPagina[origem] || [];
  const validas = ACOES_POR_COMANDO[comando].filter((a) => acoes.includes(a));
  return (validas.length ? validas : ["view"]).map((a) => `${origem}.${a}`);
}

/** Linhas do mapa: { tabela, comando, permissoes[], escopo, pai, fk, origem, motivo } */
export function gerarLinhasMapa() {
  const { tabelas, acoesPorPagina } = mapearUso();
  const usadas = new Map(tabelas.filter((t) => !t.tabela.startsWith("*")).map((t) => [t.tabela, t]));
  const cascata = tabelas.find((t) => t.tabela === "*unidade*");
  const etapa3 = mapaDaEtapa3();

  const nomes = new Set([...usadas.keys(), ...Object.keys(etapa3), ...Object.keys(SENSIVEIS_1B),
    ...Object.keys(PAI), ...Object.keys(ESCOPO_GLOBAL), ...Object.keys(ESCOPO_NEGADO)]);
  const linhas = [];

  for (const tabela of [...nomes].sort()) {
    if (TABELAS_FORA[tabela]) continue;
    const escopo = ESCOPO_NEGADO[tabela] ? "negado" : ESCOPO_GLOBAL[tabela] ? "global" : PAI[tabela] ? "pai" : "unidade";
    const base = { tabela, escopo, pai: PAI[tabela]?.pai || null, fk: PAI[tabela]?.fk || null };

    if (escopo === "negado") {
      linhas.push({ ...base, comando: "*", permissoes: [], origem: "curado", motivo: ESCOPO_NEGADO[tabela] });
      continue;
    }

    const curado = SENSIVEIS_1B[tabela] || etapa3[tabela];
    for (const comando of COMANDOS) {
      let permissoes;
      let origem;
      if (curado) {
        if (!curado[comando]) continue; // sensível sem o comando = negado
        permissoes = curado[comando];
        origem = SENSIVEIS_1B[tabela] ? "curado-1b" : "curado-etapa3";
      } else {
        const uso = usadas.get(tabela);
        const origens = uso ? uso[comando] : [];
        permissoes = [...new Set(origens.flatMap((o) => chavesDaOrigem(o, comando, acoesPorPagina)))];
        if (comando === "delete" && cascata && escopo !== "global" && !FORA_DA_CASCATA.includes(tabela)) {
          permissoes = [...new Set([...permissoes, ...CASCATA])];
        }
        origem = "codigo";
        if (!permissoes.length) continue; // o app não faz este comando nesta tabela: negado
      }
      if (permissoes.includes("*escopo*")) permissoes = ["*escopo*"];
      const motivo = ESCOPO_GLOBAL[tabela] || usadas.get(tabela)?.manual?.join("; ") || "";
      linhas.push({ ...base, comando, permissoes: [...permissoes].sort(), origem, motivo });
    }
  }
  return { linhas, tabelasDoApp: [...usadas.keys()].sort() };
}

const sqlTexto = (v) => (v === null || v === undefined ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const sqlArray = (a) => `array[${a.map(sqlTexto).join(",")}]::text[]`;

export function blocoSql({ linhas, tabelasDoApp }) {
  const valores = linhas.map((l) =>
    `  (${sqlTexto(l.tabela)}, ${sqlTexto(l.comando)}, ${sqlArray(l.permissoes)}, ${sqlTexto(l.escopo)}, ${sqlTexto(l.pai)}, ${sqlTexto(l.fk)}, ${sqlTexto(l.origem)}, ${sqlTexto(l.motivo)})`);
  return `/* <<MAPA_INICIO>> — gerado por scripts/seguranca/gerar-mapa-rls.mjs; não edite à mão */
insert into hefisto_privado.mapa_rls_v2 (tabela, comando, permissoes, escopo, pai, fk, origem, motivo) values
${valores.join(",\n")};

insert into hefisto_privado.tabelas_do_app (tabela) values
${tabelasDoApp.map((t) => `  (${sqlTexto(t)})`).join(",\n")};
/* <<MAPA_FIM>> */`;
}

export function aplicarNoArquivo(fonte, bloco) {
  const ini = fonte.indexOf("/* <<MAPA_INICIO>>");
  const fim = fonte.indexOf("/* <<MAPA_FIM>> */");
  if (ini < 0 || fim < 0) throw new Error("marcas <<MAPA_INICIO>>/<<MAPA_FIM>> não encontradas na migração 02");
  return fonte.slice(0, ini) + bloco + fonte.slice(fim + "/* <<MAPA_FIM>> */".length);
}

export function documento({ linhas }) {
  const porTabela = new Map();
  for (const l of linhas) {
    if (!porTabela.has(l.tabela)) porTabela.set(l.tabela, { escopo: l.escopo, pai: l.pai, fk: l.fk, origem: new Set(), cmds: {} });
    const t = porTabela.get(l.tabela);
    t.origem.add(l.origem);
    t.cmds[l.comando] = l.permissoes;
  }
  const celula = (p) => (!p ? "negado" : p.includes("*escopo*") ? "unidade (qualquer perfil válido)" : p.length > 4 ? `${p.slice(0, 3).join(", ")} … (+${p.length - 3})` : p.join(", "));
  const linhasMd = [...porTabela.entries()].map(([tabela, t]) => {
    const escopo = t.escopo === "pai" ? `pai: ${t.pai}.${t.fk}` : t.escopo;
    if (t.escopo === "negado") return `| ${tabela} | negado | negado | negado | negado | negado | ${[...t.origem].join(", ")} |`;
    return `| ${tabela} | ${escopo} | ${celula(t.cmds.select)} | ${celula(t.cmds.insert)} | ${celula(t.cmds.update)} | ${celula(t.cmds.delete)} | ${[...t.origem].join(", ")} |`;
  });
  return `# Fase 1B — Mapa de RLS (gerado)

Gerado por \`scripts/seguranca/gerar-mapa-rls.mjs\` a partir do uso real no
código, do mapa sensível da Etapa 3 e das decisões em
\`scripts/seguranca/mapa-rls-curado.mjs\`. Não edite à mão.

Leitura: cada célula é a lista de permissões (basta uma) exigida para o
comando, sempre combinada com a unidade — da própria linha (escopo
"unidade"), da tabela-pai (escopo "pai") ou de qualquer unidade do escopo do
usuário (escopo "global"). **negado** = nenhuma policy: ninguém logado executa
o comando, nem o administrador geral (só a service role, no servidor).

Tabelas que existirem no banco e não estiverem aqui ficam **negadas** pela
migração 02 (negar por padrão). O mapa completo, com todas as chaves, fica no
banco em \`hefisto_privado.mapa_rls_v2\`.

| Tabela | Escopo | Ler | Inserir | Alterar | Apagar | Origem |
|---|---|---|---|---|---|---|
${linhasMd.join("\n")}
`;
}

const executadoDireto = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (executadoDireto) {
  const mapa = gerarLinhasMapa();
  const fonte = fs.readFileSync(MIGRACAO, "utf8").replace(/\r\n/g, "\n");
  const nova = aplicarNoArquivo(fonte, blocoSql(mapa));
  const doc = documento(mapa);
  if (process.argv.includes("--verificar")) {
    const docAtual = fs.existsSync(DOC) ? fs.readFileSync(DOC, "utf8").replace(/\r\n/g, "\n") : "";
    if (nova !== fonte || doc !== docAtual) {
      console.error("Mapa de RLS desatualizado em relação ao código. Rode: node scripts/seguranca/gerar-mapa-rls.mjs");
      process.exit(1);
    }
    console.log(`mapa de RLS em dia: ${mapa.linhas.length} regras`);
  } else {
    fs.writeFileSync(MIGRACAO, nova);
    fs.writeFileSync(DOC, doc);
    console.log(`mapa gerado: ${mapa.linhas.length} regras em ${new Set(mapa.linhas.map((l) => l.tabela)).size} tabelas`);
  }
}
