// RH pelo Jhon (24/11/2026): folga, atestado e feriado com prévia + Confirmar,
// e "corrigir o ponto" vira link para a tela já na pessoa e no dia.
import test from "node:test";
import assert from "node:assert/strict";
import { darFolga, lancarAtestado, lancarFeriado, linkCorrigirPonto, paramsDoTextoRh } from "../actions/rh-rapido.mjs";
import { acaoPorId, politicaDaAcao } from "../actions/registry.mjs";
import { interpretarPorRegras as interpretarComando } from "../commands/interpretador-regras.mjs";
import { somar, hojeEmSP } from "../../rh-texto.mjs";

const U = "11111111-1111-4111-8111-111111111111";
const EQ = [
  { id: "aaaaaaaa-0000-4000-8000-000000000001", nome: "Eduarda Lima", status: "ativo", genero: "Feminino" },
  { id: "aaaaaaaa-0000-4000-8000-000000000002", nome: "Bruno Souza", status: "ativo", genero: "Masculino" },
  { id: "aaaaaaaa-0000-4000-8000-000000000003", nome: "Ana Paula", status: "ativo" },
  { id: "aaaaaaaa-0000-4000-8000-000000000004", nome: "Ana Costa", status: "ativo" },
];

/** Banco de mentira: cada tabela devolve as linhas dadas, qualquer filtro (o filtro real é do banco). */
function fakeDbe(linhas = {}) {
  return {
    from(tab) {
      const q = { then: (ok, err) => Promise.resolve({ data: linhas[tab] || [], error: null }).then(ok, err) };
      for (const m of ["select", "order", "limit", "in", "eq", "gte", "lte"]) q[m] = () => q;
      return q;
    },
  };
}
function fakeEscrita({ erro = null } = {}) {
  const feitos = [];
  return { feitos, from: (tab) => ({ insert: async (rows) => { if (erro) return { error: { message: erro } }; feitos.push([tab, ...rows]); return { error: null }; } }) };
}
const ctx = (linhas) => ({ dbe: fakeDbe({ colaboradores: EQ, ...linhas }), escopo: { unidadeId: U } });
const hoje = hojeEmSP();

test("registro: as três ações existem, risco MEDIUM, pedem confirmação", () => {
  for (const id of ["rh.dayOff", "rh.sickLeave", "rh.holiday"]) {
    const p = politicaDaAcao(acaoPorId(id));
    assert.deepEqual([p.permitido, p.precisaConfirmacao], [true, true], id);
  }
});

test("frases do dono caem na ação certa; pergunta continua pergunta", () => {
  const it = (t) => interpretarComando(t).valor.intencao;
  assert.equal(it("dá folga pra Eduarda amanhã"), "rh.dar_folga");
  assert.equal(it("Bruno está doente 2 dias"), "rh.atestado");
  assert.equal(it("lança feriado dia 8"), "rh.feriado");
  assert.equal(it("corrigir ponto da Eduarda de ontem"), "rh.corrigir_ponto");
  assert.equal(it("a Eduarda esqueceu de bater o ponto"), "rh.corrigir_ponto");
  assert.equal(it("quem está de folga hoje?"), "rh.escala_dia");
  assert.notEqual(it("cadastrar funcionário novo"), "rh.dar_folga");
});

test("folga: lê quem e quando, mostra prévia e grava só na confirmação", async () => {
  const r = await darFolga.preparar(ctx(), paramsDoTextoRh("dá folga pra Eduarda amanhã"));
  const amanha = somar(hoje, 1);
  assert.equal(r.pronto.payload.folgas.length, 1);
  assert.equal(r.pronto.payload.folgas[0].data_folga, amanha);
  assert.equal(r.pronto.payload.unidade_id, U);
  const db = fakeEscrita();
  const ex = await darFolga.executar({ dbUsuario: db, escopo: { unidadeId: U } }, r.pronto.payload);
  assert.equal(ex.ok, true);
  assert.equal(db.feitos[0][0], "rh_folgas_esporadicas");
  assert.equal(db.feitos[0][1].data_folga, amanha);
  assert.match(darFolga.resumoResultado(ex).texto, /folga lançada/);
});

test("folga: sem pessoa pergunta quem; nome ambíguo pergunta qual; sem data pergunta o dia", async () => {
  assert.equal((await darFolga.preparar(ctx(), { texto: "dar folga amanhã" })).faltando.campo, "pessoaId");
  const amb = await darFolga.preparar(ctx(), { texto: "folga pra Ana amanhã" });
  assert.deepEqual([amb.faltando.campo, amb.faltando.opcoes.length], ["pessoaId", 2]);
  assert.equal((await darFolga.preparar(ctx(), { texto: "dar folga pro Bruno" })).faltando.campo, "inicio");
  const resp = darFolga.aplicarResposta({ texto: "dar folga pro Bruno" }, "inicio", "sábado");
  assert.match(resp.inicio, /^\d{4}-\d{2}-\d{2}$/);
});

