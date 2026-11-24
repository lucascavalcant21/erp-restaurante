import test from "node:test";
import assert from "node:assert/strict";
import { domingosDaEscala, escalaDeDomingos, planoDeFolgas, conferirAtestado, diasDoPeriodo, feriadosParaSugerir, trabalhaDomingo } from "./rh-rapido.mjs";

const EQUIPE = [
  { id: "a", nome: "Eduarda Lima", genero: "Feminino", dias_trabalho: "0,2,3,4,5,6", horario_entrada: "11:00", horario_saida: "19:00" },
  { id: "b", nome: "Bruno Souza", genero: "Masculino", dias_trabalho: "0,1,2,3,4,5", horario_entrada: "09:00", horario_saida: "17:00" },
  { id: "c", nome: "Carla Dias", genero: "Feminino", dias_trabalho: "1,2,3,4,5", horario_entrada: "08:00", horario_saida: "16:00" },
  { id: "d", nome: "Demitido", status: "inativo" },
];

test("domingos do mês e do seguinte", () => {
  const ds = domingosDaEscala("2026-11-24");
  assert.deepEqual(ds.map((d) => d.data), ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"]);
  assert.equal(ds[0].passou, true);
  assert.equal(ds[4].passou, false);
});

test("grade de domingos: quem trabalha domingo primeiro, limite por gênero, quem folga em cada domingo", () => {
  const ds = domingosDaEscala("2026-11-24");
  const folgas = [
    { id: "f1", colaborador_id: "a", data_folga: "2026-11-08" },
    { id: "f2", colaborador_id: "b", data_folga: "2026-11-08" },
    { id: "f3", colaborador_id: "b", data_folga: "2026-11-22" },
  ];
  const g = escalaDeDomingos(EQUIPE, folgas, ds);
  assert.deepEqual(g.linhas.map((l) => l.id), ["b", "a", "c"]);
  const edu = g.linhas.find((l) => l.id === "a");
  assert.equal(edu.limite, 2);
  assert.deepEqual(edu.porMes.map((m) => m.situacao), ["pode_mais", "falta"]);
  const bruno = g.linhas.find((l) => l.id === "b");
  assert.equal(bruno.porMes[0].situacao, "acima");
  assert.equal(bruno.celulas[1].folgaId, "f2");
  assert.deepEqual(g.colunas[1].deFolga, ["Bruno", "Eduarda"]);
  assert.equal(trabalhaDomingo(EQUIPE[2]), false);
  assert.deepEqual(g.faltando, [{ nome: "Bruno", anoMes: "2026-12" }, { nome: "Eduarda", anoMes: "2026-12" }]);
});

test("folga para várias pessoas e dias: pula quem já tem", () => {
  const r = planoDeFolgas({ colaboradores: EQUIPE, ids: ["a", "b"], datas: ["2026-11-25", "2026-11-26"], folgas: [{ colaborador_id: "a", data_folga: "2026-11-25" }] });
  assert.equal(r.gravar.length, 3);
  assert.deepEqual(r.pulados, [{ id: "a", nome: "Eduarda", data: "2026-11-25" }]);
  assert.equal(r.gravar[0].descricao, "Folga");
  assert.equal(planoDeFolgas({ colaboradores: EQUIPE, ids: ["a"], datas: ["2026-11-29"] }).gravar[0].descricao, "Domingo");
});

test("atestado: dias viram período; mais de 30 dias vai pela ficha", () => {
  const r = conferirAtestado({ colaboradorId: "a", inicio: "2026-11-24", dias: 3 });
  assert.deepEqual([r.data_inicio, r.data_fim, r.dias, r.erros.length], ["2026-11-24", "2026-11-26", 3, 0]);
  assert.ok(conferirAtestado({ inicio: "2026-11-24", dias: 1 }).erros.length);
  assert.ok(conferirAtestado({ colaboradorId: "a", inicio: "2026-11-24", dias: 40 }).erros.some((e) => e.includes("30 dias")));
  assert.equal(diasDoPeriodo("2026-11-30", "2026-12-02").length, 3);
});

test("feriados: sugere os nacionais que faltam, de hoje em diante", () => {
  const s = feriadosParaSugerir("2026-11-24", [{ data: "2026-12-25" }]);
  assert.equal(s[0].data, "2027-01-01");
  assert.ok(!s.some((f) => f.data === "2026-12-25"));
  assert.ok(!s.some((f) => f.data < "2026-11-24"));
});
