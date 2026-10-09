// IC-1/IC-2 — contratos, períodos, esquemas, escopo, banco escopado e Context Engine.
// Rode: node --test app/lib/intelligence/__tests__/
import test from "node:test";
import assert from "node:assert/strict";
import { metrica, insuficiente, ErroDeContrato, NATUREZA, CONFIANCA, DADOS_INSUFICIENTES, confiancaPorCompletude } from "../core/contratos.mjs";
import { resolverPeriodo, periodoAnterior, hojeNoFuso, diasDoPeriodo, saudacaoNoFuso } from "../core/periodos.mjs";
import { s, exigir } from "../schemas/schema.mjs";
import { escopoDoContexto, exigirEscopo, ErroDeEscopo } from "../context/escopo.mjs";
import { criarDbEscopado, ErroDeIsolamento, TABELAS } from "../context/db-escopado.mjs";
import { montarContextoInteligencia, limparTela, moduloDaRota } from "../context/context-engine.mjs";
import { PERMISSOES, criarVerificador } from "../permissions/mapa.mjs";
import { allPermissionKeys } from "../../permissions-catalog.mjs";
import { bancoFalso, contexto, depsFalsas, AGORA, EMPRESA_A } from "./apoio.mjs";

const escopoFake = { unidadeId: "loja-a", empresaId: EMPRESA_A };
const base = {
  metrica: "faturamento", valor: 100, unidade: "BRL", periodo: { de: "2026-10-01", ate: "2026-10-07" },
  fontes: [{ tabela: "fin_faturamento_diario" }], escopo: escopoFake, completude: 1, confianca: CONFIANCA.ALTA, apuradoEm: AGORA.toISOString(),
};

// ── contratos ────────────────────────────────────────────────────────────────
test("métrica completa passa e sai congelada", () => {
  const m = metrica(base);
  assert.equal(m.status, "ok");
  assert.equal(m.natureza, NATUREZA.REAL);
  assert.ok(Object.isFrozen(m) && Object.isFrozen(m.fontes));
});

test("métrica REAL sem fonte, período, unidade ou horário é recusada", () => {
  for (const tirar of ["fontes", "periodo", "escopo", "apuradoEm"]) {
    const p = { ...base, [tirar]: tirar === "fontes" ? [] : null };
    assert.throws(() => metrica(p), ErroDeContrato, `deveria recusar sem ${tirar}`);
  }
});

test("valor não numérico (NaN, null) não vira métrica: tem de ser insuficiente()", () => {
  assert.throws(() => metrica({ ...base, valor: NaN }), ErroDeContrato);
  assert.throws(() => metrica({ ...base, valor: null }), ErroDeContrato);
});

test("dado parcial exige explicação e sai marcado como parcial", () => {
  assert.throws(() => metrica({ ...base, completude: 0.5, confianca: CONFIANCA.BAIXA }), ErroDeContrato);
  const m = metrica({ ...base, completude: 0.5, confianca: CONFIANCA.BAIXA, observacoes: ["3 de 6 dias lançados"] });
  assert.equal(m.status, "parcial");
  assert.equal(m.cobertura, "parciais");
});

test("comparação não pode misturar REAL com PROJEÇÃO", () => {
  assert.throws(() => metrica({ ...base, comparacao: { valor: 1, natureza: NATUREZA.PROJECAO } }), ErroDeContrato);
});

test("insuficiente nunca carrega valor e exige motivo", () => {
  const i = insuficiente({ metrica: "cmv", motivo: "Sem inventário final." });
  assert.equal(i.valor, null);
  assert.equal(i.rotulo, DADOS_INSUFICIENTES);
  assert.throws(() => insuficiente({ metrica: "cmv" }), ErroDeContrato);
});

test("confiança por completude", () => {
  assert.deepEqual([1, 0.9, 0.5, 0].map((c) => confiancaPorCompletude(c)), ["alta", "media", "baixa", "nenhuma"]);
});