test("folga: não repete folga já lançada; avisa domingo acima da regra", async () => {
  const amanha = somar(hoje, 1);
  const ja = await darFolga.preparar(ctx({ rh_folgas_esporadicas: [{ colaborador_id: EQ[0].id, data_folga: amanha }] }), { texto: "folga pra Eduarda amanhã" });
  assert.match(ja.erro, /já tem folga/);
  // dois domingos seguidos no mesmo mês para o Bruno (regra: 1)
  let dom = hoje; while (new Date(`${dom}T12:00:00Z`).getUTCDay() !== 0) dom = somar(dom, 1);
  const dom2 = somar(dom, 7);
  const mesmoMes = dom.slice(0, 7) === dom2.slice(0, 7);
  const r = await darFolga.preparar(ctx({ rh_folgas_esporadicas: [{ colaborador_id: EQ[1].id, data_folga: dom }] }), { texto: "folga pro Bruno", inicio: dom2 });
  assert.equal(r.pronto.payload.folgas[0].descricao, "Domingo");
  assert.equal(r.pronto.preview.linhas.some((l) => /folgas de domingo/.test(l.valor)), mesmoMes);
});

test("folga: unidade diferente da sessão é recusada; erro de RLS vira mensagem clara", async () => {
  const r = await darFolga.preparar(ctx(), { texto: "folga pra Eduarda amanhã" });
  assert.equal((await darFolga.executar({ dbUsuario: fakeEscrita(), escopo: { unidadeId: "outra" } }, r.pronto.payload)).ok, false);
  const rls = await darFolga.executar({ dbUsuario: fakeEscrita({ erro: "new row violates row-level security policy" }), escopo: { unidadeId: U } }, r.pronto.payload);
  assert.match(rls.erro, /acesso ao RH/);
});

test("atestado: 'está doente 2 dias' = hoje + 1; sem dias pergunta quantos; não grava CID", async () => {
  const r = await lancarAtestado.preparar(ctx(), paramsDoTextoRh("o Bruno está doente, 2 dias"));
  assert.deepEqual([r.pronto.payload.data_inicio, r.pronto.payload.data_fim], [hoje, somar(hoje, 1)]);
  const db = fakeEscrita();
  await lancarAtestado.executar({ dbUsuario: db, escopo: { unidadeId: U } }, r.pronto.payload);
  assert.deepEqual(Object.keys(db.feitos[0][1]).sort(), ["colaborador_id", "data_fim", "data_inicio", "parcial", "unidade_id"]);
  assert.equal((await lancarAtestado.preparar(ctx(), { texto: "o Bruno está doente" })).faltando.campo, "dias");
  assert.equal((await lancarAtestado.preparar(ctx(), { texto: "atestado do Bruno" })).faltando.campo, "inicio");
  assert.equal((await lancarAtestado.preparar(ctx(), { texto: "a Eduarda e o Bruno estão doentes amanhã" })).faltando.campo, "pessoaId");
});

test("feriado: data e nome lidos; feriado repetido é recusado; sem data pergunta", async () => {
  const r = await lancarFeriado.preparar(ctx(), paramsDoTextoRh("lança feriado da Padroeira dia 25/12"));
  assert.equal(r.pronto.payload.data.slice(5), "12-25");
  assert.equal(r.pronto.payload.nome, "Padroeira");
  const rep = await lancarFeriado.preparar(ctx({ rh_feriados: [{ id: "f", data: r.pronto.payload.data, nome: "Natal" }] }), { texto: "feriado dia 25/12" });
  assert.match(rep.erro, /já é feriado/);
  assert.equal((await lancarFeriado.preparar(ctx(), { texto: "lança um feriado" })).faltando.campo, "inicio");
});

test("corrigir ponto: link já na pessoa e no dia; sem pessoa oferece os nomes", () => {
  const r = linkCorrigirPonto("corrigir o ponto da Eduarda de ontem", EQ, "2026-11-24");
  assert.equal(r.acoes[0].rota, `/dashboard/rh/ponto/corrigir?colab=${EQ[0].id}&data=2026-11-23`);
  const s = linkCorrigirPonto("corrigir ponto", EQ, "2026-11-24");
  assert.equal(s.acoes.length, 4);
});
