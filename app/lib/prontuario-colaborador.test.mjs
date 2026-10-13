// Testes do prontuário do colaborador (HDEV-RH-001, Fase 2).
// node --test app/lib/prontuario-colaborador.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { ABAS_PRONTUARIO, statusDoColaborador, vinculoAtual, supervisoresDe, pendenciasDoColaborador, tempoDeCasa, mascararCpf } from "./prontuario-colaborador.mjs";
import { CCT_FOZ_2026_2027 } from "./trabalhista/cct-foz-2026-2027.mjs";

const hoje = new Date("2026-10-13T12:00:00Z");

test("as 10 abas pedidas, na ordem", () => {
  assert.deepEqual(ABAS_PRONTUARIO.map((a) => a.rotulo), ["Resumo", "Dados pessoais", "Contratos e vínculos", "Jornada, escala e ponto",
    "Remuneração e benefícios", "Pagamentos e recibos", "Férias e afastamentos", "Documentos e treinamentos", "Avaliação profissional", "Histórico e auditoria"]);
});

test("status: ativo, aviso, desligamento agendado e desligado", () => {
  assert.equal(statusDoColaborador({}, hoje).id, "ativo");
  assert.equal(statusDoColaborador({ status_aviso: "cumprindo_aviso" }, hoje).id, "aviso");
  assert.equal(statusDoColaborador({ data_desligamento: "2026-11-01" }, hoje).id, "desligamento_agendado");
  assert.equal(statusDoColaborador({ status: "inativo", data_desligamento: "2026-08-31" }, hoje).rotulo, "Desligado em 31/08/2026");
});

test("vínculo: extra é trabalho eventual; CLT mostra a fase", () => {
  assert.equal(vinculoAtual({ tipo_contrato: "Freelancer" }).categoria, "Trabalho eventual (extra)");
  const v = vinculoAtual({ tipo_contrato: "Fixo", status_contrato: "Experiência (30 dias)", data_admissao: "2026-10-01" }, hoje);
  assert.equal(v.categoria, "CLT"); assert.equal(v.ehExperiencia, true); assert.equal(v.periodo, 1);
  assert.equal(vinculoAtual({ tipo_contrato: "Fixo", status_contrato: "Definitivo" }, hoje).ehExperiencia, false);
});

test("supervisores pelos ids, aceitando o campo antigo", () => {
  const lista = [{ id: "a", nome: "Lucas" }, { id: "b", nome: "Sarah" }];
  assert.deepEqual(supervisoresDe({ supervisores_ids: ["a", "b"] }, lista), ["Lucas", "Sarah"]);
  assert.deepEqual(supervisoresDe({ supervisor_id: "b" }, lista), ["Sarah"]);
  assert.deepEqual(supervisoresDe({}, lista), []);
});

test("pendências: CPF, início, salário, piso da CCT e experiência vencendo", () => {
  const base = { tipo_contrato: "Fixo", status_contrato: "Definitivo", cpf: "529.982.247-25", data_admissao: "2025-01-10", telefone: "45999991234", chave_pix: "x", salario: 2400 };
  assert.deepEqual(pendenciasDoColaborador(base, { hoje, cct: CCT_FOZ_2026_2027 }), []);
  const abaixo = pendenciasDoColaborador({ ...base, salario: 2200 }, { hoje, cct: CCT_FOZ_2026_2027 });
  assert.match(abaixo[0].texto, /abaixo do piso/); assert.match(abaixo[0].fonte, /cl\. 3/);
  assert.equal(pendenciasDoColaborador({ ...base, salario: 2200 }, { hoje, cct: null }).length, 0); // sem CCT ativa, não alerta piso
  const exp = pendenciasDoColaborador({ ...base, status_contrato: "Experiência (30 dias)", data_admissao: "2026-09-20" }, { hoje, cct: CCT_FOZ_2026_2027 });
  assert.match(exp[0].texto, /faltam 6 dia\(s\)/);
  const prorr = pendenciasDoColaborador({ ...base, status_contrato: "Experiência (30 dias)", data_admissao: "2026-07-20" }, { hoje });
  assert.match(prorr[0].texto, /faltam 4 dia\(s\) para o fim da prorrogação/); // 20/07 + 90 dias = 17/10
  const venc = pendenciasDoColaborador({ ...base, status_contrato: "Experiência (30 dias)", data_admissao: "2026-07-01" }, { hoje });
  assert.match(venc[0].texto, /terminou em 28\/09\/2026 sem registro/);
  const vazio = pendenciasDoColaborador({ tipo_contrato: "Fixo" }, { hoje });
  assert.ok(vazio.some((x) => /CPF não informado/.test(x.texto)) && vazio.some((x) => /Data de início/.test(x.texto)));
  assert.equal(pendenciasDoColaborador({ tipo_contrato: "Freelancer", cpf: "52998224725", telefone: "1", chave_pix: "x" }, { hoje }).length, 0);
});

test("tempo de casa e CPF mascarado", () => {
  assert.equal(tempoDeCasa({ data_admissao: "2024-07-01" }, hoje), "2 anos e 3 meses");
  assert.equal(tempoDeCasa({ data_admissao: "2026-10-01" }, hoje), "menos de 1 mês");
  assert.equal(tempoDeCasa({}, hoje), null);
  assert.equal(mascararCpf("529.982.247-25"), "***.***.*47-25");
  assert.equal(mascararCpf(""), "não informado");
});

test("tela: o prontuário lê colaboradores (não a tabela legada funcionarios) e tem as 4 ações", () => {
  const pagina = fs.readFileSync(new URL("../dashboard/rh/funcionario/[id]/page.js", import.meta.url), "utf8");
  assert.match(pagina, /from\("colaboradores"\)/);
  assert.doesNotMatch(pagina, /from\("funcionarios"\)/);
  for (const acao of ["Editar", "Imprimir", "Contrato", "Desligar"]) assert.ok(pagina.includes(`>${acao}<`) || pagina.includes(`> ${acao}`) || pagina.includes(`${acao}</`), acao);
});

test("tela: o RH abre a edição e o desligamento pelo endereço (?editar= / ?desligar=)", () => {
  const rh = fs.readFileSync(new URL("../dashboard/rh/page.js", import.meta.url), "utf8");
  assert.match(rh, /searchParams\.get\("editar"\)/);
  assert.match(rh, /searchParams\.get\("desligar"\)/);
});