// ── períodos ─────────────────────────────────────────────────────────────────
test("hoje é o do fuso da empresa, não o UTC", () => {
  const tarde = new Date("2026-10-08T01:30:00Z"); // 07/10 22:30 em São Paulo
  assert.equal(hojeNoFuso(tarde, "America/Sao_Paulo"), "2026-10-07");
  assert.equal(hojeNoFuso(tarde, "UTC"), "2026-10-08");
  assert.equal(saudacaoNoFuso(tarde), "Boa noite");
});

test("semana vai de segunda até hoje; anterior é a mesma janela uma semana antes", () => {
  const p = resolverPeriodo("semana", { agora: AGORA });
  assert.deepEqual([p.de, p.ate, p.dias], ["2026-10-05", "2026-10-07", 3]);
  const a = periodoAnterior(p);
  assert.deepEqual([a.de, a.ate], ["2026-09-28", "2026-09-30"]);
});

test("mês em andamento compara com os mesmos dias do mês anterior", () => {
  const p = resolverPeriodo("mes", { agora: AGORA });
  assert.deepEqual([p.de, p.ate], ["2026-10-01", "2026-10-07"]);
  assert.deepEqual([periodoAnterior(p).de, periodoAnterior(p).ate], ["2026-09-01", "2026-09-07"]);
  assert.equal(diasDoPeriodo(p).length, 7);
});

test("próximos dias e mês passado", () => {
  assert.deepEqual([resolverPeriodo("proximos_dias", { agora: AGORA, dias: 3 }).ate], ["2026-10-10"]);
  const mp = resolverPeriodo("mes_passado", { agora: AGORA });
  assert.deepEqual([mp.de, mp.ate], ["2026-09-01", "2026-09-30"]);
});

// ── esquemas ─────────────────────────────────────────────────────────────────
test("objeto fechado recusa campo extra e gera JSON Schema aceito pela API", () => {
  const sc = s.object({ produto: s.string({ max: 80, min: 1 }), quantidade: s.number({ min: 0.001, max: 10000 }), unidade: s.opcional(s.enum(["kg", "g"])) });
  assert.equal(sc.parse({ produto: "Picanha", quantidade: 2, unidade: "kg" }).ok, true);
  assert.equal(sc.parse({ produto: "Picanha", quantidade: 2, unidade: "kg", empresa_id: "x" }).ok, false);
  assert.equal(sc.parse({ produto: "Picanha", quantidade: -1, unidade: null }).ok, false);
  const js = sc.json();
  assert.equal(js.additionalProperties, false);
  assert.deepEqual(js.required, ["produto", "quantidade", "unidade"]);
  assert.ok(!JSON.stringify(js).includes("minimum") && !JSON.stringify(js).includes("maxLength"));
});

test("texto com caracteres invisíveis/bidi é limpo", () => {
  assert.equal(exigir(s.string(), "Pic‮anha​"), "Picanha");
});

// ── escopo ───────────────────────────────────────────────────────────────────
test("escopo só nasce de RequestContext autêntico", async () => {
  const ctx = await contexto();
  const e = escopoDoContexto(ctx);
  assert.equal(e.unidadeId, "loja-a");
  assert.equal(e.empresaId, EMPRESA_A);
  assert.throws(() => escopoDoContexto({ unidadeId: "loja-b", userId: "x", actor: { tipo: "usuario" } }), ErroDeEscopo);
  assert.throws(() => exigirEscopo({ unidadeId: "loja-b" }), ErroDeEscopo);
});

test("usuário da empresa A pedindo a unidade da empresa B não tem contexto", async () => {
  await assert.rejects(() => contexto(undefined, "loja-b"), /UNIDADE_FORA_DO_ESCOPO/);
});

test("sem unidade selecionada não há escopo (Central não mistura unidades)", async () => {
  const ctx = await contexto(undefined, null);
  assert.throws(() => escopoDoContexto(ctx), (e) => e.codigo === "UNIDADE_NAO_SELECIONADA");
});

// ── banco escopado ───────────────────────────────────────────────────────────
const linhasMisturadas = {
  fin_faturamento_diario: [
    { unidade_id: "loja-a", data: "2026-10-06", receita: 1000 },
    { unidade_id: "loja-b", data: "2026-10-06", receita: 999999 },
  ],
};

