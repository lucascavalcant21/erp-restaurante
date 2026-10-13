// node --test app/lib/cadastro-assistente.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { modalidadeDe, aplicarModalidade, etapasPara, camposDaEtapa, validarEtapa, revisarCadastro, documentosExigidos, diasExperienciaDe } from "./cadastro-assistente.mjs";

const piso = { valor: 2321.4, fonte: "CCT Foz 2026/2027 cl. 3" };
const base = { nome: "Ana Souza", cargo: "Garçom", cpf: "529.982.247-25", telefone: "45999998888", data_admissao: "2026-10-13", salario: "2321.40", tipo_contrato: "Fixo", status_contrato: "Definitivo" };

test("modalidade ↔ campos que o banco lê (RH-6)", () => {
  assert.equal(modalidadeDe(aplicarModalidade({}, "eventual")), "eventual");
  const exp = aplicarModalidade({}, "clt_experiencia", 30);
  assert.equal(exp.status_contrato, "Experiência 30");
  assert.equal(modalidadeDe(exp), "clt_experiencia");
  assert.equal(diasExperienciaDe(exp), 30);
  assert.equal(aplicarModalidade({}, "clt_experiencia", 99).status_contrato, "Experiência 45"); // só 30 ou 45
  assert.equal(modalidadeDe(aplicarModalidade({ status_contrato: "Experiência 45" }, "clt_indeterminado")), "clt_indeterminado");
});

test("8 etapas na CLT; eventual não vê jornada nem benefícios", () => {
  assert.equal(etapasPara("clt_experiencia").length, 8);
  assert.deepEqual(etapasPara("eventual").map((e) => e.id), ["identificacao", "funcao", "vinculo", "salario", "documentos", "revisao"]);
  assert.ok(camposDaEtapa("vinculo", "clt_experiencia").some((c) => c.k === "dias_experiencia"));
  assert.ok(!camposDaEtapa("vinculo", "clt_indeterminado").some((c) => c.k === "dias_experiencia"));
  assert.equal(camposDaEtapa("salario", "eventual")[0].rotulo, "Diária combinada (R$)");
});

test("obrigatório depende da modalidade: CPF e data de início na CLT, não no extra", () => {
  const semCpf = { ...base, cpf: "", data_admissao: "" };
  assert.ok(validarEtapa(semCpf, "identificacao").erros.cpf);
  assert.ok(validarEtapa(semCpf, "vinculo").erros.data_admissao);
  const extra = aplicarModalidade(semCpf, "eventual");
  assert.equal(validarEtapa(extra, "identificacao").ok, true);
  assert.ok(validarEtapa(extra, "identificacao").avisos.cpf);
  assert.equal(validarEtapa(extra, "vinculo").ok, true);
});

test("formato: CPF, e-mail e telefone inválidos bloqueiam", () => {
  const r = validarEtapa({ ...base, cpf: "111.111.111-11", email: "x@", telefone: "999" }, "identificacao");
  assert.deepEqual(Object.keys(r.erros).sort(), ["cpf", "email", "telefone"]);
});

test("salário abaixo do piso da CCT avisa (não bloqueia); intervalo curto avisa", () => {
  const r = validarEtapa({ ...base, salario: "1800" }, "salario", { piso });
  assert.equal(r.ok, true);
  assert.ok(r.avisos.salario.includes("piso"));
  const j = validarEtapa({ ...base, horario_entrada: "10:00", horario_saida: "19:00", tempo_intervalo: 30, dias_trabalho: "1,2,3,4,5,6" }, "jornada");
  assert.ok(j.avisos.tempo_intervalo);
  // jornada que cruza a meia-noite conta certo
  const n = validarEtapa({ ...base, horario_entrada: "18:00", horario_saida: "02:00", tempo_intervalo: 60, dias_trabalho: "1" }, "jornada");
  assert.ok(!n.avisos.tempo_intervalo);
});

test("revisão: cadastro completo passa; faltando cargo bloqueia na etapa certa", () => {
  assert.equal(revisarCadastro(base, { piso }).ok, true);
  const r = revisarCadastro({ ...base, cargo: "" });
  assert.equal(r.ok, false);
  assert.equal(r.bloqueios[0].etapa.id, "funcao");
});

test("documentos: CLT exige ASO e contrato; extra exige recibo por serviço", () => {
  assert.ok(documentosExigidos("clt_experiencia").some((d) => d.doc.includes("ASO") && d.nivel === "obrigatorio"));
  assert.ok(documentosExigidos("eventual").some((d) => d.doc.includes("Recibo")));
  assert.ok(!documentosExigidos("eventual").some((d) => d.doc.includes("ASO")));
});
