#!/usr/bin/env node
// Smoke das APIs /api/intelligence/* contra um deploy (preview ou produção), sem navegador.
//
// Uso:
//   BASE_URL=https://<preview>.vercel.app \
//   HEFISTO_QA_TOKEN=<access token do usuário de teste> \
//   HEFISTO_QA_UNIDADE=<uuid da unidade do usuário> \
//   [HEFISTO_QA_OUTRA_UNIDADE=<uuid de unidade de OUTRA empresa>] \
//   node scripts/qa/smoke-intelligence.mjs
//
// Credenciais só do ambiente (nunca no repositório, nunca impressas).
// Sem token: roda só os casos sem sessão (401). Só faz GET e um POST de
// pergunta (leitura): não confirma ação nenhuma, não escreve dado do ERP.

import { pathToFileURL } from "node:url";

const PERGUNTA ="Quanto vendi hoje?";

/** Casos do smoke. Cada um devolve { ok, detalhe }. */
export function montarCasos({ token, unidade, outraUnidade }) {
  const auth = token ? { authorization: `Bearer ${token}` } : {};
  const comUnidade = (u) => ({ ...auth, ...(u ? { "x-hefisto-unidade": u } : {}) });
  const casos = [
    { nome: "brief sem token → 401", metodo: "GET", caminho: "/api/intelligence/brief", headers: {}, espera: (r) => r.status === 401 },
    { nome: "ask sem token → 401", metodo: "POST", caminho: "/api/intelligence/ask", headers: {}, corpo: { texto: PERGUNTA }, espera: (r) => r.status === 401 },
    { nome: "token inválido → 401", metodo: "GET", caminho: "/api/intelligence/history", headers: { authorization: "Bearer invalido.invalido.invalido" }, espera: (r) => r.status === 401 },
  ];
  if (!token) return casos;
  casos.push(
    {
      nome: "brief com sessão → 200", metodo: "GET", caminho: "/api/intelligence/brief", headers: comUnidade(unidade),
      espera: (r) => r.status === 200 && r.json?.brief && typeof r.json.correlationId === "string",
    },
    {
      nome: `ask "${PERGUNTA}" → 200 com fonte`, metodo: "POST", caminho: "/api/intelligence/ask", headers: comUnidade(unidade), corpo: { texto: PERGUNTA, canal: "web" },
      espera: (r) => r.status === 200 && ["resposta", "pergunta"].includes(r.json?.tipo)
        && Array.isArray(r.json?.fontesConsultadas) && r.json.fontesConsultadas.length > 0,
    },
    {
      nome: "history com sessão → 200", metodo: "GET", caminho: "/api/intelligence/history", headers: comUnidade(unidade),
      espera: (r) => r.status === 200 && Array.isArray(r.json?.itens),
    },
  );
  if (outraUnidade) {
    casos.push({
      nome: "unidade de outra empresa → 403", metodo: "GET", caminho: "/api/intelligence/brief", headers: comUnidade(outraUnidade),
      // 403 é o esperado; 200 seria vazamento entre empresas (CRÍTICO)
      espera: (r) => r.status === 403,
      critico: (r) => r.status === 200,
    });
  }
  return casos;
}

export async function rodarSmoke({ baseUrl, token = null, unidade = null, outraUnidade = null, fetchImpl = fetch, timeoutMs = 60_000 }) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  if (!/^https?:\/\//.test(base)) throw new Error("BASE_URL inválida (precisa começar com http:// ou https://).");
  const resultados = [];
  for (const c of montarCasos({ token, unidade, outraUnidade })) {
    const inicio = Date.now();
    let r = { status: 0, json: null };
    let erro = null;
    try {
      const resp = await fetchImpl(base + c.caminho, {
        method: c.metodo,
        headers: { accept: "application/json", ...(c.corpo ? { "content-type": "application/json" } : {}), ...c.headers },
        body: c.corpo ? JSON.stringify(c.corpo) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      });
      r = { status: resp.status, json: await resp.json().catch(() => null) };
    } catch (e) {
      erro = e?.name === "TimeoutError" ? "tempo esgotado" : (e?.cause?.code || e?.message || "falha de rede");
    }
    resultados.push({
      nome: c.nome, ok: !erro && Boolean(c.espera(r)), critico: !erro && Boolean(c.critico?.(r)),
      status: r.status, codigo: r.json?.codigo || null, erro, ms: Date.now() - inicio,
    });
  }
  return { ok: resultados.every((x) => x.ok), critico: resultados.some((x) => x.critico), resultados };
}

async function main() {
  const env = process.env;
  const { ok, critico, resultados } = await rodarSmoke({
    baseUrl: env.BASE_URL, token: env.HEFISTO_QA_TOKEN || null,
    unidade: env.HEFISTO_QA_UNIDADE || null, outraUnidade: env.HEFISTO_QA_OUTRA_UNIDADE || null,
  });
  for (const x of resultados) {
    const extra = x.erro ? `erro: ${x.erro}` : `HTTP ${x.status}${x.codigo ? ` ${x.codigo}` : ""}`;
    console.log(`${x.ok ? "OK  " : "FALHA"} ${x.nome} (${extra}, ${x.ms} ms)${x.critico ? "  ← CRÍTICO: vazamento entre empresas" : ""}`);
  }
  if (!env.HEFISTO_QA_TOKEN) console.log("Sem HEFISTO_QA_TOKEN: só os casos sem sessão rodaram.");
  console.log(ok ? "Smoke OK." : "Smoke com falha.");
  // política de publicação: o runner só considera o preview validado com o smoke completo no MESMO commit
  if (env.HEFISTO_REGISTRAR_PREVIEW) {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const { spawnSync } = await import("node:child_process");
    const commit = env.HEFISTO_QA_COMMIT || spawnSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
    mkdirSync(dirname(env.HEFISTO_REGISTRAR_PREVIEW), { recursive: true });
    writeFileSync(env.HEFISTO_REGISTRAR_PREVIEW, JSON.stringify({
      base_url: env.BASE_URL, commit_sha: commit, ok, critico,
      completo: Boolean(env.HEFISTO_QA_TOKEN && env.HEFISTO_QA_OUTRA_UNIDADE), em: new Date().toISOString(),
    }, null, 2));
  }
  process.exit(critico ? 2 : ok ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