test("filtro de unidade é injetado automaticamente em tabela de tenant", async () => {
  const db = bancoFalso(linhasMisturadas);
  const dbe = criarDbEscopado(db, escopoDoContexto(await contexto()));
  const r = await dbe.from("fin_faturamento_diario").select("data, receita");
  assert.deepEqual(r.data.map((x) => x.receita), [1000]);
  assert.deepEqual(db.chamadas[0].filtros[0], ["eq", "unidade_id", "loja-a"]);
  assert.match(db.chamadas[0].colunas, /unidade_id/);
  assert.equal(dbe.consultas[0].tabela, "fin_faturamento_diario");
});

test("se o filtro/RLS falhar e vier linha de outra empresa, a consulta é BLOQUEADA", async () => {
  const db = bancoFalso(linhasMisturadas, { ignorarFiltros: true });
  const dbe = criarDbEscopado(db, escopoDoContexto(await contexto()));
  await assert.rejects(async () => dbe.from("fin_faturamento_diario").select("*"), ErroDeIsolamento);
});

test("leitura da inteligência não escreve nem lê tabela fora da lista", async () => {
  const dbe = criarDbEscopado(bancoFalso({}), escopoDoContexto(await contexto()));
  assert.throws(() => dbe.from("usuarios_erp"), /fora da lista/);
  assert.equal(typeof dbe.from("insumos").insert, "undefined");
  assert.equal(typeof dbe.rpc, "undefined");
  assert.throws(() => dbe.from("insumos").select("*").or("unidade_id.eq.loja-b"), /não permitida/);
  assert.equal(TABELAS.usuarios_erp, undefined);
});

// ── Context Engine ───────────────────────────────────────────────────────────
test("Context Engine descarta empresa/unidade enviadas pelo cliente", async () => {
  const ctx = await contexto();
  const ic = montarContextoInteligencia({
    requestContext: ctx, agora: AGORA,
    tela: { rota: "/dashboard/operacao/estoque", empresa_id: EMPRESA_A.replace("a", "b"), unidade_id: "loja-b", entidade: { tipo: "produto", id: "abc-1", nome: "Picanha", unidade_id: "loja-b" } },
  });
  assert.equal(ic.escopo.unidadeId, "loja-a");
  assert.equal(ic.tela.modulo, "estoque");
  assert.deepEqual(ic.entidade, { tipo: "produto", id: "abc-1", nome: "Picanha", verificada: false });
  assert.ok(ic.descartados.includes("tenant:empresa_id") && ic.descartados.includes("tenant:unidade_id") && ic.descartados.includes("tenant:entidade.unidade_id"));
  assert.equal(ic.hoje, "2026-10-07");
});

test("tela inválida é descartada campo a campo sem derrubar o pedido", () => {
  const { tela, descartados } = limparTela({ rota: "javascript:alert(1)", entidade: { tipo: "produto", nome: "Picanha" }, extra: 1 });
  assert.equal(tela.rota, null);
  assert.equal(tela.entidade.nome, "Picanha");
  assert.ok(descartados.includes("rota") && descartados.includes("extra"));
  assert.equal(moduloDaRota("/dashboard/financeiro/dre"), "financeiro");
});

// ── permissões ───────────────────────────────────────────────────────────────
test("toda permissão usada pela inteligência existe no catálogo do ERP", () => {
  const catalogo = new Set(allPermissionKeys());
  for (const [cap, chaves] of Object.entries(PERMISSOES)) {
    for (const k of chaves) assert.ok(catalogo.has(k), `${cap}: ${k} não existe no catálogo`);
  }
});

test("permissão é confirmada no banco e negada quando o banco nega", async () => {
  const deps = depsFalsas({ negar: PERMISSOES.cmv });
  const ctx = await contexto(undefined, "loja-a", deps);
  const v = criarVerificador(ctx, deps);
  assert.equal(await v.pode("faturamento"), true);
  assert.equal(await v.pode("cmv"), false);
  const restrito = await contexto("tok-restrito", "loja-a");
  const vr = criarVerificador(restrito, depsFalsas());
  assert.deepEqual(await vr.quais(["validade", "faturamento", "registrar_perda"]), { validade: true, faturamento: false, registrar_perda: false });
});
